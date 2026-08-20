"use client";

import { useId } from "react";
import clsx from "clsx";
import * as Tooltip from "@radix-ui/react-tooltip";
import { getLexiconEntry, type LexiconId } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";

interface GlossLabelProps {
  id: LexiconId;
  className?: string;
  /** Visual weight — nav items want it inline with an icon, panel headers want it bold. */
  as?: "span" | "strong";
  /**
   * For dense single-line nav contexts (top tabs, bottom tab bar) that have no room for the
   * gloss as a permanent second line even on a coarse pointer. The gloss stays reachable via
   * the tooltip, which already opens on focus — and tapping a touch target focuses it — so
   * this never removes the gloss, only its default always-on rendering.
   */
  compact?: boolean;
}

/**
 * The biblical-vocabulary primitive (ARCHITECTURE.md §4.6). Renders a term
 * plus its plain-English gloss:
 *
 * - Desktop (hover-capable): the gloss appears in a Radix tooltip on
 *   hover/focus.
 * - Touch: the gloss appears as a permanent italic subtitle beneath the
 *   term, since there is no hover to reveal it — this is pure CSS
 *   (`@media (hover: none)`), not a JS device check, so there is nothing to
 *   get wrong on the server render.
 * - Always: the gloss text is wired to the term via `aria-describedby`, so
 *   it is in the accessible description regardless of pointer type or
 *   whether the tooltip has ever been opened.
 * - "Plain labels" preference swaps the term for its English equivalent
 *   everywhere, sourced from one lookup table (`lib/lexicon.ts`).
 */
export function GlossLabel({ id, className, as = "span", compact = false }: GlossLabelProps) {
  const entry = getLexiconEntry(id);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const descId = useId();
  const Tag = as;

  if (plainLabels) {
    return <Tag className={className}>{entry.plainLabel}</Tag>;
  }

  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <span className={clsx("relative inline-flex flex-col", className)}>
          <Tooltip.Trigger asChild>
            <Tag
              className={clsx(
                // A solid hairline, not `decoration-dotted`, and the reason is that a dotted
                // rule under a single small word is the browser's own spelling-error mark.
                // A reviewer reading the ≥1180px top bar took `Derash` and `Lashon` for
                // misspellings — which is a bad first impression to make with the two words the
                // product most needs to be trusted on. Nothing else about the affordance
                // changed: it is still the "there is more to this term" signal, still muted,
                // still paired with `cursor-default` and the tooltip.
                "block max-w-full cursor-default truncate underline decoration-solid decoration-1 decoration-[var(--color-border-strong)] underline-offset-4 focus-visible:outline-none",
                !compact && "w-fit",
              )}
              aria-describedby={descId}
              tabIndex={0}
            >
              {entry.term}
            </Tag>
          </Tooltip.Trigger>
          <span id={descId} className={clsx("gloss-subtitle", compact && "gloss-subtitle--compact")}>
            {entry.gloss}
          </span>
        </span>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 max-w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 font-serif text-[var(--text-sm)] italic text-[var(--color-ink-muted)] shadow-[var(--shadow-md)]"
            sideOffset={8}
          >
            {entry.gloss}
            <Tooltip.Arrow className="fill-[var(--color-bg-raised)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
