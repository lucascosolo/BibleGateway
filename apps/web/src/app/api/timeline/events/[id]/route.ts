import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getEvent, getIssueSummaries } from "@/lib/db/timeline";
import { bookNames, labelVerses } from "@/lib/db/timeline-present";
import { withDisplay } from "@/lib/timeline/years";

import { json, problem } from "../../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/events/:id
 *
 * One event in full: why it is dated where it is. Every scholarly position with its range, who
 * holds it, the arguments for and against it, and their citations; the sources outside the
 * Bible that bear on it and whether they corroborate it; the chronological and historical
 * issues attached to it; and the passages it concerns.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const { id } = await params;
  const event = getEvent(id);
  if (!event) return problem(404, `no timeline event "${id}"`);

  return json(request, {
    ...withDisplay(event),
    books: bookNames(event.bookIds),
    verses: labelVerses(event.verses),
    positions: event.positions.map((position) => ({
      ...withDisplay(position),
      arguments: position.arguments.map((argument) => ({ ...argument, verses: labelVerses(argument.verses) })),
    })),
    // Positions that date the writing of the story, not the event; kept apart so a client
    // computing a span from `positions` gets the same envelope the page and the strip show.
    compositionPositions: event.compositionPositions.map((position) => ({
      ...withDisplay(position),
      arguments: position.arguments.map((argument) => ({ ...argument, verses: labelVerses(argument.verses) })),
    })),
    attestations: event.attestations.map((attestation) => ({
      ...attestation,
      href: `/api/timeline/artifacts/${attestation.artifactId}`,
    })),
    issues: getIssueSummaries(event.issueIds).map((issue) => ({ ...issue, href: `/api/timeline/issues/${issue.id}` })),
  });
}
