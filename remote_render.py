#!/usr/bin/env python3
"""remote_render.py — draw a Mr Truth film's shots on THIS machine from a render package, using every core.

On any Linux box (a rented pod, your own server):
    tar xzf render_package.tgz && python3 remote_render.py            # all cores
    python3 remote_render.py --limit 2                               # a quick test: 2 shots
    python3 remote_render.py --part 2/3 --out seg_2.tgz              # one machine's share of three
Needs: node 20+ and the machine's Chromium libraries (apt install libnss3 libgbm1 libasound2 ...).
Output: segments.tgz  -> copy it back and unpack into <job>/mrtruth/segments/ , then re-run MoveFast.
No API keys, no Claude: every planning call already happened where the package was made.
"""
import argparse, json, os, shutil, signal, subprocess, sys, tarfile, threading, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent


def frames_of(task):
    p = task.get("props") or {}
    return int((p.get("scene") or {}).get("durationFrames") or p.get("durationFrames") or 0)


def balanced(todo, workers):
    """The shots split over the processes by length, longest first, each to the process with the fewest frames so
    far (as mrtruth._balanced). A fixed every-n-th split left the film waiting 74 s on one process's last shots."""
    parts, load = [[] for _ in range(max(1, workers))], [0] * max(1, workers)
    for t in sorted(todo, key=lambda t: -frames_of(t)):
        k = load.index(min(load))
        parts[k].append(t)
        load[k] += frames_of(t)
    return [p for p in parts if p]


def split_parts(tasks, n):
    """The film's shots shared between n machines by length (the longest first, each to the machine with the fewest
    frames so far): exactly n lists, every shot in exactly one, the same split on every machine (ties by name)."""
    parts, load = [[] for _ in range(max(1, n))], [0] * max(1, n)
    for t in sorted(tasks, key=lambda t: (-frames_of(t), str(t.get("name")))):
        k = load.index(min(load))
        parts[k].append(t)
        load[k] += frames_of(t)
    return parts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=0, help="render processes (default: cores // 4)")
    ap.add_argument("--concurrency", type=int, default=4, help="frames at once per process")
    ap.add_argument("--limit", type=int, default=0, help="only the first N shots (a timing test)")
    ap.add_argument("--out", default="segments.tgz")
    ap.add_argument("--gl", default="", help="chromium gl backend, e.g. angle / swangle (default: remotion's own)")
    ap.add_argument("--part", default="", help="K/N: draw only this machine's share of N (split_parts)")
    a = ap.parse_args()
    cores = os.cpu_count() or 4
    workers = a.workers or max(1, cores // 4)
    manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
    tasks = manifest["tasks"][: a.limit] if a.limit else manifest["tasks"]
    if a.part:
        k, n = (int(x) for x in a.part.split("/"))
        if not 1 <= k <= n:
            sys.exit(f"--part {a.part}: K must be 1..N")
        tasks = split_parts(tasks, n)[k - 1]
    mine = {t["name"] for t in tasks}                # only this share's shots (a folder may hold an earlier share's)
    renderer, storage = HERE / "renderer", HERE / "storage"
    work = HERE / "work"
    seg = work / "segments"
    seg.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    if not node:
        sys.exit("node is not installed (need 20+).")
    if not (renderer / "node_modules").exists():
        print("installing the renderer's packages (npm ci)...", flush=True)
        subprocess.run(["npm", "ci", "--no-audit", "--no-fund"], cwd=renderer, check=True)
    todo = [dict(t, output=str(seg / t["name"])) for t in tasks if not (seg / t["name"]).exists()]
    print(f"{len(todo)} shot(s) to draw on {cores} cores: {workers} process(es) x {a.concurrency} frames", flush=True)
    env = dict(os.environ)
    if a.gl:
        env["MT_GL"] = a.gl
    first = None
    if len(todo) > 8 and workers > 1 and not (work / "bundle" / "index.html").exists():
        first = min(todo, key=frames_of)          # the bundle is built once, while the shortest shot is drawn
        rest = [t for t in todo if t is not first]
    else:
        rest = todo
    parts = balanced(rest, workers) if len(todo) > 8 else [p for p in [rest] if p]
    t0 = time.time()
    stop = threading.Event()

    def ticker():
        while not stop.wait(30):
            done = len([f for f in seg.glob("*.mp4") if f.name in mine])
            print(f"  {done}/{len(tasks)} shots drawn, {time.time() - t0:.0f}s", flush=True)
    threading.Thread(target=ticker, daemon=True).start()

    procs, failed, plock = [], [], threading.Lock()

    def run(k, part):
        """One render process. The first one to fail stops the others (each with its Chromiums): a machine that cannot
        draw its share says so at once, so the share can be drawn elsewhere."""
        req = work / f"req_{k}.json"
        req.write_text(json.dumps({"bundleDir": str(work / "bundle"), "storageDir": str(storage),
                                   "concurrency": a.concurrency, "tasks": part}), encoding="utf-8")
        with plock:
            if failed:
                return
            p = subprocess.Popen([node, str(renderer / "movefast" / "render.mjs"), str(req)], cwd=str(renderer),
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env,
                                 start_new_session=True)
            procs.append(p)
        out, err = p.communicate()
        if p.returncode != 0:
            with plock:
                if not failed:
                    failed.append(f"renderer failed: {(err or out)[-1200:]}")
                    for q in procs:
                        if q is not p and q.poll() is None:
                            try:
                                os.killpg(q.pid, signal.SIGKILL)
                            except OSError:
                                pass

    if first is not None:
        run(99, [first])
    if parts and not failed:
        with ThreadPoolExecutor(max_workers=len(parts)) as ex:
            list(ex.map(lambda kp: run(*kp), enumerate(parts)))
    stop.set()
    if failed:
        sys.exit(failed[0])
    out = Path(a.out).resolve()
    with tarfile.open(out, "w:gz") as tar:
        for f in sorted(seg.glob("*.mp4")):
            if not f.name.endswith(".part.mp4") and f.name in mine:
                tar.add(f, arcname=f.name)
    print(f"done in {time.time() - t0:.0f}s -> {out} ({out.stat().st_size / 1e6:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
