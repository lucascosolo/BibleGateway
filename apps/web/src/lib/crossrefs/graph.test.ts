import { describe, expect, it } from "vitest";
import { toVerseId, type VerseRange } from "@/lib/refs/verse-id";
import { buildGraph, type XrefEdgeRow, type XrefFetcher } from "./graph";
import type { GraphCaps } from "./types";

const v = (c: number, verse: number) => toVerseId(43, c, verse); // arbitrary book (John)

const DEFAULT_CAPS: GraphCaps = { maxDepth: 2, maxDegreePerNode: 10, maxNodes: 100, minVotes: 0 };

/** A fetcher backed by a plain adjacency map, so the graph algorithm can be tested without a DB. */
function fakeFetcher(adjacency: Record<string, XrefEdgeRow[]>): XrefFetcher {
  const key = (r: VerseRange) => `${r.start}-${r.end}`;
  return {
    outbound: (range, limit) => (adjacency[key(range)] ?? []).slice(0, limit),
    inbound: () => [],
  };
}

describe("buildGraph", () => {
  it("always includes the seed as a depth-0 node even with no edges", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const result = buildGraph(seed, fakeFetcher({}), DEFAULT_CAPS);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].depth).toBe(0);
    expect(result.capped).toEqual({ depth: false, nodes: false, degreePerNode: false, minVotes: false });
  });

  it("walks outbound edges to the configured depth and stops there", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const a = { start: v(2, 1), end: v(2, 1) };
    const b = { start: v(3, 1), end: v(3, 1) };
    // seed -> a (depth 1), a -> b (depth 2), b -> (would be depth 3, never fetched)
    const fetcher = fakeFetcher({
      [`${seed.start}-${seed.end}`]: [{ fromVerseId: seed.start, toStartVerse: a.start, toEndVerse: a.end, votes: 12 }],
      [`${a.start}-${a.end}`]: [{ fromVerseId: a.start, toStartVerse: b.start, toEndVerse: b.end, votes: 8 }],
      [`${b.start}-${b.end}`]: [{ fromVerseId: b.start, toStartVerse: v(4, 1), toEndVerse: v(4, 1), votes: 5 }],
    });

    const result = buildGraph(seed, fetcher, { ...DEFAULT_CAPS, maxDepth: 2 });

    expect(result.nodes).toHaveLength(3); // seed, a, b — the depth-3 node was never visited
    expect(result.nodes.find((n) => n.depth === 2)).toBeDefined();
    expect(result.capped.depth).toBe(true); // b had further neighbors we chose not to fetch
    expect(result.edges).toHaveLength(2);
  });

  it("caps total nodes at maxNodes and reports it", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const neighbors: XrefEdgeRow[] = Array.from({ length: 20 }, (_, i) => ({
      fromVerseId: seed.start,
      toStartVerse: v(2, i + 1),
      toEndVerse: v(2, i + 1),
      votes: 20 - i,
    }));
    const fetcher = fakeFetcher({ [`${seed.start}-${seed.end}`]: neighbors });

    const result = buildGraph(seed, fetcher, { ...DEFAULT_CAPS, maxNodes: 5 });

    expect(result.nodes.length).toBeLessThanOrEqual(5);
    expect(result.capped.nodes).toBe(true);
  });

  it("caps per-node fan-out at maxDegreePerNode and reports it", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const neighbors: XrefEdgeRow[] = Array.from({ length: 20 }, (_, i) => ({
      fromVerseId: seed.start,
      toStartVerse: v(2, i + 1),
      toEndVerse: v(2, i + 1),
      votes: 1,
    }));
    const fetcher = fakeFetcher({ [`${seed.start}-${seed.end}`]: neighbors });

    const result = buildGraph(seed, fetcher, { ...DEFAULT_CAPS, maxDegreePerNode: 3, maxNodes: 100 });

    // seed + 3 neighbors (the fetcher itself was asked for at most 3)
    expect(result.nodes).toHaveLength(4);
    expect(result.capped.degreePerNode).toBe(true);
  });

  it("filters edges below minVotes", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const a = { start: v(2, 1), end: v(2, 1) };
    const fetcher = fakeFetcher({
      [`${seed.start}-${seed.end}`]: [{ fromVerseId: seed.start, toStartVerse: a.start, toEndVerse: a.end, votes: 1 }],
    });

    const result = buildGraph(seed, fetcher, { ...DEFAULT_CAPS, minVotes: 5 });

    expect(result.nodes).toHaveLength(1); // only the seed — the low-vote edge was dropped
    expect(result.edges).toHaveLength(0);
  });

  it("reports edgeStats and capped.minVotes so the UI can disclose what the vote threshold hid", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const a = { start: v(2, 1), end: v(2, 1) };
    const b = { start: v(2, 2), end: v(2, 2) };
    // Two candidates, only one clears minVotes — buildGraph itself does the filtering (the
    // fetcher hands back everything within the degree cap), which is what makes the count of
    // "candidates seen" meaningful rather than already-invisible.
    const fetcher = fakeFetcher({
      [`${seed.start}-${seed.end}`]: [
        { fromVerseId: seed.start, toStartVerse: a.start, toEndVerse: a.end, votes: 10 },
        { fromVerseId: seed.start, toStartVerse: b.start, toEndVerse: b.end, votes: 2 },
      ],
    });

    const result = buildGraph(seed, fetcher, { ...DEFAULT_CAPS, minVotes: 5 });

    expect(result.edgeStats).toEqual({ candidates: 2, shown: 1 });
    expect(result.capped.minVotes).toBe(true);
  });

  it("does not report a minVotes cap when nothing was filtered out", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const a = { start: v(2, 1), end: v(2, 1) };
    const fetcher = fakeFetcher({
      [`${seed.start}-${seed.end}`]: [{ fromVerseId: seed.start, toStartVerse: a.start, toEndVerse: a.end, votes: 10 }],
    });

    const result = buildGraph(seed, fetcher, { ...DEFAULT_CAPS, minVotes: 0 });

    expect(result.edgeStats).toEqual({ candidates: 1, shown: 1 });
    expect(result.capped.minVotes).toBe(false);
  });

  it("computes degree as edges touching each node in the built graph", () => {
    const seed = { start: v(1, 1), end: v(1, 1) };
    const a = { start: v(2, 1), end: v(2, 1) };
    const b = { start: v(2, 2), end: v(2, 2) };
    const fetcher = fakeFetcher({
      [`${seed.start}-${seed.end}`]: [
        { fromVerseId: seed.start, toStartVerse: a.start, toEndVerse: a.end, votes: 10 },
        { fromVerseId: seed.start, toStartVerse: b.start, toEndVerse: b.end, votes: 10 },
      ],
    });

    const result = buildGraph(seed, fetcher, { ...DEFAULT_CAPS, maxDepth: 1 });

    const seedNode = result.nodes.find((n) => n.depth === 0)!;
    expect(seedNode.degree).toBe(2);
  });
});
