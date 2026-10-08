"""Standalone HeyGen Video client. One paid POST per persistent destination."""

import fcntl
import hashlib
import json
import os
import re
import time
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv


BASE = "https://api.heygen.com/v3/models/videos"
MODEL = "heygen-video-1"


class HeyGenError(RuntimeError):
    """A request needs operator attention; never automatically resubmit it."""


def validate(payload):
    """Accept only the small documented T2V/I2V contract used by this client."""
    if not isinstance(payload, dict):
        raise HeyGenError("Request must be an object")
    allowed = {"model", "mode", "prompt", "duration", "resolution",
               "aspect_ratio", "seed", "prompt_enhancement", "image"}
    if set(payload) - allowed:
        raise HeyGenError("Unsupported request fields")
    body = {"model": MODEL, "duration": 5, "resolution": "768p", **payload}
    if body["model"] != MODEL or body.get("mode") not in ("text_to_video", "image_to_video"):
        raise HeyGenError("Unsupported model or mode")
    prompt = body.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 32000:
        raise HeyGenError("Prompt must contain 1 to 32000 characters")
    if type(body["duration"]) is not int or not 5 <= body["duration"] <= 15:
        raise HeyGenError("Duration must be an integer from 5 to 15")
    if body["resolution"] not in ("480p", "768p"):
        raise HeyGenError("Resolution must be 480p or 768p")
    if "aspect_ratio" in body and body["aspect_ratio"] not in ("21:9", "16:9", "4:3", "1:1", "3:4", "9:16"):
        raise HeyGenError("Unsupported aspect ratio")
    if "seed" in body and (type(body["seed"]) is not int or not 0 <= body["seed"] <= 4294967295):
        raise HeyGenError("Seed must be an unsigned 32-bit integer")
    if body.get("prompt_enhancement", "turbo") not in ("turbo", "quality", "disabled"):
        raise HeyGenError("Unsupported prompt enhancement")
    if body["mode"] == "text_to_video":
        if "image" in body:
            raise HeyGenError("Text to video does not accept an image")
    else:
        image = body.get("image")
        if not isinstance(image, dict):
            raise HeyGenError("Image to video requires an image asset")
        kind = image.get("type")
        fields = {"url": {"type", "url"}, "asset_id": {"type", "asset_id"},
                  "base64": {"type", "media_type", "data"}}
        if kind not in fields or set(image) != fields[kind]:
            raise HeyGenError("Invalid image asset fields")
        if any(not isinstance(v, str) or not v.strip() for v in image.values()):
            raise HeyGenError("Image asset values must be nonempty strings")
        if kind == "url" and not image["url"].startswith("https://"):
            raise HeyGenError("Image URL must use HTTPS")
        if kind == "base64" and image["media_type"] not in ("image/jpeg", "image/png", "image/webp"):
            raise HeyGenError("Unsupported image media type")
    return body


def fingerprint(payload):
    return hashlib.sha256(json.dumps(validate(payload), sort_keys=True,
                                    separators=(",", ":")).encode()).hexdigest()


def _save(path, state):
    temp = path.with_name(path.name + ".tmp")
    with temp.open("w") as file:
        json.dump(state, file, indent=2)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())
    temp.replace(path)
    # Ensure the pre-submit record survives a crash before any network call.
    descriptor = os.open(str(path.parent), os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _data(response):
    try:
        body = response.json()
    except (ValueError, TypeError):
        raise HeyGenError("HeyGen returned invalid JSON") from None
    if not isinstance(body, dict) or not isinstance(body.get("data"), dict):
        raise HeyGenError("HeyGen returned no job record")
    return body["data"]


def generate(payload, destination, timeout_s=1200, poll_interval_s=3):
    """Submit once, resume the same job, and atomically download its raw MP4.

    The .heygen.json sidecar must be kept with the destination. A missing job ID
    after submission requires manual reconciliation, even on a later invocation.
    Network/error messages and signed download URLs are never persisted or logged.
    """
    body = validate(payload)
    digest = fingerprint(body)
    destination = Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    sidecar = destination.with_suffix(destination.suffix + ".heygen.json")
    with sidecar.with_suffix(sidecar.suffix + ".lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise HeyGenError("This destination is already running") from None
        if sidecar.exists():
            state = json.loads(sidecar.read_text())
            if state.get("fingerprint") != digest or state.get("destination") != str(destination):
                raise HeyGenError("Destination belongs to a different request")
            if state.get("status") in ("failed", "cancelled", "submit_failed", "submitting", "submit_unknown"):
                raise HeyGenError("Prior submission failed or is uncertain; resubmission blocked")
            if not state.get("video_id"):
                raise HeyGenError("Saved request has no job ID; resubmission blocked")
            if state.get("status") == "downloaded" and destination.exists():
                if hashlib.sha256(destination.read_bytes()).hexdigest() != state.get("sha256"):
                    raise HeyGenError("Downloaded file changed; inspect it before resuming")
                return destination
        else:
            if destination.exists():
                raise HeyGenError("Destination exists without its request sidecar")
            state = {"fingerprint": digest, "idempotency_key": str(uuid.uuid4()),
                     "destination": str(destination), "status": "submitting"}
        load_dotenv(Path(__file__).resolve().parent / ".env", override=False)
        key = (os.environ.get("HEYGEN_API_KEY") or "").strip()
        if not key:
            raise HeyGenError("HEYGEN_API_KEY is missing")
        headers = {"x-api-key": key}
        if not sidecar.exists():
            _save(sidecar, state)
            try:
                response = requests.post(BASE, json=body, headers={**headers,
                                         "Idempotency-Key": state["idempotency_key"]}, timeout=120,
                                         allow_redirects=False)
            except requests.exceptions.RequestException:
                state["status"] = "submit_unknown"
                _save(sidecar, state)
                raise HeyGenError("Submit outcome unknown; no second POST permitted") from None
            state["submit_http_status"] = response.status_code
            request_id = response.headers.get("x-request-id", "")
            if re.fullmatch(r"[A-Za-z0-9_.:-]{1,256}", request_id) and key not in request_id:
                state["request_id"] = request_id
            if not 200 <= response.status_code < 300:
                state["status"] = "submit_failed"
                _save(sidecar, state)
                raise HeyGenError(f"HeyGen submit HTTP {response.status_code}; resubmission blocked")
            try:
                data = _data(response)
                video_id = data.get("video_id")
                if not isinstance(video_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,256}", video_id) or key in video_id:
                    raise HeyGenError("Submit returned no usable job ID")
            except HeyGenError:
                state["status"] = "submit_unknown"
                _save(sidecar, state)
                raise HeyGenError("Submit returned no usable job ID; resubmission blocked") from None
            state.update(video_id=video_id, status="pending")
            _save(sidecar, state)
        deadline = time.monotonic() + timeout_s
        while True:
            try:
                response = requests.get(f"{BASE}/{state['video_id']}", headers=headers, timeout=60,
                                        allow_redirects=False)
            except requests.exceptions.RequestException:
                raise HeyGenError("Polling network error; resume this same destination") from None
            if not 200 <= response.status_code < 300:
                raise HeyGenError(f"HeyGen poll HTTP {response.status_code}; resume the same job")
            data = _data(response)
            status = data.get("status")
            if status not in ("pending", "processing", "completed", "failed", "cancelled"):
                raise HeyGenError("Unknown job status; resume the same job")
            state["status"] = status
            _save(sidecar, state)
            if status in ("failed", "cancelled"):
                raise HeyGenError(f"HeyGen job {status}; resubmission blocked")
            if status == "completed":
                url = data.get("video_url")
                if not isinstance(url, str) or not url.startswith("https://"):
                    raise HeyGenError("Completed job has no HTTPS video URL")
                break
            if time.monotonic() >= deadline:
                raise HeyGenError("Polling timed out; resume this same destination")
            time.sleep(min(poll_interval_s, max(0, deadline - time.monotonic())))
        partial = destination.with_suffix(destination.suffix + ".part")
        try:
            # No API key is sent to the CDN (including redirects).
            with requests.get(url, stream=True, timeout=180) as download:
                if not 200 <= download.status_code < 300:
                    raise HeyGenError(f"Video download HTTP {download.status_code}")
                with partial.open("wb") as file:
                    for chunk in download.iter_content(1024 * 1024):
                        file.write(chunk)
            if not partial.stat().st_size:
                raise HeyGenError("Video download was empty")
            partial.replace(destination)
        except requests.exceptions.RequestException:
            raise HeyGenError("Download network error; resume the same job") from None
        finally:
            partial.unlink(missing_ok=True)
        state.update(status="downloaded", sha256=hashlib.sha256(destination.read_bytes()).hexdigest())
        _save(sidecar, state)
        return destination
