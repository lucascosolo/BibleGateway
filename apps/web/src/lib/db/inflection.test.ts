import { describe, expect, it } from "vitest";

import { foldAccentualVariants, groupForms } from "./inflection";

/**
 * The bug these pin: `/lashon/H2617a` listed `חֶ֫סֶד noun · common · masculine · singular ·
 * absolute` six separate times (12×, 11×, 8×, 7×, 6×, 5×) because the group key was the
 * cantillated string. The page then claimed "38 more forms" over a denominator that counted
 * accents as morphology.
 *
 * The second half matters as much as the first: the fix must NOT reach for the already-indexed
 * `search_form`, which strips vowels too. Both directions are asserted here, because a fold
 * that merges too much produces a plausible-looking number that is quietly wrong, which is
 * harder to notice than the duplicate rows it replaced.
 */

// ḥesed. Escapes rather than literals, so the difference between these three is readable in
// the source instead of being invisible combining marks: ḥet + segol + samekh + segol + dalet,
// with ole (U+05AB) and atnah (U+0591) added. The vowels are identical in all three.
const HESED = "\u05D7\u05B6\u05E1\u05B6\u05D3";
const HESED_OLE = "\u05D7\u05B6\u05AB\u05E1\u05B6\u05D3";
const HESED_ATNAH = "\u05D7\u05B6\u05E1\u05B6\u05D3\u0591";

describe("foldAccentualVariants", () => {
  it("removes te'amim from Hebrew", () => {
    expect(foldAccentualVariants(HESED_ATNAH, "hbo")).toBe(HESED);
    expect(foldAccentualVariants(HESED_OLE, "hbo")).toBe(HESED);
  });

  it("keeps nikud, which is contrastive", () => {
    // dāḇār (absolute) and dəḇar (construct) share every consonant and differ only in vowels.
    // A fold that removed nikud would report them as one form.
    const absolute = "\u05D3\u05B8\u05D1\u05B8\u05E8"; // dāḇār
    const construct = "\u05D3\u05B0\u05D1\u05B7\u05E8"; // dəḇar
    expect(foldAccentualVariants(absolute, "hbo")).not.toBe(
      foldAccentualVariants(construct, "hbo"),
    );
  });

  it("leaves Greek untouched — its diacritics distinguish words", () => {
    expect(foldAccentualVariants("τίς", "grc")).toBe("τίς");
    expect(foldAccentualVariants("τίς", "grc")).not.toBe(foldAccentualVariants("τις", "grc"));
  });

  it("applies to Aramaic as well as Hebrew", () => {
    expect(foldAccentualVariants(HESED_ATNAH, "arc")).toBe(HESED);
  });
});

describe("groupForms", () => {
  const NOUN = "HNcmsa";

  it("collapses accentual variants of one parsing into one form", () => {
    const forms = groupForms(
      [
        { surface: HESED_ATNAH, morph: NOUN, count: 12 },
        { surface: HESED_OLE, morph: NOUN, count: 11 },
        { surface: HESED, morph: NOUN, count: 8 },
      ],
      "hbo",
    );
    expect(forms).toHaveLength(1);
    expect(forms[0].count).toBe(31);
    // The representative is the most frequent spelling, not whichever sorted first.
    expect(forms[0].surface).toBe(HESED_ATNAH);
    expect(forms[0].variants).toHaveLength(3);
  });

  it("keeps the accented spellings rather than discarding them", () => {
    const forms = groupForms(
      [
        { surface: HESED_OLE, morph: NOUN, count: 5 },
        { surface: HESED_ATNAH, morph: NOUN, count: 9 },
      ],
      "hbo",
    );
    expect(forms[0].variants.map((v) => v.surface)).toEqual([HESED_ATNAH, HESED_OLE]);
    expect(forms[0].variants.map((v) => v.count)).toEqual([9, 5]);
  });

  it("never merges across morphology, however alike the spelling", () => {
    const forms = groupForms(
      [
        { surface: HESED, morph: "HNcmsa", count: 4 },
        { surface: HESED, morph: "HNcmsc", count: 3 },
      ],
      "hbo",
    );
    expect(forms).toHaveLength(2);
  });

  it("orders by folded frequency, not by the largest single spelling", () => {
    const other = "\u05D7\u05B7\u05E1\u05B4\u05D9\u05D3";
    const forms = groupForms(
      [
        { surface: other, morph: NOUN, count: 20 },
        { surface: HESED_ATNAH, morph: NOUN, count: 12 },
        { surface: HESED_OLE, morph: NOUN, count: 11 },
      ],
      "hbo",
    );
    expect(forms.map((f) => f.count)).toEqual([23, 20]);
  });
});
