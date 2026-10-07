import clsx from "clsx";

import type { EvidenceGrade } from "@/lib/db/timeline";
import { EVIDENCE_MEANING, TENSION_MEANING } from "@/lib/timeline/evidence";

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
