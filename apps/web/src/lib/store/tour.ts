"use client";

import { create } from "zustand";

/**
 * Whether the guided tour is on screen right now.
 *
 * Deliberately NOT part of `usePreferencesStore`: that store is persisted, and "a dialog is
 * currently open" written to localStorage would reopen the tour on the next page load, in
 * every other tab, forever. What *is* persisted is `tourSeen`, which lives in preferences
 * because it is genuinely a preference.
 */
interface TourState {
  open: boolean;
  openTour: () => void;
  closeTour: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  open: false,
  openTour: () => set({ open: true }),
  closeTour: () => set({ open: false }),
}));
