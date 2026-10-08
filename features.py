"""features.py — what a video can be built from: the switches in Options, and the API each one needs.

Every switch is one entry in FEATURES. A channel's style file says which of them it offers and
which are on by default (`"features": {"offered": [...], "on": [...]}`); Options draws exactly
those, ticked, and anyone can untick what they do not want in this video.

`capabilities()` reads `.env` fresh on every call, so a key pasted while MoveFast is running shows
up on the next page refresh — and a switch whose API is missing is shown in red with the exact
key to add, instead of failing halfway through a render.
"""

import os
import shutil
from pathlib import Path

import codex_cli

HERE = Path(__file__).resolve().parent

FEATURES = [
    {"key": "youtube", "label": "YouTube footage",
     "hint": "real footage of the actual events, people and places — found on YouTube, trimmed to the shot and cropped clear of logos",
     "needs": "youtube"},
    {"key": "stock", "label": "Stock footage",
     "hint": "Pexels b-roll searched for what the narrator is saying",
     "needs": "pexels"},
    {"key": "ai_images", "label": "AI images",
     "hint": "pictures drawn for the exact words they sit on",
     "needs": "images"},
    {"key": "depth", "label": "Depth pop", "parent": "ai_images",
     "hint": "a person or a car in a picture slowly lifts off it while the background pulls back",
     "needs": "wavespeed"},
    {"key": "motion", "label": "Motion graphics",
     "hint": "animated scenes and text labels for the numbers, dates, names and turning points",
     "needs": ""},
    {"key": "vox", "label": "Vox style scenes",
     "hint": "hand-cut paper collage for the people and the key facts, animated like paper on a table",
     "needs": "vox"},
    {"key": "maps", "label": "Map animations",
     "hint": "a real map whenever the voice names a place that matters — routes, pins, regions lifting out",
     "needs": ""},
    {"key": "spotlight", "label": "Photo spotlight",
     "hint": "a real photo of who the voice names; the rest darkens as the camera pushes in",
     "needs": "wavespeed"},
    {"key": "objects", "label": "Real objects",
     "hint": "the products and things the voice names, cut out and flying in with a shadow",
     "needs": "wavespeed"},
    {"key": "headlines", "label": "Newspaper animations",
     "hint": "the real article behind a claim, on screen, the sentence highlighted — three different page moves",
     "needs": ""},
    {"key": "sound", "label": "Sound design",
     "hint": "whooshes, hits and risers under every scene change and animation, kept under the voice",
     "needs": ""},
    {"key": "avatar", "label": "AI presenter in the intro",
     "hint": "a real-looking person opens the video and speaks the first lines to camera, then it cuts to the pictures",
     "needs": "avatar"},
]
KEYS = [f["key"] for f in FEATURES]
BY_KEY = {f["key"]: f for f in FEATURES}


def _env() -> dict:
    """The keys as they are right now: the process environment, overlaid with .env read fresh."""
    env = dict(os.environ)
    f = HERE / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'")
            if v:
                env[k.strip()] = v
    return env


def _has(env: dict, *names) -> bool:
    return any((env.get(n) or "").strip() for n in names)


def _provider(env: dict, specific: str = "") -> str:
    value = (env.get(specific) or env.get("MEDIA_PROVIDER") or "").strip().lower()
    if value in ("atlas", "atlas-cloud"):
        return "atlascloud"
    return value


def _image_ready(env: dict) -> bool:
    choice = _provider(env, "IMAGE_PROVIDER")
    if choice == "atlascloud":
        return _has(env, "ATLASCLOUD_API_KEY")
    if choice == "wavespeed":
        return _has(env, "WAVESPEED_API_KEY")
    if choice == "kie":
        return _has(env, "KIE_API_KEY")
    return _has(env, "ATLASCLOUD_API_KEY", "WAVESPEED_API_KEY", "KIE_API_KEY")


def _yt_dlp(env: dict) -> bool:
    b = (env.get("YTDLP_BIN") or "").strip()
    if (b and Path(b).exists()) or shutil.which("yt-dlp"):
        return True
    try:
        import yt_dlp  # noqa: F401
        return True
    except ImportError:
        return False


def capabilities() -> dict:
    """{"base": {...}, "features": {key: {"ok": bool, "why": str}}} for the UI and the engine."""
    env = _env()
    codex_selected = any((env.get(name) or "").strip().lower() == "codex"
                         for name in ("CLAUDE_PROVIDER", "SCRIPT_PROVIDER"))
    codex_exe = codex_cli.resolve_executable(env) if codex_selected else None
    if codex_selected:
        claude = bool(codex_exe)
        claude_why = (f"Codex CLI found at {codex_exe}; ChatGPT subscription login is checked "
                      "when the first request runs."
                      if codex_exe else
                      "Codex is selected, but the local Codex CLI was not found. Set CODEX_BIN "
                      "or install the Codex app/CLI; login is not checked here.")
    else:
        # Keep the original readiness behavior for Claude Code, Anthropic and
        # kie users exactly as it was before the Codex route was added.
        claude = bool(shutil.which("claude")) or _has(env, "ANTHROPIC_API_KEY", "KIE_API_KEY")
        claude_why = "" if claude else \
            "Scripts need Claude: log in to Claude Code, or add ANTHROPIC_API_KEY (or KIE_API_KEY) to .env."
    voice = _has(env, "WAVESPEED_API_KEY", "AI33_API_KEY")
    images = _image_ready(env)
    base = {
        "claude": {"ok": claude, "why": claude_why},
        "voice": {"ok": voice, "why": "" if voice else
                  "The voiceover needs WAVESPEED_API_KEY or AI33_API_KEY in .env."},
    }
    if codex_selected:
        base["claude"].update({"provider": "codex", "executable": codex_exe or "",
                                "auth_checked": False})
    need = {
        "": (True, ""),
        "pexels": (_has(env, "PEXELS_API_KEY"), "Add PEXELS_API_KEY to .env (free at pexels.com/api)."),
        "images": (images, "Add ATLASCLOUD_API_KEY, WAVESPEED_API_KEY or KIE_API_KEY to .env."),
        # cutouts and reference pictures: WaveSpeed, or kie.ai's remover and hosting (removebg.py)
        "wavespeed": (_has(env, "WAVESPEED_API_KEY", "KIE_API_KEY"), "Add WAVESPEED_API_KEY (wavespeed.ai) or KIE_API_KEY (kie.ai) to .env."),
        # Vox can use Atlas for generation/hosting, but its green-key fallback
        # still calls removebg.py, so keep it gated by a real remover key.
        "vox": (_has(env, "WAVESPEED_API_KEY", "KIE_API_KEY"),
                "Add WAVESPEED_API_KEY or KIE_API_KEY to .env for reference cutouts."),
        # Atlas InfiniteTalk is self-hosting; the original Kling route still
        # needs both KIE (render) and WaveSpeed (hosting).
        "avatar": ((_provider(env, "AVATAR_PROVIDER") in ("atlascloud", "infinitetalk", "infinitetalk-480") and
                    _has(env, "ATLASCLOUD_API_KEY")) or
                   (_provider(env, "AVATAR_PROVIDER") == "wavespeed" and _has(env, "WAVESPEED_API_KEY")) or
                   (_provider(env, "AVATAR_PROVIDER") in ("kling-standard", "kling-pro") and
                    _has(env, "KIE_API_KEY") and _has(env, "WAVESPEED_API_KEY")) or
                   (not _provider(env, "AVATAR_PROVIDER") and
                    (_has(env, "ATLASCLOUD_API_KEY") or
                     (_has(env, "KIE_API_KEY") and _has(env, "WAVESPEED_API_KEY")))),
                   "Add ATLASCLOUD_API_KEY, or add KIE_API_KEY plus WAVESPEED_API_KEY to .env."),
    }
    # the watchers youtube.py can ask; the free Gemini tier is the one to recommend first
    yt_key = _has(env, "GEMINI_API_KEY", "OPENLUX_API_KEY", "WAVESPEED_API_KEY", "KIE_API_KEY")
    if not _yt_dlp(env):
        need["youtube"] = (False, "Install yt-dlp (see README → YouTube footage).")
    else:
        need["youtube"] = (yt_key, "Add GEMINI_API_KEY — free at aistudio.google.com/apikey. "
                                   "OPENLUX_API_KEY, WAVESPEED_API_KEY or KIE_API_KEY work too.")
    feats = {}
    for f in FEATURES:
        ok, why = need.get(f["needs"], (True, ""))
        feats[f["key"]] = {"ok": bool(ok), "why": "" if ok else f"API missing — {why}"}
    return {"base": base, "features": feats}


def prices() -> dict:
    """What each switch roughly costs per minute of finished video with the services in .env right now —
    {"voice": {...}, "features": {key: {"per_min": usd, "note": str}}, "picture": usd per AI picture}.
    Estimates for the Options panel, not a bill: the services' own dashboards have the real numbers."""
    env = _env()
    has = lambda *names: _has(env, *names)
    requested_voice = (env.get("VOICE_PROVIDER") or "").strip().lower()
    voice_keys = {"wavespeed": "WAVESPEED_API_KEY", "ai33": "AI33_API_KEY"}
    voice = (requested_voice if requested_voice in voice_keys and has(voice_keys[requested_voice]) else
             "wavespeed" if has("WAVESPEED_API_KEY") else "ai33" if has("AI33_API_KEY") else "")
    requested_image = _provider(env, "IMAGE_PROVIDER")
    images = (requested_image if requested_image in ("atlascloud", "wavespeed", "kie")
              else "atlascloud" if has("ATLASCLOUD_API_KEY")
              else "wavespeed" if has("WAVESPEED_API_KEY") else "kie" if has("KIE_API_KEY") else "")
    # Ask the engine which watcher it will actually use rather than guessing a second
    # order here, so the estimate always quotes the watcher the engine really asks.
    try:
        import youtube
        watcher = youtube.analyst()
    except Exception:
        watcher = ("gemini" if has("GEMINI_API_KEY") else "openlux" if has("OPENLUX_API_KEY") else
                   "wavespeed" if has("WAVESPEED_API_KEY") else
                   "kie" if has("KIE_API_KEY") else "")
    picture = {"atlascloud": 0.027, "wavespeed": 0.027, "kie": 0.02}.get(images, 0.02)
    collage_provider = _provider(env, "VOX_IMAGES")
    collage = ({"atlascloud": 0.027, "wavespeed": 0.027, "kie": 0.02}.get(collage_provider)
               if collage_provider in ("atlascloud", "wavespeed", "kie") else picture)
    v = {"wavespeed": (0.18, "ElevenLabs v3 on WaveSpeed — about $0.18 a minute"),
         # measured: about 1,200 credits a minute of narration, and ai33 sells a million credits for $5
         "ai33": (0.006, "ai33 — about $0.006 a minute (1,200 credits, $5 per million)"), "": (0.0, "no voice service yet")}[voice]
    # What watching really costs, measured on finished films rather than guessed: a full-length documentary has
    # 11-13 minutes of candidate video watched for every minute that ends up on screen (a footage-heavy one, 40).
    # The work is free on Gemini's daily allowance and pennies on OpenLux. A SHORT test render pays a fixed
    # overhead — it still scans a shelf of candidates — so its real cost per minute is higher than this line.
    yt = {"gemini": (0.01, "Gemini API watches the candidate videos — free up to 8 hours a day, then cents"),
          "openlux": (0.004, "Gemini through OpenLux watches the candidate videos — a fraction of Google's price"),
          "wavespeed": (0.03, "Gemini on WaveSpeed watches the candidate videos"),
          "kie": (0.03, "Gemini on kie.ai watches the candidate videos"),
          "": (0.0, "")}.get(watcher, (0.03, f"{watcher} watches the candidate videos"))
    feats = {
        "youtube": yt,
        "stock": (0.0, "Pexels — free"),
        "ai_images": (2.5 * picture, f"about ${picture:.3f} a picture on {images or 'your image service'}"),
        "depth": (0.004, "WaveSpeed background remover — $0.004 a picture"),
        "motion": (0.0, "drawn on your computer — free"),
        # vox draws one collage moment per 150 s and never more than six in a film, so a minute of video carries
        # about 1.6 pictures of it — not four (vox.SCENE_EVERY_S)
        "vox": (1.6 * collage, f"about 4 pictures a scene at ${collage:.3f}, one collage every 2.5 minutes, six at most"),
        "maps": (0.0, "drawn on your computer — free"),
        # a photo scene lands at most every 45 s (photofx.EVERY_S), so both of these are well under one a minute
        "spotlight": (0.005, "$0.004 a photo for the cutout, at most one photo scene every 45 seconds"),
        "objects": (0.008, "$0.004 a cutout; a drawn studio photo when no real photo cuts out"),
        "headlines": (0.0, "real pages, captured on your computer — free"),
        "sound": (0.0, "synthesised on your computer — free; the music is yours"),
        # The presenter is billed by the SECOND of intro, not by the length of the
        # film, so a per-minute figure would be nonsense: the same clip costs the
        # same in a 3-minute video and a 30-minute one. `flat` carries it instead.
        "avatar": (0.0, "billed by the length of the intro, not the video"),
    }
    try:
        import avatar as _avatar
        av_s = _avatar.PROVIDERS[_avatar.DEFAULT_PROVIDER]["usd_s"]
    except Exception:
        av_s = 0.0375
    # kie does not publish a price for the Kling avatar models: this is what a run has cost in practice, and
    # every render logs the credits it really took (a kie credit is $0.005). WaveSpeed's InfiniteTalk, which
    # takes over when kie has no credit left, publishes $0.06 a second at 720p.
    flat = {"avatar": {"per_second": round(av_s, 4),
                       "note": f"about ${av_s:.3f} a second of presenter — a 10-second intro is about "
                               f"${av_s * 10:.2f}; the render log shows what it really cost"}}
    return {"voice": {"per_min": v[0], "note": v[1]}, "picture": picture, "flat": flat,
            "features": {k: {"per_min": round(c, 4), "note": n} for k, (c, n) in feats.items()}}


def resolve(style_info: dict, asked: dict = None) -> dict:
    """The switches for one job: the channel's defaults, overridden by what Options sent, with
    anything the channel does not offer — or whose API is missing — turned off."""
    fcfg = (style_info or {}).get("features") or {}
    offered = [k for k in (fcfg.get("offered") or KEYS) if k in BY_KEY]
    on = set(fcfg.get("on") or offered)
    caps = capabilities()["features"]
    out = {}
    for k in KEYS:
        want = bool(asked[k]) if isinstance(asked, dict) and k in asked else (k in on)
        out[k] = bool(want and k in offered and caps.get(k, {}).get("ok", True))
    if not out.get("ai_images") and "ai_images" in offered:
        out["depth"] = False            # depth pop lives on AI pictures
    return out
