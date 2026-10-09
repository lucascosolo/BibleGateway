import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fragments import units_multi_chapter_files  # noqa: E402

NAMES = {"genesis": 1, "deuteronomy": 5, "ezra": 15, "obadiah": 31, "3 john": 64}


def run(titles):
    """Run the function over [(file, title)] pairs; return the units."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        map_path = tmp_path / "map.json"
        map_path.write_text(json.dumps([[f, t, "00:00"] for f, t in titles]))
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE books (book_id INTEGER, name TEXT, chapter_count INTEGER)")
        db.execute("INSERT INTO books VALUES (15, 'Ezra', 10)")
        edition = {"file_map": str(map_path), "raw_dir": "ed"}
        return units_multi_chapter_files(edition, tmp_path / "raw", NAMES, db), tmp_path / "raw"


def chapters(unit):
    return [(c["book_id"], c["chapter"]) for c in unit["chapters"]]


class Titles(unittest.TestCase):
    def test_kjv_style_ch_range(self):
        units, raw = run([("a.mp3", "001 - Genesis Ch. 1 - 14")])
        self.assertEqual(chapters(units[0]), [(1, c) for c in range(1, 15)])
        self.assertEqual(units[0]["file"], str(raw / "ed" / "a.mp3"))

    def test_asv_style_range_without_ch(self):
        units, _ = run([("a.mp3", "001 - Genesis 1-14")])
        self.assertEqual(chapters(units[0]), [(1, c) for c in range(1, 15)])

    def test_single_chapter_titles(self):
        units, _ = run([("a.mp3", "124 - 3 John Ch. 1"), ("b.mp3", "082 - Obadiah 1")])
        self.assertEqual(chapters(units[0]), [(64, 1)])
        self.assertEqual(chapters(units[1]), [(31, 1)])

    def test_zero_padded_range_end(self):
        units, _ = run([("a.mp3", "017 - Deuteronomy 1-09")])
        self.assertEqual(chapters(units[0]), [(5, c) for c in range(1, 10)])

    def test_bare_book_name_means_every_chapter(self):
        units, _ = run([("a.mp3", "044 - Ezra")])
        self.assertEqual(chapters(units[0]), [(15, c) for c in range(1, 11)])

    def test_chapter_claimed_twice_stays_in_first_unit(self):
        units, _ = run([("a.mp3", "001 - Genesis 1-3"), ("b.mp3", "002 - Genesis 3-5")])
        self.assertEqual(chapters(units[0]), [(1, 1), (1, 2), (1, 3)])
        self.assertEqual(chapters(units[1]), [(1, 4), (1, 5)])

    def test_unknown_book_exits(self):
        with self.assertRaises(SystemExit):
            run([("a.mp3", "001 - Nonesuch 1-2")])


if __name__ == "__main__":
    unittest.main()
