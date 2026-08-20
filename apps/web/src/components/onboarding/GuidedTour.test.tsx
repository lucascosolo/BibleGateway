// The three promises the guided tour makes, none of which are visible in a screenshot.
//
// 1. It opens by itself exactly once. A tour that reappears after being dismissed is the single
//    worst failure mode this component has, and it is invisible until it happens to a real user
//    on their second visit — by which time the damage is done.
// 2. There is a way out on EVERY step. "There should always be a skip button" was the explicit
//    requirement; a guide missing its exit on one step of nine is a trap that testing by hand
//    would very plausibly miss.
// 3. It is portaled to <body>. Shell chrome is `position: sticky`, sticky always establishes a
//    stacking context, and a dialog rendered inside one paints *under* the page no matter how
//    large its z-index. Two dialogs here have already paid for that lesson; this test stops the
//    third from paying it again.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GuidedTour } from "./GuidedTour";
import { TourLauncher } from "./TourLauncher";
import { TOUR_STEPS } from "./tour-steps";
import { usePreferencesStore } from "@/lib/store/preferences";
import { useTourStore } from "@/lib/store/tour";

afterEach(() => {
  cleanup();
  usePreferencesStore.setState({ tourSeen: false });
  useTourStore.setState({ open: false });
});

describe("<GuidedTour>", () => {
  it("opens by itself on a first visit and marks itself seen", () => {
    render(<GuidedTour />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(usePreferencesStore.getState().tourSeen).toBe(true);
  });

  it("does not open again once seen", () => {
    usePreferencesStore.setState({ tourSeen: true });
    render(<GuidedTour />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays closed after being dismissed, without a remount", () => {
    render(<GuidedTour />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // The store flipping back on its own is the reappearing-tour bug; assert the state, not
    // only the absence of the dialog.
    expect(useTourStore.getState().open).toBe(false);
  });

  it("offers a way out on every single step", () => {
    render(<GuidedTour />);
    for (let i = 0; i < TOUR_STEPS.length; i += 1) {
      const exit = screen.queryByRole("button", { name: "Skip" }) ??
        screen.queryByRole("button", { name: "Close" });
      expect(exit, `no exit on step ${i + 1} (${TOUR_STEPS[i].id})`).toBeTruthy();
      if (i < TOUR_STEPS.length - 1) {
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
      }
    }
  });

  it("walks forward and back through the steps", () => {
    render(<GuidedTour />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(TOUR_STEPS[0].title);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(TOUR_STEPS[1].title);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(TOUR_STEPS[0].title);
  });

  it("portals the dialog to <body>, out of any sticky stacking context", () => {
    const { container } = render(
      // The real mounting site: shell chrome, which is sticky.
      <aside style={{ position: "sticky" }}>
        <GuidedTour />
      </aside>,
    );
    const dialog = screen.getByRole("dialog");
    const chrome = container.querySelector("aside") as HTMLElement;
    expect(chrome.contains(dialog)).toBe(false);
    // The overlay — the dialog's own parent — is a direct child of <body>.
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });

  it("reopens from the launcher after being dismissed, starting at step one", () => {
    render(
      <>
        <GuidedTour />
        <TourLauncher />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(TOUR_STEPS[1].title);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    fireEvent.click(screen.getByRole("button", { name: /guided tour/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(TOUR_STEPS[0].title);
  });
});

describe("tour copy", () => {
  it("links only to routes that exist in this build", () => {
    // A tour step pointing at a 404 sends a first-time reader to an error page. These are the
    // routes under `src/app` that the steps are allowed to name.
    const routes = ["/read", "/derash", "/lashon", "/notes", "/roadmap"];
    for (const step of TOUR_STEPS) {
      if (!step.href) continue;
      expect(
        routes.some((r) => step.href!.startsWith(r)),
        `step "${step.id}" links to ${step.href}, which is not a route in this build`,
      ).toBe(true);
    }
  });

  it("gives every step both a what and a why", () => {
    for (const step of TOUR_STEPS) {
      expect(step.what.length, `step "${step.id}" has no "what"`).toBeGreaterThan(20);
      expect(step.why.length, `step "${step.id}" has no "why"`).toBeGreaterThan(20);
    }
  });
});
