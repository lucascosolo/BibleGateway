// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("better-sqlite3", () => ({
  default: function () { throw new Error("must not open a database that is absent"); },
}));
vi.mock("node:fs", () => ({ default: { existsSync: () => false }, existsSync: () => false }));
vi.mock("fs", () => ({ default: { existsSync: () => false }, existsSync: () => false }));

describe("timeline accessors with no timeline.db deployed", () => {
  it("return empty or null and never throw", async () => {
    const t = await import("./timeline");
    expect(t.getTimelineBuildId()).toBeNull();
    expect(t.getTimelineWindow({ from: -1000, to: 100 })).toMatchObject({ available: false, events: [], eras: [] });
    expect(t.getEvent("x")).toBeNull();
    expect(t.getArtifact("x")).toBeNull();
    expect(t.getIssue("x")).toBeNull();
    expect(t.getTimelineForRange({ start: 1_001_001 as never, end: 1_001_002 as never }))
      .toMatchObject({ events: [], issues: [], artifacts: [] });
  });
});
