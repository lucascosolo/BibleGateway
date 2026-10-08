import Link from "next/link";

import { shareMetadata } from "@/app/og/data";
import { CatalogueIndex, type CatalogueItem } from "@/components/toledot/CatalogueIndex";
import { getBookNames, getEras, getPersons, getTimelineBuildId, type EvidenceGrade } from "@/lib/db/timeline";
import { EVIDENCE_MEANING } from "@/lib/timeline/evidence";
import { formatRange } from "@/lib/timeline/years";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const metadata = shareMetadata(
    "People of the Bible and what outside sources say · Toledot · Jot",
    "The people on the Bible timeline, grouped by era, with how well sources outside the Bible bear them out.",
    "/toledot/people",
    { card: { kind: "page", page: "toledot" } },
  );
  return getTimelineBuildId() === null ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

const GRADES: EvidenceGrade[] = ["corroborates", "partially-corroborates", "consistent", "silent", "none"];

export default function PeopleIndexPage() {
  const items: CatalogueItem[] = getPersons().map((person) => ({
    id: person.id,
    href: `/toledot/people/${person.id}`,
    title: person.name,
    when: person.lived ? formatRange(person.lived.earliest, person.lived.latest) : null,
    year: person.firstYear,
    book: person.firstVerse === null ? null : Math.floor(person.firstVerse / 1_000_000),
    gist: person.gist,
    searchText: [person.name, person.role, person.gist].join(" "),
    facets: { evidence: person.evidence },
    marks: [],
    evidence: { grade: person.evidence, hasTension: person.hasTension },
  }));

  return (
    <div className="toledot-catalogue">
      <nav aria-label="Breadcrumb" className="toledot-entity__crumb">
        <Link href="/toledot">← Timeline</Link>
      </nav>
      <h1 className="toledot-home__title">People</h1>
      <p className="toledot-home__lede">
        The people named on the timeline, with when they lived and whether a source outside the Bible mentions them.
      </p>
      <CatalogueIndex
        kind="people"
        eras={getEras().map(({ id, name, start, end }) => ({ id, name, start, end }))}
        books={[...getBookNames()]}
        items={items}
        countNoun="people"
        chips={[
          {
            key: "evidence",
            label: "Outside evidence",
            values: GRADES.map((value) => ({ value, label: EVIDENCE_MEANING[value] })),
          },
        ]}
      />
    </div>
  );
}
