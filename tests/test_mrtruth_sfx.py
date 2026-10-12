"""Mr Truth SFX2 (owner 2026-10-11): his sounds for two templates - the highlighted page (a scribble on the first
highlight, one swish on the second and the third) and the gallery strip (three sounds) - placed on the renderer's own
clocks as his reference clips place them, at his level, never thinned by the transitions' 12 s gap rule.
Synthetic scenes only: no network, no paid call, no owner script or voice (his sounds are the repo's own files).

    .venv/bin/python -m unittest tests.test_mrtruth_sfx -v
"""
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import mrtruth as M  # noqa: E402

R = HERE / "mrtruth_renderer"
FPS = 30
# his reference page (ref_a.mp4): 3 + 4 + 3 highlighted words; his measured relations (verify/sfx2/hl/spec.json)
REF_PAGE = {"id": "highlight-page", "main": 1, "paragraphs": ["a", "b", "c"],
            "phrases": ["highlights specific text", "sequentially through all paragraphs", "exactly match text"]}
SCRIBBLE_STOP_AFTER_SWEEP_MS = 1014.1        # the scribble's dead stop after the first sweep starts
SWISH_RISE_IN_FILE_MS = 10.0                 # the swish file's own audible rise
# where each file's sample 0 sits in his clip, in page frames (L0 = the page's first frame), read on its MP4 edit
# lists (L = 30 t + 11.453646) by cross-correlating the files against his sound (verify/sfx2f/scripts/xc_ref.py):
# the scribble, his second highlight's swish, his third's (63984 samples = 1333 ms after it)
HIS_PAGE_SAMPLE0_L = (11.4536, 41.5649, 81.5549)
SWISH3_RISE_VS_YELLOW_MS = -338.2            # his third swish rises this long before its highlight's first yellow
# his three gallery sounds' onsets (first 5 ms RMS rise) in gallery frames, on his clip's edit-list time base
GALLERY_ONSETS_L = {"gallery_zoom_out.wav": 4.923, "gallery_pan.wav": 43.963, "gallery_zoom_in.wav": 112.886}
GALLERY_ONSET_IN_FILE_MS = {"gallery_zoom_out.wav": 8.98, "gallery_pan.wav": 10.29, "gallery_zoom_in.wav": 7.75}
GALLERY = {"id": "gallery-strip"}


def shot(start, n, kind="cut", dev=None):
    return {"startFrame": start, "durationFrames": n, "transitionIn": {"type": kind}, "device": dev}


def page(*phrases):
    return dict(REF_PAGE, phrases=list(phrases))


class Log:
    def __init__(self):
        self.lines = []

    def log(self, s):
        self.lines.append(s)


class Files(unittest.TestCase):
    def test_his_sounds_in_the_renderers_format(self):
        want = {"highlight_1.wav": 31402, "highlight_2.wav": 31881, "gallery_zoom_out.wav": 51178,
                "gallery_pan.wav": 102442, "gallery_zoom_in.wav": 26858}
        for name, n in want.items():
            with wave.open(str(R / "sfx" / name)) as w:
                self.assertEqual((w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()),
                                 (48000, 2, 2, n), name)
        named = {M.HL_SFX_FIRST[0], M.HL_SFX_SECOND[0], M.HL_SFX_THIRD[0], *(f for f, _ in M.GALLERY_SFX)}
        self.assertEqual(named, set(want))
        self.assertEqual(M.TPL_SFX_DB, 0.0)                         # his level, the file as cut

    def test_the_planner_counts_the_renderers_clocks(self):
        hl = (R / "src/remotion/animations/highlightPageClock.ts").read_text()
        self.assertEqual(int(re.search(r"framesPerWord:\s*(\d+)", hl).group(1)), M.HL_FRAMES_WORD)
        self.assertIn("cursor += span", hl)                           # chained from local 0, no gap
        # one eased wipe over the whole window: the same share of a sweep is the same share drawn at any length
        self.assertIn("clamp01((frame - window.from) / (window.to - window.from))", hl)
        gs = (R / "src/remotion/animations/galleryStripClock.ts").read_text()
        zoom_in = gs[gs.index("zoomIn: {"):]
        self.assertEqual(int(re.search(r"endFrame:\s*(\d+)", zoom_in).group(1)), 130)   # the landing his sound ends on


class Cues(unittest.TestCase):
    def test_his_page_his_timing(self):
        S = 300
        got = M._template_sounds([shot(S, 180, dev=REF_PAGE)])
        self.assertEqual([f for _, f, *_ in got], ["highlight_1.wav", "highlight_2.wav", "highlight_2.wav"])
        self.assertEqual([keep for _, _, keep, *_ in got], [None, None, None])   # nothing cut on his page
        for (t, *_), his in zip(got, HIS_PAGE_SAMPLE0_L):              # every file where his clip has it
            self.assertAlmostEqual((t - S / FPS) * FPS, his, delta=0.002)
        (t1, *_), (t2, *_), (t3, *_) = got
        self.assertAlmostEqual((t3 - t2) * 48000, 63984, delta=1)    # his two swishes 1333 ms apart
        stop = (t1 + M.HL_SFX_FIRST_STOP_S - S / FPS) * 1000
        self.assertAlmostEqual(stop, SCRIBBLE_STOP_AFTER_SWEEP_MS, delta=0.5)
        rise3 = (t3 + SWISH_RISE_IN_FILE_MS / 1000 - (S + 92) / FPS) * 1000   # H3's first yellow one frame in
        self.assertAlmostEqual(rise3, SWISH3_RISE_VS_YELLOW_MS, delta=1.0)

    def test_cues_follow_the_pages_own_words(self):
        got = M._template_sounds([shot(0, 240, dev=page("a b c d e", "f g", "h i j"))])
        self.assertAlmostEqual(got[0][0], M.HL_SFX_FIRST_STOP_FRAC * 65 / FPS - M.HL_SFX_FIRST_STOP_S, places=9)
        self.assertAlmostEqual(got[1][0], 65 / FPS + M.HL_SFX_SECOND[1], places=9)
        self.assertAlmostEqual(got[2][0], 91 / FPS + M.HL_SFX_THIRD[1], places=9)   # 0.47 s after the second: his
        self.assertAlmostEqual(got[1][2], got[2][0] - got[1][0] + M.TPL_SFX_FADE_S, places=9)

    def test_a_long_first_phrase_stops_the_scribble_as_far_into_its_sweep_as_his(self):
        # his stop comes when his 3-word highlight is 97% drawn; 4-8 words were 86% down to 35% with a fixed lead
        def drawn(x):                                 # the renderer's Material (0.4, 0, 0.2, 1) wipe at share x
            lo, hi = 0.0, 1.0
            for _ in range(50):
                u = (lo + hi) / 2
                lo, hi = (u, hi) if 3 * (1 - u) ** 2 * u * 0.4 + 3 * (1 - u) * u * u * 0.2 + u ** 3 < x else (lo, u)
            return 3 * (1 - u) * u * u + u ** 3
        for n in range(3, M.HL_PHRASE_WORDS + 1):
            got = M._template_sounds([shot(0, 400, dev=page(" ".join("w" * n), "f g h", "i j k"))])
            sweep = 13 * n / FPS
            stop = got[0][0] + M.HL_SFX_FIRST_STOP_S
            self.assertIsNone(got[0][2], n)                           # the whole scribble, its dead stop included
            self.assertAlmostEqual(drawn(stop / sweep), 0.969, delta=0.001, msg=n)
            self.assertLess(stop, sweep)
        five = M._template_sounds([shot(0, 400, dev=page("a b c d e", "f g h", "i j k"))])
        self.assertAlmostEqual((five[0][0] + M.HL_SFX_FIRST_STOP_S) * FPS, 50.7, delta=0.05)  # 65-frame sweep

    def test_a_short_first_phrase_never_starts_the_scribble_before_the_page(self):
        one = M._template_sounds([shot(600, 210, dev=page("review", "handwritten notation", "a b c d e f g"))])
        a = 600 / FPS
        self.assertAlmostEqual(one[0][0], a, places=9)                # on the page's first frame
        swish = one[1][0]
        self.assertAlmostEqual(swish, a + 13 / FPS + M.HL_SFX_SECOND[1], places=9)
        self.assertAlmostEqual(one[0][0] + one[0][2], swish + M.TPL_SFX_FADE_S, places=6)   # faded out as it starts
        two = M._template_sounds([shot(0, 210, dev=page("old review", "handwritten notation", "a b c"))])
        self.assertAlmostEqual((two[0][0] + M.HL_SFX_FIRST_STOP_S) * FPS, 20.28, delta=0.01)   # 97% of 26 frames
        self.assertIsNone(two[0][2])                                  # the whole scribble, before the swish
        self.assertLess(two[0][0] + M._sfx_samples("highlight_1.wav") / 48000, two[1][0])

    def test_a_one_word_second_phrase_keeps_the_swishes_apart(self):
        # his third swish's timing would start it 1 frame after the second: it waits, at most to his second's timing
        got = M._template_sounds([shot(0, 300, dev=page("a b", "c", "d e f"))])
        s3 = 39 / FPS
        self.assertAlmostEqual(got[2][0], s3 + M.HL_SFX_SECOND[1], places=9)
        self.assertGreater(got[2][0] - got[1][0], 0.43)               # the second under -60 dBFS before it is cut
        self.assertAlmostEqual(got[1][2], got[2][0] - got[1][0] + M.TPL_SFX_FADE_S, places=9)
        for n2 in (2, 3, 8):                                          # two words and up: his third swish's timing
            got = M._template_sounds([shot(0, 400, dev=page("a b c", " ".join("w" * n2), "d e f"))])
            self.assertAlmostEqual(got[2][0], (39 + 13 * n2) / FPS + M.HL_SFX_THIRD[1], places=9, msg=n2)
            self.assertGreaterEqual(got[2][0] - got[1][0], M.HL_SFX_GAP_S)

    def test_the_gallery_on_its_fixed_clock(self):
        S = 900
        got = M._template_sounds([shot(S, 135, dev=GALLERY)])
        self.assertEqual([(f, keep) for _, f, keep, *_ in got],
                         [("gallery_zoom_out.wav", None), ("gallery_pan.wav", None), ("gallery_zoom_in.wav", None)])
        for (t, f, *_), (_, frame) in zip(got, M.GALLERY_SFX):
            self.assertAlmostEqual(t, (S + frame) / FPS - 665 / 57600, places=9)   # his picture 665/57600 s late
            onset_l = (t + GALLERY_ONSET_IN_FILE_MS[f] / 1000) * FPS - S
            self.assertAlmostEqual(onset_l, GALLERY_ONSETS_L[f], delta=0.01, msg=f)
        t, f = got[-1][:2]
        end_l = (t + M._sfx_samples(f) / 48000) * FPS - S
        self.assertLess(end_l, 130)                                   # the whoosh ends on the landing, not after it
        self.assertGreater(end_l, 129.4)                              # 18.5 ms before it, as his

    def test_never_past_its_shot(self):
        cut = M._template_sounds([shot(0, 120, dev=GALLERY)])        # shorter than his 131 frames
        self.assertAlmostEqual(cut[-1][2], 4.0 - (113 / FPS - 665 / 57600), places=9)   # faded onto its last frame
        gone = M._template_sounds([shot(0, 112, dev=GALLERY)])
        self.assertEqual([f for _, f, *_ in gone], ["gallery_zoom_out.wav", "gallery_pan.wav"])
        self.assertEqual(M._template_sounds([shot(0, 90), shot(90, 120, dev={"id": "P03"})]), [])

    def test_the_previews_carry_them(self):
        for tid, what, frames, img, comp, fields in M.PREVIEW:
            got = M._template_sounds([{"startFrame": 0, "durationFrames": frames, "device": fields}])
            self.assertEqual(len(got), 3 if tid in ("highlight-page", "gallery-strip") else 1 if tid == "location-map" else 0,
                             tid)                                # (impl-z: the map's one sound is in the same list)

    def test_the_preview_reel_sounds_each_part_at_its_place(self):
        calls = []
        names = {n for _, _, _, img, comp, _ in M.PREVIEW for n in [img, *comp]}
        pics = {n: {"file": f"{n}.jpg", "title": n, "page": "", "license": ""} for n in names}
        with tempfile.TemporaryDirectory() as d, mock.patch.object(M, "HERE", Path(d)), \
                mock.patch.object(M, "_load", lambda p, default: pics), mock.patch.object(M, "render", lambda *a, **k: None), \
                mock.patch.object(M, "scenes", lambda rows, storage, cues=None: [{}]), \
                mock.patch.object(M, "_props", lambda sc: {}), \
                mock.patch.object(M.subprocess, "run", lambda a, **k: calls.append(a)):
            (Path(d) / "preview" / "mrtruth").mkdir(parents=True)
            M.preview("highlight-page,gallery-strip,P03")
        last = calls[-1]
        graph = last[last.index("-filter_complex") + 1]
        order = [tid for tid, *_ in M.PREVIEW if tid in ("highlight-page", "gallery-strip", "P03")]
        frames = {tid: n for tid, _, n, *_ in M.PREVIEW}
        at, want = 0, []
        for tid in order:
            fields = next(f for t, *_, f in M.PREVIEW if t == tid)
            want += M._template_sounds([{"startFrame": at, "durationFrames": frames[tid], "device": fields}])
            at += frames[tid]
        self.assertEqual(len(want), 6)
        self.assertEqual([Path(a).name for a in last if a.endswith(".wav")], [f for _, f, *_ in want])
        for t, *_ in want:
            self.assertIn(f"adelay={round(t * 48000)}S:all=1", graph)
        self.assertIn(f"atrim=end={at / FPS:.6f}", graph)          # the reel's whole length, silence under the rest
        self.assertTrue(all("-an" in c for c in calls[:-2]))         # the labelled parts carry no sound of their own


class Mix(unittest.TestCase):
    def graph(self, sc_list, channels=1):
        calls = []
        with tempfile.TemporaryDirectory() as d, mock.patch.object(M.subprocess, "run", lambda a, **k: calls.append(a)), \
                mock.patch.object(M, "_channels", lambda p: channels):
            out = M._sfx_audio(Log(), Path(d), Path(d) / "audio.mp3", sc_list)
        return out, (calls[0] if calls else None)

    def test_never_thinned_by_the_gap_rule_and_alone_on_their_shots(self):
        # two pages and a gallery inside 12 s, and a dip 2 s before the first page: the gap rule (meant for the
        # transitions) would keep one sound in 12 s; his nine all play. The dip INTO the second page (a section turn)
        # is left out so the page plays its own sounds; the flash 14 s later is kept as before
        sc = [shot(0, 60, "dipToBlack"), shot(60, 180, "cut", REF_PAGE), shot(240, 180, "dipToBlack", REF_PAGE),
              shot(420, 135, "cut", GALLERY), shot(555, 90), shot(645, 30, "flash"), shot(675, 60, "flash")]
        out, cmd = self.graph(sc)
        fc = cmd[cmd.index("-filter_complex") + 1]
        self.assertEqual(out.suffix, ".flac")                      # lossless: the film's one AAC encode is the final mux's
        files = [Path(a).name for a in cmd if a.endswith(".wav")]
        self.assertEqual(files, ["impact.wav", "shutter.wav", "highlight_1.wav", "highlight_2.wav", "highlight_2.wav",
                                 "highlight_1.wav", "highlight_2.wav", "highlight_2.wav", "gallery_zoom_out.wav",
                                 "gallery_pan.wav", "gallery_zoom_in.wav"])
        self.assertEqual(files.count("impact.wav"), 1)              # the dip into the second page left out
        for t, f, keep, a, b in M._template_sounds(sc):            # each placed to the sample
            self.assertIn(f"adelay={round(t * 48000)}S:all=1", fc)
        self.assertIn("adelay=0:all=1", fc)                         # the first dip, as before
        self.assertIn("adelay=21499:all=1", fc)                     # the flash at 21.5 s: as before, whole ms
        self.assertNotIn("adelay=22499", fc)                        # the next flash 1 s later: thinned, as before
        self.assertIn("pan=stereo|c0=c0|c1=c0", fc)                 # the mono voice to both sides at full level
        self.assertIn(f"alimiter=limit={M.MIX_CEILING}:", fc)                      # only overs are touched
        self.assertIn("amix=inputs=12:normalize=0", fc)
        self.assertIn("volume=0.0dB", fc)

    def test_a_transition_on_a_template_frame_gives_way(self):
        # the gallery shot cut in by a flash (transitions() no longer does it; a plan saved before still might)
        out, cmd = self.graph([shot(0, 60), shot(60, 135, "flash", GALLERY)])
        self.assertNotIn("shutter.wav", " ".join(cmd))
        self.assertEqual(sum(a.endswith(".wav") for a in cmd), 3)

    def test_the_shot_after_a_template_keeps_its_own_transition_sound(self):
        # (4 + 140) / 30 is 4.8 but 4 / 30 + 140 / 30 is 4.800000000000001: a float test once took the next shot's dip
        # for a gallery's own and dropped its thud (1 pair in 9). Only the template's own shot gives way
        for start, n in ((4, 140), (600, 140), (1200, 150), (7, 135), (33, 180)):
            for dev in (GALLERY, REF_PAGE):
                out, cmd = self.graph([shot(0, start), shot(start, n, "cut", dev), shot(start + n, 90, "dipToBlack")])
                fc = cmd[cmd.index("-filter_complex") + 1]
                self.assertEqual(sum(a.endswith("impact.wav") for a in cmd), 1, (start, n, dev["id"]))
                self.assertIn(f"adelay={int((start + n) / FPS * 1000)}:all=1[s0]", fc)

    def test_a_film_without_them_mixes_as_before(self):
        sc = [shot(0, 120), shot(120, 60, "dipToBlack"), shot(180, 240, "flash"), shot(420, 210, "cut", {"id": "P03"})]
        out, cmd = self.graph(sc)
        fc = cmd[cmd.index("-filter_complex") + 1]
        self.assertEqual(out.name, "voice_sfx.m4a")
        self.assertEqual(fc, "[1:a]aresample=48000,volume=-6.0dB,adelay=4000:all=1[s0];[0:a]aresample=48000[v];"
                             "[v][s0]amix=inputs=2:normalize=0:duration=first[a]")
        out, cmd = self.graph([shot(0, 120), shot(120, 60)])        # no sound at all: the voice as it is
        self.assertEqual((out.name, cmd), ("audio.mp3", None))

    def test_a_stereo_voice_stays_stereo(self):
        out, cmd = self.graph([shot(0, 60), shot(60, 180, "cut", REF_PAGE)], channels=2)
        fc = cmd[cmd.index("-filter_complex") + 1]
        self.assertIn("[0:a]aresample=48000,aformat=channel_layouts=stereo[v]", fc)

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg not installed")
    def test_mixed_to_the_sample_at_his_level(self):
        import numpy as np
        sc = [shot(0, 45), shot(45, 210, "cut", page("review", "handwritten notation", "a b c d e f g")),
              shot(255, 150, "flash", GALLERY), shot(405, 45)]
        with tempfile.TemporaryDirectory() as d:
            voice = Path(d) / "audio.mp3"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "15",
                            "-c:a", "libmp3lame", str(voice)], check=True)
            out = M._sfx_audio(Log(), Path(d), voice, sc)
            dec = lambda p: np.frombuffer(subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(p), "-f", "f32le",
                                                          "-ac", "2", "-ar", "48000", "-"], capture_output=True).stdout,
                                          np.float32).reshape(-1, 2)
            mix = dec(out)
            files = {f: dec(R / "sfx" / f) for f in ("highlight_1.wav", "highlight_2.wav", "gallery_zoom_out.wav",
                                                    "gallery_pan.wav", "gallery_zoom_in.wav")}
        cues = M._template_sounds(sc)
        first = round(cues[0][0] * 48000)
        self.assertEqual(first, 45 * 1600)                          # the scribble on the page's first frame
        self.assertFalse(np.abs(mix[:first]).max())                 # nothing before it: no shutter on the gallery
        fade, fade_in = round(M.TPL_SFX_FADE_S * 48000), round(M.HL_SFX_FIRST_FADE_IN_S * 48000)
        for j, (t, f, keep, a, b) in enumerate(cues):
            k, his = round(t * 48000), files[f]
            n = len(his) if keep is None else round(keep * 48000) - fade
            nxt = [round(c[0] * 48000) for c in cues if c[0] > t]
            if nxt:
                n = min(n, nxt[0] - k)                               # up to where the next one starts
            s = fade if j and cues[j - 1][2] is not None and cues[j - 1][0] + cues[j - 1][2] > t else 0   # under a fade
            if f == "highlight_1.wav":                               # his trim cut into it: faded in over 40 ms
                ramp = mix[k:k + fade_in]
                self.assertTrue((np.abs(ramp) <= np.abs(his[:fade_in]) + 2e-4).all())
                self.assertLess(np.abs(ramp[:48]).max(), 0.05 * np.abs(his[:fade_in]).max())
                s = fade_in
            np.testing.assert_allclose(mix[k + s:k + n], his[s:n], atol=2e-4, err_msg=f)
        scribble_end = round((cues[0][0] + cues[0][2]) * 48000)
        self.assertLess(np.abs(mix[scribble_end - 2:scribble_end + 200]).max(), 1e-3)   # faded out, the swish not risen


    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg not installed")
    def test_a_loud_voice_through_the_limiter(self):
        # a full voice under his sounds: the limiter adds no delay and touches nothing under full scale; where voice and
        # his pan hit sum over it, the mix stays at full scale
        import numpy as np
        rate, secs = 48000, 9.0
        k = np.arange(int(rate * secs))
        for amp, sc in ((0.5, [shot(0, 30), shot(30, 180, "cut", REF_PAGE), shot(210, 60)]),
                        (0.6, [shot(0, 30), shot(30, 150, "cut", GALLERY), shot(180, 90)])):
            dec = lambda p: np.frombuffer(subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(p), "-f", "f32le",
                                                          "-ac", "2", "-ar", "48000", "-"], capture_output=True).stdout,
                                          np.float32).reshape(-1, 2).astype(np.float64)
            got = {}
            for name, level in (("silent", 0.0), ("loud", amp)):     # his sounds alone (as the test above), then voiced
                with tempfile.TemporaryDirectory() as d:
                    voice = Path(d) / "audio.wav"
                    sine = (level * np.sin(2 * np.pi * 220 * k / rate)).astype(np.float32)
                    subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i",
                                    "-", "-c:a", "pcm_f32le", str(voice)], input=sine.tobytes(), check=True)
                    got[name] = dec(M._sfx_audio(Log(), Path(d), voice, sc))
            mix = got["loud"]
            want = got["silent"] + np.repeat(sine.astype(np.float64)[:, None], 2, 1)
            self.assertEqual(len(mix), len(want))
            over = np.abs(want).max(1) > 0.98
            near = np.convolve(over, np.ones(9601), "same") > 0          # 100 ms either side of an over
            np.testing.assert_allclose(mix[~near], want[~near], atol=2e-4)  # untouched, not one sample late
            self.assertLessEqual(np.abs(mix).max(), 1.0 + 1e-6)
            self.assertEqual(bool(over.any()), amp == 0.6, amp)          # the gallery's hit does sum over full scale


class Cut(unittest.TestCase):
    def test_the_gallery_and_the_page_open_on_a_hard_cut(self):
        rows = [{"startMs": k * 5000, "endMs": (k + 1) * 5000, "text": f"line {k}", "device": None,
                 "pick": {"photo": f"p{k}.jpg"}} for k in range(8)]
        rows[3]["device"], rows[6]["device"] = dict(GALLERY), dict(REF_PAGE)
        with mock.patch.object(M, "_content_draw", lambda text: 0.0):   # every draw a film burn or a flash
            M.transitions(rows)
        self.assertEqual(rows[3]["tin"], {"type": "cut", "durationFrames": 0})
        self.assertEqual(rows[6]["tin"], {"type": "cut", "durationFrames": 0})
        self.assertIn(rows[1]["tin"]["type"], ("filmBurn", "flash"))

    def test_never_burnt_over_at_their_end_and_a_section_turn_cuts_in_hard(self):
        # a gallery shot of 135-141 frames ends 5-11 frames after its landing at 130: a 12-frame burn out lay over it
        rows = [{"startMs": k * 4600, "endMs": (k + 1) * 4600, "text": f"line {k}", "device": None,
                 "pick": {"photo": f"p{k}.jpg"}} for k in range(10)]
        rows[2]["device"], rows[6]["device"] = dict(GALLERY), dict(REF_PAGE)
        with mock.patch.object(M, "_content_draw", lambda text: 0.0):   # every draw a film burn or a flash
            notes = M.transitions(rows)
        for k in (2, 6):
            self.assertIsNone(rows[k]["tout"], k)
            self.assertNotEqual(rows[k + 1]["tin"]["type"], "filmBurn", k)
        self.assertEqual(rows[3]["tin"]["type"], "flash")                # the next shot keeps a transition of its own
        self.assertEqual(notes, [])
        self.assertTrue(any(r["tin"]["type"] == "filmBurn" for r in rows))   # burns elsewhere, as before
        rows[2]["section_turn"] = rows[6]["section_turn"] = True
        rows[8]["section_turn"] = True
        notes = M.transitions(rows)
        self.assertEqual(rows[2]["tin"], {"type": "cut", "durationFrames": 0})
        self.assertEqual(rows[6]["tin"], {"type": "cut", "durationFrames": 0})
        self.assertEqual(rows[8]["tin"]["type"], "dipToBlack")           # a plain shot's section turn: its dip
        self.assertEqual(len(notes), 2)
        self.assertIn("gallery-strip", notes[0])
        self.assertIn("dip to black and thud left out", notes[1])


if __name__ == "__main__":
    unittest.main()
