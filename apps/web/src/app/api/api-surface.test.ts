// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const GET_EXPORT = /export\s+(async\s+)?function\s+GET\b|export\s+const\s+GET\b/;
const root = import.meta.dirname;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name === "route.ts" ? [path.join(dir, e.name)] : [],
  );
}

const routes = walk(root)
  .filter((f) => GET_EXPORT.test(readFileSync(f, "utf8")))
  .map((f) => {
    const segs = path.relative(root, path.dirname(f)).split(path.sep).filter(Boolean);
    return "/api/" + segs.map((s) => s.replace(/^\[(.+)\]$/, "{$1}")).join("/");
  })
  .map((p) => p.replace(/\/$/, ""))
  .sort();

async function openapiPaths(): Promise<Record<string, { get?: unknown }>> {
  const { GET } = await import("@/app/api/openapi.json/route");
  return (await (await GET()).json()).paths;
}

describe("API surface is documented", () => {
  it("finds the GET routes (walker is not vacuous)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(18);
  });

  it.each(routes)("%s is in openapi.json", async (p) => {
    expect((await openapiPaths())[p]?.get).toBeDefined();
  });

  it.each(routes)("%s is in llms-full.txt", async (p) => {
    const { GET } = await import("@/app/llms-full.txt/route");
    expect(await (await GET()).text()).toContain(p);
  });

  it("openapi.json lists no path without a route file", async () => {
    const stale = Object.keys(await openapiPaths()).filter((p) => !routes.includes(p));
    expect(stale).toEqual([]);
  });
});
