"use client";

import Link from "next/link";
import clsx from "clsx";
import { WORKSPACES, HOME_WORKSPACE, type Workspace } from "./workspaces";
import { WORKSPACE_ICONS } from "./icons";
import { GlossLabel } from "@/components/GlossLabel";
import { LayerControlsTab } from "./LayerControls";
import { PlannedMarker, plannedSrText } from "./PlannedMarker";

// Home isn't in `WORKSPACES` itself (see the note on `HOME_WORKSPACE`) — it's spliced into the
// middle of the bar's own render order only, between Derash and Lashon.
const TABS: Workspace[] = [...WORKSPACES.slice(0, 2), HOME_WORKSPACE, ...WORKSPACES.slice(2)];

/**
 * <768px: single column, bottom tab bar. Touch targets are the full 56px-tall cell.
 *
 * `min-w-0` on each item (not a fixed `min-w-[touch-target]`) is load-bearing: without it a
 * flex item's default `min-width: auto` keeps it as wide as its content demands, which is
 * exactly what let five labels collide at 320px — `truncate` on the inner text never got a
 * chance to fire because the item itself refused to shrink below its content width first. The
 * 44px touch target still holds because each cell is a fraction of the bar's own width,
 * independent of the label's rendered width.
 *
 * Uses the same biblical-vocabulary term as the rail and top tabs (`GlossLabel`, `compact`) —
 * previously this rendered `plainLabel` unconditionally, so a user who had switched everything
 * else to "Toledot"/"Geniza"/"Massa'ot" still saw "Timeline"/"Manuscripts"/"Atlas" here.
 *
 * The safe-area inset lives on the outer `<nav>`, as padding below a fixed-height inner row —
 * not on the row itself. iOS Safari changes `env(safe-area-inset-bottom)` live as its own
 * toolbar shows and hides; when that padding sat on the same box as the icon row, growing it
 * shrank the row's content height (the box is border-box) and every icon shifted upward. With
 * the row's height fixed and the inset only adding empty space beneath it, the icons never move.
 */
export function BottomTabBar({ active }: { active: Workspace["key"] }) {
  return (
    <nav
      aria-label="Workspaces"
      data-chrome
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg-raised)] pb-[env(safe-area-inset-bottom)]"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <div className="flex h-[var(--shell-tabbar-height)]">
        {TABS.map((ws) => {
          const isActive = ws.key === active;
          if (ws.key === "home") return <HomeTab key={ws.key} ws={ws} isActive={isActive} />;

          const Icon = WORKSPACE_ICONS[ws.icon];
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
      </div>
    </nav>
  );
}

/**
 * The middle tab, raised out of the row into a rounded, brand-colored button rather than a plain
 * icon+label cell — the "always in reach" way back to `/`. Anchored to the row's bottom edge and
 * pulled up past it (`-mt-2` against a shorter-than-row pill) so it reads as elevated above the
 * bar rather than just another cell in it.
 */
function HomeTab({ ws, isActive }: { ws: Workspace; isActive: boolean }) {
  const Icon = WORKSPACE_ICONS[ws.icon];
  return (
    <Link
      href={ws.href}
      aria-current={isActive ? "page" : undefined}
      aria-label="Home"
      className="flex flex-1 items-end justify-center pb-2"
    >
      <span
        className={clsx(
          "-mt-2 flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-brand-strong)] text-[var(--color-ink-on-accent)]",
          isActive && "ring-2 ring-[var(--color-brand)] ring-offset-2 ring-offset-[var(--color-bg-raised)]",
        )}
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <Icon className="h-6 w-6" />
      </span>
    </Link>
  );
}
