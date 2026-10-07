# Toledot in the reader — the margin note is the product

Date: 2026-10-07. The user's statement of the goal (recorded in memory): open a passage about
David and see, in the margin, "scholars dispute whether this happened before or after x" or "an
alternate reading of this passage suggests y", each linked to its full page. `/toledot` is the
catalogue; this layer is the product. Backend: `2026-10-06-timeline-backend.md`; catalogue UI:
`2026-10-06-timeline-ui.md`.

## What a reader sees

Under any verse that a timeline subject is linked to, a one-line note in the apparatus voice,
visually distinct from Insights (which are editorial asides) and from the omission apparatus:

> ⧗ **Dating disputed** — Early date (c. 1446 BCE) or Late date (13th century BCE). *The Exodus from Egypt* →
> ⧗ **Historical question** — Is there a historical Moses? →
> ⧗ **Named by a source outside the Bible** — Hezekiah →
> ⧗ **Outside source in tension with this verse** — Nabonidus Cylinder from Ur →

Every sentence is assembled from data the subject already carries (positions, issue kind and
title, evidence grade, attestation relation); the layer never writes a claim of its own. The
arrow is a link to `/toledot/{events|issues|people|artifacts}/{id}`. Draft subjects carry a
"draft" caption, in caption voice (never the alert palette).

## Contract

### `lib/db/timeline.ts` — `getTimelineNotesForRange(range: VerseRange): ToledotNote[]`

One note per `verse_links` row whose `[start_verse_id, end_verse_id]` intersects `range`, for
every subject kind, deduplicated to one note per `(subject_kind, subject_id)` per anchor verse.

```ts
export interface ToledotNote {
  /** `<subject_kind>:<subject_id>@<anchor verse id>` — stable, React key and anchor. */
  id: string;
  /** The first verse of the link, clamped into `range` (a link that begins before the range anchors on `range.start`). The page re-anchors to the first REAL verse at or after this id. */
  anchor: VerseId;
  /** The full link, for the "spans N verses" disclosure. */
  start: VerseId;
  end: VerseId;
  linkType: "describes" | "alludes" | "background" | "dates";
  subject:
    | { kind: "event"; id: string; title: string; status: ReviewStatus; confidence: EventSummary["confidence"]; earliest: number; latest: number; positions: { label: string }[] }
    | { kind: "argument"; eventId: string; eventTitle: string; eventStatus: ReviewStatus; positionLabel: string; stance: "for" | "against" }
    | { kind: "issue"; id: string; title: string; kind2: IssueSummary["kind"]; status: ReviewStatus }
    | { kind: "person"; id: string; name: string; evidence: EvidenceGrade; hasTension: boolean; status: ReviewStatus }
    | { kind: "artifact"; id: string; name: string; status: ReviewStatus; relation: Relation | null };
  /** The link's own note text when the author wrote one (e.g. "Nebuchadnezzar his father"). */
  note: string | null;
}
```

(`kind2` is a placeholder name in this sketch; call it `issueKind`.) For an artifact link the
`relation` is the strongest relation the artifact has to any person or event also linked to the
same verse, else `null`. Interval intersection on link endpoints only; nothing walks the sparse
id space (AGENTS.md invariant 3).

### `lib/timeline/notes.ts` — pure, no db

```ts
export interface ToledotSentence { lead: string; body: string; href: string; draft: boolean }
export function toledotSentence(note: ToledotNote): ToledotSentence
```

Rules, each from data only:

| subject | lead | body | href |
|---|---|---|---|
| event, ≥2 positions | "Dating disputed" | positions joined with " or " (labels verbatim) then " — " + title | `/toledot/events/{id}` |
| event, 1 position, confidence firm | "Dated" | `formatRange(earliest, latest)` + " — " + title | same |
| event, 1 position, not firm | "Dated, {confidence}" | same | same |
| argument | "Cited in dating" | `{positionLabel}` + (stance against ? ", against" : "") + " — " + eventTitle | `/toledot/events/{eventId}` |
| issue | "Chronology question" / "Textual question" / "Historical question" / "Internal question" by `issueKind` | title | `/toledot/issues/{id}` |
| person | the EvidenceBadge meaning for `evidence` ("Named by a source outside the Bible", "Partly confirmed by an outside source", "Fits an outside source", "Outside sources are silent", "No outside evidence") + (hasTension ? "; a source contradicts a detail" : "") | name | `/toledot/people/{id}` |
| artifact | relation in-tension → "Outside source in tension with this passage"; corroborates/partially → "Outside source corroborates this passage"; consistent/silent/null → "Outside source" | name | `/toledot/artifacts/{id}` |

`note` (the link's own text), when present, is appended to the body in parentheses. `draft` is
true when the subject's status is `draft`. The person-meaning strings are shared with
`EvidenceBadge` through one exported map in `lib/timeline/evidence.ts` (move it there; the badge
imports it) so the two cannot drift.

### Renderer

- `PassageLayers` and `LayerToggles` gain `toledot: boolean`, default **true** (one line of
  apparatus, the reason the project exists; same reasoning as `insights`). No PREFERENCES_VERSION
  bump: the migration spreads defaults under stored layers, so a missing key becomes `true`.
- `DENSITY_LAYER_CEILING`: `panel` and `reader` include `toledot`; tooltip and preview do not.
- `PassageRenderer` prop `toledotNotes?: ReadonlyMap<VerseId, readonly ToledotNote[]>`; under
  each verse, after `InsightNotes`, `{layers.toledot && <ToledotNotes notes=… />}`.
- `components/passage/ToledotNotes.tsx` (client, part of THE renderer): a `<ul>` of
  `<li class="toledot-note">` each with a glyph (`aria-hidden`), `<strong>` lead, body, a
  `<Link>` whose accessible name is "{lead}: {body} — open on the timeline", and a `draft` caption
  when `draft`. Multi-verse links render "(verses {start}–{end})" only on the anchor verse,
  through `labelVerses`-style formatting passed in (the component gets a preformatted `span`
  string; it never imports the corpus).
- `reader.css`: `.toledot-notes`, `.toledot-note*` with tokens only; hidden under
  `.passage[data-selah="true"]` like insights.
- `LayerControls.layerRows`: a row `{ key: "toledot", label: "Timeline" + term("Toledot"), description: "Dating disputes, outside evidence and open questions under the verses they concern, linked to the timeline." }` placed after `insights`.
- `read/[ref]/page.tsx`: when `getTimelineBuildId()` is non-null, build the map from
  `getTimelineNotesForRange(renderRange)`, re-anchoring each note to the first rendered verse id
  ≥ `anchor` (the rendered verse list is already in hand; no range walk). Pass it down. The
  `/read` page's "This passage on the timeline" is NOT a separate panel in this revision; the
  notes are the surface.
- `/api/timeline/passage` gains `notes: ToledotNote[]` (same accessor) so API users get the
  sentences' inputs; the OpenAPI entry mentions it.

### Invariants

One renderer (this is a decoration inside it, nothing else renders scripture). No corpus import
outside the db layer. Years through `years.ts`. Tokens only. Terms from the lexicon
(`toledot`). The layer disclosed, switchable, and off in Selah.

### Verification

`npm run lint`; `npx vitest run` green including the new tests; `next build`; probe
`/read/Exod.1?t=WEB` (expect Dating disputed under 1:11), `/read/Dan.5` (expect the Belshazzar
issue and the in-tension cylinder), `/read/2Kgs.18` (Hezekiah named…), `/read/John.3` (no notes,
no error), and with `TIMELINE_DB_PATH=/nonexistent` every page renders with no notes and no
error. Screenshot `/read/Dan.5` at 390 and 1280 and read it.

### Tests (test-author; the implementer never edits them)

- `lib/timeline/notes.test.ts`: every row of the sentence table; the parenthesised link note;
  draft flag; the person meaning map shared with the badge (import from `lib/timeline/evidence`).
- `components/passage/ToledotNotes.test.tsx`: renders nothing for `[]`; lead, body, link href and
  accessible name per note; the draft caption only when draft; the span text only when provided.
- `lib/db/timeline.test.ts` (extend with the file's fixture pattern): `getTimelineNotesForRange`
  returns one note per intersecting link, clamps `anchor` to `range.start` for a link that
  begins earlier, dedupes a subject linked twice to the same anchor, excludes non-intersecting
  links, and sets `relation` for an artifact that corroborates a person linked to the same verse.
- `components/shell/LayerControls.test.tsx` (extend): the `toledot` row exists with the term in
  its label when plain labels are off and without it when on.
- `lib/store/preferences` (new small test if none exists): a persisted v2 state without
  `toledot` migrates to `toledot: true`.
