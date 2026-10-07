import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getEventSummaries, getIssueSummaries, getPerson } from "@/lib/db/timeline";
import { labelVerses } from "@/lib/db/timeline-present";
import { withDisplay } from "@/lib/timeline/years";

import { json, problem } from "../../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/persons/:id
 *
 * One person in full: who they are in the Bible and where, every source outside it that bears
 * on whether they existed and how (each cited), the events they take part in, and the
 * historical issues about them.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const { id } = await params;
  const person = getPerson(id);
  if (!person) return problem(404, `no person "${id}"`);

  return json(request, {
    ...person,
    lived: person.lived ? withDisplay(person.lived) : null,
    verses: labelVerses(person.verses),
    attestations: person.attestations.map((attestation) => ({
      ...attestation,
      href: `/api/timeline/artifacts/${attestation.artifactId}`,
    })),
    events: getEventSummaries(person.eventIds).map((event) => ({
      ...withDisplay(event),
      href: `/api/timeline/events/${event.id}`,
    })),
    issues: getIssueSummaries(person.issueIds).map((issue) => ({ ...issue, href: `/api/timeline/issues/${issue.id}` })),
  });
}
