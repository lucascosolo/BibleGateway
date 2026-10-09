// Guard: Tailwind v4 compiles a `text-[var(--text-…)]` class to a COLOR (the arbitrary
// value is ambiguous), not a font-size, so the size silently never applies.
// The correct form is `text-[length:var(--text-…)]`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = import.meta.dirname;
const SELF = join(ROOT, "text-size-classes.test.ts");
const BAD = "text-[var(--text-";
const GOOD = "text-[length:var(--text-";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && p !== SELF) out.push(p);
  }
  return out;
}

describe("font-size utility classes", () => {
  const files = walk(ROOT);

  it("never uses text-[var(--text-…)] (compiles to color, not size)", () => {
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.includes(BAD)) hits.push(`${f}:${i + 1}`);
        });
    }
    expect(hits, `use text-[length:var(--text-…)] instead:\n${hits.join("\n")}`).toEqual([]);
  });

  it("walk is not empty: some file uses text-[length:var(--text-…)]", () => {
    expect(files.some((f) => readFileSync(f, "utf8").includes(GOOD))).toBe(true);
  });
});
