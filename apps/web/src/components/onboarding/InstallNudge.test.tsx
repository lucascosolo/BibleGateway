import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuidedTour } from "./GuidedTour";
import { InstallNudge } from "./InstallNudge";
import { useInstallPromptStore } from "./install";
import { TOUR_STEPS } from "./tour-steps";
import { usePreferencesStore } from "@/lib/store/preferences";
import { useTourStore } from "@/lib/store/tour";

afterEach(() => {
  cleanup();
  usePreferencesStore.setState({ tourSeenVersion: 0 });
  useTourStore.setState({ open: false, startStepId: null });
  useInstallPromptStore.setState({ deferred: null });
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "standalone");
});

const HEADING = "Keep Jot on your home screen";
const nudge = () => screen.queryByRole("heading", { level: 2, name: HEADING });
const seen = (v: number) => usePreferencesStore.setState({ tourSeenVersion: v });

function capturePrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const ev = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(ev, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  act(() => {
    window.dispatchEvent(ev);
  });
  return prompt;
}

describe("<InstallNudge>", () => {
  it("shows a non-modal card to a version-1 reader", () => {
    seen(1);
    render(<InstallNudge />);
    expect(nudge()).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show me how" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[aria-modal]")).toBeNull();
  });

  it.each([0, 2])("is absent at tourSeenVersion %i", (v) => {
    seen(v);
    render(<InstallNudge />);
    expect(nudge()).toBeNull();
  });

  it("is absent for a version-1 reader who already installed", () => {
    seen(1);
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    render(<InstallNudge />);
    expect(nudge()).toBeNull();
  });

  it("Dismiss hides it and records version 2", () => {
    seen(1);
    render(<InstallNudge />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(nudge()).toBeNull();
    expect(usePreferencesStore.getState().tourSeenVersion).toBe(2);
  });

  it("Show me how opens the tour at the install step and retires the nudge", () => {
    seen(1);
    render(
      <>
        <GuidedTour />
        <InstallNudge />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show me how" }));
    expect(usePreferencesStore.getState().tourSeenVersion).toBe(2);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: TOUR_STEPS.find((s) => s.id === "install")!.title })).toBeTruthy();
    expect(nudge()).toBeNull();
  });

  it("swaps Show me how for Install when a prompt is captured, and Install fires it", () => {
    seen(1);
    render(<InstallNudge />);
    const prompt = capturePrompt();
    expect(screen.queryByRole("button", { name: "Show me how" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(usePreferencesStore.getState().tourSeenVersion).toBe(2);
  });
});
