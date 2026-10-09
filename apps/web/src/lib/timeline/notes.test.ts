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

const event = (over: Record<string, unknown> = {}): Subject => ({
  kind: "event", id: "ev-exodus", title: "The Exodus", status: "claims-checked", confidence: "contested",
  earliest: -1446, latest: -1200, positions: [{ label: "Early date (c. 1446 BCE)", tradition: "chronological" }, { label: "Late date (13th century BCE)", tradition: "critical" }],
  ...over,
}) as Subject;

describe("toledotSentence: events", () => {
  it("two or more positions: disputed, with the count and the span", () => {
    expect(toledotSentence(note(event()))).toEqual({
      lead: "Dating disputed",
      body: "Scholars disagree about the date of the Exodus: two positions, spanning 1446–1200 BCE.",
      href: "/toledot/events/ev-exodus",
      draft: false,
    });
  });

  it("one position, firm: 'Dated' with the formatted range", () => {
    const s = toledotSentence(note(event({ confidence: "firm", earliest: -587, latest: -586, title: "Fall of Jerusalem", positions: [{ label: "Only", tradition: "critical" }] })));
    expect(s).toMatchObject({ lead: "Dated", body: "Scholars place Fall of Jerusalem in 587–586 BCE.", href: "/toledot/events/ev-exodus" });
  });

  it("one position, not firm: names the confidence", () => {
    const s = toledotSentence(note(event({ confidence: "speculative", earliest: -450, latest: -450, title: "Torah closed", positions: [{ label: "Only", tradition: "critical" }] })));
    expect(s).toMatchObject({ lead: "Dated, speculative", body: "Scholars place Torah closed in 450 BCE." });
  });
});

describe("toledotSentence: new shapes", () => {
  it("event title not starting with 'The' keeps its case; 'The' is lower-cased", () => {
    const one = (title: string) => event({ confidence: "firm", title, earliest: -587, latest: -586, positions: [{ label: "Only", tradition: "critical" }] });
    expect(toledotSentence(note(one("The Exile"))).body).toBe("Scholars place the Exile in 587–586 BCE.");
    expect(toledotSentence(note(one("Composition of James"))).body).toBe("Scholars place composition of James in 587–586 BCE.");
  });
  it("issue title already a question is used as is", () => {
    const s = toledotSentence(note({ kind: "issue", id: "i", title: "Is there a historical Moses?", issueKind: "historical", status: "claims-checked" }));
    expect(s.body).toBe("Is there a historical Moses?");
  });
});

describe("toledotSentence: traditional lens", () => {
  it("counts scholarly positions only", () => {
    const s = toledotSentence(note(event({
      positions: [
        { label: "A", tradition: "chronological" }, { label: "B", tradition: "traditional" }, { label: "C", tradition: "critical" },
      ],
    })));
    expect(s.lead).toBe("Dating disputed");
    expect(s.body).toContain("two positions");
  });

  it("only traditional positions: lead 'Traditional date', body is the label", () => {
    const s = toledotSentence(note(event({
      positions: [{ label: "Ussher's count", tradition: "traditional" }],
    })));
    expect(s.lead).toBe("Traditional date");
    expect(s.body).toBe("Only a traditional count dates the Exodus, to Ussher's count; no outside evidence fixes it.");
  });
});

describe("toledotSentence: arguments", () => {
  const arg = (stance: "for" | "against"): Subject => ({
    kind: "argument", eventId: "ev-exodus", eventTitle: "The Exodus", eventStatus: "claims-checked", positionLabel: "Early date", stance,
  });
  it("for: label then event title", () => {
    expect(toledotSentence(note(arg("for")))).toEqual({
      lead: "Cited in dating", body: "This passage is cited for one dating of the Exodus: “Early date”.", href: "/toledot/events/ev-exodus", draft: false,
    });
  });
  it("against: adds ', against'", () => {
    expect(toledotSentence(note(arg("against"))).body).toBe("This passage is cited against one dating of the Exodus: “Early date”.");
  });
});

describe("toledotSentence: issues", () => {
  it.each([
    ["chronology", "Chronology question"],
    ["textual", "Textual question"],
    ["historical", "Historical question"],
    ["internal", "Internal question"],
  ] as const)("%s issue leads with %s", (issueKind, lead) => {
    const s = toledotSentence(note({ kind: "issue", id: "iss-1", title: "The 480 years", issueKind, status: "claims-checked" }));
    expect(s).toEqual({ lead, body: "An open question: The 480 years.", href: "/toledot/issues/iss-1", draft: false });
  });
});

describe("toledotSentence: persons", () => {
  const person = (evidence: EvidenceGrade, hasTension = false): Subject => ({
    kind: "person", id: "per-h", name: "Hezekiah", evidence, hasTension, status: "claims-checked",
  });
  const grades: EvidenceGrade[] = ["corroborates", "partially-corroborates", "consistent", "silent", "none"];

  it.each(grades)("lead for %s equals the shared EVIDENCE_MEANING", (grade) => {
    const s = toledotSentence(note(person(grade)));
    expect(s.lead).toBe(EVIDENCE_MEANING[grade]);
    expect(s).toMatchObject({ body: "Hezekiah appears here; " + EVIDENCE_MEANING[grade].replace(/^N/, "n").replace(/^P/, "p").replace(/^F/, "f").replace(/^O/, "o") + ".", href: "/toledot/people/per-h" });
  });

  it("uses the contract's wording for each grade", () => {
    expect(EVIDENCE_MEANING).toEqual({
      corroborates: "Named by a source outside the Bible",
      "partially-corroborates": "Partly confirmed by an outside source",
      consistent: "Fits an outside source",
      silent: "Outside sources are silent",
      none: "No outside evidence",
    });
  });

  it("with tension appends '; a source contradicts a detail'", () => {
    expect(toledotSentence(note(person("corroborates", true))).lead)
      .toBe("Named by a source outside the Bible; a source contradicts a detail");
  });
});

describe("toledotSentence: artifacts", () => {
  const artifact = (relation: Relation | null): Subject => ({
    kind: "artifact", id: "art-nab", name: "Nabonidus Cylinder", status: "claims-checked", relation,
  });
  it.each([
    ["in-tension", "Outside source in tension with this passage", "contradicts"],
    ["corroborates", "Outside source corroborates this passage", "corroborates"],
    ["partially-corroborates", "Outside source corroborates this passage", "partly corroborates"],
    ["consistent", "Outside source", "is consistent with"],
    ["silent", "Outside source", "is silent on"],
    [null, "Outside source", "is silent on"],
  ] as const)("relation %s leads with '%s'", (relation, lead, verb) => {
    expect(toledotSentence(note(artifact(relation)))).toEqual({
      lead, body: `Nabonidus Cylinder is an outside source that ${verb} this passage.`, href: "/toledot/artifacts/art-nab", draft: false,
    });
  });
});

describe("toledotSentence: link note and draft", () => {
  it("carries the link's own note as a separate sentence, not in the body", () => {
    const p = { kind: "person", id: "per-b", name: "Belshazzar", evidence: "none", hasTension: false, status: "claims-checked" } as const;
    const s = toledotSentence(note(p, { note: "Nebuchadnezzar his father" }));
    expect(s.body).toBe("Belshazzar appears here; no outside evidence.");
    expect(s.note).toBe("Nebuchadnezzar his father.");
    expect(toledotSentence(note(p, { note: "Already ends." })).note).toBe("Already ends.");
    expect(toledotSentence(note(p)).note).toBeUndefined();
  });

  it("flags draft for every subject kind that is draft", () => {
    expect(toledotSentence(note(event({ status: "draft" }))).draft).toBe(true);
    expect(toledotSentence(note({ kind: "argument", eventId: "e", eventTitle: "E", eventStatus: "draft", positionLabel: "P", stance: "for" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "issue", id: "i", title: "T", issueKind: "textual", status: "draft" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "person", id: "p", name: "N", evidence: "none", hasTension: false, status: "draft" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "artifact", id: "a", name: "N", status: "draft", relation: null })).draft).toBe(true);
    expect(toledotSentence(note(event({ status: "claims-checked" }))).draft).toBe(false);
  });

  it("still flags an event whose sources are located but whose claims are unchecked", () => {
    expect(toledotSentence(note(event({ status: "sources-located" }))).draft).toBe(true);
    expect(toledotSentence(note(event({ status: "claims-checked" }))).draft).toBe(false);
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
  const wnote = (role: "link" | "record", linkType: ToledotNote["linkType"], over: Record<string, unknown> = {}, extra: Partial<WorkNote> = {}): WorkNote => ({
    id: "work:1-enoch@65001014", anchor: 65_001_014 as never, start: 65_001_014 as never, end: 65_001_015 as never,
    linkType, note: null,
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
    ["background", "Retold in an outside work", "1 Enoch retells or builds on this passage."],
    ["describes", "Named in an outside work", "1 Enoch attaches itself to this passage."],
    ["dates", "Outside work", "1 Enoch is dated by reference to this passage."],
  ] as const)("a %s link reads as its own sentence", (linkType, lead, body) => {
    expect(toledotSentence(wnote("link", linkType))).toMatchObject({ lead, body, href: "/chitzonim/works/1-enoch", opens: "open the work record" });
  });
  it("appends the link note as a sentence", () => {
    expect(toledotSentence(wnote("link", "alludes", {}, { note: "Jude quotes 1 Enoch 1:9" }))).toMatchObject({
      lead: "Parallel in an outside work", note: "Jude quotes 1 Enoch 1:9.",
    });
  });
  it("is draft unless claims-checked or expert-reviewed", () => {
    expect(toledotSentence(wnote("link", "alludes", { status: "sources-located" })).draft).toBe(true);
    expect(toledotSentence(wnote("link", "alludes", { status: "expert-reviewed" })).draft).toBe(false);
  });
});
