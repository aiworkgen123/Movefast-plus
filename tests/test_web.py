"""The website (web/): sign-in, a film from upload to finished video in test mode (no machine, no cost), the guards,
the settings, the package and the cost read-back.
    python -m unittest tests/test_web.py"""
import importlib
import io
import json
import os
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

    def client(self, who=None):
        c = self.A.app.test_client()
        if who:
            r = c.post("/api/login", json={"name": who, "password": {"owner1": "a long password",
                                                                     "maria": "another password"}[who]})
            self.assertEqual(r.status_code, 200, r.json)
        return c

    def new(self, c, **over):
        data = {"title": "The Passage", "run_on": "fake", "music_level": "quiet",
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
        self.assertEqual((j["status"], j["user"], j["minutes"], j["music_db"], j["music_name"]),
                         ("queued", "maria", 1, -22.0, "song.mp3"))
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
        self.assertIsNone(j["music_db"])
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


class Parts(unittest.TestCase):
    def test_costs_read_from_the_film_log(self):
        from web.jobs import Studio
        d = Path(tempfile.mkdtemp())
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
        for need in ('"$VOICE_URL"', '"$SCRIPT_URL"', 'MRTRUTH_MUSIC=', 'MRTRUTH_MUSIC_DB=', '"$VID_PUT"',
                     'run_test.py "$JS" "$JV" "$JT" "$JM" --export', "--segments /root/segments.tgz", "seed_verdicts"):
            self.assertIn(need, J.POD_SCRIPT)
        r = subprocess.run(["bash", "-n"], input=J.POD_SCRIPT, text=True, capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
