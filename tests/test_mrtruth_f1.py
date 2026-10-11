"""Mr Truth F1 (review fixes 2026-10-11): a tripped judge guard stops every later check before it is paid for, a
Claude fallback answer about a picture Claude never saw is dropped, the AI crop recheck lets a stop through, the gate's
final cut is what reuse.json records, and a beat overlay counts as words for the effects and the light-leak hold.
Synthetic data only: no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_f1 -v
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


class Claude:
    """engine.pick_vision when Gemini has failed: Claude answers every picture it is given (via "claude")."""

    def __init__(self, card=False, fallback=True):
        self.card, self.fallback, self.calls, self.lock = card, fallback, [], threading.Lock()
        self.engine = None

    def __call__(self, prompt, paths, max_tokens=800, model="", thinking="", purpose="", media="", lead="",
                 labels=None, info=None):
        with self.lock:
            self.calls.append({"n": len(paths), "purpose": purpose})
            if self.fallback and self.engine is not None:
                self.engine.GEMINI_PICKS["fallback"] += 1
        if info is not None:
            info.update(via="claude")
        if self.card:
            return json.dumps([{"n": n, "shows": True} for n in range(1, len(paths) + 1)])
        return json.dumps([answer(n) for n in range(1, len(paths) + 1)])


def claude_engine(card=False, calls=100, fallback=0):
    gem = Claude(card)
    e = Engine(gem)
    gem.engine = e
    e.GEMINI_PICKS.update(calls=calls, fallback=fallback)
    return e, gem


ROW = {"text": "A clay tablet lay in the dust.", "visualIntent": "a clay tablet", "entities": [], "startMs": 0,
       "endMs": 4000}


class JudgeGuard(Tmp):
    def setUp(self):
        super().setUp()
        self.j = mock.patch.dict(M.JUDGE, {"asks": 0, "failed": 0})
        self.j.start()

    def tearDown(self):
        self.j.stop()
        super().tearDown()

    def test_a_tripped_guard_stops_the_next_check_before_it_is_paid(self):
        e, gem = claude_engine(fallback=6)             # 6 > max(5, 5% of 100): tripped
        p = textured(self.d / "a.jpg", 1)
        with self.assertRaises(M.PlanningStopped):
            M.judge(e, dict(ROW), [({"title": "a tablet"}, p)], {})
        self.assertEqual(gem.calls, [])
        with self.assertRaises(M.PlanningStopped):
            M._ai_ok(e, p, dict(ROW), {})
        self.assertEqual(gem.calls, [])

    def test_below_the_line_the_check_is_asked_and_the_trip_stops_the_next(self):
        e, gem = claude_engine(fallback=5)             # at the line (5): still asked, its own fallback trips it
        with self.assertRaises(M.PlanningStopped):
            M.judge(e, dict(ROW), [({"title": "a tablet"}, textured(self.d / "a.jpg", 1))], {})
        self.assertEqual(len(gem.calls), 1)
        with self.assertRaises(M.PlanningStopped):
            M.judge(e, dict(ROW, text="Another line."), [({"title": "b"}, textured(self.d / "b.jpg", 2))], {})
        self.assertEqual(len(gem.calls), 1)            # the second is never paid for

    def test_thirty_workers_pay_nothing_after_the_trip(self):
        from concurrent.futures import ThreadPoolExecutor
        e, gem = claude_engine(fallback=0)
        pics = [textured(self.d / f"p{i}.jpg", i) for i in range(40)]
        tripped_then = []

        def look(prompt, paths, **k):                  # each call notes whether the guard had tripped when it began
            tripped_then.append(e.GEMINI_PICKS["fallback"] > max(5, 0.05 * e.GEMINI_PICKS["calls"]))
            return Claude.__call__(gem, prompt, paths, **k)
        e.pick_vision = look

        def work(i):
            try:
                M.judge(e, dict(ROW, text=f"line {i}"), [({"title": f"c{i}"}, pics[i])], {})
            except M.PlanningStopped:
                pass
        with ThreadPoolExecutor(30) as ex:
            list(ex.map(work, range(40)))
        self.assertFalse(any(tripped_then), tripped_then)

    def test_degraded_carries_on_and_says_it_once_a_call(self):
        e, gem = claude_engine(fallback=7)
        with mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "1"}):
            M.judge(e, dict(ROW), [({"title": "a tablet"}, textured(self.d / "a.jpg", 1))], {})
        self.assertEqual(len(gem.calls), 1)
        self.assertEqual(sum("Gemini failed" in ln for ln in e.lines), 1)


class ClaudeSeesTen(Tmp):
    def test_card_answers_after_the_tenth_picture_are_dropped(self):
        e, gem = claude_engine(card=True)
        items = [(k, {"title": f"cap {k}", "label": f"Place {k}", "tid": "corner-label", "line": "a line"},
                  str(textured(self.d / f"c{k}.jpg", k, size=(400, 225))), (f"pid{k}", "q", "l", 2)) for k in range(12)]
        got, via = M._ask_cards(e, "lead", items)
        self.assertEqual(via, "claude")
        self.assertEqual(sorted(k[0] for k in got), sorted(f"pid{k}" for k in range(10)))
        self.assertEqual(len(gem.calls), 1)            # never asked of Claude twice

    def test_gemini_keeps_all_twelve(self):
        class Gem(Claude):
            def __call__(self, *a, info=None, **k):
                out = Claude.__call__(self, *a, info=info, **k)
                info.update(via="gemini")
                return out
        gem = Gem(card=True, fallback=False)
        e = Engine(gem)
        items = [(k, {"title": f"cap {k}", "label": f"Place {k}", "tid": "corner-label", "line": "a line"},
                  str(textured(self.d / f"c{k}.jpg", k, size=(400, 225))), (f"pid{k}", "q", "l", 2)) for k in range(12)]
        got, via = M._ask_cards(e, "lead", items)
        self.assertEqual((via, len(got)), ("gemini", 12))

    def test_picture_answers_after_the_tenth_are_dropped(self):
        e, gem = claude_engine()
        items = [(k, {"title": f"c{k}"}, textured(self.d / f"p{k}.jpg", k, size=(400, 225)), (f"pid{k}", "q", "l", 2))
                 for k in range(12)]
        with mock.patch.dict(M.JUDGE, {"asks": 0, "failed": 0}), mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "1"}):
            got, via = M._ask_pictures(e, "lead", "fmt", items, False, False, "picture check", "MEDIUM", 512)
        self.assertEqual((via, len(got)), ("claude", 10))

    def test_the_claude_prompt_lists_only_the_pictures_it_sends(self):
        import make_video as mv
        sent = {}

        def cv(prompt, paths, max_tokens=2000):
            sent.update(prompt=prompt, n=len(paths))
            return "[]"
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": ""}), mock.patch.object(mv, "claude_vision", cv):
            info = {}
            mv.pick_vision("fmt", [f"x{i}.jpg" for i in range(12)], lead="lead",
                           labels=[f"Picture {i + 1} - caption: c{i}" for i in range(12)], info=info)
        self.assertEqual((sent["n"], info["via"]), (10, "claude"))
        self.assertIn("Image 10:", sent["prompt"])
        self.assertNotIn("Image 11:", sent["prompt"])


class AICropStop(Tmp):
    def test_a_stop_during_the_crop_recheck_reaches_the_run(self):
        e = Engine()
        n = [0]

        def ai_ok(engine, dest, *a, **k):
            n[0] += 1
            if n[0] == 1:
                return False, "frame", {"bad": ["frame"]}
            raise M.PlanningStopped("Mr Truth stopped: Gemini failed")

        def draw(engine, prompt, dest, label):
            textured(dest, 100, (1536, 864))
        with mock.patch.object(M, "_draw_ai", draw), mock.patch.object(M, "_ai_ok", ai_ok), \
                mock.patch.object(e, "ai_image_slot", lambda *a: None, create=True):
            with self.assertRaises(M.PlanningStopped):
                M._ai_picture(e, self.d / "job", {"text": "The archivist read alone.", "visualIntent": "an archivist"},
                              3, {})
        self.assertEqual(n[0], 2)

    def test_a_crop_error_still_leaves_the_refusal(self):
        e = Engine()

        def ai_ok(engine, dest, *a, **k):
            return False, "frame", {"bad": ["frame"]}

        def draw(engine, prompt, dest, label):
            textured(dest, 100, (1536, 864))
        with mock.patch.object(M, "_draw_ai", draw), mock.patch.object(M, "_ai_ok", ai_ok), \
                mock.patch.object(M, "_crop_edges", mock.Mock(side_effect=OSError("disk"))), \
                mock.patch.object(e, "ai_image_slot", lambda *a: None, create=True):
            self.assertIsNone(M._ai_picture(e, self.d / "job", {"text": "The archivist read alone.",
                                                                 "visualIntent": "an archivist"}, 3, {}, tries=1))


# ── scenes(): a beat overlay is words (review 2026-10-11) ───────────────────────────────────────────────────────────
from test_mrtruth_gate import DOSSIER, cues_of, film, ident  # noqa: E402


def lay(rows, ms):
    t = 0
    for r, d in zip(rows, ms):
        r["startMs"], r["endMs"] = t, t + d
        t += d
    return rows


class Scenes(unittest.TestCase):
    def draw(self, rows, **patch):
        import tempfile
        M.transitions(rows)
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)), \
                mock.patch.object(M, "_ident", ident), mock.patch.object(M, "_luma", lambda p: 0.3), \
                mock.patch.multiple(M, **(patch or {"LEAK_MAX_S": M.LEAK_MAX_S})):
            return M.scenes(rows, Path(st), cues_of(rows))

    def test_an_overlay_shot_never_starts_late_for_a_light_leak(self):
        rows = lay(film(texts=False), [2200, 4200] * 24)            # every leak would be held from the shot after it
        for k in range(1, 48, 2):
            rows[k]["overlay"] = {"text": f"Name {k}", "kind": "name", "style": "fullFrame"}
        rows[21].pop("overlay")                                     # one plain shot after a quick one: still held
        sc = self.draw(rows, LEAK_MAX_S=2.9)
        start = lambda k: round(rows[k - 1]["endMs"] * M.FPS / 1000)
        for k in range(1, 48, 2):
            if k != 21:
                self.assertEqual(sc[k]["startFrame"], start(k), k)
        held = [k for k in range(0, 48, 2) if (sc[k].get("ambience") or {}).get("clip") == "leak"]
        self.assertEqual(held, [20])
        self.assertGreater(sc[21]["startFrame"], start(21))

    def test_no_effect_on_an_overlay_shot(self):
        rows = film(texts=False)
        for k in range(1, 48):
            rows[k]["overlay"] = {"text": f"Word {k}", "kind": "name", "style": "fullFrame"}
        sc = self.draw(rows)
        self.assertFalse([k for k, s in enumerate(sc) if s.get("overlay") and (s.get("ambience", {}).get("clip") == "leak"
                                                                                 or s.get("cinemaMove"))])
        plain = self.draw(film(texts=False))                       # the same film without them still gets both
        self.assertTrue(any((s.get("ambience") or {}).get("clip") == "leak" for s in plain))
        self.assertTrue(any(s.get("cinemaMove") for s in plain))

    def test_the_gate_takes_an_effect_off_an_overlay_shot(self):
        import tempfile
        rows = film(texts=False)
        sc = self.draw(rows)
        k = next(i for i, s in enumerate(sc) if (s.get("ambience") or {}).get("clip") == "leak")
        t = next(i for i, s in enumerate(sc) if s.get("cinemaMove"))
        for i in (k, t):
            sc[i]["overlay"] = {"text": "A name", "kind": "name", "style": "fullFrame"}

        class E:
            def log(self, s):
                pass
        with tempfile.TemporaryDirectory() as d, mock.patch.object(M, "_stop", lambda e, m: None):
            (Path(d) / "mrtruth").mkdir()
            fixed = M._gate_scenes(E(), Path(d), rows, sc)
        self.assertNotIn("ambience", sc[k])
        self.assertNotIn("cinemaMove", sc[t])
        self.assertEqual(len(fixed), 2, fixed)

    def repeat_film(self, gap_ms):
        """Every shot 4.3 s but shot 10 (2.2 s, the only leak under LEAK_MAX_S 2.9): its hold moves shot 11's start.
        Shot 11's photo comes back `gap_ms` after it."""
        rows, ms = film(texts=False), [4300] * 48
        ms[10] = 2200
        lay(rows, ms)
        k2 = next(k for k in range(48) if rows[k]["startMs"] - rows[11]["startMs"] >= gap_ms)
        ms[k2 - 1] -= rows[k2]["startMs"] - rows[11]["startMs"] - gap_ms
        lay(rows, ms)
        rows[k2]["pick"] = dict(rows[11]["pick"], photo=rows[11]["pick"]["photo"].replace(".jpg", "~2.jpg"), reused=True)
        return rows, k2

    def test_the_hold_never_brings_a_repeat_under_90_s(self):
        rows, k2 = self.repeat_film(90400)
        sc = self.draw(rows, LEAK_MAX_S=2.9)
        self.assertGreaterEqual((sc[k2]["startFrame"] - sc[11]["startFrame"]) / M.FPS, M.REUSE_GAP_S)
        self.assertNotIn("ambience", sc[10])                       # no hold, so no leak on the quick shot

    def test_the_hold_stays_when_the_repeat_is_far(self):
        rows, k2 = self.repeat_film(120000)
        sc = self.draw(rows, LEAK_MAX_S=2.9)
        self.assertEqual((sc[10].get("ambience") or {}).get("clip"), "leak")
        self.assertEqual(sc[10]["durationFrames"], round(M.LEAK_PREFER_S * M.FPS))


# ── chapters at a sentence start (review 2026-10-11) ─────────────────────────────────────────────────────────────────
class Chapters(unittest.TestCase):
    def sync(self, rows):
        import tempfile

        class E:
            def log(self, s):
                pass
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "mrtruth").mkdir()
            cues = cues_of(rows)
            M.sync_overlays(E(), Path(d), rows, cues)
            first = [(k, r["startMs"]) for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "chapter-plate"]
            M.sync_overlays(E(), Path(d), rows, cues)                # a second sync moves nothing
            again = [(k, r["startMs"]) for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "chapter-plate"]
            self.assertEqual(first, again)
            return first, M._sentence_starts(cues)

    def base(self, ms, ends):
        rows = lay(film(texts=False), ms)
        for k, r in enumerate(rows):                             # a sentence ends only on the shots in `ends`
            r["text"] = r["text"].rstrip(".") + ("." if k in ends else ",")
        rows[0]["device"] = M._auto_title(DOSSIER, "")
        return rows

    def test_a_chapter_mid_sentence_steps_back_to_its_sentence_start(self):
        ms = [4300] * 48
        ms[10] = 4500                                            # shot 11 opens 4.5 s into the sentence shot 10 opens
        rows = self.base(ms, ends=set(range(48)) - {10})
        rows[11]["device"], rows[11]["section_turn"] = {"id": "chapter-plate", "heading": "The Turn"}, True
        got, sent = self.sync(rows)
        self.assertEqual(len(got), 1)
        self.assertIn(got[0][1], sent)
        self.assertEqual(got[0][1], 10 * 4300)

    def test_on_the_tail_of_a_long_sentence_it_moves_to_the_next(self):
        ms = [4300] * 48
        ms[8] = ms[9] = 4500                                     # a sentence over shots 8-10: 9 s back, 4.5 s ahead
        ms[10] = 4500
        rows = self.base(ms, ends=set(range(48)) - {8, 9})
        rows[10]["device"], rows[10]["section_turn"] = {"id": "chapter-plate", "heading": "The Turn"}, True
        got, sent = self.sync(rows)
        self.assertEqual(len(got), 1)
        self.assertIn(got[0][1], sent)
        self.assertEqual(got[0][1], rows[11]["_said"][0])

    def test_a_chapter_on_its_sentence_start_stays(self):
        rows = self.base([4300] * 48, ends=set(range(48)))
        rows[12]["device"], rows[12]["section_turn"] = {"id": "chapter-plate", "heading": "The Turn"}, True
        got, _ = self.sync(rows)
        self.assertEqual(got, [(12, 12 * 4300)])

    def test_the_gate_warns_of_a_chapter_left_mid_sentence(self):
        rows = self.base([4300] * 48, ends=set(range(48)))
        rows[12]["device"], rows[12]["section_turn"] = {"id": "chapter-plate", "heading": "The Turn"}, True
        rows[12]["startMs"] += 900                               # off its sentence start (as no sync would leave it)
        rows[11]["endMs"] = rows[12]["startMs"]
        cues = cues_of(self.base([4300] * 48, ends=set(range(48))))   # the narration as said: shot 12 opens a sentence
        ctx = M._gate_ctx(Path("/nonexistent"), rows, DOSSIER, cues)
        with mock.patch.object(M, "_field_problems", lambda *a: []):
            M._gate_find(rows, ctx)
        self.assertTrue([w for w in ctx["warnings"] if "opens mid-sentence" in w], ctx["warnings"])


if __name__ == "__main__":
    unittest.main()
