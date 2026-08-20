# Study Corpus Foundation Implementation Plan

> **For agentic workers:** if this plan has more than ~4 tasks, use the `scoped-delivery` skill to implement it in 1-3 task chunks via fresh subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a tested editorial content contract, schema builder, loader, and independent validator that the curated catalog can populate without weakening any corpus invariant.

**Architecture:** Each discovery is one JSON file so catalog batches own disjoint paths. `study-content.ts` parses files into typed rows without a database; `study-schema.ts` creates and loads the study tables into a supplied SQLite handle; `study-validation.ts` independently queries the built tables and recomputes schedule, range, pairing, acrostic, source, word-focus, plan, and diversity properties.

**Tech Stack:** TypeScript ESM, Node filesystem APIs, better-sqlite3, Vitest, existing ingest pipeline.

## Global Constraints

- Follow the global constraints in `2026-08-15-daily-study-delivery.md`.
- Do not edit `packages/ingest/src/ingest.ts` in this plan; main-pipeline integration occurs only after the 60-entry catalog exists.
- JSON files store verse ids, never OSIS strings, as anchors. Human reference labels are derived later.
- Loader and validator must not share range-expansion, pairing, schedule-diversity, or acrostic helpers.
- Test with temporary hard-coded directories under `/tmp`; move cleanup targets to quarantine rather than recursively deleting computed paths.

---

### Task 1: Editorial file contract and parser

**Files:**
- Modify: `packages/ingest/package.json`
- Modify: `packages/ingest/package-lock.json`
- Create: `packages/ingest/src/study-types.ts`
- Create: `packages/ingest/src/study-content.ts`
- Create: `packages/ingest/src/study-content.test.ts`
- Create: `packages/ingest/test-fixtures/study/valid/discoveries/001-genesis-visitors.json`
- Create: `packages/ingest/test-fixtures/study/invalid/missing-source/discoveries/001.json`

**Interfaces:**
- Produces: `loadStudyContent(root: string): StudyContentBundle`
- Produces: `parseDiscoveryFile(raw: unknown, file: string): EditorialDiscovery`
- Produces the exact exported types `EditorialDiscovery`, `EditorialStructure`, `EditorialPlan`, `StudySource`, `StudyContentBundle`, `InsightKind`, and `StudyStage`.

- [ ] **Step 1: Add the failing parser tests**

Add Vitest to the ingest package and set `"test": "vitest run --maxWorkers=1"`. Test these exact cases:

```ts
import { describe, expect, it } from "vitest";
import { loadStudyContent, parseDiscoveryFile } from "./study-content.js";

describe("study editorial contract", () => {
  it("loads one reviewed discovery and its scoped source", () => {
    const bundle = loadStudyContent("test-fixtures/study/valid");
    expect(bundle.discoveries.map((d) => d.slug)).toEqual(["abrahams-three-visitors"]);
    expect(bundle.discoveries[0].sources[0].claimScope).toContain("visitor sequence");
  });

  it("rejects an external claim without a source", () => {
    expect(() => loadStudyContent("test-fixtures/study/invalid/missing-source"))
      .toThrow(/001\.json: published discovery requires at least one scoped source/);
  });

  it("rejects OSIS strings as anchors", () => {
    expect(() => parseDiscoveryFile({ slug: "x", startVerseId: "Gen.18.1" }, "x.json"))
      .toThrow(/x\.json: startVerseId must be an integer verse_id/);
  });
});
```

- [ ] **Step 2: Run the focused test on the VPS and prove red**

Run through the VPS wrapper in a scratch copy:

```bash
npm test -- src/study-content.test.ts
```

Expected: FAIL because `study-content.ts` does not exist.

- [ ] **Step 3: Define the contract and strict parser**

`study-types.ts` must export these shapes without importing SQLite or app code:

```ts
export type InsightKind =
  | "literary" | "original_word" | "translation"
  | "narrative" | "historical" | "intertextual";

export interface StudySource {
  sourceId: string; author: string; title: string; publication: string;
  publicationYear: number | null; locator: string; url: string | null;
  licenseNote: string | null;
}

export interface EditorialDiscovery {
  discoveryId: string; slug: string; title: string; hook: string;
  startVerseId: number; endVerseId: number; estimatedMinutes: number;
  insightKind: InsightKind; noticeText: string; takeawayText: string;
  status: "draft" | "reviewed" | "published";
  reviewedBy: string | null; reviewedAt: string | null;
  questions: Array<{ questionId: string; text: string; sortOrder: number }>;
  sources: Array<{ source: StudySource; claimScope: string }>;
  interpretations: Array<{
    interpretationId: string; label: string; summary: string;
    sourceId: string; sortOrder: number;
  }>;
  relatedReadings: Array<{
    relationId: string; kind: "continue" | "related"; label: string;
    startVerseId: number; endVerseId: number; sortOrder: number;
  }>;
  wordFocus: Array<{
    focusId: string; verseId: number; textId: number; wordPosition: number;
    explanation: string; sortOrder: number;
  }>;
  structures: EditorialStructure[];
}
```

Implement explicit `assertObject`, `requiredString`, `optionalString`, `integer`, `array`, and enum
readers in `study-content.ts`. Every thrown error begins with the source filename. Sort discovery
files lexically and reject duplicate ids, slugs, source ids with non-identical metadata, question
orders, and relation orders before returning the bundle.

- [ ] **Step 4: Run the parser tests and typecheck**

```bash
npm test -- src/study-content.test.ts
npx tsc -p tsconfig.json --noEmit
```

Expected: all parser tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/ingest/package.json packages/ingest/package-lock.json packages/ingest/src/study-types.ts packages/ingest/src/study-content.ts packages/ingest/src/study-content.test.ts packages/ingest/test-fixtures/study
git commit -m "feat(ingest): define curated study content contract"
```

---

### Task 2: Study tables and transactional loader

**Files:**
- Create: `packages/ingest/src/study-schema.ts`
- Create: `packages/ingest/src/study-schema.test.ts`
- Modify: `packages/ingest/src/schema.ts`

**Interfaces:**
- Consumes: `StudyContentBundle` from Task 1.
- Produces: `createStudySchema(sqlite: Database.Database): void`
- Produces: `loadStudyBundle(sqlite: Database.Database, bundle: StudyContentBundle): void`
- Produces: Drizzle declarations for every table named in design spec §5.

- [ ] **Step 1: Write the failing transactional-loader test**

Use an in-memory database with minimal `books`, `verses`, `original_texts`, and `original_words`
fixtures, then assert:

```ts
it("loads a discovery atomically into normalized study tables", () => {
  const sqlite = fixtureCorpus();
  createStudySchema(sqlite);
  loadStudyBundle(sqlite, loadStudyContent("test-fixtures/study/valid"));
  expect(sqlite.prepare("SELECT COUNT(*) n FROM study_discoveries").get()).toEqual({ n: 1 });
  expect(sqlite.prepare("SELECT COUNT(*) n FROM study_questions").get()).toEqual({ n: 2 });
});

it("rolls back the entire bundle when one row violates a constraint", () => {
  const sqlite = fixtureCorpus();
  createStudySchema(sqlite);
  const bad = loadStudyContent("test-fixtures/study/valid");
  bad.discoveries[0].questions[1].sortOrder = 1;
  expect(() => loadStudyBundle(sqlite, bad)).toThrow();
  expect(sqlite.prepare("SELECT COUNT(*) n FROM study_discoveries").get()).toEqual({ n: 0 });
});
```

- [ ] **Step 2: Run the test and prove red**

```bash
npm test -- src/study-schema.test.ts
```

Expected: FAIL because schema functions do not exist.

- [ ] **Step 3: Create the exact design-spec schema**

Copy the normative DDL from design spec §§5.1–5.5 into `createStudySchema`. Add only these indexes:

```sql
CREATE INDEX study_discoveries_range_idx ON study_discoveries(start_verse_id, end_verse_id);
CREATE INDEX study_interpretations_discovery_idx ON study_interpretations(discovery_id, sort_order);
CREATE INDEX literary_structure_units_structure_idx ON literary_structure_units(structure_id, sort_order);
CREATE INDEX study_plan_steps_plan_idx ON study_plan_steps(plan_id, step_number);
```

Implement one `sqlite.transaction` that inserts sources first, then discoveries, scoped sources,
questions, interpretations, related readings, word focuses, structures and units, discovery links,
plans and steps, and finally the schedule. Deduplicate identical source metadata and reject a
conflicting duplicate before entering the transaction.

- [ ] **Step 4: Add matching Drizzle declarations and rerun tests**

Add table declarations to `schema.ts` for static typing only; DDL remains authoritative in
`study-schema.ts`. Run:

```bash
npm test -- src/study-schema.test.ts
npx tsc -p tsconfig.json --noEmit
```

Expected: PASS and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/ingest/src/study-schema.ts packages/ingest/src/study-schema.test.ts packages/ingest/src/schema.ts
git commit -m "feat(ingest): load normalized study corpus"
```

---

### Task 3: Independent corpus validator and editorial CLI

**Files:**
- Create: `packages/ingest/src/study-validation.ts`
- Create: `packages/ingest/src/study-validation.test.ts`
- Create: `packages/ingest/src/validate-study.ts`
- Modify: `packages/ingest/package.json`
- Modify: `scripts/sync-and-ingest.sh`

**Interfaces:**
- Consumes: a SQLite handle whose study tables have been loaded.
- Produces: `validateStudyCorpus(sqlite: Database.Database, buildDate: string): string[]`
- Produces CLI: `npm run validate:study -- [content-root] [YYYY-MM-DD]`

- [ ] **Step 1: Write mutation tests for each independent gate**

Build a valid in-memory fixture, mutate one fact at a time with direct SQL, and assert named errors:

```ts
const cases: Array<[string, string, RegExp]> = [
  ["DELETE FROM study_discovery_sources", "source", /published discovery .* scoped source/],
  ["UPDATE study_word_focus SET word_position = 99", "word", /word focus .* exactly one token/],
  ["DELETE FROM literary_structure_units WHERE label = 'A-prime'", "pair", /pair A occurs 1 time/],
  ["UPDATE literary_structures SET expected_initials = 'אב'", "acrostic", /initials disagree/],
  ["DELETE FROM study_daily_schedule WHERE local_date = '2026-08-16'", "schedule", /schedule gap/],
];
```

Also test a phantom encoded range whose endpoints exist but whose numeric interior contains gaps;
the validator must query ordered real verses and report no phantom ids.

- [ ] **Step 2: Run the validator test and prove red**

```bash
npm test -- src/study-validation.test.ts
```

Expected: FAIL because `validateStudyCorpus` does not exist.

- [ ] **Step 3: Implement independent SQL-first validation**

The validator must independently:

- Query endpoint existence through `verses` joins.
- Query real unit membership through `SELECT verse_id ... BETWEEN ... ORDER BY canon_order`.
- Count and mirror pair keys from ordered database rows without using loader structures.
- Recompute acrostic initials by selecting the first `original_words.surface` token in each real
  unit verse, Unicode-normalizing, and comparing to `expected_initials`.
- Verify published editorial completeness and per-interpretation sources.
- Verify word focus with a `COUNT(*)` on `(verse_id,text_id,position)`.
- Verify plan targets and chronological notes.
- Generate the expected date sequence arithmetically from ISO civil dates and compare it to the
  query result; do not call schedule-loader code.
- Independently query books' JSON genres and insight kinds for every rolling 30-row window.

Return all errors rather than throwing on the first; the CLI prints each and exits 1.

- [ ] **Step 4: Add the CLI and remote test gate**

The CLI loads a supplied content root into an in-memory fixture corpus and runs validation. Add
`"validate:study": "tsx src/validate-study.ts"` and make `sync-and-ingest.sh` run the ingest-package
unit suite before the real ingest:

```bash
npm test 2>&1 | tail -20
TESTS=${PIPESTATUS[0]}
if [ "$TESTS" -ne 0 ]; then echo 'INGEST TEST GATE FAILED' >&2; exit 1; fi
```

Do not add full-catalog validation to the remote script until the catalog plan supplies the 60
entries.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/study-content.test.ts src/study-schema.test.ts src/study-validation.test.ts
npx tsc -p tsconfig.json --noEmit
npm run validate:study -- test-fixtures/study/valid 2026-08-15
git add packages/ingest/src/study-validation.ts packages/ingest/src/study-validation.test.ts packages/ingest/src/validate-study.ts packages/ingest/package.json scripts/sync-and-ingest.sh
git commit -m "test(ingest): gate curated study content"
```

Expected: tests and typecheck exit 0; fixture CLI prints `study corpus valid`.
