// @vitest-environment jsdom
/**
 * Pins the qere/kethiv grouping against real corpus rows — never invented ones, per AGENTS.md's
 * standing rule about the WEB whitespace repair's own baseline: a plausible-looking fake value
 * is how a gate stops meaning anything.
 *
 * Two verses, two shapes:
 *  - Genesis 8:17 — one written word, one reading (the ordinary case).
 *  - Genesis 30:11 — one written word, two readings sharing a position (the case that makes
 *    grouping by `position` non-optional rather than a nicety).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { QereReadings } from "@/components/passage/QereReadings";
import type { OriginalVariant, OriginalWord } from "@/lib/db/originals";
import type { VerseId } from "@/lib/refs/verse-id";

afterEach(cleanup);

const GEN_8_17 = 1008017 as VerseId;
const GEN_30_11 = 1030011 as VerseId;

function word(overrides: Partial<OriginalWord>): OriginalWord {
  return {
    wordId: 1,
    textId: 1,
    verseId: GEN_8_17,
    sourceRef: "Gen.8.17",
    position: 1,
    surface: "",
    normalized: "",
    lemma: "",
    strongs: null,
    morph: "",
    language: "hbo",
    headword: null,
    xlit: null,
    gloss: null,
    ...overrides,
  };
}

function variant(overrides: Partial<OriginalVariant>): OriginalVariant {
  return {
    variantId: 1,
    textId: 1,
    verseId: GEN_8_17,
    sourceRef: "Gen.8.17",
    position: 1,
    kind: "qere",
    catchWord: null,
    surface: "",
    normalized: "",
    lemma: "",
    strongs: null,
    morph: "",
    language: "hbo",
    headword: null,
    xlit: null,
    gloss: null,
    ...overrides,
  };
}

describe("QereReadings", () => {
  it("returns null when there are no readings", () => {
    const { container } = render(<QereReadings variants={[]} words={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("falls back to the interlinear word when catchWord is null (Gen 8:17)", () => {
    const words: OriginalWord[] = [
      word({ wordId: 14, verseId: GEN_8_17, position: 14, surface: "הוצא" }),
    ];
    const variants: OriginalVariant[] = [
      variant({
        variantId: 501,
        verseId: GEN_8_17,
        position: 14,
        catchWord: null,
        surface: "הַיְצֵ֣א",
        lemma: "3318",
        strongs: "H3318",
        morph: "HVhv2ms",
        language: "hbo",
        headword: "יָצָא",
        gloss: "go out",
      }),
    ];

    render(<QereReadings variants={variants} words={words} />);

    // The written form, recovered from `words` because `catchWord` was null.
    expect(screen.getByText("הוצא")).not.toBeNull();
    // The reading itself.
    expect(screen.getByText("הַיְצֵ֣א")).not.toBeNull();
    // The anchor is disclosed in words, not as a bare index.
    expect(screen.getByText(/14th word of the Hebrew/)).not.toBeNull();
    // The link resolves to the reading's own Strong's number.
    // Plain DOM assertions throughout: this repo installs @testing-library/react but not
    // jest-dom, so `toBeInTheDocument` / `toHaveAttribute` are not registered matchers and fail
    // as "Invalid Chai property" rather than as a failed expectation.
    expect(screen.getByRole("link", { name: /הַיְצֵ֣א/ }).getAttribute("href")).toBe(
      `/lashon/${encodeURIComponent("H3318")}`,
    );
  });

  it("groups two readings under one written word rather than printing two ketiv rows (Gen 30:11)", () => {
    const words: OriginalWord[] = [
      word({ wordId: 3, verseId: GEN_30_11, position: 3, surface: "ב/גד" }),
    ];
    const variants: OriginalVariant[] = [
      variant({
        variantId: 601,
        verseId: GEN_30_11,
        position: 3,
        catchWord: "ב/גד",
        surface: "בָּ֣א",
        lemma: "935",
        strongs: "H935",
        morph: "HVqrmsa",
        language: "hbo",
        headword: "בּוֹא",
        gloss: "come",
      }),
      variant({
        variantId: 602,
        verseId: GEN_30_11,
        position: 3,
        catchWord: "ב/גד",
        surface: "גָ֑ד",
        lemma: "1409",
        strongs: "H1409",
        morph: "HNcmsa",
        language: "hbo",
        headword: "גָּד",
        gloss: "Gad",
      }),
    ];

    render(<QereReadings variants={variants} words={words} />);

    // Exactly one ketiv item is rendered for the shared position, not one per reading.
    expect(screen.getAllByText("ב/גד")).toHaveLength(1);
    expect(document.querySelectorAll(".qere-readings__item")).toHaveLength(1);

    // Both readings are present under it.
    expect(screen.getByText("בָּ֣א")).not.toBeNull();
    expect(screen.getByText("גָ֑ד")).not.toBeNull();
    expect(screen.getByText(/3rd word of the Hebrew/)).not.toBeNull();
  });

  it("discloses the missing written form when neither catchWord nor an interlinear word exists", () => {
    const variants: OriginalVariant[] = [
      variant({
        variantId: 701,
        verseId: GEN_8_17,
        position: 5,
        catchWord: null,
        surface: "הַיְצֵ֣א",
        strongs: "H3318",
        morph: "HVhv2ms",
        language: "hbo",
      }),
    ];

    render(<QereReadings variants={variants} words={[]} />);

    expect(screen.getByText(/no written form/)).not.toBeNull();
  });
});
