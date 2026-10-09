"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChapterAudio, PassageAudio } from "@/lib/db/audio";
import type { EditionChoice } from "@/lib/audio/select";
import type { VerseId } from "@/lib/refs/verse-id";

/**
 * Player state. One store, one `<audio>` element (owned by `<AudioPlayer>` in the app shell),
 * fed by whichever reader page is mounted.
 *
 * The page does not own playback. It PUBLISHES what is on screen — the chapters it rendered,
 * the recordings that exist for them, where the next page is — and the player, which lives in
 * the shell and survives client navigations, decides what to do with it. That split is what
 * makes "plays like an audiobook" work: when chapter 3 ends the player pushes the route for
 * chapter 4, the new page publishes its chapters, and the player carries on from the first
 * verse without a new tap. Put the `<audio>` element in the page and it unmounts with the
 * page, and every chapter boundary is a stop.
 */

/** What the reader page publishes. Serializable: it is built on the server and passed down. */
export interface ReaderPassage {
  /** `/read/…` slug of the rendered range, so the player can tell one page from the next. */
  slug: string;
  /** Human-readable range, for the bar and the lock screen. */
  label: string;
  bookName: string;
  translationCode: string;
  /** The verses actually on the page, in order — the fallback start point. */
  renderedVerseIds: VerseId[];
  /** `/read/…?t=…` of the following chapter, or null at the end of a book. */
  nextHref: string | null;
  audio: PassageAudio | null;
}

export type PlayerStatus = "idle" | "loading" | "playing" | "paused";

export type PlayerCommand =
  | { kind: "play"; verseId: VerseId | null }
  | { kind: "pause" }
  | { kind: "toggle" }
  | { kind: "seek"; verseId: VerseId }
  | { kind: "step"; direction: 1 | -1 }
  | { kind: "clip"; url: string; startMs: number; endMs: number };

interface AudioState {
  passage: ReaderPassage | null;
  /** The bar is shown. Set by the Listen button; cleared by its close control. */
  open: boolean;
  status: PlayerStatus;
  choice: EditionChoice;
  rate: number;
  /** The chapter file the element is on, if any. */
  current: ChapterAudio | null;
  currentVerseId: VerseId | null;
  /** Set when a chapter ended and the player navigated; the next page starts playing. */
  autoplayPending: boolean;
  /** A one-shot request; the element reacts, then clears it. */
  command: PlayerCommand | null;
  /** Bumped with every command so two identical commands in a row both fire. */
  commandSeq: number;
  error: string | null;
  /** The chapter after the page's last, fetched ahead so `ended` can switch files without a gesture. */
  prefetch: { href: string; passage: ReaderPassage } | null;

  publish: (passage: ReaderPassage | null) => void;
  /** Unpublish, but only if the store still holds this page; the player may have moved on. */
  withdraw: (slug: string, translationCode: string) => void;
  /** Take the prefetched chapter as the passage and `chapter` as what the element now plays. */
  advance: (chapter: ChapterAudio) => void;
  setOpen: (open: boolean) => void;
  setChoice: (choice: EditionChoice) => void;
  setRate: (rate: number) => void;
  send: (command: PlayerCommand) => void;
  /** For the element only. */
  _set: (
    patch: Partial<Pick<AudioState, "status" | "current" | "currentVerseId" | "autoplayPending" | "command" | "error" | "open" | "prefetch">>,
  ) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      passage: null,
      open: false,
      status: "idle",
      choice: "translation",
      rate: 1,
      current: null,
      currentVerseId: null,
      autoplayPending: false,
      command: null,
      commandSeq: 0,
      error: null,
      prefetch: null,

      publish: (passage) =>
        set((s) => ({ passage, prefetch: passage && samePage(s.passage, passage) ? s.prefetch : null })),
      withdraw: (slug, translationCode) =>
        set((s) => (samePage(s.passage, { slug, translationCode }) ? { passage: null, prefetch: null } : {})),
      advance: (chapter) =>
        set((s) =>
          s.prefetch
            ? {
                passage: s.prefetch.passage,
                prefetch: null,
                current: chapter,
                currentVerseId: chapter.verses[0]?.verseId ?? null,
                autoplayPending: false,
                error: null,
                status: "loading",
              }
            : {},
        ),
      setOpen: (open) => set({ open }),
      setChoice: (choice) => set({ choice }),
      setRate: (rate) => set({ rate }),
      send: (command) =>
        set((s) => ({
          command,
          commandSeq: s.commandSeq + 1,
          // A word clip is a side-remark, not a session: it does not open the bar.
          open: command.kind === "clip" || command.kind === "pause" ? s.open : true,
        })),
      _set: (patch) => set(patch),
    }),
    {
      name: "jot-audio",
      // Only the reader's own choices survive a reload. Playback state is the element's.
      partialize: (s) => ({ choice: s.choice, rate: s.rate }),
    },
  ),
);

function samePage(
  a: Pick<ReaderPassage, "slug" | "translationCode"> | null,
  b: Pick<ReaderPassage, "slug" | "translationCode">,
): boolean {
  return a !== null && a.slug === b.slug && a.translationCode === b.translationCode;
}
