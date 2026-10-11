"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Era, EventSummary } from "@/lib/db/timeline";
import { AXES, type Axis } from "@/lib/timeline/axes";
import { layoutBars, limitRows, tickStep, yearOffset, yearTicks } from "@/lib/timeline/strip-layout";
import { formatRange, spanYears } from "@/lib/timeline/years";

import { YearAxis } from "./YearAxis";

/** 2.5px a year: the default window of a millennium and a half is about three desktop widths. */
const PX_PER_YEAR = 2.5;
/** Room a bar claims in its row for its caption, so short events never print over a neighbour. */
const LABEL_RESERVE = 208;
const ROW_HEIGHT = 58;

const AXIS_QUESTION: Record<Axis, string> = {
  narrative: "when the events happened",
  composition: "when the texts were written",
  canon: "when collections were recognised as scripture",
};

const CONFIDENCE_PHRASE: Record<EventSummary["confidence"], string> = {
  firm: "firm dating",
  contested: "contested dating",
  speculative: "speculative dating",
};

type StripEvent = EventSummary & { display: string };

/**
 * The traditional-chronology lens in the bar's own coordinates, clipped to the window. The dotted
 * line runs from the traditional envelope to the scholarly bar (their union), so a traditional date
 * centuries away still reads as belonging to this event rather than as a stray fragment.
 */
function traditionalExtent(event: StripEvent, from: number, to: number, barLeft: number) {
  if (!event.traditional) return null;
  const start = Math.min(Math.max(Math.min(event.traditional.earliest, event.earliest), from), to);
  const end = Math.max(Math.min(Math.max(event.traditional.latest, event.latest), to), from);
  return {
    left: yearOffset(from, start, PX_PER_YEAR) - barLeft,
    width: Math.max(spanYears(start, end) * PX_PER_YEAR, 8),
    label: `traditional chronology: ${formatRange(event.traditional.earliest, event.traditional.latest)}`,
  };
}

/**
 * The Toledot strip: three ruled lanes (one per axis, never merged onto one scale), each event
 * a range from its earliest to its latest year. Confidence is the rule's style AND a word, the
 * axis is the lane AND its label, so neither depends on colour or line style alone.
 */
export function TimelineStrip({
  eras,
  events,
  from,
  to,
  maxRows = 4,
  overflowHref,
}: {
  eras: readonly Era[];
  events: readonly StripEvent[];
  from: number;
  to: number;
  maxRows?: number;
  overflowHref?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const update = () => setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 1);
    update();
    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const width = spanYears(from, to) * PX_PER_YEAR;
  const step = tickStep(from, to);
  const percentPerYear = 100 / spanYears(from, to);
  const bars = layoutBars(events, from, to, PX_PER_YEAR, 8, LABEL_RESERVE);
  let hiddenCount = 0;
  const byId = new Map(events.map((event) => [event.id, event]));

  return (
    <figure className="toledot-strip">
      <figcaption className="toledot-strip__hint">
        {formatRange(from, to)}. Scroll sideways along the years; Tab moves through the events in date order.
      </figcaption>
      <div className="toledot-strip__frame" data-at-end={atEnd}>
      <div ref={viewport} className="toledot-strip__viewport" tabIndex={0} role="region" aria-label={`Timeline, ${formatRange(from, to)}`}>
        <div className="toledot-strip__canvas" style={{ width }}>
          <div className="toledot-strip__grid" aria-hidden="true">
            {yearTicks(from, to, step).map((year) => (
              <span key={year} style={{ left: `${yearOffset(from, year, percentPerYear)}%` }} />
            ))}
          </div>

          {eras.length > 0 ? (
            <ol className="toledot-eras" aria-label="Eras">
              {eras.map((era) => {
                const start = era.start < from ? from : era.start;
                const end = era.end > to ? to : era.end;
                return (
                  <li
                    key={era.id}
                    className="toledot-eras__era"
                    style={{ left: yearOffset(from, start, PX_PER_YEAR), width: spanYears(start, end) * PX_PER_YEAR }}
                  >
                    <span>{era.name}</span> <span className="toledot-eras__range">{formatRange(era.start, era.end)}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <YearAxis from={from} to={to} step={step} />

          {AXES.map((axis) => {
            const { drawn: laneBars, hidden } = limitRows(bars.filter((bar) => bar.axis === axis), maxRows);
            hiddenCount += hidden.length;
            const rows = laneBars.length === 0 ? 0 : Math.max(...laneBars.map((bar) => bar.lane + 1));
            return (
              <section
                key={axis}
                className="toledot-lane"
                data-axis={axis}
                aria-label={`${axis}: ${AXIS_QUESTION[axis]}`}
                style={{ height: rows === 0 ? 34 : rows * ROW_HEIGHT + 34 }}
              >
                <h3 className="toledot-lane__name">
                  <span className="toledot-lane__axis">{axis}</span>
                  <span className="toledot-lane__question">{AXIS_QUESTION[axis]}</span>
                </h3>
                {laneBars.length === 0 ? (
                  <p className="toledot-lane__empty">
                    {hidden.length > 0 ? "Events here are listed below the strip." : "Nothing dated on this axis yet."}
                  </p>
                ) : (
                  <ol className="toledot-lane__bars">
                    {laneBars.map((bar) => {
                      const event = byId.get(bar.id)!;
                      const lens = traditionalExtent(event, from, to, bar.left);
                      return (
                        <li
                          key={bar.id}
                          className="toledot-bar"
                          data-confidence={event.confidence}
                          style={{ left: bar.left, top: bar.lane * ROW_HEIGHT, width: Math.max(bar.width, LABEL_RESERVE) }}
                        >
                          {lens ? (
                            <span
                              className="toledot-bar__traditional"
                              role="img"
                              aria-label={lens.label}
                              style={{ left: lens.left, width: lens.width }}
                            />
                          ) : null}
                          <Link prefetch={false}
                            href={`/toledot/events/${event.id}`}
                            className="toledot-bar__link"
                            aria-label={`${event.title}, ${event.display}, ${CONFIDENCE_PHRASE[event.confidence]}`}
                          >
                            <span className="toledot-bar__title">{event.title}</span>
                            <span className="toledot-bar__rule" style={{ width: bar.width }} aria-hidden="true" />
                            <span className="toledot-bar__meta">
                              {event.display} · <span className="toledot-bar__confidence">{event.confidence}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      </div>
      </div>
      {hiddenCount > 0 ? (
        <p className="toledot-overflow">
          {hiddenCount} more {hiddenCount === 1 ? "event" : "events"} in this window {hiddenCount === 1 ? "is" : "are"} not drawn:{" "}
          {overflowHref ? <a href={overflowHref}>see {hiddenCount === 1 ? "it" : "them"} in the list</a> : "see the list"}
        </p>
      ) : null}
    </figure>
  );
}
