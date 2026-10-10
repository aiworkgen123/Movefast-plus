"""Mr Truth: where the two lanes meet (2026-10-10). Lane B's pacing, capped sync and cap_shots on lane A's picture data
(tiers and clean from the yes/no checks, one photo identity, providers), lane A's era rule with lane B's pacing words
in one beats prompt, and the planned cuts reaching the stall check. Synthetic data only, no network, no paid calls.

    .venv/bin/python -m unittest tests.test_mrtruth_merge      (or run this file)
"""
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("MRTRUTH_VERDICTS", "off")
import mrtruth as M  # noqa: E402

LOG = []
ENG = types.SimpleNamespace(log=LOG.append, UTILITY_MODEL="x", SCRIPT_MODEL="x")


def picture(path: Path, seed: int, size=(640, 400)) -> str:
    """A made-up picture: smooth random blobs, so a resized copy is the same photo and another seed is not."""
    import numpy as np
    from PIL import Image
    rng = np.random.default_rng(seed)
    small = rng.integers(0, 255, (6, 8, 3), dtype=np.uint8)
    Image.fromarray(small).resize(size, Image.BICUBIC).save(path, quality=92)
    return str(path)


def checked(photo, tier=M.KIND, clean=True, **kw):
    """A candidate as lane A's checks leave it (tier, clean, bad, provider) - the score is only a derived log field."""
    return dict(photo=photo, tier=tier, clean=clean, bad=[] if clean else ["text"], provider="bing", looked="asked",
                score=M._SCORE_OF[tier] if clean else 1.0, **kw)


def rows_of(spans, picks, spares=None):
    rows = []
    for k, ((a, b), p) in enumerate(zip(spans, picks)):
        rows.append({"startMs": a, "endMs": b, "text": f"line {k}", "device": None, "pick": p,
                     "spare": list((spares or {}).get(k, [])), "_said": (a, b), "step": "exact"})
    return rows


class Prompt(unittest.TestCase):
    def test_one_beats_version_and_both_lanes_rules_in_the_prompt(self):
        self.assertEqual(M.BEATS_V, 6)                       # one bump for the era and the pacing words
        self.assertIn('"era"', M.QUERY_RULES)
        self.assertIn("on at least every second sentence;", M.QUERY_RULES)
        self.assertNotIn("every second shot", M.QUERY_RULES)
        asked = []

        def fake_ask(engine, prompt, max_tokens, model=""):
            asked.append(prompt)
            return {"scenes": [{"startMs": 0, "visualIntent": "x", "queries": ["a", "b", "c"], "entities": [],
                                "mood": "", "sceneType": "imagery", "era": "today"}]}
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            (job / "mrtruth").mkdir()
            (job / "s.srt").write_text("1\n00:00:00,000 --> 00:00:04,000\nOne short line.\n\n"
                                       "2\n00:00:04,000 --> 00:00:08,000\nAnother short line.\n", encoding="utf-8")
            eng = types.SimpleNamespace(log=lambda s: None, UTILITY_MODEL="x",
                                        _parse_srt_full=__import__("make_video")._parse_srt_full)
            real, M._ask = M._ask, fake_ask
            try:
                rows = M.beats(eng, job, job / "s.srt", "One short line. Another short line.", {})
            finally:
                M._ask = real
        self.assertTrue(asked)
        self.assertIn("every second sentence;", asked[0])
        self.assertIn('extra field "era"', asked[0])
        self.assertEqual(rows[0].get("era"), "today")         # the era survives the pacing join


class SplitParts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        d = Path(self.tmp.name)
        M._IDENT.clear()
        self.a = picture(d / "a.jpg", 1)
        self.a_copy = picture(d / "a_small.jpg", 1, (320, 200))      # the same photo at another size
        self.b = picture(d / "b.jpg", 2)
        self.c = picture(d / "c.jpg", 3)
        self.e = picture(d / "e.jpg", 5)
        self.f = picture(d / "f.jpg", 6)
        self.g = picture(d / "g.jpg", 7)
        self.assertTrue(M._same(self.a, self.a_copy) and not M._same(self.a, self.b))

    def tearDown(self):
        self.tmp.cleanup()

    def test_the_pool_takes_only_checked_pictures_and_never_a_copy_of_one_on_screen(self):
        spans = [(0, 4000), (4000, 16000), (16000, 20000)]
        picks = [checked(self.a), checked(self.f), checked(self.g)]
        spares = {1: [checked(self.a_copy),                          # a near copy of the photo on shot 0
                      checked(self.c, clean=False),                  # refused (added text)
                      checked(self.e, tier=M.GENERIC),               # under the shot's bar (kind)
                      {"photo": self.e, "looked": "later"},          # never looked at
                      checked(self.b)]}
        rows = rows_of(spans, picks, spares)
        pool = M._part_pool(rows, 1, 10000, 16000)
        self.assertEqual([c["photo"] for c in pool], [self.b])

    def test_a_repeat_counts_near_copies_and_goes_by_tier_not_score(self):
        s = 1000
        spans = [(0, 4 * s), (100 * s, 104 * s), (200 * s, 204 * s), (300 * s, 304 * s), (310 * s, 314 * s),
                 (420 * s, 424 * s), (424 * s, 440 * s)]
        picks = [checked(self.a), checked(self.a_copy),              # one photo shown twice (a near copy)
                 dict(checked(self.b), score=9.0),                   # kind, a stale high score
                 dict(checked(self.c, tier=M.EXACT), score=1.0),     # exact, a stale low score
                 checked(self.e, clean=False),                       # refused: never brought back
                 checked(self.f), checked(self.g)]
        rows = rows_of(spans, picks)
        pick, step = M._provisional(rows, 6, 430 * s, [])
        self.assertEqual(step, "split-reused")
        self.assertEqual(pick["photo"], self.c)                      # by tier: exact before kind
        self.assertTrue(pick["reused"])
        rows[3]["pick"] = checked(self.a)                            # a third showing of a is never allowed either
        rows[2]["pick"] = checked(self.a_copy)
        pick, step = M._provisional(rows, 6, 430 * s, [])
        self.assertNotIn(pick["photo"], (self.a, self.a_copy, self.e))

    def test_a_split_part_carries_the_checks_fields_into_shots_json(self):
        spans = [(0, 4000), (4000, 16000), (16000, 20000)]
        picks = [checked(self.a), checked(self.f, tier=M.EXACT), checked(self.g)]
        rows = rows_of(spans, picks, {1: [checked(self.b, tier=M.EXACT)]})
        cues = [(k * 4000, (k + 1) * 4000, f"line {k}") for k in range(5)]
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            (job / "words_heard.json").write_text(json.dumps([[f"w{k}", k * 4.0, k * 4.0 + 0.2] for k in range(5)]))
            info = M.cap_shots(ENG, job, rows, cues)
        self.assertEqual(len(info["splits"]), 1)
        part = next(r for r in rows if r.get("needs_picture"))
        self.assertEqual((part["step"], part["pick"]["photo"]), ("split-spare", self.b))
        self.assertTrue(all(r["endMs"] - r["startMs"] <= M.SCENE_MAX_S * 1000 for r in rows))
        # the shots.json fields plan_film writes for every row
        self.assertEqual((M.TIERS[M._tier(part["pick"])], M._provider(part["pick"])), ("exact", "bing"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
