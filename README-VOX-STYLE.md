# Vox style scenes — built into MoveFast

A few moments of a video told as hand-cut paper collage: black-and-white halftone cutouts of
the real people with their real faces, torn archival photos, typewriter labels, rubber stamps,
big number cards, pins and red string, in the story's own accent colour — cut to the narration
and animated like paper on a tabletop. Options → **Vox style scenes** switches them on or off
for any channel that offers them (Documentary does).

Documentary's Vox sequences now receive the per-video creator instructions. They should lead with
subject imagery, allow occasional clearly illustrative AI pictures, and avoid reusing subject media;
paper textures may recur. A sequence with no usable pictures keeps the underlying coverage instead.
Vox records original photo references and rendered images for the final duplicate-media check.
For the current setup, Atlas Cloud/Seedream is tried first; switching to WaveSpeed follows a reviewed
failure, not an automatic fallback. A failed Documentary image batch is not retried automatically on
the same provider. Use a new test version with a fresh edit plan when trying different instructions.

## What you need

- **WaveSpeed** (`WAVESPEED_API_KEY`) hosts the reference photos and draws the pictures.

## How a scene is made

- **The moment** — the director (`director.py`) picks the 7–14 seconds of narration best told as
  collage when relationships or mechanisms need it. Documentary has no mandatory Vox opening,
  per-minute cadence, cap or percentage quota. One whole-video review considers all parallel draft
  stretches for useful additional or alternative treatments while preserving strong choices. Variety
  includes composition and edits over real footage; a suitable repeated family remains available.
  Existing timing checks and tool preparation still apply.
- **The shots** — the optional director reason, brief and proposed media descriptions travel with
  the moment as sourcing intentions, not verified assets, alongside Documentary and creator instructions.
  Claude cuts the moment into shots of two to four seconds and designs each: a
  cutout or an archival photo, and cards — a headline with an underline, a typewriter label, a
  stamp, a number, pins joined with red string. Every card lands on the word that names it.
- **The pictures** — drawn once each. A real person, place or thing uses the lead photograph of
  its Wikipedia article as the reference, so the likeness is real; only public-domain, CC0 and
  CC BY photographs are used, and each one's licence is written to `credits.json` in the video's
  folder. A real person with no free photograph is never invented — the shot keeps their name
  card instead. Private people (victims, relatives, ordinary employees) are never drawn at all.
- **The movement** — everything moves on your computer, for free: cutouts spring up, labels
  type on, stamps thump down, numbers tick, string draws itself, the camera drifts. Text and
  numbers on screen are therefore always exactly right.

## Cost

About four pictures a scene: roughly $0.11 a scene on WaveSpeed. A person or
thing that comes back in other styles may be drawn only once; Documentary requires distinct subject media.

## Change the look

The house look is `assets/vox/defaults.json`: `image_style` (what every picture looks like),
`video_style` (how things move — the shot designer reads it) and the shot prompt. A channel can
override any of it under `look.vox` in its style file. The animation itself lives in `vox.py`.
Ask Claude Code — it knows where everything is.
