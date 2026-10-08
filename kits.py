#!/usr/bin/env python3
"""kits.py — LOOK KITS: eight complete graphics languages, one per channel style.

A kit is a family of animated scenes that share one design system — its own fonts, palette, grounds,
layout and motion — so a channel built on it looks nothing like a channel built on another one:

    dossier     true crime / internet mysteries: a black table, typed alerts, red crosshairs, gold serif names
    kinetic     essays and business: the words are the picture — big single words, white pages, phone cards
    atlas       playful history: a thick-outline cartoon world, a time machine bar, a flipchart, paint wipes
    deep        military and tech mysteries: teal and orange, stencil datelines, sonar, cutaways, a map room
    frontline   NEWS — geopolitics: broadcast lower thirds, boxed labels, arrows over relief, a dated timeline, tickers
    legend      first-person sports and celebrity stories: numbered chapters, lower thirds, scorecards
    hustle      make-money and youth business: glossy black, glow, 3D icons, segmented bars, counters
    tape        creator-culture commentary: a dark studio, player windows, subscriber counters, posts, timelines

A style turns a kit on with `"look": {"graphics": "kit", "kit": "dossier"}`. The director (director.py)
then offers this kit's scene types instead of the documentary ones, and make_video routes the graphics
step here. Each scene is an HTML page rendered frame by frame in Chromium — the same contract as every
MoveFast scene: everything on screen is computed from t alone (window.renderFrame(t)).

The scene JavaScript lives in assets/kits/<kit>.js: `build(S)` lays the scene out once, `frame(t)` moves it.
The fonts are bundled TTFs in assets/fonts/ (OFL / Apache), embedded into the page as base64 so the render
is identical on Windows, macOS and a rented Linux pod.

    python kits.py preview dossier            -> preview/kits/dossier_<type>.mp4 + .png for every scene type
    python kits.py preview all
    python kits.py check                      -> renders one frame of every type of every kit, reports JS errors
"""

import base64
import io as _io
import json
import math
import re
import shutil
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as _np
from PIL import Image as _Image

HERE = Path(__file__).resolve().parent
FONTS = HERE / "assets" / "fonts"
KIT_DIR = HERE / "assets" / "kits"
W, H, FPS = 1920, 1080, 30
SHUTTER = 3                 # sub-frames averaged per frame: motion blur on everything that moves (1 = off)

# ── the kits ─────────────────────────────────────────────────────────────────────
# fonts: (css family, file in assets/fonts, weight range, style) — embedded into the page
# types: scene type -> seconds
# prompt: what the designer / director may ask for, one JSON example per type (the fields the JS reads)
# sound: type -> [(second, sound, dB)] for sfx.py
KITS = {
    "dossier": {
        "label": "DOSSIER",
        "fonts": [("Kit Type", "SpecialElite.ttf", "400", "normal"), ("Kit Mono", "CourierPrime.ttf", "400", "normal"),
                  ("Kit Mono", "CourierPrime-Bold.ttf", "700", "normal"), ("Kit Serif", "Cinzel.ttf", "400 900", "normal"),
                  ("Kit Tele", "ShareTechMono.ttf", "400", "normal")],
        "palette": {"ink": "#EDE6D6", "red": "#E3231B", "marker": "#F5E14A", "gold": "#D9B25F", "paper": "#EDE6D6",
                    "blue": "#3B6FD9"},
        "types": {"alert": 6.5, "crosshair": 5.0, "disclaimer": 5.5, "title_gold": 5.0, "tracker": 5.5,
                  "dialogue": 6.5, "stack": 6.5, "stamp": 4.0},
        "prompt": """- graphic — a DOSSIER graphic (4-7 s), one of:
  {"tool": "graphic", "cue": 4, "words": "...", "type": "alert", "head": "CODE RED", "sub": "U.S. EMBASSY", "lines": ["URGENT ALERT", "ALL CITIZENS IN AFGHANISTAN"], "stamp": "EVACUATE NOW", "body": "one or two sentences of the real notice, warning or message, typed out"}
  {"tool": "graphic", "cue": 8, "words": "...", "type": "crosshair", "label": "PROOF", "icon": "folder", "sub": "13 Aug 2021"}
  {"tool": "graphic", "cue": 1, "words": "...", "type": "disclaimer", "title": "DISCLAIMER", "body": "two short sentences: what this video documents and that it endorses nothing", "foot": "VIEWER DISCRETION IS ADVISED"}
  {"tool": "graphic", "cue": 6, "words": "...", "type": "title_gold", "name": "MILES", "sub": "a 4chan user from Birmingham"}
  {"tool": "graphic", "cue": 11, "words": "...", "type": "tracker", "name": "Mary Jo Bailey", "tag": "SUSPECT", "year": "2022", "subject": "Mary Jo Bailey", "query": "Mary Jo Bailey arrest bodycam"}
  {"tool": "graphic", "cue": 15, "words": "...", "type": "dialogue", "a": "OFFICER", "b": "SUSPECT", "lines": [{"who": "a", "text": "we have a warrant for your arrest"}, {"who": "b", "text": "I got some appointments I'm supposed to be at"}]}
  {"tool": "graphic", "cue": 19, "words": "...", "type": "stack", "docs": [{"title": "4chan /pol/ — 13 Aug 2021", "lines": ["Decided to pop down to Afghanistan for a few days", "never been before. Just goofing off"], "mark": 0}, {"title": "Passport scan", "lines": ["ROUTLEDGE, MILES", "British citizen"], "mark": -1}]}
  {"tool": "graphic", "cue": 2, "words": "...", "type": "stamp", "text": "2021", "sub": "Kabul, Afghanistan"}
  alert = a real notice, warning, court order, message or post typed out like a teletype (only real text or a faithful
  summary marked as such); crosshair = a thing found or targeted (icon folder | photo | pin | phone); disclaimer = only at
  the very start of a story with violence or crime; title_gold = the main person's name the first time it matters;
  tracker = a real photo of a public person with a red tracking box, their name and a tag (SUSPECT, WITNESS, VICTIM only
  for public figures; private people get no photo); dialogue = 2-4 real exchanged lines between two people (police and
  suspect, two users, a call) typed in two colours; stack = 2-3 real documents, posts or messages as cards on the table,
  the key line marked yellow (mark = index of the line, -1 none); stamp = a year or a place typed big over the footage.""",
    },
    "kinetic": {
        "label": "KINETIC",
        "fonts": [("Kit Mono", "KodeMono.ttf", "400 700", "normal"), ("Kit Display", "InterDisplay-Black.ttf", "900", "normal"),
                  ("Kit Serif", "PlayfairDisplay.ttf", "400 900", "normal"), ("Kit Body", "Inter-Bold.ttf", "700", "normal"),
                  ("Kit Body", "Inter-SemiBold.ttf", "600", "normal")],
        "palette": {"ink": "#FFFFFF", "yellow": "#F2C230", "red": "#E5322D", "page": "#FAFAF8"},
        "types": {"bigword": 3.6, "board": 6.5, "doodle": 4.5, "phones": 7.5, "comment": 6.0, "scroll": 5.5, "mosaic": 4.0, "sources": 5.5},
        "prompt": """- graphic — a KINETIC graphic (3-7 s), one of:
  {"tool": "graphic", "cue": 1, "words": "where are they at", "type": "bigword", "words_big": ["where", "at?"]}
  {"tool": "graphic", "cue": 3, "words": "a good idea", "type": "doodle", "icon": "lightbulb", "text": "a good idea"}
  {"tool": "graphic", "cue": 5, "words": "...", "type": "board", "line": "are we in the middle of a good man shortage?", "inner": "ARE WE IN A 'GOOD MAN' SHORTAGE", "source": "The Social, CTV"}
  {"tool": "graphic", "cue": 9, "words": "...", "type": "phones", "cards": ["WHERE ARE ALL THE GOOD MEN", "CHILLING OR WAITING", "SO WHERE ARE THE SINGLE 30+ MEN"], "title": "Where Are All The Good Men?", "sub": "a Modern Wisdom production", "mark": "Good Men?"}
  {"tool": "graphic", "cue": 14, "words": "...", "type": "comment", "handle": "@user", "text": "I'm trapped in a generation where I don't know whether to buy her flowers, or ignore her, to get her to like me", "marks": ["buy her flowers", "ignore her"]}
  {"tool": "graphic", "cue": 18, "words": "...", "type": "scroll", "items": [{"headline": "Where Have All the Good Men Gone?", "outlet": "The Atlantic"}, {"headline": "The Good Men are still here, they're just tired", "outlet": "Vox"}], "bold": ["Good Men"]}
  {"tool": "graphic", "cue": 22, "words": "...", "type": "mosaic", "caption": "what they actually post", "labels": ["exhibit A", "exhibit B"]}
  {"tool": "graphic", "cue": 26, "words": "...", "type": "sources", "title": "the studies", "items": [{"text": "Pew Research, 2023 — 63% of men under 30 are single", "who": "Pew"}, {"text": "...", "who": "..."}]}
  bigword = one or two words of the sentence, huge and centred, one after another (a question, a turn); doodle = a chalk
  icon drawn on the board for the idea of the moment (icon: lightbulb | brain | arrow | question | clock | dollar | heart |
  eye | gear | target | chart | person | fire | star | check | cross | book | phone | key | cloud) with 1-3 words beside
  it; board = a clip or a quote pinned on the chalkboard with the line written under it in chalk (inner = the words as
  the source itself captioned them, source = who said it); phones = 1-3 short posts/videos as phone cards stacking up, then the episode's serif title typed; comment
  = one real comment or post, the key phrases highlighted one after another (marks = 1-3 exact phrases from text); scroll
  = 2-4 real headlines scrolling by (bold = words to bold); mosaic = two pixelated pictures popping in with a caption,
  for a joke about what cannot be shown; sources = 2-4 real sources or figures listed with a typing cursor.""",
    },
    "atlas": {
        "label": "ATLAS",
        "fonts": [("Kit Comic", "Bangers.ttf", "400", "normal"), ("Kit Round", "LilitaOne.ttf", "400", "normal"),
                  ("Kit Hand", "PatrickHand.ttf", "400", "normal")],
        "palette": {"paper": "#F3E3B3", "ink": "#2A1D12", "red": "#D93B2B", "green": "#6DB33F", "blue": "#3B8BD9",
                    "yellow": "#F2C230", "purple": "#8E5BC7", "orange": "#EE8A2E"},
        "types": {"timemachine": 6.0, "flipchart": 7.0, "watch": 3.8, "stamp": 3.8, "wave": 2.4, "scoreboard": 6.0,
                  "signpost": 4.5},
        "prompt": """- graphic — an ATLAS cartoon graphic (2-7 s), one of:
  {"tool": "graphic", "cue": 2, "words": "two thousand years ago", "type": "timemachine", "from_year": 2026, "to_year": -753, "label": "Rome is founded"}
  {"tool": "graphic", "cue": 6, "words": "...", "type": "flipchart", "pages": [{"year": "753 BC", "label": "A VILLAGE", "colour": "green"}, {"year": "509 BC", "label": "THE REPUBLIC", "colour": "blue"}, {"year": "27 BC", "label": "THE EMPIRE", "colour": "red"}]}
  {"tool": "graphic", "cue": 9, "words": "...", "type": "watch", "year": "1912"}
  {"tool": "graphic", "cue": 1, "words": "...", "type": "stamp", "text": "HISTORICALLY FACTS", "sub": "PART 19"}
  {"tool": "graphic", "cue": 12, "words": "...", "type": "wave", "colour": "yellow"}
  {"tool": "graphic", "cue": 15, "words": "...", "type": "scoreboard", "left": {"name": "ROME", "value": 80000, "unit": "soldiers", "colour": "red"}, "right": {"name": "CARTHAGE", "value": 50000, "unit": "soldiers", "colour": "blue"}}
  {"tool": "graphic", "cue": 18, "words": "...", "type": "signpost", "arrows": [{"text": "GAUL", "dir": "left"}, {"text": "EGYPT", "dir": "right"}, {"text": "BRITANNIA", "dir": "left"}]}
  timemachine = the time-travel bar when the story jumps in time (years as numbers, BC negative); flipchart = 2-4 eras,
  rulers, dynasties or stages as flipped pages, each with its year, its name and a colour (green|blue|red|yellow|purple|
  orange); watch = a wristwatch showing the year the story lands in; stamp = the bouncy title card of an episode or a
  part; wave = a paint wipe between two eras or places (yellow|red|blue|green); scoreboard = two sides compared with real
  numbers counting up; signpost = the places the story could go next or the roads out of a place.""",
    },
    "deep": {
        "label": "DEEP",
        "fonts": [("Kit Stencil", "SairaStencilOne.ttf", "400", "normal"), ("Kit Cond", "BarlowCondensed-SemiBold.ttf", "600", "normal"),
                  ("Kit Cond", "BarlowCondensed-Bold.ttf", "700", "normal"), ("Kit Cond", "BarlowCondensed-SemiBoldItalic.ttf", "600", "italic"),
                  ("Kit Mono", "SpaceMono-Bold.ttf", "700", "normal")],
        "palette": {"teal": "#0E3B45", "deep": "#08252C", "orange": "#E8532A", "cyan": "#4FE3FF", "ink": "#D7E9EC",
                    "red": "#FF3B30"},
        "types": {"stencil": 4.5, "route": 7.0, "cutaway": 6.0, "sonar": 5.5, "readout": 6.0, "maproom": 7.0},
        "prompt": """- graphic — a DEEP graphic (4-7 s), one of:
  {"tool": "graphic", "cue": 1, "words": "October 1971", "type": "stencil", "line1": "OCTOBER", "line2": "1971", "note": "Sea of Okhotsk"}
  {"tool": "graphic", "cue": 5, "words": "...", "type": "route", "from": "VLADIVOSTOK", "to": "PETROPAVLOVSK", "label": "the cable", "unit": "1,200 km"}
  {"tool": "graphic", "cue": 9, "words": "...", "type": "cutaway", "shape": "submarine", "label": "USS HALIBUT", "figures": 9, "red": 2, "note": "two divers in the bell"}
  {"tool": "graphic", "cue": 13, "words": "...", "type": "sonar", "title": "CONTACT", "contacts": [{"bearing": 40, "range": 0.6, "label": "K-129"}, {"bearing": 210, "range": 0.35, "label": "escort"}]}
  {"tool": "graphic", "cue": 17, "words": "...", "type": "readout", "title": "OPERATION IVY BELLS", "classification": "TOP SECRET", "rows": [{"k": "DEPTH", "v": "120 m"}, {"k": "CREW", "v": "140"}, {"k": "RECORDER", "v": "6 t, nuclear"}]}
  {"tool": "graphic", "cue": 21, "words": "...", "type": "maproom", "title": "SEA OF OKHOTSK", "grid": "A1-D4", "note": "the route of the Halibut"}
  stencil = a stencilled date, place or name over the footage (the way the story stamps a time); route = an abstract
  chart of a journey between two named points with a distance or a length; cutaway = a cross-section silhouette of a
  vessel, aircraft, rocket, station or building (shape: submarine | ship | plane | rocket | building | tunnel) with the
  crew as glowing figures and the ones the story follows in red; sonar = contacts on a sweeping screen (bearing 0-360,
  range 0-1); readout = a classified file of 3-5 real facts; maproom = the wall map of a headquarters the camera pushes
  into, for the plan of an operation.""",
    },
    "frontline": {
        "label": "NEWS",
        "fonts": [("Kit Black", "ArchivoBlack.ttf", "400", "normal"), ("Kit Cond", "Oswald.ttf", "200 700", "normal"),
                  ("Kit Ital", "BarlowCondensed-SemiBoldItalic.ttf", "600", "italic"), ("Kit Body", "Inter-SemiBold.ttf", "600", "normal"),
                  ("Kit Body", "Inter-Bold.ttf", "700", "normal")],
        "palette": {"paper": "#EEF0F2", "ink": "#101214", "red": "#E0322B", "yellow": "#F5C400", "cyan": "#BFE8E6",
                    "salmon": "#E9A6A0"},
        "types": {"newsbar": 6.0, "timeline": 7.0, "label": 3.8, "arrows": 6.0, "ticker": 5.5, "count": 5.0},
        "prompt": """- graphic — a NEWS graphic (4-6 s), one of:
  {"tool": "graphic", "cue": 3, "words": "...", "type": "newsbar", "tag": "BREAKING NEWS", "text": "Foreign Secretary says \\"we must make sure we are doing all we can\\"", "source": "Sky News, 24 Feb 2022"}
  {"tool": "graphic", "cue": 7, "words": "...", "type": "timeline", "note": "how it escalated", "events": [{"date": "FEB 2022", "text": "Russian troops cross the border"}, {"date": "SEP 2022", "text": "Kharkiv counteroffensive"}, {"date": "JUN 2023", "text": "Kakhovka dam destroyed"}, {"date": "AUG 2024", "text": "Ukraine enters Kursk"}]}
  {"tool": "graphic", "cue": 10, "words": "...", "type": "label", "text": "KYIV", "sub": "capital, 2.9 million"}
  {"tool": "graphic", "cue": 13, "words": "...", "type": "arrows", "title": "THREE AXES", "arrows": [{"from": "BELARUS", "to": "KYIV"}, {"from": "DONBAS", "to": "KHARKIV"}, {"from": "CRIMEA", "to": "KHERSON"}], "hot": ["KYIV", "KHARKIV"]}
  {"tool": "graphic", "cue": 16, "words": "...", "type": "ticker", "headline": "RUSSIAN FORCES ARE CLOSE TO KYIV", "items": ["Zelensky: fate of Ukraine being decided right now", "EU agrees new sanctions", "NATO holds emergency summit"], "time": "9:01 PM ET"}
  {"tool": "graphic", "cue": 20, "words": "...", "type": "count", "value": "190000", "unit": "troops on the border", "source": "US intelligence estimate, Feb 2022", "trend": [30, 45, 60, 90, 130, 190]}
  newsbar = a real quote or claim from a real report as a lower third over the footage (tag: BREAKING NEWS | LIVE |
  DEVELOPING | ANALYSIS); timeline = 3-5 real dated events with a short line each, for what happened when;
  label = a boxed place name pinned on the footage; arrows = 2-4 movements between named places on a relief ground, hot =
  the places under pressure; ticker = a news headline with a crawling ticker of 2-4 real items and a time; count = one
  real figure counting up with its unit, source and 3-8 trend values.""",
    },
    "legend": {
        "label": "LEGEND",
        "fonts": [("Kit Num", "BebasNeue.ttf", "400", "normal"), ("Kit Serif", "DMSerifDisplay.ttf", "400", "normal"),
                  ("Kit Text", "Lora.ttf", "400 700", "normal"), ("Kit Text", "Lora-Italic.ttf", "400 700", "italic"),
                  ("Kit Body", "Inter-SemiBold.ttf", "600", "normal")],
        "palette": {"cream": "#F4EBDD", "gold": "#C99A3B", "green": "#2F6B3A", "red": "#B0322A", "ink": "#1B1712"},
        "types": {"chapter": 4.8, "lower": 4.0, "scorecard": 6.0, "line": 5.5, "years": 5.5},
        "prompt": """- graphic — a LEGEND graphic (4-6 s), one of:
  {"tool": "graphic", "cue": 3, "words": "Fuzzy Zoeller", "type": "chapter", "n": 1, "name": "Fuzzy Zoeller", "note": "Masters champion, 1979", "subject": "Fuzzy Zoeller", "query": "Fuzzy Zoeller golfer portrait"}
  {"tool": "graphic", "cue": 6, "words": "...", "type": "lower", "name": "Tom Watson", "role": "8 major titles"}
  {"tool": "graphic", "cue": 10, "words": "...", "type": "scorecard", "title": "CROOKED STICK, 1991", "rows": [{"label": "Round 1", "value": "69"}, {"label": "Round 2", "value": "67"}, {"label": "Total", "value": "-12"}], "source": "PGA Championship"}
  {"tool": "graphic", "cue": 14, "words": "...", "type": "line", "line": "That's where you score.", "who": "John Daly"}
  {"tool": "graphic", "cue": 18, "words": "...", "type": "years", "years": [{"year": "1991", "label": "PGA Championship"}, {"year": "1995", "label": "The Open, St Andrews"}]}
  chapter = the numbered card for each person or item of the list, the first time they are named (n = their number,
  note = one real fact); lower = a name and a role over the footage the first time another real person appears; scorecard
  = 2-5 rows of real numbers (a round, a season, a record); line = one short sentence the narrator himself says in
  the script, as a card in his name; years = 2-5 real dated moments of a career.""",
    },
    "hustle": {
        "label": "HUSTLE",
        "fonts": [("Kit Pop", "Poppins-ExtraBold.ttf", "800", "normal"), ("Kit Pop", "Poppins-Bold.ttf", "700", "normal"),
                  ("Kit Pop", "Poppins-SemiBold.ttf", "600", "normal")],
        "palette": {"black": "#0B0B0D", "ink": "#FFFFFF", "red": "#E8232A", "yellow": "#FFD400", "green": "#2ED573",
                    "orange": "#F2892B"},
        "types": {"bar": 5.5, "icon3d": 4.5, "moneyrain": 4.5, "corner": 4.0, "counter": 5.0, "versus": 6.0, "checklist": 6.0},
        "prompt": """- graphic — a HUSTLE graphic (4-6 s), one of:
  {"tool": "graphic", "cue": 4, "words": "...", "type": "bar", "label": "DIFFICULTY LEVEL:", "value": 11, "max": 14}
  {"tool": "graphic", "cue": 2, "words": "finding a niche", "type": "icon3d", "icon": "search", "word": "NICHE"}
  {"tool": "graphic", "cue": 1, "words": "...", "type": "moneyrain", "text": "$4,200 / month"}
  {"tool": "graphic", "cue": 7, "words": "...", "type": "corner", "top": "FINDING MY", "bottom": "NICHE"}
  {"tool": "graphic", "cue": 11, "words": "...", "type": "counter", "value": 4200, "prefix": "$", "label": "in the first month", "note": "before tax"}
  {"tool": "graphic", "cue": 15, "words": "...", "type": "versus", "a": {"name": "DROPSHIPPING", "stats": [{"label": "startup cost", "value": 3}, {"label": "time to first sale", "value": 6}, {"label": "competition", "value": 9}]}, "b": {"name": "FREELANCING", "stats": [{"label": "startup cost", "value": 1}, {"label": "time to first sale", "value": 3}, {"label": "competition", "value": 7}]}}
  {"tool": "graphic", "cue": 19, "words": "...", "type": "checklist", "title": "WHAT YOU NEED", "items": ["a laptop", "one skill", "30 days"]}
  bar = a rating of something on a segmented bar (difficulty, risk, profit) with value out of max; icon3d = a glossy icon
  (search | dollar | rocket | bulb | chart | clock | fire | lock) with one word; moneyrain = money raining over the
  footage with a figure; corner = the two-line title of a section in the corner; counter = a figure counting up with a
  label; versus = two options compared on 2-4 stats scored 1-10; checklist = 2-5 items ticked one by one.""",
    },
    "analog": {
        "label": "ANALOG",
        "fonts": [("Kit Head", "InterDisplay-Black.ttf", "900", "normal"), ("Kit Cond", "BarlowCondensed-Bold.ttf", "700", "normal"),
                  ("Kit Mono", "SpaceMono-Bold.ttf", "700", "normal"), ("Kit Serif", "DMSerifDisplay.ttf", "400", "normal"),
                  ("Kit Body", "Inter-SemiBold.ttf", "600", "normal"), ("Kit LED", "ShareTechMono.ttf", "400", "normal")],
        "palette": {"red": "#E1382C", "orange": "#F28A1E", "yellow": "#F2C12E", "ivory": "#EDE4D3", "ink": "#F4EFE6",
                    "dim": "#8C8A86", "panel": "#18181B", "paper": "#EFE7D8", "dark": "#0E0E10"},
        "types": {"machine": 6.5, "steps": 7.5, "wave": 5.6, "record": 6.0, "price": 6.2, "units": 5.8, "timeline": 6.8,
                  "quote": 6.8, "city": 4.8},
        "prompt": """- graphic — an ANALOG graphic (5-8 s), one of:
  {"tool": "graphic", "cue": 3, "words": "...", "type": "machine", "name": "TR-808", "maker": "Roland Corporation · Osaka", "sub": "Rhythm Composer", "specs": [{"k": "Released", "v": "1980"}, {"k": "Sounds", "v": "16 analog voices"}, {"k": "Steps", "v": "16 per pattern"}], "subject": "Roland TR-808", "query": "Roland TR-808 drum machine front panel photo"}
  {"tool": "graphic", "cue": 7, "words": "...", "type": "steps", "label": "A basic four-on-the-floor", "bpm": 112, "rows": {"BD": "x...x...x...x...", "SD": "....x.......x...", "CH": "x.x.x.x.x.x.x.x.", "CP": "............x..."}}
  {"tool": "graphic", "cue": 9, "words": "...", "type": "wave", "lanes": [{"label": "A real kick drum", "sound": "acoustic"}, {"label": "The 808 kick", "sound": "kick"}], "note": "One stops. The other keeps ringing."}
  {"tool": "graphic", "cue": 12, "words": "...", "type": "record", "title": "Planet Rock", "artist": "Afrika Bambaataa & the Soulsonic Force", "year": "1982", "label": "Tommy Boy Records", "note": "12-inch single", "subject": "Planet Rock record", "query": "Afrika Bambaataa Planet Rock 1982 12 inch single cover"}
  {"tool": "graphic", "cue": 15, "words": "...", "type": "price", "tags": [{"year": "1980", "price": "$1,000", "label": "In the shop"}, {"year": "1985", "price": "$100", "label": "Second hand"}], "stamp": ""}
  {"tool": "graphic", "cue": 18, "words": "...", "type": "units", "value": 10000, "label": "units made", "sub": "in three years", "stamp": "Discontinued"}
  {"tool": "graphic", "cue": 21, "words": "...", "type": "timeline", "events": [{"year": "1980", "text": "The machine comes out"}, {"year": "1982", "text": "The first hit record"}, {"year": "2008", "text": "An album named after it"}]}
  {"tool": "graphic", "cue": 24, "words": "...", "type": "quote", "text": "the exact words, as printed or said on record", "who": "Speaker Name", "role": "who they are", "year": "2015", "subject": "Speaker Name", "query": "Speaker Name portrait"}
  {"tool": "graphic", "cue": 27, "words": "Detroit", "type": "city", "city": "Detroit", "region": "Michigan, USA", "coords": "42.33° N · 83.05° W", "year": "1983", "note": ""}
  EVERY value comes from the script — the examples above only show the shape; never copy their numbers or names.
  machine = the machine (or any piece of gear) the first time it is on screen and again at its turning points: its real
  name, maker and city, a subtitle, 2-4 spec lines of real facts (year, price, sounds, weight...), and a photo search for
  it; steps = a 16-step pattern that PLAYS with real 808 sounds while it is on screen — rows BD (kick), SD (snare), CH
  (closed hat), OH (open hat), CP (clap), CB (cowbell), RS (rimshot), 16 characters of x and . each, a bpm; the label
  names what it is ("a typical electro beat", "the kick alone") — call it a specific record's pattern only when the
  script says so; use it when the narration explains how the machine is programmed or how a style of beat works;
  wave = how a sound looks (sound: acoustic | kick | snare | clap | cowbell | hat | open), one or two lanes, one short
  note; record = a real record (single or album) the first time the narration names it, with its real year and label and
  a cover search; price = 2-3 real prices of the same thing over time, oldest first (the older ones get struck through),
  stamp optional; units = one real count (made, sold) counting up with a stamp; timeline = 3-5 real dated moments;
  quote = a real sentence someone said or wrote, word for word, with who and when — never invented, never paraphrased
  into quotation marks; city = the first time the story moves to a city (real coordinates, the year of the scene).""",
    },
    "tape": {
        "label": "TAPE",
        "fonts": [("Kit Black", "Montserrat-Black.ttf", "900", "normal"), ("Kit Bold", "Montserrat-ExtraBold.ttf", "800", "normal"),
                  ("Kit Semi", "Inter-SemiBold.ttf", "600", "normal"), ("Kit Mono", "SpaceMono-Bold.ttf", "700", "normal"),
                  ("Kit Body", "Inter-SemiBold.ttf", "600", "normal")],
        "palette": {"ink": "#FFFFFF", "red": "#FF0033", "dim": "#9AA0A6", "card": "#17181C"},
        "types": {"title": 4.5, "player": 6.0, "subs": 5.5, "post": 6.0, "timeline": 7.0, "quote": 6.0, "versus": 6.0, "chapter": 4.0},
        "prompt": """- graphic — a TAPE graphic (4-7 s), one of:
  {"tool": "graphic", "cue": 1, "words": "...", "type": "title", "text": "How MrBeast Changed YouTube Forever", "mark": "Forever", "tag": "VIDEO ESSAY", "sub": "the story of the biggest channel on earth"}
  {"tool": "graphic", "cue": 3, "words": "...", "type": "player", "channel": "MrBeast", "subs": "300M", "title": "I Gave People $1,000,000 But ONLY 1 Minute To Spend It!", "views": "180000000", "length": "12:41"}
  {"tool": "graphic", "cue": 6, "words": "...", "type": "subs", "channel": "MrBeast", "value": "300000000", "label": "subscribers", "when": "June 2024", "trend": [1, 4, 20, 60, 130, 220, 300]}
  {"tool": "graphic", "cue": 9, "words": "...", "type": "post", "who": "MrBeast", "handle": "@MrBeast", "platform": "X", "text": "I want to make the best videos on the planet. That's it.", "marks": ["best videos on the planet"], "when": "Mar 2, 2023", "likes": "412K"}
  {"tool": "graphic", "cue": 12, "words": "...", "type": "timeline", "title": "the uploads that changed it", "events": [{"date": "2017", "text": "Counting to 100,000", "length": "40:03:00"}, {"date": "2018", "text": "$1,000,000 in 24 hours", "length": "10:22"}, {"date": "2021", "text": "Squid Game in real life", "length": "25:41"}]}
  {"tool": "graphic", "cue": 15, "words": "...", "type": "quote", "text": "I'd rather have one great video than a hundred good ones.", "who": "MrBeast", "where": "Colin and Samir, 2022"}
  {"tool": "graphic", "cue": 18, "words": "...", "type": "versus", "left": {"name": "MrBeast", "value": "300000000", "note": "started 2012, Greenville NC"}, "right": {"name": "PewDiePie", "value": "111000000", "note": "started 2010, Gothenburg"}, "unit": "subscribers"}
  {"tool": "graphic", "cue": 21, "words": "...", "type": "chapter", "n": 2, "text": "The money problem", "sub": "part two"}
  title = the episode's opener on the very first cue (text = the episode title, mark = its key word in red, sub = one
  line on what it is about); player = a real video of the story in a player window with its channel plate: the channel, its subscriber count, the
  video's real title, its views and length; subs = one real subscriber or view figure of one channel rolling up, with
  when it was reached and 3-8 trend values; post = one real post or tweet as a card (exact words; marks = 1-3 exact
  phrases to highlight); timeline = 3-5 dated uploads or moments of one creator with a short line each and a video
  length; quote = a real quote, who said it and where; versus = two channels or two years of one channel side by side
  on one figure; chapter = a numbered section title.""",
    },
}

CAPTIONED = ("newsbar", "label", "moneyrain", "corner", "lower", "mosaic")     # scenes over sharp footage: captions may stay


def kit_of(look: dict) -> str:
    """The kit a style uses ("" when it is not a kit style)."""
    look = look or {}
    if str(look.get("graphics") or "").lower() != "kit":
        return ""
    k = str(look.get("kit") or "").lower().strip()
    return k if k in KITS else ""


def kit_for_style(engine, style: str) -> str:
    info = (getattr(engine, "STYLE_INFO", {}) or {}).get(style) or {}
    return kit_of(info.get("look") or {})


def durations(kit: str) -> dict:
    return dict(KITS.get(kit, {}).get("types") or {})


def prompt_block(kit: str) -> str:
    return KITS.get(kit, {}).get("prompt") or ""


# ── the page ─────────────────────────────────────────────────────────────────────
_FONT_CACHE: dict = {}


def _font_css(kit: str) -> str:
    if kit not in _FONT_CACHE:
        css = []
        for fam, name, wt, st in KITS[kit]["fonts"]:
            f = FONTS / name
            if f.exists():
                css.append(f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{wt};"
                           f"src:url(data:font/ttf;base64,{base64.b64encode(f.read_bytes()).decode()});font-display:block}}")
        _FONT_CACHE[kit] = "".join(css)
    return _FONT_CACHE[kit]


PAGE = r"""<!doctype html><html><head><meta charset="utf-8"><style>
__FONTS__
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000}
*{box-sizing:border-box}
#stage{position:absolute;inset:0;overflow:hidden}
#ground{position:absolute;left:-60px;top:-34px;width:2040px;height:1148px;background-size:cover;background-position:center;transform-origin:50% 50%}
#scene{position:absolute;inset:0}
#grain{position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:overlay;background-size:512px 512px}
#vig{position:absolute;inset:0;pointer-events:none}
.abs{position:absolute}
.mask{overflow:hidden;display:block;padding-bottom:.08em;margin-bottom:-.08em}
.line{display:block}
canvas.full{position:absolute;left:0;top:0;width:1920px;height:1080px}
</style></head><body><div id="stage"><div id="ground"></div><div id="scene"></div><div id="vig"></div><div id="grain"></div></div>
<script>
const S = __SCENE__;
const P = S.palette || {};
const W = 1920, H = 1080, D = S.duration || 6, OUT = Math.max(0.2, D - 0.45);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const seg=(t,a,b)=>clamp((t-a)/Math.max(1e-4,b-a));
const lerp=(a,b,p)=>a+(b-a)*p;
const eo5=x=>1-Math.pow(1-x,5), eo3=x=>1-Math.pow(1-x,3), eio3=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2, ei3=x=>x*x*x;
const eback=x=>{const c=1.6;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const ebounce=p=>{const n=7.5625,d=2.75;if(p<1/d)return n*p*p;if(p<2/d)return n*(p-=1.5/d)*p+.75;if(p<2.5/d)return n*(p-=2.25/d)*p+.9375;return n*(p-=2.625/d)*p+.984375};
let _s=(S.seed||7)>>>0; const rnd=()=>{_s=(_s*1664525+1013904223)%4294967296;return _s/4294967296};
const $=(h)=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(v,dec=0)=>{const p=Number(v).toFixed(dec).split('.');p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');return p.join('.')};
const scene=document.getElementById('scene'), ground=document.getElementById('ground'), vig=document.getElementById('vig');
// typed text: the first n characters of a string, with a cursor
const typed=(s,n,cur='▍')=>esc(String(s).slice(0,Math.max(0,Math.floor(n))))+(n<String(s).length?`<span class="cur">${cur}</span>`:'');
// noise tile for grain (seeded)
(function(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');const im=x.createImageData(512,512);
 let s=1234567;for(let i=0;i<im.data.length;i+=4){s=(s*16807)%2147483647;const v=(s&255);im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255}
 x.putImageData(im,0,0);document.getElementById('grain').style.backgroundImage=`url(${c.toDataURL()})`})();
function grain(op){document.getElementById('grain').style.opacity=op}
function lines(el){   // wrap each rendered line of words in a mask, for a line-by-line rise
  const words=el.textContent.split(/\s+/).filter(Boolean); el.innerHTML=words.map(w=>`<span class="w">${esc(w)} </span>`).join('');
  const rows=[];let top=null;for(const sp of el.querySelectorAll('.w')){if(top===null||Math.abs(sp.offsetTop-top)>4){rows.push([]);top=sp.offsetTop}rows[rows.length-1].push(sp.textContent)}
  el.innerHTML=rows.map(r=>`<span class="mask"><span class="line">${esc(r.join('').trim())}</span></span>`).join('');
  return [...el.querySelectorAll('.line')];
}
function fit(el,maxW,big,small){ // shrink a one-line title until it fits: measured shrink-to-fit, not the box it sits in
  const w0=el.style.width, ws0=el.style.whiteSpace; el.style.width='auto'; el.style.whiteSpace='nowrap';
  let s=big; el.style.fontSize=s+'px'; while(s>small&&el.offsetWidth>maxW){s-=4;el.style.fontSize=s+'px'}
  const over=el.offsetWidth>maxW; el.style.width=w0; el.style.whiteSpace=over?'normal':ws0; if(over&&!w0)el.style.width=maxW+'px'; return s}
if(S.ground){ground.style.backgroundImage=`url(${S.ground})`}
let parts={};
__KITJS__
window.renderFrame=function(t){ frame(t); };
// every embedded face is loaded BEFORE build(): a face loads lazily on first use, so a title measured in build()
// (fit) would otherwise be measured in the fallback font and overflow once the real one arrives
Promise.all([...document.fonts].map(f=>f.load().catch(()=>null))).then(()=>document.fonts.ready).then(()=>{ try{ build(); window.renderFrame(0); }catch(e){ window.__err=String(e&&e.stack||e); } window.__ready=true; }).catch(e=>{ window.__err=String(e&&e.stack||e); window.__ready=true; });
window.addEventListener('error', e=>{ window.__err=window.__err||String(e.message||e); });
</script></body></html>"""


_PROP_URI: dict = {}


def _prop_uri(kit: str, name: str) -> str:
    """A kit's rendered prop (assets/kits/<kit>/<name>.png, drawn once by the image model) as a data URI, or ""."""
    key = f"{kit}/{name}"
    if key not in _PROP_URI:
        f = KIT_DIR / kit / f"{name}.png"
        _PROP_URI[key] = ("data:image/png;base64," + base64.b64encode(f.read_bytes()).decode()) if f.exists() else ""
    return _PROP_URI[key]


def _ground_uri(name: str) -> str:
    """A generated ground (assets/kits/frames/gen_<name>.jpg) as a data URI, or ""."""
    key = f"frames/{name}"
    if key not in _PROP_URI:
        f = KIT_DIR / "frames" / f"gen_{name}.jpg"
        _PROP_URI[key] = ("data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()) if f.exists() else ""
    return _PROP_URI[key]


def _with_props(kit: str, sc: dict) -> dict:
    """The scene with the props its type uses attached (HUSTLE: the 3D icon, the bill; KINETIC: the chalkboard;
    ATLAS: the sunburst wall behind the title)."""
    if kit == "kinetic" and sc.get("type") in ("board", "doodle"):
        sc["board"] = _ground_uri("sketchboard")
    if kit == "atlas" and sc.get("type") == "stamp":
        sc["wall"] = _ground_uri("titlewall")
    if kit == "hustle":
        if sc.get("type") == "icon3d":
            sc["prop"] = _prop_uri(kit, str(sc.get("icon") or "search").lower())
        if sc.get("type") == "moneyrain":
            sc["bill"] = _prop_uri(kit, "bill")
        if sc.get("type") == "counter":
            sc["stack"] = _prop_uri(kit, "stack")
    return sc


def build_html(kit: str, scene: dict, look: dict = None) -> str:
    js = (KIT_DIR / f"{kit}.js").read_text(encoding="utf-8")
    sc = _with_props(kit, dict(scene))
    sc.setdefault("palette", dict(KITS[kit]["palette"]))
    acc = (look or {}).get("accent") or []
    if acc:
        sc["palette"].setdefault("accent", acc[0])
    sc.setdefault("seed", 7)
    return (PAGE.replace("__FONTS__", _font_css(kit)).replace("__KITJS__", js)
            .replace("__SCENE__", json.dumps(sc, ensure_ascii=False)))


def render(kit: str, jobs: list, workers: int = 2, look: dict = None, fps: int = FPS) -> list:
    """jobs = [(scene, out_mp4)] — Chromium, one screenshot per frame (docgfx.render's loop)."""
    import motion
    from playwright.sync_api import sync_playwright
    tmp = Path(tempfile.mkdtemp(prefix="kit_"))
    prepared = [(build_html(kit, sc, look), float(sc.get("duration", 6.0)), Path(out), tmp / f"f{i:03d}", sc)
                for i, (sc, out) in enumerate(jobs)]
    workers = max(1, min(workers, len(prepared)))

    def one(chunk):
        last = None
        for attempt in range(3):
            pw = None
            try:
                with motion._PW_START:
                    pw = sync_playwright().start()
                browser = pw.chromium.launch(args=["--force-color-profile=srgb", "--disable-gpu", "--font-render-hinting=none"])
                for html, dur, out, fdir, sc in chunk:
                    if out.exists() and out.stat().st_size > 10_000:
                        continue
                    fdir.mkdir(parents=True, exist_ok=True)
                    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
                    page.set_content(html, wait_until="load")
                    page.wait_for_function("window.__ready===true", timeout=60000)
                    err = page.evaluate("window.__err||''")
                    if err:
                        raise RuntimeError(f"{kit}/{sc.get('type')}: {err[:300]}")
                    step = 1 if fps >= FPS else 2
                    n = max(1, int(round(dur * FPS)))
                    k_out = 0
                    shutter = int(sc.get("shutter", SHUTTER) or 1)
                    for k in range(0, n, step):
                        if shutter <= 1:
                            page.evaluate("(t)=>window.renderFrame(t)", k / FPS)
                            page.screenshot(path=str(fdir / f"f_{k_out:05d}.jpg"), type="jpeg", quality=94,
                                            clip={"x": 0, "y": 0, "width": W, "height": H})
                        else:
                            acc = None
                            for j in range(shutter):
                                page.evaluate("(t)=>window.renderFrame(t)", k / FPS + j * 0.5 / FPS / shutter)
                                raw = page.screenshot(type="jpeg", quality=94, clip={"x": 0, "y": 0, "width": W, "height": H})
                                arr = _np.asarray(_Image.open(_io.BytesIO(raw)).convert("RGB"), dtype=_np.float32)
                                acc = arr if acc is None else acc + arr
                            _Image.fromarray((acc / shutter + 0.5).astype(_np.uint8)).save(fdir / f"f_{k_out:05d}.jpg", quality=94)
                        k_out += 1
                    _frames_to_mp4(fdir, out, FPS // step)
                    shutil.rmtree(fdir, ignore_errors=True)
                    page.close()
                browser.close()
                return
            except Exception as e:                              # noqa: BLE001 - driver flakiness
                last = e
                if "__err" in str(e) or ": " in str(e) and str(e).startswith(kit):
                    raise
                time.sleep(3.0 * (attempt + 1))
            finally:
                if pw is not None:
                    try:
                        pw.stop()
                    except Exception:                           # noqa: BLE001
                        pass
        raise RuntimeError(f"kits: rendering failed: {last}")

    try:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            list(ex.map(one, [prepared[i::workers] for i in range(workers)]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return [Path(o) for _, o in jobs]


def _frames_to_mp4(frames_dir: Path, out_mp4: Path, fps: int) -> None:
    import subprocess
    # a stepped scene (15 fps) is written at the timeline's 30 fps by repeating frames, so its length is exact
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(fps), "-i", str(frames_dir / "f_%05d.jpg"),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-color_range", "tv",
                    "-r", str(FPS), str(out_mp4)], check=True, capture_output=True)


# ── sound ────────────────────────────────────────────────────────────────────────
def sound_marks(kit: str, sc: dict) -> list:
    """[(second, sound, dB)] under this scene (sfx.py BANK names)."""
    t, d = sc.get("type"), float(sc.get("duration", 6.0))
    k = kit
    if k == "dossier":
        if t in ("alert", "dialogue", "stamp"):
            n = int(min(28, max(6, d * 5)))
            return [(0.0, "static", -14.0)] + [(0.25 + i * (min(3.2, d - 1.5) / n), "typekey", -13.0) for i in range(n)] + [(d - 0.6, "hit", -12.0)]
        if t == "crosshair":
            return [(0.0, "whoosh", -6.0), (1.1, "click", -6.0), (1.6, "ping", -12.0)]
        if t == "disclaimer":
            return [(0.0, "static", -9.0), (0.3, "hit", -8.0)]
        if t == "title_gold":
            return [(0.0, "riser", -8.0), (1.2, "hit", -3.0)]
        if t == "tracker":
            return [(0.0, "static", -12.0), (0.9, "click", -6.0), (1.8, "typekey", -12.0), (2.4, "click", -8.0)]
        if t == "stack":
            return [(0.0, "paper", -4.0), (1.3, "paper", -5.0), (2.6, "paper", -5.0), (3.4, "click", -9.0)]
    if k == "kinetic":
        if t == "bigword":
            return [(0.05, "hit", -5.0), (1.5, "hit", -6.0)]
        if t == "board":
            return [(0.0, "whoosh", -6.0), (0.4, "tap", -12.0)] + [(1.2 + i * 0.07, "typekey", -18.0) for i in range(18)]
        if t == "doodle":
            return [(0.1, "tap", -10.0), (0.5, "tap", -12.0), (0.9, "tap", -12.0), (1.3, "pop", -9.0)]
        if t == "phones":
            return [(0.2, "whoosh", -5.0), (1.2, "whoosh", -6.0), (2.2, "whoosh", -6.0), (3.4, "whoosh_out", -8.0)] + \
                   [(3.9 + i * 0.08, "typekey", -16.0) for i in range(16)]
        if t == "comment":
            return [(0.0, "whoosh", -7.0), (1.4, "click", -8.0), (2.4, "click", -8.0), (3.4, "click", -8.0)]
        if t == "scroll":
            return [(0.0, "whoosh", -6.0), (2.5, "whoosh", -9.0)]
        if t == "mosaic":
            return [(0.3, "pop", -6.0), (0.9, "pop", -6.0)]
        if t == "sources":
            return [(0.4 + i * 0.09, "typekey", -15.0) for i in range(24)]
    if k == "atlas":
        if t == "timemachine":
            return [(0.1, "pop", -13.0), (3.2, "boing", -16.0)]
        if t == "flipchart":
            n = max(1, len(sc.get("pages") or []) - 1)
            return [(0.9 + i * max(1.2, (d - 1.4) / n), "paper", -13.0) for i in range(n)]
        if t == "watch":
            return [(0.3, "click", -15.0), (1.4, "boing", -17.0)]
        if t == "stamp":
            return [(0.15 + i * 0.12, "pop", -10.0) for i in range(6)] + [(1.6, "boing", -10.0)]
        if t == "wave":
            return [(0.0, "whoosh", -7.0)]
        if t == "scoreboard":
            return [(0.2, "pop", -10.0), (0.5, "pop", -10.0), (1.0, "riser", -14.0), (3.0, "boing", -12.0)]
        if t == "signpost":
            return [(0.2, "boing", -10.0), (0.9, "pop", -11.0), (1.3, "pop", -11.0), (1.7, "pop", -11.0)]
    if k == "deep":
        if t == "stencil":
            return [(0.0, "ping", -8.0), (0.3, "hit", -9.0)]
        if t == "route":
            return [(0.0, "ping", -8.0), (1.2, "whoosh", -9.0), (3.5, "ping", -11.0)]
        if t == "cutaway":
            return [(0.0, "hum", -9.0), (1.4, "ping", -10.0), (2.8, "ping", -12.0)]
        if t == "sonar":
            return [(0.0, "ping", -6.0), (1.7, "ping", -6.0), (3.4, "ping", -6.0)]
        if t == "readout":
            return [(0.0, "static", -14.0)] + [(0.5 + i * 0.09, "typekey", -16.0) for i in range(22)]
        if t == "maproom":
            return [(0.0, "hum", -10.0), (2.2, "click", -9.0), (3.0, "whoosh", -9.0)]
    if k == "frontline":
        if t == "newsbar":
            return [(0.1, "whoosh", -12.0)]
        if t == "timeline":
            return [(0.6 + i * 0.5, "tap", -11.0) for i in range(min(5, len(sc.get("events") or [])))]
        if t == "label":
            return [(0.0, "click", -6.0), (0.2, "pop", -9.0)]
        if t == "arrows":
            return [(0.9, "whoosh", -11.0), (1.9, "whoosh", -12.0)]
        if t == "ticker":
            return [(0.0, "sting", -11.0)]
        if t == "count":
            return [(0.3, "riser", -13.0)]
    if k == "legend":
        if t == "chapter":
            return [(0.0, "whoosh", -6.0), (0.7, "hit", -9.0)]
        if t == "lower":
            return [(0.0, "whoosh", -9.0)]
        if t == "scorecard":
            return [(0.0, "paper", -5.0), (1.0, "tap", -8.0), (1.5, "tap", -8.0), (2.0, "tap", -8.0)]
        if t == "line":
            return [(0.0, "whoosh", -8.0)]
        if t == "years":
            return [(0.3 + i * 0.6, "tap", -8.0) for i in range(5)]
    if k == "hustle":
        if t == "bar":
            n = int(sc.get("value") or 6)
            return [(0.0, "whoosh", -6.0)] + [(0.9 + i * 0.12, "click", -9.0) for i in range(max(1, min(14, n)))]
        if t == "icon3d":
            return [(0.1, "whoosh", -5.0), (0.6, "pop", -5.0), (1.2, "pop", -7.0)]
        if t == "moneyrain":
            return [(0.0, "cash", -6.0), (1.2, "cash", -8.0)]
        if t == "corner":
            return [(0.1, "pop", -6.0), (0.5, "pop", -6.0)]
        if t == "counter":
            return [(0.2, "riser", -9.0), (2.2, "cash", -5.0)]
        if t == "versus":
            return [(0.2, "hit", -6.0), (1.0, "pop", -7.0), (1.4, "pop", -7.0), (1.8, "pop", -7.0)]
        if t == "checklist":
            return [(0.8 + i * 0.7, "pop", -6.0) for i in range(5)]
    if k == "tape":
        if t == "title":
            return [(0.3, "whoosh", -10.0), (1.2, "hit", -10.0)]
        if t == "player":
            return [(0.0, "whoosh", -8.0), (0.7, "click", -10.0)]
        if t == "subs":
            return [(0.2, "riser", -10.0), (2.5, "pop", -6.0)]
        if t == "post":
            return [(0.1, "pop", -6.0), (1.5, "click", -9.0), (2.6, "click", -9.0)]
        if t == "timeline":
            return [(0.2, "whoosh", -8.0)] + [(0.7 + i * 0.55, "tap", -7.0) for i in range(5)]
        if t == "quote":
            return [(0.0, "whoosh", -9.0), (0.4, "tap", -9.0)]
        if t == "versus":
            return [(0.1, "whoosh", -7.0), (0.3, "whoosh", -7.0), (0.9, "hit", -8.0)]
        if t == "chapter":
            return [(0.05, "hit", -7.0), (0.4, "whoosh", -9.0)]
    if k == "analog":
        if t == "machine":
            return [(0.05, "whoosh", -7.0), (0.35, "hit", -11.0)] + \
                   [(1.6 + i * 0.42, "typekey", -15.0) for i in range(min(5, len(sc.get("specs") or [])))]
        if t == "steps":
            return [(0.0, "whoosh", -11.0)] + _pattern_marks(sc)
        if t == "wave":
            lanes = (sc.get("lanes") or [{"sound": sc.get("sound") or "kick"}])[:2]
            return [(0.45 + j * 1.7, _DRUM.get(str(l.get("sound") or "kick").lower()[:4], ("bd808", 6.0))[0],
                     _DRUM.get(str(l.get("sound") or "kick").lower()[:4], ("bd808", 6.0))[1]) for j, l in enumerate(lanes)]
        if t == "record":
            return [(0.05, "whoosh", -8.0), (0.8, "whoosh", -13.0), (1.5, "crackle", -4.0)]
        if t == "price":
            n = len(sc.get("tags") or []) or 1
            gap = min(1.3, (d - 2.2) / max(1, n))
            out = [(0.2 + i * gap + 0.35, "paper", -6.0) for i in range(n)] + [(0.2 + i * gap + 0.95, "tap", -9.0) for i in range(n - 1)]
            if sc.get("stamp"):
                out.append((0.2 + (n - 1) * gap + 1.2, "hit", -6.0))
            return out
        if t == "units":
            a = min(d - 1.4, 3.6)
            return [(0.2, "riser", -12.0)] + [(0.5 + i * 0.22, "click", -14.0) for i in range(int((a - 0.6) / 0.22))] + \
                   ([(a + 0.05, "hit", -4.0)] if sc.get("stamp") else [])
        if t == "timeline":
            return [(0.1, "whoosh", -9.0)] + [(0.4 + i * 0.5, "paper", -9.0) for i in range(min(5, len(sc.get("events") or [])))]
        if t == "quote":
            return [(0.05, "whoosh", -9.0), (0.35, "paper", -6.0)]
        if t == "city":
            return [(0.0, "whoosh", -6.0), (0.35, "hit", -8.0)]
    return [(0.0, "whoosh", -6.0)]


# the ANALOG kit's drum voices: row name -> (sfx.BANK sound, dB relative to the channel's sfx level)
_DRUM = {"bd": ("bd808", 14.0), "kick": ("bd808", 14.0), "808": ("bd808", 14.0), "acou": ("kickac", 11.0),
         "sd": ("sd808", 10.0), "snar": ("sd808", 10.0), "cp": ("cp808", 9.0), "clap": ("cp808", 9.0),
         "ch": ("ch808", 6.0), "hat": ("ch808", 6.0), "oh": ("oh808", 6.0), "open": ("oh808", 6.0),
         "cb": ("cb808", 7.0), "cowb": ("cb808", 7.0), "rs": ("rs808", 6.0), "lt": ("tom808", 8.0), "mt": ("tom808", 8.0),
         "ht": ("tom808", 8.0), "cy": ("oh808", 5.0), "ma": ("rs808", 3.0), "cl": ("rs808", 5.0)}


def _pattern_marks(sc: dict) -> list:
    """The 16-step pattern the steps scene shows, as sounds on its playhead (the JS starts it at 1.0 s)."""
    rows = sc.get("rows") or {}
    if isinstance(rows, list):
        rows = {str(o.get("name") or o.get("k") or ""): str(o.get("steps") or o.get("v") or "") for o in rows if isinstance(o, dict)}
    try:
        bpm = max(60.0, min(180.0, float(sc.get("bpm") or 100)))
    except (TypeError, ValueError):
        bpm = 100.0
    step, t0, end = 60.0 / bpm / 4, 1.0, float(sc.get("duration", 7.0)) - 0.5
    pats = []
    for name, steps in list(rows.items())[:5]:
        hits = [c in "xX1*o" for c in re.sub(r"[\s|]", "", str(steps))][:32]
        voice = _DRUM.get(str(name).lower()[:2]) or _DRUM.get(str(name).lower()[:4])
        if hits and voice:
            pats.append((hits, voice))
    out, k = [], 0
    while t0 + k * step < end:
        for hits, (snd, gain) in pats:
            if hits[k % len(hits)]:
                out.append((round(t0 + k * step, 4), snd, gain))
        k += 1
    return out


# ── the designer (when there is no director) ─────────────────────────────────────
SCENES_PROMPT = """You are the motion designer of a YouTube channel whose graphics language is "[INSERT KIT HERE]".
The video is titled "[INSERT TITLE HERE]". Its narration is in [INSERT LANGUAGE HERE]; every text on screen is in that language too.
[INSERT EXTRA HERE]
The narration below is split into numbered PARTS. For EACH part choose at most ONE graphic from the list, or "none" — a
graphic only where the words call for it: a fact, a name, a place, a turn, a joke this kit is built for. Never
retype the narration as a card. Real names, real numbers, real dates only — never invented.

THE GRAPHICS OF THIS KIT
[INSERT TYPES HERE]

Answer with a JSON array, one object per part, in order, each carrying "part", "at" (4-8 consecutive words copied
exactly from that part, where the graphic starts) and the graphic's fields as shown, or {"part": n, "type": "none"}.

[INSERT CHUNKS HERE]"""


def _normalise(kit: str, raw: dict) -> dict:
    """A scene the JS can draw, or None."""
    if not isinstance(raw, dict):
        return None
    t = str(raw.get("type") or "").lower().strip()
    if t not in KITS[kit]["types"]:
        return None
    sc = {k: v for k, v in raw.items() if k not in ("tool", "cue", "words", "at", "part", "at_s", "dur", "end_cue")}
    sc["type"] = t
    sc["kit"] = kit
    return sc


def design(engine, srt: Path, job: Path, total: float, force: bool, style: str, step_s: float, title: str = "") -> list:
    """Claude's design per part (motion/doc_scenes.json) — the same file the director writes, so whichever ran first wins."""
    log = engine.log
    kit = kit_for_style(engine, style)
    mo_dir = job / "motion"
    mo_dir.mkdir(exist_ok=True)
    spec_file = mo_dir / "doc_scenes.json"
    entries = engine._parse_srt_full(srt.read_text(encoding="utf-8"))
    n = max(1, int(math.ceil(total / step_s)))
    if spec_file.exists() and not force:
        try:
            specs = json.loads(spec_file.read_text(encoding="utf-8"))
            if isinstance(specs, dict) or len(specs) >= n:
                return specs
        except ValueError:
            pass
    chunks = ["" for _ in range(n)]
    for a, b, txt in entries:
        i = int(a // step_s)
        if 0 <= i < n:
            chunks[i] += " " + txt
    if not title and (job / "title.txt").exists():
        title = (job / "title.txt").read_text(encoding="utf-8").splitlines()[0]
    body = "\n\n".join(f"PART {i + 1} ({int(i * step_s) // 60}:{int(i * step_s) % 60:02d}):\n"
                       f"{(chunks[i].strip() or '(quiet)')[:1500]}" for i in range(n))
    log(f"Claude: designing {KITS[kit]['label']} graphics for {n} parts...")
    try:
        specs = engine._json_items(SCENES_PROMPT.replace("[INSERT KIT HERE]", KITS[kit]["label"])
                                   .replace("[INSERT TITLE HERE]", title or "")
                                   .replace("[INSERT LANGUAGE HERE]", engine._job_language(job, style))
                                   .replace("[INSERT EXTRA HERE]", engine._extra_block())
                                   .replace("[INSERT TYPES HERE]", prompt_block(kit))
                                   .replace("[INSERT CHUNKS HERE]", body), max_tokens=max(4000, n * 300))
    except SystemExit as e:
        log(f"kits: Claude's answer did not parse — no graphics this time ({str(e)[:100]})")
        return []
    spec_file.write_text(json.dumps(specs, indent=1, ensure_ascii=False), encoding="utf-8")
    return specs


def _words_at(job: Path, words: str, near: float, window: float = 12.0):
    """The second the narrator starts saying `words` (a phrase from the script), found in words_heard.json within
    `window` s of `near` — the longest run of the phrase's words in order wins; None when nothing matches."""
    import re as _re
    norm = lambda w: _re.sub(r"[^a-z0-9]", "", str(w).lower())
    want = [norm(w) for w in words.split() if norm(w)]
    if not want:
        return None
    try:
        heard = json.loads((job / "words_heard.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    seq = []
    for h in heard:
        try:
            seq.append((norm(h[0]), float(h[1])))
        except (TypeError, ValueError, IndexError):
            continue
    best, best_n = None, 0
    for i, (w, t) in enumerate(seq):
        if abs(t - near) > window or w != want[0]:
            continue
        n = 1
        while n < len(want) and i + n < len(seq) and seq[i + n][0] == want[n]:
            n += 1
        if n > best_n or (n == best_n and best is not None and abs(t - near) < abs(best - near)):
            best, best_n = t, n
    return best if best_n >= min(2, len(want)) else None


def _spoken_at(job: Path, at: float, words: list, window: float = 7.0) -> list:
    """For each word, the second (relative to `at`) the narrator says it — from words_heard.json (whisper's word
    times), the nearest match within `window` s after the scene starts; unmatched words fall back to an even
    spacing after the previous one."""
    import re as _re
    try:
        heard = json.loads((job / "words_heard.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    norm = lambda w: _re.sub(r"[^a-z0-9]", "", str(w).lower())
    out, last = [], -1.0
    for w in words:
        key = norm(w)
        best = None
        for h in heard:
            try:
                hw, hs = norm(h[0]), float(h[1])
            except (TypeError, ValueError, IndexError):
                continue
            if hw != key or hs < at - 0.4 or hs > at + window or hs - at <= last:
                continue
            best = hs - at
            break
        if best is None:
            best = (last + 0.9) if last >= 0 else 0.0
        out.append(round(max(0.0, best), 2))
        last = out[-1]
    return out


def _grounds(kit: str, t: str) -> tuple:
    """(blur, brightness, saturation) of the footage frame under a scene type."""
    sharp = {"newsbar": (0, 0.92, 1.0), "label": (0, 0.95, 1.0), "moneyrain": (0, 0.9, 1.0), "corner": (0, 0.95, 1.0),
             "lower": (0, 0.95, 1.0), "page": (0, 1.0, 1.0), "phones": (0, 1.0, 1.0), "tracker": (0, 0.9, 0.0),
             "stamp": (0, 0.95, 1.0), "wave": (0, 1.0, 1.0), "board": (0, 1.0, 1.0), "doodle": (10, 0.3, 0.5),
             "stencil": (1.5, 0.7, 0.8), "maproom": (0, 0.9, 0.9), "mosaic": (4, 0.7, 0.8), "bigword": (3, 0.55, 0.8),
             "player": (0, 1.0, 1.0), "timeline": (0, 0.95, 1.0), "post": (9, 0.4, 0.7), "subs": (9, 0.35, 0.6), "title": (10, 0.45, 0.7), "chapter": (7, 0.6, 0.85), "line": (7, 0.55, 0.8),
             "title_gold": (8, 0.35, 0.5), "crosshair": (2, 0.75, 0.7), "alert": (6, 0.75, 0.6)}
    if kit == "analog":
        own = {"machine": (10, 0.36, 0.7), "steps": (18, 0.25, 0.5), "wave": (18, 0.22, 0.5), "record": (22, 0.36, 0.8),
               "price": (12, 0.38, 0.7), "units": (14, 0.3, 0.6), "timeline": (10, 0.4, 0.75), "quote": (16, 0.32, 0.6),
               "city": (0, 0.78, 0.95)}
        if t in own:
            return own[t]
    return sharp.get(t, (8, 0.5, 0.75))


def generate(engine, srt: Path, job: Path, total: float, force: bool, style: str, step_s: float, seg_dur: float,
             title: str = "") -> list:
    """[(start, path, dur)] — this kit's graphics for one video, each on the words it belongs to."""
    import docgfx
    log = engine.log
    kit = kit_for_style(engine, style)
    if not kit:
        return []
    st = engine.STYLE_INFO.get(style) or {}
    look = st.get("look") or {}
    max_s = float((st.get("pacing") or {}).get("graphic_max_s") or 9.0)
    if not title and (job / "title.txt").exists():
        title = (job / "title.txt").read_text(encoding="utf-8").splitlines()[0].strip()
    mo_dir = job / "motion"
    mo_dir.mkdir(exist_ok=True)
    entries = engine._parse_srt_full(srt.read_text(encoding="utf-8"))
    n = max(1, int(math.ceil(total / step_s)))
    specs = design(engine, srt, job, total, force, style, step_s, title)
    if not specs:
        return []
    lengths = durations(kit)
    placed, last_end = [], -3.0
    if isinstance(specs, dict):
        for raw in specs.get("items") or []:
            sc = _normalise(kit, raw)
            if sc is None:
                continue
            dur = min(max_s, lengths[sc["type"]])
            if sc["type"] == "flipchart":                     # two pages need no seven seconds: no page holds still
                dur = min(dur, 2.6 + 1.8 * max(0, len(sc.get("pages") or []) - 1))
            if raw.get("dur"):
                dur = min(max_s, max(2.0, float(raw["dur"])))
            # a graphic lives on its words: it starts where they are spoken, never seconds later. If the previous
            # scene is still running, that one is cut short (down to 2 s); when even that is not enough, the new
            # scene is left out — a big word arriving five seconds after it was said reads as a mistake
            want = max(float(raw.get("at_s") or 0) - 0.15, 0.0)
            # the director's time is a cue's; the graphic belongs to its WORDS — whisper knows where they are said
            heard_at = _words_at(job, str(raw.get("words") or ""), float(raw.get("at_s") or 0))
            if heard_at is not None:
                want = max(heard_at - 0.15, 0.0)
            at = want
            if placed and at < last_end + 0.4:
                p_at, p_sc = placed[-1]
                if last_end + 0.4 - want <= 1.2:              # a second late is fine — the eye does not notice
                    at = last_end + 0.4
                else:
                    room = at - 0.4 - p_at
                    if room >= 2.0:
                        p_sc["duration"] = min(p_sc["duration"], round(room, 2))
                        last_end = p_at + p_sc["duration"]
                    else:
                        continue
            if at + dur > total - 0.5:
                continue
            sc["duration"] = dur
            placed.append((at, sc))
            last_end = at + dur
    else:
        stream = engine._spoken_stream(entries) if hasattr(engine, "_spoken_stream") else None
        for i, raw in enumerate(specs[:n]):
            sc = _normalise(kit, raw)
            if sc is None:
                continue
            part = int(raw.get("part") or (i + 1)) - 1 if str(raw.get("part") or "").isdigit() else i
            lo, hi = part * step_s, (part + 1) * step_s
            at = engine._find_line(stream, raw.get("at") or "", lo, lo, hi) if stream else None
            at = at if at is not None else docgfx._moment(entries, raw.get("at") or "", lo, hi)
            at = at if at is not None and at >= 0 else lo + step_s * 0.35
            dur = min(max_s, lengths[sc["type"]])
            at = max(at - 0.15, last_end + 3.0, 0.0)
            if at + dur > min(hi + step_s * 0.5, total - 1.0):
                continue
            sc["duration"] = dur
            placed.append((at, sc))
            last_end = at + dur
    pics = docgfx._pictures(job, total)
    used, tmp = set(), Path(tempfile.mkdtemp(prefix="kit_g_"))
    render_jobs, segs = [], []
    try:
        for k, (at, sc) in enumerate(placed):
            timed = sorted((p for p in pics if p[0] >= 0 and str(p[1]) not in used), key=lambda p: abs(p[0] - at))
            still = [p for p in pics if p[0] < 0 and str(p[1]) not in used]
            pick = (timed or still or [None])[0]
            if pick is not None:
                used.add(str(pick[1]))
                blur, bright, sat = _grounds(kit, sc["type"])
                # a real photo of the person for the scenes that show one (chapter, tracker)
                photo_types = ("tracker", "chapter") + (("machine", "record", "quote", "city") if kit == "analog" else ())
                if sc["type"] in photo_types and (sc.get("subject") or sc.get("query")):
                    try:
                        import photofx
                        photo = photofx.source_photo(engine, sc.get("subject") or sc.get("name") or "", sc.get("query") or "",
                                                     job / "photofx" / f"kit_{k:02d}")
                        if photo:
                            pick = (at, Path(photo))
                    except Exception as e:                        # noqa: BLE001
                        log(f"  kits: {sc['type']} keeps a footage ground — {str(e)[:100]}")
                if kit == "analog" and sc["type"] in ("machine", "record", "quote") and str(pick[1]).lower().endswith((".jpg", ".jpeg", ".png", ".webp")) \
                        and "photofx" in str(pick[1]):
                    sc["frame"] = docgfx.ground_uri(pick[1], 0, 1.0, tmp, sat=1.0)      # the photo itself, sharp, in its frame
                sc["ground"] = docgfx.ground_uri(pick[1], blur, bright, tmp, sat=sat)
                if sc["type"] in ("page", "phones", "player", "timeline", "board", "stamp", "maproom"):
                    # a sharp frame as the "clip" inside the page, and a second, softer one for the ground
                    sc["frame"] = sc["ground"]
                    sc["ground"] = docgfx.ground_uri(pick[1], 9, 0.5, tmp, sat=0.7)
            if kit == "kinetic" and sc["type"] == "bigword" and sc.get("words_big"):
                sc["word_at"] = _spoken_at(job, at, [str(w) for w in sc["words_big"]])
            if kit == "atlas" and sc["type"] == "wave":
                # the picture that follows the wave (the nearest one after it) is what the paint reveals
                after = sorted((p for p in pics if p[0] >= at - 0.3), key=lambda p: p[0])
                if after:
                    sc["frame_next"] = docgfx.ground_uri(after[0][1], 0, 1.0, tmp, sat=1.0)
            sc["seed"] = 11 + k * 7
            out = mo_dir / f"kit_{k:02d}_{sc['type']}.mp4"
            if force:
                out.unlink(missing_ok=True)
            out.with_suffix(".sfx.json").write_text(json.dumps(sound_marks(kit, sc)), encoding="utf-8")
            segs.append((round(at, 2), str(out), sc["duration"]))
            if not out.exists():
                render_jobs.append((sc, out))
        if render_jobs:
            log(f"kits: rendering {len(render_jobs)} {KITS[kit]['label']} graphics in Chromium...")
            render(kit, render_jobs, workers=max(1, min(3, getattr(engine, "MOTION_WORKERS", 2))), look=look)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    kinds = [Path(p).stem.split("_", 2)[-1] for _, p, _ in segs]
    log(f"kits: {len(segs)} {KITS[kit]['label']} graphics — {', '.join(kinds[:12])}{' ...' if len(kinds) > 12 else ''}")
    return segs


def fix_transitions(engine, plan: list, job: Path, style: str) -> int:
    """Called once the plan is known: every ATLAS paint wave is drawn again over the picture BEFORE it, revealing the
    picture AFTER it — the kit rendered it earlier, before the order of the pictures was decided. Returns the number
    of waves redrawn (a wave already drawn for the same pair is left alone)."""
    import docgfx
    kit = kit_for_style(engine, style)
    if kit != "atlas":
        return 0
    look = (engine.STYLE_INFO.get(style) or {}).get("look") or {}
    try:
        specs = json.loads((job / "motion" / "doc_scenes.json").read_text(encoding="utf-8")).get("items") or []
    except (OSError, ValueError, AttributeError):
        specs = []
    waves = [x for x in specs if isinstance(x, dict) and x.get("type") == "wave"]
    tmp = job / "motion" / "_wave_tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    jobs, t = [], 0.0
    for i, e in enumerate(plan):
        if e[0] == "motion" and "_wave" in str(e[1]):
            nxt = plan[i + 1] if i + 1 < len(plan) else None
            prv = plan[i - 1] if i > 0 else None
            if nxt and nxt[0] == "photo" and Path(str(nxt[1])).exists():
                marker = Path(str(e[1])).with_suffix(".next.json")
                want = {"next": str(nxt[1]), "prev": str(prv[1]) if prv and prv[0] == "photo" else ""}
                try:
                    if json.loads(marker.read_text(encoding="utf-8")) == want and Path(str(e[1])).exists():
                        t += float(e[3])
                        continue
                except (OSError, ValueError):
                    pass
                spec = min(waves, key=lambda x: abs(float(x.get("at_s") or 0) - t)) if waves else {}
                sc = {"type": "wave", "kit": kit, "colour": str(spec.get("colour") or "yellow"), "duration": float(e[3]),
                      "seed": 11 + i * 7, "frame_next": docgfx.ground_uri(Path(str(nxt[1])), 0, 1.0, tmp, sat=1.0)}
                if want["prev"]:
                    sc["ground"] = docgfx.ground_uri(Path(want["prev"]), 0, 1.0, tmp, sat=1.0)
                jobs.append((sc, Path(str(e[1])), marker, want))
        t += float(e[3])
    if jobs:
        engine.log(f"kits: {len(jobs)} paint wave(s) redrawn over the pictures they really join")
        for _, out, _, _ in jobs:
            out.unlink(missing_ok=True)                    # render() keeps an existing clip
        render(kit, [(sc, out) for sc, out, _, _ in jobs], workers=1, look=look)
        for _, out, marker, want in jobs:
            if out.exists():
                marker.write_text(json.dumps(want), encoding="utf-8")
    shutil.rmtree(tmp, ignore_errors=True)
    return len(jobs)


# ── preview / check ──────────────────────────────────────────────────────────────
def samples(kit: str) -> list:
    """One scene of every type, with real-looking content, from the prompt's own examples."""
    out = []
    for line in KITS[kit]["prompt"].splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            raw = json.loads(line)
        except ValueError:
            continue
        sc = _normalise(kit, raw)
        if sc:
            sc["duration"] = KITS[kit]["types"][sc["type"]]
            out.append(sc)
    return out


def _preview(argv: list) -> None:
    import subprocess
    kits = list(KITS) if (argv[:1] or ["all"])[0] == "all" else [argv[0]]
    only = argv[1] if len(argv) > 1 else ""
    ground = HERE / "assets" / "kits" / "preview_ground.jpg"
    out_dir = HERE / "preview" / "kits"
    out_dir.mkdir(parents=True, exist_ok=True)
    import docgfx
    tmp = Path(tempfile.mkdtemp(prefix="kitprev_"))
    for kit in kits:
        if not (KIT_DIR / f"{kit}.js").exists():          # a kit kept on the author's machine (not shipped)
            continue
        jobs = []
        for sc in samples(kit):
            if only and sc["type"] != only:
                continue
            if ground.exists():
                blur, bright, sat = _grounds(kit, sc["type"])
                sc["ground"] = docgfx.ground_uri(ground, blur, bright, tmp, sat=sat)
                if sc["type"] in ("page", "phones", "player", "timeline", "board", "stamp", "maproom"):
                    sc["frame"] = sc["ground"]
                    sc["ground"] = docgfx.ground_uri(ground, 9, 0.5, tmp, sat=0.7)
                if kit == "analog" and sc["type"] in ("machine", "record", "quote"):
                    sc["frame"] = docgfx.ground_uri(ground, 0, 1.0, tmp, sat=1.0)
            out = out_dir / f"{kit}_{sc['type']}.mp4"
            out.unlink(missing_ok=True)
            jobs.append((sc, out))
        if not jobs:
            continue
        t0 = time.time()
        render(kit, jobs, workers=3)
        for sc, out in jobs:
            png = out.with_suffix(".png")
            at = min(float(sc["duration"]) * 0.62, float(sc["duration"]) - 0.4)
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{at:.2f}", "-i", str(out), "-frames:v", "1", str(png)],
                           check=False, capture_output=True)
        print(f"{kit}: {len(jobs)} scene(s) in {time.time() - t0:.0f}s -> {out_dir}")
    shutil.rmtree(tmp, ignore_errors=True)


def _check() -> int:
    """One frame of every type of every kit in Chromium: a JS error here is a scene that would fall out of a video."""
    from playwright.sync_api import sync_playwright
    bad = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--disable-gpu"])
        page = browser.new_page(viewport={"width": W, "height": H})
        for kit in KITS:
            if not (KIT_DIR / f"{kit}.js").exists():
                continue
            for sc in samples(kit):
                page.set_content(build_html(kit, sc), wait_until="load")
                try:
                    page.wait_for_function("window.__ready===true", timeout=30000)
                    err = page.evaluate("window.__err||''")
                    for t in (0.0, sc["duration"] * 0.5, sc["duration"] - 0.05):
                        page.evaluate("(t)=>window.renderFrame(t)", t)
                except Exception as e:                            # noqa: BLE001
                    err = str(e)
                if err:
                    bad += 1
                    print(f"FAIL {kit}/{sc['type']}: {err[:200]}")
                else:
                    print(f"ok   {kit}/{sc['type']}")
        browser.close()
    return bad


if __name__ == "__main__":
    if sys.argv[1:2] == ["preview"]:
        _preview(sys.argv[2:])
    elif sys.argv[1:2] == ["check"]:
        sys.exit(1 if _check() else 0)
    else:
        print(__doc__)
