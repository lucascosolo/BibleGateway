"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const PREFERENCES_STORAGE_KEY = "jot-preferences";

export interface LayerToggles {
  verseNumbers: boolean;
  highlights: boolean;
  notes: boolean;
  crossRefs: boolean;
  heat: boolean;
  variants: boolean;
  sourceCrit: boolean;
  /** Hebrew/Greek words beneath the translation, with lemma and parsed morphology. */
  interlinear: boolean;
}

export type ThemePreference = "light" | "dark" | "system";

/** The last passage the reader was open to — powers the home page's "Continue reading" card. */
export interface LastRead {
  /** URL slug for `/read/[ref]`, e.g. "John.3.1-21". */
  slug: string;
  /** Human-readable form, e.g. "John 3". */
  label: string;
  translationCode: string;
  readAt: number;
}

const defaultLayers: LayerToggles = {
  verseNumbers: true,
  highlights: true,
  notes: true,
  crossRefs: true,
  heat: false,
  // ON by default. `variants` used to control nothing at all, so its value was arbitrary and
  // `false` was harmless. It now governs whether an omitted verse gets the full apparatus (the
  // reason, plus links to the translations that print it) or only the one-line notice — and
  // that apparatus was previously unconditional in the reader. Defaulting it off would have
  // been a silent feature removal dressed as wiring up a switch. See PREFERENCES_VERSION.
  variants: true,
  sourceCrit: false,
  // OFF by default, and this one should stay off. An interlinear is the densest thing the
  // reader can show — a stacked cell per word, in a script most readers cannot read — and
  // defaulting it on would bury the translation under apparatus for everyone who did not ask
  // for it. It is the layer a researcher turns on deliberately.
  interlinear: false,
};

/**
 * Bumped when a default changes meaning, not merely value.
 *
 * `persist` merges a stored object over the defaults, so a reader who has ever loaded the app
 * carries `variants: false` from the old default forever — and would lose the omission
 * apparatus they have always had, with no action of their own. The migration below moves
 * exactly that cohort onto the new default and leaves every other preference alone.
 */
const PREFERENCES_VERSION = 2;

interface PreferencesState {
  layers: LayerToggles;
  selahMode: boolean;
  plainLabels: boolean;
  theme: ThemePreference;
  translation: string;
  tradition: string;
  lastRead: LastRead | null;
  /**
   * Whether the first-run guided tour has been shown.
   *
   * Stored as a plain boolean rather than a version number on purpose. A version would let a
   * later change re-open the tour over everyone's page, and a tour that reappears after you have
   * dismissed it is worse than one that never updates — the guide is reachable on demand from
   * the rail and the home page either way.
   */
  tourSeen: boolean;

  toggleLayer: (layer: keyof LayerToggles) => void;
  setSelahMode: (on: boolean) => void;
  toggleSelahMode: () => void;
  setPlainLabels: (on: boolean) => void;
  togglePlainLabels: () => void;
  setTheme: (theme: ThemePreference) => void;
  setTranslation: (code: string) => void;
  setTradition: (tradition: string) => void;
  setLastRead: (lastRead: Omit<LastRead, "readAt">) => void;
  setTourSeen: (seen: boolean) => void;
  /**
   * Put every *configurable* preference back to its shipped default.
   *
   * Deliberately narrow. `lastRead` is a record of something the reader did, not a setting, and
   * `tourSeen` is the flag that decides whether the tour opens itself — resetting it from a
   * button inside the tour would arm the dialog to reopen over the reader's next page, which is
   * the one thing `tourSeen`'s comment above exists to prevent.
   */
  resetSettings: () => void;
}

/** The shipped defaults, in one place so `resetSettings` cannot drift from the initial state. */
const DEFAULT_SETTINGS = {
  layers: defaultLayers,
  selahMode: false,
  plainLabels: false,
  theme: "system",
  translation: "WEB",
  tradition: "critical",
} satisfies Pick<
  PreferencesState,
  "layers" | "selahMode" | "plainLabels" | "theme" | "translation" | "tradition"
>;

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      lastRead: null,
      tourSeen: false,

      toggleLayer: (layer) =>
        set((state) => ({
          layers: { ...state.layers, [layer]: !state.layers[layer] },
        })),
      setSelahMode: (on) => set({ selahMode: on }),
      toggleSelahMode: () => set((state) => ({ selahMode: !state.selahMode })),
      setPlainLabels: (on) => set({ plainLabels: on }),
      togglePlainLabels: () => set((state) => ({ plainLabels: !state.plainLabels })),
      setTheme: (theme) => set({ theme }),
      setTranslation: (code) => set({ translation: code }),
      setTradition: (tradition) => set({ tradition }),
      setLastRead: (lastRead) => set({ lastRead: { ...lastRead, readAt: Date.now() } }),
      setTourSeen: (tourSeen) => set({ tourSeen }),
      // Spread a fresh copy of `layers`: `DEFAULT_SETTINGS.layers` is the same object every
      // call, and handing the store a reference to it would let the next `toggleLayer` — which
      // spreads before writing — be fine, but any future direct mutation corrupt the constant
      // for the lifetime of the tab.
      resetSettings: () => set({ ...DEFAULT_SETTINGS, layers: { ...DEFAULT_SETTINGS.layers } }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: PREFERENCES_VERSION,
      migrate: (persisted, from) => {
        const state = (persisted ?? {}) as Partial<PreferencesState>;
        // v1 -> v2: `interlinear` was added. `persist` merges the stored object over the
        // defaults SHALLOWLY, so a stored `layers` replaces the default object wholesale and
        // any key added since is simply absent — `undefined`, not `false`. That reads as falsy
        // so the layer is off, which is the right default, but `toggleLayer` would then flip it
        // from `undefined` and `aria-checked` would be rendered from a non-boolean. Spreading
        // the defaults underneath fills in every key added in any version, past or future.
        const layers = { ...defaultLayers, ...state.layers };
        if (from >= 1) return { ...state, layers };
        // v0 -> v1: `variants` was an inert toggle stored as `false`. Adopt the new default so
        // the omission apparatus does not disappear for existing readers.
        return { ...state, layers: { ...layers, variants: true } };
      },
    },
  ),
);

/**
 * Given the raw `layers` toggles and `selahMode`, what should actually be
 * rendered right now. Selah flips every layer off without destroying the
 * user's saved layer configuration underneath it.
 */
export function useEffectiveLayers(): LayerToggles {
  const layers = usePreferencesStore((s) => s.layers);
  const selahMode = usePreferencesStore((s) => s.selahMode);
  if (!selahMode) return layers;
  return {
    verseNumbers: false,
    highlights: false,
    notes: false,
    crossRefs: false,
    heat: false,
    variants: false,
    sourceCrit: false,
    interlinear: false,
  };
}

/**
 * Cross-tab sync: the `storage` event fires in *other* tabs whenever
 * localStorage changes in this origin (never in the tab that wrote it), so
 * we rehydrate the persisted store from disk whenever it fires for our key.
 * Mount this once, near the app root.
 */
export function usePreferencesTabSync() {
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === PREFERENCES_STORAGE_KEY) {
        void usePreferencesStore.persist.rehydrate();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
