"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModalSurface } from "@/lib/a11y/modal-surface";
import { getLexiconEntry } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";
import { useTourStore } from "@/lib/store/tour";
import { WORKSPACE_ICONS } from "@/components/shell/icons";
import { TOUR_STEPS } from "./tour-steps";
import { TourSetup } from "./TourSetup";

/**
 * The first-run guided tour.
 *
 * **A card sequence, not a spotlight.** The obvious design — highlight the real button and point
 * an arrow at it — was rejected deliberately. This app has three different shells (bottom tab bar
 * below 768px, top tabs to 1279px, left rail above it), and the same control is a tab, a pill or
 * a rail cell depending on width; some of them do not exist at every width at all. An anchored
 * tour would need a position per control per breakpoint, would break silently the next time a
 * control moves, and would break *worst* on the narrow screens where a misplaced overlay covers
 * the thing it is describing. A centered card says the same things and cannot come unstuck.
 *
 * Portaled to `<body>` for the reason set out in `BottomSheet.tsx`: the shell chrome is
 * `position: sticky`, sticky always establishes a stacking context, and a dialog rendered inside
 * one cannot escape it with z-index no matter how large.
 *
 * Focus trap, background inerting and focus restore come from `useModalSurface`, the same hook
 * every other dialog here uses.
 */

/** Steps are shown one at a time; this is only the guard against an empty list. */
const LAST = TOUR_STEPS.length - 1;

export function GuidedTour() {
  const open = useTourStore((s) => s.open);
  const openTour = useTourStore((s) => s.openTour);
  const closeTour = useTourStore((s) => s.closeTour);
  const tourSeen = usePreferencesStore((s) => s.tourSeen);
  const setTourSeen = usePreferencesStore((s) => s.setTourSeen);

  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const bodyId = useId();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => setMounted(true), []);

  // First run. Gated on `mounted` because `tourSeen` comes from localStorage: reading it during
  // the server render would render the dialog into HTML for everyone, and reading it during the
  // first client render would produce a hydration mismatch for anyone who has seen it.
  useEffect(() => {
    if (!mounted) return;
    if (tourSeen) return;
    openTour();
    // Marked seen on OPEN, not on finish. Someone who closes the tab halfway through has seen
    // it; reopening it on their next visit would be the app failing to take no for an answer.
    setTourSeen(true);
  }, [mounted, tourSeen, openTour, setTourSeen]);

  const dismiss = useCallback(() => {
    closeTour();
    // Reset so reopening starts at the beginning rather than wherever it was abandoned. Done on
    // close rather than on open so the reset is not visible as a flash of step 1 while the
    // dialog fades.
    setIndex(0);
  }, [closeTour]);

  const { rootRef, dialogRef } = useModalSurface<HTMLDivElement, HTMLDivElement>({
    open,
    onDismiss: dismiss,
  });

  // Moving between steps replaces the whole body of the dialog, and a screen reader is given no
  // reason to notice: focus stays wherever it was and nothing is announced. Focusing the new
  // heading makes the step change an event rather than a silent swap.
  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
  }, [open, index]);

  if (!open || !mounted || TOUR_STEPS.length === 0) return null;

  const step = TOUR_STEPS[Math.min(index, LAST)];
  const Icon = step.icon ? WORKSPACE_ICONS[step.icon] : undefined;
  const lexicon = step.lexiconId ? getLexiconEntry(step.lexiconId) : null;
  const isLast = index >= LAST;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close the guide"
        onClick={dismiss}
        className="absolute inset-0 bg-[var(--color-overlay)]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-surface="tour"
        className="relative flex max-h-[88dvh] w-full max-w-[34rem] flex-col overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-6 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] sm:rounded-[var(--radius-xl)] sm:pb-6"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <p className="font-sans text-[var(--text-xs)] tracking-[0.06em] text-[var(--color-ink-faint)] uppercase">
          A quick guide · {index + 1} of {TOUR_STEPS.length}
        </p>

        <div className="mt-3 flex items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h2
              id={titleId}
              ref={headingRef}
              // `tabIndex={-1}` so it can receive focus programmatically on each step change
              // without ever entering the Tab order.
              tabIndex={-1}
              className="font-serif text-[var(--text-lg)] font-semibold text-[var(--color-ink)] focus-visible:outline-none"
            >
              {step.title}
            </h2>
            {lexicon && (
              // The Hebrew term is shown as what it is: a name for the thing just described in
              // English, with its meaning attached. Introduced this way it reads as vocabulary
              // the tool has a reason to use, rather than decoration over an ordinary feature.
              <p className="mt-0.5 font-serif text-[var(--text-sm)] text-[var(--color-ink-muted)]">
                Called <strong className="font-semibold text-[var(--color-ink)]">{lexicon.term}</strong>{" "}
                here — <span className="italic">{lexicon.gloss}</span>
              </p>
            )}
          </div>
        </div>

        <div id={bodyId} className="mt-4 flex flex-col gap-3">
          <p className="font-sans text-[var(--text-sm)] leading-relaxed text-[var(--color-ink)]">
            {step.what}
          </p>
          <p className="border-l-2 border-[var(--color-border-strong)] pl-3 font-sans text-[var(--text-sm)] leading-relaxed text-[var(--color-ink-muted)]">
            <span className="font-semibold text-[var(--color-ink)]">Why it is here:</span>{" "}
            {step.why}
          </p>
          {step.href && (
            <Link
              href={step.href}
              onClick={dismiss}
              className="w-fit font-sans text-[var(--text-sm)] font-medium text-[var(--color-brand)] underline underline-offset-4"
            >
              {step.hrefLabel ?? "See it"} →
            </Link>
          )}
          {/* Inside `bodyId` on purpose: the settings are what this step *is*, so they belong to
              the dialog's accessible description rather than sitting outside it as an unrelated
              region. The dialog is already `overflow-y-auto` and capped at 88dvh, so a panel
              taller than the viewport scrolls rather than escaping the box. */}
          {step.setup && (
            <div className="mt-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-4">
              <TourSetup />
            </div>
          )}
        </div>

        {/* Progress as dots, labelled for anyone who cannot see them. Not clickable: nine tiny
            targets in a row is a reach-and-miss control, and Back/Next already covers it. */}
        <ol
          className="mt-6 flex items-center gap-1.5"
          aria-label={`Step ${index + 1} of ${TOUR_STEPS.length}`}
        >
          {TOUR_STEPS.map((s, i) => (
            <li
              key={s.id}
              aria-hidden="true"
              className={
                i === index
                  ? "h-1.5 w-5 rounded-full bg-[var(--color-brand)]"
                  : "h-1.5 w-1.5 rounded-full bg-[var(--color-border-strong)]"
              }
            />
          ))}
        </ol>

        <div className="mt-4 flex items-center justify-between gap-3">
          {/* Always present, at every step, in the same place. A guide you cannot leave is a
              trap, and one whose exit moves around is nearly as bad. */}
          <button
            type="button"
            onClick={dismiss}
            className="min-h-[var(--touch-target)] rounded-[var(--radius-md)] px-3 font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]"
          >
            {isLast ? "Close" : "Skip"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="min-h-[var(--touch-target)] rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 font-sans text-[var(--text-sm)] text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => (isLast ? dismiss() : setIndex((i) => Math.min(LAST, i + 1)))}
              className="min-h-[var(--touch-target)] rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-bg)] hover:opacity-90"
            >
              {isLast ? "Start reading" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
