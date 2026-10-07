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
  status        TEXT NOT NULL CHECK (status IN ('draft','reviewed')),
  summary       TEXT NOT NULL,
  -- Composition axis only: an optional label for the part being dated ('Daniel 7–12',
  -- 'Priestly source'). The books are in event_books; the exact extent in verse_links.
  segment_label TEXT,
  -- DERIVED: the envelope of this event's positions. Never authored directly.
  earliest_year INTEGER NOT NULL CHECK (earliest_year <> 0),
  latest_year   INTEGER NOT NULL CHECK (latest_year <> 0),
  CHECK (earliest_year <= latest_year)
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
  kind             TEXT NOT NULL CHECK (kind IN ('inscription','chronicle','relief','papyrus','ostracon','manuscript','seal','coin','site')),
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
  status   TEXT NOT NULL CHECK (status IN ('draft','reviewed'))
);

CREATE TABLE issue_views (
  view_id  TEXT PRIMARY KEY,                -- '<issue id>/view-<n>', stable per content
  issue_id TEXT NOT NULL REFERENCES issues,
  ordinal  INTEGER NOT NULL,
  label    TEXT NOT NULL,
  text     TEXT NOT NULL,
  UNIQUE (issue_id, ordinal)
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
  subject_kind   TEXT NOT NULL CHECK (subject_kind IN ('event','argument','artifact','issue')),
  subject_id     TEXT NOT NULL,
  start_verse_id INTEGER NOT NULL,
  end_verse_id   INTEGER NOT NULL,
  link_type      TEXT NOT NULL CHECK (link_type IN ('describes','alludes','background','dates')),
  note           TEXT,
  CHECK (start_verse_id <= end_verse_id)
);
CREATE INDEX verse_links_range_idx ON verse_links (start_verse_id, end_verse_id);
CREATE INDEX verse_links_subject_idx ON verse_links (subject_kind, subject_id);

CREATE TABLE citations (
  citation_id  INTEGER PRIMARY KEY,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('era','event','position','argument','artifact','attestation','issue','issue_view')),
  subject_id   TEXT NOT NULL,
  source_id    TEXT NOT NULL REFERENCES sources,
  locator      TEXT,
  ordinal      INTEGER NOT NULL
);
CREATE INDEX citations_subject_idx ON citations (subject_kind, subject_id);
