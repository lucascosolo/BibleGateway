import { describe, expect, it } from "vitest";

import type { EvidenceGrade, Relation, ToledotNote } from "@/lib/db/timeline";
import { EVIDENCE_MEANING } from "@/lib/timeline/evidence";
import { toledotSentence } from "./notes";

type Subject = ToledotNote["subject"];

function note(subject: Subject, extra: Partial<ToledotNote> = {}): ToledotNote {
  return {
    id: "x:1@1001001", anchor: 1_001_001 as never, start: 1_001_001 as never, end: 1_001_001 as never,
    linkType: "describes", subject, note: null, ...extra,
  };
}

const event = (over: Record<string, unknown> = {}): Subject => ({
  kind: "event", id: "ev-exodus", title: "The Exodus", status: "reviewed", confidence: "contested",
  earliest: -1446, latest: -1200, positions: [{ label: "Early date (c. 1446 BCE)", tradition: "chronological" }, { label: "Late date (13th century BCE)", tradition: "critical" }],
  ...over,
}) as Subject;

describe("toledotSentence: events", () => {
  it("two or more positions: disputed, labels verbatim joined by 'or'", () => {
    expect(toledotSentence(note(event()))).toEqual({
      lead: "Dating disputed",
      body: "Early date (c. 1446 BCE) or Late date (13th century BCE) — The Exodus",
      href: "/toledot/events/ev-exodus",
      draft: false,
    });
  });

  it("one position, firm: 'Dated' with the formatted range", () => {
    const s = toledotSentence(note(event({ confidence: "firm", earliest: -587, latest: -586, title: "Fall of Jerusalem", positions: [{ label: "Only", tradition: "critical" }] })));
    expect(s).toMatchObject({ lead: "Dated", body: "587–586 BCE — Fall of Jerusalem", href: "/toledot/events/ev-exodus" });
  });

  it("one position, not firm: names the confidence", () => {
    const s = toledotSentence(note(event({ confidence: "speculative", earliest: -450, latest: -450, title: "Torah closed", positions: [{ label: "Only", tradition: "critical" }] })));
    expect(s).toMatchObject({ lead: "Dated, speculative", body: "450 BCE — Torah closed" });
  });
});

describe("toledotSentence: traditional lens", () => {
  it("joins scholarly position labels only", () => {
    const s = toledotSentence(note(event({
      positions: [
        { label: "A", tradition: "chronological" }, { label: "B", tradition: "traditional" }, { label: "C", tradition: "critical" },
      ],
    })));
    expect(s.lead).toBe("Dating disputed");
    expect(s.body).toContain("A");
    expect(s.body).toContain("C");
    expect(s.body).not.toContain("B");
  });

  it("only traditional positions: lead 'Traditional date', body is the label", () => {
    const s = toledotSentence(note(event({
      positions: [{ label: "Ussher's count", tradition: "traditional" }],
    })));
    expect(s.lead).toBe("Traditional date");
    expect(s.body).toContain("Ussher's count");
  });
});

describe("toledotSentence: arguments", () => {
  const arg = (stance: "for" | "against"): Subject => ({
    kind: "argument", eventId: "ev-exodus", eventTitle: "The Exodus", eventStatus: "reviewed", positionLabel: "Early date", stance,
  });
  it("for: label then event title", () => {
    expect(toledotSentence(note(arg("for")))).toEqual({
      lead: "Cited in dating", body: "Early date — The Exodus", href: "/toledot/events/ev-exodus", draft: false,
    });
  });
  it("against: adds ', against'", () => {
    expect(toledotSentence(note(arg("against"))).body).toBe("Early date, against — The Exodus");
  });
});

describe("toledotSentence: issues", () => {
  it.each([
    ["chronology", "Chronology question"],
    ["textual", "Textual question"],
    ["historical", "Historical question"],
    ["internal", "Internal question"],
  ] as const)("%s issue leads with %s", (issueKind, lead) => {
    const s = toledotSentence(note({ kind: "issue", id: "iss-1", title: "The 480 years", issueKind, status: "reviewed" }));
    expect(s).toEqual({ lead, body: "The 480 years", href: "/toledot/issues/iss-1", draft: false });
  });
});

describe("toledotSentence: persons", () => {
  const person = (evidence: EvidenceGrade, hasTension = false): Subject => ({
    kind: "person", id: "per-h", name: "Hezekiah", evidence, hasTension, status: "reviewed",
  });
  const grades: EvidenceGrade[] = ["corroborates", "partially-corroborates", "consistent", "silent", "none"];

  it.each(grades)("lead for %s equals the shared EVIDENCE_MEANING", (grade) => {
    const s = toledotSentence(note(person(grade)));
    expect(s.lead).toBe(EVIDENCE_MEANING[grade]);
    expect(s).toMatchObject({ body: "Hezekiah", href: "/toledot/people/per-h" });
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
    kind: "artifact", id: "art-nab", name: "Nabonidus Cylinder", status: "reviewed", relation,
  });
  it.each([
    ["in-tension", "Outside source in tension with this passage"],
    ["corroborates", "Outside source corroborates this passage"],
    ["partially-corroborates", "Outside source corroborates this passage"],
    ["consistent", "Outside source"],
    ["silent", "Outside source"],
    [null, "Outside source"],
  ] as const)("relation %s leads with '%s'", (relation, lead) => {
    expect(toledotSentence(note(artifact(relation)))).toEqual({
      lead, body: "Nabonidus Cylinder", href: "/toledot/artifacts/art-nab", draft: false,
    });
  });
});

describe("toledotSentence: link note and draft", () => {
  it("appends the link's own note to the body in parentheses", () => {
    const s = toledotSentence(note({ kind: "person", id: "per-b", name: "Belshazzar", evidence: "none", hasTension: false, status: "reviewed" }, { note: "Nebuchadnezzar his father" }));
    expect(s.body).toBe("Belshazzar (Nebuchadnezzar his father)");
  });

  it("flags draft for every subject kind that is draft", () => {
    expect(toledotSentence(note(event({ status: "draft" }))).draft).toBe(true);
    expect(toledotSentence(note({ kind: "argument", eventId: "e", eventTitle: "E", eventStatus: "draft", positionLabel: "P", stance: "for" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "issue", id: "i", title: "T", issueKind: "textual", status: "draft" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "person", id: "p", name: "N", evidence: "none", hasTension: false, status: "draft" })).draft).toBe(true);
    expect(toledotSentence(note({ kind: "artifact", id: "a", name: "N", status: "draft", relation: null })).draft).toBe(true);
    expect(toledotSentence(note(event({ status: "reviewed" }))).draft).toBe(false);
  });
});
