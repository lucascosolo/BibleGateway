import { getTranslationByCode } from "@/lib/db/corpus";
import { getCanonicalDiscoveryRows, getConcordanceDiscoveryKeys, getEditionDiscoveryRows } from "@/lib/db/discovery";
import { SITE_URL, escapeXml, xmlResponse } from "@/lib/seo";
import { toledotSitemapPaths } from "@/app/toledot/sitemap";
import { PROFILES } from "@/lib/translations/profiles";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!file.endsWith(".xml")) return new Response("Not found", { status: 404 });
  const key = file.slice(0, -4);
  let paths: string[];
  if (key === "pages") {
    paths = ["/", "/read", "/derash", "/lashon", "/roadmap", "/api", "/translations", ...PROFILES.map((p) => `/translations/${p.code}`)];
  } else if (key === "toledot") {
    paths = await toledotSitemapPaths();
    if (paths.length === 0) return new Response("Not found", { status: 404 });
  } else if (key === "concordance") {
    paths = getConcordanceDiscoveryKeys().map((key) => `/lashon/${encodeURIComponent(key)}?t=WEB`);
  } else if (key === "references" || key === "comparisons") {
    const rows = getCanonicalDiscoveryRows();
    const references = new Set(rows.flatMap((row) => [`${row.book}.${row.chapter}`, row.reference]));
    paths = [...references].map((reference) => key === "references"
      ? `/deep-dive/${reference}?t=WEB`
      : `/parallel/${reference}?a=WEB&b=BSB`);
  } else {
    const translation = getTranslationByCode(key);
    if (!translation || translation.code !== key) return new Response("Not found", { status: 404 });
    const rows = getEditionDiscoveryRows(translation.translationId);
    const references = new Set(rows.flatMap((row) => [row.book, `${row.book}.${row.chapter}`, row.reference]));
    paths = [...references].map((reference) => `/read/${reference}?t=${translation.code}`);
  }
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) =>
    `<url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`
  ).join("")}</urlset>`);
}
