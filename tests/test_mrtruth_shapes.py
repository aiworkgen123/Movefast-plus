"""A model may write a list as a labelled object, or as one sentence: the planner reads either the same way.
Claude Haiku 5.5 wrote every shot's three searches as {"literal": ..., "conceptual": ..., "mood": ...}, and reading
that as a list kept only the labels, so every search of the film was "literal" (test film 2026-10-12)."""
import sys
import tempfile
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import mrtruth as M  # noqa: E402


class Shapes(unittest.TestCase):
    def test_strings_from_a_list_an_object_or_a_sentence(self):
        self.assertEqual(M._strings({"mood": "m", "literal": "l", "conceptual": "c"}, M.QUERY_ORDER), ["l", "c", "m"])
        self.assertEqual(M._strings({"x": "1", "literal": "l"}, M.QUERY_ORDER), ["l", "1"])
        self.assertEqual(M._strings(["a", None, "", "b"]), ["a", "b"])
        self.assertEqual(M._strings("Hushed, archival"), ["Hushed, archival"])
        self.assertEqual(M._strings(None), [])

    def test_the_dossier_lists_stay_lists(self):
        got = M._dossier({"visualStyle": "Hushed, archival", "avoidVisualCategories": ["x"], "topic": "t"})
        self.assertEqual(got, {"visualStyle": ["Hushed, archival"], "avoidVisualCategories": ["x"], "topic": "t"})
        self.assertIn("look: Hushed, archival", M._film_block(got))        # not "H; u; s; h; e; d"
        self.assertEqual(M._dossier(None), {})

    def test_labelled_searches_reach_the_shot_as_searches(self):
        def fake_ask(engine, prompt, max_tokens, model=""):
            return {"scenes": [{"startMs": 0, "visualIntent": "x", "entities": [], "mood": "", "sceneType": "imagery",
                                "era": "today", "queries": {"literal": "Vatican library reading room 1950s",
                                                            "conceptual": "forbidden knowledge", "mood": "hushed"}}]}
        with tempfile.TemporaryDirectory() as d:
            job = Path(d)
            (job / "mrtruth").mkdir()
            (job / "s.srt").write_text("1\n00:00:00,000 --> 00:00:04,000\nOne short line.\n\n", encoding="utf-8")
            eng = types.SimpleNamespace(log=lambda s: None, UTILITY_MODEL="x",
                                        _parse_srt_full=__import__("make_video")._parse_srt_full)
            real, M._ask = M._ask, fake_ask
            try:
                rows = M.beats(eng, job, job / "s.srt", "One short line.", {})
            finally:
                M._ask = real
        self.assertEqual(rows[0]["queries"], ["Vatican library reading room 1950s", "forbidden knowledge", "hushed"])


if __name__ == "__main__":
    unittest.main()
