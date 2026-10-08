import type { IssueSummary, ToledotNote } from "@/lib/db/timeline";

import { EVIDENCE_MEANING } from "./evidence";
import { isTraditional } from "./lens";
import { formatRange } from "./years";

/**
 * One timeline note as a sentence: a lead, a body and the page it opens. Every word comes from
 * data the subject already carries; this never writes a claim of its own.
 */
export interface ToledotSentence {
  lead: string;
  body: string;
  /** The verse link's own note, as a sentence; kept apart from `body` so the link's accessible name stays short. */
  note?: string;
  href: string;
  draft: boolean;
}

const ISSUE_LEAD: Record<IssueSummary["kind"], string> = {
  chronology: "Chronology question",
  textual: "Textual question",
  historical: "Historical question",
  internal: "Internal question",
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const inProse = (title: string) => (title.startsWith("The ") ? lowerFirst(title) : title);
const asSentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

const ARTIFACT_VERB: Record<string, string> = {
  corroborates: "corroborates",
  "partially-corroborates": "partly corroborates",
  consistent: "is consistent with",
  silent: "is silent on",
  "in-tension": "contradicts",
};

function sentence(note: ToledotNote): ToledotSentence {
  const s = note.subject;
  switch (s.kind) {
    case "event": {
      const href = `/toledot/events/${s.id}`;
      const draft = s.status === "draft";
      const scholarly = s.positions.filter((p) => !isTraditional(p.tradition));
      const traditional = s.positions.filter((p) => isTraditional(p.tradition));
      if (scholarly.length >= 2) {
        return { lead: "Dating disputed", body: `Scholars give ${scholarly.map((p) => p.label).join(" or ")} for ${inProse(s.title)}.`, href, draft };
      }
      if (scholarly.length === 0 && traditional.length > 0) {
        return { lead: "Traditional date", body: `Only a traditional count dates ${inProse(s.title)}, to ${traditional.map((p) => p.label).join(" or ")}; no outside evidence fixes it.`, href, draft };
      }
      const lead = s.confidence === "firm" ? "Dated" : `Dated, ${s.confidence}`;
      return { lead, body: `Scholars place ${inProse(s.title)} in ${formatRange(s.earliest, s.latest)}.`, href, draft };
    }
    case "argument":
      return {
        lead: "Cited in dating",
        body: `This passage is cited ${s.stance === "against" ? "against" : "for"} dating ${inProse(s.eventTitle)} to ${s.positionLabel}.`,
        href: `/toledot/events/${s.eventId}`,
        draft: s.eventStatus === "draft",
      };
    case "issue":
      return { lead: ISSUE_LEAD[s.issueKind], body: s.title.trim().endsWith("?") ? s.title : `An open question: ${s.title}.`, href: `/toledot/issues/${s.id}`, draft: s.status === "draft" };
    case "person":
      return {
        lead: `${EVIDENCE_MEANING[s.evidence]}${s.hasTension ? "; a source contradicts a detail" : ""}`,
        body: `${s.name} appears here; ${lowerFirst(EVIDENCE_MEANING[s.evidence])}.`,
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
        body: `${s.name} is an outside source that ${ARTIFACT_VERB[s.relation ?? "silent"]} this passage.`,
        href: `/toledot/artifacts/${s.id}`,
        draft: s.status === "draft",
      };
  }
}

export function toledotSentence(note: ToledotNote): ToledotSentence {
  const out = sentence(note);
  return note.note ? { ...out, note: asSentence(note.note) } : out;
}
