import type { Axis } from "./axes";
import { overlaps, spanYears } from "./years";

/**
 * Geometry for the Toledot strip. Pure: years in, pixels out, and every distance goes through
 * `spanYears` so the missing year zero is never counted.
 */

export interface StripBar {
  id: string;
  axis: Axis;
  /** Row within the axis lane; overlapping bars never share one. */
  lane: number;
  left: number;
  width: number;
}

/** Pixel offset of `year` from the window's start. */
export function yearOffset(from: number, year: number, pxPerYear: number): number {
  return spanYears(from, year) * pxPerYear;
}

/**
 * Bars for the events overlapping `[from, to]` (inclusive), packed greedy first-fit by earliest
 * year into rows per axis. `reserve` is the horizontal room a bar claims in its row beyond its
 * own width (its label), so a short bar's caption never runs under its neighbour.
 */
export function layoutBars(
  events: readonly { id: string; axis: Axis; earliest: number; latest: number }[],
  from: number,
  to: number,
  pxPerYear: number,
  minWidth = 8,
  reserve = 0,
): StripBar[] {
  const rowEnds = new Map<Axis, number[]>();
  return events
    .filter((event) => overlaps(event.earliest, event.latest, from, to))
    .sort((a, b) => a.earliest - b.earliest || a.latest - b.latest || a.id.localeCompare(b.id))
    .map((event) => {
      const left = yearOffset(from, event.earliest, pxPerYear);
      const width = Math.max(spanYears(event.earliest, event.latest) * pxPerYear, minWidth);
      const ends = rowEnds.get(event.axis) ?? [];
      rowEnds.set(event.axis, ends);
      let lane = ends.findIndex((end) => end < left);
      if (lane === -1) lane = ends.length;
      ends[lane] = left + Math.max(width, reserve);
      return { id: event.id, axis: event.axis, lane, left, width };
    });
}

const STEPS = [50, 100, 250, 500] as const;

/** The tick step for a window: the finest of 50/100/250/500 years giving at most 20 ticks. */
export function tickStep(from: number, to: number): number {
  const span = spanYears(from, to);
  return STEPS.find((step) => span / step <= 20) ?? STEPS[STEPS.length - 1];
}

/** Years in `[from, to]` that are multiples of `step`; zero is not a year, so never a tick. */
export function yearTicks(from: number, to: number, step: number): number[] {
  const ticks: number[] = [];
  for (let year = Math.ceil(from / step) * step; year <= to; year += step) {
    if (year !== 0) ticks.push(year);
  }
  return ticks;
}

/**
 * A window around the events, widened to half-centuries with a half-century of margin. The
 * margin is small on purpose: at phone width the strip shows about 140 years, and a century of
 * lead-in put the first event just off-screen, so the lanes looked empty until scrolled.
 */
export function defaultWindow(events: readonly { earliest: number; latest: number }[]): { from: number; to: number } {
  const nonZero = (year: number, fallback: number) => (year === 0 ? fallback : year);
  if (events.length === 0) return { from: -2000, to: 100 };
  const earliest = Math.min(...events.map((event) => event.earliest));
  const latest = Math.max(...events.map((event) => event.latest));
  return {
    from: nonZero(Math.floor(earliest / 50) * 50 - 50, 1),
    to: nonZero(Math.ceil(latest / 50) * 50 + 50, -1),
  };
}
