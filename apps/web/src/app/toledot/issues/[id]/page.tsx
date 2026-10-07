import Link from "next/link";
import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { Citations } from "@/components/toledot/Citations";
import { EntitySection, EntityShell } from "@/components/toledot/EntityShell";
import { EventList, ISSUE_KIND } from "@/components/toledot/Lists";
import { ToledotStructuredData } from "@/components/toledot/ToledotStructuredData";
import { VerseLinks } from "@/components/toledot/VerseLinks";
import { getEventSummaries, getIssue } from "@/lib/db/timeline";
import { labelVerses } from "@/lib/db/timeline-present";
import { excerpt } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const issue = getIssue((await params).id);
  if (!issue) notFound();
  return shareMetadata(
    `${issue.title} · Toledot · Jot`,
    excerpt(`${issue.views.length} views, each with its sources. ${issue.summary}`, 200),
    `/toledot/issues/${issue.id}`,
    { card: { kind: "page", page: "toledot" } },
  );
}

export default async function IssuePage({ params }: Props) {
  const issue = getIssue((await params).id);
  if (!issue) notFound();
  const events = getEventSummaries(issue.eventIds);

  return (
    <EntityShell title={issue.title} status={issue.status} meta={<>{ISSUE_KIND[issue.kind]} question · {issue.views.length} views</>}>
      <ToledotStructuredData kind="issue" issue={issue} />
      <p className="toledot-prose">{issue.summary}</p>
      <Citations citations={issue.citations} />
      <VerseLinks verses={labelVerses(issue.verses)} />

      <EntitySection title="The views">
        <ol className="toledot-positions">
          {issue.views.map((view) => (
            <li key={view.id} className="toledot-position">
              <h3 className="toledot-position__label">{view.label}</h3>
              <p className="toledot-prose">{view.text}</p>
              <Citations citations={view.citations} />
            </li>
          ))}
        </ol>
      </EntitySection>

      {events.length ? (
        <EntitySection title="On the timeline">
          <EventList events={events} />
        </EntitySection>
      ) : null}

      <p className="toledot-entity__foot">
        <Link href={`/api/timeline/issues/${issue.id}`} className="toledot-link">This question as JSON</Link>
      </p>
    </EntityShell>
  );
}
