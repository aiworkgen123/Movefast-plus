"""Mr Truth: round 2 of the Flash-Lite fixes (2026-10-11) - the century decided in code (the "made" answer read as
years, compared with the line's own time on a specific line only, never against the very place the shot names), the
yes/no "same" on a specific line, the AI-picture checks on their own model (MRTRUTH_AI_CHECK_MODEL) and a defect
answered in words, three more free frame tests (a thin border, a narrow gap, a transparency checkerboard), ticket and
tour sellers and facsimile shops refused, CHECK_V 3. Synthetic data, plus the retest's real pictures when they are on
this machine. No network, no paid call.

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
from test_mrtruth_a2 import Tmp, answer  # noqa: E402

PICS2 = Path("/tmp/claude-0/-home-user/d74c83cb-cfd3-57f8-84b9-8fa3957981a4/scratchpad/verify/flcmp2/pics")
NOW = M.YEAR_NOW

# the retest film's dossier, cut down: a catch-all period, the manuscript's date in its note, a stand-in
DOSSIER = {
    "topic": "a priest's memorised passage", "setting": "the Vatican Apostolic Library; Egypt",
    "period": "Late antique manuscript origins (4th-5th century) investigated through late 20th century and present day",
    "keyEntities": [
        {"name": "Father Emilio Restivo", "kind": "person", "note": "Sicilian priest and Latinist"},
        {"name": "Vatican Apostolic Library", "kind": "organisation", "note": "Institution that restricted the text"},
        {"name": "the manuscript", "kind": "artifact", "note": "Uncatalogued fourth or fifth century Latin text",
         "canonicalSearchName": "Late antique Latin manuscript"},
        {"name": "the Apostolic Tradition", "kind": "work", "note": "Third century document mentioning prayers"},
        {"name": "early Church fathers", "kind": "idea", "note": "Patristic writers on the soul"},
    ],
    "visualBrief": {"tone": "hushed", "people": [
        {"name": "Father Emilio Restivo", "surname": "Restivo", "likenessKnown": False, "role": "priest",
         "commons": "Catholic priest portrait", "web": "priest reading manuscript"}]},
}
CATCH_ALL = DOSSIER["period"]


def row(text, **kw):
    return dict({"text": text, "entities": [], "era": ""}, **kw)


def ans(**kw):
    return M._answer(answer(1, **kw), era=True, same="same" in kw)


# ── the date parser ────────────────────────────────────────────────────────────────────────────────────────────────
class Dates(unittest.TestCase):
    def test_many_formats(self):
        cases = {
            "4th-5th century": [(300, 499)], "late 12th-century": [(1160, 1199)], "14th-c. charter": [(1300, 1399)],
            "16th c. hall": [(1500, 1599)], "fourth or fifth century": [(300, 499)],
            "8th-7th century BCE terracotta": [(-800, -601)], "6th century BC plaque": [(-600, -501)],
            "7th-century BCE relief": [(-700, -601)], "mid-20th century photo": [(1930, 1969)],
            "early 16th century tile": [(1500, 1539)], "late 19th-early 20th c. ledger": [(1860, 1939)],
            "c. 520-510 BC plaque": [(-545, -485)], "c.1320 Gothic charter": [(1295, 1345), (1150, 1500)],
            "1540-50 relief": [(1540, 1550)], "c.1540-50 relief": [(1530, 1560)], "1881-1913 ledger": [(1881, 1913)],
            "1308 parchment": [(1308, 1308)], "late 1980s": [(1985, 1989)], "the 1890s": [(1890, 1899)],
            "1980s-1990s": [(1980, 1989), (1990, 1999)], "before 911 fragment": [(711, 911)],
            "pre-911 folio": [(711, 911)], "c. 100 CE papyrus": [(75, 125)], "c. 512 codex": [(487, 537)],
            "c. 2500 BC pyramids": [(-2525, -2475)], "twenty-first century": [(2000, 2099)],
            "late antique Mediterranean": [(250, 700)], "9th-century Carolingian codex": [(800, 899), (750, 900)],
        }
        for text, want in cases.items():
            self.assertEqual(M._dates(text), want, text)

    def test_not_years(self):
        for text in ("Papyrus 121 on a board", "P46, a papyrus", "512 pages", "seven manuscripts", "room 12",
                     "the year 2999", "a 3-4 page letter", ""):
            self.assertEqual(M._dates(text, words=False), [], text)

    def test_era_words(self):
        self.assertEqual(M._dates("medieval Byzantine mosaic"), [(600, 1500), (330, 1453)])
        self.assertEqual(M._dates("early medieval binding"), [(500, 1000)])         # not "medieval" again
        self.assertEqual(M._dates("the early Church fathers"), [(100, 450)])
        self.assertEqual(M._dates("Ancient Egyptian papyrus"), [(-3100, 395)])
        # a narration line's loose words are not dates: the Roman Curia, a byzantine rule, a renaissance of interest
        self.assertEqual(M._line_dates("the Roman Curia's byzantine rules saw a renaissance of interest"), [])
        self.assertEqual(M._line_dates("late antique and early Christian writing"), [(250, 700), (30, 600)])
        self.assertEqual(M._line_dates("The Apostolic Tradition, a third century document"), [(200, 299)])

    def test_made_is_the_thing_not_the_photo(self):
        mw = M._made_when
        self.assertEqual(mw("modern photo of 16th-c. Vatican Library hall"), ((1500, 1599), False))
        self.assertEqual(mw("2021 photo of Vatican Library"), (None, False))     # the thing has no date
        self.assertEqual(mw("photo of 3rd-c. Roman catacomb"), ((200, 299), False))
        self.assertEqual(mw("modern facsimile of c.400 Latin manuscript"), ((375, 425), False))
        self.assertEqual(mw("19th-century reproduction of a medieval manuscript"), ((600, 1500), False))
        self.assertEqual(mw("1893 painting by Edvard Munch"), ((1893, 1893), True))
        self.assertEqual(mw("19th-century book illustration of medieval manuscript"), ((1800, 1899), True))
        self.assertEqual(mw("16th-century frescoed Vatican Library hall, modern photo"), ((1500, 1599), False))
        self.assertEqual(mw("medieval Byzantine mosaic"), ((600, 1453), False))  # adjacent words narrow each other
        self.assertEqual(mw("ancient/early medieval bookbinding"), ((-3000, 500), False))   # "/": the first
        self.assertEqual(mw("late antique papyri and a 19th-c. painting"), ((250, 700), False))   # the first thing
        self.assertEqual(mw("modern digital graphic"), ((1950, NOW), False))
        self.assertEqual(mw("contemporary press photograph"), ((1950, NOW), True))
        self.assertEqual(mw("Islamic manuscript binding"), (None, False))
        self.assertEqual(mw(""), (None, False))

    def test_a_beats_period(self):
        po = M._period_of
        self.assertEqual(po("4th-5th century, origin"), [(300, 499)])
        self.assertEqual(po("late 1980s-1990s, Italy"), [(1985, 1999)])
        self.assertEqual(po("ancient Egypt"), [(-3100, 395)])
        self.assertEqual(po(CATCH_ALL), [])                                        # two times far apart: a catch-all
        self.assertEqual(po("17th century to the present day"), [])              # a past time and today
        self.assertEqual(po("Vatican Apostolic Library, undated"), [])
        self.assertEqual(po("the Vatican Library"), [])
        self.assertEqual(po("today"), [])


class DateOff(unittest.TestCase):
    late_antique, eighties = [(300, 499)], [(1985, 1989)]
    film = M._merge_years(M._dates(CATCH_ALL))

    def test_made_later(self):
        off = M._date_off
        self.assertEqual(off("9th-century Carolingian manuscript", self.late_antique), "made later")
        self.assertEqual(off("c.1320 charter", [(30, 600)]), "made later")
        self.assertEqual(off("medieval document with seal", self.late_antique), "made later")   # 600 > 499 + 100
        self.assertEqual(off("6th-century Ravenna mosaic", [(200, 299)]), "made later")
        self.assertEqual(off("6th-century Latin manuscript", self.late_antique), "")    # within the 100-year margin
        self.assertEqual(off("medieval Byzantine folio", [(250, 700)]), "")             # touching: not clearly apart
        self.assertEqual(off("1930 painting", [(1800, 1849)]), "made later")             # 50 years after 1500
        self.assertEqual(off("1893 painting", [(1800, 1849)]), "")
        self.assertEqual(off("2010s photo of a 1980s office", self.eighties), "")       # the era question's

    def test_older(self):
        off = M._date_off
        self.assertEqual(off("19th-century book illustration of medieval manuscript", [(1985, 1999)]), "an older picture")
        self.assertEqual(off("mid-20th-century black-and-white photograph", self.eighties), "")   # within 50 years
        self.assertEqual(off("15th-century book of hours", self.eighties, self.film), "an older thing")
        self.assertEqual(off("5th-century leather-bound codex", self.eighties, self.film), "")    # the film's own time
        self.assertEqual(off("16th-century Sistine Hall", self.eighties, self.film), "")          # a hall stays
        self.assertEqual(off("modern photo of ancient catacomb", self.eighties, self.film), "")   # a place stays
        self.assertEqual(off("c. 1st-2nd century Greek papyrus", self.late_antique), "")        # older, older line
        self.assertEqual(off("c. 520-510 BC Greek plaque", self.late_antique), "")

    def test_unknown_is_never_refused(self):
        self.assertEqual(M._date_off("AI render", self.late_antique), "")
        self.assertEqual(M._date_off("9th-century codex", []), "")
        self.assertEqual(M._date_off("", self.late_antique), "")

    def test_fits_any_of_the_lines_times(self):
        both = [(250, 700), (1985, 1989)]
        self.assertEqual(M._date_off("c. 512 Byzantine codex", both, self.film), "")
        self.assertEqual(M._date_off("1851 book engraving", both, self.film), "made later")


# ── the line: specific or abstract, its own time, the places it names ─────────────────────────────────────────────
class Line(unittest.TestCase):
    def test_catch_all_and_undated_lines_have_no_period(self):
        w = M._line_when(row("Consciousness persisted."), DOSSIER)
        self.assertEqual((w["specific"], w["periods"]), (False, []))
        w = M._line_when(row("Until that moment, the dead remained witnesses.", era=CATCH_ALL), DOSSIER)
        self.assertEqual((w["specific"], w["periods"]), (False, []))
        w = M._line_when(row("That phrase did not indicate heresy."), DOSSIER, names=["Vatican archive ledger"])
        self.assertEqual((w["specific"], w["periods"]), (True, []))            # specific, but undated: no date check
        w = M._line_when(row("A file was closed.", era="Vatican Apostolic Library, undated"), DOSSIER,
                         names=["access record"])
        self.assertEqual(w["periods"], [])

    def test_the_lines_own_time(self):
        w = M._line_when(row("Not symbolically.", era="4th-5th century, origin"), DOSSIER, names=["Latin manuscript folio"])
        self.assertEqual((w["specific"], w["periods"]), (True, [(300, 499)]))
        # mid-sentence: the line before gives the date (and names the Apostolic Tradition)
        w = M._line_when(row("prayers said over the body, implying some continued connection."), DOSSIER,
                         before="The Apostolic Tradition, a third century document, mentioned")
        self.assertEqual((w["specific"], w["periods"]), (True, [(200, 299)]))
        # no date of its own: the dossier's note on what it names ("the manuscript": fourth or fifth century)
        w = M._line_when(row("The Latin was deliberate."), DOSSIER, names=["Latin manuscript script"])
        self.assertEqual(w["periods"], [(300, 499)])
        # its own era and its sentence's dates together
        w = M._line_when(row("priest and Latinist brought in by the Library in the late 1980s to", era="late 1980s"),
                         DOSSIER, after="assist with a condition assessment of several late antique codices.")
        self.assertEqual(w["periods"], [(250, 700), (1985, 1989)])
        # a line that stops mid-sentence takes the next one; the next line's own full stop ends it
        self.assertEqual(M._line_sentence(row("He read it."), "before", "after"), "He read it.")
        w = M._line_when(row("The dominant position in the writings of the early Church fathers held"), DOSSIER,
                         after="that the soul departed immediately.")
        self.assertEqual(w["periods"], [(100, 450)])
        self.assertEqual(w["film"], [(250, 700), (1960, 1999)])

    def test_specific(self):
        self.assertTrue(M._line_when(row("He waited.", about="Father Emilio Restivo"), DOSSIER)["specific"])
        self.assertTrue(M._line_when(row("Restivo read on."), DOSSIER)["specific"])          # a key person, by surname
        self.assertTrue(M._line_when(row("He read.", entities=["Codex Vaticanus"]), DOSSIER,
                                     names=["Codex Vaticanus"])["specific"])
        self.assertTrue(M._line_when(row("The text was older than the 9th century."), DOSSIER)["specific"])  # a date
        self.assertFalse(M._line_when(row("It describes awareness.", about="no one in particular"), DOSSIER)["specific"])

    def test_places_name_which_one_never_a_person(self):
        w = M._line_when(row("He worked there.", entities=["Vatican Apostolic Library", "Restivo"]), DOSSIER,
                         names=["Vatican Apostolic Library", "Restivo"], stand=DOSSIER["visualBrief"]["people"][0])
        self.assertEqual(w["places"], ["vatican"])
        a = {"shows": "kind", "made": "1794 print after Giuseppe Vasi", "subject": "vatican library long gallery"}
        self.assertTrue(M._same_place(a, w))
        self.assertFalse(M._same_place(dict(a, subject="a long gallery"), w))
        self.assertTrue(M._same_place({"shows": "exact"}, {}))                    # the very thing it names
        self.assertFalse(M._same_place({"shows": "exact", "person": True}, {}))   # a later picture of a person is not


# ── the decision ───────────────────────────────────────────────────────────────────────────────────────────────────
class Decide(unittest.TestCase):
    late = M._line_when(row("Not symbolically.", era="4th-5th century, origin"), DOSSIER, names=["Latin manuscript folio"])
    abstract = M._line_when(row("The grief spoken.", era="4th-5th century, Mediterranean"), DOSSIER)
    library = M._line_when(row("Several texts in the Library's holdings date to this period.",
                               era="4th-5th century texts, Vatican archive", entities=["Vatican Apostolic Library"]),
                           DOSSIER, names=["Vatican Apostolic Library"])

    def test_another_century_is_no_on_a_specific_line_only(self):
        a = ans(shows="kind", made="9th-century Carolingian manuscript", modern="")
        v = M._verdict({"title": "t"}, a, line=self.late)
        self.assertEqual((v["shows"], v["tier"], v["clean"], v["date_off"]), ("no", M.NO, True, "made later"))
        self.assertFalse(M._usable({"text": "x"}, v))
        v = M._verdict({"title": "t"}, ans(shows="kind", made="1893 painting by Edvard Munch", modern=""),
                       line=self.abstract)
        self.assertEqual((v["shows"], v.get("date_off")), ("kind", None))      # an abstract line: the model's own call
        v = M._verdict({"title": "t"}, a)                                       # no line given: as answered
        self.assertEqual(v["shows"], "kind")
        v = M._verdict({"title": "t"}, ans(shows="kind", made="5th-century folio", modern=""), line=self.late)
        self.assertEqual(v["shows"], "kind")

    def test_the_same_named_place_at_another_time_is_that_place(self):
        for made, subject in (("16th-century Vatican Library interior", "reading room"),
                              ("1794 print", "vatican library gallery")):
            v = M._verdict({}, ans(shows="kind", made=made, subject=subject, modern=""), line=self.library)
            self.assertEqual((v["shows"], v.get("date_off")), ("kind", None), made)
        v = M._verdict({}, ans(shows="kind", made="16th-century Renaissance hall", subject="a hall", modern=""),
                       line=self.library)
        self.assertEqual((v["shows"], v["date_off"]), ("no", "made later"))    # not shown to be that very one

    def test_same_false_is_no_on_a_specific_line(self):
        v = M._verdict({}, ans(shows="kind", made="5th-century stone lintel", same=False, modern=""), line=self.late)
        self.assertEqual((v["shows"], v["not_same"]), ("no", True))
        self.assertIn("not the line's kind of thing", v["reason"])
        v = M._verdict({}, ans(shows="exact", made="5th-century codex", same=False, modern=""), line=self.late)
        self.assertEqual(v["shows"], "exact")                                  # the very thing named: kept
        v = M._verdict({}, ans(shows="kind", made="16th-c. hall", subject="vatican reading room", same=False,
                               modern=""), line=self.library)
        self.assertEqual(v["shows"], "kind")                                   # the named place: kept
        v = M._verdict({}, ans(shows="kind", made="5th-century stone lintel", same=False, modern=""),
                       line=self.abstract)
        self.assertEqual(v["shows"], "kind")                                   # never on an abstract line
        v = M._verdict({}, ans(shows="kind", made="5th-century codex", same=True, modern=""), line=self.late)
        self.assertEqual((v["shows"], v.get("not_same")), ("kind", None))

    def test_same_answer_parsing(self):
        self.assertIs(M._answer(answer(1, same="false"), era=False, same=True)["same"], False)
        self.assertIs(M._answer(answer(1, same="no, a library hall"), era=False, same=True)["same"], False)
        self.assertIs(M._answer(answer(1), era=False, same=True)["same"], True)     # not said: not refused
        self.assertIs(M._answer(answer(1, same="a codex page"), era=False, same=True)["same"], True)
        self.assertNotIn("same", M._answer(answer(1, same=False), era=False))        # not asked: not read
        a = M._answer({"real": True, "text": False, "frame": False, "banned": False, "same": False}, era=False, same=True)
        self.assertEqual((a["shows"], a["same"]), ("", False))                     # no shows: refused for not same


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
