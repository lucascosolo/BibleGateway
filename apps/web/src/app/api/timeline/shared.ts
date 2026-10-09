import { NextResponse } from "next/server";

import { timelineCacheHeaders } from "@/lib/db/cache";
import type { InvestigationSummary } from "@/lib/db/timeline";
import { labelVerses } from "@/lib/db/timeline-present";

/** Response helpers for the `/api/timeline` routes. Presentation lives in `lib/db/timeline-present`. */

export function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: timelineCacheHeaders(request) });
}

/** Errors are not cached: a 404 for an event added in the next build must not outlive it. */
export function problem(status: 400 | 404, error: string) {
  return NextResponse.json({ error }, { status });
}

/** The passage an investigation examines, labelled and linked like every other timeline verse. */
export function investigationPassage({ start, end }: Pick<InvestigationSummary, "start" | "end">) {
  const [{ label, path }] = labelVerses([{ start, end, linkType: "describes", note: null }]);
  return { start, end, label, path };
}
