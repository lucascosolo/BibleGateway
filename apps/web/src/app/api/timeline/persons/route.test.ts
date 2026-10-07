// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cache", () => ({ timelineNotModified: () => null, timelineCacheHeaders: () => ({}) }));
vi.mock("@/lib/db/corpus", () => ({ getBookIndex: () => ({ get: () => undefined }) }));

const person = {
  id: "per-b", name: "Beta", role: "king of Judah", evidence: "corroborates", hasTension: true,
  status: "draft", lived: { earliest: -700, latest: -650 },
};
vi.mock("@/lib/db/timeline", () => ({
  getPersons: () => [person, { ...person, id: "per-c", name: "Gamma", evidence: "none", hasTension: false, lived: null }],
  getPerson: (id: string) =>
    id === "per-b"
      ? {
          ...person, alsoKnownAs: ["Bee"], summary: "Beta sum", citations: [{ sourceId: "src-a", title: "Book A", locator: "p. 3" }],
          attestations: [{
            id: "per-b@art-stele", artifactId: "art-stele", artifactName: "Merneptah Stele",
            artifactKind: "inscription", relation: "corroborates", note: "Named.", citations: [],
          }],
          verses: [], eventIds: [], issueIds: [],
        }
      : null,
  getIssueSummaries: () => [],
  getEventSummaries: () => [],
  getTimelineBuildId: () => "x",
}));

const req = (path: string) =>
  Object.assign(new Request(`http://localhost${path}`), { nextUrl: new URL(`http://localhost${path}`) });

describe("GET /api/timeline/persons", () => {
  it("lists people with evidence and a display string for lived", async () => {
    const { GET } = await import("@/app/api/timeline/persons/route");
    const res = await GET(req("/api/timeline/persons") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persons).toHaveLength(2);
    expect(body.persons[0]).toMatchObject({
      id: "per-b", name: "Beta", role: "king of Judah", evidence: "corroborates", hasTension: true, status: "draft",
      lived: { earliest: -700, latest: -650, display: "700–650 BCE" },
    });
    expect(body.persons[1].lived).toBeNull();
  });
});

describe("GET /api/timeline/persons/[id]", () => {
  it("returns 404 for an unknown person", async () => {
    const { GET } = await import("@/app/api/timeline/persons/[id]/route");
    const res = await GET(req("/api/timeline/persons/nope") as never, { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty("error");
  });

  it("returns the full person", async () => {
    const { GET } = await import("@/app/api/timeline/persons/[id]/route");
    const res = await GET(req("/api/timeline/persons/per-b") as never, { params: Promise.resolve({ id: "per-b" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: "per-b", name: "Beta", alsoKnownAs: ["Bee"], evidence: "corroborates", hasTension: true,
      lived: { display: "700–650 BCE" },
    });
    expect(body.attestations[0]).toMatchObject({ id: "per-b@art-stele", artifactName: "Merneptah Stele", relation: "corroborates" });
    expect(body.citations[0]).toMatchObject({ title: "Book A", locator: "p. 3" });
  });
});
