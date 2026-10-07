# Timeline backend (Toledot) — contract

Status: in progress, 2026-10-06. Backend only; the timeline UI is a later piece of work.

## What it is for

The reader should be able to scroll along time and see where events plausibly fall — as
**ranges, never points** — and open any event to read *why* it is dated to that range, the case
for each end of it, which sources outside the Bible corroborate it (or do not), and the
chronological and textual problems attached to it. `ARCHITECTURE.md` §0.2–§0.3 and §3.5 are the
design record this refines.

## Decisions

1. **A separate artifact: `data/timeline.db`.** Not tables in `bible.db`. The corpus is rebuilt
   from downloaded text sources in four minutes and fingerprinted by content; timeline content
   is hand-written editorial prose that changes on review. Coupling them would force a corpus
   rebuild for every corrected sentence. Same precedent as `audio.db`: the two share only the
   canonical verse-id address space, and the app feature-detects the file.
2. **Source of truth is TOML in the repo** (`packages/timeline/content/`), compiled by a
   stdlib-only Python builder (`packages/timeline/build.py`). Reviewable in a diff, no
   dependencies to install anywhere.
3. **One `events` table for both axes**, distinguished by `axis` (`narrative` | `composition`),
   instead of §3.5's separate `book_datings` table — because the thing the user asked for
   (positions, arguments for each end of a range, citations) applies identically to "when did the
   Exodus happen" and "when was Daniel written". The two axes stay separate in every query (the
   window endpoint filters by axis); they are never merged onto one scale.
4. **An event's range is DERIVED** as the envelope of its positions. There is no second copy of
   the numbers to drift.
5. **Every row ships `status = "draft"`** until a human has reviewed it. The API returns the
   status; the UI must show it.
6. **Dating and historicity are different questions.** A position dates an event (it has a
   range). A view that the event did not happen as described has no range to give, so it is an
   `issue` of kind `historical` linked to the event, with its own cited views — never a position
   with invented years.

## Revision 1 (2026-10-06, after architecture review)

- **Three axes**: `narrative` (when events happened), `composition` (when texts were written),
  `canon` (when collections were recognised and closed). Never merged onto one scale.
- **Composition events name books through `event_books`**, not a single `events.book_id`:
  content key `books = ["Gen", "Exod", ...]` (OSIS ids, ≥1, all must exist in `bible.db`),
  **required** when `axis = "composition"` and forbidden otherwise. A source document (the
  Priestly source, the Deuteronomistic History) spans several books; its exact extent is given
  by its `verses` links. The old singular `book` key is removed (unknown key = error).
- **Stable text ids for every child row**: arguments `"<position id>/argument-<n>"`, attestations
  `"<event id>@<artifact id>"`, issue views `"<issue id>/view-<n>"` (n from 1, authored order).
  They are what `citations.subject_id` and `verse_links.subject_id` hold, so they are the same
  on every rebuild of the same content; the API exposes them as `id` for deep links.
- **`/api/timeline` returns `tracks: { narrative: [...], composition: [...], canon: [...] }`**,
  always all three keys; `axis` limits which one is filled (the others are `[]`). No flat merged
  `events` list.
- `lib/db/timeline.ts` logs one warning when `meta.corpus_build_id` differs from the deployed
  corpus build id (verse links were validated against a different `bible.db`).
- A new `timeline.db` is picked up on service restart (the handle is opened once per process,
  as with `audio.db`).

## Revision 2 (2026-10-06): people, texts outside the Bible, review sheets

The user's direction: represent scholarship on the Bible *as a text* — evidence for and against
the existence of its people and the historicity of its stories, and its chronological
discrepancies. Events, issues and attestations already carry stories and discrepancies; this
revision adds people. User decisions: about 10 seed people across monarchy-era kings, contested
figures and New Testament figures; everything ships `draft` and the user reviews in batches from
a generated sheet.

- **`persons/<id>.toml`**: `id`, `name`, `role` (e.g. "king of Judah"), `summary`, `status`,
  `citations` (≥1), optional `also_known_as` (array of strings), optional
  `lived = { earliest, latest }` (years, same rules), optional `verses` (where the Bible names
  them), optional `events` (event ids they take part in), and `[[attestations]]` (optional;
  `artifact`, `relation`, `note`, `citations` ≥1 — the same five relations as events).
- **Existence is a derived grade, never authored.** `persons.evidence` is the strongest relation
  among the person's attestations, in the order `corroborates` > `partially-corroborates` >
  `consistent` > `silent`; `none` when there are no attestations at all. `in-tension` does not
  count toward the grade (Belshazzar is corroborated as a person even though a source contradicts
  a detail about him); it sets the derived flag `has_tension`. Meaning of the relations for a
  person: *corroborates* = names this person; *partially-corroborates* = names them but the
  reading or the identification is disputed; *consistent* = fits without naming them; *silent* =
  a relevant source that does not mention them; *in-tension* = contradicts a biblical detail.
- **Texts outside the Bible are artifacts of kind `literary-text`** (a passage of Josephus or
  Tacitus); `made` is the date of composition; `held_by` and `discovered` do not apply.
- **Artifacts gain a required `status`** (`draft` | `reviewed`): their museum numbers and
  readings are claims a reviewer must check too.
- **Issues gain optional `persons`** (person ids), e.g. "Was Moses a historical figure?".
- Ids: person attestations are `"<person id>@<artifact id>"`. `verse_links.subject_kind` gains
  `person`; `citations.subject_kind` gains `person` and `person_attestation`.
- Builder gates: unknown person/artifact/event ids in any of these references fail; a
  `literary-text` artifact with `held_by` or `discovered` fails; everything else as before.
- **API**: `GET /api/timeline/persons` (all people: id, name, role, evidence, hasTension, status,
  lived with display), `GET /api/timeline/persons/[id]` (in full: attestations with artifact
  name/kind and citations, verse links labelled, events, issues), the passage endpoint adds
  `persons` whose verse links intersect the range, and the artifact endpoint adds the people it
  attests.
- **Review sheet**: `packages/timeline/review.py --db <timeline.db> --out <file.md>` writes one
  Markdown checklist of every `draft` artifact, event, person and issue — each claim with its
  citations (title, locator, URL) and the source file to edit — so a batch can be checked and
  flipped to `status = "reviewed"` in the TOML. `--all` includes reviewed entries. Stdlib only,
  reads the built database, writes only `--out`.

## Years

Integers. Negative = BCE, positive = CE, **no year zero** (`-1` is 1 BCE, `1` is 1 CE). A zero
anywhere is a build error. Ranges are inclusive `[earliest, latest]` with `earliest <= latest`.
Any span arithmetic must skip zero (`lib/timeline/years.ts`).

## Source files (`packages/timeline/content/`)

Unknown keys are an error everywhere (a typo like `earliest_yr` must not be silently dropped).
Every `id` matches `^[a-z0-9]+(-[a-z0-9]+)*$`, is unique within its kind, and for one-file-per-
entity kinds equals the file name without `.toml`.

A **citation** is an inline table `{ source = "<source id>", locator = "<pages, line, §>" }`;
`locator` is optional. A **verse link** is
`{ ref = "1Kgs.6.1" | "Exod.12.40-Exod.12.41", link = "describes"|"alludes"|"background"|"dates", note = "…"? }`
using OSIS book ids from `bible.db` `books.osis_id`. A range's two ends are full OSIS refs.

- `sources.toml` — `[[source]]`: `id`, `kind` (`book`|`chapter`|`article`|`edition`|`museum`|`web`),
  `title`, and optionally `author`, `container`, `publisher`, `year` (int), `url`, `isbn`.
- `eras.toml` — `[[era]]`: `id`, `name`, `start`, `end`, `summary`, `citations` (≥1).
- `artifacts/<id>.toml`: `id`, `name`, `kind` (`inscription`|`chronicle`|`relief`|`papyrus`|
  `ostracon`|`manuscript`|`seal`|`coin`|`site`), `language`, `summary`, `citations` (≥1),
  optional `made = { earliest, latest }` (omit when the object's own date is not established —
  never guess), optional `discovered = { year, place }`,
  `held_by = { institution, accession }`, `verses` (verse links).
- `events/<id>.toml`: `id`, `title`, `axis`, `category` (`biblical-narrative`|`political`|
  `composition`|`canon`), `confidence` (`firm`|`contested`|`speculative`), `status`
  (`draft`|`reviewed`), `summary`, optional `book` (OSIS id; **required** when
  `axis = "composition"`, forbidden otherwise), optional `segment`, `verses`, and:
  - `[[positions]]` (≥1): `id` (unique within the event), `label`, `tradition`, `earliest`,
    `latest`, `summary`, optional `held_by`, `citations` (≥1),
    - `[[positions.arguments]]`: `stance` (`for`|`against`), `text`, `citations` (≥1),
      optional `verses`.
  - `[[attestations]]`: `artifact` (artifact id), `relation` (`corroborates`|
    `partially-corroborates`|`consistent`|`silent`|`in-tension`), `note`, `citations` (≥1).
- `issues/<id>.toml`: `id`, `kind` (`chronology`|`textual`|`historical`|`internal`), `title`,
  `summary`, `status`, optional `events` (event ids), `verses`, `citations` (≥1),
  - `[[views]]` (≥1): `label`, `text`, `citations` (≥1).

## Build gates (`build.py --content <dir> --corpus <bible.db> --out <timeline.db>`)

The build writes to a temporary file beside `--out` and renames it into place only after every
gate passes; **a failed build leaves any existing `--out` byte-for-byte untouched** and exits
non-zero, printing every failure (not only the first) as `<file>: <message>`.

1. Schema: required keys present, no unknown keys, enums valid, types right, ids well formed and
   unique, file name equals id.
2. Years: non-zero integers, `earliest <= latest` (positions, eras via start/end, artifact `made`).
3. Citations: every citation's `source` exists; the required-≥1 rules above hold. A source that
   nothing cites is a **warning**, not an error.
4. Cross-references: attestation `artifact` exists; issue `events` exist; composition events'
   `book` exists in `bible.db`.
5. Verses: each ref parses; its book exists in `bible.db`; **both endpoints exist in
   `bible.db` `verses`** (the id space is sparse — `Gen.1.32` encodes fine and does not exist);
   start ≤ end.
6. Stamp `meta`: `build_id` = first 16 hex chars of a SHA-256 over the normalized content, every
   field length-prefixed, entities in id order — so it changes when any text changes, including
   an equal-length correction, and does NOT change when files are merely reordered or renamed
   on disk without content change; `schema_version`; `corpus_build_id` (from `bible.db`).

## Database (`packages/timeline/schema.sql`, the single schema source)

Used by the builder and by the TypeScript tests' fixtures. Tables: `meta(key, value)`,
`sources`, `eras`, `events` (with derived `earliest_year`, `latest_year`), `event_books`,
`positions`, `arguments`, `artifacts`, `attestations`, `issues`, `issue_views`, `issue_events`,
`verse_links(subject_kind, subject_id, start_verse_id, end_verse_id, link_type, note)`,
`citations(subject_kind, subject_id, source_id, locator, ordinal)`. `subject_kind` is one of
`era`, `event`, `position`, `argument`, `artifact`, `attestation`, `issue`, `issue_view`.
Argument, attestation and issue-view ids are the stable text ids of Revision 1.

## App layer

- `apps/web/src/lib/timeline/years.ts` (pure): `formatYear(y)` → `"586 BCE"` / `"33 CE"`;
  `formatRange(a, b)` → `"c. 1446–1406 BCE"`-style (`"1250 BCE–33 CE"` when crossing the era);
  `spanYears(a, b)` counts years with no year zero (`spanYears(-1, 1) === 1`); `overlaps`.
- `apps/web/src/lib/db/timeline.ts` (server-only, feature-detected via `TIMELINE_DB_PATH`,
  default `data/timeline.db`): `getTimelineBuildId()`, `getTimelineWindow({ from, to, axis? })`,
  `getEvent(id)`, `getArtifact(id)`, `getIssue(id)`, `getTimelineForRange(range)`. Every accessor
  returns empty/null when the file is absent, never throws.
- API (JSON, ETag scoped to the timeline build id):
  `GET /api/timeline?from&to&axis`, `GET /api/timeline/events/[id]`,
  `GET /api/timeline/artifacts/[id]`, `GET /api/timeline/issues/[id]`,
  `GET /api/timeline/passage?ref=`. Bad params → 400 with a message; unknown id → 404; no
  artifact deployed → 200 with `available: false` and empty lists for the list endpoints, 404
  for the detail ones. Documented in `/api/openapi.json`.

## Seed content

A small set that exercises every table, each fact checked against a published source before it
is written, all `draft`: the date of the Exodus (contested; the 1 Kings 6:1 "480 years" issue),
Sennacherib's 701 BCE campaign against Judah (firm; Assyrian annals and the Lachish reliefs),
the fall of Jerusalem (587 vs 586 BCE; the Babylonian Chronicle fixes the 597 capture), and the
composition of Daniel (composition axis; 6th vs 2nd century BCE).
