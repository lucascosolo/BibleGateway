"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PassageRenderer } from "@/components/passage/PassageRenderer";
import { TIER_META, type XrefTier } from "@/lib/crossrefs/tiers";
import type { XrefGroup, XrefsResponse } from "@/lib/crossrefs/types";

/**
 * <ContextSidebar><CrossRefPanel/></ContextSidebar> — ARCHITECTURE.md §4.2.
 *
 * A ranked, grouped list of cross-references for the current passage. Ranking is legible on
 * purpose: every row shows its vote count and tier badge, not just its position, so a
 * researcher can see *why* something outranks something else rather than trusting a black box.
 *
 * Self-contained: fetches its own data from `/api/xrefs` given a reference, so the reader page
 * only has to mount it with the current passage and translation.
 */

export interface CrossRefPanelProps {
  /** Any string `parseReference` accepts — OSIS slug, "John 3:16", etc. */
  reference: string;
  translationCode: string;
  /** Numeric id, required by `<PassageRenderer>` for annotation lookups. */
  translationId: number;
  className?: string;
}

type VoteFilter = "all" | "moderate" | "strong";

// `all: 0` used to silently drop the 1,247 cross-references with negative vote counts (OpenBible
// contributors marked them dubious) — "All" claimed to mean all but excluded them without saying
// so. The sentinel below is under the real minimum in the corpus (-86), so "All" is now literally
// all, including the negative-vote links a researcher may specifically want to see and judge.
const ALL_VOTES_SENTINEL = -1_000_000;
const VOTE_FILTER_MIN: Record<VoteFilter, number> = { all: ALL_VOTES_SENTINEL, moderate: 5, strong: 20 };

export function CrossRefPanel({ reference, translationCode, translationId, className }: CrossRefPanelProps) {
  const [data, setData] = useState<XrefsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voteFilter, setVoteFilter] = useState<VoteFilter>("all");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    const params = new URLSearchParams({
      ref: reference,
      translation: translationCode,
      minVotes: String(VOTE_FILTER_MIN[voteFilter]),
      limit: String(limit),
    });

    fetch(`/api/xrefs?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`xrefs request failed (${res.status})`);
        return res.json() as Promise<XrefsResponse>;
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
  }, [reference, translationCode, voteFilter, limit]);

  const active = data ? data[direction] : null;

  // `data.total` is a real `COUNT(*)` over the union predicate, computed server-side. Adding
  // the two directional totals here counted every reference that runs both ways twice — John 3
  // reported 1,438 against 1,406 actual records. The overlap below is what the sum got wrong,
  // stated rather than quietly absorbed, so the tab counts and the headline reconcile.
  const bothWays = data ? data.outbound.total + data.inbound.total - data.total : 0;

  return (
    <section className={clsx("xref-panel", className)} aria-label="Cross-references">
      <header className="xref-panel__header">
        <h2 className="xref-panel__title">Cross-references</h2>
        {data && (
          <span className="xref-panel__count">
            {data.total} total for {data.reference}
          </span>
        )}
      </header>
      <p className="xref-panel__source">
        Source: <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">OpenBible.info cross-references</a>; vote counts are contributor ratings, not scholarly consensus.
      </p>

      <div className="xref-panel__tabs" role="tablist" aria-label="Direction">
        <button
          type="button"
          role="tab"
          aria-selected={direction === "outbound"}
          className={clsx("xref-panel__tab", direction === "outbound" && "xref-panel__tab--active")}
          onClick={() => setDirection("outbound")}
        >
          From here{data ? ` (${data.outbound.total})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === "inbound"}
          className={clsx("xref-panel__tab", direction === "inbound" && "xref-panel__tab--active")}
          onClick={() => setDirection("inbound")}
        >
          To here{data ? ` (${data.inbound.total})` : ""}
        </button>
      </div>

      {/* Neutral disclosure, in the truncation voice rather than the alert palette — this is
          information about how the two tabs relate, not a fault. */}
      {bothWays > 0 && (
        <p className="xref-panel__truncation">
          {bothWays} of these run in both directions, so the two tabs overlap and do not add up
          to the total.
        </p>
      )}

      <div className="xref-panel__filters" role="group" aria-label="Minimum confidence">
        {(["all", "moderate", "strong"] as VoteFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={clsx("xref-panel__filter", voteFilter === f && "xref-panel__filter--active")}
            aria-pressed={voteFilter === f}
            onClick={() => {
              setLimit(40);
              setVoteFilter(f);
            }}
          >
            {f === "all" ? "All" : TIER_META[f].label}
          </button>
        ))}
      </div>

      {error && <p className="xref-panel__error">Could not load cross-references: {error}</p>}
      {!data && !error && <p className="xref-panel__loading">Loading cross-references…</p>}

      {active && (
        <>
          {active.groups.length === 0 && (
            <p className="xref-panel__empty">
              No {direction === "outbound" ? "outbound" : "inbound"} cross-references
              {voteFilter !== "all" ? ` at ${TIER_META[voteFilter === "strong" ? "strong" : "moderate"].label.toLowerCase()} confidence or above` : ""}.
            </p>
          )}

          {active.returned < active.total && (
            <p className="xref-panel__truncation">
              Showing the top {active.returned} of {active.total}, ranked by vote weight. Load more to inspect the next ranked set.
            </p>
          )}

          <ol className="xref-panel__groups">
            {active.groups.map((group) => (
              <GroupList
                key={group.bookId}
                group={group}
                translationId={translationId}
                translationCode={translationCode}
              />
            ))}
          </ol>
          {active.returned < active.total && active.returned < 200 && (
            <button
              type="button"
              className="xref-panel__load-more"
              onClick={() => setLimit((current) => Math.min(200, current + 40))}
            >
              Load 40 more ({active.total - active.returned} remain)
            </button>
          )}
        </>
      )}
    </section>
  );
}

function GroupList({
  group,
  translationId,
  translationCode,
}: {
  group: XrefGroup;
  translationId: number;
  translationCode: string;
}) {
  return (
    <li className="xref-group">
      <h3 className="xref-group__book">
        {group.bookName}
        <span className="xref-group__book-count">{group.items.length}</span>
      </h3>
      <ul className="xref-group__items">
        {group.items.map((item) => (
          <li key={`${item.range.start}-${item.range.end}`} className="xref-row">
            <Link
              href={`/read/${item.slug}?t=${translationCode}`}
              className="xref-row__link"
              title={`Go to ${item.reference}`}
            >
              <div className="xref-row__meta">
                <span className="xref-row__reference">{item.reference}</span>
                <TierBadge tier={item.tier} votes={item.votes} />
              </div>
              {item.preview ? (
                <PassageRenderer
                  verses={[item.preview]}
                  range={item.range}
                  density="panel"
                  translationId={translationId}
                  layerOverrides={{ notes: false, crossRefs: false }}
                  className="xref-row__preview"
                />
              ) : (
                <p className="xref-row__no-preview">No text available in this translation.</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function TierBadge({ tier, votes }: { tier: XrefTier; votes: number }) {
  const meta = TIER_META[tier];
  return (
    <span className={clsx("xref-tier", `xref-tier--${tier}`)} title={meta.description}>
      {meta.label} · {votes} vote{votes === 1 ? "" : "s"}
    </span>
  );
}
