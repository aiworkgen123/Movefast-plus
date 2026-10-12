"""Mr Truth: the parts of round 2 of the Flash-Lite fixes (2026-10-11) kept when the checks went back to 6f07aab's
questions on 3.8 (impl-q): the AI-picture checks on their own model (MRTRUTH_AI_CHECK_MODEL, 3.8 by default - the
key of 6f07aab's AI checks), a defect answered in words, three more free frame tests (a thin border, a narrow gap, a
transparency checkerboard), ticket and tour sellers and facsimile shops refused. The century decided in code ("made",
_date_off) and the yes/no "same" are gone with the questions that asked them. Synthetic data, plus the retest's real
pictures when they are on this machine. No network, no paid call.

    .venv/bin/python -m unittest tests.test_mrtruth_lite2 -v
"""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
from test_mrtruth_a2 import Tmp  # noqa: E402

PICS2 = Path("/tmp/claude-0/-home-user/d74c83cb-cfd3-57f8-84b9-8fa3957981a4/scratchpad/verify/flcmp2/pics")


class SentenceAnswers(unittest.TestCase):
    """2026-10-11: Flash-Lite answered two drawings' frame with a sentence; they went unchecked."""

    def test_a_defect_in_words(self):
        f = M._flag
        for v in ("several pictures in one (a collage)", "collage", "there is a burnt border at the edges",
                  "yes - a burnt border", "Yes.", "true", True, 1):
            self.assertIs(f(v), True, v)
        for v in ("no", "No.", "none", "no frame", "there is no frame", "not a collage", "nothing", "false", False, 0,
                  "N/A"):
            self.assertIs(f(v), False, v)
        for v in (None, "", "?", "-", 2):
            self.assertIsNone(f(v), v)
        self.assertIsNone(f("looks like a painting", describes=False))           # "real" is never guessed
        self.assertIs(f("yes, a real photograph", describes=False), True)
        self.assertIs(f("no, a CGI render", describes=False), False)

    def test_the_drawings_answers_are_read(self):
        raw = ('```json\n[{"n": 1, "real": true, "text": false, "frame": "several pictures in one (a collage)", '
               '"banned": false, "modern": "", "warped": false, "shows": "kind", "person": true, "studio": false}]\n```')
        got = M._answers(raw, 1, era=True, ai=True)
        self.assertEqual(got[0]["frame"], True)
        v = M._verdict({}, got[0], ai=True)
        self.assertEqual((v["bad"], v["clean"]), (["frame"], False))
        raw2 = raw.replace('"several pictures in one (a collage)"', '"no frame"')
        self.assertEqual(M._answers(raw2, 1, era=True, ai=True)[0]["frame"], False)
        raw3 = raw.replace('"real": true', '"real": "a painting"')
        self.assertEqual(M._answers(raw3, 1, era=True, ai=True), {})            # real unreadable: asked again


class AiCheckModel(unittest.TestCase):
    def run_with(self, **env):
        code = r'''
import json, os, sys, tempfile
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[2])
import mrtruth as M
from test_mrtruth_a2 import Engine, FakeGemini, textured
d = tempfile.mkdtemp()
os.environ["MRTRUTH_VERDICTS_DB"] = d + "/v.sqlite"
M.VERDICTS.update(store=None, film="f")
gem = FakeGemini(lambda cap: {"warped": False})
e = Engine(gem)
row = {"text": "The priest read.", "era": "1980s"}
M.judge(e, row, [({"title": "a"}, textured(d + "/a.jpg", 1))], {})
ok, why, v = M._ai_ok(e, textured(d + "/ai.jpg", 2), row, {})
st = M.VERDICTS["store"]
rows = st.db.execute("SELECT qset, model FROM v ORDER BY model").fetchall()
print(json.dumps({"calls": [[c[k] for k in ("purpose", "model", "thinking", "media")] for c in gem.calls], "ok": ok,
                  "qsets": [M._QSET, M._AI_QSET], "rows": rows, "ai_model": M.AI_CHECK_MODEL}))
'''
        e = dict(os.environ, MRTRUTH_VERDICTS="on", MRTRUTH_JUDGE="yesno")
        for k in ("MRTRUTH_JUDGE_MODEL", "MRTRUTH_JUDGE_MEDIA", "MRTRUTH_JUDGE_THINKING", "MRTRUTH_AI_CHECK_MODEL",
                  "MRTRUTH_AI_CHECK_THINKING"):
            e.pop(k, None)
        e.update(env)
        r = subprocess.run([sys.executable, "-c", code, str(HERE), str(Path(__file__).resolve().parent)],
                           capture_output=True, text=True, env=e, timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        return json.loads(r.stdout.strip().splitlines()[-1])

    def test_the_drawings_stay_on_the_stronger_checker(self):
        got = self.run_with(MRTRUTH_JUDGE_MODEL="gemini-3.5-flash-lite", MRTRUTH_JUDGE_MEDIA="LOW",
                            MRTRUTH_JUDGE_THINKING="minimal")
        self.assertEqual(got["calls"], [["picture check", "gemini-3.5-flash-lite", "minimal", "LOW"],
                                        ["AI check", "gemini-3.8-flash", "low", "HIGH"]])
        self.assertTrue(got["ok"])
        self.assertEqual(sorted(m for _, m in got["rows"]), ["gemini-3.5-flash-lite", "gemini-3.8-flash"])
        self.assertEqual({q: m for q, m in got["rows"]}[got["qsets"][1]], "gemini-3.8-flash")

    def test_the_knob(self):
        got = self.run_with(MRTRUTH_JUDGE_MODEL="gemini-3.5-flash-lite", MRTRUTH_AI_CHECK_MODEL="gemini-3.5-flash-lite")
        self.assertEqual([c[1:3] for c in got["calls"]], [["gemini-3.5-flash-lite", "low"]] * 2)  # follows the judge
        got = self.run_with(MRTRUTH_AI_CHECK_MODEL="gemini-3.5-flash-lite", MRTRUTH_AI_CHECK_THINKING="minimal")
        self.assertEqual(got["calls"][1][1:3], ["gemini-3.5-flash-lite", "minimal"])
        default = self.run_with()
        self.assertEqual([c[1] for c in default["calls"]], ["gemini-3.8-flash"] * 2)   # as before: 3.8 for both
        self.assertEqual(default["qsets"], ["09ba59cf9af8", "6e48a6a6e3c7"])          # 6f07aab's keys: answers reused
        self.assertNotEqual(default["qsets"][1], got["qsets"][1])                       # filed by model


# ── the new free frame tests ───────────────────────────────────────────────────────────────────────────────────────
def _content(size, seed):
    rng = np.random.default_rng(seed)
    a = (rng.random((size[1] // 10 + 1, size[0] // 10 + 1, 3)) * 150 + 40).astype("uint8")
    return Image.fromarray(a).resize(size, Image.BICUBIC)


class Pixels(Tmp):
    def save(self, im, name):
        p = self.d / name
        im.save(p, "JPEG", quality=92)
        return p

    def test_a_thin_border_all_round(self):
        w, h = 1600, 1000
        im = Image.new("RGB", (w, h), (254, 254, 254))
        im.paste(_content((w - 2 * 12, h - 2 * 9), 3), (12, 9))                 # 0.75% / 0.9% white paper border
        px = M._pixels(self.save(im, "border.jpg"))
        self.assertEqual(px["frame"], "border")
        x0, y0, x1, y1 = px["trim"]
        self.assertTrue(0.015 < x0 < 0.03 and 0.015 < y0 < 0.03 and 0.97 < x1 < 0.985, px)
        three = Image.new("RGB", (w, h), (254, 254, 254))                        # three sides only: a sky, not a border
        three.paste(_content((w - 24, h - 9), 4), (12, 9))
        self.assertEqual(M._pixels(self.save(three, "three.jpg"))["frame"], "")
        two = Image.new("RGB", (w, h), (254, 254, 254))                          # two colours: not one border
        two.paste((20, 20, 20), (0, 0, w, h // 2))
        two.paste(_content((w - 24, h - 18), 5), (12, 9))
        self.assertEqual(M._pixels(self.save(two, "two.jpg"))["frame"], "")

    def test_a_narrow_gap_between_two_scans(self):
        w, h = 1920, 1180
        im = Image.new("RGB", (w, h), (255, 255, 255))
        im.paste(_content((960, h), 6), (0, 0))
        im.paste(_content((w - 969, h), 7), (969, 0))                           # a 9-px white gap (0.47%)
        px = M._pixels(self.save(im, "gap.jpg"))
        self.assertEqual(px["frame"], "parts")
        self.assertTrue(px["trim"][2] <= 0.5 or px["trim"][0] >= 0.5, px)       # one page
        line = Image.new("RGB", (w, h), (255, 255, 255))                         # a 2-px line: a ruled line, not a gap
        line.paste(_content((960, h), 6), (0, 0))
        line.paste(_content((w - 962, h), 7), (962, 0))
        self.assertEqual(M._pixels(self.save(line, "line.jpg"))["frame"], "")

    def test_a_transparency_checkerboard(self):
        w, h, s = 1400, 1100, 9
        yy, xx = np.mgrid[0:h, 0:w]
        a = np.where(((yy // s) + (xx // s)) % 2 == 0, 255, 223).astype("uint8")
        im = Image.fromarray(np.dstack([a] * 3))
        im.paste(_content((w - 120, h - 120), 8), (60, 60))
        im.save(self.d / "checker.png")
        self.assertEqual(M._pixels(self.d / "checker.png")["frame"], "checker")
        self.assertEqual(M._pixels(self.save(_content((w, h), 9), "plain.jpg"))["frame"], "")

    @unittest.skipUnless(PICS2.is_dir(), "the retest's pictures are not on this machine")
    def test_the_retests_real_pictures(self):
        self.assertEqual(M._pixels(PICS2 / "22fb2c189dad0d0c.jpg")["frame"], "parts")    # h001: 8-px gap
        self.assertEqual(M._pixels(PICS2 / "0a4565f6cce2aa55.jpg")["frame"], "border")   # h041: thin paper border
        self.assertEqual(M._pixels(PICS2 / "59baa5ddac404033.jpg")["frame"], "checker")  # h056: checkerboard
        # the 21 pictures both of the retest's adjudicators called kind or exact (or all three setups, unjudged)
        good = ["18eac2078ba32073", "1a754a7985c0c69f", "2cf3c3bc43bf4abf", "2f8af1078e74c1a7", "43bb75afaae011d8",
                "4fb53a1aca7c2306", "50481303658544ad", "57a540647703e319", "64ee1d92d11981bb", "6bfa5da6f9516cec",
                "7cf609850559dbc8", "882178d54803b930", "a72d50c3b9130ab3", "b4b7e7323e354b3f", "ba470d068a8ad041",
                "bee8c780ce853bc3", "c45429582ae4150e", "d5cb59c375a3d7bf", "e1302170b44c8fc4", "e22542c9fa2c1476",
                "e227a096da356573"]
        have = [n for n in good if (PICS2 / f"{n}.jpg").exists()]
        self.assertGreater(len(have), 15)
        self.assertEqual([n for n in have if M._pixels(PICS2 / f"{n}.jpg")["frame"]], [])


class Shops(unittest.TestCase):
    def test_ticket_and_tour_sellers_and_facsimile_shops(self):
        ok = lambda page, url="https://img.example.org/a.jpg", title="Vatican Library": M._web_ok(
            {"url": url, "source": page, "title": title})
        for page in ("https://www.thevaticantickets.com/vatican-library/", "https://www.vaticanmuseum-tickets.com/x",
                     "https://www.headout.com/blog/vatican-library/", "https://www.tiqets.com/en/x",
                     "https://www.getyourguide.com/rome/x", "https://www.facsimiles.com/worlds-of-wisdom/x"):
            self.assertFalse(ok(page), page)
        self.assertFalse(ok("https://blog.example.org/x", url="https://cdn.headout.com/a.jpg"))   # the image's host too
        for page in ("https://www.metmuseum.org/art/collection/search/545456", "https://commons.wikimedia.org/wiki/F",
                     "https://visitvatican.info/vatican-library-collection/", "https://www.vaticanlibrary.va/x",
                     "https://www.picketfence.org/x"):
            self.assertTrue(ok(page), page)


if __name__ == "__main__":
    unittest.main()
