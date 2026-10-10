import Link from "next/link";

import { getTimelineWindow, type EventSummary } from "@/lib/db/timeline";
import { entryWindow } from "@/lib/timeline/strip-layout";
import { withDisplay } from "@/lib/timeline/years";

import { TimelineStrip } from "./TimelineStrip";

/**
 * The timeline around an entry page: the one strip, windowed to the entry's own dated events plus
 * context, those events marked as current and the neighbours clickable. Nothing when the entry has
 * no dated event, rather than an empty strip.
 */
export function EntityTimeline({ entries, label, placeKey }: { entries: readonly EventSummary[]; label: string; placeKey: string }) {
  const range = entryWindow(entries);
  if (!range) return null;
  const around = getTimelineWindow(range);
  if (!around.available) return null;
  const first = entries.reduce((a, b) => (b.earliest < a.earliest ? b : a));
  const ids = new Set(entries.map((entry) => entry.id));
  // A neighbour that starts before the window would be drawn with its title off the left edge,
  // taking a row while showing nothing but a rule; only neighbours that begin inside it are context.
  const shown = around.events.filter((event) => ids.has(event.id) || event.earliest >= range.from);

  return (
    <section className="toledot-entity__timeline" aria-label="Where this sits on the timeline">
      <TimelineStrip
        compact
        eras={around.eras}
        events={shown.map(withDisplay)}
        from={range.from}
        to={range.to}
        maxRows={2}
        overflowHref="/toledot/events"
        placeKey={placeKey}
        current={{ ids: [...ids], label }}
      />
      <Link href={`/toledot?at=${encodeURIComponent(first.id)}`} className="toledot-entity__full">
        Back to the full timeline
      </Link>
    </section>
  );
}
