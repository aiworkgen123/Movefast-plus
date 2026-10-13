"""Mr Truth pacing in beats() (owner 2026-10-10): synthetic narration only, no network, no paid calls.

    .venv/bin/python tests/test_mrtruth_pacing.py          (or pytest, when it is installed)
"""
import copy
import json
import random
import sys
import tempfile
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import make_video  # noqa: E402  (its subtitle parser only)
import mrtruth as m  # noqa: E402

LOG = []
ENG = types.SimpleNamespace(log=LOG.append, UTILITY_MODEL="x", _parse_srt_full=make_video._parse_srt_full)


def narration(seed=7, n_sent=120):
    """Subtitle cues of a made-up narration: sentences of one to four lines, commas inside some, short punchy ones."""
    rng, cues, t, w = random.Random(seed), [], 0, 0
    for s in range(n_sent):
        punchy = rng.random() < 0.18
        lines = 1 if punchy else rng.choice((1, 2, 2, 3, 3, 4))
        for k in range(lines):
            d = rng.randint(1100, 2000) if punchy else rng.randint(1200, 3000)
            words = [f"w{w + i}" for i in range(3 if punchy else rng.randint(4, 8))]
            w += len(words)
            end = "." if k == lines - 1 else ("," if rng.random() < 0.3 else "")
            cues.append((t, t + d - 80, " ".join(words) + end))
            t += d
    return cues


def rows_on(cues, starts):
    """Planner rows cut at the given cue indexes (contiguous, like beats() makes them)."""
    rows = []
    for j, k in enumerate(starts):
        a = cues[k][0] if j else 0
        b = cues[starts[j + 1]][0] if j + 1 < len(starts) else cues[-1][1]
        rows.append({"startMs": a, "endMs": b, "text": " ".join(t for x, y, t in cues if a <= x < b),
                     "visualIntent": f"picture {j}", "queries": [f"literal {j}", f"concept {j}", "mood"],
                     "entities": [], "mood": "", "sceneType": "imagery", "about": ""})
    return rows


def durs(rows):
    return [(r["endMs"] - r["startMs"]) / 1000 for r in rows]


def quick_run(rows):
    run = best = 0
    for x in durs(rows):
        run = run + 1 if x < m.SHORT_S else 0
        best = max(best, run)
    return best


def check_invariants(rows, cues, orig):
    starts = {a for a, b, t in cues}
    assert all(a["endMs"] == b["startMs"] for a, b in zip(rows, rows[1:])), "rows not contiguous"
    assert all(r["startMs"] in starts for r in rows[1:]), "a cut off a subtitle start"
    assert rows[0]["startMs"] == orig[0]["startMs"] and rows[-1]["endMs"] == orig[-1]["endMs"]
    was = {json.dumps(r["overlay"], sort_keys=True): r["startMs"] for r in orig if r.get("overlay")}
    now = {json.dumps(r["overlay"], sort_keys=True): r["startMs"] for r in rows if r.get("overlay")}
    assert set(was) == set(now), "an overlay was lost"
    assert all(now[k] >= was[k] for k in now), "an overlay starts earlier than planned"


def paced(rows, cues):
    rows = copy.deepcopy(rows)
    m._paced(ENG, rows, cues)
    return rows


def test_cut_kind():
    assert m._cut_kind("it ended.") == m._cut_kind("he said, \"no.\"") == m._cut_kind("why?") == m._cut_kind("so…") == 2
    assert m._cut_kind("first,") == m._cut_kind("then —") == m._cut_kind("one;") == m._cut_kind("this:") == 1
    assert m._cut_kind("and the") == m._cut_kind("") == 0


def test_one_row_per_line_is_paced():
    cues = narration()
    raw = rows_on(cues, list(range(len(cues))))
    out = paced(raw, cues)
    d = durs(out)
    aimed = (cues[-1][1] / 1000) / sum(b[2] for b in m._pace_bins(int(cues[-1][1]), m.PACE_LEAD_S))   # the curve's count
    assert abs(sum(d) / len(d) - aimed) < 0.15, (sum(d) / len(d), aimed)
    assert max(d) <= m.SCENE_MAX_S and quick_run(out) <= m.SHORT_RUN_MAX
    check_invariants(out, cues, raw)
    # every punchy whole sentence that had its own row keeps it - after the first 30 s, whose 7-8 shots (owner
    # 2026-10-11) can take one on a narration this quick (16 lines in 30 s, one shot over 6 s there already)
    punchy = [(r["startMs"], r["endMs"]) for i, r in enumerate(raw) if r["endMs"] - r["startMs"] < 3000
              and len(r["text"].split()) <= m.PUNCHY_WORDS and m._cut_kind(r["text"]) == 2
              and (i == 0 or m._cut_kind(raw[i - 1]["text"]) == 2) and r["startMs"] >= m.PACE_OPEN_S * 1000]
    opening = [r for r in out if r["startMs"] < m.PACE_OPEN_S * 1000]
    assert m.PACE_OPEN_N[0] <= len(opening) <= m.PACE_OPEN_N[1], len(opening)
    assert sum(r["endMs"] - r["startMs"] > m.PACE_OPEN_LONG_S * 1000 for r in opening) <= 1
    kept = {(r["startMs"], r["endMs"]) for r in out}
    assert punchy and all(p in kept for p in punchy), [p for p in punchy if p not in kept][:3]
    assert sum(r.get("joined", 0) for r in out) == len(raw) - len(out)


def test_deterministic_and_idempotent():
    cues = narration(11)
    raw = rows_on(cues, list(range(len(cues))))
    a, b = paced(raw, cues), paced(raw, cues)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    assert json.dumps(paced(a, cues), sort_keys=True) == json.dumps(a, sort_keys=True)


def test_long_rows_split_at_a_sentence_end():
    cues = [(0, 3900, "one two three four."), (4000, 7900, "five six seven"), (8000, 11900, "eight nine ten."),
            (12000, 14900, "next line here.")]
    raw = rows_on(cues, [0, 3])
    raw[0]["overlay"] = {"text": "x", "kind": "name", "style": "fullFrame", "atMs": 8500}
    out = paced(raw, cues)
    assert [r["startMs"] for r in out] == [0, 4000, 12000], [r["startMs"] for r in out]
    assert out[1]["split"] and out[1]["queries"] == ["concept 0", "literal 0", "mood"]
    assert out[0]["text"] == "one two three four." and out[1]["text"] == "five six seven eight nine ten."
    assert out[1]["overlay"]["atMs"] == 8500 and not out[0].get("overlay")       # the part that says it
    check_invariants(out, cues, raw)


def test_a_line_too_long_to_cut_is_kept_and_reported():
    cues = [(0, 11000, "one very long line."), (11000, 14000, "the next.")]
    LOG.clear()
    out = paced(rows_on(cues, [0, 1]), cues)
    assert [r["startMs"] for r in out] == [0, 11000]
    assert any("still over 8 s" in x for x in LOG), LOG


def test_overlay_never_pulled_earlier():
    cues = [(i * 1000, i * 1000 + 900, f"w{i}") for i in range(40)]
    raw = rows_on(cues, list(range(40)))
    for r in raw[1::2]:
        r["overlay"] = {"text": f"o{r['startMs']}", "kind": "name", "style": "fullFrame", "atMs": r["startMs"]}
    LOG.clear()
    out = paced(raw, cues)
    check_invariants(out, cues, raw)
    assert quick_run(out) > m.SHORT_RUN_MAX and any("quick shots in a row" in x for x in LOG), LOG


def test_join_keeps_the_planned_brief():
    cues = [(0, 1900, "a b"), (2000, 4900, "c d e.")]
    rows = rows_on(cues, [0, 1])
    rows[1]["unplanned"] = True                    # the longer one is a fallback row: the planned brief wins
    rows[1]["entities"] = ["Somewhere"]
    m._join(rows, 0, cues)
    assert len(rows) == 1 and rows[0]["visualIntent"] == "picture 0" and not rows[0].get("unplanned")
    assert rows[0]["entities"] == ["Somewhere"] and rows[0]["text"] == "a b c d e." and rows[0]["joined"] == 1
    rows = rows_on(cues, [0, 1])
    rows[1]["sceneType"] = "quote"
    m._join(rows, 0, cues)
    assert rows[0]["visualIntent"] == "picture 1" and rows[0]["sceneType"] == "quote"   # the longer one's brief


def test_over_merged_plan_is_split_back():
    cues = narration(3)
    raw = rows_on(cues, list(range(0, len(cues), 6)))
    out = paced(raw, cues)
    assert max(durs(out)) <= m.SCENE_MAX_S and len(out) > len(raw)
    check_invariants(out, cues, raw)


def test_merged_plan_grows_at_sentence_ends():
    # rows of three short whole sentences (2 + 2.4 + 2.2 s): no cut leaves two parts of 3 s, so the sentences part
    cues, t = [], 0
    for i in range(60):
        d = (2000, 2400, 2200)[i % 3]
        cues.append((t, t + d - 80, f"s{i} a b c."))
        t += d
    raw = rows_on(cues, list(range(0, 60, 3)))
    out = paced(raw, cues)
    d = durs(out)
    ceil = (cues[-1][1] / 1000) / sum(b[3] for b in m._pace_bins(int(cues[-1][1]), m.PACE_LEAD_S))  # PACE_CEIL_UP_S slower
    assert sum(durs(raw)) / len(raw) > ceil >= sum(d) / len(d), (sum(d) / len(d), ceil)
    assert quick_run(out) <= m.SHORT_RUN_MAX and all(m._cut_kind(r["text"]) == 2 for r in out)
    check_invariants(out, cues, raw)


def _job(cues):
    tmp = Path(tempfile.mkdtemp())
    srt = tmp / "subs.srt"
    hms = lambda ms: f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    srt.write_text("\n\n".join(f"{i + 1}\n{hms(a)} --> {hms(b)}\n{t}" for i, (a, b, t) in enumerate(cues)) + "\n",
                   encoding="utf-8")
    return tmp, srt


def test_beats_caches_claudes_rows_and_paces_them_on_load():
    cues = narration(5, 60)
    tmp, srt = _job(cues)
    dossier = {"topic": "synthetic"}
    asked = []

    def fake_ask(engine, prompt, max_tokens, model="", head="", **kw):
        prompt = head + prompt                     # a shared head is the start of the same prompt
        asked.append(prompt)
        f0, f1 = (int(x) for x in prompt.rsplit("FOCUS RANGE: ", 1)[1].split("ms.", 1)[0].split("ms to "))
        return {"scenes": [dict(r) for r in rows_on(cues, list(range(len(cues))))
                           if f0 <= r["startMs"] < f1 or (r["startMs"] == 0 and f0 == 0)]}

    real = m._ask
    m._ask = fake_ask
    try:
        LOG.clear()
        got = m.beats(ENG, tmp, srt, "a synthetic script", dossier)
    finally:
        m._ask = real
    cached = json.loads((tmp / "mrtruth" / "beats.json").read_text(encoding="utf-8"))
    assert len(cached["rows"]) == len(cues) and len(got) < len(cues)        # Claude's rows cached, paced ones returned
    assert json.dumps(got, sort_keys=True) == json.dumps(paced(cached["rows"], cues), sort_keys=True)
    assert any(x.strip().startswith(f"pacing: {len(cues)} planned shots") for x in LOG)
    p = asked[0]
    assert "write the different views instead" not in p and "Split it yourself" not in p
    assert "One sentence is one scene" in p and "every second sentence;" in p and "every second shot" not in p
    # a second load asks nothing and returns the same paced rows
    ENG.claude = lambda *a, **k: (_ for _ in ()).throw(AssertionError("Claude was called"))
    again = m.beats(ENG, tmp, srt, "a synthetic script", dossier)
    assert json.dumps(again, sort_keys=True) == json.dumps(got, sort_keys=True)


def test_pacing_brief_hygiene():
    brief = m._pacing(m._prompts()["segmentation"].replace("{TARGET_SECONDS}", f"{m.TARGET_SCENE_S:.1f}"))
    assert "write the different views instead" not in brief and "Split it yourself" not in brief
    assert "five seconds" not in brief and "NEVER write a scene longer than 8 seconds." in brief
    assert "A sentence longer than 8 seconds is split at its clause, here" in brief


if __name__ == "__main__":
    tests = [(k, v) for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print(f"ok  {name}")
    print(f"{len(tests)} passed")
