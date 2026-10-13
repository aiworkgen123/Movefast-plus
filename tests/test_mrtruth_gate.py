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
        line_ = f"The {w0} was not {w1} in origin."
        self.assertEqual(M._spoken_phrase(line_, 21), f"Not {w1} in origin")          # was '{W1} in origin'
        self.assertTrue(M._phrase_ok(f"Not {w1} in origin", line_))
        self.assertFalse(M._phrase_ok(f"{w1.title()} in origin", line_))
        line2 = f"The {w0} was therefore not about {w1} or {word(60, 2)}."
        self.assertTrue(M._phrase_ok(f"Not about {w1} or {word(60, 2)}", line2))
        self.assertFalse(M._phrase_ok(f"{w1.title()} or {word(60, 2)}", line2))

    def test_never_one_side_of_an_alternative_nor_the_tail_of_a_condition(self):
        w1, w2 = word(61, 0), word(61, 1)
        line_ = f"They dated it to a fourth or fifth century {w1}."
        self.assertEqual(M._spoken_phrase(line_, 32), f"Fourth or fifth century {w1}")
        self.assertFalse(M._spoken_phrase(line_, 21).lower().startswith("fifth"))
        self.assertEqual(M._spoken_phrase(f"If you left, the {w1} ended.", 32), f"If you left, the {w1} ended")  # whole
        self.assertNotIn(M._spoken_phrase(f"If you left, the {w1} ended.", 21), ("You left", "If you left"))
        self.assertEqual(M._spoken_phrase(f"But one {w1}, he said. He read the {w2} twice.", 32), f"He read the {w2} twice")

    def test_never_ends_on_a_verb_an_adjective_or_a_comparison_whose_rest_follows(self):
        w1, w2 = word(62, 0), word(62, 1)
        cases = [(f"A {w1} designed to keep it away from {w2}.", "keep"),
                 (f"It was lighter than {w1} and heavier than {w2}.", "heavier"),
                 (f"You could act on what this {w1} said.", "act"),
                 (f"He came from late antique {w2.title()} with it.", "antique")]
        for line_, bad in cases:
            p = M._spoken_phrase(line_, 32)
            self.assertFalse(p.lower().endswith(bad), (line_, p))
            self.assertTrue(not p or M._phrase_ok(p, line_), (line_, p))

    def test_a_phrase_that_starts_inside_a_noun_phrase_stays_one(self):
        w0, w1, w2 = word(63, 0), word(63, 1), word(63, 2)
        self.assertFalse(M._phrase_ok(f"{w1.title()} and keep its {w2}", f"Several {w0} date to this {w1} and keep its {w2}."))
        self.assertFalse(M._phrase_ok(f"{w1.title()} once in a letter", f"He mentioned the {w1} once in a letter."))
        self.assertFalse(M._phrase_ok(f"{w1.title()} formal", f"The {w0} used the {w1} formal almost in passing."))
        self.assertTrue(M._phrase_ok(f"{w1.title()} of the {w2}", f"He read the {w1} of the {w2}."))

    def test_the_gate_reads_good_lines_the_way_the_picker_does(self):
        w0, w1, w2, C = word(64, 0), word(64, 1), word(64, 2), word(64, 3).title()
        self.assertTrue(M._phrase_ok(f"Neither {w1} nor openly {w2}", f"Cargo that was neither {w1} nor openly {w2} sat in a hold."))
        self.assertTrue(M._phrase_ok(f"A {C} {w1}", f"He read a {C} {w1} that predated the {w2}."))   # before its 'that'
        self.assertTrue(M._phrase_ok(w2.title(), f"The {w0} used the word {w2} almost in passing."))   # one word

    def test_a_plural_possessive_keeps_its_mark(self):
        w0, w1, C = word(65, 0), word(65, 1), word(65, 2).title() + "s"
        line = f"They came with the {C}' full {w1} intact and left."
        self.assertEqual(M._spoken_phrase(line, 30, "", ""), f"{C}' full {w1} intact")
        self.assertEqual([w for w, _, _ in M._toks(f"he said '{w0}s' and the {C}' {w1}")],
                         ["he", "said", f"{w0}s", "and", "the", f"{C}'", w1])   # a closing quote is no possessive


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
                 f"An Uncatalogued Ledger of the {A}": f"A Ledger of the {A}"}     # never 'An Ledger'
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
        text = f"The {w0} was not {w1} in origin."
        self.repaired(self.spoken(text, f"{w1.title()} in origin"), 5, "negation", self.line_on(text), f"Not {w1} in origin")

    def test_a_verb_before_its_object_is_completed(self):
        w1 = word(71, 0)
        text = f"We keep the {w1}."
        self.repaired(self.spoken(text, "We keep"), 5, "cut off", self.line_on(text), f"We keep the {w1}")

    def test_a_condition_stopped_at_its_comma_gets_its_clause(self):
        w1 = word(72, 0)
        text = f"If you left, the {w1} ended."
        self.repaired(self.spoken(text, "If you left"), 5, "cut off", self.line_on(text), f"If you left, the {w1} ended")

    def test_a_comparison_without_its_than_keeps_its_whole_part(self):
        w0, w1, w2 = word(73, 0), word(73, 1), word(73, 2)
        text = f"The {w0} was lighter than {w1} and heavier than {w2}."
        self.repaired(self.spoken(text, f"Lighter than {w1} and heavier"), 5, "cut off", self.line_on(text),
                      f"Lighter than {w1}")

    def test_a_phrase_that_starts_inside_a_noun_phrase_is_made_whole(self):
        w1 = word(74, 0)
        text = f"He mentioned the {w1} once in a letter."
        self.repaired(self.spoken(text, f"{w1.title()} once in a letter"), 5, "cut off", self.line_on(text),
                      f"He mentioned the {w1} once")

    def test_a_dropped_alternative_is_restored(self):
        w1 = word(75, 0)
        text = f"They dated the {w1} to the fourth or fifth century."
        self.repaired(self.spoken(text, "Fifth century"), 5, "detail", self.line_on(text), "Fourth or fifth century")

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
        """Shot k carries a running title the wording rules flag ('If you went' of a condition), whose own line has no
        phrase that reads whole and fits."""
        rows[k]["text"] = "If you went and if you stayed and if you left, it was so."
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
        caption[29]["text"] = f"There were 31 {w0}s in the {w1} hall."
        caption[29]["typedCaption"] = {"lines": [f"Thirty-One {w0.title()}s"], "startFrame": M.TYPED_CAPTION_START_F}
        spoken = film()
        spoken[5]["text"] = f"The {w0} was not {w1} in origin."
        spoken[5]["device"], spoken[5]["filler"] = {"id": "shadow-up", "line": f"{w1.title()} in origin"}, True
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
        self.stuck_line(rows, 10, "If you went")
        self.flagged(rows, 10, "cut off")
        rec, eng = self.gate(rows, words_from=copy.deepcopy(rows))   # MRTRUTH_ALLOW_DEGRADED=0: a stop raises
        self.assertNotEqual(rec["result"], "STOPPED")
        self.assertEqual(rows[10]["device"]["line1"], "If you went")    # kept, with a warning
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
        self.stuck_line(rows, 10, "If you went")
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
        sc[5]["device"] = {"id": "shadow-up", "line": f"{word(77, 1).title()} in origin"}      # a dropped negation
        (self.job / "mrtruth" / "plan.json").write_text(json.dumps(sc))
        shots = json.loads((self.job / "mrtruth" / "shots.json").read_text())
        shots[5]["text"] = f"The {word(77, 0)} was not {word(77, 1)} in origin."
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
