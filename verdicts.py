"""verdicts.py — every answer the picture checks got, kept (owner 2026-10-10: every verdict saved, and it survives pods).

One SQLite file (WAL, one connection per process behind a lock) holds the yes/no answers Gemini gave about pictures:
  pid    the picture: the sha1 of the file's bytes (mrtruth._photo_id)
  qset   who was asked what: the question set's version and wording, the model, its thinking level, the image size
  lkey   the line the answer is about: the normalised inputs that change an answer ("" for a fact of the picture alone)
  media  the resolution the picture was seen at (1 LOW, 2 MEDIUM, 3 HIGH): an answer is taken only by a check at its own
         level or below - a check at HIGH never takes an answer seen at MEDIUM
  dirty  the facts of the picture alone it was found with ("text", "frame"): such a picture is not sent again for any
         line or film, when it was seen at MEDIUM or above
Only complete answers from Gemini are stored: a failed, partial or Claude answer is asked again next time. Two threads
never ask the same question at once (claim / release / wait: the second waits for the first's answer).
Between machines (the pods): `export` writes the answers made here to a .jsonl.gz chunk, `import` reads chunks back -
the newest answer to a question wins, answers older than MAX_AGE_DAYS are dropped, a broken line or chunk is skipped.
The store never stops a run: a database error is a miss (the question is asked again) and a file that will not open is
moved aside (<name>.bad-<time>) and a new one started.

    python verdicts.py import DB CHUNK...     python verdicts.py export DB OUT.jsonl.gz
    python verdicts.py stats DB               python verdicts.py compact OUT.jsonl.gz CHUNK...
"""
import gzip
import json
import os
import socket
import sqlite3
import sys
import threading
import time
import zlib
from pathlib import Path

MEDIA = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "ULTRA_HIGH": 4}
MAX_AGE_DAYS = 180                  # Google can change a model behind its name: older answers are not taken again
DIRTY_MIN = MEDIA["MEDIUM"]         # a fact of the picture alone is reused only when it was seen at least this sharp
WAIT_S = 1900.0                     # a waiter gives up after this: longer than pick_vision's worst case asked twice
COLS = ("pid", "qset", "lkey", "media", "ans", "dirty", "model", "run", "ts")
SCHEMA = """
CREATE TABLE IF NOT EXISTS v (pid TEXT NOT NULL, qset TEXT NOT NULL, lkey TEXT NOT NULL, media INTEGER NOT NULL,
  ans TEXT NOT NULL, dirty TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', run TEXT NOT NULL DEFAULT '',
  ts INTEGER NOT NULL, mine INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (pid, qset, lkey, media)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS v_pic ON v(pid, qset, media);
CREATE INDEX IF NOT EXISTS v_mine ON v(mine);
"""
_UPSERT = ("INSERT INTO v (pid, qset, lkey, media, ans, dirty, model, run, ts, mine) VALUES (?,?,?,?,?,?,?,?,?,?) "
           "ON CONFLICT(pid, qset, lkey, media) DO UPDATE SET ans=excluded.ans, dirty=excluded.dirty, "
           "model=excluded.model, run=excluded.run, ts=excluded.ts, mine=excluded.mine WHERE excluded.ts {op} v.ts")


def media_rank(m) -> int:
    if isinstance(m, int):
        return m
    return MEDIA.get(str(m or "").upper().removeprefix("MEDIA_RESOLUTION_"), 0)


def run_id() -> str:
    return os.environ.get("MRTRUTH_RUN_ID") or f"{socket.gethostname()}-{time.strftime('%Y%m%dT%H%M%S')}-{os.getpid()}"


class Store:
    def __init__(self, path, say=print, run: str = ""):
        self.path, self.say, self.run = str(path), say, run or run_id()
        self.lock = threading.RLock()
        self.flight = {}                  # question -> Event: being asked right now by some thread
        self.looks = {}                   # (pid, qset) -> (Event, the question that holds it): a picture's first look
        self.n = {"hit": 0, "hit_earlier": 0, "dirty": 0, "asked": 0, "stored": 0, "waited": 0, "errors": 0}
        self._said = False
        self.moved = ""
        self.db = self._open()

    # ── the file ──
    def _connect(self):
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.path, timeout=30, check_same_thread=False, isolation_level=None)
        try:
            try:
                db.execute("PRAGMA journal_mode=WAL")
            except sqlite3.Error:                                    # a file system without WAL: the plain journal
                db.execute("PRAGMA journal_mode=DELETE")
            db.execute("PRAGMA synchronous=NORMAL")
            db.executescript(SCHEMA)
            db.execute("SELECT count(*) FROM v").fetchone()
        except (sqlite3.Error, OSError):
            db.close()
            raise
        return db

    def _open(self):
        try:
            return self._connect()
        except (sqlite3.Error, OSError) as e:
            if self.path == ":memory:":
                return None
            self.moved = f"{self.path}.bad-{time.strftime('%Y%m%dT%H%M%S')}"
            for ext in ("", "-wal", "-shm"):
                try:
                    os.replace(self.path + ext, self.moved + ext)
                except OSError:
                    pass
            self.say(f"  ⚠ verdict store {self.path} would not open ({str(e)[:80]}) - moved aside as {self.moved}, "
                     f"starting an empty one")
            try:
                return self._connect()
            except (sqlite3.Error, OSError) as e2:                   # no store this run: every question is asked
                self.say(f"  ⚠ verdict store: none this run ({str(e2)[:80]})")
                return None

    def close(self) -> None:
        with self.lock:
            if self.db is not None:
                self.db.close()
                self.db = None

    def _do(self, fn, default=None):
        """A database step; any error counts as a miss and never reaches the run."""
        if self.db is None:
            return default
        try:
            with self.lock:
                return fn(self.db)
        except sqlite3.Error as e:
            with self.lock:
                self.n["errors"] += 1
                said, self._said = self._said, True
            if not said:
                self.say(f"  ⚠ verdict store: {str(e)[:100]} - the question is asked instead (the run goes on)")
            return default

    # ── reading ──
    def get(self, pid: str, qset: str, lkey: str, media) -> dict:
        """The newest answer to this question seen at this resolution or higher, or None."""
        row = self._do(lambda db: db.execute(
            "SELECT ans, run FROM v WHERE pid=? AND qset=? AND lkey=? AND media>=? ORDER BY media DESC, ts DESC LIMIT 1",
            (pid, qset, lkey, media_rank(media))).fetchone())
        if not row:
            return None
        try:
            ans = json.loads(row[0])
        except ValueError:
            return None
        with self.lock:
            self.n["hit"] += 1
            self.n["hit_earlier"] += row[1] != self.run
        return ans

    def dirty(self, pid: str, qset: str, media) -> str:
        """What the picture alone was found with ("text", "frame", "text,frame") on any line, seen at this resolution or
        higher and never below MEDIUM (a LOW look misses small marks and finds ones that are not there); "" when
        nothing."""
        row = self._do(lambda db: db.execute(
            "SELECT dirty FROM v WHERE pid=? AND qset=? AND media>=? AND dirty!='' ORDER BY ts DESC LIMIT 1",
            (pid, qset, max(media_rank(media), DIRTY_MIN))).fetchone())
        return row[0] if row else ""

    def looked(self, pid: str, qset: str, media) -> bool:
        """The picture has an answer on some line at this resolution or higher."""
        return bool(self._do(lambda db: db.execute("SELECT 1 FROM v WHERE pid=? AND qset=? AND media>=? LIMIT 1",
                                                   (pid, qset, media_rank(media))).fetchone()))

    # ── one question at a time ──
    def _sort(self, keys: list, register: bool) -> dict:
        """keys: (pid, qset, lkey, media). have: answered; dirty: the picture is known dirty; mine: this thread asks
        (register) or may ask (peek); busy: another thread is asking it now, or is taking the picture's first look."""
        out = {"have": {}, "dirty": {}, "mine": [], "busy": []}
        with self.lock:
            for k in dict.fromkeys(keys):
                pid, qset, lkey, media = k
                ans = self.get(pid, qset, lkey, media)
                if ans is not None:
                    out["have"][k] = ans
                    continue
                d = self.dirty(pid, qset, media) if lkey else ""
                if d:
                    out["dirty"][k] = d
                    self.n["dirty"] += 1
                    continue
                if k in self.flight:
                    out["busy"].append(k)
                    continue
                lk = (pid, qset)
                if not register:
                    if lk in self.looks and not self.looked(pid, qset, media):
                        out["busy"].append(k)        # its first look may find text or a frame: worth waiting for
                    else:
                        out["mine"].append(k)
                    continue
                self.flight[k] = threading.Event()
                if lk not in self.looks:
                    self.looks[lk] = (threading.Event(), k)
                self.n["asked"] += 1
                out["mine"].append(k)
        return out

    def peek(self, keys: list) -> dict:
        return self._sort(keys, register=False)

    def claim(self, keys: list) -> dict:
        """Claim what nobody has answered or is asking: the caller asks out['mine'] and must release() them."""
        return self._sort(keys, register=True)

    def release(self, keys: list) -> None:
        """Wake whoever waits on these questions - answered or not (one not answered is asked again or left open)."""
        with self.lock:
            for k in keys:
                ev = self.flight.pop(k, None)
                if ev:
                    ev.set()
                lk = (k[0], k[1])
                got = self.looks.get(lk)
                if got and got[1] == k:
                    self.looks.pop(lk, None)
                    got[0].set()

    def wait(self, keys: list, timeout: float = WAIT_S) -> None:
        with self.lock:
            evs = []
            for k in keys:
                ev = self.flight.get(k) or (self.looks.get((k[0], k[1])) or (None,))[0]
                if ev is not None:
                    evs.append(ev)
            self.n["waited"] += len(keys)
        end = time.time() + timeout
        for ev in evs:
            ev.wait(max(0.0, end - time.time()))

    # ── writing ──
    def put(self, rows: list) -> int:
        """rows: (pid, qset, lkey, media, answer dict, dirty, model) - complete Gemini answers only (the caller checks)."""
        now = int(time.time())
        recs = [(r[0], r[1], r[2], media_rank(r[3]), json.dumps(r[4], separators=(",", ":"), sort_keys=True),
                 str(r[5] or ""), str(r[6] or ""), self.run, now, 1) for r in rows]
        if not recs:
            return 0

        def go(db):
            db.execute("BEGIN")
            try:
                db.executemany(_UPSERT.format(op=">="), recs)
                db.execute("COMMIT")
            except sqlite3.Error:
                db.execute("ROLLBACK")
                raise
            return len(recs)
        n = self._do(go, 0)
        with self.lock:
            self.n["stored"] += n
        return n

    # ── between machines ──
    def export(self, dest, mine_only: bool = True) -> int:
        """The answers made on this machine (mine_only) or all of them, as a .jsonl.gz chunk; written whole or not at
        all. Returns the number of answers written."""
        rows = self._do(lambda db: db.execute(f"SELECT {', '.join(COLS)} FROM v" + (" WHERE mine=1" if mine_only else "")
                                              + " ORDER BY ts").fetchall(), [])
        dest = Path(dest)
        tmp = dest.with_name(dest.name + ".part")
        with gzip.open(tmp, "wt", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps({"t": "v", "r": list(r)}, separators=(",", ":"), ensure_ascii=False) + "\n")
        os.replace(tmp, dest)
        return len(rows)

    def import_chunks(self, paths, max_age_days: float = MAX_AGE_DAYS) -> dict:
        """Read chunks: the newest answer to each question wins (equal: the one here stays); answers older than
        max_age_days are dropped; a line that does not parse is skipped, and a chunk that breaks off keeps what came
        before the break."""
        out = {"rows": 0, "taken": 0, "old": 0, "bad_lines": 0, "bad_chunks": 0}
        oldest = time.time() - max_age_days * 86400
        for p in paths:
            recs = []
            try:
                with gzip.open(p, "rt", encoding="utf-8") as fh:
                    for line in fh:
                        r = _row(line)
                        if r is None:
                            out["bad_lines"] += 1 if line.strip() else 0
                        elif r[8] < oldest:
                            out["old"] += 1
                        else:
                            recs.append(r + (0,))
            except (OSError, EOFError, zlib.error, UnicodeDecodeError):
                out["bad_chunks"] += 1

            def go(db):
                before = db.total_changes
                db.execute("BEGIN")
                try:
                    db.executemany(_UPSERT.format(op=">"), recs)
                    db.execute("COMMIT")
                except sqlite3.Error:
                    db.execute("ROLLBACK")
                    raise
                return db.total_changes - before
            out["rows"] += len(recs)
            out["taken"] += self._do(go, 0) if recs else 0
        return out

    def stats(self) -> dict:
        def go(db):
            a, p, m = db.execute("SELECT count(*), count(DISTINCT pid), coalesce(sum(mine), 0) FROM v").fetchone()
            d = db.execute("SELECT count(DISTINCT pid) FROM v WHERE dirty!=''").fetchone()[0]
            return {"answers": a, "pictures": p, "made_here": m, "from_elsewhere": a - m, "dirty_pictures": d}
        return dict(self._do(go, {}) or {}, path=self.path, **{f"n_{k}": v for k, v in self.n.items()})


def _row(line: str):
    """One chunk line as a row tuple, or None when it is not a well-formed answer."""
    try:
        x = json.loads(line)
        r = x["r"] if x.get("t") == "v" else None
        if not isinstance(r, list) or len(r) != len(COLS):
            return None
        pid, qset, lkey, media, ans, dirty, model, run, ts = r
        if not all(isinstance(v, str) for v in (pid, qset, lkey, ans, dirty, model, run)) or not pid or not qset:
            return None
        if not isinstance(media, int) or not isinstance(ts, int) or not isinstance(json.loads(ans), dict):
            return None
        return pid, qset, lkey, media, ans, dirty, model, run, ts
    except (ValueError, TypeError, KeyError, AttributeError):
        return None


_STORES, _STORES_LOCK = {}, threading.Lock()


def open_store(path, say=print, run: str = "") -> Store:
    """One store per file per process (the UI can plan two films at once: they share it)."""
    key = str(Path(path).expanduser().resolve()) if str(path) != ":memory:" else f":memory:{id(say)}"
    with _STORES_LOCK:
        st = _STORES.get(key)
        if st is None:
            st = _STORES[key] = Store(path if str(path) == ":memory:" else key, say=say, run=run)
        return st


def compact(dest, paths, max_age_days: float = MAX_AGE_DAYS) -> dict:
    """Several chunks as one (the newest answer to each question, old answers dropped)."""
    st = Store(":memory:", say=lambda s: None, run="compact")
    got = st.import_chunks(paths, max_age_days)
    got["written"] = st.export(dest, mine_only=False)
    st.close()
    return got


def main(argv) -> int:
    if len(argv) >= 3 and argv[0] == "import":
        st = Store(argv[1])
        got = st.import_chunks(argv[2:])
        s = st.stats()
        st.close()
        print(f"imported {got['taken']} of {got['rows']} answers from {len(argv) - 2} chunk(s)"
              + (f", {got['old']} too old" if got["old"] else "") + (f", {got['bad_lines']} bad lines" if got["bad_lines"] else "")
              + (f", {got['bad_chunks']} broken chunk(s)" if got["bad_chunks"] else "")
              + f"; the store holds {s.get('answers', 0)} answers about {s.get('pictures', 0)} pictures")
        return 0
    if len(argv) == 3 and argv[0] == "export":
        if not Path(argv[1]).exists():
            print(0)
            return 0
        st = Store(argv[1])
        print(st.export(argv[2]))
        st.close()
        return 0
    if len(argv) == 2 and argv[0] == "stats":
        st = Store(argv[1])
        print(json.dumps(st.stats(), indent=1))
        st.close()
        return 0
    if len(argv) >= 3 and argv[0] == "compact":
        print(json.dumps(compact(argv[1], argv[2:])))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
