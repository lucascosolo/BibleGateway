import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioEdition, ChapterAudio } from "@/lib/db/audio";
import type { VerseId } from "@/lib/refs/verse-id";
import { useAudioStore, type ReaderPassage } from "@/lib/store/audio";
import { AudioPlayer } from "./AudioPlayer";
import { ReaderAudio } from "./ReaderAudio";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const verse = 43_004_011 as VerseId;
const editions: AudioEdition[] = ["WEB", "KJV"].map((code, index) => ({
  editionId: index + 1, code, translationCode: code, language: "eng", name: code,
  reader: "Reader", license: "Public domain", attribution: "Reader", sourceUrl: "https://example.com",
  pronunciationNote: null,
}));
const chapter = (code: string): ChapterAudio => ({
  editionCode: code, bookId: 43, chapter: 4, url: `/audio/${code}/43-004.m4a?v=test`,
  durationMs: 60_000, verses: [{ verseId: verse, startMs: 1000, endMs: 5000 }],
});
const passage = (translationCode = "WEB"): ReaderPassage => ({
  slug: "John.4.11", label: "John 4:11", bookName: "John", translationCode,
  renderedVerseIds: [verse], nextHref: "/read/John.5?t=WEB",
  audio: { editions, chapters: [{ bookId: 43, chapter: 4, byEdition: { WEB: chapter("WEB"), KJV: chapter("KJV") } }] },
});

let play: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  useAudioStore.setState({
    passage: passage(), open: false, status: "idle", choice: "translation", rate: 1,
    current: null, currentVerseId: null, autoplayPending: false, command: null, commandSeq: 0, error: null,
  });
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(1);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    return Promise.resolve().then(() => { this.dispatchEvent(new Event("playing")); });
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function mountPlaying() {
  const view = render(<AudioPlayer />);
  await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
  const [main, clip] = Array.from(view.container.querySelectorAll("audio"));
  expect(useAudioStore.getState().status).toBe("playing");
  return { main, clip };
}

async function startClip() {
  await act(async () => useAudioStore.getState().send({
    kind: "clip", url: "/audio/hebrew/43-004.m4a", startMs: 1000, endMs: 2000,
  }));
}

describe("AudioPlayer lifecycle", () => {
  it("does not play the chapter opening when the requested and rendered verse has no timing", async () => {
    const missingVerse = 43_004_012 as VerseId;
    const unavailable = passage();
    unavailable.renderedVerseIds = [missingVerse];
    useAudioStore.setState({ passage: unavailable });
    render(<AudioPlayer />);
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: missingVerse }));
    expect(play).not.toHaveBeenCalled();
    expect(useAudioStore.getState().status).toBe("idle");
    expect(useAudioStore.getState().error).toBeTruthy();
  });

  it("does not substitute an earlier timed verse when the selected verse has no timing", async () => {
    const missingVerse = 43_004_012 as VerseId;
    const partial = passage();
    partial.renderedVerseIds = [verse, missingVerse];
    useAudioStore.setState({ passage: partial });
    render(<AudioPlayer />);
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: missingVerse }));
    expect(play).not.toHaveBeenCalled();
    expect(useAudioStore.getState().status).toBe("idle");
    expect(useAudioStore.getState().error).toBeTruthy();
  });

  it("ignores an earlier play rejection after a new recording is already playing", async () => {
    let rejectPrevious!: (reason: Error) => void;
    play.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectPrevious = reject; }));
    render(<AudioPlayer />);
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
    expect(useAudioStore.getState().status).toBe("loading");
    await act(async () => useAudioStore.getState().publish(passage("KJV")));
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
    expect(useAudioStore.getState().status).toBe("playing");
    await act(async () => rejectPrevious(new Error("Previous recording was aborted")));
    expect(useAudioStore.getState().current?.editionCode).toBe("KJV");
    expect(useAudioStore.getState().status).toBe("playing");
    expect(useAudioStore.getState().error).toBeNull();
  });

  it("does not keep the previous translation recording after a same-chapter translation switch", async () => {
    const { main } = await mountPlaying();
    await act(async () => useAudioStore.getState().publish(passage("KJV")));
    // Either stop or re-cue is valid, but resumed playback must match the text.
    if (useAudioStore.getState().status !== "playing") {
      await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
    }
    expect(useAudioStore.getState().current?.editionCode).toBe("KJV");
    expect(main.src).toContain("/KJV/");
  });

  it.each(["ended", "error"])("resumes the chapter after the word clip emits %s", async (event) => {
    const { main, clip } = await mountPlaying();
    await startClip();
    play.mockClear();
    await act(async () => clip.dispatchEvent(new Event(event)));
    expect(play.mock.contexts).toContain(main);
    expect(useAudioStore.getState().status).toBe("playing");
  });

  it("resumes the chapter if a word clip play promise rejects", async () => {
    const { main, clip } = await mountPlaying();
    play.mockImplementation(function (this: HTMLMediaElement) {
      if (this === clip) return Promise.reject(new Error("Unavailable clip"));
      return Promise.resolve().then(() => { this.dispatchEvent(new Event("playing")); });
    });
    await startClip();
    expect(play.mock.contexts.filter((element) => element === main).length).toBeGreaterThan(1);
    expect(useAudioStore.getState().status).toBe("playing");
  });

  it.each(["leave", "close"])("cancels word playback and prevents delayed resumption on %s", async (action) => {
    const { main, clip } = await mountPlaying();
    await startClip();
    const pause = vi.spyOn(clip, "pause");
    await act(async () => {
      if (action === "leave") useAudioStore.getState().publish(null);
      else fireEvent.click(screen.getByRole("button", { name: "Close the player" }));
    });
    expect(pause).toHaveBeenCalled();
    play.mockClear();
    await act(async () => {
      clip.currentTime = 3;
      clip.dispatchEvent(new Event("timeupdate"));
      clip.dispatchEvent(new Event("ended"));
    });
    expect(play.mock.contexts).not.toContain(main);
  });

  it("does not start a pending word clip after the reader leaves before metadata arrives", async () => {
    const { clip } = await mountPlaying();
    vi.spyOn(clip, "readyState", "get").mockReturnValue(0);
    await startClip();
    await act(async () => useAudioStore.getState().publish(null));
    play.mockClear();
    await act(async () => clip.dispatchEvent(new Event("loadedmetadata")));
    expect(play.mock.contexts).not.toContain(clip);
  });

  it("continues into the next chapter when ReaderAudio withdraws and republishes its page", async () => {
    const view = render(<><ReaderAudio passage={passage()} /><AudioPlayer /></>);
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
    const main = view.container.querySelector("audio")!;
    await act(async () => main.dispatchEvent(new Event("ended")));
    expect(router.push).toHaveBeenCalledWith("/read/John.5?t=WEB");
    const nextVerse = 43_005_001 as VerseId;
    const next = passage();
    next.slug = "John.5";
    next.label = "John 5";
    next.renderedVerseIds = [nextVerse];
    next.audio = {
      editions,
      chapters: [{ bookId: 43, chapter: 5, byEdition: {
        WEB: { ...chapter("WEB"), chapter: 5, url: "/audio/WEB/43-005.m4a?v=test",
          verses: [{ verseId: nextVerse, startMs: 0, endMs: 5000 }] },
      } }],
    };
    await act(async () => view.rerender(<><ReaderAudio passage={next} /><AudioPlayer /></>));
    expect(useAudioStore.getState().current?.chapter).toBe(5);
    expect(useAudioStore.getState().status).toBe("playing");
    expect(main.src).toContain("43-005.m4a");
  });
});
