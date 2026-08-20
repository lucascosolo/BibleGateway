"use client";

import clsx from "clsx";
import Link from "next/link";

import { TIER_META } from "@/lib/crossrefs/tiers";
import type { GraphEdge, GraphNode } from "@/lib/crossrefs/types";

/**
 * The always-available companion to `<DeepDiveGraph>` (ARCHITECTURE.md §4.7.1): "Same data,
 * honest interface." On phone/tablet, where `useCapability('referenceGraph')` returns
 * `unavailable`, this list IS the deep dive rather than a degraded afterthought — it carries
 * every node and edge the graph would have shown, just linearized and grouped by depth then
 * target book, strongest connection first.
 */

export interface DeepDiveListProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  seedId: string;
  translationCode: string;
  className?: string;
}

interface Row {
  node: GraphNode;
  /** The strongest edge connecting this node to the rest of the graph — what it's ranked by. */
  bestVotes: number;
}

export function DeepDiveList({ nodes, edges, seedId, translationCode, className }: DeepDiveListProps) {
  const bestVotesByNode = new Map<string, number>();
  for (const edge of edges) {
    bestVotesByNode.set(edge.source, Math.max(bestVotesByNode.get(edge.source) ?? 0, edge.votes));
    bestVotesByNode.set(edge.target, Math.max(bestVotesByNode.get(edge.target) ?? 0, edge.votes));
  }

  const rows: Row[] = nodes
    .filter((n) => n.id !== seedId)
    .map((node) => ({ node, bestVotes: bestVotesByNode.get(node.id) ?? 0 }));

  // Group by depth first — "one hop away" vs. "two hops away" is the primary structure of a
  // deep dive — then rank within each depth by the strongest connection.
  const byDepth = new Map<number, Row[]>();
  for (const row of rows) {
    const arr = byDepth.get(row.node.depth);
    if (arr) arr.push(row);
    else byDepth.set(row.node.depth, [row]);
  }
  for (const arr of byDepth.values()) arr.sort((a, b) => b.bestVotes - a.bestVotes || b.node.degree - a.node.degree);

  const depths = [...byDepth.keys()].sort((a, b) => a - b);

  if (rows.length === 0) {
    return <p className={clsx("deep-dive-list__empty", className)}>No connected passages found.</p>;
  }

  return (
    <div className={clsx("deep-dive-list", className)}>
      {depths.map((depth) => (
        <section key={depth} className="deep-dive-list__depth">
          <h3 className="deep-dive-list__depth-title">
            {depth === 1 ? "Directly connected" : `${depth} hops away`}
            <span className="deep-dive-list__depth-count">{byDepth.get(depth)!.length}</span>
          </h3>
          <ol className="deep-dive-list__rows">
            {byDepth.get(depth)!.map(({ node, bestVotes }) => (
              <li key={node.id} className="deep-dive-row">
                <Link href={`/read/${node.slug}?t=${translationCode}`} className="deep-dive-row__link">
                  <span className="deep-dive-row__reference">{node.reference}</span>
                  <span className="deep-dive-row__meta">
                    {node.degree} connection{node.degree === 1 ? "" : "s"} in this graph
                    {bestVotes > 0 && (
                      <>
                        {" · strongest "}
                        {bestVotes} vote{bestVotes === 1 ? "" : "s"}
                        {" ("}
                        {TIER_META[bestVotes >= 20 ? "strong" : bestVotes >= 5 ? "moderate" : "light"].label}
                        {")"}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
