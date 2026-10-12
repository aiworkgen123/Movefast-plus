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


def _mean_db(path, at, length):
    got = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", str(at), "-t", str(length), "-i", str(path),
                          "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    return -200.0 if "mean_volume: -inf" in got else float(got.split("mean_volume: ")[1].split()[0])


class Music(unittest.TestCase):
    """Owner 2026-10-12: the music "should remain as it is uploaded" - no fades, no ducking, no levelling, no looping -
    with one setting, its volume (100% unless lowered)."""

    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        # a "voice": a 300 Hz tone spoken in 2 s phrases with 0.6 s pauses (30 s); "songs" of 12 s and 45 s
        self.voice = _gen(self.d / "voice.wav", "0.25*sin(2*PI*300*t)*lt(mod(t,2.6),2)", 30)
        self.short = _gen(self.d / "short.wav", "0.3*sin(2*PI*440*t)|0.3*sin(2*PI*660*t)", 12, "stereo")
        self.long = _gen(self.d / "long.wav", "0.3*sin(2*PI*440*t)|0.3*sin(2*PI*660*t)", 45, "stereo")

    def mix(self, song, volume=None):
        env = {"MRTRUTH_MUSIC": str(song)}
        env["MRTRUTH_MUSIC_VOLUME"] = "" if volume is None else str(volume)
        e = E()
        with mock.patch.dict(os.environ, env):
            out = M._music_under(e, self.d, self.voice)
        bed = self.d / f"bed_{song.stem}_{volume}.wav"            # the music alone: the mix less the voice
        if out != self.voice:
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(out), "-i", str(self.voice), "-filter_complex",
                            "[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=-1[v];[0:a][v]amix=inputs=2:"
                            "normalize=0[d]", "-map", "[d]", str(bed)], check=True)
        return out, bed, e

    def test_no_music_no_change(self):
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC": ""}):
            self.assertEqual(M._music_under(E(), self.d, self.voice), self.voice)
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC": str(self.d / "gone.mp3")}):
            self.assertEqual(M._music_under(E(), self.d, self.voice), self.voice)
        out, _, _ = self.mix(self.long, 0)                         # volume 0: no music at all
        self.assertEqual(out, self.voice)

    def test_as_uploaded_at_full_volume(self):
        out, bed, e = self.mix(self.long)                          # 100% unless set
        self.assertEqual(out.name, "voice_music.flac")
        self.assertAlmostEqual(M._seconds_of(out), M._seconds_of(self.voice), delta=0.1)   # cut at the film's end
        self.assertEqual(M._channels(out), 2)
        own = _mean_db(self.long, 10, 1)
        for at in (0.05, 2.2, 10, 15.5, 28.0):                     # start, a pause, speech: one level
            self.assertAlmostEqual(_mean_db(bed, at, 0.5), own, delta=0.3, msg=at)    # no fade in, no ducking
        hush = _gen(self.d / "hush.wav", "0.0001*sin(2*PI*300*t)", 30)          # the last moment, on its own
        with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC": str(self.long), "MRTRUTH_MUSIC_VOLUME": ""}):
            end = M._music_under(E(), self.d, hush)
        self.assertAlmostEqual(_mean_db(end, 29.6, 0.3), own, delta=0.3)             # no fade out
        self.assertIn("long.wav as uploaded at 100% under the narration, stops at the film's end", e.lines[-1])

    def test_volume_lowers_it(self):
        _, bed, e = self.mix(self.long, 50)
        self.assertAlmostEqual(_mean_db(bed, 10, 1), _mean_db(self.long, 10, 1) - 6.02, delta=0.3)
        self.assertIn("at 50%", e.lines[-1])

    def test_a_shorter_song_plays_once(self):
        _, bed, e = self.mix(self.short)
        self.assertGreater(_mean_db(bed, 11, 0.5), -20)            # still playing
        self.assertLess(_mean_db(bed, 14, 2), -80)                 # then silence: not looped
        self.assertIn("ends 18s before the film", e.lines[-1])

    def test_volume_setting(self):
        for v, want in (("", 100.0), ("100", 100.0), ("35", 35.0), ("250", 100.0), ("-3", 0.0), ("loud", 100.0)):
            with mock.patch.dict(os.environ, {"MRTRUTH_MUSIC_VOLUME": v}):
                self.assertEqual(M._music_volume(), want, v)


if __name__ == "__main__":
    unittest.main()
