import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioEdition, ChapterAudio } from "@/lib/db/audio";
import type { VerseId } from "@/lib/refs/verse-id";
import { useAudioStore, type ReaderPassage } from "@/lib/store/audio";
import { AudioPlayer } from "./AudioPlayer";
import { ReaderAudio } from "./ReaderAudio";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
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
    current: null, currentVerseId: null, autoplayPending: false, command: null, commandSeq: 0, error: null, prefetch: null,
  });
  router.push.mockReset();
  router.replace.mockReset();
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

describe("AudioPlayer attribution", () => {
  it("shows the recording's licence as a link to its source while a verse is playing", async () => {
    await mountPlaying();
    await act(async () => useAudioStore.setState({ currentVerseId: verse }));
    const link = screen.getByRole("link", { name: /Licence: Public domain/ });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.textContent).toBe("Public domain");
  });
});

describe("AudioPlayer gapless chapter handoff", () => {
  const nextVerse = 43_005_001 as VerseId;
  const nextPage = (): ReaderPassage => ({
    slug: "John.5", label: "John 5", bookName: "John", translationCode: "WEB",
    renderedVerseIds: [nextVerse], nextHref: "/read/John.6?t=WEB",
    audio: {
      editions,
      chapters: [{ bookId: 43, chapter: 5, byEdition: {
        WEB: { ...chapter("WEB"), chapter: 5, url: "/audio/WEB/43-005.m4a?v=test",
          verses: [{ verseId: nextVerse, startMs: 0, endMs: 5000 }] },
      } }],
    },
  });
  const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });
  const FIVE = "/api/audio/passage?ref=John.5&t=WEB";

  /** Answers John.5 with `body`; any other URL (the next-next chapter) fails. */
  function stubFetch(body: unknown, ok = true) {
    const fn = vi.fn(async (url: string) => (url === FIVE ? json(body, ok) : json(null, false)));
    vi.stubGlobal("fetch", fn);
    return fn;
  }
  function stubRejectingFetch() {
    const fn = vi.fn(async () => { throw new Error("offline"); });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  async function mountReader(key = "a") {
    const view = render(<><ReaderAudio key={key} passage={passage()} /><AudioPlayer /></>);
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
    await act(async () => { await Promise.resolve(); });
    const main = view.container.querySelector("audio")!;
    return { view, main };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as unknown as Record<string, unknown>).mediaSession;
  });

  it("prefetches the next page from /api/audio/passage once a chapter is cued", async () => {
    const body = nextPage();
    const fetchMock = stubFetch(body);
    await mountReader();
    expect(fetchMock).toHaveBeenCalledWith(FIVE, expect.anything());
    expect(useAudioStore.getState().prefetch).toEqual({ href: "/read/John.5?t=WEB", passage: body });
  });

  it("does not fetch when the passage has no nextHref", async () => {
    const fetchMock = stubFetch(nextPage());
    useAudioStore.setState({ passage: { ...passage(), nextHref: null } });
    render(<AudioPlayer />);
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch while a later chapter with audio follows on the same page", async () => {
    const fetchMock = stubFetch(nextPage());
    const two = passage();
    two.audio = {
      editions,
      chapters: [
        ...two.audio!.chapters,
        { bookId: 43, chapter: 5, byEdition: { WEB: { ...chapter("WEB"), chapter: 5, url: "/audio/WEB/43-005.m4a?v=test" } } },
      ],
    };
    useAudioStore.setState({ passage: two });
    render(<AudioPlayer />);
    await act(async () => useAudioStore.getState().send({ kind: "play", verseId: null }));
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["answers not ok", () => stubFetch(nextPage(), false)],
    ["rejects", () => stubRejectingFetch()],
  ])("leaves prefetch null when the fetch %s", async (_n, stub) => {
    stub();
    await mountReader();
    expect(useAudioStore.getState().prefetch).toBeNull();
    expect(useAudioStore.getState().error).toBeNull();
  });

  it("on ended, starts the prefetched chapter synchronously and swaps the URL without navigating", async () => {
    const body = nextPage();
    stubFetch(body);
    const ms = { setActionHandler: vi.fn(), metadata: null as { title: string } | null };
    Object.defineProperty(navigator, "mediaSession", { value: ms, configurable: true });
    vi.stubGlobal("MediaMetadata", class { constructor(public init: { title: string }) { Object.assign(this, init); } });
    const { main } = await mountReader();
    expect(useAudioStore.getState().prefetch).not.toBeNull();
    play.mockClear();
    let playedSync = 0;
    let srcSync = "";
    act(() => {
      main.dispatchEvent(new Event("ended"));
      playedSync = play.mock.contexts.filter((c) => c === main).length;
      srcSync = main.src;
    });
    expect(playedSync).toBe(1);
    expect(srcSync).toContain("43-005.m4a");
    await act(async () => { await Promise.resolve(); });
    const s = useAudioStore.getState();
    expect(s.current?.chapter).toBe(5);
    expect(s.passage?.slug).toBe("John.5");
    expect(s.autoplayPending).toBe(false);
    expect(s.prefetch === null || s.prefetch.href === "/read/John.6?t=WEB").toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/read/John.5?t=WEB", { scroll: false });
    expect(router.push).not.toHaveBeenCalled();
    expect(ms.metadata?.title).toBe("John 5");
  });

  it("does not restart playback when the next page then mounts", async () => {
    const body = nextPage();
    stubFetch(body);
    const { view, main } = await mountReader("a");
    await act(async () => { main.dispatchEvent(new Event("ended")); });
    play.mockClear();
    await act(async () => view.rerender(<><ReaderAudio key="b" passage={nextPage()} /><AudioPlayer /></>));
    await act(async () => { await Promise.resolve(); });
    expect(play).not.toHaveBeenCalled();
    expect(main.src).toContain("43-005.m4a");
    expect(useAudioStore.getState().status).toBe("playing");
    expect(useAudioStore.getState().current?.chapter).toBe(5);
    expect(useAudioStore.getState().passage?.slug).toBe("John.5");
  });

  it.each([
    ["answers not ok", () => stubFetch(nextPage(), false)],
    ["rejects", () => stubRejectingFetch()],
  ])("falls back to router.push when the prefetch %s", async (_n, stub) => {
    stub();
    const { main } = await mountReader();
    await act(async () => { main.dispatchEvent(new Event("ended")); });
    expect(router.push).toHaveBeenCalledWith("/read/John.5?t=WEB");
    expect(useAudioStore.getState().autoplayPending).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("ignores a prefetch whose href differs from the passage nextHref", async () => {
    stubRejectingFetch();
    const { main } = await mountReader();
    await act(async () => useAudioStore.setState({
      prefetch: { href: "/read/John.9?t=WEB", passage: nextPage() },
    }));
    await act(async () => { main.dispatchEvent(new Event("ended")); });
    expect(router.push).toHaveBeenCalledWith("/read/John.5?t=WEB");
    expect(useAudioStore.getState().autoplayPending).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
