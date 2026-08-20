# Work in progress

Living handoff note. Everything here is verified unless it says otherwise — "verified" means a
command was run and its output read, not that the code looks right.

Last verified: corpus build `46fa5be4f7cd1407` rebuilt twice, app built 5×, all gates green
(build, lint, 256 tests, fonts, 13-route smoke), 324 screenshots captured.

## Where the work runs

Nothing heavy runs on the laptop. It has **2 cores**; two agents plus a desktop already put the
load average at 7.6, so every build, test, ingest and screenshot run goes to the VPS.

- `./scripts/sync-and-ingest.sh` — rebuilds `data/bible.db`. ~4 min. Does **not** restart the app.
- `./scripts/sync-and-build.sh` — builds, lints, tests, checks fonts, smoke-tests 13 routes,
  restarts the preview server on `127.0.0.1:3987`. That server IS the live site, behind the
  Cloudflare tunnel at `bible.lucascosolo.com` (and `jot.lucascosolo.com`, 308).
- Screenshots: playwright lives at `/srv/scratch/shotrig`, **not** in the app tree. Run
  `node shoot.mjs /srv/scratch/jot/shots` from there. `npx playwright install chromium` has been
  run; the browser is cached at `/root/.cache/ms-playwright`.

`sync-and-build.sh` pushes the whole `apps/web/src` tree. `docs/` and `packages/` move only via
`sync-and-ingest.sh`.

## Landed this round, verified live

**The P0 — scope conflated with textual omission.** `verse_omissions` held one row per verse for
every book a translation does not include, so JPS 1917's absent New Testament became ~7,957
"omissions".

- Home page: **8,970,825 → 152,062 bytes** (59×). Verified by `curl | wc -c`.
- `verse_omissions`: 7,992 → **35 rows**; new `translation_books` table, 462 rows = 66 × 7.
- `/read/John.3?t=JPS` renders one scope banner naming the six translations that print John,
  instead of 36 repeated paragraphs.

**Counting rows instead of verses.** The home page announced "35 verses that some Bibles leave
out" — a join-table row count across seven translations. `getAllOmissions()` now groups by verse:
**16 distinct verses**, no duplicates.

**Broken omission links (a reopened bug — task #17 was wrongly marked complete).**
`/read/Acts.8.37?t=WEB` returned **404**. Two independent causes, both fixed:

1. `printedBy` was "the first translation whose code differs from the omitting one", which with
   five critical-text editions loaded usually named another edition that omits the same verse.
   Now resolved from `verse_texts` — the only table that knows.
2. The reader 404'd on `verses.length === 0 && omissions.size === 0`. There is a **third** case:
   the ingest records an omission only where the source supplies an empty string, so a source
   that simply *skips* a verse leaves no row at all. WEB does exactly that for Acts 8:37 and
   Acts 15:34. The guard is now `getExistingVerseIds(range).length === 0`, and the empty case
   renders `<OutOfScopeNotice subject={reference}>`.

All 16 home-page omission links verified 200, and `Acts.8.37?t=KJV` verified to contain the text.

**Greek glosses.** Dodson Greek Lexicon (CC0), 5,410 entries, gate at 98%, **measured 99.0266%**
of 137,554 Greek tokens. 440 unresolved, dominated by `οὕτω(ς)`×207 and proper nouns.

**Design-review fixes.** Contrast (`--color-ink-on-accent` was 1.70:1 on mint in dark, on four
surfaces not one); focus ring moved off rubric red; print stylesheet; `data-chrome`; theme and
Guide reachable below 1280px; translation panel no longer overflows at 390px; scroll-shadow
affordance on `AnchoredPanel`; selection toolbar flips above the selection via
`--toolbar-flip` (a custom property, because a running animation's transform beats an inline
one); apparatus launcher icon-only below 30rem plus reserved tail padding on `.reader`; wordmark
tittle no longer overshoots the ascender; `GlossLabel` underline solid, not dotted (it read as a
spell-check squiggle); `1Pet 2:9` → `1 Peter 2:9` via `formatRange` rather than a local
`osisRef.split(".")`; `/lashon` no longer prints the OSIS id under all ~245 rows (the guard
compared `"Gen 19 19"` against `"Genesis 19:19"` — two strings that can never be equal).

**Guided-tour setup screen** (user request). `TourSetup.tsx` + `/api/translations` + 7 tests.
Second-to-last tour step; writes through to the real preferences store, not a draft; new
`resetSettings()` action deliberately does not touch `lastRead` or `tourSeen`.

**New gates.** Backtick-in-SQL-comment check in `sync-and-ingest.sh` (that mistake cost three
build cycles); dark-block token lockstep and a 4.5:1 floor on `--color-ink-on-accent` in
`globals.test.ts`.

## Verified this continuation

The fresh interaction screenshots and selected states were opened. The reader, guided tour,
settings sheet, selection toolbar, dark mode and interlinear states are visually coherent; the
layout harness reports no sideways overflow and reader measures remain within the intended range.
The newly added comparison is readable at 390px and 1280px, the notes empty state is calm with a
visible Markdown export, and the `⌘K` palette is a compact modal that keeps the reader behind it.
One earlier Greek interlinear capture appeared clipped and remains a targeted follow-up rather than
an accepted claim.

## The goal condition

Both adversarial reviews returned **NOT YET**. Neither has been re-run since any of the above
landed. The design reviewer named what would change its mind:

> the home page telling the truth and being under 5,000 px; a parallel view of two or more of the
> seven translations, verse-aligned, at 390 px as well as 1280; the transliteration and full
> parsing visible in the interlinear without a hover; an English gloss on the Greek; the `⸀` marks
> resolving to a cited apparatus; a notes index with export; and `⌘K`, `←`/`→`, a copy-citation
> button and a print stylesheet.

Done since: home page, Greek gloss, `⸀` caption, `←`/`→`, copy-citation, print stylesheet,
verse-aligned parallel translations at `/parallel/<ref>`, the `/notes` index with Markdown export,
and the global `⌘K`/`Ctrl-K` palette.

## Traps that have already cost time

- **Backticks in the SQL template literal in `ingest.ts`.** They end the JS string and the parse
  error surfaces twenty lines later as `',' expected`. Gated now.
- **Components may not import `@/lib/db/corpus`** (AGENTS.md invariant #2). Formatting that needs
  corpus data belongs on the page, passed down. The lint rule catches it at build time.
- **`vitest` has no `globals: true`,** so testing-library registers no automatic cleanup. Call
  `cleanup()` in `afterEach` or renders stack and `getByRole` fails as "multiple elements".
- **`position: sticky` always creates a stacking context** — every modal portals to `<body>`.
- **CSS fails open.** An invalid declaration is discarded silently; that is why `globals.test.ts`
  exists.
