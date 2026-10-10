"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Era, EventSummary } from "@/lib/db/timeline";
import { AXES, type Axis } from "@/lib/timeline/axes";
import { arrivedByBack, findEntry, listenForBack, markReturned, readPlace, revealVertically, savePlace, settle } from "@/lib/timeline/place";
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
  placeKey,
  anchorId,
  current,
  compact = false,
}: {
  eras: readonly Era[];
  events: readonly StripEvent[];
  from: number;
  to: number;
  maxRows?: number;
  overflowHref?: string;
  /** Where this view's place is kept; without one the strip remembers nothing. */
  placeKey?: string;
  /** An entry the URL asked for (`?at=`): centred and marked once, then dropped from the URL. */
  anchorId?: string;
  /** The entries the surrounding page is about: packed first, marked, and centred on arrival. */
  current?: { ids: readonly string[]; label: string };
  /** Entry pages: lanes with nothing in them are left out. */
  compact?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const pendingSave = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Restore: anchored to the entry last opened from this view (or the one the URL names, or the
  // page's own entry), re-applied while layout settles; the saved offset when it is not drawn.
  useEffect(() => {
    const node = viewport.current;
    if (!node || !placeKey) return;
    listenForBack();
    const saved = readPlace(placeKey);
    const anchor = anchorId ?? saved?.openedId ?? current?.ids[0] ?? null;
    const returning = anchor !== null && (anchor === anchorId || anchor === saved?.openedId);
    const target = anchor ? findEntry(node, anchor) : null;
    const link = target?.querySelector<HTMLElement>("a") ?? null;
    const apply = () => {
      if (link && target) {
        const frame = node.getBoundingClientRect();
        const bar = link.getBoundingClientRect();
        node.scrollLeft += bar.left + Math.min(bar.width, frame.width) / 2 - (frame.left + frame.width / 2);
        if (returning) revealVertically(target);
      } else if (saved?.scrollLeft !== undefined) {
        node.scrollLeft = saved.scrollLeft;
      }
    };
    const cancel = settle(apply, node.firstElementChild);
    if (target && returning) {
      markReturned(target);
      if (saved?.viaKeyboard && anchor === saved.openedId && arrivedByBack()) link?.focus({ preventScroll: true });
    }
    if (anchorId) {
      savePlace(placeKey, { openedId: anchorId, viaKeyboard: false });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("at");
        window.history.replaceState(null, "", url);
      } catch {
        // The anchor stays in the URL; a reload re-centres on it, which is harmless.
      }
    }

    // Once the reader moves the strip themselves, where they scrolled to is the place.
    let moved = false;
    const onInput = () => {
      moved = true;
    };
    const onScroll = () => {
      if (!moved) return;
      clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(() => savePlace(placeKey, { scrollLeft: node.scrollLeft, openedId: null }), 150);
    };
    const inputs = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    for (const type of inputs) node.addEventListener(type, onInput, { passive: true });
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancel();
      clearTimeout(pendingSave.current);
      for (const type of inputs) node.removeEventListener(type, onInput);
      node.removeEventListener("scroll", onScroll);
    };
    // Restored once per view: each era and each entry page carries its own key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey]);

  const remember = (id: string, viaKeyboard: boolean) => {
    if (!placeKey) return;
    clearTimeout(pendingSave.current);
    savePlace(placeKey, { openedId: id, viaKeyboard, scrollLeft: viewport.current?.scrollLeft ?? 0 });
  };
  const currentIds = new Set(current?.ids ?? []);

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
  const bars = layoutBars(
    events,
    from,
    to,
    PX_PER_YEAR,
    8,
    LABEL_RESERVE,
    new Set(anchorId ? [anchorId, ...currentIds] : currentIds),
  );
  let hiddenCount = 0;
  const byId = new Map(events.map((event) => [event.id, event]));

  return (
    <figure className="toledot-strip" data-compact={compact || undefined}>
      <figcaption className="toledot-strip__hint">
        {compact
          ? `${formatRange(from, to)}, with the events around it. Scroll sideways for more.`
          : `${formatRange(from, to)}. Scroll sideways along the years; Tab moves through the events in date order.`}
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
            if (compact && laneBars.length === 0 && hidden.length === 0) return null;
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
                      const isCurrent = currentIds.has(event.id);
                      return (
                        <li
                          key={bar.id}
                          className="toledot-bar"
                          data-entry-id={event.id}
                          data-current={isCurrent || undefined}
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
                          <Link
                            href={`/toledot/events/${event.id}`}
                            className="toledot-bar__link"
                            aria-current={isCurrent ? "true" : undefined}
                            aria-label={`${event.title}, ${event.display}, ${CONFIDENCE_PHRASE[event.confidence]}${isCurrent ? `, ${current!.label}` : ""}`}
                            onClick={(click) => remember(event.id, click.detail === 0)}
                          >
                            <span className="toledot-bar__title">{event.title}</span>
                            <span className="toledot-bar__rule" style={{ width: bar.width }} aria-hidden="true" />
                            <span className="toledot-bar__meta">
                              {event.display} · <span className="toledot-bar__confidence">{event.confidence}</span>
                              {isCurrent ? <> · <span className="toledot-bar__current">{current!.label}</span></> : null}
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
