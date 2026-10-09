import { afterEach, describe, expect, it } from "vitest";

import { TOUR_VERSION, tourEntry, useTourStore } from "./tour";

afterEach(() => useTourStore.setState({ open: false, startStepId: null }));

describe("tourEntry", () => {
  it("is version 2", () => expect(TOUR_VERSION).toBe(2));

  it("shows the full tour to a reader who has never seen it", () => {
    expect(tourEntry(0, false)).toBe("tour");
    expect(tourEntry(0, true)).toBe("tour");
  });

  it("nudges a version-1 reader only when not installed", () => {
    expect(tourEntry(1, false)).toBe("nudge");
    expect(tourEntry(1, true)).toBeNull();
  });

  it("is silent at the current version and beyond", () => {
    expect(tourEntry(2, false)).toBeNull();
    expect(tourEntry(2, true)).toBeNull();
    expect(tourEntry(3, false)).toBeNull();
  });
});

describe("useTourStore.openTour", () => {
  it("opens at a named step", () => {
    useTourStore.getState().openTour("install");
    expect(useTourStore.getState().open).toBe(true);
    expect(useTourStore.getState().startStepId).toBe("install");
  });

  it("ignores non-string arguments such as a click event", () => {
    (useTourStore.getState().openTour as (a?: unknown) => void)({ type: "click" });
    expect(useTourStore.getState().open).toBe(true);
    expect(useTourStore.getState().startStepId).toBeNull();
  });

  it("starts at null with no argument", () => {
    useTourStore.getState().openTour();
    expect(useTourStore.getState().startStepId).toBeNull();
  });
});
