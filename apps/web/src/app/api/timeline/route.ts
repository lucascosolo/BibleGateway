import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getTimelineWindow } from "@/lib/db/timeline";
import { bookNames } from "@/lib/db/timeline-present";
import { AXES, isAxis, type Axis } from "@/lib/timeline/axes";
import { withDisplay } from "@/lib/timeline/years";

import { json, problem } from "./shared";

// Reads query params and a request header; see apps/web/src/app/api/passage/route.ts.
export const dynamic = "force-dynamic";

/** Wider than anything the content will hold; the default window when none is given. */
const ALL_TIME = { from: -4000, to: 400 } as const;

function year(value: string | null, fallback: number): number | string {
  if (value === null || value === "") return fallback;
  if (!/^-?\d+$/.test(value)) return `"${value}" is not a whole year (negative = BCE)`;
  const parsed = Number.parseInt(value, 10);
  if (parsed === 0) return "there is no year 0: use -1 for 1 BCE and 1 for 1 CE";
  return parsed;
}

/**
 * GET /api/timeline?from=-1500&to=-500&axis=narrative
 *
 * Events and eras overlapping a window of years, earliest first. Each event is a RANGE — the
 * envelope of the scholarly positions on its date — never a point, with `confidence` and the
 * review `status` the UI must show.
 *
 * Events come back in `tracks`, one list per axis — `narrative` (when events happened),
 * `composition` (when texts were written), `canon` (when collections were recognised) — and
 * never as one merged list: the three are different questions on different scales, and a flat
 * list sorted by year is the conflation ARCHITECTURE.md §0.2 forbids. `axis` fills only that
 * track; the others are empty.
 */
export async function GET(request: NextRequest) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const params = request.nextUrl.searchParams;
  const from = year(params.get("from"), ALL_TIME.from);
  const to = year(params.get("to"), ALL_TIME.to);
  if (typeof from === "string") return problem(400, `from: ${from}`);
  if (typeof to === "string") return problem(400, `to: ${to}`);
  if (from > to) return problem(400, "from must not be after to");
  const axisParam = params.get("axis");
  if (axisParam !== null && !isAxis(axisParam)) {
    return problem(400, `axis must be one of ${AXES.map((a) => `"${a}"`).join(", ")}`);
  }
  const axis = (axisParam ?? undefined) as Axis | undefined;

  const window = getTimelineWindow({ from, to, axis });
  const tracks = Object.fromEntries(AXES.map((name) => [name, [] as unknown[]])) as Record<Axis, unknown[]>;
  for (const event of window.events) {
    tracks[event.axis].push({
      ...withDisplay(event),
      books: bookNames(event.bookIds),
      href: `/api/timeline/events/${event.id}`,
    });
  }
  return json(request, {
    available: window.available,
    from,
    to,
    axis: axis ?? null,
    eras: window.eras.map((era) => ({ ...era, display: withDisplay({ earliest: era.start, latest: era.end }).display })),
    tracks,
  });
}
