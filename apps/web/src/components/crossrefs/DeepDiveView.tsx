"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useCapability } from "@/lib/capability";
import type { GraphNode, GraphResponse } from "@/lib/crossrefs/types";
import { DeepDiveGraph } from "./DeepDiveGraph";
import { DeepDiveList } from "./DeepDiveList";

/**
 * The deep-dive workspace: force-directed graph on desktop, grouped ranked list always — same
 * data underneath, per ARCHITECTURE.md §4.7.1's "cut features are disclosed, never silently
 * hidden." `useCapability('referenceGraph')` is the one, documented decision point; this
 * component just branches on it.
 */

/**
 * The cap overrides the cap notice tells the reader to put in the URL.
 *
 * They arrive as props from the page's own `searchParams` rather than through
 * `useSearchParams()`: this component is already mounted by a server component that has the
 * query string in hand, and reading it here instead would opt the whole route into
 * client-side rendering behind a Suspense boundary for no gain.
 *
 * Forwarded verbatim, as strings. `/api/graph` parses and clamps every one of them against its
 * absolute ceilings, so this must NOT clamp them too — a second clamp is a second place for the
 * two to drift, and the notice's promise is "within server limits", not "within these".
 */
export interface DeepDiveGraphParams {
  depth?: string;
  maxNodes?: string;
  maxDegree?: string;
  minVotes?: string;
}

export interface DeepDiveViewProps {
  reference: string;
  translationCode: string;
  graphParams?: DeepDiveGraphParams;
}

export function DeepDiveView({ reference, translationCode, graphParams }: DeepDiveViewProps) {
  const router = useRouter();
  const capability = useCapability("referenceGraph");
  const [data, setData] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Destructured to primitives so the effect's dependencies are the values, not the identity
  // of a props object that is rebuilt on every parent render.
  const { depth, maxNodes, maxDegree, minVotes } = graphParams ?? {};

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const query = new URLSearchParams({ ref: reference });
    // `"0"` is a meaningful value for minVotes ("show everything") and is truthy as a string,
    // so this drops only absent and empty params.
    if (depth) query.set("depth", depth);
    if (maxNodes) query.set("maxNodes", maxNodes);
    if (maxDegree) query.set("maxDegree", maxDegree);
    if (minVotes) query.set("minVotes", minVotes);
    fetch(`/api/graph?${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`graph request failed (${res.status})`);
        return res.json() as Promise<GraphResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reference, depth, maxNodes, maxDegree, minVotes]);

  function handleSelect(node: GraphNode) {
    router.push(`/read/${node.slug}?t=${translationCode}`);
  }

  if (error) return <p className="deep-dive__error">Could not load the reference graph: {error}</p>;
  if (!data) return <p className="deep-dive__loading">Loading reference graph…</p>;

  const seedId = `${data.range.start}-${data.range.end}`;
  const anyCap =
    data.capped.depth || data.capped.nodes || data.capped.degreePerNode || data.capped.minVotes;

  return (
    <div className="deep-dive">
      {anyCap && (
        <p className="deep-dive__cap-notice" role="status">
          This is a capped view, not the complete network:{" "}
          {[
            data.capped.nodes && `stopped at ${data.caps.maxNodes} passages`,
            data.capped.degreePerNode && `each passage capped at its top ${data.caps.maxDegreePerNode} connections`,
            data.capped.depth && `stopped ${data.caps.maxDepth} hop${data.caps.maxDepth === 1 ? "" : "s"} out`,
            data.capped.minVotes &&
              `only cross-references with at least ${data.caps.minVotes} vote${data.caps.minVotes === 1 ? "" : "s"} shown (${data.edgeStats.shown} of ${data.edgeStats.candidates} considered here)`,
          ]
            .filter(Boolean)
            .join(", ")}
          . Raise the caps in the URL (<code>?maxNodes=</code>, <code>?maxDegree=</code>,{" "}
          <code>?depth=</code>, <code>?minVotes=0</code>) to see further, within server limits.
        </p>
      )}

      {capability === "full" ? (
        <DeepDiveGraph nodes={data.nodes} edges={data.edges} seedId={seedId} onSelect={handleSelect} />
      ) : (
        <p className="deep-dive__graph-unavailable">
          The force-directed graph needs a wider screen — best on a larger screen. Everything it
          would show is in the list below.
        </p>
      )}

      <DeepDiveList
        nodes={data.nodes}
        edges={data.edges}
        seedId={seedId}
        translationCode={translationCode}
        className="deep-dive__list"
      />
    </div>
  );
}
