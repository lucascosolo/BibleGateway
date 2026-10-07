# Toledot people index at scale

Date: 2026-10-07. The user wants every major biblical character listed eventually, and said the
index "will have to have some smarter sorting and collapsing of info". Ten rows in one list is fine;
three hundred is not, least of all at 390px. Catalogue UI: `2026-10-06-timeline-ui.md`; reader
layer: `2026-10-07-toledot-reader-layer.md`.

## Grouping without new data

A person is grouped by **where the Bible first names them**: the book of the earliest `verses`
link, mapped to a canonical section. No new content key, so every existing and future person file
groups itself, and the order is one every reader already knows.

| section id | books |
|---|---|
| `torah` | Gen–Deut |
| `former-prophets` | Josh, Judg, Ruth, 1–2 Sam, 1–2 Kgs |
| `latter-prophets` | Isa–Mal |
| `writings` | 1–2 Chr, Ezra, Neh, Esth, Job, Ps, Prov, Eccl, Song, Lam, Dan |
| `gospels` | Matt–John |
| `acts-epistles` | Acts–Rev |

Within a section, order by `lived.earliest` when present, else by first verse id. A person with no
verse links (the builder allows it) goes in an `unplaced` section at the end, which is also a review
signal: every person should have one.

## Index behaviour

- Each section is a `<details>` with a `<summary>` carrying the section name, the count, and the
  evidence tally ("12 people · 7 named outside the Bible"). Open by default at ≥1024px; on a phone
  only the first section opens, the rest collapsed. State per section in `sessionStorage` under
  `toledot.people.<section>` (per-viewer convenience only; a failed read means default).
- One filter box above the sections, client-side, matching `name`, `also_known_as` and `role`;
  while a query is non-empty every section is forced open and empty sections are hidden, with a
  live-region count ("4 of 212 people").
- A second toggle row filters by evidence grade (the five EvidenceBadge meanings), using the same
  grade strings from `lib/timeline/evidence.ts`.
- Row content is unchanged: name link, role, lived range, EvidenceBadge. Rows do not grow a
  summary; the detail page has it.
- The server still renders every row (crawlable, JSON-LD unchanged); collapsing and filtering are
  progressive on top. `details` without JS is still a working disclosure.

## Life events on the person page

Birth, accession, death and defining events are ordinary narrative events in `content/events/`
that list the person in a `persons` key (new, optional, list of person ids; the builder checks
they exist, mirroring how issues do it). The person page gains a "Life" list: those events in
year order, each with its EvidenceBadge-style confidence and position count, linking to the event
page. `PersonDetail.events` already exists; it becomes the union of events naming the person and
events the person file names.

## Data accessors

`getPersons()` adds `firstVerseId: VerseId | null` and `alsoKnownAs`. A pure
`groupPersons(persons): Section[]` in `lib/timeline/people-index.ts` (tested) does the mapping;
the page renders sections. No corpus import anywhere in it.

## Verification

Vitest for `groupPersons` (every section, ordering, unplaced, ties), the filter component, and the
`persons` key in the builder (`packages/timeline/tests`). Screenshot `/toledot` at 390 and 1280
with ≥40 people and read it: section summaries legible, no horizontal overflow, filter reachable
above the fold.

## The strip at 53 events (added 2026-10-07 after the first screenshot)

Measured with the merged content: the strip viewport scrolls 5,533px at both 390 and 1280px; the
narrative lane stacks eight rows deep around the monarchy while the composition and canon lanes are
empty for 2,000 years and still take full height. Two changes, both in the pure layout module and
the strip component, no data change:

1. **Era windows instead of one window.** A row of era chips above the strip (Patriarchs,
   Exodus and conquest, Judges, United monarchy, Divided kingdom, Exile and return, Second Temple,
   New Testament) each sets `[from, to]`; the boundaries are derived from the events present (the
   gaps between clusters), so they move as content grows. The default window is the era holding the
   most events. "All" keeps the current behaviour. The chip row is a `radiogroup`; the chosen era is
   in the URL (`?era=`) so a link lands on the right window and the server renders it.
2. **Lanes shrink to their content.** An axis with nothing in the window renders as one caption
   row, not a full lane. Row height within a lane comes from the number of rows actually used, and
   `layoutBars` gains a `maxRows` beyond which the overflow is listed below the strip ("and 6 more
   in this window") rather than drawn, so the phone never scrolls through eight rows of bars.

Tests: era boundary derivation (clusters, single event, empty), `maxRows` overflow, URL round-trip.
Screenshot 390 and 1280 again and compare the strip height and scroll width with the numbers above.
