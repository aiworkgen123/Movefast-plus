import json, sys, glob, collections, re, os, hashlib
from pathlib import Path
work, log, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
shots = json.load(open(work / "shots.json"))
timing = json.load(open(work / "timing.json")) if (work / "timing.json").exists() else {}
checks = json.load(open(work / "verdicts.json")) if (work / "verdicts.json").exists() else {}
yesno = bool(checks) and checks.get("mode", "yesno") != "score"
cands = {}
for f in glob.glob(str(work / "pictures/*/pick.json")):
    for c in json.load(open(f)).get("cands") or []:
        cands[c["photo"]] = c
TIERS = ("no", "generic", "kind", "exact")


def tier_of(s):
    """A2 (2026-10-10): the tier of the picture on screen - shots.json says it; an older plan: read off its candidate."""
    if s.get("ai"):
        return "ai"
    if s.get("tier"):
        return s["tier"]
    c = cands.get(s.get("photo")) or {}
    if isinstance(c.get("tier"), int):
        return TIERS[c["tier"]]
    sc = c.get("score")
    return "?" if sc is None else "exact" if sc >= 7 else "kind" if sc >= 5 else "generic" if sc >= 3 else "no"


# repeats by photo identity: the same bytes, or a near copy (mrtruth._same when the repo is at hand)
sys.path.insert(0, os.getcwd())
try:
    import mrtruth as M
    same = M._same
except Exception:                                                    # noqa: BLE001 - bytes only
    same = None


def sha(p):
    try:
        return hashlib.sha1(Path(p).read_bytes()).hexdigest()
    except OSError:
        return str(p)


groups = []                                          # [first photo, its sha1, showings]
for s in shots:
    p = s.get("photo")
    if not p or s.get("ai"):
        continue
    h = sha(p)
    g = next((g for g in groups if g[1] == h or g[0] == p or (same is not None and same(g[0], p))), None)
    if g:
        g[2] += 1
    else:
        groups.append([p, h, 1])
steps = collections.Counter(s["step"] for s in shots)
used = collections.Counter(s["photo"] for s in shots if s["photo"])
tiers = collections.Counter(tier_of(s) for s in shots if s.get("photo"))
picked = [cands[s["photo"]].get("score") for s in shots if s["photo"] and not s["ai"] and s["photo"] in cands]
picked = [x for x in picked if x is not None]
L = log.read_text(errors="replace")
grab = lambda pat: (re.findall(pat, L) or [""])[-1]
gate = json.load(open(work / "gate.json")) if (work / "gate.json").exists() else {}
# HL (owner 2026-10-11): the highlighted pages - the gate's record (pages on screen, timing, what was refused and why)
hl = gate.get("highlight") or {}
plan = json.load(open(work / "plan.json")) if (work / "plan.json").exists() else []
FPS = 30


def on_plan(tid, *keys):
    """MAP/DATE (owner 2026-10-11): each shot of one template in the drawn plan - when, how long, its words."""
    return [dict({"at_s": round(sc.get("startFrame", 0) / FPS, 1), "len_s": round(sc.get("durationFrames", 0) / FPS, 1)},
                 **{k: (sc.get("device") or {}).get(k) for k in keys})
            for sc in plan if (sc.get("device") or {}).get("id") == tid]


maps, dates = on_plan("location-map", "label", "date", "year", "dateFrom"), on_plan("date-stamp", "date", "year")
# MD (impl-z, 2026-10-11): the placement step's own record - every candidate place and date with what became of it
md = gate.get("places_dates") or {}
res = {"shots": len(shots), "steps": dict(steps), "ai": sum(s["ai"] for s in shots),
       "photos_used_more_than_once": sum(1 for v in used.values() if v > 1),
       # A2: the yes/no checks - the tiers on screen; repeats counted by photo identity (bytes or a near copy)
       "shown_tiers": dict(tiers), "shown_exact": tiers.get("exact", 0), "shown_kind": tiers.get("kind", 0),
       "shown_generic": tiers.get("generic", 0), "shown_no": tiers.get("no", 0),
       "photos_shown_more_than_once_by_identity": sum(1 for g in groups if g[2] > 1),
       "repeat_showings_by_identity": sum(g[2] - 1 for g in groups),
       "most_showings_of_one_photo": max([g[2] for g in groups] or [0]),
       "identity_test": "mrtruth._same (bytes or near copy)" if same else "sha1 of the bytes",
       # the 0-10 judge's numbers: only for a run judged that way (a yes/no run's score is derived 8/6/4/1, not a judge)
       "mean_judge_score_of_shown_real_photos": None if yesno else round(sum(picked) / max(1, len(picked)), 2),
       "shown_real_photos_scoring_7plus": None if yesno else sum(1 for x in picked if x >= 7),
       "judge_mode": checks.get("mode", "score" if not checks else "yesno"),
       "checks": checks.get("checks", {}), "check_tokens": checks.get("tokens", {}), "verdict_store": checks.get("store", {}),
       "timing_s": {k: v for k, v in timing.items() if isinstance(v, (int, float))},
       "planning_total_s": round(sum(v for v in timing.values() if isinstance(v, (int, float))), 1),
       "timing_detail": timing.get("detail") or {},
       # the planner (owner 2026-10-14: Claude Sonnet through Anthropic, or through Token Supply on test): Token
       # Supply's calls and Anthropic's, the answers asked again or handed to Anthropic, why Token Supply turned off;
       # its log line, the run's whole Claude bill line and Token Supply's part of it
       "planner": (timing.get("detail") or {}).get("planner") or {},
       "planner_line": grab(r"planner \(\w+\): .*"), "claude_line": grab(r"Claude this run: .*"),
       "token_supply_line": grab(r"Token Supply this run: .*"),
       "pictures_line": grab(r"pictures in .*"), "judge_line": grab(r"judge: .*"),
       "checks_line": grab(r"picture checks \(.*"), "store_line": grab(r"verdict store: .*"),
       "words_line": grab(r"words on screen: .*"), "unplanned_line": grab(r".*could not be planned.*"),
       "stopped": grab(r".*(PlanningStopped|OutOfCredit).*"),
       "gemini_line": grab(r"Gemini photo picks: .*"),
       # A1 (2026-10-10): Commons first, Bing free, Brave as backup - the counts and where the shown pictures came from
       "search": json.load(open(work / "search.json")) if (work / "search.json").exists() else {},
       "search_line": grab(r"search: Commons .*"), "sources_line": grab(r"on screen by source: .*"),
       "bing_lines": re.findall(r".*Bing (?:\(free web pictures\)|is back|re-check).*", L)[-6:],
       "on_screen_by_source": dict(collections.Counter(s.get("provider") or ("ai" if s.get("ai") else "?") for s in shots)),
       # C1 (2026-10-10): repeats and stand-ins on the FINAL cut, counted by photo identity (companions too) against the
       # film's caps - the reuse guard's own record; the log lines of the three picture passes
       "reuse": json.load(open(work / "reuse.json")) if (work / "reuse.json").exists() else {},
       "reuse_line": grab(r"reuse on the final cut: .*"), "stand_ins_line": grab(r"stand-ins: \d+ shots without .*"),
       "repeats_line": grab(r"repeats: \d+ of \d+ allowed.*"),
       "guard_lines": re.findall(r".*reuse guard: .*", L)[-10:],
       # D1 (2026-10-10): the pre-render gate - what it found and repaired, the card check, what it warned about
       "gate": {k: v for k, v in gate.items()
                if k in ("result", "rounds", "first_look", "repairs", "left", "stuck", "measure", "card_check", "warnings",
                         "scenes", "kept_on_exact", "checked", "soft", "notes")},
       "gate_lines": re.findall(r".*pre-render gate.*", L)[-6:],
       # E1 (owner 2026-10-10): Commons first only for named shots (the saving), and the frame-only crops of real photos
       "search_order_line": grab(r"search order: .*"), "frame_crops_line": grab(r"frame crops: .*"),
       "frame_rechecks": checks.get("frame_rechecks", {}),
       "highlight": {k: v for k, v in hl.items() if k != "rejected"},
       "highlight_refused": dict(collections.Counter(
           ("not chosen by Claude" if x.get("by") == "claude" else re.sub(r"\s*\(.*$|:.*$", "", str(x.get("why") or "")))
           for x in hl.get("rejected") or [])),
       "highlight_pages_in_plan": sum(1 for sc in plan if (sc.get("device") or {}).get("id") == "highlight-page"),
       "highlight_line": grab(r"highlighted text: .*"), "highlight_pages_line": grab(r"highlighted pages: .*"),
       # PACE (owner 2026-10-11, locked): the pace by position - each section against its target and band (0-30 s
       # 7-8 shots / one over 6 s, 0-60 s 3.9, 0-5 min 4.0, first half 4.0-4.1, second half 4.3), what the gate could
       # not mend (a warning, never a stop), and the planner's pacing lines (cuts made inside a sentence, if any)
       "pacing": gate.get("pacing") or (gate.get("measure") or {}).get("pacing") or {},
       "pacing_soft": {k: v for k, v in (gate.get("soft") or {}).items()},
       "pacing_warnings": [w for w in gate.get("warnings") or [] if str(w).startswith("pacing")],
       "pace_line": grab(r"pre-render gate, pace by position: .*"),
       "pacing_lines": re.findall(r".*\bpacing(?: by position)?[: (].*", L)[-4:],
       # MAP/DATE (owner 2026-10-11): his location map and date overlay - every shot that carries one in the drawn plan,
       # the map plates made, the section turns cut in hard on one, and the sound (his map, page and gallery sounds)
       "map_date": {"location_maps": maps, "date_stamps": dates, "maps": len(maps), "dates": len(dates),
                    "dates_on_maps": sum(1 for m in maps if m.get("date")),
                    "map_plates": len([f for f in glob.glob(str(work / "maps" / "map_*.jpg")) if ".part." not in f])},
       # the step (places_and_dates) and the gate's maps-and-dates rules: Claude asked/cached/failed, each candidate
       # placed or skipped with its reason, the year cards it replaced, the words that moved for a spot, later drops
       "places_dates": {"claude": md.get("claude"), "ran": md.get("ran"), "on_screen": md.get("on_screen", []),
                        "places": [{k: x.get(k) for k in ("name", "at_s", "status", "why", "label", "imagery", "rank")}
                                   for x in md.get("places") or []],
                        "dates": [{k: x.get(k) for k in ("said", "at_s", "status", "why", "big", "small", "shared")}
                                  for x in md.get("candidate_dates") or []],
                        "year_cards": md.get("year_cards", []), "moved_words": md.get("blocks", []),
                        "dropped": md.get("dropped", []),
                        "imagery": dict(collections.Counter(x.get("imagery") for x in md.get("on_screen") or []
                                                            if x.get("kind") == "map"))},
       "places_dates_lines": re.findall(r".*(?:places and dates: |maps and dates: |      place ['\"]|      date ['\"]|      map ').*", L)[-40:],
       "map_date_lines": re.findall(r".*(?:location-map|date-stamp|location map|date overlay|map plate|geocod).*", L)[-8:],
       "hard_cut_notes": re.findall(r".*transitions: shot .* carries his .*", L)[-8:],
       "template_sounds_in_plan": dict(collections.Counter(
           (sc.get("device") or {}).get("id") for sc in plan
           if (sc.get("device") or {}).get("id") in ("highlight-page", "gallery-strip", "location-map"))),
       "sound_line": grab(r"sound: \d+ cue\(s\).*"), "sound_warning": grab(r"sound: WARNING.*")}
json.dump(res, open(out, "w"), indent=1); print(json.dumps(res, indent=1))
