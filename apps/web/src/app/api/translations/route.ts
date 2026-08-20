import { NextResponse, type NextRequest } from "next/server";

import { corpusCacheHeaders, notModified } from "@/lib/db/cache";
import { getTranslations } from "@/lib/db/corpus";

// NOT `force-static` — see apps/web/src/app/api/passage/route.ts. This route takes no query
// params, but `notModified` reads a request header, and a statically rendered handler is
// evaluated once at build time with no request at all.
export const dynamic = "force-dynamic";

/**
 * GET /api/translations
 *
 * The list of licensed translations, for client components that need to offer a choice between
 * them but are not rendered from a server component that could pass them down.
 *
 * There is exactly one such caller today — the guided tour's setup screen, which is mounted
 * once in `<AppShell>` for every page in the app, including pages that never touch the corpus.
 * Threading the translation list through `<AppShell>` would have made every page in the product
 * query the database in order to render a dialog most visits never open.
 *
 * The licence and copyright text come along deliberately. A control that lets a reader pick a
 * default translation without saying what it is has hidden the one fact that decides whether
 * the choice is usable for the work they intend — see `lib/citation.ts` on the same point.
 */
export async function GET(request: NextRequest) {
  const unchanged = notModified(request);
  if (unchanged) return unchanged;

  // The corpus is an immutable build artifact, so this is cacheable against the build id in
  // exactly the way user data would not be.
  return NextResponse.json(
    { translations: getTranslations() },
    { headers: corpusCacheHeaders(request) },
  );
}
