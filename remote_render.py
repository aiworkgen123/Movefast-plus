#!/usr/bin/env python3
"""remote_render.py — draw a Mr Truth film's shots on THIS machine from a render package, using every core.

On any Linux box (a rented pod, your own server):
    tar xzf render_package.tgz && python3 remote_render.py            # all cores
    python3 remote_render.py --limit 2                               # a quick test: 2 shots
Needs: node 20+ and the machine's Chromium libraries (apt install libnss3 libgbm1 libasound2 ...).
Output: segments.tgz  -> copy it back and unpack into <job>/mrtruth/segments/ , then re-run MoveFast.
No API keys, no Claude: every planning call already happened where the package was made.
"""
import argparse, json, os, shutil, subprocess, sys, tarfile, threading, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=0, help="render processes (default: cores // 4)")
    ap.add_argument("--concurrency", type=int, default=4, help="frames at once per process")
    ap.add_argument("--limit", type=int, default=0, help="only the first N shots (a timing test)")
    ap.add_argument("--out", default="segments.tgz")
    ap.add_argument("--gl", default="", help="chromium gl backend, e.g. angle / swangle (default: remotion's own)")
    a = ap.parse_args()
    cores = os.cpu_count() or 4
    workers = a.workers or max(1, cores // 4)
    manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
    tasks = manifest["tasks"][: a.limit] if a.limit else manifest["tasks"]
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
    parts = [todo[k::workers] for k in range(workers)] if len(todo) > 8 else [todo]
    parts = [p for p in parts if p]
    t0 = time.time()
    stop = threading.Event()

    def ticker():
        while not stop.wait(30):
            done = len([f for f in seg.glob("*.mp4") if not f.name.endswith(".part.mp4")])
            print(f"  {done}/{len(tasks)} shots drawn, {time.time() - t0:.0f}s", flush=True)
    threading.Thread(target=ticker, daemon=True).start()

    def run(k, part):
        req = work / f"req_{k}.json"
        req.write_text(json.dumps({"bundleDir": str(work / "bundle"), "storageDir": str(storage),
                                   "concurrency": a.concurrency, "tasks": part}), encoding="utf-8")
        p = subprocess.run([node, str(renderer / "movefast" / "render.mjs"), str(req)], cwd=str(renderer),
                           capture_output=True, text=True, env=env)
        if p.returncode != 0:
            sys.exit(f"renderer failed: {(p.stderr or p.stdout)[-1200:]}")

    if parts:
        if len(parts) > 1 and not (work / "bundle" / "index.html").exists():
            run(99, parts[0][:1])
            parts[0] = parts[0][1:]
        with ThreadPoolExecutor(max_workers=len(parts)) as ex:
            list(ex.map(lambda kp: run(*kp), enumerate(parts)))
    stop.set()
    out = Path(a.out).resolve()
    with tarfile.open(out, "w:gz") as tar:
        for f in sorted(seg.glob("*.mp4")):
            if not f.name.endswith(".part.mp4"):
                tar.add(f, arcname=f.name)
    print(f"done in {time.time() - t0:.0f}s -> {out} ({out.stat().st_size / 1e6:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
