import type { VerseText } from "@/lib/db/corpus";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import type { XrefTier } from "./tiers";

/**
 * A cross-reference resolved to everything a panel needs to render one row without a second
 * round trip: a human-readable reference, a navigable URL slug, and the target's first verse
 * of text (already shaped as a `VerseText` so it can be handed straight to
 * `<PassageRenderer density="panel">`).
 */
export interface ResolvedXref {
  range: VerseRange;
  reference: string;
  slug: string;
  votes: number;
  tier: XrefTier;
  source: string;
  /** Null only when the target verse has no text in the requested translation. */
  preview: VerseText | null;
}

/** `ResolvedXref[]` bucketed by the book the target range falls in, strongest group first. */
export interface XrefGroup {
  bookId: number;
  bookName: string;
  items: ResolvedXref[];
  /** The best single vote count in the group — what the group is sorted by. */
  topVotes: number;
}

export interface XrefsResponse {
  reference: string;
  range: VerseRange;
  translation: { code: string };
  /**
   * Distinct records touching this passage in either direction.
   *
   * Deliberately NOT derivable as `outbound.total + inbound.total` — a record can satisfy both
   * predicates, so the sum double-counts every link that runs both ways. Computed in SQL as a
   * single `COUNT(*)` over the union predicate; see `countUniqueReferences`.
   */
  total: number;
  outbound: {
    groups: XrefGroup[];
    returned: number;
    total: number;
  };
  inbound: {
    groups: XrefGroup[];
    returned: number;
    total: number;
  };
}

// --- Deep-dive graph -------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  range: VerseRange;
  reference: string;
  slug: string;
  /** Hops from the seed passage; 0 is the seed itself. */
  depth: number;
  /** Number of edges touching this node in the returned graph (not the true corpus degree). */
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  votes: number;
  tier: XrefTier;
}

export interface GraphCaps {
  maxDepth: number;
  maxDegreePerNode: number;
  maxNodes: number;
  minVotes: number;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** True whenever the graph stopped short of the full neighborhood, and why. */
  capped: {
    depth: boolean;
    nodes: boolean;
    degreePerNode: boolean;
    /** True when `caps.minVotes` excluded at least one candidate edge that was otherwise fetched. */
    minVotes: boolean;
  };
  caps: GraphCaps;
  /**
   * How many candidate cross-references the traversal actually looked at (within the depth and
   * per-node degree caps) versus how many survived `caps.minVotes`. The on-screen notice needs
   * this to state a real fraction instead of just naming the threshold — "capped, and we also
   * applied a minimum vote count" is not disclosure if the reader can't tell how much that
   * threshold cut.
   */
  edgeStats: {
    /** Candidate edges seen before the vote-threshold filter, at the same depth/degree caps. */
    candidates: number;
    /** Edges that passed `caps.minVotes` and are actually in `edges`. */
    shown: number;
  };
}

export interface GraphResponse extends GraphResult {
  reference: string;
  range: VerseRange;
}

/** Re-exported so downstream modules can `import type { VerseId } from "./types"` if convenient. */
export type { VerseId };
