"""Turn alignment output into the two deployable artifacts: `audio.db` and per-chapter files.

- `data/audio/<edition>/<bb>-<ccc>.m4a`: mono AAC at ~48 kbps. Universal playback (every
  browser, iOS included) at roughly 20 MB per hour. A chapter that came from a longer file is
  cut out with a little lead and tail; a chapter that was already its own file is simply
  re-encoded so every file on disk has the same shape.
- `data/audio.db`: editions, chapters, verse timings, and (Hebrew) word timings, all in
  milliseconds relative to the *chapter file*, all keyed by canonical `verse_id` / `word_id`.

Chapters below the score floor are left out rather than shipped wrong: a player that starts a
verse two seconds late teaches the reader not to trust the highlight, and a missing chapter just
shows "no audio here". The floor is per-edition in `sources.json` (`min_score`), default 0.4.

Usage: python build.py --work work/ --out ../../data [--edition CODE ...] [--jobs 8]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEAD_SECONDS = 0.6
TAIL_SECONDS = 0.8
DEFAULT_MIN_SCORE = 0.4

SCHEMA = """
CREATE TABLE audio_editions (
  edition_id        INTEGER PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  translation_code  TEXT,               -- NULL for an original-language reading
  language          TEXT NOT NULL,      -- 'eng' | 'hbo'
  name              TEXT NOT NULL,
  reader            TEXT NOT NULL,
  license           TEXT NOT NULL,
  attribution       TEXT NOT NULL,
  source_url        TEXT NOT NULL,
  pronunciation_note TEXT
);
CREATE TABLE audio_chapters (
  edition_id   INTEGER NOT NULL REFERENCES audio_editions(edition_id),
  book_id      INTEGER NOT NULL,
  chapter      INTEGER NOT NULL,
  file         TEXT NOT NULL,           -- relative to data/audio/
  duration_ms  INTEGER NOT NULL,
  mean_score   REAL NOT NULL,
  PRIMARY KEY (edition_id, book_id, chapter)
);
CREATE TABLE audio_verses (
  edition_id  INTEGER NOT NULL REFERENCES audio_editions(edition_id),
  verse_id    INTEGER NOT NULL,
  start_ms    INTEGER NOT NULL,
  end_ms      INTEGER NOT NULL,
  score       REAL NOT NULL,
  PRIMARY KEY (edition_id, verse_id)
);
CREATE TABLE audio_words (
  edition_id  INTEGER NOT NULL REFERENCES audio_editions(edition_id),
  word_id     INTEGER NOT NULL,         -- original_words.word_id in bible.db
  verse_id    INTEGER NOT NULL,
  start_ms    INTEGER NOT NULL,
  end_ms      INTEGER NOT NULL,
  PRIMARY KEY (edition_id, word_id)
);
CREATE INDEX audio_words_verse ON audio_words(edition_id, verse_id);
CREATE TABLE audio_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def encode(src: str, dst: Path, start: float | None, end: float | None) -> float:
    """Cut [start,end] of src into dst as mono AAC. Returns the output duration in seconds."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-y"]
    if start is not None:
        cmd += ["-ss", f"{start:.3f}"]
    if end is not None:
        cmd += ["-to", f"{end:.3f}"]
    cmd += ["-i", src, "-vn", "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", str(dst)]
    subprocess.run(cmd, check=True)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return float(probe)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
    ap.add_argument("--out", required=True, help="the data/ directory")
    ap.add_argument("--edition", action="append", help="repeatable; default every edition with alignment output")
    ap.add_argument("--jobs", type=int, default=8)
    ap.add_argument("--skip-encode", action="store_true", help="reuse files already in data/audio")
    args = ap.parse_args()

    work = Path(args.work)
    out = Path(args.out)
    audio_dir = out / "audio"
    db_path = out / "audio.db"
    sources = json.loads((HERE / "sources.json").read_text())

    out.mkdir(parents=True, exist_ok=True)
    temporary = tempfile.NamedTemporaryFile(prefix="audio-", suffix=".db", dir=out, delete=False)
    temporary.close()
    staged_db = Path(temporary.name)
    db = sqlite3.connect(staged_db)
    db.executescript(SCHEMA)

    digest = hashlib.sha256()
    for edition in sources["editions"]:
        if args.edition and edition["code"] not in args.edition:
            continue
        ed_dir = work / edition["code"]
        chapters = sorted(ed_dir.glob("*.json"))
        chapters = [p for p in chapters if not p.name.endswith(".state.json")]
        if not chapters:
            print(f"{edition['code']}: no alignment output, skipped", file=sys.stderr)
            continue
        digest.update(json.dumps(edition, sort_keys=True, separators=(",", ":")).encode())
        min_score = edition.get("min_score", DEFAULT_MIN_SCORE)
        cur = db.execute(
            """INSERT INTO audio_editions (code, translation_code, language, name, reader, license, attribution, source_url, pronunciation_note)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                edition["code"], edition["translation"], edition["language"], edition["name"], edition["reader"],
                edition["license"], edition["attribution"], edition["source_url"], edition.get("pronunciation_note"),
            ),
        )
        edition_id = cur.lastrowid
        standalone = edition["layout"] == "chapter-files"

        def one(path: Path):
            ch = json.loads(path.read_text())
            if not ch["verses"] or ch["mean_score"] < min_score:
                return ch, None, None
            rel = f"{edition['code']}/{ch['book_id']:02d}-{ch['chapter']:03d}.m4a"
            dst = audio_dir / rel
            if standalone:
                offset = 0.0
                start, end = None, None
            else:
                start = max(0.0, ch["chapter_start"] - LEAD_SECONDS)
                end = ch["chapter_end"] + TAIL_SECONDS
                offset = start
            if args.skip_encode and dst.exists():
                duration = float(subprocess.run(
                    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)],
                    check=True, capture_output=True, text=True).stdout.strip())
            else:
                duration = encode(ch["file"], dst, start, end)
            return ch, rel, (offset, duration)

        kept = dropped = 0
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            for ch, rel, meta in pool.map(one, chapters):
                if rel is None:
                    dropped += 1
                    print(f"  drop {edition['code']} {ch['book_id']}:{ch['chapter']} (score {ch.get('mean_score')})", file=sys.stderr)
                    continue
                offset, duration = meta
                kept += 1
                db.execute(
                    "INSERT INTO audio_chapters VALUES (?,?,?,?,?,?)",
                    (edition_id, ch["book_id"], ch["chapter"], rel, int(duration * 1000), ch["mean_score"]),
                )
                for v in ch["verses"]:
                    db.execute(
                        "INSERT OR REPLACE INTO audio_verses VALUES (?,?,?,?,?)",
                        (edition_id, v["verse_id"], int((v["start"] - offset) * 1000), int((v["end"] - offset) * 1000), v["score"]),
                    )
                    for w in v.get("words", []):
                        db.execute(
                            "INSERT OR REPLACE INTO audio_words VALUES (?,?,?,?,?)",
                            (edition_id, w["word_id"], v["verse_id"], int((w["start"] - offset) * 1000), int((w["end"] - offset) * 1000)),
                        )
                digest.update(json.dumps(ch, sort_keys=True, separators=(",", ":")).encode())
                with (audio_dir / rel).open("rb") as recording:
                    digest.update(hashlib.file_digest(recording, "sha256").digest())
        print(f"{edition['code']}: {kept} chapters kept, {dropped} dropped", file=sys.stderr)

    db.execute("INSERT INTO audio_meta VALUES ('build_id', ?)", (digest.hexdigest()[:16],))
    db.commit()
    db.execute("VACUUM")
    db.close()
    staged_db.chmod(0o644)
    staged_db.replace(db_path)
    print(f"wrote {db_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
