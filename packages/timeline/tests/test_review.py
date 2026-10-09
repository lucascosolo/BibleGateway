"""Tests for packages/timeline/review.py (the Markdown review sheet). Contract: Revision 2 of
docs/plans/2026-10-06-timeline-backend.md. Builds a fixture timeline.db with build.py first."""
import os
import subprocess
import sys
import tempfile
import unittest

from test_build import BUILD, PKG, make_corpus, mutate, valid_files, write_tree

REVIEW = os.path.join(PKG, "review.py")


class ReviewCase(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(BUILD), f"missing implementation: {BUILD}")
        self.assertTrue(os.path.exists(REVIEW), f"missing implementation: {REVIEW}")
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp = self._tmp.name
        self.corpus = os.path.join(self.tmp, "bible.db")
        make_corpus(self.corpus)
        self.db = os.path.join(self.tmp, "built", "timeline.db")
        os.makedirs(os.path.dirname(self.db))
        self.outdir = os.path.join(self.tmp, "sheet")
        os.makedirs(self.outdir)
        self.out = os.path.join(self.outdir, "review.md")

    def build(self, files):
        content = os.path.join(self.tmp, "content")
        write_tree(content, files)
        r = subprocess.run([sys.executable, "-I", BUILD, "--content", content, "--corpus", self.corpus,
                            "--out", self.db], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def review(self, *extra):
        r = subprocess.run([sys.executable, "-I", REVIEW, "--db", self.db, "--out", self.out, *extra],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(self.out, encoding="utf-8") as fh:
            return fh.read()


class Review(ReviewCase):
    def test_sheet_lists_every_draft_entity_with_file_and_citations(self):
        self.build(valid_files())
        text = self.review()
        for needle in ["A narrative event", "Composition of Daniel", "Artifact One", "Josephus passage",
                       "Person One", "An issue",
                       "events/ev-narr.toml", "events/ev-comp.toml", "artifacts/art-one.toml",
                       "artifacts/art-two.toml", "persons/per-one.toml", "issues/iss-one.toml",
                       "Book A", "Article B", "p. 5", "ch. 2", "p. 11", "p. 7", "bk 20"]:
            self.assertIn(needle, text)
        self.assertGreaterEqual(text.count("- [ ]"), 6)

    def test_reviewed_entities_excluded_unless_all(self):
        f = valid_files()
        mutate(f, "events/ev-comp.toml", 'status = "draft"', 'status = "claims-checked"')
        self.build(f)
        default = self.review()
        self.assertNotIn("Composition of Daniel", default)
        self.assertNotIn("events/ev-comp.toml", default)
        self.assertIn("A narrative event", default)
        everything = self.review("--all")
        self.assertIn("Composition of Daniel", everything)
        self.assertIn("events/ev-comp.toml", everything)

    def test_sources_located_entities_listed_by_default(self):
        f = valid_files()
        mutate(f, "events/ev-comp.toml", 'status = "draft"', 'status = "sources-located"')
        self.build(f)
        default = self.review()
        self.assertIn("Composition of Daniel", default)
        self.assertIn("events/ev-comp.toml", default)

    def test_writes_only_the_output_file(self):
        self.build(valid_files())
        self.review()
        self.assertEqual(os.listdir(self.outdir), ["review.md"])


if __name__ == "__main__":
    unittest.main()
