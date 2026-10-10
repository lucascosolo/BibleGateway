import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))

import fragments  # noqa: E402
from fragments import english_chapter, units_multi_chapter_files  # noqa: E402

BOOKS = [
    (67, "Tobit", 14), (68, "Judith", 16), (70, "Wisdom of Solomon", 19),
    (74, "Prayer of Azariah", 1), (75, "Susanna", 1), (76, "Bel and the Dragon", 1),
    (77, "1 Maccabees", 16), (78, "2 Maccabees", 15), (82, "Prayer of Manasseh", 1),
    (85, "1 Enoch", 108), (86, "Jubilees", 50), (103, "Protevangelium of James", 24),
    (104, "Infancy Gospel of Thomas", 45),
]
THOMAS_CHAPTERS = list(range(1, 20)) + list(range(101, 112)) + list(range(201, 216))


def make_db():
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE books (book_id INTEGER, name TEXT, chapter_count INTEGER)")
    db.executemany("INSERT INTO books VALUES (?, ?, ?)", BOOKS)
    db.execute("CREATE TABLE verses (verse_id INTEGER, book_id INTEGER, chapter INTEGER, verse INTEGER)")
    for book_id, _name, count in BOOKS:
        chs = THOMAS_CHAPTERS if book_id == 104 else range(1, count + 1)
        db.executemany(
            "INSERT INTO verses VALUES (?, ?, ?, 1)",
            [(book_id * 1_000_000 + c * 1_000 + 1, book_id, c) for c in chs],
        )
    return db


def run_titles(entries, db=None):
    db = db or make_db()
    with tempfile.TemporaryDirectory() as tmp:
        map_path = Path(tmp) / "map.json"
        map_path.write_text(json.dumps([[n, t, "00:00"] for n, t in entries]))
        edition = {"file_map": str(map_path), "raw_dir": "ed"}
        raw = Path(tmp) / "raw"
        return units_multi_chapter_files(edition, raw, fragments.book_names(db), db), raw


def chs(unit):
    return [(c["book_id"], c["chapter"]) for c in unit["chapters"]]


class SparseBooks(unittest.TestCase):
    def test_bare_title_yields_real_sparse_chapters(self):
        units, _ = run_titles([("a.mp3", "02 - Infancy Gospel of Thomas")])
        self.assertEqual(chs(units[0]), [(104, c) for c in THOMAS_CHAPTERS])
        self.assertEqual(len(units[0]["chapters"]), 45)

    def test_ranged_title_over_sparse_book(self):
        units, _ = run_titles([("a.mp3", "06 - Infancy Gospel of Thomas 101-111")])
        self.assertEqual(chs(units[0]), [(104, c) for c in range(101, 112)])

    def test_item_subdirectory_in_file_name(self):
        name = "tobit_kjv_1512_librivox/tobit_01_kjv.mp3"
        units, raw = run_titles([(name, "01 - Tobit 1")])
        self.assertEqual(units[0]["file"], str(raw / "ed" / "tobit_kjv_1512_librivox" / "tobit_01_kjv.mp3"))


class EnglishChapter(unittest.TestCase):
    def test_prologue_verse_zero_first_and_blanks_dropped(self):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE verse_texts (translation_id INTEGER, verse_id INTEGER, text TEXT)")
        base = 85 * 1_000_000 + 5 * 1_000
        db.executemany("INSERT INTO verse_texts VALUES (1, ?, ?)", [
            (base + 2, "two"), (base + 1, "one"), (base + 0, "prologue"), (base + 3, "   "), (base + 4, ""),
        ])
        db.execute("INSERT INTO verse_texts VALUES (2, ?, 'other translation')", (base + 1,))
        got = english_chapter(db, 1, 85, 5)
        self.assertEqual([v["verse_id"] for v in got], [base, base + 1, base + 2])
        self.assertEqual(got[0]["text"], "prologue")


class RealFileLists(unittest.TestCase):
    def units_for(self, fname):
        entries = json.loads((PKG / fname).read_text())
        units, _ = run_titles([(n, t) for n, t, _d in entries])
        for unit, (name, _t, _d) in zip(units, entries):
            self.assertTrue(unit["file"].endswith(name), (unit["file"], name))
        self.assertEqual(len(units), len(entries))
        return [c for u in units for c in chs(u)]

    def assert_exactly(self, got, expected):
        self.assertEqual(len(got), len(set(got)), "a chapter is claimed twice")
        self.assertEqual(sorted(got), sorted(expected))

    def test_kjva(self):
        spec = {67: 14, 68: 16, 70: 19, 74: 1, 75: 1, 76: 1, 82: 1, 77: 16, 78: 15}
        self.assert_exactly(
            self.units_for("kjva-files.json"),
            [(b, c) for b, n in spec.items() for c in range(1, n + 1)],
        )

    def test_charles(self):
        self.assert_exactly(
            self.units_for("charles-files.json"),
            [(85, c) for c in range(1, 109)] + [(86, c) for c in range(1, 51)],
        )

    def test_anf(self):
        self.assert_exactly(
            self.units_for("anf-files.json"),
            [(103, c) for c in range(1, 25)] + [(104, c) for c in THOMAS_CHAPTERS],
        )


if __name__ == "__main__":
    unittest.main()
