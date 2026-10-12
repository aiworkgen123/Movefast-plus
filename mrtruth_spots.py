"""MR TRUTH — the places and dates the narration names (owner 2026-10-11, rulings 3, 4 and 8): the cheap first look in
code. It lists EVERY candidate with the moment it is said - each place name and each date - so that one Claude call a
film (mrtruth.places_and_dates) only has to choose, and so that the plan log can say what became of each one. Nothing
here calls a service or touches the film's rows.

  words     the subtitles' words (the script's own, with their capitals and stops) on the voice's clock: each matched
            to the recogniser's word where they agree (words_heard.json), else spread across its subtitle (`timed`).
  places    runs of capitalised words (inner "of", "de", "al" ... kept: "Valley of the Kings"), a "City, State" pair
            ("Caddo Lake, Texas", "Cairo, Egypt") and a feature said of a state or country ("a forest in Arizona").
            Not a candidate: a person the dossier names, a title before a name ("Father ..."), a describing word
            ("Sicilian", "Egyptian traditions"), a common word that opens a sentence, a month or a weekday. A US state
            alone or a country alone ("Texas", "Egypt") or a continent is listed and refused here, never asked (the
            owner's rule); a city-state (the Vatican, Monaco) is a place; a name that is a state or a country and also
            its best-known city (AMBIGUOUS: "New York", "Washington", "Panama") is asked, marked, and the geocoder's own
            kind still refuses the state or country reading.
  dates     his format: the big line is the month or season as said ("March", "Spring"), the small line the year;
            the day is dropped; a year alone is the big line alone ("1994"). Found: month (day) year, day month year,
            season year, a year alone (digits, "AD"/"BC", or said in words: "nineteen ninety-four"). Listed and refused
            here: a decade, a century, a relative date ("six months later"), a month with no year, and the second and
            later of DATE_LIST_MIN or more dates listed in one sentence, each within DATE_LIST_S of the next (a list
            said in passing; its first is asked, marked). Two dates said close together ("born in 1921 and died in
            1994", "from 1939 until 1945", or in two sentences) are both asked, marked: Claude decides which are said
            in passing (the owner's rule). The same date said again: its first time only (mrtruth decides on the
            answers).
  plates    the ready-made map plates a place falls back to when its own imagery cannot be had (terrain types).
  corner    where the map's name crosses the date's corner while the camera pulls back (a date shares a map's shot only
            once the name is clear of it).
"""
import difflib
import math
import re
import time
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ── the words on the voice's clock ─────────────────────────────────────────────────────────────────────────────────
_NORM = re.compile(r"[^a-z0-9']")


def norm(w: str) -> str:
    """A word as the recogniser's words are kept (mrtruth._heard): lower case, letters, digits and apostrophes."""
    w = unicodedata.normalize("NFKD", str(w or "")).encode("ascii", "ignore").decode()
    return _NORM.sub("", w.lower().replace("’", "'")).strip("'")


def timed(cues: list, heard: list) -> list:
    """[{"w": the word as written, "n": norm, "ms": when it is heard, "s": sentence number, "first": opens it}] for
    every subtitle word, in order. A word the recogniser heard the same way takes its time; any other is spread across
    its own subtitle (the subtitles are the script's words)."""
    toks = []
    for a, b, text in cues or []:
        ws = str(text).split()
        for k, w in enumerate(ws):
            toks.append({"w": w, "n": norm(w), "ms": int(a + (b - a) * k / max(1, len(ws)))})
    hn = [norm(h) for _, h in heard or []]
    if toks and hn:
        sm = difflib.SequenceMatcher(None, [t["n"] for t in toks], hn, autojunk=False)
        for i, j, n in sm.get_matching_blocks():
            for d in range(n):
                toks[i + d]["ms"] = int(heard[j + d][0])
    s, first = 0, True
    for t in toks:
        t["s"], t["first"] = s, first
        first = False
        if re.search(r"[.?!…][\"'”’)\]]*$", t["w"]) and not _ABBR.fullmatch(t["w"].strip("\"'“”‘’()[]")):
            s, first = s + 1, True
    return toks


# a stop after these is not a sentence's end ("In Sept. 1939", "St. Catherine's", "A.D.")
_ABBR = re.compile(r"(?i)(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|mr|mrs|ms|dr|st|mt|ft|fr|jr|sr|no|vol|ca|"
                   r"vs|etc|gen|col|capt|lt|rev|prof)\.|(?:[a-z]\.){2,}")


def _sentences(toks: list) -> dict:
    out = {}
    for k, t in enumerate(toks):
        out.setdefault(t["s"], []).append(k)
    return out


def _said(toks: list, i: int, j: int) -> str:
    return " ".join(t["w"] for t in toks[i:j])


def sentence_of(toks: list, k: int) -> str:
    s = toks[k]["s"]
    return " ".join(t["w"] for t in toks if t["s"] == s)


# ── places ─────────────────────────────────────────────────────────────────────────────────────────────────────────
US_STATES = ("Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia Hawaii Idaho "
             "Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan Minnesota "
             "Mississippi Missouri Montana Nebraska Nevada Ohio Oklahoma Oregon Pennsylvania Tennessee Texas Utah "
             "Vermont Virginia Washington Wisconsin Wyoming").split() + [
    "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Rhode Island",
    "South Carolina", "South Dakota", "West Virginia"]
COUNTRIES = ("Afghanistan Albania Algeria Andorra Angola Argentina Armenia Australia Austria Azerbaijan Bahamas Bahrain "
             "Bangladesh Barbados Belarus Belgium Belize Benin Bhutan Bolivia Botswana Brazil Brunei Bulgaria Burundi "
             "Cambodia Cameroon Canada Chad Chile China Colombia Comoros Congo Croatia Cuba Cyprus Czechia Denmark "
             "Djibouti Dominica Ecuador Egypt Eritrea Estonia Eswatini Ethiopia Fiji Finland France Gabon Gambia "
             "Germany Ghana Greece Grenada Guatemala Guinea Guyana Haiti Honduras Hungary Iceland India Indonesia Iran "
             "Iraq Ireland Israel Italy Jamaica Japan Jordan Kazakhstan Kenya Kiribati Kosovo Kuwait Kyrgyzstan Laos "
             "Latvia Lebanon Lesotho Liberia Libya Lithuania Luxembourg Madagascar Malawi Malaysia Maldives Mali Malta "
             "Mauritania Mauritius Mexico Micronesia Moldova Mongolia Montenegro Morocco Mozambique Myanmar Burma "
             "Namibia Nauru Nepal Netherlands Holland Nicaragua Niger Nigeria Norway Oman Pakistan Palau Palestine "
             "Panama Paraguay Peru Philippines Poland Portugal Qatar Romania Russia Rwanda Samoa Senegal Serbia "
             "Seychelles Slovakia Slovenia Somalia Spain Sudan Suriname Sweden Switzerland Syria Taiwan Tajikistan "
             "Tanzania Thailand Togo Tonga Tunisia Turkey Turkmenistan Tuvalu Uganda Ukraine Uruguay Uzbekistan "
             "Vanuatu Venezuela Vietnam Yemen Zambia Zimbabwe England Scotland Wales Britain America Persia Prussia "
             "Yugoslavia Czechoslovakia Mesopotamia Judea Judaea Palestine Babylonia Assyria").split() + [
    "United States", "United States of America", "United Kingdom", "Great Britain", "Soviet Union", "the USSR", "USSR",
    "USA", "UK", "Northern Ireland", "Saudi Arabia", "South Africa", "South Korea", "North Korea", "New Zealand",
    "Sri Lanka", "Costa Rica", "Puerto Rico", "El Salvador", "Ivory Coast", "Burkina Faso", "Sierra Leone",
    "Papua New Guinea", "Dominican Republic", "Czech Republic", "Bosnia and Herzegovina", "North Macedonia",
    "East Timor", "Cape Verde", "Equatorial Guinea", "South Sudan", "Central African Republic", "United Arab Emirates",
    "Trinidad and Tobago", "Ottoman Empire", "Roman Empire", "Byzantine Empire", "West Germany", "East Germany"]
CONTINENTS = ["Africa", "Europe", "Asia", "Antarctica", "Oceania", "North America", "South America", "Central America",
              "Latin America", "the Americas", "Americas", "Eurasia", "Middle East", "the Middle East", "Scandinavia",
              "the Balkans", "Balkans", "Mediterranean", "the Mediterranean", "Caribbean", "the Caribbean",
              "Arctic", "the Arctic", "Siberia", "Sahara", "the Sahara", "Levant", "the Levant", "Near East"]
# a country that is one city: a specific place (the owner's rule refuses "a country alone" for the countries one ring
# cannot show)
CITY_STATES = {"vatican", "vatican city", "the vatican", "holy see", "monaco", "san marino", "singapore", "hong kong",
               "macau", "macao", "gibraltar", "liechtenstein"}
# a US state or a country that is also its best-known city, said the same way: in narration usually the city ("he moved
# to New York"), which the owner wants mapped. Asked with a note, never refused in code (review 2026-10-12); the
# geocoder's own kind (state, country) still refuses the other reading
AMBIGUOUS = {"new york", "washington", "luxembourg", "panama", "kuwait", "djibouti", "guatemala"}
AMBIGUOUS_NOTE = "may be the city (yes) or the state/country (no)"
_LOWER = lambda xs: {x.lower().removeprefix("the ") for x in xs}
_STATES, _COUNTRIES, _CONTINENTS = _LOWER(US_STATES), _LOWER(COUNTRIES) - CITY_STATES, _LOWER(CONTINENTS)
# words that name a kind of place: a capitalised run with one of them is a place's name more than anything else, and
# "a forest in Arizona" is a place the owner named
FEATURE_WORDS = {
    "lake", "lakes", "river", "creek", "cave", "caves", "cavern", "mountain", "mountains", "mount", "mt", "peak", "hill",
    "hills", "valley", "canyon", "gorge", "forest", "woods", "wood", "desert", "island", "islands", "isle", "bay",
    "gulf", "sea", "coast", "beach", "falls", "springs", "monastery", "abbey", "convent", "priory", "cathedral",
    "church", "chapel", "basilica", "temple", "mosque", "synagogue", "shrine", "castle", "fort", "fortress", "palace",
    "tower", "library", "museum", "university", "college", "seminary", "school", "prison", "penitentiary", "asylum",
    "hospital", "sanatorium", "mine", "quarry", "ranch", "farm", "plantation", "village", "town", "city", "street",
    "square", "bridge", "dam", "reservoir", "swamp", "marsh", "bayou", "glacier", "volcano", "crater", "oasis", "site",
    "ruins", "tomb", "tombs", "cemetery", "graveyard", "pyramid", "pyramids", "station", "base", "camp", "airport",
    "airfield", "harbor", "harbour", "port", "lighthouse", "park", "estate", "manor", "hall", "house", "hotel", "inn",
    "plateau", "pass", "cape", "peninsula", "strait", "lagoon", "fjord", "moor", "heath", "county", "parish", "district",
    "province", "quarter", "archive", "archives", "observatory", "laboratory", "plaza", "road", "avenue", "boulevard"}
_PREPS = {"in", "near", "outside", "at", "on", "by", "off", "above", "below", "beneath", "under", "across", "around",
          "of", "behind", "beyond"}
_CONNECT = {"of", "de", "del", "della", "da", "di", "do", "du", "des", "la", "le", "el", "al", "von", "van", "der",
            "den", "upon"}
HONORIFICS = {"father", "fr", "mr", "mrs", "ms", "miss", "dr", "doctor", "sir", "lord", "lady", "pope", "king", "queen",
              "prince", "princess", "bishop", "archbishop", "cardinal", "brother", "sister", "professor", "prof",
              "captain", "capt", "general", "colonel", "major", "lieutenant", "sergeant", "president", "senator",
              "governor", "judge", "justice", "rabbi", "imam", "reverend", "rev", "deacon", "abbot", "monsignor",
              "emperor", "empress", "tsar", "czar", "sheikh", "agent", "detective", "officer", "nurse", "mother"}
DEMONYMS = {"latin", "greek", "roman", "french", "dutch", "swiss", "thai", "german", "english", "irish", "scottish",
            "welsh", "spanish", "polish", "turkish", "jewish", "arab", "arabic", "hebrew", "coptic", "catholic",
            "protestant", "orthodox", "anglican", "aramaic", "syriac", "persian", "celtic", "norse", "saxon", "gothic",
            "baroque", "victorian", "medieval", "biblical", "christian", "islamic", "muslim", "buddhist", "hindu",
            "pagan", "papal", "apostolic", "patristic", "western", "eastern", "northern", "southern", "nazi",
            "soviet", "american", "british", "european", "african", "asian"}
_DEMONYM_END = re.compile(r"(ian|ean|ese|ish|ic|ite|ist)$")
MONTHS = ("January February March April May June July August September October November December").split()
SEASONS = ("Spring", "Summer", "Autumn", "Fall", "Winter")
WEEKDAYS = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
_GENERIC = {"god", "lord", "heaven", "hell", "church", "state", "government", "library", "museum", "university",
            "archive", "archives", "city", "court", "crown", "empire", "republic", "kingdom", "army", "navy", "police",
            "bible", "gospel", "scripture", "scriptures", "mass", "christ", "jesus", "satan", "devil", "internet",
            "north", "south", "east", "west", "chapter", "part", "book", "the"}
# a word that opens a sentence is capitalised for that reason alone when it is one of these, or when the script also
# writes it in lower case
COMMON_START = {"the", "a", "an", "he", "she", "it", "they", "we", "i", "you", "but", "and", "or", "so", "that", "this",
                "these", "those", "what", "when", "where", "why", "how", "who", "in", "on", "at", "for", "from", "by",
                "with", "not", "no", "yes", "his", "her", "their", "its", "our", "there", "here", "then", "now",
                "after", "before", "during", "some", "several", "many", "one", "two", "three", "if", "all", "other",
                "each", "every", "as", "while", "until", "instead", "even", "only", "also", "still", "yet", "both",
                "either", "neither", "most", "more", "few", "such", "same", "another", "any", "much", "nothing",
                "everything", "someone", "something", "nobody", "none", "within", "without", "between", "among",
                "inside", "outside", "under", "over", "once", "twice", "again", "later", "earlier", "today", "tonight",
                "yesterday", "tomorrow", "maybe", "perhaps", "because", "although", "though", "whether", "unless",
                "since", "however", "therefore", "meanwhile", "eventually", "finally", "first", "last", "next", "kept",
                "heard", "made", "said", "told", "found", "left", "seen", "known", "taken", "given", "read", "written"}
# a word that opens a sentence and ends like these is a common word, not a place's name ("Removing", "Conservation")
_COMMON_END = re.compile(r"(ing|ed|ly|ness|tions?|sions?|ments?|ity|ous|ive|ful|less|ance|ence|ism|ists?|ers?|ies)$")
PLACE_MAX = 80                      # candidates a film may list (an 11-min script: ~15)


def _cap(w: str) -> bool:
    w = w.lstrip("\"'“‘([")
    return bool(w) and w[0].isupper() and any(c.isalpha() for c in w)


def _bare_word(w: str) -> str:
    return w.strip("\"'“”‘’()[],.;:!?…")


def _key(name: str) -> str:
    n = re.sub(r"^the\s+", "", re.sub(r"\s+", " ", str(name or "").strip()).lower())
    return n.rstrip(".")


def _place_kind(name: str) -> str:
    """'state', 'country' or 'continent' for a name that is only that (the owner's rule), else ''. A name in AMBIGUOUS
    reads as its state or country here (after a comma: "Albany, New York"); place_candidates asks it alone."""
    n = _key(name)
    if n in CITY_STATES:
        return ""
    if n in _STATES:
        return "state"
    if n in _COUNTRIES:
        return "country"
    if n in _CONTINENTS:
        return "continent"
    return ""


def _tail_region(toks: list, j: int):
    """The US state or country (one to five words) that starts at token j, as (its end, its name), or None."""
    for n in (5, 4, 3, 2, 1):
        if j + n > len(toks):
            continue
        words = [_bare_word(t["w"]) for t in toks[j:j + n]]
        if not all(words) or not _cap(words[0]):
            continue
        if any(re.search(r"[,.;:!?…]$", t["w"]) for t in toks[j:j + n - 1]):
            continue
        name = " ".join(words)
        if _place_kind(name) in ("state", "country"):
            return j + n, name
    return None


def place_candidates(toks: list, dossier: dict = None) -> list:
    """Every place name the narration says, at its first mention: [{"id", "name", "at_ms", "said", "mentions",
    "skip"}] - `skip` the code's own refusal (a state, a country or a continent alone; "" when it is Claude's to
    decide). See the module's docstring."""
    d = dossier or {}
    people = set()
    for e in d.get("keyEntities") or []:
        if isinstance(e, dict) and str(e.get("kind") or "").lower() == "person":
            people |= {norm(w) for w in str(e.get("name") or "").split()}
    for p in (d.get("visualBrief") or {}).get("people") or []:
        if isinstance(p, dict):
            people |= {norm(w) for w in str(p.get("name") or "").split()}
    people -= {"the", "of", "de", ""} | HONORIFICS
    lower_seen = {t["n"] for t in toks if not t["first"] and t["w"][:1].islower()}
    found, sents = [], _sentences(toks)
    for s, ks in sents.items():
        k, end = 0, len(ks)
        while k < end:
            i = ks[k]
            opens = toks[i]["first"] and (toks[i]["n"] in COMMON_START or toks[i]["n"] in lower_seen or (
                _COMMON_END.search(toks[i]["n"]) and not (k + 1 < end and _cap(toks[ks[k + 1]]["w"]))))
            if not _cap(toks[i]["w"]) or opens:
                # a feature said of a state or a country: "a forest in Arizona", "the caves near Qumran, Texas"
                if toks[i]["n"] in FEATURE_WORDS and k + 2 < end and toks[ks[k + 1]]["n"] in _PREPS \
                        and not re.search(r"[,.;:!?…]$", toks[i]["w"]):
                    reg = _tail_region(toks, ks[k + 2])
                    if reg:
                        found.append((i, reg[0], f"{_bare_word(toks[i]['w'])} {toks[ks[k + 1]]['n']} {reg[1]}", "feature"))
                k += 1
                continue
            j = k
            run = [i]
            while True:                              # the run: capitalised words, inner joining words kept
                if re.search(r"[,.;:!?…)”\"]$", toks[run[-1]]["w"]):
                    break
                nxt = j + 1
                while nxt < end and (toks[ks[nxt]]["n"] in _CONNECT or toks[ks[nxt]]["n"] == "the" and nxt > j + 1) \
                        and toks[ks[nxt]]["w"][:1].islower() and not re.search(r"[,.;:!?…]$", toks[ks[nxt]]["w"]):
                    nxt += 1
                if nxt < end and _cap(toks[ks[nxt]]["w"]):
                    run += [ks[x] for x in range(j + 1, nxt + 1)]
                    j = nxt
                    continue
                break
            stop = run[-1] + 1
            name_toks = [toks[x] for x in run]
            # "Caddo Lake, Texas" / "Cairo, Egypt": a name, a comma, a state or a country
            if toks[run[-1]]["w"].endswith(",") and stop < len(toks) and toks[stop]["s"] == s:
                reg = _tail_region(toks, stop)
                if reg and _place_kind(" ".join(_bare_word(t["w"]) for t in name_toks)) == "":
                    found.append((run[0], reg[0], " ".join(_bare_word(t["w"]) for t in name_toks) + ", " + reg[1], "run"))
                    k = ks.index(reg[0] - 1) + 1 if reg[0] - 1 in ks else end
                    continue
            found.append((run[0], stop, " ".join(_bare_word(t["w"]) for t in name_toks), "run"))
            k = ks.index(run[-1]) + 1
    out, seen = [], {}
    for i, j, name, how in sorted(found, key=lambda f: f[0]):
        name = re.sub(r"'s$|’s$", "", re.sub(r"\s+", " ", name)).strip(" -")
        words = [norm(w) for w in name.split()]
        if not name or not words:
            continue
        if how == "run":
            if words[0] in HONORIFICS and not (set(words) & FEATURE_WORDS):
                continue                             # "Father Emilio Restivo": a person
            if all(w in people for w in words if w not in _CONNECT):
                continue                             # a person the dossier names
            if len(words) == 1 and (words[0] in _GENERIC or words[0] in FEATURE_WORDS or words[0] in WEEKDAYS
                                    or name in MONTHS or name in SEASONS):
                continue
            if all(w.capitalize() in MONTHS or w in WEEKDAYS for w in words):
                continue
            nxt = toks[j]["w"] if j < len(toks) and toks[j]["s"] == toks[i]["s"] else ""
            first = name.split("-")[0].split()[0].lower()
            if len(words) == 1 and (first in DEMONYMS or _DEMONYM_END.search(words[0])) and nxt[:1].islower() \
                    and not re.search(r"[,.;:!?…]$", toks[j - 1]["w"]):
                continue                             # "Sicilian priest", "Greek-language texts": it describes
            if all(w in DEMONYMS for w in words if w not in _CONNECT):
                continue
            if any(c.isdigit() for c in name):
                continue
        key = " ".join(norm(w) for w in name.split(",")[0].split())
        if key in seen:                              # said again: one more mention of the same place
            out[seen[key]]["mentions"].append(toks[i]["ms"])
            continue
        if len(out) >= PLACE_MAX:
            continue
        seen[key] = len(out)
        amb = how == "run" and _key(name) in AMBIGUOUS
        kind = _place_kind(name) if how == "run" and not amb else ""
        out.append({"id": f"p{len(out) + 1}", "name": name, "at_ms": toks[i]["ms"], "tok": i, "said": sentence_of(toks, i),
                    "how": how, "mentions": [toks[i]["ms"]], "note": AMBIGUOUS_NOTE if amb else "",
                    "skip": f"a {kind} alone (the owner: never a US state or a country alone)" if kind in
                    ("state", "country") else "a continent or a wide region" if kind == "continent" else ""})
    return out


# ── dates ──────────────────────────────────────────────────────────────────────────────────────────────────────────
DATE_LIST_S = 4.0                   # dates said closer than this are said close together (marked for Claude)
DATE_LIST_MIN = 3                   # this many or more of them in one sentence are a list: only its first is asked
DATE_MAX = 80
_UNITS = {"zero": 0, "oh": 0, "o": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
          "eight": 8, "nine": 9}
_TEENS = {"ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
          "seventeen": 17, "eighteen": 18, "nineteen": 19}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
_YEAR_CTX = {"in", "of", "since", "until", "till", "by", "from", "to", "during", "around", "circa", "year", "spring",
             "summer", "autumn", "fall", "winter", "early", "late", "mid", "before", "after"} | {m.lower() for m in MONTHS}
_ORD = ("first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth "
        "fifteenth sixteenth seventeenth eighteenth nineteenth twentieth twenty-first twenty-second twenty-third "
        "twenty-fourth twenty-fifth twenty-sixth twenty-seventh twenty-eighth twenty-ninth thirtieth thirty-first").split()
_MONTH_RE = r"(?:" + "|".join(MONTHS) + r"|Jan\.|Feb\.|Mar\.|Apr\.|Jun\.|Jul\.|Aug\.|Sept?\.|Oct\.|Nov\.|Dec\.)"
_SEASON_RE = r"(?:[Ss]pring|[Ss]ummer|[Aa]utumn|[Ff]all|[Ww]inter)"
_DAY_RE = r"(?:\d{1,2}(?:st|nd|rd|th)?|" + "|".join(_ORD) + r")"
_Y4 = r"(?:1[0-9]{3}|20[0-9]{2})"
_YEAR_RE = r"(?:" + _Y4 + r"|'\d{2})(?![\d,]\d|\d|s\b|'s\b|th\b|%)"
_ERA_RE = r"(?:A\.D\.|AD|B\.C\.E?\.?|BCE|BC|CE)"
_NUMW = r"(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|" \
        r"a few|a couple of|several|many|some)"
_DECADE_W = r"(?:twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)"
DATE_PATTERNS = [            # (kind, pattern): the first that matches a stretch of a sentence takes it
    ("dmy", r"(?:\bthe\s+)?\b" + _DAY_RE + r"\s+(?:of\s+)?" + _MONTH_RE + r",?\s+(?:of\s+|in\s+)?" + _YEAR_RE),
    ("mdy", r"\b" + _MONTH_RE + r"\s+(?:the\s+)?" + _DAY_RE + r",?\s+(?:of\s+|in\s+)?" + _YEAR_RE),
    ("my", r"\b" + _MONTH_RE + r",?\s+(?:of\s+|in\s+)?" + _YEAR_RE),
    ("sy", r"(?:\bthe\s+)?(?:\b(?:early|late|mid)[- ])?\b" + _SEASON_RE + r",?\s+(?:of\s+|in\s+)?" + _YEAR_RE),
    ("decade", r"(?i:(?:\bthe\s+)?(?:\b(?:early|mid|late)[- ]?)?(?:\b\d{3}0s\b|'\d0s\b|\b(?:nineteen|eighteen|seventeen)[- ]"
               + _DECADE_W + r"\b|\b(?<=the )" + _DECADE_W + r"\b))"),
    ("century", r"(?i:(?:\b(?:early|mid|late)[- ]?)?\b(?:\d{1,2}(?:st|nd|rd|th)|" + "|".join(_ORD) + r")[- ]centur(?:y|ies)\b)"),
    ("relative", r"(?i:\b" + _NUMW + r"\s+(?:years?|months?|weeks?|days?|decades?|centuries)\s+(?:later|earlier|ago|"
                 r"before|after|on)\b|\b(?:the|that)\s+(?:following|next|previous|same)\s+(?:year|month|spring|summer|"
                 r"autumn|fall|winter|week|day)\b)"),
    ("md", r"\b" + _MONTH_RE + r"\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b|\b(?:the\s+)?" + _DAY_RE + r"\s+of\s+" + _MONTH_RE),
    ("y_era", r"\b\d{1,4}\s?" + _ERA_RE + r"(?![\w.])|\b(?:A\.D\.|AD)\s?\d{1,4}\b"),
    ("y", r"(?<![\w.,'])" + _Y4 + r"(?![\d,]\d|\d|s\b|'s\b|th\b|%|\.\d)"),
]
_DATE_RX = [(k, re.compile(p)) for k, p in DATE_PATTERNS]
# a four-figure number is a year said as one when one of these comes before it ("in 1994", "between 1947 and 1952")
_DATED_BY = _YEAR_CTX | {"between", "and", "or", "c", "ca", "year", "years"}
_SKIP_KIND = {"decade": "a decade (the owner: decades get no date overlay)",
              "century": "a century (the owner: centuries get no date overlay)",
              "relative": "a relative date (the owner: relative dates get no date overlay)",
              "md": "a month and day with no year said"}


def _year4(y: str) -> str:
    y = y.strip()
    if y.startswith("'") and len(y) == 3:                    # '98: the century the two digits most likely mean
        n = int(y[1:])
        return str(1900 + n if n > time.localtime().tm_year % 100 else 2000 + n)
    return y


def _spelled_year(ws: list, k: int):
    """A year said in words at ws[k] ("nineteen ninety four", "eighteen hundred and twelve", "two thousand and nine",
    "twenty twenty six"): (the year, how many words) or None. `ws` are lower-case words, hyphens split."""
    def rest(i):                                 # 1-99 at ws[i]: (value, words)
        if i < len(ws) and ws[i] in _TEENS:
            return _TEENS[ws[i]], 1
        if i < len(ws) and ws[i] in _TENS:
            if i + 1 < len(ws) and ws[i + 1] in _UNITS and ws[i + 1] not in ("zero", "oh", "o"):
                return _TENS[ws[i]] + _UNITS[ws[i + 1]], 2
            return _TENS[ws[i]], 1
        if i < len(ws) and ws[i] in _UNITS and ws[i] not in ("zero", "oh", "o"):
            return _UNITS[ws[i]], 1
        return None
    w = ws[k] if k < len(ws) else ""
    if w in _TEENS and _TEENS[w] >= 10:
        hi = _TEENS[w]
        if k + 1 < len(ws) and ws[k + 1] == "hundred":
            j = k + 2 + (1 if k + 2 < len(ws) and ws[k + 2] == "and" else 0)
            r = rest(j)
            return (hi * 100 + r[0], j - k + r[1]) if r else (hi * 100, 2)
        if k + 2 < len(ws) and ws[k + 1] in ("oh", "o") and ws[k + 2] in _UNITS:
            return hi * 100 + _UNITS[ws[k + 2]], 3
        r = rest(k + 1)
        if r and r[0] >= 10:
            return hi * 100 + r[0], 1 + r[1]
    if w == "two" and k + 1 < len(ws) and ws[k + 1] == "thousand":
        j = k + 2 + (1 if k + 2 < len(ws) and ws[k + 2] == "and" else 0)
        r = rest(j)
        return (2000 + r[0], j - k + r[1]) if r else (2000, 2)
    if w == "twenty":
        r = rest(k + 1)
        if r and r[0] >= 10:
            return 2000 + r[0], 1 + r[1]
    return None


def date_text(kind: str, said: str):
    """(big line, small line) of his overlay for a date as said, or None: the month or season as said and the year;
    a year alone is the big line alone; the day is always dropped."""
    m = re.search(_MONTH_RE, said)
    y = re.search(_YEAR_RE.replace("(?![\\d,]\\d|\\d|s\\b|'s\\b|th\\b|%)", ""), said)
    if kind in ("dmy", "mdy", "my") and m and y:
        mon = m.group(0).rstrip(".")
        mon = next((x for x in MONTHS if x.lower().startswith(mon.lower()[:3])), mon)
        return mon, _year4(y.group(0))
    if kind == "sy":
        s = re.search(_SEASON_RE, said)
        if s and y:
            return s.group(0).capitalize(), _year4(y.group(0))
    if kind == "y_era":
        return re.sub(r"\s+", " ", said.strip().rstrip(".")).replace("A.D.", "AD").replace("B.C.", "BC"), ""
    if kind == "y":
        return _year4(said.strip()), ""
    return None


def date_ok(big: str, small: str) -> str:
    """"" when (big, small) is his format, else what is wrong: the big line a month, a season or a year; the small line a
    year or nothing (nothing when the big line is the year); no day; within the renderer's letters (24 / 12)."""
    big, small = str(big or "").strip(), str(small or "").strip()
    yr = lambda s: bool(re.fullmatch(r"(?:\d{1,4}\s?(?:AD|BC|BCE|CE)|(?:AD)\s?\d{1,4}|\d{4})", s))
    if not big:
        return "the big line is empty"
    if big in MONTHS or big in SEASONS:
        if not re.fullmatch(r"\d{4}", small):
            return f"'{big}' has no year under it"
        return ""
    if yr(big):
        return "" if not small else f"a year alone ('{big}') carries no second line"
    if re.search(r"\d", big) and not yr(big):
        return f"'{big}' carries a day or a number that is not a year"
    return f"'{big}' is not a month, a season or a year"


def date_candidates(toks: list) -> list:
    """Every date the narration says: [{"id", "kind", "said", "at_ms", "big", "small", "skip"}] in film order - `skip`
    the code's own refusal (a decade, a century, a relative date, a month with no year, a list said in passing); ""
    when it is Claude's to decide whether it is important. See the module's docstring."""
    out = []
    for s, ks in _sentences(toks).items():
        # a year said in words becomes its digits first (its first word's time), when a word before it says "a year"
        words, idx, k = [], [], 0
        low = [re.sub(r"[^a-z\-]", "", toks[i]["w"].lower()) for i in ks]
        while k < len(ks):
            parts = low[k].split("-") if low[k] else [""]
            sp = None
            if parts[0] in _TEENS or parts[0] in ("two", "twenty"):
                flat, owner = [], []
                for x in range(k, min(len(ks), k + 6)):
                    for p in (low[x].split("-") if low[x] else [""]):
                        flat.append(p)
                        owner.append(x)
                got = _spelled_year(flat, 0)
                prev = low[k - 1] if k else ""
                if got and 1000 <= got[0] <= 2099 and (prev in _YEAR_CTX or prev.capitalize() in MONTHS):
                    n = owner[got[1] - 1] - k + 1
                    end = toks[ks[k + n - 1]]["w"]
                    sp = (str(got[0]) + (end[-1] if re.search(r"[,.;:!?…]$", end) else ""), n)
            if sp:
                words.append(sp[0])
                idx.append(ks[k])
                k += sp[1]
            else:
                words.append(toks[ks[k]]["w"])
                idx.append(ks[k])
                k += 1
        text, starts, pos = "", [], 0
        for w in words:
            starts.append(pos)
            text += w + " "
            pos += len(w) + 1
        used = []
        for kind, rx in _DATE_RX:
            for m in rx.finditer(text):
                a, b = m.span()
                if any(a < y and x < b for x, y in used):
                    continue
                used.append((a, b))
                said = m.group(0).strip()
                lead = re.match(r"(?:the|on|in)\s+", said, re.I)
                at_char = a + (lead.end() if lead else 0)
                w = max(n for n, st in enumerate(starts) if st <= at_char)
                raw = text[:a].split()[-1] if text[:a].split() else ""
                prev = "and" if re.fullmatch(r"\d{3,4}[,;]?", raw) else re.sub(r"[^a-z.]", "", raw.lower())
                c = {"kind": kind, "said": said, "at_ms": toks[idx[w]]["ms"], "tok": idx[w], "sentence": sentence_of(toks, idx[w]),
                     "skip": _SKIP_KIND.get(kind, ""), "dated": kind != "y" or prev.rstrip(".") in _DATED_BY}
                txt = date_text(kind, said) if not c["skip"] else None
                c["big"], c["small"] = txt if txt else ("", "")
                if not c["skip"] and not txt:
                    c["skip"] = "not a date the overlay can say"
                out.append(c)
    out.sort(key=lambda c: (c["at_ms"], c["tok"]))
    for n, c in enumerate(out):
        c["id"], c["note"] = f"d{n + 1}", ""
    # dates said close together (each within DATE_LIST_S of the next): two, or across sentences, are asked with a note
    # (Claude decides which are said in passing - the owner's rule); DATE_LIST_MIN or more in one sentence are a list,
    # its first asked (marked) and the rest refused here
    real = [c for c in out if c["kind"] in ("dmy", "mdy", "my", "sy", "y", "y_era", "md") and c["dated"]]
    k = 0
    while k < len(real):
        j = k
        while j + 1 < len(real) and real[j + 1]["at_ms"] - real[j]["at_ms"] <= DATE_LIST_S * 1000:
            j += 1
        run = real[k:j + 1]
        for sent in sorted({toks[c["tok"]]["s"] for c in run}):
            lst = [c for c in run if toks[c["tok"]]["s"] == sent]
            if len(lst) >= DATE_LIST_MIN:
                span = (lst[-1]["at_ms"] - lst[0]["at_ms"]) / 1000
                if not lst[0]["skip"]:
                    lst[0]["note"] = f"the first of {len(lst)} dates listed in one sentence"
                for c in lst[1:]:
                    if not c["skip"] or c["kind"] == "md":
                        c["skip"] = f"said in passing: {len(lst)} dates listed within {span:.1f}s (a list; its first is asked)"
        ask = [c for c in run if not c["skip"]]
        for c in ask:
            if not c["note"] and len(ask) > 1:
                c["note"] = "said close together with " + ", ".join(
                    f"{o['id']} ({abs(o['at_ms'] - c['at_ms']) / 1000:.1f}s apart)" for o in ask if o is not c)
        k = j + 1
    for c in out:                                # "the fall of 1453": a siege's end as often as autumn (review 2026-10-12)
        if c["big"] == "Fall" and not c["skip"]:
            c["note"] = "; ".join(x for x in (c["note"], "'fall' may be the fall of a place or a regime, not autumn") if x)
    return out[:DATE_MAX]


# ── the ready-made plates (owner 2026-10-11, ruling 3 B): our own graded maps by terrain, made once (make_plates) from
# the same EOX Sentinel-2 cloudless 2016 imagery (CC BY 4.0) of a representative place, committed small. A place whose
# own imagery cannot be had takes the plate of its terrain; the ring and the name are drawn on its centre. Chosen by
# look (2026-10-11): an open-sea coast (Dubrovnik, Split, St Malo, Stockholm) shows the mosaic's flat deep-water fill and
# its edge, Siwa's sand went grey under his curve, Kangerlussuaq's meltwater ponds and Svalbard's gaps read as blots ──
PLATES_DIR = HERE / "assets" / "mrtruth_maps"
TERRAINS = ("green", "desert", "mountains", "coast", "snow")
PLATES = {   # terrain: (file, the representative place, lat, lon)
    "green": ("terrain_green.jpg", "Lake Monoun, Cameroon (his own reference's ground)", 5.5729, 10.5853),
    "desert": ("terrain_desert.jpg", "Erg Chebbi, Morocco (the Sahara's edge)", 31.15, -3.97),
    "mountains": ("terrain_mountains.jpg", "Leadville, Colorado (the Rocky Mountains)", 39.2508, -106.2925),
    "coast": ("terrain_coast.jpg", "Itea, Greece (the Gulf of Corinth)", 38.4326, 22.4227),
    "snow": ("terrain_snow.jpg", "the Jungfrau, Switzerland (the Alps' snowfields)", 46.547, 7.985),
}
_TYPE_TERRAIN = {"peak": "mountains", "mountain_range": "mountains", "volcano": "mountains", "ridge": "mountains",
                 "valley": "mountains", "glacier": "snow", "ice": "snow", "beach": "coast", "bay": "coast",
                 "coastline": "coast", "cape": "coast", "island": "coast", "islet": "coast", "peninsula": "coast",
                 "strait": "coast", "desert": "desert", "sand": "desert", "dune": "desert", "wood": "green",
                 "forest": "green", "wetland": "green", "water": "green", "lake": "green", "river": "green"}


def terrain_of(claude: str, osm_type: str = "", lat=None) -> str:
    """The plate a place falls back to: the geocoder's own kind when it says one (a peak, a glacier, a beach...), the
    far north and south snow, else Claude's word for the land around it, else green."""
    t = _TYPE_TERRAIN.get(str(osm_type or "").lower())
    if t in ("mountains", "snow", "coast", "desert"):
        return t
    try:
        if lat is not None and abs(float(lat)) >= 66.0:
            return "snow"
    except (TypeError, ValueError):
        pass
    c = str(claude or "").strip().lower()
    return c if c in TERRAINS else (t or "green")


def plate_for(terrain: str) -> Path:
    """The ready-made plate of a terrain (green when the word is unknown)."""
    f = PLATES.get(terrain if terrain in PLATES else "green")[0]
    return PLATES_DIR / f


# ── the date's corner on a map's shot ──────────────────────────────────────────────────────────────────────────────
# mirrors of locationMapClock.ts (camera, label) and dateStampClock.ts (the block's place): a date shares a map's shot
# only from the frame the map's name, its shadow and its line are clear of the date's corner to the shot's end
_CAM = {"tilt": 37.9842, "end": 12.985, "turn": -33.9937, "pull": 0.86644, "persp": 1600.0}
_LABEL = {"pen": 100.46, "base": -1.58, "cap": 48.6, "pitch": 0.95, "size": 69.4, "slide": 44.67, "in": (20.728, 50.982),
          "margin": 12.0}
_DATE_BOX = {"right": 1840.0, "top_date": 190.1 - 130 * (0.5 + (1036 - 335) / 2000), "year_base": 269.0, "pad": 14.0,
             "rise": 60.0}


def _ease_io(t: float) -> float:
    x = min(1.0, max(0.0, t))
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def _screen(x: float, y: float, f: float, n: int) -> tuple:
    q = 1 - _ease_io(f / max(1, n))
    T, Z, S = math.radians(_CAM["tilt"] * q), math.radians(_CAM["end"] + _CAM["turn"] * q), 1 + _CAM["pull"] * q
    x, y = x * S, y * S
    x, y = x * math.cos(Z) - y * math.sin(Z), x * math.sin(Z) + y * math.cos(Z)
    y, z = y * math.cos(T), y * math.sin(T)
    k = _CAM["persp"] / (_CAM["persp"] - z)
    return 960 + x * k, 540 + y * k


_DATE_ADV = {}


def _date_table() -> dict:
    """DM Serif Display's advances (1/1000 em) as dateStampClock.ts sets the month line (its DATE_CHARS: printable ASCII,
    Latin-1 and the dashes, quotes and ellipsis, in that order), read off that file once; {} when it cannot be read."""
    if "t" not in _DATE_ADV:
        chars = ("".join(chr(c) for c in range(0x20, 0x7F)) + "".join(chr(c) for c in range(0xA0, 0x100))
                 + "\u2013\u2014\u2018\u2019\u201c\u201d\u2026")
        try:
            src = (HERE / "mrtruth_renderer" / "src" / "remotion" / "animations" / "dateStampClock.ts").read_text()
            adv = [int(x) for x in re.findall(r"\d+", re.search(r"DATE_ADVANCES: readonly number\[\] = \[(.*?)\]", src,
                                                                re.S).group(1))]
            _DATE_ADV["t"] = dict(zip(chars, adv)) if len(adv) == len(chars) else {}
        except (OSError, AttributeError, ValueError):
            _DATE_ADV["t"] = {}
    return _DATE_ADV["t"]


def date_width_px(text: str, size: float = 130.0) -> float:
    """The big line's width at `size` px in DM Serif Display, kerning left out (as dateStampDateWidthPx: never narrower
    than drawn); a character the table lacks counts a full em. The year line is set in Libre Baskerville at half the
    size: its digits are under 0.72 em, so this table (digits 0.35-0.54 em) is scaled by 1.4 for it by the caller."""
    t = _date_table()
    if not t:
        return sum(0.55 if c.isdigit() else 0.25 if c == " " else 0.95 for c in str(text)) * size
    return sum(t.get(c, 1000) for c in str(text)) / 1000 * size


def label_box_units(label: str) -> tuple:
    """(x0, x1, y0, y1) of the map's name in map units, as locationMapLabelLayout sets it (one or two lines), with its
    shadow's reach."""
    import mrtruth_map
    lay = mrtruth_map.label_layout(label)
    size = lay["size"]
    wide = max(mrtruth_map.label_width(x, size) for x in lay["lines"])
    rise = (len(lay["lines"]) - 1) * _LABEL["pitch"] * size
    m = _LABEL["margin"]
    return (_LABEL["pen"] - m, _LABEL["pen"] + wide + m, _LABEL["base"] - _LABEL["cap"] * size / _LABEL["size"] - rise - m,
            _LABEL["base"] + m)


def corner_clear_frame(label: str, date: str, year: str, frames: int):
    """The first frame from which the map's name (and its line) stays clear of the date's corner to the end of a
    `frames`-long map shot; None when it never is."""
    x0, x1, y0, y1 = label_box_units(label)
    w = max(date_width_px(date, 130.0), 1.4 * date_width_px(year, 65.0) if year else 0.0)
    bx0 = _DATE_BOX["right"] - w - _DATE_BOX["pad"]
    by1 = _DATE_BOX["year_base"] + 0.27 * 65 + _DATE_BOX["pad"] + _DATE_BOX["rise"]
    clear = None
    for f in range(frames):
        t = min(1.0, max(0.0, (f - _LABEL["in"][0]) / (_LABEL["in"][1] - _LABEL["in"][0])))
        slide = _LABEL["slide"] * (1 - t) if f >= _LABEL["in"][0] else 0.0
        pts = [_screen(x, y + slide, f, frames) for x in (x0, x1) for y in (y0, y1)]
        pts += [_screen(x, y, f, frames) for x in (77.5, 450.0) for y in (34.0, 41.0)]       # the line, where it shows
        sx1 = max(p[0] for p in pts)
        sy0 = min(p[1] for p in pts)
        hit = f >= _LABEL["in"][0] - 1 and sx1 >= bx0 and sy0 <= by1
        if hit:
            clear = None
        elif clear is None:
            clear = f
    return clear
