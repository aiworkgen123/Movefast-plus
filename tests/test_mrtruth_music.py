"""The owner's background music under the narration (MRTRUTH_MUSIC, website 2026-10-12): looped to the film, faded,
ducked, at MRTRUTH_MUSIC_DB under the voice; nothing changes without it.
    python -m unittest tests/test_mrtruth_music.py"""
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import mrtruth as M  # noqa: E402


class E:
    def __init__(self):
        self.lines = []

    def log(self, s):
        self.lines.append(s)


def _gen(path, expr, seconds, layout="mono"):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                    f"aevalsrc='{expr}':s=44100:d={seconds}:c={layout}", str(path)], check=True)
    return path


class Music(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        # a "voice": a 300 Hz tone spoken in 2 s phrases with 0.6 s pauses; a 7 s "song" (looped about 4 times)
        self.voice = _gen(self.d / "voice.wav", "0.25*sin(2*PI*300*t)*lt(mod(t,2.6),2)", 30)
        self.song = _gen(self.d / "song.mp3", "0.3*sin(2*PI*440*t)|0.3*sin(2*PI*660*t)", 7, "stereo")

    def test_no_music_no_change(self):
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC": ""}):
            self.assertEqual(M._music_under(E(), self.d, self.voice), self.voice)
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC": str(self.d / "gone.mp3")}):
            self.assertEqual(M._music_under(E(), self.d, self.voice), self.voice)

    def test_music_under_the_voice(self):
        e = E()
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC": str(self.song), "MRTRUTH_MUSIC_DB": "-18"}):
            out = M._music_under(e, self.d, self.voice)
        self.assertEqual(out.name, "voice_music.flac")
        self.assertAlmostEqual(M._seconds_of(out), M._seconds_of(self.voice), delta=0.1)     # the film's length
        self.assertEqual(M._channels(out), 2)
        bed = self.d / "bed.flac"                    # the music alone: the mix less the voice
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(out), "-i", str(self.voice), "-filter_complex",
                        "[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=-1[v];[0:a][v]amix=inputs=2:"
                        "normalize=0[d]", "-map", "[d]", str(bed)], check=True)
        under = M._loudness(self.voice) - M._loudness(bed)
        self.assertTrue(17 <= under <= 25, under)    # -18 LU, a few more while he speaks (ducking)
        self.assertIn("music: song.mp3 under the narration at -18 LU", e.lines[-1])
        late = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", "2.1", "-t", "0.4", "-i", str(bed), "-af",
                               "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
        loop = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", "22", "-t", "1", "-i", str(bed), "-af",
                               "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
        self.assertNotIn("-inf", late + loop)        # music in a pause and still playing after the 7 s file looped
        def level(at):                               # the music alone in one of the voice's pauses
            got = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", str(at), "-t", "0.45", "-i", str(bed),
                                  "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
            return float(got.split("mean_volume: ")[1].split()[0])
        self.assertGreater(level(12.45) - level(28.05), 6)     # faded out over the last 5 s

    def test_level_is_clamped(self):
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC_DB": "+3"}):
            self.assertEqual(M._music_db(), -6.0)
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC_DB": "loud"}):
            self.assertEqual(M._music_db(), M.MUSIC_DB_DEFAULT)


if __name__ == "__main__":
    unittest.main()
