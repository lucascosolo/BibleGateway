import { NextResponse } from "next/server";

import { timelineCacheHeaders } from "@/lib/db/cache";

/** Response helpers for the `/api/timeline` routes. Presentation lives in `lib/db/timeline-present`. */

export function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: timelineCacheHeaders(request) });
}

/** Errors are not cached: a 404 for an event added in the next build must not outlive it. */
export function problem(status: 400 | 404, error: string) {
  return NextResponse.json({ error }, { status });
}
