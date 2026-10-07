import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getBookIndex } from "@/lib/db/corpus";
import { getTimelineForRange, getTimelineNotesForRange } from "@/lib/db/timeline";
import { InvalidReferenceError, formatRange, parseReference } from "@/lib/refs";
import { formatRange as formatYears, withDisplay } from "@/lib/timeline/years";

import { json, problem } from "../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/passage?ref=2Kgs.18
 *
 * What the timeline knows about a passage: the events it describes or helps date, the issues it
 * raises, the people it names, and the objects and texts outside the Bible that bear on it. This is the reader's way in — a
 * verse that dates the Exodus (1 Kings 6:1) leads to the Exodus even though it describes the
 * temple.
 */
export async function GET(request: NextRequest) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) return problem(400, "missing `ref` parameter");
  const books = getBookIndex();
  let range;
  try {
    range = parseReference(ref, books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) return problem(400, error.message);
    throw error;
  }

  const found = getTimelineForRange(range);
  return json(request, {
    reference: formatRange(range, books),
    events: found.events.map((event) => ({ ...withDisplay(event), href: `/api/timeline/events/${event.id}` })),
    issues: found.issues.map((issue) => ({ ...issue, href: `/api/timeline/issues/${issue.id}` })),
    artifacts: found.artifacts.map((artifact) => ({
      ...artifact,
      made: artifact.made ? { ...artifact.made, display: formatYears(artifact.made.earliest, artifact.made.latest) } : null,
      href: `/api/timeline/artifacts/${artifact.id}`,
    })),
    persons: found.persons.map((person) => ({
      ...person,
      lived: person.lived ? withDisplay(person.lived) : null,
      href: `/api/timeline/persons/${person.id}`,
    })),
    // The inputs of the reader's margin notes, one per verse link per subject per anchor verse.
    notes: getTimelineNotesForRange(range),
  });
}
