"""Mr Truth: the cost switches of the picture checks on 3.8 (impl-q, 2026-10-11; owner: "keep costs at 2 usd per 20
minute video" with the same image judgment) - each off unless set:
  MRTRUTH_JUDGE_CACHE   the fixed head (rules + <film> block) first and the same in every call, kept in a Gemini cache
  MRTRUTH_JUDGE_TERSE   short keys and letter codes, read back into the very same answers
  MRTRUTH_JUDGE_LEAN    no further batch once a usable exact picture is found
  MRTRUTH_JUDGE_TIER / MRTRUTH_AI_CHECK_TIER / MRTRUTH_JUDGE_FLEX_WAIT   the Flex tier, its retries, time budget and
                        fallback to the standard tier (make_video.pick_vision)
  MRTRUTH_JUDGE_MODEL=gemini-3-flash-preview   priced, thinking low, with Flex and the cache
No network, no paid call.

    .venv/bin/python -m unittest tests.test_mrtruth_cheap -v
"""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_video as MV  # noqa: E402
import mrtruth as M  # noqa: E402
import test_mrtruth_a2 as A2  # noqa: E402
from test_mrtruth_a2 import Engine, FakeGemini, Tmp, textured  # noqa: E402

DOSSIER = {"topic": "t", "period": "4th century", "setting": "Rome",
           "visualBrief": {"tone": "dark", "motifs": [{"idea": "memory", "web": "scholar reading codex"}]}}
ROW_A = {"text": "The scribe copied the codex.", "entities": ["Codex Example"], "era": "4th century"}
ROW_B = {"text": "Monks guarded the library.", "entities": [], "era": "4th century"}


class Fake2(FakeGemini):
    """FakeGemini that also takes (and records) the cost switches' arguments."""

    def __call__(self, prompt, paths, tier="", cache=None, tier_wait=None, **kw):
        out = super().__call__(prompt, paths, **kw)
        self.calls[-1].update(tier=tier, cache=cache, tier_wait=tier_wait)
        return out


class CacheEngine(Engine):
    def __init__(self, gem=None, give=True):
        super().__init__(gem or Fake2())
        self.made, self.dropped, self.give = [], [], give

    def gemini_cache(self, model, text, ttl):
        self.made.append((model, text, ttl))
        return f"cachedContents/c{len(self.made)}" if self.give else ""

    def gemini_cache_drop(self, name):
        self.dropped.append(name)


# ── (a) the order of a request, and the cache ──────────────────────────────────────────────────────────────────────
class Order(Tmp):
    def setUp(self):
        super().setUp()
        M.CACHES.clear()

    def pics(self, tag, n=2):
        return [({"title": f"{tag}{k}"}, textured(self.d / "pics" / f"{tag}{k}.jpg", 100 + k + 10 * len(tag)))
                for k in range(n)]

    def test_the_fixed_text_first_then_film_line_pictures_question(self):
        gem = Fake2()
        e = Engine(gem)
        M.judge(e, ROW_A, self.pics("a"), DOSSIER)
        M.judge(e, ROW_B, self.pics("b"), DOSSIER)
        head = M.CHECK_RULES + "\n" + M._check_film(DOSSIER)
        for call, row in zip(gem.calls, (ROW_A, ROW_B)):
            self.assertTrue(call["lead"].startswith(head + "\n\n<shot>"))   # the rules, then the film: every call
            rest = call["lead"][len(head):]
            self.assertIn(row["text"], rest)                                   # then the line
            self.assertNotIn(row["text"], head)
            self.assertEqual(call["prompt"], M.FORMAT.format(extra='"modern": "", '))   # the short question last
            self.assertIsNone(call["cache"])                                  # off unless set
        self.assertGreater(len(head), 0.7 * len(gem.calls[0]["lead"]))       # most of the text is the shared head

    def test_cache_names_the_head_and_sends_the_rest(self):
        plain = Fake2()
        with mock.patch.object(M, "JUDGE_CACHE", False):                     # the whole lead sent, for comparison
            M.judge(Engine(plain), ROW_A, self.pics("a"), DOSSIER)
        M.VERDICTS.update(store=None, film="film-2")                          # a fresh store: asked again
        os.environ["MRTRUTH_VERDICTS_DB"] = str(self.d / "store2" / "v.sqlite")
        gem = Fake2(lambda cap: {"warped": False})                             # the drawing's answer complete too
        e = CacheEngine(gem)
        with mock.patch.object(M, "JUDGE_CACHE", True):
            M.judge(e, ROW_A, self.pics("a"), DOSSIER)
            M.judge(e, ROW_B, self.pics("b"), DOSSIER)
            ok, why, v = M._ai_ok(e, textured(self.d / "ai.jpg", 7), ROW_B, DOSSIER)
        head = M.CHECK_RULES + "\n" + M._check_film(DOSSIER)
        ai_head = M.AI_RULES + "\n" + M._check_film(DOSSIER)
        self.assertEqual([(m, t) for m, t, _ in e.made], [(M.JUDGE_MODEL, head), (M.AI_CHECK_MODEL, ai_head)])
        self.assertEqual([c["cache"] for c in gem.calls], [("cachedContents/c1", head)] * 2 + [("cachedContents/c2", ai_head)])
        self.assertEqual(head + gem.calls[0]["lead"], plain.calls[0]["lead"])  # the very same words, the head named
        self.assertTrue(gem.calls[1]["lead"].startswith("\n\n<shot>"))
        self.assertEqual(gem.calls[0]["prompt"], plain.calls[0]["prompt"])
        M._drop_caches(e)
        self.assertEqual(e.dropped, ["cachedContents/c1", "cachedContents/c2"])
        self.assertEqual(M.CACHES, {})

    def test_a_cache_gemini_will_not_keep_sends_the_whole_lead(self):
        gem = Fake2()
        e = CacheEngine(gem, give=False)
        with mock.patch.object(M, "JUDGE_CACHE", True):
            M.judge(e, ROW_A, self.pics("a"), DOSSIER)
            M.judge(e, ROW_B, self.pics("b"), DOSSIER)
        self.assertEqual(len(e.made), 1)                                       # not tried again until its time is up
        self.assertTrue(all(c["cache"] is None for c in gem.calls))
        self.assertTrue(gem.calls[0]["lead"].startswith(M.CHECK_RULES))
        self.assertTrue(any("not kept by Gemini" in line for line in e.lines))


class Ok200:
    ok, status_code = True, 200

    def __init__(self, usage=None, text="[]"):
        self.usage, self.text = usage or {"promptTokenCount": 1000, "candidatesTokenCount": 100}, text

    def json(self):
        return {"candidates": [{"content": {"parts": [{"text": self.text}]}, "finishReason": "STOP"}],
                "usageMetadata": self.usage}


class Err:
    ok = False

    def __init__(self, status):
        self.status_code, self.text = status, ""

    def json(self):
        return {"error": {"message": f"status {self.status_code}"}}


class FakeTime:
    def __init__(self):
        self.t, self.slept = 1000.0, []

    def time(self):
        return self.t

    def sleep(self, s):
        self.slept.append(s)
        self.t += s


class PickVision(Tmp):
    """make_video.pick_vision's request with the switches, against a scripted Gemini (requests.post)."""

    def setUp(self):
        super().setUp()
        self.saved = json.loads(json.dumps({k: v for k, v in MV.GEMINI_PICKS.items()}))
        MV.GEMINI_PICKS.clear()
        MV.GEMINI_PICKS.update(calls=0, **{"in": 0}, out=0, think=0, fallback=0, by={})
        MV._FLEX_STATE.update(run=0, rest_until=0.0)
        self.img = textured(self.d / "i.jpg", 1, (200, 120))
        self.sent, self.script = [], []

    def tearDown(self):
        MV.GEMINI_PICKS.clear()
        MV.GEMINI_PICKS.update(self.saved)
        MV._FLEX_STATE.update(run=0, rest_until=0.0)
        super().tearDown()

    def post(self, url, **kw):
        self.sent.append(dict(kw, json=json.loads(json.dumps(kw["json"]))))   # as sent: pick_vision edits its body
        return self.script.pop(0)

    def ask(self, clock=None, **kw):
        info = {}
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "test"}), mock.patch.object(MV.requests, "post", self.post), \
                mock.patch.object(MV, "time", clock or FakeTime()), \
                mock.patch.object(MV, "claude_vision", lambda *a, **k: "claude"):
            out = MV.pick_vision("FORMAT", [self.img], model="gemini-3.8-flash", thinking="low", media="MEDIUM",
                                 lead=kw.pop("lead", "LEAD"), labels=["Picture 1 - caption: x"], info=info,
                                 purpose="picture check", **kw)
        return out, info

    def test_the_cached_head_is_named_and_the_rest_sent_in_order(self):
        self.script = [Ok200({"promptTokenCount": 2000, "candidatesTokenCount": 100, "cachedContentTokenCount": 1425})]
        _, info = self.ask(cache=("cachedContents/x", "HEAD "), lead="\n\n<shot>REST")
        body = self.sent[0]["json"]
        self.assertEqual(body["cachedContent"], "cachedContents/x")
        parts = body["contents"][0]["parts"]
        self.assertEqual([p.get("text") for p in parts], ["\n\n<shot>REST", "Picture 1 - caption: x", None, "FORMAT"])
        self.assertEqual(info["cached"], 1425)
        b = MV.GEMINI_PICKS["by"]["picture check | gemini-3.8-flash"]
        self.assertAlmostEqual(b["usd"], ((2000 - 1425) * 0.75 + 1425 * 0.075 + 100 * 3.75) / 1e6)
        self.assertEqual(b["cached"], 1425)

    def test_a_lost_cache_sends_the_head_in_front(self):
        self.script = [Err(404), Ok200()]
        out, info = self.ask(cache=("cachedContents/gone", "HEAD "), lead="REST")
        self.assertEqual(out, "[]")
        self.assertNotIn("cachedContent", self.sent[1]["json"])
        self.assertEqual(self.sent[1]["json"]["contents"][0]["parts"][0], {"text": "HEAD REST"})
        self.assertEqual(MV.GEMINI_PICKS["cache_lost"], 1)

    def test_flex_answer_at_half_price(self):
        self.script = [Ok200({"promptTokenCount": 1000, "candidatesTokenCount": 100, "serviceTier": "flex"})]
        _, info = self.ask(tier="flex")
        self.assertEqual(self.sent[0]["json"]["serviceTier"], "flex")
        self.assertEqual(self.sent[0]["timeout"], MV.GEMINI_FLEX_WAIT)          # the budget: under the 900-s cap
        self.assertEqual(info["tier"], "flex")
        b = MV.GEMINI_PICKS["by"]["picture check | gemini-3.8-flash"]
        self.assertEqual(b["flex"], 1)
        self.assertAlmostEqual(b["usd"], (1000 * 0.375 + 100 * 1.875) / 1e6)

    def test_flex_busy_is_retried_with_backoff_then_answers(self):
        clock = FakeTime()
        self.script = [Err(503), Err(429), Ok200({"promptTokenCount": 10, "candidatesTokenCount": 1, "serviceTier": "flex"})]
        _, info = self.ask(clock=clock, tier="flex", tier_wait=300)
        self.assertEqual([s["json"].get("serviceTier") for s in self.sent], ["flex"] * 3)
        self.assertEqual(clock.slept, [5, 10])
        self.assertEqual([s["timeout"] for s in self.sent], [300, 295, 285])   # what is left of the budget
        self.assertEqual((MV.GEMINI_PICKS["flex_retries"], MV.GEMINI_PICKS.get("flex_fallback", 0)), (2, 0))
        self.assertEqual(info["tier"], "flex")

    def test_flex_budget_spent_goes_to_the_standard_tier_counted(self):
        clock = FakeTime()
        self.script = [Err(503), Err(503), Err(503), Ok200({"promptTokenCount": 1000, "candidatesTokenCount": 100,
                                                            "serviceTier": "standard"})]
        _, info = self.ask(clock=clock, tier="flex", tier_wait=30)
        self.assertEqual([s["json"].get("serviceTier") for s in self.sent], ["flex", "flex", "flex", None])
        self.assertEqual(self.sent[-1]["timeout"], 180)
        self.assertEqual(clock.slept, [5, 10])                                # 15 s, and 20 more would pass 30
        self.assertEqual(MV.GEMINI_PICKS["flex_fallback"], 1)
        self.assertEqual(MV.GEMINI_PICKS["flex_why"], {"HTTP 503 after 15s": 1})
        self.assertEqual(info["tier"], "standard")
        b = MV.GEMINI_PICKS["by"]["picture check | gemini-3.8-flash"]
        self.assertAlmostEqual(b["usd"], (1000 * 0.75 + 100 * 3.75) / 1e6)   # billed at the standard price
        self.assertEqual(b["flex"], 0)
        self.assertIn("1 fell back to the standard tier (1x HTTP 503 after 15s)", MV.flex_line())

    def test_a_refused_tier_goes_to_the_standard_tier_at_once(self):
        self.script = [Err(400), Ok200()]
        self.ask(tier="flex")
        self.assertEqual([s["json"].get("serviceTier") for s in self.sent], ["flex", None])
        self.assertEqual(MV.GEMINI_PICKS["flex_why"], {"HTTP 400": 1})

    def test_out_of_credit_on_flex_is_not_asked_again(self):
        self.script = [Err(402)]
        out, info = self.ask(tier="flex")
        self.assertEqual((len(self.sent), out, info["via"]), (1, "claude", "claude"))
        self.assertEqual(MV.GEMINI_PICKS["why"], {"HTTP 402": 1})            # the guard stops the film on this

    def test_a_run_of_fallbacks_rests_flex(self):
        clock = FakeTime()
        for _ in range(MV.GEMINI_FLEX_BREAK):
            self.script = [Err(503), Ok200()]
            self.ask(clock=clock, tier="flex", tier_wait=0)
        self.assertEqual(MV.GEMINI_PICKS["flex_fallback"], MV.GEMINI_FLEX_BREAK)
        self.sent.clear()
        self.script = [Ok200()]
        self.ask(clock=clock, tier="flex")
        self.assertNotIn("serviceTier", self.sent[0]["json"])                # resting: straight to the standard tier
        self.assertEqual((MV.GEMINI_PICKS["flex_rested"], MV.GEMINI_PICKS["flex_rests"]), (1, 1))
        clock.t += MV.GEMINI_FLEX_REST
        self.script = [Ok200({"promptTokenCount": 1, "candidatesTokenCount": 1, "serviceTier": "flex"})]
        self.ask(clock=clock, tier="flex")
        self.assertEqual(self.sent[-1]["json"]["serviceTier"], "flex")       # tried again after the rest

    def test_no_tier_no_field(self):
        self.script = [Ok200()]
        self.ask()
        self.assertNotIn("serviceTier", self.sent[0]["json"])
        self.assertNotIn("cachedContent", self.sent[0]["json"])
        self.assertEqual(self.sent[0]["timeout"], 180)
        self.assertEqual(MV.flex_line(), "")


class Prices(unittest.TestCase):
    def test_tiers_and_cached_tokens(self):
        c = MV.gemini_cost
        self.assertAlmostEqual(c("gemini-3.8-flash", 1_000_000, 0), 0.75)
        self.assertAlmostEqual(c("gemini-3.8-flash", 1_000_000, 0, cached=1_000_000), 0.075)
        self.assertAlmostEqual(c("gemini-3.8-flash", 1_000_000, 1_000_000, flex=True), 0.375 + 1.875)
        self.assertAlmostEqual(c("gemini-3.8-flash", 1_000_000, 0, cached=1_000_000, flex=True), 0.0375)
        self.assertAlmostEqual(c("gemini-3-flash-preview", 1_000_000, 1_000_000), 0.50 + 3.00)
        self.assertAlmostEqual(c("gemini-3-flash-preview", 2_000_000, 0, cached=1_000_000, flex=True), 0.25 + 0.05)
        self.assertAlmostEqual(c("gemini-3.5-flash-lite", 1_000_000, 0, cached=1_000_000, flex=True), 0.02)
        self.assertAlmostEqual(c("gemini-3.8-flash", 0, 0, think=1_000_000), 3.75)    # thinking billed as output
        self.assertIsNone(c("gemini-9", 1, 1))


# ── (b) the terse answer format ────────────────────────────────────────────────────────────────────────────────────
SHORT = {v: k for k, v in M._TERSE_KEYS.items()}
LETTER = {v: k for k, v in M._TERSE_SHOWS.items()}


def terse(x):
    """An answer in FORMAT's keys as a model following FORMAT_TERSE would give it."""
    out = {}
    for k, v in x.items():
        if k == "shows":
            v = LETTER.get(v, v)
        elif isinstance(v, bool):
            v = int(v)
        out[SHORT.get(k, k)] = v
    return out


PLAIN = [
    {"n": 1, "real": True, "text": False, "frame": False, "banned": False, "modern": "", "shows": "kind",
     "person": True, "studio": False, "subject": "monk copying codex", "x": 0.4, "y": 0.35},
    {"n": 2, "real": True, "text": False, "frame": False, "banned": False, "modern": "", "shows": "exact",
     "person": False, "studio": True, "subject": "codex example folio", "x": 0.5, "y": 0.5},
    {"n": 3, "real": True, "text": True, "frame": False, "banned": False, "modern": "", "shows": "generic",
     "person": False, "studio": False},
    {"n": 4, "real": False, "text": False, "frame": False, "banned": True, "modern": "a laptop", "shows": "no",
     "person": False, "studio": False},
    {"n": 5, "real": True, "text": False, "frame": True, "banned": False, "modern": "", "person": False,
     "studio": False},                                                         # a refusal without shows
    {"n": 6, "real": True, "text": False, "frame": False, "banned": False, "modern": "", "person": False,
     "studio": False},                                                         # nothing said: no answer
]


class Terse(unittest.TestCase):
    def test_round_trip_to_the_same_answers_and_verdicts(self):
        plain = M._answers(json.dumps(PLAIN), 6, era=True)
        short = M._answers(json.dumps([terse(x) for x in PLAIN]), 6, era=True)
        compact = M._answers(json.dumps([terse(x) for x in PLAIN], separators=(",", ":")), 6, era=True)
        self.assertEqual(sorted(plain), [0, 1, 2, 3, 4])
        self.assertEqual(short, plain)
        self.assertEqual(compact, plain)
        for k in plain:
            for exact_ok in (True, False):
                self.assertEqual(M._verdict({"title": "t"}, short[k], exact_ok=exact_ok),
                                 M._verdict({"title": "t"}, plain[k], exact_ok=exact_ok))
        ai = {"n": 1, "real": True, "text": False, "frame": False, "banned": False, "warped": True, "shows": "kind",
              "person": True, "studio": False}
        self.assertEqual(M._answers(json.dumps([terse(ai)]), 1, era=False, ai=True),
                         M._answers(json.dumps([ai]), 1, era=False, ai=True))
        # "m":0 is nothing modern; a fenced, spaced reply reads the same
        self.assertEqual(M._answers('[{"n":1,"r":1,"t":0,"f":0,"b":0,"m":0,"s":"k","p":0,"o":0}]', 1, era=True)[0]["modern"], "")
        fenced = "```json\n" + json.dumps([terse(x) for x in PLAIN], indent=2) + "\n```"
        self.assertEqual(M._answers(fenced, 6, era=True), plain)

    def test_the_format_and_its_example(self):
        for era, ai in ((False, False), (True, False), (True, True), (False, True)):
            f = M._format(era, ai, terse=True)
            ex = json.loads(f.split("\n")[1])[0]
            plain_ex = json.loads(M._format(era, ai, terse=False).split("\n")[1].replace('"..."', '""'))[0]
            self.assertEqual(set(M._long_keys(ex)), set(plain_ex), (era, ai))
            self.assertNotIn(" ", f.split("\n")[1])                          # the example on one line, no spaces
            self.assertEqual(("m modern" in f, "w warped" in f), (era, ai))
        self.assertEqual(M._format(True, terse=False), M.FORMAT.format(extra='"modern": "", '))

    def test_own_question_set_reading_the_plain_answers(self):
        self.assertNotEqual(M._qset("check", terse=True), M._qset("check", terse=False))
        self.assertNotEqual(M._qset("ai", terse=True), M._qset("ai", terse=False))
        self.assertEqual(M._qset("check", terse=False), "09ba59cf9af8")


class TerseInJudge(Tmp):
    def test_terse_reads_the_plain_store_then_asks_in_short_keys(self):
        p1 = textured(self.d / "p1.jpg", 1)
        p2 = textured(self.d / "p2.jpg", 2)
        plain = Fake2(lambda cap: {"shows": "kind"})
        M.judge(Engine(plain), ROW_B, [({"title": "one"}, p1)], DOSSIER)       # the plain format stores its answer
        self.assertEqual(len(plain.calls), 1)

        def short(prompt, paths, labels=None, **kw):                           # Gemini answering in FORMAT_TERSE
            calls.append({"prompt": prompt, "n": len(paths)})
            if kw.get("info") is not None:
                kw["info"].update(via="gemini")
            return json.dumps([{"n": i + 1, "r": 1, "t": 0, "f": 0, "b": 0, "m": "", "s": "e", "p": 0, "o": 0,
                                "j": "x"} for i in range(len(paths))], separators=(",", ":"))
        calls = []
        tq = M._qset("check", terse=True)
        with mock.patch.object(M, "JUDGE_TERSE", True), mock.patch.object(M, "_QSET", tq):
            out = M.judge(Engine(short), ROW_B, [({"title": "one"}, p1), ({"title": "two"}, p2)], DOSSIER)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["n"], 1)                                     # "one" came from the plain store
        self.assertTrue(calls[0]["prompt"].startswith("Return ONLY a compact JSON array on one line"))
        by = {c["title"]: c for c in out}
        self.assertEqual((by["one"]["looked"], by["one"]["shows"]), ("stored", "kind"))
        self.assertEqual((by["two"]["looked"], by["two"]["shows"]), ("asked", "kind"))   # no names: exact read as kind
        st = M.VERDICTS["store"]
        self.assertEqual(sorted(r[0] for r in st.db.execute("SELECT qset FROM v").fetchall()), sorted([M._QSET, tq]))
        # the plain format never reads the terse set
        again = Fake2(lambda cap: {"shows": "generic"})
        M.judge(Engine(again), ROW_B, [({"title": "two"}, p2)], DOSSIER)
        self.assertEqual(len(again.calls), 1)


# ── (d) lean: no further batch after a usable exact ───────────────────────────────────────────────────────────────
class Lean(Tmp):
    rows = A2.Pictures.rows
    run_pictures = A2.Pictures.run_pictures
    # web k=0 exact (exact only on a line that names something: the odd rows), k=1..5 refused, k=6..7 kind
    plan = staticmethod(lambda cap: {"shows": "exact"} if cap.endswith("-0") else {"shows": "kind"}
                        if cap.endswith(("-6", "-7")) else {"shows": "no"})

    def test_without_lean_a_second_batch_after_one_usable(self):
        gem = FakeGemini(self.plan)
        rows, e, job = self.run_pictures(gem)
        self.assertEqual([len(c["paths"]) for c in gem.calls].count(6), 4)
        self.assertEqual(len(gem.calls), 8)                                    # one usable in 6: two more looked at
        self.assertEqual([r["step"] for r in rows], ["contextual", "exact", "contextual", "exact"])

    def test_lean_stops_at_a_usable_exact(self):
        gem = FakeGemini(self.plan)
        with mock.patch.object(M, "JUDGE_LEAN", True):
            rows, e, job = self.run_pictures(gem)
        self.assertEqual(len(gem.calls), 6)                                    # the named lines stop after 6
        self.assertEqual([r["step"] for r in rows], ["contextual", "exact", "contextual", "exact"])
        self.assertEqual([r["pick"]["title"] for r in rows if r["step"] == "exact"], ["web 1-0", "web 3-0"])
        audit = json.loads((job / "mrtruth" / "pick_audit.json").read_text())
        self.assertEqual([a["later"] for a in audit], [0, 2, 0, 2])


# ── the switches from the environment (a fresh interpreter: they are read at import) ───────────────────────────────
class Switches(unittest.TestCase):
    def run_with(self, **env):
        code = r'''
import json, os, sys, tempfile
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[2])
import mrtruth as M, make_video as MV
from test_mrtruth_a2 import textured
from test_mrtruth_cheap import Fake2, CacheEngine
d = tempfile.mkdtemp()
os.environ["MRTRUTH_VERDICTS_DB"] = d + "/v.sqlite"
M.VERDICTS.update(store=None, film="f")
gem = Fake2(lambda cap: {"warped": False})
e = CacheEngine(gem)
row = {"text": "The priest read.", "era": "1980s"}
M.judge(e, row, [({"title": "a"}, textured(d + "/a.jpg", 1))], {})
M._ai_ok(e, textured(d + "/ai.jpg", 2), row, {})
print(json.dumps({"calls": [[c[k] for k in ("purpose", "model", "thinking", "media", "tier", "tier_wait")]
                            + [bool(c["cache"])] for c in gem.calls],
                  "made": [m for m, _, _ in e.made], "qsets": [M._QSET, M._AI_QSET], "switches": M._switches(),
                  "priced": MV.gemini_cost(M.JUDGE_MODEL, 1000, 100) is not None,
                  "terse": gem.calls[0]["prompt"].startswith("Return ONLY a compact")}))
'''
        e = dict(os.environ, MRTRUTH_VERDICTS="on", MRTRUTH_JUDGE="yesno")
        for k in [k for k in e if k.startswith(("MRTRUTH_JUDGE_", "MRTRUTH_AI_CHECK_"))]:
            e.pop(k)
        e.update(env)
        r = subprocess.run([sys.executable, "-c", code, str(HERE), str(Path(__file__).resolve().parent)],
                           capture_output=True, text=True, env=e, timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        return json.loads(r.stdout.strip().splitlines()[-1])

    def test_option_a_by_default(self):
        """Option A (owner 2026-10-12): the cache on, candidates at LOW, the AI checks at HIGH, plain answers, the
        standard tier, the last render's question sets."""
        got = self.run_with()
        self.assertEqual(got["calls"], [["picture check", "gemini-3.8-flash", "low", "LOW", "", None, True],
                                        ["AI check", "gemini-3.8-flash", "low", "HIGH", "", None, True]])
        self.assertEqual((got["made"], got["terse"]), (["gemini-3.8-flash", "gemini-3.8-flash"], False))
        self.assertEqual(got["qsets"], ["09ba59cf9af8", "6e48a6a6e3c7"])

    def test_the_earlier_setup_comes_back(self):
        got = self.run_with(MRTRUTH_JUDGE_CACHE="0", MRTRUTH_JUDGE_MEDIA="MEDIUM")
        self.assertEqual(got["calls"], [["picture check", "gemini-3.8-flash", "low", "MEDIUM", "", None, False],
                                        ["AI check", "gemini-3.8-flash", "low", "HIGH", "", None, False]])
        self.assertEqual((got["made"], got["switches"], got["terse"]), ([], {}, False))
        self.assertEqual(got["qsets"], ["09ba59cf9af8", "6e48a6a6e3c7"])

    def test_3_flash_preview_on_flex_with_the_cache(self):
        got = self.run_with(MRTRUTH_JUDGE_MODEL="gemini-3-flash-preview", MRTRUTH_JUDGE_TIER="flex",
                            MRTRUTH_JUDGE_CACHE="1", MRTRUTH_JUDGE_FLEX_WAIT="120", MRTRUTH_JUDGE_TERSE="on")
        self.assertEqual(got["calls"], [["picture check", "gemini-3-flash-preview", "low", "LOW", "flex", 120.0, True],
                                        ["AI check", "gemini-3.8-flash", "low", "HIGH", "flex", 120.0, True]])
        self.assertEqual(got["made"], ["gemini-3-flash-preview", "gemini-3.8-flash"])
        self.assertTrue(got["priced"] and got["terse"])
        self.assertNotEqual(got["qsets"][0], "09ba59cf9af8")                  # another model: its own answers
        self.assertEqual(got["switches"], {"cache": True, "terse": True, "tier": "flex", "ai_tier": "flex", "media": "LOW",
                                           "flex_wait": 120.0, "model": "gemini-3-flash-preview"})

    def test_the_ai_check_tier_knob(self):
        got = self.run_with(MRTRUTH_JUDGE_TIER="flex", MRTRUTH_AI_CHECK_TIER="standard")
        self.assertEqual([c[4] for c in got["calls"]], ["flex", ""])
        got = self.run_with(MRTRUTH_AI_CHECK_TIER="flex")
        self.assertEqual([c[4] for c in got["calls"]], ["", "flex"])
        self.assertEqual(got["qsets"], ["09ba59cf9af8", "6e48a6a6e3c7"])     # a tier is not a question


class Preflight(unittest.TestCase):
    def test_flex_is_pinged_and_only_warned_about(self):
        sent = []

        class Resp:
            def __init__(self, status):
                self.status_code, self.ok, self.text = status, status == 200, ""

            def json(self):
                return {"error": {"message": "This model is currently experiencing high demand."}}

        def post(url, **kw):
            sent.append((url, kw.get("json") or {}, kw.get("timeout")))
            return Resp(503 if (kw.get("json") or {}).get("serviceTier") == "flex" else 200)
        env = {"GEMINI_API_KEY": "g", "BRAVE_SEARCH_API_KEY": "b", "ANTHROPIC_API_KEY": "", "WAVESPEED_API_KEY": "",
               "MRTRUTH_ALLOW_DEGRADED": "0"}
        e = Engine()
        with mock.patch.dict(os.environ, env), mock.patch("requests.post", post), \
                mock.patch("requests.get", lambda *a, **k: Resp(200)), \
                mock.patch.object(M, "JUDGE_TIER", "flex"), mock.patch.object(M, "AI_CHECK_TIER", "flex"):
            try:
                M.preflight(e)
            except M.OutOfCredit as x:                                       # other services may stop it: not Gemini
                self.assertNotIn("Gemini", str(x))
        gem = [(j.get("serviceTier"), t) for u, j, t in sent if "generativelanguage" in u]
        self.assertEqual(gem, [(None, 30), ("flex", 90), (None, 30), ("flex", 90)])
        self.assertTrue(any("flex tier" in line and "standard tier, at the standard price" in line for line in e.lines))


if __name__ == "__main__":
    unittest.main()
