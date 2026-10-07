import type { NextRequest } from "next/server";

import { timelineNotModified } from "@/lib/db/cache";
import { getPersons } from "@/lib/db/timeline";
import { withDisplay } from "@/lib/timeline/years";

import { json } from "../shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/timeline/persons
 *
 * Every person the timeline covers, with the strength of the evidence outside the Bible that
 * they existed: `corroborates` (a source names them), `partially-corroborates` (named, but the
 * reading or identification is disputed), `consistent`, `silent`, or `none`. The grade is
 * derived from the cited attestations, never asserted; `hasTension` marks a source that
 * contradicts a biblical detail about them.
 */
export async function GET(request: NextRequest) {
  const unchanged = timelineNotModified(request);
  if (unchanged) return unchanged;

  return json(request, {
    persons: getPersons().map((person) => ({
      ...person,
      lived: person.lived ? withDisplay(person.lived) : null,
      href: `/api/timeline/persons/${person.id}`,
    })),
  });
}
