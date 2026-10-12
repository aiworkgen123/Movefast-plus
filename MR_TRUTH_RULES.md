# Mr Truth — the owner's rules

Every decision the owner has made about the Mr Truth channel, in one place. **These are binding.** Change one only when
the owner says so, and when he does, update this file in the same commit as the code. The code carries the same rulings
as comments next to what they control (search for `owner 2026-`).

Mr Truth is a photos-only documentary channel: archive photos, plus AI stand-in pictures where no real photo exists, cut
to the owner's own voiceover and script. It never uses stock footage or an AI presenter. Films are planned and drawn on
rented RunPod machines, rendered with Remotion (`mrtruth_renderer/`), and made through the website (`web/`).

---

## Costs and reliability

- **Budget:** at most **$2 per 20-minute film** for everything except the RunPod machine and Claude. Today this comes to
  about **$1.92**: picture checks $1.38, AI stand-in pictures $0.54, searches free. Whole film, machine and Claude included:
  about $4.70.
- **Reliability first:** no Gemini Flex tier, and no cheaper model that has not passed our own picture test.
- **Prices:** plan with this year's prices only; ignore announced price changes for next year.

## Picture checks (locked, "option A")

- `gemini-3.8-flash`, standard tier, with the questions of the 11-minute render `full-05f3c0` (`CHECK_V 1`, question
  sets `09ba59cf9af8` and `6e48a6a6e3c7`).
- Each check's fixed head is kept in a Gemini cache (`MRTRUTH_JUDGE_CACHE` on). Candidate pictures are sent at LOW detail.
  Answers use the normal format: no TERSE, no LEAN, no Flex.
- AI-drawing checks: `gemini-3.8-flash` at HIGH detail, cached.
- Each picture gets yes/no questions instead of a 0–10 score; the code turns the answers into a tier (exact / kind / generic / no).
- Every answer is saved (`verdicts.py`, R2 `mrtruth/verdicts/`) and reused by later films.
- Everything is checked **before** anything is drawn, with repairs; nothing is checked after render. Never a quietly
  worse film: stop and say why.
- Tested and rejected on quality: Gemini Flash-Lite, Seed 2.0 Mini and Lite, `gemini-3-flash-preview`. Not recommended
  without a test: DeepSeek V4.1 Flash, GLM-5.3 Flash (they score below Flash-Lite independently).

## Picture searches

- **Bing first** for generic or mood shots (free).
- **Wikimedia Commons first** only for a shot that names a person, place or thing. Bing follows if Commons gives
  nothing usable.
- **Brave** is only a backup, used when Bing fails completely (`MRTRUTH_BRAVE_LAST_MAX=0`).
- Later rounds: round 2 widens the wording (a generic shot may try Commons once there), round 3 searches the shot's anchor.
- **Frame crop-and-recheck:** a real photo refused only for a frame, ruler, colour chart, border, mount or margin is cropped
  about 10% at the edges and asked again. This happens only when the shot has nothing else usable. The crop must still
  be at least 800 px wide, with a width-to-height shape of 1.0–2.5.
- Documentary rule: a named thing gets its exact picture. Otherwise the order is a real photo of the same kind, then an
  AI stand-in in the film's fixed look, and only then anything else.
- **AI stand-ins:** Z-Image Turbo on WaveSpeed (about $0.005 each), at most `AI_PER_MIN` = 4 a minute of film. A stand-in
  may carry a naming label; each label is checked before render.
- **Reuse:** the same photo (or a near copy) at most twice, at least 90 s apart, at most 3.5 repeats a minute of film.

## Pacing (locked)

| Part of the film | Average shot length |
|---|---|
| First 60 s | 3.9 s |
| First 5 min | 4.0 s |
| First half | 4.0–4.1 s |
| Second half | 4.3 s |

- The sections blend smoothly, with no visible jump.
- First 30 s: 7–8 shots, and at most one shot over 6 s (the title shot included).
- Cuts follow the narration. A short punchy sentence gets its own quick shot.
- At most 4 quick (under 3 s) shots in a row.
- No shot over 8 s, except planned holds after 12:00.
- **Protect long sentences:** a long sentence about one thing stays one shot. It is only split if it runs over 8 s, or
  in the first 30 s.
- Text overlays land on their own words, within half a second. Chapters open at a sentence start, never in the middle
  of one.

## Text on screen

- **Gap fillers** stay exactly as they are ("those were good text overlays, video can be busy"): shadow-up, P02, P04,
  P05, P09, top-title, corner-label, bullet-checklist, two-photo-zoom. Aim: something on screen about every 10–15 s.
- Only one block of text is on screen at a time. When two want the same shot, a date or map keeps it and the other text
  moves to the nearest free shot; it is never dropped.
- Every template group is used and none dominates. Chapters are mandatory.

## Highlighted Text page (`highlight-page`)

- **When:** the narration references, quotes, describes, or attributes information to a person, document, book, article,
  report, study, record, file, testimony, statement, or other written/recorded source.
- **What:** highlight the specific phrase, claim, name, or finding being discussed, and generate a natural surrounding
  passage that gives context. The main phrase is highlighted while the narrator says it.
- **How often:** 2–3 per 10 minutes. Try hard to fit one in every film; skip only when nothing fits.
- **Sounds:** a scribble on the first highlight, a swish on the second and third.

## Location map (`location-map`)

- **When:** a specific place or city, in the US or abroad (Qumran Caves, Caddo Lake in Texas, Cairo in Egypt). Not a US
  state alone, and not a country alone. First mention only.
- Up to **3 per film**, about 1 minute apart. Not on a highlighted page or the title. The map shot is 5–8 s and starts
  as the name is said.
- Places closer together than 25 km get one map; the first one said wins.
- **Imagery:** the real place from EOX Sentinel-2 cloudless 2016 (CC BY 4.0), found with Nominatim. When that fails, our
  own terrain plates (green, desert, mountains, coast, snow). Never the reference film's footage.
- **Credit:** in the video description only.
- **Sound:** the owner's map sound.

## Date overlay (`date-stamp`)

- **When:** every important date, with no limit. Dates said in passing are skipped. First mention only.
- **Format:** a big line with the month or season as the narration says it, and a small line with the year
  ("March / 2026", "Spring / 1998"). A year alone shows just the year ("1994"). The day is dropped.
- No overlay for decades, centuries or relative dates ("six months later").
- Shown about 3–4 s, as the date is spoken. It replaces the old year cards (P12/P14) where a date is spoken.
- It takes the top-right corner. It may share a shot with a map.
- The date shot stays clean and bright, without the house shadow, vignette, grain or move.
- A chapter dip on a map or date shot is dropped and logged.

## Gallery strip

- 3 sounds, one for each move: pan, zoom in, zoom out.

## Background music (website)

- Plays **exactly as uploaded**: no fades, no ducking, no levelling, no looping. A longer file stops where the film ends;
  a shorter one simply ends.
- The only setting is volume: **100% by default**, can be lowered. The film's usual peak limiter is the only thing that
  touches the sum.

## How films are made

- On the website (`web/README.md`): sign in, drop the voiceover, the script and optional music, then press Create.
- Each film rents a few small machines (owner 2026-10-12, after the first film rented a $2.49/h machine): one
  planner (at least 16 processor cores) plans the film, draws its share of the shots and finishes it; the others (2 by
  default, "Machines per film" in Settings) only draw their share.
- **Where machines come from** (owner 2026-10-12): RunPod's cheap machines and Vast.ai's cheap machines are looked at
  together, and the cheapest good one free at that moment is rented. RunPod's processor-only machines ($0.48/h for 16
  cores, plenty in stock) are the backup, used only when nothing cheaper is free. Vast hosts must be in the US, Canada
  or Europe, at least 97% reliable, with fast internet and a recent processor. A drawing machine is never above
  $1.00/h, the planner never above $1.50/h. A source whose balance is too low is not used, and the page shows both
  balances.
- **Slow and broken computers are skipped** (owner 2026-10-12, as the price stays about the same: about 2 cents more on
  a 20-minute film): after each film, a Vast computer whose machine drew its share more than 1.6 times slower than the
  film's fastest machine is passed over for a week; one that could not start our machine at all, for 6 hours.
- **Reliability** (owner 2026-10-12): a film that finds no machine waits and tries again every 2 minutes for up to an
  hour, instead of failing. A drawing machine that cannot be found yet is looked for again while it can still help;
  otherwise the planner draws that share. A planning machine that dies, freezes (no sign of life for 12 minutes) or
  never starts is replaced automatically, up to twice, and the new one carries on from the saved plan: nothing is
  planned or paid for again. A frozen or failed drawing machine gets one replacement. Every machine is switched off
  when its part is done. Several films can run at once.
- An NVIDIA GPU does not speed this tool up; the drawing is processor-bound.
- Keys live only in the website's Settings (`keys.env` on the server) and as private settings on the machine while it
  runs. **Never in git.**
