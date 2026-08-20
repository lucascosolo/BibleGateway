import type { GreekManuscriptReading } from "@/lib/db/originals";

interface Locus {
  sourceRef: string;
  readings: GreekManuscriptReading[];
}

function groupByLocus(rows: readonly GreekManuscriptReading[]): Locus[] {
  const loci: Locus[] = [];
  const byRef = new Map<string, Locus>();
  for (const row of rows) {
    let locus = byRef.get(row.sourceRef);
    if (!locus) {
      locus = { sourceRef: row.sourceRef, readings: [] };
      byRef.set(row.sourceRef, locus);
      loci.push(locus);
    }
    locus.readings.push(row);
  }
  return loci;
}

/** Witness-level evidence, kept collapsed so a chapter does not become a wall of sigla. */
export function GreekManuscriptApparatus({ rows }: { rows: readonly GreekManuscriptReading[] }) {
  if (rows.length === 0) return null;
  const loci = groupByLocus(rows);
  return (
    <details className="greek-manuscript-apparatus">
      <summary>
        <span>Manuscript readings</span> <small>({loci.length} loci · {rows.length} readings)</small>
      </summary>
      <div className="greek-manuscript-apparatus__body">
        <p className="greek-manuscript-apparatus__intro">
          A selected apparatus of Greek readings and the witnesses that support them. The first
          reading is the SBLGNT base text; this is not a complete census of every manuscript.
        </p>
        <ol className="greek-manuscript-apparatus__list">
          {loci.map((locus) => (
            <li key={locus.sourceRef}>
              <strong>{locus.sourceRef}</strong>
              <ul>
                {locus.readings.map((reading) => (
                  <li key={reading.variantId}>
                    <span lang="grc">{reading.readingText}</span>{" "}
                    <span className="greek-manuscript-apparatus__witnesses">{reading.witnesses}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="greek-manuscript-apparatus__source">
          Source: <a href="https://crosswire.org/sword/modules/ModInfo.jsp?modName=VarApp" target="_blank" rel="noreferrer noopener">CrossWire VarApp</a>, CC0.
        </p>
      </div>
    </details>
  );
}
