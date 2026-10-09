"use client";

import { create } from "zustand";

/**
 * Whether the guided tour is on screen right now, and which step it opens at.
 *
 * Deliberately NOT part of `usePreferencesStore`: that store is persisted, and "a dialog is
 * currently open" written to localStorage would reopen the tour on the next page load, in
 * every other tab, forever. What *is* persisted is `tourSeenVersion`, which lives in preferences
 * because it is genuinely a preference.
 */
interface TourState {
  open: boolean;
  /** The step id the next opening starts at; `null` is the first step. */
  startStepId: string | null;
  /** Ignores non-string arguments, so it can be handed straight to `onClick`. */
  openTour: (stepId?: unknown) => void;
  closeTour: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  open: false,
  startStepId: null,
  openTour: (stepId) => set({ open: true, startStepId: typeof stepId === "string" ? stepId : null }),
  closeTour: () => set({ open: false }),
}));

/**
 * The tour's content version. 1 was the original tour; 2 added the support and home-screen
 * steps. A reader who saw an older version is not shown the whole tour again — that would be the
 * app failing to take no for an answer — only a one-time nudge for what was added.
 */
export const TOUR_VERSION = 2;

/** What a reader who has seen `seenVersion` of the tour is owed on this visit. */
export function tourEntry(seenVersion: number, standalone: boolean): "tour" | "nudge" | null {
  if (seenVersion <= 0) return "tour";
  if (seenVersion < TOUR_VERSION) return standalone ? null : "nudge";
  return null;
}
