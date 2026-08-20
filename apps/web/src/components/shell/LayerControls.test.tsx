// One body, two presentations — and the two things about that which are not observable by eye.
//
// The panel body is identical in both presentations *on purpose*, which means the interesting
// properties cannot be asserted by looking at the body: (1) exactly one presentation mounts at a
// given width, because mounting both and hiding one with CSS is how a panel ends up with two
// independent copies of its own state (`<CrossRefPanel>` already paid for that one), and (2) the
// panel does not repeat its own title inside itself.
//
// (2) had a specific shape worth pinning: the sheet was titled with the Pardes term while the
// body opened with a `<legend>` reading "READING LAYERS" — and "Reading layers" is exactly what
// the Plain labels preference renames Pardes to. With that preference on, the panel said the
// same three words twice, six pixels apart.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LayerControls } from "./LayerControls";
import { usePreferencesStore } from "@/lib/store/preferences";

/** `useBreakpoint` reads `window.innerWidth` once on mount; set it before rendering. */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true, configurable: true });
}

afterEach(() => {
  cleanup();
  usePreferencesStore.setState({ plainLabels: false, selahMode: false });
});

describe("<LayerControls> presentation", () => {
  it("opens a bottom sheet below 768px", () => {
    setViewportWidth(390);
    render(<LayerControls />);
    fireEvent.click(screen.getByRole("button", { name: "Pardes" }));

    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].dataset.surface).toBe("sheet");
  });

  it("opens a panel anchored to its trigger at 768px and up", () => {
    setViewportWidth(1366);
    render(<LayerControls />);
    fireEvent.click(screen.getByRole("button", { name: "Pardes" }));

    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].dataset.surface).toBe("anchored");
  });

  it("does not repeat its own title inside the panel", () => {
    setViewportWidth(1366);
    usePreferencesStore.setState({ plainLabels: true });
    render(<LayerControls />);
    fireEvent.click(screen.getByRole("button", { name: "Reading layers" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("Reading layers")).toHaveLength(1);
  });

  it("exposes Selah inside the panel, so it is reachable where the chrome has no Selah cell", () => {
    // The bottom tab bar (<768px) has no Selah control at all. The panel used to *describe*
    // Selah being on without offering any way to turn it off.
    setViewportWidth(390);
    render(<LayerControls />);
    fireEvent.click(screen.getByRole("button", { name: "Pardes" }));

    const dialog = screen.getByRole("dialog");
    // Anchored to the start of the accessible name: the "Plain labels" row's own description
    // names Selah too ("Swaps Selah, Masora, Testimonia…"), so a loose /Selah/ matches both.
    const selah = within(dialog).getByRole("switch", { name: /^Selah/ });
    expect(selah.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(selah);
    expect(usePreferencesStore.getState().selahMode).toBe(true);
  });
});
