"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { editionByCode, pickEdition } from "@/lib/audio/select";
import { nextRate, nextVerse, prevVerse, startOf, startVerse, verseAt } from "@/lib/audio/timing";
import type { ChapterAudio } from "@/lib/db/audio";
import { chapterOf, verseOf, type VerseId } from "@/lib/refs/verse-id";
import { useAudioStore, type ReaderPassage } from "@/lib/store/audio";
import { CloseIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, SpinnerIcon } from "./icons";

/**
 * The audiobook control bar and the one `<audio>` element behind it.
 *
 * Mounted once in `<AppShell>`, so it outlives the reader page. Everything it knows about the
 * text on screen arrives through the store from `<ReaderAudio>`; everything it does to the
 * page (the moving highlight) goes back out through the store. It never touches the passage
 * DOM itself, so the bar and the reader can be tested apart.
 *
 * Two elements, not one. The chapter recording plays in `main`; a word clip from the
 * interlinear plays in `clip`, pausing `main` for its duration. Sharing an element would
 * mean tearing down a 45-minute chapter stream to hear one word and re-seeking after — and
 * a clip pressed while paused would silently move the chapter's position.
 */

const SEEK_LEAD_MS = 150; // start a verse a hair early so its first syllable is not clipped

function selectedVerseId(): VerseId | null {
  if (typeof window === "undefined") return null;
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  if (!node) return null;
  const el = node instanceof Element ? node : node.parentElement;
  const verse = el?.closest<HTMLElement>(".reader [data-verse-id]");
  const id = verse?.dataset.verseId;
  return id ? (Number(id) as VerseId) : null;
}

/** The chapter of `passage` that holds `verseId` under the current choice, with its audio. */
function chapterFor(passage: ReaderPassage, choice: "translation" | "original", verseId: VerseId): ChapterAudio | null {
  if (!passage.audio) return null;
  const chapter = passage.audio.chapters.find(
    (c) => c.bookId === Math.floor(verseId / 1_000_000) && c.chapter === chapterOf(verseId),
  );
  return pickEdition(chapter, passage.audio.editions, passage.translationCode, choice);
}

/** All chapters of `passage` that have audio under the choice, in reading order. */
function chaptersWithAudio(passage: ReaderPassage, choice: "translation" | "original"): ChapterAudio[] {
  if (!passage.audio) return [];
  const out: ChapterAudio[] = [];
  for (const c of passage.audio.chapters) {
    const a = pickEdition(c, passage.audio.editions, passage.translationCode, choice);
    if (a) out.push(a);
  }
  return out;
}

export function AudioPlayer() {
  const router = useRouter();
  const mainRef = useRef<HTMLAudioElement>(null);
  const clipRef = useRef<HTMLAudioElement>(null);
  const clipEndRef = useRef<number | null>(null);
  const resumeAfterClipRef = useRef(false);

  const passage = useAudioStore((s) => s.passage);
  const open = useAudioStore((s) => s.open);
  const status = useAudioStore((s) => s.status);
  const choice = useAudioStore((s) => s.choice);
  const rate = useAudioStore((s) => s.rate);
  const current = useAudioStore((s) => s.current);
  const currentVerseId = useAudioStore((s) => s.currentVerseId);
  const command = useAudioStore((s) => s.command);
  const commandSeq = useAudioStore((s) => s.commandSeq);
  const autoplayPending = useAudioStore((s) => s.autoplayPending);
  const error = useAudioStore((s) => s.error);
  const setChoice = useAudioStore((s) => s.setChoice);
  const setRate = useAudioStore((s) => s.setRate);
  const send = useAudioStore((s) => s.send);
  const set = useAudioStore((s) => s._set);

  /** Put the element on `chapter` at `verseId` and (optionally) play. */
  const cue = useCallback(
    (chapter: ChapterAudio, verseId: VerseId | null, play: boolean) => {
      const el = mainRef.current;
      if (!el) return;
      const ms = verseId !== null ? startOf(chapter.verses, verseId) : null;
      const seconds = Math.max(0, ((ms ?? 0) - SEEK_LEAD_MS) / 1000);
      const sameFile = el.src.endsWith(chapter.url) || el.currentSrc.endsWith(chapter.url);
      if (!sameFile) {
        el.src = chapter.url;
        el.load();
      }
      el.playbackRate = rate;
      // Seeking before metadata is loaded is dropped by some browsers; wait for it when needed.
      const seek = () => {
        el.currentTime = seconds;
      };
      if (el.readyState >= 1) seek();
      else el.addEventListener("loadedmetadata", seek, { once: true });
      set({ current: chapter, currentVerseId: verseId ?? verseAt(chapter.verses, ms ?? 0), error: null });
      if (play) {
        set({ status: "loading" });
        el.play().catch((err: unknown) => {
          set({ status: "paused", error: err instanceof Error ? err.message : "Playback was blocked." });
        });
      } else {
        set({ status: "paused" });
      }
    },
    [rate, set],
  );

  /** Start from the best verse for the current page, or resume. */
  const start = useCallback(
    (requested: VerseId | null, opts: { resume?: boolean } = {}) => {
      const el = mainRef.current;
      if (!passage || !el) return;
      // Resume the file already on the element when nothing more specific was asked for and
      // that file is still one of the chapters on screen.
      const currentOnScreen =
        current !== null &&
        passage.audio?.chapters.some((c) => c.bookId === current.bookId && c.chapter === current.chapter);
      if (opts.resume && requested === null && status === "paused" && currentOnScreen && selectedVerseId() === null) {
        set({ status: "loading" });
        el.play().catch(() => set({ status: "paused" }));
        return;
      }
      const chapters = chaptersWithAudio(passage, choice);
      if (chapters.length === 0) {
        set({ error: "No recording for this page.", status: "idle" });
        return;
      }
      const wanted = requested ?? selectedVerseId();
      // The chapter holding the wanted verse, else the first rendered verse any chapter places.
      let chapter = wanted !== null ? chapterFor(passage, choice, wanted) : null;
      let verse: VerseId | null = chapter ? startVerse(chapter.verses, wanted, passage.renderedVerseIds) : null;
      if (!chapter || verse === null) {
        for (const c of chapters) {
          const v = startVerse(c.verses, null, passage.renderedVerseIds);
          if (v !== null) {
            chapter = c;
            verse = v;
            break;
          }
        }
      }
      if (!chapter) {
        set({ error: "No recording for this page.", status: "idle" });
        return;
      }
      cue(chapter, verse, true);
    },
    [passage, choice, current, status, cue, set],
  );

  // React to one-shot commands from the bar, the Listen button, keyboard, media keys.
  useEffect(() => {
    if (!command) return;
    const el = mainRef.current;
    set({ command: null });
    if (!el) return;
    switch (command.kind) {
      case "play":
        start(command.verseId, { resume: true });
        break;
      case "pause":
        el.pause();
        break;
      case "toggle":
        if (status === "playing" || status === "loading") el.pause();
        else start(null, { resume: true });
        break;
      case "seek":
        start(command.verseId);
        break;
      case "step": {
        if (!current || currentVerseId === null) break;
        const target = command.direction > 0 ? nextVerse(current.verses, currentVerseId) : prevVerse(current.verses, currentVerseId);
        if (target !== null) cue(current, target, status === "playing" || status === "loading");
        break;
      }
      case "clip": {
        const clip = clipRef.current;
        if (!clip) break;
        resumeAfterClipRef.current = status === "playing";
        if (status === "playing") el.pause();
        clipEndRef.current = command.endMs / 1000;
        const sameFile = clip.src.endsWith(command.url) || clip.currentSrc.endsWith(command.url);
        if (!sameFile) {
          clip.src = command.url;
          clip.load();
        }
        const go = () => {
          clip.currentTime = Math.max(0, (command.startMs - 60) / 1000);
          clip.play().catch(() => undefined);
        };
        if (clip.readyState >= 1) go();
        else clip.addEventListener("loadedmetadata", go, { once: true });
        break;
      }
    }
    // `commandSeq` is the trigger; `command` is read from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandSeq]);

  // The page changed. Carry on (autoplay across a chapter boundary), or stop if what is
  // playing is no longer on screen.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (!passage) {
      // Left the reader entirely. Playing on into a page with no text to follow is noise.
      el.pause();
      set({ open: false, status: "idle", current: null, currentVerseId: null });
      return;
    }
    if (autoplayPending) {
      set({ autoplayPending: false });
      start(null);
      return;
    }
    if (current) {
      const stillHere = passage.audio?.chapters.some(
        (c) => c.bookId === current.bookId && c.chapter === current.chapter && c.byEdition[current.editionCode],
      );
      if (!stillHere) {
        el.pause();
        set({ status: "idle", current: null, currentVerseId: null });
      }
    }
    // Only the page identity should retrigger this, not every store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage?.slug, passage?.translationCode]);

  // The reader switched between the translation and the Hebrew: re-cue the same verse.
  useEffect(() => {
    if (!passage || !current || currentVerseId === null) return;
    if (current.editionCode === pickEdition(
      passage.audio?.chapters.find((c) => c.bookId === current.bookId && c.chapter === current.chapter),
      passage.audio?.editions ?? [],
      passage.translationCode,
      choice,
    )?.editionCode) return;
    const chapter = chapterFor(passage, choice, currentVerseId);
    if (chapter) cue(chapter, startVerse(chapter.verses, currentVerseId, passage.renderedVerseIds), status === "playing" || status === "loading");
    else {
      mainRef.current?.pause();
      set({ status: "idle", current: null, error: "No recording of this chapter in that voice." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.playbackRate = rate;
  }, [rate]);

  // Element events → store.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onTime = () => {
      const chapter = useAudioStore.getState().current;
      if (!chapter) return;
      const id = verseAt(chapter.verses, el.currentTime * 1000 + 1);
      if (id !== null && id !== useAudioStore.getState().currentVerseId) set({ currentVerseId: id });
    };
    const onPlaying = () => set({ status: "playing", error: null });
    const onPause = () => {
      if (!el.ended) set({ status: "paused" });
    };
    const onWaiting = () => set({ status: "loading" });
    const onError = () => set({ status: "paused", error: "The recording could not be loaded." });
    const onEnded = () => {
      const s = useAudioStore.getState();
      const p = s.passage;
      const chapter = s.current;
      if (!p || !chapter) return set({ status: "idle" });
      // Another rendered chapter with audio after this one? Continue on the same page.
      const list = chaptersWithAudio(p, s.choice);
      const i = list.findIndex((c) => c.bookId === chapter.bookId && c.chapter === chapter.chapter);
      const following = i >= 0 ? list[i + 1] : undefined;
      if (following) {
        cue(following, following.verses[0]?.verseId ?? null, true);
        return;
      }
      if (p.nextHref) {
        set({ autoplayPending: true, status: "loading" });
        router.push(p.nextHref);
        return;
      }
      set({ status: "idle" });
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("error", onError);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("error", onError);
      el.removeEventListener("ended", onEnded);
    };
  }, [cue, router, set]);

  // The clip element: stop at the word's end, then hand back to the chapter if it was playing.
  useEffect(() => {
    const clip = clipRef.current;
    if (!clip) return;
    const onTime = () => {
      const end = clipEndRef.current;
      if (end !== null && clip.currentTime >= end) {
        clip.pause();
        clipEndRef.current = null;
        if (resumeAfterClipRef.current) {
          resumeAfterClipRef.current = false;
          mainRef.current?.play().catch(() => undefined);
        }
      }
    };
    clip.addEventListener("timeupdate", onTime);
    return () => clip.removeEventListener("timeupdate", onTime);
  }, []);

  // Lock screen and headphone buttons, where the browser offers them.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (passage && current) {
      const edition = editionByCode(passage.audio?.editions ?? [], current.editionCode);
      ms.metadata = new MediaMetadata({
        title: `${passage.bookName} ${current.chapter}`,
        artist: edition ? `${edition.name}` : "Jot",
        album: "Jot",
      });
    }
    ms.setActionHandler("play", () => send({ kind: "play", verseId: null }));
    ms.setActionHandler("pause", () => send({ kind: "pause" }));
    ms.setActionHandler("previoustrack", () => send({ kind: "step", direction: -1 }));
    ms.setActionHandler("nexttrack", () => send({ kind: "step", direction: 1 }));
    return () => {
      for (const a of ["play", "pause", "previoustrack", "nexttrack"] as const) ms.setActionHandler(a, null);
    };
  }, [passage, current, send]);

  // Tell the page a bar is on screen so the reading column keeps clear of it.
  const visible = open && passage !== null;
  useEffect(() => {
    if (visible) document.documentElement.setAttribute("data-audio-bar", "");
    else document.documentElement.removeAttribute("data-audio-bar");
    return () => document.documentElement.removeAttribute("data-audio-bar");
  }, [visible]);

  const edition = passage && current ? editionByCode(passage.audio?.editions ?? [], current.editionCode) : undefined;
  const hasTranslation = passage ? chaptersWithAudio(passage, "translation").length > 0 : false;
  const hasOriginal = passage ? chaptersWithAudio(passage, "original").length > 0 : false;
  const playing = status === "playing" || status === "loading";

  return (
    <>
      {/* Both elements are always mounted so a user gesture on the bar is what starts them. */}
      <audio ref={mainRef} preload="none" />
      <audio ref={clipRef} preload="none" />
      {visible && passage && (
        <section className="audio-bar" data-chrome aria-label="Audio player" role="region">
          <div className="audio-bar__transport">
            <button
              type="button"
              className="audio-bar__button"
              onClick={() => send({ kind: "step", direction: -1 })}
              disabled={!current || currentVerseId === null}
              aria-label="Previous verse"
              title="Previous verse"
            >
              <SkipBackIcon className="audio-bar__icon" />
            </button>
            <button
              type="button"
              className="audio-bar__button audio-bar__button--primary"
              onClick={() => send({ kind: "toggle" })}
              disabled={!hasTranslation && !hasOriginal}
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause" : "Play"}
            >
              {status === "loading" ? (
                <SpinnerIcon className="audio-bar__icon audio-bar__icon--spin" />
              ) : playing ? (
                <PauseIcon className="audio-bar__icon" />
              ) : (
                <PlayIcon className="audio-bar__icon" />
              )}
            </button>
            <button
              type="button"
              className="audio-bar__button"
              onClick={() => send({ kind: "step", direction: 1 })}
              disabled={!current || currentVerseId === null}
              aria-label="Next verse"
              title="Next verse"
            >
              <SkipForwardIcon className="audio-bar__icon" />
            </button>
          </div>

          <div className="audio-bar__now" aria-live="polite">
            {error ? (
              <span className="audio-bar__error">{error}</span>
            ) : current && currentVerseId !== null ? (
              <>
                <span className="audio-bar__ref">
                  {passage.bookName} {chapterOf(currentVerseId)}:{verseOf(currentVerseId)}
                </span>
                <span className="audio-bar__reader">{edition?.reader ?? ""}</span>
              </>
            ) : !hasTranslation && !hasOriginal ? (
              <span className="audio-bar__error">
                No recording of this page{hasAnyEdition(passage) ? ` in ${passage.translationCode}` : ""}.
                {hasAnyEdition(passage) ? " Switch to WEB, BSB or KJV to listen." : ""}
              </span>
            ) : (
              <span className="audio-bar__ref">{passage.label}</span>
            )}
          </div>

          <div className="audio-bar__options">
            {hasTranslation && hasOriginal && (
              <div className="audio-bar__choice" role="group" aria-label="Voice">
                <button
                  type="button"
                  className={clsx("audio-bar__chip", choice === "translation" && "audio-bar__chip--on")}
                  aria-pressed={choice === "translation"}
                  onClick={() => setChoice("translation")}
                >
                  {passage.translationCode}
                </button>
                <button
                  type="button"
                  className={clsx("audio-bar__chip", choice === "original" && "audio-bar__chip--on")}
                  aria-pressed={choice === "original"}
                  onClick={() => setChoice("original")}
                  title="The Hebrew, read by a human reader"
                >
                  Hebrew
                </button>
              </div>
            )}
            <button
              type="button"
              className="audio-bar__chip"
              onClick={() => setRate(nextRate(rate))}
              aria-label={`Speed ${rate}×. Change speed`}
              title="Speed"
            >
              {rate}×
            </button>
            <button
              type="button"
              className="audio-bar__button"
              onClick={() => {
                mainRef.current?.pause();
                set({ open: false, status: "idle" });
              }}
              aria-label="Close the player"
              title="Close"
            >
              <CloseIcon className="audio-bar__icon" />
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function hasAnyEdition(passage: ReaderPassage): boolean {
  return (passage.audio?.chapters ?? []).some((c) => Object.keys(c.byEdition).length > 0);
}
