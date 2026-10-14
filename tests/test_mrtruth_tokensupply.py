"""Mr Truth: Claude Sonnet through Token Supply, the planner option on test (owner 2026-10-14) - synthetic data only,
every HTTP request faked (requests.post), no paid or real network call, no key but made-up strings:
  - the engine: Token Supply's endpoint and headers; its request is Anthropic's plus a system text of ours (thinking
    off, the head a cached block), and Anthropic's own request is byte for byte what it was; a streamed answer is read
    as UTF-8 (Token Supply names no charset); its usage is counted under "<model> (Token Supply)" at its own prices,
    Anthropic's as before; the two spend lines; what it cannot answer goes to Anthropic (its retries run out; a refused
    key or an empty wallet switches it off for the run, and so do three such calls), and Anthropic failing after it
    ends the run as today's planner does
  - claude_on: a thread's pin to Anthropic is today's planner path exactly; other threads; nesting; claude_caches
  - the planner: an answer with long prose around its JSON is asked again, two bad ones go to Anthropic, a fenced one is
    fine, none of it on the default planner; the highlighted page goes to Anthropic with the same request and key; the
    visual plan's reach (the measured 0.34 tail asked again, Sonnet's 0.02-0.15 not); the chapters' pre-check (two of
    three on title shots, as measured); the chapter fill-in's spacing on every planner (425 s and 436 s); the planner's
    line and its record in timing.json

    .venv/bin/python -m unittest tests.test_mrtruth_tokensupply -v
"""
import contextlib
import copy
import inspect
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

import requests
from requests.structures import CaseInsensitiveDict

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_video as MV  # noqa: E402
import mrtruth as M  # noqa: E402
import test_mrtruth_gate as G  # noqa: E402
import test_mrtruth_hl as H  # noqa: E402

TS_URL = "https://api.token-supply.com/v1/messages"
AN_URL = "https://api.anthropic.com/v1/messages"
TS_KEY, AN_KEY = "ts-made-up-for-tests", "an-made-up-for-tests"          # never a real key
SONNET = "claude-sonnet-5"


# ── fake HTTP: real requests.Response objects, so decoding happens as it does on a machine ───────────────────────────
def response(status=200, body=b"", ctype="text/event-stream", raw=None):
    """A requests.Response as requests builds one: its encoding from the Content-Type (Latin-1 for a text/* type
    that names no charset, as Token Supply's)."""
    r = requests.models.Response()
    r.status_code = status
    r.headers = CaseInsensitiveDict({"Content-Type": ctype})
    r.encoding = requests.utils.get_encoding_from_headers(r.headers)
    r.raw = raw if raw is not None else io.BytesIO(body)
    return r


def sse(ev):
    return f"event: {ev['type']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n".encode("utf-8")


def events(text, usage=None, out=300, stop="end_turn", model=SONNET):
    u = dict(usage or {"input_tokens": 100})
    return [sse({"type": "message_start", "message": {"model": model, "usage": u}}),
            sse({"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}),
            sse({"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}}),
            sse({"type": "content_block_stop", "index": 0}),
            sse({"type": "message_delta", "delta": {"stop_reason": stop}, "usage": {"output_tokens": out}}),
            sse({"type": "message_stop"})]


def ok(text, **kw):
    """A streamed answer, made fresh for each request (`text` may be a function of the request's payload)."""
    return lambda payload: response(200, b"".join(events(text(payload) if callable(text) else text, **kw)))


def err(status, body='{"type": "error", "error": {"type": "api_error", "message": "Internal server error"}}'):
    return lambda payload: response(status, body.encode(), ctype="application/json")


def broken():
    """A stream that begins and then breaks off, as Token Supply's did now and then (ChunkedEncodingError)."""
    class Raw:
        def __init__(self):
            self.left = b"".join(events('{"part')[:3])

        def read(self, n=-1):
            if not self.left:
                raise requests.exceptions.ChunkedEncodingError("Connection broken: IncompleteRead")
            got, self.left = self.left[:n], self.left[n:]
            return got
    return lambda payload: response(200, raw=Raw())


class Net:
    """requests.post for both APIs: answers queued per URL (the last one repeats); every request kept as sent."""

    def __init__(self, ts=(), anthropic=()):
        self.answers = {TS_URL: list(ts), AN_URL: list(anthropic)}
        self.sent = []

    def post(self, url, headers=None, json=None, **kw):
        self.sent.append({"url": url, "headers": dict(headers or {}), "payload": copy.deepcopy(json), "kw": kw})
        q = self.answers.get(url)
        if not q:
            raise AssertionError(f"a request nobody expected: {url}")
        return (q.pop(0) if len(q) > 1 else q[0])(json)

    def to(self, url):
        return [s for s in self.sent if s["url"] == url]


class Clock:
    """make_video's time: sleeping moves it on, so a retry window runs out at once."""

    def __init__(self):
        self.now = 1000.0

    def time(self):
        return self.now

    def sleep(self, s):
        self.now += s


class Engine(unittest.TestCase):
    """make_video on Token Supply's planner (CLAUDE_PROVIDER=tokensupply, CLAUDE_FALLBACK=anthropic, as the website's
    planning machine gets it), with made-up keys, an empty bill, Token Supply on and nothing pinned; all put back."""
    provider = "tokensupply"

    def setUp(self):
        self.lines, self.clock = [], Clock()
        self.spend = {"in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "usd": 0.0, "calls": 0, "models": {}}
        self.stats = {"calls": 0, "fell_back": 0, "off": "", "why": [], "handed": 0}
        self.dead = set()
        for p in (mock.patch.object(MV, "CLAUDE_SPEND", self.spend), mock.patch.object(MV, "TOKENSUPPLY_STATS", self.stats),
                  mock.patch.object(MV, "log", self.lines.append), mock.patch.object(MV, "time", self.clock),
                  mock.patch.object(MV, "CLAUDE_PROVIDER", self.provider), mock.patch.object(MV, "CLAUDE_FALLBACK", "anthropic"),
                  mock.patch.object(MV, "ANTHROPIC_API_KEY", AN_KEY), mock.patch.object(MV, "TOKENSUPPLY_API_KEY", TS_KEY),
                  mock.patch.object(MV, "_DEAD_PROVIDERS", self.dead),
                  mock.patch.object(M, "TS", {"reasked": {}, "handed": {}, "why": []})):
            p.start()
            self.addCleanup(p.stop)
        MV._CLAUDE_PIN.provider = None

    def net(self, **answers):
        n = Net(**answers)
        p = mock.patch.object(MV.requests, "post", n.post)
        p.start()
        self.addCleanup(p.stop)
        return n


def todays_anthropic_request(prompt, max_tokens, head="", model=SONNET):
    """Anthropic's request as e8ef33b (the version on the website) sends it - written out here, not built by the code
    under test."""
    content = prompt if not head else [{"type": "text", "text": head, "cache_control": {"type": "ephemeral"}},
                                       {"type": "text", "text": prompt}]
    return (AN_URL, {"x-api-key": AN_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            {"model": model, "max_tokens": max_tokens, "stream": True, "messages": [{"role": "user", "content": content}],
             "thinking": {"type": "disabled"}}, {"stream": True, "timeout": (30, 180)})


# ── the request ──────────────────────────────────────────────────────────────────────────────────────────────────────
class Request(Engine):
    def test_endpoint_and_headers(self):
        self.assertEqual(MV._claude_endpoint("tokensupply"),
                         (TS_URL, {"x-api-key": TS_KEY, "Authorization": f"Bearer {TS_KEY}",
                                   "anthropic-version": "2023-06-01", "content-type": "application/json"}))
        self.assertEqual(MV.TOKENSUPPLY_URL, TS_URL)
        with mock.patch.object(MV, "TOKENSUPPLY_API_KEY", ""):
            self.assertIsNone(MV._claude_endpoint("tokensupply"))
        url, headers, _, _ = todays_anthropic_request("p", 1)
        self.assertEqual(MV._claude_endpoint("anthropic"), (url, headers))         # Anthropic's as it was

    def test_its_request_is_anthropics_with_a_system_text(self):
        net = self.net(ts=[ok('{"ok": 1}')])
        self.assertEqual(MV._claude_try("tokensupply", SONNET, "THE PART", 1000, 60, "THE SHARED HEAD\n\n"), '{"ok": 1}')
        s = net.sent[0]
        self.assertEqual(s["url"], TS_URL)
        self.assertEqual(s["kw"], {"stream": True, "timeout": (30, 180)})
        self.assertEqual(s["payload"], {
            "model": SONNET, "max_tokens": 1000, "stream": True,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": "THE SHARED HEAD\n\n", "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": "THE PART"}]}],
            "thinking": {"type": "disabled"}, "system": MV.TOKENSUPPLY_SYSTEM})
        for words in ("not an assistant in a conversation", "no second attempt after the first",
                      "never stop early or leave the last part out", "begins with '{' and ends with '}'"):
            self.assertIn(words, MV.TOKENSUPPLY_SYSTEM)

    def test_anthropics_request_is_byte_for_byte_what_it_was(self):
        net = self.net(anthropic=[ok('{"ok": 1}')])
        for head in ("", "THE SHARED HEAD\n\n"):
            MV._claude_try("anthropic", SONNET, "THE PART", 1000, 60, head)
            s = net.sent[-1]
            url, headers, payload, kw = todays_anthropic_request("THE PART", 1000, head)
            self.assertEqual((s["url"], s["headers"], s["kw"]), (url, headers, kw))
            self.assertEqual(json.dumps(s["payload"]), json.dumps(payload))        # the same keys in the same order
            self.assertNotIn("system", s["payload"])

    def test_the_default_planner_sends_what_it_sent(self):
        """CLAUDE_PROVIDER=anthropic (the website's default planner): one request, today's, never Token Supply's."""
        with mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):
            net = self.net(anthropic=[ok('{"ok": 1}')])
            self.assertEqual(MV.claude("THE PART", SONNET, 2000, head="H "), '{"ok": 1}')
        self.assertEqual([s["url"] for s in net.sent], [AN_URL])
        url, headers, payload, kw = todays_anthropic_request("THE PART", 2000, "H ")
        self.assertEqual(json.dumps(net.sent[0]["payload"]), json.dumps(payload))
        self.assertEqual(self.stats, {"calls": 0, "fell_back": 0, "off": "", "why": [], "handed": 0})
        self.assertEqual(MV.tokensupply_spend_line(), "")


# ── reading the stream ───────────────────────────────────────────────────────────────────────────────────────────────
class Utf8(Engine):
    TEXT = '{"headline": "The keeper — an été of silence", "note": "café"}'

    def test_a_stream_that_names_no_charset_is_read_as_utf8(self):
        r = response(200, b"".join(events(self.TEXT)))
        self.assertEqual(r.encoding, "ISO-8859-1")                   # what requests makes of Token Supply's header
        self.assertEqual(MV._read_sse_text(r, tokensupply=True), self.TEXT)

    def test_a_character_split_between_two_reads_too(self):
        class OneByte(io.BytesIO):
            def read(self, n=-1):
                return super().read(1)
        r = response(200, raw=OneByte(b"".join(events(self.TEXT))))
        self.assertEqual(MV._read_sse_text(r), self.TEXT)

    def test_anthropics_stream_reads_as_before(self):
        r = response(200, b"".join(events(self.TEXT)), ctype="text/event-stream; charset=utf-8")
        self.assertEqual(r.encoding, "utf-8")
        self.assertEqual(MV._read_sse_text(r), self.TEXT)

    def test_through_the_whole_call(self):
        self.net(ts=[ok(self.TEXT)])
        self.assertEqual(MV.claude("p", SONNET, 1000), self.TEXT)


# ── what it costs ────────────────────────────────────────────────────────────────────────────────────────────────────
class Prices(Engine):
    USAGE = {"input_tokens": 1000, "cache_read_input_tokens": 8000, "cache_creation_input_tokens": 2000}

    def test_its_answer_is_counted_under_its_own_name_at_its_own_prices(self):
        MV._read_sse_text(response(200, b"".join(events("{}", self.USAGE, out=500))), tokensupply=True)
        self.assertEqual(list(self.spend["models"]), ["claude-sonnet-5 (Token Supply)"])
        row = self.spend["models"]["claude-sonnet-5 (Token Supply)"]
        self.assertEqual((row["in"], row["out"], row["cache_read"], row["cache_write"], row["calls"]),
                         (11000, 500, 8000, 2000, 1))
        self.assertAlmostEqual(self.spend["usd"], (1000 * 0.6 + 500 * 3.0 + 8000 * 0.06 + 2000 * 0.75) / 1e6, places=12)

    def test_each_model_at_its_row(self):
        for model, (i, o, r, w) in {"claude-sonnet-5": (0.6, 3.0, 0.06, 0.75), "claude-sonnet-5-5": (0.9, 4.5, 0.09, 1.125),
                                     "claude-haiku-5-5": (0.06, 0.3, 0.006, 0.075),
                                     "claude-opus-5": (1.5, 7.5, 0.15, 1.875)}.items():
            before = self.spend["usd"]
            MV._count_tokens(model + MV.TOKENSUPPLY_TAG, 10000, 1000, read=6000, wrote=2000)
            self.assertAlmostEqual(self.spend["usd"] - before, (2000 * i + 1000 * o + 6000 * r + 2000 * w) / 1e6,
                                   places=12, msg=model)

    def test_anthropics_prices_are_as_they_were(self):
        MV._read_sse_text(response(200, b"".join(events("{}", self.USAGE, out=500))))
        self.assertEqual(list(self.spend["models"]), [SONNET])
        self.assertNotIn("calls", self.spend["models"][SONNET])          # its row as it was
        self.assertAlmostEqual(self.spend["usd"], (1000 + 2000 * 1.25 + 8000 * 0.1) / 1e6 * 2.0 + 500 / 1e6 * 10.0,
                               places=12)

    def test_the_spend_lines(self):
        net = self.net(ts=[ok('{"a": 1}', usage=self.USAGE, out=500), err(500)], anthropic=[ok('{"b": 2}')])
        MV.claude("p", SONNET, 1000)                                    # Token Supply answers
        MV.claude("q", SONNET, 1000)                                    # it cannot: Anthropic answers
        self.assertEqual(len(net.to(AN_URL)), 1)
        ts = (1000 * 0.6 + 500 * 3.0 + 8000 * 0.06 + 2000 * 0.75) / 1e6
        an = 100 / 1e6 * 2.0 + 300 / 1e6 * 10.0
        line = MV.claude_spend_line()
        self.assertIn("claude-sonnet-5 100 in / 300 out", line)
        self.assertIn("claude-sonnet-5 (Token Supply) 11k in / 500 out, 8,000 of the input read from the cache", line)
        self.assertNotIn("no price known", line)
        # the website's and the farm's readers of the whole bill still read it, Token Supply's money included
        self.assertAlmostEqual(float(re.findall(r"Claude this run: Claude: .*?= \$([\d.]+)",
                                                f"  Claude this run: {line}")[0]), ts + an, places=4)
        from farm.farm import _CLAUDE
        self.assertEqual(_CLAUDE.search(line).group(1), "2")
        tsl = MV.tokensupply_spend_line()
        self.assertTrue(tsl.startswith(f"Token Supply this run: ${ts:.4f} of it, 1 calls; 1 call(s) went to Anthropic "
                                       f"instead (tokensupply po "), tsl)
        self.assertIn("HTTP 500", tsl)
        self.assertNotIn("turned off", tsl)
        self.assertAlmostEqual(float(re.search(r"Token Supply this run: \$([\d.]+)", tsl).group(1)), ts, places=4)

    def test_a_run_that_did_not_use_it_says_nothing(self):
        self.assertEqual(MV.tokensupply_spend_line(), "")
        MV._count_tokens(SONNET, 1000, 100)
        self.assertEqual(MV.tokensupply_spend_line(), "")

    def test_the_run_logs_it_under_the_claude_line(self):
        src = inspect.getsource(MV.run_pipeline)
        self.assertLess(src.index('log(f"Claude this run: {claude_spend_line()}")'), src.index("log(tokensupply_spend_line())"))


# ── what it cannot answer ────────────────────────────────────────────────────────────────────────────────────────────
class Fallback(Engine):
    def test_it_is_asked_through_its_own_window_then_anthropic_answers(self):
        net = self.net(ts=[err(500)], anthropic=[ok('{"a": 1}')])
        self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": 1}')
        # 12+24+36+48+60+72 s of waits: past TOKENSUPPLY_RETRY_SECONDS (240) on the 7th (45 s would have stopped at 3)
        self.assertEqual(len(net.to(TS_URL)), 7)
        self.assertEqual(len(net.to(AN_URL)), 1)
        self.assertNotIn("system", net.to(AN_URL)[0]["payload"])
        self.assertEqual((self.stats["calls"], self.stats["fell_back"], self.stats["off"]), (0, 1, ""))
        said = [l for l in self.lines if l.startswith("⚠ Token Supply could not answer")]
        self.assertEqual(len(said), 1, self.lines)
        self.assertTrue(said[0].endswith("— this call goes to Anthropic"), said[0])
        self.assertIn("HTTP 500", said[0])
        self.assertEqual(self.dead, set())                               # never among the dead providers

    def test_a_stream_that_breaks_is_asked_again_on_it(self):
        net = self.net(ts=[broken(), ok('{"a": 1}')])
        self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": 1}')
        self.assertEqual((len(net.to(TS_URL)), len(net.to(AN_URL))), (2, 0))
        self.assertEqual(self.stats["calls"], 1)
        self.assertTrue(MV.claude_was_tokensupply())

    def test_a_refused_key_an_empty_wallet_or_an_unknown_model_switch_it_off_for_the_run(self):
        for status in (401, 402, 403, 404):
            with self.subTest(status=status):
                self.stats.update(calls=0, fell_back=0, off="", why=[], handed=0)
                net = self.net(ts=[err(status, '{"error":"unauthorized"}')], anthropic=[ok('{"a": 1}')])
                self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": 1}')
                self.assertIn(f"HTTP {status}", self.stats["off"])
                self.assertTrue(self.lines[-1].endswith("— this call goes to Anthropic and so does every later one "
                                                        "this run"), self.lines[-1])
                self.assertFalse(MV.claude_was_tokensupply())
                MV.claude("q", SONNET, 1000)                            # straight to Anthropic, nothing said
                self.assertEqual((len(net.to(TS_URL)), len(net.to(AN_URL))), (1, 2))
                self.assertEqual(self.stats["fell_back"], 2)
                self.assertIn(f"Token Supply turned off: tokensupply HTTP {status}", MV.tokensupply_spend_line())

    def test_its_reason_is_said_on_one_line(self):
        self.net(ts=[err(401, '{\n  "error": "unauthorized"\n}')], anthropic=[ok('{"a": 1}')])
        MV.claude("p", SONNET, 1000)
        self.assertEqual(self.stats["off"], 'tokensupply HTTP 401: { "error": "unauthorized" }')
        self.assertNotIn("\n", self.lines[-1] + MV.tokensupply_spend_line())

    def test_three_calls_it_could_not_answer_switch_it_off(self):
        with mock.patch.object(MV, "TOKENSUPPLY_RETRY_SECONDS", 0):
            net = self.net(ts=[err(500)], anthropic=[ok('{"a": 1}')])
            for k in range(3):
                MV.claude(f"p{k}", SONNET, 1000)
                self.assertEqual(bool(self.stats["off"]), k == 2, k)
            self.assertTrue(self.stats["off"].startswith("3 calls it could not answer, the last: tokensupply"))
            MV.claude("p3", SONNET, 1000)
        self.assertEqual((len(net.to(TS_URL)), len(net.to(AN_URL)), self.stats["fell_back"]), (3, 4, 4))
        self.assertEqual(len(self.stats["why"]), 3)

    def test_a_missing_key_switches_it_off(self):
        with mock.patch.object(MV, "TOKENSUPPLY_API_KEY", ""):
            net = self.net(anthropic=[ok('{"a": 1}')])
            self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": 1}')
        self.assertEqual(self.stats["off"], "tokensupply: API key missing")
        self.assertEqual([s["url"] for s in net.sent], [AN_URL])

    def test_anthropic_failing_after_it_ends_the_run_as_today(self):
        self.net(ts=[err(401)], anthropic=[err(400, '{"error": {"message": "credit balance is too low"}}')])
        with self.assertRaises(SystemExit) as got:
            MV.claude("p", SONNET, 1000)
        self.assertTrue(str(got.exception.code).startswith("Claude API error: anthropic HTTP 400"), got.exception.code)

    def test_named_explicitly_it_behaves_the_same(self):
        with mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):
            net = self.net(ts=[err(401)], anthropic=[ok('{"a": 1}')])
            self.assertEqual(MV.claude("p", SONNET, 1000, provider="tokensupply"), '{"a": 1}')
        self.assertEqual([s["url"] for s in net.sent], [TS_URL, AN_URL])

    def test_the_default_planner_ends_the_run_on_anthropics_failure_as_today(self):
        with mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):
            net = self.net(anthropic=[err(400, "bad request")])
            with self.assertRaises(SystemExit) as got:
                MV.claude("p", SONNET, 1000)
        self.assertTrue(str(got.exception.code).startswith("Claude API error: anthropic HTTP 400"))
        self.assertEqual([s["url"] for s in net.sent], [AN_URL])

    def test_a_5xx_whose_body_names_a_refusal_does_not_switch_it_off(self):
        """Review 2026-10-14: the switch-off rule read the whole reason, body and all."""
        with mock.patch.object(MV, "TOKENSUPPLY_RETRY_SECONDS", 0):
            self.net(ts=[err(503, '{"error":"upstream returned HTTP 403, retry later"}')], anthropic=[ok('{"a": 1}')])
            MV.claude("p", SONNET, 1000)
        self.assertEqual((self.stats["fell_back"], self.stats["off"]), (1, ""))

    def pings(self, texts=(), then_pings=True, every=10):
        """A stream that begins, writes `texts` one every `every` s of make_video's clock, then only pings (as a stream
        kept alive by a proxy whose answer never comes), or ends."""
        clock, evs = self.clock, events("".join(texts))
        head = evs[:2] + [sse({"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": t}})
                          for t in texts]
        tail = evs[3:] if not then_pings else []

        class Raw:
            def __init__(self):
                self.left = list(head) + list(tail)

            def read(self, n=-1):
                clock.now += every
                if self.left:
                    return self.left.pop(0)
                if then_pings and clock.now > 1000.0 + 3000:              # the test's own end: fails, never hangs
                    raise requests.exceptions.ChunkedEncodingError("the test's stream ends after 3000 s")
                return sse({"type": "ping"}) if then_pings else b""
        return lambda payload: response(200, raw=Raw())

    def test_a_stream_that_only_pings_is_broken_off_past_its_window(self):
        """Review 2026-10-14: requests' read timeout starts again on every line, so a stream kept alive by pings held
        the film for as long as it lasted (2010 s in the reviewer's run, against a window of 240 s)."""
        net = self.net(ts=[self.pings()], anthropic=[ok('{"a": 1}')])
        self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": 1}')
        self.assertEqual((len(net.to(TS_URL)), len(net.to(AN_URL))), (1, 1))
        self.assertLessEqual(self.clock.now - 1000.0, MV.TOKENSUPPLY_RETRY_SECONDS + 120 + 60 + 20)
        self.assertIn("stream stalled", self.stats["why"][0])

    def test_a_long_answer_still_writing_is_never_cut(self):
        texts = ['{"a": "'] + ["x"] * 60 + ['"}']                        # 620 s of writing, ten seconds a piece
        net = self.net(ts=[self.pings(texts, then_pings=False)])
        self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": "' + "x" * 60 + '"}')
        self.assertEqual((len(net.to(TS_URL)), self.stats["calls"]), (1, 1))
        self.assertGreater(self.clock.now - 1000.0, MV.TOKENSUPPLY_RETRY_SECONDS + 180)

    def test_anthropics_stream_has_no_such_limit(self):
        """Anthropic's stream is read as before: no deadline, whatever its pace."""
        with mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):
            self.net(anthropic=[self.pings(['{"a": 1}'], then_pings=False, every=400)])
            self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": 1}')
        self.assertIn("deadline=deadline) if provider == \"tokensupply\"\n                        else "
                      "_read_sse_text(resp, begun))", inspect.getsource(MV._claude_try))

    def test_steps_handed_to_anthropic_switch_it_off_like_calls_it_could_not_answer(self):
        """Review 2026-10-14: a Token Supply whose every answer the planner could not use cost two of its answers and
        one of Anthropic's a step, for the whole film. TOKENSUPPLY_GIVE_UP such steps switch it off; counted apart from
        the calls it could not answer (one of each does not add up to two)."""
        with mock.patch.object(MV, "TOKENSUPPLY_RETRY_SECONDS", 0):
            net = self.net(ts=[ok(PROSE + '{"a": 1}'), ok(PROSE + '{"a": 1}'), err(500), ok(PROSE + '{"a": 1}')],
                           anthropic=[ok('{"a": 3}')])
            for k in range(2):                                           # two steps handed over, one outage between
                self.assertEqual(M._ask(MV, f"STEP {k}", 8000, model=SONNET, step="research dossier"), {"a": 3})
                if k == 0:
                    MV.claude("q", SONNET, 1000)
            self.assertEqual((self.stats["handed"], self.stats["fell_back"], self.stats["off"]), (2, 1, ""))
            net.answers[TS_URL] = [ok(PROSE + '{"a": 1}')]
            self.assertEqual(M._ask(MV, "STEP 2", 8000, model=SONNET, step="templates"), {"a": 3})
            self.assertEqual(self.stats["handed"], 3)
            self.assertTrue(self.stats["off"].startswith("3 answers it could not give properly, the last: templates: "),
                            self.stats["off"])
            self.assertIn("⚠ Token Supply's answers could not be used 3 times — every later call this run goes to "
                          "Anthropic", self.lines)
            sent = len(net.to(TS_URL))
            self.assertEqual(M._ask(MV, "STEP 3", 8000, model=SONNET, step="templates"), {"a": 3})
            self.assertEqual(len(net.to(TS_URL)), sent)                   # straight to Anthropic from then on
        line = MV.tokensupply_spend_line()
        self.assertIn("; 3 step(s) handed to Anthropic after answers it could not give properly; Token Supply turned "
                      "off: 3 answers it could not give properly, the last: templates: ", line)
        # the website's reader of the switch-off (web/jobs.py costs()) reads it as before, to the line's end
        self.assertEqual(re.findall(r"Token Supply this run: .*?; Token Supply turned off: (.+?)\s*$", line, re.M),
                         [self.stats["off"]])


# ── the pin ──────────────────────────────────────────────────────────────────────────────────────────────────────────
class Pin(Engine):
    def spy(self):
        seen = []
        real = MV._claude_try

        def tried(provider, model, prompt, max_tokens, budget_s, head="", begun=None):
            seen.append((provider, budget_s))
            return real(provider, model, prompt, max_tokens, budget_s, head, begun)
        p = mock.patch.object(MV, "_claude_try", tried)
        p.start()
        self.addCleanup(p.stop)
        return seen

    def test_pinned_to_anthropic_it_is_todays_planner(self):
        seen = self.spy()
        net = self.net(anthropic=[ok('{"a": 1}')])
        with MV.claude_on("anthropic"):
            self.assertEqual(MV.claude_provider(), "anthropic")
            self.assertEqual(MV.claude("p", SONNET, 1000), '{"a": 1}')
        self.assertEqual([s["url"] for s in net.sent], [AN_URL])
        pinned = list(seen)
        seen.clear()
        with mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):     # today's planner, no pin
            MV.claude("p", SONNET, 1000)
        self.assertEqual(pinned, seen)
        self.assertEqual(seen, [("anthropic", MV.CLAUDE_RETRY_SECONDS)])
        self.assertEqual(json.dumps(net.sent[0]["payload"]), json.dumps(net.sent[1]["payload"]))
        self.assertEqual(self.stats, {"calls": 0, "fell_back": 0, "off": "", "why": [], "handed": 0})

    def test_a_call_it_could_not_answer_is_todays_anthropic_request(self):
        """What Token Supply cannot answer goes to Anthropic as today's planner sends it: the same request (the shared
        head as its cached block, the same max_tokens) and Anthropic's own retry window (review 2026-10-14: nothing
        pinned the head, the window or the size of that request)."""
        seen = self.spy()
        for status in (500, 401):
            with self.subTest(status=status):
                self.stats.update(calls=0, fell_back=0, off="", why=[], handed=0)
                seen.clear()
                net = self.net(ts=[err(status)], anthropic=[ok('{"a": 1}')])
                self.assertEqual(MV.claude("THE PART", SONNET, 2000, head="H "), '{"a": 1}')
                url, headers, payload, kw = todays_anthropic_request("THE PART", 2000, "H ")
                s = net.to(AN_URL)[0]
                self.assertEqual((s["url"], s["headers"], s["kw"]), (url, headers, kw))
                self.assertEqual(json.dumps(s["payload"]), json.dumps(payload))
                self.assertEqual(seen[-1], ("anthropic", MV.CLAUDE_RETRY_SECONDS))

    def test_pinned_a_failure_ends_the_run_as_today(self):
        self.net(anthropic=[err(529, "overloaded")])
        with MV.claude_on("anthropic"), self.assertRaises(SystemExit) as got:
            MV.claude("p", SONNET, 1000)
        self.assertTrue(str(got.exception.code).startswith("Claude API error: anthropic po "), got.exception.code)
        self.assertGreaterEqual(self.clock.now - 1000.0, MV.CLAUDE_RETRY_SECONDS)   # Anthropic's whole window
        self.assertEqual(self.dead, set())

    def test_a_pin_is_this_threads_alone(self):
        seen = {}
        with MV.claude_on("anthropic"):
            t = threading.Thread(target=lambda: seen.setdefault("other", MV.claude_provider()))
            t.start()
            t.join()
            seen["this"] = MV.claude_provider()

        def pinned_elsewhere():
            with MV.claude_on("anthropic"):
                seen["there"] = MV.claude_provider()
        t = threading.Thread(target=pinned_elsewhere)
        t.start()
        t.join()
        self.assertEqual(seen, {"other": "tokensupply", "this": "anthropic", "there": "anthropic"})
        self.assertEqual(MV.claude_provider(), "tokensupply")

    def test_pins_nest_and_restore(self):
        with MV.claude_on("anthropic"):
            with MV.claude_on("kie"):
                self.assertEqual(MV.claude_provider(), "kie")
                with MV.claude_on(None):
                    self.assertEqual(MV.claude_provider(), "kie")
                with MV.claude_on("tokensupply"):                     # the configured one: as if unpinned
                    self.assertEqual(MV.claude_provider(), "tokensupply")
                self.assertEqual(MV.claude_provider(), "kie")
            self.assertEqual(MV.claude_provider(), "anthropic")
        self.assertEqual(MV.claude_provider(), "tokensupply")
        with self.assertRaises(ValueError):
            with MV.claude_on("anthropic"):
                raise ValueError("a failure inside")
        self.assertEqual(MV.claude_provider(), "tokensupply")

    def test_on_the_default_planner_a_pin_to_anthropic_changes_nothing(self):
        with mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):
            with MV.claude_on("anthropic"):
                self.assertIsNone(MV._CLAUDE_PIN.provider)
            with MV.claude_on(None):
                self.assertIsNone(MV._CLAUDE_PIN.provider)


class Caches(Engine):
    def test_the_shot_step_starts_one_part_alone_on_it(self):
        self.assertTrue(MV.claude_caches())
        self.stats["off"] = "tokensupply HTTP 402"                       # off: its calls go to Anthropic, which caches
        self.assertTrue(MV.claude_caches())
        with mock.patch.object(MV, "ANTHROPIC_API_KEY", ""):
            self.assertFalse(MV.claude_caches())
        self.stats["off"] = ""
        with mock.patch.object(MV, "TOKENSUPPLY_API_KEY", ""):
            self.assertTrue(MV.claude_caches())                          # no key: Anthropic answers, and caches
        with MV.claude_on("anthropic"):
            self.assertTrue(MV.claude_caches())
            with mock.patch.object(MV, "ANTHROPIC_API_KEY", ""):
                self.assertFalse(MV.claude_caches())
        with MV.claude_on("kie"):
            self.assertFalse(MV.claude_caches())

    def test_other_planners_as_before(self):
        for provider, want in (("anthropic", True), ("kie", False), ("claudecode", False), ("codex", False)):
            with mock.patch.object(MV, "CLAUDE_PROVIDER", provider):
                self.assertEqual(MV.claude_caches(), want, provider)

    def test_the_shot_parts_go_to_it_with_the_head_cached_the_first_one_alone(self):
        cues = [(t, t + 1900, f"{G.word(t // 2000, 0).capitalize()} {G.word(t // 2000, 1)} went on.")
                for t in range(0, 300000, 2000)]

        def scenes(payload):
            text = payload["messages"][0]["content"][-1]["text"]
            f0, f1 = (int(x) for x in re.search(r"FOCUS RANGE: (\d+)ms to (\d+)ms", text).groups())
            return json.dumps({"scenes": [{"startMs": a, "visualIntent": f"picture {a}", "queries": [f"q{a}", "", ""],
                                           "entities": [], "mood": "dark", "sceneType": "imagery"}
                                          for a, b, _ in cues if f0 <= a < f1][::2]})
        net = self.net(ts=[ok(scenes)])
        job = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, job, ignore_errors=True)
        (job / "mrtruth").mkdir()
        ts = lambda ms: f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
        (job / "subs.srt").write_text("\n\n".join(f"{k + 1}\n{ts(a)} --> {ts(b)}\n{t}" for k, (a, b, t) in
                                                   enumerate(cues)) + "\n", encoding="utf-8")
        with mock.patch.object(MV, "UTILITY_MODEL", SONNET):
            rows = M.beats(MV, job, job / "subs.srt", "a made-up script", G.DOSSIER)
        self.assertTrue(rows)
        self.assertEqual([s["url"] for s in net.sent], [TS_URL] * 3)
        self.assertTrue(all(s["payload"]["messages"][0]["content"][0]["cache_control"] == {"type": "ephemeral"}
                            and s["payload"]["system"] == MV.TOKENSUPPLY_SYSTEM for s in net.sent))
        self.assertTrue(any("the first part began answering after" in l for l in self.lines), self.lines)
        self.assertEqual(self.stats["calls"], 3)


# ── the planner's one place it asks Claude (_ask) ─────────────────────────────────────────────────────────────────────
class Fake:
    """An engine on Token Supply's planner: an unpinned call is answered from `ts`, a call pinned to Anthropic from
    `anthropic` (in order; a function of the prompt, or a text); every call kept with who answered it."""
    UTILITY_MODEL = SCRIPT_MODEL = SONNET

    def __init__(self, ts=(), anthropic=(), provider="tokensupply", cut=()):
        self.CLAUDE_PROVIDER, self.ts, self.anthropic, self.cut = provider, list(ts), list(anthropic), set(cut)
        self.calls, self.lines, self._pin = [], [], threading.local()

    def log(self, s):
        self.lines.append(s)

    def claude_provider(self):
        return getattr(self._pin, "p", None) or self.CLAUDE_PROVIDER

    @contextlib.contextmanager
    def claude_on(self, p):
        old = getattr(self._pin, "p", None)
        self._pin.p = p
        try:
            yield
        finally:
            self._pin.p = old

    def claude(self, prompt, model, max_tokens=0, **kw):
        who = self.claude_provider()
        self.calls.append((who, prompt, max_tokens))
        a = (self.ts if who == "tokensupply" else self.anthropic).pop(0)
        return a(prompt) if callable(a) else a

    def claude_was_tokensupply(self):
        return self.calls[-1][0] == "tokensupply"

    def claude_cut_off(self):
        return len(self.calls) - 1 in self.cut

    def claude_max_out(self, model):
        return 128000

    def who(self):
        return [w for w, _, _ in self.calls]


PROSE = ("Looking at the script, I need to work out where each scene begins before I write the answer, so let me go "
         "through the transcript first and note every place the narration turns, then check the rules once more, and "
         "only then give the object the step asks for, in full, as required.")


class Ask(unittest.TestCase):
    def setUp(self):
        p = mock.patch.object(M, "TS", {"reasked": {}, "handed": {}, "why": []})
        p.start()
        self.addCleanup(p.stop)

    def test_long_prose_around_its_json_is_asked_again(self):
        self.assertGreater(len(PROSE), M.TS_PROSE_MAX)
        e = Fake(ts=[PROSE + '\n{"a": 1}', '{"a": 2}'])
        self.assertEqual(M._ask(e, "p", 12000, step="research dossier"), {"a": 2})
        self.assertEqual(e.who(), ["tokensupply", "tokensupply"])
        self.assertEqual(e.lines, [f"  ⚠ Token Supply's answer to research dossier could not be used ({len(PROSE)} "
                                   f"characters of prose before its JSON) — asking again"])
        self.assertEqual(M.TS["reasked"], {"research dossier": 1})
        e = Fake(ts=['{"a": 1}\n\nWait, ' + PROSE, '{"a": 2}'])
        self.assertEqual(M._ask(e, "p", 12000, step="research dossier"), {"a": 2})
        self.assertIn("characters of prose after its JSON", e.lines[0])

    def test_two_bad_answers_and_the_third_try_is_anthropics(self):
        e = Fake(ts=['{"a": 1,}', PROSE + '{"a": 1}'], anthropic=['{"a": 3}'])
        self.assertEqual(M._ask(e, "p", 24000, step="shots 120s-240s"), {"a": 3})
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic"])
        self.assertEqual(len({p for _, p, _ in e.calls}), 1)                 # the same request each time
        self.assertTrue(e.lines[0].startswith("  ⚠ Token Supply's answer to shots 120s-240s could not be used ("))
        self.assertTrue(e.lines[0].endswith("— asking again"))
        self.assertTrue(e.lines[1].endswith("characters of prose before its JSON) — asking Anthropic"), e.lines[1])
        self.assertEqual((M.TS["reasked"], M.TS["handed"]), ({"shots": 1}, {"shots": 1}))

    def test_an_answer_with_no_json_at_all_is_said_so(self):
        e = Fake(ts=["I'm actually Kiro, not Claude Code.", '{"a": 2}'])
        self.assertEqual(M._ask(e, "p", 6000, step="typed captions"), {"a": 2})
        self.assertIn("(no JSON in it) — asking again", e.lines[0])

    def test_a_fenced_answer_and_a_short_lead_in_are_fine(self):
        for raw in ('```json\n{"a": 1}\n```', '```\n{"a": 1}\n```', 'Here it is:\n{"a": 1}', ' {"a": 1} '):
            e = Fake(ts=[raw])
            self.assertEqual(M._ask(e, "p", 8000, step="visual brief"), {"a": 1}, raw)
            self.assertEqual((len(e.calls), e.lines), (1, []), raw)

    def test_on_the_default_planner_none_of_it_runs(self):
        e = Fake(ts=[], anthropic=[PROSE + '{"a": 1}'], provider="anthropic")
        self.assertEqual(M._ask(e, "p", 8000, step="research dossier"), {"a": 1})
        self.assertEqual((e.who(), e.lines, M.TS["reasked"]), (["anthropic"], [], {}))
        e = Fake(anthropic=["no json", "still none", "nothing"], provider="anthropic")
        with self.assertRaises(RuntimeError):
            M._ask(e, "p", 8000, step="research dossier")
        self.assertEqual(e.who(), ["anthropic"] * 3)
        self.assertEqual(e.lines, [])

    def test_an_answer_anthropic_gave_in_its_place_is_not_held_to_the_rule(self):
        class FellBack(Fake):
            def claude_was_tokensupply(self):
                return False
        e = FellBack(ts=[PROSE + '{"a": 1}'])
        self.assertEqual(M._ask(e, "p", 8000, step="research dossier"), {"a": 1})
        self.assertEqual(e.lines, [])

    def test_a_runaway_cut_off_twice_is_anthropics(self):
        e = Fake(ts=['{"scenes": [', '{"scenes": ['], anthropic=['{"scenes": []}'], cut={0, 1})
        self.assertEqual(M._ask(e, "p", 24000, step="shots 0s-120s"), {"scenes": []})
        self.assertEqual([(w, n) for w, _, n in e.calls],              # Anthropic from the step's own size, as today
                         [("tokensupply", 24000), ("tokensupply", 36000), ("anthropic", 24000)])
        self.assertTrue(e.lines[1].endswith("- not asked again on Token Supply"), e.lines)
        self.assertIn("(answer cut off at 36000 tokens twice) — asking Anthropic", e.lines[2])

    def test_a_step_handed_to_anthropic_gets_todays_three_tries(self):
        """Review 2026-10-14: the hand-over was one pinned try, so an Anthropic answer that did not parse lost the step
        (research then planned without a dossier) where today's planner asks Anthropic again."""
        e = Fake(ts=[PROSE + '{"a": 1}', '{"a": 1,}'], anthropic=['{"a": 1,}', '{"ok": 1}'])
        self.assertEqual(M._ask(e, "p", 12000, step="research dossier"), {"ok": 1})
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic", "anthropic"])
        self.assertEqual(len({p for _, p, _ in e.calls}), 1)                 # the same request each time
        self.assertEqual(M.TS["handed"], {"research dossier": 1})             # said and counted once
        self.assertEqual(sum("asking Anthropic" in l for l in e.lines), 1, e.lines)
        e0 = Fake(anthropic=['{"a": 1,}', '{"ok": 1}'], provider="anthropic")   # today's planner on the same answers
        self.assertEqual(M._ask(e0, "p", 12000, step="research dossier"), {"ok": 1})
        e = Fake(ts=["no json", "none"], anthropic=["no", "nothing", "none"])
        with self.assertRaises(RuntimeError):                               # Anthropic's three, then as today
            M._ask(e, "p", 12000, step="research dossier")
        self.assertEqual(e.who(), ["tokensupply"] * 2 + ["anthropic"] * 3)

    def test_a_step_handed_to_anthropic_gets_its_more_room_once(self):
        e = Fake(ts=["no json", "none"], anthropic=['{"scenes": [', '{"scenes": []}'], cut={2})
        self.assertEqual(M._ask(e, "p", 12000, step="shots 0s-120s"), {"scenes": []})
        self.assertEqual([(w, n) for w, _, n in e.calls],
                         [("tokensupply", 12000), ("tokensupply", 12000), ("anthropic", 12000), ("anthropic", 18000)])

    def test_a_hand_over_after_an_unusable_then_a_cut_off_answer_is_said_and_counted(self):
        """Review 2026-10-14: prose, then an answer cut off and asked again with more room, went to Anthropic with
        nothing said and nothing counted."""
        e = Fake(ts=[PROSE + '{"a": 1}', '{"opportunities": ['], anthropic=['{"a": 3}'], cut={1})
        self.assertEqual(M._ask(e, "p", 8000, step="templates"), {"a": 3})
        self.assertEqual([(w, n) for w, _, n in e.calls], [("tokensupply", 8000), ("tokensupply", 8000), ("anthropic", 8000)])
        self.assertEqual((M.TS["reasked"], M.TS["handed"]), ({"templates": 1}, {"templates": 1}))
        self.assertEqual(e.lines[-1], "  ⚠ Token Supply's answer to templates could not be used (answer cut off at 8000 "
                                      "tokens) — asking Anthropic")

    def test_answers_anthropic_gave_in_its_place_are_not_blamed_on_it(self):
        class FellBack(Fake):                                            # Token Supply off: make_video asked Anthropic
            def claude_was_tokensupply(self):
                return False
        e = FellBack(ts=["no json", "none"], anthropic=['{"a": 3}'])
        self.assertEqual(M._ask(e, "p", 8000, step="research dossier"), {"a": 3})
        self.assertEqual((e.lines, M.TS["handed"], M.TS["reasked"]), ([], {}, {}))

    def test_a_step_that_names_none_is_logged_by_its_own_name(self):
        def places_and_dates(e):
            return M._ask(e, "p", 8000, model=e.SCRIPT_MODEL)
        e = Fake(ts=[PROSE + "{}", "{}"])
        places_and_dates(e)
        self.assertIn("Token Supply's answer to maps and dates could not be used", e.lines[0])
        e = Fake(ts=["none", "{}"])
        M._ask(e, "p", 8000)
        self.assertIn("Token Supply's answer to a planning step could not be used", e.lines[0])
        self.assertEqual(M.TS["reasked"], {"maps and dates": 1, "a planning step": 1})

    def test_through_the_engine_the_third_try_goes_to_anthropic_as_today(self):
        """With the real engine: two of Token Supply's answers it could not give properly, then Anthropic's, pinned:
        today's request, with Anthropic's window and no fallback."""
        class E(Engine):
            def runTest(self):
                pass
        t = E()
        t.setUp()
        try:
            net = t.net(ts=[ok(PROSE + '{"a": 1}'), ok('{"a": 1,}')], anthropic=[ok('{"a": 3}')])
            self.assertEqual(M._ask(MV, "THE BRIEF", 12000, model=SONNET, step="research dossier"), {"a": 3})
            self.assertEqual([s["url"] for s in net.sent], [TS_URL, TS_URL, AN_URL])
            strict = net.sent[0]["payload"]["messages"][0]["content"]
            url, headers, payload, kw = todays_anthropic_request(strict, 12000)
            self.assertEqual(json.dumps(net.sent[2]["payload"]), json.dumps(payload))
            self.assertEqual(M.TS["handed"], {"research dossier": 1})
            self.assertEqual(MV.claude_provider(), "tokensupply")             # the pin is gone again
        finally:
            t.doCleanups()

    def test_through_the_engine_anthropic_asked_again_after_an_answer_that_does_not_parse(self):
        """The reviewer's case (a): two of Token Supply's answers it could not give properly, then Anthropic answers
        once with a trailing comma - today's planner asks Anthropic again, and so does this one."""
        class E(Engine):
            def runTest(self):
                pass
        t = E()
        t.setUp()
        try:
            net = t.net(ts=[ok(PROSE + '{"a": 1}'), ok('{"a": 1,}')], anthropic=[ok('{"a": 1,}'), ok('{"ok": 1}')])
            self.assertEqual(M._ask(MV, "THE BRIEF", 12000, model=SONNET, step="research dossier"), {"ok": 1})
            self.assertEqual([s["url"] for s in net.sent], [TS_URL, TS_URL, AN_URL, AN_URL])
            self.assertEqual([s["payload"]["max_tokens"] for s in net.to(AN_URL)], [12000, 12000])
        finally:
            t.doCleanups()


# ── the highlighted page: Anthropic's, exactly as today ──────────────────────────────────────────────────────────────
class Pages(H.Tmp):
    def setUp(self):
        super().setUp()
        self.e = Engine("run")
        self.e.provider = "tokensupply"
        self.e.setUp()
        self.addCleanup(self.e.doCleanups)
        M.HL.clear()

    def page_run(self, provider, job):
        rows = H.quote_film()
        answer = json.dumps(H.answer_for((10, H.page())))
        with mock.patch.object(MV, "CLAUDE_PROVIDER", provider):
            net = self.e.net(anthropic=[ok(answer)])                     # nothing queued for Token Supply
            G.write_job(job, rows)
            hl = M.highlight_pages(MV, job, rows, "the script", G.DOSSIER, G.cues_of(rows))
        saved = json.loads((job / "mrtruth" / "highlights.json").read_text(encoding="utf-8"))
        return net, saved, copy.deepcopy(hl["placed"]), rows

    def test_on_token_supplys_planner_the_page_is_asked_of_anthropic_with_the_same_request_and_key(self):
        net0, saved0, placed0, rows0 = self.page_run("anthropic", self.job)
        job = Path(self.tmp.name) / "job_ts"
        (job / "mrtruth").mkdir(parents=True)
        net1, saved1, placed1, rows1 = self.page_run("tokensupply", job)
        self.assertEqual([s["url"] for s in net1.sent], [AN_URL])
        self.assertEqual(json.dumps(net1.sent[0]["payload"]), json.dumps(net0.sent[0]["payload"]))
        self.assertEqual((net1.sent[0]["headers"], net1.sent[0]["kw"]), (net0.sent[0]["headers"], net0.sent[0]["kw"]))
        self.assertNotIn("system", net1.sent[0]["payload"])
        self.assertEqual(saved1, saved0)                                  # the same key, the same answer
        self.assertEqual(placed1, placed0)
        self.assertEqual(rows1, rows0)
        self.assertEqual(M.TS, {"reasked": {}, "handed": {}, "why": []})
        self.assertEqual(self.e.stats["calls"], 0)

    def test_anthropic_failing_on_the_page_ends_the_run_as_today(self):
        rows = H.quote_film()
        self.e.net(anthropic=[err(400, '{"error": {"message": "credit balance is too low"}}')])
        G.write_job(self.job, rows)
        with self.assertRaises(SystemExit):
            M._hl_safe(MV, self.job, rows, "the script", G.DOSSIER, G.cues_of(rows))

    def test_the_step_itself_is_unchanged_but_for_the_pin(self):
        src = inspect.getsource(M.highlight_pages)
        self.assertIn("with _anthropic(engine):", src)
        self.assertIn('got = {"key": key, "answer": _ask(engine, prompt, 8000, model=engine.SCRIPT_MODEL)}', src)
        self.assertIn("key = _hash([HL_V, prompt])", src)


# ── the visual plan's reach ──────────────────────────────────────────────────────────────────────────────────────────
def made_up_script(n=10924):
    out, k = [], 0
    while len(" ".join(out)) < n:
        out.append(G.line(k))
        k += 1
    return " ".join(out)[:n]


def plan(last, count=40, first=0):
    """A visual plan of `count` templates evenly spread from character `first` to `last`."""
    return [{"templateId": "shadow-up", "startChar": round(first + (last - first) * i / (count - 1)),
             "endChar": round(first + (last - first) * i / (count - 1)) + 40, "headline": "x"} for i in range(count)]


class Templates(unittest.TestCase):
    N = 10924

    def setUp(self):
        p = mock.patch.object(M, "TS", {"reasked": {}, "handed": {}, "why": []})
        p.start()
        self.addCleanup(p.stop)
        self.script = made_up_script(self.N)
        self.assertEqual(len(self.script), self.N)

    def job(self):
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        (d / "mrtruth").mkdir()
        (d / "title.txt").write_text("A Made-Up Film\n11 minutes\n", encoding="utf-8")
        return d

    def test_the_measured_case_is_short_and_sonnets_are_not(self):
        n = self.N
        r = M._reach(plan(round(0.66 * n), 53), n)                       # Token Supply's: its last start at 66%
        self.assertAlmostEqual(r["tail"], 0.34, places=2)
        self.assertTrue(M._ts_short(r))
        for tail in (0.02, 0.13, 0.15, 0.11):                            # real Sonnet's, on three scripts
            self.assertFalse(M._ts_short(M._reach(plan(round((1 - tail) * n), 36), n)), tail)
        hole = plan(round(0.30 * n), 15) + plan(round(0.98 * n), 15, first=round(0.62 * n))
        r = M._reach(hole, n)
        self.assertTrue(M._ts_short(r))                                   # reaches the end, a third missing inside
        self.assertEqual((r["a"], r["b"]), (round(0.30 * n), round(0.62 * n)))
        self.assertTrue(M._ts_short(M._reach([], n)))
        r = M._reach([{"startChar": "x"}, {"startChar": None}, {}] + plan(round(0.97 * n), 36), n)
        self.assertFalse(M._ts_short(r))                                  # unreadable starts are left out

    def run_step(self, e, job=None):
        job = job or self.job()
        return M.opportunities(e, job, self.script), job

    def test_short_asked_again_still_short_then_anthropics_under_the_first_key(self):
        short, full = plan(round(0.66 * self.N), 53), plan(round(0.97 * self.N), 45)
        e = Fake(ts=[json.dumps({"opportunities": short}), json.dumps({"opportunities": plan(round(0.70 * self.N))})],
                 anthropic=[json.dumps({"opportunities": full})])
        got, job = self.run_step(e)
        self.assertEqual(got, full)
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic"])
        (_, p1, _), (_, p2, _), (_, p3, _) = e.calls
        self.assertEqual(p3, p1)                                           # Anthropic: the brief as it was
        last = short[-1]["startChar"]
        self.assertIn(f"\n\nYour previous answer stopped proposing at character {last} of {self.N}. Cover the whole "
                      f"script to its last sentence.", p2)
        self.assertTrue(p2.startswith(p1.split("\n\nRETURN FORMAT FOR THIS RUN")[0]))
        self.assertIn(f"  ⚠ Token Supply's visual plan stops at 66% of the script (its last template starts at character "
                      f"{last} of {self.N}) — asking again", e.lines)
        self.assertTrue(any(l.startswith("  ⚠ Token Supply's visual plan, asked again, stops at 70% of the script")
                            and l.endswith("— asking Anthropic") for l in e.lines), e.lines)
        self.assertEqual((M.TS["reasked"], M.TS["handed"]), ({"templates": 1}, {"templates": 1}))
        # saved under the key the default planner would save it under, and read back on a re-run without a call
        e0 = Fake(anthropic=[json.dumps({"opportunities": short})], provider="anthropic")
        _, job0 = self.run_step(e0)
        key = lambda j: json.loads((j / "mrtruth" / "templates.json").read_text(encoding="utf-8"))["key"]
        self.assertEqual(key(job), key(job0))
        again = Fake()
        self.assertEqual(M.opportunities(again, job, self.script), full)
        self.assertEqual(again.calls, [])

    def test_an_answer_asked_again_that_reaches_is_used(self):
        full = plan(round(0.98 * self.N), 45)
        e = Fake(ts=[json.dumps({"opportunities": plan(round(0.66 * self.N), 53)}), json.dumps({"opportunities": full})])
        got, _ = self.run_step(e)
        self.assertEqual((got, e.who()), (full, ["tokensupply", "tokensupply"]))
        self.assertEqual(M.TS["handed"], {})

    def test_an_unusable_second_answer_goes_to_anthropic(self):
        full = plan(round(0.98 * self.N), 45)
        e = Fake(ts=[json.dumps({"opportunities": plan(round(0.66 * self.N), 53)}), PROSE + "{}"],
                 anthropic=[json.dumps({"opportunities": full})])
        got, _ = self.run_step(e)
        self.assertEqual((got, e.who()), (full, ["tokensupply", "tokensupply", "anthropic"]))

    def test_a_plan_that_reaches_is_asked_once(self):
        e = Fake(ts=[json.dumps({"opportunities": plan(round(0.87 * self.N), 36)})])
        self.run_step(e)
        self.assertEqual((e.who(), e.lines[1:]), (["tokensupply"], []))

    def test_on_the_default_planner_a_short_plan_is_kept_as_it_was(self):
        short = plan(round(0.66 * self.N), 53)
        e = Fake(anthropic=[json.dumps({"opportunities": short})], provider="anthropic")
        got, _ = self.run_step(e)
        self.assertEqual((got, e.who()), (short, ["anthropic"]))

    def test_when_anthropic_gives_none_the_further_reaching_of_its_two_is_kept(self):
        a, b = plan(round(0.66 * self.N), 53), plan(round(0.72 * self.N), 40)
        e = Fake(ts=[json.dumps({"opportunities": a}), json.dumps({"opportunities": b})],
                 anthropic=["no", "none", "nothing"])
        got, _ = self.run_step(e)
        self.assertEqual(got, b)

    def test_anthropics_plan_is_kept_whatever_its_reach(self):
        """Sonnet's own plan is the baseline: never held to the reach check, never a fourth call."""
        sonnet = plan(round(0.55 * self.N), 30)
        e = Fake(ts=[json.dumps({"opportunities": plan(round(0.66 * self.N), 53)}),
                     json.dumps({"opportunities": plan(round(0.70 * self.N), 40)})],
                 anthropic=[json.dumps({"opportunities": sonnet})])
        got, job = self.run_step(e)
        self.assertEqual(got, sonnet)
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic"])
        saved = json.loads((job / "mrtruth" / "templates.json").read_text(encoding="utf-8"))
        e0 = Fake(anthropic=[json.dumps({"opportunities": sonnet})], provider="anthropic")
        _, job0 = self.run_step(e0)
        self.assertEqual(saved, json.loads((job0 / "mrtruth" / "templates.json").read_text(encoding="utf-8")))

    # ── the real plans' positions (review 2026-10-14), no script text: (startChar as the plan gave it, where its words
    #    are said by the best-matching sentence and those either side, None where they are not found), on the same
    #    11-minute script of 10924 characters. Sonnet's offsets run up to about 1.17x short of where their words are said
    REAL = {
        "token supply": [(0, 0), (119, 0), (269, None), (350, 340), (498, 403), (602, 647), (696, 744), (878, 794),
                         (1034, 942), (1190, 1326), (1333, 1356), (1421, 1510), (1490, 1636), (1650, 1636), (1945, 2076),
                         (2136, 2360), (2321, 2397), (2488, None), (2587, 2763), (2773, None), (2944, 3220), (3046, 3242),
                         (3100, 3266), (3252, 3387), (3422, 3591), (3512, 3795), (3687, 3905), (3864, 4099), (3919, 4162),
                         (4045, None), (4123, 4362), (4238, 4397), (4421, None), (4613, 4589), (4747, 4866), (4845, 4962),
                         (5034, 4962), (5231, 5323), (5413, None), (5539, 5449), (5665, 5584), (5794, None), (5898, 6039),
                         (6059, 6071), (6154, 6093), (6350, None), (6460, 6331), (6561, 2360), (6701, 6421), (6787, 6545),
                         (6969, 6624), (7130, 6988), (7222, None)],
        # Sonnet through Anthropic, 2026-10-10 (an older brief): 0.295 by startChar, its words to 77% of the script
        "sonnet full_out": [(0, None), (0, None), (0, 0), (124, 0), (124, 0), (737, 744), (921, None), (921, 794),
                            (1151, None), (1421, 1560), (1501, None), (1501, 1560), (1944, 1959), (2144, 2076),
                            (2450, 2542), (2621, 2763), (3050, None), (3350, 3387), (3450, 3591), (3500, 3795),
                            (3750, 3905), (3951, None), (4151, 4451), (4450, None), (4601, None), (5300, 5449),
                            (5550, None), (5850, 6093), (6020, 6331), (6250, 6624), (6251, None), (6450, 6624),
                            (6950, 7653), (7400, 7970), (7550, 2542), (7700, 8383)],
        # Sonnet through Anthropic, 2026-10-11 (today's brief): 0.247 by startChar, its words to the last sentence
        "sonnet full5_out": [(0, 0), (144, None), (331, None), (557, 340), (653, 403), (775, 583), (925, 794),
                             (1084, None), (1221, 1326), (1351, 1356), (1469, 1510), (1560, 1636), (1935, 2076),
                             (2080, 2360), (2359, 2542), (2464, None), (2795, 3220), (2870, 3242), (2926, 3387),
                             (3090, 3819), (3297, 3905), (3464, 4148), (3663, 4162), (3739, 4397), (3932, None),
                             (4079, 4962), (4281, 4866), (4700, 5449), (4895, 5908), (5192, None), (5289, 6331),
                             (5529, 6545), (5652, 6624), (6014, 6988), (6287, 7320), (6422, 7653), (6718, 7970),
                             (6901, 8082), (6976, 8518), (7072, 8543), (7342, None), (7342, 8925), (7451, 9035),
                             (7745, 2076), (7901, 9909), (8014, 10162), (8101, 10417), (8231, 10835)]}

    def real_plan(self, name):
        """A plan of made-up words at a real plan's positions: each template's startChar as given, its headline the
        made-up sentence said where the real template's words were said (one not found by its words: no words)."""
        sents = [(m.start(), m.group(0).strip()) for m in re.finditer(r"[^.!?]+[.!?]+\s*", self.script)]
        at = lambda c: [t for a, t in sents if a <= c][-1]
        return [{"templateId": "shadow-up", "startChar": given, "endChar": given + 40,
                 "headline": "x" if said is None else at(said), "lines": []} for given, said in self.REAL[name]]

    def test_a_plan_whose_words_reach_the_end_is_not_short(self):
        """Review 2026-10-14: by startChar alone two real Sonnet plans of the 11-minute script read 0.295 and 0.247, the
        first over the threshold and the second 0.003 under it, though their words reach 77% and 99% of the script; a
        tail counts only where the plan's words stop too. Token Supply's stop (64% by its words) is still found."""
        n = self.N
        for name, by_start, short in (("token supply", 0.339, True), ("sonnet full_out", 0.295, False),
                                      ("sonnet full5_out", 0.247, False)):
            opps = self.real_plan(name)
            r, said = M._reach(opps, n), M._said_tail(opps, self.script)
            self.assertAlmostEqual(r["tail"], by_start, places=3, msg=name)
            self.assertEqual(M._ts_short(r, said), short, (name, said))
            e = Fake(ts=[json.dumps({"opportunities": opps})] * 2, anthropic=[json.dumps({"opportunities": opps})])
            got, _ = self.run_step(e)
            self.assertEqual(got, opps)
            self.assertEqual(e.who(), ["tokensupply"] * (2 if short else 1) + ["anthropic"] * short, name)
        self.assertGreater(M._said_tail(self.real_plan("token supply"), self.script), 0.35)
        self.assertLess(M._said_tail(self.real_plan("sonnet full5_out"), self.script), 0.02)
        self.assertIsNone(M._said_tail(plan(round(0.66 * n), 53), self.script))    # no words: startChar alone, as before
        self.assertTrue(M._ts_short(M._reach(plan(round(0.66 * n), 53), n), None))


# ── the chapters ─────────────────────────────────────────────────────────────────────────────────────────────────────
def chapter_film(starts=None, n=157, ms=4200):
    """Plain shots (made-up sentences), the opening title on the first; `starts` the shots' starts in ms if given."""
    starts = starts or [k * ms for k in range(n)]
    rows = [{"startMs": a, "endMs": b, "text": G.line(k), "device": None, "entities": [], "visualIntent": G.line(k),
             "queries": [G.line(k), "", ""]} for k, (a, b) in enumerate(zip(starts, starts[1:] + [starts[-1] + ms]))]
    rows[0]["device"] = M._auto_title(G.DOSSIER, "")
    return rows


def measured_film():
    """The planning test's case, its shapes only: the opening gallery on shot 15, a title card on shot 61, a chapter
    proposed on shot 101 at 424.8 s and the shot nearest two-thirds of the film at 436.2 s (658.2 s long)."""
    starts = [k * 4200 for k in range(101)] + [424780, 430500, 436200, 442000]
    while starts[-1] + 4200 < 658180:
        starts.append(starts[-1] + 4200)
    rows = chapter_film(starts)
    rows[-1]["endMs"] = 658180
    rows[15]["device"] = {"id": "gallery-strip"}
    rows[61]["device"] = {"id": "P03", "kicker": "", "headline": "A Card", "highlightWords": ["Card"]}
    return rows


ANSWER = {"chapters": [{"shot": 15, "heading": "The Keeper and the Hall"}, {"shot": 61, "heading": "A Named Gate"},
                       {"shot": 101, "heading": "Curiosity Or Guidance"}], "overlays": []}


class Chapters(unittest.TestCase):
    def setUp(self):
        p = mock.patch.object(M, "TS", {"reasked": {}, "handed": {}, "why": []})
        p.start()
        self.addCleanup(p.stop)

    def fill(self, e, rows):
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        (d / "mrtruth").mkdir()
        M.fill_overlays(e, d, rows, "a made-up script", G.DOSSIER, lambda *a: None)
        return d

    def turns(self, rows):
        return [(r["startMs"], r["device"]["heading"]) for r in rows if (r.get("device") or {}).get("id") == "chapter-plate"]

    def test_the_pre_check_finds_the_measured_case(self):
        rows = measured_film()
        placed, refused = M._chapters_placed(rows, ANSWER, G.DOSSIER, [])
        self.assertEqual(placed, 1)
        self.assertEqual(refused, ["shot 15 at 63 s carries the opening gallery", "shot 61 at 256 s carries the title card"])
        before = copy.deepcopy(rows)
        M._chapters_placed(rows, ANSWER, G.DOSSIER, [])
        self.assertEqual(rows, before)                                    # the rows untouched

    def test_the_pre_check_names_the_opening_and_the_spacing(self):
        rows = chapter_film()
        got = {"chapters": [{"shot": 3, "heading": "Too Soon"}, {"shot": 100, "heading": "Here"},
                            {"shot": 102, "heading": "Too Near"}]}
        placed, refused = M._chapters_placed(rows, got, G.DOSSIER, [])
        self.assertEqual(placed, 1)
        self.assertEqual(refused, ["shot 3 at 13 s is inside the opening 25 s",
                                   "shot 102 at 428 s is 8 s after the chapter before it (they must be at least 30 s apart)"])

    def test_the_measured_case_is_asked_again_with_its_reasons(self):
        rows = measured_film()
        good = {"chapters": [{"shot": 40, "heading": "The Keeper and the Hall"},
                             {"shot": 101, "heading": "Curiosity Or Guidance"}], "overlays": []}
        e = Fake(ts=[json.dumps(ANSWER), json.dumps(good)])
        d = self.fill(e, rows)
        self.assertEqual(e.who(), ["tokensupply", "tokensupply"])
        self.assertIn("Your previous answer's chapters cannot all be placed: shot 15 at 63 s carries the opening gallery; "
                      "shot 61 at 256 s carries the title card. Only 1 can be placed and the film needs 2-3.", e.calls[1][1])
        # the rules themselves and every shot they bar (review 2026-10-14: the brief shows a title card as any other
        # [TAKEN] shot, so a second answer could pick another and be refused again); the brief itself unchanged
        self.assertIn("A chapter never goes on a shot that carries the title card or the opening gallery (here shots 0, "
                      "15, 61), never before 25 s, and never within 30 s of another chapter. Choose the chapters again so "
                      "that at least 2 of them keep these rules.", e.calls[1][1])
        self.assertTrue(e.calls[1][1].startswith(e.calls[0][1].split("\n\nRETURN FORMAT FOR THIS RUN")[0]))
        self.assertEqual([h for _, h in self.turns(rows)], ["The Keeper and the Hall", "Curiosity Or Guidance"])
        self.assertEqual(M.TS["reasked"], {"more overlays": 1})
        self.assertTrue(any(l.startswith("  ⚠ Token Supply's chapters: only 1 of its chapters can be placed: shot 15")
                            and l.endswith("— asking again") for l in e.lines), e.lines)
        # saved under the key the default planner would use for these rows
        d0 = self.fill(Fake(anthropic=[json.dumps(ANSWER)], provider="anthropic"), measured_film())
        saved = lambda j: json.loads((j / "mrtruth" / "overlays_fill.json").read_text(encoding="utf-8"))
        self.assertEqual(saved(d)["key"], saved(d0)["key"])
        self.assertEqual(saved(d)["chapters"], good["chapters"])

    def test_still_short_it_is_anthropics_with_the_brief_as_it_was(self):
        rows = measured_film()
        sonnet = {"chapters": [{"shot": 30, "heading": "First Turn"}, {"shot": 101, "heading": "Second Turn"}],
                  "overlays": []}
        e = Fake(ts=[json.dumps(ANSWER), json.dumps(ANSWER)], anthropic=[json.dumps(sonnet)])
        self.fill(e, rows)
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic"])
        self.assertEqual(e.calls[2][1], e.calls[0][1])
        self.assertEqual([h for _, h in self.turns(rows)], ["First Turn", "Second Turn"])
        self.assertEqual((M.TS["reasked"], M.TS["handed"]), ({"more overlays": 1}, {"more overlays": 1}))

    def test_on_the_default_planner_the_placement_is_as_it_was(self):
        rows = measured_film()
        e = Fake(anthropic=[json.dumps(ANSWER)], provider="anthropic")
        self.fill(e, rows)
        self.assertEqual(e.who(), ["anthropic"])
        self.assertIn("      chapter 'The Keeper and the Hall' at shot 15 skipped (opening, too close, or the title shot)",
                      e.lines)
        self.assertIn("      chapter 'A Named Gate' at shot 61 skipped (opening, too close, or the title shot)", e.lines)
        self.assertIn("      chapter 'Curiosity Or Guidance' at 425s", e.lines)

    def test_a_heading_that_cannot_be_cut_is_logged_as_before(self):
        rows = chapter_film()
        long = "Supercalifragilisticexpialidocious Antidisestablishmentarianism"
        e = Fake(anthropic=[json.dumps({"chapters": [{"shot": 40, "heading": long}], "overlays": []})],
                 provider="anthropic")
        self.fill(e, rows)
        self.assertIn(f"      chapter '{long}' skipped (no whole heading of it fits)", e.lines)
        placed, refused = M._chapters_placed(chapter_film(), {"chapters": [{"shot": 40, "heading": long}]}, G.DOSSIER, [])
        self.assertEqual(placed, 0)
        self.assertEqual(refused, [f"shot 40 at 168 s has a heading, '{long}', with no whole form of 25 characters or "
                                   f"fewer"])

    # ── E2: the fill-in keeps the chapters' spacing, on every planner ──
    def test_the_fill_in_is_never_within_30_s_of_another_chapter(self):
        rows = measured_film()
        e = Fake(anthropic=[json.dumps(ANSWER)], provider="anthropic")
        self.fill(e, rows)
        turns = self.turns(rows)
        self.assertEqual(len(turns), 2)
        self.assertEqual(turns[0][0], 424780)                            # the planned one, at 425 s
        self.assertGreaterEqual(turns[1][0] - turns[0][0], 30000, turns)  # was 436.2 s, 11 s after it
        self.assertNotEqual(turns[1][0], 436200)
        self.assertTrue(any(l.endswith("(filled)") for l in e.lines))
        # the nearest such shot to two-thirds of the film (438.8 s): the first one 30 s after 424.8 s
        self.assertEqual(turns[1][0], min(r["startMs"] for r in rows if r["startMs"] >= 454780))

    def test_where_no_shot_keeps_the_spacing_the_fill_in_is_as_before(self):
        """A 60-s film has room for one spaced chapter only: spacing the first (28 s, past the opening) would leave the
        second none and put it 12 s after it (review 2026-10-14), so both are filled as e8ef33b fills them."""
        rows = chapter_film(n=15, ms=4000)
        e = Fake(anthropic=[json.dumps({"chapters": [], "overlays": []})], provider="anthropic")
        self.fill(e, rows)
        self.assertEqual([a for a, _ in self.turns(rows)], [20000, 40000])  # 2-3 chapters are mandatory; 20 s apart
        self.assertEqual(sum(l.endswith("(filled)") for l in e.lines), 2)    # the try on the copy said nothing

    def test_two_filled_chapters_are_30_s_apart(self):
        """E2 between two filled chapters, not only after a planned one: each target reads the chapters filled before it
        (a 76-s film, no chapter of Claude's: 28 s and 60 s; spaced from planned ones only, 52 s was 24 s after 28 s)."""
        rows = chapter_film(n=19, ms=4000)
        e = Fake(anthropic=[json.dumps({"chapters": [], "overlays": []})], provider="anthropic")
        self.fill(e, rows)
        self.assertEqual([a for a, _ in self.turns(rows)], [28000, 60000])

    def test_anthropics_chapters_are_kept_whatever_can_be_placed(self):
        """Anthropic's answer is the baseline: never held to the pre-check, never a fourth call; the placement then
        does with it what it does on today's planner (two skips, a chapter filled 30 s or more from 425 s)."""
        rows = measured_film()
        sonnet = {"chapters": [{"shot": 15, "heading": "The Keeper and the Hall"}, {"shot": 61, "heading": "A Named Gate"},
                               {"shot": 101, "heading": "Anthropic's Own Turn"}], "overlays": []}   # one placeable too
        e = Fake(ts=[json.dumps(ANSWER), json.dumps(ANSWER)], anthropic=[json.dumps(sonnet)])
        d = self.fill(e, rows)
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic"])
        saved = json.loads((d / "mrtruth" / "overlays_fill.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["chapters"], sonnet["chapters"])
        self.assertEqual(sum("skipped (opening, too close, or the title shot)" in l for l in e.lines), 2)
        turns = self.turns(rows)
        self.assertEqual(turns[0], (424780, "Anthropic's Own Turn"))
        self.assertGreaterEqual(turns[1][0] - turns[0][0], 30000)


# ── the other steps that hand Token Supply's answer to Anthropic ─────────────────────────────────────────────────────
def scenes_for(prompt):
    """A shot answer for the focus range named in the prompt: a scene on every second line of it."""
    f0, f1 = (int(x) for x in re.search(r"FOCUS RANGE: (\d+)ms to (\d+)ms", prompt).groups())
    starts = [int(a) for a, b in re.findall(r"^> \[(\d+)-(\d+)\]", prompt, re.M)][::2]
    return json.dumps({"scenes": [{"startMs": a, "visualIntent": f"picture {a}", "queries": [f"q{a}", "", ""],
                                   "entities": [], "mood": "dark", "sceneType": "imagery"} for a in starts if f0 <= a < f1]})


class Steps(unittest.TestCase):
    def setUp(self):
        p = mock.patch.object(M, "TS", {"reasked": {}, "handed": {}, "why": []})
        p.start()
        self.addCleanup(p.stop)
        self.job = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.job, ignore_errors=True)
        (self.job / "mrtruth").mkdir()

    def test_a_brief_without_its_tone_is_asked_of_anthropic(self):
        e = Fake(ts=['{"people": []}'], anthropic=['{"tone": "a cold archive", "people": []}'])
        self.assertEqual(M.visual_brief(e, self.job, "a made-up script", G.DOSSIER)["tone"], "a cold archive")
        self.assertEqual(e.who(), ["tokensupply", "anthropic"])
        self.assertEqual(M.TS["handed"], {"visual brief": 1})
        self.assertIn("  ⚠ Token Supply's answer to visual brief could not be used (no tone or no people list in it) — "
                      "asking Anthropic", e.lines)
        e = Fake(anthropic=['{"people": []}', '{"tone": "a cold archive", "people": []}'], provider="anthropic")
        shutil.rmtree(self.job / "mrtruth")
        self.assertEqual(M.visual_brief(e, self.job, "a made-up script", G.DOSSIER)["tone"], "a cold archive")
        self.assertEqual(e.who(), ["anthropic", "anthropic"])               # the default planner: as before
        self.assertFalse(any("Token Supply" in l for l in e.lines))

    def shots(self, e):
        cues = [(t, t + 1900, f"{G.word(t // 2000, 0).capitalize()} {G.word(t // 2000, 1)} went on.")
                for t in range(0, 100000, 2000)]
        ts = lambda ms: f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
        (self.job / "subs.srt").write_text("\n\n".join(f"{k + 1}\n{ts(a)} --> {ts(b)}\n{t}" for k, (a, b, t) in
                                                        enumerate(cues)) + "\n", encoding="utf-8")
        e._parse_srt_full = MV._parse_srt_full
        with mock.patch.object(M, "_stop", lambda eng, why: None):
            return M.beats(e, self.job, self.job / "subs.srt", "a made-up script", G.DOSSIER)

    def test_a_part_it_answered_empty_twice_is_anthropics_in_halves(self):
        e = Fake(ts=['{"scenes": []}', '{"scenes": []}'], anthropic=[scenes_for, scenes_for])
        rows = self.shots(e)
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic", "anthropic"])
        self.assertTrue(rows and not any(r.get("unplanned") for r in rows))
        self.assertEqual(M.TS["handed"], {"shots": 1})
        self.assertTrue(any("could not be used (empty or starting late twice) — asking Anthropic, in two halves" in l
                            for l in e.lines), e.lines)
        e = Fake(anthropic=['{"scenes": []}', '{"scenes": []}', scenes_for, scenes_for], provider="anthropic")
        (self.job / "mrtruth" / "beats.json").unlink()                      # planned anew
        self.shots(e)
        self.assertEqual(e.who(), ["anthropic"] * 4)                         # the default planner: as before
        self.assertFalse(any("Token Supply" in l for l in e.lines))

    def test_a_part_anthropic_answered_empty_twice_is_not_blamed_on_token_supply(self):
        """Review 2026-10-14: Token Supply off (or answered by Anthropic in its place inside make_video), the two empty
        answers were Anthropic's, yet the log blamed Token Supply and the planner line counted a hand-over."""
        class FellBack(Fake):
            def claude_was_tokensupply(self):
                return False
        e = FellBack(ts=['{"scenes": []}', '{"scenes": []}'], anthropic=[scenes_for, scenes_for])
        rows = self.shots(e)
        self.assertTrue(rows and not any(r.get("unplanned") for r in rows))
        self.assertEqual(e.who(), ["tokensupply", "tokensupply", "anthropic", "anthropic"])   # the halves as before
        self.assertEqual(M.TS["handed"], {})
        self.assertFalse(any("Token Supply's answer to shots" in l for l in e.lines), e.lines)

    def test_with_the_engine_switched_off_nothing_is_blamed_on_it(self):
        """The same through make_video: Token Supply switched off (a refused key), every answer is Anthropic's."""
        class E(Engine):
            def runTest(self):
                pass
        t = E()
        t.setUp()
        try:
            t.stats["off"] = 'tokensupply HTTP 401: {"error":"unauthorized"}'
            net = t.net(anthropic=[ok('{"scenes": []}'), ok('{"scenes": []}'), ok(lambda p: scenes_for(
                p["messages"][0]["content"])), ok(lambda p: scenes_for(p["messages"][0]["content"]))])
            e = MV
            with mock.patch.object(MV, "UTILITY_MODEL", SONNET):
                rows = self.shots(e)
            self.assertTrue(rows)
            self.assertEqual({s["url"] for s in net.sent}, {AN_URL})
            self.assertEqual((M.TS["handed"], t.stats["calls"]), ({}, 0))
            self.assertFalse(any("Token Supply's answer to shots" in l for l in t.lines), t.lines)
            self.assertNotIn("handed to Anthropic: shots", M._ts_line(MV))
        finally:
            t.doCleanups()

    def run_preflight(self, provider):
        sent = []

        class R:
            def __init__(self, status, text, data):
                self.status_code, self.text, self._data, self.ok = status, text, data, status < 400

            def json(self):
                return self._data

        def post(url, **kw):
            sent.append(url)
            if "anthropic.com" in url:
                return R(402, '{"error": {"message": "Your credit balance is too low"}}',
                         {"error": {"message": "Your credit balance is too low"}})
            return R(200, "{}", {})
        env = {"GEMINI_API_KEY": "g-made-up", "ANTHROPIC_API_KEY": AN_KEY, "WAVESPEED_API_KEY": "",
               "BRAVE_SEARCH_API_KEY": "b-made-up", "MRTRUTH_ALLOW_DEGRADED": "0", "CLAUDE_PROVIDER": provider,
               "TOKENSUPPLY_API_KEY": TS_KEY}
        with mock.patch.dict(os.environ, env), mock.patch("requests.get", lambda url, **kw: R(200, "{}", {})), \
                mock.patch("requests.post", post):
            try:
                M.preflight(H.Claude())
                return "ran", sent
            except M.OutOfCredit as x:
                return str(x), sent

    def test_preflight_checks_anthropic_for_its_planner_too_and_never_pings_it(self):
        for provider in ("tokensupply", "anthropic"):
            got, sent = self.run_preflight(provider)
            self.assertIn("Claude (Anthropic API): Your credit balance is too low", got, provider)
            self.assertIn(AN_URL, sent)
            self.assertFalse([u for u in sent if "token-supply" in u], provider)
        got, sent = self.run_preflight("kie")
        self.assertEqual(got, "ran")
        self.assertNotIn(AN_URL, sent)


# ── the planner's line and its record ────────────────────────────────────────────────────────────────────────────────
class Record(Engine):
    def fill(self):
        self.stats.update(calls=12, fell_back=1, off="")
        self.spend["calls"] = 15
        self.spend["models"].update({"claude-sonnet-5 (Token Supply)": {"in": 1, "out": 1, "cache_read": 0,
                                                                         "cache_write": 0, "calls": 12},
                                     SONNET: {"in": 1, "out": 1, "cache_read": 0, "cache_write": 0}})
        M.TS["reasked"].update({"templates": 1, "research dossier": 1})
        M.TS["handed"].update({"more overlays": 1})

    def test_timing_json_carries_it(self):
        self.fill()
        got = M._usage(MV)["planner"]
        self.assertEqual({k: got[k] for k in ("planner", "ts_calls", "anthropic_calls", "reasked", "handed", "fell_back",
                                               "off")},
                         {"planner": "ts", "ts_calls": 12, "anthropic_calls": 3,
                          "reasked": {"templates": 1, "research dossier": 1}, "handed": {"more overlays": 1},
                          "fell_back": 1, "off": ""})
        json.dumps(got)

    def test_the_line(self):
        self.fill()
        line = M._ts_line(MV)
        self.assertEqual(line, "  planner (ts): Token Supply answered 12 of 15 Claude calls; asked again on Token Supply: "
                               "research dossier 1, templates 1; handed to Anthropic: more overlays 1; highlighted "
                               "pages: Anthropic")
        self.assertTrue(re.search(r"planner \(\w+\): .*", line))         # as the pod's summary finds it
        self.stats["off"] = "tokensupply HTTP 402: {}"
        self.assertTrue(M._ts_line(MV).endswith("; highlighted pages: Anthropic; Token Supply turned off: "
                                                "tokensupply HTTP 402: {}"))
        M.TS["reasked"].clear()
        M.TS["handed"].clear()
        self.assertIn("asked again on Token Supply: none; handed to Anthropic: none;", M._ts_line(MV))

    def test_the_websites_readers_read_the_engines_own_lines(self):
        """Review 2026-10-14: the website's cost split and its "Token Supply was off" note, and the pod's summary, were
        tested on hand-typed lines only. Here they read the lines make_video and mrtruth write: one call Token Supply
        answers, one it cannot (500), one refused (401: off for the rest of the run), each of the last two answered by
        Anthropic."""
        from web.jobs import Studio
        with mock.patch.object(MV, "TOKENSUPPLY_RETRY_SECONDS", 0):
            self.net(ts=[ok('{"a": 1}', usage={"input_tokens": 100000}, out=20000), err(500),     # $0.12 of it
                         err(401, '{"error":"unauthorized"}')], anthropic=[ok('{"b": 2}', out=40000)])   # $0.40 each
            for k in range(3):
                MV.claude(f"p{k}", SONNET, 1000)
        self.assertTrue(self.stats["off"].startswith("tokensupply HTTP 401"))
        M.TS["reasked"].update({"templates": 1})
        M.TS["handed"].update({"research dossier": 1})
        logged = lambda msg: f"  {msg}"                                   # as make_video.log writes a line
        lines = [logged(M._ts_line(MV)), logged(f"Claude this run: {MV.claude_spend_line()}"),
                 logged(MV.tokensupply_spend_line())]
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        log = ("\n".join(["  other line"] + lines) + "\n").encode("utf-8")
        with tarfile.open(d / "r.tgz", "w:gz") as t:
            info = tarfile.TarInfo("plan.log")
            info.size = len(log)
            t.addfile(info, io.BytesIO(log))
        total = float(re.search(r"= \$([\d.]+)", MV.claude_spend_line()).group(1))
        ts = float(re.search(r"Token Supply this run: \$([\d.]+)", MV.tokensupply_spend_line()).group(1))
        self.assertGreater(ts, 0)
        cost = Studio.costs(d / "r.tgz")
        self.assertEqual(cost, {"claude": round(round(total, 2) - round(ts, 2), 2), "token_supply": round(ts, 2),
                                "token_supply_off": self.stats["off"][:200]})
        # the pod's summary.json: the planner's record from timing.json, and the three lines as written
        work = d / "work"
        work.mkdir()
        (work / "shots.json").write_text("[]")
        (work / "timing.json").write_text(json.dumps({"plan": 1.0, "detail": M._usage(MV)}, default=str))
        (d / "plan.log").write_bytes(log)
        r = subprocess.run([sys.executable, str(HERE / "web" / "pod" / "summarize.py"), str(work), str(d / "plan.log"),
                            str(d / "summary.json")], cwd=d, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        got = json.loads((d / "summary.json").read_text())
        self.assertEqual(got["planner"], json.loads(json.dumps(M._usage(MV)["planner"])))
        self.assertEqual((got["planner_line"], got["claude_line"], got["token_supply_line"]),
                         tuple(l.strip() for l in lines))
        self.assertIn("Token Supply turned off: tokensupply HTTP 401", got["planner_line"])

    def test_the_default_planner_writes_neither(self):
        with mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):
            self.assertNotIn("planner", M._usage(MV))
        src = inspect.getsource(M.plan_film)
        self.assertIn("if _ts_planner(engine):", src)
        self.assertIn("engine.log(_ts_line(engine))", src)


class Wiring(unittest.TestCase):
    def test_the_cache_keys_are_as_they_were(self):
        self.assertIn("key = _hash([prompt])", inspect.getsource(M.opportunities))
        self.assertIn("key = _hash([prompt])", inspect.getsource(M.fill_overlays))
        self.assertIn("key = _hash([HL_V, prompt])", inspect.getsource(M.highlight_pages))

    def test_the_rules_and_the_example_settings_say_so(self):
        rules = (HERE / "MR_TRUTH_RULES.md").read_text(encoding="utf-8")
        self.assertIn("Token Supply", rules)
        env = (HERE / ".env.example").read_text(encoding="utf-8")
        for k in ("CLAUDE_PROVIDER=tokensupply", "TOKENSUPPLY_API_KEY=", "TOKENSUPPLY_RETRY_SECONDS"):
            self.assertIn(k, env)


if __name__ == "__main__":
    unittest.main()
