import type { Relation, ReviewStatus, ToledotNote, VerseLink, WorkNote } from "@/lib/db/timeline";
import type { VerseId } from "@/lib/refs/verse-id";

import { getLexiconEntry } from "@/lib/lexicon";

import { EVIDENCE_MEANING } from "./evidence";
import { isTraditional } from "./lens";
import { formatRange } from "./years";

/**
 * One timeline note as text: a lead naming how the subject bears on this passage, a body that
 * says it (relationship first, then the date where there is one) and the page it opens. Every
 * word comes from data the subject already carries; this never writes a claim of its own.
 */
export interface ToledotSentence {
  lead: string;
  body: string;
  href: string;
  draft: boolean;
  /** What following the link does, for its accessible name; the timeline when absent. */
  opens?: string;
}

/** A margin note beside a verse: a timeline subject, or a work that quotes, echoes or records it. */
export type MarginNote = ToledotNote | WorkNote;

/** On an outside book's page, a note at the first verse on screen for every work that prints it. */
export function workRecordNotes(works: readonly { id: string; title: string; status: ReviewStatus }[], first: VerseId | undefined): WorkNote[] {
  if (first === undefined) return [];
  return works.map(({ id, title, status }) => ({
    id: `work-record:${id}@${first}`,
    anchor: first,
    start: first,
    end: first,
    linkType: "describes",
    note: null,
    subject: { kind: "work", id, title, status, role: "record" },
  }));
}

/**
 * Which notes placed at `anchor` are one note. Links of one timeline subject collapse whatever
 * their kind (the sentence ignores it); a work's links do not, since each kind says something
 * different about the passage.
 */
export function marginNoteKey(note: MarginNote, anchor: VerseId): string {
  const prefix = note.id.slice(0, note.id.lastIndexOf("@"));
  const kind = note.subject.kind === "work" && note.subject.role === "link" ? `:${note.linkType}` : "";
  return `${prefix}${kind}@${anchor}`;
}

type EventSubject = Extract<ToledotNote["subject"], { kind: "event" }>;

const EVENT_LEAD: Record<EventSubject["axis"], string> = {
  narrative: "Dated event",
  composition: "Date of writing",
  canon: "Book list",
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const countWord = (n: number) => (n < WORDS.length ? WORDS[n] : String(n));
const counted = (n: number, one: string, many: string) => `${countWord(n)} ${n === 1 ? one : many}`;
const asSentence = (s: string) => (/[.!?][”’"')\]]*$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const joined = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" ");

const WORK_BODY: Record<VerseLink["linkType"], (title: string) => string> = {
  alludes: (t) => `${t} shares wording or a saying with this passage.`,
  // Neutral on purpose: a background link records a connection, not its direction. 1 Enoch 6-11
  // and Genesis 6:1-4 have a disputed priority; the link's own note says what the link is.
  background: (t) => `${t} is linked to this passage.`,
  describes: (t) => `${t} presents itself as connected to this passage.`,
  dates: (t) => `${t} is dated by reference to this passage.`,
  names: (t) => `${t} names this book.`,
};

const ARTIFACT_VERB: Record<Relation, string> = {
  corroborates: " corroborates this passage",
  "partially-corroborates": " partly corroborates this passage",
  consistent: " fits this passage",
  silent: " does not mention what this passage reports",
  "in-tension": " conflicts with this passage",
};

/** The event's date as one sentence, its title kept verbatim as a label: titles are often
 *  sentences ("David takes Jerusalem"), so they are never embedded in prose. */
function eventDate(s: EventSubject): string {
  const range = formatRange(s.earliest, s.latest);
  if (s.axis === "canon") {
    const title = s.title.trim().replace(/\.$/, "");
    return title.endsWith(")") ? `${title.slice(0, -1)}; ${range}).` : `${title} (${range}).`;
  }
  const n = s.positions.filter((p) => !isTraditional(p.tradition)).length;
  if (n === 0) return `${s.title}: only a traditional count dates it, to ${range}; no outside evidence fixes it.`;
  const scholarly = s.positions.some((p) => p.tradition === "critical" || p.tradition === "archaeological");
  const doubt = s.confidence === "firm" ? "" : `, though the date is ${s.confidence}`;
  const all = n === 2 ? "both" : `all ${countWord(n)}`;
  const claim = scholarly
    ? n === 1
      ? `scholars date it ${range}${doubt}`
      : s.earliest === s.latest
        ? `${all} scholarly positions fall in ${range}`
        : `scholars disagree, with ${countWord(n)} positions spanning ${range}`
    : n === 1
      ? s.confidence === "firm"
        ? `dated to ${range}` // a firm date (Babylon 539, the Temple 70) is not a mere reckoning
        : `a chronological reckoning dates it to ${range}${doubt}`
      : s.earliest === s.latest
        ? `${all} chronological reckonings date it to ${range}`
        : `${countWord(n)} chronological reckonings span ${range}`;
  const sameAsScholars = s.traditional && s.traditional.earliest === s.earliest && s.traditional.latest === s.latest;
  const traditional = s.traditional && !sameAsScholars ? `; the traditional count gives ${formatRange(s.traditional.earliest, s.traditional.latest)}` : "";
  return `${s.title}: ${claim}${traditional}.`;
}

function sentence(note: MarginNote, linkNote: string | null): ToledotSentence {
  const s = note.subject;
  switch (s.kind) {
    case "work": {
      const [lead, body] =
        s.role === "record"
          ? ["Work record", `${s.title}: its dating, surviving copies and who reads it as scripture.`]
          : [note.linkType === "alludes" ? "Parallel in an outside work" : "Outside work", linkNote ?? WORK_BODY[note.linkType](s.title)];
      return { lead, body, href: `/chitzonim/works/${s.id}`, draft: unchecked(s.status), opens: "open the work record" };
    }
    case "event":
      return { lead: EVENT_LEAD[s.axis], body: joined(linkNote, eventDate(s)), href: `/toledot/events/${s.id}`, draft: unchecked(s.status) };
    case "argument":
      return {
        lead: s.datesWriting ? "Cited in dating the writing" : "Cited in dating",
        body: joined(`${s.eventTitle}: this passage is cited ${s.stance === "against" ? "against" : "for"} the dating “${s.positionLabel}”.`, linkNote),
        href: `/toledot/events/${s.eventId}`,
        draft: unchecked(s.eventStatus),
      };
    case "issue":
      return { lead: "Open question", body: joined(asSentence(s.title), linkNote), href: `/toledot/issues/${s.id}`, draft: unchecked(s.status) };
    case "person":
      return {
        lead: "Person in this passage",
        body: joined(`${s.name}: ${lowerFirst(EVIDENCE_MEANING[s.evidence])}${s.hasTension ? ", though a source contradicts a detail" : ""}.`, linkNote),
        href: `/toledot/people/${s.id}`,
        draft: unchecked(s.status),
      };
    case "artifact":
      return {
        lead: "Outside source",
        body: joined(`${s.name}${s.relation ? ARTIFACT_VERB[s.relation] : ""}.`, linkNote),
        href: `/toledot/artifacts/${s.id}`,
        draft: unchecked(s.status),
      };
    case "investigation":
      return {
        lead: getLexiconEntry("investigation").term,
        body: joined(`An investigation looks at the wording of ${s.passage}: ${counted(s.witnesses, "witness", "witnesses")}, ${counted(s.explanations, "explanation", "explanations")}.`, linkNote),
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
  return sentence(note, note.note ? asSentence(note.note) : null);
}
