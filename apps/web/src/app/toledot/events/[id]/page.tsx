import Link from "next/link";
import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { Citations } from "@/components/toledot/Citations";
import { EntitySection, EntityShell, RangeTrack } from "@/components/toledot/EntityShell";
import { EntityTimeline } from "@/components/toledot/EntityTimeline";
import { IssueList } from "@/components/toledot/Lists";
import { RelationGroup } from "@/components/toledot/RelationGroup";
import { ToledotStructuredData } from "@/components/toledot/ToledotStructuredData";
import { VerseLinks } from "@/components/toledot/VerseLinks";
import { getEvent, getIssueSummaries, type Position } from "@/lib/db/timeline";
import { bookNames, labelVerses } from "@/lib/db/timeline-present";
import { excerpt } from "@/lib/seo";
import { orderPositions, splitPositions } from "@/lib/timeline/lens";
import { AXIS_DATE_LABEL } from "@/lib/timeline/axes";
import { formatRange } from "@/lib/timeline/years";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const TRADITIONAL_CAVEAT =
  "These dates come from adding up the Bible's own numbers, such as reign lengths and life spans. They are a long-standing way of reading the text, not evidence from archaeology or from records outside the Bible. Each one says whose count it is.";

function PositionList({ positions, from, to }: { positions: readonly Position[]; from: number; to: number }) {
  return (
    <ol className="toledot-positions">
      {positions.map((position) => (
        <li key={position.id} className="toledot-position">
          <h3 className="toledot-position__label">{position.label}</h3>
          <p className="toledot-position__meta">
            <span className="toledot-position__range">{formatRange(position.earliest, position.latest)}</span>
            {" · "}{position.tradition}
            {position.heldBy ? <> · held by {position.heldBy}</> : null}
          </p>
          <RangeTrack from={from} to={to} earliest={position.earliest} latest={position.latest} />
          <p className="toledot-prose">{position.summary}</p>
          <Citations citations={position.citations} />
          {(["for", "against"] as const).map((stance) => {
            const args = position.arguments.filter((argument) => argument.stance === stance);
            if (args.length === 0) return null;
            return (
              <div key={stance} className="toledot-arguments" data-stance={stance}>
                <h4 className="toledot-arguments__heading">{stance === "for" ? "For" : "Against"}</h4>
                <ul className="toledot-arguments__list">
                  {args.map((argument) => (
                    <li key={argument.id}>
                      <p className="toledot-prose toledot-prose--small">{argument.text}</p>
                      <VerseLinks verses={labelVerses(argument.verses)} />
                      <Citations citations={argument.citations} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </li>
      ))}
    </ol>
  );
}

export async function generateMetadata({ params }: Props) {
  const event = getEvent((await params).id);
  if (!event) notFound();
  const range = formatRange(event.earliest, event.latest);
  return shareMetadata(
    `${event.title}: dated ${range} · Toledot · Jot`,
    excerpt(`${event.title}, ${range} (${event.confidence}). ${event.positions.length} position${event.positions.length === 1 ? "" : "s"} with arguments and sources. ${event.summary}`, 200),
    `/toledot/events/${event.id}`,
    { card: { kind: "page", page: "toledot" } },
  );
}

export default async function EventPage({ params }: Props) {
  const event = getEvent((await params).id);
  if (!event) notFound();
  const books = bookNames(event.bookIds);
  const issues = getIssueSummaries(event.issueIds);
  const { scholarly, traditional } = splitPositions(event.positions);
  // Dates for the writing of the story, on their own scale: they never widen the event's.
  const written = orderPositions(event.compositionPositions);
  // The tracks share one scale across both sections, so a traditional count far from the
  // evidence reads as far.
  const trackFrom = Math.min(event.earliest, event.traditional?.earliest ?? event.earliest);
  const trackTo = Math.max(event.latest, event.traditional?.latest ?? event.latest);

  return (
    <EntityShell
      title={event.title}
      status={event.status}
      timeline={<EntityTimeline entries={[event]} label="this event" placeKey={`/toledot/events/${event.id}`} />}
      meta={
        <>
          {AXIS_DATE_LABEL[event.axis]}: <strong>{formatRange(event.earliest, event.latest)}</strong>
          {scholarly.length === 0 ? " (traditional count)" : null} · {event.confidence} dating
          {books.length ? <> · {books.join(", ")}</> : null}
        </>
      }
    >
      <ToledotStructuredData kind="event" event={event} />
      <p className="toledot-prose">{event.summary}</p>
      <VerseLinks verses={labelVerses(event.verses)} />

      <EntitySection title="What the evidence supports">
        {scholarly.length ? (
          <PositionList positions={scholarly} from={trackFrom} to={trackTo} />
        ) : (
          <p className="toledot-draft">No archaeological or critical dating is on file for this event yet.</p>
        )}
      </EntitySection>

      {traditional.length ? (
        <EntitySection title="Traditional chronology">
          <p className="toledot-draft toledot-lens-caveat">{TRADITIONAL_CAVEAT}</p>
          <PositionList positions={traditional} from={trackFrom} to={trackTo} />
        </EntitySection>
      ) : null}

      {written.length ? (
        <EntitySection title="When the story was written">
          <PositionList
            positions={written}
            from={Math.min(...written.map((p) => p.earliest))}
            to={Math.max(...written.map((p) => p.latest))}
          />
        </EntitySection>
      ) : null}

      {event.attestations.length ? (
        <EntitySection title="Outside evidence">
          <RelationGroup attestations={event.attestations} />
        </EntitySection>
      ) : null}

      {issues.length ? (
        <EntitySection title="Open questions">
          <IssueList issues={issues} />
        </EntitySection>
      ) : null}

      <p className="toledot-entity__foot">
        <Link href={`/api/timeline/events/${event.id}`} className="toledot-link">This event as JSON</Link>
      </p>
    </EntityShell>
  );
}
