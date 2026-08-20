"use client";

import clsx from "clsx";
import { useId } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

import { HEAT_EXPLAINER, heatBucketInfo } from "@/lib/crossrefs/heat";

/**
 * The heat affordance — meant to sit right next to the reader's heat markers (`.verse--heat`
 * in reader.css) and answer "what does this dot mean" honestly.
 *
 * Reference density is not the same thing as importance, and this component says so every
 * time it is used: a highly-quoted verse runs hot, a foundational verse nobody happens to
 * cross-reference does not. See `lib/crossrefs/heat.ts` for the full rationale.
 */

export interface HeatBadgeProps {
  bucket: number;
  inboundCount?: number;
  weightedScore?: number;
  className?: string;
}

export function HeatBadge({ bucket, inboundCount, weightedScore, className }: HeatBadgeProps) {
  const info = heatBucketInfo(bucket);
  const descId = useId();

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-describedby={descId}
            className={clsx(
              "inline-flex min-h-[var(--touch-target)] min-w-[var(--touch-target)] items-center justify-center gap-1 rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-2 text-[var(--text-xs)] text-[var(--color-ink-muted)]",
              className
            )}
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--color-heat-high)", opacity: bucket === 0 ? 0.15 : bucket / 5 }}
            />
            {info.label}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            id={descId}
            className="z-50 max-w-72 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-3 py-2 font-sans text-[var(--text-sm)] text-[var(--color-ink)] shadow-[var(--shadow-md)]"
            sideOffset={8}
          >
            <p className="font-medium">
              {info.label} (bucket {bucket}/5)
            </p>
            <p className="mt-1 text-[var(--color-ink-muted)]">{info.description}</p>
            <p className="mt-2 text-[var(--color-ink-faint)]">{HEAT_EXPLAINER}</p>
            {(inboundCount !== undefined || weightedScore !== undefined) && (
              <p className="mt-2 font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">
                {inboundCount !== undefined && `${inboundCount} inbound`}
                {inboundCount !== undefined && weightedScore !== undefined && " · "}
                {weightedScore !== undefined && `${weightedScore} vote-weighted`}
              </p>
            )}
            <Tooltip.Arrow className="fill-[var(--color-bg-raised)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
