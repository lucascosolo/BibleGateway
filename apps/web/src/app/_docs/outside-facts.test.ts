// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const works = vi.hoisted(() => {
  const w = (id: string, title: string, undated: boolean) => ({ id, title, composedUndated: undated ? "no source dates it" : null });
  return [w("a", "Alpha", false), w("b", "Beta", true), w("c", "Gamma", true), w("d", "Delta", false)];
});
vi.mock("@/lib/db/timeline", () => ({ getWorkSummaries: () => works }));
vi.mock("@/lib/db/corpus", () => ({
  getTranslations: () => [
    { code: "KJV", scope: "all" },
    { code: "ZED", scope: "outside" },
    { code: "YAK", scope: "outside" },
    { code: "XEN", scope: "outside" },
  ],
}));

describe("API docs read the outside-book facts from data", () => {
  it("llms.txt", async () => {
    const { GET } = await import("../llms.txt/route");
    const text = await GET().text();
    expect(text).toContain("Three editions carry them");
    expect(text).toContain("ZED, YAK, XEN");
    expect(text).toContain("Two works are undated");
    expect(text).not.toContain("KJVA, CHARLES");
  });
  it("llms-full.txt", async () => {
    const { GET } = await import("../llms-full.txt/route");
    const text = await GET().text();
    expect(text).toContain("lists the 4 works");
    expect(text).toContain("Two works are undated (Beta, Gamma)");
    expect(text).not.toContain("43 works");
  });
  it("openapi.json", async () => {
    const { GET } = await import("../api/openapi.json/route");
    const spec = await (await GET()).json();
    const description: string = spec.paths["/api/timeline/works"].get.description;
    expect(description).toContain("4 works across five canons");
    expect(description).toContain("Two works are explicitly undated");
    expect(description).not.toContain("43 works");
  });
});
