"""Mr Truth C1 (2026-10-10): repeats and AI stand-ins counted the owner's way - one photo identity for main pictures and
companions, the three picture passes (own pictures, the stand-ins spread by need and counted on screen, then repeats
within the cap / joins / holds / weaker pictures / stop), the split parts' pictures, and the reuse guard on the final
cut. Synthetic data only: no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_reuse -v
"""
import copy
import hashlib
import os
import random
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import mrtruth as M  # noqa: E402
from tests.test_mrtruth_a2 import FakeGemini, textured  # noqa: E402


def ident(path):
    """A made-up identity: '/p/g7~b.jpg' and '/p/g7~c.jpg' are one photo (a near copy under another path)."""
    name = Path(str(path)).stem.split("~")[0]
    return (hashlib.sha1(name.encode()).hexdigest(), None, None)


def cand(name, tier=M.KIND, subject="", person=False, clean=True, **kw):
    return dict(photo=f"/p/{name}.jpg", tier=tier, clean=clean, bad=[] if clean else ["text"], subject=subject,
                person=person, provider="bing", looked="asked", score=M._SCORE_OF[tier], **kw)


def film(n, ms=4000, gap=None):
    """n shots of `ms` each (or the lengths in `gap`)."""
    rows, t = [], 0
    for k in range(n):
        d = gap[k] if gap else ms
        rows.append({"startMs": t, "endMs": t + d, "text": f"line {k} of the made-up film", "device": None,
                     "visualIntent": f"thing {k}", "entities": [], "about": ""})
        t += d
    return rows


class Eng:
    def __init__(self, used=0):
        self.lines, self.AI_IMAGE_CAP, self._AI_IMAGES, self._AI_LOCK = [], 30, {"used": used}, threading.Lock()

    def log(self, s):
        self.lines.append(s)

    def ai_image_slot(self, label):
        with self._AI_LOCK:
            if self._AI_IMAGES["used"] >= self.AI_IMAGE_CAP:
                raise RuntimeError(f"{label}: AI picture limit ({self.AI_IMAGE_CAP}) for this video reached")
            self._AI_IMAGES["used"] += 1


class FakeAI:
    """_ai_picture as the passes call it: each try spends one drawing from the film's budget, accept(i, try) decides."""

    def __init__(self, accept=lambda i, k: True, delay=None):
        self.accept, self.delay, self.calls, self.lock = accept, delay, [], threading.Lock()
        self.inflight = self.most = 0

    def __call__(self, engine, job, row, i, dossier=None, role="", look="", before="", after="", mode="", tries=2):
        with self.lock:
            self.calls.append((i, mode, tries, role))
            self.inflight += 1
            self.most = max(self.most, self.inflight)
        try:
            for k in range(tries):
                if M._draw_room() < 1:
                    return None
                M._spend(1)
                if self.delay:
                    time.sleep(self.delay(i, k))
                if self.accept(i, k):
                    return {"photo": f"/ai/ai{i}x{k}.jpg", "ai": True, "tier": M.KIND, "clean": True, "bad": [],
                            "person": mode == "him", "ai_mode": mode, "subject": ""}
            return None
        finally:
            with self.lock:
                self.inflight -= 1


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.job = Path(self.tmp.name) / "job"
        (self.job / "mrtruth").mkdir(parents=True)
        self.patches = [mock.patch.object(M, "_ident", ident), mock.patch.object(M, "_luma", lambda p: 0.3),
                        mock.patch.object(M, "_type_shade", lambda *a: 0.0),
                        mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "0", "MRTRUTH_VERDICTS": "off"})]
        for p in self.patches:
            p.start()
        M.BUDGET.clear()
        M.DEV_DROPS.clear()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        M.BUDGET.clear()
        self.tmp.cleanup()

    def choose(self, rows, found, states=None, borrowed=None, ai=None, at_once=1, **budget):
        eng = Eng()
        M._budget_set(eng, rows)
        M.BUDGET.update(budget)
        ai = ai or FakeAI()
        states = states or [{} for _ in rows]
        borrowed = borrowed or [[] for _ in rows]
        with mock.patch.object(M, "_ai_picture", ai), mock.patch.object(M, "AI_AT_ONCE", at_once):
            info = M._choose(eng, self.job, rows, states, found, borrowed, {})
        return info, eng, ai


def showings(rows):
    """{photo identity: [startMs...]} of the main pictures."""
    out = {}
    for r in rows:
        p = r.get("pick")
        if p and not p.get("ai"):
            out.setdefault(ident(p["photo"])[0], []).append(r["startMs"])
    return out


def shortest(rows):
    gaps = [b - a for t in showings(rows).values() for a, b in zip(sorted(t), sorted(t)[1:])]
    return min(gaps, default=10 ** 9) / 1000


# ── one photo identity ─────────────────────────────────────────────────────────────────────────────────────────
class Identity(unittest.TestCase):
    def test_a_near_copy_under_another_path_is_one_photo_and_counts_twice(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            a = textured(Path(d) / "a.jpg", 3)
            b = Path(d) / "copy.jpg"
            Image.open(a).resize((800, 450)).save(b, quality=70)          # the same photo, smaller, re-encoded
            c = textured(Path(d) / "c.jpg", 4)
            led = M._Ledger()
            led.add(a, 0, "row 0")
            led.add(b, 120000, ("comp", 1, 0))
            self.assertEqual(led.n(a), 2)                                   # main + companion: two showings
            self.assertEqual(led.n(c), 0)
            self.assertEqual(led.gap(b, 30000), 30000)
            self.assertEqual(led.repeats(), 1)
            self.assertFalse(M._distinct(str(b), [str(a)]))
            self.assertTrue(M._distinct(str(c), [str(a)]))


# ── B: the stand-ins, spread by need and counted on screen ──────────────────────────────────────────────────────
class Stand(Base):
    def test_allocation_order_unrepeatable_first_then_densest_then_soft(self):
        rows = film(40, 5000)                                   # 200 s: nothing near the middle can keep 105 s
        found = [[cand(f"own{k}", subject=f"s{k}")] for k in range(40)]
        states = [{} for _ in rows]
        for k in (19, 20, 2, 3, 4, 36):                         # open: nothing of their own
            found[k] = []
        found[30] = [cand("weak30", subject="s26")]             # a weak picture: its subject 4 shots back
        found[33] = [cand("thing33", subject="t33")]            # a line about the stand-in, a picture without a person
        states[33] = {"stand_in": "an elderly priest", "stand_look": "white hair"}
        info, eng, ai = self.choose(rows, found, states, ai=FakeAI(lambda i, k: True))
        order = [c[0] for c in ai.calls]
        self.assertEqual(order, [19, 20, 2, 3, 4, 36, 33, 30])
        self.assertEqual([c[1] for c in ai.calls if c[0] == 33], ["him"])
        self.assertEqual([c[3] for c in ai.calls if c[0] != 33], [""] * 7)   # the protagonist only on his own lines
        self.assertTrue(all(rows[k]["step"] == "ai" for k in order))

    def test_refused_drawings_do_not_use_up_the_stand_ins_on_screen(self):
        rows = film(60, 5000)
        found = [[cand(f"own{k}")] if k % 2 else [] for k in range(60)]
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: k == 1), cap=10, draw_cap=30)
        self.assertEqual(info["ai_shown"], 10)                  # 10 on screen from 20 drawings (the old rule: 5)
        self.assertEqual(M.BUDGET["drawings"], 20)
        self.assertLessEqual(sum(1 for r in rows if (r.get("pick") or {}).get("ai")), 10)

    def test_every_drawing_refused_stops_at_the_drawing_budget(self):
        rows = film(60, 4000)
        found = [[cand(f"own{k}")] if k % 3 else [] for k in range(60)]
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False), cap=10, draw_cap=20)
        self.assertEqual(M.BUDGET["drawings"], 20)
        self.assertEqual(info["ai_shown"], 0)
        self.assertTrue(all(r.get("pick") or r.get("hold") for r in rows))
        self.assertGreaterEqual(shortest(rows), M.REUSE_GAP_S + M.REUSE_MARGIN_S)
        self.assertTrue(all(len(t) <= 2 for t in showings(rows).values()))

    def test_at_most_six_in_any_minute(self):
        rows = film(100, 2500)                                  # the first 50 s all open
        found = [[] if k < 20 else [cand(f"own{k}")] for k in range(100)]
        info, eng, ai = self.choose(rows, found, ai=FakeAI(), cap=40, draw_cap=80)
        ts = sorted(r["startMs"] for r in rows if (r.get("pick") or {}).get("ai"))
        self.assertTrue(ts)
        self.assertTrue(all(sum(1 for y in ts if x <= y <= x + 60000) <= M.AI_WINDOW_MAX for x in ts))
        self.assertGreater(info["skipped_window"], 0)

    def test_drawn_side_by_side_the_result_is_the_orders_not_the_threads(self):
        rows = film(150, 4000)                                  # 10 minutes, 50 open shots
        found = [[cand(f"own{k}")] if k % 3 else [] for k in range(150)]
        accept = lambda i, k: int(hashlib.sha1(f"{i}/{k}".encode()).hexdigest(), 16) % 3 != 0
        runs = []
        for at_once, seed in ((1, 0), (8, 1), (8, 2), (16, 3)):
            rng = random.Random(seed)
            fake = FakeAI(accept, delay=lambda i, k: rng.random() * 0.004)
            rs = copy.deepcopy(rows)
            info, eng, ai = self.choose(rs, copy.deepcopy(found), ai=fake, at_once=at_once, cap=30, draw_cap=40)
            self.assertLessEqual(info["ai_shown"], 30)
            self.assertLessEqual(M.BUDGET["drawings"], 40)
            runs.append(([(r.get("pick") or {}).get("photo") for r in rs], M.BUDGET["drawings"], sorted(c[0] for c in ai.calls)))
            if at_once > 1:
                self.assertGreater(fake.most, 1)                # they really were drawn side by side
        self.assertTrue(all(r == runs[0] for r in runs[1:]))

    def test_a_line_about_him_beside_a_person_gets_his_place_not_a_second_person(self):
        rows = film(30, 4000)
        found = [[cand(f"own{k}")] for k in range(30)]
        states = [{} for _ in rows]
        found[4] = [cand("person4", person=True)]               # a photo of a person before shot 5
        found[5] = []
        found[6] = [cand("person6", person=True)]
        found[8] = [cand("desk8")]                              # soft: his things, no person, beside a person
        found[9] = [cand("person9", person=True)]
        found[7] = [cand("own7")]
        found[15] = []
        for k in (5, 8, 15):
            states[k] = {"stand_in": "an elderly priest", "stand_look": "white hair"}
        info, eng, ai = self.choose(rows, found, states)
        modes = {c[0]: c[1] for c in ai.calls}
        self.assertEqual(modes.get(5), "place")                 # what he reads or where he is: no person in it
        self.assertNotIn(8, modes)                              # his real things beat a drawn room
        self.assertEqual(rows[8]["pick"]["photo"], "/p/desk8.jpg")
        self.assertEqual(modes.get(15), "him")


# ── C: what is still open ───────────────────────────────────────────────────────────────────────────────────────
class Open(Base):
    def test_a_soft_shot_keeps_its_fallback_when_no_stand_in_comes(self):
        rows = film(30)
        found = [[cand(f"own{k}", subject=f"s{k}")] for k in range(30)]
        found[11] = [cand("weak11", subject="s7")]             # its subject 4 shots back: weak, not unusable
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False))
        self.assertEqual((rows[11]["pick"]["photo"], rows[11]["step"]), ("/p/weak11.jpg", "contextual"))

    def test_a_repeat_keeps_the_gap_either_way_and_prefers_this_lines_own_picture(self):
        rows = film(100, 4000)                                  # 400 s
        found = [[cand(f"own{k}")] for k in range(100)]
        found[60] = [cand("own10~copy")]                        # this line's own picture: a copy of shot 10's
        found[55] = [cand("own55")]
        found[3] = []                                           # an early open shot: a LATER photo may come first
        rows[2]["device"] = rows[4]["device"] = {"id": "shadow-up"}   # no plain neighbour to join
        found[60 - 1], found[60 + 1] = [cand("own59")], [cand("own61")]
        rows[59]["device"] = rows[61]["device"] = {"id": "shadow-up"}
        found[60] = [cand("own10~copy")]
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False))
        self.assertEqual((rows[60]["pick"]["photo"], rows[60]["step"]), ("/p/own10~copy.jpg", "reused"))
        self.assertTrue(rows[60]["reuse_alts"])
        self.assertEqual(rows[3]["step"], "reused")
        t3 = showings(rows)[ident(rows[3]["pick"]["photo"])[0]]
        self.assertGreaterEqual(min(abs(t - rows[3]["startMs"]) for t in t3 if t != rows[3]["startMs"]),
                                (M.REUSE_GAP_S + M.REUSE_MARGIN_S) * 1000)
        self.assertTrue(all(len(t) <= 2 for t in showings(rows).values()))
        self.assertGreaterEqual(shortest(rows), M.REUSE_GAP_S + M.REUSE_MARGIN_S)

    def test_joined_to_the_plain_shot_before_else_after(self):
        rows = film(20, 4000)                                   # 80 s: no repeat can keep the gap
        found = [[cand(f"own{k}")] for k in range(20)]
        found[5] = found[12] = []
        rows[11]["device"] = {"id": "shadow-up"}                # 12: the shot before carries words
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False))
        self.assertEqual(len(rows), 18)
        self.assertEqual((rows[4]["startMs"], rows[4]["endMs"]), (16000, 24000))   # 5 went into 4
        self.assertIn("line 5", rows[4]["text"])
        after = next(r for r in rows if "line 12" in r["text"])
        self.assertEqual((after["startMs"], after["endMs"], after["pick"]["photo"]), (48000, 56000, "/p/own13.jpg"))
        self.assertEqual(info["joined"], 2)
        self.assertTrue(all(r["endMs"] - r["startMs"] <= M.SCENE_MAX_S * 1000 for r in rows))

    def test_a_long_hold_only_late_and_only_instead_of_a_repeat(self):
        rows = film(140, 6000)                                  # 14 min of 6 s shots: no join fits in 8 s
        found = [[cand(f"own{k}")] for k in range(140)]
        found[125] = []                                         # at 12:30
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False), reuse_cap=0)
        held = next(r for r in rows if "line 125" in r["text"])
        self.assertTrue(held.get("hold"))
        self.assertEqual((held["startMs"], held["endMs"]), (124 * 6000, 126 * 6000))
        self.assertEqual(info["holds"], 1)

    def test_a_weaker_unused_picture_before_a_repeat_over_the_cap_then_over_the_cap_logged(self):
        rows = film(60, 6000)                                   # 6 min of 6 s shots
        found = [[cand(f"own{k}")] for k in range(60)]
        found[40] = [cand("generic40", tier=M.GENERIC)]
        found[45] = []
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False), reuse_cap=0)
        self.assertEqual((rows[40]["pick"]["photo"], rows[40]["step"]), ("/p/generic40.jpg", "contextual"))
        self.assertEqual(rows[45]["step"], "reused")
        self.assertTrue(rows[45]["pick"]["over_cap"])
        self.assertEqual(info["over_cap"], 1)
        self.assertTrue(any("over the cap" in l for l in eng.lines))

    def test_nothing_left_stops_with_the_reason_never_a_close_repeat(self):
        rows = film(25, 6000)                                   # 150 s; shot 10 in the middle
        found = [[cand(f"own{k}")] for k in range(25)]
        found[10] = []
        with self.assertRaises(M.PlanningStopped) as x:
            self.choose(rows, found, ai=FakeAI(lambda i, k: False))
        self.assertIn("shot 10 at 1:00 has no picture", str(x.exception))
        rows = film(25, 6000)
        with mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "1"}):
            info, eng, ai = self.choose(rows, copy.deepcopy(found), ai=FakeAI(lambda i, k: False))
        self.assertEqual(rows[10]["step"], "reused")            # carried on: the least-shown photo, logged
        self.assertTrue(any("carrying on" in l for l in eng.lines))

    def test_last_before_a_stop_a_repeat_at_90_s_without_the_margin_logged(self):
        rows = film(17, 6000)                                   # 102 s: 90 s apart is possible, 105 s is not
        found = [[cand(f"own{k}")] for k in range(17)]
        found[16] = []
        rows[15]["device"] = {"id": "shadow-up"}               # no plain shot to join
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False))
        self.assertEqual((rows[16]["step"], rows[16]["pick"]["photo"]), ("reused", "/p/own0.jpg"))
        self.assertTrue(rows[16]["pick"]["tight"])
        self.assertEqual(info["tight"], 1)
        self.assertTrue(any("only 90-105s from their other showing" in l for l in eng.lines))

    def test_a_photo_already_shown_twice_never_comes_back(self):
        rows = film(120, 4000)
        found = [[cand(f"own{k}")] for k in range(120)]
        found[10] = [cand("own10")]
        for k in (50, 90):                                      # two open shots that could only take own10
            found[k] = [cand("own10~again")]
            rows[k - 1]["device"] = rows[k + 1]["device"] = {"id": "shadow-up"}
        info, eng, ai = self.choose(rows, found, ai=FakeAI(lambda i, k: False))
        self.assertTrue(all(len(t) <= 2 for t in showings(rows).values()))


# ── A9: what a stand-in is drawn as ─────────────────────────────────────────────────────────────────────────────
class Drawn(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)
        M.BUDGET.clear()
        M.VSTAT.clear()
        M.VERDICTS.update(store=None, film="film-c1")

    def tearDown(self):
        M.BUDGET.clear()
        M.VERDICTS.update(store=None, film="")
        self.tmp.cleanup()

    def draw(self, row, plan, mode="", role="", dossier=None, tries=2):
        prompts, gem = [], FakeGemini(plan)
        e = Eng()
        e.pick_vision = gem

        def fake(engine, prompt, dest, label):
            prompts.append(prompt)
            textured(dest, len(prompts) + 50, (1536, 864))
        with mock.patch.object(M, "_draw_ai", fake), mock.patch.dict(os.environ, {"MRTRUTH_VERDICTS": "off"}):
            pick = M._ai_picture(e, self.d / "job", row, 3, dossier or {}, role, "", "", "", mode=mode, tries=tries)
        return pick, prompts, gem

    def test_a_writing_line_is_drawn_as_the_object_closed_or_turned_away(self):
        row = {"text": "The order was noted in the margin.", "visualIntent": "A handwritten notation on an old register"}
        pick, prompts, _ = self.draw(row, lambda cap: {"shows": "kind", "warped": False})
        self.assertIn("no writing can be read", prompts[0])
        self.assertTrue(M._writing(row))
        self.assertFalse(M._writing({"visualIntent": "A Ge'ez manuscript page with red rubrics"}))   # the owner's rule
        self.assertFalse(M._writing({"visualIntent": "A dim reading room with empty desks"}))

    def test_the_protagonist_is_never_put_into_a_line_not_about_him(self):
        brief = {"visualBrief": {"people": [{"name": "Father Nobody", "role": "an elderly priest", "appearance":
                                             "white hair, black cassock", "likenessKnown": False}]}}
        row = {"text": "The reading room stayed empty.", "visualIntent": "A dim reading room with empty desks"}
        pick, prompts, _ = self.draw(row, lambda cap: {"shows": "kind", "warped": False}, dossier=brief)
        self.assertNotIn("elderly priest", prompts[0])
        self.assertIn("Any person is anonymous", prompts[0])
        self.assertEqual(pick["ai_mode"], "thing")

    def test_his_place_shows_nobody_and_a_person_in_it_refuses_it(self):
        row = {"text": "He came back to the same desk.", "visualIntent": "The priest at his desk"}
        pick, prompts, gem = self.draw(row, lambda cap: {"shows": "kind", "person": True, "warped": False}, mode="place",
                                       role="an elderly priest")
        self.assertIsNone(pick)
        self.assertIn("NO person in view", prompts[0])
        self.assertEqual(len(prompts), 2)
        self.assertNotIn("stand-in:", gem.calls[0]["lead"])     # no stand-in in the question for an empty room
        pick, prompts, gem = self.draw(dict(row, text="He came back to the same desk again."),
                                       lambda cap: {"shows": "kind", "person": False, "warped": False}, mode="place",
                                       role="an elderly priest")
        self.assertTrue(pick and not pick["person"] and pick["ai_mode"] == "place")

    def test_drawings_stop_when_the_films_budget_is_spent_cached_ones_included(self):
        row = {"text": "A line.", "visualIntent": "A stone corridor"}
        M.BUDGET.update(cap=4, draw_cap=1, drawn=0.0, drawings=0)
        pick, prompts, _ = self.draw(row, lambda cap: {"shows": "generic", "warped": False})   # refused at kind, loose second try
        self.assertIsNone(pick)
        self.assertEqual((len(prompts), M.BUDGET["drawings"]), (1, 1))        # the second try was not drawn
        M.BUDGET.update(drawn=0.0, drawings=0, draw_cap=5)
        pick, prompts, _ = self.draw(row, lambda cap: {"shows": "generic", "warped": False})
        self.assertEqual(len(prompts), 1)                       # the first drawing is cached: claimed, not drawn
        self.assertEqual(M.BUDGET["drawings"], 2)
        self.assertTrue(pick and pick["tier"] == M.GENERIC)

    def test_two_films_in_one_process_have_their_own_budgets(self):
        rows = film(165, 4000)                                  # 11 min
        e = Eng(used=30)                                        # an earlier film drew 30 in this process
        b = M._budget_set(e, rows)
        self.assertEqual((b["cap"], b["draw_cap"], b["reuse_cap"]), (44, 88, 38))
        self.assertEqual(e.AI_IMAGE_CAP, 30 + 88)
        self.assertEqual(b["drawn"], 0)
        b2 = M._budget_set(Eng(used=0), film(300, 4000))       # 20 min
        self.assertEqual((b2["cap"], b2["draw_cap"], b2["reuse_cap"]), (80, 160, 70))


class CachedRerun(Base):
    def test_a_rerun_with_the_drawings_and_their_checks_cached_makes_the_same_choices(self):
        rows = film(40, 5000)
        found = [[cand(f"own{k}")] if k % 4 else [] for k in range(40)]
        drawn = []

        def fake_draw(engine, prompt, dest, label):
            drawn.append(prompt)
            textured(dest, int(hashlib.sha1(prompt.encode()).hexdigest()[:6], 16), (1536, 864))
        gem = FakeGemini(lambda cap: {"shows": "kind", "warped": False})
        picks = []
        for run in range(2):
            rs, eng = copy.deepcopy(rows), Eng()
            eng.pick_vision = gem
            M._budget_set(eng, rs)
            with mock.patch.object(M, "_draw_ai", fake_draw):
                M._choose(eng, self.job, rs, [{} for _ in rs], copy.deepcopy(found), [[] for _ in rs], {})
            picks.append(([(r.get("pick") or {}).get("photo") for r in rs], M.BUDGET["drawings"], len(drawn)))
        self.assertGreater(picks[0][2], 0)                      # the first run drew stand-ins
        self.assertTrue(any(p and "/ai_" in p for p in picks[0][0]))
        self.assertEqual(picks[0][0], picks[1][0])
        self.assertEqual(picks[0][1], picks[1][1])              # a cached drawing still counts against the budget
        self.assertEqual(picks[1][2], picks[0][2])              # ...but nothing is drawn again


# ── companions are showings ─────────────────────────────────────────────────────────────────────────────────────
class Companions(Base):
    def test_companions_are_never_on_screen_elsewhere_and_the_gallery_previews_photos_shown_once(self):
        rows = film(80, 4000)
        for k, r in enumerate(rows):
            r["pick"], r["step"], r["spare"] = cand(f"main{k}"), "exact", []
        rows[1]["device"] = {"id": "gallery-strip"}
        rows[40]["device"] = {"id": "P22"}
        rows[44]["device"] = {"id": "P19"}
        rows[40]["spare"] = [cand("main70~copy"), cand("s40a"), cand("s40b"), cand("s40c")]   # a copy of shot 70's
        rows[44]["spare"] = [cand("s40a~copy"), cand("s44a"), cand("s44b"), cand("s44c")]     # one of shot 40's
        rows[30]["pick"] = cand("main60~again")                 # main60 is on screen twice already
        M._fit_devices(rows)
        gal = [c["photo"] for c in rows[1]["companions"]]
        self.assertEqual(len(gal), 4)
        self.assertNotIn("/p/main60.jpg", gal)
        self.assertTrue(all(int(Path(p).stem[4:]) * 4000 >= 105000 for p in gal))
        self.assertEqual([c["photo"] for c in rows[40]["companions"]], ["/p/s40a.jpg", "/p/s40b.jpg", "/p/s40c.jpg"])
        self.assertEqual([c["photo"] for c in rows[44]["companions"]], ["/p/s44a.jpg", "/p/s44b.jpg", "/p/s44c.jpg"])
        led = M._final_ledger(rows)
        self.assertTrue(all(len(at) <= 2 for at in led.at))


# ── after the last sync: the split parts and the guard ──────────────────────────────────────────────────────────
def final(n, ms=5000):
    rows = film(n, ms)
    for k, r in enumerate(rows):
        r.update(pick=cand(f"m{k}"), step="exact", spare=[], _said=(r["startMs"], r["endMs"]))
    return rows


class Parts(Base):
    def part(self, rows, k, pool):
        rows[k].update(needs_picture=True, split=True, pool=pool, step="split-same", pick=dict(rows[k - 1]["pick"]))

    def test_a_part_takes_an_unused_runner_up_then_a_stand_in_then_a_repeat_then_stops(self):
        rows = final(100)                                       # 500 s
        self.part(rows, 10, [cand("m30"), cand("unused10")])    # m30 is on screen: not "unused"
        self.part(rows, 50, [cand("m51~copy")])                 # every runner-up on screen: a stand-in
        self.part(rows, 80, [])
        eng = Eng()
        M._budget_set(eng, rows)
        M.BUDGET.update(cap=1)                                  # one stand-in: shot 80 takes a repeat
        with mock.patch.object(M, "_ai_picture", FakeAI()):
            out = M.fill_parts(eng, self.job, rows, {})
        self.assertEqual((rows[10]["pick"]["photo"], rows[10]["step"]), ("/p/unused10.jpg", "split-spare"))
        self.assertEqual(rows[50]["step"], "ai")
        self.assertEqual(rows[80]["step"], "split-reused")
        t = showings(rows)[ident(rows[80]["pick"]["photo"])[0]]
        self.assertGreaterEqual(max(t) - min(t), M.REUSE_GAP_S * 1000)
        self.assertFalse(any(r.get("needs_picture") for r in rows))
        self.assertEqual(out, {"fresh": 1, "ai": 1, "reused": 1})
        rows = final(20)                                        # 100 s: nothing may come back
        self.part(rows, 10, [])
        eng = Eng()
        M._budget_set(eng, rows)
        M.BUDGET.update(cap=0)
        with self.assertRaises(M.PlanningStopped):
            M.fill_parts(eng, self.job, rows, {})


class Guard(Base):
    def test_cut_shifts_that_bring_repeats_under_90_s_are_all_repaired_without_moving_words(self):
        rng, fixed = random.Random(7), 0
        for trial in range(25):
            rows = final(120, 5000)                             # 600 s
            for k in range(0, 120, 7):                          # words on screen on every 7th shot
                rows[k]["typedCaption"] = {"lines": ["x"]}
            reps = []
            for k in range(25, 120, 10):                        # repeats 17-18 shots (85-90 s) after their photo
                src = k - 17 - (k // 10) % 2
                rows[k].update(pick=dict(cand(f"m{src}~r{k}"), reused=True), step="reused",
                               reuse_alts=[cand(f"m{max(0, k - 40)}")], spare=[cand(f"fresh{k}")] if k % 3 else [])
                reps.append(k)
            for k in range(1, 120):                             # the final cut moves each cut up to ±2.5 s
                if rows[k].get("typedCaption") or rows[k - 1].get("typedCaption"):
                    continue
                lo = max(rows[k - 1]["startMs"] + 1000, rows[k]["startMs"] - 2500)
                hi = min(rows[k - 1]["startMs"] + 8000, rows[k]["startMs"] + 2500, rows[k]["endMs"] - 1000)
                rows[k - 1]["endMs"] = rows[k]["startMs"] = rng.randint(lo, max(lo, hi))
            words = [(r["startMs"], r["typedCaption"]["lines"][0]) for r in rows if r.get("typedCaption")]
            eng = Eng()
            M._budget_set(eng, rows)
            M.BUDGET.update(cap=0)
            with mock.patch.object(M, "sync_overlays", side_effect=AssertionError("sync must not run again")):
                out = M._reuse_guard(eng, self.job, rows, {})
            self.assertEqual(out["under_gap"], 0, trial)
            fixed += sum(out["guard"].values())
            self.assertEqual(out["photos_on_3plus"], 0)
            self.assertEqual(out["same_photo_next_shot"], 0)
            self.assertEqual(words, [(r["startMs"], r["typedCaption"]["lines"][0]) for r in rows if r.get("typedCaption")])
            self.assertTrue(all(a["endMs"] == b["startMs"] for a, b in zip(rows, rows[1:])))
            self.assertTrue(all(r.get("pick") for r in rows))
            self.assertTrue(all(r["endMs"] - r["startMs"] <= M.SCENE_MAX_S * 1000 for r in rows))
        self.assertGreater(fixed, 100)                          # 25 films of 10 repeats, most of them under 90 s

    def test_nothing_to_swap_the_shot_is_joined_to_a_plain_neighbour_else_the_planner_stops(self):
        rows = final(30, 3000)                                  # 90 s: no photo may come back anywhere
        rows[12].update(pick=dict(cand("m3~r"), reused=True), step="reused")      # 27 s after shot 3
        eng = Eng()
        M._budget_set(eng, rows)
        M.BUDGET.update(cap=0)
        out = M._reuse_guard(eng, self.job, rows, {})
        self.assertEqual(out["guard"], {"joined to the shot beside it": 1})
        self.assertEqual(len(rows), 29)
        self.assertEqual((rows[11]["startMs"], rows[11]["endMs"], rows[11]["pick"]["photo"]), (33000, 39000, "/p/m11.jpg"))
        rows = final(30, 3000)
        rows[12].update(pick=dict(cand("m3~r"), reused=True), step="reused")
        rows[11]["typedCaption"] = rows[13]["typedCaption"] = {"lines": ["words"]}
        eng = Eng()
        M._budget_set(eng, rows)
        M.BUDGET.update(cap=0)
        with self.assertRaises(M.PlanningStopped) as x:
            M._reuse_guard(eng, self.job, rows, {})
        self.assertIn("back after 27s on the final cut", str(x.exception))

    def test_a_companion_shown_as_a_main_picture_nearby_is_swapped(self):
        rows = final(100)
        rows[20]["device"] = {"id": "P22"}
        rows[20]["companions"] = [cand("m22~c"), cand("c2"), cand("c3")]   # shot 22's photo, 10 s away
        rows[20]["spare"] = [cand("unused20")]
        eng = Eng()
        M._budget_set(eng, rows)
        out = M._reuse_guard(eng, self.job, rows, {})
        self.assertEqual([c["photo"] for c in rows[20]["companions"]], ["/p/unused20.jpg", "/p/c2.jpg", "/p/c3.jpg"])
        self.assertEqual((out["under_gap"], out["guard"]), (0, {"companion swapped": 1}))

    def test_a_template_keeps_its_words_a_swap_that_would_change_it_is_undone(self):
        rows = final(100)
        M.PEOPLE_NAMES.clear()
        M.PEOPLE_NAMES.update({"nobody"})
        x = rows[50]
        x.update(device={"id": "corner-label", "headline": "Father Nobody"}, step="reused",
                 pick=dict(cand("m45~r", person=True), reused=True), stand_in="an elderly priest",
                 spare=[cand("room50")],                            # no person: the label would fall back
                 reuse_alts=[cand("m10", person=True)])
        eng = Eng()
        M._budget_set(eng, rows)
        try:
            out = M._reuse_guard(eng, self.job, rows, {})
        finally:
            M.PEOPLE_NAMES.clear()
        self.assertEqual(x["device"]["id"], "corner-label")
        self.assertEqual(x["pick"]["photo"], "/p/m10.jpg")
        self.assertEqual(out["under_gap"], 0)

    def test_the_cap_holds_repeats_over_it_become_unused_runner_ups(self):
        rows = final(160, 5000)                                 # 800 s
        for k in range(30, 160, 3):
            rows[k].update(pick=dict(cand(f"m{k - 25}~r"), reused=True), step="reused", spare=[cand(f"u{k}")])
        eng = Eng()
        M._budget_set(eng, rows)
        M.BUDGET.update(reuse_cap=10, cap=0)
        out = M._reuse_guard(eng, self.job, rows, {})
        self.assertLessEqual(out["repeats"], 10)
        self.assertEqual(out["under_gap"], 0)


# ── C2: the film's AI budget lasts until the last picture decision ──────────────────────────────────────────────
class Order(unittest.TestCase):
    def test_the_engines_cap_comes_back_only_after_the_guard(self):
        seen = {}
        eng = Eng()
        eng.AI_IMAGE_CAP = 30
        rows = film(10)

        def pics(engine, job, rows, dossier, force):
            engine.AI_IMAGE_CAP = 88

        def note(name):
            def f(engine, job, rows, *a, **k):
                seen[name] = engine.AI_IMAGE_CAP
                return {} if name != "cap_shots" else {"joins": 0, "splits": []}
            return f
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            (job / "script.txt").write_text("x")
            patches = [mock.patch.object(M, n, v) for n, v in (
                ("preflight", lambda e: None), ("research", lambda *a, **k: {}), ("visual_brief", lambda *a, **k: {}),
                ("beats", lambda *a, **k: rows), ("opportunities", lambda *a, **k: []), ("assign", lambda *a, **k: None),
                ("fill_overlays", lambda *a, **k: None), ("typed_captions", lambda *a, **k: None),
                ("pictures", pics), ("_fit_devices", lambda *a, **k: None), ("sync_overlays", lambda *a, **k: None),
                ("_gaps", lambda rows, spots=False: []), ("cap_shots", note("cap_shots")), ("fill_parts", note("fill_parts")),
                ("_reuse_guard", note("_reuse_guard")), ("gate", note("gate")), ("_gate_scenes", lambda *a, **k: []),
                ("transitions", lambda rows: None),
                ("scenes", lambda *a, **k: []), ("_credits", lambda *a, **k: None), ("_cues", lambda *a, **k: []))]
            for p in patches:
                p.start()
            try:
                M.plan_film(eng, job, job / "subs.srt", False, lambda step: None)
            finally:
                for p in patches:
                    p.stop()
        self.assertEqual(seen, {"cap_shots": 88, "fill_parts": 88, "_reuse_guard": 88, "gate": 88})   # the gate too (D1)
        self.assertEqual(eng.AI_IMAGE_CAP, 30)


if __name__ == "__main__":
    unittest.main()
