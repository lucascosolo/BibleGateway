"use client";

import { useId } from "react";

import { usePreferencesStore } from "@/lib/store/preferences";
import { TOUR_VERSION, tourEntry, useTourStore } from "@/lib/store/tour";
import { useInstallPlatform, useInstallPrompt } from "./install";
import { TOUR_STEPS } from "./tour-steps";

const INSTALL_STEP = TOUR_STEPS.find((s) => s.id === "install");

/**
 * The one-time note for readers who finished the tour before it had a home-screen step.
 *
 * A card and not a dialog, on purpose: it is news, not a question the reader must answer before
 * they can read, so it takes no focus, traps nothing and inerts nothing. Any of its three
 * buttons retires it for good. Sits above the bottom tab bar on phones and in the corner from
 * 768px, where there is no bottom bar.
 */
export function InstallNudge() {
  const seenVersion = usePreferencesStore((s) => s.tourSeenVersion);
  const setSeenVersion = usePreferencesStore((s) => s.setTourSeenVersion);
  const tourOpen = useTourStore((s) => s.open);
  const openTour = useTourStore((s) => s.openTour);
  const platform = useInstallPlatform();
  const install = useInstallPrompt();
  const titleId = useId();

  // `platform` is null until after mount, so nothing here reaches the server render.
  if (platform === null || tourOpen || !INSTALL_STEP) return null;
  if (tourEntry(seenVersion, platform === "standalone") !== "nudge") return null;

  const retire = () => setSeenVersion(TOUR_VERSION);

  return (
    <aside
      data-chrome
      aria-labelledby={titleId}
      className="fixed inset-x-4 bottom-[calc(var(--shell-tabbar-height)+env(safe-area-inset-bottom)+var(--space-3))] z-50 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4 md:inset-x-auto md:right-6 md:bottom-6 md:w-[22rem]"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-serif text-[length:var(--text-md)] font-semibold text-[var(--color-ink)]">
            Keep Jot on your home screen
          </h2>
          <p className="mt-1 font-sans text-[var(--text-sm)] leading-relaxed text-[var(--color-ink-muted)]">
            {INSTALL_STEP.what}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={retire}
          className="-mt-2 -mr-2 flex h-[var(--touch-target)] w-[var(--touch-target)] shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            retire();
            if (install) install();
            else openTour("install");
          }}
          className="min-h-[var(--touch-target)] rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-bg)] hover:opacity-90"
        >
          {install ? "Install" : "Show me how"}
        </button>
      </div>
    </aside>
  );
}
