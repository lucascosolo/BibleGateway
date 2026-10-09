import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getInvestigation } from "@/lib/db/timeline";

import { investigationPassage, json, problem } from "../../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/investigations/:id
 *
 * One investigation in full: each witness's reading with its citations, which printed
 * editions follow which witness, the cited differences between them (with who holds each
 * explanation), and the cited challenges to the investigation's own conclusions.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const { id } = await params;
  const investigation = getInvestigation(id);
  if (!investigation) return problem(404, `no investigation "${id}"`);

  return json(request, {
    ...investigation,
    passage: investigationPassage(investigation),
    href: `/api/timeline/investigations/${investigation.id}`,
    page: `/toledot/investigations/${investigation.id}`,
  });
}
