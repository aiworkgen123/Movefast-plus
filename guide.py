"""A channel's template guide (styles/<style>.templates.md, owner-editable): every template's one-line "use when", its tier
and whether it is on. MoveFast finds the text moments a script names (dates, numbers, the named people, places and
objects) and suggests the next TEXT OVERLAY in turn for each (a deck per job: shuffled per video, all used before any
repeats, never the same twice in a row); scenes are the director's choice from the content. It also tells the director
the tier budget and counts it (Strong about one every 2 minutes, Heavy at most two a video), and keeps templates marked
"no" out. No guide file → the channel plans the old way. (Owner, 2026-10-05/06.)
"""
import json
import random
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
JOBS = {"date": "Date", "person": "Person", "place": "Place", "object": "Object or machine", "number": "Number",
        "data": "Data", "compare": "Comparison or list", "sequence": "Sequence or process", "mechanism": "Mechanism",
        "evidence": "Evidence or quote", "keyline": "Key line or turn", "chapter": "Chapter", "feeling": "Feeling"}
_LABEL_JOBS = ("date", "name-label", "quantity", "object-label")   # the pool's label variants that sit over the picture
STRONG_GAP_S, HEAVY_MAX, HOOK_S = 120.0, 2, 120.0
_MONTHS = r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
_WORD_NUM = (r"(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|"
             r"seventy|eighty|ninety|a|several|hundreds of|thousands of)")
_DATE = re.compile(rf"\b(?:{_MONTHS}\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}|{_MONTHS}\s+(?:of\s+)?\d{{4}}|(?:in|by|since|until|of)\s+1[5-9]\d\d|"
                   rf"(?:in|by|since|until|of)\s+20\d\d|\b1[6-9]\d\d\b|{_MONTHS}\s+(?:of\s+)?nineteen[\s-]\w+(?:[\s-]\w+)?|"
                   rf"(?:in|by|since|until)\s+nineteen[\s-]\w+(?:[\s-]\w+)?)", re.I)
_NUMBER = re.compile(rf"(?:\$\s?\d[\d,.]*\s*(?:million|billion|thousand)?|\b\d[\d,.]*\s*(?:%|percent|million|billion|thousand|"
                     rf"tons?|tonnes|miles|kilometres|kilometers|horsepower|hp|rpm|mph|km/h|dollars|pounds|feet|metres|meters|"
                     rf"gallons|litres|liters|workers|units|cars|engines)\b|\b{_WORD_NUM}[\s-]?(?:\w+[\s-])?(?:hundred|thousand|"
                     rf"million|billion)\b(?:\s+(?:dollars|tons|miles|engines|cars|units|workers|horsepower))?|"
                     rf"\b{_WORD_NUM}\s+percent\b)", re.I)


def load(style: str):
    """{"rules": str, "rows": [{job, name, id, tier, use, on}]} from styles/<style>.templates.md, or None."""
    path = HERE / "styles" / f"{style}.templates.md"
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    rules = text.split("## Rules", 1)[1].split("\n## ", 1)[0].strip() if "## Rules" in text else ""
    titles = {v.lower(): k for k, v in JOBS.items()}
    rows, job = [], None
    for line in text.splitlines():
        if line.startswith("## "):
            head = line[3:].split("—")[0].strip().lower()
            job = titles.get(head)
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if job and len(cells) == 5 and cells[1] not in ("id", "---") and not set(cells[0]) <= set("-"):
            rows.append({"job": job, "name": cells[0], "id": cells[1], "tier": cells[2].split()[0].capitalize(),
                         "use": cells[3], "on": cells[4].lower().startswith("yes")})
    return {"rules": rules, "rows": rows}


def off(style: str) -> set:
    """Template ids the guide switches off (On "no" in every row they appear in) — never offered, never kept."""
    g = load(style)
    if not g:
        return set()
    return {r["id"] for r in g["rows"]} - {r["id"] for r in g["rows"] if r["on"]}


def is_overlay(tid: str) -> bool:
    """A text overlay on the picture — the only templates MoveFast suggests in turn (owner 2026-10-06); scenes are
    chosen by the director from the content."""
    tool, _, sub = tid.partition(":")
    if tool == "text":
        return True
    if tool == "legends":
        import legends
        spec = legends.EDITS.get(sub)
        return bool(spec) and spec[1] == "over" and spec[0] in _LABEL_JOBS
    return tool == "war_chess" and sub in ("WC08", "WC09", "WC12")


def kind(item: dict) -> str:
    """An item's template id in the guide's terms (legends:corner-date, text:date, graphic:dateline, war_chess:P14, map)."""
    tool = str(item.get("tool") or "")
    if tool == "legends":
        return f"legends:{item.get('edit') or item.get('job') or ''}"
    sub = {"text": "style", "graphic": "type", "war_chess": "type"}.get(tool)
    return f"{tool}:{item.get(sub) or ''}" if sub else tool


def write_as(tid: str) -> str:
    """How the director names a template in its output."""
    tool, _, sub = tid.partition(":")
    field = {"legends": "edit", "text": "style", "graphic": "type", "war_chess": "type", "war_chess_fx": "overlay.kind"}.get(tool)
    return f'tool "{tool}", {field} "{sub}"' if sub and field else f'tool "{tool}"'


def prepare(job: Path, style: str, sentences: list, named: list, title: str = "") -> dict:
    """Find this script's moments and deal each a suggested template; cached in job/guide.json.
    sentences: director.sentences() rows; named: make_video._named_things() items (with their sentence "s")."""
    cache = job / "guide.json"
    if cache.exists():
        try:
            return json.loads(cache.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    g = load(style)
    if not g:
        return {}
    moments, seen = [], set()
    for i, (st, _en, txt) in enumerate(sentences):
        for m in _DATE.finditer(txt):
            moments.append({"s": i, "t": st, "job": "date", "words": m.group(0).strip()})
        for m in _NUMBER.finditer(txt):
            if not any(m.group(0) in x["words"] or x["words"] in m.group(0) for x in moments if x["s"] == i):
                moments.append({"s": i, "t": st, "job": "number", "words": m.group(0).strip()})
    for x in named or []:
        si = x.get("s")
        key = x.get("key") or x.get("name", "").lower()
        if si is None or not 0 <= int(si) < len(sentences) or key in seen:
            continue                                         # a person/place/object is introduced once
        seen.add(key)
        job_ = {"person": "person", "place": "place"}.get(x.get("type"), "object")      # a company is shown as a thing
        moments.append({"s": int(si), "t": sentences[int(si)][0], "job": job_, "words": x.get("name", "")})
    moments.sort(key=lambda m: (m["s"], m["job"]))
    rng = random.Random(f"{title}|{job.name}")
    decks, last = {}, {}
    for m in moments:
        pool = [r["id"] for r in g["rows"] if r["on"] and r["job"] == m["job"] and r["tier"] == "Light" and is_overlay(r["id"])]
        if not pool:
            continue
        key = m["job"]
        deck = decks.get(key)
        if not deck:                                         # a fresh shuffle, never starting on the card just used
            deck = list(dict.fromkeys(pool))
            rng.shuffle(deck)
            if len(deck) > 1 and deck[0] == last.get(key):
                deck.append(deck.pop(0))
            decks[key] = deck
        m["suggest"] = deck.pop(0)
        last[key] = m["suggest"]
    out = {"moments": moments}
    cache.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    return out


def overlay_text(job: Path, style: str, lo: float, hi: float) -> str:
    """The guide's part of a stretch's brief: the tier budget, and the text moments found here, each with the overlay
    next in turn."""
    g = load(style)
    if not g:
        return ""
    try:
        moments = json.loads((job / "guide.json").read_text(encoding="utf-8")).get("moments") or []
    except (OSError, ValueError):
        moments = []
    on = [r for r in g["rows"] if r["on"] and is_overlay(r["id"])]
    name = {r["id"]: r["name"] for r in on}
    here = [m for m in moments if lo - 0.01 <= m["t"] < hi and m.get("suggest")]
    tiers = {t: ", ".join(dict.fromkeys(r["id"].replace(":", " ") for r in g["rows"] if r["on"] and r["tier"] == t))
             for t in ("Strong", "Heavy")}
    # told up front, so the director picks a Light edit instead of one the budget would take out (owner 2026-10-06)
    out = [f"BUDGET — Strong ({tiers['Strong']}): about one every {STRONG_GAP_S / 60:.0f} minutes across the video, "
           f"for a real turn, verdict or reveal. Heavy ({tiers['Heavy']}): at most {HEAVY_MAX} a video. "
           "Everything else is Light — use freely."]
    if not here:
        return out[0]
    out += ["TEXT OVERLAYS — MoveFast found these text moments here; give each a text overlay unless the moment is "
            "crowded. Text overlays sit on footage between your scenes, never while your own graphic, map, photo scene "
            "or Vox is on screen. The suggested overlay is next in turn (so dates, names and numbers do not all look "
            "alike); use another overlay only if it fits clearly better:"]
    for m in here:
        others = list(dict.fromkeys(r["name"] for r in on if r["job"] == m["job"] and r["id"] != m["suggest"]))
        out.append(f'- "{m["words"]}" ({JOBS[m["job"]].lower()}) → {name.get(m["suggest"], m["suggest"])} '
                   f'[{write_as(m["suggest"])}]; other overlays: {", ".join(others)}')
    return "\n".join(out)


def enforce(engine, items: list, style: str) -> list:
    """Tier budgets, counted in code: Heavy at most HEAVY_MAX a video (one kept in the first two minutes when there is
    one), Strong at least STRONG_GAP_S apart; templates the guide switches off never stay. The edits left out become
    a plain label of their words where they have one (director.plan)."""
    g = load(style)
    if not g:
        return items
    tier = {r["id"]: r["tier"] for r in g["rows"]}
    no = off(style)
    timed = sorted((x for x in items if kind(x) not in no), key=lambda x: float(x.get("_t", 0) or 0))
    dropped = [kind(x) for x in items if kind(x) in no]
    heavy = [x for x in timed if tier.get(kind(x)) == "Heavy"]
    # one in the first two minutes and one later; when either is missing, the next heavy one in time takes its place
    keep_heavy = [x for x in heavy if float(x["_t"]) < HOOK_S][:1] + [x for x in heavy if float(x["_t"]) >= HOOK_S][:1]
    keep_heavy += [x for x in heavy if x not in keep_heavy][:max(0, HEAVY_MAX - len(keep_heavy))]
    out, last_strong = [], -1e9
    for x in timed:
        t_ = tier.get(kind(x))
        if t_ == "Heavy" and x not in keep_heavy:
            dropped.append(kind(x)); continue
        if t_ == "Strong":
            if float(x["_t"]) - last_strong < STRONG_GAP_S:
                dropped.append(kind(x)); continue
            last_strong = float(x["_t"])
        out.append(x)
    used = {kind(x) for x in out}
    on = [r["id"] for r in g["rows"] if r["on"]]
    engine.log(f"  guide: {sum(1 for i in on if i in used)}/{len(set(on))} templates used · strong "
               f"{sum(1 for x in out if tier.get(kind(x)) == 'Strong')} · heavy "
               f"{sum(1 for x in out if tier.get(kind(x)) == 'Heavy')}"
               + (f" · {len(dropped)} over budget or off left out ({', '.join(dropped)})" if dropped else ""))
    return out
