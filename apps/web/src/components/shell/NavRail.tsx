"use client";

import Link from "next/link";
import clsx from "clsx";
import { WORKSPACES, type Workspace } from "./workspaces";
import { WORKSPACE_ICONS } from "./icons";
import { GlossLabel } from "@/components/GlossLabel";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "./ThemeToggle";
import { SelahToggle } from "./SelahToggle";
import { LayerControls } from "./LayerControls";
import { PlannedMarker, plannedSrText } from "./PlannedMarker";
import { TourLauncher } from "@/components/onboarding/TourLauncher";

/** ≥1280px: left nav rail + content + right sidebar slot. */
export function NavRail({ active }: { active: Workspace["key"] }) {
  return (
    <aside
      data-chrome
      className="sticky top-0 flex h-dvh w-[var(--shell-rail-width)] shrink-0 flex-col items-center gap-6 border-r border-[var(--color-border)] bg-[var(--color-bg-raised)] py-5"
      aria-label="Primary"
    >
      <Link href="/" aria-label="Jot home">
        <Wordmark size="sm" />
      </Link>
      <nav aria-label="Workspaces" className="flex w-full flex-1 flex-col items-center gap-1 px-1.5">
        {WORKSPACES.map((ws) => {
          const Icon = WORKSPACE_ICONS[ws.icon];
          const isActive = ws.key === active;
          return (
            <Link
              key={ws.key}
              href={ws.href}
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                // `w-full` inside a padded rail, with wrapping labels: a fixed width silently
                // clips or overflows the moment a workspace is renamed.
                "group relative flex w-full flex-col items-center gap-1 rounded-[var(--radius-md)] px-1 py-2.5 text-center text-[0.6875rem] leading-tight font-medium break-words hyphens-auto",
                isActive
                  ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)]",
              )}
            >
              <span className="relative flex">
                <Icon className="h-5 w-5" />
                {ws.status === "planned" && <PlannedMarker />}
              </span>
              {ws.lexiconId ? (
                // `compact`, matching the top tabs. Without it the gloss renders as a permanent
                // second line, and on a coarse pointer — a large tablet in landscape gets this
                // rail — a 5.75rem column turned Derash's gloss into twelve hyphenated lines of
                // italic: "not origi- / nal-lan- / guage or se- / mantic search." Twelve lines
                // of footnote under one icon, and the loudest thing on the page.
                // The gloss is not lost: it is the tooltip on hover and the accessible
                // description always. The reachable-on-touch version of it is "Plain labels",
                // which replaces the term outright and lives one tap away in the panel below.
                <GlossLabel id={ws.lexiconId} className="items-center text-center" compact />
              ) : (
                <span>{ws.plainLabel}</span>
              )}
              {ws.status === "planned" && <span className="sr-only">{plannedSrText(ws.phase)}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="flex w-full flex-col items-center gap-3 px-1.5">
        {/* `stack` because the rail is 5.75rem wide: a horizontal pill fits "Selah" and not
            "Reading mode", which is what the Plain labels preference renames it to. */}
        <SelahToggle compact layout="stack" />
        <LayerControls compact layout="stack" />
        {/* The way back into the guided tour. Beside the reading controls rather than in the
            workspace list above, because it is not a place — it is help about the places. */}
        <TourLauncher variant="rail" />
        <ThemeToggle className="flex-col rounded-[var(--radius-lg)]" />
      </div>
    </aside>
  );
}
