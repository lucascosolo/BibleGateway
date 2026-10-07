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
        // A label centred on a tick at either edge of the ruler is half clipped by the strip's
        // overflow; the edge ticks anchor their label inward instead.
        <li
          key={year}
          className="toledot-axis__tick"
          data-edge={year === from ? "start" : year === to ? "end" : undefined}
          style={{ left: `${yearOffset(from, year, percentPerYear)}%` }}
        >
          <span className="toledot-axis__label">{formatYear(year)}</span>
        </li>
      ))}
    </ol>
  );
}
