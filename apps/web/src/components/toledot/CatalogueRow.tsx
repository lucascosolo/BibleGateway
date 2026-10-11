import Link from "next/link";

import { EvidenceBadge } from "@/components/toledot/EvidenceBadge";
import type { EvidenceGrade } from "@/lib/db/timeline";

export interface RowMark {
  text: string;
  tone?: "axis" | "confidence" | "kind";
}

export interface CatalogueRowProps {
  href: string;
  title: string;
  when: string | null;
  gist: string;
  marks: RowMark[];
  evidence?: { grade: EvidenceGrade; hasTension: boolean };
}

/** One row of an index: title, date span, one-line gist and small marks. Shared by all three kinds. */
export function CatalogueRow({ href, title, when, gist, marks, evidence }: CatalogueRowProps) {
  return (
    <li className="toledot-row">
      <div className="toledot-row__head">
        <Link prefetch={false} className="toledot-row__title toledot-link" href={href}>
          {title}
        </Link>
        {when && <span className="toledot-row__when">{when}</span>}
      </div>
      {gist && <p className="toledot-row__gist">{gist}</p>}
      <div className="toledot-row__marks">
        {marks.map((mark) => (
          <span key={mark.text} className="toledot-row__mark" data-tone={mark.tone}>
            {mark.text}
          </span>
        ))}
        {evidence && <EvidenceBadge grade={evidence.grade} hasTension={evidence.hasTension} />}
      </div>
    </li>
  );
}
