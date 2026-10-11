"""MR TRUTH — the owner's map animation (2026-10-11, renderer `location-map`): the half that runs at PLANNING time.

His reference: a satellite map in perspective, the camera pulling back to top-down while a yellow ring draws round the
place and its name slides up beside a white line ('LAKE MONOUN'). The renderer draws it (mrtruth_renderer/src/remotion/
animations/LocationMap.tsx, every number in locationMapClock.ts) from ONE picture: the place's satellite plate, made
here, stored in the job like any other picture and never fetched at render time. This module makes that plate:

  imagery   EOX Sentinel-2 cloudless, the 2016 mosaic (WMTS layer `s2cloudless_3857`). Its licence is CC BY 4.0 (the
            layer's own WMTS abstract and cloudless.eox.at/pricing: "non-commercial use for the 2018 - 2025 data (under
            CC BY-NC-SA 4.0, or CC BY 4.0 for 2016)"), so a monetised video may use it with the credit in ATTRIBUTION.
            The 2018+ layers are NonCommercial and are never asked for; Google, Bing, Mapbox and Esri imagery are not
            used (their terms do not grant this). Tiles are cached under <output>/_shared/map_tiles/ and asked at most
            TILE_WORKERS at a time with a named User-Agent.
  plate     the M-unit rectangle LOCATION_MAP.plate (-1100..1100 x -780..780) at his ground scale (135.34 m a unit,
            Web Mercator, centred on the place) at TEXELS_PER_UNIT: his end frame at one texel a screen pixel, as his
            own texture had (his start view, magnified 1.87x, is soft, and so is ours). Fetched at the zoom that gives
            at least that, downsampled with Lanczos. Fallback: one zoom lower (softer), then no plate - the template is
            not used and the shot stays a photograph.
  grade     his look, fitted on his end frame against the same S2 imagery registered under it: per channel
            gain * x^gamma + offset (GRADE). Mean RGB 71.6/91.2/48.6 vs his 71.9/91.6/49.2, median hue 90 deg, saturation
            0.47 and value 0.36 for both. A smooth curve, not his region's histogram, so a desert or a city keeps its own
            colours under the same look.
  place     the planner's coordinates (from the dossier / Claude) checked against OpenStreetMap Nominatim: a name it
            cannot resolve, resolves only far from the planner's point (MATCH_KM) or resolves to a region too large to
            ring (MAX_PLACE_KM) is refused, and the template is not used there. 1 request a second at most, a named
            User-Agent, every answer cached (<output>/_shared/geocode_nominatim.json), per the usage policy.

FOR THE PLANNER (not written yet - the owner rules on placement later; nothing places this template today). To seat a
location-map on a shot the planner needs: the place's name as the narration says it (the label, `label_fits`), its
coordinates from the dossier or Claude (lat, lon), and the moment - the shot whose words name the place, 5-8 s long.
Then, at planning time: `pick = build_place(name, lat, lon, <job>/mrtruth/maps, <output>/_shared, say=engine.log)`;
a pick -> row["pick"] = pick, row["device"] = {"id": "location-map", "label": name}; None -> the shot keeps its
photograph. The sound is cued by mrtruth._sfx_audio from the device alone.

    python mrtruth_map.py plate "Lake Monoun" 5.58 10.585 out.jpg     # check the place and make its plate
"""
import hashlib
import io
import json
import math
import os
import re
import sys
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ── imagery ────────────────────────────────────────────────────────────────────────────────────────────────────────────
LAYER = "s2cloudless_3857"                 # EOX Sentinel-2 cloudless 2016, Web Mercator: CC BY 4.0 (2018+ are NC)
TILE_URL = "https://tiles.maps.eox.at/wmts/1.0.0/" + LAYER + "/default/g/{z}/{y}/{x}.jpg"
ATTRIBUTION = ("EOxCloudless 2016 https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus "
               "Sentinel data 2016)")
LICENSE = "CC BY 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
SOURCE_URL = "https://cloudless.eox.at"
PLACE_CREDIT = "place located with OpenStreetMap Nominatim (data (c) OpenStreetMap contributors, ODbL)"
USER_AGENT = (os.environ.get("MRTRUTH_MAP_USER_AGENT") or
              "MoveFast-MrTruth/1.0 (location-map template; +https://github.com/aiworkgen123/video-generator)")
TILE = 256
MAX_ZOOM = 13                              # 2016's 3857 pyramid is deeper; a 260 km view never needs more
TILE_WORKERS = 4                           # tiles asked at once
TILE_TRIES = 3

# his geometry (renderer locationMapClock.ts LOCATION_MAP: metresPerUnit, plate) - a unit test keeps them equal
M_PER_UNIT = 135.34
PLATE = (-1100, 1100, -780, 780)           # x0, x1, y0, y1 in M units, the place at 0, 0
TEXELS_PER_UNIT = 1.0
# his texture is softer than Sentinel-2 brought down to 135 m: a Gaussian of this many units (texels at 1 a unit) on the
# plate matches his texture's fine detail at every frame (Laplacian energy at full and half scale within 4% over his
# frames 0, 60 and 120; his end frame's high-frequency share within 6%)
SOFTEN_UNITS = 0.8
MAX_LAT = 80.0                             # Mercator beyond this stretches the plate too far: no map there
EARTH_M_PER_PX0 = 156543.03392804097       # Web Mercator ground metres per pixel at zoom 0 on the equator

# his look on the 2016 mosaic: out = 255 * clip(gain * (in/255)^gamma + offset), per channel, with gain + offset = 1 so
# white stays white (his cloud puffs are white). Fitted 2026-10-11 on this module's own plate (z11, softened) laid under
# his de-vignetted end frame: quantiles 1-99% within 1.2 / 1.3 / 2.1 levels (R / G / B)
GRADE = {"R": (0.5285, 1.3093, -0.3093), "G": (0.3633, 1.7267, -0.7267), "B": (0.5182, 1.5418, -0.5418)}

# ── place check ────────────────────────────────────────────────────────────────────────────────────────────────────────
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
MATCH_KM = 25.0                            # the planner's point and the geocoder's must agree within this
MAX_PLACE_KM = 150.0                       # a place whose extent is wider is a region, not a spot for the ring
NOMINATIM_GAP_S = 1.0                      # the usage policy: at most one request a second
_NOM_LOCK = threading.Lock()
_NOM_LAST = [0.0]


class ImageryError(RuntimeError):
    """A plate could not be made at this zoom (a tile missing, the service down, the place off the map)."""


def _http_get(url: str, headers: dict, timeout: float = 20.0) -> bytes:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:      # noqa: S310 - fixed https hosts above
        return r.read()


# ── imagery: tiles, stitching, grade ───────────────────────────────────────────────────────────────────────────────────
def merc_px(lat: float, lon: float, z: int) -> tuple:
    """The place in global Web Mercator pixels at zoom z (256-px tiles; x east, y south)."""
    n = TILE * 2 ** z
    s = math.sin(math.radians(lat))
    return (lon + 180.0) / 360.0 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n


def metres_per_px(lat: float, z: int) -> float:
    return EARTH_M_PER_PX0 * math.cos(math.radians(lat)) / 2 ** z


def fetch_zoom(lat: float, tpu: float = TEXELS_PER_UNIT) -> int:
    """The lowest zoom whose pixels are at least as fine as the plate's texels."""
    want = M_PER_UNIT / tpu
    z = math.ceil(math.log2(EARTH_M_PER_PX0 * math.cos(math.radians(lat)) / want) - 1e-9)
    return max(1, min(MAX_ZOOM, z))


def _tile(z: int, x: int, y: int, cache: Path, get) -> bytes:
    """One tile, from the cache or the service (TILE_TRIES tries); its bytes are checked to decode before keeping."""
    from PIL import Image
    path = cache / LAYER / str(z) / str(x) / f"{y}.jpg"
    if path.exists():
        return path.read_bytes()
    last = ""
    for k in range(TILE_TRIES):
        try:
            data = get(TILE_URL.format(z=z, x=x, y=y), {"User-Agent": USER_AGENT})
            with Image.open(io.BytesIO(data)) as im:
                im.load()
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(f".part{os.getpid()}")
            tmp.write_bytes(data)
            os.replace(tmp, path)
            return data
        except Exception as e:                                       # noqa: BLE001 - asked again, then this zoom fails
            last = f"{type(e).__name__}: {str(e)[:120]}"
            if k + 1 < TILE_TRIES:
                time.sleep(0.5 * 3 ** k)
    raise ImageryError(f"tile {z}/{x}/{y}: {last}")


def stitch(lat: float, lon: float, z: int, cache: Path, get=None, tpu: float = TEXELS_PER_UNIT):
    """The plate's rectangle at zoom z, as an RGB PIL image of (2200, 1560) * tpu pixels with the place at its centre."""
    from PIL import Image
    get = get or _http_get
    n = 2 ** z
    cx, cy = merc_px(lat, lon, z)
    upp = metres_per_px(lat, z) / M_PER_UNIT                    # M units per fetched pixel
    x0, x1, y0, y1 = PLATE
    left, right, top, bottom = cx + x0 / upp, cx + x1 / upp, cy + y0 / upp, cy + y1 / upp
    if top < 0 or bottom > TILE * n:
        raise ImageryError("the plate runs off the top or bottom of the map")
    tx0, tx1 = math.floor(left / TILE), math.floor((right - 1e-9) / TILE)
    ty0, ty1 = math.floor(top / TILE), math.floor((bottom - 1e-9) / TILE)
    cells = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * TILE, (ty1 - ty0 + 1) * TILE))
    with ThreadPoolExecutor(max_workers=TILE_WORKERS) as ex:      # x wraps across the date line
        datas = list(ex.map(lambda c: _tile(z, c[0] % n, c[1], cache, get), cells))
    for (tx, ty), data in zip(cells, datas):
        with Image.open(io.BytesIO(data)) as im:
            mosaic.paste(im.convert("RGB").resize((TILE, TILE)), ((tx - tx0) * TILE, (ty - ty0) * TILE))
    size = (round((x1 - x0) * tpu), round((y1 - y0) * tpu))
    box = (left - tx0 * TILE, top - ty0 * TILE, right - tx0 * TILE, bottom - ty0 * TILE)
    return mosaic.resize(size, Image.LANCZOS, box=box)


def soften(im, sigma: float):
    """A separable Gaussian of `sigma` pixels (edges held), as an RGB PIL image."""
    import numpy as np
    from PIL import Image
    if sigma <= 0:
        return im.convert("RGB")
    a = np.asarray(im.convert("RGB"), np.float32)
    r = max(1, math.ceil(3 * sigma))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-x * x / (2 * sigma * sigma))
    k /= k.sum()
    p = np.pad(a, ((r, r), (r, r), (0, 0)), mode="edge")
    h = sum(k[i] * p[:, i:i + a.shape[1], :] for i in range(2 * r + 1))
    v = sum(k[i] * h[i:i + a.shape[0], :, :] for i in range(2 * r + 1))
    return Image.fromarray(np.clip(v + 0.5, 0, 255).astype(np.uint8))


def grade(im):
    """His look (GRADE) on an RGB PIL image."""
    lut = []
    for ch in "RGB":
        g, k, o = GRADE[ch]
        lut += [max(0, min(255, round(255 * (k * (v / 255) ** g + o)))) for v in range(256)]
    return im.convert("RGB").point(lut)


def plate(lat: float, lon: float, out: Path, cache: Path, get=None, tpu: float = TEXELS_PER_UNIT, say=print):
    """The graded plate for a place, written to `out` (JPEG). Tries the fetch zoom, then one lower; returns
    {"zoom", "tiles_at", "size", "soft"} or None when neither could be made (the template is then not used)."""
    if not (-MAX_LAT <= lat <= MAX_LAT) or not (-180 <= lon <= 180):
        say(f"      map plate: {lat:.4f}, {lon:.4f} is outside the map's range")
        return None
    z0 = fetch_zoom(lat, tpu)
    for z in (z0, z0 - 1):
        try:
            im = stitch(lat, lon, z, cache, get, tpu)
        except ImageryError as e:
            say(f"      map plate at zoom {z}: {e}")
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".part.jpg")
        grade(soften(im, SOFTEN_UNITS * tpu)).save(tmp, "JPEG", quality=92, subsampling=0, optimize=True)
        os.replace(tmp, out)
        return {"zoom": z, "size": list(im.size), "soft": z < z0}
    return None


# ── the place check ────────────────────────────────────────────────────────────────────────────────────────────────────
def km_between(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(min(1.0, math.sqrt(a)))


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(name or "")).strip().lower())


# words that name a feature AT a place ("Qumran Caves" is filed under "Qumran"): left off for a second ask
_FEATURE_WORDS = {"cave", "caves", "ruin", "ruins", "site", "sites", "archaeological", "ancient", "excavation",
                  "excavations", "remains"}


def _queries(name: str) -> list:
    """The asks for a place, at most three: the name as written, without the feature words, the first comma part."""
    base = re.sub(r"^\s*the\s+", "", re.sub(r"\s+", " ", str(name or "")).strip(), flags=re.I)
    out = [base]
    bare = " ".join(w for w in base.split(" ") if w.lower().strip(",.") not in _FEATURE_WORDS).strip(" ,")
    if bare and bare != base:
        out.append(bare)
    first = base.split(",")[0].strip()
    if first and first not in out:
        out.append(first)
    return out[:3]


def _nominatim(query: str, cache: dict, get, sleep, clock) -> list:
    """Nominatim's answers for one ask, from the cache or one polite request (raises when it cannot be asked)."""
    key = _norm(query)
    if key in cache:
        return cache[key].get("results") or []
    q = {"q": query, "format": "jsonv2", "limit": "5"}
    if os.environ.get("NOMINATIM_EMAIL"):
        q["email"] = os.environ["NOMINATIM_EMAIL"]
    with _NOM_LOCK:                                              # the policy's one request a second, across threads
        wait = NOMINATIM_GAP_S - (clock() - _NOM_LAST[0])
        if wait > 0:
            sleep(wait)
        try:
            raw = (get or _http_get)(NOMINATIM_URL + "?" + urllib.parse.urlencode(q),
                                     {"User-Agent": USER_AGENT, "Accept-Language": "en"})
        finally:
            _NOM_LAST[0] = clock()
    found = [{"lat": float(r["lat"]), "lon": float(r["lon"]), "name": r.get("display_name") or r.get("name") or "",
              "bbox": [float(v) for v in (r.get("boundingbox") or [])][:4], "kind": r.get("category") or r.get("class") or "",
              "type": r.get("type") or ""} for r in json.loads(raw) if isinstance(r, dict) and "lat" in r and "lon" in r]
    cache[key] = {"results": found, "at": int(time.time())}
    return found


def geocode(name: str, lat, lon, cache_path: Path, get=None, sleep=time.sleep, clock=time.monotonic) -> dict:
    """The planner's place checked against Nominatim. {"ok": True, "lat", "lon", "name", "km", "query"} - the
    geocoder's point, used for the map - or {"ok": False, "why"}. Every answer is cached by its ask (a failed request
    is not); the asks are `_queries(name)` in turn until one resolves near the planner's point."""
    if not _norm(name):
        return {"ok": False, "why": "no place name"}
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return {"ok": False, "why": "the planner gave no coordinates to check"}
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return {"ok": False, "why": "the planner's coordinates are not on Earth"}
    cache = {}
    try:
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    before, why = json.dumps(cache, sort_keys=True), ""
    try:
        for query in _queries(name):
            try:
                found = _nominatim(query, cache, get, sleep, clock)
            except Exception as e:                               # noqa: BLE001 - no answer: the template is not used
                why = f"the geocoder could not be asked ({type(e).__name__}: {str(e)[:100]})"
                break
            if not found:
                why = why or f"the geocoder does not know '{name}'"
                continue
            best = min(found, key=lambda r: km_between(lat, lon, r["lat"], r["lon"]))
            km = km_between(lat, lon, best["lat"], best["lon"])
            if km > MATCH_KM:
                why = f"the geocoder puts '{query}' {km:.0f} km from the planner's point"
                continue
            if len(best["bbox"]) == 4:
                s_, n_, w_, e_ = best["bbox"]
                span = km_between(s_, w_, n_, e_)
                if span > MAX_PLACE_KM:
                    return {"ok": False, "why": f"'{query}' is a region {span:.0f} km across, too large for the ring"}
            return {"ok": True, "lat": best["lat"], "lon": best["lon"], "name": best["name"], "km": round(km, 2),
                    "query": query}
        return {"ok": False, "why": why or f"the geocoder does not know '{name}'"}
    finally:
        if json.dumps(cache, sort_keys=True) != before:
            try:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = cache_path.with_suffix(f".part{os.getpid()}")
                tmp.write_text(json.dumps(cache, indent=1, ensure_ascii=False), encoding="utf-8")
                os.replace(tmp, cache_path)
            except OSError:
                pass


# ── the whole planning step ────────────────────────────────────────────────────────────────────────────────────────────
def _slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40] or "place"


def build_place(name: str, lat, lon, folder: Path, shared: Path, get=None, say=print):
    """The map shot's picture for a place: checked, its plate made (or found made) in `folder`. The pick, shaped like
    every other picture of the film (credits.json reads it), or None - the place could not be checked, or no imagery."""
    g = geocode(name, lat, lon, shared / "geocode_nominatim.json", get=get)
    if not g["ok"]:
        say(f"      map for '{name}' not used: {g['why']}")
        return None
    tag = hashlib.sha1(f"{LAYER}|{g['lat']:.5f}|{g['lon']:.5f}|{TEXELS_PER_UNIT}|{SOFTEN_UNITS}|{json.dumps(GRADE)}|{PLATE}".encode()
                       ).hexdigest()[:10]
    out = folder / f"map_{_slug(name)}_{tag}.jpg"
    meta = out.with_suffix(".json")
    info = None
    if out.exists() and meta.exists():
        try:
            info = json.loads(meta.read_text(encoding="utf-8"))
        except ValueError:
            info = None
    if info is None:
        info = plate(g["lat"], g["lon"], out, shared / "map_tiles", get=get, say=say)
        if info is None:
            say(f"      map for '{name}' not used: no satellite imagery could be fetched")
            return None
        meta.parent.mkdir(parents=True, exist_ok=True)
        meta.write_text(json.dumps(dict(info, place=g), indent=1, ensure_ascii=False), encoding="utf-8")
    if info.get("soft"):
        say(f"      map for '{name}': imagery one zoom lower than planned (softer)")
    return {"photo": str(out), "title": f"{ATTRIBUTION}; {PLACE_CREDIT}", "url": SOURCE_URL, "source": "EOX",
            "license": LICENSE, "artist": "EOX IT Services GmbH", "tier": 3, "clean": True, "bad": [],
            "provider": "map", "map": {"lat": g["lat"], "lon": g["lon"], "place": g["name"], "zoom": info.get("zoom")}}


# ── the label (mirror of locationMapClock.ts: LOCATION_MAP.label and locationMapLabelLayout) ─────────────────────────
LABEL_FONT_SIZE, LABEL_TRACKING, LABEL_MAX_WIDTH, LABEL_MIN_FONT_SIZE = 69.4, 0.6, 464.0, 52.0
LABEL_MAX_CHARS = 32                       # devices.ts LOCATION_MAP_LABEL_MAX_CHARS

# Bebas Neue Regular in 1/1000 em (generated from mrtruth_renderer/public/fonts/BebasNeue-Regular.ttf, the same table
# as locationMapFaceData.ts): _ADV[i] is the advance of _CHARS[i]; _KERN every non-zero pair among A-Z, 0-9, punctuation
_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00a0\u00a1\u00a2\u00a3\u00a4\u00a5\u00a6\u00a7\u00a8\u00a9\u00aa\u00ab\u00ac\u00ad\u00ae\u00af\u00b0\u00b1\u00b2\u00b3\u00b4\u00b5\u00b6\u00b7\u00b8\u00b9\u00ba\u00bb\u00bc\u00bd\u00be\u00bf\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c6\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d0\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d7\u00d8\u00d9\u00da\u00db\u00dc\u00dd\u00de\u00df\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f7\u00f8\u00f9\u00fa\u00fb\u00fc\u00fd\u00fe\u00ff\u2018\u2019\u201c\u201d\u2013\u2014\u2026"
_ADV = [160, 210, 336, 412, 400, 589, 417, 188, 276, 276, 422, 400, 188, 270, 188, 389, 400, 400, 400, 400, 400, 400,
        400, 400, 400, 400, 188, 188, 400, 400, 400, 363, 696, 401, 404, 383, 406, 363, 344, 391, 420, 192, 265, 414,
        344, 538, 427, 400, 386, 400, 403, 372, 364, 402, 382, 557, 406, 394, 362, 276, 389, 276, 400, 300, 500, 401,
        404, 383, 406, 363, 344, 391, 420, 192, 265, 414, 344, 538, 427, 400, 386, 400, 403, 372, 364, 402, 382, 557,
        406, 394, 362, 276, 500, 276, 400, 160, 210, 400, 400, 400, 400, 500, 400, 500, 738, 280, 336, 400, 270, 738,
        500, 400, 400, 282, 282, 500, 405, 449, 188, 500, 282, 282, 335, 653, 653, 653, 363, 401, 401, 401, 401, 401,
        401, 580, 383, 363, 363, 363, 363, 192, 192, 192, 192, 423, 427, 400, 400, 400, 400, 400, 400, 400, 402, 402,
        402, 402, 394, 386, 407, 401, 401, 401, 401, 401, 401, 580, 383, 363, 363, 363, 363, 192, 192, 192, 192, 423,
        427, 400, 400, 400, 400, 400, 400, 400, 402, 402, 402, 402, 394, 386, 394, 188, 188, 336, 336, 300, 500, 500]
_KERN = {"&T": -10, "&Y": -13, "'A": -53, "'C": -6, "'G": -6, "'J": -73, "'O": -6, "'Q": -6, "'T": 10, "'V": 10, "'W":
         10, "'Y": 10, "(A": 10, "(J": 10, "(T": 15, "(V": 10, "(W": 10, "(X": 5, "(Y": 10, ",A": 10, ",C": -6, ",G":
         -6, ",J": 5, ",O": -6, ",Q": -6, ",T": -73, ",U": -2, ",V": -53, ",W": -25, ",X": 5, ",Y": -93, ",Z": 10,
         "-A": -20, "-J": -63, "-T": -73, "-V": -20, "-W": -8, "-X": -35, "-Y": -50, "-Z": -15, ".A": 10, ".C": -6,
         ".G": -6, ".J": 5, ".O": -6, ".Q": -6, ".T": -73, ".U": -2, ".V": -53, ".W": -25, ".X": 5, ".Y": -93, ".Z":
         10, "//": -140, "/A": -25, "/J": -45, "/T": 10, "/V": 10, "/W": 10, "/Y": 5, ":A": 10, ":J": 5, ":T": -35,
         ":V": -25, ":W": -5, ":X": 5, ":Y": -40, ":Z": 10, "A'": -53, "A)": 10, "A,": 10, "A-": -20, "A.": 10, "A/":
         10, "A:": 10, "AA": 5, "AC": -2, "AG": -2, "AO": -2, "AQ": -2, "AS": -3, "AT": -46, "AU": -2, "AV": -28, "AW":
         -14, "AX": 2, "AY": -46, "AZ": 4, "A\u2019": -53, "B'": -6, "BV": -4, "BW": -1, "BX": -7, "BY": -16,
         "B\u2019": -6, "CC": 2, "CG": 2, "CO": 2, "CQ": 2, "CS": 2, "CX": -7, "CY": -9, "D'": -6, "D,": -6, "D.": -6,
         "DA": -2, "DJ": -4, "DT": -4, "DV": -2, "DX": -16, "DY": -18, "E)": 10, "E,": 5, "E.": 5, "ES": 2, "EX": 2,
         "EZ": 2, "F'": 10, "F)": 15, "F,": -73, "F-": -5, "F.": -73, "F/": -30, "FA": -32, "FJ": -51, "FT": 10, "FV":
         5, "FW": 5, "F\u2019": 10, "GX": -13, "GY": -15, "J,": -2, "J.": -2, "J/": -10, "JA": -2, "K&": -5, "K)": 5,
         "K,": 5, "K-": -35, "K.": 5, "K:": 5, "KC": -16, "KG": -16, "KO": -16, "KQ": -16, "KS": -7, "KU": -1, "L&":
         10, "L'": -73, "L)": 15, "L,": 10, "L-": -73, "L.": 10, "L/": 10, "L:": 10, "LA": 4, "LC": -4, "LG": -4, "LJ":
         10, "LO": -4, "LQ": -4, "LT": -78, "LV": -46, "LW": -17, "LY": -88, "L\u2019": -73, "O'": -6, "O,": -6, "O.":
         -6, "OA": -2, "OJ": -4, "OT": -4, "OV": -2, "OX": -16, "OY": -18, "P,": -93, "P.": -93, "P/": -65, "PA": -35,
         "PJ": -57, "PS": 4, "PT": 2, "PX": -12, "PY": -5, "PZ": -2, "Q'": -6, "Q,": -6, "Q.": -6, "QA": -2, "QJ": -4,
         "QT": -4, "QV": -2, "QX": -16, "QY": -18, "R'": -5, "R,": 5, "R.": 5, "R/": 10, "R:": 5, "RT": -2, "RV": -4,
         "RW": -2, "RY": -16, "S-": -4, "SA": -3, "SX": -6, "SY": -6, "T'": 10, "T)": 15, "T,": -73, "T-": -73, "T.":
         -73, "T/": -45, "T:": -35, "TA": -46, "TC": -4, "TG": -4, "TJ": -51, "TO": -4, "TQ": -4, "TT": 10, "TV": 4,
         "TW": 4, "TY": 4, "T\u2019": 10, "U,": -2, "U.": -2, "U/": -10, "UA": -2, "UX": -1, "V&": -5, "V'": 10, "V)":
         10, "V,": -53, "V-": -20, "V.": -53, "V/": -25, "V:": -15, "VA": -28, "VC": -2, "VG": -2, "VJ": -48, "VO": -2,
         "VQ": -2, "VT": 4, "VV": 5, "VW": 5, "V\u2019": 10, "W'": 10, "W)": 10, "W,": -25, "W-": -8, "W.": -25, "W:":
         -5, "WA": -14, "WJ": -21, "WT": 4, "WV": 5, "WW": 5, "W\u2019": 10, "X&": -5, "X)": 5, "X,": 5, "X-": -35,
         "X.": 5, "X/": 10, "X:": 5, "XA": 2, "XC": -16, "XG": -16, "XO": -16, "XQ": -16, "XS": -6, "XU": -1, "Y&":
         -20, "Y'": 10, "Y)": 10, "Y,": -93, "Y-": -50, "Y.": -93, "Y/": -55, "Y:": -40, "YA": -46, "YC": -18, "YG":
         -18, "YJ": -58, "YO": -18, "YQ": -18, "YS": -16, "YT": 4, "Y\u2019": 10, "Z,": 10, "Z-": -15, "Z.": 10, "Z:":
         10, "ZZ": 5, "\u2019A": -53, "\u2019C": -8, "\u2019G": -8, "\u2019J": -73, "\u2019O": -8, "\u2019Q": -8,
         "\u2019T": 10, "\u2019V": 10, "\u2019W": 10, "\u2019Y": 10}


def label_text(label: str) -> str:
    return re.sub(r"\s+", " ", str(label or "")).strip().upper()


def label_width(line: str, size: float = LABEL_FONT_SIZE) -> float:
    base = lambda c: unicodedata.normalize("NFD", c)[0]
    em = sum(_ADV[_CHARS.index(c)] if c in _CHARS else 500 for c in line)
    em += sum(_KERN.get(base(a) + base(b), 0) for a, b in zip(line, line[1:]))
    return em * size / 1000 + LABEL_TRACKING * max(0, len(line) - 1)


def label_layout(label: str) -> dict:
    """{"lines", "size", "fits"}: his size when it fits, else smaller down to the floor, else two lines, else not."""
    text = label_text(label)

    def size_for(lines):
        widest = max(label_width(x) for x in lines)
        if widest <= LABEL_MAX_WIDTH:
            return LABEL_FONT_SIZE
        n = max(len(x) for x in lines)
        em = (widest - LABEL_TRACKING * max(0, n - 1)) / LABEL_FONT_SIZE
        return (LABEL_MAX_WIDTH - LABEL_TRACKING * max(0, n - 1)) / em
    one = size_for([text])
    if one >= LABEL_MIN_FONT_SIZE:
        return {"lines": [text], "size": min(LABEL_FONT_SIZE, one), "fits": True}
    words, best = text.split(" "), None
    for k in range(1, len(words)):
        lines = [" ".join(words[:k]), " ".join(words[k:])]
        size = size_for(lines)
        if best is None or size > best[1]:
            best = (lines, size)
    if best and best[1] >= LABEL_MIN_FONT_SIZE:
        return {"lines": best[0], "size": min(LABEL_FONT_SIZE, best[1]), "fits": True}
    return {"lines": best[0] if best else [text], "size": LABEL_MIN_FONT_SIZE, "fits": False}


def label_fits(label: str) -> bool:
    text = label_text(label)
    return bool(text) and len(text) <= LABEL_MAX_CHARS and all(c in _CHARS for c in text) and label_layout(text)["fits"]


if __name__ == "__main__":
    if len(sys.argv) == 6 and sys.argv[1] == "plate":
        nm, la, lo, dest = sys.argv[2], sys.argv[3], sys.argv[4], Path(sys.argv[5])
        out_root = Path(os.environ["MOVEFAST_OUTPUT"]).expanduser() if os.environ.get("MOVEFAST_OUTPUT") else HERE / "output"
        p = build_place(nm, la, lo, dest.parent, out_root / "_shared")
        if p:
            import shutil
            shutil.copyfile(p["photo"], dest)
            print(json.dumps(dict(p, photo=str(dest)), indent=1, ensure_ascii=False))
        else:
            sys.exit(1)
    else:
        print(__doc__)
