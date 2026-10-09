# Deuterocanon plan

Written 2026-10-09 at the user's request ("I'm fascinated by these books and think you should
add them somehow"). Executes after the Pentateuch verse maps for Brenton land, because both touch
`packages/ingest/src/translations.ts` and `ingest.ts`.

**Goal:** the books Brenton's Septuagint carries beyond the Hebrew canon (Tobit, Judith, the
additions to Esther, Wisdom of Solomon, Sirach, Baruch with the Letter of Jeremiah, the additions
to Daniel: Susanna, Bel and the Dragon, the Prayer of Azariah, 1 and 2 Maccabees, and Brenton's
3 and 4 Maccabees, 1 Esdras, the Prayer of Manasseh, Psalm 151) are readable, searchable, cited
and audible where a free recording exists, and are labelled throughout as outside the Hebrew
canon and outside most Protestant Bibles, with the canon-axis events already on the timeline
(Jerome's Prologus Galeatus, Athanasius, the Muratorian Fragment) linked from each book.

**Approach:** extend the book id space, not the address scheme. `verse_id = book * 1e6 + chapter
* 1e3 + verse` already allows book ids up to 99; the 66 canonical books keep 1-66 and the
additional books take 67 onward in Brenton's order. Their chapter and verse numbering is
Brenton's own, since there is no Hebrew numbering to defer to; the choice is recorded on each
book's page with the note that Rahlfs and the NRSV number Sirach and the Esther additions
differently. The alternative, a second address scheme for non-canonical books, was rejected: it
breaks invariant 1 and every consumer that joins on `verse_id`. The KJV Apocrypha (public
domain, same book set bar 3-4 Maccabees) ships as a second translation of these books so the
reader can compare, through the same translation profile machinery.

**Constraints:** `verse_id` only; one renderer; `citation NOT NULL` on dating; every
user-facing term glossed; the home page and the API disclose the canon status of each book;
the canonical count 31,102 stays the count of the Hebrew-canon address space and the new books
are reported separately everywhere a count appears (home page, /api/corpus, llms.txt).

## Chunks
1. `books` table gains `canon` (`hebrew` | `deuterocanon`) and the new rows with osis ids (Tob,
   Jdt, AddEsth, Wis, Sir, Bar, EpJer, PrAzar, Sus, Bel, 1Macc, 2Macc, 3Macc, 4Macc, 1Esd, PrMan,
   Ps151) from the eBible Brenton source; reference parser accepts their names and
   abbreviations; `getExistingVerseIds` and the versification gate cover them; census and
   build_id include them. Test: `parseReference("Sir 1:1")` and the book count by canon.
2. Ingest Brenton's text for the new books (identity numbering, no map), and the KJV Apocrypha
   from eBible if its licence page confirms public domain; omissions and footnotes as for other
   books. Gate passes.
3. Web: the home page's canon browser gets a "Deuterocanon" group after the New Testament with a
   one-paragraph explanation (lexicon entry `deuterocanon`, gloss "the books in the Greek Bible
   that are not in the Hebrew one"); the reader shows a quiet canon notice in the header for these
   books (not on reading surfaces of the 66); translation switcher offers only the editions that
   carry the book; search and concordance include them with a filter; the API and llms.txt
   describe them; sitemap entries.
4. Toledot: a person page is not needed; the canon-axis events gain verse links into the new
   books where the primary texts name them (Jerome lists them; Athanasius calls some "to be
   read"); an issue "Which books belong in the Old Testament?" with the Jewish, Catholic,
   Orthodox and Protestant positions, cited to Lim, McDonald and Gallagher and Meade.
5. Audio: LibriVox has public-domain readings of the KJV Apocrypha (check the catalogue); align
   as an edition "KJVA-librivox" if complete; otherwise text only, and the roadmap says so.
6. Review and deploy: corpus and web ship together (new book rows are read by every page).

## Open questions for the user
- Include 3 and 4 Maccabees and Psalm 151 (Orthodox but not Catholic), or stop at the Catholic
  deuterocanon? Default: include everything Brenton prints, labelled by which traditions hold it.
- Should the extra books appear in cross-reference counts and the heat map? Default: yes, with
  the same disclosure, since OpenBible's data includes some of them; if it does not, nothing
  appears and the page says so.
