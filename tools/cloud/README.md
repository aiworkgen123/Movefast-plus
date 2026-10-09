# Plan here, render on RunPod

1. Plan: `.venv/bin/python run_test.py script.txt voice.mp3 "Title" MINUTES --export` -> prints `PACKAGE <path>`.
2. Render: put RunPod and R2 credentials in a `cloud.env` beside you (never committed), `set -a; . ./cloud.env; set +a`,
   then `python tools/cloud/cloud_run.py PACKAGE.tgz --out segments.tgz --max-min 110 --cloud ANY --vcpu 32 --ram 32 --gpu "NVIDIA GeForce RTX 4090,NVIDIA RTX A5000,NVIDIA GeForce RTX 3090"`.
   The GPU is not used (Remotion draws on the CPU); it is only what RunPod rents CPU cores with. The pod is always terminated.
3. Finish: `.venv/bin/python run_test.py script.txt voice.mp3 "Title" MINUTES --segments segments.tgz`.

`--max-min` is a hard watchdog on the pod: size it to the film (about 6 min of render per minute of film on a 32-core pod).
