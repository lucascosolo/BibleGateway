import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getArtifact } from "@/lib/db/timeline";
import { formatRange } from "@/lib/timeline/years";

import { labelVerses } from "@/lib/db/timeline-present";

import { json, problem } from "../../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/artifacts/:id
 *
 * An inscription, chronicle, relief or other object from outside the Bible: what it is, where
 * it is held, what it says, and which events it corroborates, is consistent with, is silent on,
 * or is in tension with. `made` is null when the object's own date is not established.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const { id } = await params;
  const artifact = getArtifact(id);
  if (!artifact) return problem(404, `no artifact "${id}"`);

  return json(request, {
    ...artifact,
    made: artifact.made ? { ...artifact.made, display: formatRange(artifact.made.earliest, artifact.made.latest) } : null,
    verses: labelVerses(artifact.verses),
    attestations: artifact.attestations.map((attestation) => ({
      ...attestation,
      href: `/api/timeline/events/${attestation.eventId}`,
    })),
    persons: artifact.persons.map((attestation) => ({
      ...attestation,
      href: `/api/timeline/persons/${attestation.personId}`,
    })),
  });
}
