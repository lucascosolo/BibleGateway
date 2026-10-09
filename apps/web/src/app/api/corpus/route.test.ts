// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cache", () => ({ audioNotModified: () => null, audioCacheHeaders: () => ({}) }));
vi.mock("@/lib/db/audio", () => ({ hasAudio: () => false, getAudioBuildId: () => "a" }));
vi.mock("@/lib/db/client", () => ({ getCorpusBuildId: () => "b", getCorpusSources: () => [] }));
vi.mock("@/lib/db/corpus", () => ({
  getCanonicalVerseCount: () => 31102,
  getOutsideVerseCounts: () => [{ canon: "deuterocanon", books: 2, verses: 30 }, { canon: "nt-apocrypha", books: 1, verses: 115 }],
}));
vi.mock("@/lib/db/outside", () => ({
  getOutsideBooks: () => [
    { bookId: 67, osisId: "Tob", name: "Tobit", canon: "deuterocanon", numbering: "chapter-verse", verses: 20, translations: ["KJVA"] },
    { bookId: 71, osisId: "Sir", name: "Sirach", canon: "deuterocanon", numbering: "chapter-verse", verses: 10, translations: ["KJVA"] },
    { bookId: 101, osisId: "GThom", name: "Gospel of Thomas", canon: "nt-apocrypha", numbering: "logion", verses: 115, translations: ["MATTISON"] },
  ],
}));

describe("GET /api/corpus", () => {
  it("reports the canonical count and outside counts by canon, kept apart", async () => {
    const { GET } = await import("@/app/api/corpus/route");
    const req = Object.assign(new Request("http://localhost/api/corpus"), { nextUrl: new URL("http://localhost/api/corpus") });
    const body = await (await GET(req as never)).json();
    expect(body.canonicalVerseCount).toBe(31102);
    expect(body.outside.canons.map((c: { canon: string }) => c.canon)).toEqual(["deuterocanon", "nt-apocrypha"]);
    expect(body.outside.canons[0]).toMatchObject({ books: 2, verses: 30 });
    expect(body.outside.canons[0].bookList.map((b: { osisId: string }) => b.osisId)).toEqual(["Tob", "Sir"]);
    expect(body.outside.canons[1].bookList[0]).toMatchObject({ numbering: "logion", translations: ["MATTISON"] });
  });
});
