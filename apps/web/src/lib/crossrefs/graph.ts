import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import { xrefTier } from "./tiers";
import type { GraphCaps, GraphEdge, GraphNode, GraphResult } from "./types";

/**
 * The deep-dive reference graph: a breadth-first walk from a seed passage, capped on three
 * independent axes (depth, per-node fan-out, total node budget) so a hub verse like Isaiah 53
 * — hundreds of inbound references alone — cannot make the graph unusable or the response
 * unbounded.
 *
 * The DB access is injected as `XrefFetcher` rather than called directly, which keeps the
 * traversal and capping logic — the part actually worth testing — free of `better-sqlite3` and
 * runnable in plain vitest. `apps/web/src/app/api/graph/route.ts` supplies the real fetcher
 * backed by `getOutboundReferencesLimited` / `getInboundReferencesLimited`.
 */

export interface XrefEdgeRow {
  fromVerseId: VerseId;
  toStartVerse: VerseId;
  toEndVerse: VerseId;
  votes: number;
}

export interface XrefFetcher {
  /** Top-`limit` outbound references from `range`, strongest first. */
  outbound(range: VerseRange, limit: number): XrefEdgeRow[];
  /** Top-`limit` inbound references into `range`, strongest first. */
  inbound(range: VerseRange, limit: number): XrefEdgeRow[];
}

interface FrontierEntry {
  key: string;
  range: VerseRange;
  depth: number;
}

const nodeKey = (r: VerseRange): string => `${r.start}-${r.end}`;

export function buildGraph(seed: VerseRange, fetcher: XrefFetcher, caps: GraphCaps): GraphResult {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  let cappedDepth = false;
  let cappedNodes = false;
  let cappedDegreePerNode = false;
  // Every row the fetcher hands back is a "candidate" — seen within the depth/degree caps,
  // before `caps.minVotes` decides whether it becomes a real edge. Comparing the two counts is
  // what lets the UI disclose the vote threshold honestly instead of just naming it.
  let candidateEdges = 0;

  const seedKey = nodeKey(seed);
  nodes.set(seedKey, { id: seedKey, range: seed, reference: "", slug: "", depth: 0, degree: 0 });

  let frontier: FrontierEntry[] = [{ key: seedKey, range: seed, depth: 0 }];

  outer: while (frontier.length > 0) {
    const next: FrontierEntry[] = [];

    for (const current of frontier) {
      if (current.depth >= caps.maxDepth) {
        // There may be more neighbors beyond this node — we simply never asked. That is a
        // depth cap, not a node-budget cap, and the UI needs to say which happened.
        cappedDepth = true;
        continue;
      }
      if (nodes.size >= caps.maxNodes) {
        cappedNodes = true;
        break outer;
      }

      const out = fetcher.outbound(current.range, caps.maxDegreePerNode);
      const inb = fetcher.inbound(current.range, caps.maxDegreePerNode);
      if (out.length >= caps.maxDegreePerNode || inb.length >= caps.maxDegreePerNode) {
        cappedDegreePerNode = true;
      }

      for (const row of out) {
        candidateEdges++;
        if (row.votes < caps.minVotes) continue;
        if (nodes.size >= caps.maxNodes && !nodes.has(nodeKey({ start: row.toStartVerse, end: row.toEndVerse }))) {
          cappedNodes = true;
          continue;
        }
        visit(current, { start: row.toStartVerse, end: row.toEndVerse }, row.votes, true, next);
      }
      for (const row of inb) {
        candidateEdges++;
        if (row.votes < caps.minVotes) continue;
        const singleton = { start: row.fromVerseId, end: row.fromVerseId };
        if (nodes.size >= caps.maxNodes && !nodes.has(nodeKey(singleton))) {
          cappedNodes = true;
          continue;
        }
        visit(current, singleton, row.votes, false, next);
      }
    }

    frontier = next;
  }

  // Degree is "edges touching this node in the graph we actually built" — only knowable once
  // traversal finishes, since a node reached late may still gain edges from later siblings.
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  for (const node of nodes.values()) node.degree = degree.get(node.id) ?? 0;

  return {
    nodes: [...nodes.values()],
    edges,
    capped: {
      depth: cappedDepth,
      nodes: cappedNodes,
      degreePerNode: cappedDegreePerNode,
      minVotes: edges.length < candidateEdges,
    },
    caps,
    edgeStats: { candidates: candidateEdges, shown: edges.length },
  };

  function visit(
    from: FrontierEntry,
    neighborRange: VerseRange,
    votes: number,
    isOutbound: boolean,
    next: FrontierEntry[]
  ): void {
    const neighborKey = nodeKey(neighborRange);
    const [source, target] = isOutbound ? [from.key, neighborKey] : [neighborKey, from.key];
    const edgeKey = `${source}->${target}`;
    if (!edgeKeys.has(edgeKey)) {
      edgeKeys.add(edgeKey);
      edges.push({ source, target, votes, tier: xrefTier(votes) });
    }

    if (!nodes.has(neighborKey)) {
      const neighborDepth = from.depth + 1;
      nodes.set(neighborKey, {
        id: neighborKey,
        range: neighborRange,
        reference: "",
        slug: "",
        depth: neighborDepth,
        degree: 0,
      });
      next.push({ key: neighborKey, range: neighborRange, depth: neighborDepth });
    }
  }
}
