import Link from "next/link";

import type { EventAttestation, Relation } from "@/lib/db/timeline";

import { Citations } from "./Citations";

export const RELATION_ORDER: readonly Relation[] = ["corroborates", "partially-corroborates", "consistent", "silent", "in-tension"];

export const RELATION_HEADING: Record<Relation, string> = {
  corroborates: "Corroborates",
  "partially-corroborates": "Partially corroborates",
  consistent: "Consistent with",
  silent: "Silent on",
  "in-tension": "In tension with",
};

/** Attestations grouped under one heading per relation, in a fixed order; empty relations are left out. */
export function RelationGroup({ attestations, level = 3 }: { attestations: readonly EventAttestation[]; level?: 2 | 3 | 4 }) {
  const Heading = `h${level}` as const;
  return (
    <div className="toledot-relations">
      {RELATION_ORDER.map((relation) => {
        const items = attestations.filter((attestation) => attestation.relation === relation);
        if (items.length === 0) return null;
        return (
          <section key={relation} className="toledot-relations__group" data-relation={relation}>
            <Heading className="toledot-relations__heading">{RELATION_HEADING[relation]}</Heading>
            <ul className="toledot-relations__list">
              {items.map((item) => (
                <li key={item.id} className="toledot-relations__item">
                  <Link prefetch={false} href={`/toledot/artifacts/${item.artifactId}`} className="toledot-link">
                    {item.artifactName}
                  </Link>
                  <span className="toledot-relations__kind"> · {item.artifactKind}</span>
                  {item.note ? <p className="toledot-prose toledot-prose--small">{item.note}</p> : null}
                  <Citations citations={item.citations} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
