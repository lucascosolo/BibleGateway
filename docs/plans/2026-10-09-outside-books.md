# Outside books plan

Written 2026-10-09 from the user's direction: "an extra biblical area with its own sub-category
where things like the book of Thomas can go. It can be very explicitly different with a slightly
different design like you're stepping out of the normal website and into the more ancient weedy
world of the unknown and less understood texts." Absorbs `2026-10-09-deuterocanon.md` as its first
sub-area. Executes after the Pentateuch verse maps (shared ingest files) and the pending web
release.

**Goal:** a workspace, "Chitzonim" (the Mishnah's term, Sanhedrin 10:1, for the "outside books";
plain label "Outside books"), where texts outside the Hebrew and Protestant canons are read with
the same apparatus, citations and renderer as scripture, inside a visibly different world, each
text saying who holds it, when and where it was written, what survives, and in whose translation.

**Approach:** one workspace at `/chitzonim` with five sub-areas, scoped design tokens, and the
texts ingested as books with ids from 67 upward so `verse_id` and the one renderer carry over
unchanged. The alternative, a separate reader for non-scripture, was rejected under invariant 2.
The design difference is scoped to the workspace by a `data-world="outside"` attribute on its
layout that redefines the surface tokens (ground, ink, rules, the serif) under that selector; the
66-book reader and every other workspace keep today's tokens and never see the attribute.

**Constraints:** `verse_id` only; one renderer; every dating a range with tradition and citation;
every term glossed through the lexicon; tokens only (new ones for the outside world live beside
the existing ones in globals.css and are redefined for dark); only translations whose licence is
verified against its own statement ship as text, the rest as described works with cited
excerpts under 25 words; the canonical count 31,102 stays the Hebrew-canon address space, the
outside books are counted separately on the home page, in `/api/corpus` and in `llms.txt`;
reachability at 390px; the tour gains no step until the workspace is complete.

## Sub-areas and the first texts
| Sub-area | Texts in the first release | Translation (licence) |
|---|---|---|
| Septuagint's extra books (deuterocanon) | Tobit, Judith, Additions to Esther, Wisdom, Sirach, Baruch and the Letter of Jeremiah, the additions to Daniel, 1-4 Maccabees, 1 Esdras, Prayer of Manasseh, Psalm 151 | Brenton 1851 (PD); KJV Apocrypha where eBible's licence page confirms PD |
| Second Temple writings | 1 Enoch, Jubilees, Testaments of the Twelve Patriarchs, Psalms of Solomon, 2 Baruch, Letter of Aristeas | R. H. Charles 1902-1917, Thackeray 1917 (PD by age; translation text only, never the introductions) |
| New Testament apocrypha | Gospel of Thomas; Gospel of Peter; Protevangelium of James; Infancy Gospel of Thomas; Acts of Paul and Thecla; Apocalypse of Peter | Mattison (public-domain dedication, verified at gospels.net/thomas); ANF vol. 8 Walker 1886; M. R. James 1924 (PD in the US; check the edition's own notice) |
| Apostolic Fathers | Didache, 1 Clement, Ignatius, Epistle of Barnabas, Shepherd of Hermas | Roberts-Donaldson ANF vols. 1-2, Lightfoot 1891 (PD) |
| Qumran and Nag Hammadi (described, not printed) | Community Rule, War Scroll, Thanksgiving Hymns, Apocryphon of John, Gospel of Philip, Gospel of Mary, Gospel of Judas | No free complete translation; each gets a work page with provenance, contents, dated witnesses, cited excerpts and links to the holding institutions |

Every licence in the table is verified against the source's own statement before the text is
ingested (chunk 1 does this and records it in `docs/sources/outside-books.md`); the researcher's
list of 2026-10-09 is a lead, not a clearance.

## Files
- Modify: `packages/ingest/src/translations.ts`, `ingest.ts` — book rows 67+, `canon` column, new sources, per-work numbering
- Create: `packages/ingest/src/outside/*.ts` — one loader per source format (eBible USFX for Brenton and KJVA; plain text with chapter/verse or logion markers for Mattison, Charles, ANF, James)
- Create: `packages/timeline/content/works/*.toml` — a work record per text (dating range with tradition and citation, language, provenance, witnesses, who holds it canonical, translation used) built into timeline.db as a new entity type with the review grade
- Modify: `apps/web/src/components/shell/workspaces.ts` — the workspace; `lib/lexicon.ts` — `chitzonim`, `pseudepigrapha`, `apocrypha`, `logion`
- Create: `apps/web/src/app/chitzonim/layout.tsx` (sets `data-world="outside"`), `page.tsx` (the threshold: the sub-areas, what this is, what it is not), `[area]/page.tsx`, `works/[id]/page.tsx` (the work record above the text, then the text through PassageRenderer)
- Modify: `apps/web/src/app/globals.css` — the outside tokens under `[data-world="outside"]`, light and dark; a new `chitzonim.css`
- Modify: the reader's header to show the canon notice for books 67+; the home page's canon browser to end with a door to the workspace rather than listing the books among the 66; `/api/*`, `llms.txt`, `/translations` (profiles for the new translations)

## Chunks
1. Licence verification and source filing: fetch each translation's own licence statement, file text and ledger under `~/.cache/jot/sources/outside/<id>/` and `docs/sources/outside-books.md`; halt on any text whose statement cannot be read. Test: the ledger lists a licence URL for every text in the table.
2. Book id space: `books.canon` (`hebrew` | `deuterocanon` | `pseudepigrapha` | `nt-apocrypha` | `apostolic` | `described`), rows 67+, reference parser, `getExistingVerseIds`, gate, build_id. Tests: `parseReference("Thomas 1")` resolves to book id and logion 1; book counts by canon.
3. Ingest Brenton's extra books and the KJV Apocrypha (identity numbering, Brenton's own where they differ; the difference recorded on the work page). Gate passes; census per canon.
4. Ingest the Second Temple, NT apocrypha and Apostolic Fathers texts from the filed plain texts with their own chapter and verse or logion numbering. Each loader has a test on a fixture paragraph.
5. Work records in the timeline package with dating and citations (Charles's and James's introductions are the primary leads, cited by page; Lim and McDonald for canon status; Ehrman's Lost Scriptures is copyrighted and not filed).
6. The workspace: layout, tokens, threshold page, area pages, work page; the design pass follows the brand rule (restrained; the hand lives in the mark); screenshots at 390 and 1280 in both themes.
7. Reader and home integration, the canon notice, search and concordance filters, API, llms, profiles, sitemap; the "described" works' pages.
8. Audio: LibriVox has public-domain readings of the KJV Apocrypha and of some Enoch and Didache texts; align what is complete as editions of their books.
9. Review and deploy: corpus, timeline and web together.

## Open questions for the user
- The name: "Chitzonim" with plain label "Outside books", or a plainer primary label?
- The threshold design: how far from the main site? Proposal: a darker parchment, a heavier old-style serif for headings only, hairline rules in rubric, no textures; the reading column itself identical.
- Whether described-only works (Qumran, most of Nag Hammadi) belong in the first release or wait.
