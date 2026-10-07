import { getTranslations } from "@/lib/db/corpus";
import { getTimelineBuildId } from "@/lib/db/timeline";
import { SITE_URL, escapeXml, xmlResponse } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function GET() {
  const files = [
    "pages", "concordance", "references", "comparisons",
    ...(getTimelineBuildId() === null ? [] : ["toledot"]),
    ...getTranslations().map((edition) => edition.code),
  ];
  return xmlResponse(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files.map((file) =>
    `<sitemap><loc>${escapeXml(`${SITE_URL}/sitemaps/${file}.xml`)}</loc></sitemap>`
  ).join("")}</sitemapindex>`);
}
