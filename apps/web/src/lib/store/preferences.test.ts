import { describe, expect, it } from "vitest";

import { usePreferencesStore } from "./preferences";

function migrate(persisted: unknown, from: number) {
  const fn = usePreferencesStore.persist.getOptions().migrate!;
  return fn(persisted, from) as {
    layers: Record<string, boolean>;
    translation?: string;
    tourSeenVersion?: number;
    tourSeen?: boolean;
  };
}

describe("preferences migration", () => {
  const v2Layers = {
    verseNumbers: true, highlights: true, notes: false, crossRefs: true, heat: false,
    variants: true, sourceCrit: false, interlinear: true, insights: false,
  };

  it("turns a v2 state without `toledot` into toledot: true, leaving other layers alone", () => {
    const out = migrate({ layers: v2Layers, translation: "KJV" }, 2);
    expect(out.layers.toledot).toBe(true);
    expect(out.layers).toMatchObject({ notes: false, interlinear: true, insights: false });
    expect(out.translation).toBe("KJV");
  });

  it("keeps a stored toledot: false", () => {
    expect(migrate({ layers: { ...v2Layers, toledot: false } }, 3).layers.toledot).toBe(false);
  });

  it("ships toledot on by default", () => {
    expect(usePreferencesStore.getState().layers.toledot).toBe(true);
  });
});

describe("preferences tourSeenVersion", () => {
  it("defaults to 0 and persists at version 4", () => {
    expect(usePreferencesStore.getState().tourSeenVersion).toBe(0);
    expect(usePreferencesStore.persist.getOptions().version).toBe(4);
  });

  it("migrates tourSeen: true to tourSeenVersion 1 and drops the old key", () => {
    const out = migrate({ layers: {}, translation: "KJV", tourSeen: true }, 3);
    expect(out.tourSeenVersion).toBe(1);
    expect("tourSeen" in out).toBe(false);
    expect(out.translation).toBe("KJV");
  });

  it("migrates tourSeen: false or absent to 0", () => {
    expect(migrate({ layers: {}, tourSeen: false }, 3).tourSeenVersion).toBe(0);
    expect(migrate({ layers: {} }, 3).tourSeenVersion).toBe(0);
  });

  it("keeps a stored tourSeenVersion from version 4", () => {
    const out = migrate({ layers: {}, tourSeenVersion: 2 }, 4);
    expect(out.tourSeenVersion).toBe(2);
    expect("tourSeen" in out).toBe(false);
  });

  it("setTourSeenVersion stores and resetSettings leaves it alone", () => {
    usePreferencesStore.getState().setTourSeenVersion(2);
    expect(usePreferencesStore.getState().tourSeenVersion).toBe(2);
    usePreferencesStore.getState().resetSettings();
    expect(usePreferencesStore.getState().tourSeenVersion).toBe(2);
    usePreferencesStore.getState().setTourSeenVersion(0);
  });
});
