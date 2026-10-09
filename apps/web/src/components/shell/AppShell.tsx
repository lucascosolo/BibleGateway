"use client";

import { usePathname } from "next/navigation";
import { useBreakpoint } from "@/lib/capability";
import { BottomTabBar } from "./BottomTabBar";
import { TopTabs } from "./TopTabs";
import { NavRail } from "./NavRail";
import { isOutsideBookName } from "@/lib/refs/book-index";
import { HOME_WORKSPACE, WORKSPACES, type Workspace } from "./workspaces";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { InstallNudge } from "@/components/onboarding/InstallNudge";
import { CommandPalette } from "./CommandPalette";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { SiteFooter } from "./SiteFooter";

interface AppShellProps {
  children: React.ReactNode;
  /** Which workspace is active. Inferred from the current path when omitted. */
  active?: Workspace["key"];
  /** Content for the right sidebar slot, shown only at ≥1280px (§4.2 <ContextSidebar/>). */
  sidebar?: React.ReactNode;
}

/** The book part of a /read/<ref> slug: "1Macc.2.3" -> "1Macc", "Herm.Vision.2" -> "Herm". */
function readSlugBook(pathname: string): string | null {
  const m = pathname.match(/^\/read\/([^/?#]+)/);
  if (!m) return null;
  let slug: string;
  try { slug = decodeURIComponent(m[1]); } catch { return null; }
  const book = slug.match(/^\s*([1-4]?[\s.]*[A-Za-z][A-Za-z\s']*)/)?.[1];
  return book?.replace(/\s+(vision|vis|mandate|mand|parable|similitude|sim|prol|prologue)\s*$/i, "") ?? null;
}

/**
 * The workspace a path belongs to: "/" is Home, an unknown path falls back to Read. A /read/<ref>
 * for an outside book belongs to Chitzonim; the book is named from the static alias table, so the
 * server render agrees with the client and the shell never touches the database.
 */
export function workspaceForPath(pathname: string | null): Workspace["key"] {
  if (pathname === HOME_WORKSPACE.href) return HOME_WORKSPACE.key;
  const book = pathname ? readSlugBook(pathname) : null;
  if (book && isOutsideBookName(book)) return "chitzonim";
  const match = WORKSPACES.find((ws) => pathname?.startsWith(ws.href));
  return match?.key ?? "read";
}

function useActiveWorkspace(explicit?: Workspace["key"]): Workspace["key"] {
  const pathname = usePathname();
  return explicit ?? workspaceForPath(pathname);
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
      {/* Once, beside the tour: it also holds the captured install prompt for the whole visit. */}
      <InstallNudge />
      <CommandPalette />
      {/* Same reasoning as the tour: mounted once, outside the breakpoint branch, because the
          `<audio>` element inside it must survive both a width change and a client navigation
          from one chapter to the next. */}
      <AudioPlayer />
      <Shell breakpoint={breakpoint} active={active} sidebar={sidebar}>
        {children}
        <SiteFooter />
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
