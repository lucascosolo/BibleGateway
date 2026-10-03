import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";

import { parseRange } from "@/lib/audio/http";

import { AUDIO_FILES_DIR, getAudioBuildId } from "@/lib/db/audio";

export const dynamic = "force-dynamic";

/**
 * GET /audio/<edition>/<bb>-<ccc>.m4a — the chapter recordings.
 *
 * A route handler rather than `public/`, for two reasons. The files are a build artifact
 * that lives beside `bible.db` under `data/`, outside the app tree, and a symlink into
 * `public/` is the kind of deployment detail that works on one host and silently 404s on
 * the next. And seeking needs HTTP Range: pressing play on verse 14 asks the browser for the
 * middle of the file, and a server that answers with the whole file from byte 0 makes every
 * seek a full download before playback can start. `send`-style static serving would do
 * ranges too, but this way the behaviour is in the repo and testable rather than assumed.
 *
 * Cache policy: the URL carries the audio build id (`?v=`), so a file may be cached for a
 * year — a rebuilt artifact changes the id and therefore the URL.
 */

const ROOT = path.resolve(AUDIO_FILES_DIR);


export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  // Resolve, then require the result to stay under the audio root: `..` segments, encoded or
  // not, would otherwise read arbitrary files.
  const target = path.resolve(ROOT, ...segments);
  if (!target.startsWith(ROOT + path.sep) || !target.endsWith(".m4a")) {
    return new Response("not found", { status: 404 });
  }
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(target);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("not found", { status: 404 });

  const size = stat.size;
  const versioned = request.nextUrl.searchParams.get("v") === getAudioBuildId();
  const headers: Record<string, string> = {
    "Content-Type": "audio/mp4",
    "Accept-Ranges": "bytes",
    // Only the versioned URL is immutable. A bare URL (someone typing it in) revalidates.
    "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
  };

  const range = parseRange(request.headers.get("range"), size);
  if (request.headers.get("range") && !range) {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }

  const [start, end] = range ?? [0, size - 1];
  headers["Content-Length"] = String(end - start + 1);
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;

  if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });

  const stream = fs.createReadStream(target, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  });
}

export const HEAD = GET;
