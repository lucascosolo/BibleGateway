"""Translation-ledger gate for build.py: every works `[[translations]]` ledger id must be a
backticked id opening a table row or a level-3 heading of the ledger file. Stdlib unittest."""
import glob
import os
import re
import subprocess
import sys
import tomllib
import unittest

from test_build import BUILD, PKG, BuildCase, mutate, write_tree
from test_works import PATH, files_with

ID_RE = re.compile(r"^(?:\| |### )`([a-z0-9-]+)`")
ROW = "| `charles-1enoch` | Charles 1913 | public domain |\n"
HEAD = "# Ledger\n\n| id | text | licence |\n|---|---|---|\n"


class LedgerGate(BuildCase):
    def run_build(self, files, ledger_text=None, ledger_path=None):
        content = os.path.join(self.tmp, "content")
        write_tree(content, files)
        if ledger_path is None:
            ledger_path = os.path.join(self.tmp, "ledger.md")
            if ledger_text is not None:
                with open(ledger_path, "w", encoding="utf-8") as fh:
                    fh.write(ledger_text)
        return subprocess.run(
            [sys.executable, "-I", BUILD, "--content", content, "--corpus", self.corpus,
             "--out", self.out, "--ledger", ledger_path], capture_output=True, text=True)

    def test_resolves_from_table_row(self):
        r = self.run_build(files_with(), HEAD + ROW)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_resolves_from_level3_heading(self):
        r = self.run_build(files_with(), "# Ledger\n\n### `charles-1enoch`\n\nNotes.\n")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_id_mentioned_only_in_prose_fails(self):
        text = HEAD + "| `other-id` | x | y |\n\nSee also `charles-1enoch` and charles-1enoch.\n"
        r = self.run_build(files_with(), text)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("charles-1enoch", r.stderr)
        self.assertIn("not in the translation ledger", r.stderr)

    def test_unknown_id_fails_with_location(self):
        f = files_with()
        mutate(f, PATH, 'ledger = "charles-1enoch"', 'ledger = "no-such-id"')
        r = self.run_build(f, HEAD + ROW)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("no-such-id", r.stderr)
        self.assertIn("not in the translation ledger", r.stderr)
        self.assertIn(PATH + " translations 1", r.stderr)
        self.assertFalse(os.path.exists(self.out))

    def test_unresolved_id_reported_alongside_other_errors(self):
        f = files_with()
        mutate(f, PATH, 'ledger = "charles-1enoch"', 'ledger = "no-such-id"')
        mutate(f, PATH, 'books = ["1En"]', 'books = ["Nope"]')
        r = self.run_build(f, HEAD + ROW)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("not in the translation ledger", r.stderr)
        self.assertGreaterEqual(r.stderr.count("error:"), 2, r.stderr)

    def test_missing_ledger_file_fails(self):
        missing = os.path.join(self.tmp, "absent", "ledger.md")
        r = self.run_build(files_with(), ledger_path=missing)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn("translation ledger", r.stderr)
        self.assertIn(missing, r.stderr)

    def test_cli_ledger_flag_decides_outcome(self):
        lacking = os.path.join(self.tmp, "lacking.md")
        with open(lacking, "w", encoding="utf-8") as fh:
            fh.write(HEAD + "| `other-id` | x | y |\n")
        having = os.path.join(self.tmp, "having.md")
        with open(having, "w", encoding="utf-8") as fh:
            fh.write(HEAD + ROW)
        self.assertEqual(self.run_build(files_with(), ledger_path=lacking).returncode, 1)
        r = self.run_build(files_with(), ledger_path=having)
        self.assertEqual(r.returncode, 0, r.stderr)


class RealLedger(unittest.TestCase):
    def test_every_real_work_ledger_id_resolves(self):
        sys.path.insert(0, PKG)
        import build
        self.assertEqual(build.DEFAULT_LEDGER, build.Path(build.__file__).resolve().parents[2]
                         / "docs" / "sources" / "outside-books.md")
        with open(build.DEFAULT_LEDGER, encoding="utf-8") as fh:
            ids = {m.group(1) for line in fh if (m := ID_RE.match(line))}
        used = {}
        for p in sorted(glob.glob(os.path.join(PKG, "content", "works", "*.toml"))):
            with open(p, "rb") as fh:
                data = tomllib.load(fh)
            if data.get("canon") == "described":
                continue
            for t in data.get("translations", []):
                used.setdefault(t["ledger"], os.path.basename(p))
        self.assertTrue(used)
        missing = {k: v for k, v in used.items() if k not in ids}
        self.assertEqual(missing, {})


if __name__ == "__main__":
    unittest.main()
