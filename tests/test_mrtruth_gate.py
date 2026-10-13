"""Mr Truth D1 (2026-10-10): the pre-render gate - every rule checked in code before anything is drawn, each break
repaired and checked again, only what no repair can fix stops the run; the card check on the judge's own Gemini through
the verdict store; the gate's look at the scenes; the read-back (`python mrtruth.py check <job>`); no check after render.
Synthetic data only (made-up words): no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_gate -v
"""
import copy
import hashlib
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
import mrtruth_spots as S  # noqa: E402

SYL = ["ka", "lo", "mi", "nu", "pe", "ri", "so", "tu", "va", "ze", "bo", "di"]


def word(k, j):
    """A made-up word, the same for the same (k, j) and different from every other."""
    n = k * 7 + j + 50
    return SYL[n % 12] + SYL[(n // 12) % 12] + SYL[(n // 144) % 12] + "n"


def line(k):
    """A whole sentence of made-up words for shot k: 'The A B saw the C.'"""
    return f"The {word(k, 0)} {word(k, 1)} saw the {word(k, 2)}."


def ident(path):
    name = Path(str(path)).stem.split("~")[0]
    return (hashlib.sha1(name.encode()).hexdigest(), None, None)


def pic(name, **kw):
    return dict(dict(photo=f"/p/{name}.jpg", tier=M.KIND, clean=True, bad=[], title=name, provider="bing"), **kw)


LIM = {"shadow-up": 32, "top-title": 21, "P02": 46, "P05": 25, "P04": 19, "corner-label": 18, "framed-card": 32}
FIELD = {"shadow-up": "line", "top-title": "line1", "P02": "headline", "P05": "headline", "P04": "mainLine",
         "corner-label": "label", "framed-card": "caption"}


def make_build(rows):
    """The planner's build() for the templates the gate re-sets or adds (its words said on the shot or the two around)."""
    def build(tid, o, i):
        if tid == "P08":
            return {"id": "P08"}
        head = str((o or {}).get("headline") or "").strip()
        win = " ".join(rows[j]["text"] for j in range(max(0, i - 2), min(len(rows), i + 3)))
        if tid not in FIELD or not head or len(head) > LIM[tid] or not M._spoken_in(head, win):
            return None
        dev = {"id": tid, FIELD[tid]: head}
        dev.update({"top-title": {"line2": ""}, "P04": {"supportLine": ""}, "P02": {"label": ""}, "corner-label": {"kicker": ""},
                    "P05": {"eyebrow": "", "supportLine": "", "imageLabel": ""}}.get(tid, {}))
        return dev
    return build


TITLE = f"The {word(901, 0).title()} {word(901, 1).title()}"
DOSSIER = {"topic": "a made-up story", "period": "", "setting": f"The {word(900, 0).title()} {word(900, 1).title()}, far away",
           "sections": [{"title": f"The {word(901, 0).title()} {word(901, 1).title()}"},
                        {"title": f"{word(902, 0).title()} {word(902, 1).title()}"},
                        {"title": f"{word(903, 0).title()} {word(903, 1).title()}"}]}


def first(k, n=2):
    return " ".join(line(k).rstrip(".").split()[1:1 + n]).title()


def film(n=48, ms=4300, texts=True):
    """A film that passes every rule: n shots of `ms`, a picture each, the opening title, words on screen at least every
    ~22 s (spoken line, running title, a name label, a P05, two chapters, typed captions, the source document) - at
    shots 5, 10, ... of 48, the same places in proportion for another n."""
    at = lambda k: round(k * n / 48)
    rows = []
    for k in range(n):
        rows.append({"startMs": k * ms, "endMs": (k + 1) * ms, "text": line(k), "device": None, "pick": pic(f"r{k}"),
                     "spare": [pic(f"s{k}a"), pic(f"s{k}b")], "entities": [f"{word(k, 1)} {word(k, 2)}"], "about": "",
                     "visualIntent": line(k)})
    if not texts:
        return rows
    rows[0]["device"] = M._auto_title(DOSSIER, "")
    a = {k: at(k) for k in (5, 10, 14, 19, 24, 29, 33, 38, 42, 44)}
    rows[a[5]]["device"] = {"id": "shadow-up", "line": first(a[5], 2)}
    rows[a[10]]["device"] = {"id": "top-title", "line1": first(a[10], 2), "line2": ""}
    rows[a[14]]["device"], rows[a[14]]["section_turn"] = {"id": "chapter-plate", "heading": DOSSIER["sections"][1]["title"]}, True
    rows[a[19]]["device"] = {"id": "P04", "mainLine": first(a[19], 2), "supportLine": ""}
    rows[a[19]]["pick"] = pic(f"r{a[19]}", tier=M.EXACT)
    rows[a[24]]["device"] = {"id": "P05", "headline": first(a[24], 2), "eyebrow": "", "supportLine": "", "imageLabel": ""}
    rows[a[29]]["typedCaption"] = {"lines": [first(a[29], 2)], "startFrame": M.TYPED_CAPTION_START_F}
    rows[a[33]]["device"], rows[a[33]]["section_turn"] = {"id": "chapter-plate", "heading": DOSSIER["sections"][2]["title"]}, True
    rows[a[38]]["device"] = {"id": "shadow-up", "line": first(a[38], 2)}
    rows[a[42]]["device"] = {"id": "P08"}
    rows[a[44]]["typedCaption"] = {"lines": [first(a[44], 2)], "startFrame": M.TYPED_CAPTION_START_F}
    return rows


def write_job(job, rows, title=None):
    """words_heard.json and subs.srt for the rows' own words (each shot's words spread over its time)."""
    heard, srt = [], []
    for n, r in enumerate(rows, 1):
        ws = r["text"].split()                        # "The" on the cut, the first word that counts SYNC_LEAD_MS after it
        step = (r["endMs"] - r["startMs"] - 450) / max(1, len(ws) - 1)
        for j, w in enumerate(ws):
            a = (r["startMs"] + (M.SYNC_LEAD_MS + (j - 1) * step if j else 0)) / 1000
            heard.append([w, round(a, 3), round(a + step / 1000, 3)])
        f = lambda ms: f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
        srt.append(f"{n}\n{f(r['startMs'])} --> {f(r['endMs'])}\n{r['text']}\n")
    (job / "words_heard.json").write_text(json.dumps(heard))
    (job / "subs.srt").write_text("\n".join(srt))
    (job / "script.txt").write_text(" ".join(r["text"] for r in rows))
    (job / "title.txt").write_text((TITLE if title is None else title) + "\n")


def cues_of(rows, halves=False):
    """One subtitle line per shot; halves: two (the line said in two halves), so a long shot can be cut between them."""
    if not halves:
        return [(r["startMs"], r["endMs"], r["text"]) for r in rows]
    out = []
    for r in rows:
        ws, mid = r["text"].split(), (r["startMs"] + r["endMs"]) // 2
        out += [(r["startMs"], mid, " ".join(ws[:3])), (mid, r["endMs"], " ".join(ws[3:]))]
    return out


class Eng:
    SCRIPT_MODEL = "offline"

    def __init__(self, no=(), broken=False):
        self.lines, self.calls, self.no, self.broken = [], [], {x.lower() for x in no}, broken
        self.AI_IMAGE_CAP, self._AI_IMAGES, self._AI_LOCK = 30, {"used": 0}, threading.Lock()

    def log(self, s):
        self.lines.append(s)

    def ai_image_slot(self, label):
        self._AI_IMAGES["used"] += 1

    def pick_vision(self, prompt, paths, max_tokens=0, model="", thinking="", purpose="", media="", lead="", labels=None,
                    info=None, **kw):
        self.calls.append({"purpose": purpose, "model": model, "media": media, "paths": list(paths), "labels": list(labels or []),
                           "lead": lead})
        if info is not None:
            info["via"] = "gemini"
        if self.broken:
            raise RuntimeError("HTTP 503")
        out = []
        for n, lab in enumerate(labels or [], 1):
            name = re.search(r'"([^"]+)"', lab).group(1).lower()
            photo = Path(paths[n - 1]).stem
            say_no = name in self.no or f"{name}@{photo}" in self.no
            out.append({"n": n, "shows": not say_no, **({"why": "the wrong thing"} if say_no else {})})
        return json.dumps(out)


class Base(unittest.TestCase):
    store = "off"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.job = Path(self.tmp.name) / "job"
        (self.job / "mrtruth").mkdir(parents=True)
        env = {"MRTRUTH_ALLOW_DEGRADED": "0", "MRTRUTH_VERDICTS": self.store,
               "MRTRUTH_VERDICTS_DB": str(Path(self.tmp.name) / "v.sqlite")}
        self.patches = [mock.patch.object(M, "_ident", ident), mock.patch.object(M, "_luma", lambda p: 0.3),
                        mock.patch.object(M, "_type_shade", lambda *a: 0.0), mock.patch.object(M, "_small", lambda p, px=640: p),
                        mock.patch.object(M, "_ai_picture", lambda *a, **k: None), mock.patch.dict(os.environ, env)]
        for p in self.patches:
            p.start()
        M.BUDGET.clear()
        M.DEV_DROPS.clear()
        M.VERDICTS["store"] = None

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        M.BUDGET.clear()
        if M.VERDICTS["store"] is not None:
            M.VERDICTS["store"].close()
        M.VERDICTS["store"] = None
        self.tmp.cleanup()

    def gate(self, rows, eng=None, words_from=None, dossier=None, title=None, halves=False):
        write_job(self.job, words_from or rows, title)
        eng = eng or Eng()
        M._budget_set(eng, rows)
        rec = M.gate(eng, self.job, rows, dossier or DOSSIER, cues_of(words_from or rows, halves), make_build(rows), "")
        return rec, eng

    def find(self, rows, words_from=None):
        write_job(self.job, words_from or rows)
        ctx = M._gate_ctx(self.job, rows, DOSSIER, cues_of(words_from or rows), "", mode="report")
        return M._gate_find(rows, ctx), ctx

    def rules(self, found):
        return sorted({x["rule"] for x in found})


# ── the clean film, idempotence, the stop ──────────────────────────────────────────────────────────────────────────
class Clean(Base):
    store = "on"

    def test_a_clean_film_passes_untouched_and_a_second_gate_asks_nothing(self):
        rows = film()
        before = copy.deepcopy(rows)
        rec, eng = self.gate(rows)
        self.assertEqual(rec["result"], "PASS", rec["first_look"])
        self.assertEqual(rows, before)
        self.assertEqual(len(eng.calls), 1)                          # the one label (P04), one call
        c = eng.calls[0]
        self.assertEqual((c["purpose"], c["model"], c["media"]), ("card check", M.JUDGE_MODEL, "HIGH"))
        self.assertIn(first(19, 2), c["labels"][0])
        self.assertEqual(len(c["paths"]), 2)                         # its picture and its best runner-up
        g = json.loads((self.job / "mrtruth" / "gate.json").read_text())
        self.assertEqual(g["result"], "PASS")
        self.assertEqual(set(g["checked"]), set(M.GATE_RULES))
        rec2, eng2 = self.gate(rows, Eng())
        self.assertEqual((rec2["result"], len(eng2.calls), rows == before), ("PASS", 0, True))

    def test_irreparable_stops_with_a_plain_reason_and_degraded_carries_on(self):
        rows = film()
        rows[0]["device"] = None                                      # no opening title, and none fits
        d, long_title = dict(DOSSIER, sections=[]), "A Title Far Too Long For The Opening Card Of This Film"
        with self.assertRaises(M.PlanningStopped) as x:
            self.gate(rows, dossier=d, title=long_title)
        self.assertIn("opening", str(x.exception))
        self.assertIn("MRTRUTH_ALLOW_DEGRADED=1", str(x.exception))
        self.assertEqual(json.loads((self.job / "mrtruth" / "gate.json").read_text())["result"], "STOPPED")
        rows = film()
        rows[0]["device"] = None
        with mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "1"}):
            rec, eng = self.gate(rows, dossier=d, title=long_title)
        self.assertEqual(rec["result"], "STOPPED")
        self.assertTrue(any("stopped before drawing" in l for l in eng.lines), eng.lines[-3:])


    def test_an_opening_without_its_title_gets_one(self):
        rows = film()
        rows[0]["device"] = {"id": "photo-pop"}
        found, _ = self.find(rows)
        self.assertEqual([x["rule"] for x in found], ["opening"])
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertEqual(rows[0]["device"], M._auto_title(DOSSIER, TITLE))

    def test_card_check_off_leaves_the_labels_and_asks_nothing(self):
        rows = film()
        with mock.patch.object(M, "CARD_CHECK", False):
            rec, eng = self.gate(rows, Eng(no=[first(19, 2)]))
        self.assertEqual((rec["result"], len(eng.calls)), ("PASS", 0))
        self.assertEqual(rows[19]["device"]["id"], "P04")
        self.assertEqual(list(rec["looks_missing"][0][:2]), [19, "P04"])


# ── the rules, one at a time: found, then repaired ─────────────────────────────────────────────────────────────────
class Text(Base):
    def test_a_title_cut_short_is_found_and_rebuilt_at_whole_words(self):
        rows = film()
        rows[0]["device"] = dict(rows[0]["device"], kicker=f"The {word(900, 0).title()} {word(900, 1).title()[:2]}")
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "text" and "cut short" in x["what"] and x["k"] == 0 for x in found), found)
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertEqual(rows[0]["device"]["kicker"], M._whole_words(DOSSIER["setting"].split(",")[0], 24))

    def test_a_chapter_heading_cut_short_takes_whole_words(self):
        rows = film()
        rows[14]["device"]["heading"] = DOSSIER["sections"][1]["title"][:-3]
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        h = rows[[k for k, r in enumerate(rows) if (r.get("device") or {}).get("id") == "chapter-plate"][0]]["device"]["heading"]
        self.assertFalse(M._cut_off(h, set(re.findall(r"[a-z]+", json.dumps(DOSSIER).lower()))))

    def test_a_filler_that_stops_mid_phrase_is_reworded_from_its_own_line(self):
        rows = film()
        rows[5]["text"] = f"The {word(5, 0)} ledger was therefore not about {word(5, 1)}."
        rows[5]["device"] = {"id": "shadow-up", "line": f"{word(5, 0).title()} ledger was therefore"}
        rows[5]["filler"] = True
        found, _ = self.find(rows)
        self.assertTrue(any("does not read whole" in x["what"] for x in found))
        rec, _ = self.gate(rows)
        dev = next(r["device"] for r in rows if r["text"] == rows[5]["text"] or "ledger" in r["text"])
        self.assertTrue(dev is None or M._phrase_ok(dev.get("line", ""), next(r["text"] for r in rows if "ledger" in r["text"])))
        self.assertEqual(rec["result"], "REPAIRED")

    def test_empty_placeholder_and_too_long_fields(self):
        rows = film()
        rows[10]["device"]["line1"] = ""
        rows[24]["device"]["eyebrow"] = "TBD"
        rows[19]["device"]["supportLine"] = "x " * 30
        found, _ = self.find(rows)
        whats = " | ".join(x["what"] for x in found if x["rule"] == "text")
        self.assertIn("top-title line1 is empty", whats)
        self.assertIn("placeholder", whats)
        self.assertIn("longer than its 35 letters", whats)
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertEqual(rows[24]["device"]["eyebrow"], "")
        self.assertLessEqual(len(rows[19]["device"]["supportLine"]), 35)

    def test_a_switched_off_template_falls_back(self):
        rows = film()
        rows[7]["device"] = {"id": "P13"}
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertNotEqual((rows[7].get("device") or {}).get("id"), "P13")


class Phrases(unittest.TestCase):
    """A2 (made-up sentences shaped like the pod film's broken cards)."""

    def test_ends_at_a_clause_or_on_a_noun_starts_where_a_phrase_can(self):
        ok = M._phrase_ok
        self.assertFalse(ok("Ledger mark was therefore", "The ledger mark was therefore not about color."))
        self.assertFalse(ok("Fully legal nor openly", "Cargo that was neither fully legal nor openly"))
        self.assertFalse(ok("Hour of sunrise and walked", "promptly at the hour of sunrise and walked"))
        self.assertFalse(ok("Mark really means", "That helps with knowing what the ledger mark really means."))
        self.assertFalse(ok("Called this not a fable", "The sailor called this not a fable but"))
        self.assertFalse(ok("Maps the navy trusted", "Those were not maps the navy trusted as accurate."))
        self.assertTrue(ok("Ledger mark", "The ledger mark was therefore not about color."))
        self.assertTrue(ok("The first pages", "She read the first pages without fear.", "Then"))
        self.assertTrue(ok("Nobody wrote back", "Nobody wrote back."))
        self.assertTrue(ok("Words of a writer", "Something else entirely."))    # not the line's own words: not judged

    def test_the_producer_takes_a_whole_clause_first(self):
        self.assertEqual(M._spoken_phrase("Nobody wrote back. The ledger was lost in the fire.", 32), "Nobody wrote back")
        self.assertEqual(M._spoken_phrase("cargo that was neither fully legal nor openly", 32, "It held"), "")
        p = M._spoken_phrase("promptly at the hour of sunrise and walked", 32, "They said the herd left")
        self.assertTrue(M._phrase_ok(p, "promptly at the hour of sunrise and walked", "They said the herd left"), p)

    # 2026-10-13: the picker kept dropping a negation, one side of "X or Y", the condition of an "if", and ended on a
    # verb, an adjective or a comparison whose rest followed (made-up words, real function words)
    def test_a_negator_opens_a_phrase_and_none_starts_right_after_one(self):
        w0, w1 = word(60, 0), word(60, 1)
        line_ = f"The {w0} was not {w1} at heart."
        self.assertEqual(M._spoken_phrase(line_, 21), f"Not {w1} at heart")          # was '{W1} at heart'
        self.assertTrue(M._phrase_ok(f"Not {w1} at heart", line_))
        self.assertFalse(M._phrase_ok(f"{w1.title()} at heart", line_))
        line2 = f"The {w0} was plainly not for {w1} or {word(60, 2)}."
        self.assertTrue(M._phrase_ok(f"Not for {w1} or {word(60, 2)}", line2))
        self.assertFalse(M._phrase_ok(f"{w1.title()} or {word(60, 2)}", line2))

    def test_never_one_side_of_an_alternative_nor_the_tail_of_a_condition(self):
        w1, w2 = word(61, 0), word(61, 1)
        line_ = f"Its {w2} was a ninth or tenth century {w1}."
        self.assertEqual(M._spoken_phrase(line_, 32), f"Ninth or tenth century {w1}")
        self.assertFalse(M._spoken_phrase(line_, 21).lower().startswith("tenth"))
        self.assertEqual(M._spoken_phrase(f"If we slept, the {w1} closed.", 32), f"If we slept, the {w1} closed")  # whole
        self.assertNotIn(M._spoken_phrase(f"If we slept, the {w1} closed.", 21), ("We slept", "If we slept"))
        self.assertEqual(M._spoken_phrase(f"But one {w1}, she wrote. She read the {w2} twice.", 32), f"She read the {w2} twice")

    def test_never_ends_on_a_verb_an_adjective_or_a_comparison_whose_rest_follows(self):
        w1, w2 = word(62, 0), word(62, 1)
        cases = [(f"A {w1} built to hold it back from {w2}.", "hold"),
                 (f"It was colder than {w1} and wetter than {w2}.", "wetter"),
                 (f"You could open the {w1} at night.", "open"),     # ('You could lean [on ...]' is whole: review
                                                                     # 2026-10-13, a verb may stop before its adjunct)
                 (f"He came from late antique {w2.title()} with it.", "antique")]
        for line_, bad in cases:
            p = M._spoken_phrase(line_, 32)
            self.assertFalse(p.lower().endswith(bad), (line_, p))
            self.assertTrue(not p or M._phrase_ok(p, line_), (line_, p))

    def test_a_phrase_that_starts_inside_a_noun_phrase_stays_one(self):
        w0, w1, w2 = word(63, 0), word(63, 1), word(63, 2)
        self.assertFalse(M._phrase_ok(f"{w1.title()} and keep its {w2}", f"Several {w0} belong to this {w1} and keep its {w2}."))
        self.assertFalse(M._phrase_ok(f"{w1.title()} twice in a speech", f"She named the {w1} twice in a speech."))
        self.assertFalse(M._phrase_ok(f"{w1.title()} formal", f"The {w0} wore the {w1} formal nearly every day."))
        self.assertTrue(M._phrase_ok(f"{w1.title()} of the {w2}", f"He read the {w1} of the {w2}."))

    def test_the_gate_reads_good_lines_the_way_the_picker_does(self):
        w0, w1, w2, C = word(64, 0), word(64, 1), word(64, 2), word(64, 3).title()
        self.assertTrue(M._phrase_ok(f"Neither {w1} nor fully {w2}", f"Freight that was neither {w1} nor fully {w2} stood in a barn."))
        self.assertTrue(M._phrase_ok(f"A {C} {w1}", f"He read a {C} {w1} that predated the {w2}."))   # before its 'that'
        self.assertTrue(M._phrase_ok(w2.title(), f"The {w0} wore the name {w2} nearly every day."))   # one word

    def test_a_plural_possessive_keeps_its_mark(self):
        w0, w1, C = word(65, 0), word(65, 1), word(65, 2).title() + "s"
        line = f"They rode in with the {C}' whole {w1} intact and left."
        self.assertEqual(M._spoken_phrase(line, 30, "", ""), f"{C}' whole {w1} intact")
        self.assertEqual([w for w, _, _ in M._toks(f"he said '{w0}s' and the {C}' {w1}")],
                         ["he", "said", f"{w0}s", "and", "the", f"{C}'", w1])   # a closing quote is no possessive

    # review 2026-10-13: a negation reaches through an auxiliary, an aside and a verb of saying, never through a verb
    # that holds what follows true, and nothing turns round where nothing is negated; a number is read by value; an
    # alternative counts only where the words touch it; a hedge stays on its number; an infinitive is no order
    def test_a_negation_reaches_through_auxiliaries_asides_and_verbs_of_saying(self):
        w0, w1 = word(66, 0), word(66, 1)
        rules = lambda text, line_: [r for r, _, _ in M._wording(text, line_)]
        for text, line_ in (("Felt at all", f"It was a {w0} that cannot be felt at all."),
                            (f"Keep the {w0}", f"He did not, in the end, keep the {w0}."),
                            (f"Saw the {w1} again", f"No one, not even the {w0} keeper, saw the {w1} again."),
                            (f"Rare or {w0}", f"He did not claim it was rare or {w0}."),
                            (f"The {w0} was true", f"Nobody thought the {w0} was true."),
                            (f"Approve or {w1}", f"The {w0} was not ready to approve or {w1}."),
                            (f"{w1.title()} study or travel", f"It set the {w0} outside the circle of tools "
                                                              f"for {w1} study or travel."),
                            (f"The {w0} was {w1} at heart", f"The {w0} was not {w1} at heart."),   # not said word
                            (f"{w0.title()} {w1} at heart", f"The {w0} was not {w1} at heart.")):  # for word
            self.assertIn("negation", rules(text, line_), (text, line_))
        for text, line_ in ((f"The {w0} was real", f"He did not know the {w0} was real."),     # it holds it true
                            ("Faded by then", f"The label 'not {w0} for {w1}' had faded by then."),
                            (f"The keepers sold the {w0}", f"Not long after, the keepers sold the {w0}."),
                            (f"He kept the {w0}", f"Without a word, he kept the {w0}."),
                            (f"The {w1} vault", f"It was carved rather than cast, bearing scars, resting in the "
                                                f"{w1} vault."),
                            ("Seen", f"It was not the {w0} that was seen."),
                            (f"The old {w0} hall", f"They found it outside the old {w0} hall."),
                            (f"A {w0}", f"It was not a priest but a {w0}."),
                            (f"The {w0} was real", f"There was no doubt the {w0} was real."),
                            (f"A {w0}", f"He was nothing but a {w0}."),
                            (f"Old and {w0}", f"The {w1} was rather old and {w0}.")):
            self.assertNotIn("negation", rules(text, line_), (text, line_))
        self.assertNotEqual(M._spoken_phrase(f"He did not, in the end, keep the {w0}.", 32), f"Keep the {w0}")
        self.assertNotEqual(M._spoken_phrase(f"He did not claim it was rare or {w0}.", 21), f"Rare or {w0}")
        self.assertEqual(M._spoken_phrase(f"It was a {w1} that cannot be felt at all.", 21), "Cannot be felt at all")

    def test_a_negated_phrase_keeps_its_had_and_what_it_is_said_of(self):
        w0, w1 = word(67, 0), word(67, 1)
        self.assertFalse(M._phrase_ok(f"Not claimed the {w0} was broken", f"The {w1} had not claimed the {w0} was broken."))
        self.assertFalse(M._phrase_ok(f"Not {w0}", f"The {w1} is not {w0} in the strict sense."))
        self.assertFalse(M._phrase_ok(f"Not as {w0}", f"Not as {w0} carried over the hills."))
        self.assertFalse(M._phrase_ok(f"He never said the {w0}", f"He never said the {w0} was real."))
        self.assertTrue(M._phrase_ok(f"Not {w0} in the strict sense", f"The {w1} is not {w0} in the strict sense."))
        self.assertTrue(M._phrase_ok(f"Not a {w0} but a {w1}", f"It was not a {w0} but a {w1} that came."))

    def test_numbers_are_read_by_value_digits_and_words_both_ways(self):
        w0, C = word(68, 0), word(68, 1).title()
        detail = lambda text, line_: [w for r, w, _ in M._wording(text, line_) if r == "detail"]
        for text, line_ in ((f"Over 10,000 {w0}s", f"They copied over ten thousand {w0}s by hand."),
                            ("Nearly 2,000 years old", "It is nearly two thousand years old."),
                            (f"1,500 years of {w0}", f"It kept fifteen hundred years of {w0}."),
                            (f"2.5 million {w0}s", f"It held two and a half million {w0}s."),
                            (f"The 80s {w0}", f"The {w0} came back in the eighties."),
                            ("Kept for 250 years", "It was kept for two hundred and fifty years."),
                            ("Kept for 120 years", "It was kept for a hundred and twenty years."),
                            ("Kept for 120 years", "It was kept for one hundred twenty years."),
                            (f"Thirty-One {w0.title()}s", f"He kept 31 {w0}s."),
                            (f"Two Hundred {w0.title()}s", f"He kept 200 {w0}s."),
                            (f"1 {C} 15", f"It is in {C}, chapter fifteen.")):          # a number in a name
            self.assertEqual(detail(text, line_), [], (text, line_))
        for text, line_ in ((f"12 {w0.title()}s Remained", f"Eleven {w0}s remained."),     # Title Case names nothing
                            ("Over 30 Years", "It lasted twenty years."),
                            (f"Thirty {w0.title()}s", f"He kept 31 {w0}s.")):
            self.assertTrue(detail(text, line_), (text, line_))
        self.assertEqual(M._wording(f"12 {w0.title()}s Remained", f"Eleven {w0}s remained.")[0][2],
                         f"Eleven {w0}s remained")                       # the number said there, for the repair
        self.assertEqual(M._num_runs(M._toks("in the 4th-5th century, two and a half thousand")),
                         [(4, 2, 3), (5, 2, 3), (2500, 4, 9)])

    def test_an_alternative_counts_only_where_the_words_touch_it(self):
        w0, w1, w2 = word(69, 0), word(69, 1), word(69, 2)
        rules = lambda text, line_: [r for r, _, _ in M._wording(text, line_)]
        before = f"The {w0} kept one or two {w1}s."
        self.assertEqual(M._wording(f"One {w2} stayed behind", f"{before} One {w2} stayed behind."), [])
        self.assertEqual(M._wording(f"In 1450 the first {w2} arrived",
                                    f"The hall stood from 1450 to 1520. In 1450 the first {w2} arrived."), [])
        self.assertEqual(M._wording(f"Two {w2.title()}s By Sea", f"{before} Later two {w2}s came by sea."), [])
        self.assertIn("detail", rules(f"Two {w1}s", before))
        self.assertIn("detail", rules(f"{w0.title()} Kept Two {w1.title()}s", before))    # a summary of that sentence
        self.assertEqual(M._spoken_phrase(f"One {w2} stayed behind.", 32, before), f"One {w2} stayed behind")

    def test_an_or_of_two_kinds_is_still_an_alternative(self):
        w0, w1, w2 = word(78, 0), word(78, 1), word(78, 2)
        self.assertFalse(M._phrase_ok(f"Leave the {w0} hall", f"He could stay or leave the {w0} hall."))
        self.assertFalse(M._phrase_ok("He could stay or leave", f"He could stay or leave the {w0} hall."))
        self.assertFalse(M._phrase_ok("It had not claimed it was ruinous", f"It had not claimed it was ruinous or {w0}."))
        self.assertFalse(M._phrase_ok(f"Lessons through {w1}", f"They gave lessons through {w1} or pastoral {w2}."))
        self.assertTrue(M._phrase_ok("They could stay", f"They could stay or {w0}s would leave."))    # a clause
        self.assertTrue(M._phrase_ok(f"Neither {w1} nor fully {w2}",
                                     f"Freight that was neither {w1} nor fully {w2} stood."))

    def test_a_hedge_stays_on_its_number_and_an_infinitive_is_no_order(self):
        w0, w1 = word(79, 0), word(79, 1)
        line_ = f"Its towers outlasted the {w0} by at least four winters."
        self.assertFalse(M._phrase_ok("Four winters", line_))
        self.assertIn("At least four winters", M._spoken_phrases(line_, 32))       # a hedge may open a phrase
        self.assertNotIn("Four winters", M._spoken_phrases(line_, 32))
        self.assertTrue(M._phrase_ok("Eighteen months", f"He read seven {w1}s over eighteen months."))   # a span
        line_ = f"It was a lock built to keep it back from anyone who tried to open the {w0}."
        self.assertFalse(M._phrase_ok("Keep it back from anyone", line_))
        self.assertFalse(M._phrase_ok("Keep it back", line_))
        self.assertTrue(M._phrase_ok(f"Keep the {w0} away", f"Keep the {w0} away."))          # an order said as one
        self.assertTrue(M._phrase_ok(f"Work in the {w0} hall", f"He went back to work in the {w0} hall."))

    # review 2026-10-13 (round phrases-names): verbs no list holds, starts after a modifier, a subject cut before its
    # verb, short clauses between commas, four rules that refused good texts, quotations, numbers as nouns,
    # subordinators inside a text, asides, elisions
    def cut(self, text, line_):
        return "cut off" in [r for r, _, _ in M._wording(text, line_)]

    def test_a_verb_no_list_holds_still_stops_before_its_object(self):
        w0, w1, T = word(86, 0), word(86, 1), word(86, 2).title()
        for text, line_ in ((f"You cannot {w0}", f"You cannot {w0} the {w1} that sits in the hall."),
                            (f"{T} {w0}s", f"{T} {w0}s it as the {w1}."),
                            (f"It {w0}s", f"It {w0}s between two {w1}s."),
                            (f"{w1.title()}s do not {w0}", f"The {w1}s do not {w0} the road."),
                            (f"But they never {w0}", f"But they never {w0} the old road home."),
                            ("It distinguishes", f"It distinguishes between two {w1}s.")):
            self.assertTrue(self.cut(text, line_), (text, line_))
        for text, line_ in ((f"{T} {w0}s the {w1}", f"{T} {w0}s the {w1}."),
                            ("You could lean", f"You could lean on what the {w1} told you."),   # its adjunct follows
                            (f"He lived in {T}", f"He lived in {T}.")):
            self.assertEqual(M._wording(text, line_), [], (text, line_))

    def test_no_start_inside_a_noun_phrase_right_after_its_modifier(self):
        w0, w1 = word(87, 0), word(87, 1)
        for text, line_ in ((f"{w0.title()} did not fade", f"The glow of the sleeping {w0} did not fade with it."),
                            (f"{w0.title()} was not moved", f"The brass of the carved {w0} was not moved."),
                            ("Twelve are neat", f"Her marks on {w1} twelve are neat."),
                            (f"{w0.title()} carries", f"A lamp the {w0} carries when the road is dark.")):
            self.assertTrue(self.cut(text, line_), (text, line_))
        for text, line_ in ((f"{w1.title()} twelve", f"Her marks on {w1} twelve are neat."),
                            (f"{w0.title()}s said over the {w1}", f"They mentioned {w0}s said over the {w1}."),
                            (f"Fifteen {w0}s", f"He counted fifteen {w0}s in the hall.")):
            self.assertEqual(M._wording(text, line_), [], (text, line_))

    def test_a_subject_cut_before_its_verb_is_no_phrase(self):
        w0, w1 = word(88, 0), word(88, 1)
        self.assertTrue(self.cut(f"That {w0}", f"That {w0} did not hold the {w1}."))
        self.assertNotEqual(M._spoken_phrase(f"That {w0} did not open the {w1}.", 32), f"That {w0}")
        self.assertNotEqual(M._spoken_phrase(f"But the {w0} doesn't end there.", 21), f"But the {w0}")
        self.assertEqual(M._wording(f"No second {w0}", f"No second {w0} was given."), [])     # a label still

    def test_a_short_clause_between_commas_is_whole(self):
        w0, w1 = word(89, 0), word(89, 1)
        line_ = f"saw it, locked the {w0}, and sent a {w1} to the hall below it without a word to anyone."
        for lim in (25, 32):
            self.assertEqual(M._spoken_phrase(line_, lim), f"Locked the {w0}")
        self.assertEqual(M._spoken_phrase(f"It was late, and the {w0} stood in the {w1} hall.", 32), "It was late")
        for s, lone in ((f"Until he left, the {w0} stood in the {w1} hall for years.", "Until he left"),
                        (f"Once it ended, the {w0} stood in the {w1} hall for years.", "Once it ended")):
            self.assertNotEqual(M._spoken_phrase(s, 32), lone)

    def test_good_texts_the_strict_rules_refused_are_whole(self):
        w0, w1, w2 = word(90, 0), word(90, 1), word(90, 2)
        for text, line_ in ((f"Needed urgent {w0}", f"It showed which {w1}s were most scuffed and needed urgent {w0}."),
                            (f"Seen from its {w0}", f"The {w1}, if seen from its {w0}, was never {w2}."),
                            ("You could rest", f"You could rest in the {w0} for a night."),
                            (f"They were still {w0}", f"The {w1}'s answer was that they were still {w0}."),
                            (f"She opened the {w0}", f"After the {w1}'s visit she opened the {w0}.")):
            self.assertEqual(M._wording(text, line_), [], (text, line_))
        for text, line_ in (("We slept", f"If we slept, the {w0} closed."),
                            ("Tenth century", f"They set the {w1} in the ninth or tenth century."),
                            ("He wrote", f"The {w0} he wrote was lost."),
                            ("Taken in the hall", f"If taken in the hall the {w0} would break.")):
            self.assertTrue(M._wording(text, line_), (text, line_))

    def test_a_quotation_is_shown_whole_with_its_marks_or_not_at_all(self):
        w0, w1 = word(91, 0), word(91, 1)
        line_ = f'The {w0} "not plenty for the {w1} hall" had stood there for years.'
        for text in (f"The {w0} not plenty", "Not plenty", f"{w0.title()} not plenty"):
            self.assertTrue(self.cut(text, line_), text)                 # the head of a quoted label reads as a claim
        picks = [p for lim in (21, 25, 32, 46) for p in M._spoken_phrases(line_, lim)]
        self.assertFalse([p for p in picks if "plenty" in p and f'{w1} hall"' not in p], picks)
        said = f'He wrote "never again" on the {w0} and left.'
        picks = [p for lim in (21, 32, 46) for p in M._spoken_phrases(said, lim)]
        self.assertIn(f'He wrote "never again" on the {w0}', picks)
        self.assertFalse([p for p in picks if "never again" in p.lower() and '"' not in p or p == "He wrote"], picks)
        self.assertEqual(M._wording(f'He wrote "never again" on the {w0}', said), [])
        self.assertTrue(self.cut("Strictly speaking", f"It was not, strictly speaking, a {w0} at all."))     # an aside
        self.assertTrue(self.cut(f"Never clear whether the {w0}", f"It was never clear whether the {w0} was real."))
        self.assertNotIn(f"Never clear whether the {w0}", M._spoken_phrases(f"It was never clear whether the {w0} was "
                                                                             f"real.", 32))

    def test_decades_and_ordinals_are_numbers_and_a_fronted_time_keeps_its_clause(self):
        w0, A = word(92, 0), word(92, 1).title()
        for s, lim in ((f"During the 1920s the keepers sold the {w0}.", 32), (f"In the 1950s the {w0} was moved to {A}.", 21),
                       (f"In the 1980s the {w0} came back to {A}.", 32)):
            picks = M._spoken_phrases(s, lim)
            self.assertFalse([p for p in picks if re.match(r"\d+(?:s|st|nd|rd|th) the ", p)], (s, picks))
        self.assertEqual(M._spoken_phrase(f"In the 1980s the {w0} came back to {A}.", 32), f"{w0.title()} came back to {A}")
        self.assertIn(f"{w0.title()} had come back", M._spoken_phrases(f"By the 4th century the {w0} had come back.", 32))
        for text, line_ in (("The 1980s", f"In the 1980s the {w0} came back."),
                            ("In the 1980s", f"In the 1980s the {w0} came back."),
                            ("The 4th", f"On the 4th the {w0} came back.")):
            self.assertEqual(M._wording(text, line_), [], text)
        self.assertTrue(self.cut("Hundred four", f"It ran from {w0} sixty-one through one hundred four."))   # inside one

    def test_a_capital_a_colon_a_dash_or_a_quotation_opens_is_no_name(self):
        w0, A = word(93, 0), word(93, 1).title()
        names = lambda text, line_: "names" in [r for r, _, _ in M._wording(text, line_)]
        for text, line_ in (("He would never break it", f"He would keep it, one rule: Never break the {w0}."),
                            (f"They always feared the {w0}", f"They had one fear — Always the {w0}."),
                            ("The keeper said stop the war", 'The keeper said, "Stop the war."')):
            self.assertFalse(names(text, line_), text)
        self.assertTrue(names(f"After the war, {A.lower()} fell", f"After the war, {A} fell."))   # a comma: a name still

    def test_not_saying_turns_round_what_is_said(self):
        # the replay's repair of a text the new rules caught dropped the "not" of "not saying [it] is ...":
        # "saying" was no verb of saying
        w0, w1 = word(103, 0), word(103, 1)
        self.assertIn("negation", [r for r, _, _ in M._wording(f"Proof of {w0}s",
                                                               f"She is not saying the {w1} gives proof of {w0}s.")])

    def test_an_elided_word_opens_no_quotation(self):
        w0, C = word(94, 0), word(94, 1).title() + "s"
        for line_ in (f"In the '90s the {C}' {w0} was lost.", f"He wrote 'tis the end and the {C}' {w0} burned."):
            self.assertIn(f"{C}'", [w for w, _, _ in M._toks(line_)])
            self.assertIn(f"{C}' {w0}", " | ".join(M._spoken_phrases(line_, 32)))


class Rules(unittest.TestCase):
    """Review 2026-10-13 (round 4): good texts four rules refused (a clause before its adjunct, a phrase between commas,
    a hedge on its number, a whole quotation, a negation that does not reach), and what they let through (a phrase cut
    before the words it needs, a negated subject, a fronted negative, a modal perfect, an infinitive after 'failed',
    a frame the narrator denies or reports, a proportion, a wrong number, a summary without its 'did not', a verb no
    list holds, a heading cut at the head of a clause, names with other particles, a question). Made-up words."""

    def rules(self, text, line_, **kw):
        return [r for r, _, _ in M._wording(text, line_, **kw)]

    def picks(self, line_, lims=(21, 25, 32, 46)):
        return [p for lim in lims for p in M._spoken_phrases(line_, lim)]

    def test_a_whole_clause_may_stop_before_its_adjunct(self):
        w0, w1, A = word(940, 0), word(940, 1), word(940, 2).title()
        for text, line_ in ((f"The {w0} was sealed", f"The {w0} was sealed in 1842."),
                            ("Everything changed", "Everything changed after that night."),
                            (f"{A} was arrested", f"{A} was arrested in March."),
                            (f"The {w0} vanished", f"The {w0} vanished after the fire."),
                            ("He waited", "He waited until dawn."),
                            ("They hid it", f"They hid it in the {w0}."),
                            ("Nobody read it", "Nobody read it for a century."),
                            ("They found them", f"They found them in the {w0}."),
                            ("He later restored it", f"He later restored it in private {w1}s.")):
            self.assertEqual(M._wording(text, line_), [], text)
        self.assertTrue(M._spoken_phrases(f"The {w0} ended when the {w1} emptied.", 32))
        for text, line_ in (("They hid", f"They hid it in the {w0}."),                 # still before its object
                            (f"{w1.title()} carried", f"It came as {w1} carried over the hills.")):   # no subject
            self.assertIn("cut off", self.rules(text, line_), text)

    def test_a_phrase_between_commas_is_an_aside_only_when_it_has_no_head(self):
        w0, w1, A, B = word(941, 0), word(941, 1), word(941, 2).title(), word(941, 3).title()
        for text, line_ in ((f"{A} {B}", f"The abbot, {A} {B}, sealed the {w0}."),
                            (f"The last {w0}", f"{A}, the last {w0}, died in the {w1}."),
                            (f"His only {w0}", f"He left his house, his only {w0}, to the {w1}."),
                            (f"Two silver {w0}s", f"They found a map, two silver {w0}s, and a ring."),
                            ("In 1842", f"The {w0}, in 1842, was sealed."),
                            ("Once a year", f"The {w0}, once a year, was opened.")):
            self.assertNotIn("cut off", self.rules(text, line_), text)
        self.assertIn("cut off", self.rules("Strictly speaking", f"It was not, strictly speaking, a {w0} at all."))
        self.assertIn("cut off", self.rules("He said", f"The {w0}, he said, was gone."))

    def test_a_hedge_opens_the_number_it_hedges(self):
        w0 = word(942, 0)
        for hedge in ("almost", "nearly", "some", "roughly", "approximately", "perhaps", "up to"):
            line_ = f"The {w0} was shut for {hedge} two centuries."
            self.assertEqual(M._wording(f"{hedge.capitalize()} two centuries", line_), [], hedge)
            self.assertIn("detail", self.rules("Two centuries", line_), hedge)
        self.assertEqual(M._wording("Approximately six months", f"The {w0} reached them approximately six months "
                                                                f"later."), [])

    def test_a_quotation_shown_whole_with_its_marks_is_whole(self):
        w0, w1 = word(943, 0), word(943, 1)
        for text, line_ in ((f'"Not plenty for the {w1} hall"', f'The {w0} "not plenty for the {w1} hall" had stood '
                                                                 f'there for years.'),
                            ('"Never again"', 'He wrote "never again" in the margin.'),
                            ('"Never again"', 'He wrote "never again" and left.'),
                            ('"No entry"', 'She painted "no entry" on the gate.'),
                            ('"Keep out"', 'The sign "keep out" hung on the door.')):
            self.assertEqual(M._wording(text, line_), [], text)
        self.assertIn(f'"Not plenty for the {w1} hall"',
                      M._spoken_phrases(f'The {w0} "not plenty for the {w1} hall" had stood there.', 46))

    def test_a_phrase_never_stops_before_the_words_it_needs(self):
        w0, w1, w2 = word(944, 0), word(944, 1), word(944, 2)
        for text, line_ in (("Specific in a way", f"The {w0} was specific in a way that other {w1}s rarely are."),
                            ("Marked in ways", f"The {w0} is marked in ways the {w1} lists in full."),
                            ("Something familiar enough", f"It was a reply to something familiar enough to need a {w0}."),
                            ("Old enough", f"He was old enough to remember the {w0}."),
                            ("The only keeper", f"The only keeper who stayed was {w0}."),
                            ("The kind", "It is the kind that nobody reads."),
                            ("Appeared at first", f"The sign '{w0} for {w1}' had appeared at first as routine {w2}."),
                            (f"First as routine {w2}", f"The sign '{w0} for {w1}' had appeared at first as routine {w2}."),
                            ("Removing something", f"Removing something from the {w0} stream changed it."),
                            ("Made available", f"Made available through {w0}s or {w1} lessons, it spread."),
                            ("So heavy", f"The {w0} was so heavy that nobody moved it."),
                            ("Too heavy", f"Too heavy to lift, the {w0} stayed.")):
            self.assertIn("cut off", self.rules(text, line_), text)
        line_ = f"The {w0} {w1} was specific in a way that early {w2} texts rarely are."
        self.assertNotIn("Specific in a way", self.picks(line_))
        self.assertEqual(M._spoken_phrase(line_, 21), f"{w0.title()} {w1}")       # a noun phrase before a predicate
        self.assertEqual(M._wording("It was so heavy that nobody moved it", "It was so heavy that nobody moved it."), [])

    def test_a_negation_reaches_no_verb_phrase_of_its_own(self):
        w0, w1, A = word(945, 0), word(945, 1), word(945, 2).title()
        for text, line_ in ((f"Sealed the {w0}", f"They had no key and sealed the {w0}."),
                            (f"Burned the {w0}", f"He found no {w1} and burned the {w0}."),
                            (f"The second {w0}", f"Nobody in {A} remembers the second {w0}."),
                            ("The answer", "No one knows the answer."),
                            ("The answer", "Nobody knows the answer."),
                            ("The answer", "Nothing changes the answer."),
                            (f"The {w0} was real", f"No one knows the {w0} was real.")):
            self.assertNotIn("negation", self.rules(text, line_), (text, line_))

    def test_a_number_said_another_way_is_the_same_number(self):
        w0, w1 = word(946, 0), word(946, 1)
        W, W1 = w0.title(), w1.title()
        for text, line_ in ((f"Twelve {W}s Stayed", f"A dozen {w0}s stayed behind."),
                            (f"One {W} Survived", f"Only a single {w0} survived."),
                            ("Fifty Years Later", f"Half a century later, the {w0} fell."),
                            (f"Thirty Years of {W}", f"For three decades the {w0} was silent."),
                            (f"2 {W}s, 1 {W1}", f"There were two {w0}s and only a single {w1}."),
                            (f"Two {W}s", f"A pair of {w0}s came.")):
            self.assertNotIn("detail", self.rules(text, line_), text)

    def test_a_negated_subject_reaches_its_predicate(self):
        w0, A = word(947, 0), word(947, 2).title()
        for text, line_ in ((f"Opened the {w0}", f"None of the keepers had opened the {w0}."),
                            (f"Allowed to read the {w0} ledger", f"No monk was allowed to read the {w0} ledger."),
                            (f"Told about the {w0}", f"Nobody in the order was told about the {w0}."),
                            (f"Read the {w0}", f"Not a single monk had read the {w0}."),
                            (f"Opened the {w0}", f"No monk had opened the {w0}."),
                            ("Allowed to copy", f"It is a {w0} no {A} reader has been allowed to copy.")):
            self.assertIn("negation", self.rules(text, line_), text)
            self.assertNotIn(text, self.picks(line_), text)

    def test_a_fronted_negative_turns_round_its_whole_clause(self):
        w0, w1 = word(948, 0), word(948, 1)
        for text, line_ in ((f"Abbot open the {w0}", f"Under no circumstances would the abbot open the {w0}."),
                            (f"Keepers burn the {w0}s", f"In no case did the keepers burn the {w0}s."),
                            (f"Abbot sign the {w0}", f"At no point did the abbot sign the {w0}."),
                            (f"Abbot leave the {w0}", f"Rarely did the abbot leave the {w0}."),
                            (f"Monks seen the {w0}", f"Never before had the monks seen the {w0}."),
                            (f"The {w1} leave the {w0}", f"Not once did the {w1} leave the {w0}."),
                            (f"Did the keepers burn the {w0}s", f"At no point did the keepers burn the {w0}s.")):
            self.assertIn("negation", self.rules(text, line_), text)
            self.assertFalse([p for p in self.picks(line_) if w0 in p and not re.search(
                r"\b(no|never|not|rarely)\b", p.lower())], line_)

    def test_a_modal_perfect_and_an_inverted_condition_keep_their_frame(self):
        w0 = word(949, 0)
        for text, line_ in ((f"Saved the {w0}", f"The keepers could have saved the {w0}."),
                            (f"Destroyed the {w0}", f"The fire would have destroyed the {w0}."),
                            (f"Burned the {w0}s", f"The monks might have burned the {w0}s."),
                            ("Had the monks stayed", f"Had the monks stayed, the {w0} would have burned."),
                            ("Had the monks", f"Had the monks stayed, the {w0} would have burned.")):
            self.assertIn("cut off", self.rules(text, line_), text)
            self.assertNotIn(text, self.picks(line_), text)

    def test_an_infinitive_after_a_verb_or_an_adjective_is_no_order(self):
        w0, w1 = word(950, 0), word(950, 1)
        for text, line_ in ((f"Save the {w0} hall", f"The monks failed to save the {w0} hall."),
                            (f"Sign the {w0}", f"The abbot refused to sign the {w0}."),
                            (f"Decipher the {w0}", f"The keepers were unable to decipher the {w0}."),
                            (f"Burn the {w0}s", f"The monks were ordered to burn the {w0}s, but refused."),
                            (f"Escape the {w0}", f"The monks tried to escape the {w0}."),
                            (f"{w1.title()} the {w0}", f"The monks failed to {w1} the {w0}.")):
            self.assertIn("cut off", self.rules(text, line_), text)
        self.assertIn("negation", self.rules(f"Save the {w0} hall", f"The monks failed to save the {w0} hall."))
        self.assertEqual(M._wording(f"Work in the {w0} hall", f"He went back to work in the {w0} hall."), [])

    def test_what_the_narrator_denies_or_only_reports_keeps_its_frame(self):
        w0 = word(951, 0)
        for text, line_ in ((f"Monks hid the {w0} in the hall", f"It is a myth that the monks hid the {w0} in the hall."),
                            (f"Monk stole the {w0}", f"The abbot believed the monk stole the {w0}."),
                            (f"Burning the {w0}s", f"Far from burning the {w0}s, the monks saved them."),
                            (f"Honest {w0}s", f"The monks were anything but honest {w0}s."),
                            (f"Abbot fled the burning {w0}", f"Everyone but the abbot fled the burning {w0}."),
                            (f"Abbot stole the {w0}", f"Allegedly, the abbot stole the {w0}."),
                            (f"The monks hid the {w0}", f"It is not true that the monks hid the {w0}.")):
            self.assertTrue(self.rules(text, line_), text)
            self.assertNotIn(text, self.picks(line_), text)

    def test_a_proportion_or_a_range_keeps_both_its_numbers(self):
        w0, W = word(952, 0), word(952, 0).title()
        for text, line_ in ((f"Five {w0}s survived the winter", f"One in five {w0}s survived the winter."),
                            (f"Three {w0}s died in the fire", f"Two out of three {w0}s died in the fire."),
                            (f"{W}s died in the fire", f"Half of the {w0}s died in the fire."),
                            (f"Four hundred {w0}s", f"Just under four hundred {w0}s lived in the hall."),
                            (f"Ten and twelve {w0}s", f"Between ten and twelve {w0}s survived the winter."),
                            (f"Ten thousand {w0}s", f"An estimated ten thousand {w0}s burned.")):
            self.assertTrue(self.rules(text, line_), text)
            self.assertNotIn(text, self.picks(line_), text)

    def test_a_number_is_the_number_said_whole_and_of_its_kind(self):
        w0, W = word(953, 0), word(953, 0).title()
        for text, line_ in ((f"Fifty {W}s Lost in the Fire", f"Two hundred and fifty {w0}s died in the fire."),
                            (f"Two {W}s Lost in the Fire", f"Two hundred {w0}s died in the fire."),
                            (f"A Hundred {W}s Burned", f"Three hundred {w0}s burned that night."),
                            (f"Five {W}s Came in 1450", f"In 1450 twenty-five {w0}s came to the hall."),
                            (f"Twelve {W}s Survived the Winter", f"Twelve {w0}s arrived in the spring. Only three "
                                                                f"survived the winter."),
                            (f"Four {W}s Ruled the Hall", f"The fourth {w0} ruled the hall for years."),
                            (f"In 1540 the {W}s Fled", f"In 1450 the {w0}s fled the city."),
                            (f"1540: The {W}s Flee", f"In 1450 the {w0}s fled the city.")):
            self.assertIn("detail", self.rules(text, line_), text)
        for text, line_ in ((f"250 {W}s Lost", f"Two hundred and fifty {w0}s were lost."),
                            (f"The 4th {W}", f"The fourth {w0} ruled."),
                            (f"{W}s of 1450", f"The {w0}s came in the spring."),                # no year said near
                            (f"Twelve {W}s Arrived", f"Twelve {w0}s arrived in the spring. Only three survived.")):
            self.assertNotIn("detail", self.rules(text, line_), text)

    def test_a_summary_that_drops_a_did_not_is_caught(self):
        w0, w1 = word(954, 0), word(954, 1)
        W, W1 = w0.title(), w1.title()
        for text, line_ in ((f"The {W} Signed the {W1}", f"The {w0} did not sign the {w1}."),
                            (f"{W}s Burned the {W1}s", f"The {w0}s did not burn the {w1}s."),
                            (f"The {W}s Kept the {W1}s", f"The {w0}s didn't keep the {w1}s."),
                            (f"The {W} Opened the {W1}", f"At no point did the {w0} open the {w1}.")):
            self.assertIn("negation", self.rules(text, line_), text)
        self.assertEqual(M._wording(f"The {W} Signed the {W1}", f"The {w0} signed the {w1}."), [])

    def test_a_fronted_place_or_feast_is_no_part_of_the_name_after_it(self):
        O, K, A, w0 = word(955, 0).title(), word(955, 1).title(), word(955, 2).title(), word(955, 3)
        for text, line_ in ((f"{K} fell to the {w0}s", f"In {O} {K} fell to the {w0}s."),
                            (f"{K} fled the hall", f"After Easter {K} fled the hall with the {w0}.")):
            self.assertNotIn("names", self.rules(text, line_), text)
        self.assertFalse([p for p in self.picks(f"After Easter {K} fled the hall with the {w0}.")
                          if p.startswith(f"Easter {K}")])
        self.assertIn("names", self.rules(f"{A} and rested", f"They climbed to Mount {A} and rested."))

    def test_a_verb_before_its_object_is_caught_whatever_its_form(self):
        w0 = word(956, 0)
        for text, line_ in (("Monks hid", f"Legend says the monks hid the {w0} in the hall."),
                            ("Monk stole", f"The abbot believed the monk stole the {w0}."),
                            ("Keepers sold", f"The keepers sold the {w0} in the spring."),
                            ("Abbot broke", "Then the abbot broke the seal at dawn."),
                            ("Abbot open", f"Nor would the abbot open the {w0}."),
                            ("Keepers burn", f"Nor did the keepers burn the {w0}s."),
                            ("Seldom had the monks", f"Seldom had the monks seen the {w0}."),
                            ("Not until 1450 did the monks", f"Not until 1450 did the monks leave the {w0}."),
                            ("No one in the hall had seen", f"No one in the hall had seen the {w0}.")):
            self.assertTrue(self.rules(text, line_), text)
        self.assertNotIn("Legend says the monks hid",
                         self.picks(f"Legend says the monks hid the {w0}, but no record supports it."))

    def test_a_short_heading_never_ends_on_the_head_of_a_clause(self):
        A = word(957, 0).title()
        for h, bad in ((f"The {A} Nobody Was Allowed to Read", f"The {A} Nobody"),
                       (f"A {A} No Scholar Has Been Permitted to See", f"A {A} No Scholar"),
                       (f"The Myth That the Monks Hid the {A}", "The Myth That the Monks"),
                       (f"The {A} No One Has Ever Opened", f"{A} No One Has Ever")):
            got = M._short_heading(h, 25)
            self.assertNotEqual(got, bad, h)
            self.assertFalse(re.search(r"\b(nobody|no|that)\b", got.lower()), (h, got))
        got = M._short_heading(f"The Unsigned {A} of the Northern Hall", 25)
        self.assertTrue(not got or "Unsigned" in got, got)

    def test_names_keep_particles_of_many_languages(self):
        K, T, I, R, S, L, V, O = (word(958, j).title() for j in range(8))
        names = M._film_names({"keyEntities": [{"name": f"{K} ibn {T}"}, {"name": f"{I} y {T}"}, {"name": f"{R} bin {S}"},
                                                {"name": f"{L} dos {V}"}, {"name": f"{O} al-{T}"}]}, "")
        for n in (f"{K} ibn {T}", f"{I} y {T}", f"{R} bin {S}", f"{L} dos {V}", f"{O} al-{T}"):
            self.assertIn(n, names)
        self.assertIn("names", self.rules(f"{K} ibn", f"The scroll was copied by {K} ibn {T} in the spring.", names=names))
        self.assertIn("names", self.rules(f"Signed by {I}", f"It was signed by {I} y {T} later.", names=names))
        self.assertIn("names", self.rules(f"It went to {O}", f"It went to {O} al-{T} at last.", names=names))
        self.assertFalse([p for p in self.picks(f"Later it reached {R} bin {S} at the hall.")
                          if p.endswith((" bin", f" {R}"))])

    def test_a_negation_reaches_what_a_verb_of_naming_names(self):
        # (the replay after these rules: 'People earth angels' of 'does not call these people earth angels')
        w0, w1, w2 = word(963, 0), word(963, 1), word(963, 2)
        line_ = f"The {w0} does not call these {w1}s {w2} keepers."
        self.assertIn("negation", self.rules(f"{w1.title()}s {w2} keepers", line_))
        self.assertNotIn(f"{w1.title()}s {w2} keepers", self.picks(line_))

    def test_a_relative_clause_and_a_verbs_particle_stay_with_what_they_need(self):
        # (the replay after these rules: a moved line became 'Whose purpose was specific' and 'That word brought A')
        w0, w1, A = word(962, 0), word(962, 1), word(962, 2).title()
        for text, line_ in ((f"Whose {w1} was plain", f"It was a {w0} whose home was far, whose {w1} was plain, and "
                                                     f"whose end was near."),
                            (f"That {w0} brought {A}", f"That {w0} brought {A} back to the {w1}.")):
            self.assertIn("cut off", self.rules(text, line_), text)
            self.assertNotIn(text, self.picks(line_), text)

    def test_a_question_and_not_because_keep_their_whole(self):
        w0 = word(959, 0)
        line_ = f"Did the monks burn the {w0}s? They did not."
        self.assertFalse([p for p in self.picks(line_) if f"{w0}s" in p and not p.endswith("?")])
        self.assertIn("cut off", self.rules(f"Monks burn the {w0}s", line_))
        self.assertEqual(M._wording(f"Did the monks burn the {w0}s?", line_), [])        # a question asked as one
        line_ = f"It burned not because of the monks but because of the {w0}."
        self.assertIn("negation", self.rules(f"Monks but because of the {w0}", line_))
        self.assertNotIn(f"Monks but because of the {w0}", self.picks(line_))


class Paraphrases(unittest.TestCase):
    """2026-10-13 (the DeepSeek and Sonnet plans): a writer's summary read against the narration as an in-order
    selection of its words inside one sentence (R1), a 'that' clause shown without the belief or the report it hangs on
    (R2), a noun shown without the qualifier said after it (R3), a label that is a subject cut before its verb (R4), and
    the good texts the rules refused (an -ly adjective, a noun shaped like a verb, a list's row on its predicate, 'one'
    before a noun). Made-up words."""

    def rules(self, text, line_, **kw):
        return [r for r, _, _ in M._wording(text, line_, **kw)]

    def test_a_summary_keeps_its_negation_on_what_it_was_said_of(self):
        w0, w1, w2, w3 = word(970, 0), word(970, 1), word(970, 2), word(970, 3)
        for text, line_ in ((f"Not {w1}", f"The {w2} had not said the {w0} was {w1}."),              # of the saying
                            (f"No {w0}", f"The {w1} had no standard outer {w0} when he came."),      # of its modifier
                            (f"Not {w0} {w1}", f"He was not a {w2} with {w0} {w3} {w1}."),            # of another noun
                            (f"Not fit for {w0}", f"The {w2} was not fit for general {w1} {w0}.")):  # every qualifier
            self.assertIn("negation", self.rules(text, line_), text)
        for text, line_ in ((f"Not {w1} {w2}", f"It was not {w1} in any {w2}."),
                            (f"Not {w1}", f"That {w2} did not indicate {w1}."),                     # its object kept
                            (f"Not {w1}", f"They were not {w2}s the abbot recognized as {w1}."),   # what it was named
                            (f"Never read in a {w0}", f"It was never read in a {w1} {w0}."),
                            (f"No {w0} came", f"No {w0} ever came."),
                            (f"Not {w1} or {w2}", f"It was {w1} and {w2}.")):                       # no reading at all
            self.assertNotIn("negation", self.rules(text, line_), text)
        # a list's rows under a title that says the 'not' for them
        self.assertEqual(self.rules(f"Not {w1}", f"That {w2} did not indicate {w1}."), [])
        line_ = f"The {w2} had not said the {w0} was {w1}."
        self.assertEqual(self.rules(f"Not {w1}", line_, part="row", head=f"What the {w2} did not say"), [])
        self.assertIn("negation", self.rules(f"Not {w1}", line_, part="row", head=f"What the {w2} said"))
        self.assertIn("negation", self.rules(f"Not fit for {w0}", f"The {w2} was not fit for general {w1} {w0}.",
                                             kind="label"))                                       # a label with a 'not'
        self.assertEqual(self.rules(f"The {w0} {w1}", f"The {w0} was {w1}.", kind="label"), [])     # without: as before

    def test_a_summary_keeps_its_frame_and_never_glues_two_clauses(self):
        w0, w1, w2 = word(971, 0), word(971, 1), word(971, 2)
        line_ = f"It stopped when the last {w0} at the {w1} departed the hall."
        self.assertIn("cut off", self.rules(f"The last {w0} departed", line_))
        self.assertNotIn("cut off", self.rules(f"The last {w0} departed", line_, part="caption"))   # a caption sums up
        self.assertIn("cut off", self.rules("Never to keep", f"The {w2} never asked the {w0}s to keep anything."))
        line_ = f"The {w2} warns the {w0}s that the {w1}s can sing, and he tells them exactly when that singing stops."
        self.assertIn("cut off", self.rules(f"The {w1}s can sing, and exactly when that singing stops", line_))
        self.assertEqual(self.rules(f"The {w0}s fled the {w1}", f"The {w0}s quietly fled the old {w1}."), [])

    def test_a_belief_or_a_report_keeps_its_frame_three_words_back(self):
        w0, w1 = word(972, 0), word(972, 1)
        for line_ in (f"The abbot told the monks that the {w0} was gone.",
                      f"They spoke in the hope that the {w0} was gone.",
                      f"They worked on the assumption that the {w0} was gone.",
                      f"He was under the impression that the {w0} was gone.",
                      f"The {w1} tells the young that the {w0} was gone."):
            self.assertIn("cut off", self.rules(f"The {w0} was gone", line_), line_)
            self.assertNotIn(f"The {w0} was gone", M._spoken_phrases(line_, 32), line_)
        for line_ in (f"The {w1} grew so loud that the {w0} was gone.", f"The {w0} was gone."):
            self.assertNotIn("cut off", self.rules(f"The {w0} was gone", line_), line_)

    def test_a_noun_keeps_the_qualifier_said_after_it(self):
        w0, w1, w2 = word(973, 0), word(973, 1), word(973, 2)
        for text, line_ in ((f"Outside the {w0} of {w1}s", f"It set the {w2} outside the {w0} of {w1}s available for "
                                                             f"study."),
                            (f"The {w0} {w1}", f"They called it the {w0} {w1} suitable for prayer."),
                            (f"A {w0}", f"It stayed a {w0} open to every {w1}.")):
            self.assertIn("cut off", self.rules(text, line_), text)
            self.assertNotIn(text, M._spoken_phrases(line_, 46), text)
        line_ = f"It set the {w2} outside the {w0} of {w1}s available for study."
        for text in (f"Outside the {w0} of {w1}s available", f"Outside the {w0}", f"The {w2} outside the {w0}"):
            self.assertIn("cut off", self.rules(text, line_), text)
        self.assertFalse([w for _, w, _ in M._wording("Remained accessible", f"The {w1} remained accessible to the "
                                                                             f"{w2}s.") if "words it needs" in w])
        self.assertEqual(self.rules(f"The {w0} of {w1}s", f"He read the {w0} of {w1}s, available to all."), [])

    def test_a_label_that_is_a_subject_cut_before_its_verb_is_caught(self):
        w0, w1, w2 = word(974, 0), word(974, 1), word(974, 2)
        line_ = f"Every {w0} written down in the {w1}, and in the years after the {w2}, was burned."
        self.assertIn("cut off", self.rules(f"Every {w0} written down", line_, kind="label"))
        for text, line_ in ((f"Every {w0} written down", f"Every {w0} written down in the {w1} was burned."),
                            (f"The {w0} was sealed", f"The {w0} was sealed, and in the end it was opened."),
                            (f"{w0.title()} {w1.title()}", f"{w0.title()} {w1.title()}, the keeper, was gone.")):
            self.assertEqual(self.rules(text, line_, kind="label"), [], text)

    def test_good_texts_are_no_longer_refused(self):
        w0, w1, w2 = word(975, 0), word(975, 1), word(975, 2)
        W1 = w1.title()
        for text, line_, kw in ((f"Scholarly {w0}", f"It stayed a matter of scholarly {w0}.", {}),
                                (f"Early {W1} {w0}s", f"Several early {W1} {w0}s held it.", {}),
                                (f"{w0.title()}ic thought", f"It went against the main line of {w0}ic thought.", {}),
                                (f"Could not be {w0}ed", f"The {w1} could not be {w0}ed.", {"part": "row"}),
                                (f"Hear {w0}", f"They could hear {w0}.", {"part": "row"}),
                                (f"One {w0}", f"The {w1} turned on a {w0}.", {"kind": "label"})):
            self.assertEqual(self.rules(text, line_, **kw), [], text)
        # and what they stand beside still is
        self.assertIn("cut off", self.rules(f"Line of {w0}ic", f"It went against the main line of {w0}ic thought."))
        self.assertIn("cut off", self.rules(f"Could not be {w0}ed", f"The {w1} could not be {w0}ed."))
        self.assertIn("cut off", self.rules(f"Remained {w0}", f"The {w1} remained {w0} to the {w2}s.", part="row"))
        self.assertIn("detail", self.rules(f"Two {w0}s", f"The {w1} turned on a {w0}.", kind="label"))


class Names(unittest.TestCase):
    """Review 2026-10-13 (round phrases-names): a name is never cut - with its "de", "van der" or "of", one word of it
    left on either side, a known name around the words - and a month, a title's full stop or a capital after a colon
    makes no name. Made-up words."""

    def test_the_films_names_keep_their_particles_and_titles(self):
        A, B, C, D = (word(95, j).title() for j in range(4))
        names = M._film_names({"keyEntities": [{"name": f"Tower of {A}"}, {"name": f"{B} de {C}"},
                                                {"name": f"Jan van der {D}"}]},
                              f"Later Prof. {C} {D} wrote to Dr. {A} {B} about it.")
        for n in (f"Tower of {A}", f"{B} de {C}", f"Jan van der {D}", f"Prof {C} {D}", f"Dr {A} {B}"):
            self.assertIn(n, names)
        self.assertEqual(sorted(M._film_names({}, f"Then {A} {B} of the {C} {D} wrote.")), sorted([f"{A} {B}", f"{C} {D}"]))
        self.assertEqual(M._film_names({}, f"In March {A} fell to the keepers."), [])

    def test_a_name_cut_on_either_side_is_found(self):
        A, B, C, D = (word(96, j).title() for j in range(4))
        known = [f"{B} de {C}", f"Jan van der {D}", f"{A} {B} Library"]
        names = lambda text, line_: "names" in [r for r, _, _ in M._wording(text, line_, names=known)]
        for text, line_ in ((f"{C} in {A}", f"Later he met {B} de {C} in {A}."),
                            (f"Later he met {B}", f"Later he met {B} de {C} in {A}."),
                            (f"{A} and rested", f"They climbed to Mount {A} and rested."),
                            (f"{D} permission", f"He worked under {B} {C} {D} permission on a ledger."),
                            (f"Library in {C} for years", f"They worked in the {A} {B} Library in {C} for years."),
                            (f"{D} translates", f"Jan van der {D} translates it.")):
            self.assertTrue(names(text, line_), text)
        for text, line_ in ((f"{C} {D} wrote", f"Then {A} {B} of the {C} {D} wrote."),        # two names, not one
                            (f"{A} fell to the keepers", f"In March {A} fell to the keepers."),  # a month is no name
                            (f"{B} wrote it", f"Father {B} wrote it.")):                       # the name less its title
            self.assertFalse(names(text, line_), text)
        picks = [p for lim in (21, 25, 32) for p in M._spoken_phrases(f"The map was drawn by Jan van der {D} in a "
                                                                       f"single night.", lim, names=known)]
        self.assertFalse([p for p in picks if p.endswith((" van", " der"))], picks)

    def test_a_month_before_a_name_makes_no_name(self):
        A, w0 = word(97, 0).title(), word(97, 1)
        line_ = f"In March {A} fell to the {w0}s."
        picks = [p for lim in (21, 25, 32) for p in M._spoken_phrases(line_, lim)]
        self.assertFalse([p for p in picks if p.startswith(f"March {A}")], picks)
        self.assertTrue(M._wording(f"March {A}", line_))
        self.assertFalse([r for r, _, _ in M._wording("In March", line_) if r == "names"])

    def test_a_titles_full_stop_ends_no_sentence(self):
        A, B, w0 = word(98, 0).title(), word(98, 1).title(), word(98, 2)
        line_ = f"The letter reached Prof. {A} {B} in May."
        picks = [p for lim in (21, 25, 32) for p in M._spoken_phrases(line_, lim)]
        self.assertFalse([p for p in picks if p.endswith("Prof")], picks)
        self.assertTrue(M._wording("Letter reached Prof", line_))
        self.assertNotEqual(M._spoken_phrase(f"The ship joined the U.S. Navy fleet near {A}.", 32), f"Navy fleet near {A}")
        ends = lambda s: [w for w, _, se in M._toks(s) if se]
        self.assertEqual(ends(f"The answer was no. The {w0} met."), ["no", "met"])
        self.assertEqual(ends(f"He played his last card. The {w0} fell."), ["card", "fell"])
        self.assertEqual(ends(f"He was crowned king. The {w0} fell."), ["king", "fell"])
        self.assertEqual(ends(f"They sailed home to the U.S. The {w0} was long."), ["U.S.", "long"])


class Titles(unittest.TestCase):
    """2026-10-13: the opening's kicker and a chapter heading are never cut inside a name or before their noun."""

    def test_the_kicker_is_a_whole_part_of_the_setting_that_cuts_no_name(self):
        A, B, C, P = (word(906, j).title() for j in range(4))
        d = {"setting": f"The {A} {B} {C}, {P}; far away", "period": "",
             "keyEntities": [{"name": f"The {A} {B} {C}", "kind": "organisation"}], "sections": [{"title": TITLE}]}
        self.assertEqual(M._kicker(d, TITLE), P)                       # 'The A B C' is 27 letters: never 'The A B'
        self.assertEqual(M._auto_title(d, "")["kicker"], P)
        self.assertEqual(M._auto_title(DOSSIER, "")["kicker"], M._whole_words(DOSSIER["setting"].split(",")[0], 24))
        self.assertEqual(M._kicker({"setting": "", "period": ""}, TITLE), "The story")

    def test_a_long_heading_keeps_its_head_noun(self):
        A, B = word(907, 0).title(), word(907, 1).title()
        self.assertEqual(M._short_heading(f"The {A}'s Narrower Role", 25), f"{A}'s Narrower Role")  # the article first
        self.assertEqual(M._short_heading(f"The {A}'s Narrow Hidden Role", 25), f"The {A}'s Narrow Role")  # a modifier
        self.assertEqual(M._short_heading(f"The {A}'s Narrow Hidden Role", 20), f"The {A}'s Role")
        self.assertEqual(M._short_heading(f"The {A} {B} Narrow Role Within", 25, [f"{A} {B}"]), f"{A} {B}")   # a title
        self.assertEqual(M._short_heading("Quiet", 25), "Quiet")

    def test_the_kicker_is_read_against_the_narration_as_the_gate_reads_it(self):
        # (review 2026-10-13) the producer read the kicker against the setting, the gate against the narration of the
        # first shot: 'P' of a setting 'P, far away' where the narrator says 'the P Q' was set, flagged and kept
        P, Q, w = word(920, 0).title(), word(920, 1).title(), word(920, 2)
        d = {"setting": f"{P}, far away", "period": f"late {w}", "sections": [{"title": TITLE}]}
        said = f"Near the {P} {Q} the keepers met. It was in Late {w.title()} that they wrote."
        names = M._film_names(d, said)
        self.assertEqual(M._auto_title(d, "", said, names)["kicker"], f"{P} {Q}")    # the name as the narrator says it
        self.assertEqual(M._kicker(dict(d, setting=""), TITLE, names, said), f"Late {w.title()}")   # and its capitals
        self.assertEqual(M._kicker(d, TITLE), P)                                  # no narration: the setting's own part
        longer = [p for p, _ in M._setting_parts(d)]
        for c in (f"{P} {Q}", f"Late {w.title()}"):
            self.assertEqual(M._wording(c, said, "title", names, longer), [])      # what the gate reads, it passes

    def test_a_title_ending_on_a_noun_shaped_like_an_adjective_is_whole(self):
        # (review 2026-10-13) the suffix test read 'Betrayal', 'Heretic', 'Missive' as adjectives, and the gate put an
        # unrelated section title in place of a good chapter heading
        A = word(921, 0).title()
        for h in ("The Betrayal", "The Heretic", "The Fugitive", "The Cardinal", f"{A}'s Missive", f"The {A}'s Secret"):
            self.assertEqual(M._wording(h, "", "title"), [], h)
        self.assertTrue(M._wording(f"The {A}'s Narrow", "", "title"))              # a listed adjective needs its noun

    def test_a_long_heading_keeps_its_verb_its_names_and_its_grammar(self):
        # (review 2026-10-13) the modifier step deleted verbs, subjects and name words ('How the A the Ledgers',
        # 'K de A the Z'), the clause step ended on a verb ('How the A Hid'), and the gate passed both
        A, K, Z = (word(922, j).title() for j in range(3))
        cases = {f"How the {A} Hid the Northern Ledgers": "",
                 f"How the {A} Hid the Sacred Ledgers": "",
                 f"Why the {A} Kept the Second Letter": "",
                 f"The Man Who Carried the {A} Home": "The Man",                   # was 'The Man Who Carried'
                 f"The {A}'s Sealed Private Letters": f"{A}'s Sealed Letters",     # was "The A's Sealed"
                 f"{K} de {A} Meets the {Z}": f"{K} de {A}",                       # its subject whole, never 'K de A the Z'
                 f"Into the {K} {Z} Library": "",                                  # was 'Into the K Library'
                 f"The Twenty-First {K} {Z} Hall": "",                             # was 'The Twenty-First Hall'
                 f"An Illuminated Ledger of the {A}": f"A Ledger of the {A}",      # never 'An Ledger'
                 f"An Uncatalogued Ledger of the {A}": ""}       # never 'A Ledger': its 'un-' turns round what is said
        for src, out in cases.items():
            got = M._short_heading(src, 25)
            self.assertEqual(got, out, src)
            if got:
                self.assertEqual(M._wording(got, "", "title", (), [src]), [], src)    # the gate reads it whole too
        for cut, src in ((f"How the {A} Hid", f"How the {A} Hid the Northern Ledgers"),     # a verb without its object
                         (f"Why the {A}", f"Why the {A} Kept the Second Letter")):         # a clause word alone
            self.assertTrue(M._wording(cut, "", "title", (), [src]), cut)
        self.assertEqual(M._wording(f"The Northern {A}", "", "title", (), [f"The Northern {A} Remembers Everything"]), [])

    def test_a_shortened_heading_starts_with_a_capital(self):
        # (review 2026-10-13) the article dropped from a sentence-case section title left 'translator's narrow role'
        w = word(923, 0)
        self.assertEqual(M._short_heading(f"The {w}'s narrow vantle", 25), f"{w.title()}'s narrow vantle")
        self.assertEqual(M._short_heading(f"the {w}'s vantle", 25), f"The {w}'s vantle")


class Wording(Base):
    """2026-10-13: every text reads as the narrator meant it - no negation dropped, nothing cut off, names whole, the
    numbers and alternatives said - found, repaired from the words said there, and a second gate passes unchanged.
    Made-up words with real function words, on the clean film's own text shots (the spoken line on shot 5, the typed
    caption on shot 29, the opening title)."""

    def find_with(self, rows, dossier=DOSSIER):
        write_job(self.job, rows)
        ctx = M._gate_ctx(self.job, rows, dossier, cues_of(rows), "", (self.job / "script.txt").read_text(), mode="report")
        return M._gate_find(rows, ctx)

    def spoken(self, text, words, k=5, tid="shadow-up"):
        rows = film()
        rows[k]["text"] = text
        rows[k]["device"] = {"id": tid, FIELD[tid]: words}
        rows[k]["filler"] = True
        return rows

    def repaired(self, rows, k, rule, shown, expected, dossier=DOSSIER):
        heard = copy.deepcopy(rows)                                   # the voice: as the film was planned
        found = self.find_with(rows, dossier)
        self.assertTrue(any(x["rule"] == rule and x["k"] == k for x in found),
                        [(x["rule"], x["k"], x["what"]) for x in found])
        rec, _ = self.gate(rows, words_from=heard, dossier=dossier)
        self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
        self.assertTrue(any(x["rule"] == rule for x in rec["repairs"]), rec["repairs"])
        self.assertEqual(shown(rows), expected)
        before = copy.deepcopy(rows)
        again, _ = self.gate(rows, words_from=heard, dossier=dossier)
        self.assertEqual(again["result"], "PASS", again["first_look"])
        self.assertEqual(rows, before)

    def line_on(self, text):
        return lambda rows: next((r.get("device") or {}).get("line") for r in rows if r["text"] == text)

    def test_a_dropped_negation_is_restored(self):
        w0, w1 = word(70, 0), word(70, 1)
        text = f"The {w0} was not {w1} at heart."
        self.repaired(self.spoken(text, f"{w1.title()} at heart"), 5, "negation", self.line_on(text), f"Not {w1} at heart")

    def test_a_verb_before_its_object_is_completed(self):
        w1 = word(71, 0)
        text = f"We keep the {w1}."
        self.repaired(self.spoken(text, "We keep"), 5, "cut off", self.line_on(text), f"We keep the {w1}")

    def test_a_condition_stopped_at_its_comma_gets_its_clause(self):
        w1 = word(72, 0)
        text = f"If we slept, the {w1} closed."
        self.repaired(self.spoken(text, "If we slept"), 5, "cut off", self.line_on(text), f"If we slept, the {w1} closed")

    def test_a_comparison_without_its_than_keeps_its_whole_part(self):
        w0, w1, w2 = word(73, 0), word(73, 1), word(73, 2)
        text = f"The {w0} was colder than {w1} and wetter than {w2}."
        self.repaired(self.spoken(text, f"Colder than {w1} and wetter"), 5, "cut off", self.line_on(text),
                      f"Colder than {w1}")

    def test_a_phrase_that_starts_inside_a_noun_phrase_is_made_whole(self):
        w1 = word(74, 0)
        text = f"She named the {w1} twice in a speech."
        self.repaired(self.spoken(text, f"{w1.title()} twice in a speech"), 5, "cut off", self.line_on(text),
                      f"She named the {w1} twice")

    def test_a_dropped_alternative_is_restored(self):
        w1 = word(75, 0)
        text = f"They set the {w1} in the ninth or tenth century."
        self.repaired(self.spoken(text, "Tenth century"), 5, "detail", self.line_on(text), "Ninth or tenth century")

    def test_a_lost_capital_is_given_back(self):
        w0, C = word(76, 0), word(76, 1).title()
        text = f"The {w0} was deliberate {C}."
        self.repaired(self.spoken(text, f"Deliberate {C.lower()}"), 5, "names", self.line_on(text), f"Deliberate {C}")

    def named(self):
        A, B, C, P = (word(906, j).title() for j in range(4))
        return A, B, C, dict(DOSSIER, setting=f"The {A} {B} {C}, {P}",
                             keyEntities=[{"name": f"The {A} {B} {C}", "kind": "organisation"}])

    def test_a_name_cut_in_the_opening_kicker_is_made_whole(self):
        A, B, C, d = self.named()
        rows = film()
        rows[0]["device"] = dict(M._auto_title(d, ""), kicker=f"The {A} {B}")       # 'The A B C' cut at whole words
        self.repaired(rows, 0, "names", lambda rows: rows[0]["device"]["kicker"], d["setting"].split(", ")[1], dossier=d)

    def test_a_name_cut_in_a_typed_caption_is_made_whole(self):
        A, B, C, d = self.named()
        rows = film()
        rows[0]["device"] = M._auto_title(d, "")
        text = f"The keeper ruled under the {A} {B} {C} for years."
        rows[29]["text"] = text
        rows[29]["typedCaption"] = {"lines": ["The Keeper Under", f"{B} {C} Rule"], "startFrame": M.TYPED_CAPTION_START_F}
        cap = lambda rows: " ".join(next(r["typedCaption"]["lines"] for r in rows if r["text"] == text))
        self.repaired(rows, 29, "names", cap, f"The Keeper Under {A} {B} {C} Rule", dossier=d)
        lines = next(r["typedCaption"]["lines"] for r in rows if r["text"] == text)
        self.assertTrue(all(len(x) <= M.TC_LINE_MAX for x in lines), lines)

    def test_a_one_row_list_is_never_kept(self):
        rows = film()
        rows[24]["device"] = {"id": "bullet-checklist", "title": first(24, 2), "rows": [first(24, 2)]}
        found = self.find_with(rows)
        self.assertTrue(any(x["rule"] == "text" and "one row" in x["what"] and x["k"] == 24 for x in found), found)

    def test_a_name_label_only_where_the_name_is_first_said_and_whole(self):
        A, B = word(908, 0).title(), word(908, 1).title()
        rows = film()
        rows[3]["text"] = f"The keeper was {A} {B}, a scribe."
        rows[30]["text"] = f"Later {B} left the hall."
        for k in (3, 4, 30):
            rows[k]["entities"] = [B]
        rows[4]["text"] = f"{B} kept the books."
        d = dict(DOSSIER, visualBrief={"people": [{"name": f"{A} {B}", "role": "a scribe"}]})
        ctx = {"dossier": d}
        self.assertEqual(M._name_label(rows, 3, ctx), {"headline": f"{A} {B}", "kicker": "a scribe"})
        self.assertIsNone(M._name_label(rows, 30, ctx))                        # far from where he is first named
        self.assertIsNone(M._name_label(rows, 4, ctx))                         # his surname alone, a shot later
        # (review 2026-10-13) a full name over the label's 19 letters gave no label at all: the name less its title,
        # as the line says it - never the surname alone
        rows[3]["text"], rows[3]["entities"] = f"The keeper was Father {A} {B}, a scribe.", [f"Father {A} {B}"]
        ctx = {"dossier": dict(DOSSIER, visualBrief={"people": [{"name": f"Father {A} {B}", "role": "a scribe"}]})}
        self.assertEqual(M._name_label(rows, 3, ctx), {"headline": f"{A} {B}", "kicker": "a scribe"})

    def test_a_clean_film_has_no_wording_fault(self):
        for rows in (film(), film(n=96)):
            self.assertFalse([x for x in self.find_with(rows) if x["rule"] in M._W_RULES])

    # review 2026-10-13: the negation and detail rules, through the gate
    def device_on(self, text):
        return lambda rows: next((r["device"]["id"], M._shown(r)) for r in rows
                                 if r["text"] == text and r.get("device"))

    def kept(self, rows, k):
        heard, before = copy.deepcopy(rows), copy.deepcopy(rows[k])
        self.assertFalse([(x["rule"], x["what"]) for x in self.find_with(rows) if x["rule"] in M._W_RULES])
        rec, _ = self.gate(rows, words_from=heard)
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        self.assertFalse([x for x in rec["repairs"] if x["rule"] in M._W_RULES], rec["repairs"])
        self.assertEqual((rows[k].get("device"), rows[k].get("typedCaption")),
                         (before.get("device"), before.get("typedCaption")))

    def test_a_negation_dropped_through_an_auxiliary_an_aside_or_a_verb_of_saying_is_restored(self):
        w0, w1 = word(80, 0), word(80, 1)
        cases = ((f"It was a {w0} that cannot be felt at all.", "Felt at all", "shadow-up",
                  ("shadow-up", "Cannot be felt at all")),
                 (f"He did not, in the end, keep the {w0}.", f"Keep the {w0}", "shadow-up",
                  ("P02", f"He did not, in the end, keep the {w0}")),
                 (f"He did not claim it was rare or {w0}.", f"Rare or {w0}", "shadow-up",
                  ("P02", f"He did not claim it was rare or {w0}")),
                 (f"The {w0} was not {w1} at heart.", f"The {w0} was {w1} at heart", "P02",   # Claude's summary
                  ("P02", f"The {w0} was not {w1} at heart")))
        for text, words, tid, expected in cases:
            with self.subTest(text=text):
                self.repaired(self.spoken(text, words, tid=tid), 5, "negation", self.device_on(text), expected)

    def test_no_negation_where_nothing_is_turned_round_and_no_alternative_far_away(self):
        w0, w1, w2 = word(81, 0), word(81, 1), word(81, 2)
        for text, words, tid in ((f"They found it outside the old {w0} hall.", f"The old {w0} hall", "top-title"),
                                 (f"There was no doubt the {w0} was real.", f"The {w0} was real", "shadow-up"),
                                 (f"The {w0} kept one or two {w1}s. One {w2} stayed behind.", f"One {w2} stayed behind",
                                  "shadow-up")):
            with self.subTest(text=text):
                self.kept(self.spoken(text, words, tid=tid), 5)

    def test_a_hedge_dropped_from_a_number_is_restored(self):
        text = f"Its towers outlasted the {word(82, 0)} by at least four winters."
        self.repaired(self.spoken(text, "Four winters"), 5, "detail", self.line_on(text), "At least four winters")

    def test_a_caption_number_is_read_by_value_and_a_wrong_one_takes_the_number_said(self):
        w1 = word(83, 0)
        rows = film()
        rows[29]["text"] = f"They copied over ten thousand {w1}s by hand."
        rows[29]["typedCaption"] = {"lines": [f"Over 10,000 {w1.title()}s", "Copied By Hand"],
                                    "startFrame": M.TYPED_CAPTION_START_F}       # was dropped: '000' not said
        self.kept(rows, 29)
        rows = film()
        text = f"Eleven {w1}s remained in the hall."
        rows[29]["text"] = text
        rows[29]["typedCaption"] = {"lines": [f"Twelve {w1.title()}s Remained"], "startFrame": M.TYPED_CAPTION_START_F}
        cap = lambda rows: " / ".join(next(r["typedCaption"]["lines"] for r in rows if r["text"] == text))
        self.repaired(rows, 29, "detail", cap, f"Eleven {w1.title()}s Remained")

    def test_numbers_the_recogniser_writes_in_digits_are_heard(self):
        # the subtitles carry the script's words, words_heard.json the recogniser's digits ("9th or 10th"): the detail
        # repair's own words were refused as not heard near the shot, and the century went from the screen
        text = f"They set the {word(84, 0)} in the ninth or tenth century."
        rows = self.spoken(text, "Tenth century")
        heard = copy.deepcopy(rows)
        for r in heard:
            r["text"] = r["text"].replace("ninth or tenth", "9th or 10th")
        self.assertTrue(any(x["rule"] == "detail" and x["k"] == 5 for x in self.find_with(copy.deepcopy(rows))))

        def gate():
            write_job(self.job, heard)
            voice = (self.job / "words_heard.json").read_text()      # the voice as the recogniser wrote it down,
            write_job(self.job, rows)                                 # the subtitles and the script as written
            (self.job / "words_heard.json").write_text(voice)
            eng = Eng()
            M._budget_set(eng, rows)
            return M.gate(eng, self.job, rows, DOSSIER, cues_of(rows), make_build(rows), "")
        rec = gate()
        self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
        self.assertEqual(self.line_on(text)(rows), "Ninth or tenth century")
        before = copy.deepcopy(rows)
        self.assertEqual(gate()["result"], "PASS")
        self.assertEqual(rows, before)
        self.assertTrue(M._heard_same("4th", "fourth") and M._heard_same("30", "thirty"))
        self.assertFalse(M._heard_same("1", "first") or M._heard_same("2", "second"))

    def test_a_question_is_repaired_as_a_question(self):
        K, w1 = word(85, 0).title(), word(85, 1)
        text = f"What did {K} hide from the {w1}?"
        rows = film()
        rows[5]["text"] = text
        rows[5]["device"], rows[5]["filler"] = {"id": "P09", "question": f"What did {K.lower()} hide from the {w1}?",
                                                "sectionLabel": ""}, True

        plain = make_build

        def build_q(rows_):                                          # the planner's P09: a question said as one
            base = plain(rows_)

            def build(tid, o, i):
                head = str((o or {}).get("headline") or "").strip()
                win = " ".join(rows_[j]["text"] for j in range(max(0, i - 2), min(len(rows_), i + 3)))
                if tid != "P09":
                    return base(tid, o, i)
                ok = head.endswith("?") and "?" in win and len(head) <= 51 and M._spoken_in(head, win)
                return {"id": "P09", "sectionLabel": "", "question": head} if ok else None
            return build
        question = lambda rows: next(r["device"].get("question") for r in rows if r["text"] == text)
        with mock.patch(f"{__name__}.make_build", build_q):
            self.repaired(rows, 5, "names", question, f"What did {K} hide from the {w1}?")

    # review 2026-10-13 (round phrases-names): through the gate
    def shown_near(self, rows, k):
        return [M._shown(r) for r in rows[max(0, k - 2):k + 3] if r.get("device") or r.get("typedCaption")]

    def test_a_quotation_cut_is_repaired_never_into_its_head_as_a_claim(self):
        w0, w1 = word(99, 0), word(99, 1)
        text = f'The {w0} "not plenty for the {w1} hall" had stood there for years.'
        rows = self.spoken(text, "Not plenty")
        heard = copy.deepcopy(rows)
        self.assertTrue(any(x["rule"] == "cut off" and x["k"] == 5 for x in self.find_with(rows)))
        rec, _ = self.gate(rows, words_from=heard)
        self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
        self.assertFalse([t for t in self.shown_near(rows, 5) if "plenty" in t.lower() and f'{w1} hall"' not in t],
                         self.shown_near(rows, 5))
        self.assertEqual(self.gate(rows, words_from=heard)[0]["result"], "PASS")

    def test_a_running_title_before_a_name_never_takes_the_month_as_its_name(self):
        A, w0 = word(100, 0).title(), word(100, 1)
        text = f"In March {A} fell to the {w0}s."
        rows = self.spoken(text, "In March", tid="top-title")
        heard = copy.deepcopy(rows)
        self.assertFalse([x for x in self.find_with(rows) if x["rule"] == "names" and x["k"] == 5])
        self.gate(rows, words_from=heard)
        self.assertFalse([t for t in self.shown_near(rows, 5) if f"March {A}" in t], self.shown_near(rows, 5))

    def test_a_cut_over_its_limit_never_stops_on_would_never_or_not(self):
        w0 = word(101, 0)
        text = f"They said the {w0} would hold for ever."
        rows = film()
        rows[24]["text"] = text
        rows[24]["device"]["headline"] = f"The {w0} would never break"         # a summary, over P05's 25 letters
        heard = copy.deepcopy(rows)
        rec, _ = self.gate(rows, words_from=heard)
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        head = next((r["device"] or {}).get("headline", "") for r in rows if r["text"] == text)
        self.assertLessEqual(len(head), 25)
        self.assertFalse(head and M._lw(head.split()[-1]) in M._END_NEVER, head)
        before = copy.deepcopy(rows)
        self.assertEqual(self.gate(rows, words_from=heard)[0]["result"], "PASS")
        self.assertEqual(rows, before)

    def test_a_quiet_stretch_filler_cuts_no_name_of_the_film(self):
        A, B, C = (word(102, j).title() for j in range(3))
        rows = film(texts=False)
        for r in rows:
            r["text"] = f"He worked under {A} {B} {C} permission on a ledger."
        build = make_build(rows)
        got = M.fill_gaps_plain(Eng(), rows, build, names=[f"{A} {B} {C}"])
        shown = [M._shown(r) for r in rows if id(r) in got]
        self.assertTrue(shown)
        self.assertFalse([t for t in shown if t.startswith((f"{B} {C} permission", f"{C} permission"))], shown)


class Kept(Base):
    """Review 2026-10-13 (round 4), through the gate: good texts the rules refused stay as written (a clause before its
    adjunct, a name between commas, a hedge with its number, a whole quotation, a "no" in a verb phrase of its own, a
    number said another way, a place said before a name), and a fronted negative is never repaired away. Made-up words."""
    find_with, spoken, kept = Wording.find_with, Wording.spoken, Wording.kept

    def test_good_texts_the_rules_refused_stay_as_written(self):
        w0, w1, A, B = word(960, 0), word(960, 1), word(960, 2).title(), word(960, 3).title()
        for text, words, tid in ((f"The {w0} {w1} was sealed in the winter.", f"The {w0} {w1} was sealed", "shadow-up"),
                                 (f"The abbot, {A} {B}, sealed the {w0}.", f"{A} {B}", "shadow-up"),
                                 (f"The {w0} was shut for almost two centuries.", "Almost two centuries", "P05"),
                                 (f'The sign "not for {w0}s" hung in the hall.', f'"Not for {w0}s"', "shadow-up"),
                                 (f"They had no {w1} and sealed the {w0}.", f"Sealed the {w0}", "shadow-up"),
                                 (f"In {A} {B} fell to the {w0}s at night.", f"{B} fell to the {w0}s", "shadow-up")):
            with self.subTest(text=text):
                self.kept(self.spoken(text, words, tid=tid), 5)
        rows = film()                                # (its typing starts on the words heard: 'twelve' is not)
        rows[29]["text"] = f"A dozen {w0}s stayed behind."
        rows[29]["typedCaption"] = {"lines": [f"Twelve {w0.title()}s Stayed"], "startFrame": M.TYPED_CAPTION_START_F}
        self.assertFalse([x for x in self.find_with(rows) if x["rule"] in M._W_RULES])
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertFalse([x for x in rec["repairs"] if x["rule"] in M._W_RULES], rec["repairs"])
        self.assertEqual(rows[29]["typedCaption"]["lines"], [f"Twelve {w0.title()}s Stayed"])

    def test_a_fronted_negative_is_never_repaired_away(self):
        # 'Would the abbot open the vault' of 'Under no circumstances would ...': repaired to 'Abbot open', which drops
        # the negation and stops before its object - logged as a negation repair
        w0 = word(961, 0)
        text = f"Under no circumstances would the abbot open the {w0}."
        rows = self.spoken(text, f"Would the abbot open the {w0}")
        self.assertTrue(any(x["rule"] == "negation" and x["k"] == 5 for x in self.find_with(rows)))
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        shown = [M._shown(r) for r in rows[3:8] if r.get("device")]
        self.assertFalse([t for t in shown if M._spoken_in(t, text) and (not re.search(r"\bno\b", t.lower())
                                                                         or len(t.split()) < 4)], shown)


class WordingFlow(Base):
    """The wording repair inside the gate (review 2026-10-13): what nothing can change stays with a warning, never a
    repair logged every round; a drop's warning reaches gate.json and the log; a drop never leaves a stretch the quiet
    rule would stop on, and the stretch it opens gets a line of its own; a one-row list takes the same steps; a move
    never covers a beat overlay. Made-up words."""
    find_with = Wording.find_with

    def flagged(self, rows, k, rule, dossier=DOSSIER):
        found = self.find_with(rows, dossier)
        self.assertTrue(any(x["rule"] == rule and x["k"] == k for x in found),
                        [(x["rule"], x["k"], x["what"]) for x in found])

    def stuck_line(self, rows, k, line):
        """Shot k carries a running title the wording rules flag ('If we went' of a condition), whose own line has no
        phrase that reads whole and fits."""
        rows[k]["text"] = "If we went and if we stayed and if we left, it was so."
        rows[k]["device"], rows[k]["filler"] = {"id": "top-title", "line1": line, "line2": ""}, True

    def test_what_nothing_whole_can_replace_stays_with_a_warning_never_a_repair(self):
        # a heading cut from a longer one with no other section title to take; an opening kicker that is a whole part
        # of the setting where the narration names it longer: 'kept' was logged as a repair in every round, the film
        # re-cut each time, and a second gate said REPAIRED on rows it left as they were. (A heading cut before its
        # verb's object, from an older plan; a name the narrator goes on with too long for the kicker.)
        A, B, C, P, Q = (word(910, j).title() for j in range(5))
        chapter = film()
        chapter[14]["_cut_from"] = f"How the {A} Kept the {B} {C} Hidden"
        chapter[14]["device"]["heading"] = f"How the {A} Kept"
        self.assertEqual(M._short_heading(chapter[14]["_cut_from"], 25), "")     # nothing whole of it fits
        setting = dict(DOSSIER, setting=P)
        kicker = film()
        kicker[0]["device"] = M._auto_title(setting, "")
        kicker[0]["text"] = f"Near the {P} {Q} {A} {B} the keepers met."
        for rows, k, rule, d in ((chapter, 14, "cut off", dict(DOSSIER, sections=DOSSIER["sections"][:1])),
                                 (kicker, 0, "names", setting)):
            with self.subTest(rule=rule):
                self.flagged(rows, k, rule, d)
                heard, before = copy.deepcopy(rows), copy.deepcopy(rows)
                with mock.patch.object(M, "_recut", wraps=M._recut) as recut:
                    rec, eng = self.gate(rows, words_from=heard, dossier=d)
                self.assertEqual((rec["result"], rec["repairs"], recut.call_count), ("PASS", [], 0))
                self.assertEqual(rows, before)
                left = [w for w in rec["warnings"] if w.startswith(f"{rule}: ")]
                self.assertTrue(left and "left as it is after every repair (no whole" in left[0], rec["warnings"])
                self.assertIn(f"  ⚠ pre-render gate: {left[0]}", eng.lines)
                again, _ = self.gate(rows, words_from=heard, dossier=d)
                self.assertEqual((again["result"], again["repairs"], rows == before), ("PASS", [], True))

    def test_a_drop_reaches_gate_json_and_the_log_as_a_warning(self):
        # the drop's warning went to the list the next look empties: neither gate.json nor plan.log had it
        w0, w1 = word(912, 0), word(912, 1)
        caption = film()
        caption[29]["text"] = f"There were 31 {w0}s in the {w1} hall."      # a number not said, and none said beside
        caption[29]["typedCaption"] = {"lines": [f"Thirty Halls Of {w0.title()}s"],   # its words to take its place
                                       "startFrame": M.TYPED_CAPTION_START_F}
        spoken = film()
        spoken[5]["text"] = f"The {w0} was not {w1} at heart."
        spoken[5]["device"], spoken[5]["filler"] = {"id": "shadow-up", "line": f"{w1.title()} at heart"}, True
        for rows, k, rule, kind in ((caption, 29, "detail", "typed caption"), (spoken, 5, "negation", "shadow-up")):
            with self.subTest(kind=kind), mock.patch.object(M, "_try_text", lambda *a, **kw: False), \
                    mock.patch.object(M, "_try_template", lambda *a, **kw: False):
                self.flagged(rows, k, rule)
                rec, eng = self.gate(rows, words_from=copy.deepcopy(rows))
                self.assertTrue(any(x["rule"] == rule and "dropped" in x["fix"] for x in rec["repairs"]), rec["repairs"])
                warned = [w for w in rec["warnings"] if w.startswith(f"{kind} '") and "dropped" in w]
                self.assertTrue(warned, rec["warnings"])
                self.assertIn(f"  ⚠ pre-render gate: {warned[0]}", eng.lines)
                self.assertIn(warned[0], json.loads((self.job / "mrtruth" / "gate.json").read_text())["warnings"])

    def test_a_drop_never_stops_the_film_on_a_quiet_stretch(self):
        # the only words of 22-60 s, broken, and no other line there with a phrase: dropping them stopped the film
        rows = film()
        for k in (6, 7, 8, 9, 11, 12, 13):
            rows[k]["text"] = "It was so."
        self.stuck_line(rows, 10, "If we went")
        self.flagged(rows, 10, "cut off")
        rec, eng = self.gate(rows, words_from=copy.deepcopy(rows))   # MRTRUTH_ALLOW_DEGRADED=0: a stop raises
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertEqual(rows[10]["device"]["line1"], "If we went")    # kept, with a warning
        self.assertFalse(M._gaps(rows, True))
        self.assertTrue(any(w.startswith("cut off: ") and "without words" in w for w in rec["warnings"]), rec["warnings"])
        self.assertFalse(any("stopped before drawing" in l for l in eng.lines))

    def test_the_stretch_a_drop_opens_gets_a_line_of_its_own(self):
        # nothing within two shots can carry it; three shots on, inside the stretch, a line can: the drop left 26 s
        # without words, under the quiet rule's 30 s, and nothing refilled it
        rows = film()
        rows[8]["device"] = {"id": "P02", "headline": first(8, 2), "label": ""}
        for k in (9, 11, 12):
            rows[k]["text"] = "It was so."
        self.stuck_line(rows, 10, "If we went")
        heard = copy.deepcopy(rows)
        rec, _ = self.gate(rows, words_from=heard)
        self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
        self.assertTrue(any(x["rule"] == "cut off" and "set at" in x["fix"] for x in rec["repairs"]), rec["repairs"])
        on8 = rows[8]["startMs"]
        on14 = next(r["startMs"] for r in rows if (r.get("device") or {}).get("id") == "chapter-plate" and r["startMs"] > on8)
        self.assertEqual(len([t for t in M._text_times(rows, True) if on8 < t < on14]), 1)     # a line in the stretch
        self.assertFalse(rows[10].get("device"))
        again, _ = self.gate(rows, words_from=heard)
        self.assertEqual(again["result"], "PASS", again["first_look"])

    def test_a_one_row_list_takes_the_wording_steps_before_it_goes(self):
        # a one-row list went straight to a plain photo: no re-set on its shot, 43 s without words until the quiet rule
        rows = film()
        rows[24]["device"] = {"id": "bullet-checklist", "title": first(24, 2), "rows": [word(24, 2).title()]}
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
        fix = next(x["fix"] for x in rec["repairs"] if x["rule"] == "text" and "one row" in x["what"])
        self.assertTrue(fix.startswith("re-set as"), fix)
        dev = rows[24]["device"]
        self.assertIn(dev["id"], M.GAP_FILLER_TEMPLATES)
        self.assertNotEqual(dev["id"], "bullet-checklist")
        self.assertEqual(dev[M._MAIN[dev["id"]]], first(24, 2))
        self.assertFalse(any(x["rule"] == "quiet" for x in rec["repairs"]))

    def test_a_move_or_a_refill_never_covers_a_beat_overlay(self):
        # shot 5 cannot carry its line again (no picture), shots 3, 4 and 7 are taken: the move went onto shot 6,
        # whose beat overlay the renderer then never drew
        w0, w1 = word(913, 0), word(913, 1)
        rows = film()
        for k in (3, 4, 7):
            rows[k]["device"] = {"id": "P08"}
        rows[5].update(text=f"The {w0} was not kept in the {w1} hall.", filler=True, pick=None, spare=[],
                       device={"id": "shadow-up", "line": f"Kept in the {w1} hall"})
        rows[6]["overlay"] = {"text": first(6, 1)}
        self.flagged(rows, 5, "negation")
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertEqual(rows[6].get("overlay"), {"text": first(6, 1)})
        self.assertFalse([k for k, r in enumerate(rows) if r.get("overlay") and r.get("device")])


class Held(Base):
    """Review 2026-10-13 (round 4): the wording code leaves the highlighted pages, the maps, the dates and the year plates
    as the published code does - their words matched as they always were, their frames unmoved by a repair a few shots
    away and the re-cut after it - covers no beat overlay where the re-sync seats its words, and a move never stops a film
    on the quiet rule. Made-up words."""
    HELD = ("highlight-page", "P12", "P14") + M.SPOT_DEVICES

    def test_a_date_a_year_plate_and_a_pages_neighbour_match_their_words_as_they_always_did(self):
        # the recogniser heard 'fourth' and 'century'; matched by number too, the date, the year plate and the line a
        # page is placed clear of were pinned on 'fourth', and the gate read a date set there as on its words
        heard = [(11000, "in"), (11500, "fourth"), (11900, "century")]
        ctx = {"heard": heard, "heard_ms": [m for m, _ in heard]}
        for dev in ({"id": "date-stamp", "date": "4th century", "year": ""}, {"id": "P12", "year": "4th century"},
                    {"id": "top-title", "line1": "4th century", "line2": ""}):
            r = {"startMs": 10000, "endMs": 14000, "text": "", "device": dev}
            self.assertEqual(M._said_at(r, heard, 0, 30000), 11900, dev)
            self.assertEqual(M._words_near(M._overlay_words(r), ctx, 11500), 11900, dev)
            self.assertEqual(M._hl_pin([{"startMs": 0}, r], r, heard), 11900 - M._lead_ms(r), dev)
            # words the wording repair wrote are heard where the recogniser wrote their number (its own repairs only)
            self.assertEqual(M._said_at(dict(r, _worded=True), heard, 0, 30000), 11500, dev)

    def map_and_date_film(self):
        """film() with a map on shot 7 (on its plate, 6.6 s) and a date on shot 20, as places_and_dates sets them."""
        rows = film()
        plate = {"photo": str(S.plate_for("coast")), "provider": "map", "tier": 3, "clean": True, "bad": []}
        rows[7]["endMs"] = rows[8]["endMs"] - 2000
        rows[8]["startMs"] = rows[7]["endMs"]
        rows[7].update(device={"id": "location-map", "label": "Pell Ridge"}, pick=plate, text="Pell Ridge " + rows[7]["text"])
        rows[20].update(device={"id": "date-stamp", "date": "Winter", "year": "1941"}, text="Winter 1941 " + rows[20]["text"])
        return rows

    def held_after(self, rows, wording=True):
        """The gate on rows synced twice first, as the planner leaves a film; wording=False: with no wording fault
        found. (result, the frames of every page, map, date and year plate)."""
        write_job(self.job, rows)
        eng, cues = Eng(), cues_of(rows)
        for _ in range(2):
            M.sync_overlays(eng, self.job, rows, cues)
        find = M._gate_find
        plain = lambda rows_, ctx: [x for x in find(rows_, ctx) if x["rule"] not in M._W_RULES]
        with mock.patch.object(M, "_gate_find", find if wording else plain):
            M._budget_set(eng, rows)
            rec = M.gate(eng, self.job, rows, DOSSIER, cues, make_build(rows), "")
        return rec, [(r["device"]["id"], r["startMs"], r["endMs"]) for r in rows
                     if (r.get("device") or {}).get("id") in self.HELD]

    def test_a_repair_two_shots_from_a_date_moves_none_of_its_frames(self):
        # a typed caption two shots after the date and a running title three after, both cut: their re-worded words were
        # pinned earlier in their lines, and the re-cut ended the date 0.85 s sooner
        def broken():
            rows = self.map_and_date_film()
            rows[22]["typedCaption"] = {"lines": [f"{word(22, 1).title()} Saw The"], "startFrame": M.TYPED_CAPTION_START_F}
            rows[23]["device"], rows[23]["filler"] = {"id": "top-title", "line1": f"{word(23, 1).title()} saw",
                                                      "line2": ""}, True
            return rows
        base, want = self.held_after(broken(), wording=False)
        rec, got = self.held_after(broken())
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        self.assertEqual(got, want)
        self.assertEqual(len(got), 2)

    def test_where_the_re_sync_seats_new_words_covers_no_beat_overlay(self):
        # a spoken line cut, nothing whole on its shot: it moved to the shot before, with words said on the overlay's
        # shot - the re-sync seated it there, over the beat overlay, which then was never drawn
        rows = film()
        rows[8]["overlay"] = {"text": word(8, 0).title()}
        WordingFlow.stuck_line(self, rows, 10, "If we went")
        rows[10]["device"] = {"id": "shadow-up", "line": "If we went"}
        for k in (11, 12):
            rows[k]["text"] = "It was so."
        for r in rows:                                   # as after the planner's sync
            r["_said"] = (r["startMs"], r["endMs"])
            if r.get("device") or r.get("typedCaption"):
                r["_seated"] = True
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertEqual(rows[8].get("overlay"), {"text": word(8, 0).title()})
        self.assertFalse([k for k, r in enumerate(rows) if r.get("overlay") and r.get("device")])

    def test_a_move_never_opens_a_stretch_the_quiet_rule_stops_on(self):
        # the only words of 17-52 s, cut, moved to the shot after the stretch: 34 s without words, and the film stopped
        rows = film()
        rows[4]["device"], rows[5]["device"] = {"id": "shadow-up", "line": first(4, 2)}, None
        for k in (5, 6, 7, 8, 9, 11):
            rows[k]["text"] = "It was so."
        WordingFlow.stuck_line(self, rows, 10, "If we went")
        self.assertFalse(M._gaps(rows, True))
        rec, eng = self.gate(rows, words_from=copy.deepcopy(rows))        # MRTRUTH_ALLOW_DEGRADED=0: a stop raises
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        self.assertFalse(M._gaps(rows, True))
        self.assertFalse(any("stopped before drawing" in l for l in eng.lines))


class Fields(Base):
    """Review 2026-10-13 (round 4): a running title's two lines read as the one title the renderer types, a second
    line never repeats the first, a whole chapter heading is read only against what it was made from, a text of one
    word is a noun, a name or a number. Made-up words."""
    find_with = Wording.find_with

    def wording_at(self, rows, k, dossier=DOSSIER):
        return [(x["rule"], x["what"]) for x in self.find_with(rows, dossier) if x["k"] == k
                and (x["rule"] in M._W_RULES or x["rule"] == "text")]

    def test_a_running_title_whose_two_lines_make_one_sentence_is_left_whole(self):
        # 'It Keeps' / 'W' of 'It keeps W.': line one alone stops on its verb, and the title was dropped or set again
        # with its object twice ('It keeps W' / 'W')
        w = word(930, 0)
        rows = film()
        rows[10].update(text=f"It keeps {w}.", device={"id": "top-title", "line1": "It Keeps", "line2": w.title()})
        self.assertEqual(self.wording_at(rows, 10), [])
        before = copy.deepcopy(rows[10]["device"])
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        self.assertEqual(rows[10]["device"], before)

    def test_a_second_line_never_repeats_the_words_of_the_first(self):
        # 'A Different W' / 'W Began': the second line was repaired to 'Different w', the same two words twice
        w0, w1 = word(931, 0), word(931, 1)
        rows = film()
        rows[10].update(text=f"The {w0} ended. A different {w1} began.",
                        device={"id": "top-title", "line1": f"A Different {w1.title()}", "line2": f"{w1.title()} Began"})
        self.assertTrue(self.wording_at(rows, 10))
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        dev = rows[10]["device"]
        self.assertEqual((dev["id"], dev["line1"], dev["line2"]), ("top-title", f"A Different {w1.title()}", ""))

    def test_a_repaired_field_shares_no_word_with_the_other_field_in_any_form(self):
        # 'Not W' / 'Not as W' and 'A W' / 'The Ws were sealed': a repair made the two fields of one template say the
        # same word twice
        w0, w2 = word(976, 0), word(976, 2)
        for tid, f, other in (("top-title", "line2", {"line1": f"The {w0.title()}s Were Sealed"}),
                              ("P02", "label", {"headline": f"The {w0}s were sealed"}),
                              ("P05", "eyebrow", {"headline": f"The {w0}s were sealed"}),
                              ("two-photo-zoom", "right", {"left": f"The {w0}s were sealed"})):
            rows = film()
            rows[10].update(text=f"The {w0}s were sealed. A {w0} sat. The {w2} stood.",
                            device=dict({"id": tid, "line1": "", "line2": "", "headline": "", "label": "",
                                         "eyebrow": "", "supportLine": "", "imageLabel": ""}, **other))
            _, ctx = self.find(rows)
            self.assertFalse(M._try_text(rows, 10, tid, f, None, f"A {w0} sat", ctx, None, "statement"), tid)
            self.assertTrue(M._try_text(rows, 10, tid, f, None, f"The {w2} stood", ctx, None, "statement"), tid)

    def test_a_summary_that_drops_its_negation_is_repaired_never_stopped(self):
        w0, w1, w2 = word(977, 0), word(977, 1), word(977, 2)
        text = f"The {w2} had not said the {w0} was {w1}."
        rows = Wording.spoken(self, text, f"Not {w0} {w1}")
        self.assertIn("negation", [r for r, _ in self.wording_at(rows, 5)])
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        self.assertFalse([r for r in rows if (r.get("device") or {}).get("line") == f"Not {w0} {w1}"])
        self.assertFalse([x for x in self.find(rows)[0] if x["rule"] in M._W_RULES])

    def test_a_list_whose_rows_drop_their_negation_keeps_its_title_as_a_line(self):
        # 'A smaller W' / 'Not W1' / 'Not W3' of 'had not said ... was W1. It had not said it was W3.': the rows were
        # dropped with the list, and the lines set in the stretch it left took the room of other repairs
        w0, w1, w2, w3, w4 = (word(978, j) for j in range(5))
        rows = film()
        rows[10].update(text=f"The {w2} had not said the {w0} was {w1}. It had not said it was {w3}. That is a "
                             f"smaller {w4}.", device={"id": "bullet-checklist", "title": f"A smaller {w4}",
                                                       "rows": [f"Not {w1}", f"Not {w3}"]})
        self.assertIn("negation", [r for r, _ in self.wording_at(rows, 10)])
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        self.assertTrue([r for r in rows if M._dev_text(r.get("device") or {}) == f"A smaller {w4}"])
        self.assertFalse([r for r in rows if (r.get("device") or {}).get("id") == "bullet-checklist"])
        self.assertFalse([x for x in self.find(rows)[0] if x["rule"] in M._W_RULES])

    def test_a_whole_chapter_heading_is_read_only_against_what_it_was_made_from(self):
        # the chapter shows section 1's whole title, which another section's title goes on from: it was read as cut
        # from that one and replaced with an unrelated section's title
        A, B, C, D, E, F, G = [word(932, j).title() for j in range(5)] + [word(933, 0).title(), word(933, 1).title()]
        d = dict(DOSSIER, sections=[{"title": TITLE}, {"title": f"{A} {B}"}, {"title": f"{A} {B} and the {C} Ledger"},
                                    {"title": f"{D} {E}"}, {"title": f"{F} {G}"}])
        rows = film()
        rows[14]["device"]["heading"] = f"{A} {B}"
        self.assertEqual(self.wording_at(rows, 14, d), [])
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows), dossier=d)
        self.assertEqual(rows[14]["device"]["heading"], f"{A} {B}")
        self.assertFalse([w for w in rec["warnings"] if f"'{A} {B}'" in w], rec["warnings"])
        rows[14]["device"]["heading"] = f"How the {A} Hid"                       # a cut of a section title still is
        d["sections"][3] = {"title": f"How the {A} Hid the {D} Ledgers"}
        self.assertTrue([r for r, _ in self.wording_at(rows, 14, d) if r == "cut off"])

    def test_a_text_of_one_word_is_a_noun_a_name_or_a_number(self):
        w0, w1, w2 = word(935, 0), word(935, 1), word(935, 2)
        for one, line_ in (("Never", f"The {w0} would never open the {w1}."), ("Would", f"The {w0} would never open the {w1}."),
                           ("Saw", f"The {w0} {w1} saw the {w2}."), ("The", f"The {w0} {w1} saw the {w2}.")):
            self.assertIn("cut off", [r for r, _, _ in M._wording(one, line_)], one)
            self.assertFalse(M._phrase_ok(one, line_), one)
        for one, line_ in ((w2.title(), f"The {w0} used the name {w2} nearly every day."), ("Ostrel", f"He sailed to Ostrel."),
                           ("1842", f"It was 1842 when the {w0} fell.")):
            self.assertEqual(M._wording(one, line_), [], one)
        rows = Wording.spoken(self, f"The {w0} {w1} saw the {w2}.", "Saw")
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows))
        self.assertTrue(any(x["rule"] == "cut off" for x in rec["repairs"]), rec["repairs"])
        self.assertFalse([r for r in rows if (r.get("device") or {}).get("line") == "Saw"])


class TitleFlow(Base):
    """The titles in the gate (review 2026-10-13): the producer and the gate read the opening kicker against the same
    narration; a whole heading is never replaced, a broken one takes its own section's title, never a near copy of
    another heading, and starts with a capital; the name-label group can still be filled where a name is first said.
    Made-up words."""
    find_with = Wording.find_with

    def kicker_film(self):
        P, Q = word(920, 0).title(), word(920, 1).title()
        rows = film()
        rows[0]["text"] = f"Near the {P} {Q} the keepers met."
        return P, Q, dict(DOSSIER, setting=f"{P}, far away"), rows

    def test_the_kicker_the_producer_sets_passes_the_gate_as_it_is(self):
        P, Q, d, rows = self.kicker_film()
        said = M._said_around(rows, 0, {"cues": cues_of(rows)})
        rows[0]["device"] = M._auto_title(d, "", said, M._film_names(d, " ".join(r["text"] for r in rows)))
        self.assertEqual(rows[0]["device"]["kicker"], f"{P} {Q}")
        before = copy.deepcopy(rows)
        rec, _ = self.gate(rows, words_from=copy.deepcopy(rows), dossier=d)
        self.assertEqual((rec["result"], rec["repairs"], rows == before), ("PASS", [], True), rec["first_look"])

    def test_a_kicker_the_gate_flags_is_made_whole_in_one_round(self):
        # an older plan's kicker, read against the setting only: 'kept' with a warning in every gate before
        P, Q, d, rows = self.kicker_film()
        rows[0]["device"] = M._auto_title(d, "")
        self.assertEqual(rows[0]["device"]["kicker"], P)
        heard = copy.deepcopy(rows)
        rec, _ = self.gate(rows, words_from=heard, dossier=d)
        self.assertEqual((rec["result"], rec["rounds"]), ("REPAIRED", 1), rec.get("left"))
        self.assertEqual(rows[0]["device"]["kicker"], f"{P} {Q}")
        before = copy.deepcopy(rows)
        again, _ = self.gate(rows, words_from=heard, dossier=d)
        self.assertEqual((again["result"], again["repairs"], rows == before), ("PASS", [], True))

    def test_a_whole_heading_that_ends_on_a_noun_like_an_adjective_is_left_alone(self):
        rows = film()
        rows[33]["device"]["heading"] = "The Heretic"
        before = copy.deepcopy(rows)
        rec, _ = self.gate(rows)
        self.assertEqual((rec["result"], rows == before), ("PASS", True), rec["first_look"])

    def sections(self, rows, at):
        """Section titles of made-up words, each starting at its shot's first word in the script (startChar)."""
        start = lambda k: len(" ".join(r["text"] for r in rows[:k])) + (1 if k else 0)
        return [{"title": t, "startChar": start(k)} for t, k in at]

    def test_a_broken_heading_takes_its_own_sections_title_never_a_near_copy(self):
        # the repair took the first unused section title in the dossier's order: chapter 2 showed section 1's title,
        # wrong for its place and nearly the heading chapter 1 already showed
        A, B, C, D, E, F, G = [word(925, j).title() for j in range(5)] + [word(926, 0).title(), word(926, 1).title()]
        for ch1, want in ((f"{B} {C}", f"{F} {G}"), (f"{F} {B}", f"{D} {E}")):
            with self.subTest(chapter1=ch1):
                rows = film()
                d = dict(DOSSIER, sections=self.sections(rows, [(TITLE, 0), (f"{A} {B} {C}", 14), (f"{D} {E}", 24),
                                                                (f"{F} {G}", 33)]))
                rows[14]["device"]["heading"] = ch1
                rows[33]["device"]["heading"] = f"The {A}'s Narrow"             # stops on its adjective
                self.assertTrue([x for x in self.find_with(rows, d) if x["rule"] == "cut off" and x["k"] == 33])
                rec, _ = self.gate(rows, dossier=d)
                self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
                self.assertEqual(rows[33]["device"]["heading"], want)

    def test_a_heading_from_a_sentence_case_title_starts_with_a_capital(self):
        w = word(927, 0)
        rows = film()
        d = dict(DOSSIER, sections=[DOSSIER["sections"][0], {"title": f"The {w}'s narrow vantle"}, DOSSIER["sections"][2]])
        rows[14]["device"]["heading"] = f"The {w.title()}'s Narrow"
        rec, _ = self.gate(rows, dossier=d)
        self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
        self.assertEqual(rows[14]["device"]["heading"], f"{w.title()}'s narrow vantle")

    def test_the_name_label_group_takes_a_running_title_set_where_the_name_is_first_said(self):
        # every name label was gone, the name is said once, on a shot that carries a running title: the group stayed
        # empty with a warning (a bare surname far from where the name was first said is never the answer)
        A, B = word(928, 0).title(), word(928, 1).title()
        d = dict(DOSSIER, visualBrief={"people": [{"name": f"Father {A} {B}", "role": "a scribe"}]})
        rows = film()
        rows[19]["device"] = None
        rows[3].update(text=f"The keeper was Father {A} {B}, a scribe.", entities=[f"Father {A} {B}"],
                       pick=pic("r3", tier=M.EXACT), device={"id": "top-title", "line1": f"{A} {B}", "line2": ""})
        rec, _ = self.gate(rows, dossier=d)
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertEqual((rows[3]["device"]["id"], rows[3]["device"]["mainLine"]), ("P04", f"{A} {B}"))
        self.assertTrue(any(x["rule"] == "groups" and "P04" in x["fix"] for x in rec["repairs"]), rec["repairs"])
        self.assertFalse([w for w in rec["warnings"] if w.startswith("name label not used")])
        self.assertGreaterEqual(sum(1 for r in rows if (r.get("device") or {}).get("id") == "top-title"), 1)


class Frames(Base):
    def test_double_text_clears_the_beat_overlay(self):
        rows = film()
        rows[29]["overlay"] = {"text": first(29, 2), "kind": "name", "style": "fullFrame"}
        found, _ = self.find(rows)
        self.assertEqual([x["k"] for x in found if x["rule"] == "double text"], [29])
        rec, _ = self.gate(rows)
        self.assertFalse(rows[29].get("overlay"))
        self.assertTrue(rows[29].get("typedCaption"))

    def test_the_same_words_twice_within_a_minute_drop_the_lesser(self):
        rows = film()
        rows[31]["device"] = {"id": "shadow-up", "line": first(29, 2)}    # the caption's words 8.6 s later, again
        rows[31]["text"] = line(29)
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "same words" and x["k"] == 31 for x in found))
        rec, _ = self.gate(rows)
        self.assertTrue(rows[29].get("typedCaption"))
        self.assertFalse(any((r.get("device") or {}).get("line") == first(29, 2) for r in rows))


class Labels(Base):
    store = "on"

    def test_a_no_swaps_to_the_runner_up_that_shows_it(self):
        rows = film()
        lab = rows[19]["device"]["mainLine"]
        rec, eng = self.gate(rows, Eng(no=[f"{lab}@r19"]))
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertEqual(rows[19]["pick"]["photo"], "/p/s19a.jpg")
        self.assertEqual(rows[19]["device"]["id"], "P04")
        self.assertEqual(len(eng.calls), 1)                          # the runner-up was asked in the same call

    def test_a_no_with_no_runner_up_resets_the_words_as_a_line_that_names_nothing(self):
        rows = film()
        lab = rows[19]["device"]["mainLine"]
        rec, eng = self.gate(rows, Eng(no=[lab]))
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertNotIn(rows[19]["device"]["id"] if rows[19]["device"] else "", M.NAMES_PICTURE)
        self.assertFalse(any(M._label_of(r.get("device")).lower() == lab.lower() for r in rows))

    def test_a_failed_look_keeps_a_label_only_on_the_judges_exact_answer(self):
        rows = film()
        rows[19]["entities"] = [rows[19]["device"]["mainLine"]]
        rec, eng = self.gate(rows, Eng(broken=True))
        self.assertEqual(rows[19]["device"]["id"], "P04")             # exact for a line that names it: kept
        self.assertTrue(rec["kept_on_exact"])
        rows = film()
        rows[19]["pick"] = pic("r19")                                 # only kind: the safe repair
        M.VERDICTS["store"] = None
        rec, eng = self.gate(rows, Eng(broken=True))
        self.assertNotEqual((rows[19].get("device") or {}).get("id"), "P04")

    def test_card_answers_are_kept_in_the_store_and_read_back(self):
        rows = film()
        self.gate(rows)
        M.VERDICTS["store"] = None
        rows2 = film()
        rec, eng = self.gate(rows2, Eng())
        self.assertEqual(len(eng.calls), 0)
        self.assertEqual(rec["card_check"]["how"], {"stored": 1})


class Groups(Base):
    def test_a_group_over_its_cap_is_reset_or_thinned(self):
        rows = film()
        for k in (2, 7, 12, 17, 22, 27):                              # spoken lines 2 + 6 = 8, the cap for 3.4 min is 4
            rows[k]["device"] = {"id": "shadow-up", "line": first(k, 2)}
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "groups" and x.get("over") for x in found))
        rec, _ = self.gate(rows)
        n = sum(1 for r in rows if (r.get("device") or {}).get("id") == "shadow-up")
        self.assertLessEqual(n, M._group_cap(rows, "spoken line"))
        self.assertEqual(rec["result"], "REPAIRED")

    def test_a_group_under_its_minimum_gets_one_or_is_warned(self):
        rows = film()
        rows[10]["device"] = None                                     # no running title
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "groups" and x.get("under") for x in found))
        rec, _ = self.gate(rows)
        self.assertGreaterEqual(sum(1 for r in rows if (r.get("device") or {}).get("id") == "top-title"), 1)
        rows = film()
        rows[24]["device"] = None                                     # no compare / list (its words a caption now),
        rows[24]["typedCaption"] = {"lines": [first(24, 2)], "startFrame": M.TYPED_CAPTION_START_F}   # and no shot
        with mock.patch.object(M, "_spoken_phrase", lambda *a, **k: ""):                             # can carry one
            rec, eng = self.gate(rows)
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertIn("compare / list", rec["soft"])
        self.assertTrue(any("not used" in l for l in eng.lines))


class Words(Base):
    def test_an_overlay_off_its_words_is_resynced(self):
        rows = film()
        heard = film()
        rows[38]["device"] = {"id": "shadow-up", "line": first(39, 2)}  # words said on the next shot, 4.3 s later
        found, _ = self.find(rows, words_from=heard)
        self.assertTrue(any(x["rule"] == "words" and x["k"] == 38 for x in found), found)
        rec, _ = self.gate(rows, words_from=heard)
        self.assertEqual(rec["result"], "REPAIRED")
        k = next(k for k, r in enumerate(rows) if (r.get("device") or {}).get("line") == first(39, 2))
        self.assertLessEqual(abs(rows[k]["startMs"] - (39 * 4300 - M.SYNC_LEAD_MS)), M.SYNC_TOLERANCE_MS)

    def test_words_not_heard_anywhere_drop_after_a_resync(self):
        rows = film()
        rows[38]["device"] = {"id": "shadow-up", "line": "Zzyzx Qwerty"}
        rows[38]["text"] = rows[38]["text"][:-1] + " zzyzx qwerty."
        heard = film()
        rec, _ = self.gate(rows, words_from=heard)
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertFalse(any((r.get("device") or {}).get("line") == "Zzyzx Qwerty" for r in rows))

    def test_a_quiet_stretch_gets_a_line_of_its_own_narration(self):
        rows = film()
        for k in (24, 29):                                            # 81.7 s -> 141.9 s with no words
            rows[k]["device"] = None
            rows[k].pop("typedCaption", None)
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "quiet" for x in found))
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertFalse(M._gaps(rows))
        self.assertTrue(any(r.get("filler") for r in rows))

    def test_a_filler_the_fit_step_takes_back_gives_way_to_the_next_free_shot_in_the_same_round(self):
        # impl-z (2026-10-11): on the -long film the one filler of a 32 s stretch (a P05 naming a person over a picture
        # with none) was set and taken back in every round, the repair said done, and the film stopped after five
        rows = film()
        rows[29].pop("typedCaption", None)                            # 103-142 s: one filler's worth of quiet
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "quiet" for x in found))
        real_fit, said_no, bad = M._fit_devices, [], []

        def fit(rows_, only=None, **kw):                              # the first shot it fills never takes a filler
            for k, r in enumerate(rows_):
                if only and id(r) in only and r.get("filler") and (not bad or bad[0] is r):
                    bad[:1] = [r]
                    said_no.append((id(r), r["device"]["id"], M._shown(r)))   # (a filler sync moves onto it
                                                                              # keeps its flag now: a line of its own)
                    M._fall_back(rows_, k, r["device"]["id"], "names a person over a picture with no person in it")
            return real_fit(rows_, only=only, **kw)
        with mock.patch.object(M, "_fit_devices", fit):
            rec, _ = self.gate(rows)
        self.assertTrue(said_no)
        self.assertEqual(len(said_no), len(set(said_no)), said_no)    # never the same line on the same shot twice
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertFalse(M._gaps(rows))
        self.assertEqual(sum(1 for x in rec["repairs"] if x["rule"] == "quiet"), 1)       # one round did it

    def test_a_quiet_stretch_with_every_filler_at_its_cap_takes_a_line_from_a_dense_stretch(self):
        # impl-z (2026-10-11): spoken lines, P05s, running titles and P02s all at their caps, a 32 s stretch nothing
        # could fill: a line where the film is dense gives way (no group over its cap, no new stretch over 30 s)
        rows = film()
        dev = lambda tid, k: dict({"id": tid, FIELD[tid]: first(k, 2)},
                                  **{"top-title": {"line2": ""}, "P02": {"label": ""},
                                     "P05": {"eyebrow": "", "supportLine": "", "imageLabel": ""}}.get(tid, {}))
        for k, tid in ((2, "shadow-up"), (3, "top-title"), (4, "top-title"), (6, "P02"), (7, "top-title"),
                       (8, "P02"), (9, "shadow-up"), (11, "P05"), (12, "P05"), (13, "P05")):
            rows[k]["device"] = dev(tid, k)
        rows[29].pop("typedCaption", None)                            # 103-142 s
        for tid in ("shadow-up", "top-title", "P02", "P05"):                    # its group or its own cap is full
            cap = M.LIBRARY[tid][4]
            self.assertTrue(M._group_room(rows, tid) < 1 or (cap is not None and sum(
                1 for r in rows if (r.get("device") or {}).get("id") == tid) >= cap), tid)
        before = {g: sum(1 for r in rows if (r.get("device") or {}).get("id") in ts) for g, (ts, _, _) in M.OVERLAY_GROUPS.items()}
        heard = copy.deepcopy(rows)                                   # the voice: the words where the film says them
        rec, _ = self.gate(rows, words_from=heard)
        self.assertEqual(rec["result"], "REPAIRED", rec.get("left"))
        self.assertFalse(M._gaps(rows))
        moved = [x for x in rec["repairs"] if x["rule"] == "quiet" and "moved into the stretch" in x["fix"]]
        self.assertEqual(len(moved), 1, rec["repairs"])
        after = {g: sum(1 for r in rows if (r.get("device") or {}).get("id") in ts) for g, (ts, _, _) in M.OVERLAY_GROUPS.items()}
        self.assertTrue(all(after[g] <= M._group_cap(rows, g) for g in after), after)
        self.assertLessEqual(sum(after.values()), sum(before.values()))   # a line moved, none added
        again, _ = self.gate(rows, words_from=heard)                  # a second gate changes nothing
        self.assertEqual(again["result"], "PASS")

    def test_a_template_too_short_for_its_animation_takes_time_from_the_next_plain_shot(self):
        rows = film()
        rows[24]["endMs"] -= 1500                                     # P05 on 2.8 s: it needs 4 s
        rows[25]["startMs"] -= 1500
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "too short" and x["k"] == 24 for x in found))
        rec, _ = self.gate(rows)
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertFalse([x for x in M._gate_find(rows, M._gate_ctx(self.job, rows, DOSSIER, cues_of(film()), "", mode="report"))
                          if x["rule"] == "too short"])


class Pacing(Base):
    def test_a_long_plain_shot_is_cut_on_the_narration(self):
        rows = film()
        rows[8]["endMs"] = rows[9]["endMs"]
        rows[8]["text"] = rows[8]["text"] + " " + rows[9]["text"]
        del rows[9]
        found, _ = self.find(rows, words_from=film())
        self.assertTrue(any(x["rule"] == "long" and x["k"] == 8 for x in found))
        rec, _ = self.gate(rows, words_from=film())
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertLessEqual(max(r["endMs"] - r["startMs"] for r in rows), M.SCENE_MAX_S * 1000)

    def test_a_planned_hold_late_in_the_film_passes_early_it_is_cut(self):
        rows = film(n=200, ms=4300)
        k = next(k for k, r in enumerate(rows) if r["startMs"] >= 780000)    # 13:00
        rows[k]["endMs"] = rows[k + 2]["endMs"] - 400
        rows[k + 1]["startMs"] = rows[k]["endMs"]
        del rows[k + 1]
        rows[k]["hold"] = True
        self.assertTrue(M._hold_ok(rows, rows[k]))
        self.assertFalse([x for x in self.find(rows)[0] if x["rule"] == "long"])
        rows = film(n=200, ms=4300)
        k = next(k for k, r in enumerate(rows) if r["startMs"] >= 600000)    # 10:00
        rows[k]["endMs"] = rows[k + 2]["endMs"] - 400
        rows[k + 1]["startMs"] = rows[k]["endMs"]
        del rows[k + 1]
        rows[k]["hold"] = True
        self.assertFalse(M._hold_ok(rows, rows[k]))
        self.assertTrue([x for x in self.find(rows)[0] if x["rule"] == "long"])

    def test_more_than_four_quick_shots_in_a_row_are_calmed(self):
        rows = film()
        quick = []                                                    # shots 1-3 cut into six of 2.15 s
        for k in range(1, 4):
            r = rows[k]
            mid = (r["startMs"] + r["endMs"]) // 2
            a, b = dict(r, endMs=mid), dict(r, startMs=mid, pick=pic(f"q{k}"), spare=[])
            quick += [a, b]
        rows[1:4] = quick
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "quick run" for x in found))
        rec, _ = self.gate(rows)
        self.assertNotEqual(rec["result"], "STOPPED")
        run = best = 0
        for r in rows:
            run = run + 1 if r["endMs"] - r["startMs"] < M.SHORT_S * 1000 else 0
            best = max(best, run)
        self.assertLessEqual(best, M.SHORT_RUN_MAX)

    def test_an_average_under_four_seconds_joins_plain_shots(self):
        rows = film(n=64, ms=3200)
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "average" for x in found))
        rec, _ = self.gate(rows)
        avg = rows[-1]["endMs"] / 1000 / len(rows)
        self.assertGreaterEqual(avg, M.GATE_AVG_S[0])
        self.assertEqual(rec["result"], "REPAIRED")

    def test_an_average_over_four_point_six_cuts_long_plain_shots(self):
        # each 6.4 s shot says two whole sentences (owner 2026-10-11: the average is cut back at a sentence start)
        rows = film(n=40, ms=6400)
        for r in rows:
            ws = r["text"].split()
            r["text"] = " ".join(ws[:3]) + ". " + " ".join(ws[3:])
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "average" for x in found))
        rec, _ = self.gate(rows, halves=True)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertLessEqual(rows[-1]["endMs"] / 1000 / len(rows), M.GATE_AVG_S[1])
        self.assertTrue(all(r.get("pick") for r in rows))
        self.assertTrue(any(r.get("step") == "split-spare" for r in rows))

    def test_a_slow_average_never_cuts_inside_a_sentence_after_the_opening(self):
        # one 6.4 s sentence a shot, said in two halves: only the first 30 s may be cut inside one; the average stays
        # over 4.6 s as a warning, never a stop (owner 2026-10-11, protect long sentences)
        rows = film(n=40, ms=6400)
        before = {r["startMs"] for r in rows}
        rec, _ = self.gate(rows, halves=True)
        self.assertNotEqual(rec["result"], "STOPPED")
        cuts = [r["startMs"] for r in rows if r["startMs"] not in before]
        mids = {(r["startMs"] + r["endMs"]) // 2 for r in film(n=40, ms=6400)}
        self.assertTrue(all(c < M.PACE_OPEN_S * 1000 or c not in mids for c in cuts), cuts)
        self.assertTrue(any(w.startswith("pacing: the average shot") for w in rec["warnings"]), rec["warnings"])


class Pictures(Base):
    def test_a_repeat_too_close_is_swapped_for_a_runner_up(self):
        rows = film()
        rows[8]["pick"] = dict(rows[3]["pick"], reused=True)           # back after 21.5 s
        rows[8]["step"] = "reused"
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "reuse" and x["k"] == 8 for x in found))
        rec, _ = self.gate(rows)
        self.assertEqual(rec["result"], "REPAIRED")
        self.assertFalse([x for x in self.find(rows)[0] if x["rule"] == "reuse"])

    def test_repeats_over_the_cap_join_when_nothing_replaces_them(self):
        rows = film(n=48)
        for k in range(26, 48):                                       # 22 repeats >= 90 s apart, cap 12
            if not rows[k].get("device") and not rows[k].get("typedCaption"):
                rows[k]["pick"] = dict(rows[k - 25]["pick"], reused=True)
                rows[k]["spare"] = []
        for r in rows:
            r["spare"] = []
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "reuse" and "over the film" in x["what"] for x in found))
        with mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "1"}):
            rec, eng = self.gate(rows)
        led = M._final_ledger(rows)
        self.assertLess(led.repeats(), 22)

    def test_stand_ins_over_the_cap_are_swapped(self):
        rows = film()
        for k in range(1, 48, 3):
            rows[k]["pick"] = dict(pic(f"ai{k}"), ai=True)
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "ai" for x in found))
        rec, _ = self.gate(rows)
        self.assertLessEqual(len(M._ai_times(rows)), round(M.AI_PER_MIN * rows[-1]["endMs"] / 60000))

    def test_the_period_only_from_stored_answers(self):
        rows = film()
        rows[7]["era"] = "the 1890s"
        rows[7]["pick"] = pic("r7", era_asked="the 1890s", bad=["modern: a phone"], clean=False)
        rows[7]["spare"] = [pic("s7a", era_asked="the 1890s")]
        rows[8]["era"] = "the 1890s"                                  # no stored answer for its era: unverified
        found, ctx = self.find(rows)
        self.assertEqual([x["k"] for x in found if x["rule"] == "era"], [7])
        self.assertEqual(ctx["measure"]["era_unverified"], 1)
        rec, eng = self.gate(rows)
        self.assertEqual(rows[7]["pick"]["photo"], "/p/s7a.jpg")
        self.assertFalse([c for c in eng.calls if c["purpose"] != "card check"])   # never a new picture question

    def test_a_shot_without_a_picture_gets_one(self):
        rows = film()
        rows[9]["pick"] = None
        found, _ = self.find(rows)
        self.assertTrue(any(x["rule"] == "no picture" for x in found))
        rec, _ = self.gate(rows)
        self.assertTrue(rows[9]["pick"])


class Scenes(Base):
    def test_effects_and_moves_out_of_place_are_taken_off(self):
        rows = film()
        M.transitions(rows)
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)):
            sc = M.scenes(rows, Path(st), cues_of(rows))
            sc[3]["ambience"] = {"clip": "leak", "durationFrames": sc[3]["durationFrames"], "shadow": 0}
            sc[3]["durationFrames"] = 200                             # 6.7 s: no light leak
            sc[5]["cinemaMove"] = {"kind": "turn"}                    # a turn under a spoken line
            sc[6]["transitionIn"] = {"type": "pushCut", "durationFrames": 11}
            keys = [s["renderKey"] for s in sc]
            fixed = M._gate_scenes(Eng(), self.job, rows, sc)
            self.assertEqual(len(fixed), 3, fixed)
            self.assertNotIn("ambience", sc[3])
            self.assertNotIn("cinemaMove", sc[5])
            self.assertEqual(sc[6]["transitionIn"]["type"], "cut")
            self.assertEqual(keys[10], sc[10]["renderKey"])            # an untouched scene keeps its key
            for s_ in sc:                                             # every key is its scene's own again
                self.assertEqual(s_["renderKey"], M._hash({k: v for k, v in s_.items() if k not in ("index", "startFrame", "renderKey")}))
            self.assertEqual(M._gate_scenes(Eng(), self.job, rows, sc), [])

    def test_a_scene_set_that_breaks_a_rule_stops(self):
        rows = film()
        M.transitions(rows)
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)):
            sc = M.scenes(rows, Path(st), cues_of(rows))
            sc[0]["device"] = None
            with self.assertRaises(M.PlanningStopped):
                M._gate_scenes(Eng(), self.job, rows, sc)

    def test_the_light_leak_hold_never_makes_the_next_shot_quick(self):
        rows = film(texts=False)
        for k in range(0, 48, 2):                                     # 2.2 s, then a plain shot of 3.4 or 4.2 s
            rows[k]["endMs"] = rows[k]["startMs"] + 2200
            rows[k + 1]["startMs"] = rows[k]["endMs"]
            rows[k + 1]["endMs"] = rows[k + 1]["startMs"] + (3400 if k % 4 == 0 else 4200)
            if k + 2 < 48:
                rows[k + 2]["startMs"] = rows[k + 1]["endMs"]
        M.transitions(rows)
        # only the quick shots may take a leak here, so every leak is held to 3 s from the shot after it
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)), \
                mock.patch.object(M, "LEAK_MAX_S", 2.9):
            sc = M.scenes(rows, Path(st), cues_of(rows))
        leaks = [k for k, s_ in enumerate(sc) if (s_.get("ambience") or {}).get("clip") == "leak"]
        self.assertTrue(leaks)
        for k in leaks:
            if k + 1 < len(sc):
                self.assertGreaterEqual(sc[k + 1]["durationFrames"], M.SHORT_S * M.FPS, (k, sc[k + 1]["durationFrames"]))


class Fillers(unittest.TestCase):
    def test_fillers_rotate_to_the_group_with_room(self):
        rows = film()
        build = make_build(rows)
        for k in (2, 7, 12, 17):
            rows[k]["device"] = {"id": "shadow-up", "line": first(k, 2)}
        order = [t for t, _ in M._filler_order(rows)]
        self.assertNotIn("shadow-up", order)                          # 6 spoken lines: over the cap of 4
        rows[24]["device"] = rows[29].pop("typedCaption") and None
        rows[44].pop("typedCaption")
        added = M.fill_gaps_plain(Eng(), rows, build)
        self.assertTrue(added)
        self.assertTrue(all(r["device"]["id"] != "shadow-up" for r in rows if id(r) in added))
        self.assertTrue(all(r.get("filler") for r in rows if id(r) in added))


class ReadBack(Base):
    def test_check_reads_gate_json_and_reruns_the_code_rules_read_only(self):
        rows = film()
        rec, _ = self.gate(rows)
        M.transitions(rows)
        with mock.patch.object(M, "_stage", lambda s, p: M._key(p)):
            sc = M.scenes(rows, self.job / "mrtruth" / "storage", cues_of(rows))
        (self.job / "mrtruth" / "plan.json").write_text(json.dumps(sc))
        (self.job / "mrtruth" / "shots.json").write_text(json.dumps([
            {"text": r["text"], "photo": r["pick"]["photo"], "step": "exact", "ai": False, "tier": "kind",
             "hold": False, "filler": False} for r in rows]))
        stamp = {p.name: p.stat().st_mtime_ns for p in (self.job / "mrtruth").glob("*.json")}
        lines = M.check(self.job)
        self.assertTrue(lines[0].startswith("gate before drawing: PASS"), lines[:2])
        self.assertIn("PASS  every rule", lines)
        self.assertEqual(stamp, {p.name: p.stat().st_mtime_ns for p in (self.job / "mrtruth").glob("*.json")})
        (self.job / "mrtruth" / "gate.json").unlink()                 # no gate record: the label is a LOOK line
        lines = M.check(self.job)
        self.assertTrue(any(l.startswith("LOOK  shot 19: P04") for l in lines), lines)
        sc[5]["device"] = {"id": "shadow-up", "line": f"{word(77, 1).title()} at heart"}      # a dropped negation
        (self.job / "mrtruth" / "plan.json").write_text(json.dumps(sc))
        shots = json.loads((self.job / "mrtruth" / "shots.json").read_text())
        shots[5]["text"] = f"The {word(77, 0)} was not {word(77, 1)} at heart."
        (self.job / "mrtruth" / "shots.json").write_text(json.dumps(shots))
        (self.job / "subs.srt").unlink()                              # a pod film's read-back: the shots' own lines
        lines = M.check(self.job)                                     # a wording fault never stops a film: a warning
        self.assertTrue(any(l.startswith("WARN  negation shot 5") for l in lines), lines)
        self.assertFalse([l for l in lines if l.startswith("FAIL  negation")], lines)


class Wiring(unittest.TestCase):
    def test_nothing_is_checked_after_render(self):
        src = (HERE / "mrtruth.py").read_text(encoding="utf-8")
        body = src[src.index("def assemble("):src.index("def _pictures_and_cut(")]
        self.assertNotIn("check(job)", body)
        self.assertNotIn("_final_check", body)
        self.assertTrue(M.CHECKS_BEFORE_RENDER)
        self.assertIn('if not getattr(plug, "CHECKS_BEFORE_RENDER", False):', (HERE / "make_video.py").read_text(encoding="utf-8"))
        plan = src[src.index("def _pictures_and_cut("):src.index("def _saved_plan(")]
        self.assertLess(plan.index("_reuse_guard(engine, job, rows, dossier)"), plan.index("gate(engine, job, rows"))
        self.assertLess(plan.index("sc_list = scenes("), plan.index("_gate_scenes(engine, job, rows, sc_list)"))
        self.assertLess(plan.index("_gate_scenes(engine, job, rows, sc_list)"), plan.index('_dump(work / "plan.json"'))

    def test_the_wording_rules_come_right_after_text(self):
        k = M.GATE_RULES.index("text")
        self.assertEqual(M.GATE_RULES[k + 1:k + 5], ("cut off", "negation", "names", "detail"))
        self.assertTrue(all(r in M._GATE_HINT for r in ("cut off", "negation", "names", "detail")))
        self.assertTrue(all(r in M._W_RULES for r in ("cut off", "negation", "names", "detail")))

    def test_cut_off_words(self):
        vocab = {"the", "kalomin", "lisotuvan", "ripesov", "tasks", "tarsinist"}
        self.assertEqual(M._cut_off("The Kalomin Ripesov Li", vocab), "Li")
        self.assertEqual(M._cut_off("The Ripesov Lisot", vocab), "Lisot")
        self.assertEqual(M._cut_off("The Ripesov Lisotuvan", vocab), "")
        self.assertEqual(M._cut_off("Tarsin Task", vocab), "")             # an ending (-s), not a cut
        self.assertEqual(M._cut_off("Pope Pius XII", vocab), "")
        self.assertEqual(M._cut_off("Fr.", vocab), "")


if __name__ == "__main__":
    unittest.main()
