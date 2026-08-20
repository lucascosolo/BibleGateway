import { describe, expect, it } from "vitest";
import { DEFAULT_SIM_OPTIONS, initialLayout, tick, totalMotion } from "./force-sim";

describe("initialLayout", () => {
  it("places nodes on a circle around the canvas center, deterministically", () => {
    const opts = { ...DEFAULT_SIM_OPTIONS, width: 100, height: 100 };
    const nodes = initialLayout(["a", "b", "c", "d"], opts);
    expect(nodes).toHaveLength(4);
    for (const n of nodes) {
      const dist = Math.hypot(n.x - 50, n.y - 50);
      expect(dist).toBeCloseTo(35, 5); // 0.35 * min(width, height)
    }
    // Same input -> same output, no randomness.
    const again = initialLayout(["a", "b", "c", "d"], opts);
    expect(again).toEqual(nodes);
  });
});

describe("tick", () => {
  it("pushes coincident nodes apart rather than producing NaN", () => {
    const opts = DEFAULT_SIM_OPTIONS;
    const nodes = [
      { id: "a", x: 50, y: 50, vx: 0, vy: 0 },
      { id: "b", x: 50, y: 50, vx: 0, vy: 0 },
    ];
    tick(nodes, [], opts);
    expect(Number.isNaN(nodes[0].x)).toBe(false);
    expect(Number.isNaN(nodes[1].x)).toBe(false);
    expect(nodes[0].x).not.toBeCloseTo(nodes[1].x, 5);
  });

  it("pulls edge-connected nodes together over time relative to an unconnected pair", () => {
    const opts = { ...DEFAULT_SIM_OPTIONS, width: 400, height: 400 };
    const connected = [
      { id: "a", x: 150, y: 200, vx: 0, vy: 0 },
      { id: "b", x: 250, y: 200, vx: 0, vy: 0 },
    ];
    const unconnected = [
      { id: "a", x: 150, y: 200, vx: 0, vy: 0 },
      { id: "b", x: 250, y: 200, vx: 0, vy: 0 },
    ];
    const edge = [{ source: "a", target: "b", weight: 1 }];

    for (let i = 0; i < 30; i++) {
      tick(connected, edge, opts);
      tick(unconnected, [], opts);
    }

    const connectedDist = Math.hypot(connected[0].x - connected[1].x, connected[0].y - connected[1].y);
    const unconnectedDist = Math.hypot(unconnected[0].x - unconnected[1].x, unconnected[0].y - unconnected[1].y);
    expect(connectedDist).toBeLessThan(unconnectedDist);
  });

  it("keeps a fixed node stationary", () => {
    const opts = DEFAULT_SIM_OPTIONS;
    const nodes = [
      { id: "a", x: 50, y: 50, vx: 0, vy: 0, fixed: true },
      { id: "b", x: 60, y: 50, vx: 0, vy: 0 },
    ];
    tick(nodes, [], opts);
    expect(nodes[0].x).toBe(50);
    expect(nodes[0].y).toBe(50);
  });
});

describe("totalMotion", () => {
  it("is zero for a settled graph and positive for a moving one", () => {
    expect(totalMotion([{ id: "a", x: 0, y: 0, vx: 0, vy: 0 }])).toBe(0);
    expect(totalMotion([{ id: "a", x: 0, y: 0, vx: 1, vy: 1 }])).toBeGreaterThan(0);
  });
});
