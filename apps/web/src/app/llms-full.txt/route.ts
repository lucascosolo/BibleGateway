const BASE = "https://bible.lucascosolo.com";

const body = `# Jot API instructions for language models

Jot is a public, read-only Bible research API for retrieval by search engines, agents, and language models. Do not scrape HTML when an API endpoint below provides the data.

## Retrieval workflow

1. Resolve the user's reference into a Jot reference such as \`John 3:16\`.
2. Call \`/api/corpus\` when recording a reproducible citation; retain its \`buildId\` and source checksums.
3. Call \`/api/passage?ref=...&translation=...\` for quoted translation text. If no translation is named, call \`/api/translations\` and state which one you selected.
4. Call \`/api/originals?ref=...\` for Hebrew, Aramaic, Greek, morphology, Qere/Kethiv, or textual differences.
5. Call \`/api/original-search?q=...\` for lemma, surface-form, Strong's-key, or morphology-prefix searches.
6. Call \`/api/xrefs\` or \`/api/graph\` when relationships are relevant; both are bounded and disclose caps.
7. Call \`/api/concordance?key=...&format=tsv\` for a machine-readable occurrence list; keep \`limit<=5000\`.
8. Cite the returned reference, translation, source/provenance, build ID, and any truncation or selected-apparatus caveat. Separate retrieved evidence from interpretation.

## Canonical addressing

\`verse_id\` is the only stable address: \`BBCCCVVV\` as an integer (book × 1,000,000 + chapter × 1,000 + verse). The space is sparse; never infer verse counts by subtracting IDs or invent IDs by walking numeric ranges. Use returned \`verse_id\` and \`reference\` fields.

## Endpoint contract

### Corpus identity

\`GET ${BASE}/api/corpus\`

Returns the content-derived \`buildId\` and a public manifest of every upstream input archive with its source URL, filename, and SHA-256 checksum. Store this alongside a research citation; the build ID identifies the derived corpus, while the manifest identifies its inputs.

### Passage

\`GET ${BASE}/api/passage?ref=John%203%3A16&translation=WEB\`

Returns translation metadata, verse rows, omissions/apparatus, canonical verse IDs, and the corpus build identifier. Omission rows include both \`reason\` and a cautious \`history\` explaining likely harmonizing, explanatory, or liturgical transmission; they deliberately do not claim an exact insertion year. Use them when explaining why a translation leaves a verse out. \`ref\` is required; \`translation\` is optional.

### Original language

\`GET ${BASE}/api/originals?ref=John%203%3A16\`

Returns token-level surface text, lemma, Strong's key, morphology, language, source references, and relevant apparatus. Selected VarApp evidence is not exhaustive manuscript coverage.

### English text search

\`GET ${BASE}/api/search?q=grace&translation=WEB&page=1&pageSize=20\`

Searches translation text and returns hits, total, pagination, and book distribution.

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

Returns translation codes, names, rights, license/attribution, scope, and copyright notices. Fetch this before quoting a translation whose rights are not already known.

### Concordance export

\`GET ${BASE}/api/concordance?key=H2617a&format=tsv&limit=5000\`

Returns UTF-8 TSV. Comment lines provide total/exported/truncated counts, followed by \`verse_id\`, \`reference\`, \`source_ref\`, \`position\`, \`surface\`, \`morphology\`, and \`language\`. Report truncation rather than implying completeness.

## HTTP behavior

- Successful corpus responses are public and cacheable. They include \`ETag\`, \`Cache-Control\`, and \`Access-Control-Allow-Origin: *\`.
- Send \`If-None-Match\` to receive \`304 Not Modified\` when unchanged.
- Invalid or missing parameters return JSON errors with HTTP 400; unresolved references return HTTP 404.
- Corpus responses are tied to a content-derived build ID. Do not cache forever under an unversioned URL.
- Annotation routes are private and should not be called by unauthenticated clients.

## Machine-readable contract

- OpenAPI: ${BASE}/api/openapi.json
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
