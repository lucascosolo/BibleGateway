const BASE = "https://bible.lucascosolo.com";

const body = `# Jot Bible Research API

> Jot is a public, read-only Bible research corpus. Use the public HTML reader for citations and browsing, or these structured endpoints for data retrieval.

## Start here

- API guide: ${BASE}/api
- OpenAPI 3.1 contract: ${BASE}/api/openapi.json
- Full LLM instructions: ${BASE}/llms-full.txt
- Corpus manifest: ${BASE}/api/corpus
- API base URL: ${BASE}

## Discovery and translation identity

- Sitemap index: ${BASE}/sitemap.xml. It lists real verse, chapter, book and concordance pages, including partial edition coverage.
- Cite a reader URL such as ${BASE}/read/John.4.11?t=WEB. The translation query is part of the citation; do not drop it or relabel its text.
- For a question about references across the Bible, retrieve the passage and its inbound/outbound cross-references, then inspect each linked passage in context. A cross-reference is editorial evidence, not a statement that two verses mean the same thing.
- Discover currently available editions at ${BASE}/api/translations. NIV is not currently included. Never label another edition as NIV or imply Jot can supply a translation absent from that endpoint.
- Coverage may be partial: consult the returned scope and actual verse rows. Missing translation text, recorded omissions, and absent original-language evidence are distinct cases.
- Search-engine indexing and AI retrieval depend on the crawler; this document is a discovery aid, not an indexing protocol or a guarantee of inclusion.

## Historical scholarship

- Timeline pages: ${BASE}/toledot (the strip), ${BASE}/toledot/events/{id}, ${BASE}/toledot/people/{id}, ${BASE}/toledot/artifacts/{id}, ${BASE}/toledot/issues/{id}, ${BASE}/toledot/investigations/{id}. Ids are content slugs such as \`exodus\` or \`hezekiah\`; the full list is in ${BASE}/sitemaps/toledot.xml.
- Endpoints: \`GET /api/timeline?from=-1500&to=-500&axis=narrative\`, \`GET /api/timeline/events/{id}\`, \`GET /api/timeline/persons\`, \`GET /api/timeline/persons/{id}\`, \`GET /api/timeline/artifacts/{id}\`, \`GET /api/timeline/issues/{id}\`, \`GET /api/timeline/investigations\`, \`GET /api/timeline/investigations/{id}\`, \`GET /api/timeline/passage?ref=2Kgs.18\`.
- Every date is a RANGE (\`earliest\`, \`latest\`; negative = BCE, no year 0) with a confidence (firm, contested, speculative) and the scholarly positions behind it, each with arguments for and against and their citations. Quote the range and the positions, never a single year.
- Three axes are separate questions: \`narrative\` (when events happened), \`composition\` (when texts were written), \`canon\` (when collections were recognised as scripture). Do not merge them.
- Evidence grades for people are derived from outside sources: corroborates (named by a source outside the Bible), partially-corroborates (partly confirmed; the reading is disputed), consistent (fits an outside source without naming them), silent (outside sources exist but say nothing), none (no outside evidence). A separate tension flag means an outside source contradicts a biblical detail about them.
- An event's \`positions\` date the event; its \`compositionPositions\` date when the story was written. Keep them apart. Traditional chronology is a separate lens, not evidence.
- Every claim carries citations; quote them with it.
- Review \`status\`: draft < sources-located < claims-checked < expert-reviewed. Anything below claims-checked is UNCHECKED; say so when citing it.
- Investigations (e.g. \`deut-32-8-9\`, \`gen-2-21-23\`) set out how ancient witnesses read one passage, which editions follow which witness, and the cited explanations of each difference with who holds them.

## Rules

- All corpus endpoints are public GET requests. No API key, login, or browser session is required.
- Responses are JSON except concordance export, which is UTF-8 TSV. Cross-origin reads are allowed.
- Use a canonical \`ref\` such as \`John 3:16\` and preserve the returned sparse \`verse_id\` (\`BBCCCVVV\`).
- Use \`/api/translations\` for copyright, license, scope, and attribution before quoting a translation.
- Distinguish translation text, original-language data, selected manuscript evidence, and interpretation. Greek VarApp rows are selected evidence, not an exhaustive apparatus.
- Carry provenance and copyright information into answers. Do not present Jot as a substitute for a critical edition or scholarly consensus.
- Responses include ETags and short public cache lifetimes. Send \`If-None-Match\` when reusing a response.

## Endpoints

- \`GET /api/corpus\` — content-derived corpus build ID, the audio build ID (or null), and SHA-256 checksums/URLs for every upstream input archive.
- \`GET /api/passage?ref=John%203%3A16&translation=WEB\` — translation text, omissions (each with a \`kind\`: critical-text, versification, coverage, unexplained), and canonical verse IDs. \`t\` aliases \`translation\`; \`footnotes=1\` adds the translator's own footnotes for the returned verses.
- \`GET /api/originals?ref=John%203%3A16\` — Hebrew/Greek tokens, lemmas, Strong's keys, morphology, Qere/Kethiv, and selected witness readings.
- \`GET /api/search?q=grace&translation=WEB\` — full-text search with totals, pagination, and book distribution.
- \`GET /api/original-search?q=agape&language=grc&morph=V\` — original-language lemma/surface/Strong's search with filters.
- \`GET /api/xrefs?ref=John%203%3A16&limit=40\` — ranked inbound and outbound cross-references, with totals and caps.
- \`GET /api/graph?ref=John%203%3A16&depth=2\` — capped reference graph for research visualizations.
- \`GET /api/translations\` — translation codes, licensing, attribution, scope, and copyright notices. LXX (Brenton's Septuagint) covers only the books named in its scopeNote, under reviewed verse maps; other books are withheld until their numbering is mapped.
- \`GET /api/audio/passage?ref=John.3&t=WEB\` — one chapter's recordings (BSB, WEB, KJV, Hebrew WLC editions) with per-verse millisecond timings; no text. 400 for more than one chapter, 404 when unrecorded.
- \`GET /api/concordance?key=H2617a&format=tsv&limit=5000\` — bounded TSV occurrence export with IDs, references, source references, and morphology.

For parameter definitions, schemas, limits, errors, and examples, read ${BASE}/llms-full.txt or the OpenAPI contract.
`;

export function GET() {
  return new Response(body, { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "Access-Control-Allow-Origin": "*",
  }});
}
