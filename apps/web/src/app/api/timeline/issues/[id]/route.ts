import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getEventSummaries, getIssue } from "@/lib/db/timeline";
import { labelVerses } from "@/lib/db/timeline-present";

import { json, problem } from "../../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/issues/:id
 *
 * A chronological, textual or historical problem — two verses that date the same thing
 * differently, or a question of whether an event happened as described — with each scholarly
 * view of it and its citations.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const { id } = await params;
  const issue = getIssue(id);
  if (!issue) return problem(404, `no timeline issue "${id}"`);

  return json(request, {
    ...issue,
    verses: labelVerses(issue.verses),
    events: getEventSummaries(issue.eventIds).map((event) => ({ id: event.id, title: event.title, href: `/api/timeline/events/${event.id}` })),
  });
}
