"""The website (web/): sign-in, a film from upload to finished video in test mode (no machine, no cost), the guards,
the settings, the package and the cost read-back.
    python -m unittest tests/test_web.py"""
import importlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))


def tone(path, seconds=15):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                    f"sine=frequency=300:duration={seconds}", str(path)], check=True)
    return path.read_bytes()


class Web(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = Path(tempfile.mkdtemp())
        os.environ.update(MRTRUTH_WEB_DATA=str(cls.d / "data"), MRTRUTH_WEB_FAKE="1", MRTRUTH_WEB_NOSTART="1",
                          MRTRUTH_WEB_FAKE_STEP="0")
        import web.app as A
        cls.A = importlib.reload(A)
        cls.A.store.add_user("owner1", "a long password", "owner")
        cls.A.store.add_user("maria", "another password", "member")
        cls.voice = tone(cls.d / "v.mp3", 15)
        cls.music = tone(cls.d / "m.mp3", 5)

    @classmethod
    def tearDownClass(cls):
        cls.A.studio.stop.set()
        for t in list(cls.A.studio.threads.values()):        # a film still finishing writes into the folder
            t.join(timeout=60)
        shutil.rmtree(cls.d, ignore_errors=True)

    def client(self, who=None):
        c = self.A.app.test_client()
        if who:
            r = c.post("/api/login", json={"name": who, "password": {"owner1": "a long password",
                                                                     "maria": "another password"}[who]})
            self.assertEqual(r.status_code, 200, r.json)
        return c

    def new(self, c, **over):
        data = {"title": "The Passage", "run_on": "fake", "music_volume": "60",
                "voice": (io.BytesIO(self.voice), "narration.mp3"),
                "script": (io.BytesIO(("word " * 300).encode()), "script.txt"),
                "music": (io.BytesIO(self.music), "song.mp3")}
        data.update(over)
        data = {k: v for k, v in data.items() if v is not None}
        return c.post("/api/jobs", data=data, content_type="multipart/form-data")

    def test_signed_out_sees_nothing(self):
        c = self.client()
        self.assertEqual(c.get("/").status_code, 200)                 # the page itself (it shows the sign-in)
        for path in ("/api/jobs", "/api/settings"):
            self.assertEqual(c.get(path).status_code, 401)
        self.assertEqual(c.post("/api/jobs").status_code, 401)
        self.assertIsNone(c.get("/api/me").json["user"])

    def test_wrong_password_and_lockout(self):
        c = self.client()
        with mock.patch.dict(self.A.FAILS, {}, clear=True):
            for _ in range(10):
                self.assertEqual(c.post("/api/login", json={"name": "maria", "password": "no"}).status_code, 401)
            r = c.post("/api/login", json={"name": "maria", "password": "another password"})
            self.assertEqual(r.status_code, 429)

    def test_member_cannot_open_settings(self):
        c = self.client("maria")
        self.assertEqual(c.get("/api/settings").status_code, 403)
        self.assertEqual(c.post("/api/users", json={"name": "x", "password": "y" * 12}).status_code, 403)
        self.assertEqual(c.post("/api/update", json={}).status_code, 403)

    def test_cross_site_post_is_refused(self):
        c = self.client("maria")
        r = c.post("/api/jobs/x/cancel", json={}, headers={"Origin": "https://evil.example"})
        self.assertEqual(r.status_code, 403)

    def test_a_film_from_upload_to_video(self):
        c = self.client("maria")
        r = self.new(c)
        self.assertEqual(r.status_code, 200, r.json)
        jid = r.json["id"]
        j = self.A.store.job(jid)
        self.assertEqual((j["status"], j["user"], j["minutes"], j["music_vol"], j["music_name"]),
                         ("queued", "maria", 1, 60, "song.mp3"))
        ins = self.A.studio.inputs(jid)
        self.assertEqual(sorted(ins), ["music", "script", "voice"])
        self.A.studio.tick()                                          # the queue starts it
        self.A.studio.threads[jid].join(60)
        j = self.A.store.job(jid)
        self.assertEqual((j["status"], j["progress"]), ("done", 100))
        listed = c.get("/api/jobs").json["jobs"][0]
        self.assertEqual(listed["id"], jid)
        self.assertTrue(listed["links"]["watch"].startswith("/local/mrtruth/videos/"))
        v = c.get(listed["links"]["watch"])
        self.assertEqual((v.status_code, v.mimetype), (200, "video/mp4"))
        self.assertGreater(len(v.data), 1000)
        self.assertEqual(self.client().get(listed["links"]["watch"]).status_code, 401)   # signed out: no video
        d = c.post(f"/api/jobs/{jid}/delete", json={})
        self.assertEqual(d.status_code, 200)
        self.assertFalse(any(x["id"] == jid for x in c.get("/api/jobs").json["jobs"]))

    def test_music_volume_defaults_to_100_and_is_kept_in_range(self):
        c = self.client("maria")
        for sent, kept in ((None, 100), ("100", 100), ("0", 0), ("35", 35), ("250", 100), ("-5", 0)):
            r = self.new(c, music_volume=sent)
            self.assertEqual(r.status_code, 200, r.json)
            self.assertEqual(self.A.store.job(r.json["id"])["music_vol"], kept, sent)
            c.post(f"/api/jobs/{r.json['id']}/cancel", json={})
        self.assertIn("0 to 100", self.new(c, music_volume="loud").json["error"])

    def test_an_older_database_gets_the_new_column(self):
        import sqlite3
        from web.store import Store
        p = Path(tempfile.mkdtemp()) / "old.sqlite"
        self.addCleanup(shutil.rmtree, p.parent, ignore_errors=True)
        db = sqlite3.connect(p)
        db.execute("CREATE TABLE jobs(id TEXT PRIMARY KEY, title TEXT, status TEXT, music_db REAL, deleted INTEGER DEFAULT 0, "
                   "created REAL)")
        db.execute("INSERT INTO jobs VALUES('a','old film','done',-18,0,1)")
        db.commit()
        db.close()
        s = Store(p)
        self.assertIn("music_vol", s.job("a"))
        self.assertEqual(s.job("a")["title"], "old film")

    def test_upload_checks(self):
        c = self.client("maria")
        self.assertIn("title", self.new(c, title="  ").json["error"])
        self.assertIn("voiceover", self.new(c, voice=None).json["error"])
        self.assertIn("audio", self.new(c, voice=(io.BytesIO(b"not audio at all" * 100), "v.mp3")).json["error"])
        self.assertIn("script", self.new(c, script=(io.BytesIO(b"short"), "s.txt")).json["error"])
        self.assertIn(".txt", self.new(c, script=(io.BytesIO(b"x" * 100), "s.docx")).json["error"])
        self.assertIn("not ready", self.new(c, run_on="pc").json["error"])
        r = self.new(c, script=None, script_text="pasted words " * 20, music=None)   # pasted script, no music
        self.assertEqual(r.status_code, 200, r.json)
        j = self.A.store.job(r.json["id"])
        self.assertIsNone(j["music_vol"])
        self.assertNotIn("music", self.A.studio.inputs(j["id"]))
        c.post(f"/api/jobs/{j['id']}/cancel", json={})
        self.assertEqual(self.A.store.job(j["id"])["status"], "cancelled")
        self.assertEqual(c.post(f"/api/jobs/{j['id']}/retry", json={}).status_code, 200)
        self.assertEqual(self.A.store.job(j["id"])["status"], "queued")
        c.post(f"/api/jobs/{j['id']}/cancel", json={})

    def test_only_the_maker_or_an_owner_can_stop_a_film(self):
        r = self.new(self.client("owner1"))
        jid = r.json["id"]
        self.assertEqual(self.client("maria").post(f"/api/jobs/{jid}/cancel", json={}).status_code, 403)
        self.assertEqual(self.client("owner1").post(f"/api/jobs/{jid}/cancel", json={}).status_code, 200)

    def test_settings_keys_are_never_shown(self):
        c = self.client("owner1")
        r = c.post("/api/settings", json={"keys": {"GEMINI_API_KEY": "AIza-secret-123456789", "NOT_A_KEY": "x"},
                                          "max_parallel": 4})
        self.assertEqual(r.status_code, 200)
        s = c.get("/api/settings").json
        g = next(k for k in s["keys"] if k["name"] == "GEMINI_API_KEY")
        self.assertEqual((g["set"], g["hint"]), (True, "…6789"))
        self.assertNotIn("secret-123", json.dumps(s))
        self.assertEqual(s["max_parallel"], 4)
        keys_file = Path(os.environ["MRTRUTH_WEB_DATA"]) / "keys.env"
        self.assertEqual(oct(keys_file.stat().st_mode & 0o777), "0o600")
        self.assertNotIn("NOT_A_KEY", keys_file.read_text())
        self.assertEqual(c.post("/api/settings", json={"keys": {"GEMINI_API_KEY": "a\nb"}}).status_code, 400)
        c.post("/api/settings", json={"clear": ["GEMINI_API_KEY"]})
        self.assertNotIn("GEMINI_API_KEY", keys_file.read_text())

    def test_a_new_password_ends_earlier_sign_ins(self):
        self.A.store.add_user("temp1", "first password", "member")
        c = self.A.app.test_client()
        c.post("/api/login", json={"name": "temp1", "password": "first password"})
        self.assertEqual(c.get("/api/jobs").status_code, 200)
        self.A.store.set_password("temp1", "second password")
        self.assertEqual(c.get("/api/jobs").status_code, 401)

    def test_only_the_upload_may_be_big(self):
        r = self.client().post("/api/login", data=b"x" * (2 * 1024 * 1024), content_type="application/json")
        self.assertEqual(r.status_code, 413)

    def test_a_member_cannot_retry_someone_elses_film(self):
        jid = self.new(self.client("owner1")).json["id"]
        self.client("owner1").post(f"/api/jobs/{jid}/cancel", json={})
        self.assertEqual(self.client("maria").post(f"/api/jobs/{jid}/retry", json={}).status_code, 403)

    def test_file_and_pasted_script_together_is_refused(self):
        r = self.new(self.client("maria"), script_text="pasted words " * 20)
        self.assertIn("not both", r.json["error"])

    def test_people(self):
        c = self.client("owner1")
        self.assertEqual(c.post("/api/users", json={"name": "Juan", "password": "short"}).status_code, 400)
        self.assertEqual(c.post("/api/users", json={"name": "Juan", "password": "long enough pw"}).status_code, 200)
        self.assertEqual(self.A.store.user("juan")["role"], "member")
        j = self.A.app.test_client()
        self.assertEqual(j.post("/api/login", json={"name": "JUAN", "password": "long enough pw"}).status_code, 200)
        self.assertEqual(c.post("/api/users/owner1/delete", json={}).status_code, 400)       # not yourself
        self.assertEqual(c.post("/api/users/juan/delete", json={}).status_code, 200)
        self.assertIsNone(self.A.store.user("juan"))

    # Settings → Planner (owner 2026-10-14: Claude Sonnet, or Claude Sonnet through Token Supply on test) and the key
    # test, through the website itself
    def test_settings_show_and_save_the_planner(self):
        c = self.client("owner1")
        self.addCleanup(self.A.store.put, "planner", "sonnet")
        s = c.get("/api/settings").json
        self.assertEqual(s["planner"], "sonnet")
        self.assertEqual([p["id"] for p in s["planners"]], ["sonnet", "ts"])
        self.assertEqual([p["label"] for p in s["planners"]],
                         ["Claude Sonnet", "Claude Sonnet through Token Supply (cheaper, test)"])
        self.assertIn("TOKENSUPPLY_API_KEY", [k["name"] for k in s["keys"] if not k["needed"]])
        self.assertIn("ANTHROPIC_API_KEY", [k["name"] for k in s["keys"] if k["needed"]])   # needed in every mode
        for bad in ("mix", "gpt", "", 3):
            r = c.post("/api/settings", json={"planner": bad})
            self.assertEqual(r.status_code, 400, bad)
            self.assertIn("the planner is one of: Claude Sonnet, Claude Sonnet through Token Supply", r.json["error"])
        self.assertEqual(c.get("/api/settings").json["planner"], "sonnet")
        self.assertEqual(self.client("maria").post("/api/settings", json={"planner": "ts"}).status_code, 403)
        self.assertEqual(c.post("/api/settings", json={"planner": "ts"}).status_code, 200)
        self.assertEqual(c.get("/api/settings").json["planner"], "ts")
        jid = self.new(c).json["id"]                                      # a film keeps the planner it was made with
        c.post("/api/settings", json={"planner": "sonnet"})
        self.assertEqual(self.A.store.job(jid)["planner"], "ts")
        self.assertEqual(next(j for j in c.get("/api/jobs").json["jobs"] if j["id"] == jid)["planner"], "ts")
        sonnet = self.new(c).json["id"]
        self.assertEqual(next(j for j in c.get("/api/jobs").json["jobs"] if j["id"] == sonnet)["planner"], "sonnet")
        for x in (jid, sonnet):
            c.post(f"/api/jobs/{x}/cancel", json={})
        c.post(f"/api/jobs/{jid}/retry", json={})                         # a Try again keeps it too
        self.assertEqual(self.A.store.job(jid)["planner"], "ts")
        c.post(f"/api/jobs/{jid}/cancel", json={})

    def test_the_key_test_checks_token_supply_with_one_token(self):
        c = self.client("owner1")
        self.addCleanup(self.A.store.put, "planner", "sonnet")
        sent, answer = [], {"code": 200}

        def post(url, **kw):
            if "token-supply" in url:
                sent.append((url, kw))
                return mock.Mock(ok=answer["code"] < 400, status_code=answer["code"], text="{}")
            return mock.Mock(ok=True, status_code=200, text="{}")               # Claude's credit check
        get = lambda url, **kw: mock.Mock(ok=True, status_code=200, text="{}", json=lambda: {})
        with mock.patch("requests.get", get), mock.patch("requests.post", post), \
                mock.patch.object(self.A.studio, "sources", lambda: FakeSources()):
            test = lambda: c.post("/api/settings/test", json={}).json["results"]["Token Supply"]
            self.assertEqual(test(), "not set (only for the Token Supply planner)")
            self.A.store.put("planner", "ts")
            self.assertEqual(test(), "failed: not set, and the planner is Claude Sonnet through Token Supply")
            self.assertEqual(sent, [])                                       # nothing asked without a key
            c.post("/api/settings", json={"keys": {"TOKENSUPPLY_API_KEY": "ts-test-key-123456"}})
            self.addCleanup(c.post, "/api/settings", json={"clear": ["TOKENSUPPLY_API_KEY"]})
            self.assertEqual(test(), "ok")
            url, kw = sent[-1]
            self.assertEqual(url, "https://api.token-supply.com/v1/messages")
            self.assertEqual(kw["headers"], {"x-api-key": "ts-test-key-123456", "anthropic-version": "2023-06-01",
                                             "Authorization": "Bearer ts-test-key-123456",
                                             "content-type": "application/json"})
            self.assertEqual((kw["json"]["max_tokens"], kw["json"]["model"]), (1, "claude-sonnet-5"))
            answer["code"] = 401
            self.assertEqual(test(), "failed: the Token Supply key was refused (HTTP 401) - check it in Settings")
            self.A.store.put("planner", "sonnet")                            # a set key is checked whatever the planner
            self.assertTrue(test().startswith("failed: the Token Supply key was refused"))
            self.assertEqual(len(sent), 3)
        self.assertNotIn("ts-test-key-123456", json.dumps(c.get("/api/settings").json))

    def test_an_older_database_gets_the_planner_column(self):
        import sqlite3
        from web.store import Store
        p = Path(tempfile.mkdtemp()) / "old.sqlite"
        self.addCleanup(shutil.rmtree, p.parent, ignore_errors=True)
        db = sqlite3.connect(p)                                  # the live version's jobs table, without the planner
        old = subprocess.run(["git", "-C", str(HERE), "show", "e8ef33b:web/store.py"], capture_output=True, text=True)
        if old.returncode == 0:
            db.executescript(old.stdout.split('SCHEMA = """', 1)[1].split('"""', 1)[0])
        else:
            db.execute("CREATE TABLE jobs(id TEXT PRIMARY KEY, title TEXT, status TEXT, deleted INTEGER DEFAULT 0, "
                       "created REAL)")
        db.execute("INSERT INTO jobs(id, title, status, deleted, created) VALUES('a','old film','done',0,1)")
        db.commit()
        db.close()
        s = Store(p)
        self.assertIsNone(s.job("a")["planner"])                 # a film made before the choice: Claude Sonnet's
        self.assertEqual(s.job("a")["title"], "old film")
        jid = s.new_job(user="u", title="new", planner="ts")
        self.assertEqual(s.job(jid)["planner"], "ts")
        Store(p)                                                 # opened again: nothing added twice
        self.assertEqual(s.job(jid)["planner"], "ts")


class FakeSources:
    """RunPod and Vast.ai stand-in for the runner's tests: `free` machines can still be rented; machines by id."""

    def __init__(self):
        self.free, self.hr, self.made, self.ended, self.rents, self.states = 10, 0.13, {}, [], [], {}
        self.money = {"runpod": {"balance": 50.0, "spend_hr": 0.0}}
        self.on_rent, self.why = None, ["nothing free under the price limit"]

    def rent(self, name, env, script, **kw):
        self.rents.append((name, env, script, kw))
        if self.on_rent:
            self.on_rent(name, env)
        if kw.get("stop", lambda: False)():
            return None, ["stopped"]
        if self.free <= 0:
            return None, list(self.why)
        self.free -= 1
        mid = f"m{len(self.made) + 1}"
        self.made[mid] = name
        return {"id": mid, "hr": self.hr, "desc": f"test machine, ${self.hr}/h", "host": f"c{len(self.made)}"}, []

    def list(self):
        return [{"id": m, "name": n, "hr": self.hr, "state": "running"} for m, n in self.made.items()
                if m not in self.ended]

    def state(self, mid):
        return self.states.get(mid, "gone" if mid in self.ended else "running")

    def terminate(self, mid):
        self.ended.append(mid)
        return True

    def balances(self, fresh=False):
        return self.money


class Runner(unittest.TestCase):
    """The film runner against a fake RunPod/Vast and a folder for R2: renting and waiting, the planner lost and
    replaced, carrying on from a saved plan, a restart, the sweep, the clean-up."""

    def setUp(self):
        from web.jobs import Studio, LocalBucket
        from web.store import Store
        import web.jobs as J
        self.J = J
        self.d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)
        self.s = Studio(Store(self.d / "s.sqlite"), self.d)
        self.b = LocalBucket(self.d / "bucket")
        self.src = FakeSources()
        self.s.bucket = lambda: self.b
        self.s.sources = lambda: self.src
        self.s.missing_keys = lambda made=False: []
        self.s.keys = lambda: {"RUNPOD_API_KEY": "k"}
        self.s.package = lambda b: ("mrtruth/pkg/x.tgz", "abc123def456aa")
        self.s.stop.wait = lambda t=None: None
        self.vs = mock.patch.object(J.VS, "env_for", lambda b, run, mf, keys, log=None: {"RUN_ID": run, "_mine": "m"})
        self.vs.start()
        self.addCleanup(self.vs.stop)

    def job(self, minutes=1):
        jid = self.s.store.new_job(user="a", title="T", run_on="runpod", minutes=minutes, seconds=60 * minutes)
        ins = self.s.folder(jid) / "inputs"
        ins.mkdir(parents=True)
        (ins / "voice.mp3").write_bytes(b"v")
        (ins / "script.txt").write_text("s")
        self.s.store.update(jid, status="starting")
        return jid

    def K(self, jid, run=None):
        return self.s.keys_of(jid, "T", run or self.s.store.job(jid)["run"])

    def answers(self, jid, video=True, ok=True):
        """What a planner that finished writes: the video and done.json, in the current attempt's place."""
        def write(name, env):
            K = self.K(jid)
            if video:
                self.b.put_bytes(K["video"], b"video")
            self.b.put_bytes(K["done"], json.dumps({"ok": ok, "why": "planning error: credit"}).encode())
        self.src.on_rent = write

    def test_try_again_never_reads_the_earlier_attempts_answer(self):
        jid = self.job()
        self.answers(jid, video=False, ok=False)
        self.s._guard(jid, self.s._run)
        self.assertIn("credit", self.s.store.job(jid)["error"])
        self.s.store.update(jid, status="starting", pod_id=None, error=None)
        time.sleep(1.1)                                      # a new attempt name (seconds)
        self.answers(jid)
        self.s._guard(jid, self.s._run)
        j = self.s.store.job(jid)
        self.assertEqual((j["status"], j["error"]), ("done", None))

    def test_stop_while_renting_switches_the_new_machine_off(self):
        jid = self.job()
        real = self.src.rent
        def rent(*a, **k):                                   # the machine is made, then Stop is pressed
            got = real(*a, **k)
            self.s.store.update(jid, status="cancelling")
            return got
        self.src.rent = rent
        self.s._guard(jid, self.s._run)
        self.assertEqual(self.s.store.job(jid)["status"], "cancelled")
        self.assertIn("m1", self.src.ended)

    def test_a_film_waits_for_a_machine_instead_of_failing(self):
        jid = self.job()
        self.src.free = 0
        stages = []
        def free_later(name, env):
            stages.append(self.s.store.job(jid)["stage"])
            if len(self.src.rents) == 3:                     # the third try finds one, which finishes the film
                self.src.free = 1
                self.answers(jid)
                self.src.on_rent(name, env)
        self.src.on_rent = free_later
        self.s._guard(jid, self.s._run)
        self.assertEqual(self.s.store.job(jid)["status"], "done")
        self.assertEqual(len(self.src.rents), 3)
        self.assertTrue(any("Waiting for a machine: no machine free under $1.50/h" in s for s in stages), stages)

    def test_a_film_gives_up_after_the_wait_and_says_why(self):
        jid = self.job()
        self.src.free = 0
        self.src.why = ["RunPod balance too low"]
        with mock.patch.object(self.J, "RENT_WAIT_S", 0):
            self.s._guard(jid, self.s._run)
        j = self.s.store.job(jid)
        self.assertEqual(j["status"], "failed")
        self.assertIn("RunPod balance too low - please top up", j["error"])

    def test_no_machine_is_rented_while_the_claude_account_is_dry(self):
        jid = self.job()
        self.s.keys = lambda: {"RUNPOD_API_KEY": "k", "ANTHROPIC_API_KEY": "a"}
        answers, stages = [self.J.CLAUDE_DRY, self.J.CLAUDE_DRY, ""], []
        def credit(key):
            self.assertEqual(key, "a")
            stages.append(self.s.store.job(jid)["stage"])
            return answers.pop(0)
        self.answers(jid)
        with mock.patch.object(self.J, "claude_credit", credit):
            self.s._guard(jid, self.s._run)
        self.assertEqual(self.s.store.job(jid)["status"], "done")
        self.assertEqual(len(self.src.rents), 1)                  # only once Claude answered
        self.assertTrue(any(s.startswith("Waiting for Claude: the Claude (Anthropic) account is out of credit")
                            for s in stages), stages)

    def test_a_film_stopped_by_a_dry_claude_account_says_so_plainly(self):
        jid = self.job()
        def write(name, env):
            K = self.K(jid)
            self.b.put_bytes(K["done"], json.dumps({"ok": False, "why": (
                "planning error: Claude API error: stream error: {'details': None, 'type': 'invalid_request_error', "
                "'message': 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billin")}
                ).encode())
        self.src.on_rent = write
        self.s._guard(jid, self.s._run)
        j = self.s.store.job(jid)
        self.assertEqual(j["status"], "failed")
        self.assertIn("account is out of credit - please top up at console.anthropic.com", j["error"])
        self.assertIn("then press Try again", j["error"])

    def test_the_claude_check_tells_a_dry_account_from_a_refused_key_and_never_blocks_on_a_blip(self):
        def post(code, text):
            return mock.patch.object(self.J.requests, "post", return_value=mock.Mock(status_code=code, text=text))
        with post(400, '{"error": {"message": "Your credit balance is too low to access the Anthropic API."}}'):
            self.assertEqual(self.J.claude_credit("a"), self.J.CLAUDE_DRY)
        with post(401, '{"error": {"message": "invalid x-api-key"}}'):
            self.assertIn("refused", self.J.claude_credit("a"))
        for code in (200, 429, 529):
            with post(code, "{}"):
                self.assertEqual(self.J.claude_credit("a"), "")
        with mock.patch.object(self.J.requests, "post", side_effect=self.J.requests.ConnectionError("down")):
            self.assertEqual(self.J.claude_credit("a"), "")
        self.assertEqual(self.J.claude_credit(""), "")

    def test_a_slow_machines_computer_is_passed_over_for_a_week_and_remembered(self):
        import web.machines as M
        self.addCleanup(M.AVOID.clear)
        jid = self.job()
        self.answers(jid)
        self.s._guard(jid, self.s._run)
        self.assertEqual(json.loads(self.s.store.job(jid)["runs"])[-1]["host"], "c1")   # the planner's computer
        K = self.K(jid)
        drawers = [{"part": 2, "log": K["dlog"](2), "host": "c2", "state": "ended"},
                   {"part": 3, "log": K["dlog"](3), "host": "c3", "state": "ended"},
                   {"part": 4, "log": K["dlog"](4), "host": "c4", "state": "ended", "why": "kept"}]
        self.s.store.update(jid, drawers=json.dumps(drawers))
        self.b.put_bytes(K["dlog"](2), b"20:55:18 DRAW start: share 2/3, workers 4\n21:07:33 PART 2 uploaded 34M in 735s\n")
        self.b.put_bytes(K["dlog"](3), b"21:00:02 PART 3 uploaded 30M in 330s\n")
        self.b.put_bytes(K["dlog"](4), b"21:00:02 PART 4 uploaded 30M in 900s\n")       # an earlier attempt's: not judged
        log = "20:59:32 PART 1 drawn here exit=0 seconds=265\n"
        self.s._judge_speed(jid, self.b, self.s.store.job(jid), log)
        self.assertEqual(set(M.AVOID), {"c2"})                       # 735 > 1.6 x 265; 330 is not
        self.assertGreater(M.AVOID["c2"], time.time() + 6 * 86400)
        M.AVOID.clear()                                              # the website restarts: the list comes back
        from web.jobs import Studio
        s2 = Studio(self.s.store, self.d)
        s2._loop = lambda: None
        s2.stop.set()                                                # its background threads end at once
        s2.start()
        self.assertEqual(set(M.AVOID), {"c2"})
        M.AVOID.clear()                                              # shares too short to judge, or one machine alone
        self.s._judge_speed(jid, self.b, self.s.store.job(jid), "PART 1 drawn here exit=0 seconds=40\n")
        self.s.store.update(jid, drawers="[]")
        self.s._judge_speed(jid, self.b, self.s.store.job(jid), log)
        self.assertEqual(M.AVOID, {})

    def test_a_failed_video_upload_is_the_reason_given(self):
        tail = ["21:22:01 FINISH exit=0 seconds=63 ", "21:22:02 verdicts: 285 answers saved",
                "21:22:03 video upload failed (curl exit 22)", "21:22:04 verdicts: 285 answers saved (at the end)"]
        self.assertEqual(self.J.Studio._why(tail), "video upload failed (curl exit 22)")
        self.assertIn("--retry 5 --retry-all-errors -X PUT -H \"Content-Type: video/mp4\"", self.J.PLAN_SCRIPT)

    def test_a_film_done_while_the_site_was_down_past_its_limit_is_read_back(self):
        jid = self.job()
        run = "web-x-1"
        K = self.K(jid, run)
        self.b.put_bytes(K["video"], b"video")
        self.b.put_bytes(K["done"], b'{"ok":true}')
        self.s.store.update(jid, status="running", pod_id="p", run=run, pod_started=time.time() - 10 * 3600)
        self.s._guard(jid, self.s._reattach)
        self.assertEqual(self.s.store.job(jid)["status"], "done")

    def test_a_planner_that_never_logs_is_replaced(self):
        jid = self.job()
        self.s.store.update(jid, status="running", pod_id="p", run="web-y-1",
                            pod_started=time.time() - self.J.START_LIMIT_S - 60)
        self.s._guard(jid, self.s._reattach)
        j = self.s.store.job(jid)
        self.assertEqual((j["status"], j["retries"], j["pod_id"]), ("queued", 1, None))
        self.assertIn("never started", j["stage"])
        self.assertIn("p", self.src.ended)

    def test_after_two_replacements_the_film_stops(self):
        jid = self.job()
        self.s.store.update(jid, status="running", pod_id="p", run="web-y-1", retries=self.J.AUTO_RETRIES,
                            pod_started=time.time() - self.J.START_LIMIT_S - 60)
        self.s._guard(jid, self.s._reattach)
        j = self.s.store.job(jid)
        self.assertEqual(j["status"], "failed")
        self.assertIn("never started", j["error"])

    def test_a_frozen_or_vanished_planner_is_replaced(self):
        for how in ("froze", "gone"):
            jid = self.job()
            K = self.K(jid, "web-z-1")
            self.b.put_bytes(K["log"], b"10:00 PLAN start\n")
            if how == "froze":                               # its log has not been sent for 13 minutes
                self.s._stat = lambda b, key: time.time() - self.J.FROZEN_S - 60
            else:
                self.s._stat = lambda b, key: time.time()
                self.src.states["p"] = "gone"
            self.s.store.update(jid, status="running", pod_id="p", run="web-z-1", pod_started=time.time() - 400,
                                log_tail="10:00 PLAN start")
            with mock.patch.multiple(self.J, BEAT_EVERY_S=0, CHECK_EVERY_S=0):
                self.s._guard(jid, self.s._reattach)
            j = self.s.store.job(jid)
            self.assertEqual((j["status"], j["retries"]), ("queued", 1), how)
            self.assertIn("attempt 2", j["stage"])
            self.assertIn("p", self.src.ended)

    def test_a_restart_with_a_storage_blip_keeps_the_film(self):
        jid = self.job()
        K = self.K(jid, "web-r-1")
        self.b.put_bytes(K["log"], b"10:00 PLAN start\n")
        self.s.store.update(jid, status="running", pod_id="p", run="web-r-1", log_tail="10:00 PLAN start",
                            pod_started=time.time() - self.J.START_LIMIT_S - 600)
        get, calls = self.b.get_bytes, []
        def flaky(key):                                      # the first read after the restart fails
            calls.append(key)
            if len(calls) == 1:
                raise self.J.S3Error("Storage network request failed")
            if len(calls) > 3:
                self.b.put_bytes(K["video"], b"v")
                self.b.put_bytes(K["done"], b'{"ok":true}')
            return get(key)
        self.b.get_bytes = flaky
        self.s._guard(jid, self.s._reattach)
        self.assertEqual(self.s.store.job(jid)["status"], "done")

    def test_a_film_that_was_starting_during_a_restart_goes_back_in_the_queue(self):
        jid = self.job()
        self.s._guard(jid, self.s._reattach)
        j = self.s.store.job(jid)
        self.assertEqual(j["status"], "queued")
        self.assertIn("restarted", j["stage"])

    def test_a_new_attempt_carries_on_from_the_saved_plan(self):
        jid = self.job()
        first = "web-a-1"
        Ka = self.K(jid, first)
        for key in (Ka["ckpt"], Ka["rpkg"], Ka["part"](1), Ka["part"](2)):
            self.b.put_bytes(key, b"x")
        self.s.store.update(jid, runs=json.dumps([{"run": first, "commit": "abc123def456", "plan": first}]))
        self.answers(jid)
        self.s._guard(jid, self.s._run)
        name, env, script, kw = self.src.rents[0]
        self.assertEqual(name, f"mrtruth-web-{jid}-a2")
        self.assertEqual(env["RESUMED_FROM"], first)
        self.assertIn(Ka["ckpt"], env["CKPT_GET"])
        self.assertIn(Ka["part"](1), env["PART_GET_1"])
        self.assertIn(Ka["part"](2), env["PART_GET_2"])          # drawn before: taken, not drawn again
        self.assertIn(self.K(jid)["part"](3), env["PART_GET_3"])
        self.assertEqual(self.s.store.job(jid)["status"], "done")

    def test_another_version_of_the_tool_plans_again_and_drops_the_old_files(self):
        jid = self.job()
        Ka = self.K(jid, "web-old-1")
        for key in (Ka["ckpt"], Ka["rpkg"], Ka["part"](2)):
            self.b.put_bytes(key, b"x")
        self.s.store.update(jid, runs=json.dumps([{"run": "web-old-1", "commit": "000000000000", "plan": "web-old-1"}]))
        self.answers(jid)
        self.s._guard(jid, self.s._run)
        env = self.src.rents[0][1]
        self.assertNotIn("CKPT_GET", env)
        self.assertEqual(env["PART_GET_1"], "")
        self.assertFalse(any(self.b.exists(k) for k in (Ka["ckpt"], Ka["rpkg"], Ka["part"](2))))

    def test_a_finished_film_drops_every_attempts_files_a_failed_one_keeps_its_plan(self):
        jid = self.job()
        self.answers(jid, video=False, ok=False)
        def keep(name, env):
            K = self.K(jid)
            for key in (K["ckpt"], K["rpkg"], K["part"](2), K["boot"]("x")):
                self.b.put_bytes(key, b"x")
            self.b.put_bytes(K["done"], b'{"ok":false,"why":"render"}')
        self.src.on_rent = keep
        self.s._guard(jid, self.s._run)
        K1 = self.K(jid)
        self.assertEqual(self.s.store.job(jid)["status"], "failed")
        self.assertTrue(self.b.exists(K1["ckpt"]) and self.b.exists(K1["part"](2)))   # Try again carries on
        self.assertFalse(self.b.exists(K1["boot"]("x")))                               # the keys are gone
        self.s.store.update(jid, status="starting", pod_id=None, error=None)
        time.sleep(1.1)
        self.answers(jid)
        self.s._guard(jid, self.s._run)
        self.assertEqual(self.s.store.job(jid)["status"], "done")
        self.assertFalse(self.b.exists(K1["ckpt"]) or self.b.exists(K1["part"](2)))

    def test_a_deleted_film_takes_its_files_with_it(self):
        jid = self.job()
        K = self.K(jid, "web-d-1")
        self.b.put_bytes(K["rpkg"], b"x")
        self.b.put_bytes(K["video"], b"v")
        self.s.store.update(jid, video_key=K["video"], runs=json.dumps([{"run": "web-d-1", "commit": "abc123def456"}]))
        self.s.forget(jid)
        self.assertFalse(self.b.exists(K["rpkg"]) or self.b.exists(K["video"]))

    def test_the_sweep_keeps_only_what_a_film_counts_on(self):
        jid = self.job()
        self.s.store.update(jid, status="running", pod_id="m1", drawers=json.dumps([
            {"part": 2, "id": "m2", "state": "running", "started": 0, "hr": 0.2},
            {"part": 3, "id": "m3", "state": "done", "started": 0, "hr": 0.2}]))
        for mid, name in (("m1", f"mrtruth-web-{jid}-a1"), ("m2", f"mrtruth-web-{jid}-a1-d2"),
                          ("m3", f"mrtruth-web-{jid}-a1-d3"), ("m4", f"mrtruth-web-{jid}-a1-d4"),
                          ("m5", f"mrtruth-web-{jid}-a0"), ("m6", "someone-elses"), ("m7", "mrtruth-web-old-a1")):
            self.src.made[mid] = name
        self.s.renting.add(f"mrtruth-web-{jid}-a1-d4")          # being rented right now
        self.assertEqual(sorted(self.s.sweep()), ["m3", "m5", "m7"])
        self.s.store.update(jid, status="queued")               # waiting: nothing of it should run
        self.assertEqual(sorted(self.s.sweep()), ["m1", "m2"])

    def test_end_machines_switches_off_every_machine_named_for_the_film(self):
        jid = self.job()
        self.s.store.update(jid, pod_id="m1", drawers=json.dumps([
            {"part": 2, "id": "m2", "state": "running", "started": 0, "hr": 0.2},
            {"part": 3, "id": "m3", "state": "done", "started": 0, "hr": 0.2}]))
        self.src.made.update({"m1": f"mrtruth-web-{jid}-a1", "m9": f"mrtruth-web-{jid}-a0-d3"})
        self.assertTrue(self.s._end_machines(jid))
        self.assertEqual(sorted(set(self.src.ended)), ["m1", "m2", "m9"])
        self.assertEqual([d["state"] for d in json.loads(self.s.store.job(jid)["drawers"])], ["ended", "done"])


class Parts(unittest.TestCase):
    def test_costs_read_from_the_film_log(self):
        from web.jobs import Studio
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        log = ("  Claude this run: Claude: 17 calls, 170k in / 56k out = $0.8942 — claude-sonnet-5\n"
               "  Gemini photo picks: 438 (1698k in, 83k out, 0k thinking = $1.59), 0 handed to Claude\n"
               "  reuse on the final cut: ... AI on screen 39 of 44 from 52 drawings (52 of the 88 budget)\n").encode()
        with tarfile.open(d / "r.tgz", "w:gz") as t:
            info = tarfile.TarInfo("plan.log")
            info.size = len(log)
            t.addfile(info, io.BytesIO(log))
        self.assertEqual(Studio.costs(d / "r.tgz"), {"claude": 0.89, "gemini": 1.59, "ai_pictures": 0.26})
        self.assertEqual(Studio.costs(d / "missing.tgz"), {})

    def test_progress_and_time_left(self):
        from web.jobs import Studio
        self.assertGreater(Studio._left("PLAN start", 0.0, 20), Studio._left("RENDER start", 0.0, 20))
        self.assertEqual(Studio._left("video uploaded", 0, 20), 2)

    def test_the_package_leaves_out_keys_and_unused_parts(self):
        from web.jobs import Studio, LocalBucket
        from web.store import Store
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        s = Studio(Store(d / "s.sqlite"), d)
        key, commit = s.package(LocalBucket(d / "bucket"))
        with tarfile.open(d / "bucket" / key) as t:
            names = t.getnames()
        self.assertIn("./run_test.py", names)
        self.assertIn("./testin/constraints.txt", names)
        self.assertIn("./testin/summarize.py", names)
        self.assertFalse(any(n.startswith("./legends_renderer") or n.endswith(".env") for n in names))
        self.assertEqual(s.package(LocalBucket(d / "bucket"))[0], key)       # once per commit

    def test_pod_script_carries_the_music_and_the_inputs(self):
        from web import jobs as J
        for need in ('"$VOICE_URL"', '"$SCRIPT_URL"', 'MRTRUTH_MUSIC=', 'MRTRUTH_MUSIC_VOLUME="${MUSIC_VOL:-100}"', '"$VID_PUT"',
                     'run_test.py "$JS" "$JV" "$JT" "$JM" --export', "--segments /root/seg_1.tgz", "seed_verdicts", "remote_render.py --part"):
            self.assertIn(need, J.POD_SCRIPT)
        r = subprocess.run(["bash", "-n"], input=J.POD_SCRIPT, text=True, capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)


class Split(unittest.TestCase):
    """A film on several machines: the shares, the drawing machines (wanted, rented, retried, replaced, watched), the
    cost, and the planner's own script (run in bash with curl faked)."""

    def setUp(self):
        from web.jobs import Studio, LocalBucket
        from web.store import Store
        import web.jobs as J
        self.J = J
        self.d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)
        self.s = Studio(Store(self.d / "s.sqlite"), self.d)
        self.b = LocalBucket(self.d / "bucket")
        self.src = FakeSources()
        self.s.bucket = lambda: self.b
        self.s.sources = lambda: self.src
        self.s.keys = lambda: {"RUNPOD_API_KEY": "k"}

    def film(self, n=3, drawers=None):
        jid = self.s.store.new_job(user="a", title="T", run_on="runpod", minutes=10, seconds=600)
        self.s.store.update(jid, status="running", pod_id="planner", pod_hr=0.13, run="web-r-1",
                            runs=json.dumps([{"run": "web-r-1", "commit": "c", "plan": "web-r-1"}]),
                            pod_started=time.time(), machines=n, drawers=json.dumps(drawers or []))
        return jid, self.s.keys_of(jid, "T", "web-r-1")

    def drawers(self, jid):
        return json.loads(self.s.store.job(jid)["drawers"])

    def running(self, *parts, started=None, **extra):
        now = time.time() if started is None else started
        return [dict({"part": k, "id": f"d{k}", "hr": 0.2, "desc": "x", "started": now, "ended": None,
                      "state": "running", "name": f"n{k}", "log": None}, **extra) for k in parts]

    def test_drawers_are_wanted_at_once_and_rented_when_the_pictures_are_chosen(self):
        jid, K = self.film(3)
        self.s._drawers(jid, self.b, K, "10:00:00 PLAN start")
        self.assertEqual(self.src.rents, [])
        self.assertEqual([(d["part"], d["state"]) for d in self.drawers(jid)], [(2, "wanted"), (3, "wanted")])
        self.s._drawers(jid, self.b, K, "10:00:00 PLAN start\n10:20:00 PICTURES done")
        self.assertEqual([r[0] for r in self.src.rents], [f"mrtruth-web-{jid}-a1-d2", f"mrtruth-web-{jid}-a1-d3"])
        name, env, script, kw = self.src.rents[0]
        self.assertEqual((env["PART"], env["NPARTS"], kw["max_hr"], kw["ram"]), ("2", "3", self.J.DRAWER_MAX_HR, 24))
        self.assertEqual(env["STALL"], str(self.J.STALL_S))                     # it judges a stall by its own clock
        self.assertIs(script, self.J.DRAW_SCRIPT)
        self.assertFalse(any(k.startswith("K_") for k in env))                   # a drawer gets no keys
        self.assertIn(K["rpkg"], env["PKG_GET"])
        self.assertEqual([(d["part"], d["state"]) for d in self.drawers(jid)], [(2, "running"), (3, "running")])
        self.s._drawers(jid, self.b, K, "PICTURES done\nPACKAGE uploaded")      # never rented twice
        self.assertEqual(len(self.src.rents), 2)
        self.assertFalse(self.s.renting)                                         # every name given back

    def test_drawers_are_rented_while_the_pictures_are_chosen_to_be_ready_in_time(self):
        jid, K = self.film(3)                                            # a 10-minute film: lead 600 - 240 = 360 s
        started = time.strftime("%H:%M:%S", time.gmtime(time.time() - 100))
        self.s._drawers(jid, self.b, K, f"{started} PICTURES start")
        self.assertEqual(self.src.rents, [])                             # too early: they would only wait
        started = time.strftime("%H:%M:%S", time.gmtime(time.time() - 400))
        self.s._drawers(jid, self.b, K, f"{started} PICTURES start")
        self.assertEqual(len(self.src.rents), 2)

    def test_a_resumed_film_takes_the_package_of_the_attempt_that_planned(self):
        jid, K = self.film(2)
        self.s.store.update(jid, run="web-r-2", runs=json.dumps([
            {"run": "web-r-1", "commit": "c", "plan": "web-r-1"}, {"run": "web-r-2", "commit": "c", "plan": "web-r-1"}]))
        K2 = self.s.keys_of(jid, "T", "web-r-2")
        self.s._drawers(jid, self.b, K2, "PLAN exit=0 seconds=0 resumed")
        name, env, script, kw = self.src.rents[0]
        self.assertEqual(name, f"mrtruth-web-{jid}-a2-d2")
        self.assertIn(K["rpkg"], env["PKG_GET"])                                 # web-r-1's package
        self.assertIn(K2["part"](2), env["PART_PUT"])                            # this attempt's share

    def test_none_free_is_tried_again_until_it_is_too_late(self):
        jid, K = self.film(3)
        self.src.free = 0
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual(len(self.src.rents), 2)
        self.assertEqual({d["state"] for d in self.drawers(jid)}, {"wanted"})
        self.s._drawers(jid, self.b, K, "PICTURES done")                         # not yet time to try again
        self.assertEqual(len(self.src.rents), 2)
        self.src.free = 1
        with mock.patch.object(self.J.time, "time", return_value=time.time() + self.J.RENT_RETRY_S + 1):
            self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual([d["state"] for d in self.drawers(jid)], ["running", "wanted"])
        self.s._drawers(jid, self.b, K, "PICTURES done\nPART 1 drawn here exit=0 seconds=500")
        self.assertEqual([d["state"] for d in self.drawers(jid)], ["running", "skipped"])
        self.assertTrue(self.b.exists(K["skip"](3)))                             # the planner draws share 3

    def test_no_drawers_when_planning_failed(self):
        jid, K = self.film(3)
        self.s._drawers(jid, self.b, K, "PICTURES done\nPLAN exit=1 seconds=900")
        self.assertEqual(self.src.rents, [])
        self.assertEqual({d["state"] for d in self.drawers(jid)}, {"ended"})

    def test_finished_failed_or_taken_over(self):
        jid, K = self.film(4, self.running(2, 3, 4))
        self.b.put_bytes(K["part"](2), b"tgz")                                   # share 2 arrived
        self.b.put_bytes(K["dlog"](3), b"10:30 PART 3 failed (exit 1): renderer failed")
        self.s._drawers(jid, self.b, K, "PICTURES done\nPART 4 drawing it here (its machine was late)")
        ds = self.drawers(jid)
        got = [(d["part"], d["state"], d.get("why")) for d in ds]
        self.assertEqual(got[:3], [(2, "done", "done"), (3, "ended", "failed"), (4, "done", "taken over")])
        self.assertEqual((ds[3]["part"], ds[3]["state"], ds[3]["replaces"]), (3, "wanted", 1))   # a second machine
        self.assertEqual(sorted(self.src.ended), ["d2", "d3", "d4"])
        self.s._drawers(jid, self.b, K, "PICTURES done\nPART 4 drawing it here")
        self.assertEqual(self.src.rents[-1][0], f"mrtruth-web-{jid}-a1-d3r1")
        self.assertIn("log_3r1", self.src.rents[-1][1]["LOG_PUT"])               # its own log, not the failed one's

    def test_a_replacement_that_fails_too_leaves_the_share_to_the_planner(self):
        jid, K = self.film(2, self.running(2, replaces=1, log=None))
        self.b.put_bytes(K["dlog"](2), b"PART 2 failed (exit 1)")
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual(self.drawers(jid)[0]["state"], "skipped")
        self.assertEqual(self.b.get_bytes(K["skip"](2)), b"failed")

    def test_never_started_vanished_or_frozen(self):
        old = time.time() - self.J.START_LIMIT_S - 10
        ds = (self.running(2, started=old) + self.running(3, seen=True) + self.running(4, seen=True))
        jid, K = self.film(4, ds)
        self.b.put_bytes(K["dlog"](3), b"DRAW start")
        self.b.put_bytes(K["dlog"](4), b"DRAW start")
        self.src.states["d3"] = "gone"
        stamps = {K["dlog"](3): time.time(), K["dlog"](4): time.time() - self.J.FROZEN_S - 30}
        self.s._stat = lambda b, key: stamps.get(key)
        with mock.patch.object(self.J, "CHECK_EVERY_S", 0):
            self.s._drawers(jid, self.b, K, "PICTURES done\nPART 1 drawn here exit=0")       # too late to replace
        got = {d["part"]: (d["state"], d["why"]) for d in self.drawers(jid)}
        self.assertEqual(got, {2: ("skipped", "never started"), 3: ("skipped", "vanished"), 4: ("skipped", "froze")})
        self.assertEqual(self.b.get_bytes(K["skip"](2)), b"never started")

    @staticmethod
    def drawing(*lines, now=None):
        """A drawing machine's log as it writes it: (seconds ago, text), the times on its UTC clock."""
        now = time.time() if now is None else now
        return "".join(f"{time.strftime('%H:%M:%S', time.gmtime(now - a))} {t}\n" for a, t in lines).encode()

    def stalled(self, k, last=660):
        """Film 261014-f4625c's share 3 on a machine whose heartbeat did not say it failed (the website's backstop):
        DRAW start, then the renderer stops; the log is still sent every 30 s. `last`: past STALL_S + CLOCK_SLACK_S."""
        return self.drawing((last + 600, "apt ok, waiting for the plan"),
                            (last + 180, f"DRAW start: share {k}/3, workers 5"),
                            (last + 150, "DRAW progress (renderer starting)"), (last + 120, "DRAW progress 0/54"),
                            (last, "DRAW progress 3/54"))

    def test_a_drawer_that_stopped_drawing_is_switched_off_and_the_planner_draws_its_share(self):
        """The website's backstop: its log still sent just now (so it never froze), but its last progress 11 minutes
        old (STALL_S + CLOCK_SLACK_S: 10 min) and no failed line from its heartbeat, while the planner has drawn its
        own share: switched off and marked at once - no replacement this late."""
        jid, K = self.film(3, self.running(2, 3, seen=True, started=time.time() - 1500))
        self.b.put_bytes(K["dlog"](2), self.drawing((600, "DRAW start: share 2/3, workers 5"),
                                                    (90, "DRAW progress 30/54"), (60, "DRAW progress 33/54")))
        self.b.put_bytes(K["dlog"](3), self.stalled(3))
        self.s._stat = lambda b, key: time.time()
        self.s._drawers(jid, self.b, K, "PICTURES done\nRENDER start: 160 shots in 3 share(s), workers 5 here\n"
                                         "PART 1 drawn here exit=0 seconds=982")
        got = {d["part"]: (d["state"], d.get("why")) for d in self.drawers(jid)}
        self.assertEqual(got, {2: ("running", None), 3: ("skipped", "stopped drawing")})
        self.assertEqual(self.b.get_bytes(K["skip"](3)), b"stopped drawing")      # the planner draws share 3 now
        self.assertEqual((self.src.ended, self.src.rents), (["d3"], []))

    def test_a_drawer_that_stopped_drawing_while_the_planner_draws_its_own_share_is_replaced(self):
        jid, K = self.film(3, self.running(2, 3, seen=True, started=time.time() - 1500))
        self.b.put_bytes(K["dlog"](2), self.drawing((600, "DRAW start: share 2/3, workers 5"),
                                                    (20, "DRAW progress 9/54")))
        self.b.put_bytes(K["dlog"](3), self.stalled(3))
        self.s._stat = lambda b, key: time.time()
        log = "PICTURES done\nRENDER start: 160 shots in 3 share(s), workers 5 here"
        self.s._drawers(jid, self.b, K, log)
        ds = self.drawers(jid)
        self.assertEqual([(d["part"], d["state"], d.get("why")) for d in ds[:2]],
                         [(2, "running", None), (3, "ended", "stopped drawing")])
        self.assertEqual((ds[2]["part"], ds[2]["state"], ds[2]["replaces"], ds[2]["desc"]),
                         (3, "wanted", 1, "replacing a machine that stopped drawing"))
        self.assertFalse(self.b.exists(K["skip"](3)))
        self.s._drawers(jid, self.b, K, log)                                      # the second machine is rented
        self.assertEqual(self.src.rents[-1][0], f"mrtruth-web-{jid}-a1-d3r1")
        self.b.put_bytes(K["dlog"]("3r1"), self.stalled(3, last=700))           # and stops drawing too
        self.s._drawers(jid, self.b, K, log)
        self.assertEqual(self.drawers(jid)[2]["state"], "skipped")
        self.assertEqual(self.b.get_bytes(K["skip"](3)), b"stopped drawing")
        self.assertEqual(self.src.ended, ["d3", "m1"])

    def test_a_drawer_drawing_sending_or_on_the_older_script_is_left_alone(self):
        # (one still waiting for the plan once the planner has drawn its own share is no longer left alone, owner
        # 2026-10-15: test_a_drawer_not_drawing_yet_when_the_planner_has_drawn_its_own_share_hands_it_over)
        jid, K = self.film(4, self.running(2, 3, 4, seen=True, started=time.time() - 2400))
        self.b.put_bytes(K["dlog"](2), self.drawing((1500, "DRAW start: share 2/4, workers 5"),          # drawing
                                                    (1470, "DRAW progress 0/30"), (100, "DRAW progress 28/30")))
        self.b.put_bytes(K["dlog"](3), self.drawing((1500, "DRAW start: share 3/4, workers 5"),          # sending
                                                    (900, "DRAW progress 30/30"), (890, "PART 3 drawn, sending it")))
        self.b.put_bytes(K["dlog"](4), self.drawing((1800, "DRAW start: share 4/4, workers 5")))       # older script
        self.s._stat = lambda b, key: time.time()
        self.s._drawers(jid, self.b, K, "PICTURES done\nPART 1 drawn here exit=0 seconds=982")
        self.assertEqual({d["part"]: d["state"] for d in self.drawers(jid)}, {2: "running", 3: "running", 4: "running"})
        self.assertEqual(self.src.ended, [])
        self.assertFalse(any(self.b.exists(K["skip"](k)) for k in (2, 3, 4)))
        self.s._stat = lambda b, key: time.time() - self.J.FROZEN_S - 30       # the older script is judged as before
        self.s._drawers(jid, self.b, K, "PICTURES done\nPART 1 drawn here exit=0 seconds=982")
        self.assertEqual({d["part"]: d.get("why") for d in self.drawers(jid)}, {2: "froze", 3: "froze", 4: "froze"})

    def test_a_drawer_not_drawing_yet_when_the_planner_has_drawn_its_own_share_hands_it_over(self):
        """Owner 2026-10-15: once the planner has drawn its own share, a drawer with no DRAW start in its log yet -
        still waiting for the plan, or no log at all - cannot send its share sooner than the planner can draw it now:
        switched off and its skip mark written at once, with the reason the planner says (no replacement this late).
        One drawing (DRAW start, recent progress) is judged as before; one whose share arrived is done; one whose log
        could not be read is looked at again. Before that, nothing changes."""
        now = time.time()
        jid, K = self.film(6, self.running(2, 4, 5, 6, seen=True, started=now - 1500)
                           + self.running(3, started=now - 600))                 # 3: rented 10 min ago, no log yet
        waiting = self.drawing((1500, "ip 1.2.3.4 nproc=16 cpus=16 mem=32GB node=v22.11.0 share 2/6"),
                               (420, "apt ok, waiting for the plan"))
        self.b.put_bytes(K["dlog"](2), waiting)
        self.b.put_bytes(K["dlog"](4), self.drawing((500, "apt ok, waiting for the plan"),
                                                    (300, "DRAW start: share 4/6, workers 4"),
                                                    (270, "DRAW progress 0/27"), (30, "DRAW progress 9/27")))
        self.b.put_bytes(K["dlog"](5), waiting)                 # its share arrived; this copy of its log is older
        self.b.put_bytes(K["dlog"](6), waiting)
        get = self.b.get_bytes                                  # 6: a storage hiccup (not a 404) reading its log
        self.b.get_bytes = lambda key: ((_ for _ in ()).throw(self.J.S3Error("Storage network request failed"))
                                        if key == K["dlog"](6) else get(key))
        self.s._stat = lambda b, key: time.time()               # every log sent just now: none froze
        drawing = "PICTURES done\nPACKAGE uploaded 96M\nRENDER start: 160 shots in 6 share(s), workers 5 here"
        self.s._drawers(jid, self.b, K, drawing)                # the planner still draws its own share
        self.assertEqual({d["part"]: (d["state"], d.get("why")) for d in self.drawers(jid)},
                         {k: ("running", None) for k in (2, 3, 4, 5, 6)})
        self.assertEqual((self.src.ended, self.src.rents), ([], []))
        self.assertFalse(any(self.b.exists(K["skip"](k)) for k in range(2, 7)))
        self.b.put_bytes(K["part"](5), b"tgz")
        self.s._drawers(jid, self.b, K, drawing + "\nPART 1 drawn here exit=0 seconds=982")
        why = "not drawing yet when the planner had drawn its own share"
        self.assertEqual(self.J.NOT_DRAWING_YET, why)
        ds = self.drawers(jid)
        self.assertEqual({d["part"]: (d["state"], d.get("why")) for d in ds},
                         {2: ("skipped", why), 3: ("skipped", why), 4: ("running", None), 5: ("done", "done"),
                          6: ("running", None)})
        self.assertEqual(len(ds), 5)                                              # no replacement this late
        self.assertTrue(all(d["mark"] for d in ds if d["state"] == "skipped"))
        self.assertEqual([self.b.get_bytes(K["skip"](k)) for k in (2, 3)], [why.encode()] * 2)
        self.assertFalse(any(self.b.exists(K["skip"](k)) for k in (4, 5, 6)))
        self.assertEqual((sorted(self.src.ended), self.src.rents), (["d2", "d3", "d5"], []))
        self.b.get_bytes = get                                  # 6's log read on the next pass: waiting too
        self.s._drawers(jid, self.b, K, drawing + "\nPART 1 drawn here exit=0 seconds=982")
        got = {d["part"]: (d["state"], d.get("why")) for d in self.drawers(jid)}
        self.assertEqual((got[4], got[6]), (("running", None), ("skipped", why)))  # 4 draws on
        self.assertEqual(self.b.get_bytes(K["skip"](6)), why.encode())
        self.assertEqual((sorted(self.src.ended), self.src.rents), (["d2", "d3", "d5", "d6"], []))

    def test_the_2026_10_15_slow_start_end_to_end(self):
        """Films 261015-608a6b and 261015-336268: two drawers on the failing Vast computer (three of the films' drawers
        landed there), 18 min setting up, then still waiting for the 96 MB package sent at 13:57, their logs sent every
        30 s (so never frozen) and no DRAW start (so no stall). The planner drew its own share by 14:17 and waited its
        fixed T_OWN / 2 + 900 s (about 24 min) before drawing theirs. Now: left alone while the planner draws its own
        share; both switched off and marked once it is drawn; the planner draws both shares on its first look, not
        after its fixed wait."""
        now = time.time()
        jid, K = self.film(3, self.running(2, 3, seen=True, started=now - 2700))
        for k in (2, 3):                                        # 13:32 rented, 13:50 set up, 14:17 still waiting
            self.b.put_bytes(K["dlog"](k), self.drawing(
                (2640, f"ip 5.6.7.8 nproc=16 cpus=16 mem=48GB node=v22.11.0 share {k}/3"),
                (1620, "apt ok, waiting for the plan"), now=now))
        self.s._stat = lambda b, key: time.time()
        planner = self.drawing((2400, "PICTURES done"), (1500, "PLAN exit=0 seconds=2210"),
                               (1200, "PACKAGE uploaded 96M"),
                               (1150, "RENDER start: 160 shots in 3 share(s), workers 5 here"), now=now).decode()
        self.s._drawers(jid, self.b, K, planner)                # 13:58-14:17: the planner draws its own share
        self.assertEqual([(d["part"], d["state"]) for d in self.drawers(jid)], [(2, "running"), (3, "running")])
        self.assertEqual(self.src.ended, [])
        planner += self.drawing((0, "PART 1 drawn here exit=0 seconds=1150"), now=now).decode()
        self.s._drawers(jid, self.b, K, planner)                # 14:17: its own share drawn
        why = self.J.NOT_DRAWING_YET
        self.assertEqual([(d["part"], d["state"], d.get("why")) for d in self.drawers(jid)],
                         [(2, "skipped", why), (3, "skipped", why)])
        self.assertEqual((sorted(self.src.ended), self.src.rents), (["d2", "d3"], []))
        marks = {k: self.b.get_bytes(K["skip"](k)).decode() for k in (2, 3)}
        self.assertEqual(marks, {2: why, 3: why})
        root, r, log = self.collect(skip=marks, n=3)            # the planner's next look (every 15 s)
        self.assertIn(f"PART 2 drawing it here (its machine: {why})", log)
        self.assertIn(f"PART 3 drawing it here (its machine: {why})", log)
        self.assertNotIn("was late", log)                       # not after its fixed wait
        self.assertTrue(log.endswith("DRAWN 2 3"), log)
        self.assertIn(f"SEGS=--segments {root}/seg_1.tgz --segments {root}/seg_2.tgz --segments {root}/seg_3.tgz "
                      f"RR=0", r.stdout)
        said = "\n".join(ln for ln in log.splitlines() if ln.startswith("PART "))
        self.s._drawers(jid, self.b, K, planner + said)         # the website's next pass: nothing more to do
        self.assertEqual([(d["part"], d["state"]) for d in self.drawers(jid)], [(2, "skipped"), (3, "skipped")])
        self.assertEqual((sorted(self.src.ended), self.src.rents), (["d2", "d3"], []))

    def test_drawers_rented_minutes_before_the_planner_has_drawn_its_own_share_are_left_to_start(self):
        """2026-10-15 review: two drawers rented 2 min before "PART 1 drawn" (the 2-minute retries when none was free,
        or two one-time replacements) are booting normally; the planner draws the shares handed to it one after
        another, so handing both over would cost a whole share (about 17 min). Left alone until NOT_DRAWING_GRACE_S
        old; then one that started drawing draws on, and one still not drawing is handed over on the next pass."""
        now = time.time()
        rented = now - 120
        jid, K = self.film(3, self.running(2, 3, started=rented))
        self.b.put_bytes(K["dlog"](2), self.drawing((60, "ip 1.2.3.4 nproc=16 cpus=16 mem=32GB share 2/3"),
                                                    (10, "apt ok, waiting for the plan"), now=now))  # 3: no log yet
        self.s._stat = lambda b, key: time.time()
        drawn = "PICTURES done\nPACKAGE uploaded 96M\nPART 1 drawn here exit=0 seconds=982"
        self.s._drawers(jid, self.b, K, drawn)
        self.assertEqual([(d["part"], d["state"], d.get("why")) for d in self.drawers(jid)],
                         [(2, "running", None), (3, "running", None)])
        self.assertEqual((self.src.ended, self.src.rents), ([], []))
        self.assertFalse(any(self.b.exists(K["skip"](k)) for k in (2, 3)))
        grace = rented + self.J.NOT_DRAWING_GRACE_S
        with mock.patch.object(self.J.time, "time", return_value=grace - 5):     # just short of it: still left alone
            self.s._drawers(jid, self.b, K, drawn)
        self.assertEqual([d["state"] for d in self.drawers(jid)], ["running", "running"])
        self.assertEqual(self.src.ended, [])
        self.b.put_bytes(K["dlog"](2), self.drawing((60, "DRAW start: share 2/3, workers 5"),
                                                    (30, "DRAW progress 0/27"), now=grace + 5))  # 2 started drawing
        with mock.patch.object(self.J.time, "time", return_value=grace + 5):     # past it
            self.s._drawers(jid, self.b, K, drawn)
        self.assertEqual([(d["part"], d["state"], d.get("why")) for d in self.drawers(jid)],
                         [(2, "running", None), (3, "skipped", self.J.NOT_DRAWING_YET)])
        self.assertEqual((self.src.ended, self.src.rents), (["d3"], []))
        self.assertEqual(self.b.get_bytes(K["skip"](3)), self.J.NOT_DRAWING_YET.encode())
        self.assertFalse(self.b.exists(K["skip"](2)))

    def test_a_film_carried_on_from_its_saved_plan_keeps_the_drawers_it_just_rented(self):
        """2026-10-15 review: an attempt carried on from its saved plan with share 1 kept says "PLAN exit=0 ...
        resumed" (its drawers are rented) and "PART 1 kept from an earlier attempt" seconds later, before any of them
        could say DRAW start: they are left to start, not all switched off with every share handed to the planner."""
        jid, K = self.film(4)
        self.s.store.update(jid, run="web-r-2", runs=json.dumps([{"run": "web-r-1", "commit": "c", "plan": "web-r-1"},
                                                                 {"run": "web-r-2", "commit": "c", "plan": "web-r-1"}]))
        K2 = self.s.keys_of(jid, "T", "web-r-2")
        resumed = "PLAN exit=0 seconds=0 resumed"
        self.s._drawers(jid, self.b, K2, resumed)                                # rents d2, d3 and d4
        self.assertEqual([(d["part"], d["state"]) for d in self.drawers(jid)],
                         [(2, "running"), (3, "running"), (4, "running")])
        self.b.put_bytes(K2["dlog"](2), self.drawing((5, "ip 1.2.3.4 nproc=16 cpus=16 mem=32GB node=v22.11.0 "
                                                         "share 2/4")))           # 3 and 4: no log yet
        self.s._stat = lambda b, key: time.time()
        with mock.patch.object(self.J.time, "time", return_value=time.time() + 45):  # the planner's next log copy
            self.s._drawers(jid, self.b, K2, resumed + "\nPART 1 kept from an earlier attempt")
        self.assertEqual([(d["part"], d["state"], d.get("why")) for d in self.drawers(jid)],
                         [(2, "running", None), (3, "running", None), (4, "running", None)])
        self.assertEqual((self.src.ended, len(self.src.rents)), ([], 3))
        self.assertFalse(any(self.b.exists(K2["skip"](k)) for k in (2, 3, 4)))

    def test_a_drawing_log_that_runs_past_midnight(self):
        """The machine's clock is UTC and its lines carry only the time of day: at 00:08 a line written at 23:57:30
        is 10.5 minutes old (past STALL_S + CLOCK_SLACK_S), and the latest line is the last one in the log, not the
        latest time of day."""
        T = 86400 * 20000 + 480                                                  # 00:08:00 UTC
        two = b"23:56:30 DRAW start: share 2/3, workers 5\n23:57:00 DRAW progress (renderer starting)\n" \
              b"23:57:30 DRAW progress 0/54\n"
        three = b"23:57:00 DRAW start: share 3/3, workers 5\n23:57:30 DRAW progress 0/54\n00:06:30 DRAW progress 4/54\n"
        with mock.patch.object(self.J.time, "time", return_value=T):
            log_time = self.J.Studio._log_time
            self.assertEqual(log_time(two.decode(), ("DRAW start", "DRAW progress"), last=True), T - 630)
            self.assertEqual(log_time(three.decode(), ("DRAW start", "DRAW progress"), last=True), T - 90)
            self.assertEqual(log_time(three.decode(), "DRAW start"), T - 660)       # the first, as before
            jid, K = self.film(3, self.running(2, 3, seen=True, started=T - 900))
            self.b.put_bytes(K["dlog"](2), two)
            self.b.put_bytes(K["dlog"](3), three)
            self.s._stat = lambda b, key: T
            self.s._drawers(jid, self.b, K, "PICTURES done\nPART 1 drawn here exit=0 seconds=982")
        got = {d["part"]: (d["state"], d.get("why")) for d in self.drawers(jid)}
        self.assertEqual(got, {2: ("skipped", "stopped drawing"), 3: ("running", None)})

    def test_a_drawing_machine_whose_clock_is_a_little_ahead_at_midnight(self):
        """Its clock a few seconds ahead of ours (2026-10-15 review): a line it wrote at 00:00:05, just after its
        midnight, read at our 23:59:55, is 10 s ahead - not yesterday's, 24 h old - so it has not stopped drawing."""
        now = 86400 * 20000 - 5                                                  # 23:59:55 UTC
        log = "23:50:00 DRAW start: share 3/3, workers 5\n23:59:30 DRAW progress 10/54\n00:00:05 DRAW progress 11/54\n"
        with mock.patch.object(self.J.time, "time", return_value=now):
            self.assertEqual(self.J.Studio._log_time(log, ("DRAW start", "DRAW progress"), last=True), now + 10)
            self.assertEqual(self.J.Studio._log_time(log, "DRAW start"), now - 595)
            self.assertFalse(self.J.Studio._stalled(log, 3, now))

    def test_a_drawer_whose_log_could_not_be_sent_for_a_while_is_left_to_froze(self):
        """Its last progress 10.5 min old in R2, but that copy was sent 4 min ago (its uploads failing, under
        FROZEN_S): judged when it was sent (6.5 min old then, under STALL_S + CLOCK_SLACK_S) it was drawing - left
        alone, as before 2026-10-15; the same log sent just now: it stopped drawing. When R2 cannot say when it was
        sent: looked at again on the next pass."""
        jid, K = self.film(3, self.running(2, 3, seen=True, started=time.time() - 1500))
        for k in (2, 3):
            self.b.put_bytes(K["dlog"](k), self.drawing((1200, f"DRAW start: share {k}/3, workers 5"),
                                                        (660, "DRAW progress 20/54"), (630, "DRAW progress 22/54")))
        log = "PICTURES done\nPART 1 drawn here exit=0 seconds=982"
        self.s._stat = lambda b, key: None
        self.s._drawers(jid, self.b, K, log)
        self.assertEqual([d["state"] for d in self.drawers(jid)], ["running", "running"])
        sent = {K["dlog"](2): 240, K["dlog"](3): 0}                            # seconds ago
        self.s._stat = lambda b, key: time.time() - sent[key]
        self.s._drawers(jid, self.b, K, log)
        got = {d["part"]: (d["state"], d.get("why")) for d in self.drawers(jid)}
        self.assertEqual(got, {2: ("running", None), 3: ("skipped", "stopped drawing")})
        self.assertFalse(self.b.exists(K["skip"](2)))
        self.assertEqual(self.src.ended, ["d3"])
        sent[K["dlog"](2)] = self.J.FROZEN_S + 30                              # its uploads still failing: froze
        self.s._drawers(jid, self.b, K, log)
        self.assertEqual((self.drawers(jid)[0]["why"], self.src.ended), ("froze", ["d3", "d2"]))

    def test_a_drawer_that_says_it_stopped_drawing_is_handled_as_failed(self):
        """The machine's own judgement, by its own clock (owner 2026-10-15): its heartbeat said "PART 3 failed
        (stopped drawing ...)" - handled as any failure at once, though its last progress (6 min old) is too recent
        for the website's own check: a replacement while the planner still draws its own share; the skip mark once
        that share is drawn, so the planner draws share 3 now."""
        drew = self.drawing((900, "DRAW start: share 3/3, workers 5"), (390, "DRAW progress 0/54"),
                            (360, "DRAW progress 3/54"))
        said = drew + self.drawing((30, "PART 3 failed (stopped drawing: no shot drawn for 330 s)"))
        self.assertFalse(self.J.Studio._stalled(drew.decode(), 3, time.time()))     # not the website's own call
        for planner, want in (("PICTURES done\nRENDER start: 160 shots in 3 share(s), workers 5 here", "replaced"),
                              ("PICTURES done\nPART 1 drawn here exit=0 seconds=982", "skipped")):
            with self.subTest(want):
                ended = len(self.src.ended)
                jid, K = self.film(3, self.running(2, 3, seen=True, started=time.time() - 1500))
                self.b.put_bytes(K["dlog"](2), self.drawing((600, "DRAW start: share 2/3, workers 5"),
                                                            (40, "DRAW progress 30/54")))
                self.b.put_bytes(K["dlog"](3), said)
                self.s._stat = lambda b, key: time.time()
                self.s._drawers(jid, self.b, K, planner)
                ds = self.drawers(jid)
                self.assertEqual(self.src.ended[ended:], ["d3"])                  # switched off; share 2 drawing on
                if want == "replaced":
                    self.assertEqual([(d["part"], d["state"], d.get("why")) for d in ds],
                                     [(2, "running", None), (3, "ended", "failed"), (3, "wanted", None)])
                    self.assertEqual(ds[2]["desc"], "replacing a machine that failed")
                    self.assertFalse(self.b.exists(K["skip"](3)))
                else:
                    self.assertEqual([(d["part"], d["state"], d.get("why")) for d in ds],
                                     [(2, "running", None), (3, "skipped", "failed")])
                    self.assertEqual(self.b.get_bytes(K["skip"](3)), b"failed")

    def test_a_healthy_drawer_whose_clock_is_slow_is_not_switched_off_by_the_website(self):
        """The 2026-10-15 review: the website reads the machine's clock against R2's, so on a drawer whose clock is
        4 min slow every line looks 4 min older than it is. Healthy - its count moved 170 s ago, about the longest a
        healthy one goes - it looked 410 s stalled, past STALL_S alone; with CLOCK_SLACK_S it is left drawing. The
        website calls a stall only past STALL_S + CLOCK_SLACK_S."""
        slow = 240
        jid, K = self.film(3, self.running(2, 3, seen=True, started=time.time() - 1500))
        two = self.drawing((1200 + slow, "DRAW start: share 2/3, workers 5"), (290 + slow, "DRAW progress 20/54"),
                           (170 + slow, "DRAW progress 22/54"))
        self.b.put_bytes(K["dlog"](2), two)
        self.b.put_bytes(K["dlog"](3), self.drawing((1200 + slow, "DRAW start: share 3/3, workers 5"),
                                                    (60 + slow, "DRAW progress 40/54")))
        self.s._stat = lambda b, key: time.time()
        self.s._drawers(jid, self.b, K, "PICTURES done\nPART 1 drawn here exit=0 seconds=982")
        self.assertEqual({d["part"]: (d["state"], d.get("why")) for d in self.drawers(jid)},
                         {2: ("running", None), 3: ("running", None)})
        self.assertEqual(self.src.ended, [])
        self.assertFalse(any(self.b.exists(K["skip"](k)) for k in (2, 3)))
        now = time.time()
        looks = now - self.J.Studio._log_time(two.decode(), ("DRAW start", "DRAW progress"), last=True)
        self.assertGreater(looks, self.J.STALL_S)                    # what STALL_S alone called "stopped drawing"
        edge = self.J.STALL_S + self.J.CLOCK_SLACK_S
        for ago, stalled in ((edge - 5, False), (edge + 5, True)):   # the website's own line
            dl = self.drawing((ago + 600, "DRAW start: share 2/3, workers 5"), (ago, "DRAW progress 22/54"),
                              now=now).decode()
            with mock.patch.object(self.J.time, "time", return_value=now):
                self.assertIs(self.J.Studio._stalled(dl, 2, now), stalled, ago)

    def test_the_drawers_are_looked_at_on_every_pass_of_the_watch(self):
        """A stall is acted on within about STALL_S + 2 min only because each drawer's log is read on every pass of
        the watch (20 s), not every BEAT_EVERY_S or CHECK_EVERY_S: five passes with the clock standing still, five
        looks."""
        jid, K = self.film(3)
        self.b.put_bytes(K["log"], b"10:00:00 PLAN start\n10:20:00 PICTURES done\n")
        self.s.store.update(jid, log_tail="10:00:00 PLAN start")
        looks, waits = [], []
        def look(jid_, b, K_, log):
            looks.append(log)
            if len(looks) == 5:
                self.b.put_bytes(K["done"], b'{"ok":true}')
        self.s._drawers, self.s._finish = look, lambda *a: None
        self.s.stop.wait = lambda t=None: waits.append(t)
        with mock.patch.object(self.J.time, "time", return_value=time.time()):
            self.s._watch(jid)
        self.assertEqual(len(looks), 5)
        self.assertTrue(all(w <= 30 for w in waits) and len(waits) == 5, waits)
        # worst case after the last shot drawn: the renderer's count (30 s) + the machine's beat that sees it (30 s) +
        # the beat that says "PART k failed (stopped drawing ...)", the first past STALL_S on the machine's own clock
        # (about 30 s), sending it at once + one pass + the planner's look for the skip mark (15 s) on top of STALL_S -
        # about the 2 minutes the owner allowed
        self.assertLessEqual(30 + 30 + 30 + max(waits) + 15, 2 * 60 + 5)

    def test_a_storage_hiccup_does_not_end_a_working_drawer(self):
        old = time.time() - self.J.START_LIMIT_S - 10
        jid, K = self.film(2, self.running(2, started=old, checked=time.time()))
        get = self.b.get_bytes
        self.b.get_bytes = lambda key: (_ for _ in ()).throw(self.J.S3Error("Storage network request failed"))
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual(self.drawers(jid)[0]["state"], "running")
        self.b.get_bytes = get
        self.b.put_bytes(K["dlog"](2), b"DRAW start")
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.b.delete(K["dlog"](2))                                      # seen once: never "never started"
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual((self.drawers(jid)[0]["state"], self.src.ended), ("running", []))

    def test_a_drawer_that_would_not_switch_off_is_tried_again(self):
        jid, K = self.film(2, self.running(2))
        self.b.put_bytes(K["part"](2), b"tgz")
        self.src.terminate = lambda mid: self.src.ended.append(mid) and False
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual(self.drawers(jid)[0]["state"], "running")
        self.src.terminate = lambda mid: self.src.ended.append(mid) or True
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual((self.drawers(jid)[0]["state"], self.src.ended), ("done", ["d2", "d2"]))

    def test_no_package_sent_switches_every_drawer_off(self):
        jid, K = self.film(3, self.running(2, 3))
        self.s._drawers(jid, self.b, K, "PICTURES done\nPACKAGE upload failed: every share is drawn here")
        self.assertEqual(sorted(self.src.ended), ["d2", "d3"])

    def test_a_skip_mark_that_did_not_save_is_written_later(self):
        jid, K = self.film(2)
        put = self.b.put_bytes
        self.b.put_bytes = lambda *a, **k: (_ for _ in ()).throw(self.J.S3Error("Storage PUT HTTP 503"))
        self.s._drawers(jid, self.b, K, "PART 1 drawn here")
        self.assertEqual((self.drawers(jid)[0]["mark"], self.b.exists(K["skip"](2))), (False, False))
        self.b.put_bytes = put
        self.s._drawers(jid, self.b, K, "PART 1 drawn here")
        self.assertTrue(self.drawers(jid)[0]["mark"] and self.b.exists(K["skip"](2)))

    def test_a_drawer_made_just_before_a_restart_is_picked_up(self):
        jid, K = self.film(3)
        self.src.made["old"] = f"mrtruth-web-{jid}-a1-d2"
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual([(d["part"], d["id"]) for d in self.drawers(jid)], [(2, "old"), (3, "m2")])
        self.assertEqual(len(self.src.rents), 1)

    def test_the_cost_adds_every_machine_and_every_attempt(self):
        now = time.time()
        j = {"pod_hr": 0.13, "pod_started": now - 3600, "cost": json.dumps({"pod_earlier": 0.5}), "drawers": json.dumps([
            {"part": 2, "id": "a", "hr": 0.2, "started": now - 1800, "ended": now - 900},
            {"part": 3, "id": "b", "hr": 0.4, "started": now - 1800, "ended": None},
            {"part": 4, "id": None, "hr": 0, "started": now, "ended": None, "state": "wanted"}])}
        self.assertEqual(self.s._machine_cost(j, now), round(0.5 + 0.13 + 0.05 + 0.2, 2))

    def test_time_left_never_jumps_back_up(self):
        left = self.s._left
        self.assertGreaterEqual(left("PLAN start", 0.7, 10), left("PICTURES done", 0, 10))
        self.assertGreaterEqual(left("PICTURES done", 0, 10), left("PACKAGE uploaded", 0, 10))
        self.assertEqual(left("PACKAGE uploaded", 0, 10), left("PLAN exit", 0, 10))

    def test_the_planner_saves_its_plan_and_can_carry_on_from_one(self):
        S = self.J.PLAN_SCRIPT
        for need in ('if [ -n "${CKPT_GET:-}" ]', '"$CKPT_PUT"', '"$RPKG_GET"', 'PLAN exit=$RC seconds=$((T1-T0)) resumed',
                     '--exclude="$JD/mrtruth/pictures"', '"$PART_PUT_1"', "PART 1 kept from an earlier attempt",
                     'PACKAGE uploaded (kept from'):
            self.assertIn(need, S)
        self.assertLess(S.index("CHECKPOINT saved"), S.index("RENDER start"))

    def test_shares_cover_every_shot_once_and_balance(self):
        import random
        sys.path.insert(0, str(HERE))
        from remote_render import split_parts
        tasks = [{"name": f"s{i:03d}.mp4", "props": {"durationFrames": 60 + 30 * (i % 4)}} for i in range(101)]
        for n in (1, 2, 3, 5):
            parts = split_parts(tasks, n)
            self.assertEqual(len(parts), n)
            names = [t["name"] for p in parts for t in p]
            self.assertEqual(sorted(names), sorted(t["name"] for t in tasks))
            loads = [sum(t["props"]["durationFrames"] for t in p) for p in parts]
            self.assertLessEqual(max(loads) - min(loads), 150)
            for seed in range(5):                                    # every machine splits the same way, whatever
                shuffled = tasks[:]                                  # order its copy of the list is in
                random.Random(seed).shuffle(shuffled)
                self.assertEqual(parts, split_parts(shuffled, n))
        tie = [{"name": n, "props": {"durationFrames": 10}} for n in ("c", "a", "b", "d")]
        self.assertEqual([[t["name"] for t in p] for p in split_parts(tie, 2)], [["a", "c"], ["b", "d"]])

    def test_a_failed_render_process_stops_the_share_at_once(self):
        """remote_render.py with a fake renderer: one process fails fast, the other would take 30 s - the share
        stops in seconds and says so (the website then hands it to the planner)."""
        d = self.d / "pkg"
        (d / "renderer" / "movefast").mkdir(parents=True)
        (d / "renderer" / "node_modules").mkdir()
        shutil.copyfile(HERE / "remote_render.py", d / "remote_render.py")
        (d / "renderer" / "movefast" / "render.mjs").write_text("""
import fs from 'fs';
const req = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const bad = req.tasks.some(t => t.name.startsWith('bad'));
setTimeout(() => { if (bad) { console.error('boom'); process.exit(1); }
  for (const t of req.tasks) fs.writeFileSync(t.output, 'x'); }, bad ? 300 : 30000);
""")
        tasks = [{"name": f"s{i}.mp4", "props": {"durationFrames": 10 + i}} for i in range(4)]
        tasks.append({"name": "bad.mp4", "props": {"durationFrames": 100}})
        (d / "manifest.json").write_text(json.dumps({"tasks": tasks}))
        t0 = time.time()
        r = subprocess.run([sys.executable, str(d / "remote_render.py"), "--workers", "2", "--out", str(d / "o.tgz")],
                           cwd=d, capture_output=True, text=True, timeout=120)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("renderer failed", r.stderr)
        self.assertLess(time.time() - t0, 20)


    def test_the_planner_collects_the_shares(self):
        """The planner's wait for the other machines, run in bash with curl and the drawing faked: share 2 arrives,
        share 3 is marked for it, share 4 never comes and is drawn here once the wait is over."""
        root, r, log = self.collect(skip={3: "no machine"}, parts=(2,))
        self.assertIn("PART 2 received from its machine", log)
        self.assertIn("PART 3 drawing it here (its machine: no machine)", log)
        self.assertIn("PART 4 drawing it here (its machine was late)", log)
        self.assertTrue(log.endswith("DRAWN 3 4"), log)
        self.assertIn(f"SEGS=--segments {root}/seg_1.tgz --segments {root}/seg_2.tgz --segments {root}/seg_3.tgz "
                      f"--segments {root}/seg_4.tgz RR=0", r.stdout)

    def collect(self, skip=(), parts=(), late=(), nosend=False, fail=(), n=4):
        """PLAN_SCRIPT's collection of the shares, run in bash with curl, the clock and the drawing faked. `late`:
        shares that arrive while the planner draws another one; `fail`: shares whose drawing here fails; `n`: the
        film's shares (machines)."""
        a = self.J.PLAN_SCRIPT.index('  SEGS="--segments /root/seg_1.tgz"')
        z = self.J.PLAN_SCRIPT.index('  T2=$(date +%s)')
        root = Path(tempfile.mkdtemp(dir=self.d))
        (root / "r2").mkdir()
        def share(path):
            with tarfile.open(path, "w:gz") as t:
                info = tarfile.TarInfo("a.mp4"); info.size = 1; t.addfile(info, io.BytesIO(b"x"))
        for k in parts:
            share(root / "r2" / f"part{k}")
        for k, why in dict(skip).items():
            (root / "r2" / f"skip{k}").write_text(why)
        share(root / "late.tgz")
        arrive = " ".join(f"cp {root}/late.tgz {root}/r2/part{k};" for k in late)
        body = self.J.PLAN_SCRIPT[a:z].replace("/root/", f"{root}/")
        sh = f"""
set -u
say(){{ echo "$*" >> {root}/log.txt; }}
curl(){{ local out="" url=""; while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; -m) shift 2;; -*) shift;; *) url="$1"; shift;; esac; done
  [ -f "$url" ] || return 22; if [ -n "$out" ]; then cp "$url" "$out"; else cat "$url"; fi; }}
draw(){{ echo "$1" >> {root}/drawn.txt; touch {root}/seg_$1.tgz; {arrive} case " {' '.join(map(str, fail))} " in *" $1 "*) return 1;; esac; }}
sleep(){{ :; }}
NPARTS={n}; RR=0; T_OWN=0; {"NOSEND=1" if nosend else ""}
""" + "".join(f"PART_GET_{k}={root}/r2/part{k}; SKIP_GET_{k}={root}/r2/skip{k}\n" for k in range(2, n + 1)) + f"""
date(){{ if [ -f {root}/clock ]; then echo $(( $(cat {root}/clock) + 1000 )); else command date "$@"; fi; }}
""" + body.replace("PENDING=$LEFT;", f"PENDING=$LEFT; command date +%s > {root}/clock;") + 'echo "SEGS=$SEGS RR=$RR"\n'
        r = subprocess.run(["bash", "-c", sh], text=True, capture_output=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        drawn = (root / "drawn.txt").read_text().split() if (root / "drawn.txt").exists() else []
        return root, r, (root / "log.txt").read_text() + "\nDRAWN " + " ".join(drawn)

    def test_a_share_that_arrives_while_the_planner_draws_another_is_used(self):
        root, r, log = self.collect(skip={2: "failed"}, late=(3, 4))
        self.assertIn("PART 3 received from its machine", log)
        self.assertIn("PART 4 received from its machine", log)
        self.assertTrue(log.endswith("DRAWN 2"), log)

    def test_a_late_share_gets_one_more_look_before_it_is_drawn_here(self):
        root, r, log = self.collect(late=(3, 4))
        self.assertIn("PART 2 drawing it here (its machine was late)", log)
        self.assertIn("PART 3 received from its machine (just in time)", log)
        self.assertIn("PART 4 received from its machine (just in time)", log)
        self.assertTrue(log.endswith("DRAWN 2"), log)

    def test_no_package_sent_draws_every_share_here_and_says_so_first(self):
        root, r, log = self.collect(nosend=True)
        lines = log.splitlines()
        self.assertEqual(lines[:3], [f"PART {k} drawing it here (the package was not sent)" for k in (2, 3, 4)])
        self.assertTrue(log.endswith("DRAWN 2 3 4"), log)

    def test_a_share_that_fails_here_stops_the_wait(self):
        root, r, log = self.collect(skip={2: "failed", 3: "failed", 4: "failed"}, fail=(2,))
        self.assertTrue(log.endswith("DRAWN 2"), log)
        self.assertIn("RR=1", r.stdout)

    def test_the_drawing_script(self):
        S = self.J.DRAW_SCRIPT
        for need in ('"$PKG_GET"', '"$PART_PUT"', "remote_render.py --part \"$PART/$NPARTS\"", "PART $PART failed",
                     "PART $PART uploaded", "waiting for the plan", 'say "PART $PART drawn, sending it"'):
            self.assertIn(need, S)
        self.assertNotIn("K_", S)
        self.assertLess(S.index("DRAW start: share"), S.index("PART $PART drawn, sending it"))
        self.assertLess(S.index("PART $PART drawn, sending it"), S.index('--data-binary @/root/seg.tgz "$PART_PUT"'))
        # drawing is marked from DRAW start until the share is drawn or failed, so the heartbeat looks for a stall
        # only then (by this machine's clock, after $STALL s, the website's STALL_S) - never while it sends the share
        self.assertIn('"${STALL:-300}"', S)
        self.assertLess(S.index('say "DRAW start: share'), S.index("touch /root/.drawing"))
        self.assertLess(S.index("touch /root/.drawing"), S.index("\ndraw1; RR=$?"))
        done = S.rindex("rm -f /root/.drawing")             # the one after the drawing (another clears it at boot)
        self.assertLess(S.index("rm -f /root/.drawing"), S.index("say(){"))     # a mark left from before a restart
        self.assertLess(S.index("one more try after an error"), done)
        self.assertLess(done, S.index('say "PART $PART drawn, sending it"'))
        self.assertLess(done, S.index('say "PART $PART failed (exit'))
        self.assertIn('say(){ echo "$(date -u +%T) $*"', S)                    # its clock read as UTC, as the website does
        r = subprocess.run(["bash", "-n"], input=S, text=True, capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_the_drawing_machine_says_its_progress(self):
        """DRAW_SCRIPT's heartbeat, run in bash with sleep and curl faked: at each beat render.log grows as
        remote_render.py writes it (the renderer prints its count every 30 s, moved or not). A progress line is said
        only when the count moves or another line comes, before the log is sent - and never as a broken line, while
        the main script says its own lines at the same time."""
        S = self.J.DRAW_SCRIPT
        a, z = S.index("say(){"), S.index("\n", S.index("( while true; do sleep 30; progress;"))
        root = Path(tempfile.mkdtemp(dir=self.d))
        beats = [("", None),                                           # not drawing yet: no render.log at all
                 ("installing the renderer's packages (npm ci)...\n", "(renderer starting)"),
                 ("", None),
                 ("\nadded 162 packages in 4s\n20 shot(s) to draw on 80 cores: 5 process(es) x 4 frames\n",
                  "(renderer starting)"),
                 ("  0/20 shots drawn, 30s\n", "0/20"),
                 ("  0/20 shots drawn, 60s\n", None),                     # the count did not move: no progress
                 ("  0/20 shots drawn, 90s\n  2/20 shots drawn, 120s\n", "2/20"),
                 ("  2/20 shots drawn, 150s\n", None),
                 ("  2/20 shots drawn, 180s\n", None),
                 ("  7/20 shots drawn, 210s\n", "7/20"),
                 ("renderer failed: boom\n13 shot(s) to draw on 80 cores: 5 process(es) x 4 frames\n", "7/20"),
                 ("  7/20 shots drawn, 30s\n", None),                     # the second try, not moved yet
                 ("  12/20 shots drawn, 60s\n", "12/20"),
                 ("done in 75s -> /root/seg.tgz (40.1 MB)\n", "12/20")]
        for i, (text, _) in enumerate(beats, 1):
            (root / f"beat_{i}").write_text(text)
        sh = f"""
set -u
N=0
sleep(){{ N=$((N+1)); [ -f {root}/beat_$N ] || exit 0
  [ -s {root}/beat_$N ] && cat {root}/beat_$N >> {root}/render.log; command sleep 0.02; }}
curl(){{ cp {root}/log.txt {root}/sent_$N.txt 2>/dev/null; return 0; }}
""" + S[a:z].replace("/root/", f"{root}/") + """
for i in $(seq 1 150); do say "main line $i" >/dev/null; done
wait
"""
        r = subprocess.run(["bash", "-c", sh], text=True, capture_output=True, timeout=60,
                           env=dict(os.environ, LOG_PUT="x"))
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = (root / "log.txt").read_text().splitlines()
        progress =[ln for ln in lines if " DRAW progress " in ln]
        mains = [ln for ln in lines if " main line " in ln]
        for ln in progress:
            self.assertRegex(ln, r"^\d\d:\d\d:\d\d DRAW progress (\d+/\d+|\(renderer starting\))$")
        for ln in mains:
            self.assertRegex(ln, r"^\d\d:\d\d:\d\d main line \d+$")
        self.assertEqual(len(progress) + len(mains), len(lines))                # nothing broken or mixed
        self.assertEqual([ln.split()[-1] for ln in mains], [str(i) for i in range(1, 151)])
        self.assertEqual([ln.split(" DRAW progress ")[1] for ln in progress], [w for _, w in beats if w])
        for i, (_, said) in enumerate(beats, 1):                       # each beat sends the log with its line in it
            sent = [ln.split(" DRAW progress ")[1] for ln in (root / f"sent_{i}.txt").read_text().splitlines()
                    if " DRAW progress " in ln] if (root / f"sent_{i}.txt").exists() else []
            self.assertEqual(sent, [w for _, w in beats[:i] if w], i)
        self.assertFalse([ln for ln in lines if " failed" in ln])               # never drawing: never judged

    def heartbeat(self, beats, stall="300"):
        """DRAW_SCRIPT's heartbeat run in bash with sleep, curl and the machine's own clock (date +%s) faked, each beat
        30 s on that clock. `beats`: (text the renderer adds to render.log, "+" the main script marks that it draws
        (DRAW start) / "-" it is drawn or failed / ""). Returns the log's lines and the lines each beat sent."""
        S = self.J.DRAW_SCRIPT
        a, z = S.index("say(){"), S.index("\n", S.index("( while true; do sleep 30; progress;"))
        root = Path(tempfile.mkdtemp(dir=self.d))
        for i, (text, mark) in enumerate(beats, 1):
            (root / f"beat_{i}").write_text(text)
            (root / f"mark_{i}").write_text(mark)
        sh = f"""
set -u
N=0
sleep(){{ N=$((N+1)); [ -f {root}/beat_$N ] || exit 0
  [ -s {root}/beat_$N ] && cat {root}/beat_$N >> {root}/render.log
  case "$(cat {root}/mark_$N)" in +) touch {root}/.drawing;; -) rm -f {root}/.drawing;; esac; }}
date(){{ if [ "${{1:-}}" = +%s ]; then echo $((1800000000 + 30 * N)); else command date "$@"; fi; }}
curl(){{ cp {root}/log.txt {root}/sent_$N.txt 2>/dev/null; return 0; }}
""" + S[a:z].replace("/root/", f"{root}/") + "\nwait\n"
        env = {k: v for k, v in os.environ.items() if k != "STALL"}
        env.update(LOG_PUT="x", PART="3", **({"STALL": stall} if stall is not None else {}))
        r = subprocess.run(["bash", "-c", sh], text=True, capture_output=True, timeout=60, env=env)
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = (root / "log.txt").read_text().splitlines() if (root / "log.txt").exists() else []
        sent = [(root / f"sent_{i}.txt").read_text().splitlines() if (root / f"sent_{i}.txt").exists() else []
                for i in range(1, len(beats) + 1)]
        return lines, sent

    def test_the_drawing_machine_judges_a_stall_by_its_own_clock(self):
        """Owner 2026-10-15: the drawing machine itself, by its own clock, says "PART 3 failed (stopped drawing: no
        shot drawn for N s)" once no progress came for over $STALL s while it draws - once only, in the log that very
        beat sends; never before DRAW start or while it sends its share (however long), never while the count moves."""
        count = lambda d, s: (f"  {d}/20 shots drawn, {s}s\n", "")
        starting = [("installing the renderer's packages (npm ci)...\n", ""),
                    ("\nadded 162 packages in 4s\n20 shot(s) to draw on 80 cores: 5 process(es) x 4 frames\n", "")]
        fail = r"^\d\d:\d\d:\d\d PART 3 failed \(stopped drawing: no shot drawn for (\d+) s\)$"
        # a slow but healthy share: 6 min waiting for the plan, drawing (the count moving every 300 s, never more),
        # then 6.5 min sending it
        healthy = ([("", "")] * 12 + [("", "+")] + starting + [count(0, 30)] + [count(0, 60)] * 9 + [count(1, 330)]
                   + [count(1, 360)] * 9 + [count(20, 660)] + [("done in 690s -> /root/seg.tgz (40.1 MB)\n", "-")]
                   + [("", "")] * 13)
        lines, sent = self.heartbeat(healthy)
        self.assertEqual([ln.split(" DRAW progress ")[1] for ln in lines if " DRAW progress " in ln],
                         ["(renderer starting)", "(renderer starting)", "0/20", "1/20", "20/20", "20/20"])
        self.assertFalse([ln for ln in lines if " failed" in ln], lines)
        # a share whose renderer stops after 3 shots: said at the first beat over 300 s after its last progress
        stops = [("", "")] * 2 + [("", "+")] + starting + [count(0, 30), count(3, 60)] + [count(3, 90)] * 23
        for stall, beat, secs in (("300", 18, 330), (None, 18, 330), ("120", 12, 150)):   # None: the default, 300
            with self.subTest(stall=stall):
                lines, sent = self.heartbeat(stops, stall)
                said = [ln for ln in lines if " failed" in ln]
                self.assertEqual(len(said), 1, lines)
                self.assertEqual(int(re.match(fail, said[0]).group(1)), secs)
                self.assertEqual(lines.index(said[0]), len(lines) - 1)        # after every progress line
                self.assertNotIn(said[0], sent[beat - 2])                    # the beat before: not yet
                self.assertEqual(sent[beat - 1][-1], said[0])                # said before that beat sends the log
                self.assertTrue(all(said[0] in s for s in sent[beat - 1:]))
        # drawing begins and the renderer never writes a line: from the moment the mark was first seen
        lines, sent = self.heartbeat([("", "")] * 3 + [("", "+")] + [("", "")] * 14)
        self.assertEqual([int(re.match(fail, ln).group(1)) for ln in lines if " failed" in ln], [330])
        self.assertEqual(lines, [ln for ln in lines if " failed" in ln])      # no progress line at all
        self.assertTrue(sent[14] and not sent[13])                            # beat 15: 11 beats after the mark


class Machines(unittest.TestCase):
    """web/machines.py against faked RunPod and Vast answers: the offers, the order, the limits, renting, a lost
    answer, listing, states, switching off, the balances."""

    def setUp(self):
        import web.machines as M
        self.M = M
        self.src = M.Sources({"RUNPOD_API_KEY": "rk", "VAST_API_KEY": "vk"})
        self.src._bal, self.src._bal_at = {"runpod": {"balance": 50.0, "spend_hr": 0.5},
                                           "vast": {"balance": 20.0, "spend_hr": None}}, time.time()

    @staticmethod
    def resp(status=200, body=None, text=""):
        return mock.Mock(ok=status < 400, status_code=status, text=text or json.dumps(body),
                         json=(lambda: body) if body is not None else mock.Mock(side_effect=ValueError),
                         raise_for_status=(lambda: None) if status < 400 else mock.Mock(side_effect=Exception("http")))

    def vast_offer(self, oid, price, cores=24, cpu="AMD Ryzen 9 5900X 12-Core Processor", geo="Texas, US", up=0.0):
        return {"id": oid, "dph_total": price, "cpu_cores_effective": cores, "cpu_name": cpu, "geolocation": geo,
                "inet_up_cost": up, "inet_down_cost": 0.0, "is_bid": False}

    def test_runpod_offers_cheapest_first_and_errors_are_failures(self):
        def post(url, params=None, json=None, timeout=0):
            self.assertIn("minVcpuCount:16, minMemoryInGb:24", json["query"])
            secure = "secureCloud:true" in json["query"]
            rows = ([{"id": "NVIDIA B", "lowestPrice": {"uninterruptablePrice": 0.25, "stockStatus": "Low"}}] if secure else
                    [{"id": "NVIDIA A", "lowestPrice": {"uninterruptablePrice": 0.13, "stockStatus": "Low"}},
                     {"id": "NVIDIA C", "lowestPrice": {"uninterruptablePrice": 0.05, "stockStatus": "None"}},
                     {"id": "NVIDIA D", "lowestPrice": None}])
            return self.resp(body={"data": {"gpuTypes": rows}})
        with mock.patch.object(self.M.requests, "post", post):
            got = self.src.runpod_offers(16, 24)
        self.assertEqual([(o["gpu"], o["cloud"], o["price"]) for o in got],
                         [("NVIDIA A", "COMMUNITY", 0.13), ("NVIDIA B", "SECURE", 0.25)])
        with mock.patch.object(self.M.requests, "post", lambda *a, **k: self.resp(body={"errors": [{"message": "x"}]})):
            self.assertRaises(ValueError, self.src.runpod_offers, 16, 24)

    def test_vast_offers_keep_good_hosts_and_count_their_traffic(self):
        offers = [self.vast_offer(1, 0.12), self.vast_offer(2, 0.10, cpu="Xeon E5-2697A v4"),
                  self.vast_offer(3, 0.11, geo="Beijing, CN"), self.vast_offer(4, 0.13, up=0.02),
                  self.vast_offer(5, 0.09, up=0.2), dict(self.vast_offer(6, 0.08), is_bid=True),
                  dict(self.vast_offer(7, 0.105), dph_base=0.1, storage_cost=0.54)]   # its disk not counted: 0.13
        seen = {}
        def post(url, json=None, headers=None, timeout=0):
            seen.update(json)
            return self.resp(body={"offers": offers})
        with mock.patch.object(self.M.requests, "post", post):
            got = self.src.vast_offers(16, 32)
        self.assertEqual([(o["offer"], o["price"]) for o in got], [(1, 0.12), (7, 0.13), (4, 0.15)])
        self.assertEqual(got[0]["desc"], "24-core AMD Ryzen 9 5900X, Vast US")
        self.assertEqual((seen["cpu_cores_effective"], seen["cpu_ram"], seen["type"]), ({"gte": 16}, {"gte": 32000}, "ondemand"))
        self.assertTrue(seen["verified"]["eq"] and seen["reliability"]["gte"] >= 0.97)
        self.assertEqual(seen["allocated_storage"], self.M.VAST_DISK_GB)

    def test_offers_merge_the_sources_and_the_backup_comes_after_an_equal(self):
        self.src.runpod_offers = lambda v, r: [{"src": "runpod", "price": 0.13, "desc": "rp"},
                                               {"src": "runpod", "price": 0.48, "desc": "rp48"},
                                               {"src": "runpod", "price": 1.2, "desc": "dear"}]
        self.src.vast_offers = lambda v, r: [{"src": "vast", "price": 0.12, "desc": "va"}]
        self.src.backup_offers = lambda v, r: [{"src": "runpod-cpu", "price": 0.48, "desc": "bk", "backup": True}]
        got, problems = self.src.offers(16, 32, max_hr=1.0)
        self.assertEqual([o["desc"] for o in got], ["va", "rp", "rp48", "bk"])
        self.assertEqual(problems, [])
        self.src.vast_offers = mock.Mock(side_effect=self.M.requests.ConnectionError("down"))
        got, problems = self.src.offers(16, 32, max_hr=1.0, backup=False)
        self.assertEqual([o["desc"] for o in got], ["rp", "rp48"])
        self.assertEqual(problems, ["Vast offers: ConnectionError"])

    def test_without_runpods_price_list_only_the_planner_tries_the_fixed_list(self):
        self.src.runpod_offers = mock.Mock(side_effect=ValueError("down"))
        self.src.vast_offers = lambda v, r: []
        self.src.backup_offers = lambda v, r: []
        self.assertEqual(self.src.offers(16, 32, max_hr=1.0)[0], [])
        got, _ = self.src.offers(16, 32, max_hr=1.5, fallback=True)
        self.assertEqual([o["gpu"] for o in got[:2]], list(self.M.GPUS[:2]))
        self.assertTrue(all(o["price"] is None for o in got))

    def test_a_source_short_of_money_is_left_out(self):
        self.src._bal["vast"] = {"balance": 1.0, "spend_hr": None}
        self.src.runpod_offers = lambda v, r: [{"src": "runpod", "price": 0.2, "desc": "rp"}]
        self.src.vast_offers = mock.Mock(return_value=[{"src": "vast", "price": 0.1, "desc": "va"}])
        self.src.backup_offers = lambda v, r: []
        got, problems = self.src.offers(16, 32)
        self.assertEqual([o["desc"] for o in got], ["rp"])
        self.assertEqual(problems, ["Vast balance too low"])
        self.src.vast_offers.assert_not_called()
        self.src._bal["runpod"] = {"balance": 4.0, "spend_hr": 3.0}                # 4 < 2 h of 3/h
        self.assertFalse(self.src.usable()["runpod"])

    def test_rent_takes_the_cheapest_that_starts_and_keeps_to_the_limit(self):
        self.src.offers = lambda *a, **k: ([{"src": "vast", "price": 0.12, "offer": 7, "vcpu": 24, "desc": "va"},
                                            {"src": "runpod", "price": 0.13, "gpu": "NVIDIA A", "cloud": "COMMUNITY",
                                             "vcpu": 16, "desc": "rp"},
                                            {"src": "runpod-cpu", "price": 0.48, "flavor": "cpu3c", "vcpu": 16,
                                             "desc": "bk", "backup": True}], [])
        calls = []
        def put(url, json=None, headers=None, timeout=0):
            calls.append(("vast", url, json))
            return self.resp(400, {"success": False, "msg": "no longer available"})
        def post(url, json=None, timeout=0, headers=None):
            calls.append(("runpod", url, json))
            return self.resp(body={"id": "p9", "costPerHr": 0.13})
        boots = {}
        with mock.patch.object(self.M.requests, "put", put), mock.patch.object(self.M.requests, "post", post):
            m, tried = self.src.rent("film-a1", {"A": "1"}, "SCRIPT", min_vcpu=16, ram=32, max_hr=1.5,
                                     boot=lambda n, t: boots.setdefault(n, t) and "https://r2/boot")
        self.assertEqual(m["id"], "p9")
        self.assertIn("no longer available", tried[0])
        vast_body = calls[0][2]
        self.assertEqual((vast_body["label"], vast_body["runtype"], vast_body["image"]), ("film-a1", "args", "node:22-bookworm"))
        self.assertIn("'https://r2/boot'", vast_body["args"][2])
        self.assertIn("export A=1\nexport VCPU=24\n", boots["film-a1"])
        self.assertTrue(boots["film-a1"].endswith("SCRIPT"))
        rp = calls[1][2]
        self.assertEqual((rp["gpuTypeIds"], rp["cloudType"], rp["minVCPUPerGPU"], rp["minRAMPerGPU"]),
                         (["NVIDIA A"], "COMMUNITY", 16, 32))
        self.assertEqual(rp["env"], {"A": "1", "VCPU": "16"})                      # no internal settings leak
        self.assertEqual(rp["dockerStartCmd"], ["SCRIPT"])

    def test_the_backup_is_a_processor_only_machine(self):
        self.src.offers = lambda *a, **k: ([{"src": "runpod-cpu", "price": 0.48, "flavor": "cpu3c", "vcpu": 16,
                                             "desc": "16-core processor-only (cpu3c), RunPod secure", "backup": True}], [])
        sent = {}
        def post(url, json=None, timeout=0, headers=None):
            sent.update(json)
            return self.resp(body={"id": "c1", "costPerHr": 0.48})
        with mock.patch.object(self.M.requests, "post", post):
            m, _ = self.src.rent("n", {}, "S", max_hr=1.0)
        self.assertEqual((sent["computeType"], sent["cpuFlavorIds"], sent["vcpuCount"], sent["cloudType"]),
                         ("CPU", ["cpu3c"], 16, "SECURE"))
        self.assertNotIn("gpuTypeIds", sent)
        self.assertEqual(m["desc"], "16-core processor-only (cpu3c), RunPod secure, 16+ CPUs, $0.48/h")

    def test_a_machine_dearer_than_listed_is_given_back(self):
        self.src.offers = lambda *a, **k: ([{"src": "runpod", "price": 0.13, "gpu": "NVIDIA A", "cloud": "COMMUNITY",
                                             "vcpu": 16, "desc": "a"},
                                            {"src": "runpod", "price": 0.5, "gpu": "NVIDIA B", "cloud": "SECURE",
                                             "vcpu": 16, "desc": "b"}], [])
        self.src.terminate = mock.Mock(return_value=True)
        def post(url, json=None, timeout=0, headers=None):
            a = json["gpuTypeIds"] == ["NVIDIA A"]
            return self.resp(body={"id": "pa" if a else "pb", "costPerHr": 2.49 if a else 0.5})
        with mock.patch.object(self.M.requests, "post", post):
            m, _ = self.src.rent("n", {}, "S", max_hr=1.0)
        self.assertEqual(m["id"], "pb")
        self.src.terminate.assert_called_once_with("pa")

    def test_a_lost_answer_is_looked_up_by_name_and_stops_the_renting(self):
        offers = [{"src": "runpod", "price": 0.13, "gpu": "NVIDIA A", "cloud": "COMMUNITY", "vcpu": 16, "desc": "a"},
                  {"src": "runpod", "price": 0.2, "gpu": "NVIDIA B", "cloud": "COMMUNITY", "vcpu": 16, "desc": "b"}]
        self.src.offers = lambda *a, **k: (offers, [])
        tried = []
        def post(url, json=None, timeout=0, headers=None):
            tried.append(json["gpuTypeIds"][0])
            raise self.M.requests.ReadTimeout("slow")
        self.src.list = lambda: [{"id": "made", "name": "n", "hr": 0.13}]
        with mock.patch.object(self.M.requests, "post", post):
            m, _ = self.src.rent("n", {}, "S")
        self.assertEqual((m["id"], tried), ("made", ["NVIDIA A"]))
        self.src.list = lambda: []
        tried.clear()
        with mock.patch.object(self.M.requests, "post", post):
            m, _ = self.src.rent("n", {}, "S")
        self.assertEqual((m, tried), (None, ["NVIDIA A"]))                           # maybe made: no second try
        def connect(url, json=None, timeout=0, headers=None):
            tried.append(json["gpuTypeIds"][0])
            raise self.M.requests.ConnectTimeout("never reached")
        tried.clear()
        with mock.patch.object(self.M.requests, "post", connect):
            self.src.rent("n", {}, "S")
        self.assertEqual(tried, ["NVIDIA A", "NVIDIA B"])                            # never reached: next one

    def test_stop_while_renting_rents_nothing(self):
        self.src.offers = lambda *a, **k: ([{"src": "runpod", "price": 0.1, "gpu": "G", "cloud": "C", "vcpu": 16,
                                             "desc": "a"}], [])
        with mock.patch.object(self.M.requests, "post", mock.Mock()) as post:
            self.assertIsNone(self.src.rent("n", {}, "S", stop=lambda: True)[0])
        post.assert_not_called()

    def test_list_reads_both_accounts_with_vasts_pages(self):
        pages = [{"instances": [{"id": 1, "label": "a", "actual_status": "running", "dph_total": 0.1}], "next_token": "t"},
                 {"instances": [{"id": 2, "label": "b", "actual_status": "exited", "dph_total": 0.2}], "next_token": None}]
        def get(url, params=None, headers=None, timeout=0):
            if "runpod" in url:
                return self.resp(body=[{"id": "p1", "name": "rp", "costPerHr": 0.13, "desiredStatus": "RUNNING"}])
            return self.resp(body=pages.pop(0))
        with mock.patch.object(self.M.requests, "get", get):
            got = self.src.list()
        self.assertEqual([(m["id"], m["name"], m["state"]) for m in got],
                         [("p1", "rp", "running"), ("vast:1", "a", "running"), ("vast:2", "b", "exited")])

    def test_states_and_switching_off(self):
        answers = {"https://console.vast.ai/api/v0/instances/5/": self.resp(body={"instances": {"actual_status": "exited"}}),
                   "https://console.vast.ai/api/v0/instances/6/": self.resp(404, {"error": "not_found"}),
                   "https://rest.runpod.io/v1/pods/p1": self.resp(body={"desiredStatus": "RUNNING"}),
                   "https://rest.runpod.io/v1/pods/p2": self.resp(503, {})}
        with mock.patch.object(self.M.requests, "get", lambda url, **k: answers[url]):
            self.assertEqual([self.src.state(m) for m in ("vast:5", "vast:6", "p1", "p2", "")],
                             ["stopped", "gone", "running", "unknown", "gone"])
        with mock.patch.object(self.M.requests, "delete", lambda url, **k: self.resp(404, {})) as d:
            self.assertTrue(self.src.terminate("vast:6"))

    def test_a_vast_machine_that_could_not_start_is_dead_and_its_computer_passed_over(self):
        self.addCleanup(self.M.AVOID.clear)
        broken = {"actual_status": "created", "cur_state": "stopped", "intended_status": "stopped", "machine_id": 90944,
                  "status_msg": "Error response from daemon: failed to create task for container ... failed to start"}
        starting = {"actual_status": None, "cur_state": "running", "intended_status": "running", "machine_id": 7}
        answers = {"https://console.vast.ai/api/v0/instances/8/": self.resp(body={"instances": broken}),
                   "https://console.vast.ai/api/v0/instances/9/": self.resp(body={"instances": starting})}
        with mock.patch.object(self.M.requests, "get", lambda url, **k: answers[url]):
            self.assertEqual([self.src.state("vast:8"), self.src.state("vast:9")], ["stopped", "starting"])
        self.assertEqual(list(self.M.AVOID), ["90944"])
        offers = [dict(self.vast_offer(1, 0.10), machine_id=90944), dict(self.vast_offer(2, 0.12), machine_id=5)]
        with mock.patch.object(self.M.requests, "post", lambda *a, **k: self.resp(body={"offers": offers})):
            self.assertEqual([o["offer"] for o in self.src.vast_offers(16, 32)], [2])
            self.M.AVOID["90944"] -= self.M.VAST_BAD_HOST_S                   # hours later it is tried again
            self.assertEqual([o["offer"] for o in self.src.vast_offers(16, 32)], [1, 2])

    def test_balances_are_read_once_a_minute(self):
        src = self.M.Sources({"RUNPOD_API_KEY": "rk", "VAST_API_KEY": "vk"})
        calls = []
        def post(url, params=None, json=None, timeout=0):
            calls.append("rp")
            return self.resp(body={"data": {"myself": {"clientBalance": 12.5, "currentSpendPerHr": 0.4}}})
        def get(url, headers=None, timeout=0):
            calls.append("vast")
            return self.resp(body={"credit": 18.2})
        with mock.patch.object(self.M.requests, "post", post), mock.patch.object(self.M.requests, "get", get):
            self.assertEqual(src.balances(), {"runpod": {"balance": 12.5, "spend_hr": 0.4},
                                              "vast": {"balance": 18.2, "spend_hr": None}})
            src.balances()
        self.assertEqual(calls, ["rp", "vast"])


class PlannerSetting(unittest.TestCase):
    """Settings → Planner (owner 2026-10-14): Claude Sonnet by default, or Claude Sonnet through Token Supply on test -
    the setting, the Token Supply key it needs for new films, Token Supply never holding a film up or being asked
    before a machine is rented, only a Token Supply film's planning machine getting its settings, the planner's own
    .env on the machine, the cost split and the pod's summary. All HTTP is faked."""

    def setUp(self):
        from web.jobs import Studio, LocalBucket
        from web.store import Store
        import web.jobs as J
        self.J = J
        self.d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)
        self.s = Studio(Store(self.d / "s.sqlite"), self.d)
        self.b = LocalBucket(self.d / "bucket")
        self.src = FakeSources()
        self.s.bucket = lambda: self.b
        self.s.sources = lambda: self.src
        self.s.package = lambda b: ("mrtruth/pkg/x.tgz", "abc123def456aa")
        self.s.stop.wait = lambda t=None: None
        self.keys = {k: "k-" + k.lower() for k, _, need, _ in J.KEYS if need}
        self.s.keys = lambda: dict(self.keys)
        self.posted, self.real_check = [], J.tokensupply_check   # no film may call Token Supply (or anything else)

        def post(url, **kw):
            self.posted.append(url)
            raise AssertionError(f"a film asked {url}")
        for p in (mock.patch.object(J.VS, "env_for", lambda b, run, mf, keys, log=None: {"RUN_ID": run, "_mine": "m"}),
                  mock.patch.object(J, "claude_credit", lambda key: ""),
                  mock.patch.object(J, "tokensupply_check", side_effect=AssertionError("Token Supply was asked")),
                  mock.patch.object(J.requests, "post", post)):
            p.start()
            self.addCleanup(p.stop)

    def job(self, planner=None, plan_log=""):
        jid = self.s.store.new_job(user="a", title="T", run_on="runpod", minutes=1, seconds=60, planner=planner)
        ins = self.s.folder(jid) / "inputs"
        ins.mkdir(parents=True)
        (ins / "voice.mp3").write_bytes(b"v")
        (ins / "script.txt").write_text("s")
        self.s.store.update(jid, status="starting")

        def finished(name, env):                     # what a planner that finished writes: video, done, its logs
            K = self.s.keys_of(jid, "T", self.s.store.job(jid)["run"])
            self.b.put_bytes(K["video"], b"video")
            self.b.put_bytes(K["done"], json.dumps({"ok": True}).encode())
            self.b.put_bytes(K["result"], self.tgz(plan_log).read_bytes())
        self.src.on_rent = finished
        return jid

    def tgz(self, plan_log):
        buf = self.d / f"r{len(list(self.d.glob('r*.tgz')))}.tgz"
        with tarfile.open(buf, "w:gz") as t:
            info = tarfile.TarInfo("plan.log")
            info.size = len(plan_log.encode())
            t.addfile(info, io.BytesIO(plan_log.encode()))
        return buf

    def made(self, jid):
        self.s._guard(jid, self.s._run)
        j = self.s.store.job(jid)
        self.assertEqual(j["status"], "done", j["error"])
        self.assertEqual(self.posted, [])
        return j

    def test_sonnet_is_the_default_and_the_setting_keeps_to_the_list(self):
        self.assertEqual(self.s.planner(), "sonnet")
        self.s.store.put("planner", "ts")
        self.assertEqual(self.s.planner(), "ts")
        for other in ("mix", "gpt", ""):
            self.s.store.put("planner", other)
            self.assertEqual(self.s.planner(), "sonnet", other)
        self.assertEqual(self.J.PLANNERS, {"sonnet": "Claude Sonnet",
                                           "ts": "Claude Sonnet through Token Supply (cheaper, test)"})
        self.assertEqual(self.J.PLANNER_DEFAULT, "sonnet")

    def test_the_token_supply_key_is_needed_only_for_new_token_supply_films(self):
        row = next(k for k in self.J.KEYS if k[0] == "TOKENSUPPLY_API_KEY")
        self.assertEqual(row, ("TOKENSUPPLY_API_KEY", "Token Supply (the cheaper Claude planner, on test)", False,
                               "token-supply.com → API keys (Anthropic group); only needed when Planner is Claude "
                               "through Token Supply"))
        self.assertEqual(self.s.missing_keys(), [])
        self.s.store.put("planner", "ts")
        self.assertEqual(self.s.missing_keys(), [row[1]])
        self.assertEqual(self.s.missing_keys(made=True), [])      # a film made already is never held up over it
        self.keys["TOKENSUPPLY_API_KEY"] = "ts-key"
        self.assertEqual(self.s.missing_keys(), [])
        claude = next(k[1] for k in self.J.KEYS if k[0] == "ANTHROPIC_API_KEY")
        del self.keys["ANTHROPIC_API_KEY"]                         # Anthropic: the backup and the pages, every mode
        for planner in ("ts", "sonnet"):
            self.s.store.put("planner", planner)
            self.assertEqual(self.s.missing_keys(), [claude], planner)
            self.assertEqual(self.s.missing_keys(made=True), [claude], planner)
        self.assertNotIn("TOKENSUPPLY_API_KEY", self.J.POD_KEYS)   # never given to a Sonnet film's machine

    def test_a_sonnet_film_never_fails_over_the_token_supply_key(self):
        """Planner saved as Token Supply before its key is set: the Sonnet films already waiting (or tried again) are
        made as before - they never use Token Supply."""
        self.s.store.put("planner", "ts")
        for planner in (None, "sonnet"):
            self.src.rents.clear()
            self.made(self.job(planner))
            self.assertFalse({"PLANNER", "K_TOKENSUPPLY_API_KEY"} & set(self.src.rents[0][1]), planner)

    def test_a_sonnet_films_machine_gets_exactly_what_it_got_before(self):
        self.keys["TOKENSUPPLY_API_KEY"] = "ts-key"                # saved, but the film is Sonnet's
        envs = []
        for planner in (None, "sonnet", "ts"):
            self.src.rents.clear()
            self.made(self.job(planner))
            envs.append(self.src.rents[0][1])
            self.assertEqual(self.src.rents[0][2], self.J.PLAN_SCRIPT)
        for env in envs[:2]:
            self.assertFalse({"PLANNER", "K_TOKENSUPPLY_API_KEY"} & set(env))
            self.assertFalse([v for v in env.values() if "ts-key" in str(v)])
            self.assertEqual({k for k in env if k.startswith("K_")}, {"K_" + k for k in self.J.POD_KEYS})
        self.assertEqual(set(envs[0]), set(envs[1]))
        self.assertEqual((set(envs[2]) - set(envs[0]), set(envs[0]) - set(envs[2])),   # a Token Supply film: these
                         ({"PLANNER", "K_TOKENSUPPLY_API_KEY"}, set()))                  # two more, nothing else

    def test_a_token_supply_film_gets_its_settings_and_token_supply_is_never_asked(self):
        self.keys["TOKENSUPPLY_API_KEY"] = "ts-key"
        stages = []
        jid = self.job("ts")
        finished = self.src.on_rent
        self.src.on_rent = lambda name, env: stages.append(self.s.store.job(jid)["stage"]) or finished(name, env)
        self.made(jid)
        self.assertEqual(len(self.src.rents), 1)
        env = self.src.rents[0][1]
        self.assertEqual((env["PLANNER"], env["K_TOKENSUPPLY_API_KEY"]), ("ts", "ts-key"))
        self.assertEqual(env["K_ANTHROPIC_API_KEY"], "k-anthropic_api_key")      # the backup and the pages
        self.assertEqual(stages, ["Renting a machine"])
        self.assertNotIn("Token Supply", (self.d / "studio.log").read_text() if (self.d / "studio.log").exists() else "")

    def test_token_supply_never_holds_a_film_up(self):
        """Owner: a film never stops or waits because of Token Supply. A Token Supply film whose key was cleared after
        it was made (the owner went back to Sonnet) is made at once, Anthropic plans it, and the reason is said on it.
        Nothing is asked of Token Supply (no cost, no delay): a refused key or an empty wallet is found by the machine,
        which turns Token Supply off and plans on Anthropic."""
        self.s.store.put("planner", "sonnet")
        stages = []
        jid = self.job("ts")
        finished = self.src.on_rent
        self.src.on_rent = lambda name, env: stages.append(self.s.store.job(jid)["stage"]) or finished(name, env)
        with mock.patch.object(self.J, "RENT_WAIT_S", 0):                     # a hold would fail the film at once
            self.made(jid)
        self.assertEqual(len(self.src.rents), 1)                                 # rented at once, nothing waited for
        env = self.src.rents[0][1]
        self.assertEqual((env["PLANNER"], env["K_TOKENSUPPLY_API_KEY"]), ("ts", ""))
        self.assertEqual(stages, ["Renting a machine (Token Supply: no Token Supply key in Settings - Anthropic plans "
                                  "in its place)"])
        log = (self.d / "studio.log").read_text()
        self.assertIn(f"[{jid}] Token Supply (the Claude Sonnet through Token Supply planner): no Token Supply key in "
                      f"Settings - the film is made all the same, and Anthropic plans it", log)
        self.assertNotIn("Waiting for", log)

    def test_a_film_carried_on_from_its_saved_plan_keeps_its_planner(self):
        """A replacement machine (or a Try again) of a Token Supply film carries on as one, and says nothing about the
        key: nothing is planned again."""
        for key in ("ts-key", None):
            self.src.rents.clear()
            self.keys.pop("TOKENSUPPLY_API_KEY", None)
            if key:
                self.keys["TOKENSUPPLY_API_KEY"] = key
            jid = self.job("ts")
            with mock.patch.object(self.s, "_plan_run", lambda b, jid_, title, runs, commit: "web-earlier-1"):
                self.made(jid)
            env = self.src.rents[0][1]
            self.assertIn("CKPT_GET", env)
            self.assertEqual((env["PLANNER"], env["K_TOKENSUPPLY_API_KEY"]), ("ts", key or ""))
            self.assertEqual(self.s.store.job(jid)["planner"], "ts")
        self.assertNotIn("Token Supply", (self.d / "studio.log").read_text() if (self.d / "studio.log").exists() else "")

    def test_a_lost_planning_machine_is_replaced_with_the_same_planner(self):
        self.keys["TOKENSUPPLY_API_KEY"] = "ts-key"
        jid = self.job("ts")
        self.s.store.update(jid, status="running", pod_id="p", run="web-y-1",
                            pod_started=time.time() - self.J.START_LIMIT_S - 60)
        self.s._guard(jid, self.s._reattach)                     # never started: back in the queue
        self.assertEqual(self.s.store.job(jid)["status"], "queued")
        self.s.store.update(jid, status="starting")
        self.s.store.put("planner", "sonnet")                    # the setting changed meanwhile
        self.made(jid)
        self.assertEqual(self.src.rents[-1][1]["PLANNER"], "ts")

    def test_drawing_machines_get_no_token_supply_settings(self):
        self.keys["TOKENSUPPLY_API_KEY"] = "ts-key"
        jid = self.s.store.new_job(user="a", title="T", run_on="runpod", minutes=10, seconds=600, planner="ts")
        self.s.store.update(jid, status="running", pod_id="planner", pod_hr=0.13, run="web-r-1",
                            runs=json.dumps([{"run": "web-r-1", "commit": "c", "plan": "web-r-1"}]),
                            pod_started=time.time(), machines=3, drawers="[]")
        self.s._drawers(jid, self.b, self.s.keys_of(jid, "T", "web-r-1"), "10:00:00 PLAN start\n10:20:00 PICTURES done")
        self.assertEqual(len(self.src.rents), 2)
        for name, env, script, kw in self.src.rents:
            self.assertIs(script, self.J.DRAW_SCRIPT)
            self.assertFalse(any(k.startswith("K_") or k == "PLANNER" for k in env), env)
            self.assertFalse([v for v in env.values() if "ts-key" in str(v)])
        self.assertNotIn("TOKENSUPPLY", self.J.DRAW_SCRIPT)

    def test_the_two_claude_parts_add_up_to_the_claude_line_to_the_cent(self):
        """Review 2026-10-14: rounded each on its own, Anthropic's part and Token Supply's came to a cent less (or more)
        than the Claude line's own total."""
        for total, ts in (("1.2051", "0.3049"), ("1.2049", "0.3051"), ("2.3456", "0.1234")):
            c = self.s.costs(self.tgz(f"  Claude this run: Claude: 30 calls, 300k in / 90k out = ${total} — x\n"
                                      f"  Token Supply this run: ${ts} of it, 25 calls; 0 call(s) went to Anthropic "
                                      f"instead\n"))
            self.assertEqual(round(c["claude"] + c["token_supply"], 2), round(float(total), 2), (total, ts))
            self.assertEqual(c["token_supply"], round(float(ts), 2))
        self.assertEqual(self.s.costs(self.tgz("  Claude this run: Claude: 17 calls, 170k in / 56k out = $0.8952 — "
                                               "claude-sonnet-5\n")), {"claude": 0.9})    # a Sonnet film: as before

    def test_saving_the_planner_keeps_what_is_typed_in_settings(self):
        """Review 2026-10-14: the Planner's Save reloaded the page's Settings (boot -> go -> loadSettings), and a Token
        Supply key typed but not yet saved was gone. It now only redraws the missing-keys banner."""
        page = (HERE / "web" / "static" / "index.html").read_text(encoding="utf-8")
        save = next(l for l in page.splitlines() if l.startswith("$('#savePlanner').onclick"))
        self.assertIn("banner(await api('/api/me'))", save)
        for reloads in ("boot()", "go(", "loadSettings("):
            self.assertNotIn(reloads, save)
        boot = page[page.index("async function boot(){"):page.index("$('#loginForm')")]
        self.assertIn("banner(d);", boot)                                   # the banner as it was, drawn by boot too
        self.assertIn("Before the first film, add the keys in", page[page.index("function banner(d){"):
                                                                       page.index("async function boot(){")])

    def test_the_cost_shows_token_supply_and_the_total_counts_it_once(self):
        log = ("  Claude this run: Claude: 30 calls, 300k in / 90k out = $0.4000 — claude-sonnet-5 100k in / 30k out, "
               "claude-sonnet-5 (Token Supply) 200k in / 60k out\n"
               "  Token Supply this run: $0.0600 of it, 25 calls; 2 call(s) went to Anthropic instead (tokensupply po "
               "245s: HTTP 500: Internal server error; tokensupply po 251s: HTTP 500: Internal server error)\n"
               "  Gemini photo picks: 438 (1698k in, 83k out, 0k thinking = $1.50), 0 handed to Claude\n")
        self.keys["TOKENSUPPLY_API_KEY"] = "ts-key"
        j = self.made(self.job("ts", log))
        cost = json.loads(j["cost"])
        self.assertEqual((cost["claude"], cost["token_supply"], cost["gemini"]), (0.34, 0.06, 1.5))
        self.assertAlmostEqual(cost["total"], round(cost["pod"] + 0.34 + 0.06 + 1.5, 2))
        self.assertNotIn("token_supply_off", cost)
        sonnet = self.s.costs(self.tgz("  Claude this run: Claude: 17 calls, 170k in / 56k out = $0.8942 — "
                                       "claude-sonnet-5\n"))
        self.assertEqual(sonnet, {"claude": 0.89})                                # a Sonnet film's cost as before
        page = (HERE / "web" / "static" / "index.html").read_text(encoding="utf-8")
        self.assertIn("['Token Supply',c.token_supply]", page)

    def test_a_token_supply_film_planned_by_anthropic_says_so(self):
        """The machine turned Token Supply off (its planner line, mrtruth): the film's line says Anthropic planned in
        its place, instead of the film being held or failed."""
        # the lines as make_video and mrtruth write them (a refused key: Token Supply off after its first refusal)
        off = 'tokensupply HTTP 401: {"error":"unauthorized"}'
        line = ("    planner (ts): Token Supply answered 3 of 41 Claude calls; asked again on Token Supply: none; handed "
                f"to Anthropic: research dossier 1; highlighted pages: Anthropic; Token Supply turned off: {off}\n")
        log = line + ("  Claude this run: Claude: 41 calls, 300k in / 90k out = $1.2000 — x\n"
                      f"  Token Supply this run: $0.0100 of it, 3 calls; 38 call(s) went to Anthropic instead ({off}); "
                      f"Token Supply turned off: {off}\n")
        j = self.made(self.job("ts", log))
        cost = json.loads(j["cost"])
        self.assertEqual(cost["token_supply_off"], off)
        self.assertEqual((cost["claude"], cost["token_supply"]), (1.19, 0.01))
        self.assertAlmostEqual(cost["total"], round(cost["pod"] + 1.19 + 0.01, 2))   # a note, never counted as money
        for other in ("    planner (ts): Token Supply answered 41 of 41 Claude calls; asked again on Token Supply: "
                      "templates 1; handed to Anthropic: none; highlighted pages: Anthropic\n",
                      "  planner (mix): shots x6 (OpenRouter off: HTTP 401)\n", ""):
            self.assertNotIn("token_supply_off", self.s.costs(self.tgz(other)))
        only = self.s.costs(self.tgz(                            # no planner line (planning stopped early): the
            "  Token Supply this run: $0.0100 of it, 3 calls; 2 call(s) went to Anthropic instead (tokensupply po "  # bill's
            f"245s: HTTP 500: Internal server error; {off}); Token Supply turned off: {off}\n"))              # line says
        self.assertEqual((only["token_supply"], only["token_supply_off"]), (0.01, off))
        page = (HERE / "web" / "static" / "index.html").read_text(encoding="utf-8")
        self.assertIn("j.planner==='ts' ? 'planner: Claude through Token Supply (test)' + (c.token_supply_off ? ' - "
                      "Token Supply was off ('+c.token_supply_off+'): Anthropic planned in its place' : '') : ''", page)
        self.assertIn('id="planner"', page)
        self.assertIn("planner:$('#planner').value", page)

    def test_the_machine_writes_the_planner_into_its_env_only_for_token_supply(self):
        """PLAN_SCRIPT's .env lines, run in bash: a Sonnet film's .env is byte for byte what the live version (e8ef33b)
        wrote; a Token Supply film's says CLAUDE_PROVIDER=tokensupply on the one CLAUDE_PROVIDER line (never two:
        run_test.py reads .env without override and make_video.py with it), Anthropic as the fallback, and the key."""
        script = self.J.PLAN_SCRIPT
        a = script.index("\nCP=anthropic\n")
        new = script[a:script.index("\nseed_verdicts\n", a)]
        old = subprocess.run(["git", "-C", str(HERE), "show", "e8ef33b:web/jobs.py"], capture_output=True, text=True)
        if old.returncode != 0:
            self.skipTest("e8ef33b is not in this copy's git history")
        a = old.stdout.index('{ echo "GEMINI_API_KEY=')
        old = old.stdout[a:old.stdout.index("chmod 600 .env", a) + len("chmod 600 .env")]
        keys = {f"K_{k}": f"v-{k}" for k in self.J.POD_KEYS}

        def written(block, **env):
            with tempfile.TemporaryDirectory() as d:
                r = subprocess.run(["bash", "-c", "set -u\nsay(){ echo \"$*\" >> said.txt; }\n" + block], cwd=d,
                                   env=dict(keys, PATH=os.environ["PATH"], **env), capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stderr)
                said = (Path(d) / "said.txt").read_text() if (Path(d) / "said.txt").exists() else ""
                return (Path(d) / ".env").read_text(), oct((Path(d) / ".env").stat().st_mode & 0o777), said
        then = written(old)
        self.assertEqual(then[0].count("CLAUDE_PROVIDER=anthropic\n"), 1)
        self.assertEqual(written(new), then)                                 # Sonnet: as before, nothing said
        self.assertEqual(written(new, PLANNER="sonnet"), then)
        self.assertEqual(written(new, PLANNER="mix", K_TOKENSUPPLY_API_KEY="ts-key"), then)   # not a planner here
        ts, mode, said = written(new, PLANNER="ts", K_TOKENSUPPLY_API_KEY="ts-key")
        self.assertEqual(mode, "0o600")
        self.assertEqual(ts, then[0].replace("CLAUDE_PROVIDER=anthropic\n", "CLAUDE_PROVIDER=tokensupply\n")
                         + "CLAUDE_FALLBACK=anthropic\nTOKENSUPPLY_API_KEY=ts-key\n")
        self.assertEqual(ts.count("CLAUDE_PROVIDER="), 1)
        self.assertEqual(said, "planner: Claude Sonnet through Token Supply (on test)\n")
        from dotenv import dotenv_values
        got = dotenv_values(stream=io.StringIO(ts))
        self.assertEqual((got["CLAUDE_PROVIDER"], got["CLAUDE_FALLBACK"], got["TOKENSUPPLY_API_KEY"],
                          got["SCRIPT_PROVIDER"], got["ANTHROPIC_API_KEY"]),
                         ("tokensupply", "anthropic", "ts-key", "anthropic", "v-ANTHROPIC_API_KEY"))
        nokey, _, said = written(new, PLANNER="ts")                           # no key: Anthropic plans, said so
        self.assertIn("CLAUDE_PROVIDER=tokensupply\n", nokey)
        self.assertTrue(nokey.endswith("TOKENSUPPLY_API_KEY=\n"))
        self.assertEqual(said, "planner: Claude Sonnet through Token Supply (on test) - no Token Supply key in "
                               "Settings: Anthropic plans in its place\n")
        r = subprocess.run(["bash", "-n"], input=script, text=True, capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_the_token_supply_check(self):
        """Settings → Test keys' one-token call (about $0.0002), faked: what each answer means."""
        def post(status=200, boom=False):
            def f(url, **kw):
                self.assertEqual(url, "https://api.token-supply.com/v1/messages")
                self.assertEqual(kw["headers"], {"x-api-key": "k", "Authorization": "Bearer k",
                                                 "anthropic-version": "2023-06-01", "content-type": "application/json"})
                self.assertEqual(kw["json"], {"model": "claude-sonnet-5", "max_tokens": 1,
                                              "messages": [{"role": "user", "content": "ok"}]})
                if boom:
                    raise self.J.requests.ConnectionError("down")
                return mock.Mock(ok=status < 400, status_code=status, text="{}")
            return mock.patch.object(self.J.requests, "post", f)
        check = self.real_check                                 # the real one (setUp forbids it for films)
        with post(200):
            self.assertEqual(check("k"), "")
        with post(401):
            self.assertEqual(check("k"), "the Token Supply key was refused (HTTP 401) - check it in Settings")
        with post(403):
            self.assertIn("refused (HTTP 403)", check("k"))
        with post(402):
            self.assertIn("out of credit (HTTP 402)", check("k"))
        with post(404):
            self.assertIn("(HTTP 404)", check("k"))
        with post(500):
            self.assertEqual(check("k"), "HTTP 500")
        with post(boom=True):
            self.assertEqual(check("k"), "Token Supply could not be reached (ConnectionError)")
        self.assertEqual(check(""), "no Token Supply key in Settings")

    def test_the_pods_summary_copies_the_planner(self):
        """web/pod/summarize.py: the planner detail (timing.json) and the planner, Claude and Token Supply lines."""
        work = self.d / "work"
        work.mkdir()
        (work / "shots.json").write_text("[]")
        # mrtruth._ts_record / _ts_line and make_video's two spend lines, as they write them
        detail = {"planner": "ts", "ts_calls": 38, "anthropic_calls": 3, "reasked": {"templates": 1},
                  "handed": {"research dossier": 1}, "fell_back": 1, "off": "",
                  "why": ["templates: stops at 66% of the script", "research dossier: no JSON in it"]}
        (work / "timing.json").write_text(json.dumps({"plan": 12.5, "detail": {"planner": detail}}))
        lines = ["    planner (ts): Token Supply answered 38 of 41 Claude calls; asked again on Token Supply: "
                 "templates 1; handed to Anthropic: research dossier 1; highlighted pages: Anthropic",
                 "  Claude this run: Claude: 41 calls, 300k in / 90k out = $0.5000 — x",
                 "  Token Supply this run: $0.1200 of it, 38 calls; 1 call(s) went to Anthropic instead (tokensupply "
                 "po 245s: HTTP 500: Internal server error)"]
        (self.d / "plan.log").write_text("\n".join(["  other line"] + lines) + "\n")
        r = subprocess.run([sys.executable, str(HERE / "web" / "pod" / "summarize.py"), str(work),
                            str(self.d / "plan.log"), str(self.d / "summary.json")], cwd=self.d,
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        got = json.loads((self.d / "summary.json").read_text())
        self.assertEqual(got["planner"], detail)
        self.assertEqual((got["planner_line"], got["claude_line"], got["token_supply_line"]),
                         (lines[0].strip(), lines[1].strip(), lines[2].strip()))

    def test_the_farm_pod_keeps_the_token_supply_planner_only_when_the_env_chooses_it(self):
        """farm/config.py (the farm CLI's pods): POD_FORCED plans on Anthropic as before; a .env that chooses Token
        Supply (with its key) keeps it on the pod, with Anthropic as the fallback."""
        from farm import config as FC
        base = {"WAVESPEED_API_KEY": "w", "ANTHROPIC_API_KEY": "a"}
        for env, want in (({}, ("anthropic", "", None)),
                          ({"CLAUDE_PROVIDER": "claudecode", "TOKENSUPPLY_API_KEY": "t"}, ("anthropic", "", "t")),
                          ({"CLAUDE_PROVIDER": "tokensupply"}, ("anthropic", "", None)),       # no key: as before
                          ({"CLAUDE_PROVIDER": "tokensupply", "TOKENSUPPLY_API_KEY": "t", "CLAUDE_FALLBACK": "kie"},
                           ("tokensupply", "anthropic", "t"))):
            with mock.patch.dict(os.environ, dict(base, **env)):
                for k in ("CLAUDE_PROVIDER", "TOKENSUPPLY_API_KEY", "CLAUDE_FALLBACK"):
                    if k not in env:
                        os.environ.pop(k, None)
                got = FC.Config().pod_env("jobs/x.json")
            self.assertEqual((got["CLAUDE_PROVIDER"], got["CLAUDE_FALLBACK"], got.get("TOKENSUPPLY_API_KEY")), want, env)
            self.assertEqual(got["SCRIPT_PROVIDER"], "anthropic")
        self.assertIn("TOKENSUPPLY_API_KEY", FC.RENDER_KEYS)
        self.assertEqual(FC.POD_FORCED["CLAUDE_PROVIDER"], "anthropic")


if __name__ == "__main__":
    unittest.main()
