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
   Pictures are searched on Wikimedia Commons first, then Bing (free; it needs curl_cffi from requirements.txt), with
   Brave only as Bing's backup (a failed, blocked or junk answer, or too few pictures that fit; at most
   MRTRUTH_BRAVE_LAST_MAX=30 a film while Bing works). The log says "Bing (free web pictures): ok" before the first
   search, "Bing ... is OFF" (and why) if it stops answering, and counts every search in its "search:" line and in
   mrtruth/search.json. A dry or missing Brave key is a warning now; the run stops only when Bing is off as well.
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
