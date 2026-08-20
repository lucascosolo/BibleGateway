"use client";

import clsx from "clsx";

import { useTourStore } from "@/lib/store/tour";

/**
 * Reopens the guided tour.
 *
 * Two presentations of one button, because the tour has to be reachable from two very different
 * places: a 5.75rem rail cell alongside Selah and Pardes, and a line of body text on the home
 * page. Two components would drift; a `variant` prop cannot.
 */
export function TourLauncher({
  variant = "link",
  className,
}: {
  variant?: "link" | "rail";
  className?: string;
}) {
  const openTour = useTourStore((s) => s.openTour);

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={openTour}
        className={clsx(
          "flex w-full flex-col items-center gap-1 rounded-[var(--radius-md)] px-1 py-2.5 text-center font-sans text-[0.6875rem] leading-tight font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]",
          className,
        )}
      >
        <QuestionIcon className="h-5 w-5" />
        <span>Guide</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openTour}
      className={clsx(
        "inline-flex min-h-[var(--touch-target)] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 font-sans text-[var(--text-sm)] text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]",
        className,
      )}
    >
      <QuestionIcon className="h-4 w-4 text-[var(--color-ink-muted)]" />
      New here? Take the guided tour
    </button>
  );
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.1-2.5 3.9" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}
