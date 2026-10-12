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


class Fixes(unittest.TestCase):
    """The review of 2026-10-12: Try again, Stop while renting, a late read-back, sign-ins ending with a new password."""

    def setUp(self):
        from web.jobs import Studio, LocalBucket
        from web.store import Store
        self.d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)
        self.s = Studio(Store(self.d / "s.sqlite"), self.d)
        self.b = LocalBucket(self.d / "bucket")
        self.s.bucket = lambda: self.b
        self.s.missing_keys = lambda: []
        self.s.keys = lambda: {"RUNPOD_API_KEY": "k"}
        self.s.package = lambda b: ("mrtruth/pkg/x.tgz", "abc123def456")
        self.rented, self.ended = [], []
        self.s._terminate = lambda pid: self.ended.append(pid) or True
        self.s._pod_exists = lambda pid: True
        self.s._pods = lambda api: []
        self.s.stop.wait = lambda t=None: None
        import web.jobs as J
        self.J = J
        self.vs = mock.patch.object(J.VS, "env_for", lambda b, run, mf, keys, log=None: {"RUN_ID": run, "_mine": "m"})
        self.vs.start()
        self.addCleanup(self.vs.stop)

    def job(self):
        jid = self.s.store.new_job(user="a", title="T", run_on="runpod", minutes=1, seconds=60)
        ins = self.s.folder(jid) / "inputs"
        ins.mkdir(parents=True)
        (ins / "voice.mp3").write_bytes(b"v")
        (ins / "script.txt").write_text("s")
        self.s.store.update(jid, status="starting")
        return jid

    def rent(self, pod_writes=None):
        def fake(api, name, env, script=None, stop=lambda: False, **kw):
            if stop():
                return None, ""
            pid = f"pod{len(self.rented) + 1}"
            self.rented.append(pid)
            if pod_writes:
                pod_writes(self.s.store.job(name[len(self.J.POD_PREFIX):]))
            return {"id": pid, "costPerHr": 0.89}, "test"
        self.s._rent = fake

    def test_try_again_never_reads_the_earlier_attempts_answer(self):
        jid = self.job()
        def failed_pod(j):
            K = self.s.keys_of(jid, "T", j["run"])
            self.b.put_bytes(K["done"], b'{"ok":false,"why":"planning error: credit"}')
        self.rent(failed_pod)
        self.s._guard(jid, self.s._run)
        self.assertIn("credit", self.s.store.job(jid)["error"])
        self.s.store.update(jid, status="starting", pod_id=None, error=None)
        time.sleep(1.1)                                      # a new attempt name (seconds)
        def good_pod(j):
            K = self.s.keys_of(jid, "T", j["run"])
            self.b.put_bytes(K["video"], b"video")
            self.b.put_bytes(K["done"], b'{"ok":true}')
        self.rent(good_pod)
        self.s._guard(jid, self.s._run)
        j = self.s.store.job(jid)
        self.assertEqual((j["status"], j["error"]), ("done", None))

    def test_stop_while_renting_switches_the_new_pod_off(self):
        jid = self.job()
        self.rent(lambda j: self.s.store.update(jid, status="cancelling"))   # Stop pressed during the rent
        self.s._guard(jid, self.s._run)
        self.assertEqual(self.s.store.job(jid)["status"], "cancelled")
        self.assertEqual(self.ended, ["pod1"])

    def test_a_film_done_while_the_site_was_down_past_its_limit_is_read_back(self):
        jid = self.job()
        run = "web-x-1"
        K = self.s.keys_of(jid, "T", run)
        self.b.put_bytes(K["video"], b"video")
        self.b.put_bytes(K["done"], b'{"ok":true}')
        self.s.store.update(jid, status="running", pod_id="p", run=run, pod_started=time.time() - 10 * 3600)
        self.s._guard(jid, self.s._reattach)
        self.assertEqual(self.s.store.job(jid)["status"], "done")

    def test_a_pod_that_never_logs_is_switched_off(self):
        jid = self.job()
        self.s.store.update(jid, status="running", pod_id="p", run="web-y-1",
                            pod_started=time.time() - self.J.START_LIMIT_S - 60)
        self.s._guard(jid, self.s._reattach)
        j = self.s.store.job(jid)
        self.assertEqual(j["status"], "failed")
        self.assertIn("never started", j["error"])
        self.assertEqual(self.ended, ["p"])


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
    """A film on several small machines (2026-10-12): the shares, the price list, the drawing machines, the cost."""

    def setUp(self):
        from web.jobs import Studio, LocalBucket
        from web.store import Store
        import web.jobs as J
        self.J = J
        self.d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)
        self.s = Studio(Store(self.d / "s.sqlite"), self.d)
        self.b = LocalBucket(self.d / "bucket")
        self.s.bucket = lambda: self.b
        self.s.keys = lambda: {"RUNPOD_API_KEY": "k"}
        self.ended, self.rents, self.pods = [], [], []
        self.s._terminate = lambda pid: self.ended.append(pid) or True
        self.s._pod_exists = lambda pid: True
        self.s._pods = lambda api: self.pods

    def film(self, n=3, drawers=None):
        jid = self.s.store.new_job(user="a", title="T", run_on="runpod", minutes=10, seconds=600)
        self.s.store.update(jid, status="running", pod_id="planner", pod_hr=0.13, run="web-r-1",
                            pod_started=time.time(), machines=n, drawers=json.dumps(drawers or []))
        return jid, self.s.keys_of(jid, "T", "web-r-1")

    def fake_rent(self, ok=True):
        def rent(api, name, env, script=None, stop=lambda: False, **kw):
            self.rents.append((name, env, script, kw))
            if not ok:
                return None, ""
            return {"id": f"d{len(self.rents)}", "costPerHr": 0.2}, "RTX 3070, community, 16+ CPUs, $0.20/h"
        self.s._rent = rent

    def drawers(self, jid):
        return json.loads(self.s.store.job(jid)["drawers"])

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

    def test_the_price_list_is_read_cheapest_first(self):
        def post(url, params=None, json=None, timeout=0):
            secure = "secureCloud:true" in json["query"]
            self.assertIn("minVcpuCount:16", json["query"])
            self.assertIn("minMemoryInGb:24", json["query"])
            self.assertEqual(params, {"api_key": "k"})
            rows = ([{"id": "B", "lowestPrice": {"uninterruptablePrice": 0.25, "stockStatus": "Low"}}] if secure else
                    [{"id": "A", "lowestPrice": {"uninterruptablePrice": 0.13, "stockStatus": "Low"}},
                     {"id": "C", "lowestPrice": {"uninterruptablePrice": 0.05, "stockStatus": None}},
                     {"id": "D", "lowestPrice": None}])
            return mock.Mock(raise_for_status=lambda: None, json=lambda: {"data": {"gpuTypes": rows}})
        with mock.patch.object(self.J.requests, "post", post):
            self.assertEqual(self.s._offers("k", 16, 24), [(0.13, "A", "COMMUNITY"), (0.25, "B", "SECURE")])

    def test_renting_takes_the_cheapest_that_starts_and_keeps_to_the_limit(self):
        self.s._offers = lambda api, vcpu, ram=32: [(0.13, "NVIDIA A", "COMMUNITY"), (0.5, "NVIDIA B", "SECURE"),
                                                    (1.5, "NVIDIA C", "COMMUNITY")]
        tried = []
        def post(url, json=None, timeout=0, headers=None):
            tried.append((json["gpuTypeIds"][0], json["minVCPUPerGPU"], json["env"]["VCPU"]))
            ok = json["gpuTypeIds"][0] == "NVIDIA B"
            return mock.Mock(ok=ok, json=lambda: {"id": "p1", "costPerHr": 0.5})
        with mock.patch.object(self.J.requests, "post", post):
            pod, desc = self.s._rent("k", "n", {}, "script", min_vcpu=16)
            self.assertEqual(pod["id"], "p1")
            self.assertEqual(desc, "B, secure, 16+ CPUs, $0.50/h")
            self.assertEqual(tried, [("NVIDIA A", 16, "16"), ("NVIDIA B", 16, "16")])
            tried.clear()
            pod, _ = self.s._rent("k", "n", {}, "script", min_vcpu=32, max_hr=0.4)
            self.assertIsNone(pod)
            self.assertEqual(tried, [("NVIDIA A", 32, "32")])                  # never the dearer ones
            tried.clear()
            self.assertIsNone(self.s._rent("k", "n", {}, "s", stop=lambda: True)[0])
            self.assertEqual(tried, [])

    def test_a_machine_dearer_than_listed_is_given_back(self):
        self.s._offers = lambda api, vcpu, ram=32: [(0.13, "NVIDIA A", "COMMUNITY"), (0.5, "NVIDIA B", "SECURE")]
        def post(url, json=None, timeout=0, headers=None):
            a = json["gpuTypeIds"][0] == "NVIDIA A"
            return mock.Mock(ok=True, json=lambda: {"id": "pa" if a else "pb", "costPerHr": 2.49 if a else 0.5})
        with mock.patch.object(self.J.requests, "post", post):
            pod, _ = self.s._rent("k", "n", {}, "s", max_hr=1.0)
        self.assertEqual((pod["id"], self.ended), ("pb", ["pa"]))

    def test_the_planner_has_a_price_limit_too(self):
        jid = self.s.store.new_job(user="a", title="T", run_on="runpod", minutes=10, seconds=600)
        ins = self.s.folder(jid) / "inputs"
        ins.mkdir(parents=True)
        (ins / "voice.mp3").write_bytes(b"v")
        (ins / "script.txt").write_text("s")
        self.s.store.update(jid, status="starting")
        self.s.missing_keys = lambda: []
        self.s.package = lambda b: ("mrtruth/pkg/x.tgz", "abc123def456")
        self.fake_rent(ok=False)
        with mock.patch.object(self.J.VS, "env_for", lambda b, run, mf, keys, log=None: {}):
            self.s._guard(jid, self.s._run)
        name, env, script, kw = self.rents[0]
        self.assertEqual((kw["max_hr"], kw["min_vcpu"], kw["fallback"]), (self.J.PLANNER_MAX_HR, 16, True))
        self.assertIn("no machine free under $1.50/h", self.s.store.job(jid)["error"])

    def test_without_a_price_list_a_drawer_is_not_rented(self):
        def broken(*a, **k):
            raise self.J.requests.ConnectionError("down")
        self.s._offers = broken
        tried = []
        def post(url, json=None, timeout=0, headers=None):
            tried.append(json["gpuTypeIds"][0])
            return mock.Mock(ok=len(tried) == 2, json=lambda: {"id": "p", "costPerHr": 0.3})
        with mock.patch.object(self.J.requests, "post", post):
            self.assertIsNone(self.s._rent("k", "n", {}, "s", max_hr=1.0)[0])
            self.assertEqual(tried, [])
            pod, _ = self.s._rent("k", "n", {}, "s", max_hr=1.5, fallback=True)   # the planner: the fixed list
            self.assertEqual(pod["id"], "p")
            self.assertEqual(tried, list(self.J.GPUS[:2]))

    def test_drawers_are_rented_when_the_pictures_are_chosen(self):
        jid, K = self.film(3)
        self.fake_rent()
        self.s._drawers(jid, self.b, K, "10:00:00 PLAN start")
        self.assertEqual(self.rents, [])
        self.s._drawers(jid, self.b, K, "10:00:00 PLAN start\n10:20:00 PICTURES done")
        self.assertEqual([r[0] for r in self.rents], [f"mrtruth-web-{jid}-d2", f"mrtruth-web-{jid}-d3"])
        name, env, script, kw = self.rents[0]
        self.assertEqual((env["PART"], env["NPARTS"], kw["max_hr"]), ("2", "3", self.J.DRAWER_MAX_HR))
        self.assertIs(script, self.J.DRAW_SCRIPT)
        self.assertFalse(any(k.startswith("K_") for k in env))                   # a drawer gets no keys
        self.assertEqual([(d["part"], d["state"]) for d in self.drawers(jid)], [(2, "running"), (3, "running")])
        self.s._drawers(jid, self.b, K, "PICTURES done\nPACKAGE uploaded")      # never rented twice
        self.assertEqual(len(self.rents), 2)

    def test_a_drawer_that_finishes_fails_or_is_taken_over_is_switched_off(self):
        now = time.time()
        ds = [{"part": k, "id": f"d{k}", "hr": 0.2, "desc": "x", "started": now, "ended": None, "state": "running"}
              for k in (2, 3, 4)]
        jid, K = self.film(4, ds)
        self.b.put_bytes(K["part"](2), b"tgz")                                   # share 2 arrived
        self.b.put_bytes(K["dlog"](3), b"10:30 PART 3 failed (exit 1): renderer failed")
        self.s._drawers(jid, self.b, K, "PICTURES done\nPART 4 drawing it here (its machine was late)")
        got = {d["part"]: (d["state"], d["why"]) for d in self.drawers(jid)}
        self.assertEqual(got, {2: ("done", "done"), 3: ("skipped", "failed"), 4: ("done", "taken over")})
        self.assertEqual(sorted(self.ended), ["d2", "d3", "d4"])
        self.assertTrue(self.b.exists(K["skip"](3)))                             # the planner draws share 3
        self.assertFalse(self.b.exists(K["skip"](2)))

    def test_a_drawer_that_never_starts_or_vanishes_gets_a_skip_mark(self):
        old = time.time() - self.J.START_LIMIT_S - 10
        ds = [{"part": 2, "id": "d2", "hr": 0.2, "desc": "x", "started": old, "ended": None, "state": "running"},
              {"part": 3, "id": "d3", "hr": 0.2, "desc": "x", "started": time.time() - 400, "ended": None,
               "state": "running"}]
        jid, K = self.film(3, ds)
        self.b.put_bytes(K["dlog"](3), b"apt ok, waiting for the plan")
        self.s._pod_exists = lambda pid: pid != "d3"
        self.s._drawers(jid, self.b, K, "PICTURES done")
        got = {d["part"]: d["why"] for d in self.drawers(jid)}
        self.assertEqual(got, {2: "never started", 3: "vanished"})
        self.assertEqual(self.b.get_bytes(K["skip"](2)), b"never started")

    def test_no_machine_free_or_too_late_means_the_planner_draws_it(self):
        jid, K = self.film(3)
        self.fake_rent(ok=False)
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertTrue(self.b.exists(K["skip"](2)) and self.b.exists(K["skip"](3)))
        self.assertEqual({d["state"] for d in self.drawers(jid)}, {"skipped"})
        jid, K = self.film(3)
        self.fake_rent()
        self.rents.clear()
        self.s._drawers(jid, self.b, K, "PICTURES done\nPACKAGE uploaded\nPART 1 drawn here exit=0 seconds=500")
        self.assertEqual(self.rents, [])
        self.assertTrue(self.b.exists(K["skip"](2)) and self.b.exists(K["skip"](3)))

    def test_no_drawers_when_planning_failed(self):
        jid, K = self.film(3)
        self.fake_rent()
        self.s._drawers(jid, self.b, K, "PICTURES done\nPLAN exit=1 seconds=900")
        self.assertEqual((self.rents, self.drawers(jid)), ([], []))

    def test_a_restart_mid_rent_rents_only_the_missing_shares(self):
        ds = [{"part": 2, "id": "d2", "hr": 0.2, "desc": "x", "started": time.time(), "ended": None,
               "state": "running"}]
        jid, K = self.film(3, ds)
        self.fake_rent()
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual([r[0] for r in self.rents], [f"mrtruth-web-{jid}-d3"])

    def test_the_cost_adds_every_machine(self):
        now = time.time()
        j = {"pod_hr": 0.13, "pod_started": now - 3600, "drawers": json.dumps([
            {"part": 2, "hr": 0.2, "started": now - 1800, "ended": now - 900},
            {"part": 3, "hr": 0.4, "started": now - 1800, "ended": None},
            {"part": 4, "hr": 0, "started": now, "ended": now}])}
        self.assertEqual(self.s._machine_cost(j, now), round(0.13 + 0.05 + 0.2, 2))

    def test_the_sweep_keeps_only_what_a_running_film_counts_on(self):
        jid, K = self.film(4, [{"part": 2, "id": "d2", "hr": 0.2, "started": 0, "ended": None, "state": "running"},
                               {"part": 3, "id": None, "hr": 0, "started": 0, "ended": 0, "state": "skipped"}])
        base = f"mrtruth-web-{jid}"
        self.pods = [{"id": "planner", "name": base}, {"id": "d2", "name": base + "-d2"},
                     {"id": "d4", "name": base + "-d4"},             # share 4: being rented right now
                     {"id": "ghost", "name": base},                  # a create whose answer was lost
                     {"id": "ghost2", "name": base + "-d2"}, {"id": "ghost3", "name": base + "-d3"},
                     {"id": "3", "name": "mrtruth-web-250101-dead00"}, {"id": "4", "name": "mrtruth-web-250101-dead00-d2"},
                     {"id": "5", "name": "someone-elses-pod"}, {"id": "6", "name": base + "x"}]
        self.assertEqual(sorted(self.s.sweep()), ["3", "4", "6", "ghost", "ghost2", "ghost3"])
        jid2, _ = self.film(3)
        self.s.store.update(jid2, status="starting", pod_id=None)       # its planner is being rented
        self.pods = [{"id": "new", "name": f"mrtruth-web-{jid2}"}]
        self.assertEqual(self.s.sweep(), [])
        self.s.store.update(jid2, status="queued")                      # Try again pressed: an old one is left over
        self.assertEqual(self.s.sweep(), ["new"])

    def test_end_machines_switches_off_the_planner_and_every_drawer(self):
        now = time.time()
        jid, K = self.film(3, [
            {"part": 2, "id": "d2", "hr": 0.2, "started": now, "ended": None, "state": "running"},
            {"part": 3, "id": "d3", "hr": 0.2, "started": now, "ended": now, "state": "done"}])
        self.pods = [{"id": "orphan", "name": f"mrtruth-web-{jid}-d3"}]
        self.assertTrue(self.s._end_machines(jid))
        self.assertEqual(self.ended, ["planner", "d2", "orphan"])
        self.assertEqual([d["state"] for d in self.drawers(jid)], ["ended", "done"])

    def test_a_create_whose_answer_is_lost_is_picked_up_not_rented_twice(self):
        self.s._offers = lambda api, vcpu, ram=32: [(0.13, "NVIDIA A", "COMMUNITY"), (0.5, "NVIDIA B", "SECURE")]
        tried = []
        def post(url, json=None, timeout=0, headers=None):
            tried.append(json["gpuTypeIds"][0])
            self.pods = [{"id": "made", "name": json["name"], "costPerHr": 0.13}]
            raise self.J.requests.ReadTimeout("slow")
        with mock.patch.object(self.J.requests, "post", post):
            pod, desc = self.s._rent("k", "mrtruth-web-x", {}, "s")
        self.assertEqual((pod["id"], tried), ("made", ["NVIDIA A"]))
        self.assertIn("$0.13/h", desc)

    def test_a_lost_answer_with_no_pod_to_show_stops_the_renting(self):
        self.s._offers = lambda api, vcpu, ram=32: [(0.13, "NVIDIA A", "COMMUNITY"), (0.5, "NVIDIA B", "SECURE")]
        tried = []
        def post(url, json=None, timeout=0, headers=None):
            tried.append(json["gpuTypeIds"][0])
            raise (self.J.requests.ConnectTimeout if len(tried) == 1 else self.J.requests.ReadTimeout)("slow")
        with mock.patch.object(self.J.requests, "post", post):
            self.assertIsNone(self.s._rent("k", "n", {}, "s")[0])
        self.assertEqual(tried, ["NVIDIA A", "NVIDIA B"])          # never reached: next; maybe made: stop

    def test_a_skip_mark_that_did_not_save_is_written_later(self):
        jid, K = self.film(2)
        self.fake_rent(ok=False)
        put = self.b.put_bytes
        self.b.put_bytes = lambda *a, **k: (_ for _ in ()).throw(self.J.S3Error("Storage PUT HTTP 503"))
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual((self.drawers(jid)[0]["mark"], self.b.exists(K["skip"](2))), (False, False))
        self.b.put_bytes = put
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertTrue(self.drawers(jid)[0]["mark"] and self.b.exists(K["skip"](2)))

    def test_a_restart_after_a_drawer_was_made_picks_it_up(self):
        jid, K = self.film(3)
        self.fake_rent()
        self.pods = [{"id": "made2", "name": f"mrtruth-web-{jid}-d2", "costPerHr": 0.18}]
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual([r[0] for r in self.rents], [f"mrtruth-web-{jid}-d3"])
        self.assertEqual([(d["part"], d["id"]) for d in self.drawers(jid)], [(2, "made2"), (3, "d1")])

    def test_a_storage_hiccup_does_not_end_a_working_drawer(self):
        old = time.time() - self.J.START_LIMIT_S - 10
        jid, K = self.film(3, [{"part": 2, "id": "d2", "hr": 0.2, "desc": "x", "started": old, "ended": None,
                                "state": "running", "checked": time.time()}])
        get = self.b.get_bytes
        self.b.get_bytes = lambda key: (_ for _ in ()).throw(self.J.S3Error("Storage network request failed"))
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual(self.drawers(jid)[0]["state"], "running")
        self.b.get_bytes = get
        self.b.put_bytes(K["dlog"](2), b"DRAW start")
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.b.delete(K["dlog"](2))                                      # seen once: never "never started"
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual((self.drawers(jid)[0]["state"], self.ended), ("running", []))

    def test_a_drawer_that_would_not_switch_off_is_tried_again(self):
        jid, K = self.film(2, [{"part": 2, "id": "d2", "hr": 0.2, "desc": "x", "started": time.time(),
                                "ended": None, "state": "running"}])
        self.b.put_bytes(K["part"](2), b"tgz")
        self.s._terminate = lambda pid: self.ended.append(pid) and False
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual(self.drawers(jid)[0]["state"], "running")
        self.s._terminate = lambda pid: self.ended.append(pid) or True
        self.s._drawers(jid, self.b, K, "PICTURES done")
        self.assertEqual((self.drawers(jid)[0]["state"], self.ended), ("done", ["d2", "d2"]))

    def test_no_package_sent_switches_every_drawer_off(self):
        now = time.time()
        jid, K = self.film(3, [{"part": k, "id": f"d{k}", "hr": 0.2, "desc": "x", "started": now, "ended": None,
                                "state": "running"} for k in (2, 3)])
        self.s._drawers(jid, self.b, K, "PICTURES done\nPACKAGE upload failed: every share is drawn here")
        self.assertEqual(sorted(self.ended), ["d2", "d3"])

    def test_a_failed_film_drops_its_parts(self):
        jid, K = self.film(3)
        self.b.put_bytes(K["rpkg"], b"pkg")
        self.b.put_bytes(K["part"](2), b"tgz")
        def boom(jid):
            raise RuntimeError("the machine stopped unexpectedly")
        self.s._guard(jid, boom)
        self.assertFalse(self.b.exists(K["rpkg"]) or self.b.exists(K["part"](2)))
        self.assertEqual(self.s.store.job(jid)["status"], "failed")

    def test_time_left_never_jumps_back_up(self):
        left = self.s._left
        self.assertGreaterEqual(left("PLAN start", 0.7, 10), left("PICTURES done", 0, 10))
        self.assertGreaterEqual(left("PICTURES done", 0, 10), left("PACKAGE uploaded", 0, 10))
        self.assertEqual(left("PACKAGE uploaded", 0, 10), left("PLAN exit", 0, 10))

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


if __name__ == "__main__":
    unittest.main()
