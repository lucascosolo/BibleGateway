import { describe, expect, it } from "vitest";

import {
  checkAnnotationAnchor,
  parseAnnotationInput,
  parseAnnotationPatch,
  type AnchorLookup,
} from "./validate";

/**
 * The write path's only guard against a phantom address.
 *
 * An annotation that persists against a verse that does not exist is invisible forever: no
 * view queries a range containing it, so it can never be rendered, edited or deleted, and it
 * still counts. The old check — `Number.isFinite` on two fields — accepted every case below.
 *
 * Both phases are pure by construction (the corpus arrives as a lookup object), so none of
 * this needs a database, a network or a build.
 */

const JOHN_3_16 = 43003016;
const JOHN_3_17 = 43003017;
/** Encodes cleanly. Genesis 1 has 31 verses, so it is not a verse. */
const PHANTOM = 1001032;

const valid = {
  kind: "highlight",
  startVerseId: JOHN_3_16,
  endVerseId: JOHN_3_16,
  startOffset: 4,
  endOffset: 7,
  translationId: 1,
  quotedText: "God",
  color: "amber",
};

const lookup: AnchorLookup = {
  existingVerseIds: new Set([JOHN_3_16, JOHN_3_17]),
  textLength: (verseId) => (verseId === JOHN_3_16 ? 26 : verseId === JOHN_3_17 ? 40 : undefined),
  translationIds: new Set([1, 2]),
};

/** The error message, or "" when the input was accepted. */
function reject(body: unknown): string {
  const parsed = parseAnnotationInput(body);
  if (!parsed.ok) return parsed.error;
  const checked = checkAnnotationAnchor(parsed.value, lookup);
  return checked.ok ? "" : checked.error;
}

describe("parseAnnotationInput", () => {
  it("accepts a well-formed sub-verse highlight", () => {
    const parsed = parseAnnotationInput(valid);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toMatchObject({ startVerseId: JOHN_3_16, startOffset: 4, endOffset: 7 });
      expect(parsed.value.tags).toEqual([]);
    }
  });

  it("rejects a non-object body", () => {
    expect(reject(null)).toMatch(/JSON object/);
    expect(reject([valid])).toMatch(/JSON object/);
    expect(reject("highlight")).toMatch(/JSON object/);
  });

  it("rejects an unknown kind", () => {
    expect(reject({ ...valid, kind: "underline" })).toMatch(/kind/);
    expect(reject({ ...valid, kind: undefined })).toMatch(/kind/);
  });

  it("rejects a non-integer verse id", () => {
    // `Number.isFinite(43003016.5)` is true, which is exactly how this got through before.
    expect(reject({ ...valid, startVerseId: 43003016.5 })).toMatch(/integer/);
    expect(reject({ ...valid, endVerseId: "43003016" })).toMatch(/integer/);
    expect(reject({ ...valid, startVerseId: Number.NaN })).toMatch(/integer/);
  });

  it("rejects an id that cannot encode a verse", () => {
    expect(reject({ ...valid, startVerseId: -1, endVerseId: -1 })).toMatch(/integer|valid verse/);
    // Verse 0 and chapter 0 are outside the encoding, whatever the book.
    expect(reject({ ...valid, startVerseId: 43003000, endVerseId: 43003000 })).toMatch(
      /valid verse id/
    );
    expect(reject({ ...valid, startVerseId: 43000016, endVerseId: 43000016 })).toMatch(
      /valid verse id/
    );
  });

  it("rejects reversed endpoints rather than swapping them", () => {
    // Swapping would store an anchor the user never made and hide the caller's bug.
    expect(reject({ ...valid, startVerseId: JOHN_3_17, endVerseId: JOHN_3_16 })).toMatch(
      /endVerseId/
    );
  });

  it("rejects a half-supplied offset pair", () => {
    expect(reject({ ...valid, endOffset: null })).toMatch(/together/);
    expect(reject({ ...valid, startOffset: null })).toMatch(/together/);
  });

  it("rejects a negative or non-integer offset", () => {
    expect(reject({ ...valid, startOffset: -3 })).toMatch(/negative/);
    expect(reject({ ...valid, endOffset: 7.5 })).toMatch(/integer/);
  });

  it("rejects an empty or reversed range within one verse", () => {
    expect(reject({ ...valid, startOffset: 7, endOffset: 7 })).toMatch(/endOffset/);
    expect(reject({ ...valid, startOffset: 7, endOffset: 4 })).toMatch(/endOffset/);
  });

  it("allows the end offset to precede the start offset across two verses", () => {
    // They index different strings there, so ordering between them means nothing.
    expect(
      reject({ ...valid, endVerseId: JOHN_3_17, startOffset: 20, endOffset: 4 })
    ).toBe("");
  });

  it("requires a translation when offsets are supplied", () => {
    // Offsets are only valid within a translation; stored without one, nothing can decide
    // later whether they still apply.
    expect(reject({ ...valid, translationId: null })).toMatch(/translationId/);
  });

  it("accepts a whole-verse anchor with no translation", () => {
    expect(
      reject({ kind: "bookmark", startVerseId: JOHN_3_16, endVerseId: JOHN_3_16 })
    ).toBe("");
  });

  it("rejects a colour that is not a token name", () => {
    expect(reject({ ...valid, color: "#ff0000" })).toMatch(/color/);
    expect(reject({ ...valid, color: "Amber" })).toMatch(/color/);
    expect(reject({ ...valid, color: 3 })).toMatch(/color/);
  });

  it("rejects an unbounded body", () => {
    expect(reject({ ...valid, kind: "note", body: "x".repeat(20_001) })).toMatch(/body/);
    expect(reject({ ...valid, kind: "note", body: "x".repeat(20_000) })).toBe("");
  });

  it("rejects malformed tags", () => {
    expect(reject({ ...valid, tags: "christology" })).toMatch(/tags/);
    expect(reject({ ...valid, tags: [""] })).toMatch(/tag/);
    expect(reject({ ...valid, tags: [1, 2] })).toMatch(/tag/);
  });
});

describe("checkAnnotationAnchor", () => {
  it("rejects an id that encodes cleanly but is not a verse", () => {
    // The whole reason existence is a separate phase: the id space is sparse.
    expect(reject({ ...valid, startVerseId: PHANTOM, endVerseId: PHANTOM })).toMatch(
      /not a verse in the canon/
    );
  });

  it("checks the end verse too, not only the start", () => {
    expect(reject({ ...valid, endVerseId: 43003999 })).toMatch(/endVerseId/);
  });

  it("rejects an unknown translation", () => {
    expect(reject({ ...valid, translationId: 99 })).toMatch(/unknown translation/);
  });

  it("rejects an offset past the end of the verse text", () => {
    expect(reject({ ...valid, startOffset: 26, endOffset: 30 })).toMatch(/startOffset/);
    expect(reject({ ...valid, startOffset: 4, endOffset: 27 })).toMatch(/endOffset/);
  });

  it("allows the exclusive end offset to equal the text length", () => {
    expect(reject({ ...valid, startOffset: 4, endOffset: 26 })).toBe("");
  });

  it("bounds each endpoint against its own verse", () => {
    // Verse 17 is longer than verse 16; the end offset must be measured against 17.
    expect(reject({ ...valid, endVerseId: JOHN_3_17, startOffset: 4, endOffset: 39 })).toBe("");
    expect(reject({ ...valid, endVerseId: JOHN_3_17, startOffset: 4, endOffset: 41 })).toMatch(
      /endOffset/
    );
  });

  it("rejects offsets against a verse this translation does not print", () => {
    // One of the twelve omissions: the verse is real, the text is not there to have been
    // selected from, and SQLite would have accepted the row without complaint.
    const omitted: AnchorLookup = { ...lookup, textLength: () => undefined };
    const parsed = parseAnnotationInput(valid);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const checked = checkAnnotationAnchor(parsed.value, omitted);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error).toMatch(/does not print/);
  });
});

describe("parseAnnotationPatch", () => {
  it("accepts a body edit", () => {
    const parsed = parseAnnotationPatch({ body: "Cf. the Johannine prologue." });
    expect(parsed).toEqual({ ok: true, value: { body: "Cf. the Johannine prologue." } });
  });

  it("distinguishes clearing a field from leaving it alone", () => {
    const cleared = parseAnnotationPatch({ body: null });
    expect(cleared.ok && "body" in cleared.value).toBe(true);
    const recoloured = parseAnnotationPatch({ color: "rose" });
    expect(recoloured.ok && "body" in recoloured.value).toBe(false);
  });

  it("rejects an empty patch", () => {
    const parsed = parseAnnotationPatch({});
    expect(parsed.ok).toBe(false);
  });

  it("will not move an anchor", () => {
    // The anchor is not patchable: changing it would strand the annotation in verse atoms it
    // no longer covers. Anchor-only payloads therefore read as an empty patch.
    const parsed = parseAnnotationPatch({ startVerseId: JOHN_3_17 });
    expect(parsed.ok).toBe(false);
  });

  it("applies the same payload rules as create", () => {
    expect(parseAnnotationPatch({ color: "#ff0000" }).ok).toBe(false);
    expect(parseAnnotationPatch({ body: "x".repeat(20_001) }).ok).toBe(false);
    expect(parseAnnotationPatch({ tags: [""] }).ok).toBe(false);
  });
});
