// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cache", () => ({ notModified: () => null, corpusCacheHeaders: () => ({}) }));

const tr = (translationId: number, code: string, name: string) => ({ translationId, code, name, copyrightNotice: "PD" });
vi.mock("@/lib/db/corpus", () => ({
  getTranslationByCode: (code: string) =>
    code === "KJV" ? tr(3, "KJV", "King James") : code === "WEB" ? tr(1, "WEB", "World English Bible") : undefined,
  getTranslations: () => [tr(3, "KJV", "King James"), tr(1, "WEB", "World English Bible")],
  getOutsideBookIndex: () => new Map(),
  getPassage: () => [
    { verseId: 43003016, chapter: 3, verse: 16, text: "a", heatBucket: 0 },
    { verseId: 43003017, chapter: 3, verse: 17, text: "b", heatBucket: 0 },
  ],
}));
vi.mock("@/lib/refs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/refs")>()),
  parseReference: () => ({ start: 43003016, end: 43003018 }),
  formatRange: () => "John 3:16-18",
}));
const getFootnotes = vi.fn(() => [
  { verseId: 43003016, noteOrder: 1, caller: "a", kind: "footnote", text: "Or, only begotten" },
]);
vi.mock("@/lib/db/apparatus", () => ({
  getOmissions: () =>
    new Map([[43003018, {
      verseId: 43003018, chapter: 3, verse: 18, kind: "critical-text", reason: "r", history: "h",
      printedBy: [{ code: "WEB", name: "W", translationId: 1 }],
    }]]),
  getFootnotes,
}));

const req = (qs: string) => {
  const url = `http://localhost/api/passage?${qs}`;
  return Object.assign(new Request(url), { nextUrl: new URL(url) }) as never;
};
const call = async (qs: string) => {
  const { GET } = await import("@/app/api/passage/route");
  const res = await GET(req(qs));
  return { res, body: await res.json() };
};

beforeEach(() => getFootnotes.mockClear());

describe("GET /api/passage", () => {
  it("omissions carry kind and printedBy is {code,name} only", async () => {
    const { body } = await call("ref=John+3:16-18&translation=KJV");
    expect(body.omissions[0].kind).toBe("critical-text");
    expect(body.omissions[0].printedBy).toEqual([{ code: "WEB", name: "W" }]);
  });

  it("omits footnotes and never queries them by default", async () => {
    const { body } = await call("ref=John+3:16-18&translation=KJV");
    expect(body).not.toHaveProperty("footnotes");
    expect(getFootnotes).not.toHaveBeenCalled();
  });

  it("footnotes=1 returns rows, queried by the returned verse ids and translationId", async () => {
    const { body } = await call("ref=John+3:16-18&translation=KJV&footnotes=1");
    expect(body.footnotes).toEqual([
      { verseId: 43003016, noteOrder: 1, caller: "a", kind: "footnote", text: "Or, only begotten" },
    ]);
    expect(getFootnotes).toHaveBeenCalledWith([43003016, 43003017], 3);
  });

  it("footnotes=0 omits the key", async () => {
    const { body } = await call("ref=John+3:16-18&translation=KJV&footnotes=0");
    expect(body).not.toHaveProperty("footnotes");
  });

  it("rejects any other footnotes value with 400", async () => {
    const { res, body } = await call("ref=John+3:16-18&translation=KJV&footnotes=yes");
    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("accepts t as an alias for translation", async () => {
    const { res, body } = await call("ref=John+3:16-18&t=KJV");
    expect(res.status).toBe(200);
    expect(body.translation.code).toBe("KJV");
  });

  it("translation wins over t", async () => {
    const { body } = await call("ref=John+3:16-18&translation=KJV&t=WEB");
    expect(body.translation.code).toBe("KJV");
  });

  it("unknown translation is 404 with available", async () => {
    const { res, body } = await call("ref=John+3:16-18&translation=NOPE");
    expect(res.status).toBe(404);
    expect(body).toHaveProperty("available");
  });
});
