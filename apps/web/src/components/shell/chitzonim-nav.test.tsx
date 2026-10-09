import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { BottomTabBar } from "./BottomTabBar";
import { MoreSheet } from "./MoreSheet";
import { NavRail } from "./NavRail";
import { TopTabs } from "./TopTabs";
import { COLLAPSED_WORKSPACE_KEYS, WORKSPACES } from "./workspaces";
import { WORKSPACE_ICONS } from "./icons";
import { getLexiconEntry } from "@/lib/lexicon";

afterEach(cleanup);

const hrefs = (root: HTMLElement) => within(root).queryAllByRole("link").map((l) => l.getAttribute("href"));

describe("chitzonim lexicon entry", () => {
  it("has term, plain label and gloss", () => {
    const e = getLexiconEntry("chitzonim" as never);
    expect(e.term).toBe("Chitzonim");
    expect(e.plainLabel).toBe("Outside books");
    expect(e.gloss).toBe("The outside books: writings beside the Bible that some communities read and others set aside");
  });
});

describe("chitzonim workspace", () => {
  const ws = WORKSPACES.find((w) => w.key === "chitzonim");
  it("is registered, collapsed and has an icon", () => {
    expect(ws).toBeDefined();
    expect(ws!.href).toBe("/chitzonim");
    expect(ws!.lexiconId).toBe("chitzonim");
    expect(COLLAPSED_WORKSPACE_KEYS.has("chitzonim")).toBe(true);
    expect(WORKSPACE_ICONS[ws!.icon]).toBeDefined();
  });
});

describe("navigation surfaces", () => {
  it("NavRail links to /chitzonim", () => {
    const { container } = render(<NavRail active="read" />);
    expect(hrefs(container)).toContain("/chitzonim");
  });
  it("TopTabs links to /chitzonim", () => {
    const { container } = render(<TopTabs active="read" />);
    expect(hrefs(container)).toContain("/chitzonim");
  });
  it("MoreSheet links to /chitzonim", () => {
    render(<MoreSheet open active="read" onClose={() => {}} onOpenLayers={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "More" });
    expect(hrefs(dialog)).toContain("/chitzonim");
  });
  it("BottomTabBar keeps five cells and no chitzonim link of its own", () => {
    Object.defineProperty(window, "innerWidth", { value: 390, writable: true, configurable: true });
    render(<BottomTabBar active="read" />);
    const nav = screen.getByRole("navigation", { name: "Workspaces" });
    expect(hrefs(nav)).not.toContain("/chitzonim");
    expect(nav.querySelectorAll("[data-tab-cell]")).toHaveLength(5);
  });
});
