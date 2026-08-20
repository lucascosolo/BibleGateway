"use client";

import Link from "next/link";
import clsx from "clsx";
import { WORKSPACES, type Workspace } from "./workspaces";
import { WORKSPACE_ICONS } from "./icons";
import { GlossLabel } from "@/components/GlossLabel";
import { LayerControlsTab } from "./LayerControls";
import { PlannedMarker, plannedSrText } from "./PlannedMarker";

/**
 * <768px: single column, bottom tab bar. Touch targets are the full 56px-tall cell.
 *
 * `min-w-0` on each item (not a fixed `min-w-[touch-target]`) is load-bearing: without it a
 * flex item's default `min-width: auto` keeps it as wide as its content demands, which is
 * exactly what let five labels collide at 320px — `truncate` on the inner text never got a
 * chance to fire because the item itself refused to shrink below its content width first. The
 * 44px touch target still holds because each cell is a fifth of the bar's own width (≥56px
 * even at 320px), independent of the label's rendered width.
 *
 * Uses the same biblical-vocabulary term as the rail and top tabs (`GlossLabel`, `compact`) —
 * previously this rendered `plainLabel` unconditionally, so a user who had switched everything
 * else to "Toledot"/"Geniza"/"Massa'ot" still saw "Timeline"/"Manuscripts"/"Atlas" here.
 */
export function BottomTabBar({ active }: { active: Workspace["key"] }) {
  return (
    <nav
      aria-label="Workspaces"
      data-chrome
      className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--shell-tabbar-height)] border-t border-[var(--color-border)] bg-[var(--color-bg-raised)] pb-[env(safe-area-inset-bottom)]"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      {WORKSPACES.map((ws) => {
        const Icon = WORKSPACE_ICONS[ws.icon];
        const isActive = ws.key === active;
        return (
          <Link
            key={ws.key}
            href={ws.href}
            aria-current={isActive ? "page" : undefined}
            className={clsx(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[10px] leading-tight font-medium",
              isActive ? "text-[var(--color-brand-strong)]" : "text-[var(--color-ink-faint)]",
            )}
          >
            <span className="relative flex shrink-0">
              <Icon className="h-5 w-5" />
              {ws.status === "planned" && <PlannedMarker />}
            </span>
            {ws.lexiconId ? (
              <GlossLabel id={ws.lexiconId} compact className="w-full items-center text-center" />
            ) : (
              <span className="w-full truncate text-center">{ws.plainLabel}</span>
            )}
            {ws.status === "planned" && <span className="sr-only">{plannedSrText(ws.phase)}</span>}
          </Link>
        );
      })}
      <LayerControlsTab />
    </nav>
  );
}
