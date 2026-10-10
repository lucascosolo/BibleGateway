import { afterEach, describe, expect, it, vi } from "vitest";

import { PLACE_MAX_AGE_MS, chooseCatalogueView, readPlace, savePlace, settle } from "./place";

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const view = { sort: "book", q: "paul", facets: { axis: "narrative" }, open: { "book-45": false } };

describe("place store", () => {
  it("round-trips a place and merges later patches into it", () => {
    savePlace("/toledot", { scrollLeft: 840, openedId: "exodus" }, 1_000);
    savePlace("/toledot", { viaKeyboard: true }, 2_000);
    expect(readPlace("/toledot", 2_500)).toEqual({ scrollLeft: 840, openedId: "exodus", viaKeyboard: true, savedAt: 2_000 });
  });

  it("keeps each view's place under its own key", () => {
    savePlace("/toledot?era=monarchy", { scrollLeft: 10 }, 1_000);
    savePlace("/toledot/events", { view }, 1_000);
    expect(readPlace("/toledot?era=monarchy", 1_000)?.scrollLeft).toBe(10);
    expect(readPlace("/toledot/events", 1_000)?.view).toEqual(view);
    expect(readPlace("/toledot", 1_000)).toBeNull();
  });

  it("reads nothing and throws nothing when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => savePlace("/toledot", { scrollLeft: 1 })).not.toThrow();
    expect(readPlace("/toledot")).toBeNull();
  });

  it("ignores a stale place, a place from the future and malformed data", () => {
    savePlace("/toledot", { scrollLeft: 5 }, 1_000);
    expect(readPlace("/toledot", 1_000 + PLACE_MAX_AGE_MS + 1)).toBeNull();
    expect(readPlace("/toledot", 500)).toBeNull();
    window.sessionStorage.setItem("jot:timeline-place:v1:/toledot/people", "{not json");
    expect(readPlace("/toledot/people")).toBeNull();
    window.sessionStorage.setItem("jot:timeline-place:v1:/toledot/issues", JSON.stringify({ scrollLeft: 3 }));
    expect(readPlace("/toledot/issues")).toBeNull();
  });
});

describe("chooseCatalogueView", () => {
  const state = { sort: view.sort, q: view.q, facets: view.facets };

  it("restores the saved view when the URL asks for nothing", () => {
    expect(chooseCatalogueView(null, false, { savedAt: 1, view })).toEqual(view);
  });

  it("restores it, sections and all, when the URL carries that same view (coming Back)", () => {
    expect(chooseCatalogueView({ ...state, facets: { ...state.facets, confidence: "" } }, false, { savedAt: 1, view })).toEqual(view);
  });

  it("lets a different view in the URL win over the saved one", () => {
    expect(chooseCatalogueView({ ...state, q: "moses" }, false, { savedAt: 1, view })).toBeNull();
  });

  it("lets a linked section win over the saved view", () => {
    expect(chooseCatalogueView(null, true, { savedAt: 1, view })).toBeNull();
  });

  it("returns nothing when nothing was saved", () => {
    expect(chooseCatalogueView(null, false, null)).toBeNull();
  });
});

describe("settle", () => {
  it("re-applies while layout settles, then stops", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    settle(apply);
    const first = apply.mock.calls.length;
    vi.advanceTimersByTime(1_000);
    const settled = apply.mock.calls.length;
    expect(settled).toBeGreaterThan(first);
    vi.advanceTimersByTime(5_000);
    expect(apply.mock.calls.length).toBe(settled);
  });

  it("stops at once when the reader takes over, so an explicit change is never overwritten", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    settle(apply);
    const before = apply.mock.calls.length;
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(2_000);
    expect(apply.mock.calls.length).toBe(before);
  });
});
