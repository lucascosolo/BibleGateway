// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookIndex } from "@/lib/refs/book-index";

const state = vi.hoisted(() => ({
  chapterCount: 21,
  existing: [43_005_001, 43_005_002] as number[],
  audio: { editions: [], chapters: [{ bookId: 43, chapter: 5, byEdition: {} }] } as unknown,
  notModified: null as Response | null,
  translations: ["WEB", "KJV"],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/cache", () => ({
  audioNotModified: () => state.notModified,
  audioCacheHeaders: () => ({ "Cache-Control": "public, max-age=60" }),
}));
vi.mock("@/lib/db/corpus", async () => {
  const { BookIndex: Index } = await import("@/lib/refs/book-index");
  const books = new Index([
    { bookId: 43, osisId: "John", name: "John", abbreviation: "Jn", testament: "NT", chapterCount: 21 },
  ]);
  return {
    getBookIndex: () => books,
    getTranslationByCode: (code: string) =>
      state.translations.includes(code) ? { translationId: 1, code } : undefined,
    getExistingVerseIds: () => state.existing,
    getChapterCount: () => state.chapterCount,
  };
});
vi.mock("@/lib/db/audio", () => ({ getPassageAudio: () => state.audio }));

async function get(qs: string) {
  const { GET } = await import("@/app/api/audio/passage/route");
  const req = Object.assign(new Request(`http://localhost/api/audio/passage${qs}`), {
    nextUrl: new URL(`http://localhost/api/audio/passage${qs}`),
  });
  return GET(req as never);
}

beforeEach(() => {
  state.chapterCount = 21;
  state.existing = [43_005_001, 43_005_002];
  state.audio = { editions: [], chapters: [{ bookId: 43, chapter: 5, byEdition: {} }] };
  state.notModified = null;
});

describe("GET /api/audio/passage", () => {
  it("returns exactly the ReaderPassage shape, with no text", async () => {
    const res = await get("?ref=John.5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      slug: "John.5",
      label: "John 5",
      bookName: "John",
      translationCode: "WEB",
      renderedVerseIds: [43_005_001, 43_005_002],
      nextHref: "/read/John.6?t=WEB",
      audio: state.audio,
    });
    expect(body).not.toHaveProperty("verses");
    expect(body).not.toHaveProperty("text");
  });

  it("has no nextHref at the last chapter of the book", async () => {
    const body = await (await get("?ref=John.21")).json();
    expect(body.nextHref).toBeNull();
  });

  it("carries the translation into nextHref", async () => {
    const body = await (await get("?ref=John.5&t=KJV")).json();
    expect(body.translationCode).toBe("KJV");
    expect(body.nextHref).toBe("/read/John.6?t=KJV");
  });

  it("400s without ref", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("400s on an unparseable reference", async () => {
    expect((await get("?ref=Nonsuchbook+3")).status).toBe(400);
  });

  it("404s on an unknown translation", async () => {
    expect((await get("?ref=John.5&t=XXX")).status).toBe(404);
  });

  it("404s when the range addresses no real verses", async () => {
    state.existing = [];
    expect((await get("?ref=John.5")).status).toBe(404);
  });

  it.each([["null", null], ["zero chapters", { editions: [], chapters: [] }]])(
    "404s with an error when there is no audio (%s)",
    async (_n, audio) => {
      state.audio = audio;
      const res = await get("?ref=John.5");
      expect(res.status).toBe(404);
      expect(await res.json()).toHaveProperty("error");
    },
  );

  it("returns the 304 from audioNotModified as-is", async () => {
    state.notModified = new Response(null, { status: 304 });
    const res = await get("?ref=John.5");
    expect(res).toBe(state.notModified);
  });
});

void BookIndex;
