"""Canonical UTF-8 JSON and SHA-256 helpers used at artifact boundaries."""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Mapping, Sequence
from typing import Any


class CanonicalValueError(ValueError):
    """Raised when a value cannot cross the canonical JSON boundary."""


def _validate_json_value(value: Any, path: str = "$") -> None:
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise CanonicalValueError(f"non_finite_number:{path}")
        return
    if isinstance(value, Mapping):
        for key, item in value.items():
            if not isinstance(key, str):
                raise CanonicalValueError(f"non_string_key:{path}")
            _validate_json_value(item, f"{path}.{key}")
        return
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        for index, item in enumerate(value):
            _validate_json_value(item, f"{path}[{index}]")
        return
    raise CanonicalValueError(f"unsupported_value:{path}:{type(value).__name__}")


def canonical_json_bytes(value: Any) -> bytes:
    """Return deterministic, newline-free, UTF-8 JSON bytes.

    The function accepts only ordinary JSON values, rejects NaN/infinity and
    non-string object keys, preserves Unicode, and does not mutate its input.
    """

    _validate_json_value(value)
    try:
        return json.dumps(
            value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive belt
        raise CanonicalValueError("json_encoding_failed") from exc


def content_hash(value: bytes | bytearray | memoryview) -> str:
    """Hash already-serialized bytes without interpreting them."""

    if not isinstance(value, (bytes, bytearray, memoryview)):
        raise TypeError("content_hash_requires_bytes")
    return hashlib.sha256(bytes(value)).hexdigest()


def canonical_hash(value: Any) -> str:
    """SHA-256 of :func:`canonical_json_bytes`."""

    return content_hash(canonical_json_bytes(value))
