// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cache", () => ({ timelineNotModified: () => null, timelineCacheHeaders: () => ({}) }));
vi.mock("@/lib/db/corpus", () => ({
  getOutsideBookIndex: () => ({ get: (id: number) => (id === 101 ? { osisId: "GThom", name: "Gospel of Thomas" } : undefined) }),
}));

const base = {
  status: "draft", bookIds: [101], composedEarliest: 140, composedLatest: 200, composedUndated: null,
  traditionalEarliest: null, traditionalLatest: null,
};
const summaries = [
  { ...base, id: "gospel-of-thomas", title: "Gospel of Thomas", canon: "nt-apocrypha" },
  { ...base, id: "judith", title: "Judith", canon: "deuterocanon", bookIds: [], composedEarliest: null, composedLatest: null,
    composedUndated: "Not dated by any source filed here." },
];
vi.mock("@/lib/db/timeline", () => ({
  getWorkSummaries: () => summaries,
  getWork: (id: string) =>
    id === "judith"
      ? { ...summaries[1], alsoKnownAs: [], summary: "S", contents: null, originalLanguage: "Greek", citations: [], composed: [],
          provenance: [], witnesses: [], heldCanonicalBy: [{ id: "h", tradition: "Catholic", note: null, citations: [] }],
          translations: [], excerpts: [], events: [], verses: [] }
      : id === "gospel-of-thomas"
        ? { ...summaries[0], alsoKnownAs: [], summary: "S", contents: null, originalLanguage: "Coptic", citations: [],
            composed: [{ id: "p", label: "Mid second century", tradition: "critical", earliest: 140, latest: 200, summary: "", heldBy: null, citations: [] }],
            provenance: [], witnesses: [], heldCanonicalBy: [], translations: [], excerpts: [], events: [],
            verses: [] }
        : null,
}));

const req = (path: string) =>
  Object.assign(new Request(`http://localhost${path}`), { nextUrl: new URL(`http://localhost${path}`) });

describe("GET /api/timeline/works", () => {
  it("lists works with links, books, and no range for an undated work", async () => {
    const { GET } = await import("@/app/api/timeline/works/route");
    const res = await GET(req("/api/timeline/works") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.works[0]).toMatchObject({
      id: "gospel-of-thomas", canon: "nt-apocrypha", href: "/api/timeline/works/gospel-of-thomas",
      page: "/chitzonim/works/gospel-of-thomas", composed: { earliest: 140, latest: 200 },
      books: [{ bookId: 101, osisId: "GThom", name: "Gospel of Thomas" }],
    });
    expect(body.works[1].composed).toBeNull();
    expect(body.works[1].composedUndated).toBe("Not dated by any source filed here.");
  });

  it("filters by canon and rejects an unknown one", async () => {
    const { GET } = await import("@/app/api/timeline/works/route");
    const filtered = await (await GET(req("/api/timeline/works?canon=deuterocanon") as never)).json();
    expect(filtered.works.map((w: { id: string }) => w.id)).toEqual(["judith"]);
    expect((await GET(req("/api/timeline/works?canon=bogus") as never)).status).toBe(400);
  });
});

describe("GET /api/timeline/works/[id]", () => {
  const call = async (id: string) => {
    const { GET } = await import("@/app/api/timeline/works/[id]/route");
    return GET(req(`/api/timeline/works/${id}`) as never, { params: Promise.resolve({ id }) });
  };

  it("returns 404 for an unknown work", async () => {
    const res = await call("nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty("error");
  });

  it("returns the full record with positions and page link", async () => {
    const body = await (await call("gospel-of-thomas")).json();
    expect(body).toMatchObject({ id: "gospel-of-thomas", page: "/chitzonim/works/gospel-of-thomas", originalLanguage: "Coptic" });
    expect(body.positions[0]).toMatchObject({ earliest: 140, latest: 200, display: expect.any(String) });
  });

  it("never fabricates a range for an undated work", async () => {
    const body = await (await call("judith")).json();
    expect(body.composed).toBeNull();
    expect(body.composedUndated).toBe("Not dated by any source filed here.");
    expect(body.positions).toEqual([]);
    expect(body.heldCanonicalBy[0].tradition).toBe("Catholic");
  });
});
