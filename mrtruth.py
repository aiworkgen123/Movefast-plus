"""MR TRUTH — a channel built from OmharRegidor's video-generator (github aiworkgen123/video-generator, read-only).

A photos-only documentary: archive photographs (and an AI stand-in where none fits) with a slow move on every
still, a dark graded look with gold type, film burns, dust, and the repo's own templates (P03, P12, P14, P02 …).
Every frame is drawn by the repo's own Remotion code (mrtruth_renderer/, synced by update_mrtruth.sh), and the
plan is written with the repo's own prompts (mrtruth_renderer/prompts.json), so the channel looks and edits like
the repo. The template guide the owner can edit is styles/mr_truth.templates.md.

A visuals plugin (`look.visuals: "mrtruth"`): make_video hands it the script, the voice and the job folder.
  prepare    — the research dossier (topic, period, the names an archive files things under, the chapters)
  voiceover  — the owner's own recording when one was given (already aligned), else the channel's narrator
  assemble   — beats → templates and their words → pictures → render → sound → the finished video

Owner rules (2026-10-06): photos only; only Mr Truth's own templates; the switched-off templates (P13, P16,
pointer-label, name-card, name-plate) exist but are never placed; checks stay loose — a template that does not
fit falls back or the shot stays a plain photograph, and nothing stops the run.

    python mrtruth.py preview all            # every template, labelled, into preview/mrtruth/
    python mrtruth.py preview P03,P14        # just these
    python mrtruth.py check "<job folder>"   # the rules, read back off a finished video's plan
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
RENDERER = HERE / "mrtruth_renderer"
FPS = 30
TARGET_SCENE_S = 4.0                 # the repo's DEFAULT_TARGET_SCENE_MS
BATCH_S = 240.0                      # segmentation focus range per call
GRADE = {"lut": "documentary-neutral", "vignette": 0.18, "grain": 0.06}   # the repo's DEFAULT_GRADE
# the shadow look (renderer Grade.tsx): tight dark vignette, a dimmer, muted, harder picture. 0 = off, 1 = full.
TYPED_CAPTION_START_F = 8                       # the reference starts typing ~0.27 s into its shot
SHADOW_LOOK = float(os.environ.get("MRTRUTH_SHADOW", "1"))
if SHADOW_LOOK > 0:
    GRADE["shadow"] = min(1.0, SHADOW_LOOK)

# ── the template library: the repo's registry (packages/core/src/devices.ts) and the planner's own limits ──────
# id: (on, pictures, min s, max s, per-film cap, position, fallbacks, copy limits)
#   position: "any" | "opening" (only the first shot or the hook) | "not-opening"
#   copy limits: the planner's character limits from the repo's library lines (VISUAL_PLAN_SYSTEM_PROMPT)
LIBRARY = {
    "P03":            (True, 1, 1.8, 8.0, None, "any", ["photo-pop", "framed-card"], {"kicker": 24, "headline": 26}),
    "P12":            (True, 1, 1.2, 8.0, None, "any", [], {}),
    "P14":            (True, 1, 2.4, 8.0, None, "not-opening", ["P12"], {}),
    "P17":            (True, 1, 1.4, 8.0, 3, "any", ["framed-card"], {"headline": 10}),
    "P22":            (True, 4, 4.1, 10.0, 2, "any", ["photo-pop"], {}),
    "P19":            (True, 4, 2.5, 10.0, 2, "any", ["P22", "photo-pop"], {}),
    "gallery-strip":  (True, 4, 4.4, 5.0, 1, "opening", ["P22", "photo-pop"], {}),
    "framed-card":    (True, 1, 0.8, 4.0, None, "any", ["photo-pop"], {"headline": 32}),
    "photo-pop":      (True, 1, 2.0, 9.0, 3, "not-opening", ["framed-card"], {}),
    "shadow-up":      (True, 1, 2.0, 5.0, None, "not-opening", [], {"headline": 32}),
    "P08":            (True, 1, 2.0, 8.0, None, "not-opening", [], {}),
    "P04":            (True, 1, 2.0, 8.0, None, "not-opening", [], {"headline": 19, "kicker": 35}),
    "P02":            (True, 1, 3.0, 8.0, 2, "not-opening", [], {"headline": 46, "kicker": 30}),
    "P09":            (True, 1, 3.0, 8.0, None, "not-opening", [], {"headline": 51, "kicker": 48}),
    "P05":            (True, 1, 4.0, 8.0, None, "not-opening", [], {"headline": 25, "kicker": 38, "lines": 48}),
    "chapter-title":  (False, 0, 4.0, 8.0, 1, "any", ["chapter-plate"], {}),    # off: owner 2026-10-08
    "chapter-plate":  (True, 1, 2.5, 8.0, 3, "any", [], {}),                    # 2-3 a film, mandatory
    "top-title":      (True, 1, 3.1, 8.0, 6, "any", ["shadow-up", "framed-card"], {"headline": 21, "lines": 21}),
    "corner-label":   (True, 1, 3.4, 8.0, 6, "any", ["framed-card"], {"headline": 18, "kicker": 14}),
    "two-photo-zoom": (True, 2, 2.7, 5.0, None, "any", ["P22", "P03"], {"headline": 24, "lines": 24}),
    "highlight-page": (True, 0, 5.0, 8.0, 6, "any", ["P03", "framed-card"], {}),
    "bullet-checklist": (True, 1, 4.0, 5.0, 2, "any", ["P03"], {"headline": 19, "lines": 21}),
    # switched off in the repo, and off here (owner 2026-10-06): never placed, previews only
    "P13":            (False, 1, 5.0, 8.0, 2, "any", [], {}),
    "P16":            (False, 1, 5.0, 8.0, 2, "any", [], {}),
    "pointer-label":  (False, 1, 3.0, 5.0, None, "any", [], {}),
    "name-card":      (False, 2, 3.0, 5.0, 3, "any", [], {}),
    "name-plate":     (False, 1, 3.0, 5.0, 3, "any", [], {}),
}
# frames each template needs to finish building (the repo's DEVICE_REGISTRY buildEndFrames) — never seated on a shorter shot
BUILD_FRAMES = {"P12": 36, "P17": 42, "P03": 55, "P22": 123, "P19": 76, "gallery-strip": 131, "framed-card": 25,
                "photo-pop": 61, "shadow-up": 60, "P08": 60, "P04": 60, "P02": 90, "P09": 90, "P05": 120, "P14": 71,
                "chapter-title": 120, "two-photo-zoom": 80, "highlight-page": 87, "bullet-checklist": 119,
                "chapter-plate": 75, "top-title": 94, "corner-label": 101}
# where each template writes over the photograph (x0, y0, x1, y1 as fractions) and how bright that strip may be;
# the repo reads the ground under the letters (T-26), not the whole picture's average
TYPE_BAND = {"shadow-up": ((0.12, 0.80, 0.88, 0.97), 0.50), "top-title": ((0.02, 0.04, 0.62, 0.32), 0.55),
             "corner-label": ((0.55, 0.03, 0.98, 0.24), 0.55), "P12": ((0.58, 0.03, 0.98, 0.32), 0.70),
             "P14": ((0.58, 0.03, 0.98, 0.30), 0.70), "P03": ((0.02, 0.52, 0.66, 0.92), 0.70)}
NAMES_PICTURE = {"P04", "P05", "P17", "framed-card", "corner-label"}     # words that say what the photo IS (T-8/T-10)
MIN_WIDTH = 800                 # a web photo must be this wide to fill a 1080p frame through the grade and slow move
MIN_SCORE = 5.0                 # the judge's 3-5 is "generic, says nothing"; 0-2 wrong era, modern stock, burned-in text
# cache versions: a change to what a step is told must redo that step on an existing job, not reuse its old answer
BRIEF_V, BEATS_V, NAMES_V, ANCHORS_V, PICK_V = 3, 3, 2, 3, 8
# the picture judge: Flash-Lite at minimal thinking scored a COVID-masked researcher 9 for the 1980s and one image 1 and
# then 8 (audit 2026-10-08); Mr Truth's judge is a stronger Gemini that thinks a little. Env overrides.
JUDGE_MODEL = os.environ.get("MRTRUTH_JUDGE_MODEL", "gemini-3.8-flash")
JUDGE_THINKING = os.environ.get("MRTRUTH_JUDGE_THINKING", "low")
SUBJECT_MAX, SUBJECT_GAP = 2, 6      # one view of one subject: at most twice a film, never within 6 shots
CHAPTER_FIRST_S, CHAPTER_GAP_S = 25.0, 90.0    # the dossier's sections are movements; only some are chapters
TITLE_CEILING = {"P03": 0.72, "P12": 0.75, "P14": 0.75, "shadow-up": 0.55, "top-title": 0.62, "corner-label": 0.62}
JOINING = {"the", "a", "an", "of", "and", "in", "at", "on", "for", "to", "from", "by", "with"}

# transitions and atmosphere, the repo's own numbers (apps/worker/src/stages/plan.ts, packages/core/src/effectDensity.ts)
FLASH_SHARE, PUSH_SHARE, SLIDE_SHARE = 0.05, 0.08, 0.03
BURN_SHARE, BURN_PER_MIN, BURN_GAP_S, BURN_MAX_RUN = 0.2, 4.0, 6.0, 2
DIP_FRAMES, FLASH_FRAMES, PUSH_FRAMES, SLIDE_FRAMES, BURN_IN, BURN_OUT = 18, 8, 11, 18, 14, 12
LEAK_SHARE, LEAK_MIN_S, LEAK_PREFER_S = 0.07, 2.0, 3.0
TURN_SHARE, TURN_MIN_S, TURN_PREFER_S = 0.06, 2.5, 3.5    # the cinematic turn (renderer CinemaTurn.tsx)     # the light leak plate (renderer fx/leak)
DUST_SHARE, DUST_MIN_S, DUST_PREFER_S, DUST_SHADOW, DUST_SHADOW_MIN_LUMA = 0.12, 2.0, 3.0, 0.25, 0.45
SFX = {"flash": ("shutter.wav", -12.0, 0.001), "dipToBlack": ("impact.wav", -6.0, 0.0)}   # deliver.ts SFX_BY_TRANSITION
SFX_MIN_GAP_S = 12.0

# P03's headline is set at 92px in a 1120px column, two lines at most (devices.ts p03HeadlineFits)
_P03_EM = dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.,:;!?&/()'\"",
                   [0.756, 0.715, 0.719, 0.741, 0.645, 0.621, 0.747, 0.746, 0.306, 0.437, 0.729, 0.619, 0.934, 0.758,
                    0.77, 0.706, 0.772, 0.713, 0.665, 0.669, 0.717, 0.724, 1.071, 0.715, 0.715, 0.664, 0.701, 0.494,
                    0.628, 0.658, 0.675, 0.669, 0.677, 0.612, 0.678, 0.675, 0.209, 0.38, 0.237, 0.239, 0.237, 0.249,
                    0.257, 0.532, 0.818, 0.357, 0.304, 0.304, 0.245, 0.449]))


def p03_fits(headline: str) -> bool:
    lines, used = 1, 0.0
    for word in headline.split():
        w = sum(_P03_EM.get(c, 1.127) * 92 + 0.4 for c in word.upper())
        if w > 1120:
            return False
        if used and used + 22 + w > 1120:
            lines, used = lines + 1, w
        else:
            used = w if not used else used + 22 + w
    return lines <= 2


def _hash(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def _load(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _dump(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=1, ensure_ascii=False, default=str), encoding="utf-8")


def _prompts() -> dict:
    got = _load(RENDERER / "prompts.json")
    if not got:
        sys.exit("Mr Truth: mrtruth_renderer/prompts.json is missing — run ./update_mrtruth.sh")
    return got


def _guide() -> str:
    """The owner's template guide (styles/mr_truth.templates.md), read into the planner's brief every video."""
    try:
        return (HERE / "styles" / "mr_truth.templates.md").read_text(encoding="utf-8")
    except OSError:
        return ""


def _ask(engine, prompt: str, max_tokens: int, model: str = "") -> dict:
    """One JSON object from Claude (the repo used forced tool calls; here the object is asked for in words)."""
    strict = prompt + ("\n\nRETURN FORMAT FOR THIS RUN: there is no tool to call. Reply with ONLY the JSON object the "
                       "tool would have received — begin with '{' and end with '}'. No prose, no markdown fences.")
    last = ""
    for _ in range(3):
        try:
            raw = engine.claude(strict, model or engine.UTILITY_MODEL, max_tokens=max_tokens)
        except Exception as e:                                       # noqa: BLE001 - asked again
            last = str(e)[:160]
            continue
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except ValueError as e:
                last = str(e)[:160]
    raise RuntimeError(f"Mr Truth: no JSON from Claude — {last}")


def _cfg(engine, style: str) -> dict:
    return (((engine.STYLE_INFO.get(style) or {}).get("look") or {}).get("mr_truth") or {})


# ── 1. research dossier ───────────────────────────────────────────────────────────────────────────────────────
def prepare(engine, script: str, job: Path, style: str, force: bool) -> None:
    research(engine, script, job, force)


def research(engine, script: str, job: Path, force: bool = False) -> dict:
    out = job / "mrtruth" / "research.json"
    got = None if force else _load(out)
    if got:
        return got
    engine.log("Mr Truth: research dossier (Claude)...")
    title = (job / "title.txt").read_text(encoding="utf-8").splitlines()[0] if (job / "title.txt").exists() else ""
    prompt = (_prompts()["research"] + f"\n\nTITLE: {title}\n\n<script>\n{script}\n</script>")
    try:
        got = _ask(engine, prompt, 12000)
    except RuntimeError as e:
        engine.log(f"  {e} — planning without a dossier")
        got = {}
    _dump(out, got)
    return got


def _film_block(d: dict) -> str:
    if not d:
        return ""
    avoid = d.get("avoidVisualCategories") or []
    lines = ["", "<film>", f"topic: {d.get('topic', '')}", f"category: {d.get('category', '')}",
             f"narrative style: {d.get('narrativeStyle', '')}", f"logline: {d.get('logline', '')}",
             f"period: {d.get('period', '')}", f"setting: {d.get('setting', '')}",
             f"look: {'; '.join(d.get('visualStyle') or []) or 'not stated'}",
             "kinds of picture this film PREFERS (a genus, never a brief): "
             + ("; ".join(d.get("preferredVisualCategories") or []) or "not stated"),
             "kinds of picture this film MAY NOT ASK FOR:"] + ([f"  - {x}" for x in avoid] or ["  none stated"])
    b = d.get("visualBrief") or {}
    if b:
        lines += [f"tone of every picture: {b.get('tone', '')}",
                  f"every picture should look like: {b.get('look', '')}",
                  "pictures this film may NOT SHOW (a candidate of one of these kinds is wrong for this film, however "
                  "well it matches the words):"] + [f"  - {x}" for x in b.get("forbidden") or []]
        nophoto = [p for p in b.get("people") or [] if not p.get("likenessKnown")]
        if nophoto:
            lines += ["people of whom NO likeness exists — show an anonymous figure of their ROLE, in the film's setting "
                      "and era, never presented as them; never a different identifiable person, never someone visibly "
                      "not of that role:"] + [f"  - {p.get('name', '')}: {p.get('role', '')} ({p.get('appearance', '')})" for p in nophoto]
        motifs = b.get("motifs") or []
        if motifs:
            lines += ["concrete subjects of THIS film's world for abstract lines (time, secrecy, permission, memory, "
                      "fear...) — use these, never a literal modern match of the word:"] + \
                     [f"  - {m.get('idea', '')} → {m.get('web', '')}" for m in motifs]
    return "\n".join(lines + ["</film>"])


BRIEF_PROMPT = """You are the picture editor of a photos-only history documentary channel (archive photographs, gold
type, the quiet authority of a museum). Before any picture is searched, write the film's VISUAL BRIEF: the rules every
picture of THIS film must keep, so that no shot looks like modern stock, a shop listing or the wrong place and time.

[INSERT FILM HERE]

<script>
[INSERT SCRIPT HERE]
</script>

Return ONLY a JSON object:
{"tone": "4-8 words: the mood every picture shares, taken from THIS script (a dark mystery, a sunlit triumph, a cold
          industrial story...)",
 "look": "one sentence: what the pictures look like — their age, medium, light and colour — for THIS film's period",
 "forbidden": ["6-10 kinds of picture this film may never show. For a film set in the past always include modern
               stock and lifestyle photos, shop and product listings, decor and gifts, screenshots and modern
               infographics, clip-art and AI-looking renders, glossy tourist or brochure shots, modern people in modern
               clothes. Then the film's own traps (e.g. another country's or another tradition's version of its
               subject). For a film about the present day, leave out what the narration itself shows."],
 "people": [{"name": "every person the script names, as the script names them",
             "surname": "ONE word the narration uses for them (a family name, or the single name for a saint, king
                         or pope); no titles, no initials, no postnominals",
             "likenessKnown": true|false,
             "role": "who they are as a TYPE in the film's setting and era",
             "appearance": "one line fixing how a stand-in for them looks every time: age, build, face, hair,
                            glasses, dress of that role and era",
             "commons": "at most 3 words, how Wikimedia Commons files pictures of that TYPE",
             "web": "at most 7 words, an image search for that TYPE at work in the setting and era",
             "portrait": "at most 7 words, an image search for a real PHOTOGRAPH of that type of person — a portrait
                          or interview shot (e.g. 'elderly Catholic priest portrait cassock')"}],
 "motifs": [{"idea": "an abstract idea the script returns to (time, secrecy, a ban, memory, power, loss...)",
             "commons": "at most 3 words", "web": "at most 7 words: a CONCRETE thing of this film's world, era and
             tone that shows the idea"}],
 "aiLook": "one sentence for a generated stand-in picture: medium, age, light, palette, in this film's look"}
Rules: likenessKnown is true when ANY authentic likeness of the person is well known — a photograph, a portrait
painting, an engraving, a coin, a statue. It is false only for a private, obscure or unverifiable person of whom no
likeness exists. 6-12 motifs. Every motif and stand-in must fit the film's era, setting and tone — real and specific;
never a modern consumer object or a stock concept photo unless the film is about the present day."""

_SUFFIX = re.compile(r"^(jr|sr|ii|iii|iv|v|o\.?p|s\.?j|o\.?s\.?b|o\.?f\.?m|phd|md|esq)\.?$", re.I)


def _surname(p: dict) -> str:
    """The one word the narration calls a person by: the brief's surname, else the last real word of the name
    (before a comma or bracket, without Jr., O.P., S.J. and the like)."""
    s = re.sub(r"[^\w'-]", "", str(p.get("surname") or "")).strip("'-")
    if s:
        return s.lower()
    name = re.split(r"[,(]", str(p.get("name") or ""))[0]
    words = [w.strip(".'-") for w in name.split() if w.strip(".'-") and not _SUFFIX.match(w)]
    return words[-1].lower() if words else ""


def visual_brief(engine, job: Path, script: str, dossier: dict, force: bool = False) -> dict:
    """The film's picture rules (tone, look, forbidden kinds, stand-ins for people of whom no likeness exists, concrete
    motifs for abstract lines), read by every search and judge call through _film_block. Cached per script + dossier;
    a failed call is never cached, so the next run asks again."""
    out = job / "mrtruth" / "visual_brief.json"
    key = _hash([BRIEF_V, script, dossier])
    got = None if force else _load(out)
    if got and got.get("key") == key and got.get("brief"):
        return got["brief"]
    engine.log("Mr Truth: the film's visual brief (Claude)...")
    prompt = BRIEF_PROMPT.replace("[INSERT FILM HERE]", _film_block(dossier)).replace("[INSERT SCRIPT HERE]", script)
    brief = {}
    for _ in range(2):
        try:
            brief = _ask(engine, prompt, 8000)
        except RuntimeError as e:
            engine.log(f"  {e}")
        if brief.get("tone") and isinstance(brief.get("people"), list):
            break
    if not brief.get("tone"):
        engine.log("  no visual brief this run — pictures are chosen without one (it is asked again next run)")
        return {}
    clip = lambda s, n: " ".join(str(s or "").split()[:n])
    for p in brief.get("people") or []:
        p["commons"], p["web"], p["portrait"] = clip(p.get("commons"), 3), clip(p.get("web"), 7), clip(p.get("portrait"), 7)
        p["likenessKnown"] = p.get("likenessKnown") is not False and str(p.get("likenessKnown")).lower() != "false"
    for m in brief.get("motifs") or []:
        m["commons"], m["web"] = clip(m.get("commons"), 3), clip(m.get("web"), 7)
    _dump(out, {"key": key, "brief": brief})
    return brief


def _stand_in(r: dict, dossier: dict):
    """The brief's stand-in when this shot is about a person of whom no likeness exists. Matched on the person's full
    name, or on their surname as a word in the shot's entities or text — but never when a person WITH a likeness
    shares that surname (a famous man's unphotographed relative must not take over his shots)."""
    people = [p for p in (dossier.get("visualBrief") or {}).get("people") or [] if str(p.get("name") or "").strip()]
    known = {_surname(p) for p in people if p.get("likenessKnown")}
    text = str(r.get("text") or "").lower()
    ents = " | ".join([str(e) for e in r.get("entities") or []] + [str(r.get("about") or "")]).lower()
    for p in people:
        if p.get("likenessKnown") or not (p.get("commons") or p.get("web")):
            continue
        full = str(p.get("name") or "").lower().strip()
        sur = _surname(p)
        if full and (full in text or full in ents):
            return p
        if len(sur) < 3 or sur in known:
            continue
        in_ents = re.search(rf"(?<![\w-]){re.escape(sur)}(?![\w-])", ents)
        # in the narration only as a capitalised name ("Restivo"), so "white", "may", "great" never match
        in_text = re.search(rf"(?<![\w-]){re.escape(sur.capitalize())}(?![\w-])", str(r.get("text") or ""))
        if in_ents or in_text:
            return p
    return None


# ── 2. the narrator ───────────────────────────────────────────────────────────────────────────────────────────
def voiceover(engine, script: str, job: Path, style: str, force: bool) -> tuple:
    mp3, srt = job / "audio.mp3", job / "subs.srt"
    if mp3.exists() and srt.exists() and (job / "script.pasted").exists():
        engine.log("Mr Truth: your own recording (aligned to the script)")
        return mp3, srt
    return engine.generate_voiceover(script, job, force, 0, style, None)


# ── 3. beats ──────────────────────────────────────────────────────────────────────────────────────────────────
QUERY_RULES = """
THIS CHANNEL'S SEARCH RULES (they win over the brief above where they differ):
- Every picture must fit the <film> block's period, setting and tone. Put the film's own setting or era words into a
  query whenever the thing is generic ("Vatican Library reading room", not "reading room"; "1930s Soviet factory floor",
  not "factory"). A word like folio, catalogue, catechism, archive or uniform means THIS film's kind of it, never
  another country's, tradition's or century's (no English printed book for a Latin codex, no American card catalogue
  for a European archive, no modern army for an ancient one).
- A named person with NO known photograph (see the <film> block's people list): the visualIntent and the queries show
  an anonymous figure of their ROLE in the film's setting and era (e.g. "priest reading manuscript in old library",
  "1920s dockworker on a pier"); never the name alone, never their home town or nationality as a place.
- An abstract line (time, a limit, secrecy, permission, memory, fear, death): show a CONCRETE thing of the film's world
  in its tone — one of the <film> block's motifs or one like them — never a literal modern match of the word (no modern
  wall clock for "time-limited", no office folders for "records", no stock concept photo).
- Never a modern consumer product, decor, gift, office, screenshot, diagram, or modern people in modern clothes,
  unless the narration is plainly about the present day.
- WHO A LINE IS ABOUT. Give every scene an extra field "about": the name of the person the line is about — named, or
  only as he / she / the man / the translator / the priest / the king — or "" when the line is about a thing, a
  place or an idea. When the line is about a person of whom no likeness exists, the visualIntent and the first query
  show a REAL PERSON OF THEIR ROLE: e.g. an older Catholic priest in a cassock at a desk, in a library, giving an
  interview, at work in the Vatican — a person the viewer can picture him by. In a run of lines about that person,
  show the person on at least every second shot; the shots between show what he reads, holds or where he is."""
def _cues(engine, srt: Path) -> list:
    return [(int(round(a * 1000)), int(round(b * 1000)), t) for a, b, t in
            engine._parse_srt_full(srt.read_text(encoding="utf-8")) if b > a]


def beats(engine, job: Path, srt: Path, script: str, dossier: dict, force: bool = False) -> list:
    """[{startMs, endMs, text, visualIntent, queries, entities, mood, sceneType, overlay?}] covering the voice."""
    out = job / "mrtruth" / "beats.json"
    key = _hash([BEATS_V, script, dossier])
    got = None if force else _load(out)
    if isinstance(got, dict) and got.get("key") == key and got.get("rows"):
        return got["rows"]
    cues = _cues(engine, srt)
    if not cues:
        sys.exit("Mr Truth: the subtitles are empty — nothing to cut to")
    end_ms = cues[-1][1]
    system = _prompts()["segmentation"].replace("{TARGET_SECONDS}", f"{TARGET_SCENE_S:.1f}")
    batches, t = [], 0
    while t < end_ms:
        batches.append((t, min(end_ms, t + int(BATCH_S * 1000))))
        t += int(BATCH_S * 1000)

    def one(rng):
        f0, f1 = rng
        lines = [f"{'>' if f0 <= a < f1 else ' '} [{a}-{b}] {txt}" for a, b, txt in cues
                 if f0 - 30000 <= a < f1 + 15000]
        user = "\n".join(["TRANSCRIPT (authoritative; lines marked \">\" are the focus range, unmarked lines are context only):",
                          *lines, _film_block(dossier), QUERY_RULES, "", f"FOCUS RANGE: {f0}ms to {f1}ms.",
                          "Return scenes whose startMs falls inside the focus range, covering it completely and contiguously."])
        prompt = f"{system}\n\n<script>\n{script}\n</script>\n\n{user}\n\nReturn {{\"scenes\": [...]}}."
        try:
            return (_ask(engine, prompt, 24000).get("scenes") or [])
        except RuntimeError as e:
            engine.log(f"  beats {f0 // 1000}s-{f1 // 1000}s: {e} — cut on the sentences instead")
            return []

    engine.log(f"Mr Truth: cutting the narration into shots ({len(batches)} part(s), the repo's segmentation brief)...")
    with ThreadPoolExecutor(max_workers=3) as ex:
        parts = list(ex.map(one, batches))
    starts = sorted({a for a, _, _ in cues} | {cues[-1][1]})
    snap = lambda ms: min(starts, key=lambda s: abs(s - int(ms)))
    rows = []
    for (f0, f1), scenes in zip(batches, parts):
        kept = []
        for s in scenes or []:
            try:
                a = snap(s.get("startMs"))
            except (TypeError, ValueError):
                continue
            if f0 <= a < f1 and (not kept or a > kept[-1]["startMs"]):
                kept.append(dict(s, startMs=a))
        if not kept or kept[0]["startMs"] > f0 + 1500:
            # a part Claude could not cut: one shot per subtitle line (the repo's deterministic split)
            kept = [{"startMs": a, "text": txt, "visualIntent": txt, "queries": [txt, txt, ""], "entities": [],
                     "mood": "", "sceneType": "imagery"} for a, b, txt in cues if f0 <= a < f1] or kept
        rows += kept
    rows.sort(key=lambda r: r["startMs"])
    rows[0]["startMs"] = 0
    for i, r in enumerate(rows):
        r["endMs"] = rows[i + 1]["startMs"] if i + 1 < len(rows) else end_ms
        q = [str(x) for x in (r.get("queries") or [])][:3]
        r["queries"] = q + [""] * (3 - len(q))
        r["text"] = " ".join(txt for a, b, txt in cues if r["startMs"] <= a < r["endMs"]) or str(r.get("text") or "")
    rows = [r for r in rows if r["endMs"] - r["startMs"] >= 400] or rows
    for i, r in enumerate(rows):                    # a dropped sliver's time goes to the shot before it
        r["endMs"] = rows[i + 1]["startMs"] if i + 1 < len(rows) else end_ms
    _dump(out, {"key": key, "rows": rows})
    engine.log(f"  {len(rows)} shots, {end_ms / 1000 / max(1, len(rows)):.1f}s each on average")
    return rows


# ── 4. templates and their words ──────────────────────────────────────────────────────────────────────────────
def _content(words: str) -> list:
    return [w for w in re.findall(r"[a-z0-9']+", words.lower().replace("’", "'")) if w not in JOINING]


def _spoken_in(line: str, window: str) -> bool:
    have = set(_content(window))
    return all(w in have or (w.endswith("'s") and w[:-2] in have) for w in _content(line))


def _year_in(text: str):
    m = re.search(r"\b(1[0-9]{3}|20[0-9]{2})\b", text)
    return m.group(1) if m else None


def opportunities(engine, job: Path, script: str, force: bool = False) -> list:
    out = job / "mrtruth" / "templates.json"
    got = None if force else _load(out)
    if got is not None:
        return got
    title = (job / "title.txt").read_text(encoding="utf-8").splitlines()[0] if (job / "title.txt").exists() else ""
    guide = _guide()
    prompt = (_prompts()["visual_plan"]
              + ("\n\n## THE CHANNEL'S OWN TEMPLATE GUIDE (the owner's notes; where it disagrees with the above, it wins)\n"
                 + guide if guide else "")
              + f"\n\nTITLE: {title}\n\n<script>\n{script}\n</script>")
    engine.log("Mr Truth: choosing templates and their words (the repo's visual plan brief)...")
    try:
        got = _ask(engine, prompt, 32000, model=engine.SCRIPT_MODEL).get("opportunities") or []
    except RuntimeError as e:
        engine.log(f"  {e} — the film carries only the templates Mr Truth places by itself")
        got = []
    _dump(out, got)
    return got


def _char_ms(script: str, cues: list) -> callable:
    """Script character offset → millisecond on the voice (by word count; the subtitles are the script's words)."""
    starts = []
    for a, b, txt in cues:
        k = max(1, len(txt.split()))
        starts += [a + (b - a) * j / k for j in range(k)]

    def at(char: int) -> int:
        i = len(script[:max(0, int(char))].split())
        return int(starts[min(i, len(starts) - 1)]) if starts else 0
    return at


def _dur(r) -> float:
    return (r["endMs"] - r["startMs"]) / 1000.0


def _can(rows: list, i: int, tid: str, ignore_len: bool = False) -> bool:
    """May template `tid` go on shot i: switched on, the shot free, under its per-film cap, allowed at this position,
    not a year shot (those belong to P12/P14), and long enough for its animation to finish."""
    on, pics, lo, hi, cap, pos, _, _ = LIBRARY[tid]
    if not on or rows[i].get("device"):
        return False
    if cap is not None and sum(1 for r in rows if (r.get("device") or {}).get("id") == tid) >= cap:
        return False
    if pos == "not-opening" and i == 0:
        return False
    if tid not in ("P12", "P14", "chapter-plate", "chapter-title") and i and _year_in(rows[i]["text"]):
        return False                 # a shot that speaks a year belongs to P12/P14 (the repo's G15)
    if ignore_len:
        return True
    return _dur(rows[i]) * FPS >= BUILD_FRAMES.get(tid, 0) + 4 and (_dur(rows[i]) <= hi + 0.05 or tid in ("P12", "P03"))


DEV_DROPS = []        # (shot, template, why) for every template the pictures refused: logged after planning


def _fall_back(rows: list, i: int, tid: str, why: str = "") -> None:
    """A template the picture refused: the first wordless template down its chain that passes the same checks,
    else the shot stays a clean photograph."""
    DEV_DROPS.append((i, tid, why or "refused"))
    rows[i]["device"] = None
    for t in LIBRARY[tid][6]:
        if t == "photo-pop" and _can(rows, i, t):
            rows[i]["device"] = {"id": t}
            return


def assign(engine, rows: list, opps: list, script: str, cues: list, dossier: dict, title: str = ""):
    """Seat each planned template on a shot that can carry it, check its words, fill the auto ones (years, chapters,
    the opening title, the gallery). Writes row["device"] (or leaves it None)."""
    at_ms = _char_ms(script, cues)
    used = {}
    dur = lambda r: (r["endMs"] - r["startMs"]) / 1000.0

    def window(i, wide=2):
        return " ".join(rows[j]["text"] for j in range(max(0, i - wide), min(len(rows), i + wide + 1)))

    def can(tid, i):
        return _can(rows, i, tid)

    def put(i, dev):
        rows[i]["device"] = dev
        used[dev["id"]] = used.get(dev["id"], 0) + 1

    def build(tid, o, i):
        """The device fields for template `tid` from planner row `o` on shot i, or None when its words fail."""
        lim = LIBRARY[tid][7]
        head = str(o.get("headline") or "").strip()
        kick = str(o.get("kicker") or "").strip()
        lines = [str(x).strip() for x in (o.get("lines") or []) if str(x).strip()]
        win, own = window(i), rows[i]["text"]
        fits = lambda s, k: bool(s) and len(s) <= lim.get(k, 999)
        ok = lambda s, k, w=win: fits(s, k) and _spoken_in(s, w)
        if tid in ("P12", "P14"):
            y = _year_in(own) or _year_in(window(i, 1))
            if not y:
                return None
            return {"id": tid, "year": y, "eraLabel": "", "detail": ""} if tid == "P12" else {"id": "P14", "year": y, "label": "", "detail": ""}
        if tid in ("photo-pop", "P08", "P22", "P19", "gallery-strip"):
            return {"id": tid}
        if tid == "P03":
            if not (ok(head, "headline") and p03_fits(head)):
                return None
            if not (ok(kick, "kicker") and _content(kick) and not set(_content(kick)) & set(_content(head))):
                return None              # P03 is two lines that share no word; without its kicker it falls back
            hw = next((w for w in head.split() if w.lower() not in JOINING), head.split()[0])
            return {"id": "P03", "kicker": kick, "headline": head, "highlightWords": [re.sub(r"[^\w'-]", "", hw) or hw]}
        if tid == "framed-card":                  # its words must be said there too (owner 2026-10-09)
            return {"id": tid, "caption": head} if ok(head, "headline") else None
        if tid == "shadow-up":
            return {"id": tid, "line": head} if ok(head, "headline") and not _year_in(head) else None
        if tid == "P04":
            if not ok(head, "headline", own):
                return None
            return {"id": tid, "mainLine": head, "supportLine": kick if ok(kick, "kicker", own) else ""}
        if tid == "P02":
            if not ok(head, "headline") or _year_in(head) or any(len(w) > 16 for w in head.split()):
                return None
            return {"id": tid, "label": kick if ok(kick, "kicker") else "", "headline": head}
        if tid == "P09":
            if not (ok(head, "headline") and head.endswith("?") and "?" in win):
                return None
            return {"id": tid, "sectionLabel": kick if ok(kick, "kicker") else "", "question": head}
        if tid == "P05":
            if not ok(head, "headline") or any(len(w) > 11 for w in head.split()):
                return None
            sup = lines[0] if lines and ok(lines[0], "lines") else ""
            lab = lines[1] if sup and len(lines) > 1 and ok(lines[1], "lines", own) else ""
            return {"id": tid, "eyebrow": kick if ok(kick, "kicker") else "", "headline": head, "supportLine": sup, "imageLabel": lab}
        if tid == "top-title":
            if not ok(head, "headline") or _year_in(head):
                return None
            return {"id": tid, "line1": head, "line2": lines[0] if lines and ok(lines[0], "lines") else ""}
        if tid == "corner-label":
            if not ok(head, "headline") or _year_in(head):
                return None
            return {"id": tid, "label": head, "kicker": kick if ok(kick, "kicker") else ""}
        if tid == "two-photo-zoom":
            right = lines[0] if lines else ""
            if not (ok(head, "headline") and ok(right, "lines")) or head.lower() == right.lower():
                return None
            return {"id": tid, "left": head, "right": right}
        if tid == "bullet-checklist":
            good = [x for x in lines if ok(x, "lines")][:3]
            if not ok(head, "headline") or not good:
                return None
            return {"id": tid, "title": head, "rows": good}
        if tid == "P17":
            m = re.search(r"\b\d{1,2}Q\d{1,3}\b", own)
            return {"id": tid, "label": m.group(0), "anchorX": 0.5, "anchorY": 0.5, "labelX": 0.72, "labelY": 0.28} if m else None
        return None

    # the planner's rows, seated on the nearest shot that can carry them (the repo: nearest cut to the first word)
    starts = [r["startMs"] for r in rows]
    for o in sorted(opps, key=lambda o: int(o.get("startChar") or 0)):
        tid = str(o.get("templateId") or "")
        if tid not in LIBRARY:
            continue
        ms = at_ms(int(o.get("startChar") or 0))
        home = max(0, min(len(rows) - 1, next((k - 1 for k, s in enumerate(starts) if s > ms), len(rows) - 1)))
        quoted = set(_content(" ".join([str(o.get("headline") or "")] + [str(x) for x in o.get("lines") or []])))
        said = lambda k: (len(quoted & set(_content(window(k, 1)))) / len(quoted)) if quoted else 0.0
        near = range(max(0, home - 3), min(len(rows), home + 4))
        done = False
        for i in sorted(near, key=lambda k: (-round(said(k), 2), abs(k - home))):
            chain, done = [tid] + list(LIBRARY[tid][6]), False
            for t in chain:
                if can(t, i):
                    dev = build(t, o, i)
                    if dev:
                        put(i, dev)
                        done = True
                        break
            if done:
                break
        if not done:          # no shot long enough: seat it on its own shot and hold the picture (owner 2026-10-08)
            for i in sorted(near, key=lambda k: (-round(said(k), 2), abs(k - home))):
                if i < len(rows) and _can(rows, i, tid, ignore_len=True) and not rows[i].get("device"):
                    dev = build(tid, o, i)
                    if dev:
                        put(i, dev)
                        _hold(engine, rows, i, _need_s(tid), tid)
                        starts = [r["startMs"] for r in rows]
                        break
            else:
                engine.log(f"      planned {tid} '{o.get('headline', '')}' found no shot (words not spoken nearby)")

    # every spoken four-figure year takes P12 where nothing else sits (T-2), never two in a row
    for i, r in enumerate(rows):
        if not r.get("device") and _year_in(r["text"]) and not (i and (rows[i - 1].get("device") or {}).get("id") in ("P12", "P14")):
            put(i, {"id": "P12", "year": _year_in(r["text"]), "eraLabel": "", "detail": ""})

    # the opening carries P03 (T-11): the planner's, else the film's own title
    if (rows[0].get("device") or {}).get("id") != "P03":
        sections = dossier.get("sections") or []
        cand = [str(s.get("title") or "") for s in sections[:1]] + [re.sub(r"\s*[—:|(-].*$", "", title)]
        head = next((h for h in cand if h and len(h) <= 26 and p03_fits(h)), "")
        if head:
            kick = str(dossier.get("setting") or dossier.get("period") or "").split(",")[0][:24].strip() or "The story"
            if set(_content(kick)) & set(_content(head)):
                kick = str(dossier.get("period") or "The story")[:24]
            hw = next((w for w in head.split() if w.lower() not in JOINING), head.split()[0])
            rows[0]["device"] = {"id": "P03", "kicker": kick, "headline": head, "highlightWords": [re.sub(r"[^\w'-]", "", hw) or hw]}
            used["P03"] = used.get("P03", 0) + 1

    sections = dossier.get("sections") or []        # chapters: fill_overlays() (owner 2026-10-08)

    # the gallery strip, once, on the shot that ends the hook (the first section, else ~30 s in)
    if not used.get("gallery-strip"):
        hook_ms = at_ms(int(sections[1].get("startChar") or 0)) if len(sections) > 1 else 30000
        near = sorted((k for k in range(1, len(rows)) if not rows[k].get("device") and rows[k]["startMs"] <= max(hook_ms, 20000) + 15000),
                      key=lambda k: abs(rows[k]["startMs"] - hook_ms))
        need = (BUILD_FRAMES["gallery-strip"] + 4) / FPS          # 4.5 s: the camera's whole move across the four cards
        for k in near[:4]:
            if dur(rows[k]) < need:
                # no shot is that long (the brief cuts at five seconds): the shot after it joins it, as the repo
                # cuts the gallery's carrier out of the narration around the hook
                nxt = rows[k + 1] if k + 1 < len(rows) else None
                if nxt is None or nxt.get("device") or dur(rows[k]) + dur(nxt) > 6.5 or dur(rows[k]) + dur(nxt) < need:
                    continue
                rows[k]["endMs"] = nxt["endMs"]
                rows[k]["text"] = f"{rows[k]['text']} {nxt['text']}".strip()
                del rows[k + 1]
            rows[k]["device"] = {"id": "gallery-strip"}
            used["gallery-strip"] = 1
            break
    engine.log("  templates: " + ", ".join(f"{k}×{v}" for k, v in sorted(used.items(), key=lambda kv: -kv[1])))
    return build


# ── 4b. overlay coverage (owner 2026-10-08): chapters mandatory, every group used, nothing dominates ───────────
CHAPTERS_MIN, CHAPTERS_MAX = 2, 3
OVERLAY_EVERY_S = 12.0                  # aim: something on screen about every 10-15 s (typed captions included)
TYPED_CAPTION_SLOTS = 5                 # reserved for typed_captions(), which runs after this
OVERLAY_GROUPS = {                      # group: (templates, minimum a film, maximum a film)
    "name label": (["corner-label", "P04"], 1, 4),
    "source": (["P08", "framed-card"], 1, 3),
    "question": (["P09"], 0, 2),
    "compare / list": (["two-photo-zoom", "bullet-checklist", "P05"], 1, 3),
    "running title": (["top-title"], 1, 3),
    "spoken line": (["shadow-up"], 1, 3),
    "editorial card": (["P02"], 0, 2),
    "year": (["P12", "P14"], 0, 3),
    "multi-picture": (["P22", "P19", "gallery-strip"], 0, 2),
}
TEMPLATE_SPECS = """- corner-label: a place or institution label, top right. headline = the name (<= 18 chars), kicker = where/when (<= 14).
- P04: a lower-left label naming who or what is on screen. headline = the name (<= 19), kicker = role or detail (<= 35).
- P08: the source document shown full screen (no words). Use where the narrator cites or reads a text.
- framed-card: the picture framed like an archive print. headline = a short caption (<= 32).
- two-photo-zoom: two things compared. headline = the left one (<= 24), lines[0] = the right one (<= 24).
- bullet-checklist: up to 3 ordered points. headline = the title (<= 19), lines = 1-3 points (<= 21 each).
- P05: text left, picture right. headline (<= 25, words <= 11 letters), kicker = eyebrow (<= 38), lines[0] = support line (<= 48).
- top-title: a running title, top left, two short lines. headline = line 1 (<= 21), lines[0] = line 2 (<= 21).
- shadow-up: one spoken line set in big type. headline = the line (<= 32), no year.
- P09: a question card. headline = the question, ending in '?' (<= 51); only where the narrator asks it.
- P02: an editorial card. kicker = small label (<= 30), headline (<= 46, no year)."""

FILL_PROMPT = """You are finishing the on-screen text plan of a photo documentary (channel: Mr Truth, dark and mysterious).
The film already carries the templates marked [TAKEN] below. Add what is missing.

1. CHAPTERS (mandatory): {chapters_need}. A chapter heading sits over the photo with a brown rule under it. Put each on
   the shot where a real new movement of the story begins, never before {first:.0f} s, spread across the film (at least
   {gap:.0f} s apart). Heading: 2-5 words, Title Case, at most 25 characters, no full stop. These sections were planned
   (use them when they fit, shortened if needed): {sections}

2. OVERLAYS: add about {extra} more, spread through the film, choosing from the groups still short:
{short}
   The templates:
{specs}
   EVERY word you write must be words the narrator actually says on that shot or the two around it (the system checks
   this), except chapter headings. Never two of the same template within 30 s. Never on a [TAKEN] shot.

THE FILM (shot number, start second, the words spoken on it):
{shots}

Return {{"chapters": [{{"shot": n, "heading": "..."}}], "overlays": [{{"shot": n, "templateId": "...", "headline": "...",
"kicker": "...", "lines": ["..."]}}]}}"""


def _hold(engine, rows: list, i: int, secs: float, why: str) -> None:
    """Keep shot i on screen for at least `secs`: the shots after it fold into it (their words are still spoken, under
    the same picture). A template on a folded shot gives way; a chapter, a caption or the opening never does."""
    r = rows[i]
    while _dur(r) < secs and i + 1 < len(rows):
        nxt = rows[i + 1]
        if nxt.get("section_turn") or nxt.get("typedCaption") or (nxt.get("device") or {}).get("id") in ("P03", "gallery-strip"):
            break
        if nxt.get("device"):
            engine.log(f"      template {nxt['device']['id']} at {nxt['startMs'] / 1000:.0f}s gives way to {why}")
        r["endMs"] = nxt["endMs"]
        r["held"] = r.get("held", []) + [nxt["text"]] + nxt.get("held", [])
        del rows[i + 1]


def _need_s(tid: str) -> float:
    return max(LIBRARY[tid][2], (BUILD_FRAMES.get(tid, 0) + 4) / FPS) + 0.3


def _group_of(tid: str) -> str:
    return next((g for g, (ts, _, _) in OVERLAY_GROUPS.items() if tid in ts), "")


def fill_overlays(engine, job: Path, rows: list, script: str, dossier: dict, build, force: bool = False) -> None:
    """After assign(): 2-3 chapter plates (mandatory), then more overlays until every group has its minimum and the
    film carries something about every OVERLAY_EVERY_S. A placement that needs a longer shot holds its picture."""
    total_s = rows[-1]["endMs"] / 1000.0
    has = lambda tid: sum(1 for r in rows if (r.get("device") or {}).get("id") == tid)
    count = lambda g: sum(has(t) for t in OVERLAY_GROUPS[g][0])
    want_total = max(0, round(total_s / OVERLAY_EVERY_S) - TYPED_CAPTION_SLOTS)
    placed_now = sum(1 for r in rows if r.get("device") and r["device"]["id"] != "photo-pop")
    extra = max(0, want_total - placed_now)
    short = [f"   - {g}: {', '.join(ts)} (has {count(g)}, wants at least {lo}, at most {hi})"
             for g, (ts, lo, hi) in OVERLAY_GROUPS.items() if count(g) < hi and any(LIBRARY[t][0] for t in ts)]
    taken = lambda r: r.get("device") is not None
    shots = "\n".join(f"{i}\t{r['startMs'] / 1000:.1f}\t" + ("[TAKEN] " if taken(r) else "") + r["text"]
                       for i, r in enumerate(rows))
    secs = [f"'{s.get('title')}' at ~{int(s.get('startChar') or 0)} chars" for s in (dossier.get("sections") or [])[1:]]
    prompt = FILL_PROMPT.format(chapters_need=f"{CHAPTERS_MIN}-{CHAPTERS_MAX} chapter headings",
                                first=CHAPTER_FIRST_S, gap=max(30.0, total_s / (CHAPTERS_MAX + 1)),
                                sections="; ".join(secs) or "none", extra=extra, short="\n".join(short),
                                specs=TEMPLATE_SPECS, shots=shots)
    out = job / "mrtruth" / "overlays_fill.json"
    key = _hash([prompt])
    got = None if force else _load(out)
    if not (isinstance(got, dict) and got.get("key") == key):
        try:
            got = dict(_ask(engine, prompt, 8000, model=engine.SCRIPT_MODEL), key=key)
        except RuntimeError as e:
            engine.log(f"  overlay fill: {e}")
            return
        _dump(out, got)
    snap = list(rows)                                             # the shot numbers Claude saw, by row identity

    def at(n: int) -> int:
        return next((j for j, x in enumerate(rows) if 0 <= n < len(snap) and x is snap[n]), -1)

    # chapters first: mandatory, so they may take a shot from a lesser template and hold their picture
    chapters, last = 0, -1e9
    for c in sorted(got.get("chapters") or [], key=lambda c: int(c.get("shot", -1)) if str(c.get("shot", "")).lstrip("-").isdigit() else -1):
        try:
            k = at(int(c["shot"]))
        except (KeyError, TypeError, ValueError):
            continue
        head = re.sub(r"\s+", " ", str(c.get("heading") or "")).strip().rstrip(".")
        if k < 0 or not head or chapters >= CHAPTERS_MAX:
            continue
        if len(head) > 25:
            head = " ".join(head.split()[:4])[:25].rstrip(" ,:-")
        head = " ".join(w.lower() if j and w.lower() in ("of", "the", "a", "an", "and", "in", "on", "to", "for", "at", "by")
                        else w for j, w in enumerate(head.split()))
        r = rows[k]
        if r["startMs"] < CHAPTER_FIRST_S * 1000 or r["startMs"] - last < 30000 or (r.get("device") or {}).get("id") in ("P03", "gallery-strip"):
            engine.log(f"      chapter '{head}' at shot {k} skipped (opening, too close, or the title shot)")
            continue
        if r.get("device"):
            engine.log(f"      template {r['device']['id']} at {r['startMs'] / 1000:.0f}s gives way to chapter '{head}'")
        r["device"], r["section_turn"] = {"id": "chapter-plate", "heading": head}, True
        _hold(engine, rows, k, _need_s("chapter-plate"), f"chapter '{head}'")
        chapters, last = chapters + 1, r["startMs"]
        engine.log(f"      chapter '{head}' at {r['startMs'] / 1000:.0f}s")
    if chapters < CHAPTERS_MIN:                 # never short: evenly spaced turns on free shots, the dossier's titles
        titles = [str(s.get("title") or "") for s in (dossier.get("sections") or [])[1:]] or ["The Turn", "What Remained"]
        for f in [x / (CHAPTERS_MIN + 1) for x in range(1, CHAPTERS_MIN + 1)][chapters:]:
            k = min((k for k in range(1, len(rows)) if not rows[k].get("section_turn") and (rows[k].get("device") or {}).get("id") not in ("P03", "gallery-strip")),
                    key=lambda k: abs(rows[k]["startMs"] - f * total_s * 1000), default=None)
            if k is None:
                break
            head = " ".join(titles[min(chapters, len(titles) - 1)].split()[:4])[:25].rstrip(" ,:-")
            rows[k]["device"], rows[k]["section_turn"] = {"id": "chapter-plate", "heading": head}, True
            _hold(engine, rows, k, _need_s("chapter-plate"), f"chapter '{head}'")
            chapters += 1
            engine.log(f"      chapter '{head}' at {rows[k]['startMs'] / 1000:.0f}s (filled)")

    # then the overlays, through the same word checks as the planner's own (build), on free shots, groups capped
    for o in sorted(got.get("overlays") or [], key=lambda o: int(o.get("shot", -1)) if str(o.get("shot", "")).lstrip("-").isdigit() else -1):
        tid = str(o.get("templateId") or "")
        try:
            k = at(int(o["shot"]))
        except (KeyError, TypeError, ValueError):
            continue
        g = _group_of(tid)
        if k < 0 or tid not in LIBRARY or not LIBRARY[tid][0] or not g or count(g) >= OVERLAY_GROUPS[g][2]:
            continue
        if any((rows[j].get("device") or {}).get("id") == tid and abs(rows[j]["startMs"] - rows[k]["startMs"]) < 30000
               for j in range(len(rows))):
            continue
        r = rows[k]
        if r.get("device") or r.get("section_turn") or not _can(rows, k, tid, ignore_len=True):
            continue
        dev = build(tid, o, k)
        if not dev:
            engine.log(f"      {tid} '{o.get('headline', '')}' at shot {k} refused (words not spoken there / too long)")
            continue
        r["device"] = dev
        _hold(engine, rows, k, _need_s(tid), tid)
        engine.log(f"      added {tid} at {r['startMs'] / 1000:.0f}s: {o.get('headline', '')}")
    mix = {g: count(g) for g in OVERLAY_GROUPS}
    engine.log("  overlay mix: " + ", ".join(f"{g} {n}" for g, n in mix.items()) + f", chapters {has('chapter-plate')}")
    low = [g for g, (ts, lo, _) in OVERLAY_GROUPS.items() if mix[g] < lo]
    if low:
        engine.log(f"  overlay groups still under their minimum: {', '.join(low)}")


# ── 5. pictures ───────────────────────────────────────────────────────────────────────────────────────────────
_COMMONS_GATE = threading.Semaphore(3)
_COMMONS_LAST = [0.0]
_COMMONS_GAP = [0.4]                 # seconds between Wikimedia requests: doubles on a 429, eases back on success
_COMMONS_LOCK = threading.Lock()
UA = {"User-Agent": "MoveFast-MrTruth/1.0 (documentary video tool; low volume)"}


def _commons_wait():
    with _COMMONS_LOCK:
        d = time.time() - _COMMONS_LAST[0]
        if d < _COMMONS_GAP[0]:
            time.sleep(_COMMONS_GAP[0] - d)
        _COMMONS_LAST[0] = time.time()


def _commons_said(status: int) -> None:
    with _COMMONS_LOCK:
        _COMMONS_GAP[0] = min(8.0, _COMMONS_GAP[0] * 2) if status == 429 else max(0.4, _COMMONS_GAP[0] * 0.9)


def commons_photos(query: str, folder: Path, n: int = 4) -> list:
    """[(candidate, path)] landscape photographs from Wikimedia Commons (the repo's archive), 1920px thumbnails."""
    import requests
    folder.mkdir(parents=True, exist_ok=True)
    meta = folder / "commons.json"
    got = _load(meta)
    if got is not None and got.get("q") == query:
        return [(c, Path(c["photo"])) for c in got["picks"] if Path(c["photo"]).exists()]
    picks = []
    with _COMMONS_GATE:
        try:
            _commons_wait()
            r = requests.get("https://commons.wikimedia.org/w/api.php", headers=UA, timeout=30, params={
                "action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {query}",
                "gsrnamespace": 6, "gsrlimit": 15, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": 1920})
            pages = sorted(((r.json().get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 99))
        except Exception:                                            # noqa: BLE001 - the web search stands
            pages = []
        for p in pages:
            ii = (p.get("imageinfo") or [{}])[0]
            w, h = int(ii.get("width") or 0), int(ii.get("height") or 0)
            if not str(ii.get("mime", "")).startswith("image/jpeg") and ii.get("mime") != "image/png":
                continue
            if w < 1100 or not h or not 1.0 <= w / h <= 2.5:
                continue
            dest = folder / f"c{len(picks):02d}.jpg"
            try:
                for attempt in range(3):
                    _commons_wait()
                    resp = requests.get(ii.get("thumburl") or ii["url"], headers=UA, timeout=60)
                    _commons_said(resp.status_code)
                    if resp.status_code != 429:
                        break
                if not resp.ok:
                    continue
                dest.write_bytes(resp.content)
            except Exception:                                        # noqa: BLE001
                continue
            em = ii.get("extmetadata") or {}
            picks.append({"photo": str(dest), "title": re.sub(r"^File:|\.\w+$", "", p.get("title", "")),
                          "url": ii.get("descriptionurl") or "", "source": "commons.wikimedia.org",
                          "license": re.sub(r"<[^>]+>", "", str((em.get("LicenseShortName") or {}).get("value") or "")),
                          "artist": re.sub(r"<[^>]+>", "", str((em.get("Artist") or {}).get("value") or ""))[:200]})
            if len(picks) >= n:
                break
    _dump(meta, {"q": query, "picks": picks})
    return [(c, Path(c["photo"])) for c in picks]


# ── the open archives beside Commons (owner 2026-10-09): searched directly, no keys. Each returns
# [(title, image_url, page_url, license, credit, width, height)] for the query; width/height 0 when unknown.
ARCHIVE_PER_SOURCE = 2                  # at most this many pictures from each archive per search
ARCHIVE_MIN_W = 1000
_AUA = {"User-Agent": "Mozilla/5.0 (MoveFast-MrTruth/1.0; documentary video tool; low volume)"}


def _loc_find(q: str) -> list:
    import requests
    d = requests.get("https://www.loc.gov/photos/", headers=_AUA, timeout=25,
                     params={"q": q, "fo": "json", "c": 10, "fa": "online-format:image"}).json()
    out = []
    for r in d.get("results") or []:
        url = ((r.get("image_url") or [""])[-1] or "").split("#")[0]
        m = re.search(r"#h=(\d+)&w=(\d+)", (r.get("image_url") or [""])[-1] or "")
        if url and not r.get("access_restricted"):
            out.append((str(r.get("title") or "")[:200], url, r.get("url") or url, "Library of Congress (check rights)",
                        "Library of Congress", int(m.group(2)) if m else 0, int(m.group(1)) if m else 0))
    return out


def _openverse_find(q: str) -> list:
    import requests
    d = requests.get("https://api.openverse.org/v1/images/", headers=_AUA, timeout=25,
                     params={"q": q, "page_size": 12, "license_type": "commercial,modification"}).json()
    return [(str(r.get("title") or "")[:200], r["url"], r.get("foreign_landing_url") or r["url"],
             f"{r.get('license', '')} {r.get('license_version', '')}".strip(), str(r.get("creator") or "")[:200],
             int(r.get("width") or 0), int(r.get("height") or 0)) for r in d.get("results") or [] if r.get("url")]


def _ia_find(q: str) -> list:
    import requests
    d = requests.get("https://archive.org/advancedsearch.php", headers=_AUA, timeout=25,
                     params={"q": f"({q}) AND mediatype:image", "fl[]": ["identifier", "title"], "rows": 6,
                             "output": "json"}).json()
    out = []
    for doc in (d.get("response") or {}).get("docs") or []:
        ident = doc.get("identifier")
        try:
            meta = requests.get(f"https://archive.org/metadata/{ident}", headers=_AUA, timeout=25).json()
        except Exception:                                            # noqa: BLE001
            continue
        jpgs = [f for f in meta.get("files") or [] if str(f.get("name", "")).lower().endswith((".jpg", ".jpeg"))
                and "thumb" not in str(f.get("name", "")).lower()]
        if not jpgs:
            continue
        f = max(jpgs, key=lambda f: int(f.get("size") or 0))
        out.append((str(doc.get("title") or ident)[:200], f"https://archive.org/download/{ident}/{f['name']}",
                    f"https://archive.org/details/{ident}", str((meta.get("metadata") or {}).get("licenseurl") or "Internet Archive"),
                    str((meta.get("metadata") or {}).get("creator") or "")[:200], int(f.get("width") or 0), int(f.get("height") or 0)))
        if len(out) >= ARCHIVE_PER_SOURCE + 1:
            break
    return out


def _met_find(q: str) -> list:
    import requests
    ids = (requests.get("https://collectionapi.metmuseum.org/public/collection/v1.1/search", headers=_AUA, timeout=25,
                        params={"q": q, "hasImages": "true"}).json().get("objectIDs") or [])[:6]
    out = []
    for oid in ids:
        try:
            o = requests.get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}", headers=_AUA, timeout=25).json()
        except Exception:                                            # noqa: BLE001
            continue
        if o.get("isPublicDomain") and o.get("primaryImage"):
            out.append((f"{o.get('title', '')}, {o.get('objectDate', '')}".strip(", ")[:200], o["primaryImage"],
                        o.get("objectURL") or "", "Public domain (The Met)", str(o.get("artistDisplayName") or "The Met")[:200], 0, 0))
        if len(out) >= ARCHIVE_PER_SOURCE + 1:
            break
    return out


def _europeana_find(q: str) -> list:
    import requests
    d = requests.get("https://api.europeana.eu/record/v2/search.json", headers=_AUA, timeout=25, params={
        "wskey": os.environ["EUROPEANA_API_KEY"], "query": q, "media": "true", "qf": "TYPE:IMAGE",
        "reusability": "open", "rows": 12}).json()
    return [(str((it.get("title") or [""])[0])[:200], (it.get("edmIsShownBy") or [""])[0], it.get("guid") or "",
             str((it.get("rights") or [""])[0]), str((it.get("dataProvider") or [""])[0])[:200], 0, 0)
            for it in d.get("items") or [] if (it.get("edmIsShownBy") or [""])[0]]


# the keyed archives below switch themselves on when their key is in the environment. Written to each archive's
# published API; first exercised live when the key arrives (a failure returns no pictures, never an error)
def _smithsonian_find(q: str) -> list:
    import requests
    d = requests.get("https://api.si.edu/openaccess/api/v1.0/search", headers=_AUA, timeout=25, params={
        "q": f"{q} AND online_media_type:Images", "api_key": os.environ["SMITHSONIAN_API_KEY"], "rows": 12}).json()
    out = []
    for row in ((d.get("response") or {}).get("rows") or []):
        dn = ((row.get("content") or {}).get("descriptiveNonRepeating") or {})
        for m in ((dn.get("online_media") or {}).get("media") or [])[:1]:
            if str((m.get("usage") or {}).get("access", "")).upper() == "CC0" and m.get("content"):
                out.append((str(row.get("title") or "")[:200], m["content"], dn.get("record_link") or "", "CC0 (Smithsonian)",
                            str(dn.get("data_source") or "Smithsonian")[:200], 0, 0))
    return out


def _rijks_find(q: str) -> list:
    """The Rijksmuseum's open Linked Art API (data.rijksmuseum.nl, no key): search, then object -> what it shows ->
    its digital object -> a IIIF image. Public-domain pictures only."""
    import requests
    H = dict(_AUA, Accept="application/ld+json")
    get = lambda u: requests.get(u, headers=H, timeout=25).json()
    found = []
    for field in ("description", "title"):
        d = requests.get("https://data.rijksmuseum.nl/search/collection", headers=H, timeout=25,
                         params={field: q, "imageAvailable": "true"}).json()
        found += [x["id"] for x in d.get("orderedItems") or [] if x.get("id") not in found]
        if len(found) >= 4:
            break
    out = []
    for oid in found[:5]:
        try:
            obj = get(oid)
            title = next((n.get("content") for n in obj.get("identified_by") or [] if n.get("type") == "Name"), "") or ""
            vis = get((obj.get("shows") or [{}])[0]["id"])
            rights = " ".join(str(n.get("content", "")) for r in vis.get("subject_to") or [] for n in r.get("identified_by") or [])
            if "public domain" not in rights.lower():
                continue
            dig = get((vis.get("digitally_shown_by") or [{}])[0]["id"])
            img = (dig.get("access_point") or [{}])[0].get("id", "")
        except Exception:                                            # noqa: BLE001
            continue
        if img:
            out.append((str(title)[:200], img.replace("/full/max/", "/full/2000,/"), oid, "Public domain (Rijksmuseum)",
                        "Rijksmuseum", 0, 0))
        if len(out) >= ARCHIVE_PER_SOURCE + 1:
            break
    return out


def _nara_find(q: str) -> list:
    import requests
    d = requests.get("https://catalog.archives.gov/api/v2", timeout=25, params={"q": q, "rows": 12},
                     headers=dict(_AUA, **{"x-api-key": os.environ["NARA_API_KEY"]})).json()
    out = []
    for h in ((d.get("body") or {}).get("hits") or {}).get("hits") or []:
        rec = (h.get("_source") or {}).get("record") or {}
        for o in rec.get("digitalObjects") or []:
            if str(o.get("objectUrl", "")).lower().endswith((".jpg", ".jpeg")):
                out.append((str(rec.get("title") or "")[:200], o["objectUrl"],
                            f"https://catalog.archives.gov/id/{rec.get('naId', '')}", "US National Archives (public domain)",
                            "National Archives", 0, 0))
                break
    return out


ARCHIVES = {"loc.gov": _loc_find, "openverse": _openverse_find, "archive.org": _ia_find, "metmuseum.org": _met_find,
            "rijksmuseum": _rijks_find}
for _env, _name, _fn in (("EUROPEANA_API_KEY", "europeana", _europeana_find), ("SMITHSONIAN_API_KEY", "si.edu", _smithsonian_find),
                         ("NARA_API_KEY", "archives.gov", _nara_find)):
    if os.environ.get(_env):
        ARCHIVES[_name] = _fn


def archive_photos(query: str, folder: Path) -> list:
    """[(candidate, path)] from the open archives, searched side by side: landscape, wide enough to fill the frame,
    at most ARCHIVE_PER_SOURCE from each. Cached per folder and query like commons_photos."""
    import requests
    from PIL import Image
    folder.mkdir(parents=True, exist_ok=True)
    meta = folder / "archives.json"
    got = _load(meta)
    if got is not None and got.get("q") == query:
        return [(c, Path(c["photo"])) for c in got["picks"] if Path(c["photo"]).exists()]

    def one(name):
        try:
            return name, ARCHIVES[name](query)
        except Exception:                                            # noqa: BLE001 - an archive down is no picture
            return name, []

    with ThreadPoolExecutor(max_workers=len(ARCHIVES)) as ex:
        found = list(ex.map(one, ARCHIVES))
    picks = []
    for name, hits in found:
        took = 0
        for title, url, page, lic, credit, w, h in hits:
            if took >= ARCHIVE_PER_SOURCE:
                break
            if w and h and (w < ARCHIVE_MIN_W or not 1.0 <= w / h <= 2.5):
                continue
            dest = folder / f"a{hashlib.sha1(url.encode()).hexdigest()[:12]}.jpg"
            try:
                if not dest.exists():
                    resp = requests.get(url, headers=_AUA, timeout=60)
                    if not resp.ok or len(resp.content) < 20000:
                        continue
                    dest.write_bytes(resp.content)
                with Image.open(dest) as im:
                    iw, ih = im.size
                    if iw < ARCHIVE_MIN_W or not 1.0 <= iw / ih <= 2.5:
                        continue
                    if iw > 2400:
                        im.convert("RGB").resize((2400, int(2400 * ih / iw))).save(dest, quality=92)
            except Exception:                                        # noqa: BLE001
                continue
            picks.append({"photo": str(dest), "title": title, "url": page, "source": name, "license": lic, "artist": credit})
            took += 1
    _dump(meta, {"q": query, "picks": picks})
    return [(c, Path(c["photo"])) for c in picks]


def _luma(path: Path) -> float:
    from PIL import Image
    with Image.open(path) as im:
        g = im.convert("L")
        g = g.resize((64, max(1, int(64 * g.size[1] / max(1, g.size[0])))))
        px = list(g.getdata())
    return sum(px) / (255.0 * max(1, len(px)))


def _distinct(photo: str, others: list) -> bool:
    """Not the same picture (or a near copy of one) as any of `others`."""
    import photofx
    try:
        h = photofx._phash(photo)
        return all(Path(o) != Path(photo) and not photofx._same_photo(h, photofx._phash(o)) for o in others)
    except Exception:                                                # noqa: BLE001
        return all(Path(o) != Path(photo) for o in others)


def _mostly_blank(path: Path) -> bool:
    """A small picture sitting on a big white (or flat) page: over half the frame near one flat colour."""
    from PIL import Image
    try:
        with Image.open(path) as im:
            g = im.convert("L").resize((64, 36))
            px = list(g.getdata())
    except Exception:                                                # noqa: BLE001
        return False
    return sum(1 for v in px if v >= 240) / len(px) > 0.5 or sum(1 for v in px if v <= 6) / len(px) > 0.6


def _ground_bad(path: Path, band, ceiling: float, plain: bool) -> bool:
    """The strip a template writes in is too bright for white letters, or (for type with no backing at all) too busy."""
    from PIL import Image, ImageFilter
    try:
        with Image.open(path) as im:
            g = im.convert("L")
            w, h = g.size
            g = g.crop((int(band[0] * w), int(band[1] * h), int(band[2] * w), int(band[3] * h))).resize((96, 24))
            px = [v / 255.0 for v in g.getdata()]
            edges = [v / 255.0 for v in g.filter(ImageFilter.FIND_EDGES).getdata()]
    except Exception:                                                # noqa: BLE001
        return False
    mean = sum(px) / len(px)
    bright = sorted(px)[int(len(px) * 0.9)]
    edge = sum(edges) / len(edges)
    return mean > ceiling or (plain and (bright > 0.85 or edge > 0.25))


def _type_shade(path: Path, band, ceiling: float, plain: bool) -> float:
    """How much to darken the strip under a template's type (0 = none) so white letters read on it, measured as the
    viewer sees the picture: through the shadow look's dimming. Plain type (no backing) also wants no hot spots."""
    from PIL import Image
    try:
        with Image.open(path) as im:
            g = im.convert("L")
            w, h = g.size
            g = g.crop((int(band[0] * w), int(band[1] * h), int(band[2] * w), int(band[3] * h))).resize((96, 24))
            px = [v / 255.0 for v in g.getdata()]
    except Exception:                                                # noqa: BLE001
        return 0.0
    dim = 1 - 0.2 * min(1.0, SHADOW_LOOK)
    mean, hot = sum(px) / len(px) * dim, sorted(px)[int(len(px) * 0.9)] * dim
    need = 0.0
    if mean > ceiling * 0.9:
        need = 1 - ceiling * 0.8 / mean
    if plain and hot > 0.75:
        need = max(need, 1 - 0.7 / hot)
    return round(min(0.75, max(0.25, need)), 2) if need > 0 else 0.0


def _shaded_copy(photo: str, band, k: float) -> str:
    """A copy of the photo darkened by up to `k` under the type band, feathered so no edge shows."""
    from PIL import Image, ImageFilter
    src = Path(photo)
    out = src.with_name(f"{src.stem}_shade{hashlib.sha1(f'{band}{k}'.encode()).hexdigest()[:8]}.jpg")
    if out.exists():
        return str(out)
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        pad_x, pad_y = 0.06 * w, 0.06 * h
        mask = Image.new("L", (w, h), 0)
        box = (max(0, int(band[0] * w - pad_x)), max(0, int(band[1] * h - pad_y)),
               min(w, int(band[2] * w + pad_x)), min(h, int(band[3] * h + pad_y)))
        mask.paste(int(255 * k), box)
        mask = mask.filter(ImageFilter.GaussianBlur(radius=0.07 * w))
        dark = Image.new("RGB", (w, h), (0, 0, 0))
        Image.composite(dark, im, mask).save(out, quality=93)
    return str(out)


def _shape_ok(path: Path) -> bool:
    from PIL import Image
    try:
        with Image.open(path) as im:
            w, h = im.size
        return w >= MIN_WIDTH and 1.0 <= w / h <= 2.5
    except Exception:                                                # noqa: BLE001
        return False


JUDGE_TAIL = """
For this run return ONLY a JSON array, one object per candidate, in candidate order, with the fields the brief above
describes: [{"candidateIndex": 1, "score": 0-10, "reason": "one sentence", "subjectAnchor": {"x": 0-1, "y": 0-1},
"hasBakedText": true|false, "depiction": "named-subject" | "same-category" | "unrelated", "studioProduct": true|false,
"wrongPerson": true|false, "modernStock": true|false, "toneFit": "fits" | "neutral" | "clashes", "person": true|false,
"subject": "2-5 words naming WHAT and WHICH VIEW the picture shows, the same words for the same view of the same
place or thing (e.g. 'vatican library sistine hall', 'codex vaticanus page', 'priest at desk')"}]
studioProduct: true when the object is photographed on a white or seamless studio background.
READABLE WORDS IN A DOCUMENT: when a page, ledger or record in the picture shows a legible name, date or heading of a
  DIFFERENT real person, place or event than this film's (e.g. a famous dictator's register in a film about a Vatican
  translator), depiction is "unrelated" and the score is at most 1, however well the page "looks the part".
person: true when a person is the main subject of the picture (a portrait, a figure at work), not a crowd or a speck.
wrongPerson: true when the narration (or the scene's "about") points at a person and the picture's main figure is
  visibly NOT that kind of person (no priest's dress when the narration says priest or Father; a costumed model; a
  youth for an old scholar; a woman for a man). For a person NOT in the <film> block's no-likeness list, anyone other
  than that very person is wrongPerson. For a person IN that list, a real photograph of another person of the right
  role stands in for them and is NOT wrongPerson — even if the title names that other person — UNLESS the face is
  world-famous (a pope, a famous cardinal, a head of state, a celebrity): a famous face standing in for them IS
  wrongPerson. On a line that is NOT about that person (the Church, the Vatican, an institution), a pope or famous
  cleric is a fine subject.
modernStock: true for modern stock or lifestyle photos, staged concept photos, modern product shots and shop
  listings, decor, gifts, modern home or office interiors, screenshots, modern infographics or slides, clip-art,
  AI-looking renders, tourist-brochure, glossy or HDR travel pictures, or modern people in modern clothes — unless
  the narration is plainly about the present day. A period technical drawing, cutaway, map, engraving or museum photo
  of a period object is NOT modernStock.
toneFit: does the picture keep the <film> block's tone? "clashes" for cheerful, glossy, commercial, playful, homely
  or staged pictures in a serious film (or the opposite). A plain colour or daylight photo of a real period subject,
  or a real portrait of a person (smiling or not), is "neutral" — the film grades every picture later.
Four rules of this channel on top of the brief above:
- THE FILM'S LOOK. A picture of a kind the <film> block says this film may NOT SHOW, or with wrongPerson, modernStock
  or toneFit "clashes", scores AT MOST 2 — however exactly it matches the words.
- THE PERIOD. This film is set in [PERIOD]. A portrait or at-work photo of a person in the dress of their role (a
  priest's cassock and collar, a monk's habit, a uniform) may be from a later decade and in colour: it stands in for
  that role, as long as no modern device or modern setting is prominent. Otherwise a photograph visibly taken after
  that period — modern cars on the street,
  glass towers built later, today's clothes, face masks, laptops, phones, screens, modern office furniture, modern
  signage — scores AT MOST 2, unless the narration is plainly about the present day. A museum, restoration or show
  photo of the period object itself is fine. Another country's or another tradition's version of the thing (an
  English printed book for a Latin codex, an American card catalogue for a Vatican register) is a wrong subject. When
  the narration or the <film> block gives the AGE of an object, the same kind of object from a visibly different
  century (a Gothic or Renaissance book for a 4th-5th century codex, a 1900s rifle for a musket) scores AT MOST 3.
- STAND-INS ARE SUBJECTS. When the visual intent asks for an anonymous figure of a listed role, or for one of the
  film's motifs, an authentic period picture of exactly that is this scene's subject: judge it as you would the
  named subject (6-9 when it is good), not as generic stock.
- NO CARTOONS. A cartoon, clip-art, a flat-colour or toy-like 3D illustration scores AT MOST 2. A real photograph,
  an archival print, an engraving, a technical cutaway or an engineering drawing is fine."""


def _small(path: Path) -> Path:
    """A 640-px copy of a candidate for the picture judge (the original stays for the render)."""
    from PIL import Image
    st = Path(path).stat()
    # keyed on the file itself: Commons names its downloads c00..c03 in every folder, so a later search for another
    # query reuses the names — a name-only key had the judge look at the OLD picture (review 2026-10-08)
    tag = hashlib.sha1(f"{Path(path).name}:{st.st_size}:{st.st_mtime_ns}".encode()).hexdigest()[:10]
    dest = Path(path).parent / "_small" / f"{Path(path).stem}_{tag}.jpg"
    if dest.exists():
        return dest
    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((640, 640))
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, "JPEG", quality=85)
        return dest
    except Exception:                                                # noqa: BLE001 - the judge sees the original
        return Path(path)


def judge(engine, row: dict, cands: list, dossier: dict, before: str = "", after: str = "") -> list:
    """Scores for the candidates through Gemini (engine.pick_vision), with the repo's own picture-judge brief, the
    film's visual brief, and the lines around the shot. wrongPerson / modernStock / a clashing tone cap a score at 2."""
    if not cands:
        return []
    small = [_small(p) for _, p in cands]
    brief = (_prompts()["vision"] + _film_block(dossier)
             + f"\n\n<scene>\nbefore: {before}\nnarration: {row['text']}\nafter: {after}\n"
             + f"visual intent: {row.get('visualIntent', '')}\nmood: {row.get('mood', '')}\n"
             + f"entities: {', '.join(map(str, row.get('entities') or [])) or 'none'}\n"
             + f"about: {row.get('about') or 'nobody in particular'}\n</scene>\n"
             + "\n".join(f"candidate {k + 1}: {c.get('title', '')[:120]}" for k, (c, _) in enumerate(cands))
             + JUDGE_TAIL.replace("[PERIOD]", str(dossier.get("period") or "the period the narration describes")))
    items = []
    for _ in range(2):                             # one retry: a dropped answer must not cost a shot its pictures
        try:
            raw = engine.pick_vision(brief, [str(p) for p in small], max_tokens=12000,
                                     model=JUDGE_MODEL, thinking=JUDGE_THINKING)
            items = json.loads(re.search(r"\[.*\]", raw, re.DOTALL).group(0))
            if isinstance(items, list) and items:
                break
        except Exception:                                            # noqa: BLE001 - asked once more
            items = []
    by = {}
    for x in items:
        try:
            by[int(x.get("candidateIndex", 0)) - 1] = x
        except (AttributeError, TypeError, ValueError):
            continue
    out = []
    for k, (c, p) in enumerate(cands):
        x = by.get(k, {})
        try:
            score = float(x.get("score", 0))   # an unjudged picture is not a pass: it was 4 (a contextual pass)
        except (TypeError, ValueError):
            score = 0.0
        depiction = str(x.get("depiction") or "").strip().lower()
        yes = lambda v: v is True or str(v).strip().lower() == "true"
        flags = [f for f in ("wrongPerson", "modernStock") if yes(x.get(f))]
        if str(x.get("toneFit") or "").strip().lower() == "clashes":
            flags.append("toneClashes")
        if flags:
            score = min(score, 2.0)
            if "wrongPerson" in flags:
                depiction = "unrelated"
        sa = x.get("subjectAnchor") if isinstance(x.get("subjectAnchor"), dict) else {}
        try:
            ax, ay = float(sa.get("x", x.get("subjectX", 0.5)) or 0.5), float(sa.get("y", x.get("subjectY", 0.5)) or 0.5)
        except (TypeError, ValueError):
            ax, ay = 0.5, 0.5
        if yes(x.get("hasBakedText")) or _mostly_blank(p):
            score = min(score, 2.0)          # lettering printed into the picture, or a small picture on an empty page
        out.append(dict(c, photo=str(p), score=score, studio=bool(x.get("studioProduct")) or "studio" in str(x.get("reason", "")).lower(),
                        anchor=(min(1.0, max(0.0, ax)), min(1.0, max(0.0, ay))),
                        depiction=depiction, flags=flags, reason=str(x.get("reason") or "")[:200],
                        subject=re.sub(r"\s+", " ", str(x.get("subject") or "").strip().lower())[:60],
                        person=yes(x.get("person")),
                        **({"unjudged": True} if not x else {})))
    return sorted(out, key=lambda c: -c["score"])


def archive_names(engine, job: Path, rows: list, dossier: dict, force: bool = False) -> None:
    """row["archive"] = the one name an archive files this shot's subject under (the repo's archive-names brief), or
    nothing. Neighbours get different names; a name over 3 words, a bare number or the previous shot's is dropped."""
    out = job / "mrtruth" / "archive_names.json"
    key = _hash([NAMES_V, [r["text"] for r in rows], dossier])
    got = None if force else _load(out)
    got = got.get("names") if isinstance(got, dict) and got.get("key") == key else None
    if got is None:
        got = {}
        engine.log("Mr Truth: archive names for the picture search (the repo's brief)...")
        for b0 in range(0, len(rows), 60):
            blocks = []
            for i in range(b0, min(len(rows), b0 + 60)):
                r = rows[i]
                blocks.append(f"<shot index=\"{i}\">\nnarration: {r['text']}\n"
                              f"before: {rows[i - 1]['text'] if i else ''}\nafter: {rows[i + 1]['text'] if i + 1 < len(rows) else ''}\n"
                              f"entities: {', '.join(map(str, r.get('entities') or [])) or 'none'}\n"
                              f"visual intent: {r.get('visualIntent', '')}\nsearch now: {(r.get('queries') or [''])[0]}\n</shot>")
            prompt = (_prompts()["archive_names"] + "\n" + _film_block(dossier) + "\n\n" + "\n".join(blocks)
                      + '\n\nReturn {"names": [{"index": 0, "name": "..." or null}, ...]}.')
            try:
                for x in _ask(engine, prompt, 8000).get("names") or []:
                    got[str(int(x.get("index")))] = x.get("name")
            except (RuntimeError, TypeError, ValueError) as e:
                engine.log(f"  archive names: {str(e)[:100]} — the shots keep their own search words")
        _dump(out, {"key": key, "names": got})
    prev = None
    for i, r in enumerate(rows):
        name = str(got.get(str(i)) or "").strip()
        bad = (not name or len(name.split()) > 3 or len(name) > 60 or re.fullmatch(r"[\d\s,.-]+", name)
               or "/" in name or name == prev)
        r["archive"] = "" if bad else name
        prev = name or prev


# ── Mr Truth's own Brave client: the owner's plan takes 50 requests a second, so up to 10 run at once here
#    (MoveFast's photofx.brave_images holds one lock for every channel; Documentary keeps using that one) ──────────
_BRAVE_GATE = threading.Semaphore(10)
_BRAVE = {"slow_until": 0.0, "requests": 0}
_BRAVE_LOCK = threading.Lock()


def brave_search(query: str, folder: Path, n: int = 12) -> list:
    """[{url, thumb, title, source}] from Brave Images, filtered like photofx.brave_images; cached per query."""
    import os
    import requests
    from urllib.parse import urlparse
    import photofx
    query = str(query or "").strip()
    if not query:
        return []
    cache = folder / "brave" / (hashlib.sha256(query.encode()).hexdigest()[:20] + ".json")
    got = _load(cache)
    if got is not None:
        return got
    key = (os.environ.get("BRAVE_SEARCH_API_KEY") or "").strip()
    if not key:
        return []
    payload = None
    with _BRAVE_GATE:
        for _ in range(3):
            wait = _BRAVE["slow_until"] - time.time()
            if wait > 0:
                time.sleep(min(wait, 5.0))
            try:
                resp = requests.get("https://api.search.brave.com/res/v1/images/search", timeout=30,
                                    headers={"Accept": "application/json", "X-Subscription-Token": key},
                                    params={"q": query, "count": min(20, n + 6), "country": "ALL", "search_lang": "en",
                                            "safesearch": "strict", "spellcheck": 1})
            except Exception:                                        # noqa: BLE001 - Commons still stands
                return []
            with _BRAVE_LOCK:
                _BRAVE["requests"] += 1
                if resp.status_code == 429:
                    try:
                        reset = float(str(resp.headers.get("x-ratelimit-reset", "1")).split(",")[0])
                    except ValueError:
                        reset = 1.0
                    _BRAVE["slow_until"] = max(_BRAVE["slow_until"], time.time() + max(0.5, reset))
            if resp.status_code == 429:
                continue
            if resp.status_code == 200:
                payload = resp.json()
            break
    found, seen = [], set()
    for row in (payload or {}).get("results") or []:
        if not isinstance(row, dict):
            continue
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        original = props.get("url") or row.get("original")
        page = str(row.get("url") or row.get("source") or "")
        if not isinstance(original, str) or original in seen:
            continue
        host = (urlparse(original).hostname or "").lower()
        if not host or host.endswith("brave.com") or any(h in (page + " " + original).lower() for h in photofx.STOCK_HOSTS):
            continue
        seen.add(original)
        thumb = (row.get("thumbnail") or {}).get("src") if isinstance(row.get("thumbnail"), dict) else None
        try:
            w, h = int(props.get("width") or 0), int(props.get("height") or 0)
        except (TypeError, ValueError):
            w, h = 0, 0
        found.append({"url": original, "thumb": thumb or original, "source": page or host, "w": w, "h": h,
                      "title": re.sub(r"<[^>]*>", "", str(row.get("title") or "")), "provider": "brave"})
    found = photofx.people_photos(found)[:n]
    if payload is not None:
        _dump(cache, found)
    return found


def _download(cand: dict, dest: Path):
    """One web photo as a JPEG, kept only when it can fill a 1080p frame: at least 960 wide, landscape, not panorama."""
    import io
    import requests
    import photofx
    if dest.exists():
        return dest
    for url in [cand.get("url")]:          # the original only: Brave's thumbnails are 500 px
        if not url:
            continue
        try:
            g = requests.get(url, headers=photofx._IMG_HEADERS, timeout=20)
            if g.status_code != 200 or len(g.content) < 2000:
                continue
            im = photofx.load_rgb(io.BytesIO(g.content))
        except Exception:                                            # noqa: BLE001 - not an image, blocked, timed out
            continue
        w, h = im.size
        if w >= MIN_WIDTH and h and 1.0 <= w / h <= 2.5:
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, "JPEG", quality=92)
            return dest
    return None


# Pages a documentary picture never comes from: shops and listings, free-stock libraries and their re-hosts,
# clip-art and template sites. Checked on the page and the image address and on the title, before anything is
# downloaded — and on Brave answers read back from the cache, so it also cleans an existing job.
_JUNK_URL = re.compile(
    r"/products?/|/cdn/shop/|cdn\.shopify\.com|/listing/|/dp/|/itm/|[?&]variant="
    r"|(?:^|[/.])(?:pinterest|pinimg|unsplash|pexels|pixabay|stickpng|freepik|vecteezy|pngtree|pngwing|cleanpng|kindpng"
    r"|canva|rawpixel|depositphotos|123rf|bigstockphoto|pond5|storyblocks|envato|creativemarket|etsy|amazon|ebay"
    r"|aliexpress|walmart|wayfair|redbubble|zazzle|society6|teepublic)\."
    r"|-unsplash\.|unsplash-image-|pexels-photo|istock-|shutterstock_|adobestock_|gettyimages-", re.I)
_JUNK_TITLE = re.compile(
    r"\b(for sale|buy now|add to cart|free shipping|gift ideas?|home decor|wall decor|wall clock|décor|stock photo|"
    r"stock image|royalty[- ]free|free download|transparent png|png image|clipart|clip art|vector art|mockup)\b", re.I)
# archives, museums, libraries and universities: never dropped by the patterns above (a museum's own
# /collections/ page or a print in a library's online shop is still a real picture of the thing)
_ARCHIVE_HOST = re.compile(
    r"(?:^|[/.])(?:wikimedia|wikipedia|loc\.gov|si\.edu|archives\.gov|nara|europeana|archive\.org|bl\.uk|bnf\.fr|"
    r"vatlib\.it|vaticanlibrary|digi\.vatlib|metmuseum|britishmuseum|rijksmuseum|vam\.ac\.uk|getty\.edu|"
    r"nationalarchives|iwm\.org\.uk|npg\.org\.uk|e-codices|gallica)|\.edu(?:/|$)|\.ac\.uk(?:/|$)|museum|library|archiv", re.I)


def _junk(c: dict) -> bool:
    where = " ".join(str(c.get(k) or "") for k in ("url", "source", "thumb"))
    page = str(c.get("source") or c.get("url") or "")
    if _ARCHIVE_HOST.search(re.sub(r"^https?://", "", page).split("/")[0]):
        return False
    return bool(_JUNK_URL.search(where) or _JUNK_TITLE.search(str(c.get("title") or "")))


def web_photos(queries: list, folder: Path, n: int = 6) -> list:
    """[(candidate, path)] — Brave for each query (at most two), the downloads side by side. Shop, stock and
    clip-art pages are dropped before download (_junk)."""
    cands, seen = [], set()
    for q in [q for q in dict.fromkeys(str(x or "").strip() for x in queries) if q][:2]:
        for c in brave_search(q, folder):
            if c["url"] not in seen and not _junk(c):
                seen.add(c["url"])
                cands.append(c)
    # Brave says how big each original is: only the ones that can fill the frame are downloaded
    fit = [c for c in cands if not c.get("w") or (c["w"] >= MIN_WIDTH and c.get("h") and 1.0 <= c["w"] / c["h"] <= 2.5)]
    picks = fit[: n + 4]
    with ThreadPoolExecutor(max_workers=8) as ex:
        paths = list(ex.map(lambda kc: _download(kc[1], folder / f"w{hashlib.sha1(kc[1]['url'].encode()).hexdigest()[:12]}.jpg"),
                            enumerate(picks)))
    out = [({"title": c.get("title", ""), "url": c.get("source") or c["url"], "source": c.get("source", "web"), "license": ""}, p)
           for c, p in zip(picks, paths) if p]
    return out[:n]


_DATEISH = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})s?\b|\b(early|late|mid)\b", re.I)
_DESCRIPTIVE = {"old", "vintage", "historic", "historical", "archival", "archive", "black", "white", "colour", "color",
                "close-up", "closeup", "close", "up", "wide", "detail", "view", "photo", "photograph", "image", "interior",
                "exterior", "scene", "shot", "footage", "dramatic", "famous", "early", "original", "rare"}


def _broader(query: str, names: list) -> list:
    """Round 2: the same subject, worded wider — the full archive name of the thing, and the plain words of the
    search with its years, eras and describing words taken out (a too-narrow search is the commonest empty one)."""
    plain = [w for w in re.sub(_DATEISH, " ", str(query or "")).split() if w.lower().strip(",.") not in _DESCRIPTIVE]
    tries = [*(n for n in names if n), " ".join(plain[:4]), " ".join(plain[:3]), " ".join(plain[:2])]
    return [q for q in dict.fromkeys(tries) if q and q.lower() != str(query or "").lower()][:2]


ANCHOR_PROMPT = """You are the picture researcher of a history documentary that is built from photographs only.
For each shot below, no usable photograph was found for what it shows now. Its searches did return pictures, and
a picture judge refused them for the reasons given — or nothing came back at all.

Choose ONE other thing this shot can show instead: a different ANCHOR from the same narration. Go down this order and
take the first that a photograph can really exist of:
  1. the person or the thing the narration is talking about
  2. a person with NO known photograph (the <film> block's people list): an anonymous figure of their ROLE in the
     film's setting and era, shown as a type (kind "role") — e.g. a Catholic priest reading in an old library. The
     picture will never be presented as them. Never a different named person, never someone not of that role.
  3. the object involved in it — of the film's own world and era
  4. the place where the ACTION happens, as the <film> block's setting says — not a person's home town, origin or
     nationality (a Sicilian priest working in the Vatican Library: the Vatican Library, not Sicily)
  5. the period setting (a real kind of place of that era)
  6. for an abstract line: one of the <film> block's motifs (a concrete thing of the film's world in its tone)
Rules:
- Only things the narration, the shots beside it or the <film> block plainly point at. Never a bare mood or idea; a
  role figure's hands or silhouette over a manuscript is fine.
- Every anchor must fit the film's era, setting and tone. Never a modern consumer object, decor, an office, a
  screenshot, or another country's or tradition's version of the thing.
- Not the anchor that was already searched, and not one the judge already refused for these reasons.
- commons: the name Wikimedia Commons files it under, at most 3 words. web: a plain image search, at most 7 words,
  carrying the film's setting or era words when the thing is generic.

[INSERT FILM HERE]

[INSERT SHOTS HERE]

Return ONLY a JSON object: {"anchors": [{"index": 0, "anchor": "...", "kind": "person|role|thing|object|place|setting|motif",
"commons": "...", "web": "..."}]} with one entry for every shot index given."""


def _studio_ok(r: dict, c: dict) -> bool:
    """A studio product shot (an object on a white or seamless ground) is refused only where the shot carries
    a template — the repo's T-9 is about titled beats; on a plain shot a clean cutaway or product photo is fine."""
    return not (c.get("studio") and r.get("device"))


CONTEXT_SCORE = 5.0             # "right kind of thing, not the exact one". Was 3.0 — the judge's own stock band (3-5:
                                # "generic"), which put a gift-blog wall clock and office stock on screen (owner 2026-10-08)


def _names_thing(r: dict) -> bool:
    """The shot names a person, place or object (dates and years do not count): it must then show exactly that,
    or another real anchor, before a contextual photo is allowed."""
    dateish = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})s?\b|\b(january|february|march|april|may|june|july|august|september|"
                         r"october|november|december|century|decade|era|bc|bce|ad|ce)\b|^\W*\d+\W*$", re.I)
    return any(str(e).strip() and not dateish.search(str(e)) for e in r.get("entities") or [])


def _contextual(r: dict, cands: list) -> list:
    """Real photos of the right kind of thing: score 5 or more, not judged unrelated, no judge flag (wrong person,
    modern stock, clashing tone — those already score at most 2), no studio shot under a template."""
    return [c for c in cands if c["score"] >= CONTEXT_SCORE and c.get("depiction") != "unrelated"
            and not c.get("flags") and _studio_ok(r, c)]


def _need(r: dict) -> float:
    """The score a shot's photo must reach: 6 when its template names what the picture is, else 5. Never lowered."""
    return 6.0 if (r.get("device") or {}).get("id") in NAMES_PICTURE else MIN_SCORE


def pictures(engine, job: Path, rows: list, dossier: dict, force: bool = False) -> None:
    """row["pick"] = the shot's picture, row["step"] = how it was found, row["spare"] = its runner-ups.

    Search, up to three rounds a shot, stopping the moment one photo passes the judge at the shot's own bar:
      1  the archive name on Wikimedia Commons (judged first: a 7 ends the shot), then Brave with the shot's search
      2  only when round 1 came back THIN (fewer than 4 usable photos): the same subject, worded wider
      3  still failing, and the shot names a person/place/object: a different ANCHOR from the same narration
         (one Claude call for all such shots). A shot that names nothing takes a contextual photo instead.
    The picture on screen, first that exists (owner 2026-10-06 — Documentary's rule: exact for a named thing,
    otherwise "fits the context"): exact photo → the new anchor's photo → a contextual real photo (score 3+) →
    a good unused neighbour photo → an AI stand-in under AI_IMAGE_CAP → over the cap, a real photo from earlier in
    the video (never within 3 shots, at most twice). No text cards while the video has photos. Only an exact photo
    may carry a template that names what the picture is. (Bing was tried as a last round and dropped: 1 photo in ~26
    tries, for most of the search time.)"""
    import photofx
    root = job / "mrtruth" / "pictures"
    canon = {str(e.get("name", "")).lower(): str(e.get("canonicalSearchName") or e.get("name") or "")
             for e in dossier.get("keyEntities") or []}
    t0 = time.time()
    b0 = _BRAVE["requests"]
    home_of = lambda r: root / ("s" + hashlib.sha1(r["text"].encode()).hexdigest()[:14])

    around = lambda i: (rows[i - 1]["text"] if i else "", rows[i + 1]["text"] if i + 1 < len(rows) else "")
    film_key = _hash([PICK_V, dossier.get("visualBrief") or {}])     # a new brief re-judges every shot

    def judged(i, found, prior, row=None):
        have = {c["photo"] for c in prior}
        new = [(c, p) for c, p in found if str(p) not in have and _shape_ok(p)]
        return sorted(prior + judge(engine, row or rows[i], new[:9], dossier, *around(i)),
                      key=lambda c: -c["score"]) if new else prior

    def usable(r, c, bar):
        return c["score"] >= bar and _studio_ok(r, c) and c.get("depiction") != "unrelated" and not c.get("flags")

    def passes(r, scored):
        return any(usable(r, c, _need(r)) for c in scored)

    def first_rounds(i):
        r, home = rows[i], home_of(rows[i])
        state = None if force else _load(home / "pick.json")
        if (state and state.get("text") == r["text"] and state.get("v") == PICK_V and state.get("film") == film_key
                and state.get("complete", True) and all(Path(c["photo"]).exists() for c in state["cands"])):
            return state
        lit, con, _mood = (r.get("queries") or ["", "", ""])[:3]
        # a dossier name is only an archive name when it is one: at most 3 words, no appositive ("X, Sicilian priest")
        names = [n for n in (canon.get(str(e).lower(), str(e)) for e in r.get("entities") or [] if str(e).strip())
                 if len(n.split()) <= 3 and "," not in n and "/" not in n]
        q = lit or r.get("visualIntent") or r["text"]
        archive = str(r.get("archive") or "").strip() or (names[0] if names else "")
        web_q = [q, archive or con]
        stand = _stand_in(r, dossier)
        if stand:                                    # a person of whom no likeness exists: search the ROLE, not the name
            sur = _surname(stand)
            archive = stand.get("commons") or ""
            web_q = [x for x in (stand.get("portrait"), stand.get("web")) if x] + \
                    [x for x in (lit, con) if x and sur not in x.lower()]
            names = [archive] if archive else []
            q = web_q[0] or q
        scored, tried = [], [q]
        if archive:
            scored = judged(i, commons_photos(archive, home / "commons"), [])
            tried.append(archive)
        done = 1 if any(usable(r, c, max(7.0, _need(r))) for c in scored) else 0
        if not done:                                 # the open archives (LoC, Openverse, Internet Archive, the Met): free
            aq = archive or " ".join(q.split()[:5])
            scored = judged(i, archive_photos(aq, home / "archives"), scored)
            tried.append(f"archives: {aq}")
            done = 1 if any(usable(r, c, max(7.0, _need(r))) for c in scored) else 0
        if not done:
            scored = judged(i, web_photos(web_q, home / "web"), scored)
            done = 1 if passes(r, scored) else 0
        # thin: fewer than 4 photos the judge would let on screen (was: fewer than 4 photos of any score)
        if not done and sum(1 for c in scored if usable(r, c, CONTEXT_SCORE)) < 4:
            wider = _broader(q, names)
            found = []
            for k, w in enumerate(wider):
                found += commons_photos(w, home / f"commons_r2_{k}")
            found += web_photos(wider, home / "web_r2")
            scored = judged(i, found, scored)
            tried += wider
            done = 2 if passes(r, scored) else 0
        if stand:                                    # a role figure is never the named person: no name over it
            scored = [dict(c, stand_in=True) for c in scored]
        state = {"v": PICK_V, "film": film_key, "text": r["text"], "cands": scored, "round": done, "tried": tried,
                 "stand_in": (stand or {}).get("role", ""), "stand_look": (stand or {}).get("appearance", ""),
                 "complete": not any(c.get("unjudged") for c in scored)}
        _dump(home / "pick.json", state)
        return state

    engine.log(f"Mr Truth: pictures for {len(rows)} shots (Commons first, then Brave; up to 3 rounds; Gemini judges)...")
    archive_names(engine, job, rows, dossier, force)
    with ThreadPoolExecutor(max_workers=10) as ex:
        states = list(ex.map(first_rounds, range(len(rows))))

    # round 3: a different anchor for every shot still without a photo (one Claude call for all of them)
    failing = [i for i, st in enumerate(states) if not st.get("round")
               and (_names_thing(rows[i]) or not _contextual(rows[i], st["cands"]))]
    if failing:
        cache = job / "mrtruth" / "anchors.json"
        anchors = {} if force else (_load(cache) or {})
        akey = lambda i: _hash([ANCHORS_V, rows[i]["text"], dossier.get("visualBrief") or {}])
        ask = [i for i in failing if akey(i) not in anchors]
        for k0 in range(0, len(ask), 50):
            part = ask[k0:k0 + 50]
            blocks = "\n".join(
                f"<shot index=\"{i}\">\nnarration: {rows[i]['text']}\n"
                f"before: {rows[i - 1]['text'] if i else ''}\nafter: {rows[i + 1]['text'] if i + 1 < len(rows) else ''}\n"
                f"entities: {', '.join(map(str, rows[i].get('entities') or [])) or 'none'}\n"
                f"already searched: {'; '.join(states[i].get('tried') or [])}\n"
                f"judge said: {' | '.join(c.get('reason', '') for c in states[i]['cands'][:3]) or 'nothing came back'}\n</shot>"
                for i in part)
            prompt = ANCHOR_PROMPT.replace("[INSERT FILM HERE]", _film_block(dossier)).replace("[INSERT SHOTS HERE]", blocks)
            try:
                for x in _ask(engine, prompt, 6000).get("anchors") or []:
                    i = int(x.get("index"))
                    if i in part:
                        anchors[akey(i)] = {k: str(x.get(k) or "")[:80] for k in ("anchor", "kind", "commons", "web")}
            except (RuntimeError, TypeError, ValueError) as e:
                engine.log(f"  round 3: no new anchors — {str(e)[:100]}")
        _dump(cache, anchors)

        def third_round(i):
            r, home, st = rows[i], home_of(rows[i]), states[i]
            if st.get("r3"):
                return st
            a = anchors.get(akey(i)) or {}
            if a.get("anchor"):
                # the stand-in keeps the shot's own demands: the judge still needs the film's era and tone, and a
                # role figure for a person, never a different person or a bare place in their stead
                who = f" Any person shown must be {st['stand_in']}, anonymous." if st.get("stand_in") else ""
                stand = dict(r, visualIntent=f"Show {a['anchor']} ({a.get('kind') or 'stand-in'}) for this line, in the "
                             f"film's era, setting and tone.{who} Originally wanted: {r.get('visualIntent', '')}")
                found = (commons_photos(a.get("commons") or a["anchor"], home / "commons_r3")
                         + web_photos([a.get("web") or a["anchor"]], home / "web_r3"))
                have = {c["photo"] for c in st["cands"]}
                new = [dict(c, anchor_switched=True) for c in judged(i, found, [], row=stand) if c["photo"] not in have]
                st["cands"] = sorted(st["cands"] + new, key=lambda c: -c["score"])
                st["round"] = 3 if passes(r, st["cands"]) else 0
                st["anchor"] = a
                st["complete"] = not any(c.get("unjudged") for c in st["cands"])
            st["r3"] = st.get("complete", True)       # a failed judge call is asked again next run
            _dump(home / "pick.json", st)
            return st

        with ThreadPoolExecutor(max_workers=10) as ex:
            for i, st in zip(failing, ex.map(third_round, failing)):
                states[i] = st
    found = [st["cands"] for st in states]

    # borrowing: a shot still without its own picture may take a strong photo found for a shot beside it — but only
    # after the judge has looked at it again against THIS line (it was judged for another one: a 'neighbour' step that
    # skipped this put a wrong person or an off-topic picture on 23 of 55 shots, audit 2026-10-08)
    def borrow(i):
        r, home, st = rows[i], home_of(rows[i]), states[i]
        if passes(r, st["cands"]) or _contextual(r, st["cands"]):
            return []
        pool, have = [], {c["photo"] for c in st["cands"]}
        for k in (i - 1, i + 1, i - 2, i + 2):
            if 0 <= k < len(rows):
                for c in found[k]:
                    if usable(rows[k], c, 6.0) and c["photo"] not in have and c["photo"] not in {x["photo"] for x in pool}:
                        pool.append(c)
        pool = sorted(pool, key=lambda c: -c["score"])[:6]
        if not pool:
            return []
        bkey = _hash([PICK_V, film_key, r["text"], [c["photo"] for c in pool]])
        if (st.get("borrow") or {}).get("key") == bkey:
            return st["borrow"]["cands"]
        again = [dict(c, anchor_switched=True, borrowed=True, stand_in=bool(st.get("stand_in")))
                 for c in judged(i, [(c, Path(c["photo"])) for c in pool], [])]
        st["borrow"] = {"key": bkey, "cands": again}
        if not any(c.get("unjudged") for c in again):
            _dump(home / "pick.json", st)
        return again

    with ThreadPoolExecutor(max_workers=10) as ex:
        borrowed = list(ex.map(borrow, range(len(rows))))

    # what has been shown: the same photograph (same bytes, or within a few bits of each other) and the same view of
    # the same subject (the judge's 'subject' words) are counted, so one tourist photo of one hall cannot carry five
    # beats (audit 2026-10-08: the same file 4 times, the same hall in 5 shots)
    sha, hashes, shown_sig, subj_n, subj_last = {}, {}, {}, {}, {}
    def sig(p):
        if p not in sha:
            try:
                sha[p] = hashlib.sha1(Path(p).read_bytes()).hexdigest()
            except OSError:
                sha[p] = p
        return sha[p]

    def h_of(p):
        if p not in hashes:
            try:
                hashes[p] = photofx._phash(p)
            except Exception:                                        # noqa: BLE001
                hashes[p] = None
        return hashes[p]

    def seen(p):
        n = shown_sig.get(sig(p), [0, -99])[0]
        h = h_of(p)
        if h is not None:
            for q, (m, _) in shown_sig.items():
                hq = hashes.get(next((x for x, s in sha.items() if s == q), ""), None)
                if hq is not None and photofx._same_photo(h, hq):
                    n = max(n, m)
        return n

    def varied(c, i, gap=SUBJECT_GAP):
        s = c.get("subject") or ""
        return not s or (subj_n.get(s, 0) < SUBJECT_MAX and i - subj_last.get(s, -99) > gap)

    picked, steps = [], {}
    dark_first = lambda cs: sorted(cs, key=lambda c: _luma(Path(c["photo"])) > TITLE_CEILING["P03"])
    for i, (r, cands) in enumerate(zip(rows, found)):
        dev = r.get("device") or {}
        bar = _need(r)
        new_ok = lambda c: seen(c["photo"]) == 0 and varied(c, i)
        fresh = [c for c in cands if usable(r, c, bar) and new_ok(c)]
        if i == 0:                                    # the opening title wants a picture dark enough for it
            fresh = [c for c in dark_first(fresh) if c["score"] >= 6] + [c for c in fresh if c["score"] < 6]
        ctx = [dict(c, contextual=True) for c in _contextual(r, cands) if new_ok(c) and c not in fresh]
        if i == 0:
            ctx = dark_first(ctx)
        near = [c for c in borrowed[i] if usable(r, c, bar) and new_ok(c)]
        options = ([(c, "anchor" if c.get("anchor_switched") else "exact") for c in fresh]
                   + [(c, "contextual") for c in ctx] + [(c, "neighbour") for c in near])
        pick, step = None, None
        about_him = bool(states[i].get("stand_in"))
        if about_him:
            # a line about a person of whom no likeness exists: the viewer gets a PERSON of his role to picture him
            # by (owner 2026-10-08) — a real photo first, else (unless the shot before already showed one) an AI
            # stand-in of the same fixed look, and only then a picture of what he reads or where he is
            people = [(c, st) for c, st in options if c.get("person")]
            if people:
                pick, step = people[0]
            elif not (picked and picked[-1][0] == i - 1 and (picked[-1][1].get("person") or picked[-1][1].get("ai"))) \
                    and dev.get("id") not in ("chapter-title", "highlight-page"):
                pick = _ai_picture(engine, job, r, i, dossier, states[i].get("stand_in", ""),
                                   states[i].get("stand_look", ""), *around(i))
                step = "ai" if pick else None
        if pick is None and options:                  # 1-3. own exact/anchor, contextual, a neighbour's re-judged photo
            pick, step = options[0]
        if pick is None and not about_him and dev.get("id") not in ("chapter-title", "highlight-page"):
            pick = _ai_picture(engine, job, r, i, dossier, states[i].get("stand_in", ""),
                               states[i].get("stand_look", ""), *around(i))      # 4. an AI stand-in (cap, checked)
            step = "ai" if pick else None
        if pick is None:                              # 5. an unused, unflagged photo of this line, even a weak one:
            # a new picture beats a repeat (audit v5: 20 repeats from 9 shots back, few of them fitting their new line)
            weak = [c for c in cands + borrowed[i] if c["score"] >= 5 and c.get("depiction") != "unrelated"
                    and not c.get("flags") and _studio_ok(r, c) and seen(c["photo"]) == 0 and varied(c, i, gap=3)]
            if weak:
                pick, step = dict(sorted(weak, key=lambda c: -c["score"])[0], contextual=True), "contextual"
        if pick is None:                              # 6. last: a photo shown before, never close by, at most twice
            again = [c for c in cands + borrowed[i] if usable(r, c, bar) and seen(c["photo"]) < 2
                     and i - shown_sig.get(sig(c["photo"]), [0, -99])[1] > 8 and varied(c, i, gap=8)]
            back = [p for k, p in reversed(picked) if not p.get("ai") and p["score"] >= MIN_SCORE
                    and seen(p["photo"]) < 2 and i - k > 8 and varied(p, i, gap=8)]
            if not (again or back):                   # never a shot with no picture: a closer repeat before none
                back = [p for k, p in reversed(picked) if not p.get("ai") and p["score"] >= MIN_SCORE
                        and seen(p["photo"]) < 3 and i - k > 5]
            if again or back:
                pick, step = dict((again or back)[0], reused=True), "reused"
        r["pick"], r["step"], r["stand_in"] = pick, step, states[i].get("stand_in", "")
        r["spare"] = [c for c in cands if pick and c["photo"] != pick["photo"] and usable(r, c, MIN_SCORE)
                      and not c["studio"] and seen(c["photo"]) == 0][:3]
        if pick:
            n, _ = shown_sig.get(sig(pick["photo"]), [0, -99])
            shown_sig[sig(pick["photo"])] = [n + 1, i]
            h_of(pick["photo"])
            if pick.get("subject"):
                subj_n[pick["subject"]] = subj_n.get(pick["subject"], 0) + 1
                subj_last[pick["subject"]] = i
            picked.append((i, pick))
        steps[step] = steps.get(step, 0) + 1
    by_round = [sum(1 for st in states if st.get("round") == k) for k in (1, 2, 3)]
    engine.log(f"  pictures in {time.time() - t0:.0f}s (search rounds: 1 {by_round[0]}, 2 {by_round[1]}, 3 {by_round[2]}); "
               f"on screen: exact {steps.get('exact', 0)}, another anchor {steps.get('anchor', 0)}, contextual "
               f"{steps.get('contextual', 0)}, neighbour {steps.get('neighbour', 0)}, AI {steps.get('ai', 0)}, earlier photo "
               f"{steps.get('reused', 0)}, none {steps.get(None, 0)}; Brave requests {_BRAVE['requests'] - b0}")


AI_CHECK = """This is a GENERATED stand-in picture for one line of a documentary. Look at it hard and answer ONLY a
JSON object: {"text": true|false, "modern": true|false, "frame": true|false, "fits": 0-10, "why": "one sentence"}
text: PROMINENT writing — a sign, label, plaque, caption, title, or a page of letters in sharp focus that a viewer
  would try to read (legible or garbled). Faint, distant or out-of-focus script on old books or walls does NOT count.
modern: anything after the film's period (see below): modern clothes, lamps, furniture, devices.
frame: a fake border, burnt edges, a photo-frame, a vignette ring or a collage.
fits: how well it shows this line in the film's era, setting and tone (8 = an editor would keep it).
[FILM]
LINE: [LINE]"""


def _ai_ok(engine, dest: Path, row: dict, dossier: dict) -> tuple:
    """(ok, why): a generated picture is used only with no visible writing, nothing modern, no fake frame, and a
    fit of 5+ (audit 2026-10-08: garbled pseudo-script on 'manuscripts', burnt photo borders, a cardigan for a priest)."""
    prompt = (AI_CHECK.replace("[FILM]", _film_block(dossier)).replace("[LINE]", row.get("text", ""))
              + f"\nintended picture: {row.get('visualIntent', '')}")
    try:
        raw = engine.pick_vision(prompt, [str(_small(dest))], max_tokens=4000, model=JUDGE_MODEL, thinking=JUDGE_THINKING)
        x = json.loads(re.search(r"\{.*\}", raw, re.DOTALL).group(0))
    except Exception as e:                                           # noqa: BLE001 - unchecked: not used
        return False, f"not checked ({str(e)[:60]})"
    yes = lambda v: v is True or str(v).strip().lower() == "true"
    try:
        fits = float(x.get("fits", 0))
    except (TypeError, ValueError):
        fits = 0.0
    bad = [k for k in ("text", "modern", "frame") if yes(x.get(k))]
    return (not bad and fits >= 5), (", ".join(bad) or f"fits {fits:g}") + f" — {str(x.get('why') or '')[:100]}"


def _ai_picture(engine, job: Path, row: dict, i: int, dossier: dict = None, role: str = "", look: str = "",
                before: str = "", after: str = ""):
    """A generated stand-in in the film's own look (the visual brief's aiLook, period, setting and tone). A person in it
    is an anonymous figure of the role with the brief's fixed appearance, so the same man does not change face from
    shot to shot. Nothing written is ever visible. Each drawing is checked (_ai_ok) and drawn once more if it fails;
    a picture that still fails is not used. Never carries a name on screen."""
    dossier = dossier or {}
    b = dossier.get("visualBrief") or {}
    about_him = bool(role)                        # the line is about him: he is the picture's subject
    if not role:                                  # the film's one unphotographed protagonist, if a person appears
        nophoto = [p for p in b.get("people") or [] if not p.get("likenessKnown")]
        if len(nophoto) == 1:
            role, look = nophoto[0].get("role", ""), nophoto[0].get("appearance", "")
    era = "; ".join(x for x in (dossier.get("period"), dossier.get("setting")) if x)
    who = (f" If a person appears, it is {role}{(' — ' + look) if look else ''}: anonymous, not a real identifiable "
           f"person, period-correct dress, seen from the side or behind or in shadow." if role else
           " Any person is anonymous, period-correct, not a real identifiable person.")
    base = (f"{b.get('aiLook') or 'Documentary archive photograph, natural light'}. 16:9, full-bleed. "
            f"{('Era and place: ' + era + '. ') if era else ''}{('Mood: ' + b['tone'] + '. ') if b.get('tone') else ''}"
            f"{row.get('visualIntent') or row['text']}.{who} ")
    if about_him:                                 # a line about him: a portrait or at-work picture of the man
        base = base.replace(f"{row.get('visualIntent') or row['text']}.",
                            f"A photograph of {role}{(' — ' + look) if look else ''}, the main subject of the frame "
                            f"(portrait or at work), for the line: {row['text']}.")
    tries = [base + "Very shallow depth of field: the subject sharp, every page, book and wall softly out of focus so "
                    "no letter can be read. No signs, labels, plaques or captions. No border, no frame, no burnt edges, "
                    "nothing modern.",
             # the line's intent often names a manuscript and the model draws its letters anyway: drop the intent
             f"{b.get('aiLook') or 'Documentary archive photograph, natural light'}. 16:9, full-bleed. "
             f"{('Era and place: ' + era + '. ') if era else ''}{('Mood: ' + b['tone'] + '. ') if b.get('tone') else ''}"
             + (f"{role}{(' — ' + look) if look else ''}, alone in a dim stone corridor or archive aisle, lost in "
                f"thought, seen from the side; anonymous, not a real identifiable person. " if about_him else
                f"{row.get('visualIntent') or row['text']} — shown only through closed objects: a shut book's worn "
                f"cover, spine, clasps or binding, seals, cords, stone, candlelight and shadow. ")
             + "No book open, no page, document, sign or screen in view. No border or frame. Nothing modern."]
    home = job / "mrtruth" / "pictures" / ("s" + hashlib.sha1(row["text"].encode()).hexdigest()[:14])
    for k, prompt in enumerate(tries):
        dest = home / f"ai_{hashlib.sha1(prompt.encode()).hexdigest()[:8]}.jpg"
        verdict = home / (dest.stem + ".check.json")
        if dest.exists():
            try:
                engine.ai_image_slot(f"mrtruth shot {i}")     # one drawn earlier still counts against this video's cap
            except Exception:                                        # noqa: BLE001 - AIImageCapReached
                return None
        else:
            try:
                engine.image_gen(prompt, dest, label=f"mrtruth shot {i}")
            except Exception as e:                                   # noqa: BLE001 - next step: an earlier photo
                engine.log(f"    shot {i}: no AI picture — {str(e)[:80]}")
                return None
        got = _load(verdict)
        if not got:
            ok, why = _ai_ok(engine, dest, row, dossier)
            got = {"ok": ok, "why": why}
            if not why.startswith("not checked"):
                _dump(verdict, got)
        if got["ok"]:
            break
        engine.log(f"    shot {i}: AI picture refused ({got['why'][:90]}){' — drawing it again' if not k else ''}")
    else:
        return None
    return {"photo": str(dest), "title": "AI picture", "url": "", "source": "ai", "license": "generated",
            "score": 5.0, "anchor": (0.5, 0.5), "ai": True, "studio": False, "subject": ""}


def _record_names(pick: dict, label: str) -> bool:
    """The picture's own archive record (its title or address) carries at least one content word of the label —
    a name printed on a photograph must be a name that photograph is filed under (the repo's T-8, kept loose)."""
    record = set(_content(f"{pick.get('title', '')} {pick.get('url', '')}".replace("_", " ").replace("-", " ")))
    words = _content(label)
    return not words or any(w in record or (w.endswith("'s") and w[:-2] in record) for w in words)


PEOPLE_NAMES = set()        # the film's people (surnames and full names, lower case), set before _fit_devices


def _names_person(dev: dict) -> bool:
    text = " ".join(str(v) for k, v in dev.items() if k != "id" and isinstance(v, str)).lower()
    return any(re.search(rf"\b{re.escape(n)}\b", text) for n in PEOPLE_NAMES if len(n) >= 4)


def _fit_devices(rows: list) -> None:
    """What the pictures allow: no words that name a picture on an AI frame, a weak one or one found for another
    anchor (T-8/T-10), a name only where the archive record carries it, no type on ground too bright or busy for it
    (T-7/T-26), the companions a multi-picture template needs. A refused template falls down its chain (through
    the same checks as any placement) or the shot stays a clean photograph."""
    for i, r in enumerate(rows):
        dev, pick = r.get("device"), r.get("pick")
        if not dev:
            continue
        tid = dev["id"]
        if pick is None and LIBRARY[tid][1] > 0:
            DEV_DROPS.append((i, tid, "no picture"))
            r["device"] = None
            continue
        # a label that names the picture is refused only where it would name the WRONG thing: a different, identifiable
        # person, or a picture unrelated to the line. A stand-in (real or AI) of the person the line is about, or a
        # picture of the same kind of place or thing, carries the label (owner 2026-10-08)
        if tid in NAMES_PICTURE and pick is not None and _names_person(dev) and not (pick.get("person") or pick.get("ai")):
            # a person's name over a picture with no person in it (owner 2026-10-09: "Emilio Restivo" on a library)
            if tid != "framed-card" and i:
                _fall_back(rows, i, tid, "names a person over a picture with no person in it")
            else:
                DEV_DROPS.append((i, tid, "names a person over a picture with no person in it"))
                r.update(device=None)
            continue
        if tid in NAMES_PICTURE and pick is not None:
            other_person = pick.get("person") and not r.get("stand_in") and pick.get("depiction") != "named-subject"
            if other_person or pick.get("depiction") == "unrelated":
                why = "a different person" if other_person else "an unrelated picture"
                if tid != "framed-card" and i:
                    _fall_back(rows, i, tid, f"names its picture, which shows {why}")
                else:
                    DEV_DROPS.append((i, tid, f"names its picture, which shows {why}"))
                    r.update(device=None)
                continue
        if pick is not None and pick.get("ai") and tid == "P03" and i:
            DEV_DROPS.append((i, tid, "AI picture"))
            r["device"] = None
            continue
        if pick is not None and tid == "P05" and dev.get("imageLabel") and not _record_names(pick, dev["imageLabel"]):
            dev["imageLabel"] = ""
        ceil = TITLE_CEILING.get(tid)
        band, band_ceil = TYPE_BAND.get(tid, (None, None))
        if pick is not None and i and (band or ceil):
            # measured as the viewer sees it (the shadow look dims the picture), and never refused for it any more:
            # the strip under the type is shaded until white letters read on it (owner 2026-10-08)
            shade = _type_shade(Path(pick["photo"]), band or (0.0, 0.0, 1.0, 1.0), band_ceil or ceil, tid == "shadow-up")
            if shade:
                r["type_shade"] = (band or (0.05, 0.05, 0.95, 0.95), shade)
                DEV_DROPS.append((i, tid, f"text area too bright: shaded {shade:.0%} instead of refused"))
        if tid == "P17" and pick is not None:
            ax, ay = pick.get("anchor") or (0.5, 0.5)       # the leader points at the subject; the plate sits opposite
            dev.update(anchorX=round(ax, 3), anchorY=round(ay, 3), labelX=round(ax - 0.24 if ax > 0.5 else ax + 0.24, 3),
                       labelY=round(min(0.8, max(0.15, ay - 0.25)), 3))
        need = LIBRARY[tid][1] - 1
        if tid == "gallery-strip":
            ahead = [x for k, x in enumerate(rows) if k > i and x.get("pick") and not x["pick"].get("ai")
                     and x["startMs"] - r["endMs"] >= 60000 and x["pick"]["score"] >= 6]
            pool = []
            for x in ahead:
                if _distinct(x["pick"]["photo"], [p["photo"] for p in pool]):
                    pool.append(x["pick"])
                if len(pool) == 4:
                    break
            if len(pool) < 4:
                DEV_DROPS.append((i, tid, f"only {len(pool)} of 4 gallery pictures"))
                r["device"] = None
                continue
            r["companions"] = list(reversed(pool))       # the camera opens on card 4 and travels to card 1 (T-17)
        elif need > 0:
            spare = []
            pool = list(r.get("spare") or [])
            if not (r.get("stand_in") or _names_thing(r)):
                for k in (i - 1, i + 1, i - 2, i + 2, i - 3, i + 3, i - 4, i + 4, i - 5, i + 5, i - 6, i + 6):
                    if 0 <= k < len(rows):
                        pool += list(rows[k].get("spare") or [])
            for x in pool:
                if len(spare) < need and _distinct(x["photo"], [pick["photo"]] + [s["photo"] for s in spare]):
                    spare.append(x)
            if len(spare) < need:
                _fall_back(rows, i, tid, f"{len(spare)} of {need} companion pictures")
                continue
            r["companions"] = spare[:need]


# ── 5b. the typed caption (renderer TypedCaption.tsx), owner ruling 2026-10-08 ─────────────────────────────────
TC_MAX, TC_FIRST_S, TC_GAP_S, TC_MIN_START_S = 5, 60.0, 25.0, 3.0
TC_LINE_MAX, TC_TOTAL_MAX = 28, 55
TC_RATES = (25.0, 21.0)                 # letters a second, line 1 / line 2 (matched to the reference)
# the picture animations (owner 2026-10-09): the shadow look stays off them; text overlays keep it
ANIMATIONS = {"gallery-strip", "P22", "P19", "two-photo-zoom", "photo-pop", "framed-card", "P08", "P05",
              "bullet-checklist", "highlight-page"}
TC_SCRIM_LUMA = 0.42                    # above this mean brightness the corner behind the caption is darkened
TC_READ_S = 1.3                         # the finished caption stays at least this long before the shot ends

TC_PROMPT = """You are placing TYPED CAPTIONS on a photo documentary: a short serif label that types itself in at the
bottom left while the narrator speaks, like a museum caption. It names the key FACT being said at that moment.

THE RULES (the channel owner's; follow them exactly)
- Choose between 3 and {most} moments for the whole film. The FIRST must start before {first:.0f} s. Any two must be at
  least {gap:.0f} s apart. Never in the first {lead:.0f} s.
- What deserves one, in this order: (1) a person introduced - name and role; (2) a place or institution with a date;
  (3) a key event or decision; (4) a key document or object; (5) a striking fact or number. Never filler, a question,
  or a dramatic line without a fact in it.
- SUMMARISE, do not transcribe: the narrator says "He was a translator working under Vatican Apostolic Library
  authorization" -> the caption is "A Translator Under" / "Apostolic Library Authority".
- 1 or 2 lines, 2-8 words a line, at most {line} characters a line, at most {total} characters in all. Title Case,
  no full stop. "Thing - Place, Date" with a spaced hyphen when it fits ("Removed from the Bible -" /
  "Council of Laodicea, 364 CE"). Dates as "364 CE", "1980s", "c. 1100".
- Only facts this script states. Spell names correctly even where the line below is misspelled.
- No two captions say the same thing.
- Choose the SHOT on whose line the summarised phrase BEGINS (the caption starts typing with that shot). Shots marked
  [TAKEN] already carry another on-screen template: never choose one; take the nearest free shot of the same
  sentence instead, or another moment.

THE FILM (shot number, start second, the words spoken on it):
{shots}

Return {{"captions": [{{"shot": <number>, "lines": ["line 1", "optional line 2"], "why": "short reason"}}]}}"""


def _tc_need_s(lines: list) -> float:
    """Seconds a caption needs on screen: the 0.27 s lead, typing both lines, then TC_READ_S of reading."""
    return TYPED_CAPTION_START_F / FPS + sum(len(ln) / TC_RATES[min(k, 1)] for k, ln in enumerate(lines)) + TC_READ_S


def typed_captions(engine, job: Path, rows: list, script: str, force: bool = False) -> None:
    """Up to TC_MAX typed captions, the first inside TC_FIRST_S, on plain photo shots. A caption's shot is held for
    as long as the caption needs: the shots after it on screen are folded into it (their words stay spoken, under
    the same picture). Writes row["typedCaption"]."""
    out = job / "mrtruth" / "typed_captions.json"
    key = _hash([TC_PROMPT, [(r["text"], bool(r.get("device") or r.get("section_turn"))) for r in rows]])
    got = None if force else _load(out)
    if not (isinstance(got, dict) and got.get("key") == key):
        shots = "\n".join(f"{i}\t{r['startMs'] / 1000:.1f}\t" + ("[TAKEN] " if r.get("device") or r.get("section_turn") else "")
                           + r["text"] for i, r in enumerate(rows))
        prompt = TC_PROMPT.format(most=TC_MAX, first=TC_FIRST_S, gap=TC_GAP_S, lead=TC_MIN_START_S, line=TC_LINE_MAX,
                                  total=TC_TOTAL_MAX, shots=shots)
        try:
            got = {"key": key, "captions": _ask(engine, prompt, 6000, model=engine.SCRIPT_MODEL).get("captions") or []}
        except RuntimeError as e:
            engine.log(f"  typed captions: {e}")
            return
        _dump(out, got)
    texts = [r["text"] for r in rows]
    placed, last = [], -1e9
    for c in sorted(got["captions"], key=lambda c: int(c.get("shot", -1))):
        try:
            i = int(c["shot"])
        except (KeyError, TypeError, ValueError):
            continue
        lines = [re.sub(r"\s+", " ", str(x)).strip().rstrip(".") for x in (c.get("lines") or []) if str(x).strip()][:2]
        if not (0 <= i < len(rows)) or rows[i]["text"] != texts[i] or not lines:
            continue
        if rows[i].get("device") or rows[i].get("section_turn"):      # the next free shot, still inside 4 s
            i = next((k for k in (i + 1, i - 1, i + 2) if 0 <= k < len(rows) and not rows[k].get("device")
                      and not rows[k].get("section_turn") and abs(rows[k]["startMs"] - rows[i]["startMs"]) <= 4000), i)
        r = rows[i]
        why = ""
        if any(len(ln) > TC_LINE_MAX + 2 for ln in lines) or sum(map(len, lines)) > TC_TOTAL_MAX + 3:
            why = "too long"
        elif r.get("device") or r.get("section_turn"):
            why = "shot carries a template"
        elif r["startMs"] < TC_MIN_START_S * 1000:
            why = "inside the opening"
        elif r["startMs"] - last < TC_GAP_S * 1000:
            why = "too close to the last caption"
        elif len(placed) >= TC_MAX:
            why = "over the limit"
        if why:
            engine.log(f"      typed caption '{' / '.join(lines)}' on shot {i} skipped ({why})")
            continue
        placed.append((i, lines))
        last = r["startMs"]
    if placed and rows[placed[0][0]]["startMs"] > TC_FIRST_S * 1000:
        engine.log(f"      typed caption: the first lands at {rows[placed[0][0]]['startMs'] / 1000:.0f}s, after {TC_FIRST_S:.0f}s")
    # hold each caption's picture as long as it needs: fold the following shots into it (last first, so indexes hold)
    for i, lines in sorted(placed, key=lambda p: -p[0]):
        r = rows[i]
        need_ms = _tc_need_s(lines) * 1000
        while r["endMs"] - r["startMs"] < need_ms and i + 1 < len(rows):
            nxt = rows[i + 1]
            if nxt.get("section_turn") or nxt.get("typedCaption"):
                engine.log(f"      typed caption at {r['startMs'] / 1000:.0f}s cannot be held longer (a chapter or caption follows)")
                break
            if nxt.get("device"):            # the caption is mandatory, a template is not: it gives way
                engine.log(f"      template {nxt['device']['id']} at {nxt['startMs'] / 1000:.0f}s gives way to a typed caption")
            r["endMs"] = nxt["endMs"]
            r["held"] = r.get("held", []) + [nxt["text"]] + nxt.get("held", [])
            del rows[i + 1]
        r["typedCaption"] = {"lines": lines, "startFrame": TYPED_CAPTION_START_F}
        if r["endMs"] - r["startMs"] < need_ms:
            engine.log(f"      typed caption at {r['startMs'] / 1000:.0f}s is {(need_ms - r['endMs'] + r['startMs']) / 1000:.1f}s short")
        engine.log(f"      typed caption at {r['startMs'] / 1000:.0f}s for {(r['endMs'] - r['startMs']) / 1000:.1f}s: "
                   f"{' / '.join(lines)}")


# ── 5c. every overlay lands on the word it shows (owner 2026-10-09: cards were seconds early) ─────────────────────
SYNC_LEAD_MS = 150          # the overlay starts this much before its first word is heard
SYNC_TOLERANCE_MS = 400     # closer than this is left alone
SYNC_MIN_SHOT_MS = 1000     # no shot is squeezed below this when its neighbours are retimed
_SYNC_STOP = JOINING | {"his", "her", "its", "was", "were", "is", "are", "be", "been", "had", "has", "have", "that", "this",
                        "it", "he", "she", "they", "them", "not", "but", "or", "as", "so", "what", "which", "who", "one"}


def _overlay_words(r: dict) -> list:
    dev, tc = r.get("device") or {}, r.get("typedCaption") or {}
    text = " ".join([str(v) for k, v in dev.items() if k != "id" and isinstance(v, str)]
                    + [str(x) for v in dev.values() if isinstance(v, list) for x in v if isinstance(x, str)]
                    + list(tc.get("lines") or []))
    return [w.strip("'") for w in _content(text) if len(w.strip("'")) >= 3 and w.strip("'") not in _SYNC_STOP]


def _heard(job: Path, cues: list) -> list:
    """[(ms, word)] for every word of the voice: the recogniser's own timings when the job has them, else the
    subtitle words spread across their cue."""
    f = job / "words_heard.json"
    try:
        return [(int(a * 1000), re.sub(r"[^a-z0-9']", "", str(w).lower())) for w, a, b in json.loads(f.read_text())]
    except Exception:                                                # noqa: BLE001
        return [(int(ms), re.sub(r"[^a-z0-9']", "", w.lower())) for ms, w in _word_times(cues)]


def _spoken_at(words: list, heard: list, lo: int, hi: int):
    """The ms where the overlay's words are heard as a group inside [lo, hi], or None. A label of one or two words
    needs one of them; a longer one needs two of its words within six seconds. Words match by stem."""
    if not words:
        return None
    want = set(words)

    def same(h, w):                     # a caption paraphrases: photography ~ photographed, doctrine ~ doctrinal
        if h == w:
            return True
        n = len(os.path.commonprefix([h, w]))
        return min(len(h), len(w)) >= 4 and n >= max(4, min(len(h), len(w)) - 3)

    which = lambda h: next((w for w in want if same(h, w)), None)
    hits = [(ms, which(h)) for ms, h in heard if lo <= ms <= hi and h and which(h)]
    need = 1 if len(want) <= 2 else 2          # a two-word label is placed by its one distinctive word
    best = None
    for k, (ms, _) in enumerate(hits):
        got = {w for m2, w in hits[k:] if m2 - ms <= 6000}
        if len(got) >= need and (best is None or len(got) > best[1]):
            best = (ms, len(got))
    return best[0] if best else None


SYNC_MAX_LATE_MS = 1500     # an overlay crowded by the one before may start this much after its word, no more
_SYNC_RANK = {"P03": 9, "chapter-plate": 8, "typed caption": 7, "corner-label": 5, "P04": 5, "P17": 5, "P12": 4}


def sync_overlays(engine, job: Path, rows: list, cues: list) -> None:
    """Every text overlay and typed caption starts when its words are heard (SYNC_LEAD_MS before), however the planner
    seated it. The film is re-cut around them: each overlay shot is pinned to its word and lasts at least what its
    animation needs; the plain shots between two overlays keep their order and share the time between them. Two
    overlays whose words come too close for both: the later one starts up to SYNC_MAX_LATE_MS late, else the lesser
    one goes. Plain shots that no longer fit are dropped (never below SYNC_MIN_SHOT_MS a shot)."""
    heard = _heard(job, cues)
    total = rows[-1]["endMs"]
    dev_id = lambda r: (r.get("device") or {}).get("id") or ("typed caption" if r.get("typedCaption") else "")
    # only overlays that SAY something are pinned; a wordless animation (photo pop, gallery, mosaic) rides with the
    # plain shots and only keeps the length its animation needs
    tid = lambda r: dev_id(r) if (r.get("typedCaption") or _overlay_words(r) or r is rows[0] and dev_id(r)) else ""
    need = lambda r: int(1000 * (_tc_need_s(r["typedCaption"]["lines"]) if r.get("typedCaption") else _need_s(dev_id(r))))
    floor = lambda x: need(x) if dev_id(x) else SYNC_MIN_SHOT_MS
    anchors = []                                  # [row, target ms]
    for k, r in enumerate(rows):
        if not tid(r):
            continue
        if k == 0:
            anchors.append([r, 0])
            continue
        at = _spoken_at(_overlay_words(r), heard, r["startMs"] - 12000, r["endMs"] + 12000)
        if at is None and tid(r) != "chapter-plate":
            # words the narrator does not say anywhere near: never on screen out of step with the voice
            engine.log(f"      {tid(r)} at {r['startMs'] / 1000:.1f}s dropped: its words are not said near it")
            r.pop("typedCaption", None)
            r["device"] = None
            continue
        anchors.append([r, max(0, at - SYNC_LEAD_MS) if at is not None else r["startMs"]])
    kept = []
    for r, t in anchors:                          # resolve crowding in film order
        if kept:
            p, pt = kept[-1]
            free = pt + need(p)
            if t < free:
                if free - t <= SYNC_MAX_LATE_MS:
                    t = free
                else:
                    loser = r if _SYNC_RANK.get(tid(r), 1) <= _SYNC_RANK.get(tid(p), 1) else p
                    engine.log(f"      {tid(loser)} at {loser['startMs'] / 1000:.1f}s dropped: its words come too close to another overlay's")
                    loser.pop("typedCaption", None)
                    loser["device"] = None
                    if loser is p:
                        kept.pop()
                        if kept and t < kept[-1][1] + need(kept[-1][0]):
                            t = kept[-1][1] + need(kept[-1][0])
                    else:
                        continue
        kept.append([r, t])
    if not kept:
        return
    moved = sum(1 for r, t in kept if abs(r["startMs"] - t) > SYNC_TOLERANCE_MS)
    # lay the film out again: [plain shots] anchor [plain shots] anchor ... [plain shots]
    pos = {id(r): k for k, r in enumerate(rows)}
    out, cursor, prev_k = [], 0, -1
    marks = [(r, t) for r, t in kept] + [(None, total)]
    for n, (r, t) in enumerate(marks):
        k = pos[id(r)] if r is not None else len(rows)
        plain = [x for x in rows[prev_k + 1:k] if not tid(x)]
        # the previous anchor (already in out) may run on; the plain shots between share what it leaves
        span = t - cursor
        if out and out[-1] is marks[n - 1][0]:
            a = out[-1]
            want = max(need(a), min(a["endMs"] - a["startMs"], span))
            while plain and span - want < sum(floor(x) for x in plain):
                plain.remove(min(plain, key=lambda x: (bool(dev_id(x)), x["endMs"] - x["startMs"])))
            a_end = cursor + (want if plain else span)
            a["endMs"] = int(a_end)
            cursor = a_end
            span = t - cursor
        else:
            while plain and span < sum(floor(x) for x in plain):
                plain.remove(min(plain, key=lambda x: (bool(dev_id(x)), x["endMs"] - x["startMs"])))
        if plain:
            tot = sum(x["endMs"] - x["startMs"] for x in plain) or 1
            spare = span - sum(floor(x) for x in plain)
            at = cursor
            for j, x in enumerate(plain):
                w = floor(x) + (x["endMs"] - x["startMs"]) * spare / tot
                x["startMs"], x["endMs"] = int(at), int(t if j == len(plain) - 1 else at + w)
                at += w
                out.append(x)
            cursor = t
        elif out and span > 0:                    # nothing between: the shot before runs on to the word
            out[-1]["endMs"] = int(t)
            cursor = t
        if r is not None:
            r["startMs"] = int(cursor)
            out.append(r)
        prev_k = k
    out[-1]["endMs"] = total
    dropped = len(rows) - len(out)
    rows[:] = out
    engine.log(f"  overlays on their words: {len(kept)} pinned ({moved} moved), {dropped} plain shots folded away")


# ── 6. the scenes, as the repo's compositor reads them ────────────────────────────────────────────────────────
def _content_draw(text: str) -> float:
    return int(hashlib.sha256(text.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def transitions(rows: list) -> None:
    """transitionIn/Out per shot: a dip to black at a section turn, then (keyed on each shot's own words, never
    periodic) a film burn, flash, push or slide at the repo's shares; everything else a hard cut."""
    last_burn, run = -1e9, 0
    burns_by_min = {}
    for i, r in enumerate(rows):
        r["tin"], r["tout"] = {"type": "cut", "durationFrames": 0}, None
        if i == 0:
            continue
        u = _content_draw(r["text"] + str(i))
        t = r["startMs"] / 1000.0
        dev = (r.get("device") or {}).get("id")
        if r.get("section_turn") or dev == "chapter-title":
            r["tin"] = {"type": "dipToBlack", "durationFrames": DIP_FRAMES}
            run = 0
            continue
        minute = int(t // 60)
        if (u < BURN_SHARE and t - last_burn >= BURN_GAP_S and burns_by_min.get(minute, 0) < BURN_PER_MIN
                and run < BURN_MAX_RUN and (r["endMs"] - r["startMs"]) / 1000 * FPS > BURN_IN + 2
                and (rows[i - 1]["endMs"] - rows[i - 1]["startMs"]) / 1000 * FPS > BURN_OUT + 2):
            r["tin"] = {"type": "filmBurn", "durationFrames": BURN_IN, "clip": "burn02"}
            rows[i - 1]["tout"] = {"type": "filmBurn", "durationFrames": BURN_OUT, "clip": "burn02"}
            last_burn, run = t, run + 1
            burns_by_min[minute] = burns_by_min.get(minute, 0) + 1
            continue
        run = 0
        v = _content_draw(r["text"][::-1] + str(i))
        # push and slide move one plain photograph off and the next on: never into or out of a template's own ground
        prev_pic = rows[i - 1].get("pick") and not rows[i - 1].get("device") and not r.get("device")
        if v < FLASH_SHARE:
            r["tin"] = {"type": "flash", "durationFrames": FLASH_FRAMES}
        elif v < FLASH_SHARE + PUSH_SHARE and prev_pic and r.get("pick"):
            r["tin"] = {"type": "pushCut", "durationFrames": PUSH_FRAMES}
        elif v < FLASH_SHARE + PUSH_SHARE + SLIDE_SHARE and prev_pic and r.get("pick"):
            r["tin"] = {"type": "slide", "durationFrames": SLIDE_FRAMES}


_MOVES = [(1.0, 1.08, -0.15, 0.0, 0.0, 0.0), (1.1, 1.02, 0.0, 0.12, 0.04, 0.0), (1.02, 1.1, 0.12, -0.08, 0.0, -0.04),
          (1.08, 1.0, -0.1, 0.05, 0.0, 0.03), (1.0, 1.09, 0.0, 0.0, 0.06, -0.02)]


def _key(path: str) -> str:
    """A storage key the compositor accepts: p/<hash>.jpg under the job's mrtruth/storage."""
    return f"p/{hashlib.sha1(str(path).encode()).hexdigest()[:20]}{Path(path).suffix.lower() or '.jpg'}"


def _stage(storage: Path, path: str) -> str:
    key = _key(path)
    dest = storage / key
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
    return key


def _asset(storage: Path, pick: dict) -> dict:
    key = _stage(storage, pick["photo"])
    url = pick.get("url") or ""
    return {"path": key, "contentHash": _hash(key), "type": "image",
            "sourceUrl": url if url.startswith("https://") else "https://commons.wikimedia.org/",
            "license": str(pick.get("license") or "")[:200], "attribution": str(pick.get("title") or "")[:500],
            "vision": None, "generator": "movefast-ai" if pick.get("ai") else None, "sourceBeatId": None}


def _word_times(cues: list) -> list:
    """[(ms, word)] for every subtitle word, spread across its cue (the subtitles are the script's own words)."""
    out = []
    for a, b, txt in cues or []:
        ws = txt.split()
        out += [(a + (b - a) * k / max(1, len(ws)), w) for k, w in enumerate(ws)]
    return out


def scenes(rows: list, storage: Path, cues: list = None) -> list:
    """The PlannedScene list (packages/core/src/schemas.ts); the compositor validates each with zod."""
    out, frame, dusty = [], 0, []
    spoken = _word_times(cues)
    for i, r in enumerate(rows):
        end = int(round(r["endMs"] / 1000 * FPS))
        n = max(1, end - frame)
        pick, dev = r.get("pick"), r.get("device")
        if not pick and (dev or {}).get("id") in ("chapter-title", "highlight-page"):
            pick = next((x["pick"] for x in rows[max(0, i - 3):i + 4] if x.get("pick")), None) or next(
                (x["pick"] for x in reversed(rows[:i]) if x.get("pick")), None)
            if pick is None:
                dev = None
        if pick and dev and r.get("type_shade"):         # the strip under the type, darkened (see _fit_devices)
            band, k = r["type_shade"]
            pick = dict(pick, photo=_shaded_copy(pick["photo"], band, k))
        m = _MOVES[int(_content_draw(r["text"]) * len(_MOVES))]
        ax, ay = (pick or {}).get("anchor") or (0.5, 0.5)
        r["_move"], r["_anchor"] = m, (ax, ay)
        prev = rows[i - 1].get("pick") if i else None
        sc = {"index": i, "startFrame": frame, "durationFrames": n, "sceneType": "imagery" if pick else "titleCard",
              "locked": False, "version": 1, "asset": _asset(storage, pick) if pick else None,
              "crop": {"mode": "fill", "anchor": {"x": round(float(ax), 3), "y": round(float(ay), 3)}},
              "motion": {"type": "kenBurns", "fromScale": m[0], "toScale": m[1], "fromX": m[2], "toX": m[3],
                         "fromY": m[4], "toY": m[5], "easing": "linearOut"},
              "transitionIn": r.get("tin") or {"type": "cut", "durationFrames": 0}, "transitionOut": r.get("tout"),
              "prevAsset": None, "captions": [], "textCard": None, "overlay": r.get("overlay"), "device": dev,
              "companions": [_asset(storage, c) for c in r.get("companions") or []], "grade": dict(GRADE)}
        if sc["transitionIn"]["type"] in ("pushCut", "slide") and prev:
            pm = rows[i - 1].get("_move") or _MOVES[0]
            px, py = rows[i - 1].get("_anchor") or (0.5, 0.5)
            sc["prevAsset"] = {"path": _stage(storage, prev["photo"]), "contentHash": _hash(prev["photo"]),
                               "crop": {"mode": "fill", "anchor": {"x": round(float(px), 3), "y": round(float(py), 3)}},
                               "endScale": pm[1], "endX": pm[3], "endY": pm[5]}
        elif sc["transitionIn"]["type"] in ("pushCut", "slide"):
            sc["transitionIn"] = {"type": "cut", "durationFrames": 0}
        if not pick and (dev or {}).get("id") not in ("chapter-title", "highlight-page"):
            words = r["text"].split()[:14]
            phrase = " ".join(words)
            while len(phrase) > 85:
                words = words[:-1]
                phrase = " ".join(words)
            heard = [ms for ms, _ in spoken if r["startMs"] <= ms < r["endMs"]][:len(words)]
            step_f = max(2, min(8, int(n * 0.6 / max(1, len(words)))))
            at = lambda k: (int((heard[k] - r["startMs"]) / 1000 * FPS) if k < len(heard) else 4 + k * step_f)
            sc["textCard"] = {"pullPhrase": phrase, "eyebrow": "", "backgroundAssetPath": None,
                              "words": [{"text": w[:64], "startFrame": min(n - 1, max(0, at(k)))} for k, w in enumerate(words)]}
            sc["device"] = None
        if not dev and pick and not pick.get("ai") and n >= DUST_MIN_S * FPS:
            dusty.append((len(out), Path(pick["photo"]), n))
        if r.get("typedCaption") and not sc.get("textCard"):     # see typed_captions(); a bright picture gets a scrim
            tc = r["typedCaption"]
            sc["typedCaption"] = {"lines": [ln[:48] for ln in tc["lines"][:2]],
                                  "startFrame": int(tc.get("startFrame", TYPED_CAPTION_START_F)),
                                  "scrim": bool(pick and _luma(Path(pick["photo"])) > TC_SCRIM_LUMA)}
        out.append(sc)
        frame += n
    # the dust plate: on about DUST_SHARE of ALL shots, chosen among plain archive photographs (no AI picture, no
    # template) of 2 s or more, the 3 s+ ones first, darker before brighter, spread out
    want = round(DUST_SHARE * len(out))
    ranked = sorted(((at, _luma(photo), n) for at, photo, n in dusty),
                    key=lambda d: (d[2] < DUST_PREFER_S * FPS, d[1]))
    took, gap = set(), max(2, len(out) // max(1, 2 * want))     # spread across the film, not bunched in one stretch
    for at, lum, n in ranked:
        if len(took) >= want:
            break
        if any(abs(at - t) < gap for t in took):
            continue
        out[at]["ambience"] = {"clip": "dust", "durationFrames": n,
                               "shadow": DUST_SHADOW if lum >= DUST_SHADOW_MIN_LUMA else 0}
        took.add(at)
    # the light leak (owner 2026-10-09): about LEAK_SHARE of ALL shots, only on EMPTY pictures - no template, no
    # typed caption, no dust, no text card - of 2 s or more, the 3 s+ ones first, spread across the film
    for sc in out:
        if (sc.get("device") or {}).get("id") in ANIMATIONS:
            sc["grade"] = {k: v for k, v in sc["grade"].items() if k != "shadow"}
    want = round(LEAK_SHARE * len(out))
    empty = [k for k, sc in enumerate(out) if sc.get("asset") and not sc.get("device") and not sc.get("typedCaption")
             and not sc.get("ambience") and not sc.get("textCard") and sc["durationFrames"] >= LEAK_MIN_S * FPS]
    empty.sort(key=lambda k: (out[k]["durationFrames"] < LEAK_PREFER_S * FPS, _content_draw(str(k) + "leak")))
    took, gap = set(), max(2, len(out) // max(1, 2 * want))
    for k in empty:
        if len(took) >= want:
            break
        if any(abs(k - t) < gap for t in took):
            continue
        short = int(LEAK_PREFER_S * FPS) - out[k]["durationFrames"]
        if short > 0:                     # a 2-3 s shot is held to 3 s: the time comes from the next plain shot
            nxt = out[k + 1] if k + 1 < len(out) else None
            if (nxt is None or nxt.get("device") or nxt.get("typedCaption") or nxt.get("textCard")
                    or nxt["durationFrames"] - short < 2 * FPS):
                continue
            out[k]["durationFrames"] += short
            nxt["startFrame"] += short
            nxt["durationFrames"] -= short
            if nxt.get("ambience"):
                nxt["ambience"]["durationFrames"] = nxt["durationFrames"]
        out[k]["ambience"] = {"clip": "leak", "durationFrames": out[k]["durationFrames"], "shadow": 0}
        took.add(k)
    # the cinematic turn (owner 2026-10-09): about TURN_SHARE of ALL shots, on empty pictures only (nothing else on
    # them, the light leak included); its own measured move replaces the Ken Burns one
    want = round(TURN_SHARE * len(out))
    empty = [k for k, sc in enumerate(out) if sc.get("asset") and not sc.get("device") and not sc.get("typedCaption")
             and not sc.get("ambience") and not sc.get("textCard") and sc["durationFrames"] >= TURN_MIN_S * FPS]
    empty.sort(key=lambda k: (out[k]["durationFrames"] < TURN_PREFER_S * FPS, _content_draw(str(k) + "turn")))
    took, gap = set(), max(2, len(out) // max(1, 2 * want))
    for k in empty:
        if len(took) >= want:
            break
        if any(abs(k - t) < gap for t in took):
            continue
        out[k]["cinemaMove"] = {"kind": "turn"}
        if out[k].get("motion"):
            out[k]["motion"] = dict(out[k]["motion"], fromScale=1.0, toScale=1.0, fromX=0.0, toX=0.0, fromY=0.0, toY=0.0)
        took.add(k)
    for sc in out:
        sc["renderKey"] = _hash({k: v for k, v in sc.items() if k not in ("index", "startFrame")})
    return out


def _props(sc: dict) -> dict:
    url = lambda key: f"/storage/{key}"
    return {"scene": sc, "assetSrc": url(sc["asset"]["path"]) if sc["asset"] else None,
            "prevAssetSrc": url(sc["prevAsset"]["path"]) if sc.get("prevAsset") else None,
            "textCardBackgroundSrc": None, "companionSrcs": [url(c["path"]) for c in sc["companions"]]}


class PackageExported(BaseException):
    """Raised after export_package() so the run stops where the heavy drawing would begin (not swallowed by handlers)."""
    def __init__(self, path):
        super().__init__(str(path))
        self.path = path


def export_package(engine, work: Path, todo: list) -> Path:
    """Everything the drawing needs, in one file, for any other machine: the chosen photos (storage/), the tasks
    (manifest.json), the renderer's source (no node_modules) and remote_render.py. Planning stays where it ran."""
    import tarfile
    out = work / "render_package.tgz"
    manifest = {"version": 1, "style": "mr_truth", "tasks": [
        {"id": t["id"], "props": t["props"], "name": Path(t["output"]).name} for t in todo]}
    mf = work / "manifest.json"
    _dump(mf, manifest)
    skip = {"node_modules", "bundle", ".cache"}
    with tarfile.open(out, "w:gz") as tar:
        tar.add(mf, arcname="manifest.json")
        tar.add(work / "storage", arcname="storage")
        tar.add(HERE / "remote_render.py", arcname="remote_render.py")
        tar.add(RENDERER, arcname="renderer", filter=lambda ti: None if (set(Path(ti.name).parts) & skip) else ti)
    engine.log(f"Mr Truth: render package for {len(todo)} shot(s): {out} ({out.stat().st_size / 1e6:.0f} MB)")
    return out


def render(engine, work: Path, tasks: list, workers: int = 2) -> None:
    """Render [{id, props, output}] through mrtruth_renderer/movefast/render.mjs, split over `workers` processes."""
    todo = [t for t in tasks if not Path(t["output"]).exists()]
    if not todo:
        return
    if os.environ.get("MT_EXPORT_PACKAGE"):
        raise PackageExported(export_package(engine, work, todo))
    node = shutil.which("node") or "/opt/homebrew/bin/node"
    parts = [todo[k::workers] for k in range(workers)] if len(todo) > 8 else [todo]
    engine.log(f"Mr Truth: rendering {len(todo)} shot(s) with the repo's compositor ({len(parts)} process(es))...")
    t0 = time.time()

    def run(k, part):
        req = work / f"render_{k}.json"
        _dump(req, {"bundleDir": str(work / "bundle"), "storageDir": str(work / "storage"), "concurrency": 3, "tasks": part})
        p = subprocess.run([node, str(RENDERER / "movefast" / "render.mjs"), str(req)], cwd=str(RENDERER),
                           capture_output=True, text=True)
        if p.returncode != 0:
            raise RuntimeError(f"Mr Truth renderer failed: {(p.stderr or p.stdout)[-800:]}")

    if len(parts) > 1 and not (work / "bundle" / "index.html").exists():
        run(0, parts[0][:1])                          # bundle once before the processes share it
    with ThreadPoolExecutor(max_workers=len(parts)) as ex:
        list(ex.map(lambda kp: run(*kp), enumerate(parts)))
    engine.log(f"  rendered in {time.time() - t0:.0f}s")


def _sfx_audio(engine, job: Path, mp3: Path, sc_list: list) -> Path:
    """The voice with the repo's two live sounds under it: a shutter on each flash, a thud on each dip."""
    cues, last = [], -1e9
    for sc in sc_list:
        kind = sc["transitionIn"]["type"]
        if kind in SFX:
            t = sc["startFrame"] / FPS
            if t - last >= SFX_MIN_GAP_S:
                cues.append((t, *SFX[kind]))
                last = t
    if not cues:
        return mp3
    out = job / "voice_sfx.m4a"          # beside audio.mp3: the final mux runs in the job folder and reads names
    args = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(mp3)]
    for _, f, _, _ in cues:
        args += ["-i", str(RENDERER / "sfx" / f)]
    chains = [f"[{k + 1}:a]aresample=48000,volume={g}dB,adelay={int(max(0.0, t - att) * 1000)}:all=1[s{k}]"
              for k, (t, f, g, att) in enumerate(cues)]
    mix = "".join(f"[s{k}]" for k in range(len(cues)))
    fc = ";".join(chains + [f"[0:a]aresample=48000[v];[v]{mix}amix=inputs={len(cues) + 1}:normalize=0:duration=first[a]"])
    subprocess.run(args + ["-filter_complex", fc, "-map", "[a]", "-c:a", "aac", "-b:a", "192k", str(out)], check=True)
    engine.log(f"  sound: {len(cues)} cue(s) (shutter on a flash, impact on a dip)")
    return out


def assemble(engine, job: Path, mp3: Path, srt: Path, style: str, force: bool, burn_subs: bool) -> Path:
    final = job / "video.mp4"
    if final.exists() and not force:
        engine.log(f"cached: {final.name}")
        return final
    work = job / "mrtruth"
    work.mkdir(parents=True, exist_ok=True)
    script = (job / "script.txt").read_text(encoding="utf-8")
    dossier = research(engine, script, job, force)
    dossier = dict(dossier, visualBrief=visual_brief(engine, job, script, dossier, force))   # every later prompt reads it
    rows = beats(engine, job, srt, script, dossier, force)
    for r in rows:
        r["device"] = None
    title = (job / "title.txt").read_text(encoding="utf-8").splitlines()[0] if (job / "title.txt").exists() else ""
    opps = opportunities(engine, job, script, force)
    build = assign(engine, rows, opps, script, _cues(engine, srt), dossier, title)
    fill_overlays(engine, job, rows, script, dossier, build, force)
    typed_captions(engine, job, rows, script, force)
    pictures(engine, job, rows, dossier, force)
    DEV_DROPS.clear()
    PEOPLE_NAMES.clear()
    for p in (dossier.get("visualBrief") or {}).get("people") or []:
        PEOPLE_NAMES.update(x.lower() for x in (p.get("name") or "", p.get("surname") or "") if x)
    _fit_devices(rows)
    for i, tid, why in DEV_DROPS:
        now = (rows[i].get("device") or {}).get("id")
        if now == tid:
            engine.log(f"      template {tid} on shot {i} kept ({why})")
        else:
            engine.log(f"      template {tid} on shot {i} refused ({why})" + (f" -> {now}" if now else " -> plain photo"))
    sync_overlays(engine, job, rows, _cues(engine, srt))
    transitions(rows)
    storage = work / "storage"
    sc_list = scenes(rows, storage, _cues(engine, srt))
    _dump(work / "plan.json", sc_list)
    _dump(work / "shots.json", [{"text": r["text"], "photo": (r.get("pick") or {}).get("photo"), "step": r.get("step"),
                                 "ai": bool((r.get("pick") or {}).get("ai")),
                                 "anchor_switched": r.get("step") in ("anchor", "neighbour", "contextual", "reused")} for r in rows])
    seg_dir = work / "segments"
    seg_dir.mkdir(parents=True, exist_ok=True)
    tasks = [{"id": "Segment", "props": _props(sc), "output": str(seg_dir / f"{sc['index']:04d}_{sc['renderKey'][:12]}.mp4")}
             for sc in sc_list]
    render(engine, work, tasks, workers=int(_cfg(engine, style).get("render_processes") or 2))
    engine._concat_segments([Path(t["output"]) for t in tasks], job / "_visual.mp4")
    audio = _sfx_audio(engine, job, mp3, sc_list)
    engine._final_mux(job, audio, srt, False, add_qr=False, vignette=False)
    (job / "_visual.mp4").unlink(missing_ok=True)
    if audio != mp3:
        audio.unlink(missing_ok=True)
    _credits(job, rows)
    _report(engine, rows, sc_list)
    for line in check(job):
        engine.log("  check: " + line)
    if getattr(engine, "CLEAN_RENDERS", False) and final.exists():
        for sub in ("segments", "bundle"):
            shutil.rmtree(work / sub, ignore_errors=True)
    return final


def _credits(job: Path, rows: list) -> None:
    seen, out = set(), []
    for r in rows:
        for c in [r.get("pick")] + list(r.get("companions") or []):
            if c and c["photo"] not in seen:
                seen.add(c["photo"])
                out.append({"title": c.get("title", ""), "source": c.get("source", ""), "url": c.get("url", ""),
                            "license": c.get("license", ""), "artist": c.get("artist", "")})
    _dump(job / "credits.json", out)


def _report(engine, rows: list, sc_list: list) -> None:
    devs = {}
    for sc in sc_list:
        if sc.get("device"):
            devs[sc["device"]["id"]] = devs.get(sc["device"]["id"], 0) + 1
    tr = {}
    for sc in sc_list:
        tr[sc["transitionIn"]["type"]] = tr.get(sc["transitionIn"]["type"], 0) + 1
    engine.log("Mr Truth: " + f"{len(sc_list)} shots; templates " + (", ".join(f"{k}×{v}" for k, v in sorted(devs.items(), key=lambda kv: -kv[1])) or "none")
               + "; transitions " + ", ".join(f"{k}×{v}" for k, v in tr.items())
               + f"; opening {'P03' if (sc_list[0].get('device') or {}).get('id') == 'P03' else 'NO P03'}")


# ── 7. the checker: the rules, read back off the finished plan (log only — it never stops a run) ─────────────
def check(job: Path) -> list:
    work = Path(job) / "mrtruth"
    plan, shots = _load(work / "plan.json") or [], _load(work / "shots.json") or []
    if not plan or len(shots) != len(plan):
        return ["FAIL  no plan.json / shots.json to check"]
    fails = []
    pics = [(sc.get("asset") or {}).get("path") for sc in plan]
    for k, sc in enumerate(plan):
        d, sh = sc.get("device") or {}, shots[k]
        tid = d.get("id")
        if tid:
            if not LIBRARY.get(tid, (False,))[0]:
                fails.append(f"shot {k}: {tid} is switched off")
            if sc["durationFrames"] < BUILD_FRAMES.get(tid, 0):
                fails.append(f"shot {k}: {tid} cut before it finishes ({sc['durationFrames']} of {BUILD_FRAMES[tid]} frames)")
            if tid == "P03" and set(_content(d.get("kicker", ""))) & set(_content(d.get("headline", ""))):
                fails.append(f"shot {k}: P03 lines share a word")
            if tid in NAMES_PICTURE and (sh["ai"] or sh["anchor_switched"]):
                fails.append(f"shot {k}: {tid} names a picture that is {'AI' if sh['ai'] else sh.get('step') or 'a stand-in'}")
            comp = [c["path"] for c in sc.get("companions") or []] + ([pics[k]] if pics[k] and tid != "gallery-strip" else [])
            if len(set(comp)) < len(comp):
                fails.append(f"shot {k}: {tid} shows one picture twice")
        if k and _year_in(sh["text"]) and tid not in ("P12", "P14", "chapter-plate", "chapter-title") and not sc.get("overlay"):
            fails.append(f"shot {k}: says {_year_in(sh['text'])} without a date")
        if sc["transitionIn"]["type"] in ("pushCut", "slide") and (tid or (plan[k - 1].get("device") if k else None)):
            fails.append(f"shot {k}: {sc['transitionIn']['type']} into or out of a template")
        if k and pics[k] and pics[k] == pics[k - 1]:
            fails.append(f"shot {k}: same picture as the shot before")
    cards = [k for k, sc in enumerate(plan) if sc.get("textCard")]
    if cards and any(pics):
        fails.append(f"text card(s) on shot {', '.join(map(str, cards[:8]))} while the video has photos")
    over = [p for p in set(pics) if p and pics.count(p) > 2]
    if over:
        fails.append(f"{len(over)} picture(s) on more than two shots")
    if (plan[0].get("device") or {}).get("id") != "P03":
        fails.append("the opening has no P03")
    ai = sum(1 for s in shots if s["ai"])
    return (fails and [f"FAIL  {f}" for f in fails] or ["PASS  every rule"]) + [f"{len(plan)} shots, {ai} AI stand-in(s)"]


# ── 8. previews: every template, labelled, so the owner can watch them (the switched-off ones too) ────────────
PREVIEW = [
    ("P03", "Opening title", 150, "qumran_caves", [], {"id": "P03", "kicker": "Qumran, 1947", "headline": "The scrolls in the cave", "highlightWords": ["scrolls"]}),
    ("gallery-strip", "Previews 4 pictures from later", 150, "desert", ["scroll_fragment", "shrine", "jars", "isaiah_scroll"], {"id": "gallery-strip"}),
    ("P12", "Year", 150, "bedouin", [], {"id": "P12", "year": "1947", "eraLabel": "", "detail": ""}),
    ("P14", "Year odometer", 150, "qumran_site", [], {"id": "P14", "year": "1952", "label": "", "detail": ""}),
    ("chapter-title", "Chapter turn on its own ground", 150, "desert", [], {"id": "chapter-title", "caption": "The shepherd's find"}),
    ("chapter-plate", "Chapter heading over a photo", 150, "desert", [], {"id": "chapter-plate", "heading": "The caves of Qumran"}),
    ("top-title", "Running title", 150, "ein_gedi", [], {"id": "top-title", "line1": "The Judean Desert", "line2": "Edge of the Dead Sea"}),
    ("corner-label", "Corner label", 150, "qumran_site", [], {"id": "corner-label", "label": "Khirbet Qumran", "kicker": "West Bank"}),
    ("P04", "Lower-left label", 150, "isaiah_scroll", [], {"id": "P04", "mainLine": "The Temple Scroll", "supportLine": "Found in Cave 11 at Qumran"}),
    ("P17", "Museum plate", 150, "jars", [], {"id": "P17", "label": "Qumran", "anchorX": 0.5, "anchorY": 0.55, "labelX": 0.72, "labelY": 0.28}),
    ("shadow-up", "One spoken line", 90, "qumran_caves", [], {"id": "shadow-up", "line": "Hidden for two thousand years"}),
    ("P02", "Editorial card", 180, "scroll_fragment", [], {"id": "P02", "label": "The discovery", "headline": "The oldest Bible texts ever found"}),
    ("P09", "Question card", 150, "qumran_caves", [], {"id": "P09", "sectionLabel": "The mystery", "question": "Who hid the scrolls in the caves?"}),
    ("P05", "Text left, picture right", 180, "copper_scroll", [], {"id": "P05", "eyebrow": "Cave 3, 1952", "headline": "A map to buried treasure", "supportLine": "The Copper Scroll lists sixty-four hiding places.", "imageLabel": "The Copper Scroll"}),
    ("bullet-checklist", "Ordered takeaways", 150, "library", [], {"id": "bullet-checklist", "title": "What the scrolls hold", "rows": ["Books of the Hebrew Bible", "Lost writings like Enoch", "A community rulebook"]}),
    ("P08", "Full-screen source", 150, "codex", [], {"id": "P08"}),
    ("framed-card", "Framed source", 90, "scroll_fragment", [], {"id": "framed-card", "caption": "Fragment from Cave 4"}),
    ("photo-pop", "Photo pops forward", 120, "papyrus", [], {"id": "photo-pop"}),
    ("highlight-page", "Words highlighted on a page", 178, "codex", [], {"id": "highlight-page", "paragraphs": [
        "In the spring of 1947 a young shepherd threw a stone into a cave and heard pottery break.",
        "Inside the jars were leather scrolls, wrapped in linen and sealed for two thousand years.",
        "Scholars would later call them the greatest manuscript find of the twentieth century."],
        "phrases": ["heard pottery break", "sealed for two thousand years", "the greatest manuscript find"]}),
    ("two-photo-zoom", "Two pictures compared", 90, "isaiah_scroll", ["codex"], {"id": "two-photo-zoom", "left": "Qumran, 100 BC", "right": "Aleppo Codex, 930 AD"}),
    ("P22", "Four-picture mosaic", 210, "qumran_caves", ["jars", "scroll_fragment", "qumran_site"], {"id": "P22"}),
    ("P19", "Red-string board", 180, "map", ["bedouin", "jars", "jerusalem"], {"id": "P19"}),
    ("P13", "OFF — timeline", 150, "desert", [], {"src": "desert", "kicker": "The finds", "heading": "Seventy years of discovery", "events": [{"year": "1947", "label": "Cave 1"}, {"year": "1952", "label": "Cave 4"}, {"year": "1956", "label": "Cave 11"}]}),
    ("P16", "OFF — not X, but Y", 150, "scroll_fragment", [], {"src": "scroll_fragment", "firstPrefix": "Not", "firstPhrase": "a legend", "secondPrefix": "but", "secondPhrase": "a library", "detail": "Over 900 manuscripts"}),
    ("pointer-label", "OFF — pointer label", 150, "jars", [], {"src": "jars", "label": "Ruins of Qumran", "anchor": {"x": 0.5, "y": 0.55}}),
    ("name-card", "OFF — name card", 150, "rockefeller", [], {"srcs": ["rockefeller", "jerusalem"], "captions": ["A scroll scholar", "Jerusalem, 1950s"]}),
    ("name-plate", "OFF — name plate", 150, "jerusalem", [], {"src": "jerusalem", "name": "A scroll scholar", "role": "Rockefeller Museum, 1950s"}),
]


def preview(which: str = "all") -> Path:
    import make_video as engine
    want = None if which in ("", "all") else {w.strip() for w in which.split(",")}
    pics = _load(HERE / "assets" / "mrtruth" / "preview" / "pictures.json", {})
    work = HERE / "preview" / "mrtruth"
    storage = work / "storage"
    pick = lambda name: {"photo": str(HERE / "assets" / "mrtruth" / "preview" / pics[name]["file"]),
                         "title": pics[name]["title"], "url": pics[name]["page"], "license": pics[name]["license"]}
    tasks, labels = [], []
    for k, (tid, what, frames, img, comp, fields) in enumerate(PREVIEW):
        if want and tid not in want:
            continue
        out = work / "segments" / f"{k:02d}_{tid}.mp4"
        if tid in ("P13", "P16", "pointer-label", "name-card", "name-plate"):
            res = lambda v: (f"/storage/{_stage(storage, pick(v)['photo'])}" if isinstance(v, str) and v in pics else
                             [res(x) for x in v] if isinstance(v, list) else v)
            props = {key: (res(val) if key in ("src", "srcs") else val) for key, val in fields.items()}
            tasks.append({"id": "Direct", "props": {"kind": tid, "durationFrames": frames, "props": props}, "output": str(out)})
        else:
            row = {"text": tid, "startMs": 0, "endMs": int(frames / FPS * 1000), "pick": pick(img), "device": fields,
                   "companions": [pick(c) for c in comp], "tin": {"type": "cut", "durationFrames": 0}, "tout": None}
            sc = scenes([row], storage)[0]
            tasks.append({"id": "Segment", "props": _props(sc), "output": str(out)})
        on = LIBRARY[tid][0]
        labels.append((out, f"{tid}  ·  {what}" + ("" if on else "  (switched off)"), frames))
    render(engine, work, tasks, workers=1)
    reel = work / ("templates.mp4" if not want else f"templates_{'_'.join(sorted(want))[:60]}.mp4")
    parts = []
    for k, (seg, label, frames) in enumerate(labels):
        lab = seg.with_name(seg.stem + "_lab.mp4")
        txt = label.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace(",", "\\,")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(seg), "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                        "-vf", f"scale=1728:972,pad=1920:1080:96:0:color=0x0b0b0b,drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial Bold.ttf':"
                               f"text='{txt}':x=96:y=1010:fontsize=34:fontcolor=0xE8C468",
                        "-t", f"{frames / FPS:.4f}", "-r", "30", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-shortest", str(lab)], check=True)
        parts.append(lab)
    lst = work / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts), encoding="utf-8")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                    "-movflags", "+faststart", str(reel)], check=True)
    for lab in parts:                                    # the labelled copies were only for the join
        lab.unlink(missing_ok=True)
    print(f"Mr Truth preview -> {reel}")
    return reel


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "preview":
        preview(sys.argv[2] if len(sys.argv) > 2 else "all")
    elif len(sys.argv) >= 3 and sys.argv[1] == "check":
        print("\n".join(check(Path(sys.argv[2]))))
    else:
        print(__doc__)
