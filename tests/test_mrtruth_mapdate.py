"""Mr Truth: the owner's location map and date overlay placed by the planner (impl-z, his rulings 3, 4 and 8 of
2026-10-11): the cheap first look in code (mrtruth_spots: places, dates, his date format), the place rule against the
geocoder, the ready-made plates, the step itself (places_and_dates: one Claude call, first mention, caps and spacing,
never on the title or a page, the date's corner and the words it moves, a date on a map's shot, the year cards it
replaces), its place in the pipeline (sync pins, the pace code, the fillers, the scenes, the map's sound) and the gate's
map and date rules (repaired or dropped, never a stop). Synthetic data only: no network, no paid call, no render.

    .venv/bin/python -m unittest tests.test_mrtruth_mapdate -v
"""
import copy
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
import mrtruth_map as MAP  # noqa: E402
import mrtruth_spots as S  # noqa: E402
from test_mrtruth_a0 import Engine  # noqa: E402
from test_mrtruth_gate import Base, DOSSIER, film, write_job  # noqa: E402


def cues_for(sentences, secs=5.0):
    return [(int(k * secs * 1000), int((k + 1) * secs * 1000), t) for k, t in enumerate(sentences)]


def rows_for(sentences, secs=5.0):
    return [{"startMs": a, "endMs": b, "text": t, "device": None, "queries": ["", "", ""], "entities": [],
             "visualIntent": t} for a, b, t in cues_for(sentences, secs)]


def toks_for(sentences, secs=5.0):
    cues = cues_for(sentences, secs)
    return S.timed(cues, M._word_times(cues)), cues


FILLER = ["The {} kept its quiet rooms for the readers.", "Nobody spoke of the {} in those days.",
          "The {} was a long story told in parts.", "Some readers wrote down what the {} had seen.",
          "A clerk sorted the {} by hand every morning.", "Then the {} was closed again for the winter."]
NOUNS = ["archive", "ledger", "chapel", "register", "letter", "folder", "drawer", "shelf", "lamp", "bell", "stair",
         "window", "corridor", "table", "chair", "door", "key", "clock", "candle", "rope"]


def filler(n, start=0):
    return [FILLER[(start + k) % len(FILLER)].format(NOUNS[(start + k) % len(NOUNS)]) for k in range(n)]


def fake_claude(no=(), coords=None, ranks=None, dates_no=(), texts=None):
    """Claude's answer for the places-and-dates prompt: every place a place (but `no`), every date important (but
    `dates_no`), the code's own reading as its text (or `texts`)."""
    coords, ranks, texts = coords or {}, ranks or {}, texts or {}

    def answer(prompt):
        assert "PLACES and the DATES" in prompt
        places, dates = [], []
        for pid, name in re.findall(r'^(p\d+) \([\d.]+s\) "([^"]+)"', prompt, re.M):
            lat, lon = coords.get(name, (10.0, 20.0))
            places.append({"id": pid, "use": name not in no, "label": name, "lat": lat, "lon": lon, "kind": "city",
                           "terrain": "green", "rank": ranks.get(name, 3), "why": "a test"})
        for did, said, big, small in re.findall(r"^(d\d+) \([\d.]+s\) \"([^\"]+)\" reads as '([^']*)'(?: / '([^']*)')?",
                                                prompt, re.M):
            b, s = texts.get(said, (big, small))
            dates.append({"id": did, "use": said not in dates_no, "date": b, "year": s, "why": "a test"})
        return json.dumps({"places": places, "dates": dates})
    return answer


def plate_pick(name, *a, **k):
    return {"photo": f"/p/plate_{MAP._slug(name)}.jpg", "title": "EOX", "provider": "map", "tier": 3, "clean": True,
            "bad": [], "map": {"place": name}}


class Step(unittest.TestCase):
    """places_and_dates on a synthetic film: 5 s a sentence, the words spread over it."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.job = Path(self.tmp.name) / "job"
        (self.job / "mrtruth").mkdir(parents=True)
        self.geo = {}                                       # name -> ok geocode answer; anything else: unknown

        def geocode(name, lat, lon, cache, **k):
            return self.geo.get(name) or {"ok": False, "status": "unknown", "why": f"the geocoder does not know '{name}'"}
        self.patches = [mock.patch.object(MAP, "geocode", geocode),
                        mock.patch.object(MAP, "build_place", lambda name, *a, **k: plate_pick(name))]
        for p in self.patches:
            p.start()
        M.DEV_DROPS.clear()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def run_step(self, sentences, answer=None, rows=None, secs=5.0, engine=None):
        rows = rows or rows_for(sentences, secs)
        cues = cues_for(sentences, secs)
        eng = engine or Engine(answer or fake_claude())
        eng.OUTPUT_ROOT = Path(self.tmp.name) / "out"
        md = M.places_and_dates(eng, self.job, rows, " ".join(sentences), {}, cues)
        return rows, md, eng

    def spots(self, rows, kind=None):
        return [r for r in rows if M._spot(r) and (kind is None or M._spot(r) == kind)]

    # ── the maps ──
    def test_a_map_on_the_first_mention_starts_as_the_name_is_said(self):
        s = filler(3) + ["Later he went to Caddo Lake, Texas with his notes."] + filler(4, 3) + \
            ["Back at Caddo Lake the water was still."] + filler(6, 7)
        rows, md, eng = self.run_step(s)
        maps = self.spots(rows, "map")
        self.assertEqual(len(maps), 1)
        r = maps[0]
        heard = r["spot"]["ms"]
        self.assertEqual(r["startMs"], heard - M.SYNC_LEAD_MS)                 # on the name, as sync pins it
        self.assertTrue(15000 <= heard < 20000)                                # the first mention, not the second
        self.assertTrue(M.MAP_MIN_S * 1000 <= r["endMs"] - r["startMs"] <= 8000)
        self.assertEqual(r["device"], {"id": "location-map", "label": "Caddo Lake, Texas"})
        self.assertEqual(r["plate"]["map"].get("fallback"), "green")          # the geocoder did not know it: plate B
        self.assertTrue(Path(r["plate"]["photo"]).is_file())
        self.assertFalse(r.get("pick"))                                        # its plate is restored after the pictures
        self.assertTrue(M._covered(r) and not M._bare(r))
        # every candidate is logged with what became of it
        self.assertTrue(any("place 'Caddo Lake, Texas'" in l and "MAP" in l for l in eng.lines), eng.lines)
        self.assertEqual(md["claude"], "asked")
        times = [(x["startMs"], x["endMs"]) for x in rows]
        self.assertEqual(times, sorted(times))
        self.assertTrue(all(a[1] == b[0] for a, b in zip(times, times[1:])))  # the film stays whole

    def test_its_own_plate_when_the_geocoder_confirms_it(self):
        self.geo["Cairo, Egypt"] = {"ok": True, "lat": 30.04, "lon": 31.24, "name": "Cairo", "km": 1.0, "query": "Cairo, Egypt",
                                    "osm_type": "city"}
        s = filler(3) + ["The letters came from Cairo, Egypt every spring."] + filler(6, 3)
        rows, md, eng = self.run_step(s)
        r = self.spots(rows, "map")[0]
        self.assertEqual(r["plate"]["photo"], "/p/plate_cairo-egypt.jpg")     # build_place: its own satellite plate
        rec = next(x for x in md["places"] if x["name"] == "Cairo, Egypt")
        self.assertEqual(rec["status"], "placed")
        self.assertIn("its own satellite plate", rec["imagery"])

    def test_a_state_or_a_country_alone_is_never_asked(self):
        s = filler(3) + ["In Texas the summers were long."] + filler(2, 3) + ["Egypt kept its own records."] + filler(5, 5)
        rows, md, eng = self.run_step(s)
        self.assertFalse(self.spots(rows, "map"))
        why = {x["name"]: x["why"] for x in md["places"]}
        self.assertIn("state alone", why["Texas"])
        self.assertIn("country alone", why["Egypt"])
        self.assertEqual(eng.calls, [])                                         # refused in code, never asked

    def test_a_region_the_geocoder_names_is_refused(self):
        self.geo["Lake Zeta"] = {"ok": False, "status": "region", "why": "'Lake Zeta' is a state as a whole"}
        s = filler(3) + ["The road ended at Lake Zeta in the dark."] + filler(6, 3)
        rows, md, _ = self.run_step(s)
        self.assertFalse(self.spots(rows, "map"))
        self.assertIn("Nominatim", next(x for x in md["places"] if x["name"] == "Lake Zeta")["why"])

    def test_at_most_three_a_minute_apart_best_rank_first(self):
        s = (filler(3) + ["They met in Avalon Bay at night."] + filler(4, 3) + ["Then they went to Brindle Hill."] +
             filler(14, 7) + ["The ship reached Corran Point."] + filler(14, 21) + ["A farm stood at Dunmore Glen."] +
             filler(14, 35) + ["The last letter came from Elster Cove."] + filler(4, 49))
        ranks = {"Avalon Bay": 2, "Brindle Hill": 5, "Corran Point": 3, "Dunmore Glen": 4, "Elster Cove": 1}
        rows, md, _ = self.run_step(s, fake_claude(ranks=ranks))
        maps = self.spots(rows, "map")
        self.assertEqual([r["device"]["label"] for r in maps], ["Brindle Hill", "Corran Point", "Dunmore Glen"])
        starts = [r["startMs"] for r in maps]
        self.assertTrue(all(b - a >= M.MAP_GAP_S * 1000 for a, b in zip(starts, starts[1:])))
        why = {x["name"]: x["why"] for x in md["places"]}
        self.assertIn("within 60s of the map of Brindle Hill", why["Avalon Bay"])
        self.assertIn("the film's 3 maps are placed", why["Elster Cove"])

    def test_never_on_the_title_or_a_page_and_then_its_next_mention(self):
        s = ["The story of Fenwick Abbey begins in the dark."] + filler(3) + \
            ["The monks of Fenwick Abbey kept a strange book."] + filler(18, 3) + \
            ["A traveller from Galloway Rise wrote it all down."] + filler(6, 7)
        rows = rows_for(s)
        rows[0]["device"] = {"id": "P03", "kicker": "a", "headline": "b"}
        rows[0]["endMs"], rows[1]["startMs"] = 7000, 7000
        k = next(i for i, r in enumerate(rows) if "Galloway" in r["text"])
        rows[k]["device"] = {"id": "highlight-page", "paragraphs": ["x"] * 3, "phrases": ["x"] * 3, "main": 0}
        rows, md, eng = self.run_step(s, rows=rows)
        maps = self.spots(rows, "map")
        self.assertEqual([r["device"]["label"] for r in maps], ["Fenwick Abbey"])
        self.assertTrue(20000 <= maps[0]["spot"]["ms"] < 25000)               # its second mention, 20 s on
        self.assertEqual(rows[0]["device"]["id"], "P03")                       # the title untouched
        why = {x["name"]: x["why"] for x in md["places"]}
        self.assertIn("highlighted page", why["Galloway Rise"])
        self.assertTrue(any("its mention 2" in l for l in eng.lines))

    def test_the_first_thirty_seconds_keep_one_long_shot(self):
        s = filler(1) + ["They sailed for Harlow Sound at first light."] + filler(10, 1)
        rows, _, _ = self.run_step(s)
        r = self.spots(rows, "map")[0]
        self.assertLess(r["startMs"], M.PACE_OPEN_S * 1000)
        self.assertLessEqual(r["endMs"] - r["startMs"], M.PACE_OPEN_LONG_S * 1000)    # at most 6 s there
        self.assertLessEqual(M._cap_ms(r), M.PACE_OPEN_LONG_S * 1000)

    # ── the dates ──
    def test_a_date_on_its_words_in_his_format_and_its_year_card_gone(self):
        s = filler(3) + ["He arrived on March 28th, 2026 with nothing."] + filler(3, 3) + \
            ["It was March 28th, 2026 again in his notes."] + filler(5, 6)
        rows = rows_for(s)
        rows[3]["device"] = {"id": "P12", "year": "2026", "eraLabel": "", "detail": ""}
        rows[7]["device"] = {"id": "P12", "year": "2026", "eraLabel": "", "detail": ""}
        for k, t in ((3, "2026 "), (7, "2026"), (9, "The chapel bell")):            # the brief's overlays
            rows[k]["overlay"] = {"text": t}
        rows, md, _ = self.run_step(s, rows=rows)
        overlays = [r["overlay"]["text"] for r in rows if r.get("overlay")]
        self.assertNotIn("2026", " ".join(overlays))                            # a card's overlay never shows the year again
        self.assertIn("The chapel bell", overlays)                              # other words stay
        dates = self.spots(rows, "date")
        self.assertEqual(len(dates), 1)                                         # the same date: its first time only
        d = dates[0]
        self.assertEqual(d["device"], {"id": "date-stamp", "date": "March", "year": "2026"})   # the day dropped
        self.assertEqual(d["startMs"], d["spot"]["ms"] - M.SYNC_LEAD_MS)
        self.assertTrue(3500 <= d["endMs"] - d["startMs"] <= 4500)
        self.assertFalse([r for r in rows if (r.get("device") or {}).get("id") == "P12"])    # both year cards replaced
        why = [x["why"] for x in md["dates"] if x["status"] != "placed"]
        self.assertTrue(any("the same date again" in w for w in why), why)
        self.assertEqual(len(md["year_cards"]), 2)

    def test_dates_skipped_by_code_and_by_claude(self):
        s = filler(2) + ["In the late 1980s the room was sealed."] + filler(1, 2) + \
            ["Six months later the request was denied."] + filler(1, 4) + \
            ["Between 1947 and 1952 the scrolls moved twice."] + filler(1, 6) + \
            ["He counted 1500 manuscripts in 1994."] + filler(4, 8)
        rows, md, eng = self.run_step(s, fake_claude(dates_no=("1500",)))
        dates = self.spots(rows, "date")
        self.assertEqual([d["device"]["date"] for d in dates], ["1994"])        # a year alone: the big line alone
        why = {x["said"]: x["why"] for x in md["dates"]}
        self.assertIn("decade", why["the late 1980s"])
        self.assertIn("relative", why["Six months later"])
        self.assertIn("in passing", why["1947"])
        self.assertIn("in passing", why["1952"])
        self.assertIn("Claude", why["1500"])
        self.assertNotIn("1980s", eng.calls[0].split("DATE CANDIDATES")[1])   # code's refusals are never asked

    def test_claudes_text_never_overrides_the_words(self):
        s = filler(3) + ["In the spring of 1998 the doors opened."] + filler(5, 3)
        rows, md, _ = self.run_step(s, fake_claude(texts={"spring of 1998": ("April", "1998")}))
        d = self.spots(rows, "date")[0]
        self.assertEqual((d["device"]["date"], d["device"]["year"]), ("Spring", "1998"))

    def test_the_date_keeps_its_corner_and_the_other_words_move(self):
        s = filler(3) + ["In 1994 the reader opened the sealed box."] + \
            ["The sealed box held the old ledger and a key."] + filler(5, 3)
        rows = rows_for(s)
        rows[3]["typedCaption"] = {"lines": ["Old ledger"], "startFrame": M.TYPED_CAPTION_START_F}
        rows[3]["device"] = {"id": "P12", "year": "1994", "eraLabel": "", "detail": ""}
        rows, md, eng = self.run_step(s, rows=rows)
        d = self.spots(rows, "date")[0]
        self.assertNotIn("typedCaption", d)                                     # one block of words a frame
        moved = [r for r in rows if r.get("typedCaption")]
        self.assertEqual(len(moved), 1)
        self.assertIn("old ledger", moved[0]["text"])                          # on a shot that says it
        self.assertTrue(any("moved to the shot" in x["how"] for x in md["blocks"]), md["blocks"])

    def test_the_fillers_stay_as_they_are(self):
        # ruling 4 CHANGE: maps and dates are added on top and never stand in for a filler - the quiet stretches the
        # fillers are planned on do not count them; the gate's 30 s rule (words on screen) does
        rows = rows_for(filler(14))
        rows[1]["device"] = {"id": "shadow-up", "line": "The ledger was"}
        rows[5]["device"] = {"id": "date-stamp", "date": "1994", "year": ""}
        rows[5]["spot"] = {"kind": "date", "ms": rows[5]["startMs"] + 150}
        self.assertNotIn(rows[5]["startMs"], M._text_times(rows))
        self.assertIn(rows[5]["startMs"], M._text_times(rows, True))
        self.assertTrue(M._gaps(rows))
        self.assertLess(len(M._gaps(rows, True)), len(M._gaps(rows)) + 1)
        with mock.patch.object(M, "_open_room", lambda r, t: True):
            got = M.fill_gaps_plain(Engine(), rows, lambda tid, o, i: {"id": tid, "line": o["headline"]}
                                    if tid == "shadow-up" else None)
        self.assertTrue(got)
        self.assertFalse(any(id(r) in got for r in rows if M._spot(r)))        # never on the date's own shot

    # ── a date on a map's shot ──
    def test_a_date_said_on_a_map_shares_it_once_the_name_is_clear(self):
        s = filler(5) + ["They reached Ivel Water after a long night, in the spring of 1998, and stayed there for weeks."] \
            + filler(6, 5)
        rows, md, _ = self.run_step(s, secs=8.0)
        maps = self.spots(rows, "map")
        self.assertEqual(len(maps), 1)
        m = maps[0]
        f = round((m["spot_date"]["ms"] - M.SYNC_LEAD_MS - m["startMs"]) * M.FPS / 1000)
        clear = S.corner_clear_frame("Ivel Water", "Spring", "1998", round((m["endMs"] - m["startMs"]) * M.FPS / 1000))
        self.assertEqual((m["device"]["date"], m["device"]["year"]), ("Spring", "1998"))
        self.assertGreaterEqual(f, clear)
        self.assertFalse(self.spots(rows, "date"))
        self.assertTrue(next(x for x in md["dates"] if x["said"].endswith("1998"))["shared"])

    def test_a_date_said_during_the_maps_build_does_not_cross_its_name(self):
        s = filler(5) + ["At Jessop Ford in 1931 a bridge fell into the river below."] + filler(6, 5)
        rows, md, _ = self.run_step(s, secs=8.0)
        self.assertEqual(len(self.spots(rows, "map")), 1)
        self.assertFalse(self.spots(rows, "date"))
        self.assertFalse(self.spots(rows, "map")[0]["device"].get("date"))
        self.assertIn("crosses the date's corner", next(x for x in md["dates"] if x["said"] == "1931")["why"])

    def test_the_corner_clears_later_for_a_longer_name(self):
        short = S.corner_clear_frame("Rome", "March", "1994", 240)
        long_ = S.corner_clear_frame("Vatican Apostolic Library", "September", "1994", 240)
        self.assertIsNotNone(short)
        self.assertIsNotNone(long_)
        self.assertLessEqual(short, long_)
        self.assertGreaterEqual(short, round(S._LABEL["in"][0]))              # never before the name comes in
        self.assertLess(long_, 150)                                             # clear by 5 s on his 8 s shot

    # ── the step never stops the film ──
    def test_claude_failing_keeps_the_film_and_its_year_cards(self):
        s = filler(3) + ["In 1994 he went to Kestrel Moor."] + filler(5, 3)
        rows = rows_for(s)
        rows[3]["device"] = {"id": "P12", "year": "1994", "eraLabel": "", "detail": ""}
        before = copy.deepcopy(rows)
        rows, md, eng = self.run_step(s, rows=rows, engine=Engine(None))
        self.assertEqual(rows, before)
        self.assertEqual(md["claude"], "failed")
        self.assertFalse((self.job / "mrtruth" / "places_dates.json").exists())   # never cached: asked again next run
        self.assertTrue(all(x["status"] == "skipped" for x in md["places"] + md["dates"]))

    def test_an_answer_is_cached(self):
        s = filler(3) + ["In 1994 he left home."] + filler(3, 3) + ["He went to Kestrel Moor at last."] + filler(5, 6)
        _, _, eng = self.run_step(s)
        self.assertEqual(len(eng.calls), 1)
        rows2, md2, eng2 = self.run_step(s)
        self.assertEqual((len(eng2.calls), md2["claude"]), (0, "cached"))
        self.assertEqual(len(self.spots(rows2)), 2)

    def test_anything_it_raises_leaves_the_rows_as_they_were(self):
        s = filler(3) + ["In 1994 he went to Kestrel Moor."] + filler(5, 3)
        rows = rows_for(s)
        before = copy.deepcopy(rows)
        eng = Engine(fake_claude())
        with mock.patch.object(M, "_md_take", lambda *a, **k: 1 / 0):
            md = M._md_safe(eng, self.job, rows, " ".join(s), {}, cues_for(s))
        self.assertEqual(rows, before)
        self.assertIn("failed (ZeroDivisionError)", md["claude"])
        self.assertTrue(any("the film goes on without them" in l for l in eng.lines))


# ── the cheap first look ──────────────────────────────────────────────────────────────────────────────────────────────
class Places(unittest.TestCase):
    def found(self, sentences, dossier=None):
        toks, _ = toks_for(sentences)
        return {c["name"]: c for c in S.place_candidates(toks, dossier)}

    def test_names_pairs_and_features(self):
        got = self.found(["He travelled to Caddo Lake, Texas in a boat.", "The monks of Qumran Caves kept scrolls.",
                          "Later he wrote from Cairo, Egypt to his sister.", "A forest in Arizona hid the camp.",
                          "The Valley of the Kings was quiet.", "Several writers came from Alexandria.",
                          "The Vatican kept its notes.", "Alexandria was bright again."])
        for name in ("Caddo Lake, Texas", "Qumran Caves", "Cairo, Egypt", "forest in Arizona", "Valley of the Kings",
                     "Alexandria", "Vatican"):
            self.assertIn(name, got)
            self.assertEqual(got[name]["skip"], "", name)
        self.assertEqual(len(got["Alexandria"]["mentions"]), 2)
        self.assertLess(got["Alexandria"]["at_ms"], got["Alexandria"]["mentions"][1])
        self.assertIn("state alone", got["Arizona"]["skip"])                 # the state alone, as said after its forest
        for not_a_place in ("He", "The", "Later", "Several", "Texas", "Egypt", "Kings", "Valley"):
            self.assertNotIn(not_a_place, got)

    def test_people_titles_and_describing_words_are_not_places(self):
        d = {"keyEntities": [{"name": "Emilio Restivo", "kind": "person"}]}
        got = self.found(["Father Emilio Restivo was a Sicilian priest.", "Restivo read the Greek source again.",
                          "Egyptian funerary traditions were older.", "Instructions appeared in Greek-language texts.",
                          "Removing it changed nothing.", "Christian writers disagreed."], d)
        self.assertEqual(got, {})

    def test_a_state_a_country_or_a_continent_alone_is_refused_in_code(self):
        got = self.found(["They drove across Texas at night.", "The war reached Egypt late.",
                          "New Mexico was empty then.", "Africa was far away.", "Monaco was small.",
                          "The Vatican City was quiet."])
        self.assertIn("state alone", got["Texas"]["skip"])
        self.assertIn("state alone", got["New Mexico"]["skip"])
        self.assertIn("country alone", got["Egypt"]["skip"])
        self.assertIn("continent", got["Africa"]["skip"])
        self.assertEqual(got["Monaco"]["skip"], "")                            # a city-state is a place
        self.assertEqual(got["Vatican City"]["skip"], "")

    def test_its_time_is_the_heard_word(self):
        cues = [(0, 5000, "They sailed for Harlow Sound at dawn.")]
        heard = [(0, "they"), (400, "sailed"), (900, "for"), (1780, "harlow"), (2300, "sound"), (2900, "at"), (3300, "dawn")]
        c = S.place_candidates(S.timed(cues, heard))[0]
        self.assertEqual((c["name"], c["at_ms"]), ("Harlow Sound", 1780))


class Dates(unittest.TestCase):
    def read(self, sentence):
        toks, _ = toks_for([sentence])
        return S.date_candidates(toks)

    def test_his_format_from_many_phrasings(self):
        cases = {"On March 28th 2026 the doors closed.": ("March", "2026"),
                 "On March 28, 2026 the doors closed.": ("March", "2026"),
                 "It ended on the 28th of March, 2026, at dawn.": ("March", "2026"),
                 "It ended on 28 March 2026 at dawn.": ("March", "2026"),
                 "It ended in March of 1994 in the rain.": ("March", "1994"),
                 "In Sept. 1939 the war began.": ("September", "1939"),
                 "It began in the spring of 1998 quietly.": ("Spring", "1998"),
                 "It began in Spring 1998 quietly.": ("Spring", "1998"),
                 "It began in the summer of '98 quietly.": ("Summer", "1998"),
                 "He died in the fall of 1963 alone.": ("Fall", "1963"),
                 "He died in 1994 alone.": ("1994", ""),
                 "He died in nineteen ninety-four alone.": ("1994", ""),
                 "It closed in two thousand and nine for good.": ("2009", ""),
                 "It was rebuilt in eighteen hundred and twelve.": ("1812", ""),
                 "It was built in 312 AD by the emperor.": ("312 AD", ""),
                 "Caesar died in 44 BC in Rome.": ("44 BC", "")}
        for sentence, want in cases.items():
            got = [(c["big"], c["small"]) for c in self.read(sentence) if not c["skip"]]
            self.assertEqual(got, [want], sentence)
            self.assertEqual(S.date_ok(*want), "", want)

    def test_none_for_decades_centuries_relative_dates_or_no_year(self):
        cases = {"In the late 1980s the room was sealed.": "decade", "In the 1990s nobody came.": "decade",
                 "It was a fifth century text.": "century", "Six months later it was gone.": "relative",
                 "The following spring he left.": "relative", "On March 28th the doors closed.": "no year"}
        for sentence, why in cases.items():
            got = self.read(sentence)
            self.assertTrue(got and all(c["skip"] for c in got), sentence)
            self.assertIn(why, got[0]["skip"], sentence)
        for sentence in ("He may have left early.", "They march to the sea at dawn.", "Over thirty years he kept it."):
            self.assertEqual(self.read(sentence), [], sentence)

    def test_a_list_is_said_in_passing(self):
        toks, _ = toks_for(["In 1947, 1952 and 1956 the scrolls moved.", "Nothing happened for a while.",
                            "Then in 1961 they were sold."])
        got = {c["said"]: c["skip"] for c in S.date_candidates(toks)}
        for y in ("1947", "1952", "1956"):
            self.assertIn("in passing", got[y])
        self.assertEqual(got["1961"], "")

    def test_his_format_checked(self):
        self.assertEqual(S.date_ok("March", "2026"), "")
        self.assertEqual(S.date_ok("Winter", "1941"), "")
        self.assertEqual(S.date_ok("1994", ""), "")
        for bad in (("28 March", "2026"), ("March", ""), ("1994", "2026"), ("Spring", "98"), ("Tuesday", "2026"),
                    ("", "1994"), ("the 1990s", "")):
            self.assertTrue(S.date_ok(*bad), bad)
        # every big line his format allows fits the renderer's measure at full size (880 px; September 632)
        for big in S.MONTHS + list(S.SEASONS):
            self.assertLessEqual(S.date_width_px(big), 880, big)


    def test_a_label_that_names_something_else_gives_way_to_the_name_he_said(self):
        self.assertEqual(M._md_clean_label("The Vatican Apostolic Library", "Vatican Apostolic Library"),
                         "Vatican Apostolic Library")
        self.assertEqual(M._md_clean_label("Rome, Italy", "Rome"), "Rome, Italy")
        self.assertEqual(M._md_clean_label("Giza Plateau", "Alexandria"), "Alexandria")
        self.assertEqual(M._md_clean_label("", "Caddo Lake, Texas"), "Caddo Lake, Texas")


class PlaceRule(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name) / "geo.json"

    def tearDown(self):
        self.tmp.cleanup()

    def ask(self, answers, name, lat, lon, fail=False):
        def get(url, headers):
            if fail:
                raise OSError("down")
            q = re.search(r"q=([^&]+)", url).group(1).replace("+", " ")
            from urllib.parse import unquote
            return json.dumps(answers.get(unquote(q), [])).encode()
        return MAP.geocode(name, lat, lon, self.cache, get=get, sleep=lambda s: None, clock=lambda: 0.0)

    @staticmethod
    def nom(name, lat, lon, km, addresstype="", rank=None, typ="", cls="place"):
        d = km / 222.0
        return {"lat": str(lat), "lon": str(lon), "display_name": name, "boundingbox": [str(lat - d), str(lat + d),
                str(lon - d), str(lon + d)], "category": cls, "type": typ, "addresstype": addresstype,
                "place_rank": rank}

    def test_a_state_a_country_or_a_continent_is_refused(self):
        answers = {"Texas": [self.nom("Texas", 31.0, -99.0, 1300, "state", 8, "administrative", "boundary")],
                   "Rhode Island": [self.nom("Rhode Island", 41.7, -71.5, 90, "state", 8, "administrative", "boundary")],
                   "Egypt": [self.nom("Egypt", 26.8, 30.8, 1500, "country", 4, "administrative", "boundary")],
                   "Vatican City": [self.nom("Vatican City", 41.903, 12.453, 1, "country", 4, "administrative", "boundary")],
                   "Mount Sinai": [self.nom("Mount Sinai", 28.54, 33.97, 2, "peak", 18, "peak", "natural")]}
        for name, (lat, lon) in (("Texas", (31.0, -99.0)), ("Rhode Island", (41.7, -71.5)), ("Egypt", (26.8, 30.8))):
            g = self.ask(answers, name, lat, lon)
            self.assertFalse(g["ok"], name)
            self.assertEqual(g["status"], "region", name)
        self.assertIn("a state as a whole", self.ask(answers, "Rhode Island", 41.7, -71.5)["why"])
        self.assertTrue(self.ask(answers, "Vatican City", 41.903, 12.453)["ok"])      # a city-state
        g = self.ask(answers, "Mount Sinai", 28.54, 33.97)
        self.assertTrue(g["ok"])
        self.assertEqual(g["osm_type"], "peak")                                       # the terrain's hint
        self.assertEqual(S.terrain_of("desert", g["osm_type"], 28.54), "mountains")

    def test_unknown_unreachable_and_far_are_told_apart(self):
        answers = {"Lake Tor": [self.nom("Lake Tor", 50.0, 10.0, 3)]}
        self.assertEqual(self.ask(answers, "Atlantis", 36.0, 25.0)["status"], "unknown")    # a ready-made plate
        self.assertEqual(self.ask({}, "Lake Nyos", 6.4, 10.3, fail=True)["status"], "unreachable")
        self.assertEqual(self.ask(answers, "Lake Tor", 40.0, 10.0)["status"], "far")         # not sure: no map
        self.assertEqual(self.ask(answers, "Lake Tor", None, None)["status"], "input")


class Plates(unittest.TestCase):
    def test_the_ready_made_plates(self):
        from PIL import Image
        self.assertEqual(set(S.PLATES), set(S.TERRAINS))
        meta = json.loads((S.PLATES_DIR / "plates.json").read_text(encoding="utf-8"))
        self.assertIn("CC BY 4.0", meta["licence"])
        for t in S.TERRAINS:
            p = S.plate_for(t)
            self.assertTrue(p.is_file(), t)
            self.assertLess(p.stat().st_size, 800 * 1024, t)                     # committed small
            with Image.open(p) as im:
                self.assertEqual(im.size, (2200, 1560))                          # his plate's rectangle, a texel a unit
            self.assertEqual(meta[t]["file"], p.name)
        self.assertEqual(S.plate_for("lava"), S.plate_for("green"))

    def test_the_terrain_chosen(self):
        self.assertEqual(S.terrain_of("desert", "", 30), "desert")
        self.assertEqual(S.terrain_of("green", "glacier", 46), "snow")
        self.assertEqual(S.terrain_of("green", "", 70), "snow")                  # the far north
        self.assertEqual(S.terrain_of("", "beach", 10), "coast")
        self.assertEqual(S.terrain_of("nonsense", "", 10), "green")
        self.assertEqual(S.terrain_of(None, "forest", 10), "green")

    def test_a_fallback_pick_is_credited(self):
        p = MAP.fallback_place("Caddo Lake, Texas", "desert", "the geocoder could not be asked")
        self.assertEqual((p["provider"], p["license"], p["map"]["fallback"]), ("map", "CC BY 4.0", "desert"))
        self.assertIn("ready-made desert map plate", p["title"])
        self.assertIn("EOX", p["title"])
        self.assertTrue(Path(p["photo"]).is_file())


# ── its place in the pipeline ─────────────────────────────────────────────────────────────────────────────────────────
class Pipeline(unittest.TestCase):
    def test_sync_pins_a_map_and_a_date_on_their_heard_word(self):
        r = {"startMs": 10000, "endMs": 16000, "text": "x", "device": {"id": "location-map", "label": "Rome", "date": "May",
                                                                       "year": "1990"}, "spot": {"ms": 10150}}
        heard = [(4000, "rome"), (10150, "rome"), (13000, "may")]
        self.assertEqual(M._overlay_words(r), ["rome"])                      # the map's own words: its name
        self.assertEqual(M._said_at(r, heard, 0, 30000, (10000, 16000)), 10150)   # never the earlier "Rome"
        self.assertEqual(M._SYNC_RANK["location-map"], M._SYNC_RANK["date-stamp"])
        self.assertGreater(M._SYNC_RANK["date-stamp"], M._SYNC_RANK["typed caption"])   # the date keeps the corner
        self.assertLess(M._SYNC_RANK["date-stamp"], M._SYNC_RANK["chapter-plate"])

    def test_the_pace_code_never_splits_or_joins_them(self):
        rows = rows_for(filler(6), secs=3.0)
        for r in rows:
            r["pick"] = {"photo": f"/p/{r['startMs']}.jpg", "tier": M.KIND, "clean": True}
        rows[2]["device"] = {"id": "date-stamp", "date": "1994", "year": ""}
        rows[4]["device"] = {"id": "location-map", "label": "Rome"}
        cues = cues_for(filler(6), secs=3.0)
        for k in (1, 2, 3, 4):                                              # a date or a map on either side
            self.assertFalse(M._joinable(rows, k), k)
        self.assertTrue(M._joinable(rows, 0))
        self.assertIsNone(M._split_point(rows, 2, cues))
        self.assertIsNone(M._split_point(rows, 4, cues))
        self.assertFalse(M._absorb(rows, 5))                                 # a map never takes a quick shot after it
        self.assertEqual(M._cap_ms(rows[2]), 4500)                            # a date: 4.5 s at most
        self.assertEqual(M._need_ms(rows[2]), 3500)
        self.assertEqual(M._need_ms(rows[4]), 5000)

    def test_the_date_shot_is_clean_and_a_date_on_a_map_comes_in_on_its_word(self):
        from test_mrtruth_gate import cues_of, ident
        rows = film(n=6, texts=False)
        rows[2]["device"] = {"id": "date-stamp", "date": "March", "year": "1994"}
        rows[4]["device"] = {"id": "location-map", "label": "Rome", "date": "March", "year": "1994"}
        rows[4]["pick"] = {"photo": str(S.plate_for("green")), "provider": "map", "tier": 3, "clean": True}
        rows[4]["spot_date"] = {"ms": rows[4]["startMs"] + 3150}
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)), \
                mock.patch.object(M, "_ident", ident), mock.patch.object(M, "_luma", lambda p: 0.3):
            sc = M.scenes(rows, Path(st), cues_of(rows))
        self.assertEqual(sc[2]["grade"], {"lut": M.GRADE["lut"], "vignette": 0.0, "grain": 0.0})
        self.assertEqual(sc[2]["motion"]["fromScale"], sc[2]["motion"]["toScale"])
        self.assertEqual(sc[4]["device"]["dateFrom"], 90)                    # 3.0 s in: its word less the lead
        self.assertEqual(rows[4]["device"].get("dateFrom"), None)            # the plan's row is not changed

    def test_fill_gaps_plain_never_repeats_words_on_screen(self):
        rows = rows_for(filler(10))
        rows[3]["device"] = {"id": "shadow-up", "line": "The register stayed shut"}
        self.assertTrue(M._repeats_words(rows, "the register stayed open", rows[5]["startMs"]))
        self.assertFalse(M._repeats_words(rows, "the register stayed open", rows[3]["startMs"] + 61000))
        self.assertFalse(M._repeats_words(rows, "a quiet morning bell", rows[5]["startMs"]))

    def test_the_map_sound_follows_the_squeezed_camera(self):
        for secs in (5.0, 6.5, 8.0):
            n = round(secs * M.FPS)
            (t, f, keep, a, b), = M._template_sounds([{"startFrame": 0, "durationFrames": n,
                                                        "device": {"id": "location-map", "label": "X"}}])
            chain = M._template_sound_chain(1, t, f, keep, b - a)
            self.assertEqual("asplit" in chain, secs < 8.0)
            self.assertIn(f"adelay={round(M.MAP_SFX_OFFSET_S * 48000)}S", chain)


# ── the gate's map and date rules ─────────────────────────────────────────────────────────────────────────────────────
class Gate(Base):
    def test_breaks_are_repaired_or_dropped_never_a_stop(self):
        rows = film()
        plate = {"photo": str(S.plate_for("green")), "provider": "map", "tier": 3, "clean": True, "bad": []}
        dev = lambda k: (rows[k].get("device") or {}).get("id")
        free = [k for k in range(2, len(rows) - 1) if not dev(k) and not rows[k].get("typedCaption")
                and not dev(k + 1) and not rows[k + 1].get("typedCaption")]
        at = lambda k0: next(k for k in free if k >= k0)
        a, b, c, d, e = at(3), at(8), at(14), at(26), at(38)                # b and d over a minute apart
        # a: a map without its plate; b: a map only 4.3 s long (held from the shot after); c: a date in no format of his;
        # d: a map whose date comes in while its name crosses the corner; e: the same date as d's shot... a date twice
        rows[a]["device"] = {"id": "location-map", "label": "Ostrava Fen"}
        rows[b]["device"], rows[b]["pick"], rows[b]["plate"] = {"id": "location-map", "label": "Pell Ridge"}, plate, plate
        rows[c]["device"] = {"id": "date-stamp", "date": "28 March", "year": "2026"}
        rows[d]["device"], rows[d]["pick"] = {"id": "location-map", "label": "Vatican Apostolic Library", "date": "May",
                                              "year": "1990"}, dict(plate)
        rows[d]["endMs"] = rows[d + 1]["endMs"] - 1500
        rows[d + 1]["startMs"] = rows[d]["endMs"]
        rows[d]["spot_date"] = {"ms": rows[d]["startMs"] + 400}
        rows[e]["device"] = {"id": "date-stamp", "date": "1994", "year": ""}
        rows[e + 1]["device"] = {"id": "date-stamp", "date": "1994", "year": ""}
        for k, say in ((a, "Ostrava Fen"), (b, "Pell Ridge"), (c, "March 2026"), (d, "Vatican Apostolic Library"),
                       (e, "1994"), (e + 1, "1994")):
            rows[k]["text"] = f"{say} {rows[k]['text']}"
        rec, eng = self.gate(rows)
        self.assertNotEqual(rec["result"], "STOPPED", rec.get("left"))
        fixed = {x["rule"] for x in rec["repairs"]}
        self.assertTrue({"map", "date"} <= fixed, rec["repairs"])
        spots = [(M._spot(r), r["device"].get("label") or r["device"].get("date")) for r in rows if M._spot(r)]
        self.assertNotIn(("map", "Ostrava Fen"), spots)                       # no plate: dropped
        self.assertIn(("map", "Pell Ridge"), spots)                           # held to its 5 s
        pell = next(r for r in rows if (r.get("device") or {}).get("label") == "Pell Ridge")
        self.assertGreaterEqual(pell["endMs"] - pell["startMs"], M.MAP_MIN_S * 1000)
        self.assertNotIn(("date", "28 March"), spots)                          # not his format: dropped
        vat = next(r for r in rows if (r.get("device") or {}).get("label") == "Vatican Apostolic Library")
        self.assertFalse(vat["device"].get("date"))                           # its date taken off, the map stays
        self.assertEqual(sum(1 for s in spots if s == ("date", "1994")), 1)   # the same date once
        self.assertFalse([r for r in rows if not r.get("pick") and not M._covered(r)])   # every shot has a picture
        self.assertEqual(rec["places_dates"]["maps"], sum(1 for s in spots if s[0] == "map"))

    def test_a_clean_film_with_a_map_and_a_date_passes(self):
        rows = film()
        plate = {"photo": str(S.plate_for("coast")), "provider": "map", "tier": 3, "clean": True, "bad": []}
        dev = lambda k: (rows[k].get("device") or {}).get("id")
        free = [k for k in range(2, len(rows) - 2) if not dev(k) and not dev(k + 1) and not rows[k].get("typedCaption")]
        k = free[3]
        rows[k]["endMs"] = rows[k + 1]["endMs"] - 2000                      # a 6.6 s map
        rows[k + 1]["startMs"] = rows[k]["endMs"]
        rows[k]["device"], rows[k]["pick"] = {"id": "location-map", "label": "Pell Ridge"}, plate
        j = free[9]
        rows[j]["device"] = {"id": "date-stamp", "date": "Winter", "year": "1941"}
        words = copy.deepcopy(rows)
        words[k]["text"] = "Pell Ridge " + words[k]["text"]
        words[j]["text"] = "Winter 1941 " + words[j]["text"]
        for r, w in zip(rows, words):
            r["text"] = w["text"]
        rec, eng = self.gate(rows)
        self.assertFalse([x for x in rec["repairs"] if x["rule"] in ("map", "date")], rec["repairs"])
        self.assertEqual((rec["places_dates"]["maps"], rec["places_dates"]["dates"]), (1, 1))


if __name__ == "__main__":
    unittest.main()
