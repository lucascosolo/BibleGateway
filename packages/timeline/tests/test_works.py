"""Works content type for packages/timeline/build.py: one file per outside text at
<content>/works/<id>.toml. Contract: scratchpad works-contract.md. Stdlib unittest only."""
import os
import sqlite3
import unittest

from test_build import BuildCase, mutate, valid_files

WORK = '''
id = "1-enoch"
title = "1 Enoch"
also_known_as = ["Ethiopic Enoch"]
books = ["1En"]
canon = "pseudepigrapha"
status = "draft"
summary = "A composite apocalypse."
citations = [{ source = "src-a", locator = "p. 1" }]
original_language = "Aramaic"
verses = [{ ref = "Gen.1.1-Gen.1.2", link = "alludes", note = "Echoed." }]

[[composed]]
id = "critical-stages"
label = "Third to first century BCE"
tradition = "critical"
earliest = -300
latest = -1
summary = "Composed in stages."
held_by = "R. H. Charles (1917)"
citations = [{ source = "src-a", locator = "p. 3" }]

[[composed]]
id = "traditional-antediluvian"
label = "Antediluvian"
tradition = "traditional"
earliest = -3000
latest = -2900
summary = "Claimed by Enoch himself."
citations = [{ source = "src-a", locator = "p. 2" }]

[[provenance]]
place = "Judea"
note = "Probable origin."
citations = [{ source = "src-b", locator = "p. 4" }]

[[witnesses]]
name = "4QEn^a (4Q201)"
siglum = "4Q201"
earliest = -200
latest = -150
language = "Aramaic"
institution = "Israel Antiquities Authority"
citations = [{ source = "src-b", locator = "p. 5" }]

[[held_canonical_by]]
tradition = "Ethiopian Orthodox Tewahedo Church"
citations = [{ source = "src-a", locator = "p. 6" }]

[[translations]]
ledger = "charles-1enoch"
code = "LXX"

[[events]]
event = "ev-narr"
note = "Linked for context."
citations = [{ source = "src-b", locator = "p. 7" }]
'''

DESCRIBED = '''
id = "lost-gospel"
title = "A Lost Gospel"
canon = "described"
status = "draft"
summary = "Known only by report."
citations = [{ source = "src-a", locator = "p. 1" }]
original_language = "Greek"
contents = "Reported to contain sayings."

[[composed]]
id = "critical"
label = "Second century"
tradition = "critical"
earliest = 100
latest = 199
summary = "Dated by citation."
citations = [{ source = "src-a", locator = "p. 2" }]

[[excerpts]]
text = "A short quoted line of five words"
citations = [{ source = "src-b", locator = "p. 3" }]
'''

PATH = "works/1-enoch.toml"
DPATH = "works/lost-gospel.toml"
TABLES = ["works", "work_books", "work_positions", "work_provenance", "work_witnesses",
          "work_holders", "work_translations", "work_verses", "work_events"]


def files_with(work=WORK, path=PATH):
    f = valid_files()
    f[path] = work
    return f


def described_files(work=DESCRIBED):
    return files_with(work, DPATH)


class Works(BuildCase):
    def test_minimal_work_builds_and_fills_every_table(self):
        r = self.build(files_with())
        self.assertEqual(r.returncode, 0, r.stderr)
        for t in TABLES:
            self.assertEqual(self.query(f"SELECT COUNT(*) FROM {t}")[0][0] > 0, True, t)
        self.assertEqual(self.query("SELECT COUNT(*) FROM works"), [(1,)])
        self.assertEqual(self.query("SELECT COUNT(*) FROM work_positions"), [(2,)])
        self.assertEqual(self.query("SELECT COUNT(*) FROM work_citations WHERE subject_kind='work'"), [(1,)])
        self.assertEqual(self.query("SELECT COUNT(*) FROM work_citations"), [(7,)])

    def test_stable_ids(self):
        self.build(files_with())
        self.assertEqual(self.query("SELECT position_id FROM work_positions ORDER BY ordinal"),
                         [("1-enoch/critical-stages",), ("1-enoch/traditional-antediluvian",)])
        self.assertEqual(self.query("SELECT witness_id FROM work_witnesses"), [("1-enoch/witness-1",)])
        self.assertEqual(self.query("SELECT provenance_id FROM work_provenance"), [("1-enoch/provenance-1",)])
        self.assertEqual(self.query("SELECT holder_id FROM work_holders"), [("1-enoch/holder-1",)])
        self.assertEqual(self.query("SELECT subject_id FROM work_citations WHERE subject_kind='event'"),
                         [("1-enoch@ev-narr",)])
        self.assertEqual(self.query("SELECT event_id FROM work_events"), [("ev-narr",)])
        self.assertEqual(self.query("SELECT book_id FROM work_books"), [(85,)])
        self.assertEqual(self.query("SELECT ledger, code FROM work_translations"),
                         [("charles-1enoch", "LXX")])
        self.assertEqual(self.query("SELECT start_verse_id, end_verse_id, link_type FROM work_verses"),
                         [(1001001, 1001002, "alludes")])

    def test_envelope_excludes_traditional_when_critical_exists(self):
        self.build(files_with())
        self.assertEqual(self.query(
            "SELECT composed_earliest, composed_latest, traditional_earliest, traditional_latest FROM works"),
            [(-300, -1, -3000, -2900)])

    def test_traditional_only_work_uses_it_as_envelope(self):
        f = files_with()
        mutate(f, PATH, 'tradition = "critical"', 'tradition = "traditional"')
        r = self.build(f)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query("SELECT composed_earliest, composed_latest FROM works"), [(-3000, -1)])

    def test_described_work_builds_with_contents_and_excerpts(self):
        r = self.build(described_files())
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query("SELECT contents FROM works"), [("Reported to contain sayings.",)])
        self.assertEqual(self.query("SELECT excerpt_id FROM work_excerpts"), [("lost-gospel/excerpt-1",)])
        self.assertEqual(self.query("SELECT COUNT(*) FROM work_books"), [(0,)])
        self.assertEqual(self.query("SELECT COUNT(*) FROM work_translations"), [(0,)])

    def test_works_for_book_lookup(self):
        self.build(files_with())
        self.assertEqual(self.query(
            "SELECT w.work_id FROM works w JOIN work_books b ON b.work_id = w.work_id WHERE b.book_id = 85"),
            [("1-enoch",)])
        self.assertEqual(self.query("SELECT COUNT(*) FROM work_books WHERE book_id = 1"), [(0,)])

    def test_fingerprint_moves_when_a_work_changes(self):
        self.build(files_with())
        before = self.meta()["build_id"]
        f = files_with()
        mutate(f, PATH, "A composite apocalypse.", "A composite apocalypse, revised.")
        out2 = os.path.join(self.outdir, "second.db")
        r = self.build(f, name="content2", out=out2)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotEqual(before, self.meta(out2)["build_id"])

    def test_code_is_tolerated_when_corpus_has_no_translations_table(self):
        corpus = os.path.join(self.tmp, "bare.db")
        db = sqlite3.connect(corpus)
        db.executescript("""
          CREATE TABLE books(book_id INTEGER, osis_id TEXT, name TEXT);
          INSERT INTO books VALUES (1,'Gen','Genesis'),(2,'Exod','Exodus'),
            (11,'1Kgs','1 Kings'),(27,'Dan','Daniel'),(85,'1En','1 Enoch');
          CREATE TABLE verses(verse_id INTEGER PRIMARY KEY, book_id INTEGER, chapter INTEGER, verse INTEGER);
          INSERT INTO verses VALUES (1001001,1,1,1),(1001002,1,1,2),(2012040,2,12,40),(2012041,2,12,41),
            (11006001,11,6,1),(27001001,27,1,1);
          CREATE TABLE corpus_meta(key TEXT, value TEXT);
          INSERT INTO corpus_meta VALUES ('build_id','bare0001');
        """)
        db.commit()
        db.close()
        self.corpus = corpus
        r = self.build(files_with())
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.query("SELECT code FROM work_translations"), [("LXX",)])


class WorkGates(BuildCase):
    def fails(self, files, *needles):
        r = self.assert_fails_naming(files, "1-enoch.toml", *needles)
        return r

    def mutated(self, old, new, path=PATH, base=None):
        f = files_with(base or WORK, path) if base else files_with()
        mutate(f, path, old, new)
        return f

    def test_unknown_key(self):
        self.fails(self.mutated('title = "1 Enoch"', 'title = "1 Enoch"\nbogus = 1'), "bogus")

    def test_unknown_canon(self):
        self.fails(self.mutated('canon = "pseudepigrapha"', 'canon = "mystery"'), "mystery")

    def test_unknown_status(self):
        self.fails(self.mutated('status = "draft"', 'status = "final"'), "final")

    def test_unknown_tradition(self):
        self.fails(self.mutated('tradition = "critical"', 'tradition = "folk"'), "folk")

    def test_unknown_verse_link(self):
        self.fails(self.mutated('link = "alludes"', 'link = "mentions"'), "mentions")

    def test_composed_missing(self):
        f = files_with()
        head = WORK.split("[[composed]]")[0]
        tail = "[[provenance]]" + WORK.split("[[provenance]]", 1)[1]
        f[PATH] = head + tail
        self.fails(f, "composed")

    def test_composed_without_citations(self):
        cit = 'citations = [{ source = "src-a", locator = "p. 3" }]\n'
        for label, new in (("missing key", ""), ("empty list", "citations = []\n")):
            with self.subTest(label):
                r = self.assert_fails_naming(self.mutated(cit, new), "1-enoch.toml", "citation")

    def test_composed_year_zero(self):
        self.fails(self.mutated("latest = -1\n", "latest = 0\n"), "year")

    def test_composed_earliest_after_latest(self):
        self.fails(self.mutated("earliest = -300", "earliest = 50"), "earliest")

    def test_duplicate_composed_id(self):
        self.fails(self.mutated('id = "critical-stages"', 'id = "traditional-antediluvian"'),
                   "traditional-antediluvian")

    def test_traditional_may_not_lead(self):
        f = files_with()
        a = WORK.index('[[composed]]\nid = "critical-stages"')
        b = WORK.index('[[composed]]\nid = "traditional-antediluvian"')
        c = WORK.index('[[provenance]]')
        f[PATH] = WORK[:a] + WORK[b:c] + WORK[a:b] + WORK[c:]
        r = self.fails(f)
        self.assertIn("traditional", r.stderr)
        self.assertIn("lead", r.stderr)

    def test_witness_without_dates(self):
        for key in ("earliest", "latest"):
            with self.subTest(key):
                line = "earliest = -200\n" if key == "earliest" else "latest = -150\n"
                f = self.mutated(line, "")
                self.assert_fails_naming(f, "1-enoch.toml", key)

    def test_witness_year_zero(self):
        self.fails(self.mutated("latest = -150", "latest = 0"), "year")

    def test_witness_dates_reversed(self):
        self.fails(self.mutated("earliest = -200", "earliest = -100"), "earliest")

    def test_entries_without_citations(self):
        for label, old in (
            ("provenance", 'citations = [{ source = "src-b", locator = "p. 4" }]\n'),
            ("witness", 'citations = [{ source = "src-b", locator = "p. 5" }]\n'),
            ("holder", 'citations = [{ source = "src-a", locator = "p. 6" }]\n'),
            ("event", 'citations = [{ source = "src-b", locator = "p. 7" }]\n'),
        ):
            for kind, new in (("missing key", ""), ("empty list", "citations = []\n")):
                with self.subTest(f"{label} {kind}"):
                    self.assert_fails_naming(self.mutated(old, new), "1-enoch.toml", "citation")

    def test_excerpt_without_citations(self):
        old = 'citations = [{ source = "src-b", locator = "p. 3" }]\n'
        for kind, new in (("missing key", ""), ("empty list", "citations = []\n")):
            with self.subTest(kind):
                f = described_files()
                mutate(f, DPATH, old, new)
                self.assert_fails_naming(f, "lost-gospel.toml", "citation")

    def test_books_missing_for_non_described(self):
        self.fails(self.mutated('books = ["1En"]\n', ""), "books")

    def test_books_empty_for_non_described(self):
        self.fails(self.mutated('books = ["1En"]', "books = []"), "books")

    def test_books_forbidden_on_described(self):
        f = described_files()
        mutate(f, DPATH, 'canon = "described"', 'canon = "described"\nbooks = ["1En"]')
        self.assert_fails_naming(f, "lost-gospel.toml", "books")

    def test_unknown_osis_id(self):
        self.fails(self.mutated('books = ["1En"]', 'books = ["Nope"]'), "Nope")

    def test_translations_missing_for_non_described(self):
        self.fails(self.mutated('[[translations]]\nledger = "charles-1enoch"\ncode = "LXX"\n', ""),
                   "translations")

    def test_translation_code_not_in_corpus(self):
        self.fails(self.mutated('code = "LXX"', 'code = "ZZZ"'), "ZZZ")

    def test_contents_missing_for_described(self):
        f = described_files()
        mutate(f, DPATH, 'contents = "Reported to contain sayings."\n', "")
        self.assert_fails_naming(f, "lost-gospel.toml", "contents")

    def test_excerpts_on_non_described(self):
        extra = '\n[[excerpts]]\ntext = "short"\ncitations = [{ source = "src-a", locator = "p. 9" }]\n'
        self.fails(self.mutated('[[events]]', extra + '\n[[events]]'), "excerpts")

    def test_excerpt_of_25_words(self):
        f = described_files()
        mutate(f, DPATH, "A short quoted line of five words", " ".join(["word"] * 25))
        self.assert_fails_naming(f, "lost-gospel.toml", "25 words")

    def test_event_unknown(self):
        self.fails(self.mutated('event = "ev-narr"', 'event = "ev-missing"'), "ev-missing")

    def test_citation_to_unknown_source(self):
        self.fails(self.mutated('source = "src-b", locator = "p. 5"', 'source = "src-zzz", locator = "p. 5"'),
                   "src-zzz")

    def test_file_name_must_equal_id(self):
        f = files_with(WORK, "works/other.toml")
        self.assert_fails_naming(f, "other.toml")

    def test_all_failures_reported_in_one_run(self):
        f = self.mutated('canon = "pseudepigrapha"', 'canon = "mystery"')
        mutate(f, PATH, 'status = "draft"', 'status = "final"')
        r = self.assert_fails_naming(f, "1-enoch.toml", "mystery", "final")


if __name__ == "__main__":
    unittest.main()
