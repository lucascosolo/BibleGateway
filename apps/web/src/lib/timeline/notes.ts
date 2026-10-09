import type { IssueSummary, ToledotNote, VerseLink, WorkNote } from "@/lib/db/timeline";

import { getLexiconEntry } from "@/lib/lexicon";

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
  /** What following the link does, for its accessible name; the timeline when absent. */
  opens?: string;
}

/** A margin note beside a verse: a timeline subject, or a work that quotes, echoes or records it. */
export type MarginNote = ToledotNote | WorkNote;

const ISSUE_LEAD: Record<IssueSummary["kind"], string> = {
  chronology: "Chronology question",
  textual: "Textual question",
  historical: "Historical question",
  internal: "Internal question",
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const inProse = (title: string) => (title.startsWith("The ") || title.startsWith("Composition ") ? lowerFirst(title) : title);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const countWord = (n: number) => (n < WORDS.length ? WORDS[n] : String(n));
const counted = (n: number, one: string, many: string) => `${countWord(n)} ${n === 1 ? one : many}`;
const asSentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

const WORK_LINK: Record<VerseLink["linkType"], [lead: string, body: (title: string) => string]> = {
  alludes: ["Parallel in an outside work", (t) => `${t} shares wording or a saying with this passage.`],
  background: ["Retold in an outside work", (t) => `${t} retells or builds on this passage.`],
  describes: ["Named in an outside work", (t) => `${t} attaches itself to this passage.`],
  dates: ["Outside work", (t) => `${t} is dated by reference to this passage.`],
};

const ARTIFACT_VERB: Record<string, string> = {
  corroborates: "corroborates",
  "partially-corroborates": "partly corroborates",
  consistent: "is consistent with",
  silent: "is silent on",
  "in-tension": "contradicts",
};

function sentence(note: MarginNote): ToledotSentence {
  const s = note.subject;
  switch (s.kind) {
    case "work": {
      const [lead, body] =
        s.role === "record"
          ? ["Work record", `${s.title}: its dating, surviving copies and who reads it as scripture.`]
          : [WORK_LINK[note.linkType][0], WORK_LINK[note.linkType][1](s.title)];
      return { lead, body, href: `/chitzonim/works/${s.id}`, draft: unchecked(s.status), opens: "open the work record" };
    }
    case "event": {
      const href = `/toledot/events/${s.id}`;
      const draft = unchecked(s.status);
      const scholarly = s.positions.filter((p) => !isTraditional(p.tradition));
      const traditional = s.positions.filter((p) => isTraditional(p.tradition));
      if (scholarly.length >= 2) {
        return { lead: "Dating disputed", body: `Scholars disagree about the date of ${inProse(s.title)}: ${countWord(scholarly.length)} positions, spanning ${formatRange(s.earliest, s.latest)}.`, href, draft };
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
        body: `This passage is cited ${s.stance === "against" ? "against" : "for"} one dating of ${inProse(s.eventTitle)}: “${s.positionLabel}”.`,
        href: `/toledot/events/${s.eventId}`,
        draft: unchecked(s.eventStatus),
      };
    case "issue":
      return { lead: ISSUE_LEAD[s.issueKind], body: s.title.trim().endsWith("?") ? s.title : `An open question: ${s.title}.`, href: `/toledot/issues/${s.id}`, draft: unchecked(s.status) };
    case "person":
      return {
        lead: `${EVIDENCE_MEANING[s.evidence]}${s.hasTension ? "; a source contradicts a detail" : ""}`,
        body: `${s.name} appears here; ${lowerFirst(EVIDENCE_MEANING[s.evidence])}.`,
        href: `/toledot/people/${s.id}`,
        draft: unchecked(s.status),
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
        draft: unchecked(s.status),
      };
    case "investigation":
      return {
        lead: getLexiconEntry("investigation").term,
        body: `An investigation looks at the wording of ${s.passage}: ${counted(s.witnesses, "witness", "witnesses")}, ${counted(s.explanations, "explanation", "explanations")}.`,
        href: `/toledot/investigations/${s.id}`,
        draft: unchecked(s.status),
      };
  }
}

/** True until the claims have been checked against their cited pages. "Sources located" means
 *  the citations exist, not that anyone has read them, so the reader is still warned. */
function unchecked(status: string): boolean {
  return status !== "claims-checked" && status !== "expert-reviewed";
}

export function toledotSentence(note: MarginNote): ToledotSentence {
  const out = sentence(note);
  return note.note ? { ...out, note: asSentence(note.note) } : out;
}
