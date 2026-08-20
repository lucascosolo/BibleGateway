/**
 * A minimal force-directed layout, hand-rolled rather than pulled in as a dependency.
 *
 * `<DeepDiveGraph>` renders to `<canvas>`, not SVG, specifically because hub verses (Isaiah 53
 * alone has hundreds of inbound references) push node counts into a range where SVG's
 * per-element DOM cost stalls; canvas repaints a few hundred circles and lines every frame for
 * free. The simulation itself is O(n²) per tick (pairwise repulsion), which is fine at the
 * `maxNodes` ceiling the API enforces (150) and simple enough to unit test without a browser.
 */

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Fixed nodes (the seed, or a dragged node) don't drift from external forces. */
  fixed?: boolean;
}

export interface SimEdge {
  source: string;
  target: string;
  /** 0-1 — higher weight pulls the pair closer and more firmly. Derived from vote tier. */
  weight: number;
}

export interface SimOptions {
  width: number;
  height: number;
  repulsion: number;
  springLength: number;
  springStrength: number;
  centerStrength: number;
  damping: number;
}

export const DEFAULT_SIM_OPTIONS: SimOptions = {
  width: 800,
  height: 600,
  repulsion: 2400,
  springLength: 90,
  springStrength: 0.02,
  centerStrength: 0.006,
  damping: 0.85,
};

/** Deterministic initial layout — a circle around the center, so results are reproducible in tests. */
export function initialLayout(ids: readonly string[], opts: SimOptions): SimNode[] {
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const radius = Math.min(opts.width, opts.height) * 0.35;
  return ids.map((id, i) => {
    const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
    return { id, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, vx: 0, vy: 0 };
  });
}

/** Advance the simulation by one tick, mutating and returning `nodes` in place. */
export function tick(nodes: SimNode[], edges: readonly SimEdge[], opts: SimOptions): SimNode[] {
  const cx = opts.width / 2;
  const cy = opts.height / 2;

  // Pairwise repulsion (Coulomb-like).
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distSq = dx * dx + dy * dy;
      if (distSq < 0.01) {
        // Coincident nodes: nudge apart deterministically rather than dividing by ~0.
        dx = 0.1;
        dy = 0.1;
        distSq = 0.02;
      }
      const dist = Math.sqrt(distSq);
      const force = opts.repulsion / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.fixed) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.fixed) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }
  }

  // Spring attraction along edges.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const targetLength = opts.springLength * (1.4 - edge.weight * 0.4); // stronger edges pull tighter
    const displacement = dist - targetLength;
    const force = displacement * opts.springStrength * (0.5 + edge.weight);
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!a.fixed) {
      a.vx += fx;
      a.vy += fy;
    }
    if (!b.fixed) {
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Weak centering force so the graph doesn't drift off-canvas.
  for (const n of nodes) {
    if (n.fixed) continue;
    n.vx += (cx - n.x) * opts.centerStrength;
    n.vy += (cy - n.y) * opts.centerStrength;
    n.vx *= opts.damping;
    n.vy *= opts.damping;
    n.x += n.vx;
    n.y += n.vy;
  }

  return nodes;
}

/** Total kinetic energy — a convergence signal so the caller can stop animating once the layout settles. */
export function totalMotion(nodes: readonly SimNode[]): number {
  let sum = 0;
  for (const n of nodes) sum += n.vx * n.vx + n.vy * n.vy;
  return sum;
}
