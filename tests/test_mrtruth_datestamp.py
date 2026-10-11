"""Mr Truth: the owner's date overlay (2026-10-11), `date-stamp` - in the library and the previews, never placed by the
planner until he rules where it goes, and the renderer's half in step with the planner's. Synthetic data only: no
network, no paid call, no render.

    .venv/bin/python -m unittest tests.test_mrtruth_datestamp -v
"""
import hashlib
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
from test_mrtruth_a0 import Engine, film_rows  # noqa: E402
from test_mrtruth_gate import cues_of, film, ident  # noqa: E402

R = HERE / "mrtruth_renderer"
read = lambda p: (R / p).read_text(encoding="utf-8")


class Planner(unittest.TestCase):
    def test_in_the_library_and_the_previews_with_his_words(self):
        on, pics, lo, hi, cap, pos, chain, lim = M.LIBRARY["date-stamp"]
        self.assertFalse(on)                                   # the table's never-placed mark
        self.assertIn("date-stamp", M.AWAITING_RULINGS)
        self.assertEqual((pics, chain, cap), (1, [], None))
        self.assertEqual((lo, hi), (3.5, 8.0))                 # his 45-frame build, then 2 s of the settled date
        self.assertAlmostEqual(M._need_s("date-stamp"), 3.8)
        self.assertIn("date-stamp", M.HARD_CUT_DEVICES)        # his clip cuts in and out hard
        self.assertEqual(M.BUILD_FRAMES["date-stamp"], 45)     # his entrance: 45 frames from the shot's first
        row = next(p for p in M.PREVIEW if p[0] == "date-stamp")
        self.assertEqual(row[2], 123)                          # his clip's length on screen
        self.assertEqual(row[5], {"id": "date-stamp", "date": "February", "year": "1994"})

    def test_never_placed(self):
        rows, cues = film_rows(n=20, secs=5.0, years=(3, 7))
        for i in range(len(rows)):
            self.assertFalse(M._can(rows, i, "date-stamp"))
            self.assertFalse(M._can(rows, i, "date-stamp", ignore_len=True))
        script = " ".join(c[2] for c in cues)
        at = len(" ".join(c[2] for c in cues[:3])) + 1
        opps = [{"templateId": "date-stamp", "startChar": at, "headline": "1947"}]
        M.assign(Engine(), rows, opps, script, cues, {}, "A Test Film")
        self.assertFalse([r for r in rows if (r.get("device") or {}).get("id") == "date-stamp"])
        # nothing that fills or offers templates knows it
        self.assertFalse([g for g, (ts, _, _) in M.OVERLAY_GROUPS.items() if "date-stamp" in ts])
        self.assertNotIn("date-stamp", M.GAP_TEMPLATES)
        self.assertNotIn("date-stamp", M.TEMPLATE_SPECS)
        self.assertNotIn("date-stamp", M._guide())
        self.assertNotIn("date-stamp", read("prompts.json"))

    def test_a_plan_that_carries_one_is_drawn_as_his(self):
        rows = film(n=4, texts=False)
        rows[2]["device"] = {"id": "date-stamp", "date": "February", "year": "1994"}
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)), \
                mock.patch.object(M, "_ident", ident), mock.patch.object(M, "_luma", lambda p: 0.3):
            sc = M.scenes(rows, Path(st), cues_of(rows))
        self.assertEqual(sc[2]["device"], {"id": "date-stamp", "date": "February", "year": "1994"})
        self.assertNotIn("ambience", sc[2])                    # no dust or leak over a template
        self.assertIn("shadow", sc[2]["grade"])                # a text overlay keeps the shadow look (under its type)


class Renderer(unittest.TestCase):
    def test_registered_drawable_and_never_chosen(self):
        dev = read("src/core/devices.ts")
        ids = dev[dev.index("export const DEVICE_IDS"):dev.index("] as const")]
        self.assertIn("'date-stamp'", ids)
        entry = dev[dev.index("  'date-stamp': {"):]
        entry = entry[:entry.index("\n  },\n")]
        self.assertIn("enabled: true", entry)
        self.assertIn("buildEndFrames: 45,", entry)
        self.assertIn("carriesOwnGrade: true", entry)
        self.assertIn("capSource: 'unstated'", entry)
        only = dev[dev.index("export const PLACED_BY_OPERATOR_ONLY"):]
        self.assertIn("'date-stamp'", only[:only.index("])")])
        self.assertIn("z.literal('date-stamp')", dev)
        self.assertIn("case 'date-stamp':", read("src/remotion/DeviceFrame.tsx"))
        self.assertIn("case 'date-stamp':", read("src/core/deviceChoice.ts"))

    def test_his_numbers(self):
        clock = read("src/remotion/animations/dateStampClock.ts")
        for want in ("rightEdgePx: 1840", "fontSizePx: 130", "baselinePx: 190.1", "fontSizePx: 65", "baselinePx: 269.0",
                     "opacity: 0.85, offsetXPx: 2.06, offsetYPx: 4.04, sigmaPx: 4.33", "opacity: 0.615, sigmaPx: 4.55",
                     "frames: 45, risePx: 60, bezier: [0.345, 0.085, 0.375, 0.875]", "colour: '#FFFFFF'"):
            self.assertIn(want, clock)
        tables = re.findall(r"const (DATE|YEAR)_ADVANCES: readonly number\[\] = \[([^\]]*)\]", clock)
        chars = 0x7F - 0x20 + 0x100 - 0xA0 + 7
        self.assertEqual([len(t[1].replace("\n", "").strip().rstrip(",").split(",")) for t in tables], [chars, chars])
        # 'February' and '1994' at his sizes, kerning left out: within 1.5% over his measured 529.9 and 150.6 px
        d = dict((k, [int(x) for x in v.replace("\n", "").strip().rstrip(",").split(",")]) for k, v in tables)
        idx = lambda c: ord(c) - 0x20 if ord(c) < 0x7F else ord(c) - 0xA0 + 0x5F
        feb = sum(d["DATE"][idx(c)] for c in "February") * 130 / 1000
        year = sum(d["YEAR"][idx(c)] for c in "1994") * 65 / 1000
        self.assertTrue(529.9 <= feb <= 529.9 * 1.015, feb)
        self.assertAlmostEqual(year, 150.6, delta=0.2)

    def test_fonts_are_the_matched_files_with_their_licences(self):
        fonts = R / "public" / "fonts"
        sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
        self.assertEqual(sha(fonts / "DMSerifDisplay-Regular.ttf"),
                         "c03775f8cc3db88cfea259b231abe13f94e6a3d3cb01c09477a2e42a1f5919e1")
        self.assertEqual(sha(fonts / "LibreBaskerville-Regular.ttf"),
                         "f5bc4341f15de5e877d8d95b6b14b33e9a3da1f8fef4ed0700ed407f096cffb6")
        for lic in ("OFL-DMSerifDisplay.txt", "OFL-LibreBaskerville.txt"):
            self.assertIn("SIL Open Font License, Version 1.1", (fonts / lic).read_text(encoding="utf-8"))
        loader = read("src/remotion/fonts.ts")
        self.assertIn("fonts/DMSerifDisplay-Regular.ttf", loader)
        self.assertIn("fonts/LibreBaskerville-Regular.ttf", loader)


if __name__ == "__main__":
    unittest.main()
