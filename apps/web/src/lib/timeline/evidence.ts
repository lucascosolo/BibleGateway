import type { EvidenceGrade } from "@/lib/db/timeline";

/**
 * What each evidence grade means, in one sentence a reader can take at face value. Shared by
 * `EvidenceBadge` and the reader's timeline notes (`notes.ts`) so the two cannot drift.
 */
export const EVIDENCE_MEANING: Record<EvidenceGrade, string> = {
  corroborates: "Named by a source outside the Bible",
  "partially-corroborates": "Partly confirmed by an outside source",
  consistent: "Fits an outside source",
  silent: "Outside sources are silent",
  none: "No outside evidence",
};

export const TENSION_MEANING = "An outside source contradicts a biblical detail about them";
