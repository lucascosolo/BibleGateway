"""composed_undated: a work TOML may state why it has no dating instead of carrying [[composed]]
entries. Exactly one of the two is required. Stdlib unittest only."""
import os
import sqlite3
import unittest

from test_build import BuildCase, mutate
from test_works import PATH, WORK, files_with

REASON = "No scholar has proposed a date; the only witness is undated."
HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = os.path.join(HERE, "..", "schema.sql")

HEAD = WORK.split("[[composed]]")[0]
TAIL = "[[provenance]]" + WORK.split("[[provenance]]", 1)[1]


def undated(reason=REASON):
    f = files_with()
    f[PATH] = HEAD + f'composed_undated = "{reason}"\n\n' + TAIL
    return f


class ComposedUndatedBuild(BuildCase):
    def test_undated_work_builds_with_null_envelope_and_reason(self):
        r = self.build(undated())
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query(
            "SELECT composed_undated, composed_earliest, composed_latest, "
            "traditional_earliest, traditional_latest FROM works"),
            [(REASON, None, None, None, None)])

    def test_undated_work_has_no_positions(self):
        self.build(undated())
        self.assertEqual(self.query("SELECT COUNT(*) FROM work_positions"), [(0,)])

    def test_dated_work_keeps_envelope_and_null_reason(self):
        r = self.build(files_with())
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query(
            "SELECT composed_undated, composed_earliest, composed_latest FROM works"),
            [(None, -300, -1)])

    def test_both_declared_is_an_error(self):
        f = files_with()
        mutate(f, PATH, 'original_language = "Aramaic"',
               f'original_language = "Aramaic"\ncomposed_undated = "{REASON}"')
        self.assert_fails_naming(f, "1-enoch.toml", "composed_undated", "[[composed]]")

    def test_neither_declared_is_an_error(self):
        f = files_with()
        f[PATH] = HEAD + TAIL
        self.assert_fails_naming(
            f, "1-enoch.toml", "needs at least one [[composed]] entry or composed_undated")

    def test_empty_and_whitespace_reason_is_an_error(self):
        for label, reason in (("empty", ""), ("whitespace", "   \\t ")):
            with self.subTest(label):
                self.assert_fails_naming(undated(reason), "1-enoch.toml", "composed_undated", "empty")

    def test_fingerprint_moves_when_the_reason_changes(self):
        self.build(undated())
        before = self.meta()["build_id"]
        out2 = os.path.join(self.outdir, "second.db")
        r = self.build(undated(REASON + " Revised."), name="content2", out=out2)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotEqual(before, self.meta(out2)["build_id"])


class ComposedUndatedSchema(unittest.TestCase):
    """The CHECKs: composed_undated IS NULL exactly when composed_earliest IS NOT NULL."""

    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        with open(SCHEMA, encoding="utf-8") as fh:
            self.db.executescript(fh.read())

    def insert(self, undated, earliest, latest):
        self.db.execute(
            "INSERT INTO works(work_id,title,canon,status,summary,original_language,"
            "composed_undated,composed_earliest,composed_latest) "
            "VALUES ('w','T','pseudepigrapha','draft','s','Greek',?,?,?)", (undated, earliest, latest))

    def test_accepts_undated_with_null_envelope(self):
        self.insert("why", None, None)

    def test_accepts_dated_with_null_reason(self):
        self.insert(None, -300, -1)

    def test_rejects_reason_together_with_dates(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert("why", -300, -1)

    def test_rejects_neither_reason_nor_dates(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(None, None, None)


if __name__ == "__main__":
    unittest.main()
