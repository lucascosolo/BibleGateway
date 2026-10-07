import { describe, expect, it } from "vitest";

import { usePreferencesStore } from "./preferences";

function migrate(persisted: unknown, from: number) {
  const fn = usePreferencesStore.persist.getOptions().migrate!;
  return fn(persisted, from) as { layers: Record<string, boolean>; translation?: string };
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
