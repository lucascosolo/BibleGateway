-- timeline.db — the Toledot artifact. Single source of truth for the schema: the builder
-- (build.py) executes this file, and the web app's tests build their fixtures from it.
-- See docs/plans/2026-10-06-timeline-backend.md for the contract.
--
-- Years: integers, negative = BCE, positive = CE, no year zero. Ranges are inclusive.
-- Every claim is cited (citations table); the builder refuses to write an uncited row.

PRAGMA foreign_keys = ON;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sources (
  source_id TEXT PRIMARY KEY,
  kind      TEXT NOT NULL CHECK (kind IN ('book','chapter','article','edition','museum','web')),
  author    TEXT,
  title     TEXT NOT NULL,
  container TEXT,
  publisher TEXT,
  year      INTEGER,
  url       TEXT,
  isbn      TEXT
);

CREATE TABLE eras (
  era_id     TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  start_year INTEGER NOT NULL CHECK (start_year <> 0),
  end_year   INTEGER NOT NULL CHECK (end_year <> 0),
  summary    TEXT NOT NULL,
  CHECK (start_year <= end_year)
);

CREATE TABLE events (
  event_id      TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  -- Three timelines, never merged onto one scale: when events happened, when texts were
  -- written, when collections were recognised as scripture.
  axis          TEXT NOT NULL CHECK (axis IN ('narrative','composition','canon')),
  category      TEXT NOT NULL CHECK (category IN ('biblical-narrative','political','composition','canon')),
  confidence    TEXT NOT NULL CHECK (confidence IN ('firm','contested','speculative')),
  status        TEXT NOT NULL CHECK (status IN ('draft','sources-located','claims-checked','expert-reviewed')),
  summary       TEXT NOT NULL,
  -- Composition axis only: an optional label for the part being dated ('Daniel 7–12',
  -- 'Priestly source'). The books are in event_books; the exact extent in verse_links.
  segment_label TEXT,
  -- DERIVED: the envelope of this event's positions. Never authored directly.
  earliest_year INTEGER NOT NULL CHECK (earliest_year <> 0),
  latest_year   INTEGER NOT NULL CHECK (latest_year <> 0),
  -- DERIVED: the envelope of the positions whose tradition is 'traditional', NULL when there are
  -- none. The year columns above exclude them unless they are the only positions.
  traditional_earliest INTEGER CHECK (traditional_earliest <> 0),
  traditional_latest   INTEGER CHECK (traditional_latest <> 0),
  CHECK (earliest_year <= latest_year),
  CHECK ((traditional_earliest IS NULL) = (traditional_latest IS NULL)),
  CHECK (traditional_earliest IS NULL OR traditional_earliest <= traditional_latest)
);
CREATE INDEX events_window_idx ON events (axis, earliest_year, latest_year);

-- The books a composition event dates (bible.db books.book_id). A join table, not a column:
-- a source document such as the Priestly source spans several books. The builder requires at
-- least one row for every composition event and none for any other.
CREATE TABLE event_books (
  event_id TEXT NOT NULL REFERENCES events,
  book_id  INTEGER NOT NULL,
  PRIMARY KEY (event_id, book_id)
);
CREATE INDEX event_books_book_idx ON event_books (book_id);

CREATE TABLE positions (
  position_id   TEXT PRIMARY KEY,           -- '<event id>/<position id>'
  event_id      TEXT NOT NULL REFERENCES events,
  ordinal       INTEGER NOT NULL,
  label         TEXT NOT NULL,
  tradition     TEXT NOT NULL,
  earliest_year INTEGER NOT NULL CHECK (earliest_year <> 0),
  latest_year   INTEGER NOT NULL CHECK (latest_year <> 0),
  summary       TEXT NOT NULL,
  held_by       TEXT,
  -- Whether the range dates the event itself or the writing of its story. Only 'event'
  -- positions enter the event's envelope (except on the composition axis).
  dates         TEXT NOT NULL DEFAULT 'event' CHECK (dates IN ('event','composition')),
  CHECK (earliest_year <= latest_year),
  UNIQUE (event_id, ordinal)
);

CREATE TABLE arguments (
  argument_id TEXT PRIMARY KEY,             -- '<position id>/argument-<n>', stable per content
  position_id TEXT NOT NULL REFERENCES positions,
  ordinal     INTEGER NOT NULL,
  stance      TEXT NOT NULL CHECK (stance IN ('for','against')),
  text        TEXT NOT NULL,
  UNIQUE (position_id, ordinal)
);

CREATE TABLE artifacts (
  artifact_id      TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  -- 'literary-text' is a work outside the Bible (a passage of Josephus or Tacitus): `made` is
  -- its date of composition, and it has no findspot or holding institution.
  kind             TEXT NOT NULL CHECK (kind IN ('inscription','chronicle','relief','papyrus','ostracon','manuscript','seal','coin','site','literary-text')),
  status           TEXT NOT NULL CHECK (status IN ('draft','sources-located','claims-checked','expert-reviewed')),
  -- When the object itself was made, when that is established. NULL rather than a guess: a
  -- chronicle copy can record 605-594 BCE while its own date of writing is unknown.
  made_earliest    INTEGER CHECK (made_earliest <> 0),
  made_latest      INTEGER CHECK (made_latest <> 0),
  language         TEXT NOT NULL,
  summary          TEXT NOT NULL,
  discovered_year  INTEGER,
  discovered_place TEXT,
  institution      TEXT,
  accession        TEXT,
  CHECK ((made_earliest IS NULL) = (made_latest IS NULL)),
  CHECK (made_earliest IS NULL OR made_earliest <= made_latest)
);

CREATE TABLE attestations (
  attestation_id TEXT PRIMARY KEY,          -- '<event id>@<artifact id>' 
  artifact_id    TEXT NOT NULL REFERENCES artifacts,
  event_id       TEXT NOT NULL REFERENCES events,
  relation       TEXT NOT NULL CHECK (relation IN ('corroborates','partially-corroborates','consistent','silent','in-tension')),
  note           TEXT NOT NULL,
  UNIQUE (artifact_id, event_id)
);
CREATE INDEX attestations_event_idx ON attestations (event_id);

CREATE TABLE issues (
  issue_id TEXT PRIMARY KEY,
  kind     TEXT NOT NULL CHECK (kind IN ('chronology','textual','historical','internal')),
  title    TEXT NOT NULL,
  summary  TEXT NOT NULL,
  status   TEXT NOT NULL CHECK (status IN ('draft','sources-located','claims-checked','expert-reviewed'))
);

CREATE TABLE issue_views (
  view_id  TEXT PRIMARY KEY,                -- '<issue id>/view-<n>', stable per content
  issue_id TEXT NOT NULL REFERENCES issues,
  ordinal  INTEGER NOT NULL,
  label    TEXT NOT NULL,
  text     TEXT NOT NULL,
  UNIQUE (issue_id, ordinal)
);

-- People named in the Bible, and the evidence outside it for their existence.
CREATE TABLE persons (
  person_id     TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  also_known_as TEXT,                       -- JSON array of strings, or NULL
  role          TEXT NOT NULL,
  summary       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('draft','sources-located','claims-checked','expert-reviewed')),
  lived_earliest INTEGER CHECK (lived_earliest <> 0),
  lived_latest   INTEGER CHECK (lived_latest <> 0),
  -- DERIVED from person_attestations, never authored: the strongest relation, in-tension
  -- excluded; 'none' when there are no attestations at all.
  evidence      TEXT NOT NULL CHECK (evidence IN ('corroborates','partially-corroborates','consistent','silent','none')),
  has_tension   INTEGER NOT NULL CHECK (has_tension IN (0, 1)),
  CHECK ((lived_earliest IS NULL) = (lived_latest IS NULL)),
  CHECK (lived_earliest IS NULL OR lived_earliest <= lived_latest)
);

CREATE TABLE person_attestations (
  attestation_id TEXT PRIMARY KEY,          -- '<person id>@<artifact id>'
  person_id      TEXT NOT NULL REFERENCES persons,
  artifact_id    TEXT NOT NULL REFERENCES artifacts,
  relation       TEXT NOT NULL CHECK (relation IN ('corroborates','partially-corroborates','consistent','silent','in-tension')),
  note           TEXT NOT NULL,
  UNIQUE (person_id, artifact_id)
);
CREATE INDEX person_attestations_artifact_idx ON person_attestations (artifact_id);

CREATE TABLE person_events (
  person_id TEXT NOT NULL REFERENCES persons,
  event_id  TEXT NOT NULL REFERENCES events,
  PRIMARY KEY (person_id, event_id)
);

CREATE TABLE issue_persons (
  issue_id  TEXT NOT NULL REFERENCES issues,
  person_id TEXT NOT NULL REFERENCES persons,
  PRIMARY KEY (issue_id, person_id)
);

CREATE TABLE issue_events (
  issue_id TEXT NOT NULL REFERENCES issues,
  event_id TEXT NOT NULL REFERENCES events,
  PRIMARY KEY (issue_id, event_id)
);

-- Polymorphic by design: links and citations attach to several kinds of row. The builder
-- validates every subject exists; SQLite cannot express that as a foreign key.
CREATE TABLE verse_links (
  link_id        INTEGER PRIMARY KEY,
  subject_kind   TEXT NOT NULL CHECK (subject_kind IN ('event','argument','artifact','issue','person')),
  subject_id     TEXT NOT NULL,
  start_verse_id INTEGER NOT NULL,
  end_verse_id   INTEGER NOT NULL,
  link_type      TEXT NOT NULL CHECK (link_type IN ('describes','alludes','background','dates','names')),
  note           TEXT,
  CHECK (start_verse_id <= end_verse_id)
);
CREATE INDEX verse_links_range_idx ON verse_links (start_verse_id, end_verse_id);
CREATE INDEX verse_links_subject_idx ON verse_links (subject_kind, subject_id);

CREATE TABLE citations (
  citation_id  INTEGER PRIMARY KEY,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('era','event','position','argument','artifact','attestation','issue','issue_view','person','person_attestation')),
  subject_id   TEXT NOT NULL,
  source_id    TEXT NOT NULL REFERENCES sources,
  locator      TEXT,
  ordinal      INTEGER NOT NULL
);
CREATE INDEX citations_subject_idx ON citations (subject_kind, subject_id);

-- Investigations: one passage's witnesses (what is directly observable), the English editions
-- that follow each, the explanations offered for the difference, and what argues against them.
-- Own citation and verse tables, so a passage study never borrows an issue's subject kinds.
CREATE TABLE investigations (
  investigation_id TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  summary          TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('draft','sources-located','claims-checked','expert-reviewed'))
);

CREATE TABLE investigation_verses (
  investigation_id TEXT NOT NULL REFERENCES investigations,
  start_verse_id   INTEGER NOT NULL,
  end_verse_id     INTEGER NOT NULL,
  CHECK (start_verse_id <= end_verse_id)
);
CREATE INDEX investigation_verses_range_idx ON investigation_verses (start_verse_id, end_verse_id);

CREATE TABLE investigation_witnesses (
  witness_id       TEXT PRIMARY KEY,        -- '<investigation id>/witness-<n>'
  investigation_id TEXT NOT NULL REFERENCES investigations,
  ordinal          INTEGER NOT NULL,
  siglum           TEXT NOT NULL,
  name             TEXT NOT NULL,
  reading          TEXT NOT NULL,
  translation      TEXT NOT NULL,
  language         TEXT NOT NULL,
  note             TEXT,
  UNIQUE (investigation_id, siglum)
);

CREATE TABLE investigation_editions (
  investigation_id TEXT NOT NULL REFERENCES investigations,
  code             TEXT NOT NULL,
  follows          TEXT NOT NULL,
  ordinal          INTEGER NOT NULL,
  PRIMARY KEY (investigation_id, code),
  FOREIGN KEY (investigation_id, follows) REFERENCES investigation_witnesses (investigation_id, siglum)
);

CREATE TABLE investigation_differences (
  difference_id    TEXT PRIMARY KEY,        -- '<investigation id>/difference-<n>'
  investigation_id TEXT NOT NULL REFERENCES investigations,
  ordinal          INTEGER NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('textual','lexical','grammatical','stylistic','interpretive','editorial')),
  text             TEXT NOT NULL,
  held_by          TEXT
);

CREATE TABLE investigation_challenges (
  challenge_id     TEXT PRIMARY KEY,        -- '<investigation id>/challenge-<n>'
  investigation_id TEXT NOT NULL REFERENCES investigations,
  ordinal          INTEGER NOT NULL,
  text             TEXT NOT NULL
);

CREATE TABLE investigation_citations (
  citation_id      INTEGER PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations,
  subject_kind     TEXT NOT NULL CHECK (subject_kind IN ('witness','difference','challenge')),
  subject_id       TEXT NOT NULL,
  source_id        TEXT NOT NULL REFERENCES sources,
  locator          TEXT,
  ordinal          INTEGER NOT NULL
);
CREATE INDEX investigation_citations_subject_idx ON investigation_citations (subject_kind, subject_id);

-- Works: one record per text outside the Hebrew and Protestant canons (docs/plans/2026-10-09-
-- outside-books.md). Own citation and verse tables, as investigations have, so a timeline.db
-- built before works existed simply lacks them and the app reads it as having none.
CREATE TABLE works (
  work_id              TEXT PRIMARY KEY,
  title                TEXT NOT NULL,
  also_known_as        TEXT,                -- JSON array of strings, or NULL
  canon                TEXT NOT NULL CHECK (canon IN ('deuterocanon','pseudepigrapha','nt-apocrypha','apostolic','described')),
  status               TEXT NOT NULL CHECK (status IN ('draft','sources-located','claims-checked','expert-reviewed')),
  summary              TEXT NOT NULL,
  contents             TEXT,                -- what a described work (no printed text) contains
  original_language    TEXT NOT NULL,
  -- DERIVED from work_positions, as an event's envelope is: the scholarly positions, or the
  -- traditional ones only when they are all there is. NULL for an undated work.
  composed_earliest    INTEGER CHECK (composed_earliest <> 0),
  composed_latest      INTEGER CHECK (composed_latest <> 0),
  -- Why no filed source dates the work, and what is known (e.g. its earliest copy). Set exactly
  -- when there are no positions, so the page states the gap instead of drawing a span.
  composed_undated     TEXT CHECK (composed_undated <> ''),
  traditional_earliest INTEGER CHECK (traditional_earliest <> 0),
  traditional_latest   INTEGER CHECK (traditional_latest <> 0),
  CHECK (composed_earliest <= composed_latest),
  CHECK ((composed_earliest IS NULL) = (composed_latest IS NULL)),
  CHECK ((composed_undated IS NULL) = (composed_earliest IS NOT NULL)),
  CHECK ((traditional_earliest IS NULL) = (traditional_latest IS NULL))
);
-- The bible.db books that print the work (several for the Testaments and Ignatius); none for a
-- described work.
CREATE TABLE work_books (
  work_id TEXT NOT NULL REFERENCES works,
  book_id INTEGER NOT NULL,
  ordinal INTEGER NOT NULL,
  PRIMARY KEY (work_id, book_id)
);
CREATE INDEX work_books_book_idx ON work_books (book_id);
CREATE TABLE work_positions (
  position_id   TEXT PRIMARY KEY,           -- '<work id>/<position id>'
  work_id       TEXT NOT NULL REFERENCES works,
  ordinal       INTEGER NOT NULL,
  label         TEXT NOT NULL,
  tradition     TEXT NOT NULL CHECK (tradition IN ('critical','archaeological','chronological','traditional')),
  earliest_year INTEGER NOT NULL CHECK (earliest_year <> 0),
  latest_year   INTEGER NOT NULL CHECK (latest_year <> 0),
  summary       TEXT NOT NULL,
  held_by       TEXT,
  CHECK (earliest_year <= latest_year),
  UNIQUE (work_id, ordinal)
);
CREATE TABLE work_provenance (
  provenance_id TEXT PRIMARY KEY,           -- '<work id>/provenance-<n>'
  work_id       TEXT NOT NULL REFERENCES works,
  ordinal       INTEGER NOT NULL,
  place         TEXT NOT NULL,
  note          TEXT
);
CREATE TABLE work_witnesses (
  witness_id    TEXT PRIMARY KEY,           -- '<work id>/witness-<n>'
  work_id       TEXT NOT NULL REFERENCES works,
  ordinal       INTEGER NOT NULL,
  siglum        TEXT,
  name          TEXT NOT NULL,
  earliest_year INTEGER NOT NULL CHECK (earliest_year <> 0),
  latest_year   INTEGER NOT NULL CHECK (latest_year <> 0),
  language      TEXT NOT NULL,
  institution   TEXT,
  url           TEXT,
  note          TEXT,
  CHECK (earliest_year <= latest_year)
);
CREATE TABLE work_holders (
  holder_id TEXT PRIMARY KEY,               -- '<work id>/holder-<n>'
  work_id   TEXT NOT NULL REFERENCES works,
  ordinal   INTEGER NOT NULL,
  tradition TEXT NOT NULL,
  note      TEXT
);
CREATE TABLE work_translations (
  work_id TEXT NOT NULL REFERENCES works,
  ordinal INTEGER NOT NULL,
  ledger  TEXT NOT NULL,                    -- the id in docs/sources/outside-books.md
  code    TEXT,                             -- bible.db translations.code, when ingested
  note    TEXT,
  PRIMARY KEY (work_id, ordinal)
);
CREATE TABLE work_excerpts (
  excerpt_id TEXT PRIMARY KEY,              -- '<work id>/excerpt-<n>'
  work_id    TEXT NOT NULL REFERENCES works,
  ordinal    INTEGER NOT NULL,
  text       TEXT NOT NULL,
  note       TEXT
);
CREATE TABLE work_events (
  work_id  TEXT NOT NULL REFERENCES works,
  event_id TEXT NOT NULL REFERENCES events,
  ordinal  INTEGER NOT NULL,
  note     TEXT NOT NULL,
  PRIMARY KEY (work_id, event_id)
);
CREATE INDEX work_events_event_idx ON work_events (event_id);
CREATE TABLE work_verses (
  work_id        TEXT NOT NULL REFERENCES works,
  start_verse_id INTEGER NOT NULL,
  end_verse_id   INTEGER NOT NULL,
  link_type      TEXT NOT NULL CHECK (link_type IN ('describes','alludes','background','dates','names')),
  note           TEXT,
  CHECK (start_verse_id <= end_verse_id)
);
CREATE INDEX work_verses_range_idx ON work_verses (start_verse_id, end_verse_id);
CREATE TABLE work_citations (
  citation_id  INTEGER PRIMARY KEY,
  work_id      TEXT NOT NULL REFERENCES works,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('work','position','provenance','witness','holder','excerpt','event')),
  subject_id   TEXT NOT NULL,
  source_id    TEXT NOT NULL REFERENCES sources,
  locator      TEXT,
  ordinal      INTEGER NOT NULL
);
CREATE INDEX work_citations_subject_idx ON work_citations (subject_kind, subject_id);
