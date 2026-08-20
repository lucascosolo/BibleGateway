# Jot — working agreement

A scholarly Bible study dashboard. Read `ARCHITECTURE.md` before changing anything structural;
it is the design record and explains *why* the odd-looking decisions are the way they are.

Deploys to `bible.lucascosolo.com`.

## The three invariants

Break these and the app quietly stops working the way it is supposed to.

1. **`verse_id` is the only address.** `BBCCCVVV` as an integer (`book * 1e6 + chapter * 1e3 +
   verse`). Annotations, cross-references, timeline anchors, map pins and variant apparatus all
   point with it. It is translation-independent by construction — which is why switching
   translation never loses your place. Never introduce a second addressing scheme.

2. **There is exactly ONE scripture renderer.** Enforced by `eslint.config.mjs` and by the lint
   gate in `sync-and-build.sh` — `next build` does not run eslint, so a rule without that gate
   is decoration. The guard covers three routes to a second renderer, not one: the decoration
   pipeline, a direct `Verse` import, and — the one it originally missed — reaching the text
   itself, either by importing the server corpus accessors (`lib/db/corpus`, `lib/db/apparatus`,
   `lib/db/client`) or by fetching `/api/passage`, outside `src/app/**` and the db layer. Import
   `getPassage` and `.map()` over the rows and you have a second renderer with no layer
   ceilings, no omission apparatus and no atom subscriptions, having imported nothing the old
   rule named. `import type` is explicitly allowed — it is how the renderer types its props and
   it carries no query layer into the bundle. **When you add a boundary rule, enumerate the
   ways around it before believing the claim it lets you write.**
   `components/passage/PassageRenderer.tsx` serves
   the hover tooltip, the side panel, the timeline modal and the full reader. If you find
   yourself writing a "simple" version for a small surface, stop — universal persistence is free
   only because every view subscribes to the same per-verse atoms. A second renderer silently
   ends that.

3. **The verse-id space is SPARSE.** `1_001_032` encodes fine but Genesis 1 has 31 verses.
   Anything walking a range must intersect against real verses (`getExistingVerseIds`). Expanding
   a range across a chapter or book boundary otherwise invents thousands of phantom verses — this
   already caused one real bug.

## Layout

```
apps/web/          Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4
  src/lib/refs/          verse ids, ranges, reference parsing/formatting  (tested)
  src/lib/decorations/   overlapping-decoration segment splitter          (tested)
  src/lib/db/            corpus.ts = read-only bible.db; userdata.ts = writable annotations
  src/lib/store/         preferences (zustand) + annotations (jotai atomFamily)
  src/components/passage/  THE renderer
packages/ingest/   offline pipeline: raw sources -> data/bible.db. Never runs in prod.
data/bible.db      build artifact, gitignored. 66 books / 31,102 canonical verses / 344,597
                   xrefs / 7 translations / 443,061 original-language word tokens. The canonical
                   count is the ADDRESS SPACE, not any one translation's contents: WEB prints
                   31,095 of it, KJV 31,102, JPS 23,145 (Old Testament only).
scripts/           sync-and-build.sh, teardown.sh
```

Two SQLite files on purpose: `bible.db` is immutable and rebuilt at will; `userdata.db` holds
annotations and must survive every rebuild. Do not merge them.

## Heavy work runs on the VPS, never the laptop

This is not optional and it applies to every tool and agent.

```bash
./scripts/sync-and-build.sh     # push source, install, build, restart preview on :3987
./scripts/teardown.sh           # stop the server and tunnel. RUN THIS WHEN DONE.
```

- No `node_modules` may exist under this repo on the laptop. Author locally, execute remotely.
- `~/.agents/skills/deploy/scripts/vps.sh` calls need the Bash sandbox disabled — port 22 is
  blocked by default and the call otherwise hangs to timeout looking like a dead host.
- **Everything you start on the VPS, you stop.** See the `vps-test-cycle` skill.

## Traps already paid for

- **Never `pkill -f "next start"`.** The ssh command string carrying it also matches, so pkill
  kills its own session mid-command. Kill by port → PID (`ss -tlnp | grep :3987`).
- **A restart that silently fails leaves you testing stale code.** `next start` on a taken port
  exits with `EADDRINUSE` into a log nobody reads. Always confirm the new PID, and check
  `server.log` when behaviour does not match the source.
- **Never `dynamic = "force-static"` on a route handler with query params.** It statically
  renders the handler and the query string arrives empty. Use `NextRequest.nextUrl.searchParams`
  and set cacheability with explicit `Cache-Control` headers instead.
- **Do not join cross-references with a range predicate.**
  `JOIN cross_references x ON v.verse_id BETWEEN x.to_start_verse AND x.to_end_verse` is not
  indexable: 31k × 345k ≈ 10.7 billion comparisons, and it never completes. Expand the ranges in
  application code (~900k steps, ~2s). The validation gate now hard-fails on an empty heat table
  so this cannot regress silently.
- **Never measure a verse range by subtracting ids.** `verse_id` is BBCCCVVV and the space is
  sparse, so numeric distance is not verse distance: Gen 1:31 → Gen 2:3 is four verses apart and
  972 ids apart. The heat materialization walked ids one by one and capped anything >400 ids wide
  as malformed, which silently truncated every cross-chapter target at the chapter boundary —
  3,239 verses undercounted, 4,931 contributions lost, and all 651 "malformed" ranges it warned
  about were ordinary short ones. Expand over the ordered real-verse set. The validation gate now
  recomputes the table a *different way* and fails on disagreement; a gate that reuses the
  implementation's own helper would have reproduced this bug and passed.
- **Verse text is stored plain and NFC-normalized**, with no markup or footnote markers. Character
  offsets for highlights depend on it. Putting markup in `verse_texts` corrupts every annotation.
- **`next/font/google` fails open.** It downloads the face at build time; the build machine has no
  outbound access to fonts.gstatic.com, and Next does not fail the build when that fetch fails —
  it emits the CSS variable with no `@font-face` behind it and every surface silently falls back
  to a system font. The reader shipped in Arial for a while because of this. Fonts are now
  self-hosted via `next/font/local` from `apps/web/src/app/fonts/`; `sync-and-build.sh` asserts
  the built CSS contains at least four `@font-face` rules. Do not "simplify" it back.
- **The upstream WEB distribution has corrupt verse text.** Its producer stripped USFM footnotes
  (`\f … \f*`) without preserving the surrounding whitespace, welding words together inside
  scripture — `"The wind blows"` became `"The windblows"` (John 3:8), and two verses kept the raw
  marker and the footnote body inline. `normalize-text.ts` repairs it and the ingest's validation
  gate re-scans what was actually written, so a refreshed corpus fails loudly rather than shipping
  a corrupted verse. Never weaken that gate to make it quiet; extend the reviewed baseline in
  `dictionary.ts` instead, and only after checking the token against the published translation.
- **An empty verse is never stored.** Twelve New Testament verses are absent from the earliest
  manuscripts; translations following the critical text omit them and the source expresses that as
  an empty string. Stored as text it renders as a blank gap indistinguishable from a bug. It goes
  in `verse_omissions` and renders as apparatus, in place, inside `PassageRenderer`.
- **A canvas `font` string cannot contain `var(--…)`.** It is parsed as CSS shorthand against no
  element, so the custom property never resolves, the assignment is dropped silently, and labels
  fall back to 10px sans-serif. Read the variable with `getComputedStyle` and substitute it.
- **`immutable` caching needs a version, and the URL has none.** The read APIs are pure
  functions of `bible.db`, so they were sent with `max-age=31536000, immutable` — which meant a
  rebuilt corpus stayed invisible to any client that had already fetched, for a year, with no
  way to invalidate. The ingest now stamps a content-derived `corpus_meta.build_id` and
  `lib/db/cache.ts` turns it into an ETag scoped to the request URL. Never claim immutability
  for a resource whose address cannot express which version you meant.
- **A validator behind a long freshness lifetime is unreachable code.** The fix above shipped as
  `max-age=300, s-maxage=31536000` + ETag, which still could not invalidate anything: a cache
  only consults a validator once it considers the entry stale, so a shared cache told the
  response is fresh for a year is never *required* to send `If-None-Match`. Freshness and
  validation are not two mitigations that add up — the freshness window has to be short enough
  to reach the validator. Now `max-age=60, s-maxage=300, stale-while-revalidate=86400`: the
  revalidation actually happens and `stale-while-revalidate` keeps it off the critical path.
- **A fingerprint made of counts and sums is not a fingerprint.** `build_id` was a hash of row
  counts, `SUM(LENGTH(text))` and `SUM(votes)`. Every one of those is invariant under an
  equal-length text correction — precisely the hotfix the WEB whitespace repair produces — so
  the id would not move, and the ETag built on it would serve the corrupted verse from cache
  indefinitely. It now hashes the actual content: books, translations, verses, verse texts,
  omissions, cross-references and the versification map, streamed row by row through one
  `createHash` in a content-ordered pass (never by `xref_id` — it is AUTOINCREMENT, so it
  encodes load order, not meaning). Length-prefix every field; a plain join is not injective.
  Do not build one big string to hash — that is the largest allocation in the pipeline for no
  benefit.
- **A gate that one arbitrary row satisfies is not a gate.** The versification check required
  `COUNT(*) >= 1` mapping row for any translation declaring a non-`org` scheme, so a single
  self-mapped verse bought silence for the other 31,094. It now requires all four properties
  that make the mapping mean anything: every verse the translation prints is mapped, the source
  `(book, chapter, verse)` tuple is unique per translation, and every mapped `verse_id` exists
  in `verses`. That last one is not redundant with the `REFERENCES` clause — **SQLite does not
  enforce foreign keys unless `PRAGMA foreign_keys=ON`**, and only `userdata.db` sets it. Every
  FK in `bible.db` is documentation, not a constraint.
- **An optimistic delete that never rolls back is the one failure the user cannot see.** Create
  and update both restored their prior state on error; delete did not, and the panel closed
  unconditionally so the error never rendered. The note vanished, the server still had it, and
  the next hydration brought it back with no explanation — the app contradicting itself, hours
  later, with no way to tell which state was real. `removeAnnotation` now returns the record it
  removed so the restore is exact, and the panel closes only on success. Any optimistic
  mutation without a rollback path is a bug regardless of how "low-stakes" it looks.
- **Two directional counts do not sum.** `CrossRefPanel` headlined
  `outbound.total + inbound.total`; for John 3 that is 1,438 against 1,406 real records, because
  32 references satisfy both predicates. A record is not two records because you asked about it
  twice. `countUniqueReferences` does one `COUNT(*)` over the union predicate, and the overlap
  is disclosed rather than absorbed. Any headline built by adding two overlapping queries is
  wrong by construction.
- **A control that renders nothing is worse than a missing one.** `crossRefs` and `variants`
  were in `<LayerControls>`, threaded through `PassageRenderer` into `<Verse>`, and read by
  nothing — the switch moved and the page did not. `crossRefs` now governs the cross-reference
  apparatus, `variants` governs the depth of the omission apparatus (never *whether* the gap is
  explained — a toggle that could hide it would reintroduce the bug the omission exists to
  prevent). Before adding a row to that sheet, flip it and find the pixels that move. The same
  rule caught Selah, which claimed to strip every layer while leaving a 40-row cross-reference
  panel beside the text, and the deep-dive cap notice, which told readers to raise `?maxNodes`
  and friends while the fetch sent only `ref`. **Documentation of a control is a claim; go read
  the code that consumes it.**
- **A "capped view" notice is information, not an error.** Anything the tool caps or truncates must
  say so with the real total, in a neutral voice — dressed in the alert palette it reads as a
  malfunction, which destroys exactly the trust the disclosure was meant to build.
- **A correct DOM order is not a reachable one.** The cross-reference aside is a *sibling* of the
  reading column so that at ≥1280px it becomes a real second column. Below that the grid
  collapses to one track and "sibling after the article" means after all of John 3, after the
  pager, and after the copyright — roughly four thousand pixels of scroll, past two markers that
  read as the end of the document, to reach the tool's primary research affordance. It was never
  found. Any panel that is a layout sibling at wide widths needs an explicit decision about what
  it becomes at narrow ones (`<ReaderApparatus>` makes that call: inline aside at desktop,
  pinned launcher plus `<BottomSheet>` below). **Reachability is a separate property from order,
  and only a screenshot at 390px will tell you which one you have.**
- **Mount the panel once, not once per presentation.** The obvious way to add a mobile drawer is
  to render a second `<CrossRefPanel>` inside it. That is two `/api/xrefs` requests for the same
  rows and, worse, two independent copies of the tab and vote-filter state — set "strong links
  only" in the sheet, rotate to landscape, and the docked panel disagrees with it. Choose the
  presentation around one instance.
- **`aria-modal="true"` is not a behaviour.** It is a hint to assistive technology and it does
  nothing for a sighted keyboard user, who tabs straight out of the dialog into the page behind
  the scrim. A modal owes three separate things — focus trap, background `inert`, focus
  restoration — and `<BottomSheet>` and `<NoteComposer>` had drifted to different subsets of
  them. They now share `lib/a11y/modal-surface.ts`; a second copy is how they drift again.
  Two refs there are load-bearing: inerting walks up from the *overlay* (so the scrim stays
  clickable) while the focus trap cycles within the *panel* (so Tab never lands on the scrim).
  And inerting must walk up inerting each ancestor's siblings — inerting `document.body`'s
  children directly inerts an ancestor of the dialog, and `inert` is inherited, so the dialog
  inerts itself.
- **Contrast is a property of a pair, and this app has five surfaces.** `--color-ink-faint` was
  signed off against `--color-bg` and used on `--color-bg-raised`, `--color-bg-sunken`,
  `--color-surface` and `--color-surface-hover` as well. At 58% it measured 4.00:1 on the page
  but 3.50:1 on `--color-surface-hover`, and it dresses 10px tab-bar labels, where the threshold
  is 4.5:1 and not 3:1. **Compute the ratio against the lightest light surface and the lightest
  dark one, never against the page background alone, and record the numbers in a comment beside
  the token** — a value nobody can re-derive gets "simplified" back within a release. Note also
  that oklch→sRGB conversions disagree in the second decimal place between implementations, so
  leave real margin rather than landing on 4.51:1.
- **A 44px touch target cannot be spent on inline text.** Verse marks are apparatus sigla sitting
  inside a line of scripture; `min-width: var(--touch-target)` on one inserts 44px of white space
  into the reading measure. Use an absolutely positioned `::after` — out of flow, so not one
  glyph moves — and grow it to the inline-END only. Growing it leading-ward lays an invisible
  shield over the last characters of the verse, and dragging across those characters is how a
  highlight is made. Scope it to `(pointer: coarse)`, and widen the gap between adjacent marks
  or the later one in document order silently swallows the earlier one's hit area.
- **`order` moves the box and not the tab sequence.** Reordering a chart after the results at
  narrow widths is one line of CSS and it is wrong: a keyboard user tabs from the match count
  into the results and then back *up* the page into the chart. A visual order contradicting
  focus order (WCAG 2.4.3) is a worse defect than the one being fixed, and it fails silently for
  exactly the users least able to recover. Make the thing *smaller* instead — the phone
  distribution keeps its DOM order and drops the bar track for chips.
- **Two search boxes a screen apart is worse than one.** The home page's 66 book pills look like
  they want a type-to-filter, but `<JumpSearch>` already resolves a typed book name through the
  same classifier `/go` runs. Before adding an affordance to a dense index, check whether the
  page already has one and the real defect is that nobody connects the two.

## Conventions

- Every user-facing biblical term (Selah, Masora, Toledot, Qere/Kethiv, Geniza, Testimonia,
  Massa'ot, Lashon, Derash, Seder) ships with a plain-English gloss, in the accessible name and
  not only a visual tooltip. A global "Plain labels" toggle swaps them all for English. Never
  invent a term that is not genuinely used for approximately that purpose.
  **"Global" means sourced from `lib/lexicon.ts`, every time.** A term typed inline is a term
  the toggle cannot reach: `/derash` hardcoded both its `<h1>` and a verbatim copy of the gloss,
  so the nav read "Search" while the page it opened still said "Derash", and the duplicated
  gloss was free to drift from the real one. Glosses inside `<LayerControls>` descriptions count
  too. When a sentence reads badly with the term substituted ("Search Search for…"), write both
  phrasings rather than templating the label into one. Server `metadata.title` is the documented
  exception — it is generated on the server and cannot read a client preference.
- Mobile-first. `density` is semantic intent; `@container` queries handle physical fit. Do not
  express one in terms of the other. Features that need many columns or a large 2-D canvas are
  desktop-only and are **disclosed, not hidden** (`useCapability`).
- Dating and authorship are contested. Store ranges with a tradition and a citation, never a
  scalar year. `citation` is `NOT NULL` on purpose.
- Translation copyright notices travel with the text, not in a global footer.
- Colours come from tokens in `globals.css` (oklch, light+dark). No raw hex in components.

## Before claiming something works

Run it. `npm run build`, `npm run test`, and load the page. Three separate bugs in this repo's
history looked fine in the source and were only caught by executing them.

Then look at the result. `scripts/shoot.mjs` captures every route at every breakpoint in both
themes, and `scripts/measure.mjs` reports the numbers a screenshot cannot: the measure of the
reading column in characters, horizontal overflow and what causes it, and whether scripture is
actually rendering in the typeface it is supposed to. The missing-font bug was invisible in the
source, invisible to the build, invisible to the tests, and obvious in a screenshot.
