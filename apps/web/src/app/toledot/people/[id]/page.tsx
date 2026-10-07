import Link from "next/link";
import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { Citations } from "@/components/toledot/Citations";
import { EntitySection, EntityShell } from "@/components/toledot/EntityShell";
import { EvidenceBadge } from "@/components/toledot/EvidenceBadge";
import { EVIDENCE_MEANING } from "@/lib/timeline/evidence";
import { EventList, IssueList } from "@/components/toledot/Lists";
import { RelationGroup } from "@/components/toledot/RelationGroup";
import { ToledotStructuredData } from "@/components/toledot/ToledotStructuredData";
import { VerseLinks } from "@/components/toledot/VerseLinks";
import { getEventSummaries, getIssueSummaries, getPerson } from "@/lib/db/timeline";
import { labelVerses } from "@/lib/db/timeline-present";
import { excerpt } from "@/lib/seo";
import { formatRange } from "@/lib/timeline/years";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const person = getPerson((await params).id);
  if (!person) notFound();
  return shareMetadata(
    `${person.name}: what outside evidence says · Toledot · Jot`,
    excerpt(`${person.name}, ${person.role}. Outside evidence: ${person.evidence} (${EVIDENCE_MEANING[person.evidence].toLowerCase()}). ${person.summary}`, 200),
    `/toledot/people/${person.id}`,
    { card: { kind: "page", page: "toledot" } },
  );
}

export default async function PersonPage({ params }: Props) {
  const person = getPerson((await params).id);
  if (!person) notFound();
  const events = getEventSummaries(person.eventIds);
  const issues = getIssueSummaries(person.issueIds);

  return (
    <EntityShell
      title={person.name}
      status={person.status}
      meta={
        <>
          {person.role}
          {person.lived ? <> · lived <strong>{formatRange(person.lived.earliest, person.lived.latest)}</strong></> : <> · dates not established</>}
          {person.alsoKnownAs.length ? <> · also {person.alsoKnownAs.join(", ")}</> : null}
        </>
      }
    >
      <ToledotStructuredData kind="person" person={person} />
      <div className="toledot-grade">
        <EvidenceBadge grade={person.evidence} hasTension={person.hasTension} explain />
      </div>
      <p className="toledot-prose">{person.summary}</p>
      <Citations citations={person.citations} />
      <VerseLinks verses={labelVerses(person.verses)} />

      {person.attestations.length ? (
        <EntitySection title="Outside evidence">
          <RelationGroup attestations={person.attestations} />
        </EntitySection>
      ) : null}

      {events.length ? (
        <EntitySection title="On the timeline">
          <EventList events={events} />
        </EntitySection>
      ) : null}

      {issues.length ? (
        <EntitySection title="Open questions">
          <IssueList issues={issues} />
        </EntitySection>
      ) : null}

      <p className="toledot-entity__foot">
        <Link href={`/api/timeline/persons/${person.id}`} className="toledot-link">This person as JSON</Link>
      </p>
    </EntityShell>
  );
}
