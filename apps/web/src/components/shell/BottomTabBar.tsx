"use client";

import Link from "next/link";
import clsx from "clsx";
import { WORKSPACES, HOME_WORKSPACE, type Workspace } from "./workspaces";
import { WORKSPACE_ICONS } from "./icons";
import { GlossLabel } from "@/components/GlossLabel";
import { LayerControlsTab } from "./LayerControls";
import { PlannedMarker, plannedSrText } from "./PlannedMarker";

// Home isn't in `WORKSPACES` itself (see the note on `HOME_WORKSPACE`) — it's spliced into the
// exact centre of the bar's own render order, so the raised tab sits under the thumb's resting
// position whatever the workspace count. The bar also ends in the layer-controls cell
// (`<LayerControlsTab>`), which counts: five workspaces plus that cell make six, so home goes
// after the third and is the fourth of seven.
const HOME_AT = Math.ceil((WORKSPACES.length + 1) / 2);
const TABS: Workspace[] = [...WORKSPACES.slice(0, HOME_AT), HOME_WORKSPACE, ...WORKSPACES.slice(HOME_AT)];

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
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[10px] leading-tight",
                isActive ? "font-semibold text-[var(--color-brand-strong)]" : "font-medium text-[var(--color-ink-faint)]",
              )}
            >
              {/* The current workspace gets a filled pill behind its icon, not only a colour
                  change: at 10px a tint alone is hard to tell from the resting state. */}
              <span
                className={clsx(
                  "relative flex shrink-0 items-center justify-center rounded-[var(--radius-full)] px-2.5 py-0.5 transition-colors",
                  isActive ? "bg-[var(--color-brand-soft)]" : "bg-transparent",
                )}
              >
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
      {/* On the home page the button lights up: the lighter brand fill and a brand halo
          (`--shadow-glow-brand`) instead of the resting shadow. The 48px box and the icon do
          not change size, so nothing beside it moves. */}
      <span
        className={clsx(
          "-mt-2 flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] text-[var(--color-ink-on-accent)] transition-[background-color,box-shadow]",
          isActive ? "bg-[var(--color-brand)]" : "bg-[var(--color-brand-strong)]",
        )}
        style={{ boxShadow: isActive ? "var(--shadow-glow-brand)" : "var(--shadow-md)" }}
      >
        <Icon className="h-6 w-6" />
      </span>
    </Link>
  );
}
