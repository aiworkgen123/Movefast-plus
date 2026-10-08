#!/usr/bin/env python3
"""director.py — the edit plan of a Documentary video.

The tools each used to read the narration on their own and grab moments: the maps module its places,
the photo module its people, the graphics their numbers. Each chose well, but nobody edited — the
same strong moment was claimed three times, the opening stayed plain, and a date graphic landed
twenty seconds after the date was said.

Now one director reads the whole narration and decides, sentence by sentence, what the viewer sees
on top of the real footage, and hands every tool exactly its moments:

    map         an animated map of a place that matters             (maps.py)
    spotlight   a real photo of a real person, place or moment       (photofx.py)
    object      a real product or thing, cut out and flying in       (photofx.py)
    headline    the real article behind a claim, highlighted         (headlines.py)
    graphic     dateline, number, chart, timeline, quote, pivot, question (docgfx.py)
    vox         a moment told as paper collage                        (vox.py)
    text        a label over the footage: a name, a place, a date, a number, a key phrase

Documentary chooses edits for the explanatory need at each spoken beat. Parallel stretches are
merged, then reviewed once across the whole video before timing and tool preparation. Real footage
remains prominent; no tool has a mandatory opening or per-minute cadence.

Every tool keeps its own renderer and its own checks; the director only decides where each one is used.
The plan is director.json in the video's folder, with the moments each tool received.
"""

import styles as _styles
import json
import math
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
_LOCKS: dict = {}
_LOCKS_GUARD = threading.Lock()
INTRO_S = 60.0          # the hook (a channel sets its own with pacing.hook_s)
CHUNK_S = 150.0         # the rest is directed in stretches of this length, side by side

TOOLS = {
    "map": """- map — an animated map of a place that matters (7 s):
  {"tool": "map", "cue": 3, "words": "Arlington Heights, Illinois", "shot": "pin",
   "places": [{"name": "Arlington Heights", "names": ["Arlington Heights"], "label": "Arlington Heights", "type": "town",
               "country": "United States", "lat": 42.09, "lon": -87.98}],
   "title": "Arlington Heights", "subtitle": "a Chicago suburb, September 1982", "icon": ""}
  Map field rules:
[INSERT MAP RULES HERE]
""",
    "spotlight": """- spotlight — a real photo of a real public person, place or documented event, camera pushing in (5 s):
  {"tool": "spotlight", "cue": 12, "words": "James Burke", "subject": "James Burke", "query": "James Burke Johnson & Johnson CEO 1982"}
  Public figures, famous places and documented events — and anyone the news has photographed as part of this story:
  a celebrity's partner or rumoured partner, an influencer, a model. When the story is about someone's relationships,
  EVERY partner the narration names gets their photo on the words that name them (put the subject's name and the
  person's name in "query" so the news photo is found). NEVER a private person (a victim, a witness, a relative, an
  ordinary employee, a child) — no public photo of them exists; give them a "name" text label instead.
""",
    "matchcut": """- matchcut — a match cut: 6 to 10 REAL photographs of the main person cut fast, every face landing on the same
  spot of the screen at the same size, a white flash and a camera shutter on every cut, the last photo held (4.6 s). The
  most electric way this channel introduces its main person — ONCE per video, on the first time the main subject is
  named (right after the opening montage when there is one):
  {"tool": "matchcut", "cue": 2, "words": "Bob Love", "subject": "Bob Love", "query": "Bob Love Chicago Bulls forward 1970s", "n": 10}
  Real photographs of a public person only; never a private person, never twice.
""",
    "textcut": """- textcut — a text match cut: 3 to 5 punches of text — the numbers and the words that hit in this passage — one
  per hard cut, each snapping onto the same spot of the screen over a different real photo of the subject, a hit under
  every cut (5 s). ONCE per video, on the passage where the facts pile up (the numbers of a career, the timeline of a
  fall); never within 20 s of the match cut:
  {"tool": "textcut", "cue": 9, "words": "one point six million dollars", "subject": "Len Bias", "query": "Len Bias Maryland 1986", "lines": ["NO. 2 PICK", "$1.6 MILLION", "48 HOURS", "AGE 22"]}
  Lines of 1-4 words, in capitals, only facts the narration says right there.
""",
    "strip": """- strip — a Kodak contact strip: 2 or 3 REAL photographs of a public person, one after another on a strip of
  35 mm film, the camera landing on each with a click (6.6 s). The signature way this channel introduces its main person:
  {"tool": "strip", "cue": 2, "words": "LaRue Martin", "subject": "LaRue Martin", "query": "LaRue Martin Loyola Portland Trail Blazers 1972", "n": 3}
  Use it on the FIRST time the main subject is named, and for another public person who matters to the story. Real
  photographs only — never a private person, never the same person twice as a strip.
""",
    "press": """- press — an old newspaper: the real printed page or clipping that reported a fact of the era, the camera pushing in on
  its headline (6.5 s). For stories before the internet era this replaces "headline":
  {"tool": "press", "cue": 6, "words": "first pick of the 1972 draft", "subject": "LaRue Martin", "year": "1972",
   "query": "LaRue Martin number one pick 1972 NBA draft Portland", "claim": "Portland took LaRue Martin with the first pick of the 1972 NBA draft."}
  A draft, a trade, a contract, a lawsuit, a court decision, a record, a firing, a death — reported facts only. "year" is the
  year the paper would have printed it. One or two a minute in a story of the past; never twice for the same fact.
""",
    "object": """- object — a real product or thing the narration names, cut out of a photo and flying in (5 s):
  {"tool": "object", "cue": 7, "words": "Extra-Strength Tylenol", "layout": "solo", "things": ["Extra Strength Tylenol bottle 1982"]}
  layout: "solo" (one), "pair" (two compared), "row" (3-4), "crown" (one + "accent" object landing on "accent_words").
""",
    "headline": """- headline — the real article or encyclopedia page behind a claim, the line highlighted (6.5 s):
  {"tool": "headline", "cue": 20, "words": "recalled thirty-one million bottles", "kind": "news",
   "query": "Johnson & Johnson Tylenol recall 31 million bottles 1982", "claim": "Johnson & Johnson recalled 31 million bottles of Tylenol in 1982.", "lang": "en"}
  kind "news" for reported events, "reference" for encyclopedia facts (query = the article subject).
  When the narration names a page itself — a subreddit, a forum, a company's post — and you know its exact address, give
  it: {"tool": "headline", "cue": 5, "words": "The GTA 6 subreddit", "kind": "news", "url": "https://www.reddit.com/r/GTA6/", "claim": "..."}
""",
    "graphic": """- graphic — a premium animated graphic (5-8 s), one of:
  {"tool": "graphic", "cue": 1, "words": "September 29th, 1982", "type": "dateline", "place": "ARLINGTON HEIGHTS, ILLINOIS", "date": "September 29, 1982", "note": "a family kitchen"}
  {"tool": "graphic", "cue": 18, "words": "thirty-one million bottles", "type": "number", "value": "31000000", "prefix": "", "suffix": "", "unit": "bottles recalled", "context": "pulled from every shelf in America", "source": "Johnson & Johnson, 1982"}
  {"tool": "graphic", "cue": 25, "words": "...", "type": "chart", "title": "...", "unit": "%", "bars": [{"label": "...", "value": 37}], "highlight": 0, "source": "..."}
  {"tool": "graphic", "cue": 30, "words": "...", "type": "timeline", "title": "...", "events": [{"date": "...", "label": "..."}]}
  {"tool": "graphic", "cue": 33, "words": "...", "type": "quote", "quote": "...", "who": "...", "role": "...", "year": "..."}
  {"tool": "graphic", "cue": 9, "words": "...", "type": "pivot", "line": "at most 7 words"}
  {"tool": "graphic", "cue": 14, "words": "...", "type": "question", "line": "at most 6 words"}
  {"tool": "graphic", "cue": 16, "words": "...", "type": "step", "n": "2", "title": "Leave-in conditioner", "note": "on soaking-wet hair"}
  {"tool": "graphic", "cue": 19, "words": "...", "type": "card", "kicker": "Tell your barber", "text": "the exact words to say", "highlight": ["1 to 3 key phrases"]}
  {"tool": "graphic", "cue": 6, "words": "unfollowed each other", "type": "social", "action": "unfollow", "from": "Lamine Yamal", "to": "Alex Padilla", "mutual": true, "note": "late 2024"}
  {"tool": "graphic", "cue": 3, "words": "back to Chicago", "type": "place", "place": "CHICAGO", "sub": "ILLINOIS"}
  {"tool": "graphic", "cue": 21, "words": "the worst number one pick", "type": "pull", "text": "one real sentence from a real article, word for word", "outlet": "The Sun", "byline": "Jim Sheridan", "role": "US Sport Reporter", "date": "21 Mar 2023", "subject": "LaRue Martin", "query": "LaRue Martin portrait"}
  {"tool": "graphic", "cue": 12, "words": "18 points and 16 rebounds", "type": "table", "title": "", "columns": ["Statistic", "College career"], "rows": [{"label": "Points per game", "value": "18.2"}, {"label": "Rebounds per game", "value": "15.9"}], "source": "Loyola Ramblers records"}
  place = a big centred city card the first time the story moves to a new city (a real city and its state or country);
  pull = one REAL sentence a real article printed about the subject, with its outlet, writer and date — only when you are
  certain of the exact words; table = 2 to 5 rows of real numbers (a stat line, a comparison) with a real source.
  social = two named people follow ("action": "follow") or unfollow each other on social media — a split, a new couple,
  a feud going public — on the words that say it ("mutual": true when both did). Real names only.
  step = the title card of each step of a routine, list or how-to (on the words that name the step); card = a practical
  tip or the exact words to say to someone, the key phrases highlighted. Both belong to how-to and advice videos.
  Numbers as plain digits. A chart or number always names its real source. Quotes only if documented word for word.
  A part of a whole ("190 of 200 laps") is a number ("value": "190", "unit": "laps led", "context": "of 200"), never a
  chart of the part against the whole; a chart compares three or more real things. A record or a "first" is said as
  true for its time ("a race record in 1965"), never "fastest ever" unless it still stands today.
""",
    "vox": """- vox — a moment of 7 to 14 seconds told as hand-cut paper collage: halftone cutouts of the real people, torn
  archival photos, typewriter labels, big red number cards, pins and red string. From where "words" start to
  where "end_words" end:
  {"tool": "vox", "cue": 10, "words": "Hours before, in Elk Grove Village", "end_cue": 12, "end_words": "dead before 7 a.m."}
""",
    "text": """- text — a label over the footage itself, about 3.5 s, never during another tool's scene:
  {"tool": "text", "cue": 2, "words": "Adam Janus", "style": "name", "text": "ADAM JANUS", "sub": "27, first victim"}
  style "name" (a person: name + who they are), "place" (a place), "date" (a date), "number" (a figure + what it counts:
  "text": "7", "sub": "deaths in 3 days"), "phrase" (ONLY a real proper term the viewer must remember — a rule, a case, a
  product, a diagnosis: "POTASSIUM CYANIDE", "THE HAYWOOD RULE" — never a description of the picture like "pounds of cotton",
  never a paraphrase of the narration; at most one or two in a video).
""",
}

# Editorial notes are prompt guidance only, never fields in the tool-item schema.
DOCUMENTARY_NOTES = {
    "map": "Useful when: location or distance changes the explanation. Viewer benefit: understands where the action fits. Example: locate a river crossing and the nearby town.",
    "spotlight": "Useful when: a named real subject deserves a beat of its own — a public person, a documented place or event, or a named machine, model, factory or landmark object. Viewer benefit: connects the account to a real subject. Example: push in on a real photo of the PR 776 when it is first named, or of the Telfs factory.",
    "object": "Useful when: a physical item or grouped components need to be seen. Viewer benefit: recognizes the parts and their relationship. Example: show three or four pieces in the existing object-row, keeping every listed item.",
    "headline": "Useful when: a reported claim or named page needs its real source. Viewer benefit: sees the evidence rather than an unsupported assertion. Example: highlight the actual report announcing a closure.",
    "strip": "Useful when: two or three distinct real photographs clarify a public person's identity. Viewer benefit: sees the subject across relevant views. Example: an introduction supported by archive portraits.",
    "press": "Useful when: an era's printed report is the evidence. Viewer benefit: sees how the event was reported at the time. Example: inspect a real newspaper's announcement.",
    "matchcut": "Useful when: a public person's introduction benefits from six to ten distinct real views. Viewer benefit: recognizes the same person across photographs. Example: align archive portraits at a first introduction, within the existing once-only rule.",
    "textcut": "Useful when: three to five supported facts build a compact point. Viewer benefit: follows the accumulation without a long paragraph. Example: stated milestones over distinct relevant photographs, within the existing once-only rule.",
    "vox": "Useful when: a mechanism or connected relationship needs several relevant images. Viewer benefit: follows how the pieces connect or cause an outcome. Example: trace a pump, pipe and reservoir with media-led composition and supporting labels. Each Vox about a different subject.",
    "text": "Useful when: identification or concise explanation is enough over useful footage. Viewer benefit: understands the current action without replacing it. Example: name/place/date/number identifies what matters; a short phrase such as ALIGN BEFORE JOINING explains a supported operation. Faithful concise paraphrases are allowed, never running subtitles.",
    "graphic": """dateline — Useful when: a stated date/location establishes context. Viewer benefit: follows a time change. Example: mark the documented opening date.
  number — Useful when: one consequential quantity needs scale and units. Viewer benefit: grasps its significance. Example: a stated capacity with its unit and source.
  chart — Useful when: three or more real quantities need comparison. Viewer benefit: sees the relative differences. Example: compare documented outputs of three plants; never chart a part against its whole.
  timeline — Useful when: dated events explain a development. Viewer benefit: follows the chronology. Example: order supported opening, expansion and closure dates.
  quote — Useful when: documented exact words carry the point. Viewer benefit: hears the claim in its attributed form. Example: a verified statement by the named speaker.
  pivot — Useful when: the argument makes a real turn. Viewer benefit: recognizes why the next idea changes the explanation. Example: a concise supported contrast at the turning point.
  question — Useful when: a real unresolved question motivates the next explanation. Viewer benefit: knows what the following evidence must answer. Example: WHY THIS ROUTE? at a documented route-choice problem.
  step — Useful when: a stated process stage benefits from a short signpost. Viewer benefit: follows the established order. Example: label the measured inspection stage, without inventing steps.
  card — Useful when: a short factual explanation needs a clear phrase. Viewer benefit: remembers the relationship. Example: summarize a supported requirement with concise emphasis.
  social — Useful when: a documented follow/unfollow changes the relationship. Viewer benefit: understands the public connection. Example: show the reported action between the two named people.
  place — Useful when: a move to a real city matters. Viewer benefit: recognizes the new setting. Example: the named city and country at the move.
  pull — Useful when: an article's exact sentence is consequential evidence. Viewer benefit: sees the wording and attribution. Example: a verified sentence with outlet, writer and date.
  table — Useful when: two to five sourced rows benefit from compact inspection. Viewer benefit: compares the facts without losing their units. Example: documented specifications with a real source.""",
}

PROMPT = """You are the director and editor of a premium documentary YouTube video titled "[INSERT TITLE HERE]".
Real footage of the events plays under the whole narration. Your job: decide, sentence by sentence, what else
the viewer sees, using these tools. Be creative — every video should use the tools in fresh ways — but every
choice must SHOW what those exact words say, at the exact moment they are said.

THE TOOLS (one JSON object each, "tool" plus its fields; "cue" and "words" are where it is said — the cue number
and 1 to 6 words copied letter for letter from that cue):

[INSERT TOOLS HERE]
HOW TO EDIT THIS STRETCH ([INSERT RANGE HERE]):
[INSERT BUDGET HERE]
- Match the tool to the words: a person → spotlight or name label; a product or object → object; a place →
  map or place label; a date → dateline graphic or date label; a figure → number graphic or number label; a claim
  a newspaper reported → headline; a turn in the story → pivot or question; a sequence of dates → timeline; a
  documented quote → quote; a scene full of people, places and facts at once → vox.
- Timing is everything: put each tool on the cue and words where its subject is SPOKEN — a date graphic on the date,
  not on the sentence after.
- Scenes (map, spotlight, object, headline, graphic, vox) must not overlap: leave at least 2 seconds between the end
  of one and the start of the next. Text labels go on the footage, or on a spotlight or object (a name on the
  photo) — never on a map, graphic, headline or vox scene, which carry their own words.
- Vary: never the same tool twice in a row, never the same kind of graphic twice in a row, and every scene shows a
  DIFFERENT thing — never two objects or photos of the same car, product or person in one video.
- Premium graphics are the signature of this channel: in every minute, at least one graphic (a number, a timeline,
  a dateline, a chart or a quote) on the figure or date that matters most.
- Maps: "pin" for a city, town, venue, race track or a tiny country (Monaco, Vatican City, Singapore); "region" only
  for a place big enough to see on a map of its surroundings.
- Real facts only: names, dates, numbers, places, quotes you are certain of — best, ones the narration itself says.
[INSERT LOOK HERE][INSERT EXTRA HERE]
Return ONLY a JSON array of tool objects, in time order.

TRANSCRIPT (cue number, [minute:second], text):
[INSERT TRANSCRIPT HERE]"""

INTRO_BUDGET = """- This is the HOOK — the first minute decides whether anyone keeps watching. Make it the richest, most edited
  stretch of the video: something on screen for EVERY sentence besides the footage.
- Use, wherever the narration gives you the material: a MAP of the first place that matters (always, when a real
  place is named — it tells the viewer this is a quality documentary); a dateline graphic on the first date (not on
  top of the map — the map's subtitle can carry the date instead); a spotlight on the first public figure or
  documented event; an object for the product at the centre of the story; a vox collage of 7 to 11 seconds inside
  the first 30 seconds (and, in a video longer than three minutes, a second one before 1:00); a headline — the real
  article, or the real page the narration names — on the first reported fact;
  and text labels on the footage between the scenes for every new name, place, date and figure — at least five
  in this minute when the narration names that many.
- Scenes can follow each other closely here (2 seconds of footage between them is enough).
- A video under 90 seconds opens on its strongest real picture — footage, a spotlight or the real article — never on
  a map; a map comes later and short."""

BODY_BUDGET = """- After the hook the video breathes: real footage carries most of it. For this stretch of about [INSERT MIN HERE]
  minutes use roughly: one vox collage per minute; one or two spotlights or objects per minute; one graphic per
  minute (datelines when time or place changes, numbers for the figures that matter, a timeline for a sequence,
  a pivot or question at a real turn); a map when a new place matters; one or two headlines per minute on the
  reported facts — a statement, a court decision, a lawsuit, a firing, a record — and the real page (a subreddit, a
  forum, a post) when the narration names one; a social graphic whenever people follow or unfollow each other; and
  three to five text labels per minute on the footage between scenes.
- Leave at least 6 seconds of plain footage between scenes."""

OPENING_TIERS = os.environ.get("OPENING_TIERS", "1") == "1"   # owner 2026-10-04: denser first 30 s, richer first 2 min
OPENING_S, RICH_S = 30.0, 120.0


MORE_EDITS = os.environ.get("MORE_EDITS", "1") == "1"   # owner 2026-10-05 (option B): looser editing brief, a bit more Vox; 0 = off
_MORE_EDITS_SWAPS = (
    (' A mentioned noun alone is no reason.', ''),
    ("""- Vox is a signature: one Vox collage in the hook when the narration explains how something works or connects
  several real things, then roughly one every one to two minutes where a passage explains a mechanism or relationship.""",
     """- Vox is a signature: one early in the hook, then about one a minute wherever the narration explains how something
  works or connects real things."""),
    ('- Aim for about 40–50% of the time edited with useful text and templates; never invent an edit to hit it.',
     "- Edits are this channel's style: aim for about 60% of the time edited with text, templates, graphics and Vox.\n"
     "  When a moment can carry a fitting edit, give it one. A still photo should usually carry a label or template."),
    ('the body leaves room for real footage.', 'the body stays well edited too.'),
    ("Choose treatments that answer the viewer's question, not just because a noun is mentioned.\n", ''),
    ('Target 40–50% of actual placements', 'Target about 60% of actual placements'),
    ('This is not mandatory text/templates on every\nsentence or arbitrary motion.', ''),
    ('No automatic assignment for every list or section.', ''),
    ('The 40–50% coverage target is advisory, not a ceiling on useful editing.', 'The coverage target is a floor to reach, not a ceiling.'),
    ('No quota or forced rotation.', ''),
    ('Vox remains available for mechanisms and relationships, without a cap, mandatory opening or\nper-minute quotas.',
     'Vox: about one a minute where a passage explains a mechanism or relationship.'),
    ('Stills mostly stay static; gentle motion on about one in four.', 'Every still moves gently.'),
)


def _more_edits(text: str) -> str:
    for old, new in _MORE_EDITS_SWAPS:
        text = text.replace(old, new)
    return text


def _guide(style: str):
    """The channel's template guide (guide.py) — Documentary family only; None plans the old way."""
    if not _styles.is_documentary(style):
        return None
    import guide
    return guide.load(style)


def _tiers(style: str) -> bool:
    """The worked opening is for Documentary and War Chess only (owner 2026-10-04); the look kits keep their own."""
    return OPENING_TIERS and _styles.is_documentary(style)
OPENING_NOTES = """- THIS IS THE OPENING (0:00–0:30). In these seconds the viewer decides whether this is a high-quality
  documentary. Open on an edit, never on a plain shot: something designed is on screen within the first few seconds
  (a dateline, a place or name label, a figure, a spotlight). Then nearly every sentence brings an edit: a text label
  for every new name, date, place and figure, a template or graphic on the strongest fact. Put one Vox collage in
  these first 45 seconds when the narration explains how something works or connects real things. Each footage
  shot shows something new — another place, machine, person or era. Richer, not faster: footage shots 4–5 s;
  no flash-cut montage. (MoveFast adds a few light leaks and white flashes between beats itself.)"""
RICH_NOTES = """- THIS IS STILL THE HOOK (0:30–2:00): clearly more worked than the rest of the video. Text labels on new names,
  places, dates and figures; a scene or template wherever the narration gives material (about every 15–20 s); a
  second Vox collage only when a passage explains a mechanism; 2 seconds of footage between scenes is enough. Show
  something new each shot rather than staying on one source. Footage shots 4–5 s. After 2:00 the video returns to
  its normal, footage-led pace."""


DOCUMENTARY_PLANNING = """DOCUMENTARY PLANNING (overrides conflicting general guidance):
- Every scene or War Chess overlay carries a short concrete "reason" and "brief". A mentioned noun alone is no reason.
- Search fields (subject/query/things) are short concrete subjects ("crankshaft"); intent goes in reason/brief.
- Contextual is enough: imagery that honestly fits the moment need not be the exact machine or event — but never
  label it as authentic evidence of a named model or event, and never fake an archival photo.
- Real imagery leads; AI illustration is rare and clearly illustrative. Never reuse the same subject media.
- Variety is the style: use the whole enabled catalogue across the video — every template, graphic type and text
  style where a moment honestly fits it. Prefer an unused or rarely used treatment over repeating a favourite;
  no single template above about 15% of the edits. Vox at most about a third of the substantial edits.
- Vox is a signature: one Vox collage in the hook when the narration explains how something works or connects
  several real things, then roughly one every one to two minutes where a passage explains a mechanism or relationship.
- Aim for about 40–50% of the time edited with useful text and templates; never invent an edit to hit it.
- The hook is the richest stretch; the body leaves room for real footage. Full scenes never overlap; overlays sit
  on readable footage, never on another text-bearing edit. Footage shots are at most five seconds.
"""
DOCUMENTARY_EDITING = DOCUMENTARY_PLANNING


LOOK_ASK = """
Also return, as the FIRST object, the look of this story's collage scenes:
{"tool": "look", "accent": "#hex — one strong accent colour that belongs to this story (a brand's colour, a flag, an era)",
 "stage": "one sentence: the paper-collage background of this story — the map, documents and textures it is laid on",
 "paper": "one sentence: the paper and print tone (e.g. yellowed 1980s newsprint, cold clinical white)"}
"""

DURATION = {"map": 7.0, "spotlight": 5.0, "object": 4.8, "headline": 6.5, "graphic": 6.5, "strip": 6.6, "press": 6.5, "matchcut": 4.6, "textcut": 5.0}
# how long before its words each module starts its scene (maps.LEAD_S, photofx SPOT_LEAD/OBJ_LEAD, headlines.LEAD_S):
# the plan keeps the real intervals apart, not the moments the words are said
LEAD = {"map": 1.6, "spotlight": 0.9, "object": 0.5, "headline": 1.3, "graphic": 0.15, "strip": 0.9, "press": 1.3, "matchcut": 0.5, "textcut": 0.3}
GRAPHIC_S = {"dateline": 5.0, "number": 6.0, "chart": 8.0, "timeline": 8.5, "quote": 7.5, "pivot": 4.6, "question": 4.2,
             "card": 5.6, "step": 3.2, "social": 5.2, "place": 4.4, "pull": 6.5, "table": 7.5}
ORDER = ("map", "matchcut", "textcut", "strip", "spotlight", "object", "headline", "press", "graphic", "vox", "war_chess", "legends", "heygen", "text")


def _pace(engine, style: str) -> dict:
    return ((getattr(engine, "STYLE_INFO", {}) or {}).get(style, {}) or {}).get("pacing") or {}


def hook_s(engine, style: str) -> float:
    """How long the hook runs: the channel's pacing.hook_s (a documentary series may open on two packed
    minutes), a minute by default."""
    try:
        return max(30.0, float(_pace(engine, style).get("hook_s") or INTRO_S))
    except (TypeError, ValueError):
        return INTRO_S


def _budget(engine, style: str, intro: bool, minutes: float, more: bool = None) -> str:
    """The budget for one stretch: the house rules, then the channel's own notes (pacing.hook_notes /
    pacing.body_notes), which win where they differ."""
    pace = _pace(engine, style)
    if intro:
        text = INTRO_BUDGET
        hook = hook_s(engine, style)
        if abs(hook - INTRO_S) > 1:
            span = f"{hook / 60:.0f} minutes" if hook % 60 == 0 else f"{hook:.0f} seconds"
            text = (text.replace("the first minute decides", f"the first {span} decide")
                        .replace("at least five\n  in this minute", "at least five\n  a minute")
                        .replace("in this minute", "per minute"))
        notes = str(pace.get("hook_notes") or "").strip()
    else:
        text = BODY_BUDGET.replace("[INSERT MIN HERE]", f"{minutes:.1f}")
        notes = str(pace.get("body_notes") or "").strip()
    if _styles.is_documentary(style):
        text = DOCUMENTARY_EDITING
        import warchess
        if warchess.enabled(engine, style):
            text = text.replace("- Leave at least 6 seconds of plain footage between scenes.", "")
            text += "\n" + warchess.RULES
        if MORE_EDITS if more is None else more:
            text = _more_edits(text)
    if notes:
        text += "\n- THIS CHANNEL'S RULES FOR THIS STRETCH (they win over the numbers above):\n  " + notes.replace("\n", "\n  ")
    return text


def _kit(engine, style: str) -> str:
    """The look kit of a style (kits.py), "" for the documentary graphics."""
    try:
        import kits
        return kits.kit_for_style(engine, style)
    except ImportError:
        return ""


def _graphic_s(engine, style: str, it: dict) -> float:
    """How long a graphic runs: the kit's own length for a kit style, else the documentary table."""
    t = str(it.get("type") or "")
    k = _kit(engine, style)
    if k:
        import kits
        return float(kits.durations(k).get(t, DURATION["graphic"]))
    return float(GRAPHIC_S.get(t, DURATION["graphic"]))


def _graphic_tool(engine, style: str) -> str:
    """The graphic tool's description for the prompt: the kit's scene types for a kit style."""
    k = _kit(engine, style)
    if k:
        import kits
        return kits.prompt_block(k).rstrip() + "\n"
    return TOOLS["graphic"]


def tools_on(engine, style=None) -> set:
    """The tools Options left ticked for this video (engine._FEATURES), each only if its module is here."""
    f = getattr(engine, "_FEATURES", {}) or {}
    use = lambda k: bool(f.get(k, True)) if f else True
    on = set()
    if use("maps") and (HERE / "maps.py").exists():
        on.add("map")
    if use("spotlight") and (HERE / "photofx.py").exists():
        on.add("spotlight")
    if use("objects") and (HERE / "photofx.py").exists():
        on.add("object")
    if use("headlines") and (HERE / "headlines.py").exists():
        on.add("headline")
    # the channel's own extras: Kodak strips (look.photofx.strip) and old newspapers (look.headlines.press)
    look = ((getattr(engine, "STYLE_INFO", {}) or {}).get(getattr(engine, "_STYLE_NOW", "") or "", {}) or {}).get("look") or {}
    if "spotlight" in on and isinstance(look.get("photofx"), dict) and look["photofx"].get("strip"):
        on.add("strip")
    if "spotlight" in on and isinstance(look.get("photofx"), dict) and look["photofx"].get("matchcut"):
        on.add("matchcut")
    if "spotlight" in on and isinstance(look.get("photofx"), dict) and look["photofx"].get("textcut"):
        on.add("textcut")
    if "headline" in on and isinstance(look.get("headlines"), dict) and look["headlines"].get("press"):
        on.add("press")
    if use("motion"):
        on.update({"graphic", "text"})
    import warchess
    if warchess.enabled(engine, getattr(engine, "_STYLE_NOW", "")):
        on.add("war_chess")
    import legends
    if legends.enabled(engine, getattr(engine, "_STYLE_NOW", "")):
        on.add("legends")
    if use("vox") and (HERE / "vox.py").exists():
        on.add("vox")
    import heygen_scenes
    if heygen_scenes.enabled(engine, style or getattr(engine, "_STYLE_NOW", "")):
        on.add("heygen")
    return on


def _stamp(t: float) -> str:
    t = max(0, int(t))
    return f"{t // 60}:{t % 60:02d}"


def sentences(script: str, wpm: float = 140.0) -> list:
    """[(start estimate, end estimate, sentence)] — the script as the voice will speak it, timed by word
    count. The director plans from these while the voice is still being recorded; the real times come
    from the subtitles afterwards (plan)."""
    import re as _re
    parts = [x.strip() for x in _re.split(r"(?<=[.!?…])\s+|\n+", script or "") if x.strip()]
    out, t = [], 0.0
    for x in parts:
        d = len(x.split()) / wpm * 60.0
        out.append((round(t, 2), round(t + d, 2), x))
        t += d
    return out


def _chunks(cues: list, total: float, hook: float = INTRO_S, tiers: bool = False) -> list:
    """[(lo, hi, intro)] — the hook, then stretches of CHUNK_S."""
    if tiers and total > RICH_S + 20:
        out, t = [(0.0, OPENING_S, True), (OPENING_S, RICH_S, True)], RICH_S
        while t < total - 5:
            out.append((t, min(total, t + CHUNK_S), False))
            t += CHUNK_S
        return out
    if tiers:                              # a short test: opening, then the rest of it as the rich hook
        return [(0.0, min(total, OPENING_S), True)] + ([(OPENING_S, total, True)] if total > OPENING_S + 5 else [])
    out = [(0.0, min(total, hook), True)]
    t = hook
    while t < total - 5:
        out.append((t, min(total, t + CHUNK_S), False))
        t += CHUNK_S
    return out


def _prompt(engine, title: str, cues: list, lo: float, hi: float, intro: bool, style: str, job: Path,
            offer: list = ()) -> str:
    import maps
    rules = maps.MOMENTS_PROMPT.split("Field rules:", 1)[1].split("TRANSCRIPT:", 1)[0]
    rules = rules.replace("[INSERT LANGUAGE HERE]", engine._job_language(job, style))
    rows = [f"#{i + 1} [{_stamp(st)}] {txt}" for i, (st, en, txt) in enumerate(cues) if lo - 0.01 <= st < hi]
    if not rows:
        return ""
    # the busier editing brief runs to the middle of the video, then it calms down to the earlier pace
    half = (float(cues[-1][1]) if cues else hi) / 2.0
    budget = _budget(engine, style, intro, (hi - lo) / 60, more=MORE_EDITS and lo < half)
    if _guide(style):
        # the guide only steers the text overlays (owner 2026-10-06); scenes are chosen from the content as before
        over_ = __import__("guide").overlay_text(job, style, lo, hi)
        if over_:
            budget += "\n" + over_
    if _tiers(style) and intro:
        budget += "\n" + (OPENING_NOTES if lo < OPENING_S - 0.01 else RICH_NOTES)
    if offer:
        budget += ("\n- Look in this stretch for a moment that genuinely fits one of these (skip any that do not fit): "
                   + ", ".join(offer) + ".")
    engine._STYLE_NOW = style
    on = tools_on(engine, style)
    tool_block = "".join((_graphic_tool(engine, style) if k == "graphic" else __import__("warchess").prompt_block(__import__("warchess").chess_on(engine, style)) if k == "war_chess" else __import__("legends").prompt_block(job, style, title) if k == "legends" else __import__("heygen_scenes").prompt_block(job) if k == "heygen" else TOOLS[k]) for k in ORDER if k in on)
    if _styles.is_documentary(style):
        tool_block = tool_block.replace(TOOLS["text"], """- text — a concise helpful overlay on fitting real footage:
  {"tool":"text","cue":2,"words":"finished components","style":"phrase",
   "text":"FINISHED PARTS","sub":"NOW THEY MUST FIT"}
  Supported styles: name, place, date, number, phrase. Use identification, quantities, contrasts,
  steps or a brief faithful explanatory phrase when it helps the viewer understand. No proper-term-only rule or arbitrary phrase count. Keep it readable and
  off conflicting text-bearing scenes; never use it as running narration subtitles.
""")
        tool_block = tool_block.replace("Both belong to how-to and advice videos.",
                                        "Documentary may also use them for helpful factual steps or explanation.")
        tool_block = tool_block.replace("One or two a minute in a story of the past; never twice for the same fact.",
                                        "Use only where the real report explains the beat; never twice for the same fact.")
        tool_block = tool_block.replace("EVERY partner the narration names gets their photo on the words that name them",
                                        "a partner gets a photo when identity or evidence needs it, on the words that name them")
        tool_block = tool_block.replace("a real photo of a real public person, place or documented event,",
                                        "a real photo of a real public person, place, documented event, or a named machine, "
                                        "model, factory or landmark object,")
        if _guide(style):
            # no once-per-video limits for the match cut and text cut (owner: not too strict)
            tool_block = (tool_block.replace("The\n  most electric way this channel introduces its main person — ONCE per video, on the first time the main subject is\n  named (right after the opening montage when there is one):",
                                             "For the main person or another major public figure, when first named:")
                                    .replace("Real photographs of a public person only; never a private person, never twice.",
                                             "Real photographs of a public person only; never a private person.")
                                    .replace("ONCE per video, on the passage where the facts pile up (the numbers of a career, the timeline of a\n  fall); never within 20 s of the match cut:",
                                             "On a passage where the facts pile up (the numbers of a career, the timeline of a fall):"))
        tool_block += ("\nEDITORIAL NOTES — situational guidance for enabled tools; not output fields or quotas:\n" +
                       "\n".join(f"  {k} — {DOCUMENTARY_NOTES[k]}" for k in ORDER
                                 if k in on and k in DOCUMENTARY_NOTES) + "\n")
    missing = [k for k in ORDER if k not in on and k not in ("strip", "press", "matchcut", "textcut")
               and not (k == "heygen" and not _styles.is_documentary(style))]
    if "press" in on:
        budget += ("\n- This story has old newspapers (press): use press, not headline, for anything the papers of the time reported;"
                   " headline only for a page from the internet era.")
    if missing:
        budget += "\n- Not available in this video, never use: " + ", ".join(missing) + "."
    base_prompt = PROMPT
    if _styles.is_documentary(style) or "war_chess" in on:
        base_prompt = base_prompt.replace("- Vary: never the same tool twice in a row, never the same kind of graphic twice in a row, and every scene shows a\n  DIFFERENT thing — never two objects or photos of the same car, product or person in one video.", "- Vary treatments purposefully. Follow the Documentary repetition and media rules below.")
    if _styles.is_documentary(style):
        base_prompt = base_prompt.replace(
            "- Premium graphics are the signature of this channel: in every minute, at least one graphic (a number, a timeline,\n  a dateline, a chart or a quote) on the figure or date that matters most.\n", "")
        match_rules = PROMPT.split("- Match the tool to the words:", 1)[1].split("- Timing is everything:", 1)[0]
        base_prompt = base_prompt.replace("- Match the tool to the words:" + match_rules,
                                          "- Select treatments by the explanatory need, following Documentary planning below.\n")
    extra = engine._extra_block()
    if _styles.is_documentary(style) and "vox" in on:
        from vox import DOCUMENTARY_RULES
        extra = "\n" + DOCUMENTARY_RULES + extra
    prompt = (base_prompt.replace("[INSERT TITLE HERE]", title or "")
              .replace("[INSERT TOOLS HERE]", tool_block)
              .replace("[INSERT MAP RULES HERE]", "\n".join("  " + l for l in rules.strip().splitlines()))
              .replace("[INSERT RANGE HERE]", f"{_stamp(lo)} to {_stamp(hi)}")
              .replace("[INSERT BUDGET HERE]", budget)
              .replace("[INSERT LOOK HERE]", LOOK_ASK if intro and "vox" in on else "")
              .replace("[INSERT EXTRA HERE]", extra)
              .replace("[INSERT TRANSCRIPT HERE]", "\n".join(rows)))
    return prompt


TEXT_STYLES = ("name", "place", "date", "number", "phrase")


def _kind(it: dict) -> str:
    """The treatment an item is, at the level variety is counted: a War Chess template, a graphic type, a text
    style, or the tool itself."""
    tool = str(it.get("tool") or "").lower()
    if tool == "legends":
        return f"legends {str(it.get('job') or it.get('edit') or '').strip()}".strip()
    sub = {"war_chess": "type", "graphic": "type", "text": "style"}.get(tool)
    return f"{tool} {str(it.get(sub) or '').strip()}".strip() if sub else tool


def _menu(engine, style: str, job: Path = None) -> list:
    """Every treatment this video can use, as _kind() names them."""
    on = tools_on(engine, style)
    out = []
    for k in ORDER:
        if k not in on or k == "look":
            continue
        if k == "war_chess":
            import warchess
            out += [f"war_chess {t}" for t in dict.fromkeys(re.findall(r"\b(?:WC|P)\d\d\b", warchess.prompt_block(warchess.chess_on(engine, style))))]
        elif k == "legends":
            import legends
            if legends.VARIETY:
                out += [f"legends {v}" for j in legends.JOBS for v in legends.variants(j)]
            else:
                out += [f"legends {j}" for j, look in legends.kit(job, style).items() if look != "movefast"] if job else []
            out += [f"legends {e}" for e, spec in legends.EDITS.items() if spec[0] is None]
        elif k == "graphic":
            out += [f"graphic {t}" for t in GRAPHIC_S if t != "social" and f'"type": "{t}"' in _graphic_tool(engine, style)]
        elif k == "text":
            out += [f"text {s}" for s in TEXT_STYLES]
        else:
            out.append(k)
    if _guide(style):
        no = __import__("guide").off(style)          # the guide's "no" templates are never offered (owner 2026-10-06)
        out = [m for m in out if m.replace(" ", ":", 1) not in no]
    return out


def _offers(menu: list, n: int, per: int = 4) -> list:
    """`per` treatments suggested to each of n stretches, dealt with a stride so a stretch gets a mix of kinds and
    every treatment is offered to several stretches spread across the video."""
    if not menu or n <= 0:
        return [[] for _ in range(n)]
    groups = {}
    for k in menu:                                   # tools, graphic types, War Chess templates, text styles
        groups.setdefault(k.split(" ")[0] if " " in k else "tool", []).append(k)
    seq, lanes = [], list(groups.values())
    while any(lanes):
        seq += [lane.pop(0) for lane in lanes if lane]
    return [list(dict.fromkeys(seq[(i * per + j) % len(seq)] for j in range(per))) for i in range(n)]


def _tally(items: list) -> dict:
    counts = {}
    for it in items:
        if it.get("tool") not in (None, "look", "war_chess_fx"):
            counts[_kind(it)] = counts.get(_kind(it), 0) + 1
    return counts


VOX_MAX_SHARE = 0.35      # owner rule: Vox is at most 35% of the substantial edits


def _cap_vox(engine, items: list) -> list:
    """Drop the most crowded Vox scenes (closest to another Vox) until Vox is at most VOX_MAX_SHARE of the
    substantial edits; their time falls back to footage. Code only — no model call."""
    def cue(it):
        try:
            return int(it.get("cue") or 0)
        except (TypeError, ValueError):
            return 0
    keep = list(items)
    while True:
        subst = [it for it in keep if it.get("tool") not in ("look", "text", "war_chess_fx")]
        vox = sorted((it for it in subst if it.get("tool") == "vox"), key=cue)
        if not subst or len(vox) <= VOX_MAX_SHARE * len(subst):
            break
        gap = lambda k: min([abs(cue(vox[k]) - cue(vox[j])) for j in (k - 1, k + 1) if 0 <= j < len(vox)] or [1e9])
        keep.remove(vox[min(range(len(vox)), key=gap)])
    if len(keep) < len(items):
        engine.log(f"  director: {len(items) - len(keep)} Vox scene(s) dropped to keep Vox within "
                   f"{VOX_MAX_SHARE:.0%} — their time stays footage")
    return keep


def _ask(engine, title: str, cues: list, lo: float, hi: float, intro: bool, style: str, job: Path,
         offer: list = ()) -> list:
    prompt = _prompt(engine, title, cues, lo, hi, intro, style, job, offer)
    if not prompt:
        return []
    try:
        items = engine._json_items(prompt, max_tokens=max(4000, sum(lo - 0.01 <= st < hi for st, _, _ in cues) * 300))
    except SystemExit as e:
        engine.log(f"  director: {_stamp(lo)}-{_stamp(hi)} did not parse — {str(e)[:100]}")
        return []
    return [x for x in items if isinstance(x, dict) and x.get("tool")]


def _time(engine, stream, rows: list, it: dict, clock: float = 1.0, end: bool = False):
    """Seconds where an item's words are spoken (or, end=True, where its end words finish). `rows` are the
    lines the director was shown — subtitle cues, or script sentences timed by word count, which `clock`
    turns into real seconds."""
    key_cue, key_words = ("end_cue", "end_words") if end else ("cue", "words")
    try:
        k = int(it.get(key_cue) or it.get("cue") or 0) - 1
    except (TypeError, ValueError):
        k = -1
    near = rows[k][0] / clock if 0 <= k < len(rows) else 0.0
    far = rows[k][1] / clock if 0 <= k < len(rows) else 1e9
    slack = 3.0 if clock == 1.0 else 12.0
    t = engine._find_line(stream, str(it.get(key_words) or ""), near, near - slack, far + slack, end=end)
    if t is None and 0 <= k < len(rows) and clock == 1.0:
        t = rows[k][1] if end else rows[k][0]
    return t


def draft(engine, script: str, job: Path, style: str, title: str = "") -> list:
    """The director's raw plan, made from the script alone — so it runs while the voice is recorded.
    Cached in director_raw.json; plan() times it against the subtitles."""
    with _LOCKS_GUARD:
        lock = _LOCKS.setdefault(str(job), threading.Lock())
    with lock:                    # the draft started beside the voice: a second caller waits for it
        return _draft(engine, script, job, style, title)


def _draft(engine, script: str, job: Path, style: str, title: str = "") -> list:
    raw = job / "director_raw.json"
    if raw.exists():
        try:
            return json.loads(raw.read_text(encoding="utf-8"))
        except ValueError:
            pass
    rows = sentences(script, float(getattr(engine, "WPM", 140)))
    if not rows:
        return []
    total = rows[-1][1]
    if not title and (job / "title.txt").exists():
        title = (job / "title.txt").read_text(encoding="utf-8").splitlines()[0]
    hook = hook_s(engine, style)
    import legends
    if _guide(style):
        import guide
        named = engine._named_for_guide(job) if hasattr(engine, "_named_for_guide") else []
        found = guide.prepare(job, style, rows, named, title).get("moments") or []
        engine.log(f"  guide: {len(found)} moment(s) found in the script, each with a suggested template")
    elif legends.enabled(engine, style):
        engine.log("  legends kit: " + ", ".join(f"{k}={v}" for k, v in legends.kit(job, style, title).items()))
    chunks = _chunks(rows, total, hook, _tiers(style))
    engine.log(f"Claude: directing the edit from the script — the first "
               f"{'minute' if hook == INTRO_S else f'{hook / 60:.1f} minutes'} as the hook, "
               f"then {len(chunks) - 1} stretch(es) side by side...")
    # variety without a quota: each stretch is asked to look for a fit for a few treatments, dealt round-robin
    menu_now = _menu(engine, style, job)
    if _guide(style):
        import guide
        # the overlays come from the guide's turn; the offers keep the scenes varied, as before
        menu_now = [k for k in menu_now if not guide.is_overlay(k.replace(" ", ":", 1))]
    offers = _offers(menu_now, len(chunks)) if _styles.is_documentary(style) else [[] for _ in chunks]
    # the library looks are the channel's signature: every stretch is also asked to look for two of them
    lib = [m for m in menu_now if m.startswith("legends ")]
    if lib and _styles.is_documentary(style) and not _guide(style):
        offers = [list(dict.fromkeys(o + [lib[(2 * i) % len(lib)], lib[(2 * i + 1) % len(lib)]])) for i, o in enumerate(offers)]
    with ThreadPoolExecutor(max_workers=min(4, len(chunks))) as ex:
        parts = list(ex.map(lambda c: _ask(engine, title, rows, c[1][0], c[1][1], c[1][2], style, job, c[0]),
                            zip(offers, chunks)))
    items = [x for part in parts for x in part]
    items = [dict(x, _rows="script") for x in items]
    raw.write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")
    return items


def _review(engine, items: list, script: str, rows: list, cues: list, job: Path,
            style: str, title: str) -> list:
    """One whole-video review; both success and failure are terminal until explicit scene clearing."""
    if not _styles.is_documentary(style) or not rows:
        return items
    with _LOCKS_GUARD:
        lock = _LOCKS.setdefault(str(job), threading.Lock())
    with lock:
        cache = job / "director_review.json"
        if cache.exists():
            record = json.loads(cache.read_text(encoding="utf-8"))
            if record.get("status") == "started":
                record.update(status="failed", error="Previous review was interrupted; no automatic retry")
                cache.write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf-8")
            engine.log(f"cached: director_review.json ({record.get('status')})")
            return record["reviewed_items"] if record.get("status") == "success" else record["original_draft"]
        record = {"status": "started", "original_draft": items, "reviewed_items": None, "error": None}
        cache.write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf-8")
        try:
            # The review sees the plan as numbered one-liners and answers with changes only: the whole plan as JSON
            # in and out cost ~75k tokens in and ~40k out; this is a fraction of both.
            edits = [it for it in items if it.get("tool") != "look"]
            menu = _menu(engine, style, job)
            counts = _tally(edits)
            unused = [k for k in menu if not counts.get(k)]
            long_video = rows[-1][1] > 900

            def one(i, it):
                said = it.get("text") or it.get("line") or it.get("title") or it.get("subject") or it.get("value") or ""
                return (f"#{i} c{it.get('cue')} | {_kind(it)} | {str(it.get('words') or '')[:40]} | "
                        f"{str(said)[:40]}")
            prompt = _prompt(engine, title, rows, 0, rows[-1][1] + .01, False, style, job)
            prompt += ("\n\nWHOLE-VIDEO REVIEW — one pass over the merged drafts of every stretch.\n"
                       "Improve the edit across the whole video: variety (use the whole catalogue, prefer an unused or rare "
                       "treatment over another repeat, no single template above about 15% of edits), missed moments that "
                       "fit a treatment honestly, and conflicts (scenes that overlap, overlays on text-bearing edits). "
                       "Keep strong choices. Replace a repeat rather than add when the video is already busy. "
                       "Vox at most about a third of the substantial edits.\n" +
                       ("Keep the text overlays for the moments MoveFast found unless two truly overlap on screen.\n"
                        if _guide(style) else "") +
                       ("This video is over 15 minutes: give every NEVER USED treatment below its single best-fitting "
                        "moment — skip one only when nothing in the narration honestly fits it.\n" if long_video else "") +
                       "CURRENT PLAN (#id cue | treatment | words | text):\n" +
                       "\n".join(one(i, it) for i, it in enumerate(edits)) +
                       "\nUSED SO FAR: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items(), key=lambda x: -x[1])) +
                       "\nNEVER USED: " + (", ".join(unused) or "none") +
                       "\nCREATOR INSTRUCTIONS (preserve):" + engine._extra_block() +
                       '\nReturn ONLY one JSON object: {"drop": [ids to remove], "add": [new tool objects in the usual '
                       'shape, SCRIPT cue numbers and exact cue words, each scene with reason and brief]}. '
                       'Return {"drop": [], "add": []} when nothing should change.')
            engine.log(f"Claude: reviewing the whole edit — {len(edits)} edits, {len(unused)} treatments never used...")
            # Bypass _json_items: its parse/provider retries would repeat this review.
            response = engine.claude(prompt, engine.UTILITY_MODEL, max_tokens=8000, provider=engine.CLAUDE_PROVIDER)
            change = engine._json_obj(response)
            if not isinstance(change, dict) or not isinstance(change.get("drop", []), list) \
                    or not isinstance(change.get("add", []), list):
                raise ValueError("Review returned no drop/add object")
            engine._STYLE_NOW = style
            allowed = tools_on(engine, style)
            if "war_chess" in allowed:
                allowed.add("war_chess_fx")
            added, rejected = [], 0
            for it in change.get("add") or []:
                # an addition with a tool this video cannot use is left out; the rest of the review still counts
                if not isinstance(it, dict) or it.get("tool") not in allowed:
                    rejected += 1
                    continue
                # reason and brief are notes only: a missing one takes the cue words (owner 2026-10-06)
                it = dict(it, **{key: it.get(key) or it.get("words") or "" for key in ("reason", "brief")})
                added.append({**{k: v for k, v in it.items() if not k.startswith("_") and
                                 k not in ("t", "end", "t0", "t1", "at_s")}, "_rows": "script"})
            drop = {int(str(i).lstrip("#")) for i in change.get("drop") or [] if str(i).lstrip("#").isdigit()}
            reviewed = ([it for it in items if it.get("tool") == "look"] +
                        [it for i, it in enumerate(edits) if i not in drop] + added)
            after = _tally(reviewed)
            still = [k for k in menu if not after.get(k)]
            record.update(status="success", reviewed_items=reviewed)
            engine.log(f"  director: review dropped {len(drop)}, added {len(added)}"
                       + (f" ({rejected} addition(s) with an unusable tool left out)" if rejected else "") + "; "
                       f"{len(menu) - len(still)}/{len(menu)} treatments used"
                       + (f" — no fitting moment for: {', '.join(still)}" if still else ""))
        except (Exception, SystemExit) as exc:
            record.update(status="failed", error=str(exc)[:1000])
            engine.log(f"  director: whole-video review failed; keeping merged draft — {str(exc)[:160]}")
        cache.write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf-8")
        return record["reviewed_items"] if record["status"] == "success" else items


def as_label(it: dict):
    """The text label a scene becomes when there is no room for the scene itself — or None."""
    tool, kind = it.get("tool"), str(it.get("type") or "")
    def clean(v, n):
        t = re.sub(r"\s+", " ", str(v or "")).strip()
        return t if len(t) <= n else t[:n].rsplit(" ", 1)[0].rstrip(",;:-")
    if tool == "graphic" and kind == "number":
        try:
            v = float(str(it.get("value")).replace(",", ""))
        except (TypeError, ValueError):
            return None
        dec = len(str(it.get("value")).split(".")[1]) if "." in str(it.get("value")) else 0
        txt = f"{clean(it.get('prefix'), 4)}{v:,.{dec}f}{clean(it.get('suffix'), 6)}"
        return {"style": "number", "text": txt, "sub": clean(" ".join(x for x in (it.get("unit"), it.get("context")) if x), 44)}
    if tool == "graphic" and kind == "social" and it.get("from") and it.get("to"):
        verb = "UNFOLLOWED" if str(it.get("action") or "unfollow") == "unfollow" else "FOLLOWED"
        return {"style": "phrase", "text": verb, "sub": clean(f"{it.get('from')} · {it.get('to')}", 44)}
    if tool == "graphic" and kind == "chart":
        bars = [b for b in (it.get("bars") or []) if isinstance(b, dict)]
        hl = it.get("highlight") if isinstance(it.get("highlight"), int) else 0
        if not bars:
            return None
        b = bars[hl if 0 <= hl < len(bars) else 0]
        unit = clean(it.get("unit"), 10)
        return {"style": "number", "text": f"{clean(b.get('value'), 12)}{' ' if unit[:1].isalpha() else ''}{unit}",
                "sub": clean(f"{b.get('label') or ''} · {it.get('title') or ''}".strip(" ·"), 44)}
    if tool == "graphic" and kind == "dateline":
        return {"style": "date", "text": clean(it.get("date") or it.get("place"), 30),
                "sub": clean(it.get("place") if it.get("date") else it.get("note"), 44)} if (it.get("date") or it.get("place")) else None
    if tool == "graphic" and kind in ("pivot", "question") and it.get("line"):
        line = re.sub(r"\s+", " ", str(it.get("line"))).strip()
        return {"style": "phrase", "text": line.upper(), "sub": ""} if len(line) <= 34 else None
    if tool in ("spotlight", "strip", "matchcut", "textcut") and it.get("subject"):
        return {"style": "name", "text": clean(it.get("subject"), 30).upper(), "sub": ""}
    if tool == "press" and it.get("year"):
        return {"style": "date", "text": clean(it.get("year"), 12), "sub": clean(it.get("claim"), 44)}
    if tool == "graphic" and kind == "place" and it.get("place"):
        return {"style": "place", "text": clean(it.get("place"), 30).upper(), "sub": clean(it.get("sub"), 44)}
    if tool == "map" and it.get("title"):
        return {"style": "place", "text": clean(it.get("title"), 30).upper(), "sub": clean(it.get("subtitle"), 44)}
    if tool == "legends":
        import legends
        lab = legends._plain_label(it)
        return {k: v for k, v in lab.items() if k != "dur"} if lab else None
    return None


def plan(engine, srt: Path, job: Path, style: str, title: str = "") -> dict:
    """Direct the video and write every tool's moments. Cached in director.json."""
    out = job / "director.json"
    if out.exists():
        try:
            return json.loads(out.read_text(encoding="utf-8"))
        except ValueError:
            pass
    cues = engine._parse_srt_full(srt.read_text(encoding="utf-8"))
    if not cues:
        return {}
    total = cues[-1][1]
    script = (job / "script.txt").read_text(encoding="utf-8") if (job / "script.txt").exists() else ""
    items = draft(engine, script, job, style, title) if script else []
    rows = sentences(script, float(getattr(engine, "WPM", 140)))
    items = _review(engine, items, script, rows, cues, job, style, title)
    if _styles.is_documentary(style):
        items = _cap_vox(engine, items)
    clock = (rows[-1][1] / total) if rows and total > 0 else 1.0
    clock = clock if 0.5 <= clock <= 2.0 else 1.0
    clock = clock if clock != 1.0 else 1.0000001     # script rows: always the wide search
    stream = engine._spoken_stream(cues)
    look = next((x for x in items if x.get("tool") == "look"), {})
    hook = hook_s(engine, style)
    # time every item, keep scenes apart, labels off the scenes
    scenes, labels, wc_overlays = [], [], []
    import warchess
    wc_on = warchess.enabled(engine, style)
    import heygen_scenes
    heygen_on = heygen_scenes.enabled(engine, style)
    heygen_policy = heygen_scenes.policy(job) if heygen_on else None
    import legends
    lg_on = legends.enabled(engine, style)
    lg_overlays, block = [], {}
    if lg_on:
        # the library look chosen for a job this video replaces MoveFast's own treatment of that job
        block, before = legends.blocked(legends.kit(job, style, title)), len(items)
        items = [it for it in items if not (str(it.get("tool")) in block and str(it.get("type") or it.get("style") or "") in block[str(it.get("tool"))])]
        if len(items) < before:
            engine.log(f"  director: {before - len(items)} treatment(s) handed to this video's library looks")
    for it in items:
        tool = str(it.get("tool")).lower()
        if tool == "look":
            continue
        t = _time(engine, stream, rows, it, clock)
        if t is None:
            continue
        t = float(t)
        it["_w"] = round(t, 2)                       # when its words are said — what the modules time on
        if tool == "heygen":
            if (not heygen_on or not heygen_scenes.fits(t, 5.0, heygen_policy, total)
                    or not all(isinstance(it.get(k), str) and it[k].strip() for k in ("words", "reason", "brief", "prompt"))):
                continue
            # Generated footage stays on its aligned words; overlap handling may omit it, never move it.
            it["_t"], it["_end"] = t, t + 5.0
        elif tool in ("war_chess", "war_chess_fx"):
            if not wc_on or (tool == "war_chess" and it.get("type") not in warchess.CATALOG):
                continue
            # Owner rule: chess boards belong to the War Chess channel; Documentary never shows one.
            if it.get("type") == "WC06" and not warchess.chess_on(engine, style):
                engine.log("director: chess board dropped — chess boards are War Chess only")
                continue
            try:
                dur = warchess.duration(it)
            except (KeyError, TypeError, ValueError):
                continue
            if t + dur > total:
                continue
            it["_t"], it["_end"] = round(t, 2), round(t + dur, 2)
            if warchess.is_overlay(it):
                wc_overlays.append(it)
                continue
        elif tool == "legends":
            if not lg_on or not legends.edit_of(it, job, style):
                continue
            dur = legends.duration(it, job, style)
            if t + dur > total:
                continue
            it["_t"], it["_end"] = round(t, 2), round(t + dur, 2)
            if legends.is_overlay(it, job, style):
                lg_overlays.append(it)
                continue
        elif tool == "vox":
            t1 = _time(engine, stream, rows, it, clock, end=True)
            if t1 is None or t1 - t < 5.0:
                continue
            it["_t"] = round(max(0.0, t - 0.12), 2)
            # a collage in the hook is a beat, not a chapter: the minute has more to show
            it["_end"] = round(min(float(t1) + 0.35, t + (11.0 if t < hook else 16.0), total - 0.5), 2)
        elif tool == "text":
            it["_t"] = it["_w"]
            labels.append(it)
            continue
        elif tool in DURATION:
            dur = _graphic_s(engine, style, it) if tool == "graphic" else DURATION[tool]
            if tool == "graphic" and it.get("type") == "quote" and len(str(it.get("quote") or "")) <= 40:
                dur = 4.6                              # three words need no seven seconds
            it["_t"] = round(max(0.0, t - LEAD[tool]), 2)
            it["_end"] = round(it["_t"] + dur, 2)
        else:
            continue
        scenes.append(it)
    scenes.sort(key=lambda x: x["_t"])
    # a dateline on the same moment as a map: the map says the date in its subtitle, and the dateline goes
    for dl in [x for x in scenes if x["tool"] == "graphic" and x.get("type") == "dateline"]:
        mp = next((x for x in scenes if x["tool"] == "map" and abs(x["_w"] - dl["_w"]) <= 6.0), None)
        if mp is not None and (dl.get("date") or "").strip():
            years = set(re.findall(r"\b\d{4}\b", str(dl.get("date"))))
            if not (years and years & set(re.findall(r"\b\d{4}\b", str(mp.get("subtitle") or "")))):
                mp["subtitle"] = " · ".join(v for v in (str(dl.get("date") or "").strip(),
                                                        str(mp.get("subtitle") or "").strip()) if v)[:60]
            scenes.remove(dl)
            engine.log(f"  director: the date {dl.get('date')!r} rides on the map at {_stamp(mp['_w'])}")
    # overlapping scenes: the more telling tool keeps its moment (a map before a dateline on the same
    # words, a collage before a photo); the other may slide a few seconds later if its sentence runs on
    # a real photo of the person is worth as much as a graphic (viewers stay for faces); objects and pages a little less
    rank = {"map": 4.5, "vox": 4.5, "graphic": 4, "spotlight": 4, "object": 3.5, "headline": 3.5, "strip": 4.6, "press": 4.2, "matchcut": 4.8, "textcut": 4.4, "war_chess": 4.5, "legends": 4.5}

    def what(x):
        """The thing a scene shows, to catch the same thing twice (three objects of one car)."""
        key = x.get("things") or x.get("subject") or ""
        if not key and isinstance(x.get("places"), list) and x["places"] and isinstance(x["places"][0], dict):
            key = x["places"][0].get("name") or ""
        if isinstance(key, list):
            key = " ".join(str(k) for k in key[:1])
        stop = {"the", "and", "with", "photo", "car", "race", "racing", "number", "real", "old", "new", "image"}
        return {w for w in re.findall(r"[a-z0-9]+", str(key or "").lower()) if len(w) > 1 and w not in stop}

    def same(a, b):
        return bool(a and b) and len(a & b) / min(len(a), len(b)) >= 0.6

    near_s = max(15.0, min(60.0, total / 4.0))      # "nearby" in a one-minute video is a quarter of it

    def worth(x):
        # Documentary keeps useful repeated treatments; other styles retain their local variety scoring.
        near = [k for k in kept if abs(k["_t"] - x["_t"]) < near_s]
        if x["tool"] == "graphic" and x.get("type") in ("step", "card"):
            base = 5.0 if x.get("type") == "step" else 4.6
            if _styles.is_documentary(style):
                return base
            return base - 1.6 * sum(
                1 for k in near if k["tool"] == "graphic" and k.get("type") == x.get("type") == "card")
        def family(item):
            return (item["tool"], item.get("type")) if wc_on and item["tool"] in ("graphic", "war_chess") else item["tool"]
        repeated = sum(1 for k in near if family(k) == family(x))
        score = rank.get(x["tool"], 1)
        if not _styles.is_documentary(style):
            score -= (0.4 if wc_on and x.get("reason") else 1.6) * repeated
        # a strip of photos of the main person and, later, a spotlight of them are different scenes; two strips are not
        pool = [k for k in kept if (k["tool"] == x["tool"]) or (x["tool"] not in ("strip", "press", "matchcut", "textcut") and k["tool"] in ("object", "spotlight"))]
        if not wc_on and any(same(what(k), what(x)) for k in pool):
            score -= 4.0                      # the same thing again
        return score

    # Documentary's coverage target is editorial guidance, not a veto on useful reviewed scenes.
    # Other styles retain their footage share caps.
    pace = _pace(engine, style)
    cap_hook, cap_body = float(pace.get("scene_share_hook") or 0.62), float(pace.get("scene_share_body") or 0.42)

    def share_cap(t):
        return cap_hook if t < (RICH_S if _tiers(style) else hook) or total <= hook + 40.0 else cap_body

    def covered(t):
        if total <= hook + 40.0:             # a short video is all hook: one stretch
            lo, hi = 0.0, total
        else:
            lo = 0.0 if t < hook else hook + CHUNK_S * math.floor((t - hook) / CHUNK_S)
            hi = min(total, hook if t < hook else lo + CHUNK_S)
        span = max(1.0, hi - lo)
        used = sum(max(0.0, min(k["_end"], hi) - max(k["_t"], lo)) for k in kept)
        return used / span, span

    kept, dropped, todo, lost = [], [], list(scenes), []
    if total < 90.0:
        # a short video opens on its strongest real picture: a map in its first seconds becomes a place label
        for x in [x for x in todo if x["tool"] == "map" and x["_t"] < 5.0]:
            todo.remove(x)
            lost.append(x)
            dropped.append(f"map@{_stamp(x['_t'])} (a short video opens on real footage)")
    while todo:
        it = max(todo, key=lambda x: (worth(x), -x["_t"]))
        todo.remove(it)
        if it["tool"] == "heygen" and sum(x["tool"] == "heygen" for x in kept) >= heygen_policy["max_clips"]:
            dropped.append(f"heygen@{_stamp(it['_t'])} (whole-video ceiling)")
            continue
        if worth(it) < -1.5:
            dropped.append(f"{it['tool']}@{_stamp(it['_t'])}")
            continue
        length = it["_end"] - it["_t"]
        share, span = covered(it["_t"])
        if not _styles.is_documentary(style) and share + length / span > share_cap(it["_t"]) + 0.02:
            dropped.append(f"{it['tool']}@{_stamp(it['_t'])} (room for footage)")
            lost.append(it)
            continue
        # the hook cuts from scene to scene; later the footage breathes between them
        gap = 0.4 if it["_t"] < hook else 1.0
        # a scene about a named person/thing stays in its own sentence (owner 2026-10-05): it may slide about a second,
        # never into the next sentence's words — a photo of it is shown when it is named anyway
        about_named = MORE_EDITS and (it["tool"] in ("spotlight", "object", "strip", "matchcut", "press") or
                                      (it["tool"] == "legends" and str(it.get("job") or it.get("edit") or "") in
                                       ("name-label", "object-label", "typed-label", "portrait-name", "inset-portrait",
                                        "portrait-quote", "double-portrait", "paper-label")) or
                                      (it["tool"] == "war_chess" and it.get("type") in ("WC12", "WC08")))
        shifts = (0.0,) if it["tool"] == "heygen" else ((0.0, 0.5, 1.0) if about_named else (0.0, 1.0, 2.0, 3.0, 4.5))
        for shift in shifts:
            a, b = it["_t"] + shift, it["_end"] + shift
            if it["tool"] == "heygen" and not heygen_scenes.fits(a, b - a, heygen_policy, total):
                continue
            if b <= total - 0.3 and not any(a < k["_end"] + gap and k["_t"] < b + gap for k in kept):
                if shift:
                    it = dict(it, _t=round(a, 2), _end=round(a + length, 2), _w=round(it["_w"] + shift, 2))
                kept.append(it)
                break
        else:
            dropped.append(f"{it['tool']}@{_stamp(it['_t'])}")
            lost.append(it)
    kept.sort(key=lambda x: x["_t"])
    if _guide(style):
        # tier budgets over every edit — scenes and the library's over-footage edits counted together
        allowed_ = __import__("guide").enforce(engine, kept + lg_overlays, style)
        # an edit over the budget keeps its words as a plain label (below) instead of leaving its time bare
        lost += [x for x in kept + lg_overlays if not any(x is y for y in allowed_)]
        kept = [x for x in kept if any(x is y for y in allowed_)]
        lg_overlays = [x for x in lg_overlays if any(x is y for y in allowed_)]
    toks = lambda v: set(re.findall(r"[a-z0-9]+", engine._fold(str(v or "")))) - {"the", "of", "and"}
    # a spotlight names its person, as a documentary does, unless a label already says who it is
    for sp in [x for x in kept if x["tool"] in ("spotlight", "strip", "matchcut") and x.get("subject")]:
        name = re.sub(r"\s+", " ", str(sp["subject"])).strip()
        if len(name.split()) <= 4 and not any(abs(x["_t"] - sp["_w"]) < 4.0 and x.get("style") == "name"
                                              and toks(x.get("text")) & toks(name) for x in labels):
            labels.append({"tool": "text", "style": "name", "text": name.upper(), "sub": "", "_t": sp["_w"] + 0.4,
                           "_w": sp["_w"] + 0.4, "_rank": 1})
    # a scene left out for room still had words worth seeing: its figure, date, name or place becomes a label
    have = {str(x.get("text") or "").strip().lower() for x in labels}
    for it in lost:
        lab = as_label(it)
        if lab and lab["text"].lower() not in have:
            have.add(lab["text"].lower())
            labels.append(dict(lab, tool="text", _rank=2, _t=it.get("_w", it["_t"]), _w=it.get("_w", it["_t"])))
    if dropped:
        engine.log(f"  director: {len(dropped)} scene(s) left out — {', '.join(dropped[:8])}")
    labels = [x for x in labels if str(x.get("style") or "") not in block.get("text", ())]
    # a label may sit on a real photo or object (a name on the spotlight); never on a scene with its own words
    busy = [(x["_t"] - 0.5, x["_end"] + 0.5) for x in kept if x["tool"] not in ("spotlight", "object", "strip")]
    # ...but a name only on the photo of that person: "FATI VÁZQUEZ" still on screen as Bad Gyal's photo comes in
    # names the wrong woman
    pictured = [(x["_t"] - 0.3, x["_end"] + 0.3, toks(x.get("subject") or x.get("things") or x.get("words")))
                for x in kept if x["tool"] in ("spotlight", "object", "strip", "matchcut")]
    placed_labels = []

    def sentence_end(t):
        # when the sentence spoken at t ends: its words timed through their cues by their letters
        for st, en, txt in cues:
            if en <= t:
                continue
            ws = (txt or "").split()
            weights = [len(re.sub(r"\W", "", w)) + 1 for w in ws]
            tot, acc = float(sum(weights) or 1), 0
            for word, wt in zip(ws, weights):
                acc += wt
                done = st + (en - st) * acc / tot
                if done > t + 0.05 and re.search(r"[.!?][\"')\]]*$", word):
                    return done
        return None

    def free(t, d, x):
        if x.get("style") == "name" and any(a < t + d and t < b and not (who & toks(x.get("text")))
                                            for a, b, who in pictured):
            return False
        return (t >= 0 and t + d <= total - 0.2 and not any(a < t + d and t < b for a, b in busy)
                and not any(t < y["_t"] + y["dur"] + 0.3 and y["_t"] < t + d + 0.3 for y in placed_labels))

    # the director's own labels first, then the names on spotlights, then the ones made from scenes left out
    for x in sorted(labels, key=lambda x: (x.get("_rank", 0), x["_t"])):
        # on its words if there is room; else a little early, or shorter, or just after the scene in the way —
        # still within a few seconds of its words
        w, spot = x["_t"], None
        after = [b for a, b in busy if a < w + 3.6 and w < b]
        tries = [(w + off, d) for d in (3.6, 3.2, 2.8) for off in (0.0, -0.8, 0.4, 0.8, -1.6, 1.4)] + \
            [(b, 3.2) for b in sorted(after)]
        for t, d in tries:
            if t - w <= 8.0 and free(t, d, x):
                spot = (t, d)
                break
        if not spot:
            # squeezed into the room between the label before and the scene after, never shorter than 2.2 s
            room = [(round(w + k * 0.1, 2), d) for d in (3.4, 3.0, 2.6, 2.2) for k in range(-20, 11)]
            spot = next(((t, d) for t, d in sorted(room, key=lambda td: (-td[1], abs(td[0] - (w - 0.4))))
                         if free(t, d, x)), None)
        if spot:
            t, d = spot
            # a label is gone soon after its sentence: "UNCONFIRMED" must not stay on screen into "Then it gets
            # official", nor a name over the next story's footage (a name keeps a moment longer to be read)
            end, grace = sentence_end(x.get("_w", w)), (1.2 if x.get("style") == "name" else 0.3)
            if end is not None and t + d > end + grace:
                d = round(max(2.2, end + grace - t), 2)
            placed_labels.append(dict(x, _t=round(t, 2), dur=d))
    labels = placed_labels
    # hand each tool its moments, in the shape its own planner writes
    def cue_at(t):
        return next((i + 1 for i, (a, b, _) in enumerate(cues) if a - 0.05 <= t < b + 0.05), len(cues))

    def strip(x):
        d = {k: v for k, v in x.items() if k not in ("tool", "_t", "_end", "_rows")}
        if "_t" in x:
            w = x.get("_w", x["_t"])
            d.pop("_w", None)
            d["cue"] = cue_at(w)
            d["at_s"] = w
            if "end_cue" in d:
                te = _time(engine, stream, rows, x, clock, end=True)
                d["end_cue"] = cue_at(te) if te is not None else d["cue"]
        return d
    # a short video cannot spend a quarter of itself on a map: it runs a fifth of the video, 4.5 seconds at least
    maps_m = [dict(strip(x), **({"dur": round(max(4.5, min(7.0, total * 0.2)), 1)} if total < 90 else {}))
              for x in kept if x["tool"] == "map"]
    photo_m = [dict(strip(x), kind="spotlight" if x["tool"] == "spotlight" else "strip" if x["tool"] == "strip"
                    else "matchcut" if x["tool"] == "matchcut" else "textcut" if x["tool"] == "textcut" else "object")
               for x in kept if x["tool"] in ("spotlight", "object", "strip", "matchcut", "textcut")]
    head_m = [dict(strip(x), **({"kind": "press"} if x["tool"] == "press" else {})) for x in kept if x["tool"] in ("headline", "press")]
    doc_m = [strip(x) for x in kept if x["tool"] == "graphic"]
    vox_m = [{"t0": x["_t"], "t1": x["_end"],
              "text": " ".join(txt for _, _, txt in engine._cues_between(cues, x["_t"], x["_end"])),
              **{k: x[k] for k in ("reason", "brief", "media") if k in x}}
             for x in kept if x["tool"] == "vox"]
    vox_m = [m for m in vox_m if len(m["text"].split()) >= 6]
    text_m = [{"t": x["_t"], "dur": x.get("dur", 3.6), "style": str(x.get("style") or "phrase"),
               "text": str(x.get("text") or "")[:60], "sub": str(x.get("sub") or "")[:70]} for x in labels if x.get("text")]
    wc_m = [dict(x, t=x["_t"], end=x["_end"]) for x in kept + wc_overlays
            if x["tool"] in ("war_chess", "war_chess_fx")]
    lg_m = [dict(x, t=x["_t"], end=x["_end"]) for x in sorted(kept + lg_overlays, key=lambda x: x["_t"]) if x["tool"] == "legends"]
    if lg_on:
        (job / "legends").mkdir(parents=True, exist_ok=True)
        (job / "legends" / "moments.json").write_text(json.dumps(lg_m, indent=1, ensure_ascii=False), encoding="utf-8")
    if heygen_on:
        # This prepared plan is cleared on replan; paid state/assets in heygen/ are preserved.
        (job / "heygen" / "moments.json").write_text(json.dumps(
            [dict(strip(x), at_s=x["_t"], dur=5.0) for x in kept if x["tool"] == "heygen"],
            indent=1, ensure_ascii=False), encoding="utf-8")
    for folder, name, data in (("war_chess", "moments.json", wc_m), ("maps", "moments.json", maps_m), ("photofx", "moments.json", photo_m),
                               ("headlines", "moments.json", head_m), ("vox_scenes", "moments.json", vox_m)):
        (job / folder).mkdir(parents=True, exist_ok=True)
        (job / folder / name).write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    (job / "motion").mkdir(exist_ok=True)
    (job / "motion" / "doc_scenes.json").write_text(json.dumps({"director": True, "items": doc_m}, indent=1,
                                                              ensure_ascii=False), encoding="utf-8")
    if look:
        (job / "vox_scenes" / "look.json").write_text(json.dumps(strip(look), indent=1, ensure_ascii=False),
                                                     encoding="utf-8")
    (job / "overlays.json").write_text(json.dumps(text_m, indent=1, ensure_ascii=False), encoding="utf-8")
    result = {"scenes": [{"tool": x["tool"], "t": x["_t"], "end": x["_end"], "words": x.get("words")} for x in kept],
              "labels": text_m, "look": strip(look)}
    out.write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
    counts = {}
    for x in kept:
        counts[x["tool"]] = counts.get(x["tool"], 0) + 1
    engine.log("  director: " + ", ".join(f"{v} {k}" for k, v in counts.items()) + f", {len(text_m)} text labels")
    return result
