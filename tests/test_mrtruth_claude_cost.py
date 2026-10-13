"""Mr Truth: the Claude bill without a change of model (2026-10-13) - synthetic data only, no paid call:
  - the shot step's parts share a head (brief, script, <film> block) that Anthropic keeps in its prompt cache: marked
    on that block only, sent to Anthropic only, every other provider (one added later too) gets head and part as one
    string; the search rules stay after the transcript; the first part goes alone until its answer streams, then the
    others (a local fake streaming server stands in for the API); on a timeout or a failure they go anyway
  - archive names: the same head when there is more than one part
  - cache reads and writes are priced as such (1.25x to write, a tenth to read) in the log line, timing.json and the
    website's and the farm's readers of that line
  - the shot answers carry no transcript text and no endMs (beats() writes both)
  - an answer cut off at max_tokens is asked again once with more room, and only for a step that names itself: the
    highlighted-page step is asked again as before; a runaway shot part costs no more than before
  - a model that thinks through all of max_tokens is asked again at once with more room; an error event part-way
    through a stream is asked again like a network error

    .venv/bin/python -m unittest tests.test_mrtruth_claude_cost -v
"""
import io
import json
import os
import re
import shutil
import sys
import tarfile
import inspect
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import make_video as MV  # noqa: E402
import mrtruth as M  # noqa: E402

WORDS = ("amber basin cedar delta ember fable garnet harbor island juniper kettle lantern meadow nectar orchard pebble "
         "quarry raven saddle timber umber valley willow yonder zephyr").split()
DOSSIER = {"topic": "the lost library", "period": "4th century", "setting": "Alexandria",
           "visualBrief": {"tone": "dark", "motifs": [{"idea": "memory", "web": "scholar reading codex"}]}}


def narration(seconds):
    """One subtitle line every 2 s: (startMs, endMs, words)."""
    return [(t, t + 1900, " ".join(WORDS[(k + j) % len(WORDS)] for j in range(4)).capitalize() + ".")
            for k, t in enumerate(range(0, seconds * 1000, 2000))]


def job_with(cues):
    d = Path(tempfile.mkdtemp())
    (d / "mrtruth").mkdir()
    ts = lambda ms: f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    (d / "subs.srt").write_text("\n\n".join(f"{k + 1}\n{ts(a)} --> {ts(b)}\n{t}" for k, (a, b, t) in enumerate(cues))
                                + "\n", encoding="utf-8")
    return d


def scenes_for(text):
    """A shot answer for the focus range named in the prompt: a scene on every second line of it, without the text and
    endMs fields."""
    f0, f1 = (int(x) for x in re.search(r"FOCUS RANGE: (\d+)ms to (\d+)ms", text).groups())
    starts = [int(a) for a, b in re.findall(r"^> \[(\d+)-(\d+)\]", text, re.M)][::2]
    return {"scenes": [{"startMs": a, "visualIntent": f"picture {a}", "queries": [f"q{a}", f"c{a}", f"m{a}"],
                        "entities": [], "mood": "dark", "sceneType": "imagery"} for a in starts if f0 <= a < f1]}


def sse(ev):
    return f"event: {ev['type']}\ndata: {json.dumps(ev)}\n\n".encode()


def stream(text, usage=None, stop="end_turn", model="claude-sonnet-5"):
    """The events of one streamed Anthropic answer."""
    u = dict(usage or {"input_tokens": 100})
    return [sse({"type": "message_start", "message": {"model": model, "usage": u}}),
            sse({"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}),
            sse({"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}}),
            sse({"type": "content_block_stop", "index": 0}),
            sse({"type": "message_delta", "delta": {"stop_reason": stop}, "usage": {"output_tokens": 300}}),
            sse({"type": "message_stop"})]


def thought_only(stop="max_tokens"):
    """An answer that thought through all of max_tokens and wrote no text."""
    return [sse({"type": "message_start", "message": {"model": "claude-sonnet-5-5", "usage": {"input_tokens": 100}}}),
            sse({"type": "content_block_start", "index": 0, "content_block": {"type": "thinking", "thinking": ""}}),
            sse({"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "hmm"}}),
            sse({"type": "content_block_stop", "index": 0}),
            sse({"type": "message_delta", "delta": {"stop_reason": stop}, "usage": {"output_tokens": 8000}}),
            sse({"type": "message_stop"})]


def broken_off():
    """A stream that begins an answer and then reports an error (overloaded part-way through)."""
    return stream('{"scenes": [')[:3] + [sse({"type": "error", "error": {"type": "overloaded_error",
                                                                          "message": "Overloaded"}})]


class FakeResponse:
    """requests' streamed response, enough for _read_sse_text."""
    status_code = 200
    text = ""

    def __init__(self, chunks):
        self.chunks = chunks

    def iter_lines(self, decode_unicode=False):
        for c in self.chunks:
            yield from c.decode().splitlines()


class FakeAPI:
    """A local stand-in for api.anthropic.com/v1/messages that streams like it (chunked SSE). The part whose focus range
    starts at 0 waits `hold` s before its first content event and `rest` s more before it finishes."""

    def __init__(self, hold=0.4, rest=1.2):
        self.hold, self.rest, self.seen, self.marks = hold, rest, [], {}
        api = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *a):
                pass

            def chunk(self, data):
                self.wfile.write(b"%x\r\n%s\r\n" % (len(data), data))
                self.wfile.flush()

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                at = time.time()
                content = body["messages"][0]["content"]
                last = content[-1]["text"] if isinstance(content, list) else content
                first = "FOCUS RANGE: 0ms" in last
                api.seen.append((at, first, body))
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Transfer-Encoding", "chunked")
                self.send_header("Connection", "close")
                self.end_headers()
                cached = isinstance(content, list)
                usage = {"input_tokens": 500, "cache_creation_input_tokens": 9000 if cached and first else 0,
                         "cache_read_input_tokens": 9000 if cached and not first else 0}
                events = stream(json.dumps(scenes_for(last)), usage)
                self.chunk(events[0])
                if first:
                    time.sleep(api.hold)
                    api.marks["first_content"] = time.time()
                self.chunk(events[1])
                self.chunk(events[2])
                if first:
                    time.sleep(api.rest)
                    api.marks["first_done"] = time.time()
                for e in events[3:]:
                    self.chunk(e)
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/v1/messages"

    def close(self):
        self.server.shutdown()
        self.server.server_close()


class Spend(unittest.TestCase):
    """Every test starts from an empty bill and leaves the engine's own as it was."""

    def setUp(self):
        self.spend = {"in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "usd": 0.0, "calls": 0, "models": {}}
        self.lines = []
        for p in (mock.patch.object(MV, "CLAUDE_SPEND", self.spend), mock.patch.object(MV, "log", self.lines.append),
                  mock.patch.dict(os.environ, {"NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"})):
            p.start()
            self.addCleanup(p.stop)


# ── the request ──────────────────────────────────────────────────────────────────────────────────────────────────────
class RequestShape(Spend):
    def send(self, provider, head):
        sent = []

        def post(url, headers=None, json=None, **kw):
            sent.append(json)
            return FakeResponse(stream('{"ok": 1}'))
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV.requests, "post", post):
            self.assertEqual(MV._claude_try(provider, "claude-sonnet-5", "THE PART", 1000, 60, head), '{"ok": 1}')
        return sent[0]

    def test_the_head_is_one_cached_block_for_anthropic_only(self):
        p = self.send("anthropic", "THE SHARED HEAD\n\n")
        self.assertEqual(p["messages"][0]["content"],
                         [{"type": "text", "text": "THE SHARED HEAD\n\n", "cache_control": {"type": "ephemeral"}},
                          {"type": "text", "text": "THE PART"}])
        self.assertEqual(p["thinking"], {"type": "disabled"})
        self.assertNotIn("cache_control", p)                          # no automatic caching of the whole prompt

    def test_kie_gets_the_same_words_as_one_string(self):
        p = self.send("kie", "THE SHARED HEAD\n\n")
        self.assertEqual(p["messages"][0]["content"], "THE SHARED HEAD\n\nTHE PART")
        self.assertNotIn("cache_control", json.dumps(p))
        self.assertNotIn("thinking", p)

    def test_without_a_head_the_request_is_as_before(self):
        p = self.send("anthropic", "")
        self.assertEqual(p["messages"][0]["content"], "THE PART")
        self.assertNotIn("cache_control", json.dumps(p))

    def test_the_cli_providers_get_one_string(self):
        got = {}
        with mock.patch.object(MV, "_claude_code_try", lambda model, prompt, n: got.setdefault("cc", prompt)), \
                mock.patch.object(MV.codex_cli, "run", lambda prompt, model=None: got.setdefault("codex", prompt)):
            MV._claude_try("claudecode", "m", "THE PART", 100, 60, "HEAD ")
            MV._claude_try("codex", "m", "THE PART", 100, 60, "HEAD ")
        self.assertEqual(got, {"cc": "HEAD THE PART", "codex": "HEAD THE PART"})

    def test_every_other_provider_gets_head_and_part_as_one_prompt(self):
        """To every provider but Anthropic, one added later included (a branch that builds its own request from
        `prompt`, as OpenRouter's does), a call with a head is the same call with the head written before the part."""
        class Sent(Exception):
            pass

        def request(provider, prompt, head):
            got = []

            def post(url, headers=None, json=None, **kw):
                got.append(json)
                raise Sent
            with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                    mock.patch.object(MV.requests, "post", post), \
                    mock.patch.object(MV, "_claude_code_try", lambda model, prompt, n: got.append(prompt) or "{}"), \
                    mock.patch.object(MV.codex_cli, "run", lambda prompt, model=None: got.append(prompt) or "{}"):
                try:
                    MV._claude_try(provider, "claude-sonnet-5", prompt, 1000, 60, head)
                except Sent:
                    pass
            self.assertEqual(len(got), 1, provider)
            return got[0]
        for provider in ("kie", "openrouter", "claudecode", "codex", "a-provider-added-later"):
            sent = request(provider, "THE PART", "THE SHARED HEAD ")
            self.assertEqual(sent, request(provider, "THE SHARED HEAD THE PART", ""), provider)
            self.assertIn("THE SHARED HEAD THE PART", json.dumps(sent), provider)
            self.assertNotIn("cache_control", json.dumps(sent), provider)
        self.assertIsInstance(request("anthropic", "THE PART", "THE SHARED HEAD ")["messages"][0]["content"], list)

    def test_only_anthropic_is_said_to_cache(self):
        ep = lambda p: ("u", {}) if p in ("anthropic", "kie") else None
        with mock.patch.object(MV, "_claude_endpoint", ep):
            for provider, dead, want in (("anthropic", set(), True), ("kie", set(), False), ("claudecode", set(), False),
                                         ("codex", set(), False), ("claudecode", {"claudecode"}, True)):
                with mock.patch.object(MV, "CLAUDE_PROVIDER", provider), mock.patch.object(MV, "CLAUDE_FALLBACK", "anthropic"), \
                        mock.patch.object(MV, "_DEAD_PROVIDERS", dead):
                    self.assertEqual(MV.claude_caches(), want, (provider, dead))
        with mock.patch.object(MV, "_claude_endpoint", lambda p: None), mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"):
            self.assertFalse(MV.claude_caches())                       # no key


# ── the shot step's order: the first part alone until its answer streams ───────────────────────────────────────────
class StartOrder(Spend):
    def run_beats(self, provider="anthropic", seconds=300, **api):
        fake = FakeAPI(**api)
        self.addCleanup(fake.close)
        job = job_with(narration(seconds))
        self.addCleanup(shutil.rmtree, job, ignore_errors=True)
        with mock.patch.object(MV, "_claude_endpoint", lambda p: (fake.url, {"content-type": "application/json"})), \
                mock.patch.object(MV, "CLAUDE_PROVIDER", provider), mock.patch.object(MV, "_DEAD_PROVIDERS", set()), \
                mock.patch.object(MV, "UTILITY_MODEL", "claude-sonnet-5"):
            rows = M.beats(MV, job, job / "subs.srt", "The script of the lost library.", DOSSIER)
        return fake, rows

    def test_the_others_start_once_the_first_answer_streams_and_before_it_ends(self):
        fake, rows = self.run_beats()
        self.assertEqual(len(fake.seen), 3)                              # 0-120 s, 120-240 s, 240-300 s
        (t1, first, _), others = fake.seen[0], fake.seen[1:]
        self.assertTrue(first)
        for at, is_first, _ in others:
            self.assertFalse(is_first)
            self.assertGreaterEqual(at, fake.marks["first_content"])    # after the first part's first content event
            self.assertLess(at, fake.marks["first_done"])               # and long before it is done
        self.assertLess(others[-1][0] - fake.marks["first_content"], 0.5)
        self.assertTrue(any("the first part began answering after" in l for l in self.lines), self.lines)
        # the shared head: the first block of every part, the same bytes, the only one marked for the cache
        blocks = [b["messages"][0]["content"] for _, _, b in fake.seen]
        self.assertTrue(all(len(c) == 2 for c in blocks))
        self.assertEqual(len({c[0]["text"] for c in blocks}), 1)
        self.assertTrue(all(c[0]["cache_control"] == {"type": "ephemeral"} and "cache_control" not in c[1] for c in blocks))
        head = blocks[0][0]["text"]
        for want in ("documentary picture editor", "The script of the lost library.", "<film>"):
            self.assertIn(want, head)
        self.assertNotIn("FOCUS RANGE: ", head)                          # the brief names it; the part says it
        self.assertNotIn("> [", head)
        self.assertNotIn("THIS CHANNEL'S SEARCH RULES", head)              # after the transcript, as before
        self.assertTrue(all(c[1]["text"].startswith("TRANSCRIPT (authoritative") for c in blocks))
        self.assertTrue(all("THIS CHANNEL'S SEARCH RULES" in c[1]["text"] for c in blocks))
        # the bill: one write of the head, two reads of it
        self.assertEqual((self.spend["cache_write"], self.spend["cache_read"], self.spend["in"]), (9000, 18000, 28500))
        want = (3 * 500 + 9000 * 1.25 + 18000 * 0.1) / 1e6 * 2.0 + 3 * 300 / 1e6 * 10.0
        self.assertAlmostEqual(self.spend["usd"], want, places=9)
        # the rows: the words come from the subtitles, every shot ends where the next begins
        self.assertTrue(rows and all(r["text"] for r in rows))
        self.assertTrue(all(a["endMs"] == b["startMs"] for a, b in zip(rows, rows[1:])))

    def test_a_first_part_that_has_not_begun_in_time_does_not_hold_the_others(self):
        with mock.patch.object(M, "CACHE_WAIT_S", 0.3):
            fake, rows = self.run_beats(hold=1.5, rest=0.2)
        t1 = fake.seen[0][0]
        for at, _, _ in fake.seen[1:]:
            self.assertGreaterEqual(at - t1, 0.25)
            self.assertLess(at, fake.marks["first_content"])            # it had still not begun
        self.assertTrue(any("has not begun answering after 0s" in l for l in self.lines), self.lines)
        self.assertTrue(rows)

    def test_another_provider_starts_every_part_at_once_with_plain_text(self):
        fake, rows = self.run_beats(provider="kie", hold=0.8, rest=0.2)
        self.assertEqual(len(fake.seen), 3)
        self.assertTrue(all(at < fake.marks["first_content"] for at, _, _ in fake.seen))
        self.assertTrue(all(isinstance(b["messages"][0]["content"], str) for _, _, b in fake.seen))
        self.assertNotIn("cache_control", json.dumps([b for _, _, b in fake.seen]))
        self.assertFalse(any("began answering" in l or "not begun" in l for l in self.lines))

    def test_one_part_sends_no_head(self):
        fake, rows = self.run_beats(seconds=60, hold=0.0, rest=0.0)
        self.assertEqual(len(fake.seen), 1)
        self.assertIsInstance(fake.seen[0][2]["messages"][0]["content"], str)
        self.assertEqual((self.spend["cache_write"], self.spend["cache_read"]), (0, 0))


class FailedFirstPart(unittest.TestCase):
    def test_a_failed_first_call_lets_the_others_go_at_once(self):
        starts, lock = [], threading.Lock()

        class Engine:
            UTILITY_MODEL = SCRIPT_MODEL = "claude-sonnet-5"
            _parse_srt_full = staticmethod(MV._parse_srt_full)
            failed = {}

            def log(self, s):
                pass

            def claude_caches(self):
                return True

            def claude(self, prompt, model, max_tokens=0, head="", begun=None):
                first = "FOCUS RANGE: 0ms" in prompt
                with lock:
                    starts.append((time.time(), first))
                if first and not self.failed:
                    time.sleep(0.2)
                    self.failed["at"] = time.time()
                    raise RuntimeError("overloaded")
                return json.dumps(scenes_for(prompt))
        e = Engine()
        job = job_with(narration(300))
        self.addCleanup(shutil.rmtree, job, ignore_errors=True)
        with mock.patch.object(M, "CACHE_WAIT_S", 5.0):
            t0 = time.time()
            rows = M.beats(e, job, job / "subs.srt", "a script", DOSSIER)
        others = [t for t, first in starts if not first]
        self.assertEqual(len(others), 2)
        self.assertTrue(all(t >= e.failed["at"] for t in others))
        self.assertLess(max(others) - t0, 2.0)                           # never the 5 s wait
        self.assertTrue(rows)


# ── archive names: the same head in every part ──────────────────────────────────────────────────────────────────────
class ArchiveNames(unittest.TestCase):
    def names(self, n):
        rows = [{"text": f"shot {i} " + WORDS[i % len(WORDS)], "queries": ["q"], "entities": []} for i in range(n)]
        calls = []

        class Engine:
            UTILITY_MODEL = "claude-sonnet-5"

            def log(self, s):
                pass

            def claude(self, prompt, model, max_tokens=0, **kw):
                calls.append((kw.get("head", ""), prompt))
                idx = [int(x) for x in re.findall(r'<shot index="(\d+)">', prompt)]
                return json.dumps({"names": [{"index": i, "name": f"Name {i}"} for i in idx]})
        with tempfile.TemporaryDirectory() as d:
            M.archive_names(Engine(), Path(d), rows, DOSSIER)
        return rows, calls

    def test_three_parts_share_one_head_and_say_the_same_words_as_before(self):
        rows, calls = self.names(130)
        self.assertEqual(len(calls), 3)
        self.assertEqual(len({h for h, _ in calls}), 1)
        head = calls[0][0]
        self.assertEqual(head, M._prompts()["archive_names"] + "\n" + M._film_block(DOSSIER) + "\n\n")
        self.assertEqual(rows[65]["archive"], "Name 65")

    def test_one_part_sends_no_head(self):
        rows, calls = self.names(50)
        self.assertEqual([h for h, _ in calls], [""])
        self.assertTrue(calls[0][1].startswith(M._prompts()["archive_names"]))


# ── what it costs ───────────────────────────────────────────────────────────────────────────────────────────────────
class Cost(Spend):
    def test_cache_writes_cost_a_quarter_more_and_reads_a_tenth(self):
        MV._count_tokens("claude-sonnet-5", 10000, 1000, read=8000)
        self.assertAlmostEqual(self.spend["usd"], (2000 + 800) / 1e6 * 2 + 1000 / 1e6 * 10, places=12)
        MV._count_tokens("claude-sonnet-5", 10000, 0, wrote=8000)
        self.assertAlmostEqual(self.spend["usd"], 0.0156 + (2000 + 10000) / 1e6 * 2, places=12)
        self.assertEqual((self.spend["in"], self.spend["cache_read"], self.spend["cache_write"]), (20000, 8000, 8000))
        self.assertEqual(self.spend["models"]["claude-sonnet-5"]["cache_read"], 8000)

    def test_the_cache_counts_are_passed_by_name_only(self):
        """A fifth figure passed by position (another branch's reasoning tokens) is refused, never billed as a read."""
        with self.assertRaises(TypeError):
            MV._count_tokens("claude-sonnet-5", 1000, 100, None, 400)
        self.assertEqual(self.spend["calls"], 0)

    def test_sonnet_5_5_reads_at_a_twentieth(self):
        MV._count_tokens("claude-sonnet-5-5", 10000, 0, read=10000)
        self.assertAlmostEqual(self.spend["usd"], 500 / 1e6 * 2, places=12)

    def test_no_cache_costs_as_before(self):
        MV._count_tokens("claude-sonnet-5", 186677, 61620)
        self.assertAlmostEqual(self.spend["usd"], 0.989554, places=6)        # the 11-minute film's measured bill

    def test_the_stream_counts_the_cache_once(self):
        u = {"input_tokens": 400, "cache_read_input_tokens": 9000, "cache_creation_input_tokens": 0}
        chunks = stream("{}", u)
        # the API may repeat the whole usage in message_delta: still counted once
        chunks[4] = sse({"type": "message_delta", "delta": {"stop_reason": "end_turn"},
                         "usage": dict(u, output_tokens=250)})
        MV._read_sse_text(FakeResponse(chunks))
        self.assertEqual((self.spend["in"], self.spend["out"], self.spend["cache_read"], self.spend["calls"]),
                         (9400, 250, 9000, 1))
        self.assertAlmostEqual(self.spend["usd"], (400 + 900) / 1e6 * 2 + 250 / 1e6 * 10, places=12)

    def test_the_cli_reply_counts_its_cache_and_keeps_its_own_dollars(self):
        out = json.dumps({"result": "ok", "total_cost_usd": 0.0123, "usage": {
            "input_tokens": 10, "cache_read_input_tokens": 5000, "cache_creation_input_tokens": 700, "output_tokens": 9}})
        self.assertEqual(MV._cc_result("claude-sonnet-5", out, "a prompt"), (True, "ok"))
        self.assertEqual((self.spend["in"], self.spend["cache_read"], self.spend["cache_write"]), (5710, 5000, 700))
        self.assertAlmostEqual(self.spend["usd"], 0.0123)

    def test_the_log_line_still_reads_on_the_website_and_the_farm(self):
        MV._count_tokens("claude-sonnet-5", 300000, 100000, read=200000, wrote=12000)
        line = MV.claude_spend_line()
        self.assertIn("200k of the input read from the cache, 12k written to it", line)
        from farm.farm import _CLAUDE
        m = _CLAUDE.search(line)
        self.assertEqual(m.groups()[:3], ("1", "300k", "100k"))
        self.assertAlmostEqual(float(m.group(4)), self.spend["usd"], places=4)
        from web.jobs import Studio
        d = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, d, ignore_errors=True)
        log = f"  Claude this run: {line}\n".encode()
        with tarfile.open(d / "r.tgz", "w:gz") as t:
            info = tarfile.TarInfo("plan.log")
            info.size = len(log)
            t.addfile(info, io.BytesIO(log))
        self.assertEqual(Studio.costs(d / "r.tgz"), {"claude": round(self.spend["usd"], 2)})

    def test_a_bill_without_the_cache_reads_as_before(self):
        MV._count_tokens("claude-sonnet-5", 170000, 56000)
        self.assertNotIn("cache", MV.claude_spend_line())

    def test_timing_json_carries_the_cache(self):
        MV._count_tokens("claude-sonnet-5", 10000, 100, read=6000, wrote=2000)
        got = M._usage(MV)["claude"]
        self.assertEqual((got["in"], got["cache_read"], got["cache_write"]), (10000, 6000, 2000))


# ── the shot answers: no transcript words, no endMs ─────────────────────────────────────────────────────────────────
class ShortAnswers(unittest.TestCase):
    def brief(self):
        return M._no_copies(M._pacing(M._prompts()["segmentation"].replace("{TARGET_SECONDS}", "4.2")))

    def test_the_brief_no_longer_asks_for_them(self):
        b = self.brief()
        self.assertNotIn("- text: the transcript words spoken during this scene, verbatim.", b)
        self.assertNotIn("startMs and endMs", b)
        self.assertNotIn("each scene starts where the previous one ended", b)
        self.assertIn("Write only its startMs", b)
        self.assertIn("a scene has no endMs and no text field", b)
        self.assertIn("- visualIntent:", b)                             # the rest of the field list stays
        self.assertIn("as its text", b)                                 # and an overlay keeps its own text

    def beats(self, scene):
        cues = narration(16)

        def fake_ask(engine, prompt, max_tokens, model="", **kw):
            return {"scenes": [scene(a, b, t) for a, b, t in cues[::2]]}
        eng = type("E", (), {"log": staticmethod(lambda s: None), "UTILITY_MODEL": "x",
                             "_parse_srt_full": staticmethod(MV._parse_srt_full)})()
        job = job_with(cues)
        self.addCleanup(shutil.rmtree, job, ignore_errors=True)
        with mock.patch.object(M, "_ask", fake_ask):
            return M.beats(eng, job, job / "subs.srt", "a script", {}), cues

    def test_scenes_without_them_get_both_from_the_subtitles(self):
        rows, cues = self.beats(lambda a, b, t: {"startMs": a, "visualIntent": "v", "queries": ["a", "b", "c"]})
        self.assertEqual(" ".join(r["text"] for r in rows), " ".join(t for _, _, t in cues))
        self.assertTrue(all(a["endMs"] == b["startMs"] for a, b in zip(rows, rows[1:])))
        self.assertEqual(rows[-1]["endMs"], cues[-1][1])

    def test_a_model_that_still_sends_them_is_overruled(self):
        rows, cues = self.beats(lambda a, b, t: {"startMs": a, "endMs": a + 999, "text": "WRONG WORDS",
                                                 "visualIntent": "v", "queries": ["a", "b", "c"]})
        self.assertNotIn("WRONG", " ".join(r["text"] for r in rows))
        self.assertTrue(all(a["endMs"] == b["startMs"] for a, b in zip(rows, rows[1:])))

    def test_only_the_order_of_the_prompt_changed(self):
        cues = narration(300)
        seen = []

        def fake_ask(engine, prompt, max_tokens, model="", head="", **kw):
            seen.append((head, prompt))
            return {"scenes": []}
        eng = type("E", (), {"log": staticmethod(lambda s: None), "UTILITY_MODEL": "x",
                             "_parse_srt_full": staticmethod(MV._parse_srt_full)})()
        job = job_with(cues)
        self.addCleanup(shutil.rmtree, job, ignore_errors=True)
        with mock.patch.object(M, "_ask", fake_ask), mock.patch.object(M, "_stop", lambda e, why: None):
            M.beats(eng, job, job / "subs.srt", "a script", DOSSIER)
        head, part = next((h, p) for h, p in seen if "FOCUS RANGE: 0ms" in p)
        f0, f1 = 0, 120000
        lines = [f"{'>' if f0 <= a < f1 else ' '} [{a}-{b}] {t}" for a, b, t in cues if f0 - 30000 <= a < f1 + 15000]
        old = (f"{self.brief()}\n\n<script>\na script\n</script>\n\n" + "\n".join(
            ["TRANSCRIPT (authoritative; lines marked \">\" are the focus range, unmarked lines are context only):",
             *lines, M._film_block(DOSSIER), M.QUERY_RULES, "", M._range_pace(f0, f1, cues[-1][1]),
             f"FOCUS RANGE: {f0}ms to {f1}ms.",
             "Return scenes whose startMs falls inside the focus range, covering it completely and contiguously."])
               + "\n\nReturn {\"scenes\": [...]}.")
        new = head + part
        words = lambda s: sorted(l for l in s.split("\n") if l.strip())
        self.assertEqual(words(new), words(old))                        # the same lines...
        self.assertLess(new.index("<film>"), new.index("TRANSCRIPT ("))   # ...the film block now first
        moved = (f"{self.brief()}\n\n<script>\na script\n</script>\n" + M._film_block(DOSSIER) + "\n\n" + "\n".join(
            ["TRANSCRIPT (authoritative; lines marked \">\" are the focus range, unmarked lines are context only):",
             *lines, M.QUERY_RULES, "", M._range_pace(f0, f1, cues[-1][1]), f"FOCUS RANGE: {f0}ms to {f1}ms.",
             "Return scenes whose startMs falls inside the focus range, covering it completely and contiguously."])
                 + "\n\nReturn {\"scenes\": [...]}.")
        self.assertEqual(new, moved)                                    # and nothing else: the rules where they were
        self.assertLess(new.index(lines[-1]), new.index("THIS CHANNEL'S SEARCH RULES"))


# ── a cut-off answer ────────────────────────────────────────────────────────────────────────────────────────────────
class CutOff(Spend):
    def test_a_cut_off_answer_is_asked_again_with_more_room(self):
        sent = []
        answers = [stream('{"scenes": [{"startMs": 0, "vis', stop="max_tokens"), stream('{"scenes": []}')]

        def post(url, headers=None, json=None, **kw):
            sent.append(json["max_tokens"])
            return FakeResponse(answers[len(sent) - 1])
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"), mock.patch.object(MV, "_DEAD_PROVIDERS", set()), \
                mock.patch.object(MV.requests, "post", post):
            got = M._ask(MV, "a prompt", 24000, model="claude-sonnet-5", step="shots 0s-120s")
        self.assertEqual(got, {"scenes": []})
        self.assertEqual(sent, [24000, 36000])
        self.assertTrue(any("answer cut off (shots 0s-120s) at 24000 tokens" in l for l in self.lines), self.lines)

    class AlwaysCutOff:
        """An engine whose every answer stops at max_tokens, part-way through its JSON (or parseable, `whole`)."""
        UTILITY_MODEL = SCRIPT_MODEL = "claude-sonnet-5"
        claude_max_out = staticmethod(MV.claude_max_out)

        def __init__(self, whole=False):
            self.asked, self.lines, self.whole = [], [], whole

        def log(self, s):
            self.lines.append(s)

        def claude(self, prompt, model, max_tokens=0):
            self.asked.append(max_tokens)
            return '{"pages": []}' if self.whole else '{"pages": [{"moment": 3, "text": "the deed was si'

        def claude_cut_off(self):
            return True

    def test_more_room_once_then_not_asked_again(self):
        e = self.AlwaysCutOff()
        with self.assertRaises(RuntimeError) as got:
            M._ask(e, "p", 24000, step="shots 0s-120s")
        self.assertEqual(e.asked, [24000, 36000])                       # never 54000
        self.assertIn("answer cut off at 36000 tokens", str(got.exception))
        self.assertEqual(len(e.lines), 2, e.lines)
        self.assertIn("at 24000 tokens, 49 characters ending \"{\"pages\": [{\"moment\": 3, \"text\": \"the deed was "
                      "si\" - asking again with room for 36000", e.lines[0])
        self.assertTrue(e.lines[1].endswith("- not asked again"), e.lines[1])
        self.assertNotIn("room for 54000", " ".join(e.lines))

    def test_more_room_stops_at_the_model_limit(self):
        e = self.AlwaysCutOff()
        with self.assertRaises(RuntimeError):
            M._ask(e, "p", 100000, step="templates")
        self.assertEqual(e.asked, [100000, 128000])
        e = self.AlwaysCutOff()
        with self.assertRaises(RuntimeError):
            M._ask(e, "p", 128000, step="templates")                    # no more room to give
        self.assertEqual(e.asked, [128000])
        self.assertTrue(e.lines[0].endswith("- not asked again"))
        self.assertEqual(MV.claude_max_out("claude-haiku-4-5"), 64000)
        self.assertEqual(MV.claude_max_out("some-other-model"), 64000)

    def test_the_last_try_cut_off_says_it_is_not_asked_again(self):
        class FailsTwice(self.AlwaysCutOff):
            def claude(self, prompt, model, max_tokens=0):
                if len(self.asked) < 2:
                    self.asked.append(max_tokens)
                    raise RuntimeError("overloaded")
                return super().claude(prompt, model, max_tokens)
        e = FailsTwice()
        with self.assertRaises(RuntimeError):
            M._ask(e, "p", 8000, step="visual brief")
        self.assertEqual(e.asked, [8000, 8000, 8000])
        self.assertEqual(len(e.lines), 1)
        self.assertTrue(e.lines[0].endswith("- not asked again"), e.lines)

    def test_a_step_that_names_none_is_asked_again_as_before(self):
        """The highlighted-page step (and places and dates) name no step: a cut-off answer is parsed like any other
        and asked again at the same size, as at 29ee2a9, with no new log line."""
        e = self.AlwaysCutOff()
        with self.assertRaises(RuntimeError):
            M._ask(e, "p", 8000, model=e.SCRIPT_MODEL)                  # as highlight_pages calls it
        self.assertEqual(e.asked, [8000, 8000, 8000])
        self.assertEqual(e.lines, [])
        e = self.AlwaysCutOff(whole=True)
        self.assertEqual(M._ask(e, "p", 8000, model=e.SCRIPT_MODEL), {"pages": []})   # a cut-off that parses is kept
        self.assertEqual(e.asked, [8000])
        for fn in (M.highlight_pages, M.places_and_dates):
            calls = re.findall(r"_ask\(engine[^\n]*", inspect.getsource(fn))
            self.assertTrue(calls, fn.__name__)
            self.assertFalse([c for c in calls if "step=" in c], fn.__name__)

    def test_a_runaway_shot_part_costs_no_more_than_before(self):
        """Every answer runs to max_tokens: one 120-s part is asked as a whole twice and as two halves, and pays less
        output than the 12 x 24000 it paid before (2026-10-13 review: 24000, 36000, 54000 x 4 was 456000)."""
        sent = []

        def post(url, headers=None, json=None, **kw):
            sent.append(json["max_tokens"])
            events = stream('{"scenes": [{"startMs": 0, "visualIntent": "a hall of scrolls", "queries": ["scr',
                            stop="max_tokens")
            events[4] = sse({"type": "message_delta", "delta": {"stop_reason": "max_tokens"},
                             "usage": {"output_tokens": json["max_tokens"]}})
            return FakeResponse(events)
        job = job_with(narration(120))
        self.addCleanup(shutil.rmtree, job, ignore_errors=True)
        stopped = []
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"), mock.patch.object(MV, "_DEAD_PROVIDERS", set()), \
                mock.patch.object(MV, "UTILITY_MODEL", "claude-sonnet-5"), mock.patch.object(MV.requests, "post", post), \
                mock.patch.object(M, "_stop", lambda e, why: stopped.append(why)):
            M.beats(MV, job, job / "subs.srt", "a script", DOSSIER)
        self.assertEqual(sent, [24000, 36000] * 4)
        self.assertEqual(self.spend["out"], 240000)
        self.assertLessEqual(self.spend["out"], 12 * 24000)
        self.assertTrue(stopped and "could not be planned" in stopped[0], stopped)

    def test_an_answer_that_ended_is_asked_again_as_it_was(self):
        asked = []

        class Engine:
            UTILITY_MODEL = "x"

            def log(self, s):
                pass

            def claude(self, prompt, model, max_tokens=0):
                asked.append(max_tokens)
                return "not json" if len(asked) == 1 else "{}"

            def claude_cut_off(self):
                return False
        self.assertEqual(M._ask(Engine(), "p", 8000), {})
        self.assertEqual(asked, [8000, 8000])

    def test_a_model_that_thought_through_all_of_it_is_asked_again_at_once_with_more_room(self):
        sent, slept = [], []
        answers = [thought_only(), stream('{"ok": 1}')]

        def post(url, headers=None, json=None, **kw):
            sent.append(json["max_tokens"])
            return FakeResponse(answers[len(sent) - 1])
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV.requests, "post", post), mock.patch.object(MV.time, "sleep", slept.append):
            self.assertEqual(MV._claude_try("anthropic", "claude-sonnet-5-5", "p", 8000, 600), '{"ok": 1}')
        self.assertEqual((sent, slept), ([8000, 12000], []))
        self.assertTrue(any("thought through all of max_tokens" in l and "room for 12000" in l for l in self.lines))

    def test_at_the_model_limit_a_thought_only_answer_is_retried_as_before(self):
        sent, slept = [], []
        answers = [thought_only(), stream('{"ok": 1}')]

        def post(url, headers=None, json=None, **kw):
            sent.append(json["max_tokens"])
            return FakeResponse(answers[len(sent) - 1])
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV.requests, "post", post), mock.patch.object(MV.time, "sleep", slept.append):
            self.assertEqual(MV._claude_try("anthropic", "claude-sonnet-5-5", "p", 128000, 600), '{"ok": 1}')
        self.assertEqual((sent, slept), ([128000, 128000], [12]))
        thought = thought_only(stop="end_turn")                         # thought, ended, wrote nothing: as before
        sent.clear(), slept.clear()
        answers[:] = [thought, stream('{"ok": 1}')]
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV.requests, "post", post), mock.patch.object(MV.time, "sleep", slept.append):
            MV._claude_try("anthropic", "claude-sonnet-5-5", "p", 8000, 600)
        self.assertEqual((sent, slept), ([8000, 8000], [12]))

    def test_the_stop_reason_is_this_threads_last_answer_only(self):
        MV._read_sse_text(FakeResponse(stream("{", stop="max_tokens")))
        self.assertTrue(MV.claude_cut_off())
        seen = []
        t = threading.Thread(target=lambda: seen.append(MV.claude_cut_off()))
        t.start()
        t.join()
        self.assertEqual(seen, [False])                                  # another thread's answer is not this one's
        with mock.patch.object(MV, "_claude_code_try", lambda *a: "{}"):
            MV._claude_try("claudecode", "m", "p", 100, 60)
        self.assertFalse(MV.claude_cut_off())                           # a new call forgets the last one


# ── a stream that broke off part-way ────────────────────────────────────────────────────────────────────────────────
class BrokenStream(Spend):
    def post_each(self, *answers):
        sent = []

        def post(url, headers=None, json=None, **kw):
            sent.append(json)
            a = answers[len(sent) - 1]
            return a if isinstance(a, FakeResponse) else FakeResponse(a)
        return sent, post

    def test_an_error_event_is_asked_again_like_a_network_error(self):
        sent, post = self.post_each(broken_off(), stream('{"scenes": []}'))
        slept = []
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV.requests, "post", post), mock.patch.object(MV.time, "sleep", slept.append):
            self.assertEqual(MV._claude_try("anthropic", "claude-sonnet-5", "p", 24000, 600), '{"scenes": []}')
        self.assertEqual((len(sent), slept), (2, [12]))
        self.assertTrue(any("anthropic unavailable" in l and "overloaded_error" in l for l in self.lines), self.lines)

    def test_through_claude_with_no_fallback_it_no_longer_ends_the_run(self):
        """On a pod (CLAUDE_FALLBACK empty) the error used to reach sys.exit after one request."""
        sent, post = self.post_each(broken_off(), stream('{"ok": 1}'))
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV, "CLAUDE_PROVIDER", "anthropic"), mock.patch.object(MV, "CLAUDE_FALLBACK", ""), \
                mock.patch.object(MV, "_DEAD_PROVIDERS", set()), mock.patch.object(MV.requests, "post", post), \
                mock.patch.object(MV.time, "sleep", lambda s: None):
            self.assertEqual(M._ask(MV, "p", 8000, model="claude-sonnet-5", step="research dossier"), {"ok": 1})
        self.assertEqual(len(sent), 2)

    def test_a_client_error_is_still_not_asked_again(self):
        bad = FakeResponse([])
        bad.status_code, bad.text = 400, '{"type": "error", "error": {"type": "invalid_request_error"}}'
        sent, post = self.post_each(bad, stream("{}"))
        with mock.patch.object(MV, "_claude_endpoint", lambda p: ("https://x/v1/messages", {})), \
                mock.patch.object(MV.requests, "post", post), mock.patch.object(MV.time, "sleep", lambda s: None):
            with self.assertRaises(MV._ClaudeError):
                MV._claude_try("anthropic", "claude-sonnet-5", "p", 1000, 600)
        self.assertEqual(len(sent), 1)
        with self.assertRaises(MV._ClaudeStreamError):
            MV._read_sse_text(FakeResponse(broken_off()))


if __name__ == "__main__":
    unittest.main()
