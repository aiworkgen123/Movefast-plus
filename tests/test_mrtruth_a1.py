"""Mr Truth A1 (2026-10-10): the search - free Bing, Brave as backup - and one photo identity; E1 (owner 2026-10-10,
~23:50): Bing first for a generic shot, Commons first only for a shot that names a person, place or thing.
Synthetic data only: no network, no paid call, no owner script or voice.

    .venv/bin/python -m unittest tests.test_mrtruth_a1 -v
"""
import html
import inspect
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import mrtruth as M  # noqa: E402


class Engine:
    SCRIPT_MODEL = UTILITY_MODEL = "stub"
    STYLE_INFO = {}

    def __init__(self):
        self.lines = []

    def log(self, s):
        self.lines.append(s)

    def claude(self, *a, **k):
        raise RuntimeError("no Claude in a unit test")


def page(rows, extra=""):
    """A Bing Images page: one <a class="iusc"> per row (murl, purl, t, w, h)."""
    out = ["<html><body>", extra]
    for r in rows:
        m = json.dumps({"murl": r.get("murl"), "purl": r.get("purl", ""), "turl": "https://tse.example/th?id=1",
                        "t": r.get("t", "")})
        href = "/images/search?view=detailV2" + "".join(f"&{k}={r[k]}" for k in ("expw", "exph") if k in r)
        out.append(f'<a class="iusc" m="{html.escape(m)}" href="{html.escape(href)}">x</a>')
    return "\n".join(out + ["</body></html>"])


def rows_for(query, n=30, w=1600, h=900, host="example.org", title=None):
    return [{"murl": f"https://{host}/img/{abs(hash(query)) % 10 ** 8}_{k}.jpg", "purl": f"https://{host}/page/{k}",
             "t": title or f"{query} picture {k}", "expw": w, "exph": h} for k in range(n)]


class Resp:
    def __init__(self, status=200, text="", data=None):
        self.status_code, self.text, self._data, self.headers = status, text, data, {}

    def json(self):
        return self._data


def textured(path, seed, size=(1600, 900), dark=1.0, scale=None):
    """A picture with real structure (blurred noise), so its hash means something; the same seed = the same picture."""
    import numpy as np
    from PIL import Image, ImageFilter
    rng = np.random.default_rng(seed)
    a = (rng.random((90, 160, 3)) * 255).astype("uint8")
    im = Image.fromarray(a).resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
    if dark != 1.0:
        from PIL import ImageEnhance
        im = ImageEnhance.Brightness(im).enhance(dark)
    if scale:
        im = im.resize(scale, Image.LANCZOS)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "JPEG", quality=88)
    return Path(path)


class Base(unittest.TestCase):
    def setUp(self):
        self.e = Engine()
        M._search_reset(self.e)
        M._BING["checked"] = True                        # the canary has its own tests
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)
        self.patches = [mock.patch.object(M, "BING_GAP", 0.0), mock.patch.object(M, "CANARY_RETRY_S", 0.0),
                        mock.patch.object(M, "BING_SLOW_S", 0.0)]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()
        M._search_reset()


class Parser(Base):
    def test_rows_sizes_titles(self):
        text = page(rows_for("codex leaf", 25) + [{"murl": "https://x.org/a.jpg", "purl": "https://x.org/p", "t": "A &amp; B"}])
        rows = M._bing_rows(text)
        self.assertEqual(len(rows), 26)
        self.assertTrue(all(r["murl"] and r["purl"] and r["t"] for r in rows))
        self.assertEqual((rows[0]["w"], rows[0]["h"]), (1600, 900))
        self.assertTrue(all(isinstance(r["w"], int) for r in rows[:25]))
        self.assertEqual((rows[-1]["w"], rows[-1]["h"], rows[-1]["t"]), (None, None, "A & B"))
        cands = M._bing_cands(rows)
        self.assertTrue(all(c["provider"] == "bing" and c["url"].startswith("https://") for c in cands))
        self.assertEqual(cands[0]["source"], "https://example.org/page/0")

    def test_broken_rows_and_a_cut_page(self):
        good = page(rows_for("codex leaf", 6))
        bad_json = '<a class="iusc" m="{not json" href="/x?expw=900&amp;exph=600">x</a>'
        a_list = '<a class="iusc" m="[1, 2]" href="/x">x</a>'
        no_size = '<a class="iusc" m="{&quot;murl&quot;: &quot;https://a.org/1.jpg&quot;}" href="/x?expw=abc">x</a>'
        not_http = '<a class="iusc" m="{&quot;murl&quot;: &quot;data:image/png;base64,xx&quot;}" href="/x">x</a>'
        rows = M._bing_rows(good + bad_json + a_list + no_size + not_http)
        self.assertEqual(len(rows), 7)                       # 6 good, the size-less one; the rest skipped
        self.assertEqual((rows[-1]["w"], rows[-1]["h"]), (None, None))
        cut = good[: good.index("codex leaf picture 4")]       # the page stops in the middle of a row
        self.assertEqual(len(M._bing_rows(cut)), 4)
        self.assertEqual(M._bing_rows(""), [])
        self.assertEqual(M._bing_cands([{"murl": None}, "junk", {"murl": "https://a.org/b.jpg", "w": "x"}])[0]["w"], None)

    def test_on_topic(self):
        rows = [{"t": "Priests at prayer", "purl": "", "murl": ""}, {"t": "A cat", "purl": "", "murl": ""}]
        self.assertEqual(M._on_topic("priest", rows), 0.5)          # by the stem: priest -> priests
        self.assertIsNone(M._on_topic("old photo 1950s", rows))     # no word of its own: never counted against Bing
        two = [{"t": "Vatican library hall"}, {"t": "Vatican City"}, {"t": "the library"}]
        self.assertAlmostEqual(M._on_topic("Vatican library", two, k=2), 1 / 3)
        self.assertIsNone(M._on_topic("Vatican", two, k=2))


class BingHealth(Base):
    def search(self, q, folder=None):
        return M.bing_search(q, folder or self.d / "s")

    def test_healthy_answer_is_cached_with_its_settings(self):
        calls = []
        with mock.patch.object(M, "_bing_get", lambda q: calls.append(q) or Resp(200, page(rows_for(q)))):
            got, why = self.search("codex leaf vellum")
            again, why2 = self.search("codex leaf vellum")
        self.assertEqual((why, why2, len(calls)), ("", "", 1))
        self.assertEqual(len(got), 30)
        self.assertEqual(got, again)
        saved = list((self.d / "s" / "bing").glob("*.json"))
        self.assertEqual(len(saved), 1)
        self.assertEqual(json.loads(saved[0].read_text())["params"].get("adlt"), "strict")   # SafeSearch strict
        self.assertEqual(M.SEARCH["bing_ok"], 1)

    def test_request_carries_safesearch_strict(self):
        seen = {}

        class Curl:
            @staticmethod
            def get(url, **kw):
                seen.update(kw.get("params") or {}, impersonate=kw.get("impersonate"))
                return Resp(200, page(rows_for("x")))
        fake = mock.MagicMock(requests=Curl)
        with mock.patch.dict(sys.modules, {"curl_cffi": fake, "curl_cffi.requests": Curl}):
            M._bing_get("codex")
        self.assertEqual((seen["adlt"], seen["impersonate"], seen["q"]), ("strict", "chrome", "codex"))

    def test_block_switches_bing_off_at_once(self):
        for resp, kind in ((Resp(403, ""), "http_403"), (Resp(200, "<html>Please solve this captcha</html>"), "captcha")):
            M._search_reset(self.e)
            M._BING["checked"] = True
            with mock.patch.object(M, "_bing_get", lambda q: resp):
                self.assertEqual(self.search("codex leaf")[1], kind)
                self.assertTrue(M._BING["why"])
                self.assertEqual(self.search("another one")[1], "off")
        self.assertTrue(any("Bing (free web pictures) is OFF" in l for l in self.e.lines))

    def test_429_once_is_retried_twice_switches_off(self):
        seq = [Resp(429), Resp(200, page(rows_for("codex leaf")))]
        with mock.patch.object(M, "_bing_get", lambda q: seq.pop(0)):
            got, why = self.search("codex leaf")
        self.assertEqual((why, len(got), M._BING["why"]), ("", 30, ""))
        with mock.patch.object(M, "_bing_get", lambda q: Resp(429)):
            self.assertEqual(self.search("other leaf")[1], "http_429")
        self.assertIn("429", M._BING["why"])
        # the pause is over: one shot asks the canary again; it passes, Bing is back
        M._BING["recheck_at"] = 0.0
        canary = lambda q: Resp(200, page(rows_for(q, title=f"{q} facsimile")))
        with mock.patch.object(M, "_bing_get", canary):
            got, why = self.search("third leaf")
        self.assertEqual((why, M._BING["why"]), ("", ""))
        self.assertTrue(any("back ON" in l for l in self.e.lines))

    def test_recheck_that_fails_backs_off_then_gives_up(self):
        with mock.patch.object(M, "_bing_get", lambda q: Resp(403)):
            self.search("codex leaf")
            for n in range(1, M.BING_RECHECKS + 1):
                M._BING["recheck_at"] = 0.0
                self.assertEqual(self.search(f"leaf {n}")[1], "off")
                self.assertEqual(M._BING["rechecks"], n)
        self.assertEqual(M._BING["recheck_at"], float("inf"))
        self.assertTrue(any("for the rest of this film" in l for l in self.e.lines))

    def test_three_bad_answers_in_eight_switch_off(self):
        answers = {"good": lambda q: Resp(200, page(rows_for(q))),
                   "unrelated": lambda q: Resp(200, page(rows_for("zzz qqq", title="Roblox fishing guide"))),
                   "thin": lambda q: Resp(200, page(rows_for(q, n=3))),
                   "error": lambda q: (_ for _ in ()).throw(TimeoutError("slow"))}
        order = ["good", "unrelated", "good", "good", "thin", "good", "error"]
        kinds = []
        for k, a in enumerate(order):
            with mock.patch.object(M, "_bing_get", answers[a]):
                kinds.append(self.search(f"codex leaf number{k}")[1])
        self.assertEqual(kinds, ["", "unrelated", "", "", "thin_page", "", "error:TimeoutError"])
        self.assertIn("3 of the last 7 answers bad", M._BING["why"])

    def test_healthy_answers_never_latch(self):
        with mock.patch.object(M, "_bing_get", lambda q: Resp(200, page(rows_for(q)))):
            for k in range(40):
                self.assertEqual(self.search(f"vatican library hall view{k}")[1], "")
        self.assertEqual(M._BING["why"], "")

    def test_answers_keyed_on_one_word_switch_off(self):
        one_word = lambda q: Resp(200, page(rows_for(q, title="Vatican City tourist guide")))
        with mock.patch.object(M, "_bing_get", one_word):
            for k in range(10):
                self.assertEqual(self.search(f"Vatican library reading room{k}")[1], "")
        self.assertIn("keyed on one word", M._BING["why"])

    def test_one_word_answers_with_a_healthy_canary_keep_bing_on(self):
        def answer(q):
            if q in ("Codex Vaticanus", "Eiffel Tower 1889"):
                return Resp(200, page(rows_for(q, title=f"{q} manuscript")))
            return Resp(200, page(rows_for(q, title="Vatican City tourist guide")))
        with mock.patch.object(M, "_bing_get", answer):
            for k in range(20):
                self.assertEqual(self.search(f"Vatican library reading room{k}")[1], "")
        self.assertEqual((M._BING["why"], M.SEARCH.get("bing_one_word_checks")), ("", 2))

    def test_missing_curl_cffi_is_final(self):
        def no_curl(q):
            raise ImportError("No module named 'curl_cffi'")
        with mock.patch.object(M, "_bing_get", no_curl):
            self.assertEqual(self.search("codex leaf")[1], "curl_cffi missing")
        self.assertIn("pip install curl_cffi==0.16.3", M._BING["why"])
        self.assertEqual(M._BING["recheck_at"], float("inf"))
        M._search_reset(self.e)                          # caught by the start check instead: still final
        with mock.patch.object(M, "_bing_get", no_curl):
            self.assertEqual(self.search("codex leaf 2", self.d / "t")[1], "off")
        self.assertIn("curl_cffi missing", M._BING["why"])
        self.assertEqual(M._BING["recheck_at"], float("inf"))


class Canary(Base):
    def setUp(self):
        super().setUp()
        M._BING["checked"] = False

    def test_canary_pass_fail_block(self):
        good = lambda q: Resp(200, page(rows_for(q, title=f"{q} manuscript")))
        degraded = lambda q: Resp(200, page(rows_for(q, title="OpenAI Codex coding agent")))
        blocked = lambda q: Resp(200, "<html>unusual traffic from your network</html>")
        with mock.patch.object(M, "_bing_get", good):
            ok, detail = M.bing_canary()
        self.assertTrue(ok, detail)
        self.assertIn("'Codex Vaticanus' 20/20", detail)
        with mock.patch.object(M, "_bing_get", degraded):
            self.assertFalse(M.bing_canary()[0])
        with mock.patch.object(M, "_bing_get", blocked):
            ok, detail = M.bing_canary()
        self.assertFalse(ok)
        self.assertIn("captcha", detail)

    def test_saved_degraded_pages_fail_the_canary(self):
        pages = Path(os.environ.get("MRTRUTH_BING_PAGES", "/nonexistent"))
        files = sorted(pages.glob("page_3.html"))         # a real degraded answer, kept outside the repo
        if not files:
            self.skipTest("no saved Bing page here")
        text = files[0].read_text(encoding="utf-8")
        with mock.patch.object(M, "_bing_get", lambda q: Resp(200, text)):
            self.assertFalse(M.bing_canary()[0])

    def test_canary_runs_once_before_the_first_search_and_a_failure_hands_over(self):
        calls = []
        degraded = lambda q: calls.append(q) or Resp(200, page(rows_for(q, title="Roblox fishing guide")))
        with mock.patch.object(M, "_bing_get", degraded), mock.patch.dict(os.environ, {"BRAVE_SEARCH_API_KEY": "k"}):
            got, why = M.bing_search("codex leaf", self.d)
            got2, why2 = M.bing_search("other leaf", self.d)
        self.assertEqual((why, why2), ("off", "off"))
        self.assertEqual(calls, ["Codex Vaticanus", "Codex Vaticanus", "Eiffel Tower 1889", "Eiffel Tower 1889"])
        self.assertIn("start check failed", M._BING["why"])


def brave_answer(q, n=8, w=1600, h=900):
    return {"results": [{"title": f"{q} archive photo {k}", "url": f"https://brave.example/page/{k}",
                         "properties": {"url": f"https://brave.example/{abs(hash(q)) % 10 ** 6}_{k}.jpg",
                                        "width": w, "height": h}} for k in range(n)]}


class WebPhotos(Base):
    """The backup decision (design T4), with the network stubbed: a fake Bing, a fake Brave, fake downloads."""

    def setUp(self):
        super().setUp()
        self.brave_calls, self.bing_calls, self.downloads = [], [], []
        self.bing = {}          # query -> Resp maker
        self.brave_status = 200
        self.fail_downloads = False
        self.seed, self.lock = 0, threading.Lock()
        self.env = mock.patch.dict(os.environ, {"BRAVE_SEARCH_API_KEY": "k", "MRTRUTH_ALLOW_DEGRADED": "0"})
        self.env.start()
        # the thin-Bing backup as designed (T4); option A's default 0 asks Brave only when Bing fails (test_b0 below)
        self.brave_max = mock.patch.object(M, "BRAVE_LAST_MAX", 30)
        self.brave_max.start()

    def tearDown(self):
        self.brave_max.stop()
        self.env.stop()
        super().tearDown()

    def fake_bing(self, q):
        self.bing_calls.append(q)
        return self.bing.get(q, lambda q: Resp(200, page(rows_for(q))))(q)

    def fake_brave(self, q, n, key):
        self.brave_calls.append(q)
        if self.brave_status != 200:
            return Resp(self.brave_status, "out of credit")
        return Resp(200, data=brave_answer(q))

    def fake_download(self, cand, dest):
        with self.lock:
            self.downloads.append(cand["url"])
            if self.fail_downloads:
                return None
            self.seed += 1
            seed = self.seed
        return textured(dest, seed=seed)

    def run_web(self, queries, folder="w", **kw):
        with mock.patch.object(M, "_bing_get", self.fake_bing), mock.patch.object(M, "_brave_get", self.fake_brave), \
                mock.patch.object(M, "_download", self.fake_download):
            return M.web_photos(queries, self.d / folder, **kw)

    def test_a_healthy_bing_needs_no_brave(self):
        out = self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.brave_calls, [])
        self.assertEqual(len(out), 6)
        self.assertTrue(all(c["provider"] == "bing" and c["img"].startswith("https://") for c, _ in out))

    def test_b_thin_together_one_brave(self):
        self.bing["codex leaf"] = lambda q: Resp(200, page(rows_for(q, n=1) + rows_for(q + "x", n=10, w=500, h=900)))
        self.bing["vatican library"] = lambda q: Resp(200, page(rows_for(q, n=10, w=600, h=400)))
        out = self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.brave_calls, ["codex leaf"])
        self.assertEqual(M.SEARCH.get("brave_thin"), 1)
        self.assertTrue(any(c["provider"] == "brave" for c, _ in out))

    def test_b0_option_a_thin_bing_asks_no_brave(self):
        """MRTRUTH_BRAVE_LAST_MAX 0 (option A, owner 2026-10-12): a thin Bing answer is used as it is."""
        self.bing["codex leaf"] = lambda q: Resp(200, page(rows_for(q, n=1) + rows_for(q + "x", n=10, w=500, h=900)))
        self.bing["vatican library"] = lambda q: Resp(200, page(rows_for(q, n=10, w=600, h=400)))
        with mock.patch.object(M, "BRAVE_LAST_MAX", 0):
            out = self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.brave_calls, [])
        self.assertTrue(out and all(c["provider"] == "bing" for c, _ in out))

    def test_c_a_failed_search_gets_its_own_brave(self):
        self.bing["vatican library"] = lambda q: Resp(200, page(rows_for("zzz", title="Roblox fishing")))
        self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.brave_calls, ["vatican library"])
        self.assertEqual(M.SEARCH.get("brave_bing_failed"), 1)

    def test_d_bing_off_every_search_to_brave(self):
        M._BING.update(why="blocked (HTTP 403)", recheck_at=float("inf"))
        self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.brave_calls, ["codex leaf", "vatican library"])
        self.assertEqual(self.bing_calls, [])
        self.assertEqual(M.SEARCH.get("brave_bing_off"), 2)

    def test_e_nothing_downloads_one_brave(self):
        self.fail_downloads = True
        self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.brave_calls, ["codex leaf"])
        self.assertEqual(M.SEARCH.get("brave_nodl"), 1)

    def test_f_brave_dry_while_bing_works_is_no_stop(self):
        self.brave_status = 402
        self.bing["codex leaf"] = lambda q: Resp(200, page(rows_for(q, n=1)))
        self.bing["vatican library"] = lambda q: Resp(200, page(rows_for(q, n=6, w=500, h=900)))
        self.run_web(["codex leaf", "vatican library"])
        self.assertIn("HTTP 402", M._BRAVE_OUT["why"])
        self.run_web(["codex leaf", "vatican library"], folder="w2")
        self.assertEqual(len(self.brave_calls), 1)                 # never asked again this film
        self.assertTrue(any("Brave (the backup web search) is OUT" in l for l in self.e.lines))

    def test_g_bing_off_and_brave_dry_stops_and_stays_stopped(self):
        M._BING.update(why="blocked (HTTP 403)", recheck_at=float("inf"))
        self.brave_status = 402
        with self.assertRaises(M.OutOfCredit):
            self.run_web(["codex leaf"])
        with self.assertRaises(M.OutOfCredit):                     # sticky: the next shot stops before any work
            self.run_web(["something else"], folder="w2")
        self.assertEqual(len(self.brave_calls), 1)
        M._search_reset(self.e)
        M._BING.update(why="blocked (HTTP 403)", recheck_at=float("inf"), checked=True)
        with mock.patch.dict(os.environ, {"MRTRUTH_ALLOW_DEGRADED": "1"}):
            self.assertEqual(self.run_web(["codex leaf"], folder="w3"), [])
            self.assertEqual(self.run_web(["codex leaf 2"], folder="w4"), [])
        self.assertEqual(sum("carrying on with Commons alone" in l for l in self.e.lines), 1)

    def test_h_brave_order_never_asks_bing(self):
        with mock.patch.object(M, "WEB_SEARCH", "brave"):
            out = self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.bing_calls, [])
        self.assertEqual(self.brave_calls, ["codex leaf", "vatican library"])
        self.assertTrue(out)

    def test_i_both_searches_share_the_downloads(self):
        self.bing["codex leaf"] = lambda q: Resp(200, page(rows_for(q, n=25)))
        self.bing["vatican library"] = lambda q: Resp(200, page(rows_for(q, n=1) + rows_for(q + " x", n=20, w=500, h=400)))
        out = self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(self.brave_calls, [])
        second = [u for u in self.downloads if str(abs(hash("vatican library")) % 10 ** 8) in u]
        self.assertEqual(len(second), 1)                           # the second search's one picture is fetched
        self.assertEqual(len(out), 6)

    def test_j_both_thin_exactly_one_brave(self):
        self.bing["codex leaf"] = lambda q: Resp(200, page(rows_for(q, n=6, w=700, h=500)))
        self.bing["vatican library"] = lambda q: Resp(200, page(rows_for(q, n=6, w=900, h=1400)))
        self.run_web(["codex leaf", "vatican library"])
        self.assertEqual(len(self.brave_calls), 1)

    def test_k_brave_allowance_per_film(self):
        self.bing["codex leaf"] = lambda q: Resp(200, page(rows_for(q, n=6, w=700, h=500)))
        with mock.patch.object(M, "BRAVE_LAST_MAX", 1):
            self.run_web(["codex leaf"], folder="w1")
            self.run_web(["codex leaf"], folder="w2")
        self.assertEqual(len(self.brave_calls), 1)
        self.assertEqual(M.SEARCH.get("brave_capped"), 1)

    def test_l_a_copy_of_a_skip_picture_is_dropped(self):
        commons = textured(self.d / "c" / "c00.jpg", seed=1)
        out = self.run_web(["codex leaf"], skip=[commons])          # the first download is seed 1: the same picture
        self.assertEqual(len(out), 6)
        self.assertEqual(M.SEARCH.get("web_copies"), 1)
        self.assertFalse(any(M._same(p, commons) for _, p in out))

    def test_brave_why_is_keyword_only(self):
        sig = inspect.signature(M.brave_search)
        self.assertEqual(sig.parameters["why"].kind, inspect.Parameter.KEYWORD_ONLY)
        self.assertEqual(list(sig.parameters)[:3], ["query", "folder", "n"])

    def test_brave_old_cache_is_still_read(self):
        folder = self.d / "old"
        import hashlib
        f = folder / "brave" / (hashlib.sha256(b"codex leaf").hexdigest()[:20] + ".json")
        f.parent.mkdir(parents=True)
        f.write_text(json.dumps([{"url": "https://a.org/1.jpg", "source": "https://a.org/p", "title": "codex", "w": 1600,
                                  "h": 900}, {"url": "https://www.shutterstock.com/x.jpg", "source": "", "title": "x"}]))
        with mock.patch.object(M, "_brave_get", self.fake_brave):
            got = M.brave_search("codex leaf", folder)
        self.assertEqual([c["url"] for c in got], ["https://a.org/1.jpg"])
        self.assertEqual(self.brave_calls, [])


class WebFilter(unittest.TestCase):
    def ok(self, url, page="", title="", **kw):
        return M._web_ok({"url": url, "source": page, "title": title, **kw})

    def test_out(self):
        self.assertFalse(self.ok("https://www.shutterstock.com/image-photo/x.jpg", "https://www.shutterstock.com/p"))
        self.assertFalse(self.ok("https://static.vecteezy.com/x.jpg", "https://www.vecteezy.com/p"))
        self.assertFalse(self.ok("https://i.ytimg.com/vi/abc/maxresdefault.jpg", "https://www.youtube.com/watch?v=abc"))
        self.assertFalse(self.ok("https://i.pinimg.com/x.jpg", "https://www.pinterest.com/pin/1"))
        self.assertFalse(self.ok("https://stockcake.com/i/x.jpg", "https://stockcake.com/i/x", "Free Monk Image"))
        self.assertFalse(self.ok("https://a.org/x.jpg", "https://a.org/p", "Medieval monk coffee mug"))
        self.assertFalse(self.ok("https://a.org/x.jpg", "https://a.org/p", "Vatican T-shirt design"))
        self.assertFalse(self.ok("https://a.org/x.jpg", "https://storage.googleapis.com/bucket/page.html", "codex"))
        self.assertFalse(self.ok("https://a.org/x.jpg", "https://a.org/p", "Priest in library, AI generated"))
        self.assertFalse(self.ok("https://i.etsystatic.com/x.jpg", "https://www.etsy.com/listing/1/clock",
                                 "Vintage wall clock home decor"))

    def test_in(self):
        self.assertTrue(self.ok("https://i.ebayimg.com/images/x.jpg", "https://www.ebay.com/itm/123",
                                "1930s press photo of the Vatican library"))
        self.assertTrue(self.ok("https://rarebooksboutique.example/leaf.jpg", "https://rarebooksboutique.example/leaf",
                                "antique Latin manuscript leaf"))
        self.assertTrue(self.ok("https://www.metmuseum.org/x.jpg", "https://www.metmuseum.org/art/collection/1",
                                "Gift shop poster"))                              # a museum page always passes
        self.assertTrue(self.ok("https://upload.wikimedia.org/x.jpg", "https://commons.wikimedia.org/wiki/File:x.jpg"))
        self.assertTrue(self.ok("https://example.org/codex.jpg", "https://example.org/codex", "Codex Vaticanus folio"))

    def test_shops_off_by_switch(self):
        with mock.patch.object(M, "SHOP_PICTURES", False):
            self.assertFalse(self.ok("https://i.ebayimg.com/images/x.jpg", "https://www.ebay.com/itm/123",
                                     "1930s press photo of the Vatican library"))
            self.assertTrue(self.ok("https://example.org/codex.jpg", "https://example.org/codex", "Codex Vaticanus"))

    def test_fits(self):
        self.assertTrue(M._fits({"w": 1600, "h": 900}))
        self.assertTrue(M._fits({}))                                   # unknown: fetched and measured
        self.assertFalse(M._fits({"w": 900, "h": 1600}))               # portrait
        self.assertFalse(M._fits({"w": 700, "h": 500}))                # too small
        self.assertFalse(M._fits({"w": 9000, "h": 6000}))              # 54 MP: not fetched
        self.assertTrue(M._fits({"w": "1600", "h": "900"}))


class Wikimedia(unittest.TestCase):
    def test_thumb_rewrite(self):
        url = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Codex_Vaticanus.jpg"
        self.assertEqual(M._wiki_thumb(url, 4000),
                         "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Codex_Vaticanus.jpg/1920px-Codex_Vaticanus.jpg")
        self.assertEqual(M._wiki_thumb(url, 1500), url)
        self.assertEqual(M._wiki_thumb(url, None), url)
        tif = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Scan.tif"
        self.assertEqual(M._wiki_thumb(tif, 5000), tif)
        thumb = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/800px-X.jpg"
        self.assertEqual(M._wiki_thumb(thumb, 5000), thumb)

    def test_download_goes_through_the_wikimedia_gate(self):
        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (1920, 1080), (90, 80, 70)).save(buf, "JPEG")
        got, waits = {}, []

        def get(url, headers=None, timeout=0):
            got.update(url=url, ua=(headers or {}).get("User-Agent"))
            r = mock.Mock(status_code=200, content=buf.getvalue())
            r.headers = {}
            return r
        with tempfile.TemporaryDirectory() as d, mock.patch("requests.get", get), \
                mock.patch.object(M, "_commons_wait", lambda: waits.append(1)):
            out = M._download({"url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg", "w": 4000},
                              Path(d) / "w.jpg")
        self.assertTrue(out)
        self.assertIn("/thumb/a/ab/X.jpg/1920px-X.jpg", got["url"])
        self.assertIn("MoveFast-MrTruth", got["ua"])
        self.assertEqual(waits, [1])


class Identity(unittest.TestCase):
    def test_same_and_different(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            a = textured(d / "a.jpg", 1)
            small = textured(d / "small.jpg", 1, scale=(640, 360))
            darker = textured(d / "dark.jpg", 1, dark=0.6)
            other = textured(d / "b.jpg", 2)
            copy = d / "copy.jpg"
            copy.write_bytes(a.read_bytes())
            self.assertTrue(M._same(a, small))
            self.assertTrue(M._same(a, darker))
            self.assertTrue(M._same(a, copy))
            self.assertEqual(M._photo_id(a), M._photo_id(copy))
            self.assertFalse(M._same(a, other))
            from PIL import Image
            Image.new("RGB", (1600, 900), (40, 40, 40)).save(d / "f1.jpg")
            Image.new("RGB", (1600, 900), (200, 200, 200)).save(d / "f2.jpg")
            self.assertFalse(M._same(d / "f1.jpg", d / "f2.jpg"))       # flat pictures share no structure
            self.assertFalse(M._same(a, d / "gone.jpg"))
            (d / "t.txt").write_text("not a picture")
            self.assertFalse(M._same(a, d / "t.txt"))

    def test_threads_share_the_cache(self):
        with tempfile.TemporaryDirectory() as d:
            ps = [textured(Path(d) / f"{k}.jpg", k % 3) for k in range(9)]
            res = []
            th = [threading.Thread(target=lambda: res.append([M._photo_id(p) for p in ps])) for _ in range(6)]
            [t.start() for t in th]
            [t.join() for t in th]
            self.assertEqual(len({tuple(r) for r in res}), 1)


class SearchPlan(unittest.TestCase):
    def test_a_search_run_by_an_earlier_shot_is_not_run_again(self):
        rows = [{"text": "one", "queries": ["vatican library hall", "papal library", "dark library"], "archive": "Vatican Library"},
                {"text": "two", "queries": ["vatican library hall", "codex shelves", "candle"], "archive": "Vatican Library"},
                {"text": "three", "queries": ["old priest reading 1950s", "", ""], "archive": ""}]
        plan = M._search_plan(rows, {})
        self.assertEqual(plan[0]["web"], ["vatican library hall", "Vatican Library"])
        self.assertEqual(plan[0]["commons"], "Vatican Library")
        self.assertEqual(plan[1]["web"], ["codex shelves", "candle"])          # its next wordings
        self.assertEqual(plan[1]["commons"], "vatican library hall")           # the plain words, not the name again
        self.assertEqual(plan[2]["commons"], "priest reading")                 # no name: the search in plain words
        self.assertEqual(plan[2]["web"], ["old priest reading 1950s"])
        self.assertEqual([p["first"] for p in plan], ["commons", "commons", "bing"])   # owner 2026-10-10, ~23:50

    def test_a_person_without_likeness_is_searched_by_role(self):
        dossier = {"visualBrief": {"people": [{"name": "Father Aldo Brunetti", "likenessKnown": False, "role": "priest",
                                               "commons": "Catholic priest", "web": "priest reading old library",
                                               "portrait": "Italian priest portrait 1950s"}]}}
        rows = [{"text": "Brunetti read it twice.", "entities": ["Aldo Brunetti"],
                 "queries": ["Aldo Brunetti priest", "Brunetti archive", "priest at desk"]}]
        p = M._search_plan(rows, dossier)[0]
        self.assertEqual(p["web"], ["Italian priest portrait 1950s", "priest reading old library"])
        self.assertEqual(p["commons"], "Catholic priest")
        self.assertTrue(p["stand"])
        self.assertFalse(any("brunetti" in w.lower() for w in p["web"] + [p["commons"]]))
        self.assertEqual(p["first"], "bing")                 # the ROLE is searched: a generic figure, Bing first


class SearchOrder(unittest.TestCase):
    """E1 (owner 2026-10-10, ~23:50): Bing first for a generic or mood shot, Commons first only for a named thing."""

    def test_named_by_archive_name_entity_or_names_list(self):
        rows = [{"text": "a", "queries": ["dark corridor", "", ""], "archive": "Vatican Library"},
                {"text": "b", "queries": ["papyrus fragment", "", ""], "entities": ["Rylands Papyrus"]},
                {"text": "c", "queries": ["library hall", "", ""], "entities": ["Vatican Apostolic Library, Rome"]},
                {"text": "d", "queries": ["candle smoke", "", ""], "entities": ["1943"]},
                {"text": "e", "queries": ["old ledger", "", ""], "entities": ["the 1950s"]},
                {"text": "f", "queries": ["silence", "", ""]}]
        plan = M._search_plan(rows, {})
        self.assertEqual([p["first"] for p in plan], ["commons", "commons", "commons", "bing", "bing", "bing"])
        self.assertEqual(plan[1]["commons"], "Rylands Papyrus")             # the name itself
        self.assertEqual((plan[3]["archive"], plan[3]["names"]), ("", []))   # a date is no archive name

    def test_named_shots_take_their_commons_wording_first(self):
        rows = [{"text": "a", "queries": ["roman forum", "", ""]},                       # generic, earlier in the film
                {"text": "b", "queries": ["roman forum", "forum ruins", ""], "entities": ["Roman Forum"]}]
        plan = M._search_plan(rows, {})
        self.assertEqual([p["first"] for p in plan], ["bing", "commons"])
        self.assertEqual(plan[1]["commons"], "Roman Forum")
        self.assertNotEqual(plan[0]["commons"].lower(), "roman forum")   # its round-2 wording, never the named one's
        self.assertEqual(len({p["commons"].lower() for p in plan if p["commons"]}),
                         sum(1 for p in plan if p["commons"]))

    def test_saving_on_a_mostly_generic_film(self):
        rows = [{"text": f"line {k}", "queries": [f"mood picture {k}", f"shadow {k}", ""],
                 "entities": ["Vatican Library"] if k % 5 == 0 else []} for k in range(40)]
        plan = M._search_plan(rows, {})
        self.assertEqual(sum(1 for p in plan if p["first"] == "commons"), 8)
        self.assertTrue(all(p["web"] for p in plan))                       # every shot still searches the web


class SearchPlanMore(unittest.TestCase):
    def test_every_wording_taken_means_no_commons_search(self):
        rows = [{"text": f"t{k}", "queries": ["vault door", "", ""], "archive": ""} for k in range(3)]
        plan = M._search_plan(rows, {})
        self.assertEqual([p["commons"] for p in plan], ["vault door", "", ""])
        self.assertEqual([p["web"] for p in plan], [["vault door"]] * 3)    # a shot always searches the web

    def test_role_searches_run_once_for_a_film(self):
        dossier = {"visualBrief": {"people": [{"name": "Aldo Brunetti", "likenessKnown": False, "commons": "Catholic priest",
                                               "web": "priest reading old library", "portrait": "Italian priest portrait"}]}}
        rows = [{"text": f"Brunetti line {k}.", "entities": ["Aldo Brunetti"],
                 "queries": [f"priest scene {k}", f"library corner {k}", f"candle {k}"]} for k in range(3)]
        plan = M._search_plan(rows, dossier)
        webs = [q for p in plan for q in p["web"]]
        self.assertEqual(len(webs), len(set(webs)))
        self.assertEqual(plan[0]["web"], ["Italian priest portrait", "priest reading old library"])
        self.assertEqual(plan[1]["web"], ["priest scene 1", "library corner 1"])
        self.assertEqual(len({p["commons"] for p in plan}), 3)


class RoundOne(unittest.TestCase):
    """pictures() rounds 1-2 with every source stubbed (owner 2026-10-10, ~23:50): Bing first for a generic shot,
    Commons first only for a shot that names something, then Bing only when Commons gave nothing usable."""

    def run_pictures(self, env, named=False, commons_tier=6.0, web_tier=6.5, copy=True):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            rows = [{"text": f"Line number {i} about the vault.", "startMs": i * 4000, "endMs": (i + 1) * 4000,
                     "queries": [f"vault door {i}", f"bank vault {i}", ""],
                     "entities": [f"Vault {i}"] if named else []} for i in range(2)]
            calls, archive_calls, asked = [], [], {"commons": [], "web": []}
            commons_pic = {i: textured(d / "src" / f"c{i}.jpg", 10 + i) for i in range(2)}
            web_pic = {i: textured(d / "src" / f"w{i}.jpg", 20 + i) for i in range(2)}
            copy_pic = {i: textured(d / "src" / f"copy{i}.jpg", 10 + i, scale=(1280, 720)) for i in range(2)}

            def commons(q, folder, n=4):
                asked["commons"].append((q, folder.name))
                i = int(q.split()[-1])
                return [({"title": f"commons {i}", "url": "", "source": "commons", "license": "cc", "provider": "commons"},
                         commons_pic[i])]

            def web(queries, folder, n=6, skip=()):
                asked["web"].append((list(queries), folder.name))
                if not queries[0].split()[-1].isdigit():                       # round 2's wider wording: nothing
                    return []
                i = int(queries[0].split()[-1])
                return [({"title": f"web {i}", "url": "", "source": "web", "license": "", "provider": "bing"}, web_pic[i]),
                        ({"title": f"copy {i}", "url": "", "source": "web", "license": "", "provider": "bing"},
                         copy_pic[i])][:2 if copy else 1]

            def judge(engine, row, cands, dossier, before="", after=""):
                calls.append([c["title"] for c, _ in cands])
                return sorted([dict(c, photo=str(p), score=web_tier if c["provider"] == "bing" else commons_tier,
                                    studio=False, anchor=(0.5, 0.5), depiction="named-subject", flags=[], reason="",
                                    subject="", person=False) for c, p in cands], key=lambda c: -c["score"])
            e = Engine()
            M._search_reset(e)
            with mock.patch.dict(os.environ, env), mock.patch.object(M, "commons_photos", commons), \
                    mock.patch.object(M, "web_photos", web), mock.patch.object(M, "judge", judge), \
                    mock.patch.object(M, "archive_names", lambda *a, **k: None), \
                    mock.patch.object(M, "archive_photos", lambda q, f: archive_calls.append(q) or []), \
                    mock.patch.object(M, "_ai_picture", lambda *a, **k: None), \
                    mock.patch.object(M, "_stop", lambda engine, msg: engine.log("stopped: " + msg)):
                M.pictures(e, d / "job", rows, {})
            search = json.loads((d / "job" / "mrtruth" / "search.json").read_text())
            return rows, calls, archive_calls, e.lines, search, asked

    def test_generic_shot_bing_first_no_commons(self):
        rows, calls, archive_calls, lines, search, asked = self.run_pictures({"MRTRUTH_ARCHIVES": "0"})
        self.assertEqual(asked["commons"], [])                                        # Bing gave a usable picture
        self.assertEqual(sorted(calls), [["web 0", "copy 0"], ["web 1", "copy 1"]])
        self.assertEqual(archive_calls, [])
        self.assertTrue(all(r["pick"]["provider"] == "bing" for r in rows))
        self.assertEqual(search["first"], {"commons": 0, "bing": 2})
        self.assertEqual(search["commons_asked"], {"round1": 0, "round2": 0, "round3": 0})
        self.assertTrue(any(l.strip().startswith("search: Commons") for l in lines))
        self.assertTrue(any("search order: Commons first for 0 shots" in l and "Bing first for 2" in l for l in lines))
        self.assertTrue(any("on screen by source: bing 2" in l for l in lines))

    def test_named_shot_commons_first_and_bing_not_needed(self):
        rows, calls, _, lines, search, asked = self.run_pictures({"MRTRUTH_ARCHIVES": "0"}, named=True)
        self.assertEqual(sorted(q for q, _ in asked["commons"]), ["Vault 0", "Vault 1"])   # the archive name
        self.assertEqual(asked["web"], [])                                            # Commons was usable: no Bing
        self.assertEqual(sorted(calls), [["commons 0"], ["commons 1"]])
        self.assertTrue(all(r["pick"]["provider"] == "commons" for r in rows))
        self.assertEqual(search["first"], {"commons": 2, "bing": 0})
        self.assertEqual(search["commons_asked"]["round1"], 2)

    def test_named_shot_bing_when_commons_unusable_copy_dropped(self):
        rows, calls, _, _, search, asked = self.run_pictures({"MRTRUTH_ARCHIVES": "0"}, named=True, commons_tier=4.0)
        self.assertEqual(len(asked["web"]), 2)                                        # Commons was only generic
        self.assertEqual(sorted(calls), [["commons 0"], ["commons 1"], ["web 0"], ["web 1"]])   # the copy dropped
        self.assertTrue(all(r["pick"]["provider"] == "bing" for r in rows))
        self.assertEqual(search["search"].get("judge_copies"), 2)

    def test_generic_shot_round2_asks_commons_once(self):
        rows, calls, _, _, search, asked = self.run_pictures({"MRTRUTH_ARCHIVES": "0"}, web_tier=4.0, copy=False)
        self.assertEqual(sorted(f for _, f in asked["commons"]), ["commons_r2_0", "commons_r2_0"])   # once a shot
        self.assertEqual(sorted(q for q, _ in asked["commons"]), ["vault door 0", "vault door 1"])  # the plan's wording
        self.assertEqual(search["commons_asked"], {"round1": 0, "round2": 2, "round3": 0})
        self.assertTrue(all(r["pick"]["provider"] == "commons" and r["step"] == "contextual" for r in rows))
        # the Commons file is the very picture Bing brought (a near copy): it is not checked twice
        rows, calls, _, _, search, asked = self.run_pictures({"MRTRUTH_ARCHIVES": "0"}, web_tier=4.0)
        self.assertEqual(len(asked["commons"]), 2)
        self.assertEqual(search["search"].get("judge_copies"), 2)
        self.assertEqual(sorted(calls), [["web 0", "copy 0"], ["web 1", "copy 1"]])

    def test_archives_switched_on_keep_the_old_order(self):
        rows, calls, archive_calls, _, search, asked = self.run_pictures({"MRTRUTH_ARCHIVES": "1"})
        self.assertEqual(len(archive_calls), 2)
        self.assertIn(["commons 0"], calls)                                           # Commons judged on its own first
        self.assertIn(["web 0"], calls)
        self.assertEqual(search["first"], {"commons": 2, "bing": 0})


class Rank(unittest.TestCase):
    def test_commons_edge(self):
        # A2 (yes/no checks): older scored candidates are read as tiers (7+ exact, 5-6 kind, 3-4 generic); within a
        # tier Commons goes first, and a picture with something wrong goes after every clean one
        c = {"provider": "commons", "score": 6.0, "flags": []}
        w = {"provider": "bing", "score": 6.8, "flags": []}
        w2 = {"provider": "bing", "score": 7.5, "flags": []}
        weak = {"provider": "commons", "score": 4.0, "flags": []}
        flagged = {"provider": "commons", "score": 6.0, "flags": ["modernStock"]}
        order = sorted([w2, w, flagged, weak, c], key=M._rank)
        self.assertEqual([x["score"] for x in order], [7.5, 6.0, 6.8, 4.0, 6.0])
        self.assertIs(order[1], c)
        self.assertIs(order[-1], flagged)
        self.assertEqual(M._provider({"photo": "/j/pictures/s1/commons_r2_0/c00.jpg"}), "commons")
        self.assertEqual(M._provider({"photo": "/j/pictures/s1/web_r3/w1.jpg"}), "web")
        self.assertEqual(M._provider({"photo": "x", "ai": True}), "ai")


class Preflight(unittest.TestCase):
    def run_preflight(self, env, brave_status):
        def get(url, **kw):
            if "brave" in url:
                return Resp(brave_status, "{}", {"error": {"detail": "out of credit"}})
            return Resp(200, "{}", {"data": {"balance": 9.0}})
        e = Engine()
        base = {"GEMINI_API_KEY": "", "ANTHROPIC_API_KEY": "", "WAVESPEED_API_KEY": "", "BRAVE_SEARCH_API_KEY": "b",
                "MRTRUTH_ALLOW_DEGRADED": "0"}
        with mock.patch.dict(os.environ, dict(base, **env)), mock.patch("requests.get", get), \
                mock.patch("requests.post", lambda *a, **k: Resp(200, "{}", {})):
            try:
                M.preflight(e)
                return "ran", e.lines
            except M.OutOfCredit as x:
                return str(x), e.lines

    def test_dry_brave_is_a_warning_now(self):
        got, lines = self.run_preflight({"GEMINI_API_KEY": "g"}, 402)
        self.assertEqual(got, "ran")
        self.assertIn("HTTP 402", M._BRAVE_OUT["why"])
        self.assertTrue(any("Bing alone carries the web search" in l for l in lines))

    def test_dry_brave_still_stops_the_brave_only_order(self):
        with mock.patch.object(M, "WEB_SEARCH", "brave"):
            got, _ = self.run_preflight({"GEMINI_API_KEY": "g"}, 402)
        self.assertIn("Brave (web picture search)", got)

    def test_no_brave_key_is_a_warning(self):
        got, lines = self.run_preflight({"GEMINI_API_KEY": "g", "BRAVE_SEARCH_API_KEY": ""}, 200)
        self.assertEqual(got, "ran")
        self.assertTrue(any("nothing backs Bing up" in l for l in lines))


if __name__ == "__main__":
    unittest.main()
