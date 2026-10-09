import { shareMetadata } from "@/app/og/data";
import Link from "next/link";
import { getOutsideDocFacts, type OutsideDocFacts } from "@/app/_docs/outside-facts";

export const metadata = shareMetadata('Bible research API: text, cross-references & original languages · Jot', 'Public read-only Bible API with translation text, verse references, Hebrew and Greek words, manuscript evidence, source provenance and corpus exports.', '/api', { card: { kind: "page", page: "api" } });

const endpointsFor = (outside: OutsideDocFacts) => [
  {
    method: "GET",
    path: "/api/passage?ref=John+3:16&translation=WEB",
    description: "Translation text, copyright notice, and omission apparatus for a canonical reference. Each omission states its kind: critical-text, versification, coverage or unexplained.",
  },
  {
    method: "GET",
    path: "/api/passage?ref=Deut.23&t=LXX&footnotes=1",
    description: "The same, with the translator's own footnotes for the returned verses (off unless footnotes=1). t is an alias for translation.",
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
    path: "/api/timeline?from=-1500&to=-500&axis=narrative",
    description: "Dated events as ranges, never points, with confidence and review status; composition dates on a separate axis.",
  },
  {
    method: "GET",
    path: "/api/timeline/events/exodus",
    description: "One event's dating positions, cited arguments for each, corroborating inscriptions and objects, and linked issues.",
  },
  {
    method: "GET",
    path: "/api/timeline/passage?ref=1+Kings+6:1",
    description: "Timeline events, chronological issues, outside sources and people that bear on a passage.",
  },
  {
    method: "GET",
    path: "/api/timeline/investigations",
    description: "Textual investigations: one passage where ancient witnesses differ, with witness and difference counts and review status.",
  },
  {
    method: "GET",
    path: "/api/timeline/investigations/deut-32-8-9",
    description: "One investigation: each witness's reading, which editions follow which witness, and the cited explanations of each difference with who holds them.",
  },
  {
    method: "GET",
    path: "/api/timeline/persons/hezekiah",
    description: "One biblical figure: every source outside the Bible that names, fits or contradicts them, with a derived evidence grade.",
  },
  {
    method: "GET",
    path: "/api/passage?ref=Thomas+42&translation=MATTISON",
    description: "An outside book (not in the Hebrew or Protestant canon): logion 42 of the Gospel of Thomas. The response names the book's canon and numbering scheme. Also Sir 1:1 in KJVA.",
  },
  {
    method: "GET",
    path: "/api/search?q=kingdom&canon=all&translation=MATTISON",
    description: "Search including the outside books. canon=bible (default) is the 66 books only; all adds books 67-120.",
  },
  {
    method: "GET",
    path: "/api/timeline/works?canon=nt-apocrypha",
    description: "Work records for the outside books, filterable by canon. Undated works say so (composed is null, composedUndated says why); no range is invented.",
  },
  {
    method: "GET",
    path: "/api/timeline/works/gospel-of-thomas",
    description: "One work: cited dating positions, surviving copies, who reads it as scripture, translations, excerpts and a link to its page.",
  },
  {
    method: "GET",
    path: "/api/translations",
    description: `Translation codes, licensing, attribution, scope, and copyright notices. Partial editions such as Brenton's Septuagint state which books they hold and why the rest are withheld. The ${outside.translationWord.toLowerCase()} outside-book editions (${outside.translationCodes.join(", ")}) have scope outside and list their books.`,
  },
  {
    method: "GET",
    path: "/api/audio/passage?ref=John.3&t=WEB",
    description: "One chapter's recordings in every audio edition with per-verse millisecond timings. No text; one chapter per request.",
  },
  {
    method: "GET",
    path: "/api/corpus",
    description: "Content-derived build IDs, the canonical verse count (31,102), outside-book counts and books by canon, and checksums of every upstream input.",
  },
  {
    method: "GET",
    path: "/api/concordance?key=H2617a&format=tsv",
    description: "Bounded TSV occurrence export with canonical verse IDs, source references, and morphology.",
  },
];

export default function ApiPage() {
  const outside = getOutsideDocFacts();
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
          {endpointsFor(outside).map((endpoint) => (
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
          Timeline records carry a review status: draft, sources-located, claims-checked,
          expert-reviewed. Anything below claims-checked is unchecked &mdash; its sources are
          located but its claims are not yet verified against them &mdash; and should be cited
          as such. Every position, argument, attestation and difference carries its citations.
          An event&rsquo;s <code>positions</code> date the event; its
          <code>compositionPositions</code> date when its story was written.
        </p>
        <p>
          Outside books (ids 67&ndash;120) are in none of the Hebrew or Protestant canons: the
          Septuagint&rsquo;s extra books (Catholic and Orthodox Bibles include most, and differ),
          Second Temple writings (only the Ethiopian Orthodox church reads 1 Enoch and Jubilees as
          scripture), New Testament apocrypha and the Apostolic Fathers (in no New Testament), and
          described works. Each carries its numbering scheme (chapter-verse, logion, section,
          chapter, part-chapter, paragraph or page). Every edition is public domain on a stated
          basis, in its <code>license</code> and notice, with proofreading status.{" "}
          {outside.undatedCount > 0 && (
            <>
              {outside.undatedWord} {outside.undatedCount === 1 ? "work is" : "works are"} undated;
              their records say so rather than carrying a range.
            </>
          )}
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
