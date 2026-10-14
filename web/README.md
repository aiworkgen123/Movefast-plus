# Mr Truth Studio (the website)

A private website for making Mr Truth films. You sign in, drop a voiceover, a script and (if you like) background
music, and press **Create film**. The film is made on a rented RunPod machine and shows up in the list with a player
and a download button. Your PC and your own GPU machines will be added as places to make films later; they are
already shown in the list as "coming".

## What runs where

| Part | Where | Cost |
|---|---|---|
| The website, the list of films, the keys | your small server (DigitalOcean, Hetzner...) | about $6 a month |
| Making a film | a few small machines per film (Settings → Machines per film, 3 by default): the cheapest good one free right now on RunPod or Vast.ai, RunPod's processor-only machines as the backup, each switched off when done | about $0.25–0.60 per 20-minute film (up to about $1.20 on the backup) |
| Your files and finished videos | your Cloudflare R2 storage | pennies |

The small server never makes videos, so it does not slow them down. One machine plans the film and draws a share of
the shots; the others only draw their share and are switched off as soon as it is sent. If no machine is free, the film
waits and tries again every 2 minutes (up to an hour). If a drawing machine cannot be rented or fails, another one is
tried, or the planning machine draws that share itself. If the planning machine dies or freezes, a new one carries on
from the saved plan, so nothing is planned or paid for twice. A Vast computer that proves slow (over 1.6 times slower
than the film's fastest machine) is skipped for a week, and one that cannot start a machine for 6 hours. If the website restarts in the middle of a film, the
machines carry on and the film appears when it is done.

Keep some money on both accounts (RunPod and Vast.ai) and turn on automatic top-up: at $0 RunPod switches every machine
off and the films in progress are lost. The page shows both balances, in red when they run low.

The same goes for Claude (console.anthropic.com, Plans & Billing): a 3-minute film uses about $0.35-0.40 of it, a 20-minute
film about $1.80, and a film whose Claude account runs dry while it plans stops. A film checks Claude before it rents a
machine and waits (up to an hour) while the account is empty; "Test keys" in Settings checks it too.

## Who plans a film (Settings → Planner)

* **Claude Sonnet** is the default, and what every film used so far: Anthropic answers every planning call.
* **Claude Sonnet through Token Supply (cheaper, test)** is off by default and on test until test films show the same
  quality. Token Supply (token-supply.com) resells the same Claude Sonnet at about 30% of Anthropic's price. New films
  need its key (Settings → Keys); the Anthropic key stays needed, because Anthropic still writes the highlighted pages
  and is the automatic backup: a call Token Supply cannot answer, or answers unusably, is asked again or answered by
  Anthropic (said in the film's log, counted in its summary), and after a refused key or repeated failures Token
  Supply is off for the rest of that film. A film never waits for or stops because of Token Supply: one without its
  key is made all the same and Anthropic plans it; the list then says "Token Supply was off (...): Anthropic planned
  in its place". The film's cost shows Token Supply's bill next to Claude's (Anthropic's). "Test keys" checks the key
  with a one-token call (about $0.0002); a film never asks Token Supply before its machine is rented.
* The choice applies to films made after it is saved; each film keeps the planner it was made with (a Try again and a
  replacement machine too), and the list shows "planner: Claude through Token Supply (test)" on such a film.

## Install (once)

1. Create an Ubuntu 24.04 server (the $6 plan is enough) and open its web console.
2. Paste this into the server console and answer its two questions (your sign-in name and password, then your web
   address, or Enter for a free one):

   ```
   curl -fsSL https://raw.githubusercontent.com/aiworkgen123/Movefast-plus/mrtruth-web/web/install.sh -o install.sh && bash install.sh
   ```
   (If the repository is ever made private, the installer also asks for a read-only GitHub token: github.com →
   Settings → Developer settings → Fine-grained tokens → only `Movefast-plus` → Contents: Read-only.)
3. Open the address it prints, sign in, go to **Settings**, paste your keys, press **Test keys**.
4. Add your employees under **Settings → People** (members can make films, only owners see Settings).

## Later

* Background music plays exactly as uploaded (no fades, no ducking, no looping) at the volume chosen on the slider
  (100% unless lowered); a longer file stops where the film ends.
* **Settings → Update the tool** fetches the newest version; films being made carry on.
* A forgotten password: in the server console, `cd /opt/mrtruth/code && sudo -u mrtruth MRTRUTH_WEB_DATA=/var/lib/mrtruth /opt/mrtruth/venv/bin/python -m web.manage password NAME`
* Your own web address: point it at the server's IP address (an A record), then run the installer again and type it.

## For developers

* `web/app.py` the website (Flask, one process), `web/jobs.py` the job runner and the pod's script, `web/store.py`
  the records (SQLite), `web/static/index.html` the page, `web/install.sh` the server set-up.
* Data lives in `MRTRUTH_WEB_DATA` (`/var/lib/mrtruth` on the server): `studio.sqlite`, `keys.env` (0600), each
  film's uploaded files under `jobs/<id>/`, `studio.log`.
* A no-cost local try: `MRTRUTH_WEB_DATA=/tmp/mt MRTRUTH_WEB_FAKE=1 python -m web.manage add-owner me` then
  `MRTRUTH_WEB_DATA=/tmp/mt MRTRUTH_WEB_FAKE=1 python -m web.app` and open http://127.0.0.1:8080 ("Test run").
* Tests: `python -m unittest tests/test_web.py tests/test_mrtruth_music.py tests/test_mrtruth_tokensupply.py`.
