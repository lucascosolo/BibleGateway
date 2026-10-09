// The phone tab bar: five cells, Home in the middle, and a "More" cell that opens a sheet holding
// everything that no longer fits (Lashon, Notes, the translations page, support, roadmap, the
// planned workspaces, and the two controls that used to live elsewhere: Pardes and the Guide).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { BottomTabBar } from "./BottomTabBar";
import { getLexiconEntry } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";
import { useTourStore } from "@/lib/store/tour";

type Active = Parameters<typeof BottomTabBar>[0]["active"];

/** `useBreakpoint` reads `window.innerWidth` once on mount; set it before rendering. */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true, configurable: true });
}

afterEach(() => {
  cleanup();
  vi.doUnmock("@/lib/support");
  usePreferencesStore.setState({ plainLabels: false, selahMode: false });
  usePreferencesStore.getState().resetSettings();
  useTourStore.getState().closeTour();
});

const nav = () => screen.getByRole("navigation", { name: "Workspaces" });
const moreButton = () => within(nav()).getByRole("button", { name: /^More/ });
const label = (el: HTMLElement) => el.getAttribute("aria-label") ?? el.textContent ?? "";

function renderBar(active: Active = "read") {
  setViewportWidth(390);
  return render(<BottomTabBar active={active} />);
}

function openSheet(active: Active = "read") {
  renderBar(active);
  fireEvent.click(moreButton());
  return screen.getByRole("dialog", { name: "More" });
}

const hrefs = (root: HTMLElement) =>
  within(root).queryAllByRole("link").map((l) => l.getAttribute("href"));
const rowFor = (root: HTMLElement, href: string) =>
  within(root).getAllByRole("link").find((l) => l.getAttribute("href") === href)!;

describe("tab cells", () => {
  it("has five cells in order, with Home third", () => {
    renderBar();
    const cells = [...nav().querySelectorAll("[data-tab-cell]")];
    expect(cells.map((c) => c.getAttribute("data-tab-cell"))).toEqual([
      "read",
      "derash",
      "home",
      "toledot",
      "more",
    ]);
    const home = within(nav()).getByRole("link", { name: "Home" });
    expect(home.getAttribute("href")).toBe("/");
    expect(cells[2] === home || cells[2].contains(home)).toBe(true);
  });

  it("links to neither /lashon nor /notes while the sheet is closed", () => {
    renderBar();
    expect(hrefs(nav())).not.toContain("/lashon");
    expect(hrefs(nav())).not.toContain("/notes");
  });
});

describe("the More cell", () => {
  it("is a plain dialog-opening button named More", () => {
    renderBar("read");
    const more = within(nav()).getByRole("button", { name: "More" });
    expect(more.tagName).toBe("BUTTON");
    expect(more.getAttribute("type")).toBe("button");
    expect(more.getAttribute("aria-haspopup")).toBe("dialog");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(more.textContent?.trim()).toBe("More");
    expect(more.hasAttribute("data-active")).toBe(false);
    expect(more.hasAttribute("aria-current")).toBe(false);
  });

  it("opens exactly one dialog named More and reflects aria-expanded", () => {
    renderBar();
    fireEvent.click(moreButton());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "More" })).toBeTruthy();
    expect(moreButton().getAttribute("aria-expanded")).toBe("true");
  });
});

describe("sheet contents", () => {
  it("lists every destination and the two controls", () => {
    const sheet = openSheet();
    const found = hrefs(sheet);
    for (const h of ["/lashon", "/notes", "/translations", "/support", "/roadmap", "/geniza", "/massaot"]) {
      expect(found).toContain(h);
    }
    expect(within(sheet).getByRole("button", { name: /^Pardes/ })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: /^Guide/ })).toBeTruthy();
  });

  it("names Lashon with its lexicon gloss", () => {
    const sheet = openSheet();
    const name = rowFor(sheet, "/lashon").textContent ?? "";
    expect(name).toContain("Lashon");
    expect(name).toContain(getLexiconEntry("lashon").gloss);
  });

  it("marks the planned workspaces as not yet built", () => {
    const sheet = openSheet();
    for (const h of ["/geniza", "/massaot"]) {
      expect(label(rowFor(sheet, h))).toContain("not yet built");
    }
  });

  it("has a /support link by default", () => {
    const sheet = openSheet();
    expect(hrefs(sheet)).toContain("/support");
  });

  it("omits /support when no support URL is configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/support", () => ({ SUPPORT_URL: "" }));
    // Re-import testing-library too: a reset registry hands the fresh component a second React.
    const rtl = await import("@testing-library/react");
    const { BottomTabBar: Fresh } = await import("./BottomTabBar");
    setViewportWidth(390);
    rtl.render(<Fresh active="read" />);
    const freshNav = rtl.screen.getByRole("navigation", { name: "Workspaces" });
    rtl.fireEvent.click(rtl.within(freshNav).getByRole("button", { name: /^More/ }));
    const sheet = rtl.screen.getByRole("dialog", { name: "More" });
    expect(hrefs(sheet)).not.toContain("/support");
    rtl.cleanup();
    vi.resetModules();
  });
});

describe("sheet actions", () => {
  it("Pardes row swaps More for the Pardes sheet", () => {
    const sheet = openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: /^Pardes/ }));
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Pardes" }).dataset.surface).toBe("sheet");
  });

  it("Guide row opens the tour and closes the sheet", () => {
    const sheet = openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: /^Guide/ }));
    expect(useTourStore.getState().open).toBe(true);
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
  });

  it("a link row closes the sheet", () => {
    const sheet = openSheet();
    fireEvent.click(rowFor(sheet, "/translations"));
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
  });

  it("Escape closes the sheet and returns focus to the More button", () => {
    openSheet();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(moreButton());
  });
});

describe("current page inside More", () => {
  it("shows Lashon on the cell when active", () => {
    renderBar("lashon");
    const more = within(nav()).getByRole("button", { name: "More, current page: Lashon" });
    expect(more.getAttribute("data-active")).toBe("true");
    expect(more.textContent?.trim()).toBe("Lashon");
    expect(more.hasAttribute("aria-current")).toBe(false);
  });

  it("shows Notes in the accessible name when active", () => {
    renderBar("notes");
    expect(within(nav()).getByRole("button", { name: "More, current page: Notes" })).toBeTruthy();
  });

  it("marks only the /lashon row current when Lashon is active", () => {
    const sheet = openSheet("lashon");
    expect(rowFor(sheet, "/lashon").getAttribute("aria-current")).toBe("page");
    expect(rowFor(sheet, "/notes").hasAttribute("aria-current")).toBe(false);
  });

  it("marks no row current when a primary tab is active", () => {
    const sheet = openSheet("read");
    for (const l of within(sheet).getAllByRole("link")) expect(l.hasAttribute("aria-current")).toBe(false);
  });
});
