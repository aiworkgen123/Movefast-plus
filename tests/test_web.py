"""The website (web/): sign-in, a film from upload to finished video in test mode (no machine, no cost), the guards,
the settings, the package and the cost read-back.
    python -m unittest tests/test_web.py"""
import importlib
import io
import json
import os
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
        return {"id": mid, "hr": self.hr, "desc": f"test machine, ${self.hr}/h"}, []

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
        self.s.missing_keys = lambda: []
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
        self.assertIs(script, self.J.DRAW_SCRIPT)
        self.assertFalse(any(k.startswith("K_") for k in env))                   # a drawer gets no keys
        self.assertIn(K["rpkg"], env["PKG_GET"])
        self.assertEqual([(d["part"], d["state"]) for d in self.drawers(jid)], [(2, "running"), (3, "running")])
        self.s._drawers(jid, self.b, K, "PICTURES done\nPACKAGE uploaded")      # never rented twice
        self.assertEqual(len(self.src.rents), 2)
        self.assertFalse(self.s.renting)                                         # every name given back

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

    def collect(self, skip=(), parts=(), late=(), nosend=False, fail=()):
        """PLAN_SCRIPT's collection of the shares, run in bash with curl, the clock and the drawing faked. `late`:
        shares that arrive while the planner draws another one; `fail`: shares whose drawing here fails."""
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
NPARTS=4; RR=0; T_OWN=0; {"NOSEND=1" if nosend else ""}
""" + "".join(f"PART_GET_{k}={root}/r2/part{k}; SKIP_GET_{k}={root}/r2/skip{k}\n" for k in (2, 3, 4)) + f"""
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
        for need in ('"$PKG_GET"', '"$PART_PUT"', "remote_render.py --part \"$PART/$NPARTS\"", "PART $PART failed",
                     "PART $PART uploaded", "waiting for the plan"):
            self.assertIn(need, self.J.DRAW_SCRIPT)
        self.assertNotIn("K_", self.J.DRAW_SCRIPT)
        r = subprocess.run(["bash", "-n"], input=self.J.DRAW_SCRIPT, text=True, capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)


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
                  self.vast_offer(5, 0.09, up=0.2), dict(self.vast_offer(6, 0.08), is_bid=True)]
        seen = {}
        def post(url, json=None, headers=None, timeout=0):
            seen.update(json)
            return self.resp(body={"offers": offers})
        with mock.patch.object(self.M.requests, "post", post):
            got = self.src.vast_offers(16, 32)
        self.assertEqual([(o["offer"], o["price"]) for o in got], [(1, 0.12), (4, 0.15)])
        self.assertEqual(got[0]["desc"], "24-core AMD Ryzen 9 5900X, Vast US")
        self.assertEqual((seen["cpu_cores_effective"], seen["cpu_ram"], seen["type"]), ({"gte": 16}, {"gte": 32000}, "ondemand"))
        self.assertTrue(seen["verified"]["eq"] and seen["reliability"]["gte"] >= 0.97)

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


if __name__ == "__main__":
    unittest.main()
