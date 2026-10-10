"""Portable final-encode capture. This worker module has no provider imports."""
import ast
import contextlib
import contextvars
import hashlib
import importlib.util
import json
import math
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

_CAPTURE = contextvars.ContextVar("movefast_final_capture", default=None)
CODE_FILES = ("farm/__init__.py", "farm/config.py", "farm/s3.py", "farm/runpod.py",
              "farm/spec.py", "farm/state.py", "farm/runner.py", "farm/assets.py",
              "farm/prepared.py", "farm/provision.sh")


class PreparedFinalReady(BaseException):
    """Stop before encode, without being swallowed by best-effort scene handlers."""
    def __init__(self, root):
        self.root = root


def digest(path):
    with Path(path).open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


@contextlib.contextmanager
def capture(root):
    token = _CAPTURE.set(Path(root))
    try:
        yield
    finally:
        _CAPTURE.reset(token)


def _encoder_source(engine):
    source = Path(engine.__file__).read_text()
    names = {"_warm_read", "_picture_stalls", "_execute_final_encode"}
    definitions = [ast.get_source_segment(source, node) for node in ast.parse(source).body
                   if isinstance(node, ast.FunctionDef) and node.name in names]
    if len(definitions) != len(names):
        raise ValueError("Final encode helper extraction failed")
    return ("import re, subprocess, sys, time\nfrom pathlib import Path\n"
            "def log(message):\n    print(message, flush=True)\n\n" + "\n\n".join(definitions) + "\n")


def capture_final(job, command, duration, *, fonts_dir, fonts_option, engine, cuts=None):
    root = _CAPTURE.get()
    if root is None:
        return  # Local pipeline executes its original command/helper.
    root.mkdir(parents=True, exist_ok=True)
    copied, sources = {}, {}

    def snapshot(source, name):
        source = Path(source).resolve()
        if not source.is_file():
            raise ValueError("A final-encode input is missing")
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        hashed = digest(target)
        if digest(source) != hashed:
            raise ValueError("An input changed while preparing the final encode")
        copied[name] = hashed
        sources[str(source)] = hashed

    args = list(command)
    for index in range(1, len(args)):
        if args[index - 1] != "-i":
            continue
        source = Path(args[index])
        source = source if source.is_absolute() else job / source
        name = "_visual.mp4" if index == args.index("-i") + 1 else f"input_{index:02d}{source.suffix.lower()}"
        snapshot(source, name)
        args[index] = name
    if "-filter_complex" in args:
        index = args.index("-filter_complex") + 1
        graph = args[index]
        if "subtitles=subs_burn.ass" in graph:
            snapshot(job / "subs_burn.ass", "subs_burn.ass")
            font_files = set(Path(fonts_dir).rglob("*.ttf")) | set(Path(fonts_dir).rglob("*.otf"))
            # Include system-resolved faces too when available, so libass does not silently substitute.
            import re
            ass = (job / "subs_burn.ass").read_text()
            families = set(re.findall(r"^Style:\s*[^,]+,([^,]+),", ass, re.M)) | set(re.findall(r"\\fn([^\\}]+)", ass))
            for family in families:
                for style in ("Regular", "Bold", "Italic", "Bold Italic"):
                    try:
                        found = subprocess.check_output(["fc-match", "-f", "%{file}\n", f"{family}:style={style}"], text=True).strip()
                    except (OSError, subprocess.SubprocessError):
                        continue
                    if found and Path(found).is_file():
                        font_files.add(Path(found))
            if not font_files:
                raise ValueError("No subtitle fonts available for the portable encode")
            for number, font in enumerate(sorted(font_files)):
                snapshot(font, f"fonts/{number:03d}{font.suffix.lower()}")
            if fonts_option:
                graph = graph.replace(fonts_option, ":fontsdir=fonts")
            else:
                graph = graph.replace("subtitles=subs_burn.ass", "subtitles=subs_burn.ass:fontsdir=fonts")
        args[index] = graph
    # Only input references and the exact fonts option are rebased. Unknown path references fail closed.
    if any(str(job.resolve()) in arg or str(engine.HERE.resolve()) in arg or arg.startswith("/") for arg in args):
        raise ValueError("Final command has an unsupported absolute file reference")
    code = _encoder_source(engine)
    (root / "final_encode.py").write_text(code)
    copied["final_encode.py"] = digest(root / "final_encode.py")
    sources[str(Path(engine.__file__).resolve())] = digest(engine.__file__)
    manifest = {"version": 1, "mode": "prepared_final", "command": args,
                "duration": duration, "files": copied}
    if cuts is not None:  # Planned shot starts (seconds): the stall check tells a cut from a slow shot.
        manifest["cuts"] = [round(float(c), 3) for c in cuts]
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    # Local compatibility bookkeeping is deliberately excluded from the bundle.
    (root / "local-sources.json").write_text(json.dumps(sources, indent=2) + "\n")
    validate(root, sources=True)
    inputs = [args[i + 1] for i, arg in enumerate(args[:-1]) if arg == "-i"]
    for name in inputs:
        _decode(root / name)
    raise PreparedFinalReady(root)


def _relative(root, name):
    path = Path(name)
    if path.is_absolute() or ".." in path.parts or (root / path).resolve().is_relative_to(root.resolve()) is False:
        raise ValueError("Invalid portable bundle path")
    return root / path


def validate(root, sources=False):
    root = Path(root)
    manifest = json.loads((root / "manifest.json").read_text())
    if manifest.get("version") != 1 or manifest.get("mode") != "prepared_final":
        raise ValueError("Missing compatible prepared-final manifest")
    duration = manifest.get("duration")
    if type(duration) not in (int, float) or not math.isfinite(duration) or duration <= 0:
        raise ValueError("Invalid expected final duration")
    cuts = manifest.get("cuts", [])
    if not isinstance(cuts, list) or not all(type(c) in (int, float) and math.isfinite(c) and 0 <= c <= duration
                                             for c in cuts):
        raise ValueError("Invalid planned cuts")
    args = manifest.get("command")
    if not isinstance(args, list) or not all(isinstance(a, str) for a in args) or args[0] != "ffmpeg" or args[-1] != "_video_tmp.mp4":
        raise ValueError("Invalid final encode command")
    for name, expected in manifest["files"].items():
        path = _relative(root, name)
        if not path.is_file() or digest(path) != expected:
            raise ValueError("Prepared input is missing or corrupt")
    for i, arg in enumerate(args[:-1]):
        if arg == "-i" and args[i + 1] not in manifest["files"]:
            raise ValueError("Final command references an unmanifested input")
    if "_visual.mp4" not in manifest["files"] or "final_encode.py" not in manifest["files"]:
        raise ValueError("Required final encode input/helper is missing")
    if sources:
        for name, expected in json.loads((root / "local-sources.json").read_text()).items():
            if not Path(name).is_file() or digest(name) != expected:
                raise ValueError("Prepared sources changed; explicitly prepare again before renting")
    return manifest


def pack(root, target):
    manifest = validate(root, sources=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_STORED) as archive:
        for name in ["manifest.json", *manifest["files"]]:
            archive.write(Path(root) / name, name)
    return digest(target)


def unpack(blob, root, expected_hash):
    if digest(blob) != expected_hash:
        raise ValueError("Prepared download hash mismatch")
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(blob) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        if set(archive.namelist()) != {"manifest.json", *manifest["files"]}:
            raise ValueError("Prepared archive contains unexpected files")
        for name in archive.namelist():
            target = _relative(root, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(name) as source, target.open("wb") as destination:
                shutil.copyfileobj(source, destination)
    validate(root)


def _decode(path):
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"],
                       capture_output=True, check=True, timeout=3600, env=_encode_env())
    except (OSError, subprocess.SubprocessError):
        raise ValueError("Prepared media failed complete decode") from None


def execute(root):
    root = Path(root)
    manifest = validate(root)
    script = ("import importlib.util,json,sys;from pathlib import Path;"
              "p=Path(sys.argv[1]);s=importlib.util.spec_from_file_location('encoder',p/'final_encode.py');"
              "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);"
              "d=json.loads((p/'manifest.json').read_text());"
              "m._execute_final_encode(p,d['command'],d['duration'],*([d['cuts']] if 'cuts' in d else []))")
    subprocess.run([sys.executable, "-c", script, str(root.resolve())], check=True,
                   capture_output=True, env=_encode_env(), timeout=max(1800, int(manifest["duration"] * 10) + 1800))
    final = root / "video.mp4"
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                            "-of", "default=nw=1:nk=1", str(final)], text=True, env=_encode_env()))
    if abs(duration - manifest["duration"]) > 0.1:
        raise ValueError("Final output duration differs from its prepared narration")
    _decode(final)
    return final


def _encode_env():
    """Transport credentials stay in the uploader process, never the encode child."""
    return {k: os.environ[k] for k in ("PATH", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT") if k in os.environ}


def code_bundle(source, target):
    """Immutable worker allowlist: no make_video, prompts, styles or provider code."""
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in CODE_FILES:
            archive.write(Path(source) / name, name)
    return digest(target)
