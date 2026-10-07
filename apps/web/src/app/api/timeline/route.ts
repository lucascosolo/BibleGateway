import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getBookIndex } from "@/lib/db/corpus";
import { getTimelineWindow, type Axis } from "@/lib/db/timeline";

import { json, problem, withYears } from "./shared";

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
 * review `status` the UI must show. `axis` keeps the two timelines apart: `narrative` (when the
 * events happened) and `composition` (when the texts were written). Omit it for both.
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
  if (axisParam !== null && axisParam !== "narrative" && axisParam !== "composition") {
    return problem(400, 'axis must be "narrative" or "composition"');
  }
  const axis = (axisParam ?? undefined) as Axis | undefined;

  const window = getTimelineWindow({ from, to, axis });
  const books = getBookIndex();
  return json(request, {
    available: window.available,
    from,
    to,
    axis: axis ?? null,
    eras: window.eras.map((era) => ({ ...era, display: withYears({ earliest: era.start, latest: era.end }).display })),
    events: window.events.map((event) => ({
      ...withYears(event),
      book: event.bookId === null ? null : books.get(event.bookId)?.name ?? null,
      href: `/api/timeline/events/${event.id}`,
    })),
  });
}
