# Remote render (Mr Truth)

Plan on one machine, draw the shots on another.

INSTALL (into your MoveFast folder, overwriting):
  mrtruth.py                         -> MoveFast/mrtruth.py
  run_test.py, remote_render.py      -> MoveFast/
  mrtruth_renderer/movefast/render.mjs -> MoveFast/mrtruth_renderer/movefast/render.mjs
(Back up the old mrtruth.py and render.mjs first.)

1) PLAN (where Claude + Gemini + your keys are, ~1 minute for 3 min of video; nothing heavy is drawn):
   .venv/bin/python run_test.py script.txt voice.mp3 "Title" 3 --export
   -> output/mr-truth/_work/<slug>/mrtruth/render_package.tgz   (about 56 MB per 3 minutes)
   Pictures are searched on Bing first (free; it needs curl_cffi from requirements.txt); a shot that NAMES a person,
   place or thing (its archive name or an entity that is not a date) searches Wikimedia Commons first and Bing only
   when Commons gave nothing usable; a generic shot asks Commons once in round 2 when Bing gave nothing usable (owner
   2026-10-10). Brave is only Bing's backup (a failed, blocked or junk answer, or too few pictures that fit; at most
   MRTRUTH_BRAVE_LAST_MAX=30 a film while Bing works). The log says "Bing (free web pictures): ok" before the first
   search, "Bing ... is OFF" (and why) if it stops answering, how many shots looked at Commons or Bing first and how
   often Commons was asked in its "search order:" line, counts every search in its "search:" line and in
   mrtruth/search.json. MRTRUTH_ARCHIVES=1 keeps the old order (Commons for every shot, then the open archives). A dry or missing Brave key is a warning now; the run stops only when Bing is off as well.
   MRTRUTH_WEB_SEARCH=brave goes back to Brave for every search.

2) DRAW (any Linux machine: Netcup server, RunPod pod). Needs node 20+, the Chromium libraries
   (apt install libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2). NO API keys needed.
   mkdir job && cd job && tar xzf ../render_package.tgz
   python3 remote_render.py            # uses cores//4 processes x 4 frames; prints progress every 30 s
   python3 remote_render.py --limit 2  # timing test on 2 shots first
   -> segments.tgz

3) FINISH (back on the planning machine; joins shots, mixes sound, final video):
   .venv/bin/python run_test.py script.txt voice.mp3 "Title" 3 --segments segments.tgz
   The finish uses the plan saved in step 1 (mrtruth/plan.json): nothing is planned again and no Claude, Gemini or
   Brave call is made. A shot missing from segments.tgz stops it with the shot's name (MRTRUTH_ALLOW_DEGRADED=1 draws
   it here instead). Its timings go to mrtruth/timing_finish.json; mrtruth/timing.json keeps the planning run's.

NOTES
- Use the same title/script/voice for steps 1 and 3 so the job folder matches.
- Do not reuse segments drawn with a different quality setting.
- Chromium gl backend: add  --gl angle  (or swangle) to remote_render.py if drawing is slow or fails.
- Tested: export, drawing 1 shot from the package on a clean folder, unpacking. NOT yet tested: a full film
  on a remote machine, or on RunPod.

AUTOMATED ON RUNPOD (cloud_run.py)
   Env: RUNPOD_API_KEY, FARM_BUCKET_ENDPOINT, FARM_BUCKET (default "videos"), FARM_BUCKET_KEY_ID, FARM_BUCKET_SECRET
   .venv/bin/python cloud_run.py output/mr-truth/_work/<slug>/mrtruth/render_package.tgz --out segments.tgz \
       --cloud ANY --vcpu 16 --ram 16 --gpu "NVIDIA GeForce RTX 3080 Ti,NVIDIA GeForce RTX 3070,NVIDIA RTX A4000"
   Uploads the package to R2, rents the first card in the list with >= --vcpu cores, draws, downloads
   segments.tgz, and always terminates the pod. Measured 2026-10-08: 55 shots (3:13 film) in 6.4 min on an
   RTX 3080 Ti pod (32 vCPU, $0.18/h). The GPU is not used; the pod is rented for its CPU cores.

PICTURE CHECKS AND SAVED VERDICTS (2026-10-10)
   Every candidate picture is checked with short yes/no questions on the same Gemini as before (gemini-3.8-flash,
   thinking low): added text, a frame, a banned kind, real or not, modern things for the shot's era, and what it shows
   for the line - exact (the very thing the shot names, or the stand-in's role), kind, generic, no. One shot a call, at
   most 6 pictures (search order), seen at MEDIUM; a drawn stand-in alone at HIGH as a 1280-px copy, with the owner's
   non-Latin script rule and a question about warped faces and hands. Log: "picture checks (...)" and the tiers on
   screen; mrtruth/verdicts.json; pick_audit.json per shot (best tier, exact/kind counts, what was refused).
   Every answer is kept in output/_shared/picture_verdicts.sqlite (verdicts.py): a line asked before comes from it, a
   picture found with added text or a frame (seen at MEDIUM or better) is not sent again for any line or film, and two
   shots never ask the same question at once. On a pod, fullrun.py seeds the store from R2 (mrtruth/verdicts/) and the
   pod uploads its own answers every ~10 minutes, after planning, after the finish, at the end and on a stop.
   Knobs: MRTRUTH_JUDGE=score (the old 0-10 judge, for an A/B), MRTRUTH_JUDGE_MEDIA (MEDIUM), MRTRUTH_AI_CHECK_MEDIA
   (HIGH), MRTRUTH_JUDGE_PICS (6), MRTRUTH_JUDGE_ENOUGH (2: more pictures are looked at only while fewer pass),
   MRTRUTH_VERDICTS=off, MRTRUTH_VERDICTS_DB (the store's file), MRTRUTH_RUN_ID.
   Store by hand: python verdicts.py stats|export|import|compact ...
   A frame alone (a ruler, colour chart, border, mount or margin along an edge) on a real photo of the right kind is
   cut off - 10% at each edge - and the crop asked once more (one picture a call, kept in the store under the crop's
   own identity), only for a shot with no other usable picture, and only when the crop is still 800 px wide and
   1.0-2.5 in shape; at most MRTRUTH_CROP_MAX (25) a film. Counted in "picture checks (...)" (frame rechecks, their
   cost), verdicts.json, timing.json and pick_audit.json; shots.json marks a cropped picture.
   The Flash-Lite fixes (2026-10-11, question set CHECK_V 2 - older answers stay in the store, unused): every answer
   first names when and in what tradition the thing shown was made ("made"); with the era question comes a yes/no
   "other_era" - another century's or tradition's version of the thing - that the code turns into "no" (replaced in
   round 2, below). The frame question walks all four edges; a print's margin
   title is added text; every field up to studio is always given, and a refusal that leaves out "shows" counts as a
   refusal for its reason. Free pixel tests run before any question: uniform bands along the edges (bars, a mount,
   a margin) or a flat line splitting the picture (strips stacked, side by side) refuse it as framed without asking
   - the frame crop then cuts it to the box inside the bands or to its largest part; an over-saturated HDR look is
   refused as glossy on a shot whose time matters, a merely glossy one ranked below a plain one. Logged in
   "picture checks (...)" ("framed and glossy by the pixel test"). For Flash-Lite at LOW:
   MRTRUTH_JUDGE_MODEL=gemini-3.5-flash-lite MRTRUTH_JUDGE_MEDIA=LOW (the default stays gemini-3.8-flash, MEDIUM).
   Round 2 (2026-10-11, CHECK_V 3): the century is decided in code. "made" names the thing's date first (at most 5
   words); the code reads it as years and compares it with the line's OWN time - the beat's era, the dates in its
   sentence, else the dossier notes of what it names - never the film's catch-all period, only on a SPECIFIC line (it
   names something, is about a person, or gives a date), never against the very place or object the shot names (a
   1794 view or a modern photo of the Vatican Library is the Vatican Library), and with a margin; an undated,
   catch-all or abstract line is never refused on its date. The yes/no "other_era" is gone; a specific line is asked
   instead whether the picture is the line's kind of thing ("same": a codex for a codex, not a library hall), and no
   becomes "no". A 20th-century shot's era question asks only for what did not exist yet then. The default century
   rule (the owner has not ruled yet) lives in WORLD_RULE and _date_off. The AI-picture checks stay on
   MRTRUTH_AI_CHECK_MODEL (gemini-3.8-flash; MRTRUTH_AI_CHECK_THINKING, default "low" when it is not the judge's model)
   when the candidates' checks move to Flash-Lite, and a defect answered in words ("a collage") counts. More free
   frame tests: a thin border all round, a narrow gap between two scans, a transparency checkerboard. Ticket and tour
   sellers and facsimile shops are refused before download, as stock is.

PACING, OVERLAYS ON THEIR WORDS, NOTHING OVER 8 S (2026-10-10)
   Claude's shot list is kept as Claude wrote it (mrtruth/beats.json) and paced every time it is loaded: about 4.2 s a
   shot, cuts on the narration, punchy whole sentences kept quick, fragments folded into their sentence, at most 4
   quick shots in a row, nothing over 8 s. Log: "pacing: N planned shots ... -> M shots, ...". MRTRUTH_PACE_AIM (4.2)
   moves the average without asking Claude again. After the pictures every overlay and typed caption starts on its
   own words, a chapter on a sentence start; then "shots after sync: ..." - a shot still over 8 s is cut in two on
   the narration, and its new part shows a runner-up that passed the checks (never a copy of a photo on screen), else
   a repeat the reuse rule allows, logged with "⚠ ... cut in two". A planned long hold (after 12:00) is the only shot
   past 8 s. The finish hands the plan's shot starts to the final encode's stall check (also in a prepared farm
   bundle's manifest.json as "cuts"), so a slow move on a dark photo or a planned hold is never re-muxed as a stall.

REPEATS AND AI STAND-INS, COUNTED ON THE FINAL CUT (2026-10-10)
   The pictures are chosen in three passes: each shot's own picture in film order; then the AI stand-ins, spread by
   need across the film (the shots nothing else could fill first, then the densest open stretches, at most 6 in any
   minute) and counted ON SCREEN - 4 a film minute (MRTRUTH_AI_PER_MIN), drawn within 2 drawings per picture shown
   (MRTRUTH_AI_DRAWS_PER_SHOWN; a refused drawing uses the drawing budget, not the stand-ins); then for what is still
   open a repeat within 3.5 a minute (MRTRUTH_REUSE_PER_MIN), a join to a plain shot beside it, a long hold, a weaker
   unused picture - or the planner stops with the reason. A photo (the same bytes or a near copy, a template's
   companion too) is shown at most twice, 90 s apart on the final cut. Lines whose picture is Latin writing are drawn
   as the object closed or turned away; the stand-in is drawn only on his own lines (beside a person: his place, with
   nobody in it). Log: "stand-ins: ...", "repeats: ...", then after the last sync "reuse on the final cut: ..." (also
   mrtruth/reuse.json and the pod summary's "reuse"), with "reuse guard: ..." for each repair (another runner-up,
   another repeat, a join; sync is never run again). MRTRUTH_AI_WINDOW_MAX (6) and MRTRUTH_AI_AT_ONCE (4: stand-ins
   drawn and checked at the same time - the result is the same as one at a time) tune the spread.

THE GATE BEFORE DRAWING (2026-10-10)
   Every rule is checked in code once the cut is final (after the reuse guard), before transitions, scenes and the
   render; nothing is checked after render any more (the old after-render check() and make_video's Gemini look are
   gone from this channel). Checked: no shot over 8 s but a planned hold (after 12:00, at most 4, half after 15:00), at
   most 4 quick shots in a row, the average 4.0-4.6 s; repeats by photo identity (the cap, 90 s, two showings, never
   side by side); stand-ins on screen within the cap; every overlay and typed caption on its words; never 30 s without
   words; no word cut short in the opening title or a chapter heading; a line taken from the narration ends where a
   clause ends or on a noun; every overlay group at least its minimum and within its cap scaled to the film; one block
   of words a frame and never the same words twice within a minute; no empty or broken template field; the opening
   title on the first shot; the period where it matters, from the stored answers only (never a new question). Plus the
   card check: every label that names its picture is asked once - "does this picture show <label>?" - on the judge's
   own Gemini at HIGH, kept in the verdict store (a re-run asks nothing); a "no" moves the label to a runner-up that
   shows it, else re-sets its words as a line that names no picture, else drops it. Each break is repaired (a template
   dropped, moved or re-set, a picture swapped, a shot joined or cut on the narration, a filler re-worded) and the whole
   checked again, up to 5 rounds; only what no repair can fix stops the run, and the stop names the rule, the shot and
   the setting to change (MRTRUTH_ALLOW_DEGRADED=1 lets it through). A group minimum no shot can carry rightly is a
   warning, not a stop. Log: "pre-render gate: PASS|REPAIRED|STOPPED - ..." and the repairs; record: mrtruth/gate.json
   (the pod summary's "gate"). Read it back with `python mrtruth.py check <job>` - gate.json, then every code rule again
   on plan.json, read-only (a label the card check never saw is a LOOK line). Knobs: MRTRUTH_CARD_CHECK=off (no look;
   the labels stay as placed, logged), MRTRUTH_CARD_BATCH (12 a call), MRTRUTH_CARD_MAX (60 pictures a film).
