"""The website's records, in one SQLite file: the people who can sign in, and every film they asked for.

A film's row is the whole truth about it - its status, where it is running (the pod), its progress, its cost and where
its video is - so the website can be restarted at any moment and pick every running film up again (jobs.reattach)."""
import secrets
import sqlite3
import threading
import time
from pathlib import Path

from werkzeug.security import check_password_hash, generate_password_hash

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  name TEXT PRIMARY KEY, pw TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created REAL);
CREATE TABLE IF NOT EXISTS jobs(
  id TEXT PRIMARY KEY, user TEXT, title TEXT, status TEXT, stage TEXT, progress REAL DEFAULT 0,
  run_on TEXT, created REAL, started REAL, pod_started REAL, finished REAL, seconds REAL, minutes INTEGER,
  voice_name TEXT, music_name TEXT, music_db REAL, script_words INTEGER,
  pod_id TEXT, pod_hr REAL, pod_desc TEXT, run TEXT, commit_id TEXT,
  video_key TEXT, video_mb REAL, cost TEXT, error TEXT, log_tail TEXT, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
"""
ACTIVE = ("queued", "starting", "running", "cancelling")
ROLES = ("owner", "member")


class Store:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        db = self._db()
        try:
            db.executescript(SCHEMA)
        finally:
            db.close()

    def _db(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        return db

    def _run(self, sql: str, args=()):
        with self.lock:
            db = self._db()
            try:
                with db:                             # one transaction: committed, or rolled back on an error
                    return [dict(r) for r in db.execute(sql, args).fetchall()]
            finally:
                db.close()

    # ── people ────────────────────────────────────────────────────────────

    def add_user(self, name: str, password: str, role: str = "member") -> None:
        name = (name or "").strip().lower()
        if not name or len(name) > 40 or not all(c.isalnum() or c in "._-" for c in name):
            raise ValueError("a name is 1-40 letters, numbers, dots, dashes or underscores")
        if len(password or "") < 10:
            raise ValueError("a password has at least 10 characters")
        if role not in ROLES:
            raise ValueError("role is owner or member")
        if self.user(name):
            raise ValueError(f"{name} already exists")
        self._run("INSERT INTO users VALUES(?,?,?,?)", (name, generate_password_hash(password), role, time.time()))

    def user(self, name: str):
        got = self._run("SELECT name, role, created FROM users WHERE name=?", ((name or "").strip().lower(),))
        return got[0] if got else None

    def check(self, name: str, password: str):
        got = self._run("SELECT * FROM users WHERE name=?", ((name or "").strip().lower(),))
        if got and check_password_hash(got[0]["pw"], password or ""):
            return {"name": got[0]["name"], "role": got[0]["role"]}
        check_password_hash(generate_password_hash("x"), "y")     # the same time for an unknown name
        return None

    def users(self) -> list:
        return self._run("SELECT name, role, created FROM users ORDER BY created")

    def set_password(self, name: str, password: str) -> None:
        if len(password or "") < 10:
            raise ValueError("a password has at least 10 characters")
        if not self.user(name):
            raise ValueError("no such person")
        self._run("UPDATE users SET pw=? WHERE name=?", (generate_password_hash(password), name.strip().lower()))

    def delete_user(self, name: str) -> None:
        u = self.user(name)
        if not u:
            raise ValueError("no such person")
        if u["role"] == "owner" and sum(1 for x in self.users() if x["role"] == "owner") <= 1:
            raise ValueError("the last owner cannot be removed")
        self._run("DELETE FROM users WHERE name=?", (u["name"],))

    # ── films ─────────────────────────────────────────────────────────────

    def new_job(self, **fields) -> str:
        jid = time.strftime("%y%m%d-", time.gmtime()) + secrets.token_hex(3)
        fields = dict(fields, id=jid, status="queued", stage="Waiting to start", progress=0, created=time.time())
        cols = ",".join(fields)
        self._run(f"INSERT INTO jobs({cols}) VALUES({','.join('?' * len(fields))})", tuple(fields.values()))
        return jid

    def job(self, jid: str):
        got = self._run("SELECT * FROM jobs WHERE id=?", (jid,))
        return got[0] if got else None

    def jobs(self, limit: int = 200) -> list:
        return self._run("SELECT * FROM jobs WHERE deleted=0 ORDER BY created DESC LIMIT ?", (limit,))

    def active(self) -> list:
        return self._run(f"SELECT * FROM jobs WHERE status IN ({','.join('?' * len(ACTIVE))}) ORDER BY created",
                         ACTIVE)

    def update(self, jid: str, **fields) -> None:
        if fields:
            self._run(f"UPDATE jobs SET {','.join(k + '=?' for k in fields)} WHERE id=?", (*fields.values(), jid))

    # ── settings (not the keys: those live in keys.env) ───────────────────

    def get(self, k: str, default=None):
        got = self._run("SELECT v FROM settings WHERE k=?", (k,))
        return got[0]["v"] if got else default

    def put(self, k: str, v) -> None:
        self._run("INSERT INTO settings VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, str(v)))
