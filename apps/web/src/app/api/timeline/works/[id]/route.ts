import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getWork } from "@/lib/db/timeline";
import { withDisplay } from "@/lib/timeline/years";

import { json, problem } from "../../shared";
import { labelWorkVerses, workSummaryView } from "../present";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/works/:id
 *
 * One work in full: its dating positions (each cited, with who holds it), where and when its
 * copies survive (`witnesses`), who reads it as scripture (`heldCanonicalBy`), the translations
 * that print it, short cited excerpts, and the verses it touches. `composed` is null and
 * `composedUndated` set when no filed source dates the work.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  const { id } = await params;
  const work = getWork(id);
  if (!work) return problem(404, `no work "${id}"`);

  const { composed: positions, verses, witnesses, ...rest } = work;
  return json(request, {
    ...workSummaryView(rest),
    positions: positions.map(withDisplay),
    witnesses: witnesses.map((witness) => withDisplay(witness)),
    verses: labelWorkVerses(verses),
  });
}
