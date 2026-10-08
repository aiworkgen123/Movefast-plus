#!/usr/bin/env python3
"""Small Atlas Cloud client for MoveFast's image/video workflows.

Atlas generation requests are asynchronous.  A generation POST is made once,
then the same prediction id is polled until it completes or reaches a terminal
state.  In particular, a polling timeout never submits a second paid job.
"""

import hashlib
import json
import os
import time
from pathlib import Path

import requests


BASE = (os.environ.get("ATLASCLOUD_BASE") or "https://api.atlascloud.ai").rstrip("/")
SEEDREAM_MODEL = "bytedance/seedream-v4"
SEEDREAM_EDIT_MODEL = "bytedance/seedream-v4/edit"
SEEDANCE_MODEL = "bytedance/seedance-v1-pro-fast/image-to-video"
INFINITETALK_MODEL = "atlascloud/infinitetalk"
_SESSION_UPLOADS = {}


class AtlasCloudError(RuntimeError):
    """An Atlas request did not produce usable media."""


class AtlasCloudTimeout(AtlasCloudError):
    """A submitted prediction did not finish before the local polling deadline."""


def has_key() -> bool:
    return bool((os.environ.get("ATLASCLOUD_API_KEY") or "").strip())


def _key() -> str:
    key = (os.environ.get("ATLASCLOUD_API_KEY") or "").strip()
    if not key:
        raise AtlasCloudError("ATLASCLOUD_API_KEY is missing from .env")
    return key


def _headers(json_body: bool = False) -> dict:
    out = {"Authorization": f"Bearer {_key()}"}
    if json_body:
        out["Content-Type"] = "application/json"
    return out


def _safe(value) -> str:
    """Keep provider errors useful without ever echoing the API key."""
    text = str(value or "")
    key = (os.environ.get("ATLASCLOUD_API_KEY") or "").strip()
    return text.replace(key, "[redacted]") if key else text


def _json(response, where: str) -> dict:
    try:
        data = response.json()
    except (TypeError, ValueError) as exc:
        raise AtlasCloudError(f"Atlas {where} returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise AtlasCloudError(f"Atlas {where} returned an invalid response")
    return data


def _data(body: dict) -> dict:
    value = body.get("data")
    return value if isinstance(value, dict) else body


def _http_error(response, where: str) -> AtlasCloudError:
    return AtlasCloudError(f"Atlas {where} HTTP {getattr(response, 'status_code', '?')}")


def _status(data: dict) -> str:
    return str(data.get("status") or "").strip().lower()


def _prediction_id(data: dict) -> str:
    return str(data.get("id") or data.get("prediction_id") or data.get("task_id") or "").strip()


def _output_url(data: dict) -> str:
    outputs = data.get("outputs")
    if isinstance(outputs, str):
        outputs = [outputs]
    if not isinstance(outputs, (list, tuple)):
        outputs = [data.get("output")]
    for item in outputs:
        if isinstance(item, str) and item.startswith(("http://", "https://")):
            return item
        if isinstance(item, dict):
            for key in ("url", "download_url", "image", "video", "audio"):
                value = item.get(key)
                if isinstance(value, str) and value.startswith(("http://", "https://")):
                    return value
    return ""


def _endpoint(model: str) -> str:
    return "generateVideo" if model in (SEEDANCE_MODEL, INFINITETALK_MODEL) else "generateImage"


def upload(path: Path, cache_file: Path = None) -> str:
    """Upload a local file once and return Atlas's temporary URL.

    Atlas accepts both the current top-level ``url`` response and the older
    ``data.download_url`` shape. Atlas upload URLs are temporary, so reuse is
    deliberately session-only and namespaced away from WaveSpeed's cache.
    """
    path = Path(path)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    cache_key = (str(Path(cache_file).resolve()) if cache_file else "", digest)
    cached = _SESSION_UPLOADS.get(cache_key)
    if isinstance(cached, str) and cached.startswith(("http://", "https://")):
        return cached
    try:
        with path.open("rb") as fh:
            response = requests.post(f"{BASE}/api/v1/model/uploadMedia", headers=_headers(),
                                     files={"file": (path.name, fh)}, timeout=180)
    except requests.exceptions.RequestException as exc:
        raise AtlasCloudError(f"Atlas upload network error: {_safe(exc)}") from exc
    if not 200 <= response.status_code < 300:
        raise _http_error(response, "upload")
    body = _json(response, "upload")
    nested = body.get("data") if isinstance(body.get("data"), dict) else {}
    url = body.get("url") or body.get("download_url") or nested.get("url") or nested.get("download_url")
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        raise AtlasCloudError("Atlas upload returned no temporary URL")
    _SESSION_UPLOADS[cache_key] = url
    return url


def result(model: str, payload: dict, label: str = "", timeout_s: int = 1200,
           poll_interval_s: float = 2.5, log=print) -> dict:
    """Submit one generation and poll that exact prediction until it finishes."""
    name = label or model
    try:
        body = {**(payload or {}), "model": model}
        response = requests.post(f"{BASE}/api/v1/model/{_endpoint(model)}",
                                 headers=_headers(json_body=True), json=body, timeout=120)
    except requests.exceptions.RequestException as exc:
        # The server may have accepted a request before the client lost the
        # response.  Never retry a paid POST without its prediction id.
        raise AtlasCloudError(f"{name}: submit outcome unknown; not resubmitting ({_safe(exc)})") from exc
    if not 200 <= response.status_code < 300:
        raise _http_error(response, f"{name} submit")
    submitted = _data(_json(response, f"{name} submit"))
    prediction_id = _prediction_id(submitted)
    if not prediction_id:
        if _status(submitted) in ("completed", "succeeded") and _output_url(submitted):
            return submitted
        raise AtlasCloudError(f"{name}: submit returned no prediction id")
    log(f"    atlas: {name} accepted (prediction={prediction_id})")
    deadline = time.monotonic() + max(0, float(timeout_s))
    while True:
        try:
            polled = requests.get(f"{BASE}/api/v1/model/prediction/{prediction_id}",
                                  headers=_headers(), timeout=60)
        except requests.exceptions.RequestException as exc:
            if time.monotonic() >= deadline:
                raise AtlasCloudTimeout(
                    f"{name}: prediction {prediction_id} polling timed out; no new submission was made"
                ) from exc
            if poll_interval_s:
                time.sleep(min(float(poll_interval_s), max(0, deadline - time.monotonic())))
            continue
        if not 200 <= polled.status_code < 300:
            raise _http_error(polled, f"{name} poll")
        current = _data(_json(polled, f"{name} poll"))
        state = _status(current)
        if state in ("completed", "succeeded"):
            if not _output_url(current):
                raise AtlasCloudError(f"{name}: prediction completed without an output")
            return current
        if state in ("failed", "error", "cancelled", "canceled", "timeout", "timed_out"):
            detail = _safe(current.get("error") or current.get("message") or state)
            raise AtlasCloudError(f"{name}: prediction {state} ({detail[:200]})")
        if not state:
            raise AtlasCloudError(f"{name}: prediction returned no status")
        if time.monotonic() >= deadline:
            raise AtlasCloudTimeout(
                f"{name}: prediction {prediction_id} polling timed out; no new submission was made"
            )
        if poll_interval_s:
            time.sleep(min(float(poll_interval_s), max(0, deadline - time.monotonic())))


def download(url: str, dest: Path) -> Path:
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        raise AtlasCloudError("Atlas returned an invalid output URL")
    try:
        response = requests.get(url, timeout=180)
    except requests.exceptions.RequestException as exc:
        raise AtlasCloudError(f"Atlas output download failed: {_safe(exc)}") from exc
    if not 200 <= response.status_code < 300:
        raise _http_error(response, "output download")
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(response.content)
    return dest


def run(model: str, payload: dict, dest: Path, label: str = "", timeout_s: int = 1200,
        poll_interval_s: float = 2.5, log=print) -> Path:
    """Run a supported Atlas model and save its first output to ``dest``."""
    data = result(model, payload, label=label, timeout_s=timeout_s,
                  poll_interval_s=poll_interval_s, log=log)
    url = _output_url(data)
    if not url:
        raise AtlasCloudError(f"{label or model}: completed without a usable output URL")
    return download(url, dest)
