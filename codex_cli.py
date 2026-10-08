"""Small, subscription-authenticated Codex CLI adapter for MoveFast.

The adapter deliberately runs Codex in a neutral temporary directory with the
least permissions MoveFast needs. It consumes only the final agent message
from a completed JSONL turn; progress, tool events and reasoning never reach
the existing text-generation callers.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Mapping, Optional, Sequence


DEFAULT_MODEL = "gpt-6-sol"
DEFAULT_REASONING_EFFORT = "low"
DEFAULT_TIMEOUT = 3600
MAX_IMAGES = 10
SYSTEM_PROMPT = (
    "You are a professional writer. Return ONLY what the user's message asks for. "
    "No preamble, no commentary, no markdown fences, no questions, no offers of "
    "further help. Produce the full requested output in one reply."
)

# These are intentionally explicit. A Codex request from MoveFast must not be
# able to execute local commands, load apps/plugins, delegate, browse outside
# the requested web-search mode, generate images, or read memory.
DISABLED_FEATURES = (
    "shell_tool",
    "unified_exec",
    "apps",
    "plugins",
    "hooks",
    "multi_agent",
    "computer_use",
    "browser_use",
    "image_generation",
    "memories",
)


class CodexError(RuntimeError):
    """A clear, user-facing failure from the local Codex CLI route."""


def resolve_executable(env: Optional[Mapping[str, str]] = None) -> Optional[str]:
    """Return the configured, PATH, or app-bundled Codex executable."""
    values = os.environ if env is None else env
    configured = (values.get("CODEX_BIN") or "").strip()
    if configured:
        found = shutil.which(configured) or configured
        if os.path.isfile(found) and os.access(found, os.X_OK):
            return str(Path(found).resolve())
        return None

    found = shutil.which("codex")
    if found:
        return str(Path(found).resolve())

    # The macOS app bundles the CLI. Keep the PATH route above so this remains
    # portable to a normal `codex` install and to CODEX_BIN overrides.
    candidates = (
        "/Applications/Codex.app/Contents/Resources/codex",
        str(Path.home() / ".local" / "bin" / "codex"),
        str(Path.home() / ".npm-global" / "bin" / "codex"),
    )
    for candidate in candidates:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return str(Path(candidate).resolve())
    return None


def resolve_model(requested: Optional[str] = None,
                  env: Optional[Mapping[str, str]] = None) -> str:
    """Map MoveFast's legacy Claude model names to a Codex model."""
    values = os.environ if env is None else env
    configured = (values.get("CODEX_MODEL") or "").strip()
    if configured and not configured.lower().startswith("claude-"):
        return configured
    requested = (requested or "").strip()
    if requested and not requested.lower().startswith("claude-"):
        return requested
    return DEFAULT_MODEL


def build_command(executable: str, model: str, *, images: Sequence[str] = (),
                  web_search: bool = False,
                  env: Optional[Mapping[str, str]] = None) -> list[str]:
    """Build one locked-down `codex exec` command."""
    values = os.environ if env is None else env
    reasoning = (values.get("CODEX_REASONING_EFFORT") or DEFAULT_REASONING_EFFORT).strip()
    if not reasoning:
        reasoning = DEFAULT_REASONING_EFFORT

    search_mode = "live" if web_search else "disabled"
    cmd = [
        executable,
        "exec",
        "--ignore-user-config",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--json",
        "--model",
        model,
        "-c",
        'forced_login_method="chatgpt"',
        "-c",
        f'model_reasoning_effort="{reasoning}"',
        "-c",
        "project_doc_max_bytes=0",
        "-c",
        f'web_search="{search_mode}"',
    ]
    for feature in DISABLED_FEATURES:
        cmd.extend(["-c", f"features.{feature}=false"])
    for image in images:
        cmd.extend(["--image", image])
    cmd.append("-")
    return cmd


def _child_env(env: Optional[Mapping[str, str]] = None) -> dict[str, str]:
    """Copy the environment without API-key auth that could bypass ChatGPT."""
    child = dict(os.environ if env is None else env)
    child.pop("OPENAI_API_KEY", None)
    child.pop("CODEX_API_KEY", None)
    return child


def _agent_text(item: Mapping[str, object]) -> str:
    text = item.get("text")
    if isinstance(text, str):
        return text.strip()
    content = item.get("content")
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, Mapping) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        return "".join(parts).strip()
    return ""


def _compact(value: str, limit: int = 280) -> str:
    return " ".join((value or "").split())[:limit]


def _classify_failure(detail: str, returncode: Optional[int] = None) -> str:
    detail = _compact(detail) or (f"exit {returncode}" if returncode is not None else "unknown error")
    lowered = detail.lower()
    if any(token in lowered for token in ("authentication", "oauth", "not logged in", "login required")):
        return f"Codex authentication error: {detail}"
    if any(token in lowered for token in ("usage limit", "rate limit", "quota", "too many requests")):
        return f"Codex usage limit error: {detail}"
    return f"Codex CLI error: {detail}"


def parse_jsonl(stdout: str, *, require_web_search: bool = False) -> tuple[str, bool]:
    """Return the final agent message and search evidence from a JSONL stream."""
    final_text = ""
    completed = False
    failed = ""
    searched = False
    parsed_any = False

    for raw_line in (stdout or "").splitlines():
        try:
            event = json.loads(raw_line)
        except (TypeError, ValueError):
            continue
        if not isinstance(event, Mapping):
            continue
        parsed_any = True
        event_type = event.get("type")
        if event_type == "turn.completed":
            status = str(event.get("status") or "").lower()
            if status in ("failed", "error"):
                failed = str(event.get("error") or status)
            else:
                completed = True
        elif event_type in ("turn.failed", "error"):
            error = event.get("error")
            if isinstance(error, Mapping):
                error = error.get("message") or error.get("detail")
            failed = str(error or event.get("message") or event_type)
        elif event_type == "item.completed":
            item = event.get("item")
            if not isinstance(item, Mapping):
                continue
            if item.get("type") == "agent_message":
                text = _agent_text(item)
                if text:
                    final_text = text
            elif item.get("type") == "web_search":
                action = item.get("action")
                if isinstance(action, Mapping) and action.get("type") == "search":
                    searched = True

    if failed:
        raise CodexError(_classify_failure(failed))
    if not completed:
        suffix = "" if parsed_any else "no JSONL events"
        raise CodexError(f"Codex returned no completed successful turn ({suffix or 'turn did not complete'}).")
    if require_web_search and not searched:
        raise CodexError("Codex research completed without JSONL web_search evidence.")
    if not final_text:
        raise CodexError("Codex completed a turn without a final agent message.")
    return final_text, searched


def run(prompt: str, *, model: Optional[str] = None,
        images: Sequence[str] = (), web_search: bool = False,
        timeout: Optional[int] = None,
        env: Optional[Mapping[str, str]] = None,
        runner=None) -> str:
    """Run one text, research, or image-input request through Codex."""
    values = os.environ if env is None else env
    executable = resolve_executable(values)
    if not executable:
        raise CodexError("Codex CLI not found; set CODEX_BIN or install the Codex app/CLI.")

    image_paths = [str(Path(image).expanduser().resolve()) for image in list(images)[:MAX_IMAGES]]
    for image in image_paths:
        if not Path(image).is_file():
            raise CodexError(f"Codex vision image not found: {image}")

    selected_model = resolve_model(model, values)
    cmd = build_command(executable, selected_model, images=image_paths,
                        web_search=web_search, env=values)
    limit = int(timeout if timeout is not None else (values.get("CODEX_TIMEOUT") or DEFAULT_TIMEOUT))
    process_runner = runner or subprocess.run
    child = _child_env(values)

    try:
        with tempfile.TemporaryDirectory(prefix="movefast-codex-") as neutral_cwd:
            writer_prompt = SYSTEM_PROMPT
            if web_search:
                writer_prompt += " Use live web search before answering this research request."
            full_prompt = f"{writer_prompt}\n\nUSER REQUEST:\n{prompt}"
            result = process_runner(
                cmd,
                input=full_prompt,
                text=True,
                capture_output=True,
                timeout=limit,
                cwd=neutral_cwd,
                env=child,
                encoding="utf-8",
                errors="replace",
            )
    except subprocess.TimeoutExpired:
        raise CodexError(f"Codex timed out after {limit}s.") from None
    except OSError as exc:
        raise CodexError(f"Codex could not start: {exc}") from None

    if result.returncode != 0:
        detail = "\n".join(part for part in (result.stderr, result.stdout) if part).strip()
        raise CodexError(_classify_failure(detail, result.returncode))
    try:
        text, _searched = parse_jsonl(result.stdout or "", require_web_search=web_search)
    except CodexError:
        raise
    except Exception as exc:  # defensive boundary for malformed CLI output
        raise CodexError(f"Codex JSONL parsing failed: {exc}") from None
    return text
