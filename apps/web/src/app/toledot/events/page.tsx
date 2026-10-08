import Link from "next/link";

import { shareMetadata } from "@/app/og/data";
import { CatalogueIndex, type CatalogueItem } from "@/components/toledot/CatalogueIndex";
import { getAllEventSummaries, getBookNames, getEras, getTimelineBuildId } from "@/lib/db/timeline";
import { formatRange } from "@/lib/timeline/years";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const metadata = shareMetadata(
    "Bible events with dated ranges · Toledot · Jot",
    "Every event on the Bible timeline, grouped by era, with the span of years scholars give it.",
    "/toledot/events",
    { card: { kind: "page", page: "toledot" } },
  );
  return getTimelineBuildId() === null ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

const AXIS_LABEL = { narrative: "what happened", composition: "when written", canon: "made scripture" } as const;

export default function EventsIndexPage() {
  const events = getAllEventSummaries();
  const items: CatalogueItem[] = events.map((event) => ({
    id: event.id,
    href: `/toledot/events/${event.id}`,
    title: event.title,
    when: formatRange(event.earliest, event.latest),
    year: event.earliest,
    book: event.firstVerse === null ? null : Math.floor(event.firstVerse / 1_000_000),
    gist: event.gist,
    searchText: [event.title, event.gist, event.axis, event.confidence, event.category].join(" "),
    facets: { axis: event.axis, confidence: event.confidence },
    marks: [
      { text: event.axis, tone: "axis" },
      { text: event.confidence, tone: "confidence" },
    ],
  }));

  return (
    <div className="toledot-catalogue">
      <nav aria-label="Breadcrumb" className="toledot-entity__crumb">
        <Link href="/toledot">← Timeline</Link>
      </nav>
      <h1 className="toledot-home__title">Events</h1>
      <p className="toledot-home__lede">
        Everything on the timeline, from the stories to the writing of the books, each with the span of years scholars give it.
      </p>
      <CatalogueIndex
        kind="events"
        eras={getEras().map(({ id, name, start, end }) => ({ id, name, start, end }))}
        books={[...getBookNames()]}
        items={items}
        countNoun="events"
        chips={[
          {
            key: "axis",
            label: "Kind of date",
            values: Object.entries(AXIS_LABEL).map(([value, label]) => ({ value, label })),
          },
          {
            key: "confidence",
            label: "Confidence",
            values: ["firm", "contested", "speculative"].map((value) => ({ value, label: value })),
          },
        ]}
      />
    </div>
  );
}
