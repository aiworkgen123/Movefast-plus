"""The picture checks' saved answers on their way to and from a pod (owner 2026-10-10: every verdict saved, and it
survives pods). Used by fullrun.py (the launcher, which holds the bucket keys); the pod only ever gets two presigned
URLs: one to read the seed, one to write its own answers.

R2 layout: mrtruth/verdicts/<UTC time>-<run>.jsonl.gz, one chunk per run, written by that run's pod (each push a
superset of the one before). A presigned upload lives SETTLE_H hours, so a chunk older than that can no longer change:
only such chunks are compacted (merged into one, newest answer wins) and deleted - a running pod's chunk is never
touched. A chunk that does not read (bad gzip or no valid line) is skipped and named in the log, never deleted.

VERDICT_SH: the pod's bash side - seed_verdicts (download the seed, import it) and push_verdicts (export what this pod
made, upload it; flock-serialised, called every ~10 minutes, after planning, after the finish, at the end, by the
watchdog and on exit)."""
import datetime
import gzip
import os
import sys
import tempfile
import time
import zlib
from pathlib import Path

PREFIX = "mrtruth/verdicts/"
SETTLE_H = 4.0
COMPACT_OVER = 12


def _rows_ok(data: bytes, row) -> int:
    """How many well-formed answers a chunk holds; -1 when it does not read."""
    try:
        text = gzip.decompress(data).decode("utf-8")
    except (OSError, EOFError, zlib.error, UnicodeDecodeError):
        return -1
    n = sum(1 for line in text.splitlines() if line.strip() and row(line) is not None)
    return n if n else -1


def _age_h(modified: str, now: float) -> float:
    try:
        t = datetime.datetime.fromisoformat(str(modified).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0                                   # unknown age: treated as fresh, never compacted
    return (now - t) / 3600


def prepare(b, run: str, mf: str, log=print, now: float = None) -> dict:
    """Before a pod starts: every chunk read and checked, the settled ones compacted when there are more than
    COMPACT_OVER, one seed (the good chunks joined: concatenated gzip members) and the key this run writes to."""
    sys.path.insert(0, str(mf))
    import verdicts
    now = time.time() if now is None else now
    objs = sorted((o for o in b.list(PREFIX) if o["key"].endswith(".jsonl.gz")), key=lambda o: o["key"])
    good, bad, data, rows = [], [], {}, 0
    for o in objs:
        raw = b.get_bytes(o["key"])
        n = _rows_ok(raw, verdicts._row)
        if n < 0:
            bad.append(o["key"])
            continue
        good.append(o)
        data[o["key"]] = raw
        rows += n
    compacted = 0
    settled = [o for o in good if _age_h(o.get("modified"), now) >= SETTLE_H]
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime(now))
    if len(good) > COMPACT_OVER and len(settled) >= 2:
        with tempfile.TemporaryDirectory() as d:
            paths = []
            for k, o in enumerate(settled):
                p = Path(d) / f"c{k:04d}.jsonl.gz"
                p.write_bytes(data[o["key"]])
                paths.append(p)
            out = Path(d) / "compact.jsonl.gz"
            got = verdicts.compact(out, paths)
            key = f"{PREFIX}{stamp}-compact-{run}.jsonl.gz"
            b.put_bytes(key, out.read_bytes())
            if b.exists(key):                        # written first, then exactly the chunks it holds are deleted
                for o in settled:
                    b.delete(o["key"])
                    data.pop(o["key"], None)
                data[key] = out.read_bytes()
                good = [o for o in good if o not in settled] + [{"key": key}]
                compacted = len(settled)
                log(f"verdicts: {len(settled)} settled chunks compacted into {key} ({got['written']} answers)")
    seed = b"".join(data[o["key"]] for o in good)
    rows = sum(max(0, _rows_ok(data[o["key"]], verdicts._row)) for o in good)
    if bad:
        log(f"verdicts: ⚠ {len(bad)} chunk(s) do not read and are skipped: {', '.join(bad[:5])}")
    log(f"verdicts: seed of {len(good)} chunk(s), {rows} answers, {len(seed) / 1024:.0f} KB")
    return {"seed": seed, "mine": f"{PREFIX}{stamp}-{run}.jsonl.gz", "chunks": len(good), "bad": bad,
            "compacted": compacted, "rows": rows}


VERDICT_SH = r'''
export MRTRUTH_VERDICTS_DB=/root/mf/output/_shared/picture_verdicts.sqlite MRTRUTH_RUN_ID="${RUN_ID:-pod}"
push_verdicts(){ [ -n "${VERDICT_PUT:-}" ] && [ -f "$MRTRUTH_VERDICTS_DB" ] && [ -x /root/mf/.venv/bin/python ] || return 0
  ( if command -v flock >/dev/null; then flock -w 300 9 || exit 0; fi
    T=$(mktemp /root/vd.XXXXXX)
    N=$(cd /root/mf && .venv/bin/python verdicts.py export "$MRTRUTH_VERDICTS_DB" "$T" 2>>/root/log.txt)
    if [ "${N:-0}" -gt 0 ] 2>/dev/null && curl -sf -m 300 -X PUT --data-binary @"$T" "$VERDICT_PUT" >/dev/null; then
      say "verdicts: $N answers made on this pod saved ($1)"; fi
    rm -f "$T" ) 9>/root/verdicts.lock; }
seed_verdicts(){ mkdir -p "$(dirname "$MRTRUTH_VERDICTS_DB")"
  if [ -n "${VERDICT_GET:-}" ] && curl -sf -m 300 "$VERDICT_GET" -o /root/seed.jsonl.gz; then
    say "verdicts: $(cd /root/mf && .venv/bin/python verdicts.py import "$MRTRUTH_VERDICTS_DB" /root/seed.jsonl.gz 2>>/root/log.txt)"
  else say "verdicts: no saved answers yet, starting empty"; fi; }
trap 'push_verdicts exit' EXIT
'''


def env_for(b, run: str, mf: str, keys: dict, log=print) -> dict:
    """The pod's verdict settings (and the seed's key, added to `keys` so it is deleted with the run's other keys)."""
    vs = prepare(b, run, mf, log)
    env = {"RUN_ID": run, "VERDICT_PUT": b.presign(vs["mine"], 14400, "PUT")}
    if vs["seed"]:
        keys["verdicts-seed.jsonl.gz"] = f"mrtruth/{run}/verdicts-seed.jsonl.gz"
        b.put_bytes(keys["verdicts-seed.jsonl.gz"], vs["seed"])
        env["VERDICT_GET"] = b.presign(keys["verdicts-seed.jsonl.gz"], 14400)
    env["_mine"] = vs["mine"]
    return env


if __name__ == "__main__":
    print(os.path.basename(__file__), "is used by web/jobs.py and fullrun.py")
