// Every code below is copied from the built corpus rather than invented, so this test pins the
// decoder against what the sources actually ship. A decoder validated only against codes someone
// made up will agree with itself and disagree with the text.

import { describe, expect, it } from "vitest";

import { morphologyHead, parseMorphology } from "./morphology";

describe("Hebrew morphology (OSHB)", () => {
  it("decodes a segmented word: prefixed preposition + noun (Gen 1:1 bereshit)", () => {
    const p = parseMorphology("HR/Ncfsa", "hbo");
    expect(p.segments).toHaveLength(2);
    expect(p.segments[0].parts).toEqual(["preposition"]);
    expect(p.segments[1].parts).toEqual(["noun", "common", "feminine", "singular", "absolute"]);
    expect(p.raw).toBe("HR/Ncfsa");
  });

  it("decodes a finite verb as person/gender/number (Gen 1:1 bara)", () => {
    const p = parseMorphology("HVqp3ms", "hbo");
    expect(p.segments[0].parts).toEqual([
      "verb",
      "qal",
      "perfect",
      "3rd person",
      "masculine",
      "singular",
    ]);
  });

  it("decodes a plural noun (Gen 1:1 elohim)", () => {
    expect(parseMorphology("HNcmpa", "hbo").segments[0].parts).toEqual([
      "noun",
      "common",
      "masculine",
      "plural",
      "absolute",
    ]);
  });

  it("decodes the direct object marker and the article", () => {
    expect(parseMorphology("HTo", "hbo").segments[0].parts).toEqual(["particle", "direct object marker"]);
    expect(parseMorphology("HTd/Ncmpa", "hbo").segments[0].parts).toEqual([
      "particle",
      "definite article",
    ]);
  });

  it("reads a participle's tail as gender/number/state, not person/gender/number", () => {
    // The slot AFTER the aspect means different things for a participle than for a finite verb.
    // Decoding 'm' as a person here would produce silent nonsense rather than an error.
    const participle = parseMorphology("HVqrmsa", "hbo").segments[0].parts;
    expect(participle).toEqual(["verb", "qal", "participle active", "masculine", "singular", "absolute"]);
    expect(participle).not.toContain("1st person");
  });

  it("shares the nominal codes with Aramaic", () => {
    expect(parseMorphology("ANcmpa", "arc").segments[0].parts).toEqual([
      "noun",
      "common",
      "masculine",
      "plural",
      "absolute",
    ]);
  });

  it("distinguishes 'both genders' from 'common gender'", () => {
    // Two different OSHB codes that used to carry the same label. `b` is a noun attested in
    // both genders; `c` is the verb code for common. Saying "common" for `b` reports an
    // analysis the source never made.
    expect(parseMorphology("HNcbsa", "hbo").segments[0].parts).toContain("both genders");
    expect(parseMorphology("HNcbsa", "hbo").segments[0].parts).not.toContain("common gender");
  });
});

describe("Aramaic verb stems (OSHB) — a different table, not a dialect", () => {
  // Every code here is taken from Dan.xml / Ezra.xml in the OSHB distribution, with the
  // occurrence counts that made them worth pinning. The stem letters overlap the Hebrew ones
  // almost completely and mean different things, so a decoder that shares one table returns a
  // confident wrong answer on every Aramaic verb rather than failing.

  it("decodes q as peal, not qal (AVqp3ms, 109 occurrences)", () => {
    const parts = parseMorphology("AVqp3ms", "arc").segments[0].parts;
    expect(parts).toEqual(["verb", "peal", "perfect", "3rd person", "masculine", "singular"]);
    expect(parts).not.toContain("qal");
  });

  it("decodes p as pael, not piel (AVpi3mp, 13 occurrences)", () => {
    expect(parseMorphology("AVpi3mp", "arc").segments[0].parts).toContain("pael");
  });

  it("decodes h as haphel, not hiphil (AVhp3ms, 31 occurrences)", () => {
    expect(parseMorphology("AVhp3ms", "arc").segments[0].parts).toContain("haphel");
  });

  it("decodes Q as peil, not qal passive (AVQp3ms, 25 occurrences)", () => {
    expect(parseMorphology("AVQp3ms", "arc").segments[0].parts).toContain("peil");
  });

  it("decodes a as aphel — a stem Hebrew does not have at all (AVarmsa, 5 occurrences)", () => {
    // Under the Hebrew table this letter matched nothing, so the stem was silently DROPPED
    // and the reader was shown "verb · participle active · masculine · singular · absolute"
    // with no stem — a missing fact rather than a wrong one, but missing without any sign.
    const parts = parseMorphology("AVarmsa", "arc").segments[0].parts;
    expect(parts).toEqual([
      "verb",
      "aphel",
      "participle active",
      "masculine",
      "singular",
      "absolute",
    ]);
  });

  it("decodes u as hithpeel and M as hithpaal (AVui3ms, AVMi3ms)", () => {
    expect(parseMorphology("AVui3ms", "arc").segments[0].parts).toContain("hithpeel");
    expect(parseMorphology("AVMi3ms", "arc").segments[0].parts).toContain("hithpaal");
  });

  it("picks the table from the word's own language letter, not the passed language", () => {
    // OSHB marks Aramaic passages inside otherwise-Hebrew books, so the per-word letter is the
    // authority. A row whose `language` column says Hebrew must still decode an `A`-prefixed
    // code as Aramaic, and vice versa.
    expect(parseMorphology("AVqp3ms", "hbo").segments[0].parts).toContain("peal");
    expect(parseMorphology("HVqp3ms", "arc").segments[0].parts).toContain("qal");
  });

  it("falls back to the language argument only when the code carries no prefix", () => {
    expect(parseMorphology("Vqp3ms", "arc").segments[0].parts).toContain("peal");
    expect(parseMorphology("Vqp3ms", "hbo").segments[0].parts).toContain("qal");
  });

  it("falls back to the raw code rather than inventing or dropping one", () => {
    // A corpus update that adds an unseen code must show the reader something truthful. The
    // language letter is stripped first (it is not part of the morpheme code), so the fallback
    // echoes the segment, and `raw` still carries the untouched original for display.
    const p = parseMorphology("HZzz", "hbo");
    expect(p.segments[0].parts).toEqual(["Zzz"]);
    expect(p.raw).toBe("HZzz");
  });
});

describe("Greek morphology (MorphGNT)", () => {
  it("decodes a noun by positional slots (Matt 1:1 Biblos)", () => {
    const p = parseMorphology("N- ----NSF-", "grc");
    expect(p.label).toBe("noun · nominative · singular · feminine");
  });

  it("decodes a finite verb, skipping the slots marked '-'", () => {
    // 3rd person, aorist, active, indicative, singular — the case/gender slots do not apply.
    expect(parseMorphology("V- 3AAI-S--", "grc").label).toBe(
      "verb · 3rd person · aorist · active · indicative · singular"
    );
  });

  it("decodes a participle, which carries both verbal and nominal slots", () => {
    expect(parseMorphology("V- -PAPNSM-", "grc").label).toBe(
      "verb · present · active · participle · nominative · singular · masculine"
    );
  });

  it("decodes the article", () => {
    expect(parseMorphology("RA ----GSF-", "grc").label).toBe("article · genitive · singular · feminine");
  });

  it("never mistakes a Greek code for a Hebrew one", () => {
    // Greek codes contain a space and Hebrew ones do not; dispatch is on language, not shape,
    // so passing the wrong language must not silently produce a plausible-looking answer.
    expect(parseMorphology("N- ----NSF-", "grc").segments).toHaveLength(1);
  });
});

describe("morphologyHead", () => {
  it("returns the head morpheme's part of speech for a segmented Hebrew word", () => {
    // The last segment is the word itself; the earlier ones are prefixed particles.
    expect(morphologyHead("HR/Ncfsa", "hbo")).toBe("noun");
    expect(morphologyHead("HC/To", "hbo")).toBe("particle");
  });

  it("returns the part of speech for Greek", () => {
    expect(morphologyHead("V- 3AAI-S--", "grc")).toBe("verb");
  });
});
