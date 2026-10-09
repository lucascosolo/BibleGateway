import { describe, expect, it } from "vitest";

import type { EvidenceGrade, Relation, ToledotNote } from "@/lib/db/timeline";
import { EVIDENCE_MEANING } from "@/lib/timeline/evidence";
import { getLexiconEntry } from "@/lib/lexicon";
import { toledotSentence } from "./notes";

type Subject = ToledotNote["subject"];

function note(subject: Subject, extra: Partial<ToledotNote> = {}): ToledotNote {
  return {
    id: "x:1@1001001", anchor: 1_001_001 as never, start: 1_001_001 as never, end: 1_001_001 as never,
    linkType: "describes", subject, note: null, ...extra,
  };
}

const pos = (label: string, tradition: string) => ({ label, tradition });
const event = (over: Record<string, unknown> = {}): Subject => ({
  kind: "event", id: "ev-exodus", title: "The Exodus", status: "claims-checked", confidence: "contested", axis: "narrative",
  earliest: -1446, latest: -1200, traditional: null,
  positions: [pos("Early", "chronological"), pos("Late", "critical")],
  ...over,
}) as Subject;
const body = (n: ToledotNote) => toledotSentence(n).body;

describe("toledotSentence: events", () => {
  it("two scholarly positions, different years: disagree, with span; no note field", () => {
    const s = toledotSentence(note(event({ positions: [pos("A", "critical"), pos("B", "critical")] })));
    expect(s).toEqual({
      lead: "Dated event",
      body: "The Exodus: scholars disagree, with two positions spanning 1446–1200 BCE.",
      href: "/toledot/events/ev-exodus", draft: false,
    });
  });
  it("two scholarly positions in one year: both fall in", () => {
    const s = body(note(event({ title: "Sennacherib's campaign against Judah", earliest: -701, latest: -701, positions: [pos("A", "critical"), pos("B", "critical")] })));
    expect(s).toBe("Sennacherib's campaign against Judah: both scholarly positions fall in 701 BCE.");
  });
  it("three scholarly positions in one year: all three", () => {
    const s = body(note(event({ earliest: -701, latest: -701, positions: [pos("A", "critical"), pos("B", "critical"), pos("C", "critical")] })));
    expect(s).toBe("The Exodus: all three scholarly positions fall in 701 BCE.");
  });
  it("chronological counts as scholarly; only traditional is excluded", () => {
    const s = body(note(event({
      positions: [pos("A", "chronological"), pos("B", "traditional"), pos("C", "critical")],
      traditional: { earliest: -1446, latest: -1446 },
    })));
    expect(s).toBe("The Exodus: scholars disagree, with two positions spanning 1446–1200 BCE; the traditional count gives 1446 BCE.");
  });
  it("two scholarly positions with a traditional count: clause before the final period", () => {
    const s = body(note(event({ positions: [pos("A", "critical"), pos("B", "critical")], traditional: { earliest: -1446, latest: -1446 } })));
    expect(s).toBe("The Exodus: scholars disagree, with two positions spanning 1446–1200 BCE; the traditional count gives 1446 BCE.");
  });
  it("one scholarly position, firm, no traditional", () => {
    const s = body(note(event({ confidence: "firm", earliest: -587, latest: -586, title: "Fall of Jerusalem", positions: [pos("Only", "critical")] })));
    expect(s).toBe("Fall of Jerusalem: scholars date it 587–586 BCE.");
  });
  it("one scholarly position, not firm: confidence in parentheses", () => {
    const s = body(note(event({ confidence: "contested", earliest: -1005, latest: -970, title: "David takes Jerusalem", positions: [pos("Only", "critical")] })));
    expect(s).toBe("David takes Jerusalem: scholars date it 1005–970 BCE (contested).");
  });
  it("one scholarly position with a traditional count", () => {
    const s = body(note(event({ confidence: "firm", earliest: -1279, latest: -1213, positions: [pos("Only", "critical")], traditional: { earliest: -1446, latest: -1446 } })));
    expect(s).toBe("The Exodus: scholars date it 1279–1213 BCE; the traditional count gives 1446 BCE.");
  });
  it("traditional envelope equal to the event's own range: no traditional clause", () => {
    const s = body(note(event({
      title: "The deaths of Peter and Paul", confidence: "speculative", earliest: 64, latest: 68,
      positions: [pos("Only", "critical")], traditional: { earliest: 64, latest: 68 },
    })));
    expect(s).toBe("The deaths of Peter and Paul: scholars date it 64–68 CE (speculative).");
  });
  it("no scholarly position: only a traditional count", () => {
    const s = body(note(event({ earliest: -1446, latest: -1446, positions: [pos("Ussher", "traditional")] })));
    expect(s).toBe("The Exodus: only a traditional count dates it, to 1446 BCE; no outside evidence fixes it.");
  });
  it("the title is a label: never lower-cased", () => {
    expect(body(note(event({ title: "Composition of James", confidence: "firm", positions: [pos("O", "critical")] })))).toContain("Composition of James:");
  });
  it("the link note comes first, then the date sentence", () => {
    const s = body(note(event({ confidence: "firm", positions: [pos("O", "critical")] }), { note: "Exodus 1:11 names the store cities" }));
    expect(s.startsWith("Exodus 1:11 names the store cities. The Exodus: scholars date it ")).toBe(true);
  });
  it.each([
    ["narrative", "Dated event"], ["composition", "Date of writing"], ["canon", "Book list"],
  ] as const)("axis %s leads with %s", (axis, lead) => {
    expect(toledotSentence(note(event({ axis, confidence: "firm", positions: [pos("O", "critical")] }))).lead).toBe(lead);
  });
  it("canon axis: title with its range in parentheses, trailing period stripped", () => {
    const s = body(note(event({ axis: "canon", title: "Origen counts twenty-two Hebrew books and only four Gospels.", earliest: 230, latest: 254, positions: [] })));
    expect(s).toBe("Origen counts twenty-two Hebrew books and only four Gospels (230–254 CE).");
  });
  it("draft stays true for sources-located, false for claims-checked", () => {
    expect(toledotSentence(note(event({ status: "sources-located" }))).draft).toBe(true);
    expect(toledotSentence(note(event({ status: "claims-checked" }))).draft).toBe(false);
  });
});

describe("toledotSentence: arguments", () => {
  const arg = (stance: "for" | "against"): Subject => ({
    kind: "argument", eventId: "ev-exodus", eventTitle: "The Exodus", eventStatus: "claims-checked", positionLabel: "Early date", stance, datesWriting: false,
  });
  it("for", () => {
    expect(toledotSentence(note(arg("for")))).toEqual({
      lead: "Cited in dating", body: "The Exodus: this passage is cited for the dating “Early date”.", href: "/toledot/events/ev-exodus", draft: false,
    });
  });
  it("datesWriting leads 'Cited in dating the writing', rest unchanged", () => {
    expect(toledotSentence(note({ ...arg("for"), datesWriting: true }))).toEqual({
      lead: "Cited in dating the writing", body: "The Exodus: this passage is cited for the dating “Early date”.", href: "/toledot/events/ev-exodus", draft: false,
    });
  });
  it("against, then the link note", () => {
    expect(body(note(arg("against"), { note: "1 Kings 6:1" }))).toBe("The Exodus: this passage is cited against the dating “Early date”. 1 Kings 6:1.");
  });
});

describe("toledotSentence: issues", () => {
  it.each(["chronology", "textual", "historical", "internal"] as const)("%s issue leads 'Open question'", (issueKind) => {
    const s = toledotSentence(note({ kind: "issue", id: "iss-1", title: "The 480 years", issueKind, status: "claims-checked" }));
    expect(s).toEqual({ lead: "Open question", body: "The 480 years.", href: "/toledot/issues/iss-1", draft: false });
  });
  it("a question title is used as is, then the link note", () => {
    const q: Subject = { kind: "issue", id: "i", title: "Is there a historical Moses?", issueKind: "historical", status: "claims-checked" };
    expect(toledotSentence(note(q)).body).toBe("Is there a historical Moses?");
    expect(toledotSentence(note(q, { note: "Asked of Exodus 3" })).body).toBe("Is there a historical Moses? Asked of Exodus 3.");
  });
});

describe("toledotSentence: persons", () => {
  const person = (evidence: EvidenceGrade, hasTension = false): Subject => ({
    kind: "person", id: "per-h", name: "Hezekiah", evidence, hasTension, status: "claims-checked",
  });
  it("wording of EVIDENCE_MEANING is unchanged", () => {
    expect(EVIDENCE_MEANING.corroborates).toBe("Named by a source outside the Bible");
  });
  it("lead is fixed; body is name, lower-cased meaning", () => {
    expect(toledotSentence(note(person("corroborates")))).toEqual({
      lead: "Person in this passage", body: "Hezekiah: named by a source outside the Bible.", href: "/toledot/people/per-h", draft: false,
    });
  });
  it.each(["corroborates", "partially-corroborates", "consistent", "silent", "none"] as const)("grade %s", (g) => {
    const m = EVIDENCE_MEANING[g];
    expect(body(note(person(g)))).toBe(`Hezekiah: ${m.charAt(0).toLowerCase() + m.slice(1)}.`);
  });
  it("tension, then the link note", () => {
    expect(body(note(person("corroborates", true), { note: "Nebuchadnezzar his father" })))
      .toBe("Hezekiah: named by a source outside the Bible, though a source contradicts a detail. Nebuchadnezzar his father.");
  });
});

describe("toledotSentence: artifacts", () => {
  const artifact = (relation: Relation | null): Subject => ({
    kind: "artifact", id: "art-nab", name: "Nabonidus Cylinder", status: "claims-checked", relation,
  });
  it.each([
    ["corroborates", "Nabonidus Cylinder corroborates this passage."],
    ["partially-corroborates", "Nabonidus Cylinder partly corroborates this passage."],
    ["consistent", "Nabonidus Cylinder fits this passage."],
    ["silent", "Nabonidus Cylinder does not mention what this passage reports."],
    ["in-tension", "Nabonidus Cylinder conflicts with this passage."],
    [null, "Nabonidus Cylinder."],
  ] as const)("relation %s", (relation, text) => {
    expect(toledotSentence(note(artifact(relation)))).toEqual({
      lead: "Outside source", body: text, href: "/toledot/artifacts/art-nab", draft: false,
    });
  });
  it("link note follows", () => {
    expect(body(note(artifact("corroborates"), { note: "Line 3" }))).toBe("Nabonidus Cylinder corroborates this passage. Line 3.");
  });
});

describe("toledotSentence: link note and draft", () => {
  it("merges the note into the body; there is no note field", () => {
    const p = { kind: "person", id: "per-b", name: "Belshazzar", evidence: "none", hasTension: false, status: "claims-checked" } as const;
    const s = toledotSentence(note(p, { note: "Already ends." }));
    expect(s.body).toBe("Belshazzar: no outside evidence. Already ends.");
    expect("note" in s).toBe(false);
    expect(toledotSentence(note(p)).body).toBe("Belshazzar: no outside evidence.");
  });
  it("flags draft for every subject kind that is draft", () => {
    expect(toledotSentence(note({ kind: "argument", eventId: "e", eventTitle: "E", eventStatus: "draft", positionLabel: "P", stance: "for", datesWriting: false })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "issue", id: "i", title: "T", issueKind: "textual", status: "draft" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "person", id: "p", name: "N", evidence: "none", hasTension: false, status: "draft" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "artifact", id: "a", name: "N", status: "draft", relation: null })).draft).toBe(true);
  });
});

describe("toledotSentence: investigations", () => {
  const inv = (over: Record<string, unknown> = {}): Subject => ({
    kind: "investigation", id: "deut-32-8-9", title: "Sons of God", passage: "Deuteronomy 32:8–9",
    witnesses: 2, explanations: 3, status: "draft", ...over,
  }) as Subject;

  it("plural counts, draft", () => {
    expect(toledotSentence(note(inv()))).toEqual({
      lead: getLexiconEntry("investigation").term,
      body: "An investigation looks at the wording of Deuteronomy 32:8–9: two witnesses, three explanations.",
      href: "/toledot/investigations/deut-32-8-9",
      draft: true,
    });
  });

  it("singular counts, claims-checked is not draft", () => {
    const s = toledotSentence(note(inv({ witnesses: 1, explanations: 1, status: "claims-checked" })));
    expect(s.body).toBe("An investigation looks at the wording of Deuteronomy 32:8–9: one witness, one explanation.");
    expect(s.draft).toBe(false);
  });
});

describe("toledotSentence: works", () => {
  type WorkNote = import("@/lib/db/timeline").WorkNote;
  const wnote = (role: "link" | "record", linkType: string, over: Record<string, unknown> = {}, extra: Partial<WorkNote> = {}): WorkNote => ({
    id: "work:1-enoch@65001014", anchor: 65_001_014 as never, start: 65_001_014 as never, end: 65_001_015 as never,
    linkType: linkType as never, note: null,
    subject: { kind: "work", id: "1-enoch", title: "1 Enoch", status: "claims-checked", role, ...over },
    ...extra,
  });

  it("a record is a work record, opening the work", () => {
    expect(toledotSentence(wnote("record", "describes"))).toEqual({
      lead: "Work record",
      body: "1 Enoch: its dating, surviving copies and who reads it as scripture.",
      href: "/chitzonim/works/1-enoch", opens: "open the work record", draft: false,
    });
  });
  it.each([
    ["alludes", "Parallel in an outside work", "1 Enoch shares wording or a saying with this passage."],
    ["background", "Outside work", "1 Enoch is linked to this passage."],
    ["describes", "Outside work", "1 Enoch presents itself as connected to this passage."],
    ["dates", "Outside work", "1 Enoch is dated by reference to this passage."],
    ["names", "Outside work", "1 Enoch names this book."],
  ] as const)("a %s link without a note", (linkType, lead, body) => {
    expect(toledotSentence(wnote("link", linkType))).toEqual({ lead, body, href: "/chitzonim/works/1-enoch", opens: "open the work record", draft: false });
  });
  it("a link note replaces the generic sentence", () => {
    expect(toledotSentence(wnote("link", "alludes", {}, { note: "Jude quotes 1 Enoch 1:9" }))).toMatchObject({
      lead: "Parallel in an outside work", body: "Jude quotes 1 Enoch 1:9.",
    });
  });
  it("is draft unless claims-checked or expert-reviewed", () => {
    expect(toledotSentence(wnote("link", "alludes", { status: "sources-located" })).draft).toBe(true);
    expect(toledotSentence(wnote("link", "alludes", { status: "expert-reviewed" })).draft).toBe(false);
  });
});
