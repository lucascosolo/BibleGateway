"use client";

import Link from "next/link";

import { type MarginNote, toledotSentence } from "@/lib/timeline/notes";

/**
 * Timeline notes under the verse they concern: a dating dispute, a person an outside source
 * names, an open historical question — each one line in the apparatus voice, linked to its page
 * on the timeline. Part of THE renderer (AGENTS.md invariant #2), mounted by `<PassageRenderer>`
 * under the `toledot` layer. Deliberately unlike `InsightNotes`: those are editorial asides;
 * these are pointers to cited, contested scholarship, so they read as marginal apparatus.
 *
 * The sentence comes from `toledotSentence`; the multi-verse span arrives preformatted
 * (`spans`, keyed by note id), so this component never touches the corpus.
 */

export interface ToledotNotesProps {
  notes: readonly MarginNote[];
  spans?: ReadonlyMap<string, string>;
}

export function ToledotNotes({ notes, spans }: ToledotNotesProps) {
  if (notes.length === 0) return null;

  return (
    <ul className="toledot-notes">
      {notes.map((note) => {
        const s = toledotSentence(note);
        const span = spans?.get(note.id);
        return (
          <li key={note.id} className="toledot-note">
            <span className="toledot-note__glyph" aria-hidden="true">⧗</span>
            <span className="toledot-note__text">
              <strong className="toledot-note__lead">{s.lead}</strong>
              {" — "}
              {s.body}
              {span && <span className="toledot-note__span"> ({span})</span>}
              {s.draft && <span className="toledot-note__draft">unchecked</span>}
              {" "}
              <Link href={s.href} className="toledot-note__link" aria-label={`${s.lead}: ${s.body} — ${s.opens ?? "open on the timeline"}`}>
                →
              </Link>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
