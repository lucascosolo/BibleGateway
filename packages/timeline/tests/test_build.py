"""Tests for packages/timeline/build.py, driven as a subprocess. Contract:
docs/plans/2026-10-06-timeline-backend.md. Stdlib unittest only."""
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
BUILD = os.path.join(PKG, "build.py")

SENTINEL = b"SENTINEL-NOT-A-DATABASE\x00\x01\x02"

# ---------------------------------------------------------------- fixtures

def make_corpus(path):
    db = sqlite3.connect(path)
    db.executescript("""
      CREATE TABLE books(book_id INTEGER, osis_id TEXT, name TEXT);
      INSERT INTO books VALUES (1,'Gen','Genesis'),(2,'Exod','Exodus'),
        (11,'1Kgs','1 Kings'),(27,'Dan','Daniel');
      CREATE TABLE verses(verse_id INTEGER PRIMARY KEY, book_id INTEGER, chapter INTEGER, verse INTEGER);
      CREATE TABLE corpus_meta(key TEXT, value TEXT);
      INSERT INTO corpus_meta VALUES ('build_id','corpusfixture0001');
    """)
    rows = [(1, 1, v) for v in range(1, 32)]
    rows += [(2, 12, 40), (2, 12, 41), (11, 6, 1), (27, 1, 1)]
    for b, c, v in rows:
        db.execute("INSERT INTO verses VALUES (?,?,?,?)", (b * 1_000_000 + c * 1000 + v, b, c, v))
    db.commit()
    db.close()


def valid_files():
    return {
        "sources.toml": '''
[[source]]
id = "src-a"
kind = "book"
title = "Book A"
author = "Author A"

[[source]]
id = "src-b"
kind = "article"
title = "Article B"
year = 1999
''',
        "eras.toml": '''
[[era]]
id = "era-one"
name = "Era One"
start = -1000
end = -587
summary = "The first era."
citations = [{ source = "src-a", locator = "p. 1" }]
''',
        "artifacts/art-one.toml": '''
id = "art-one"
name = "Artifact One"
kind = "inscription"
status = "draft"
made = { earliest = -701, latest = -690 }
language = "Akkadian"
summary = "An inscription."
citations = [{ source = "src-a", locator = "p. 2" }]
verses = [{ ref = "Exod.12.40", link = "background" }]
''',
        "artifacts/art-two.toml": '''
id = "art-two"
name = "Josephus passage"
kind = "literary-text"
status = "draft"
made = { earliest = 93, latest = 94 }
language = "Greek"
summary = "A passage of a Greek history."
citations = [{ source = "src-b", locator = "bk 20" }]
''',
        "persons/per-one.toml": '''
id = "per-one"
name = "Person One"
also_known_as = ["Alias A", "Alias B"]
role = "king of Somewhere"
summary = "A figure."
status = "draft"
lived = { earliest = -740, latest = -700 }
verses = [{ ref = "Dan.1.1", link = "describes" }]
events = ["ev-narr"]
citations = [{ source = "src-a", locator = "p. 11" }]

[[attestations]]
artifact = "art-one"
relation = "corroborates"
note = "Named."
citations = [{ source = "src-a", locator = "p. 12" }]

[[attestations]]
artifact = "art-two"
relation = "silent"
note = "Not mentioned."
citations = [{ source = "src-b", locator = "p. 13" }]
''',
        "events/ev-narr.toml": '''
id = "ev-narr"
title = "A narrative event"
axis = "narrative"
category = "biblical-narrative"
confidence = "contested"
status = "draft"
summary = "Something happened."
verses = [{ ref = "1Kgs.6.1", link = "dates" }, { ref = "Exod.12.40-Exod.12.41", link = "describes", note = "span" }]

[[positions]]
id = "early"
label = "Early"
tradition = "Conservative"
earliest = -1446
latest = -1406
summary = "Early date."
citations = [{ source = "src-a", locator = "p. 5" }]

[[positions.arguments]]
stance = "for"
text = "Because of the verse."
citations = [{ source = "src-b", locator = "ch. 2" }]

[[positions]]
id = "late"
label = "Late"
tradition = "Critical"
earliest = -1290
latest = -1200
summary = "Late date."
citations = [{ source = "src-a" }]

[[attestations]]
artifact = "art-one"
relation = "silent"
note = "It says nothing."
citations = [{ source = "src-b", locator = "p. 9" }]
''',
        "events/ev-comp.toml": '''
id = "ev-comp"
title = "Composition of Daniel"
axis = "composition"
category = "composition"
confidence = "contested"
status = "draft"
summary = "When it was written."
books = ["Dan"]

[[positions]]
id = "sixth"
label = "Sixth century"
tradition = "Traditional"
earliest = -600
latest = -530
summary = "Written in exile."
citations = [{ source = "src-a" }]

[[positions]]
id = "second"
label = "Second century"
tradition = "Critical"
earliest = -167
latest = -164
summary = "Written under Antiochus."
citations = [{ source = "src-a" }]
''',
        "issues/iss-one.toml": '''
id = "iss-one"
kind = "chronology"
title = "An issue"
summary = "A problem."
status = "draft"
events = ["ev-narr"]
persons = ["per-one"]
verses = [{ ref = "1Kgs.6.1", link = "dates" }]
citations = [{ source = "src-a", locator = "p. 7" }]

[[views]]
label = "View one"
text = "One reading."
citations = [{ source = "src-b", locator = "p. 8" }]
''',
    }


def mutate(files, path, old, new):
    assert old in files[path], f"fixture drift: {old!r} not in {path}"
    files[path] = files[path].replace(old, new, 1)


def write_tree(root, files, order=None):
    for rel in (order or list(files)):
        full = os.path.join(root, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(files[rel])


class BuildCase(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(BUILD), f"missing implementation: {BUILD}")
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp = self._tmp.name
        self.corpus = os.path.join(self.tmp, "bible.db")
        make_corpus(self.corpus)
        self.outdir = os.path.join(self.tmp, "outdir")
        os.makedirs(self.outdir)
        self.out = os.path.join(self.outdir, "timeline.db")

    def build(self, files, name="content", order=None, out=None):
        content = os.path.join(self.tmp, name)
        write_tree(content, files, order)
        return subprocess.run(
            [sys.executable, "-I", BUILD, "--content", content, "--corpus", self.corpus,
             "--out", out or self.out],
            capture_output=True, text=True)

    def query(self, sql, out=None):
        db = sqlite3.connect(out or self.out)
        try:
            return db.execute(sql).fetchall()
        finally:
            db.close()

    def meta(self, out=None):
        return dict(self.query("SELECT key, value FROM meta", out))

    def assert_fails_naming(self, files, *needles):
        r = self.build(files)
        self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stderr)
        for n in needles:
            self.assertIn(n, r.stderr)
        self.assertFalse(os.path.exists(self.out))
        return r


class HappyPath(BuildCase):
    def test_builds_and_counts_rows(self):
        r = self.build(valid_files())
        self.assertEqual(r.returncode, 0, r.stderr)
        expected = {"sources": 2, "eras": 1, "events": 2, "positions": 4, "arguments": 1,
                    "artifacts": 2, "attestations": 1, "persons": 1, "person_attestations": 2, "person_events": 1, "issue_persons": 1, "issues": 1, "issue_views": 1,
                    "issue_events": 1, "verse_links": 5}
        for table, n in expected.items():
            self.assertEqual(self.query(f"SELECT COUNT(*) FROM {table}")[0][0], n, table)
        self.assertEqual(os.listdir(self.outdir), ["timeline.db"])

    def test_event_range_is_envelope_of_positions(self):
        self.build(valid_files())
        rows = dict((e, (a, b)) for e, a, b in self.query(
            "SELECT event_id, earliest_year, latest_year FROM events"))
        self.assertEqual(rows["ev-narr"], (-1446, -1200))
        self.assertEqual(rows["ev-comp"], (-600, -164))

    def test_composition_event_has_event_books_and_narrative_has_none(self):
        self.build(valid_files())
        self.assertEqual(self.query("SELECT event_id, book_id FROM event_books"), [("ev-comp", 27)])

    def test_composition_event_with_two_books(self):
        f = valid_files()
        mutate(f, "events/ev-comp.toml", 'books = ["Dan"]', 'books = ["Gen", "Exod"]')
        r = self.build(f)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query("SELECT book_id FROM event_books WHERE event_id='ev-comp' ORDER BY book_id"),
                         [(1,), (2,)])

    def test_canon_axis_event_builds(self):
        f = valid_files()
        f["events/ev-canon.toml"] = f["events/ev-narr.toml"].replace("ev-narr", "ev-canon").replace(
            'axis = "narrative"', 'axis = "canon"').replace('category = "biblical-narrative"', 'category = "canon"')
        r = self.build(f)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query("SELECT axis FROM events WHERE event_id='ev-canon'"), [("canon",)])

    def test_stable_text_ids(self):
        self.build(valid_files())
        self.assertEqual(self.query("SELECT argument_id FROM arguments"), [("ev-narr/early/argument-1",)])
        self.assertEqual(self.query("SELECT attestation_id FROM attestations"), [("ev-narr@art-one",)])
        self.assertEqual(self.query("SELECT view_id FROM issue_views"), [("iss-one/view-1",)])
        for kind, sid in (("argument", "ev-narr/early/argument-1"), ("attestation", "ev-narr@art-one"),
                          ("issue_view", "iss-one/view-1")):
            n = self.query(f"SELECT COUNT(*) FROM citations WHERE subject_kind='{kind}' AND subject_id='{sid}'")[0][0]
            self.assertGreaterEqual(n, 1, kind)

    def test_ids_identical_across_file_creation_order(self):
        f = valid_files()
        o1 = os.path.join(self.outdir, "o1.db")
        o2 = os.path.join(self.outdir, "o2.db")
        self.assertEqual(self.build(f, name="c1", order=list(f), out=o1).returncode, 0)
        self.assertEqual(self.build(f, name="c2", order=list(reversed(list(f))), out=o2).returncode, 0)
        sql = ("SELECT argument_id FROM arguments UNION ALL SELECT attestation_id FROM attestations "
               "UNION ALL SELECT view_id FROM issue_views ORDER BY 1")
        self.assertEqual(self.query(sql, o1), self.query(sql, o2))
        self.assertEqual(len(self.query(sql, o1)), 3)

    def test_every_claim_carries_citations(self):
        self.build(valid_files())
        checks = {
            "era": "SELECT era_id FROM eras",
            "artifact": "SELECT artifact_id FROM artifacts",
            "position": "SELECT position_id FROM positions",
            "argument": "SELECT argument_id FROM arguments",
            "attestation": "SELECT attestation_id FROM attestations",
            "issue": "SELECT issue_id FROM issues",
            "issue_view": "SELECT view_id FROM issue_views",
        }
        for kind, sql in checks.items():
            for (sid,) in self.query(sql):
                n = self.query(f"SELECT COUNT(*) FROM citations WHERE subject_kind='{kind}' AND subject_id='{sid}'")[0][0]
                self.assertGreaterEqual(n, 1, f"{kind} {sid}")
        loc = self.query("SELECT locator FROM citations WHERE subject_kind='position' AND subject_id='ev-narr/early'")
        self.assertEqual(loc, [("p. 5",)])

    def test_meta_stamp(self):
        self.build(valid_files())
        m = self.meta()
        self.assertRegex(m["build_id"], r"^[0-9a-f]{16}$")
        self.assertIn("schema_version", m)
        self.assertEqual(m["corpus_build_id"], "corpusfixture0001")

    def test_verse_range_resolved_to_ids(self):
        self.build(valid_files())
        rows = self.query("SELECT start_verse_id, end_verse_id FROM verse_links "
                          "WHERE subject_kind='event' AND link_type='describes'")
        self.assertEqual(rows, [(2012040, 2012041)])

    def test_uncited_source_is_warning_only(self):
        files = valid_files()
        files["sources.toml"] += '\n[[source]]\nid = "src-unused"\nkind = "web"\ntitle = "Unused"\n'
        r = self.build(files)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("src-unused", r.stderr)


def person_toml(pid, relations):
    arts = ["art-one", "art-two"]
    out = (f'id = "{pid}"\nname = "{pid}"\nrole = "r"\nsummary = "s"\nstatus = "draft"\n'
           'citations = [{ source = "src-a" }]\n')
    for art, rel in zip(arts, relations):
        out += (f'\n[[attestations]]\nartifact = "{art}"\nrelation = "{rel}"\nnote = "n"\n'
                'citations = [{ source = "src-a" }]\n')
    return out


class Persons(BuildCase):
    def test_person_rows_and_json_aliases(self):
        self.build(valid_files())
        import json
        row = self.query("SELECT name, role, status, lived_earliest, lived_latest, also_known_as FROM persons")[0]
        self.assertEqual(row[:5], ("Person One", "king of Somewhere", "draft", -740, -700))
        self.assertEqual(json.loads(row[5]), ["Alias A", "Alias B"])
        self.assertEqual(self.query("SELECT event_id FROM person_events"), [("ev-narr",)])
        self.assertEqual(self.query("SELECT person_id FROM issue_persons"), [("per-one",)])

    def test_person_attestation_ids_citations_and_verse_links(self):
        self.build(valid_files())
        self.assertEqual(self.query("SELECT attestation_id FROM person_attestations ORDER BY 1"),
                         [("per-one@art-one",), ("per-one@art-two",)])
        for sid in ("per-one@art-one", "per-one@art-two"):
            n = self.query(f"SELECT COUNT(*) FROM citations WHERE subject_kind='person_attestation' AND subject_id='{sid}'")[0][0]
            self.assertEqual(n, 1)
        self.assertEqual(self.query("SELECT COUNT(*) FROM citations WHERE subject_kind='person' AND subject_id='per-one'")[0][0], 1)
        self.assertEqual(self.query("SELECT start_verse_id FROM verse_links WHERE subject_kind='person' AND subject_id='per-one'"),
                         [(27001001,)])

    def test_derived_evidence_grade(self):
        f = valid_files()
        cases = {
            "g-corr": (["corroborates", "silent"], "corroborates", 0),
            "g-part": (["partially-corroborates", "silent"], "partially-corroborates", 0),
            "g-cons": (["consistent", "silent"], "consistent", 0),
            "g-mixed": (["corroborates", "in-tension"], "corroborates", 1),
            "g-tens": (["in-tension"], "none", 1),
            "g-silent": (["silent"], "silent", 0),
            "g-none": ([], "none", 0),
        }
        for pid, (rels, _, _) in cases.items():
            f[f"persons/{pid}.toml"] = person_toml(pid, rels)
        r = self.build(f)
        self.assertEqual(r.returncode, 0, r.stderr)
        got = {p: (e, t) for p, e, t in self.query("SELECT person_id, evidence, has_tension FROM persons")}
        for pid, (_, grade, tension) in cases.items():
            self.assertEqual(got[pid], (grade, tension), pid)
        self.assertEqual(got["per-one"], ("corroborates", 0))

    def test_literary_text_artifact_builds(self):
        self.assertEqual(self.build(valid_files()).returncode, 0)
        self.assertEqual(self.query("SELECT kind, status FROM artifacts WHERE artifact_id='art-two'"),
                         [("literary-text", "draft")])

    def test_literary_text_artifact_rejects_held_by(self):
        f = valid_files()
        mutate(f, "artifacts/art-two.toml", 'language = "Greek"',
               'language = "Greek"\nheld_by = { institution = "X", accession = "1" }')
        self.assert_fails_naming(f, "art-two.toml")

    def test_artifact_without_status_fails(self):
        f = valid_files()
        mutate(f, "artifacts/art-one.toml", 'status = "draft"\n', "")
        self.assert_fails_naming(f, "art-one.toml")

    def test_person_without_citations_fails(self):
        f = valid_files()
        mutate(f, "persons/per-one.toml", 'citations = [{ source = "src-a", locator = "p. 11" }]', "citations = []")
        self.assert_fails_naming(f, "per-one.toml")

    def test_person_attestation_to_unknown_artifact_fails(self):
        f = valid_files()
        mutate(f, "persons/per-one.toml", 'artifact = "art-two"', 'artifact = "art-ghost"')
        self.assert_fails_naming(f, "per-one.toml", "art-ghost")

    def test_person_events_unknown_event_fails(self):
        f = valid_files()
        mutate(f, "persons/per-one.toml", 'events = ["ev-narr"]', 'events = ["ev-ghost"]')
        self.assert_fails_naming(f, "per-one.toml", "ev-ghost")

    def test_issue_persons_unknown_person_fails(self):
        f = valid_files()
        mutate(f, "issues/iss-one.toml", 'persons = ["per-one"]', 'persons = ["per-ghost"]')
        self.assert_fails_naming(f, "iss-one.toml", "per-ghost")

    def test_lived_year_zero_fails(self):
        f = valid_files()
        mutate(f, "persons/per-one.toml", "lived = { earliest = -740", "lived = { earliest = 0")
        self.assert_fails_naming(f, "per-one.toml")


class Gates(BuildCase):
    def test_unknown_key(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'axis = "narrative"', 'axis = "narrative"\nearliest_yr = 5')
        self.assert_fails_naming(f, "ev-narr.toml", "earliest_yr")

    def test_year_zero(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", "earliest = -1446", "earliest = 0")
        self.assert_fails_naming(f, "ev-narr.toml")

    def test_earliest_after_latest(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", "earliest = -1446\nlatest = -1406", "earliest = -1406\nlatest = -1446")
        self.assert_fails_naming(f, "ev-narr.toml")

    def test_era_end_before_start(self):
        f = valid_files()
        mutate(f, "eras.toml", "start = -1000\nend = -587", "start = -587\nend = -1000")
        self.assert_fails_naming(f, "eras.toml")

    def test_citation_to_unknown_source(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'citations = [{ source = "src-a", locator = "p. 5" }]',
               'citations = [{ source = "src-nope", locator = "p. 5" }]')
        self.assert_fails_naming(f, "ev-narr.toml", "src-nope")

    def test_position_without_citations(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'citations = [{ source = "src-a", locator = "p. 5" }]', "citations = []")
        self.assert_fails_naming(f, "ev-narr.toml")

    def test_event_without_positions(self):
        f = valid_files()
        f["events/ev-narr.toml"] = f["events/ev-narr.toml"].split("[[positions]]")[0]
        self.assert_fails_naming(f, "ev-narr.toml")

    def test_composition_event_missing_book(self):
        f = valid_files()
        mutate(f, "events/ev-comp.toml", 'books = ["Dan"]\n', "")
        self.assert_fails_naming(f, "ev-comp.toml")

    def test_composition_event_with_empty_books(self):
        f = valid_files()
        mutate(f, "events/ev-comp.toml", 'books = ["Dan"]', "books = []")
        self.assert_fails_naming(f, "ev-comp.toml")

    def test_old_singular_book_key_is_unknown(self):
        f = valid_files()
        mutate(f, "events/ev-comp.toml", 'books = ["Dan"]', 'book = "Dan"')
        self.assert_fails_naming(f, "ev-comp.toml", "book")

    def test_narrative_event_with_books(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'axis = "narrative"', 'axis = "narrative"\nbooks = ["Dan"]')
        self.assert_fails_naming(f, "ev-narr.toml")

    def test_composition_event_with_unknown_book(self):
        f = valid_files()
        mutate(f, "events/ev-comp.toml", 'books = ["Dan"]', 'books = ["Dan", "Zzz"]')
        self.assert_fails_naming(f, "ev-comp.toml", "Zzz")

    def test_attestation_to_unknown_artifact(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'artifact = "art-one"', 'artifact = "art-missing"')
        self.assert_fails_naming(f, "ev-narr.toml", "art-missing")

    def test_issue_referencing_unknown_event(self):
        f = valid_files()
        mutate(f, "issues/iss-one.toml", 'events = ["ev-narr"]', 'events = ["ev-ghost"]')
        self.assert_fails_naming(f, "iss-one.toml", "ev-ghost")

    def test_verse_ref_to_nonexistent_sparse_verse(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'ref = "1Kgs.6.1"', 'ref = "Gen.1.32"')
        self.assert_fails_naming(f, "ev-narr.toml", "Gen.1.32")

    def test_verse_ref_unknown_book(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", 'ref = "1Kgs.6.1"', 'ref = "Foo.1.1"')
        self.assert_fails_naming(f, "ev-narr.toml", "Foo")

    def test_verse_range_start_after_end(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", "Exod.12.40-Exod.12.41", "Exod.12.41-Exod.12.40")
        self.assert_fails_naming(f, "ev-narr.toml")

    def test_bad_id_slug(self):
        f = valid_files()
        mutate(f, "sources.toml", 'id = "src-a"', 'id = "Src_A"')
        self.assert_fails_naming(f, "sources.toml")

    def test_file_name_must_equal_id(self):
        f = valid_files()
        f["events/wrong-name.toml"] = f.pop("events/ev-comp.toml")
        self.assert_fails_naming(f, "wrong-name.toml")

    def test_duplicate_ids(self):
        f = valid_files()
        f["sources.toml"] += '\n[[source]]\nid = "src-a"\nkind = "web"\ntitle = "Dup"\n'
        self.assert_fails_naming(f, "sources.toml", "src-a")

    def test_all_failures_reported_in_one_run(self):
        f = valid_files()
        mutate(f, "events/ev-narr.toml", "earliest = -1446", "earliest = 0")
        mutate(f, "issues/iss-one.toml", 'events = ["ev-narr"]', 'events = ["ev-ghost"]')
        r = self.assert_fails_naming(f, "ev-narr.toml", "iss-one.toml")
        self.assertIn("ev-ghost", r.stderr)


class Atomicity(BuildCase):
    def test_failed_build_leaves_existing_out_untouched_and_no_temp_files(self):
        with open(self.out, "wb") as fh:
            fh.write(SENTINEL)
        f = valid_files()
        mutate(f, "events/ev-narr.toml", "earliest = -1446", "earliest = 0")
        r = self.build(f)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ev-narr.toml", r.stderr)
        with open(self.out, "rb") as fh:
            self.assertEqual(fh.read(), SENTINEL)
        self.assertEqual(os.listdir(self.outdir), ["timeline.db"])

    def test_successful_build_replaces_existing_out(self):
        with open(self.out, "wb") as fh:
            fh.write(SENTINEL)
        r = self.build(valid_files())
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("build_id", self.meta())
        self.assertEqual(os.listdir(self.outdir), ["timeline.db"])


class BuildId(BuildCase):
    def build_id(self, files, name, order=None):
        out = os.path.join(self.outdir, name + ".db")
        r = self.build(files, name=name, order=order, out=out)
        self.assertEqual(r.returncode, 0, r.stderr)
        return self.meta(out)["build_id"]

    def test_stable_across_file_creation_order(self):
        f = valid_files()
        a = self.build_id(f, "c1", order=list(f))
        b = self.build_id(f, "c2", order=list(reversed(list(f))))
        self.assertEqual(a, b)

    def test_changes_on_equal_length_text_edit(self):
        f = valid_files()
        a = self.build_id(f, "c1")
        mutate(f, "events/ev-narr.toml", 'summary = "Something happened."', 'summary = "Somethign happened."')
        b = self.build_id(f, "c2")
        self.assertNotEqual(a, b)


if __name__ == "__main__":
    unittest.main()
