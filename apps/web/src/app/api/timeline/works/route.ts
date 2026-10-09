import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getWorkSummaries } from "@/lib/db/timeline";

import { json, problem } from "../shared";
import { workSummaryView } from "./present";

export const dynamic = "force-dynamic";

const CANONS = ["deuterocanon", "pseudepigrapha", "nt-apocrypha", "apostolic", "described"];

/**
 * GET /api/timeline/works[?canon=nt-apocrypha]
 *
 * Every work record for the outside books (Chitzonim), grouped by canon in the order
 * deuterocanon, pseudepigrapha, nt-apocrypha, apostolic, described. `composed` is the derived
 * envelope of the scholarly positions, or null when no filed source dates the work; then
 * `composedUndated` says why and what is known. A range is never invented for an undated work.
 */
export async function GET(request: NextRequest) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const canon = request.nextUrl.searchParams.get("canon");
  if (canon !== null && !CANONS.includes(canon)) {
    return problem(400, `unknown canon "${canon}"; use one of ${CANONS.join(", ")}`);
  }

  const works = getWorkSummaries().filter((work) => canon === null || work.canon === canon);
  return json(request, { canon, total: works.length, works: works.map(workSummaryView) });
}
