"""Where the films are made: the website's job runner.

The website only takes the files and keeps the records; a film is made elsewhere - today on rented machines (RunPod
and Vast.ai, web/machines.py), later on your own PC or GPU machine too (RUN_ON: each place is one runner). The code
package and the film's three files go to your R2 storage; a planning machine is rented with the keys as private
settings, plans the film, draws its share of the shots (drawing machines draw the rest), finishes it, uploads the video
straight to R2, and every machine is switched off.

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
from web import verdict_sync as VS  # noqa: E402
from web.machines import Sources, REST, GRAPHQL, GPUS, AVOID, VAST_SLOW_HOST_S, avoid  # noqa: E402,F401  (REST: Settings)

# the keys the website keeps (keys.env in its data folder, never in the code): name, label, needed, where to get it
KEYS = [
    ("RUNPOD_API_KEY", "RunPod", True, "runpod.io → Settings → API Keys"),
    ("VAST_API_KEY", "Vast.ai (cheap machines)", False, "cloud.vast.ai → Account → Keys; empty = RunPod only"),
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
POD_PREFIX = "mrtruth-web-"                   # every machine this website rents is named so; the sweep owns only these
# a film on several small machines (owner 2026-10-12: the 48-core machine cost $2.49/h and 64-core ones are rarely
# free, while 16-core ones are plentiful at $0.13-0.30/h): one PLANNER plans the film (mostly waiting on the internet),
# draws its own share and finishes it; MACHINES - 1 DRAWERS each draw one share of the shots. Every machine is the
# cheapest one free with at least SMALL_VCPU cores across RunPod and Vast.ai, RunPod's processor-only machines only when
# nothing cheaper is free (web/machines.py), never dearer than its limit.
MACHINES_DEFAULT, MACHINES_MAX = 3, 5
SMALL_VCPU = 16
PLANNER_MAX_HR = 1.50                          # none free under this: the film waits (never a $3/h machine)
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
START_LIMIT_S = 25 * 60                       # a machine that has written no log line by then never started
# reliability (owner 2026-10-12): a film waits for a machine instead of failing; a planner that dies, freezes or never
# starts is replaced automatically (carrying on from the saved plan when there is one); a frozen drawer is replaced
RENT_WAIT_S, RENT_RETRY_S = 60 * 60, 120       # how long a film waits for a planner, and how often it tries
FROZEN_S = 12 * 60                             # no sign of life (the log is sent every 30-45 s) for this long: frozen
AUTO_RETRIES = 2                               # replacements for a planning machine before the film stops
BEAT_EVERY_S, CHECK_EVERY_S = 120, 300         # how often the log's age and a machine's state are looked at
# the drawing machines are rented while the planner is still choosing pictures (the longest part of planning: about 66-72 s
# a minute of film on the 11- and 16-minute films), timed to be set up (2-4 min) just as the plan is ready
PICTURES_S_MIN, DRAWER_LEAD_S = 60, 240
# a machine that drew its share this many times slower than the film's fastest is slow: its Vast computer is passed over
# for a week (the 5-films test: normal machines within 1.3x of each other, the two on one busy computer 1.8x and 2.8x);
# shares under SLOW_MIN_S are too short to judge
SLOW_RATIO, SLOW_MIN_S = 1.6, 120
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


CLAUDE_DRY = "the Claude (Anthropic) account is out of credit - please top up at console.anthropic.com (Plans & Billing)"


def claude_credit(key: str) -> str:
    """'' when Claude answers (or cannot be asked right now); otherwise why it will not plan: a dry account or a refused
    key. A one-token call (a hundredth of a cent): the list of models answers even when the account has no credit."""
    if not key:
        return ""
    try:
        r = requests.post("https://api.anthropic.com/v1/messages", timeout=30,
                          headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                          json={"model": "claude-haiku-5-5", "max_tokens": 1, "messages": [{"role": "user", "content": "ok"}]})
    except requests.RequestException:
        return ""
    if "credit balance" in r.text.lower():
        return CLAUDE_DRY
    return "the Claude key was refused - check it in Settings" if r.status_code == 401 else ""


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

    def stat(self, key):
        p = self._p(key)
        return p.stat().st_mtime if p.exists() else None

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
        self.renting = set()                         # machine names being rented right now (the sweep leaves them)
        self.money, self.money_at = {}, 0.0          # the sources' balances, read by the queue thread once a minute
        self._src, self._src_keys = None, None
        (self.data / "jobs").mkdir(parents=True, exist_ok=True)

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
        try:                                         # the Vast computers passed over, kept across restarts
            AVOID.update({k: v for k, v in json.loads(self.store.get("vast_avoid", "{}") or "{}").items()
                          if v > time.time()})
        except (ValueError, TypeError, AttributeError):
            pass
        threading.Thread(target=self._loop, name="studio", daemon=True).start()
        if not self.fake:
            threading.Thread(target=self._money_loop, name="balances", daemon=True).start()

    def _money_loop(self) -> None:
        """The RunPod and Vast balances, read once a minute for the page (a slow answer never holds anything up)."""
        while not self.stop.is_set():
            try:
                self.money, self.money_at = self.sources().balances(fresh=True), time.time()
            except Exception:
                self._note("balance", traceback.format_exc())
            self.stop.wait(60)

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
                try:                                 # the machines' start scripts hold the keys; the plan and the
                    b = self.bucket()                # drawn shares stay, so Try again carries on without paying
                    self._unboot(b, jid, j)          # for the planning again
                    self._cleanup(jid, b)
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
        """The film's R2 keys. Its uploaded files are shared by every attempt; what a machine reports (log, done,
        result, shares) lives under the attempt's own run name, so a Try again never reads an earlier attempt's answer
        by mistake. An attempt's checkpoint (the saved plan) and render package let a later attempt carry on."""
        base = f"mrtruth/jobs/{jid}/"
        out = base + (f"{run}/" if run else "")
        return {"base": base, "out": out, "log": out + "log.txt", "done": out + "done.json",
                "result": out + "result.tgz", "video": f"mrtruth/videos/{jid}/{slug(title)}.mp4",
                "rpkg": out + "render_package.tgz", "ckpt": out + "checkpoint.tgz",
                "part": lambda k: out + f"parts/seg_{k}.tgz", "skip": lambda k: out + f"parts/skip_{k}",
                "dlog": lambda k: out + f"parts/log_{k}.txt", "boot": lambda name: out + f"boot/{name}.sh"}

    # ── machines ──────────────────────────────────────────────────────────

    def sources(self) -> Sources:
        """RunPod and Vast.ai, with the website's current keys (one object while the keys stay the same, so the
        balances are read at most once a minute)."""
        keys = self.keys()
        if self._src is None or self._src_keys != keys:
            self._src, self._src_keys = Sources(keys, note=lambda s: self._note("sources", s)), keys
        return self._src

    def balances(self) -> dict:
        """The balances as last read by the queue thread (never a slow call from a page view)."""
        return self.money

    @staticmethod
    def _name(jid, attempt) -> str:
        """The planner's name for this attempt; a drawer adds -d<share> (a replacement -d<share>r<n>)."""
        return f"{POD_PREFIX}{jid}-a{attempt}"

    def _boot(self, b, K, ttl):
        """For Vast: the start script (with its settings and keys) as a private link that works for the film's time
        limit; the object is deleted once the machine has started, and at the film's end in any case."""
        def put(name, text):
            b.put_bytes(K["boot"](name), text.encode("utf-8"))
            return b.presign(K["boot"](name), ttl)
        return put

    def _unboot(self, b, jid, j) -> None:
        for r in json.loads(j.get("runs") or "[]"):
            prefix = self.keys_of(jid, j.get("title"), r["run"])["out"] + "boot/"
            for o in b.list(prefix):
                try:
                    b.delete(o["key"])
                except S3Error:
                    pass

    def _state(self, mid) -> str:
        return self.sources().state(mid) if mid else "gone"

    def _stat(self, b, key):
        """When an object was last written (seconds since 1970), or None if it is not there or cannot be read."""
        try:
            return b.stat(key)
        except S3Error:
            return None

    # ── one film ──────────────────────────────────────────────────────────

    def _plan_run(self, b, jid, title, runs, commit) -> str:
        """The latest earlier attempt, made with this same version of the tool, whose plan was saved (checkpoint and
        render package): a new attempt carries on from it - nothing is planned or paid for again."""
        for r in reversed(runs):
            if r.get("commit") != commit[:12]:
                continue
            P = self.keys_of(jid, title, r.get("plan") or r["run"])
            if b.exists(P["ckpt"]) and b.exists(P["rpkg"]):
                return r.get("plan") or r["run"]
        return ""

    def _earlier_part(self, b, jid, title, runs, plan, k) -> str:
        """Share k drawn by an earlier attempt of the same plan (its R2 key), or ""."""
        for r in reversed(runs):
            if (r.get("plan") or r["run"]) == plan:
                key = self.keys_of(jid, title, r["run"])["part"](k)
                if b.exists(key):
                    return key
        return ""

    def _drop_runs(self, b, jid, j, keep_commit=None) -> None:
        """An attempt's big files in R2 (render package, checkpoint, drawn shares, start scripts: about 750 MB a
        16-minute film): dropped once the film is finished, cancelled or deleted; on a failure only those of other
        versions of the tool (they can never be carried on)."""
        for r in json.loads(j.get("runs") or "[]"):
            if keep_commit and r.get("commit") == keep_commit[:12]:
                continue
            K = self.keys_of(jid, j.get("title"), r["run"])
            keys = [K["rpkg"], K["ckpt"]] + [o["key"] for p in ("parts/", "boot/") for o in b.list(K["out"] + p)]
            for key in keys:
                try:
                    b.delete(key)
                except S3Error:
                    pass

    def forget(self, jid) -> None:
        """A deleted film: its video and every attempt's files in R2."""
        j = self.store.job(jid)
        if not j or self.fake:
            return
        b = self.bucket()
        if j.get("video_key"):
            try:
                b.delete(j["video_key"])
            except S3Error:
                pass
        self._drop_runs(b, jid, j)

    def _lost(self, jid, why) -> None:
        """The planning machine died, froze or never started: switch everything of this attempt off and start again on
        another machine, carrying on from the saved plan when there is one (AUTO_RETRIES times; then the film stops)."""
        j = self.store.job(jid)
        retries = int(j.get("retries") or 0)
        self._note(jid, f"planner {j.get('pod_id')} {why} (retry {retries + 1} of {AUTO_RETRIES})")
        if retries >= AUTO_RETRIES:
            raise RuntimeError(f"the machine {why}, and so did {retries} replacement(s) - press Try again")
        self._end_machines(jid)
        try:
            self._cleanup(jid, self.bucket())
        except S3Error:
            pass
        cost = dict(json.loads(j.get("cost") or "{}"), pod_earlier=self._machine_cost(j, time.time()))
        if not self.store.update_if(jid, ("running", "starting"), status="queued", progress=1, pod_id=None,
                                    pod_started=None, drawers=None, retries=retries + 1, cost=json.dumps(cost),
                                    stage=f"The machine {why} - starting again on another machine "
                                          f"(attempt {retries + 2})"):
            return self._cancelled(jid)

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
        run = f"web-{jid}-{int(time.time())}"                  # this attempt (an automatic or manual retry is a new one)
        K = self.keys_of(jid, j["title"], run)
        for name in ("result.tgz", "pod_log.txt"):              # an earlier attempt's read-back
            (self.folder(jid) / name).unlink(missing_ok=True)
        self.store.update(jid, stage="Uploading the code package", progress=1, run=run)
        pkg_key, commit = self.package(b)
        runs = json.loads(j.get("runs") or "[]")
        self._drop_runs(b, jid, j, keep_commit=commit)          # other versions' files can never be carried on
        runs = [r for r in runs if r.get("commit") == commit[:12]]
        plan = self._plan_run(b, jid, j["title"], runs, commit)
        runs.append({"run": run, "commit": commit[:12], "plan": plan or run})
        attempt = len(runs)
        P = self.keys_of(jid, j["title"], plan or run)
        self.store.update(jid, stage="Uploading your files", progress=2, commit_id=commit[:12], runs=json.dumps(runs))
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
        ttl = (max_min + 90) * 60 + RENT_WAIT_S
        n = self.machines()
        env = {"PKG_URL": b.presign(pkg_key, ttl), "LOG_PUT": b.presign(K["log"], ttl, "PUT"),
               "NPARTS": str(n), "RPKG_PUT": b.presign(K["rpkg"], ttl, "PUT"), "CKPT_PUT": b.presign(K["ckpt"], ttl, "PUT"),
               "PART_PUT_1": b.presign(K["part"](1), ttl, "PUT"),
               "RES_PUT": b.presign(K["result"], ttl, "PUT"), "VID_PUT": b.presign(K["video"], ttl, "PUT"),
               "DONE_PUT": b.presign(K["done"], ttl, "PUT"), "MAX_MIN": str(max_min),
               "JT": j["title"], "JM": str(j["minutes"] or 10),
               "VOICE_URL": b.presign(K["base"] + "inputs/" + names["voice"], ttl), "VOICE_NAME": names["voice"],
               "SCRIPT_URL": b.presign(K["base"] + "inputs/" + names["script"], ttl)}
        if plan:                                       # carry on from the saved plan: nothing is planned again
            env.update(CKPT_GET=b.presign(P["ckpt"], ttl), RPKG_GET=b.presign(P["rpkg"], ttl), RESUMED_FROM=plan)
        if "music" in ins:
            vol = j.get("music_vol")
            env.update(MUSIC_URL=b.presign(K["base"] + "inputs/" + names["music"], ttl), MUSIC_NAME=names["music"],
                       MUSIC_VOL=str(int(round(vol if vol is not None else 100))))
        drawers, now = [], time.time()
        for k in range(1, n + 1):                      # each share: drawn before (same plan), or this attempt's
            had = self._earlier_part(b, jid, j["title"], runs[:-1], plan, k) if plan else ""
            if k == 1:
                env["PART_GET_1"] = b.presign(had, ttl) if had else ""
                continue
            env[f"PART_GET_{k}"] = b.presign(had or K["part"](k), ttl)
            env[f"SKIP_GET_{k}"] = b.presign(K["skip"](k), ttl)
            if had:
                drawers.append({"part": k, "id": None, "hr": 0, "desc": "drawn by an earlier attempt", "started": now,
                                "ended": now, "state": "done", "why": "kept"})
        for k in POD_KEYS:
            env["K_" + k] = keys.get(k, "")
        self.store.update(jid, stage="Loading the saved picture checks", progress=3)
        vk = {}
        venv = VS.env_for(b, run, str(CODE), vk, log=lambda s: self._note(jid, s))
        venv.pop("_mine", None)
        env.update(venv)
        with open(self.folder(jid) / "keys_to_delete.json", "w") as f:
            json.dump(list(vk.values()), f)
        self.store.update(jid, machines=n, drawers=json.dumps(drawers), pod_id=None)
        name = self._name(jid, attempt)
        deadline, tries = time.time() + RENT_WAIT_S, 0
        try:
            while True:                                # wait for a machine rather than fail (owner 2026-10-12)
                if self.store.job(jid)["status"] == "cancelling":
                    return self._cancelled(jid)
                # no machine is rented for a plan Claude cannot make (5 films stopped together when it ran dry)
                dry = "" if plan else claude_credit(keys.get("ANTHROPIC_API_KEY", ""))
                if dry:
                    pod, tried = None, [dry]
                else:
                    if not tries:                      # later tries keep the "Waiting for a machine" message
                        self.store.update(jid, stage="Renting a machine", progress=4)
                    pod, tried = self._rent(jid, K, name, env, PLAN_SCRIPT, min_vcpu=SMALL_VCPU if n > 1 else 32,
                                            ram=32, max_hr=PLANNER_MAX_HR, fallback=True, ttl=ttl)
                tries += 1
                if pod:
                    break
                self._note(jid, f"no planner (try {tries}): " + "; ".join(tried)[:2000])
                if self.store.job(jid)["status"] == "cancelling":
                    return self._cancelled(jid)
                money = [t for t in tried if "balance too low" in t]
                why = dry or (" and ".join(money) + " - please top up" if money else
                              f"no machine free under ${PLANNER_MAX_HR:.2f}/h")
                if time.time() >= deadline:
                    raise RuntimeError(f"{why} for {RENT_WAIT_S // 60} minutes - press Try again later")
                self.store.update(jid, stage=f"Waiting for {'Claude' if dry else 'a machine'}: {why} (tried {tries}x, "
                                             f"trying again every {RENT_RETRY_S // 60} min)", progress=4)
                self.stop.wait(RENT_RETRY_S)
            # the machine is saved first (so a cancel or a crash from here on switches it off), then the film becomes
            # "running" only if nobody pressed Stop while it was being rented
            runs[-1]["host"] = pod.get("host")            # its Vast computer, to judge its speed at the end
            self.store.update(jid, pod_id=pod["id"], pod_hr=float(pod.get("hr") or 0), pod_desc=pod["desc"],
                              pod_started=time.time(), log_tail=None, runs=json.dumps(runs))
        finally:
            self.renting.discard(name)
        if not self.store.update_if(jid, ("starting",), status="running", stage="Machine starting", progress=5):
            return self._cancelled(jid)
        self._watch(jid)

    def _rent(self, jid, K, name, env, script, min_vcpu=SMALL_VCPU, ram=32, max_hr=None, fallback=False, ttl=6 * 3600):
        """One machine for this film, the cheapest good one free now across the sources (see web/machines.py), or one
        already made under this exact name (an answer lost on the way, a website restart). The name stays in
        self.renting until the caller has saved the machine (or given up), so the sweep never switches it off."""
        self.renting.add(name)
        src = self.sources()
        have = next((m for m in src.list() if m["name"] == name and m.get("state") not in ("exited", "terminated")),
                    None)
        if have:
            hr = float(have.get("hr") or 0)
            return {"id": have["id"], "hr": hr, "desc": f"picked up again, ${hr:.2f}/h"}, ["already made"]
        stop = lambda: (self.store.job(jid) or {}).get("status") == "cancelling"
        return src.rent(name, env, script, min_vcpu=min_vcpu, ram=ram, max_hr=max_hr, fallback=fallback, stop=stop,
                        boot=self._boot(self.bucket(), K, ttl))

    def _reattach(self, jid) -> None:
        j = self.store.job(jid)
        if j["status"] == "cancelling" and not j.get("pod_id"):
            return self._cancelled(jid)
        if self.fake:
            return self._fake_run(jid)
        if not j.get("pod_id"):
            # lost between "starting" and a machine: back in the queue (nothing was paid for yet; the sweep switches
            # off anything half-rented, and the next attempt has a new name)
            self.store.update(jid, status="queued", stage="Waiting to start (the website restarted)")
            self.last_sweep = 0
            return
        if j["status"] == "starting":
            self.store.update(jid, status="running")
        self._watch(jid)

    def _watch(self, jid) -> None:
        j = self.store.job(jid)
        b, K = self.bucket(), self.keys_of(jid, j["title"], j.get("run") or "")
        max_min = max(150, 60 + 6 * int(j["minutes"] or 10))
        started = j["pod_started"] or time.time()
        deadline = started + (max_min + 15) * 60
        seen, last_check, last_beat = {}, time.time(), time.time()
        got_log = bool(j.get("log_tail"))            # a film picked up again after a restart had started already
        while True:                                  # done.json first: a film that finished while the website was
            j = self.store.job(jid)                  # down past its time limit is still read back
            if j["status"] == "cancelling":
                return self._cancelled(jid)
            if b.exists(K["done"]):
                break
            if time.time() >= deadline:
                if b.exists(K["video"]):             # the video arrived; done.json did not
                    break
                raise RuntimeError("the film took longer than its time limit; the machines were switched off")
            log, missing = [], False
            try:
                log = b.get_bytes(K["log"]).decode("utf-8", "replace").splitlines()
            except S3Error as e:
                missing = "404" in str(e)            # no log yet (any other error: unknown, look again)
            now = time.time()
            if log:
                if not got_log:                      # started: its start script (with the keys) is not needed
                    try:
                        b.delete(K["boot"](self._name(jid, len(json.loads(j.get("runs") or "[]")))))
                    except S3Error:
                        pass
                got_log = True
                self._progress(jid, j, log, seen)
                if int(j.get("machines") or 1) > 1:
                    try:                             # a hiccup here never stops the film: the planner can draw
                        self._drawers(jid, b, K, "\n".join(log))     # every share itself
                    except Exception:
                        self._note(jid, traceback.format_exc())
            elif missing and not got_log and now - started > START_LIMIT_S:
                return self._lost(jid, "never started")
            if got_log and now - last_beat >= BEAT_EVERY_S:    # the heartbeat: the planner sends its log every 45 s
                last_beat = now
                at = self._stat(b, K["log"])
                if at and now - at > FROZEN_S and not b.exists(K["done"]):
                    return self._lost(jid, f"stopped answering ({int((now - at) // 60)} min without a sign of life)")
            if now - last_check >= CHECK_EVERY_S:    # a machine its source took back never writes done.json
                last_check = now
                if self._state(j["pod_id"]) in ("gone", "stopped"):
                    if b.exists(K["done"]) or b.exists(K["video"]):
                        break
                    return self._lost(jid, "was taken back or switched off")
            self.stop.wait(20)
        self._finish(jid, b, K)

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
        """The drawing machines: wanted once the planner's pictures are chosen, rented (or tried again every
        RENT_RETRY_S while one could still help), then watched. A share that arrived, or that the planner took over,
        switches its machine off; one that failed, froze, vanished or never started gets a replacement while there is
        time, else a skip mark - and the planner draws that share itself."""
        j = self.store.job(jid)
        n = int(j.get("machines") or 1)
        ds = json.loads(j.get("drawers") or "[]")
        runs = json.loads(j.get("runs") or "[]")
        planner = self._name(jid, len(runs))
        P = self.keys_of(jid, j["title"], (runs[-1].get("plan") if runs else "") or j.get("run") or "")
        now, changed = time.time(), False
        failed_plan = "PLAN exit=" in log and "PLAN exit=0 " not in log
        late = any(m in log for m in ("PART 1 drawn", "PART 1 kept", "RENDER exit", "PACKAGE upload failed"))
        ready = any(m in log for m in ("PICTURES done", "PLAN exit", "PACKAGE uploaded"))
        at = self._log_time(log, "PICTURES start")
        if at and now >= at + max(0, PICTURES_S_MIN * int(j["minutes"] or 10) - DRAWER_LEAD_S):
            ready = True
        for k in range(2, n + 1):
            if not any(d["part"] == k for d in ds):
                ds.append({"part": k, "id": None, "hr": 0, "desc": "waiting for the plan", "started": now,
                           "ended": None, "state": "wanted", "tries": 0, "next": 0})
                changed = True
        ttl = (max(150, 60 + 6 * int(j["minutes"] or 10)) + 90) * 60
        for d in ds:
            if d["state"] != "wanted":
                continue
            k = d["part"]
            if failed_plan:
                d.update(state="ended", ended=now, why="planning failed")
            elif late:                               # too late for a new machine: the planner draws it now
                d.update(state="skipped", ended=now, why="no machine in time",
                         mark=self._skip(b, K, k, "no machine in time"))
            elif ready and now >= d.get("next", 0) and self.store.job(jid)["status"] != "cancelling":
                name = f"{planner}-d{k}" + (f"r{d['replaces']}" if d.get("replaces") else "")
                logkey = K["dlog"](f"{k}r{d['replaces']}" if d.get("replaces") else k)
                env = {"PKG_GET": b.presign(P["rpkg"], ttl), "PART_PUT": b.presign(K["part"](k), ttl, "PUT"),
                       "LOG_PUT": b.presign(logkey, ttl, "PUT"), "PART": str(k), "NPARTS": str(n),
                       "MAX_MIN": str(max(90, 30 + 3 * int(j["minutes"] or 10)))}
                try:
                    pod, tried = self._rent(jid, K, name, env, DRAW_SCRIPT, min_vcpu=SMALL_VCPU, ram=24,
                                            max_hr=DRAWER_MAX_HR, ttl=ttl)
                    d["tries"] = d.get("tries", 0) + 1
                    if pod:
                        d.update(state="running", id=pod["id"], hr=float(pod.get("hr") or 0), desc=pod["desc"],
                                 started=time.time(), name=name, log=logkey, host=pod.get("host"))
                    else:
                        d.update(next=now + RENT_RETRY_S, desc=f"none free yet (tried {d['tries']}x)")
                        self._note(jid, f"no drawer for share {k} (try {d['tries']}): " + "; ".join(tried)[:1500])
                    self.store.update(jid, drawers=json.dumps(ds))
                finally:
                    self.renting.discard(name)
            changed = True
        for d in list(ds):
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
                logkey = d.get("log") or K["dlog"](k)
                dl, missing = "", False
                try:
                    dl = b.get_bytes(logkey).decode("utf-8", "replace")
                    if not d.get("seen"):
                        d["seen"], changed = True, True
                        try:                                # started: its start script (with links) is not needed
                            b.delete(K["boot"](d.get("name") or f"{planner}-d{k}"))
                        except S3Error:
                            pass
                except S3Error as e:
                    missing = "404" in str(e)                # no log yet (any other error: unknown, look again)
                at = self._stat(b, logkey) if d.get("seen") else None
                if f"PART {k} failed" in dl or "watchdog" in dl:
                    why = "failed"
                elif missing and not d.get("seen") and now - d["started"] > START_LIMIT_S:
                    why = "never started"
                elif at and now - at > FROZEN_S:
                    why = "froze"
                elif now - d.get("checked", d["started"]) >= CHECK_EVERY_S:
                    d["checked"] = now
                    changed = True
                    if self._state(d["id"]) in ("gone", "stopped"):
                        why = "vanished"
            if not (done or why):
                continue
            if not self._terminate(d["id"]):
                continue                                     # still on: switched off on the next look
            changed = True
            if done:
                d.update(state="done", ended=time.time(), why=why)
            elif not late and not d.get("replaces"):         # a second machine while it can still help
                d.update(state="ended", ended=time.time(), why=why)
                ds.append({"part": k, "id": None, "hr": 0, "desc": f"replacing a machine that {why}", "started": now,
                           "ended": None, "state": "wanted", "tries": 0, "next": 0, "replaces": 1})
            else:
                d.update(state="skipped", ended=time.time(), why=why, mark=self._skip(b, K, k, why))
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

    @staticmethod
    def _log_time(log: str, marker: str):
        """When the machine wrote "HH:MM:SS <marker>" (its clock is UTC), as seconds since 1970; None if not there."""
        m = re.search(r"^(\d\d):(\d\d):(\d\d) " + re.escape(marker), log, re.M)
        if not m:
            return None
        now = time.time()
        day = now - now % 86400
        at = day + int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
        return at - 86400 if at > now + 3600 else at                     # written just before midnight

    def _machine_cost(self, j: dict, now: float) -> float:
        """Every machine of the film so far: earlier attempts, the planner from its start, each drawer from its start
        to its end."""
        total = float(json.loads(j.get("cost") or "{}").get("pod_earlier") or 0)
        total += (j.get("pod_hr") or 0) * (now - (j.get("pod_started") or now)) / 3600
        for d in json.loads(j.get("drawers") or "[]"):
            if d.get("id"):
                total += (d.get("hr") or 0) * ((d.get("ended") or now) - d["started"]) / 3600
        return round(total, 2)

    def _end_machines(self, jid) -> bool:
        """Switch off every machine of this film: the planner, each drawer still on, and any machine named for the
        film (an earlier attempt's, one rented in the moment before a crash). True when all said yes."""
        j = self.store.job(jid)
        ok = self._terminate(j.get("pod_id")) if j.get("pod_id") else True
        ds = json.loads(j.get("drawers") or "[]")
        for d in ds:
            if d.get("id") and d["state"] == "running":
                ok = self._terminate(d["id"]) and ok
                d.update(state="ended", ended=time.time())
        if ds:
            self.store.update(jid, drawers=json.dumps(ds))
        for m in self.sources().list():
            if str(m.get("name", "")).startswith(POD_PREFIX + jid) and m.get("id"):
                ok = self._terminate(m["id"]) and ok
        return ok

    def _finish(self, jid, b, K) -> None:
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
        full = (d / "pod_log.txt").read_text("utf-8", "replace") if (d / "pod_log.txt").exists() else ""
        tail = full.splitlines()[-80:]
        try:
            self._judge_speed(jid, b, j, full)
        except Exception:                            # never in the way of the film
            self._note(jid, traceback.format_exc())
        fields = dict(finished=now, cost=json.dumps(cost), log_tail="\n".join(tail) or j["log_tail"])
        if not ok:
            fields["error"] = "a machine did not confirm it was switched off - check runpod.io / vast.ai"
        has_video = False
        for _ in range(3):                           # the video object decides (the pod PUTs it whole or not at all)
            try:
                has_video = b.exists(K["video"])
            except S3Error:
                has_video = False
            if has_video:
                break
            self.stop.wait(5)
        if has_video and (done.get("ok") or not done):
            self._drop_runs(b, jid, j)
            size = next((o["size"] for o in b.list(K["video"]) if o["key"] == K["video"]), 0)
            self.store.update(jid, status="done", stage="Finished", progress=100, video_key=K["video"],
                              video_mb=round(size / 1e6, 1), **fields)
            shutil.rmtree(d / "inputs", ignore_errors=True)   # the server's disk is small; R2 keeps a copy
        else:                                        # the plan and shares stay: Try again carries on from them
            self._unboot(b, jid, j)
            why = done.get("why") or self._why(tail)
            if "credit balance is too low" in why.lower():  # said plainly (the API's own words are cut short)
                why = CLAUDE_DRY + ", then press Try again"
            self.store.update(jid, status="failed", stage="Stopped", error=f"the film did not finish: {why}"[:400],
                              **fields)
        self._cleanup(jid, b)

    def _judge_speed(self, jid, b, j, log: str) -> None:
        """Each machine's time for its share (the planner's own, each drawer's from its log); a Vast computer that was
        SLOW_RATIO times slower than the film's fastest machine is passed over for a week."""
        runs = json.loads(j.get("runs") or "[]")
        took = []                                    # (seconds, Vast computer, which)
        m = re.search(r"PART 1 drawn here exit=0 seconds=(\d+)", log)
        if m:
            took.append((int(m.group(1)), runs[-1].get("host") if runs else None, "the planning machine"))
        for d in json.loads(j.get("drawers") or "[]"):
            if not d.get("log") or d.get("why") == "kept":
                continue
            try:
                dl = b.get_bytes(d["log"]).decode("utf-8", "replace")
            except S3Error:
                continue
            m = re.search(rf"PART {d['part']} uploaded \S+ in (\d+)s", dl)
            if m:
                took.append((int(m.group(1)), d.get("host"), f"drawing machine {d['part']}"))
        if len(took) < 2:
            return
        fastest = min(t for t, _, _ in took)
        if fastest < SLOW_MIN_S:
            return
        for t, host, which in took:
            if host and t > SLOW_RATIO * fastest:
                avoid(host, VAST_SLOW_HOST_S)
                self._note(jid, f"{which} took {t}s, {t / fastest:.1f}x the fastest ({fastest}s): its Vast computer "
                                f"{host} is passed over for a week")
        self._save_avoid()

    def _save_avoid(self) -> None:
        now = time.time()
        self.store.put("vast_avoid", json.dumps({k: v for k, v in AVOID.items() if v > now}))

    @staticmethod
    def _why(tail) -> str:
        for line in reversed(tail):
            if any(w in line for w in ("Error", "error", "stopped", "exit=1", "exit=2", "Traceback", "upload failed")):
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

    def _terminate(self, mid) -> bool:
        return self.sources().terminate(mid) if mid else True

    def _cancelled(self, jid) -> None:
        if not self.fake:
            self._end_machines(jid)
        j = self.store.job(jid)
        now = time.time()
        cost = json.loads(j["cost"] or "{}")
        if j.get("pod_started") or cost.get("pod_earlier"):
            cost["pod"] = self._machine_cost(j, now)
        self.store.update(jid, status="cancelled", stage="Cancelled", finished=now, cost=json.dumps(cost))
        if not self.fake:
            b = self.bucket()
            self._drop_runs(b, jid, j)
            self._cleanup(jid, b)

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
        self.forget(jid)

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
        """Switch off any machine of this website that no film in progress counts on (a website restart mid-rent, a
        crash, an earlier attempt's machine, a second machine from an answer that was lost)."""
        own = set()
        for j in self.store.active():
            if j["status"] == "queued":                  # waiting: nothing of it should be running
                continue
            own.add(j.get("pod_id"))
            own.update(d.get("id") for d in json.loads(j.get("drawers") or "[]") if d.get("state") == "running")
        own.discard(None)
        gone = []
        for m in self.sources().list():
            name = str(m.get("name", ""))
            if name.startswith(POD_PREFIX) and m.get("id") and not self._owned(name, m["id"], own, self.renting):
                if self._terminate(m["id"]):
                    gone.append(m["id"])
                    self._note("sweep", f"switched off {m['id']} ({name}): no film counts on it")
        self._save_avoid()                               # a broken computer noticed meanwhile is kept too
        return gone

    @staticmethod
    def _owned(name, mid, own, renting) -> bool:
        """Does a film in progress count on this machine? Its saved planner or a drawer still drawing (by id), or one
        being rented right now (by name)."""
        return mid in own or name in renting

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
Q=$(cat /sys/fs/cgroup/cpu.max 2>/dev/null | awk '$1!="max"{x=$1/$2; y=int(x); if (x>y+0.05) y++; printf "%d", y}'); CPUS=${Q:-$VCPU}; [ "$CPUS" -gt "$(nproc)" ] && CPUS=$(nproc); [ "$CPUS" -lt 1 ] && CPUS=$VCPU
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
if [ -n "${CKPT_GET:-}" ]; then
  # another machine planned this film and was lost: carry on from its saved plan (nothing is planned or paid again)
  say "PLAN start (carrying on from the saved plan of ${RESUMED_FROM:-an earlier attempt})"; T0=$(date +%s); RC=1
  if curl -sf -m 900 --retry 5 --retry-all-errors "$CKPT_GET" -o /root/ckpt.tgz && tar xzf /root/ckpt.tgz -C /root/mf; then
    JD=$(ls -d output/*/_work/* 2>/dev/null | head -1)
    [ -n "$JD" ] && curl -sf -m 1800 --retry 5 --retry-all-errors "$RPKG_GET" -o "$JD/mrtruth/render_package.tgz" \
      && tar tzf "$JD/mrtruth/render_package.tgz" >/dev/null 2>&1 && RC=0
  fi
  touch /root/plan.over
  T1=$(date +%s); say "PLAN exit=$RC seconds=$((T1-T0)) resumed"
  [ "$RC" -ne 0 ] && say "planning error: the saved plan could not be loaded"
else
  say "PLAN start"; T0=$(date +%s)
  ( S=""; while [ ! -f /root/plan.over ]; do sleep 10
      if [ -z "$S" ] && grep -qE 'archive names for the picture search|Bing \(free web pictures\)' plan.log 2>/dev/null; then say "PICTURES start"; S=1; fi
      if grep -qE '^ *pictures in [0-9]+s \(search rounds' plan.log 2>/dev/null; then say "PICTURES done"; break; fi
    done ) &
  MRTRUTH_SHOT_WORKERS=30 PYTHONUNBUFFERED=1 .venv/bin/python run_test.py "$JS" "$JV" "$JT" "$JM" --export > plan.log 2>&1; RC=$?; touch /root/plan.over
  T1=$(date +%s); say "PLAN exit=$RC seconds=$((T1-T0)) $(grep -o 'pictures in .*' plan.log | tail -1 | cut -c1-200)"
  [ "$RC" -ne 0 ] && say "planning error: $(grep -iE 'error|stopped' plan.log | tail -1 | cut -c1-300)"
  push_verdicts "after planning"
fi
PK=$(ls output/*/_work/*/mrtruth/render_package.tgz 2>/dev/null | head -1)
if [ -n "$PK" ] && [ "$RC" -eq 0 ]; then
  JD=${PK%/mrtruth/render_package.tgz}
  if [ -z "${CKPT_GET:-}" ]; then
    # the saved plan, so a replacement machine can carry on without planning again (the pictures are in the package)
    tar czf /root/ckpt.tgz --exclude="$JD/mrtruth/pictures" --exclude="$JD/mrtruth/segments" \
      --exclude="$JD/mrtruth/render_package.tgz" "$JD" plan.log 2>/dev/null \
      && curl -sf -m 900 --retry 3 --retry-all-errors -X PUT --data-binary @/root/ckpt.tgz "$CKPT_PUT" \
      && say "CHECKPOINT saved $(du -h /root/ckpt.tgz | cut -f1)"
    # the drawing machines (and a replacement) take the package from R2; if it cannot be sent, every share is drawn here
    if curl -sf -m 1800 --retry 3 --retry-all-errors -X PUT --data-binary @"$PK" "$RPKG_PUT"; then say "PACKAGE uploaded $(du -h "$PK" | cut -f1)"
    elif [ "$NPARTS" -gt 1 ]; then say "PACKAGE upload failed: every share is drawn here"; NOSEND=1; fi
  else
    say "PACKAGE uploaded (kept from ${RESUMED_FROM:-an earlier attempt})"
  fi
  WK=$(workers)
  mkdir -p /root/rr && tar xzf "$PK" -C /root/rr && say "RENDER start: $(python3 -c "import json;print(len(json.load(open('/root/rr/manifest.json'))['tasks']))") shots in $NPARTS share(s), workers $WK here"
  draw1(){ (cd /root/rr && python3 remote_render.py --part "$1/$NPARTS" --out "/root/seg_$1.tgz" --workers $WK >> /root/mf/render.log 2>&1); }
  draw(){ draw1 "$1" || { say "share $1: one more try after an error ($(tail -1 /root/mf/render.log | cut -c1-200))"; draw1 "$1"; }; }
  if [ -n "${PART_GET_1:-}" ] && curl -sf -m 900 "$PART_GET_1" -o /root/seg_1.tgz && tar tzf /root/seg_1.tgz >/dev/null 2>&1; then
    RR=0; T_OWN=$(( $(date +%s) - T1 )); say "PART 1 kept from an earlier attempt"
  else
    draw 1; RR=$?; T_OWN=$(( $(date +%s) - T1 )); say "PART 1 drawn here exit=$RR seconds=$T_OWN"
    # kept in R2 too, so a replacement machine need not draw it again
    [ "$RR" -eq 0 ] && ( curl -sf -m 1800 --retry 3 --retry-all-errors -X PUT --data-binary @/root/seg_1.tgz "$PART_PUT_1" >/dev/null 2>&1 & )
  fi
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
    # tried again on a storage hiccup: one lost here lost a finished film (the 5-films test, 2026-10-12)
    if [ -z "$V" ] || [ ! -f "$V" ]; then say "video upload failed: no finished video (${V:-no FINAL line})"
    elif curl -sf -m 1800 --retry 5 --retry-all-errors -X PUT -H "Content-Type: video/mp4" --data-binary @"$V" "$VID_PUT"; then say "video uploaded $(du -h "$V" | cut -f1)"
    else say "video upload failed (curl exit $?)"; fi
  fi
fi
W=$(ls -d output/*/_work/* 2>/dev/null | head -1)
.venv/bin/python testin/summarize.py $W/mrtruth plan.log summary.json >/dev/null 2>&1
tar czf /root/res.tgz plan.log render.log finish.log summary.json $(find $W/mrtruth -maxdepth 1 -name "*.json") 2>/dev/null
curl -s -m 300 --retry 3 --retry-all-errors -X PUT --data-binary @/root/res.tgz "$RES_PUT"
push_verdicts "at the end"
curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT"
echo "{\"ok\":$(grep -q 'video uploaded' /root/log.txt && echo true || echo false),\"plan_s\":$((T1-T0))}" | curl -s --retry 3 --retry-all-errors -X PUT --data-binary @- "$DONE_PUT"
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
Q=$(cat /sys/fs/cgroup/cpu.max 2>/dev/null | awk '$1!="max"{x=$1/$2; y=int(x); if (x>y+0.05) y++; printf "%d", y}'); CPUS=${Q:-$VCPU}; [ "$CPUS" -gt "$(nproc)" ] && CPUS=$(nproc); [ "$CPUS" -lt 1 ] && CPUS=$VCPU
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
