import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import { getCorpusBuildId, getCorpusSources } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/corpus
 *
 * Machine-readable identity for citations and reproducible research. The build id identifies the
 * derived SQLite corpus; source rows identify the exact upstream archives and their SHA-256
 * checksums. This is intentionally public: a read-only corpus is useful only if a researcher can
 * say which inputs they consulted.
 */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  return NextResponse.json(
    {
      buildId: getCorpusBuildId(),
      sources: getCorpusSources(),
    },
    { headers: corpusCacheHeaders(request) },
  );
}
