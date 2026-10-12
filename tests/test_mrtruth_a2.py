"""Mr Truth A2 (2026-10-10): yes/no picture checks on the same Gemini, and every verdict saved (verdicts.py).
Synthetic data only: no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_a2 -v
"""
import gzip
import json
import os
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import mrtruth as M  # noqa: E402
import verdicts as V  # noqa: E402


def textured(path, seed, size=(1600, 900)):
    """A picture with real structure; the same seed is the same picture."""
    import numpy as np
    from PIL import Image, ImageFilter
    rng = np.random.default_rng(seed)
    a = (rng.random((90, 160, 3)) * 255).astype("uint8")
    im = Image.fromarray(a).resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=88)
    return Path(path)


def answer(n, shows="kind", **kw):
    x = {"n": n, "real": True, "text": False, "frame": False, "banned": False, "shows": shows, "person": False,
         "studio": False, "subject": f"thing {n}", "x": 0.4, "y": 0.6}
    x.update(kw)
    return x


class FakeGemini:
    """engine.pick_vision as Gemini answers it: `plan(caption) -> answer fields` decides each picture by its caption."""

    def __init__(self, plan=None, delay=0.0, via="gemini"):
        self.plan, self.delay, self.via = plan or (lambda cap: {}), delay, via
        self.calls, self.lock = [], threading.Lock()

    def __call__(self, prompt, paths, max_tokens=800, model="", thinking="", purpose="", media="", lead="",
                 labels=None, info=None):
        with self.lock:
            self.calls.append({"prompt": prompt, "paths": list(paths), "model": model, "thinking": thinking,
                               "purpose": purpose, "media": media, "lead": lead, "labels": list(labels or [])})
        time.sleep(self.delay)
        if info is not None:
            info.update(via=self.via)
        out = []
        for n, lab in enumerate(labels or [], 1):
            got = self.plan(lab.split("caption: ", 1)[-1])
            if got is None:                          # this picture is left out of the answer
                continue
            out.append(answer(n, **dict({"subject": lab.split("caption: ", 1)[-1]}, **got)))
        return json.dumps(out)


class Engine:
    SCRIPT_MODEL = UTILITY_MODEL = "stub"
    STYLE_INFO = {}

    def __init__(self, gem=None):
        self.lines = []
        self.GEMINI_PICKS = {"calls": 0, "fallback": 0, "by": {}}
        self.pick_vision = gem or FakeGemini()
        self.AI_IMAGE_CAP = 10

    def log(self, s):
        self.lines.append(s)

    def claude(self, *a, **k):
        raise RuntimeError("no Claude in a unit test")


class Tmp(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)
        self.env = mock.patch.dict(os.environ, {"MRTRUTH_VERDICTS_DB": str(self.d / "store" / "v.sqlite"),
                                                "MRTRUTH_VERDICTS": "on", "MRTRUTH_JUDGE": "yesno"})
        self.env.start()
        M.VERDICTS.update(store=None, film="film-1")
        M.VSTAT.clear()
        M.BUDGET.clear()                             # no film's AI budget yet (pictures() sets one per film)

    def tearDown(self):
        self.env.stop()
        M.VERDICTS.update(store=None, film="")
        with V._STORES_LOCK:
            for st in V._STORES.values():
                st.close()
            V._STORES.clear()
        for st in getattr(self, "opened", []):
            st.close()
        self.tmp.cleanup()


# ── the store ──────────────────────────────────────────────────────────────────────────────────────────────────────
class Store(Tmp):
    def store(self, name="a.sqlite", run="r1"):
        st = V.Store(self.d / name, say=lambda s: None, run=run)
        self.opened = getattr(self, "opened", []) + [st]
        return st

    def test_resolution_rule_and_dirty_at_medium(self):
        st = self.store()
        st.put([("p1", "q", "line", "MEDIUM", {"shows": "kind"}, "", "m")])
        self.assertEqual(st.get("p1", "q", "line", "LOW"), {"shows": "kind"})
        self.assertEqual(st.get("p1", "q", "line", "MEDIUM"), {"shows": "kind"})
        self.assertIsNone(st.get("p1", "q", "line", "HIGH"))           # a HIGH check never takes a MEDIUM answer
        st.put([("p1", "q", "line", "HIGH", {"shows": "exact"}, "", "m")])
        self.assertEqual(st.get("p1", "q", "line", "MEDIUM"), {"shows": "exact"})   # the higher look wins
        st.put([("p2", "q", "a", "LOW", {"text": True}, "text", "m"), ("p3", "q", "a", "MEDIUM", {"frame": True}, "frame", "m")])
        self.assertEqual(st.dirty("p2", "q", "LOW"), "")                 # found at LOW: asked again
        self.assertEqual(st.dirty("p3", "q", "LOW"), "frame")            # found at MEDIUM: reused for every line
        self.assertEqual(st.dirty("p3", "other-qset", "MEDIUM"), "")     # another question set: not reused

    def test_single_flight_thirty_threads(self):
        st = self.store()
        asked, lock = {}, threading.Lock()

        def ask(part):
            time.sleep(0.03)
            with lock:
                for it in part:
                    asked[it[-1]] = asked.get(it[-1], 0) + 1
            return {it[-1]: {"shows": "kind", "text": False} for it in part}, "gemini"
        keys = [(f"p{k}", "q", f"line{k % 7}", 2) for k in range(40)]
        work = [[(0, {}, None, keys[(t * 3 + j) % 40]) for j in range(8)] for t in range(30)]
        threads = [threading.Thread(target=lambda w=w: M._checked(st, w, ask)) for w in work]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        wanted = {it[-1] for w in work for it in w}
        self.assertEqual(set(asked), wanted)
        self.assertEqual(max(asked.values()), 1)                         # no question asked twice
        self.assertEqual(st.stats()["answers"], len(wanted))

    def test_first_look_is_waited_for_and_dirty_skipped(self):
        st = self.store()
        calls = []

        def ask(part):
            calls.append([it[-1] for it in part])
            time.sleep(0.2)
            return {it[-1]: {"shows": "kind", "text": True} for it in part}, "gemini"
        dirt = lambda a: "text" if a.get("text") else ""
        a = [(0, {}, None, ("pic", "q", "line-a", 2))]
        b = [(0, {}, None, ("pic", "q", "line-b", 2))]
        t = threading.Thread(target=lambda: M._checked(st, a, ask, dirt))
        t.start()
        time.sleep(0.05)
        got = M._checked(st, b, ask, dirt)                               # another line, same picture: waits, skips
        t.join()
        self.assertEqual(len(calls), 1)
        self.assertEqual(got[("pic", "q", "line-b", 2)], (None, "dirty:text"))

    def test_failed_and_claude_answers_never_stored(self):
        st = self.store()
        part = [(0, {}, None, (f"p{k}", "q", "l", 2)) for k in range(4)]
        got = M._checked(st, part, lambda p: ({p[0][-1]: {"shows": "kind"}}, "gemini"))
        self.assertEqual(sum(1 for a, how in got.values() if how == "asked"), 1)
        self.assertEqual(sum(1 for a, how in got.values() if how == "failed"), 3)
        got = M._checked(st, part, lambda p: ({it[-1]: {"shows": "no"} for it in p}, "claude"))
        self.assertEqual(sorted(h for _, h in got.values()), ["claude", "claude", "claude", "stored"])
        self.assertEqual(st.stats()["answers"], 1)                       # Claude's are used, never kept
        n = []
        M._checked(st, part, lambda p: (n.append(len(p)) or {it[-1]: {"shows": "kind"} for it in p}, "gemini"))
        self.assertEqual(n, [3])                                         # only the three missing are asked again

    def test_export_import_round_trip(self):
        a = self.store("a.sqlite", "run-a")
        a.put([(f"p{k}", "q", "l", 2, {"shows": "kind", "k": k}, "", "m") for k in range(50)])
        n = a.export(self.d / "a.jsonl.gz")
        self.assertEqual(n, 50)
        pod = self.store("pod.sqlite", "run-pod")
        got = pod.import_chunks([self.d / "a.jsonl.gz"])
        self.assertEqual((got["rows"], got["taken"]), (50, 50))
        self.assertEqual(pod.get("p7", "q", "l", 2), {"shows": "kind", "k": 7})
        self.assertEqual(pod.export(self.d / "pod.jsonl.gz"), 0)          # nothing made on the pod yet
        pod.put([("new", "q", "l", 2, {"shows": "no"}, "", "m")])
        self.assertEqual(pod.export(self.d / "pod.jsonl.gz"), 1)          # only what the pod made goes back
        self.assertEqual(pod.import_chunks([self.d / "a.jsonl.gz"])["taken"], 0)   # importing twice changes nothing

    def test_newest_answer_wins_and_old_ones_drop(self):
        def chunk(name, rows):
            with gzip.open(self.d / name, "wt") as fh:
                for r in rows:
                    fh.write(json.dumps({"t": "v", "r": r}) + "\n")
            return self.d / name
        now = int(time.time())
        c1 = chunk("c1.jsonl.gz", [["p", "q", "l", 2, json.dumps({"shows": "no"}), "", "m", "r1", now - 100]])
        c2 = chunk("c2.jsonl.gz", [["p", "q", "l", 2, json.dumps({"shows": "kind"}), "", "m", "r2", now - 50],
                                   ["old", "q", "l", 2, json.dumps({"shows": "kind"}), "", "m", "r0", now - 400 * 86400]])
        st = self.store()
        st.import_chunks([c2, c1])                                       # read in any order: the newest stays
        self.assertEqual(st.get("p", "q", "l", 2), {"shows": "kind"})
        self.assertIsNone(st.get("old", "q", "l", 2))                    # older than MAX_AGE_DAYS

    def test_broken_chunk_line_and_database(self):
        good = self.store("g.sqlite")
        good.put([(f"p{k}", "q", "l", 2, {"shows": "kind"}, "", "m") for k in range(30)])
        good.export(self.d / "g.jsonl.gz")
        raw = (self.d / "g.jsonl.gz").read_bytes()
        (self.d / "cut.jsonl.gz").write_bytes(raw[: len(raw) // 2])        # a chunk cut off mid-way
        with gzip.open(self.d / "junk.jsonl.gz", "wt") as fh:
            fh.write("not json\n" + json.dumps({"t": "v", "r": ["x"]}) + "\n")
        (self.d / "noise.jsonl.gz").write_bytes(b"this is no gzip at all")
        st = self.store("s.sqlite")
        got = st.import_chunks([self.d / "cut.jsonl.gz", self.d / "junk.jsonl.gz", self.d / "noise.jsonl.gz",
                                self.d / "g.jsonl.gz"])
        self.assertEqual(got["bad_chunks"], 2)
        self.assertEqual(got["bad_lines"], 2)
        self.assertEqual(st.stats()["answers"], 30)                      # the whole chunk after the broken ones
        bad = self.d / "bad.sqlite"
        bad.write_bytes(b"SQLite format 3\x00" + b"\xff" * 3000)        # a damaged file
        said = []
        st2 = V.Store(bad, say=said.append, run="x")
        self.opened.append(st2)
        self.assertTrue(st2.moved and Path(st2.moved).exists())
        st2.put([("p", "q", "l", 2, {"shows": "kind"}, "", "m")])
        self.assertEqual(st2.get("p", "q", "l", 2), {"shows": "kind"})
        st2.db.close()                                                   # a database error is a miss, never a stop
        self.assertIsNone(st2.get("p", "q", "l", 2))
        self.assertEqual(st2.put([("p", "q", "l", 2, {}, "", "m")]), 0)
        self.assertTrue(any("asked instead" in s for s in said))

    def test_one_store_per_file_and_compact(self):
        a = V.open_store(self.d / "one.sqlite", say=lambda s: None)
        self.assertIs(a, V.open_store(str(self.d / "." / "one.sqlite"), say=lambda s: None))
        a.put([("p", "q", "l", 2, {"shows": "kind"}, "", "m")])
        a.export(self.d / "x1.jsonl.gz")
        a.put([("p2", "q", "l", 2, {"shows": "no"}, "", "m")])
        a.export(self.d / "x2.jsonl.gz")
        got = V.compact(self.d / "all.jsonl.gz", [self.d / "x1.jsonl.gz", self.d / "x2.jsonl.gz"])
        self.assertEqual(got["written"], 2)

    def test_cli(self):
        a = self.store("cli.sqlite")
        a.put([("p", "q", "l", 2, {"shows": "kind"}, "", "m")])
        a.export(self.d / "c.jsonl.gz")
        with mock.patch("builtins.print") as pr:
            self.assertEqual(V.main(["import", str(self.d / "cli2.sqlite"), str(self.d / "c.jsonl.gz")]), 0)
            self.assertIn("imported 1 of 1", pr.call_args[0][0])
            self.assertEqual(V.main(["export", str(self.d / "missing.sqlite"), str(self.d / "o.gz")]), 0)
            self.assertEqual(pr.call_args[0][0], 0)


# ── answers to decisions ───────────────────────────────────────────────────────────────────────────────────────────
class Answers(unittest.TestCase):
    def test_parser(self):
        raw = json.dumps([answer(1, real="true", text="false", frame=0, banned="no", modern=""),
                          {"n": 2, "real": True, "text": False, "frame": False, "banned": False},       # no shows
                          answer(3, shows="maybe"),                                                     # unknown shows
                          answer(9),                                                                    # wrong n
                          answer(4, modern="office chairs"), answer(4, shows="no"),                   # a second n=4
                          {"real": True, "text": False, "frame": False, "banned": False, "shows": "exact"}])
        got = M._answers("Here: " + raw, 7, era=True)
        self.assertEqual(sorted(got), [0, 3, 6])
        self.assertEqual(got[0]["real"], True)                           # "true" as a string, 0 and "no" as false
        self.assertEqual((got[0]["frame"], got[0]["banned"]), (False, False))
        self.assertEqual(got[3]["modern"], "office chairs")
        self.assertEqual(got[3]["shows"], "kind")                        # the first answer for n=4 stays
        self.assertEqual(got[6]["shows"], "exact")                       # no n: its place in the list
        cut = json.dumps([answer(1), answer(2)])[:-30]                  # a reply cut off mid-way
        self.assertEqual(sorted(M._answers(cut, 2, era=False)), [0])
        self.assertEqual(M._answers("no json here", 3, era=False), {})
        self.assertEqual(M._answers("", 3, era=False), {})
        ai = M._answers(json.dumps([answer(1)]), 1, era=False, ai=True)
        self.assertEqual(ai, {})                                         # an AI answer needs "warped"
        self.assertEqual(M._answers(json.dumps(answer(1, warped=False)), 1, era=False, ai=True)[0]["warped"], False)
        self.assertEqual(M._answers(json.dumps([answer(1, modern=True)]), 1, era=True)[0]["modern"], "something modern")
        self.assertEqual(M._answers(json.dumps([answer(1, modern="none", x="abc")]), 1, era=True)[0]["modern"], "")

    def test_verdict(self):
        a = M._answer(answer(1, shows="exact"), era=True)
        v = M._verdict({"title": "t"}, a)
        self.assertEqual((v["tier"], v["clean"], v["score"], v["depiction"], v["flags"]), (3, True, 8.0, "named-subject", []))
        v = M._verdict({}, a, exact_ok=False)                            # the shot names nothing: kind at best
        self.assertEqual((v["shows"], v["tier"]), ("kind", 2))
        bad = M._answer(answer(1, shows="kind", text=True, real=False, modern="a car"), era=True)
        v = M._verdict({}, bad)
        self.assertEqual(v["bad"], ["text", "not real", "modern: a car"])
        self.assertEqual((v["clean"], v["score"], v["flags"]), (False, 2.0, v["bad"]))
        v = M._verdict({"unjudged": True}, None)
        self.assertTrue(v["unjudged"] and v["tier"] == 0 and not v["clean"])
        v = M._verdict({}, None, known=["text"], looked="dirty")
        self.assertNotIn("unjudged", v)
        self.assertEqual(v["bad"], ["text"])
        w = M._verdict({}, M._answer(answer(1, warped=True), era=False, ai=True), ai=True)
        self.assertEqual(w["bad"], ["warped"])

    def test_older_scored_candidates_read_as_tiers(self):
        self.assertEqual([M._tier({"score": s}) for s in (8, 7, 6, 5, 4, 3, 2)], [3, 3, 2, 2, 1, 1, 0])
        self.assertEqual(M._tier({"score": 8, "depiction": "unrelated"}), 0)
        self.assertFalse(M._clean({"score": 6, "flags": ["modernStock"]}))
        self.assertFalse(M._clean({"score": 2}))
        self.assertTrue(M._clean({"score": 6, "flags": []}))

    def test_rank(self):
        c = lambda **k: dict({"tier": 2, "clean": True, "ar": 1.78, "provider": "bing", "pos": 0}, **k)
        pics = {"dirty_exact": c(tier=3, clean=False), "exact_bing": c(tier=3), "kind_square": c(ar=1.1, provider="commons"),
                "kind_brave": c(provider="brave"), "kind_commons2": c(provider="commons", pos=2),
                "kind_archive_name": c(via="commons-archive", provider="commons", pos=3), "generic": c(tier=1)}
        order = sorted(pics, key=lambda k: M._rank(pics[k]))
        self.assertEqual(order, ["exact_bing", "kind_archive_name", "kind_commons2", "kind_brave", "kind_square",
                                 "generic", "dirty_exact"])
        self.assertEqual(sorted([c(pos=1, provider="bing"), c(pos=0, provider="bing"), c(pos=0, provider="commons")],
                                key=M._search_order), [c(pos=0, provider="commons"), c(pos=0, provider="bing"),
                                                       c(pos=1, provider="bing")])

    def test_era(self):
        self.assertEqual(M._era({"era": "late 1980s, Rome"}, {}), "late 1980s, Rome")
        self.assertEqual(M._era({"era": "today"}, {"period": "4th century"}), "")     # only "today" turns it off
        self.assertEqual(M._era({"era": ""}, {"period": "the 4th century"}), "the 4th century")
        self.assertEqual(M._era({}, {"period": "1943-1945, London"}), "1943-1945, London")
        self.assertEqual(M._era({}, {"period": "2008 financial crisis"}), "2008 financial crisis")   # no 1990 cutoff
        self.assertEqual(M._era({}, {"period": "the present day"}), "")
        self.assertEqual(M._era({}, {"period": f"{time.localtime().tm_year - 1}"}), "")
        self.assertEqual(M._era({}, {}), "")

    def test_names_and_prompt(self):
        row = {"text": "The library opened.", "entities": ["Royal Library", "1987", "the 4th century"],
               "archive": "Bibliotheca Regia Aurea"}
        self.assertEqual(M._names_of(row), ["Royal Library", "Bibliotheca Regia Aurea"])
        stand = {"name": "Father Anselm Varo", "surname": "Varo", "role": "court archivist"}
        self.assertEqual(M._names_of({"entities": ["Varo", "Royal Library"]}, stand), ["Royal Library"])
        block = M._shot_block(dict(row, about="Varo"), "b", "a", [], stand)
        self.assertIn('none (no "exact" for this shot)', block)
        self.assertIn("anonymous court archivist stands in", block)
        # the owner's non-Latin script rule, word for word, in the AI check
        self.assertIn("script in another writing system (Ge'ez, Hebrew, Greek, Arabic, Syriac,\n  cuneiform, "
                      "hieroglyphs, medieval calligraphy) on a manuscript, scroll, book page, tablet or inscription "
                      "that is the\n  subject of the picture — that reads as authentic to a viewer (owner 2026-10-10).",
                      M.AI_RULES)
        self.assertIn("warped:", M.AI_RULES)
        self.assertNotIn("warped:", M.CHECK_RULES)
        for rule in ("unless the line is plainly about the present day", "anyone else, identifiable or",
                     "as long\n  as nothing modern is prominent", "unless the line is about that very item"):
            self.assertIn(rule, M.CHECK_RULES + M.ERA_Q)
        self.assertIn('"era"', M.QUERY_RULES)
        self.assertEqual(M.BEATS_V, 6)
        self.assertNotEqual(M._qset("check"), M._qset("check", v=M.CHECK_V + 1))   # a new question set: asked again
        self.assertNotEqual(M._qset("check"), M._qset("ai"))

    def test_prompt_budget(self):
        dossier = {"topic": "t" * 200, "period": "p" * 120, "setting": "s" * 200,
                   "visualBrief": {"tone": "dark", "forbidden": ["x" * 80] * 10,
                                   "people": [{"name": "A B", "role": "r" * 60, "appearance": "a" * 120,
                                               "likenessKnown": False}] * 2,
                                   "motifs": [{"idea": "i" * 30, "web": "w" * 60}] * 12}}
        row = {"text": "x" * 300, "visualIntent": "v" * 300, "entities": ["e" * 40] * 6}
        lead = (M.CHECK_RULES + M._check_film(dossier) + M._shot_block(row, "b" * 300, "a" * 300, M._names_of(row), None)
                + M.ERA_Q.format(era="late 1980s"))
        self.assertLess(len(lead) + len(M.FORMAT), 10000)


# ── the check through pick_vision ──────────────────────────────────────────────────────────────────────────────────
class Check(Tmp):
    def cands(self, n, seed=0, prefix="pic"):
        return [({"title": f"{prefix} {k}", "provider": "bing", "url": f"https://x/{prefix}{k}"},
                 textured(self.d / "src" / f"{prefix}{k}.jpg", seed + k)) for k in range(n)]

    @mock.patch.object(M, "JUDGE_MEDIA", "MEDIUM")    # a MEDIUM look marks a text picture for the other lines (at
    def test_request_and_store(self):                 # option A's LOW it is not: test_mrtruth_e1's LOW test)
        gem = FakeGemini(lambda cap: {"shows": "exact"} if cap.endswith("0") else {"text": True} if cap.endswith("1") else {})
        e = Engine(gem)
        row = {"text": "The library opened its doors.", "entities": ["Royal Library"], "era": "1980s, Rome"}
        dossier = {"period": "1980s", "visualBrief": {"tone": "dark", "forbidden": ["modern stock"]}}
        out = M.judge(e, row, self.cands(3), dossier, "before", "after")
        self.assertEqual(len(gem.calls), 1)
        call = gem.calls[0]
        self.assertEqual((call["media"], call["thinking"], call["model"], call["purpose"]),
                         ("MEDIUM", "low", "gemini-3.8-flash", "picture check"))
        self.assertTrue(call["lead"].startswith(M.CHECK_RULES))
        self.assertIn("<film>", call["lead"])
        self.assertIn("modern (asked for this shot): the shot is set in 1980s, Rome", call["lead"])
        self.assertIn('"modern": ""', call["prompt"])
        self.assertEqual(call["labels"], ["Picture 1 - caption: pic 0", "Picture 2 - caption: pic 1", "Picture 3 - caption: pic 2"])
        from PIL import Image
        with Image.open(call["paths"][0]) as im:
            self.assertEqual(max(im.size), 640)
        self.assertEqual([c["title"] for c in out], ["pic 0", "pic 2", "pic 1"])        # by _rank
        self.assertEqual([c["tier"] for c in out], [3, 2, 2])
        self.assertEqual(out[2]["bad"], ["text"])
        # the same line again: from the store, no call; another line: the text picture is not sent again
        again = M.judge(e, row, self.cands(3), dossier, "before", "after")
        self.assertEqual(len(gem.calls), 1)
        self.assertEqual({c["looked"] for c in again}, {"stored"})
        other = M.judge(e, dict(row, text="Another line entirely."), self.cands(3), dossier, "b", "a")
        self.assertEqual(len(gem.calls[1]["paths"]), 2)
        self.assertEqual(next(c for c in other if c["title"] == "pic 1")["looked"], "dirty")
        # no era and no names: no period question, and no exact
        gem2 = FakeGemini(lambda cap: {"shows": "exact"})
        M.judge(Engine(gem2), {"text": "Time passed.", "era": "today"}, self.cands(2, 50, "q"), {"period": "1980s"})
        self.assertNotIn("modern (asked", gem2.calls[0]["lead"])
        self.assertNotIn('"modern"', gem2.calls[0]["prompt"])
        self.assertEqual({c["tier"] for c in M.judge(Engine(gem2), {"text": "Time passed again.", "era": "today"},
                                                    self.cands(2, 60, "r"), {})}, {2})

    def test_static_prefix_same_for_every_shot(self):
        gem = FakeGemini()
        e = Engine(gem)
        dossier = {"period": "1980s", "topic": "a film", "visualBrief": {"tone": "dark"}}
        M.judge(e, {"text": "Line one.", "era": "1980s"}, self.cands(1, 1, "a"), dossier)
        M.judge(e, {"text": "Line two.", "era": "1990s"}, self.cands(1, 2, "b"), dossier)
        a, b = gem.calls[0]["lead"], gem.calls[1]["lead"]
        cut = a.index("<shot>")
        self.assertEqual(a[:cut], b[:cut])

    def test_score_mode_reads_the_old_judge(self):
        def old(engine, row, cands, dossier, before="", after=""):
            return [dict(c, photo=str(p), score=7.5, flags=[], depiction="named-subject", studio=False,
                         anchor=(0.5, 0.5), reason="", subject="", person=False) for c, p in cands]
        with mock.patch.object(M, "JUDGE_MODE", "score"), mock.patch.object(M, "judge_score", old):
            out = M.judge(Engine(), {"text": "x"}, self.cands(1), {})
        self.assertEqual((out[0]["tier"], out[0]["clean"]), (3, True))

    def test_pick_vision_request_shape(self):
        import make_video as mv
        bodies = []

        class R:
            ok, status_code = True, 200

            def json(self):
                return {"candidates": [{"content": {"parts": [{"text": "[]"}]}, "finishReason": "STOP"}],
                        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 2}}
        imgs = [textured(self.d / f"i{k}.jpg", k, (200, 120)) for k in range(18)]
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "test"}), \
                mock.patch.object(mv.requests, "post", lambda url, **kw: bodies.append(kw["json"]) or R()):
            info = {}
            mv.pick_vision("FORMAT", imgs, model="gemini-3.8-flash", thinking="low", media="MEDIUM", lead="LEAD",
                           labels=[f"Picture {k + 1} - caption: c{k}" for k in range(18)], info=info)
            mv.pick_vision("old style", imgs, model="gemini-3.8-flash", thinking="low")
        parts = bodies[0]["contents"][0]["parts"]
        self.assertEqual(parts[0], {"text": "LEAD"})
        self.assertEqual(parts[1], {"text": "Picture 1 - caption: c0"})
        self.assertIn("inlineData", parts[2])
        self.assertEqual(parts[-1], {"text": "FORMAT"})
        self.assertEqual(sum(1 for x in parts if "inlineData" in x), 18)          # no 16-picture cap here
        gc = bodies[0]["generationConfig"]
        self.assertEqual((gc["mediaResolution"], gc["thinkingConfig"]), ("MEDIA_RESOLUTION_MEDIUM", {"thinkingLevel": "low"}))
        self.assertEqual(info["via"], "gemini")
        self.assertEqual(sum(1 for x in bodies[1]["contents"][0]["parts"] if "inlineData" in x), 16)   # unchanged
        self.assertNotIn("mediaResolution", bodies[1]["generationConfig"])

    def test_pick_vision_claude_fallback_says_so(self):
        import make_video as mv

        class Bad:
            ok, status_code = False, 400
        seen = []
        img = textured(self.d / "i.jpg", 1, (200, 120))
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "test"}), \
                mock.patch.object(mv.requests, "post", lambda url, **kw: Bad()), \
                mock.patch.object(mv, "claude_vision", lambda prompt, paths, max_tokens=0: seen.append(prompt) or "[]"):
            info = {}
            mv.pick_vision("FORMAT", [img], model="gemini-3.8-flash", thinking="low", lead="LEAD",
                           labels=["Picture 1 - caption: x"], info=info)
        self.assertEqual(info["via"], "claude")
        self.assertTrue(seen[0].startswith("LEAD\nImage 1: Picture 1 - caption: x\nFORMAT"))

    def test_preflight_sends_the_checks_settings(self):
        sent = []

        class Resp:
            def __init__(self, status, data):
                self.status_code, self._d, self.text = status, data, json.dumps(data)

            def json(self):
                return self._d
        post = lambda url, **kw: sent.append(kw.get("json")) or Resp(400, {"error": {"message": "thinking level not supported"}})
        env = {"GEMINI_API_KEY": "g", "BRAVE_SEARCH_API_KEY": "", "ANTHROPIC_API_KEY": "", "WAVESPEED_API_KEY": "",
               "MRTRUTH_ALLOW_DEGRADED": "0"}
        with mock.patch.dict(os.environ, env), mock.patch("requests.post", post), \
                mock.patch("requests.get", lambda *a, **k: Resp(200, {})):
            with self.assertRaises(M.OutOfCredit) as x:
                M.preflight(Engine())
        self.assertIn("refused their settings", str(x.exception))
        gc = sent[0]["generationConfig"]
        self.assertEqual(gc["thinkingConfig"], {"thinkingLevel": "low"})
        self.assertEqual(gc["mediaResolution"], "MEDIA_RESOLUTION_LOW")             # option A: pictures at LOW


class AICheck(Tmp):
    def run_ai(self, plan, draws=2, line="The archivist read alone."):
        gem = FakeGemini(plan)
        e = Engine(gem)
        k = [0]

        def draw(engine, prompt, dest, label):
            textured(dest, 100 + k[0], (1536, 864))
            k[0] += 1
        with mock.patch.object(M, "_draw_ai", draw), mock.patch.object(e, "ai_image_slot", lambda *a: None, create=True):
            pick = M._ai_picture(e, self.d / "job", {"text": line, "visualIntent": "an archivist", "era": "1980s"}, 3,
                                 {"period": "1980s"})
        return pick, gem, k[0], e

    def test_settings_and_pass(self):
        pick, gem, drawn, _ = self.run_ai(lambda cap: {"shows": "kind", "warped": False})
        self.assertTrue(pick and pick["ai"] and pick["tier"] == 2 and pick["clean"])
        call = gem.calls[0]
        self.assertEqual((call["media"], call["purpose"]), ("HIGH", "AI check"))
        self.assertTrue(call["lead"].startswith(M.AI_RULES[:40]))
        self.assertIn('"warped": false', call["prompt"])
        self.assertIn("modern (asked for this drawn picture): it stands for 1980s", call["lead"])   # strict for a drawing
        self.assertIn("even small or in the\n  background", call["lead"])
        from PIL import Image
        with Image.open(call["paths"][0]) as im:
            self.assertEqual(max(im.size), 1280)
        self.assertEqual(drawn, 1)

    def test_frame_only_is_cropped_and_asked_again(self):
        seen = []

        def plan(cap):
            seen.append(cap)
            return {"frame": len(seen) == 1, "warped": False}
        pick, gem, drawn, _ = self.run_ai(plan)
        self.assertEqual((len(gem.calls), drawn), (2, 1))
        self.assertTrue(pick and "border cropped" in pick["reason"])

    def test_warped_refused_second_drawing_loose(self):
        n = []

        def plan(cap):
            n.append(1)
            return {"warped": True} if len(n) == 1 else {"shows": "generic", "warped": False}
        pick, gem, drawn, e = self.run_ai(plan)
        self.assertEqual(drawn, 2)                                       # the second drawing: generic is enough
        self.assertTrue(pick and pick["tier"] == 1)
        self.assertTrue(any("warped" in l and "counts against the film's drawings" in l for l in e.lines))

    def test_unanswered_is_not_used_and_not_kept(self):
        pick, gem, drawn, _ = self.run_ai(lambda cap: None)
        self.assertIsNone(pick)
        self.assertEqual(drawn, 2)
        self.assertEqual(list((self.d / "job").rglob("*.check.json")), [])


# ── the whole picture step, every outside service stubbed ──────────────────────────────────────────────────────────
class Pictures(Tmp):
    def rows(self, n=4):
        return [{"text": f"Line number {i} about the old vault.", "startMs": i * 4000, "endMs": (i + 1) * 4000,
                 "queries": [f"vault door {i}", f"bank vault {i}", ""], "entities": ["Vault"] if i % 2 else [],
                 "era": "1930s", "device": None} for i in range(n)]

    def run_pictures(self, gem, rows=None, n_web=8):
        rows = rows or self.rows()
        job = self.d / "job"
        pics = {}

        def web(queries, folder, n=6, skip=()):
            i = int(queries[0].split()[-1])
            out = []
            for k in range(n_web):
                key = (i, k)
                if key not in pics:
                    pics[key] = textured(self.d / "src" / f"w{i}_{k}.jpg", 1000 * (i + 1) + k)
                out.append(({"title": f"web {i}-{k}", "url": f"https://x/{i}/{k}", "source": "web", "license": "",
                             "provider": "bing"}, pics[key]))
            return out[:n + 4]
        e = Engine(gem)
        M._search_reset(e)
        with mock.patch.object(M, "commons_photos", lambda q, f, n=4: []), mock.patch.object(M, "web_photos", web), \
                mock.patch.object(M, "archive_names", lambda *a, **k: None), \
                mock.patch.object(M, "_ai_picture", lambda *a, **k: None), \
                mock.patch.dict(os.environ, {"MRTRUTH_ARCHIVES": "0"}):
            M.pictures(e, job, rows, {"period": "1930s", "visualBrief": {"tone": "dark"}})
        return rows, e, job

    def test_lazy_tiers_steps_audit_and_store(self):
        # web k=0 is exact (on a shot that names a thing), k=1 has added text, k=2..: kind
        plan = lambda cap: ({"shows": "exact"} if cap.endswith("-0") else {"text": True} if cap.endswith("-1")
                            else {"shows": "kind"})
        gem = FakeGemini(plan)
        rows, e, job = self.run_pictures(gem)
        self.assertEqual(len(gem.calls), 4)                              # one call a shot: 2+ passed in the first 6
        self.assertEqual({len(c["paths"]) for c in gem.calls}, {6})
        steps = [r["step"] for r in rows]
        self.assertEqual(steps, ["contextual", "exact", "contextual", "exact"])   # no names: no exact
        audit = json.loads((job / "mrtruth" / "pick_audit.json").read_text())
        self.assertEqual(audit[1]["best"], "exact")
        self.assertEqual(audit[0]["best"], "kind")
        self.assertEqual(audit[1]["refused"], {"text": 1})
        self.assertEqual(audit[1]["later"], 2)                           # 8 found, 6 looked at
        self.assertTrue(all(r["pick"]["clean"] for r in rows))
        rep = json.loads((job / "mrtruth" / "verdicts.json").read_text())
        self.assertEqual(rep["checks"]["sent"], 24)
        self.assertTrue(any(l.strip().startswith("picture checks (yesno") for l in e.lines))
        # pick.json gone: everything comes from the store, no call
        for f in (job / "mrtruth" / "pictures").rglob("pick.json"):
            f.unlink()
        gem2 = FakeGemini(plan)
        rows2, e2, _ = self.run_pictures(gem2)
        self.assertEqual(len(gem2.calls), 0)
        self.assertEqual([r["pick"]["photo"] for r in rows2], [r["pick"]["photo"] for r in rows])
        # a new question set (CHECK_V) asks again
        for f in (job / "mrtruth" / "pictures").rglob("pick.json"):
            f.unlink()
        gem3 = FakeGemini(plan)
        with mock.patch.object(M, "_QSET", M._qset("check", v=M.CHECK_V + 1)):
            self.run_pictures(gem3)
        self.assertEqual(len(gem3.calls), 4)

    def test_nothing_passes_in_the_first_six_looks_further(self):
        plan = lambda cap: {"shows": "kind"} if cap.endswith("-7") else {"shows": "generic"}
        gem = FakeGemini(plan)
        rows, e, job = self.run_pictures(gem, rows=self.rows(1))
        self.assertEqual([len(c["paths"]) for c in gem.calls], [6, 2])
        self.assertEqual(rows[0]["pick"]["title"], "web 0-7")

    def test_claude_answers_used_but_asked_again(self):
        gem = FakeGemini(lambda cap: {"shows": "kind"}, via="claude")
        rows, e, job = self.run_pictures(gem, rows=self.rows(1))
        self.assertTrue(rows[0]["pick"])
        st = json.loads(next((job / "mrtruth" / "pictures").rglob("pick.json")).read_text())
        self.assertFalse(st["complete"])
        self.assertEqual(M.VERDICTS["store"].stats()["answers"], 0)

    def test_naming_template_over_kind_and_check(self):
        rows = [{"text": "x", "startMs": 0, "endMs": 4000, "device": {"id": "corner-label", "headline": "Vault"},
                 "pick": {"photo": "/a.jpg", "tier": 2, "clean": True, "person": False}, "step": "contextual"},
                {"text": "y", "startMs": 4000, "endMs": 8000, "device": {"id": "corner-label", "headline": "Vault"},
                 "pick": {"photo": "/b.jpg", "tier": 2, "clean": True, "person": True}, "step": "contextual"}]
        M.DEV_DROPS.clear()
        with mock.patch.object(M, "_type_shade", lambda *a: 0.0):
            M._fit_devices(rows)
        self.assertEqual(rows[0]["device"]["id"], "corner-label")       # kind carries the label (owner 2026-10-08)
        self.assertTrue(any(i == 1 and "different person" in why for i, _t, why in M.DEV_DROPS))


if __name__ == "__main__":
    unittest.main()
