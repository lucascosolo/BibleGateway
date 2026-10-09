import { NextResponse, type NextRequest } from "next/server";

import { getAudioBuildId, hasAudio } from "@/lib/db/audio";
import { audioCacheHeaders, audioNotModified } from "@/lib/db/cache";
import { getCorpusBuildId, getCorpusSources } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/corpus
 *
 * Machine-readable identity for citations and reproducible research. The build id identifies the
 * derived SQLite corpus; source rows identify the exact upstream archives and their SHA-256
 * checksums. `audioBuildId` identifies the separately built recordings artifact, or is null when
 * this deployment has none. This is intentionally public: a read-only corpus is useful only if a researcher can
 * say which inputs they consulted.
 */
export async function GET(request: NextRequest) {
  // Versioned by both artifacts the body names; a tag on the corpus alone would answer 304 with
  // a stale `audioBuildId` after an audio-only rebuild.
  const unchanged = audioNotModified(request);
  if (unchanged) return unchanged;

  return NextResponse.json(
    {
      buildId: getCorpusBuildId(),
      audioBuildId: hasAudio() ? getAudioBuildId() : null,
      sources: getCorpusSources(),
    },
    { headers: audioCacheHeaders(request) },
  );
}
