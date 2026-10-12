"""Mr Truth E1 (owner add-ons 2026-10-10): a real photo refused for a frame alone is cropped and asked once more.
(The search order - Bing first for a generic shot, Commons first for a named one - is tested in test_mrtruth_a1.)
Synthetic data only: no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_e1 -v
"""
import json
import os
import sys
import threading
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
from test_mrtruth_a2 import Engine, Tmp, answer, textured  # noqa: E402


class Gem:
    """engine.pick_vision: plan(caption, path) -> answer fields, per picture (a crop's file name carries "_crop")."""

    def __init__(self, plan):
        self.plan, self.calls, self.lock = plan, [], threading.Lock()

    def __call__(self, prompt, paths, max_tokens=800, model="", thinking="", purpose="", media="", lead="",
                 labels=None, info=None):
        with self.lock:
            self.calls.append({"paths": list(paths), "purpose": purpose, "model": model, "media": media})
        if info is not None:
            info.update(via="gemini")
        return json.dumps([answer(n, **self.plan(lab.split("caption: ", 1)[-1], str(p)))
                           for n, (lab, p) in enumerate(zip(labels or [], paths), 1)])

    def of(self, purpose):
        return [c for c in self.calls if c["purpose"] == purpose]


def framed_unless_cropped(cap, path):
    return {"frame": "_crop" not in Path(path).name} if cap.startswith("framed") else {}


class Helpers(unittest.TestCase):
    def test_a_real_crop_keeps_its_own_pixels(self):
        import tempfile
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            src = textured(Path(d) / "a.jpg", 1, size=(2000, 1125))
            self.assertEqual(M._crop_box(2000, 1125), (200, 112, 1800, 1012))
            with Image.open(M._crop_edges(src, Path(d) / "b.jpg")) as im:
                self.assertEqual(im.size, (1600, 900))
            with Image.open(M._crop_edges(src, Path(d) / "c.jpg", keep_size=True)) as im:
                self.assertEqual(im.size, (2000, 1125))
            self.assertEqual(sorted(p.name for p in Path(d).iterdir()), ["a.jpg", "b.jpg", "c.jpg"])   # no .part left

    def test_the_ai_crop_is_byte_for_byte_the_old_one(self):
        import tempfile
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            src = textured(Path(d) / "ai.jpg", 7, size=(1536, 864))
            with Image.open(src) as im:                                  # the AI path's crop before E1
                w, h = im.size
                im.convert("RGB").crop((int(w * .1), int(h * .1), int(w * .9), int(h * .9))) \
                    .resize((w, h), Image.LANCZOS).save(Path(d) / "old.jpg", quality=92)
            M._crop_edges(src, Path(d) / "new.jpg", keep_size=True)
            self.assertEqual((Path(d) / "old.jpg").read_bytes(), (Path(d) / "new.jpg").read_bytes())

    def test_the_crop_must_still_fill_the_frame(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            ok = {(1000, 560): True, (999, 560): True, (990, 560): False, (801, 578): False, (1000, 1000): True, (1000, 1100): False,
                  (3000, 1100): False, (2820, 1592): True}
            for (w, h), want in ok.items():
                self.assertEqual(M._crop_fits(textured(d / f"{w}x{h}.jpg", 3, size=(w, h))), want, (w, h))
            self.assertFalse(M._crop_fits(d / "gone.jpg"))

    def test_frame_only(self):
        r, under = {"text": "x"}, {"text": "x", "device": {"id": "P04"}}
        base = {"photo": "/p.jpg", "bad": ["frame"], "tier": M.KIND, "clean": False, "looked": "asked"}
        self.assertTrue(M._frame_only(r, base))
        self.assertTrue(M._frame_only(r, dict(base, looked="stored", tier=M.EXACT)))
        self.assertTrue(M._frame_only(r, dict(base, looked="dirty", tier=M.NO)))      # known framed, tier unknown
        self.assertFalse(M._frame_only(r, dict(base, tier=M.GENERIC)))               # below the shot's bar
        self.assertFalse(M._frame_only(r, dict(base, bad=["text", "frame"])))
        self.assertFalse(M._frame_only(r, dict(base, bad=["frame", "not real"])))
        self.assertFalse(M._frame_only(r, dict(base, ai=True)))
        self.assertFalse(M._frame_only(r, dict(base, crop_of="/q.jpg")))
        self.assertFalse(M._frame_only(r, dict(base, looked="later", bad=["frame"])))
        self.assertFalse(M._frame_only(under, dict(base, studio=True)))
        self.assertFalse(M._frame_only(r, dict(base, bad=[], clean=True)))


class Recheck(Tmp):
    row = {"text": "The ledger lay open in the reading room.", "entities": [], "era": "1930s"}

    def test_asked_once_one_picture_then_stored(self):
        src = textured(self.d / "pics" / "w1.jpg", 11, size=(2000, 1125))
        gem = Gem(framed_unless_cropped)
        e = Engine(gem)
        c = {"photo": str(src), "title": "framed ledger", "url": "https://x/1", "source": "x", "license": "cc",
             "provider": "bing", "img": "https://x/1.jpg", "bad": ["frame"], "tier": M.KIND, "looked": "asked"}
        v = M._crop_recheck(e, self.row, c, {"period": "1930s"})
        self.assertEqual(len(gem.calls), 1)
        self.assertEqual(len(gem.calls[0]["paths"]), 1)
        self.assertEqual(gem.calls[0]["purpose"], "frame recheck")
        self.assertEqual(gem.calls[0]["model"], M.JUDGE_MODEL)
        self.assertTrue(v["clean"] and M._usable(self.row, v))
        self.assertEqual((v["crop_of"], v["title"], v["url"], v["provider"]), (str(src), "framed ledger", "https://x/1", "bing"))
        self.assertIn("_crop", Path(v["photo"]).name)
        self.assertNotEqual(v["pid"], M._photo_id(src))                    # stored under the crop's own identity
        self.assertEqual(M.VERDICTS["store"].stats()["answers"], 1)
        v2 = M._crop_recheck(e, self.row, c, {"period": "1930s"})            # never asked again
        self.assertEqual(len(gem.calls), 1)
        self.assertEqual((v2["photo"], v2["looked"]), (v["photo"], "stored"))

    def test_too_small_after_the_crop_stays_refused_unasked(self):
        src = textured(self.d / "pics" / "p52.jpg", 12, size=(801, 578))
        gem = Gem(framed_unless_cropped)
        v = M._crop_recheck(Engine(gem), self.row, {"photo": str(src), "title": "framed", "bad": ["frame"]}, {})
        self.assertEqual((v, gem.calls), ({}, []))
        self.assertFalse(list((self.d / "pics").glob("*_crop*")))

    def test_a_crop_still_framed_is_refused_and_remembered(self):
        src = textured(self.d / "pics" / "w2.jpg", 13, size=(2400, 1350))
        gem = Gem(lambda cap, p: {"frame": True})                         # a mount wider than the crop
        with mock.patch.object(M, "JUDGE_MEDIA", "MEDIUM"):
            v = M._crop_recheck(Engine(gem), self.row, {"photo": str(src), "title": "framed", "bad": ["frame"]}, {})
        self.assertEqual(v["bad"], ["frame"])
        self.assertFalse(M._usable(self.row, v))
        self.assertEqual(M.VERDICTS["store"].dirty(v["pid"], M._QSET, 2), "frame")   # no other line sends it again

    def test_a_low_look_is_refused_but_not_remembered_as_framed(self):
        """Option A's LOW pictures: the crop is refused on its line, but a LOW look never marks it framed for the others
        (verdicts.DIRTY_MIN: a LOW look misses small marks and finds ones that are not there)."""
        src = textured(self.d / "pics" / "w3.jpg", 14, size=(2400, 1350))
        gem = Gem(lambda cap, p: {"frame": True})
        with mock.patch.object(M, "JUDGE_MEDIA", "LOW"):
            v = M._crop_recheck(Engine(gem), self.row, {"photo": str(src), "title": "framed", "bad": ["frame"]}, {})
        self.assertEqual(v["bad"], ["frame"])
        self.assertFalse(M._usable(self.row, v))
        self.assertEqual(M.VERDICTS["store"].dirty(v["pid"], M._QSET, "LOW"), "")


class InPictures(Tmp):
    """pictures() with every source stubbed: the crop runs only for a shot with nothing usable, in film order, capped."""

    SIZES = {0: (2000, 1125), 1: (2000, 1125), 2: (900, 600), 3: (2400, 1350), 4: (2000, 1125)}

    def setUp(self):
        super().setUp()
        self.pics = {}

    def web(self, queries, folder, n=6, skip=()):
        if not queries[0].split()[-1].isdigit():                       # round 2's wider wording: nothing more
            return []
        i = int(queries[0].split()[-1])
        out = []
        for k, title in enumerate(["framed", "good"] if i == 1 else ["framed"]):
            key = (i, k)
            if key not in self.pics:
                self.pics[key] = textured(self.d / "src" / f"w{i}_{k}.jpg", 100 * (i + 1) + k, size=self.SIZES[i])
            out.append(({"title": f"{title} {i}", "url": f"https://x/{i}/{k}", "source": "web", "license": "",
                         "provider": "bing"}, self.pics[key]))
        return out

    @staticmethod
    def plan(cap, path):
        if cap == "framed 3":                                           # its crop still shows the mount
            return {"frame": True}
        return framed_unless_cropped(cap, path)

    def run_pictures(self, n=5):
        rows = [{"text": f"Line number {i} about the old ledger.", "startMs": i * 4000, "endMs": (i + 1) * 4000,
                 "queries": [f"old ledger {i}", "", ""], "entities": [], "device": None} for i in range(n)]
        gem = Gem(self.plan)
        e = Engine(gem)
        M._search_reset(e)
        with mock.patch.object(M, "commons_photos", lambda q, f, n=4: []), mock.patch.object(M, "web_photos", self.web), \
                mock.patch.object(M, "archive_names", lambda *a, **k: None), \
                mock.patch.object(M, "_ai_picture", lambda *a, **k: None), \
                mock.patch.object(M, "_stop", lambda engine, msg: engine.log("stopped: " + msg)), \
                mock.patch.dict(os.environ, {"MRTRUTH_ARCHIVES": "0"}):
            M.pictures(e, self.d / "job", rows, {"period": "1930s", "visualBrief": {"tone": "dark"}})
        return rows, e, gem

    def test_only_shots_with_nothing_usable_in_film_order(self):
        rows, e, gem = self.run_pictures()
        rechecks = gem.of("frame recheck")
        self.assertEqual(len(rechecks), 3)                               # shots 0, 3 and 4 (1 has a good one, 2 small)
        self.assertEqual({len(c["paths"]) for c in rechecks}, {1})
        self.assertTrue(rows[0]["pick"]["crop_of"].endswith("w0_0.jpg"))
        self.assertEqual(rows[0]["step"], "contextual")
        self.assertEqual(rows[1]["pick"]["title"], "good 1")
        self.assertFalse(rows[1]["pick"].get("crop_of"))
        job = self.d / "job" / "mrtruth"
        rep = json.loads((job / "verdicts.json").read_text())["frame_rechecks"]
        self.assertEqual({k: rep[k] for k in ("rechecks", "asked", "passed", "too_small", "over_cap", "calls")},
                         {"rechecks": 3, "asked": 3, "passed": 2, "too_small": 1, "over_cap": 0, "calls": 0})
        audit = json.loads((job / "pick_audit.json").read_text())
        self.assertEqual([a.get("crop", "")[:7] for a in audit], ["passed", "", "", "refused", "passed"])
        self.assertTrue(any("frame rechecks 3 (3 asked, 2 passed, 1 too small after the crop" in l for l in e.lines))
        self.assertTrue(any("saved by a frame crop 2" in l for l in e.lines))
        st = json.loads(next(p for p in (job / "pictures").rglob("pick.json")
                             if json.loads(p.read_text())["text"] == rows[0]["text"]).read_text())
        self.assertEqual((st["round"], st["crop"]["ok"]), (2, True))     # round 2 ran (nothing usable in round 1)
        # a re-run: pick.json kept - nothing asked; pick.json gone - the store answers, the same crop on screen
        rows2, _, gem2 = self.run_pictures()
        self.assertEqual(gem2.calls, [])
        for p in (job / "pictures").rglob("pick.json"):
            p.unlink()
        rows3, _, gem3 = self.run_pictures()
        self.assertEqual(gem3.calls, [])
        self.assertEqual([(r.get("pick") or {}).get("photo") for r in rows3], [(r.get("pick") or {}).get("photo") for r in rows])

    def test_at_most_crop_max_a_film(self):
        with mock.patch.object(M, "CROP_MAX", 1):
            rows, e, gem = self.run_pictures()
        self.assertEqual(len(gem.of("frame recheck")), 1)
        self.assertTrue(rows[0]["pick"]["crop_of"])                     # the first in film order
        audit = json.loads((self.d / "job" / "mrtruth" / "pick_audit.json").read_text())
        self.assertEqual([a.get("crop", "")[:7] for a in audit], ["passed", "", "", "", ""])
        rep = json.loads((self.d / "job" / "mrtruth" / "verdicts.json").read_text())["frame_rechecks"]
        self.assertEqual((rep["over_cap"], rep["wanted"], rep["cap"]), (2, 3, 1))
        self.assertTrue(any("frame crops: 3 shots could use one, MRTRUTH_CROP_MAX allows 1" in l for l in e.lines))

    def test_score_mode_never_crops(self):
        with mock.patch.object(M, "JUDGE_MODE", "score"), mock.patch.object(
                M, "judge_score", lambda engine, row, cands, dossier, b="", a="": [
                    dict(c, photo=str(p), score=2.0, flags=["frame"], depiction="same-category", reason="border",
                         subject="", person=False, studio=False, anchor=(0.5, 0.5)) for c, p in cands]):
            rows, e, gem = self.run_pictures(2)
        self.assertEqual(gem.of("frame recheck"), [])


if __name__ == "__main__":
    unittest.main()
