import { getPersons, getTimelineBuildId, listArtifactIds, listEventIds, listIssueIds } from "@/lib/db/timeline";

/**
 * Every Toledot page a crawler should know about, or nothing when no timeline is deployed.
 *
 * A folder rather than `toledot/sitemap.ts`: that filename is Next's metadata-route convention
 * and would publish a second, competing `/toledot/sitemap.xml`.
 */
export async function toledotSitemapPaths(): Promise<string[]> {
  if (getTimelineBuildId() === null) return [];
  return [
    "/toledot",
    "/toledot/events",
    "/toledot/people",
    "/toledot/issues",
    ...listEventIds().map((id) => `/toledot/events/${id}`),
    ...getPersons().map((person) => `/toledot/people/${person.id}`),
    ...listArtifactIds().map((id) => `/toledot/artifacts/${id}`),
    ...listIssueIds().map((id) => `/toledot/issues/${id}`),
  ];
}
