/**
 * What a heat bucket actually means.
 *
 * `verse_reference_heat.heat_bucket` (1-5) is an `NTILE(5)` over inbound cross-reference
 * COUNT — a quintile of raw reference density, not a measure of theological or doctrinal
 * importance. Plenty of load-bearing verses have low inbound counts simply because they are
 * not the kind of verse other passages quote or allude back to. This module exists so every
 * place the app explains heat says the same honest thing rather than each writing its own
 * (inevitably drifting) description.
 *
 * §3.4 of ARCHITECTURE.md notes a `pagerank` column is planned for a genuinely different
 * "foundational passage" signal — heat is deliberately not that, and should not be presented
 * as if it were.
 */

export interface HeatBucketInfo {
  bucket: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
}

export const HEAT_EXPLAINER =
  "Reference density, not importance. This counts how many other passages in OpenBible's " +
  "vote-weighted cross-reference dataset point here — a highly quoted or alluded-to verse " +
  "runs hot; a foundational verse nobody happens to cite back to does not.";

export const HEAT_BUCKET_INFO: Record<number, HeatBucketInfo> = {
  0: {
    bucket: 0,
    label: "No inbound references",
    description: "No cataloged cross-reference in the dataset points to this verse.",
  },
  1: {
    bucket: 1,
    label: "Lowest quintile",
    description: "Among the least-referenced fifth of verses that have any inbound references at all.",
  },
  2: {
    bucket: 2,
    label: "Low",
    description: "Below-average inbound reference count.",
  },
  3: {
    bucket: 3,
    label: "Middle",
    description: "Typical inbound reference count for a referenced verse.",
  },
  4: {
    bucket: 4,
    label: "High",
    description: "Above-average inbound reference count — frequently quoted or alluded to.",
  },
  5: {
    bucket: 5,
    label: "Highest quintile",
    description: "Among the most-referenced fifth of verses — a hub other passages repeatedly point back to.",
  },
};

export function heatBucketInfo(bucket: number): HeatBucketInfo {
  return HEAT_BUCKET_INFO[bucket] ?? HEAT_BUCKET_INFO[0];
}
