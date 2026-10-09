import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { workspaceForPath } from "./AppShell";
import { BottomTabBar } from "./BottomTabBar";
import { NavRail } from "./NavRail";
import { TopTabs } from "./TopTabs";

afterEach(cleanup);

const current = () =>
  screen.queryAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");

describe("workspaceForPath", () => {
  it.each([
    ["/", "home"],
    ["/read/Gen.1", "read"],
    ["/read", "read"],
    ["/derash", "derash"],
    ["/lashon/H1234", "lashon"],
    ["/support/thanks", "read"],
    ["/roadmap", "read"],
    [null, "read"],
    ["/read/Sir.1", "chitzonim"],
    ["/read/1Macc.2.3-5", "chitzonim"],
    ["/read/Wisdom%20of%20Solomon%201", "chitzonim"],
    ["/read/Herm.101", "chitzonim"],
    ["/read/Sirach%20prologue", "chitzonim"],
    ["/read/John.3", "read"],
    ["/read/1John.2", "read"],
    ["/read/Jude", "read"],
  ])("%s -> %s", (path, key) => {
    expect(workspaceForPath(path as string | null)).toBe(key);
  });
});

describe("shell navigation at the home route", () => {
  it("BottomTabBar marks only the home link current", () => {
    render(<BottomTabBar active={workspaceForPath("/")} />);
    const nav = screen.getByRole("navigation", { name: "Workspaces" });
    const links = within(nav).getAllByRole("link");
    expect(links.find((l) => l.getAttribute("href") === "/")?.getAttribute("aria-current")).toBe("page");
    expect(links.find((l) => l.getAttribute("href") === "/read")?.getAttribute("aria-current")).toBeNull();
    expect(current()).toHaveLength(1);
  });

  it("NavRail marks no link current except one to /", () => {
    render(<NavRail active={workspaceForPath("/")} />);
    for (const l of current()) expect(l.getAttribute("href")).toBe("/");
  });

  it("TopTabs marks no link current except one to /", () => {
    render(<TopTabs active={workspaceForPath("/")} />);
    for (const l of current()) expect(l.getAttribute("href")).toBe("/");
  });
});

describe("BottomTabBar on a reading route", () => {
  it("marks /read current and / not", () => {
    render(<BottomTabBar active={workspaceForPath("/read/Gen.1")} />);
    const nav = screen.getByRole("navigation", { name: "Workspaces" });
    const links = within(nav).getAllByRole("link");
    expect(links.find((l) => l.getAttribute("href") === "/read")?.getAttribute("aria-current")).toBe("page");
    expect(links.find((l) => l.getAttribute("href") === "/")?.getAttribute("aria-current")).toBeNull();
  });
});

describe("an outside book in the reader", () => {
  const active = workspaceForPath("/read/Sir.1");
  const chitzonim = () => current().map((l) => l.getAttribute("href"));

  it("NavRail marks Chitzonim, not Read", () => {
    render(<NavRail active={active} />);
    expect(chitzonim()).toEqual(["/chitzonim"]);
  });
  it("TopTabs marks Chitzonim, not Read", () => {
    render(<TopTabs active={active} />);
    expect(chitzonim()).toEqual(["/chitzonim"]);
  });
  it("the phone bar's More cell names Chitzonim as current", () => {
    render(<BottomTabBar active={active} />);
    expect(screen.getByRole("button", { name: /^More, current page/ })).toBeTruthy();
    expect(current().map((l) => l.getAttribute("href"))).not.toContain("/read");
  });
});
