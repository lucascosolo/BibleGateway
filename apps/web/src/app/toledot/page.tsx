import Link from "next/link";

import { shareMetadata } from "@/app/og/data";
import { GlossLabel } from "@/components/GlossLabel";
import { DraftNotice } from "@/components/toledot/DraftNotice";
import { EvidenceBadge } from "@/components/toledot/EvidenceBadge";
import { IssueList } from "@/components/toledot/Lists";
import { TimelineStrip } from "@/components/toledot/TimelineStrip";
import { getIssueSummaries, getPersons, getTimelineBuildId, getTimelineWindow, listIssueIds } from "@/lib/db/timeline";
import { defaultWindow } from "@/lib/timeline/strip-layout";
import { formatRange, withDisplay } from "@/lib/timeline/years";

// timeline.db is deployed separately from the build, so this reads it per request.
export const dynamic = "force-dynamic";

/** Wider than anything the content holds; the strip then narrows to the events themselves. */
const ALL_TIME = { from: -4000, to: 400 };

export function generateMetadata() {
  const metadata = shareMetadata(
    "Toledot: Bible timeline with dated ranges and evidence · Jot",
    "When the events of the Bible happened, when its books were written and when they became scripture: every date a range, with the scholarly positions, arguments and outside evidence behind it.",
    "/toledot",
    { card: { kind: "page", page: "toledot" } },
  );
  return getTimelineBuildId() === null ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default function ToledotPage() {
  const window = getTimelineWindow(ALL_TIME);
  if (!window.available) return <Unavailable />;

  const { from, to } = defaultWindow(window.events);
  const persons = getPersons();
  const issues = getIssueSummaries(listIssueIds());

  return (
    <div className="toledot-home">
      <header className="toledot-home__header">
        <h1 className="toledot-home__title">
          <GlossLabel id="toledot" as="strong" />
        </h1>
        <p className="toledot-home__lede">
          Every date here is a range, never a point: the envelope of what serious scholars argue, with each
          position, its reasons and its sources one click away. Three questions are kept apart on three
          rules — when the events happened, when the texts were written, and when they were recognised as
          scripture.
        </p>
        <DraftNotice scope="the timeline" />
      </header>

      <TimelineStrip eras={window.eras} events={window.events.map(withDisplay)} from={from} to={to} />

      <div className="toledot-register">
        <section className="toledot-register__column" aria-labelledby="toledot-people">
          <h2 id="toledot-people" className="toledot-section__title">People</h2>
          <p className="toledot-register__note">
            Ordered by when they lived. The grade says how far sources outside the Bible bear on whether
            they existed; it is derived from the evidence listed on each page.
          </p>
          <ul className="toledot-index">
            {persons.map((person) => (
              <li key={person.id} className="toledot-index__row toledot-index__row--person">
                <span className="toledot-index__lead">
                  <Link href={`/toledot/people/${person.id}`} className="toledot-link">{person.name}</Link>
                  <span className="toledot-index__aside">
                    {person.role}
                    {person.lived ? ` · ${formatRange(person.lived.earliest, person.lived.latest)}` : ""}
                  </span>
                </span>
                <EvidenceBadge grade={person.evidence} hasTension={person.hasTension} />
              </li>
            ))}
          </ul>
        </section>
        <section className="toledot-register__column" aria-labelledby="toledot-issues">
          <h2 id="toledot-issues" className="toledot-section__title">Open questions</h2>
          <p className="toledot-register__note">
            Where the sources, or the Bible&rsquo;s own numbers, do not agree — set out view by view.
          </p>
          <IssueList issues={issues} />
        </section>
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="toledot-home toledot-home--empty">
      <h1 className="toledot-home__title">
        <GlossLabel id="toledot" as="strong" />
      </h1>
      <p className="toledot-home__lede">
        The timeline&rsquo;s data is not deployed on this server, so there is nothing to chart here yet. The
        reader, search and cross-references are unaffected.
      </p>
      <Link href="/#browse" className="toledot-link">Browse the books of the Bible</Link>
    </div>
  );
}
