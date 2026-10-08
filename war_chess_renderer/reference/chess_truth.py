"""Offline chess truth gate for the WC06 component.

The editorial adapter chooses only a closed tactical motif.  This module owns
the executable boundary, the bounded UCI exchange, and the hash-bound receipt
that is carried into the component manifest and renderer.
"""

from __future__ import annotations

import copy
import os
import re
import select
import shutil
import subprocess
import time
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from production_core.canonical import canonical_hash


WC06_ENGINE_RECEIPT_SCHEMA = "war-chess-wc06-engine-receipt.v1"
WC06_ENGINE_PLAN_BUNDLE_SCHEMA = "war-chess-wc06-engine-plan-bundle.v1"
WC06_ENGINE_DEFAULT_DEPTH = 12
WC06_ENGINE_DEFAULT_MOVETIME_MS = 400
WC06_ENGINE_DEFAULT_TIMEOUT_SECONDS = 4.0
WC06_ENGINE_MAX_PV_LENGTH = 32
_UCI_MOVE = re.compile(r"^[a-h][1-8][a-h][1-8][qrbn]?$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_FILES = "abcdefgh"
_SQUARE = re.compile(r"^[a-h][1-8]$")
_CAPTIONS = ("Move", "Best reply", "Follow-up")

# This is deliberately a small, closed library.  Editorial/model output may
# select one of these ids, but may not provide a position, line, evaluation,
# or authority claim of its own.
WC06_MOTIF_LIBRARY: tuple[dict[str, str], ...] = (
    {
        "motif_id": "knight_fork",
        "label": "Knight fork",
        "fen": "2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1",
        "expected_first_move": "d5e7",
    },
    {
        "motif_id": "back_rank_mate",
        "label": "Back-rank mate",
        "fen": "6k1/5ppp/8/8/8/6P1/5P1P/4R1K1 w - - 0 1",
        "expected_first_move": "e1e8",
    },
    {
        "motif_id": "queen_capture",
        "label": "Queen capture",
        "fen": "4k3/8/8/8/8/8/4r3/3Q2K1 w - - 0 1",
        "expected_first_move": "d1e2",
    },
)
WC06_MOTIF_IDS = tuple(row["motif_id"] for row in WC06_MOTIF_LIBRARY)


class StockfishError(RuntimeError):
    """A local Stockfish exchange could not produce a trusted line."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def motif_for_id(motif_id: str) -> dict[str, str] | None:
    """Return a defensive copy of one admitted motif."""

    for motif in WC06_MOTIF_LIBRARY:
        if motif["motif_id"] == motif_id:
            return copy.deepcopy(motif)
    return None


def resolve_stockfish_executable(
    configured: str | Path | None = None,
) -> Path | None:
    """Resolve a configured executable, or discover one when none is configured."""

    configured_value = configured
    if configured_value is None:
        configured_value = os.getenv("VPP_STOCKFISH_EXECUTABLE") or None
    if configured_value is not None:
        try:
            resolved = Path(configured_value).expanduser().resolve()
        except OSError:
            return None
        try:
            return (
                resolved
                if resolved.is_file() and resolved.stat().st_mode & 0o111
                else None
            )
        except OSError:
            return None

    candidates: list[Path] = []
    command = shutil.which("stockfish")
    if command:
        candidates.append(Path(command))
    candidates.extend(
        Path(path)
        for path in (
            "/opt/homebrew/bin/stockfish",
            "/opt/homebrew/opt/stockfish/bin/stockfish",
            "/usr/local/bin/stockfish",
        )
    )
    seen: set[str] = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        if resolved.is_file() and resolved.stat().st_mode & 0o111:
            return resolved
    return None


def _valid_uci_move(value: Any) -> bool:
    return isinstance(value, str) and _UCI_MOVE.fullmatch(value) is not None


class _ChessBoard:
    """Small standard-library legality checker for the closed motif FENs."""

    def __init__(self, fen: str):
        fields = fen.split()
        if len(fields) < 4 or fields[1] not in {"w", "b"}:
            raise ValueError("invalid FEN")
        board: dict[str, str] = {}
        for rank_index, rank in enumerate(fields[0].split("/")):
            if rank_index >= 8:
                raise ValueError("invalid FEN")
            file_index = 0
            for token in rank:
                if token.isdigit() and token in "12345678":
                    file_index += int(token)
                elif token in "PNBRQKpnbrqk" and file_index < 8:
                    board[f"{_FILES[file_index]}{8 - rank_index}"] = token
                    file_index += 1
                else:
                    raise ValueError("invalid FEN")
            if file_index != 8:
                raise ValueError("invalid FEN")
        if len(board) == 0 or sum(piece == "K" for piece in board.values()) != 1:
            raise ValueError("invalid FEN")
        if sum(piece == "k" for piece in board.values()) != 1:
            raise ValueError("invalid FEN")
        self.board = board
        self.turn = fields[1]
        self.en_passant = fields[3] if fields[3] == "-" or _SQUARE.fullmatch(fields[3]) else "-"
        if fields[3] != "-" and self.en_passant == "-":
            raise ValueError("invalid FEN")

    @classmethod
    def _from_state(
        cls, board: Mapping[str, str], turn: str, en_passant: str
    ) -> _ChessBoard:
        result = object.__new__(cls)
        result.board = dict(board)
        result.turn = turn
        result.en_passant = en_passant
        return result

    def _clone(self) -> _ChessBoard:
        return self._from_state(self.board, self.turn, self.en_passant)

    @staticmethod
    def _coordinates(square: str) -> tuple[int, int]:
        return _FILES.index(square[0]), int(square[1])

    @staticmethod
    def _color(piece: str) -> str:
        return "w" if piece.isupper() else "b"

    def _path_clear(self, from_square: str, to_square: str) -> bool:
        from_file, from_rank = self._coordinates(from_square)
        to_file, to_rank = self._coordinates(to_square)
        file_step = (to_file > from_file) - (to_file < from_file)
        rank_step = (to_rank > from_rank) - (to_rank < from_rank)
        file_index = from_file + file_step
        rank_index = from_rank + rank_step
        while (file_index, rank_index) != (to_file, to_rank):
            if f"{_FILES[file_index]}{rank_index}" in self.board:
                return False
            file_index += file_step
            rank_index += rank_step
        return True

    def _is_attacked(self, target: str, by_color: str) -> bool:
        target_file, target_rank = self._coordinates(target)
        for from_square, piece in self.board.items():
            if self._color(piece) != by_color:
                continue
            from_file, from_rank = self._coordinates(from_square)
            file_delta = target_file - from_file
            rank_delta = target_rank - from_rank
            piece_type = piece.lower()
            if piece_type == "p":
                direction = 1 if by_color == "w" else -1
                if abs(file_delta) == 1 and rank_delta == direction:
                    return True
            elif piece_type == "n":
                if (abs(file_delta), abs(rank_delta)) in {(1, 2), (2, 1)}:
                    return True
            elif piece_type == "k":
                if max(abs(file_delta), abs(rank_delta)) == 1:
                    return True
            elif piece_type == "b" and abs(file_delta) == abs(rank_delta):
                if self._path_clear(from_square, target):
                    return True
            elif piece_type == "r" and (file_delta == 0 or rank_delta == 0):
                if self._path_clear(from_square, target):
                    return True
            elif piece_type == "q" and (
                file_delta == 0
                or rank_delta == 0
                or abs(file_delta) == abs(rank_delta)
            ):
                if self._path_clear(from_square, target):
                    return True
        return False

    def _in_check(self, color: str) -> bool:
        king = "K" if color == "w" else "k"
        king_square = next(
            (square for square, piece in self.board.items() if piece == king), None
        )
        if king_square is None:
            return True
        return self._is_attacked(king_square, "b" if color == "w" else "w")

    def _pseudo_legal(
        self,
        from_square: str,
        to_square: str,
        piece: str,
        target: str | None,
        promotion: str | None,
    ) -> bool:
        from_file, from_rank = self._coordinates(from_square)
        to_file, to_rank = self._coordinates(to_square)
        file_delta = to_file - from_file
        rank_delta = to_rank - from_rank
        piece_type = piece.lower()
        if piece_type == "p":
            direction = 1 if self.turn == "w" else -1
            start_rank = 2 if self.turn == "w" else 7
            if file_delta == 0 and rank_delta == direction and target is None:
                return True
            if (
                file_delta == 0
                and rank_delta == 2 * direction
                and from_rank == start_rank
                and target is None
                and f"{_FILES[from_file]}{from_rank + direction}" not in self.board
            ):
                return True
            if abs(file_delta) == 1 and rank_delta == direction:
                if target is not None and self._color(target) != self.turn:
                    return True
                if (
                    target is None
                    and to_square == self.en_passant
                    and f"{_FILES[to_file]}{to_rank - direction}"
                    in self.board
                    and self.board[f"{_FILES[to_file]}{to_rank - direction}"].lower()
                    == "p"
                ):
                    return True
            return False
        if piece_type == "n":
            return (abs(file_delta), abs(rank_delta)) in {(1, 2), (2, 1)}
        if piece_type == "b":
            return abs(file_delta) == abs(rank_delta) and self._path_clear(
                from_square, to_square
            )
        if piece_type == "r":
            return (file_delta == 0 or rank_delta == 0) and self._path_clear(
                from_square, to_square
            )
        if piece_type == "q":
            return (
                file_delta == 0
                or rank_delta == 0
                or abs(file_delta) == abs(rank_delta)
            ) and self._path_clear(from_square, to_square)
        if piece_type == "k":
            return max(abs(file_delta), abs(rank_delta)) == 1
        return False

    def _apply_unchecked(
        self,
        from_square: str,
        to_square: str,
        piece: str,
        promotion: str | None,
    ) -> None:
        from_file, from_rank = self._coordinates(from_square)
        to_file, to_rank = self._coordinates(to_square)
        self.board.pop(from_square)
        if (
            piece.lower() == "p"
            and to_square == self.en_passant
            and to_square not in self.board
            and from_file != to_file
        ):
            self.board.pop(f"{_FILES[to_file]}{to_rank - (1 if self.turn == 'w' else -1)}")
        moved_piece = piece
        if promotion is not None:
            moved_piece = promotion.upper() if self.turn == "w" else promotion
        self.board[to_square] = moved_piece
        self.en_passant = "-"
        if piece.lower() == "p" and abs(to_rank - from_rank) == 2:
            self.en_passant = f"{_FILES[from_file]}{(from_rank + to_rank) // 2}"
        self.turn = "b" if self.turn == "w" else "w"

    def push(self, uci: str) -> bool:
        if not _valid_uci_move(uci):
            return False
        from_square, to_square = uci[:2], uci[2:4]
        promotion = uci[4] if len(uci) == 5 else None
        piece = self.board.get(from_square)
        target = self.board.get(to_square)
        if (
            piece is None
            or self._color(piece) != self.turn
            or (target is not None and self._color(target) == self.turn)
            or target in {"K", "k"}
        ):
            return False
        from_rank = int(from_square[1])
        to_rank = int(to_square[1])
        if piece.lower() == "p":
            reaches_back_rank = to_rank in {1, 8}
            if reaches_back_rank != (promotion is not None):
                return False
        elif promotion is not None:
            return False
        if promotion is not None and promotion not in {"q", "r", "b", "n"}:
            return False
        if not self._pseudo_legal(
            from_square, to_square, piece, target, promotion
        ):
            return False
        candidate = self._clone()
        candidate._apply_unchecked(from_square, to_square, piece, promotion)
        if candidate._in_check(self.turn):
            return False
        self._apply_unchecked(from_square, to_square, piece, promotion)
        return True


def _validate_legal_pv(fen: str, principal_variation: Sequence[str]) -> None:
    try:
        board = _ChessBoard(fen)
        for move in principal_variation:
            if not board.push(move):
                raise ValueError("illegal UCI move")
    except (KeyError, ValueError, IndexError) as exc:
        raise StockfishError("stockfish_invalid_output") from exc


def _remaining(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise StockfishError("stockfish_timeout")
    return remaining


class _UciReader:
    def __init__(self, stream: Any):
        self._fd = stream.fileno()
        self._buffer = bytearray()

    def readline(self, deadline: float) -> str:
        while b"\n" not in self._buffer:
            try:
                ready, _, _ = select.select([self._fd], [], [], _remaining(deadline))
            except (OSError, ValueError) as exc:
                raise StockfishError("stockfish_process_error") from exc
            if not ready:
                raise StockfishError("stockfish_timeout")
            try:
                chunk = os.read(self._fd, 4096)
            except OSError as exc:
                raise StockfishError("stockfish_process_error") from exc
            if not chunk:
                raise StockfishError("stockfish_process_error")
            self._buffer.extend(chunk)
        line, _, remainder = self._buffer.partition(b"\n")
        self._buffer = bytearray(remainder)
        return line.decode("utf-8", errors="replace").strip()


def _read_line(reader: _UciReader, deadline: float) -> str:
    return reader.readline(deadline)


def _send(process: subprocess.Popen[bytes], command: str) -> None:
    if process.stdin is None:
        raise StockfishError("stockfish_process_error")
    try:
        process.stdin.write((command + "\n").encode("ascii"))
        process.stdin.flush()
    except (OSError, ValueError, BrokenPipeError) as exc:
        raise StockfishError("stockfish_process_error") from exc


def _parse_info(
    line: str,
    *,
    best_depth: int,
    current_pv: list[str],
    current_score: dict[str, Any] | None,
) -> tuple[int, list[str], dict[str, Any] | None]:
    parts = line.split()
    if not parts or parts[0] != "info":
        return best_depth, current_pv, current_score
    depth = best_depth
    if "depth" in parts:
        index = parts.index("depth") + 1
        if index >= len(parts):
            raise StockfishError("stockfish_invalid_output")
        try:
            depth = int(parts[index])
        except ValueError as exc:
            raise StockfishError("stockfish_invalid_output") from exc
    score: dict[str, Any] | None = None
    if "score" in parts:
        index = parts.index("score") + 1
        if index + 1 >= len(parts) or parts[index] not in {"cp", "mate"}:
            raise StockfishError("stockfish_invalid_output")
        try:
            score = {"kind": parts[index], "value": int(parts[index + 1])}
        except ValueError as exc:
            raise StockfishError("stockfish_invalid_output") from exc
    pv: list[str] = []
    if "pv" in parts:
        index = parts.index("pv") + 1
        if index >= len(parts):
            raise StockfishError("stockfish_invalid_output")
        for token in parts[index:]:
            if not _valid_uci_move(token):
                raise StockfishError("stockfish_invalid_output")
            pv.append(token)
    if depth >= best_depth:
        return depth, pv or current_pv, score if score is not None else current_score
    return best_depth, current_pv, current_score


def _analyze_stockfish(
    executable: Path,
    fen: str,
    *,
    depth: int,
    movetime_ms: int,
    timeout_seconds: float,
) -> tuple[str, list[str], dict[str, Any] | None, str]:
    if depth < 1 or movetime_ms < 1 or timeout_seconds <= 0:
        raise ValueError("stockfish settings must be positive")
    try:
        process = subprocess.Popen(
            [str(executable)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
        )
    except (OSError, ValueError) as exc:
        raise StockfishError("stockfish_process_error") from exc
    try:
        if process.stdout is None:
            raise StockfishError("stockfish_process_error")
        reader = _UciReader(process.stdout)
        deadline = time.monotonic() + timeout_seconds
        _send(process, "uci")
        engine_name: str | None = None
        while True:
            line = _read_line(reader, deadline)
            if line.startswith("id name "):
                engine_name = line.removeprefix("id name ").strip()
            if line == "uciok":
                break
        if not engine_name or not engine_name.casefold().startswith("stockfish"):
            raise StockfishError("stockfish_engine_identity_invalid")
        version = engine_name[len("Stockfish") :].strip() or "unknown"
        if len(version) > 80:
            raise StockfishError("stockfish_invalid_output")

        for command in (
            "setoption name Threads value 1",
            "setoption name Hash value 16",
            "setoption name MultiPV value 1",
            "isready",
        ):
            _send(process, command)
        while True:
            if _read_line(reader, deadline) == "readyok":
                break
        _send(process, f"position fen {fen}")
        _send(process, f"go depth {depth} movetime {movetime_ms}")
        bestmove: str | None = None
        best_depth = -1
        pv: list[str] = []
        score: dict[str, Any] | None = None
        while bestmove is None:
            line = _read_line(reader, deadline)
            if line.startswith("info "):
                best_depth, pv, score = _parse_info(
                    line,
                    best_depth=best_depth,
                    current_pv=pv,
                    current_score=score,
                )
            elif line == "bestmove" or line.startswith("bestmove "):
                tokens = line.split()
                if len(tokens) < 2:
                    raise StockfishError("stockfish_invalid_output")
                bestmove = tokens[1]
        if not _valid_uci_move(bestmove) or bestmove in {"0000", "(none)"}:
            raise StockfishError("stockfish_invalid_output")
        if not pv or pv[0] != bestmove:
            raise StockfishError("stockfish_invalid_output")
        _validate_legal_pv(fen, pv[:WC06_ENGINE_MAX_PV_LENGTH])
        return bestmove, pv[:WC06_ENGINE_MAX_PV_LENGTH], score, version
    finally:
        try:
            if process.stdin is not None:
                process.stdin.close()
        except (OSError, ValueError):
            pass
        try:
            process.terminate()
            process.wait(timeout=0.25)
        except (OSError, subprocess.TimeoutExpired):
            try:
                process.kill()
            except OSError:
                pass


def _receipt_without_hash(
    *,
    motif: Mapping[str, str],
    frozen_brief_hash: str,
    component_brief_hash: str,
    status: str,
    settings: Mapping[str, int],
    engine_version: str,
    moves: Sequence[Mapping[str, Any]],
    principal_variation: Sequence[str],
    score: Mapping[str, Any] | None,
    failure_code: str | None = None,
) -> dict[str, Any]:
    receipt: dict[str, Any] = {
        "schema_version": WC06_ENGINE_RECEIPT_SCHEMA,
        "status": status,
        "motif_id": motif["motif_id"],
        "fen": motif["fen"],
        "moves": copy.deepcopy(list(moves)),
        "principal_variation": list(principal_variation),
        "engine": {
            "name": "Stockfish",
            "version": engine_version,
            "settings": dict(settings),
        },
        "score": None if score is None else copy.deepcopy(dict(score)),
        "frozen_brief_hash": frozen_brief_hash,
        "component_brief_hash": component_brief_hash,
    }
    if failure_code is not None:
        receipt["failure_code"] = failure_code
    receipt["receipt_hash"] = canonical_hash(receipt)
    return receipt


def resolve_wc06_engine_plan(
    motif_id: str,
    frozen_brief_hash: str,
    component_brief_hash: str,
    *,
    executable: str | Path | None = None,
    depth: int = WC06_ENGINE_DEFAULT_DEPTH,
    movetime_ms: int = WC06_ENGINE_DEFAULT_MOVETIME_MS,
    timeout_seconds: float = WC06_ENGINE_DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Resolve one admitted motif into a verified receipt or ordinary fallback."""

    motif = motif_for_id(motif_id)
    if motif is None:
        raise ValueError("wc06_motif_not_admitted")
    if (
        not isinstance(frozen_brief_hash, str)
        or _HEX64.fullmatch(frozen_brief_hash) is None
        or not isinstance(component_brief_hash, str)
        or _HEX64.fullmatch(component_brief_hash) is None
    ):
        raise ValueError("wc06_plan_hash_binding_invalid")
    settings = {
        "depth": depth,
        "movetime_ms": movetime_ms,
        "threads": 1,
        "hash_mb": 16,
        "multipv": 1,
    }
    resolved = resolve_stockfish_executable(executable)
    try:
        if resolved is None:
            raise StockfishError("stockfish_executable_unavailable")
        _, principal_variation, score, version = _analyze_stockfish(
            resolved,
            motif["fen"],
            depth=depth,
            movetime_ms=movetime_ms,
            timeout_seconds=timeout_seconds,
        )
        if not principal_variation or principal_variation[0] != motif["expected_first_move"]:
            raise StockfishError("stockfish_first_move_mismatch")
        move_count = min(3, len(principal_variation))
        if move_count < 1:
            raise StockfishError("stockfish_invalid_output")
        moves = [
            {
                "ply": index,
                "uci": move,
                "caption": _CAPTIONS[index - 1],
            }
            for index, move in enumerate(principal_variation[:move_count], start=1)
        ]
        receipt = _receipt_without_hash(
            motif=motif,
            frozen_brief_hash=frozen_brief_hash,
            component_brief_hash=component_brief_hash,
            status="verified",
            settings=settings,
            engine_version=version,
            moves=moves,
            principal_variation=principal_variation,
            score=score,
        )
    except StockfishError as exc:
        receipt = _receipt_without_hash(
            motif=motif,
            frozen_brief_hash=frozen_brief_hash,
            component_brief_hash=component_brief_hash,
            status="fallback",
            settings=settings,
            engine_version="unavailable",
            moves=(),
            principal_variation=(),
            score=None,
            failure_code=exc.code,
        )
    return validate_wc06_engine_receipt(
        receipt,
        frozen_brief_hash=frozen_brief_hash,
        component_brief_hash=component_brief_hash,
    )


def _require_hex(value: Any, code: str) -> str:
    if not isinstance(value, str) or _HEX64.fullmatch(value) is None:
        raise ValueError(code)
    return value


def _require_mapping(value: Any, code: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(code)
    return value


def validate_wc06_engine_receipt(
    value: Mapping[str, Any],
    *,
    frozen_brief_hash: str | None = None,
    component_brief_hash: str | None = None,
) -> dict[str, Any]:
    """Validate a receipt's immutable shape, binding, and bounded line."""

    receipt = dict(_require_mapping(value, "wc06_engine_receipt_required"))
    status = receipt.get("status")
    expected_fields = {
        "schema_version",
        "status",
        "motif_id",
        "fen",
        "moves",
        "principal_variation",
        "engine",
        "score",
        "frozen_brief_hash",
        "component_brief_hash",
        "receipt_hash",
    }
    if status == "fallback":
        expected_fields.add("failure_code")
    if set(receipt) != expected_fields:
        raise ValueError("wc06_engine_receipt_fields_invalid")
    if receipt.get("schema_version") != WC06_ENGINE_RECEIPT_SCHEMA:
        raise ValueError("wc06_engine_receipt_schema_invalid")
    motif_id = receipt.get("motif_id")
    motif = motif_for_id(motif_id) if isinstance(motif_id, str) else None
    if motif is None or receipt.get("fen") != motif["fen"]:
        raise ValueError("wc06_engine_receipt_motif_invalid")
    bound_frozen = _require_hex(
        receipt.get("frozen_brief_hash"), "wc06_engine_receipt_frozen_hash_invalid"
    )
    bound_component = _require_hex(
        receipt.get("component_brief_hash"),
        "wc06_engine_receipt_component_hash_invalid",
    )
    if frozen_brief_hash is not None and bound_frozen != frozen_brief_hash:
        raise ValueError("wc06_engine_receipt_frozen_binding_mismatch")
    if component_brief_hash is not None and bound_component != component_brief_hash:
        raise ValueError("wc06_engine_receipt_component_binding_mismatch")
    engine = _require_mapping(receipt.get("engine"), "wc06_engine_receipt_engine_invalid")
    if set(engine) != {"name", "version", "settings"} or engine.get("name") != "Stockfish":
        raise ValueError("wc06_engine_receipt_engine_invalid")
    if (
        not isinstance(engine.get("version"), str)
        or not engine["version"].strip()
        or len(engine["version"]) > 80
    ):
        raise ValueError("wc06_engine_receipt_engine_version_invalid")
    settings = _require_mapping(
        engine.get("settings"), "wc06_engine_receipt_settings_invalid"
    )
    if set(settings) != {"depth", "movetime_ms", "threads", "hash_mb", "multipv"}:
        raise ValueError("wc06_engine_receipt_settings_invalid")
    for key in settings:
        setting = settings[key]
        if isinstance(setting, bool) or not isinstance(setting, int) or setting < 1:
            raise ValueError("wc06_engine_receipt_settings_invalid")
    if settings["multipv"] != 1 or settings["threads"] != 1:
        raise ValueError("wc06_engine_receipt_settings_invalid")

    moves = receipt.get("moves")
    principal_variation = receipt.get("principal_variation")
    if not isinstance(moves, list) or not isinstance(principal_variation, list):
        raise ValueError("wc06_engine_receipt_line_invalid")
    if len(principal_variation) > WC06_ENGINE_MAX_PV_LENGTH or any(
        not _valid_uci_move(move) for move in principal_variation
    ):
        raise ValueError("wc06_engine_receipt_line_invalid")
    seen_plys: list[int] = []
    move_uci: list[str] = []
    for move in moves:
        row = _require_mapping(move, "wc06_engine_receipt_move_invalid")
        if set(row) != {"ply", "uci", "caption"}:
            raise ValueError("wc06_engine_receipt_move_invalid")
        ply = row.get("ply")
        if isinstance(ply, bool) or not isinstance(ply, int) or not 1 <= ply <= 3:
            raise ValueError("wc06_engine_receipt_move_invalid")
        if not _valid_uci_move(row.get("uci")) or row.get("caption") not in _CAPTIONS:
            raise ValueError("wc06_engine_receipt_move_invalid")
        seen_plys.append(ply)
        move_uci.append(str(row["uci"]))
    if seen_plys != list(range(1, len(seen_plys) + 1)):
        raise ValueError("wc06_engine_receipt_move_order_invalid")
    if principal_variation[: len(move_uci)] != move_uci:
        raise ValueError("wc06_engine_receipt_line_binding_invalid")
    for index, row in enumerate(moves):
        if row["caption"] != _CAPTIONS[index]:
            raise ValueError("wc06_engine_receipt_caption_invalid")

    score = receipt.get("score")
    if score is not None:
        score_row = _require_mapping(score, "wc06_engine_receipt_score_invalid")
        if set(score_row) != {"kind", "value"} or score_row.get("kind") not in {
            "cp",
            "mate",
        }:
            raise ValueError("wc06_engine_receipt_score_invalid")
        if isinstance(score_row.get("value"), bool) or not isinstance(
            score_row.get("value"), int
        ):
            raise ValueError("wc06_engine_receipt_score_invalid")
    if status == "verified":
        if not 1 <= len(moves) <= 3 or "failure_code" in receipt:
            raise ValueError("wc06_engine_receipt_verified_line_invalid")
    elif status == "fallback":
        failure_code = receipt.get("failure_code")
        if (
            not isinstance(failure_code, str)
            or not failure_code.strip()
            or moves
            or principal_variation
            or score is not None
        ):
            raise ValueError("wc06_engine_receipt_fallback_invalid")
    else:
        raise ValueError("wc06_engine_receipt_status_invalid")
    expected_hash = canonical_hash(
        {key: copy.deepcopy(item) for key, item in receipt.items() if key != "receipt_hash"}
    )
    if receipt.get("receipt_hash") != expected_hash:
        raise ValueError("wc06_engine_receipt_hash_mismatch")
    return copy.deepcopy(receipt)


def build_wc06_engine_plan_bundle(
    *,
    frozen_brief_hash: str,
    plans: Mapping[str, Mapping[str, Any]],
    component_brief_hashes: Mapping[str, str],
) -> dict[str, Any]:
    """Build one immutable bundle for all WC06 components in a frozen brief."""

    _require_hex(frozen_brief_hash, "wc06_plan_bundle_frozen_hash_invalid")
    if set(plans) != set(component_brief_hashes):
        raise ValueError("wc06_plan_bundle_components_mismatch")
    components = [
        {
            "component_id": component_id,
            "component_brief_hash": _require_hex(
                component_brief_hashes[component_id],
                "wc06_plan_bundle_component_hash_invalid",
            ),
        }
        for component_id in sorted(component_brief_hashes)
    ]
    receipts = [
        validate_wc06_engine_receipt(
            plans[component_id],
            frozen_brief_hash=frozen_brief_hash,
            component_brief_hash=component_brief_hashes[component_id],
        )
        for component_id in sorted(plans)
    ]
    bundle: dict[str, Any] = {
        "schema_version": WC06_ENGINE_PLAN_BUNDLE_SCHEMA,
        "frozen_brief_hash": frozen_brief_hash,
        "components": components,
        "plans": receipts,
    }
    bundle["plan_hash"] = canonical_hash(bundle)
    return bundle


def validate_wc06_engine_plan_bundle(
    value: Mapping[str, Any],
    *,
    frozen_brief_hash: str,
    component_brief_hashes: Mapping[str, str],
) -> dict[str, dict[str, Any]]:
    """Validate and index a persisted plan bundle by component id."""

    bundle = dict(_require_mapping(value, "wc06_plan_bundle_required"))
    if set(bundle) != {
        "schema_version",
        "frozen_brief_hash",
        "components",
        "plans",
        "plan_hash",
    }:
        raise ValueError("wc06_plan_bundle_fields_invalid")
    if bundle.get("schema_version") != WC06_ENGINE_PLAN_BUNDLE_SCHEMA:
        raise ValueError("wc06_plan_bundle_schema_invalid")
    if bundle.get("frozen_brief_hash") != frozen_brief_hash:
        raise ValueError("wc06_plan_bundle_frozen_binding_mismatch")
    expected_hash = canonical_hash(
        {key: copy.deepcopy(item) for key, item in bundle.items() if key != "plan_hash"}
    )
    if bundle.get("plan_hash") != expected_hash:
        raise ValueError("wc06_plan_bundle_hash_mismatch")
    component_rows = bundle.get("components")
    plans = bundle.get("plans")
    if not isinstance(component_rows, list) or not isinstance(plans, list):
        raise ValueError("wc06_plan_bundle_shape_invalid")
    if len(component_rows) != len(plans) or len(component_rows) != len(
        component_brief_hashes
    ):
        raise ValueError("wc06_plan_bundle_count_invalid")
    component_hashes: dict[str, str] = {}
    for row in component_rows:
        component = _require_mapping(row, "wc06_plan_bundle_component_invalid")
        if set(component) != {"component_id", "component_brief_hash"}:
            raise ValueError("wc06_plan_bundle_component_invalid")
        component_id = component.get("component_id")
        if not isinstance(component_id, str) or not component_id or component_id in component_hashes:
            raise ValueError("wc06_plan_bundle_component_invalid")
        component_hashes[component_id] = _require_hex(
            component.get("component_brief_hash"),
            "wc06_plan_bundle_component_hash_invalid",
        )
    if component_hashes != dict(component_brief_hashes):
        raise ValueError("wc06_plan_bundle_components_mismatch")
    result: dict[str, dict[str, Any]] = {}
    for receipt in plans:
        receipt_value = _require_mapping(receipt, "wc06_plan_bundle_receipt_invalid")
        component_hash = receipt_value.get("component_brief_hash")
        component_id = next(
            (
                candidate
                for candidate, expected in component_hashes.items()
                if expected == component_hash
            ),
            None,
        )
        if component_id is None or component_id in result:
            raise ValueError("wc06_plan_bundle_receipt_scope_invalid")
        result[component_id] = validate_wc06_engine_receipt(
            receipt_value,
            frozen_brief_hash=frozen_brief_hash,
            component_brief_hash=component_hash,
        )
    if set(result) != set(component_brief_hashes):
        raise ValueError("wc06_plan_bundle_incomplete")
    return result
