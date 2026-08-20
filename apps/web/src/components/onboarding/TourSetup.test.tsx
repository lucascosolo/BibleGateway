import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TourSetup } from "./TourSetup";
import { layerRows } from "@/components/shell/LayerControls";
import { PREFERENCES_STORAGE_KEY, usePreferencesStore } from "@/lib/store/preferences";

/**
 * What these tests are actually protecting.
 *
 * The setup screen's whole claim is that it configures *the app*, not a first-run copy of it.
 * That claim is only worth anything if flipping a control here writes the same preference the
 * reading panel writes, to the same persisted key. So the assertions read the store, not the
 * DOM, wherever the question is "did this change the setting".
 *
 * The second thing worth pinning is the failure path. This panel lives inside a modal with a
 * focus trap; a fetch that never resolves would leave a section permanently blank inside a
 * dialog the reader cannot see past. The list must degrade to a sentence, not a void.
 */

const TRANSLATIONS = [
  { translationId: 1, code: "WEB", name: "World English Bible", language: "en", license: "PD", copyrightNotice: "", scope: "all", scopeNote: "" },
  { translationId: 5, code: "JPS", name: "JPS 1917", language: "en", license: "PD", copyrightNotice: "", scope: "OT", scopeNote: "Hebrew Bible only — no New Testament." },
];

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  usePreferencesStore.getState().resetSettings();
});

afterEach(() => {
  // Explicit, because this project does not set vitest `globals: true` and testing-library only
  // registers its automatic `afterEach(cleanup)` when it can see a global `afterEach`. Without
  // it every render stacks in the same document and `getByRole` starts finding the previous
  // test's controls — which fails as "multiple elements", not as anything resembling the real
  // cause. See `BottomSheet.test.tsx`, which paid for this first.
  cleanup();
  vi.unstubAllGlobals();
});

describe("TourSetup", () => {
  it("writes through to the real preferences store, not a draft", async () => {
    stubFetch({ translations: TRANSLATIONS });
    render(<TourSetup />);

    expect(usePreferencesStore.getState().layers.interlinear).toBe(false);
    fireEvent.click(screen.getByRole("switch", { name: /Original language/ }));
    expect(usePreferencesStore.getState().layers.interlinear).toBe(true);
  });

  it("offers every layer the production settings panel offers", async () => {
    stubFetch({ translations: TRANSLATIONS });
    render(<TourSetup />);

    // Imported from `LayerControls`, so a layer added there and forgotten here fails this.
    for (const row of layerRows(false)) {
      expect(screen.getByRole("switch", { name: new RegExp(row.label) })).toBeTruthy();
    }
  });

  it("sets the default translation and surfaces a partial scope", async () => {
    stubFetch({ translations: TRANSLATIONS });
    render(<TourSetup />);

    const jps = await screen.findByRole("radio", { name: /JPS 1917/ });
    // A reader choosing an Old-Testament-only edition as their default is told so here rather
    // than discovering it when they open John.
    expect(jps.textContent).toContain("Hebrew Bible only");

    fireEvent.click(jps);
    expect(usePreferencesStore.getState().translation).toBe("JPS");
  });

  it("degrades to a sentence when the translation list cannot be loaded", async () => {
    stubFetch({}, false);
    render(<TourSetup />);

    await waitFor(() => {
      expect(screen.getByText(/could not be loaded/)).toBeTruthy();
    });
    // Still names the reader's current setting, so the section is never an empty box.
    expect(screen.getByText("WEB")).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Default translation" })).toBeNull();
  });

  it("restores defaults without touching what the reader has read", async () => {
    stubFetch({ translations: TRANSLATIONS });
    usePreferencesStore.getState().setLastRead({ slug: "John.3", label: "John 3", translationCode: "WEB" });
    render(<TourSetup />);

    fireEvent.click(screen.getByRole("switch", { name: /Original language/ }));
    fireEvent.click(screen.getByRole("switch", { name: /Plain labels/ }));
    expect(usePreferencesStore.getState().plainLabels).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));

    const state = usePreferencesStore.getState();
    expect(state.layers.interlinear).toBe(false);
    expect(state.plainLabels).toBe(false);
    expect(state.translation).toBe("WEB");
    // `lastRead` is a record of an action, not a setting. And `tourSeen` must survive, or the
    // button would re-arm the tour to reopen over the reader's next page.
    expect(state.lastRead?.slug).toBe("John.3");
  });

  it("does not re-arm the first-run tour", async () => {
    stubFetch({ translations: TRANSLATIONS });
    usePreferencesStore.getState().setTourSeen(true);
    render(<TourSetup />);

    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(usePreferencesStore.getState().tourSeen).toBe(true);
  });

  it("aborts the in-flight request when the tour is dismissed", async () => {
    const fetchMock = stubFetch({ translations: TRANSLATIONS });
    const { unmount } = render(<TourSetup />);

    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
