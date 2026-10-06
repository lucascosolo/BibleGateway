import Link from "next/link";
import {
  countInboundReferences, countOutboundReferences,
  getBookIndex, getInboundReferencesLimited, getOutboundReferencesLimited,
} from "@/lib/db/corpus";
import { formatRange, singleton, toUrlSlug, type VerseRange } from "@/lib/refs";

/** A text-free, server-rendered index; all scripture previews still use PassageRenderer. */
export function ReferenceLinks({ range, translationCode }: { range: VerseRange; translationCode: string }) {
  const books = getBookIndex();
  const groups = [
    { label: "References from this passage", total: countOutboundReferences(range, -1_000_000), rows: getOutboundReferencesLimited(range, -1_000_000, 20) },
    { label: "References to this passage", total: countInboundReferences(range, -1_000_000), rows: getInboundReferencesLimited(range, -1_000_000, 20) },
  ];
  return (
    <details className="concordance__more">
      <summary>Bible cross-reference links for {formatRange(range, books)}</summary>
      <p>Related passages in {translationCode}. References are editorial links from the cited source, not claims that the passages have identical meanings.
        {" "}<a href="https://www.openbible.info/labs/cross-references/">OpenBible cross-reference data</a> uses contributor votes, not scholarly consensus.</p>
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="lashon__subhead">{group.label}</h2>
          <p>{group.total === 0 ? "No references recorded." : `${group.rows.length} of ${group.total} references, ranked by votes.`}</p>
          <ol>
            {group.rows.map((row, index) => {
              const from = singleton(row.fromVerseId);
              const to = { start: row.toStartVerse, end: row.toEndVerse };
              return <li key={index}>
                <Link prefetch={false} href={`/read/${toUrlSlug(from, books)}?t=${translationCode}`}>{formatRange(from, books)}</Link>
                {" → "}
                <Link prefetch={false} href={`/read/${toUrlSlug(to, books)}?t=${translationCode}`}>{formatRange(to, books)}</Link>
                {` (${row.source})`}
              </li>;
            })}
          </ol>
        </section>
      ))}
      <p><Link prefetch={false} href={`/deep-dive/${toUrlSlug(range, books)}?t=${translationCode}`}>Explore the reference network</Link></p>
    </details>
  );
}
