import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Wordmark, WORDMARK_GEOMETRY } from "@/components/Wordmark";

afterEach(cleanup);

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("WORDMARK_GEOMETRY", () => {
  it("has a four-number viewBox matching width and height", () => {
    const parts = WORDMARK_GEOMETRY.viewBox.trim().split(/\s+/).map(Number);
    expect(parts).toHaveLength(4);
    expect(parts.every(Number.isFinite)).toBe(true);
    expect(WORDMARK_GEOMETRY.width).toBe(parts[2]);
    expect(WORDMARK_GEOMETRY.height).toBe(parts[3]);
  });

  it("has exactly three closed filled outlines and no stroke fields", () => {
    const g = WORDMARK_GEOMETRY as unknown as Record<string, unknown>;
    expect(WORDMARK_GEOMETRY.paths).toHaveLength(3);
    for (const d of WORDMARK_GEOMETRY.paths) {
      expect(d.length).toBeGreaterThan(0);
      expect(d.trim().startsWith("M")).toBe(true);
      expect(d).toContain("Z");
    }
    expect("strokeWidth" in g).toBe(false);
    expect("bowl" in g).toBe(false);
  });

  it("uses the j from public/icon.svg as paths[0]", () => {
    const svg = readFileSync(path.join(process.cwd(), "public/icon.svg"), "utf8");
    const d = svg.match(/<path\b[^>]*?\sd="([^"]+)"/)?.[1];
    expect(d).toBeTruthy();
    expect(squash(WORDMARK_GEOMETRY.paths[0])).toBe(squash(d!));
  });

  it("places the tittle circle inside the viewBox", () => {
    const { cx, cy, r } = WORDMARK_GEOMETRY.tittle;
    const [x, y, w, h] = WORDMARK_GEOMETRY.viewBox.trim().split(/\s+/).map(Number);
    expect(r).toBeGreaterThan(0);
    expect(cx - r).toBeGreaterThanOrEqual(x);
    expect(cy - r).toBeGreaterThanOrEqual(y);
    expect(cx + r).toBeLessThanOrEqual(x + w);
    expect(cy + r).toBeLessThanOrEqual(y + h);
  });

  it("describes the icon tile", () => {
    expect(WORDMARK_GEOMETRY.tile).toEqual({
      viewBox: "0 0 512 512",
      rx: 116,
      tittle: { cx: 304, cy: 112, r: 31 },
    });
  });
});

describe("<Wordmark />", () => {
  it("renders one image named Jot with three filled, unstroked paths and a rubric tittle", () => {
    const { container } = render(<Wordmark />);
    const imgs = screen.getAllByRole("img", { name: "Jot" });
    expect(imgs).toHaveLength(1);
    const paths = imgs[0].querySelectorAll("path");
    expect(paths).toHaveLength(3);
    paths.forEach((p) => {
      expect(p.hasAttribute("fill")).toBe(true);
      expect(p.hasAttribute("stroke")).toBe(false);
    });
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(1);
    expect(circles[0].getAttribute("fill")).toBe("var(--color-rubric)");
  });

  it("renders the tile variant as a single image with a tile rect", () => {
    const { container } = render(<Wordmark variant="tile" />);
    expect(screen.getAllByRole("img", { name: "Jot" })).toHaveLength(1);
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute("fill")).toBe("var(--color-tile)");
  });
});
