"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { WORKSPACES, HOME_WORKSPACE, COLLAPSED_WORKSPACE_KEYS, type Workspace } from "./workspaces";
import { MenuIcon, WORKSPACE_ICONS } from "./icons";
import { GlossLabel, GlossTooltip } from "@/components/GlossLabel";
import { LayerSheet } from "./LayerControls";
import { MoreSheet } from "./MoreSheet";
import { PlannedMarker, plannedSrText } from "./PlannedMarker";
import { getLexiconEntry } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";

// Five cells, no more: the workspaces in `COLLAPSED_WORKSPACE_KEYS` and everything the rail
// carries below its workspace list fold into the More sheet. Home is spliced into the exact
// centre (third of five), so the raised tab sits under the thumb's resting position.
const PRIMARY = WORKSPACES.filter((ws) => !COLLAPSED_WORKSPACE_KEYS.has(ws.key));
const HOME_AT = Math.ceil((PRIMARY.length + 1) / 2);
const TABS: Workspace[] = [...PRIMARY.slice(0, HOME_AT), HOME_WORKSPACE, ...PRIMARY.slice(HOME_AT)];

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement | null>(null);

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
          const link = (
            <Link
              key={ws.key}
              data-tab-cell={ws.key}
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
                <GlossLabel id={ws.lexiconId} compact withinControl className="w-full items-center text-center" />
              ) : (
                <span className="w-full truncate text-center">{ws.plainLabel}</span>
              )}
              {ws.status === "planned" && <span className="sr-only">{plannedSrText(ws.phase)}</span>}
            </Link>
          );
          // The tooltip belongs to the link, never to a span inside it: see `withinControl`.
          return ws.lexiconId ? (
            <GlossTooltip key={ws.key} id={ws.lexiconId}>
              {link}
            </GlossTooltip>
          ) : (
            link
          );
        })}
        <MoreTab
          ref={moreRef}
          active={active}
          expanded={moreOpen}
          onClick={(e) => {
            // Safari does not focus a button on click, and the sheet restores focus to whatever
            // held it on open; without this, closing the sheet drops focus on <body>.
            e.currentTarget.focus();
            setMoreOpen((v) => !v);
          }}
        />
      </div>
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        active={active}
        onOpenLayers={() => setLayersOpen(true)}
      />
      <LayerSheet open={layersOpen} onClose={() => setLayersOpen(false)} anchorRef={moreRef} />
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
      data-tab-cell={ws.key}
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

/**
 * The fifth cell. When the current page is one of the folded workspaces it borrows that
 * workspace's name and the active pill, so the bar still says where the reader is; the name
 * keeps "More" first because the button opens the sheet, and `aria-current` stays on the row
 * inside it, since this button is not the page.
 */
function MoreTab({
  ref,
  active,
  expanded,
  onClick,
}: {
  ref: React.Ref<HTMLButtonElement>;
  active: Workspace["key"];
  expanded: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const current = COLLAPSED_WORKSPACE_KEYS.has(active) ? WORKSPACES.find((ws) => ws.key === active) : undefined;
  const entry = current?.lexiconId ? getLexiconEntry(current.lexiconId) : null;
  const label = !current ? "More" : entry ? (plainLabels ? entry.plainLabel : entry.term) : current.plainLabel;

  return (
    <button
      ref={ref}
      type="button"
      data-tab-cell="more"
      data-active={current ? "true" : undefined}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={current ? `More, current page: ${label}` : "More"}
      onClick={onClick}
      className={clsx(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[10px] leading-tight",
        current ? "font-semibold text-[var(--color-brand-strong)]" : "font-medium text-[var(--color-ink-faint)]",
      )}
    >
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-[var(--radius-full)] px-2.5 py-0.5 transition-colors",
          current ? "bg-[var(--color-brand-soft)]" : "bg-transparent",
        )}
      >
        <MenuIcon className="h-5 w-5" />
      </span>
      <span className="w-full truncate text-center">{label}</span>
    </button>
  );
}
