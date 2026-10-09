const BASE = "https://bible.lucascosolo.com";

const body = `# Jot API instructions for language models

Jot is a public, read-only Bible research API for retrieval by search engines, agents, and language models. Public HTML pages are crawlable; the structured endpoints below provide more convenient data retrieval.

## Discovery and translation identity

- Sitemap index: ${BASE}/sitemap.xml. It lists real verse, chapter, book and concordance pages, including partial edition coverage.
- Cite a reader URL such as ${BASE}/read/John.4.11?t=WEB. The translation query is part of the citation; do not drop it or relabel its text.
- For a question about references across the Bible, retrieve the passage and its inbound/outbound cross-references, then inspect each linked passage in context. A cross-reference is editorial evidence, not a statement that two verses mean the same thing.
- Discover currently available editions at ${BASE}/api/translations. NIV is not currently included. Never label another edition as NIV or imply Jot can supply a translation absent from that endpoint.
- Coverage may be partial: consult the returned scope and actual verse rows. Missing translation text, recorded omissions, and absent original-language evidence are distinct cases.
- Search-engine indexing and AI retrieval depend on the crawler; this document is a discovery aid, not an indexing protocol or a guarantee of inclusion.

## Retrieval workflow

1. Resolve the user's reference into a Jot reference such as \`John 3:16\`.
2. Call \`/api/corpus\` when recording a reproducible citation; retain its \`buildId\` and source checksums.
3. Call \`/api/passage?ref=...&translation=...\` for quoted translation text (\`t\` is an alias for \`translation\`). Add \`footnotes=1\` when the translator's own notes matter. If no translation is named, call \`/api/translations\` and state which one you selected.
4. Call \`/api/originals?ref=...\` for Hebrew, Aramaic, Greek, morphology, Qere/Kethiv, or textual differences.
5. Call \`/api/original-search?q=...\` for lemma, surface-form, Strong's-key, or morphology-prefix searches.
6. Call \`/api/xrefs\` or \`/api/graph\` when relationships are relevant; both are bounded and disclose caps.
7. Call \`/api/concordance?key=...&format=tsv\` for a machine-readable occurrence list; keep \`limit<=5000\`.
8. Call \`/api/timeline/passage?ref=...\` for the historical dating, people, outside sources and textual investigations that bear on a passage, then follow each \`href\`.
9. Cite the returned reference, translation, source/provenance, build ID, and any truncation or selected-apparatus caveat. Separate retrieved evidence from interpretation.

## Canonical addressing

\`verse_id\` is the only stable address: \`BBCCCVVV\` as an integer (book × 1,000,000 + chapter × 1,000 + verse). The space is sparse; never infer verse counts by subtracting IDs or invent IDs by walking numeric ranges. Use returned \`verse_id\` and \`reference\` fields.

## Endpoint contract

### Corpus identity

\`GET ${BASE}/api/corpus\`

Also returns \`canonicalVerseCount\` (31,102: the 66-book address space) and \`outside.canons\`: per outside canon that has printed books (\`deuterocanon\`, \`pseudepigrapha\`, \`nt-apocrypha\`, \`apostolic\`; \`described\` works have records but no book text) the \`books\` and stored \`verses\`, with a \`bookList\` giving each book's \`numbering\` scheme, verse count and the \`translations\` that print it. Never add the outside verses to 31,102 or call them part of the Bible's verse count.

Returns the content-derived \`buildId\` of the text corpus, \`audioBuildId\` (the separately built recordings artifact, or \`null\` when this deployment has no audio), and a public manifest of every upstream input archive with its source URL, filename, and SHA-256 checksum. Store this alongside a research citation; the build ID identifies the derived corpus, while the manifest identifies its inputs.

### Passage

\`GET ${BASE}/api/passage?ref=John%203%3A16&translation=WEB\`

Parameters: \`ref\` (required); \`translation\` or its alias \`t\` (default WEB; \`translation\` wins if both are sent); \`footnotes\` = \`0\` (default) or \`1\`, anything else is a 400.

Returns translation metadata with its copyright notice, \`verses\` (\`verseId\`, \`chapter\`, \`verse\`, \`text\`; text is plain and NFC-normalized, with no markup or footnote callers), and \`omissions\`. A reference the edition does not print but records as omitted is a 200 with empty \`verses\` and a populated \`omissions\`; 404 means the reference addresses nothing in that edition.

Every omission carries a \`kind\`, and the kinds are different facts. Never describe one as another:

- \`critical-text\`: the verse is absent from the earliest manuscripts and editions following the critical text leave it out. \`history\` gives a cautious account of how the reading likely entered the tradition (harmonizing, explanatory, liturgical); it deliberately claims no insertion year.
- \`versification\`: the edition numbers its verses differently (for example Brenton's Septuagint) and has no verse at this canonical address. The text is not missing from the translation, only from this numbering. \`history\` is empty.
- \`coverage\`: reserved for a whole book outside the edition's scope. Book scope is reported by \`/api/translations\` and is normally not written per verse.
- \`unexplained\`: the edition does not print the verse and its source gives no reason. Say exactly that; do not supply a reason.

\`printedBy\` lists the loaded editions that do print the verse.

With \`footnotes=1\` the response also has \`footnotes\`: the requested translation's own notes on the returned verses, in verse then printed order, each \`{ verseId, noteOrder, caller, kind, text }\` where \`kind\` is \`footnote\`, \`endnote\` or \`crossref\` and \`caller\` is the mark the publisher printed (or null). A footnote is the translator's note, not Jot's commentary; attribute it to the edition. The key is absent without the flag, so existing clients see an unchanged payload.

Worked example: \`GET ${BASE}/api/passage?ref=Deut.23&t=LXX&footnotes=1\` returns Brenton's Deuteronomy 23 at canonical addresses (the Septuagint's 23:1 is canonical 22:30, so it appears in Deuteronomy 22, not here), Brenton's footnotes for those verses, and any \`versification\` omission in range. Quote the text with the LXX copyright notice and say it is Brenton's English translation of the Greek, not the Hebrew.

Outside references resolve here too (see Outside books below): \`GET ${BASE}/api/passage?ref=Thomas%2042&translation=MATTISON\` returns logion 42 of the Gospel of Thomas, and \`GET ${BASE}/api/passage?ref=Sir%201:1&translation=KJVA\` Sirach 1:1. The response has \`book\` (\`bookId\`, \`osisId\`, \`canon\`, \`numbering\`). Ask for an outside book in a translation that does not print it (WEB, for instance) and the answer is a 404: do not fill the gap from another edition.

### Original language

\`GET ${BASE}/api/originals?ref=John%203%3A16\`

Returns token-level surface text, lemma, Strong's key, morphology, language, source references, and relevant apparatus. Selected VarApp evidence is not exhaustive manuscript coverage.

### English text search

\`GET ${BASE}/api/search?q=grace&translation=WEB&page=1&pageSize=20\`

Searches translation text and returns hits, total, pagination, and book distribution. \`canon\` = \`bible\` (default) searches only the 66 books; \`canon=all\` also searches the outside books (\`GET ${BASE}/api/search?q=kingdom&canon=all\`; add \`translation=MATTISON\` or \`KJVA\` to search an outside edition). The response echoes \`canon\`. An outside \`book\` id implies \`all\`. Report which canon you searched.

### Original-language search

\`GET ${BASE}/api/original-search?q=agape&language=grc&morph=V&translation=WEB\`

Searches lemma, surface form, and Strong's key at verse grain. \`language\` accepts \`hbo\`, \`arc\`, or \`grc\`; \`morph\` is a morphology-prefix filter.

### Cross-references

\`GET ${BASE}/api/xrefs?ref=John%203%3A16&limit=40\`

Returns ranked inbound/outbound references, totals, overlap disclosure, and whether the result was capped. Do not add directional totals when records overlap.

### Reference graph

\`GET ${BASE}/api/graph?ref=John%203%3A16&depth=2&maxNodes=200\`

Returns a bounded graph. Treat cap notices as information about the result boundary, not as an error.

### Translations

\`GET ${BASE}/api/translations\`

Returns translation codes, names, rights, license/attribution, scope, \`scopeNote\`, and copyright notices. Fetch this before quoting a translation whose rights are not already known.

Partial editions say what they hold. \`LXX\` is Brenton's 1851 English translation of the Septuagint, loaded only for the books named in its \`scopeNote\` (read it live from /api/translations; as of this build it is the Pentateuch plus Nehemiah, Lamentations, Habakkuk and Haggai). Books whose numbering differs from the Hebrew scheme are loaded under reviewed verse maps checked by wording (for example the Septuagint opens Deuteronomy 13 with Hebrew 12:32 and Numbers 17 with Hebrew 16:36); verses with no counterpart are recorded as \`versification\` omissions, and the few Septuagint-only verses are left unplaced rather than forced to a wrong address. Every other book is withheld until it has such a map. A wrong verse map would put a well-formed but wrong verse beside the Hebrew at every address, which is worse than an absent book. Do not claim Jot has Brenton text for a book not in \`scopeNote\`, and do not fill the gap from elsewhere under the LXX label.

Outside-book editions have \`scope: "outside"\` and a \`books\` list (\`bookId\`, \`osisId\`, \`name\`, \`canon\`, \`numbering\`) of exactly the books each prints. The seven are KJVA (the KJV Apocrypha), CHARLES (1 Enoch, Jubilees, the Testaments of the Twelve Patriarchs, 2 Baruch), GRAY (Psalms of Solomon), MATTISON (Gospels of Thomas, Mary, Judas, Philip), ANF (Gospel of Peter, Protevangelium of James, Infancy Gospel of Thomas, Acts of Paul and Thecla), JAMES1924 (Apocalypse of Peter) and LIGHTFOOT (Didache, 1 Clement, Ignatius, Barnabas, Hermas). Read each one's \`license\`, \`copyrightNotice\` and \`scopeNote\` live and carry them with any quotation.

### Concordance export

\`GET ${BASE}/api/concordance?key=H2617a&format=tsv&limit=5000\`

Returns UTF-8 TSV. Comment lines provide total/exported/truncated counts, followed by \`verse_id\`, \`reference\`, \`source_ref\`, \`position\`, \`surface\`, \`morphology\`, and \`language\`. Report truncation rather than implying completeness.

### Audio timings

\`GET ${BASE}/api/audio/passage?ref=John.3&t=WEB\`

Exactly one chapter: a ref spanning more than one chapter is a 400, a chapter with no recording is a 404. Returns no verse text. \`audio.editions\` lists the recordings (reader, language, license, attribution, source URL); editions currently include \`BSB-souer\`, \`WEB-williams\`, \`KJV-librivox\` and the Hebrew \`WLC-beeri\`, and the response, not this list, is authoritative. \`audio.chapters[].byEdition[code]\` gives the chapter file \`url\`, \`durationMs\`, and \`verses\` as \`{ verseId, startMs, endMs }\` within that file. \`t\` selects \`translationCode\` and \`nextHref\` (the reader path of the next chapter, null at the end of a book). Carry the edition's attribution when citing a recording; timings come from automatic alignment, not hand-placed cues.

## Outside books (Chitzonim)

Books 67-120 are addressed by the same \`verse_id\` and printed by the same renderer, but they are not part of the 66 and no default query returns them. Never describe one as in "the Bible" without saying whose.

- Canons and who reads them. None of these books is in the Hebrew or the Protestant canon. \`deuterocanon\` (the Septuagint's extra books: Tobit, Judith, Wisdom, Sirach, the Maccabees…): Catholic and Orthodox Bibles include most of them and differ on exactly which; older Protestant Bibles printed them between the Testaments as the Apocrypha. \`pseudepigrapha\` (1 Enoch, Jubilees, the Testaments of the Twelve Patriarchs, Psalms of Solomon, 2 Baruch): the Ethiopian Orthodox Tewahedo Church reads 1 Enoch and Jubilees as scripture; no other church does. \`nt-apocrypha\` (Gospels of Thomas, Mary, Judas, Philip and Peter, the Protevangelium, Acts of Paul and Thecla, Apocalypse of Peter): in no church's New Testament today. \`apostolic\` (Didache, 1 Clement, Ignatius, Barnabas, Hermas): read in some churches in the first centuries, in no New Testament today. \`described\` (Qumran and Nag Hammadi works): no free complete translation; described and excerpted, not printed, and scripture in no living tradition. Each work's \`heldCanonicalBy\` is the authority for who reads it.
- Numbering schemes (\`numbering\`, in \`/api/corpus\` \`bookList\`, \`/api/translations\` \`books\` and the passage \`book\`): \`chapter-verse\`; \`logion\` (Thomas: sayings 1-114, prologue as 0); \`section\` (Gospel of Peter, 1-14); \`chapter\`; \`part-chapter\` (a book of several forms or parts, e.g. Hermas as Vision/Mandate/Parable, the Infancy Gospel of Thomas as three forms); \`paragraph\`; \`page\` (Mary, Judas, Philip: the manuscript page, with the verse a counted place on that page). Some units are editorial ordinals counted in order because the source prints none (Acts of Paul and Thecla, the Ethiopic Apocalypse of Peter); say so when citing. Verse 0 is a prologue or greeting. The verse-id space is sparse here too: walk real verses only.
- Licences and proofreading. Every edition is public domain on a stated basis: KJVA by the eBible statement (with the UK letters-patent notice); CHARLES, GRAY, ANF, JAMES1924 and LIGHTFOOT by date of first publication (1913-1924, 1870-1896, 1891) with the translator's death year; MATTISON by the translator's own public-domain dedication. Proofread status: CHARLES's Testaments and 2 Baruch and all of GRAY were OCR drafts proofread against the printed pages in 2026; say "proofread against print" only for what the \`copyrightNotice\` says. The licence basis of each is in its \`license\` and \`copyrightNotice\`.
- Worked examples. \`GET ${BASE}/api/passage?ref=Thomas%2042&translation=MATTISON\` (logion 42); \`GET ${BASE}/api/passage?ref=Sir%201:1&translation=KJVA\` (Sirach, chapter-verse); \`GET ${BASE}/api/search?q=kingdom&canon=all&translation=MATTISON\`; \`GET ${BASE}/api/timeline/works?canon=nt-apocrypha\`; \`GET ${BASE}/api/timeline/works/gospel-of-thomas\`.

### Work records

\`GET ${BASE}/api/timeline/works\` lists the 43 works (filter with \`canon\`; an unknown canon is a 400); \`GET ${BASE}/api/timeline/works/{id}\` returns one in full: \`positions\` (cited dating positions with who holds each), \`witnesses\` (surviving copies), \`heldCanonicalBy\`, \`translations\`, \`excerpts\`, \`provenance\`, \`verses\` (links to Bible passages with reader paths), \`href\` and the human \`page\` (${BASE}/chitzonim/works/{id}). \`composed\` is a range (negative = BCE) derived from the positions, quoted as a range with its positions. Eight works are undated (Judith, Susanna, Bel and the Dragon, the Prayer of Azariah, 1 Esdras, the Letter of Jeremiah, the Gospel of Mary, the Gospel of Judas): for them \`composed\` is null and \`composedUndated\` states why and what is known, such as the earliest dated copy. Say "undated"; never turn a copy's date or a guess into a composition range. The same review \`status\` rule applies: below claims-checked is unchecked.

## Historical scholarship

- Timeline pages: ${BASE}/toledot (the strip), ${BASE}/toledot/events/{id}, ${BASE}/toledot/people/{id}, ${BASE}/toledot/artifacts/{id}, ${BASE}/toledot/issues/{id}, ${BASE}/toledot/investigations/{id}. Ids are content slugs such as \`exodus\` or \`hezekiah\`; the full list is in ${BASE}/sitemaps/toledot.xml.
- Endpoints: \`GET /api/timeline?from=-1500&to=-500&axis=narrative\`, \`GET /api/timeline/events/{id}\`, \`GET /api/timeline/persons\`, \`GET /api/timeline/persons/{id}\`, \`GET /api/timeline/artifacts/{id}\`, \`GET /api/timeline/issues/{id}\`, \`GET /api/timeline/investigations\`, \`GET /api/timeline/investigations/{id}\`, \`GET /api/timeline/passage?ref=2Kgs.18\`, \`GET /api/timeline/works\`, \`GET /api/timeline/works/{id}\`. Every list item carries an \`href\` to its full record.
- Every date is a RANGE (\`earliest\`, \`latest\`; negative = BCE, no year 0) with a confidence (firm, contested, speculative) and the scholarly positions behind it, each with arguments for and against and their citations. Quote the range and the positions, never a single year.
- Three axes are separate questions: \`narrative\` (when events happened), \`composition\` (when texts were written), \`canon\` (when collections were recognised as scripture, e.g. the closing of the Hebrew Bible or the fixing of the New Testament list). Do not merge them. The \`/api/timeline\` response returns them as separate \`tracks\`.
- Each position on an event's date says what it dates. \`positions\` date the event itself and alone make \`earliest\`/\`latest\`; \`compositionPositions\` date when the story was written. "The exodus narrative was written in the 6th century BCE" and "the exodus happened in the 13th century BCE" are different claims; never report one as the other.
- Critical and archaeological positions lead. \`traditional\` chronology (adding up the Bible's own numbers) is a lens reported separately in \`traditional\`, not evidence, and is excluded from the envelope unless it is the only position.
- Evidence grades for people are derived from outside sources: corroborates (named by a source outside the Bible), partially-corroborates (partly confirmed; the reading is disputed), consistent (fits an outside source without naming them), silent (outside sources exist but say nothing), none (no outside evidence). A separate tension flag means an outside source contradicts a biblical detail about them.
- Every claim is cited: positions, arguments, attestations, issue views, witnesses, differences and challenges each carry \`citations\` (source, author, year, locator). Quote the citation with the claim; do not restate a claim without it.
- Every event, person, artifact, issue and investigation has a review \`status\`, in order: \`draft\` < \`sources-located\` < \`claims-checked\` < \`expert-reviewed\`. Anything below \`claims-checked\` is UNCHECKED: its sources have been found but its claims have not been verified against them. Say "unchecked" when citing such content.

### Textual investigations

\`GET ${BASE}/api/timeline/investigations\` lists them; \`GET ${BASE}/api/timeline/investigations/{id}\` returns one in full. An investigation takes one passage where the ancient witnesses (such as the Masoretic Text, the Septuagint, the Dead Sea Scrolls and the Vulgate) read differently and lays out:

- \`witnesses\`: each witness's \`siglum\`, \`reading\` in its own language, an English \`translation\`, and citations.
- \`editions\`: which printed translation follows which witness here (\`follows\` is a witness siglum), so a reader can see why two Bibles differ.
- \`differences\`: each difference with its \`kind\` (textual, lexical, grammatical, stylistic, interpretive, editorial), the explanation, \`heldBy\` (who holds it), and citations.
- \`challenges\`: cited objections to the investigation's own conclusions.
- \`passage\` (\`start\`, \`end\`, \`label\`, reader \`path\`), \`href\`, and the human \`page\`.

Worked example: \`GET ${BASE}/api/timeline/investigations/deut-32-8-9\` covers Deuteronomy 32:8-9: the Masoretic Text reads "the sons of Israel", the Qumran scroll 4QDeut^j "the sons of God", and most Septuagint manuscripts "the angels of God". \`editions\` shows KJV and WEB following MT while BSB follows 4QDeut^j, which is why those Bibles disagree here. Report each witness's reading with its citation, which editions follow which witness, and the stated explanations with who holds them; do not pick a winner the record does not pick. \`gen-2-21-23\` is the other live example.

### Worked example: dating a passage

\`GET ${BASE}/api/timeline/passage?ref=2Kgs.18\` returns the events, issues, artifacts, people and investigations linked to 2 Kings 18, plus \`notes\`. Follow an event's \`href\` to \`/api/timeline/events/{id}\`; quote its range as a range with its \`confidence\`, name the positions and their holders with citations, keep \`compositionPositions\` separate, list outside sources by \`relation\`, and state the \`status\`.

## HTTP behavior

- Successful corpus responses are public and cacheable. They include \`ETag\`, \`Cache-Control\`, and \`Access-Control-Allow-Origin: *\`.
- Send \`If-None-Match\` to receive \`304 Not Modified\` when unchanged.
- Invalid or missing parameters return JSON errors with HTTP 400; unresolved references return HTTP 404.
- Corpus responses are tied to a content-derived build ID. Do not cache forever under an unversioned URL.
- \`/api/annotations\` is private and user-scoped (\`Cache-Control: private, no-store\`); it is not part of the research API and should not be called by unauthenticated clients.
- Timeline responses are versioned by both the timeline and corpus builds; audio responses and \`/api/corpus\` by the audio and corpus builds.

## Not API

The support page, donation links and onboarding are site pages, not data. Do not cite them as sources.

## Machine-readable contract

- OpenAPI: ${BASE}/api/openapi.json (\`/api/openapi.json\`)
- Concise index: ${BASE}/llms.txt
- Human API page: ${BASE}/api
`;

export function GET() {
  return new Response(body, { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "Access-Control-Allow-Origin": "*",
  }});
}
