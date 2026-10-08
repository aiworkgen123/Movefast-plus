"""Sparse illustrative Documentary shots; durable per-job paid-attempt ceiling."""
import styles as _styles
import fcntl
import hashlib
import json
import math
import os
import subprocess
from fractions import Fraction
from pathlib import Path

import heygen

DEFAULT_POLICY = {"max_clips": 3, "window_seconds": 120, "resolution": "480p"}   # owner rule: 3 x 5 s, first 2 min
SHOT_SECONDS = 5.0
TOOL = """- heygen — optional five-second illustrative generated footage, never authentic evidence:
  {"tool":"heygen","cue":12,"words":"bucket cuts the soil",
   "reason":"Make the narrated digging action visible","brief":"One scoop and lift in real time",
   "prompt":"A fully specified five-second shot of the narrated object doing that useful action..."}
  Use sparingly, zero to the whole-video maximum below, never a quota or per-minute cadence.
  Real media remains prominent. Match the narrated object AND action; no authentic named machine,
  person or historical-event claims. The main planner writes the complete prompt from the brief:
  camera body/lens/aperture, fixed or necessary camera movement, available light and ordinary texture,
  one coherent useful action in five seconds at real-time speed, specific tool-material contact,
  stable rigid geometry and grounded parts. No needless camera drift, invented markings, logos, text,
  overlays, particles, narration or music. Generated audio will be removed. No cuts, loops or freezes.
"""


def enabled(engine, style):
    features = getattr(engine, "_FEATURES", {}) or {}
    return (_styles.is_documentary(style) and bool(os.environ.get("HEYGEN_API_KEY", "").strip())
            and bool(features.get("ai_images", True)) and not features.get("_heygen_ai_disabled"))


def _checked(value):
    if not isinstance(value, dict) or set(value) - set(DEFAULT_POLICY):
        raise ValueError("HeyGen policy must contain only max_clips/window_seconds/resolution")
    policy = {**DEFAULT_POLICY, **value}
    if type(policy["max_clips"]) is not int or policy["max_clips"] < 0:
        raise ValueError("HeyGen max_clips must be a nonnegative integer")
    window = policy["window_seconds"]
    if type(window) not in (int, float) or not math.isfinite(window) or window < 0:
        raise ValueError("HeyGen window_seconds must be finite and nonnegative")
    if policy["resolution"] not in ("480p", "768p"):
        raise ValueError("HeyGen resolution must be 480p or 768p")
    return policy


def policy(job):
    """Freeze the manually authored policy for this plan; AI cannot change it."""
    job = Path(job)
    override = job / "heygen_policy.json"
    configured = _checked(json.loads(override.read_text()) if override.exists() else {})
    root = job / "heygen"
    root.mkdir(parents=True, exist_ok=True)
    with (root / "policy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        snapshot = root / "effective_policy.json"
        if snapshot.exists():
            effective = _checked(json.loads(snapshot.read_text()))
            if effective != configured:
                raise ValueError("HeyGen policy changed; explicitly clear/replan scenes to apply it")
            return effective
        heygen._save(snapshot, configured)
        return configured


def prompt_block(job):
    cfg = policy(job)
    return TOOL + (f"  Whole-video limit: at most {cfg['max_clips']} shots, each five seconds, "
                   f"entire interval inside 0–{cfg['window_seconds']} seconds, {cfg['resolution']}. "
                   "No room on the cue means omit, never shift the shot off narration.\n")


def fits(at, duration, cfg, total=float("inf")):
    return (type(at) in (int, float) and math.isfinite(at) and at >= 0
            and type(duration) in (int, float) and math.isfinite(duration)
            and 0 < duration <= SHOT_SECONDS and at + duration <= min(cfg["window_seconds"], total))


def _digest(path):
    with Path(path).open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def _probe(path):
    return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-count_frames",
                     "-show_streams", "-show_format", "-of", "json", str(path)], text=True))


def _clip(path):
    info = _probe(path)
    streams = info["streams"]
    duration = float(info["format"]["duration"])
    if len(streams) != 1 or streams[0].get("codec_name") != "h264" or not 0 < duration <= SHOT_SECONDS + 1e-9:
        raise ValueError("HeyGen output must be silent H.264, at most five seconds")
    return duration


def _export(raw, output):
    info = _probe(raw)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    rate = Fraction(video["avg_frame_rate"])
    frames = rate * 5
    if rate != Fraction(video["r_frame_rate"]) or not 1 <= rate <= 120 or frames.denominator != 1 or int(video["nb_read_frames"]) < frames:
        raise ValueError("HeyGen raw clip cannot supply five seconds without padding")
    temp = output.with_name(output.stem + ".exporting.mp4")
    try:
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
                        "-map", "0:v:0", "-an", "-vf", f"trim=end_frame={int(frames)},setpts=PTS-STARTPTS",
                        "-fps_mode", "passthrough", "-c:v", "libx264", "-crf", "18",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(temp)],
                       check=True, capture_output=True)
        if abs(_clip(temp) - SHOT_SECONDS) > 1e-9:
            raise ValueError("HeyGen export is not exactly five seconds")
        temp.replace(output)
    finally:
        temp.unlink(missing_ok=True)


def _aligned(engine, cues, words, at):
    current = engine._find_line(engine._spoken_stream(cues), words, at, at - 3, at + 8)
    return current is not None and abs(float(current) - at) <= 0.011


def add_to_timeline(segs, srt, job, style, force, workers=1, engine=None):
    """Add only prepared, cue-aligned moments. Force never clears paid state."""
    if engine is None or not enabled(engine, style):
        return segs
    cfg = policy(job)  # Invalid policy fails closed before any paid work.
    moments_file = job / "heygen" / "moments.json"
    if not moments_file.exists() or not (job / "director.json").exists():
        return segs  # Old caches never trigger newly invented shots.
    moments = json.loads(moments_file.read_text())
    if not isinstance(moments, list):
        raise ValueError("Invalid HeyGen moments")
    cues = engine._parse_srt_full(srt.read_text())
    if not cues:
        return segs
    total = cues[-1][1]
    root = job / "heygen"
    ledger_file, media_file = root / "ledger.json", root / "media.json"
    result = list(segs)
    with (root / "ledger.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = json.loads(ledger_file.read_text()) if ledger_file.exists() else {}
        media = json.loads(media_file.read_text()) if media_file.exists() else {}
        for moment in moments:
            at, duration = moment.get("at_s"), moment.get("dur")
            if not fits(at, duration, cfg, total) or duration != SHOT_SECONDS:
                engine.log("heygen: omitted a moment outside the effective limits")
                continue
            if not all(isinstance(moment.get(k), str) and moment[k].strip() for k in ("words", "reason", "brief", "prompt")):
                engine.log("heygen: omitted an incomplete shot brief")
                continue
            if not _aligned(engine, cues, moment["words"], at):
                engine.log("heygen: cue timing changed or words missing; omitted without shifting")
                continue
            identity = hashlib.sha256(" ".join(moment["prompt"].split()).casefold().encode()).hexdigest()
            record = ledger.get(identity)
            output = root / f"clip_{identity}.mp4"
            if any(Path(p).resolve() == output.resolve() for _, p, _ in result):
                continue  # The same representation is already present; do not double count it.
            if any(at < float(t) + float(d) and float(t) < at + duration for t, _, d in result):
                engine.log("heygen: omitted a blocked cue; underlying coverage retained")
                continue
            payload = {"model": heygen.MODEL, "mode": "text_to_video", "prompt": moment["prompt"],
                       "duration": 5, "resolution": cfg["resolution"], "aspect_ratio": "16:9",
                       "prompt_enhancement": "disabled", "seed": int(identity[:8], 16)}
            fingerprint = heygen.fingerprint(payload)
            if record:
                if (record.get("fingerprint") != fingerprint or record.get("at_s") != at
                        or record.get("status") != "completed"):
                    engine.log("heygen: prior attempt omitted; no automatic retry or new placement")
                    continue
                if not output.exists() or _digest(output) != record.get("sha256"):
                    engine.log("heygen: cached asset changed or missing; omitted without resubmission")
                    continue
            else:
                if len(ledger) >= cfg["max_clips"]:
                    engine.log("heygen: paid-attempt ceiling reached; underlying coverage retained")
                    continue
                record = {"fingerprint": fingerprint, "at_s": at, "seed": payload["seed"],
                          "raw": str(root / f"raw_{identity}.mp4"), "path": str(output), "status": "started",
                          "srt": str(srt.resolve()), "words": moment["words"]}
                ledger[identity] = record
                heygen._save(ledger_file, ledger)  # Count even failed or uncertain submissions.
                try:
                    heygen.generate(payload, Path(record["raw"]))
                    _export(Path(record["raw"]), output)
                    record.update(status="completed", sha256=_digest(output), raw_sha256=_digest(record["raw"]))
                except (Exception, SystemExit) as error:
                    record["status"] = "omitted"
                    # Never log provider bodies or a subprocess command containing credentials.
                    engine.log(f"heygen: omitted failed shot ({type(error).__name__}); underlying coverage retained")
                finally:
                    sidecar = Path(record["raw"] + ".heygen.json")
                    if sidecar.exists():
                        state = json.loads(sidecar.read_text())
                        record["job"] = {k: state[k] for k in ("video_id", "request_id", "status", "idempotency_key") if k in state}
                    heygen._save(ledger_file, ledger)
                if record["status"] != "completed":
                    continue
            _clip(output)
            media[str(output)] = {"files": [str(output)], "identities": {str(output): "heygen:" + identity}}
            heygen._save(media_file, media)
            candidate = sorted(result + [(at, str(output), duration)], key=lambda s: s[0])
            # Check cached placements, as well as the newly generated one, before returning.
            validate_plan(_timed_plan(candidate), job, engine=engine)
            result = candidate
        return result


def _timed_plan(segs):
    """Adapt sparse scenes to contiguous final-plan shape for the same validation."""
    out, end = [], 0.0
    for at, path, duration in segs:
        if at > end:
            out.append(("gap", "", False, at - end))
        out.append(("motion", path, False, duration))
        end = at + duration
    return out


def validate_plan(plan, job, scene_media=None, engine=None):
    """Recognize generated files even renamed, and validate actual assembled intervals."""
    ledger_file = job / "heygen" / "ledger.json"
    if not ledger_file.exists():
        return
    cfg = policy(job)
    ledger = json.loads(ledger_file.read_text())
    known = {}
    for identity, record in ledger.items():
        for key in ("sha256", "raw_sha256"):
            if record.get(key):
                known[record[key]] = identity
    sources_file = job / "heygen" / "media.json"
    sources = {scene: record["files"] for scene, record in json.loads(sources_file.read_text()).items()} if sources_file.exists() else {}
    if scene_media:
        sources.update(scene_media)
    paths = {str(Path(record["path"]).resolve()): identity for identity, record in ledger.items()}
    seen, at, count = set(), 0.0, 0
    for _, path, _, duration in plan:
        duration = float(duration)
        candidates = [path] + sources.get(str(path), [])
        matched = {}
        for candidate in candidates:
            if not candidate or not Path(candidate).is_file():
                continue
            identity = paths.get(str(Path(candidate).resolve())) or known.get(_digest(candidate))
            if identity:
                matched[identity] = candidate
        for identity, candidate in matched.items():
            count += 1
            if identity in seen:
                raise ValueError("HeyGen generated media repeat blocked, including renamed sources")
            if count > cfg["max_clips"] or not fits(at, duration, cfg):
                raise ValueError("HeyGen final timeline exceeds count, five-second or time-window limit")
            if abs(at - ledger[identity]["at_s"]) > 0.011:
                raise ValueError("HeyGen final slot shifted off its aligned narration cue")
            if engine is not None:
                record = ledger[identity]
                cues = engine._parse_srt_full(Path(record["srt"]).read_text())
                if not _aligned(engine, cues, record["words"], at):
                    raise ValueError("HeyGen final slot no longer matches the current narration clock")
            if duration > _clip(Path(candidate)) + 1e-9:
                raise ValueError("HeyGen final slot would loop or freeze its source")
            seen.add(identity)
        at += duration
