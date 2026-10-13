"""Mr Truth A0 fixes (2026-10-10), synthetic data only — no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_a0 -v
"""
import io
import json
import os
import re
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import mrtruth as M  # noqa: E402

WORDS = ("amber basin cedar delta ember fable garnet harbor island juniper kettle lantern meadow nectar orchard pebble "
         "quarry raven saddle timber umber valley willow yonder zephyr").split()


def srt_text(cues):
    ts = lambda ms: f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    return "\n\n".join(f"{k + 1}\n{ts(a)} --> {ts(b)}\n{t}" for k, (a, b, t) in enumerate(cues)) + "\n"


def parse_srt(text):
    out = []
    for blk in re.split(r"\n\s*\n", text.strip()):
        m = re.search(r"(\d\d):(\d\d):(\d\d)[,.](\d+)\s*-->\s*(\d\d):(\d\d):(\d\d)[,.](\d+)", blk)
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        a = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        b = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        t = " ".join(l for l in blk.splitlines() if "-->" not in l and not l.strip().isdigit()).strip()
        out.append((a, b, t))
    return out


def jpeg(path, w, h, shade=90):
    from PIL import Image
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (w, h), (shade, shade // 2, shade // 3)).save(path, "JPEG", quality=80)
    return Path(path)


class Engine:
    SCRIPT_MODEL = UTILITY_MODEL = "stub"
    STYLE_INFO = {}

    def __init__(self, answer=None):
        self.lines, self.calls, self.answer = [], [], answer
        self._lock = threading.Lock()

    def log(self, s):
        self.lines.append(s)

    _parse_srt_full = staticmethod(parse_srt)

    def claude(self, prompt, model, max_tokens=0):
        with self._lock:
            self.calls.append(prompt)
        if self.answer is None:
            raise RuntimeError("no Claude in a unit test")
        return self.answer(prompt)


class WholeWords(unittest.TestCase):
    def test_cut_at_a_word(self):
        self.assertEqual(M._whole_words("The Grand Northern Archive Library", 24), "The Grand Northern")
        self.assertEqual(M._whole_words("A Short Kicker", 24), "A Short Kicker")          # fits: unchanged
        self.assertEqual(M._whole_words("Keeper of the Northern Seal", 13), "Keeper")       # never ends on 'of'
        self.assertEqual(M._whole_words("Extraordinarilylongword here", 10), "")
        for text in ("The Grand Northern Archive Library", "One two three four five six seven eight", "Alpha, beta: gamma"):
            for n in range(1, 40):
                cut = M._whole_words(text, n)
                self.assertLessEqual(len(cut), n)
                self.assertTrue(text.startswith(cut) or text.replace(",", "").startswith(cut.replace(",", "")))
                self.assertTrue(not cut or text[len(cut):len(cut) + 1] in ("", " ", ",", ":"), (text, n, cut))


class BeatsGuard(unittest.TestCase):
    def test_a_part_whose_first_line_starts_late_is_not_asked_again(self):
        # one subtitle line every 2 s, except a pause so that the part from 120 s opens on a line at 121.7 s
        cues, t, k = [], 0, 0
        while t < 250000:
            if 118000 <= t < 121700:
                t = 121700
            cues.append((t, t + 1900, " ".join(WORDS[(k + j) % len(WORDS)] for j in range(4)) + "."))
            t += 2000
            k += 1
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            (job / "mrtruth").mkdir()
            (job / "subs.srt").write_text(srt_text(cues))

            def answer(prompt):
                sc = [{"startMs": int(a), "visualIntent": "x", "queries": ["x", "y", "z"], "entities": [], "mood": "",
                       "sceneType": "imagery"} for a, b in re.findall(r"^> \[(\d+)-(\d+)\]", prompt, re.M)]
                return json.dumps({"scenes": sc})
            e = Engine(answer)
            rows = M.beats(e, job, job / "subs.srt", " ".join(c[2] for c in cues), {})
        self.assertEqual(len(e.calls), 3, [l for l in e.lines if "asking again" in l])   # parts 0, 120, 240: once each
        self.assertFalse([l for l in e.lines if "asking again" in l])
        self.assertEqual(rows[0]["startMs"], 0)


def film_rows(n=20, secs=3.0, years=()):
    cues, rows = [], []
    for i in range(n):
        a, b = int(i * secs * 1000), int((i + 1) * secs * 1000)
        text = " ".join(WORDS[(i * 3 + j) % len(WORDS)] for j in range(6)) + (" in 1947" if i in years else "")
        cues.append((a, b, text))
        rows.append({"startMs": a, "endMs": b, "text": text, "device": None, "queries": ["", "", ""], "entities": []})
    return rows, cues


class OpeningAndGallery(unittest.TestCase):
    def test_first_shot_takes_only_the_title(self):
        rows, _ = film_rows()
        rows[0]["endMs"] = 6000
        self.assertTrue(M._can(rows, 0, "P03"))
        for tid in ("gallery-strip", "P12", "P22", "framed-card", "top-title"):
            self.assertFalse(M._can(rows, 0, tid, ignore_len=True), tid)

    def test_planned_gallery_goes_to_the_shot_that_ends_the_hook(self):
        rows, cues = film_rows(years=(0, 1))
        script = " ".join(c[2] for c in cues)
        hook_char = len(" ".join(c[2] for c in cues[:10])) + 1                   # the first word of shot 10 (30 s)
        dossier = {"sections": [{"title": "Opening Words", "startChar": 0}, {"title": "Part Two", "startChar": hook_char}],
                   "setting": "The Grand Northern Archive Library, Elsewhere"}
        opps = [{"templateId": "gallery-strip", "startChar": 0},
                {"templateId": "P03", "startChar": 0, "headline": "Never Said Here", "kicker": "Nowhere At All"}]
        e = Engine()
        M.assign(e, rows, opps, script, cues, dossier, "A Test Film")
        dev = lambda r: (r.get("device") or {}).get("id")
        self.assertEqual(dev(rows[0]), "P03")
        # a whole part of the setting, never a name cut at whole words ("The Grand Northern" of "The Grand Northern
        # Archive Library", 34 letters, is the name cut the six test films opened on, 2026-10-13)
        self.assertEqual(rows[0]["device"]["kicker"], "Elsewhere")
        gal = [k for k, r in enumerate(rows) if dev(r) == "gallery-strip"]
        self.assertEqual(len(gal), 1)
        g = rows[gal[0]]
        self.assertEqual(g["endMs"], 30000)                                         # it ends the hook
        self.assertGreaterEqual(g["endMs"] - g["startMs"], 4500)
        self.assertEqual(dev(rows[1]), "P12")              # the year on shot 1 is not blocked by a covered P12 on shot 0
        summary = next(l for l in e.lines if l.startswith("  templates:"))
        self.assertIn("gallery-strip×1", summary)
        self.assertIn("P03×1", summary)
        self.assertNotIn("P12×2", summary)

    def test_the_opening_kicker_is_read_against_the_first_words_said(self):
        # (review 2026-10-13) the kicker was read against the setting only, the gate reads it against the narration:
        # 'Morvane' of a setting 'Morvane, Elsewhere' where the narrator says 'the Morvane Tessick' was flagged and kept
        rows, cues = film_rows()
        cues[0] = (cues[0][0], cues[0][1], "Near the Morvane Tessick the keepers met.")
        rows[0]["text"] = cues[0][2]
        M.assign(Engine(), rows, [], " ".join(c[2] for c in cues), cues, {"setting": "Morvane, Elsewhere"}, "A Test Film")
        self.assertEqual(rows[0]["device"]["kicker"], "Morvane Tessick")


class ChapterHeadings(unittest.TestCase):
    def headings(self, answer, sections):
        rows, _ = film_rows(n=60)
        with tempfile.TemporaryDirectory() as d:
            M.fill_overlays(Engine(lambda p: json.dumps(answer)), Path(d), rows, "s", {"sections": sections},
                            lambda *a: None)
        return [r["device"]["heading"] for r in rows if (r.get("device") or {}).get("id") == "chapter-plate"]

    def test_planner_headings_are_cut_at_a_word(self):
        got = self.headings({"chapters": [{"shot": 12, "heading": "The Northern Archive Remembers Everything"},
                                          {"shot": 40, "heading": "Quiet"}], "overlays": []}, [])
        self.assertEqual(got[0], "The Northern Archive")                       # was 'The Northern Archive Reme'
        self.assertEqual(got[1], "Quiet")

    def test_filled_headings_are_cut_at_a_word(self):
        got = self.headings({"chapters": [], "overlays": []},
                            [{"title": "x"}, {"title": "Keepers Unwritten Northern Ledgers"},
                             {"title": "Second Movement"}])
        # its head noun kept, a modifier dropped (2026-10-13; a cut at whole words, "Keepers Unwritten", lost it)
        self.assertEqual(got, ["Keepers Unwritten Ledgers", "Second Movement"])  # was 'Keepers Unwritten Norther'

    def test_a_heading_starts_with_a_capital(self):
        # (review 2026-10-13) a sentence-case section title less its article went on screen as 'glorpwick's narrow
        # vantle'; a heading Claude writes in lower case starts with a capital too
        got = self.headings({"chapters": [], "overlays": []},
                            [{"title": "x"}, {"title": "The glorpwick's narrow vantle"}, {"title": "a zemblar of quorts"}])
        self.assertEqual(got, ["Glorpwick's narrow vantle", "A zemblar of quorts"])
        got = self.headings({"chapters": [{"shot": 12, "heading": "the zemblar's long vantle"}], "overlays": []}, [])
        self.assertEqual(got[0], "The zemblar's long vantle")

    def test_a_filled_heading_keeps_what_it_was_made_from(self):
        # (review 2026-10-13, round 4) the gate reads a heading only against what it was made from: a shortened
        # section title filled in keeps it, as a planner's heading does
        rows, _ = film_rows(n=60)
        with tempfile.TemporaryDirectory() as d:
            M.fill_overlays(Engine(lambda p: json.dumps({"chapters": [], "overlays": []})), Path(d), rows, "s",
                            {"sections": [{"title": "x"}, {"title": "Keepers Unwritten Northern Ledgers"},
                                          {"title": "Second Movement"}]}, lambda *a: None)
        made = {r["device"]["heading"]: r.get("_cut_from") for r in rows
                if (r.get("device") or {}).get("id") == "chapter-plate"}
        self.assertEqual(made, {"Keepers Unwritten Ledgers": "Keepers Unwritten Northern Ledgers", "Second Movement": None})


class Caches(unittest.TestCase):
    def test_visual_plan_failures_are_never_saved(self):
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            out = job / "mrtruth" / "templates.json"
            self.assertEqual(M.opportunities(Engine(), job, "a script"), [])           # Claude down
            self.assertFalse(out.exists())
            self.assertEqual(M.opportunities(Engine(lambda p: '{"opportunities": []}'), job, "a script"), [])
            self.assertFalse(out.exists())                                          # empty: not saved either
            e = Engine(lambda p: '{"opportunities": [{"templateId": "P02", "startChar": 5}]}')
            self.assertEqual(len(M.opportunities(e, job, "a script")), 1)
            self.assertEqual(len(M.opportunities(e, job, "a script")), 1)
            self.assertEqual(len(e.calls), 1)                                       # cached
            M.opportunities(e, job, "a changed script")
            self.assertEqual(len(e.calls), 2)                                       # a changed brief asks again
            out.write_text(json.dumps([{"templateId": "P08", "startChar": 9}]))   # saved before answers had keys
            self.assertEqual(M.opportunities(e, job, "a script")[0]["templateId"], "P08")
            self.assertEqual(len(e.calls), 2)
            self.assertIn("key", json.loads(out.read_text()))
            out.write_text("[]")                                                    # an old poisoned save
            M.opportunities(e, job, "a script")
            self.assertEqual(len(e.calls), 3)

    def test_archive_names_ask_again_only_the_part_that_failed(self):
        rows = [{"text": f"shot {i} " + WORDS[i % len(WORDS)], "queries": ["q"], "entities": []} for i in range(130)]
        down = {"part": 60}

        def answer(prompt):
            idx = [int(x) for x in re.findall(r'<shot index="(\d+)">', prompt)]
            if idx[0] == down["part"]:
                raise RuntimeError("Claude busy")
            return json.dumps({"names": [{"index": i, "name": f"Name {i}"} for i in idx]})
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            e = Engine(answer)
            M.archive_names(e, job, rows, {})
            self.assertEqual(rows[5]["archive"], "Name 5")
            self.assertEqual(rows[65]["archive"], "")
            self.assertTrue(any("1 of 3 part(s) unanswered" in l for l in e.lines), e.lines)
            down["part"] = -1
            e2 = Engine(answer)
            M.archive_names(e2, job, rows, {})
            self.assertEqual(len(e2.calls), 1)                                      # only the failed part
            self.assertIn('<shot index="60">', e2.calls[0])
            self.assertEqual(rows[65]["archive"], "Name 65")
            e3 = Engine(answer)
            M.archive_names(e3, job, rows, {})
            self.assertEqual(e3.calls, [])                                          # complete: nothing asked


def task(name, frames):
    return {"id": "Segment", "name": name, "props": {"scene": {"durationFrames": frames}}}


class RenderSplit(unittest.TestCase):
    FRAMES = [300, 311, 38, 90, 120, 75, 64, 210, 180, 45, 99, 88, 150, 66, 72, 81, 240, 57, 130, 101, 95, 60, 77, 140]

    def test_longest_first_balances_and_keeps_every_shot(self):
        import remote_render as R
        todo = [task(f"{k:04d}.mp4", f) for k, f in enumerate(self.FRAMES)]
        parts = M._balanced(todo, 4)
        load = [sum(M._frames_of(t) for t in p) for p in parts]
        rr = [sum(t["props"]["scene"]["durationFrames"] for t in todo[k::4]) for k in range(4)]
        self.assertLess(max(load) - min(load), max(rr) - min(rr))
        self.assertLessEqual(max(load), max(rr))
        self.assertEqual(sorted(t["name"] for p in parts for t in p), sorted(t["name"] for t in todo))
        for p in parts:
            self.assertEqual([M._frames_of(t) for t in p], sorted((M._frames_of(t) for t in p), reverse=True))
        self.assertEqual([[t["name"] for t in p] for p in parts], [[t["name"] for t in p] for p in R.balanced(todo, 4)])
        self.assertEqual(M._balanced(todo, 4), M._balanced(list(todo), 4))           # deterministic

    def test_render_builds_the_bundle_on_the_shortest_shot(self):
        seen = []

        def run(cmd, **kw):
            seen.append([Path(t["output"]).name for t in json.loads(Path(cmd[2]).read_text())["tasks"]])
            return mock.Mock(returncode=0, stdout="", stderr="")
        with tempfile.TemporaryDirectory() as d, mock.patch.object(M.subprocess, "run", run):
            work = Path(d)
            tasks = [dict(task(f"{k:04d}.mp4", f), output=str(work / f"{k:04d}.mp4")) for k, f in enumerate(self.FRAMES)]
            M.render(Engine(), work, tasks, workers=3)
        self.assertEqual(seen[0], ["0002.mp4"])                                      # 38 frames: the shortest
        rest = [n for part in seen[1:] for n in part]
        self.assertEqual(sorted(rest + seen[0]), sorted(f"{k:04d}.mp4" for k in range(len(self.FRAMES))))
        self.assertEqual(len(seen), 4)

    def test_remote_render_same_split(self):
        import remote_render as R
        seen = []

        class Popen:                                  # each render process (remote_render keeps them to stop them)
            def __init__(self, cmd, **kw):
                seen.append([t["name"] for t in json.loads(Path(cmd[2]).read_text())["tasks"]])
                self.returncode, self.pid = 0, 0

            def communicate(self):
                return "", ""

            def poll(self):
                return 0
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "renderer" / "node_modules").mkdir(parents=True)
            (root / "manifest.json").write_text(json.dumps({"tasks": [task(f"{k:04d}.mp4", f) for k, f in enumerate(self.FRAMES)]}))
            with mock.patch.object(R, "HERE", root), mock.patch.object(R.subprocess, "Popen", Popen), \
                    mock.patch.object(R.shutil, "which", lambda n: "/usr/bin/node"), \
                    mock.patch.object(sys, "argv", ["remote_render.py", "--workers", "3", "--out", str(root / "s.tgz")]):
                R.main()
        self.assertEqual(seen[0], ["0002.mp4"])
        self.assertEqual(sorted(n for p in seen for n in p), sorted(f"{k:04d}.mp4" for k in range(len(self.FRAMES))))


class Downscale(unittest.TestCase):
    def test_fit_px(self):
        from PIL import Image
        self.assertEqual(M._fit_px(Image.new("RGB", (5000, 2500))).size, (2560, 1280))
        im = Image.new("RGB", (1920, 1080))
        self.assertIs(M._fit_px(im), im)

    def test_web_download_is_saved_at_most_2560(self):
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (6000, 3000), (80, 60, 40)).save(buf, "JPEG")
        resp = mock.Mock(status_code=200, content=buf.getvalue())
        with tempfile.TemporaryDirectory() as d, mock.patch("requests.get", return_value=resp):
            out = M._download({"url": "https://example.org/big.jpg"}, Path(d) / "w.jpg")
            with Image.open(out) as im:
                self.assertEqual(im.size, (2560, 1280))

    def test_commons_bytes_and_staging(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            small = jpeg(d / "small.jpg", 1920, 1080)
            M._save_web(small.read_bytes(), d / "c00.jpg")
            self.assertEqual((d / "c00.jpg").read_bytes(), small.read_bytes())     # as it came
            big = jpeg(d / "big.jpg", 4000, 3000)
            M._save_web(big.read_bytes(), d / "c01.jpg")
            with Image.open(d / "c01.jpg") as im:
                self.assertEqual(max(im.size), 2560)
            k1, k2 = M._stage(d / "storage", str(small)), M._stage(d / "storage", str(big))
            self.assertEqual((d / "storage" / k1).read_bytes(), small.read_bytes())
            with Image.open(d / "storage" / k2) as im:
                self.assertEqual(im.size, (2560, 1920))


class ArchivesSwitch(unittest.TestCase):
    def run_pictures(self, env):
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            rows, _ = film_rows(n=2, secs=4.0)
            pics = {i: jpeg(job / "src" / f"p{i}.jpg", 1600, 900, shade=40 + 60 * i) for i in range(2)}
            called = []

            def commons(q, folder, n=4):
                i = int(q[-1])
                return [({"title": f"photo {i}", "url": "", "source": "commons", "license": ""}, pics[i])]

            def judge(engine, row, cands, dossier, before="", after=""):
                return [dict(c, photo=str(p), score=6.0, studio=False, anchor=(0.5, 0.5), depiction="named-subject",
                             flags=[], reason="", subject="", person=False) for c, p in cands]

            def names(engine, job, rows, dossier, force=False):
                for i, r in enumerate(rows):
                    r["archive"] = f"Archive {i}"
            e = Engine()
            with mock.patch.dict(os.environ, env), mock.patch.object(M, "commons_photos", commons), \
                    mock.patch.object(M, "judge", judge), mock.patch.object(M, "archive_names", names), \
                    mock.patch.object(M, "web_photos", lambda *a, **k: []), \
                    mock.patch.object(M, "archive_photos", lambda q, f: called.append(q) or []), \
                    mock.patch.object(M, "_ai_picture", lambda *a, **k: None):
                M.pictures(e, job, rows, {})
            self.assertTrue(all(r.get("pick") for r in rows))
            return called, e.lines

    def test_archives_are_off_unless_switched_on(self):
        called, lines = self.run_pictures({"MRTRUTH_ARCHIVES": "0"})
        self.assertEqual(called, [])
        self.assertTrue(any("open archives off" in l for l in lines))
        called, _ = self.run_pictures({"MRTRUTH_ARCHIVES": "1"})
        self.assertEqual(len(called), 2)


class Visibility(unittest.TestCase):
    def test_timed_parts_add_up(self):
        M.PIC_T.clear()
        for _ in range(3):
            with M._timed("search"):
                pass
        self.assertEqual(M.PIC_T["search"][1], 3)
        self.assertIn("pictures_s", M._usage(Engine()))

    def test_gemini_tokens_per_purpose_and_price(self):
        import make_video as mv
        body = {"candidates": [{"content": {"parts": [{"text": "thinking...", "thought": True}, {"text": "[]"}]}}],
                "usageMetadata": {"promptTokenCount": 1000, "candidatesTokenCount": 100, "thoughtsTokenCount": 400}}
        resp = mock.Mock(ok=True, status_code=200, json=lambda: body)
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {"GEMINI_API_KEY": "test"}), \
                mock.patch.object(mv.requests, "post", return_value=resp), \
                mock.patch.dict(mv.GEMINI_PICKS, {"calls": 0, "in": 0, "out": 0, "think": 0, "fallback": 0, "by": {}}):
            img = jpeg(Path(d) / "a.jpg", 64, 64)
            self.assertEqual(mv.pick_vision("p", [img], model="gemini-3.8-flash", purpose="picture judge"), "[]")
            mv.pick_vision("p", [img], model="gemini-3.8-flash", purpose="AI check")
            mv.pick_vision("p", [img])                                               # other channels: unchanged call
            g = mv.GEMINI_PICKS
            self.assertEqual((g["calls"], g["in"], g["out"], g["think"]), (3, 3000, 300, 1200))
            judge = g["by"]["picture judge | gemini-3.8-flash"]
            self.assertEqual((judge["calls"], judge["think"]), (1, 400))
            line = mv.gemini_spend_line()
            self.assertTrue(line.startswith("Gemini photo picks: 3 ("))
            # 3.8 Flash: 1000 in x $0.75/M + (100 out + 400 thinking) x $3.75/M = $0.0026 per call
            self.assertIn("picture judge (gemini-3.8-flash) 1 calls", line)
            self.assertIn("thinking", line)


def saved_plan(work, n=3):
    plan, shots = [], []
    for i in range(n):
        sc = {"index": i, "startFrame": i * 90, "durationFrames": 90, "asset": {"path": f"p/{i}.jpg", "attribution": f"photo {i}",
              "sourceUrl": "https://example.org/", "license": "CC0"}, "prevAsset": None, "companions": [],
              "transitionIn": {"type": "cut", "durationFrames": 0}, "device": {"id": "P03"} if i == 0 else None}
        sc["renderKey"] = M._hash(sc)
        plan.append(sc)
        shots.append({"text": f"line {i}", "photo": f"{i}.jpg", "step": "exact", "ai": False, "anchor_switched": False})
    (work / "plan.json").write_text(json.dumps(plan))
    (work / "shots.json").write_text(json.dumps(shots))
    return plan


class Finish(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.job = Path(self.tmp.name)
        self.work = self.job / "mrtruth"
        (self.work / "segments").mkdir(parents=True)
        self.plan = saved_plan(self.work)
        (self.work / "timing.json").write_text('{"pictures": 1419.0}')
        self.joined = []
        test = self

        class E(Engine):
            def _concat_segments(self, paths, out):
                test.joined = [Path(p).name for p in paths]

            def _final_mux(self, job, audio, srt, burn, add_qr=False, vignette=False, cuts=None, **kw):
                test.cuts = cuts                 # the saved plan's shot starts go to the stall check (lane B)
                (job / "video.mp4").write_bytes(b"x")
        self.engine = E()
        boom = mock.Mock(side_effect=AssertionError("planning or a paid call in a finish"))
        self.patches = [mock.patch.dict(os.environ, {"MRTRUTH_FINISH": "1"})] + [
            mock.patch.object(M, n, boom) for n in ("preflight", "research", "plan_film", "pictures", "beats")]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def names(self):
        return [f"{sc['index']:04d}_{sc['renderKey'][:12]}.mp4" for sc in self.plan]

    def test_finish_joins_the_saved_plan_and_asks_nothing(self):
        for n in self.names():
            (self.work / "segments" / n).write_bytes(b"")
        M.prepare(self.engine, "s", self.job, "mr_truth", False)
        out = M.assemble(self.engine, self.job, self.job / "audio.mp3", self.job / "subs.srt", "mr_truth", False, False)
        self.assertEqual(out.name, "video.mp4")
        self.assertEqual(self.joined, self.names())
        self.assertEqual(json.loads((self.work / "timing.json").read_text()), {"pictures": 1419.0})
        self.assertIn("saved plan", json.loads((self.work / "timing_finish.json").read_text()))
        self.assertEqual(len(json.loads((self.job / "credits.json").read_text())), 3)
        self.assertEqual(self.cuts, [0.0, 3.0, 6.0])     # a finish hands the saved plan's cuts to the stall check

    def test_a_missing_drawn_shot_stops_by_name(self):
        for n in self.names()[1:]:
            (self.work / "segments" / n).write_bytes(b"")
        with self.assertRaises(M.PlanningStopped) as x:
            M.assemble(self.engine, self.job, self.job / "a.mp3", self.job / "s.srt", "mr_truth", False, False)
        self.assertIn(self.names()[0], str(x.exception))

    def test_degraded_draws_the_missing_shot_here(self):
        for n in self.names()[1:]:
            (self.work / "segments" / n).write_bytes(b"")
        drawn = []
        with mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "1"}), \
                mock.patch.object(M, "render", lambda e, w, tasks, workers=2: drawn.extend(
                    Path(t["output"]).name for t in tasks if not Path(t["output"]).exists())):
            M.assemble(self.engine, self.job, self.job / "a.mp3", self.job / "s.srt", "mr_truth", False, False)
        self.assertEqual(drawn, self.names()[:1])

    def test_no_saved_plan_stops(self):
        (self.work / "plan.json").unlink()
        with self.assertRaises(M.PlanningStopped):
            M.assemble(self.engine, self.job, self.job / "a.mp3", self.job / "s.srt", "mr_truth", False, False)


class Wiring(unittest.TestCase):
    def test_no_after_render_look_for_mr_truth(self):
        self.assertTrue(M.CHECKS_BEFORE_RENDER)
        src = (HERE / "make_video.py").read_text(encoding="utf-8")
        self.assertIn('if not getattr(plug, "CHECKS_BEFORE_RENDER", False):', src)

    def test_segments_finish_from_the_saved_plan(self):
        src = (HERE / "run_test.py").read_text(encoding="utf-8")
        self.assertRegex(src, r'if seg_file:\n    os.environ\["MRTRUTH_FINISH"\] = "1"')
        self.assertLess(src.index('os.environ["MRTRUTH_FINISH"]'), src.index("import make_video"))


if __name__ == "__main__":
    unittest.main()
