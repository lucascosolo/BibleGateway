import { describe, expect, it } from "vitest";

import type { AudioEdition, PassageAudio } from "@/lib/db/audio";

import { availableChoices, translationsWithAudio } from "./select";

const editions: AudioEdition[] = [
  { editionId: 1, code: "WEB-williams", translationCode: "WEB", language: "eng", name: "WEB", reader: "r", license: "pd", attribution: "a", sourceUrl: "u", pronunciationNote: null },
  { editionId: 2, code: "WLC-beeri", translationCode: null, language: "hbo", name: "WLC", reader: "r", license: "cc", attribution: "a", sourceUrl: "u", pronunciationNote: null },
];

const chapter = (byEdition: Record<string, unknown>) =>
  ({ bookId: 1, chapter: 1, byEdition }) as unknown as PassageAudio["chapters"][number];

const genesis1: PassageAudio = {
  editions,
  chapters: [chapter({ "WEB-williams": { file: "a" }, "WLC-beeri": { file: "b" } })],
};

describe("translationsWithAudio", () => {
  it("marks only the translations whose own edition covers a chapter here", () => {
    const marked = translationsWithAudio(genesis1, ["WEB", "KJV", "JPS"]);
    expect([...marked]).toEqual(["WEB"]);
  });

  it("is empty without an audio artifact", () => {
    expect(translationsWithAudio(null, ["WEB"]).size).toBe(0);
  });
});

describe("availableChoices", () => {
  it("offers the Hebrew alone under a translation with no recording", () => {
    expect(availableChoices(genesis1, "KJV")).toEqual(["original"]);
  });

  it("offers both under a translation that is recorded", () => {
    expect(availableChoices(genesis1, "WEB")).toEqual(["translation", "original"]);
  });
});
