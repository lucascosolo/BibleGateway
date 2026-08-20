"use client";

import Link from "next/link";
import clsx from "clsx";
import { WORKSPACES, type Workspace } from "./workspaces";
import { WORKSPACE_ICONS } from "./icons";
import { GlossLabel } from "@/components/GlossLabel";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "./ThemeToggle";
import { LayerControls } from "./LayerControls";
import { PlannedMarker, plannedSrText } from "./PlannedMarker";

/** 768–1279px: two panes, tabs move to the top. */
export function TopTabs({ active }: { active: Workspace["key"] }) {
  return (
    <header
      data-chrome
      className="sticky top-0 z-40 flex h-[var(--shell-toptabs-height)] items-center gap-6 border-b border-[var(--color-border)] bg-[var(--color-bg-raised)] px-5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <Link href="/" aria-label="Jot home" className="shrink-0">
        <Wordmark size="sm" />
      </Link>
      <nav
        aria-label="Workspaces"
        className="flex h-full min-w-0 flex-1 items-stretch gap-1 overflow-x-auto"
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
                "flex h-full shrink-0 items-center gap-2 border-b-2 px-2.5 text-[var(--text-sm)] font-medium whitespace-nowrap",
                isActive
                  ? "border-[var(--color-brand)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              <span className="relative flex shrink-0">
                <Icon className="h-4 w-4" />
                {ws.status === "planned" && <PlannedMarker />}
              </span>
              {ws.lexiconId ? (
                <GlossLabel id={ws.lexiconId} compact />
              ) : (
                <span>{ws.plainLabel}</span>
              )}
              {ws.status === "planned" && <span className="sr-only">{plannedSrText(ws.phase)}</span>}
            </Link>
          );
        })}
      </nav>
      {/* Selah is NOT a second pill here, and that is a measurement rather than a preference.
          This bar is one fixed 52px row: wordmark + three workspace tabs + controls. The
          workspace nav needs 308px to show all three tabs; at 768px, two labelled pills plus
          the theme radiogroup take 413px (536px with Plain labels on, which lengthens every
          term), which leaves the nav 232px / 109px and scrolls Derash and Roadmap out of sight.
          Clipping primary navigation to fit a reading toggle is the wrong trade, and the
          alternative — dropping the pills back to bare icons — is the exact defect that made
          the feather button unreadable in the first place.
          So one labelled trigger, and Selah is the first row inside the panel it opens, with a
          switch and its full gloss. That is also how the phone reaches it (the bottom tab bar
          has never had a Selah cell), so tablet and phone now agree. The ≥1280px rail keeps its
          own Selah cell because a vertical rail has the room a horizontal bar does not. */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <LayerControls compact />
        <ThemeToggle />
      </div>
    </header>
  );
}
