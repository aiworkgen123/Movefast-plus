"""The shared edit library (Construction Legends edits from VPP's template library, synced into legends_renderer/
by update_legends.sh) in Documentary.

The director chooses a JOB ("a date here", "a share here"); the code chooses how it looks. Kit-locked jobs get one
look for the whole video (kit.json), different from the previous video's kit; content-led edits (charts, timelines,
maps, diagrams) follow the content. Two render modes:
  scene — the edit is its own timeline scene (own photos or none), added like the other scene DLCs;
  over  — the edit runs over the real picture: its time window is cut from the finished picture, handed to the edit
          as its footage and laid back over that window in the final mix (it can span cuts).
Each edit keeps its own sounds (legends/sounds.json, mixed by make_video._with_edit_sounds).
"""
import hashlib
import json
import math
import random
import re
import shutil
import subprocess
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
RENDERER = HERE / "legends_renderer"
FPS = 30
_RENDER_LOCK = threading.Lock()

# Kit-locked jobs: what the director asks for, its options (library edits, or "movefast" = the existing MoveFast tool).
# Overlaps: the MoveFast treatments the chosen library look replaces for this video.
JOBS = {
    "date": ("a stated calendar date or year anchors the moment", ["corner-date", "date-highlight", "year-drop", "movefast"],
             {"text": ["date"], "war_chess": ["P14"], "graphic": ["dateline"]}),
    "name-label": ("a person or a named machine/place is introduced on the real footage", ["typed-label", "portrait-name", "inset-portrait", "movefast"],
                   {"text": ["name"], "war_chess": ["WC08"]}),
    "quantity": ("a consequential number with its unit", ["number-tag", "stat-pill", "movefast"],
                 {"text": ["number"], "war_chess": ["WC09"], "graphic": ["number"]}),
    "sentence-on-screen": ("one key spoken sentence deserves to be read on screen, word by word as it is said", ["word-reveal", "pan-sentence", "movefast"],
                           {"war_chess": ["P02"]}),
    "impact-word": ("one heavy word (WOUNDED, BANKRUPT) or a short headline carries the turn", ["impact-word", "drop-headline", "movefast"],
                    {"war_chess": ["P01"]}),
    "chapter-title": ("a new chapter or era starts", ["boxed-title", "kicker-payoff", "movefast"], {}),
    "object-label": ("a machine, part or object on screen needs its name", ["paper-label", "inset-clip", "movefast"], {"text": ["place"]}),
    "quote-highlight": ("two to four short spoken phrases land one after another (No charges. No trial.)", ["phrase-boxes", "movefast"],
                        {"war_chess": ["P03"]}),
}

# id: (job or None for content-led, mode, media, fields example, useful when)
EDITS = {
    "corner-date": ("date", "over", "footage", {"date": "March 17", "year": "1930"}, "a small date in the corner of the footage"),
    "date-highlight": ("date", "over", "footage", {"date": "June 14", "year": "1940"}, "a date with a yellow highlight"),
    "year-drop": ("date", "over", "footage", {"year": "1966"}, "a big year drops onto the picture with a boom"),
    "typed-label": ("name-label", "over", "footage", {"name": "Rudolf Diesel", "role": "Inventor"}, "a typed name and role"),
    "portrait-name": ("name-label", "over", "footage+portrait", {"name": "J. P. Morgan", "role": "Banker", "portrait": "$P1"},
                      "a framed portrait drops in with the name; needs a real photo of the person"),
    "inset-portrait": ("name-label", "over", "footage+portrait", {"name": "Ed Cole", "role": "GM engineer", "portrait": "$P1"},
                       "the footage softens and a framed portrait appears with the name; needs a real photo"),
    "number-tag": ("quantity", "over", "footage", {"value": 57000, "unit": "tons of steel"}, "a number counts up with its unit"),
    "stat-pill": ("quantity", "over", "footage", {"value": "2%", "label": "rural homes"}, "a compact value pill"),
    "word-reveal": ("sentence-on-screen", "scene", "none", {"text": "the exact spoken sentence, 3-16 words", "stress": ["KEYWORD"]},
                    "a spoken sentence appears word by word on the black grid"),
    "pan-sentence": ("sentence-on-screen", "scene", "none", {"text": "the exact spoken sentence, 3-14 words", "followUp": "optional next spoken words"},
                     "the camera pans along a spoken sentence on the grid"),
    "impact-word": ("impact-word", "over", "footage", {"word": "WOUNDED"}, "the picture turns red and one word slams in"),
    "drop-headline": ("impact-word", "over", "footage", {"text": "CLEARING RADIO ROW"}, "a short headline falls in over the picture"),
    "boxed-title": ("chapter-title", "over", "footage", {"text": "THE RISE"}, "a chapter title types into a dark box"),
    "kicker-payoff": ("chapter-title", "over", "footage", {"kicker": "A new kind of", "subtitle": "for the farmer", "word": "FREEDOM"},
                      "two small italic lines and one big payoff word"),
    "paper-label": ("object-label", "over", "footage", {"text": "STEAM BOILER"}, "a rough paper strip names the object"),
    "inset-clip": ("object-label", "over", "footage", {"caption": "Assembly line, 1913"}, "the footage floats in a small card with a caption"),
    "phrase-boxes": ("quote-highlight", "over", "footage", {"phrases": ["No charges.", "No trial."]}, "spoken phrases wipe in one by one"),
    # content-led
    "double-portrait": (None, "over", "footage+portrait", {"name": "Henry Ford", "role": "Founder", "portrait": "$P1"},
                        "a person's first close introduction: portrait pushes in, the name types, an arrow draws"),
    "evidence-callout": (None, "over", "footage", {"title": "The engine that changed it", "body": "the exact supporting sentence (4-30 words)",
                                                    "source": "who reported it"}, "a stated document, report or record is quoted as evidence"),
    "bar-chart": (None, "scene", "none", {"orientation": "vertical", "title": "Thermal Efficiency, c. 1897", "unit": "%",
                                          "bars": [{"label": "Diesel", "value": 26}, {"label": "Steam", "value": 10}], "highlight": 0,
                                          "valueTitle": "Useful work (%)", "categoryTitle": "Engine type"},
                  "2-6 stated values compared (vertical; horizontal for big counts like workers)"),
    "line-plot": (None, "scene", "none", {"title": "Race to 210 Shafts", "points": [{"label": "Day 0", "value": 0}, {"label": "Day 5", "value": 220}],
                                          "xTitle": "Days", "yTitle": "Shafts"}, "3-8 stated values over time (a running total, a climb)"),
    "share-pie": (None, "scene", "none", {"caption": "U.S. Power Use 1943-45", "label": "Oak Ridge Share", "shares": [1, 6]},
                  "a stated share of a whole (one seventh, half)"),
    "percent-gauge": (None, "scene", "none", {"title": "Useful work", "value": 26, "precision": 0, "caption": "of the fuel's energy"},
                      "one stated percentage"),
    "wave-timeline": (None, "scene", "none", {"leftTitle": "Forced Out", "rightTitle": "New Refuge", "startLabel": "Franco-Prussian War",
                                              "endLabel": "London Refuge", "milestones": ["Enemy Aliens", "Expelled", "Almost Nothing", "Channel Crossing"]},
                      "a journey of exactly four stated ups and downs between a start and an end"),
    "span-timeline": (None, "scene", "none", {"startTag": "1890", "startLabel": "Berlin explosion", "span": "Months", "endTag": "Aftermath",
                                              "endLabel": "Eyesight damaged"}, "a stated start, a stated span and what it led to"),
    "world-tour-map": (None, "scene", "none", {"caption": "Steel: Seattle to Japan", "highlights": [{"country": "United States", "tone": "red", "words": "Seattle"},
                                                                                                  {"country": "Japan", "tone": "blue", "words": "Japan"}]},
                       "goods, people or ideas move between countries (red = from, blue = to)"),
    "route-map": (None, "scene", "none", {"from": {"name": "Seattle", "country": "United States", "lat": 47.6, "lon": -122.3},
                                          "to": {"name": "Newark", "country": "United States", "lat": 40.7, "lon": -74.2},
                                          "fromLabel": "Pacific Car & Foundry, Seattle", "toLabel": "Staging Yards, New Jersey"},
                  "a stated journey from one place to another (lat/lon: your best guess; the gazetteer refines it)"),
    "country-flags-map": (None, "scene", "flags", {"country": "Germany", "flags": ["United States", "United Kingdom", "France"], "caption": "THE SUBMARINE RACE"},
                          "several nations are involved in one country's story (1-6 flags)"),
    "red-dossier": (None, "scene", "photos", {"name": "John D. Rockefeller", "role": "Oil magnate", "photos": ["$P1", "$P2"]},
                    "a powerful person's dossier: 1-3 real photos of them"),
    "portrait-quote": (None, "scene", "portrait", {"quote": "the exact quoted words as spoken", "author": "Thomas Edison", "role": "Inventor", "portrait": "$P1"},
                       "the narration quotes a person's own words"),
    "evidence-leaders": (None, "scene", "photo", {"media": "$A1", "labels": ["Power shovels", "Spoil barges"]},
                         "1-3 things to point at in one real photo"),
    "measure-radar": (None, "scene", "cutout", {"object": "$C1", "measurements": [{"value": "70ft", "label": "Depth to bedrock"}]},
                      "1-2 stated measurements of one object"),
    "checklist": (None, "over", "footage", {"title": "Why the seals wore out", "items": ["Heat", "Friction", "Chatter marks"]},
                  "a list of 3-5 points ticked off one by one, over the picture"),
    "comparison": (None, "over", "footage", {"title": "Gasoline against diesel", "sides": [
                       {"name": "Gasoline Sixty", "value": "8.7 hp-hr/gal"}, {"name": "Diesel Sixty", "value": "11.4 hp-hr/gal"}]},
                   "two things side by side, each with its stated value, over the picture"),
    "stamp": (None, "over", "footage", {"text": "CANCELLED"}, "a verdict stamped onto the picture (1-4 words)"),
    "news-ticker": (None, "over", "footage", {"label": "1974", "text": "GM postpones the rotary engine, blaming emissions",
                                               "speed": 120}, "a scrolling news bar of the stated reports"),
    "red-wash": (None, "over", "footage", {}, "the picture turns red from the centre before a hard cut — no text"),
}
WORD_SYNC = {"word-reveal": ("text", "wordStarts"), "pan-sentence": ("text", "wordStarts"), "drop-headline": ("text", "wordStarts"),
             "phrase-boxes": ("phrases", "phraseStarts")}


def _style_info(engine, style):
    return (getattr(engine, "STYLE_INFO", {}) or {}).get(style) or {}


def enabled(engine, style):
    look = _style_info(engine, style).get("look") or {}
    return (look.get("legends", style == "documentary") and (getattr(engine, "_FEATURES", {}) or {}).get("motion", True)
            and (RENDERER / "catalog.json").exists())


def skin(engine, style):
    return str((_style_info(engine, style).get("look") or {}).get("legends_skin") or "documentary")


def _load(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def _dump(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=1, ensure_ascii=False))


def _hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def catalog():
    return _load(RENDERER / "catalog.json", {})


# ---------------------------------------------------------------- kit: one look per job per video
import os as _os
VARIETY = _os.environ.get("MORE_EDITS", "1") == "1"   # owner 2026-10-05: every look in the channel is meant to be used —
                                                      # no per-video lock to one variant per job


def variants(name):
    """Every library variant of a job (date: corner-date, date-highlight, year-drop …), MoveFast's own excluded."""
    return [o for o in JOBS[name][1] if o != "movefast" and o in EDITS]


def kit(job, style, title=""):
    """This video's look per job (job/legends/kit.json), never the previous video's look for a job when another exists."""
    path = job / "legends" / "kit.json"
    got = _load(path, None)
    if got:
        return got
    last_f = HERE / "output" / style / "_last_kit.json"
    last = _load(last_f, {})
    rng = random.Random(f"{title}|{job.name}")
    got = {}
    for name, (_purpose, options, _over) in JOBS.items():
        allowed = [o for o in options if o != last.get(name)] or options
        got[name] = rng.choice(allowed)
    _dump(path, got)
    _dump(last_f, got)
    return got


def blocked(kit_now):
    """The MoveFast treatments a chosen library look replaces: {tool: {type or style}} — none in variety mode, where
    MoveFast's own date, label and number treatments are among the channel's looks too."""
    out = {}
    if VARIETY:
        return out
    for name, look in kit_now.items():
        if look != "movefast":
            for tool, kinds in JOBS[name][2].items():
                out.setdefault(tool, set()).update(kinds)
    return out


def _limits(eid):
    """The edit's own text limits, so the director picks text that fits instead of text the edit refuses."""
    out = []
    for field, lim in ((catalog().get(eid) or {}).get("textLimits") or {}).items():
        if isinstance(lim, dict) and lim.get("maxChars"):
            words = lim.get("maxWords")
            out.append(f"{field} ≤{words} word{'s' if words != 1 else ''}/{lim['maxChars']} chars" if words else f"{field} ≤{lim['maxChars']} chars")
    return f" (limits: {', '.join(out)})" if out else ""

def prompt_block(job, style, title=""):
    import guide
    if guide.load(style):
        rows = ["- legends — a library edit on its exact spoken cue; name the EDIT and fill its fields:",
                '  {"tool":"legends","edit":"corner-date","cue":4,"words":"on March 17, 1930","reason":"anchor the opening",'
                '"brief":"the date the plant opened","duration":4,"fields":{"date":"March 17","year":"1930"},"media":[]}',
                "  Text comes from the narration: exact words or a faithful short label; never invent numbers, dates, names or quotes.",
                "  Photos: media:[{\"id\":\"P1\",\"subject\":\"...\",\"query\":\"precise real-photo search\",\"cutout\":true}] and \"$P1\" in fields.",
                "  Fields of each edit:"]
        off = guide.off(style)
        for eid, (_jobname, _mode, media, fields, how) in EDITS.items():
            if f"legends:{eid}" in off:
                continue
            rows.append(f"    {eid}: {how}. fields {json.dumps(fields, ensure_ascii=False)}{_limits(eid)}"
                        + (" — needs a portrait photo (P1, cutout)" if "portrait" in media else ""))
        return "\n".join(rows) + "\n"
    k = kit(job, style, title)
    rows = ["- legends — a library edit on its exact spoken cue; name the JOB (kit look) or the EDIT (content-led) and fill its fields:",
            '  {"tool":"legends","job":"date","cue":4,"words":"on March 17, 1930","reason":"anchor the opening","brief":"the date the plant opened","duration":4,',
            '   "fields":{"date":"March 17","year":"1930"},"media":[]}',
            '  {"tool":"legends","edit":"bar-chart","cue":9,"words":"twenty-six percent against ten","reason":"...","brief":"...","duration":7,"fields":{...}}',
            "  Text comes from the narration: exact words or a faithful short label; never invent numbers, dates, names or quotes.",
            "  Photos: media:[{\"id\":\"P1\",\"subject\":\"...\",\"query\":\"precise real-photo search\",\"cutout\":true}] and \"$P1\" in fields.",
            "  These looks are this channel's signature. Whenever the narration states a date or year, a consequential number,",
            "  a key sentence, a heavy word, an object on screen, a chapter turn or a run of short phrases, use the JOB below for it",
            "  (not the overlapping text/graphic/war_chess treatment). Use the content-led EDITS when the numbers, places or people fit.",
            "  JOBS (this video's look):"]
    if VARIETY:
        rows[-1] = ("  JOBS — every look below belongs to this channel; name the EDIT to choose one, and VARY them across the"
                    " video (a date as a corner tag here, a big centred year there, MoveFast's own dateline elsewhere);"
                    " prefer a look not used yet:")
        rows[-3] = rows[-3].replace("use the JOB below for it", "use one of the looks below or MoveFast's own treatment for it")
        rows[-2] = rows[-2].replace("(not the overlapping text/graphic/war_chess treatment). ", "")
        for name in JOBS:
            for look in variants(name):
                _job, mode, media, fields, how = EDITS[look]
                rows.append(f"    {name} → {look}: {how}. fields {json.dumps(fields, ensure_ascii=False)}{_limits(look)}"
                            + (" — needs a portrait photo (P1, cutout)" if "portrait" in media else ""))
    for name, look in ([] if VARIETY else k.items()):
        if look == "movefast":
            continue
        _job, mode, media, fields, how = EDITS[look]
        rows.append(f"    {name}: {JOBS[name][0]}. Look: {how}. fields {json.dumps(fields, ensure_ascii=False)}{_limits(look)}"
                    + (" — needs a portrait photo (P1, cutout)" if "portrait" in media else ""))
    rows.append("  EDITS (content-led, choose when the content fits):")
    for eid, (jobname, mode, media, fields, how) in EDITS.items():
        if jobname is None:
            rows.append(f"    {eid}: {how}. fields {json.dumps(fields, ensure_ascii=False)}{_limits(eid)}")
    return "\n".join(rows) + "\n"


def _short_number(item) -> bool:
    """number-tag lays its unit off the left edge under a one- or two-digit number (library bug, reported to
    "vpp edit 2"): such a number goes to stat-pill instead."""
    v = str((item.get("fields") or {}).get("value") or "").replace(",", "").strip()
    return 0 < len(v) <= 2


def edit_of(item, job, style):
    """The library edit an item asks for, or None. In variety mode any variant may be named (the template guide
    suggests which, in turn); a bare job keeps this video's look for it."""
    if item.get("edit") in EDITS and (EDITS[item["edit"]][0] is None or VARIETY):
        if item["edit"] == "number-tag" and _short_number(item):
            return "stat-pill"
        return item["edit"]
    look = kit(job, style).get(str(item.get("job") or ""))
    return look if look in EDITS else None


READ_WPS = 2.5   # owner 2026-10-06: text stays up long enough to read — about 2.5 words a second, plus a beat


def _words(v) -> int:
    if isinstance(v, str):
        return len(v.split()) if not v.startswith("$") else 0
    if isinstance(v, (list, tuple)):
        return sum(_words(x) for x in v)
    if isinstance(v, dict):
        return sum(_words(x) for k, x in v.items() if k not in ("value", "speed"))
    return 0


def duration(item, job, style):
    eid = edit_of(item, job, style)
    lim = (catalog().get(eid) or {}).get("duration") or {"minSeconds": 3, "maxSeconds": 6}
    want = float(item.get("duration") or max(lim["minSeconds"], min(lim["maxSeconds"], 5)))
    words = _words(item.get("fields") or {})
    if words:
        want = max(want, words / READ_WPS + 1.0)            # a minimum, within the edit's own longest
    items_ = (item.get("fields") or {}).get("items")
    if isinstance(items_, list):                             # a list ticks off one line at a time: ~1.5 s each
        want = max(want, 1.5 * len(items_) + 1.5)
    return max(lim["minSeconds"], min(lim["maxSeconds"], want))


def is_overlay(item, job, style):
    eid = edit_of(item, job, style)
    return bool(eid) and EDITS[eid][1] == "over"


# ---------------------------------------------------------------- props
def _node():
    _ensure_libs()
    return shutil.which("node") or "/opt/homebrew/bin/node"


def _ensure_libs():
    """The library edits share the War Chess renderer's libraries through legends_renderer/node_modules. A zip
    carries no links (Windows unpacks none), so the link is made here when it is missing: a relative symlink on
    Mac/Linux, a directory junction on Windows (no admin rights needed). An existing link is left alone."""
    link = RENDERER / "node_modules"
    target = HERE / "war_chess_renderer" / "node_modules"
    if link.exists() or link.is_symlink() or not target.is_dir():
        return
    import os
    try:
        if os.name == "nt":
            import _winapi
            _winapi.CreateJunction(str(target), str(link))
        else:
            link.symlink_to(Path("..") / "war_chess_renderer" / "node_modules", target_is_directory=True)
    except OSError:
        pass


def _asset(path, staged):
    path = Path(path).resolve(strict=True)
    with path.open("rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    key = f"movefast/{digest}{path.suffix.lower()}"
    staged[key] = str(path)
    return key


def _image(path, staged):
    from PIL import Image
    with Image.open(path) as im:
        w, h = im.size
    return {"path": _asset(path, staged), "width": w, "height": h}


def _validate(pairs):
    """Each edit's own repair(); None where the edit would refuse its props."""
    if not pairs:
        return []
    r = subprocess.run([_node(), "--experimental-strip-types", "movefast/validate.mjs"], cwd=RENDERER, input=json.dumps(pairs),
                       capture_output=True, text=True, timeout=60)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else [None] * len(pairs)


_SCALE = ((r"\s*(?:million|mln)\b", "M"), (r"\s*(?:billion|bn)\b", "B"), (r"\s*thousand\b", "K"), (r"\s*(?:per ?cent|percent)\b", "%"))


def _compact(fields):
    """Short value fields the way a graphic writes them ($10 MILLION -> $10M); never changes what a number says."""
    for key in ("value", "year", "date"):
        v = fields.get(key)
        if isinstance(v, str):
            for pat, sub in _SCALE:
                v = re.sub(pat, sub, v, flags=re.I)
            fields[key] = v.strip()
    return fields


def _lossy(sent, kept):
    """Text the edit's repair shortened or dropped (it keeps leading words to fit): such an edit would misquote."""
    if isinstance(sent, str):
        return isinstance(kept, str) and kept.strip().casefold() != sent.strip().casefold()   # case is the edit's own styling
    if isinstance(sent, dict):
        return not isinstance(kept, dict) or any(_lossy(v, kept.get(k)) for k, v in sent.items() if isinstance(v, (str, list, dict)) and k != "media")
    if isinstance(sent, list):
        return not isinstance(kept, list) or len(kept) != len(sent) or any(_lossy(a, b) for a, b in zip(sent, kept))
    return False


def _norm(word):
    return re.sub(r"[^a-z0-9]", "", str(word).lower())


def _spoken(engine, job, srt):
    """[(normalised word, start s)] on the voice's own clock."""
    cues = engine._parse_srt_full(srt.read_text(encoding="utf-8"))
    clock = engine._word_clock(job, srt) or {}
    out = []
    for i, (a, b, text) in enumerate(cues):
        words, times = text.split(), clock.get(str(i)) or clock.get(i)
        for k, w in enumerate(words):
            s = times[k][0] if times and k < len(times) else a + (b - a) * k / max(1, len(words))
            out.append((_norm(w), float(s)))
    return out


def _starts(spoken, text, t0, near):
    """Start (seconds after t0) of each word of `text` where it is spoken closest to `near`; None if not found."""
    want = [_norm(w) for w in str(text).split() if _norm(w)]
    if not want:
        return None
    best = None
    for i in range(len(spoken) - len(want) + 1):
        if all(spoken[i + k][0] == want[k] for k in range(len(want))):
            gap = abs(spoken[i][1] - near)
            if best is None or gap < best[0]:
                best = (gap, i)
    if best is None or best[0] > 12:
        return None
    return [round(max(0.0, spoken[best[1] + k][1] - t0), 3) for k in range(len(want))]


def _frame(bbox, fill=0.6):
    """Camera stop framing a [west, south, east, north] box (zoom 1 = the world 1920 px wide)."""
    w, s, e, n = bbox
    mx = lambda lat: math.log(math.tan(math.pi / 4 + math.radians(max(-85, min(85, lat))) / 2))
    wx, wy = max(1e-4, math.radians(e - w)), max(1e-4, mx(n) - mx(s))
    px = min(fill * 1920 / wx, fill * 1080 / wy)
    cy = math.degrees(2 * math.atan(math.exp((mx(n) + mx(s)) / 2)) - math.pi / 2)
    return {"lon": round((w + e) / 2, 4), "lat": round(cy, 4), "zoom": round(max(1.0, min(400.0, px / (1920 / (2 * math.pi)))), 4)}


def _place(name, kind="place"):
    """A gazetteer target for a name or {name, country, lat, lon} (the director's guess helps small towns)."""
    import maps
    got = maps.resolve(dict(name, type=name.get("type") or kind) if isinstance(name, dict) else {"name": str(name), "type": kind})
    return got if got and got.get("frame") else None


def _maps(eid, fields, item, spoken, t0, seconds):
    """Coordinates and camera stops for the map edits, from MoveFast's gazetteer; ValueError when a place is unknown."""
    if eid == "world-tour-map":
        hl, stops = [], []
        for h in fields.get("highlights") or []:
            p = _place(h.get("country"), "country")
            if not p or not p.get("a3"):
                raise ValueError(f"unknown country {h.get('country')!r}")
            st = _starts(spoken, h.get("words") or h.get("country"), t0, t0)
            at = round(min(seconds - 0.5, max(0.0, st[0] if st else len(hl) * seconds / 3)), 3)
            hl.append({"country": p["a3"], "tone": "blue" if h.get("tone") == "blue" else "red", "at": at})
            stops.append(dict(_frame(p["frame"], 0.45), at=round(max(at - 0.6, 0.0) if stops else 0.0, 3)))
        uniq = []
        for s in sorted(stops, key=lambda s: s["at"]):
            if not uniq or s["at"] > uniq[-1]["at"] + 0.4:
                uniq.append(s)
        cap = _starts(spoken, fields.get("caption"), t0, t0)
        return {"caption": fields.get("caption"), "captionAt": round(min(seconds - 1.5, 1.5 if not cap else max(0.3, cap[0])), 3),
                "stops": uniq, "highlights": hl}
    if eid == "route-map":
        a, b = _place(fields.get("from"), "city"), _place(fields.get("to"), "city")
        if not a or not b:
            raise ValueError("unknown route end")
        w, e = sorted([a["lon"], b["lon"]])
        s, n = sorted([a["lat"], b["lat"]])
        whole = _frame([w, s, e, n], 0.7)
        close = dict(_frame([w, s, e, n], 0.7), lon=a["lon"], lat=a["lat"])
        close["zoom"] = round(whole["zoom"] * 1.6, 4)
        return {"from": {"lon": a["lon"], "lat": a["lat"], "label": fields.get("fromLabel") or str(a.get("name"))},
                "to": {"lon": b["lon"], "lat": b["lat"], "label": fields.get("toLabel") or str(b.get("name"))},
                "stops": [dict(close, at=0.0), dict(whole, at=round(min(seconds, 9.8), 3))]}
    if eid == "country-flags-map":
        p = _place(fields.get("country"), "country")
        if not p or not p.get("a3"):
            raise ValueError(f"unknown country {fields.get('country')!r}")
        whole = _frame(p["frame"], 0.75)
        return {"country": p["a3"], "flags": fields.get("flags"), "caption": fields.get("caption"), "captionAt": 2.0, "fillAt": 1.53,
                "stops": [dict(whole, zoom=round(whole["zoom"] * 1.16, 4), at=0.1), dict(whole, at=3.2)]}
    return fields


# Bump when the preparation code changes, so a cached edit is prepared again.
PREP_VERSION = 2


def _prepare(engine, item, job, index, style, spoken):
    """Final props for one edit (footage is bound later for 'over' edits) and its staged assets; ValueError to skip."""
    import photofx
    eid = edit_of(item, job, style)
    if not eid:
        raise ValueError("no library edit for this job in this video")
    if eid in ("percent-gauge", "share-pie"):
        # a gauge or pie only for a share the narration states — "three chambers" is a count, not 3%
        said = f"{item.get('words') or ''} {json.dumps(item.get('fields') or {})}".lower()
        if not re.search(r"%|percent|per cent" + (r"|half|third|quarter|one in |out of" if eid == "share-pie" else ""), said):
            raise ValueError(f"{eid} needs a stated percentage or share")
    if eid == "stat-pill" and item.get("edit") == "number-tag":
        f_ = dict(item.get("fields") or {})                       # a short number moved over from number-tag
        f_.setdefault("label", f_.pop("unit", ""))
        f_["value"] = str(f_.get("value", ""))
        item = dict(item, fields=f_)
    folder = job / "legends" / f"edit-{index:03d}"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = _hash([item, eid, PREP_VERSION])
    cached = _load(folder / "prepared.json", {})
    if cached.get("stamp") == stamp and all(Path(p).exists() for p in cached.get("assets", {}).values()):
        if cached.get("error"):
            raise ValueError(cached["error"])
        return cached
    try:
        staged, refs = {}, {}
        for media in item.get("media") or []:
            ident = str(media.get("id") or "")
            if not ident.isalnum():
                raise ValueError("invalid media id")
            picks = ([{"photo": media["photo"]}] if media.get("photo") else    # a known photo (a named thing's own)
                     photofx.source_photos(engine, media.get("subject"), media.get("query"), folder / ident, n=3))
            if not picks:
                raise ValueError("no real photo for " + ident)
            src = Path(picks[0]["photo"])
            if media.get("cutout"):
                src = photofx.cutout(src, folder / ident / "cutout", log=engine.log)
            refs[ident] = _image(src, staged)
        fields = json.loads(json.dumps(item.get("fields") or {}))
        if eid == "country-flags-map":
            flags = []
            for n, nation in enumerate((fields.get("flags") or [])[:6]):
                picks = photofx.source_photos(engine, f"flag of {nation}", f"flag of {nation} svg", folder / f"F{n}", n=1)
                if picks:
                    flags.append(_image(Path(picks[0]["photo"]), staged))
            if not flags:
                raise ValueError("no flag pictures")
            fields["flags"] = flags

        def bind(value, key=""):
            if isinstance(value, str) and value.startswith("$") and value[1:] in refs:
                img = refs[value[1:]]
                return {"kind": "picture", "source": img} if key == "media" else img
            if isinstance(value, list):
                return [bind(v, key) for v in value]
            if isinstance(value, dict):
                return {k: bind(v, k) for k, v in value.items()}
            return value
        fields = bind(fields)
        t0, seconds = float(item["t"]), float(item["end"]) - float(item["t"])
        fields = _compact(_maps(eid, fields, item, spoken, t0, seconds))
        if eid in WORD_SYNC:
            src_key, out_key = WORD_SYNC[eid]
            text = " ".join(fields.get(src_key)) if isinstance(fields.get(src_key), list) else fields.get(src_key)
            st = _starts(spoken, text, t0, float(item.get("_w") or t0))
            if st and eid == "phrase-boxes":
                st, k, out = st, 0, []
                for ph in fields["phrases"]:
                    out.append(st[k] if k < len(st) else None)
                    k += len([w for w in ph.split() if _norm(w)])
                st = out if None not in out else None
            if st:
                fields[out_key] = st
        result = {"stamp": stamp, "edit": eid, "mode": EDITS[eid][1], "props": fields, "assets": staged,
                  "originals": sorted({v for v in staged.values()})}
        _dump(folder / "prepared.json", result)
        return result
    except Exception as exc:
        _dump(folder / "prepared.json", {"stamp": stamp, "error": str(exc)})
        raise ValueError(str(exc)) from exc


def _render(tasks, staged, folder):
    if not tasks:
        return
    folder = Path(folder).resolve()
    tasks = [dict(t, output=str(Path(t["output"]).resolve())) for t in tasks]
    request = folder / "render-request.json"
    with _RENDER_LOCK:
        _dump(request, {"bundleDir": str(folder / "bundle"), "assets": staged, "tasks": tasks})
        r = subprocess.run([_node(), str(RENDERER / "movefast" / "render.mjs"), str(request)], cwd=RENDERER,
                           capture_output=True, text=True, timeout=max(1800, 30 * len(tasks)))
        (folder / "render.log").write_text(r.stdout + r.stderr)
        if r.returncode:
            raise RuntimeError("legends renderer: " + (r.stderr or r.stdout)[-1400:])


def _sound(clip, t, folder, sounds):
    """The edit's own audio as a wav placed at t, when it has any."""
    wav = clip.with_suffix(".wav")
    if not wav.exists():
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(clip), "-vn", "-ac", "2", "-ar", "48000", str(wav)], capture_output=True)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr or "")
    if m and float(m.group(1)) > -60:
        sounds.append([round(float(t), 3), str(wav)])


# ---------------------------------------------------------------- timeline (scene DLC) and final-picture overlays
def _pair(prep):
    """An edit's props as _validate takes them — an 'over' edit with a stand-in picture (its footage is bound later)."""
    stand_in = {"media": {"kind": "picture", "source": {"path": "movefast/0.png", "width": 2, "height": 2}}}
    return {"id": prep["edit"], "props": dict(prep["props"], **(stand_in if prep["mode"] == "over" else {}))}


def _fits(prep, ok):
    """The edit takes its words whole (ok: _validate's answer). A stat-pill's value and label also fit its space —
    about 20 characters; a longer pill runs off the left edge (library bug, reported to "vpp edit 2")."""
    p = prep["props"]
    wide = prep["edit"] == "stat-pill" and len(f"{p.get('value', '')}{p.get('label', '')}") > 20
    return ok is not None and not _lossy(p, ok) and not wide


def add_to_timeline(segs, srt, job, style, force, workers=1, engine=None):
    """Render the 'scene' edits as their own timeline scenes; keep the 'over' edits for overlay_windows()."""
    if engine is None or not enabled(engine, style):
        return segs
    folder = job / "legends"
    moments = _load(folder / "moments.json", [])
    if not moments:
        return segs
    spoken = _spoken(engine, job, srt)
    report, over, added, sounds = [], [], [], []
    media_manifest = _load(job / "motion/media.json", {})
    look = skin(engine, style)
    validated = []
    for index, item in enumerate(moments):
        try:
            validated.append((index, item, _prepare(engine, item, job, index, style, spoken)))
        except Exception as exc:
            engine.log(f"legends: {item.get('job') or item.get('edit')} skipped — {str(exc)[:200]}")
            report.append({"edit": item.get("job") or item.get("edit"), "t": item.get("t"), "status": "skipped", "reason": str(exc)})
    checked = _validate([_pair(p) for _i, _it, p in validated])
    refused = []
    for (index, item, prep), ok in zip(validated, checked):
        if VARIETY and not _fits(prep, ok):
            # another variant of the same job may take these words (a shorter date box, a label without a portrait)
            job_name = EDITS.get(prep["edit"], (None,))[0] or str(item.get("job") or "")
            for alt in [v for v in (variants(job_name) if job_name in JOBS else []) if v != prep["edit"]]:
                try:
                    p2 = _prepare(engine, dict(item, edit=alt), job, index, style, spoken)
                    ok2 = _validate([_pair(p2)])[0]
                except Exception:                                # noqa: BLE001 - the next variant, then a plain label
                    continue
                if _fits(p2, ok2):
                    engine.log(f"legends: {prep['edit']} refused its text — {alt} instead")
                    prep, ok = p2, ok2
                    break
        if not _fits(prep, ok):
            if VARIETY:
                refused.append(item)
            why = "props refused by the edit" if ok is None else "the edit would shorten or clip its text"
            engine.log(f"legends: {prep['edit']} skipped — {why}")
            report.append({"edit": prep["edit"], "t": item["t"], "status": "skipped", "reason": why})
            continue
        if prep["mode"] == "over":
            over.append(dict(item, prepared=prep))
            continue
        start, end = float(item["t"]), float(item["end"])
        if any(start < a + d - .01 and a < end - .01 for a, _p, d in segs):
            report.append({"edit": prep["edit"], "t": start, "status": "skipped", "reason": "another scene holds this beat"})
            continue
        out = folder / f"scene_{index:03d}_{prep['edit']}.mp4"
        frames_ = round((end - start) * FPS)
        layers_ = [{"from": 0, "duration": frames_, "id": prep["edit"], "props": prep["props"]}]
        if prep["edit"] in ("word-reveal", "pan-sentence") and frames_ > 30:
            # the grid flashes in for one frame before the sentence builds on it (owner 2026-10-05)
            layers_ = [{"from": 0, "duration": 1, "id": "grid-flash", "props": {}},
                       {"from": 1, "duration": frames_ - 1, "id": prep["edit"], "props": prep["props"]}]
        props = {"frames": frames_, "skin": look, "base": None, "layers": layers_}
        try:
            stamp = _hash(props)
            if force or not out.exists() or _load(out.with_suffix(".stamp"), "") != stamp:
                _render([{"output": str(out), "props": props}], prep["assets"], folder)
                _dump(out.with_suffix(".stamp"), stamp)
            _sound(out, start, folder, sounds)
            added.append((start, str(out), end - start))
            media_manifest[str(out)] = prep["originals"]
            report.append({"edit": prep["edit"], "t": start, "end": end, "status": "rendered", "path": str(out)})
        except Exception as exc:
            engine.log(f"legends: {prep['edit']} failed — {str(exc)[:200]}")
            report.append({"edit": prep["edit"], "t": start, "status": "skipped", "reason": str(exc)[:400]})
    _dump(folder / "over.json", over)
    _dump(folder / "scene_sounds.json", sounds)
    _dump(folder / "refused.json", refused)
    _dump(folder / "report.json", report)
    _dump(job / "motion/media.json", media_manifest)
    engine.log(f"legends: {len(added)} scene(s) rendered, {len(over)} over-footage edit(s) waiting for the picture")
    return sorted(list(segs) + added, key=lambda x: x[0])


ON_PICTURE = ("checklist", "comparison")   # full-screen cards laid over the picture instead of replacing it (owner 2026-10-06)


def _on_picture(window: Path, card: Path) -> None:
    """The card's own dark ground keyed out and the card laid over the picture, slightly darkened so it reads."""
    from PIL import Image
    probe = card.with_suffix(".ground.png")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "0.5", "-i", str(card), "-frames:v", "1", str(probe)],
                   check=True, capture_output=True)
    r, g, b = Image.open(probe).convert("RGB").getpixel((6, 6))
    probe.unlink(missing_ok=True)
    tmp = card.with_name(card.stem + ".onpic.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(window), "-i", str(card), "-filter_complex",
                    f"[0:v]scale=1920:1080,gblur=sigma=7,eq=brightness=-0.28:saturation=0.7[b];"
                    f"[1:v]colorkey=0x{r:02x}{g:02x}{b:02x}:0.14:0.08[k];[b][k]overlay=shortest=1,format=yuv420p[v]",
                    "-map", "[v]", "-map", "1:a?", "-c:v", "libx264", "-crf", "16", "-c:a", "copy", str(tmp)],
                   check=True, capture_output=True)
    tmp.replace(card)


def _says(text: str, words: str) -> bool:
    """`words` stand in `text` as whole words ("ro" is not in "rotor")."""
    return bool(words) and re.search(rf"(?<!\w){re.escape(words)}(?!\w)", text) is not None


def _plain_label(item):
    """MoveFast's own text label for a library edit that found no room (MORE_EDITS test): the same words, plainer."""
    f, j = item.get("fields") or {}, str(item.get("job") or item.get("edit") or "")
    if j in EDITS and EDITS[j][0]:
        j = EDITS[j][0]                                   # a named variant (date-highlight) labels as its job (date)
    if j == "date" and (f.get("year") or f.get("date")):
        return {"style": "date", "text": " ".join(str(x) for x in (f.get("date"), f.get("year")) if x).upper(), "dur": 3.0}
    if j == "name-label" and f.get("name"):
        return {"style": "name", "text": str(f["name"]).upper(), "sub": str(f.get("role") or "").upper(), "dur": 3.2}
    if j == "quantity" and (f.get("value") or f.get("number")):
        return {"style": "number", "text": str(f.get("value") or f.get("number")), "sub": str(f.get("unit") or f.get("label") or "").upper(), "dur": 3.0}
    text = f.get("text") or f.get("title")
    if text and len(str(text).split()) <= 6:
        return {"style": "phrase", "text": str(text).upper(), "dur": 3.0}
    return None


def overlay_windows(engine, job, style, plan, visual):
    """Render the 'over' edits on their window of the finished picture; writes legends/overlays.json [[t, clip]]
    for the final mix and legends/sounds.json for the audio. A window must lie on real footage, clear of the
    other scenes and of any text label, War Chess overlay or other library edit."""
    folder = job / "legends"
    over = _load(folder / "over.json", [])
    sounds = _load(folder / "scene_sounds.json", [])
    placed, report, tasks, staged = [], _load(folder / "report.json", []), [], {}
    spans, cursor = [], 0.0
    for kind, _src, _leak, seconds in plan:
        spans.append((cursor, cursor + float(seconds), kind))
        cursor += float(seconds)
    labels = [(float(x["t"]), float(x["t"]) + float(x.get("dur", 3.6))) for x in _load(job / "overlays.json", [])]
    wc = [(float(x["t"]), float(x["end"])) for x in _load(job / "war_chess" / "overlays.json", []) if x.get("prepared") or x.get("overlay")]
    taken = []
    look = skin(engine, style)
    import os
    more = os.environ.get("MORE_EDITS", "1") == "1"   # owner 2026-10-05: move a blocked edit, else a plain label
    fallback = []

    # what each still shows (owner rules 2–3): a named photo is that person/object/place
    who_at, photo_of = {}, {}
    for f in (job / "stills" / "named").glob("*/photos.json") if more else []:
        try:
            got = json.loads(f.read_text(encoding="utf-8"))
            for x in got.get("picks") or []:
                who_at[x["photo"]] = str(got.get("name") or "").lower()
                photo_of.setdefault(str(got.get("name") or "").lower(), x["photo"])   # its own photo, for an inset
        except (OSError, ValueError, KeyError):
            pass
    named_t = _load(job / "stills" / "named.json", []) if more else []
    context_jobs = ("date", "quantity", "impact-word", "chapter-title", "sentence-on-screen", "quote-highlight")
    need_of = engine._clip_seen(job) if more and hasattr(engine, "_clip_seen") else {}   # what Gemini saw in each clip
    for ph, w_ in (_load(job / "stills" / "identity.json", {}) if more else {}).items():
        who_at.setdefault(ph, str(w_.get("name") or "").lower())
    shows, cur = [], 0.0
    for kind, src, _leak, seconds in plan:
        shows.append((cur, cur + float(seconds), who_at.get(str(src), "") if kind == "photo" else "",
                      need_of.get(Path(str(src)).name, "") if kind == "video" else ""))
        cur += float(seconds)
    current = {}
    said = [(float(x["t"]), f'{x.get("text", "")} {x.get("sub", "")}'.lower()) for x in _load(job / "overlays.json", [])]
    ends = engine._sentence_ends(job) if more and hasattr(engine, "_sentence_ends") else []

    def names_thing(it):
        """It names a thing on the footage (owner rule 2) — unless it brings that thing's own photo (a portrait)."""
        eid = str((it.get("prepared") or {}).get("edit") or it.get("edit") or "")
        spec = EDITS.get(eid, (None, None, ""))
        return (spec[0] or str(it.get("job") or "")) in ("name-label", "object-label") and "portrait" not in spec[2]

    def inset(it, k):
        """A naming edit no shot can carry: that thing's own real photo in a framed inset with its name, or None."""
        f_ = it.get("fields") or {}
        name = str(f_.get("name") or f_.get("text") or f_.get("caption") or f_.get("label") or "").strip()
        low, t_ = name.lower(), float(it["t"])
        # exact name first, then the longest named thing inside it ("GM" must not lend its photo to "GM Technical Center")
        hits = sorted((n for n in photo_of if n and low and (n == low or _says(low, n) or _says(n, low))),
                      key=lambda n: (n != low, not _says(low, n), -len(n)))   # ("VEGA" still finds "Chevrolet Vega")
        photo = photo_of[hits[0]] if hits else None
        if not photo or any(abs(t - t_) < 8.0 and _says(s, low) for t, s in said):
            return None                                          # no photo of it, or its name is already on screen
        about = next((str(n.get("about") or "") for n in named_t if str(n.get("name", "")).lower() == low), "")
        role = str(f_.get("role") or f_.get("sub") or about.split(",")[0]).strip()
        it2 = {k_: v for k_, v in it.items() if k_ != "prepared"}
        it2.update(edit="inset-portrait", job="name-label", end=t_ + 4.0, media=[{"id": "P1", "photo": photo}],
                   fields=dict({"name": name, "portrait": "$P1"}, **({"role": role} if role else {})))
        try:
            p = _prepare(engine, it2, job, 900 + k, style, [])
            return dict(it2, prepared=p, _inset=True) if _fits(p, _validate([_pair(p)])[0]) else None
        except Exception:                                        # noqa: BLE001 - no inset: the edit stays out
            return None

    # labels the text rules dropped (make_video._match_text) get the same chance
    for k, x in enumerate(_load(folder / "insets.json", []) if more else []):
        got_ = inset({"t": x["t"], "fields": {"name": x.get("name", ""), "role": x.get("sub", "")}}, k - 100)
        if got_:
            over.append(got_)

    def matches(a, b):
        it = current.get("item") or {}
        if not more:
            return True
        eid = str(it.get("edit") or "")
        naming = names_thing(it)                                   # it names a thing on screen (owner rule 2)
        f_ = it.get("fields") or {}
        name = str(f_.get("name") or f_.get("label") or f_.get("text") or f_.get("caption") or f_.get("title") or "").lower()
        for x, y, who, need in shows:
            if x < b and a < y:
                if naming:
                    # rule 2: only on a shot KNOWN to show that thing — its named photo, or a clip searched for it
                    known = (who and name and (name in who or who in name)) or (need and name and name in need)
                    if not known:
                        return False
                if not naming and who:
                    # rule 3: other text never on a named photo it is not about — a date, number or key line of the
                    # same sentence (that thing named within a few seconds) is about it
                    jb = EDITS.get(eid, (None,))[0] or str(it.get("job") or "")
                    same = any(abs(float(n.get("t", -99)) - a) <= 6.0 and
                               (str(n.get("name", "")).lower() in who or who in str(n.get("name", "")).lower())
                               for n in named_t)
                    if jb not in context_jobs or not same:
                        return False
        return True

    def fits(a, b):
        on_ = sum(max(0.0, min(b, y) - max(a, x)) for x, y, k in spans if k in ("photo", "video")) >= (b - a) - 1 / FPS
        on_ = on_ and matches(a, b)
        return on_, any(x < b and a < y for x, y in labels + wc + taken + [(f["t"], f["t"] + f["dur"]) for f in fallback])

    win_of = {}
    for index, item in enumerate(over):
        a, b = float(item["t"]), float(item["end"])
        current["item"] = item
        f0 = item.get("fields") or {}
        words_ = str(f0.get("name") or f0.get("text") or f0.get("caption") or "").strip().lower()
        if more and words_ and any(abs(t - a) < 8.0 and _says(s, words_) for t, s in said):
            # its words are already on screen as a label a moment before or after (WANKEL ROTARY ENGINE twice)
            report.append({"edit": item["prepared"]["edit"], "t": a, "status": "skipped", "reason": "same words as a label"})
            continue
        on_footage, clash = fits(a, b)
        prep = item["prepared"]
        if (not on_footage or clash) and more:
            # anywhere within its sentence, nearest first — a moved edit beats a lost one
            for d in engine._shifts(a, ends) if hasattr(engine, "_shifts") else ():
                if a + d >= 0 and all(fits(a + d, b + d)[i] == want for i, want in ((0, True), (1, False))):
                    a, b, on_footage, clash = a + d, b + d, True, False
                    break
        if (not on_footage or clash) and more and names_thing(item) and not item.get("_inset"):
            got_ = inset(item, index)
            if got_:
                over.append(got_)                                 # placed by this same loop, further down the list
                report.append({"edit": prep["edit"], "t": a, "status": "inset instead"})
                continue
        if (not on_footage or clash) and more and not item.get("_inset"):
            label = _plain_label(item)
            if label:
                for d in (0.0, 0.5, -0.5, 1.0, -1.0, 1.5, 2.0, 2.5, 3.0):
                    t0 = float(item["t"]) + d
                    if t0 >= 0 and fits(t0, t0 + label["dur"]) == (True, False):
                        fallback.append(dict(label, t=round(t0, 2)))
                        report.append({"edit": prep["edit"], "t": t0, "status": "plain label instead"})
                        break
        if not on_footage or clash:
            report.append({"edit": prep["edit"], "t": a, "status": "skipped",
                           "reason": "not on real footage" if not on_footage else "another text is on screen"})
            continue
        frames = round((b - a) * FPS)
        # named by where it starts and how long it is: an edit that moved since the last render gets fresh footage
        win = folder / f"window_{index:03d}_{round(a * 100)}_{frames}.mp4"
        win_of[str(folder / f"over_{index:03d}_{prep['edit']}.mp4")] = win
        if not win.exists():
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-i", str(visual), "-t", f"{b - a:.3f}", "-an",
                            "-vf", f"scale=1920:1080,fps={FPS},setsar=1", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(win)],
                           check=True, capture_output=True)
        key = _asset(win, staged)
        props = dict(prep["props"], media={"kind": "clip", "path": key, "width": 1920, "height": 1080, "sourceFps": FPS,
                                           "sourceDurationInFrames": frames, "startFrame": 0})
        staged.update(prep["assets"])
        out = folder / f"over_{index:03d}_{prep['edit']}.mp4"
        # an overlay-layer edit (stamp, news ticker) draws only itself: the window's footage goes underneath it
        base_ = {"key": key} if (catalog().get(prep["edit"]) or {}).get("layer") == "overlay" else None
        task_props = {"frames": frames, "skin": look, "base": base_, "layers": [{"from": 0, "duration": frames, "id": prep["edit"], "props": props}]}
        stamp = _hash([task_props, win.stat().st_size])
        if not out.exists() or _load(out.with_suffix(".stamp"), "") != stamp:
            tasks.append({"output": str(out), "props": task_props})
            _dump(out.with_suffix(".pending"), stamp)
        placed.append([a, str(out), prep["edit"]])
        taken.append((a - 0.3, b + 0.3))
    for item in (_load(folder / "refused.json", []) if more else []):
        current["item"] = item
        label = _plain_label(item)
        if not label:
            continue
        for d in (0.0, 0.5, -0.5, 1.0, -1.0, 1.5, 2.0, 2.5, 3.0):
            t0 = float(item.get("t", item.get("_t", 0))) + d
            if t0 >= 0 and fits(t0, t0 + label["dur"]) == (True, False):
                fallback.append(dict(label, t=round(t0, 2)))
                report.append({"edit": str(item.get("edit") or item.get("job")), "t": t0, "status": "plain label instead"})
                break
    if fallback:
        own = _load(job / "overlays.json", [])
        _dump(job / "overlays.json", sorted(own + fallback, key=lambda x: float(x["t"])))
        engine.log(f"legends: {len(fallback)} blocked edit(s) shown as a plain label instead")
    try:
        _render(tasks, staged, folder)
        fresh = {t["output"] for t in tasks}                   # composited once, right after its own render
        for a_, outp, eid_ in placed:
            if eid_ in ON_PICTURE and outp in fresh and Path(outp).exists():
                _on_picture(win_of[outp], Path(outp))
    except Exception as exc:
        engine.log(f"legends: over-footage edits failed — {str(exc)[:200]}")
        placed = [p for p in placed if Path(p[1]).exists() and not Path(p[1]).with_suffix(".pending").exists()]
    for p in placed:
        pend = Path(p[1]).with_suffix(".pending")
        if pend.exists():
            pend.replace(Path(p[1]).with_suffix(".stamp"))
        _sound(Path(p[1]), p[0], folder, sounds)
        report.append({"edit": p[2], "t": p[0], "status": "rendered", "path": p[1]})
    _dump(folder / "overlays.json", [[t, path] for t, path, _e in placed])
    _dump(folder / "sounds.json", sounds)
    _dump(folder / "report.json", report)
    engine.log(f"legends: {len(placed)} over-footage edit(s) placed, {len(sounds)} with sound")
