# Jot adversarial code review

**Scope:** static review of the repository, with the OSHB and MorphGNT specifications checked against the decoder. No browser or corpus-build execution was available in this pass. Findings below are limited to claims that can be established from code paths, not guesses about screenshots.

## Verdict

**NOT YET.** Jot is a careful, unusually self-aware reading prototype with useful public-domain data, but it is not yet a research instrument beside Logos, Accordance, STEP Bible, Bible Hub, or Sefaria. The original-language feature adds a real concordance surface, but the most conspicuous textual-critical claim—Qere/Kethiv—is ingested and then not displayed, and the versification gate does not prove the mapping it says it proves.

## Findings, ranked

### P0 — Qere readings are stored but unreachable in every reader surface

`packages/ingest/src/originals.ts:262-279` separates note-contained `<w>` elements into `original_variants`, and `apps/web/src/lib/db/originals.ts:111-119` exposes `getOriginalVariants`. There is no production caller of that function (`rg` finds only its definition). `apps/web/src/app/read/[ref]/page.tsx:19-196` loads interlinear words but not variants; `PassageRenderer.tsx:308-330` renders only `<Interlinear>` and omission apparatus. The `variants` preference is passed only to omission detail.

**Trigger:** open any WLC verse with a qere note, such as a source verse containing a `<note>` with `<rdg type="x-qere">`; the row is in the database, but the reader displays neither qere, ketiv (`catch_word`), nor a marker linking the two. The user sees an ordinary running text. The brief's “Qere/Kethiv” layer and “variants” control therefore claim a reader-facing feature that does not exist. This is not merely incomplete apparatus: it silently withholds a reading the UI says is available.

### P0 — The Hebrew decoder uses Hebrew verb-stem names for Aramaic

The OSHB specification has different stem tables for Hebrew and Aramaic. In `apps/web/src/lib/morphology.ts:74-117`, `HEB_STEM` is Hebrew (`q = qal`, `p = piel`, `a` is not present); `decodeHebrewSegment` always uses it at line 190, regardless of `language`. `parseMorphology` strips `A` but never passes the language into the decoder.

**Trigger:** an Aramaic verb `AVqp3ms` (Daniel/Ezra; OSHB `q` means **peal**, not Hebrew **qal**) is displayed as “verb · qal · perfect · 3rd person · masculine · singular”. `AVap3ms` (Aramaic `a = aphel`) falls back with an unexplained raw stem code rather than “aphel”. The test at `morphology.test.ts:47-53` checks only an Aramaic noun, so it cannot catch the actual Aramaic path. A researcher reading Aramaic morphology is given wrong grammatical labels.

The same table also maps OSHB noun gender `b` (“both”) to “common gender” (`morphology.ts:60-65`), which is a different code from `c` (“common”, used for verbs). A noun such as `HNcb...` is therefore decoded incorrectly.

### P0 — The versification gate is decorative for missing Hebrew map rows

The loader intentionally falls back to identity when no map entry exists: `packages/ingest/src/ingest.ts:1029-1034`. The validation loop at `1660-1717` checks that a divergent scheme has some rows, source-side uniqueness, real targets, and recognised types. It never checks that **every WLC source verse** is represented in `versification_map`, nor that every source part is covered.

**Trigger:** remove the VerseMap row for `Ps.3.2` while leaving the other map rows intact. `parseVerseMap` still returns nonzero rows; `resolveHebrewVerse("Ps.3.2")` silently uses `verseIdByOsis.get("Ps.3.2")`; the validation loop passes. The Hebrew words are then anchored to the canonical number as if the traditions agreed. This is exactly the mis-anchoring the map is supposed to prevent, and it contradicts `docs/ORIGINAL-LANGUAGES.md`'s “every verse ... mapped” claim.

The same structural weakness exists for Greek: the callback at `1080-1089` uses identity for every SBLGNT reference except the two hand-written exceptions. A future divergence that collides with a real canonical ID is silently accepted; `sblgnt.unmapped` cannot detect it. Two exception rows are not an independent proof that there are only two exceptions.

### P1 — The “seventy assembled verses” handling loses word-level placement for source splits

At `ingest.ts:1015-1019`, a source reference split into parts is keyed without the part and all words are assigned to the first canonical target: “resolves to the FIRST ... since the source gives us no word-level boundary”. That is not a faithful versification map. It makes the second canonical verse's Hebrew interlinear empty or attaches the entire source verse to the first canonical verse. The `source_part` survives in the map table, but it is not carried by `OriginalWordRow.sourceRef` or used when anchoring words.

**Trigger:** any VerseMap row where one WLC reference has `!a` and `!b` targets; `hebrewToCanonical` stores only the first target for the shared `Book.Chapter.Verse` key. The UI's “assembled from ...” notice in `Interlinear.tsx:49-59` only detects multiple `sourceRef` values after words have already been assigned; it cannot recover a split within one source verse. This is under-covered, not fixed, by the claim that the Hebrew reference is “shown”.

### P1 — Greek surface lookup says it strips accents, but the SQL does not

`apps/web/src/lib/db/originals.ts:258-286` says the Greek comparison is computed for Greek, and passes `stripGreekDiacritics(q)` as the second parameter. The query is still `normalized LIKE ?`; it does not strip diacritics from the stored MorphGNT `normalized` column. The code comment itself says that column is “still accented” (`:261-263`).

**Trigger:** type an unaccented surface form such as `λογος` into `/lashon`. If the stored normalized form is `λόγος`, the `lemma LIKE ?` branch and the accented `normalized LIKE 'λογος%'` branch both miss it. The page can still work for an accented lemma, which makes this a silent partial failure rather than a total outage. For a word index, unaccented input is a basic expected query.

### P1 — The build script still swallows dependency-install failures

`scripts/sync-and-build.sh:30` runs `npm install --no-audit --no-fund 2>&1 | tail -2` under remote `set -e`, but does not inspect `PIPESTATUS`. `tail` normally exits zero when `npm install` exits nonzero, so the script proceeds to build whatever stale or partial `node_modules` happens to be present.

The build, lint, and test pipelines do inspect their first status (`:39-47`, `:53-59`, `:64-70`), but the output filter at `:41` is also a pipeline. It is non-fatal only because the remote shell does not enable `pipefail`; that is accidental rather than a gate design. The final route smoke test (`:86-89`) prints HTTP status but does not fail on 4xx/5xx (`curl` lacks `--fail`), so a server that starts and returns an application error is reported as a successful cycle.

### P1 — The ingest “independent” qere count is not independent of XML nesting

The gate at `packages/ingest/src/ingest.ts:1805-1828` counts `<w>` by regex and subtracts every `<w>` found in every regex-matched `<note>`. A nested note causes the inner `<w>` to be counted once for the outer note and once for the inner note. More importantly, it checks only totals, not that each note-contained word was classified with the correct `kind`, `catch_word`, verse, or attachment position. A parser can put a qere in the wrong verse/position while preserving `wlc.words.length + wlc.variants.length` and pass the gate.

The real parser also sets `noteKind` from the most recently opened note/`rdg` and clears it only when `noteDepth` reaches zero (`originals.ts:209-221, 241-244`). A nested note or a sibling `rdg` can therefore inherit a parent/sibling label. The count gate does not detect that semantic corruption.

### P1 — The original-language count is not a full “every occurrence” concordance

`getConcordanceSummary` caps forms at 50 (`apps/web/src/lib/db/originals.ts:195-199`) and `getConcordanceOccurrences` is paged, which is fine only because the page discloses those limits. But `suggestLemmas` caps suggestions at 20 (`:265-286`) and the main `/lashon` page presents “matching words” without stating that the search result is capped. This is a discoverability problem for a researcher searching a broad Hebrew prefix, not merely a UI choice.

More seriously, Hebrew concordance matching is exact `strongs = ?` or exact `lemma = ?`; it is not lemma/root analysis in the scholarly sense. The brief says “lemma search”, while the Hebrew `lemma` is an OSIS morpheme string such as `b/2617 a` (`originals.ts:314-318`). A user cannot query a lexeme independently of attached prefix/suffix morphemes, and there is no root, stem, or morphological filtering. The UI should call this Strong's-key/OSIS-lemma lookup, not imply a modern lemma concordance.

### P2 — Homonym handling is defensible as disambiguation, but the app presents a Strong's-derived gloss as lexical evidence

The split-key mechanism (`apps/web/src/lib/db/originals.ts:465-530`) correctly avoids silently merging H2617a/H2617b and the “family” page is better than a 404. It is not, however, a scholarly homonym resolver: it inherits the OSHB lexical index's split and gives no lexical source citation per sense, no corpus form evidence on the disambiguation page, and no way to inspect the actual lemma/morphology that caused an occurrence to be assigned to a side. The page's statement at `[key]/page.tsx:351-354` that Strong's grouped words “that look alike” is an oversimplification of how the numbering and later lexical divisions were made. Treat this as a useful navigation convention, not a sound lexical analysis.

### P2 — “Variants” in the brief is broader than the implemented apparatus

`docs/REVIEW-BRIEF.md:113-115` calls the layer “variants”; `:139-143` names Geniza as manuscript transmission and variant comparison; `:189-191` still says a cited critical apparatus, witnesses, sigla, MT/LXX comparison, and more translations are missing. The code has only WLC marginal qere rows (not displayed), omission notes for twelve New Testament verses, and two English translations. There is no manuscript apparatus, witness-level evidence, sigla, editor, date, or source-language comparison. The brief is mostly honest in §5, but its opening description “the apparatus a scholar actually uses” overstates what is currently a reading surface plus cross-references and a lexical index.

## Build-gate audit

| Gate | Verdict |
|---|---|
| Remote `npm install` | **Decorative on failure**: piped to `tail` with no `PIPESTATUS`. |
| `npm run build` | Real exit-status gate; its displayed output filter is not independently safe because `pipefail` is absent. |
| `npm run lint` | Real: `PIPESTATUS[0]` is checked. |
| `npm test` | Real: `PIPESTATUS[0]` is checked, assuming the test command itself has an honest exit status. |
| Font count | Real for “at least four literal `@font-face` strings”; it does not prove the intended faces are loaded or used, and `grep` is not required to match a specific family. |
| Route smoke test | Decorative for HTTP correctness: it records statuses but never rejects a 500/404. |
| Ingest orphan/census/FTS gates | Real for the specific counted properties. They do not establish source-to-database semantic fidelity. |
| Ingest WLC qere gate | Real for total counts, not for qere identity, position, or kind. |
| Ingest versification gate | **Decorative for completeness**: nonzero rows plus uniqueness/real-target checks do not prove full source coverage. |
| Build promotion | The temporary DB promotion is structurally safer than in-place rebuild, but this review did not execute the ingest and cannot certify the final promotion path. |

## Researcher gaps, ranked

### 1. A real textual apparatus (blocking)

For each locus: MT/WLC, LXX, Vulgate, DSS where available, and a critical Greek witness set; variant readings, witnesses, editorial sigla, apparatus sources, dates, and links to an edition/critical apparatus. Qere/Kethiv needs visible ketiv, qere, morphology, and a marker in the running text. The current qere rows must first be rendered.

### 2. Parallel text and alignment views (blocking)

At minimum WLC/MT Hebrew, LXX Greek, SBLGNT/NA28 Greek, WEB/BSB, with verse and word alignment, versification exceptions, and a way to compare translation choices. A serious first query is “what does the LXX do here?” and it currently has no answer.

### 3. Better lexical and morphological research (high)

A modern Hebrew lexeme/root index (including prefixes, suffixes, homonyms, stem, and corpus attestation), Greek Strong's/lemma crosswalk, morphological filters (“all Qal imperfect 3ms”), transliteration search, Unicode-normalization/diacritic-insensitive search, and exportable occurrence lists. Include source version, editorial provenance, and the exact query semantics.

### 4. Citation and study output (high)

Copyable stable citations with translation/source/edition metadata, verse-range permalinks, footnotes/attributions, BibTeX/CSL/Markdown export, print/PDF layout, and a study composer that exports annotations plus quoted text and offsets. A scholar cannot responsibly cite a private URL with no edition/build identity or assemble notes for a seminar paper.

### 5. Research navigation (high)

Keyboard-first verse/word navigation, typeahead reference parsing, previous/next occurrence, “open in parallel”, history/back-stack for cross-reference exploration, and deep links to a specific word/morpheme—not only a verse. Add URL/build-version identity so a citation remains tied to the corpus used.

### 6. Translation breadth and provenance (high)

More licensed/public-domain English traditions, plus LXX/Vulgate and at least one modern scholarly translation where licensing permits. Every text needs edition/version, revision date, license, versification, and a visible provenance record; two English translations are not enough to study translation history.

### 7. Offline and programmatic access (medium)

Downloadable corpus snapshot/service worker for reading and lexical lookup, a documented read-only API with pagination and rate limits, machine-readable schema, source checksums, and reproducible build manifests. “Immutable build artifact” is an implementation detail until a researcher can identify and retrieve the exact artifact.

### 8. Small but consequential conveniences (medium)

Print all apparatus cleanly; export selected verses and notes; copy Hebrew/Greek with or without pointing; copy citation and Strong's/lemma metadata; user-selectable versification; side-by-side translation compare; persistent query URLs; annotations backup/import; screen-reader labels for morphology; and visible source/edition credits at the point of use.

### 9. Planned scholarship (after the foundations)

The roadmap's Toledot timeline needs cited date ranges with tradition/school and confidence, not scalar dates; Geniza needs witness metadata, coverage, images/links, and transmission relationships; Massa'ot needs ancient place identifiers, coordinates, uncertainty, and verse mentions. Source criticism, reception history, rhetorical structure, and intertextual quotation data should all expose competing scholarly hypotheses and citations rather than one asserted layer.

## What would change the verdict

A visible, source-cited textual apparatus; verified full versification coverage with independent source comparison; correct Hebrew/Aramaic morphology; parallel MT/LXX/Greek/translation alignment; a reproducible corpus identity and citation/export path; and a documented research API would move Jot from “careful reader prototype” to credible specialist tool. Until then, it does not stand beside the named modern research tools, even though its renderer/state architecture and its refusal to silently hide omissions are promising foundations.
