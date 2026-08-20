import Link from "next/link";

export const metadata = {
  title: "Read-only API · Jot",
  description: "Documented read-only endpoints for the Jot Bible study corpus.",
};

const endpoints = [
  {
    method: "GET",
    path: "/api/passage?ref=John+3:16&translation=WEB",
    description: "Translation text, copyright notice, and omission apparatus for a canonical reference.",
  },
  {
    method: "GET",
    path: "/api/originals?ref=John+3:16",
    description: "Word-level Hebrew/Greek data, morphology, Qere/Kethiv, edition differences, and selected witness readings.",
  },
  {
    method: "GET",
    path: "/api/search?q=grace&translation=WEB",
    description: "Full-text search with totals, pagination, and book distribution.",
  },
  {
    method: "GET",
    path: "/api/original-search?q=agape&language=grc&morph=V",
    description: "Lemma/surface search over Hebrew, Aramaic, and Greek with morphology-prefix filtering.",
  },
  {
    method: "GET",
    path: "/api/xrefs?ref=John+3:16&limit=40",
    description: "Vote-ranked inbound and outbound cross-references with real totals and caps.",
  },
  {
    method: "GET",
    path: "/api/graph?ref=John+3:16&depth=2",
    description: "Capped reference graph with node/edge disclosure for research visualizations.",
  },
  {
    method: "GET",
    path: "/api/translations",
    description: "Translation codes, licensing, attribution, scope, and copyright notices.",
  },
  {
    method: "GET",
    path: "/api/concordance?key=H2617a&format=tsv",
    description: "Bounded TSV occurrence export with canonical verse IDs, source references, and morphology.",
  },
];

export default function ApiPage() {
  return (
    <main className="api-docs">
      <header className="api-docs__header">
        <Link href="/" className="api-docs__back">← Jot</Link>
        <p className="api-docs__eyebrow">Research interface</p>
        <h1>Read-only API</h1>
        <p>
          Stable JSON endpoints for tools that need Jot&rsquo;s text and apparatus without
          scraping the reader. All corpus responses carry an ETag and a short cache lifetime
          tied to the content-derived build ID.
        </p>
      </header>
      <section aria-labelledby="api-endpoints-title">
        <h2 id="api-endpoints-title">Endpoints</h2>
        <ul className="api-docs__endpoints">
          {endpoints.map((endpoint) => (
            <li key={endpoint.path}>
              <code>{endpoint.method}</code>
              <a href={endpoint.path}><code>{endpoint.path}</code></a>
              <p>{endpoint.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="api-contract-title">
        <h2 id="api-contract-title">Contract</h2>
        <p>
          References use the same parser as the reader and resolve to the canonical sparse
          <code>verse_id</code> address space. Responses include a human-readable reference and
          numeric range. Corpus endpoints are public and cacheable; annotation endpoints are
          private and never cached. Missing or malformed parameters return JSON errors with 400
          or 404 status codes.
        </p>
        <p>
          The original-language endpoint identifies each source and its license. VarApp is a
          selected witness apparatus, not a claim of exhaustive manuscript coverage.
        </p>
        <p>
          A machine-readable OpenAPI contract is available at{" "}
          <a href="/api/openapi.json"><code>/api/openapi.json</code></a>. It describes the
          public parameters and response guarantees without requiring a client to scrape this
          page.
        </p>
        <p>
          For language models and retrieval agents, start with the concise index at{" "}
          <a href="/llms.txt"><code>/llms.txt</code></a> or the full retrieval instructions at{" "}
          <a href="/llms-full.txt"><code>/llms-full.txt</code></a>. The API is intentionally
          unauthenticated, read-only, and cross-origin accessible.
        </p>
      </section>
    </main>
  );
}
