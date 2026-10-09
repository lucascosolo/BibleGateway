# Follow the evidence plan

Scoped on 2026-10-08 from the two external reviews in `docs/reviews/2026-10-08-chatgpt-astra-6-feedback.md`
and `docs/reviews/2026-10-08-chatgpt-extrabiblical-sources-feedback.md`, after a source-level check
of each claim they make. Decisions taken with the user the same day: a quiet graded review marker
(no banner); scope is the four trust repairs plus one reusable passage-investigation panel plus two
reviewed case studies; the Septuagint evidence comes from extending the Brenton pilot to the
Pentateuch. Related ancient texts and the canon view are the release after this one.

**Goal:** a reader on any verse can open an investigation that shows every edition's wording, the
translator's own footnotes, the original words, the manuscript witnesses, and attributed arguments
with page citations and a visible review grade; and nothing the site already shows mislabels its
evidence.

**Approach:** repair the four labelling defects first (omissions, the Genesis 2:21 note, composition
dates inside event envelopes, invisible review status), then add the panel as a new content type in
the existing timeline package so investigations get the same citation machinery, validation and
margin-note delivery that events and issues already have. The alternative, a separate
`investigations` database and renderer in the web app, was rejected: it would duplicate the citation
and verse-anchoring code and break the one-renderer invariant the moment it printed scripture.

**Constraints:** (copied from AGENTS.md and the reviews)
- `verse_id` is the only address; investigations anchor by verse ranges like every other entity.
- Exactly one scripture renderer: the panel prints scripture only through `PassageRenderer`.
- Verse text stays plain; translator footnotes are stored in their own table, never in `verse_texts`.
- `citation` is NOT NULL on every dated or argued claim; a view without a citation fails the build.
- Every user-facing term ships with a lexicon gloss; the review grades are lexicon entries.
- Colours from tokens only.
- Production deploy needs an explicit yes each time; the web release and the corpus rebuild are two deploys.
- Heavy work (re-ingest, builds, tests) runs on this PC; hermes only receives artifacts.

## Verified findings behind the plan

| Review claim | Verified in code | Consequence |
|---|---|---|
| Nehemiah and Lamentations gaps explained by NT manuscripts | `packages/ingest/src/translations.ts:258,324`: one reason string for every omission; the 21 OT rows are Brenton (LXX) gaps in Nehemiah (17) and Lamentations (4), a Septuagint numbering difference; the home copy at `apps/web/src/components/home/CorpusDoorways.tsx:86-93` says "New Testament" | Chunk 1 |
| Genesis 2:21 note states "side" as settled and "split in half" as fact | `apps/web/src/lib/insights/notes.ts:68`, no source; Jot's own lexicon entry H6763 lists rib and side | Chunk 2 |
| Exodus envelope −1279..−550 mixes writing date | `packages/timeline/content/events/exodus.toml` position `finkelstein-silberman` −650..−550 is a composition date; `build.py:694-703` takes min/max over all non-traditional positions | Chunk 3 |
| All entities `draft`, `EntityShell` ignores `status` | `apps/web/src/components/toledot/EntityShell.tsx:10-22`; schema allows only `draft`/`reviewed` | Chunk 4 |
| Cross-reference filter says "confidence", home says "cited by" | `CrossRefPanel.tsx:128,153`, `CorpusDoorways.tsx:64` | Chunk 5 |
| USFX parser strips footnotes | `packages/ingest/src/usfx.ts:71,175-178` removes `f`, `fe`, `x` spans; no footnote table exists | Chunk 6 |
| Apparatus witnesses are a raw string | `packages/ingest/src/varapp.ts:66-77`; `GreekManuscriptApparatus.tsx:45` prints it as-is | Chunk 8 (typed witnesses for the two case studies only; full VarApp parsing deferred) |
| Brenton covers four books | `translations.ts:74-100`, `includedBookIds: [16, 25, 35, 37]`, identity map verified only there | Chunk 9 |

## Files
- Modify: `packages/ingest/src/translations.ts:230-340` — omission kinds and per-kind explanations; Brenton book list
- Modify: `packages/ingest/src/ingest.ts:563-569,1046-1067,1238-1266,2040-2077` — `kind` column, kind-aware gate, footnote table
- Modify: `packages/ingest/src/usfx.ts:71,175-178` — capture `f`/`fe` spans before deletion
- Create: `packages/ingest/src/footnotes.ts` — footnote span parser (caller, reference, text)
- Create: `packages/ingest/src/footnotes.test.ts`, `packages/ingest/src/omissions.test.ts`
- Modify: `apps/web/src/lib/db/apparatus.ts:186` — omissions carry `kind`; new `getFootnotes(verseIds, translationId)`
- Modify: `apps/web/src/components/home/CorpusDoorways.tsx:60-125` — per-kind copy; "linked from"
- Modify: `apps/web/src/components/crossrefs/CrossRefPanel.tsx:128-153`, `apps/web/src/lib/crossrefs/tiers.ts:39-47` — relevance wording
- Modify: `apps/web/src/lib/insights/notes.ts` — required `source`, `alternatives`, rewritten notes
- Modify: `apps/web/src/components/passage/InsightNotes.tsx:40-60` — render alternatives and source
- Modify: `packages/timeline/build.py:45-49,377-437,694-703` — `dates` on positions; statuses; `investigations` content type
- Modify: `packages/timeline/schema.sql:44,72-84,101,131,150` — status check; `position.dates`; investigation tables
- Create: `packages/timeline/content/investigations/deut-32-8-9.toml`, `gen-2-21-23.toml`
- Modify: `packages/timeline/content/events/exodus.toml` and the nine events listed in chunk 3
- Create: `packages/timeline/tests/test_positions_dates.py`, `test_investigations.py`, `test_status.py`
- Modify: `apps/web/src/lib/db/timeline.ts` — investigation queries; status on summaries already present
- Modify: `apps/web/src/components/toledot/EntityShell.tsx` — review marker
- Modify: `apps/web/src/lib/lexicon.ts` — glosses for the three review grades and "investigation"
- Create: `apps/web/src/components/toledot/ReviewMarker.tsx` (+ test)
- Create: `apps/web/src/app/toledot/investigations/[id]/page.tsx`, `apps/web/src/components/toledot/Investigation.tsx` (+ tests)
- Modify: `apps/web/src/lib/timeline/notes.ts` — investigation margin-note sentence
- Modify: `apps/web/src/app/sitemap.ts` — investigation URLs
- Modify: `apps/web/src/app/toledot.css` — marker, investigation layout
- Modify: `docs/sources/*.md`, `packages/timeline/content/sources.toml` — the case-study sources

## Chunk 1: omissions are classified, and the home page says what each class is
Files: `packages/ingest/src/translations.ts`, `packages/ingest/src/ingest.ts`, `packages/ingest/src/omissions.test.ts`, `apps/web/src/lib/db/apparatus.ts`, `apps/web/src/components/home/CorpusDoorways.tsx`, `apps/web/src/components/home/CorpusDoorways.test.tsx`
Interfaces: `verse_omissions.kind TEXT NOT NULL CHECK (kind IN ('critical-text','versification','coverage','unexplained'))`; `omissionExplanation(translation: TranslationSource, verseId: VerseId): { kind, reason, history }`; `getAllOmissions()` rows gain `kind`.
Steps:
- [ ] failing test `packages/ingest/src/omissions.test.ts` (vitest, same runner as `apps/web`):
  ```ts
  import { describe, expect, it } from "vitest";
  import { omissionExplanation, TRANSLATION_SOURCES } from "./translations";
  const lxx = TRANSLATION_SOURCES.find((t) => t.code === "LXX")!;
  const bsb = TRANSLATION_SOURCES.find((t) => t.code === "BSB")!;
  describe("omissionExplanation", () => {
    it("labels a Septuagint numbering gap as versification, never as a Greek NT omission", () => {
      const e = omissionExplanation(lxx, 16_004_006); // Nehemiah 4:6
      expect(e.kind).toBe("versification");
      expect(e.reason).not.toMatch(/New Testament|Greek copies/);
      expect(e.reason).toMatch(/Septuagint|numbering/);
    });
    it("labels a known critical-text verse with its history", () => {
      const e = omissionExplanation(bsb, 40_017_021); // Matthew 17:21
      expect(e.kind).toBe("critical-text");
      expect(e.history).toMatch(/Matthew 17:21|Mark 9:29/);
    });
    it("marks any other gap unexplained with neutral wording", () => {
      const e = omissionExplanation(bsb, 1_001_031);
      expect(e.kind).toBe("unexplained");
      expect(e.reason).toMatch(/not printed|no explanation/i);
      expect(e.reason).not.toMatch(/manuscript/);
    });
  });
  ```
- [ ] run `cd packages/ingest && npx vitest run src/omissions.test.ts`; expected: FAIL, `omissionExplanation` takes one argument and returns no `kind`
- [ ] implementation: in `translations.ts` add `export type OmissionKind = "critical-text" | "versification" | "coverage" | "unexplained"`; `omissionExplanation(t, verseId)` returns `critical-text` when `verseId` is in `OMISSION_HISTORY` (keep the existing reason and history), `versification` when `t.versification !== "org"` and the verse is outside the NT (reason: "This edition follows the Septuagint's chapter and verse numbering, which differs from the Hebrew numbering used for addresses here; this verse has no counterpart in it. The text is not missing from the translation, only from this numbering."), otherwise `unexplained` (reason: "This edition does not print this verse and the source data gives no explanation. It is recorded so the gap is visible, not hidden."). `coverage` is reserved for books listed in `translation_books` and is never written per verse. In `ingest.ts` add the `kind` column to the CREATE TABLE and the insert; extend the gate at 2040-2077 so a `critical-text` row outside books 40-66 fails the build with the verse id.
- [ ] run the test; expected: PASS
- [ ] web: `getAllOmissions()` selects `kind`; `CorpusDoorways.tsx` groups by kind: heading "{n} New Testament verses that some Bibles leave out" for critical-text with the existing paragraph; a second list "{n} verses with a different numbering in Brenton's Septuagint" with one sentence of explanation; unexplained gaps listed under "Gaps the source data does not explain". Add `CorpusDoorways.test.tsx` case: given one versification row and one critical-text row, the NT paragraph's count is 1 and the Septuagint heading is present.
- [ ] rebuild the corpus here: `cd packages/ingest && npm run ingest` (writes `~/.cache/jot/data/bible.db`), read the census lines for `omittedManuscript` per translation; expected: LXX rows are all `versification`, BSB/ASV/DBY rows are all `critical-text`, zero `unexplained`
- [ ] commit: `git commit -m "Omissions carry a kind: critical-text, versification, coverage or unexplained; the home page explains each kind in its own words and no Old Testament gap is attributed to Greek New Testament manuscripts"`
Success criteria: `npx vitest run --reporter=json --outputFile=$TMPDIR/ingest.json` in `packages/ingest` reports 0 failures; `sqlite3 bible.db "select kind,count(*) from verse_omissions group by 1"` prints only `critical-text` and `versification`.

## Chunk 2: insight notes carry a source and present the alternatives
Files: `apps/web/src/lib/insights/notes.ts`, `apps/web/src/lib/insights/notes.test.ts`, `apps/web/src/components/passage/InsightNotes.tsx`, `apps/web/src/components/passage/InsightNotes.test.tsx`
Interfaces: `interface InsightNote { id; verseId; text; alternatives?: string; source: string }` (`source` required).
Steps:
- [ ] failing test `notes.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { INSIGHT_NOTES } from "./notes";
  describe("insight notes", () => {
    it("every note names its source", () => {
      for (const n of INSIGHT_NOTES) expect(n.source, n.id).toMatch(/\S/);
    });
    it("the Genesis 2:21 note presents rib and side as competing readings", () => {
      const n = INSIGHT_NOTES.find((x) => x.id === "gen2-21-tsela")!;
      expect(n.text).toMatch(/rib/);
      expect(n.text).not.toMatch(/split the human in half|not a translation/);
      expect(n.alternatives).toMatch(/Eichler/);
    });
    it("no note claims a word 'literally' means one thing", () => {
      for (const n of INSIGHT_NOTES) expect(n.text, n.id).not.toMatch(/literally means/);
    });
  });
  ```
- [ ] run `cd apps/web && npx vitest run src/lib/insights`; expected: FAIL on the tsela note and on the three notes without a source
- [ ] implementation: rewrite `gen2-21-tsela` as: the Hebrew is tsela, which elsewhere in the Bible means the side of a structure (the tabernacle, the temple) and is rendered "rib" here by the ancient versions and most translations; `alternatives`: "Raanan Eichler argues for 'side', taking the verse as one half of the first human, while allowing that 'rib' remains possible; the Septuagint, Vulgate and the English tradition read 'rib'. Jot's lexicon entry H6763 lists both." `source`: "BDB, tsela (H6763); Raanan Eichler, 'When God Took Adam's Rib', TheTorah.com (2020)". Rewrite `isa6-3-kavod` to say kavod is formed from the root for heaviness and in use means honour, importance, splendour, and that the weight image is one reading, not the meaning; keep the BDB source. Give `matt1-1-christos` the source "BDAG, christos; LSJ, chriō" and `gen26-30-covenant-meal` the source "Kitchen, On the Reliability of the Old Testament (2003), pp. 323-324 (treaty meals in Genesis 21, 26, 31)" (page numbers from `docs/sources/kitchen-2003.md`). `InsightNotes.tsx` renders `alternatives` as a second sentence group introduced by "Other readings:" and the source as now.
- [ ] run the tests; expected: PASS
- [ ] commit: `git commit -m "Insight notes name their sources and present competing readings; the Genesis 2:21 note no longer states 'side' and a halved human as settled fact"`
Success criteria: `npx vitest run src/lib/insights src/components/passage/InsightNotes.test.tsx --reporter=json --outputFile=$TMPDIR/insights.json` reports 0 failures.

## Chunk 3: composition dates leave the event envelope
Files: `packages/timeline/build.py`, `packages/timeline/schema.sql`, `packages/timeline/tests/test_positions_dates.py`, `packages/timeline/content/events/exodus.toml` and the nine events named below, `apps/web/src/lib/db/timeline.ts`, `apps/web/src/app/toledot/events/[id]/page.tsx`
Interfaces: position field `dates = "event" | "composition"` (default `"event"`); `positions.dates TEXT NOT NULL DEFAULT 'event'`; `EventDetail.compositionPositions: Position[]`; envelope uses event-dated positions only.
Steps:
- [ ] failing test `packages/timeline/tests/test_positions_dates.py`:
  ```python
  import unittest
  from build import envelope  # the min/max logic at build.py:694-703, extracted into a function
  POS = [
      {"tradition": "critical", "earliest": -1279, "latest": -1213, "dates": "event"},
      {"tradition": "critical", "earliest": -650, "latest": -550, "dates": "composition"},
      {"tradition": "traditional", "earliest": -1450, "latest": -1440, "dates": "event"},
  ]
  class Envelope(unittest.TestCase):
      def test_composition_positions_do_not_widen_the_event_envelope(self):
          e = envelope(POS)
          self.assertEqual((e["earliest"], e["latest"]), (-1279, -1213))
          self.assertEqual((e["trad_earliest"], e["trad_latest"]), (-1450, -1440))
      def test_an_event_with_only_composition_positions_has_no_envelope(self):
          self.assertIsNone(envelope([POS[1]])["earliest"])
  ```
- [ ] run `python3 -m unittest discover -s packages/timeline/tests`; expected: FAIL, no `envelope` function
- [ ] implementation: extract `envelope(positions)`; validate `dates` against `{"event", "composition"}` with default `"event"`; add the column to `schema.sql` and the insert; an event whose positions are all composition-dated must have `axis = "composition"` or the build errors ("event X has only composition-dated positions; set axis = \"composition\""). Content: in `exodus.toml` set `dates = "composition"` on `finkelstein-silberman`; check and fix the nine events the grep flagged (abraham-migration, conquest-of-canaan, crucifixion-of-jesus, jacob-descent-egypt, jerusalem-fall, josiah-reform, judges-period, moabite-revolt, paul-arrest-felix-festus) by reading each position's label; where a position is a writing date, mark it. Web: `getEvent` returns `compositionPositions` separately; the event page renders them under a heading "When the story was written" with the same position component; the strip and catalogue use the narrowed envelope automatically.
- [ ] run the tests and `python3 -I packages/timeline/build.py --content packages/timeline/content --corpus ~/.cache/jot/data/bible.db --out ~/.cache/jot/data/timeline.db.new`; expected: PASS, build ok, and `sqlite3 timeline.db.new "select earliest,latest from events where id='exodus'"` prints `-1279|-1213`
- [ ] commit: `git commit -m "Timeline positions say whether they date the event or the writing of its story; composition dates no longer widen an event's envelope, and the event page shows them under their own heading"`
Success criteria: the unittest run reports OK with the two new tests; the exodus row above.

## Chunk 4: a quiet review grade on every entity
Files: `packages/timeline/build.py:45-49`, `packages/timeline/schema.sql`, `packages/timeline/tests/test_status.py`, all `packages/timeline/content/**/*.toml`, `apps/web/src/lib/lexicon.ts`, `apps/web/src/components/toledot/ReviewMarker.tsx`, `ReviewMarker.test.tsx`, `EntityShell.tsx`, `apps/web/src/app/toledot.css`
Interfaces: `STATUSES = {"draft", "sources-located", "claims-checked", "expert-reviewed"}`; `ReviewStatus` union in `apps/web/src/lib/db/timeline.ts` matches; `<ReviewMarker status />` renders one sentence from the lexicon.
Steps:
- [ ] failing test `test_status.py`: building a content tree whose event has `status = "reviewed"` reports the error `unknown status 'reviewed'`; and a tree with `status = "claims-checked"` builds. (Use the existing test fixture pattern in `packages/timeline/tests`.)
- [ ] failing test `ReviewMarker.test.tsx`: renders "Sources located; claims not yet checked against them." for `sources-located`, "Claims checked against the cited pages." for `claims-checked`, "Reviewed by a subject expert." for `expert-reviewed`, and "Draft." for `draft`; the element has `role="note"` and the lexicon gloss in `aria-label`.
- [ ] run both; expected: FAIL
- [ ] implementation: statuses in `build.py` and `schema.sql`; migrate content with a one-off script that sets `sources-located` everywhere a `draft` entity has at least one non-Wikipedia citation and leaves `draft` otherwise; set `claims-checked` on `issues/patriarchs-historicity.toml` (every quotation was verified against the page text on 2026-10-08) and on `events/second-temple-built.toml`. Lexicon entries `review-sources-located`, `review-claims-checked`, `review-expert-reviewed` with plain-English glosses. `EntityShell` destructures `status` and renders `<ReviewMarker>` beneath `meta`. CSS: `.toledot-review` in `--color-ink-faint` on `--color-bg`, 0.875rem.
- [ ] run tests; expected: PASS. Rebuild the timeline database; `sqlite3 timeline.db.new "select status,count(*) from events group by 1"` shows no `draft` rows for cited events.
- [ ] commit: `git commit -m "Timeline entities carry a review grade (draft, sources located, claims checked, expert reviewed) shown as one quiet sentence on each page"`
Success criteria: unittest OK; `npx vitest run src/components/toledot --reporter=json --outputFile=$TMPDIR/toledot.json` 0 failures.

## Chunk 5: cross-reference wording stops implying evidential strength
Files: `apps/web/src/components/crossrefs/CrossRefPanel.tsx`, `apps/web/src/lib/crossrefs/tiers.ts`, `apps/web/src/components/crossrefs/CrossRefPanel.test.tsx`, `apps/web/src/components/home/CorpusDoorways.tsx`
Steps:
- [ ] failing test: `CrossRefPanel` renders a control with `aria-label="Minimum community relevance"` and the empty-state text contains "relevance", not "confidence"; `CorpusDoorways` renders "linked from" and never "cited by".
- [ ] run; expected: FAIL
- [ ] implementation: rename labels; `TIER_META` descriptions say "votes from OpenBible readers" explicitly.
- [ ] run; expected: PASS; commit: `git commit -m "Cross-reference filter is labelled community relevance and the home page says 'linked from'; neither implies evidential strength"`
Success criteria: the two test files pass in the vitest JSON report.

## Chunk 6: translator footnotes survive ingestion in their own table
Files: `packages/ingest/src/usfx.ts`, `packages/ingest/src/footnotes.ts`, `packages/ingest/src/footnotes.test.ts`, `packages/ingest/src/ingest.ts`, `apps/web/src/lib/db/apparatus.ts`
Interfaces: `CREATE TABLE verse_footnotes (translation_id, verse_id, note_order, caller TEXT, kind TEXT CHECK (kind IN ('footnote','endnote','crossref')), text TEXT NOT NULL, PRIMARY KEY (translation_id, verse_id, note_order))`; `parseFootnotes(verseXml: string): Footnote[]`; `getFootnotes(verseIds: VerseId[], translationId): Footnote[]`.
Steps:
- [ ] failing test `footnotes.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { parseFootnotes } from "./footnotes";
  describe("parseFootnotes", () => {
    it("extracts the note text and caller from a USFX f span", () => {
      const xml = `In the beginning<f caller="+"><fr>1:1 </fr><ft>Or <fq>When God began to create</fq></ft></f> God created`;
      expect(parseFootnotes(xml)).toEqual([{ caller: "+", kind: "footnote", text: "1:1 Or When God began to create" }]);
    });
    it("keeps cross-reference notes apart from footnotes", () => {
      const xml = `text<x caller="-"><xo>1:1 </xo><xt>John 1:1</xt></x>`;
      expect(parseFootnotes(xml)[0].kind).toBe("crossref");
    });
  });
  ```
- [ ] run; expected: FAIL (module missing)
- [ ] implementation: `parseFootnotes` runs on each verse's raw XML before `usfx.ts:175` deletes the spans; `ingest.ts` writes rows; the existing gate that scans `verse_texts` for markers stays. `getFootnotes` in the web db layer, allowed outside `src/app/**` only as a type import per the eslint boundary (the query itself lives in `lib/db`).
- [ ] run; expected: PASS. Re-ingest; census prints footnote counts per translation (expected: BSB, ASV, DBY, YLT, KJV > 0; WEB 0 with a note that its source strips them).
- [ ] commit: `git commit -m "Translator footnotes are kept in verse_footnotes at ingest instead of being deleted; scripture text stays plain"`
Success criteria: vitest JSON report 0 failures; `sqlite3 bible.db "select translation_id,count(*) from verse_footnotes group by 1"` lists five translations.

## Chunk 7: the investigation content type and its page
Files: `packages/timeline/build.py`, `packages/timeline/schema.sql`, `packages/timeline/tests/test_investigations.py`, `apps/web/src/lib/db/timeline.ts`, `apps/web/src/app/toledot/investigations/[id]/page.tsx`, `apps/web/src/components/toledot/Investigation.tsx`, `Investigation.test.tsx`, `apps/web/src/lib/timeline/notes.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/src/lib/lexicon.ts`, `apps/web/src/app/toledot.css`
Interfaces (TOML):
```toml
id = "deut-32-8-9"
title = "Sons of Israel or sons of God? Deuteronomy 32:8-9"
status = "claims-checked"
ref = "Deut.32.8-Deut.32.9"
summary = """..."""
[[witnesses]]           # what is directly observable
siglum = "MT"           # free text, expanded by `name`
name = "Masoretic Text (Leningrad Codex)"
reading = "בני ישראל"
translation = "the sons of Israel"
language = "hbo"
note = "..."
citations = [{ source = "...", locator = "..." }]
[[editions]]            # which English editions follow which witness
code = "WEB"
follows = "MT"
[[differences]]         # the explanation
kind = "textual"        # textual | lexical | grammatical | stylistic | interpretive | editorial
text = """..."""
held_by = "Emanuel Tov"
citations = [{ source = "...", locator = "..." }]
[[challenges]]          # what argues against it
text = """..."""
citations = [...]
```
Tables: `investigations`, `investigation_witnesses`, `investigation_editions`, `investigation_differences`, `investigation_challenges`, `investigation_citations`, `investigation_verses` (verse anchors through the existing anchor code). Web: `getInvestigation(id)`, `getInvestigationSummaries()`, `getInvestigationsForVerses(verseIds)`; margin note sentence "An investigation looks at the wording of …: N witnesses, M explanations."
Steps:
- [ ] failing test `test_investigations.py`: a minimal investigation with one witness, one edition and one difference builds and writes one row in each table; a difference without citations fails with `needs at least one citation`; an unknown `kind` fails; `follows` naming no witness fails.
- [ ] run; expected: FAIL
- [ ] implementation in `build.py` following the issues loader at 480-504 (same `citations()` and `verses()` helpers, same report object).
- [ ] run; expected: PASS
- [ ] failing test `Investigation.test.tsx`: renders witnesses in a table (siglum, name, reading, translation), the edition list grouped by witness, each difference under a heading from its kind with the lexicon gloss, challenges, and `<ReviewMarker>`; scripture for `ref` is rendered through `PassageRenderer` (assert the mock renderer is called with the verse range).
- [ ] implementation of the page and component; the margin-note shape in `notes.ts` with a test; sitemap entries.
- [ ] run `npx vitest run`; expected: PASS. `npm run lint` passes the one-renderer rule.
- [ ] commit: `git commit -m "Toledot investigations: a content type for a passage's witnesses, editions, explanations and challenges, built into timeline.db, with its page and reader margin note"`
Success criteria: unittest OK; vitest JSON report 0 failures; `npm run lint` clean; `/toledot/investigations/<fixture>` returns 200 from a local `next start` with the env paths set.

## Chunk 8: the panel shows editions, footnotes, original words and apparatus for the passage
Files: `apps/web/src/components/toledot/Investigation.tsx`, `apps/web/src/components/toledot/InvestigationEditions.tsx` (+ test), `apps/web/src/lib/db/apparatus.ts`, `apps/web/src/app/toledot/investigations/[id]/page.tsx`
Interfaces: the page loads, for the investigation's verse range, every translation's text through one `PassageRenderer` per edition (the same component, with layers off), `getFootnotes` per edition, the existing original-language words, and `GreekManuscriptReading` rows for NT passages; witness sigla in VarApp strings are expanded only where the investigation's own `witnesses` list names them (the general VarApp parser is deferred).
Steps:
- [ ] failing test: `InvestigationEditions` given two editions and one footnote renders two renderer instances and the footnote under its edition with its caller.
- [ ] run; expected: FAIL
- [ ] implementation; the layout is two columns at 1280px and stacked below, following `<ReaderApparatus>`'s pattern so the apparatus stays reachable at 390px.
- [ ] run; expected: PASS. Screenshot the page at 390px and 1280px with `scripts/shoot.mjs` and check that no edition column overflows (`scripts/measure.mjs`).
- [ ] commit: `git commit -m "Investigation page shows each edition's wording through the one renderer, its translator footnotes, the original words and the manuscript readings beside the attributed explanations"`
Success criteria: vitest JSON 0 failures; `measure.mjs` reports no horizontal overflow on the route at either width.

## Chunk 9: Brenton's Septuagint covers the Pentateuch where the verse map is identity
Files: `packages/ingest/src/translations.ts:74-100`, `packages/ingest/src/brenton-map.test.ts`, `packages/ingest/scripts/check-brenton-identity.ts`
Steps:
- [ ] write `check-brenton-identity.ts`: for books 1-5, compare Brenton's chapter and verse labels in the eBible source with the canonical `verses` table; print per chapter `identity`, `extra`, `missing`, `shifted`.
- [ ] run it; expected output recorded in the plan's execution notes. Known risk: Exodus 36-39 is ordered differently in the Septuagint; if any chapter of a book is not identity, that book stays withheld and the scope note says so.
- [ ] failing test `brenton-map.test.ts`: the included book list contains 5 (Deuteronomy) and the scope note names the books included.
- [ ] implementation: extend `includedBookIds` with the books the check proved identity for (Deuteronomy at minimum; Genesis, Leviticus, Numbers if clean); update `scopeNote` and `expectedVerses`; re-ingest; the existing versification gate must pass for every added book.
- [ ] commit: `git commit -m "Brenton's Septuagint extended to the Pentateuch books whose verse labels map identically; Exodus withheld if its chapter order differs"`
Success criteria: ingest census lists the new books under LXX with zero `unexplained` omissions; the gate passes.

## Chunk 10: two reviewed case studies
Files: `packages/timeline/content/investigations/deut-32-8-9.toml`, `gen-2-21-23.toml`, `packages/timeline/content/sources.toml`, `docs/sources/tov-tchb.md` (or the article ledger), `docs/sources/eichler-2020.md`
Steps:
- [ ] sources: ask the user for Emanuel Tov, Textual Criticism of the Hebrew Bible (3rd ed., 2012), the pages on Deuteronomy 32:8 (or his TheTorah.com article "The Sons of Israel or God?"), and Raanan Eichler's TheTorah.com article "Gender Equality at Creation" plus, if available, his JBL article on tsela; file each under `~/.cache/jot/sources/<id>/` with a ledger. The 4QDeut^j reading, the Septuagint readings (angelōn theou / huiōn theou) and the MT reading come from those sources and from Brenton's Deuteronomy once chunk 9 lands.
- [ ] write `deut-32-8-9.toml`: witnesses MT, 4QDeut^j, LXX (both Greek readings), Vulgate; editions WEB, BSB, KJV, ASV, DBY, YLT, JPS, LXX with `follows`; differences: one `textual` (the witnesses differ) with Tov's explanation attributed to him, one `interpretive` (the divine-council reading) attributed; challenges: the view that "sons of Israel" is original, attributed with a citation; status `claims-checked` after every quotation is verified against the page text with the fact checker used on 2026-10-08.
- [ ] write `gen-2-21-23.toml`: witnesses MT (tsela), LXX (pleura), Vulgate (costa); editions; differences `lexical` (side vs rib, BDB range and the tabernacle uses) and `interpretive` (Eichler's half); challenge: the ancient versions' unanimity on rib; status `claims-checked`.
- [ ] build and run the fact checker; expected: build ok, every quotation found.
- [ ] commit: `git commit -m "Investigations: Deuteronomy 32:8-9 and Genesis 2:21-23 with witnesses, editions, attributed explanations and challenges"`
Success criteria: both pages render locally with every witness row and at least one difference; the fact checker prints no missing quotation.

## Chunk 11: full verification and two deploys
Files: none new
Steps:
- [ ] `cd apps/web && npm run lint && npx vitest run --reporter=json --outputFile=$TMPDIR/web.json && npm run build` with the env paths set; read the JSON counts.
- [ ] `python3 -m unittest discover -s packages/timeline/tests`; `npx vitest run` in `packages/ingest`.
- [ ] `scripts/shoot.mjs` and `scripts/measure.mjs` on `/`, `/read?ref=Gen.1`, `/toledot/investigations/deut-32-8-9`, `/toledot/events/exodus` at 390px and 1280px, both themes.
- [ ] stage on hermes: `bible.db` (new, with kinds and footnotes) to `/srv/jot/releases/bible-<sha>.db`, `timeline.db`, the web tar; ask for the explicit yes; deploy with the same archive-and-swap script shape as `deploy-190cd19.sh`; probe the five routes and a Range request.
Success criteria: all three test reports show 0 failures; the public routes return 200; the home page's omission heading says "New Testament verses" with the critical-text count only.

## Open questions
- Sources for chunk 10 (Tov; Eichler) are not on disk. The plan assumes the user supplies them as PDFs or links, as with every other source.
- Chunk 9's result decides whether Exodus joins the Septuagint edition; the plan ships Deuteronomy regardless.
- Whether `coverage` gaps (whole books a translation lacks) should appear on the home page at all; the plan keeps them in the passage banner only.
- The review's "revision history" per claim is not in scope; git history on the content files is the record.

## Deferred to the next release
Related ancient texts (six works, 20-30 connections), the canon and collections view, full VarApp witness parsing with NTVMR links, the synopsis for Gospel parallels, and lemma-to-phrase alignment in Lashon.

## Execution notes, chunk 9

2026-10-08. `packages/ingest/scripts/check-brenton-identity.ts` run against `eng-Brenton_usfx.zip` (sha256 15b551aa…) and `bible.db.new`, with content-shift detection: a label present in both whose Brenton words match a different KJV verse of the book clearly better (Jaccard ≥0.30 and ≥0.15 above the same label). The method was checked on the existing pilot first: Habakkuk and Haggai come out identity; Nehemiah and Lamentations show only missing labels (the 21 recorded versification omissions), no extra or shifted ones.

| Book | Non-identity chapters | Label differences that are real numbering shifts |
|---|---|---|
| Genesis | 12 of 50 | 31:55 is Brenton 32:1, chapter 32 shifted by one (32:33 extra); 31:51,55 and 35:21 missing |
| Exodus | 21 of 40 | 8:1-4 is Brenton 7:26-29 and chapter 8 shifted by four; 22:1 split; 28:23-29 and 35:8,15,17,18 missing; chapters 36-39 reordered (tabernacle account), 39:24-43 missing |
| Leviticus | 12 of 27 | 6:1-7 is Brenton 5:20-26, chapter 6 shifted by seven |
| Numbers | 16 of 36 | 16:36-50 is Brenton 17:1-15, chapter 17 shifted by fifteen; 29:40 is Brenton 30:1, chapter 30 shifted by one |
| Deuteronomy | 12 of 34 | 12:32 is Brenton 13:1, chapter 13 shifted by one (13:19 extra); 22:30 is Brenton 23:1, chapter 23 shifted by one (23:26 extra); 14:14 missing |

Isolated single-verse "shifted" hits (e.g. Deut 2:2→12:4, Lev 11:40→15:5) are phrase-reuse noise; the chunk-level shifts above are not. Result: **0 of 5 books identity**, including Deuteronomy. Under the label-only map the ingest uses, adding any of them would print Brenton's 13:1 beside Hebrew-English 13:1 (which is a different verse). `includedBookIds` was left at `[16, 25, 35, 37]`, no re-ingest was run, and `brenton-map.test.ts` was not written: its contract (book 5 included) contradicts the evidence. Deuteronomy 32, which chunk 10 needs, is itself clean. The options are a user decision: (a) a reviewed offset map for Deuteronomy (four ranges: 12:32, 13:1-18, 22:30, 23:1-25, plus 14:14 as a versification omission), which needs `ingest.ts` to insert non-identity `versification_map` rows; (b) chapter-level inclusion; (c) leave the Pentateuch withheld and quote Brenton's Deuteronomy 32:8 in chunk 10 from the source with a citation.

### Chunk 9, continued: Genesis to Numbers under a reviewed map

2026-10-08. Same zip and method, plus a pair-by-pair wording probe (Jaccard on content words of four or more letters, the checker's stop list; for short verses also containment, shared words over the shorter verse) against KJV for every row of every run, and a reading of each low-scoring pair. Scores below are first/last verse of the run. Low scores are mostly Brenton's Greek name forms (Juda, Symeon, Beseleel) and three-letter words the tokenizer drops ("ark"); every one was read.

- **Genesis**: Brenton 32:1 = 31:55 (0.64), 32:2-33 = 32:1-32 (0.22/0.47). Omissions 31:51 (its words sit inside Brenton 31:50) and 35:21 (inside Brenton 35:16). Extras 0.
- **Exodus**: 7:26-29 = 8:1-4 (0.31/0.80); 8:1-28 = 8:5-32 (0.43/0.33); 20:13,14,15 = 20:14,15,13 (1.00 each); 21:16/17 swap (0.50/0.07, the second is "steal" vs "stealeth"); 21:37 = 22:1 (0.60); 22:1-30 = 22:2-31 (0.56/0.44). Chapters 36-39 follow the Septuagint order: priestly garments Brenton 36:9-38 = 39:2-31 in three runs (0.90 … 0.42), curtains and veil 37:1-6 = 36:8-9, 36:35-38, court 37:7-21 = 38:9-23 (0.62/0.19), ark, table, lampstand 38:1-17 = parts of 37 (0.09 "made the ark" … 0.40), metals 39:1-9 = 38:24-31, summary 39:11-23 = 39:32-43 out of order, and 38:27 (the laver for washing) = 40:31. Acceptance rule there: Jaccard ≥0.20, or containment ≥0.33 with the neighbouring rows of the run passing. 13 Brenton verses have no one-to-one counterpart and are listed in `unplacedSourceVerses` (36:8, 36:11, 36:24, 36:25, 38:16, 38:19-22, 39:5, 39:10, 39:12, 39:15). Omissions 63 (25:6, 28:23-28, 32:9, 35:8,15,17,18, 36:10-33, scattered verses of 37-39, 40:7,11,28,30,32).
- **Leviticus**: 5:20-26 = 6:1-7 (0.60/0.45); 6:1-23 = 6:8-30 (0.60/0.37); Brenton 8:18 holds Hebrew 8:18-19, so 8:19-29 = 8:20-30 (0.18/0.90) and Brenton 8:30 (the second half of Hebrew 8:30) is unplaced. Omission 8:19, extra 1.
- **Numbers**: census order 1:24-35 = 1:26-37, 1:36-37 = 1:24-25 (Gad moved); 10:34,35,36 = 10:35,36,34; 17:1-15 = 16:36-50 (0.50/0.60); 17:16-28 = 17:1-13; 21:20 = 21:21 (Brenton 21:19 holds Hebrew 19-20, Brenton 21:21 is the first half of Hebrew 21:22, unplaced); 26:15-47 in nine runs for the Septuagint tribe order (checked by clan names and totals); 27:4-6 = 27:5-7 (Brenton 27:3 holds Hebrew 27:3-4, Brenton 27:7 "speak to the children of Israel, saying" unplaced); 30:1 = 29:40 (0.75), 30:2-17 = 30:1-16 (0.75/0.75). Omissions 21:20, 27:4; extras 2.

`check-brenton-identity.ts --mapped` applies the map before comparing: no extra labels remain in any book; what is left is the omissions above and parallel-passage noise (Exodus 25-31 commands against 36-40 executions, formula verses). The ingest skips exactly the reviewed unplaced verses and fails if the count differs; any other source verse without an address still fails the build. Identity verses with low but unshifted scores (Exod 35:9-16, where the Septuagint's list differs) were left at their labels, as the earlier books were.
