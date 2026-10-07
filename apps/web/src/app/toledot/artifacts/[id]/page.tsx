import Link from "next/link";
import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { Citations } from "@/components/toledot/Citations";
import { EntitySection, EntityShell } from "@/components/toledot/EntityShell";
import { RELATION_HEADING, RELATION_ORDER } from "@/components/toledot/RelationGroup";
import { ToledotStructuredData } from "@/components/toledot/ToledotStructuredData";
import { VerseLinks } from "@/components/toledot/VerseLinks";
import { getArtifact, type Relation } from "@/lib/db/timeline";
import { labelVerses } from "@/lib/db/timeline-present";
import { excerpt } from "@/lib/seo";
import { formatRange, formatYear } from "@/lib/timeline/years";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const artifact = getArtifact((await params).id);
  if (!artifact) notFound();
  const made = artifact.made ? `made ${formatRange(artifact.made.earliest, artifact.made.latest)}` : "date not established";
  return shareMetadata(
    `${artifact.name}: what it attests · Toledot · Jot`,
    excerpt(`${artifact.name}, ${artifact.kind}, ${made}. ${artifact.summary}`, 200),
    `/toledot/artifacts/${artifact.id}`,
    { card: { kind: "page", page: "toledot" } },
  );
}

const byRelation = <T extends { relation: Relation }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation));

export default async function ArtifactPage({ params }: Props) {
  const artifact = getArtifact((await params).id);
  if (!artifact) notFound();
  const attests = [
    ...artifact.attestations.map((row) => ({ ...row, href: `/toledot/events/${row.eventId}`, name: row.eventTitle, what: "event" })),
    ...artifact.persons.map((row) => ({ ...row, href: `/toledot/people/${row.personId}`, name: row.personName, what: "person" })),
  ];

  return (
    <EntityShell
      title={artifact.name}
      status={artifact.status}
      meta={<>{artifact.kind} · {artifact.language}</>}
    >
      <ToledotStructuredData kind="artifact" artifact={artifact} />
      <dl className="toledot-facts">
        <dt>Made</dt>
        <dd>{artifact.made ? formatRange(artifact.made.earliest, artifact.made.latest) : "Date not established"}</dd>
        {artifact.discovered ? (
          <>
            <dt>Discovered</dt>
            <dd>
              {[artifact.discovered.year ? formatYear(artifact.discovered.year) : null, artifact.discovered.place].filter(Boolean).join(", ")}
            </dd>
          </>
        ) : null}
        <dt>Held by</dt>
        <dd>
          {artifact.heldBy
            ? <>{artifact.heldBy.institution}{artifact.heldBy.accession ? <>, <span className="toledot-facts__accession">{artifact.heldBy.accession}</span></> : null}</>
            : "Not recorded"}
        </dd>
      </dl>
      <p className="toledot-prose">{artifact.summary}</p>
      <Citations citations={artifact.citations} />
      <VerseLinks verses={labelVerses(artifact.verses)} />

      {attests.length ? (
        <EntitySection title="What it attests">
          <ul className="toledot-relations__list">
            {byRelation(attests).map((row) => (
              <li key={row.id} className="toledot-relations__item">
                <Link href={row.href} className="toledot-link">{row.name}</Link>
                <span className="toledot-relations__kind"> · {row.what} · {RELATION_HEADING[row.relation].toLowerCase()}</span>
                {row.note ? <p className="toledot-prose toledot-prose--small">{row.note}</p> : null}
                <Citations citations={row.citations} />
              </li>
            ))}
          </ul>
        </EntitySection>
      ) : null}

      <p className="toledot-entity__foot">
        <Link href={`/api/timeline/artifacts/${artifact.id}`} className="toledot-link">This artifact as JSON</Link>
      </p>
    </EntityShell>
  );
}
