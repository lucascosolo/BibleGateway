import { describe, expect, it } from "vitest";

import type { AudioEdition, ChapterAudio, PassageAudio } from "@/lib/db/audio";
import { availableChoices, pickEdition } from "@/lib/audio/select";
import { useAudioStore } from "./audio";

const editions: AudioEdition[] = [
  { editionId: 1, code: "WEB-x", translationCode: "WEB", language: "eng", name: "", reader: "", license: "", attribution: "", sourceUrl: "", pronunciationNote: null },
  { editionId: 2, code: "KJV-x", translationCode: "KJV", language: "eng", name: "", reader: "", license: "", attribution: "", sourceUrl: "", pronunciationNote: null },
  { editionId: 3, code: "WLC-x", translationCode: null, language: "hbo", name: "", reader: "", license: "", attribution: "", sourceUrl: "", pronunciationNote: null },
];

const chapterAudio = (code: string): ChapterAudio => ({
  editionCode: code, bookId: 1, chapter: 1, url: `/audio/${code}/01-001.m4a`, durationMs: 1000, verses: [],
});

const genesis1: PassageAudio["chapters"][number] = {
  bookId: 1, chapter: 1,
  byEdition: { "WEB-x": chapterAudio("WEB-x"), "WLC-x": chapterAudio("WLC-x") },
};

describe("pickEdition", () => {
  it("chooses the recording of the translation on screen", () => {
    expect(pickEdition(genesis1, editions, "WEB", "translation")?.editionCode).toBe("WEB-x");
  });
  it("refuses to substitute another translation's recording", () => {
    expect(pickEdition(genesis1, editions, "KJV", "translation")).toBeNull();
    expect(pickEdition(genesis1, editions, "YLT", "translation")).toBeNull();
  });
  it("plays the original-language reading under any translation", () => {
    expect(pickEdition(genesis1, editions, "YLT", "original")?.editionCode).toBe("WLC-x");
  });
  it("is null for a chapter nobody recorded, or no chapter", () => {
    expect(pickEdition({ bookId: 40, chapter: 1, byEdition: {} }, editions, "WEB", "original")).toBeNull();
    expect(pickEdition(undefined, editions, "WEB", "translation")).toBeNull();
  });
});

describe("availableChoices", () => {
  it("reports both kinds when both exist", () => {
    expect(availableChoices({ editions, chapters: [genesis1] }, "WEB")).toEqual(["translation", "original"]);
  });
  it("reports only the original when the translation has no recording", () => {
    expect(availableChoices({ editions, chapters: [genesis1] }, "YLT")).toEqual(["original"]);
  });
  it("is empty without an audio artifact or without chapters", () => {
    expect(availableChoices(null, "WEB")).toEqual([]);
    expect(availableChoices({ editions, chapters: [] }, "WEB")).toEqual([]);
  });
});

describe("useAudioStore.send", () => {
  it("opens the bar for playback commands but not for a word clip", () => {
    const store = useAudioStore.getState();
    store.setOpen(false);
    store.send({ kind: "clip", url: "/audio/x.m4a", startMs: 0, endMs: 10 });
    expect(useAudioStore.getState().open).toBe(false);
    store.send({ kind: "play", verseId: null });
    expect(useAudioStore.getState().open).toBe(true);
  });
  it("bumps the sequence so identical commands both fire", () => {
    const before = useAudioStore.getState().commandSeq;
    useAudioStore.getState().send({ kind: "toggle" });
    useAudioStore.getState().send({ kind: "toggle" });
    expect(useAudioStore.getState().commandSeq).toBe(before + 2);
  });
});
