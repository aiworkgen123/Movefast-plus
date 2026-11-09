"""Mr Truth: quick cuts stay on their words (owner 2026-10-26: "the fast shots ... don't match the vo"). An overlay is
pinned on its own line before a stray earlier mention (MRTRUTH_PIN_OWN), the wording repair refuses new words the
re-sync would pin off their line (HEARD_OWN), a burst of quick shots with a plain one off its line folds that one into
the shot before it (SYNC_DRIFT), the gate reads words on their own line and flags such a burst (GATE_DRIFT); a
highlighted page never changes, a second sync moves nothing, and with every switch off the cut is the old one.
Invented sentences only: no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest -q tests/test_mrtruth_drift.py
"""
import copy
import hashlib
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import mrtruth as m  # noqa: E402

SWITCHES = ("MRTRUTH_PIN_OWN", "MRTRUTH_HEARD_OWN", "MRTRUTH_SYNC_DRIFT", "MRTRUTH_GATE_DRIFT", "MRTRUTH_FILLER_FITS")
NEW_KEYS = ("_pin_seen", "_pin_old", "_run_to", "_drift_keep")


def w(i, j):
    """Word j of padding line i: a made-up word no other word shares a stem with."""
    h = hashlib.md5(f"pad-{i}-{j}".encode()).hexdigest()
    return "".join(chr(97 + int(h[k:k + 2], 16) % 26) for k in range(0, 16, 2))


def pad(n, secs=4.0, start=0):
    return [(secs, " ".join(w(start + i, j) for j in range(5)) + ".") for i in range(n)]


def film(lines):
    """lines: [(seconds, "words of the line.")] -> (cues, heard, rows one per line, job dir with the words heard)."""
    cues, heard, t = [], [], 0
    for secs, text in lines:
        d = int(secs * 1000)
        words = text.split()
        cues.append((t, t + d, text))
        heard += [(t + d * k // len(words), w_.strip(".,\"'").lower()) for k, w_ in enumerate(words)]
        t += d
    rows = [{"startMs": a, "endMs": b, "text": txt, "device": None, "pick": {"photo": f"p{i}.jpg", "score": 7.0},
             "spare": [], "visualIntent": f"picture {i}"} for i, (a, b, txt) in enumerate(cues)]
    job = Path(tempfile.mkdtemp())
    (job / "words_heard.json").write_text(json.dumps([[x, ms / 1000, ms / 1000 + 0.2] for ms, x in heard]))
    return cues, heard, rows, job


def at_word(heard, word, after=0):
    return next(ms for ms, x in heard if x == word and ms >= after)


def row_of(rows, start):
    return next(r for r in rows if r["text"].startswith(start))


def cut(rows, cues, job, twice=False):
    eng = types.SimpleNamespace(log=lambda *_: None)
    m.sync_overlays(eng, job, rows, cues)
    m.cap_shots(eng, job, rows, cues)
    if twice:
        first = snap(rows)
        m.sync_overlays(eng, job, rows, cues)
        m.cap_shots(eng, job, rows, cues)
        return first, snap(rows)
    return rows


def snap(rows):
    return [(r["startMs"], r["endMs"], r["text"], json.dumps(r.get("device"), sort_keys=True),
             json.dumps(r.get("typedCaption"), sort_keys=True), tuple(r.get("held") or [])) for r in rows]


def quick_runs(rows, lim=3000):
    out, cur = [], []
    for r in rows + [None]:
        if r is not None and r["endMs"] - r["startMs"] < lim:
            cur.append(r)
            continue
        if len(cur) >= 3:
            out.append(cur)
        cur = []
    return out


def off_line(r):
    return abs(r["startMs"] - r["_said"][0])


class Base(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {k: "" for k in SWITCHES})
        self.env.start()
        self.fit = mock.patch.object(m, "_fit_devices", lambda rows, only=None: None)   # no real pictures here
        self.fit.start()

    def tearDown(self):
        self.fit.stop()
        self.env.stop()

    def off(self):
        for k in SWITCHES:
            os.environ[k] = "off"


# the owner's complaint (A): a stray earlier "pages" pulled the "First page" title five seconds early
def pages_film():
    lines = pad(8) + [(3.0, "We kept nine pages in total."), (2.4, "Nine pages, filed and stamped."),
                      (2.0, "And they open with a map."), (4.0, "On the first page, the clerk wrote a name."),
                      (4.0, "The name belonged to a ferryman from the delta.")] + pad(6, start=20)
    cues, heard, rows, job = film(lines)
    row_of(rows, "On the first page")["device"] = {"id": "top-title", "line1": "First page", "line2": ""}
    return cues, heard, rows, job


# the owner's complaint (B): a filler on a 1.2 s line held for its 4.4 s pushed the one-word lines after it late
def builders_film(start_pad=10, q_extra=None):
    lines = pad(start_pad) + [(1.2, "Old builders."), (1.1, "Strangers."), (1.1, "Weather."),
                              (3.6, "But the longest answer takes the most time to arrive."),
                              (6.0, "You keep listening after the easy echoes fade away.")] + pad(6, start=30)
    cues, heard, rows, job = film(lines)
    row_of(rows, "Old builders")["device"] = {"id": "P05", "headline": "Old builders", "eyebrow": "", "imageLabel": ""}
    if q_extra:
        row_of(rows, "Strangers").update(q_extra)
    return cues, heard, rows, job


class PinOwn(Base):
    def test_first_page_is_pinned_on_its_own_line_not_on_the_earlier_pages(self):
        cues, heard, rows, job = pages_film()
        cut(rows, cues, job)
        r = next(r for r in rows if (r.get("device") or {}).get("id") == "top-title")
        self.assertTrue(r["text"].startswith("On the first page"))
        self.assertEqual(r["startMs"], at_word(heard, "first") - m.SYNC_LEAD_MS)

    def test_switch_off_keeps_the_old_early_pin(self):
        self.off()
        cues, heard, rows, job = pages_film()
        cut(rows, cues, job)
        r = next(r for r in rows if (r.get("device") or {}).get("id") == "top-title")
        self.assertTrue(r["text"].startswith("Nine pages"))           # moved to the earlier line, as it always was
        self.assertLess(r["startMs"], at_word(heard, "first") - 4000)

    def test_spoken_at_lesser_miss(self):
        heard = [(1000, "lantern"), (1500, "harbour"), (9000, "lantern"), (9400, "harbour")]
        words = ["lantern", "harbour"]
        self.assertEqual(m._spoken_at(words, heard, 0, 20000), 1000)                      # earliest, as before
        self.assertEqual(m._spoken_at(words, heard, 0, 20000, own=(8800, 12000), fit=2000), 9000)   # its own line
        # running 6 s past a line that ends 0.4 s after the words, while the earlier mention is 7.8 s before it: own
        self.assertEqual(m._spoken_at(words, heard, 0, 20000, own=(8800, 9400), fit=6000), 9000)
        # running 6 s past the line while the earlier mention is just 0.3 s before it: the earlier, lesser miss
        self.assertEqual(m._spoken_at(words, heard, 0, 20000, own=(1300, 9400), fit=6000), 1000)


class SyncDrift(Base):
    def test_a_filler_on_a_short_line_no_longer_pushes_one_word_lines_late(self):
        self.off()
        cues, heard, rows, job = builders_film()
        old = cut(copy.deepcopy(rows), cues, job)
        bad = [run for run in quick_runs(old) if any(not r.get("device") and off_line(r) > 1000 for r in run)]
        self.assertTrue(bad)                                                              # the old cut: a late burst
        for k in SWITCHES:
            os.environ[k] = ""
        new = cut(rows, cues, job)
        self.assertEqual(len(new), len(old) - 1)
        for run in quick_runs(new):
            self.assertFalse([r for r in run if m._bare(r) and off_line(r) > m.SYNC_DRIFT_MS])
        host = next(r for r in new if (r.get("device") or {}).get("id") == "P05")
        self.assertIn("Strangers.", host.get("held") or [])                               # heard under the filler
        self.assertNotIn("Strangers.", [r["text"] for r in new])
        line = next(c for c in cues if c[2] == "Old builders.")
        self.assertEqual(tuple(host["_said"]), (line[0], line[1]))                        # its own line stays,
        self.assertGreater(host["_run_to"], host["_said"][1])                             # the run-on apart

    def test_an_anaphora_of_quick_lines_stays_four_shots_on_their_words(self):
        lines = pad(10) + [(4.0, "The hunt began at first light."), (2.2, "We searched the barn."),
                           (2.2, "We searched the creek."), (2.2, "We searched the woods."),
                           (2.2, "We searched the road."), (5.0, "Nothing was found until noon came.")] + pad(5, start=40)
        cues, heard, rows, job = film(lines)
        row_of(rows, "The hunt began")["device"] = {"id": "shadow-up", "line": "The hunt began"}
        out = cut(rows, cues, job)
        four = [r for r in out if r["text"].startswith("We searched")]
        self.assertEqual(len(four), 4)
        for r, (a, b, t) in zip(four, [c for c in cues if c[2].startswith("We searched")]):
            self.assertEqual(r["startMs"], a)
        self.assertEqual(m._drift_runs(out), [])

    def test_never_folds_a_template_a_hold_or_into_a_hold(self):
        for extra in ({"device": {"id": "photo-pop"}}, {"hold": True}):
            cues, heard, rows, job = builders_film(q_extra=extra)
            out = cut(rows, cues, job)
            q = row_of(out, "Strangers")                                                  # still its own shot,
            self.assertEqual(q.get("device"), extra.get("device"))                        # its template on it
            if extra.get("hold"):                                                         # and nothing folded
                self.assertNotIn("_run_to", q)                                            # into a hold
                self.assertFalse(q.get("held"))

    def test_never_folds_a_caption_or_a_chapter(self):
        for extra in ({"typedCaption": {"lines": ["Strangers"], "startFrame": m.TYPED_CAPTION_START_F}},
                      {"device": {"id": "chapter-plate", "heading": "Strangers"}, "section_turn": True}):
            cues, heard, rows, job = builders_film(q_extra=extra)
            out = cut(rows, cues, job)
            self.assertTrue(any(r.get("typedCaption") or r.get("section_turn") for r in out
                                if "Strangers." in r["text"] or "Strangers." in (r.get("held") or [])))
            self.assertFalse(any("Strangers." in (r.get("held") or []) and not (r.get("typedCaption") or r.get("section_turn"))
                                 for r in out))

    def test_never_in_the_first_30_seconds(self):
        cues, heard, rows, job = builders_film(start_pad=2)
        self.off()
        old = cut(copy.deepcopy(rows), cues, job)
        for k in SWITCHES:
            os.environ[k] = ""
        new = cut(rows, cues, job)
        self.assertEqual(len(new), len(old))
        self.assertFalse(any(r.get("_run_to") for r in new))

    def test_second_sync_moves_nothing(self):
        for make in (pages_film, builders_film, page_film):
            cues, heard, rows, job = make()
            first, second = cut(rows, cues, job, twice=True)
            self.assertEqual(first, second, make.__name__)


# a highlighted page right after a typed caption whose words are said on the line before it too
PAGE = {"id": "highlight-page", "main": 1, "phrases": ["The report said", "records were lost", "nobody asked again"],
        "paragraphs": ["The report said the fire began in the cellar.",
                       "It said the records were lost that night, every one of them.", "After that, nobody asked again."]}


def page_film(with_page=True):
    lines = pad(12) + [(3.0, "Every ledger was burned that winter."), (3.2, "Then in spring it happened again: the ledger burned."),
                       (8.0, "The report said the records were lost that night, and nobody asked again."),
                       (4.0, "The town moved on without a single word.")] + pad(5, start=50)
    cues, heard, rows, job = film(lines)
    row_of(rows, "Then in spring")["typedCaption"] = {"lines": ["The Ledger Burned"], "startFrame": m.TYPED_CAPTION_START_F}
    if with_page:
        row_of(rows, "The report said")["device"] = copy.deepcopy(PAGE)
    return cues, heard, rows, job


class Page(Base):
    def test_the_caption_is_re_pinned_without_a_page(self):
        cues, heard, rows, job = page_film(with_page=False)
        new = cut(copy.deepcopy(rows), cues, job)
        self.off()
        old = cut(rows, cues, job)
        tc = lambda rs: next(r for r in rs if r.get("typedCaption"))
        self.assertNotEqual(tc(new)["startMs"], tc(old)["startMs"])                     # the premise: it moves

    def test_a_page_beside_a_re_pinned_caption_is_unchanged(self):
        cues, heard, rows, job = page_film()
        new = cut(copy.deepcopy(rows), cues, job)
        self.off()
        old = cut(rows, cues, job)
        page = lambda rs: [(r["startMs"], r["endMs"], json.dumps(r["device"], sort_keys=True)) for r in rs
                           if (r.get("device") or {}).get("id") == "highlight-page"]
        self.assertTrue(page(old))
        self.assertEqual(page(new), page(old))
        tc = lambda rs: next(r for r in rs if r.get("typedCaption"))
        self.assertTrue(tc(new).get("_pin_old"))
        self.assertEqual(tc(new)["startMs"], tc(old)["startMs"])                        # it keeps its old pin


    def test_a_crowd_found_after_reseat_is_laid_out_again_once(self):
        lines = pad(12) + [(3.0, "A quiet morning settled on the river."), (4.0, "Ferry bell rang twice that morning."),
                           (8.0, "The report said the records were lost that night, and nobody asked again."),
                           (4.0, "The town moved on without a single word.")] + pad(5, start=50)

        def make():
            cues, heard, rows, job = film(lines)
            row_of(rows, "A quiet morning")["device"] = {"id": "shadow-up", "line": "Ferry bell"}
            row_of(rows, "The report said")["device"] = copy.deepcopy(PAGE)
            return cues, heard, rows, job
        cues, heard, rows, job = make()
        logs, n = [], {"reseat": 0}
        real = m._reseat

        def counted(*a, **k):
            n["reseat"] += 1
            return real(*a, **k)
        with mock.patch.object(m, "_reseat", counted):
            m.sync_overlays(types.SimpleNamespace(log=logs.append), job, rows, cues)
        self.assertEqual(n["reseat"], 2)                                                  # laid out again, once
        self.assertEqual(sum("moved from the shot" in x for x in logs), 1)                # and logged once
        su = row_of(rows, "Ferry bell")
        self.assertEqual((su.get("device") or {}).get("id"), "shadow-up")
        self.assertTrue(su.get("_pin_old"))
        page = lambda rs: [(r["startMs"], r["endMs"]) for r in rs if (r.get("device") or {}).get("id") == "highlight-page"]
        self.off()
        cues, heard, old, job = make()
        cut(old, cues, job)
        m.cap_shots(types.SimpleNamespace(log=lambda *_: None), job, rows, cues)
        self.assertTrue(page(old))
        self.assertEqual(page(rows), page(old))


class Gate(Base):
    def ctx(self, heard):
        heard = sorted(heard)
        return {"heard": heard, "heard_ms": [ms for ms, _ in heard]}

    def test_heard_here_refuses_new_words_pinned_off_their_line(self):
        lines = pad(10) + [(3.0, "The lantern burned all night long."), (3.0, "Nobody slept in the house."),
                           (3.0, "Morning came grey and slow.")] + pad(3, start=40)
        cues, heard, rows, job = film(lines)
        for r in rows:
            r["_said"] = (r["startMs"], r["endMs"])
        k = rows.index(row_of(rows, "Nobody slept"))
        args = (rows, k, ["lantern"], [], self.ctx(heard))
        self.assertFalse(m._heard_here(*args, new={"device": {"id": "P05"}}))
        self.assertTrue(m._heard_here(rows, k, ["slept"], [], self.ctx(heard), new={"device": {"id": "P05"}}))
        rows[k]["_pin_old"] = True                                                        # a page's crowd: as before
        self.assertTrue(m._heard_here(*args))
        rows[k].pop("_pin_old")
        self.off()
        self.assertTrue(m._heard_here(*args))                                             # switch off: as before

    def quick_rows(self, t0=40000, shift=1500):
        rows, t = [], t0
        for i, d in enumerate([4000, 2000, 2000, 2000, 5000]):
            rows.append({"startMs": t, "endMs": t + d, "text": f"line {i}", "device": None, "_said": (t, t + d),
                         "pick": {"photo": f"p{i}.jpg"}})
            t += d
        rows[0]["device"] = {"id": "shadow-up", "line": "words"}
        rows[0]["endMs"] += shift
        rows[1]["startMs"] += shift                                          # pushed late by the overlay before it
        rows = [{"startMs": 0, "endMs": t0, "text": "opening", "device": {"id": "P03"}, "_said": (0, t0)}] + rows
        return rows

    def test_the_gate_flags_a_quick_run_off_its_words(self):
        rows = self.quick_rows()
        rows[2]["_said"] = (rows[2]["startMs"] - 2600, rows[2]["startMs"] - 100)       # its words said before it
        runs = m._drift_runs(rows)
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0][2], 3 - 1)
        self.assertEqual(m._drift_runs(self.quick_rows(t0=10000)), [])                   # the first 30 s
        paged = self.quick_rows()
        paged[1]["device"] = {"id": "highlight-page", "main": 0, "phrases": ["x"], "paragraphs": ["x"]}
        paged[2]["startMs"] += 1200
        self.assertEqual(m._drift_runs(paged), [])                                         # after a page

    def test_a_shot_late_inside_its_own_line_is_on_its_words(self):
        # 2026-11-09: a chapter plate (3.5 s) held its time, the plain shot after it opened 3.5 s into its own 6.3 s
        # line, a template and a plain shot followed - three quick shots, every one inside its own words: a good run,
        # which the gate flagged across the template and folded away
        t = 170000
        rows = [{"startMs": t - 3540, "endMs": t, "text": "Part two. The long winter.", "_said": (t - 3540, t),
                 "device": {"id": "chapter-plate", "heading": "The long winter"}, "section_turn": True},
                {"startMs": t, "endMs": t + 1930, "text": "The river froze from bank to bank that year.",
                 "_said": (t - 3460, t + 2820), "device": None, "pick": {"photo": "a.jpg"}},
                {"startMs": t + 1930, "endMs": t + 4380, "text": "Even the ferry stopped.", "_said": (t + 1930, t + 4380),
                 "device": {"id": "shadow-up", "line": "the ferry stopped"}, "pick": {"photo": "b.jpg"}},
                {"startMs": t + 4380, "endMs": t + 6740, "text": "Boats waited in the ice.", "_said": (t + 4380, t + 6740),
                 "device": None, "pick": {"photo": "c.jpg"}},
                {"startMs": t + 6740, "endMs": t + 12000, "text": "Spring came late.", "_said": (t + 6740, t + 12000),
                 "device": None, "pick": {"photo": "d.jpg"}}]
        self.assertEqual(m._drift_runs(rows), [])
        rows[1]["_said"] = (t - 3460, t - 200)                                             # its line ended before it
        self.assertEqual([x[2] for x in m._drift_runs(rows)], [1])

    def test_the_sync_net_leaves_a_shot_late_inside_its_own_line(self):
        prev = {"startMs": 40000, "endMs": 42000, "text": "a", "device": {"id": "shadow-up", "line": "a"},
                "_said": (40000, 42000)}
        lay = lambda ys, at=42000: [(y, (at + 2000 * i, at + 2000 * (i + 1))) for i, y in enumerate(ys)]

        def net(said):
            ys = [{"startMs": 0, "endMs": 0, "text": f"line {i}", "device": None, "_said": sd, "pick": {"photo": f"{i}.jpg"}}
                  for i, sd in enumerate(said)]
            host = copy.deepcopy(prev)
            res = {"cursor": 42000, "lay": lay(ys), "pre": 0}
            relay = lambda plain: {"cursor": 42000, "lay": lay(plain, 42000 + 2000 * (3 - len(plain))), "pre": 0}
            return m._drift_net(host, list(ys), res, relay, lambda y: (y.get("device") or {}).get("id"),
                                lambda y: y["_said"][1], 90000)[1]

        self.assertEqual(net([(40500, 44500), (44000, 46000), (46000, 48000)]), 0)      # 1.5 s late, inside its line
        self.assertEqual(net([(39000, 41500), (44000, 46000), (46000, 48000)]), 1)      # outside it: folded

    def test_the_gate_never_folds_into_a_hold(self):
        rows = [{"startMs": 40000, "endMs": 43000, "text": "a", "device": None, "hold": True, "_said": (40000, 43000)},
                {"startMs": 43000, "endMs": 44500, "text": "b", "device": None, "_said": (42000, 44500)}]
        self.assertFalse(m._absorb(copy.deepcopy(rows), 1, no_hold=True))                # the drift repair only
        self.assertTrue(m._absorb(copy.deepcopy(rows), 1))                                 # every other caller: as before
        self.off()
        self.assertTrue(m._absorb(rows, 1))                                                # switch off: as before

    def test_a_hard_quick_run_after_a_hold_is_still_mended(self):
        # 2026-11-09: a hold, a bare quick shot, then four quick shots each with a beat overlay - cap_shots cannot join
        # them; the hard quick-run repair folds the bare one into the hold, as before the drift work
        rows = [{"startMs": 41000, "endMs": 52000, "text": "hold", "device": None, "hold": True, "_said": (41000, 52000)},
                {"startMs": 52000, "endMs": 53500, "text": "bare", "device": None, "_said": (52000, 53500),
                 "pick": {"photo": "x.jpg"}}]
        t = 53500
        for i in range(4):
            rows.append({"startMs": t, "endMs": t + 1500, "text": f"beat {i}", "device": None, "_said": (t, t + 1500),
                         "overlay": {"text": f"beat {i}"}, "pick": {"photo": f"b{i}.jpg"}})
            t += 1500
        if not m._bare(rows[1]) or m._covered(rows[1]) or m._bare(rows[0]):
            self.skipTest("the hold or the bare shot reads differently")
        self.assertTrue(m._absorb(rows, 1))
        self.assertEqual(rows[0]["endMs"], 53500)


class SwitchesOff(Base):
    def test_switches_off_leave_no_new_state_and_the_old_cut(self):
        self.off()
        for make in (pages_film, builders_film, page_film):
            cues, heard, rows, job = make()
            out = cut(rows, cues, job)
            self.assertFalse([k for r in out for k in NEW_KEYS if k in r], make.__name__)
        cues, heard, rows, job = builders_film()
        out = cut(rows, cues, job)
        self.assertTrue(row_of(out, "Strangers"))                                         # the late burst as before

    def test_filler_fits_is_off_by_default(self):
        r = {"startMs": 0, "endMs": 1200, "_said": (0, 1200)}
        self.assertTrue(m._filler_fits(r, "P05"))
        os.environ["MRTRUTH_FILLER_FITS"] = "on"
        self.assertFalse(m._filler_fits(r, "P05"))
        self.assertTrue(m._filler_fits(dict(r, endMs=4500, _said=(0, 4500)), "P05"))


if __name__ == "__main__":
    unittest.main()
