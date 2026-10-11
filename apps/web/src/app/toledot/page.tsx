import Link from "next/link";
import { ArrowSquare } from "@/components/ArrowSquare";

import { shareMetadata } from "@/app/og/data";
import { GlossLabel } from "@/components/GlossLabel";
import { CatalogueRow } from "@/components/toledot/CatalogueRow";
import { Citations } from "@/components/toledot/Citations";
import { EraChips } from "@/components/toledot/EraChips";
import { ISSUE_KIND } from "@/components/toledot/Lists";
import { TimelineStrip } from "@/components/toledot/TimelineStrip";
import {
  getEras,
  getIssueSummaries,
  getPersons,
  getTimelineBuildId,
  getTimelineWindow,
  listIssueIds,
  type Era,
  type EventSummary,
  type IssueSummary,
  type PersonSummary,
} from "@/lib/db/timeline";
import { AXES, type Axis } from "@/lib/timeline/axes";
import { sortByYear } from "@/lib/timeline/catalogue";
import { defaultWindow } from "@/lib/timeline/strip-layout";
import { formatRange, withDisplay } from "@/lib/timeline/years";

// timeline.db is deployed separately from the build, so this reads it per request.
export const dynamic = "force-dynamic";

/** Wider than anything the content holds; the strip then narrows to the events themselves. */
const ALL_TIME = { from: -4000, to: 400 };

const AXIS_HEADING: Record<Axis, string> = {
  narrative: "What happened",
  composition: "When the books were written",
  canon: "When they became scripture",
};

export function generateMetadata() {
  const metadata = shareMetadata(
    "Toledot: Bible timeline with dated ranges and evidence · Jot",
    "When the events of the Bible happened, when its books were written and when they became scripture: every date a range, with the scholarly positions, arguments and outside evidence behind it.",
    "/toledot",
    { card: { kind: "page", page: "toledot" } },
  );
  return getTimelineBuildId() === null ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function ToledotPage({ searchParams }: { searchParams: Promise<{ era?: string }> }) {
  const { era: eraParam } = await searchParams;
  const all = getTimelineWindow(ALL_TIME);
  if (!all.available) return <Unavailable />;

  const eras = getEras();
  const era = eras.find((candidate) => candidate.id === eraParam) ?? null;
  const window = era ? getTimelineWindow({ from: era.start, to: era.end }) : all;
  const { from, to } = era ? { from: era.start, to: era.end } : defaultWindow(window.events);
  const persons = getPersons();
  const issues = getIssueSummaries(listIssueIds());

  return (
    <div className="toledot-home">
      <header className="toledot-home__header">
        <h1 className="toledot-home__title">
          <GlossLabel id="toledot" as="strong" />
        </h1>
        <p className="toledot-home__lede">
          Scholars often disagree about dates, so each date here is a span of years, not a single year. Click
          any date to see who argues what, and why. Three questions get their own line: when things
          happened, when the books were written, and when people began treating them as scripture.
        </p>
      </header>

      <EraChips eras={eras} selected={era?.id ?? null} />

      <TimelineStrip
        eras={window.eras}
        events={window.events.map(withDisplay)}
        from={from}
        to={to}
        maxRows={4}
        overflowHref={`/toledot/events#${era?.id ?? ""}`}
      />

      {era ? (
        <EraRegister era={era} events={window.events} persons={persons} issues={issues} />
      ) : (
        <AllErasRegister eventCount={all.events.length} personCount={persons.length} issueCount={issues.length} />
      )}
    </div>
  );
}

/** How many rows a hub list shows before handing over to the full index; a phone screen holds about five. */
const HUB_ROWS = 8;

function MoreLink({ hidden, href, noun }: { hidden: number; href: string; noun: string }) {
  if (hidden <= 0) return null;
  return (
    <Link href={href} className="toledot-era-register__all">
      {hidden} more {hidden === 1 ? noun : `${noun}s`} in the full list
      <ArrowSquare size="sm" />
    </Link>
  );
}

/**
 * Everything that belongs to the chosen era, as the same rows the indexes use: events by axis,
 * then the people alive in it and the questions anchored in it. An event is in the era when its
 * earliest scholarly year is; a person or question by its first year, so the three lists agree
 * with the index pages' era sections. Each list stops at HUB_ROWS and points to the index.
 */
function EraRegister({ era, events, persons, issues }: { era: Era; events: readonly EventSummary[]; persons: readonly PersonSummary[]; issues: readonly IssueSummary[] }) {
  const inEra = (year: number | null) => year !== null && year >= era.start && year <= era.end;
  const eraEvents = sortByYear(events.filter((event) => inEra(event.earliest)), (event) => event.earliest);
  const eraPersons = sortByYear(persons.filter((person) => inEra(person.firstYear)), (person) => person.firstYear);
  const eraIssues = sortByYear(issues.filter((issue) => inEra(issue.firstYear)), (issue) => issue.firstYear);

  return (
    <>
      <section className="toledot-era-intro" aria-labelledby="toledot-era-title">
        <h2 id="toledot-era-title" className="toledot-section__title">
          {era.name} <span className="toledot-chip__span">{formatRange(era.start, era.end)}</span>
        </h2>
        <p className="toledot-prose">{era.summary}</p>
        <Citations citations={era.citations} />
      </section>

      <div className="toledot-era-register">
        <section className="toledot-era-register__group toledot-era-register__events" aria-labelledby="toledot-era-events">
          <h2 id="toledot-era-events" className="toledot-section__title">
            {eraEvents.length} {eraEvents.length === 1 ? "event" : "events"} in this era
          </h2>
          {AXES.map((axis) => {
            const all = eraEvents.filter((event) => event.axis === axis);
            if (all.length === 0) return null;
            const rows = all.slice(0, HUB_ROWS);
            return (
              <div key={axis}>
                <h3 className="toledot-era-register__axis" data-axis={axis}>{AXIS_HEADING[axis]}</h3>
                <ol className="toledot-rows">
                  {rows.map((event) => (
                    <CatalogueRow
                      key={event.id}
                      href={`/toledot/events/${event.id}`}
                      title={event.title}
                      when={formatRange(event.earliest, event.latest)}
                      gist={event.gist}
                      marks={[{ text: event.confidence, tone: "confidence" }]}
                    />
                  ))}
                </ol>
                <MoreLink hidden={all.length - rows.length} href={`/toledot/events#${era.id}`} noun="event" />
              </div>
            );
          })}
          <Link href={`/toledot/events#${era.id}`} className="toledot-era-register__all">All events, every era<ArrowSquare size="sm" /></Link>
        </section>

        <section className="toledot-era-register__group" aria-labelledby="toledot-era-people">
          <h2 id="toledot-era-people" className="toledot-section__title">People</h2>
          {eraPersons.length === 0 ? (
            <p className="toledot-empty">No one on the timeline is placed in this era yet.</p>
          ) : (
            <ol className="toledot-rows">
              {eraPersons.slice(0, HUB_ROWS).map((person) => (
                <CatalogueRow
                  key={person.id}
                  href={`/toledot/people/${person.id}`}
                  title={person.name}
                  when={person.lived ? formatRange(person.lived.earliest, person.lived.latest) : null}
                  gist={person.role}
                  marks={[]}
                  evidence={{ grade: person.evidence, hasTension: person.hasTension }}
                />
              ))}
            </ol>
          )}
          <MoreLink hidden={eraPersons.length - HUB_ROWS} href={`/toledot/people#${era.id}`} noun="person" />
          <Link href={`/toledot/people#${era.id}`} className="toledot-era-register__all">All people<ArrowSquare size="sm" /></Link>
        </section>

        <section className="toledot-era-register__group" aria-labelledby="toledot-era-issues">
          <h2 id="toledot-era-issues" className="toledot-section__title">Open questions</h2>
          {eraIssues.length === 0 ? (
            <p className="toledot-empty">No open question is anchored in this era yet.</p>
          ) : (
            <ol className="toledot-rows">
              {eraIssues.slice(0, HUB_ROWS).map((issue) => (
                <CatalogueRow
                  key={issue.id}
                  href={`/toledot/issues/${issue.id}`}
                  title={issue.title}
                  when={null}
                  gist={issue.gist}
                  marks={[{ text: `${ISSUE_KIND[issue.kind]} question`, tone: "kind" }]}
                />
              ))}
            </ol>
          )}
          <MoreLink hidden={eraIssues.length - HUB_ROWS} href={`/toledot/issues#${era.id}`} noun="question" />
          <Link href={`/toledot/issues#${era.id}`} className="toledot-era-register__all">All open questions<ArrowSquare size="sm" /></Link>
        </section>
      </div>
    </>
  );
}

/** With no era chosen: where to go next, with the counts, so the page says what it holds. */
function AllErasRegister({ eventCount, personCount, issueCount }: { eventCount: number; personCount: number; issueCount: number }) {
  return (
    <section className="toledot-era-intro" aria-labelledby="toledot-browse">
      <h2 id="toledot-browse" className="toledot-section__title">Browse everything</h2>
      <p className="toledot-prose">
        Pick an era above to see its events, people and open questions together, or go straight to a full list.
      </p>
      <ul className="toledot-rows">
        <CatalogueRow href="/toledot/events" title={`${eventCount} events`} when={null} gist="From the patriarchs to the writing of the New Testament, each with the span of years scholars give it." marks={[]} />
        <CatalogueRow href="/toledot/people" title={`${personCount} people`} when={null} gist="Kings, prophets, apostles and the people around them, with what sources outside the Bible say." marks={[]} />
        <CatalogueRow href="/toledot/issues" title={`${issueCount} open questions`} when={null} gist="Where the sources, the manuscripts, or the Bible's own numbers disagree, with each view side by side." marks={[]} />
      </ul>
    </section>
  );
}

function Unavailable() {
  return (
    <div className="toledot-home toledot-home--empty">
      <h1 className="toledot-home__title">
        <GlossLabel id="toledot" as="strong" />
      </h1>
      <p className="toledot-home__lede">
        The timeline is not available on this server yet, so there is nothing to show here. The reader, search
        and cross-references still work.
      </p>
      <Link href="/#browse" className="toledot-link">Browse the books of the Bible</Link>
    </div>
  );
}
