import { tickStep, yearOffset, yearTicks } from "@/lib/timeline/strip-layout";
import { formatYear, spanYears } from "@/lib/timeline/years";

/**
 * The ruler under the Toledot strip: one tick per `step` years, placed by `spanYears` so the
 * missing year zero is never counted, labelled only through `formatYear`.
 */
export function YearAxis({ from, to, step }: { from: number; to: number; step?: number }) {
  const percentPerYear = 100 / spanYears(from, to);
  return (
    <ol className="toledot-axis" aria-label="Years">
      {yearTicks(from, to, step ?? tickStep(from, to)).map((year) => (
        <li key={year} className="toledot-axis__tick" style={{ left: `${yearOffset(from, year, percentPerYear)}%` }}>
          <span className="toledot-axis__label">{formatYear(year)}</span>
        </li>
      ))}
    </ol>
  );
}
