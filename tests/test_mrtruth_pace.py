"""Mr Truth: the pace by position (owner, locked 2026-10-11) - 0-60 s 3.9 s a shot, 0-5 min 4.0 s, the first half
4.0-4.1 s, the second half 4.3 s, blended with no step at the middle; the first 30 s hold 7-8 shots with at most one over
6 s (the opening title's included). The target curve, _pace on it, the opening rule at every join that could break it,
the fillers in the opening, the gate's pacing rule (repaired, else a warning - never a stop)
and the beats prompt. Synthetic data only: no network, no paid call.

    .venv/bin/python -m unittest tests.test_mrtruth_pace -v
"""
import copy
import json
import random
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "tests"))
import mrtruth as M  # noqa: E402
import test_mrtruth_gate as G  # noqa: E402
from test_mrtruth_pacing import ENG, durs, narration, quick_run, rows_on, check_invariants  # noqa: E402


def sections_of(rows):
    return M.pace_sections([((r["startMs"] - rows[0]["startMs"]) / 1000, (r["endMs"] - r["startMs"]) / 1000) for r in rows])


def narration_of(seconds, seed=3):
    """A made-up narration at least `seconds` long (test_mrtruth_pacing.narration, sentences added until it is)."""
    n = max(5, int(seconds / 4))
    while True:
        cues = narration(seed, n)
        if cues[-1][1] >= seconds * 1000:
            return [c for c in cues if c[0] < seconds * 1000]
        n += max(1, n // 10)


class Curve(unittest.TestCase):
    def test_each_section_lands_on_the_owner_target(self):
        for film in (300, 480, 660, 900, 1200, 1800):
            h = film / 2
            avg = lambda a, b: (b - a) / M.pace_shots(a, b, film)
            self.assertAlmostEqual(avg(0, 60), M.PACE_MIN1_S, delta=0.01, msg=film)
            self.assertAlmostEqual(avg(0, h), M._half1_s(film), delta=0.005, msg=film)
            self.assertTrue(M.PACE_HALF1_S[0] - 1e-9 <= M._half1_s(film) <= M.PACE_HALF1_S[1] + 1e-9)
            self.assertAlmostEqual(avg(h, film), M.PACE_HALF2_S, delta=0.01, msg=film)
            if film >= 600:                          # the first five minutes inside the first half
                self.assertAlmostEqual(avg(0, 300), M.PACE_5MIN_S, delta=0.05, msg=film)
            self.assertTrue(7 <= M.pace_shots(0, 30, film) <= 8, film)

    def test_the_first_half_target_moves_from_four_to_four_point_one(self):
        self.assertEqual(M._half1_s(300), 4.0)
        self.assertEqual(M._half1_s(600), 4.0)
        self.assertAlmostEqual(M._half1_s(900), 4.05)
        self.assertEqual(M._half1_s(1200), 4.1)
        self.assertEqual(M._half1_s(3000), 4.1)

    def test_no_visible_step_anywhere(self):
        for film in (300, 660, 1200):
            ts = [M.pace_target(t / 2, film) for t in range(0, 2 * film)]
            self.assertLess(max(abs(a - b) for a, b in zip(ts, ts[1:])), 0.01, film)
            h = film / 2
            self.assertLess(abs(M.pace_target(h + 0.5, film) - M.pace_target(h - 0.5, film)), 0.01)
            self.assertAlmostEqual(M.pace_target(10, film), M.PACE_MIN1_S)
            self.assertAlmostEqual(M.pace_target(film - 5, film), M._pace_levels(film)[1])

    def test_deterministic(self):
        self.assertEqual([M.pace_target(t, 661.3) for t in range(0, 661, 7)], [M.pace_target(t, 661.3) for t in range(0, 661, 7)])
        M._pace_levels.cache_clear()
        a = M._pace_levels(660)
        M._pace_levels.cache_clear()
        self.assertEqual(a, M._pace_levels(660))

    def test_the_lead_profile(self):
        l0, l1, l2 = M.PACE_LEAD_S
        self.assertEqual(M._lead_at(10, 660), l0)
        self.assertAlmostEqual(M._lead_at(200, 660), l1)
        self.assertAlmostEqual(M._lead_at(650, 660), l2)
        self.assertEqual(M._lead_at(10, 660, (0.0, 0.3, 0.1)), 0.0)

    def test_the_stretches_add_up_and_the_opening_holds_seven_or_eight(self):
        for total in (60000, 125000, 300000, 658000, 1200000):
            bins = M._pace_bins(total, M.PACE_LEAD_S)
            self.assertEqual((bins[0][0], bins[-1][1]), (0, total))
            self.assertTrue(all(a[1] == b[0] for a, b in zip(bins, bins[1:])))
            self.assertTrue(all(f <= g <= q for a, b, q, f, g in bins), bins)
            self.assertEqual(bins[0][1], 30000)
            self.assertTrue(M.PACE_OPEN_N[0] <= bins[0][2] <= M.PACE_OPEN_N[1])
            if total >= 600000:                      # the owner's section ends are stretch ends
                edges = {b[0] for b in bins}
                self.assertTrue({30000, 60000, 300000} <= edges, edges)
                self.assertTrue(any(abs(e - total / 2) <= 1 for e in edges), edges)

    def test_sections_of_a_cut(self):
        shots = [(0, 7.0), (7, 2.0), (9, 3.0), (12, 6.5), (18.5, 3.5), (22, 4.0), (26, 3.0), (29, 4.0)]
        t = 33.0
        while t < 700:
            shots.append((t, 4.0))
            t += 4.0
        sec = M.pace_sections(shots)
        self.assertEqual((sec["0-30s"]["n"], sec["0-30s"]["over6"]), (8, 2))
        self.assertFalse(sec["0-30s"]["ok"])
        self.assertIn("0-5min", sec)
        self.assertNotIn("0-5min", M.pace_sections(shots[:60]))       # a film under 10 min: not checked
        self.assertEqual(sec["second half"]["avg"], 4.0)
        self.assertFalse(sec["second half"]["ok"])                    # under its band (4.15-4.45)


class Paced(unittest.TestCase):
    def test_an_eleven_minute_film_cut_line_by_line_lands_on_the_curve(self):
        cues = narration_of(660)
        raw = rows_on(cues, list(range(len(cues))))
        out = copy.deepcopy(raw)
        M._paced(ENG, out, cues)
        check_invariants(out, cues, raw)
        sec = sections_of(out)
        self.assertTrue(sec["0-30s"]["ok"], sec["0-30s"])
        self.assertLessEqual(abs(sec["0-60s"]["avg"] - (M.PACE_MIN1_S - M.PACE_LEAD_S[0])), 0.3, sec)
        self.assertLessEqual(abs(sec["second half"]["avg"] - (M.PACE_HALF2_S - M.PACE_LEAD_S[2])), 0.15, sec)
        self.assertLess(sec["first half"]["avg"], sec["second half"]["avg"])
        self.assertLessEqual(quick_run(out), M.SHORT_RUN_MAX)
        self.assertLessEqual(max(durs(out)), M.SCENE_MAX_S)
        info = M._pace(copy.deepcopy(raw), cues)
        for a, b, q, n in info["bins"]:              # every stretch at its count (the joins are free here)
            self.assertEqual(n, q, (a, b))
        again = copy.deepcopy(out)
        M._paced(ENG, again, cues)
        self.assertEqual(json.dumps(again, sort_keys=True), json.dumps(out, sort_keys=True))

    def test_three_long_opening_rows_keep_one(self):
        # Claude's opening: three sentences of 7-7.5 s, each said over two subtitle lines; then plain lines
        cues, t = [], 0
        for k in range(3):
            cues += [(t, t + 3400, f"a{k} b{k} c{k} d{k}"), (t + 3500, t + 7300, f"e{k} f{k} g{k}.")]
            t += 7500
        while t < 180000:
            cues.append((t, t + 3900, f"line {t}."))
            t += 4000
        raw = rows_on(cues, [0, 2, 4] + list(range(6, len(cues))))
        self.assertEqual(sum(r["endMs"] - r["startMs"] > 6000 for r in raw if r["startMs"] < 30000), 3)
        out = copy.deepcopy(raw)
        M._paced(ENG, out, cues)
        opening = [r for r in out if r["startMs"] < 30000]
        self.assertLessEqual(sum(r["endMs"] - r["startMs"] > 6000 for r in opening), 1, durs(opening))
        self.assertTrue(M.PACE_OPEN_N[0] <= len(opening) <= M.PACE_OPEN_N[1], durs(opening))
        check_invariants(out, cues, raw)

    def test_no_join_makes_a_second_shot_over_six_seconds_in_the_opening(self):
        rows = [{"startMs": a, "endMs": b, "text": "x."} for a, b in
                ((0, 6500), (6500, 9000), (9000, 13000), (13000, 17000), (17000, 21000), (21000, 25500),
                 (25500, 30000), (30000, 40000))]
        self.assertFalse(M._open_ok(rows, 1, 13000))         # 2.5 s + 4.0 s: a second one over 6 s
        self.assertTrue(M._open_ok(rows, 1, 9001))           # within 6 s: free
        self.assertTrue(M._open_ok(rows, 0, 9000))           # the long one itself grows: still one
        self.assertTrue(M._open_ok(rows, 7, 50000))          # after 30 s: free
        rows[0]["endMs"], rows[1]["startMs"] = 5000, 5000
        self.assertTrue(M._open_ok(rows, 1, 13000))          # none yet: the first may be made

    def test_calming_a_quick_run_keeps_the_opening_rule(self):
        rows = [{"startMs": 0, "endMs": 7000, "text": "a."}]
        t = 7000
        for k in range(6):                                    # six quick shots of 2.9 s from 7 s
            rows.append({"startMs": t, "endMs": t + 2900, "text": f"q{k}."})
            t += 2900
        rows.append({"startMs": t, "endMs": t + 5000, "text": "end."})
        M._calm_short_runs(rows)
        self.assertLessEqual(sum(r["endMs"] - r["startMs"] > 6000 for r in rows if r["startMs"] < 30000), 1)

    def test_the_quick_stretch_of_short_sentences_is_kept(self):
        # the owner's 0:34-0:40: three short whole sentences, one quick shot each, in a film paced around them
        cues, t = [], 0
        for k in range(8):
            cues.append((t, t + 4100, f"opening sentence {k} goes on."))
            t += 4200
        for w in ("Not symbolically.", "Not in the language of theology.", "As a literal sequence."):
            cues.append((t, t + 1900, w))
            t += 2000
        while t < 400000:
            cues.append((t, t + 2000, f"part {t}"))
            cues.append((t + 2100, t + 4100, "of a sentence."))
            t += 4200
        raw = rows_on(cues, list(range(len(cues))))
        out = copy.deepcopy(raw)
        M._paced(ENG, out, cues)
        for w in ("Not symbolically.", "Not in the language of theology.", "As a literal sequence."):
            self.assertTrue(any(r["text"] == w for r in out), w)


class Prompt(unittest.TestCase):
    def test_the_brief_and_each_range_carry_the_pace(self):
        brief = M._pacing(M._prompts()["segmentation"].replace("{TARGET_SECONDS}", f"{M.TARGET_SCENE_S:.1f}"))
        self.assertIn("THE PACE CHANGES THROUGH THE FILM", brief)
        self.assertIn("at most ONE of them over 6 seconds", brief)
        first = M._range_pace(0, 120000, 660000)
        self.assertIn("about 3.9 seconds a scene", first)
        self.assertIn("7-8 scenes", first)
        late = M._range_pace(480000, 600000, 660000)
        self.assertIn("about 4.3 seconds a scene", late)
        self.assertNotIn("first 30 seconds", late)


class Downstream(G.Base):
    def test_the_gate_cuts_a_second_long_opening_shot(self):
        rows = G.film(n=48)                                   # shots 1 and 3 run 7.4 s: two over 6 s in the first 30 s
        for k in (1, 3):
            for j in range(k + 1, len(rows)):
                rows[j]["startMs"] += 3100 if j > k else 0
                rows[j]["endMs"] += 3100
            rows[k]["endMs"] += 3100
        found, ctx = self.find(rows)
        self.assertEqual(ctx["pacing"]["0-30s"]["over6"], 2)
        rec, _ = self.gate(rows, halves=True)                 # a subtitle start halfway through each shot
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertLessEqual(rec["pacing"]["0-30s"]["over6"], 1)
        self.assertTrue(any(x["rule"] == "pace" and "cut on the narration" in x["fix"] for x in rec["repairs"]))
        self.assertTrue(all(r.get("pick") for r in rows))
        self.assertTrue(all(a["endMs"] == b["startMs"] for a, b in zip(rows, rows[1:])))

    def test_a_filler_in_the_opening_only_on_a_shot_it_fits(self):
        r = {"startMs": 23700, "endMs": 30420}
        self.assertFalse(M._open_room(r, "shadow-up"))        # 6.7 s under a 5 s template: one more cut there
        self.assertTrue(M._open_room(r, "top-title"))
        self.assertTrue(M._open_room({"startMs": 40000, "endMs": 47000}, "shadow-up"))

    def test_the_gate_repairs_a_crowded_opening(self):
        rows = G.film(n=48)
        quick = []                                            # shots 1-4 cut into eight of 2.15 s: 11 in the first 30 s
        for k in range(1, 5):
            r = rows[k]
            mid = (r["startMs"] + r["endMs"]) // 2
            quick += [dict(r, endMs=mid), dict(r, startMs=mid, pick=G.pic(f"q{k}"), spare=[], device=None)]
        rows[1:5] = quick
        found, ctx = self.find(rows)
        self.assertGreater(ctx["pacing"]["0-30s"]["n"], M.PACE_OPEN_N[1])
        rec, _ = self.gate(rows)
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertIn("pace", rec["first_look"]["rules"])
        self.assertTrue(rec["pacing"]["0-30s"]["ok"], rec["pacing"]["0-30s"])
        self.assertTrue(any(x["rule"] == "pace" for x in rec["repairs"]))

    def test_pacing_never_stops_a_film(self):
        rows = G.film(n=48)                                   # 4.3 s shots: the first minute and half too slow,
        rec, eng = self.gate(rows)                            # nothing long enough to cut
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertFalse(rec["pacing"]["0-60s"]["ok"])
        self.assertTrue(any(w.startswith("pacing: 0-60s") for w in rec["warnings"]), rec["warnings"])
        self.assertTrue(any("pace by position" in s for s in eng.lines))
        found, ctx = self.find(rows)                          # the read-back: a warning, not a FAIL line
        self.assertFalse([x for x in found if x["rule"] == "pace"])
        self.assertTrue(any(w.startswith("pacing:") for w in ctx["warnings"]))


if __name__ == "__main__":
    unittest.main()
