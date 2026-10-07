# Toledot UI — the timeline and its crawlable pages

Date: 2026-10-06. Backend contract: `2026-10-06-timeline-backend.md` (Revisions 1–2). Data is in
`data/timeline.db`, read through `lib/db/timeline.ts` (server-only) and presented through
`lib/db/timeline-present.ts`. Nothing here adds a query; everything reads the accessors.

## Goals

1. A scrollable timeline a reader can move along, seeing where events sit as **ranges, never
   points**, with a way into *why* each is dated to its range and the arguments for either end.
2. Every person, event, artifact and issue is a **server-rendered page with its own URL**, its
   claims in plain prose with the citation beside each, structured data, a share card, and an
   entry in the sitemap and `llms.txt` — so a search or an AI agent asking "who was Belshazzar's
   father" lands here.
3. Every surface says the content is **draft** until reviewed (the `status` field). Draft is a
   neutral disclosure in the caption voice, never the alert palette (AGENTS.md: a capped view
   notice is information, not an error).
4. No timeline deployed (`available: false`) → the pages render the honest "not available" state
   and return 404 for entity routes; nothing throws.

## Routes (all in `apps/web/src/app/toledot/`)

| Route | Renders |
|---|---|
| `/toledot` | The timeline: era band, three tracks (narrative, composition, canon) as horizontal lanes, each event a bar from `earliest` to `latest`; an axis of years; a list of people and issues below. Replaces `RoadmapPage`. |
| `/toledot/events/[id]` | Event: range, confidence, summary, verses; each **position** with its range, holder, tradition, the arguments **for** and **against** with citations; **attestations** grouped by relation; linked issues. |
| `/toledot/people/[id]` | Person: evidence grade (derived, explained in one line), tension flag, summary, aliases, verses; attestations grouped by relation with the artifact linked; linked events and issues. |
| `/toledot/artifacts/[id]` | Artifact: kind, language, made (or "date not established"), discovered, held by (+ accession when known), summary, citations; what it attests (events and people) with relation. |
| `/toledot/issues/[id]` | Issue: kind, summary, verses; each view with citations; linked events. |

`[id]` is the content id (`hezekiah`, `exodus`). Unknown id → `notFound()`. Every page has
`generateMetadata` via `shareMetadata` (`@/app/og/data`) with `card: { kind: "page", page: "toledot" }`
(no new card kind in this revision), a situational title/description, and is indexable
(`robots` default) except when the timeline is unavailable.

## Components (`apps/web/src/components/toledot/`)

- `TimelineStrip.tsx` (client): the scrollable lanes. Props: `eras`, `events` (with `display`
  from `withDisplay`), `from`, `to`. Horizontal scroll with `overflow-x: auto` and scroll
  snapping off; a fixed pixel-per-year scale chosen so the default window fits ~3 viewport
  widths on desktop. Each bar is a `<Link>` to its event page with the title and the range in
  the accessible name. Confidence is encoded in the bar's border style (firm solid, contested
  dashed, speculative dotted) and **also** in text (never colour or style alone). Keyboard:
  bars are links, so Tab moves through them in year order; the lanes carry `aria-label`.
  On narrow widths the strip is still horizontal (the data is a line); disclose the gesture
  with a one-line caption ("Scroll sideways").
- `YearAxis.tsx`: tick labels from `formatYear` at a step chosen from the window width
  (500/250/100/50 years).
- `EvidenceBadge.tsx`: the grade as a word with its one-line meaning in the accessible name
  (`corroborates` → "Named by a source outside the Bible"; `partially-corroborates` → "Partly
  confirmed; the reading is disputed"; `consistent` → "Fits an outside source without naming
  them"; `silent` → "Outside sources exist but say nothing"; `none` → "No outside evidence").
  Colour from tokens only; never the only carrier.
- `Citations.tsx`: a `<cite>` list: title (linked when `url`), author, container, year,
  locator. Rendered under every claim that carries citations.
- `RelationGroup.tsx`: attestations grouped and headed by relation in this order:
  corroborates, partially-corroborates, consistent, silent, in-tension.
- `DraftNotice.tsx`: "Draft — not yet reviewed against its sources" in caption voice, with a
  link to the review notes. Rendered on every entity page and once on the index.
- `ToledotStructuredData.tsx`: JSON-LD via `StructuredData`. Person → `schema.org/Person` with
  `name`, `alternateName`, `description`, `subjectOf` (the page), `citation` entries;
  Event → `Event` with `startDate`/`endDate` as year strings (negative years as `-0586`-style
  ISO is unreliable across consumers; use `temporalCoverage` text `"586 BCE"` instead and put
  the integer years in `additionalProperty`); Artifact → `CreativeWork`/`ArchiveComponent` with
  `holdingArchive`; Issue → `Article`. Every one carries `isAccessibleForFree: true` and
  `license` pointing at the site's licence page if one exists, else omitted.

Years are formatted only through `lib/timeline/years.ts`. No year arithmetic in components.

## Discovery

- `sitemaps/[file]/route.ts`: a new key `toledot` listing `/toledot` and every entity page;
  `sitemap.xml/route.ts` includes it only when `getTimelineBuildId()` is non-null.
- `llms.txt` and `llms-full.txt`: a "Historical scholarship" section naming the timeline
  endpoints and the page URL patterns, with the draft caveat and the evidence-grade vocabulary.
- `/toledot` metadata drops `noindex`.

## Invariants

- One scripture renderer: these pages **never** render verse text. Verse links go to `/read/…`
  via `labelVerses` (which gives `label` and `path`). No import of `lib/db/corpus` outside the
  db layer; `labelVerses`/`bookNames` are the only corpus-aware helpers and they live there.
- Colours from `globals.css` tokens; no hex.
- Terms from `lib/lexicon.ts` (`toledot`); the heading uses `GlossLabel`.
- Mobile-first; the strip is the only wide element and it scrolls, never overflows the page.
- `density`/`@container` as in AGENTS.md.

## Verification

`npm run lint` (boundary rule), `npx vitest run` with the new tests green, `next build`, and a
probe script that starts the server with `TIMELINE_DB_PATH` set and fetches each route (200),
an unknown id (404), and with `TIMELINE_DB_PATH=/nonexistent` (index 200 with the unavailable
state, entities 404). Then `scripts/shoot.mjs` at 390px and 1280px for `/toledot` and one
person page, and read the screenshots.

## Tests (test-author; implementer does not edit)

- `components/toledot/YearAxis.test.tsx`: ticks for (-1500,-500) step 250 → 5 labels formatted
  "1500 BCE"…; (-4000, 400) step 500; a window crossing year 0 never emits a 0 tick.
- `components/toledot/EvidenceBadge.test.tsx`: each grade renders the word and the meaning in
  the accessible name; `hasTension` adds the tension sentence.
- `components/toledot/RelationGroup.test.tsx`: groups in the fixed order; empty relations
  omitted; each item links to its artifact page.
- `components/toledot/TimelineStrip.test.tsx`: renders one link per event with title and range
  in the accessible name; bars sit in the lane of their axis; confidence appears as text.
- `lib/timeline/strip-layout.test.ts` (pure): `layoutBars(events, from, to, pxPerYear)` returns
  `{ id, lane, left, width }` with left = spanYears(from, earliest) * pxPerYear, width ≥ a
  minimum so single-year events are visible, and overlapping bars in one axis get distinct
  `lane` rows (greedy first-fit by earliest).
- `app/toledot/sitemap.test.ts`: the toledot sitemap lists every entity id from mocked
  accessors and is absent from the index when the build id is null.
