import { beforeEach, describe, expect, it, vi } from "vitest";

const timeline = vi.hoisted(() => ({
  getTimelineBuildId: vi.fn(),
  getPersons: vi.fn(),
  listEventIds: vi.fn(),
  listArtifactIds: vi.fn(),
  listIssueIds: vi.fn(),
}));
vi.mock("@/lib/db/timeline", () => timeline);

import { toledotSitemapPaths } from "@/app/toledot/sitemap";

beforeEach(() => {
  timeline.getTimelineBuildId.mockReturnValue("abc123");
  timeline.getPersons.mockReturnValue([{ id: "hezekiah" }, { id: "belshazzar" }]);
  timeline.listEventIds.mockReturnValue(["exodus", "fall-of-samaria"]);
  timeline.listArtifactIds.mockReturnValue(["taylor-prism"]);
  timeline.listIssueIds.mockReturnValue(["long-chronology"]);
});

describe("toledotSitemapPaths", () => {
  it("lists the index and one path per entity id", async () => {
    const paths = await toledotSitemapPaths();
    expect(paths).toEqual(
      expect.arrayContaining([
        "/toledot",
        "/toledot/events/exodus",
        "/toledot/events/fall-of-samaria",
        "/toledot/people/hezekiah",
        "/toledot/people/belshazzar",
        "/toledot/artifacts/taylor-prism",
        "/toledot/issues/long-chronology",
      ]),
    );
    expect(paths).toHaveLength(7);
  });

  it("returns nothing when no timeline is deployed", async () => {
    timeline.getTimelineBuildId.mockReturnValue(null);
    expect(await toledotSitemapPaths()).toEqual([]);
  });
});
