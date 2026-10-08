#!/usr/bin/env python3
"""Draw a Mr Truth render package on a rented RunPod pod, with R2 as the post box. Always terminates the pod.
usage: cloud_run.py PACKAGE.tgz --limit N --out segments.tgz [--gpu "NVIDIA RTX A4000"] [--vcpu 16] [--max-min 40]
Env: RUNPOD_API_KEY FARM_BUCKET_ENDPOINT FARM_BUCKET_KEY_ID FARM_BUCKET_SECRET [FARM_BUCKET=videos]"""
import argparse, os, sys, time, uuid, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from farm.s3 import Bucket
from farm.runpod import RunPod
import requests

def create_v1(key, name, image, env, script, gpu, vcpu, ram, cloud, disk=40):
    body = {"name": name, "imageName": image, "cloudType": cloud, "gpuTypeIds": [gpu], "gpuCount": 1,
            "minVCPUPerGPU": vcpu, "minRAMPerGPU": ram, "containerDiskInGb": disk, "volumeInGb": 0,
            "dockerEntrypoint": ["bash", "-c"], "dockerStartCmd": [script], "env": env, "ports": []}
    r = requests.post("https://rest.runpod.io/v1/pods", json=body, timeout=60,
                      headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    return r.json()

ap = argparse.ArgumentParser()
ap.add_argument("package"); ap.add_argument("--limit", type=int, default=0); ap.add_argument("--out", default="segments.tgz")
ap.add_argument("--gpu", default="NVIDIA RTX A4000"); ap.add_argument("--vcpu", type=int, default=16)
ap.add_argument("--ram", type=int, default=32); ap.add_argument("--max-min", type=int, default=40)
ap.add_argument("--boot-min", type=int, default=8); ap.add_argument("--cloud", default="COMMUNITY"); ap.add_argument("--workers", type=int, default=0)
a = ap.parse_args()
E_ = os.environ
b = Bucket(E_["FARM_BUCKET_ENDPOINT"], E_.get("FARM_BUCKET", "videos"), E_["FARM_BUCKET_KEY_ID"], E_["FARM_BUCKET_SECRET"])
rp = RunPod(E_["RUNPOD_API_KEY"])
run = "run-" + uuid.uuid4().hex[:8]
k_pkg, k_seg, k_log, k_done = (f"mrtruth/{run}/{n}" for n in ("package.tgz", "segments.tgz", "log.txt", "done.json"))
print(f"[{run}] uploading {a.package} ...", flush=True)
b.put_file(k_pkg, a.package)
env = {"PKG_URL": b.presign(k_pkg, 7200), "SEG_PUT": b.presign(k_seg, 7200, "PUT"),
       "LOG_PUT": b.presign(k_log, 7200, "PUT"), "DONE_PUT": b.presign(k_done, 7200, "PUT"),
       "LIMIT": str(a.limit), "WORKERS": str(a.workers or max(1, a.vcpu // 4)), "MAX_MIN": str(a.max_min)}
script = r'''
set -u
cd /root && mkdir -p job && cd job
say(){ echo "$(date +%T) $*" | tee -a /root/log.txt; }
( while true; do sleep 45; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT" >/dev/null; done ) &
( sleep $((MAX_MIN*60)); say "watchdog: time limit"; curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT" >/dev/null; echo '{"ok":false,"why":"timeout"}' | curl -s -X PUT --data-binary @- "$DONE_PUT"; kill -TERM 1 ) &
say "nproc=$(nproc) mem=$(free -g | awk '/Mem/{print $2}')GB node=$(node --version 2>&1)"
say "apt libs"; export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >>/root/log.txt 2>&1
apt-get install -y -qq --no-install-recommends libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation ca-certificates python3 >>/root/log.txt 2>&1 || say "apt problem"
say "download package"; curl -s -m 600 -o pkg.tgz "$PKG_URL" && tar xzf pkg.tgz && rm pkg.tgz && say "unpacked"
ARGS="--out /root/segments.tgz"; [ "$LIMIT" != "0" ] && ARGS="$ARGS --limit $LIMIT"; [ "$WORKERS" != "0" ] && ARGS="$ARGS --workers $WORKERS"
T0=$(date +%s); say "render start"
python3 remote_render.py $ARGS >>/root/log.txt 2>&1; RC=$?
T1=$(date +%s); say "render exit=$RC seconds=$((T1-T0))"
curl -s -m 30 -X PUT --data-binary @/root/log.txt "$LOG_PUT" >/dev/null
[ -f /root/segments.tgz ] && curl -s -m 900 -X PUT --data-binary @/root/segments.tgz "$SEG_PUT"
echo "{\"ok\":$([ $RC = 0 ] && echo true || echo false),\"seconds\":$((T1-T0)),\"nproc\":$(nproc)}" | curl -s -X PUT --data-binary @- "$DONE_PUT"
sleep 3600
'''
pod = None
t0 = time.time()
try:
    tried = []
    for cloud in ([a.cloud] if a.cloud != "ANY" else ["COMMUNITY", "SECURE"]):
        for gpu in [g.strip() for g in a.gpu.split(",") if g.strip()]:
            try:
                pod = create_v1(E_["RUNPOD_API_KEY"], f"mrtruth-{run}", "node:22-bookworm", env, script, gpu, a.vcpu, a.ram, cloud)
                print(f"[{run}] pod {pod['id']} started ({gpu}, {cloud}, >= {a.vcpu} vCPU) cost/hr={pod.get('costPerHr')}", flush=True)
                break
            except Exception as e:
                tried.append(f"{gpu}/{cloud}: {str(e)[-90:]}")
        if pod: break
    if not pod:
        sys.exit("no pod could be started:\n  " + "\n  ".join(tried))
    last = ""
    while time.time() - t0 < a.max_min * 60 + 300:
        time.sleep(30)
        if b.exists(k_done):
            print(f"[{run}] done marker:", b.get_bytes(k_done).decode()[:200], flush=True); break
        try:
            log = b.get_bytes(k_log).decode(errors="replace").strip().splitlines()
            if log and log[-1] != last:
                last = log[-1]; print(f"[{run}] {int(time.time()-t0)}s | {last[:150]}", flush=True)
        except Exception:
            print(f"[{run}] {int(time.time()-t0)}s | waiting for the pod to start ...", flush=True)
            if time.time() - t0 > a.boot_min * 60:
                print(f"[{run}] no sign of life after {a.boot_min} min - giving up", flush=True); break
    else:
        print(f"[{run}] gave up waiting", flush=True)
    if b.exists(k_seg):
        n = b.get_file(k_seg, a.out); print(f"[{run}] downloaded {a.out} ({n/1e6:.1f} MB)", flush=True)
    try: print("---- pod log tail ----\n" + "\n".join(b.get_bytes(k_log).decode(errors="replace").splitlines()[-25:]))
    except Exception: pass
finally:
    if pod:
        ok = rp.terminate(pod["id"]); print(f"[{run}] pod terminated: {ok}; wall {int(time.time()-t0)}s", flush=True)
