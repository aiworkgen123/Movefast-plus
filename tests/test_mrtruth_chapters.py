"""Mr Truth: which chapters are placed when an answer proposes more than a film takes (owner 2026-10-15) - synthetic
data only, every answer faked, no network call:
  - the measured case: Token Supply's five chapters on the 658-s film (at 127, 250, 396, 504 and 597 s, as measured on
    261014-f4625c, where the first three were placed and the film had no chapter for its last 4 min 23 s): the three
    that spread best are kept, keeping the planner's first one where that costs at most 15 s (owner 2026-10-15): 127,
    250 and 504 s, one of them after 8:00, the two left out logged and their rows untouched
  - exactly as before where the cap leaves out none: answers with 3 / 2 / 1 / 0 chapters that can be placed (among
    ones the rules refuse, ones too close, odd shots, duplicates) and four with two of them 20 s apart give the rows,
    the log and the saved answer of 1caaf6d's fill_overlays (copied below, run on mrtruth's own rules and helpers);
    Token Supply's pre-check counts as 1caaf6d's there, and min(3, the most that can be placed) everywhere
  - the choice: 30 s apart among the kept, the smallest longest stretch, then the smallest sum of squares, then the
    earliest, and the best three that keep the earliest one instead where their longest stretch is at most 15 s longer
    (a seeded comparison with every three by hand; at 15 s the first is kept, at 16 s it is not), the same whatever
    order the answer lists them in, placed in film order, no error on odd answers (a shot that is not a number, no
    heading, duplicates, entries that are not objects, "chapters" that is not a list)

    .venv/bin/python -m unittest tests.test_mrtruth_chapters -v
"""
import copy
import inspect
import itertools
import json
import random
import shutil
import sys
import tempfile
import time
import types
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
import test_mrtruth_gate as G  # noqa: E402
import test_mrtruth_tokensupply as T  # noqa: E402


# ── 1caaf6d's code, copied as it is there: `as_there` runs it in mrtruth, the names it reads mrtruth's ──────────
def chapters_placed_1caaf6d(rows: list, got: dict, dossier: dict, names) -> tuple:
    """(how many of an answer's chapters fill_overlays would place, why each other one would not): its placement loop
    run in the head on the rows as they are (Token Supply's pre-check, owner 2026-10-14). A chapter after the third
    placed one is left out as there."""
    placed, last, also, refused = 0, -1e9, set(), []
    chapters = [c for c in (got.get("chapters") if isinstance(got.get("chapters"), list) else []) if isinstance(c, dict)]
    for c in sorted(chapters, key=lambda c: int(c.get("shot", -1)) if str(c.get("shot", "")).lstrip("-").isdigit() else -1):
        try:
            k = int(c["shot"])
        except (KeyError, TypeError, ValueError):
            continue
        head = re.sub(r"\s+", " ", str(c.get("heading") or "")).strip().rstrip(".")
        if not head or placed >= CHAPTERS_MAX:
            continue
        if not 0 <= k < len(rows):
            refused.append(f"shot {k} is not a shot of this film")
            continue
        set_as, _, no = _chapter_fit(rows, k, head, last, dossier, names, also)
        if no:
            refused.append(f"shot {k} at {rows[k]['startMs'] / 1000:.0f} s {no[1]}")
            continue
        placed, last = placed + 1, rows[k]["startMs"]
        also.add(_norm(set_as))
    return placed, refused


def fill_overlays_1caaf6d(engine, job: Path, rows: list, script: str, dossier: dict, build, force: bool = False) -> None:
    """After assign(): 2-3 chapter plates (mandatory), then more overlays until every group has its minimum and the
    film carries something about every OVERLAY_EVERY_S. A placement that needs a longer shot holds its picture."""
    total_s = rows[-1]["endMs"] / 1000.0
    has = lambda tid: sum(1 for r in rows if (r.get("device") or {}).get("id") == tid)
    count = lambda g: sum(has(t) for t in OVERLAY_GROUPS[g][0])
    want_total = max(0, round(total_s / OVERLAY_EVERY_S) - TYPED_CAPTION_SLOTS)
    placed_now = sum(1 for r in rows if r.get("device") and r["device"]["id"] != "photo-pop")
    extra = max(0, want_total - placed_now)
    short = [f"   - {g}: {', '.join(ts)} (has {count(g)}, wants at least {lo}, at most {hi})"
             for g, (ts, lo, hi) in OVERLAY_GROUPS.items() if count(g) < hi and any(LIBRARY[t][0] for t in ts)
             and g != HL_GROUP]                                   # the highlighted page is placed by its own step
    taken = lambda r: r.get("device") is not None
    shots = "\n".join(f"{i}\t{r['startMs'] / 1000:.1f}\t" + ("[TAKEN] " if taken(r) else "") + r["text"]
                       for i, r in enumerate(rows))
    secs = [f"'{s.get('title')}' at ~{int(s.get('startChar') or 0)} chars" for s in (dossier.get("sections") or [])[1:]]
    prompt = FILL_PROMPT.format(chapters_need=f"{CHAPTERS_MIN}-{CHAPTERS_MAX} chapter headings",
                                first=CHAPTER_FIRST_S, gap=max(30.0, total_s / (CHAPTERS_MAX + 1)),
                                sections="; ".join(secs) or "none", extra=extra, short="\n".join(short),
                                specs=TEMPLATE_SPECS, shots=shots)
    out = job / "mrtruth" / "overlays_fill.json"
    key = _hash([prompt])
    got = None if force else _load(out)
    names = _film_names(dossier, script)
    if not (isinstance(got, dict) and got.get("key") == key):
        try:
            got = dict(_ask(engine, prompt, 8000, model=engine.SCRIPT_MODEL, step="more overlays"), key=key)
            if _ts_now(engine) and getattr(_ASKED, "ts", False):   # Token Supply's answer: can its chapters be placed?
                got = dict(_ts_chapters(engine, prompt, rows, got, dossier, names), key=key)   # (this prompt's key)
        except RuntimeError as e:
            engine.log(f"  overlay fill: {e}")
            return
        _dump(out, got)
    snap = list(rows)                                             # the shot numbers Claude saw, by row identity

    def at(n: int) -> int:
        return next((j for j, x in enumerate(rows) if 0 <= n < len(snap) and x is snap[n]), -1)

    # chapters first: mandatory, so they may take a shot from a lesser template and hold their picture
    chapters, last = 0, -1e9
    for c in sorted(got.get("chapters") or [], key=lambda c: int(c.get("shot", -1)) if str(c.get("shot", "")).lstrip("-").isdigit() else -1):
        try:
            k = at(int(c["shot"]))
        except (KeyError, TypeError, ValueError):
            continue
        head = re.sub(r"\s+", " ", str(c.get("heading") or "")).strip().rstrip(".")
        if k < 0 or not head or chapters >= CHAPTERS_MAX:
            continue
        head, src, no = _chapter_fit(rows, k, head, last, dossier, names)
        if no and no[0] == "long":
            engine.log(f"      chapter '{head}' skipped (no whole heading of it fits)")
            continue
        r = rows[k]
        if no:
            engine.log(f"      chapter '{head}' at shot {k} skipped (opening, too close, or the title shot)")
            continue
        if r.get("device"):
            engine.log(f"      template {r['device']['id']} at {r['startMs'] / 1000:.0f}s gives way to chapter '{head}'")
        r["device"], r["section_turn"] = {"id": "chapter-plate", "heading": head}, True
        if src:
            r["_cut_from"] = src                 # what it was made from: the gate reads a heading cut from it
        _hold(engine, rows, k, _need_s("chapter-plate"), f"chapter '{head}'")
        chapters, last = chapters + 1, r["startMs"]
        engine.log(f"      chapter '{head}' at {r['startMs'] / 1000:.0f}s")
    if chapters < CHAPTERS_MIN:                 # never short: evenly spaced turns on free shots, the dossier's titles
        titles = [str(s.get("title") or "") for s in (dossier.get("sections") or [])[1:]] or ["The Turn", "What Remained"]
        aims = [x / (CHAPTERS_MIN + 1) for x in range(1, CHAPTERS_MIN + 1)][chapters:]

        def fill_in(rows, engine, spacing):
            """The fill-in on `rows`; with `spacing`, False (the rows half filled) at a target with no spaced shot."""
            n = chapters
            for f in aims:
                free = [k for k in range(1, len(rows)) if not rows[k].get("section_turn") and (rows[k].get("device") or {}).get("id") not in ("P03", "gallery-strip")]
                turns = [x["startMs"] for x in rows if x.get("section_turn")]
                spaced = [k for k in free if rows[k]["startMs"] >= CHAPTER_FIRST_S * 1000
                          and all(abs(rows[k]["startMs"] - t) >= 30000 for t in turns)]
                if spacing and free and not spaced:
                    return False
                k = min(spaced if spacing else free, key=lambda k: abs(rows[k]["startMs"] - f * total_s * 1000), default=None)
                if k is None:
                    break
                src = titles[min(n, len(titles) - 1)]
                head = _short_heading(src, 25, names=names) or "The Turn"   # whole
                rows[k]["device"], rows[k]["section_turn"] = {"id": "chapter-plate", "heading": head}, True
                if head != " ".join(src.split()).rstrip("."):
                    rows[k]["_cut_from"] = src           # what it was made from (review 2026-10-13, round 4)
                _hold(engine, rows, k, _need_s("chapter-plate"), f"chapter '{head}'")
                n += 1
                engine.log(f"      chapter '{head}' at {rows[k]['startMs'] / 1000:.0f}s (filled)")
            return True
        # with the placed chapters' spacing (2026-10-14, every planner: a planned chapter at 425 s and this one at 436 s,
        # 11 s apart): each the nearest free shot after the opening and 30 s or more from every other chapter, placed or
        # filled - when that places every chapter still missing, tried first on a copy of the rows. Where it cannot (a
        # film under about 90 s: the first fill pushed past the opening leaves the second no spaced shot, and it went
        # next to the first, review 2026-10-14), the fill-in as before for all of them (2-3 chapters are mandatory)
        class Quiet:                             # the try on the copy says nothing in the log
            log = staticmethod(lambda s: None)
        fill_in(rows, engine, fill_in(copy.deepcopy(rows), Quiet, True))

    # then the overlays, through the same word checks as the planner's own (build), on free shots, groups capped
    for o in sorted(got.get("overlays") or [], key=lambda o: int(o.get("shot", -1)) if str(o.get("shot", "")).lstrip("-").isdigit() else -1):
        tid = str(o.get("templateId") or "")
        try:
            k = at(int(o["shot"]))
        except (KeyError, TypeError, ValueError):
            continue
        g = _group_of(tid)
        if k < 0 or tid not in LIBRARY or not LIBRARY[tid][0] or not g or count(g) >= OVERLAY_GROUPS[g][2]:
            continue
        if any((rows[j].get("device") or {}).get("id") == tid and abs(rows[j]["startMs"] - rows[k]["startMs"]) < 30000
               for j in range(len(rows))):
            continue
        r = rows[k]
        if r.get("device") or r.get("section_turn") or not _can(rows, k, tid, ignore_len=True):
            continue
        dev = build(tid, o, k)
        if not dev:
            engine.log(f"      {tid} '{o.get('headline', '')}' at shot {k} refused (words not spoken there / too long)")
            continue
        r["device"] = dev
        _hold(engine, rows, k, _need_s(tid), tid)
        engine.log(f"      added {tid} at {r['startMs'] / 1000:.0f}s: {o.get('headline', '')}")
    mix = {g: count(g) for g in OVERLAY_GROUPS}
    engine.log("  overlay mix: " + ", ".join(f"{g} {n}" for g, n in mix.items()) + f", chapters {has('chapter-plate')}")
    low = [g for g, (ts, lo, _) in OVERLAY_GROUPS.items() if mix[g] < lo]
    if low:
        engine.log(f"  overlay groups still under their minimum: {', '.join(low)}")


def as_there(fn):
    """`fn` (copied above) run in mrtruth's namespace, its rules and helpers read from there as in 1caaf6d."""
    return types.FunctionType(fn.__code__, vars(M), fn.__name__, fn.__defaults__)


# ── the films and answers ────────────────────────────────────────────────────────────────────────────────────────────
# 261014-f4625c: the answer's shots 32/63/98/120/142 on the rows fill_overlays read, and its end (ms) - plan.json is
# numbered after sync, and its rows 120 and 142 start at 499.6 and 588.9 s (review 2026-10-15)
MEASURED, END = [127280, 250160, 395720, 504360, 596620], 658180
HEADS = ["First Quiet Turn", "The Second Door", "A Third Hall", "The Fourth Gate", "A Last Lantern"]   # made up


def film_at(marks, end=END, ms=4200):
    """Plain shots of about `ms` (made-up sentences, the opening title on the first), one starting at each of `marks`
    (ms), the film `end` ms long: (rows, {mark: its shot})."""
    starts, a = [], 0
    for b in sorted(marks) + [end]:
        n = max(1, round((b - a) / ms))
        starts += [a + round(j * (b - a) / n) for j in range(n)]
        a = b
    rows = T.chapter_film(starts)
    rows[-1]["endMs"] = end
    return rows, {m: starts.index(m) for m in marks}


def answer(shots, heads=HEADS, overlays=()):
    return {"chapters": [{"shot": k, "heading": h} for k, h in zip(shots, heads)], "overlays": list(overlays)}


def build(tid, o, k):
    """The overlay's words as the planner's own build would set them (no word check: both runs get the same)."""
    return {"id": tid, "headline": str(o.get("headline") or ""), "kicker": str(o.get("kicker") or ""),
            "lines": [str(x) for x in o.get("lines") or []]}


def turns(rows):
    return [(r["startMs"], r["device"]["heading"]) for r in rows if (r.get("device") or {}).get("id") == "chapter-plate"]


def stretches(starts, end=END):
    """The stretches without a chapter: the film's start to the first, between two, the last to the film's end."""
    s = sorted(starts)
    return [b - a for a, b in zip([0] + s, s + [end])]


def by_hand(times, end, cap=3):
    """The rule as the owner set it, on chapter starts that all pass the static rules: of the sets of `cap` at least
    30 s apart, the smallest longest stretch, then the smallest sum of squares, then the earliest (the rule's best);
    the best of those that keep the earliest start instead where its longest stretch is at most 15 s longer than the
    rule's best one's (owner 2026-10-15)."""
    sets = [c for c in itertools.combinations(sorted(times), cap) if all(b - a >= 30000 for a, b in zip(c, c[1:]))]
    key = lambda c: (max(stretches(c, end)), sum(x * x for x in stretches(c, end)), c)
    top = min(sets, key=key)
    first = min((c for c in sets if c[0] == min(times)), key=key, default=None)
    return first if first and key(first)[0] <= key(top)[0] + 15000 else top


class Base(unittest.TestCase):
    def setUp(self):
        p = mock.patch.object(M, "TS", {"reasked": {}, "handed": {}, "why": []})
        p.start()
        self.addCleanup(p.stop)

    def fill(self, got, rows, fn=None, ts=False):
        """fill_overlays (or `fn`) on `rows` with `got` as the planner's answer, in a job of its own: (engine, saved)."""
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        (d / "mrtruth").mkdir()
        e = T.Fake(ts=[json.dumps(got)]) if ts else T.Fake(anthropic=[json.dumps(got)], provider="anthropic")
        (fn or M.fill_overlays)(e, d, rows, "a made-up script", G.DOSSIER, build)
        return e, json.loads((d / "mrtruth" / "overlays_fill.json").read_text(encoding="utf-8"))

    def both(self, got, rows):
        """Today's fill_overlays and 1caaf6d's on copies of the same rows: ((rows, log, saved), (rows, log, saved))."""
        a, b = copy.deepcopy(rows), copy.deepcopy(rows)
        ea, sa = self.fill(got, a)
        eb, sb = self.fill(got, b, as_there(fill_overlays_1caaf6d))
        return (a, ea.lines, sa), (b, eb.lines, sb)

    def kept(self, marks, end=END, order=None, **kw):
        rows, at = film_at(marks, end)
        got = answer([at[x] for x in (order or marks)], [f"Turn {marks.index(x) + 1}" for x in (order or marks)])
        e, _ = self.fill(got, rows, **kw)
        return [a for a, _ in turns(rows)], e


# ── the measured case ────────────────────────────────────────────────────────────────────────────────────────────────
class Measured(Base):
    def setUp(self):
        super().setUp()
        self.rows, self.at = film_at(MEASURED)
        self.got = answer([self.at[m] for m in MEASURED])

    def test_the_three_that_spread_best_are_kept_and_the_two_left_out_logged(self):
        rows, before = self.rows, copy.deepcopy(self.rows)
        e, saved = self.fill(self.got, rows, ts=True)                    # Token Supply's planner, as measured
        self.assertEqual(e.who(), ["tokensupply"])                       # three can be placed: never asked again
        kept = [a for a, _ in turns(rows)]
        self.assertEqual(kept, [127280, 250160, 504360])                 # the planner's first one, at 127 s, kept
        self.assertEqual(tuple(kept), by_hand(MEASURED, END))
        self.assertTrue(any(a > 8 * 60000 for a in kept))                # one after 8:00
        longest = max(stretches(kept))
        self.assertEqual(longest, 254200)                                # 4 min 14.2 s, 250 s to 504 s
        self.assertLess(longest, END - 395720)                           # was 4 min 23 s, 396 s to the end
        self.assertLess(longest, 4.5 * 60000)
        # (under 4 minutes is out of these five's reach: every three of them leaves 4 min 10 s or more without one; the
        # rule alone keeps 250, 396 and 504 s, 4 min 10.16 s from the film's start, and keeping the first costs 4.04 s)
        pure = min(itertools.combinations(MEASURED, 3),
                   key=lambda c: (max(stretches(c)), sum(x * x for x in stretches(c))))
        self.assertEqual(pure, (250160, 395720, 504360))
        self.assertEqual(max(stretches(pure)), 250160)
        self.assertLessEqual(longest - max(stretches(pure)), M.CHAPTER_KEEP_FIRST_MS)
        self.assertIn("      chapter 'A Third Hall' at 396s left out (the 3 kept spread better through the film)",
                      e.lines)
        self.assertIn("      chapter 'A Last Lantern' at 597s left out (the 3 kept spread better through the film)",
                      e.lines)
        out = " left out (the 3 kept spread better through the film)"
        self.assertEqual([l for l in e.lines if l.startswith("      chapter ")],
                         ["      chapter 'First Quiet Turn' at 127s", "      chapter 'The Second Door' at 250s",
                          "      chapter 'A Third Hall' at 396s" + out, "      chapter 'The Fourth Gate' at 504s",
                          "      chapter 'A Last Lantern' at 597s" + out])
        for m in (395720, 596620):                                       # the left-out shots' rows untouched
            self.assertEqual(next(r for r in rows if r["startMs"] == m), before[self.at[m]])
        self.assertEqual(saved["chapters"], self.got["chapters"])         # the saved answer as it came
        self.assertEqual(M._chapters_placed(before, self.got, G.DOSSIER, []), (3, []))

    def test_1caaf6d_placed_the_first_three(self):
        """What the films had: the first three in film order, none in the last 4 min 23 s, the two later ones dropped
        without a word; the saved answer and its key the same as today's."""
        new, old = self.both(self.got, self.rows)
        self.assertEqual([a for a, _ in turns(old[0])], [127280, 250160, 395720])
        self.assertEqual(max(stretches([a for a, _ in turns(old[0])])), END - 395720)
        self.assertFalse(any("left out" in l for l in old[1]))
        self.assertEqual(new[2], old[2])                                  # overlays_fill.json, its key included
        self.assertEqual([l for l in new[1] if "left out" not in l and not l.startswith("      chapter ")],
                         [l for l in old[1] if not l.startswith("      chapter ")])   # the rest of the log as it was

    def test_on_the_default_planner_the_same(self):
        rows = self.rows
        e, _ = self.fill(self.got, rows)
        self.assertEqual(e.who(), ["anthropic"])
        self.assertEqual([a for a, _ in turns(rows)], [127280, 250160, 504360])


# ── exactly as before where the cap leaves out none ──────────────────────────────────────────────────────────────────
LONG = "Supercalifragilisticexpialidocious Antidisestablishmentarianism"
OVERLAYS = [{"shot": 20, "templateId": "shadow-up", "headline": "A made-up line"},
            {"shot": 44, "templateId": "P04", "headline": "A Name", "kicker": "a role"},
            {"shot": 70, "templateId": "top-title", "headline": "A Running", "lines": ["Title"]},
            {"shot": 102, "templateId": "corner-label", "headline": "A Place", "kicker": "then"}]


def as_before_answers():
    """(name, rows, answer): on the measured shapes (the opening gallery on shot 15, a title card on 61, 4.2-s shots;
    T.measured_film) and on films with chapters at set times."""
    m = T.measured_film
    ch = lambda *pairs: [{"shot": k, "heading": h} for k, h in pairs]
    yield "three, among refused ones", m(), {"chapters": ch(
        (3, "Too Soon"), (15, "On the Gallery"), (30, "The First Turn"), (61, "On the Title"), (80, "The Second Turn"),
        (82, "Too Near"), (90, LONG), (101, "The Third Turn"), (999, "Not a Shot"), ("x", "Not a Number"),
        (40, ""), (50, "   ")) + [{"heading": "No Shot"}, {"shot": 60}], "overlays": OVERLAYS}
    yield "three, duplicates", m(), {"chapters": ch((30, "The First Turn"), (30, "The First Again"), (80, "Second"),
                                                    (101, "The Third Turn"), (101, "Third Again")), "overlays": []}
    yield "three, a shot as text and one as a float", m(), {"chapters": ch(("30", "The First Turn"), (80.0, "Second"),
                                                                          (120, "The Third Turn")), "overlays": []}
    yield "exactly three", m(), {"chapters": ch((30, "First"), (80, "Second"), (130, "Third")), "overlays": OVERLAYS}
    yield "two", m(), {"chapters": ch((15, "Gallery"), (40, "First"), (45, "Too Near"), (140, "Second")),
                       "overlays": OVERLAYS}
    yield "one (filled in)", m(), T.ANSWER
    yield "one long heading cut", m(), {"chapters": ch((40, "The Northern Archive Remembers Everything")),
                                        "overlays": []}
    yield "none (filled in)", m(), {"chapters": [], "overlays": OVERLAYS}
    yield "none placeable", m(), {"chapters": ch((2, "Too Soon"), (61, "Title")), "overlays": []}
    yield "no chapters key", m(), {"overlays": []}
    for name, marks in (("four, two of them 20 s apart", [100000, 300000, 320000, 500000]),
                        ("four, the last two 20 s apart", [100000, 300000, 500000, 520000]),
                        ("four, the first two 20 s apart", [60000, 80000, 300000, 500000]),
                        ("five, two pairs 20 s apart", [100000, 120000, 300000, 450000, 470000])):
        rows, at = film_at(marks)
        yield name, rows, answer([at[x] for x in marks])


class AsBefore(Base):
    def test_rows_log_and_saved_answer_as_1caaf6d(self):
        for name, rows, got in as_before_answers():
            with self.subTest(name):
                new, old = self.both(got, rows)
                self.assertEqual(new[1], old[1])                          # the log, line for line
                self.assertEqual(new[0], old[0])                          # every row
                self.assertEqual(new[2], old[2])                          # overlays_fill.json, its key included
                self.assertFalse(any("left out" in l for l in new[1]))

    def test_the_pre_check_counts_as_1caaf6d(self):
        for name, rows, got in as_before_answers():
            with self.subTest(name):
                self.assertEqual(M._chapters_placed(rows, got, G.DOSSIER, []),
                                 as_there(chapters_placed_1caaf6d)(rows, got, G.DOSSIER, []))

    def test_four_with_two_20_s_apart_keep_30_s(self):
        for marks in ([100000, 300000, 320000, 500000], [100000, 300000, 500000, 520000]):
            rows, at = film_at(marks)
            self.fill(answer([at[x] for x in marks]), rows)
            kept = [a for a, _ in turns(rows)]
            self.assertEqual(len(kept), 3, marks)
            self.assertTrue(all(b - a >= 30000 for a, b in zip(kept, kept[1:])), kept)


# ── the choice ───────────────────────────────────────────────────────────────────────────────────────────────────────
class Choice(Base):
    def test_the_kept_are_30_s_apart(self):
        """Five, two of them 20 s apart: without the 30-s rule the best three would be 200, 420 and 440 s (the longest
        stretch 220 s; keeping the first, at 30 s, would cost 18.18 s, more than 15); with it, 30, 200 and 420 s (238.18
        s, as long as the rule's best, 110, 200 and 420 s: the first is kept at no cost)."""
        marks = [30000, 110000, 200000, 420000, 440000]
        key = lambda c: (max(stretches(c)), sum(x * x for x in stretches(c)))
        free = min(itertools.combinations(marks, 3), key=key)
        self.assertEqual(free, (200000, 420000, 440000))
        self.assertEqual(max(stretches(min((c for c in itertools.combinations(marks, 3) if c[0] == 30000), key=key))),
                         238180)                                          # (220 s + 18.18 s)
        kept, e = self.kept(marks)
        self.assertEqual(kept, [30000, 200000, 420000])
        self.assertEqual(tuple(kept), by_hand(marks, END))
        self.assertEqual(sum("left out (the 3 kept spread better through the film)" in l for l in e.lines), 2)
        self.assertIn("      chapter 'Turn 2' at 110s left out (the 3 kept spread better through the film)", e.lines)
        self.assertIn("      chapter 'Turn 5' at 440s left out (the 3 kept spread better through the film)", e.lines)

    def test_the_first_is_kept_where_it_costs_at_most_15_s(self):
        """A 600-s film, the rule's best 150, 300 and 450 s (every stretch 150 s), one more at 480 s and the planner's
        first just before 150 s (too close to keep with it): the best three that keep the first are it, 300 and 450 s,
        their longest stretch from it to 300 s. The first at 135 s costs 15 s: kept, 150 s left out; at 134 s it costs
        16 s: the rule's three, the first left out."""
        self.assertEqual(M.CHAPTER_KEEP_FIRST_MS, 15000)
        for first, want, out in ((135000, [135000, 300000, 450000], ("Turn 2", 150)),
                                 (134000, [150000, 300000, 450000], ("Turn 1", 134))):
            with self.subTest(first=first):
                marks = [first, 150000, 300000, 450000, 480000]
                kept, e = self.kept(marks, 600000)
                self.assertEqual(kept, want)
                self.assertEqual(tuple(kept), by_hand(marks, 600000))
                self.assertEqual(max(stretches(kept, 600000)) - 150000, 15000 if first == 135000 else 0)
                self.assertIn(f"      chapter '{out[0]}' at {out[1]}s left out (the 3 kept spread better through the "
                              f"film)", e.lines)
                self.assertIn("      chapter 'Turn 5' at 480s left out (the 3 kept spread better through the film)",
                              e.lines)
                rows, at = film_at(marks, 600000)
                self.assertEqual(M._chapters_placed(rows, answer([at[x] for x in marks]), G.DOSSIER, [])[0], 3)

    def test_ties_go_to_the_earliest_and_the_choice_is_the_same_each_time(self):
        """100-500 s of a 600-s film: six threes tie (longest 200 s, the same sum of squares); the earliest is kept,
        whatever order the answer lists them in, run after run."""
        marks = [100000, 200000, 300000, 400000, 500000]
        firsts = set()
        for order in (marks, marks[::-1], [300000, 100000, 500000, 200000, 400000]):
            for _ in range(2):
                kept, _ = self.kept(marks, 600000, order)
                firsts.add(tuple(kept))
        self.assertEqual(firsts, {(100000, 200000, 400000)})

    def test_placed_in_film_order_whatever_the_shot_looks_like(self):
        """A shot written as a float ("119.0") is read before the others in 1caaf6d's order: kept, it is still placed
        in film order, third, and the two before it are not refused as coming before it."""
        rows, at = film_at(MEASURED)
        got = answer([at[m] for m in MEASURED])
        got["chapters"][3]["shot"] = float(at[504360])
        got["chapters"][1]["shot"] = str(at[250160])
        self.fill(got, rows)
        self.assertEqual([a for a, _ in turns(rows)], [127280, 250160, 504360])

    def test_odd_answers(self):
        rows, at = film_at(MEASURED)
        got = answer([at[m] for m in MEASURED])
        got["chapters"] += [{"shot": "x", "heading": "Not a Number"}, {"shot": None, "heading": "No Number"},
                            {"heading": "No Shot"}, {"shot": 40}, {"shot": 40, "heading": " \n "}, 7, "a chapter",
                            None, [], {"shot": at[250160], "heading": "The Second Door"},     # a duplicate, kept one
                            {"shot": at[596620], "heading": "Another Lantern"},              # one left out
                            {"shot": "--5", "heading": "Dashes"}, {"shot": "²", "heading": "Squared"},
                            {"shot": -3, "heading": "Negative"}, {"shot": 10 ** 6, "heading": "Far"},
                            {"shot": at[395720], "heading": LONG}]
        e, _ = self.fill(got, rows)
        self.assertEqual([a for a, _ in turns(rows)], [127280, 250160, 504360])
        self.assertEqual(sum("left out" in l for l in e.lines), 3)        # 396 s, 597 s twice
        # the second door again, on a kept one's shot: skipped as 1caaf6d logged it, not "left out" (review 2026-10-15)
        self.assertIn(f"      chapter 'The Second Door' at shot {at[250160]} skipped (opening, too close, or the title "
                      f"shot)", e.lines)
        self.assertEqual(M._chapters_placed(film_at(MEASURED)[0], got, G.DOSSIER, [])[0], 3)
        for chapters in ("five", {"shot": 3}, None, 5, [None, 1, "x"]):
            with self.subTest(chapters=chapters):
                rows, _ = film_at(MEASURED)
                e, _ = self.fill({"chapters": chapters, "overlays": []}, rows)
                self.assertEqual(len(turns(rows)), 2)                     # filled in, as with no chapters
                self.assertEqual(M._chapters_placed(film_at(MEASURED)[0], {"chapters": chapters}, G.DOSSIER, [])[0], 0)

    def test_as_the_rule_says_on_many_answers(self):
        """Seeded answers of 4-9 chapters on an 11-minute film, over all of it or bunched in 1.5-2.5 minutes of it, some
        refused by the rules or too close: whenever more than three can be placed, the three kept are the rule's by
        hand, and the pre-check counts three; otherwise the placement is 1caaf6d's."""
        rnd, seen = random.Random(20261015), {"chosen": 0, "as before": 0}
        for _ in range(160):
            span = rnd.choice([END - 15000, 150000, 90000])
            lo = rnd.randrange(10000, END - 5000 - span + 1000, 1000)
            marks = sorted(rnd.sample(range(lo, lo + span, 1000), rnd.randint(4, 9)))
            rows, at = film_at(marks)
            ok = [x for x in marks if x >= M.CHAPTER_FIRST_S * 1000]
            more, last = 0, -1e9                                          # 1caaf6d's loop with no cap, by hand
            for x in ok:
                if x - last >= 30000:
                    more, last = more + 1, x
            got = answer([at[x] for x in marks], [f"Turn {i}" for i in range(len(marks))])
            placed = M._chapters_placed(rows, got, G.DOSSIER, [])[0]
            if more > 3:
                seen["chosen"] += 1
                self.fill(got, rows)
                self.assertEqual(tuple(a for a, _ in turns(rows)), by_hand(ok, END), marks)
                self.assertEqual(placed, 3)
            else:
                seen["as before"] += 1
                new, old = self.both(got, rows)
                self.assertEqual((new[0], new[1]), (old[0], old[1]), marks)
                self.assertEqual(placed, min(3, more))
        self.assertGreater(min(seen.values()), 40, seen)                  # both kinds tried


# ── a garbage answer of hundreds (review 2026-10-15: the answer may run to 8000 tokens) ─────────────────────────────
class Garbage(Base):
    def choose(self, chapters, end=1500000):
        """_chapter_choice on a film `end` ms long of plain 4.2-s shots: (rows, todo, kept, left out, headings looked
        at by _chapter_fit, seconds taken)."""
        rows, _ = film_at([], end)
        _, todo = M._chapter_asked({"chapters": chapters})
        with mock.patch.object(M, "_chapter_fit", wraps=M._chapter_fit) as fit:
            t = time.monotonic()
            _, keep, left = M._chapter_choice(rows, todo, G.DOSSIER, M._film_names(G.DOSSIER, "a made-up script"))
            took = time.monotonic() - t
        return rows, todo, keep, left, fit.call_count, took

    def test_hundreds_cut_to_one_dossier_title_end_at_once(self):
        """297 long headings that each cut to one dossier title (the first set as the title alone, every other one then
        to nothing) and 3 late ones, on a 25-min film: no three of them had been found to set, so nearly every three
        was checked (100 of them took 22 s, 300 did not end). Now CHAPTERS_LOOK of them are looked at, a pair that
        cannot be set is not taken further, and nothing is kept (no three of those looked at can be set): the
        placement as before, which places three."""
        dup = "The Long Forgotten Rooms Of " + G.DOSSIER["sections"][1]["title"]
        chapters = [{"shot": 8 + i, "heading": dup} for i in range(297)] + [
            {"shot": k, "heading": f"Late {k}"} for k in (320, 335, 350)]
        rows, todo, keep, left, fits, took = self.choose(chapters)
        self.assertLess(fits, 20000)
        self.assertLess(took, 10)
        self.assertEqual((keep, left), ((), {}))
        e, _ = self.fill({"chapters": chapters, "overlays": []}, rows)
        self.assertEqual(len(turns(rows)), 3)
        self.assertFalse(any("left out" in l for l in e.lines))

    def test_hundreds_early_end_at_once_and_keep_three_of_those_looked_at(self):
        """600 short headings on the first third of a 25-min film (the stretch to the end the longest, so no branch was
        cut: 600 took 16-20 s, 1000 95 s): three of the CHAPTERS_LOOK looked at, evenly through them, 30 s apart."""
        chapters = [{"shot": 8 + i % 119, "heading": f"T{i}"} for i in range(600)]
        rows, todo, keep, left, fits, took = self.choose(chapters)
        self.assertLess(took, 5)
        starts = sorted((rows[todo[n][0]]["startMs"], n) for n in range(len(todo)))
        looked = [starts[j * (len(starts) - 1) // (M.CHAPTERS_LOOK - 1)][1] for j in range(M.CHAPTERS_LOOK)]
        self.assertEqual(len(keep), 3)
        self.assertTrue(set(keep) <= set(looked), keep)
        at = sorted(rows[todo[n][0]]["startMs"] for n in keep)
        self.assertTrue(all(b - a >= 30000 for a, b in zip(at, at[1:])), at)
        self.assertEqual(len(left), 597)                                  # every other one logged as left out

    def test_up_to_chapters_look_searched_whole_and_more_evenly_through_them(self):
        """48 that can be placed: the rule's three of all of them (by hand); 60: the rule's three of the 48 looked at,
        the 1st, the 60th and 46 evenly between them in film order."""
        end = 900000
        for n in (M.CHAPTERS_LOOK, 60):
            with self.subTest(n=n):
                marks = [30000 + 14000 * i for i in range(n)]
                looked = marks if n <= M.CHAPTERS_LOOK else [marks[j * (n - 1) // (M.CHAPTERS_LOOK - 1)]
                                                              for j in range(M.CHAPTERS_LOOK)]
                kept, e = self.kept(marks, end)
                self.assertEqual(tuple(kept), by_hand(looked, end))
                self.assertEqual(sum("left out" in l for l in e.lines), n - 3)


class Wiring(unittest.TestCase):
    def test_the_rules_say_so(self):
        rules = " ".join((HERE / "MR_TRUTH_RULES.md").read_text(encoding="utf-8").split())
        self.assertIn("When a plan proposes more chapters than a film takes, the three that spread best through the "
                      "film are kept, keeping the plan's first chapter where that costs at most 15 s (2026-10-15: a "
                      "film had none in its last 4.5 minutes).", rules)

    def test_before_and_after_the_chapters_as_it_was(self):
        """The brief, its key, the ask and the saved answer before the chapters, and the fill-in ("never short") and
        the overlays after them, are 1caaf6d's line for line."""
        src = lambda f: inspect.getsource(f).split("\n", 1)[1]
        before = lambda f: src(f).split("    snap = list(rows)")[0]
        after = lambda f: src(f).split("    if chapters < CHAPTERS_MIN:")[1]
        for part in (before, after):
            self.assertEqual(part(M.fill_overlays), part(fill_overlays_1caaf6d))
        self.assertIn("key = _hash([prompt])", before(M.fill_overlays))


if __name__ == "__main__":
    unittest.main()
