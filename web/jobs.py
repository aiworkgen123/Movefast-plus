"""Where the films are made: the website's job runner.

The website only takes the files and keeps the records; a film is made elsewhere - today on a rented RunPod machine
(a "pod"), later on your own PC or GPU machine too (RUN_ON: each place is one runner). The runner here does what
scratchpad fullrun.py did by hand (the launcher every pod render so far went through): the code package and the
film's three files go to your R2 storage, one pod is rented with the keys as private settings, it plans the film, draws
every shot, finishes it and uploads the video straight to R2, and is switched off.

Everything a running film needs to be picked up again is in its row (store.py): the pod's id, the run's name, the R2
keys follow from the film's id. So the website can restart at any moment: Studio.tick() finds every film still marked
running and watches it again (and the sweep switches off any pod of ours that no film owns), and a pod that loses the
website carries on, uploads its video and waits to be switched off.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import traceback
from pathlib import Path

import requests

CODE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(CODE))
from farm.s3 import Bucket, S3Error  # noqa: E402
from farm.runpod import RunPod  # noqa: E402
from web import verdict_sync as VS  # noqa: E402

# the keys the website keeps (keys.env in its data folder, never in the code): name, label, needed, where to get it
KEYS = [
    ("RUNPOD_API_KEY", "RunPod", True, "runpod.io → Settings → API Keys"),
    ("FARM_BUCKET_ENDPOINT", "R2 endpoint", True, "https://<account id>.r2.cloudflarestorage.com"),
    ("FARM_BUCKET", "R2 bucket name", False, "empty = videos"),
    ("FARM_BUCKET_KEY_ID", "R2 access key ID", True, "Cloudflare → R2 → Manage API tokens"),
    ("FARM_BUCKET_SECRET", "R2 secret access key", True, "shown once when the R2 token is made"),
    ("GEMINI_API_KEY", "Gemini (picture checks)", True, "aistudio.google.com → API keys"),
    ("ANTHROPIC_API_KEY", "Claude (planning)", True, "console.anthropic.com → API keys"),
    ("WAVESPEED_API_KEY", "WaveSpeed (AI stand-in pictures)", True, "wavespeed.ai → API keys"),
    ("BRAVE_SEARCH_API_KEY", "Brave Search (backup search)", False, "only used when Bing fails"),
    ("EUROPEANA_API_KEY", "Europeana (archive search)", False, "optional"),
]
POD_KEYS = ("GEMINI_API_KEY", "BRAVE_SEARCH_API_KEY", "WAVESPEED_API_KEY", "EUROPEANA_API_KEY", "ANTHROPIC_API_KEY")
POD_PREFIX = "mrtruth-web-"                   # every pod this website rents is named so; the sweep owns only these
GPUS = ("NVIDIA L40", "NVIDIA A40", "NVIDIA RTX PRO 6000 Blackwell Server Edition", "NVIDIA A100-SXM4-40GB",
        "NVIDIA L40S", "NVIDIA RTX PRO 4500 Blackwell", "NVIDIA GeForce RTX 4090", "NVIDIA GeForce RTX 3090",
        "NVIDIA RTX A6000", "NVIDIA RTX A5000", "NVIDIA RTX A4500", "NVIDIA GeForce RTX 4080 SUPER")
REST = "https://rest.runpod.io/v1"
MUSIC_LEVELS = {"quiet": -22.0, "normal": -18.0, "louder": -14.0}
# where a film can be made (the website's "Run on" list); a place that is not ready is shown but cannot be picked
RUN_ON = [
    {"id": "runpod", "label": "RunPod (cloud machine)", "ready": True,
     "note": "rents one machine per film, about $0.89/hour, switched off when done"},
    {"id": "pc", "label": "My PC", "ready": False, "note": "coming: install the helper app on your PC"},
    {"id": "gpu", "label": "My own GPU machine", "ready": False, "note": "coming: install the helper app there"},
]
# how long each part takes (the 11-minute render full-05f3c0: set-up 230 s, planning 1086 s, drawing 921 s), per
# minute of film - only for the progress bar and "about N min left"
SETUP_S, PLAN_S_MIN, DRAW_S_MIN, FINISH_S = 240, 100, 85, 150
STAGES = [                                     # the pod's own log lines, latest first: stage, progress from, to
    ("video uploaded", "Saving the video", 98, 99),
    ("FINISH exit", "Saving the video", 96, 98),
    ("RENDER exit", "Finishing: joining the shots, sound and music", 91, 96),
    ("RENDER start", "Drawing the shots", 60, 91),
    ("PLAN exit", "Planning done, starting to draw", 58, 60),
    ("PLAN start", "Planning: shots, pictures and checks", 15, 58),
    ("pip done", "Setting up the machine", 12, 15),
    ("unpacked", "Setting up the machine", 9, 12),
    ("apt ok", "Setting up the machine", 7, 9),
    (" ip ", "Machine started", 5, 7),
]


def slug(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (title or "").lower()).strip("-")
    return (s[:60].rstrip("-") or "film")


def media_seconds(path: Path) -> float:
    """Length of an audio file in seconds (0 when it is not one)."""
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                              "-of", "json", str(path)], capture_output=True, text=True, timeout=60).stdout
        got = json.loads(out or "{}")
        if not any(s.get("codec_type") == "audio" for s in got.get("streams", [])):
            return 0.0
        return float(got.get("format", {}).get("duration") or 0)
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0.0


class LocalBucket:
    """A folder standing in for R2 (MRTRUTH_WEB_FAKE=1: the website's own tests and a no-cost trial run). Links point
    at the website's /local/ route, which only signed-in people can open."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _p(self, key):
        p = (self.root / key).resolve()
        if self.root.resolve() not in p.parents:
            raise S3Error("bad key")
        return p

    def put_file(self, key, path, content_type=None, timeout=0):
        self._p(key).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, self._p(key))
        return Path(path).stat().st_size

    def put_bytes(self, key, data, content_type=""):
        self._p(key).parent.mkdir(parents=True, exist_ok=True)
        self._p(key).write_bytes(data)

    def get_bytes(self, key):
        if not self._p(key).exists():
            raise S3Error("Storage GET HTTP 404")
        return self._p(key).read_bytes()

    def get_file(self, key, path, timeout=0):
        shutil.copyfile(self._p(key), path)
        return Path(path).stat().st_size

    def exists(self, key):
        return self._p(key).exists()

    def delete(self, key):
        self._p(key).unlink(missing_ok=True)

    def list(self, prefix=""):
        return [{"key": str(p.relative_to(self.root)), "size": p.stat().st_size, "modified": ""}
                for p in sorted(self.root.rglob("*")) if p.is_file() and str(p.relative_to(self.root)).startswith(prefix)]

    def presign(self, key, seconds=0, method="GET", params=None):
        return "/local/" + key


class Studio:
    """The job runner: one thread looks after the queue, one thread per film in progress."""

    def __init__(self, store, data: Path, fake: bool = False):
        self.store, self.data, self.fake = store, Path(data), fake
        self.threads, self.lock, self.pkg_lock = {}, threading.Lock(), threading.Lock()
        self.last_sweep, self.stop = 0.0, threading.Event()
        (self.data / "jobs").mkdir(parents=True, exist_ok=True)

    # ── keys and storage ──────────────────────────────────────────────────

    @property
    def keys_file(self) -> Path:
        return self.data / "keys.env"

    def keys(self) -> dict:
        out = {}
        if self.keys_file.exists():
            for line in self.keys_file.read_text(encoding="utf-8").splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.split("=", 1)
                    out[k.strip()] = v.strip()
        return out

    def save_keys(self, changes: dict) -> None:
        known = {k for k, *_ in KEYS}
        keys = self.keys()
        for k, v in changes.items():
            if k in known and v is not None:
                v = str(v).strip()
                if "\n" in v or "\r" in v:
                    raise ValueError(f"{k}: one line only")
                if v:
                    keys[k] = v
                else:
                    keys.pop(k, None)
        tmp = self.keys_file.with_suffix(".tmp")
        tmp.write_text("".join(f"{k}={v}\n" for k, v in keys.items()), encoding="utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(self.keys_file)

    def missing_keys(self) -> list:
        if self.fake:
            return []
        keys = self.keys()
        return [label for k, label, need, _ in KEYS if need and not keys.get(k)]

    def bucket(self):
        if self.fake:
            return LocalBucket(self.data / "bucket")
        k = self.keys()
        return Bucket(k.get("FARM_BUCKET_ENDPOINT", ""), k.get("FARM_BUCKET") or "videos",
                      k.get("FARM_BUCKET_KEY_ID", ""), k.get("FARM_BUCKET_SECRET", ""))

    def video_links(self, job: dict) -> dict:
        """Links to watch and to download a finished film, straight from storage (they work for 6 hours)."""
        if not job.get("video_key"):
            return {}
        b, name = self.bucket(), slug(job.get("title")) + ".mp4"
        return {"watch": b.presign(job["video_key"], 6 * 3600, params={"response-content-type": "video/mp4"}),
                "download": b.presign(job["video_key"], 6 * 3600, params={
                    "response-content-type": "video/mp4",
                    "response-content-disposition": f'attachment; filename="{name}"'})}

    # ── the queue ─────────────────────────────────────────────────────────

    def max_parallel(self) -> int:
        try:
            return max(1, min(10, int(self.store.get("max_parallel", 3))))
        except ValueError:
            return 3

    def start(self) -> None:
        threading.Thread(target=self._loop, name="studio", daemon=True).start()

    def _loop(self) -> None:
        while not self.stop.is_set():
            try:
                self.tick()
            except Exception:                        # the queue must never stop: log and carry on
                self._note("studio", traceback.format_exc())
            self.stop.wait(5)

    def _alive(self, jid) -> bool:
        t = self.threads.get(jid)
        return bool(t and t.is_alive())

    def tick(self) -> None:
        with self.lock:
            active = self.store.active()
            for j in active:                         # a film the website lost on a restart: watched again
                if j["status"] in ("starting", "running", "cancelling") and not self._alive(j["id"]):
                    self._spawn(j["id"], self._reattach)
            busy = sum(1 for j in active if self._alive(j["id"]))
            for j in (j for j in active if j["status"] == "queued"):
                if busy >= self.max_parallel():
                    break
                if self._alive(j["id"]):
                    continue
                self.store.update(j["id"], status="starting", stage="Preparing", started=time.time(), error=None)
                self._spawn(j["id"], self._run)
                busy += 1
        if not self.fake and time.time() - self.last_sweep > 900:
            self.last_sweep = time.time()
            try:
                self.sweep()
            except Exception:
                self._note("sweep", traceback.format_exc())

    def _spawn(self, jid, target) -> None:
        t = threading.Thread(target=self._guard, args=(jid, target), name=f"job-{jid}", daemon=True)
        self.threads[jid] = t
        t.start()

    def _guard(self, jid, target) -> None:
        try:
            target(jid)
        except Exception as e:
            self._note(jid, traceback.format_exc())
            j = self.store.job(jid) or {}
            if j.get("pod_id") and not self.fake:
                self._terminate(j["pod_id"])
            self.store.update(jid, status="failed", stage="Stopped", finished=time.time(),
                              error=f"{type(e).__name__}: {str(e)[:300]}")

    def _note(self, who, text) -> None:
        with open(self.data / "studio.log", "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [{who}] {text.rstrip()}\n")

    # ── one film ──────────────────────────────────────────────────────────

    def folder(self, jid) -> Path:
        return self.data / "jobs" / jid

    @staticmethod
    def keys_of(jid: str, title: str = "") -> dict:
        base = f"mrtruth/jobs/{jid}/"
        return {"base": base, "log": base + "log.txt", "done": base + "done.json", "result": base + "result.tgz",
                "video": f"mrtruth/videos/{jid}/{slug(title)}.mp4"}

    def inputs(self, jid) -> dict:
        """The film's own files as uploaded: voice, script and (optionally) music."""
        d = self.folder(jid) / "inputs"
        out = {}
        for p in sorted(d.iterdir()) if d.exists() else []:
            for role in ("voice", "script", "music"):
                if p.stem == role:
                    out[role] = p
        return out

    def _run(self, jid) -> None:
        j = self.store.job(jid)
        if j["run_on"] != "runpod" and not (self.fake and j["run_on"] == "fake"):
            raise RuntimeError(f"'{j['run_on']}' is not ready yet")
        if self.fake:
            return self._fake_run(jid)
        missing = self.missing_keys()
        if missing:
            raise RuntimeError("missing keys in Settings: " + ", ".join(missing))
        keys, b = self.keys(), self.bucket()
        K = self.keys_of(jid, j["title"])
        run = "web-" + jid
        self.store.update(jid, stage="Uploading the code package", progress=1, run=run)
        pkg_key, commit = self.package(b)
        self.store.update(jid, stage="Uploading your files", progress=2, commit_id=commit[:12])
        ins = self.inputs(jid)
        if "voice" not in ins or "script" not in ins:
            raise RuntimeError("the voiceover or the script is missing from the upload")
        names = {}
        for role, p in ins.items():
            names[role] = f"{role}{p.suffix.lower()}"
            k = K["base"] + "inputs/" + names[role]
            if not b.exists(k):
                b.put_file(k, p)
        max_min = max(150, 60 + 6 * int(j["minutes"] or 10))
        ttl = (max_min + 90) * 60
        env = {"PKG_URL": b.presign(pkg_key, ttl), "LOG_PUT": b.presign(K["log"], ttl, "PUT"),
               "RES_PUT": b.presign(K["result"], ttl, "PUT"), "VID_PUT": b.presign(K["video"], ttl, "PUT"),
               "DONE_PUT": b.presign(K["done"], ttl, "PUT"), "MAX_MIN": str(max_min),
               "JT": j["title"], "JM": str(j["minutes"] or 10),
               "VOICE_URL": b.presign(K["base"] + "inputs/" + names["voice"], ttl), "VOICE_NAME": names["voice"],
               "SCRIPT_URL": b.presign(K["base"] + "inputs/" + names["script"], ttl)}
        if "music" in ins:
            env.update(MUSIC_URL=b.presign(K["base"] + "inputs/" + names["music"], ttl), MUSIC_NAME=names["music"],
                       MUSIC_DB=str(j["music_db"] if j["music_db"] is not None else -18))
        for k in POD_KEYS:
            env["K_" + k] = keys.get(k, "")
        self.store.update(jid, stage="Loading the saved picture checks", progress=3)
        vk = {}
        venv = VS.env_for(b, run, str(CODE), vk, log=lambda s: self._note(jid, s))
        venv.pop("_mine", None)
        env.update(venv)
        with open(self.folder(jid) / "keys_to_delete.json", "w") as f:
            json.dump(list(vk.values()), f)
        if self.store.job(jid)["status"] == "cancelling":
            return self._cancelled(jid)
        self.store.update(jid, stage="Renting a machine", progress=4)
        pod, desc = self._rent(keys["RUNPOD_API_KEY"], POD_PREFIX + jid, env)
        if not pod:
            raise RuntimeError("RunPod has no machine free right now - press Try again in a few minutes")
        self.store.update(jid, status="running", pod_id=pod["id"], pod_hr=float(pod.get("costPerHr") or 0),
                          pod_desc=desc, pod_started=time.time(), stage="Machine starting", progress=5)
        self._watch(jid)

    def _rent(self, api_key, name, env):
        body = {"name": name, "imageName": "node:22-bookworm", "gpuCount": 1, "minRAMPerGPU": 32,
                "containerDiskInGb": 60, "volumeInGb": 0, "dockerEntrypoint": ["bash", "-c"],
                "dockerStartCmd": [POD_SCRIPT], "ports": []}
        for vcpu in (64, 48, 32, 24):
            for cloud in ("COMMUNITY", "SECURE"):
                for gpu in GPUS:
                    body.update(gpuTypeIds=[gpu], cloudType=cloud, minVCPUPerGPU=vcpu, env=dict(env, VCPU=str(vcpu)))
                    r = requests.post(f"{REST}/pods", json=body, timeout=60,
                                      headers={"Authorization": "Bearer " + api_key})
                    if r.ok:
                        return r.json(), f"{gpu.replace('NVIDIA ', '')}, {cloud.lower()}, {vcpu}+ CPUs"
        return None, ""

    def _reattach(self, jid) -> None:
        j = self.store.job(jid)
        if j["status"] == "cancelling" and not j.get("pod_id"):
            return self._cancelled(jid)
        if self.fake:
            return self._fake_run(jid)
        if not j.get("pod_id"):
            # lost between "starting" and a pod: anything it rented is switched off by the sweep
            self.store.update(jid, status="failed", stage="Stopped", finished=time.time(),
                              error="the website restarted while this film was starting - press Try again")
            self.last_sweep = 0
            return
        if j["status"] == "starting":
            self.store.update(jid, status="running")
        self._watch(jid)

    def _watch(self, jid) -> None:
        j = self.store.job(jid)
        b, K = self.bucket(), self.keys_of(jid, j["title"])
        rp = RunPod(self.keys().get("RUNPOD_API_KEY", ""))
        max_min = max(150, 60 + 6 * int(j["minutes"] or 10))
        deadline = (j["pod_started"] or time.time()) + (max_min + 15) * 60
        seen, last_pod_check = {}, time.time()
        while time.time() < deadline:
            j = self.store.job(jid)
            if j["status"] == "cancelling":
                return self._cancelled(jid)
            if b.exists(K["done"]):
                break
            try:
                log = b.get_bytes(K["log"]).decode("utf-8", "replace").splitlines()
            except S3Error:
                log = []
            if log:
                self._progress(jid, j, log, seen)
            if time.time() - last_pod_check > 300:     # a pod RunPod took back never writes done.json
                last_pod_check = time.time()
                if not self._pod_exists(j["pod_id"]):
                    raise RuntimeError("the machine stopped unexpectedly (RunPod took it back) - press Try again")
            self.stop.wait(20)
        else:
            raise RuntimeError("the film took longer than its time limit; the machine was switched off")
        self._finish(jid, b, K, rp)

    def _progress(self, jid, j, log, seen) -> None:
        text = "\n".join(log)
        now = time.time()
        stage, lo, hi, marker = "Machine started", 5, 7, ""
        for m, st, a, z in STAGES:
            if m in text:
                stage, lo, hi, marker = st, a, z, m
                break
        seen.setdefault(marker, now)
        mins = int(j["minutes"] or 10)
        expect = {"PLAN start": PLAN_S_MIN * mins, "RENDER start": DRAW_S_MIN * mins}.get(marker, 0)
        frac = min(0.97, (now - seen[marker]) / expect) if expect else 0.0
        progress = round(lo + (hi - lo) * frac, 1)
        left = self._left(marker, frac, mins)
        self.store.update(jid, stage=stage, progress=max(progress, float(j["progress"] or 0)),
                          log_tail="\n".join(log[-80:]), error=None,
                          cost=json.dumps(dict(json.loads(j["cost"] or "{}"), left_min=left,
                                               pod=round((j["pod_hr"] or 0) * (now - (j["pod_started"] or now)) / 3600, 2))))

    @staticmethod
    def _left(marker, frac, mins) -> int:
        plan, draw = PLAN_S_MIN * mins, DRAW_S_MIN * mins
        if marker == "PLAN start":
            s = plan * (1 - frac) + draw + FINISH_S
        elif marker in ("PLAN exit",):
            s = draw + FINISH_S
        elif marker == "RENDER start":
            s = draw * (1 - frac) + FINISH_S
        elif marker in ("RENDER exit", "FINISH exit", "video uploaded"):
            s = FINISH_S / 2
        else:
            s = SETUP_S * 0.7 + plan + draw + FINISH_S
        return max(1, math.ceil(s / 60))

    def _pod_exists(self, pod_id) -> bool:
        try:
            r = requests.get(f"{REST}/pods/{pod_id}", timeout=30,
                             headers={"Authorization": "Bearer " + self.keys().get("RUNPOD_API_KEY", "")})
            return r.status_code != 404
        except requests.RequestException:
            return True                              # unknown: keep watching

    def _finish(self, jid, b, K, rp) -> None:
        j = self.store.job(jid)
        d = self.folder(jid)
        done = {}
        try:
            done = json.loads(b.get_bytes(K["done"]).decode() or "{}")
        except (S3Error, ValueError):
            pass
        for k, name in (("result", "result.tgz"), ("log", "pod_log.txt")):
            try:
                if b.exists(K[k]):
                    b.get_file(K[k], d / name)
            except S3Error:
                pass
        ok = self._terminate(j["pod_id"])
        now = time.time()
        cost = self.costs(d / "result.tgz")
        cost["pod"] = round((j["pod_hr"] or 0) * (now - (j["pod_started"] or now)) / 3600, 2)
        cost["total"] = round(sum(v for k, v in cost.items() if k in ("pod", "gemini", "claude", "ai_pictures")), 2)
        tail = (d / "pod_log.txt").read_text("utf-8", "replace").splitlines()[-80:] if (d / "pod_log.txt").exists() else []
        fields = dict(finished=now, cost=json.dumps(cost), log_tail="\n".join(tail) or j["log_tail"])
        if not ok:
            fields["error"] = "the machine did not confirm it was switched off - check runpod.io"
        if done.get("ok") and b.exists(K["video"]):
            size = next((o["size"] for o in b.list(K["video"]) if o["key"] == K["video"]), 0)
            self.store.update(jid, status="done", stage="Finished", progress=100, video_key=K["video"],
                              video_mb=round(size / 1e6, 1), **fields)
        else:
            why = done.get("why") or self._why(tail)
            self.store.update(jid, status="failed", stage="Stopped", error=f"the film did not finish: {why}"[:400],
                              **fields)
        self._cleanup(jid, b)

    @staticmethod
    def _why(tail) -> str:
        for line in reversed(tail):
            if any(w in line for w in ("Error", "error", "stopped", "exit=1", "exit=2", "Traceback")):
                return line[9:200].strip()
        return "see the machine's log"

    @staticmethod
    def costs(result_tgz: Path) -> dict:
        """What the film cost, read from its own logs (plan.log: the Claude and Gemini lines; the AI pictures made)."""
        out = {}
        try:
            with tarfile.open(result_tgz) as t:
                m = t.extractfile("plan.log") if "plan.log" in t.getnames() else None
                text = m.read().decode("utf-8", "replace") if m else ""
        except (OSError, tarfile.TarError):
            return out
        c = re.findall(r"Claude this run: Claude: .*?= \$([\d.]+)", text)
        g = re.findall(r"Gemini photo picks: .*?= \$([\d.]+)\)", text)
        a = re.findall(r"from (\d+) drawings", text)
        if c:
            out["claude"] = round(float(c[-1]), 2)
        if g:
            out["gemini"] = round(float(g[-1]), 2)
        if a:
            out["ai_pictures"] = round(int(a[-1]) * 0.005, 2)
        return out

    def _terminate(self, pod_id) -> bool:
        if not pod_id:
            return True
        return RunPod(self.keys().get("RUNPOD_API_KEY", "")).terminate(pod_id)

    def _cancelled(self, jid) -> None:
        j = self.store.job(jid)
        if j.get("pod_id") and not self.fake:
            self._terminate(j["pod_id"])
        now = time.time()
        cost = json.loads(j["cost"] or "{}")
        if j.get("pod_started"):
            cost["pod"] = round((j["pod_hr"] or 0) * (now - j["pod_started"]) / 3600, 2)
        self.store.update(jid, status="cancelled", stage="Cancelled", finished=now, cost=json.dumps(cost))
        if not self.fake:
            self._cleanup(jid, self.bucket())

    def _cleanup(self, jid, b) -> None:
        f = self.folder(jid) / "keys_to_delete.json"
        if f.exists():
            for k in json.loads(f.read_text() or "[]"):
                try:
                    b.delete(k)
                except S3Error:
                    pass
            f.unlink(missing_ok=True)

    def delete_video(self, jid) -> None:
        j = self.store.job(jid)
        if j and j.get("video_key"):
            try:
                self.bucket().delete(j["video_key"])
            except S3Error:
                pass

    # ── the code the pods run ─────────────────────────────────────────────

    def package(self, b):
        """The code package for this website's version (git archive of the checked-out commit, the parts Mr Truth
        does not use left out, testin/ added), built and uploaded once per commit."""
        commit = subprocess.run(["git", "-C", str(CODE), "rev-parse", "HEAD"], capture_output=True, text=True,
                                check=True).stdout.strip()
        key = f"mrtruth/pkg/{commit[:12]}.tgz"
        with self.pkg_lock:
            if b.exists(key):
                return key, commit
            out = self.data / "pkg" / f"{commit[:12]}.tgz"
            out.parent.mkdir(parents=True, exist_ok=True)
            if not out.exists():
                with tempfile.TemporaryDirectory(dir=self.data) as tmp:
                    d = Path(tmp) / "p"
                    d.mkdir()
                    arch = subprocess.run(["git", "-C", str(CODE), "archive", "--format=tar", commit],
                                          capture_output=True, check=True).stdout
                    subprocess.run(["tar", "-x", "-C", str(d)], input=arch, check=True)
                    for x in ("legends_renderer", "war_chess_renderer", "assets/avatars", "assets/cutouts",
                              "assets/overlay_vhs.mp4", "web/static"):
                        p = d / x
                        shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)
                    (d / "testin").mkdir(exist_ok=True)
                    for f in ("constraints.txt", "summarize.py"):
                        shutil.copyfile(CODE / "web" / "pod" / f, d / "testin" / f)
                    bad = [p for p in d.rglob("*") if p.name in (".env", "keys.env", "cloud.env")
                           or p.suffix in (".sqlite", ".key")]
                    if bad:
                        raise RuntimeError(f"refused to package: {bad[0].name} is in the code")
                    tgz = Path(tmp) / "pkg.tgz"
                    subprocess.run(["tar", "czf", str(tgz), "-C", str(d), "."], check=True)
                    shutil.move(str(tgz), out)
            b.put_file(key, out)
        return key, commit

    def sweep(self) -> list:
        """Switch off any pod of this website that no film in progress owns (a website restart mid-rent, a crash)."""
        api = self.keys().get("RUNPOD_API_KEY", "")
        if not api:
            return []
        r = requests.get(f"{REST}/pods", timeout=60, headers={"Authorization": "Bearer " + api})
        if not r.ok:
            return []
        pods = r.json() if isinstance(r.json(), list) else r.json().get("pods", [])
        owned = {j["pod_id"] for j in self.store.active() if j.get("pod_id")}
        gone = []
        for p in pods:
            if str(p.get("name", "")).startswith(POD_PREFIX) and p.get("id") not in owned:
                if self._terminate(p["id"]):
                    gone.append(p["id"])
                    self._note("sweep", f"switched off {p['id']} ({p.get('name')}): no film owns it")
        return gone

    # ── a no-cost trial run (MRTRUTH_WEB_FAKE=1) ──────────────────────────

    def _fake_run(self, jid) -> None:
        """Walks through the real stages in about a minute and makes a short test video from the voiceover."""
        j = self.store.job(jid)
        b, K = self.bucket(), self.keys_of(jid, j["title"])
        speed = float(os.environ.get("MRTRUTH_WEB_FAKE_STEP", "2"))
        self.store.update(jid, status="running", pod_id="fake", pod_hr=0.89, pod_desc="test run, no machine",
                          pod_started=time.time())
        log = []
        for marker, stage, lo, hi in reversed(STAGES):
            if self.store.job(jid)["status"] == "cancelling":
                return self._cancelled(jid)
            log.append(time.strftime("%H:%M:%S") + " " + (marker.strip() + " (test)"))
            self.store.update(jid, stage=stage, progress=lo, log_tail="\n".join(log),
                              cost=json.dumps({"left_min": max(1, (10 - len(log)))}))
            self.stop.wait(speed)
        ins = self.inputs(jid)
        out = self.folder(jid) / "test.mp4"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0x1d2433:s=640x360:d=8",
                        "-i", str(ins["voice"]), "-t", "8", "-vf",
                        "drawtext=text='Test run - no machine was rented':fontcolor=white:fontsize=26:x=(w-tw)/2:y=(h-th)/2",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out)], check=True)
        b.put_file(K["video"], out)
        self.store.update(jid, status="done", stage="Finished", progress=100, video_key=K["video"],
                          video_mb=round(out.stat().st_size / 1e6, 1), finished=time.time(),
                          cost=json.dumps({"pod": 0, "gemini": 0, "claude": 0, "ai_pictures": 0, "total": 0}))


# The pod's own script (bash, given to it as its start command): the same steps every pod render so far ran
# (scratchpad fullrun.py), with the film's own files fetched from R2 and the owner's music handed to the finish.
POD_SCRIPT = r'''
set -u
cd /root
say(){ echo "$(date +%T) $*" | tee -a /root/log.txt; }
''' + VS.VERDICT_SH + r'''
fail(){ say "STOPPED: $*"; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT"; echo "{\"ok\":false,\"why\":\"$*\"}" | curl -s -X PUT --data-binary @- "$DONE_PUT"; sleep 3600; exit 1; }
( n=0; while true; do sleep 45; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT" >/dev/null; n=$((n+1)); [ $((n % 13)) -eq 0 ] && push_verdicts "every 10 min"; done ) &
( sleep $((MAX_MIN*60)); say "watchdog: time limit"; push_verdicts watchdog; cd /root/mf; tar czf /root/res.tgz plan.log render.log finish.log 2>/dev/null; curl -s -m 120 -X PUT --data-binary @/root/res.tgz "$RES_PUT"; echo '{"ok":false,"why":"time limit"}' | curl -s -X PUT --data-binary @- "$DONE_PUT"; kill -TERM 1 ) &
Q=$(cat /sys/fs/cgroup/cpu.max 2>/dev/null | awk '$1!="max"{printf "%d", $1/$2}'); CPUS=${Q:-$VCPU}; [ "$CPUS" -gt "$VCPU" ] && CPUS=$VCPU; [ "$CPUS" -lt 1 ] && CPUS=$VCPU
say "ip $(curl -s -m 10 https://api.ipify.org) nproc=$(nproc) cpus=$CPUS mem=$(free -g | awk '/Mem/{print $2}')GB node=$(node --version)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq --no-install-recommends python3 python3-venv python3-pip ffmpeg libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation ca-certificates >>/root/log.txt 2>&1 && say "apt ok ($(python3 --version))"
mkdir -p mf && cd mf && curl -sf -m 600 "$PKG_URL" | tar xz && say "unpacked" || fail "the code package did not download"
mkdir -p testin/job
curl -sf -m 600 "$VOICE_URL" -o "testin/job/$VOICE_NAME" && curl -sf -m 120 "$SCRIPT_URL" -o testin/job/script.txt || fail "your voiceover or script did not download"
JS=testin/job/script.txt; JV="testin/job/$VOICE_NAME"
if [ -n "${MUSIC_URL:-}" ]; then
  curl -sf -m 600 "$MUSIC_URL" -o "testin/job/$MUSIC_NAME" || fail "your music did not download"
  export MRTRUTH_MUSIC="/root/mf/testin/job/$MUSIC_NAME" MRTRUTH_MUSIC_DB="${MUSIC_DB:--18}"
  say "music: $MUSIC_NAME at $MRTRUTH_MUSIC_DB LU under the narration"
fi
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt -c testin/constraints.txt >>/root/log.txt 2>&1 || .venv/bin/pip install -q -r requirements.txt "av==15.1.0" >>/root/log.txt 2>&1
say "pip done: $(.venv/bin/python -c 'import faster_whisper, av, numpy; print("ok", av.__version__)' 2>&1)"
{ echo "GEMINI_API_KEY=$K_GEMINI_API_KEY"; echo "BRAVE_SEARCH_API_KEY=$K_BRAVE_SEARCH_API_KEY"; echo "WAVESPEED_API_KEY=$K_WAVESPEED_API_KEY";
  echo "EUROPEANA_API_KEY=$K_EUROPEANA_API_KEY"; echo "ANTHROPIC_API_KEY=$K_ANTHROPIC_API_KEY";
  echo "CLAUDE_PROVIDER=anthropic"; echo "SCRIPT_PROVIDER=anthropic"; } > .env; chmod 600 .env
seed_verdicts
say "PLAN start"; T0=$(date +%s)
MRTRUTH_SHOT_WORKERS=30 PYTHONUNBUFFERED=1 .venv/bin/python run_test.py "$JS" "$JV" "$JT" "$JM" --export > plan.log 2>&1; RC=$?
T1=$(date +%s); say "PLAN exit=$RC seconds=$((T1-T0)) $(grep -o 'pictures in .*' plan.log | tail -1 | cut -c1-200)"
[ "$RC" -ne 0 ] && say "planning error: $(grep -E 'Error|stopped|STOP' plan.log | tail -1 | cut -c1-300)"
push_verdicts "after planning"
PK=$(ls output/*/_work/*/mrtruth/render_package.tgz 2>/dev/null | head -1)
if [ -n "$PK" ]; then
  mkdir -p /root/rr && tar xzf "$PK" -C /root/rr && say "RENDER start: $(python3 -c "import json;print(len(json.load(open('/root/rr/manifest.json'))['tasks']))") shots, workers $((CPUS/4))"
  (cd /root/rr && python3 remote_render.py --out /root/segments.tgz --workers $((CPUS/4 > 0 ? CPUS/4 : 1)) > /root/mf/render.log 2>&1); RR=$?
  T2=$(date +%s); say "RENDER exit=$RR seconds=$((T2-T1))"
  if [ -f /root/segments.tgz ]; then
    PYTHONUNBUFFERED=1 .venv/bin/python run_test.py "$JS" "$JV" "$JT" "$JM" --segments /root/segments.tgz > finish.log 2>&1; RF=$?
    T3=$(date +%s); say "FINISH exit=$RF seconds=$((T3-T2)) $(grep -o 'music: .*' finish.log | tail -1 | cut -c1-200)"; push_verdicts "after the finish"
    V=$(grep -o "FINAL .*" finish.log | tail -1 | cut -d" " -f2-)
    [ -n "$V" ] && [ -f "$V" ] && curl -sf -m 1800 -X PUT -H "Content-Type: video/mp4" --data-binary @"$V" "$VID_PUT" && say "video uploaded $(du -h "$V" | cut -f1)"
  fi
fi
W=$(ls -d output/*/_work/* 2>/dev/null | head -1)
.venv/bin/python testin/summarize.py $W/mrtruth plan.log summary.json >/dev/null 2>&1
tar czf /root/res.tgz plan.log render.log finish.log summary.json $(find $W/mrtruth -maxdepth 1 -name "*.json") 2>/dev/null
curl -s -m 300 -X PUT --data-binary @/root/res.tgz "$RES_PUT"
push_verdicts "at the end"
curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT"
echo "{\"ok\":$(grep -q 'video uploaded' /root/log.txt && echo true || echo false),\"plan_s\":$((T1-T0))}" | curl -s -X PUT --data-binary @- "$DONE_PUT"
rm -f .env; sleep 3600
'''
