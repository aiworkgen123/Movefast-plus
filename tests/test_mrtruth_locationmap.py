"""Mr Truth: the owner's map animation (2026-10-11), `location-map` - in the library and the previews, never placed by the
planner until he rules where it goes; its sound cued at his offset and level; its satellite plate made at planning time
(mrtruth_map.py: tiles stitched and cached, a lower zoom then nothing when the source is down, the place checked against
the geocoder); the renderer's half in step with both. Synthetic data only: no network, no paid call, no render.

    .venv/bin/python -m unittest tests.test_mrtruth_locationmap -v
"""
import hashlib
import io
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.parse
import wave
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mrtruth as M  # noqa: E402
import mrtruth_map as MAP  # noqa: E402
from test_mrtruth_a0 import Engine, film_rows  # noqa: E402
from test_mrtruth_gate import cues_of, film, ident  # noqa: E402

R = HERE / "mrtruth_renderer"
read = lambda p: (R / p).read_text(encoding="utf-8")


class Log:
    def __init__(self):
        self.lines = []

    def log(self, m):
        self.lines.append(m)


# ── the planner: in the library, never placed ─────────────────────────────────────────────────────────────────────────
class Planner(unittest.TestCase):
    def test_in_the_library_and_the_previews_with_his_place(self):
        on, pics, lo, hi, cap, pos, chain, lim = M.LIBRARY["location-map"]
        self.assertFalse(on)                                   # the table's never-placed mark
        self.assertIn("location-map", M.AWAITING_RULINGS)
        self.assertEqual((pics, lo, hi, cap, chain, lim), (1, 5.0, 8.0, None, [], {"label": 32}))
        self.assertEqual(M.BUILD_FRAMES["location-map"], 51)   # his name settles on frame 51
        row = next(p for p in M.PREVIEW if p[0] == "location-map")
        self.assertEqual(row[2], 240)                          # his shot: 8.000 s
        self.assertEqual(row[3], "map:Lake Monoun:5.58:10.585")
        self.assertEqual(row[5], {"id": "location-map", "label": "Lake Monoun"})

    def test_never_placed(self):
        rows, cues = film_rows(n=20, secs=6.0)
        for i in range(len(rows)):
            self.assertFalse(M._can(rows, i, "location-map"))
            self.assertFalse(M._can(rows, i, "location-map", ignore_len=True))
        script = " ".join(c[2] for c in cues)
        at = len(" ".join(c[2] for c in cues[:3])) + 1
        M.assign(Engine(), rows, [{"templateId": "location-map", "startChar": at, "headline": "Lake Monoun"}], script,
                 cues, {}, "A Test Film")
        self.assertFalse([r for r in rows if (r.get("device") or {}).get("id") == "location-map"])
        self.assertFalse([g for g, (ts, _, _) in M.OVERLAY_GROUPS.items() if "location-map" in ts])
        self.assertNotIn("location-map", M.GAP_TEMPLATES)
        self.assertNotIn("location-map", M.TEMPLATE_SPECS)
        self.assertNotIn("location-map", M._guide())
        self.assertNotIn("location-map", read("prompts.json"))

    def test_a_plan_that_carries_one_is_drawn_as_his(self):
        rows = film(n=4, texts=False)
        rows[2]["device"] = {"id": "location-map", "label": "Lake Monoun"}
        with tempfile.TemporaryDirectory() as st, mock.patch.object(M, "_stage", lambda s, p: M._key(p)), \
                mock.patch.object(M, "_ident", ident), mock.patch.object(M, "_luma", lambda p: 0.3):
            sc = M.scenes(rows, Path(st), cues_of(rows))
        self.assertEqual(sc[2]["device"], {"id": "location-map", "label": "Lake Monoun"})
        self.assertIsNotNone(sc[2]["asset"])                   # the plate is the shot's own picture
        self.assertNotIn("ambience", sc[2])                    # no dust or leak over a template
        self.assertNotIn("cinemaMove", sc[2])


# ── his sound ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def shot(start, n, kind="cut", dev=None):
    return {"startFrame": start, "durationFrames": n, "transitionIn": {"type": kind}, "device": dev}


MAPDEV = {"id": "location-map", "label": "Lake Monoun"}


class Sound(unittest.TestCase):
    def test_the_file_is_his_cut_in_the_renderers_format(self):
        with wave.open(str(R / "sfx" / M.MAP_SFX)) as w:
            self.assertEqual((w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()),
                             (48000, 2, 2, M.MAP_SFX_SAMPLES))
        self.assertEqual(M.MAP_SFX_OFFSET_SAMPLES, 5431)       # his first sample, 0.113146 s after the map's first frame
        self.assertEqual(M.MAP_SFX_DB, 0.0)                    # his level

    def test_placed_at_his_offset_and_cut_only_on_a_shorter_shot(self):
        full, short = M._map_sounds([shot(60, 240, dev=MAPDEV), shot(400, 150, dev=MAPDEV), shot(600, 90)])
        self.assertAlmostEqual(full[0], 2.0 + 5431 / 48000, places=9)
        self.assertGreater(full[1], M.MAP_SFX_SAMPLES / 48000 - 1e-3)          # his 8 s shot: the whole file
        self.assertNotIn("atrim", M._map_sound_chain(1, *full[:2]))
        self.assertAlmostEqual(short[1], 5.0 + 0.0485 - 5431 / 48000, places=6)  # cut 0.0485 s after the last frame
        chain = M._map_sound_chain(1, *short[:2])
        self.assertIn("atrim=end=4.935354", chain)
        self.assertIn("afade=t=out", chain)
        self.assertIn(f"adelay={round(short[0] * 48000)}S:all=1", chain)      # to the sample

    def _graph(self, sc_list, channels=1):
        calls = []
        with tempfile.TemporaryDirectory() as d, mock.patch.object(M.subprocess, "run", lambda a, **k: calls.append(a)), \
                mock.patch.object(M, "_channels", lambda p: channels):
            out = M._sfx_audio(Log(), Path(d), Path(d) / "audio.mp3", sc_list)
        return out, (calls[0] if calls else None)

    def test_never_thinned_and_heard_alone_on_its_shot(self):
        # a dip 4 s before the map would make the gap rule drop the next transition sound; the map's is never dropped,
        # and the flash cut INTO the map shot is left out so his sound plays as it is
        sc = [shot(0, 120), shot(120, 60, "dipToBlack"), shot(180, 240, "flash", MAPDEV), shot(420, 90, "dipToBlack")]
        out, cmd = self._graph(sc)
        fc = cmd[cmd.index("-filter_complex") + 1]
        self.assertEqual(out.suffix, ".flac")                  # lossless: the film's one AAC encode is the final mux's
        self.assertEqual(cmd.count(str(R / "sfx" / M.MAP_SFX)), 1)
        self.assertNotIn(str(R / "sfx" / "shutter.wav"), cmd)  # the flash on the map shot
        self.assertEqual(cmd.count(str(R / "sfx" / "impact.wav")), 1)   # 4 s dip kept; the next one is inside the gap rule
        self.assertIn(f"adelay={round((6.0 + 5431 / 48000) * 48000)}S:all=1", fc)
        self.assertIn("pan=stereo|c0=c0|c1=c0", fc)            # the mono voice to both sides at full level
        self.assertIn("alimiter=limit=1:", fc)                 # only overs are touched
        self.assertIn("amix=inputs=3:normalize=0", fc)

    def test_a_film_without_a_map_mixes_as_before(self):
        sc = [shot(0, 120), shot(120, 60, "dipToBlack"), shot(180, 240, "flash")]
        out, cmd = self._graph(sc)
        fc = cmd[cmd.index("-filter_complex") + 1]
        self.assertEqual(out.name, "voice_sfx.m4a")
        # the flash 2 s after the dip is thinned by the gap rule, exactly as before
        self.assertEqual(fc, "[1:a]aresample=48000,volume=-6.0dB,adelay=4000:all=1[s0];[0:a]aresample=48000[v];"
                             "[v][s0]amix=inputs=2:normalize=0:duration=first[a]")

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg not installed")
    def test_mixed_to_the_sample_at_his_level(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as d:
            voice = Path(d) / "audio.mp3"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "12",
                            "-c:a", "libmp3lame", str(voice)], check=True)
            out = M._sfx_audio(Log(), Path(d), voice, [shot(0, 45), shot(45, 240, "cut", MAPDEV), shot(285, 75)])
            dec = lambda p: np.frombuffer(subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(p), "-f", "f32le",
                                                          "-ac", "2", "-ar", "48000", "-"], capture_output=True).stdout,
                                          np.float32).reshape(-1, 2)
            mix, his = dec(out), dec(R / "sfx" / M.MAP_SFX)
        k = 45 * 1600 + 5431                                   # 1.5 s + his offset, in samples
        self.assertFalse(np.abs(mix[:k]).max())                # nothing before his first sample
        np.testing.assert_allclose(mix[k:k + len(his)], his, atol=2e-4)


# ── the plate: tiles, stitching, cache, fallback ───────────────────────────────────────────────────────────────────────
LAT, LON = 5.5791, 10.5853          # Lake Monoun (Nominatim)
TPU = 0.25                          # a small plate: 550 x 390


class TileWorld:
    """A fake tile service: grey tiles with a white 8 px dot at the place's own Mercator pixel; counts its requests and
    fails the zooms listed in `down` (or everything)."""

    def __init__(self, down=(), all_down=False, garbage=False):
        self.n, self.urls, self.down, self.all_down, self.garbage = 0, [], set(down), all_down, garbage

    def __call__(self, url, headers):
        from PIL import Image, ImageDraw
        self.n += 1
        self.urls.append(url)
        assert headers.get("User-Agent", "").startswith("MoveFast"), headers
        z, y, x = (int(v) for v in re.search(r"/(\d+)/(\d+)/(\d+)\.jpg$", url).groups())
        if self.all_down or z in self.down:
            raise OSError("service down")
        if self.garbage:
            return b"not a jpeg"
        im = Image.new("RGB", (256, 256), (90, 110, 70))
        cx, cy = MAP.merc_px(LAT, LON, z)
        dx, dy = cx - x * 256, cy - y * 256
        if -8 < dx < 264 and -8 < dy < 264:
            ImageDraw.Draw(im).ellipse((dx - 4, dy - 4, dx + 4, dy + 4), fill=(255, 255, 255))
        buf = io.BytesIO()
        im.save(buf, "PNG")                                   # lossless, so the dot's centre is exact
        return buf.getvalue()


class Plate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)
        self.sleep = mock.patch.object(MAP.time, "sleep", lambda s: None)
        self.sleep.start()

    def tearDown(self):
        self.sleep.stop()
        self.tmp.cleanup()

    def test_the_place_lands_at_the_plates_centre(self):
        import numpy as np
        world = TileWorld()
        z = MAP.fetch_zoom(LAT, TPU)
        self.assertLessEqual(MAP.metres_per_px(LAT, z), MAP.M_PER_UNIT / TPU)   # at least as fine as the plate
        self.assertGreater(MAP.metres_per_px(LAT, z - 1), MAP.M_PER_UNIT / TPU)  # and no finer than it needs
        im = MAP.stitch(LAT, LON, z, self.d / "tiles", world, TPU)
        self.assertEqual(im.size, (550, 390))
        a = np.asarray(im, np.float32).mean(2)
        w = np.clip(a - 100, 0, None)
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        cx, cy = (w * xx).sum() / w.sum() + 0.5, (w * yy).sum() / w.sum() + 0.5    # pixel centres
        self.assertAlmostEqual(cx, 1100 * TPU, delta=0.3)
        self.assertAlmostEqual(cy, 780 * TPU, delta=0.3)

    def test_tiles_are_cached(self):
        world = TileWorld()
        a = MAP.plate(LAT, LON, self.d / "a.jpg", self.d / "tiles", get=world, tpu=TPU, say=lambda m: None)
        asked = world.n
        self.assertTrue(a and not a["soft"] and asked > 4)
        b = MAP.plate(LAT, LON, self.d / "b.jpg", self.d / "tiles", get=world, tpu=TPU, say=lambda m: None)
        self.assertEqual(world.n, asked)                       # the second plate asked nothing
        self.assertEqual(a, b)
        self.assertTrue(all(u.startswith("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/") for u in world.urls))

    def test_one_zoom_lower_then_nothing(self):
        z = MAP.fetch_zoom(LAT, TPU)
        said = []
        got = MAP.plate(LAT, LON, self.d / "a.jpg", self.d / "tiles", get=TileWorld(down={z}), tpu=TPU, say=said.append)
        self.assertEqual((got["zoom"], got["soft"]), (z - 1, True))
        self.assertTrue((self.d / "a.jpg").exists())
        self.assertIn(f"zoom {z}", said[0])
        self.assertIsNone(MAP.plate(LAT, LON, self.d / "b.jpg", self.d / "t2", get=TileWorld(all_down=True), tpu=TPU,
                                    say=lambda m: None))
        self.assertFalse((self.d / "b.jpg").exists())
        self.assertIsNone(MAP.plate(LAT, LON, self.d / "c.jpg", self.d / "t3", get=TileWorld(garbage=True), tpu=TPU,
                                    say=lambda m: None))
        self.assertFalse(list((self.d / "t3").rglob("*.jpg")))  # a tile that does not decode is never kept

    def test_off_the_map_and_across_the_date_line(self):
        world = TileWorld()
        self.assertIsNone(MAP.plate(85.0, 10.0, self.d / "p.jpg", self.d / "tiles", get=world, tpu=TPU, say=lambda m: None))
        self.assertEqual(world.n, 0)
        got = MAP.plate(-17.0, 179.9, self.d / "f.jpg", self.d / "tiles", get=world, tpu=TPU, say=lambda m: None)
        self.assertTrue(got)
        for u in world.urls:                                   # x wraps: every column asked exists
            z, y, x = (int(v) for v in re.search(r"/(\d+)/(\d+)/(\d+)\.jpg$", u).groups())
            self.assertTrue(0 <= x < 2 ** z and 0 <= y < 2 ** z, u)

    def test_his_look_keeps_white_white_and_order(self):
        from PIL import Image
        ramp = Image.new("RGB", (256, 1))
        ramp.putdata([(v, v, v) for v in range(256)])
        out = list(MAP.grade(ramp).getdata())
        self.assertEqual(out[-1], (255, 255, 255))             # his cloud puffs are white
        for c in range(3):
            self.assertTrue(all(b[c] >= a[c] for a, b in zip(out, out[1:])))   # never inverts a tone
        g = MAP.grade(Image.new("RGB", (1, 1), (57, 70, 61))).getpixel((0, 0))  # S2's mean on his region
        self.assertTrue(abs(g[0] - 72) < 6 and abs(g[1] - 91) < 6 and abs(g[2] - 49) < 6, g)  # -> his mean look


# ── the place check ────────────────────────────────────────────────────────────────────────────────────────────────────
def place(name, lat, lon, span_km=2.0):
    d = span_km / 2 / 111.0
    return {"lat": str(lat), "lon": str(lon), "display_name": name, "category": "natural", "type": "water",
            "boundingbox": [str(lat - d), str(lat + d), str(lon - d), str(lon + d)]}


class Geocoder:
    def __init__(self, answers, fail=False):
        self.answers, self.fail, self.asked = answers, fail, []

    def __call__(self, url, headers):
        assert headers["User-Agent"].startswith("MoveFast"), headers
        q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["q"][0]
        self.asked.append(q)
        if self.fail:
            raise OSError("no route to host")
        return json.dumps(self.answers.get(q, [])).encode()


class Clock:
    def __init__(self):
        self.t, self.slept = 100.0, []

    def __call__(self):
        return self.t

    def sleep(self, s):
        self.slept.append(s)
        self.t += s


class Geocode(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name) / "geocode.json"
        MAP._NOM_LAST[0] = 0.0

    def tearDown(self):
        self.tmp.cleanup()

    def ask(self, geo, name, lat, lon, clock=None):
        clock = clock or Clock()
        return MAP.geocode(name, lat, lon, self.cache, get=geo, sleep=clock.sleep, clock=clock)

    def test_a_confident_place_uses_the_geocoders_point(self):
        geo = Geocoder({"Lake Monoun": [place("Lake Monoun, Cameroon", 5.5791, 10.5853), place("Monoun, Peru", -9.0, -75.0)]})
        g = self.ask(geo, "Lake Monoun", 5.58, 10.585)
        self.assertTrue(g["ok"])
        self.assertEqual((g["lat"], g["lon"]), (5.5791, 10.5853))
        self.assertLess(g["km"], 1)

    def test_unsure_places_are_refused(self):
        geo = Geocoder({"Lake Texoma": [place("Lake Texoma", 33.9, -96.6)],
                        "Texas": [place("Texas", 31.0, -99.0, span_km=1300)]})
        far = self.ask(geo, "Lake Texoma", 40.0, -96.6)          # the planner's point 680 km off
        self.assertFalse(far["ok"])
        self.assertIn("km from the planner's point", far["why"])
        self.assertFalse(self.ask(geo, "Texas", 31.2, -99.1)["ok"])   # a region, too large to ring
        self.assertIn("too large", self.ask(geo, "Texas", 31.2, -99.1)["why"])
        self.assertFalse(self.ask(geo, "Atlantis", 36.0, 25.0)["ok"])  # unknown
        self.assertFalse(self.ask(geo, "Lake Texoma", None, None)["ok"])   # no coordinates to check

    def test_a_feature_word_is_dropped_for_a_second_ask(self):
        geo = Geocoder({"Qumran": [place("Qumran", 31.7411, 35.4590)]})
        g = self.ask(geo, "Qumran Caves", 31.741, 35.459)
        self.assertTrue(g["ok"])
        self.assertEqual(geo.asked, ["Qumran Caves", "Qumran"])
        self.assertEqual(g["query"], "Qumran")
        self.assertEqual(MAP._queries("The Lake Texoma, Texas"), ["Lake Texoma, Texas", "Lake Texoma"])

    def test_answers_are_cached_and_a_failure_is_not(self):
        geo = Geocoder({"Lake Monoun": [place("Lake Monoun", 5.5791, 10.5853)]})
        self.ask(geo, "Lake Monoun", 5.58, 10.585)
        self.ask(geo, "lake  monoun", 5.58, 10.585)            # the same place: from the cache
        self.assertEqual(geo.asked, ["Lake Monoun"])
        down = Geocoder({}, fail=True)
        g = self.ask(down, "Lake Nyos", 6.44, 10.30)
        self.assertFalse(g["ok"])
        self.assertIn("could not be asked", g["why"])
        self.assertNotIn("lake nyos", json.loads(self.cache.read_text()))   # asked again next time

    def test_one_request_a_second(self):
        geo = Geocoder({"A": [place("A", 1.0, 1.0)], "B": [place("B", 2.0, 2.0)]})
        clock = Clock()
        self.ask(geo, "A", 1.0, 1.0, clock)
        clock.t += 0.3
        self.ask(geo, "B", 2.0, 2.0, clock)
        self.assertEqual(len(clock.slept), 1)
        self.assertAlmostEqual(clock.slept[0], 0.7, places=6)

    def test_build_place_gives_a_credited_picture_or_none(self):
        geo = Geocoder({"Lake Monoun": [place("Lake Monoun, Cameroon", LAT, LON)]})
        world = TileWorld()

        def get(url, headers):
            return geo(url, headers) if "nominatim" in url else world(url, headers)
        with mock.patch.object(MAP, "TEXELS_PER_UNIT", TPU), mock.patch.object(MAP.time, "sleep", lambda s: None):
            d = Path(self.tmp.name)
            pick = MAP.build_place("Lake Monoun", 5.58, 10.585, d / "maps", d / "shared", get=get, say=lambda m: None)
            self.assertTrue(Path(pick["photo"]).exists())
            self.assertEqual((pick["license"], pick["url"]), ("CC BY 4.0", "https://cloudless.eox.at"))
            self.assertIn("EOX IT Services GmbH", pick["title"])
            self.assertIn("Copernicus Sentinel data 2016", pick["title"])
            self.assertIn("OpenStreetMap", pick["title"])
            n = world.n
            again = MAP.build_place("Lake Monoun", 5.58, 10.585, d / "maps", d / "shared", get=get, say=lambda m: None)
            self.assertEqual((again["photo"], world.n, geo.asked), (pick["photo"], n, ["Lake Monoun"]))
            self.assertIsNone(MAP.build_place("Lake Monoun", 40.0, 10.585, d / "maps", d / "shared", get=get,
                                              say=lambda m: None))
        self.assertEqual(MAP.LAYER, "s2cloudless_3857")        # the 2016 mosaic: CC BY 4.0 (2018+ are NonCommercial)


# ── the label: the planner's width gate mirrors the renderer's ─────────────────────────────────────────────────────────
class Label(unittest.TestCase):
    def test_the_two_tables_are_one(self):
        ts = read("src/remotion/animations/locationMapFaceData.ts")
        chars = re.search(r"LOCATION_MAP_CHARS =\s*'((?:[^'\\]|\\.)*)'", ts).group(1)
        chars = re.sub(r"\\u([0-9A-Fa-f]{4})", lambda m: chr(int(m.group(1), 16)), chars)
        adv = [int(v) for v in re.search(r"LOCATION_MAP_ADVANCES: readonly number\[\] = \[([^\]]*)\]", ts).group(1)
               .replace("\n", "").strip().rstrip(",").split(",")]
        body = re.search(r"LOCATION_MAP_KERNING: Readonly<Record<string, number>> = \{([^}]*)\}", ts).group(1)
        kern = {re.sub(r"\\u([0-9A-Fa-f]{4})", lambda m: chr(int(m.group(1), 16)), k): int(v)
                for k, v in re.findall(r"'((?:[^'\\]|\\.)*)':\s*(-?\d+)", body)}
        self.assertEqual((chars, adv, kern), (MAP._CHARS, MAP._ADV, MAP._KERN))
        clock = read("src/remotion/animations/locationMapClock.ts")
        for want in (f"fontSize: {MAP.LABEL_FONT_SIZE}", f"tracking: {MAP.LABEL_TRACKING}",
                     f"maxWidth: {MAP.LABEL_MAX_WIDTH:g}", f"minFontSize: {MAP.LABEL_MIN_FONT_SIZE:g}"):
            self.assertIn(want, clock)
        self.assertIn(f"LOCATION_MAP_LABEL_MAX_CHARS = {MAP.LABEL_MAX_CHARS}", read("src/core/devices.ts"))

    def test_his_name_and_longer_ones(self):
        self.assertAlmostEqual(MAP.label_width("LAKE MONOUN"), 303.03, places=2)   # 4280/1000 em + 10 x 0.6
        self.assertEqual(MAP.label_layout("Lake Monoun"), {"lines": ["LAKE MONOUN"], "size": 69.4, "fits": True})
        self.assertEqual(MAP.label_layout("Qumran Caves")["size"], 69.4)
        self.assertEqual(MAP.label_layout("Lake Texoma, Texas")["lines"], ["LAKE TEXOMA, TEXAS"])
        shrunk = MAP.label_layout("Lake Texoma, Oklahoma")
        self.assertEqual(len(shrunk["lines"]), 1)
        self.assertTrue(52 <= shrunk["size"] < 69.4)            # set smaller before it wraps
        self.assertAlmostEqual(MAP.label_width(shrunk["lines"][0], shrunk["size"]), 464, delta=0.01)
        two = MAP.label_layout("Mount Kilimanjaro National Park")
        self.assertEqual(two["lines"], ["MOUNT KILIMANJARO", "NATIONAL PARK"])
        self.assertTrue(MAP.label_fits("Mount Kilimanjaro National Park"))
        self.assertFalse(MAP.label_fits("Lake Texoma, Texas and Oklahoma border"))   # past 32 characters
        self.assertFalse(MAP.label_fits("Llanfairpwllgwyngyllgogerychwyrndrobwll"))
        self.assertFalse(MAP.label_fits("长江"))                    # the face cannot draw it
        self.assertFalse(MAP.label_fits("  "))


# ── the renderer's half ────────────────────────────────────────────────────────────────────────────────────────────────
class Renderer(unittest.TestCase):
    def test_registered_drawable_and_never_chosen(self):
        dev = read("src/core/devices.ts")
        self.assertIn("'location-map'", dev[dev.index("export const DEVICE_IDS"):dev.index("] as const")])
        entry = dev[dev.index("  'location-map': {"):]
        entry = entry[:entry.index("\n  },\n")]
        for want in ("enabled: true", "buildEndFrames: 51,", "defaultDurationFrames: 240,", "pictures: 1,",
                     "carriesOwnGrade: true", "capSource: 'unstated'"):
            self.assertIn(want, entry)
        only = dev[dev.index("export const PLACED_BY_OPERATOR_ONLY"):]
        self.assertIn("'location-map'", only[:only.index("])")])
        self.assertIn("z.object({ id: z.literal('location-map'), label: deviceText(LOCATION_MAP_LABEL_MAX_CHARS) })", dev)
        self.assertIn("case 'location-map':", read("src/remotion/DeviceFrame.tsx"))
        self.assertIn("case 'location-map':", read("src/core/deviceChoice.ts"))

    def test_his_numbers(self):
        clock = read("src/remotion/animations/locationMapClock.ts")
        for want in ("referenceFrames: 240", "perspectivePx: 1600", "tiltDeg: 37.9842", "endHeadingDeg: 12.985",
                     "turnDeg: -33.9937", "pullBack: 0.86644", "colour: '#F7E440'", "dotRadius: 13.5",
                     "dotFade: { from: 0, to: 15 }", "ringRadius: 36", "ringStroke: 6",
                     "ringDraw: { from: 10.26, to: 34.12 }", "x0: 77.5", "xFade: 620", "thickness: 6",
                     "draw: { from: 29.95, to: 39.91 }", "fontSize: 69.4", "stroke: 1.1",
                     "entrance: { from: 20.728, to: 50.982, slide: 44.67, bezier: [0.281, 0.611, 0.223, 1] as const }",
                     "exit: { startBeforeEnd: 29.343, frames: 32.896, bezier: [0.306, 0.718, 0.192, 1] as const }",
                     "shadow: { colour: '#000000', opacity: 0.648, dx: 5.0, dy: 5.869, sigma: 6.293 }",
                     "vignette: { r0: 0.6135, r1: 1.6559, ex: 0.9234, ey: 0.9255, amount: [0.591, 0.6796, 0.4277] as const }",
                     f"metresPerUnit: {MAP.M_PER_UNIT}", "LOCATION_MAP_BUILD_END_FRAMES = 51"):
            self.assertIn(want, clock)
        x0, x1, y0, y1 = MAP.PLATE
        self.assertIn(f"plate: {{ x0: {x0}, x1: {x1}, y0: {y0}, y1: {y1} }}", clock)
        # his camera covers the plate on every frame (the end frame turned 13 deg needs +-1056.8 x +-741.9)
        h = lambda w, hh, a: (w * math.cos(a) + hh * math.sin(a), w * math.sin(a) + hh * math.cos(a))
        cx, cy = h(960, 540, math.radians(12.985))
        self.assertTrue(cx < x1 and cy < y1)

    def test_the_face_is_the_matched_file_with_its_licence(self):
        f = R / "public" / "fonts"
        self.assertEqual(hashlib.sha256((f / "BebasNeue-Regular.ttf").read_bytes()).hexdigest(),
                         "08e4623805102d819f58601e46e345648846075e363b2ceb23313c2d1c83ec73")
        self.assertIn("SIL Open Font License, Version 1.1", (f / "OFL-BebasNeue.txt").read_text(encoding="utf-8"))
        self.assertIn("fonts/BebasNeue-Regular.ttf", read("src/remotion/fonts.ts"))
        self.assertIn("BebasNeue-Regular.ttf", (f / "README.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
