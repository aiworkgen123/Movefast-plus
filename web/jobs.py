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
# only when RunPod's price list cannot be read: tried in this order (roughly cheapest first)
GPUS = ("NVIDIA GeForce RTX 3090", "NVIDIA RTX A4000", "NVIDIA RTX A4500", "NVIDIA RTX A5000", "NVIDIA A40",
        "NVIDIA RTX A6000", "NVIDIA L4", "NVIDIA L40S", "NVIDIA GeForce RTX 4090", "NVIDIA L40",
        "NVIDIA RTX PRO 4500 Blackwell", "NVIDIA A100-SXM4-40GB")
REST = "https://rest.runpod.io/v1"
GRAPHQL = "https://api.runpod.io/graphql"
# a film on several small machines (owner 2026-10-12: the 48-core machine cost $2.49/h and 64-core ones are rarely
# free, while 16-core ones are plentiful at $0.13-0.30/h): one PLANNER plans the film (mostly waiting on the internet),
# draws its own share and finishes it; MACHINES - 1 DRAWERS each draw one share of the shots. Every machine is the
# cheapest one RunPod has in stock with at least SMALL_VCPU cores (_offers), never dearer than its limit.
MACHINES_DEFAULT, MACHINES_MAX = 3, 5
SMALL_VCPU = 16
PLANNER_MAX_HR = 1.50                          # none free under this: the film waits for Try again (not a $3/h machine)
DRAWER_MAX_HR = 1.00                           # a drawer dearer than this is not rented: the planner draws that share
# where a film can be made (the website's "Run on" list); a place that is not ready is shown but cannot be picked
RUN_ON = [
    {"id": "runpod", "label": "RunPod (cloud machines)", "ready": True,
     "note": "the cheapest machines free right now, a few for each film, switched off when done"},
    {"id": "pc", "label": "My PC", "ready": False, "note": "coming: install the helper app on your PC"},
    {"id": "gpu", "label": "My own GPU machine", "ready": False, "note": "coming: install the helper app there"},
]
# how long each part takes (the 11-minute render full-05f3c0: set-up 230 s, planning 1086 s, drawing 921 s), per
# minute of film - only for the progress bar and "about N min left"
SETUP_S, PLAN_S_MIN, DRAW_S_MIN, FINISH_S = 240, 100, 85, 150
START_LIMIT_S = 20 * 60                       # a pod that has written no log line by then never started: switched off
STAGES = [                                     # the pod's own log lines, latest first: stage, progress from, to
    ("video uploaded", "Saving the video", 98, 99),
    ("FINISH exit", "Saving the video", 96, 98),
    ("RENDER exit", "Finishing: joining the shots, sound and music", 91, 96),
    ("RENDER start", "Drawing the shots", 60, 91),
    ("PACKAGE uploaded", "Drawing the shots", 59, 60),
    ("PLAN exit", "Planning done, starting to draw", 58, 59),
    ("PICTURES done", "Planning: checking the cut", 52, 58),
    ("PLAN start", "Planning: shots, pictures and checks", 15, 52),
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
        self.paused = False                          # the Update button holds the queue while it restarts the site
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
            for j in (j for j in active if j["status"] == "queued" and not self.paused):
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
            if not self.fake:
                self._end_machines(jid)
                if j.get("run"):                     # the render package and drawn shares are not needed any more
                    try:
                        self._drop_parts(self.keys_of(jid, j.get("title"), j["run"]), self.bucket(),
                                         int(j.get("machines") or 1))
                    except Exception:
                        self._note(jid, traceback.format_exc())
            self.store.update(jid, status="failed", stage="Stopped", finished=time.time(),
                              error=f"{type(e).__name__}: {str(e)[:300]}")

    def _note(self, who, text) -> None:
        with open(self.data / "studio.log", "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [{who}] {text.rstrip()}\n")

    # ── one film ──────────────────────────────────────────────────────────

    def folder(self, jid) -> Path:
        return self.data / "jobs" / jid

    @staticmethod
    def keys_of(jid: str, title: str = "", run: str = "") -> dict:
        """The film's R2 keys. Its uploaded files are shared by every attempt; what a pod reports (log, done, result)
        lives under the attempt's own run name, so a Try again never reads an earlier attempt's answer."""
        base = f"mrtruth/jobs/{jid}/"
        out = base + (f"{run}/" if run else "")
        return {"base": base, "log": out + "log.txt", "done": out + "done.json", "result": out + "result.tgz",
                "video": f"mrtruth/videos/{jid}/{slug(title)}.mp4", "rpkg": out + "render_package.tgz",
                "part": lambda k: out + f"parts/seg_{k}.tgz", "skip": lambda k: out + f"parts/skip_{k}",
                "dlog": lambda k: out + f"parts/log_{k}.txt"}

    def machines(self) -> int:
        try:
            return max(1, min(MACHINES_MAX, int(self.store.get("machines", MACHINES_DEFAULT))))
        except ValueError:
            return MACHINES_DEFAULT

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
        run = f"web-{jid}-{int(time.time())}"                  # this attempt (a Try again is a new one)
        K = self.keys_of(jid, j["title"], run)
        for name in ("result.tgz", "pod_log.txt"):              # an earlier attempt's read-back
            (self.folder(jid) / name).unlink(missing_ok=True)
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
        n = self.machines()
        env = {"PKG_URL": b.presign(pkg_key, ttl), "LOG_PUT": b.presign(K["log"], ttl, "PUT"),
               "NPARTS": str(n), "RPKG_PUT": b.presign(K["rpkg"], ttl, "PUT"),
               "RES_PUT": b.presign(K["result"], ttl, "PUT"), "VID_PUT": b.presign(K["video"], ttl, "PUT"),
               "DONE_PUT": b.presign(K["done"], ttl, "PUT"), "MAX_MIN": str(max_min),
               "JT": j["title"], "JM": str(j["minutes"] or 10),
               "VOICE_URL": b.presign(K["base"] + "inputs/" + names["voice"], ttl), "VOICE_NAME": names["voice"],
               "SCRIPT_URL": b.presign(K["base"] + "inputs/" + names["script"], ttl)}
        if "music" in ins:
            vol = j.get("music_vol")
            env.update(MUSIC_URL=b.presign(K["base"] + "inputs/" + names["music"], ttl), MUSIC_NAME=names["music"],
                       MUSIC_VOL=str(int(round(vol if vol is not None else 100))))
        for k in range(2, n + 1):                      # the drawers' shares, and the marks for one that never came
            env[f"PART_GET_{k}"] = b.presign(K["part"](k), ttl)
            env[f"SKIP_GET_{k}"] = b.presign(K["skip"](k), ttl)
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
        self.store.update(jid, stage="Renting a machine", progress=4, machines=n, drawers="[]")
        pod, desc = self._rent(keys["RUNPOD_API_KEY"], POD_PREFIX + jid, env, PLAN_SCRIPT,
                               min_vcpu=SMALL_VCPU if n > 1 else 32, max_hr=PLANNER_MAX_HR, ram=32,
                               stop=lambda: self.store.job(jid)["status"] == "cancelling", fallback=True)
        if not pod:
            if self.store.job(jid)["status"] == "cancelling":
                return self._cancelled(jid)
            raise RuntimeError(f"RunPod has no machine free under ${PLANNER_MAX_HR:.2f}/h right now - "
                               "press Try again in a few minutes")
        # the pod is saved first (so a cancel or a crash from here on switches it off), then the film becomes
        # "running" only if nobody pressed Stop while it was being rented
        self.store.update(jid, pod_id=pod["id"], pod_hr=float(pod.get("costPerHr") or 0), pod_desc=desc,
                          pod_started=time.time())
        if not self.store.update_if(jid, ("starting",), status="running", stage="Machine starting", progress=5):
            return self._cancelled(jid)
        self._watch(jid)

    def _offers(self, api_key, min_vcpu, ram=32) -> list:
        """What RunPod has in stock right now with at least `min_vcpu` cores and `ram` GB: [(dollars an hour, gpu
        type, cloud)], cheapest first (its GraphQL lowestPrice; the GPU itself is not used - Mr Truth draws on the
        processor)."""
        out = []
        for secure in (False, True):
            q = ("query { gpuTypes { id lowestPrice(input:{gpuCount:1, minVcpuCount:%d, minMemoryInGb:%d, "
                 "secureCloud:%s}) { uninterruptablePrice stockStatus } } }"
                 % (int(min_vcpu), int(ram), "true" if secure else "false"))
            r = requests.post(GRAPHQL, params={"api_key": api_key}, json={"query": q}, timeout=60)
            r.raise_for_status()
            for g in (r.json().get("data") or {}).get("gpuTypes") or []:
                lp = g.get("lowestPrice") or {}
                if lp.get("uninterruptablePrice") and lp.get("stockStatus"):
                    out.append((float(lp["uninterruptablePrice"]), g["id"], "SECURE" if secure else "COMMUNITY"))
        return sorted(out)

    def _rent(self, api_key, name, env, script, min_vcpu=SMALL_VCPU, max_hr=None, ram=32, stop=lambda: False,
              fallback=False):
        """One machine: the cheapest in stock with at least `min_vcpu` cores and `ram` GB, never dearer than `max_hr`
        when it is given. If RunPod's price list cannot be read, the fixed list is tried in order when `fallback` is
        set (the planner: its price is then checked once it is made); otherwise nothing is rented (a drawer: the
        planner draws its share)."""
        body = {"name": name, "imageName": "node:22-bookworm", "gpuCount": 1, "minRAMPerGPU": ram,
                "containerDiskInGb": 60, "volumeInGb": 0, "dockerEntrypoint": ["bash", "-c"],
                "dockerStartCmd": [script], "ports": [], "minVCPUPerGPU": min_vcpu,
                "env": dict(env, VCPU=str(min_vcpu))}
        try:
            offers = self._offers(api_key, min_vcpu, ram)
        except (requests.RequestException, ValueError, KeyError, TypeError):
            if not fallback:
                return None, ""
            offers = [(None, g, c) for c in ("COMMUNITY", "SECURE") for g in GPUS]
        # one size is enough: a machine with more cores also matches "at least min_vcpu", so a type that has none
        # free at this size has none at a bigger one either
        for price, gpu, cloud in offers:
            if max_hr is not None and price is not None and price > max_hr:
                break                                        # cheapest first: the rest are dearer still
            if stop():                                       # Stop pressed while renting: rent nothing
                return None, ""
            body.update(gpuTypeIds=[gpu], cloudType=cloud)
            try:
                r = requests.post(f"{REST}/pods", json=body, timeout=60,
                                  headers={"Authorization": "Bearer " + api_key})
                pod = r.json() if r.ok else None
            except requests.ConnectTimeout:
                continue                                     # never reached RunPod: nothing was made
            except (requests.RequestException, ValueError):
                # the answer was lost, not necessarily the pod: one made under this name is ours; if none shows,
                # stop here rather than risk two (whatever was made is switched off with the film, by its name)
                pod = next((p for p in self._pods(api_key) if p.get("name") == name), None)
                if not pod:
                    return None, ""
            if not pod or not pod.get("id"):
                continue
            hr = float(pod.get("costPerHr") or price or 0)
            if max_hr is not None and hr > max_hr:           # dearer than listed: not this one
                self._terminate(pod["id"])
                continue
            return pod, f"{gpu.replace('NVIDIA ', '')}, {cloud.lower()}, {min_vcpu}+ CPUs, ${hr:.2f}/h"
        return None, ""

    @staticmethod
    def _pods(api_key) -> list:
        """Every pod on the RunPod account ([] when the list cannot be read)."""
        try:
            r = requests.get(f"{REST}/pods", timeout=60, headers={"Authorization": "Bearer " + api_key})
            got = r.json() if r.ok else []
        except (requests.RequestException, ValueError):
            return []
        if isinstance(got, dict):
            got = got.get("pods", [])
        return [p for p in got if isinstance(p, dict)] if isinstance(got, list) else []

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
        b, K = self.bucket(), self.keys_of(jid, j["title"], j.get("run") or "")
        rp = RunPod(self.keys().get("RUNPOD_API_KEY", ""))
        max_min = max(150, 60 + 6 * int(j["minutes"] or 10))
        started = j["pod_started"] or time.time()
        deadline = started + (max_min + 15) * 60
        seen, last_pod_check, got_log = {}, time.time(), False
        while True:                                  # done.json first: a film that finished while the website was
            j = self.store.job(jid)                  # down past its time limit is still read back
            if j["status"] == "cancelling":
                return self._cancelled(jid)
            if b.exists(K["done"]):
                break
            if time.time() >= deadline:
                if b.exists(K["video"]):             # the video arrived; done.json did not
                    break
                raise RuntimeError("the film took longer than its time limit; the machine was switched off")
            try:
                log = b.get_bytes(K["log"]).decode("utf-8", "replace").splitlines()
            except S3Error:
                log = []
            if log:
                got_log = True
                self._progress(jid, j, log, seen)
                if int(j.get("machines") or 1) > 1:
                    try:                             # a hiccup here never stops the film: the planner can draw
                        self._drawers(jid, b, K, "\n".join(log))     # every share itself
                    except Exception:
                        self._note(jid, traceback.format_exc())
            elif not got_log and time.time() - started > START_LIMIT_S:
                raise RuntimeError("the machine never started working - press Try again")
            if time.time() - last_pod_check > 300:     # a pod RunPod took back never writes done.json
                last_pod_check = time.time()
                if not self._pod_exists(j["pod_id"]):
                    if b.exists(K["done"]) or b.exists(K["video"]):
                        break
                    raise RuntimeError("the machine stopped unexpectedly (RunPod took it back) - press Try again")
            self.stop.wait(20)
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
                                               pod=self._machine_cost(j, now))))

    @staticmethod
    def _left(marker, frac, mins) -> int:
        plan, draw = PLAN_S_MIN * mins, DRAW_S_MIN * mins
        if marker == "PLAN start":
            s = plan * (1 - frac) + draw + FINISH_S
        elif marker == "PICTURES done":                     # the pictures are about two thirds of the planning
            s = plan * 0.3 + draw + FINISH_S
        elif marker in ("PLAN exit", "PACKAGE uploaded"):
            s = draw + FINISH_S
        elif marker == "RENDER start":
            s = draw * (1 - frac) + FINISH_S
        elif marker in ("RENDER exit", "FINISH exit", "video uploaded"):
            s = FINISH_S / 2
        else:
            s = SETUP_S * 0.7 + plan + draw + FINISH_S
        return max(1, math.ceil(s / 60))

    def _drawers(self, jid, b, K, log: str) -> None:
        """The drawing machines: rented once the planner's pictures are chosen (so they are set up by the time its
        package is ready), then watched - a share that arrived, or that the planner took over, switches its machine
        off; a machine that could not be rented, failed, vanished or never started gets a skip mark, and the planner
        draws that share itself."""
        j = self.store.job(jid)
        n = int(j.get("machines") or 1)
        ds = json.loads(j.get("drawers") or "[]")
        now = time.time()
        want = [k for k in range(2, n + 1) if k not in {d["part"] for d in ds}]
        if "PLAN exit=" in log and "PLAN exit=0 " not in log:
            want = []                                        # planning failed: nothing to draw
        if want and any(m in log for m in ("PART 1 drawn", "RENDER exit", "PACKAGE upload failed")):
            for k in want:                                   # too late for a new machine: the planner draws it now
                ds.append({"part": k, "id": None, "hr": 0, "desc": "none in time", "started": now, "ended": now,
                           "state": "skipped", "why": "no machine in time",
                           "mark": self._skip(b, K, k, "no machine in time")})
            self.store.update(jid, drawers=json.dumps(ds))
        elif want and any(m in log for m in ("PICTURES done", "PLAN exit", "PACKAGE uploaded")):
            api = self.keys().get("RUNPOD_API_KEY", "")
            ttl = (max(150, 60 + 6 * int(j["minutes"] or 10)) + 90) * 60
            made = {p.get("name"): p for p in self._pods(api)}     # a drawer rented just before a restart
            for k in want:
                if self.store.job(jid)["status"] == "cancelling":
                    break
                pod = made.get(f"{POD_PREFIX}{jid}-d{k}")
                if pod:
                    hr = float(pod.get("costPerHr") or 0)
                    ds.append({"part": k, "id": pod["id"], "hr": hr, "desc": f"picked up again, ${hr:.2f}/h",
                               "started": now, "ended": None, "state": "running"})
                    self.store.update(jid, drawers=json.dumps(ds))
                    continue
                env = {"PKG_GET": b.presign(K["rpkg"], ttl), "PART_PUT": b.presign(K["part"](k), ttl, "PUT"),
                       "LOG_PUT": b.presign(K["dlog"](k), ttl, "PUT"), "PART": str(k), "NPARTS": str(n),
                       "MAX_MIN": str(max(90, 30 + 3 * int(j["minutes"] or 10)))}
                pod, desc = self._rent(api, f"{POD_PREFIX}{jid}-d{k}", env, DRAW_SCRIPT, min_vcpu=SMALL_VCPU,
                                       max_hr=DRAWER_MAX_HR, ram=24,
                                       stop=lambda: self.store.job(jid)["status"] == "cancelling")
                if pod:
                    ds.append({"part": k, "id": pod["id"], "hr": float(pod.get("costPerHr") or 0), "desc": desc,
                               "started": time.time(), "ended": None, "state": "running"})
                else:
                    why = "none free under $%.2f/h" % DRAWER_MAX_HR
                    ds.append({"part": k, "id": None, "hr": 0, "desc": "none free", "started": now, "ended": now,
                               "state": "skipped", "why": why, "mark": self._skip(b, K, k, why)})
                self.store.update(jid, drawers=json.dumps(ds))
            return
        changed = False
        for d in ds:
            if d["state"] == "skipped" and d.get("mark") is False and self._skip(b, K, d["part"], d.get("why", "")):
                d["mark"], changed = True, True
            if d["state"] != "running":
                continue
            k, done, why = d["part"], False, ""
            if b.exists(K["part"](k)):
                done, why = True, "done"
            elif f"PART {k} " in log and "here" in log.split(f"PART {k} ", 1)[1].split("\n", 1)[0]:
                done, why = True, "taken over"              # the planner draws it: this machine is no longer needed
            elif "PACKAGE upload failed" in log:
                done, why = True, "taken over"              # no package for it: the planner draws every share
            else:
                dl, missing = "", False
                try:
                    dl = b.get_bytes(K["dlog"](k)).decode("utf-8", "replace")
                    if not d.get("seen"):
                        d["seen"], changed = True, True
                except S3Error as e:
                    missing = "404" in str(e)                # no log yet (any other error: unknown, look again)
                if f"PART {k} failed" in dl or "watchdog" in dl:
                    why = "failed"
                elif missing and not d.get("seen") and now - d["started"] > START_LIMIT_S:
                    why = "never started"
                elif now - d.get("checked", d["started"]) > 300:
                    d["checked"] = now
                    changed = True
                    if not self._pod_exists(d["id"]):
                        why = "vanished"
            if done or why:
                if not done and not self._skip(b, K, k, why):
                    continue                                  # the planner was not told: tried again next time
                if not self._terminate(d["id"]):
                    continue                                  # still on: switched off on the next look
                d.update(state="done" if done else "skipped", ended=time.time(), why=why)
                changed = True
        if changed:
            self.store.update(jid, drawers=json.dumps(ds))

    @staticmethod
    def _skip(b, K, k, why) -> bool:
        """The mark that tells the planner to draw share k itself (it reads the reason into its log). True once
        written."""
        try:
            b.put_bytes(K["skip"](k), why.encode())
            return True
        except S3Error:
            return False

    def _machine_cost(self, j: dict, now: float) -> float:
        """Every machine of the film so far: the planner from its start, each drawer from its start to its end."""
        total = (j.get("pod_hr") or 0) * (now - (j.get("pod_started") or now)) / 3600
        for d in json.loads(j.get("drawers") or "[]"):
            total += (d.get("hr") or 0) * ((d.get("ended") or now) - d["started"]) / 3600
        return round(total, 2)

    def _end_machines(self, jid) -> bool:
        """Switch off every machine of this film: the planner, each drawer still on, and any pod named for the film
        (one rented in the moment before a crash). True when all said yes."""
        j = self.store.job(jid)
        ok = self._terminate(j.get("pod_id")) if j.get("pod_id") else True
        ds = json.loads(j.get("drawers") or "[]")
        for d in ds:
            if d.get("id") and d["state"] == "running":
                ok = self._terminate(d["id"]) and ok
                d.update(state="ended", ended=time.time())
        if ds:
            self.store.update(jid, drawers=json.dumps(ds))
        for p in self._pods(self.keys().get("RUNPOD_API_KEY", "")):
            if str(p.get("name", "")).startswith(POD_PREFIX + jid) and p.get("id"):
                ok = self._terminate(p["id"]) and ok
        return ok

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
        ok = self._end_machines(jid)
        j = self.store.job(jid)
        now = time.time()
        cost = self.costs(d / "result.tgz")
        cost["pod"] = self._machine_cost(j, now)
        cost["total"] = round(sum(v for k, v in cost.items() if k in ("pod", "gemini", "claude", "ai_pictures")), 2)
        tail = (d / "pod_log.txt").read_text("utf-8", "replace").splitlines()[-80:] if (d / "pod_log.txt").exists() else []
        fields = dict(finished=now, cost=json.dumps(cost), log_tail="\n".join(tail) or j["log_tail"])
        if not ok:
            fields["error"] = "the machine did not confirm it was switched off - check runpod.io"
        has_video = False
        for _ in range(3):                           # the video object decides (the pod PUTs it whole or not at all)
            try:
                has_video = b.exists(K["video"])
            except S3Error:
                has_video = False
            if has_video:
                break
            self.stop.wait(5)
        self._drop_parts(K, b, int(j.get("machines") or 1))
        if has_video and (done.get("ok") or not done):
            size = next((o["size"] for o in b.list(K["video"]) if o["key"] == K["video"]), 0)
            self.store.update(jid, status="done", stage="Finished", progress=100, video_key=K["video"],
                              video_mb=round(size / 1e6, 1), **fields)
            shutil.rmtree(d / "inputs", ignore_errors=True)   # the server's disk is small; R2 keeps a copy
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
        a = re.findall(r"AI on screen \d+ of \d+ from (\d+) drawings", text)
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
        if not self.fake:
            self._end_machines(jid)
        j = self.store.job(jid)
        now = time.time()
        cost = json.loads(j["cost"] or "{}")
        if j.get("pod_started"):
            cost["pod"] = self._machine_cost(j, now)
        self.store.update(jid, status="cancelled", stage="Cancelled", finished=now, cost=json.dumps(cost))
        if not self.fake:
            b = self.bucket()
            if j.get("run"):
                self._drop_parts(self.keys_of(jid, j["title"], j["run"]), b, int(j.get("machines") or 1))
            self._cleanup(jid, b)

    @staticmethod
    def _drop_parts(K, b, n) -> None:
        """The render package and the drawn shares in R2 (about 750 MB a 16-minute film): not needed once the
        planner has finished (or the film stopped)."""
        for key in [K["rpkg"]] + [f(k) for k in range(2, max(2, n) + 1) for f in (K["part"], K["skip"])]:
            try:
                b.delete(key)
            except S3Error:
                pass

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
            for p in (self.data / "pkg").glob("*.tgz"):      # R2 keeps it; the server's disk is small
                p.unlink(missing_ok=True)
        return key, commit

    def sweep(self) -> list:
        """Switch off any pod of this website that no film in progress owns (a website restart mid-rent, a crash)."""
        api = self.keys().get("RUNPOD_API_KEY", "")
        if not api:
            return []
        own = {}
        for j in self.store.active():
            if j["status"] == "queued":                  # waiting: nothing of it should be running
                continue
            ds = json.loads(j.get("drawers") or "[]")
            own[POD_PREFIX + j["id"]] = (j.get("pod_id"), {d.get("id") for d in ds if d.get("id")},
                                         {d["part"] for d in ds})
        gone = []
        for p in self._pods(api):
            name = str(p.get("name", ""))
            if name.startswith(POD_PREFIX) and p.get("id") and not self._owned(name, p["id"], own):
                if self._terminate(p["id"]):
                    gone.append(p["id"])
                    self._note("sweep", f"switched off {p['id']} ({p.get('name')}): no film owns it")
        return gone

    @staticmethod
    def _owned(name, pid, own) -> bool:
        """Does a film in progress count on this pod? Its planner (by id once saved, by name while it is being
        rented) or a drawer (by id, or by name while its share has no drawer saved yet). A second pod under the same
        name (a create whose answer was lost, an earlier attempt's) is not."""
        for base, (planner, drawers, parts) in own.items():
            if name == base:
                return not planner or pid == planner
            if name.startswith(base + "-d"):
                k = name[len(base) + 2:]
                return pid in drawers or (k.isdigit() and int(k) not in parts)
        return False

    # ── a no-cost trial run (MRTRUTH_WEB_FAKE=1) ──────────────────────────

    def _fake_run(self, jid) -> None:
        """Walks through the real stages in about a minute and makes a short test video from the voiceover."""
        j = self.store.job(jid)
        b, K = self.bucket(), self.keys_of(jid, j["title"], j.get("run") or "")
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
PLAN_SCRIPT = r'''
set -u
cd /root
say(){ echo "$(date +%T) $*" | tee -a /root/log.txt; }
''' + VS.VERDICT_SH + r'''
fail(){ say "STOPPED: $*"; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT"; echo "{\"ok\":false,\"why\":\"$*\"}" | curl -s -X PUT --data-binary @- "$DONE_PUT"; sleep 3600; exit 1; }
( n=0; while true; do sleep 45; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT" >/dev/null; n=$((n+1)); [ $((n % 13)) -eq 0 ] && push_verdicts "every 10 min"; done ) &
( sleep $((MAX_MIN*60)); say "watchdog: time limit"; push_verdicts watchdog; cd /root/mf; tar czf /root/res.tgz plan.log render.log finish.log 2>/dev/null; curl -s -m 120 -X PUT --data-binary @/root/res.tgz "$RES_PUT"; echo '{"ok":false,"why":"time limit"}' | curl -s -X PUT --data-binary @- "$DONE_PUT"; kill -TERM 1 ) &
Q=$(cat /sys/fs/cgroup/cpu.max 2>/dev/null | awk '$1!="max"{printf "%d", $1/$2}'); CPUS=${Q:-$VCPU}; [ "$CPUS" -gt "$(nproc)" ] && CPUS=$(nproc); [ "$CPUS" -lt 1 ] && CPUS=$VCPU
MEMG=$(awk '$1!="max"{printf "%d", $1/1073741824}' /sys/fs/cgroup/memory.max 2>/dev/null); MEMG=${MEMG:-$(free -g | awk '/Mem/{print $2}')}
workers(){ local w=$((CPUS/4)); [ $((MEMG/3)) -lt "$w" ] && w=$((MEMG/3)); [ "$w" -lt 1 ] && w=1; echo $w; }
say "ip $(curl -s -m 10 https://api.ipify.org) nproc=$(nproc) cpus=$CPUS mem=${MEMG}GB node=$(node --version)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq --no-install-recommends python3 python3-venv python3-pip ffmpeg libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation ca-certificates >>/root/log.txt 2>&1 && say "apt ok ($(python3 --version))"
mkdir -p mf && cd mf && curl -sf -m 600 "$PKG_URL" | tar xz && say "unpacked" || fail "the code package did not download"
mkdir -p testin/job
curl -sf -m 600 "$VOICE_URL" -o "testin/job/$VOICE_NAME" && curl -sf -m 120 "$SCRIPT_URL" -o testin/job/script.txt || fail "your voiceover or script did not download"
JS=testin/job/script.txt; JV="testin/job/$VOICE_NAME"
if [ -n "${MUSIC_URL:-}" ]; then
  curl -sf -m 600 "$MUSIC_URL" -o "testin/job/$MUSIC_NAME" || fail "your music did not download"
  export MRTRUTH_MUSIC="/root/mf/testin/job/$MUSIC_NAME" MRTRUTH_MUSIC_VOLUME="${MUSIC_VOL:-100}"
  say "music: $MUSIC_NAME as uploaded, at $MRTRUTH_MUSIC_VOLUME% volume"
fi
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt -c testin/constraints.txt >>/root/log.txt 2>&1 || .venv/bin/pip install -q -r requirements.txt "av==15.1.0" >>/root/log.txt 2>&1
say "pip done: $(.venv/bin/python -c 'import faster_whisper, av, numpy; print("ok", av.__version__)' 2>&1)"
{ echo "GEMINI_API_KEY=$K_GEMINI_API_KEY"; echo "BRAVE_SEARCH_API_KEY=$K_BRAVE_SEARCH_API_KEY"; echo "WAVESPEED_API_KEY=$K_WAVESPEED_API_KEY";
  echo "EUROPEANA_API_KEY=$K_EUROPEANA_API_KEY"; echo "ANTHROPIC_API_KEY=$K_ANTHROPIC_API_KEY";
  echo "CLAUDE_PROVIDER=anthropic"; echo "SCRIPT_PROVIDER=anthropic"; } > .env; chmod 600 .env
seed_verdicts
say "PLAN start"; T0=$(date +%s)
( while [ ! -f /root/plan.over ]; do sleep 10; if grep -qE '^ *pictures in [0-9]+s \(search rounds' plan.log 2>/dev/null; then say "PICTURES done"; break; fi; done ) &
MRTRUTH_SHOT_WORKERS=30 PYTHONUNBUFFERED=1 .venv/bin/python run_test.py "$JS" "$JV" "$JT" "$JM" --export > plan.log 2>&1; RC=$?; touch /root/plan.over
T1=$(date +%s); say "PLAN exit=$RC seconds=$((T1-T0)) $(grep -o 'pictures in .*' plan.log | tail -1 | cut -c1-200)"
[ "$RC" -ne 0 ] && say "planning error: $(grep -E 'Error|stopped|STOP' plan.log | tail -1 | cut -c1-300)"
push_verdicts "after planning"
PK=$(ls output/*/_work/*/mrtruth/render_package.tgz 2>/dev/null | head -1)
if [ -n "$PK" ]; then
  # the drawing machines take the package from R2; if it cannot be sent, every share is drawn here
  if [ "$NPARTS" -gt 1 ]; then
    if curl -sf -m 1800 --retry 3 --retry-all-errors -X PUT --data-binary @"$PK" "$RPKG_PUT"; then say "PACKAGE uploaded $(du -h "$PK" | cut -f1)"
    else say "PACKAGE upload failed: every share is drawn here"; NOSEND=1; fi
  fi
  WK=$(workers)
  mkdir -p /root/rr && tar xzf "$PK" -C /root/rr && say "RENDER start: $(python3 -c "import json;print(len(json.load(open('/root/rr/manifest.json'))['tasks']))") shots in $NPARTS share(s), workers $WK here"
  draw1(){ (cd /root/rr && python3 remote_render.py --part "$1/$NPARTS" --out "/root/seg_$1.tgz" --workers $WK >> /root/mf/render.log 2>&1); }
  draw(){ draw1 "$1" || { say "share $1: one more try after an error ($(tail -1 /root/mf/render.log | cut -c1-200))"; draw1 "$1"; }; }
  draw 1; RR=$?; T_OWN=$(( $(date +%s) - T1 )); say "PART 1 drawn here exit=$RR seconds=$T_OWN"
  SEGS="--segments /root/seg_1.tgz"
  if [ "$RR" -eq 0 ] && [ "$NPARTS" -gt 1 ]; then
    PENDING=$(seq 2 "$NPARTS"); UNTIL=$(( $(date +%s) + T_OWN / 2 + 900 ))     # the others started a little later
    if [ -n "${NOSEND:-}" ]; then UNTIL=0; for k in $PENDING; do say "PART $k drawing it here (the package was not sent)"; done; fi
    got(){ PG="PART_GET_$1"; curl -sf -m 900 "${!PG}" -o "/root/seg_$1.tgz" && tar tzf "/root/seg_$1.tgz" >/dev/null 2>&1; }
    while [ -n "$PENDING" ] && [ "$RR" -eq 0 ] && [ "$(date +%s)" -lt "$UNTIL" ]; do
      LEFT=""
      for k in $PENDING; do
        SG="SKIP_GET_$k"
        if [ "$RR" -ne 0 ]; then LEFT="$LEFT $k"
        elif got "$k"; then say "PART $k received from its machine"
        elif curl -sf -m 30 -o /dev/null "${!SG}"; then
          say "PART $k drawing it here (its machine: $(curl -sf -m 30 "${!SG}"))"
          S0=$(date +%s); draw "$k" || RR=1; UNTIL=$(( UNTIL + $(date +%s) - S0 ))   # the wait is for the others
        else LEFT="$LEFT $k"; fi
      done
      PENDING=$LEFT; [ -n "$PENDING" ] && sleep 15
    done
    for k in $PENDING; do                           # late: one more look, then drawn here
      [ "$RR" -ne 0 ] && break
      if [ -z "${NOSEND:-}" ] && got "$k"; then say "PART $k received from its machine (just in time)"
      else [ -z "${NOSEND:-}" ] && say "PART $k drawing it here (its machine was late)"; draw "$k" || RR=1; fi
    done
    for k in $(seq 2 "$NPARTS"); do SEGS="$SEGS --segments /root/seg_$k.tgz"; done
  fi
  T2=$(date +%s); say "RENDER exit=$RR seconds=$((T2-T1))"
  if [ "$RR" -eq 0 ]; then
    PYTHONUNBUFFERED=1 .venv/bin/python run_test.py "$JS" "$JV" "$JT" "$JM" $SEGS > finish.log 2>&1; RF=$?
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

POD_SCRIPT = PLAN_SCRIPT                        # the planner's script (the name the first version used)

# A drawing machine's script: no keys at all, only links. It sets up while the planner is still choosing pictures,
# waits for the render package, draws its own share of the shots (remote_render.py --part K/N), sends it back to R2
# and waits to be switched off. A failure is said in its log; the website then marks the share for the planner.
DRAW_SCRIPT = r'''
set -u
cd /root
say(){ echo "$(date +%T) $*" | tee -a /root/log.txt; }
( while true; do sleep 30; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT" >/dev/null; done ) &
( sleep $((MAX_MIN*60)); say "watchdog: time limit"; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT"; kill -TERM 1 ) &
Q=$(cat /sys/fs/cgroup/cpu.max 2>/dev/null | awk '$1!="max"{printf "%d", $1/$2}'); CPUS=${Q:-$VCPU}; [ "$CPUS" -gt "$(nproc)" ] && CPUS=$(nproc); [ "$CPUS" -lt 1 ] && CPUS=$VCPU
MEMG=$(awk '$1!="max"{printf "%d", $1/1073741824}' /sys/fs/cgroup/memory.max 2>/dev/null); MEMG=${MEMG:-$(free -g | awk '/Mem/{print $2}')}
workers(){ local w=$((CPUS/4)); [ $((MEMG/3)) -lt "$w" ] && w=$((MEMG/3)); [ "$w" -lt 1 ] && w=1; echo $w; }
W=$(workers)
say "ip $(curl -s -m 10 https://api.ipify.org) nproc=$(nproc) cpus=$CPUS mem=${MEMG}GB node=$(node --version) share $PART/$NPARTS"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq --no-install-recommends python3 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation ca-certificates >>/root/log.txt 2>&1 && say "apt ok, waiting for the plan"
until curl -sf -m 900 "$PKG_GET" -o /root/pkg.tgz && tar tzf /root/pkg.tgz >/dev/null 2>&1; do sleep 15; done
mkdir -p /root/rr && tar xzf /root/pkg.tgz -C /root/rr && say "DRAW start: share $PART/$NPARTS, workers $W"
T0=$(date +%s)
draw1(){ (cd /root/rr && python3 remote_render.py --part "$PART/$NPARTS" --out /root/seg.tgz --workers $W >> /root/render.log 2>&1); }
draw1; RR=$?
[ "$RR" -ne 0 ] && { say "share $PART: one more try after an error ($(tail -1 /root/render.log | cut -c1-200))"; draw1; RR=$?; }
if [ "$RR" -eq 0 ] && curl -sf -m 1800 --retry 3 --retry-all-errors -X PUT --data-binary @/root/seg.tgz "$PART_PUT"; then
  say "PART $PART uploaded $(du -h /root/seg.tgz | cut -f1) in $(( $(date +%s) - T0 ))s"
else
  say "PART $PART failed (exit $RR): $(tail -2 /root/render.log | tr '\n' ' ' | cut -c1-300)"
fi
curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT"
sleep 3600
'''
