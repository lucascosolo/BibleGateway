import { beforeEach, describe, expect, it } from "vitest";

import type { AudioEdition, ChapterAudio, PassageAudio } from "@/lib/db/audio";
import { availableChoices, pickEdition } from "@/lib/audio/select";
import type { VerseId } from "@/lib/refs/verse-id";
import { useAudioStore, type ReaderPassage } from "./audio";

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

// --- prefetch / withdraw / advance ---

const passage = (slug: string, translationCode = "WEB", nextHref: string | null = null): ReaderPassage => ({
  slug, label: slug, bookName: "John", translationCode, renderedVerseIds: [], nextHref, audio: null,
});
const chapter = (verseId: number | null): ChapterAudio => ({
  editionCode: "WEB", bookId: 43, chapter: 5, url: "/audio/WEB/43-005.m4a",
  durationMs: 1000, verses: verseId === null ? [] : [{ verseId: verseId as VerseId, startMs: 0, endMs: 500 }],
});

const get = () => useAudioStore.getState();

beforeEach(() => {
  useAudioStore.setState({
    passage: null, prefetch: null, current: null, currentVerseId: null,
    autoplayPending: false, error: null, status: "idle",
  });
});

describe("audio store prefetch", () => {
  it("starts with no prefetch", () => {
    expect(get().prefetch).toBeNull();
  });

  it("_set accepts prefetch", () => {
    const pf = { href: "/read/John.5?t=WEB", passage: passage("John.5") };
    get()._set({ prefetch: pf });
    expect(get().prefetch).toBe(pf);
  });

  it("publish keeps the prefetch when the passage identity is unchanged, but replaces the passage object", () => {
    const pf = { href: "/read/John.5?t=WEB", passage: passage("John.5") };
    get().publish(passage("John.4"));
    get()._set({ prefetch: pf });
    const again = passage("John.4");
    get().publish(again);
    expect(get().passage).toBe(again);
    expect(get().prefetch).toBe(pf);
  });

  it.each([
    ["slug", passage("John.6")],
    ["translation", passage("John.4", "KJV")],
    ["null", null],
  ])("publish clears the prefetch when the %s differs", (_name, next) => {
    get().publish(passage("John.4"));
    get()._set({ prefetch: { href: "/read/John.5?t=WEB", passage: passage("John.5") } });
    get().publish(next);
    expect(get().passage).toBe(next);
    expect(get().prefetch).toBeNull();
  });
});

describe("audio store withdraw", () => {
  it("clears passage and prefetch when slug and translation match", () => {
    get().publish(passage("John.4"));
    get()._set({ prefetch: { href: "/read/John.5?t=WEB", passage: passage("John.5") } });
    get().withdraw("John.4", "WEB");
    expect(get().passage).toBeNull();
    expect(get().prefetch).toBeNull();
  });

  it.each([["John.5", "WEB"], ["John.4", "KJV"]])("does nothing for %s/%s", (slug, code) => {
    const current = passage("John.4");
    const pf = { href: "/read/John.5?t=WEB", passage: passage("John.5") };
    get().publish(current);
    get()._set({ prefetch: pf });
    get().withdraw(slug, code);
    expect(get().passage).toBe(current);
    expect(get().prefetch).toBe(pf);
  });
});

describe("audio store advance", () => {
  it("is a no-op without a prefetch", () => {
    const current = passage("John.4");
    get().publish(current);
    get()._set({ autoplayPending: true, status: "playing" });
    get().advance(chapter(43_005_001));
    expect(get().passage).toBe(current);
    expect(get().current).toBeNull();
    expect(get().autoplayPending).toBe(true);
    expect(get().status).toBe("playing");
  });

  it("swaps in the prefetched passage and cues the chapter", () => {
    const next = passage("John.5");
    const ch = chapter(43_005_001);
    get().publish(passage("John.4"));
    get()._set({
      prefetch: { href: "/read/John.5?t=WEB", passage: next },
      autoplayPending: true, error: "boom", status: "playing",
    });
    get().advance(ch);
    const s = get();
    expect(s.passage).toBe(next);
    expect(s.prefetch).toBeNull();
    expect(s.current).toBe(ch);
    expect(s.currentVerseId).toBe(43_005_001);
    expect(s.autoplayPending).toBe(false);
    expect(s.error).toBeNull();
    expect(s.status).toBe("loading");
  });

  it("uses a null verse when the chapter has no timed verses", () => {
    get().publish(passage("John.4"));
    get()._set({ prefetch: { href: "/read/John.5?t=WEB", passage: passage("John.5") }, currentVerseId: 1 as VerseId });
    get().advance(chapter(null));
    expect(get().currentVerseId).toBeNull();
  });
});
