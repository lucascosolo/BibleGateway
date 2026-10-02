/**
 * Pure helpers for the player: which verse is playing at a given time, where a verse starts,
 * and where playback should begin. No DOM, no store — so they can be tested directly and the
 * player component stays a thin shell around an `<audio>` element.
 */

import type { VerseId } from "@/lib/refs/verse-id";

export interface VerseTiming {
  verseId: VerseId;
  startMs: number;
  endMs: number;
}

/**
 * The verse whose window contains `ms`, or — between verses (the reader's breath, a psalm
 * superscription the transcript does not carry) — the verse that most recently started.
 * Null before the first verse begins.
 */
export function verseAt(verses: readonly VerseTiming[], ms: number): VerseId | null {
  if (verses.length === 0 || ms < verses[0].startMs) return null;
  let lo = 0;
  let hi = verses.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (verses[mid].startMs <= ms) lo = mid;
    else hi = mid - 1;
  }
  return verses[lo].verseId;
}

/** Start time of a verse in its chapter file, or null if the recording does not place it. */
export function startOf(verses: readonly VerseTiming[], verseId: VerseId): number | null {
  const v = verses.find((t) => t.verseId === verseId);
  return v ? v.startMs : null;
}

/** The verse after `verseId` in this chapter's timings, or null at the end. */
export function nextVerse(verses: readonly VerseTiming[], verseId: VerseId): VerseId | null {
  const i = verses.findIndex((t) => t.verseId === verseId);
  return i >= 0 && i + 1 < verses.length ? verses[i + 1].verseId : null;
}

/** The verse before `verseId`, or null at the start. */
export function prevVerse(verses: readonly VerseTiming[], verseId: VerseId): VerseId | null {
  const i = verses.findIndex((t) => t.verseId === verseId);
  return i > 0 ? verses[i - 1].verseId : null;
}

/**
 * Where to start when the reader presses play with nothing chosen.
 *
 * Priority: an explicit verse (a DOM selection inside one, resolved by the caller) → the first
 * verse of the rendered range that this recording actually places → nothing. "First verse of
 * the range" rather than "start of the file", because the page may be `/read/John.3.16` and
 * the file is the whole chapter: a reader who opened verse 16 did not ask to hear verses 1–15.
 */
export function startVerse(
  verses: readonly VerseTiming[],
  requested: VerseId | null,
  renderedVerseIds: readonly VerseId[],
): VerseId | null {
  if (requested !== null && startOf(verses, requested) !== null) return requested;
  for (const id of renderedVerseIds) {
    if (startOf(verses, id) !== null) return id;
  }
  return null;
}

/** Playback-rate steps offered by the control, in order. */
export const RATES = [0.8, 1, 1.25, 1.5, 2] as const;

export function nextRate(rate: number): number {
  const i = RATES.indexOf(rate as (typeof RATES)[number]);
  return RATES[(i + 1) % RATES.length];
}
