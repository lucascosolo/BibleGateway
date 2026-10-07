/**
 * Historical years as the timeline stores them: integers, negative = BCE, positive = CE, and
 * NO YEAR ZERO — 1 BCE is followed directly by 1 CE. That gap is why nothing here is plain
 * subtraction: `30 - (-4)` is 34, but 4 BCE to 30 CE is 33 years.
 *
 * A zero reaching any of these functions means a bug upstream (the builder refuses to store
 * one), so it throws rather than quietly formatting a year that never existed.
 */

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year === 0) {
    throw new RangeError(`not a historical year: ${year} (negative = BCE, positive = CE, no year 0)`);
  }
}

const era = (year: number) => (year < 0 ? "BCE" : "CE");

/** `-586` → `"586 BCE"`, `33` → `"33 CE"`. */
export function formatYear(year: number): string {
  assertYear(year);
  return `${Math.abs(year)} ${era(year)}`;
}

/**
 * `-1446, -1406` → `"1446–1406 BCE"`; `-4, 30` → `"4 BCE–30 CE"`; `-701, -701` → `"701 BCE"`.
 * The era suffix is written once when both ends share it.
 */
export function formatRange(earliest: number, latest: number): string {
  assertYear(earliest);
  assertYear(latest);
  if (earliest === latest) return formatYear(earliest);
  if (era(earliest) === era(latest)) return `${Math.abs(earliest)}–${Math.abs(latest)} ${era(latest)}`;
  return `${formatYear(earliest)}–${formatYear(latest)}`;
}

/** Year boundaries crossed between two years, skipping the year zero that does not exist. */
export function spanYears(from: number, to: number): number {
  assertYear(from);
  assertYear(to);
  const crossesEra = (from < 0) !== (to < 0);
  return Math.abs(to - from) - (crossesEra ? 1 : 0);
}

/** Inclusive interval overlap: ranges sharing a single endpoint year overlap. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  for (const year of [aStart, aEnd, bStart, bEnd]) assertYear(year);
  return aStart <= bEnd && bStart <= aEnd;
}

/** The item with a `display` string for its range added: `{ earliest: -1446, … }` → `"1446… BCE"`. */
export function withDisplay<T extends { earliest: number; latest: number }>(item: T): T & { display: string } {
  return { ...item, display: formatRange(item.earliest, item.latest) };
}
