# Toledot browsing: eras, the hub, three indexes

Date: 2026-10-07. The user: "We need to make the formatting user friendly for looking through
these different dates, events and people", then "Make it work good on phones and pc size
displays both please". Decisions taken with the user: the timeline strip is the primary browser;
a hub plus three index pages for deeper reading; events grouped by era, then axis inside; a row
shows title, date span and a one-line gist. Supersedes the index behaviour section of
`2026-10-07-toledot-people-index.md` (people now group by era like everything else); keeps its
strip section and lens section.

## Job and audience

Someone who has read a verse, followed a note to Toledot, and now wants to look around: what else
happened then, who was alive, what is argued about. They arrive on a phone as often as a desktop.
Success: within a few seconds they can see the shape of a period, pick an event, person or
question, and get back. Mode: Operate (scan, pick, return), with Read on the detail pages.

## The one structure: eras

Eight eras in `content/eras.toml`, each with a summary and citations like any other content, and
contiguous so every year belongs to exactly one. Everything groups by the same rule, so the strip,
the hub and the three indexes agree:

- an event belongs to the era containing its **earliest** scholarly year;
- a person belongs to the era of `lived.earliest`, else of the earliest event naming them, else
  is "unplaced" (a review signal);
- an issue belongs to the era of its earliest linked event, else to "across the Bible".

The rule lives in one pure module, `lib/timeline/catalogue.ts` (tested): `assignEra`,
`groupByEra`, `firstSentence`, `matchesQuery`.

## Surfaces

**Hub `/toledot`.** Header, then a row of era chips (a `radiogroup`; the choice is `?era=` in the
URL so links land on it and the server renders it; default is the era holding the most events),
then the strip showing that era's window, then "In this era": the era's summary, its events grouped
by axis (narrative first), the people alive in it, the open questions anchored in it, each as rows
of title, date, gist. Then three links: all events, all people, all questions. "All eras" is a
chip too; it keeps the whole-span strip.

**Indexes `/toledot/events`, `/toledot/people`, `/toledot/issues`.** Server-rendered, every row
present for crawlers and for no-JS. Grouped by era in `<details>` sections whose summary carries
the era name, its span and its count ("Divided kingdom · 930–587 BCE · 14 events"). On a desktop
all sections start open; on a phone only the first with content opens, the rest collapsed. One
search box filters client-side over title, gist, role and names; while the query is non-empty every
section is forced open, empty ones hidden, with a live count ("12 of 74 events"). A chip row
narrows further: events by axis and confidence; people by evidence grade; questions by kind.
Filters are in the URL hash so a state is linkable; a failed storage read means defaults.

**Sort by** (the user, 2026-10-07: "a 'sort by' to switch between sorting by book of the Bible,
by chronological order, or by the other default"). A segmented control on each index with three
orders: **By era** (the default: era sections, chronological inside), **By date** (one flat list in
year order, no sections; people by when they lived, else by their earliest event), **By book** (sections
in canonical order, Genesis to Revelation, by the first verse the item is linked to; items with no
verse go last under "No verse yet"). The choice is in the URL hash with the filters, so a sorted,
filtered view is linkable; the server renders the era order and the client regroups.

**Rows.** One component for all three kinds: a serif title link, a tabular date span, a one-line
gist (the first sentence of the summary, clipped to two lines on a phone), and small marks: for
events the axis word and confidence; for people the evidence grade; for questions the kind. No
cards, no icons; hairline rules between rows as the entity pages already do.

**Strip.** Era chips set the window. A lane with nothing in the window collapses to its caption
row. `layoutBars` gains `maxRows`; beyond it the overflow is not drawn but listed under the strip
("and 6 more in this window", linking to the events index at that era), so a phone never scrolls
through eight rows of bars.

## Phone and desktop

One layout, two compositions: at phone width chips scroll sideways in one row, sections collapse,
rows stack title over gist, targets are 44px; at desktop the hub register is two columns (events
left, people and questions right), chips wrap, sections open. Checked by screenshot at 390 and
1280, light and dark, with the real content: no horizontal overflow, filter reachable above the
fold, the strip no taller than one and a half viewports on a phone.

## Out of scope

No new nav tab (the indexes are reached from the hub and breadcrumbs). No change to detail pages
beyond linking back to the era. No people life-event lane yet.

## Verification

Vitest: `catalogue.ts` (every rule, ties, unplaced), `strip-layout` `maxRows`, the filter
component (query forces sections open, count text, chip narrowing), the era chip `?era=` round
trip. Python: `eras.toml` loads, contiguous, cited. Then build, screenshots at both widths and
themes, read them, fix in one batch, confirm once.
