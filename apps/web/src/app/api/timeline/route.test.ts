// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cache", () => ({ timelineNotModified: () => null, timelineCacheHeaders: () => ({}) }));
vi.mock("@/lib/db/corpus", () => ({ getBookIndex: () => ({ get: () => undefined }) }));

const spy = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("@/lib/db/timeline", () => {
  const ev = (id: string, axis: string) => ({
    id, title: id, axis, category: "political", confidence: "firm", status: "draft",
    summary: "s", earliest: -600, latest: -500, bookIds: axis === "composition" ? [27] : [],
  });
  return {
    getTimelineWindow: (q: { axis?: string }) => {
      spy.calls.push(q);
      const all = [ev("n1", "narrative"), ev("c1", "composition"), ev("k1", "canon")];
      return { available: true, events: all.filter((e) => !q.axis || e.axis === q.axis), eras: [] };
    },
  };
});

async function get(qs: string) {
  const { GET } = await import("@/app/api/timeline/route");
  const req = Object.assign(new Request(`http://localhost/api/timeline${qs}`), {
    nextUrl: new URL(`http://localhost/api/timeline${qs}`),
  });
  return GET(req as never);
}

beforeEach(() => { spy.calls.length = 0; });

describe("GET /api/timeline", () => {
  it("returns exactly three tracks and no flat events list", async () => {
    const res = await get("?from=-700&to=-400");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.tracks).sort()).toEqual(["canon", "composition", "narrative"]);
    for (const k of ["canon", "composition", "narrative"]) expect(Array.isArray(body.tracks[k])).toBe(true);
    expect(body).not.toHaveProperty("events");
    expect(body.tracks.narrative).toHaveLength(1);
    expect(body.tracks.composition).toHaveLength(1);
    expect(body.tracks.canon).toHaveLength(1);
  });

  it("fills only the requested axis", async () => {
    const body = await (await get("?axis=composition")).json();
    expect(Object.keys(body.tracks).sort()).toEqual(["canon", "composition", "narrative"]);
    expect(body.tracks.composition).toHaveLength(1);
    expect(body.tracks.narrative).toEqual([]);
    expect(body.tracks.canon).toEqual([]);
  });

  it("rejects bad parameters with 400", async () => {
    expect((await get("?axis=bogus")).status).toBe(400);
    expect((await get("?from=0")).status).toBe(400);
    expect((await get("?from=-500&to=-600")).status).toBe(400);
  });
});
