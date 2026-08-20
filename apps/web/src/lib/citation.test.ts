import { describe, expect, it } from "vitest";

import { bibtexKey, formatCitation, type CitationSubject } from "./citation";

// The KJV, because its licence line is the one that must not be paraphrased, and a range
// rather than a single verse, because a range is what a footnote usually cites.
const SUBJECT: CitationSubject = {
  reference: "Genesis 1:1–5",
  translationCode: "KJV",
  translationName: "King James Version",
  copyrightNotice:
    "Public Domain outside the United Kingdom; printing within the UK requires permission under royal letters patent.",
  url: "https://bible.lucascosolo.com/read/Gen.1.1-5?t=KJV",
  corpusBuild: "2205a38b636a12e9",
  accessed: new Date("2026-08-13T09:41:00Z"),
};

describe("formatCitation", () => {
  it("names the translation, the corpus build and the URL in every format", () => {
    // The build id is the whole reason this exists: two readings of the same URL are
    // distinguishable only by it, so no format may drop it for brevity.
    for (const format of ["plain", "sbl", "bibtex", "csl-json"] as const) {
      const out = formatCitation(SUBJECT, format);
      expect(out).toContain("2205a38b636a12e9");
      expect(out).toContain("King James Version");
      expect(out).toContain("https://bible.lucascosolo.com/read/Gen.1.1-5?t=KJV");
    }
  });

  it("carries the licence notice verbatim rather than summarising it", () => {
    // Several licences in this corpus require the notice to travel with the text, and the KJV's
    // is not the "public domain" a summary would flatten it to.
    expect(formatCitation(SUBJECT, "plain")).toContain("royal letters patent");
    expect(formatCitation(SUBJECT, "bibtex")).toContain("royal letters patent");
  });

  it("leaves the licence out of the SBL entry, which has no field for it", () => {
    // Not an oversight and not a licence problem: an SBLHS entry is a fixed shape, and a
    // paragraph of licence text pasted into it stops being an SBL citation. The notice travels
    // with the TEXT — it is printed under every passage in the reader — and the other two
    // formats carry it for anyone copying a citation on its own.
    expect(formatCitation(SUBJECT, "sbl")).not.toContain("royal letters patent");
  });

  it("dates in UTC, so the same citation does not differ by the reader's timezone", () => {
    // 23:30 UTC is already the next day in Sydney and still the previous one in Los Angeles.
    const late = { ...SUBJECT, accessed: new Date("2026-08-13T23:30:00Z") };
    expect(formatCitation(late, "plain")).toContain("Accessed 2026-08-13");
    expect(formatCitation(late, "bibtex")).toContain("urldate      = {2026-08-13}");
  });

  it("writes SBL's access date long-form, day first", () => {
    expect(formatCitation(SUBJECT, "sbl")).toContain("Accessed 13 August 2026");
  });

  it("emits a BibTeX entry whose braces balance", () => {
    const out = formatCitation(SUBJECT, "bibtex");
    const opens = (out.match(/(?<!\\)\{/g) ?? []).length;
    const closes = (out.match(/(?<!\\)\}/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(out.startsWith("@misc{")).toBe(true);
  });

  it("uses @misc, not @book — this is an electronic resource with no publisher", () => {
    expect(formatCitation(SUBJECT, "bibtex")).not.toContain("@book");
  });

  it("emits valid CSL-JSON with the corpus build and licence as machine-readable metadata", () => {
    const out = JSON.parse(formatCitation(SUBJECT, "csl-json")) as Record<string, unknown>;
    expect(out).toMatchObject({
      type: "webpage",
      title: "Genesis 1:1–5",
      URL: SUBJECT.url,
      publisher: "Jot",
    });
    expect(out.note).toContain(SUBJECT.corpusBuild);
    expect(out.rights).toBe(SUBJECT.copyrightNotice);
    expect(out.accessed).toEqual({ "date-parts": [[2026, 8, 13]] });
  });
});

describe("bibtexKey", () => {
  it("is stable for the same passage and translation", () => {
    expect(bibtexKey(SUBJECT)).toBe(bibtexKey({ ...SUBJECT, accessed: new Date("2030-01-01") }));
  });

  it("distinguishes two translations of the same passage", () => {
    expect(bibtexKey(SUBJECT)).not.toBe(bibtexKey({ ...SUBJECT, translationCode: "WEB" }));
  });

  it("distinguishes two passages in the same translation", () => {
    expect(bibtexKey(SUBJECT)).not.toBe(bibtexKey({ ...SUBJECT, reference: "Genesis 1:1–6" }));
  });

  it("contains only characters every BibTeX reader accepts", () => {
    // A Hebrew headword or an en-dash in a key breaks silently in some tools rather than
    // erroring, which is the worst failure mode available.
    const hebrew = bibtexKey({ ...SUBJECT, reference: "חֶסֶד — Genesis 1:1" });
    expect(hebrew).toMatch(/^[A-Za-z0-9]+$/);
  });
});
