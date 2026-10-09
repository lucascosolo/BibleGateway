// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/_docs/outside-facts", () => ({
  getOutsideDocFacts: () => ({
    workCount: 3, undatedCount: 1, undatedTitles: ["Undated One"], translationCodes: ["ZZTEST1", "ZZTEST2"],
    undatedWord: "One", translationWord: "Two",
  }),
}));

const CODES = ["MATTISON", "JAMES1924", "LIGHTFOOT", "CHARLES", "GRAY", "ANF", "KJVA"];
const root = import.meta.dirname;

describe("outside translation codes come from data", () => {
  it.each(["page.tsx", "openapi.json/route.ts"])("%s never enumerates the codes (no line names 3 or more)", (file) => {
    const lines = readFileSync(path.join(root, file), "utf8").split("\n");
    const offenders = lines
      .map((l, i) => [i + 1, CODES.filter((c) => new RegExp(`\\b${c}\\b`).test(l)).length] as const)
      .filter(([, n]) => n >= 3)
      .map(([n]) => n);
    expect([file, offenders]).toEqual([file, []]);
  });

  it("the OpenAPI /api/translations description lists the codes the data supplies", async () => {
    const { GET } = await import("@/app/api/openapi.json/route");
    const doc = await (await GET()).json();
    const d: string = doc.paths["/api/translations"].get.description;
    expect(d).toContain("ZZTEST1");
    expect(d).toContain("ZZTEST2");
  });

  it("the /api/passage translation parameter lists the codes the data supplies", async () => {
    const { GET } = await import("@/app/api/openapi.json/route");
    const doc = await (await GET()).json();
    const p = doc.paths["/api/passage"].get.parameters.find((x: { name: string }) => x.name === "translation");
    expect(p.description).toContain("ZZTEST1");
    expect(p.description).toContain("ZZTEST2");
  });
});
