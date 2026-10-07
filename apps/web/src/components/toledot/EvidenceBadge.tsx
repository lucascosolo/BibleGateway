import clsx from "clsx";

import type { EvidenceGrade } from "@/lib/db/timeline";

/** One line per grade: what a reader should take the word to mean. */
export const EVIDENCE_MEANING: Record<EvidenceGrade, string> = {
  corroborates: "Named by a source outside the Bible",
  "partially-corroborates": "Partly confirmed; the reading is disputed",
  consistent: "Fits an outside source without naming them",
  silent: "Outside sources exist but say nothing",
  none: "No outside evidence",
};

export const TENSION_MEANING = "An outside source contradicts a biblical detail about them";

/**
 * The derived evidence grade as a word. Its meaning travels in the accessible name, and with
 * `explain` also as a visible caption; the tint is a third carrier, never the only one.
 */
export function EvidenceBadge({ grade, hasTension, explain = false }: { grade: EvidenceGrade; hasTension: boolean; explain?: boolean }) {
  const label = `Outside evidence: ${grade}. ${EVIDENCE_MEANING[grade]}.${hasTension ? ` ${TENSION_MEANING}.` : ""}`;
  return (
    <span className="toledot-evidence">
      <span role="img" aria-label={label} className="toledot-evidence__marks">
        <span className={clsx("toledot-evidence__grade", `toledot-evidence__grade--${grade}`)}>{grade}</span>
        {hasTension ? <span className="toledot-evidence__tension">tension</span> : null}
      </span>
      {explain ? (
        <span aria-hidden="true" className="toledot-evidence__meaning">
          {EVIDENCE_MEANING[grade]}.{hasTension ? ` ${TENSION_MEANING}.` : ""}
        </span>
      ) : null}
    </span>
  );
}
