"use client";

import { useId } from "react";
import clsx from "clsx";
import * as Tooltip from "@radix-ui/react-tooltip";
import { usePreferencesStore } from "@/lib/store/preferences";
import { getLexiconEntry, glossFor } from "@/lib/lexicon";
import { FeatherIcon } from "./icons";

/**
 * Selah — strips every layer for uninterrupted reading.
 *
 * This shipped as a bare feather glyph in both chrome contexts, because `compact` (which both
 * of them pass) suppressed the label *and* `gloss-subtitle--compact` clipped the gloss, and this
 * component renders its own term/gloss pair rather than `<GlossLabel>`, so it never inherited
 * that component's tooltip either. The result was a button with no visible word attached to it
 * at any breakpoint, reported exactly as you would expect: "I suppose the feather button is like
 * a lightweight reading mode? it's not clear what it does until you play with it."
 *
 * Three separate fixes, because it was three separate failures:
 *
 * 1. NAME. The label is always visible now. `compact` no longer means "drop the word", it means
 *    "drop the gloss's permanent second line" — which is a layout constraint (the rail is 92px
 *    wide, the top bar is one 52px row) and was never a reason to ship an unlabeled control.
 *    `layout="stack"` is how the rail fits it: icon over label, the same shape and the same
 *    `break-words hyphens-auto` the workspace cells above it already use, so "Reading mode"
 *    wraps instead of overflowing when Plain labels is on.
 * 2. PURPOSE. The gloss is in a Radix tooltip on the button itself (hover AND focus), not a
 *    `title` — which is invisible to touch, unreachable by keyboard, and unstyleable. It stays
 *    in `aria-describedby` regardless, and on a coarse pointer it is still a visible subtitle.
 *    The full sentence, with a switch, also lives in the Pardes panel, which is reachable at
 *    every breakpoint including the phone.
 * 3. STATE. `aria-pressed` covered assistive tech; sighted users got a hue change and nothing
 *    else, which is WCAG 1.4.1 (colour alone) on the app's single most consequential toggle.
 *    There is a literal ON/OFF chip now. It is `aria-hidden` — `aria-pressed` already announces
 *    the state, and announcing it twice is worse than either.
 */
export function SelahToggle({
  className,
  compact = false,
  layout = "inline",
}: {
  className?: string;
  /** Suppresses the gloss's permanent second line (dense chrome). Never the label. */
  compact?: boolean;
  /** `stack` = icon over label, for the narrow nav rail. `inline` = pill. */
  layout?: "inline" | "stack";
}) {
  const selahMode = usePreferencesStore((s) => s.selahMode);
  const toggleSelahMode = usePreferencesStore((s) => s.toggleSelahMode);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const entry = getLexiconEntry("selah");
  const descId = useId();
  const label = plainLabels ? entry.plainLabel : entry.term;
  const stacked = layout === "stack";

  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <span className={clsx("relative inline-flex flex-col", stacked && "w-full")}>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              aria-pressed={selahMode}
              aria-describedby={descId}
              onClick={toggleSelahMode}
              className={clsx(
                "border font-sans font-medium transition-colors",
                stacked
                  ? "flex min-h-[var(--touch-target)] w-full flex-col items-center gap-1 rounded-[var(--radius-lg)] px-1 py-2 text-center text-[0.6875rem] leading-tight break-words hyphens-auto"
                  : "inline-flex h-11 items-center gap-2 rounded-[var(--radius-full)] px-3.5 text-[var(--text-sm)]",
                selahMode
                  ? "border-[var(--color-rubric)] bg-[var(--color-rubric-soft)] text-[var(--color-rubric-strong)]"
                  : "border-[var(--color-border)] bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)]",
                className,
              )}
            >
              <FeatherIcon className={stacked ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} />
              <span className={stacked ? "w-full" : undefined}>{label}</span>
              {/* Never colour alone. `border-current` rather than a token so the chip's border
                  always pairs with the text colour it sits inside, in both states and both
                  themes, without a fourth contrast pair to sign off. */}
              <span
                aria-hidden="true"
                className="shrink-0 rounded-[var(--radius-sm)] border border-current px-1 py-px text-[10px] font-semibold uppercase leading-none tracking-wide"
              >
                {selahMode ? "On" : "Off"}
              </span>
            </button>
          </Tooltip.Trigger>
          {/* Compact contexts (top tabs, nav rail) have no room for the gloss as a permanent
              second line — same reasoning as GlossLabel's `compact` prop. Unlike before, the
              gloss is not lost with it: the tooltip above opens on focus as well as hover. */}
          <span id={descId} className={clsx("gloss-subtitle", compact && "gloss-subtitle--compact")}>
            {glossFor(entry, plainLabels)}
          </span>
        </span>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 max-w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 font-serif text-[var(--text-sm)] italic text-[var(--color-ink-muted)] shadow-[var(--shadow-md)]"
            sideOffset={8}
          >
            {glossFor(entry, plainLabels)}
            <Tooltip.Arrow className="fill-[var(--color-bg-raised)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
