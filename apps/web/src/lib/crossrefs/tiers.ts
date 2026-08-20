/**
 * Vote-weight tiers for a single cross-reference.
 *
 * The links themselves come primarily from the Treasury of Scripture Knowledge, blended with
 * several other cross-reference sets by OpenBible.info; `votes` is OpenBible site visitors'
 * relevance rating of an already-compiled link, not a count of contributors independently
 * proposing it. It is a legibility device, not a ground truth: it lets a researcher glance at a
 * ranked list and see roughly *why* something is near the top, without pretending the
 * threshold numbers are principled beyond "cheap heuristic that reads well," or that a high
 * vote count means scholarly consensus rather than visitor agreement with a TSK-derived link.
 *
 * Pure and DB-free on purpose — the panel, the graph, and the API route all need the same
 * tiering, and this is the one place it is allowed to live.
 */

export type XrefTier = "strong" | "moderate" | "light";

const STRONG_MIN = 20;
const MODERATE_MIN = 5;

export function xrefTier(votes: number): XrefTier {
  if (votes >= STRONG_MIN) return "strong";
  if (votes >= MODERATE_MIN) return "moderate";
  return "light";
}

export interface TierMeta {
  label: string;
  /** Shown as a legend / tooltip so "strong" never reads as a claim about theological weight. */
  description: string;
}

export const TIER_META: Record<XrefTier, TierMeta> = {
  // These describe a popularity signal and must not be written as though they described
  // scholarly agreement. A vote is an OpenBible.info visitor rating the relevance of a link
  // that was already in the compiled set (mostly the Treasury of Scripture Knowledge) — it is
  // not a scholar proposing the connection, and no count of them is a consensus.
  strong: {
    label: "Strong",
    description: `${STRONG_MIN}+ votes — rated highly relevant by many OpenBible.info visitors.`,
  },
  moderate: {
    label: "Moderate",
    description: `${MODERATE_MIN}-${STRONG_MIN - 1} votes — rated relevant by a moderate number of visitors.`,
  },
  light: {
    label: "Light",
    description: `Under ${MODERATE_MIN} votes — few visitor ratings. Sparse evidence of relevance, not evidence against it.`,
  },
};
