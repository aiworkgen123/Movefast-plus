"""Mr Truth HL (owner 2026-10-11): the highlighted page, placed by the planner itself - "Try very hard to fit it on every
video. Only reject when it doesn't actually fit ... 2-3 times per 10 minutes of film". The moments a cheap look finds
(a line that cites, quotes or describes a written or recorded source), one Claude call that chooses and writes the
pages (faked here), the checks on every word, the timing that puts the main phrase's highlight on the narrator's words,
the cut around it, sync, the gate's page rule and its repairs, the picture step that never searches a page's shot.
Synthetic data only (made-up words and lines): no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_hl -v
"""
import copy
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
import test_mrtruth_gate as G  # noqa: E402

QUOTE = 'The ledger read, "no stranger may pass the river gate tonight."'
NOTES = "In his notes the keeper wrote that the lamp burned until dawn."
PARS = ["Entry for the winter quarter, kept by the warden of the outer wall and read aloud at each change of the watch.",
        "His order for the season was plain: no stranger may pass the river gate tonight, and no lamp is lit near it.",
        "Any keeper who opens it before spring answers to the council of the river towns, as the old charter says."]


def page(main_words="no stranger may pass the river gate tonight", first="the outer wall", last="the council", main=1):
    """A page in the ledger's register; the main phrase in paragraph `main` + 1."""
    pars, phs = list(PARS), [first, main_words, last]
    if main == 0:
        pars = [PARS[1], PARS[0], PARS[2]]
        phs = [main_words, first, last]
    return {"id": "highlight-page", "paragraphs": pars, "phrases": phs, "main": main}


def plain_film(n, ms=4000):
    """n plain shots of `ms` with made-up sentences (nothing cites a source), the opening title on the first."""
    rows = [{"startMs": k * ms, "endMs": (k + 1) * ms, "text": G.line(k), "device": None, "entities": [],
             "visualIntent": G.line(k), "queries": [G.line(k), "", ""]} for k in range(n)]
    rows[0]["device"] = M._auto_title(G.DOSSIER, "")
    return rows


class Claude:
    """engine for the page step: `answer` (a dict, or a function of the prompt) or a failure; every prompt kept."""
    SCRIPT_MODEL = UTILITY_MODEL = "offline"

    def __init__(self, answer=None, fail=False):
        self.answer, self.fail, self.calls, self.lines = answer, fail, [], []

    def log(self, s):
        self.lines.append(s)

    def claude(self, prompt, model, max_tokens=0):
        self.calls.append(prompt)
        if self.fail:
            raise RuntimeError("HTTP 529 overloaded")
        return json.dumps(self.answer(prompt) if callable(self.answer) else self.answer)


class Tmp(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.job = Path(self.tmp.name) / "job"
        (self.job / "mrtruth").mkdir(parents=True)
        M.HL.clear()
        M.DEV_DROPS.clear()

    def tearDown(self):
        self.tmp.cleanup()

    def run_step(self, rows, eng, script="the script"):
        G.write_job(self.job, rows)
        return M.highlight_pages(eng, self.job, rows, script, G.DOSSIER, G.cues_of(rows))

    def heard(self, rows):
        return M._heard(self.job, G.cues_of(rows))


# ── the moments, and the moments that cannot carry a page ─────────────────────────────────────────────────────────
class Moments(Tmp):
    def test_the_cheap_look(self):
        self.assertEqual(M._hl_score(G.line(3)), 0)
        self.assertEqual(M._hl_score("The river ran high that spring."), 0)
        self.assertGreaterEqual(M._hl_score(QUOTE), 5)                  # quotation marks, a verb of reading, a ledger
        self.assertEqual(M._hl_score(NOTES), 3)                         # wrote, notes
        self.assertEqual(M._hl_score("According to the report, the wall fell."), 3)
        self.assertEqual(M._hl_score("The manuscript was old."), 1)

    def test_what_cannot_carry_a_page_is_refused_with_its_reason(self):
        rows = plain_film(40)
        rows[0]["text"] = NOTES                                          # the opening title's shot
        rows[5]["text"], rows[5]["typedCaption"] = NOTES, {"lines": ["A Keeper"], "startFrame": 8}
        rows[9]["text"], rows[9]["device"], rows[9]["section_turn"] = NOTES, {"id": "chapter-plate", "heading": "X"}, True
        rows[13]["text"], rows[13]["device"] = NOTES, {"id": "P04", "mainLine": "The keeper", "supportLine": ""}
        rows[17]["text"] = "In 1932 the keeper wrote it down."             # a year: its date card's shot
        rows[21]["text"], rows[22]["typedCaption"] = NOTES, {"lines": ["Soon"], "startFrame": 8}   # no room after it
        rows[25]["text"], rows[25]["device"] = QUOTE, {"id": "P08"}       # gives way
        rows[30]["text"] = NOTES
        cands, refused = M._hl_candidates(rows, G.cues_of(rows))
        why = {round(r["startMs"] / 1000): w for r, w in refused}
        self.assertEqual(why[0], "the opening title's shot")
        self.assertEqual(why[20], "a typed caption sits there")
        self.assertEqual(why[36], "a chapter opens there")
        self.assertEqual(why[52], "P04 sits there")
        self.assertIn("a year is said there", why[68])
        self.assertTrue(why[84].startswith("too short (4.0s before the next words on screen"), why[84])
        self.assertEqual([(c["k"], c["taking"]) for c in cands], [(25, "P08"), (30, "")])

    def test_the_window_takes_the_sentence_around_the_citing_line(self):
        rows = plain_film(30)
        rows[10]["text"] = "Years later a previous review had produced a notation that read, in"
        rows[11]["text"] = 'translation, "material not fit for the common reader."'
        rows[9]["text"] = "Then, in the"                                  # its sentence opens on the shot before
        c = {x["k"]: x for x in M._hl_candidates(rows, G.cues_of(rows))[0]}
        self.assertEqual((c[10]["i"], c[10]["j"]), (9, 11))               # the quote said on the next line is inside
        self.assertIn("material not fit", c[10]["text"])
        self.assertEqual(c[10]["since"], rows[9]["startMs"] - M.HL_EARLY_MS)
        self.assertEqual(c[10]["until"], rows[-1]["endMs"])                # nothing pinned after it
        self.assertEqual((c[11]["i"], c[11]["j"]), (10, 11))               # another window: Claude chooses one
        self.assertIn("[4.0] Years later", c[10]["line"])                  # when each part is heard, from its start


# ── the checks on what Claude wrote ───────────────────────────────────────────────────────────────────────────────
class Checks(unittest.TestCase):
    def test_a_good_page_passes_and_each_fault_is_named(self):
        said = "His order was plain: no stranger may pass the river gate tonight."
        self.assertEqual(M._hl_problem(page(), said), "")
        self.assertEqual(M._hl_problem(page(), None), "")
        bad = lambda **kw: M._hl_problem(dict(page(), **kw), said)
        self.assertIn("is not in its paragraph", bad(phrases=["the outer wall", "no stranger may pass the gate", "the council"]))
        self.assertIn("not three", bad(phrases=["the outer wall", "the council"]))
        self.assertIn("not three", bad(paragraphs=PARS[:2]))
        self.assertIn("not plain text", bad(paragraphs=[PARS[0] + " See https://x.org/y", PARS[1], PARS[2]]))
        self.assertIn("not plain text", bad(paragraphs=[PARS[0].replace("Entry", "**Entry**"), PARS[1], PARS[2]]))
        self.assertIn("not plain text", bad(paragraphs=["Consultation file: " + PARS[0], PARS[1], PARS[2]]))
        self.assertIn("not paragraph 1, 2 or 3", bad(main=3))
        long = PARS[0] + " " + PARS[0] + " " + PARS[0]
        self.assertIn("lines", bad(paragraphs=[long, PARS[1], PARS[2]]))
        self.assertIn("the page runs to", bad(paragraphs=[PARS[0] + " " + PARS[0][:60], PARS[1] + " " + PARS[1][:60],
                                                          PARS[2] + " " + PARS[2][:60]]))
        self.assertIn("is not said on its shot", M._hl_problem(page(), "The lamp burned until dawn."))
        self.assertIn("more than 8 words", bad(phrases=["kept by the warden of the outer wall and read aloud",
                                                        "no stranger may pass the river gate tonight", "the council"]))

    def test_near_verbatim_and_where_it_is_said(self):
        self.assertTrue(M._hl_heard_in("No stranger may pass the river-gate tonight", "no stranger may pass the river-gate tonight."))
        self.assertTrue(M._hl_heard_in("no stranger may pass the river gate tonight", 'read, "no stranger may pass the gate tonight."'))
        self.assertFalse(M._hl_heard_in("the lamp burned", "the lamp was burning"))      # four words or fewer: exact
        heard = [(1000 + 300 * k, w) for k, w in enumerate("the ledger read no stranger may pass the river gate tonight".split())]
        self.assertEqual(M._hl_said_at(page(), heard, 0, 9000), 1000 + 300 * 3)
        self.assertIsNone(M._hl_said_at(page(), heard, 2500, 9000))       # its start is outside the window

    def test_the_page_is_measured_the_way_the_browser_sets_it(self):
        self.assertEqual(M._hl_lines(PARS[0], "the outer wall"), 2)
        self.assertEqual(M._hl_lines("A short line.", "short"), 1)
        self.assertEqual(M._hl_lines(" ".join(["word"] * 40), "word word"), 3)      # 14.9 words a line
        self.assertEqual(M._hl_lines("x " + "W" * 70, "W" * 70), 99)       # one run wider than the column
        self.assertEqual((M._HL_EM["a"], M._HL_EM_B["a"], M._HL_EM[" "]), (0.561, 0.599, 0.26))

    def test_tidy_cuts_long_phrases_and_sets_an_archive_label_with_a_dash(self):
        p = dict(page(), paragraphs=["Consultation file: " + PARS[0], PARS[1], PARS[2]],
                 phrases=["Consultation file: Entry for the winter quarter, kept by the warden", PARS[1][36:], "the council"])
        t = M._hl_tidy(p)
        self.assertTrue(t["paragraphs"][0].startswith("Consultation file — Entry"))
        self.assertLessEqual(M._hl_nwords(t["phrases"][0]), 5)
        self.assertIn(t["phrases"][0], t["paragraphs"][0])
        self.assertTrue(t["phrases"][1].startswith("no stranger may pass"))   # the main one keeps its first word
        self.assertLessEqual(M._hl_nwords(t["phrases"][1]), M.HL_PHRASE_WORDS)
        self.assertEqual(M._hl_problem(t), "")

    def test_a_phrase_copied_before_its_paragraph_changed_is_found_again(self):
        par = "The passage states that the text then specified when the interval of awareness ended, in no hours at all."
        self.assertEqual(M._hl_refind(par, "specified when the interval ended"), "specified when the interval")
        self.assertEqual(M._hl_refind(par, "a lamp burned in the window"), "")
        p = dict(page(), phrases=["the outer wall", "no stranger may pass the gate", "the council"])
        self.assertEqual(M._hl_tidy(p)["phrases"][1], "no stranger may pass the river gate")   # review 2026-10-11
        self.assertEqual(M._hl_problem(M._hl_tidy(p)), "")
        moved = dict(page(), main=2, phrases=["the outer wall", "the council", "no stranger may pass the river gate tonight"])
        t = M._hl_tidy(moved)                                             # the main phrase written in paragraph 2, not 3
        self.assertEqual((t["main"], t["phrases"][1]), (1, "no stranger may pass the river gate tonight"))
        self.assertIn(t["phrases"][2], PARS[2])
        self.assertTrue(M._hl_good(t["phrases"][2]), t["phrases"][2])
        self.assertEqual(M._hl_problem(t), "")
        self.assertEqual(M._hl_own("It offers no further detail, leaving the colleague to judge it alone."), "no further detail")
        par3 = "The text itself remains accessible to approved researchers, though the notation closed its path."
        cut = M._hl_shorten(dict(page(main=0), paragraphs=[PARS[1], PARS[0], par3],
                                 phrases=[page()["phrases"][1], "the outer wall", "remains accessible to approved researchers"]),
                            13 * 10 + 48, False)
        self.assertEqual(cut["phrases"][2], "researchers")                # cut from the phrase as it came, never drifting

    def test_frames_and_lengths(self):
        p = dict(page(), phrases=["the outer wall", "no stranger may pass", "the council"])
        self.assertEqual(M._hl_frames(p), 13 * 9 + 48)
        self.assertEqual(M._hl_pre_ms(p), round(13 * 3 * 1000 / 30))
        self.assertEqual(M._hl_need_ms(p), int(1000 * (max(5.0, (13 * 9 + 48 + 4) / 30) + 0.3)))
        ten = dict(p, phrases=["the outer wall", "no stranger may pass", "the council of"])
        self.assertEqual(M._hl_frames(ten), 178)                          # the reference: 3 + 4 + 3 words, 178 frames
        self.assertEqual(M._build_frames(ten), 178)
        self.assertEqual(M._build_frames({"id": "P05"}), M.BUILD_FRAMES["P05"])
        self.assertEqual(M._need_ms({"device": ten}), M._hl_need_ms(ten))
        self.assertEqual(M._overlay_words({"device": ten}), ["stranger", "may", "pass"])   # its words on the voice


# ── how many a film carries ──────────────────────────────────────────────────────────────────────────────────────
class Cap(unittest.TestCase):
    def test_two_or_three_per_ten_minutes_at_least_one_at_most_six(self):
        cap = lambda mins: M._hl_cap([{"endMs": int(mins * 60000)}])
        # rounded down (review 2026-10-11: half up gave 5 min 2 pages and 15 min 5, over 3 per 10 minutes)
        self.assertEqual([cap(m) for m in (1, 2, 3, 5, 6.7, 8.4, 10, 11, 15, 20, 30)], [1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 6])
        with mock.patch.object(M, "HL_PER_10MIN", 0.0):
            self.assertEqual(cap(11), 0)
        with mock.patch.object(M, "HL_PER_10MIN", 2.0):
            self.assertEqual(cap(11), 2)
        rows = plain_film(165)                                            # 11 minutes
        self.assertEqual(M._group_cap(rows, M.HL_GROUP), 3)
        self.assertEqual(M.OVERLAY_GROUPS[M.HL_GROUP][:2], (["highlight-page"], 0))   # never mandatory

    def test_fill_overlays_never_offers_it(self):
        rows = plain_film(40)
        eng = Claude(answer={"chapters": [], "overlays": []})
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "mrtruth").mkdir()
            M.fill_overlays(eng, Path(d), rows, "s", G.DOSSIER, lambda *a: None)
        self.assertNotIn("highlight-page", eng.calls[0])
        self.assertNotIn("source page", eng.calls[0])


# ── the timing: the main phrase highlighted while it is said ─────────────────────────────────────────────────────
class Timing(unittest.TestCase):
    PER = 13 * 1000 / 30

    def test_the_phrases_before_set_when_the_main_highlight_starts(self):
        h, since = 12500, 9700                                            # said 2.8 s after the page may open
        nine = dict(page(), phrases=["the outer wall", "no stranger may pass", "the council"])
        dev, opens = M._hl_fit(nine, since, h, 30000)
        self.assertEqual(opens + M._hl_pre_ms(dev), h - M.SYNC_LEAD_MS)    # the main highlight starts on its words
        self.assertGreaterEqual(opens, since)
        self.assertEqual(dev["phrases"], nine["phrases"])                 # Claude's own phrases when they fit
        dev, opens = M._hl_fit(page(), since, h, 30000)                    # 3 + 8 + 2 words: HL_WORDS first (review
        self.assertEqual(opens + M._hl_pre_ms(dev), h - M.SYNC_LEAD_MS)    # 2026-10-11: 13 ran past the zoom's stop)
        self.assertEqual(dev["phrases"], ["outer wall", page()["phrases"][1], "council"])   # its noun kept, not "the outer"
        self.assertLessEqual(sum(M._hl_nwords(x) for x in dev["phrases"][:2]), M.HL_WORDS)
        dev, opens = M._hl_fit(page(), since, 10800, 30000)                # said 1.1 s in: two words at most before it
        self.assertEqual(opens + M._hl_pre_ms(dev), 10800 - M.SYNC_LEAD_MS)
        self.assertGreaterEqual(opens, since)
        self.assertLessEqual(M._hl_nwords(dev["phrases"][0]), 2)
        self.assertIn(dev["phrases"][0], dev["paragraphs"][0])
        self.assertTrue(M._hl_good(dev["phrases"][0]), dev["phrases"][0])   # a run that reads whole: "outer wall"
        self.assertEqual(dev["phrases"][1], page()["phrases"][1])
        long = dict(page(), phrases=["kept by the warden of the outer wall", page()["phrases"][1], "the council"])
        dev, opens = M._hl_fit(long, since, 12500, 30000)                  # 8 words do not fit before 2.8 s: re-set
        self.assertEqual(opens + M._hl_pre_ms(dev), 12500 - M.SYNC_LEAD_MS)
        self.assertGreaterEqual(opens, since)
        self.assertTrue(M._hl_good(dev["phrases"][0]), dev["phrases"][0])

    def test_a_run_that_reads_whole(self):
        for s in ("the last person", "outer wall", "Restivo", "the council of the river towns"):
            self.assertTrue(M._hl_good(s), s)
        for s in ("to everything", "the old notation on the manuscript's", "handwritten notation attached to this",
                  "of the", "kept by"):
            self.assertFalse(M._hl_good(s), s)

    def test_main_first_opens_on_its_words_and_a_page_is_cut_to_its_room(self):
        dev, opens = M._hl_fit(page(main=0), 9700, 10000, 30000)
        self.assertEqual(opens, 10000 - M.SYNC_LEAD_MS)
        cut, _ = M._hl_fit(page(main=0, last="the council of the river towns"), 9700, 10000, 9850 + 6500)
        self.assertLessEqual(M._hl_need_ms(cut), 6500)
        self.assertEqual(cut["phrases"], [page()["phrases"][1], "the", "the"][:1] + cut["phrases"][1:])
        self.assertEqual([M._hl_nwords(x) for x in cut["phrases"]], [8, 1, 1])   # the main phrase whole: the others went
        tight, _ = M._hl_fit(page(main=0, last="the council of the river towns"), 9700, 10000, 9850 + 6000)
        self.assertEqual(tight["phrases"][0], "no stranger may pass the river gate")   # then the main one, from its end
        self.assertIsNone(M._hl_fit(page(main=0), 9700, 10000, 9850 + 4000))   # under HL_MIN_S: no page

    def test_too_soon_for_the_highlights_before_it(self):
        self.assertIsNone(M._hl_fit(dict(page(), main=2, phrases=["the outer wall", "no lamp", "the council"]), 9700, 9900, 30000))

    def test_the_gate_re_times_on_a_fixed_cut(self):
        dev = M._hl_retime(page(), 10000, 10000 + 150 + 4 * 433, 240)
        self.assertIsNotNone(dev)
        off = 10000 + M._hl_pre_ms(dev) - (10000 + 4 * 433)
        self.assertTrue(-M.SYNC_TOLERANCE_MS <= off <= M.SYNC_MAX_LATE_MS, off)
        self.assertIsNone(M._hl_retime(page(), 10000, 10000 + 150 + 40 * 433, 240))


# ── the step: one call, the checks, the cut, the cache ───────────────────────────────────────────────────────────
def answer_for(*pages_):
    return {"pages": [dict(shot=k, source="the ledger", why="it is read out", **{
        "paragraphs": p["paragraphs"], "phrases": p["phrases"], "main": p["main"] + 1}) for k, p in pages_],
        "rejected": []}


def own_quote(k):
    """A quote of its own for shot k (made-up words): no two pages highlight the same words."""
    return f'The ledger read, "no {G.word(k, 0)} may pass the {G.word(k, 1)} gate tonight."'


def own_page(k, main=1):
    main_words = f"no {G.word(k, 0)} may pass the {G.word(k, 1)} gate tonight"
    p = page(main_words=main_words, main=main)
    p["paragraphs"][main] = p["paragraphs"][main].replace("no stranger may pass the river gate tonight", main_words)
    return p


def own_quotes(n, at):
    rows = plain_film(n)
    for k in at:
        rows[k]["text"] = own_quote(k)
    return rows


def quote_film(n=40, at=(10,)):
    """A plain film with the ledger's quote said on the shots `at`."""
    rows = plain_film(n)
    for k in at:
        rows[k]["text"] = QUOTE
    return rows


class Step(Tmp):

    def test_a_page_is_written_checked_timed_and_cut_into_its_window(self):
        rows = quote_film()
        rows[10]["device"] = {"id": "P08"}
        eng = Claude(answer_for((10, page())))
        hl = self.run_step(rows, eng)
        self.assertEqual(len(eng.calls), 1)
        self.assertIn("shot 10 (40.0s, 8.0s, now P08 - it gives way)", eng.calls[0])
        self.assertIn("<script>\nthe script\n</script>", eng.calls[0])
        pg = [r for r in rows if (r.get("device") or {}).get("id") == "highlight-page"]
        self.assertEqual(len(pg), 1)
        r, p = pg[0], hl["placed"][0]
        h = M._hl_said_at(r["device"], self.heard(plain_film(40)[:10] + [dict(rows[10], text=QUOTE)]), 39000, 48000)
        self.assertEqual(p["main_heard_s"], round(h / 1000, 2))
        self.assertEqual(round(p["highlight_starts_s"] * 1000), h - M.SYNC_LEAD_MS)
        self.assertEqual((r["startMs"], r["endMs"], r["hl_was"]), (40000, 48000, "P08"))   # rows 10-11, one shot
        self.assertEqual(len(rows), 39)
        self.assertTrue(any(l.startswith("  highlighted pages: 1 placed of at most 1") for l in eng.lines), eng.lines)
        self.assertEqual(json.loads((self.job / "mrtruth" / "highlights.json").read_text())["answer"]["pages"][0]["shot"], 10)

    def test_what_is_said_before_the_page_keeps_its_own_shot(self):
        rows = plain_film(40)
        rows[10]["text"] = "Years later a previous review had produced a notation that read, in"
        rows[11]["text"] = 'translation, "no stranger may pass the river gate tonight."'
        p = page(main=0, first="the outer wall", last="the council")
        hl = self.run_step(rows, Claude(answer_for((10, p))))
        self.assertEqual(len(hl["placed"]), 1)
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page")
        self.assertEqual(rows[k]["startMs"], 44000)                       # the page opens on the quote's line
        self.assertEqual((rows[k - 1]["startMs"], rows[k - 1]["endMs"], rows[k - 1]["device"]), (40000, 44000, None))
        self.assertEqual(rows[k - 1]["text"], rows[k - 1]["text"].strip())
        self.assertIn("previous review", rows[k - 1]["text"])               # its own words, its own picture search

    def test_spacing_and_the_cap(self):
        rows = own_quotes(n=165, at=(10, 20, 60, 100))               # 11 minutes: at most 3
        hl = self.run_step(rows, Claude(answer_for(*[(k, own_page(k)) for k in (10, 20, 60, 100)])))
        self.assertEqual([p["line_at_s"] for p in hl["placed"]], [40.0, 240.0, 400.0])   # 80 s is too close
        why = {x["at_s"]: x["why"] for x in hl["rejected"] if x["by"] == "check"}
        self.assertTrue(why[80.0].startswith("within 90s of the page at 40s"), why)
        self.assertIn("1 within 90s of another page", M._hl_reasons(hl["rejected"]))   # (it read '1 within')
        rows = own_quotes(n=165, at=(10, 40, 70, 100, 130))
        hl = self.run_step(rows, Claude(answer_for(*[(k, own_page(k)) for k in (10, 40, 70, 100, 130)])))
        self.assertEqual(len(hl["placed"]), 3)
        self.assertEqual(sorted(x["why"] for x in hl["rejected"] if x["by"] == "check"),
                         ["a spare (the film's 3 are placed)"] * 2)

    def test_a_failed_call_drops_the_moments_never_the_film_and_is_not_cached(self):
        rows = quote_film()
        before = copy.deepcopy(rows)
        eng = Claude(fail=True)
        hl = self.run_step(rows, eng)
        self.assertEqual((hl["claude"], hl["placed"], rows), ("failed", [], before))
        self.assertEqual(len(eng.calls), 3)                               # _ask's own three tries
        self.assertFalse((self.job / "mrtruth" / "highlights.json").exists())
        self.assertTrue(any("none this run (asked again next run)" in l for l in eng.lines))
        eng2 = Claude(answer={"no": "json"})                              # an answer with no pages: none placed
        hl = self.run_step(rows, eng2)
        self.assertEqual(hl["placed"], [])

    def test_a_page_the_checks_refuse_drops_that_moment_only_and_a_re_run_places_the_same(self):
        rows = quote_film(n=165, at=(10, 60))
        broken = dict(page(), phrases=["the outer wall", "a lamp burned in the window", "the council"])   # not in it
        eng = Claude(answer_for((10, broken), (60, page())))
        hl = self.run_step(rows, eng)
        self.assertEqual([round(p["at_s"]) // 10 for p in hl["placed"]], [24])
        self.assertIn("is not in its paragraph", next(x["why"] for x in hl["rejected"] if x["at_s"] == 40.0))
        saved = json.loads((self.job / "mrtruth" / "highlights.json").read_text())   # review 2026-10-11: cached, so a
        self.assertEqual(saved["refused"][0]["shot"], 10)                 # re-run neither asks nor cuts other shots
        again = quote_film(n=165, at=(10, 60))
        hl2 = self.run_step(again, eng)
        self.assertEqual((len(eng.calls), hl2["claude"]), (1, "cached"))
        self.assertEqual([p["at_s"] for p in hl2["placed"]], [p["at_s"] for p in hl["placed"]])
        self.assertEqual([(r["startMs"], r["endMs"]) for r in again], [(r["startMs"], r["endMs"]) for r in rows])

    def test_a_good_answer_is_cached_and_a_changed_script_asks_again(self):
        rows = quote_film()
        eng = Claude(answer_for((10, page())))
        self.run_step(copy.deepcopy(rows), eng)
        hl = self.run_step(copy.deepcopy(rows), eng)
        self.assertEqual((len(eng.calls), hl["claude"], len(hl["placed"])), (1, "cached", 1))
        self.run_step(copy.deepcopy(rows), eng, script="another script")
        self.assertEqual(len(eng.calls), 2)

    def test_the_main_phrase_said_on_the_moment_beside_it_moves_the_page_there(self):
        rows = plain_film(165)
        rows[50]["text"] = "The keeper kept a ledger of every crossing."
        rows[52]["text"] = QUOTE                                          # 8 s later, its own window
        hl = self.run_step(rows, Claude(answer_for((50, page()))))
        self.assertEqual(len(hl["placed"]), 1)
        self.assertEqual(hl["placed"][0]["line_at_s"], 208.0)
        hl = self.run_step(quote_film(n=165, at=()), Claude(answer_for((10, page()))))
        self.assertEqual(hl["placed"], [])

    def test_off_switch(self):
        with mock.patch.object(M, "HL_PER_10MIN", 0.0):
            eng = Claude(answer_for((10, page())))
            hl = self.run_step(quote_film(), eng)
        self.assertEqual((hl["cap"], eng.calls), (0, []))


# ── after the pictures: sync keeps it on its words; the picture step never searches it ─────────────────────────────
class Sync(Tmp):
    def test_sync_opens_the_page_so_its_main_phrase_is_highlighted_as_it_is_said(self):
        rows = quote_film(n=40)
        self.run_step(rows, Claude(answer_for((10, page()))))
        cues = G.cues_of(plain_film(40)[:10] + [dict(plain_film(40)[10], text=QUOTE)] + plain_film(40)[11:])
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page")
        dev = rows[k]["device"]
        for r in rows:
            r.setdefault("pick", G.pic(f"r{r['startMs']}"))
        M.sync_overlays(Claude(), self.job, rows, cues)
        r = next(r for r in rows if (r.get("device") or {}).get("id") == "highlight-page")
        h = M._hl_said_at(dev, self.heard(rows), 38000, 50000)
        self.assertEqual(r["startMs"], h - M.SYNC_LEAD_MS - M._hl_pre_ms(dev))
        self.assertGreaterEqual(r["endMs"] - r["startMs"], M._hl_need_ms(dev))
        self.assertLessEqual(r["endMs"] - r["startMs"], 8000)
        again = copy.deepcopy(rows)
        M.sync_overlays(Claude(), self.job, again, cues)
        self.assertEqual([(x["startMs"], x["endMs"]) for x in again], [(x["startMs"], x["endMs"]) for x in rows])


class Pictures(unittest.TestCase):
    def test_a_page_shot_is_never_searched_nor_judged_nor_saved(self):
        from test_mrtruth_e1 import Gem, framed_unless_cropped
        from test_mrtruth_a2 import Engine
        searched = []

        def web(queries, folder, n=6, skip=()):
            searched.append(queries[0])
            return []
        with tempfile.TemporaryDirectory() as d:
            rows = [{"text": f"Line number {i} about the old ledger.", "startMs": i * 4000, "endMs": (i + 1) * 4000,
                     "queries": [f"old ledger {i}", "", ""], "entities": [], "device": None} for i in range(4)]
            rows[2]["device"] = page()
            e = Engine(Gem(framed_unless_cropped))
            M._search_reset(e)
            with mock.patch.object(M, "commons_photos", lambda q, f, n=4: searched.append(q) or []), \
                    mock.patch.object(M, "web_photos", web), mock.patch.object(M, "archive_names", lambda *a, **k: None), \
                    mock.patch.object(M, "_ai_picture", lambda *a, **k: None), \
                    mock.patch.object(M, "_stop", lambda engine, msg: engine.log("stopped: " + msg)), \
                    mock.patch.dict(os.environ, {"MRTRUTH_ARCHIVES": "0"}):
                M.pictures(e, Path(d) / "job", rows, {"period": "1930s", "visualBrief": {"tone": "dark"}})
            self.assertFalse([q for q in searched if q.endswith(" 2") or "number 2" in q], searched)
            self.assertTrue([q for q in searched if q.endswith(" 1")])
            self.assertEqual((rows[2]["step"], rows[2]["pick"]), ("covered", None))
            saved = [json.loads(p.read_text())["text"] for p in (Path(d) / "job" / "mrtruth" / "pictures").rglob("pick.json")]
            self.assertNotIn(rows[2]["text"], saved)


# ── the gate: the page rule and its repairs ──────────────────────────────────────────────────────────────────────
WARDEN = 'The warden wrote, "the north door stays shut until the thaw."'
W_PARS = ["Entry for the winter quarter, kept by the warden of the outer wall and read aloud at the change of the watch.",
          "His order for the season was plain: the north door stays shut until the thaw, and no lamp is lit near it.",
          "Any keeper who opens it before spring answers to the council of the river towns, as the old charter says."]


def gate_film(k=26, ms=7000):
    """The gate's clean film with a page on shot k (7 s, the next shot short): the warden's words said on it."""
    rows = G.film()
    end = rows[k]["startMs"] + ms
    rows[k]["text"], rows[k]["endMs"], rows[k + 1]["startMs"] = WARDEN, end, end
    rows[k]["device"] = {"id": "highlight-page", "paragraphs": list(W_PARS), "main": 1,
                         "phrases": ["the outer wall", "the north door stays shut", "council"]}
    rows[k]["pick"] = None
    return rows


class Gate(G.Base):
    def page_rows(self, rows):
        return [k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page"]

    def test_a_good_page_passes_and_is_reported(self):
        rows = gate_film()
        found, ctx = self.find(rows)
        self.assertEqual([x for x in found if x["rule"] in ("page", "groups", "same words", "words", "too short")], [])
        self.assertEqual((ctx["measure"]["pages"], ctx["measure"]["page_cap"]), (1, 1))
        M.HL.update(found=4, candidates=3, rejected=[{"at_s": 1.0, "why": "a typed caption sits there", "by": "code"}],
                    placed=[], dropped=[], claude="asked")
        rec, eng = self.gate(rows)
        self.assertEqual(rec["result"], "PASS", rec["first_look"])
        hl = rec["highlight"]
        self.assertEqual((hl["on_screen"], hl["cap"], hl["found"]), (1, 1, 4))
        self.assertEqual(hl["pages"][0]["main"], "the north door stays shut")
        self.assertTrue(-0.4 <= hl["pages"][0]["offset_s"] <= 0.35, hl["pages"][0])
        line = next(l for l in eng.lines if l.startswith("  highlighted text: "))
        self.assertTrue(line.startswith("  highlighted text: 1 placed (4 moments found; 1 rejected: 1 a typed caption sits there"), line)
        self.assertTrue(any(l.startswith("    page at 111.8s (7.0s, 165 frames)") for l in eng.lines), eng.lines[-4:])
        self.assertIn("page", json.loads((self.job / "mrtruth" / "gate.json").read_text())["checked"])

    def test_a_page_off_its_words_is_re_timed(self):
        rows = gate_film()
        rows[26]["device"]["phrases"][0] = "read aloud at the change"   # 5 words: the main one highlighted 0.86 s late
        found, _ = self.find(rows)
        self.assertEqual([x["fix"] for x in found if x["rule"] == "page"], ["time"])
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertTrue(any(x["fix"].startswith("re-timed") for x in rec["repairs"]), rec["repairs"])
        self.assertEqual(self.page_rows(rows), [26])
        self.assertEqual([x for x in self.find(rows)[0] if x["rule"] == "page"], [])

    def test_a_page_that_cannot_be_drawn_goes_and_its_shot_gets_a_picture(self):
        rows = gate_film()
        rows[26]["device"]["phrases"][2] = "the town council"            # not in its paragraph
        rows[26]["spare"] = [G.pic("s26a")]
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertEqual(self.page_rows(rows), [])
        self.assertTrue(all(r.get("pick") for r in rows))
        self.assertEqual(rec["highlight"]["dropped"][0]["why"].split(":")[0], "highlighted page")

    def test_two_pages_too_close_the_later_goes(self):
        rows = gate_film()
        k = 36
        rows[k]["text"], rows[k]["endMs"], rows[k + 1]["startMs"] = WARDEN, rows[k]["startMs"] + 7000, rows[k]["startMs"] + 7000
        rows[k]["device"], rows[k]["pick"] = copy.deepcopy(rows[26]["device"]), None
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "page" and "after the one before" in x["what"] for x in found))
        self.assertTrue(any(x["rule"] == "groups" for x in found))       # over the film's cap of 1 too
        rec, _ = self.gate(rows)
        self.assertEqual(self.page_rows(rows), [26])
        self.assertNotEqual(rec["result"], "STOPPED")

    def test_a_page_too_long_for_its_shot_is_cut_to_it(self):
        rows = gate_film(ms=5000)                                         # 150 frames for a 165-frame page
        found, _ = self.find(rows)
        self.assertIn("fit", [x["fix"] for x in found if x["rule"] == "page"])     # (its words come sooner: time too)
        rec, _ = self.gate(rows)
        self.assertTrue(any(x["fix"].startswith("phrases cut to fit") for x in rec["repairs"]), rec["repairs"])
        dev = rows[26]["device"]
        self.assertLessEqual(M._hl_frames(dev), 150)
        self.assertTrue(dev["phrases"][1].startswith("the north door"))

    def test_read_back(self):
        rows = gate_film()
        found, _ = self.find(rows)
        self.assertFalse([x for x in found if x["rule"] == "page"])
        rows[26]["device"] = dict(rows[26]["device"], phrases=["the outer wall", "the south door", "the council"])
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "page" and "not in its paragraph" in x["what"] for x in found))

    def test_scenes_draw_it_on_a_neighbours_picture_and_check_its_own_frames(self):
        rows = gate_film()
        M.transitions(rows)
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)):
            sc = M.scenes(rows, Path(st), G.cues_of(rows))
            self.assertEqual(sc[26]["device"]["phrases"], rows[26]["device"]["phrases"])
            self.assertTrue(sc[26]["asset"])                              # the renderer's guard wants one; never seen
            self.assertNotIn("shadow", sc[26]["grade"])
            self.assertEqual(M._gate_scenes(G.Eng(), self.job, rows, sc), [])
            sc[26]["durationFrames"] = 160                                # under its 165 frames
            with self.assertRaises(M.PlanningStopped):
                M._gate_scenes(G.Eng(), self.job, rows, sc)


# ── the review of 2026-10-11 ──────────────────────────────────────────────────────────────────────────────────────
def picks(rows):
    for r in rows:
        r.setdefault("pick", G.pic(f"r{r['startMs']}"))


class Review(Tmp):
    def test_a_malformed_answer_is_refused_never_raised(self):
        for bad in ({"1": "a", "2": "b", "3": "c"}, 7):             # phrases as an object or a number stopped the film
            rows = quote_film()
            ans = answer_for((10, page()))
            ans["pages"][0]["phrases"] = bad
            hl = self.run_step(rows, Claude(ans))
            self.assertEqual(hl["placed"], [])
            self.assertIn("not three paragraphs and three phrases",
                          next(x["why"] for x in hl["rejected"] if x["by"] == "check"))
        rows, eng = quote_film(), Claude()
        before = copy.deepcopy(rows)

        def boom(engine, job, rs, *a):
            rs[3]["device"] = page()                                      # half done, then it raises
            raise KeyError(1)
        with mock.patch.object(M, "highlight_pages", boom):
            M._hl_safe(eng, self.job, rows, "s", G.DOSSIER, G.cues_of(rows))
        self.assertEqual(rows, before)                                     # the film goes on, untouched
        self.assertTrue(any("highlighted pages: none this run (KeyError" in l for l in eng.lines), eng.lines)

    def test_a_caption_never_takes_a_pages_shot_unrecorded(self):
        rows = quote_film(n=40)
        self.run_step(rows, Claude(answer_for((10, page()))))
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page")
        rows[k + 2]["typedCaption"] = {"lines": ["The Ledger", "River Gate"], "startFrame": 8}   # said on the page's line
        picks(rows)
        eng = Claude()
        M.sync_overlays(eng, self.job, rows, G.cues_of(rows))
        self.assertFalse([l for l in eng.lines if "highlight-page there gives way" in l], eng.lines)
        self.assertEqual([x["main"] for x in M.HL["dropped"]], [page()["phrases"][1]])   # it went, and gate.json says why
        self.assertTrue(M.HL["dropped"][0]["why"].startswith("sync: "))

    def test_a_page_is_placed_clear_of_where_sync_pins_its_neighbours(self):
        rows = plain_film(40)                                             # a caption whose words come late in its own
        rows[8]["text"] = "The keeper walked on and on and on until the stone tower"   # line types in on them, after
        rows[8]["typedCaption"] = {"lines": ["The Stone Tower", "And Its Long Shadow"], "startFrame": 8}   # its cut
        rows[9]["text"] = QUOTE
        hl = self.run_step(rows, Claude(answer_for((9, page(main=0)))))
        self.assertEqual(hl["placed"], [])                                # not placed, then crowded out by sync
        self.assertIn("no timing puts", next(x["why"] for x in hl["rejected"] if x["by"] == "check"))
        rows = quote_film(n=40)                                           # a caption after it whose words are said in
        rows[12]["typedCaption"] = {"lines": ["The Ledger", "River Gate"], "startFrame": 8}   # the window: pinned there
        eng = Claude(answer_for((10, page())))
        hl = self.run_step(rows, eng)
        self.assertEqual((eng.calls, hl["placed"]), ([], []))
        self.assertTrue(any(x["why"].startswith("too short") for x in hl["rejected"]))

    def test_the_page_shot_is_cut_where_sync_opens_it_and_runs_on_until_it_is_done(self):
        rows = plain_film(40)                                             # full7 2:20: the quote's line starts after the
        lay = [(40000, 44000, "Years later a previous review had produced a notation that read, in"),   # page opens,
               (44000, 47000, 'translation, "no stranger may pass the river gate tonight."'),       # the line after it
               (47000, 49500, "That phrase did not mean the gate was shut.")]                       # ends before it is done
        for k, (a, b, t) in enumerate(lay, 10):
            rows[k].update(startMs=a, endMs=b, text=t)
        for k in range(13, 40):
            rows[k]["startMs"] = rows[k - 1]["endMs"]
            rows[k]["endMs"] = rows[k]["startMs"] + (3500 if k == 13 else 4000)
        self.run_step(rows, Claude(answer_for((10, page()))))
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page")
        dev = rows[k]["device"]
        opens = M._hl_said_at(dev, self.heard(rows), 40000, 50000) - M.SYNC_LEAD_MS - M._hl_pre_ms(dev)
        self.assertEqual(rows[k]["startMs"], opens)                       # where sync opens it, not 3 s before
        self.assertEqual((rows[k - 1]["startMs"], rows[k - 1]["endMs"]), (40000, rows[k]["startMs"]))
        self.assertIn("previous review", rows[k - 1]["text"])
        self.assertGreaterEqual(rows[k]["endMs"], opens + M._hl_need_ms(rows[k]["device"]))   # ran on over the next line
        self.assertIn("did not mean the gate", rows[k]["text"])
        picks(rows)
        M.sync_overlays(Claude(), self.job, rows, G.cues_of(rows))
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page")
        self.assertEqual(rows[k]["startMs"], opens)
        self.assertGreaterEqual(min(rows[k - 1]["endMs"] - rows[k - 1]["startMs"], rows[k + 1]["endMs"] - rows[k + 1]["startMs"]),
                                2000)                                     # no 1 s shot left beside it
        heard = json.loads((self.job / "words_heard.json").read_text())
        self.assertFalse([w for w, a, b in heard if a * 1000 + 40 < rows[k]["endMs"] < b * 1000 - 40])   # not mid-word

    def test_a_window_past_eight_seconds_leaves_a_tail_from_a_word(self):
        rows = plain_film(40)
        lay = [(40000, 44000, "Years later a previous review had produced a notation that read, in"),
               (44000, 53000, 'translation, "no stranger may pass the river gate tonight," and the keeper went home '
                              'to his bed and slept until the morning.')]
        for k, (a, b, t) in enumerate(lay, 10):
            rows[k].update(startMs=a, endMs=b, text=t)
        for k in range(12, 40):
            rows[k]["startMs"] = rows[k - 1]["endMs"]
            rows[k]["endMs"] = rows[k]["startMs"] + 4000
        self.run_step(rows, Claude(answer_for((10, page()))))
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page")
        dev = rows[k]["device"]
        opens = M._hl_said_at(dev, self.heard(rows), 40000, 53000) - M.SYNC_LEAD_MS - M._hl_pre_ms(dev)
        heard = [round(a * 1000) for w, a, b in json.loads((self.job / "words_heard.json").read_text())]
        tail = rows[k + 1]
        self.assertEqual(tail["startMs"], rows[k]["endMs"])
        self.assertIn(tail["startMs"], heard)                             # on a word, within SCENE_MAX_S of the opening
        self.assertLessEqual(tail["startMs"], opens + M.SCENE_MAX_S * 1000 + M.SYNC_TOLERANCE_MS)
        self.assertEqual((tail["endMs"], tail["device"]), (53000, None))
        self.assertTrue(tail["text"].endswith("until the morning."), tail["text"])   # the words said under it
        picks(rows)
        M.sync_overlays(Claude(), self.job, rows, G.cues_of(rows))
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "highlight-page")
        self.assertLessEqual(rows[k]["endMs"] - rows[k]["startMs"], 8000)
        self.assertEqual(rows[k + 1]["endMs"], 53000)

    def test_a_page_opens_on_a_hard_cut(self):
        rows = gate_film()
        with mock.patch.object(M, "_content_draw", lambda text: 0.0):  # every draw a film burn or a flash
            M.transitions(rows)
        self.assertEqual(rows[26]["tin"], {"type": "cut", "durationFrames": 0})
        self.assertIn(rows[20]["tin"]["type"], ("filmBurn", "flash"))

    def test_spares_in_claudes_order_and_the_first_page_early(self):
        rows = own_quotes(n=165, at=(10, 100, 125, 150))              # 11 minutes: 3, the 4th a spare
        hl = self.run_step(rows, Claude(answer_for(*[(k, own_page(k)) for k in (100, 125, 150, 10)])))
        self.assertEqual([p["line_at_s"] for p in hl["placed"]], [40.0, 400.0, 500.0])   # 40 s: inside 3 minutes, first
        self.assertIn("a spare", next(x["why"] for x in hl["rejected"] if x["at_s"] == 600.0))
        rows = own_quotes(n=165, at=(10, 100, 125, 150))
        broken = dict(own_page(125), phrases=["the outer wall", "no such words", "the council"])
        hl = self.run_step(rows, Claude(answer_for(*[(k, own_page(k) if k != 125 else broken) for k in (100, 125, 150, 10)])),
                           script="another")
        self.assertEqual([p["line_at_s"] for p in hl["placed"]], [40.0, 400.0, 600.0])   # the spare takes its place

    def test_the_same_highlighted_words_twice_are_refused(self):
        self.assertTrue(M._hl_same("not suitable for general doctrinal reference",
                                   "material not suitable for general doctrinal reference"))
        self.assertTrue(M._hl_same("its general doctrinal reference", "the general doctrinal reference of it"))
        self.assertFalse(M._hl_same("the last person physically present", "a difficult institutional position"))
        rows = quote_film(n=165, at=(10, 60))
        hl = self.run_step(rows, Claude(answer_for((10, page()), (60, page()))))
        self.assertEqual(len(hl["placed"]), 1)
        self.assertTrue(next(x["why"] for x in hl["rejected"] if x["at_s"] == 240.0).startswith(
            "the same highlighted words as another page"))

    def test_the_report_says_how_many_were_asked(self):
        rows = own_quotes(n=40, at=(10, 30))
        with mock.patch.object(M, "HL_ASK_MAX", 1):
            self.run_step(rows, Claude(answer_for((10, own_page(10)))))
        rep = M._hl_report(rows, self.heard(rows))
        self.assertEqual((rep["candidates"], rep["asked"]), (2, 1))

    def test_the_prompt_asks_for_spares_one_source_a_page_and_an_early_first(self):
        eng = Claude(answer_for((10, page())))
        self.run_step(quote_film(n=165), eng)
        ask = eng.calls[0]
        self.assertIn("at most 3 pages. Write 5 pages, BEST FIRST: 3 and 2 spares", ask)
        self.assertIn("first 180 seconds of the film", ask)
        self.assertIn("Each page a DIFFERENT source", ask)
        self.assertIn("keeps one tense", ask)
        self.assertIn("keep the quotation marks", ask)


class Wiring(unittest.TestCase):
    def test_the_step_runs_after_the_captions_before_the_pictures(self):
        src = (HERE / "mrtruth.py").read_text(encoding="utf-8")
        plan = src[src.index("def plan_film("):src.index("def _saved_plan(")]
        self.assertLess(plan.index("typed_captions(engine"), plan.index("_hl_safe(engine"))   # highlight_pages, guarded
        self.assertLess(plan.index("_hl_safe(engine"), plan.index("_pictures_and_cut(engine"))
        self.assertIn("page", M.GATE_RULES)
        self.assertEqual(M._SYNC_RANK["highlight-page"], 6)


if __name__ == "__main__":
    unittest.main()
