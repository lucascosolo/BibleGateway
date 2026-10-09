import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getLexiconEntry, type LexiconId } from "@/lib/lexicon";
import { FAMILIES, PROFILES, getProfile } from "@/lib/translations/profiles";

import { TranslationComparison } from "./TranslationComparison";

afterEach(cleanup);

function rows() {
  return screen.getAllByRole("row").slice(1);
}
function rowFor(code: string) {
  const row = rows().find((r) => within(r).queryByRole("link")?.getAttribute("href") === `/translations/${code}`);
  if (!row) throw new Error(`no row for ${code}`);
  return row;
}
function renderIt() {
  return render(<TranslationComparison profiles={PROFILES} audioCodes={new Set(["WEB"])} />);
}

describe("TranslationComparison", () => {
  it("renders one table with the seven named column headers", () => {
    renderIt();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent?.trim())).toEqual([
      "Edition",
      "Year",
      "Old Testament source",
      "New Testament source",
      "Approach",
      "Family",
      "Audio",
    ]);
  });

  it("renders one body row per profile", () => {
    renderIt();
    expect(rows()).toHaveLength(PROFILES.length);
  });

  it("links each edition to its profile page by name", () => {
    renderIt();
    for (const p of PROFILES) {
      const link = within(rowFor(p.code)).getByRole("link");
      expect(link.getAttribute("href")).toBe(`/translations/${p.code}`);
      expect(link.getAttribute("aria-label") ?? link.textContent).toContain(p.name);
    }
  });

  it("marks audio Yes only for codes in audioCodes", () => {
    renderIt();
    const audio = (code: string) => within(rowFor(code)).getAllByRole("cell").at(-1)?.textContent?.trim();
    expect(audio("WEB")).toBe("Yes");
    expect(audio("KJV")).toBe("No");
  });

  it("says Not included for a missing testament source", () => {
    renderIt();
    const cells = within(rowFor("JPS")).getAllByRole("cell");
    expect(cells[3].textContent?.trim()).toBe("Not included");
  });

  it("shows the approach term and family label", () => {
    renderIt();
    for (const p of PROFILES) {
      const cells = within(rowFor(p.code)).getAllByRole("cell");
      expect(cells[4].textContent).toContain(getLexiconEntry(`approach-${p.approach}` as LexiconId).term);
      expect(cells[5].textContent).toContain(FAMILIES[p.family].label);
    }
    expect(getProfile("KJV")).toBeDefined();
  });
});
