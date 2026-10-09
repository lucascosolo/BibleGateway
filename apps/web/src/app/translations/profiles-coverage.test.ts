import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getTranslations } from "@/lib/db/corpus";
import { getProfile } from "@/lib/translations/profiles";

describe("translation profiles: corpus coverage", () => {
  it("has a translation profile for every corpus translation", () => {
    const all = getTranslations();
    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const t of all) {
      expect(getProfile(t.code), t.code).toBeDefined();
      expect(getProfile(t.code)?.kind, t.code).toBe("translation");
    }
  });
});
