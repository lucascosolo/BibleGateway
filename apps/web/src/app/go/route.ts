import { NextRequest, NextResponse } from "next/server";

import { getBookIndex } from "@/lib/db/corpus";
import { classifyQuery } from "@/lib/refs";

/**
 * The home page jump/search box lands here regardless of JavaScript.
 *
 * A plain `<form method="get" action="/go">` works with JS disabled because the browser does
 * the GET itself; when JS is available, `JumpSearch` shows a live preview of the same
 * classification first so the user sees the interpretation before committing, but the actual
 * navigation always goes through this one route — so there is exactly one place that decides
 * "reference or search," never two implementations that could disagree.
 *
 * Not `force-static`: reading a query param requires the dynamic request object.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const books = getBookIndex();
  const intent = classifyQuery(q, books);

  // Carry the active translation through the jump. Losing it here would be the one place in
  // the app where navigating silently changes which text you are reading — the whole reason
  // translation is a query param rather than a path segment.
  const t = params.get("t");
  // Behind Cloudflare Tunnel, `request.url` reports the internal `http://localhost:...` origin,
  // not the public host — building the redirect URL from it would send users to localhost.
  // These forwarded headers carry the origin the request actually arrived on.
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "bible.lucascosolo.com";
  const baseUrl = `${proto}://${host}`;
  const withTranslation = (path: string) => {
    const url = new URL(path, baseUrl);
    if (t) url.searchParams.set("t", t);
    return NextResponse.redirect(url);
  };

  if (intent.type === "reference") {
    return withTranslation(`/read/${intent.slug}`);
  }
  if (intent.type === "search") {
    return withTranslation(`/derash?q=${encodeURIComponent(intent.query)}`);
  }
  return withTranslation("/");
}
