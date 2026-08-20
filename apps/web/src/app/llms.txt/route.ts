const BASE = "https://bible.lucascosolo.com";

const body = `# Jot Bible Research API

> Jot is a public, read-only Bible research corpus. Use these endpoints instead of scraping the interactive reader.

## Start here

- API guide: ${BASE}/api
- OpenAPI 3.1 contract: ${BASE}/api/openapi.json
- Full LLM instructions: ${BASE}/llms-full.txt
- Corpus manifest: ${BASE}/api/corpus
- API base URL: ${BASE}

## Rules

- All corpus endpoints are public GET requests. No API key, login, or browser session is required.
- Responses are JSON except concordance export, which is UTF-8 TSV. Cross-origin reads are allowed.
- Use a canonical \`ref\` such as \`John 3:16\` and preserve the returned sparse \`verse_id\` (\`BBCCCVVV\`).
- Use \`/api/translations\` for copyright, license, scope, and attribution before quoting a translation.
- Distinguish translation text, original-language data, selected manuscript evidence, and interpretation. Greek VarApp rows are selected evidence, not an exhaustive apparatus.
- Carry provenance and copyright information into answers. Do not present Jot as a substitute for a critical edition or scholarly consensus.
- Responses include ETags and short public cache lifetimes. Send \`If-None-Match\` when reusing a response.

## Endpoints

- \`GET /api/corpus\` — content-derived corpus build ID and SHA-256 checksums/URLs for every upstream input archive.
- \`GET /api/passage?ref=John%203%3A16&translation=WEB\` — translation text, omissions, apparatus, and canonical verse IDs.
- \`GET /api/originals?ref=John%203%3A16\` — Hebrew/Greek tokens, lemmas, Strong's keys, morphology, Qere/Kethiv, and selected witness readings.
- \`GET /api/search?q=grace&translation=WEB\` — full-text search with totals, pagination, and book distribution.
- \`GET /api/original-search?q=agape&language=grc&morph=V\` — original-language lemma/surface/Strong's search with filters.
- \`GET /api/xrefs?ref=John%203%3A16&limit=40\` — ranked inbound and outbound cross-references, with totals and caps.
- \`GET /api/graph?ref=John%203%3A16&depth=2\` — capped reference graph for research visualizations.
- \`GET /api/translations\` — translation codes, licensing, attribution, scope, and copyright notices.
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
