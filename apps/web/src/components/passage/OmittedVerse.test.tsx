// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { OmittedVerse, type OmittedVerseNote } from "@/components/passage/OmittedVerse";

afterEach(cleanup);

const note = (kind: OmittedVerseNote["kind"], history: string): OmittedVerseNote => ({
  verseId: 43005004,
  verse: 4,
  kind,
  reason: "Reason text.",
  history,
  printedBy: [],
});

const draw = (n: OmittedVerseNote) =>
  render(<OmittedVerse note={n} passageSlug="John.5" detailed />).container;

describe("OmittedVerse by kind", () => {
  it("critical-text keeps the history block and the dating note", () => {
    const c = draw(note("critical-text", "Added later."));
    expect(c.querySelector(".omission__history")).not.toBeNull();
    expect(c.querySelector(".omission__dating-note")).not.toBeNull();
    expect(c.textContent).toContain("Added later.");
  });

  it("versification shows the gap and the reason, with no history or dating note", () => {
    const c = draw(note("versification", ""));
    expect(c.querySelector(".omission")).not.toBeNull();
    expect(c.textContent).toContain("Not printed in this translation");
    expect(c.textContent).toContain("Reason text.");
    expect(c.querySelector(".omission__history")).toBeNull();
    expect(c.querySelector(".omission__dating-note")).toBeNull();
  });

  it("unexplained shows the reason only", () => {
    const c = draw(note("unexplained", ""));
    expect(c.textContent).toContain("Reason text.");
    expect(c.querySelector(".omission__history")).toBeNull();
  });
});
