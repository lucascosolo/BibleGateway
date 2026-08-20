"use client";

import { usePathname } from "next/navigation";
import { useBreakpoint } from "@/lib/capability";
import { BottomTabBar } from "./BottomTabBar";
import { TopTabs } from "./TopTabs";
import { NavRail } from "./NavRail";
import { WORKSPACES, type Workspace } from "./workspaces";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { CommandPalette } from "./CommandPalette";

interface AppShellProps {
  children: React.ReactNode;
  /** Which workspace is active. Inferred from the current path when omitted. */
  active?: Workspace["key"];
  /** Content for the right sidebar slot, shown only at ≥1280px (§4.2 <ContextSidebar/>). */
  sidebar?: React.ReactNode;
}

function useActiveWorkspace(explicit?: Workspace["key"]): Workspace["key"] {
  const pathname = usePathname();
  if (explicit) return explicit;
  const match = WORKSPACES.find((ws) => pathname?.startsWith(ws.href));
  return match?.key ?? "read";
}

/**
 * The responsive app shell (ARCHITECTURE.md §4.7).
 *   <768:      bottom tab bar, single column.
 *   768–1279:  top tabs, two panes.
 *   ≥1280:     left nav rail + content + right sidebar slot.
 * `useBreakpoint` is SSR-safe (see lib/capability.ts): the server and first
 * client paint both render the phone shell, then it corrects after mount.
 */
export function AppShell({ children, active: explicitActive, sidebar }: AppShellProps) {
  const breakpoint = useBreakpoint();
  const active = useActiveWorkspace(explicitActive);

  return (
    <>
      {/* Mounted once, outside the breakpoint branch. Inside it, changing width would unmount
          and remount the dialog and lose the reader's place in the tour. It renders nothing
          until it is opened, and it portals to <body>, so its position in this tree is only
          about lifetime. */}
      <GuidedTour />
      <CommandPalette />
      <Shell breakpoint={breakpoint} active={active} sidebar={sidebar}>
        {children}
      </Shell>
    </>
  );
}

function Shell({
  breakpoint,
  active,
  sidebar,
  children,
}: {
  breakpoint: ReturnType<typeof useBreakpoint>;
  active: Workspace["key"];
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (breakpoint === "desktop") {
    return (
      <div className="flex min-h-dvh">
        <NavRail active={active} />
        <main className="min-w-0 flex-1">{children}</main>
        {sidebar ? (
          <aside
            data-chrome
            className="sticky top-0 h-dvh w-[var(--shell-sidebar-width)] shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)]"
            aria-label="Context panel"
          >
            {sidebar}
          </aside>
        ) : null}
      </div>
    );
  }

  if (breakpoint === "tablet") {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopTabs active={active} />
        <div className="flex flex-1">
          <main className="min-w-0 flex-1">{children}</main>
          {sidebar ? (
            <aside
              data-chrome
              className="w-80 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]"
              aria-label="Context panel"
            >
              {sidebar}
            </aside>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="min-w-0 flex-1 pb-[var(--shell-tabbar-height)]">{children}</main>
      <BottomTabBar active={active} />
    </div>
  );
}
