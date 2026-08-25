"use client";

import type { InsightNote } from "@/lib/insights/notes";

/**
 * "Windows into the text" — curated, bite-sized notes rendered under the verse they annotate.
 *
 * Lives in `components/passage/` because it is part of THE renderer (AGENTS.md invariant #2),
 * mounted by `<PassageRenderer>` under the `insights` layer, next to `QereReadings` and
 * `Interlinear`. Deliberately built differently from those two: this is not scholarly apparatus
 * — there is no morphology, no manuscript claim, nothing to collapse behind a disclosure. It is
 * one or two plain sentences, always visible when the layer is on, styled to read as a small
 * aside rather than a footnote. A reader who never opens it should still be able to tell, from
 * the icon and the tint alone, that it is a different kind of note than the Hebrew apparatus
 * beside it.
 *
 * Data comes from `lib/insights/notes.ts`, supplied by the server page exactly like `variants`
 * and `interlinear` are — this component never fetches, so the data source can move from a
 * bundled TS module to a `bible.db` table later without touching this file.
 */

export interface InsightNotesProps {
  notes: readonly InsightNote[];
}

function WindowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="insight-note__icon"
      aria-hidden="true"
    >
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M12 3.5v17M4 12h16" />
    </svg>
  );
}

export function InsightNotes({ notes }: InsightNotesProps) {
  if (notes.length === 0) return null;

  return (
    <div className="insight-notes">
      {notes.map((note) => (
        <p key={note.id} className="insight-note">
          <WindowIcon />
          <span className="insight-note__text">
            {note.text}
            {note.source && <span className="insight-note__source"> — {note.source}</span>}
          </span>
        </p>
      ))}
    </div>
  );
}
