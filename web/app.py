"""Mr Truth Studio - the website.

Sign in, drop a voiceover, a script and (if you like) background music, press Create; the film is made on a rented
machine (jobs.py) and appears in the list with a player and a download button. Owners also see Settings: the keys,
the people who can sign in, how many films may run at once, and the tool's own update.

    MRTRUTH_WEB_DATA=/var/lib/mrtruth gunicorn -w 1 --threads 16 -b 127.0.0.1:8080 web.app:app     (install.sh)
    MRTRUTH_WEB_DATA=/tmp/mt MRTRUTH_WEB_FAKE=1 python -m web.app                                     (a no-cost try)

One worker process on purpose: the job runner lives in it (a second would run every film twice)."""
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
from functools import wraps
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_file, session
from werkzeug.middleware.proxy_fix import ProxyFix

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from web import jobs as J  # noqa: E402
from web.store import Store  # noqa: E402

DATA = Path(os.environ.get("MRTRUTH_WEB_DATA") or (Path.home() / "mrtruth-web-data"))
FAKE = os.environ.get("MRTRUTH_WEB_FAKE") == "1"
HERE = Path(__file__).resolve().parent
AUDIO = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus"}
MAX_SCRIPT_CHARS = 400_000

DATA.mkdir(parents=True, exist_ok=True)
store = Store(DATA / "studio.sqlite")
studio = J.Studio(store, DATA, fake=FAKE)
secret_file = DATA / "secret.key"
if not secret_file.exists():
    secret_file.write_text(secrets.token_hex(32))
    os.chmod(secret_file, 0o600)

app = Flask(__name__, static_folder=None)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config.update(SECRET_KEY=secret_file.read_text().strip(), MAX_CONTENT_LENGTH=2 * 1024 ** 3,
                  SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Strict",
                  SESSION_COOKIE_SECURE=os.environ.get("MRTRUTH_WEB_HTTPS") == "1",
                  PERMANENT_SESSION_LIFETIME=30 * 24 * 3600)
FAILS, FAILS_LOCK = {}, threading.Lock()          # sign-in attempts per address: 10 wrong in 15 minutes = a pause


def _started():
    if not getattr(app, "_studio_on", False):
        app._studio_on = True
        studio.start()


# ── access ────────────────────────────────────────────────────────────────

def me():
    name = session.get("user")
    u = store.user(name) if name else None
    if u and session.get("pv") != store.stamp(name):     # password changed or person removed since this sign-in
        return None
    return u


def need(role="member"):
    def wrap(f):
        @wraps(f)
        def inner(*a, **k):
            u = me()
            if not u:
                return jsonify(error="Please sign in."), 401
            if role == "owner" and u["role"] != "owner":
                return jsonify(error="Only an owner can do this."), 403
            return f(*a, **k)
        return inner
    return wrap


@app.before_request
def guard():
    _started()
    if request.path != "/api/jobs":                     # only the film upload may be big
        request.max_content_length = 1024 * 1024
    if request.method in ("POST", "PUT", "DELETE"):       # a form on another site cannot act as you
        origin = request.headers.get("Origin")
        if origin and origin.rstrip("/") != request.host_url.rstrip("/"):
            abort(403)


@app.after_request
def headers(r):
    r.headers.setdefault("X-Content-Type-Options", "nosniff")
    r.headers.setdefault("X-Frame-Options", "DENY")
    r.headers.setdefault("Referrer-Policy", "same-origin")
    if request.path.startswith("/api/"):
        r.headers["Cache-Control"] = "no-store"
    return r


@app.get("/")
def index():
    return send_file(HERE / "static" / "index.html", max_age=0)


@app.post("/api/login")
def login():
    ip = request.remote_addr or "?"
    now = time.time()
    with FAILS_LOCK:
        recent = [t for t in FAILS.get(ip, []) if now - t < 900]
        FAILS[ip] = recent
        if len(recent) >= 10:
            return jsonify(error="Too many wrong tries. Wait 15 minutes."), 429
    d = request.get_json(silent=True) or {}
    u = store.check(d.get("name", ""), d.get("password", ""))
    if not u:
        with FAILS_LOCK:
            FAILS.setdefault(ip, []).append(now)
        return jsonify(error="Wrong name or password."), 401
    session.clear()
    session.permanent = True
    session["user"] = u["name"]
    session["pv"] = store.stamp(u["name"])
    return jsonify(user=u)


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def whoami():
    u = me()
    if not u:
        return jsonify(user=None)
    return jsonify(user={"name": u["name"], "role": u["role"]}, run_on=_run_on(),
                   missing_keys=studio.missing_keys() if u["role"] == "owner" else [],
                   setup_needed=bool(studio.missing_keys()), fake=FAKE)


def _run_on():
    out = [dict(r) for r in J.RUN_ON]
    if FAKE:
        out.insert(0, {"id": "fake", "label": "Test run (no machine, no cost)", "ready": True,
                       "note": "walks through the steps and makes an 8-second test clip"})
    return out


@app.post("/api/password")
@need()
def own_password():
    d = request.get_json(silent=True) or {}
    u = me()
    if not store.check(u["name"], d.get("old", "")):
        return jsonify(error="Your current password is not right."), 400
    try:
        store.set_password(u["name"], d.get("new", ""))
    except ValueError as e:
        return jsonify(error=str(e)), 400
    return jsonify(ok=True)


# ── films ─────────────────────────────────────────────────────────────────

def _view(j: dict) -> dict:
    out = {k: j.get(k) for k in ("id", "user", "title", "status", "stage", "progress", "run_on", "created",
                                 "started", "finished", "seconds", "minutes", "voice_name", "music_name", "music_vol",
                                 "pod_desc", "video_mb", "error", "commit_id", "machines", "retries")}
    ds = json.loads(j.get("drawers") or "[]")
    used = [d for d in ds if d.get("id")]
    if used:                                        # the drawing machines, shown with the planner's
        out["pod_desc"] = f"{j.get('pod_desc') or ''} + {len(used)} drawing ({', '.join(sorted({d['desc'].split(',')[0] for d in used}))})"
    out["cost"] = json.loads(j.get("cost") or "{}")
    if j.get("status") == "done":
        try:
            out["links"] = studio.video_links(j)
        except Exception:
            out["links"] = {}
    return out


@app.get("/api/jobs")
@need()
def list_jobs():
    return jsonify(jobs=[_view(j) for j in store.jobs()], busy=len(store.active()), max_parallel=studio.max_parallel(),
                   money=_money())


def _money() -> list:
    """The machine accounts' balances for the page: [{"name", "balance", "low"}] - low when under $5 or under two
    hours of what it is spending now (RunPod switches every machine off at $0)."""
    out = []
    for src, b in (studio.balances() or {}).items():
        bal, spend = b.get("balance"), b.get("spend_hr") or 0
        if bal is not None:
            out.append({"name": "RunPod" if src == "runpod" else "Vast.ai", "balance": round(bal, 2),
                        "spend_hr": round(spend, 2), "low": bal < max(5.0, 2 * spend)})
    return out


@app.get("/api/jobs/<jid>/log")
@need()
def job_log(jid):
    j = store.job(jid) or abort(404)
    return jsonify(log=j.get("log_tail") or "")


UPLOADS = {"n": 0}
UPLOADS_LOCK = threading.Lock()


@app.post("/api/jobs")
@need()
def create_job():
    with UPLOADS_LOCK:                                  # the Update button waits for uploads in progress
        UPLOADS["n"] += 1
    try:
        return _create_job()
    finally:
        with UPLOADS_LOCK:
            UPLOADS["n"] -= 1


def _create_job():
    u = me()
    f = request.form
    title = re.sub(r"\s+", " ", (f.get("title") or "")).strip()[:150]
    if not title:
        return jsonify(error="Give the film a title."), 400
    run_on = f.get("run_on") or "runpod"
    place = next((r for r in _run_on() if r["id"] == run_on), None)
    if not place or not place["ready"]:
        return jsonify(error="That place to make the film is not ready yet."), 400
    if not FAKE and studio.missing_keys():
        return jsonify(error="The keys are not all set yet (Settings): " + ", ".join(studio.missing_keys())), 400
    voice = request.files.get("voice")
    if not voice or not voice.filename:
        return jsonify(error="Add the voiceover."), 400
    vext = Path(voice.filename).suffix.lower()
    if vext not in AUDIO:
        return jsonify(error=f"The voiceover must be audio ({', '.join(sorted(AUDIO))})."), 400
    script = (f.get("script_text") or "").strip()
    sfile = request.files.get("script")
    if sfile and sfile.filename and script:
        return jsonify(error="Choose either the script file or the pasted text, not both."), 400
    if sfile and sfile.filename:
        if Path(sfile.filename).suffix.lower() not in (".txt", ".md"):
            return jsonify(error="The script must be a .txt file (or paste it into the box)."), 400
        script = sfile.read(MAX_SCRIPT_CHARS * 4).decode("utf-8-sig", "replace").strip()
    if len(script) < 50:
        return jsonify(error="Add the script (a .txt file or paste it)."), 400
    if len(script) > MAX_SCRIPT_CHARS:
        return jsonify(error="That script is too long."), 400
    music = request.files.get("music")
    if music and music.filename and Path(music.filename).suffix.lower() not in AUDIO:
        return jsonify(error="The music must be an audio file."), 400
    try:                                              # percent of the file's own volume (owner: 100 by default)
        vol = max(0, min(100, int(float(f.get("music_volume") or 100))))
    except ValueError:
        return jsonify(error="The music volume is a number from 0 to 100."), 400
    tmp = DATA / "jobs" / ("upload-" + secrets.token_hex(6))
    ins = tmp / "inputs"
    ins.mkdir(parents=True)
    try:
        voice.save(ins / f"voice{vext}")
        secs = J.media_seconds(ins / f"voice{vext}")
        if secs < 10:
            raise ValueError("The voiceover could not be read as audio (or it is under 10 seconds).")
        if secs > 3 * 3600:
            raise ValueError("The voiceover is over 3 hours.")
        (ins / "script.txt").write_text(script + "\n", encoding="utf-8")
        mname = None
        if music and music.filename:
            mext = Path(music.filename).suffix.lower()
            music.save(ins / f"music{mext}")
            if J.media_seconds(ins / f"music{mext}") < 3:
                raise ValueError("The music could not be read as audio.")
            mname = music.filename[:120]
    except ValueError as e:
        shutil.rmtree(tmp, ignore_errors=True)
        return jsonify(error=str(e)), 400
    jid = store.new_job(user=u["name"], title=title, run_on=run_on, seconds=round(secs, 1),
                        minutes=max(1, int(-(-secs // 60))), voice_name=voice.filename[:120], music_name=mname,
                        music_vol=vol if mname else None,
                        script_words=len(script.split()))
    tmp.rename(studio.folder(jid))
    return jsonify(id=jid)


def _own(j):
    u = me()
    return u and (u["role"] == "owner" or u["name"] == j["user"])


@app.post("/api/jobs/<jid>/cancel")
@need()
def cancel_job(jid):
    j = store.job(jid) or abort(404)
    if not _own(j):
        return jsonify(error="Only the person who made it, or an owner, can stop it."), 403
    if j["status"] == "queued":
        store.update(jid, status="cancelled", stage="Cancelled", finished=time.time())
    elif j["status"] in ("starting", "running"):
        store.update(jid, status="cancelling", stage="Stopping the machine")
    return jsonify(ok=True)


@app.post("/api/jobs/<jid>/retry")
@need()
def retry_job(jid):
    j = store.job(jid) or abort(404)
    if not _own(j):
        return jsonify(error="Only the person who made it, or an owner, can try it again."), 403
    if j["status"] not in ("failed", "cancelled"):
        return jsonify(error="Only a stopped film can be tried again."), 400
    if not studio.inputs(jid).get("voice"):
        return jsonify(error="This film's files are gone; make it again."), 400
    store.update(jid, status="queued", stage="Waiting to start", progress=0, error=None, pod_id=None,
                 pod_started=None, finished=None, cost=None, log_tail=None, drawers=None, retries=0)
    return jsonify(ok=True)


@app.post("/api/jobs/<jid>/delete")
@need()
def delete_job(jid):
    j = store.job(jid) or abort(404)
    if not _own(j):
        return jsonify(error="Only the person who made it, or an owner, can delete it."), 403
    if j["status"] in ("queued", "starting", "running", "cancelling"):
        return jsonify(error="Stop it first."), 400
    studio.delete_video(jid)
    store.update(jid, deleted=1)
    shutil.rmtree(studio.folder(jid), ignore_errors=True)
    return jsonify(ok=True)


@app.get("/local/<path:key>")
@need()
def local_file(key):                                  # the no-cost trial's stand-in storage only
    if not FAKE:
        abort(404)
    p = (DATA / "bucket" / key).resolve()
    if (DATA / "bucket").resolve() not in p.parents or not p.is_file():
        abort(404)
    return send_file(p, mimetype="video/mp4", conditional=True,
                     as_attachment=request.args.get("response-content-disposition") is not None)


# ── settings (owners) ─────────────────────────────────────────────────────

@app.get("/api/settings")
@need("owner")
def get_settings():
    keys = studio.keys()
    shown = [{"name": k, "label": label, "needed": need_, "help": help_, "set": bool(keys.get(k)),
              "hint": ("…" + keys[k][-4:]) if keys.get(k) and len(keys[k]) > 8 else ("set" if keys.get(k) else "")}
             for k, label, need_, help_ in J.KEYS]
    return jsonify(keys=shown, max_parallel=studio.max_parallel(), machines=studio.machines(), users=store.users(),
                   version=_version())


@app.post("/api/settings")
@need("owner")
def save_settings():
    d = request.get_json(silent=True) or {}
    try:
        if d.get("keys"):
            studio.save_keys({k: v for k, v in d["keys"].items() if v is not None and str(v).strip() != ""})
        if d.get("clear"):
            studio.save_keys({k: "" for k in d["clear"]})
        if d.get("max_parallel") is not None:
            store.put("max_parallel", max(1, min(10, int(d["max_parallel"]))))
        if d.get("machines") is not None:
            store.put("machines", max(1, min(J.MACHINES_MAX, int(d["machines"]))))
    except (ValueError, TypeError) as e:
        return jsonify(error=str(e)), 400
    return jsonify(ok=True)


@app.post("/api/settings/test")
@need("owner")
def test_keys():
    """A tiny request to each service, so a wrong key shows here and not an hour into a film."""
    import requests
    k, out = studio.keys(), {}

    def run(name, fn):
        try:
            out[name] = fn()
        except Exception as e:                       # any failure is a result to show
            out[name] = f"failed: {type(e).__name__}: {str(e)[:120]}"
    run("R2 storage", lambda: (studio.bucket().put_bytes("mrtruth/web-check.txt", b"ok"),
                               studio.bucket().delete("mrtruth/web-check.txt"), "ok")[-1])

    def runpod():
        r = requests.get(f"{J.REST}/pods", timeout=30, headers={"Authorization": "Bearer " + k.get("RUNPOD_API_KEY", "")})
        if not r.ok:
            return f"failed: HTTP {r.status_code}"
        bal = studio.sources().balances(fresh=True).get("runpod", {}).get("balance")
        return f"ok (balance ${bal:.2f})" if bal is not None else "ok"
    run("RunPod", runpod)

    def vast():
        if not k.get("VAST_API_KEY"):
            return "not set (optional: RunPod only)"
        bal = studio.sources().balances(fresh=True).get("vast", {}).get("balance")
        return f"ok (balance ${bal:.2f})" if bal is not None else "failed: the key was not accepted"
    run("Vast.ai", vast)

    def gemini():
        r = requests.get("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash", timeout=30,
                         headers={"x-goog-api-key": k.get("GEMINI_API_KEY", "")})
        return "ok" if r.ok else f"failed: HTTP {r.status_code}"
    run("Gemini", gemini)

    def claude():
        r = requests.get("https://api.anthropic.com/v1/models?limit=1", timeout=30,
                         headers={"x-api-key": k.get("ANTHROPIC_API_KEY", ""), "anthropic-version": "2023-06-01"})
        return "ok" if r.ok else f"failed: HTTP {r.status_code}"
    run("Claude", claude)

    def wavespeed():
        r = requests.get("https://api.wavespeed.ai/api/v3/balance", timeout=30,
                         headers={"Authorization": "Bearer " + k.get("WAVESPEED_API_KEY", "")})
        if not r.ok:
            return f"failed: HTTP {r.status_code}"
        bal = (r.json().get("data") or {}).get("balance")
        return f"ok (balance ${bal})" if bal is not None else "ok"
    run("WaveSpeed", wavespeed)
    return jsonify(results=out)


@app.post("/api/users")
@need("owner")
def add_user():
    d = request.get_json(silent=True) or {}
    try:
        store.add_user(d.get("name", ""), d.get("password", ""), d.get("role", "member"))
    except ValueError as e:
        return jsonify(error=str(e)), 400
    return jsonify(ok=True)


@app.post("/api/users/<name>/password")
@need("owner")
def reset_password(name):
    d = request.get_json(silent=True) or {}
    try:
        store.set_password(name, d.get("password", ""))
    except ValueError as e:
        return jsonify(error=str(e)), 400
    return jsonify(ok=True)


@app.post("/api/users/<name>/delete")
@need("owner")
def remove_user(name):
    if name == me()["name"]:
        return jsonify(error="You cannot remove yourself."), 400
    try:
        store.delete_user(name)
    except ValueError as e:
        return jsonify(error=str(e)), 400
    return jsonify(ok=True)


def _version() -> dict:
    def git(*a):
        return subprocess.run(["git", "-C", str(J.CODE), *a], capture_output=True, text=True, timeout=60)
    head = git("log", "-1", "--format=%h %cs %s")
    return {"current": head.stdout.strip() if head.returncode == 0 else "unknown"}


@app.post("/api/update")
@need("owner")
def update_tool():
    """Fetch the newest version of the tool (git pull) and restart the website; running films carry on."""
    with studio.lock:                                   # no film may start while the site restarts (a film that
        studio.paused = True                            # is starting goes back in the queue and starts again)
    if UPLOADS["n"]:
        studio.paused = False
        return jsonify(error="A film is being uploaded right now; try again in a minute."), 400
    try:
        p = subprocess.run(["git", "-C", str(J.CODE), "pull", "--ff-only"], capture_output=True, text=True,
                           timeout=300)
    except (OSError, subprocess.SubprocessError) as e:
        studio.paused = False
        return jsonify(error=f"Update failed: {e}"), 500
    if p.returncode != 0:
        studio.paused = False
        return jsonify(error="Update failed: " + (p.stderr or p.stdout)[-300:]), 500
    changed = "Already up to date" not in p.stdout
    if changed:                                     # gunicorn starts a fresh worker with the new code; films carry on
        threading.Timer(1.5, lambda: os._exit(0)).start()
    else:
        studio.paused = False
    return jsonify(ok=True, changed=changed, version=_version())


if os.environ.get("MRTRUTH_WEB_NOSTART") != "1":    # running films are picked up again as soon as the website starts
    _started()

if __name__ == "__main__":
    port = int(os.environ.get("PORT") or 8080)
    print(f"Mr Truth Studio on http://127.0.0.1:{port}/  (data: {DATA}{', TEST MODE' if FAKE else ''})")
    app.run(host="127.0.0.1", port=port, threaded=True, debug=False)
