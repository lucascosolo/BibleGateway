import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import { getBookIndex } from "@/lib/db/corpus";
import {
  getConcordanceOccurrences,
  getConcordanceSummary,
  parseStrongsKey,
} from "@/lib/db/originals";
import { formatRange, singleton } from "@/lib/refs";

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 5_000;

function field(value: string | number): string {
  // TSV is deliberately boring and importable, but a surface form or source reference must not
  // be able to create a second row. Preserve the text while making the row boundary explicit.
  return String(value).replace(/[\t\r\n]+/g, " ");
}

/**
 * GET /api/concordance?key=H2617a&format=tsv&limit=5000
 *
 * A bounded occurrence export for concordance work. It returns canonical verse_id alongside the
 * human reference: researchers can import the file into a spreadsheet without losing Jot's only
 * stable address. The cap is in both the body comments and response headers, never silent.
 */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  const key = request.nextUrl.searchParams.get("key")?.trim();
  if (!key) return NextResponse.json({ error: "missing `key` parameter" }, { status: 400 });

  const format = request.nextUrl.searchParams.get("format") ?? "tsv";
  if (format !== "tsv") {
    return NextResponse.json({ error: "format must be `tsv`" }, { status: 400 });
  }

  const summary = getConcordanceSummary(key);
  if (!summary) return NextResponse.json({ error: `no concordance entry for "${key}"` }, { status: 404 });

  const requested = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "5000", 10);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : EXPORT_LIMIT, 1), EXPORT_LIMIT);
  const rows = getConcordanceOccurrences(key, limit, 0);
  const books = getBookIndex();
  const resolvedKey = parseStrongsKey(key) ?? key;
  const truncated = summary.total > rows.length;
  const lines = [
    "# Jot concordance export",
    `# key=${field(resolvedKey)}`,
    `# total=${summary.total}`,
    `# exported=${rows.length}`,
    `# truncated=${truncated ? "true" : "false"}`,
    "verse_id\treference\tsource_ref\tposition\tsurface\tmorphology\tlanguage",
    ...rows.map((row) => [
      row.verseId,
      formatRange(singleton(row.verseId), books),
      row.sourceRef,
      row.position,
      row.surface,
      row.morph,
      row.language,
    ].map(field).join("\t")),
  ];

  const headers = {
    ...corpusCacheHeaders(request),
    "Content-Type": "text/tab-separated-values; charset=utf-8",
    "Content-Disposition": `attachment; filename="jot-${encodeURIComponent(resolvedKey)}-occurrences.tsv"`,
    "X-Total-Count": String(summary.total),
    "X-Exported-Count": String(rows.length),
    "X-Export-Truncated": String(truncated),
  };
  return new NextResponse(`${lines.join("\n")}\n`, { headers });
}
