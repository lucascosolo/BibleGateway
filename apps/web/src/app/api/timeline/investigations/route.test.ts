// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cache", () => ({ timelineNotModified: () => null, timelineCacheHeaders: () => ({}) }));

const summary = {
  id: "deut-32-8-9", title: "T", status: "claims-checked", gist: "g",
  start: 5032008, end: 5032009, witnessCount: 3, differenceCount: 2,
};
vi.mock("@/lib/db/timeline", () => ({
  getInvestigationSummaries: () => [summary],
  getInvestigation: (id: string) =>
    id === "deut-32-8-9"
      ? {
          ...summary, summary: "full",
          witnesses: [{ id: "w1", siglum: "MT", name: "Masoretic", reading: "x", translation: "y", language: "hbo", note: null, citations: [] }],
          editions: [{ code: "KJV", follows: "MT" }],
          differences: [{ id: "d1", kind: "textual", text: "t", heldBy: "Tov", citations: [] }],
          challenges: [{ id: "c1", text: "c", citations: [] }],
        }
      : null,
}));
vi.mock("@/lib/db/timeline-present", () => ({
  labelVerses: (links: object[]) => links.map((l) => ({ ...l, label: "Deut 32:8-9", path: "/read/Deut.32.8-9" })),
}));

const req = (path: string) =>
  Object.assign(new Request(`http://localhost${path}`), { nextUrl: new URL(`http://localhost${path}`) });
const passage = { start: 5032008, end: 5032009, label: "Deut 32:8-9", path: "/read/Deut.32.8-9" };

describe("GET /api/timeline/investigations", () => {
  it("lists summaries with href and a labelled passage", async () => {
    const { GET } = await import("@/app/api/timeline/investigations/route");
    const res = await GET(req("/api/timeline/investigations") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.investigations).toHaveLength(1);
    expect(body.investigations[0]).toMatchObject({
      ...summary, href: "/api/timeline/investigations/deut-32-8-9", passage,
    });
  });
});

describe("GET /api/timeline/investigations/[id]", () => {
  const detail = async (id: string) => {
    const { GET } = await import("@/app/api/timeline/investigations/[id]/route");
    return GET(req(`/api/timeline/investigations/${id}`) as never, { params: Promise.resolve({ id }) });
  };

  it("returns the full investigation", async () => {
    const res = await detail("deut-32-8-9");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: "deut-32-8-9", summary: "full", passage,
      href: "/api/timeline/investigations/deut-32-8-9",
      page: "/toledot/investigations/deut-32-8-9",
    });
    expect(body.witnesses[0]).toMatchObject({ id: "w1", siglum: "MT" });
    expect(body.editions[0]).toMatchObject({ code: "KJV", follows: "MT" });
    expect(body.differences[0]).toMatchObject({ kind: "textual", heldBy: "Tov" });
    expect(body.challenges[0]).toMatchObject({ id: "c1" });
  });

  it("404s an unknown id", async () => {
    const res = await detail("nope");
    expect(res.status).toBe(404);
    expect(typeof (await res.json()).error).toBe("string");
  });
});
