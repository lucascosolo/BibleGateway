"""Investigations content type for packages/timeline/build.py: one file per investigation at
<content>/investigations/<id>.toml. Stdlib unittest only."""
import unittest

from test_build import BuildCase, mutate, valid_files

INV = '''
id = "inv-a"
title = "A reading compared"
status = "draft"
ref = "Gen.1.1-Gen.1.2"
summary = "Two witnesses read the opening differently."

[[witnesses]]
siglum = "MT"
name = "Masoretic Text"
reading = "In the beginning"
translation = "In the beginning"
language = "Hebrew"
citations = [{ source = "src-a", locator = "p. 1" }]

[[editions]]
code = "BHS"
follows = "MT"

[[differences]]
kind = "textual"
text = "The witnesses diverge."
citations = [{ source = "src-b", locator = "p. 2" }]

[[challenges]]
text = "The divergence may be scribal."
citations = [{ source = "src-a", locator = "p. 3" }]
'''

TABLES = ["investigations", "investigation_verses", "investigation_witnesses",
          "investigation_editions", "investigation_differences", "investigation_challenges"]


def files_with(inv=INV):
    f = valid_files()
    f["investigations/inv-a.toml"] = inv
    return f


class Investigations(BuildCase):
    def test_minimal_investigation_builds_and_fills_every_table(self):
        r = self.build(files_with())
        self.assertEqual(r.returncode, 0, r.stderr)
        for t in TABLES:
            self.assertEqual(self.query(f"SELECT COUNT(*) FROM {t}"), [(1,)], t)
        self.assertEqual(self.query("SELECT COUNT(*) FROM investigation_citations"), [(3,)])
        self.assertEqual(self.query(
            "SELECT start_verse_id, end_verse_id FROM investigation_verses"), [(1001001, 1001002)])
        self.assertEqual(self.query("SELECT witness_id FROM investigation_witnesses"),
                         [("inv-a/witness-1",)])
        self.assertEqual(self.query("SELECT kind FROM investigation_differences"), [("textual",)])
        self.assertEqual(self.query("SELECT follows FROM investigation_editions"), [("MT",)])

    def test_difference_without_citations_fails(self):
        for label, new in (("missing key", ""), ("empty list", "citations = []\n")):
            with self.subTest(label):
                f = files_with()
                mutate(f, "investigations/inv-a.toml",
                       'citations = [{ source = "src-b", locator = "p. 2" }]\n', new)
                r = self.assert_fails_naming(f, "inv-a.toml", "needs at least one citation")
                self.assertNotIn("Traceback", r.stderr)

    def test_unknown_difference_kind_fails(self):
        f = files_with()
        mutate(f, "investigations/inv-a.toml", 'kind = "textual"', 'kind = "fanciful"')
        self.assert_fails_naming(f, "inv-a.toml", "'kind' must be one of", "fanciful")

    def test_edition_following_unknown_witness_fails(self):
        f = files_with()
        mutate(f, "investigations/inv-a.toml", 'follows = "MT"', 'follows = "XX"')
        self.assert_fails_naming(f, "inv-a.toml", "follows unknown witness 'XX'")

    def test_ref_to_nonexistent_verse_fails(self):
        f = files_with()
        mutate(f, "investigations/inv-a.toml", 'ref = "Gen.1.1-Gen.1.2"', 'ref = "Gen.1.32"')
        self.assert_fails_naming(f, "inv-a.toml", "does not exist in the corpus")


if __name__ == "__main__":
    unittest.main()
