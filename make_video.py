#!/usr/bin/env python3
"""make_video.py — one title in, one finished YouTube video out.

Pipeline (heavily parallelised):
  1. Claude   : title + length  ->  outline  ->  full spoken script
  2a. ai33    : script -> AI voiceover (ElevenLabs voice) + SRT subtitles
  2b. Pexels  : Claude keywords -> download a big pool of stock VIDEO + PHOTO
                b-roll  (runs at the same time as the voiceover)
  3. Claude+kie: read the SRT -> 10 photorealistic "quote written on paper /
                whiteboard" images, each tied to the moment that line is spoken
                (generated in parallel)
  4. ffmpeg   : every ~15s a new cut — AI quote images placed at their moment,
                the rest filled with Pexels b-roll (videos scaled to fill,
                photos with a slow zoom). A dust-particle overlay is screen-
                blended on top, subtitles burned in, voiceover muxed -> video.mp4

Everything is cached on disk (output/<slug>/...). Re-running resumes and never
re-spends API credits on a finished step. --force redoes everything.

Usage:
  python make_video.py "Your Video Title" --minutes 20
  python make_video.py "Your Title" --minutes 25 --force --no-subs
"""

import styles as _styles
import argparse
import difflib
import hashlib
import json
import math
import os
import random
import re
import shutil
import subprocess
import tempfile
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from dotenv import load_dotenv

import prompts
import mindmap
import motion
import features
import codex_cli

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env", override=True)

# Homebrew's full ffmpeg (with libass, which burned-in labels and subtitles need) is keg-only: brew keeps it off
# the PATH, so a plain `ffmpeg` without libass would be found first. Put it in front for this process and every
# program it starts. Nothing changes on Windows or on a machine without it.
for _ff in ("/opt/homebrew/opt/ffmpeg-full/bin", "/usr/local/opt/ffmpeg-full/bin"):
    if os.path.isfile(os.path.join(_ff, "ffmpeg")):
        if os.environ.get("PATH", "").split(os.pathsep)[0] != _ff:
            os.environ["PATH"] = _ff + os.pathsep + os.environ.get("PATH", "")
        break

# Windows consoles and pipes default to cp1252, which has no "✓", "⚠" or most
# of what these logs print — the first such line raised UnicodeEncodeError,
# and Claude Code reads output through a pipe. UTF-8 out, on every platform.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# ── Keys ───────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
AI33_API_KEY = os.environ.get("AI33_API_KEY", "")
KIE_API_KEY = os.environ.get("KIE_API_KEY", "")
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")

# No default voice: a voice belongs to a channel, and shipping one would put
# somebody else's narrator on every buyer's first video. Set it per channel
# in styles/<name>.json under "voice", or globally here as a fallback.
AI33_VOICE_ID = os.environ.get("AI33_VOICE_ID", "")
# Per-narrator voices. A style with no entry keeps the default above.
STYLE_VOICE: dict = {}        # voice id per channel, from its style file
STYLE_VOICE_PROVIDER: dict = {}   # "wavespeed" | "ai33" per channel

# ── Models / Claude-compatible providers ────────────────────────────────────
# "kie" = Claude via kie.ai (≈60% cheaper, billed to the kie wallet);
# "anthropic" = direct Anthropic API; "codex" = local Codex CLI with the
# saved ChatGPT subscription. The existing callers still use claude().
CLAUDE_PROVIDER = os.environ.get("CLAUDE_PROVIDER", "claudecode").lower()
SCRIPT_MODEL = os.environ.get("CLAUDE_SCRIPT_MODEL", "claude-sonnet-5")
# The outline (idea + structure) comes from Opus for quality; the long script BODY
# is written by the faster/cheaper Sonnet 5 — roughly 2x quicker with quality that
# stays very strong, since Opus already did the hard creative structuring.
SCRIPT_BODY_MODEL = os.environ.get("CLAUDE_SCRIPT_BODY_MODEL", "claude-sonnet-5")
UTILITY_MODEL = os.environ.get("CLAUDE_UTILITY_MODEL", "claude-sonnet-5")
# When the Claude provider (kie) has a server outage, keep retrying transient
# errors (5xx / 429 / network) for up to this long before falling back / giving up.
CLAUDE_RETRY_SECONDS = int(os.environ.get("CLAUDE_RETRY_SECONDS", "600"))
# If the primary provider keeps failing, fall back to this one ("anthropic" = direct
# Anthropic API — pricier but reliable; "" disables fallback). Only used on failure;
# a selected Codex provider never falls back to a paid HTTP provider.
CLAUDE_FALLBACK = os.environ.get("CLAUDE_FALLBACK", "anthropic").lower()  # if the CLI is not logged in
_DEAD_PROVIDERS: set = set()      # providers that already failed over this run
# How long to keep fighting for the (much cheaper) primary provider before
# switching to the pricier fallback. Bigger = ride out longer kie blips on cheap
# kie, only paying Anthropic when kie is genuinely down for this long.
CLAUDE_PRIMARY_BUDGET = int(os.environ.get("CLAUDE_PRIMARY_BUDGET", "45"))
# kie TRUNCATES long generations (it wrote 335 words where Anthropic wrote 6886 for
# the same request), so the outline+script go to Anthropic by default; the small
# utility calls (image prompts, keywords, thumbnail text) stay on cheap kie.
# Scripts can run through either the local Claude Code CLI or the local Codex CLI;
# both use their own saved login rather than MoveFast's API keys.
SCRIPT_PROVIDER = os.environ.get("SCRIPT_PROVIDER", "claudecode").lower()

# ── Visuals ────────────────────────────────────────────────────────────────
KIE_IMAGE_MODEL = os.environ.get("KIE_IMAGE_MODEL", "google/nano-banana")
NUM_AI_IMAGES = int(os.environ.get("NUM_AI_IMAGES", "10"))
SECONDS_PER_SLOT = float(os.environ.get("SECONDS_PER_SLOT", "15"))  # a cut every Ns
VIDEO_W = int(os.environ.get("VIDEO_W", "1920"))
VIDEO_H = int(os.environ.get("VIDEO_H", "1080"))
FPS = int(os.environ.get("FPS", "30"))
DUST_OVERLAY = os.environ.get("DUST_OVERLAY", str(HERE / "assets" / "overlay_dust.mp4"))
THUMB_BASE = os.environ.get("THUMB_BASE", str(HERE / "assets" / "thumb_base.png"))
THUMB_MODEL = os.environ.get("THUMB_MODEL", "gpt-image-2-image-to-image")
QR_OVERLAY = os.environ.get("QR_OVERLAY", str(HERE / "assets" / "qr.png"))
# Off unless a channel deliberately turns it on with QR_ENABLED=1 and drops
# its own image at assets/qr.png. Nothing is watermarked by default.
QR_ENABLED = os.environ.get("QR_ENABLED") == "1"
QR_HEIGHT_FRAC = float(os.environ.get("QR_HEIGHT_FRAC", "0.23"))  # QR height as fraction of video height
QR_MARGIN = int(os.environ.get("QR_MARGIN", "40"))               # px from the bottom-right edges
QR_CROP_BOTTOM = float(os.environ.get("QR_CROP_BOTTOM", "0.15"))  # crop this fraction off the bottom (removes the URL line)

# How many Pexels assets to pull (more = more variety, slightly slower)
PEXELS_VIDEOS = int(os.environ.get("PEXELS_VIDEOS", "24"))
PEXELS_PHOTOS = int(os.environ.get("PEXELS_PHOTOS", "12"))

# ── Mindmaps (manifestation) ─────────────────────────────────────────────────
# An animated node-tree that pans/zooms in sync with the voiceover. The video
# opens on a mindmap, and each minute opens with a short mindmap segment
# (overview -> the topic being discussed that minute), rest is photos/Pexels.
# TikTok Display Bold: upright, modern, very legible burned in. (NOT Montserrat —
# only italic/black cuts are installed, so libass falls back to the italic face.)
SUB_FONT = os.environ.get("SUB_FONT", "Inter ExtraBold")
# The word being spoken right now sweeps to this colour (ASS is BGR). Default is
# a warm gold — modern like the reference edits, but it does not fight the
# vintage-paper brand the way electric blue would.
CAPTION_ACCENT = os.environ.get("CAPTION_ACCENT", "&H3CB9F5&")
# BGR, not RGB — libass reads &HBBGGRR&. Kept in step with motion.BRAND so the
# word that lights up in a caption is the same colour as the graphics.
CHANNEL_ACCENT: dict = {}      # filled from styles/<name>.json


def _caption_accent(style: str) -> str:
    return os.environ.get("CAPTION_ACCENT") or CHANNEL_ACCENT.get(style or "", CAPTION_ACCENT)
CAPTION_PILL = os.environ.get("CAPTION_PILL", "1") == "1"
CAPTION_PILL_ALPHA = os.environ.get("CAPTION_PILL_ALPHA", "6E")   # ~43% black
SUB_SIZE_PX = int(os.environ.get("SUB_SIZE_PX", "73"))             # real pixels at 1080p
SUB_SIZE_CENTER_PX = int(os.environ.get("SUB_SIZE_CENTER_PX", "68"))
SUB_LINE_CHARS = int(os.environ.get("SUB_LINE_CHARS", "44"))       # one line, max this many chars
SUB_FADE_MS = int(os.environ.get("SUB_FADE_MS", "170"))            # soft appear/disappear
SUB_SHADOW = float(os.environ.get("SUB_SHADOW", "3.4"))            # drop-shadow depth (px)
# Centred-subtitle look (Carl Jung): elegant serif, mid-frame, no shadow.
SUB_FONT_SERIF = os.environ.get("SUB_FONT_SERIF", "Inter ExtraBold")   # unified family
SUB_SIZE_CENTER = os.environ.get("SUB_SIZE_CENTER", "30")
# Styles whose subtitles sit in the middle of the frame.
# Channels whose burnt-in captions sit centred rather than low. A style
# file turns this on with look.center_subtitles.
CENTER_SUB_STYLES: set = set()
# Styles that transition on WHITE between slots (seconds; 0 = hard cut).
STYLE_WHITE_FADE: dict = {}   # filled from styles/<name>.json
MOTION_SEG_DUR = float(os.environ.get("MOTION_SEG_DUR", "6"))    # length of each motion-graphics scene
MOTION_EVERY_MIN = float(os.environ.get("MOTION_EVERY_MIN", "1"))  # a scene every N minutes
# Share of the timeline that should be motion graphics rather than footage.
# 0 = use MOTION_SEG_DUR instead; a style can brief a different mix.
# On-screen graphics must be written in the narration's language. Left to
# infer it from the transcript, the model wrote English cards over Czech
# narration on one video out of three.
# Jung is a Czech-language channel by default. FORCE_ENGLISH flips one run to
# English without touching the style's look — used for promo cuts aimed at an
# international audience.
# English unless a style file says otherwise. Filled by styles.py.
STYLE_LANGUAGE: dict = {}
# Letters that only appear in Czech. Enough of them in a script means the
# narration is Czech, whatever the table or the environment happens to say.
# only the letters Czech has and Spanish, French or Portuguese names don't: "Inés García Vázquez" in an
# English script once turned every map and graphic of the video Czech
_CZ_MARKS = "ěščřžůťďň"


def _job_language(job: Path, style: str) -> str:
    """The language the GRAPHICS must speak: whatever the script speaks.

    FORCE_ENGLISH is a per-run environment flag, so a cached English script
    re-entering the pipeline without it had its graphics regenerated in Czech —
    an English voiceover under Czech headlines. The script is the ground truth
    and it is sitting right there, so it is what gets asked.
    """
    # The channel's own declaration is the answer. It used to sniff the script
    # instead, because FORCE_ENGLISH could make a script disagree with its
    # style — but the language is now stated in the prompt itself, so the script
    # always matches. The sniff stays as a contradiction check: Czech letters
    # under a style claiming otherwise means the script is what to believe.
    declared = STYLE_LANGUAGE.get(style) or "English"
    f = job / "script.txt"
    if f.exists() and "CZECH" not in declared.upper():
        txt = f.read_text(errors="replace", encoding="utf-8")
        letters = sum(c.isalpha() for c in txt) or 1
        if sum(txt.lower().count(c) for c in _CZ_MARKS) / letters > 0.004:
            return "CZECH (čeština)"
    return declared
# Share of the timeline that is motion graphics rather than footage. Raised
# across the board — the reference edits keep something drawn on screen far
# more of the time than a stock-clip montage does.
# Scene LENGTH is now capped outright rather than derived from a share of the
# interval: a 22s graphic is a slide, not an edit. The ratio only decides how
# much of the slot a scene may take when the interval is short.
STYLE_MOTION_RATIO: dict = {}  # filled from styles/<name>.json
MOTION_MAX_DUR = float(os.environ.get("MOTION_MAX_DUR", "10"))   # never longer
MOTION_DEFAULT_DUR = float(os.environ.get("MOTION_DEFAULT_DUR", "6"))
# A half-and-half mix at a one-minute cadence would mean 30s scenes, which
# drag. Tighter slots keep the same ratio with scenes that stay alive.
# One graphic every 30 seconds, everywhere.
STYLE_EVERY_MIN: dict = {}     # filled from styles/<name>.json
STYLE_WPM: dict = {}           # the narrator's real pace per channel (pacing.wpm), for the script's length
MOTION_WORKERS = int(os.environ.get("MOTION_WORKERS", "4"))       # parallel Chromium renderers
# 8 measured only ~15% faster and made the Playwright driver fail to start,
# killing jobs that had already paid for image generation. Not worth it.
MINDMAP_SEG_DUR = float(os.environ.get("MINDMAP_SEG_DUR", "20"))   # length of each mindmap segment (>=20s)
MINDMAP_WORKERS = int(os.environ.get("MINDMAP_WORKERS", "4"))     # parallel Chromium renderers
# Mindmap-ONLY mode: the whole video is one big mindmap (no AI/Pexels), any style.
MINDMAP_FULL_CHUNK = float(os.environ.get("MINDMAP_FULL_CHUNK", "45"))   # render the long animation in Ns chunks
MINDMAP_FULL_WORKERS = int(os.environ.get("MINDMAP_FULL_WORKERS", "6"))  # parallel chunk renderers

# ── Scene-based visuals ──────────────────────────────────────────────────────
# A different channel: esoteric AI-generated art (NO Pexels), a new visual every
# ~10s, every Nth slot an AI-generated video clip (Seedance image-to-video),
# black vignette + dust. Pools are rotated across slots (no back-to-back repeat)
# to keep the cost per video sane — raise the pools for more uniqueness.
ASTRO_VIDEO_EVERY = int(os.environ.get("ASTRO_VIDEO_EVERY", "3"))   # every Nth visual is a video (slot 0 incl.)
# A new picture at least every ~10s keeps the edit alive; these are the caps.
ASTRO_PHOTO_SLOT = float(os.environ.get("ASTRO_PHOTO_SLOT", "6"))   # a still shows for max this many seconds
# documentary: a plain still (a slow move is not "something happening") holds at most this long — owner rule
STILL_MAX_S = float(os.environ.get("STILL_MAX_S", "4"))
ASTRO_VIDEO_SLOT = float(os.environ.get("ASTRO_VIDEO_SLOT", "5.5"))  # a video clip shows for this many seconds
MAX_FOOTAGE_SHOT_SECONDS = 5.0  # hard editorial limit; configuration can only shorten footage slots
ASTRO_ZOOM_TOTAL = float(os.environ.get("ASTRO_ZOOM_TOTAL", "0.1875"))  # still zoom amount (25% faster than 0.15)
ASTRO_STILL_POOL = int(os.environ.get("ASTRO_STILL_POOL", "45"))    # unique stills shown as PHOTOS
# Seedance clips cost 45 credits each vs 4 for a still — 57% of a video's whole
# bill for roughly a tenth of its screen time, because free Pexels footage already
# fills most video slots. Off by default; set ASTRO_VIDEO_POOL to re-enable.
ASTRO_VIDEO_POOL = int(os.environ.get("ASTRO_VIDEO_POOL", "0"))     # unique stills ANIMATED into clips (never shown as photos)
ASTRO_VIDEO_MAX_REUSE = int(os.environ.get("ASTRO_VIDEO_MAX_REUSE", "2"))  # each AI clip appears at most this many times; then video slots fall back to photos
ASTRO_PEXELS_POOL = int(os.environ.get("ASTRO_PEXELS_POOL", "42"))  # aesthetic real Pexels videos (mixed throughout) — more real footage
ASTRO_VIGNETTE = os.environ.get("ASTRO_VIGNETTE", "1") == "1"       # subtle black vignette

# ── how a video is mixed ────────────────────────────────────────────────────
# Share of screen time for each kind of visual, set per job from the UI sliders.
# The defaults are what the tool did before the sliders existed, measured off a
# finished 30-minute video: AI stills 26 %, stock footage 42 %, graphics 32 %
# (graphics = the motion scenes plus the card/slit/highlight treatments).
# Leaving the sliders alone therefore changes nothing about how a video is cut.
MIX_DEFAULT = (26.0, 42.0, 32.0)
GFX_MOTION_SHARE = 0.66     # of the graphics share, this much is motion scenes
_MIX = MIX_DEFAULT          # set per job by set_mix()

# One channel is one look, so these are per-style tables filled from styles/<name>.json.
STYLE_CHARACTER: dict = {}   # the recurring cast, repeated into every image prompt
STYLE_CAPTIONS: dict = {}    # per-channel caption size / case / weight
STYLE_ZOOM: dict = {}        # "in" (the default) or "alternate": in, then out, then in
STYLE_MIX: dict = {}         # the channel's own default slider positions
_CHARACTER = ""              # per-job override of the cast, typed in the UI
_CAST_FROM_AVATAR = False    # the cast is the AI presenter: their photo only rides on the stills they appear in
STYLE_NO_GRAPHICS: set = set()   # channels that are pictures only — never a graphics scene
STYLE_PHOTO_EVERY: dict = {}     # seconds of narration per still, for channels that never repeat one
STYLE_PLACEMENT: dict = {}       # "story": every still on the line it was drawn for, in order
STYLE_CHARACTER_IMAGE: dict = {} # the main character's reference picture, under assets/
STORY_MAX_STILLS = int(os.environ.get("STORY_MAX_STILLS", "420"))
STORY_CHUNK_FRAMES = int(os.environ.get("STORY_CHUNK_FRAMES", "36"))   # frames per storyboard reply
_CHARACTER_IMAGE = ""            # this job's character picture (a path under assets/), picked in Options
STYLE_ENCODE: dict = {}          # per-channel x264 settings for the finished video (look.encode)
STYLE_NO_DUST: set = set()       # channels drawn clean: no dust overlay...
STYLE_NO_VIGNETTE: set = set()   # ...and no dark vignette
STYLE_NO_LEAK: set = set()       # ...and plain cuts between footage, no film-burn light leak
STYLE_OVERLAY: dict = {}         # a channel's own screen-blended overlay video (look.overlay: tape noise, dust)
STYLE_OVERLAY_PNG: dict = {}     # ...and a still laid over every frame (look.overlay_png: VHS scanlines, a vignette)
STYLE_NO_PUNCH: set = set()      # channels that never turn a footage slot into a punch-line card
HOSTED_FILE = HERE / "assets" / "characters" / "hosted.json"
_HOSTED_LOCK = threading.Lock()
# catbox closes the connection on python-requests' own User-Agent, so every call
# to it introduces itself.
_HOST_HEADERS = {"User-Agent": "MoveFast (faceless video generator)"}
# Said first in every prompt that carries the character picture. Without it the
# model also copied the picture's surroundings — a scene written for a repair shop
# came back in the kitchen the reference drawing stands in.
REF_ONLY_CHARACTER = ("The reference image shows the main character only: take their face, hair, skin, "
                      "clothes and build from it, never its background, room, framing or pose. ")


def _x264_final(style: str) -> list:
    """Encoder settings for the finished video.

    Flat drawn artwork is where a fast encoder shows: during a slow zoom its
    motion search snaps flat colour to whole blocks, so the picture seems to swim.
    Measured on a flat drawn still, veryfast crf 21 added 0.54 px of wobble to a
    zoom that was steady to 0.09 px; slow + tune animation at crf 18 held it to
    0.15 px, in a smaller file, at about three times the encode time. So a channel
    opts in with `look.encode`; every other channel keeps the fast default."""
    enc = STYLE_ENCODE.get(style) or {}
    args = ["-preset", str(enc.get("preset") or "veryfast")]
    if enc.get("tune"):
        args += ["-tune", str(enc["tune"])]
    return args + ["-crf", str(enc.get("crf") or 21)]


_HW_ENC: list = []


def _hw_final_encoder() -> list:
    """The Mac's own video encoder for the finished video, or [] (x264 then).

    Measured on a minute of a finished documentary (M4): VideoToolbox at -q:v 75 encoded in 8 s what x264
    medium/film/crf 19 took 25.5 s for, SSIM 0.991 against 0.994, about 1.6x the file size. Only the final
    pass: in-between segments gained 30% for 70% more disk, so they stay x264. FINAL_ENCODER=x264 turns it off."""
    if not _HW_ENC:
        ok = False
        if (os.environ.get("FINAL_ENCODER") or "videotoolbox").lower() == "videotoolbox" and sys.platform == "darwin":
            try:
                ok = "h264_videotoolbox" in subprocess.run(["ffmpeg", "-hide_banner", "-encoders"],
                                                          capture_output=True, text=True, timeout=30).stdout
            except (OSError, subprocess.TimeoutExpired):
                ok = False
        _HW_ENC.append(["-c:v", "h264_videotoolbox", "-q:v", os.environ.get("FINAL_HW_QUALITY", "75"),
                        "-profile:v", "high"] if ok else [])
    return _HW_ENC[0]


def _x264_segment(style: str) -> list:
    """Settings for an in-between segment, which is encoded again at the end: a
    channel with `look.encode` keeps it near lossless, so the final pass starts from
    clean frames instead of compressing compression."""
    return ["-preset", "veryfast", "-crf", "12" if STYLE_ENCODE.get(style) else "20"]


def set_character_image(rel: str = "") -> None:
    """This job's character picture, overriding the channel's own. Reset on every
    run, like the cast text, so one video's character never leaks into the next."""
    global _CHARACTER_IMAGE
    _CHARACTER_IMAGE = (rel or "").strip().replace("\\", "/")


def character_image_path(style: str):
    """The picture the main character is drawn from: the one picked in Options,
    else the channel's own `look.character_image`. None when there is neither."""
    for rel in (_CHARACTER_IMAGE, STYLE_CHARACTER_IMAGE.get(style) or ""):
        rel = str(rel).strip().replace("\\", "/")
        if rel and ".." not in rel.split("/"):
            p = HERE / "assets" / rel
            if p.is_file():
                return p
    return None


def _image_url_ok(url: str) -> bool:
    """True when the link answers with a picture — what the image model will fetch."""
    try:
        r = requests.get(url, headers=_HOST_HEADERS, timeout=30, stream=True)
        ok = r.status_code == 200 and (r.headers.get("Content-Type") or "").startswith("image/")
        r.close()
        return ok
    except requests.exceptions.RequestException:
        return False


def host_image(path: Path) -> str:
    """A public link to a local picture, or "" when no host would take it.

    Image models take reference images ONLY as links, so the picture goes
    to catbox.moe (free, anonymous, permanent), or to uguu.se (files expire after
    a few hours) when catbox is down. Each link is remembered by the picture's hash
    in assets/characters/hosted.json and uploaded again only once it stops
    answering — replacing the picture, even under the same file name, therefore
    always sends the new one."""
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with _HOSTED_LOCK:
        try:
            known = json.loads(HOSTED_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            known = {}
        url = str(known.get(digest) or "")
        if url and _image_url_ok(url):
            return url
        for host in ("catbox.moe", "uguu.se"):
            try:
                with path.open("rb") as fh:
                    if host == "catbox.moe":
                        r = requests.post("https://catbox.moe/user/api.php", data={"reqtype": "fileupload"},
                                          files={"fileToUpload": (path.name, fh)},
                                          headers=_HOST_HEADERS, timeout=180)
                        got = (r.text or "").strip()
                    else:
                        r = requests.post("https://uguu.se/upload", files={"files[]": (path.name, fh)},
                                          headers=_HOST_HEADERS, timeout=180)
                        got = str((((r.json() if r.status_code == 200 else {}).get("files") or [{}])[0]
                                   ).get("url") or r.text[:80]).strip()
            except (requests.exceptions.RequestException, ValueError) as e:
                log(f"  ⚠ {host}: upload failed — {str(e)[:80]}")
                continue
            if r.status_code == 200 and got.startswith("https://") and _image_url_ok(got):
                known[digest] = got
                try:
                    HOSTED_FILE.write_text(json.dumps(known, indent=2) + "\n", encoding="utf-8")
                except OSError:
                    pass
                log(f"  character picture put online for the image model ({host})")
                return got
            log(f"  ⚠ {host}: HTTP {r.status_code} {got[:80]}")
        return ""


_BRANDS = ("upwork", "etsy", "fiverr", "facebook", "marketplace", "amazon", "ebay", "shopify", "printify", "youtube",
           "tiktok", "instagram", "google", "apple", "nike", "disney", "netflix", "spotify", "airbnb", "uber", "paypal",
           "stripe", "twitter", "reddit", "linkedin", "walmart", "tesla", "microsoft", "openai", "chatgpt", "acorns")


def _plain_prompt(prompt: str) -> str:
    """The same picture without what image models refuse: brand and platform names, text in quotes, sums of money."""
    t = re.sub(r"[\"“”'‘’][^\"“”'‘’]{1,80}[\"“”'‘’]", "", prompt)
    t = re.sub(r"\$\s?\d[\d,.]*[kKmM]?", "some money", t)
    for b in _BRANDS:
        t = re.sub(rf"\b{b}\b", "a website", t, flags=re.I)
    t = re.sub(r"(?:\ba a website\b|\ba website\b)(?:\s+a website\b)+", "a website", t)
    t = re.sub(r"\ba a website\b", "a website", t)
    t = re.sub(r"\bfrom\s+to\b", "", t)
    t = re.sub(r"\s+([,.;])", r"\1", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


STYLE_REF_NOTE = ("STYLE REFERENCE: the first reference image shows the exact drawing style to copy — the same kind of "
                  "line, the same hand, the same imperfections, the same background and the same amount of empty space. "
                  "Do NOT copy its subject; draw the subject described below in that style. ")


def _style_refs(style: str) -> list:
    """[the channel's style drawing's public link] for the reference slot of every still (look.style_image,
    a path under assets/), or []."""
    rel = str(((STYLE_INFO.get(style) or {}).get("look") or {}).get("style_image") or "").strip()
    if not rel:
        return []
    p = Path(rel) if Path(rel).is_absolute() else HERE / "assets" / rel
    if not p.exists():
        return []
    url = host_image(p)
    return [url] if url else []


def _shows_presenter(prompt: str) -> bool:
    """Does this still show the AI presenter? The art director copies their description word for word into
    every prompt they appear in (avatar.cast_text), so a stretch of it in the prompt means yes."""
    cast = (_CHARACTER or "").split(":", 1)[-1].strip()
    probe = re.sub(r"\s+", " ", cast)[:48].lower()
    return bool(probe) and probe in re.sub(r"\s+", " ", prompt or "").lower()


def _character_refs(style: str) -> list:
    """[the main character's public link], for the reference slot of every still — or []."""
    p = character_image_path(style)
    if p is None:
        return []
    url = host_image(p)
    return [url] if url else []


def describe_character(path: Path) -> str:
    """The cast text for an uploaded character, written by Claude from the picture.

    The storyboard pastes the cast into every image prompt, so a new face needs
    words that match it — otherwise the prompt would still describe the channel's
    old character while the reference shows the new one."""
    raw = claude_vision(prompts.CHARACTER_DESC_PROMPT, [path])
    text = re.sub(r"^```[a-z]*|```$", "", (raw or "").strip(), flags=re.M).strip()
    if "reference image" not in text.lower():
        raise _ClaudeError("the character description came back in the wrong shape")
    return text


def set_character(text: str = "") -> None:
    """This job's cast, overriding the channel's own. Reset on every run so one
    video's character never leaks into the next."""
    global _CHARACTER
    _CHARACTER = (text or "").strip()


# DLCs that put their own scenes on the words they belong to, in the order they claim a
# moment: a map first, then a real article on screen, then a real photo or object (PHOTO FX).
# Each is one module in this folder. Keep the line's shape: a DLC installer checks for this
# exact text, so a later DLC is appended rather than written into the first tuple.
SCENE_DLCS = ("maps", "headlines") + ("photofx",) + ("vox",) + ("cinema", "warchess", "legends", "heygen_scenes")
_DLC_OFF: set = set()            # scene DLCs switched off for this job in Options
# Scenes a DLC places that are pictures, not graphics — a real photo, a real object: the
# captions and the dust stay on them, where every other graphics scene mutes both.
CAPTIONED_SCENES = ("spot_", "objects_", "strip_", "tilt_", "match_", "opening")   # "opening": a LEGEND clip keeps its own lines


def set_scene_dlcs(maps: bool = True, headlines: bool = True, spotlight: bool = True,
                   objects: bool = True, depth: bool = True) -> None:
    """Which scene DLCs this job runs. Reset on every run, like the mix. PHOTO FX has three
    switches: its two scenes (a photo spotlight, real objects) and the depth pop on AI stills."""
    _DLC_OFF.clear()
    _DLC_OFF.update(name for name, on in (("maps", maps), ("headlines", headlines), ("spotlight", spotlight),
                                          ("objects", objects), ("depth", depth)) if not on)
    if not (spotlight or objects):
        _DLC_OFF.add("photofx")


# ── Options: what this video is built from ──────────────────────────────────
# One switch per entry in features.FEATURES (YouTube footage, stock, AI images, depth pop, motion
# graphics, Vox scenes, maps, photo spotlight, real objects, newspaper animations, sound design).
# The channel's style file says which it offers and which start ticked; Options can untick any;
# a switch whose API key is missing is off whatever was asked. Reset on every run, like the mix.
_FEATURES: dict = {}
_EXTRA = ""               # the creator's extra instructions for this one video


def set_features(style: str, asked: dict = None) -> dict:
    global _FEATURES
    _FEATURES = features.resolve(STYLE_INFO.get(style) or {}, asked)
    return _FEATURES


def feature(key: str) -> bool:
    """Whether this job uses a feature. Before any job sets them, everything is allowed."""
    return bool(_FEATURES.get(key, True)) if _FEATURES else True


def set_extra(text: str = "") -> None:
    global _EXTRA
    _EXTRA = (text or "").strip()[:4000]


_YT_LINK = re.compile(r"https?://(?:www\.|m\.)?(?:youtube\.com|youtu\.be)/[^\s<>\"'\])]+", re.I)
SOURCE_CHARS = int(os.environ.get("SOURCE_CHARS", "30000"))   # the most of one linked video's transcript that is read


def _linked_videos(text: str, title: str, work: Path) -> list:
    """[(video id, how it was found)] — the YouTube videos linked in the extra instructions: a video link as it
    is; a channel or playlist link as its (at most two) videos whose titles share the most words with this title."""
    import youtube
    out = []
    for url in dict.fromkeys(_YT_LINK.findall(text or "")):
        url = url.rstrip(".,;")
        m = re.search(r"(?:v=|youtu\.be/|shorts/|live/|embed/)([A-Za-z0-9_-]{11})", url)
        if m:
            out.append((m.group(1), "linked"))
            continue
        target = url
        if re.search(r"youtube\.com/(@[^/?#]+|channel/[^/?#]+|c/[^/?#]+|user/[^/?#]+)/?$", url):
            target = url.rstrip("/") + "/videos"
        try:
            p = subprocess.run(youtube.ytdlp() + ["--flat-playlist", "-J", "--playlist-end", "120", "--no-warnings", target],
                               capture_output=True, text=True, timeout=180)
            entries = (json.loads(p.stdout or "{}").get("entries") or [])
        except (subprocess.TimeoutExpired, ValueError, OSError) as e:
            log(f"  sources: could not list {url[:60]} — {type(e).__name__}")
            continue
        words = lambda s: {w for w in re.findall(r"[a-z0-9]+", _fold(str(s))) if len(w) > 3}
        want = words(title)
        ranked = sorted(((len(words(e.get("title")) & want), e) for e in entries if e.get("id")),
                        key=lambda x: -x[0])
        picked = [(e["id"], f"from {url[:60]}: \"{str(e.get('title'))[:70]}\"") for n, e in ranked[:2] if n >= 2]
        if not picked:
            log(f"  sources: no video on {url[:60]} shares this title's words — none read from it")
        out += picked
    return list(dict.fromkeys(out))[:4]


def _sources_block(job: Path, title: str) -> str:
    """What the YouTube videos linked in the extra instructions say, as research for the outline and the script:
    facts to build on, never wording to copy. Read once from YouTube's own captions (free) and cached in
    job/sources.txt."""
    if not _YT_LINK.search(_EXTRA or ""):
        return ""
    cache = job / "sources.txt"
    if cache.exists():
        return cache.read_text(encoding="utf-8")
    import youtube
    if not youtube.ytdlp():
        log("  sources: yt-dlp is not installed, so the linked videos could not be read")
        return ""
    work = job / "sources"
    parts, names = [], []
    for vid, how in _linked_videos(_EXTRA, title, work):
        rows = youtube.transcript(vid, work, original=True)
        text = " ".join(w for _, w in rows)
        if len(text.split()) < 80:
            log(f"  sources: {vid} has no captions to read")
            continue
        try:
            info = json.loads((work / "info" / f"{vid}.info.json").read_text(encoding="utf-8"))
            vt = str(info.get("title") or vid)
        except (OSError, ValueError):
            vt = vid
        names.append(f"\"{vt[:60]}\" ({len(text.split())} words)")
        parts.append(f"SOURCE {len(parts) + 1}: \"{vt}\" (youtube.com/watch?v={vid}, {how})\n{text[:SOURCE_CHARS]}")
    shutil.rmtree(work / "info", ignore_errors=True)
    if not parts:
        return ""
    log(f"sources: {len(parts)} linked video(s) read — " + ", ".join(names))
    block = ("\n\nSOURCES THE CREATOR LINKED — transcripts of real videos on this subject (captions, so names can be "
             "misspelled). Use them as research: the facts, names, dates, numbers and the order of events. Check "
             "each fact against what you know and leave out anything doubtful or contradicted. Write everything in "
             "your own words and your own structure — never copy their sentences, their jokes, their sponsor reads "
             "or their calls to action.\n\n" + "\n\n".join(parts) + "\n")
    cache.write_text(block, encoding="utf-8")
    return block


def _extra_block() -> str:
    """The extra instructions, appended to every prompt that shapes what the viewer sees or hears."""
    if not _EXTRA:
        return ""
    return ("\n\nEXTRA INSTRUCTIONS FROM THE CREATOR FOR THIS VIDEO — follow them wherever they apply, "
            "unless they contradict a rule about the output format:\n" + _EXTRA + "\n")


def _features_mix(style: str, f: dict) -> tuple:
    """The visual mix these switches allow: the channel's own shares, with the switched-off sources
    given to what is left. YouTube footage and stock footage share the footage slots."""
    ai, st, gf = STYLE_MIX.get(style) or MIX_DEFAULT
    ai = ai if f.get("ai_images") else 0.0
    st = st if (f.get("stock") or f.get("youtube")) else 0.0
    gf = gf if f.get("motion") else 0.0
    if ai + st + gf <= 1:
        # nothing that fills a slot is on: keep footage slots, the scene DLCs and stills fill in
        return (0.0, 70.0, 30.0) if (f.get("youtube") or f.get("stock")) else (100.0, 0.0, 0.0)
    return (ai, st, gf)


def _apply_features(style: str, asked, mix: tuple, use_motion: bool, maps: bool, headlines: bool,
                    spotlight: bool, objects: bool, depth: bool) -> tuple:
    """Resolve the switches for a job and turn them into the engine's older knobs. A job that sent
    no switches, for a channel with no `features`, keeps exactly the old behaviour."""
    if asked is None and not (STYLE_INFO.get(style) or {}).get("features"):
        global _FEATURES
        _FEATURES = {}
        return mix, use_motion, maps, headlines, spotlight, objects, depth
    f = set_features(style, asked if isinstance(asked, dict) else None)
    if _styles.is_documentary(style) and not use_motion:
        f["motion"] = False  # War Chess follows the same Motion graphics control.
    if not mix:
        mix = _features_mix(style, f)
    on = [k for k, v in f.items() if v]
    log(f"options: {', '.join(on) if on else 'nothing extra'}")
    return (mix, bool(use_motion and f["motion"]), f["maps"], f["headlines"], f["spotlight"],
            f["objects"], f["depth"])


def _mutes_captions(entry, sub_center: bool = False) -> bool:
    """Whether a plan slot hides the burnt-in captions and the dust: a graphics scene shows its
    own words, a treated slot its own line. A real photo or object from PHOTO FX is a picture and
    keeps both — unless the captions sit mid-frame, exactly where an object lands."""
    kind, name = entry[0], Path(str(entry[1])).name
    if kind in PUNCH_KINDS:
        return True
    if kind != "motion":
        return False
    if name.startswith(CAPTIONED_SCENES):
        return sub_center and name.startswith("objects_")
    return True


def _lock_mix(style: str) -> None:
    """A pictures-only channel stays pictures only, whatever the sliders say: no
    graphics share — and a story channel no stock footage either, because its
    pictures carry the plot and a stock clip would drop the character mid-story."""
    if style not in STYLE_NO_GRAPHICS:
        return
    ai, stock = _MIX[0], _MIX[1]
    if STYLE_PLACEMENT.get(style) == "story" or ai + stock <= 1:
        set_mix(100, 0, 0)
    else:
        set_mix(ai, stock, 0)


def set_mix(ai: float = 0.0, stock: float = 0.0, gfx: float = 0.0) -> tuple:
    """Remember this job's visual mix, normalised to 100. Anything that does not
    add up (all zeros, a single slider) falls back to the defaults."""
    global _MIX
    vals = [max(0.0, float(ai or 0)), max(0.0, float(stock or 0)), max(0.0, float(gfx or 0))]
    total = sum(vals)
    _MIX = tuple(round(v * 100.0 / total, 2) for v in vals) if total > 1 else MIX_DEFAULT
    return _MIX


def _mix_every_min(seg_dur: float) -> float:
    """Minutes between graphics scenes so their screen time matches the slider.
    0 when the mix is untouched, so the channel's own cadence still decides."""
    if _MIX == MIX_DEFAULT:
        return 0.0
    share = _MIX[2] * GFX_MOTION_SHARE / 100.0
    if share <= 0.002:
        return 0.0                      # no graphics at all — handled by use_motion
    return max(seg_dur / share, seg_dur + 5.0) / 60.0


def _mix_seg_dur(base: float) -> float:
    """How long one graphics scene runs, for this mix. A large graphics share is
    spent on LONGER scenes first and only then on more frequent ones: a six-second
    beat every eleven seconds is a slideshow, a nine-second scene every twenty is
    an edit. Also the only way past the ceiling — at six seconds a scene can never
    fill much more than half the video, whatever the slider says."""
    if _MIX == MIX_DEFAULT:
        return base
    share = _MIX[2] * GFX_MOTION_SHARE / 100.0
    if share <= 0.30:
        return base
    return min(MOTION_MAX_DUR, base + (share - 0.30) * (MOTION_MAX_DUR - base) / 0.25)


def _mix_punch_every_s() -> float:
    """Seconds between punch-line treatments, from the same graphics slider."""
    if _MIX == MIX_DEFAULT:
        return PUNCH_EVERY_S
    share = _MIX[2] * (1.0 - GFX_MOTION_SHARE) / 100.0
    return 0.0 if share <= 0.002 else max(PUNCH_DUR / share, PUNCH_DUR + 10.0)


def _mix_pexels_pool() -> int:
    """How many stock clips to fetch for this mix (the pool, not the slot count)."""
    if _MIX[1] <= 0.5 or not feature("stock"):
        return 0                        # the slider says no stock: fetch none at all
    return max(6, min(90, int(round(ASTRO_PEXELS_POOL * _MIX[1] / MIX_DEFAULT[1]))))


def _mix_stills_per_min() -> float:
    """Unique AI stills to generate per minute of video, for this mix."""
    if _MIX[0] <= 0.5:
        return 0.4                      # still a few, so a slot always has something
    return max(0.4, min(4.0, 2.0 * _MIX[0] / MIX_DEFAULT[0]))
ASTRO_LEAK = os.environ.get("ASTRO_LEAK", "1") == "1"              # film-burn light-leak transition on video slots
# The leak file holds TWO flashes: 0.00-0.95s, then dark until a second burst
# at 2.4s. Taking 1.8s meant the back half of the transition was pure black,
# so nothing showed after the cut. Use just the first flash and split it.
ASTRO_LEAK_DUR = float(os.environ.get("ASTRO_LEAK_DUR", "0.95"))
# Screen-blended at full strength the burn pushed the frame past Y=130 on a
# video averaging 39 — a white-out, not a transition. Dimmed at the source.
LEAK_STRENGTH = float(os.environ.get("LEAK_STRENGTH", "0.55"))
_LEAK_DIM = f"colorchannelmixer=rr={LEAK_STRENGTH}:gg={LEAK_STRENGTH}:bb={LEAK_STRENGTH}"
LIGHTLEAK = Path(os.environ.get("LIGHTLEAK", str(HERE / "assets" / "lightleak.mp4")))
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")            # faster-whisper model for BYO-voiceover transcription
# Seedance 1.0 Lite image-to-video — cheapest kie video model (~$0.01/s, 10s max).
KIE_VIDEO_MODEL = os.environ.get("KIE_VIDEO_MODEL", "bytedance/v1-lite-image-to-video")
KIE_VIDEO_RES = os.environ.get("KIE_VIDEO_RES", "720p")            # 480p|720p|1080p
KIE_VIDEO_DUR = os.environ.get("KIE_VIDEO_DUR", "10")             # "5" or "10"

# ── Concurrency ────────────────────────────────────────────────────────────
_CPU = os.cpu_count() or 4
# Each ffmpeg is itself multi-threaded, so 10 parallel encodes on 12 cores drove
# the load average past 40 and starved the Chromium driver into failing to start.
RENDER_WORKERS = int(os.environ.get("RENDER_WORKERS", str(min(6, max(2, _CPU // 2)))))
FFMPEG_THREADS = os.environ.get("FFMPEG_THREADS", "2")   # cap per-process threads
AI_IMG_WORKERS = int(os.environ.get("AI_IMG_WORKERS", "10"))
DL_WORKERS = int(os.environ.get("DL_WORKERS", "8"))

# Videos land in MoveFast/output. MOVEFAST_OUTPUT moves that folder somewhere else — an external
# SSD, say — when the machine's own disk is too small for 35-minute renders.
OUTPUT_ROOT = Path(os.environ["MOVEFAST_OUTPUT"]).expanduser() if os.environ.get("MOVEFAST_OUTPUT") \
    else HERE / "output"

_SINK = None  # callable(str) | None — set by the web UI for live logs

# Stock footage arrives graded however the shooter graded it. Dropped into a
# dark channel unchanged, a brightly lit office clip jumps the frame from
# Y=21 to Y=149 across a single cut — measured on a finished video — which
# reads as a different edit rather than the next shot. Each channel pulls its
# footage into its own tonal range instead.
FOOTAGE_GRADE: dict = {}      # filled from styles/<name>.json
_GRADE = ""          # set per job from style.txt; empty = footage untouched
# Every loaded style, keyed by name — set once by styles.load_all() so any
# prompt can describe the channel it is serving. See prompts.CHANNEL_TOKEN.
STYLE_INFO: dict = {}
THUMB_FONT = os.environ.get("THUMB_FONT", "Inter Black")


def _grade_vf() -> str:
    """The channel's footage grade, as a filter fragment ready to append."""
    return ("," + _GRADE) if _GRADE else ""


def log(msg: str) -> None:
    print(f"  {msg}", flush=True)
    if _SINK:
        _SINK(f"  {msg}")


_T0 = [0.0]      # when this job started, for the elapsed time on every step


def step(msg: str) -> None:
    now = time.time()
    if msg.startswith("Title:") or not _T0[0]:
        _T0[0] = now
    el = int(now - _T0[0])
    stamp = f"  [{el // 60}:{el % 60:02d}]" if el else ""
    print(f"\n=== {msg} ==={stamp}", flush=True)
    if _SINK:
        _SINK(f"=== {msg} ==={stamp}")


def slugify(text: str) -> str:
    """Folder name for a job.

    The name is truncated, so two titles that share a long opening collapsed to
    the SAME folder — a second video then found a finished video.mp4 sitting
    there and returned the older one instead of building anything. A short digest
    of the full title keeps distinct titles in distinct folders.
    """
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "video"
    if len(s) <= 52:
        return s
    digest = hashlib.sha1(text.strip().encode("utf-8")).hexdigest()[:6]
    return f"{s[:52].rstrip('-')}-{digest}"


# ── where a video lives ─────────────────────────────────────────────────────────
# output/<channel>/<Video title>/          what goes to YouTube: the video (once), its description, its thumbnails
# output/<channel>/_work/<slug>/           everything else — the voice, the footage, the segments, the plans
# The engine works in _work/<slug>/ exactly as it always worked in output/<slug>/ (the folder is still named after
# the video, which the footage memory, the music rotation and every per-video seed key on). When a video is finished
# it is MOVED up into its own folder under its title: a second copy of a 2 GB file on a drive that cannot hard-link
# was a second 2 GB. A video made before this layout (output/<slug>/) is found and finished where it already is.
WORK_DIR = "_work"


def style_folder(style: str) -> str:
    """The folder a channel's videos go in — the channel's own name; a variant look files under its channel."""
    base = str((STYLE_INFO.get(style) or {}).get("variant_of") or style or "")
    return re.sub(r"[^a-z0-9.-]+", "-", base.lower()).strip("-.") or "videos"


def _is_old_job(d: Path) -> bool:
    """An output/<slug>/ folder of the layout before (a video, not a channel folder)."""
    return (d.is_dir() and d.name != WORK_DIR and not (d / WORK_DIR).is_dir()
            and ((d / "title.txt").exists() or (d / "script.txt").exists()))


def find_job(slug: str):
    """The working folder of an existing video (this layout first, then the flat one before it), or None."""
    if not slug or not OUTPUT_ROOT.is_dir() or slug in (".", "..") or "/" in slug or "\\" in slug:
        return None
    for c in sorted(OUTPUT_ROOT.glob(f"*/{WORK_DIR}/{slug}")):
        if c.is_dir():
            return c
    old = OUTPUT_ROOT / slug
    return old if _is_old_job(old) else None


def job_dir(title: str, style: str = "") -> Path:
    """Where this title is (or will be) made."""
    slug = slugify(title)
    return find_job(slug) or (OUTPUT_ROOT / style_folder(style) / WORK_DIR / slug)


def _title_of(job: Path) -> str:
    try:
        return (Path(job) / "title.txt").read_text(encoding="utf-8").splitlines()[0].strip()
    except (OSError, IndexError):
        return ""


def main_dir(job: Path) -> Path:
    """The folder that holds the finished video of a working folder (the working folder itself for an old job)."""
    job = Path(job)
    if job.parent.name != WORK_DIR:
        return job
    name = _published(job).get("folder") or Path(youtube_filename(_title_of(job) or job.name)).stem
    return job.parent.parent / name


def list_jobs() -> list:
    """Every video's working folder, both layouts."""
    if not OUTPUT_ROOT.is_dir():
        return []
    out = [c for c in OUTPUT_ROOT.glob(f"*/{WORK_DIR}/*") if c.is_dir() and not c.name.startswith(".")]
    out += [d for d in OUTPUT_ROOT.iterdir() if not d.name.startswith((".", "_")) and _is_old_job(d)]
    return out


def _published(job: Path) -> dict:
    try:
        return json.loads((Path(job) / "published.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def final_video(job: Path) -> Path:
    """The finished video of a job wherever it is now: the title-named file in its folder, or video.mp4 while the
    engine holds it (the path of video.mp4 when there is none yet)."""
    job = Path(job)
    v = job / "video.mp4"
    if v.exists():
        return v
    name = _published(job).get("video")
    if name and (main_dir(job) / name).exists():
        return main_dir(job) / name
    return v


def _move(src: Path, dest: Path) -> bool:
    """A rename that tries again for a few seconds: on Windows a video open in a player cannot be moved."""
    for attempt in range(4):
        try:
            os.replace(src, dest)
            return True
        except OSError as e:
            if attempt == 3:
                log(f"  ⚠ could not move {src.name} ({e.__class__.__name__}) — is it open in a player? "
                    f"Close it and render the title again to publish it")
                return False
            time.sleep(2 * (attempt + 1))
    return False


def _unpublish(job: Path, title: str = "") -> None:
    """Before the engine works on a finished job again (a re-render of the same title), its video goes back to
    video.mp4 in the working folder, so every cached step finds it exactly as before. Only a video published for
    THIS title: two titles that share a folder never hand each other their film."""
    job = Path(job)
    v = job / "video.mp4"
    pub = _published(job)
    name = pub.get("video")
    if v.exists() or not name:
        return
    if title and name != youtube_filename(title):
        return
    src = main_dir(job) / name
    if src.exists():
        _move(src, v)


def _republish_if_left(job: Path, title: str) -> None:
    """A run that stopped halfway (or never got to the end) leaves video.mp4 in the working folder: it goes back up."""
    try:
        if (Path(job) / "video.mp4").exists() and _published(job).get("video"):
            publish_named_copy(job, title)
    except Exception:                                       # noqa: BLE001 - never mask the real error
        pass


# ════════════════════════════════════════════════════════════════════════════
# SOUND BED  —  music under the voice, plus the intro stinger
# ════════════════════════════════════════════════════════════════════════════
SOUND_DIR = HERE / "assets" / "VOICE DESIGN"
INTRO_MUSIC = SOUND_DIR / "INTRO.wav"
SFX_HIT = SOUND_DIR / "cinematic hit.mp3"
SFX_RISER = SOUND_DIR / "cinematic riser.mp3"
SFX_CLICK = SOUND_DIR / "mouse click.mp3"
# The narration is the point; everything else sits well underneath it.
MUSIC_DB = float(os.environ.get("MUSIC_DB", "-27"))      # ambient bed under the voice
INTRO_DB = float(os.environ.get("INTRO_DB", "-16"))      # dramatic opening, louder
HIT_DB = float(os.environ.get("HIT_DB", "-17"))
RISER_DB = float(os.environ.get("RISER_DB", "-11"))
# The click is a tick, not a hit — it only marks a word appearing.
CLICK_DB = float(os.environ.get("CLICK_DB", "-12"))
INTRO_LEN = float(os.environ.get("INTRO_LEN", "30"))     # length of the dramatic open
USE_SOUND_BED = os.environ.get("USE_SOUND_BED", "1") == "1"


def _music_beds() -> list:
    """The ambient tracks, longest first so a long video needs fewer loops."""
    if not SOUND_DIR.is_dir():
        return []
    beds = [p for p in sorted(SOUND_DIR.iterdir())
            if p.suffix.lower() in (".mp3", ".wav", ".m4a")
            and p.name != INTRO_MUSIC.name
            and not p.stem.lower().startswith(("cinematic", "mouse"))]
    return sorted(beds, key=lambda p: -_audio_dur(p))


def _sound_bed(total: float, seed: int = 0, click_times=None):
    """Build the music/stinger layer that sits under the narration.

    Returns (inputs, filter_parts, label) where `label` is the mixed sound-bed
    stream, or (None, None, None) when there is nothing to add. Levels are set
    well below the voice — the bed is atmosphere, not a duet.
    """
    if not USE_SOUND_BED:
        return None, None, None
    beds = _music_beds()
    have_intro = INTRO_MUSIC.exists()
    if not beds and not have_intro and not SFX_HIT.exists():
        return None, None, None

    ins, parts, mix = [], [], []

    def _in(path, pre=None):
        ins.extend((pre or []) + ["-i", str(path)])

    # 1) ambient bed for the whole runtime, faded up after the dramatic open
    if beds:
        bed = beds[seed % len(beds)]
        # A "-stream_loop -1" input never reaches EOF, and amix sits waiting for
        # it — the final mux hung at 0% CPU for hours. Loop a counted number of
        # times, enough to cover the runtime, so the input finishes by itself.
        bed_len = max(1.0, _audio_dur(bed))
        loops = max(0, int(total // bed_len) + 1)
        _in(bed, ["-stream_loop", str(loops)])
        parts.append(
            f"[AI{len(mix)}:a]volume={MUSIC_DB}dB,"
            # comes up just AFTER the riser peaks, so the switch is a handover
            # rather than two tracks overlapping through it
            f"afade=t=in:st={INTRO_LEN - 0.5:.2f}:d=3.5,"
            f"atrim=0:{total:.3f},asetpts=N/SR/TB[bed]")
        mix.append("[bed]")

    # 2) the dramatic 30s opening, fading into deliberate quiet
    if have_intro:
        _in(INTRO_MUSIC)
        parts.append(
            f"[AI{len(mix)}:a]volume={INTRO_DB}dB,"
            # holds full until the riser is already climbing, then clears fast —
            # a long 5s fade made the switch mushy and the riser landed inside it
            f"afade=t=out:st={max(0.0, INTRO_LEN - 3):.2f}:d=3,"
            f"atrim=0:{INTRO_LEN:.3f},asetpts=N/SR/TB[intro]")
        mix.append("[intro]")

    # 3) cinematic hit on frame one
    if SFX_HIT.exists():
        _in(SFX_HIT)
        parts.append(f"[AI{len(mix)}:a]volume={HIT_DB}dB,atrim=0:6,asetpts=N/SR/TB[hit]")
        mix.append("[hit]")

    # 4) a soft click on each kinetic phrase in the opening, so the words land
    if SFX_CLICK.exists() and click_times:
        _in(SFX_CLICK, ["-stream_loop", str(max(0, len(click_times) - 1))])
        delays = "+".join(f"between(t,{t:.2f},{t + 0.18:.2f})" for t in click_times[:60])
        parts.append(
            f"[AI{len(mix)}:a]volume={CLICK_DB}dB,volume=0:enable='not({delays})'[clicks]")
        mix.append("[clicks]")

    # 5) riser that lands exactly on the end of the intro
    if SFX_RISER.exists() and INTRO_LEN > 6:
        _in(SFX_RISER)
        # A riser's loudest moment is its final instant, so it is placed to END
        # exactly on INTRO_LEN — the frame where the dramatic open hands over.
        d = _audio_dur(SFX_RISER)
        at = int(max(0.0, INTRO_LEN - d) * 1000)
        parts.append(
            f"[AI{len(mix)}:a]volume={RISER_DB}dB,adelay={at}|{at}[riser]")
        mix.append("[riser]")

    if not mix:
        return None, None, None
    parts.append("".join(mix) + f"amix=inputs={len(mix)}:duration=longest:normalize=0[bedmix]")
    return ins, parts, "[bedmix]"


def _mix_audio(job: Path, mp3: Path, click_times=None) -> Path:
    """Mix narration + music bed + stingers into one WAV, ahead of the video.

    This used to live inside the final mux. ffmpeg runs the whole filter_complex
    on a SINGLE filter thread, so the eight-input audio mix and the video chain
    shared it: the audio side would block waiting on one input while the video
    demuxers filled their queues, and the entire render deadlocked at 0% CPU.
    Mixing audio on its own — no video streams in the graph — cannot deadlock
    that way, and it hands the final mux the same one-audio-file shape it had
    before any of this existed. If the mix fails, the bare narration is used.
    """
    total = _audio_dur(mp3)
    ins, parts, label = _sound_bed(total, seed=abs(hash(job.name)) % 97,
                                   click_times=click_times)
    if not ins:
        return mp3
    out = job / "_mixed.wav"
    if out.exists():
        return out
    n_bed = sum(1 for a in ins if a == "-i")
    for k in range(n_bed):
        parts = [b.replace(f"[AI{k}:a]", f"[{k + 1}:a]") for b in parts]
    parts.append(f"[0:a:0]volume=0dB[vox]")
    parts.append(f"[vox]{label}amix=inputs=2:duration=first:normalize=0,"
                 f"dynaudnorm=f=200:g=5:p=0.9[aout]")
    cmd = ["ffmpeg", "-y", "-i", str(mp3), *ins,
           "-filter_complex", ";".join(parts), "-map", "[aout]",
           "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
           "-t", f"{total:.3f}", str(out)]
    log("ffmpeg: mixing music and effects under the voice...")
    try:
        subprocess.run(cmd, check=True, capture_output=True,
                       timeout=max(300, int(total) + 300))
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        out.unlink(missing_ok=True)
        tail = getattr(e, "stderr", b"") or b""
        log(f"  ⚠ could not mix the audio bed, continuing without it: "
            f"{tail.decode('utf-8', 'replace')[-160:] or type(e).__name__}")
        return mp3
    return out


# ════════════════════════════════════════════════════════════════════════════
# CLAUDE
# ════════════════════════════════════════════════════════════════════════════
# ── what Claude cost this job ──────────────────────────────────────────────
# Every reply carries its token counts and the engine used to throw them away,
# so "what did this video cost?" had no answer except an org-wide daily total
# from an Admin key most people do not have. Counted here instead, per job.
#
# Dollars per million tokens (input, output), September 2026. A model that is
# not listed is counted in tokens and left out of the money.
CLAUDE_PRICES = {
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-sonnet-5-5": (3.0, 15.0),     # the CLI's own cost figure is used when it reports one
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-opus-4-8": (5.0, 25.0),
}
CLAUDE_SPEND = {"in": 0, "out": 0, "usd": 0.0, "calls": 0, "models": {}}
_SPEND_LOCK = threading.Lock()


def _count_tokens(model: str, tin: int, tout: int, usd: float = None) -> None:
    """`usd`: the provider's own figure (the Claude Code CLI reports one) — used instead of the table.
    On a subscription it is the API-equivalent value, not money spent."""
    with _SPEND_LOCK:
        CLAUDE_SPEND["in"] += tin
        CLAUDE_SPEND["out"] += tout
        CLAUDE_SPEND["calls"] += 1
        m = CLAUDE_SPEND["models"].setdefault(model, {"in": 0, "out": 0})
        m["in"] += tin
        m["out"] += tout
        price = CLAUDE_PRICES.get(model)
        if usd is not None:
            CLAUDE_SPEND["usd"] += float(usd)
        elif price:
            CLAUDE_SPEND["usd"] += tin / 1e6 * price[0] + tout / 1e6 * price[1]


def claude_spend_line() -> str:
    """One line for the log: what Claude was asked for and what it came to."""
    sp = CLAUDE_SPEND
    if not sp["calls"]:
        return ""
    def n(v):
        return f"{v / 1000:.0f}k" if v >= 10000 else f"{v:,}"
    who = ", ".join(f"{m} {n(v['in'])} in / {n(v['out'])} out"
                    for m, v in sorted(sp["models"].items()))
    unpriced = [m for m in sp["models"] if m not in CLAUDE_PRICES]
    tail = f" (no price known for {', '.join(unpriced)})" if unpriced else ""
    return (f"Claude: {sp['calls']} calls, {n(sp['in'])} in / {n(sp['out'])} out "
            f"= ${sp['usd']:.4f} — {who}{tail}")


def _read_sse_text(resp) -> str:
    """Collect the text deltas from an Anthropic streaming response.

    Only `text_delta` is kept — thinking deltas and the bookkeeping events are
    ignored. A mid-stream `error` event is raised so it is retried like any other
    failure instead of silently returning a truncated script.
    """
    out = []
    model, tin, tout = "", 0, 0
    for raw in resp.iter_lines(decode_unicode=True):
        if not raw or not raw.startswith("data:"):
            continue
        chunk = raw[5:].strip()
        if not chunk or chunk == "[DONE]":
            continue
        try:
            ev = json.loads(chunk)
        except ValueError:
            continue
        t = ev.get("type")
        if t == "content_block_delta":
            d = ev.get("delta") or {}
            if d.get("type") == "text_delta":
                out.append(d.get("text", ""))
        elif t == "message_start":
            msg = ev.get("message") or {}
            model = msg.get("model") or ""
            u = msg.get("usage") or {}
            # cache reads are billed at a tenth, cache writes at 1.25x; counted
            # as plain input, which is close enough and never under-reports
            tin = (u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0) \
                + (u.get("cache_read_input_tokens") or 0)
        elif t == "message_delta":
            tout = (ev.get("usage") or {}).get("output_tokens") or tout
        elif t == "error":
            raise _ClaudeError(f"stream error: {str(ev.get('error'))[:150]}")
    if model or tin or tout:
        _count_tokens(model or "unknown", tin, tout)
    return "".join(out).strip()



def _claude_endpoint(provider: str):
    """(url, headers) for a provider, or None if its API key is missing."""
    if provider == "codex":
        # A binary is enough to expose the provider to routing/readiness. The
        # first request is what validates the saved ChatGPT subscription login.
        return ("codex", {}) if codex_cli.resolve_executable() else None
    if provider == "claudecode":
        # Not an HTTP endpoint — it shells out to the CLI. A non-None value is
        # what makes it usable as a fallback in claude().
        return ("cli", {}) if shutil.which("claude") else None
    if provider == "kie":
        if not KIE_API_KEY:
            return None
        return ("https://api.kie.ai/claude/v1/messages",
                {"Authorization": f"Bearer {KIE_API_KEY}", "Content-Type": "application/json",
                 "anthropic-version": "2023-06-01"})
    if provider == "anthropic":
        if not ANTHROPIC_API_KEY:
            return None
        return ("https://api.anthropic.com/v1/messages",
                {"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    return None


class _ClaudeError(RuntimeError):
    pass


def _codex_selected() -> bool:
    return "codex" in (CLAUDE_PROVIDER, SCRIPT_PROVIDER)


# Where the "claudecode" provider runs. A neutral directory keeps the project's
# own CLAUDE.md, hooks and plugins out of a text-generation call.
# The folder the CLI runs in: a private one of this user's (it exists on Windows too, where there is no /tmp)
CC_CWD = Path(os.environ.get("CC_CWD") or (Path(tempfile.gettempdir()) / "movefast-claude"))
try:
    CC_CWD.mkdir(parents=True, exist_ok=True)
except OSError:
    CC_CWD = Path(tempfile.gettempdir())
CC_MODEL = os.environ.get("CC_MODEL", "sonnet")
CC_TIMEOUT = int(os.environ.get("CC_TIMEOUT", "900"))
# The CLI's default persona is a coding assistant; these prompts want prose, and
# nothing else — no preamble, no fences, no offers to help.
CC_SYSTEM = (
    "You are a professional writer. Return ONLY what the user's message asks for. "
    "No preamble, no commentary, no markdown fences, no questions, no offers of "
    "further help. Produce the full requested output in one reply."
)


_CC_EXE: list = []


def _claude_exe() -> str:
    """Absolute path to the `claude` binary, resolved once and remembered.

    A bare shutil.which() came back empty for one call mid-run — most likely the
    CLI replacing its own binary during a self-update — and because a provider
    that fails once is skipped for the rest of the job, that single blip sent
    everything to the (empty) Anthropic account and killed the video.
    """
    if _CC_EXE:
        return _CC_EXE[0]
    found = shutil.which("claude")
    if not found:
        for cand in (os.path.expandvars(r"%USERPROFILE%\.local\bin\claude.exe"),
                     os.path.expandvars(r"%APPDATA%\npm\claude.cmd"),
                     "/opt/homebrew/bin/claude", "/usr/local/bin/claude",
                     str(Path.home() / ".local/bin/claude")):
            if os.access(cand, os.X_OK):
                found = cand
                break
    if not found:
        raise _ClaudeError("claudecode: the `claude` command is not on your PATH")
    _CC_EXE.append(found)
    return found


# Thinking effort for the CLI. Planning-sized asks (director drafts and review, scripts, scene designs) need
# judgement; the many small extraction/JSON/vision asks do not. Sonnet at "low" drops the reason/brief fields
# the director review requires, so anything asking for CC_EFFORT_SPLIT tokens or more gets the larger effort.
CC_EFFORT_SMALL = os.environ.get("CC_EFFORT_SMALL", "low")
CC_EFFORT_LARGE = os.environ.get("CC_EFFORT_LARGE", "medium")
CC_EFFORT_SPLIT = int(os.environ.get("CC_EFFORT_SPLIT", "4000"))


def _cc_effort(max_tokens: int) -> str:
    return CC_EFFORT_LARGE if (max_tokens or 0) >= CC_EFFORT_SPLIT else CC_EFFORT_SMALL


CLAUDE_CALLS: dict = {}     # what each kind of call cost this run: {first words of the prompt: [calls, in, out]}


def _cc_result(model: str, stdout: str, prompt: str = "") -> tuple:
    """(ok, text) from `--output-format json`; the call's usage goes into CLAUDE_SPEND and CLAUDE_CALLS."""
    try:
        d = json.loads(stdout[stdout.find("{"):])
    except ValueError:
        return bool(stdout.strip()), stdout.strip()
    u = d.get("usage") or {}
    tin = sum(int(u.get(k) or 0) for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    tout = int(u.get("output_tokens") or 0)
    _count_tokens(model, tin, tout, d.get("total_cost_usd"))
    label = " ".join(re.sub(r"\s+", " ", re.sub(r"^First read these image files[^\n]*\n(- [^\n]*\n)*\n?", "[vision] ",
                                                   prompt or "")).split()[:7])[:60] or "?"
    with _SPEND_LOCK:
        row = CLAUDE_CALLS.setdefault(label, [0, 0, 0])
        row[0] += 1; row[1] += tin; row[2] += tout
    return not d.get("is_error"), str(d.get("result") or "").strip()


def claude_calls_report(top: int = 8) -> str:
    """The kinds of Claude call that used the most tokens this run, biggest first."""
    rows = sorted(CLAUDE_CALLS.items(), key=lambda kv: -(kv[1][1] + 5 * kv[1][2]))[:top]
    return "\n".join(f"    {c:3d}x {i / 1000:6.0f}k in {o / 1000:5.1f}k out  {k}" for k, (c, i, o) in rows)


def _claude_code_try(model: str, prompt: str, max_tokens: int = 0) -> str:
    """Run one prompt through the local Claude Code CLI (`claude -p`).

    This routes generation through whatever credentials Claude Code itself uses
    instead of the API keys, so it shares that quota — including with any
    interactive session running at the same time. Tools are switched off and
    sessions are not persisted: this is a plain prompt-in, text-out call.
    """
    exe = _claude_exe()
    model = model if model.startswith("claude-") else CC_MODEL
    cmd = [exe, "-p",
           "--model", model,
           "--effort", _cc_effort(max_tokens),
           "--tools", "",                    # pure text generation, no tool use
           "--strict-mcp-config",            # and none of the user's MCP servers
           "--output-format", "json",        # the answer plus its usage, counted in CLAUDE_SPEND
           "--no-session-persistence",
           "--disable-slash-commands",
           "--system-prompt", CC_SYSTEM]
    # Retried in-place: the CLI can blip (self-update, a transient auth refresh),
    # and giving up on the first one costs the whole video because the provider
    # is then skipped for the rest of the run.
    last = ""
    attempt = 0
    while attempt < 3:
        try:
            r = subprocess.run(cmd, input=prompt, text=True, capture_output=True,
                               timeout=CC_TIMEOUT, cwd=str(CC_CWD), encoding="utf-8", errors="replace")
        except subprocess.TimeoutExpired:
            raise _ClaudeError(f"claudecode: timed out after {CC_TIMEOUT}s")
        except OSError as e:
            last = str(e)
            attempt += 1
            time.sleep(4 * attempt)
            continue
        ok, out = _cc_result(model, r.stdout or "", prompt)
        if r.returncode == 0 and ok and out:
            return out
        # The CLI reports a usage limit on STDOUT and exits non-zero, so reading
        # only stderr threw the reason away and left a bare "exit 1".
        last = ((r.stderr or "").strip() or out or (r.stdout or "").strip())[:220] \
            or f"exit {r.returncode}, empty output"
        if _is_limit(last):
            _wait_for_claude_reset(last)   # the owner's rule: wait for Claude, never hand the work elsewhere
            continue
        low = last.lower()
        if "authentication" in low or "oauth" in low:
            break                      # not something a retry fixes
        attempt += 1
        time.sleep(4 * attempt)
    raise _ClaudeError(f"claudecode: {last}")


CLAUDE_WAIT_MAX_S = float(os.environ.get("CLAUDE_WAIT_MAX_H", "200")) * 3600   # a weekly limit can be days away


def _is_limit(msg: str) -> bool:
    low = (msg or "").lower()
    return "usage limit" in low or ("limit" in low and ("hit" in low or "reset" in low))


_WAIT_LOCK = threading.Lock()
_RESUMED = {"at": 0.0}


def _wait_for_claude_reset(msg: str) -> None:
    """Sleep until the reset time the CLI states ("You've hit your session limit · resets 2:20am
    (Europe/Helsinki)"), plus two minutes, then let the caller try again. Without a readable time: half an hour,
    then the caller's next try asks again. One thread waits and logs; the others wait on the same lock. Every
    finished step is cached, so nothing done before the pause is redone."""
    with _WAIT_LOCK:
        if time.time() - _RESUMED["at"] < 300:
            return                     # another call just waited out this same limit: try again straight away
        import datetime as _dt
        until = None
        m = re.search(r"resets\s+(?:(\w{3})\s+(\d{1,2}),?\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:\(([^)]+)\))?",
                      msg or "", re.I)
        if m:
            try:
                from zoneinfo import ZoneInfo
                tz = ZoneInfo(m.group(6)) if m.group(6) else None
                now = _dt.datetime.now(tz)
                hour = int(m.group(3)) % 12 + (12 if m.group(5).lower() == "pm" else 0)
                until = now.replace(hour=hour, minute=int(m.group(4) or 0), second=0, microsecond=0)
                if m.group(1) and m.group(2):
                    month = _dt.datetime.strptime(m.group(1)[:3].title(), "%b").month
                    until = until.replace(month=month, day=int(m.group(2)))
                while until <= now:
                    until += _dt.timedelta(days=1)
                wait = (until - now).total_seconds() + 120
            except (ValueError, KeyError, ImportError):
                wait = 1800.0
        else:
            wait = 1800.0
        wait = min(wait, CLAUDE_WAIT_MAX_S)
        when = until.strftime("%H:%M %Z").strip() if until else "in 30 min"
        log(f"⏸ Claude limit reached — waiting until {when} ({wait / 3600:.1f} h), then continuing with Claude")
        time.sleep(wait)
        _RESUMED["at"] = time.time()
        log("▶ Claude limit wait over — continuing")


def _claude_try(provider: str, model: str, prompt: str, max_tokens: int, budget_s: int) -> str:
    """One provider, with patient retry on transient errors up to budget_s.
    Raises _ClaudeError on client error or when the budget runs out."""
    if provider == "codex":
        try:
            return codex_cli.run(prompt, model=model)
        except codex_cli.CodexError as e:
            raise _ClaudeError(str(e)) from e
    if provider == "claudecode":
        return _claude_code_try(model, prompt, max_tokens)
    ep = _claude_endpoint(provider)
    if ep is None:
        raise _ClaudeError(f"{provider}: API key missing")
    url, headers = ep
    # STREAM the response. A 40-minute script is a long generation, and a
    # non-streaming request has to complete inside one read timeout — a 5600-word
    # script blew past 600s and died with ReadTimeout after the model had already
    # done the work. Streaming resets the clock on every chunk, so length stops
    # mattering; the overall budget below still bounds the whole attempt.
    payload = {"model": model, "max_tokens": max_tokens, "stream": True,
               "messages": [{"role": "user", "content": prompt}]}
    # Sonnet 5 and its siblings think by default, and thinking tokens are spent
    # out of max_tokens. On a mid-sized call the model can think through the
    # whole budget and return a `thinking` block with no text after it — which
    # arrives here as "no text in stream" and costs a retry. It is intermittent
    # because the thinking is adaptive, so it looks like the API being flaky.
    # Nothing asked of Claude here needs deliberation: these are extraction and
    # formatting calls. Turning it off makes them deterministic and cheaper.
    # (Never sent to kie, whose proxy has its own idea of the schema.)
    if provider == "anthropic":
        payload["thinking"] = {"type": "disabled"}
    start = time.time()
    deadline = start + budget_s
    attempt = 0
    last = ""
    while True:
        attempt += 1
        try:
            resp = requests.post(url, headers=headers, json=payload,
                                 stream=True, timeout=(30, 180))
            if resp.status_code == 200:
                text = _read_sse_text(resp)
                if text:
                    return text
                last = "no text in stream"
            else:
                body = resp.text[:150]
                last = f"HTTP {resp.status_code}: {body}"
                # Some models refuse to have thinking switched off (Fable rejects
                # it outright). Drop the field and go again rather than failing:
                # the budget problem above is the lesser risk of the two.
                if resp.status_code == 400 and "thinking" in body.lower() \
                        and payload.pop("thinking", None) is not None:
                    log(f"{model} will not disable thinking — asking again without it")
                    continue
                if resp.status_code < 500 and resp.status_code != 429:
                    raise _ClaudeError(f"{provider} {last}")  # real client error — don't retry
        except requests.exceptions.RequestException as e:
            last = f"network: {e.__class__.__name__}"
        if time.time() >= deadline:
            raise _ClaudeError(f"{provider} po {int(time.time()-start)}s: {last}")
        wait = min(90, 12 * attempt)
        log(f"{provider} unavailable — retrying in {wait}s (elapsed {int(time.time()-start)}s) — {last[:80]}")
        time.sleep(wait)


def claude(prompt: str, model: str, max_tokens: int = 16000, provider: str = None) -> str:
    """Call a Claude provider; on failure, fall back to the other one so a single
    outage never kills a job. Default primary is kie (cheap); pass provider=
    "anthropic" for long generations kie truncates (outline/script)."""
    primary = (provider or CLAUDE_PROVIDER).lower()
    if primary == "codex":
        # Codex is subscription-only by design. Do not let the legacy default
        # CLAUDE_FALLBACK send a failed ChatGPT request to Anthropic or kie.
        try:
            return _claude_try(primary, model, prompt, max_tokens, CLAUDE_RETRY_SECONDS)
        except _ClaudeError as e:
            if provider is not None:
                raise
            sys.exit(f"Codex error: {e}")
    # A provider that already died this run will almost certainly die again, and
    # every retry costs the full budget. Remember it and go straight to fallback.
    if not provider and primary in _DEAD_PROVIDERS:
        fb0 = CLAUDE_FALLBACK
        if fb0 and fb0 != primary and _claude_endpoint(fb0) is not None:
            return _claude_try(fb0, model, prompt, max_tokens, CLAUDE_RETRY_SECONDS)
    # An EXPLICIT provider means "use only this one, no fallback" — used for scripts,
    # where kie is useless (it truncates long output) so falling back to it would just
    # waste time producing a short script the legit-check rejects anyway.
    if provider:
        if primary != "claudecode":
            return _claude_try(primary, model, prompt, max_tokens, CLAUDE_RETRY_SECONDS)
        # The CLI is the one provider that can fail for a reason retrying cannot
        # fix (not signed in), so it is allowed to hand off even when explicit.
        try:
            return _claude_try(primary, model, prompt, max_tokens, CLAUDE_RETRY_SECONDS)
        except _ClaudeError as e:
            fb1 = CLAUDE_FALLBACK if CLAUDE_FALLBACK != "claudecode" else "anthropic"
            if _claude_endpoint(fb1) is None:
                sys.exit(f"Claude API error: {e}")
            log(f"⚠ claudecode failed ({str(e)[:110]}) — switching to {fb1}")
            return _claude_try(fb1, model, prompt, max_tokens, CLAUDE_RETRY_SECONDS)
    # Fallback is whichever provider isn't primary.
    fb = CLAUDE_FALLBACK
    have_fb = fb and fb != primary and _claude_endpoint(fb) is not None
    # Fight the primary for a shorter window if we have a fallback ready; otherwise
    # be fully patient on the primary.
    primary_budget = CLAUDE_PRIMARY_BUDGET if have_fb else CLAUDE_RETRY_SECONDS
    try:
        return _claude_try(primary, model, prompt, max_tokens, primary_budget)
    except _ClaudeError as e:
        if not have_fb:
            sys.exit(f"Claude API error: {e}")
        _DEAD_PROVIDERS.add(primary)      # skip it for the rest of this run
        log(f"⚠ {primary} failed ({str(e)[:100]}) — falling back to {fb} "
            f"(skipping {primary} for the rest of this run)")
    try:
        return _claude_try(fb, model, prompt, max_tokens, CLAUDE_RETRY_SECONDS)
    except _ClaudeError as e2:
        sys.exit(f"Claude API error — i fallback {fb} selhal: {e2}")


def claude_research(prompt: str, model: str = None) -> str:
    """Research through the selected provider, requiring live-search evidence."""
    model = model or SCRIPT_MODEL
    if _codex_selected():
        try:
            return codex_cli.run(prompt, model=model, web_search=True)
        except codex_cli.CodexError as e:
            # No memory/plain-text or Anthropic fallback for a Codex research
            # request: an answer without a native search event is not evidence.
            raise _ClaudeError(str(e)) from e
    last = ""
    if "claudecode" in (CLAUDE_PROVIDER, SCRIPT_PROVIDER):
        try:
            # only the two web tools, nothing else approved, none of the user's MCP servers: what a web page says
            # can never reach anything but the answer
            cmd = [_claude_exe(), "-p", "--model", (model if model.startswith("claude-") else CC_MODEL),
                   "--effort", CC_EFFORT_LARGE,
                   "--tools", "WebSearch,WebFetch", "--allowedTools", "WebSearch,WebFetch",
                   "--permission-mode", "dontAsk", "--strict-mcp-config",
                   "--output-format", "text", "--no-session-persistence", "--disable-slash-commands",
                   "--system-prompt", CC_SYSTEM]
            while True:
                r = subprocess.run(cmd, input=prompt, text=True, capture_output=True, timeout=CC_TIMEOUT,
                                   cwd=str(CC_CWD), encoding="utf-8", errors="replace")
                if r.returncode == 0 and (r.stdout or "").strip():
                    return r.stdout.strip()
                last = ((r.stderr or "") or (r.stdout or "")).strip()[:160]
                if not _is_limit(last):
                    break
                _wait_for_claude_reset(last)       # wait for Claude, never another provider
        except (_ClaudeError, subprocess.TimeoutExpired, OSError) as e:
            last = str(e)[:160]
    ep = _claude_endpoint("anthropic")
    if ep is not None:
        url, headers = ep
        payload = {"model": model if model.startswith("claude-") else SCRIPT_MODEL, "max_tokens": 12000,
                   "thinking": {"type": "disabled"}, "messages": [{"role": "user", "content": prompt}],
                   "tools": [{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}]}
        try:
            for _turn in range(4):
                r = requests.post(url, headers=headers, timeout=(30, 900), json=payload)
                if r.status_code == 400 and "thinking" in r.text.lower() and payload.pop("thinking", None) is not None:
                    continue
                if not r.ok:
                    last = f"HTTP {r.status_code}: {r.text[:120]}"
                    break
                j = r.json()
                if j.get("stop_reason") == "pause_turn":          # a long search turn: let it carry on
                    payload["messages"] = [payload["messages"][0], {"role": "assistant", "content": j.get("content") or []}]
                    continue
                text = "".join(b_.get("text", "") for b_ in (j.get("content") or []) if b_.get("type") == "text")
                if j.get("stop_reason") == "max_tokens" or not text.strip():
                    last = f"answer cut short ({j.get('stop_reason')})"
                    break
                return text.strip()
        except requests.exceptions.RequestException as e:
            last = str(e)[:160]
    # no web route answered: the part stays unchecked — facts from memory are exactly what this check is against
    raise _ClaudeError(f"no Claude that can search the web answered ({last[:120] or 'no Claude Code, no ANTHROPIC_API_KEY'})")


def _factchecked(job: Path, script: str, style: str, title: str, force: bool = False) -> str:
    """The script after factcheck.py — only while no voice exists for it (a recorded or half-recorded voice keeps
    the words it was recorded from; "Redo everything" records it again, so it is checked then too). The chapter/clip
    version of the script gets the same fixes."""
    voiced = ((job / "audio.mp3").exists() or any(job.glob("audio_p*.mp3"))
              or any(any(d.glob("*.mp3")) for d in (job / "parts", job / "_chunks_audio") if d.is_dir()))
    if (voiced and not force) or not (HERE / "factcheck.py").exists():
        return script
    try:
        import factcheck
        fixed = factcheck.check(sys.modules[__name__], job, script, style, title)
    except (Exception, SystemExit) as e:                    # noqa: BLE001 - a check is never worth the video
        log(f"fact check: skipped — {type(e).__name__}: {str(e)[:160]}")
        return script
    if fixed != script:
        (job / "script.txt").write_text(fixed, encoding="utf-8")
        marked = job / "script.chapters.txt"
        if marked.exists():
            try:
                rep = json.loads((job / "factcheck.json").read_text(encoding="utf-8"))
                t = marked.read_text(encoding="utf-8")
                for a_ in rep.get("applied") or []:
                    if a_.get("quote") and a_["quote"] in t:
                        t = t.replace(a_["quote"], a_.get("fix") or "", 1)
                marked.write_text(t, encoding="utf-8")
            except (OSError, ValueError):
                pass
    return fixed


def _claude_code_vision(prompt: str, image_paths: list, max_tokens: int = 0) -> str:
    """Vision through the CLI: it opens the pictures itself with the Read tool.

    The HTTP vision route is Anthropic-only, so a thumbnail could not be
    designed at all when that key had no credit. Claude Code can read local
    images, so the paths are handed over and only Read is switched on — the
    permission bypass therefore cannot reach beyond opening those files.
    """
    exe = _claude_exe()
    paths = [str(Path(x).resolve()) for x in list(image_paths)[:10]]
    dirs = sorted({str(Path(x).parent) for x in paths})
    listing = "\n".join(f"- {x}" for x in paths)
    full = (f"First read these image files so you can actually see them:\n{listing}\n\n"
            f"{prompt}")
    cmd = [exe, "-p", "--model", CC_MODEL, "--effort", _cc_effort(max_tokens),
           "--tools", "Read", "--allowedTools", "Read",
           "--permission-mode", "dontAsk", "--strict-mcp-config",
           "--output-format", "json", "--no-session-persistence",
           "--disable-slash-commands", "--system-prompt", CC_SYSTEM]
    for d in dirs:
        cmd += ["--add-dir", d]
    while True:
        try:
            r = subprocess.run(cmd, input=full, text=True, capture_output=True,
                               timeout=CC_TIMEOUT, cwd=str(CC_CWD), encoding="utf-8", errors="replace")
        except subprocess.TimeoutExpired:
            raise _ClaudeError(f"claudecode vision: timed out after {CC_TIMEOUT}s")
        except OSError as e:
            raise _ClaudeError(f"claudecode vision: {e}")
        ok, out = _cc_result(CC_MODEL, r.stdout or "", full)
        if r.returncode == 0 and ok and out:
            return out
        why = ((r.stderr or "").strip() or out)[:200] or f"exit {r.returncode}, empty output"
        if _is_limit(why):
            _wait_for_claude_reset(why)          # wait for Claude, never another provider
            continue
        raise _ClaudeError(f"claudecode vision: {why}")


PICK_MODEL = os.environ.get("GEMINI_PICK_MODEL", "gemini-3.5-flash-lite")
# every Gemini look this run: answers, tokens in / out / thinking (billed as output), and per purpose and model
# (owner 2026-10-10: 548 calls and 4.3M tokens a film, unpriced, thinking never counted)
GEMINI_PICKS = {"calls": 0, "in": 0, "out": 0, "think": 0, "fallback": 0, "by": {}}
# $ per million tokens in, out (thinking is billed as output) on the standard tier - ai.google.dev/gemini-api/docs/pricing,
# read 2026-10-11. gemini-3.8-flash: these prices hold "through December 31, 2026"; from January 1, 2027 every 3.8 price
# doubles ($1.50 / $7.50, cached $0.15, storage $1.00)
GEMINI_PRICES = {"gemini-3.8-flash": (0.75, 3.75), "gemini-3.5-flash-lite": (0.30, 2.50),
                 "gemini-3-flash-preview": (0.50, 3.00)}
# a cached input token (usageMetadata.cachedContentTokenCount, part of the prompt's count): $ per million on the
# standard tier and on Flex - a tenth of the input price, except where the page lists its own (Flash-Lite on Flex 0.02;
# 3 Flash Preview keeps 0.05 on Flex); unlisted: GEMINI_CACHED_SHARE of the input price on the call's tier
GEMINI_CACHED_PRICES = {"gemini-3.8-flash": (0.075, 0.0375), "gemini-3.5-flash-lite": (0.03, 0.02),
                        "gemini-3-flash-preview": (0.05, 0.05)}
# the Flex tier (serviceTier "flex", docs/flex-inference): half the input and output price
GEMINI_CACHED_SHARE, GEMINI_FLEX_SHARE = 0.10, 0.50
GEMINI_CACHE_STORAGE = {"gemini-3.8-flash": 0.50}            # $ per million cached tokens an hour (1.00 if not listed)
# Flex (Preview, best effort, "Minutes (1-15 min target)"; 503 at capacity, 429 on limits; no server-side fallback to
# the standard tier - the client retries with backoff and falls back itself): one Flex request may wait up to
# GEMINI_FLEX_TIMEOUT (the docs ask for 10 minutes or more); a call spends at most GEMINI_FLEX_WAIT seconds on Flex,
# retries included (a caller may pass its own: Mr Truth's MRTRUTH_JUDGE_FLEX_WAIT), then asks the standard tier.
# After GEMINI_FLEX_BREAK fallbacks in a row Flex rests GEMINI_FLEX_REST seconds (calls go straight to the standard
# tier, counted), so a Flex at capacity costs a film minutes, not hours
GEMINI_FLEX_TIMEOUT = 900
try:
    GEMINI_FLEX_WAIT = float(os.environ.get("GEMINI_FLEX_WAIT") or 300)
except ValueError:
    GEMINI_FLEX_WAIT = 300.0
GEMINI_FLEX_BREAK, GEMINI_FLEX_REST = 5, 600.0
GEMINI_FLEX_BACKOFF = (5, 10, 20, 40, 80, 160)
_FLEX_STATE = {"run": 0, "rest_until": 0.0}


def gemini_cost(model: str, tin: int, tout: int, think: int = 0, cached: int = 0, flex: bool = False):
    """What one Gemini call (or a sum of them) costs in dollars, or None when the model has no known price: input
    (its cached part at GEMINI_CACHED_PRICES), output and thinking - on the Flex tier at its own prices (half, and the
    cached price the page lists for Flex)."""
    price = GEMINI_PRICES.get(model)
    if not price:
        return None
    share = GEMINI_FLEX_SHARE if flex else 1.0
    cached = min(max(0, int(cached or 0)), int(tin or 0))
    cp = GEMINI_CACHED_PRICES.get(model)
    cprice = (cp[1] if flex else cp[0]) if cp else price[0] * share * GEMINI_CACHED_SHARE
    return ((int(tin or 0) - cached) * price[0] * share + cached * cprice
            + (int(tout or 0) + int(think or 0)) * price[1] * share) / 1e6


def _flex_note(fell: str = "", ok: bool = False, waited: float = 0.0) -> None:
    """The run's Flex record: a call answered on Flex (ok) ends a run of fallbacks; a fallback (`fell`: why) counts,
    and the GEMINI_FLEX_BREAK-th in a row rests Flex for GEMINI_FLEX_REST seconds."""
    with _SPEND_LOCK:
        GEMINI_PICKS["flex_wait_s"] = GEMINI_PICKS.get("flex_wait_s", 0.0) + waited
        if ok:
            _FLEX_STATE["run"] = 0
        if fell:
            GEMINI_PICKS["flex_fallback"] = GEMINI_PICKS.get("flex_fallback", 0) + 1
            w = GEMINI_PICKS.setdefault("flex_why", {})
            w[fell] = w.get(fell, 0) + 1
            _FLEX_STATE["run"] += 1
            if _FLEX_STATE["run"] >= GEMINI_FLEX_BREAK:
                _FLEX_STATE["run"], _FLEX_STATE["rest_until"] = 0, time.time() + GEMINI_FLEX_REST
                GEMINI_PICKS["flex_rests"] = GEMINI_PICKS.get("flex_rests", 0) + 1


def _flex_open() -> bool:
    """Whether Flex may be asked now (not resting after a run of fallbacks); a call it is not asked for is counted."""
    with _SPEND_LOCK:
        if time.time() >= _FLEX_STATE["rest_until"]:
            return True
        GEMINI_PICKS["flex_rested"] = GEMINI_PICKS.get("flex_rested", 0) + 1
        return False


def gemini_cache(model: str, text: str, ttl_s: int = 3600) -> str:
    """A Gemini cache (cachedContents) holding `text` as the start of a request - a user turn - for `ttl_s` seconds:
    its name, or "" when Gemini will not keep it (the caller then sends the text itself). Counted in the run's spend
    as "check cache": its tokens once at the input price and their storage for the whole ttl (2026-10-11: the checks'
    1,425-token head on 3.8 Flash, about $0.0011 + $0.0014 for two hours)."""
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key or not text:
        return ""
    try:
        r = requests.post("https://generativelanguage.googleapis.com/v1beta/cachedContents",
                          headers={"x-goog-api-key": key}, timeout=60,
                          json={"model": f"models/{model}", "contents": [{"role": "user", "parts": [{"text": text}]}],
                                "ttl": f"{int(ttl_s)}s"})
        if not r.ok:
            return ""
        d = r.json()
    except (requests.RequestException, ValueError):
        return ""
    n = int((d.get("usageMetadata") or {}).get("totalTokenCount") or 0)
    price = GEMINI_PRICES.get(model)
    usd = (n * price[0] + n * ttl_s / 3600 * GEMINI_CACHE_STORAGE.get(model, 1.0)) / 1e6 if price else 0.0
    with _SPEND_LOCK:
        b = GEMINI_PICKS["by"].setdefault(f"check cache | {model}", {"what": "check cache", "model": model, "calls": 0,
                                                                     "in": 0, "out": 0, "think": 0})
        b["calls"] += 1
        b["in"] += n
        b["usd"] = b.get("usd", 0.0) + usd
    return str(d.get("name") or "")


def gemini_cache_drop(name: str) -> None:
    """Delete a cache made by gemini_cache (its storage is billed by the hour); a failure is left to its ttl."""
    key = os.environ.get("GEMINI_API_KEY", "")
    if key and name:
        try:
            requests.delete(f"https://generativelanguage.googleapis.com/v1beta/{name}", headers={"x-goog-api-key": key},
                            timeout=30)
        except requests.RequestException:
            pass


def gemini_bucket_usd(v: dict):
    """A spend bucket's dollars: what its calls were billed (pick_vision adds each call's own price - its cached
    tokens and tier), else priced from its token sums as before; None when the model has no known price."""
    if "usd" in v:
        return float(v["usd"]) if GEMINI_PRICES.get(v.get("model")) else None
    return gemini_cost(v.get("model"), v.get("in", 0), v.get("out", 0), v.get("think", 0))


def gemini_spend_line() -> str:
    """One line for the log: the Gemini looks of this run, what they came to, and what they were for (with the
    tokens Gemini served from its cache, and the calls on the Flex tier, when there were any)."""
    g = GEMINI_PICKS
    if not (g["calls"] or g["fallback"]):
        return ""
    k = lambda v: f"{v / 1000:.0f}k"
    usd, unpriced, parts = 0.0, set(), []
    for v in sorted(g["by"].values(), key=lambda v: -v["in"]):
        cost = gemini_bucket_usd(v)
        usd += cost or 0.0
        if cost is None:
            unpriced.add(v["model"])
        extra = (f", {k(v['cached'])} of it cached" if v.get("cached") else "") + (
            f", {v['flex']} on Flex" if v.get("flex") else "")
        parts.append(f"{v['what']} ({v['model']}) {v['calls']} calls, {k(v['in'])} in{extra} / {k(v['out'])} out / "
                     f"{k(v['think'])} thinking" + (f" = ${cost:.2f}" if cost is not None else ""))
    return (f"Gemini photo picks: {g['calls']} ({k(g['in'])} in, {k(g['out'])} out, {k(g['think'])} thinking"
            f" = ${usd:.2f}), {g['fallback']} handed to Claude — " + "; ".join(parts)
            + (f" (no price known for {', '.join(sorted(unpriced))})" if unpriced else "") + flex_line())


def flex_line() -> str:
    """The run's Flex record for the log ("" when Flex was never asked): calls Flex answered, the ones that fell back to
    the standard tier (and why), retries on Flex, calls sent straight to the standard tier while Flex rested, and the
    time spent waiting on Flex - every fallback is billed at the standard price."""
    g = GEMINI_PICKS
    on = sum(int(v.get("flex") or 0) for v in g["by"].values())
    fell, rested = int(g.get("flex_fallback") or 0), int(g.get("flex_rested") or 0)
    if not (on or fell or rested):
        return ""
    why = ", ".join(f"{n}x {w}" for w, n in sorted((g.get("flex_why") or {}).items(), key=lambda kv: -kv[1])[:4])
    return (f"; Flex: {on} answered there, {fell} fell back to the standard tier" + (f" ({why})" if why else "")
            + f", {int(g.get('flex_retries') or 0)} retries, {rested} sent to the standard tier while Flex rested "
            f"({int(g.get('flex_rests') or 0)} rests), {float(g.get('flex_wait_s') or 0) / 60:.1f} min waited on Flex")


def pick_vision(prompt: str, image_paths: list, max_tokens: int = 800, model: str = "", thinking: str = "",
                purpose: str = "", media: str = "", lead: str = "", labels: list = None, info: dict = None,
                tier: str = "", cache: tuple = None, tier_wait: float = None) -> str:
    """Look at photos and pick (which candidate shows the subject, which cutout is clean, which still shows a person
    or vehicle) — through Gemini Flash-Lite. Tested on the same 8 candidates: Gemini chose the same two photos
    as Claude with the same crops, in 2 s against 9 s, for about $0.001, sparing ~10k Claude tokens a pick
    (photo picks were over half of a test run's Claude use). Any Gemini failure: Claude looks instead.
    `purpose` names the look in the run's Gemini count (gemini_spend_line).
    Mr Truth's picture checks (owner 2026-10-10) also pass:
      media   "LOW" | "MEDIUM" | "HIGH": what each picture costs in tokens (generationConfig.mediaResolution)
      lead, labels   the request in reading order: `lead` first, then each picture after its own label (its caption),
              then `prompt` - every picture is sent (the plain layout keeps its first 16)
      info    filled with who answered: via "gemini" | "claude", the model and the tokens (in, out, thinking), the
              tokens Gemini served from its cache (cached) and the tier that answered (tier) - a Claude answer is used
              for the run, never kept as Gemini's.
      tier    "flex": the Flex tier (2026-10-11: half price, the same model, an answer in minutes, best effort): a
              request Flex sheds (429, 5xx, a time-out) is asked again on Flex after a backoff (GEMINI_FLEX_BACKOFF)
              while the call has spent less than `tier_wait` seconds there (GEMINI_FLEX_WAIT unless given), then on
              the standard tier, which waits as usual; a 400 (the model or request refuses the tier) goes to the
              standard tier at once. Every fallback is counted (GEMINI_PICKS flex_fallback, flex_why), and a run of
              GEMINI_FLEX_BREAK fallbacks rests Flex for GEMINI_FLEX_REST seconds (flex_rested: calls not tried there).
      cache   (name, head): the request starts with `head`, held in the Gemini cache `name` (gemini_cache) - it is
              named, not sent, and `lead` is what follows it; a cache Gemini no longer has (HTTP 400/403/404) is
              dropped and the head sent in front of the lead, as one text."""
    info = info if info is not None else {}
    info.update(via="", model="", tokens=(0, 0, 0), cached=0, tier="")
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        try:
            import base64
            img = lambda p: {"inlineData": {"mimeType": "image/jpeg" if str(p).lower().endswith((".jpg", ".jpeg"))
                                            else "image/png", "data": base64.b64encode(Path(p).read_bytes()).decode()}}
            parts = []
            if labels is not None:              # text first, each picture after its own label, the question last
                parts += [{"text": lead}] if lead or cache else []
                for i, p in enumerate(image_paths):
                    parts += [{"text": str(labels[i]) if i < len(labels) else f"Picture {i + 1}:"}, img(p)]
            else:
                for i, p in enumerate(list(image_paths)[:16]):
                    parts += [{"text": f"Image {i + 1}:"}, img(p)]
            use = model or PICK_MODEL          # a caller may ask for a stronger judge (Mr Truth's picture judge)
            think = ({"thinkingLevel": thinking or "minimal"} if not use.startswith("gemini-2.")
                     else {"thinkingBudget": 0 if not thinking else 1024})
            body = {"contents": [{"parts": parts + [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": max(256, max_tokens), "thinkingConfig": think}}
            if media:
                body["generationConfig"]["mediaResolution"] = f"MEDIA_RESOLUTION_{media.upper()}"
            flex_wait = GEMINI_FLEX_WAIT if tier_wait is None else float(tier_wait)
            if tier == "flex" and _flex_open():           # any other tier: the standard one (the field left out)
                body["serviceTier"] = "flex"
            if cache and labels is not None:
                body["cachedContent"] = cache[0]
            # busy (429/5xx) or no connection: wait and ask again before Claude looks instead. Mr Truth's checks
            # (labels) wait longer: on 2026-10-11 a short Gemini spell sent 10 checks to Claude in a minute and the
            # guard stopped the film 9 minutes in, though Gemini answered again right after
            ladder = list((2, 5, 10, 20, 40, 60, 0) if labels is not None else (2, 5, 10, 20, 0))
            flex_backoff = list(GEMINI_FLEX_BACKOFF)
            r, why, t_flex = None, "", time.time()
            while True:
                flex = body.get("serviceTier") == "flex"
                left = t_flex + flex_wait - time.time()
                try:
                    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{use}:generateContent",
                                      headers={"x-goog-api-key": key}, json=body,
                                      timeout=max(30.0, min(GEMINI_FLEX_TIMEOUT, left)) if flex else 180)
                    why = f"HTTP {r.status_code}"
                    if body.get("cachedContent") and r.status_code in (400, 403, 404):
                        body.pop("cachedContent")        # the cache is gone: the head goes back in front of the lead
                        body["contents"][0]["parts"][0]["text"] = cache[1] + lead
                        with _SPEND_LOCK:
                            GEMINI_PICKS["cache_lost"] = GEMINI_PICKS.get("cache_lost", 0) + 1
                        continue
                    busy = r.status_code in (429, 500, 502, 503, 504)
                except requests.RequestException as e:            # timeout, reset: busy too
                    r, why, busy = None, type(e).__name__, True
                if flex:
                    if r is not None and r.ok:
                        _flex_note(ok=True, waited=time.time() - t_flex)
                        break
                    if busy and flex_backoff and time.time() + flex_backoff[0] < t_flex + flex_wait:
                        with _SPEND_LOCK:                # Flex at capacity: again on Flex after a backoff
                            GEMINI_PICKS["flex_retries"] = GEMINI_PICKS.get("flex_retries", 0) + 1
                        time.sleep(flex_backoff.pop(0))
                        continue
                    if busy or (r is not None and r.status_code == 400):
                        body.pop("serviceTier", None)    # no server-side fallback: the standard tier, at once
                        _flex_note(fell=f"{why} after {time.time() - t_flex:.0f}s" if busy else why,
                                   waited=time.time() - t_flex)
                        continue
                    _flex_note(waited=time.time() - t_flex)
                    break                                # 401/402/403/404: the standard tier would say the same
                if not busy or not ladder or not ladder[0]:
                    break
                with _SPEND_LOCK:
                    GEMINI_PICKS["busy"] = GEMINI_PICKS.get("busy", 0) + 1
                time.sleep(ladder.pop(0))
            if r is not None and r.ok:
                d = r.json()
                text = "".join(x.get("text", "") for x in ((d.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
                               if not x.get("thought")).strip()
                u = d.get("usageMetadata") or {}
                tin, tout, tthink, tcache = (int(u.get(f) or 0) for f in ("promptTokenCount", "candidatesTokenCount",
                                                                           "thoughtsTokenCount", "cachedContentTokenCount"))
                served = str(u.get("serviceTier") or "").lower()
                on_flex = "flex" in served or (bool(body.get("serviceTier")) and not served)
                cost = gemini_cost(use, tin, tout, tthink, tcache, on_flex) or 0.0
                with _SPEND_LOCK:                # an empty answer is billed too: counted with the rest
                    for b in (GEMINI_PICKS, GEMINI_PICKS["by"].setdefault(f"{purpose or 'photo pick'} | {use}", {
                            "what": purpose or "photo pick", "model": use, "calls": 0, "in": 0, "out": 0, "think": 0})):
                        b["calls"] += 1
                        b["in"] += tin
                        b["out"] += tout
                        b["think"] += tthink
                        b["cached"] = b.get("cached", 0) + tcache
                        b["flex"] = b.get("flex", 0) + on_flex
                        b["usd"] = b.get("usd", 0.0) + cost
                if text:
                    info.update(via="gemini", model=use, tokens=(tin, tout, tthink), cached=tcache,
                                tier="flex" if on_flex else "standard",
                                finish=str(((d.get("candidates") or [{}])[0]).get("finishReason") or ""))
                    return text
                why = "empty answer (" + str(((d.get("candidates") or [{}])[0]).get("finishReason")
                                              or (d.get("promptFeedback") or {}).get("blockReason") or "?") + ")"
            elif r is not None:
                info["status"] = r.status_code
        except Exception as e:                                   # noqa: BLE001 - Claude looks instead
            why = why or type(e).__name__
        with _SPEND_LOCK:
            GEMINI_PICKS["fallback"] += 1
            w = GEMINI_PICKS.setdefault("why", {})              # why Gemini gave no answer, for the run's log
            w[why or "?"] = w.get(why or "?", 0) + 1
    if labels is not None:                       # Claude sees the pictures in order, their labels in the text
        image_paths = list(image_paths)[:10]     # claude_vision's own cap: no label for a picture it does not send
        lead = (cache[1] + lead) if cache else lead          # the cached head is Gemini's alone: Claude reads it all
        prompt = "\n".join([lead] + [f"Image {i + 1}: {str(labels[i]) if i < len(labels) else ''}"
                                      for i in range(len(image_paths))] + [prompt])
    info.update(via="claude", model="claude")
    return claude_vision(prompt, image_paths, max_tokens=max_tokens)


def claude_vision(prompt: str, image_paths: list, model: str = SCRIPT_MODEL, max_tokens: int = 2000) -> str:
    """Vision through the selected provider, with up to ten explicit images."""
    if _codex_selected():
        try:
            return codex_cli.run(prompt, model=model, images=list(image_paths)[:10])
        except codex_cli.CodexError as e:
            # Codex failures stay subscription-only; never switch this request
            # to the legacy Anthropic HTTP route.
            raise _ClaudeError(str(e)) from e
    import base64
    import mimetypes
    if CLAUDE_PROVIDER == "claudecode":
        try:
            return _claude_code_vision(prompt, image_paths, max_tokens)
        except _ClaudeError as e:
            if CLAUDE_FALLBACK != "codex":
                log(f"⚠ claudecode vision failed ({str(e)[:90]}) — trying anthropic")
            else:
                # the other subscription, never a paid key
                log(f"⚠ claudecode vision failed ({str(e)[:90]}) — trying codex")
                try:
                    return codex_cli.run(prompt, model=model, images=list(image_paths)[:10])
                except codex_cli.CodexError as e2:
                    raise _ClaudeError(str(e2)) from e2
    ep = _claude_endpoint("anthropic")
    if ep is None:
        raise _ClaudeError("anthropic: API key missing (vision needs Anthropic)")
    url, headers = ep
    content = []
    for p in list(image_paths)[:10]:  # cap request size
        p = Path(p)
        mime = mimetypes.guess_type(str(p))[0] or "image/png"
        if mime not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            mime = "image/png"
        b64 = base64.b64encode(p.read_bytes()).decode()
        content.append({"type": "image", "source": {"type": "base64", "media_type": mime, "data": b64}})
    content.append({"type": "text", "text": prompt})
    payload = {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": content}]}
    resp = requests.post(url, headers=headers, json=payload, timeout=300)
    if resp.status_code != 200:
        raise _ClaudeError(f"anthropic vision HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()


def _extract_json(raw: str):
    """Pull the first JSON array out of a model response (tolerates fences/prose)."""
    m = re.search(r"\[.*\]", raw, re.DOTALL)
    if not m:
        sys.exit(f"Could not parse JSON from model output:\n{raw[:500]}")
    return json.loads(m.group(0))


def _json_items(prompt: str, max_tokens: int) -> list:
    """Get a JSON ARRAY from the utility model, resilient to kie truncating long
    output. kie cuts off long responses (it truncated a 10-image-prompt reply right
    after the model's 'I'll pick 10 lines…' preamble, before the array), so we try
    kie first (cheap) and, if the array won't parse, fall back to Anthropic which
    returns the whole thing."""
    strict = prompt + ("\n\nIMPORTANT: Output ONLY the JSON array. Begin your reply with "
                       "'[' and end with ']'. No preamble, no explanation, no markdown fences.")
    last = ""
    # The primary is tried more than once: a long array (45+ scenes) can come
    # back truncated or wrapped in prose on one attempt and clean on the next,
    # and falling straight through to a provider that may be out of credit
    # turned a retryable hiccup into a dead video.
    codex_only = _codex_selected()
    providers = ("codex", "codex", "codex") if codex_only else (None, None, None, "anthropic")
    for attempt, provider in enumerate(providers):
        try:
            raw = claude(strict, UTILITY_MODEL, max_tokens=max_tokens, provider=provider)
        except _ClaudeError as e:
            last = str(e)[:200]
            continue
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                last = raw[-250:]
        else:
            last = raw[-250:]
        if provider is None:
            log(f"  JSON did not parse (attempt {attempt + 1}/3) — retrying…")
        elif codex_only:
            log(f"  Codex JSON did not parse (attempt {attempt + 1}/3) — retrying…")
        time.sleep(3 * (attempt + 1))
    ending = "after 3 Codex attempts" if codex_only else "after 3 attempts and the fallback"
    sys.exit(f"Could not parse JSON from model output ({ending}):\n{last}")


WPM = 140  # spoken words per minute (for length targeting)

# TRUE-refusal signals — phrases that only appear when the model DECLINES to
# produce the deliverable, never in a real outline/script (even a chatty one that
# opens with a helpful "I can help you… one grounding note" preamble, which is FINE).
_REFUSAL_STRONG = (
    "the script you've pasted", "the \"script\" you", "the 'script' you", "script you've pasted",
    "the srt you", "the srt actually", "the subtitle file isn't", "the subtitle file is",
    "isn't a spoken script", "is not a spoken script", "isn't a script", "it's a refusal",
    "is a refusal", "recording of an assistant", "an assistant declining", "declining to fabricate",
    "won't fabricate", "will not fabricate", "won't invent", "will not invent", "won't wrap",
    "scarcity sales funnel", "fake scarcity", "a sales funnel", "good-faith completion",
    "i can't complete", "i cannot complete", "i won't build", "i will not build", "i won't write",
    "i cannot write this", "i can't write this", "i can't in good conscience", "i can't help you build",
    "i can't do this as", "i can't produce", "i cannot produce", "i'm not able to write",
    "i am not able to write", "i can't create this",
)


def _looks_like_refusal(text: str) -> bool:
    """Detect a TRUE refusal (the model declined to produce the deliverable), so
    we can retry or fail fast. A real outline/script — even one that opens with a
    polite preamble — is NOT flagged; only genuine declines are."""
    t = text.strip().lower()
    if any(m in t[:1500] for m in _REFUSAL_STRONG):
        return True
    # A very short output that opens in first-person meta is a decline.
    return len(t) < 350 and t[:30].startswith(("i can", "i'm ", "i am ", "i won", "i cannot"))


_META_HEAD = ("i can write", "before the full script", "here is the script", "here's the script",
              "on sourcing", "on the version", "two quick", "a couple of", "note:", "sure,",
              "certainly", "absolutely,", "here you go")
_META_TAIL = ("that's the full script", "that is the full script", "want me to", "two things i'd flag",
              "let me know", "if you want the strict", "i'd flag", "before you record",
              "if you enable web search", "want me to verify", "one note", "a note on")


def _clean_script(text: str) -> str:
    """Strip any meta-preamble / trailing notes the model wraps around the actual
    spoken script (e.g. 'Here is the script:' ... '---' ... 'Want me to verify?'),
    so ONLY the spoken words go to the voiceover."""
    t = text.strip()
    # If the model fenced the real script between --- lines, take the largest fenced block.
    parts = re.split(r"(?m)^[ \t]*-{3,}[ \t]*$", t)
    if len(parts) >= 3:
        t = max((p.strip() for p in parts), key=len)
    paras = [p for p in re.split(r"\n\s*\n", t.strip()) if p.strip()]
    while paras and any(paras[0].strip().lower().startswith(p) for p in _META_HEAD):
        paras.pop(0)
    while paras and any(m in paras[-1].strip().lower() for m in _META_TAIL):
        paras.pop()
    return "\n\n".join(paras).strip()


def _previous_titles(style: str, limit: int = 12) -> list:
    """Titles already made in this style, newest first.

    Fed to the outline so a new video does not re-teach ground the channel has
    already covered — without it every script gravitates to the same three or
    four greatest-hits ideas.
    """
    out = []
    if not OUTPUT_ROOT.is_dir():
        return out
    jobs = []
    for d in list_jobs():
        t = d / "title.txt"
        sc = d / "script.txt"
        if not (d.is_dir() and t.exists() and sc.exists()):
            continue
        # Only this narrator's own back catalogue belongs in the list. Mixing in
        # every style diluted it — a script was warned off another channel's
        # titles while its own near-duplicates fell past the limit.
        sf = d / "style.txt"
        if sf.exists():
            try:
                if sf.read_text(encoding="utf-8").strip() != style:
                    continue
            except OSError:
                continue
        elif style and style not in d.name:      # older jobs: guess from the slug
            continue
        try:
            jobs.append((sc.stat().st_mtime, t.read_text(encoding="utf-8").splitlines()[0].strip()))
        except (OSError, IndexError):
            continue
    for _, title in sorted(jobs, reverse=True):
        if title and title not in out:
            out.append(title)
        if len(out) >= limit:
            break
    return out



def _script_craft(style: str) -> tuple:
    """(outline block, script block) — the retention craft (prompts.SCRIPT_CRAFT_*) a channel's own prompts get on
    top. A style pins the framework with "script_craft": "story" or "teaching", or turns it off with "off"."""
    mode = str((STYLE_INFO.get(style) or {}).get("script_craft") or "auto").strip().lower()
    if mode == "off":
        return "", ""
    pin = {"story": "\nThis channel makes STORY videos: use the STORY framework.",
           "teaching": "\nThis channel makes TEACHING videos: use the TEACHING framework."}.get(mode, "")
    return prompts.SCRIPT_CRAFT_OUTLINE + pin, prompts.SCRIPT_CRAFT_SCRIPT


def _script_in_parts(outline: str, minutes: int, target_words: int, wpm: float, style: str, craft_s: str,
                     job: Path, title: str) -> str:
    """A long episode written part by part. In one pass a 30-minute Czech documentary came back at 14 minutes, and even
    in four parts each came back at half its length: the model tells a beat in the words it thinks a beat takes. So
    every part is a few beats (labelled "BEAT n" by the outline), each beat gets its own word budget, the part reads
    everything written before it (nothing recapped or told twice), and a part that still comes back short is sent back
    once or twice to be told at full length. A style turns it on with "script_parts": true."""
    pset = prompts.PROMPT_SETS.get(style) or {}
    labels = [(int(m.group(1)), m.group(0).strip(" *#>_-")) for m in re.finditer(r"(?im)^[\s*#>_\-]*BEAT\s+(\d+)[^\n]*", outline)]
    n_beats = max((n for n, _ in labels), default=0)
    if n_beats >= 6:
        groups = [list(range(a, min(n_beats, a + 3) + 1)) for a in range(1, n_beats + 1, 4)]
        if len(groups) > 1 and len(groups[-1]) < 3:       # a lone closing beat ("the last sentence") rides with the part before
            tail = groups.pop()                           # pop FIRST: "groups[-2] += groups.pop()" overwrites the wrong part
            groups[-1] = groups[-1] + tail
    else:
        n_parts = max(2, math.ceil(target_words / 600))
        groups = [None] * n_parts
    per_beat = target_words / max(1, n_beats) if n_beats >= 6 else 0
    sources = _sources_block(job, title)[:20000]
    head = (_lang_prompt(pset.get("script", ""), style).replace("[INSERT OUTLINE HERE]", outline)
            .replace("[INSERT TARGET LENGTH]", f"{minutes} minutes") + craft_s + _extra_block() + sources)
    written = []
    for k, beats in enumerate(groups):
        first, last = k == 0, k == len(groups) - 1
        if beats:
            want = int(round(per_beat * len(beats)))
            scope = (f"BEAT {beats[0]} to BEAT {beats[-1]} of the plan (it has {n_beats} beats). Each beat is about a "
                     f"minute of narration: write about {int(round(per_beat))} words for EACH beat — two or three full "
                     f"paragraphs with its scene, its facts, its context and its consequence — so this part comes to about "
                     f"{want} words")
        else:
            want = int(round(target_words / len(groups)))
            scope = (f"the stretch of the plan from about {k * 100 // len(groups)}% to {(k + 1) * 100 // len(groups)}% of the "
                     f"way through, about {want} words")
        so_far = "\n\n".join(written)
        ask = (head + f"\n\nTHIS EPISODE IS WRITTEN IN {len(groups)} PARTS. WRITE PART {k + 1} OF {len(groups)}: {scope}. "
               f"(The whole episode is about {target_words} words — {minutes} minutes at ~{wpm:.0f} words a minute.) "
               + ("Begin with the cold open: your first word is the first word of the episode. " if first else
                  "Continue seamlessly from the exact point where the narration so far stops — no recap, no new opening, "
                  "no fact told again. ")
               + ("End with the ending of the episode and its last sentence. " if last else
                  "Stop at the end of these beats, in the middle of the story: no ending, no summary, no call to action. ")
               + "Return only the narration of this part."
               + (f"\n\nTHE NARRATION SO FAR — already written, never repeat any of it:\n{so_far[-24000:]}" if so_far else ""))
        text = None
        for attempt in range(1, 4):
            cand = _clean_script(claude(ask, SCRIPT_BODY_MODEL, max_tokens=9000, provider=SCRIPT_PROVIDER))
            if _looks_like_refusal(cand) or len(cand.split()) < want * 0.3:
                log(f"script: part {k + 1} came back unusable ({len(cand.split())} words, attempt {attempt}/3) — again…")
                continue
            text = cand
            break
        if text is None:
            if not written:
                sys.exit("Claude could not write the opening of the script. Nothing was made — try again.")
            log(f"script: part {k + 1} could not be written — the script ends after part {k}")
            break
        for rnd in range(2):                      # a short part is told again at full length, never padded
            n = len(text.split())
            if n >= want * 0.88:
                break
            grow = (head + f"\n\nTHIS IS PART {k + 1} OF {len(groups)} ({scope}). As written below it is {n} words, but it "
                    f"must be about {want} words to fill its minutes. Rewrite this part at its full length: keep what works, "
                    "and tell each beat completely — the concrete scene, the real facts, dates and numbers from the plan and "
                    "the sources, the context the viewer needs, what it meant and what came of it. No filler, no repetition, "
                    "nothing from other parts, the same voice. Return only the rewritten part."
                    + (f"\n\nTHE NARRATION BEFORE THIS PART (for continuity, do not repeat it):\n{so_far[-12000:]}" if so_far else "")
                    + f"\n\nTHE PART TO REWRITE:\n{text}")
            try:
                longer = _clean_script(claude(grow, SCRIPT_BODY_MODEL, max_tokens=9000, provider=SCRIPT_PROVIDER))
            except _ClaudeError as e:
                log(f"script: part {k + 1} kept at {n} words — {str(e)[:80]}")
                break
            if _looks_like_refusal(longer) or len(longer.split()) <= n:
                break
            text = longer
        written.append(text)
        log(f"script: part {k + 1}/{len(groups)} — {len(text.split())} words (aim {want})")
    return "\n\n".join(written)


def _avoid_words(script: str, style: str) -> str:
    """The words a channel never says (style "script_avoid": word stems such as "zabít", "vražd"), rewritten away:
    every sentence holding one goes back to Claude once and returns with the same meaning in other words — a
    YouTube channel stays monetised on "vzít život", not on "zabil"."""
    stems = [str(s).strip() for s in ((STYLE_INFO.get(style) or {}).get("script_avoid") or []) if str(s).strip()]
    if not stems or not script:
        return script
    pat = re.compile(r"\b(?:" + "|".join(re.escape(_fold(s)) for s in stems) + ")", re.I)
    bad = [s for s in dict.fromkeys(re.split(r"(?<=[.!?…])\s+", script)) if pat.search(_fold(s))]
    if not bad:
        return script
    ask = _lang_prompt(
        "Rewrite every numbered sentence below so it keeps exactly its meaning, facts and tone but uses none of these "
        "words in any form: " + ", ".join(stems) + ". Tell death and violence factually and without gore — for example "
        "\"vzít život\", \"přijít o život\", \"připravit o život\". Return ONLY a JSON array of the rewritten "
        "sentences, the same count, in the same order.\n\n" + "\n".join(f"{i + 1}. {s}" for i, s in enumerate(bad)),
        style)
    try:
        items = _json_items(ask, max_tokens=max(1500, 160 * len(bad)))
    except (SystemExit, _ClaudeError) as e:
        log(f"script: {len(bad)} sentence(s) with avoided words kept as written — {str(e)[:80]}")
        return script
    fixed = 0
    if isinstance(items, list) and len(items) == len(bad):
        for old, new in zip(bad, items):
            new = str(new or "").strip()
            if new and not pat.search(_fold(new)):
                script = script.replace(old, new, 1)
                fixed += 1
    log(f"script: {fixed} of {len(bad)} sentence(s) rewritten without the channel's avoided words")
    return script


def generate_script(title: str, minutes: int, job: Path, force: bool, style: str = "") -> str:
    script_path = job / "script.txt"
    _min_words = min(1000, int(minutes * WPM * 0.7))  # legit-length floor (catches stubs)
    # a script the creator pasted is the script, "Redo everything" or not — only what is made from it is redone
    if script_path.exists() and (not force or (job / "script.pasted").exists()):
        cached = script_path.read_text(encoding="utf-8")
        if not _looks_like_refusal(cached) and (len(cached.split()) >= _min_words
                                                or (job / "script.pasted").exists()):
            log(f"cached: {script_path.name}")
            return _script_chapters(job, _factchecked(job, cached, style, title, force))
        # A poisoned cache (an old refusal or a too-short stub) must not be reused —
        # regenerate, and invalidate the downstream artifacts it contaminated.
        log("the cached script was a refusal or too short — regenerating, and clearing the old audio/subtitles/images…")
        import shutil
        for stale in ("audio.mp3", "subs.srt", "ai_items.json"):
            (job / stale).unlink(missing_ok=True)
        for p in list(job.glob("audio_p*.mp3")) + list(job.glob("subs_p*.srt")):
            p.unlink(missing_ok=True)
        shutil.rmtree(job / "images", ignore_errors=True)

    pset = prompts.PROMPT_SETS.get(style)
    if not pset:
        sys.exit(f"No channel called '{style}'. Channels live in styles/*.json — "
                 f"available: {', '.join(sorted(prompts.PROMPT_SETS)) or '(none yet)'}")
    length_str = f"{minutes} minutes"
    wpm = float(STYLE_WPM.get(style) or WPM)
    target_words = int(minutes * wpm)

    log(f"Claude: outline ({pset['label']}, target ~{minutes} min ≈ {target_words} words)...")
    craft_o, craft_s = _script_craft(style)
    outline_prompt = (_lang_prompt(pset["outline"], style)
                      .replace("[INSERT TITLE HERE]", title)
                      .replace("[INSERT LENGTH — e.g., 15 minutes, 20 minutes, 25 minutes]", length_str)
                      + craft_o + _lang_suffix(style) + _extra_block() + _sources_block(job, title))
    prev = _previous_titles(style)
    if prev:
        outline_prompt += (
            "\n\nALREADY PUBLISHED ON THIS CHANNEL — do NOT re-teach this ground:\n"
            + "\n".join(f"- {t}" for t in prev)
            + "\n\nThis video must stand apart from every title above. Choose a DIFFERENT entry "
              "point, a different central image, different scriptures/quotations and a different "
              "practice. If the title overlaps one of them, deliberately approach it from the "
              "angle the earlier video did not take. Repeating the same three or four ideas across "
              "videos is the fastest way to lose a returning viewer.")
    outline = None
    for attempt in range(1, 4):  # refusals are inconsistent — retry before giving up
        cand = claude(outline_prompt, SCRIPT_MODEL, max_tokens=8000, provider=SCRIPT_PROVIDER)
        if not _looks_like_refusal(cand):
            outline = cand
            break
        log(f"outline: the model refused (attempt {attempt}/3) — retrying…")
    if outline is None:
        sys.exit("Claude refused to outline this title three times, so nothing was made. "
                 "Try a different title, or a different channel.")
    (job / "outline.txt").write_text(outline, encoding="utf-8")
    log(f"outline: {len(outline.split())} words")

    # Aim for the target length on the FIRST pass — a gentle nudge, not a hard
    # floor. We write the script once and accept whatever comes out (e.g. ~50 min
    # for a 60-min ask is fine). No rewriting / expansion passes.
    base = (
        _lang_prompt(pset["script"], style)
        .replace("[INSERT OUTLINE HERE]", outline)
        .replace("[INSERT TARGET LENGTH]", length_str)
        + f"\n\nLENGTH: this is an approximately {minutes}-minute video — write the full script at "
          f"roughly {target_words} words ({minutes} min at ~{wpm:.0f} wpm). It does not need to be exact, "
          f"but write the complete piece at about that length; do not stop far short."
        + (f" HARD LIMIT: never more than {int(target_words * 1.12)} words — a short video has no room, and a longer "
           f"script is cut down by a machine, which is never as good as you writing it tight the first time. Count."
           if minutes <= 3 else "")
        + craft_s + _lang_suffix(style) + _extra_block() + _sources_block(job, title)
    )
    if (STYLE_INFO.get(style) or {}).get("script_parts") and target_words >= 1800:
        log("Claude: writing the script part by part...")
        script = _avoid_words(_script_in_parts(outline, minutes, target_words, wpm, style, craft_s, job, title), style)
        script_path.write_text(script, encoding="utf-8")
        script = _factchecked(job, script, style, title, force)
        script = _script_chapters(job, script)
        wc = len(script.split())
        log(f"script: {wc} words (~{wc/wpm:.1f} min spoken, target {minutes} min)")
        return script
    log("Claude: writing full script...")
    # A LEGIT script must (a) not be a refusal/meta, and (b) be a real full-length
    # piece — not a 3-minute stub where the model ignored the prompt. If either
    # fails, we regenerate fresh (up to 3×). This is a validity check, not exact
    # length-matching — we accept anything from a legit script upward.
    min_words = min(1000, int(target_words * 0.7))  # floor that catches stubs but passes normal output
    # Scripts go straight to Anthropic (SCRIPT_PROVIDER) — kie is never touched here,
    # so no time is wasted on kie attempts. Just retry Anthropic on a refusal/stub.
    script = None
    for attempt in range(1, 4):  # up to 3 fresh tries on Anthropic
        raw = claude(base, SCRIPT_BODY_MODEL, max_tokens=20000, provider=SCRIPT_PROVIDER)
        cand = _clean_script(raw)
        wc = len(cand.split())
        if _looks_like_refusal(cand):
            log(f"script: refusal or meta-commentary (attempt {attempt}) — regenerating…")
            continue
        if wc < min_words:
            log(f"script: too short ({wc} words, minimum {min_words}) (attempt {attempt}) — regenerating…")
            continue
        script = cand
        break
    if script is None:
        sys.exit("Claude kept returning an invalid or too-short script, even on the fallback. "
                 "Nothing was made. Try a different title, or a different channel.")

    wc = len(script.split())
    if minutes <= 3 and wc > target_words * 1.15:
        # A short video has no room: a one-minute piece written 40 % long plays for a minute and a half.
        # One tightening pass keeps the cold open, the facts and the ending, and drops what repeats.
        log(f"script: {wc} words for a {minutes}-minute video — tightening to about {target_words}...")
        best = script
        for attempt in range(2):
            try:
                tight = _clean_script(claude(
                    _lang_prompt("Rewrite this narration to exactly " + str(target_words) + " words, give or take ten — "
                                 "never more than " + str(int(target_words * 1.1)) + "; count them "
                                 "(it is now " + str(len(best.split())) + " words — cut about "
                                 + str(max(0, len(best.split()) - target_words)) + "). Keep the opening line, the "
                                 "dates, names and numbers that carry the story, its turn and the final line. Merge "
                                 "sentences, cut repetition and anything that does not move the story. Keep every line "
                                 "that starts with '## ' or '[[clip:' exactly as it is, in its place — they are not "
                                 "narration and do not count as words. Return only the narration, same voice, no "
                                 "notes.\n\nNARRATION:\n" + best, style),
                    SCRIPT_BODY_MODEL, max_tokens=4000, provider=SCRIPT_PROVIDER))
            except _ClaudeError as e:
                log(f"  script: kept as written ({str(e)[:80]})")
                break
            n_t = len(tight.split())
            if not _looks_like_refusal(tight) and target_words * 0.7 <= n_t < len(best.split()):
                best = tight
            if len(best.split()) <= target_words * 1.15:
                break
        script = best
    script = _avoid_words(script, style)
    script = _restore_markers(outline, script, style)
    script_path.write_text(script, encoding="utf-8")
    script = _factchecked(job, script, style, title, force)
    script = _script_chapters(job, script)
    wc = len(script.split())
    log(f"script: {wc} words (~{wc/wpm:.1f} min spoken, target {minutes} min)")
    return script


def _restore_markers(outline: str, script: str, style: str) -> str:
    """The outline planned chapter cards ("[CHAPTER: Title | mood]") and interview handoffs ("[CLIP: …]"), and the
    script came back without its "## Title | mood" and "[[clip: …]]" lines (a one-pass script, or a tightening
    pass, drops them): Claude puts them back between the right paragraphs without changing a spoken word."""
    chapters = re.findall(r"\[CHAPTER:\s*([^\]]+)\]", outline or "", re.I)
    clips = re.findall(r"\[CLIP:\s*([^\]]+)\]", outline or "", re.I)
    has_ch = bool(re.search(r"(?m)^[ \t]*#{1,3}[ \t]*\S", script or ""))
    has_cl = "[[clip:" in (script or "").lower()
    if (not chapters or has_ch) and (not clips or has_cl):
        return script
    want = []
    if chapters and not has_ch:
        want.append("one line holding only \"## \" and the chapter title with its mood, exactly as the plan wrote it "
                    "(\"## Title | mood\"), before the first paragraph of each chapter: " +
                    " | ".join(f'"{c.strip()}"' for c in chapters))
    if clips and not has_cl:
        want.append("one line holding only \"[[clip: …]]\" after the paragraph that sets it up, for each interview "
                    "moment the plan marked: " + " | ".join(f'"{c.strip()}"' for c in clips))
    ask = ("This narration was written from the plan below, but the marker lines the plan asked for are missing. "
           "Put them back — and change NOTHING else: not one spoken word, not the paragraph order.\n\nAdd " +
           "; and ".join(want) + ".\nThe cold open is not a chapter: the first \"## \" line goes before the paragraph "
           "where that chapter's beat begins. Return only the narration with the marker lines in place.\n\n"
           "THE PLAN:\n" + (outline or "")[:6000] + "\n\nTHE NARRATION:\n" + script)
    try:
        got = _clean_script(claude(_lang_prompt(ask, style), SCRIPT_BODY_MODEL, max_tokens=6000, provider=SCRIPT_PROVIDER))
    except _ClaudeError as e:
        log(f"  script: markers not restored ({str(e)[:80]})")
        return script
    spoken = lambda t: " ".join(ln for ln in t.splitlines() if not re.match(r"^\s*(#{1,3}\s|\[\[)", ln)).split()
    a, b = spoken(script), spoken(got)
    same = difflib.SequenceMatcher(None, a, b, autojunk=False).ratio() if a and b else 0.0
    n_ch = len(re.findall(r"(?m)^[ \t]*#{1,3}[ \t]*\S", got))
    n_cl = got.lower().count("[[clip:")
    if same >= 0.9 and (n_ch or not chapters) and (n_cl or not clips):
        log(f"script: {n_ch} chapter line(s) and {n_cl} clip line(s) put back from the plan")
        return got
    log(f"  script: markers not restored (narration changed {100 - same * 100:.0f}%, {n_ch} chapters, {n_cl} clips)")
    return script


def _script_chapters(job: Path, script: str) -> str:
    """A script with "## Chapter" lines (cinema.py): the lines go to chapters.json, the voice gets the narration."""
    if not (re.search(r"(?m)^[ \t]*#{1,3}[ \t]*\S", script or "") or "[[clip:" in (script or "")) \
            or not (HERE / "cinema.py").exists():
        return script
    try:
        import cinema
        clean = cinema.split_chapters(job)
        n = len(json.loads((job / "chapters.json").read_text(encoding="utf-8")))
        log(f"script: {n} chapter(s) taken out of the narration (chapters.json)")
        return clean or script
    except Exception as e:                        # noqa: BLE001
        log(f"script: chapters not read — {str(e)[:120]}")
        return script


# ════════════════════════════════════════════════════════════════════════════
# ai33.pro  —  voiceover + SRT
# ════════════════════════════════════════════════════════════════════════════
AI33_BASE = "https://api.ai33.pro"
AI33_MODEL = "eleven_v3"
AI33_CHUNK_CHARS = 20000

VOICE_PRESETS = {
    "channel_default": {"label": "Channel default"},
    "grit3_105": {"label": "GRIT 3 · 1.05×", "provider": "ai33",
                  "voice_id": "clone_2628473", "speed": 1.05},
}


def saved_voice_preset(job: Path) -> str:
    f = job / "voice-choice.json"
    return json.loads(f.read_text(encoding="utf-8"))["preset"] if f.exists() else "channel_default"


def grit_voice_unavailable(style: str) -> str:
    look = (STYLE_INFO.get(style) or {}).get("look") or {}
    if not AI33_API_KEY:
        return "GRIT 3 needs the ai33 API key."
    if isinstance(look.get("legend"), dict) or look.get("visuals", "scenes") not in ("", "scenes", "quotes"):
        return "This channel has its own voice workflow. Use Channel default."
    return ""


def validate_voice_preset(job: Path, style: str, preset=None, byo_audio: str = "") -> str:
    saved = saved_voice_preset(job)
    preset = saved if preset is None else preset
    if not isinstance(preset, str) or preset not in VOICE_PRESETS:
        raise ValueError("Choose a valid voice preset.")
    if preset != "channel_default":
        reason = grit_voice_unavailable(style)
        if reason or byo_audio:
            raise ValueError(reason or "An uploaded voiceover cannot also use a voice preset.")
    # Include partial recordings: a failed split narration must not mix voices on retry.
    recorded = (any(job.glob("audio*.mp3")) or any(job.glob("_chunks_*"))
                or (job / "voice.json").exists() or final_video(job).exists())
    if recorded and preset != saved:
        raise ValueError("This title already has a different voice. Use a new title for the new voice version.")
    return preset


def save_voice_choice(job: Path, preset: str) -> None:
    (job / "voice-choice.json").write_text(json.dumps({"preset": preset}), encoding="utf-8")


def _ai33_headers() -> dict:
    return {"Authorization": AI33_API_KEY, "Content-Type": "application/json"}


AI33_PREFIXES = ("elevenlabs_", "minimax_", "clone_", "edge_", "kokoro_", "vbee_", "fishaudio_")


def _ai33_voice(voice_id: str) -> str:
    """ai33 names a voice by the service it comes from. A channel carries a bare ElevenLabs id,
    so it is labelled here rather than in every style file."""
    v = (voice_id or "").strip()
    return v if v.startswith(AI33_PREFIXES) else ("elevenlabs_" + v if v else v)


def _ai33_submit(text: str, voice_id: str = "", speed=None) -> str:
    for attempt in range(1, 7):
        try:
            if speed is not None:
                # Unified v3 clones use the documented form fields, without an ElevenLabs model.
                r = requests.post(f"{AI33_BASE}/v3/text-to-speech", headers={"xi-api-key": AI33_API_KEY},
                                  files={k: (None, str(v)) for k, v in {
                                      "voice_id": _ai33_voice(voice_id), "text": text,
                                      "speed": speed, "with_transcript": "true"}.items()}, timeout=90)
            else:
                r = requests.post(f"{AI33_BASE}/v3/text-to-speech", headers=_ai33_headers(),
                                  json={"voice_id": _ai33_voice(voice_id or AI33_VOICE_ID), "text": text,
                                        "model_id": AI33_MODEL, "with_transcript": True}, timeout=90)
        except requests.exceptions.RequestException as e:  # timeout / connection drop
            if speed is not None:
                raise  # do not resubmit a paid clone request whose outcome is uncertain
            wait = min(60, 10 * attempt)
            log(f"ai33 submit network hiccup ({e.__class__.__name__}), retry in {wait}s ({attempt}/6)")
            time.sleep(wait)
            continue
        if r.status_code == 429 or r.status_code >= 500:
            if speed is not None:
                r.raise_for_status()
            wait = min(60, 10 * attempt)
            log(f"ai33 submit HTTP {r.status_code}, retry in {wait}s ({attempt}/6)")
            time.sleep(wait)
            continue
        r.raise_for_status()
        data = r.json()
        if not data.get("success"):
            sys.exit(f"ai33 TTS failed: {data}")
        tid = data["task_id"]
        log(f"ai33: job accepted (task={tid}), rendering the voice…")
        return tid
    sys.exit("ai33 TTS submit failed after retries")


def _ai33_poll(task_id: str, timeout_s: int = 1800) -> dict:
    """Poll until the render is done. Survives slow/timed-out poll responses —
    a single hiccup must never abandon an in-progress (already paid-for) render."""
    deadline = time.time() + timeout_s
    start = time.time()
    last_beat = 0.0
    errors = 0
    while time.time() < deadline:
        try:
            r = requests.get(f"{AI33_BASE}/v3/task/{task_id}",
                             headers={"Authorization": AI33_API_KEY}, timeout=60)
            if r.status_code >= 500:
                errors += 1
                if errors >= 15:
                    sys.exit(f"ai33 poll: too many server errors (last HTTP {r.status_code})")
                time.sleep(6)
                continue
            r.raise_for_status()
            errors = 0
        except requests.exceptions.RequestException as e:  # read timeout / connection drop
            errors += 1
            log(f"ai33 poll network hiccup ({e.__class__.__name__}), retrying ({errors}/15)")
            if errors >= 15:
                sys.exit(f"ai33 poll: too many network errors: {e}")
            time.sleep(6)
            continue
        data = r.json().get("data", {})
        status = data.get("status", "")
        if status == "done":
            return data
        if status in ("failed", "error"):
            sys.exit(f"ai33 task failed: {data.get('error_message') or data}")
        # Heartbeat so a long render never looks frozen in the UI.
        elapsed = time.time() - start
        if elapsed - last_beat >= 30:
            last_beat = elapsed
            log(f"ai33: still rendering the voice… {int(elapsed)}s (status={status or '?'})")
        time.sleep(3)
    sys.exit(f"ai33 task {task_id} timed out after {timeout_s}s")


def _download(url: str, dest: Path, retries: int = 4, min_bytes: int = 1024) -> None:
    last = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, timeout=180)
            r.raise_for_status()
            if len(r.content) < min_bytes:   # empty/truncated -> a 0-byte file breaks ffmpeg later
                raise requests.exceptions.RequestException(f"download too small ({len(r.content)}B)")
            dest.write_bytes(r.content)
            return
        except requests.exceptions.RequestException as e:
            last = e
            if attempt < retries:
                time.sleep(4 * attempt)
    raise last


def _split_sentences(text: str, max_chars: int) -> list:
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks, cur = [], ""
    for s in sents:
        if len(cur) + len(s) + 1 > max_chars and cur:
            chunks.append(cur.strip())
            cur = s
        else:
            cur = f"{cur} {s}" if cur else s
    if cur.strip():
        chunks.append(cur.strip())
    return chunks or [text]


def _ai33_tts_one(text: str, mp3: Path, srt: Path, voice_id: str = "", speed=None) -> None:
    """ai33: one block of text -> mp3 + srt (handles internal chunking)."""
    chunks = _split_sentences(text, AI33_CHUNK_CHARS)
    log(f"ai33: {len(text)} chars -> {len(chunks)} chunk(s), voice={voice_id}")
    if len(chunks) == 1:
        meta = _ai33_poll(_ai33_submit(chunks[0], voice_id, speed)).get("metadata", {})
        if not meta.get("audio_url"):
            sys.exit(f"ai33 done but no audio_url: {meta}")
        _download(meta["audio_url"], mp3)
        if meta.get("srt_url"):
            _download(meta["srt_url"], srt, min_bytes=16)
    else:
        tmp = job_tmp = mp3.parent / f"_chunks_{mp3.stem}"
        tmp.mkdir(exist_ok=True)
        mp3s, srts, offset = [], [], 0.0
        for i, ch in enumerate(chunks):
            log(f"  chunk {i+1}/{len(chunks)} ({len(ch)} chars)")
            meta = _ai33_poll(_ai33_submit(ch, voice_id, speed)).get("metadata", {})
            cm = tmp / f"c{i:02d}.mp3"
            _download(meta["audio_url"], cm)
            mp3s.append(cm)
            if meta.get("srt_url"):
                cs = tmp / f"c{i:02d}.srt"
                _download(meta["srt_url"], cs, min_bytes=16)
                srts.append((cs, offset))
            offset += _audio_dur(cm)
        _concat_mp3(mp3s, mp3)
        if srts:
            _merge_srt(srts, srt)
    if not srt.exists():
        _even_subs(text, mp3, srt)


def _split_script_by_minutes(text: str, first_minutes: float) -> list:
    """Split off the FIRST ~first_minutes as part 1 (e.g. an AI-avatar intro), the
    rest as part 2 — at a PARAGRAPH boundary (never mid-sentence). Returns
    [part1, part2], or [whole] if splitting doesn't apply."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    if first_minutes <= 0 or len(paras) <= 1:
        return [text.strip()]
    target = int(first_minutes * WPM)  # words in the first (avatar) part
    part1, words, cut = [], 0, -1
    for i, p in enumerate(paras):
        part1.append(p)
        words += len(p.split())
        cut = i
        if words >= target:
            break
    rest = paras[cut + 1:]
    if not rest:  # the first part would swallow the whole script — don't split
        return [text.strip()]
    return ["\n\n".join(part1), "\n\n".join(rest)]


def generate_voiceover(script: str, job: Path, force: bool, avatar_min: float = 0,
                       style: str = "", voice_preset=None):
    """Generate the voiceover. avatar_min<=0 -> one audio.mp3 + subs.srt.
    avatar_min>0 -> split off the FIRST ~avatar_min minutes as its own part
    (audio_p1.mp3 = avatar intro, audio_p2.mp3 = the rest), rendered separately;
    the full audio.mp3/subs.srt (parts joined) is still produced for the video."""
    preset = validate_voice_preset(job, style, voice_preset)
    voice = VOICE_PRESETS[preset] if preset != "channel_default" else None
    save_voice_choice(job, preset)
    log(f"Voice: {VOICE_PRESETS[preset]['label']}")
    provider = voice["provider"] if voice else _voice_provider(style)
    if provider == "wavespeed":
        # ElevenLabs v3 on WaveSpeed speaks with its own named voices: the channel's
        # `voice.wavespeed_voice` (or WAVESPEED_VOICE in .env), a deep narrator by default.
        import wavespeed
        v = (STYLE_INFO.get(style) or {}).get("voice") or {}
        return wavespeed.voiceover(sys.modules[__name__], script, job,
                                   {"voice_id": v.get("wavespeed_voice") or os.environ.get("WAVESPEED_VOICE") or "Brian",
                                    "model": v.get("wavespeed_model") or "elevenlabs/eleven-v3/timing"}, force)
    voice_id = voice["voice_id"] if voice else (STYLE_VOICE.get(style) or AI33_VOICE_ID)
    if not voice_id:
        sys.exit(
            "No voice set for this channel.\n"
            "  Pick one in your ai33 dashboard,\n"
            f'  then put its id in styles/{style or "<channel>"}.json under "voice": '
            '{"voice_id": "..."}\n'
            "  — or set AI33_VOICE_ID in .env to use one voice everywhere.")
    mp3 = job / "audio.mp3"
    srt = job / "subs.srt"
    if mp3.exists() and not force:
        log(f"cached: {mp3.name}")
        return _denoise_voice(mp3, style), srt
    if provider == "ai33" and not AI33_API_KEY:
        # Only when ai33 is the chosen service: a setup that speaks through another
        # service must not die here over a key it never needs.
        sys.exit("ERROR: AI33_API_KEY missing in .env")

    segs = _split_script_by_minutes(script, avatar_min)
    if len(segs) <= 1:
        _tts_one(script, mp3, srt, voice_id, style, voice)
    else:
        pdir = job / "parts"
        pdir.mkdir(exist_ok=True)
        log(f"voiceover split: part 1 ~{avatar_min} min ({len(segs[0].split())} words, "
            f"~{len(segs[0])} chars) · part 2 = the rest ({len(segs[1].split())} words)")
        for i, ptext in enumerate(segs, 1):
            (pdir / f"script_p{i}.txt").write_text(ptext, encoding="utf-8")

        # Render all parts in PARALLEL (each is an independent ai33 render).
        def do_part(i: int, ptext: str):
            pm, ps = job / f"audio_p{i}.mp3", job / f"subs_p{i}.srt"
            if not (pm.exists() and not force):
                log(f"voiceover part {i}/{len(segs)} ({len(ptext.split())} words)...")
                _tts_one(ptext, pm, ps, voice_id, style, voice)
            return pm, ps

        results = [None] * len(segs)
        with ThreadPoolExecutor(max_workers=len(segs)) as ex:
            futs = {ex.submit(do_part, i, segs[i - 1]): i for i in range(1, len(segs) + 1)}
            for f in as_completed(futs):
                results[futs[f] - 1] = f.result()

        # Full audio/subs = the parts joined (in order), so the video step still works.
        part_mp3s, part_srts, offset = [], [], 0.0
        for pm, ps in results:
            part_mp3s.append(pm)
            if ps.exists():
                part_srts.append((ps, offset))
            offset += _audio_dur(pm)
        _concat_mp3(part_mp3s, mp3)
        if part_srts:
            _merge_srt(part_srts, srt)
        if not srt.exists():
            _even_subs(script, mp3, srt)

    _regroup_word_srt(srt)
    fixed = _script_words_into_srt(srt, script)
    log(f"voiceover: {mp3.name} ({_audio_dur(mp3):.0f}s)  +  {srt.name}"
        + (f" ({fixed} subtitle words corrected from the script)" if fixed else "")
        + (f"  +  part 1 (~{avatar_min} min) exported separately" if len(segs) > 1 else ""))
    mp3 = _denoise_voice(mp3, style)
    (job / "voice.json").write_text(json.dumps({"preset": preset, **VOICE_PRESETS[preset]}), encoding="utf-8")
    return mp3, srt


def _regroup_word_srt(srt: Path, max_words: int = 7, max_s: float = 4.0) -> int:
    """A subtitle file that came back one word per cue (some voice engines write them that way) is
    regrouped into short lines: up to `max_words` words or `max_s` seconds, ending at a sentence end or a comma
    when one is near. Files whose cues already hold a few words are left alone. Returns the cues written."""
    if not srt.exists():
        return 0
    cues = _parse_srt_full(srt.read_text(encoding="utf-8"))
    if len(cues) < 8 or sum(len(t.split()) for _, _, t in cues) / max(1, len(cues)) > 2.5:
        return 0
    words = [(a, b, w) for a, b, t in cues for w in t.split()]
    out, cur = [], []
    for a, b, w in words:
        cur.append((a, b, w))
        span = cur[-1][1] - cur[0][0]
        if re.search(r"[.!?…]$", w) or len(cur) >= max_words or span >= max_s or (len(cur) >= 4 and w.endswith(",")):
            out.append(cur)
            cur = []
    if cur:
        if out and len(cur) <= 2:
            out[-1] += cur
        else:
            out.append(cur)
    lines = []
    for k, c in enumerate(out):
        a, b = c[0][0], max(c[-1][1], c[0][0] + 0.4)
        if k + 1 < len(out) and out[k + 1][0][0] - b < 0.25:
            b = out[k + 1][0][0]
        lines.append(f"{k + 1}\n{_srt_ts(a)} --> {_srt_ts(b)}\n{' '.join(w for _, _, w in c)}\n")
    srt.write_text("\n".join(lines), encoding="utf-8")
    log(f"subtitles: {len(cues)} one-word cues regrouped into {len(out)} lines")
    return len(out)


def _script_words_into_srt(srt: Path, script: str) -> int:
    """The subtitles' words, spelled as the script spells them. The timings come from a transcription of the
    finished voice, which hears "Nikki Nicole", "Fatih Vazquez" and "Singer" where the script says Nicki
    Nicole, Fati Vázquez and Influencer — and those words were burnt into the video. The timing stays; each
    transcribed word is matched to the script's own word in order. Numbers keep the subtitles' digits
    ("150.686", not "one hundred fifty point six eight six"). Returns how many words changed."""
    import difflib
    try:
        cues = _parse_srt_full(srt.read_text(encoding="utf-8"))
    except OSError:
        return 0
    if not cues or not (script or "").strip():
        return 0
    norm = lambda w: re.sub(r"[^a-z0-9]", "", _fold(w))
    sub_words = [(k, w) for k, (_, _, txt) in enumerate(cues) for w in txt.split()]
    scr_words = [w for w in re.sub(r"\s+", " ", _no_audio_tags(script)).split() if norm(w)]
    a, b = [norm(w) for _, w in sub_words], [norm(w) for w in scr_words]
    out = [w for _, w in sub_words]
    changed = 0
    tail = lambda w: (re.search(r"[.,!?;:\u2026\"']+$", w) or [""])[0]
    pairs = {}                                          # subtitle word -> script word it is
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and (i2 - i1) == (j2 - j1) and (i2 - i1) <= 3):
            # a word too different to be the same one misheard is still taken ("Singer" for "Influencer":
            # same place, same slot) — but a number keeps the subtitle's digits
            pairs.update({i: j for i, j in zip(range(i1, i2), range(j1, j2)) if not any(ch.isdigit() for ch in out[i])})
    ends = lambda w: bool(re.search(r"[.!?][\"')\]]*$", w))
    for i in sorted(pairs):
        j = pairs[i]
        word = scr_words[j]
        # the script's spelling, capitals and punctuation — except a full stop the script only puts after a word
        # the voice never said ("cost $5 million." for "five million dollars.")
        if tail(out[i]) and not tail(word) and pairs.get(i + 1) != j + 1:
            word += tail(out[i])
        # a capital that belongs to a sentence start follows the punctuation actually in front of it: after the
        # subtitle's own "2024." a word the script wrote after "2024:" starts a sentence, so the subtitle's case wins
        if (i == 0 or ends(out[i - 1])) != (j == 0 or ends(scr_words[j - 1])):
            hl = next((ch for ch in out[i] if ch.isalpha()), "")
            k = next((n for n, ch in enumerate(word) if ch.isalpha()), None)
            if hl and k is not None:
                word = word[:k] + (word[k].upper() if hl.isupper() else word[k].lower()) + word[k + 1:]
        changed += norm(out[i]) != b[j]
        out[i] = word
    texts = {}
    for (k, _), w in zip(sub_words, out):
        texts.setdefault(k, []).append(w)
    lines = []
    for k, (st, en, txt) in enumerate(cues):
        lines.append(f"{k + 1}\n{_srt_ts(st)} --> {_srt_ts(en)}\n{' '.join(texts.get(k, txt.split()))}\n")
    srt.write_text("\n".join(lines), encoding="utf-8")
    return changed


_CLOCKS: dict = {}          # cues signature -> {cue index: [(start, end) per word]}, from _word_clock


def _cues_key(cues: list) -> str:
    return hashlib.sha1(json.dumps([[round(float(a), 2), round(float(b), 2), t] for a, b, t in cues],
                                   ensure_ascii=False).encode("utf-8")).hexdigest()


def _word_clock(job: Path, srt: Path) -> dict:
    """{cue index: [(start, end) for each word of that cue]} — every subtitle word on the voice's own clock.

    A subtitle cue only knows when it starts and ends; inside a long cue a word was placed by its letters, and
    the karaoke highlight ran up to a second behind the voice. faster-whisper hears the finished voice word by
    word (`words_heard.json`, made once); its words are matched to the subtitle words in order, and a word it
    heard differently ("ninety" for "90") takes its share of the time between its matched neighbours.
    Cached in `words.json` for this exact subtitle file. {} when nothing could be heard."""
    cache, heard_f, mp3 = job / "words.json", job / "words_heard.json", job / "audio.mp3"
    try:
        cues = _parse_srt_full(srt.read_text(encoding="utf-8"))
    except OSError:
        return {}
    sig = hashlib.sha1(srt.read_bytes()).hexdigest()[:16]
    if cache.exists():
        try:
            d = json.loads(cache.read_text(encoding="utf-8"))
            if d.get("srt") == sig:
                out = {int(k): [tuple(x) for x in v] for k, v in (d.get("cues") or {}).items()}
                _CLOCKS[_cues_key(cues)] = out
                return out
        except (ValueError, OSError, TypeError, AttributeError):
            pass
    heard = None
    if heard_f.exists():
        try:
            heard = [tuple(x) for x in json.loads(heard_f.read_text(encoding="utf-8"))]
        except (ValueError, OSError, TypeError):
            heard = None
    if heard is None:
        if not mp3.exists():
            return {}
        try:
            model = _get_whisper()
            log("whisper: timing every subtitle word on the voice...")
            segments, _info = model.transcribe(str(mp3), beam_size=1, word_timestamps=True, vad_filter=False)
            heard = [(w.word.strip(), float(w.start), float(w.end)) for sg in segments for w in (sg.words or [])]
        except Exception as e:                                  # noqa: BLE001 - no whisper: the letters estimate stays
            log(f"whisper: word timing unavailable ({str(e)[:80]}) — highlights follow the letters")
            return {}
        heard_f.write_text(json.dumps(heard), encoding="utf-8")
    norm = lambda w: re.sub(r"[^a-z0-9]", "", _fold(w))
    sub = [(k, w) for k, (_, _, txt) in enumerate(cues) for w in txt.split()]
    a, b = [norm(w) for _, w in sub], [norm(w[0]) for w in heard]
    times = [None] * len(sub)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for i, j in zip(range(i1, i2), range(j1, j2)):
                times[i] = (heard[j][1], heard[j][2])
    if not sub or sum(1 for x in times if x) < 0.6 * len(sub):
        return {}
    # a word the transcription heard differently: between its matched neighbours, by its letters, inside its cue
    i = 0
    while i < len(sub):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(sub) and times[j] is None:
            j += 1
        k0, k1 = sub[i][0], sub[j - 1][0]
        lo = times[i - 1][1] if i > 0 and times[i - 1] else cues[k0][0]
        hi = times[j][0] if j < len(sub) and times[j] else cues[k1][1]
        lo, hi = max(lo, cues[k0][0] - 0.3), max(min(hi, cues[k1][1] + 0.3), lo + 0.05 * (j - i))
        weights = [len(re.sub(r"\W", "", sub[x][1])) + 1 for x in range(i, j)]
        tot, acc = float(sum(weights)), 0.0
        for x, wgt in zip(range(i, j), weights):
            s0 = lo + (hi - lo) * acc / tot
            acc += wgt
            times[x] = (s0, lo + (hi - lo) * acc / tot)
        i = j
    out = {}
    for (k, _w), t in zip(sub, times):
        out.setdefault(k, []).append((round(t[0], 3), round(t[1], 3)))
    cache.write_text(json.dumps({"srt": sig, "cues": out}), encoding="utf-8")
    _CLOCKS[_cues_key(cues)] = out
    return out


def _srt_ts(t: float) -> str:
    t = max(0.0, float(t))
    h, rem = divmod(int(round(t * 1000)), 3600000)
    m, rem = divmod(rem, 60000)
    return f"{h:02d}:{m:02d}:{rem // 1000:02d},{rem % 1000:03d}"


_AUDIO_TAG = re.compile(r"\[[^\]\n]{1,40}\]")


def _no_audio_tags(text: str) -> str:
    """The script as it is heard: [pause], [softly] and the other voice directions taken out."""
    return re.sub(r"[ \t]{2,}", " ", _AUDIO_TAG.sub("", text or ""))


def _even_subs(script: str, mp3: Path, srt: Path) -> None:
    dur = _audio_dur(mp3)
    words = _no_audio_tags(script).split()
    lines = [" ".join(words[i:i + 9]) for i in range(0, len(words), 9)]
    if not lines:
        return
    span = dur / len(lines)

    def fmt(s):
        h, m, sec = int(s // 3600), int(s % 3600 // 60), s % 60
        return f"{h:02d}:{m:02d}:{sec:06.3f}".replace(".", ",")
    out = []
    for i, line in enumerate(lines):
        out += [str(i + 1), f"{fmt(i*span)} --> {fmt((i+1)*span)}", line, ""]
    srt.write_text("\n".join(out), encoding="utf-8")


_WHISPER = None


def _get_whisper():
    """Lazy singleton so a batch of BYO videos reuses one loaded model."""
    global _WHISPER
    if _WHISPER is None:
        from faster_whisper import WhisperModel
        log(f"whisper: loading model '{WHISPER_MODEL}' (CPU, int8)…")
        _WHISPER = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _WHISPER


def _srt_ts(s: float) -> str:
    h, m, sec = int(s // 3600), int(s % 3600 // 60), s % 60
    return f"{h:02d}:{m:02d}:{sec:06.3f}".replace(".", ",")


def transcribe_audio(mp3: Path, job: Path, force: bool) -> str:
    """BRING-YOUR-OWN voiceover: transcribe a provided mp3 with faster-whisper →
    write subs.srt (short word-grouped cues) + script.txt (full transcript), and
    return the transcript text (used to drive the scene visuals + Pexels).
    No script generation, no TTS — the audio IS the user's."""
    srt = job / "subs.srt"
    script_f = job / "script.txt"
    if srt.exists() and script_f.exists() and not force:
        log("cached: subs.srt + script.txt (transcript)")
        return script_f.read_text(encoding="utf-8")

    model = _get_whisper()
    log(f"whisper: transcribing {mp3.name} ({_audio_dur(mp3)/60:.1f} min)…")
    segments, info = model.transcribe(str(mp3), beam_size=1, word_timestamps=True,
                                      vad_filter=True)
    # Regroup words into short, well-timed caption cues (~8 words / <=4s / sentence end).
    cues, words = [], []
    full_text = []
    cur_start = None
    for seg in segments:
        full_text.append(seg.text.strip())
        for w in (seg.words or []):
            if cur_start is None:
                cur_start = w.start
            words.append(w)
            wt = w.word.strip()
            long_enough = len(words) >= 8 or (w.end - cur_start) >= 4.0
            sentence_end = wt.endswith((".", "!", "?", "…"))
            if long_enough or sentence_end:
                text = "".join(x.word for x in words).strip()
                cues.append((cur_start, w.end, text))
                words, cur_start = [], None
    if words:  # trailing
        cues.append((words[0].start, words[-1].end, "".join(x.word for x in words).strip()))

    transcript = " ".join(t for t in full_text if t).strip()
    if not transcript:
        sys.exit(f"whisper: empty transcription for {mp3.name}")
    script_f.write_text(transcript, encoding="utf-8")

    out = []
    for i, (a, b, text) in enumerate(cues, 1):
        if not text:
            continue
        out += [str(i), f"{_srt_ts(a)} --> {_srt_ts(max(b, a + 0.3))}", text, ""]
    srt.write_text("\n".join(out), encoding="utf-8")
    log(f"whisper: {len(cues)} subtitle cues, {len(transcript.split())} words (lang={info.language})")
    return transcript


def align_script_audio(script: str, mp3: Path, job: Path, force: bool = False) -> Path:
    """Subtitles made of the SCRIPT's own words, timed by what whisper heard on the voice.

    With an uploaded voiceover, whisper's transcript was the subtitle file — and it spells names its own way
    ("Hornsby Ackroyd", "vaporizer"), so the director's edits, which name the script's exact words, were never
    found and silently dropped (9 of 16 in the first test). Here every subtitle word IS a script word; whisper
    only supplies the clock. Its words are kept in words_heard.json, which _word_clock reuses."""
    srt, heard_f = job / "subs.srt", job / "words_heard.json"
    if srt.exists() and heard_f.exists() and (job / "script.txt").exists() and not force:
        log("cached: subs.srt (script words on the voice's clock)")
        return srt
    heard = None
    if heard_f.exists() and not force:
        try:
            heard = [tuple(x) for x in json.loads(heard_f.read_text(encoding="utf-8"))]
        except (ValueError, OSError, TypeError):
            heard = None
    if heard is None:
        log(f"whisper: hearing {mp3.name} word by word ({_audio_dur(mp3) / 60:.1f} min)…")
        segments, _info = _get_whisper().transcribe(str(mp3), beam_size=1, word_timestamps=True, vad_filter=False)
        heard = [(w.word.strip(), float(w.start), float(w.end)) for sg in segments for w in (sg.words or [])]
        heard_f.write_text(json.dumps(heard), encoding="utf-8")
    words = script.split()
    norm = lambda w: re.sub(r"[^a-z0-9]", "", _fold(w))
    a, b = [norm(w) for w in words], [norm(w[0]) for w in heard]
    times = [None] * len(words)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for i, j in zip(range(i1, i2), range(j1, j2)):
                times[i] = (heard[j][1], heard[j][2])
    matched = sum(1 for x in times if x)
    if not words or matched < 0.6 * len(words):
        sys.exit(f"The voiceover does not match the script ({matched} of {len(words)} words heard) — "
                 "check that the script and the audio are the same text.")
    # a word heard differently: shares the time between its matched neighbours
    i = 0
    while i < len(words):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(words) and times[j] is None:
            j += 1
        t0 = times[i - 1][1] if i > 0 else (times[j][0] if j < len(words) else 0.0)
        t1 = times[j][0] if j < len(words) else t0 + 0.35 * (j - i)
        step_s = max(0.05, (t1 - t0) / (j - i))
        for k in range(i, j):
            times[k] = (t0 + (k - i) * step_s, t0 + (k - i + 1) * step_s)
        i = j
    # short cues as transcribe_audio makes them: ~8 words, at most 4 s, or a sentence end
    cues, start, buf = [], None, []
    for w, (s, e) in zip(words, times):
        start = s if start is None else start
        buf.append(w)
        if len(buf) >= 8 or e - start >= 4.0 or w.endswith((".", "!", "?", "…")):
            cues.append((start, e, " ".join(buf)))
            start, buf = None, []
    if buf:
        cues.append((start, times[-1][1], " ".join(buf)))
    out = []
    for n, (s, e, text) in enumerate(cues, 1):
        out += [str(n), f"{_srt_ts(s)} --> {_srt_ts(max(e, s + 0.3))}", text, ""]
    srt.write_text("\n".join(out), encoding="utf-8")
    (job / "words.json").unlink(missing_ok=True)          # re-timed against these subtitles on first use
    log(f"subtitles: {len(cues)} cues from the script, {matched} of {len(words)} words heard exactly")
    return srt


def _merge_srt(parts: list, out: Path) -> None:
    merged, idx = [], 1
    for path, offset in parts:
        for block in re.split(r"\n\n+", path.read_text(encoding="utf-8").strip()):
            ts, txt_lines = None, []
            for ln in block.strip().split("\n"):
                if "-->" in ln:
                    ts = ln
                elif ts is not None:
                    txt_lines.append(ln)
            if not ts or not txt_lines:
                continue
            m = re.match(r"(\d\d):(\d\d):(\d\d)[,.](\d\d\d)\s*-->\s*(\d\d):(\d\d):(\d\d)[,.](\d\d\d)", ts.strip())
            if not m:
                continue
            g = [int(x) for x in m.groups()]
            st = g[0]*3600 + g[1]*60 + g[2] + g[3]/1000 + offset
            en = g[4]*3600 + g[5]*60 + g[6] + g[7]/1000 + offset

            def fmt(s):
                h, mm, sec = int(s//3600), int(s % 3600//60), int(s % 60)
                return f"{h:02d}:{mm:02d}:{sec:02d},{int((s % 1)*1000):03d}"
            merged += [str(idx), f"{fmt(st)} --> {fmt(en)}", *txt_lines, ""]
            idx += 1
    out.write_text("\n".join(merged), encoding="utf-8")


# ════════════════════════════════════════════════════════════════════════════
# kie.ai  —  AI "quote" images (from the SRT)
# ════════════════════════════════════════════════════════════════════════════
KIE_BASE = "https://api.kie.ai/api/v1/jobs"


def _kie_headers() -> dict:
    return {"Authorization": f"Bearer {KIE_API_KEY}", "Content-Type": "application/json"}


# "wavespeed" or "ai33". Empty = the first of them whose key is in .env.
VOICE_PROVIDER = (os.environ.get("VOICE_PROVIDER") or "").strip().lower()
# Which service renders the stills and thumbnails: "atlascloud",
# "wavespeed" or "kie". Empty = Atlas when its key is present, then the old order.
IMAGE_PROVIDER = (os.environ.get("IMAGE_PROVIDER") or "").strip().lower()
MEDIA_PROVIDER = (os.environ.get("MEDIA_PROVIDER") or "").strip().lower()
# On WaveSpeed: Seedream 4 draws a 16:9 picture for about $0.03, and takes reference pictures
# (a story's main character) through its edit model.
WAVESPEED_IMAGE_MODEL = os.environ.get("WAVESPEED_IMAGE_MODEL", "bytedance/seedream-v4")
WAVESPEED_EDIT_MODEL = os.environ.get("WAVESPEED_EDIT_MODEL", "bytedance/seedream-v4/edit")


def _has_key(name: str) -> bool:
    return bool((os.environ.get(name) or "").strip())


def _image_provider() -> str:
    """The image service: the one .env names when its key is there, else the first key found."""
    have = {"atlascloud": _has_key("ATLASCLOUD_API_KEY"),
            "wavespeed": _has_key("WAVESPEED_API_KEY"), "kie": bool(KIE_API_KEY)}
    requested = (os.environ.get("IMAGE_PROVIDER") or os.environ.get("MEDIA_PROVIDER") or
                 IMAGE_PROVIDER or MEDIA_PROVIDER or "").strip().lower()
    if requested in ("atlas", "atlas-cloud"):
        requested = "atlascloud"
    if requested in ("atlascloud", "wavespeed"):
        # An explicit provider is a choice, not permission to silently spend with
        # a different paid service when its key is absent.
        return requested
    if requested in have and have[requested]:
        return requested
    return next((p for p in ("atlascloud", "wavespeed", "kie") if have[p]),
                requested or "atlascloud")


class CreditsError(RuntimeError):
    """A provider balance cannot pay for the next picture. Retrying cannot fix it."""


# A hard ceiling on paid AI pictures per video (AI_IMAGE_CAP; 0 = none at all). Real media comes first; once
# the ceiling is reached a caller skips the picture the way it already skips a failed one. Thumbnails don't count.
AI_IMAGE_CAP = int(os.environ.get("AI_IMAGE_CAP", "30"))
_AI_IMAGES = {"used": 0}
_AI_LOCK = threading.Lock()


class AIImageCapReached(RuntimeError):
    """This video has used all its AI pictures. Retrying cannot fix it."""


def ai_image_slot(label: str) -> None:
    """Claim one AI picture under AI_IMAGE_CAP, or raise AIImageCapReached."""
    if str(label).startswith("thumbnail"):
        return
    with _AI_LOCK:
        if _AI_IMAGES["used"] >= AI_IMAGE_CAP:
            raise AIImageCapReached(f"{label}: AI picture limit ({AI_IMAGE_CAP}) for this video reached")
        _AI_IMAGES["used"] += 1


def image_gen(prompt: str, dest: Path, label: str = "image", ref_urls=None,
              kie_create_fn=None) -> None:
    """Render one image with whichever provider is configured.

    Atlas is the default when ATLASCLOUD_API_KEY is present. `kie_create_fn` is
    the old kie path, kept so switching back is a single env var.
    """
    ai_image_slot(label)
    provider = _image_provider()
    if provider == "atlascloud":
        if not _has_key("ATLASCLOUD_API_KEY"):
            sys.exit("ERROR: ATLASCLOUD_API_KEY is missing from .env")
        _atlas_image_gen(prompt, dest, label, ref_urls)
        return
    if provider == "wavespeed":
        _wavespeed_image_gen(prompt, dest, label, ref_urls)
        return
    if kie_create_fn is None:
        sys.exit(f"image_gen: provider {provider!r} has no way to make an image")
    _kie_image_gen(kie_create_fn, prompt, dest, label)


def _atlas_image_gen(prompt: str, dest: Path, label: str = "image", ref_urls=None) -> None:
    """One Seedream picture through Atlas; references use Seedream's edit model."""
    import atlascloud
    from PIL import Image

    refs = [u for u in (ref_urls or []) if u][:10]
    model = atlascloud.SEEDREAM_EDIT_MODEL if refs else atlascloud.SEEDREAM_MODEL
    payload = {"prompt": prompt[:3900], "size": "2560*1440"}
    if refs:
        payload["images"] = refs
    raw = dest.with_name(dest.stem + "_atlas.png")
    try:
        atlascloud.run(model, payload, raw, label=label, timeout_s=900, log=log)
        Image.open(raw).convert("RGB").save(dest, "JPEG", quality=92)
    except atlascloud.AtlasCloudError:
        raise
    except Exception as e:                                      # a completed paid job must not be resubmitted
        raise atlascloud.AtlasCloudError(f"{label}: Atlas output could not be saved ({type(e).__name__})") from e
    finally:
        raw.unlink(missing_ok=True)


def _wavespeed_image_gen(prompt: str, dest: Path, label: str = "image", ref_urls=None) -> None:
    """One 16:9 picture from WaveSpeed; reference pictures go through the edit model."""
    import wavespeed
    from PIL import Image
    refs = [u for u in (ref_urls or []) if u][:10]
    model = WAVESPEED_EDIT_MODEL if refs else WAVESPEED_IMAGE_MODEL
    if "gpt-image" in model:
        payload = {"prompt": prompt[:3900], "aspect_ratio": "16:9", "quality": "medium", "resolution": "1k"}
    else:
        payload = {"prompt": prompt[:3900], "size": "2560*1440"}
    if refs:
        payload["images"] = refs
    raw = dest.with_name(dest.stem + "_ws.png")
    try:
        wavespeed.run(model, payload, raw, label=label, log=log)
        Image.open(raw).convert("RGB").save(dest, "JPEG", quality=92)
    except wavespeed.WaveSpeedBalanceError as e:
        raise CreditsError(f"WaveSpeed balance is empty — {str(e)[:120]} Top up at wavespeed.ai, then run "
                                 f"the same title again: every picture already made is kept.")
    except wavespeed.WaveSpeedError as e:
        raise RuntimeError(str(e))
    except Exception as e:                                  # noqa: BLE001 - a download or a broken file: one picture
        raise RuntimeError(f"WaveSpeed picture failed — {type(e).__name__}: {str(e)[:120]}")
    finally:
        raw.unlink(missing_ok=True)


def _kie_image_gen(create_fn, prompt, dest: Path, label: str = "image", retries: int = 4) -> None:
    """create -> poll -> download a kie image, retrying the whole thing on transient
    kie failures (internal error / timeout / network). kie is the only image
    provider, so there's no fallback — but most failures are transient blips."""
    last = None
    for attempt in range(1, retries + 1):
        try:
            _download(_kie_poll(create_fn(prompt)), dest)
            return
        except (RuntimeError, TimeoutError, requests.exceptions.RequestException) as e:
            last = e
            if attempt < retries:
                wait = min(60, 12 * attempt)
                log(f"  kie {label}: failed (attempt {attempt}/{retries}), retrying in {wait}s — {str(e)[:70]}")
                time.sleep(wait)
    raise RuntimeError(f"kie {label} failed after {retries} attempts: {last}")


def _kie_create(prompt: str) -> str:
    r = requests.post(f"{KIE_BASE}/createTask", headers=_kie_headers(),
                      json={"model": KIE_IMAGE_MODEL,
                            "input": {"prompt": prompt[:5000], "aspect_ratio": "16:9", "output_format": "jpeg"}},
                      timeout=60)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 200:
        raise RuntimeError(f"kie createTask error: {data}")
    return data["data"]["taskId"]


def _kie_poll(task_id: str, timeout_s: int = 600) -> str:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = requests.get(f"{KIE_BASE}/recordInfo", headers=_kie_headers(), params={"taskId": task_id}, timeout=30)
        if r.status_code >= 500:
            time.sleep(5)
            continue
        r.raise_for_status()
        data = r.json().get("data", {})
        state = data.get("state", "")
        if state == "success":
            urls = json.loads(data.get("resultJson", "{}")).get("resultUrls", [])
            if not urls:
                raise RuntimeError(f"kie success but no resultUrls: {data}")
            cc = data.get("creditsConsumed")
            if cc is not None:
                log(f"  kie creditsConsumed: {cc}")
            return urls[0]
        if state == "fail":
            raise RuntimeError(f"kie task failed: {data.get('failMsg') or data}")
        time.sleep(4)
    raise TimeoutError(f"kie task {task_id} timed out")


def generate_ai_quote_items(srt: Path, job: Path, force: bool) -> list:
    """Claude reads the SRT and returns 10 {time, text, prompt} quote-image specs."""
    out = job / "ai_items.json"
    if out.exists() and not force:
        log(f"cached: {out.name}")
        return json.loads(out.read_text(encoding="utf-8"))
    log("Claude: picking 10 quotes from the subtitles...")
    items = _json_items(prompts.AI_QUOTE_IMAGES_PROMPT.replace("[INSERT SRT HERE]", srt.read_text(encoding="utf-8")),
                        max_tokens=4000)[:NUM_AI_IMAGES]
    norm = []
    for it in items:
        try:
            t = float(it.get("time", 0))
        except (TypeError, ValueError):
            t = 0.0
        norm.append({"time": t, "text": str(it.get("text", "")), "prompt": str(it.get("prompt", ""))})
    if len(norm) < NUM_AI_IMAGES:
        sys.exit(f"Expected {NUM_AI_IMAGES} quote items, got {len(norm)}")
    out.write_text(json.dumps(norm, indent=2), encoding="utf-8")
    return norm




def _resolve_qr():
    """Find the QR overlay image (configured path or assets/qr.* in any format)."""
    p = Path(QR_OVERLAY)
    if p.exists():
        return p
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        cand = HERE / "assets" / f"qr{ext}"
        if cand.exists():
            return cand
    return None


def _ensure_qr_flat(qr: Path) -> Path:
    """Flatten the QR onto a solid WHITE card (with a quiet-zone border). A QR
    with a transparent background would show the dark video through its light
    modules and be unscannable — this bakes a white background behind it."""
    flat = qr.parent / "_qr_flat.png"
    if flat.exists() and flat.stat().st_mtime >= qr.stat().st_mtime:
        return flat
    dims = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                           "-show_entries", "stream=width,height", "-of", "csv=p=0", str(qr)],
                          capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip().split(",")
    w, h = (int(dims[0]), int(dims[1])) if len(dims) == 2 else (475, 474)
    ch = max(2, int(h * (1.0 - QR_CROP_BOTTOM)))  # cropped height (drop the URL line at the bottom)
    bw, bh = w + 40, ch + 40                       # 20px white quiet-zone border
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=white:s={bw}x{bh}",
                    "-i", str(qr), "-filter_complex",
                    f"[1:v]crop={w}:{ch}:0:0[qc];[0][qc]overlay=(W-w)/2:(H-h)/2,format=rgb24",
                    "-frames:v", "1", str(flat)],
                   check=True, capture_output=True)
    return flat


def _kie_upload_image(path: Path) -> str:
    """Upload a local image to kie's file host, return the public URL (needed
    because gpt-image-2 image-to-image only accepts input image URLs)."""
    import base64
    import mimetypes
    mime = mimetypes.guess_type(str(path))[0] or "image/png"
    data_url = f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()
    r = requests.post("https://kieai.redpandaai.co/api/file-base64-upload",
                      headers={"Authorization": f"Bearer {KIE_API_KEY}", "Content-Type": "application/json"},
                      json={"base64Data": data_url, "uploadPath": "thumbs", "fileName": path.name},
                      timeout=120)
    r.raise_for_status()
    d = r.json().get("data", {}) or {}
    url = d.get("downloadUrl") or d.get("fileUrl") or d.get("url")
    if not url:
        sys.exit(f"kie file upload returned no URL: {r.text[:300]}")
    return url


def _kie_thumbnail_create(prompt: str, input_urls: list) -> str:
    r = requests.post(f"{KIE_BASE}/createTask", headers=_kie_headers(),
                      json={"model": THUMB_MODEL,
                            "input": {"prompt": prompt[:20000], "input_urls": input_urls,
                                      "aspect_ratio": "16:9", "resolution": "2K"}},
                      timeout=60)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 200:
        raise RuntimeError(f"kie thumbnail createTask error: {data}")
    return data["data"]["taskId"]




THUMB_INSPO_DIR = HERE / "assets" / "thumb_inspo"


def _astro_inspo() -> tuple:
    """Return (anchor_path, study_paths) from assets/thumb_inspo/. The anchor
    (a file named _anchor.* or the first image) is the gpt-image-2 style reference;
    the rest are what Opus studies."""
    if not THUMB_INSPO_DIR.exists():
        return None, []
    imgs = sorted(p for p in THUMB_INSPO_DIR.iterdir()
                  if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
    if not imgs:
        return None, []
    anchors = [p for p in imgs if p.stem.lower().startswith("_anchor")]
    anchor = anchors[0] if anchors else imgs[0]
    study = [p for p in imgs if p != anchor] or imgs
    return anchor, study


# ── Thumbnail STYLE-ELEMENT LIBRARY ────────────────────────────────────────
# Concrete building blocks reverse-engineered from top competitor thumbnails.
# Per variant we RANDOMLY sample one from each group (+ a few stickers) and feed
# that exact shot-list to the model, so every thumbnail is a DIFFERENT hand-made
# sticker-collage instead of the same clean AI scene.
THUMB_ELEMENTS = {
    "layout": [
        "3-PANEL TRIPTYCH divided by thin gold/black seams — LEFT face | CENTER cosmic event | RIGHT energy-body",
        "3-PANEL TRIPTYCH but ragged, panels slightly overlapping like pasted cut-outs",
        "SINGLE huge dramatic figure filling the frame, with 2 small circular inset cut-outs pasted over it",
        "2-PANEL split — a giant emotive face on the left, a cosmic symbol bleeding across the right",
        "CENTER figure with a big cosmic event behind the head and an energy-body cut-out pasted to one side",
    ],
    "left_figure": [
        "a colorized medieval woodcut man with wildly bulging wide eyes and open mouth, oxblood robe",
        "a hooded red-robed monk in profile gazing up, cracked Byzantine gold halo",
        "a naive outsider-art red-skinned figure with huge white staring eyes",
        "a Renaissance engraving saint with cracked-parchment skin, one hand raised in warning",
        "a frightened peasant clutching his own face, colorized old-master oil painting",
        "a pale wide-eyed alien-grey humanoid with a solemn stare, painted in old-master style",
        "a bearded prophet with glowing eyes, illuminated-manuscript style",
    ],
    "center_symbol": [
        "a giant blood-red full moon with a single human eye at its center, red veins spreading out",
        "a total solar eclipse — black disc ringed by a blazing corona — over a dark landscape",
        "a glowing gold zodiac wheel with all twelve signs on deep black",
        "twin alchemical sun-face and moon-face sigils flanking a red planet",
        "a red-and-black tarot card (The Tower or The Fool) floating in a starfield",
        "a blood moon rising over a black pine-forest silhouette",
        "a swirling galaxy vortex with a tiny robed figure walking toward it",
        "a great all-seeing eye inside a triangle, rays bursting outward",
    ],
    "right_body": [
        "an anatomical Vitruvian energy-body diagram, 7 chakra dots, a RED CIRCLE + RED ARROW on the THIRD EYE",
        "a nervous-system body chart, a YELLOW ARROW pointing at the CROWN, one chakra circled in red",
        "a standing figure wrapped in glowing energy lines, RED CIRCLE on the heart, red arrow from the side",
        "an occult anatomy engraving, gold sigils along the spine, red arrow at the FOREHEAD",
        "a meditating silhouette with a rainbow chakra column, red circle around the SOLAR PLEXUS",
    ],
    "stickers": [   # sample 2–3 of these — the 'hand-made sticker' chaos
        "a floating glowing-yellow time stamp '11:11'",
        "a floating glowing-yellow time stamp '22:22'",
        "a big glowing gold number '144,000'",
        "a bold gold caption '1 OF 8 BILLION'",
        "a red hand-drawn circle around a tiny figure with 'THIS IS YOU' in small white caps beside it",
        "an extra bold red arrow slashing diagonally across a panel",
        "a hand-scrawled yellow underline stroke beneath the bottom text",
        "a scatter of small gold zodiac glyphs in the margins",
        "a small tarot card tucked into a corner",
        "a glowing all-seeing-eye sticker in a triangle in one corner",
        "a curved yellow arrow linking two panels",
    ],
    "texture": [
        "heavy aged-parchment grain and cracked-paper texture over the whole image",
        "gritty high-contrast print texture with slightly over-saturated reds",
        "a dusty old-book scan look with worn darkened edges",
    ],
}


def _thumb_shotlist(n: int) -> list:
    """Return n DISTINCT random element shot-lists (one per thumbnail variant)."""
    shots = []
    for _ in range(max(1, n)):
        st = random.sample(THUMB_ELEMENTS["stickers"], k=random.randint(2, 3))
        shots.append({
            "layout": random.choice(THUMB_ELEMENTS["layout"]),
            "left_figure": random.choice(THUMB_ELEMENTS["left_figure"]),
            "center_symbol": random.choice(THUMB_ELEMENTS["center_symbol"]),
            "right_body": random.choice(THUMB_ELEMENTS["right_body"]),
            "stickers": st,
            "texture": random.choice(THUMB_ELEMENTS["texture"]),
        })
    return shots


# The reference set the composition is copied from. Folder name is the user's
# (misspelled) one; the correct spelling is accepted too.

# Fixed, exactly like the reference thumbnails. Only the six slots vary, so the
# model cannot reinvent the layout, the tiers or the palette.









# The parts that protect the reference are FIXED here rather than generated, so
# a model can never decide to redraw the man, move him, or change the palette.
# Only the headline and the doodle come from Claude.






def generate_ai_items_from_script(script: str, job: Path, force: bool) -> list:
    """Like generate_ai_quote_items but from a pasted SCRIPT (no SRT/timestamps).
    Used by the standalone 'AI images' tool. time is set to 0 (unused here)."""
    out = job / "ai_items.json"
    if out.exists() and not force:
        log(f"cached: {out.name}")
        return json.loads(out.read_text(encoding="utf-8"))
    log("Claude: picking 10 quotes from the script...")
    items = _json_items(prompts.AI_IMAGES_FROM_SCRIPT_PROMPT.replace("[INSERT SCRIPT HERE]", script),
                        max_tokens=4000)[:NUM_AI_IMAGES]
    norm = [{"time": 0.0, "text": str(it.get("text", "")), "prompt": str(it.get("prompt", ""))}
            for it in items]
    if len(norm) < NUM_AI_IMAGES:
        sys.exit(f"Expected {NUM_AI_IMAGES} items, got {len(norm)}")
    out.write_text(json.dumps(norm, indent=2), encoding="utf-8")
    return norm


def generate_ai_images(items: list, job: Path, force: bool) -> list:
    """Generate the 10 quote images in parallel. Returns [(time_seconds, path)]."""
    img_dir = job / "images"
    img_dir.mkdir(exist_ok=True)
    if _image_provider() == "kie" and not KIE_API_KEY:
        # Only the kie path needs that key: a setup that draws on another
        # service must not stop here before it ever reaches the image call.
        sys.exit("ERROR: KIE_API_KEY missing in .env")

    def one(i: int, item: dict) -> Path:
        dest = img_dir / f"ai_{i:02d}.jpg"
        if dest.exists() and not force:
            return dest
        image_gen(item["prompt"], dest, label=f"ai image {i+1}",
                  kie_create_fn=_kie_create)
        log(f"  ai image {i+1}/{len(items)} done")
        return dest

    results: list = [None] * len(items)
    log(f"kie: generating {len(items)} quote images in parallel...")
    with ThreadPoolExecutor(max_workers=AI_IMG_WORKERS) as ex:
        futs = {ex.submit(one, i, it): i for i, it in enumerate(items)}
        for f in as_completed(futs):
            i = futs[f]
            try:
                results[i] = f.result()
            except Exception as e:
                # One image failing must NOT abort a whole (40-min) video —
                # drop it; the plan builder fills that slot with Pexels b-roll.
                log(f"  ai image {i+1}/{len(items)} FAILED, skip → Pexels: {str(e)[:80]}")
                results[i] = None
    return [(items[i]["time"], results[i]) for i in range(len(items)) if results[i] is not None]


# ════════════════════════════════════════════════════════════════════════════
# Scene visuals  —  AI stills + optional AI video clips
# (Seedance image-to-video). No Pexels; the whole video is generated art.
# ════════════════════════════════════════════════════════════════════════════
def _kie_still_with_url(prompt: str, dest: Path, label: str, retries: int = 4) -> str:
    """Generate a still (nano-banana), download it, AND return the kie-hosted source
    URL — needed as the first frame for image-to-video animation."""
    last = None
    for attempt in range(1, retries + 1):
        try:
            url = _kie_poll(_kie_create(prompt))
            _download(url, dest)
            return url
        except (RuntimeError, TimeoutError, requests.exceptions.RequestException) as e:
            last = e
            if attempt < retries:
                wait = min(60, 12 * attempt)
                log(f"  kie {label}: failed (attempt {attempt}/{retries}), retrying in {wait}s — {str(e)[:70]}")
                time.sleep(wait)
    raise RuntimeError(f"kie {label} failed after {retries} attempts: {last}")


def _kie_video_create(image_url: str, prompt: str) -> str:
    """Start a Seedance image-to-video job from a first-frame image URL."""
    r = requests.post(f"{KIE_BASE}/createTask", headers=_kie_headers(),
                      json={"model": KIE_VIDEO_MODEL,
                            "input": {"prompt": prompt[:5000], "image_url": image_url,
                                      "resolution": KIE_VIDEO_RES, "duration": str(KIE_VIDEO_DUR)}},
                      timeout=60)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 200:
        raise RuntimeError(f"kie video createTask error: {data}")
    return data["data"]["taskId"]


def _kie_video_gen(image_url: str, prompt: str, dest: Path, label: str, retries: int = 4) -> None:
    """create -> poll -> download a Seedance clip, retrying transient kie failures.
    Video jobs are slower than images, so we poll with a longer timeout."""
    last = None
    for attempt in range(1, retries + 1):
        try:
            _download(_kie_poll(_kie_video_create(image_url, prompt), timeout_s=900), dest)
            return
        except (RuntimeError, TimeoutError, requests.exceptions.RequestException) as e:
            last = e
            if attempt < retries:
                wait = min(60, 12 * attempt)
                log(f"  kie {label}: failed (attempt {attempt}/{retries}), retrying in {wait}s — {str(e)[:70]}")
                time.sleep(wait)
    raise RuntimeError(f"kie {label} failed after {retries} attempts: {last}")


# Narrator styles whose visuals are SCENE-based (Claude designs a pool of image
# prompts from the script) rather than quote-image based. One entry per style:
# (scene prompt, look suffix appended to every still, motion suffix for clips).
def _scene_prompts(style: str):
    """(scene_prompt, still_suffix, video_motion) for a channel.

    One engine prompt serves every channel; what makes the stills look like a
    particular channel is the suffix, which the style file supplies. Before
    this, adding a channel meant writing three new prompt constants and wiring
    them into a table.
    """
    st = STYLE_INFO.get(style) or {}
    look = st.get("look") or {}
    scene = (look.get("scene_prompt") or prompts.SCENE_PROMPT).replace(prompts.CHANNEL_TOKEN, _channel_brief(style))
    # A story channel lives on the SAME face coming back in every picture. The
    # cast is pasted into the art-director prompt with the instruction to copy it
    # word for word into each image prompt — an image model has no memory of the
    # last frame, so consistency has to be re-stated every single time.
    cast = (_CHARACTER or STYLE_CHARACTER.get(style) or "").strip()
    if cast:
        scene += ("\n\nTHE CAST — these people recur through the whole video:\n" + cast +
                  "\n\nWhenever one of them is in frame, copy their description into the prompt"
                  " WORD FOR WORD, every time. Anyone else who appears more than once: decide"
                  " their look the first time and repeat those same words afterwards." +
                  # A story follows one person, so they are never left out of a frame;
                  # other channels do better with some scenes that have nobody in them.
                  (" The main character is in EVERY frame — in a close-up, at least their hand,"
                   " sleeve or shoulder in the foreground." if STYLE_PLACEMENT.get(style) == "story" else
                   " Scenes with no people (an object, a room, a street) are welcome and should be"
                   " about a third of the set."))
    return (scene,
            look.get("still_suffix") or prompts.SCENE_STYLE_SUFFIX,
            look.get("video_motion") or prompts.SCENE_VIDEO_MOTION)


def _story_parts(script: str, parts: int) -> list:
    """The script cut into `parts` runs of whole sentences of about equal length."""
    sents = [x.strip() for x in re.split(r"(?<=[.!?…])\s+", script.strip()) if x.strip()]
    if parts <= 1 or len(sents) <= parts:
        return [script.strip()]
    total = sum(len(x.split()) for x in sents)
    out, cur, done = [], [], 0
    for x in sents:
        cur.append(x)
        done += len(x.split())
        if len(out) < parts - 1 and done >= total * (len(out) + 1) / parts:
            out.append(" ".join(cur))
            cur = []
    if cur:
        out.append(" ".join(cur))
    return out


def _storyboard(scene_prompt: str, script: str, count: int, every: float = 5.5) -> list:
    """[(narration, image prompt)] — about `count` frames covering the script in order.

    A long video is drawn in parts of about STORY_CHUNK_FRAMES frames, because two
    hundred frames in one reply is more JSON than a model hands back intact. Every
    part sees the whole story and the last frames before it, so the kitchen set up
    in part one is still the same kitchen in part three."""
    # A frame per sentence let one long line hold a picture for ten seconds and a
    # string of short ones flick past in two, so the pace is given as words: the
    # narration runs at about 2.5 words a second.
    words = max(6, round(float(every) * 2.5))
    pacing = (f"PACING: each frame covers about {words} words of narration — about {float(every):.0f} "
              f"seconds spoken. Split a long sentence across two or three frames; join very short "
              f"sentences into one. No frame covers more than {round(words * 1.5)} words or fewer than "
              f"{max(4, words // 2)}.\n\n"
              f"SHOW WHAT IS SAID: each frame is a literal picture of ITS OWN narration — the exact object, "
              f"place, person, action, number and era those words name, so someone watching with the sound "
              f"off could say what is being told. Never a generic mood picture, never a stand-in for the thing "
              f"named, and never the same composition, place or angle twice in the video.\n\n")
    parts = _story_parts(script, max(1, math.ceil(count / max(8, STORY_CHUNK_FRAMES))))
    sizes = [max(1, len(x.split())) for x in parts]
    frames, prev = [], []
    for k, part in enumerate(parts):
        n = max(1, round(count * sizes[k] / sum(sizes)))
        body = pacing + scene_prompt.replace("[INSERT COUNT HERE]", str(n)).replace("[INSERT SCRIPT HERE]", part) + _extra_block()
        if len(parts) > 1:
            lead = (f"This storyboard is drawn in {len(parts)} parts and you are drawing PART {k + 1}. "
                    f"Its {n} frames cover ONLY the narration under SCRIPT at the very end, from its "
                    f"first line to its last.\n\nTHE WHOLE STORY, for context only — people, places and "
                    f"objects must look the way they did in the parts before:\n{script[:40000]}\n\n")
            if prev:
                lead += ("THE LAST FRAMES OF THE PART BEFORE — carry straight on from them:\n"
                         + "\n".join(f"- {x}" for x in prev[-4:]) + "\n\n")
            body = lead + body
            log(f"  storyboard part {k + 1}/{len(parts)}: {n} frames")
        got = []
        for it in _json_items(body, max_tokens=max(6000, n * 320)):
            if isinstance(it, dict):
                pr = str(it.get("prompt") or it.get("scene") or it.get("image") or "").strip()
                if pr:
                    got.append((str(it.get("text") or it.get("line") or "").strip(), pr))
            elif isinstance(it, str) and it.strip():
                got.append(("", it.strip()))
        if len(got) < n:
            log(f"  storyboard: asked for {n} frames, got {len(got)} — each will hold a little longer")
        got = got[:math.ceil(n * 1.2)]
        frames.extend(got)
        prev = [x for _, x in got]
    return frames[:STORY_MAX_STILLS]


def generate_astrology_scene_items(script: str, job: Path, force: bool, count: int,
                                   style: str = "") -> list:
    """Claude designs `count` esoteric SCENE prompts from the script. The shared
    STYLE SUFFIX is appended here so every scene keeps the same look."""
    out = job / "astro_scenes.json"
    if out.exists() and not force:
        log(f"cached: {out.name}")
        return json.loads(out.read_text(encoding="utf-8"))
    scene_prompt, style_suffix, _ = _scene_prompts(style)
    if STYLE_PLACEMENT.get(style) == "story":
        # A story is never padded with repeats — a recycled picture reads as a
        # mistake — so fewer frames than asked simply hold a little longer each.
        log(f"Claude: storyboarding {count} {style} frames from the script...")
        norm = [{"text": t, "prompt": p + style_suffix}
                for t, p in _storyboard(scene_prompt, script, count, STYLE_PHOTO_EVERY.get(style) or 5.5)]
        if not norm:
            sys.exit(f"{style}: Claude returned no frames")
        out.write_text(json.dumps(norm, indent=2), encoding="utf-8")
        return norm
    log(f"Claude: designing {count} {style} scenes from the script...")
    # 45+ scene prompts is a long JSON — kie would truncate it, so _json_items falls
    # back to Anthropic. Bigger token budget for the larger pool.
    items = _json_items(scene_prompt
                        .replace("[INSERT COUNT HERE]", str(count))
                        .replace("[INSERT SCRIPT HERE]", script) + _extra_block(),
                        max_tokens=max(6000, count * 120))
    norm = []
    for it in items:
        # Either shape is accepted: a bare prompt string, or an object carrying
        # the prompt plus the line of narration it belongs to. Models drift
        # between the two whatever the prompt asks for, and a scene pool is too
        # expensive to throw away over a formatting preference.
        if isinstance(it, str):
            pr, txt = it.strip(), ""
        elif isinstance(it, dict):
            pr = str(it.get("prompt") or it.get("scene") or it.get("image") or "").strip()
            txt = str(it.get("text") or it.get("line") or "")
        else:
            continue
        if pr:
            norm.append({"text": txt, "prompt": pr + style_suffix})
    if not norm:
        sys.exit(f"{style}: Claude returned no scenes")
    base = list(norm)  # pad by cycling if Claude returned fewer than asked
    i = 0
    while len(norm) < count:
        norm.append(dict(base[i % len(base)]))
        i += 1
    norm = norm[:count]
    out.write_text(json.dumps(norm, indent=2), encoding="utf-8")
    return norm


def generate_astrology_visuals(script: str, job: Path, force: bool,
                               style: str = "", minutes: int = 0) -> tuple:
    """Generate the still-image pool (nano-banana) and the AI video-clip pool
    (Seedance image-to-video) that fill an astrology video. Returns (stills, clips)."""
    img_dir = job / "images"
    img_dir.mkdir(exist_ok=True)
    vsrc_dir = job / "clip_src"        # hidden first-frames for animation (never shown as photos)
    vsrc_dir.mkdir(exist_ok=True)
    vid_dir = job / "clips"
    vid_dir.mkdir(exist_ok=True)
    if _image_provider() == "kie" and not KIE_API_KEY:
        # Only the kie path needs that key: a setup that draws on another
        # service must not stop here before it ever reaches the image call.
        sys.exit("ERROR: KIE_API_KEY missing in .env")

    # The pool was fixed at 45 regardless of runtime, so a 5-minute video paid the
    # same image bill as a 25-minute one. Roughly two stills per minute, capped.
    photo_n = (max(1, min(ASTRO_STILL_POOL, int(round((minutes or 20) * _mix_stills_per_min()))))
               if minutes else ASTRO_STILL_POOL)
    every = STYLE_PHOTO_EVERY.get(style)
    if not every and not feature("ai_images"):
        log("AI images are off in Options — no pictures drawn")
        return [], []
    if every:
        # A story shows a NEW picture every few seconds and never shows one twice,
        # so the pool is the number of beats in the narration — estimated from the
        # script at a spoken 150 words a minute — not a per-minute allowance.
        est_s = max(30.0, len(script.split()) / 2.5)
        photo_n = max(4, min(STORY_MAX_STILLS, int(math.ceil(est_s / float(every)))))
        log(f"story: one still per {float(every):.1f}s of narration -> {photo_n} unique stills")
    video_n = 0 if every else max(0, ASTRO_VIDEO_POOL)   # a story is stills only
    # DISJOINT pools: the first video_n scenes are animated (shown ONLY as video),
    # the next photo_n are shown ONLY as photos. A still is never both.
    items = generate_astrology_scene_items(script, job, force, photo_n + video_n, style)
    video_items = items[:video_n]
    photo_items = items[video_n:video_n + photo_n]

    photos: list = [None] * len(photo_items)
    vpaths: list = [None] * len(video_items)  # hidden first-frames
    vurls: list = [None] * len(video_items)

    # The main character's picture rides along as the reference on EVERY still:
    # words alone let the face drift from one frame to the next. Put online once
    # per job, and only when there is something left to draw.
    refs = []
    face = character_image_path(style)
    if face is not None and (force or any(not (img_dir / f"scene_{i:02d}.jpg").exists()
                                          for i in range(len(photo_items)))):
        refs = _character_refs(style)
        log(f"  character: {face.name} is the reference on every still" if refs else
            "  ⚠ could not put the character picture online — the stills follow the written description alone")

    out_of_credits: list = []
    srefs = _style_refs(style)
    if srefs:
        log("  style: the channel's reference drawing rides along on every still")

    def gen_still(kind: str, i: int, it: dict):
        if kind == "photo":
            dest = img_dir / f"scene_{i:02d}.jpg"
            if dest.exists() and not force:
                return kind, i, dest, None
            # a story's character is in every frame; the AI presenter is in two or three of them, and their
            # photo on an airplane-window still would put them in the window
            use = refs if (refs and (not _CAST_FROM_AVATAR or _shows_presenter(it["prompt"]))) else []
            prompt = (REF_ONLY_CHARACTER + it["prompt"]) if use else it["prompt"]
            if srefs:
                prompt = STYLE_REF_NOTE + prompt
            try:
                image_gen(prompt, dest, f"picture {i+1}", ref_urls=srefs + use, kie_create_fn=_kie_create)
                return kind, i, dest, None
            except AIImageCapReached as e:
                log(f"  {str(e)[:90]} — the slot gets real footage")
                return kind, i, None, None
            except CreditsError as e:
                out_of_credits.append(str(e))
                return kind, i, None, None
            except RuntimeError as e:
                if e.__class__.__module__ == "atlascloud":
                    # Atlas jobs are paid once submission begins. A timeout,
                    # missing output or download error must not be retried with
                    # a second paid POST under a plainer prompt.
                    log(f"  image {i+1} failed on Atlas — skipping without resubmitting: {str(e)[:70]}")
                    return kind, i, None, None
                # a refused prompt (brand names, quoted screen text, sums) gets one more go, plainer
                plain = _plain_prompt(prompt)
                if plain != prompt:
                    log(f"  image {i+1} refused ({str(e)[-60:]}) — once more without names, quotes and sums")
                    try:
                        image_gen(plain, dest, f"picture {i+1}", ref_urls=srefs + use, kie_create_fn=_kie_create)
                        return kind, i, dest, None
                    except CreditsError as e2:
                        out_of_credits.append(str(e2))
                        return kind, i, None, None
                    except RuntimeError as e2:
                        e = e2
                log(f"  image {i+1} failed, skipping — {str(e)[:70]}")
                return kind, i, None, None
        dest = vsrc_dir / f"vsrc_{i:02d}.jpg"
        ucache = vsrc_dir / f"vsrc_{i:02d}.url"
        if dest.exists() and ucache.exists() and not force:
            return kind, i, dest, ucache.read_text(encoding="utf-8").strip()
        try:
            url = _kie_still_with_url(it["prompt"], dest, f"video-still {i+1}")
            ucache.write_text(url, encoding="utf-8")
            return kind, i, dest, url
        except RuntimeError as e:
            log(f"  video-still {i+1} failed, skipping — {str(e)[:70]}")
            return kind, i, None, None

    jobs = ([("photo", i, it) for i, it in enumerate(photo_items)] +
            [("vsrc", i, it) for i, it in enumerate(video_items)])
    log(f"images: generating {len(photo_items)} stills + {len(video_items)} video-stills in parallel...")
    with ThreadPoolExecutor(max_workers=AI_IMG_WORKERS) as ex:
        futs = [ex.submit(gen_still, k, i, it) for k, i, it in jobs]
        for f in as_completed(futs):
            kind, i, path, url = f.result()
            if kind == "photo":
                photos[i] = path
            else:
                vpaths[i], vurls[i] = path, url

    missing = sum(1 for p in photos if not p)
    if every and missing and (out_of_credits or missing > max(1, int(len(photos) * 0.34))):
        # A story with holes is not a story: a line would lose its picture and the
        # one before would hold over words it was never drawn for. Stop before the
        # plan exists; every finished picture stays on disk, so running the same
        # title again draws only the missing ones.
        sys.exit((out_of_credits[0] + f" ({len(photos) - missing} of {len(photos)} pictures are done.)")
                 if out_of_credits else
                 f"{missing} of {len(photos)} story pictures could not be made (see above). Run the same "
                 f"title again — the {len(photos) - missing} finished ones are kept.")
    if every and missing:
        log(f"  ⚠ {missing} of {len(photos)} pictures could not be made — the footage covers those lines")
    if out_of_credits:
        log(f"  ⚠ {out_of_credits[0]} Carrying on with the {len(photos) - missing} pictures made.")

    # Animate the video-stills into clips (skip ones whose first-frame failed).
    clips: list = [None] * len(video_items)

    def animate(i: int):
        if not vurls[i]:
            return None
        dest = vid_dir / f"clip_{i:02d}.mp4"
        if dest.exists() and not force:
            return dest
        try:
            motion = video_items[i]["prompt"] + _scene_prompts(style)[2]
            _kie_video_gen(vurls[i], motion, dest, f"clip {i+1}")
            return dest
        except RuntimeError as e:
            log(f"  clip {i+1} failed, skipping — {str(e)[:70]}")
            return None

    if video_n:
        log(f"animating {video_n} clips (image-to-video)...")
        with ThreadPoolExecutor(max_workers=min(AI_IMG_WORKERS, video_n)) as ex:
            futs = {ex.submit(animate, i): i for i in range(len(video_items))}
            done = 0
            for f in as_completed(futs):
                clips[futs[f]] = f.result()
                done += 1
                log(f"  clips {done}/{video_n}")

    photos = [p for p in photos if p]
    videos = [c for c in clips if c]
    if not photos and not videos:
        # Generation can fail wholesale — running out of image credits does it —
        # while an earlier pass already left perfectly good stills on disk.
        # Losing the whole video over that is far worse than making it with the
        # pictures we already have.
        leftover = sorted(img_dir.glob("*.jpg"))
        if leftover:
            log(f"  ⚠ still generation failed, using the {len(leftover)} already on disk")
            photos = leftover
        else:
            sys.exit("no visuals were generated at all "
                     "(and images/ is empty — check your image-provider credit)")
    log(f"{style} visuals: {len(photos)} stills, {len(videos)} AI clips")
    return photos, videos


ASTRO_PEXELS_QUERIES = [
    "night sky stars", "nebula", "aurora borealis", "ocean waves aerial", "clouds timelapse",
    "golden hour light", "full moon", "misty forest", "cosmos galaxy", "candle flame",
    "sunrise mountains", "northern lights", "starfield", "sun flare", "calm sea",
]


# Per-channel stock-footage pools. Cosmic b-roll would wreck a teaching video, so
# each scene-based style searches for its own kind of atmosphere.
STYLE_PEXELS_QUERIES: dict = {}   # fallback searches per channel, from its style file


class _Bag:
    """Hand out a pool in a shuffled order, reshuffling once it runs dry.

    A plain `pool[i % len(pool)]` walks the same ring in the same order forever,
    so with a pool smaller than the number of slots the viewer sees the exact
    same run of clips again and again. Drawing from a bag instead spreads every
    repeat as far apart as the pool allows, and reshuffles so the second lap
    does not replay the first. The RNG is seeded, so a re-render is identical.
    """

    def __init__(self, items, seed: int = 0, repeat: bool = True):
        self.items = list(items)
        self.repeat = repeat
        self.rng = random.Random(seed or 1)
        self._fill()
        self.last = None

    def _fill(self):
        self.bag = list(self.items)
        self.rng.shuffle(self.bag)

    def take(self):
        if not self.items:
            return None
        if not self.bag:
            if not self.repeat:
                return None
            self._fill()
            # never start a new lap with the clip that just played
            if len(self.bag) > 1 and self.bag[0] == self.last:
                self.bag.append(self.bag.pop(0))
        self.last = self.bag.pop(0)
        return self.last


BROLL_PER_MIN = int(os.environ.get("BROLL_PER_MIN", "3"))
# One stock search per ~15s of narration, not per minute — a minute holds a
# single image, and it came from whatever the minute mentioned first. Capped
# so a long video stays well inside Pexels' hourly request limit; the window
# widens instead. One matched clip per window matches the footage slot rate
# (about one real clip every 15s), so the fetch downloads no more than before.
BROLL_WINDOW_S = int(os.environ.get("BROLL_WINDOW_S", "15"))
BROLL_MAX_QUERIES = int(os.environ.get("BROLL_MAX_QUERIES", "40"))
BROLL_PER_WINDOW = int(os.environ.get("BROLL_PER_WINDOW", "1"))


def _to_english(prompt: str) -> str:
    """Rewrite a Czech-targeted prompt so it asks for English.

    Appending an override at the END does not work: the model reads a prompt
    whose body demands Czech, sees a contradicting line at the bottom, and
    (reasonably) refuses — the last run opened its reply with a note about the
    conflict and then wrote Czech anyway. The instruction has to be changed
    where it is actually given.
    """
    out = prompt
    for a, b in (
        ("narrated in CZECH", "narrated in ENGLISH"),
        ("will be narrated in CZECH", "will be narrated in ENGLISH"),
        ("write THIS OUTLINE IN CZECH as well", "write THIS OUTLINE IN ENGLISH as well"),
        ("the full spoken SCRIPT (in Czech)", "the full spoken SCRIPT (in English)"),
        ("in Czech", "in English"),
        ("in CZECH", "in ENGLISH"),
        ("Czech", "English"),
        ("česky", "in English"),
        ("v češtině", "in English"),
    ):
        out = out.replace(a, b)
    # The header goes FIRST. A language rule at the bottom reads as a late
    # contradiction of everything above it; at the top it is simply the brief,
    # and the Czech instruction text that follows reads as style guidance for a
    # translated version of the same show.
    head = (
        "LANGUAGE — READ THIS FIRST: this episode is for the ENGLISH-language\n"
        "edition of the channel. Write every word you produce in ENGLISH: the\n"
        "outline, all headings, the entire script, every quoted line.\n"
        "Some instructions below are written in Czech and give Czech example\n"
        "phrasings, because they were authored for the Czech edition. Follow\n"
        "what they ask for — the tone, the structure, the pacing, the subject\n"
        "matter — but express all of it in English. Never output Czech text.\n"
        "This is not a conflict to flag; it is the brief.\n\n"
        "----- BRIEF -----\n\n")
    return head + out


def _lang_prompt(prompt: str, style: str) -> str:
    """The prompt with the channel's language stated at the top.

    Nothing about language is left implicit. A prompt that never names one lets
    the model pick, and it does: an English Jung brief with the language line
    removed came back written in Romanian. The instruction goes FIRST, because
    a rule at the end of a long brief loses to everything above it.
    """
    if os.environ.get("FORCE_ENGLISH") == "1":
        prompt, lang = _to_english(prompt), "English"
    else:
        lang = STYLE_LANGUAGE.get(style) or "English"
    lang = lang.split("(")[0].strip() or "English"
    return (f"LANGUAGE — THIS OVERRIDES EVERYTHING BELOW: write your entire "
            f"output in {lang}. Every word, every heading, every quote is in "
            f"{lang}. No other language appears anywhere in your answer.\n\n"
            + prompt)


def _lang_suffix(style: str) -> str:      # kept: call sites append it
    return ""


def generate_broll_queries(script: str, job: Path, force: bool,
                           style: str = "") -> list:
    """One stock-search query per minute, written FROM the narration.

    This is what ties the footage to the words: the pool used to be fetched
    from a fixed per-style list, so a minute about a ship got whatever the
    shuffle happened to deal. Now each minute names its own imagery and the
    clips are searched for it directly.
    """
    out = job / "broll_queries.json"
    if out.exists() and not force:
        return json.loads(out.read_text(encoding="utf-8"))
    words = (script or "").split()
    if not words:
        return []
    # A query per WINDOW of narration. One per minute took its imagery from the
    # first thing the minute mentioned and held it for sixty seconds: a script
    # that opens in a parked car showed nothing but cars while the narrator had
    # long since moved on to anger, Jung and the shadow.
    est_s = len(words) / float(WPM) * 60.0
    win_s = max(BROLL_WINDOW_S, int(math.ceil(est_s / max(1, BROLL_MAX_QUERIES))))
    per = max(8, int(round(WPM * win_s / 60.0)))            # words per window
    n = max(1, int(math.ceil(len(words) / per)))
    chunks = [" ".join(words[i * per:(i + 1) * per]) for i in range(n)]
    body = "\n\n".join(f"WINDOW {i+1} ({int(i*win_s)//60}:{int(i*win_s)%60:02d}):\n"
                        f"{(chunks[i].strip() or '(quiet)')[:600]}" for i in range(n))
    log(f"Claude: writing b-roll searches for {n} stretches of ~{win_s}s...")
    _taste = str(((STYLE_INFO.get(style) or {}).get("look") or {}).get("footage_taste") or "").strip()
    taste = f"• THE LOOK OF THIS CHANNEL: {_taste}\n" if _taste else ""
    items = _json_items(f"""For each window of narration below, write ONE stock-footage search query.

Rules:
• 2-4 words, ENGLISH, concrete and VISUAL — something a camera can film:
  "man walking alone night", "stormy ocean waves", "hands writing letter".
• Follow what the narrator is TALKING ABOUT in that window, not the first noun
  it happens to mention. A window that passes through a parked car on its way
  to talking about anger wants anger — "clenched jaw close up" — not a car.
• Consecutive windows must look DIFFERENT: change the subject, the setting and
  the distance (wide / middle / close). Never the same subject twice in a row.
• A window where the narrator asks the viewer to subscribe or comment is NOT
  filmed literally — no buttons, phones or screens. Give the mood of the ideas
  around it instead.
• Common subjects that stock libraries actually have. No people's names, no
  brands, no text on screen.
{taste}
Return ONLY a JSON array of {n} objects: [{{"q": "..."}}]

{body}""" + _extra_block(), max_tokens=max(1400, n * 40))
    qs = []
    for i in range(n):
        q = str((items[i] if i < len(items) else {}).get("q", "")).strip()
        if not q:
            raise ValueError(f"No contextual b-roll search for narration window {i + 1}; generic filler is disabled.")
        qs.append({"w": i, "win_s": win_s, "q": q})
    out.write_text(json.dumps(qs, indent=1), encoding="utf-8")
    for x in qs[:12]:
        t = int(x["w"] * win_s)
        log(f"  {t // 60}:{t % 60:02d}  {x['q']}")
    return qs


def fetch_astro_pexels_videos(job: Path, force: bool, n: int, style: str = "") -> list:
    """Fetch a small pool of aesthetic Pexels stock VIDEOS for the 2nd half of an
    video. Respects the global used-ID registry so they don't repeat."""
    if n <= 0:
        return []
    pex_dir = job / "pexels"
    pex_dir.mkdir(exist_ok=True)
    manifest = job / "astro_pexels.json"
    if manifest.exists() and not force:
        return [Path(p) for p in json.loads(manifest.read_text(encoding="utf-8")) if Path(p).exists()]
    if not PEXELS_API_KEY:
        return []

    order = _load_used_pexels_order()
    used = set(order)
    age = {vid: i for i, vid in enumerate(order)}      # lower = used longer ago
    seen: set = set()
    picks: list = []      # (id, url) — fresh footage
    tags: dict = {}       # picks index -> minute this clip was searched FOR
    stale: list = []      # (age, id, url, window) — used in other videos, never twice here
    query_rows = []

    # Narration-matched phase: every minute's own query gets first call on the
    # pool, so the shot on screen is the shot the words asked for.
    mq = job / "broll_queries.json"
    if mq.exists():
        try:
            query_rows = json.loads(mq.read_text(encoding="utf-8"))
            for row in query_rows:
                got = 0
                # Enough distinct contextual shots to cover this window at normal pacing.
                want = max(BROLL_PER_WINDOW, math.ceil(float(row.get("win_s") or BROLL_WINDOW_S) / ASTRO_VIDEO_SLOT))
                data = _pexels_get("https://api.pexels.com/videos/search",
                                   {"query": row.get("q", ""), "per_page": 10,
                                    "orientation": "landscape"})
                for v in data.get("videos", []):
                    vid = v.get("id")
                    link = _pick_video_file(v) if vid and vid not in seen else None
                    if not link:
                        continue
                    seen.add(vid)
                    if vid in used:
                        stale.append((age.get(vid, 0), vid, link, int(row.get("w", -1))))
                        continue          # matched clips should be fresh ones
                    tags[len(picks)] = int(row.get("w", row.get("minute", -1)))
                    picks.append((vid, link))
                    got += 1
                    if got >= want:
                        break
        except (ValueError, OSError) as e:
            log(f"  b-roll queries unreadable, continuing without matching: {str(e)[:60]}")
    if tags:
        log(f"Pexels: {len(tags)} clips searched straight from the narration")
    matched_count = len(picks)

    # When narration queries exist, keep the reserve contextual too. Generic
    # channel defaults (e.g. oceans/stars) cannot fill a machining story.
    queries = ([(r["q"], int(r.get("w", -1))) for r in query_rows if r.get("q")]
               if query_rows else [(q, -1) for q in STYLE_PEXELS_QUERIES.get(style, ASTRO_PEXELS_QUERIES)])
    random.shuffle(queries)
    for q, window in queries:
        if len(picks) >= n:
            break
        # per_page was 6, which — after the used-ID filter — often left a pool far
        # smaller than asked for, and a small pool is exactly what makes the same
        # clips come round again.
        data = _pexels_get("https://api.pexels.com/videos/search",
                           {"query": q, "per_page": 20, "orientation": "landscape",
                            "page": random.randint(1, 4)})
        for v in data.get("videos", []):
            vid = v.get("id")
            if not vid or vid in seen:
                continue
            link = _pick_video_file(v)
            if not link:
                continue
            seen.add(vid)
            if vid in used:
                stale.append((age.get(vid, 0), vid, link, window))
            else:
                if window >= 0:
                    tags[len(picks)] = window
                picks.append((vid, link))
        # keep sweeping every query even once the fresh quota is met — the extra
        # candidates are what make a reuse fall on something genuinely old
        if len(picks) >= n:
            break
    if len(picks) < n and stale:
        # Not enough new footage exists for this style any more. Rather than hand
        # back a three-clip pool, top it up with the clips used longest ago.
        stale.sort()
        need = n - len(picks)
        for _, vid, link, window in stale[:need]:
            if window >= 0:
                tags[len(picks)] = window
            picks.append((vid, link))
        log(f"Pexels: only {n - need} fresh clips, topping up with {min(need, len(stale))} "
            f"least recently used")
    picks = picks[:max(n, matched_count)]
    tags = {i: w for i, w in tags.items() if i < len(picks)}

    res: list = [None] * len(picks)

    def dl(i: int, item):
        d = pex_dir / f"apex_{i:02d}.mp4"
        if d.exists() and not force:
            return None if _clip_is_black(d) else d
        try:
            _download(item[1], d)
        except Exception:
            return None
        if _clip_is_black(d):                     # a clip that is black nearly all the way through is no footage
            log(f"  Pexels: {d.name} is black — dropped (kept in rejected/ for review)")
            keep_rejected(d, job, "too-dark")
            return None
        return d

    if picks:
        log(f"Pexels: downloading {len(picks)} contextual clips...")
        with ThreadPoolExecutor(max_workers=DL_WORKERS) as ex:
            futs = {ex.submit(dl, i, it): i for i, it in enumerate(picks)}
            for f in as_completed(futs):
                res[futs[f]] = f.result()
    out = [r for r in res if r]
    tagmap = {res[i].name: m for i, m in tags.items() if res[i]}
    (job / "broll_tags.json").write_text(json.dumps(tagmap, indent=1), encoding="utf-8")
    _save_used_pexels(used, fresh=[pid for pid, _ in picks])
    manifest.write_text(json.dumps([str(p) for p in out]), encoding="utf-8")
    return out


# Real clips from YouTube cut to the length of their shot, not to a slot: a slot that
# shows one plays it for as long as the shot really lasts (see _footage_seconds).
YT_SLOT_MIN = float(os.environ.get("YT_SLOT_MIN", "1.5"))
YT_SLOT_MAX = float(os.environ.get("YT_SLOT_MAX", "7.0"))
YT_PUSH = float(os.environ.get("YT_PUSH", "0.035"))        # the slow push on a real clip


def _broll_win_s(job: Path) -> float:
    """The width of one stretch of narration the footage was searched for."""
    try:
        rows = json.loads((job / "broll_queries.json").read_text(encoding="utf-8"))
        return float((rows[0] if rows else {}).get("win_s") or BROLL_WINDOW_S)
    except (ValueError, OSError, AttributeError, IndexError, TypeError):
        return float(BROLL_WINDOW_S)


def fetch_footage(script: str, job: Path, force: bool, style: str = "", title: str = "") -> list:
    """Every clip for the footage slots, in one pool: real YouTube footage when Options has it on
    (youtube.py), Pexels stock when that is on. Each clip is tagged with the stretch of narration
    it was found for (broll_tags.json), so the timeline puts it under its own words — and a
    YouTube clip always goes first when one was found for the moment."""
    rows = []
    with ThreadPoolExecutor(max_workers=2) as ex:
        fs = ex.submit(fetch_astro_pexels_videos, job, force, _mix_pexels_pool(), style)
        fy = None
        if _FEATURES.get("youtube"):
            import youtube
            fy = ex.submit(youtube.fetch_clips, sys.modules[__name__], script, job, style, force, title)
        stock = fs.result()
        try:
            rows = fy.result() if fy else []
        except Exception as e:                         # noqa: BLE001 - footage is never worth the video
            log(f"YouTube footage failed, continuing without it: {str(e)[:160]}")
            rows = []
    if not rows:
        return stock
    tf = job / "broll_tags.json"
    tags = {}
    if stock and tf.exists():
        try:
            tags = json.loads(tf.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            tags = {}
    win_s = _broll_win_s(job)
    for r in rows:
        tags[Path(r["path"]).name] = int(float(r["t"]) // win_s)
    tags["_win_s"] = win_s
    tf.write_text(json.dumps(tags, indent=1), encoding="utf-8")
    (job / "footage_seconds.json").write_text(
        json.dumps({Path(r["path"]).name: float(r["dur"]) for r in rows}, indent=1), encoding="utf-8")
    return [Path(r["path"]) for r in rows] + list(stock)


def _directed(style: str) -> bool:
    """Whether a channel's scenes are planned by one director (look.director, director.py)."""
    return bool(((STYLE_INFO.get(style) or {}).get("look") or {}).get("director")) and (HERE / "director.py").exists()


_SCENE_WORK = ("director_review.json", "director.json", "overlays.json", "motion", "maps", "headlines", "photofx", "vox_scenes",
               "war_chess", "plan.json", "plan_meta.json", "segments", "footage_again.json", "soundbites", "soundbites.json",
               "heygen/moments.json", "heygen/effective_policy.json")
_STYLE_NOW = ""                     # the channel a director plan is being made for (director.tools_on)


def _clear_scene_work(job: Path) -> None:
    """Redo everything, for a directed channel: the plan and every tool's scenes go, so the director
    plans afresh and the tools build from its plan instead of re-planning on their own."""
    for name in _SCENE_WORK:
        p_ = job / name
        if p_.is_dir():
            shutil.rmtree(p_, ignore_errors=True)
        else:
            p_.unlink(missing_ok=True)


def _prewarm_scene_plans(srt: Path, job: Path, style: str) -> None:
    """While the YouTube footage is still being cut: the Claude calls the scene modules would otherwise
    make one after another — the graphics design, the places for maps, the claims and pages for
    headlines, the people and things for photos — side by side. Each writes its own cache, so the
    timeline step finds its plan waiting. Anything that fails here simply runs again later."""
    engine = sys.modules[__name__]
    total = _audio_dur(job / "audio.mp3")
    tasks = []
    look = (STYLE_INFO.get(style) or {}).get("look") or {}
    if _directed(style):
        # One director plans every tool at once (director.py). Then every scene module builds its scenes
        # from that plan straight away — maps, pages, photos, collage — side by side, while the footage is
        # still being cut. The timeline step later finds them rendered and only fits them together.
        try:
            import director
            director.plan(engine, srt, job, style)
        except (Exception, SystemExit) as e:      # noqa: BLE001 - only a head start
            log(f"  director: planned later instead — {str(e)[:120]}")
            return
        import importlib
        names = [n for n in SCENE_DLCS if n not in _DLC_OFF and (HERE / f"{n}.py").exists()
                 and n != "heygen_scenes"  # paid shots wait for actual DLC collisions, not speculative prewarm
                 and not (n == "vox" and not _FEATURES.get("vox"))]

        def build(name):
            try:
                importlib.import_module(name).add_to_timeline([], srt, job, style, False, workers=2, engine=engine)
            except (Exception, SystemExit) as e:  # noqa: BLE001
                log(f"  {name}: built later instead — {str(e)[:120]}")
        # the chapter cards sit on the real photographs the photo module finds: they are built once it is done
        first, after = [n for n in names if n != "cinema"], [n for n in names if n == "cinema"]
        if first:
            log(f"building {', '.join(first)} while the footage is cut...")
            with ThreadPoolExecutor(max_workers=len(first)) as ex:
                list(ex.map(build, first))
        for n in after:
            build(n)
        return
    if (str(look.get("graphics") or "").lower() == "documentary" and _FEATURES.get("motion")
            and style not in STYLE_NO_GRAPHICS and (HERE / "docgfx.py").exists()):
        import docgfx
        step = max(30.0, float(STYLE_EVERY_MIN.get(style) or 0) * 60.0 or 45.0)
        tasks.append(("graphics", lambda: docgfx.design(engine, srt, job, total, False, style, step)))
    elif (str(look.get("graphics") or "").lower() == "kit" and _FEATURES.get("motion")
            and style not in STYLE_NO_GRAPHICS and (HERE / "kits.py").exists()):
        # a look kit (kits.py) designs its own graphics — the same per-part design, in the kit's language
        import kits
        step = max(30.0, float(STYLE_EVERY_MIN.get(style) or 0) * 60.0 or 45.0)
        tasks.append(("graphics", lambda: kits.design(engine, srt, job, total, False, style, step)))
    try:
        if "maps" not in _DLC_OFF and (HERE / "maps.py").exists():
            import maps
            if maps.installed() and maps._map_settings(style, engine)["on"]:
                tasks.append(("maps", lambda: maps.plan_moments(srt, job, style, False, total, engine)))
        if "headlines" not in _DLC_OFF and (HERE / "headlines.py").exists():
            import headlines
            if headlines._settings(style, engine)["on"]:
                tasks.append(("headlines", lambda: headlines.find_pages(
                    headlines.plan_moments(srt, job, style, False, total, engine), job, False, engine)))
        if "photofx" not in _DLC_OFF and (HERE / "photofx.py").exists():
            import photofx
            pcfg = photofx.settings(style, engine)
            if pcfg["spotlight"] or pcfg["objects"]:
                tasks.append(("photos", lambda: photofx.plan_moments(srt, job, pcfg, False, total, engine)))
    except Exception as e:                        # noqa: BLE001 - only a head start
        log(f"  scene plans: no head start — {str(e)[:120]}")
    if not tasks:
        return

    def run(task):
        name, fn = task
        try:
            fn()
        except (Exception, SystemExit) as e:      # noqa: BLE001
            log(f"  {name}: planned later instead — {str(e)[:120]}")
    log(f"planning {', '.join(n for n, _ in tasks)} while the footage is cut...")
    with ThreadPoolExecutor(max_workers=len(tasks)) as ex:
        list(ex.map(run, tasks))


def _spoken_stream(cues: list) -> tuple:
    """(words, starts, ends) — every spoken word with its own time: heard on the voice when `_word_clock` timed
    these cues, otherwise slid through its subtitle cue in proportion to its letters (which runs up to a second
    and a half off inside a long cue with a pause in it)."""
    words, starts, ends = [], [], []
    clock = _CLOCKS.get(_cues_key(cues)) if cues else None
    for k, (st, en, txt) in enumerate(cues):
        heard = (clock or {}).get(k)
        if heard and len(heard) == len(txt.split()):
            for w, (s0, e0) in zip(txt.split(), heard):
                toks = re.findall(r"[a-z0-9]+", _fold(w))
                tot, acc = float(sum(len(t) + 1 for t in toks) or 1), 0
                for t in toks:
                    words.append(t)
                    starts.append(s0 + (e0 - s0) * acc / tot)
                    acc += len(t) + 1
                    ends.append(s0 + (e0 - s0) * acc / tot)
            continue
        ws = re.findall(r"[a-z0-9]+", _fold(txt or ""))
        weights = [len(w) + 1 for w in ws]
        acc, tot = 0, float(sum(weights) or 1)
        for w, wt in zip(ws, weights):
            words.append(w)
            starts.append(st + (en - st) * acc / tot)
            acc += wt
            ends.append(st + (en - st) * acc / tot)
    return words, starts, ends


def _cues_between(cues: list, t0: float, t1: float) -> list:
    """The subtitle cues spoken between t0 and t1, a long cue cut at the words that fall inside —
    each word timed by its letters, as in _spoken_stream. [(start, end, text)]."""
    out = []
    for st, en, txt in cues:
        if en <= t0 or st >= t1:
            continue
        ws = (txt or "").split()
        weights = [len(re.sub(r"\W", "", w)) + 1 for w in ws]
        tot, acc, keep, a, b = float(sum(weights) or 1), 0, [], None, None
        for w, wt in zip(ws, weights):
            ws_t = st + (en - st) * acc / tot
            we_t = st + (en - st) * (acc + wt) / tot
            acc += wt
            if (ws_t + we_t) / 2 >= t0 - 0.05 and (ws_t + we_t) / 2 <= t1 + 0.05:
                keep.append(w)
                a = ws_t if a is None else a
                b = we_t
        if keep:
            out.append((round(a, 3), round(b, 3), " ".join(keep)))
    return out


def _find_line(stream: tuple, line: str, est: float = 0.0, lo: float = -1e9, hi: float = 1e9,
               end: bool = False):
    """The second a line starts (or, with end=True, finishes) in the spoken stream, or None. Its words
    are matched in order, a skipped or an extra word allowed; a match inside [lo, hi] beats one outside,
    more words beat fewer, and the one nearest `est` wins a tie."""
    spoken, starts, ends = stream
    toks = re.findall(r"[a-z0-9]+", _fold(line or ""))
    want = toks[-6:] if end else toks[:6]
    if not want:
        return None
    got = _find_tokens(stream, want, est, lo, hi, end)
    if got is None:
        # numbers are spelled out in the script ("forty-five to fifty percent", "November nineteenth, twenty
        # twenty-six") and written as digits in the subtitles ("45-50%", "November 19, 2026"): both as digits
        digits = _num_tokens(toks)
        if digits != toks:
            norm = ([re.sub(r"^(\d+)(st|nd|rd|th)$", r"\1", w) for w in spoken], starts, ends)
            dwant = digits[-6:] if end else digits[:6]
            got = _find_tokens(norm, dwant, est, lo, hi, end)
    if got is None:
        # failing that, the words around the numbers
        nums = _NUM_WORDS
        plain = [w for w in toks if w not in nums and not w.isdigit()]
        plain = plain[-4:] if end else plain[:4]
        if plain and plain != want:
            got = _find_tokens(stream, plain, est, lo, hi, end)
    return got


_UNITS = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen "
                                     "fourteen fifteen sixteen seventeen eighteen nineteen".split())}
_TENS = {w: 10 * i for i, w in enumerate("_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()) if w != "_"}
_ORD = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9,
        "tenth": 10, "eleventh": 11, "twelfth": 12, "thirteenth": 13, "fourteenth": 14, "fifteenth": 15, "sixteenth": 16,
        "seventeenth": 17, "eighteenth": 18, "nineteenth": 19, "twentieth": 20, "thirtieth": 30}


def _num_tokens(toks: list) -> list:
    """Spelled-out numbers as the digits a subtitle writes: ["forty", "five", "percent"] -> ["45", "percent"],
    "twenty twenty six" -> "2026", "one hundred fifty point six eight six" -> "150", "686"."""
    out, i = [], 0
    while i < len(toks):
        j = i
        while j < len(toks) and (toks[j] in _UNITS or toks[j] in _TENS or toks[j] in _ORD or
                                 toks[j] in ("hundred", "thousand", "million", "billion") or
                                 (toks[j] == "and" and j > i and j + 1 < len(toks) and toks[j + 1] in _UNITS | _TENS.keys())):
            j += 1
            if j > i and toks[j - 1] in _ORD:
                break
        run = [w for w in toks[i:j] if w != "and"]
        if not run:
            out.append(toks[i])
            i += 1
            continue
        vals = [(_UNITS.get(w) if w in _UNITS else _TENS.get(w) if w in _TENS else _ORD.get(w)) for w in run]
        # a year said in two halves: "nineteen sixty five", "twenty twenty six", "twenty thirteen"
        if 2 <= len(run) <= 3 and run[0] in ("nineteen", "twenty", "eighteen", "seventeen") and \
                all(w not in ("hundred", "thousand", "million", "billion") for w in run) and \
                (run[1] in _TENS or run[1] in _UNITS and _UNITS[run[1]] >= 10):
            half = sum(v for v in vals[1:] if v is not None)
            out.append(str((vals[0] or 0) * 100 + half))
        else:
            total, cur = 0, 0
            for w, v in zip(run, vals):
                if w == "hundred":
                    cur = (cur or 1) * 100
                elif w in ("thousand", "million", "billion"):
                    total += (cur or 1) * {"thousand": 1000, "million": 10 ** 6, "billion": 10 ** 9}[w]
                    cur = 0
                else:
                    cur += v or 0
            out.append(str(total + cur))
        i = j
        # "point six eight six": the digits after the point, as one token
        if i < len(toks) and toks[i] == "point":
            k = i + 1
            while k < len(toks) and toks[k] in _UNITS and _UNITS[toks[k]] < 10:
                k += 1
            if k > i + 1:
                out.append("".join(str(_UNITS[w]) for w in toks[i + 1:k]))
                i = k
    return out


_NUM_WORDS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
              "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty",
              "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million", "billion",
              "point", "and", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth",
              "tenth", "eleventh", "twelfth", "twentieth", "hundredth", "thousandth", "th", "st", "nd", "rd"}


def _find_tokens(stream: tuple, want: list, est: float, lo: float, hi: float, end: bool):
    spoken, starts, ends = stream
    need = min(len(want), 2 if len(want) >= 3 else len(want))
    best = None
    for i in range(len(spoken)):
        if spoken[i] not in want[:3]:
            continue
        k, j, hit, last = want.index(spoken[i]) + 1, i + 1, 1, i
        while k < len(want) and j < min(len(spoken), i + len(want) + 2):
            if spoken[j] == want[k]:
                hit, k, last = hit + 1, k + 1, j
            elif k + 1 < len(want) and spoken[j] == want[k + 1]:
                hit, k, last = hit + 1, k + 2, j
            j += 1
        if hit < need:
            continue
        t = ends[last] if end else starts[i]
        key = (lo <= t <= hi, hit, -abs(t - est))
        if best is None or key > best[0]:
            best = (key, t)
    return round(best[1], 2) if best else None


def _footage_lines(job: Path) -> dict:
    """{clip name: second its sentence starts} — each YouTube shot was chosen for one sentence
    (clips.json "line"); the subtitles say when that sentence is actually spoken."""
    try:
        rows = json.loads((job / "youtube" / "clips.json").read_text(encoding="utf-8"))
        cues = _parse_srt_full((job / "subs.srt").read_text(encoding="utf-8"))
        n_words = len((job / "script.txt").read_text(encoding="utf-8").split())
    except (OSError, ValueError):
        return {}
    if not cues:
        return {}
    stream = _spoken_stream(cues)
    total = cues[-1][1]
    clock = (n_words / float(WPM) * 60.0) / total if n_words and total > 0 else 1.0
    clock = clock if 0.6 <= clock <= 1.6 else 1.0
    out = {}
    for r in rows:
        w = float(r.get("w") or 0)
        est = float(r.get("t") or 0) / clock
        t = _find_line(stream, r.get("line") or "", est, w * 30.0 / clock - 12.0, (w + 1) * 30.0 / clock + 12.0)
        if t is not None and abs(t - est) < 90:
            out[Path(r["path"]).name] = t
    return out


_NAME = re.compile(r"\b([A-Z][a-zà-ÿ'’-]+(?:\s+(?:de|da|del|van|von|la|le|al|bin)?\s*[A-Z][a-zà-ÿ'’-]+)+)")


def _footage_people(job: Path) -> dict:
    """{clip name: surnames of the people its shot log names} — "Photo of Alex Padilla touching Lamine
    Yamal's face" -> {"padilla", "yamal"}. The timeline uses it so a shot of one person never plays under
    another person's name."""
    try:
        rows = json.loads((job / "youtube" / "clips.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    out, logs = {}, {}
    for r in rows:
        vid = str(r.get("video") or "")
        if vid not in logs:
            try:
                logs[vid] = json.loads((job / "youtube" / "catalog" / f"{vid}.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                logs[vid] = {}
        best, shows = 9e9, ""
        for sh in logs[vid].get("shots") or []:
            m = re.match(r"(\d+):(\d+(?:\.\d+)?)", str(sh.get("start") or ""))
            if not m:
                continue
            d = abs(int(m.group(1)) * 60 + float(m.group(2)) - float(r.get("start") or 0))
            if d < best:
                best, shows = d, str(sh.get("shows") or "")
        if best <= 2.5 and shows:
            names = {n.split()[-1].lower().strip("'’s") for n in _NAME.findall(shows)}
            skip = {"cup", "league", "stadium", "trophy", "news", "games", "city", "street", "euro", "uefa", "fifa"}
            out[Path(r["path"]).name] = {n for n in names if n not in skip and len(n) > 2}
    return out


def _footage_seconds(job: Path) -> dict:
    """{clip name: seconds} for the clips that run as long as their shot (YouTube footage)."""
    try:
        return {k: float(v) for k, v in json.loads((job / "footage_seconds.json").read_text(encoding="utf-8")).items()}
    except (ValueError, OSError, AttributeError):
        return {}


# ════════════════════════════════════════════════════════════════════════════
# Pexels  —  stock video + photo b-roll
# ════════════════════════════════════════════════════════════════════════════
def _pexels_get(url: str, params: dict) -> dict:
    try:
        r = requests.get(url, headers={"Authorization": PEXELS_API_KEY}, params=params, timeout=30)
        if r.status_code != 200:
            return {}
        return r.json()
    except requests.RequestException:
        return {}


def _pick_video_file(video: dict) -> str:
    """Choose the mp4 closest to (but not above) our target width."""
    files = [f for f in video.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("link")]
    if not files:
        return ""
    le = [f for f in files if (f.get("width") or 0) <= VIDEO_W]
    pick = max(le, key=lambda f: f.get("width") or 0) if le else min(files, key=lambda f: f.get("width") or 0)
    return pick["link"]


PEXELS_USED_FILE = HERE / "pexels_used.json"  # global registry of Pexels IDs already used


# Keeping every ID ever used forever starved the pool: after ~1500 entries a
# 29-minute video came back with THREE distinct clips. The registry is a
# preference for fresh footage, not a wall — and it is trimmed so it cannot grow
# past what a reasonable back catalogue needs.
PEXELS_USED_MAX = 1200


def _load_used_pexels() -> set:
    try:
        return set(json.loads(PEXELS_USED_FILE.read_text(encoding="utf-8")))
    except Exception:
        return set()


def _load_used_pexels_order() -> list:
    """Used IDs, oldest first — so the least recently seen can be reused first."""
    try:
        v = json.loads(PEXELS_USED_FILE.read_text(encoding="utf-8"))
        return [int(x) for x in v] if isinstance(v, list) else []
    except Exception:
        return []


def _save_used_pexels(used, fresh=None) -> None:
    """Append newly used IDs, keeping recency order and a bounded length."""
    try:
        order = _load_used_pexels_order()
        seen = set(order)
        add = list(fresh) if fresh is not None else [x for x in used if x not in seen]
        for x in add:
            x = int(x)
            if x in seen:
                order.remove(x)
            else:
                seen.add(x)
            order.append(x)
        PEXELS_USED_FILE.write_text(json.dumps(order[-PEXELS_USED_MAX:]), encoding="utf-8")
    except Exception:
        pass


REJECTED_KEEP = int(os.environ.get("REJECTED_KEEP", "3"))     # rejected clips kept per reason, for the owner to judge


def keep_rejected(path: Path, job: Path, reason: str) -> None:
    """Move a clip a filter dropped into job/rejected/<reason>/ (the first REJECTED_KEEP of each reason) so the
    owner can see why it went; any beyond that are deleted as before. Never fails the run."""
    try:
        dest_dir = Path(job) / "rejected" / reason
        dest_dir.mkdir(parents=True, exist_ok=True)
        if len(list(dest_dir.glob("*.mp4"))) < REJECTED_KEEP:
            shutil.move(str(path), str(dest_dir / Path(path).name))
            return
    except OSError:
        pass
    Path(path).unlink(missing_ok=True)


def _clip_is_black(path: Path) -> bool:
    """True when the first eight seconds of a clip hold (almost) no pixel brighter than dark grey — a broken download,
    a stock clip that is one long black frame. A line drawing on black keeps its bright lines and passes.
    Unknown (no ffmpeg answer): False."""
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-t", "8", "-i", str(path), "-vf", "fps=1/2,scale=64:36,format=gray",
                            "-f", "rawvideo", "-"], capture_output=True, timeout=60)
        data = r.stdout
        if len(data) < 64 * 36:
            return False
        bright = sum(1 for b in data if b > 40) / len(data)
        # also murky footage: very dark AND without any real highlight. A flame, a spark or a lamp in the dark has
        # bright pixels and stays (owner's call, 2026-10-02); a dull grey-black night shot has none and goes.
        highlight = sum(1 for b in data if b > 150) / len(data) >= 0.0035     # a lighter's flame is ~0.5%
        return bright < 0.004 or (sum(data) / len(data) < 30 and bright < 0.15 and not highlight)
    except (subprocess.SubprocessError, OSError):
        return False


def fetch_pexels_assets(script: str, title: str, job: Path, force: bool) -> list:
    """Claude -> keywords -> search Pexels -> download a pool of video+photo
    b-roll in parallel. Returns [{'kind': 'video'|'photo', 'path': Path}].

    Every Pexels asset ID used by ANY video is remembered globally (pexels_used.json)
    and skipped on future videos, so each new video gets FRESH, non-repeating b-roll."""
    pdir = job / "pexels"
    pdir.mkdir(exist_ok=True)
    manifest = pdir / "manifest.json"
    if manifest.exists() and not force:
        log(f"cached: pexels/{manifest.name}")
        return [{"kind": a["kind"], "path": Path(a["path"])} for a in json.loads(manifest.read_text(encoding="utf-8"))]
    if not PEXELS_API_KEY:
        log("PEXELS_API_KEY not set — skipping b-roll (AI images only).")
        return []

    log("Claude: choosing b-roll search keywords...")
    keywords = [str(k).strip() for k in _json_items(
        prompts.PEXELS_KEYWORDS_PROMPT.replace("[INSERT TITLE HERE]", title)
        .replace("[INSERT SCRIPT HERE]", script), max_tokens=1000) if str(k).strip()]
    log(f"keywords: {', '.join(keywords)}")

    # Gather candidates, skipping any asset already used by a previous video
    # (global registry) — plus a random result page per keyword for extra variety.
    order = _load_used_pexels_order()
    used = set(order)
    age = {i: k for k, i in enumerate(order)}      # lower = used longer ago
    seen = set()
    vid_cands, photo_cands = [], []          # (pexels_id, url) — never used before
    vid_old, photo_old = [], []              # (age, id, url) — reusable, oldest first
    for kw in keywords:
        page = random.randint(1, 4)  # vary which results come back, video-to-video
        for v in _pexels_get("https://api.pexels.com/videos/search",
                             {"query": kw, "per_page": 15, "orientation": "landscape", "page": page}).get("videos", []):
            vid = v["id"]
            if vid in seen:
                continue
            link = _pick_video_file(v)
            if not link:
                continue
            seen.add(vid)
            (vid_old if vid in used else vid_cands).append(
                (age.get(vid, 0), vid, link) if vid in used else (vid, link))
        for p in _pexels_get("https://api.pexels.com/v1/search",
                             {"query": kw, "per_page": 12, "orientation": "landscape", "page": page}).get("photos", []):
            pid = p["id"]
            if pid in seen:
                continue
            seen.add(pid)
            url = p["src"].get("large2x") or p["src"].get("large") or p["src"]["original"]
            (photo_old if pid in used else photo_cands).append(
                (age.get(pid, 0), pid, url) if pid in used else (pid, url))

    # The registry is a preference, not a wall. Once it holds most of what Pexels
    # returns for these keywords, insisting on brand-new assets left a handful of
    # clips to cover a whole video — so a short pool is topped up with whatever
    # was used longest ago.
    def _top_up(fresh, old, want, what):
        if len(fresh) >= want or not old:
            return fresh[:want]
        old.sort()
        need = want - len(fresh)
        log(f"pexels: only {len(fresh)} fresh {what}, topping up with {min(need, len(old))} "
            f"least recently used")
        return (fresh + [(i, u) for _, i, u in old[:need]])[:want]

    vid_cands = _top_up(vid_cands, vid_old, PEXELS_VIDEOS, "videos")
    photo_cands = _top_up(photo_cands, photo_old, PEXELS_PHOTOS, "fotek")
    log(f"pexels: {len(vid_cands)} videos + {len(photo_cands)} photos "
        f"({len(used)} already used before)")

    dljobs = ([("video", pid, u, pdir / f"v_{i:02d}.mp4") for i, (pid, u) in enumerate(vid_cands)]
              + [("photo", pid, u, pdir / f"p_{i:02d}.jpg") for i, (pid, u) in enumerate(photo_cands)])

    def grab(kind, pid, url, dest):
        try:
            if not (dest.exists() and not force):
                _download(url, dest)
            return {"kind": kind, "path": dest, "id": pid}
        except Exception as e:
            log(f"  pexels skip {dest.name}: {e}")
            return None

    assets = []
    with ThreadPoolExecutor(max_workers=DL_WORKERS) as ex:
        for res in ex.map(lambda a: grab(*a), dljobs):
            if res:
                assets.append(res)

    # Remember these IDs so later videos reach for fresh footage first. Recency
    # order matters — it is how "used longest ago" is decided when topping up.
    _save_used_pexels(used, fresh=[a["id"] for a in assets])

    manifest.write_text(json.dumps(
        [{"kind": a["kind"], "path": str(a["path"]), "id": a["id"]} for a in assets], indent=2), encoding="utf-8")
    log(f"pexels: {len(assets)} assets ready ({len(used)} clips used across all jobs)")
    return assets


# ════════════════════════════════════════════════════════════════════════════
# ffmpeg helpers
# ════════════════════════════════════════════════════════════════════════════
def _video_dur(path: Path) -> float:
    """Length of a video file in seconds, 0.0 when it cannot be probed."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, check=True, encoding="utf-8", errors="replace").stdout.strip()
        return float(out)
    except (subprocess.CalledProcessError, ValueError, OSError):
        return 0.0


def _audio_dur(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip()
    return float(out) if out else 0.0


def _concat_quote(p: Path) -> str:
    """A path for an ffmpeg concat list, to sit inside single quotes.

    Inside single quotes ffmpeg reads every character literally — which is what
    keeps a Windows path's backslashes safe — except the quote itself. A home
    folder like C:\\Users\\O'Brien closed the quote early and broke the whole
    list, so each ' becomes '\\'' (close, escaped quote, reopen), as ffmpeg's
    concat documentation prescribes.
    """
    return str(p.resolve()).replace("'", "'\\''")


def _concat_mp3(inputs: list, out: Path) -> None:
    lst = out.parent / "_mp3list.txt"
    lst.write_text("".join(f"file '{_concat_quote(p)}'\n" for p in inputs), encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)],
                   check=True, capture_output=True)
    lst.unlink(missing_ok=True)


# ── Vintage film overlay (green screen, keyed) ─────────────────────────────
VINTAGE_OVERLAY = HERE / "assets" / "VINTAGE OVERLAY green screen.mp4"
VIDEO_DRIFT = float(os.environ.get("VIDEO_DRIFT", "0.06"))  # slow push on every clip
VINTAGE_EVERY = int(os.environ.get("VINTAGE_EVERY", "7"))     # every Nth slot gets aged
VINTAGE_MIX = float(os.environ.get("VINTAGE_MIX", "0.55"))    # how strongly it reads


# ── Footage laid on the page ───────────────────────────────────────────────
# Instead of filling the frame, a clip is sometimes shrunk onto the same aged
# paper the graphics use — a photograph laid on the desk rather than a fullscreen
# cut. Ties the footage and the collage scenes into one visual world.
FRAMED_EVERY = int(os.environ.get("FRAMED_EVERY", "4"))       # every Nth slot
FRAMED_SCALE = float(os.environ.get("FRAMED_SCALE", "0.80"))  # 80% of the frame
FRAMED_TILT = float(os.environ.get("FRAMED_TILT", "0.7"))     # degrees, alternating


def _framed_filter(style: str, dur: float, idx: int, src_label: str = "0:v") -> tuple:
    """(extra_inputs, filter_chain, out_label) that lays the clip on the page.

    Returns ([], "", "") when the style has no paper ground, so callers can fall
    through to the normal full-frame render without branching.
    """
    ground = motion.style_ground(style) if style else None
    if ground is None or not Path(ground).exists():
        return [], "", ""
    iw = int(VIDEO_W * FRAMED_SCALE) // 2 * 2
    ih = int(VIDEO_H * FRAMED_SCALE) // 2 * 2
    tilt = FRAMED_TILT * (1 if idx % 2 else -1)
    pad = 16                                        # white photo border
    chain = (
        f"[1:v]scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,"
        f"crop={VIDEO_W}:{VIDEO_H},setsar=1[page];"
        f"[{src_label}]scale={iw - pad * 2}:{ih - pad * 2}:force_original_aspect_ratio=increase,"
        f"crop={iw - pad * 2}:{ih - pad * 2},setsar=1,"
        f"pad={iw}:{ih}:{pad}:{pad}:color=0xf3ead6,"
        # rotate needs a real alpha channel, otherwise its corner fill leaks
        # uninitialised pixels (they showed up as green dashes along the edge)
        f"format=rgba,"
        f"rotate={tilt}*PI/180:fillcolor=0x00000000:"
        f"ow=rotw({tilt}*PI/180):oh=roth({tilt}*PI/180)[shot];"
        f"[page][shot]overlay=(W-w)/2:(H-h)/2:format=auto[framed]"
    )
    return ["-loop", "1", "-i", str(ground)], chain, "[framed]"



def _vintage_vf(dur: float) -> str:
    """Filter tail that ages a slot: desaturate, warm it, drop contrast slightly.

    The supplied overlay is a green-screen clip; keying it per segment costs a
    second decode on every slot, so the cheap half of the look (the grade) is
    applied here and the keyed frame only goes on top when it is actually wanted.
    """
    m = max(0.0, min(1.0, VINTAGE_MIX))
    return (f",eq=saturation={1 - 0.55 * m:.3f}:contrast={1 - 0.10 * m:.3f}"
            f":brightness={-0.03 * m:.3f}"
            f",colorbalance=rs={0.10 * m:.3f}:gs={0.02 * m:.3f}:bs={-0.10 * m:.3f}"
            f",noise=alls={int(6 * m)}:allf=t+u")



def _white_fade_vf(dur: float, d: float) -> str:
    """Filter tail that fades a slot in FROM white and out TO white.

    The Jung look transitions on white rather than black. Kept short and clamped
    so a heavily-clamped slot can never be pure flash with no picture in between.
    """
    if d <= 0.01 or dur <= 0.6:
        return ""
    d = min(d, dur / 3.0)
    return (f",fade=t=in:st=0:d={d:.3f}:color=white"
            f",fade=t=out:st={max(0.0, dur - d):.3f}:d={d:.3f}:color=white")


def _zoom_expr(mode: str, idx: int, amount: float, frames: int) -> str:
    """How far in a still is on output frame `on`, as an ffmpeg expression. `p` is
    how far through the slot we are; smoothstep (p*p*(3-2p)) eases both ends of an
    alternating move, so it starts and stops softly instead of snapping."""
    p = f"min(on/{max(1, frames - 1)}\\,1)"
    if (mode or "in").lower() != "alternate":
        return f"(1+{amount:.5f}*{p})"                                  # steady push in
    ease = f"({p})*({p})*(3-2*({p}))"
    if idx % 2 == 0:
        return f"(1+{amount:.5f}*{ease})"                               # push in
    return f"({1.0 + amount:.5f}-{amount:.5f}*{ease})"                  # pull out


def _zoom_vf(mode: str, idx: int, amount: float, frames: int) -> str:
    """A centred zoom that moves by fractions of a pixel.

    This was zoompan, which snaps its crop window to whole pixels: a slow zoom, and
    worst of all an easing one, visibly shook. Measured on a test dot it wobbled
    0.2 px rms off its true path with 0.67 px jumps between frames. perspective
    samples between pixels (bicubic) and holds the path to 0.03 px — seven times
    steadier, with the same sharpness."""
    if (mode or "").lower() == "varied":
        return _varied_move_vf(idx, amount, frames)
    z = _zoom_expr(mode, idx, amount, frames)
    lo, hi = f"(1-1/{z})/2", f"(1+1/{z})/2"
    return (f"perspective=x0='W*{lo}':y0='H*{lo}':x1='W*{hi}':y1='H*{lo}':"
            f"x2='W*{lo}':y2='H*{hi}':x3='W*{hi}':y3='H*{hi}':interpolation=cubic:sense=source:eval=frame")


def _varied_move_vf(idx: int, amount: float, frames: int) -> str:
    """A slow camera move on a still that changes from one still to the next: push in, pull out, push in towards
    the left or right third, pan left or right, tilt up. Same sub-pixel perspective sampling as _zoom_vf, eased at
    both ends. The owner asked for different kinds of slow zooms instead of one push-in (or none)."""
    a = max(0.06, amount)
    p = f"min(on/{max(1, frames - 1)}\\,1)"
    e = f"(({p})*({p})*(3-2*({p})))"
    kind = idx % 7
    if kind in (0, 2, 3):
        z = f"(1+{a:.5f}*{e})"                                   # push in
    elif kind == 1:
        z = f"({1 + a:.5f}-{a:.5f}*{e})"                          # pull out
    else:
        z = f"{1 + a:.5f}"                                        # pans hold a fixed gentle zoom
    m = f"(0.5-0.5/{z})"                                          # room the window has to travel
    cx, cy = "0.5", "0.5"
    if kind == 2:
        cx = f"(0.5-0.6*{m})"                                     # towards the left third
    elif kind == 3:
        cx = f"(0.5+0.6*{m})"                                     # towards the right third
    elif kind == 4:
        cx = f"(0.5-{m}+2*{m}*{e})"                               # pan left to right
    elif kind == 5:
        cx = f"(0.5+{m}-2*{m}*{e})"                               # pan right to left
    elif kind == 6:
        cy = f"(0.5+{m}-2*{m}*{e})"                               # tilt up
    x0, x1 = f"({cx}-0.5/{z})", f"({cx}+0.5/{z})"
    y0, y1 = f"({cy}-0.5/{z})", f"({cy}+0.5/{z})"
    return (f"perspective=x0='W*{x0}':y0='H*{y0}':x1='W*{x1}':y1='H*{y0}':"
            f"x2='W*{x0}':y2='H*{y1}':x3='W*{x1}':y3='H*{y1}':interpolation=cubic:sense=source:eval=frame")


def _render_photo_segment(image: Path, dur: float, out: Path, zoom_total: float = 0.15,
                          white_fade: float = 0.0, leak=False, aged: bool = False,
                          framed: str = "", idx: int = 0, zoom_mode: str = "in",
                          style: str = "") -> None:
    """One photo -> a `dur`-second clip with a slow centered zoom.

    zoom_total = how much it zooms over the slot (bigger = faster/more aggressive).
    zoom_mode "in" pushes in for the whole slot; "alternate" pushes in on one slot
    and pulls out on the next, which is what stops a story of stills from feeling
    like one long slow creep. Both ease in and out — a zoom that starts at full
    speed reads as a jolt."""
    frames = max(1, round(dur * FPS))
    # in_range=full:out_range=tv converts JPEG full-range -> video limited-range, so
    # photo segments come out yuv420p (not yuvj420p) and match the video segments.
    # Mismatched pixel formats across segments break concat (freezes mid-video).
    # The still is scaled ONCE and looped by the filter (the image is read as a
    # single frame at FPS), so each frame only pays for the zoom itself.
    vf = (f"scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase:in_range=full:out_range=tv:"
          f"flags=lanczos,crop={VIDEO_W}:{VIDEO_H},loop=loop=-1:size=1,"
          f"{_zoom_vf(zoom_mode, idx, zoom_total, frames)},setsar=1{_grade_vf()},format=yuv420p")
    vf += (_vintage_vf(dur) if aged else '') + _white_fade_vf(dur, white_fade)
    half = ASTRO_LEAK_DUR / 2.0
    if leak == "out" and LIGHTLEAK.exists() and dur > half + 0.2:
        # the outgoing half of a burn that peaks on the upcoming cut
        fc = (f"[0:v]{vf},format=gbrp[base];"
              f"[1:v]scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,"
              f"crop={VIDEO_W}:{VIDEO_H},fps={FPS},setsar=1,"
              f"tpad=start_duration={max(0.0, dur - half):.3f}:start_mode=add:color=black,"
              f"tpad=stop_duration={dur:.3f}:color=black,{_LEAK_DIM},format=gbrp[lk];"
              f"[base][lk]blend=all_mode=screen:shortest=1,format=yuv420p[v]")
        subprocess.run(["ffmpeg", "-y", "-framerate", str(FPS), "-i", str(image),
                        "-t", f"{half:.3f}", "-i", str(LIGHTLEAK), "-t", f"{dur:.3f}",
                        "-filter_complex", fc, "-map", "[v]",
                        "-c:v", "libx264", *_x264_segment(style),
                        "-pix_fmt", "yuv420p", "-color_range", "tv", "-threads", FFMPEG_THREADS,
                        "-r", str(FPS), str(out)], check=True, capture_output=True)
        return
    fr_ins, fr_chain, fr_lab = _framed_filter(framed, dur, idx) if framed else ([], "", "")
    if fr_lab:
        # the clip becomes a photograph lying on the same paper the graphics use
        fc = f"[0:v]{vf}[shot0];" + fr_chain.replace("[0:v]", "[shot0]")
        subprocess.run(["ffmpeg", "-y", "-framerate", str(FPS), "-i", str(image), *fr_ins,
                        "-t", f"{dur:.3f}", "-filter_complex", fc, "-map", fr_lab,
                        "-c:v", "libx264", *_x264_segment(style),
                        "-pix_fmt", "yuv420p", "-color_range", "tv", "-threads", FFMPEG_THREADS,
                        "-r", str(FPS), str(out)], check=True, capture_output=True)
        return
    subprocess.run(["ffmpeg", "-y", "-framerate", str(FPS), "-i", str(image), "-t", f"{dur:.3f}", "-vf", vf,
                    "-c:v", "libx264", *_x264_segment(style), "-pix_fmt", "yuv420p",
                    "-color_range", "tv", "-r", str(FPS), "-threads", FFMPEG_THREADS,
                    str(out)], check=True, capture_output=True)


def _fps_vf(src) -> str:
    """fps=30, or a blend for a 24/25 fps source (youtube.fps_vf) — no repeated-frame hitch."""
    try:
        import youtube
        return youtube.fps_vf(src)
    except Exception:                                            # noqa: BLE001 - the plain filter still works
        return f"fps={FPS}"


def _render_video_segment(src: Path, dur: float, out: Path, leak=False,
                          white_fade: float = 0.0, aged: bool = False,
                          framed: str = "", idx: int = 0, drift: bool = True) -> None:
    """One video -> a `dur`-second clip scaled to fill the frame (looped if short).

    `leak` places the film-burn flash. It used to play from t=0 of the incoming
    clip, so the burn landed entirely AFTER the cut instead of straddling it.
    Now it is split: "out" puts the leak's first half at the END of the outgoing
    clip and "in" starts the leak from its own midpoint at the head of the
    incoming one, so the brightest moment sits exactly on the join.
    """
    # The slow push on every clip moves by fractions of a pixel (perspective, as the stills do): zoompan snapped its
    # window to whole pixels, invisible on moving footage but a shaky, stalling zoom on a clip that is really one
    # frozen picture (a slideshow upload; owner 2026-10-06, measured 21 stalled frames in 5 s, now none).
    if drift and VIDEO_DRIFT > 0:
        frames = max(1, int(round(dur * FPS)))
        scale = (f"scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase:out_range=tv,"
                 f"crop={VIDEO_W}:{VIDEO_H},fps={FPS},setsar=1," + _zoom_vf("in", 0, VIDEO_DRIFT, frames))
    else:
        scale = (f"scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase:out_range=tv,"
                 f"crop={VIDEO_W}:{VIDEO_H},fps={FPS},setsar=1")
    src_scale = scale.replace(f",fps={FPS},", f",{_fps_vf(src)},", 1)
    mode = "in" if leak is True else (leak or "")
    half = ASTRO_LEAK_DUR / 2.0
    if mode in ("in", "out") and LIGHTLEAK.exists() and dur > half + 0.2:
        # Screen blend in RGB (gbrp) like the dust, else the black leak tints chroma.
        if mode == "in":
            # second half of the burn, sitting at the head of the clip
            leak_in = ["-ss", f"{half:.3f}", "-t", f"{half:.3f}", "-i", str(LIGHTLEAK)]
            pad = f"tpad=stop_duration={dur:.3f}:color=black"
        else:
            # first half, delayed so it ends exactly on the cut
            leak_in = ["-t", f"{half:.3f}", "-i", str(LIGHTLEAK)]
            pad = (f"tpad=start_duration={max(0.0, dur - half):.3f}:start_mode=add:color=black"
                   f",tpad=stop_duration={dur:.3f}:color=black")
        fc = (f"[0:v]{src_scale}{_grade_vf()},format=gbrp[base];"
              f"[1:v]{scale},{pad},{_LEAK_DIM},format=gbrp[lk];"
              f"[base][lk]blend=all_mode=screen:shortest=1,format=yuv420p[v]")
        subprocess.run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(src),
                        *leak_in, "-t", f"{dur:.3f}", "-an",
                        "-filter_complex", fc, "-map", "[v]",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                        "-pix_fmt", "yuv420p", "-color_range", "tv", "-threads", FFMPEG_THREADS,
                        "-r", str(FPS), str(out)], check=True, capture_output=True)
        return
    vf = (f"{src_scale}{_grade_vf()},format=yuv420p" + (_vintage_vf(dur) if aged else "")
          + _white_fade_vf(dur, white_fade))
    fr_ins, fr_chain, fr_lab = _framed_filter(framed, dur, idx) if framed else ([], "", "")
    if fr_lab:
        fc = f"[0:v]{vf}[shot0];" + fr_chain.replace("[0:v]", "[shot0]")
        subprocess.run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(src), *fr_ins,
                        "-t", f"{dur:.3f}", "-an", "-filter_complex", fc, "-map", fr_lab,
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                        "-pix_fmt", "yuv420p", "-color_range", "tv", "-threads", FFMPEG_THREADS,
                        "-r", str(FPS), str(out)], check=True, capture_output=True)
        return
    subprocess.run(["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(src), "-t", f"{dur:.3f}", "-an",
                    "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-color_range", "tv", "-r", str(FPS), str(out)],
                   check=True, capture_output=True)


def _render_footage_segment(src: Path, dur: float, out: Path, clip_s: float, style: str = "", again: int = 0) -> None:
    """Play available source frames at their original speed, with the channel's grade."""
    if clip_s <= 0 or dur > clip_s + 1.0 / FPS:
        raise ValueError(f"Insufficient moving footage: {src.name} ({clip_s:.2f}s for {dur:.2f}s).")
    frames = max(2, int(round(dur * FPS)))
    # A crop or a later start must never disguise automatic filler reuse.
    start, reframe = 0.0, ""
    timing = ""
    p = f"min(on/{frames - 1}\\,1)"
    z = f"(1+{YT_PUSH:.4f}*{p})"
    lo, hi = f"(1-1/{z})/2", f"(1+1/{z})/2"
    push = (f",perspective=x0='W*{lo}':y0='H*{lo}':x1='W*{hi}':y1='H*{lo}':x2='W*{lo}':y2='H*{hi}':"
            f"x3='W*{hi}':y3='H*{hi}':interpolation=cubic:sense=source:eval=frame") if YT_PUSH > 0 else ""
    vf = (f"{reframe}{timing}scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase:out_range=tv,"
          f"crop={VIDEO_W}:{VIDEO_H},{_fps_vf(src)},setsar=1{push}{_grade_vf()},format=yuv420p")
    subprocess.run(["ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{dur:.3f}", "-an", "-vf", vf,
                    "-c:v", "libx264", *_x264_segment(style), "-pix_fmt", "yuv420p", "-color_range", "tv",
                    "-threads", FFMPEG_THREADS, "-r", str(FPS), str(out)], check=True, capture_output=True)


def _first_lit(src: Path, limit: float = 1.6) -> float:
    """When a scene that fades in from black first shows its picture (0.0 if it opens on one)."""
    t = 0.0
    while t <= limit:
        p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1",
                            "-vf", "scale=32:18,format=gray", "-f", "rawvideo", "-"], capture_output=True)
        if len(p.stdout) == 32 * 18 and sum(p.stdout) / (32 * 18) > 38:
            return t
        t += 0.2
    return 0.0


def _render_held_scene(src: Path, dur: float, out: Path, src_dur: float, hold_start: float = 0.0) -> None:
    """A rendered scene in a slot longer than itself: its first frame held for `hold_start`, its last
    frame for the rest. Never looped. A documentary graphic's words leave in its last moments, so its
    extra time is held just BEFORE they leave — the figure stays on screen, then goes as designed.
    A scene that fades in from black holds its first real picture instead of a black frame: the
    video's first second is never an empty screen, and everything after lands at the same moment."""
    if hold_start > 0.05:
        lit = _first_lit(src)
        if lit > 0:
            tail = max(0.0, dur - src_dur - hold_start) + 0.1
            vf = (f"trim={lit:.3f},setpts=PTS-STARTPTS,tpad=start_mode=clone:start_duration={hold_start + lit:.3f}"
                  f":stop_mode=clone:stop_duration={tail:.3f},scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,"
                  f"crop={VIDEO_W}:{VIDEO_H},fps={FPS},setsar=1,format=yuv420p")
            subprocess.run(["ffmpeg", "-y", "-i", str(src), "-t", f"{dur:.3f}", "-an", "-vf", vf,
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
                            "-color_range", "tv", "-r", str(FPS), str(out)], check=True, capture_output=True)
            return
    tail = max(0.0, dur - src_dur - hold_start) + 0.1
    fit = (f"scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,crop={VIDEO_W}:{VIDEO_H},fps={FPS},"
           f"setsar=1,format=yuv420p")
    if src.name.startswith("doc_") and tail > 0.35 and src_dur > 1.6:
        cut = src_dur - 0.75
        fc = (f"[0:v]split=2[x][y];"
              f"[x]trim=0:{cut:.3f},setpts=PTS-STARTPTS,tpad=start_mode=clone:start_duration={max(0.0, hold_start):.3f}"
              f":stop_mode=clone:stop_duration={tail:.3f}[a];"
              f"[y]trim={cut:.3f},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1,{fit}[v]")
        subprocess.run(["ffmpeg", "-y", "-i", str(src), "-filter_complex", fc, "-map", "[v]", "-t", f"{dur:.3f}", "-an",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
                        "-color_range", "tv", "-r", str(FPS), str(out)], check=True, capture_output=True)
        return
    vf = (f"tpad=start_mode=clone:start_duration={max(0.0, hold_start):.3f}:stop_mode=clone:stop_duration={tail:.3f},"
          + fit)
    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-t", f"{dur:.3f}", "-an", "-vf", vf,
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
                    "-color_range", "tv", "-r", str(FPS), str(out)], check=True, capture_output=True)


def _render_sketch_segment(src: Path, dur: float, out: Path, idx: int = 0) -> None:
    """A KINETIC still draws itself on and then keeps 'boiling' like a hand-drawn animation: the picture is revealed by a
    soft sweep that runs diagonally across it over the first ~1.4 s (a wipe with a feathered edge, alternating
    direction), and all the while a slow low-frequency displacement (8 new maps a second, ±7 px, smooth across the
    frame) makes the lines wobble the way traced animation does. Meant for white line drawings on black."""
    frames = max(2, int(round(dur * FPS)))
    left = idx % 2 == 0
    p = f"min(1\\,max(0\\,T/1.4))"          # geq's clock is T, not t: with t the reveal silently never ran
    e = f"(1-pow(1-{p}\\,3))"
    edge = f"(({e})*(W+H*0.6+260)-130)"
    axis = "(X+Y*0.6)" if left else "((W-X)+Y*0.6)"
    mask = f"geq=lum='255*clip(({edge}-{axis})/220\\,0\\,1)':cb=128:cr=128"
    z = f"(1+{YT_PUSH * 1.6:.4f}*min(on/{frames - 1}\\,1))"
    lo, hi = f"(1-1/{z})/2", f"(1+1/{z})/2"
    push = (f"perspective=x0='W*{lo}':y0='H*{lo}':x1='W*{hi}':y1='H*{lo}':x2='W*{lo}':y2='H*{hi}':"
            f"x3='W*{hi}':y3='H*{hi}':interpolation=cubic:sense=source:eval=frame")
    # the boil: two smooth random fields (drawn tiny, scaled up) refreshed 8 times a second, as x / y displacement
    amp = 7
    boil = (f"nullsrc=s=24x14:r=8:d={dur + 0.5:.3f},format=gray,geq=lum='128+{amp}*(random(1)*2-1)',"
            f"scale={VIDEO_W}:{VIDEO_H}:flags=bicubic,fps={FPS}[mx];"
            f"nullsrc=s=26x15:r=8:d={dur + 0.5:.3f},format=gray,geq=lum='128+{amp}*(random(1)*2-1)',"
            f"scale={VIDEO_W}:{VIDEO_H}:flags=bicubic,fps={FPS}[my];")
    fc = (f"[0:v]scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,crop={VIDEO_W}:{VIDEO_H},setsar=1,"
          f"fps={FPS},{push},format=rgb24[pic0];{boil}[pic0][mx][my]displace=edge=mirror,split=2[pic][m0];"
          f"[m0]format=gray,{mask},format=gray[mask];"
          f"color=c=black:s={VIDEO_W}x{VIDEO_H}:r={FPS}:d={dur:.3f},format=yuv420p[bk];"
          f"[pic]format=rgba[picA];[picA][mask]alphamerge[rev];[bk][rev]overlay=0:0:shortest=1,format=yuv420p[v]")
    subprocess.run(["ffmpeg", "-y", "-loop", "1", "-i", str(src), "-t", f"{dur:.3f}", "-filter_complex", fc, "-map", "[v]",
                    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-color_range", "tv",
                    "-r", str(FPS), str(out)], check=True, capture_output=True)


def _render_black_segment(dur: float, out: Path) -> None:
    """A plain black clip — fallback when a source asset is unusable, so one bad
    b-roll file can't abort a whole video."""
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi",
                    "-i", f"color=c=black:s={VIDEO_W}x{VIDEO_H}:r={FPS}", "-t", f"{dur:.3f}",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-color_range", "tv", "-r", str(FPS), str(out)],
                   check=True, capture_output=True)


def _build_or_load_plan(job: Path, total: float, ai_pairs: list, pexels: list, force: bool) -> list:
    """Decide what visual fills each ~15s slot. AI quote images go at the moment
    their line is spoken; everything else is Pexels b-roll (no consecutive
    repeats). Saved to plan.json so resumes are deterministic."""
    plan_file = job / "plan.json"
    if plan_file.exists() and not force:
        return [(k, p) for k, p in json.loads(plan_file.read_text(encoding="utf-8"))]

    n = max(1, math.ceil(total / SECONDS_PER_SLOT))
    plan = [None] * n

    def nearest_free(slot):
        if 0 <= slot < n and plan[slot] is None:
            return slot
        for d in range(1, n):
            for s in (slot - d, slot + d):
                if 0 <= s < n and plan[s] is None:
                    return s
        return None

    for t, path in ai_pairs:
        s = nearest_free(min(n - 1, max(0, round(t / SECONDS_PER_SLOT))))
        if s is not None:
            plan[s] = ("photo", str(path))

    pool = [(a["kind"], str(a["path"])) for a in pexels]
    fallback = [("photo", str(p)) for _, p in ai_pairs]  # if no Pexels, reuse AI images
    # Drawn from a bag rather than a modulo ring, so a pool smaller than the slot
    # count does not replay the same run of clips in the same order.
    bag = _Bag(pool or fallback, abs(hash(job.name)) % 9973 + 31)
    for i in range(n):
        if plan[i] is None:
            plan[i] = bag.take() or ("photo", "")

    plan = _apply_punches(plan, job)
    plan_file.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    vids = sum(1 for k, _ in plan if k == "video")
    log(f"plan: {n} slots ({SECONDS_PER_SLOT:.0f}s each) — {len(ai_pairs)} AI quotes, "
        f"{vids} stock videos, {n-vids} stills")
    return plan


def _style_of(job: Path) -> str:
    f = job / "style.txt"
    return f.read_text(encoding="utf-8").strip() if f.exists() else ""


def _story_times(texts: list, cues: list) -> list:
    """The second each frame's narration starts — None where it cannot be found.

    Subtitles come a sentence at a time, so every spoken word gets a time by sliding
    through its cue in proportion to its letters. The frames' words, laid end to end,
    are then aligned against that spoken stream (difflib), which survives what a
    voice does to a script: a dropped word, a line split differently, a stage
    direction that was never said. A frame starts at the first of its words the
    alignment could place, pulled back a beat for any words before it that it could
    not. Runs shorter than two words are ignored — a lone "the" anchors nothing."""
    def tok(x):
        return re.findall(r"[a-z0-9]+", _fold(x))
    spoken, stamps = [], []
    for st, en, txt in cues:
        ws = tok(txt)
        weights = [len(w) + 1 for w in ws]
        acc, tot = 0, float(sum(weights) or 1)
        for w, wt in zip(ws, weights):
            spoken.append(w)
            stamps.append(st + (en - st) * acc / tot)
            acc += wt
    words, owner, first = [], [], []
    for k, t in enumerate(texts):
        first.append(len(words))
        for w in tok(t):
            words.append(w)
            owner.append(k)
    at = [None] * len(texts)
    if not words or not spoken:
        return at
    for a, b, size in difflib.SequenceMatcher(None, words, spoken, autojunk=False).get_matching_blocks():
        if size < 2:
            continue
        for d in range(size):
            k = owner[a + d]
            if at[k] is None:
                at[k] = max(0.0, stamps[b + d] - 0.33 * (a + d - first[k]))
    return at


def _build_story_plan(job: Path, total: float, photos: list) -> list:
    """A story's timeline: every picture on the words it was drawn for, in order, once.

    Each still is designed for one beat of the script and carries the narration it
    illustrates. Those words are found in the subtitles, so the phone showing -$480
    arrives when the voice says the number — not wherever a shuffled pool happened
    to put it. Nothing repeats: in a story, a recycled picture reads as a mistake."""
    items_f, srt = job / "astro_scenes.json", job / "subs.srt"
    items = json.loads(items_f.read_text(encoding="utf-8")) if items_f.exists() else []
    cues = _parse_srt_full(srt.read_text(encoding="utf-8")) if srt.exists() else []
    pairs = [(it if isinstance(it, dict) else {}, p) for it, p in zip(items, photos) if p]
    n = len(pairs)
    if not n:
        return []
    lead = 0.2                              # the picture lands a hair before its words
    times = [None if t is None else max(0.0, t - lead)
             for t in _story_times([str(it.get("text") or "") for it, _ in pairs], cues)]
    known = [(i, t) for i, t in enumerate(times) if t is not None]
    for i in range(n):                      # anything unmatched sits between its neighbours
        if times[i] is None:
            a = max((k for k in known if k[0] < i), default=(-1, 0.0), key=lambda k: k[0])
            b = min((k for k in known if k[0] > i), default=(n, total), key=lambda k: k[0])
            times[i] = a[1] + (b[1] - a[1]) * (i - a[0]) / max(1, b[0] - a[0])
    times[0] = 0.0
    beat = 2.5                              # shortest a picture may hold
    for i in range(1, n):
        times[i] = min(max(times[i], times[i - 1] + beat), max(times[i - 1] + 0.5, total - beat * (n - i)))
    plan = []
    for i, (_, p) in enumerate(pairs):
        end = times[i + 1] if i + 1 < n else total
        plan.append(("photo", str(p), False, round(max(1.0, end - times[i]), 3)))
    (job / "plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    found = {i for i, _ in known}          # kept beside the plan, to check the timing by eye
    (job / "story_times.json").write_text(json.dumps(
        [{"at": round(times[i], 2), "found": i in found, "text": str(it.get("text") or "")}
         for i, (it, _) in enumerate(pairs)], indent=2), encoding="utf-8")
    log(f"story plan: {n} stills, each on its own words ({len(known)} found in the subtitles), "
        f"avg {total / n:.1f}s, none repeated")
    return plan


def _build_astro_plan(job: Path, total: float, photos: list, ai_clips: list,
                      pexels_clips: list, force: bool) -> list:
    """Use the same media-selection policy with or without explanatory scenes."""
    if STYLE_PLACEMENT.get(_style_of(job)) == "story":
        return _build_story_plan(job, total, photos)
    return _build_astro_motion_plan(job, total, photos, ai_clips, pexels_clips, [], force, _style_of(job))


# ── card + punch line ───────────────────────────────────────────────────────
# A stock clip pulls back into a rounded card and a single hard-hitting line
# types itself in underneath. Used instead of subtitles at that moment.
CARDTEXT_DIR = HERE / "assets" / "cardtext"
CARD_W, CARD_H, CARD_X, CARD_Y = 1760, 700, 80, 34
# One display family across captions, cards, slits and highlights. Three
# different faces on screen in the same minute is what "too many fonts"
# looked like — the treatments should differ in TREATMENT, not lettering.
CARD_FONT = os.environ.get("CARD_FONT", "Inter Black")
CARD_COLOR = os.environ.get("CARD_COLOR", "&H5F7AE0&")     # ASS is BGR: terracotta
# ── one-line fitting ───────────────────────────────────────────────────────
# Sizes used to be picked from a character count ("<=22 chars -> 168px"), which
# is a guess about average letter width. Measured against the real font,
# "JUNG WROTE IT PLAINLY" at 168px is 2124px wide on a 1640px line — so it
# wrapped, and the second row fell outside the highlighter stripe. The font
# knows its own widths; it just has to be asked.
_FONT_FILE_CACHE: dict = {}


FONT_DIR = HERE / "assets" / "fonts"
# libass looks fonts up through fontconfig, which on a machine without Inter
# installed silently substitutes something else. Handing ffmpeg the bundled
# folder makes the burn-in use the same faces the layout was measured against.
_FONTSDIR = (":fontsdir=" + str(FONT_DIR).replace("\\", "/").replace(":", r"\\:")
             if FONT_DIR.is_dir() else "")


def _bundled_font(name: str) -> str:
    """A bundled TTF matching `name`, or "" — matched on the squashed filename."""
    if not FONT_DIR.is_dir():
        return ""
    want = re.sub(r"[^a-z]", "", name.lower())
    for f in sorted(FONT_DIR.glob("*.ttf")) + sorted(FONT_DIR.glob("*.otf")):
        if re.sub(r"[^a-z]", "", f.stem.lower()) == want:
            return str(f)
    return ""


def _font_file(name: str) -> str:
    """The actual TTF behind a font name.

    Bundled fonts win. fontconfig is only a fallback, because `fc-match` does
    not exist on Windows and is not on a stock Mac either — and when it is
    missing every measured text size silently falls back to its maximum, which
    is exactly how a headline ends up two lines deep in a one-line bar.
    fc-match also never fails: it answers Verdana for a font you do not have,
    so an unbundled name quietly renders in the wrong face.
    """
    if name not in _FONT_FILE_CACHE:
        out = _bundled_font(name)
        if not out:
            try:
                out = subprocess.run(["fc-match", "-f", "%{file}", name],
                                     capture_output=True, text=True,
                                     timeout=10, encoding="utf-8", errors="replace").stdout.strip()
            except (OSError, subprocess.SubprocessError):
                out = ""
        _FONT_FILE_CACHE[name] = out
    return _FONT_FILE_CACHE[name]


def _text_width(text: str, font: str, size: int) -> float:
    """Rendered width of `text` in `font` at `size`, or 0 if it can't be measured."""
    f = _font_file(font)
    if not f:
        return 0.0
    try:
        from PIL import ImageFont
        return ImageFont.truetype(f, size).getlength(text)
    except (ImportError, OSError):
        return 0.0


def _line_count(text: str, font: str, size: int, max_w: int) -> int:
    """How many lines libass will wrap `text` into at `size`."""
    w = _text_width(text, font, size)
    return 1 if w <= 0 else max(1, math.ceil(w / max_w))


def _fit_one_line(text: str, font: str, max_w: int, hi: int, lo: int = 64) -> int:
    """The largest size in [lo, hi] at which `text` stays on ONE line."""
    f = _font_file(font)
    if not f:
        return hi                       # no font to measure — leave it alone
    try:
        from PIL import ImageFont
    except ImportError:
        return hi
    for sz in range(hi, lo - 1, -4):
        try:
            if ImageFont.truetype(f, sz).getlength(text) <= max_w:
                return sz
        except OSError:
            return hi
    return lo


CARD_SIZE = int(os.environ.get("CARD_SIZE", "185"))   # 205 read a shade too large
# Vertical centre of the strip between the card's bottom edge and the frame's
# bottom — the text block anchors here whatever its line count.
CARD_TEXT_Y = (CARD_Y + CARD_H + VIDEO_H) // 2
CARD_PULLBACK = float(os.environ.get("CARD_PULLBACK", "0.55"))   # seconds of zoom-out


def _card_ass(line: str, dur: float, out: Path) -> None:
    """One ASS event where each word fades in at its own time.

    Writing one event per word would need each word's pixel position measured up
    front. Instead the whole line is laid out once — so libass does the spacing —
    and every word carries its own alpha transform. The words appear in place
    rather than re-centring as the line grows.
    """
    words = [w for w in re.split(r"\s+", line.strip()) if w]
    if not words:
        words = ["…"]
    # The strip under the clip is 346px tall. Two lines at the old sizes needed
    # 444px, so the second row ran off the bottom of the frame — measured, not
    # guessed from a letter count. One line whenever it fits; the 100px floor is
    # low enough that anything forced to wrap still lands inside 346px.
    fs = _fit_one_line(line, CARD_FONT, VIDEO_W - 160, CARD_SIZE, 100)
    # the pull-back and the first word now overlap — waiting for the card to
    # settle before writing put the line a beat behind the voice
    start = CARD_PULLBACK * 0.45
    per = min(0.15, max(0.07, (dur - start - 1.2) / max(1, len(words))))
    parts = []
    for i, w in enumerate(words):
        t0 = int((start + i * per) * 1000)
        t1 = t0 + 260
        # hidden, then faded in on its own beat; \t is relative to the event start
        parts.append(f"{{\\alpha&HFF&\\t({t0},{t1},\\alpha&H00&)}}{w}")
    text = " ".join(parts)
    out.write_text(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n"
        "WrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,"
        "BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,"
        "BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n"
        # Alignment 5 + \\pos anchors the block's CENTRE, so one line or two it
        # always sits midway between the clip and the bottom edge — the old
        # bottom-aligned margin left it hugging the very bottom of the frame.
        f"Style: Card,{CARD_FONT},{CARD_SIZE},{CARD_COLOR},{CARD_COLOR},"
        f"&H00FFFFFF,&H64303030,1,0,0,0,100,100,0,0,1,0,4,5,130,130,0,1\n\n"
        "[Events]\n"
        "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n"
        f"Dialogue: 0,0:00:00.00,{_ass_time(dur)},Card,,0,0,0,,"
        f"{{\\fs{fs}\\pos(960,{CARD_TEXT_Y})}}{text}\n",
        encoding="utf-8")


def _render_cardtext_segment(src: Path, dur: float, out: Path, line: str) -> None:
    """Clip pulls back into a rounded card, punch line writes itself underneath."""
    bg, mask = CARDTEXT_DIR / "bg.png", CARDTEXT_DIR / "mask.png"
    if not (bg.exists() and mask.exists()):
        raise RuntimeError("cardtext: assets/cardtext/bg.png or mask.png is missing")
    ass = out.with_suffix(".ass")
    _card_ass(line, dur, ass)
    # Zooming INTO the finished composite makes the card fill the frame; pulling
    # out to 1.0 shrinks it and reveals the page — the whole animation is that
    # one move, so nothing has to be scaled over time.
    zf = max(1, int(round(CARD_PULLBACK * FPS)))
    # To start full-bleed the CARD has to fill the frame, so the zoom is the
    # larger of the two ratios — the card is much shorter than it is wide, so
    # height is what constrains it. Using the width ratio zoomed by only 1.09
    # and the pull-back was invisible.
    z0 = max(VIDEO_W / CARD_W, VIDEO_H / CARD_H)
    zexpr = f"if(lte(on,{zf}),{z0:.4f}-{z0 - 1:.4f}*on/{zf},1)"
    fc = (
        f"[0:v]scale={CARD_W}:{CARD_H}:force_original_aspect_ratio=increase,"
        f"crop={CARD_W}:{CARD_H},fps={FPS},setsar=1[clip];"
        f"[2:v]format=gray,scale={CARD_W}:{CARD_H}[m];"
        f"[clip][m]alphamerge[rounded];"
        f"[1:v]scale={VIDEO_W}:{VIDEO_H},setsar=1[page];"
        f"[page][rounded]overlay={CARD_X}:{CARD_Y}:format=auto[card];"
        f"[card]zoompan=z='{zexpr}':x='iw/2-(iw/zoom/2)':"
        f"y='{CARD_Y + CARD_H / 2:.0f}-(ih/zoom/2)':d=1:s={VIDEO_W}x{VIDEO_H}:fps={FPS}[zoomed];"
        # ffmpeg runs in the segment's own folder, so the .ass is a bare name and
        # needs no path escaping — the same trick the final mux already uses.
        f"[zoomed]subtitles={ass.name}{_FONTSDIR},format=yuv420p[v]"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(src.resolve()),
         "-loop", "1", "-i", str(bg.resolve()), "-loop", "1", "-i", str(mask.resolve()),
         "-filter_complex", fc, "-map", "[v]", "-t", f"{dur:.3f}", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", out.name],
        check=True, capture_output=True, timeout=600, cwd=str(out.parent))


# ── typed text, shared by every treatment ───────────────────────────────────
# How often a plain footage slot is upgraded to a treatment, and in what order
# they rotate so the same one never lands twice running.
PUNCH_EVERY_S = float(os.environ.get("PUNCH_EVERY_S", "58"))
PUNCH_KINDS = ("card", "slit", "hl")
PUNCH_DUR = float(os.environ.get("PUNCH_DUR", "6.0"))


def _apply_punches(plan: list, job: Path) -> list:
    """Upgrade the footage slot nearest each punch time to a treated one.

    Only real footage slots are eligible — a motion scene already carries its own
    graphics and a photo has no movement to iris open. The slot keeps its place
    in the timeline but changes kind, so the renderer picks a different treatment
    and the burnt-in subtitles are suppressed across it.
    """
    pf = job / "punch.json"
    if not pf.exists():
        return plan
    try:
        punches = json.loads(pf.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return plan
    starts, t = [], 0.0
    for e in plan:
        starts.append(t)
        t += float(e[3])
    used = set()
    for pch in punches:
        at = float(pch.get("at", 0))
        # A card and a highlight are type laid over a darkened ground — a still
        # carries them as well as footage does (verified by rendering both).
        # Only the slit needs movement: it irises open on the picture itself.
        # Restricting every treatment to video slots left whole stretches with
        # no candidate near the spoken line, so quotes drifted 10-15s early.
        kinds = ("video",) if pch.get("kind") == "slit" else ("video", "photo")
        cand = [i for i, e in enumerate(plan)
                if e[0] in kinds and i not in used and float(e[3]) >= 3.0]
        if not cand:
            break
        # The quote must be on screen WHILE it is spoken. Slots that start
        # after the line has already been said are pushed to the back of the
        # ranking — being a beat early reads as emphasis, being late reads as
        # a mistake.
        #
        # This ranked by SIGNED offset, so `min` took the smallest number —
        # which is the EARLIEST slot, not the nearest one. Every quote in a
        # video landed on slot 0: a line spoken at 3:05 was shown over the
        # opening shot. Distance is what matters, so distance is what is ranked.
        # A quote takes about three seconds to say, so a slot that opens a beat
        # INTO the line is still on screen while it is spoken — and far better
        # than one ten seconds early, which is what a flat late-penalty forced
        # whenever a graphic sat on the ideal moment.
        ideal, say = at - 1.5, 3.0
        i = min(cand, key=lambda k: abs(starts[k] - ideal) if starts[k] <= at + say
                else (starts[k] - at - say) * 6.0 + 20.0)
        used.add(i)
        _k, path, _leak, dur = plan[i]
        # Keep narration timing and stay inside the available source frames.
        plan[i] = (pch.get("kind", "card"), path, False, float(dur))
    if used:
        log(f"  punch lines: {len(used)} slots get their own treatment")
    return plan


def generate_punch_lines(srt: Path, job: Path, total: float, force: bool,
                         style: str = "") -> list:
    """One short on-screen line per minute, pulled from what is being said.

    These replace the subtitles at that moment, so they must not read like a
    caption — they are the point of the passage, compressed until it lands.
    """
    out = job / "punch.json"
    if out.exists() and not force:
        return json.loads(out.read_text(encoding="utf-8"))
    if not srt.exists():
        return []
    every_s = _mix_punch_every_s()
    if every_s <= 0 or style in STYLE_NO_PUNCH:     # graphics at zero, or a channel without them
        out.write_text("[]", encoding="utf-8")
        return []
    n = max(1, int(total // every_s))
    entries = _parse_srt(srt.read_text(encoding="utf-8"))
    chunks = ["" for _ in range(n)]
    for st, txt in entries:
        i = int(st // every_s)
        if 0 <= i < n:
            chunks[i] += " " + txt
    body = "\n\n".join(f"PART {i+1}:\n{(chunks[i].strip() or '(quiet)')[:1200]}"
                       for i in range(n))
    cz = "CZECH" in _job_language(job, style).upper()
    note = ("The narration is Czech — quote the Czech words exactly." if cz else "")
    log(f"Claude: picking {n} punch quotes from the voiceover...")
    items = _json_items(
        f"""Below are {n} consecutive stretches of a narration.

For EACH part, pick the single most striking moment and QUOTE IT VERBATIM.

Rules:
• "quote" is 3-9 CONSECUTIVE words copied EXACTLY from that part — same words,
  same order, same language. No paraphrasing, no added or dropped words. {note}
  HARD LIMIT 9 WORDS. If the best line is longer, quote the 3-9 word stretch of
  it that stands alone as a complete thought — never one that stops mid-phrase.
• Pick the words a viewer should see written on screen at the moment they are
  spoken: the turn, the claim, the image — never filler like "and then he said".
• The phrase must stand alone. It may START mid-sentence, but it must END where
  a thought ends. Never change a word.

Return ONLY a JSON array of {n} objects:
[{{"quote": "..."}}]

{body}""", max_tokens=1600)

    def norm(t: str) -> str:
        return re.sub(r"[^\w]+", " ", (t or "").lower(), flags=re.UNICODE).strip()

    res = []
    for i in range(n):
        raw = str((items[i] if i < len(items) else {}).get("quote", "")).strip()
        win = [(st_, tx_) for st_, tx_ in entries
               if i * PUNCH_EVERY_S <= st_ < (i + 1) * PUNCH_EVERY_S]
        if not win:
            continue
        qn = norm(raw)
        chosen, at = "", None
        # Verbatim is the contract: the words on screen ARE the words in the ear.
        # A quote that is not literally in the transcript is discarded, not shown.
        if qn and qn in norm(chunks[i]):
            key = " ".join(qn.split()[:3])
            for st_, tx_ in win:
                if key and key in norm(tx_):
                    at = st_
                    break
            chosen = raw.strip(" ,.;:!?…")
        # The model overshoots the word cap now and then; a 17-word card is a
        # paragraph, not a punch. What replaces it must still be a whole phrase:
        # this used to cut the middle subtitle cue at eight words, and a 12-word
        # Jung quote reached the screen as "...about others can lead". A cue ends
        # where the voice pauses, so a WHOLE cue is always a real phrase.
        if len(chosen.split()) > 9:
            chosen = ""
        if not chosen:
            want = set(qn.split()) if qn else set()
            fits = [(st_, tx_.strip(" ,.;:!?…")) for st_, tx_ in win
                    if 3 <= len(tx_.split()) <= 9]
            if not fits:
                continue          # nothing clean in this window: no card, never a cut one
            at, chosen = max(fits, key=lambda c: (len(want & set(norm(c[1]).split())),
                                                  -abs(len(c[1].split()) - 6)))
        if at is None:
            at = win[0][0]
        res.append({"at": round(at, 2), "line": chosen,
                    "kind": PUNCH_KINDS[len(res) % len(PUNCH_KINDS)]})
    out.write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
    for r in res:
        log(f"  {int(r['at'])//60}:{int(r['at'])%60:02d} [{r['kind']}] {r['line']}")
    return res


def _typed_ass(line: str, dur: float, out: Path, *, font: str, size: int,
               colour: str, start: float, align: int = 2, margin_v: int = 92,
               outline: int = 0, shadow: int = 3, bold: int = 1,
               per_word: float = 0.16) -> None:
    """One ASS event whose words each fade in on their own beat.

    Kept as a SINGLE event on purpose: libass lays the whole line out once, so
    the words appear where they will finally sit instead of re-centring as the
    line grows. Per-word `\\t` alpha does the reveal.
    """
    words = [w for w in re.split(r"\s+", line.strip()) if w] or ["…"]
    per = min(per_word, max(0.07, (dur - start - 0.6) / max(1, len(words))))
    parts = []
    for i, w in enumerate(words):
        t0 = int((start + i * per) * 1000)
        parts.append(f"{{\\alpha&HFF&\\t({t0},{t0 + 240},\\alpha&H00&)}}{w}")
    out.write_text(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n"
        "WrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,"
        "BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,"
        "BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n"
        f"Style: T,{font},{size},{colour},{colour},&H00000000,&H78000000,"
        f"{bold},0,0,0,100,100,0,0,1,{outline},{shadow},{align},110,110,{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n"
        f"Dialogue: 0,0:00:00.00,{_ass_time(dur)},T,,0,0,0,,{' '.join(parts)}\n",
        encoding="utf-8")


SLIT_FONT = os.environ.get("SLIT_FONT", "Inter Black")   # unified family
SLIT_OPEN = float(os.environ.get("SLIT_OPEN", "0.45"))    # seconds to open
SLIT_SAT = float(os.environ.get("SLIT_SAT", "0.18"))      # how grey the footage goes


def _render_slit_segment(src: Path, dur: float, out: Path, line: str) -> None:
    """Footage opens from a thin centre slit; hard white caps sit over it.

    The letterbox is two black bars whose heights are driven by `t`, so the
    frame genuinely irises open rather than cross-fading. Footage underneath is
    desaturated and darkened so white type stays the brightest thing on screen.
    """
    ass = out.with_suffix(".ass")
    # long quotes wrap to two lines at 132 and collide with the frame edges
    # Centred, not bottom-anchored: the line is the subject of the shot, and
    # sitting it on the lower edge made it read as another caption.
    fsz = _fit_one_line(line.upper(), SLIT_FONT, VIDEO_W - 220, 150, 72)
    _typed_ass(line.upper(), dur, ass, font=SLIT_FONT, size=fsz,
               colour="&H00FFFFFF&", start=SLIT_OPEN * 0.5, align=5,
               margin_v=0, outline=5, shadow=6, per_word=0.10)
    # drawbox evaluates its geometry once, not per frame, so the bars never
    # moved. overlay DOES re-evaluate x/y every frame — so the letterbox is two
    # black plates that slide out of shot instead.
    band, half = 26, VIDEO_H // 2
    prog = f"pow(min(1\\,t/{SLIT_OPEN}),0.55)"
    y_top = f"-{band}-{half - band}*{prog}"
    y_bot = f"{half + band}+{half - band}*{prog}"
    fc = (
        f"[0:v]scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,"
        f"crop={VIDEO_W}:{VIDEO_H},fps={FPS},setsar=1,"
        f"hue=s={SLIT_SAT},eq=brightness=-0.06:contrast=1.12[base];"
        f"[1:v][2:v]hstack=inputs=2,split=2[b1][b2];"
        f"[base][b1]overlay=0:'{y_top}'[t1];"
        f"[t1][b2]overlay=0:'{y_bot}',subtitles={ass.name}{_FONTSDIR},format=yuv420p[v]"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(src.resolve()),
         "-f", "lavfi", "-i", f"color=black:s={VIDEO_W // 2}x{half}:r={FPS}",
         "-f", "lavfi", "-i", f"color=black:s={VIDEO_W // 2}x{half}:r={FPS}",
         "-filter_complex", fc, "-map", "[v]", "-t", f"{dur:.3f}", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", out.name],
        check=True, capture_output=True, timeout=600, cwd=str(out.parent))


HL_FONT = os.environ.get("HL_FONT", "Inter Black")
HL_YELLOW = os.environ.get("HL_YELLOW", "0xF2D027")
HL_ALPHA = float(os.environ.get("HL_ALPHA", "0.80"))   # marker, not paint
HL_SWEEP = float(os.environ.get("HL_SWEEP", "0.38"))


def _render_highlight_segment(src: Path, dur: float, out: Path, line: str) -> None:
    """A marker stripe wipes across the frame and black caps type onto it.

    The footage behind is washed out — desaturated and lifted — so it reads as
    paper rather than video, which is what lets a flat highlighter colour sit on
    top without fighting it.
    """
    ass = out.with_suffix(".ass")
    # ONE line, always: a wrapped second row hangs below the stripe. The size is
    # measured against the real font rather than guessed from a letter count.
    bar_w = VIDEO_W - 160
    hsz = _fit_one_line(line.upper(), HL_FONT, bar_w - 120, 168, 72)
    _typed_ass(line.upper(), dur, ass, font=HL_FONT, size=hsz,
               colour="&H00101010&", start=HL_SWEEP * 0.5, align=5,
               margin_v=0, outline=0, shadow=0, per_word=0.12)
    # Same reason as the slit: drawbox geometry is fixed at init, so the stripe
    # is a plate slid in with overlay, whose x IS re-evaluated every frame.
    # The stripe wraps the type. A line long enough to still overflow at the
    # minimum size wraps anyway — measured, "HAVING SOMEONE ELSE TO BLAME FOR
    # THE DISCOMFORT" is 2097px at 72px on a 1640px line — and a stripe built
    # for one row then left the second row hanging off the yellow. So the row
    # count is measured too, and the stripe is built to hold it.
    hl_lines = _line_count(line.upper(), HL_FONT, hsz, bar_w - 120)
    bar_h = int(hsz * (1.2 * hl_lines + 0.14))
    bar_y = VIDEO_H // 2 - bar_h // 2
    x_expr = f"{80 - bar_w}+{bar_w}*pow(min(1\\,t/{HL_SWEEP}),0.6)"
    fc = (
        f"[0:v]scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,"
        f"crop={VIDEO_W}:{VIDEO_H},fps={FPS},setsar=1,"
        f"hue=s=0.10,eq=brightness=0.22:contrast=0.82[paper];"
        # NOTE: the alpha has to be forced on the lavfi SOURCE (see -i above).
        # Converting here would be too late — the colour is already flattened.
        f"[paper][1:v]overlay='{x_expr}':{bar_y}:format=auto:alpha=straight,"
        f"subtitles={ass.name}{_FONTSDIR},format=yuv420p[v]"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(src.resolve()),
         "-f", "lavfi", "-i", f"color={HL_YELLOW}@{HL_ALPHA}:s={bar_w}x{bar_h}:r={FPS},"
                                f"format=yuva420p",
         "-filter_complex", fc, "-map", "[v]", "-t", f"{dur:.3f}", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", out.name],
        check=True, capture_output=True, timeout=600, cwd=str(out.parent))


def _scene_media(job: Path) -> tuple:
    """Read scene sources after preparation, without concurrent manifest writes."""
    media_file = job / "motion" / "media.json"
    media = json.loads(media_file.read_text()) if media_file.exists() else {}
    identities = {}
    vox_file = job / "vox_scenes" / "media.json"
    if vox_file.exists():
        for scene, record in json.loads(vox_file.read_text()).items():
            media[scene] = record["files"]
            identities.update({str(Path(p).resolve()): identity for p, identity in record["identities"].items()})
    heygen_file = job / "heygen" / "media.json"
    if heygen_file.exists():
        for scene, record in json.loads(heygen_file.read_text()).items():
            media[scene] = record["files"]
            identities.update({str(Path(p).resolve()): identity for p, identity in record["identities"].items()})
    return media, identities


def _validate_media_plan(plan: list, job: Path) -> None:
    """Reject filler reuse, including renamed files and overlapping source excerpts.

    A reviewed editorial exception in media_reuse.json must name first_slot,
    repeat_slot, purpose (detail/comparison/callback), and a concrete reason.
    Selection never invents exceptions just because its media pool ran out.
    """
    exception_file = job / "media_reuse.json"
    exceptions = json.loads(exception_file.read_text()) if exception_file.exists() else []
    rows_file = job / "youtube" / "clips.json"
    rows = json.loads(rows_file.read_text()) if rows_file.exists() else []
    sources = {str(Path(r["path"]).resolve()): r for r in rows}
    seen, hashes, lengths, repeats = [], {}, {}, set()
    scene_media, identities = _scene_media(job)
    import heygen_scenes
    heygen_scenes.validate_plan(plan, job, scene_media, sys.modules[__name__])  # actual timing/count, including caches
    entries = []
    for i, (kind, path, _leak, dur) in enumerate(plan):
        generated = str(identities.get(str(Path(path).resolve()), "")).startswith("heygen:")
        if generated:
            kind = "video"  # generated footage keeps the shared footage and no-repeat checks
        entries.append((i, kind, path, dur))
        entries.extend((i, "embedded", source, 0) for source in scene_media.get(str(path), [])
                       if not (generated and Path(source).resolve() == Path(path).resolve()))
    for i, kind, path, dur in entries:
        if kind not in ("photo", "video", "embedded", *PUNCH_KINDS):
            continue
        if not path or not Path(path).is_file():
            raise ValueError(f"Coverage gap at slot {i}: no usable media. Find another contextual shot or explanatory visual.")
        key = str(Path(path).resolve())
        if key not in hashes:
            with open(key, "rb") as f:
                hashes[key] = hashlib.file_digest(f, "sha256").hexdigest()
        source = sources.get(key)
        for first, old_key, old_hash, old_source in seen:
            same = hashes[key] == old_hash
            same |= bool(identities.get(key) and identities.get(key) == identities.get(old_key))
            if source and old_source and source.get("video") == old_source.get("video"):
                same |= min(float(source["end"]), float(old_source["end"])) - max(
                    float(source["start"]), float(old_source["start"])) > 1.0 / FPS
            if same and not any(
                x.get("first_slot") == first and x.get("repeat_slot") == i
                and x.get("purpose") in ("detail", "comparison", "callback")
                and isinstance(x.get("reason"), str) and len(x["reason"].strip()) >= 20
                for x in exceptions
            ):
                # one repeated picture is a note for the owner, not a reason to lose a finished edit (owner: not
                # too strict) — it is logged and the video goes on
                repeats.add(i)
                break
        seen.append((i, key, hashes[key], source))
        if kind != "embedded" and (kind == "video" or Path(path).suffix.lower() in (".mp4", ".mov", ".webm", ".mkv")):
            if float(dur) > MAX_FOOTAGE_SHOT_SECONDS + 1e-9:
                raise ValueError(f"Footage shot at slot {i} exceeds the {MAX_FOOTAGE_SHOT_SECONDS:.1f}s maximum "
                                 f"({float(dur):.3f}s). Use another unused contextual shot.")
            if key not in lengths:
                lengths[key] = _video_dur(Path(path))
            if lengths[key] <= 0 or float(dur) > lengths[key] + 1.0 / FPS:
                raise ValueError(f"Coverage gap at slot {i}: {Path(path).name} has {lengths[key]:.2f}s "
                                 f"for a {float(dur):.2f}s slot. Looping or freezing footage is not allowed.")
    if repeats:   # owner: repeats are allowed but rare (under ~2%); reported, never a reason to stop
        share = len(repeats) / max(1, len(plan))
        log(f"  repeated media: {len(repeats)} of {len(plan)} shots ({share:.1%})"
            + (" — above the 2% target" if share > 0.02 else ""))


def _render_astro_segments(plan: list, job: Path, force: bool, zoom_total: float = ASTRO_ZOOM_TOTAL,
                           white_fade: float = 0.0, style: str = "") -> list:
    """Render variable-duration segments (per-slot dur, light-leak on video slots).
    Handles kinds: 'photo', 'video', and 'mindmap' (a pre-rendered mp4, like video)."""
    _validate_media_plan(plan, job)  # cached plans and treated clips obey the same rule
    seg_dir = job / "segments"
    seg_dir.mkdir(exist_ok=True)
    render_meta = seg_dir / "media_plan.json"
    signature = [[*e, Path(e[1]).stat().st_mtime_ns] for e in plan]
    asked_force = force  # War Chess has its own per-placement stamps; a segment re-render must not redo all of it
    try:
        force = force or json.loads(render_meta.read_text()) != signature
    except (OSError, ValueError):
        force = True
    log(f"rendering {len(plan)} segments on {RENDER_WORKERS} workers...")

    # A leak straddles a cut, so the clip BEFORE a leaking one has to carry the
    # first half of the burn. Work out those pairings once, up front.
    leak_out = set()
    for i, e in enumerate(plan):
        if i and e[2] and e[2] != "flash" and plan[i - 1][0] in ("photo", "video"):
            leak_out.add(i - 1)

    # Which line belongs to which treated slot. The plan records the treatment,
    # punch.json the words; they are paired here in timeline order.
    punch_lines: dict = {}
    pf = job / "punch.json"
    if pf.exists():
        try:
            queue = [x.get("line", "") for x in json.loads(pf.read_text(encoding="utf-8"))]
            for i, e in enumerate(plan):
                if e[0] in PUNCH_KINDS and queue:
                    punch_lines[i] = queue.pop(0)
        except (ValueError, OSError):
            punch_lines = {}

    try:
        stills_look = json.loads((job / "stills_look.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        stills_look = {}

    def look(idx, kind):
        # occasional aged slot so the cut does not feel uniformly modern
        # A story, or any channel drawn clean, keeps one look on every picture:
        # no film-aged slot, nothing shrunk onto paper.
        plain = STYLE_PLACEMENT.get(style) == "story" or style in STYLE_NO_DUST
        aged = (not plain and VINTAGE_EVERY > 0 and kind in ("photo", "video")
                and idx % VINTAGE_EVERY == VINTAGE_EVERY - 1)
        # every Nth slot is laid on the page instead of filling the frame
        framed = (style if (not plain and FRAMED_EVERY > 0 and kind in ("photo", "video")
                            and idx % FRAMED_EVERY == 1) else "")
        fx = stills_look.get(str(plan[idx][1])) if kind == "photo" else None
        if fx == "framed":
            framed, aged = style, False
        elif fx == "aged":
            aged = True
        return aged, framed

    # PHOTO FX: some stills lift their subject off the picture instead of the plain zoom —
    # chosen among the plain full-frame stills, never one that is aged, framed or burning out
    import warchess
    wc_on = warchess.enabled(sys.modules[__name__], style)
    real_len = _footage_seconds(job)
    try:
        holds_at = json.loads((job / "lead_holds.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        holds_at = {}
    try:
        again_at = {int(k): int(v) for k, v in json.loads((job / "footage_again.json").read_text(encoding="utf-8")).items()}
    except (OSError, ValueError, AttributeError):
        again_at = {}
    if isinstance(((STYLE_INFO.get(style) or {}).get("look") or {}).get("animate"), dict) and (HERE / "animate.py").exists():
        try:
            import animate
            animate.ensure(sys.modules[__name__], plan, job, style)
            try:
                import kits as _kits
                _kits.fix_transitions(sys.modules[__name__], plan, job, style)
            except Exception as _e:                                  # noqa: BLE001 - a wave keeps its first drawing
                log(f"  kits: transitions kept as drawn — {str(_e)[:100]}")
        except Exception as e:                            # noqa: BLE001 - the stills still play as stills
            log(f"  animate: skipped — {type(e).__name__}: {str(e)[:120]}")
    depth_mod, depth_slots = _depth_dlc(plan, style, job, [i for i, e in enumerate(plan) if e[0] == "photo"
                                                           and i not in leak_out and not any(look(i, "photo"))])
    if depth_slots:
        log(f"depth: {len(depth_slots)} still(s) get their subject lifted off the picture")

    def one(idx, entry):
        # a white flash: the slot renders as usual, then fades in from white (an opening transition)
        if entry[2] != "flash":
            return _one(idx, entry)
        seg = _one(idx, (entry[0], entry[1], False, entry[3]))
        mark = seg.with_suffix(".flash")
        if not mark.exists():
            tmp = seg.with_name(seg.stem + ".flash.mp4")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(seg), "-vf", "fade=t=in:st=0:d=0.22:color=white",
                            "-an", "-c:v", "libx264", *_x264_segment(style), "-pix_fmt", "yuv420p", "-color_range", "tv",
                            "-r", str(FPS), str(tmp)], check=True, capture_output=True)
            tmp.replace(seg); mark.write_text("1")
        return seg

    def _one(idx, entry):
        kind, path, leak, dur = entry
        leak = "in" if leak else ("out" if idx in leak_out else False)
        aged, framed = look(idx, kind)
        seg = seg_dir / f"seg_{idx:03d}.mp4"
        if seg.exists() and not force:
            return seg
        if idx in depth_slots and _depth_segment(depth_mod, Path(path), float(dur), seg, job, idx, style,
                                                 white_fade):
            return seg
        if kind == "photo":
            anim = Path(str(path)).with_suffix(".anim.mp4")
            if anim.exists() and anim.stat().st_size > 20_000:
                try:
                    # a still the video model set in motion (animate.py): plays like a real shot, never looped
                    _render_footage_segment(anim, float(dur), seg, _video_dur(anim), style, 0)
                    return seg
                except subprocess.CalledProcessError:
                    seg.unlink(missing_ok=True)
            reveal = str(((STYLE_INFO.get(style) or {}).get("look") or {}).get("reveal") or "").lower()
            if reveal == "sketch" and not leak:
                try:
                    _render_sketch_segment(Path(path), float(dur), seg, idx)
                    return seg
                except subprocess.CalledProcessError:
                    seg.unlink(missing_ok=True)
        # A single ffmpeg death under heavy parallel load must NOT abort a whole
        # 100+ segment assembly — retry a couple of times.
        last = None
        for attempt in range(5):
            try:
                wf = 0.0 if kind == "motion" else white_fade   # scenes fade themselves
                if kind in PUNCH_KINDS:
                    line = punch_lines.get(str(idx)) or punch_lines.get(idx) or ""
                    {"card": _render_cardtext_segment,
                     "slit": _render_slit_segment,
                     "hl": _render_highlight_segment}[kind](
                        Path(path), float(dur), seg, line)
                    return seg
                if kind == "video" and Path(path).name in real_len and not leak:
                    _render_footage_segment(Path(path), float(dur), seg, real_len[Path(path).name], style, 0)
                    return seg
                if kind == "motion" and not leak:
                    src_d = _video_dur(Path(path))
                    hold0 = float(holds_at.get(str(idx), 0.0))
                    if src_d > 0 and float(dur) > src_d + 0.08:
                        # a scene is never looped: an animation restarting mid-slot reads as a glitch
                        _render_held_scene(Path(path), float(dur), seg, src_d, hold0)
                        return seg
                if kind in ("video", "motion"):
                    # a scene already has its own camera move; adding the clip
                    # push on top gave it two, and the two fought each other
                    _render_video_segment(Path(path), float(dur), seg, leak=bool(leak),
                                          white_fade=wf, drift=(kind != "motion"))
                else:
                    _render_photo_segment(Path(path), float(dur), seg,
                                          zoom_total=(0.0 if wc_on and idx % 4 != 3 and not _styles.is_documentary(style) else zoom_total),   # documentary: every still moves (owner rule)
                                          white_fade=wf, leak=leak, aged=aged,
                                          framed=framed, idx=idx,
                                          zoom_mode=STYLE_ZOOM.get(style, "in"), style=style)
                return seg
            except subprocess.CalledProcessError as e:
                last = e
                seg.unlink(missing_ok=True)
                time.sleep(3 * (attempt + 1))
        # A single unusable asset (corrupt/0-byte download) must NOT kill the whole
        # video — fall back to a short black clip so assembly completes.
        raise RuntimeError(f"Coverage gap: segment {idx} ({Path(path).name}) could not render. "
                           "Replace this asset before continuing.") from last

    segs = [None] * len(plan)
    with ThreadPoolExecutor(max_workers=RENDER_WORKERS) as ex:
        futs = {ex.submit(one, i, e): i for i, e in enumerate(plan)}
        done = 0
        for f in as_completed(futs):
            segs[futs[f]] = f.result()
            done += 1
            if done % 10 == 0 or done == len(plan):
                log(f"  segments {done}/{len(plan)}")
    render_meta.write_text(json.dumps(signature), encoding="utf-8")
    return warchess.decorate(sys.modules[__name__], plan, segs, job, style, force=asked_force)


def _render_segments(plan: list, job: Path, force: bool, slot_dur: float = SECONDS_PER_SLOT) -> list:
    seg_dir = job / "segments"
    seg_dir.mkdir(exist_ok=True)
    log(f"rendering {len(plan)} segments on {RENDER_WORKERS} workers...")

    def one(idx, kind, path):
        seg = seg_dir / f"seg_{idx:03d}.mp4"
        if seg.exists() and not force:
            return seg
        last = None
        for attempt in range(5):  # transient ffmpeg death under load must not abort the whole assembly
            try:
                if kind == "video":
                    _render_video_segment(Path(path), slot_dur, seg)
                else:
                    _render_photo_segment(Path(path), slot_dur, seg)
                return seg
            except subprocess.CalledProcessError as e:
                last = e
                seg.unlink(missing_ok=True)
                time.sleep(3 * (attempt + 1))
        log(f"  segment {idx} ({Path(path).name}) would not render — using a black fallback")
        _render_black_segment(slot_dur, seg)
        return seg

    segs = [None] * len(plan)
    with ThreadPoolExecutor(max_workers=RENDER_WORKERS) as ex:
        futs = {ex.submit(one, i, k, p): i for i, (k, p) in enumerate(plan)}
        done = 0
        for f in as_completed(futs):
            i = futs[f]
            segs[i] = f.result()
            done += 1
            if done % 10 == 0 or done == len(plan):
                log(f"  segments {done}/{len(plan)}")
    return segs


def _concat_seconds(target, is_list: bool = False) -> float:
    """How long a file (or a whole concat list) runs, 0.0 when it cannot be read.

    On a synced folder (iCloud Desktop, OneDrive) a read can time out for a moment, so
    the answer is asked for a few times before it is believed.
    """
    cmd = ["ffprobe", "-v", "error"] + (["-f", "concat", "-safe", "0"] if is_list else []) + \
          ["-i", str(target), "-show_entries", "format=duration", "-of", "csv=p=0"]
    for attempt in range(3):
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        try:
            return float((r.stdout or "").strip().splitlines()[0])
        except (ValueError, IndexError):
            time.sleep(2 * (attempt + 1))
    return 0.0


def _segments_seconds(seg_paths: list) -> float:
    """The segments' lengths added up, each probe tried three times (a loaded disk answers 'Operation timed out')."""
    total = 0.0
    for p in seg_paths:
        for attempt in range(3):
            _warm_read(Path(p))
            r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                               capture_output=True, text=True)
            try:
                d = float(r.stdout.strip() or 0)
            except ValueError:
                d = 0.0
            if d > 0:
                total += d
                break
            time.sleep(2 * (attempt + 1))
    return total


def _uniform_segments(seg_paths: list) -> None:
    """Every segment in the join must be the same kind of picture. One treated shot came out full-range
    (yuvj420p, as JPEG decodes) among limited-range ones; the join copies streams, so the finished
    visual changed pixel format mid-stream and the final pass — run with -reinit_filter 0 to survive
    colour tags — stopped at it with "Invalid argument" after a whole judge pass. Such a segment is
    re-encoded in place to plain yuv420p, limited range, BT.709 tags, before anything is joined."""
    for p in seg_paths:
        p = Path(p)
        try:
            got = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                  "stream=pix_fmt,width,height", "-of", "csv=p=0", str(p)],
                                 capture_output=True, text=True, timeout=60).stdout.strip()
        except Exception:                                     # noqa: BLE001 - the join will tell
            continue
        # ffprobe prints the fields in the stream's own order (width,height,pix_fmt), not the order asked
        if not got or "yuv420p" in got.split(","):
            continue
        tmp = p.with_name(p.stem + "_uni.mp4")
        try:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(p),
                            "-vf", f"scale={VIDEO_W}:{VIDEO_H}:in_range=auto:out_range=tv,format=yuv420p",
                            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                            "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709",
                            "-color_trc", "bt709", "-color_range", "tv", "-an", str(tmp)],
                           check=True, capture_output=True, timeout=900)
            tmp.replace(p)
            fmt = next((x for x in got.split(",") if x.startswith("yuv") or x.startswith("gbr") or x.startswith("rgb")), got)
            log(f"  {p.name}: {fmt} -> yuv420p, so the join stays one kind of picture")
        except Exception as e:                                # noqa: BLE001
            tmp.unlink(missing_ok=True)
            log(f"  {p.name}: could not be made yuv420p ({str(e)[:80]})")


def _concat_segments(seg_paths: list, out: Path) -> None:
    _uniform_segments(seg_paths)
    lst = out.parent / "_seglist.txt"
    lst.write_text("".join(f"file '{_concat_quote(p)}'\n" for p in seg_paths), encoding="utf-8")
    # how long the finished visual has to be: ffmpeg exits 0 after a read that timed out
    # halfway through, leaving a video of the first few segments, so the length is checked
    # instead of the exit code. The probe itself can time out on such a disk, so the sum
    # of the segments (probed again, patiently) stands in — never an unchecked join.
    want = max(_concat_seconds(lst, is_list=True), _segments_seconds(seg_paths))   # the list probe stops where a read does
    last = None
    for attempt in range(3):
        for p in seg_paths:                      # each file read through first (see _warm_read)
            _warm_read(p)
        proc = subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)],
                              capture_output=True, text=True, encoding="utf-8", errors="replace")
        if proc.returncode != 0:  # mixed sources occasionally won't stream-copy — re-encode
            log("  concat copy failed, re-encoding...")
            try:
                subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                                "-pix_fmt", "yuv420p", "-r", str(FPS), str(out)],
                               check=True, capture_output=True)
            except subprocess.CalledProcessError as e:
                last = e
                out.unlink(missing_ok=True)
                time.sleep(3 * (attempt + 1))
                continue
        got = _concat_seconds(out)
        if not want or got >= want - 1.0:
            lst.unlink(missing_ok=True)
            return
        last = RuntimeError(f"the joined video came out {got:.0f}s long instead of {want:.0f}s")
        log(f"  the joined video is only {got / 60:.1f} of {want / 60:.1f} minutes — reading the segments again...")
        out.unlink(missing_ok=True)
        time.sleep(5 * (attempt + 1))
    raise last or RuntimeError("the segments could not be joined")


def youtube_filename(title: str) -> str:
    """A filename YouTube can take straight from the title.

    The pipeline writes video.mp4 for its own caching, but every finished video
    also gets a copy named after the title so an upload arrives pre-named
    instead of as another "video.mp4".
    """
    bad = '<>:"/\\|?*'
    name = "".join(" " if c in bad else c for c in title)
    name = re.sub(r"\s+", " ", name).strip().strip(".")
    name = name[:120].rstrip().rstrip(".") or "video"
    # Windows reserves these as device names, with or without an extension.
    reserved = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)),
                *(f"LPT{i}" for i in range(1, 10))}
    if name.split(".")[0].strip().upper() in reserved:
        name = "_" + name
    return name + ".mp4"


CLEAN_RENDERS = os.environ.get("CLEAN_RENDERS", "1") == "1"
# rendered intermediates MoveFast rebuilds from its saved plans without any model or paid call — never the
# sourced media (clips, photos, AI images, cutouts), the plans, or the finished video
RENDER_CACHE = ("segments/*.mp4", "motion/*.mp4", "war_chess/*.mp4", "war_chess/component-*/*.mp4",
                "vox_scenes/*/vox/segments/*.mp4", "_voice_sound.wav", "_cta_sound.wav")


def _clear_render_cache(job: Path, final: Path) -> None:
    """After the finished video is published and plays to its full length, free the space its render
    intermediates take (several GB on a 45-minute video) — like the picture file the final mux already removes."""
    try:
        ok = Path(final).exists() and _video_dur(Path(final)) > 0.95 * _audio_dur(job / "audio.mp3")
    except Exception:                                            # noqa: BLE001 - unsure: keep everything
        ok = False
    if not ok:
        log("  render cache kept (the finished video could not be confirmed)")
        return
    freed = 0
    for pattern in RENDER_CACHE:
        for f in job.glob(pattern):
            try:
                freed += f.stat().st_size
                f.unlink()
            except OSError:
                pass
    # downloaded footage the final edit never used (the stock pool is fetched wide, a fraction is placed): free
    # to fetch again, so it goes too; every clip the edit uses stays
    try:
        used = {Path(str(e[1])).name for e in json.loads((job / "plan.json").read_text(encoding="utf-8"))}
    except (OSError, ValueError):
        used = None
    if used:
        for f in list(job.glob("pexels/*.mp4")) + list(job.glob("youtube/yt_*.mp4")):
            if f.name not in used:
                try:
                    freed += f.stat().st_size
                    f.unlink()
                except OSError:
                    pass
    log(f"  freed {freed / 1e9:.1f} GB: render intermediates and unused downloaded clips "
        f"(the edit's own clips, photos and plans are kept)")


def publish_named_copy(job: Path, title: str, fresh: str = "") -> Path:
    """The finished video moves up into its folder under its title — the only copy of it — with its description
    and thumbnails beside it. Returns where the video is now. `fresh`: the name of a file that just arrived (a farm
    download) and is newer than any video.mp4 left behind. (The name is kept for every caller written before.)"""
    job = Path(job)
    name = youtube_filename(title or _title_of(job) or job.name)
    new_layout = job.parent.name == WORK_DIR
    home = job
    if new_layout and not any((job / f).exists() for f in ("video.mp4", name, fresh or "video.mp4")) \
            and not (_published(job).get("folder") and (job.parent.parent / _published(job)["folder"] / name).exists()):
        return final_video(job)                             # nothing rendered yet: no empty upload folder
    if new_layout:
        # the folder is named after the title; one another video of the same title already owns gets this
        # video's slug added, so two renders of one title never publish over each other
        home = job.parent.parent / (_published(job).get("folder") or Path(name).stem)
        owner = home / ".movefast-video"
        try:
            taken = owner.exists() and owner.read_text(encoding="utf-8").strip() != job.name
        except OSError:
            taken = False
        if taken:
            home = job.parent.parent / f"{Path(name).stem} ({job.name})"
        home.mkdir(parents=True, exist_ok=True)
        try:
            (home / ".movefast-video").write_text(job.name, encoding="utf-8")
        except OSError:
            pass
    dest = home / name
    src = job / "video.mp4"
    if fresh and (job / fresh).exists() and fresh != "video.mp4":
        src.unlink(missing_ok=True)                         # the render that just arrived wins over an older one
        src = job / fresh
    elif not src.exists() and (job / name).exists() and new_layout:
        src = job / name                                    # a farm download arrives already named
    if src.exists() and (not dest.exists() or src.resolve() != dest.resolve()):
        home.mkdir(parents=True, exist_ok=True)
        if not _move(src, dest):
            return src
    extra = []
    if new_layout:
        desc = job / "youtube.txt"
        if desc.exists():
            d_name = f"{Path(name).stem} - description.txt"
            try:
                shutil.copy2(desc, home / d_name)
                extra.append(d_name)
            except OSError:
                pass
        for t in sorted(job.glob("thumbnail_[0-9]*.png")) + sorted(job.glob("thumbnail.png")):
            try:
                shutil.copy2(t, home / t.name)
                extra.append(t.name)
            except OSError:
                pass
    if dest.exists():
        try:
            (job / "published.json").write_text(json.dumps({"video": name, "folder": home.name, "files": extra},
                                                           ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass
        log(f"published: {dest.parent.name}/{dest.name}" + (f" (+ {', '.join(extra)})" if extra else ""))
        return dest
    return final_video(job)


def _warm_read(path: Path) -> None:
    """Read a file through once so the mux that follows finds it in the cache (a synced Desktop folder answered
    mid-file reads with 'Operation timed out' under load)."""
    try:
        with open(path, "rb") as f:
            while f.read(8 << 20):
                pass
    except OSError:
        pass


def _picture_stalls(path: Path, hold_s: float = 12.0, cuts: list = None) -> "float | None":
    """The second at which the picture stops moving for good while the video goes on (a read of _visual.mp4 that
    failed halfway: its last frame sits still to the end), or None. Frames are shrunk and blurred first so tape
    noise, dust and a small label do not count as movement. A freeze counts only when it never ends (it runs to the
    end of the file) AND it covers a planned cut - `cuts`, the shot starts in seconds - or, with no plan, lasts
    hold_s. A slow move on a dark photo or a planned 13 s hold ends at its own cut, so it is never one (owner
    2026-10-10: a 12.4 s slow zoom read as a stall re-muxed an 11-minute film three times)."""
    try:
        p = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-vf",
                            "scale=64:-2,boxblur=2,freezedetect=n=0.01:d=2", "-an", "-f", "null", "-"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    except (subprocess.TimeoutExpired, OSError):
        return None
    err = p.stderr or ""
    starts = [float(x) for x in re.findall(r"freeze_start: ([0-9.]+)", err)]
    ends = [float(x) for x in re.findall(r"freeze_end: ([0-9.]+)", err)]
    clock = re.findall(r"Duration: (\d+):(\d\d):(\d\d(?:\.\d+)?)", err) or re.findall(r"time=(\d+):(\d\d):(\d\d(?:\.\d+)?)", err)[-1:]
    dur = int(clock[0][0]) * 3600 + int(clock[0][1]) * 60 + float(clock[0][2]) if clock else None
    if not starts or (len(ends) >= len(starts) and (dur is None or ends[-1] < dur - 0.5)):
        return None                              # still for a while, then moving again: a slow shot, not a failed read
    s = starts[-1]                               # only the last freeze can run to the end
    if cuts:
        return s if any(s + 0.25 < float(c) < (dur or 1e9) - 0.25 for c in cuts) else None
    return s if dur is not None and dur - s >= hold_s else None


def _frame_mutes(job: Path, style: str) -> list:
    """The (start, end) of every framed shot whose frame writes the narration itself (cinema writes them to
    frame_mutes.json), when the style asks for captions.mute_under_frames — the news band already shows the line."""
    cap = ((STYLE_INFO.get(style) or {}).get("look") or {}).get("captions") or {}
    if not cap.get("mute_under_frames"):
        return []
    try:
        rows = json.loads((job / "frame_mutes.json").read_text(encoding="utf-8"))
        return [(float(a), float(b)) for a, b in rows]
    except (OSError, ValueError, TypeError):
        return []


def _denoise_voice(mp3: Path, style: str = "") -> Path:
    """A voice with a hiss under it (a noise floor above -55 dBFS in its quietest tenths of a second) is cleaned
    with ffmpeg's non-local-means denoiser, once; the original is kept beside it as audio.raw.mp3."""
    try:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                             capture_output=True, timeout=300).stdout
        import numpy as np
        a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
        win = 1600
        n = len(a) // win
        if n < 20:
            return mp3
        rms = np.sqrt((a[:n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
        floor = float(np.sort(20 * np.log10(rms))[int(n * 0.05)])
        if floor < -55:
            return mp3
        backup = mp3.with_name("audio.raw.mp3")
        if not backup.exists():
            shutil.copy2(mp3, backup)
        tmp = mp3.with_name("audio.clean.mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(backup), "-af", "anlmdn=s=4:p=0.002:r=0.006",
                        "-c:a", "libmp3lame", "-q:a", "2", str(tmp)], check=True, capture_output=True, timeout=600)
        shutil.move(str(tmp), str(mp3))
        log(f"  voice: a hiss under the read ({floor:.0f} dBFS in the pauses) — denoised")
    except Exception as e:                                       # noqa: BLE001 - the voice is kept as it is
        log(f"  voice: denoise skipped — {str(e)[:100]}")
    return mp3


def _final_mux(job: Path, mp3: Path, srt: Path, burn_subs: bool, add_qr: bool = False,
               vignette: bool = False, no_dust_ranges: list = None,
               sub_center: bool = False, no_sub_ranges: list = None, vignette_ranges: list = None,
               look_ranges: list = None, cta_times: list = None, cuts: list = None) -> None:
    """Screen-blend the dust overlay, optional black vignette, burn subtitles,
    overlay the QR bottom-right, add voiceover. no_dust_ranges = [(start,end)] time
    windows where the dust is suppressed (e.g. mindmap segments). vignette_ranges: a softer vignette only inside
    these windows (the documentary's film look), instead of the whole video. cuts: the planned shot starts in
    seconds, when the style has a plan (the stall check then knows a cut from a slow shot, see _picture_stalls)."""
    sty_f = job / "style.txt"
    job_style = sty_f.read_text(encoding="utf-8").strip() if sty_f.exists() else ""
    # a channel may bring its own overlay (VHS tape noise instead of film dust) and a still laid over every frame
    dust = Path(STYLE_OVERLAY.get(job_style) or DUST_OVERLAY)
    has_dust = dust.exists()
    lines_png = STYLE_OVERLAY_PNG.get(job_style)
    has_lines = bool(lines_png) and Path(lines_png).exists()
    if job_style in STYLE_NO_DUST:          # a clean 2D look: no film dust...
        has_dust = False
    if job_style in STYLE_NO_VIGNETTE:      # ...and no dark corners on a bright drawing
        vignette = False
    if has_dust:
        # A corrupt/truncated overlay (e.g. "moov atom not found") must NOT abort a
        # whole video with ffmpeg exit 183 — validate it and skip gracefully if unreadable.
        try:
            subprocess.run(["ffprobe", "-v", "error", "-i", str(dust)],
                           check=True, capture_output=True)
        except (subprocess.CalledProcessError, OSError) as e:
            log(f"  ⚠ dust overlay unreadable, rendering without it: {str(e)[:80]}")
            has_dust = False
    # MoveFast ships no QR overlay. A corner watermark belongs to a channel, not
    # to the tool — a buyer who wants one drops an image in and turns this on.
    qr = _resolve_qr()
    has_qr = add_qr and qr is not None and QR_ENABLED
    labels = (job / "overlays.json").exists()
    has_subs = (burn_subs or labels) and srt.exists()
    # Montserrat reads far better than Arial at video size. NOTE: Fontsize here is
    # in ASS script units (ffmpeg's SRT->ASS uses PlayResY=288), so it is scaled by
    # ~height/288 on screen — 24 lands around 90px on 1080p.
    click_times = []
    if has_subs:
        sf = job / "style.txt"
        no_sub_ranges = list(no_sub_ranges or []) + _frame_mutes(job, job_style)
        _build_burn_ass(srt, job / "subs_burn.ass", no_sub_ranges, sub_center,
                        sf.read_text(encoding="utf-8").strip() if sf.exists() else "", captions=burn_subs)
        click_times = list(getattr(_build_burn_ass, "click_times", []) or [])
    # When the opening is a graphics scene the kinetic captions are hidden behind
    # it, so their clicks would fire against nothing on screen. The scene's own
    # emphasised words are the beats the viewer can actually see.
    icl = job / "motion" / "intro_clicks.json"
    if icl.exists():
        try:
            click_times = [float(t) for t in json.loads(icl.read_text(encoding="utf-8"))]
        except (ValueError, OSError):
            pass

    total_len = _audio_dur(mp3)
    # The segments carry different colour tags (drawn stills untagged or BT.601, footage BT.709). ffmpeg rebuilds
    # the filter graph at every such change, and a rebuilt graph can wait forever for inputs that already ended:
    # the render sat at 0% CPU halfway through. One graph for the whole video, one set of tags on the way out.
    inputs = ["-reinit_filter", "0", "-i", "_visual.mp4"]
    idx = 1
    dust_idx = None
    if has_dust:
        # Counted, not endless. An input that never reaches EOF keeps its demuxer
        # producing packets nobody consumes; once the queue fills, the whole graph
        # deadlocks and ffmpeg sits at 0% CPU forever.
        dust_len = max(1.0, _video_dur(dust))
        inputs += ["-stream_loop", str(int(total_len // dust_len) + 1), "-i", str(dust)]
        dust_idx = idx
        idx += 1
    lines_idx = None
    if has_lines:
        inputs += ["-loop", "1", "-i", str(lines_png)]      # bounded by -t below, like the QR
        lines_idx = idx
        idx += 1
    qr_idx = None
    if has_qr:
        # -loop 1 keeps the QR image on screen for the WHOLE video (a single-frame
        # image overlay otherwise only shows at the very start, then disappears).
        inputs += ["-loop", "1", "-i", str(_ensure_qr_flat(qr))]
        qr_idx = idx
        idx += 1
    # Music bed + stingers are already mixed into a single track by _mix_audio,
    # so this graph stays at the small, proven input count.
    track = _mix_audio(job, mp3, click_times)
    inputs += ["-i", track.name]
    audio_idx = idx
    idx += 1
    audio_out = f"{audio_idx}:a:0"

    filters, last = [], "0:v"
    # library edits that run over the real picture (legends/overlays.json): each replaces its own window, under the film look
    try:
        edit_windows = [(float(t), Path(p)) for t, p in json.loads((job / "legends" / "overlays.json").read_text())]
    except (OSError, ValueError, TypeError):
        edit_windows = []
    for n, (t, clip) in enumerate(w for w in edit_windows if w[1].exists()):
        filters.append(f"movie={_ff_path(clip)},fps={FPS},format=yuv420p,setpts=PTS-STARTPTS+{t:.3f}/TB[lg{n}]")
        filters.append(f"[{last}][lg{n}]overlay=0:0:eof_action=pass:format=auto[lgd{n}]")
        last = f"lgd{n}"
    if has_dust:
        # Screen blend MUST happen in RGB. On yuv420p "screen" also hits the U/V
        # chroma planes, tinting the whole frame magenta. Convert to gbrp, blend,
        # then back to yuv420p.
        # Suppress dust during mindmap windows: draw a black box over the dust there,
        # so the screen-blend adds nothing (screen with black = unchanged).
        gate = ""
        if no_dust_ranges:
            expr = "+".join(f"between(t,{s:.2f},{e:.2f})" for s, e in no_dust_ranges)
            gate = f",drawbox=x=0:y=0:w={VIDEO_W}:h={VIDEO_H}:color=black:t=fill:enable='{expr}'"
        filters.append(f"[{dust_idx}:v]scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=increase,"
                       f"crop={VIDEO_W}:{VIDEO_H},fps={FPS},setsar=1{gate},format=gbrp[dust]")
        filters.append(f"[{last}]format=gbrp[base]")
        filters.append("[base][dust]blend=all_mode=screen:shortest=1,format=yuv420p[bg]")
        last = "bg"
    for name, vf in _LOOK_VF.items():
        spans = [(a, b) for a, b, k in (look_ranges or []) if k == name]
        if spans:
            expr = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in spans)
            filters.append(f"[{last}]{vf.format(e=expr)}[look_{name}]")
            last = f"look_{name}"
    for n, t in enumerate(cta_times or []):
        # the channel's subscribe button, bottom centre, from just before the narrator asks (its sound is in the track)
        filters.append(f"movie={_ff_path(CTA_OVERLAY)},fps={FPS},format=yuva420p,setpts=PTS-STARTPTS+{t:.3f}/TB[cta{n}]")
        filters.append(f"[{last}][cta{n}]overlay=x=(W-w)/2:y=H-h:eof_action=pass:format=auto[ctad{n}]")
        last = f"ctad{n}"
    if vignette:
        # Subtle darkened corners — applied before subtitles so text stays bright.
        filters.append(f"[{last}]vignette=angle=PI/4[vig]")
        last = "vig"
    elif vignette_ranges:
        expr = "+".join(f"between(t,{s:.2f},{e:.2f})" for s, e in vignette_ranges)
        filters.append(f"[{last}]vignette=angle=PI/7:enable='{expr}'[vig]")   # softer than the old PI/4
        last = "vig"
    if has_lines:
        # the channel's scanlines and vignette over the whole picture, under the captions
        filters.append(f"[{lines_idx}:v]format=rgba[lines]")
        filters.append(f"[{last}][lines]overlay=0:0:format=auto,format=yuv420p[lined]")
        last = "lined"
    if has_subs:
        filters.append(f"[{last}]subtitles=subs_burn.ass{_FONTSDIR}[subd]")
        last = "subd"
    if has_qr:
        qh = max(2, int(VIDEO_H * QR_HEIGHT_FRAC) // 2 * 2)  # even height
        filters.append(f"[{qr_idx}:v]scale=-2:{qh}[qr]")
        # Top-left corner. -loop 1 on the QR input holds it for the whole video;
        # overlay is driven by the (finite) video, and the output -shortest bounds
        # the length to the audio — so NO shortest/eof here (that truncated it).
        filters.append(f"[{last}][qr]overlay={QR_MARGIN}:{QR_MARGIN}[outv]")
        last = "outv"

    ff = ["ffmpeg", "-y", *inputs]
    amap = audio_out if audio_out.startswith("[") else audio_out
    if filters:
        ff += ["-filter_complex", ";".join(filters), "-map", f"[{last}]", "-map", amap]
    else:
        ff += ["-map", "0:v:0", "-map", amap]
    # Write to a temp file and rename on success — a render killed midway must
    # NEVER leave a truncated video.mp4 that later looks "cached".
    tail = ["-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-c:a", "aac", "-b:a", "192k", "-shortest",
            "-t", f"{total_len:.3f}", "_video_tmp.mp4"]
    soft = ff + ["-c:v", "libx264", *_x264_final(job_style)] + tail
    ff = (ff + _hw_final_encoder() + tail) if _hw_final_encoder() else soft
    log(f"ffmpeg: final render (dust={'yes' if has_dust else 'no'}, vignette={'yes' if vignette else 'no'}, "
        f"subs={'yes' if has_subs else 'no'}, QR={'yes' if has_qr else 'no'}, "
        f"{'hardware' if ff is not soft else 'x264'} encoder)...")
    from farm.prepared import capture_final
    capture_final(job, soft, total_len, fonts_dir=FONT_DIR, fonts_option=_FONTSDIR, engine=sys.modules[__name__],
                  cuts=cuts)
    try:
        _execute_final_encode(job, ff, total_len, cuts)
    except subprocess.CalledProcessError as e:
        if ff is soft:
            raise
        log(f"  hardware encoder failed ({(e.stderr or b'')[-120:]!r}) — encoding with x264 instead")
        _execute_final_encode(job, soft, total_len, cuts)


def _execute_final_encode(job: Path, ff: list, total_len: float, cuts: list = None) -> None:
    """Execute the prepared final graph and original cleanup; no AI or planning. cuts: the planned shot starts in
    seconds, or None (see _picture_stalls)."""
    (job / "_video_tmp.mp4").unlink(missing_ok=True)
    # Hard ceiling: a stalled ffmpeg used to leave the job "running" indefinitely
    # with nothing happening. Fail loudly instead so it can simply be re-run.
    mux_timeout = max(900, int(total_len * 3) + 600)
    # A read of _visual.mp4 that times out halfway (a loaded Mac, a synced Desktop folder) ends the picture
    # early while the looped overlays and the audio go on: the last frame then sits still to the end. The
    # file is read through once first, and a finished mux whose picture stops moving is muxed again.
    for attempt in range(3):
        _warm_read(job / "_visual.mp4")
        try:
            subprocess.run(ff, check=True, capture_output=True, cwd=str(job),
                           timeout=mux_timeout)
        except subprocess.TimeoutExpired:
            (job / "_video_tmp.mp4").unlink(missing_ok=True)
            sys.exit(f"ffmpeg: the final render stalled (>{mux_timeout}s) — run the job again")
        stalled = _picture_stalls(job / "_video_tmp.mp4", cuts=cuts)
        if stalled is None:
            break
        if attempt < 2:
            log(f"  ffmpeg: the picture stopped moving at {int(stalled) // 60}:{int(stalled) % 60:02d} while the video "
                f"went on — a read failed halfway; muxing again ({attempt + 2}/3)...")
        time.sleep(5 * (attempt + 1))
    else:
        log("  ffmpeg: the picture still stops early after three tries — keeping the last mux")
    # Strip ffmpeg's encoder fingerprint (Lavf / Lavc libx264 tags) + clear handler
    # names + add faststart, losslessly (stream copy), so the file looks like an
    # ordinary export rather than an obvious ffmpeg render. Then swap in atomically.
    clean = ["ffmpeg", "-y", "-i", "_video_tmp.mp4",
             "-map_metadata", "-1", "-map_chapters", "-1", "-c", "copy",
             "-movflags", "+faststart", "-fflags", "+bitexact",
             "-metadata:s:v", "handler_name=", "-metadata:s:a", "handler_name=",
             "_video_clean.mp4"]
    subprocess.run(clean, check=True, capture_output=True, cwd=str(job))
    (job / "_video_clean.mp4").replace(job / "video.mp4")   # rename() refuses an existing target on Windows
    (job / "_video_tmp.mp4").unlink(missing_ok=True)


# ════════════════════════════════════════════════════════════════════════════
# Mindmaps  —  script -> topic tree -> per-minute overview→topic segments
# ════════════════════════════════════════════════════════════════════════════
def _parse_srt(srt_text: str) -> list:
    """Return [(start_seconds, text)] from an SRT string."""
    out = []
    for block in re.split(r"\n\s*\n", srt_text.strip()):
        m = re.search(r"(\d\d):(\d\d):(\d\d)[,.](\d+)\s*-->", block)
        if not m:
            continue
        start = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) + int(m.group(4)) / 1000.0
        text = " ".join(l for l in block.splitlines() if "-->" not in l and not l.strip().isdigit())
        out.append((start, text.strip()))
    return out


def _parse_srt_full(srt_text: str) -> list:
    """[(start, end, text)] — the burn-in builder needs end times too."""
    out = []
    for blk in re.split(r"\n\s*\n", srt_text.strip()):
        m = re.search(r"(\d\d):(\d\d):(\d\d)[,.](\d+)\s*-->\s*(\d\d):(\d\d):(\d\d)[,.](\d+)", blk)
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        st = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000.0
        en = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000.0
        txt = " ".join(l for l in blk.splitlines()
                       if "-->" not in l and not l.strip().isdigit()).strip()
        if txt and en > st:
            out.append((st, en, txt))
    return out


def _ass_time(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600); m = int((t % 3600) // 60); sec = t % 60
    return f"{h}:{m:02d}:{sec:05.2f}"


def _split_one_line(text: str, limit: int) -> list:
    """Break a cue into chunks that each fit on ONE line."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        cand = f"{cur} {w}".strip()
        if len(cand) <= limit or not cur:
            cur = cand
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines or [text]


# ── Dynamic (kinetic) subtitles ────────────────────────────────────────────
# The intro sells the video, so its words are set BIG, in two colours and two
# sizes, one phrase at a time — the style used by every retention-heavy channel.
KIN_FONT = os.environ.get("KIN_FONT", "Anton")             # heavy display face
KIN_ACCENT = os.environ.get("KIN_ACCENT", "&H002CE0FF")    # ASS BGR: amber/yellow
KIN_WHITE = "&H00FFFFFF"
KIN_WORDS = int(os.environ.get("KIN_WORDS", "3"))          # words shown at a time
KIN_HERO = float(os.environ.get("KIN_HERO", "1.32"))       # stress word, relative size
KIN_SIZE = int(os.environ.get("KIN_SIZE", "176"))          # big — the intro sells the video
# Kinetic intro captions are retired: the opening is a motion scene now, and
# one unified caption system reads far better than two competing styles.
KIN_UNTIL = float(os.environ.get("KIN_UNTIL", "0"))


def _kinetic_events(cues: list, until: float, mute) -> list:
    """Big two-colour phrases for the opening stretch.

    Each cue is split into short phrases; every phrase gets its own dialogue
    line with a pop-in, and one word inside it is set in the accent colour and a
    larger size so the line has a visual stress instead of reading flat.
    """
    out = []
    for st, en, txt in cues:
        if st >= until:
            break
        words = txt.split()
        if not words:
            continue
        groups = [words[i:i + KIN_WORDS] for i in range(0, len(words), KIN_WORDS)]
        span = (min(en, until) - st) / max(1, len(groups))
        if span <= 0.05:
            continue
        for gi, g in enumerate(groups):
            a = st + gi * span
            b = min(a + span, until)
            if b <= a or mute(a, b):
                continue
            # stress the longest word in the phrase — usually the one carrying meaning
            hero = max(range(len(g)), key=lambda i: len(g[i]))
            parts = []
            for i, w in enumerate(g):
                w = w.replace("{", "(").replace("}", ")")
                if i == hero:
                    parts.append(f"{{\\c{KIN_ACCENT}\\fs{int(KIN_SIZE * KIN_HERO)}}}{w}"
                                 f"{{\\c{KIN_WHITE}\\fs{KIN_SIZE}}}")
                else:
                    parts.append(w)
            body = " ".join(parts)
            out.append(
                f"Dialogue: 1,{_ass_time(a)},{_ass_time(b)},Kin,,0,0,0,,"
                f"{{\\fad(90,90)\\fscx88\\fscy88\\t(0,140,\\fscx104\\fscy104)"
                f"\\t(140,240,\\fscx100\\fscy100)}}{body}")
    return out



def _overlay_ass(job: Path, mute: list, style: str) -> tuple:
    """(style lines, event lines) — the text labels director.py put on the footage (overlays.json): a
    name with who they are, a place, a date, a figure counting up, a key phrase in the accent box.
    They are drawn by libass in the same pass as the captions, so they cost no render time, and
    they stay off every graphics scene."""
    # These ARE the "text labels" half of the Motion graphics switch (its own hint
    # says so), and they were rendering with that switch off — a video asked for
    # pictures only still came back with figures and name cards on the footage.
    if not feature("motion"):
        return [], []
    try:
        items = json.loads((job / "overlays.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return [], []
    look = (STYLE_INFO.get(style) or {}).get("look") or {}
    acc = str((look.get("accent") or ["#E3B25B"])[0])
    acc = acc if re.fullmatch(r"#[0-9a-fA-F]{6}", acc) else "#E3B25B"
    box = f"&H00{acc[5:7]}{acc[3:5]}{acc[1:3]}".upper().replace("&H00", "&H00")
    sans, serif = "Roboto Condensed", "EB Garamond"
    display = "Inter Display Black"
    if look.get("title_font") and "garamond" not in str(look.get("title_font")).lower():
        serif = sans                      # a channel without the documentary serif keeps its labels all sans
        if str(look.get("labels") or "").lower() == "center":
            serif = "EB Garamond"         # ...unless it wants the centred look, whose detail lines are the serif
    styles = [
        f"Style: OvlName,{sans},62,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,2,0,1,0,1.8,1,0,0,0,1",
        f"Style: OvlSub,{serif},44,&H00E6EDF2,&H000000FF,&H00101010,&H78000000,0,-1,0,0,100,100,0,0,1,0,1.5,7,0,0,0,1",
        f"Style: OvlStamp,{sans},62,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,5,0,1,0,1.8,7,0,0,0,1",
        f"Style: OvlBig,{sans},132,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,0,0,1,0,2.4,1,0,0,0,1",
        f"Style: OvlBox,{sans},66,&H00121212,&H000000FF,{box},&H00000000,-1,0,0,0,100,100,1,0,3,18,0,1,0,0,0,1",
        f"Style: OvlRule,{sans},10,{box},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
        f"Style: OvlShade,{sans},10,&H00000000,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
        # the centred look (look.labels: "center"): the display face for names and figures, tracked capitals for places
        f"Style: OvlNameC,{display},76,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,0,0,0,0,100,100,2,0,1,0,2.2,5,0,0,0,1",
        f"Style: OvlSubC,{serif},40,&H00E6EDF2,&H000000FF,&H00101010,&H78000000,0,-1,0,0,100,100,0,0,1,0,1.6,5,0,0,0,1",
        f"Style: OvlStampC,{sans},46,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,9,0,1,0,1.8,5,0,0,0,1",
        f"Style: OvlBigC,{display},150,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,0,0,0,0,100,100,0,0,1,0,2.6,5,0,0,0,1",
        f"Style: OvlPhraseC,{display},58,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,0,0,0,0,100,100,3,0,1,0,2.0,5,0,0,0,1",
    ]
    centered = str(look.get("labels") or "").lower() == "center"
    esc = lambda x: str(x).replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")
    events, last_end = [], -9.0
    handled = set()
    if isinstance(look.get("labels"), dict):
        return _overlay_ass_kit(job, mute, style, items, look["labels"], esc)
    if (HERE / "cinema.py").exists():
        import cinema
        c_styles, c_events, handled = cinema.ass_extra(sys.modules[__name__], job, style, mute, items)
        styles += c_styles
        events += c_events
    items = [x for k, x in enumerate(items) if k not in handled]
    for it in sorted((x for x in items if isinstance(x, dict)), key=lambda x: float(x.get("t") or 0)):
        a = max(0.0, float(it.get("t") or 0) - 0.1)
        try:
            dur = max(2.2, min(4.5, float(it.get("dur") or 3.6)))      # director.py's own shortest label
        except (TypeError, ValueError):
            dur = 3.6
        b = a + dur
        text, sub, kind = esc(it.get("text") or ""), esc(it.get("sub") or ""), str(it.get("style") or "phrase")
        if not text or a < last_end + 0.25 or any(a < e_ + 0.3 and b > s_ - 0.3 for s_, e_ in mute):
            continue
        last_end = b
        A, B = _ass_time(a), _ass_time(b)
        fade = "\\fad(260,320)"
        rule = lambda x, y, w, h: (f"Dialogue: 4,{A},{B},OvlRule,,0,0,0,,{{\\an7\\pos({x},{y})\\p1{fade}"
                                   f"\\clip({x},{y},{x},{y + h})\\t(0,420,\\clip({x},{y},{x + w},{y + h}))}}"
                                   f"m 0 0 l {w} 0 {w} {h} 0 {h}{{\\p0}}")
        # a soft dark patch under the words: legible on bright grass, snow or sky without a hard box
        shade = lambda x, y, w, h: (f"Dialogue: 3,{A},{B},OvlShade,,0,0,0,,{{\\an7\\pos({x},{y})\\p1\\1a&H9C&"
                                    f"\\blur70\\fad(360,420)}}m 0 0 l {w} 0 {w} {h} 0 {h}{{\\p0}}")
        if centered and kind == "name":
            # the channel's centred look: the name opens from its middle in the display face, a short orange rule
            # wipes under it, the role sits beneath — lower middle of the frame, never a corner
            events += [shade(300, 640, 1320, 300),
                       f"Dialogue: 5,{A},{B},OvlNameC,,0,0,0,,{{\\an5\\pos(960,748)\\fad(0,320)\\clip(960,640,960,860)"
                       f"\\t(0,380,\\clip(300,640,1620,860))}}{text.upper()}",
                       f"Dialogue: 4,{_ass_time(a + 0.15)},{B},OvlRule,,0,0,0,,{{\\an7\\pos(915,806)\\p1{fade}"
                       f"\\clip(915,806,915,811)\\t(0,420,\\clip(915,806,1005,811))}}m 0 0 l 90 0 90 5 0 5{{\\p0}}"]
            if sub:
                events.append(f"Dialogue: 5,{_ass_time(a + 0.25)},{B},OvlSubC,,0,0,0,,{{\\an5\\pos(960,846)\\fad(300,320)}}{sub}")
        elif centered and kind == "number":
            digits = re.sub(r"[^0-9.]", "", text)
            try:
                target = float(digits) if digits else None
            except ValueError:
                target = None
            events.append(shade(360, 380, 1200, 360))
            if target is not None and target >= 10:
                dec = len(digits.split(".")[1]) if "." in digits else 0
                pre = text.split(re.search(r"[0-9]", text).group(0), 1)[0]
                steps = 9
                for k_ in range(steps):
                    v = target * (1 - (1 - (k_ + 1) / steps) ** 3)
                    shown = f"{v:,.{dec}f}" if k_ < steps - 1 else re.sub(r"^[^0-9]*", "", text)
                    t0_, t1_ = a + k_ * 0.07, (a + (k_ + 1) * 0.07) if k_ < steps - 1 else b
                    fx = "\\fad(120,0)" if k_ == 0 else ("\\fad(0,320)" if k_ == steps - 1 else "")
                    events.append(f"Dialogue: 5,{_ass_time(t0_)},{_ass_time(t1_)},OvlBigC,,0,0,0,,"
                                  f"{{\\an5\\pos(960,520){fx}}}{esc(pre)}{shown}")
            else:
                events.append(f"Dialogue: 5,{A},{B},OvlBigC,,0,0,0,,{{\\an5\\pos(960,520){fade}\\fscx108\\fscy108"
                              f"\\t(0,320,\\fscx100\\fscy100)}}{text}")
            if sub:
                events.append(f"Dialogue: 5,{_ass_time(a + 0.3)},{B},OvlStampC,,0,0,0,,{{\\an5\\pos(960,650)\\fad(300,320)\\fs40}}{sub.upper()}")
        elif centered:
            # a key phrase: one line in the display face, centred low, opening from its middle, a short rule under it
            events += [shade(300, 780, 1320, 200),
                       f"Dialogue: 5,{A},{B},OvlPhraseC,,0,0,0,,{{\\an5\\pos(960,868)\\fad(0,320)\\clip(960,800,960,930)"
                       f"\\t(0,380,\\clip(200,800,1720,930))}}{text.upper()}",
                       f"Dialogue: 4,{_ass_time(a + 0.15)},{B},OvlRule,,0,0,0,,{{\\an7\\pos(915,916)\\p1{fade}"
                       f"\\clip(915,916,915,920)\\t(0,420,\\clip(915,916,1005,920))}}m 0 0 l 90 0 90 4 0 4{{\\p0}}"]
        elif kind == "name":
            events += [shade(40, 700, 1040, 260), rule(120, 846, 128, 5),
                       f"Dialogue: 5,{A},{B},OvlName,,0,0,0,,{{\\an1\\move(96,832,120,832,0,420){fade}}}{text.upper()}"]
            if sub:
                events.append(f"Dialogue: 5,{A},{B},OvlSub,,0,0,0,,{{\\an7\\pos(122,866)\\fad(420,320)}}{sub}")
        elif kind in ("place", "date"):
            events += [shade(40, 40, 1040, 240), rule(120, 138, 30, 5),
                       f"Dialogue: 5,{A},{B},OvlStamp,,0,0,0,,{{\\an7\\move(144,100,166,100,0,420){fade}}}{text.upper()}"]
            if sub:
                events.append(f"Dialogue: 5,{A},{B},OvlSub,,0,0,0,,{{\\an7\\pos(168,176)\\fad(420,320)}}{sub}")
        elif kind == "number":
            digits = re.sub(r"[^0-9.]", "", text)
            try:
                target = float(digits) if digits else None
            except ValueError:
                target = None
            if target is not None and target >= 10:
                dec = len(digits.split(".")[1]) if "." in digits else 0
                pre, post = text.split(re.search(r"[0-9]", text).group(0), 1)[0], ""
                steps = 9
                for k_ in range(steps):
                    v = target * (1 - (1 - (k_ + 1) / steps) ** 3)
                    shown = f"{v:,.{dec}f}" if k_ < steps - 1 else re.sub(r"^[^0-9]*", "", text)
                    t0_, t1_ = a + k_ * 0.07, (a + (k_ + 1) * 0.07) if k_ < steps - 1 else b
                    fx = "\\fad(200,0)" if k_ == 0 else ("\\fad(0,320)" if k_ == steps - 1 else "")
                    events.append(f"Dialogue: 5,{_ass_time(t0_)},{_ass_time(t1_)},OvlBig,,0,0,0,,"
                                  f"{{\\an1\\pos(118,838){fx}}}{esc(pre)}{shown}")
            else:
                events.append(f"Dialogue: 5,{A},{B},OvlBig,,0,0,0,,{{\\an1\\pos(118,838){fade}}}{text}")
            events += [shade(40, 640, 1100, 330), rule(122, 852, 60, 4)]
            if sub:
                events.append(f"Dialogue: 5,{A},{B},OvlStamp,,0,0,0,,{{\\an7\\pos(122,866)\\fad(380,320)\\fs40}}{sub.upper()}")
        else:
            events.append(f"Dialogue: 5,{A},{B},OvlBox,,0,0,0,,{{\\an1\\pos(136,858)\\fad(120,320)"
                          f"\\clip(100,760,100,900)\\t(0,380,\\clip(100,760,1800,900))}}{text.upper()}")
    return styles, events


def _overlay_ass_kit(job: Path, mute: list, style: str, items: list, cfg: dict, esc) -> tuple:
    """The text labels in a look kit's own skin (look.labels = {...}) — every channel places and sets its
    names, dates, places, figures and phrases differently, so eight styles never share the same corner:
      pos: tl | tr | bl | br | tc | bc      where the labels live
      font / size / colour / sub_font       the faces (bundled fonts) and colours ("#RRGGBB")
      box: "#RRGGBB" | ""                   a filled box behind the text (kinetic yellow, frontline black)
      rule: "#RRGGBB" | ""                  a short accent rule beside the text
      upper: true | false                   capitals
      enter: slide | pop | type | blur      how a label arrives
      count: true | false                   figures count up
    """
    pos = str(cfg.get("pos") or "bl").lower()
    font, sub_font = str(cfg.get("font") or "Roboto Condensed"), str(cfg.get("sub_font") or cfg.get("font") or "Roboto Condensed")
    size, sub_size = int(cfg.get("size") or 60), int(cfg.get("sub_size") or 34)
    ink = _ass_hex(str(cfg.get("colour") or "#FFFFFF"))
    box = str(cfg.get("box") or "")
    rule = str(cfg.get("rule") or "")
    upper = cfg.get("upper", True) is not False
    enter = str(cfg.get("enter") or "slide").lower()
    count = cfg.get("count", True) is not False
    # anchor + position per corner (ASS alignment: 7 tl, 9 tr, 1 bl, 3 br, 8 tc, 2 bc)
    anchor = {"tl": (7, 120, 96), "tr": (9, 1800, 96), "bl": (1, 120, 930), "br": (3, 1800, 930),
              "tc": (8, 960, 90), "bc": (2, 960, 940)}.get(pos, (1, 120, 930))
    al, x, y = anchor
    box_col = _ass_hex(box) if box else "&H00000000"
    bs = 3 if box else 1
    ol = round(size / 8, 1) if box else round(size / 26, 1)
    text_col = _ass_hex(str(cfg.get("box_text") or "#111111")) if box else ink
    styles = [
        f"Style: KitL,{font},{size},{text_col},&H000000FF,{box_col if box else '&H00101010'},{box_col},-1,0,0,0,100,100,{float(cfg.get('spacing') or 0)},0,{bs},{ol},{0 if box else 1.6},{al},0,0,0,1",
        f"Style: KitLS,{sub_font},{sub_size},{ink},&H000000FF,&H00101010,&H78000000,0,{-1 if cfg.get('sub_italic') else 0},0,0,100,100,0,0,1,{round(sub_size / 30, 1)},1.2,{al},0,0,0,1",
        f"Style: KitLR,{font},10,{_ass_hex(rule) if rule else ink},&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
        f"Style: KitLBig,{font},{int(size * 1.9)},{ink},&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,0,0,1,{round(size / 22, 1)},2.0,{al},0,0,0,1",
    ]
    events, last_end = [], -9.0
    dx = 1 if al in (7, 1) else (-1 if al in (9, 3) else 0)
    for it in sorted((x_ for x_ in items if isinstance(x_, dict)), key=lambda x_: float(x_.get("t") or 0)):
        a = max(0.0, float(it.get("t") or 0) - 0.1)
        try:
            dur = max(2.2, min(4.5, float(it.get("dur") or 3.6)))
        except (TypeError, ValueError):
            dur = 3.6
        b = a + dur
        text, sub, kind = esc(it.get("text") or ""), esc(it.get("sub") or ""), str(it.get("style") or "phrase")
        if not text or a < last_end + 0.25 or any(a < e_ + 0.3 and b > s_ - 0.3 for s_, e_ in mute):
            continue
        last_end = b
        A, B = _ass_time(a), _ass_time(b)
        shown = text.upper() if upper else text
        if enter == "slide":
            fx = f"\\move({x - 26 * dx},{y},{x},{y},0,380)\\fad(200,300)"
        elif enter == "pop":
            fx = f"\\pos({x},{y})\\fscx80\\fscy80\\t(0,140,\\fscx100\\fscy100)\\fad(80,300)"
        elif enter == "blur":
            fx = f"\\pos({x},{y})\\blur18\\t(0,320,\\blur0)\\fad(120,300)"
        else:   # type
            fx = f"\\pos({x},{y})\\fad(60,300)"
        body = shown
        if enter == "type":
            per = max(2, int(round(min(6.0, 60.0 / max(1, len(shown))))))
            body = "".join(f"{{\\k{per}}}{c}" for c in shown)
        sub_y = y + (size + 8) * (1 if al in (7, 9, 8) else -1)
        if kind == "number" and count:
            digits = re.sub(r"[^0-9.]", "", text)
            try:
                target = float(digits) if digits else None
            except ValueError:
                target = None
            if target is not None and target >= 10:
                dec = len(digits.split(".")[1]) if "." in digits else 0
                pre = text.split(re.search(r"[0-9]", text).group(0), 1)[0]
                steps = 9
                for k_ in range(steps):
                    v = target * (1 - (1 - (k_ + 1) / steps) ** 3)
                    sh = f"{v:,.{dec}f}" if k_ < steps - 1 else re.sub(r"^[^0-9]*", "", text)
                    t0_, t1_ = a + k_ * 0.07, (a + (k_ + 1) * 0.07) if k_ < steps - 1 else b
                    f2 = "\\fad(150,0)" if k_ == 0 else ("\\fad(0,300)" if k_ == steps - 1 else "")
                    events.append(f"Dialogue: 5,{_ass_time(t0_)},{_ass_time(t1_)},KitLBig,,0,0,0,,{{\\pos({x},{y}){f2}}}{esc(pre)}{sh}")
            else:
                events.append(f"Dialogue: 5,{A},{B},KitLBig,,0,0,0,,{{\\pos({x},{y})\\fad(150,300)}}{text}")
            if sub:
                sy = y + int(size * 1.9 + 10) * (1 if al in (7, 9, 8) else -1)
                events.append(f"Dialogue: 5,{_ass_time(a + 0.25)},{B},KitLS,,0,0,0,,{{\\pos({x},{sy})\\fad(300,300)}}{sub.upper() if upper else sub}")
            continue
        events.append(f"Dialogue: 5,{A},{B},KitL,,0,0,0,,{{{fx}}}{body}")
        if rule and not box:
            rx = x if dx >= 0 else x - 90
            ry = y + (size + 4 if al in (7, 9, 8) else -(size + 10))
            events.append(f"Dialogue: 4,{_ass_time(a + 0.1)},{B},KitLR,,0,0,0,,{{\\an7\\pos({rx},{ry})\\p1\\fad(200,300)"
                          f"\\clip({rx},{ry},{rx},{ry + 5})\\t(0,420,\\clip({rx},{ry},{rx + 90},{ry + 5}))}}m 0 0 l 90 0 90 5 0 5{{\\p0}}")
        if sub:
            events.append(f"Dialogue: 5,{_ass_time(a + 0.25)},{B},KitLS,,0,0,0,,{{\\pos({x},{sub_y})\\fad(300,300)}}{sub}")
    return styles, events


def _ass_hex(hex_: str, alpha: str = "00") -> str:
    """"#RRGGBB" -> "&HAABBGGRR" (ASS colour order)."""
    h = str(hex_ or "#FFFFFF").lstrip("#")
    if len(h) != 6:
        h = "FFFFFF"
    return f"&H{alpha}{h[4:6]}{h[2:4]}{h[0:2]}"


_NEG_WORDS = {"not", "never", "no", "cant", "dont", "wont", "hard", "harder", "hardest", "difficult", "wrong", "fail",
              "failed", "failure", "lose", "lost", "worst", "stop", "stopped", "impossible", "dangerous", "danger", "dead",
              "death", "killed", "broke", "broken", "expensive", "against", "without", "risk", "risky", "mistake", "lie",
              "lied", "nobody", "nothing", "problem", "trap", "scam", "banned", "illegal"}


def _kit_keyword(words: list) -> int:
    """The word a cluster or a pop lights up: the longest word of six letters or more (the last when tied), else -1."""
    best, k = -1, 0
    for i, w in enumerate(words):
        n = len(re.sub(r"[^\w]", "", w))
        if n >= 6 and n >= k:
            best, k = i, n
    return best


def _font_measure(font_name: str, size: int):
    """A function giving the pixel width of a string in one of the bundled fonts (assets/fonts, matched by name
    without spaces or hyphens), or a fair guess when the font is not there."""
    key = re.sub(r"[^a-z0-9]", "", font_name.lower())
    fdir = Path(__file__).parent / "assets" / "fonts"
    try:
        from PIL import ImageFont
        for f in sorted(fdir.glob("*.ttf")):
            if re.sub(r"[^a-z0-9]", "", f.stem.lower()) == key:
                ft = ImageFont.truetype(str(f), size)
                return lambda text: ft.getlength(text)
    except Exception:                                   # noqa: BLE001 - the guess below
        pass
    return lambda text: len(text) * size * 0.58


def _build_burn_ass_kit(srt: Path, out_ass: Path, mute: list, style: str, cap: dict, mode: str, center: bool) -> Path:
    """The kit caption modes (captions.mode in a style file):
      cluster    — the words of a line gather one by one in a block on the LEFT of the frame, the next line's on the
                   RIGHT (lower case, a techno mono); the key word takes the accent colour, a negative word a red box
      typewriter — a black bar top-left appears at its full width first, then the line types into it
      shout      — two or three words at a time, caps, a heavy face with a red stroke, at the bottom, popping in
      pop        — a few words centred with a soft glow, the key word in the accent colour
      comic      — one bold outlined line at the bottom that pops in
      pill       — 4-6 words in a dark rounded pill at the bottom; said words white, the word being said in the accent
      stack      — kinetic typography: 3-6 words build word by word beside the picture (left, then right), the key
                   word bigger in the accent colour, a negative word red, a sentence's last word in the serif italic
    Word times come from the voice's own clock (_word_clock), like the default captions."""
    cues = _parse_srt_full(srt.read_text(encoding="utf-8"))
    clock = _word_clock(srt.parent, srt) if cues else {}
    font = str(cap.get("font") or SUB_FONT)
    size = int(cap.get("size") or 56)
    accent = _ass_hex(str(cap.get("accent") or "#F2C230"))
    box = _ass_hex(str(cap.get("box_colour") or "#E5322D"))
    ink = _ass_hex(str(cap.get("colour") or "#FFFFFF"))
    stroke = _ass_hex(str(cap.get("outline_colour") or "#121212"))
    limit = int(cap.get("line_chars") or 26)
    marginv = int(cap.get("margin_v") or 120)
    lower, upper = bool(cap.get("lower")), bool(cap.get("upper"))
    hold = float(cap.get("hold") or 0.15)

    def muted(a: float, b: float) -> bool:
        return any(a < e and b > s for s, e in mute)

    def timed(ci: int, st: float, en: float, txt: str) -> list:
        ws = txt.split()
        wt = clock.get(ci) if clock.get(ci) and len(clock[ci]) == len(ws) else None
        if wt:
            return [(w, max(st, float(x[0]) - 0.04), max(st + 0.05, float(x[1]))) for w, x in zip(ws, wt)]
        n = max(1, len(ws))
        span = (en - st) / n
        return [(w, st + i * span, st + (i + 1) * span) for i, w in enumerate(ws)]

    def clean(w: str) -> str:
        w = w.replace("\\", "").replace("{", "(").replace("}", ")")
        return w.lower() if lower else (w.upper() if upper else w)

    def chunks(words: list, n_max: int, end: float) -> list:
        """[(text words, start, end)] — groups of up to n_max words, each shown until the next group starts.
        A group never runs past a sentence end ("of 10. Margins shrink" reads as two thoughts), and a lone
        leftover word joins the group before it."""
        groups, cur = [], []
        for w in words:
            cur.append(w)
            if len(cur) >= n_max or re.search(r"[.!?…]$", w[0]):
                groups.append(cur)
                cur = []
        if cur:
            if groups and len(cur) == 1 and len(groups[-1]) < n_max + 1:
                groups[-1] = groups[-1] + cur
            else:
                groups.append(cur)
        out = []
        for gi, g in enumerate(groups):
            a = g[0][1]
            b = groups[gi + 1][0][1] if gi + 1 < len(groups) else end + hold
            out.append(([clean(w) for w, _, _ in g], a, max(a + 0.25, b)))
        return out

    events, styles, kept = [], [], 0
    fmt_style = ("Style: {name},{font},{size},{ink},{sec},{outl},{back},{bold},0,0,0,100,100,{sp},0,{bs},{ol},{sh},{al},{ml},{mr},{mv},1")
    if mode == "cluster":
        styles += [fmt_style.format(name="KitL", font=font, size=size, ink=ink, sec="&H000000FF", outl=stroke, back="&H00000000",
                                    bold=0, sp=2, bs=1, ol=round(size / 22, 1), sh=round(size / 16, 1), al=7, ml=0, mr=0, mv=0),
                   fmt_style.format(name="KitR", font=font, size=size, ink=ink, sec="&H000000FF", outl=stroke, back="&H00000000",
                                    bold=0, sp=2, bs=1, ol=round(size / 22, 1), sh=round(size / 16, 1), al=9, ml=0, mr=0, mv=0),
                   fmt_style.format(name="KitLB", font=font, size=size, ink=ink, sec="&H000000FF", outl=box, back=box,
                                    bold=0, sp=2, bs=3, ol=round(size / 9, 1), sh=0, al=7, ml=0, mr=0, mv=0),
                   fmt_style.format(name="KitRB", font=font, size=size, ink=ink, sec="&H000000FF", outl=box, back=box,
                                    bold=0, sp=2, bs=3, ol=round(size / 9, 1), sh=0, al=9, ml=0, mr=0, mv=0)]
        top = int(cap.get("top") or 300)
        per = max(2, int(cap.get("words") or 6))          # a cluster holds a phrase, not a whole sentence
        side = 0
        groups = []
        for ci, (st, en, txt) in enumerate(cues):
            words = timed(ci, st, en, txt)
            if not words or muted(st, en + hold):
                continue
            for gi in range(0, len(words), per):
                g = words[gi:gi + per]
                g_end = words[gi + per][1] if gi + per < len(words) else en + hold
                groups.append((g, g_end))
        for g, g_end in groups:
            words = g
            right = side % 2 == 1
            side += 1
            pos = f"\\pos({int(cap.get('right_x') or 1660) if right else int(cap.get('left_x') or 260)},{top})"
            ws = [clean(w) for w, _, _ in words]
            key = _kit_keyword(ws)
            neg = next((i for i, w in enumerate(ws) if re.sub(r"[^\w]", "", w.lower()) in _NEG_WORDS), -1)
            rows, row = [], []
            for w in ws:
                if row and len(" ".join(row)) + 1 + len(w) > limit:
                    rows.append(row)
                    row = [w]
                else:
                    row.append(w)
            if row:
                rows.append(row)
            starts = [a for _, a, _ in words] + [g_end]
            for wi in range(len(ws)):
                a, b = starts[wi], starts[wi + 1]
                if b - a < 0.02:
                    continue
                shown, idx, plain, boxed = wi + 1, 0, [], []
                for r in rows:
                    pr, br = [], []
                    for w in r:
                        if idx < shown:
                            if idx == key and idx != neg:
                                pr.append(f"{{\\1c{accent}}}{w}{{\\1c{ink}}}")
                            else:
                                pr.append(w)
                            br.append(("{\\alpha&H00&}" if idx == neg else "{\\alpha&HFF&}") + w)
                        idx += 1
                    if pr:
                        plain.append(" ".join(pr))
                        boxed.append(" ".join(br))
                base = "KitR" if right else "KitL"
                events.append(f"Dialogue: 1,{_ass_time(a)},{_ass_time(b)},{base},,0,0,0,,{{{pos}}}" + "\\N".join(plain))
                if 0 <= neg <= wi:
                    events.append(f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},{base}B,,0,0,0,,{{{pos}}}" + "\\N".join(boxed))
            kept += 1
    elif mode == "typewriter":
        # SecondaryColour fully transparent + a \k per character: each letter appears as its time comes; the opaque
        # box (BorderStyle 3) is drawn for the whole line from the start — the black bar, then the typing
        styles.append(fmt_style.format(name="KitT", font=font, size=size, ink=ink, sec="&HFF000000", outl="&H00000000",
                                       back="&H00000000", bold=0, sp=0, bs=3, ol=round(size / 4.5, 1), sh=0, al=7, ml=0, mr=0, mv=0))
        x, y = int(cap.get("left_x") or 120), int(cap.get("top") or 96)
        for ci, (st, en, txt) in enumerate(cues):
            if not txt.strip() or muted(st, en + hold):
                continue
            parts = _split_one_line(clean(txt), limit)
            nchars = sum(len(p) for p in parts)
            per = max(0.012, min(0.055, (en - st) * 0.72 / max(1, nchars)))
            cs = max(1, int(round(per * 100)))
            body = "\\N".join("".join(f"{{\\k{cs}}}{c}" for c in p) for p in parts)
            events.append(f"Dialogue: 1,{_ass_time(st)},{_ass_time(en + hold)},KitT,,0,0,0,,{{\\pos({x},{y})}}{body}")
            kept += 1
    elif mode == "shout":
        styles.append(fmt_style.format(name="KitS", font=font, size=size, ink=ink, sec="&H000000FF", outl=box, back="&H00000000",
                                       bold=-1, sp=0, bs=1, ol=round(size / 11, 1), sh=0, al=2, ml=60, mr=60, mv=marginv))
        for ci, (st, en, txt) in enumerate(cues):
            for ws, a, b in chunks(timed(ci, st, en, txt), int(cap.get("words") or 3), en):
                if muted(a, b):
                    continue
                events.append(f"Dialogue: 1,{_ass_time(a)},{_ass_time(b)},KitS,,0,0,0,,"
                              f"{{\\fscx86\\fscy86\\t(0,80,\\fscx100\\fscy100)}}{' '.join(w.upper() for w in ws)}")
                kept += 1
    elif mode == "pop":
        styles.append(fmt_style.format(name="KitP", font=font, size=size, ink=ink, sec="&H000000FF", outl=stroke, back="&H00000000",
                                       bold=-1, sp=0, bs=1, ol=round(size / 30, 1), sh=round(size / 14, 1), al=5, ml=0, mr=0, mv=0))
        y = int(cap.get("y") or 720)
        for ci, (st, en, txt) in enumerate(cues):
            for ws, a, b in chunks(timed(ci, st, en, txt), int(cap.get("words") or 4), en):
                if muted(a, b):
                    continue
                key = _kit_keyword(ws)
                text = " ".join(f"{{\\1c{accent}}}{w}{{\\1c{ink}}}" if i == key else w for i, w in enumerate(ws))
                plain = " ".join(ws)
                pop_in = "\\fscx84\\fscy84\\t(0,90,\\fscx100\\fscy100)"
                events.append(f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},KitP,,0,0,0,,"
                              f"{{\\pos(960,{y}){pop_in}\\bord16\\blur18\\1a&HFF&\\3a&H70&\\3c&HFFFFFF&\\shad0}}{plain}")
                events.append(f"Dialogue: 1,{_ass_time(a)},{_ass_time(b)},KitP,,0,0,0,,{{\\pos(960,{y}){pop_in}}}{text}")
                kept += 1
    elif mode == "pill":
        # a dark rounded pill drawn as an ASS shape under 4-6 words (one shape per group, measured with the real font,
        # so the per-word colour runs never split it); one text event per spoken word: the words already said are
        # white, the word being said takes the accent colour, the words to come are dim — nothing jumps
        pill_col = _ass_hex(str(cap.get("pill_colour") or "#000000"))[4:]
        pill_a = str(cap.get("pill_alpha") or "58")
        dim = _ass_hex(str(cap.get("dim") or "#9A9A9A"))[4:]
        acc, ink6 = accent[4:], ink[4:]
        styles.append(fmt_style.format(name="KitI", font=font, size=size, ink=ink, sec="&H000000FF", outl="&H00000000", back="&H00000000",
                                       bold=-1, sp=0, bs=1, ol=0, sh=0, al=5, ml=0, mr=0, mv=0))
        styles.append(fmt_style.format(name="KitIBox", font=font, size=size, ink=f"&H{pill_a}{pill_col}", sec="&H000000FF", outl="&H00000000",
                                       back="&H00000000", bold=0, sp=0, bs=1, ol=0, sh=0, al=5, ml=0, mr=0, mv=0))
        measure = _font_measure(font, size)
        pad_x, pad_y = int(size * 0.55), int(size * 0.26)
        box_h = int(size * 1.28) + 2 * pad_y
        y = VIDEO_H - marginv - box_h // 2
        r = min(18, box_h // 3)

        def pill_shape(w: int, h: int) -> str:
            x0, y0, x1, y1 = 0, 0, w, h
            return (f"m {x0 + r} {y0} l {x1 - r} {y0} b {x1} {y0} {x1} {y0} {x1} {y0 + r} l {x1} {y1 - r} b {x1} {y1} {x1} {y1} {x1 - r} {y1} "
                    f"l {x0 + r} {y1} b {x0} {y1} {x0} {y1} {x0} {y1 - r} l {x0} {y0 + r} b {x0} {y0} {x0} {y0} {x0 + r} {y0}")

        for ci, (st, en, txt) in enumerate(cues):
            allw = timed(ci, st, en, txt)
            for ws, a, b in chunks(allw, int(cap.get("words") or 5), en):
                if muted(a, b):
                    continue
                starts, k0 = [], 0
                for w in ws:
                    for j in range(k0, len(allw)):
                        if allw[j][0] == w:
                            starts.append(max(a, allw[j][1]))
                            k0 = j + 1
                            break
                    else:
                        starts.append(a + (b - a) * len(starts) / max(1, len(ws)))
                starts[0] = a
                plain = " ".join(ws)
                w_px = int(measure(plain)) + 2 * pad_x
                pop = "\\fscx92\\fscy92\\t(0,70,\\fscx100\\fscy100)"
                events.append(f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},KitIBox,,0,0,0,,{{\\an5\\pos(960,{y}){pop}\\p1}}{pill_shape(w_px, box_h)}{{\\p0}}")
                for i, w in enumerate(ws):
                    t0_ = starts[i]
                    t1_ = starts[i + 1] if i + 1 < len(ws) else b
                    if t1_ - t0_ < 0.03:
                        continue
                    text = " ".join((f"{{\\1c&H{acc}&}}{x}{{\\1c&H{ink6}&}}" if j == i else (x if j < i else f"{{\\1c&H{dim}&}}{x}{{\\1c&H{ink6}&}}"))
                                    for j, x in enumerate(ws))
                    fx = pop if i == 0 else ""
                    events.append(f"Dialogue: 1,{_ass_time(t0_)},{_ass_time(t1_)},KitI,,0,0,0,,{{\\an5\\pos(960,{y}){fx}}}{text}")
                kept += 1
    elif mode == "stack":
        # kinetic typography: a block of 3-6 words builds word by word as they are spoken, beside the picture (left,
        # then right), 1-3 ragged lines; the key word bigger in the accent colour, a negative word red, the last word
        # of a sentence in the serif italic. One event per spoken word holding the WHOLE block, the words still to
        # come transparent — libass lays the lines out itself, so nothing is measured and nothing jumps.
        big_font = str(cap.get("big_font") or font)
        serif = str(cap.get("serif_font") or "Playfair Display")
        red = _ass_hex(str(cap.get("box_colour") or "#E5322D"))
        s_main, s_big, s_serif = size, int(size * 1.4), int(size * 1.18)
        styles.append(fmt_style.format(name="KitK", font=font, size=s_main, ink=ink, sec="&H000000FF", outl=stroke, back="&H00000000",
                                       bold=0, sp=1, bs=1, ol=round(s_main / 24, 1), sh=round(s_main / 10, 1), al=4, ml=0, mr=0, mv=0))
        x_left, x_right = int(cap.get("left_x") or 150), int(cap.get("right_x") or 1770)
        y_mid = int(cap.get("y") or 540)
        per_line = int(cap.get("line_chars") or 16)
        side = 0
        for ci, (st, en, txt) in enumerate(cues):
            allw = timed(ci, st, en, txt)
            ends_sentence = txt.strip()[-1:] in ".?!"
            for ws, a, b in chunks(allw, int(cap.get("words") or 5), en):
                if muted(a, b):
                    continue
                key = _kit_keyword(ws)
                starts, k0 = [], 0
                for w in ws:
                    for j in range(k0, len(allw)):
                        if allw[j][0] == w:
                            starts.append(max(a, allw[j][1]))
                            k0 = j + 1
                            break
                    else:
                        starts.append(a + (b - a) * len(starts) / max(1, len(ws)))
                starts[0] = a
                last_of_sentence = ends_sentence and ws[-1] == allw[-1][0]
                # each word's look, and its weight in characters for the ragged wrap
                looks, weights = [], []
                for i, w in enumerate(ws):
                    if i == key:
                        looks.append(f"{{\\fn{big_font}\\fs{s_big}\\b1\\1c{accent}}}"); weights.append(len(w) * 1.4)
                    elif re.sub(r"[^a-z']", "", w.lower()) in _NEG_WORDS:
                        looks.append(f"{{\\1c{red}}}"); weights.append(len(w))
                    elif last_of_sentence and i == len(ws) - 1 and len(ws) > 2:
                        looks.append(f"{{\\fn{serif}\\fs{s_serif}\\i1}}"); weights.append(len(w) * 1.05)
                    else:
                        looks.append(""); weights.append(len(w))
                lines_, cur, cur_w = [], [], 0.0
                for i in range(len(ws)):
                    ww = weights[i] + (1 if cur else 0)
                    if cur and cur_w + ww > per_line:
                        lines_.append(cur); cur, cur_w = [i], weights[i]
                    else:
                        cur.append(i); cur_w += ww
                if cur:
                    lines_.append(cur)
                reset = f"{{\\fn{font}\\fs{s_main}\\b0\\i0\\1c{ink}}}"
                hold_to = b + hold
                al = 4 if side == 0 else 6
                x = x_left if side == 0 else x_right
                for i in range(len(ws)):
                    t0_ = starts[i]
                    t1_ = starts[i + 1] if i + 1 < len(ws) else hold_to
                    if t1_ - t0_ < 0.04:
                        continue
                    rows = []
                    for idxs in lines_:
                        parts_ = []
                        for j in idxs:
                            hidden = "{\\alpha&HFF&}" if j > i else "{\\alpha&H00&}"
                            parts_.append(f"{looks[j]}{hidden}{clean(ws[j])}{reset}")
                        rows.append(" ".join(parts_))
                    pop = "\\fscx90\\fscy90\\t(0,120,\\fscx100\\fscy100)" if i == 0 else ""
                    events.append(f"Dialogue: 1,{_ass_time(t0_)},{_ass_time(t1_)},KitK,,0,0,0,,"
                                  f"{{\\an{al}\\pos({x},{y_mid}){pop}}}" + "\\N".join(rows))
                side = 1 - side
                kept += 1
    else:   # comic
        styles.append(fmt_style.format(name="KitC", font=font, size=size, ink=ink, sec="&H000000FF", outl=stroke, back="&H00000000",
                                       bold=0, sp=0, bs=1, ol=round(size / 12, 1), sh=0, al=2, ml=60, mr=60, mv=marginv))
        for ci, (st, en, txt) in enumerate(cues):
            words = timed(ci, st, en, txt)
            parts = _split_one_line(clean(txt), limit)
            n = 0
            for pi, part in enumerate(parts):
                k = len(part.split())
                a = words[n][1] if n < len(words) else st
                b = (words[n + k][1] if n + k < len(words) else en + hold)
                n += k
                if muted(a, b):
                    continue
                events.append(f"Dialogue: 1,{_ass_time(a)},{_ass_time(max(a + 0.25, b))},KitC,,0,0,0,,"
                              f"{{\\fscx80\\fscy80\\t(0,90,\\fscx100\\fscy100)}}{part}")
                kept += 1
    ovl_styles, ovl_events = _overlay_ass(out_ass.parent, mute, style)
    head = ("[Script Info]\nScriptType: v4.00+\n"
            f"PlayResX: {VIDEO_W}\nPlayResY: {VIDEO_H}\n"
            "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, "
            "Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, "
            "MarginV, Encoding\n" + "".join(s + "\n" for s in styles) + "".join(line + "\n" for line in ovl_styles)
            + "\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    out_ass.write_text(head + "\n".join(events + ovl_events) + "\n", encoding="utf-8")
    _build_burn_ass.click_times = []
    log(f"captions ({mode}, {font} {size}px): {kept} lines" + (f", {len(ovl_events)} label events" if ovl_events else ""))
    return out_ass


def _build_burn_ass(srt: Path, out_ass: Path, mute_ranges: list = None,
                    center: bool = False, style: str = "", captions: bool = True) -> Path:
    """Build the subtitle file that actually gets burned in.

    Written as ASS rather than handing the SRT to force_style, because that route
    scales sizes by PlayResY=288 (so "27" landed near 100px on 1080p — far too big)
    and gives no way to fade a cue in or to silence a stretch of the timeline.
    Here: real pixel sizes, ONE line per cue, a soft fade on every cue, and nothing
    drawn at all while a motion-graphics scene is on screen.
    """
    accent = _caption_accent(style)
    mute = list(mute_ranges or [])
    cues = _parse_srt_full(srt.read_text(encoding="utf-8"))
    size = int(SUB_SIZE_CENTER_PX if center else SUB_SIZE_PX)
    font = SUB_FONT_SERIF if center else SUB_FONT
    limit = int(SUB_LINE_CHARS)
    # A channel may restyle its captions: bigger, heavier, upper case, thicker
    # outline. Story channels live on this — the caption is half the frame.
    cap = STYLE_CAPTIONS.get(style) or {}
    # a kit style may switch its captions off (captions.off) or into one of the kit modes (captions.mode):
    # cluster, typewriter, shout, pop, comic — see _build_burn_ass_kit
    if cap.get("off"):
        captions = False
    if captions and str(cap.get("mode") or "").lower() in ("cluster", "typewriter", "shout", "pop", "comic", "pill", "stack"):
        return _build_burn_ass_kit(srt, out_ass, mute, style, cap, str(cap["mode"]).lower(), center)
    size = int(cap.get("size") or size)
    font = str(cap.get("font") or font)
    limit = int(cap.get("line_chars") or limit)
    upper = bool(cap.get("upper"))
    thick = float(cap.get("outline") or 1.0)
    # "karaoke": false keeps every word the same colour — a documentary caption sits still
    karaoke = cap.get("karaoke") is not False
    soft = float(cap.get("shadow") or 1.0)

    def muted(a: float, b: float) -> bool:
        # drop a cue that overlaps a scene window at all — a half-shown line
        # blinking on at the cut looks worse than simply not being there
        return any(a < e and b > s for s, e in mute)

    events, kept, dropped = [], 0, 0
    if not captions:                  # labels only: no caption lines at all
        cues = []
    kin = _kinetic_events(cues, KIN_UNTIL, muted) if KIN_UNTIL > 0 and captions else []
    events.extend(kin)
    kin_starts = []
    for line in kin:
        try:
            t = line.split(",")[1]
            h, m, sec = t.split(":")
            kin_starts.append(int(h) * 3600 + int(m) * 60 + float(sec))
        except (ValueError, IndexError):
            pass
    def trimmed(a: float, b: float):
        # a cue that only grazes a scene window — its last or first few tenths of a second — keeps the part
        # on the footage ("And the 2026 World Cup?" ending as the collage cuts in); a real overlap is dropped
        for s, e in mute:
            if a < e and b > s:
                if b - s <= 0.5 and s - a >= 0.8:
                    b = s
                elif e - a <= 0.5 and b - e >= 0.8:
                    a = e
                else:
                    return None
        return a, b

    # the voice's own clock for every word: a long cue's lines and highlights land on the words, not on letters
    clock = _word_clock(srt.parent, srt) if captions and cues else {}
    for ci, (st, en, txt) in enumerate(cues):
        if st < KIN_UNTIL:            # the opening is carried by the kinetic lines
            continue
        ab = trimmed(st, en)
        if ab is None:
            dropped += 1
            continue
        st, en = ab
        parts = _split_one_line(txt.upper() if upper else txt, limit)
        span = (en - st) / len(parts)
        wt = clock.get(ci) if clock.get(ci) and len(clock[ci]) == len(txt.split()) else None
        firsts = []
        for part in parts:
            firsts.append(sum(len(x.split()) for x in parts[:len(firsts)]))
        for i, line in enumerate(parts):
            a = st + i * span
            b = a + span
            if wt:
                # a line comes up as its first word is said and goes as the next line's first word begins
                a = st if i == 0 else max(st, wt[firsts[i]][0] - 0.06)
                b = en if i == len(parts) - 1 else min(en, max(a + 0.3, wt[firsts[i + 1]][0] - 0.06))
            if muted(a, b):
                dropped += 1
                continue
            line = line.replace("\\", "").replace("{", "(").replace("}", ")")
            if not karaoke:
                events.append(f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},Def,,0,0,0,,"
                              f"{{\\fad({SUB_FADE_MS},{SUB_FADE_MS})}}{line}")
                kept += 1
                continue
            # The word being spoken sweeps to the accent colour and back — the
            # highlight travels with the voice. Word times are shared out by
            # length, the same estimate the intro clicks already rely on.
            words = line.split()
            if wt:
                # each word lights as the voice says it (a hair early, so the eye is there when the ear is)
                own = wt[firsts[i]:firsts[i] + len(words)]
                marks = [max(0.0, x[0] - a - 0.04) for x in own] + [max(0.0, min(b - a, own[-1][1] - a))]
            else:
                weights = [max(2, len(w)) for w in words]
                tot = float(sum(weights)) or 1.0
                marks, acc = [], 0.0
                for wgt in weights:
                    marks.append((b - a) * 0.92 * (acc / tot))
                    acc += wgt
                marks.append((b - a) * 0.92)
            chunks = []
            for wi, w in enumerate(words):
                on = int(marks[wi] * 1000)
                off = int(marks[wi + 1] * 1000)
                chunks.append(
                    f"{{\\1c&HFFFFFF&"
                    f"\\t({on},{min(off, on + 90)},\\1c{accent})"
                    f"\\t({off},{off + 90},\\1c&HFFFFFF&)}}{w}")
            events.append(f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},Def,,0,0,0,,"
                          f"{{\\fad({SUB_FADE_MS},{SUB_FADE_MS})}}{' '.join(chunks)}")
            kept += 1

    align = 5 if center else 2          # 5 = middle-centre, 2 = bottom-centre
    # Distance from the bottom edge for a bottom-anchored caption, so a SMALLER
    # number sits lower. captions.margin_v overrides it per channel.
    marginv = 0 if center else int(cap.get("margin_v") or 96)
    primary = "&H00FFFFFF"
    bold = 0                            # the ExtraBold cut carries the weight itself
    # BorderStyle=3 (a filled box) fragments once the line carries per-word
    # colour tags: libass boxes each coloured run separately, so the pill came
    # out as a row of black blocks with gaps. A heavy outline plus a soft shadow
    # gives the same readability over any footage and never fragments.
    ovl_styles, ovl_events = _overlay_ass(out_ass.parent, mute, style)
    # 1 = a stroke around each letter, 3 = a filled band behind the line. A band
    # reads calmer over busy footage than a heavy outline does, and it is what a
    # documentary caption looks like; captions.box asks for it.
    border_style = 3 if cap.get("box") else 1
    k = size / 56.0
    outline = round(4.2 * k * thick, 2)
    # Near-black by default; a channel can ask for a true black stroke (or any
    # other) with captions.outline_colour, in ASS &HBBGGRR order.
    outline_colour = str(cap.get("outline_colour") or "&H00121212")
    shadow = round(3.2 * k * (1.0 + (thick - 1.0) * 0.5) * soft, 2)
    head = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {VIDEO_W}\nPlayResY: {VIDEO_H}\n"
        "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, "
        "Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, "
        "MarginV, Encoding\n"
        f"Style: Def,{font},{size},{primary},&H000000FF,{outline_colour},&H64000000,{bold},0,0,0,"
        f"100,100,0,0,{border_style},{outline},{shadow},{align},80,80,{marginv},1\n\n"
        f"Style: Kin,{KIN_FONT},{KIN_SIZE},&H00FFFFFF,&H000000FF,&H00101010,&H96000000,-1,0,0,0,"
        f"100,100,0,0,1,{round(size / 12, 1)},{round(SUB_SHADOW * 1.2, 1)},5,120,120,0,1\n\n"
        + "".join(line + "\n" for line in ovl_styles) + "\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    out_ass.write_text(head + "\n".join(events + ovl_events) + "\n", encoding="utf-8")
    if ovl_events:
        log(f"text labels: {sum(1 for e in ovl_events if ',OvlRule,' not in e)} lines on the footage")
    _build_burn_ass.click_times = kin_starts
    log(f"subtitles: {kept} lines + {len(kin)} kinetic (one line, max {limit} chars, {size}px)"
        + (f", {dropped} suppressed under graphics scenes" if dropped else ""))
    return out_ass



def _match_cue_times(topics: list, srt_text: str, total: float) -> list:
    """Find when each topic starts in the audio by locating its 'cue' phrase in the
    SRT; fall back to proportional spacing. Returns a monotonic list of start times."""
    entries = _parse_srt(srt_text)
    times = []
    for i, tp in enumerate(topics):
        cue = re.sub(r"\s+", " ", (tp.get("cue") or "")).strip().lower()
        st = None
        if cue and entries:
            key = " ".join(cue.split()[:4])  # first few words — robust to punctuation drift
            for s, txt in entries:
                low = txt.lower()
                if cue in low or (key and key in low):
                    st = s
                    break
        if st is None:
            st = (i / max(1, len(topics))) * total
        times.append(max(0.0, min(total, st)))
    for i in range(1, len(times)):        # enforce increasing order
        if times[i] < times[i - 1]:
            times[i] = times[i - 1]
    if times:
        times[0] = 0.0
    return times


# The narrator asks for a subscribe and a comment somewhere in the opening. Those
# two moments get purpose-built scenes instead of another generic statement card.
# Transcripts arrive with and without diacritics, so both spellings match.
_CTA_SUB_RE = re.compile(r"subscrib|odb[ěe]r|odeb[íi]r|přihlas|prihlas", re.I)
_CTA_COM_RE = re.compile(r"\bcomments?\b|koment", re.I)

# The CTA scene, in the narration's language. English is what ships; the
# Czech pair is left in as a worked example of a second language — copy its
# shape for yours and key it the same way.
_CTA_COPY = {
    ("subscribe", True): {
        "template": "subscribe", "value": "ODEBÍRAT",
        "title": "9 z 10 lidí, co tohle sledují, tu odběr nemá",
        "subtitle": "Jedno kliknutí — a další díl ti neuteče."},
    ("subscribe", False): {
        "template": "subscribe", "value": "SUBSCRIBE",
        "title": "90% of the people watching this aren't subscribed",
        "subtitle": "One click. It is how the next one finds you."},
    ("comment", True): {
        "template": "comment", "title": "Napiš mi to do komentářů",
        "items": [{"label": "Kde tě to chytlo nejvíc?"},
                  {"label": "Co si z toho odnášíš?"}],
        "subtitle": "Čtu je — a odpovídám."},
    ("comment", False): {
        "template": "comment", "title": "Tell me in the comments",
        "items": [{"label": "Which part landed hardest?"},
                  {"label": "What are you taking with you?"}],
        "subtitle": "I read them — and I answer."},
}


def _apply_cta_scenes(specs: list, chunks: list, style: str, job: Path = None) -> int:
    """Replace the scene for the minute where the ask is actually spoken.

    Matching the transcript rather than picking a fixed timestamp is what keeps
    the picture honest: the bell appears exactly while the voice says "subscribe",
    not a minute before it. Only the first mention of each is used, and only in
    the opening stretch, so a passing later mention doesn't hijack a scene.
    """
    cz = "CZECH" in ((_job_language(job, style) if job else
                      STYLE_LANGUAGE.get(style, "English")).upper())
    # The whole runtime is searched, not just the opening. The prompt asks for the
    # CTA around 55-65%, but the model routinely writes it as a closing beat — and
    # a scene that appears where the ask ISN'T spoken is worse than no scene. Only
    # the FIRST mention of each is used, which is always the real ask.
    used = 0
    for kind, rx in (("subscribe", _CTA_SUB_RE), ("comment", _CTA_COM_RE)):
        for i in range(len(specs)):
            if i >= len(specs) or specs[i].get("template") in ("subscribe", "comment"):
                continue
            if rx.search(chunks[i] or ""):
                specs[i] = dict(_CTA_COPY[(kind, cz)])
                used += 1
                break
    return used


# The opening is rendered as graphics rather than burnt-in captions: the
# teacher's portrait on the left, the spoken words composed on the right.
INTRO_CAP_LEN = float(os.environ.get("INTRO_CAP_LEN", "30"))


# Words that carry no weight — never the emphasis, and set small so the words
# that DO carry the line stand out against them.
_SMALL_WORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
    "is", "was", "it", "he", "she", "you", "i", "that", "this", "as", "so",
    "with", "from", "by", "not", "his", "her", "my", "your", "had", "has",
    "a", "i", "v", "ve", "na", "se", "si", "to", "je", "byl", "byla", "že",
    "a", "ale", "co", "kdy", "kde", "jak", "už", "za", "do", "od", "po", "s",
    "z", "ze", "o", "u", "mu", "ho", "ji", "jsem", "jsi", "ten", "ta", "tak",
}


def _cue_words(text: str, t0: float, t1: float) -> list:
    """Split one subtitle cue into words with a spoken time and a weight class.

    SRT gives a start and an end for the whole cue, not per word, so the span is
    shared out by word length — long words take longer to say than short ones,
    and spacing them that way tracks the voice far better than an even split.

    The size class is what turns a sentence into a composition: the strongest
    word is set large and in the accent colour, ordinary words mid-size, and
    the connective words small — so the block reads as a shape rather than a
    paragraph dropped on the page.
    """
    words = [w for w in re.split(r"\s+", (text or "").strip()) if w]
    if not words:
        return []
    weights = [max(2, len(w)) for w in words]
    span = max(0.35, (t1 - t0) * 0.78)      # land them early, then let it hold
    tot = float(sum(weights))

    def bare(w):
        return re.sub(r"[^\w]", "", w, flags=re.UNICODE).lower()

    # the emphasis is the longest word that actually carries meaning
    ranked = [i for i in range(len(words)) if bare(words[i]) not in _SMALL_WORDS]
    hero_at = max(ranked or range(len(words)), key=lambda i: len(bare(words[i])))
    if len(bare(words[hero_at])) < 4:
        hero_at = -1

    out, acc = [], 0.0
    for i, w in enumerate(words):
        b = bare(w)
        out.append({"w": w, "t": round(t0 + span * (acc / tot), 3),
                    "hero": i == hero_at,
                    "sz": "s" if (b in _SMALL_WORDS or len(b) <= 3) else "m"})
        acc += weights[i]
    return out


def build_intro_caption(srt: Path, job: Path, style: str, force: bool,
                        dur: float = 0.0) -> tuple:
    """Render the opening as ONE motion scene. Returns (0.0, path, dur) or None.

    Handed back in the same shape as the other motion segments, so it drops
    straight into the timeline — which also means the burnt-in subtitles are
    suppressed across it for free, instead of doubling up with the words on
    screen.
    """
    dur = float(dur or INTRO_CAP_LEN)
    out = job / "motion" / "introcap.mp4"
    if out.exists() and not force:
        return (0.0, out, _video_dur(out) or dur)
    out.unlink(missing_ok=True)          # same skip-if-exists hazard as the scenes
    if not srt.exists():
        return None
    faces = motion.person_photos(style)
    if not faces:
        log("  intro: this channel ships no portrait — keeping the normal opening")
        return None

    groups = []
    pending: list = []
    for st, en, txt in _parse_srt_full(srt.read_text(encoding="utf-8")):
        if st >= dur:
            break
        words = _cue_words(txt, st, min(en, dur))
        if not words:
            continue
        # One short cue on its own leaves the column nearly empty, so cues are
        # accumulated until the block has enough words to read as a composition,
        # then flushed. A long cue flushes immediately.
        pending.extend(words)
        if len(pending) >= 6:
            groups.append(pending)
            pending = []
    if pending:
        if groups and len(pending) < 3:
            groups[-1].extend(pending)      # a stray tail joins the block before it
        else:
            groups.append(pending)
    groups = [{"t0": round(g[0]["t"], 3),
               "t1": round(min(dur, g[-1]["t"] + 2.0), 3),
               "words": g[:11]} for g in groups]
    if not groups:
        return None
    # each block clears when the next one starts, so they never stack up
    for a, b in zip(groups, groups[1:]):
        a["t1"] = min(a["t1"], b["t0"] + 0.22)

    spec = {"template": "introcap", "title": "", "subtitle": ""}
    sc = motion.plan_scenes([spec], dur, style=style,
                            seed=abs(hash(job.name)) % 997)[0]
    sc["template"] = "introcap"          # never let the planner swap this one out
    sc["groups"] = groups
    sc["duration"] = dur
    sc["image"] = motion.image_data_uri(faces[0], 900)
    g = motion.style_ground(style)
    if g:
        sc["ground_path"] = str(g)
    sc["card"] = motion.style_is_dark(style)
    # The click lands on the words the eye actually jumps to. Clicking every
    # phrase turned the opening into a typewriter; only the emphasised word of
    # each block gets one, so the sound marks something.
    clicks = [w["t"] for g in groups for w in g["words"] if w.get("hero")]
    (job / "motion" / "intro_clicks.json").write_text(json.dumps(clicks), encoding="utf-8")

    out.parent.mkdir(parents=True, exist_ok=True)
    log(f"intro: rendering the opening scene from the subtitles ({len(groups)} blocks, {dur:.0f}s)...")
    motion.render_scenes([(sc, out)], workdir=job / "motion" / "_introframes", workers=1)
    return (0.0, out, dur) if out.exists() else None


PHOTO_LIB = HERE / "assets" / "photolib"
_LIB_CACHE: dict = {}


def _fold(text: str) -> str:
    """Lowercase and strip diacritics, so a Czech scene matches English tags."""
    import unicodedata
    n = unicodedata.normalize("NFKD", (text or "").lower())
    return "".join(c for c in n if not unicodedata.combining(c))


def _photolib() -> list:
    """The local stock library, loaded once. Empty until it has been built."""
    if "entries" not in _LIB_CACHE:
        idx = PHOTO_LIB / "index.json"
        entries = []
        if idx.exists():
            try:
                for e in json.loads(idx.read_text(encoding="utf-8")).values():
                    fp = HERE / e.get("path", "")
                    if fp.exists():
                        e = dict(e)
                        e["file"] = fp
                        e["_tags"] = [_fold(t) for t in (e.get("tags") or [])]
                        entries.append(e)
            except (ValueError, OSError):
                entries = []
        _LIB_CACHE["entries"] = entries
        if entries:
            log(f"  photo library: {len(entries)} images available locally")
    return _LIB_CACHE["entries"]


def pick_lib_photo(style: str, text: str, used: set):
    """The library photo that best fits this scene's words, or None.

    Scored on how many of a theme's tags actually appear in what the narrator is
    saying, so the picture illustrates the line instead of being the next one in
    a list. Photos from the video's own style are preferred but not required —
    a storm is a storm whichever teacher is speaking.
    """
    entries = _photolib()
    if not entries:
        return None
    hay = _fold(text)
    best, best_score = None, 0
    for e in entries:
        if str(e["file"]) in used:
            continue
        score = sum(1 for t in e["_tags"] if t and t in hay)
        if not score:
            continue
        score = score * 2 + (1 if e.get("style") == style else 0)
        if score > best_score:
            best, best_score = e, score
    return best["file"] if best else None


def _with_intro_caption(segs: list, srt: Path, job: Path, style: str, force: bool) -> list:
    """Put the graphics opening at the front, dropping any scene it covers.

    It is handed back as a normal motion segment, which is what makes the rest
    of the pipeline treat it correctly for free — burnt-in subtitles and the
    dust overlay are both suppressed wherever a motion segment sits.
    """
    intro = build_intro_caption(srt, job, style, force)
    if not intro:
        return segs
    end = intro[0] + intro[2]
    kept = [s_ for s_ in segs if s_[0] >= end - 0.5]
    return [intro] + kept


def _with_scene_dlcs(segs: list, srt: Path, job: Path, style: str, force: bool) -> list:
    """Scene DLCs — MAPS, HEADLINES and PHOTO FX: a map, a real article, a real photo or a real
    object on screen, wherever the narration calls for one. Each hands the graphics timeline back
    with its scenes added.

    Dormant for a DLC that is not installed. They are an extra, never a reason to lose a
    video: anything going wrong inside one is logged and the timeline goes on as it was."""
    import importlib
    # A channel can keep its opening seconds for footage (pacing.cold_open_s): a stand-in scene holds
    # them while the modules place theirs, and is taken out again afterwards.
    cold = float(((STYLE_INFO.get(style) or {}).get("pacing") or {}).get("cold_open_s") or 0)
    hold = str(job / "motion" / "introcap_coldopen.mp4")
    if cold > 0 and not any(float(a) < cold for a, _, _ in segs):
        segs = [(0.0, hold, cold)] + list(segs)
    for name in SCENE_DLCS:
        if name in _DLC_OFF or not (HERE / f"{name}.py").exists():
            continue
        if name == "vox" and not _FEATURES.get("vox"):     # Vox scenes are asked for, never assumed
            continue
        try:
            mod = importlib.import_module(name)
            if name == "heygen_scenes" and not mod.enabled(sys.modules[__name__], style):
                continue
            # the engine is handed in: run as `python make_video.py`, an import would load a second copy
            segs = mod.add_to_timeline(segs, srt, job, style, force, workers=max(1, min(3, MOTION_WORKERS)),
                                       engine=sys.modules[__name__])
        except (Exception, SystemExit) as e:      # noqa: BLE001 - a scene DLC is never worth the video
            log(f"{name}: skipped this time — {type(e).__name__}: {str(e)[:200]}")
    return [x for x in segs if str(x[1]) != hold]


def _depth_dlc(plan: list, style: str, job: Path, candidates: list) -> tuple:
    """PHOTO FX's depth pop: (module, the slots that get it, out of `candidates`) — (None, empty
    set) when the DLC is not installed or is switched off in Options. Only stills of people and
    vehicles get it; Claude's look at them is kept in the job folder."""
    if "depth" in _DLC_OFF or not (HERE / "photofx.py").exists():
        return None, set()
    try:
        import importlib
        mod = importlib.import_module("photofx")
        return mod, set(mod.depth_slots(plan, style, sys.modules[__name__], candidates, job=job))
    except Exception as e:                        # noqa: BLE001 - an extra, never a reason to lose a video
        log(f"depth: skipped this time — {type(e).__name__}: {str(e)[:200]}")
        return None, set()


def _depth_segment(mod, image: Path, dur: float, out: Path, job: Path, idx: int, style: str,
                   white_fade: float) -> bool:
    """One still with the depth pop. False — and the plain zoom — whenever it cannot be done: no
    clear subject in the picture, no WaveSpeed balance, anything at all."""
    try:
        return bool(mod.depth_segment(sys.modules[__name__], image, dur, out, job, idx=idx, style=style,
                                      white_fade=white_fade))
    except Exception as e:                        # noqa: BLE001
        log(f"  depth: slot {idx} keeps the plain zoom — {type(e).__name__}: {str(e)[:160]}")
        out.unlink(missing_ok=True)
        return False


def generate_motion_segments(script: str, srt: Path, job: Path, total: float, force: bool,
                             start_min: float = 0.0, style: str = "",
                             every_min: float = 0.0, seg_dur_override: float = 0.0,
                             motion_ratio: float = 0.0) -> list:
    """For EACH minute, design ONE motion-graphics scene that VISUALISES what the
    narrator says in that minute (chart, cards, checklist, counting stat, icon
    flow...) and render it to its own clip. Returns [(start, path, dur)].

    Minute 1 is the intro, so by default a scene opens the video too. `start_min`
    can push the first scene later (e.g. 1 = nothing before 1:00); the skipped
    minutes are DROPPED, not shifted, so a scene always matches the minute it
    plays over."""
    mo_dir = job / "motion"
    mo_dir.mkdir(exist_ok=True)
    # One scene every `every_min` minutes (settable per job), each `seg_dur` long.
    # The mix slider decides how much of the video is graphics; the channel's own
    # cadence stays in charge whenever the sliders are left at their defaults.
    _mix_dur = float(seg_dur_override or _mix_seg_dur(MOTION_DEFAULT_DUR))
    step_s = max(20.0, float(every_min or _mix_every_min(_mix_dur)
                             or STYLE_EVERY_MIN.get(style) or MOTION_EVERY_MIN) * 60.0)
    ratio = float(motion_ratio or STYLE_MOTION_RATIO.get(style, 0.0))
    # A graphic runs for a FIXED beat — six seconds — not for a share of the
    # gap between graphics. Deriving the length from the interval is what
    # produced twenty-second scenes: past about ten seconds a graphic stops
    # being an edit and becomes a slide. The ratio only pulls it shorter, when
    # the interval is too tight to give it the full beat.
    seg_dur = _mix_dur
    if ratio > 0:
        seg_dur = min(seg_dur, min(0.75, ratio) * step_s)
    seg_dur = max(5.0, min(seg_dur, step_s - 5.0, MOTION_MAX_DUR))
    n_min = max(1, int(math.ceil(total / step_s)))
    # The Documentary look draws its own graphics: real facts, quiet type, no stickers (docgfx.py).
    if str(((STYLE_INFO.get(style) or {}).get("look") or {}).get("graphics") or "").lower() == "documentary":
        import docgfx
        # its cadence is the channel's own (pacing.graphic_every_min), not the one the mix implies:
        # maps, headlines, photos and collage scenes fill the rest of the graphics share
        doc_step = float(every_min or STYLE_EVERY_MIN.get(style) or 0) * 60.0 or step_s
        return docgfx.generate(sys.modules[__name__], srt, job, total, force, style, max(30.0, doc_step), seg_dur)
    if str(((STYLE_INFO.get(style) or {}).get("look") or {}).get("graphics") or "").lower() == "kit":
        # a look kit (kits.py): its own scene types in its own design system, on the words they belong to
        import kits
        doc_step = float(every_min or STYLE_EVERY_MIN.get(style) or 0) * 60.0 or step_s
        return kits.generate(sys.modules[__name__], srt, job, total, force, style, max(30.0, doc_step), seg_dur)

    # chunk the transcript into those same windows, so a scene always matches
    # the stretch of narration it plays over
    entries = _parse_srt(srt.read_text(encoding="utf-8"))
    chunks = ["" for _ in range(n_min)]
    for start, text in entries:
        m = int(start // step_s)
        if 0 <= m < n_min:
            chunks[m] += " " + text

    spec_file = mo_dir / "scenes.json"
    cached = []
    if spec_file.exists() and not force:
        cached = json.loads(spec_file.read_text(encoding="utf-8"))
    # A cached file was written for whatever cadence was in force at the time.
    # Raising the cadence needs MORE scenes, and a short file left the tail of
    # the video with blank fallback graphics — a spec was simply missing for
    # those slots. Short means re-ask, not pad with nothing.
    if cached and len(cached) >= n_min:
        specs = cached[:n_min]
    else:
        if cached:
            log(f"motion: cache holds {len(cached)} scenes, {n_min} needed — topping up")
        chunk_text = "\n\n".join(
            f"PART {i+1} ({int(i*step_s)//60}:{int(i*step_s)%60:02d}-"
            f"{int((i+1)*step_s)//60}:{int((i+1)*step_s)%60:02d}):\n"
            f"{(chunks[i].strip() or '(short transition)')}" for i in range(n_min))
        log(f"Claude: designing {n_min} graphics scenes (from what each part actually says)...")
        specs = _json_items(prompts.MOTION_MINUTES_PROMPT
                            .replace("[INSERT CHUNKS HERE]", chunk_text)
                            .replace("[INSERT CUTOUTS HERE]", ", ".join(sorted(motion.CUTOUTS)))
                            .replace("[INSERT LANGUAGE HERE]", _job_language(job, style)) + _extra_block(),
                            max_tokens=max(6000, n_min * 300))
        if not specs:
            sys.exit("motion: Claude returned no scenes")
        # Pad by CYCLING, not by repeating the last one: a short reply used to
        # turn the whole tail of the video into the same scene over and over.
        if not specs:
            specs = [{"template": "title", "title": "..."}]
        base = list(specs) + [x for x in cached if x not in specs]
        while len(specs) < n_min:
            specs.append(dict(base[len(specs) % len(base)]))
        specs = specs[:n_min]
        spec_file.write_text(json.dumps(specs, indent=2), encoding="utf-8")

    n_cta = _apply_cta_scenes(specs, chunks, style, job)
    if n_cta:
        log(f"  CTA scenes: {n_cta} (placed where the narrator actually asks)")

    # The scene spec is built for EVERY minute above, so changing the offset never
    # re-asks Claude — only which minutes get rendered changes.
    skip_before = max(0.0, float(start_min)) * 60.0

    # Planned as a whole run so two neighbouring scenes never look alike.
    # Seed from the job name so every video shuffles differently — same scene
    # spec in two episodes still lands as a different-looking page.
    vseed = abs(hash(job.name)) % 997
    scenes = motion.plan_scenes(specs, seg_dur, style=style, seed=vseed)

    # "image" scenes are built around a REAL generated still. Chromium renders each
    # scene from a string with no file access, so the picture is inlined as a data
    # URI. Scenes that don't get one fall back to a text layout in scene_from_spec.
    # ── the collage look: aged-paper ground, real cut-out stickers, teacher photos ──
    ground = motion.style_ground(style)
    # A style with no paper page has nothing to paste stickers onto — the black
    # halftone just sinks into its own background. Keep it on its own templates.
    if ground is None:
        for s_ in scenes:
            if s_.get("template") in ("collage", "scatter", "pillars", "photonote"):
                s_["template"] = "cards" if (s_.get("items") or []) else "title"
                s_.pop("cutouts", None)
    dark = motion.style_is_dark(style)
    faces = motion.person_photos(style)
    fi = 0
    for i, s_ in enumerate(scenes):
        # a glass/noir scene paints its own dark backdrop — taping the paper
        # page over it turned white ink unreadable on cream
        if ground and s_.get("skin") not in ("glass", "noir"):
            s_["ground_path"] = str(ground)
        s_["card"] = dark                       # paper backing so black art shows on dark
        tpl = s_.get("template")
        if tpl in ("collage", "scatter", "pillars"):
            want = {"collage": 3, "scatter": 8, "pillars": 3}[tpl]
            names = ["ancient_pilar"] * 3 if tpl == "pillars" else (s_.get("cutouts") or [])
            # STRICT: only stickers that genuinely mean what the caption says.
            got = motion.pick_cutouts(names, want, i + vseed, strict=True)
            floor = {"collage": 1, "scatter": 4, "pillars": 3}[tpl]
            if len(got) < floor:
                # nothing honest to paste — fall back to a text layout rather
                # than captioning a Bible with the word "Mirror"
                s_["template"] = "cards" if (s_.get("items") or []) else "title"
                s_.pop("cutouts", None)
            else:
                s_["cutout_names"] = got
                # trim the copy to the stickers we actually have
                if tpl == "collage" and s_.get("items"):
                    s_["items"] = s_["items"][:len(got)]
        elif tpl == "photonote":
            if faces:
                s_["image"] = motion.image_data_uri(faces[fi % len(faces)], 900)
                fi += 1
            else:
                s_["template"] = "title"        # no portrait available for this style

    # The opening scene is the one that decides whether anyone stays, so it gets
    # the busiest treatment: the teacher's photograph, stickers sweeping in and
    # the title writing itself on — rather than whatever template happened to
    # come back for part one.
    if scenes and ground:
        op = scenes[0]
        op["template"] = "opener"
        if faces:
            op["image"] = motion.image_data_uri(faces[0], 900)
        op["cutout_names"] = motion.pick_cutouts(op.get("cutouts"), 6, vseed) or \
            motion.pick_cutouts([], 6, vseed)

    pool = sorted((job / "images").glob("scene_*.jpg")) or sorted((job / "images").glob("*.jpg"))
    # The local library is tried first and matched against what the scene SAYS;
    # the generated pool is the fallback for scenes nothing in it fits.
    lib_used, pi = set(), 0
    for sc in scenes:
        if sc.get("template") != "image":
            continue
        want = f"{sc.get('title', '')} {sc.get('subtitle', '')} " + \
               " ".join(str(i.get("label", "")) + " " + str(i.get("text", ""))
                        for i in (sc.get("items") or []))
        lp = pick_lib_photo(style, want, lib_used)
        if lp is not None:
            sc["image"] = motion.image_data_uri(lp)
            lib_used.add(str(lp))
        elif pool:
            sc["image"] = motion.image_data_uri(pool[pi % len(pool)])
            pi += 1
        if not sc.get("image"):
            sc["template"] = "title"

    render_jobs, seg_list, used = [], [], []
    for m in range(n_min):
        start = m * step_s
        if start < skip_before - 0.01:                # intro window — visuals only
            continue
        if start + 5.0 >= total:                      # no room for a scene this late
            break
        sc = scenes[m] if m < len(scenes) else motion.scene_from_spec({}, m, seg_dur)
        out = mo_dir / f"scene_{m:02d}.mp4"
        seg_list.append((start, str(out), seg_dur))
        used.append(sc["template"])
        if not (out.exists() and not force):
            # The renderer skips an output that already exists, so a retry
            # resumes instead of redoing finished work. That also meant a forced
            # re-run silently kept the PREVIOUS video's scenes while scenes.json
            # described new ones — graphics that no longer matched the script.
            if force:
                out.unlink(missing_ok=True)
            render_jobs.append((sc, out))

    if render_jobs:
        log(f"motion: rendering {len(render_jobs)} scenes in Chromium ({MOTION_WORKERS} workers)...")
        motion.render_scenes(render_jobs, workers=MOTION_WORKERS, workdir=mo_dir / "_render")
    intro = f", starting at {skip_before / 60.0:.0f} min" if skip_before > 0 else ", including the opening"
    log(f"motion: {len(seg_list)} scenes ({seg_dur:.0f}s each, every {step_s/60.0:g} min{intro}) — "
        f"{', '.join(used[:8])}"
        + (" ..." if len(used) > 8 else ""))
    return seg_list


def generate_mindmap_only(script: str, srt: Path, job: Path, total: float, force: bool) -> Path:
    """Build ONE big mindmap from the whole script and render the ENTIRE video as a
    continuous walk across it (synced to the SRT). Returns the full-length mp4."""
    mm_dir = job / "mindmap"
    mm_dir.mkdir(exist_ok=True)
    out = mm_dir / "full.mp4"
    if out.exists() and not force:
        log(f"cached: {out.name}")
        return out
    spec_file = mm_dir / "big.json"
    if spec_file.exists() and not force:
        spec = json.loads(spec_file.read_text(encoding="utf-8"))
    else:
        log("Claude: building one large mindmap from the whole script...")
        arr = _json_items(prompts.MINDMAP_BIG_PROMPT.replace("[INSERT SCRIPT HERE]", script), max_tokens=8000)
        spec = arr[0] if arr and isinstance(arr[0], dict) else None
        if not spec or not spec.get("topics"):
            sys.exit("mindmap-only: Claude returned no topics")
        spec_file.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    title = str(spec.get("title", "")).strip() or "Overview"
    topics = spec["topics"]
    times = _match_cue_times(topics, srt.read_text(encoding="utf-8"), total)
    tree = mindmap.big_tree(title, topics)
    cam = mindmap.full_camera(topics, times, total)
    log(f"mindmap-only: rendering the whole video ({total:.0f}s, {len(topics)} topics) in Chromium "
        f"({MINDMAP_FULL_WORKERS} workers, {MINDMAP_FULL_CHUNK:.0f}s chunks)...")
    mindmap.render_full(tree, cam, out, chunk_sec=MINDMAP_FULL_CHUNK,
                        workers=MINDMAP_FULL_WORKERS, workdir=mm_dir / "_full")
    return out


def assemble_mindmap_only(mm_mp4: Path, mp3: Path, srt: Path, job: Path,
                          burn_subs: bool, force: bool, add_qr: bool = False) -> Path:
    """The whole visual IS the big mindmap animation. Burn subtitles + optional QR,
    NO dust (mindmap segments have no dust)."""
    final = job / "video.mp4"
    if final.exists() and not force:
        log(f"cached: {final.name}")
        return final
    total = _audio_dur(mp3)
    vis = job / "_visual.mp4"
    vis.unlink(missing_ok=True)
    try:
        os.link(mm_mp4, vis)          # hardlink (instant, same disk)
    except OSError:
        vis.write_bytes(Path(mm_mp4).read_bytes())
    _final_mux(job, mp3, srt, burn_subs, add_qr=add_qr, vignette=False, no_dust_ranges=[(0.0, total + 2)])
    vis.unlink(missing_ok=True)
    return final


def generate_mindmap_xmind(script: str, srt: Path, job: Path, total: float, force: bool) -> list:
    """XMind screen-recording style: for EACH minute, build a DETAILED nested XMind tree
    (short headings + full-sentence bullets) and render it as a STATIC-camera segment with
    a wandering cursor + occasional text selection (real screen-recording feel). Returns an
    ordered list of segment paths whose durations sum to `total` (whole video is mindmap)."""
    mm_dir = job / "mindmap"
    mm_dir.mkdir(exist_ok=True)
    n_min = max(1, int(math.ceil(total / 60.0)))

    entries = _parse_srt(srt.read_text(encoding="utf-8"))
    chunks = ["" for _ in range(n_min)]
    for start, text in entries:
        m = int(start // 60)
        if 0 <= m < n_min:
            chunks[m] += " " + text

    spec_file = mm_dir / "xmind_minutes.json"
    if spec_file.exists() and not force:
        trees = json.loads(spec_file.read_text(encoding="utf-8"))
    else:
        chunk_text = "\n\n".join(
            f"MINUTE {i+1}:\n{(chunks[i].strip() or '(short transition)')}" for i in range(n_min))
        log(f"Claude: building {n_min} detailed mind maps (one per minute)...")
        trees = _json_items(prompts.MINDMAP_XMIND_PROMPT.replace("[INSERT CHUNKS HERE]", chunk_text),
                            max_tokens=max(8000, n_min * 400))
        if not trees:
            sys.exit("xmind: Claude returned no maps")
        while len(trees) < n_min:
            trees.append(trees[-1] if trees else {"label": "This Minute", "children": []})
        trees = trees[:n_min]
        spec_file.write_text(json.dumps(trees, indent=2), encoding="utf-8")

    render_jobs, seg_paths = [], []
    for m in range(n_min):
        start = m * 60.0
        dur = min(60.0, total - start)
        if dur < 1.0:
            break
        tree = trees[m] if (isinstance(trees[m], dict) and trees[m].get("children")) \
            else {"label": "This Minute", "children": []}
        out = mm_dir / f"xmind_{m:02d}.mp4"
        seg_paths.append(str(out))
        if not (out.exists() and not force):
            render_jobs.append((tree, dur, out))

    if render_jobs:
        log(f"xmind: rendering {len(render_jobs)} per-minute maps (Chromium, {MINDMAP_WORKERS} workers)...")
        mindmap.render_xmind_segments(render_jobs, workers=MINDMAP_WORKERS, workdir=mm_dir / "_xmind")
    log(f"xmind: {len(seg_paths)} segments (screen-recording style, whole video)")
    return seg_paths


def assemble_xmind_only(seg_paths: list, mp3: Path, srt: Path, job: Path,
                        burn_subs: bool, force: bool, add_qr: bool = False) -> Path:
    """Concatenate the per-minute XMind segments into one visual, then mux voiceover +
    subtitles. No dust, no vignette — it's a clean screen recording."""
    final = job / "video.mp4"
    if final.exists() and not force:
        log(f"cached: {final.name}")
        return final
    total = _audio_dur(mp3)
    segs = [Path(p) for p in seg_paths if Path(p).exists()]
    if not segs:
        sys.exit("xmind: no segments to assemble")
    _concat_segments(segs, job / "_visual.mp4")
    _final_mux(job, mp3, srt, burn_subs, add_qr=add_qr, vignette=False, no_dust_ranges=[(0.0, total + 2)])
    (job / "_visual.mp4").unlink(missing_ok=True)
    return final


def generate_mindmap_xmind_big(script: str, srt: Path, job: Path, total: float, force: bool) -> Path:
    """Rodriguez / XMind style: ONE big xmind map from the whole script, and the camera
    TRAVELS + zooms across it to each topic exactly when the narrator reaches it (cue times
    from the SRT). Returns the full-length mp4 (continuous moving camera)."""
    mm_dir = job / "mindmap"
    mm_dir.mkdir(exist_ok=True)
    out = mm_dir / "xmind_full.mp4"
    if out.exists() and not force:
        log(f"cached: {out.name}")
        return out
    spec_file = mm_dir / "xmind_big.json"
    if spec_file.exists() and not force:
        tree = json.loads(spec_file.read_text(encoding="utf-8"))
    else:
        log("Claude: building one large mind map from the whole script...")
        arr = _json_items(prompts.MINDMAP_XMIND_BIG_PROMPT.replace("[INSERT SCRIPT HERE]", script), max_tokens=9000)
        tree = arr[0] if (arr and isinstance(arr[0], dict) and arr[0].get("children")) else None
        if not tree:
            sys.exit("xmind-big: Claude returned no tree")
        spec_file.write_text(json.dumps(tree, indent=2), encoding="utf-8")

    topics = tree.get("children") or []
    times = _match_cue_times(topics, srt.read_text(encoding="utf-8"), total)
    keys = [{"t": 0.0, "ni": -1}]                      # open on the whole map (root)
    for i, tt in enumerate(times):
        keys.append({"t": round(max(0.4, tt), 2), "ni": i})
    for k in range(1, len(keys)):                      # strictly increasing
        if keys[k]["t"] <= keys[k - 1]["t"]:
            keys[k]["t"] = min(total, keys[k - 1]["t"] + 0.3)
    keys.append({"t": float(total), "ni": (len(topics) - 1) if topics else -1})
    camera = {"duration": float(total), "move_dur": 1.7, "keys": keys}
    log(f"xmind-big: rendering the whole video ({total:.0f}s, {len(topics)} topics), moving camera "
        f"({MINDMAP_FULL_WORKERS} workers, {MINDMAP_FULL_CHUNK:.0f}s chunks)...")
    mindmap.render_xmind_full(tree, camera, out, chunk_sec=MINDMAP_FULL_CHUNK,
                              workers=MINDMAP_FULL_WORKERS, workdir=mm_dir / "_xfull")
    return out


def assemble_video(ai_pairs: list, pexels: list, mp3: Path, srt: Path,
                   job: Path, burn_subs: bool, force: bool, add_qr: bool = False) -> Path:
    final = job / "video.mp4"
    if final.exists() and not force:
        log(f"cached: {final.name}")
        return final

    total = _audio_dur(mp3)
    plan = _build_or_load_plan(job, total, ai_pairs, pexels, force)
    segs = _render_segments(plan, job, force)
    _concat_segments(segs, job / "_visual.mp4")
    _final_mux(job, mp3, srt, burn_subs, add_qr)
    (job / "_visual.mp4").unlink(missing_ok=True)
    return final


def _cached_motion_plan(job: Path, mm: list, selection=None):
    """Return a reusable cached plan.json, or None when it must be rebuilt.

    The mindmap cadence is what shapes the whole timeline, so a plan built with a
    different first-mindmap offset is stale — without this a re-run would silently
    reuse the old timeline and the new offset would look like it did nothing.
    Plans written before this guard existed have no meta file and were always
    offset 0, so that is the assumed default."""
    plan_file = job / "plan.json"
    if not plan_file.exists():
        return None
    first = round(float(mm[0][0]), 3) if mm else -1.0
    meta_file = job / "plan_meta.json"
    prev, prev_segs = 0.0, None
    if meta_file.exists():
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            if selection is not None and meta.get("selection") != selection:
                return None
            prev, prev_segs = float(meta.get("mm_first", 0.0)), meta.get("mm")
        except (ValueError, OSError, TypeError, AttributeError):
            prev = 0.0
    if round(prev, 3) != first:
        log(f"plan: the first graphic moved ({prev:.0f}s -> {first:.0f}s) — rebuilding the timeline")
        return None
    # A graphic added or moved further in (a map scene, say) changes the timeline too.
    if prev_segs is not None and prev_segs != _plan_segs(mm):
        log("plan: the graphics changed since the timeline was built — rebuilding it")
        return None
    try:
        cached = [tuple(e) for e in json.loads(plan_file.read_text(encoding="utf-8"))]
        _validate_media_plan(cached, job)
        return cached
    except (ValueError, OSError):
        return None


def _plan_segs(mm: list) -> list:
    """Every graphic's start and file, the way plan_meta.json records them."""
    return [[round(float(s_[0]), 2), Path(s_[1]).name] for s_ in mm]


def _save_motion_plan(job: Path, plan: list, mm: list, selection=None) -> None:
    """Persist the plan plus the graphics it was built for (see _cached_motion_plan)."""
    (job / "plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    (job / "plan_meta.json").write_text(json.dumps(
        {"mm_first": round(float(mm[0][0]), 3) if mm else -1.0, "mm": _plan_segs(mm),
         "selection": selection}), encoding="utf-8")


def _build_motion_plan(job: Path, total: float, ai_pairs: list, pexels: list,
                        mm_segs: list, force: bool) -> list:
    """Manifestation timeline WITH mindmaps: a mindmap segment opens the video and each
    minute; the rest is filled with 15s photo/Pexels slots (AI quote images near their
    spoken time). Variable-duration entries [kind, path, leak(False), dur]."""
    mm = sorted(mm_segs, key=lambda s: s[0])
    if not force:
        cached = _cached_motion_plan(job, mm)
        if cached is not None:
            return cached

    ai = sorted([(float(t), str(p)) for t, p in ai_pairs], key=lambda x: x[0])
    pool = [(a["kind"], str(a["path"])) for a in pexels]
    fallback = [("photo", str(p)) for _, p in ai_pairs]
    # Shuffled once then walked with a modulo ring, the pool replayed the same
    # order for the whole video. A bag reshuffles each lap, so repeats land as
    # far apart as the pool allows — same fix as the other timeline builders.
    b_pool = _Bag(pool or fallback, abs(hash(job.name)) % 9973 + 21)
    plan: list = []
    t = 0.0
    mmi = aii = 0
    while t < total - 0.5:
        if mmi < len(mm) and mm[mmi][0] <= t + 0.01:
            dur = min(mm[mmi][2], total - t)
            plan.append(("motion", str(mm[mmi][1]), False, dur)); t += dur; mmi += 1
            continue
        nxt = mm[mmi][0] if mmi < len(mm) else total
        slot = min(SECONDS_PER_SLOT, nxt - t, total - t)
        if slot < 2.5:            # tiny gap before the next mindmap — stretch the previous
            end = min(nxt, total)   # slot over it instead of leaving a hole (see above)
            if plan:
                pk, pp, pl, pd = plan[-1]
                plan[-1] = (pk, pp, pl, float(pd) + (end - t))
            t = end
            continue
        while aii < len(ai) and ai[aii][0] < t - 0.5:   # drop AI images already behind
            aii += 1
        if aii < len(ai) and ai[aii][0] <= t + slot:    # an AI quote image is due here
            entry = ("photo", ai[aii][1], False, slot); aii += 1
        else:
            got = b_pool.take()
            if got is None:            # no stock and no stills — nothing to show
                break
            entry = (got[0], got[1], False, slot)
        plan.append(entry); t += entry[3]

    plan = _apply_punches(plan, job)
    _save_motion_plan(job, plan, mm)
    mmn = sum(1 for e in plan if e[0] == "motion")
    log(f"plan: {len(plan)} slots — {mmn} graphics scenes, {len(plan) - mmn} photo/video")
    return plan


def assemble_video_motion(ai_pairs: list, pexels: list, mm_segs: list, mp3: Path, srt: Path,
                           job: Path, burn_subs: bool, force: bool, add_qr: bool = False) -> Path:
    """Manifestation assembly WITH mindmap segments (per-minute cadence)."""
    final = job / "video.mp4"
    if final.exists() and not force:
        log(f"cached: {final.name}")
        return final
    total = _audio_dur(mp3)
    plan = _build_motion_plan(job, total, ai_pairs, pexels, mm_segs, force)
    # time windows of the mindmap segments — dust is suppressed there
    no_dust, tt = [], 0.0
    for e in plan:
        dur = float(e[3])
        # a treated slot shows its own line, so captions are muted there too
        if _mutes_captions(e):
            no_dust.append((tt, tt + dur))
        tt += dur
    segs = _render_astro_segments(plan, job, force, zoom_total=0.15)   # manifestation zoom
    _concat_segments(segs, job / "_visual.mp4")
    # no_sub_ranges was missing here while the astrology path had it, so every
    # motion scene — the graphics opening most visibly — got burnt-in captions
    # laid on top of the words the scene was already showing.
    _final_mux(job, mp3, srt, burn_subs, add_qr=add_qr, vignette=False,
               no_dust_ranges=no_dust, no_sub_ranges=no_dust)
    (job / "_visual.mp4").unlink(missing_ok=True)
    return final


def _with_sound_design(job: Path, mp3: Path, plan: list, style: str) -> Path:
    """The narration with Options → Sound design under it (sfx.py), or the narration as it was."""
    if not _FEATURES.get("sound") or not (HERE / "sfx.py").exists():
        return mp3
    try:
        import sfx
        return sfx.mix(sys.modules[__name__], job, mp3, plan, style)
    except Exception as e:                        # noqa: BLE001 - never worth the video
        log(f"sound design: skipped this time — {type(e).__name__}: {str(e)[:160]}")
        return mp3


def assemble_astrology(photos: list, ai_clips: list, pexels_clips: list, mp3: Path, srt: Path,
                       job: Path, burn_subs: bool, force: bool, white_fade: float = 0.0,
                       style: str = "") -> Path:
    """Assemble an astrology video from the photo + AI-clip + Pexels pools, with a
    black vignette + dust overlay and light-leak transitions. No QR."""
    final = job / "video.mp4"
    if final.exists() and not force:
        log(f"cached: {final.name}")
        return final
    total = _audio_dur(mp3)
    plan = _build_astro_plan(job, total, photos, ai_clips, pexels_clips, force)
    # white_fade and style carry the channel's own transitions and zoom; without
    # them a pictures-only channel fell back to hard cuts and a one-way zoom.
    segs = _render_astro_segments(plan, job, force, white_fade=white_fade, style=style)
    _concat_segments(segs, job / "_visual.mp4")
    _final_mux(job, _with_sound_design(job, mp3, plan, style), srt, burn_subs, add_qr=False,
               vignette=ASTRO_VIGNETTE)
    (job / "_visual.mp4").unlink(missing_ok=True)
    return final


def _build_astro_motion_plan(job: Path, total: float, photos: list, ai_clips: list,
                              pexels_clips: list, mm_segs: list, force: bool, style: str = "") -> list:
    """Astrology timeline WITH mindmaps: a mindmap segment opens the video and every
    minute; the gaps between are filled with the astrology photo/AI-clip/Pexels slots
    (video every ASTRO_VIDEO_EVERY gap-slot, light leak, fast zoom)."""
    mm = sorted(mm_segs, key=lambda s: s[0])
    scene_media, media_identities = _scene_media(job)
    selection = {"photos": sorted(map(str, photos)), "ai_clips": sorted(map(str, ai_clips)),
                 "footage": sorted(map(str, pexels_clips)), "scene_media": scene_media,
                 "media_identities": media_identities,
                 "pacing": [ASTRO_VIDEO_SLOT, YT_SLOT_MAX, ASTRO_PHOTO_SLOT, MAX_FOOTAGE_SHOT_SECONDS]}
    if not force:
        cached = _cached_motion_plan(job, mm, selection)
        if cached is not None:
            return cached

    reserved = {str(Path(p).resolve()) for _, scene, _ in mm for p in scene_media.get(str(scene), [])}
    photos = [p for p in photos if str(Path(p).resolve()) not in reserved]
    ai_clips = [p for p in ai_clips if str(Path(p).resolve()) not in reserved]
    pexels_clips = [p for p in pexels_clips if str(Path(p).resolve()) not in reserved]

    lead_holds: dict = {}                   # slot index -> seconds its scene holds its first frame
    no_stills = not photos                  # nothing drawn: a slot never asks for a still
    photos = [str(p) for p in photos] or [""]
    ai_clips = [str(p) for p in ai_clips]
    pexels_clips = [str(p) for p in pexels_clips]
    have_video = bool(ai_clips or pexels_clips)
    ai_cap = len(ai_clips) * max(1, ASTRO_VIDEO_MAX_REUSE)
    plan: list = []
    t = 0.0
    mmi = vi = gi = 0
    # Shuffled bags, not a modulo ring: with a pool smaller than the slot count a
    # ring replays the same clips in the same order for the whole video, which is
    # exactly what made the footage look repetitive.
    bseed = abs(hash(job.name)) % 9973
    photo_bag = _Bag([p for p in photos if p], bseed + 11, repeat=False)
    ai_bag = _Bag(ai_clips, bseed + 12, repeat=False)

    # Window-aware footage: a clip searched FOR window w is spent on a slot IN
    # window w, so what is on screen is what the narration is saying right then.
    # Untagged (atmospheric) clips fill everything else; when a window's own clip
    # is spent, the one just described comes next, then the one about to be.
    tag_of: dict = {}
    win_s = 0.0
    tf = job / "broll_tags.json"
    if tf.exists():
        try:
            _raw = json.loads(tf.read_text(encoding="utf-8"))
            win_s = float(_raw.pop("_win_s", 0) or 0)
            tag_of = {k: int(v) for k, v in _raw.items()}
        except (ValueError, OSError, TypeError):
            tag_of = {}
    # The width of a window. Jobs made before windows existed tagged by minute.
    if not win_s:
        win_s = 60.0
        try:
            _rows = json.loads((job / "broll_queries.json").read_text(encoding="utf-8"))
            win_s = float((_rows[0] if _rows else {}).get("win_s", 60) or 60)
        except (ValueError, OSError, AttributeError, IndexError):
            pass
    # Windows were cut by word count at WPM; the real voice runs faster or slower. Scaling the
    # clock by the two lengths keeps the last minute's footage on the last minute's words.
    try:
        _words = len((job / "script.txt").read_text(encoding="utf-8").split())
        clock = (_words / float(WPM) * 60.0) / total if total > 0 and _words else 1.0
        clock = clock if 0.6 <= clock <= 1.6 else 1.0
    except OSError:
        clock = 1.0
    real_pool = _real_photo_pool(job, total) if REAL_PHOTOS and _styles.is_documentary(style) else {}
    real_used: set = set()
    named = _named_things(job, total, clock) if real_pool or (REAL_PHOTOS and _styles.is_documentary(style)) else []
    named_pool = _named_photo_pool(job, named) if named else {}
    identity = {}
    if real_pool and named:
        # a stretch searched for a person ("Felix Wankel inventor…") holds photos of that person: they are that
        # person's photos (shown in his own sentence, carrying no other label), not general pictures
        for i, q in enumerate(real_pool.get("_q") or []):
            who_ = next((x for x in named if x["type"] == "person" and x["name"].lower() in q.lower()), None)
            if who_ and real_pool.get(i):
                named_pool.setdefault(who_["key"], []).extend(real_pool.pop(i))
                for ph in named_pool[who_["key"]]:
                    identity[ph] = {"name": who_["name"], "type": "person"}
        for x in named:
            for ph in named_pool.get(x["key"], []):
                identity.setdefault(ph, {"name": x["name"], "type": x["type"]})
        (job / "stills" / "identity.json").write_text(json.dumps(identity, indent=1, ensure_ascii=False), encoding="utf-8")
    name_labels: list = []
    labelled_keys: set = set()
    sent_ends = _sentence_ends(job) if named else []

    def named_still(x, cur_t: float, still: float) -> float:
        """A named photo plays with its own sentence: it ends shortly after that sentence does (2 s at least)."""
        end = next((e for e in sent_ends if e >= x["t"]), None)
        return still if end is None else max(2.0, min(still, end - cur_t + 0.4))
    no_stills = no_stills and not any(v for k, v in real_pool.items() if k != "_t") and not any(named_pool.values())
    yt_len = _footage_seconds(job)          # real clips: their own length, and first choice
    # ...unless the channel prefers its stock footage (features.prefer = "stock")
    yt_first = bool(yt_len) and (((STYLE_INFO.get(style) or {}).get("features") or {}).get("prefer") or "youtube") != "stock"
    line_at = _footage_lines(job) if yt_first else {}
    # who each real shot shows, and the words spoken around each moment: a shot naming a person plays only
    # while that person (or the video's own subject, named in the title) is being talked about
    people = _footage_people(job) if yt_first else {}
    try:
        _title_words = set(re.findall(r"[a-z]+", _fold((job / "title.txt").read_text(encoding="utf-8").splitlines()[0])))
        _cues_all = _parse_srt_full((job / "subs.srt").read_text(encoding="utf-8"))
        _script_words = set(re.findall(r"[a-z]+", _fold((job / "script.txt").read_text(encoding="utf-8"))))
    except (OSError, ValueError, IndexError):
        _title_words, _cues_all, _script_words = set(), [], set()

    def fits(c, t):
        # only people this narration talks about count: a trophy "named after Henri Delaunay" is still b-roll
        who = {n for n in people.get(Path(c).name, set()) if n in _script_words}
        if not who:
            return True
        heard = " ".join(txt for a, b, txt in _cues_all if a < t + 3.0 and b > t - 1.0)
        heard = set(re.findall(r"[a-z]+", _fold(heard))) | _title_words
        return all(n in heard for n in who)
    _ends: dict = {}

    def sentence_end(tl):
        # when the sentence that begins at tl is over: its words timed through their cues by their letters
        if tl not in _ends:
            _ends[tl] = tl
            for st, en, txt in _cues_all:
                if en <= tl:
                    continue
                ws = (txt or "").split()
                weights = [len(re.sub(r"\W", "", w)) + 1 for w in ws]
                tot, acc, hit = float(sum(weights) or 1), 0, None
                for word, wt in zip(ws, weights):
                    acc += wt
                    done = st + (en - st) * acc / tot
                    if done > tl + 0.3 and re.search(r"[.!?][\"')\]]*$", word):
                        hit = done
                        break
                if hit is not None:
                    _ends[tl] = hit
                    break
        return _ends[tl]
    leak_on = bool(ASTRO_LEAK) and style not in STYLE_NO_LEAK and not _styles.is_documentary(style)   # documentary: topic leaks only (_topic_leaks)
    rng = random.Random(bseed + 13)
    pool_all = list(pexels_clips)
    rng.shuffle(pool_all)
    unused = list(pool_all)

    last_use: dict = {}
    clip_lengths = {}

    def clip_length(path):
        if path not in clip_lengths:
            clip_lengths[path] = _video_dur(Path(path))
        return clip_lengths[path]
    stretch = {"t0": 0.0, "nxt": total}     # the footage run being filled: where it began, where the next scene starts
    # a channel that cuts fast (pacing.cut_s) shows each real shot for about that long, not for all it has
    _cut = float((((STYLE_INFO.get(style) or {}).get("pacing") or {}).get("cut_s") or 0) or 0)
    video_slot = min(ASTRO_VIDEO_SLOT, MAX_FOOTAGE_SHOT_SECONDS)
    slot_max = min(YT_SLOT_MAX, MAX_FOOTAGE_SHOT_SECONDS, _cut * 1.5) if _cut else min(YT_SLOT_MAX, MAX_FOOTAGE_SHOT_SECONDS)

    def shot_limit(path):
        return min(clip_length(path), slot_max if Path(path).name in yt_len else video_slot)

    try:   # which YouTube video each clip was cut from
        src_of = {Path(r["path"]).name: r.get("video") for r in
                  json.loads((job / "youtube" / "clips.json").read_text(encoding="utf-8"))}
    except (OSError, ValueError, KeyError, TypeError):
        src_of = {}
    last_src = []
    doc_style = _styles.is_documentary(style)   # the worked opening: Documentary and War Chess only

    def _note_src(c):
        last_src.append(src_of.get(Path(c).name))

    def _same_src(c, cur_t: float) -> bool:
        """Owner 2026-10-04: clips of one YouTube video sit a little apart — never back to back, and in the
        hook at least two shots apart. A preference: when nothing else fits, the best match still wins."""
        v = src_of.get(Path(c).name)
        recent = last_src[-2:] if OPENING_TIERS and doc_style and cur_t < OPENING_RICH_S else last_src[-1:]
        return bool(v) and v in recent

    def _take_by_sentence(cur_t: float, m: int):
        """A YouTube shot for the sentence being spoken. Shots were chosen sentence by sentence, so a
        shot plays while its sentence is spoken; a sentence nothing was found for borrows from the
        sentences just spoken in this stretch of footage — a sentence the scene before already showed
        (spoken under a map, a collage) comes only when nothing nearer is left."""
        nonlocal unused
        name = lambda c: Path(c).name

        def take(c):
            unused.remove(c)
            _note_src(c)
            return c

        def same(c):
            return _same_src(c, cur_t)
        mine = [c for c in pool_all if name(c) in line_at and fits(c, cur_t)]
        fresh = [c for c in unused if name(c) in line_at and c not in last_use and fits(c, cur_t)]   # never seen yet
        run0 = stretch["t0"] - 0.5                     # where this stretch of footage began
        # 1. the sentence being spoken now (begun a moment ago, or about to begin) — a long one begun under the
        #    scene before still counts while its words go on ("...and Alex Padilla celebrates with Lamine")
        now = [c for c in fresh if line_at[name(c)] <= cur_t + 2.0 and (
            max(cur_t - 3.0, run0) <= line_at[name(c)] or
            (cur_t - 8.0 <= line_at[name(c)] and sentence_end(line_at[name(c)]) > cur_t + 1.5))]
        if now:
            return take(min(now, key=lambda c: (same(c), abs(line_at[name(c)] - cur_t), name(c))))
        # 1b. the sentence about to be spoken, before the next scene — when every unseen shot of the sentences
        #     just spoken is stale (said more than five seconds ago, under the scene before: a map on
        #     "Indianapolis"), and the next sentence's shot would otherwise play under the next scene, unseen
        ahead = [c for c in fresh if cur_t + 2.0 < line_at[name(c)] <= min(cur_t + 5.0, stretch["nxt"] - 0.3)]
        newest = max((line_at[name(c)] for c in fresh if cur_t - 20.0 <= line_at[name(c)] < cur_t - 3.0), default=None)
        if ahead and (newest is None or cur_t - newest > 5.0):
            return take(min(ahead, key=lambda c: (line_at[name(c)], name(c))))
        # 2. unseen shots of the sentences just spoken in this stretch, the latest sentence first
        past = [c for c in fresh if max(cur_t - 10.0, run0) <= line_at[name(c)] < cur_t - 3.0]
        if past:
            latest = max(line_at[name(c)] for c in past)
            return take(min((c for c in past if line_at[name(c)] == latest), key=lambda c: (same(c), name(c))))
        # 3. shots with no sentence of their own, found for this stretch
        loose = [c for c in unused if name(c) not in line_at and tag_of.get(name(c), -9) == m]
        if loose:
            return take(min(loose, key=lambda c: (same(c), name(c))))
        # 4. an unseen shot of the sentence about to be spoken: a few seconds early beats an old one
        soon = [c for c in fresh if cur_t + 2.0 < line_at[name(c)] <= cur_t + 6.0]
        if soon:
            return take(min(soon, key=lambda c: (line_at[name(c)], name(c))))
        # 5. an unseen shot of a sentence the scene before already showed — only a recent one: a shot of one
        #    person or event must not drift under the next person's sentence
        older = [c for c in fresh if cur_t - 12.0 <= line_at[name(c)] < cur_t]
        if older:
            return take(max(older, key=lambda c: line_at[name(c)]))

        # 5b. a sentence a little way ahead with far more unseen shots than it can ever show (eight trailer shots
        #     for "GTA 6 launches November nineteenth") lends its lowest-ranked ones, keeping five — a shot never
        #     seen beats a repeat; from further ahead it would be another chapter of the story
        later = {}
        for c in fresh:
            if cur_t + 15.0 < line_at[name(c)] <= cur_t + 45.0:
                later.setdefault(line_at[name(c)], []).append(c)
        spare = [max(g, key=name) for g in later.values() if len(g) > 5]
        if spare:
            return take(min(spare, key=lambda c: (line_at[name(c)], name(c))))

        return None

    def take_pex(cur_t: float):
        got_ = _take_pex(cur_t)
        if got_ and got_ in last_use:
            return None
        if got_:
            last_use[got_] = cur_t
        return got_

    def _take_pex(cur_t: float):
        nonlocal unused
        if not unused:
            return None
        m = int(cur_t * clock // win_s)
        if line_at:
            got_ = _take_by_sentence(cur_t, m)
            if got_:
                return got_
            # a shot of another person never stands in — only shots that name nobody, or nobody but who is being
            # talked about now
            unused_all = unused
            unused = [c for c in unused if fits(c, cur_t)]
            if not unused:
                unused = unused_all
                return None
            else:
                try:
                    return _take_pex_rest(cur_t, m)
                finally:
                    kept = set(unused)
                    unused = [c for c in unused_all if c in kept or not fits(c, cur_t)]
        return _take_pex_rest(cur_t, m)

    def _take_pex_rest(cur_t: float, m: int):
        nonlocal unused

        def tagged(w, real=None):
            # real=True: only YouTube clips; the clips of a window keep the order they were ranked in
            mine = [c for c in unused if tag_of.get(Path(c).name, -9) == w
                    and (real is None or (Path(c).name in yt_len) == real)]
            if not mine:
                return None
            got_ = min(mine, key=lambda c: ((Path(c).name not in yt_len) == yt_first, _same_src(c, cur_t), Path(c).name))
            unused.remove(got_)
            _note_src(got_)
            return got_
        # This window's own clip first — a real one before stock. Once it is spent,
        # the real clip of the stretch just described, then an atmospheric shot —
        # NOT the next window's clip. Borrowing from the future ran the whole
        # video one window ahead of the voice: every image arrived fifteen
        # seconds before the words it had been searched for.
        got = tagged(m)
        if got:
            return got
        if yt_first:
            got = tagged(m - 1, True)
            if got:
                return got
        got = tagged(m - 1) or tagged(m + 1)
        if got:
            return got
        # The neighbours are spent: the nearest stretch that still has a shot, before
        # ever leaving a gap — every clip was searched for this video's own story, so
        # one from further along still fits the context; a coverage gap kills the run.
        span = max([tag_of.get(Path(c).name, 0) for c in unused] + [m]) + 1
        for d in range(2, span + 1):
            got = tagged(m - d) or tagged(m + d)
            if got:
                return got
        if unused:
            got_ = min(unused, key=lambda c: _same_src(c, cur_t))
            unused.remove(got_)
            _note_src(got_)
            return got_
        return None

    # Every gap slot goes to whichever kind is furthest BEHIND its share of the
    # non-graphics time. With the sliders untouched that reproduces the old
    # footage-heavy rhythm; moved, it actually changes what fills the video —
    # which a fixed "every 2nd slot is stock" rule never could.
    spent = {"photo": 0.0, "video": 0.0}
    want_ai, want_st = _MIX[0], _MIX[1]

    def take_real(cur_t: float):
        """A real photo searched for this stretch of narration, else the one just before or after it."""
        if not real_pool:
            return None
        m = _stretch(cur_t)
        for d in (0, -1, 1, -2, 2):
            if _person_ahead(m + d, cur_t):
                continue
            for ph in real_pool.get(m + d, []):
                if ph not in real_used:
                    real_used.add(ph)
                    return ph
        return None

    def _person_ahead(i: int, cur_t: float) -> bool:
        """This stretch's photos were searched for a person who has not been named yet — never shown early."""
        qs = real_pool.get("_q") or []
        q = qs[i].lower() if 0 <= i < len(qs) else ""
        return any(x["type"] == "person" and x["name"].lower() in q and x["t"] > cur_t + 1.0 for x in named)

    def _stretch(cur_t: float) -> int:
        starts = real_pool.get("_t") or [0.0]
        st = cur_t * clock
        return max(0, sum(1 for x in starts if x <= st) - 1)

    def take_named_peek(cur_t: float):
        return any(ph not in real_used for x in named_near(cur_t, 4.0) for ph in named_pool.get(x["key"], []))

    def has_real(cur_t: float) -> bool:
        m = _stretch(cur_t)
        if all(_person_ahead(m + d, cur_t) or not real_pool.get(m + d) for d in (0, -1, 1, -2, 2)):
            return False
        return any(ph not in real_used for d in (0, -1, 1, -2, 2) for ph in real_pool.get(m + d, []))

    def named_near(cur_t: float, ahead: float) -> list:
        """Named things spoken from 3 s before this slot to `ahead` s after its start, nearest first."""
        return sorted((x for x in named if cur_t - 3.0 <= x["t"] <= cur_t + ahead), key=lambda x: abs(x["t"] - cur_t))

    scene_subjects = []
    try:
        for x_ in json.loads((job / "director.json").read_text(encoding="utf-8")).get("scenes") or []:
            if x_.get("tool") in ("spotlight", "strip", "matchcut", "object", "legends"):
                scene_subjects.append((float(x_.get("_t", x_.get("t", 0))), str(x_.get("subject") or x_.get("words") or "").lower()))
    except (OSError, ValueError, AttributeError):
        pass

    def shown_by_scene(x, cur_t: float) -> bool:
        """A scene about this very thing starts within 6 s — the still would show it twice in a row."""
        nm = x["name"].lower()
        return any(-2.0 <= st - cur_t <= 6.0 and (nm in subj or (subj and subj in nm)) for st, subj in scene_subjects)

    def take_named(items: list):
        for x in items:
            if shown_by_scene(x, x["t"]):
                continue
            for ph in named_pool.get(x["key"], []):
                if ph not in real_used:
                    real_used.add(ph)
                    last_named[0] = x
                    return ph
        return None
    last_named = [None]

    def label_name(x, cur_t: float):
        """A plain name label on the footage for a named thing with no photo — once per thing."""
        if x["key"] in labelled_keys:
            return
        labelled_keys.add(x["key"])
        style_ = {"person": "name", "place": "place", "company": "place"}.get(x["type"], "phrase")
        name_labels.append({"t": round(max(cur_t, x["t"]), 2), "dur": 3.0, "style": style_, "text": x["name"].upper()})

    def gap_entry(g: int, cur_t: float = 0.0):
        nonlocal vi
        done = spent["photo"] + spent["video"]
        tgt = want_ai + want_st
        need_ai = (want_ai / tgt if tgt else 0.5) - (spent["photo"] / done if done else 0.0)
        need_st = (want_st / tgt if tgt else 0.5) - (spent["video"] / done if done else 0.0)
        can_ai_clip = bool(ai_bag.bag)
        can_stock = bool(pexels_clips) or can_ai_clip
        have_still = bool(photo_bag.bag) or (REAL_PHOTOS and (has_real(cur_t) or bool(take_named_peek(cur_t))))
        # no third still in a row: a run of photos reads as a slideshow
        stills_run = len(plan) >= 2 and plan[-1][0] == "photo" and plan[-2][0] == "photo"
        room = float(stretch.get("nxt", total)) - cur_t
        if REAL_PHOTOS and not stills_run and room >= 2.0:
            # the thing being named right now, when a photo of exactly it was found, beats any generic shot
            ph = take_named(named_near(cur_t, min(ASTRO_PHOTO_SLOT, STILL_MAX_S)))
            if ph is not None:
                still = min(ASTRO_PHOTO_SLOT, STILL_MAX_S) if _styles.is_documentary(style) else ASTRO_PHOTO_SLOT
                still = named_still(last_named[0], cur_t, still)
                spent["photo"] += still
                return ("photo", ph, False, still)

        def video_entry():
            nonlocal vi
            if have_video and can_ai_clip and (g % ASTRO_VIDEO_EVERY == 0 or not unused):
                vi += 1
                clip = ai_bag.take()
                slot = min(video_slot, clip_length(clip))
                spent["video"] += slot
                return ("video", clip, leak_on, slot)
            if pexels_clips:
                clip = take_pex(cur_t)
                if clip is not None:
                    slot = video_slot
                    real = bool(clip) and Path(clip).name in yt_len
                    if real:
                        slot = min(slot_max, max(YT_SLOT_MIN, min(slot_max, yt_len[Path(clip).name])))
                    slot = min(slot, clip_length(clip))
                    # the hook: 4–5 s shots, then the normal pace — only while clips are to spare for the rest
                    # of the video at its normal pace (a short shot spends footage faster; a gap kills the run)
                    if OPENING_TIERS and doc_style and cur_t < OPENING_RICH_S and len(unused) > (total - cur_t) / YT_SLOT_MAX:
                        slot = min(slot, OPENING_SHOT_S)
                    spent["video"] += slot
                    return ("video", clip, leak_on and not real, slot)
            return None

        if can_stock and (need_st >= need_ai or not have_still or no_stills or stills_run):
            e = video_entry()
            if e is not None:
                return e
        still = min(ASTRO_PHOTO_SLOT, STILL_MAX_S) if _styles.is_documentary(style) else ASTRO_PHOTO_SLOT
        near = named_near(cur_t, still) if REAL_PHOTOS else []
        if near:
            # a named person/object/place is being spoken: exactly it, or an honest fallback — never an AI picture
            ph = take_named(near)                               # 1. a real photo of exactly it
            if ph is None:
                e = video_entry()                               # 2. video of it (the sentence's own clip) + its name
                if e is not None:
                    label_name(near[0], cur_t)
                    return e
                ph = take_named([x for x in named_near(cur_t, still) if x["t"] <= cur_t + 1.0])   # 3. another thing named right here (never one still to come)
            if ph is None:
                label_name(near[0], cur_t)                      # 4. its name on screen, over...
                ph = take_real(cur_t)                           # 5. ...a photo of the setting
            if ph is None:
                return None
            if last_named[0] is not None and str(ph) in named_pool.get(last_named[0]["key"], []):
                still = named_still(last_named[0], cur_t, still)
            spent["photo"] += still
            return ("photo", ph, False, still)
        ph = take_real(cur_t) if REAL_PHOTOS else None          # 1. a real photograph of this moment
        if ph is None and photo_bag.bag:                        # 2. an AI still (capped), to keep moving
            ph = photo_bag.take()
        if ph is None:                                          # 3. video, only as the fallback
            return video_entry() if REAL_PHOTOS else None
        spent["photo"] += still
        return ("photo", ph, False, still)

    while t < total - 1e-9:
        if mmi < len(mm) and mm[mmi][0] <= t + 0.01:
            dur = min(mm[mmi][2], total - t)
            plan.append(("motion", str(mm[mmi][1]), False, dur)); t += dur; mmi += 1
            stretch["t0"] = t
            continue
        nxt = mm[mmi][0] if mmi < len(mm) else total
        stretch["nxt"] = nxt
        gap = min(nxt, total) - t
        if not plan and mmi < len(mm) and 0 < gap < 1.0:
            # the first scene starts a moment in (a dateline's lead): it opens the video instead of a 3-frame flicker
            dur = min(mm[mmi][2] + gap, total - t)
            plan.append(("motion", str(mm[mmi][1]), False, dur)); t += dur; mmi += 1
            stretch["t0"] = t
            continue
        # Extend a continuous shot only within its source and configured/hard limits.
        if gap < (1.8 if yt_len else 2.5) and plan:
            pk, pp, pl, pd = plan[-1]
            still_ok = pk != "photo" or not _styles.is_documentary(style) or float(pd) + gap <= STILL_MAX_S + 1e-9
            if (pk != "video" and still_ok) or (pk == "video" and float(pd) + gap <= shot_limit(pp) + 1e-9):
                plan[-1] = (pk, pp, pl, float(pd) + gap)
                t += gap
                continue
        e = gap_entry(gi, t); gi += 1
        if e is None or float(e[3]) <= 0:
            if plan and plan[-1][0] == "video":
                pk, pp, pl, pd = plan[-1]
                extra = min(gap, max(0.0, shot_limit(pp) - float(pd)))
                if extra > 1e-9:
                    plan[-1] = (pk, pp, pl, float(pd) + extra)
                    t += extra
                    continue
            (job / "coverage_gap.json").write_text(json.dumps({"at": round(t, 3), "until": round(nxt, 3)}))
            raise ValueError(f"Coverage gap at {t:.1f}s: no unused contextual media remains. "
                             "Find another suitable shot or justified explanatory visual; filler reuse is disabled.")
        dur = min(float(e[3]), gap)
        if REAL_PHOTOS and dur < 1.0 and plan and plan[-1][0] in ("photo", "video"):
            # under a second: no flash of a new picture — the previous shot holds a moment longer, when it has the
            # footage for it (a clip is never looped) or is a still that stays under its limit
            pk, pp, pl, pd = plan[-1]
            room_ = (shot_limit(pp) if pk == "video" else STILL_MAX_S + 0.6) - float(pd)
            if room_ >= gap - 1e-6:
                if e[0] == "photo":
                    real_used.discard(e[1])
                plan[-1] = (pk, pp, pl, float(pd) + gap)
                t += gap
                continue
            if mmi < len(mm) and abs(mm[mmi][0] - (t + gap)) < 0.05:
                # the next scene starts now and holds its first frame for the sliver (no flash of a new picture)
                if e[0] == "photo":
                    real_used.discard(e[1])
                dur_ = min(mm[mmi][2] + gap, total - t)
                plan.append(("motion", str(mm[mmi][1]), False, dur_))
                lead_holds[str(len(plan) - 1)] = round(gap, 3)
                t += dur_; mmi += 1
                stretch["t0"] = t
                continue
        # a slot that would leave only a sliver before the next scene (stretched over later) shares the room
        # instead: the words just before the scene get a shot of their own, not the tail of the one before
        sliver = 1.8 if yt_len else 2.5
        if 0.0 < gap - dur < sliver and sliver <= gap / 2.0 <= float(e[3]) + 0.01:
            dur = gap / 2.0
        entry = (e[0], e[1], e[2] if dur >= 2.0 else False, dur)  # no leak on a very short clamped clip
        plan.append(entry); t += dur

    plan = _apply_punches(plan, job)
    if REAL_PHOTOS and (real_pool or named):
        if name_labels:
            def spans_of(path):
                try:
                    rows_ = json.loads((job / path).read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    return []
                out_ = []
                for x in rows_ if isinstance(rows_, list) else []:
                    try:
                        a_ = float(x.get("t", x.get("_t")))
                        out_.append((a_, float(x.get("end") or x.get("_end") or a_ + float(x.get("dur") or 3.6))))
                    except (TypeError, ValueError, AttributeError):
                        pass
                return out_
            own = json.loads((job / "overlays.json").read_text(encoding="utf-8")) if (job / "overlays.json").exists() else []
            busy = spans_of("overlays.json") + spans_of("war_chess/moments.json") + spans_of("legends/moments.json")
            have = " ".join(str(x.get("text") or "").lower() for x in own)
            added = []
            for lb in name_labels:
                a_, b_ = lb["t"], lb["t"] + lb["dur"]
                if lb["text"].lower() in have or any(x < b_ and a_ < y for x, y in busy):
                    continue
                busy.append((a_ - 1.5, b_ + 1.5))
                added.append(lb)
            if added:
                (job / "overlays.json").write_text(json.dumps(sorted(own + added, key=lambda x: float(x["t"])),
                                                          indent=1, ensure_ascii=False), encoding="utf-8")
            name_labels[:] = added
        boxes = {}
        for f in (job / "stills").rglob("photos.json"):
            try:
                got = json.loads(f.read_text(encoding="utf-8"))
                for x in got.get("picks") or []:
                    boxes[x["photo"]] = (x.get("box"), got.get("type") == "person")
            except (OSError, ValueError, KeyError):
                pass
        for i, (kind, path, leak, dur) in enumerate(plan):
            if kind == "photo" and str(path) in boxes:
                framed_ = _face_frame(str(path), boxes[str(path)][0] or [0, 0, 1, 1], boxes[str(path)][1])
                if framed_ != str(path):
                    plan[i] = (kind, framed_, leak, dur)
                    for d_ in (job / "stills" / "named").glob("*/photos.json"):      # the cut keeps its owner
                        try:
                            got = json.loads(d_.read_text(encoding="utf-8"))
                            if any(x["photo"] == str(path) for x in got.get("picks") or []):
                                got["picks"].append(dict(next(x for x in got["picks"] if x["photo"] == str(path)), photo=framed_))
                                d_.write_text(json.dumps(got, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
                        except (OSError, ValueError, StopIteration):
                            pass
                    named_pool.update({k: v + [framed_] for k, v in named_pool.items() if str(path) in v})
                    if str(path) in identity:
                        identity[framed_] = identity[str(path)]
                        (job / "stills" / "identity.json").write_text(json.dumps(identity, indent=1, ensure_ascii=False), encoding="utf-8")
        _stills_look(job, plan)
        (job / "legends" / "insets.json").unlink(missing_ok=True)   # written afresh below, never left from a re-render
        if named:
            _named_report(job, plan, named, named_pool, name_labels)
            _match_text(job, plan, named)
    if OPENING_TIERS and doc_style and src_of:
        hook_src, tt = [], 0.0          # one entry per slot: its YouTube video, or None for anything else
        for e in plan:
            if tt >= OPENING_RICH_S:
                break
            hook_src.append(src_of.get(Path(e[1]).name) if e[0] == "video" else None)
            tt += float(e[3])
        yt = [v for v in hook_src if v]
        log(f"  hook (first 2 min): {len(yt)} YouTube shots from {len(set(yt))} videos, "
            f"{sum(1 for a, b in zip(hook_src, hook_src[1:]) if a and a == b)} back to back")
    _validate_media_plan(plan, job)
    _save_motion_plan(job, plan, mm, selection)
    (job / "coverage_gap.json").unlink(missing_ok=True)
    (job / "lead_holds.json").write_text(json.dumps(lead_holds), encoding="utf-8")
    (job / "footage_again.json").write_text("{}", encoding="utf-8")
    mmn = sum(1 for e in plan if e[0] == "motion")
    log(f"plan: {len(plan)} slots — {mmn} graphics scenes, {len(plan) - mmn} photo/video")
    return plan


FILM_RUN_S = 10.0         # dust / vignette switch on and off in stretches at least this long, never per shot
DUST_SHARE = float(os.environ.get("DUST_SHARE", "0.20"))   # dust on about this share of the video (owner 2026-10-03: less)
# the footage stretches without dust rotate through other looks so no single filter reads as "on everything"
FILM_LOOKS = ("grain", "contrast", "clean", "vignette")
_LOOK_VF = {   # timeline-gated in the final mux; {e} is the enable expression
    "grain": "noise=alls=7:allf=t:enable='{e}',eq=saturation=0.85:contrast=0.96:enable='{e}',"
             "colorbalance=rs=0.06:gs=0.02:bs=-0.06:enable='{e}'",          # fine grain, faded and warm
    "contrast": "eq=contrast=1.12:saturation=1.12:enable='{e}'",              # deeper blacks, richer colour
}
ARCHIVE_KINDS = ("archive", "still")   # Gemini's shot kinds that are old film or old photographs


def _archival_clips(job: Path) -> set:
    """Names of the job's YouTube clips whose shot Gemini logged as archive film or an old still."""
    out = set()
    try:
        rows = json.loads((job / "youtube" / "clips.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return out
    logs = {}
    for r in rows:
        vid = str(r.get("video") or "")
        if vid not in logs:
            try:
                logs[vid] = json.loads((job / "youtube" / "catalog" / f"{vid}.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                logs[vid] = {}
        start = float(r.get("start") or 0)
        import youtube
        for s in logs[vid].get("shots") or []:
            if isinstance(s, dict) and youtube._sec(s.get("start")) - 0.6 <= start < youtube._sec(s.get("end")):
                if str(s.get("kind") or "").lower() in ARCHIVE_KINDS:
                    out.add(Path(str(r.get("path") or "")).name)
                break
    return out


def _film_look(job: Path, plan: list, total: float, sub_center: bool) -> tuple:
    """(no_dust_ranges, vignette_ranges) for the documentary's old-film look, decided in code (no model call).
    Footage between graphics scenes is cut into stretches of at least FILM_RUN_S. Dust: every archival stretch and
    2 of 3 others. Vignette: archival stretches and 1 of 3 dusty others. Graphics scenes never get either."""
    archival = _archival_clips(job)
    stretches, cur, t = [], None, 0.0
    for e in plan:
        dur = float(e[3])
        if _mutes_captions(e, sub_center):
            cur = None
        else:
            old = Path(str(e[1])).name in archival
            if cur is None or t - cur[0] >= FILM_RUN_S:
                cur = [t, t + dur, old]
                stretches.append(cur)
            else:
                cur[1] = t + dur
                cur[2] = cur[2] or old
        t += dur
    # dust on about DUST_SHARE of the whole video (owner: "35% or something", it read as every frame at 2 of 3):
    # archival stretches first, then every 3rd modern stretch, until the share is reached
    budget = DUST_SHARE * total
    dusty, vig, used, d = [], [], 0.0, 0
    for a, b, old in stretches:
        if old and used + (b - a) <= budget + 2.0:
            dusty.append((a, b)); used += b - a
            if b - a >= 6.0 and d % 3 == 0:   # 1 of 3 archival stretches (shorter than 6 s reads as a flicker)
                vig.append((a, b))
            d += 1
    modern = [(a, b) for a, b, old in stretches if not old]
    for k, (a, b) in enumerate(modern):
        if k % 3 == 0 and used + (b - a) <= budget + 2.0:
            dusty.append((a, b)); used += b - a   # (modern dust has no vignette: it has its own turn below)
    dusty.sort()
    looks, k = [], 0
    for a, b, old in stretches:
        if (a, b) in dusty:
            continue
        kind = FILM_LOOKS[k % len(FILM_LOOKS)]
        k += 1
        if kind == "vignette" and b - a >= 6.0:
            vig.append((a, b))
        elif kind in _LOOK_VF:
            looks.append((a, b, kind))
    vig.sort()
    no_dust, last = [], 0.0
    for a, b in dusty:
        if a > last + 0.01:
            no_dust.append((last, a))
        last = b
    if last < total:
        no_dust.append((last, total + 2))
    return no_dust, vig, looks


CTA_OVERLAY = HERE / "assets" / "cta" / "subscribe.mov"   # the channel's subscribe button (transparent, own sound)
CTA_LEAD_S = 0.6          # the button starts this long before the narrator says "subscribe"
CTA_VOLUME = float(os.environ.get("CTA_VOLUME", "0.6"))
_CTA_WORD = re.compile(r"subscrib", re.I)


def _ff_path(path) -> str:
    """A file path as a filtergraph option value."""
    return "'" + str(path).replace("\\", "/").replace(":", "\\:").replace("'", "") + "'"


def _cta_times(job: Path, srt: Path) -> list:
    """When the subscribe button goes up: every spoken "subscribe…" (script-word timings), at least 20 s apart."""
    if not CTA_OVERLAY.exists():
        return []
    try:
        cues = json.loads((job / "words.json").read_text(encoding="utf-8"))["cues"]
        blocks = Path(srt).read_text(encoding="utf-8").strip().split("\n\n")
    except (OSError, ValueError, KeyError):
        return []
    times = []
    for k, block in enumerate(blocks):
        timing = cues.get(str(k), [])
        for n, word in enumerate(" ".join(block.split("\n")[2:]).split()):
            if _CTA_WORD.search(word) and n < len(timing):
                t = max(0.0, float(timing[n][0]) - CTA_LEAD_S)
                if not times or t - times[-1] >= 20.0:
                    times.append(t)
    if times:
        log(f"  subscribe button at {', '.join(f'{int(t // 60)}:{t % 60:04.1f}' for t in times)}")
    return times


def _with_cta_sound(job: Path, audio: Path, times: list) -> Path:
    """The track with the subscribe button's own sound under the narration at each CTA, or the track as it was."""
    if not times:
        return audio
    out = job / "_cta_sound.wav"
    n = len(times)
    graph = (f"[1:a]volume={CTA_VOLUME},asplit={n}" + "".join(f"[c{i}]" for i in range(n)) + ";"
             + "".join(f"[c{i}]adelay={int(t * 1000)}|{int(t * 1000)}[d{i}];" for i, t in enumerate(times))
             + "[0:a]" + "".join(f"[d{i}]" for i in range(n))
             + f"amix=inputs={n + 1}:normalize=0:duration=first[a]")
    try:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(audio), "-i", str(CTA_OVERLAY), "-filter_complex",
                        graph, "-map", "[a]", "-c:a", "pcm_s16le", "-ar", "48000", str(out)],
                       check=True, capture_output=True)
        return out
    except subprocess.CalledProcessError as e:                  # never worth the video
        log(f"  subscribe sound skipped: {(e.stderr or b'')[-160:]!r}")
        return audio


def _with_edit_sounds(job: Path, audio: Path) -> Path:
    """The track with the library edits' own sounds (legends/sounds.json: [[start_s, wav], ...]) under the narration,
    or the track as it was. Same mixing as the subscribe sound."""
    try:
        cues = [(float(t), Path(w)) for t, w in json.loads((job / "legends" / "sounds.json").read_text())]
    except (OSError, ValueError, TypeError):
        return audio
    cues = [(t, w) for t, w in cues if w.exists()]
    if not cues:
        return audio
    out = job / "_edit_sounds.wav"
    graph = ("".join(f"[{i + 1}:a]adelay={int(t * 1000)}|{int(t * 1000)}[d{i}];" for i, (t, _w) in enumerate(cues))
             + "[0:a]" + "".join(f"[d{i}]" for i in range(len(cues)))
             + f"amix=inputs={len(cues) + 1}:normalize=0:duration=first[a]")
    try:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(audio), *[x for _t, w in cues for x in ("-i", str(w))],
                        "-filter_complex", graph, "-map", "[a]", "-c:a", "pcm_s16le", "-ar", "48000", str(out)],
                       check=True, capture_output=True)
        log(f"  edit sounds: {len(cues)} placed")
        return out
    except subprocess.CalledProcessError as e:                  # never worth the video
        log(f"  edit sounds skipped: {(e.stderr or b'')[-160:]!r}")
        return audio


LEAK_MIN_GAP_S = 60.0     # light leaks mark topic changes: at most one a minute
OPENING_TIERS = os.environ.get("OPENING_TIERS", "1") == "1"   # owner 2026-10-04: a worked first two minutes (0 = off)
OPENING_RICH_S, OPENING_SHOT_S, OPENING_FX_GAP_S = 120.0, 5.0, 15.0   # hook length, its shot cap, its transition spacing
REAL_PHOTOS = os.environ.get("REAL_PHOTOS", "1") == "1"   # owner 2026-10-05: still slots take real photos (then AI, then video); 0 = off
LEAK_PAUSE_S = 0.45       # the shortest pause that can mark a turn (the longest one per minute is used)


NAMED_PROMPT = """You are preparing photos for a documentary. Below is the narration, one numbered sentence per line.
List every SPECIFIC named thing a viewer would expect to SEE while it is spoken:
- person: a named person ("Ed Cole", "Felix Wankel");
- object: a specific named machine, model, product or part ("Citroën GS Birotor", "NSU Ro 80", "apex seal");
- place: a specific named place or building ("Warren, Michigan", "GM Technical Center");
- company: a named company ("Citroën", "NSU").
Skip generic words (an engine, a company, a city), figures of speech and comparisons ("like a hula hoop").
Each thing at the sentence where it is first named; again only where a later sentence is mainly about it.
For each: {"s": sentence number, "name": the name as spoken, "type": "person|object|place|company",
"q": an exact photo search (the full name plus one disambiguating word, e.g. "Citroën GS Birotor car"),
"q2": a second, different search for the same thing,
"about": who or what it is, with its era — e.g. "GM president, 1960s–70s", "French carmaker, 1970s" (for a person
this tells them apart from anyone else of the same name)}.
NARRATION:
[INSERT LINES HERE]
Return a JSON array only."""


def _sentence_ends(job: Path) -> list:
    """Times (s) at which the narrator finishes a sentence — the word that carries . ? or ! in the subtitles."""
    try:
        cues = json.loads((job / "words.json").read_text(encoding="utf-8"))["cues"]
        blocks = re.split(r"\n\s*\n", (job / "subs.srt").read_text(encoding="utf-8").strip())
    except (OSError, ValueError, KeyError):
        return []
    ends = []
    for b in blocks:
        lines = b.strip().splitlines()
        if len(lines) < 3 or not lines[0].strip().isdigit():
            continue
        words = " ".join(lines[2:]).split()
        times = cues.get(str(int(lines[0].strip()) - 1)) or []
        if len(times) == len(words):
            ends += [float(tm[1]) for tm, w in zip(times, words) if w.rstrip('"\')»”').endswith((".", "?", "!"))]
    return sorted(ends)


def _shifts(t0: float, ends: list) -> list:
    """Moves to try for a text placed at t0, nearest first: up to 2 s earlier, later until 1 s before its sentence ends
    (never less than 4 s) — a moved text beats a lost one (owner 2026-10-06)."""
    end = next((e for e in ends if e >= t0), t0 + 5.0)
    reach = max(4.0, end - 1.0 - t0)
    return sorted((k / 2 for k in range(-4, int(reach * 2) + 1) if k), key=lambda d: (abs(d), d < 0))


def _spoken_words(job: Path) -> list:
    """[(start s, word lowercased)] from subs.srt and words.json — when each word is really said."""
    try:
        cues = json.loads((job / "words.json").read_text(encoding="utf-8"))["cues"]
        blocks = re.split(r"\n\s*\n", (job / "subs.srt").read_text(encoding="utf-8").strip())
    except (OSError, ValueError, KeyError):
        return []
    out = []
    for b in blocks:
        lines = b.strip().splitlines()
        if len(lines) < 3:
            continue
        key = str(int(lines[0].strip()) - 1) if lines[0].strip().isdigit() else None
        words = " ".join(lines[2:]).split()
        times = cues.get(key) or cues.get(lines[0].strip()) or []
        if key is None or len(times) != len(words):
            continue
        out += [(float(t[0]), re.sub(r"[^\w]", "", w.lower())) for t, w in zip(times, words)]
    return out


def _named_things(job: Path, total: float, clock: float) -> list:
    """[{name, type, q, q2, t, key}] — the people, objects, places and companies the narration names, each at the
    second its name is really spoken. One utility-model call over the script; cached in stills/named.json."""
    cache = job / "stills" / "named.json"
    if cache.exists():
        try:
            return json.loads(cache.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    import director
    rows = director.sentences((job / "script.txt").read_text(encoding="utf-8"), float(WPM))
    if not rows:
        return []
    lines = "\n".join(f"{i + 1}. {r[2]}" for i, r in enumerate(rows))
    try:
        items = _json_items(NAMED_PROMPT.replace("[INSERT LINES HERE]", lines), max_tokens=12000)
    except Exception as e:                                       # noqa: BLE001 - the stills stay contextual
        log(f"  named things: skipped — {str(e)[:120]}")
        return []
    spoken = _spoken_words(job)
    out = []
    for it in items if isinstance(items, list) else []:
        try:
            si = int(it.get("s")) - 1
            name = str(it.get("name") or "").strip()
            kind = str(it.get("type") or "object").strip().lower()
            if not name or not 0 <= si < len(rows) or kind not in ("person", "object", "place", "company"):
                continue
        except (TypeError, ValueError, AttributeError):
            continue
        guess = rows[si][0] / (clock or 1.0)
        toks = [re.sub(r"[^\w]", "", w.lower()) for w in name.split()]
        tok = next((w for w in toks if len(w) >= 3), toks[0] if toks else "")
        hits = [t for t, w in spoken if w == tok and abs(t - guess) < 25.0]
        t = min(hits, key=lambda x: abs(x - guess)) if hits else guess
        out.append({"name": name, "type": kind, "q": str(it.get("q") or name), "q2": str(it.get("q2") or ""),
                    "about": str(it.get("about") or ""), "s": si,
                    "t": round(min(max(0.0, t), total), 2), "key": re.sub(r"\W+", "-", name.lower()).strip("-")})
    out.sort(key=lambda x: x["t"])
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    return out


def _named_for_guide(job: Path) -> list:
    """The named things for the template guide, before the director plans (same call and cache as the photos)."""
    try:
        total = _audio_dur(job / "audio.mp3")
        words = len((job / "script.txt").read_text(encoding="utf-8").split())
        clock = (words / float(WPM) * 60.0) / total if total > 0 and words else 1.0
        return _named_things(job, total, clock if 0.6 <= clock <= 1.6 else 1.0)
    except Exception as e:                                        # noqa: BLE001 - the guide still finds dates and numbers
        log(f"  guide: named things skipped — {str(e)[:120]}")
        return []


def _named_photo_pool(job: Path, named: list) -> dict:
    """{key: [photo path]} — photos of exactly each named thing, searched once per thing (photofx.named_photos)."""
    import photofx
    me = sys.modules[__name__]
    things = {}
    for x in named:
        things.setdefault(x["key"], x)
    with ThreadPoolExecutor(max_workers=4) as ex:
        found = dict(zip(things, ex.map(lambda k: photofx.named_photos(
            me, things[k]["name"], things[k]["type"], things[k]["q"], things[k]["q2"],
            job / "stills" / "named" / k[:60], about=things[k].get("about", "")), list(things))))
    small = []
    try:
        small = json.loads((job / "stills_small.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    pool = {}
    for k, got in found.items():
        pool[k] = [x["photo"] for x in got.get("picks") or []]
        small += [x["photo"] for x in got.get("picks") or [] if x.get("small")]
    (job / "stills_small.json").write_text(json.dumps(small), encoding="utf-8")
    n_s = sum(int(g.get("searches") or 0) for g in found.values())
    log(f"  named things: {len(named)} mention(s) of {len(things)} thing(s); photos found for "
        f"{sum(1 for v in pool.values() if v)} — {n_s} search(es)")
    return pool


def _named_report(job: Path, plan: list, named: list, named_pool: dict, labels_added: list) -> None:
    """What was on screen when each named thing was spoken — stills/named_report.json and one log line."""
    owner = {ph: k for k, v in named_pool.items() for ph in v}
    starts, t = [], 0.0
    for e in plan:
        starts.append((t, t + float(e[3]), e))
        t += float(e[3])
    labelled = {round(float(x["t"]), 1) for x in labels_added}
    rows, tally = [], {}
    for x in named:
        e = next((e for a, b, e in starts if a <= x["t"] < b), None)
        if e is None:
            shown = "end"
        elif e[0] == "photo" and owner.get(str(e[1])) == x["key"]:
            shown = "real photo of it"
        elif e[0] == "photo" and str(e[1]) in owner:
            shown = "photo of another named thing"
        elif e[0] == "photo" and "/stills/" in str(e[1]):
            shown = "setting photo"
        elif e[0] == "photo":
            shown = "AI still"
        elif e[0] == "video":
            shown = "video" + (" + name label" if round(x["t"], 1) in labelled else "")
        else:
            shown = "graphic/scene"
        tally[shown] = tally.get(shown, 0) + 1
        rows.append({"t": x["t"], "name": x["name"], "type": x["type"], "shown": shown,
                     "media": str(e[1]) if e else ""})
    (job / "stills" / "named_report.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False), encoding="utf-8")
    log("  named things on screen: " + " · ".join(f"{k} {v}" for k, v in sorted(tally.items(), key=lambda kv: -kv[1])))


def _fit_whole(photo: str, im) -> str:
    """The whole photo at the screen's height, centred on a blurred, darkened copy of itself (1920x1080) — for a small
    picture or a tall portrait, which a full-screen crop would cut through (a face lost at the top)."""
    from PIL import Image, ImageFilter, ImageEnhance
    rgb = im.convert("RGB")
    W, H = 1920, 1080
    s_ = max(W / rgb.width, H / rgb.height)
    back = rgb.resize((int(rgb.width * s_) + 1, int(rgb.height * s_) + 1), Image.LANCZOS)
    back = back.crop(((back.width - W) // 2, (back.height - H) // 2, (back.width - W) // 2 + W, (back.height - H) // 2 + H))
    back = ImageEnhance.Brightness(back.filter(ImageFilter.GaussianBlur(28))).enhance(0.45)
    f = min((H - 80) / rgb.height, (W - 160) / rgb.width)
    fg = rgb.resize((max(1, int(rgb.width * f)), max(1, int(rgb.height * f))), Image.LANCZOS)
    back.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2))
    out = Path(photo).with_name(Path(photo).stem + "_fit.jpg")
    back.save(out, quality=92)
    return str(out)


def _face_frame(photo: str, box: list, person: bool) -> str:
    """A 16:9 cut of a photo centred on its subject — for a person on the face (the top of their box), so a tall
    portrait never loses the head. The original when the cut would be too small to fill the screen."""
    from PIL import Image
    try:
        with Image.open(photo) as im:
            w, h = im.size
            x0, y0, x1, y1 = [float(v) for v in box]
            cx = (x0 + x1) / 2 * w
            cy = (y0 + (y1 - y0) * (0.22 if person else 0.5)) * h
            cw = min(w, h * 16 / 9)
            ch = cw * 9 / 16
            if cw < 900 or (person and h > w * 1.05):
                return _fit_whole(photo, im)                     # small or a tall portrait: shown whole, never cut
            left = min(max(0.0, cx - cw / 2), w - cw)
            top = min(max(0.0, cy - ch / 2), h - ch)
            if abs(cw - w) < 4 and abs(ch - h) < 4:
                return photo
            out = Path(photo).with_name(Path(photo).stem + "_frame.jpg")
            im.convert("RGB").crop((int(left), int(top), int(left + cw), int(top + ch))).save(out, quality=92)
            return str(out)
    except Exception:                                            # noqa: BLE001 - keep the photo as it is
        return photo


FINAL_CHECK = os.environ.get("FINAL_CHECK", "1") == "1"
FINAL_CHECK_PROMPT = """You are checking a finished documentary video before it is uploaded. Watch it once, with its narration.
List ONLY clear problems a viewer would notice, each with its timestamp (mm:ss):
- text on screen that moves or changes too fast to read;
- a name or label that does not match the picture under it;
- a person's face cut off, or the camera zoomed onto a forehead or an empty area;
- text drawn over other text;
- black, frozen or glitching frames;
- a picture that clearly shows the wrong person or thing for what is being said.
Do not list matters of taste or style. A number counting up to its final value, or a word typing on, is an animation,
not a fault. Return JSON only:
{"issues": [{"t": "01:35", "what": "the sentence pans past too fast to read", "fix": "hold it longer"}]}
or {"issues": []} when nothing is clearly wrong."""


def _final_check(final) -> None:
    """One look by Gemini (GEMINI_MODEL, Flash-Lite) at the finished video: a short report of suspicious moments
    next to it (<title> — check.txt). Report only — one pass, never re-renders. FINAL_CHECK=0 turns it off."""
    if not FINAL_CHECK or not final or not Path(final).exists():
        return
    final = Path(final)
    small = final.with_name(".check-360p.mp4")
    try:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(final), "-vf", "scale=-2:360,fps=10", "-c:v", "libx264",
                        "-crf", "32", "-preset", "veryfast", "-c:a", "aac", "-b:a", "32k", "-ac", "1", str(small)],
                       check=True, capture_output=True, timeout=3600)
        import youtube
        raw = youtube._gemini_log("", FINAL_CHECK_PROMPT, None, file=small)
        issues = (_json_obj(raw) or {}).get("issues") or []
        lines = [f"Final check by Gemini — {len(issues)} moment(s) to look at (a report only; nothing was changed)", ""]
        lines += [f"{x.get('t', '?')}  {x.get('what', '')}" + (f"  → {x['fix']}" if x.get("fix") else "") for x in issues
                  if isinstance(x, dict)]
        final.with_name(final.stem + " — check.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        log(f"  final check: {len(issues)} moment(s) flagged — see '{final.stem} — check.txt'")
    except Exception as e:                                        # noqa: BLE001 - a check never costs the video
        log(f"  final check: skipped — {type(e).__name__}: {str(e)[:150]}")
    finally:
        small.unlink(missing_ok=True)


def _clip_seen(job: Path) -> dict:
    """{clip file name: what Gemini saw in that stretch of its video} — from youtube/catalog/<video>.json shot logs,
    the shots overlapping the clip's start–end. Falls back to the clip's search need when no log is there."""
    def sec(v):
        try:
            parts = [float(x) for x in str(v).split(":")]
            return parts[0] * 60 + parts[1] if len(parts) == 2 else parts[0]
        except ValueError:
            return 0.0
    out, logs = {}, {}
    try:
        rows = json.loads((job / "youtube" / "clips.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return out
    for r in rows:
        try:
            vid, a, b = str(r.get("video") or ""), float(r.get("start") or 0), float(r.get("end") or 0)
            if vid not in logs:
                f = job / "youtube" / "catalog" / f"{re.sub(r'[^A-Za-z0-9_.-]', '_', vid)}.json"
                logs[vid] = json.loads(f.read_text(encoding="utf-8")).get("shots") or [] if f.exists() else []
            seen = [str(sh.get("shows") or "") for sh in logs[vid] if sec(sh.get("start")) < b and a < sec(sh.get("end"))]
            out[Path(r["path"]).name] = (" ".join(seen) if seen else f'{r.get("need", "")} {r.get("line", "")}').lower()
        except (KeyError, TypeError, ValueError, OSError, AttributeError):
            continue
    return out


def _match_text(job: Path, plan: list, named: list) -> None:
    """Owner rules 2026-10-05 for text over pictures: (1) a photo of a named thing carries its own name label;
    (2) a label that names something sits only on a shot of that thing — else it moves up to 4 s or is dropped;
    (3) a label that names nothing never sits on a person or a named thing. Rewrites overlays.json."""
    picks = {}
    for f in (job / "stills" / "named").glob("*/photos.json"):
        try:
            got = json.loads(f.read_text(encoding="utf-8"))
            for x in got.get("picks") or []:
                picks[x["photo"]] = {"name": got.get("name", ""), "type": got.get("type", ""), "box": x.get("box")}
        except (OSError, ValueError, KeyError):
            pass
    try:
        for ph, who_ in json.loads((job / "stills" / "identity.json").read_text(encoding="utf-8")).items():
            picks.setdefault(ph, {"name": who_.get("name", ""), "type": who_.get("type", ""), "box": None})
    except (OSError, ValueError, AttributeError):
        pass
    about = {x["name"].lower(): x.get("about", "") for x in named}
    try:
        scenes = json.loads((job / "director.json").read_text(encoding="utf-8")).get("scenes") or []
    except (OSError, ValueError, AttributeError):
        scenes = []
    person_scene = [(float(x.get("_t", x.get("t", 0))), float(x.get("_end", x.get("end", 0))),
                     str(x.get("subject") or x.get("words") or "").lower())
                    for x in scenes if x.get("tool") in ("spotlight", "strip", "matchcut")]
    need_of = _clip_seen(job)                                    # what Gemini saw in each clip, not what it was searched for
    # each slot: (start, end, what it shows: name or "", is it a person/named thing)
    slots, t = [], 0.0
    for i, (kind, path, leak, dur) in enumerate(plan):
        a, b = t, t + float(dur)
        who, ident = "", False
        if kind == "photo" and str(path) in picks:
            who, ident = picks[str(path)]["name"].lower(), True
        elif kind == "motion":
            hit = next((n for x, y, n in person_scene if x < b and a < y), None)
            if hit is not None:
                who, ident = hit, True
        slots.append([a, b, who, ident, kind, path])
        t = b
    names = sorted({x["name"].lower() for x in named}, key=len, reverse=True)

    def names_in(text):
        low = text.lower()
        return next((n for n in names if n in low or (len(n.split()) > 1 and n.split()[-1] in low.split())), None)

    def ok(t0, d, text, styl):
        under = [sl for sl in slots if sl[0] < t0 + d and t0 < sl[1]]
        if len(under) != 1:                                      # a label stays on one shot, never across a cut
            return False
        named_here = names_in(text) or (text.lower() if styl in ("name", "place") else None)
        for a, b, who, ident, kind, _p in under:
            if named_here:                                       # rule 2: on a shot KNOWN to show exactly that
                need = need_of.get(Path(str(_p)).name, "") if kind == "video" else ""
                if not ((who and (named_here in who or who in named_here)) or (need and named_here in need)):
                    return False
            elif styl == "phrase" and kind == "video" and Path(str(_p)).name not in need_of:
                return False                                     # a term never on generic stock footage
            elif ident:
                # rule 3: never on a person/named thing it is not about — a date or number of the same sentence
                # (that thing named within a few seconds) is about it
                if styl not in ("date", "number") or not any(abs(x["t"] - t0) <= 6.0 and who and
                                                              (x["name"].lower() in who or who in x["name"].lower())
                                                              for x in named):
                    return False
        return True

    try:
        labels = json.loads((job / "overlays.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        labels = []
    kept, moved, dropped, insets = [], 0, 0, []
    ends, proper = _sentence_ends(job), {x["name"].lower(): x["name"] for x in named}
    for lb in sorted(labels, key=lambda x: float(x["t"])):
        t0, d = float(lb["t"]), float(lb.get("dur", 3.6))
        cut = next((sl[1] for sl in slots if sl[0] <= t0 < sl[1]), None)
        if cut is not None and t0 + d > cut - 0.3 and cut - 0.3 - t0 >= 2.2:
            d = round(cut - 0.3 - t0, 2)                         # trimmed to end on its own shot
            lb = dict(lb, dur=d)
        text = f'{lb.get("text", "")} {lb.get("sub", "")}'
        for dd in [0.0] + _shifts(t0, ends):
            if t0 + dd >= 0 and ok(t0 + dd, d, text, lb.get("style")) and \
                    not any(float(k["t"]) < t0 + dd + d and t0 + dd < float(k["t"]) + float(k.get("dur", 3.6)) for k in kept):
                moved += dd != 0.0
                kept.append(dict(lb, t=round(t0 + dd, 2)))
                break
        else:
            dropped += 1
            if names_in(text):                                   # its real photo in an inset instead (legends)
                insets.append({"t": t0, "name": proper.get(names_in(text), names_in(text)), "sub": lb.get("sub", "")})
    # rule 1: a named photo carries its name, once per thing per minute, when nothing else is written there
    # a name already written by another label counts too (CHEVROLET VEGA twice in four seconds)
    added, last_at = 0, {names_in(str(k.get("text", ""))): float(k["t"]) for k in kept if names_in(str(k.get("text", "")))}
    for a, b, who, ident, kind, path in slots:
        info = picks.get(str(path)) if kind == "photo" else None
        # the final mix hides a label within ~0.3 s of a full-screen scene and shows one at least 2.2 s: a name
        # label needs a photo long enough to sit inside it with that room on both sides
        if not info or b - a < 3.1:
            continue
        nm = info["name"]
        if abs(a - last_at.get(nm.lower(), -999)) < 60.0 or any(float(k["t"]) < b and a < float(k["t"]) + float(k.get("dur", 3.6)) for k in kept):
            continue
        role = str(about.get(nm.lower(), "")).split(",")[0].strip()
        style_ = {"person": "name", "place": "place", "company": "place"}.get(info["type"], "phrase")
        kept.append({"t": round(a + 0.45, 2), "dur": round(min(3.2, b - a - 0.85), 2), "style": style_,
                     "text": nm.upper(), "sub": role.upper() if role and len(role.split()) <= 3 else ""})
        last_at[nm.lower()] = a
        added += 1
    (job / "overlays.json").write_text(json.dumps(sorted(kept, key=lambda x: float(x["t"])), indent=1,
                                                  ensure_ascii=False), encoding="utf-8")
    (job / "legends").mkdir(exist_ok=True)
    (job / "legends" / "insets.json").write_text(json.dumps(insets, indent=1, ensure_ascii=False), encoding="utf-8")
    stills = [sl for sl in slots if sl[4] == "photo"]
    busy = [(float(k["t"]), float(k["t"]) + float(k.get("dur", 3.6))) for k in kept]
    for f in ("war_chess/moments.json", "legends/moments.json"):
        try:
            busy += [(float(x.get("t", x.get("_t"))), float(x.get("end") or x.get("_end") or 0)) for x in
                     json.loads((job / f).read_text(encoding="utf-8"))]
        except (OSError, ValueError, TypeError):
            pass
    treated = sum(1 for a, b, *_ in stills if any(x < b and a < y for x, y in busy))
    log(f"  text on pictures: {added} name label(s) on named photos, {moved} label(s) moved to a matching shot, "
        f"{dropped} dropped (no matching shot, {len(insets)} to an inset) · stills with a treatment: "
        f"{treated}/{len(stills)} ({100 * treated // max(1, len(stills))}%) · AI pictures {_AI_IMAGES['used']}/{AI_IMAGE_CAP}")


def _stills_look(job: Path, plan: list) -> None:
    """stills_look.json {path: "framed" | "aged"}: a real still with no label, template or War Chess text on it gets
    a photo effect instead of playing bare; a small photo is always laid on paper (never blown up)."""
    def spans(path, key_t="t", key_end="end", dur="dur"):
        try:
            rows = json.loads((job / path).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return []
        out = []
        for x in rows if isinstance(rows, list) else []:
            try:
                a = float(x.get(key_t, x.get("_t")))
                out.append((a, float(x.get(key_end) or x.get("_end") or a + float(x.get(dur) or 3.6))))
            except (TypeError, ValueError, AttributeError):
                pass
        return out
    busy = spans("overlays.json") + spans("war_chess/moments.json") + spans("legends/moments.json")
    try:
        small = set(json.loads((job / "stills_small.json").read_text(encoding="utf-8")))
    except (OSError, ValueError):
        small = set()
    looks, t, n = {}, 0.0, 0
    for kind, path, _leak, dur in plan:
        end = t + float(dur)
        if kind == "photo" and "/stills/" in str(path) and not str(path).endswith("_fit.jpg"):
            if not any(a < end and t < b for a, b in busy):
                if n % 2 == 0:
                    looks[str(path)] = "aged"
                n += 1
        t = end
    (job / "stills_look.json").write_text(json.dumps(looks, indent=1), encoding="utf-8")
    log(f"  bare stills given a photo effect: {len(looks)}")


def _real_photo_pool(job: Path, total: float) -> dict:
    """{stretch index: [photo path]} plus "_t": [stretch start in script seconds] — real photographs for the plain
    still slots, searched per stretch with its own real-subject searches (youtube/needs.json: the person, place,
    machine; broll_queries.json only when there are none), ≤2 searches and one Gemini pick each. The same
    photograph is kept once; small ones are listed in stills_look.json to be shown laid on paper."""
    import photofx
    clean = lambda q: re.sub(r"\b(footage|explained|interview|documentary|animation|video|history footage)\b", "",
                             str(q or ""), flags=re.I).strip(" ,-")
    stretches = []
    try:
        for x in json.loads((job / "youtube" / "needs.json").read_text(encoding="utf-8")):
            if clean(x.get("q")):
                stretches.append((float(x.get("t") or 0), clean(x.get("q")), clean(x.get("q2"))))
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    if not stretches:
        try:
            rows = json.loads((job / "broll_queries.json").read_text(encoding="utf-8"))
            w_s = float((rows[0] or {}).get("win_s") or 60.0)
            seen = {}
            for r in rows:
                if isinstance(r, dict) and str(r.get("q") or "").strip():
                    seen.setdefault(int(r.get("w", 0)), str(r["q"]).strip())
            stretches = [(w * w_s, q, "") for w, q in sorted(seen.items())]
        except (OSError, ValueError, TypeError, AttributeError):
            return {}
    if not stretches:
        return {}
    stretches.sort()
    span = (stretches[1][0] - stretches[0][0]) if len(stretches) > 1 else total
    n = max(2, min(8, math.ceil(span * (_MIX[0] / 100.0) / max(1.0, STILL_MAX_S)) + 1))
    me = sys.modules[__name__]
    with ThreadPoolExecutor(max_workers=4) as ex:
        found = list(ex.map(lambda i: photofx.slot_photos(me, stretches[i][1], job / "stills" / f"w{i:03d}", n,
                                                         query2=stretches[i][2]), range(len(stretches))))
    pool, hashes, small = {"_t": [t for t, _, _ in stretches], "_q": [q for _, q, _ in stretches]}, [], []
    for i, picks in enumerate(found):
        for x in picks:
            h = x.get("hash")
            if h is not None and any(photofx._same_photo(int(h), int(k)) for k in hashes):
                continue
            if h is not None:
                hashes.append(h)
            pool.setdefault(i, []).append(x["photo"])
            if x.get("small"):
                small.append(x["photo"])
    (job / "stills_small.json").write_text(json.dumps(small), encoding="utf-8")
    log(f"  real stills: {sum(len(v) for k, v in pool.items() if k != '_t')} photo(s) for "
        f"{len([k for k in pool if k != '_t'])} of {len(stretches)} stretches ({len(small)} small, shown on paper)")
    return pool


def _topic_leaks(job: Path, plan: list) -> list:
    """The plan with a film-burn leak on the first footage slot after each topic change — the longest narrator
    pauses (words.json), at least LEAK_MIN_GAP_S apart. Free: no model call."""
    try:
        cues = json.loads((job / "words.json").read_text(encoding="utf-8"))["cues"]
        words = sorted(w for k in cues for w in cues[k])
    except (OSError, ValueError, KeyError, TypeError):
        return plan
    # the longest pause of each minute is where the narration turns (a tight read may never pause a full second)
    pauses = sorted(((b[0] - a[1], b[0]) for a, b in zip(words, words[1:]) if b[0] - a[1] >= LEAK_PAUSE_S),
                    reverse=True)
    turns = []
    for _gap, at in pauses:
        if at > 20.0 and all(abs(at - x) >= LEAK_MIN_GAP_S for x in turns):
            turns.append(at)
    starts, t = [], 0.0
    for e in plan:
        starts.append(t)
        t += float(e[3])
    out = [tuple(e) for e in plan]
    for at in sorted(turns):
        i = next((i for i, s in enumerate(starts) if s >= at - 0.5 and out[i][0] == "video" and float(out[i][3]) >= 2.0), None)
        if i is not None:
            out[i] = (out[i][0], out[i][1], True, out[i][3])
    if OPENING_TIERS:
        # the hook also turns on its sentences: a few light leaks and white flashes, alternating, between beats
        beats = sorted(b[0] for a, b in zip(words, words[1:]) if b[0] - a[1] >= 0.35 and 3.0 <= b[0] < OPENING_RICH_S)
        taken = [s_ for s_, e in zip(starts, out) if e[2]]
        n = 0
        for at in beats:
            if any(abs(at - x) < OPENING_FX_GAP_S for x in taken):
                continue
            i = next((i for i, s_ in enumerate(starts) if s_ >= at - 0.5), None)
            if i is None or out[i][0] not in ("video", "photo") or float(out[i][3]) < 2.0 or out[i][2]:
                continue
            out[i] = (out[i][0], out[i][1], "flash" if n % 2 else True, out[i][3])
            taken.append(starts[i]); n += 1
    return out


def assemble_astrology_motion(photos: list, ai_clips: list, pexels_clips: list, mm_segs: list,
                               mp3: Path, srt: Path, job: Path, burn_subs: bool, force: bool,
                               sub_center: bool = False, white_fade: float = 0.0,
                               style: str = "") -> Path:
    """Astrology assembly WITH per-minute mindmap segments. Keeps the astrology look
    (vignette + light leaks) but suppresses dust over the mindmap windows."""
    final = job / "video.mp4"
    if final.exists() and not force:
        log(f"cached: {final.name}")
        return final
    total = _audio_dur(mp3)
    plan = _build_astro_motion_plan(job, total, photos, ai_clips, pexels_clips, mm_segs, force, style)
    film = _styles.is_documentary(style)
    if film and style not in STYLE_NO_LEAK:
        plan = _topic_leaks(job, plan)
    no_dust, tt = [], 0.0
    for e in plan:
        dur = float(e[3])
        # a treated slot shows its own line, so captions are muted there too
        if _mutes_captions(e, sub_center):
            no_dust.append((tt, tt + dur))
        tt += dur
    no_captions = list(no_dust)
    vig_ranges = look_ranges = None
    if film:
        no_dust, vig_ranges, look_ranges = _film_look(job, plan, total, sub_center)
        log(f"  film look: dust on {total - sum(b - a for a, b in no_dust if a < total):.0f}s, "
            f"vignette on {sum(b - a for a, b in vig_ranges):.0f}s, "
            + "".join(f"{n} on {sum(b - a for a, b, k in look_ranges if k == n):.0f}s, " for n in _LOOK_VF) +
            f"{sum(1 for e in plan if e[2] is True)} light leak(s), {sum(1 for e in plan if e[2] == 'flash')} white flash(es)")
    segs = _render_astro_segments(plan, job, force, white_fade=white_fade, style=style)
    if (HERE / "cinema.py").exists():
        import cinema
        segs = cinema.post_segments(sys.modules[__name__], plan, segs, job, style)
    _concat_segments(segs, job / "_visual.mp4")
    if "legends" not in _DLC_OFF and (HERE / "legends.py").exists():
        import legends
        if legends.enabled(sys.modules[__name__], style):
            try:
                legends.overlay_windows(sys.modules[__name__], job, style, plan, job / "_visual.mp4")
            except Exception as e:                                  # an extra, never a reason to lose the video
                log(f"  legends: over-footage edits skipped — {str(e)[:200]}")
    cta = _cta_times(job, srt) if _styles.is_documentary(style) else []
    _final_mux(job, _with_edit_sounds(job, _with_cta_sound(job, _with_sound_design(job, mp3, plan, style), cta)), srt, burn_subs,
               add_qr=False, vignette=ASTRO_VIGNETTE and not film, no_dust_ranges=no_dust, sub_center=sub_center,
               no_sub_ranges=no_captions, vignette_ranges=vig_ranges, look_ranges=look_ranges, cta_times=cta)
    (job / "_visual.mp4").unlink(missing_ok=True)
    if film:
        _stutter_scan(final, plan)
    return final


def _stutter_scan(video: Path, plan: list = None) -> list:
    """Log the seconds of the finished video where moving footage repeats frames (a hitch the viewer sees as lag).
    Only seconds that lie wholly inside a footage slot are judged — a still's eased zoom and a graphic's holds are
    meant to rest. Decoded at 160x90 grey, a minute or two for a long video, no model call. Report only."""
    spans, t = [], 0.0
    for e in plan or []:
        if e[0] == "video":
            spans.append((t + 0.3, t + float(e[3]) - 0.3))
        t += float(e[3])
    frame = 160 * 90
    try:
        import numpy as np
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(video), "-an", "-vf", "scale=160:90,format=gray",
                              "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
        prev, diffs = None, []
        while True:
            buf = p.stdout.read(frame)                   # whole frames only: a short pipe read must not shift the rest
            while buf and len(buf) < frame:
                more = p.stdout.read(frame - len(buf))
                if not more:
                    break
                buf += more
            if len(buf) < frame:
                break
            cur = np.frombuffer(buf, np.uint8).astype(np.float32)
            if prev is not None:
                diffs.append(float(np.abs(cur - prev).mean()))
            prev = cur
        p.wait()
    except Exception as e:                                       # noqa: BLE001 - a report, never a failure
        log(f"  stutter scan skipped: {str(e)[:80]}")
        return []
    bad = []
    for s in range(len(diffs) // FPS):
        if plan is not None and not any(a <= s and s + 1 <= b for a, b in spans):
            continue
        sec = diffs[s * FPS:(s + 1) * FPS]
        moving = sorted(sec)[len(sec) // 2]
        # moving footage (median change well above noise) with several near-identical frames in that second
        if moving > 1.0 and sum(1 for x in sec if x < 0.25 * moving) >= 4:
            bad.append(s)
    if bad:
        log(f"  stutter scan: repeated frames in {len(bad)} second(s) of footage: "
            + ", ".join(f"{s // 60}:{s % 60:02d}" for s in bad[:20]) + (" ..." if len(bad) > 20 else ""))
    else:
        log("  stutter scan: no repeated-frame hitches in the footage")
    return bad



# ════════════════════════════════════════════════════════════════════════════
# YOUTUBE DESCRIPTION — text, chapters, tags, sources
# ════════════════════════════════════════════════════════════════════════════
def _json_obj(text: str) -> dict:
    """The first JSON object in a model's reply, code fences and chatter tolerated."""
    t = re.sub(r"^```[a-z]*|```$", "", (text or "").strip(), flags=re.M).strip()
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j <= i:
        return {}
    try:
        return json.loads(t[i:j + 1])
    except ValueError:
        return {}


def _stamp(sec: float) -> str:
    """0:00 / 12:34 / 1:02:03 — the form YouTube turns into a chapter."""
    sec = max(0, int(sec))
    h, m, ss = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}:{m:02d}:{ss:02d}" if h else f"{m}:{ss:02d}"


def _sentence_start(entries: list, i: int, back: int = 4) -> int:
    """Walk back to the cue that OPENS the sentence. A chapter that starts half a
    sentence in reads like a mistake even when the second is right."""
    for _ in range(back):
        if i <= 0 or re.search(r"[.!?…\"')]\s*$", entries[i - 1][1].strip()):
            break
        i -= 1
    return i


def _line_at(entries: list, line: str, after: int = 0) -> tuple:
    """Where a chapter's opening sentence is actually spoken: (start_seconds, index).

    The sentence is matched against the SUBTITLES, because that is the only place
    the real timing lives. A model asked for timestamps directly invents them, and
    a chapter twenty seconds off its words is worse than no chapters at all.
    An opening sentence is often split across two or three cues, so a window of
    cues is searched, and the search only ever moves forward.
    """
    words = [w for w in _fold(line).split() if len(w) > 1][:8]
    if not words or after >= len(entries):
        return (None, after)
    best, best_i, best_score = None, after, 0.0
    for i in range(after, len(entries)):
        hay = _fold(" ".join(t for _, t in entries[i:i + 3]))
        score = sum(1 for w in words if w in hay) / len(words)
        if score > best_score:
            best, best_i, best_score = entries[i][0], i, score
        if score >= 0.95:
            break
    if best_score < 0.5:
        return (None, after)
    j = _sentence_start(entries, best_i)
    return (entries[j][0], best_i)


def _chapters_from_srt(script: str, srt: Path, job: Path, want: int, total: float, lang: str = "English") -> list:
    """[(seconds, title)] — `want` chapters, timed off the subtitle file."""
    entries = _parse_srt(srt.read_text(encoding="utf-8")) if srt.exists() else []
    if not entries or want < 3:
        return []
    log(f"Claude: splitting the script into {want} chapters...")
    items = _json_items(f"Write the chapter titles in {lang}.\n\n"
                        + prompts.YOUTUBE_CHAPTERS_PROMPT
                        .replace("[INSERT COUNT HERE]", str(want))
                        .replace("[INSERT SCRIPT HERE]", script[:60000]),
                        max_tokens=max(1500, want * 120))
    out, idx = [], 0
    for it in items:
        if not isinstance(it, dict):
            continue
        ttl = str(it.get("title") or "").strip().strip(".")
        at, idx = _line_at(entries, str(it.get("first_line") or ""), idx)
        if ttl and at is not None:
            out.append((float(at), ttl[:60]))
    out.sort(key=lambda c: c[0])
    # YouTube's own rules: first chapter at 0:00, at least three, none shorter
    # than ten seconds. Anything the matcher could not place is simply dropped.
    kept = []
    for at, ttl in out:
        if not kept:
            kept.append((0.0, ttl))
        elif at - kept[-1][0] >= 10.0 and at < total - 10.0:
            kept.append((at, ttl))
    if len(kept) < 3:                       # matching failed — fall back to an even split
        n = max(3, min(want, int(total // 60) or 3))
        step = total / n
        log(f"  chapters: could not place the lines, splitting evenly into {n}")
        kept = [(i * step, f"Part {i + 1}" if i else "Intro") for i in range(n)]
    return kept


def _live_url(u: str, timeout: float = 6.0) -> bool:
    """True when the address actually answers. A dead link in a description is
    worse than a source named in plain text, so unverified ones are dropped."""
    import urllib.error
    import urllib.request
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (movefast)"})
    for method in ("HEAD", "GET"):          # some publishers refuse HEAD
        try:
            req.method = method
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return 200 <= int(getattr(r, "status", 200)) < 400
        except Exception:                   # noqa: BLE001
            continue
    return False


def generate_youtube_meta(title: str, script: str, srt: Path, job: Path, style: str = "",
                          chapters_n: int = 8, sources_n: int = 0, force: bool = False) -> Path:
    """Write youtube.txt for a finished video: description, chapters, tags, sources.

    Everything is in English and ready to paste: chapters as `0:42 Title` lines,
    tags comma-separated with no hashes, sources only when their link answers.
    """
    out = job / "youtube.txt"
    if out.exists() and not force:
        log(f"cached: {out.name}")
        return out
    st = STYLE_INFO.get(style) or {}
    channel = " — ".join(x for x in [st.get("label") or style, st.get("description") or ""] if x)
    total = 0.0
    mp3 = job / "audio.mp3"
    if mp3.exists():
        try:
            total = _audio_dur(mp3)
        except Exception:                   # noqa: BLE001
            total = 0.0

    lang = (_job_language(job, style) or "English").strip()
    say_lang = f"Write the description and every tag in {lang}.\n\n"
    log(f"Claude: writing the description + tags ({lang})...")
    data = _json_obj(claude(say_lang + prompts.YOUTUBE_DESC_PROMPT
                            .replace("[INSERT CHANNEL HERE]", channel or "a faceless YouTube channel")
                            .replace("[INSERT TITLE HERE]", title)
                            .replace("[INSERT SCRIPT HERE]", script[:60000]),
                            SCRIPT_MODEL, max_tokens=1600, provider=SCRIPT_PROVIDER))
    desc = str(data.get("description") or "").strip()
    tags = [str(t).strip().lstrip("#").lower() for t in (data.get("tags") or []) if str(t).strip()]
    tags = list(dict.fromkeys(tags))[:18]

    # a video with chapter cards (cinema.py) lists those: the titles the viewer saw, at the second each card starts
    chapters = []
    listed = job / "chapters_youtube.txt"
    if listed.exists():
        for ln in listed.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^(\d+(?::\d\d){1,2})\s+(.+)$", ln.strip())
            if m:
                parts = [int(x) for x in m.group(1).split(":")]
                chapters.append((float(parts[-1] + 60 * parts[-2] + (3600 * parts[0] if len(parts) == 3 else 0)),
                                 m.group(2).strip()))
    if len(chapters) < 3:
        chapters = _chapters_from_srt(script, srt, job, int(chapters_n or 0), total, lang) if chapters_n else []

    sources = []
    if sources_n:
        log(f"Claude: looking for {sources_n} sources behind the script...")
        for it in _json_items(prompts.SOURCES_PROMPT
                              .replace("[INSERT COUNT HERE]", str(int(sources_n)))
                              .replace("[INSERT SCRIPT HERE]", script[:60000]), max_tokens=1600):
            if not isinstance(it, dict):
                continue
            label, url = str(it.get("label") or "").strip(), str(it.get("url") or "").strip()
            if not label:
                continue
            if url and not _live_url(url):
                log(f"  dropped a dead link: {url[:70]}")
                url = ""
            sources.append({"label": label[:140], "url": url})

    body = [desc] if desc else []
    # the free-licence films the edit used ask to be named
    try:
        cred = json.loads((job / "footage_credits.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cred = []
    if cred:
        body += ["", "FOOTAGE"] + [f"- {c.get('credit')}" + (f" — {c.get('page')}" if c.get("page") else "")
                                   for c in cred[:12]]
    if chapters:
        body += ["", "CHAPTERS"] + [f"{_stamp(t)} {ttl}" for t, ttl in chapters]
    if sources:
        body += ["", "SOURCES"] + [f"- {s['label']}" + (f" — {s['url']}" if s["url"] else "") for s in sources]
    if tags:
        body += ["", "TAGS", ", ".join(tags)]
    out.write_text("\n".join(body).strip() + "\n", encoding="utf-8")
    (job / "youtube.json").write_text(json.dumps(
        {"title": title, "description": desc, "tags": tags,
         "chapters": [{"at": _stamp(t), "seconds": round(t, 2), "title": ttl} for t, ttl in chapters],
         "sources": sources}, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"description: {len(desc.split())} words, {len(chapters)} chapters, "
        f"{len(tags)} tags, {len(sources)} sources -> {out.name}")
    return out


def _visuals_plugin(style: str):
    """The visuals engine a channel names in `look.visuals`, when it is not one of
    the built-in ones ("scenes", "quotes"): `"vox"` loads vox.py from this folder.

    This is how a DLC adds a whole new kind of video without editing this file. The
    module is handed this engine as its first argument rather than importing it —
    run as `python make_video.py`, an import would load a second copy of it."""
    name = str(((STYLE_INFO.get(style) or {}).get("look") or {}).get("visuals") or "").strip()
    if not name or name in ("scenes", "quotes"):
        return None
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,40}", name) or not (HERE / f"{name}.py").is_file():
        sys.exit(f"{style}: this channel needs {name}.py, which comes with its DLC — install the DLC again.")
    import importlib
    return importlib.import_module(name)


def _maybe_meta(meta, title: str, script: str, srt: Path, job: Path, style: str, force: bool) -> None:
    """The description is a nice-to-have; never let it cost the finished video."""
    if not meta:
        return
    try:
        step("Description + chapters (Claude)")
        generate_youtube_meta(title, script, srt, job, style,
                              int(meta.get("chapters") or 0), int(meta.get("sources") or 0), force)
    except BaseException as e:              # noqa: BLE001
        step(f"  ⚠ description failed, the video is fine: {type(e).__name__} {str(e)[:110]}")


# ════════════════════════════════════════════════════════════════════════════
# ORCHESTRATION
# ════════════════════════════════════════════════════════════════════════════
def _pick_variant(style: str, title: str, job: Path) -> str:
    """The look a channel takes for this title: the channel itself, or one of its variants (styles/variants/,
    "variant_of" the channel) whose "match" fits — a video-game story made in the Documentary channel gets the
    gaming explainer's voice, pace and look, a haircut routine the grooming how-to. Decided once per video:
    style.txt keeps the choice, so a re-render never changes its mind."""
    variants = {n: s for n, s in STYLE_INFO.items() if s.get("variant_of") == style}
    if not variants:
        return style
    kept = ""
    try:
        kept = (job / "style.txt").read_text(encoding="utf-8").strip()
    except OSError:
        pass
    if kept == style or kept in variants:
        return kept
    options = "\n".join([f"- {style}: {str((STYLE_INFO.get(style) or {}).get('description') or '')[:300]}"]
                        + [f"- {n}: {v.get('match') or v.get('description') or ''}" for n, v in variants.items()])
    prompt = (f'A video titled "{title}" is being made. Which of these looks fits it? The first one fits anything '
              f"the others do not.\n{options}\n\nReply with the name only.")
    chosen = style
    try:
        answer = claude(prompt, UTILITY_MODEL, max_tokens=30, provider=CLAUDE_PROVIDER)
        chosen = next((w for w in re.findall(r"[a-z0-9_-]+", (answer or "").lower()) if w in variants or w == style), style)
    except (Exception, SystemExit) as e:                            # noqa: BLE001 - the channel's own look is always right
        log(f"look: kept the {style} look — {str(e)[:80]}")
    if chosen != style:
        log(f"look: {(STYLE_INFO.get(chosen) or {}).get('label', chosen)} — this title fits it better than plain {style}")
    return chosen


def _maybe_avatar(final: Path, job: Path, mp3: Path, srt: Path,
                  avatar_id: str, avatar_s: float, force: bool, avatar_count: int = 1) -> Path:
    """Put the AI presenter into the finished video, if this job asked for one.

    Appearance 1 is the intro; with `avatar_count` above 1 the presenter comes back
    that many times in all (avatar.plan_windows: evenly spread, each from a sentence
    start to a sentence end, never in the last seconds). Every window replaces the
    PICTURE completely — scenes, labels, captions and all — and the audio is never
    touched, because each clip was lip-synced to exactly its own stretch of it.

    The result REPLACES the finished file in place (normally video.mp4) instead of
    landing beside it. Everything downstream reads video.mp4 — the named copy, the
    app's player and download button, the farm's upload — so a presenter written to
    a second file (it used to be final_avatar.mp4) was a presenter nobody saw.

    The plain cut is kept as video_plain.mp4, so a later render of the same title
    can change the face, the length or the number of appearances, or drop the
    presenter, without assembling the film again; avatar_applied.json records
    exactly which clips sit in which windows of which file, so a cached re-run never
    lays a second presenter over the first.

    Both gates have to agree: the switch is on AND a length was chosen. `feature()`
    answers True before any job has set its switches, so the length is what really
    keeps a presenter out of a video that never asked for one.

    Deliberately forgiving after that: by the time this runs the whole film exists,
    and an avatar service having a bad minute is no reason to hand back nothing. A
    failure is reported and the film is returned exactly as it was."""
    final = Path(final)
    plain = final.with_name(f"{final.stem}_plain{final.suffix}")
    applied_f = job / "avatar_applied.json"

    def baked_in():
        """The presenter already inside `final`, or None. Matched on the file's size
        and mtime, so a freshly assembled video can never pass for one."""
        try:
            a = json.loads(applied_f.read_text(encoding="utf-8"))
            st = final.stat()
        except (OSError, ValueError):
            return None
        return a if a.get("stamp") == [st.st_size, int(st.st_mtime)] else None

    prev = baked_in()
    want = bool(avatar_s) and float(avatar_s) > 0 and feature("avatar")
    if not want:
        if prev and plain.exists():      # an earlier render of this title had one; this one asked for none
            os.replace(plain, final)
            applied_f.unlink(missing_ok=True)
            log("avatar: taken out again — this render asked for no presenter")
        return final
    moved = False
    try:
        import avatar as av
        count = max(1, min(int(avatar_count or 1), av.MAX_COUNT))
        step(f"Avatar intro ({avatar_s:.0f}s, {avatar_id or 'first preset'})" if count == 1 else
             f"Avatar ({count} appearances of {avatar_s:.0f}s, {avatar_id or 'first preset'})")
        sf = job / "style.txt"
        _st = sf.read_text(encoding="utf-8").strip() if sf.exists() else ""
        _sav = ((STYLE_INFO.get(_st) or {}).get("look") or {}).get("avatar") or {}
        provider = str(_sav.get("provider") or av.DEFAULT_PROVIDER) if isinstance(_sav, dict) else av.DEFAULT_PROVIDER
        src = plain if (prev and plain.exists()) else final     # the film without a presenter in it
        fps = av.video_fps(src)
        wins = av.plan_windows(srt, _audio_dur(mp3), count, avatar_s, provider, fps=fps)
        if len(wins) < count:
            log(f"  presenter: placed {len(wins)} of {count} — the rest would not fit between the intro and the "
                f"last {av.TAIL_S:.0f}s at {avatar_s:.0f}s each, {av.MIN_GAP_S:.0f}s apart, on sentence edges")
        clips = []
        for i, (a_s, b_s) in enumerate(wins, 1):
            try:
                m = av.render_window(job, mp3, avatar_id, a_s, b_s, i, provider=provider, force=force, log=log)
            except Exception as e:
                # The intro is the presenter's introduction: without it an appearance
                # half-way through reads as a stranger walking in, so no intro, no
                # presenter. A later window that fails costs only that window.
                if i == 1:
                    raise
                why = str(e)
                log(f"  ⚠ presenter {i} of {len(wins)} skipped — {why[:160]}")
                if any(x in why.lower() for x in ("402", "insufficient", "balance", "top up")):
                    log("  presenter: the avatar service is out of credit — the remaining appearances are skipped too")
                    break
                continue
            clips.append((Path(m["clip"]), float(m["start"]), float(m["end"])))
        if len(clips) < len(wins):
            log(f"  presenter: {len(clips)} of {len(wins)} appearance(s) made it into the video")
        stamp_w = [[c.stat().st_size, int(c.stat().st_mtime), round(a_s, 3), round(b_s, 3)] for c, a_s, b_s in clips]
        if prev and prev.get("windows") == stamp_w:
            log(f"avatar: already in {final.name}")
            return final
        if prev and not plain.exists():
            log(f"  ⚠ avatar: {final.name} already carries a presenter and its plain cut is gone — "
                f"delete {final.name} and render again to change it")
            return final
        if not prev:                     # a fresh assembly: it becomes the plain cut
            os.replace(final, plain)
            moved = True
        tmp = final.with_name(f"{final.stem}_avatar_tmp{final.suffix}")
        av.splice(plain, clips, tmp, log=log)
        os.replace(tmp, final)
        st = final.stat()
        applied_f.write_text(json.dumps({"stamp": [st.st_size, int(st.st_mtime)], "windows": stamp_w,
                                         "avatar": avatar_id, "provider": provider, "count": len(clips)},
                                        indent=2), encoding="utf-8")
        return final
    except Exception as e:
        if moved and not final.exists() and plain.exists():
            os.replace(plain, final)     # the plain film goes back where everything expects it
        log(f"  ⚠ avatar skipped — {str(e)[:200]}")
        return final


def run_pipeline(title: str, minutes: int = 20, force: bool = False,
                 burn_subs: bool = True, sink=None, style: str = "", avatar_min: float = 0,
                 add_qr: bool = False, use_motion: bool = True, mindmap_only: bool = False,
                 byo_audio: str = "", motion_start_min: float = 0.0, motion_every_min: float = 0.0,
                 motion_seg_dur: float = 0.0, motion_ratio: float = 0.0,
                 mix: tuple = (), meta: dict = None, character: str = "",
                 character_image: str = "", maps: bool = True,
                 headlines: bool = True, spotlight: bool = True, objects: bool = True,
                 depth: bool = True, features: dict = None, extra: str = "",
                 avatar_id: str = "", avatar_s: float = 0, avatar_count: int = 1,
                 voice_preset=None) -> Path:
    _AI_IMAGES["used"] = 0
    voice_preset = validate_voice_preset(job_dir(title, style), style, voice_preset, byo_audio)
    global _SINK, _GRADE
    _SINK = sink
    set_extra(extra)
    # a style can ship its own presenter (look.avatar): used when the caller chose none
    _sav = ((STYLE_INFO.get(style) or {}).get("look") or {}).get("avatar") or {}
    if isinstance(_sav, dict) and _sav.get("id") and not avatar_s:
        avatar_id, avatar_s = str(_sav["id"]), float(_sav.get("seconds") or 3)
    style = _pick_variant(style, title, job_dir(title, style))
    voice_preset = validate_voice_preset(job_dir(title, style), style, voice_preset, byo_audio)
    global _STYLE_NOW
    _STYLE_NOW = style                # every module that asks "which channel is this?" gets the answer from the start
    mix, use_motion, maps, headlines, spotlight, objects, depth = _apply_features(
        style, features, mix, use_motion, maps, headlines, spotlight, objects, depth)
    set_mix(*(mix or STYLE_MIX.get(style) or MIX_DEFAULT))
    _lock_mix(style)
    # The presenter also belongs IN the pictures. Without this he speaks for eight
    # seconds and then the video becomes a stranger's house. A character the caller
    # supplied always wins — this only fills an empty one.
    global _CAST_FROM_AVATAR
    _CAST_FROM_AVATAR = False
    if not (character or '').strip() and avatar_id and avatar_s and feature("avatar"):
        try:
            import avatar as _av
            character = _av.cast_text(avatar_id) or character
            # ...and the presenter's own photo is the reference for the stills they appear in, so it is the
            # SAME face as the intro — words alone drew someone else (a swapped face kept the old stills' man)
            if not (character_image or '').strip():
                pic = _av.portrait(avatar_id)
                character_image = pic.resolve().relative_to((HERE / "assets").resolve()).as_posix()
            _CAST_FROM_AVATAR = True
        except Exception:                                    # noqa: BLE001
            pass
    set_character(character)          # per job, so one run never inherits another's mix
    set_character_image(character_image)
    set_scene_dlcs(maps, headlines, spotlight, objects, depth)
    # One tonal range per channel — see FOOTAGE_GRADE.
    _GRADE = os.environ.get("FOOTAGE_GRADE") or FOOTAGE_GRADE.get(style, "")
    try:
        job = job_dir(title, style)
        job.mkdir(parents=True, exist_ok=True)
        save_voice_choice(job, voice_preset)
        _unpublish(job, title)
        (job / "title.txt").write_text(f"{title}\n{minutes} minutes\n", encoding="utf-8")
        # recorded so a later re-render knows which narrator this job was for
        (job / "style.txt").write_text(style + "\n", encoding="utf-8")
        step(f"Title: {title}  ({minutes} min)")

        if byo_audio and _styles.uses_real_photos(style):   # Documentary family, and Mr Truth (look.real_photos)
            # A documentary with the owner's own recording takes the full documentary pipeline (director,
            # YouTube, Vox, War Chess): the recording becomes the cached voiceover and the subtitles are the
            # script's own words on its clock. The branch below is the older stills-and-stock path.
            step("Your own voiceover: the recording is the voice, the script is the subtitles")
            mp3 = job / "audio.mp3"
            if not mp3.exists() or force:
                shutil.copy2(byo_audio, mp3)
            pasted = job / "script.txt"
            script = (pasted.read_text(encoding="utf-8") if pasted.exists() and (job / "script.pasted").exists()
                      else transcribe_audio(mp3, job, force))
            if not (job / "script.pasted").exists():
                (job / "script.pasted").write_text("1", encoding="utf-8")
            align_script_audio(script, mp3, job, force)
            byo_audio = ""
        if byo_audio:
            # BRING-YOUR-OWN voiceover: the user's mp3 IS the audio. No script gen,
            # no TTS — transcribe it for subtitles + to drive the astrology visuals.
            step("1/3  Your own voiceover: taking the audio + transcribing it (whisper)")
            mp3 = job / "audio.mp3"
            if not mp3.exists() or force:
                shutil.copy2(byo_audio, mp3)
            script = transcribe_audio(mp3, job, force)
            srt = job / "subs.srt"
            step("2/3  Visuals (stills + AI clips) + Pexels — in parallel")
            with ThreadPoolExecutor(max_workers=2) as ex:
                fx = ex.submit(generate_astrology_visuals, script, job, force)
                fpx = ex.submit(fetch_astro_pexels_videos, job, force, _mix_pexels_pool())
                photos, ai_clips = fx.result()
                pexels_clips = fpx.result()
            step("3/3  Assemble video (ffmpeg — dust + vignette + light leak)")
            final = assemble_astrology(photos, ai_clips, pexels_clips, mp3, srt, job, burn_subs, force)
            _maybe_meta(meta, title, script, srt, job, style, force)
            final = _maybe_avatar(final, job, mp3, srt, avatar_id, avatar_s, force, avatar_count)
            final = publish_named_copy(job, title)
            if _styles.is_documentary(style) and CLEAN_RENDERS:
                _clear_render_cache(job, final)
            _final_check(final)
            step(f"DONE -> {final}")
            return final

        step("1/3  Script (Claude)")
        if (HERE / "legend.py").exists():
            # a LEGEND channel: the subject's own clip and cloned voice, found before the script is written
            import legend
            legend.prepare(sys.modules[__name__], title, job, style)
        script = generate_script(title, minutes, job, force, style=style)

        if mindmap_only:
            # Whole video = XMind screen-recording (per-minute detailed maps, static
            # camera + wandering cursor + text-select). No AI images, no Pexels.
            step("2/3  Voiceover")
            mp3, srt = generate_voiceover(script, job, force, avatar_min, style, voice_preset)
            step("3/3  Mindmap-only (per-minute maps, screen-recording style) + assemble")
            segs = generate_mindmap_xmind(script, srt, job, _audio_dur(mp3), force)
            final = assemble_xmind_only(segs, mp3, srt, job, burn_subs, force, add_qr=add_qr)
            final = _maybe_avatar(final, job, mp3, srt, avatar_id, avatar_s, force, avatar_count)
            final = publish_named_copy(job, title)
            if _styles.is_documentary(style) and CLEAN_RENDERS:
                _clear_render_cache(job, final)
            _final_check(final)
            step(f"DONE -> {final}")
            return final

        # A channel can bring its own visuals engine (a DLC): `look.visuals: "vox"`
        # runs vox.py. It draws its pictures while the voice is being recorded,
        # then builds the video once the subtitles exist.
        plug = _visuals_plugin(style)
        if plug is not None:
            step(f"2/3  Voiceover + {style} visuals ({plug.__name__}.py) — in parallel")
            engine = sys.modules[__name__]
            with ThreadPoolExecutor(max_workers=2) as ex:
                fv = (ex.submit(plug.voiceover, engine, script, job, style, force) if hasattr(plug, "voiceover")
                      else ex.submit(generate_voiceover, script, job, force, avatar_min, style, voice_preset))
                fx = ex.submit(plug.prepare, engine, script, job, style, force)
                mp3, srt = fv.result()
                fx.result()
            step("3/3  Assemble video")
            final = plug.assemble(engine, job, mp3, srt, style, force, burn_subs)
            _maybe_meta(meta, title, script, srt, job, style, force)
            final = _maybe_avatar(final, job, mp3, srt, avatar_id, avatar_s, force, avatar_count)
            final = publish_named_copy(job, title)
            if _styles.uses_real_photos(style) and CLEAN_RENDERS:
                _clear_render_cache(job, final)
            if not getattr(plug, "CHECKS_BEFORE_RENDER", False):   # Mr Truth checks before drawing, never after
                _final_check(final)
            step(f"DONE -> {final}")
            return final

        # Scene-based visuals for every channel: Claude reads the script and
        # designs image prompts from what is actually being said. The branch
        # below it is the older quote-on-paper path, which only ever suited one
        # kind of channel; a style opts back into it with
        #   "look": { "visuals": "quotes" }
        if ((STYLE_INFO.get(style) or {}).get("look") or {}).get("visuals", "scenes") != "quotes":
            if _FEATURES:
                bits = [label for key, label in (("ai_images", "AI pictures"), ("youtube", "YouTube footage"),
                                                 ("stock", "stock footage")) if _FEATURES.get(key)]
                if STYLE_PHOTO_EVERY.get(style):
                    bits = ["story pictures"] + bits
                what = " + ".join(bits) or "scenes"
            else:
                what = (f"{style} pictures" if style in STYLE_NO_GRAPHICS and _MIX[1] <= 0.5
                        else f"{style} visuals (stills + AI clips) + Pexels")
            step(f"2/3  Voiceover + {what} — in parallel")
            if _MIX[1] > 0.5 and feature("stock"):   # no stock: no stock searches to write either
                generate_broll_queries(script, job, force, style)
            with ThreadPoolExecutor(max_workers=5) as ex:
                fv = ex.submit(generate_voiceover, script, job, force, avatar_min, style, voice_preset)
                fx = ex.submit(generate_astrology_visuals, script, job, force, style, minutes)
                fpx = ex.submit(fetch_footage, script, job, force, style, title)
                if _directed(style) and _FEATURES and style not in STYLE_NO_GRAPHICS:
                    if force:
                        _clear_scene_work(job)
                        (job / "director_raw.json").unlink(missing_ok=True)
                    import director
                    # the director plans from the script while the voice is still being recorded
                    ex.submit(director.draft, sys.modules[__name__], script, job, style, title)
                mp3, srt = fv.result()
                if (HERE / "cinema.py").exists():
                    import cinema
                    cinema.after_voice(sys.modules[__name__], job, mp3, srt, style)
                if (HERE / "legend.py").exists():
                    import legend
                    legend.after_voice(sys.modules[__name__], job, mp3, srt, style)
                # every word on the voice's own clock (a few seconds of whisper, cached): the director, the labels,
                # the footage and the caption highlights all read their word times from it
                _word_clock(job, srt)
                # the voice is done and the footage is not: plan the scenes in the meantime
                fplan = (ex.submit(_prewarm_scene_plans, srt, job, style)
                         if _FEATURES and (not force or _directed(style)) and style not in STYLE_NO_GRAPHICS else None)
                photos, ai_clips = fx.result()
                pexels_clips = fpx.result()
                if fplan is not None:
                    fplan.result()
            if _FEATURES and not (photos or ai_clips or pexels_clips) and style not in STYLE_NO_GRAPHICS:
                # nothing to fill the footage slots with (no footage found, AI images off):
                # draw pictures rather than leave the video black between the scenes
                log("no footage found and AI images are off — drawing pictures so no slot is empty")
                _FEATURES["_heygen_ai_disabled"] = not _FEATURES.get("ai_images", True)
                _FEATURES["ai_images"] = True
                set_mix(70, 0, _MIX[2])
                photos, ai_clips = generate_astrology_visuals(script, job, force, style, minutes)
            scene_force = force
            if _directed(style):
                scene_force = False       # the tools build from the director's plan, not their own
                if not (job / "director.json").exists():
                    try:
                        import director
                        director.plan(sys.modules[__name__], srt, job, style, title)
                    except (Exception, SystemExit) as e:          # noqa: BLE001
                        log(f"director: could not plan this time, the tools plan on their own — {str(e)[:120]}")
            graphics = use_motion and style not in STYLE_NO_GRAPHICS and _MIX[2] > 0.5
            # maps, headlines, real photos and objects, Vox scenes: their own switches in Options,
            # so unticking motion graphics does not take them away too
            scenes = bool(_FEATURES) and style not in STYLE_NO_GRAPHICS and any(
                _FEATURES.get(k) for k in ("maps", "headlines", "spotlight", "objects", "vox"))
            if _styles.is_documentary(style):
                import heygen_scenes
                scenes = scenes or heygen_scenes.enabled(sys.modules[__name__], style)
            if graphics or scenes:
                if graphics:
                    step("3/4  Graphics (Claude designs the scenes, Chromium renders them)")
                    mm_segs = generate_motion_segments(script, srt, job, _audio_dur(mp3), scene_force,
                                                       start_min=motion_start_min, style=style,
                                                       every_min=motion_every_min,
                                                       seg_dur_override=motion_seg_dur,
                                                       motion_ratio=motion_ratio)
                    mm_segs = _with_intro_caption(mm_segs, srt, job, style, scene_force)
                else:
                    step("3/4  Scenes (maps, headlines, real photos and objects)")
                    mm_segs = []
                mm_segs = _with_scene_dlcs(mm_segs, srt, job, style, scene_force)
                if graphics:
                    generate_punch_lines(srt, job, _audio_dur(mp3), force, style)
                step("4/4  Assemble the video (ffmpeg)")
                final = assemble_astrology_motion(photos, ai_clips, pexels_clips, mm_segs,
                                                   mp3, srt, job, burn_subs, force,
                                                   sub_center=(style in CENTER_SUB_STYLES),
                                                   white_fade=STYLE_WHITE_FADE.get(style, 0.0),
                                                   style=style)
            else:
                step("3/3  Assemble video (ffmpeg" + ("" if style in STYLE_NO_DUST
                                                     else " — dust + vignette + light leak") + ")")
                final = assemble_astrology(photos, ai_clips, pexels_clips, mp3, srt, job, burn_subs, force,
                                           white_fade=STYLE_WHITE_FADE.get(style, 0.0), style=style)
            _maybe_meta(meta, title, script, srt, job, style, force)
            final = _maybe_avatar(final, job, mp3, srt, avatar_id, avatar_s, force, avatar_count)
            final = publish_named_copy(job, title)
            if _styles.is_documentary(style) and CLEAN_RENDERS:
                _clear_render_cache(job, final)
            _final_check(final)
            step(f"DONE -> {final}")
            return final

        step("2/3  Voiceover + b-roll (Pexels) + AI images — all in parallel")
        # All three are network-bound and independent (images derive from the
        # script, not the SRT, so they no longer wait for the voiceover to finish).
        def _images():
            items = generate_ai_items_from_script(script, job, force)
            return generate_ai_images(items, job, force)
        with ThreadPoolExecutor(max_workers=3) as ex:
            fv = ex.submit(generate_voiceover, script, job, force, avatar_min, style, voice_preset)
            fp = ex.submit(fetch_pexels_assets, script, title, job, force)
            fi = ex.submit(_images)
            mp3, srt = fv.result()
            pexels = fp.result()
            ai_pairs = fi.result()

        if use_motion:
            step("3/4  Graphics (Claude designs the scenes, Chromium renders them)")
            mm_segs = generate_motion_segments(script, srt, job, _audio_dur(mp3), force,
                                               start_min=motion_start_min, style=style,
                                               every_min=motion_every_min,
                                               seg_dur_override=motion_seg_dur,
                                               motion_ratio=motion_ratio)
            mm_segs = _with_intro_caption(mm_segs, srt, job, style, force)
            mm_segs = _with_scene_dlcs(mm_segs, srt, job, style, force)
            generate_punch_lines(srt, job, _audio_dur(mp3), force, style)
            step("4/4  Assemble the video (ffmpeg)")
            final = assemble_video_motion(ai_pairs, pexels, mm_segs, mp3, srt, job, burn_subs, force, add_qr=add_qr)
        else:
            step("3/3  Assemble video (ffmpeg)")
            final = assemble_video(ai_pairs, pexels, mp3, srt, job, burn_subs, force, add_qr=add_qr)

        final = _maybe_avatar(final, job, mp3, srt, avatar_id, avatar_s, force, avatar_count)
        _maybe_meta(meta, title, script, srt, job, style, force)
        final = publish_named_copy(job, title)
        if _styles.is_documentary(style) and CLEAN_RENDERS:
            _clear_render_cache(job, final)
        step(f"DONE -> {final}")
        return final
    finally:
        try:
            if CLAUDE_SPEND["calls"]:
                log(f"Claude this run: {claude_spend_line()}")
                if CLAUDE_CALLS:
                    log("Claude: biggest consumers\n" + claude_calls_report())
            if GEMINI_PICKS["calls"] or GEMINI_PICKS["fallback"]:     # also on a run with no Claude call at all
                log(gemini_spend_line())
        except Exception:                                    # noqa: BLE001 - a log line only
            pass
        # a run that stopped halfway leaves the finished video in the working folder: it goes back up
        _republish_if_left(job_dir(title, style), title)
        _SINK = None


def run_step(mode: str, title: str, minutes: int = 20, script_text: str = "",
             force: bool = False, burn_subs: bool = True, sink=None, style: str = "") -> Path:
    """Run ONE part of the pipeline standalone (used by the web 'tools' modes).
    mode: 'script' | 'voiceover' | 'pexels' | 'images'. Returns the job dir."""
    global _SINK, _GRADE
    _SINK = sink
    # One tonal range per channel — see FOOTAGE_GRADE.
    _GRADE = os.environ.get("FOOTAGE_GRADE") or FOOTAGE_GRADE.get(style, "")
    try:
        job = job_dir(title, style)
        job.mkdir(parents=True, exist_ok=True)
        # standalone steps (script, voice, pictures) never touch the finished video
        (job / "title.txt").write_text(f"{title}\n{minutes} minutes\n", encoding="utf-8")
        # recorded so a later re-render knows which narrator this job was for
        (job / "style.txt").write_text(style + "\n", encoding="utf-8")

        def script_or_existing() -> str:
            s = (script_text or "").strip()
            if s:
                (job / "script.txt").write_text(s, encoding="utf-8")
                return s
            if (job / "script.txt").exists():
                return (job / "script.txt").read_text(encoding="utf-8")
            sys.exit("This step needs a script — paste one in, "
                     "or generate one for this title first.")

        if mode == "script":
            step("Script (Claude)")
            generate_script(title, minutes, job, force, style=style)
        elif mode == "voiceover":
            s = script_or_existing()
            step("Voiceover + subtitles")
            generate_voiceover(s, job, force, style=style)
        elif mode == "pexels":
            s = script_or_existing()
            step("B-roll (Pexels)")
            fetch_pexels_assets(s, title, job, force)
        elif mode == "images":
            s = script_or_existing()
            step("AI fotky (Claude + kie)")
            items = generate_ai_items_from_script(s, job, force)
            generate_ai_images(items, job, force)
        else:
            sys.exit(f"Unknown mode: {mode}")

        step("DONE")
        return job
    finally:
        _SINK = None


def assemble_from_job(job: Path, burn_subs: bool = True, sink=None, add_qr: bool = False) -> Path:
    """Build the final video from whatever assets already exist in a job dir
    (audio, subtitles, AI images, Pexels b-roll). Zero API cost — pure ffmpeg.
    Used when the steps were run separately and only the final cut is missing."""
    global _SINK, _GRADE
    _SINK = sink
    # One tonal range per channel — see FOOTAGE_GRADE.
    _sf = job / "style.txt"
    _GRADE = os.environ.get("FOOTAGE_GRADE") or FOOTAGE_GRADE.get(
        _sf.read_text(encoding="utf-8").strip() if _sf.exists() else "", "")
    try:
        mp3, srt = job / "audio.mp3", job / "subs.srt"
        if not mp3.exists():
            sys.exit("audio.mp3 is missing — make the voiceover first.")
        total = _audio_dur(mp3)

        img_dir = job / "images"
        imgs = sorted(img_dir.glob("ai_*.jpg")) if img_dir.exists() else []
        times = []
        if (job / "ai_items.json").exists():
            items = json.loads((job / "ai_items.json").read_text(encoding="utf-8"))
            times = [float(it.get("time", 0) or 0) for it in items]
        # No real timestamps (images made standalone) -> spread evenly across the runtime.
        if imgs and (len(times) != len(imgs) or all(t <= 0 for t in times)):
            n = len(imgs)
            times = [(i + 0.5) / n * total for i in range(n)]
        ai_pairs = list(zip(times, imgs)) if imgs else []

        pexels = []
        man = job / "pexels" / "manifest.json"
        if man.exists():
            for a in json.loads(man.read_text(encoding="utf-8")):
                p = Path(a["path"])
                if p.exists():
                    pexels.append({"kind": a["kind"], "path": p})

        step(f"Assembling from what is already made: {len(ai_pairs)} AI images, {len(pexels)} Pexels assets")
        return assemble_video(ai_pairs, pexels, mp3, srt, job, burn_subs, force=False, add_qr=add_qr)
    finally:
        _SINK = None


def _images_from_script(script: str, job: Path, force: bool):
    items = generate_ai_items_from_script(script, job, force)
    return generate_ai_images(items, job, force)


def run_custom(title: str, minutes: int = 20, steps=None, script_text: str = "",
               force: bool = False, burn_subs: bool = True, sink=None, style: str = "",
               avatar_min: float = 0, thumb_count: int = 1, add_qr: bool = False,
               use_motion: bool = True, mindmap_only: bool = False, byo_audio: str = "",
               motion_start_min: float = 0.0, motion_every_min: float = 0.0,
               motion_seg_dur: float = 0.0, motion_ratio: float = 0.0,
               mix: tuple = (), meta: dict = None, character: str = "",
               character_image: str = "", maps: bool = True,
                 headlines: bool = True, spotlight: bool = True, objects: bool = True,
                 depth: bool = True, features: dict = None, extra: str = "",
               avatar_id: str = "", avatar_s: float = 0, avatar_count: int = 1,
               voice_preset=None) -> Path:
    """Run a chosen SUBSET of the pipeline. `steps` is any of:
    {'script','voiceover','pexels','images','video'}.

    - 'video' = the whole finished video (it implies every step), so if it's
      selected we just run the full pipeline.
    - Otherwise the script is produced from the title automatically (or your
      pasted script is used), then the selected steps run in parallel.
    """
    steps = set(steps or [])
    _AI_IMAGES["used"] = 0
    voice_preset = validate_voice_preset(job_dir(title, style), style, voice_preset, byo_audio)
    global _SINK, _GRADE
    _SINK = sink
    set_extra(extra)
    mix, use_motion, maps, headlines, spotlight, objects, depth = _apply_features(
        style, features, mix, use_motion, maps, headlines, spotlight, objects, depth)
    set_mix(*(mix or STYLE_MIX.get(style) or MIX_DEFAULT))
    _lock_mix(style)
    set_character(character)
    set_character_image(character_image)
    set_scene_dlcs(maps, headlines, spotlight, objects, depth)
    # One tonal range per channel — see FOOTAGE_GRADE.
    _GRADE = os.environ.get("FOOTAGE_GRADE") or FOOTAGE_GRADE.get(style, "")
    try:
        job = job_dir(title, style)
        job.mkdir(parents=True, exist_ok=True)
        save_voice_choice(job, voice_preset)
        if "video" in set(steps or ()):
            _unpublish(job, title)          # a re-render: the finished video back into the working folder
        (job / "title.txt").write_text(f"{title}\n{minutes} minutes\n", encoding="utf-8")
        # recorded so a later re-render knows which narrator this job was for
        (job / "style.txt").write_text(style + "\n", encoding="utf-8")

        # A pasted script always wins — write it so every step (incl. full video) reuses it.
        if (script_text or "").strip():
            (job / "script.txt").write_text(script_text.strip(), encoding="utf-8")
            # marked, so the length check below never swaps a short pasted script
            # (a 20-second short, say) for a freshly written one
            (job / "script.pasted").write_text("1", encoding="utf-8")
        elif force:
            # "Redo everything" without a pasted script: an earlier run's pasted script is not kept
            (job / "script.pasted").unlink(missing_ok=True)

        # BRING-YOUR-OWN voiceover always routes to the full pipeline (no thumbnail).
        if byo_audio:
            return run_pipeline(title, minutes, force=force, burn_subs=burn_subs, sink=sink,
                                style=style, add_qr=add_qr, byo_audio=byo_audio,
                                mix=mix, meta=meta, character=character,
                                character_image=character_image, maps=maps,
                                headlines=headlines, spotlight=spotlight, objects=objects,
                                depth=depth, features=_FEATURES or features, extra=extra,
                                avatar_id=avatar_id, avatar_s=avatar_s,
                                avatar_count=avatar_count, voice_preset=voice_preset)

        if "video" in steps:
            # Thumbnail only needs the title, so it can run before the full pipeline.
            if "thumbnail" in steps:
                step("Thumbnail (gpt-image-2)")
                # A thumbnail is a nice-to-have; the video is the deliverable.
                # This used to abort the whole run before the script was even
                # attempted, so a thumbnail outage cost the entire video.
                try:
                    make_thumbnail(title, job, force, thumb_count, style)
                except SystemExit as e:
                    step(f"  ⚠ thumbnail failed, continuing without one: {str(e)[:120]}")
                except Exception as e:            # noqa: BLE001
                    step(f"  ⚠ thumbnail failed, continuing without one: {type(e).__name__} {str(e)[:100]}")
            return run_pipeline(title, minutes, force=force, burn_subs=burn_subs, sink=sink,
                                style=style, avatar_min=avatar_min, add_qr=add_qr,
                                use_motion=use_motion, mindmap_only=mindmap_only,
                                motion_start_min=motion_start_min,
                                motion_every_min=motion_every_min,
                                motion_seg_dur=motion_seg_dur,
                                motion_ratio=motion_ratio, mix=mix, meta=meta, character=character,
                                character_image=character_image, maps=maps,
                                headlines=headlines, spotlight=spotlight, objects=objects,
                                depth=depth, features=_FEATURES or features, extra=extra,
                                avatar_id=avatar_id, avatar_s=avatar_s,
                                avatar_count=avatar_count, voice_preset=voice_preset)

        # Script is only needed by voiceover / pexels / images (and the script step).
        needs_script = bool(steps & {"script", "voiceover", "pexels", "images"})
        script = ""
        if needs_script:
            step(f"Title: {title}  ({minutes} min)")
            step("Script (Claude)")
            script = generate_script(title, minutes, job, force, style=style)  # reuses script.txt if present

        # The selected steps run together (each only needs the script and/or title).
        runners = []
        if "voiceover" in steps:
            runners.append(("voiceover", lambda: generate_voiceover(script, job, force, avatar_min, style, voice_preset)))
        if "pexels" in steps:
            runners.append(("b-roll (Pexels)", lambda: fetch_pexels_assets(script, title, job, force)))
        if "images" in steps:
            runners.append(("AI fotky (kie)", lambda: _images_from_script(script, job, force)))
        if "thumbnail" in steps:
            runners.append(("thumbnail (gpt-image-2)", lambda: make_thumbnail(title, job, force, thumb_count, style)))

        if runners:
            step("Running: " + ", ".join(n for n, _ in runners))
            with ThreadPoolExecutor(max_workers=len(runners)) as ex:
                futs = [ex.submit(fn) for _, fn in runners]
                for f in as_completed(futs):
                    f.result()  # re-raise any failure

        step("DONE ✓")
        return job
    finally:
        _SINK = None


def main() -> None:
    ap = argparse.ArgumentParser(description="Title in -> finished video out.")
    ap.add_argument("title")
    ap.add_argument("--minutes", type=int, default=20)
    ap.add_argument("--force", action="store_true", help="Ignore cache, redo every step")
    ap.add_argument("--no-subs", action="store_true", help="Do not burn subtitles")
    args = ap.parse_args()
    final = run_pipeline(args.title, args.minutes, force=args.force, burn_subs=not args.no_subs)
    print(f"\n✅ DONE -> {final}\n")


if __name__ == "__main__":
    main()


# ── THUMBNAIL ──────────────────────────────────────────────────────────────
# One generator for every channel. The old ones each needed a hand-made base
# image to paint over, which nobody has on day one; this one generates the
# artwork from the channel's own description and sets the headline in the
# channel's own type, so a brand-new channel gets a usable thumbnail on its
# first render and can refine the look by editing its style file.

def _channel_brief(style: str) -> str:
    """One paragraph describing the channel, for any prompt that needs context."""
    st = STYLE_INFO.get(style) or {}
    bits = [st.get("label") or style, st.get("description") or ""]
    look = st.get("look") or {}
    if look.get("accent"):
        bits.append("Palette: " + ", ".join(look["accent"][:4]) + ".")
    return " ".join(b for b in bits if b).strip() or "A faceless YouTube channel."


def _fit_thumb(draw, text: str, font_file: str, max_w: int, hi: int, lo: int = 40) -> int:
    """Largest size at which `text` fits `max_w` on one line."""
    from PIL import ImageFont
    for sz in range(hi, lo - 1, -4):
        if ImageFont.truetype(font_file, sz).getlength(text) <= max_w:
            return sz
    return lo


def _thumb_variants(tb: dict, n: int) -> str:
    """Hand each variant its own draw from the channel's element pools.

    Left to itself a concept writer returns the same room with the same props
    every run — its idea of the channel, not the channel's range. A style file
    that lists pools under `thumbnail.elements` gets one random pick per pool
    per variant instead, so the look holds still while the scene moves.
    """
    pools = [(k, v) for k, v in (tb.get("elements") or {}).items()
             if isinstance(v, list) and v]
    if not pools:
        return ""
    draws = ["  CONCEPT %d is built from:\n%s" % (
        i, "\n".join(f"    {k}: {random.choice(v)}" for k, v in pools))
        for i in range(1, n + 1)]
    return ("\n\nVARIETY — NOT OPTIONAL. Each concept below is handed its own "
            "draw of elements. Build that concept from ITS OWN draw and no "
            "other, and do not fall back on the scene you would have picked "
            "anyway. If a drawn element cannot serve this title, bend it until "
            "it can — the title always wins, the draw only decides how it is "
            "staged.\n\n" + "\n\n".join(draws))


def make_thumbnail(title: str, job: Path, force: bool, n: int = 1, style: str = "") -> list:
    """Title -> N thumbnails: generated artwork with the headline set over it."""
    n = max(1, min(4, int(n)))
    existing = sorted(job.glob("thumbnail_[0-9]*.png"))
    if existing and not force:
        log(f"cached: {len(existing)} thumbnail(s)")
        return existing

    brief = _channel_brief(style)
    # A channel that showed Claude its reference thumbnails has the result
    # written into its style file. That paragraph is worth far more to the model
    # than any generic art direction, so it goes in as its own block.
    tb = ((STYLE_INFO.get(style) or {}).get("thumbnail") or {})
    log(f"Claude: {n} thumbnail concept(s)...")
    base = (prompts.THUMBNAIL_PROMPT
            .replace("[INSERT CHANNEL HERE]", brief)
            .replace("[INSERT TITLE HERE]", title)
            .replace("[INSERT THUMBNAIL STYLE HERE]",
                     (tb.get("brief") or "").strip()
                     or "No reference set was supplied — use the channel "
                        "description above and keep it simple and bold."))
    ask = base if n == 1 else base + (
        f"\n\nGive {n} DISTINCT concepts — different hooks, different artwork. "
        f"Return ONLY a JSON ARRAY of exactly {n} objects.")
    ask += _thumb_variants(tb, n) + _extra_block()
    raw = claude(ask, UTILITY_MODEL, max_tokens=400 * n + 300)
    m = re.search(r"\[.*\]" if n > 1 else r"\{.*\}", raw, re.DOTALL)
    if not m:
        sys.exit(f"Claude returned no thumbnail concept: {raw[:200]}")
    got = json.loads(m.group(0))
    concepts = (got if isinstance(got, list) else [got])[:n]
    while len(concepts) < n:
        concepts.append(dict(concepts[-1]))

    look = (STYLE_INFO.get(style) or {}).get("look") or {}
    accent = tb.get("accent") or (look.get("accent") or ["#E8A33D"])[0]
    # A channel can name its own headline face; _font_file("") would ask
    # fc-match for an empty name and get back whatever the system defaults to.
    font_file = ((_font_file(tb["font"]) if tb.get("font") else "")
                 or _font_file(THUMB_FONT) or _font_file("Inter Black"))

    out = []
    for i, c in enumerate(concepts, 1):
        art = job / f"_thumbart_{i}.png"
        dest = job / f"thumbnail_{i}.png"
        try:
            image_gen(str(c.get("prompt") or brief), art, label=f"thumbnail {i}")
            _set_thumb_headline(art, dest, str(c.get("headline") or title).upper(),
                                accent, font_file, tb)
            art.unlink(missing_ok=True)
            out.append(dest)
        except Exception as e:                                   # noqa: BLE001
            log(f"  thumbnail {i} failed: {type(e).__name__} {e}")
    if out:
        shutil.copy(out[0], job / "thumbnail.png")
    return out


def _thumb_top_bar(im, headline: str, font_file: str, tb: dict) -> None:
    """A solid band across the top with the headline set edge to edge in it.

    Measured off a reference set: the band is 16% of the frame, the caps fill
    97% of the width on ONE line, and the side margin is 20px. One line is the
    whole point — two lines at this size stop reading at phone width — so the
    type shrinks to fit rather than wrapping.
    """
    from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont
    W, H = im.size
    bar = int(H * float(tb.get("bar_pct", 0.16)))
    margin = int(tb.get("margin", 20))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, bar], fill=tb.get("bar_color") or "#000000")

    text = " ".join(headline.split())
    if tb.get("exclaim") and text[-1:] not in ("!", "?"):
        text += "!"
    # Shrink on BOTH axes: fitting the width alone lets a two-word headline
    # grow until its caps are taller than the band it sits in.
    size = _fit_thumb(d, text, font_file, W - 2 * margin, int(bar * 1.4))
    while size > 40:
        fnt = ImageFont.truetype(font_file, size)
        box = d.textbbox((0, 0), text, font=fnt)
        if box[3] - box[1] <= bar - 12 and box[2] - box[0] <= W - 2 * margin:
            break
        size -= 4
    fnt = ImageFont.truetype(font_file, size)
    # Centre the INK box, not the line box: an all-caps face still reserves
    # room for descenders, and centring on that sits the words visibly high.
    box = d.textbbox((0, 0), text, font=fnt)
    colour = tb.get("text_color") or "#E00010"
    pos = ((W - (box[2] - box[0])) / 2 - box[0], (bar - (box[3] - box[1])) / 2 - box[1])

    # Bloom under the type. Two radii, not one: the tight pass makes the letters
    # look lit from inside, the wide one throws the haze onto the black around
    # them. Drawn UNDER the crisp text so the edges stay sharp at phone size.
    glow = int(tb.get("glow", 0))
    if glow > 0:
        rgba = ImageColor.getrgb(tb.get("glow_color") or colour) + (int(tb.get("glow_alpha", 150)),)
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).text(pos, text, font=fnt, fill=rgba)
        for radius in (glow, max(2, glow // 3)):
            im.paste(Image.alpha_composite(
                im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(radius))
            ).convert("RGB"), (0, 0))

    d.text(pos, text, font=fnt, fill=colour,
           stroke_width=int(tb.get("stroke", 0)), stroke_fill="#000000")


def _set_thumb_headline(art: Path, dest: Path, headline: str,
                        accent: str, font_file: str, tb: dict = None) -> None:
    """Lay the headline over the artwork: a scrim, then the words, then a rule.

    A channel whose style file sets `thumbnail.layout = "top_bar"` gets the
    band treatment above instead. Everything it needs comes from the style
    file, so this stays one generator for every channel.
    """
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    im = Image.open(art).convert("RGB").resize((1280, 720), Image.LANCZOS)
    if (tb or {}).get("layout") == "top_bar":
        _thumb_top_bar(im, headline, font_file, tb)
        im.save(dest)
        return
    d = ImageDraw.Draw(im, "RGBA")

    words = headline.split()
    rows = [headline] if len(words) <= 2 else [
        " ".join(words[:len(words) // 2]), " ".join(words[len(words) // 2:])]
    size = min(_fit_thumb(d, r, font_file, 1120, 190) for r in rows)
    fnt = ImageFont.truetype(font_file, size)
    lh = int(size * 1.06)
    block = lh * len(rows)
    top = (720 - block) // 2

    # A dark scrim only behind the type: the artwork stays visible, the words
    # stay legible whatever the image turned out to be.
    scrim = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(scrim).rectangle([0, top - 46, 1280, top + block + 46],
                                    fill=(0, 0, 0, 150))
    im.paste(Image.alpha_composite(im.convert("RGBA"), scrim.filter(
        ImageFilter.GaussianBlur(18))).convert("RGB"), (0, 0))

    d = ImageDraw.Draw(im, "RGBA")
    for j, r in enumerate(rows):
        w = d.textlength(r, font=fnt)
        x, y = (1280 - w) / 2, top + j * lh
        for ox, oy in ((-4, 0), (4, 0), (0, -4), (0, 4), (-3, -3), (3, 3), (-3, 3), (3, -3)):
            d.text((x + ox, y + oy), r, font=fnt, fill=(0, 0, 0, 235))
        d.text((x, y), r, font=fnt, fill="white")
    d.rectangle([(1280 - 190) / 2, top + block + 20, (1280 + 190) / 2, top + block + 30],
                fill=accent)
    im.save(dest)


# ── WHICH SERVICE SPEAKS ───────────────────────────────────────────────────
# One block of text in, mp3 + srt out. WaveSpeed's own path lives in
# generate_voiceover; everything that reaches _tts_one is recorded on ai33.

def _voice_provider(style: str = "") -> str:
    """"wavespeed" or "ai33": the channel's choice, then .env — each only when its key is
    there — then the first service whose key is."""
    have = {"wavespeed": _has_key("WAVESPEED_API_KEY"), "ai33": bool(AI33_API_KEY)}
    for p in ((STYLE_VOICE_PROVIDER.get(style) or "").lower(), VOICE_PROVIDER):
        if p in have and have[p]:
            return p
    return next((p for p in ("wavespeed", "ai33") if have[p]), "ai33")


def _tts_one(text: str, mp3: Path, srt: Path, voice_id: str = "", style: str = "", voice=None) -> None:
    """One block of text -> mp3 + srt, through the channel's voice provider. When that provider cannot
    speak — no credit left, an outage — the next service that has a key finishes the recording, because
    a half-recorded narration wastes everything built on top of it."""
    if voice:
        return _ai33_tts_one(text, mp3, srt, voice["voice_id"], voice["speed"])
    first = _voice_provider(style)
    order = [first] + [p for p in ("ai33",) if p != first]
    last = None
    for p in order:
        if p == "ai33" and not AI33_API_KEY:
            continue
        try:
            _ai33_tts_one(text, mp3, srt, voice_id)
            return
        except Exception as e:                       # noqa: BLE001 - the next service may still speak
            last = e
            log(f"⚠ {p} could not record this block ({str(e)[:120]}) — trying the next voice service")
    raise last or RuntimeError("no voice service could record this block")
