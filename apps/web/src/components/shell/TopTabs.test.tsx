// The tablet top tabs. The one structural rule here: each tab is ONE interactive element. The
// term used to be a focusable Radix tooltip trigger nested inside the link — a second tab stop
// per tab, and on a tablet the tap on the word went to it instead of to the link.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/derash",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { TopTabs } from "./TopTabs";
import { getLexiconEntry } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";

afterEach(() => {
  cleanup();
  usePreferencesStore.setState({ plainLabels: false });
});

describe("TopTabs", () => {
  it("renders every tab as a single interactive element: nothing focusable inside the link", () => {
    render(<TopTabs active="derash" />);
    const nav = screen.getByRole("navigation", { name: "Workspaces" });
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const link of links) {
      expect(link.querySelectorAll("[tabindex], a, button").length).toBe(0);
    }
  });

  it("puts the gloss in the link's accessible name and the tooltip on the link itself", () => {
    render(<TopTabs active="derash" />);
    const nav = screen.getByRole("navigation", { name: "Workspaces" });
    const entry = getLexiconEntry("derash");
    const derash = within(nav).getAllByRole("link").find((l) => l.getAttribute("href") === "/derash")!;
    expect(derash.textContent).toContain(entry.term);
    expect(derash.textContent).toContain(entry.gloss);
    // Radix marks its trigger with data-state; it must be the link, not a span inside it.
    expect(derash.getAttribute("data-state")).toBe("closed");
    expect(derash.getAttribute("aria-current")).toBe("page");
  });

  it("drops the tooltip and the term when Plain labels is on", () => {
    usePreferencesStore.setState({ plainLabels: true });
    render(<TopTabs active="derash" />);
    const nav = screen.getByRole("navigation", { name: "Workspaces" });
    const derash = within(nav).getAllByRole("link").find((l) => l.getAttribute("href") === "/derash")!;
    expect(derash.textContent).toContain(getLexiconEntry("derash").plainLabel);
    expect(derash.textContent).not.toContain("Derash");
    expect(derash.hasAttribute("data-state")).toBe(false);
  });
});
