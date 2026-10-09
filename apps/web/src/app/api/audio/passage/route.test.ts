// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookIndex } from "@/lib/refs/book-index";

const state = vi.hoisted(() => ({
  adjacent: { prev: 4, next: 6 } as { prev: number | null; next: number | null },
  existing: [43_005_001, 43_005_002] as number[],
  audio: { editions: [], chapters: [{ bookId: 43, chapter: 5, byEdition: {} }] } as unknown,
  notModified: null as Response | null,
  translations: ["WEB", "KJV", "KJVA"],
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
  const all = new Index([
    { bookId: 43, osisId: "John", name: "John", abbreviation: "Jn", testament: "NT", chapterCount: 21 },
    { bookId: 67, osisId: "Tob", name: "Tobit", abbreviation: "Tob", testament: "DC", chapterCount: 14, canon: "deuterocanon", numbering: "chapter-verse" },
    { bookId: 69, osisId: "AddEsth", name: "Additions to Esther", abbreviation: "AddEsth", testament: "DC", chapterCount: 7, lastChapter: 16, canon: "deuterocanon", numbering: "chapter-verse" },
  ]);
  return {
    getBookIndex: () => books,
    getOutsideBookIndex: () => all,
    getTranslationByCode: (code: string) =>
      state.translations.includes(code) ? { translationId: 1, code } : undefined,
    getExistingVerseIds: () => state.existing,
    getAdjacentChapters: () => state.adjacent,
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
  state.adjacent = { prev: 4, next: 6 };
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
    state.adjacent = { prev: 20, next: null };
    const body = await (await get("?ref=John.21")).json();
    expect(body.nextHref).toBeNull();
  });

  it("carries the translation into nextHref", async () => {
    const body = await (await get("?ref=John.5&t=KJV")).json();
    expect(body.translationCode).toBe("KJV");
    expect(body.nextHref).toBe("/read/John.6?t=KJV");
  });

  it("serves an outside book (Tobit) in an outside translation", async () => {
    state.existing = [67_001_001, 67_001_002];
    state.audio = { editions: [], chapters: [{ bookId: 67, chapter: 1, byEdition: {} }] };
    state.adjacent = { prev: null, next: 2 };
    const res = await get("?ref=Tob.1&t=KJVA");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("Tob.1");
    expect(body.translationCode).toBe("KJVA");
    expect(body.nextHref).toBe("/read/Tob.2?t=KJVA");
  });

  it("uses the next existing chapter even past the book's chapterCount (AddEsth 10 -> 11)", async () => {
    state.existing = [69_010_001];
    state.audio = { editions: [], chapters: [{ bookId: 69, chapter: 10, byEdition: {} }] };
    state.adjacent = { prev: null, next: 11 };
    const body = await (await get("?ref=AddEsth.10&t=KJVA")).json();
    expect(body.nextHref).toBe("/read/AddEsth.11?t=KJVA");
  });

  it("has no nextHref at the last existing chapter of an outside book (AddEsth 16)", async () => {
    state.existing = [69_016_001];
    state.audio = { editions: [], chapters: [{ bookId: 69, chapter: 16, byEdition: {} }] };
    state.adjacent = { prev: 15, next: null };
    const body = await (await get("?ref=AddEsth.16&t=KJVA")).json();
    expect(body.nextHref).toBeNull();
  });

  it("400s without ref", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });

  it("400s on an unparseable reference", async () => {
    expect((await get("?ref=Nonsuchbook+3")).status).toBe(400);
  });

  it("400s on a range that spans more than one chapter", async () => {
    expect((await get("?ref=John.5-John.6&t=WEB")).status).toBe(400);
    expect((await get("?ref=John&t=WEB")).status).toBe(400);
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
