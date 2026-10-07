import Link from "next/link";

import type { EventSummary, IssueSummary } from "@/lib/db/timeline";
import { formatRange } from "@/lib/timeline/years";

export const ISSUE_KIND: Record<IssueSummary["kind"], string> = {
  chronology: "chronology",
  textual: "textual",
  historical: "historical",
  internal: "within the Bible",
};

export function EventList({ events }: { events: readonly EventSummary[] }) {
  if (events.length === 0) return null;
  return (
    <ul className="toledot-index">
      {events.map((event) => (
        <li key={event.id} className="toledot-index__row">
          <Link href={`/toledot/events/${event.id}`} className="toledot-link">{event.title}</Link>
          <span className="toledot-index__aside">
            {formatRange(event.earliest, event.latest)} · {event.axis} · {event.confidence}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function IssueList({ issues }: { issues: readonly IssueSummary[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="toledot-index">
      {issues.map((issue) => (
        <li key={issue.id} className="toledot-index__row">
          <Link href={`/toledot/issues/${issue.id}`} className="toledot-link">{issue.title}</Link>
          <span className="toledot-index__aside">{ISSUE_KIND[issue.kind]} question</span>
        </li>
      ))}
    </ul>
  );
}
