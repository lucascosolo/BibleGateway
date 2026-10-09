import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getInvestigationSummaries } from "@/lib/db/timeline";

import { investigationPassage, json } from "../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/investigations
 *
 * Every textual investigation: one passage whose witnesses (Masoretic text, Septuagint, Dead
 * Sea Scrolls…) read differently, with how many witnesses and explained differences it holds
 * and its review status.
 */
export async function GET(request: NextRequest) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  return json(request, {
    investigations: getInvestigationSummaries().map((investigation) => ({
      ...investigation,
      passage: investigationPassage(investigation),
      href: `/api/timeline/investigations/${investigation.id}`,
    })),
  });
}
