"""Mr Truth: the renderer's frame encode keeps every colour (2026-10-11). Remotion renders each frame to JPEG (BT.601
full-range YCbCr) and its bt709 encode converted them with `zscale=matrix=709:matrixin=709`, so every saturated colour
of every shot came out moved (#F7E440 -> (250, 219, 56), the light leak 8-9 levels hotter); render.mjs reads the
frames as what they are. Synthetic data only: no render.

    .venv/bin/python -m unittest tests.test_mrtruth_render_colour -v
"""
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
R = HERE / "mrtruth_renderer"


class FrameEncode(unittest.TestCase):
    def test_jpeg_frames_are_read_as_bt601(self):
        # Remotion's bt709 encode read the JPEG frames' BT.601 YCbCr as BT.709 (#F7E440 came out (250, 219, 56))
        mjs = (R / "movefast" / "render.mjs").read_text(encoding="utf-8")
        self.assertIn("const JPEG_AS_709 = 'zscale=matrix=709:matrixin=709:range=limited';", mjs)
        self.assertIn("const JPEG_AS_601 = 'zscale=matrixin=470bg:rangein=full:matrix=709:range=limited';", mjs)
        self.assertIn("args[i - 1] === '-vf' ? jpegMatrix(arg) : arg", mjs)
        self.assertIn("imageFormat: 'jpeg'", mjs)
        remotion = R / "node_modules" / "@remotion" / "renderer" / "dist" / "ffmpeg-args.js"
        if remotion.exists():                                  # the string the override replaces is Remotion's own
            self.assertIn("'zscale=matrix=709:matrixin=709:range=limited'", remotion.read_text(encoding="utf-8"))

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg not installed")
    def test_the_fixed_filter_keeps_his_yellow(self):
        import numpy as np
        from PIL import Image

        def through(vf):
            with tempfile.TemporaryDirectory() as d:
                Image.new("RGB", (64, 64), (247, 228, 64)).save(Path(d) / "f.jpg", quality=95, subsampling=0)
                subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "image2pipe", "-vcodec", "mjpeg", "-i",
                                str(Path(d) / "f.jpg"), "-vf", vf, "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "1",
                                "-colorspace", "bt709", "-color_range", "tv", str(Path(d) / "f.mp4")], check=True)
                raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(Path(d) / "f.mp4"), "-vf",
                                      "scale=in_color_matrix=bt709:in_range=tv,format=rgb24", "-f", "rawvideo", "-"],
                                     capture_output=True, check=True).stdout
            return np.frombuffer(raw, np.uint8).reshape(64, 64, 3)[32, 32].astype(int)
        fixed = through("zscale=matrixin=470bg:rangein=full:matrix=709:range=limited")
        self.assertLessEqual(int(np.abs(fixed - [247, 228, 64]).max()), 3, fixed)
        before = through("zscale=matrix=709:matrixin=709:range=limited")
        self.assertGreater(int(np.abs(before - [247, 228, 64]).max()), 6, before)   # the error it fixes


    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg not installed")
    def test_the_earlier_copies_keep_their_colours(self):
        # the owner's earlier 1:1 copies were measured off his own files, not off our encode: through the fixed filter
        # the light leak (screen-blended over black, it is the plate itself), the typed caption and the gold come back
        # as made; the old filter ran the leak 8-9 levels hotter in red and green
        import numpy as np
        from PIL import Image

        def through(img, vf):
            with tempfile.TemporaryDirectory() as d:
                img.save(Path(d) / "f.jpg", quality=90)
                subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "image2pipe", "-vcodec", "mjpeg", "-i",
                                str(Path(d) / "f.jpg"), "-vf", vf, "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "12",
                                "-colorspace", "bt709", "-color_range", "tv", str(Path(d) / "f.mp4")], check=True)
                raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(Path(d) / "f.mp4"), "-vf",
                                      "scale=in_color_matrix=bt709:in_range=tv,format=rgb24", "-f", "rawvideo", "-"],
                                     capture_output=True, check=True).stdout
            return np.frombuffer(raw, np.uint8).reshape(img.size[1], img.size[0], 3).astype(float)
        fixed, old = "zscale=matrixin=470bg:rangein=full:matrix=709:range=limited", "zscale=matrix=709:matrixin=709:range=limited"
        leak = Image.open(R / "public" / "fx" / "leak" / "045.jpg").convert("RGB")
        src = np.asarray(leak, float)
        hot = src.max(2) > 80
        self.assertLessEqual(float(np.abs(through(leak, fixed)[hot].mean(0) - src[hot].mean(0)).max()), 1.5)
        self.assertGreater(float(np.abs(through(leak, old)[hot].mean(0) - src[hot].mean(0)).max()), 5)
        for c in ((243, 225, 206), (201, 162, 39), (255, 252, 232)):           # typed caption, accent gold, top-title cream
            got = through(Image.new("RGB", (32, 32), c), fixed)[16, 16]
            self.assertLessEqual(float(np.abs(got - c).max()), 3, (c, got))

if __name__ == "__main__":
    unittest.main()
