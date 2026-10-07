import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getBookIndex } from "@/lib/db/corpus";
import { getEvent, getIssue } from "@/lib/db/timeline";

import { json, labelVerses, problem, withYears } from "../../shared";

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
    ...withYears(event),
    book: event.bookId === null ? null : getBookIndex().get(event.bookId)?.name ?? null,
    verses: labelVerses(event.verses),
    positions: event.positions.map((position) => ({
      ...withYears(position),
      arguments: position.arguments.map((argument) => ({ ...argument, verses: labelVerses(argument.verses) })),
    })),
    attestations: event.attestations.map((attestation) => ({
      ...attestation,
      href: `/api/timeline/artifacts/${attestation.artifactId}`,
    })),
    issues: event.issueIds.flatMap((issueId) => {
      const issue = getIssue(issueId);
      return issue ? [{ id: issue.id, kind: issue.kind, title: issue.title, status: issue.status, href: `/api/timeline/issues/${issue.id}` }] : [];
    }),
  });
}
