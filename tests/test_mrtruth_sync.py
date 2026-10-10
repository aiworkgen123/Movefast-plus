"""Mr Truth: overlays on their words under the owner's cap (2026-10-10), the folds' cap, cap_shots and the plan-aware
stall check. Synthetic narration only, no network, no paid calls (ffmpeg makes two tiny clips).

    .venv/bin/python tests/test_mrtruth_sync.py          (or pytest, when it is installed)
"""
import hashlib
import json
import subprocess
import sys
import tempfile
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import make_video  # noqa: E402
import mrtruth as m  # noqa: E402
from farm import prepared  # noqa: E402

LOG = []
ENG = types.SimpleNamespace(log=LOG.append, UTILITY_MODEL="x", SCRIPT_MODEL="x")
m._fit_devices = lambda rows, only=None: None          # the picture checks need real pictures; not these tests


def film(lines):
    """lines: [(seconds, "words of the line.")] -> (cues, heard words, rows one per line, a job dir with the words)."""
    cues, heard, t = [], [], 0
    for secs, text in lines:
        d = int(secs * 1000)
        words = text.split()
        cues.append((t, t + d, text))
        heard += [(t + d * k // len(words), w.strip(".,").lower()) for k, w in enumerate(words)]
        t += d
    rows = [{"startMs": a, "endMs": b, "text": txt, "device": None, "pick": {"photo": f"p{i}.jpg", "score": 7.0},
             "spare": [{"photo": f"s{i}.jpg", "score": 6.0}], "visualIntent": f"picture {i}"}
            for i, (a, b, txt) in enumerate(cues)]
    job = Path(tempfile.mkdtemp())
    (job / "words_heard.json").write_text(json.dumps([[w, ms / 1000, ms / 1000 + 0.2] for ms, w in heard]))
    return cues, heard, rows, job


def w(i, j):
    """Word j of line i: a made-up word no other word shares a stem with (_spoken_at matches words by stem)."""
    h = hashlib.md5(f"{i}-{j}".encode()).hexdigest()
    return "".join(chr(97 + int(h[k:k + 2], 16) % 26) for k in range(0, 16, 2))


def plain_film(n=24, secs=4.0):
    return film([(secs, " ".join(w(i, j) for j in range(5)) + ".") for i in range(n)])


def snap(rows):
    return [(r["startMs"], r["endMs"], (r.get("device") or {}).get("id"), (r.get("typedCaption") or {}).get("startFrame"))
            for r in rows]


def on_screen(r):
    tc = r.get("typedCaption")
    return r["startMs"] + (tc["startFrame"] * 1000 / m.FPS if tc else 0)


def test_hold_and_the_caption_fold_stop_at_the_cap():
    rows = [{"startMs": 0, "endMs": 1500, "text": "a", "device": None},
            {"startMs": 1500, "endMs": 9000, "text": "b", "device": None},
            {"startMs": 9000, "endMs": 10000, "text": "c", "device": None}]
    m._hold(ENG, rows, 0, 3.0, "a template")
    assert [r["endMs"] for r in rows] == [1500, 9000, 10000]          # 1.5 + 7.5 s would pass 8 s: no fold
    cues, heard, rows, job = film([(4, "one two three."), (1.2, "four five."), (7.6, "six seven eight nine."), (4, "ten.")])
    (job / "mrtruth").mkdir()
    key = m._hash([m.TC_PROMPT, [(r["text"], False) for r in rows]])
    (job / "mrtruth" / "typed_captions.json").write_text(json.dumps({"key": key, "captions": [
        {"shot": 1, "lines": ["A Long Caption That Needs", "Its Time To Be Read Through"]}]}))
    m.typed_captions(ENG, job, rows, "script")
    tc = next(r for r in rows if r.get("typedCaption"))
    assert tc["endMs"] - tc["startMs"] <= m.SCENE_MAX_S * 1000 and len(rows) == 4


def test_lay_keeps_every_cut_when_nothing_moved_and_moves_only_the_touching_shot():
    cues, heard, rows, job = plain_film(6, 3.5)
    for r in rows:
        r["_said"] = (r["startMs"], r["endMs"])
    starts = [a for a, b, t in cues]
    floor = lambda x: m.SYNC_MIN_SHOT_MS
    same = m._lay(rows, 0, rows[-1]["endMs"], floor, starts)
    assert same == [(r["startMs"], r["endMs"]) for r in rows]
    early = m._lay(rows, 0, rows[-1]["endMs"] - 1500, floor, starts)  # the next overlay's word comes 1.5 s early
    assert early[:-1] == same[:-1] and early[-1] == (same[-1][0], same[-1][1] - 1500)
    squeezed = m._lay(rows, 0, rows[-1]["endMs"] - 3000, floor, starts)   # past the last shot's floor: the cut
    end = rows[-1]["endMs"] - 3000                                          # before it moves just enough (no
    assert squeezed[:-2] == same[:-2] and squeezed[-1] == (end - 1000, end)  # subtitle start is near enough)
    assert squeezed[-2] == (same[-2][0], end - 1000)


def test_overlays_start_on_their_words_and_a_second_sync_changes_nothing():
    cues, heard, rows, job = plain_film(30, 3.6)
    rows[0]["device"] = {"id": "P03", "headline": "Opening", "kicker": "Film"}
    rows[5]["device"] = {"id": "corner-label", "label": w(5, 3)}              # its word late in its own line
    rows[9]["typedCaption"] = {"lines": [f"{w(10, 1)} {w(10, 2)}"], "startFrame": 8}   # its words in the next line
    rows[16]["device"] = {"id": "P04", "mainLine": w(15, 1)}                  # its words in the line before
    rows[22]["typedCaption"] = {"lines": [f"{w(22, 3)} {w(22, 4)}"], "startFrame": 8}  # late in its own line: pre-roll
    m.sync_overlays(ENG, job, rows, cues)
    for r in rows[1:]:
        if r.get("device") or r.get("typedCaption"):
            words = m._overlay_words(r)
            at = min(abs(on_screen(r) - ms) for ms, h in heard if h in words)
            assert at <= 500, (r["text"], at)
    cap = next(r for r in rows if (r.get("typedCaption") or {}).get("lines") == [f"{w(22, 3)} {w(22, 4)}"])
    assert cap["startMs"] == cues[22][0] and cap["typedCaption"]["startFrame"] > m.TYPED_CAPTION_START_F
    one = snap(rows)
    m.sync_overlays(ENG, job, rows, cues)
    assert snap(rows) == one
    assert all(a["endMs"] == b["startMs"] for a, b in zip(rows, rows[1:])) and rows[-1]["endMs"] == cues[-1][1]
    assert max(r["endMs"] - r["startMs"] for r in rows) <= m.SCENE_MAX_S * 1000


def test_a_label_moves_to_the_line_that_says_it_and_a_lesser_one_gives_way():
    cues, heard, rows, job = plain_film(20, 3.6)
    rows[8]["device"] = {"id": "corner-label", "label": w(9, 2)}
    rows[9]["device"] = {"id": "shadow-up", "line": f"{w(9, 0)} {w(9, 1)}"}
    m.sync_overlays(ENG, job, rows, cues)
    at = next(r for r in rows if (r.get("device") or {}).get("id") == "corner-label")
    assert at["text"].startswith(w(9, 0)) and not any((r.get("device") or {}).get("id") == "shadow-up" for r in rows)
    assert at["startMs"] - at["_said"][0] < 3600 and abs(on_screen(at) - (cues[9][0] + 2 * 3600 // 5)) <= 500


def test_a_chapter_keeps_its_sentence_start_and_steps_back_for_a_caption():
    cues, heard, rows, job = plain_film(40, 3.6)
    rows[10]["device"], rows[10]["section_turn"] = {"id": "chapter-plate", "heading": f"{w(10, 3)} {w(10, 4)}"}, True
    m.sync_overlays(ENG, job, rows, cues)
    ch = next(r for r in rows if r.get("section_turn"))
    assert ch["startMs"] == cues[10][0]                       # never pinned to its heading's words, mid-sentence
    cues, heard, rows, job = plain_film(40, 3.6)
    rows[20]["device"], rows[20]["section_turn"] = {"id": "chapter-plate", "heading": "Turn"}, True
    rows[21]["typedCaption"] = {"lines": [f"{w(20, 0)} {w(20, 1)}"], "startFrame": 8}   # said in the chapter's line
    m.sync_overlays(ENG, job, rows, cues)
    ch = next(r for r in rows if r.get("section_turn"))
    cap = next(r for r in rows if r.get("typedCaption"))
    assert ch["startMs"] == cues[19][0] and cap["text"].startswith(w(20, 0))      # both kept, both on their line


def test_cap_shots_cuts_a_run_on_and_marks_the_new_part_for_a_picture():
    cues, heard, rows, job = plain_film(12, 3.0)
    rows[0]["device"] = {"id": "P03", "headline": "Opening", "kicker": "Film"}
    rows[3]["device"] = {"id": "corner-label", "label": w(3, 0)}
    rows[4]["device"] = {"id": "top-title", "line1": w(7, 0)}                # 3 lines on: the label runs on to it
    m.sync_overlays(ENG, job, rows, cues)
    info = m.cap_shots(ENG, job, rows, cues)
    assert max(r["endMs"] - r["startMs"] for r in rows) <= m.SCENE_MAX_S * 1000
    parts = [r for r in rows if r.get("needs_picture")]
    assert parts and info["splits"] and all(r["split"] and r["pick"] and isinstance(r["pool"], list) for r in parts)
    assert all(r["pick"]["photo"] not in {x["pick"]["photo"] for x in rows if x is not r} for r in parts
               if r["step"] == "split-spare")
    again = snap(rows)
    assert m.cap_shots(ENG, job, rows, cues) == {"joins": 0, "splits": []} and snap(rows) == again


def test_a_planned_long_hold_is_the_only_shot_past_the_cap():
    cues, heard, rows, job = plain_film(8, 6.5)
    rows[3]["endMs"], rows[3]["hold"] = rows[4]["endMs"], True
    del rows[4]
    m.sync_overlays(ENG, job, rows, cues)
    m.cap_shots(ENG, job, rows, cues)
    assert [round((r["endMs"] - r["startMs"]) / 1000, 1) for r in rows if r.get("hold")] == [13.0]
    assert all(r["endMs"] - r["startMs"] <= 8000 for r in rows if not r.get("hold"))


def test_cap_shots_calms_a_long_run_of_quick_shots_and_never_moves_an_overlay():
    cues, heard, rows, job = film([(1.5, f"{w(i, 0)} {w(i, 1)}.") for i in range(10)] + [(4, "long line here.")] * 3)
    rows[4]["device"] = {"id": "photo-pop"}
    for r in rows:
        r["_said"] = (r["startMs"], r["endMs"])
    joins = m._calm_cuts(rows)
    run = best = 0
    for r in rows:
        run = run + 1 if r["endMs"] - r["startMs"] < m.SHORT_S * 1000 else 0
        best = max(best, run)
    assert joins and best <= m.SHORT_RUN_MAX and any((r.get("device") or {}).get("id") == "photo-pop" for r in rows)


def clip(path, secs, still_from=None):
    """A tiny moving clip; from still_from on its last frame sits still to the end (a failed read)."""
    vf = "scale=160:90"
    if still_from is not None:
        vf += f",trim=end={still_from},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={secs}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=size=320x180:rate=30:duration={secs}",
                    "-vf", vf, "-t", str(secs), "-pix_fmt", "yuv420p", str(path)], check=True)


def test_the_stall_check_knows_a_failed_read_from_a_slow_shot():
    tmp = Path(tempfile.mkdtemp())
    good, bad = tmp / "good.mp4", tmp / "bad.mp4"
    clip(good, 8)
    clip(bad, 8, still_from=3)
    assert make_video._picture_stalls(good, cuts=[0, 4]) is None
    assert make_video._picture_stalls(bad, cuts=[0, 4]) is not None          # frozen to the end across a planned cut
    assert make_video._picture_stalls(bad, cuts=[0, 2]) is None              # ... after the last cut: nothing to tell
    assert make_video._picture_stalls(bad) is None                           # no plan: shorter than hold_s
    assert make_video._picture_stalls(bad, hold_s=4.0) is not None


def test_the_farm_still_extracts_the_encode_helpers():
    code = prepared._encoder_source(make_video)
    ns = {}
    exec(compile(code, "final_encode.py", "exec"), ns)
    assert {"_warm_read", "_picture_stalls", "_execute_final_encode"} <= set(ns)
    assert "cuts" in ns["_execute_final_encode"].__code__.co_varnames


if __name__ == "__main__":
    tests = [(k, v) for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for name, fn in tests:
        fn()
        print(f"ok  {name}")
    print(f"{len(tests)} passed")
