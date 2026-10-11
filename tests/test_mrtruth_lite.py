"""Mr Truth: the parts of the Flash-Lite fixes (2026-10-11) kept when the checks went back to 6f07aab's questions on
3.8 (impl-q, CHECK_V 1): a refusal without "shows" read as a refusal for its reason (3.8 left "shows" out on 5 of 6
pictures of one call with 6f07aab's FORMAT, and each such call was asked again), and the free pixel tests (bars,
mounts, parts, gloss) before any paid question. The questions themselves are 6f07aab's again: no "made", no century
rule, the old frame and text wording, the old FORMAT line. Synthetic data, plus the comparison's real pictures when
they are on this machine. No network, no paid call.

    .venv/bin/python -m unittest tests.test_mrtruth_lite -v
"""
import hashlib
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
from test_mrtruth_a2 import Engine, FakeGemini, Tmp, textured  # noqa: E402

PICS = Path("/tmp/claude-0/-home-user/d74c83cb-cfd3-57f8-84b9-8fa3957981a4/scratchpad/verify/flcmp/pics")
flat = lambda s: " ".join(s.split())


def base(**kw):
    x = {"real": True, "text": False, "frame": False, "banned": False}
    x.update(kw)
    return x


# ── synthetic pictures ─────────────────────────────────────────────────────────────────────────────────────────────
def _content(size, seed):
    rng = np.random.default_rng(seed)
    a = (rng.random((size[1] // 10 + 1, size[0] // 10 + 1, 3)) * 200 + 30).astype("uint8")
    return Image.fromarray(a).resize(size, Image.BICUBIC)


def framed(path, kind, size=(2000, 1125), seed=1):
    """A textured picture with: "bars" (black top and bottom, 8%), "pillar" (black left and right, 10%), "mount"
    (cream on all sides, 6%), "stacked" (two strips on white, a 4% gap), "side" (two panels, a black gap), "sky" (one
    flat white band along the top only), "page" (a white page of thin-stroked text lines)."""
    w, h = size
    if kind == "page":
        im = Image.new("RGB", size, (250, 250, 248))
        d, rng = ImageDraw.Draw(im), np.random.default_rng(seed)
        for y in range(int(h * 0.06), int(h * 0.94), int(h * 0.05)):
            x = int(w * 0.06)
            while x < w * 0.94:
                d.line([(x, y), (x, y + int(h * 0.025))], fill=(20, 20, 20), width=2)
                x += int(rng.integers(6, 30))
    elif kind == "sky":
        im = _content(size, seed)
        im.paste((255, 255, 255), (0, 0, w, int(h * 0.12)))
    elif kind == "bars":
        im = Image.new("RGB", size, (0, 0, 0))
        im.paste(_content((w, int(h * 0.84)), seed), (0, int(h * 0.08)))
    elif kind == "pillar":
        im = Image.new("RGB", size, (0, 0, 0))
        im.paste(_content((int(w * 0.8), h), seed), (int(w * 0.1), 0))
    elif kind == "mount":
        im = Image.new("RGB", size, (236, 229, 214))
        im.paste(_content((int(w * 0.88), int(h * 0.88)), seed), (int(w * 0.06), int(h * 0.06)))
    elif kind == "stacked":
        im = Image.new("RGB", size, (255, 255, 255))
        im.paste(_content((w, int(h * 0.58)), seed), (0, 0))
        im.paste(_content((w, int(h * 0.38)), seed + 1), (0, int(h * 0.62)))
    elif kind == "side":
        im = Image.new("RGB", size, (0, 0, 0))
        im.paste(_content((int(w * 0.48), h), seed), (0, 0))
        im.paste(_content((int(w * 0.48), h), seed + 1), (int(w * 0.52), 0))
    else:
        raise ValueError(kind)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=90)
    return Path(path)


_HUES = np.array([(255, 40, 40), (40, 230, 60), (50, 70, 255), (255, 215, 30), (240, 40, 220), (30, 220, 250)], float)


def glossy(path, grey_part=0.0, size=(1600, 900), seed=3):
    """Small blocks of strong colours: grey_part 0 is an over-the-line HDR look, 0.4 (the left 40% plain grey) a glossy
    one."""
    rng = np.random.default_rng(seed)
    w, h, b = size[0], size[1], 10
    gh, gw = h // b + 1, w // b + 1
    a = _HUES[rng.integers(0, len(_HUES), (gh, gw))] * rng.uniform(0.4, 1.0, (gh, gw))[..., None]
    if grey_part:
        g = a.mean(axis=2, keepdims=True)
        cols = int(gw * grey_part)
        a[:, :cols] = 150 + (g[:, :cols] - g[:, :cols].mean()) * 0.2
    im = Image.fromarray(a.clip(0, 255).astype("uint8")).resize((gw * b, gh * b), Image.NEAREST).crop((0, 0, w, h))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=90)
    return Path(path)


# ── the parser ─────────────────────────────────────────────────────────────────────────────────────────────────────
class Parser(unittest.TestCase):
    def test_a_refusal_without_shows_is_a_refusal_for_its_reason(self):
        for kw, why in ((dict(frame=True), ["frame"]), (dict(text=True), ["text"]), (dict(banned=True), ["banned"]),
                        (dict(real=False), ["not real"]), (dict(text=True, frame=True), ["text", "frame"])):
            a = M._answer(base(**kw), era=False)
            self.assertIsNotNone(a, kw)
            self.assertEqual((a["shows"], a["unsaid"]), ("no", True), kw)      # stored as "no": 6f07aab reads a refusal
            v = M._verdict({"title": "t"}, a, looked="asked")
            self.assertEqual((v["shows"], v["bad"], v["tier"], v["clean"], v.get("unjudged")), ("", why, M.NO, False, None), kw)
            self.assertTrue(v["reason"].startswith("?:"))
        a = M._answer(base(modern="a laptop on the desk"), era=True)          # the period question's own refusal
        self.assertEqual((a["shows"], a["modern"]), ("no", "a laptop on the desk"))
        self.assertEqual(M._verdict({}, a)["bad"], ["modern: a laptop on the desk"])
        a = M._answer(base(warped=True), era=False, ai=True)                  # a drawing's warped hands
        self.assertEqual(M._verdict({}, a, ai=True)["bad"], ["warped"])
        self.assertNotIn("unsaid", M._answer(base(frame=True, shows="kind"), era=False))

    def test_nothing_wrong_and_no_shows_is_still_unanswered(self):
        self.assertIsNone(M._answer(base(), era=False))
        self.assertIsNone(M._answer(base(shows="maybe"), era=False))
        self.assertIsNone(M._answer(base(modern=""), era=True))
        self.assertIsNone(M._answer(base(warped=False), era=False, ai=True))
        self.assertIsNone(M._answer({"real": True, "text": False, "banned": False, "frame": "?"}, era=False))
        # an odd stored answer (no reason, no shows) is no answer, never a pass
        v = M._verdict({"title": "t"}, {"real": True, "text": False, "frame": False, "banned": False, "shows": ""})
        self.assertTrue(v.get("unjudged"))

    def test_the_flash_lite_fields_are_not_read(self):
        """made, same and other_era (a CHECK_V 2-3 store, or a chatty model) change nothing: 6f07aab's fields only."""
        a = M._answer(base(modern="", other_era=True, same=False, shows="kind", made="c.1320 Gothic charter"), era=True)
        self.assertEqual(sorted(a), sorted(M._answer(base(modern="", shows="kind"), era=True)))
        v = M._verdict({"title": "t"}, a)
        self.assertEqual((v["shows"], v["tier"], v["clean"]), ("kind", M.KIND, True))
        self.assertNotIn("made", v)
        self.assertIsNone(M._answer(base(modern="", other_era=True), era=True))   # no shows, nothing wrong: asked again

    def test_answers_mixed(self):
        raw = json.dumps([dict(base(frame=True), n=1), dict(base(), n=2), dict(base(shows="kind"), n=3)])
        got = M._answers(raw, 3, era=False)
        self.assertEqual(sorted(got), [0, 2])                                  # picture 2: nothing said - asked again
        self.assertEqual((got[0]["shows"], got[0]["unsaid"], got[2]["shows"]), ("no", True, "kind"))

    def test_a_frame_refusal_without_shows_goes_to_the_crop(self):
        row = {"text": "The ledger lay open.", "entities": []}
        v = M._verdict({"photo": "p.jpg"}, M._answer(base(frame=True), era=False), looked="asked")
        self.assertTrue(M._frame_only(row, v))
        v = M._verdict({"photo": "p.jpg"}, M._answer(base(frame=True, text=True), era=False), looked="stored")
        self.assertFalse(M._frame_only(row, v))                                # text too: no crop
        v = M._verdict({"photo": "p.jpg"}, M._answer(base(frame=True, shows="generic"), era=False), looked="asked")
        self.assertFalse(M._frame_only(row, v))                                # said: below the shot's bar
        v = M._verdict({"photo": "p.jpg"}, M._answer(base(frame=True, shows="no"), era=False), looked="asked")
        self.assertFalse(M._frame_only(row, v))                                # said "no" itself: no crop
        v = M._verdict({"photo": "p.jpg"}, None, known=["frame"], looked="pixel")
        self.assertTrue(M._frame_only(row, v))                                 # the pixel test's frame


# ── the questions: 6f07aab's, word for word ────────────────────────────────────────────────────────────────────────
class Questions(unittest.TestCase):
    def test_the_last_renders_question_sets(self):
        """The keys of full-05f3c0's stored answers (6f07aab): every wording, the model, thinking and size in them."""
        self.assertEqual(M.CHECK_V, 1)
        self.assertEqual((M._QSET, M._AI_QSET), ("09ba59cf9af8", "6e48a6a6e3c7"))
        self.assertEqual(M._qset("check", terse=False), "09ba59cf9af8")

    def test_the_flash_lite_additions_are_gone(self):
        for name in ("WORLD_RULE", "SAME_Q", "ERA_Q_NEAR", "OTHER_ERA_Q", "_Q_MADE", "_date_off", "_line_when",
                     "_made_when", "_era_q", "YEAR_NOW"):
            self.assertFalse(hasattr(M, name), name)
        r = flat(M.CHECK_RULES)
        for gone in ("made:", "same (asked", "other_era", "look at all four edges", "counts as text",
                     "1320 charter"):
            self.assertNotIn(gone, r)
        self.assertIn("frame: a border, mount, margin, photo frame, torn or burnt edges, a ruler or colour chart along "
                      "an edge, or several pictures in one", r)
        self.assertTrue(M.FORMAT.endswith('For a picture with text, frame or banned true, or shows "no", leave out '
                                          'subject, x and y.'))
        self.assertTrue(M.AI_RULES.startswith(M._AI_HEAD + "\nreal: it looks like a real photograph"))
        self.assertEqual(M._extra_fields(True), '"modern": "", ')
        self.assertEqual(M._extra_fields(True, ai=True), '"modern": "", "warped": false, ')

    def test_film_block_lists_the_motifs_as_before(self):
        d = {"topic": "t", "period": "4th-5th century; 1980s", "setting": "the Vatican Library",
             "visualBrief": {"tone": "dark", "motifs": [
                 {"idea": "memorized forbidden knowledge", "web": "scholar reading restricted codex"}]}}
        b = M._check_film(d)
        self.assertIn("this film's motifs for abstract lines:\n  - memorized forbidden knowledge: scholar reading "
                      "restricted codex", b)

    def test_card_answers_kept(self):
        self.assertEqual(M.CARD_V, 1)
        card = hashlib.sha1("|".join(map(str, ["card", 1, M.JUDGE_MODEL, M.JUDGE_THINKING, M.AI_CHECK_PX, M.CARD_RULES,
                                               M.CARD_FORMAT])).encode()).hexdigest()[:12]
        self.assertEqual(M._CARD_QSET, card)                                 # the label check's answers still count


# ── the pixel tests ────────────────────────────────────────────────────────────────────────────────────────────────
class Pixels(Tmp):
    def test_synthetic_frames(self):
        got = {k: M._pixels(framed(self.d / f"{k}.jpg", k)) for k in
               ("bars", "pillar", "mount", "stacked", "side", "sky", "page")}
        self.assertEqual({k: v["frame"] for k, v in got.items()},
                         {"bars": "bars", "pillar": "bars", "mount": "mount", "stacked": "parts", "side": "parts",
                          "sky": "", "page": ""})
        self.assertIsNone(got["sky"]["trim"])
        x0, y0, x1, y1 = got["bars"]["trim"]                                   # inside the bars, 1% in
        self.assertTrue(abs(y0 - 0.09) < 0.015 and abs(y1 - 0.91) < 0.015 and x0 == 0.01 and x1 == 0.99, got["bars"])
        x0, y0, x1, y1 = got["stacked"]["trim"]                                # the larger strip
        self.assertTrue(y0 == 0.01 and abs(y1 - 0.57) < 0.015, got["stacked"])
        x0, y0, x1, y1 = got["side"]["trim"]                                   # one of the two panels
        self.assertTrue(x1 - x0 < 0.5, got["side"])
        clean = M._pixels(textured(self.d / "plain.jpg", 4))
        self.assertEqual(clean, {"frame": "", "trim": None, "gloss": 0})
        self.assertEqual(M._pixels(self.d / "missing.jpg"), {"frame": "", "trim": None, "gloss": 0})

    def test_synthetic_gloss(self):
        self.assertEqual(M._pixels(glossy(self.d / "hdr.jpg"))["gloss"], 2)
        self.assertEqual(M._pixels(glossy(self.d / "half.jpg", grey_part=0.4))["gloss"], 1)
        self.assertEqual(M._pixels(textured(self.d / "plain.jpg", 5))["gloss"], 0)

    def test_cached_per_file(self):
        p = framed(self.d / "b.jpg", "bars")
        a = M._pixels(p)
        self.assertIs(M._pixels(p), a)
        framed(p, "page")                                                      # the same name, new bytes
        os.utime(p, ns=(1, 1))
        self.assertEqual(M._pixels(p)["frame"], "")

    @unittest.skipUnless(PICS.is_dir(), "the comparison's pictures are not on this machine")
    def test_the_comparisons_real_pictures(self):
        bad = {"66eb778813a09278": "bars",                                     # c066: letterbox bars
               "762d56872c679d77": "parts",                                    # c006: two strips stacked on white
               "6cb6999a1d1b21fb": "frame"}                                    # c050: two photos on white
        for name, kind in bad.items():
            px = M._pixels(PICS / f"{name}.jpg")
            self.assertTrue(px["frame"] if kind == "frame" else px["frame"] == kind, (name, px))
        self.assertEqual(M._pixels(PICS / "1abfbe25568bff13.jpg")["gloss"], 2)   # c057: the HDR Sistine Hall
        self.assertLess(M._pixels(PICS / "7cb5015fcb0fa07c.jpg")["gloss"], 2)    # c085: a warm view, judges split
        # the 22 pictures both adjudicators (or all three setups, unadjudicated) called kind or exact
        good = ["18eac2078ba32073", "1a754a7985c0c69f", "2cf3c3bc43bf4abf", "2f8af1078e74c1a7", "37fdc49a40f99f58",
                "3a42d7c6a31e539f", "43bb75afaae011d8", "4fb53a1aca7c2306", "50481303658544ad", "64ee1d92d11981bb",
                "7cf609850559dbc8", "9678894d7cfe701b", "a33d46a6a026c341", "a72d50c3b9130ab3", "af26ada0c0d426f5",
                "b04a8faf49bf4972", "ba470d068a8ad041", "bee8c780ce853bc3", "d7802bb965cea414", "db0a22b33967a2c5",
                "e1302170b44c8fc4", "e22542c9fa2c1476"]
        flagged = [n for n in good if M._pixels(PICS / f"{n}.jpg")["frame"] or M._pixels(PICS / f"{n}.jpg")["gloss"]]
        self.assertEqual(flagged, [])


# ── in the check ───────────────────────────────────────────────────────────────────────────────────────────────────
class InJudge(Tmp):
    row = {"text": "The scribe copied the codex.", "entities": [], "era": "4th century"}
    dossier = {"period": "4th century", "visualBrief": {"tone": "dark"}}

    def test_a_framed_picture_is_never_sent_and_goes_to_the_crop(self):
        gem = FakeGemini()
        e = Engine(gem)
        bars = framed(self.d / "pics" / "bars.jpg", "bars")
        plain = textured(self.d / "pics" / "plain.jpg", 7, size=(2000, 1125))
        out = M.judge(e, self.row, [({"title": "barred"}, bars), ({"title": "plain"}, plain)], self.dossier)
        self.assertEqual(len(gem.calls), 1)
        self.assertEqual(gem.calls[0]["labels"], ["Picture 1 - caption: plain"])
        v = next(c for c in out if c["title"] == "barred")
        self.assertEqual((v["bad"], v["looked"], v["pixel"], v.get("unjudged")), (["frame"], "pixel", "bars", None))
        self.assertEqual([c["title"] for c in out], ["plain", "barred"])
        self.assertTrue(M._frame_only(self.row, v))
        self.assertTrue(M._crop_fits(v["photo"], v["trim"]))
        self.assertEqual(M.VSTAT.get("pixel_frame"), 1)
        # the crop: cut to the box inside the bars, a picture of its own, asked once
        cv = M._crop_recheck(e, self.row, v, self.dossier)
        self.assertEqual(len(gem.calls), 2)
        self.assertEqual(gem.calls[1]["purpose"], "frame recheck")
        self.assertTrue(Path(cv["photo"]).name.endswith("t.jpg"))
        self.assertEqual(M._pixels(cv["photo"])["frame"], "")
        self.assertTrue(M._usable(self.row, cv))
        x0, y0, x1, y1 = M._crop_box(2000, 1125, box=v["trim"])
        with Image.open(cv["photo"]) as im:
            self.assertEqual(im.size, (x1 - x0, y1 - y0))                     # its own pixels, the bars cut off

    def test_parts_too_narrow_for_a_crop_stay_refused(self):
        side = framed(self.d / "pics" / "side.jpg", "side", size=(1600, 900))
        out = M.judge(Engine(FakeGemini()), self.row, [({"title": "two"}, side)], self.dossier)
        self.assertEqual(out[0]["bad"], ["frame"])
        self.assertFalse(M._crop_fits(out[0]["photo"], out[0]["trim"]))       # a panel 0.46 wide: under 800 px

    def test_gloss_refused_on_a_past_line_asked_on_a_present_one(self):
        gem = FakeGemini()
        e = Engine(gem)
        hdr = glossy(self.d / "pics" / "hdr.jpg")
        out = M.judge(e, self.row, [({"title": "hdr"}, hdr)], self.dossier)
        self.assertEqual((out[0]["bad"], out[0]["looked"], len(gem.calls)), (["glossy"], "pixel", 0))
        self.assertFalse(M._frame_only(self.row, out[0]))
        out = M.judge(e, {"text": "Tourists fill the hall today.", "era": "today"}, [({"title": "hdr"}, hdr)], {})
        self.assertEqual((out[0]["looked"], len(gem.calls)), ("asked", 1))

    def test_glossy_ranks_below_a_plain_picture_of_its_tier(self):
        gem = FakeGemini()
        half = glossy(self.d / "pics" / "half.jpg", grey_part=0.4)
        plain = textured(self.d / "pics" / "plain.jpg", 8)
        out = M.judge(Engine(gem), self.row, [({"title": "half", "pos": 0}, half), ({"title": "plain", "pos": 1}, plain)],
                      self.dossier)
        self.assertEqual(len(gem.calls[0]["paths"]), 2)                       # asked, both
        self.assertEqual([(c["title"], c.get("glossy", False)) for c in out], [("plain", False), ("half", True)])
        self.assertEqual(M.VSTAT.get("pixel_glossy_soft"), 1)

    def test_the_request_is_6f07aabs(self):
        gem = FakeGemini()
        pics = [({"title": "charter"}, textured(self.d / "pics" / "c.jpg", 11))]
        row = dict(self.row, entities=["Codex Example"])
        M.judge(Engine(gem), row, pics, self.dossier)
        call = gem.calls[0]
        self.assertTrue(call["lead"].startswith(M.CHECK_RULES + "\n" + M._check_film(self.dossier) + "\n\n<shot>"))
        self.assertTrue(call["lead"].endswith("\n" + M.ERA_Q.format(era="4th century") + "\n"))
        self.assertEqual(call["prompt"], M.FORMAT.format(extra='"modern": "", '))
        for gone in ("made", "same (asked", "other_era"):
            self.assertNotIn(gone, call["lead"] + call["prompt"])

    def test_a_refusal_without_shows_is_kept_and_not_asked_again(self):
        gem = FakeGemini(lambda cap: {"frame": True, "shows": None} if cap == "framed" else {})
        e = Engine(gem)
        pics = [({"title": "framed"}, textured(self.d / "pics" / "f.jpg", 9, size=(2000, 1125))),
                ({"title": "fine"}, textured(self.d / "pics" / "g.jpg", 10, size=(2000, 1125)))]
        out = M.judge(e, self.row, pics, self.dossier)
        f = next(c for c in out if c["title"] == "framed")
        self.assertEqual((f["bad"], f["shows"], f["looked"], f.get("unjudged")), (["frame"], "", "asked", None))
        self.assertTrue(M._frame_only(self.row, f))
        again = M.judge(e, self.row, pics, self.dossier)
        self.assertEqual(len(gem.calls), 1)                                   # both stored, nothing asked again
        self.assertEqual({c["looked"] for c in again}, {"stored"})


class Settings(unittest.TestCase):
    def test_flash_lite_at_low_from_the_environment(self):
        """MRTRUTH_JUDGE_MODEL=gemini-3.5-flash-lite and MRTRUTH_JUDGE_MEDIA=LOW reach the request, the question set and
        the stored answer's resolution (a fresh interpreter: the settings are read at import)."""
        code = r'''
import json, os, sys, tempfile
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[2])
import mrtruth as M, verdicts as V
from test_mrtruth_a2 import Engine, FakeGemini, textured
d = tempfile.mkdtemp()
os.environ["MRTRUTH_VERDICTS_DB"] = d + "/v.sqlite"
M.VERDICTS.update(store=None, film="f")
gem = FakeGemini()
out = M.judge(Engine(gem), {"text": "A line.", "era": "1980s"}, [({"title": "a"}, textured(d + "/a.jpg", 1))], {})
st = M.VERDICTS["store"]
rows = st.db.execute("SELECT media, model FROM v").fetchall()
print(json.dumps({"model": M.JUDGE_MODEL, "media": M.JUDGE_MEDIA, "thinking": M.JUDGE_THINKING,
                  "call": [gem.calls[0][k] for k in ("model", "media", "thinking")], "rows": rows,
                  "tier": out[0]["tier"]}))
'''
        env = dict(os.environ, MRTRUTH_JUDGE_MODEL="gemini-3.5-flash-lite", MRTRUTH_JUDGE_MEDIA="low",
                   MRTRUTH_VERDICTS="on", MRTRUTH_JUDGE="yesno")
        r = subprocess.run([sys.executable, "-c", code, str(HERE), str(Path(__file__).resolve().parent)],
                           capture_output=True, text=True, env=env, timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        got = json.loads(r.stdout.strip().splitlines()[-1])
        self.assertEqual((got["model"], got["media"], got["thinking"]), ("gemini-3.5-flash-lite", "LOW", "low"))
        self.assertEqual(got["call"], ["gemini-3.5-flash-lite", "LOW", "low"])
        self.assertEqual(got["rows"], [[1, "gemini-3.5-flash-lite"]])        # kept as seen at LOW, by that model
        self.assertEqual(got["tier"], M.KIND)


if __name__ == "__main__":
    unittest.main()
