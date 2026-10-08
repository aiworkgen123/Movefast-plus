#!/usr/bin/env python3
"""photofx.py — the PHOTO FX DLC: three ways a still picture comes alive.

SPOTLIGHT  When the voice names a real person, place or moment, a real photograph of it: the camera
           pushes in on the subject while the rest of the picture darkens, loses its colour and blurs.
           The subject is cut out, so it stays sharp and grows a little against the fading ground.
OBJECTS    When the voice names a real thing — a Pepsi can, a Rolex, a gold bar — the thing is cut out
           of a real photo and animated over a blurred ground in its own colours, with a soft shadow:
           it rises in turning and settles, a crown drops onto it and wobbles, two things slide in to
           be compared, a row of them pops in.
DEPTH      On AI pictures of people and vehicles: the person (or the car) is lifted off the picture with a
           thin light keyline and slowly grows while the background pulls back.

    python photofx.py depth picture.jpg                            # one AI still, 5 seconds
    python photofx.py spotlight photo.jpg --subject "the man in the red shirt"
    python photofx.py object "Dr Pepper can" --accent "silver crown"
    python photofx.py object "Pepsi can" --also "Coca-Cola can"    # two things, compared
    python photofx.py find "Dr Pepper can"                         # what the image search finds
    python photofx.py check                                        # offline: layers, ffmpeg, Chromium

How it works
------------
* Cutouts come from WaveSpeed's background remover ($0.004 a picture, WAVESPEED_API_KEY in .env). Each is
  kept under the picture's hash, so a picture is never paid for twice.
* Real photos are found with web image search and Wikimedia Commons. Stock-photo sites are skipped (watermarks). Claude looks at the candidates, picks the
  photo that really shows the thing and says where in it the subject is.
* SPOTLIGHT and OBJECTS are scenes on the words, like MAPS and HEADLINES (`add_to_timeline`), drawn frame by
  frame in Chromium (assets/photofx/page.js). The captions stay on them: they are pictures, not graphics.
* DEPTH replaces the slow zoom on every third AI still whose main subject is a person or a vehicle — Claude
  looks at the stills first, ten at a time (`depth_subjects`), so a steering wheel, a phone or a plate of food
  is never lifted — and is rendered by ffmpeg beside the other segments (`depth_slots`, `depth_segment`).
  A still without one clear subject keeps its plain zoom.
"""

import base64
import hashlib
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
from PIL import Image, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets" / "photofx"
W, H, FPS = 1920, 1080, 30

REMOVER = os.environ.get("PHOTOFX_REMOVER", "wavespeed-ai/image-background-remover")
REMOVER_USD = 0.004
DEPTH_EVERY = int(os.environ.get("PHOTOFX_DEPTH_EVERY", "3"))   # every Nth AI still gets the depth pop
DEPTH_MIN_S = 2.4                    # a slot shorter than this has no time to show it
DEPTH_Z0, DEPTH_GROW = 1.06, 0.09    # the background starts 6 % in and pulls back to 1; the subject grows 9 % on top
DEPTH_FULL_S = 4.0                   # ...over a still this long; a shorter one moves less, so the pop is never quicker
EVERY_S = float(os.environ.get("PHOTOFX_EVERY_S", "45"))        # at most one photo scene per this many seconds
GAP_S = float(os.environ.get("PHOTOFX_GAP_S", "14"))
# what Claude is shown when it picks or checks a photo: six candidates at 512 px cost about a fifth of the image
# tokens of ten at 1024, and are plenty to judge the subject and framing
PICK_MAX = int(os.environ.get("PHOTOFX_PICK_MAX", "6"))
PICK_PX = int(os.environ.get("PHOTOFX_PICK_PX", "512"))
SPOT_DUR, SPOT_LEAD = 5.0, 0.9       # the darkening starts on the words
HOLD_S = 2.5                         # frames drawn past the end: the timeline may stretch a scene over a short gap
OBJ_DUR = {"solo": 4.6, "crown": 5.6, "pair": 5.2, "row": 5.4}
OBJ_LEAD = 0.5                       # the thing has landed when its name is said
PROTECTED = ("introcap", "map_", "headline_", "spot_", "objects_", "strip_", "tilt_", "press_")   # scenes placed on a word: nobody removes them
STRIP_DUR, STRIP_LEAD = 6.6, 0.9         # a Kodak contact strip of 2-3 photos; the first photo lands on the words
MATCH_DUR, MATCH_LEAD = 4.6, 0.5         # a match cut: 6-10 photos of one person, every face on the same spot, a flash and a shutter per cut
TEXT_DUR, TEXT_LEAD = 5.0, 0.3           # a text match cut: 3-5 punches of text, one per cut, each on its own real photo, the words on one spot
TILT_DUR = 5.2                           # a tall portrait, the camera travelling down it
CAPTIONED = ("spot_", "objects_")    # pictures, not graphics: the engine keeps the captions on these

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/128.0.0.0 Safari/537.36")
_IMG_HEADERS = {"User-Agent": UA, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.8"}
# Stock libraries watermark everything they serve, print-on-demand shops sell drawings of the thing.
STOCK_HOSTS = ("gettyimages.", "istockphoto.", "shutterstock.", "dreamstime.", "alamy.", "stock.adobe.", "ftcdn.net",
               "123rf.", "depositphotos.", "vecteezy.", "freepik.", "canstockphoto.", "bigstockphoto.", "pond5.",
               "stocksy.", "agefotostock.", "colourbox.", "pixtastock.", "etsy.", "etsystatic.", "redbubble.",
               "teepublic.", "zazzle.", "cafepress.", "wallpapers.com", "magnific.com", "pngtree.", "cleanpng.",
               "pngwing.", "kindpng.", "pngitem.", "seekpng.", "clipart", "wallpaperaccess.", "wallpapercave.")
# historicimages.com (faintly stamped press prints) stays allowed: blocking it left Ed Cole with no photo in one test
# and a different man's photo in another (2026-10-06) — the right person with a faint stamp beats either


def _log(engine, msg: str) -> None:
    (engine.log if engine is not None and hasattr(engine, "log") else print)(msg)


def settings(style: str, engine) -> dict:
    """The channel's `look.photofx` and this job's switches in Options, as one dict."""
    look = ((getattr(engine, "STYLE_INFO", {}) or {}).get(style) or {}).get("look") or {}
    raw = look.get("photofx")
    cfg = raw if isinstance(raw, dict) else {}
    off = set(getattr(engine, "_DLC_OFF", set()) or set())
    on = raw is not False

    def flag(name):
        return on and cfg.get(name, True) is not False and name not in off
    return {"spotlight": flag("spotlight"), "objects": flag("objects"), "depth": flag("depth"),
            # "strip": Kodak contact strips of 2-3 real photos; "spot_move": "tilt" travels down a tall portrait
            "strip": bool(cfg.get("strip")) and flag("spotlight"),
            # "matchcut": a fast run of real photos of one person, the face held on one spot of the screen
            "matchcut": bool(cfg.get("matchcut")) and flag("spotlight"),
            # "textcut": the words that hit, one per cut, held on one spot of the screen over real photos
            "textcut": bool(cfg.get("textcut")) and flag("spotlight"),
            "spot_move": str(cfg.get("spot_move") or "push").lower(),
            "depth_every": int(cfg.get("depth_every", DEPTH_EVERY) or 0),
            # "people": only stills whose main subject is a person or a vehicle; "any": any clear subject
            "depth_subjects": str(cfg.get("depth_subjects") or "people").lower(),
            "keyline": str(cfg.get("keyline", "#F6F1E8") or ""),
            # "ground": a picture under assets/ laid under real objects instead of the blurred colour ground
            "ground": str(cfg.get("ground") or ""),
            # "draw_objects": false — an object no photo cuts out cleanly is dropped, never drawn by the image model
            "draw_objects": cfg.get("draw_objects", True) is not False,
            "every_s": float(cfg.get("every_s") or EVERY_S), "gap_s": float(cfg.get("gap_s") or GAP_S)}


# ════════════════════════════════════════════════════════════════════════════
# PICTURES — loading, blurs, masks, compositing (numpy + Pillow, nothing else)
# ════════════════════════════════════════════════════════════════════════════
def load_rgb(path) -> Image.Image:
    im = Image.open(path)
    try:
        im = ImageOps.exif_transpose(im)
    except Exception:                                        # noqa: BLE001 - a broken EXIF block is not worth a photo
        pass
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        base = Image.new("RGBA", im.size, (255, 255, 255, 255))
        base.alpha_composite(im)
        im = base
    return im.convert("RGB")


def cover(im: Image.Image, w: int = W, h: int = H) -> Image.Image:
    """Fill w×h and crop the middle — the same framing the engine gives every still."""
    s = max(w / im.width, h / im.height)
    nw, nh = max(w, round(im.width * s)), max(h, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    x, y = (nw - w) // 2, (nh - h) // 2
    return im.crop((x, y, x + w, y + h))


def _box1(a, r: int):
    """Box blur of radius r over both axes, edges held."""
    k = 2 * r + 1
    c = np.cumsum(np.pad(a, [(r + 1, r)] + [(0, 0)] * (a.ndim - 1), mode="edge"), axis=0, dtype=np.float64)
    a = (c[k:] - c[:-k]) / k
    c = np.cumsum(np.pad(a, [(0, 0), (r + 1, r)] + [(0, 0)] * (a.ndim - 2), mode="edge"), axis=1, dtype=np.float64)
    return ((c[:, k:] - c[:, :-k]) / k).astype(np.float32)


def blur(a, sigma: float):
    """Three box passes: a Gaussian of this sigma. Wide ones are done smaller — the eye cannot tell."""
    a = np.asarray(a, dtype=np.float32)
    if sigma <= 0.3:
        return a
    f = int(sigma // 6)
    if f >= 2:
        h, w = a.shape[:2]
        small = resize(a, (max(8, w // f), max(8, h // f)))
        return resize(blur(small, sigma / f), (w, h))
    r = max(1, int(round((math.sqrt(4 * sigma * sigma + 1) - 1) / 2)))
    for _ in range(3):
        a = _box1(a, r)
    return a


def resize(a, size):
    if a.ndim == 2:
        return np.asarray(Image.fromarray(np.asarray(a, np.float32)).resize(size, Image.BILINEAR), dtype=np.float32)
    return np.dstack([resize(a[..., c], size) for c in range(a.shape[2])])


def dilate(alpha, px: int):
    im = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8))
    while px > 0:
        step = min(px, 4)
        im = im.filter(ImageFilter.MaxFilter(2 * step + 1))
        px -= step
    return np.asarray(im, dtype=np.float32) / 255


def gray(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def desat(rgb, amount: float):
    return rgb * (1 - amount) + gray(rgb)[..., None] * amount


def over(dst, src):
    """Straight-alpha 'over' on float RGBA (colour 0..255, alpha 0..1)."""
    sa, da = src[..., 3:4], dst[..., 3:4]
    oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa], axis=2)


def flat(color, alpha):
    c = np.asarray(color, np.float32).reshape(1, 1, 3)
    return np.concatenate([np.broadcast_to(c, alpha.shape + (3,)), alpha[..., None]], axis=2)


def hex_rgb(h: str, default=(246, 241, 232)):
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", str(h or "").strip())
    return tuple(int(m.group(1)[i:i + 2], 16) for i in (0, 2, 4)) if m else default


def save_rgba(arr, path) -> Path:
    out = np.concatenate([np.clip(arr[..., :3], 0, 255), np.clip(arr[..., 3:4] * 255, 0, 255)], axis=2)
    Image.fromarray(out.astype(np.uint8)).save(path, "PNG", compress_level=3)
    return Path(path)


def save_rgb(arr, path, quality: int = 94) -> Path:
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(path, "JPEG", quality=quality)
    return Path(path)


def fill_holes(rgb, hole):
    """Paint over `hole` (0..1) with the colours around it — normalised blurs at a quarter of the size,
    the narrow ones overriding the wide ones wherever they reach. Only ever seen in slivers."""
    h, w = hole.shape
    sw, sh = max(16, w // 4), max(9, h // 4)
    rs = resize(np.asarray(rgb, np.float32), (sw, sh))
    known = (resize(hole, (sw, sh)) < 0.02).astype(np.float32)
    if known.sum() < 10:
        return np.asarray(rgb, np.float32)
    res = np.broadcast_to(rs[known > 0].mean(axis=0), rs.shape).astype(np.float32).copy()
    for sigma in (48, 20, 8, 3):
        num = blur(rs * known[..., None], sigma)
        den = blur(known, sigma)
        est = num / np.maximum(den, 1e-5)[..., None]
        wgt = np.clip(den * 5, 0, 1)[..., None]
        res = res * (1 - wgt) + est * wgt
    return resize(res, (w, h))


def components(m) -> list:
    """Connected regions of a small boolean mask, biggest first: {area, box (px), pix}."""
    h, w = m.shape
    seen = np.zeros_like(m, dtype=bool)
    out = []
    ys, xs = np.nonzero(m)
    for y, x in zip(ys.tolist(), xs.tolist()):
        if seen[y, x]:
            continue
        stack, pix = [(y, x)], []
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            pix.append((cy, cx))
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        pa = np.array(pix)
        out.append({"area": len(pix), "pix": pa,
                    "box": (int(pa[:, 1].min()), int(pa[:, 0].min()), int(pa[:, 1].max()) + 1, int(pa[:, 0].max()) + 1)})
    return sorted(out, key=lambda c: -c["area"])


def _gate(comps, small_shape, full_shape):
    """A soft full-size mask covering these components (so specks elsewhere drop out)."""
    keep = np.zeros(small_shape, np.float32)
    for c in comps:
        keep[c["pix"][:, 0], c["pix"][:, 1]] = 1.0
    return np.clip(resize(blur(keep, 1.2), (full_shape[1], full_shape[0])) * 4, 0, 1)


# ════════════════════════════════════════════════════════════════════════════
# CUTOUTS — WaveSpeed's background remover, paid once per picture
# ════════════════════════════════════════════════════════════════════════════
_LOCKS: dict = {}
_LOCKS_GUARD = threading.Lock()


def _lock(key) -> threading.Lock:
    with _LOCKS_GUARD:
        return _LOCKS.setdefault(str(key), threading.Lock())


def digest(path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:20]


def cutout(src, cache_dir, log=print) -> Path:
    """The picture with its background removed, as an RGBA PNG (at most 2048 px on its long side)."""
    cache_dir = Path(cache_dir)
    key = digest(src)
    dest = cache_dir / f"cut_{key}.png"
    with _lock(dest):
        if dest.exists() and dest.stat().st_size > 500:
            return dest
        import removebg
        cache_dir.mkdir(parents=True, exist_ok=True)
        im = load_rgb(src)
        im.thumbnail((2048, 2048), Image.LANCZOS)
        up = cache_dir / f"up_{key}.jpg"
        im.save(up, "JPEG", quality=94)
        part = cache_dir / f"cut_{key}.part"
        try:
            # WaveSpeed while its balance allows, kie.ai's remover otherwise (removebg.py)
            removebg.remove(up, part, log=log, label=f"cutout of {Path(src).name}")
            Image.open(part).convert("RGBA").save(dest, "PNG")
        finally:
            part.unlink(missing_ok=True)
            up.unlink(missing_ok=True)
        return dest


def _alpha_for(cut: Path, size) -> np.ndarray:
    """The cutout's alpha at `size` (the picture it was made from may have been larger)."""
    im = Image.open(cut).convert("RGBA")
    if im.size != tuple(size):
        im = im.resize(tuple(size), Image.LANCZOS)
    return np.asarray(im.getchannel("A"), dtype=np.float32) / 255


# ════════════════════════════════════════════════════════════════════════════
# DEPTH — the main subject of an AI still lifts off and grows, the background pulls back
# ════════════════════════════════════════════════════════════════════════════
def depth_parts(alpha) -> tuple:
    """The things a cutout holds, as ([{box, mask}], "") — or ([], why) when it is not a clear subject:
    a speck, a whole room, a crowd, something hanging off the top of the picture."""
    sw, sh = 192, 108
    m = resize(alpha, (sw, sh)) > 0.5
    cov = float(m.mean())
    if cov < 0.025:
        return [], f"the subject is too small ({cov:.0%} of the picture)"
    if cov > 0.6:
        return [], f"the cutout fills {cov:.0%} of the picture"
    comps = components(m)
    big = [c for c in comps if c["area"] >= max(10, 0.08 * comps[0]["area"])]
    if len(big) > 4:
        return [], f"{len(big)} separate things, not one subject"
    if sum(c["area"] for c in big) < 0.85 * m.sum():
        return [], "the cutout is scattered"
    if m[0].mean() > 0.25:
        return [], "the subject hangs off the top of the picture"
    if sum(e > 0.3 for e in (m[-1].mean(), m[:, 0].mean(), m[:, -1].mean())) >= 2:
        return [], "the cutout runs off two sides of the picture"
    parts = []
    for c in big[:3]:
        x0, y0, x1, y1 = c["box"]
        parts.append({"box": [x0 / sw, y0 / sh, x1 / sw, y1 / sh], "comps": [c]})
    for c in big[3:]:                           # a fourth thing rides with the nearest of the three
        cx, cy = (c["box"][0] + c["box"][2]) / 2 / sw, (c["box"][1] + c["box"][3]) / 2 / sh
        near = min(parts, key=lambda p: abs((p["box"][0] + p["box"][2]) / 2 - cx) + abs((p["box"][1] + p["box"][3]) / 2 - cy))
        near["comps"].append(c)
        b = c["box"]
        near["box"] = [min(near["box"][0], b[0] / sw), min(near["box"][1], b[1] / sh),
                       max(near["box"][2], b[2] / sw), max(near["box"][3], b[3] / sh)]
    if max(p["box"][3] - p["box"][1] for p in parts) < 0.22:
        return [], "the subject is too short"
    for p in parts:
        p["mask"] = alpha * _gate(p.pop("comps"), (sh, sw), alpha.shape)
    return parts, ""


def part_motion(box, z0: float = DEPTH_Z0, grow: float = DEPTH_GROW) -> tuple:
    """(anchor x, anchor y, grow) for one part. It grows about a point inside itself — as low as it can,
    so it stays standing where it stands — and never so far that its head leaves the frame. Feet may
    leave at the bottom, a little; a side only where the part already touches it."""
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    top = min(0.02, max(0.0, y0 - 0.005))       # a head already near the top may reach it, never pass it
    for k in range(13):
        g = grow * (1 - k / 13)
        z = z0 * (1 + g)                        # the background ends at 1, so the part ends at z
        if z <= 1.0005:
            break
        ylo, yhi = y0 + 0.12 * bh, min(1.0, y1)
        if y0 > 0.005:
            yhi = min(yhi, (y0 * z - top) / (z - 1))
        ylo = max(ylo, (y1 * z - 1.10) / (z - 1))
        xlo, xhi = x0 + 0.25 * bw, x1 - 0.25 * bw
        if x0 > 0.01:
            xhi = min(xhi, (x0 * z + 0.03) / (z - 1))
        if x1 < 0.99:
            xlo = max(xlo, (x1 * z - 1.03) / (z - 1))
        if ylo <= yhi and xlo <= xhi:
            return min(max((x0 + x1) / 2, xlo), xhi), yhi, g
    return (x0 + x1) / 2, (y0 + y1) / 2, 0.0


def build_depth(image: Path, cut: Path, folder: Path, keyline: str = "#F6F1E8") -> dict:
    """The layers of one depth shot: plate.jpg (the picture with the subject painted out), soft.jpg (the
    same, darker and softer) and one RGBA layer per part — shadow, keyline, the subject itself."""
    folder.mkdir(parents=True, exist_ok=True)
    src = load_rgb(image)
    rgb = np.asarray(cover(src), dtype=np.float32)
    cim = Image.open(cut).convert("RGBA")
    if cim.size != src.size:
        cim = cim.resize(src.size, Image.LANCZOS)
    alpha = np.asarray(cover(cim.getchannel("A").convert("L")), dtype=np.float32) / 255
    parts, why = depth_parts(alpha)
    if not parts:
        return {"ok": False, "why": why}
    for p in parts:
        # something as wide as a truck swelling by the full amount reads as a sticker coming loose
        wide = p["box"][2] - p["box"][0]
        p["motion"] = part_motion(p["box"], grow=DEPTH_GROW * min(1.0, max(0.5, 1.25 - wide)))
    if max(p["motion"][2] for p in parts) < 0.035:
        return {"ok": False, "why": "the subject fills the frame top to bottom — no room to grow"}
    union = np.clip(sum(p["mask"] for p in parts), 0, 1)
    hole = np.clip(blur(dilate(union, 10), 3) * 1.5, 0, 1)
    plate = rgb * (1 - hole[..., None]) + fill_holes(rgb, hole) * hole[..., None]
    save_rgb(plate, folder / "plate.jpg", 95)
    save_rgb(desat(blur(plate, 2.2), 0.18) * 0.84, folder / "soft.jpg", 92)
    line = hex_rgb(keyline) if keyline else None
    out = []
    # drawn back to front: the part whose feet are lowest in the picture is nearest
    for k, p in enumerate(sorted(parts, key=lambda q: q["box"][3])):
        a = p["mask"]
        layer = flat((0, 0, 0), np.roll(blur(a, 16), 14, axis=0) * 0.42)
        if line:
            layer = over(layer, flat(line, np.clip(blur(dilate(a, 3), 0.7), 0, 1) * 0.92))
        layer = over(layer, np.concatenate([rgb, a[..., None]], axis=2))
        save_rgba(layer, folder / f"part{k}.png")
        ax, ay, g = p["motion"]
        out.append({"file": f"part{k}.png", "box": [round(v, 4) for v in p["box"]],
                    "anchor": [round(ax, 4), round(ay, 4)], "grow": round(g, 4)})
    return {"ok": True, "parts": out}


def _follow_zoom(z: str, ax: float, ay: float, sx: str, sy: str) -> str:
    """perspective= that scales a layer by z about its point (ax, ay) and puts that point at (sx, sy) on
    screen — all as fractions, z/sx/sy as per-frame expressions. Moves in fractions of a pixel."""
    def src(a, s, q):
        return f"({a:.5f}+({q}-{s})/{z})"
    return (f"perspective=x0='W*{src(ax, sx, 0)}':y0='H*{src(ay, sy, 0)}':x1='W*{src(ax, sx, 1)}':y1='H*{src(ay, sy, 0)}':"
            f"x2='W*{src(ax, sx, 0)}':y2='H*{src(ay, sy, 1)}':x3='W*{src(ax, sx, 1)}':y3='H*{src(ay, sy, 1)}':"
            f"interpolation=cubic:sense=source:eval=frame")


def render_depth(folder: Path, info: dict, dur: float, out: Path, engine=None, style: str = "",
                 white_fade: float = 0.0) -> None:
    n = max(2, int(round(dur * FPS)))
    # eased in and out, so the subject drifts off the picture instead of jumping at the cut; a short still
    # travels less of the way, so the move is never quicker than over DEPTH_FULL_S
    k = min(1.0, dur / DEPTH_FULL_S)
    z0 = 1 + (DEPTH_Z0 - 1) * k
    e = f"(0.5-0.5*cos(PI*min(on/{n - 1}\\,1)))"
    zb = f"({z0:.4f}-{z0 - 1:.4f}*{e})"
    ins = ["-framerate", str(FPS), "-i", str(folder / "plate.jpg"), "-framerate", str(FPS), "-i", str(folder / "soft.jpg")]
    fc = [f"[0:v]loop=loop=-1:size=1,format=yuv444p[p]",
          f"[1:v]loop=loop=-1:size=1,format=yuva444p,fade=t=in:st={0.1 * dur:.3f}:d={0.6 * dur:.3f}:alpha=1[s]",
          f"[p][s]overlay=format=yuv444,{_follow_zoom(zb, 0.5, 0.5, '0.5', '0.5')}[l0]"]
    for k, part in enumerate(info["parts"]):
        ax, ay = part["anchor"]
        zf = f"({z0:.4f}*(1+{float(part['grow']) * k:.4f}*{e}))"
        # the part's anchor rides on the background, so its feet stay where they stand
        sx, sy = f"(0.5+({ax:.5f}-0.5)*{zb})", f"(0.5+({ay:.5f}-0.5)*{zb})"
        ins += ["-framerate", str(FPS), "-i", str(folder / part["file"])]
        fc.append(f"[{k + 2}:v]loop=loop=-1:size=1,format=yuva444p,{_follow_zoom(zf, ax, ay, sx, sy)}[f{k}]")
        fc.append(f"[l{k}][f{k}]overlay=format=yuv444[l{k + 1}]")
    grade = engine._grade_vf() if engine is not None and hasattr(engine, "_grade_vf") else ""
    fade = engine._white_fade_vf(dur, white_fade) if engine is not None and white_fade and hasattr(engine, "_white_fade_vf") else ""
    # tagged exactly like the engine's plain photo segments: a colour tag that changes between joined
    # segments makes the final pass rebuild its filters mid-video
    fc.append(f"[l{len(info['parts'])}]setsar=1{grade},format=yuv420p{fade},"
              f"setparams=range=unknown:colorspace=unknown:color_trc=unknown:color_primaries=unknown[v]")
    x264 = engine._x264_segment(style) if engine is not None and hasattr(engine, "_x264_segment") else ["-preset", "veryfast", "-crf", "18"]
    threads = str(getattr(engine, "FFMPEG_THREADS", "2"))
    tmp = out.with_name(out.stem + ".part.mp4")
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *ins, "-filter_complex", ";".join(fc), "-map", "[v]",
                    "-t", f"{dur:.3f}", "-c:v", "libx264", *x264, "-pix_fmt", "yuv420p", "-color_range", "tv",
                    "-r", str(FPS), "-threads", threads, str(tmp)], check=True, capture_output=True)
    tmp.replace(out)


DEPTH_SUBJECTS_PROMPT = """These are [INSERT N HERE] stills from a video, numbered 1 to [INSERT N HERE] in the order the
files were listed. On some of them the main subject will be cut out and slowly lifted off the picture while the
background pulls back. That only looks right on PEOPLE and VEHICLES.

Say yes for a picture whose main subject is a person or a few people (seen whole, or from the waist up), or a car,
truck, van, motorbike, bus, boat or plane, standing clear in front of the background.

Say no for everything else: a close-up of hands, a phone, a screen or a document; a steering wheel, a dashboard or
the inside of a car; food, a desk, an object on a table; a room, a street or a landscape with no clear person or
vehicle in front of it; a person seen only as a shoulder, an arm or the back of a head at the edge of the frame; a
crowd that fills the picture.

Answer ONLY with JSON: {"lift": [the numbers of the pictures that get a yes]}"""


def depth_subjects(engine, stills: list, job=None) -> set:
    """Which of these stills (paths, as str) show a person or a vehicle as their main subject — the only
    things the depth pop lifts. Claude looks at them ten at a time; every answer is kept under the picture's
    hash in photofx/depth/subjects.json, so a re-render never asks twice. A still Claude could not judge
    keeps its plain zoom."""
    stills = [Path(s) for s in dict.fromkeys(str(s) for s in stills) if Path(s).is_file()]
    if not stills:
        return set()
    cache = Path(job) / "photofx" / "depth" / "subjects.json" if job else None
    known = {}
    if cache is not None and cache.exists():
        try:
            known = json.loads(cache.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            known = {}
    keys = {s: digest(s) for s in stills}
    todo = [s for s in stills if keys[s] not in known]
    if todo and engine is not None and hasattr(engine, "claude_vision"):
        views = Path(tempfile.mkdtemp(prefix="movefast_depth_"))

        def ask(batch):
            files = []
            for k, s in enumerate(batch):
                v = views / f"{k + 1:02d}_{keys[s]}.jpg"
                im = load_rgb(s)
                im.thumbnail((640, 640), Image.LANCZOS)
                im.save(v, "JPEG", quality=85)
                files.append(v)
            try:
                raw = getattr(engine, "pick_vision", engine.claude_vision)(DEPTH_SUBJECTS_PROMPT.replace("[INSERT N HERE]", str(len(batch))),
                                           files, max_tokens=300)
            except Exception as e:                                   # noqa: BLE001
                _log(engine, f"  depth: Claude could not look at {len(batch)} still(s), they keep the plain zoom "
                             f"— {type(e).__name__}: {str(e)[:120]}")
                return {}
            d = _json_obj(raw)
            if not isinstance(d.get("lift"), list):
                _log(engine, f"  depth: no answer about {len(batch)} still(s), they keep the plain zoom")
                return {}
            lift = set()
            for n in d["lift"]:
                try:
                    lift.add(int(n))
                except (TypeError, ValueError):
                    pass
            return {keys[s]: (k + 1) in lift for k, s in enumerate(batch)}

        try:
            with ThreadPoolExecutor(max_workers=3) as ex:
                for got in ex.map(ask, [todo[i:i + 10] for i in range(0, len(todo), 10)]):
                    known.update(got)
        finally:
            shutil.rmtree(views, ignore_errors=True)
        if cache is not None:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(known, indent=1), encoding="utf-8")
    return {str(s) for s in stills if known.get(keys[s])}


def depth_slots(plan: list, style: str, engine=None, candidates=None, job=None) -> set:
    """The photo slots of a plan that get the depth pop: every Nth still long enough to show it, among
    `candidates` (the slots the engine leaves as plain full-frame stills; None = all) — and only stills
    whose main subject is a person or a vehicle, unless the channel sets `"depth_subjects": "any"`."""
    cfg = settings(style, engine)
    every = cfg["depth_every"]
    if not cfg["depth"] or every <= 0 or not os.environ.get("WAVESPEED_API_KEY"):
        return set()
    allowed = None if candidates is None else set(candidates)
    slots = [i for i, e in enumerate(plan)
             if e[0] == "photo" and e[1] and float(e[3]) >= DEPTH_MIN_S and (allowed is None or i in allowed)]
    if slots and cfg["depth_subjects"] != "any":
        ok = depth_subjects(engine, [plan[i][1] for i in slots], job)
        kept = [i for i in slots if str(Path(plan[i][1])) in ok]
        _log(engine, f"depth: {len(kept)} of {len(slots)} still(s) show a person or a vehicle")
        slots = kept
    return {i for n, i in enumerate(slots) if n % every == 0}     # the first has it, so a short video shows it too


def depth_segment(engine, image: Path, dur: float, out: Path, job: Path, idx: int = 0, style: str = "",
                  white_fade: float = 0.0) -> bool:
    """One AI still -> a `dur`-second clip with the depth pop. False, with nothing written, when the
    still has no clear subject — the engine then gives it the plain zoom."""
    image = Path(image)
    if not image.is_file():
        return False
    root = job / "photofx" / "depth"
    key = digest(image)
    folder, verdict = root / key, root / f"{key}.json"
    with _lock(verdict):
        info = None
        if verdict.exists():
            try:
                info = json.loads(verdict.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                info = None
        if info is None or (info.get("ok") and not all((folder / f).exists() for f in
                                                         ["plate.jpg", "soft.jpg"] + [p["file"] for p in info["parts"]])):
            cut = cutout(image, job / "photofx" / "cutouts", log=lambda m: _log(engine, m))
            info = build_depth(image, cut, folder, settings(style, engine)["keyline"])
            verdict.write_text(json.dumps(info, indent=1), encoding="utf-8")
            _log(engine, f"  depth: {image.name} — " + (f"{len(info['parts'])} part(s) lifted" if info["ok"]
                                                         else f"keeps its plain zoom ({info['why']})"))
    if not info.get("ok"):
        return False
    render_depth(folder, info, dur, out, engine, style, white_fade)
    return True


# ════════════════════════════════════════════════════════════════════════════
# SCENES — spotlight and objects, drawn in Chromium
# ════════════════════════════════════════════════════════════════════════════
_PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#000;overflow:hidden}
#stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:#0b0b0c}
.cam{position:absolute;left:0;top:0;transform-origin:0 0}
.layer{position:absolute;left:0;top:0;max-width:none}
.vig{position:absolute;left:0;top:0;width:1920px;height:1080px;opacity:0;
     background:radial-gradient(ellipse 75% 70% at 50% 46%,rgba(0,0,0,0) 40%,rgba(0,0,0,.62) 100%)}
.ground{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden}
.bg{position:absolute;left:0;top:0;transform-origin:50% 50%}
.world{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:50% 56%}
.thing{position:absolute;left:0;top:0;max-width:none;visibility:hidden}
</style></head><body><div id="stage"></div>
<script>window.SCENE=__SCENE__;</script><script>__JS__</script></body></html>"""


def data_uri(path_or_im, fmt: str = "") -> str:
    if isinstance(path_or_im, Image.Image):
        buf = io.BytesIO()
        fmt = fmt or ("PNG" if path_or_im.mode == "RGBA" else "JPEG")
        path_or_im.save(buf, fmt, **({"quality": 92} if fmt == "JPEG" else {"compress_level": 3}))
        raw, mime = buf.getvalue(), "image/png" if fmt == "PNG" else "image/jpeg"
    else:
        p = Path(path_or_im)
        raw, mime = p.read_bytes(), "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def build_html(scene: dict) -> str:
    return (_PAGE.replace("__SCENE__", json.dumps(scene, separators=(",", ":")))
            .replace("__JS__", (ASSETS / "page.js").read_text(encoding="utf-8")))


def render(jobs: list, workers: int = 2, fps: int = FPS) -> list:
    """jobs = [(scene, out_mp4)] — the frame-by-frame Chromium loop every MoveFast scene uses."""
    import motion
    from playwright.sync_api import sync_playwright
    tmp = Path(tempfile.mkdtemp(prefix="photofx_"))
    prepared = [(sc, Path(out), tmp / f"f{i:03d}") for i, (sc, out) in enumerate(jobs)]
    workers = max(1, min(workers, len(prepared)))

    def one(chunk):
        last = None
        for attempt in range(3):
            pw = None
            try:
                with motion._PW_START:
                    pw = sync_playwright().start()
                browser = pw.chromium.launch(args=["--force-color-profile=srgb", "--disable-gpu",
                                                   "--font-render-hinting=none"])
                for sc, out, fdir in chunk:
                    if out.exists() and out.stat().st_size > 10_000:
                        continue
                    fdir.mkdir(parents=True, exist_ok=True)
                    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
                    errors = []
                    page.on("pageerror", lambda e: errors.append(str(e)))
                    page.set_content(build_html(sc), wait_until="load")
                    page.wait_for_function("window.__ready===true", timeout=90000)
                    # a scene is drawn a little past its end — the engine stretches a graphic over a gap
                    # shorter than 2.5 s, and a clip that ran out would start again from its first frame
                    for k in range(max(1, int(round((float(sc["duration"]) + float(sc.get("hold", 0))) * fps)))):
                        page.evaluate("(t)=>window.renderFrame(t)", k / fps)
                        page.screenshot(path=str(fdir / f"f_{k:05d}.jpg"), type="jpeg", quality=93,
                                        clip={"x": 0, "y": 0, "width": W, "height": H})
                    if errors:
                        raise RuntimeError(f"page error: {errors[0][:200]}")
                    part = out.with_name(out.stem + ".part.mp4")
                    motion._frames_to_mp4(fdir, part, fps)
                    part.replace(out)
                    shutil.rmtree(fdir, ignore_errors=True)
                    page.close()
                browser.close()
                return
            except Exception as e:                                  # noqa: BLE001 - driver flakiness
                last = e
                time.sleep(3.0 * (attempt + 1))
            finally:
                if pw is not None:
                    try:
                        pw.stop()
                    except Exception:                               # noqa: BLE001
                        pass
        raise RuntimeError(f"photofx: rendering failed: {last}")

    try:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            list(ex.map(one, [prepared[i::workers] for i in range(workers)]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return [Path(o) for _, o in jobs]


# ── spotlight ────────────────────────────────────────────────────────────────
def spot_window(size, box) -> tuple:
    """The widest 16:9 window of a photo, slid toward the subject: (x, y, w, h) in pixels."""
    sw, sh = size
    ww, wh = (sh * 16 / 9, sh) if sw / sh > 16 / 9 else (sw, sw * 9 / 16)
    cx, cy = (box[0] + box[2]) / 2 * sw, (box[1] + box[3]) / 2 * sh
    if (box[3] - box[1]) * sh > wh * 0.95:
        # a subject taller than the window (a standing person in a portrait photo): keep its top — the
        # face — in the frame, instead of centring on the chest
        cy = box[1] * sh + wh * 0.46
    x = min(max(0.0, cx - ww / 2), sw - ww)
    y = min(max(0.0, cy - wh / 2), sh - wh)
    return round(x), round(y), round(ww), round(wh)


def spot_crop(size, box) -> tuple:
    """The part of the photo sent to the background remover: the subject with room around it, so it is
    the obvious foreground — (x0, y0, x1, y1) in pixels."""
    sw, sh = size
    bw, bh = (box[2] - box[0]) * sw, (box[3] - box[1]) * sh
    padx, pady = max(bw * 0.45, sw * 0.12), max(bh * 0.25, sh * 0.1)
    return (max(0, round(box[0] * sw - padx)), max(0, round(box[1] * sh - pady)),
            min(sw, round(box[2] * sw + padx)), min(sh, round(box[3] * sh + pady)))


def subject_mask(alpha, box) -> tuple:
    """(mask, share) — the cutout's regions that belong to the subject in `box` (fractions), and how much
    of the box they fill. Regions that only brush the box are someone else."""
    h, w = alpha.shape
    sw, sh = max(32, w // 12), max(18, h // 12)
    m = resize(alpha, (sw, sh)) > 0.5
    bx0, by0, bx1, by1 = box[0] * sw, box[1] * sh, box[2] * sw, box[3] * sh
    ix0, iy0 = bx0 + 0.15 * (bx1 - bx0), by0 + 0.15 * (by1 - by0)
    ix1, iy1 = bx1 - 0.15 * (bx1 - bx0), by1 - 0.15 * (by1 - by0)
    keep = []
    for c in components(m):
        ys, xs = c["pix"][:, 0] + 0.5, c["pix"][:, 1] + 0.5
        inside = ((xs >= ix0) & (xs <= ix1) & (ys >= iy0) & (ys <= iy1)).mean()
        if inside >= 0.2 and c["area"] >= 4:
            keep.append(c)
    if not keep:
        return None, 0.0
    mask = alpha * _gate(keep, (sh, sw), alpha.shape)
    y0, y1 = int(box[1] * h), max(int(box[1] * h) + 1, int(box[3] * h))
    x0, x1 = int(box[0] * w), max(int(box[0] * w) + 1, int(box[2] * w))
    return mask, float((mask[y0:y1, x0:x1] > 0.5).mean())


def _fit_canvas(photo: Path, folder: Path) -> tuple:
    """A tall portrait whole on a 16:9 canvas, a blurred and darkened copy of itself behind it: (path, x offset, width)
    — the face of a head-and-shoulders portrait cannot fit any wide crop of it."""
    from PIL import ImageFilter, ImageEnhance
    src = load_rgb(photo)
    w, h = src.size
    cw = round(h * 16 / 9)
    k = max(cw / w, 1.0)
    back = src.resize((round(w * k), round(h * k)), Image.LANCZOS)
    back = back.crop(((back.width - cw) // 2, (back.height - h) // 2, (back.width - cw) // 2 + cw, (back.height - h) // 2 + h))
    back = ImageEnhance.Brightness(back.filter(ImageFilter.GaussianBlur(max(8, h // 60)))).enhance(0.45)
    ox = (cw - w) // 2
    back.paste(src, (ox, 0))
    folder.mkdir(parents=True, exist_ok=True)
    out = folder / "fit.jpg"
    back.save(out, quality=93)
    return out, ox, cw


def spotlight_layers(photo: Path, box, cut: Path, crop, folder: Path, face=None) -> dict:
    """plate / dim / soft / subject for one spotlight, and where the camera goes. `cut` is the remover's
    result for `crop` of the photo (None: no cutout — the subject then sits in a soft oval of light). `face`: the
    person's face box — the window and the push are then set on the face, which always stays whole in frame."""
    folder.mkdir(parents=True, exist_ok=True)
    src = load_rgb(photo)
    if face and not (box[0] <= (face[0] + face[2]) / 2 <= box[2] and box[1] <= (face[1] + face[3]) / 2 <= box[3]):
        # the pick's subject box missed the person (the light sat on Ed Cole's hands): head and shoulders from the face
        fw, fh = face[2] - face[0], face[3] - face[1]
        box = (max(0.0, face[0] - 0.9 * fw), max(0.0, face[1] - 0.4 * fh), min(1.0, face[2] + 0.9 * fw), min(1.0, face[3] + 2.2 * fh))
        cut = None                     # the cut-out was made from the missed box: it lit only his chest, in a hard band
    if face:
        # centred a little below the face's middle so the chin stays in; the face box never triggers the
        # "standing person: keep the top" rule that cut a head-and-shoulders portrait at the forehead
        fh = face[3] - face[1]
        x, y, ww, wh = spot_window(src.size, (face[0], face[1] + fh * 0.1, face[2], face[3] + fh * 0.1))
    else:
        x, y, ww, wh = spot_window(src.size, box)
    cw = min(2880, ww)
    ch = round(cw * 9 / 16)
    s = cw / ww
    rgb = np.asarray(src.crop((x, y, x + ww, y + wh)).resize((cw, ch), Image.LANCZOS), dtype=np.float32)
    # the subject box in canvas pixels
    bx0, by0 = (box[0] * src.width - x) * s, (box[1] * src.height - y) * s
    bx1, by1 = (box[2] * src.width - x) * s, (box[3] * src.height - y) * s
    bx0, by0, bx1, by1 = max(0, bx0), max(0, by0), min(cw, bx1), min(ch, by1)
    mask, share = None, 0.0
    if cut is not None:
        full = np.zeros((src.height, src.width), np.float32)
        cx0, cy0, cx1, cy1 = crop
        full[cy0:cy1, cx0:cx1] = _alpha_for(cut, (cx1 - cx0, cy1 - cy0))
        a = np.asarray(Image.fromarray(full[y:y + wh, x:x + ww]).resize((cw, ch), Image.BILINEAR), np.float32)
        mask, share = subject_mask(np.clip(a, 0, 1), (bx0 / cw, by0 / ch, bx1 / cw, by1 / ch))
        if mask is not None and share < 0.12:
            mask = None
    half = (cw // 2, ch // 2)
    k = cw / 1920
    if mask is not None:
        hole = np.clip(blur(dilate(mask, max(2, round(6 * k))), 2 * k) * 1.5, 0, 1)
        plate = rgb * (1 - hole[..., None]) + fill_holes(rgb, hole) * hole[..., None]
        subj = np.concatenate([np.clip(desat(rgb, -0.08) * 1.03, 0, 255), mask[..., None]], axis=2)
        save_rgba(subj, folder / "subj.png")
        save_rgb(plate, folder / "plate.jpg", 94)
        small = resize(plate, half)
        dim_a = soft_a = None
    else:
        save_rgb(rgb, folder / "plate.jpg", 94)
        small = resize(rgb, half)
        # no cutout: an oval of light around the subject box instead
        yy, xx = np.mgrid[0:half[1], 0:half[0]].astype(np.float32)
        cx, cy = (bx0 + bx1) / 4, (by0 + by1) / 4
        rx, ry = max(8.0, (bx1 - bx0) / 4 * 1.15), max(8.0, (by1 - by0) / 4 * 1.1)   # the whole subject, head included
        d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
        dim_a = soft_a = np.clip((d - 0.85) / 0.6, 0, 1)
    dim = desat(blur(small, 1.2 * k / 2 + 0.6), 0.45) * 0.66
    soft = desat(blur(small, 7.5 * k / 2), 0.6) * 0.52
    if dim_a is None:
        save_rgb(dim, folder / "dim.jpg", 90)
        save_rgb(soft, folder / "soft.jpg", 88)
    else:
        save_rgba(np.concatenate([dim, dim_a[..., None]], axis=2), folder / "dim.png")
        save_rgba(np.concatenate([soft, soft_a[..., None]], axis=2), folder / "soft.png")
    bh, bw = (by1 - by0) / ch, (bx1 - bx0) / cw
    zmax = max(1.3, min(2.3, 1.5 * cw / 1920))
    zoom = min(max(0.8 / max(bh, 0.05), 1.3), 0.9 / max(bw, 0.05), zmax)
    # an archival photo under 1100 px is already enlarged to fill the frame: a gentler push keeps it sharp enough
    zoom = max(1.3, zoom) if cw >= 1100 else 1.14
    focus = [round((bx0 + bx1) / 2, 1), round(by0 + 0.42 * (by1 - by0), 1)]
    if face:
        # the push ends with the whole face (and a margin) in frame — a tight portrait gets only a gentle push
        fx0, fy0 = (face[0] * src.width - x) * s, (face[1] * src.height - y) * s
        fx1, fy1 = (face[2] * src.width - x) * s, (face[3] * src.height - y) * s
        fhh, fww = max(1.0, fy1 - fy0) / ch, max(1.0, fx1 - fx0) / cw
        zoom = max(1.04, min(zoom, 0.8 / fhh, 0.85 / fww))
        focus = [round((fx0 + fx1) / 2, 1), round((fy0 + fy1) / 2 + 0.1 * (fy1 - fy0), 1)]
    return {"cw": cw, "ch": ch, "cut": mask is not None, "share": round(share, 3),
            "focus": focus,
            "anchor": [round((bx0 + bx1) / 2, 1), round((by0 + by1) / 2, 1)], "zoom": round(zoom, 3)}


def spotlight_scene(folder: Path, geo: dict, duration: float = SPOT_DUR, hit: float = SPOT_LEAD) -> dict:
    ext = "jpg" if (folder / "dim.jpg").exists() and geo["cut"] else "png"
    sc = {"type": "spotlight", "duration": float(duration), "hit": float(hit), "cw": geo["cw"], "ch": geo["ch"],
          "plate": data_uri(folder / "plate.jpg"), "dim": data_uri(folder / f"dim.{ext}"),
          "soft": data_uri(folder / f"soft.{ext}"), "subj": data_uri(folder / "subj.png") if geo["cut"] else None,
          "focus": geo["focus"], "anchor": geo["anchor"], "zoom": geo["zoom"], "creep": 0.04,
          "pop": 1.06 if geo["cut"] else 1.0, "vignette": 0.85, "opaque": bool(geo["cut"]), "hold": HOLD_S}
    return sc


# ── the Kodak contact strip ────────────────────────────────────────────────────
def film_frame(photo: Path, box, out: Path, fw: int = 1500, fh: int = 1000) -> Path:
    """One photo as a black-and-white 35 mm frame: cropped 3:2 around the subject (its face kept high in
    the frame), a cool silver tone, a little more contrast, fine grain."""
    from PIL import ImageEnhance, ImageOps
    src = load_rgb(photo)
    sw, sh = src.size
    ww, wh = (sh * 3 / 2, sh) if sw / sh > 3 / 2 else (sw, sw * 2 / 3)
    bx = ((box[0] + box[2]) / 2 * sw) if box else sw / 2
    by = ((box[1] + box[3]) / 2 * sh) if box else sh / 2
    if box and (box[3] - box[1]) * sh > wh * 0.9:
        by = box[1] * sh + wh * 0.42
    x = min(max(0.0, bx - ww / 2), sw - ww)
    y = min(max(0.0, by - wh / 2), sh - wh)
    im = src.crop((round(x), round(y), round(x + ww), round(y + wh))).resize((fw, fh), Image.LANCZOS)
    g = ImageOps.grayscale(im)
    g = ImageEnhance.Contrast(g).enhance(1.18)
    g = ImageOps.autocontrast(g, cutoff=1)
    t = ImageOps.colorize(g, black=(10, 12, 16), white=(226, 230, 234), mid=(118, 124, 132))
    a = np.asarray(t, dtype=np.float32)
    rng = np.random.default_rng(int(digest(photo)[:8], 16) & 0xFFFF)
    a += rng.normal(0, 5.5, a.shape).astype(np.float32)
    out.parent.mkdir(parents=True, exist_ok=True)
    save_rgb(a, out, 92)
    return out


def strip_scene(frames: list, duration: float = STRIP_DUR, hit: float = STRIP_LEAD, seed: int = 3) -> dict:
    """The scene for `frames` (paths of film frames, first shown first). The first photo lands on `hit`; the
    rest follow, evenly, each with the strip sliding one frame and the camera punching in."""
    n = max(1, len(frames))
    D = float(duration)
    room = max(0.8, D - hit - 1.4)                    # the photos share the time; the last holds a little longer
    at = [round(hit + room * k / n, 2) for k in range(n)]
    # the low frame rate the whole scene moves at, and the code the edge print carries
    return {"type": "strip", "duration": D, "hit": float(hit), "frames": [data_uri(Path(f)) for f in frames],
            "at": at, "fps": 15, "code": "KODAK 5063 TX", "start": 14 + (seed % 11), "hold": HOLD_S}


FACE_PROMPT = """One picture. Where is the main person's FACE? Give the box from the top of the hair to just under the chin,
ear to ear, as fractions of the picture's width and height, left/top/right/bottom. If the picture has no clear face at
least 6% of its height (a crowd, a back, a tiny figure, a drawing), answer null.
Is the picture a DESIGNED graphic rather than a plain photograph — a tribute card, a poster, a collage, a trading card,
a thumbnail with a name or dates printed on it, a screenshot with big text? Then "graphic": true.
Answer ONLY with JSON: {"box": [0.41, 0.12, 0.58, 0.39], "graphic": false} or {"box": null, "graphic": false}"""


def face_box(mv, photo: Path):
    """[x0, y0, x1, y1] (fractions) of the main face in a photo, by a look — one picture per look, so the numbers
    cannot slip between pictures — or None."""
    try:
        raw = mv.claude_vision(FACE_PROMPT, [Path(photo)], max_tokens=100)   # Claude: Gemini's face boxes came back in mixed orders
        d = _json_obj(raw)
        if d.get("graphic"):
            return None                                          # a tribute card or a poster is not a photograph
        got = d.get("box")
        box = [min(1.0, max(0.0, float(v))) for v in (got or [])][:4]
        if len(box) == 4:
            box = [min(box[0], box[2]), min(box[1], box[3]), max(box[0], box[2]), max(box[1], box[3])]
        if len(box) == 4 and box[2] - box[0] >= 0.04 and box[3] - box[1] >= 0.06:
            return box
    except Exception:                                            # noqa: BLE001 - a face not found is a photo not used
        pass
    return None


def matchcut_scene(mv, picks: list, folder: Path, duration: float = MATCH_DUR, hit: float = MATCH_LEAD, seed: int = 3) -> dict:
    """The match-cut scene from real photos of one person: every face landed on the same spot of the screen at the
    same size, cut fast with a white flash and a shutter on every change, the last one held with a slow push.
    None when fewer than four faces are found."""
    from concurrent.futures import ThreadPoolExecutor
    folder.mkdir(parents=True, exist_ok=True)
    cache_f = folder / "faces.json"
    try:
        cache = json.loads(cache_f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        boxes = list(ex.map(lambda p: cache.get(str(p["photo"])) or face_box(mv, Path(p["photo"])), picks))
    cache_f.write_text(json.dumps({str(p["photo"]): b for p, b in zip(picks, boxes)}), encoding="utf-8")
    photos = []
    for k, (p, box) in enumerate(zip(picks, boxes)):
        if not box:
            continue
        im = load_rgb(p["photo"])
        w, h = im.size
        if (box[3] - box[1]) * h < 110 or (box[3] - box[1]) > 0.6:   # a face too small to fill a third of the screen, or a face that IS the photo
            continue
        if w > 1800:                                             # what the page needs, not more
            im = im.resize((1800, round(h * 1800 / w)), Image.LANCZOS)
            w, h = im.size
        f = folder / f"match_{k:02d}.jpg"
        im.save(f, quality=90)
        photos.append({"src": data_uri(f), "w": w, "h": h, "box": box})
    if len(photos) < 4:
        return None
    photos = photos[:10]
    # the run lands on the strongest face: one whose photo still fills the screen at the face's size, the biggest
    # and most central of those (a tight portrait would sit small on its blurred backdrop)
    def hero(p):
        b = p["box"]
        sc = (0.36 * 1080) / max(1e-6, (b[3] - b[1]) * p["h"])
        fills = p["w"] * sc >= 1920 and p["h"] * sc >= 1080
        return (1 if fills else 0, (b[3] - b[1]) - 0.6 * abs((b[0] + b[2]) / 2 - 0.5))
    last = max(photos, key=hero)
    photos = [p for p in photos if p is not last] + [last]
    n = len(photos)
    D = float(duration)
    step = 0.32 if n >= 8 else 0.36                              # the pace of the cuts; the last photo holds the rest
    at = [round(hit + step * k, 3) for k in range(n)]
    return {"type": "matchcut", "duration": D, "hit": float(hit), "photos": photos, "at": at, "fps": 30,
            "face": {"cx": 0.5, "cy": 0.44, "h": 0.36}}


def textcut_scene(picks: list, lines: list, folder: Path, duration: float = TEXT_DUR, hit: float = TEXT_LEAD) -> dict:
    """The text match cut: each line of text snaps onto the same spot of the screen on a hard cut to another real
    photo, a hit under every cut, the last line held. None without at least two lines and one photo."""
    lines = [re.sub(r"\s+", " ", str(x)).strip() for x in lines if str(x).strip()][:5]
    if len(lines) < 2 or not picks:
        return None
    folder.mkdir(parents=True, exist_ok=True)
    photos = []
    for k, p in enumerate(picks[:6]):
        try:
            im = load_rgb(p["photo"])
        except Exception:                                        # noqa: BLE001
            continue
        w, h = im.size
        if w > 1800:
            im = im.resize((1800, round(h * 1800 / w)), Image.LANCZOS)
            w, h = im.size
        f = folder / f"text_{k:02d}.jpg"
        im.save(f, quality=90)
        photos.append({"src": data_uri(f), "w": w, "h": h})
    if not photos:
        return None
    D = float(duration)
    n = len(lines)
    step = max(0.55, min(0.8, (D - hit - 1.2) / max(1, n - 1)))
    at = [round(hit + step * k, 3) for k in range(n)]
    return {"type": "textcut", "duration": D, "hit": float(hit), "lines": lines, "photos": photos, "at": at, "fps": 30}


def textcut_marks(sc: dict) -> list:
    """sfx.py: a hit on every cut, the riser into the last one."""
    at = list(sc.get("at") or [0.0])
    return ([[a, "hit_file", -4.0] for a in at] + [[at[-1], "riser_file", -8.0]] + [[float(sc["duration"]), "whoosh_out", -12.0]])


def matchcut_marks(sc: dict) -> list:
    """sfx.py: a shutter on every cut, the riser landing on the last one, a hit under it."""
    at = list(sc.get("at") or [0.0])
    return ([[a, "shutter", -3.0] for a in at] + [[at[-1], "riser_file", -6.0], [at[-1], "hit_file", -3.0]]
            + [[float(sc["duration"]), "whoosh_out", -12.0]])


def strip_marks(sc: dict) -> list:
    """Where sfx.py puts the shutter and the clicks: on the first photo, then on every change."""
    at = list(sc.get("at") or [0.0])
    return [[at[0], "shutter", -3.0]] + [[a, "click", -5.0] for a in at[1:]] + [[float(sc["duration"]), "whoosh_out", -12.0]]


def tilt_scene(photo: Path, box, folder: Path, duration: float = TILT_DUR, hit: float = SPOT_LEAD) -> dict:
    """A tall real photo filling the width of the frame, the camera travelling down it — from the top of the
    picture to the subject — with a slow push. None when the photo is not tall enough to travel."""
    src = load_rgb(photo)
    sw, sh = src.size
    k = 1920 / sw
    if sh * k < 1080 * 1.22:
        return None
    folder.mkdir(parents=True, exist_ok=True)
    cw = min(2400, sw)
    ch = round(sh * cw / sw)
    src.resize((cw, ch), Image.LANCZOS).save(folder / "plate.jpg", "JPEG", quality=93)
    fy = ((box[1] + box[3]) / 2) if box else 0.5
    return {"type": "tilt", "duration": float(duration), "hit": float(hit), "plate": data_uri(folder / "plate.jpg"),
            "cw": cw, "ch": ch, "focus_y": round(min(0.9, max(0.35, fy)), 3), "hold": HOLD_S}


# ── objects ──────────────────────────────────────────────────────────────────
def _near_box(alpha, box, grow: float) -> tuple:
    """(alpha kept only near the box, whether the object carries on past that crop)."""
    h, w = alpha.shape
    bw, bh = box[2] - box[0], box[3] - box[1]
    x0, x1 = int(max(0.0, box[0] - grow * bw) * w), int(math.ceil(min(1.0, box[2] + grow * bw) * w))
    y0, y1 = int(max(0.0, box[1] - grow * bh) * h), int(math.ceil(min(1.0, box[3] + grow * bh) * h))
    out = np.zeros_like(alpha)
    out[y0:y1, x0:x1] = alpha[y0:y1, x0:x1]
    band = [alpha[y0:y1, x0].mean() if x0 > 0 else 0.0, alpha[y0:y1, x1 - 1].mean() if x1 < w else 0.0,
            alpha[y0, x0:x1].mean() if y0 > 0 else 0.0, alpha[y1 - 1, x0:x1].mean() if y1 < h else 0.0]
    return out, max(band) > 0.12


def thing_from_cut(cut: Path, box=None, max_side: int = 1100, min_side: int = 360) -> Image.Image:
    """The object alone, trimmed to itself: the cutout's regions inside `box` (fractions), or its biggest.
    Raises when it is not one whole, big-enough object — the caller then tries the next photo."""
    im = Image.open(cut).convert("RGBA")
    alpha = np.asarray(im.getchannel("A"), dtype=np.float32) / 255
    if box:
        # a neighbour touching the object is left outside a crop a little wider than the box — unless
        # the box was drawn too tight and the crop would slice the object itself
        near, sliced = _near_box(alpha, box, 0.08)
        if sliced:
            near, sliced = _near_box(alpha, box, 0.25)
        mask, share = subject_mask(alpha if sliced else near, box)
        if mask is None or share < 0.2:
            raise ValueError(f"the cutout does not hold the object ({share:.0%} of its box)")
    else:
        sw, sh = max(32, im.width // 12), max(18, im.height // 12)
        comps = components(resize(alpha, (sw, sh)) > 0.5)
        if not comps:
            raise ValueError("the cutout is empty")
        keep = [c for c in comps if c["area"] >= 0.15 * comps[0]["area"]]
        mask = alpha * _gate(keep, (sh, sw), alpha.shape)
    solid = mask > 0.5
    run_off = max(solid[0].mean(), solid[-1].mean(), solid[:, 0].mean(), solid[:, -1].mean())
    if run_off > 0.03:
        raise ValueError("the object runs off the edge of its photo")
    arr = np.asarray(im, dtype=np.uint8).copy()
    arr[..., 3] = (np.clip(mask, 0, 1) * 255).astype(np.uint8)
    out = upright(Image.fromarray(arr))
    bb = out.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not bb:
        raise ValueError("the cutout is empty")
    pad = max(2, round(0.01 * max(bb[2] - bb[0], bb[3] - bb[1])))
    out = out.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(out.width, bb[2] + pad), min(out.height, bb[3] + pad)))
    if min(out.size) < 60 or max(out.size) < min_side:
        raise ValueError(f"the object is only {out.width}×{out.height} px")
    out.thumbnail((max_side, max_side), Image.LANCZOS)
    return out


def upright(im: Image.Image) -> Image.Image:
    """Stand a long thing up straight: a can shot at a slight angle would settle tilted. The long axis
    of the silhouette is turned to the nearest vertical or horizontal when it is off by 1.5 to 20 degrees."""
    a = np.asarray(im.getchannel("A"), dtype=np.float32)
    ys, xs = np.nonzero(a > 128)
    if len(xs) < 400:
        return im
    x, y = xs - xs.mean(), ys - ys.mean()
    cxx, cyy, cxy = float((x * x).mean()), float((y * y).mean()), float((x * y).mean())
    spread = math.sqrt(((cxx - cyy) / 2) ** 2 + cxy ** 2)
    major, minor = (cxx + cyy) / 2 + spread, (cxx + cyy) / 2 - spread
    if minor <= 0 or major / minor < 1.8:          # round things have no axis to straighten
        return im
    theta = 0.5 * math.degrees(math.atan2(2 * cxy, cxx - cyy))
    dev = (theta + 45) % 90 - 45
    if 1.5 <= abs(dev) <= 20:
        im = im.rotate(dev, resample=Image.BICUBIC, expand=True)
    return im


def shadow_of(thing: Image.Image) -> tuple:
    """(shadow picture, scale) — the silhouette blurred, black; drawn under the object, bigger by `scale`."""
    a = thing.getchannel("A")
    k = 260 / max(a.size)
    small = a.resize((max(4, round(a.width * k)), max(4, round(a.height * k))), Image.BILINEAR)
    pad = 36
    canvas = Image.new("L", (small.width + 2 * pad, small.height + 2 * pad), 0)
    canvas.paste(small, (pad, pad))
    sh = np.asarray(canvas, np.float32) / 255
    sh = blur(sh, 9) * 0.9
    out = np.zeros(sh.shape + (4,), np.uint8)
    out[..., 3] = (np.clip(sh, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(out), (canvas.width / small.width, canvas.height / small.height)


def brand_ground(things: list) -> Image.Image:
    """A ground in the objects' own colours: each object enormous and blurred to soft shapes — one fills
    the frame, two share it left and right — darkened toward the edges."""
    arrs = [np.asarray(t, dtype=np.float32) for t in things[:2]]
    wsum = sum(float((a[..., 3] / 255).sum()) for a in arrs) or 1.0
    mean = sum((a[..., :3] * (a[..., 3:4] / 255)).reshape(-1, 3).sum(axis=0) for a in arrs) / wsum
    base = Image.new("RGB", (W, H), tuple(int(v * 0.32) for v in mean))
    spots = [(0.52, 0.46)] if len(arrs) == 1 else [(0.27, 0.5), (0.75, 0.46)]
    for t, (cx, cy) in zip(things[:2], spots):
        span = 1.35 if len(arrs) == 1 else 0.8
        scale = max(span * W / t.width, 1.6 * H / t.height)
        big = t.resize((max(1, round(t.width * scale)), max(1, round(t.height * scale))), Image.BILINEAR)
        big = big.rotate(-9, resample=Image.BILINEAR, expand=True)
        base.paste(big, (round(W * cx - big.width / 2), round(H * cy - big.height / 2)), big)
    g = blur(np.asarray(base, np.float32), 70)
    g = desat(g, -0.12) * 0.62
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.46) / (H * 0.62)) ** 2)
    g *= np.clip(1.08 - 0.55 * v ** 2, 0.35, 1.0)[..., None]
    return Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))


_OBJ_GROUND = {"path": None}        # set per job from the style (look.photofx.ground) by add_to_timeline


def objects_scene(things: list, layout: str = "solo", accent: Image.Image = None, accent_at: float = 1.5,
                  duration: float = 0.0) -> dict:
    """Place the things (trimmed RGBA pictures) for a layout and build the scene."""
    def fit(im, max_h, max_w):
        r = im.width / im.height
        h = max_h
        w = h * r
        if w > max_w:
            w, h = max_w, max_w / r
        return round(w), round(h)

    layout = layout if layout in OBJ_DUR else "solo"
    placed = []                                            # (picture, spec)
    if layout == "pair" and len(things) >= 2:
        for i, im in enumerate(things[:2]):
            w, h = fit(im, 0.54 * H, 0.38 * W)
            placed.append((im, {"x": W * (0.31 if i == 0 else 0.69), "y": H * 0.53, "w": w, "h": h,
                                "enter": "left" if i == 0 else "right", "at": 0.12 + 0.32 * i, "rot": -16 if i == 0 else 16}))
    elif layout == "row" and len(things) >= 3:
        n = min(4, len(things))
        cell = W * 0.84 / n
        for i, im in enumerate(things[:n]):
            w, h = fit(im, (0.44 if n == 3 else 0.38) * H, cell * 0.84)
            placed.append((im, {"x": W * 0.08 + cell * (i + 0.5), "y": H * 0.54, "w": w, "h": h,
                                "enter": "pop", "at": 0.15 + 0.24 * i, "rot": 10 if i % 2 else -10}))
    else:
        hero = things[0]
        if accent is not None:
            layout = "crown"
            w, h = fit(hero, 0.5 * H, 0.42 * W)
            y = H * 0.62
            placed.append((hero, {"x": W * 0.5, "y": y, "w": w, "h": h, "enter": "rise", "at": 0.12, "rot": -28}))
            aw, ah = fit(accent, 0.25 * H, w * 1.15)
            placed.append((accent, {"x": W * 0.5 + w * 0.02, "y": y - h / 2 - ah / 2 + ah * 0.16, "w": aw, "h": ah,
                                    "enter": "drop", "at": float(accent_at), "rot": -13}))
        else:
            layout = "solo"
            w, h = fit(hero, 0.6 * H, 0.52 * W)
            placed.append((hero, {"x": W * 0.5, "y": H * 0.52, "w": w, "h": h, "enter": "rise", "at": 0.12, "rot": -26}))
    items = []
    for im, spec in placed:
        shadow, (kx, ky) = shadow_of(im)
        spec = dict(spec, x=round(spec["x"], 1), y=round(spec["y"], 1), src=data_uri(im, "PNG"), shadow=data_uri(shadow, "PNG"),
                    sw=round(spec["w"] * kx), sh=round(spec["h"] * ky), dx=round(spec["w"] * 0.045, 1),
                    dy=round(spec["h"] * 0.06, 1))
        items.append(spec)
    last = max(it["at"] for it in items)
    dur = float(duration or max(OBJ_DUR[layout], last + 2.6))
    ground_img = None
    if _OBJ_GROUND.get("path"):
        try:
            ground_img = cover(load_rgb(_OBJ_GROUND["path"]))
        except Exception:                                    # noqa: BLE001 - the colour ground then
            ground_img = None
    return {"type": "objects", "duration": dur, "bg": data_uri(ground_img if ground_img is not None else brand_ground(things[:2] if layout == "pair" else things[:1]), "JPEG"),
            "items": items, "shadow": 0.72, "layout": layout, "hold": HOLD_S}


# ════════════════════════════════════════════════════════════════════════════
# SOURCING — find real photos, download them, let Claude choose
# ════════════════════════════════════════════════════════════════════════════
def _host(url: str) -> str:
    return (urlparse(url).netloc or "").lower().removeprefix("www.")


def commons_search(query: str, n: int = 8) -> list:
    import requests
    try:
        r = requests.get("https://commons.wikimedia.org/w/api.php", params={
            "action": "query", "format": "json", "generator": "search", "gsrsearch": f"{query} filetype:bitmap",
            "gsrnamespace": 6, "gsrlimit": n, "prop": "imageinfo", "iiprop": "url|size|mime", "iiurlwidth": 2400},
            headers={"User-Agent": "MoveFast/3 (video tool; photofx)"}, timeout=30)
        pages = (r.json().get("query") or {}).get("pages") or {}
    except Exception:                                        # noqa: BLE001 - one search source down is not fatal
        return []
    out = []
    for p in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        ii = (p.get("imageinfo") or [{}])[0]
        if not str(ii.get("mime", "")).startswith("image/") or ii.get("mime") == "image/svg+xml":
            continue
        out.append({"url": ii.get("thumburl") or ii.get("url"), "thumb": ii.get("thumburl") or ii.get("url"),
                    "title": re.sub(r"^File:|\.\w+$", "", p.get("title", "")), "source": "commons.wikimedia.org"})
    return out


# shops and listings: their pictures of a famous car or person are die-cast models, posters and mugs
SHOP_HOSTS = ("ebay.", "ebayimg.", "amazon.", "media-amazon.", "aliexpress.", "alibaba.", "walmart.", "temu.",
              "mercari.", "poshmark.", "worthpoint.", "hobbydb.", "diecast", "replicarz", "etsy.", "allposters.",
              "posterazzi.", "fineartamerica.", "pixels.com", "displate.")
TOY_WORDS = re.compile(r"\b(die-?cast|1[:/]\d{2}|scale model|model kit|replica|toy|lego|hot wheels|funko|poster|"
                       r"canvas print|art print|t-?shirt|mug|sticker|decal|for sale|read me|lot of|slot car|figurine)\b", re.I)


def people_photos(cands: list) -> list:
    """Candidates that can be a real photo of a person or an event: no shop listings, no models or posters."""
    return [c for c in cands if not any(h in (c.get("source", "") + " " + c.get("url", "")).lower() for h in SHOP_HOSTS)
            and not TOY_WORDS.search(c.get("title") or "")]


_SEARCH_GATE = threading.Semaphore(3)      # searches in flight at once, across every module


def image_search(query: str, n: int = 16, log=print) -> list:
    """[{url, thumb, title, source}] for a query: Wikimedia Commons."""
    found = list(commons_search(query))
    seen, out = set(), []
    for c in found:
        where = (c["source"] + " " + c["url"]).lower()
        if c["url"] in seen or any(h in where for h in STOCK_HOSTS):
            continue
        seen.add(c["url"])
        out.append(c)
    return out[:n]


def fetch_image(cand: dict, dest: Path, min_side: int = 300) -> Path:
    """Download one candidate as a JPEG (the thumbnail when the full picture is refused)."""
    import requests
    urls = [cand["url"]] + ([cand["thumb"]] if cand.get("thumb") and cand["thumb"] != cand["url"] else [])

    def grab(url):
        g = requests.get(url, headers=_IMG_HEADERS, timeout=30)
        if g.status_code != 200 or len(g.content) < 2000:
            return None
        im = load_rgb(io.BytesIO(g.content))
        return im if min(im.size) >= min_side else None

    for url in urls:
        try:
            im = grab(url)
        except Exception:                                    # noqa: BLE001 - not an image, blocked, timed out
            im = None
        if im is not None:
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, "JPEG", quality=93)
            return dest
    return None


def fetch_candidates(query: str, folder: Path, min_side: int, keep: int = 10, log=print, cands=None) -> list:
    """Search, download the first few that are real pictures big enough: [(candidate, path)]."""
    cands = image_search(query, log=log) if cands is None else cands
    folder.mkdir(parents=True, exist_ok=True)

    def one(k_c):
        k, c = k_c
        try:
            p = fetch_image(c, folder / f"cand_{k:02d}.jpg", min_side)
            if p is not None:
                with Image.open(p) as im:
                    c = dict(c, size=list(im.size))
            return c, p
        except Exception:                                    # noqa: BLE001
            return c, None
    with ThreadPoolExecutor(max_workers=6) as ex:
        got = [(c, p) for c, p in ex.map(one, list(enumerate(cands[:max(12, keep + 4)]))) if p is not None]
    return got[:keep]


_BRAVE_LOCK = threading.Lock()


def brave_images(query: str, folder: Path, n: int = 16, log=print, min_side: int = 0) -> list:
    """One bounded Brave Images request per query/cache, using concrete originals (no thumbnail fallback). It reads
    100 results (same price as 20) and keeps the first `n` whose reported size reaches `min_side` — the right picture
    is often a 780×440 one past the 20th result (owner 2026-10-06)."""
    import html
    import requests
    query = str(query).strip()
    cache = folder / "brave" / hashlib.sha256(query.encode()).hexdigest()[:20] / "search.json"
    with _BRAVE_LOCK:
        if cache.exists():
            try:
                saved = json.loads(cache.read_text(encoding="utf-8"))
                if saved.get("status") == "started":
                    saved.update(status="failed", error="interrupted")
                    cache.write_text(json.dumps(saved, indent=1), encoding="utf-8")
                return _big_enough(saved.get("candidates", []), min_side)[:n] if saved.get("status") == "success" else []
            except (OSError, ValueError):
                log("    photofx: unreadable Brave cache; no automatic repeat")
                return []
        cache.parent.mkdir(parents=True, exist_ok=True)
        record = {"query": query, "status": "started", "candidates": [], "error": None}
        cache.write_text(json.dumps(record, indent=1), encoding="utf-8")
        key = (os.environ.get("BRAVE_SEARCH_API_KEY") or "").strip()
        try:
            if not key:
                raise ValueError("missing_key")
            with _SEARCH_GATE:
                response = requests.get("https://api.search.brave.com/res/v1/images/search",
                    headers={"Accept": "application/json", "X-Subscription-Token": key},
                    params={"q": query, "count": 100, "country": "ALL", "search_lang": "en",
                            "safesearch": "strict", "spellcheck": 1}, timeout=30)
            if response.status_code != 200:
                raise ValueError(f"HTTP_{response.status_code}")
            payload = response.json()
            if payload.get("type") != "images" or not isinstance(payload.get("results"), list):
                raise ValueError("invalid_response")
            found, seen = [], set()
            for row in payload["results"]:
                if not isinstance(row, dict):
                    continue
                properties = row.get("properties") or {}
                if not isinstance(properties, dict):
                    continue
                original = properties.get("url") or row.get("original")
                page = row.get("url") or row.get("source") or ""
                preview = (row.get("thumbnail") or {}).get("src") if isinstance(row.get("thumbnail"), dict) else None
                if not isinstance(original, str) or original in seen or original == preview:
                    continue
                parsed = urlparse(original)
                host = (parsed.hostname or "").lower()
                if parsed.scheme not in ("http", "https") or not host or host == "brave.com" or host.endswith(".brave.com"):
                    continue
                if any(h in (str(page) + " " + original).lower() for h in STOCK_HOSTS):
                    continue
                seen.add(original)
                found.append({"url": original, "thumb": original, "source": str(page) or _host(original),
                              "title": html.unescape(re.sub(r"<[^>]*>", "", str(row.get("title") or ""))),
                              "source_page": str(page), "provider": "brave",
                              "w": properties.get("width"), "h": properties.get("height")})
            found = people_photos(found)
            record.update(status="success" if found else "empty", candidates=found)
        except Exception as exc:
            # Never put request headers, credential values or provider bodies in logs/cache.
            error = type(exc).__name__
            if isinstance(exc, ValueError) and str(exc) in ("missing_key", "invalid_response"):
                error = str(exc)
            elif 'response' in locals() and response.status_code != 200:
                error = f"HTTP_{response.status_code}"
            record.update(status="failed", error=error)
            log(f"    photofx: Brave images unavailable ({error}); keeping other sources")
        cache.write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf-8")
        return _big_enough(record["candidates"], min_side)[:n]


def _big_enough(cands: list, min_side: int) -> list:
    """Candidates whose size Brave reports and that reach `min_side` on the short side; unknown sizes stay."""
    def short(c):
        try:
            return min(int(c.get("w") or 0), int(c.get("h") or 0))
        except (TypeError, ValueError):
            return 0
    return [c for c in cands if not min_side or not (c.get("w") and c.get("h")) or short(c) >= min_side]


def brave_photos(query: str, folder: Path, n: int, min_side: int, log=print, exclude=()) -> list:
    """Reuse MoveFast downloads and persist empty/error/materialized outcomes before any paid cutout."""
    candidates = brave_images(query, folder, n=n, log=log, min_side=min_side)
    root = folder / "brave" / hashlib.sha256(str(query).strip().encode()).hexdigest()[:20]
    cache = root / "downloads.json"
    with _BRAVE_LOCK:
        if cache.exists():
            try:
                saved = json.loads(cache.read_text(encoding="utf-8"))
                got = [(c, Path(p)) for c, p in saved.get("photos", []) if Path(p).exists()]
            except (OSError, ValueError):
                got = []
        else:
            root.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps({"status": "started", "photos": []}), encoding="utf-8")
            try:
                got = fetch_candidates(query, root, min_side=min_side, keep=n, log=log,
                                       cands=candidates) if candidates else []
                result = {"status": "success" if got else "empty", "photos": [(c, str(p)) for c, p in got]}
            except Exception as exc:
                got = []
                result = {"status": "failed", "photos": [], "error": type(exc).__name__}
            cache.write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
    seen, out = set(exclude), []
    for c, photo in got:
        if c["url"] not in seen and min(load_rgb(photo).size) >= min_side:
            seen.add(c["url"])
            out.append((c, photo))
    return out[:n]


def captions(cands: list) -> str:
    """What the web says each candidate is, numbered like the images Claude reads."""
    return "\n".join(f"{k}. {c.get('size', ['?', '?'])[0]}×{c.get('size', ['?', '?'])[1]} px — {c.get('source', '')} — "
                     f"{(c.get('title') or '(no caption)')[:140]}" for k, c in enumerate(cands, 1))


PICK_SPOT_PROMPT = """These are [INSERT N HERE] photos an image search found for a documentary video, searched as:
"[INSERT QUERY HERE]". The narration at this moment says: "[INSERT LINE HERE]". The edit shows ONE real photograph
and pushes in on its subject ([INSERT SUBJECT HERE]) while everything else in the photo darkens.

What the web says each photo is:
[INSERT CAPTIONS HERE]

Do not try to recognise anyone from their face. Who is in a photo comes from its caption and the search; you judge
what the photo shows and whether it works on screen. Choose the photos that work, best first:
- a real photograph — not a drawing, render, meme, collage, poster, screenshot or a photo of a screen. Only for a
  person or event from before photography, the well-known painting or engraving of them is the real picture;
- no watermark, no logo stamped on it, no large text laid over it — the one exception: a faint stamp on an
  archival press print of the right person, when no clean photo of them is here;
- its caption fits the subject, or nothing in it contradicts the search (wrong event, wrong era, wrong thing);
  a named person must also fit the era, age and role the narration gives them (a 1970s car executive is not a
  uniformed officer from decades earlier) — when unsure who it is, leave it out;
- a machine, part, product, building or place is judged by looking at the photo: it must clearly show that thing
  (a diagram, a cutaway or the thing visible inside its machine counts) — a photo of something that only contains
  it (a car for its engine's rotor) does not. People are still judged by caption, never by face;
- ONE clear main subject — the person, group or thing the photo is about — big enough, not cut in half;
- room around the subject: a scene, not a tight head-and-shoulders portrait;
- sharp and big: prefer photos at least 1000 px wide; landscape when there is a choice.

Leave out logos, brand graphics and adverts.
Return JSON only:
{"picks": [{"n": 2, "box": [0.41, 0.18, 0.66, 0.97]}, {"n": 5, "box": [0.1, 0.2, 0.4, 0.9]}]}
- "n": the photo's number (1 = the first image you read).
- "box": the main subject in THAT photo — [left, top, right, bottom] as fractions of its width and height
  (0.0 to 1.0), tight around the whole subject. With several people, the one the photo is clearly about:
  in focus, most prominent, or marked by the caption, a name on a shirt, a sign.
- At most 3 picks. {"picks": []} when none of them works."""

PICK_OBJECT_PROMPT = """These are [INSERT N HERE] photos an image search found of: [INSERT THING HERE]. The video cuts the
object out of ONE photo and animates it large on screen, so choose the photos where:
- it is exactly [INSERT THING HERE] — the right brand, model and era, and the iconic version everyone would
  recognise unless the name asks for a particular one — and real: a photograph or an official product shot,
  not a drawing, cartoon, toy, fan art, meme or a picture printed on something;
- ONE of it, whole: not cut off by the edge of the photo, not covered by a hand, not a pack, a group or a row
  (a photo of several still works if one stands clearly apart from the others — box only that one);
- ideally it stands alone on a plain background; no watermark, no text laid over or printed in the picture (not an
  infographic, a sticker or a magazine page);
- big and sharp — prefer the photos with more pixels.

The photos, in the order you read them:
[INSERT CAPTIONS HERE]

Return JSON only:
{"picks": [{"n": 3, "box": [0.3, 0.1, 0.7, 0.95]}]}
- "n": the photo's number (1 = the first image you read).
- "box": [left, top, right, bottom] tight around the object in THAT photo, as fractions (0.0 to 1.0).
- At most 3 picks, best first. {"picks": []} when none of them shows it properly."""


VERIFY_THING_PROMPT = """These are [INSERT N HERE] cut-out pictures meant to show ONE [INSERT THING HERE], cut out of
photos to be animated on screen. The flat grey around them is not part of them. Choose the best one that is:
- exactly one [INSERT THING HERE] — the right thing, the iconic recognisable version unless the name asks for
  another — not a pack, a group or a row of several;
- whole and cleanly cut: nothing missing, no bits of other objects, hands, shelves or background left on it.

Return JSON only: {"best": 2} (1 = the first image you read), or {"best": 0} when none of them is right."""


def _about(subject: str, folder) -> str:
    """'Ed Cole — GM president, 1960s–70s': a named person's role and era from the video's named things
    (stills/named.json, a few folders up), so a photo pick can tell him from a namesake in a modern photo (his son's
    portrait in an article about him was picked twice, 2026-10-06). The bare subject when it is not a named thing."""
    for up in list(Path(folder).parents)[:7]:                   # a Vox picture sits six folders below the job
        f = up / "stills" / "named.json"
        if f.exists():
            try:
                low = str(subject).strip().lower()
                about = next((str(x.get("about") or "") for x in json.loads(f.read_text(encoding="utf-8"))
                              if str(x.get("name", "")).strip().lower() == low), "")
            except (OSError, ValueError, AttributeError):
                about = ""
            return f"{subject} — {about}" if about else subject
    return subject


def spot_prompt(query: str, line: str, subject: str, cands: list) -> str:
    return (PICK_SPOT_PROMPT.replace("[INSERT QUERY HERE]", query).replace("[INSERT LINE HERE]", line)
            .replace("[INSERT SUBJECT HERE]", subject).replace("[INSERT CAPTIONS HERE]", captions(cands)))


def _json_obj(raw: str) -> dict:
    m = re.search(r"\{.*\}", raw or "", re.DOTALL)
    try:
        return json.loads(m.group(0)) if m else {}
    except ValueError:
        return {}


def ask_picks(mv, prompt: str, files: list) -> list:
    """Claude looks at the candidates: [(index, box)] best first, boxes sane."""
    views = []
    for k, p in enumerate(files):
        v = p.with_name(p.stem + "_view.jpg")
        im = load_rgb(p)
        im.thumbnail((PICK_PX, PICK_PX), Image.LANCZOS)
        im.save(v, "JPEG", quality=88)
        views.append(v)
    raw = getattr(mv, "pick_vision", mv.claude_vision)(prompt.replace("[INSERT N HERE]", str(len(files))), views, max_tokens=800)
    out = []
    for pk in (_json_obj(raw).get("picks") or [])[:3]:
        try:
            n = int(pk.get("n"))
            b = [min(1.0, max(0.0, float(v))) for v in pk.get("box")][:4]
        except (TypeError, ValueError):
            continue
        if 1 <= n <= len(files) and len(b) == 4 and b[2] - b[0] > 0.02 and b[3] - b[1] > 0.02:
            out.append((n - 1, b))
    return out



def _rewordings(mv, subject: str, query: str, folder: Path) -> list:
    """Two other searches for a real photo of exactly `subject`: its simplest common name, then a broader wording that
    still shows it — rounds 2 and 3 (owner 2026-10-06: up to three rounds, a new wording each). One small Claude call,
    made only after round 1 found nothing that fits; cached in wordings.json."""
    cache = Path(folder) / "wordings.json"
    try:
        got = json.loads(cache.read_text(encoding="utf-8"))
        if got.get("subject") == subject and got.get("query") == query:
            return got.get("wordings") or []
    except (OSError, ValueError):
        pass
    prompt = (f'An image search for a real photo of "{subject}" (searched as "{query}") found nothing usable. Give two '
              "NEW searches (not those two) a person would type into Google Images to find a real photo of exactly that: "
              "1) its simplest common name, 2) a broader wording that still shows it. Never style words (illustration, "
              'drawing, halftone). Return JSON only: {"wordings": ["...", "..."]}')
    try:
        words = _json_obj(mv.claude(prompt, mv.UTILITY_MODEL, max_tokens=200)).get("wordings") or []
    except Exception:                                            # noqa: BLE001 - the bare name is still a round
        words = []
    tried = {str(subject).strip().lower(), str(query).strip().lower()}
    words = [w for w in dict.fromkeys(str(w).strip() for w in words) if w and w.lower() not in tried][:2]
    if len(words) < 2 and str(subject).strip().lower() != str(query).strip().lower():
        words.insert(0, str(subject).strip())                  # the bare name is a round of its own
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"subject": subject, "query": query, "wordings": words}, ensure_ascii=False), encoding="utf-8")
    return words


def _rounds(fn):
    """Up to three searches, a new wording each round; the next round runs only when nothing in the one before fits
    (owner 2026-10-06). The subject stays who or what the picker looks for — only the search words change. Each round
    works in its own sub-folder so caches never mix. Wraps source_photos, _source_thing and source_spotlight."""
    import functools

    @functools.wraps(fn)
    def run(mv, first, *args, **kw):
        try:
            return fn(mv, first, *args, **kw)
        except ValueError as e:
            err = e
        name = fn.__name__
        if name == "source_spotlight":                         # (mv, m, folder)
            folder = Path(args[0])
            subject = str(first.get("subject") or first.get("words") or "")
            query = str(first.get("query") or subject)
        elif name == "source_photos":                          # (mv, subject, query, folder, ...)
            folder, subject = Path(args[1]), str(first or args[0] or "")
            query = str(args[0] or subject)
        else:                                                  # _source_thing(mv, thing, folder, cut_dir, ...)
            folder, subject, query = Path(args[0]), str(first), str(first)
        for k, words in enumerate(_rewordings(mv, subject, query, folder), 2):
            mv.log(f"    photofx: nothing fit for {query!r} — round {k}: {words!r}")
            try:
                if name == "source_spotlight":
                    return fn(mv, dict(first, query=words), folder / f"round{k}", *args[1:], **kw)
                if name == "source_photos":
                    return fn(mv, first, words, folder / f"round{k}", *args[2:], **kw)
                return fn(mv, words, folder / f"round{k}", *args[1:], **kw)
            except ValueError as e:
                err = e
        raise err
    return run

# One size limit for a spotlight photo (owner 2026-10-06: the right thing beats a sharp wrong one). Three checks of
# 640-760 px threw out most good web pictures (780×438, 768×432); a photo under 1100 px gets the gentle push anyway.
SPOT_MIN_SIDE, SPOT_MIN_W = 420, 720


@_rounds
def source_spotlight(mv, m: dict, folder: Path) -> dict:
    """A real photo of the moment's subject, where the subject is, and its cutout — cached in pick.json."""
    subject = str(m.get("subject") or m.get("words") or "the subject")
    query = str(m.get("query") or subject)
    meta = folder / "pick.json"
    if meta.exists():
        try:
            got = json.loads(meta.read_text(encoding="utf-8"))
            # moments are numbered afresh when Claude picks again: only the same search is reused
            if got.get("query") == query and got.get("photo") and Path(got["photo"]).exists():
                return got
        except (OSError, ValueError):
            pass
    documentary = __import__("styles").is_documentary(getattr(mv, "_STYLE_NOW", ""))
    try:
        # a famous name searched with its moment finds shop listings first (die-cast models of the car it won in):
        # the moment and the plain name are searched side by side, the shops and models dropped, Commons added
        queries = list(dict.fromkeys(q for q in (query, subject, f"{subject} photo") if q.strip()))
        with ThreadPoolExecutor(max_workers=3) as ex:
            found = [c for part in ex.map(lambda q: image_search(q, log=mv.log), queries) for c in part]
        found += commons_search(subject)
        seen, cands = set(), []
        for c in people_photos(found):
            if c["url"] not in seen:
                seen.add(c["url"])
                cands.append(c)
        got = fetch_candidates(query, folder, min_side=SPOT_MIN_SIDE, keep=PICK_MAX, log=mv.log, cands=cands[:18])
        if len(got) < 5:
            # Reuse the browser source before selection; its download floor is lower than this scene's.
            more = web_photos(queries, folder, n=10, log=mv.log)
            have = {c["url"] for c, _ in got}
            for c, photo in more:
                if c["url"] not in have and min(load_rgb(photo).size) >= SPOT_MIN_SIDE:
                    have.add(c["url"])
                    got.append((c, photo))
            got = got[:PICK_MAX]
    except Exception as exc:
        if not documentary:
            raise
        mv.log(f"    photofx: primary photo sources failed ({type(exc).__name__}); trying Brave")
        got = []
    def select(pool):
        if not pool:
            return []
        prompt = spot_prompt(query, str(m.get("line") or m.get("words") or ""), _about(subject, folder), [c for c, _ in pool])
        picks = ask_picks(mv, prompt, [p for _, p in pool])
        return [(i, box) for i, box in picks if spot_window(load_rgb(pool[i][1]).size, box)[2] >= SPOT_MIN_W] if documentary else picks
    picks = select(got)
    if documentary and not picks:
        got = brave_photos(query, folder, n=10, min_side=SPOT_MIN_SIDE, log=mv.log,
                           exclude=[c["url"] for c, _ in got])
        picks = select(got)
    if not got:
        raise ValueError(f"no usable photo found for {query!r}")
    if not picks:
        raise ValueError(f"Claude found no photo that shows {subject!r}")
    for i, box in picks:
        cand, photo = got[i]
        src = load_rgb(photo)
        x, y, ww, wh = spot_window(src.size, box)
        if ww < SPOT_MIN_W:
            mv.log(f"    photofx: {cand['source']} photo is only {ww} px wide — next")
            continue
        crop = spot_crop(src.size, box)
        cp = folder / f"crop_{i:02d}.jpg"
        src.crop(crop).save(cp, "JPEG", quality=94)
        try:
            cut = cutout(cp, folder.parent / "cutouts", log=mv.log)
        except Exception as e:                                # noqa: BLE001 - the oval of light still works
            mv.log(f"    photofx: no cutout ({str(e)[:80]}) — the subject gets an oval of light")
            cut = None
        out = {"photo": str(photo), "box": box, "crop": list(crop), "cut": str(cut) if cut else "",
               "query": query, "source": cand["source"], "url": cand["url"], "title": cand.get("title", "")}
        meta.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
        return out
    raise ValueError(f"every photo of {subject!r} was too small")


PICK_PHOTOS_PROMPT = """These are [INSERT N HERE] photos an image search found for a documentary video, searched as:
"[INSERT QUERY HERE]". The video shows real photographs of [INSERT SUBJECT HERE] — on a strip of 35 mm film, one
after another — so choose up to [INSERT K HERE] DIFFERENT photographs of them, best first.

What the web says each photo is:
[INSERT CAPTIONS HERE]

Do not try to recognise anyone from their face. Who is in a photo comes from its caption and the search; you judge
what the photo shows and whether it works on screen. A photo works when it is:
- a real photograph — not a drawing, render, meme, collage, poster, trading card, screenshot or a photo of a screen;
- no watermark, no logo stamped on it, no large text laid over it;
- its caption or its source page NAMES the subject (a caption about another player, another team's uniform, or no
  caption at all is a no — a wrong person on a film strip is the worst mistake this video can make);
- the subject clearly the main person in it — a portrait, an action shot, a moment — big enough, not cut in half;
- from the right time: when the search names a year or an era, the person must look the age they were then (a
  1968 newspaper cannot carry a photograph of the same man at eighty — an era-true photo first, a later one only when
  nothing else names him);
- sharp and big: prefer photos at least 900 px wide.
Prefer photos that show DIFFERENT moments (a portrait, a game, a ceremony), not three crops of one picture.

Return JSON only:
{"picks": [{"n": 2, "box": [0.41, 0.18, 0.66, 0.97]}, {"n": 5, "box": [0.1, 0.2, 0.4, 0.9]}]}
- "n": the photo's number (1 = the first image you read).
- "box": the subject in THAT photo — [left, top, right, bottom] as fractions (0.0 to 1.0), tight around the person.
- At most [INSERT K HERE] picks. {"picks": []} when none of them works."""


PICK_DOC_PHOTOS_PROMPT = """These are [INSERT N HERE] real-photo candidates searched as "[INSERT QUERY HERE]".
Choose up to [INSERT K HERE] DIFFERENT photographs of the requested subject: [INSERT SUBJECT HERE].
Judge against this same requested subject, not an assumed person, sports career or exact historical event.
A concrete named person, object, model or era must match the requested identity; do not substitute
another person or object/model. Honestly contextual imagery can illustrate a generic subject without
claiming the exact historical identity; never present it as authentic evidence of a named machine or event.
Only public figures may be pictured as people; never private victims, witnesses, employees or children.
Use captions/source pages for a person's identity, never face recognition. A machine, part, product, building or
place is judged by looking: the photo must clearly show that thing (a diagram, cutaway or the thing visible inside
its machine counts); a photo of something that only contains it (a car for its engine's rotor) does not.
Require a real photograph with clear
subject, sharp detail and sufficient size; no watermark, stamped logo, large or printed text (an infographic, a
sticker, a magazine page), drawing, render, toy, poster or screenshot — the one exception: a faint stamp on an
archival press print of the right person, when no clean photo of them is here. Reject wrong subjects or unsupported identity claims. A named person must also fit
the era, age and role they had (a 1970s car executive is not a uniformed officer from decades earlier); when the
caption does not clearly name them, leave the photo out.
Prefer different useful views of the subject, not different crops of one source.
CAPTIONS:
[INSERT CAPTIONS HERE]
Leave out logos, brand graphics and adverts.
Return JSON only: {"picks":[{"n":1,"box":[0.1,0.1,0.9,0.9]}]}.
At most [INSERT K HERE] picks; n is the one-based image index, box bounds the subject as fractions.
Return {"picks":[]} when no candidate works.
"""


def _phash(path) -> int:
    """A 64-bit average hash of the picture: two copies of one photograph land within a few bits of each other."""
    im = load_rgb(path).convert("L").resize((8, 8), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32)
    bits = (a > a.mean()).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def _same_photo(h1: int, h2: int) -> bool:
    return bin(h1 ^ h2).count("1") <= 3          # two different portraits of one man can sit 5-6 bits apart


def web_photos(queries: list, folder: Path, n: int = 10, log=print) -> list:
    """Real photos from the web: Brave Images first (one quick API call, originals from their own sites — museums,
    Commons, makers), Bing (through a browser, slower but wider) only when Brave finds fewer than five. In a test
    Brave answered in 1-3 s with clean sources but thin results for generic things; Bing filled those."""
    got, have = [], set()
    if os.environ.get("BRAVE_SEARCH_API_KEY"):
        for q in list(queries)[:2]:
            try:
                for c, photo in brave_photos(q, folder, n=n, min_side=480, log=log, exclude=list(have)):
                    if c["url"] not in have:
                        have.add(c["url"])
                        got.append((c, photo))
            except Exception as e:                               # noqa: BLE001 - Bing still stands
                log(f"    photofx: Brave failed — {str(e)[:80]}")
            if len(got) >= n:
                break
    brave_n = len(got)
    if len(got) < 5:
        for c, photo in bing_photos(queries, folder / "bing", n=n, log=log):
            if c["url"] not in have:
                have.add(c["url"])
                got.append((c, photo))
    if got:
        log(f"    photofx: {len(got)} web photo(s) for {str(queries[0])[:40]!r} "
            f"({brave_n} Brave, {len(got) - brave_n} Bing)")
    return got[:n]


def bing_photos(queries: list, folder: Path, n: int = 16, log=print) -> list:
    """[(candidate, path)] — real photos from Bing Images read through Chromium (headlines.bing_images), downloaded
    through the browser session. The second source for a person's pictures, when the first search comes back thin."""
    try:
        import headlines
        import motion
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []
    import asyncio
    import threading
    try:
        asyncio.get_running_loop()
        on_loop = True                                           # inside another sync Playwright (headlines' press
    except RuntimeError:                                         # page asks for the photo): a second one can only
        on_loop = False                                          # start in a thread of its own
    if on_loop:
        box = []
        th = threading.Thread(target=lambda: box.append(bing_photos(queries, folder, n, log)), daemon=True)
        th.start()
        th.join(600)
        return box[0] if box else []
    got = []
    try:
        with motion._PW_START:
            pw = sync_playwright().start()
        browser = pw.chromium.launch(args=["--disable-gpu", "--force-color-profile=srgb"])
        try:
            found, seen = [], set()
            for q in queries:
                for c in headlines.bing_images(browser, q, 20):
                    # stock libraries serve watermarked previews (an Alamy "comp" reached a Vox scene in a test)
                    if c["url"] not in seen and not any(h in (c.get("source", "") + c["url"]).lower()
                                                        for h in SHOP_HOSTS + STOCK_HOSTS):
                        seen.add(c["url"])
                        found.append(c)
            found = people_photos(found)
            got = headlines._fetch_via_browser(browser, found[:2 * n], folder, min_side=520, keep=n)
        finally:
            browser.close()
            pw.stop()
    except Exception as e:                                       # noqa: BLE001 - the other source still stands
        log(f"    photofx: Bing photos failed — {str(e)[:100]}")
        return []
    return got


@_rounds
def source_photos(mv, subject: str, query: str, folder: Path, n: int = 3, min_w: int = 640) -> list:
    """Up to `n` real, different photos of `subject`: [{photo, box, source, url, title}] — cached in photos.json.
    No cutout: for the Kodak strip, the tilt and the article line the picture itself is the scene."""
    subject = str(subject or query or "the subject").strip()
    query = str(query or subject).strip()
    meta = folder / "photos.json"
    if meta.exists():
        try:
            got = json.loads(meta.read_text(encoding="utf-8"))
            if got.get("query") == query and all(Path(x["photo"]).exists() for x in got.get("picks") or []):
                return got["picks"][:n]
        except (OSError, ValueError, KeyError, TypeError):
            pass
    documentary = __import__("styles").is_documentary(getattr(mv, "_STYLE_NOW", ""))
    try:
        queries = list(dict.fromkeys(q for q in (query, subject, f"{subject} photo") if q.strip()))
        with ThreadPoolExecutor(max_workers=3) as ex:
            found = [c for part in ex.map(lambda q: image_search(q, log=mv.log), queries) for c in part]
        found += commons_search(subject)
        seen, cands = set(), []
        for c in people_photos(found):
            if c["url"] not in seen:
                seen.add(c["url"])
                cands.append(c)
        got = fetch_candidates(query, folder, min_side=480, keep=16, log=mv.log, cands=cands[:24])
        big = [g for g in got if load_rgb(g[1]).width >= min_w]
        if len(big) < 6 or n > 4:
            # image search often hands back small copies: Bing's originals (a wire photo, a newspaper's scan) are the size a
            # film frame needs — and a match cut wants many, from many pages
            search_queries = queries if documentary else (
                [query if query != subject else f"{subject} photo", f"{subject} portrait", f"{subject} 1970s photo"]
                + ([f"{subject} career photos", f"{subject} young"] if n > 4 else []))
            more = web_photos(search_queries, folder, n=max(14, 2 * n), log=mv.log)
            have = {c["url"] for c, _ in got}
            got += [(c, p) for c, p in more if c["url"] not in have]
    except Exception as exc:
        if not documentary:
            raise
        mv.log(f"    photofx: primary photo sources failed ({type(exc).__name__}); trying Brave")
        got = []
    got = [g for g in got if load_rgb(g[1]).width >= min(min_w, 560)] or got
    if documentary:
        unique, have = [], set()
        for c, photo in got:
            if c["url"] not in have:
                have.add(c["url"])
                unique.append((c, photo))
        # eight candidates, one look: sixteen meant two or more vision calls each carrying all sixteen captions
        # (43k of a 2-minute test's 142k Claude tokens)
        got = unique[:max(8, n + 2)]
    def select(got):
        if not got:
            return []
        prompt = ((PICK_DOC_PHOTOS_PROMPT if documentary else PICK_PHOTOS_PROMPT).replace("[INSERT QUERY HERE]", query).replace("[INSERT SUBJECT HERE]", _about(subject, folder))
                  .replace("[INSERT K HERE]", str(n)).replace("[INSERT CAPTIONS HERE]", captions([c for c, _ in got])))
        if len(got) <= 10:
            picks = ask_picks(mv, prompt, [p for _, p in got])
            if not picks and len(got) > 8:
                # Claude saw nothing it liked in one batch: the other half of the candidates on their own
                picks = [(i + 8, b) for i, b in ask_picks(mv, prompt.replace("[INSERT N HERE]", str(len(got) - 8)), [p for _, p in got[8:]])]
        else:
            # many candidates (a match cut): looked at eight at a time, so nothing slips between the pictures
            picks = []
            chunks = [list(range(i, min(i + 8, len(got)))) for i in range(0, len(got), 8)]
            with ThreadPoolExecutor(max_workers=2) as ex:
                for base, part in zip([c[0] for c in chunks],
                                      ex.map(lambda c: ask_picks(mv, prompt.replace("[INSERT N HERE]", str(len(c))), [got[i][1] for i in c]), chunks)):
                    picks += [(base + i, b) for i, b in part]
        out, hashes = [], []
        for i, box in picks:
            cand, photo = got[i]
            if load_rgb(photo).width < min_w:
                continue
            if any(h in (str(cand.get("source") or "") + " " + str(cand.get("url") or "")).lower() for h in STOCK_HOSTS):
                continue                                          # a stock library's watermarked preview
            h = _phash(photo)
            if any(_same_photo(h, x) for x in hashes):
                continue                                          # the same photograph from another site
            hashes.append(h)
            out.append({"photo": str(photo), "box": box, "source": cand["source"], "url": cand["url"],
                        "title": cand.get("title", "")})
        return out
    out = select(got)
    if documentary and not out:
        got = brave_photos(query, folder, n=16, min_side=480, log=mv.log,
                           exclude=[c["url"] for c, _ in got])
        out = select(got)
    if not got:
        raise ValueError(f"no usable photo found for {query!r}")
    if not out:
        raise ValueError(f"Claude found no photo that shows {subject!r}")
    meta.write_text(json.dumps({"query": query, "picks": out}, indent=1, ensure_ascii=False), encoding="utf-8")
    return out[:n]


def _trim_borders(photo: Path) -> tuple:
    """(path, small): a photo with its empty page around it cut off (a stock site's small picture on a big white
    canvas). `small` when what is left is under 900 px wide — shown laid on paper, never blown up full screen."""
    from PIL import Image, ImageChops
    with Image.open(photo) as im:
        rgb = im.convert("RGB")
    for corner in (rgb.getpixel((0, 0)), rgb.getpixel((rgb.width - 1, rgb.height - 1))):
        diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, corner))
        box = ImageChops.add(diff, diff, 2.0, -24).getbbox()
        if box and (box[2] - box[0]) * (box[3] - box[1]) < 0.85 * rgb.width * rgb.height:
            rgb = rgb.crop(box)
    out = Path(photo).with_name(Path(photo).stem + "_trim.jpg")
    rgb.save(out, quality=92)
    return out, rgb.width < 900


def _pick_looks(mv, base, rule: str, cands: list, n: int, hashes: list = None) -> list:
    """Gemini looks at the candidates eight at a time (one look keeps at most three) until `n` are kept:
    [{photo, box, source, url, title, hash, small}] — stock-library previews, repeats and empty borders handled."""
    hashes = [] if hashes is None else hashes
    out = []
    for at in range(0, len(cands), 8):
        if len(out) >= n:
            break
        part = cands[at:at + 8]
        prompt = (base(n - len(out)).replace("[INSERT CAPTIONS HERE]", captions([c for c, _ in part]))
                  + "\n" + rule + "\nLeave out posed stock-model or advertising photos (people posing for the camera on "
                    "a studio or plain background) and pictures that only illustrate a figure of speech.")
        for i, box in ask_picks(mv, prompt, [ph for _, ph in part]):
            cand, photo = part[i]
            if any(h in (str(cand.get("source") or "") + " " + str(cand.get("url") or "")).lower() for h in STOCK_HOSTS):
                continue
            h = _phash(photo)
            if any(_same_photo(h, x) for x in hashes):
                continue
            hashes.append(h)
            trimmed, small = _trim_borders(photo)
            out.append({"photo": str(trimmed), "box": box, "source": cand.get("source"), "url": cand.get("url"),
                        "title": cand.get("title", ""), "hash": h, "small": small})
    return out[:n]


NAMED_PICK_PROMPT = """These are [INSERT N HERE] photo candidates for a documentary. The narration names the [INSERT TYPE HERE]
"[INSERT NAME HERE]" ([INSERT ABOUT HERE]). Choose up to [INSERT K HERE] DIFFERENT real photographs that show EXACTLY it:
- an object or machine: that exact make, model or part — a diagram, cutaway or museum photo of exactly it counts;
  never a similar or different model;
- a person: that person, judged from the caption and source page, never from a face; the right era and role —
  someone else with the same name is a no;
- a place or company: that place, its building, works or sign.
Reject: watermarks, stamped logos, large text, screenshots, posters, toys or RC models, tiny images.
CAPTIONS:
[INSERT CAPTIONS HERE]
Leave out logos, brand graphics and adverts.
Return JSON only: {"picks":[{"n":1,"box":[0.1,0.1,0.9,0.9]}]} — n is the one-based image number, box the subject.
{"picks":[]} when none shows exactly it."""


def named_photos(mv, name: str, kind: str, q: str, q2: str, folder: Path, n: int = 3, about: str = "") -> dict:
    """Photos of exactly one named person/object/place (owner rule 2026-10-05): Brave with the exact search, Bing
    with the second search only when fewer than three fit — never more than two searches. Cached in photos.json:
    {"picks": [...], "searches": 1|2}."""
    meta = folder / "photos.json"
    if meta.exists():
        try:
            got = json.loads(meta.read_text(encoding="utf-8"))
            got["picks"] = [x for x in got.get("picks") or [] if Path(x["photo"]).exists()]
            return got
        except (OSError, ValueError, KeyError, TypeError):
            pass
    folder.mkdir(parents=True, exist_ok=True)
    base = lambda k: (NAMED_PICK_PROMPT.replace("[INSERT TYPE HERE]", kind).replace("[INSERT NAME HERE]", name)
                      .replace("[INSERT ABOUT HERE]", about or "as named").replace("[INSERT K HERE]", str(k)))
    picks, hashes, searches, seen = [], [], 0, set()

    def usable(found):
        out = []
        for c, photo in found:
            try:
                if c["url"] not in seen and load_rgb(photo).width >= 480:
                    seen.add(c["url"])
                    out.append((c, photo))
            except Exception:                                    # noqa: BLE001 - an unreadable download is skipped
                pass
        return out
    try:
        searches = 1
        picks = _pick_looks(mv, base, "", usable(brave_photos(q or name, folder, n=16, min_side=480, log=mv.log))[:16], n, hashes)
        if len(picks) < min(3, n):
            searches = 2
            more = usable(bing_photos([q2 or q or name], folder / "bing", n=16, log=mv.log))[:16]
            picks += _pick_looks(mv, base, "", more, n - len(picks), hashes)
    except Exception as e:                                       # noqa: BLE001 - the moment falls down the ladder
        mv.log(f"    photofx: photos of {name[:40]!r} skipped — {str(e)[:80]}")
    got = {"name": name, "type": kind, "picks": picks, "searches": searches}
    meta.write_text(json.dumps(got, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    return got


def slot_photos(mv, query: str, folder: Path, n: int = 4, min_w: int = 960, query2: str = "") -> list:
    """Real photos for plain still slots (REAL_PHOTOS route, owner 2026-10-04): at most two searches — Brave first,
    Bing tops up — then one Gemini look picks up to `n` different, usable photographs. [] when nothing fits: the
    slot falls to an AI still, then to video. Never loops searching. Cached in folder/photos.json."""
    query = str(query or "").strip()
    meta = folder / "photos.json"
    if meta.exists():
        try:
            got = json.loads(meta.read_text(encoding="utf-8"))
            return [x for x in got.get("picks") or [] if Path(x["photo"]).exists()][:n]
        except (OSError, ValueError, KeyError, TypeError):
            pass
    folder.mkdir(parents=True, exist_ok=True)
    out = []
    try:
        got = web_photos([query, query2 or f"{query} historical photo"], folder, n=12, log=mv.log)
        seen, cands = set(), []
        for c, photo in got:
            if c["url"] not in seen and load_rgb(photo).width >= min(min_w, 640):
                seen.add(c["url"])
                cands.append((c, photo))
        rule = ("If the search names a specific person, object/machine or place, keep only photos of exactly it (a "
                "diagram or cutaway of exactly that object counts). If it names nothing specific, any real photo that "
                "honestly fits is fine.")
        out = _pick_looks(mv, lambda k: PICK_DOC_PHOTOS_PROMPT.replace("[INSERT QUERY HERE]", query)
                          .replace("[INSERT SUBJECT HERE]", query).replace("[INSERT K HERE]", str(k)), rule, cands[:16], n)
    except Exception as e:                                            # noqa: BLE001 - the slot falls back instead
        mv.log(f"    photofx: still photos for {query[:40]!r} skipped — {str(e)[:80]}")
    meta.write_text(json.dumps({"query": query, "picks": out}, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    return out[:n]


def source_photo(mv, subject: str, query: str, folder: Path):
    """One real photo of `subject` (a path), or None."""
    if not (subject or query):
        return None
    try:
        got = source_photos(mv, subject, query, folder, n=1)
    except Exception as e:                                        # noqa: BLE001
        mv.log(f"    photofx: no photo of {subject or query!r} — {str(e)[:100]}")
        return None
    return got[0]["photo"] if got else None


def source_thing(mv, thing: str, folder: Path, cut_dir: Path, min_side: int = 360) -> dict:
    """One object, cut out and trimmed: {png, thing, source, url} — cached in thing.json. A real photo
    first; when no photo of it cuts out cleanly (news photos of a product rarely do), a studio photo of
    the same object is drawn by the image service and cut out instead."""
    try:
        return _source_thing(mv, thing, folder, cut_dir, min_side)
    except ValueError as real_err:
        if not hasattr(mv, "image_gen") or not settings(getattr(mv, "_STYLE_NOW", "") or "", mv)["draw_objects"]:
            raise
        folder.mkdir(parents=True, exist_ok=True)
        meta = folder / "thing.json"
        drawn = folder / "drawn.jpg"
        try:
            mv.log(f"    photofx: drawing a studio photo of {thing!r} instead ({str(real_err)[:60]})")
            if not drawn.exists():
                # the best real photo found rides along as the reference, so the drawn one keeps the real
                # object's shape, colours and markings (a 1965 race car in its real livery, not a guess)
                refs, ref_note = [], ""
                real = sorted(folder.glob("cand_*.jpg")) + sorted((folder / "more").glob("cand_*.jpg"))
                real = [r for r in real if not r.stem.endswith("_view")]
                if real and ((os.environ.get("WAVESPEED_API_KEY") or "").strip() or (os.environ.get("KIE_API_KEY") or "").strip()):
                    try:
                        import removebg
                        refs = [removebg.host(real[0], folder / "uploads.json")]
                        ref_note = ("Image 1 is a real photo of it: keep its exact shape, proportions, colours, "
                                    "livery, markings and details — only the background and light change. ")
                    except Exception:                         # noqa: BLE001 - drawn from words alone then
                        refs = []
                mv.image_gen(f"{ref_note}A studio product photograph of {thing}: the whole object in frame and "
                             f"centred, filling about half of the picture, true to the real object's design, era "
                             f"and labels, on a plain seamless light grey background, soft even light, sharp "
                             f"focus. No hands, no props, no other objects, no text except what is printed on "
                             f"the object itself.", drawn, label=f"object {thing[:30]}", ref_urls=refs or None)
            im = thing_from_cut(cutout(drawn, cut_dir, log=mv.log), None, min_side=min_side)
        except Exception as e:                                    # noqa: BLE001 - the real error is the one to report
            raise ValueError(f"{real_err} — and no drawn one either ({str(e)[:80]})")
        png = folder / "thing.png"
        im.save(png, "PNG")
        out = {"png": str(png), "thing": thing, "source": "studio photo (drawn)", "url": ""}
        meta.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
        return out


@_rounds
def _source_thing(mv, thing: str, folder: Path, cut_dir: Path, min_side: int = 360, verify: bool = True) -> dict:
    """A real photo of the object, cut out and trimmed. `min_side`: how many pixels its long side needs
    (a hero fills half the frame, an accent much less)."""
    meta = folder / "thing.json"
    if meta.exists():
        try:
            got = json.loads(meta.read_text(encoding="utf-8"))
            # moments are numbered afresh when Claude picks again: only the same thing is reused
            if got.get("thing") == thing and Path(got.get("png", "")).exists():
                return got
        except (OSError, ValueError):
            pass
    documentary = __import__("styles").is_documentary(getattr(mv, "_STYLE_NOW", ""))
    try:
        got = fetch_candidates(thing, folder, min_side=min(260, min_side), log=mv.log)
        if len(got) < 5:
            got = (got + fetch_candidates(f"{thing} product photo", folder / "more", min_side=min(260, min_side),
                                         log=mv.log))[:PICK_MAX]
        # The two original searches can return the same URLs; count distinct downloaded candidates.
        have, unique = set(), []
        for c, photo in got:
            if c["url"] not in have:
                have.add(c["url"])
                unique.append((c, photo))
        got = unique
        web_tried = len(got) < 5
        if web_tried:
            more = web_photos([thing, f"{thing} photo"], folder, n=10, log=mv.log)
            for c, photo in more:
                if c["url"] not in have and min(load_rgb(photo).size) >= min(260, min_side):
                    have.add(c["url"])
                    got.append((c, photo))
            got = got[:PICK_MAX]
    except Exception as exc:
        if not documentary:
            raise
        mv.log(f"    photofx: primary photo sources failed ({type(exc).__name__}); trying Brave")
        got, web_tried = [], False
    def select(pool):
        if not pool:
            return []
        prompt = (PICK_OBJECT_PROMPT.replace("[INSERT THING HERE]", thing)
                  .replace("[INSERT CAPTIONS HERE]", captions([c for c, _ in pool])))
        picks = ask_picks(mv, prompt, [p for _, p in pool])
        # An original smaller than the required cutout cannot become eligible after paid removal.
        return [(i, box) for i, box in picks if max(load_rgb(pool[i][1]).size) >= min_side] if documentary else picks
    picks = select(got)
    if documentary and not picks:
        got = brave_photos(thing, folder, n=10, min_side=min(260, min_side), log=mv.log,
                           exclude=[c["url"] for c, _ in got])
        picks = select(got)
    if not got:
        raise ValueError(f"no usable photo found for {thing!r}")
    if not picks:
        raise ValueError(f"Claude found no clean photo of {thing!r}")
    def cut_one(pick):
        i, box = pick
        cand, photo = got[i]
        try:
            return cand, thing_from_cut(cutout(photo, cut_dir, log=mv.log), box, min_side=min_side)
        except Exception as e:                                # noqa: BLE001 - the next pick may do
            mv.log(f"    photofx: {thing!r} from {cand['source']} did not cut out cleanly — {str(e)[:120]}")
            return None
    with ThreadPoolExecutor(max_workers=3) as ex:
        cuts = [c for c in ex.map(cut_one, picks) if c]
    if not cuts and not web_tried:
        # every Commons/encyclopedia photo was a close-up running off the frame (museum shots of an engine):
        # the wider web (Brave, then Bing) usually has a whole-object photo — one more pick before giving up
        mv.log(f"    photofx: no clean cutout of {thing!r} from the first photos — trying the web")
        got = [(c, p) for c, p in web_photos([thing, f"{thing} photo"], folder / "web", n=10, log=mv.log)
               if min(load_rgb(p).size) >= min(260, min_side)][:PICK_MAX]
        picks = select(got)
        with ThreadPoolExecutor(max_workers=3) as ex:
            cuts = [c for c in ex.map(cut_one, picks) if c]
    if not cuts:
        raise ValueError(f"no clean cutout of {thing!r}")
    if not verify:
        # a Vox collage cutout: the pick already chose the subject, a slightly rough edge is part of the paper
        # look — the extra look at the cutouts (~5k tokens a picture) is skipped
        best = 1
        verify_views = False
    else:
        verify_views = True
    # Claude sees the cutouts themselves: a pack of three cans or a shelf edge left on the object is
    # obvious there, and invisible in any number the code could measure
    views = []
    for k, (cand, im) in enumerate(cuts):
        v = Image.new("RGB", im.size, (128, 128, 128))
        v.paste(im, (0, 0), im)
        v.thumbnail((PICK_PX, PICK_PX), Image.LANCZOS)
        views.append(folder / f"cutout_{k}.jpg")
        v.save(views[-1], "JPEG", quality=90)
    if verify_views:
        raw = getattr(mv, "pick_vision", mv.claude_vision)(VERIFY_THING_PROMPT.replace("[INSERT N HERE]", str(len(cuts)))
                               .replace("[INSERT THING HERE]", thing), views, max_tokens=300)
        try:
            best = int(_json_obj(raw).get("best") or 0)
        except (TypeError, ValueError):
            best = 0
    if not 1 <= best <= len(cuts):
        raise ValueError(f"none of the cutouts is one clean {thing!r}")
    cand, im = cuts[best - 1]
    png = folder / "thing.png"
    im.save(png, "PNG")
    out = {"png": str(png), "thing": thing, "source": cand["source"], "url": cand["url"]}
    meta.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    return out


# ════════════════════════════════════════════════════════════════════════════
# TIMELINE — which moments, which pictures, the scenes on the words
# ════════════════════════════════════════════════════════════════════════════
MOMENTS_PROMPT = """You are the photo editor of a documentary-style YouTube video. Two kinds of REAL pictures can go on
screen exactly when the narration says something:

SPOTLIGHT — a real photograph of a specific real person, group, place or documented moment ("Steve Jobs on stage
in 2007", "the crowd at the Berlin Wall in 1989") — or, from before photography, its well-known painting. The
camera pushes in on the subject while the rest darkens.
Public figures, famous places, documented public events, and named real machines, models, factories or landmark
objects ("the Liebherr PR 776", "the Telfs plant") — never a private individual, never a fictional, imagined or
hypothetical scene, never "you" or "a man" in a story.

OBJECT — a specific physical thing the narration names: a branded product ("a can of Dr Pepper", "the first
iPhone"), a famous object ("the Hope Diamond"), or a plain object that carries the point ("a gold bar"). It is cut
out of a real photo and flies onto the screen. Layouts:
  "solo"  — one thing.
  "crown" — one thing plus ONE accent object that lands on it and makes the point: a crown for the new king or
            number one, a medal for a rank, a price tag for a price, a trophy for a win.
  "pair"  — two things compared side by side ("Pepsi versus Coke").
  "row"   — three or four things in a row (a line-up of products).

Below is the full voiceover as timed subtitles, one cue per line: #number [minute:second] text.

Pick the moments where one of these makes the point land. Never for abstract ideas, feelings, advice or the
narrator's own reasoning, never twice for the same thing, never for something only hinted at.
At most [INSERT MAX HERE] moments in total, at least [INSERT GAP HERE] seconds apart. Fewer is fine — an empty
array is right for a narration that names nothing concrete.
[INSERT KINDS HERE]

Return a JSON array, one object per moment, like:
{"cue": 12, "words": "Dr Pepper", "kind": "object", "layout": "crown", "things": ["Dr Pepper can"],
 "accent": "silver crown", "accent_words": "new king"}
{"cue": 30, "words": "Steve Jobs walked on stage", "kind": "spotlight", "subject": "Steve Jobs",
 "query": "Steve Jobs Macworld 2007 keynote stage"}

- "cue": the number of the cue in which it is SPOKEN.
- "words": 1 to 5 words exactly as written in that cue, copied letter for letter.
- "kind": "spotlight" or "object".
- spotlight "subject": who or what to push in on, as the photo would show it ("Steve Jobs", "the protester
  in front of the tanks"); "query": what to type into an image search — names, place, year, occasion.
- object "things": 1 to 4 short image-search phrases, each naming exactly ONE physical thing, specific enough to
  find the right one ("Pepsi can", "Rolex Submariner watch", "1 kg gold bar"). "layout" as above.
  "accent" and "accent_words" only for "crown": the accent object as a search phrase, and 1 to 4 words, from the
  same cue or the next, where it should land.

TRANSCRIPT:
[INSERT TRANSCRIPT HERE]
"""


def _fold(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _stamp_s(sec: float) -> str:
    sec = max(0, int(sec))
    return f"{sec // 60}:{sec % 60:02d}"


def _find_cue(entries: list, n: int, words: str) -> int:
    key = _fold(words)
    if not key:
        return n if 0 <= n < len(entries) else -1
    order = sorted(range(max(0, n - 6), min(len(entries), n + 7)), key=lambda i: abs(i - n))
    for i in order:
        if key in _fold(entries[i][2]):
            return i
    for i in order:
        if i + 1 < len(entries) and key in _fold(entries[i][2] + " " + entries[i + 1][2]):
            return i
    return -1


def _word_time(words: str, cue: tuple, mv) -> float:
    st, en, txt = cue
    timed = mv._cue_words(txt, st, en)
    want = [_fold(w) for w in str(words or "").split() if _fold(w)]
    if not timed or not want:
        return st
    folded = [_fold(w["w"]) for w in timed]
    for i in range(len(folded)):
        if folded[i:i + len(want)] == want:
            return float(timed[i]["t"])
    for i, f in enumerate(folded):
        if f and f == want[0]:
            return float(timed[i]["t"])
    return st


def _overlaps(a0, a1, windows, margin=2.0) -> bool:
    return any(a0 < w1 + margin and w0 - margin < a1 for w0, w1 in windows)


def plan_moments(srt: Path, job: Path, cfg: dict, force: bool, total: float, mv) -> list:
    cache = job / "photofx" / "moments.json"
    if cache.exists() and not force:
        try:
            return json.loads(cache.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    entries = mv._parse_srt_full(srt.read_text(encoding="utf-8"))
    most = max(1, int(total / cfg["every_s"]))
    kinds = ("" if cfg["spotlight"] and cfg["objects"] else
             "Only OBJECT moments this time — no spotlights." if cfg["objects"] else
             "Only SPOTLIGHT moments this time — no objects.")
    prompt = (MOMENTS_PROMPT.replace("[INSERT MAX HERE]", str(most))
              .replace("[INSERT GAP HERE]", str(int(cfg["gap_s"]))).replace("[INSERT KINDS HERE]", kinds)
              .replace("[INSERT TRANSCRIPT HERE]",
                       "\n".join(f"#{i + 1} [{_stamp_s(st)}] {txt}" for i, (st, en, txt) in enumerate(entries))))
    mv.log(f"photofx: Claude is looking for real people, places and things worth a photo (up to {most})...")
    moments = [m for m in mv._json_items(prompt, max_tokens=max(2500, most * 300)) if isinstance(m, dict)]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(moments, indent=2, ensure_ascii=False), encoding="utf-8")
    return moments


def build_scene(mv, m: dict, k: int, out_dir: Path, start: float) -> tuple:
    """(file stem, scene) for one moment: sources its pictures (cached) and lays the scene out."""
    folder = out_dir / f"m{k:02d}"
    if m["kind"] == "textcut":
        subject = str(m.get("subject") or m.get("words") or "")
        lines = m.get("lines") or []
        try:
            picks = source_photos(mv, subject, str(m.get("query") or subject), folder, n=5, min_w=560)
        except Exception as e:                                   # noqa: BLE001
            mv.log(f"  photofx: skipped text cut {_stamp_s(m['_at'])} — {str(e)[:80]}")
            return None, None
        sc = textcut_scene(picks, lines, folder / "text", float(m.get("_dur") or TEXT_DUR), max(0.3, float(m["_at"]) - start))
        if sc:
            mv.log(f"  photofx: text cut {_stamp_s(m['_at'])} — {' / '.join(sc['lines'])} over {len(sc['photos'])} photo(s) of {subject!r}")
            return f"textcut_{k:02d}", sc
        mv.log(f"  photofx: skipped text cut {_stamp_s(m['_at'])} — no lines or no photo")
        return None, None
    if m["kind"] == "matchcut":
        subject = str(m.get("subject") or m.get("words") or "")
        picks = source_photos(mv, subject, str(m.get("query") or subject), folder, n=int(m.get("n") or 10), min_w=560)
        hit = max(0.4, float(m["_at"]) - start)
        sc = matchcut_scene(mv, picks, folder / "match", float(m.get("_dur") or MATCH_DUR), hit, seed=k) if picks else None
        if sc:
            mv.log(f"  photofx: match cut {_stamp_s(m['_at'])} — {len(sc['photos'])} faces of {subject!r} on one spot "
                   f"({', '.join(sorted({p['source'] for p in picks}))})")
            return f"match_{k:02d}", sc
        if len(picks) >= 2:                                      # too few faces: the strip, which needs no face
            mv.log(f"  photofx: match cut {_stamp_s(m['_at'])} — under four clear faces of {subject!r}; a Kodak strip instead")
            frames = [film_frame(Path(p["photo"]), p.get("box"), folder / "film" / f"frame_{i}.jpg") for i, p in enumerate(picks[:3])]
            return f"strip_{k:02d}", strip_scene(frames, float(m.get("_dur") or STRIP_DUR), max(0.5, hit), seed=k)
        mv.log(f"  photofx: skipped match cut {_stamp_s(m['_at'])} — no usable photos of {subject!r}")
        return None, None
    if m["kind"] == "strip":
        subject = str(m.get("subject") or m.get("words") or "")
        picks = source_photos(mv, subject, str(m.get("query") or subject), folder, n=int(m.get("n") or 3))
        if len(picks) < 2:
            # one photo is not a strip — and one photo of a lesser-known name is too often a namesake's (an obituary
            # site once supplied the only "photo" of a witness): the scene is dropped, the footage carries the moment
            mv.log(f"  photofx: skipped strip {_stamp_s(m['_at'])} — only {len(picks)} photo of {subject!r} found")
            return None, None
        frames = [film_frame(Path(p["photo"]), p.get("box"), folder / "film" / f"frame_{i}.jpg") for i, p in enumerate(picks)]
        hit = max(0.5, float(m["_at"]) - start)
        mv.log(f"  photofx: Kodak strip {_stamp_s(m['_at'])} — {len(frames)} photo(s) of {subject!r} "
               f"({', '.join(sorted({p['source'] for p in picks}))})")
        return f"strip_{k:02d}", strip_scene(frames, float(m.get("_dur") or STRIP_DUR), hit, seed=k)
    if m["kind"] == "spotlight" and m.get("_tilt"):
        # a tall portrait: the camera travels down it instead of pushing in (look.photofx.spot_move: "tilt")
        try:
            picks = source_photos(mv, str(m.get("subject") or m.get("words") or ""), str(m.get("query") or ""), folder, n=3)
            tall = next((p for p in picks if (lambda im: im.height / im.width)(load_rgb(p["photo"])) >= 0.69), None)
            sc = tilt_scene(Path(tall["photo"]), tall.get("box"), folder / "tilt", float(m.get("_dur") or TILT_DUR),
                            max(0.5, float(m["_at"]) - start)) if tall else None
            if sc:
                mv.log(f"  photofx: portrait tilt {_stamp_s(m['_at'])} — {m.get('subject')!r} from {tall['source']}")
                return f"tilt_{k:02d}", sc
        except Exception as e:                                    # noqa: BLE001 - the spotlight still works
            mv.log(f"    photofx: no tall photo for a tilt ({str(e)[:80]}) — spotlight instead")
    if m["kind"] == "spotlight":
        got = source_spotlight(mv, m, folder)
        face = face_box(mv, Path(got["photo"]))                   # a person: the camera works on the face
        photo, box, cut, crop = Path(got["photo"]), got["box"], Path(got["cut"]) if got.get("cut") else None, got["crop"]
        if face:
            w_, h_ = load_rgb(photo).size
            if (face[3] - face[1]) * h_ > 0.8 * min(h_, w_ * 9 / 16):
                # the face is taller than any wide crop allows: the whole portrait on a blurred fill, a gentle push
                photo, ox, cw_ = _fit_canvas(photo, folder / "layers")
                fit = lambda b: [(b[0] * w_ + ox) / cw_, b[1], (b[2] * w_ + ox) / cw_, b[3]]
                box, face, cut, crop = fit(box), fit(face), None, (0, 0, cw_, h_)
        geo = spotlight_layers(photo, box, cut, crop, folder / "layers", face=face)
        hit = max(0.5, float(m["_at"]) - start)
        mv.log(f"  photofx: spotlight {_stamp_s(m['_at'])} — {m.get('subject')!r} from {got['source']}"
               + ("" if geo["cut"] else " (no clean cutout: oval of light)"))
        return f"spot_{k:02d}", spotlight_scene(folder / "layers", geo, float(m.get("_dur") or SPOT_DUR), hit)
    things = [str(t) for t in (m.get("things") or []) if str(t).strip()][:4] or [str(m.get("words"))]
    layout = str(m.get("layout") or "solo")
    wanted = things[:1] if layout in ("solo", "crown") else things
    with ThreadPoolExecutor(max_workers=3) as ex:
        # a row shares the frame four ways, so its things need fewer pixels than a hero
        need = 360 if len(wanted) <= 2 else 280
        futs = [ex.submit(source_thing, mv, t, folder / f"t{i}", out_dir / "cutouts", need) for i, t in enumerate(wanted)]
        acc_f = (ex.submit(source_thing, mv, str(m["accent"]), folder / "accent", out_dir / "cutouts", 220)
                 if layout == "crown" and m.get("accent") else None)
        got = []
        for f in futs:
            try:
                got.append(f.result())
            except Exception as e:                                  # noqa: BLE001
                mv.log(f"    photofx: {str(e)[:140]}")
        accent = None
        if acc_f is not None:
            try:
                accent = acc_f.result()
            except Exception as e:                                  # noqa: BLE001 - the thing alone still lands
                mv.log(f"    photofx: no accent — {str(e)[:120]}")
    if not got:
        raise ValueError("none of the things could be found and cut out")
    pics = [Image.open(g["png"]).convert("RGBA") for g in got]
    if layout == "pair" and len(pics) < 2 or layout == "row" and len(pics) < 3:
        layout = "solo"
    acc_at = float(m.get("_accent_at", start + 1.5)) - start
    sc = objects_scene(pics, layout, Image.open(accent["png"]).convert("RGBA") if accent else None, acc_at,
                       duration=float(m.get("_dur") or 0.0))
    mv.log(f"  photofx: {sc['layout']} {_stamp_s(m['_at'])} — " + ", ".join(g["thing"] for g in got)
           + (f" + {accent['thing']}" if accent else "") + f" ({', '.join(sorted({g['source'] for g in got}))})")
    return f"objects_{k:02d}", sc


def add_to_timeline(segs: list, srt: Path, job: Path, style: str, force: bool, total: float = 0.0,
                    workers: int = 2, engine=None) -> list:
    """PHOTO FX's entry point from the engine: real photos and real objects at the words that name them.

    A regular graphic in the way gives way; the opening caption and any scene another DLC placed on a word
    do not — a photo scene that would land on one is dropped."""
    _g = settings(style, engine).get("ground") if engine is not None else ""
    _OBJ_GROUND["path"] = str(HERE / "assets" / _g) if _g and (HERE / "assets" / _g).exists() else None
    if engine is None:
        import make_video as engine
    mv = engine
    cfg = settings(style, mv)
    if not (cfg["spotlight"] or cfg["objects"]) or not srt.exists() or not (ASSETS / "page.js").exists():
        return segs
    if not (os.environ.get("WAVESPEED_API_KEY") or "").strip():
        mv.log("photofx: WAVESPEED_API_KEY is not in .env — photo spotlights and objects need its background remover")
        return segs
    total = float(total or mv._audio_dur(job / "audio.mp3"))
    out_dir = job / "photofx"
    out_dir.mkdir(parents=True, exist_ok=True)
    blocked = [(float(s), float(s) + float(d)) for s, p, d in segs if Path(p).name.startswith(PROTECTED)]
    # a directed video (director.py) spaced its scenes itself: only a real collision counts
    pad = 0.0 if (job / "director.json").exists() else 1.0
    moments = plan_moments(srt, job, cfg, force, total, mv)
    if not moments:
        mv.log("photofx: nothing in this narration needs a real photo")
        return segs
    entries = mv._parse_srt_full(srt.read_text(encoding="utf-8"))

    timed = []
    tilt_n = [0]
    for k, m in enumerate(moments):
        kind = str(m.get("kind")) if str(m.get("kind")) in ("spotlight", "strip", "matchcut", "textcut") else "object"
        if kind == "textcut" and not cfg["textcut"]:
            kind = "spotlight"
        if kind == "matchcut" and not cfg["matchcut"]:
            kind = "strip"
        if kind == "strip" and not cfg["strip"]:
            kind = "spotlight"
        if not cfg["spotlight" if kind in ("spotlight", "strip", "matchcut", "textcut") else "objects"]:
            continue
        try:
            n = int(m.get("cue") or 0) - 1
        except (TypeError, ValueError):
            n = -1
        i = _find_cue(entries, n, m.get("words") or "")
        # the director already timed this moment word by word (director.py): trust it over a text match
        if m.get("at_s") is not None:
            try:
                _t = float(m["at_s"])
                i = next((c for c, e in enumerate(entries) if e[0] - 0.05 <= _t < e[1] + 0.05), len(entries) - 1)
            except (TypeError, ValueError):
                _t = None
        else:
            _t = None
        if i < 0:
            mv.log(f"  photofx: skipped {m.get('words')!r} — not found in the subtitles near cue {n + 1}")
            continue
        at = _t if _t is not None else _word_time(m.get("words") or "", entries[i], mv)
        m = dict(m, kind=kind, _at=at, line=entries[i][2])
        dur = (SPOT_DUR if kind == "spotlight" else STRIP_DUR if kind == "strip" else MATCH_DUR if kind == "matchcut"
               else TEXT_DUR if kind == "textcut" else OBJ_DUR.get(str(m.get("layout")), OBJ_DUR["solo"]))
        if kind in ("spotlight", "strip", "matchcut", "textcut") and m.get("dur"):
            # a photo squeezed between two scenes (the director's plan says how long it has) runs shorter
            dur = min(dur + 1.0, max(3.2, float(m["dur"])))
        if kind == "spotlight" and cfg["spot_move"] == "tilt":
            # every other spotlight travels down a tall portrait when one is found
            tilt_n[0] += 1
            if tilt_n[0] % 2 == 1:
                m["_tilt"] = True
        start = max(0.3, at - (SPOT_LEAD if kind == "spotlight" else STRIP_LEAD if kind == "strip" else MATCH_LEAD if kind == "matchcut"
                                else TEXT_LEAD if kind == "textcut" else OBJ_LEAD))
        if kind == "object" and str(m.get("layout")) == "crown" and m.get("accent"):
            # the accent lands on its own words — the scene runs long enough for that, within reason
            acc = start + 1.5
            key = _fold(m.get("accent_words"))
            for j in (i, i + 1):
                if key and 0 <= j < len(entries) and key in _fold(entries[j][2]):
                    acc = _word_time(m.get("accent_words"), entries[j], mv) - 0.35
                    break
            m["_accent_at"] = min(max(start + 1.1, acc), start + 5.2)
            dur = max(dur, m["_accent_at"] - start + 2.4)
        timed.append((start, dur, k, i, m))
    timed.sort(key=lambda x: x[0])

    chosen, last_end = [], -1e9
    for start, dur, k, i, m in timed:
        if "_accent_at" in m and (_overlaps(start, start + dur, blocked, pad) or start + dur > total - 0.3):
            # waiting for the accent's words made the scene long; the crown landing early still fits
            short = OBJ_DUR["crown"]
            if not _overlaps(start, start + short, blocked, pad):
                m, dur = dict(m, _accent_at=start + 1.5), short
        if start + dur > total - 0.3:
            continue
        if _overlaps(start, start + dur, blocked, pad):
            mv.log(f"  photofx: skipped {_stamp_s(m['_at'])} — another scene is on screen there")
            continue
        # the director spaced its scenes itself (a hook cuts from one to the next): only a real overlap counts
        if start < last_end + (0.3 if m.get("at_s") is not None else cfg["gap_s"]):
            mv.log(f"  photofx: skipped {_stamp_s(m['_at'])} — too close to the photo before it")
            continue
        chosen.append((start, dur, k, i, dict(m, _dur=dur)))
        last_end = start + dur

    def make(row):
        start, dur, k, i, m = row
        try:
            name, sc = build_scene(mv, m, k, out_dir, start)
            return start, k, name, sc
        except Exception as e:                                      # noqa: BLE001 - one photo is never worth the rest
            mv.log(f"  photofx: skipped {_stamp_s(m['_at'])} {m.get('subject') or m.get('things')} — {str(e)[:160]}")
            return None
    with ThreadPoolExecutor(max_workers=3) as ex:
        # a scene that came back empty (an object whose cutout held nothing) is left out on its own — it used to
        # take every other photo scene of the video down with it
        scenes = [s for s in ex.map(make, chosen) if s and s[3]]
    if not scenes:
        mv.log("photofx: no photo scene could be made this time")
        return segs

    jobs, placed = [], []
    for start, k, name, sc in scenes:
        mp4, stamp_f = out_dir / f"{name}.mp4", out_dir / f"{name}.stamp"
        if sc.get("type") == "strip":
            mp4.with_suffix(".sfx.json").write_text(json.dumps(strip_marks(sc)), encoding="utf-8")
        if sc.get("type") == "matchcut":
            mp4.with_suffix(".sfx.json").write_text(json.dumps(matchcut_marks(sc)), encoding="utf-8")
        if sc.get("type") == "textcut":
            mp4.with_suffix(".sfx.json").write_text(json.dumps(textcut_marks(sc)), encoding="utf-8")
        stamp = hashlib.sha256(json.dumps(sc, sort_keys=True).encode()).hexdigest()
        if force or not mp4.exists() or not stamp_f.exists() or stamp_f.read_text(encoding="utf-8") != stamp:
            mp4.unlink(missing_ok=True)
            stamp_f.write_text(stamp, encoding="utf-8")
            jobs.append((sc, mp4))
        placed.append((start, mp4, float(sc["duration"])))
    if jobs:
        mv.log(f"photofx: rendering {len(jobs)} photo scene(s) in Chromium...")
        render(jobs, workers=workers)
    placed = [p for p in placed if p[1].exists()]
    kept = [(s, p, d) for s, p, d in segs
            if Path(p).name.startswith(PROTECTED) or not _overlaps(float(s), float(s) + float(d),
                                                                  [(a, a + b) for a, _, b in placed], margin=0.0)]
    mv.log(f"photofx: {len(placed)} photo scene(s) on screen — " + ", ".join(
        f"{_stamp_s(s)} {n.split('_')[0]}" for s, _, n, _ in scenes[:8]))
    return sorted(kept + [(s, str(p), d) for s, p, d in placed], key=lambda x: float(x[0]))


# ════════════════════════════════════════════════════════════════════════════
# CLI
# ════════════════════════════════════════════════════════════════════════════
def _preview_frames(mp4: Path, times: list, out_png: Path) -> Path:
    """A strip of frames from a clip, for a quick look."""
    tiles = []
    for t in times:
        f = out_png.with_name(f"{out_png.stem}_{t:.2f}.png")
        subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(mp4),
                        "-frames:v", "1", str(f)], check=True)
        tiles.append(Image.open(f).convert("RGB").resize((640, 360), Image.LANCZOS))
        f.unlink(missing_ok=True)
    strip = Image.new("RGB", (640 * len(tiles), 360))
    for i, t in enumerate(tiles):
        strip.paste(t, (640 * i, 0))
    strip.save(out_png)
    return out_png


def check(out: Path = None) -> int:
    """Everything that runs on this machine — layers, the ffmpeg depth render, both Chromium scenes — on
    pictures drawn right here, no keys needed. Writes preview/_photofx_check.png."""
    out = Path(out or HERE / "preview")
    out.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="photofx_check_"))
    bad = 0
    # a "photo": a sky-to-ground gradient with a figure standing on it
    yy, xx = np.mgrid[0:1080, 0:1920].astype(np.float32)
    rgb = np.dstack([90 + 80 * yy / 1080, 120 + 40 * np.sin(xx / 150), 160 - 60 * yy / 1080])
    fig = (((xx - 1100) / 150) ** 2 + ((yy - 520) / 90) ** 2 < 1) | ((abs(xx - 1100) < 110) & (yy > 560) & (yy < 1040))
    rgb[fig] = (200, 60, 50)
    photo = work / "photo.jpg"
    save_rgb(rgb, photo)
    cut = work / "cut.png"
    save_rgba(np.concatenate([rgb, fig.astype(np.float32)[..., None]], axis=2), cut)
    strips = []
    try:
        info = build_depth(photo, cut, work / "depth")
        print(f"  {'ok  ' if info['ok'] else 'FAIL'} depth layers: " + (f"{len(info['parts'])} part(s)" if info["ok"] else info["why"]))
        if info["ok"]:
            render_depth(work / "depth", info, 2.0, work / "depth.mp4")
            strips.append(_preview_frames(work / "depth.mp4", [0.0, 1.0, 1.95], work / "s_depth.png"))
            print("  ok   depth render")
        else:
            bad += 1
    except Exception as e:                                          # noqa: BLE001
        print(f"  FAIL depth: {type(e).__name__}: {str(e)[:200]}")
        bad += 1
    try:
        geo = spotlight_layers(photo, (0.49, 0.38, 0.66, 0.97), cut, (0, 0, 1920, 1080), work / "spot")
        sc_spot = spotlight_scene(work / "spot", geo, 3.0, 0.8)
        thing = Image.fromarray(np.concatenate([rgb, fig.astype(np.float32)[..., None] * 255], axis=2).astype(np.uint8))
        thing = thing.crop(thing.getchannel("A").getbbox())
        sc_obj = objects_scene([thing], "crown", thing.resize((thing.width // 2, thing.height // 3)), 1.0, 3.0)
        render([(sc_spot, work / "spot.mp4"), (sc_obj, work / "objects.mp4")], workers=2)
        strips.append(_preview_frames(work / "spot.mp4", [0.0, 1.6, 2.95], work / "s_spot.png"))
        strips.append(_preview_frames(work / "objects.mp4", [0.3, 1.2, 2.95], work / "s_obj.png"))
        print("  ok   spotlight + objects scenes render")
    except Exception as e:                                          # noqa: BLE001
        print(f"  FAIL scenes: {type(e).__name__}: {str(e)[:300]}")
        bad += 1
    if strips:
        ims = [Image.open(s) for s in strips]
        sheet = Image.new("RGB", (ims[0].width, sum(i.height for i in ims)))
        y = 0
        for i in ims:
            sheet.paste(i, (0, y))
            y += i.height
        sheet.save(out / "_photofx_check.png")
        print(f"  wrote {out / '_photofx_check.png'}")
    shutil.rmtree(work, ignore_errors=True)
    return bad


def _cli() -> None:
    import argparse
    ap = argparse.ArgumentParser(description="PHOTO FX DLC")
    ap.add_argument("cmd", choices=["depth", "spotlight", "object", "find", "check"])
    ap.add_argument("what", nargs="?", default="", help="depth/spotlight: a picture · object/find: a search")
    ap.add_argument("--subject", default="", help="spotlight: who or what to push in on")
    ap.add_argument("--box", default="", help="spotlight: left,top,right,bottom as fractions (skips Claude)")
    ap.add_argument("--accent", default="", help="object: a second thing that lands on it (a crown)")
    ap.add_argument("--also", action="append", default=[], help="object: more things side by side")
    ap.add_argument("--seconds", type=float, default=0.0)
    ap.add_argument("--out", default=str(HERE / "preview"))
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    if a.cmd == "check":
        sys.exit(1 if check(out) else 0)
    if a.cmd == "find":
        for c in image_search(a.what):
            print(f"  {c['source'][:28]:28s} {c['title'][:70]}\n  {'':28s} {c['url'][:110]}")
        return
    import make_video as mv
    work = out / "photofx"
    t0 = time.time()
    if a.cmd == "depth":
        src = Path(a.what)
        dest = out / f"depth_{src.stem}.mp4"
        dur = a.seconds or 5.0
        if not depth_segment(mv, src, dur, dest, work):
            sys.exit("  no clear subject in that picture — it would keep the plain zoom")
        print(f"  {dest}  ({time.time() - t0:.0f}s) — frames: {_preview_frames(dest, [0, dur / 2, dur - 0.05], dest.with_suffix('.png'))}")
        return
    if a.cmd == "spotlight":
        folder = work / f"spot_{Path(a.what).stem}"
        folder.mkdir(parents=True, exist_ok=True)
        photo = folder / "photo.jpg"
        load_rgb(a.what).save(photo, "JPEG", quality=95)
        if a.box:
            box = [float(v) for v in a.box.split(",")]
        else:
            subject = a.subject or "the main subject"
            picks = ask_picks(mv, spot_prompt(subject, subject, subject, [{"title": subject, "source": "your file"}]), [photo])
            if not picks:
                sys.exit("  Claude could not find the subject in that photo")
            box = picks[0][1]
        src = load_rgb(photo)
        crop = spot_crop(src.size, box)
        cp = folder / "crop.jpg"
        src.crop(crop).save(cp, "JPEG", quality=94)
        cut = cutout(cp, work / "cutouts", log=mv.log)
        geo = spotlight_layers(photo, box, cut, crop, folder / "layers")
        dest = out / f"spot_{Path(a.what).stem}.mp4"
        dest.unlink(missing_ok=True)
        dur = a.seconds or SPOT_DUR
        render([(spotlight_scene(folder / "layers", geo, dur, 0.9), dest)])
        print(f"  {dest}  ({time.time() - t0:.0f}s, box {box}, cutout {'yes' if geo['cut'] else 'no'}, zoom {geo['zoom']})"
              f" — frames: {_preview_frames(dest, [0, 1.6, dur - 0.05], dest.with_suffix('.png'))}")
        return
    things = [a.what] + list(a.also)
    folder = work / ("obj_" + re.sub(r"[^a-z0-9]+", "_", _fold(" ".join(things)))[:48])
    got = [source_thing(mv, t, folder / f"t{i}", work / "cutouts", 360 if len(things) <= 2 else 280)
           for i, t in enumerate(things)]
    accent = source_thing(mv, a.accent, folder / "accent", work / "cutouts", 220) if a.accent else None
    layout = "crown" if accent else ("solo" if len(got) == 1 else "pair" if len(got) == 2 else "row")
    sc = objects_scene([Image.open(g["png"]).convert("RGBA") for g in got], layout,
                       Image.open(accent["png"]).convert("RGBA") if accent else None, 1.5, a.seconds)
    dest = out / f"{folder.name}.mp4"
    dest.unlink(missing_ok=True)
    render([(sc, dest)])
    print(f"  {dest}  ({time.time() - t0:.0f}s, {layout}: " + ", ".join(f"{g['thing']} from {g['source']}" for g in got)
          + (f" + {accent['thing']} from {accent['source']}" if accent else "") + ")"
          f" — frames: {_preview_frames(dest, [0.35, 1.0, 2.2, sc['duration'] - 0.05], dest.with_suffix('.png'))}")


if __name__ == "__main__":
    _cli()
