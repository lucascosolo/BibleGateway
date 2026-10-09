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

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuidedTour } from "./GuidedTour";
import { TourLauncher } from "./TourLauncher";
import { TOUR_STEPS } from "./tour-steps";
import { usePreferencesStore } from "@/lib/store/preferences";
import { useTourStore } from "@/lib/store/tour";
import { useInstallPromptStore } from "./install";
import { SUPPORT_URL } from "@/lib/support";

afterEach(() => {
  cleanup();
  usePreferencesStore.setState({ tourSeenVersion: 0 });
  useTourStore.setState({ open: false, startStepId: null });
  useInstallPromptStore.setState({ deferred: null });
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "standalone");
  Object.defineProperty(navigator, "userAgent", { value: ORIGINAL_UA, configurable: true });
});

const ORIGINAL_UA = navigator.userAgent;
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

function setUA(ua: string) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

function openAt(id: string) {
  act(() => useTourStore.getState().openTour(id));
}

const title = (id: string) => TOUR_STEPS.find((s) => s.id === id)!.title;
const body = () => screen.getByRole("dialog").textContent ?? "";

describe("<GuidedTour>", () => {
  it("opens by itself on a first visit and marks itself seen", () => {
    render(<GuidedTour />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(usePreferencesStore.getState().tourSeenVersion).toBe(2);
  });

  it("does not open again once seen", () => {
    usePreferencesStore.setState({ tourSeenVersion: 2 });
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

describe("<GuidedTour> versioned entry", () => {
  it("does not open for a version-1 reader, who gets the nudge instead", () => {
    usePreferencesStore.setState({ tourSeenVersion: 1 });
    render(<GuidedTour />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ends with the support step then the install step", () => {
    expect(TOUR_STEPS.slice(-2).map((s) => s.id)).toEqual(["support", "install"]);
  });

  it("opens straight at a named step", () => {
    usePreferencesStore.setState({ tourSeenVersion: 2 });
    render(<GuidedTour />);
    openAt("install");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(title("install"));
  });
});

describe("<GuidedTour> support step", () => {
  it("links to the donate page in a new tab", () => {
    usePreferencesStore.setState({ tourSeenVersion: 2 });
    render(<GuidedTour />);
    openAt("support");
    const link = screen.getByRole("link", { name: "Donate with PayPal" });
    expect(link.getAttribute("href")).toBe(SUPPORT_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});

describe("<GuidedTour> install step", () => {
  function renderAtInstall() {
    usePreferencesStore.setState({ tourSeenVersion: 2 });
    render(<GuidedTour />);
    openAt("install");
  }

  it("offers a native Install button once the browser hands over a prompt", () => {
    renderAtInstall();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(ev, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    act(() => {
      window.dispatchEvent(ev);
    });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("says so when already installed (display-mode)", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    renderAtInstall();
    expect(body()).toMatch(/already installed/i);
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it("says so when already installed (navigator.standalone)", () => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    renderAtInstall();
    expect(body()).toMatch(/already installed/i);
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it("tells an iPhone Safari reader to Add to Home Screen, with no Install button", () => {
    setUA(IPHONE_UA);
    renderAtInstall();
    expect(body()).toContain("Add to Home Screen");
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it("gives generic copy for an unknown browser", () => {
    setUA("");
    renderAtInstall();
    expect(body()).toContain("Add to Home Screen");
    expect(body()).toMatch(/install/i);
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
