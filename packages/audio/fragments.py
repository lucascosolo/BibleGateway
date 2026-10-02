"""Build the text the aligner is asked to find in each recording.

One JSON per edition: an ordered list of *units* (one audio file each), each holding the
chapters that file is expected to contain in reading order, each chapter holding its verses
in canonical order. English verses carry the translation's own text; Hebrew verses carry the
WLC words (one entry per `original_words` row, so word-level timings map straight back to a
`word_id`).

Everything is keyed by canonical `verse_id` (AGENTS.md invariant 1). The Hebrew numbering
difference for psalm superscriptions is already folded into `original_words.verse_id` by the
ingest, so a canonical verse simply has more words there — the aligner never sees a Hebrew
verse number.

Usage: python fragments.py --db ~/.cache/jot-audio/bible.db --raw ~/.cache/jot-audio/raw --out work/
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_sources() -> dict:
    return json.loads((HERE / "sources.json").read_text())


def parse_chapter_spec(spec) -> set[int]:
    """`[8, 9, 10]` or `"50-112"` -> set of chapter numbers."""
    if isinstance(spec, list):
        return set(int(c) for c in spec)
    a, b = spec.split("-")
    return set(range(int(a), int(b) + 1))


def excluded_verses(exclusion: dict, book_id: int) -> set[int]:
    """Verse ids listed as `verses: ["1:1-1:9"]` — ranges within one chapter."""
    out: set[int] = set()
    for rng in exclusion.get("verses", []):
        start, end = rng.split("-")
        c1, v1 = (int(x) for x in start.split(":"))
        c2, v2 = (int(x) for x in end.split(":"))
        assert c1 == c2, f"verse exclusion must stay within one chapter: {rng}"
        for v in range(v1, v2 + 1):
            out.add(book_id * 1_000_000 + c1 * 1_000 + v)
    return out


def english_chapter(db: sqlite3.Connection, translation_id: int, book_id: int, chapter: int) -> list[dict]:
    lo = book_id * 1_000_000 + chapter * 1_000
    rows = db.execute(
        "SELECT verse_id, text FROM verse_texts WHERE translation_id = ? AND verse_id BETWEEN ? AND ? ORDER BY verse_id",
        (translation_id, lo, lo + 999),
    ).fetchall()
    return [{"verse_id": vid, "text": text} for vid, text in rows if text and text.strip()]


def hebrew_chapter(db: sqlite3.Connection, book_id: int, chapter: int, skip: set[int]) -> list[dict]:
    lo = book_id * 1_000_000 + chapter * 1_000
    rows = db.execute(
        """SELECT verse_id, word_id, surface FROM original_words
           WHERE language IN ('hbo', 'arc') AND verse_id BETWEEN ? AND ?
           ORDER BY verse_id, word_id""",
        (lo, lo + 999),
    ).fetchall()
    verses: dict[int, list[dict]] = {}
    for vid, wid, surface in rows:
        if vid in skip:
            continue
        verses.setdefault(vid, []).append({"word_id": wid, "text": surface})
    return [{"verse_id": vid, "words": words} for vid, words in verses.items()]


def chapter_count(db: sqlite3.Connection, book_id: int) -> int:
    return db.execute("SELECT chapter_count FROM books WHERE book_id = ?", (book_id,)).fetchone()[0]


def book_names(db: sqlite3.Connection) -> dict[str, int]:
    """Lower-cased name -> book_id, with a few aliases LibriVox titles use."""
    out = {}
    for book_id, name in db.execute("SELECT book_id, name FROM books"):
        out[name.lower()] = book_id
    out["song of solomon"] = out.get("song of songs", out.get("song of solomon"))
    out["revelation"] = out.get("revelation", out.get("revelation of john"))
    return {k: v for k, v in out.items() if v is not None}


def units_chapter_files(edition: dict, raw: Path) -> list[dict]:
    pat = re.compile(edition["file_pattern"])
    units = []
    for path in sorted((raw / edition["raw_dir"]).rglob("*.mp3")):
        m = pat.search(path.name)
        if not m:
            continue
        units.append({
            "file": str(path),
            "chapters": [{"book_id": int(m["book"]), "chapter": int(m["chapter"])}],
        })
    return units


def units_multi_chapter_files(edition: dict, raw: Path, names: dict[str, int]) -> list[dict]:
    entries = json.loads((HERE / edition["file_map"]).read_text())
    # "001 - Genesis Ch. 1 - 14", "052 - Psalms 1 - 32", "126 - Revelation Ch.1 - 17", "124 - 3 John Ch. 1"
    title_re = re.compile(r"^\d+\s*-\s*(?P<book>.+?)\s+(?:Ch\.?\s*)?(?P<a>\d+)(?:\s*-\s*(?P<b>\d+))?\s*$")
    units = []
    for name, title, _length in entries:
        m = title_re.match(title)
        if not m:
            raise SystemExit(f"cannot parse LibriVox title: {title!r}")
        book_id = names.get(m["book"].lower())
        if book_id is None:
            raise SystemExit(f"unknown book in LibriVox title: {title!r}")
        a = int(m["a"])
        b = int(m["b"] or a)
        units.append({
            "file": str(raw / edition["raw_dir"] / name),
            "chapters": [{"book_id": book_id, "chapter": c} for c in range(a, b + 1)],
        })
    return units


def units_book_files(edition: dict, raw: Path, db: sqlite3.Connection) -> list[dict]:
    pat = re.compile(edition["file_pattern"])
    cov = edition["coverage"]
    units = []
    for path in sorted((raw / edition["raw_dir"]).glob("*.mp3")):
        m = pat.search(path.name)
        if not m:
            continue
        book_id = int(m["book"])
        if book_id not in cov["books"]:
            continue
        excl = cov["exclude"].get(str(book_id), {})
        skip_chapters = parse_chapter_spec(excl["chapters"]) if "chapters" in excl else set()
        chapters = [
            {"book_id": book_id, "chapter": c}
            for c in range(1, chapter_count(db, book_id) + 1)
            if c not in skip_chapters
        ]
        units.append({"file": str(path), "chapters": chapters})
    return units


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--edition", help="only this edition code")
    args = ap.parse_args()

    db = sqlite3.connect(args.db)
    raw = Path(args.raw).expanduser()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    names = book_names(db)

    for edition in load_sources()["editions"]:
        if args.edition and edition["code"] != args.edition:
            continue
        layout = edition["layout"]
        if layout == "chapter-files":
            units = units_chapter_files(edition, raw)
        elif layout == "multi-chapter-files":
            units = units_multi_chapter_files(edition, raw, names)
        elif layout == "book-files":
            units = units_book_files(edition, raw, db)
        else:
            raise SystemExit(f"unknown layout {layout}")

        translation_id = None
        if edition["translation"]:
            translation_id = db.execute(
                "SELECT translation_id FROM translations WHERE code = ?", (edition["translation"],)
            ).fetchone()[0]

        n_chapters = 0
        for unit in units:
            for ch in unit["chapters"]:
                if translation_id is not None:
                    ch["verses"] = english_chapter(db, translation_id, ch["book_id"], ch["chapter"])
                else:
                    excl = edition["coverage"]["exclude"].get(str(ch["book_id"]), {})
                    ch["verses"] = hebrew_chapter(db, ch["book_id"], ch["chapter"], excluded_verses(excl, ch["book_id"]))
                n_chapters += 1
            # A file whose chapters all came back empty is a file the corpus has no text for.
            unit["chapters"] = [c for c in unit["chapters"] if c["verses"]]
        units = [u for u in units if u["chapters"]]

        payload = {"edition": edition, "units": units}
        (out / f"{edition['code']}.fragments.json").write_text(json.dumps(payload, ensure_ascii=False))
        print(f"{edition['code']}: {len(units)} files, {n_chapters} chapters", file=sys.stderr)


if __name__ == "__main__":
    main()
