import { describe, expect, it } from "vitest";

import { CARD_VERSION, cardVersion, excerpt, pageMetadata, shareImagePath, shareTitle } from "./seo";

describe("excerpt", () => {
  it("leaves short text alone, normalising whitespace", () => {
    expect(excerpt("  In the beginning\n God  ", 40)).toBe("In the beginning God");
  });

  it("cuts on a word boundary and marks the cut", () => {
    const out = excerpt("For God so loved the world, that he gave his one and only Son", 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out).toBe("For God so loved the world…");
  });

  it("never leaves trailing punctuation before the ellipsis", () => {
    expect(excerpt("The LORD is my shepherd; I shall not want.", 25)).toBe("The LORD is my shepherd…");
  });
});

describe("shareTitle", () => {
  it("drops the tab suffix that unfurlers already print as the site name", () => {
    expect(shareTitle("John 3:16 WEB — Bible text & cross-references · Jot")).toBe(
      "John 3:16 WEB — Bible text & cross-references"
    );
    expect(shareTitle("Jot roadmap and research coverage")).toBe("Jot roadmap and research coverage");
  });
});

describe("shareImagePath", () => {
  it("names what to draw, never the words to draw, and carries the version", () => {
    expect(shareImagePath({ kind: "passage", ref: "John.3.16", t: "KJV" }, "1.abc")).toBe(
      "/og?kind=passage&ref=John.3.16&t=KJV&v=1.abc"
    );
  });

  it("versions by card design and corpus build together", () => {
    expect(cardVersion("5992638148e48294")).toBe(`${CARD_VERSION}.5992638148e4`);
  });
});

describe("pageMetadata", () => {
  // Next merges metadata shallowly: a page's `openGraph` replaces the layout's wholesale, so a
  // page whose object lacked `images` would unfurl as a bare link. Every call must carry one.
  it("always returns a full card for both Open Graph and Twitter", () => {
    const meta = pageMetadata("Notes & highlights · Jot", "Your notes.", "/notes", { buildId: "b" });
    const og = meta.openGraph as { images: { url: string; width: number; height: number }[]; title: string };
    expect(og.title).toBe("Notes & highlights");
    expect(og.images[0]).toMatchObject({ url: `/og?kind=page&page=home&v=${CARD_VERSION}.b`, width: 1200, height: 630 });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect((meta.twitter as { images: unknown[] }).images).toHaveLength(1);
  });
});
