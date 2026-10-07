import type { IssueSummary, ToledotNote } from "@/lib/db/timeline";

import { EVIDENCE_MEANING } from "./evidence";
import { formatRange } from "./years";

/**
 * One timeline note as a sentence: a lead, a body and the page it opens. Every word comes from
 * data the subject already carries; this never writes a claim of its own.
 */
export interface ToledotSentence {
  lead: string;
  body: string;
  href: string;
  draft: boolean;
}

const ISSUE_LEAD: Record<IssueSummary["kind"], string> = {
  chronology: "Chronology question",
  textual: "Textual question",
  historical: "Historical question",
  internal: "Internal question",
};

function sentence(note: ToledotNote): ToledotSentence {
  const s = note.subject;
  switch (s.kind) {
    case "event": {
      const href = `/toledot/events/${s.id}`;
      if (s.positions.length >= 2) {
        return { lead: "Dating disputed", body: `${s.positions.map((p) => p.label).join(" or ")} — ${s.title}`, href, draft: s.status === "draft" };
      }
      const lead = s.confidence === "firm" ? "Dated" : `Dated, ${s.confidence}`;
      return { lead, body: `${formatRange(s.earliest, s.latest)} — ${s.title}`, href, draft: s.status === "draft" };
    }
    case "argument":
      return {
        lead: "Cited in dating",
        body: `${s.positionLabel}${s.stance === "against" ? ", against" : ""} — ${s.eventTitle}`,
        href: `/toledot/events/${s.eventId}`,
        draft: s.eventStatus === "draft",
      };
    case "issue":
      return { lead: ISSUE_LEAD[s.issueKind], body: s.title, href: `/toledot/issues/${s.id}`, draft: s.status === "draft" };
    case "person":
      return {
        lead: `${EVIDENCE_MEANING[s.evidence]}${s.hasTension ? "; a source contradicts a detail" : ""}`,
        body: s.name,
        href: `/toledot/people/${s.id}`,
        draft: s.status === "draft",
      };
    case "artifact":
      return {
        lead:
          s.relation === "in-tension"
            ? "Outside source in tension with this passage"
            : s.relation === "corroborates" || s.relation === "partially-corroborates"
              ? "Outside source corroborates this passage"
              : "Outside source",
        body: s.name,
        href: `/toledot/artifacts/${s.id}`,
        draft: s.status === "draft",
      };
  }
}

export function toledotSentence(note: ToledotNote): ToledotSentence {
  const out = sentence(note);
  return note.note ? { ...out, body: `${out.body} (${note.note})` } : out;
}
