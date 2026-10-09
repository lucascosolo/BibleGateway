import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { VerseRange } from "@/lib/refs/verse-id";

import { InvestigationEditions, type InvestigationEdition } from "./InvestigationEditions";

afterEach(cleanup);

const range = { start: 1_001_001, end: 1_001_005 } as unknown as VerseRange;

const edition = (code: string, id: number): InvestigationEdition => ({
  translationId: id,
  code,
  name: code,
  copyrightNotice: "x",
  verses: [],
  omissions: [],
  footnotes: [],
  scopeNote: "not shown here",
});

const translationsLinks = () => document.querySelectorAll('a[href="/translations"]');

describe("InvestigationEditions independence note", () => {
  it("links to /translations when two editions share a lineage (KJV + ASV)", () => {
    render(<InvestigationEditions editions={[edition("KJV", 1), edition("ASV", 2)]} range={range} />);
    expect(translationsLinks().length).toBeGreaterThanOrEqual(1);
  });

  it("shows no such link for independent editions (DBY + YLT)", () => {
    render(<InvestigationEditions editions={[edition("DBY", 1), edition("YLT", 2)]} range={range} />);
    expect(translationsLinks()).toHaveLength(0);
  });
});
