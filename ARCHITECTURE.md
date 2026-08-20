# Jot — Technical Architecture & Product Blueprint

A scholarly Bible study dashboard: academic apparatus (dating, textual criticism, source
criticism, manuscript transmission) fused with a fast, personal, deeply interactive reader.

**Name.** *Jot*, from "not one jot or one tittle shall pass from the law" (Matt 5:18) — the
*jot* is the smallest letter (Hebrew *yod*), the Bible's own figure for textual precision down
to the character. In plain English, to *jot* is to make a quick note. Both halves of the product
in three letters. The wordmark is lowercase `jot` with the **dot on the "j" — literally a
tittle** — set in the accent color.

**Deploys to:** `bible.lucascosolo.com`
**Repo:** `git@github.com:lucascosolo/BibleGateway.git`

**Status:** design document; implementation in progress (Phase 1).

---

## 0. The three decisions everything else follows from

Before the stack discussion, three choices constrain the entire system. Get these wrong and
every feature fights you later.

### 0.1 The canonical verse identifier

Every feature in this app — annotations, cross-references, timeline anchors, maps, source
layers, variant apparatus — is a pointer at a piece of text. They must all point using the
*same* identifier, and that identifier must be independent of any translation.

Use a **integer-encoded OSIS reference**:

```
verse_id = (book_number * 1_000_000) + (chapter * 1_000) + verse
```

`Genesis 1:1` → `1_001_001`. `John 3:16` → `43_003_016`. Properties that matter:

- Sortable. `WHERE verse_id BETWEEN 43003001 AND 43003036` is a range scan on a b-tree index.
  Passage fetches become one index range, no joins.
- Stable across translations. The text of John 3:16 differs by translation; the *address* does not.
- Cheap. A 4-byte int in every annotation row, every cross-reference edge, every map pin.
- Carries a human-readable twin: keep `osis_ref TEXT` (`John.3.16`) alongside for URLs, debugging,
  and interop with external datasets (OpenBible, STEPBible, and MACULA all speak OSIS or
  a trivially-mappable variant).

**The versification problem is real and you must handle it on day one.** Psalm superscriptions are
verse 1 in the Hebrew and unnumbered in most English Bibles, shifting every subsequent verse.
3 John has 14 verses in some traditions and 15 in others. Joel, Malachi, and Romans 16 all have
known divergences. The LXX numbers Psalms differently from the MT entirely.

Solution: pick **one canonical versification scheme** (I recommend the KJV/`org` scheme, since
nearly every open dataset is already mapped to it), store all identifiers in that scheme, and
keep a `versification_map` table that translates to/from other schemes at the edges. Never let a
second scheme leak into the core tables.

```
versification_map(scheme, foreign_ref, canonical_verse_id)
```

The `@openbible/versification` / STEPBible mapping tables give you this data; do not hand-roll it.

**As built.** Both shipped translations (WEB, BSB) use `org`, so `versification_map` exists and is
correctly empty — there is nothing yet to map. What matters is that the emptiness is enforced
rather than assumed: `translations.versification` is recorded per text, and the ingest's validation
gate fails the build if any translation declares a scheme other than `org` without supplying map
rows. That is the guard that has to be in place *before* an MT or LXX text arrives, because the
failure mode it prevents is silent — the text still renders, the annotations still resolve, they
just point at the wrong verse.

### 0.2 Two independent time axes

The timeline requirement conflates two things that must be modeled separately:

| Axis | Question | Example (Exodus) |
|---|---|---|
| **Narrative time** | When do the described events occur? | ~1446 BCE (early date) or ~1250 BCE (late date) |
| **Compositional time** | When was this text written/redacted? | J/E strands 10th–8th c. BCE, P redaction 6th–5th c. BCE |

A user dragging the slider to 600 BCE should see *Jeremiah preaching* (narrative) **and**
*the Deuteronomistic History being compiled* (compositional) — these are different overlays over
the same slider. Model them as two separate tables, and make the timeline a mode toggle, not a
merged mess.

### 0.3 Dating is contested, so store ranges and schools — never a scalar

There is no single "date of Isaiah." There is a traditional/confessional position (single 8th-century
author) and a critical consensus (Proto/Deutero/Trito-Isaiah, 8th through 6th centuries). If you
store `year: -700` you have silently taken a theological side and made the app useless to half its
audience and untrustworthy to the other half.

Store every date as `(earliest, latest, central_estimate, confidence, scholarly_tradition, citation)`
and let the user pick which tradition renders. This single decision is what separates a credible
scholarly tool from a devotional app with a chart in it.

---

## 1. Tech stack

### 1.1 Recommendation summary

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19** | RSC lets the 31,102-verse corpus stream from the server without shipping it to the client; route handlers give you a colocated API |
| Language | **TypeScript, strict** | Non-negotiable given the number of ID types flying around; brand your IDs |
| Server state | **TanStack Query v5** | Passage/cross-ref/manuscript data is cached, deduped, invalidated — the "same passage in five views" problem is a cache-key problem |
| Annotation state | **Jotai (`atomFamily` keyed by `verse_id`)** | The crux of the unified-reader requirement — see §4.3 |
| UI/preference state | **Zustand** (single store, persisted) | Layer toggles, reader theme, active tradition. Flat, boring, serializable |
| Styling | **Tailwind v4 + CSS custom properties** | Layer visibility toggles become CSS variable flips, not re-renders |
| Primitives | **Radix UI** | Accessible popovers/tooltips/dialogs; the tooltip-reader needs real focus management |
| Charts | **Visx** (or Observable Plot) | Language pie charts, manuscript timelines — you need SVG you control, not a chart-in-a-box |
| Graph viz | **Sigma.js + graphology** (WebGL) | Cross-reference network has ~340k edges; D3-force dies, Sigma renders |
| Virtualization | **TanStack Virtual** | Whole-book continuous scroll |
| Maps | **MapLibre GL + deck.gl** | Open, no vendor lock; deck.gl for journey arcs and density layers |
| Database | **PostgreSQL 16** (Neon or Supabase) | See §1.2 |
| Vector search | **pgvector** | Semantic search stays in the same DB — no second system to sync |
| Full-text | **Postgres FTS** (start) → **Typesense** (if needed) | FTS handles concordance work fine at this corpus size |
| ORM | **Drizzle** | SQL-shaped, first-class raw SQL escape hatch, good migrations. Prisma's query planner fights recursive CTEs |
| Auth | **Auth.js** or Supabase Auth | Whichever the DB host gives you free |
| Realtime | **Supabase Realtime** or a thin WS route | Only needed for multi-device sync; defer to Phase 2 |
| Deploy | **Vercel** (app) + **Neon/Supabase** (DB) | Edge caching for the immutable text corpus is a big win |

### 1.2 Relational vs. graph database — the honest answer

**Use Postgres. Do not start with a graph database.** Reasoning:

The cross-reference dataset is large but *shallow*. OpenBible.info ships ~340,000 weighted verse
pairs; the Treasury of Scripture Knowledge is ~570,000. That is a mid-size table, not big data.
The queries you actually need are:

1. "All references touching verse X" — a two-column indexed lookup. Postgres: <1ms.
2. "Heat score per verse" — a materialized view of `COUNT(*) GROUP BY target_verse_id`. Precomputed.
3. "Neighborhood of X to depth 2" — a `WITH RECURSIVE` CTE with a depth guard. Postgres handles
   this fine; depth 2 from a hot verse is a few thousand edges.

You only *need* a graph engine for unbounded traversal, shortest-path, and centrality algorithms.
Two of those you can precompute offline (PageRank over the reference graph, run nightly in Python
with `networkx`/`graph-tool`, write scores back to a Postgres column). The third — interactive
multi-hop exploration — is better served by loading a bounded subgraph into **graphology in the
browser** and traversing client-side, which is instant and needs no server round-trip.

If you later find you genuinely need server-side path queries at depth 4+, add **Apache AGE**
(openCypher inside Postgres) or a read-replica Neo4j fed by CDC. Adding it later is easy because
the edge table is already the source of truth. Starting with it means running two databases and
a sync pipeline before you have a single user.

### 1.3 State management — why two libraries, not one

This is the architecturally load-bearing choice, so it deserves justification.

The requirement: *highlighting a verse in a hover tooltip must instantly re-render that verse in
the side panel, the timeline modal, and the full reader — all of which may be mounted simultaneously.*

A single Zustand/Redux store technically works but performs badly here. Every annotation write
notifies every subscriber; with a 176-verse Psalm 119 open plus a panel plus a tooltip, you either
re-render the world or you write selector code so fine-grained it becomes unmaintainable.

**Jotai's `atomFamily` maps perfectly onto the domain.** One atom per verse:

```ts
const annotationsAtom = atomFamily((verseId: VerseId) =>
  atom<Annotation[]>([])
)
```

Every `<Verse>` component anywhere in the tree subscribes to `annotationsAtom(43003016)`. Writing
a highlight on John 3:16 re-renders exactly the components displaying John 3:16 — however many
views they are spread across — and nothing else. The "universal persistence" requirement becomes
a property of the state topology rather than something you engineer per-view.

TanStack Query owns the *server* half: passage text, cross-references, manuscript data. These are
immutable-ish and cache-keyed by range. Jotai owns the *mutable user overlay*. The two are wired
together by a sync layer (§4.4) that hydrates atoms from query results and pushes optimistic
mutations back.

Zustand holds what is neither: `{ showVerseNumbers, showHighlights, showNotes, showCrossRefs,
showHistorical, theme, tradition, activeTranslation }`. Persisted to localStorage, read by the
renderer as a single object.

---

## 2. Data sourcing strategy

### 2.1 The NRSV problem — read this before planning around it

**The NRSV is under active copyright** (National Council of Churches; rights administered via
Friendship Press, with the NRSVue released 2021). It is *not* freely available, there is no open
API, and you cannot legally scrape and redistribute it. Licensing requires a written agreement
and, for a commercial or public web product, typically a royalty or fee. American Bible Society's
`api.bible` carries many translations under license but NRSV availability is not guaranteed and
still requires your own agreement.

**Recommended path:** design the schema translation-agnostic from day one (which §3 does), build
and launch on open texts, and pursue NRSV licensing in parallel as a business task. Dropping NRSV
in later is a data-ingest job, not a refactor.

Open texts that are genuinely good and immediately usable:

| Text | License | Notes |
|---|---|---|
| **World English Bible (WEB)** | Public domain | Modern English, complete with Apocrypha/Deuterocanon — matters for an NRSV-shaped app |
| **Berean Standard Bible (BSB)** | Public domain (dedicated) | Excellent modern translation, actively maintained, word-aligned data available |
| **ASV / KJV** | Public domain | Needed anyway for comparison and for legacy dataset alignment |
| **unfoldingWord ULT/UST** | CC BY-SA 4.0 | Literal + simplified pair, fully word-aligned to originals — extremely useful for the Strong's layer |
| **LEB (Lexham English Bible)** | Free with attribution | Good scholarly register |

The Deuterocanon point is worth flagging: an NRSV-oriented scholarly tool is expected to include
the Apocrypha. WEB and the Brenton LXX cover this; many open datasets do not. Check Apocrypha
coverage before committing to any dataset.

### 2.2 Original-language and morphology data

| Dataset | License | What it gives you |
|---|---|---|
| **STEPBible TAHOT / TAGNT** (Tyndale House) | CC BY 4.0 | Hebrew + Greek with Strong's, morphology, lemmas, glosses. The single best starting point |
| **Open Scriptures Hebrew Bible (OSHB)** | CC BY 4.0 | Morphologically tagged WLC (Westminster Leningrad Codex) |
| **SBLGNT** | Free for non-commercial-ish use; check terms | Critical Greek NT with apparatus |
| **Nestle 1904 / Tischendorf 8th** | Public domain | Safe fallback Greek text with apparatus |
| **MACULA Hebrew & Greek** (Clear Bible) | CC BY 4.0 | Syntax trees, semantic domains, participant reference. Powers advanced features later |
| **Brenton LXX / CCAT LXX** | Public domain | Septuagint for MT-vs-LXX comparison |

These give you the language-composition pie charts *for free and accurately* — you compute
Hebrew/Aramaic/Greek percentages from actual tagged word counts rather than hardcoding a
guess. (Note: the Aramaic portions are precisely delimited — Dan 2:4b–7:28, Ezra 4:8–6:18,
7:12–26, Jer 10:11, Gen 31:47 — so the chart can be exact.)

### 2.3 Cross-references

| Dataset | License | Size |
|---|---|---|
| **OpenBible.info Cross References** | CC BY | ~340k pairs, community-voted with a `votes` weight column — the weight is what drives your heatmap |
| **Treasury of Scripture Knowledge** | Public domain | ~570k, denser but noisier and 19th-century in perspective |
| **OT-in-NT quotations/allusions** (e.g. the NA28 loci citati, or open equivalents) | mixed | For the intertextuality layer — check terms per source |

Ingest both OpenBible and TSK into the same edge table with a `source` discriminator so users can
filter. OpenBible's vote count is the better heat signal; TSK gives coverage.

### 2.4 Manuscript and textual-criticism metadata

This is the hardest data to source and where most competitors are thin — which is also the
opportunity.

- **INTF Liste / NT.VMR** (Münster) — the authoritative register of Greek NT manuscripts
  (~5,800 catalogued: papyri, majuscules, minuscules, lectionaries) with date, content, and
  repository. Has an API. Licensing for bulk reuse needs confirmation with INTF.
- **CNTR (Center for New Testament Restoration)** — free transcriptions of early NT manuscripts,
  excellent for variant comparison.
- **CSNTM** — high-res manuscript images (linkable; check embedding terms).
- **Leon Levy Dead Sea Scrolls Digital Library** — DSS images and metadata. Note: the *transcriptions*
  in the DJD volumes are copyrighted; imagery and metadata are more permissive. Link out rather
  than redistribute.
- **Wikidata** — surprisingly good structured coverage of major codices (Sinaiticus, Vaticanus,
  Alexandrinus, Leningradensis, Aleppo) with dates, holdings, and Q-IDs you can dereference.

For a v1, a **curated table of ~150 significant manuscripts** hand-built from public scholarship
delivers 95% of the user value of a full Liste import, and you can build it in a week. Do that first.

### 2.5 Geography, events, and dating

- **OpenBible.info Bible Geocoding** (CC BY) — lat/long for biblical places, keyed to verses.
- **Pleiades** (CC BY) — ancient-world gazetteer, stable URIs, great for linking out.
- **Wikidata / Chronicon** — historical events, rulers, empires for the non-biblical timeline track.
- **Dating and authorship: no clean open dataset exists.** This is editorial content you build.
  Budget for it: a `book_dating` table with ~66–81 rows × 2–3 traditions each, every row citing a
  named scholarly source. It's a few days of careful work and it is the intellectual spine of the
  timeline feature. Do not let an LLM generate it unsourced.

### 2.6 Ingest pipeline

Keep this entirely offline. A `packages/ingest` workspace of Python or TS scripts that read raw
datasets, normalize to canonical verse IDs, and emit SQL/COPY files. The production app never
parses USFM or OSIS XML at runtime.

```
raw/ (gitignored, checksummed)  →  normalize  →  validate  →  seed/*.sql  →  psql COPY
```

Validation gate: every emitted `verse_id` must exist in the `verses` table, every range must be
well-formed, referential integrity enforced before load. Ingest bugs that reach production are
brutal to unwind because user annotations will already be anchored to the bad IDs.

---

## 3. Database schema

Postgres. Types shown loosely; `verse_id` is `INTEGER` throughout.

### 3.1 Canonical text (immutable, shared by all users)

```sql
-- The address space. ~31,102 rows (+ deuterocanon). Never changes after seed.
CREATE TABLE verses (
  verse_id      INTEGER PRIMARY KEY,        -- BBCCCVVV
  book_id       SMALLINT NOT NULL REFERENCES books(book_id),
  chapter       SMALLINT NOT NULL,
  verse         SMALLINT NOT NULL,
  osis_ref      TEXT NOT NULL UNIQUE,       -- 'John.3.16'
  canon_order   INTEGER NOT NULL            -- reading order; = verse_id in practice
);

CREATE TABLE books (
  book_id       SMALLINT PRIMARY KEY,
  osis_id       TEXT NOT NULL UNIQUE,       -- 'John'
  name          TEXT NOT NULL,
  abbreviation  TEXT NOT NULL,
  testament     TEXT NOT NULL,              -- 'OT' | 'NT' | 'DC'
  canon_section TEXT,                       -- 'Torah','Prophets','Gospels','Pauline',...
  genre         TEXT[],                     -- ['law','narrative'], ['epistle'], ...
  chapter_count SMALLINT NOT NULL
);

CREATE TABLE translations (
  translation_id  SMALLINT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,     -- 'NRSVUE','WEB','BSB'
  name            TEXT NOT NULL,
  language         TEXT NOT NULL,
  license          TEXT NOT NULL,
  is_licensed      BOOLEAN NOT NULL DEFAULT TRUE,  -- gate rendering on entitlement
  copyright_notice TEXT NOT NULL,           -- must be displayed; licensors audit this
  versification    TEXT NOT NULL DEFAULT 'org'
);

-- The actual text. ~31k rows per translation.
CREATE TABLE verse_texts (
  translation_id  SMALLINT NOT NULL REFERENCES translations,
  verse_id        INTEGER  NOT NULL REFERENCES verses,
  text            TEXT     NOT NULL,        -- plain text, normalized (NFC), no markup
  formatting      JSONB,                    -- poetry indents, speaker attribution, red-letter
  PRIMARY KEY (translation_id, verse_id)
);
CREATE INDEX ON verse_texts (translation_id, verse_id);  -- range scans
```

**Critical detail:** `text` is stored *plain and normalized* (Unicode NFC, no HTML, no footnote
markers inline). Formatting lives in the sidecar `formatting` JSONB. This is what makes character
offsets in annotations stable and meaningful — if the stored text ever contains markup, offsets
become dependent on your rendering pipeline and every renderer change corrupts every highlight.

### 3.2 Original language (word-level)

```sql
CREATE TABLE original_words (
  word_id       BIGSERIAL PRIMARY KEY,
  verse_id      INTEGER NOT NULL REFERENCES verses,
  position      SMALLINT NOT NULL,          -- word order within verse
  surface       TEXT NOT NULL,              -- as written
  lemma         TEXT NOT NULL,
  strongs       TEXT,                       -- 'H430', 'G2316'
  morph         TEXT,                       -- morphology code
  language      TEXT NOT NULL,              -- 'hbo' | 'arc' | 'grc'
  gloss         TEXT,
  UNIQUE (verse_id, position)
);
CREATE INDEX ON original_words (strongs);
CREATE INDEX ON original_words (lemma);
CREATE INDEX ON original_words (language);   -- powers the language pie chart
```

The language pie chart is now literally `SELECT language, COUNT(*) FROM original_words
[WHERE verse_id BETWEEN ...] GROUP BY language`. Precompute per-book into a materialized view.

Word-level alignment to translations (from unfoldingWord/BSB alignment data) goes in
`word_alignments(translation_id, verse_id, char_start, char_end, word_id)` — this is what
eventually lets a highlight in one translation map onto another.

### 3.3 Annotations — the universal anchoring model

This is the schema's most important table. Requirements: (a) anchor to verse IDs so it renders
in every view; (b) support sub-verse character ranges; (c) survive translation switching;
(d) support multi-verse spans.

```sql
CREATE TABLE annotations (
  annotation_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users ON DELETE CASCADE,
  kind            TEXT NOT NULL,            -- 'highlight' | 'note' | 'bookmark' | 'tag'

  -- ANCHOR (the part that makes universal rendering work)
  start_verse_id  INTEGER NOT NULL REFERENCES verses,
  end_verse_id    INTEGER NOT NULL REFERENCES verses,
  start_offset    SMALLINT,                 -- NULL => anchor to whole verse
  end_offset      SMALLINT,
  translation_id  SMALLINT REFERENCES translations,  -- translation offsets were taken in
  quoted_text     TEXT,                     -- verbatim selection, for re-anchoring & display

  -- PAYLOAD
  color           TEXT,                     -- highlight color token
  body            TEXT,                     -- note markdown
  tags            TEXT[] DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,              -- soft delete for sync
  CHECK (end_verse_id >= start_verse_id)
);

-- THE index that makes "any view, any passage" fast:
CREATE INDEX annotations_user_range_idx
  ON annotations (user_id, start_verse_id, end_verse_id)
  WHERE deleted_at IS NULL;
```

**How a view fetches annotations.** Every view — tooltip, panel, modal, reader — asks the identical
question, because every view knows only a verse range:

```sql
SELECT * FROM annotations
WHERE user_id = $1
  AND deleted_at IS NULL
  AND start_verse_id <= $range_end
  AND end_verse_id   >= $range_start;
```

One query shape, one index, one cache key. A hover tooltip showing a single verse and a reader
showing all of Romans run *the same code path* with different bounds. That uniformity is the
whole ballgame for the unified-engine requirement.

**Cross-translation resilience.** `start_offset`/`end_offset` are only valid within
`translation_id`. When rendering in a different translation:

1. If `word_alignments` covers both translations, map the range through the aligned original words.
   Precise, and the right long-term answer.
2. Otherwise, fuzzy-match `quoted_text` against the target verse text (normalized Levenshtein
   over token windows). Good enough in practice — translations of the same verse share most content words.
3. If both fail, degrade to a **whole-verse highlight** with a subtle "approximate" affordance.

Never silently render a wrong range. Degrading to verse-level is honest and users accept it.

**Note on offsets vs. word indices.** An alternative anchor is `(start_word_index, end_word_index)`
into the original-language word list, which is translation-independent by construction. It's more
robust but requires alignment data for every translation and makes selection handling harder.
Recommendation: ship character offsets + `quoted_text` in Phase 1, add word-index anchors as a
second nullable anchor column in Phase 3 once alignment data is loaded, backfill, and prefer it
when present.

### 3.4 Cross-references

```sql
CREATE TABLE cross_references (
  xref_id        BIGSERIAL PRIMARY KEY,
  from_verse_id  INTEGER NOT NULL REFERENCES verses,
  to_start_verse INTEGER NOT NULL REFERENCES verses,
  to_end_verse   INTEGER NOT NULL REFERENCES verses,
  votes          INTEGER NOT NULL DEFAULT 0,   -- OpenBible confidence signal
  source         TEXT NOT NULL,                -- 'openbible' | 'tsk' | 'curated'
  relation       TEXT                          -- 'quotation'|'allusion'|'parallel'|'thematic'|'fulfillment'
);
CREATE INDEX ON cross_references (from_verse_id);
CREATE INDEX ON cross_references (to_start_verse, to_end_verse);

-- Heatmap fuel. Refresh nightly.
CREATE MATERIALIZED VIEW verse_reference_heat AS
SELECT v.verse_id,
       COUNT(*)                                        AS inbound_count,
       SUM(GREATEST(x.votes, 1))                       AS weighted_score,
       NTILE(5) OVER (ORDER BY COUNT(*))               AS heat_bucket
FROM verses v
JOIN cross_references x
  ON v.verse_id BETWEEN x.to_start_verse AND x.to_end_verse
GROUP BY v.verse_id;
CREATE UNIQUE INDEX ON verse_reference_heat (verse_id);
```

`heat_bucket` (1–5) is what the renderer consumes — a small integer per verse, trivially joined
into the passage payload, rendered as a CSS class. No client-side computation.

Add a `pagerank REAL` column populated by an offline job for "foundational passage" ranking, which
is a meaningfully different and more interesting signal than raw inbound count.

### 3.5 Timeline, dating, and events

```sql
-- COMPOSITIONAL axis. Multiple rows per book — one per scholarly tradition.
CREATE TABLE book_datings (
  dating_id      SERIAL PRIMARY KEY,
  book_id        SMALLINT NOT NULL REFERENCES books,
  tradition      TEXT NOT NULL,        -- 'critical' | 'traditional' | 'minimalist'
  earliest_year  INTEGER NOT NULL,     -- negative = BCE
  latest_year    INTEGER NOT NULL,
  central_year   INTEGER NOT NULL,
  confidence     TEXT NOT NULL,        -- 'high' | 'contested' | 'speculative'
  segment_label  TEXT,                 -- 'Proto-Isaiah', 'P source', 'Deutero-Pauline'
  covers_verses  int4range,            -- for composite books
  summary        TEXT NOT NULL,
  citation       TEXT NOT NULL,        -- REQUIRED. no uncited dating rows.
  UNIQUE (book_id, tradition, segment_label)
);

-- Book metadata cards (hover/click targets on the timeline)
CREATE TABLE book_profiles (
  book_id           SMALLINT PRIMARY KEY REFERENCES books,
  tradition         TEXT NOT NULL,
  attributed_author TEXT,              -- traditional attribution
  probable_authors  TEXT,              -- critical view
  provenance        TEXT,              -- place of composition
  audience          TEXT,
  occasion          TEXT,              -- why it was written
  purpose           TEXT,
  literary_genre    TEXT,
  key_themes        TEXT[],
  scholarly_notes   TEXT,
  citations         JSONB NOT NULL
);

-- NARRATIVE axis + world history
CREATE TABLE historical_events (
  event_id        SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL,       -- 'biblical-narrative'|'political'|'archaeological'|'canon-formation'
  earliest_year   INTEGER NOT NULL,
  latest_year     INTEGER NOT NULL,
  central_year    INTEGER,
  is_disputed     BOOLEAN NOT NULL DEFAULT FALSE,
  description     TEXT NOT NULL,
  place_id        INTEGER REFERENCES places,
  citations       JSONB
);

CREATE TABLE event_verse_links (
  event_id  INTEGER NOT NULL REFERENCES historical_events,
  start_verse_id INTEGER NOT NULL REFERENCES verses,
  end_verse_id   INTEGER NOT NULL REFERENCES verses,
  link_type TEXT NOT NULL,             -- 'describes' | 'alludes' | 'background'
  PRIMARY KEY (event_id, start_verse_id, end_verse_id)
);

CREATE TABLE eras (
  era_id     SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,            -- 'United Monarchy', 'Babylonian Exile', 'Second Temple'
  start_year INTEGER NOT NULL,
  end_year   INTEGER NOT NULL,
  color      TEXT NOT NULL,
  summary    TEXT NOT NULL
);
```

Every dating and event row carries a citation. Enforce it with `NOT NULL`. This is the difference
between a tool a seminary student will use and one they'll dismiss in thirty seconds.

### 3.6 Manuscripts and variants

```sql
CREATE TABLE manuscripts (
  ms_id           SERIAL PRIMARY KEY,
  siglum          TEXT NOT NULL UNIQUE,     -- 'P46', '01 (Sinaiticus)', '4QIsa-a', 'B'
  common_name     TEXT,
  ms_type         TEXT NOT NULL,            -- 'papyrus'|'majuscule'|'minuscule'|'lectionary'|'scroll'|'codex'
  text_family     TEXT,                     -- 'Alexandrian'|'Byzantine'|'Western'|'Caesarean'|'MT'|'LXX'|'SP'
  language        TEXT NOT NULL,
  earliest_year   INTEGER,
  latest_year     INTEGER,
  material        TEXT,                     -- 'papyrus'|'parchment'|'vellum'
  repository      TEXT,
  discovery_year  INTEGER,
  discovery_story TEXT,
  image_url       TEXT,                     -- external, link out
  external_ids    JSONB,                    -- {intf:'10001', wikidata:'Q131013'}
  significance    TEXT
);

CREATE TABLE manuscript_coverage (
  ms_id          INTEGER NOT NULL REFERENCES manuscripts,
  start_verse_id INTEGER NOT NULL,
  end_verse_id   INTEGER NOT NULL,
  completeness   TEXT,                      -- 'complete'|'partial'|'fragmentary'
  PRIMARY KEY (ms_id, start_verse_id, end_verse_id)
);

CREATE TABLE textual_variants (
  variant_id     SERIAL PRIMARY KEY,
  verse_id       INTEGER NOT NULL REFERENCES verses,
  word_start     SMALLINT,
  word_end       SMALLINT,
  significance   TEXT NOT NULL,             -- 'major'|'moderate'|'minor'|'orthographic'
  summary        TEXT NOT NULL,             -- plain-English explanation
  affects_meaning BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE variant_readings (
  reading_id     SERIAL PRIMARY KEY,
  variant_id     INTEGER NOT NULL REFERENCES textual_variants,
  reading_text   TEXT NOT NULL,             -- original language
  translation    TEXT,                      -- English rendering
  is_preferred   BOOLEAN NOT NULL DEFAULT FALSE,  -- adopted by modern critical texts
  witness_ms_ids INTEGER[],
  witness_note   TEXT
);
CREATE INDEX ON textual_variants (verse_id);
```

Queryable by verse range — which means the reader can show a variant marker inline using the
*same range-query pattern* as annotations and cross-references. Consistency here is what keeps
the renderer from sprouting special cases.

### 3.7 Source criticism layer

```sql
CREATE TABLE source_hypotheses (
  hypothesis_id SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,   -- 'Documentary (JEDP)','Neo-Documentary','Supplementary',
                                 -- 'Two-Source (Markan priority + Q)','Farrer','Griesbach'
  scope         TEXT NOT NULL,   -- 'pentateuch' | 'synoptics' | 'isaiah' | 'pauline'
  description   TEXT NOT NULL,
  proponents    TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE source_assignments (
  assignment_id  BIGSERIAL PRIMARY KEY,
  hypothesis_id  INTEGER NOT NULL REFERENCES source_hypotheses,
  source_code    TEXT NOT NULL,   -- 'J','E','D','P','R','Q','Mk','M','L'
  start_verse_id INTEGER NOT NULL,
  end_verse_id   INTEGER NOT NULL,
  confidence     TEXT NOT NULL,   -- 'consensus'|'majority'|'disputed'
  color          TEXT NOT NULL,
  note           TEXT
);
CREATE INDEX ON source_assignments (hypothesis_id, start_verse_id, end_verse_id);
```

Again: a range query keyed to verse IDs. Toggling the JEDP overlay is the same operation as
toggling highlights, structurally. **Presenting competing hypotheses side by side rather than
picking one** is both intellectually honest and a genuine product differentiator.

### 3.8 Places, users, sessions

```sql
CREATE TABLE places (
  place_id     SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  modern_name  TEXT,
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  precision    TEXT,               -- 'exact'|'approximate'|'disputed'|'unknown'
  pleiades_id  TEXT,
  description  TEXT
);
CREATE TABLE place_verse_mentions (
  place_id INTEGER NOT NULL REFERENCES places,
  verse_id INTEGER NOT NULL REFERENCES verses,
  PRIMARY KEY (place_id, verse_id)
);

CREATE TABLE users (
  user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT,
  preferences JSONB NOT NULL DEFAULT '{}',   -- layer toggles, tradition, translation
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reading_sessions (
  session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users ON DELETE CASCADE,
  verse_id    INTEGER NOT NULL,
  duration_ms INTEGER,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Enable **Row Level Security** on `annotations`, `users`, `reading_sessions` from the first
migration. Retrofitting RLS after launch is miserable.

### 3.9 Semantic search

```sql
CREATE TABLE verse_embeddings (
  verse_id       INTEGER NOT NULL REFERENCES verses,
  translation_id SMALLINT NOT NULL REFERENCES translations,
  embedding      vector(1536),
  PRIMARY KEY (verse_id, translation_id)
);
CREATE INDEX ON verse_embeddings USING hnsw (embedding vector_cosine_ops);
```

Embed at *pericope* granularity too (a second table with ranges) — single verses often lack
enough context for good semantic retrieval.

---

## 4. Component architecture

### 4.1 The organizing principle

There is exactly **one** component that turns verse IDs into rendered scripture:
`<PassageRenderer>`. Every surface in the app composes it. There is no second implementation, no
"simple" variant for tooltips. The tooltip and the immersive reader differ only in the props
passed and the CSS shell wrapped around them.

```
PassageRenderer(range, density, layers)
        ↑              ↑            ↑
   what to show   how compact   what overlays
```

Enforce this with a lint rule: nothing outside `PassageRenderer/` may import verse-text query
hooks. The moment a second renderer exists, universal persistence stops being free.

**As built**: `no-restricted-imports` in `apps/web/eslint.config.mjs` blocks the decoration
pipeline and direct `Verse` imports outside `components/passage/`, and `sync-and-build.sh` runs
eslint as an explicit build gate — `next build` does not run eslint, so for a while this rule was
documented and not actually enforced.

### 4.2 Component tree

```
<AppShell>
├── <Providers>                       QueryClientProvider · JotaiProvider · ThemeProvider
│   └── <AnnotationSyncBridge/>       invisible; wires TanStack Query ⇄ Jotai atoms (§4.4)
│
├── <CommandPalette/>                 ⌘K — jump to reference, search, toggle layers
├── <GlobalNav/>                      translation picker · tradition picker · layer toggles
│
├── <TimelineWorkspace>               route: /timeline
│   ├── <TimelineCanvas>              virtualized, zoomable (d3-zoom + canvas)
│   │   ├── <EraBands/>               background era coloring
│   │   ├── <AxisRuler/>              log-ish scale: dense recent, compressed antiquity
│   │   ├── <CompositionTrack/>       book_datings — ranges, not points
│   │   ├── <NarrativeTrack/>         historical_events (category='biblical-narrative')
│   │   ├── <WorldHistoryTrack/>      political / archaeological events
│   │   └── <ManuscriptTrack/>        manuscript witnesses over time
│   ├── <TimelineScrubber/>           the draggable slider
│   ├── <AxisModeToggle/>             composition ⇄ narrative
│   ├── <TraditionSelector/>          critical / traditional / minimalist
│   └── <BookMetadataCard>            hover → summary; click → full panel
│       ├── <DatingRangeBar/>         visualizes uncertainty as a bar, never a point
│       ├── <AuthorshipSection/>      attributed vs. probable, side by side
│       ├── <ContextSection/>         audience · occasion · purpose · provenance
│       ├── <CitationList/>
│       └── <PassageRenderer          ◄── SAME ENGINE, tooltip density
│              density="preview" range={openingVerses} />
│
├── <ReaderWorkspace>                 route: /read/[osisRef]
│   ├── <ReaderToolbar>
│   │   └── <LayerToggleGroup/>       verse numbers · highlights · notes · xrefs
│   │                                  · heat · variants · source-crit · clean mode
│   ├── <ReaderColumn>                TanStack Virtual over chapters
│   │   └── <PassageRenderer density="reader" range={chapterRange} />   ◄── SAME ENGINE
│   ├── <SelectionToolbar/>           floating: highlight colors · note · copy · deep-dive
│   └── <ContextSidebar>              tabbed, resizable
│       ├── <CrossRefPanel>
│       │   └── <PassageRenderer density="panel" range={xrefTarget} />  ◄── SAME ENGINE
│       ├── <NotesPanel/>
│       ├── <OriginalLanguagePanel/>  interlinear, Strong's, morphology
│       ├── <VariantPanel/>           readings + witnesses
│       └── <HistoricalPanel/>        events + places for the visible range
│
├── <DeepDiveOverlay>                 modal, route-addressable ?deepdive=John.3.16
│   ├── <ReferenceGraph/>             Sigma.js + graphology, WebGL
│   ├── <GraphControls/>              depth · min-votes · relation-type filter · layout
│   └── <NodePreviewPane>
│       └── <PassageRenderer density="panel" />                          ◄── SAME ENGINE
│
├── <InsightsWorkspace>               route: /insights
│   ├── <LanguageCompositionChart/>   Visx pie/donut — scope-aware (whole Bible ⇄ book)
│   ├── <ManuscriptTransmissionView/> witness timeline + family tree
│   ├── <VariantExplorer/>            side-by-side readings
│   └── <CanonFormationTimeline/>
│
├── <MapWorkspace>                    route: /atlas  (Phase 4)
│   └── <MapLibreCanvas/> + <JourneyLayer/> + <PlacePopover→PassageRenderer/>
│
└── <HoverPreviewPortal/>             global singleton; any verse ref anywhere in the app
    └── <PassageRenderer density="tooltip" />                            ◄── SAME ENGINE
```

Seven call sites. One engine.

### 4.3 Inside the engine

```
<PassageRenderer range density layers>
│
├─ usePassage(range, translationId)            TanStack Query → verse text + formatting
├─ useAnnotationsForRange(range)               Jotai atomFamily subscriptions
├─ useDecorations(range, layers)               xrefs · heat · variants · source-crit
├─ useLayerPrefs()                             Zustand
│
└─ <VerseList>
   └─ <Verse verseId>                          ← subscribes to annotationsAtom(verseId)
      ├─ <VerseNumber/>                        gated by layers.verseNumbers
      ├─ <HeatIndicator/>                      gated by layers.heat
      └─ <DecoratedText/>                      segment-splitting renderer
         └─ <TextSegment/>[]                   highlight · note-anchor · variant · source
```

**The decoration pipeline.** The hard rendering problem is overlapping ranges: a phrase may be
simultaneously highlighted yellow, inside a note anchor, part of a textual variant, and assigned
to the P source. Naive nested spans break on partial overlap.

Solution — the approach CodeMirror 6 uses. For each verse:

1. Collect all decorations intersecting the verse as `{start, end, type, payload}`.
2. Gather every boundary offset into a sorted set: `[0, ...allStarts, ...allEnds, textLength]`.
3. Walk consecutive boundary pairs, emitting one `<TextSegment>` per interval carrying the set of
   decoration types active over it.
4. Each segment renders as a flat `<span>` with composed CSS classes.

Flat, non-nested, O(n log n), correct for arbitrary overlap. Memoize per `(verseId, decorationHash)`.

**Selection → anchor.** `useAnchorSelection` reads the DOM `Selection`, walks up to the nearest
`[data-verse-id]` boundary, and converts DOM offsets into *verse-relative character offsets* using
the segment map — never raw DOM offsets, which change whenever decorations change. Output is a
`{startVerseId, startOffset, endVerseId, endOffset, quotedText, translationId}` anchor, which is
exactly the annotation shape. Selection and persistence speak the same language.

**Density.** A single prop drives layout, not logic:

| density | Verse layout | Layers allowed | Virtualized |
|---|---|---|---|
| `tooltip` | inline, clamped 3 lines | highlights only | no |
| `preview` | inline paragraph | highlights, verse numbers | no |
| `panel` | block, compact | most | no |
| `reader` | block, paragraph/poetry-aware | all | yes |

Clean Reading Mode is not a fifth density — it's a preset that flips every layer off at once.

### 4.4 How universal persistence actually works

The full path when a user drags-selects text in a hover tooltip and clicks yellow:

1. `useAnchorSelection` produces the anchor object.
2. `useCreateAnnotation` (TanStack Query mutation) fires with `optimisticId`.
3. **`onMutate`** immediately writes the annotation into `annotationsAtom(verseId)` for every verse
   in the span. Jotai notifies subscribers.
4. **Every mounted `<Verse>` for those IDs re-renders — across all seven surfaces, in the same
   tick.** The tooltip, the reader beneath it, the open cross-reference panel, the timeline modal.
   No event bus, no manual invalidation, no cross-view coordination code. This falls out of atoms
   being keyed by the same identity the views are keyed by.
5. `POST /api/annotations` persists to Postgres.
6. `onSuccess` swaps the optimistic ID for the server UUID in the atoms.
7. `onError` rolls the atoms back and surfaces a toast.
8. `AnnotationSyncBridge` subscribes to Supabase Realtime on `annotations` for `user_id`,
   applying remote changes into the same atoms — so a second device or tab converges through the
   identical path.

The invariant worth protecting: **atoms are keyed by `verse_id`, and so is everything else.**
That single alignment is what makes the "universal" requirement architectural rather than a
feature you maintain by hand.

### 4.5 API surface

```
GET  /api/passage?start=43003001&end=43003036&translation=WEB
       → { verses: [{verse_id, text, formatting, heat_bucket}], copyright }
GET  /api/annotations?start=&end=
GET  /api/xrefs?verse=43003016&depth=1&minVotes=5
GET  /api/graph?verse=43003016&depth=2        → graphology-serialized subgraph
GET  /api/variants?start=&end=
GET  /api/source-layer?start=&end=&hypothesis=
GET  /api/timeline?from=-1500&to=100&tradition=critical
GET  /api/books/:osisId/profile
GET  /api/insights/languages?scope=book&book=27
POST /api/annotations              PATCH/DELETE /api/annotations/:id
POST /api/search  { query, mode: 'text'|'semantic'|'strongs' }
```

The immutable corpus endpoints (`/passage`, `/xrefs`, `/variants`, `/timeline`) get long
`Cache-Control` + `stale-while-revalidate` and are edge-cacheable. `/annotations` is
user-scoped, private, never cached at the edge.

**As built**, with one correction: "immutable" is a claim about a *specific* corpus, and these URLs
carry no version, so sending `max-age=31536000, immutable` meant a rebuilt corpus — including one
rebuilt to fix a wrong verse — could stay invisible to an existing client for a year. The ingest
now stamps a content-derived `corpus_meta.build_id`, and `lib/db/cache.ts` turns it into an ETag
scoped to the request URL. Shared caches still hold the body indefinitely; a rebuild that changes
nothing keeps every cache warm; a rebuild that changes a verse invalidates on the next
conditional request. See `AGENTS.md`.

---

## 4.6 Design language — biblical vocabulary with plain-English glosses

The UI names its features with the vocabulary the tradition already uses for those exact
functions. This is not decoration: the Masoretes really did invent marginal textual apparatus,
*Qere/Kethiv* really is a variant-reading notation, and *Pardes* really is a layered-reading
scheme. Using the right word is more precise than "Notes", and it signals to a scholarly
audience that the tool knows its domain.

| Function | Name | Gloss shown to the user |
|---|---|---|
| Distraction-free reading | **Selah** | *Pause. Hides every layer for uninterrupted reading.* |
| Notes & highlights panel | **Masora** | *Notes in the margin — after the Masoretes, who annotated the Hebrew text to preserve it.* |
| Interpretive layer toggles | **Pardes** | *The four layers of reading: plain, hinted, inquired, hidden.* |
| Timeline | **Toledot** | *Generations. When each book was written, and when its events happened.* |
| Variant comparison | **Qere / Kethiv** | *"What is read" vs. "what is written" — the scribes' own variant notes.* |
| Manuscript transmission | **Geniza** | *The storeroom of worn manuscripts. How the text reached us.* |
| Cross-reference network | **Testimonia** | *Chains of linked passages that testify to one another.* |
| Atlas / maps | **Massa'ot** | *Stages of the journey (Numbers 33).* |
| Original-language panel | **Lashon** | *The tongue. Hebrew, Aramaic and Greek beneath the translation.* |
| Search | **Derash** | *To seek out. Search by word, root, or meaning.* |
| Reading plans | **Seder** | *Order. The cycle of readings.* |

### Rules that keep this from becoming hostile

Jargon without an exit is a wall, and this is a research tool — it must never make a first-time
user feel locked out.

1. **Every term carries its gloss.** Desktop: a hover/focus tooltip. Mobile: a persistent
   italic subtitle beneath the label, since there is no hover. The gloss is never the *only*
   way to learn what a control does.
2. **The gloss lives in the accessible name**, not just a visual tooltip — `aria-describedby`
   pointing at the gloss text, so a screen reader announces "Selah, pause, hides every layer
   for uninterrupted reading." A tooltip that only exists visually fails the audience most
   likely to need it.
3. **A global "Plain labels" toggle** in settings swaps every term for its English equivalent
   (Selah → Reading Mode, Masora → Notes, Toledot → Timeline). One Zustand boolean, one
   lookup table; no component knows the difference.
4. **Icons and position carry the meaning too.** A user must be able to navigate on layout
   memory alone without ever reading a label.
5. **Never invent.** Every term is a real one used for approximately this purpose. If no
   authentic term fits a control, it gets a plain English name — a fake Hebrew label would
   undermine exactly the credibility the vocabulary is meant to earn.

## 4.7 Mobile-first, container-driven responsiveness

**Hard constraint: design and build every surface mobile-first**, then let it reorganize
upward. Not "make the desktop layout squish" — genuinely different arrangements per size.

### Breakpoints and what changes

| Width | Layout |
|---|---|
| **base** (<640) | One column. Reader fills the screen. Panels open as bottom sheets over it. Bottom tab bar for workspaces. Timeline becomes a vertical scroll, not a horizontal scrub. |
| **sm** (≥640) | Same shape, larger type scale and margins. Sheets gain a max height. |
| **md** (≥768) | Two panes: reader + one docked side panel. Tab bar moves to the top. Timeline becomes horizontal with a compact scrubber. |
| **lg** (≥1024) | Reader + persistent sidebar with tabbed panels. Deep-dive graph opens as a modal. |
| **xl** (≥1280) | Three panes: nav rail + reader + sidebar. Timeline gets a full multi-track canvas. |
| **2xl** (≥1536) | Adds a persistent timeline rail beneath the reader, and the graph can open inline beside the text rather than as a modal. |

### Container queries, not just media queries

This matters specifically because of the unified rendering engine. `<PassageRenderer>` appears
in a 320px bottom sheet, a 420px sidebar, and a 900px reading column — **in the same viewport,
at the same time**. Viewport media queries cannot express that; the component must respond to
*its own* width.

```css
.passage { container-type: inline-size; container-name: passage; }

@container passage (min-width: 30rem) { /* verse numbers move to the gutter */ }
@container passage (min-width: 48rem) { /* poetry gains hanging indents */ }
```

So: **`density` is the semantic intent** (tooltip / preview / panel / reader) and **container
queries handle the physical fit**. The two are orthogonal, and conflating them is what forces
teams into a second renderer.

### Non-negotiables

- **Touch targets ≥44px**, including verse-number tap targets and highlight handles.
- **Text selection must work on touch** — this is an annotation app, and mobile selection is
  the single hardest interaction to get right. Budget real time for it: long-press to enter
  selection, draggable handles snapped to word boundaries, a thumb-reachable action bar.
- **No horizontal scrolling of the page**, ever. Wide content (tables, apparatus, graphs)
  scrolls inside its own container.
- **The graph view needs a mobile answer that is not a graph.** A force-directed network is
  unusable at 375px. Below `md`, the deep dive renders as a grouped, sorted *list* of
  connected passages — same data, honest interface.
- **Respect `prefers-reduced-motion`** on the timeline scrub and graph physics.
- Test at 320px (small Android), 390px (iPhone), 768px, 1280px, 1920px.

### 4.7.1 Feature availability by size — the deliberate cuts

Not everything should exist on a phone. Cramming a six-track timeline canvas into 375px
produces something technically present and practically useless, which is worse than not
shipping it. The governing rule:

> **If a feature's value comes from comparing many columns at once, or from a large 2-D
> canvas, it is desktop-only. If the information is fundamentally linear, it works on mobile.**

| Feature | Phone (<768) | Tablet (768–1279) | Desktop (≥1280) |
|---|---|---|---|
| Reader, highlights, notes (Masora) | **Full** | Full | Full |
| Selah mode | **Full** | Full | Full |
| Translation switcher (place-preserving) | **Full** | Full | Full |
| Search — text, lemma, semantic (Derash) | **Full** | Full | Full |
| Book metadata cards | **Full** | Full | Full |
| Cross-references (Testimonia) | **List, ranked** | List + preview | List + graph |
| Language composition chart | **Full** (one donut) | Full | Full |
| Timeline (Toledot) | **Reduced** — vertical era/book list, tap to expand | Horizontal, 2 tracks | Full multi-track canvas |
| Manuscripts (Geniza) | **Reduced** — witness list + detail sheet | List + timeline | Timeline + family tree |
| Variants (Qere/Kethiv) | **Reduced** — preferred reading + "N variants" sheet | Two-column | Full witness table |
| Original language (Lashon) | **Reduced** — tap-word popover | Popover + panel | Full interlinear grid |
| Atlas (Massa'ot) | **Reduced** — map + place list, no animated journeys | Map + journeys | Map + journeys + layers |
| Reference network graph | **Not available** → ranked list | **Not available** → list | Full force-directed graph |
| MT / LXX / NT-Greek parallel compare | **Not available** | Two of four columns | Full parallel |
| Source-criticism hypothesis comparison | **Not available** → single hypothesis overlay | Single overlay | Side-by-side hypotheses |
| Study composer & export | **Not available** | Read-only | Full |

**Cut features are disclosed, never silently hidden.** Where a desktop-only feature would
have appeared, mobile shows its entry point with a quiet "Best on a larger screen" note and,
where possible, the linear fallback. A researcher on a phone should always know the full tool
exists and what it holds — finding out later that a feature was hidden is worse than being
told now.

**Implementation.** A single `useCapability('reference-graph')` hook reads breakpoint +
container width and returns `'full' | 'reduced' | 'unavailable'`. Components branch on that
one value rather than scattering `md:` classes and ad-hoc width checks. It is also the honest
place to record *why* a cut was made, in a comment next to the capability definition.

## 5. Suggested additional features

Beyond the four you specified, ranked by fit and effort.

### 5.1 Source-criticism layer (already schematized in §3.7) — **highest value**
JEDP for the Pentateuch, Two-Source/Q for the Synoptics, Proto/Deutero/Trito-Isaiah, authentic vs.
disputed Paulines. Rendered as a background tint over verse ranges with a legend. The
differentiator is offering **multiple competing hypotheses as a switcher** rather than asserting
one. Nothing on the market does this well, and it pairs perfectly with the timeline's
compositional axis — selecting "P source" on the timeline can highlight exactly those verses in
the reader.

### 5.2 Geographic atlas synced to the reader
MapLibre with an ancient-world basemap; `places` and `place_verse_mentions` from OpenBible
geocoding + Pleiades. Two modes: **synced** (map follows reader scroll, pinning places in view)
and **journey** (animated routes for the Exodus, the Return, Paul's missionary journeys, drawn as
deck.gl arcs along the narrative). The place popover embeds `<PassageRenderer>`, so every mention
is one click from the text.

### 5.3 Strong's + semantic concordance
Click any word → its Strong's entry, every occurrence across the canon, frequency distribution by
book, and semantic-domain neighbors from MACULA. Combined with `pgvector`, offer three search
modes in one box: literal, lexical (this Greek lemma), and semantic ("passages about exile and
return"). The lexical mode is the one power users will live in, and `original_words` already
makes it a single indexed query.

### 5.4 Intertextuality / quotation layer
Distinct from generic cross-references: *explicit* OT citations in the NT, showing whether the NT
author quoted the **MT or the LXX** — often they differ, and the difference is theologically
loaded (Matthew's use of Isaiah 7:14 `παρθένος` vs. Hebrew `עַלְמָה` is the canonical example).
Side-by-side Hebrew / LXX / NT Greek / English. This is genuinely rare in consumer software and
is catnip for the target user.

### 5.5 Reception & canon-formation timeline
A fourth timeline track: Marcion's canon, the Muratorian Fragment, Athanasius' 39th Festal Letter,
Carthage, Trent, the Westminster Confession. Answers "when did this book *become* scripture,"
which is a distinct question from "when was it written" and one most tools ignore entirely.

### 5.6 Smaller, cheap, high-satisfaction
- **Structural/rhetorical overlays** — chiasms, inclusios, poetic parallelism as visual brackets.
- **Study composer** — assemble annotations into an exportable document (Markdown/PDF) with
  auto-generated citations. Turns the app from a reader into a work tool.
- **Reading-plan engine with spaced repetition** over `reading_sessions`.
- **Public annotation sharing** — publish a study as a read-only link. Cheap growth loop; the
  annotation model already supports it with a `visibility` column.

---

## 6. Phased implementation plan

### Phase 1 — Foundation & the Unified Engine (4–6 weeks)
**Start here. This phase is the entire architectural bet.**

Build order within the phase:

1. **`verse_id` scheme + `books`/`verses`/`translations`/`verse_texts` schema and seed.**
   Literally the first code you write. Ingest WEB (public domain, includes deuterocanon) and BSB.
   Validate all 31,102+ IDs round-trip through the OSIS parser.
2. **Reference parser/formatter** (`"Jn 3:16-18"` ⇄ `{start, end}`). Small, pure, unit-tested to
   death. Everything depends on it — command palette, URLs, cross-ref import, user input.
3. **`<PassageRenderer>` with the decoration pipeline**, all four densities, but only the
   verse-number and highlight layers wired.
4. **Auth + `annotations` table + RLS.**
5. **`useAnchorSelection` + the annotation mutation path + Jotai atomFamily + `AnnotationSyncBridge`.**
6. **Prove universal persistence explicitly:** build a throwaway dev route that mounts the same
   passage at all four densities simultaneously, highlight in one, and confirm all four update in
   a single tick. Make this an automated test. If it passes, the architecture holds; if it doesn't,
   you find out in week five instead of month five.
7. Reader shell, chapter navigation, layer toggles, Clean Reading Mode.

**Exit criteria:** a person can read the whole Bible, highlight and annotate it, and see those
annotations render identically in a tooltip, a panel, a modal, and the reader.

### Phase 2 — Cross-references & the Timeline (4–5 weeks)

1. Ingest OpenBible + TSK into `cross_references`; build `verse_reference_heat`; run offline
   PageRank.
2. Heatmap indicators in the renderer (a new decoration type — no engine changes needed, which
   is the payoff for Phase 1's design).
3. Cross-reference sidebar panel + hover previews, both consuming `<PassageRenderer>`.
4. `<DeepDiveOverlay>` with Sigma.js graph, depth/vote filtering, node → passage preview.
5. **Author the editorial dataset**: `book_datings`, `book_profiles`, `historical_events`, `eras`.
   Start this in parallel at the beginning of Phase 2 — it is research time, not engineering time,
   and it will be the long pole.
6. `<TimelineWorkspace>`: scrubber, era bands, dual-axis toggle, tradition selector, metadata cards.
7. Timeline ⇄ Reader deep linking in both directions.

### Phase 3 — Linguistics & Textual Criticism (4–6 weeks)

1. Ingest STEPBible TAHOT/TAGNT + OSHB into `original_words`.
2. Language-composition charts (whole Bible, testament, book, chapter scope).
3. Interlinear / original-language sidebar panel with morphology and Strong's.
4. Strong's concordance + lexical search.
5. Curated `manuscripts` table (~150 significant witnesses) + coverage ranges.
6. `<ManuscriptTransmissionView>` — witness timeline, text families, discovery narratives
   (Sinaiticus, the Cairo Geniza, Qumran).
7. `textual_variants` for major loci (the Comma Johanneum, Mark 16:9–20, John 7:53–8:11,
   1 Sam 17 MT-vs-LXX, the Great Isaiah Scroll vs. MT) with the inline variant marker layer.
8. Word-index annotation anchors backfilled from alignment data (§3.3).

### Phase 4 — Advanced Layers & Polish (5–7 weeks)

1. Source-criticism layer with the hypothesis switcher.
2. Geographic atlas: synced mode + animated journeys.
3. `pgvector` semantic search; unified three-mode search box.
4. Intertextuality / MT-vs-LXX quotation comparison.
5. Canon-formation track on the timeline.
6. Study composer + export; public annotation sharing.
7. Performance pass: edge caching, bundle splitting per workspace, WebGL tuning; offline reading
   via service worker + IndexedDB mirror of the corpus.
8. Accessibility audit — this content is text-first and deserves a genuinely excellent screen
   reader experience.

**Running in parallel from Phase 1:** the NRSV licensing conversation with Friendship Press / NCC.
If it lands, ingestion is a day's work because the schema never assumed a single translation.

---

## 7. Principal risks

| Risk | Impact | Mitigation |
|---|---|---|
| NRSV licensing fails or is prohibitively expensive | Loss of the intended primary text | Translation-agnostic schema; launch on WEB/BSB; NRSVue is a data swap, not a rewrite |
| Versification divergence corrupts IDs after users have annotated | Severe — silently mis-anchored annotations | Lock the canonical scheme in migration 001; `versification_map` at ingest boundaries only; validation gate in the pipeline |
| Editorial dating/profile content underestimated | Timeline ships empty or, worse, unsourced | Start the research in Phase 1; `citation NOT NULL`; scope v1 to book-level, defer pericope-level |
| Cross-translation annotation drift | Highlights appear in the wrong place | `quoted_text` + fuzzy re-anchor + honest degradation to verse-level; word-index anchors in Phase 3 |
| Graph rendering stalls on hub verses (Isa 53, Ps 22) | Deep-dive feels broken exactly where it matters most | WebGL renderer, server-side depth/vote capping, progressive expansion instead of full-neighborhood loads |
| A second passage renderer appears under deadline pressure | Universal persistence quietly dies | Lint rule + the four-density regression test from Phase 1.6 |
| Presenting contested scholarship as settled fact | Credibility loss with the target audience | Tradition selector, competing hypotheses, confidence levels, and citations everywhere |

---

## 8. Repository layout

```
bible/
├── apps/web/                      Next.js app
│   ├── app/                       routes: /read, /timeline, /insights, /atlas, /api
│   ├── components/
│   │   ├── passage/               ◄── PassageRenderer. THE boundary. Guarded by lint rule.
│   │   ├── timeline/  reader/  graph/  insights/  atlas/  ui/
│   ├── lib/
│   │   ├── refs/                  OSIS parse/format, verse_id math, versification
│   │   ├── decorations/           the segment-splitting pipeline
│   │   ├── state/                 Jotai atoms, Zustand stores, sync bridge
│   │   └── api/                   typed client + TanStack Query hooks
├── packages/
│   ├── db/                        Drizzle schema, migrations, RLS policies
│   ├── ingest/                    offline dataset normalizers (never runs in prod)
│   └── types/                     branded VerseId, Anchor, shared contracts
└── data/raw/                      gitignored, checksummed source datasets
```

---

## 9. Where to write the first line of code

`packages/types/src/verse-id.ts` — the branded `VerseId` type and the encode/decode functions.
Then `packages/ingest` to seed `verses` and WEB text, then `lib/refs`, then `<PassageRenderer>`.

Everything in this document hangs off that identifier being right.
