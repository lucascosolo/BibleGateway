import Link from "next/link";

import { getLexiconEntry } from "@/lib/lexicon";
import { FAMILIES, type TranslationProfile } from "@/lib/translations/profiles";

const HEADERS = ["Edition", "Year", "Old Testament source", "New Testament source", "Approach", "Family", "Audio"];

/**
 * Every edition side by side. A real table so the comparison survives a screen reader; at phone
 * width the wrapper scrolls horizontally with the edition column pinned, and the cards above the
 * table carry the same facts in reading order, so nothing is reachable only by side-scrolling.
 */
export function TranslationComparison({
  profiles,
  audioCodes,
}: {
  profiles: readonly TranslationProfile[];
  audioCodes: ReadonlySet<string>;
}) {
  return (
    <div className="translations-table" role="region" aria-label="Comparison table" tabIndex={0}>
      <table>
        <caption>Every edition on this site, compared</caption>
        <thead>
          <tr>
            {HEADERS.map((h) => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.code}>
              <td className="translations-table__edition">
                <Link href={`/translations/${p.code}`}>
                  <span className="translations-table__code">{p.code}</span> {p.name}
                </Link>
              </td>
              <td>{p.year}</td>
              <td>{p.otSource ?? "Not included"}</td>
              <td>{p.ntSource ?? "Not included"}</td>
              <td>{getLexiconEntry(`approach-${p.approach}`).term}</td>
              <td>{FAMILIES[p.family].label}</td>
              <td>{audioCodes.has(p.code) ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
