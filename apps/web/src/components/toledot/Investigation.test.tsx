import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Citation, InvestigationDetail } from "@/lib/db/timeline";
import { getLexiconEntry } from "@/lib/lexicon";
import { Investigation } from "./Investigation";

const renderer = vi.hoisted(() => vi.fn());
vi.mock("@/components/passage/PassageRenderer", () => ({
  PassageRenderer: (props: unknown) => {
    renderer(props);
    return <div data-testid="passage" />;
  },
}));

afterEach(() => {
  cleanup();
  renderer.mockClear();
});

const cite: Citation = {
  sourceId: "tov-2012", kind: "book", title: "Textual Criticism of the Hebrew Bible", author: "Emanuel Tov",
  container: null, publisher: "Fortress", year: 2012, url: null, locator: "p. 270",
};

const detail: InvestigationDetail = {
  id: "deut-32-8-9", title: "Sons of God or sons of Israel", status: "draft", gist: "g",
  start: 5_032_008 as never, end: 5_032_009 as never, witnessCount: 3, differenceCount: 2,
  summary: "The witnesses disagree.",
  witnesses: [
    { id: "mt", siglum: "MT", name: "Masoretic Text", reading: "bney yisra'el", translation: "sons of Israel", language: "he", note: null, citations: [cite] },
    { id: "lxx", siglum: "LXX", name: "Septuagint", reading: "angelon theou", translation: "angels of God", language: "grc", note: null, citations: [cite] },
    { id: "4q", siglum: "4QDeutj", name: "Dead Sea Scroll", reading: "bney elohim", translation: "sons of God", language: "he", note: null, citations: [cite] },
  ],
  editions: [{ code: "WEB", follows: "MT" }, { code: "KJV", follows: "MT" }, { code: "NETS", follows: "LXX" }],
  differences: [
    { id: "d1", kind: "textual", text: "The consonants differ.", heldBy: "Emanuel Tov", citations: [cite] },
    { id: "d2", kind: "interpretive", text: "The angels are a later gloss.", heldBy: null, citations: [cite] },
  ],
  challenges: [{ id: "c1", text: "The scroll may be a harmonisation.", citations: [cite] }],
};
const passage = { label: "Deuteronomy 32:8–9", verses: [{ verseId: 5_032_008 }] as never, range: { start: 5_032_008, end: 5_032_009 } as never, translationId: 1 };

const ui = (d = detail) => render(<Investigation investigation={d} passage={passage} />);

describe("<Investigation>", () => {
  it("renders the title as h1 and the review sentence", () => {
    ui();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(detail.title);
    expect(screen.getByRole("note").textContent).toContain(getLexiconEntry("review-draft").gloss);
  });

  it("passes verses, range and translationId to the one PassageRenderer", () => {
    ui();
    expect(renderer).toHaveBeenCalled();
    expect(renderer.mock.calls[0][0]).toMatchObject({
      verses: passage.verses, range: passage.range, translationId: 1,
    });
  });

  it("lists witnesses in a table with headers and lang on the reading", () => {
    ui();
    const table = screen.getByRole("table");
    for (const h of ["Siglum", "Witness", "Reading", "Translation"]) {
      expect(within(table).getByRole("columnheader", { name: h })).toBeTruthy();
    }
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    for (const [i, w] of detail.witnesses.entries()) {
      for (const t of [w.siglum, w.name, w.reading, w.translation]) expect(rows[i].textContent).toContain(t);
      expect(within(rows[i]).getByText(w.reading).closest("[lang]")!.getAttribute("lang")).toBe(w.language);
    }
  });

  it("groups editions by the witness they follow; unfollowed witnesses get no item", () => {
    ui();
    const items = screen.getAllByRole("listitem");
    const mt = items.find((li) => li.textContent!.includes("MT"))!;
    expect(mt.textContent).toContain("WEB");
    expect(mt.textContent).toContain("KJV");
    const lxx = items.find((li) => li.textContent!.includes("LXX"))!;
    expect(lxx.textContent).toContain("NETS");
    expect(items.some((li) => li.textContent!.includes("4QDeutj"))).toBe(false);
  });

  it("renders each difference under an h3 with gloss, text and holder", () => {
    ui();
    for (const d of detail.differences) {
      const entry = getLexiconEntry(`difference-${d.kind}` as never);
      expect(screen.getByRole("heading", { level: 3, name: entry.term })).toBeTruthy();
      expect(screen.getByText(entry.gloss)).toBeTruthy();
      expect(screen.getByText(d.text)).toBeTruthy();
    }
    expect(screen.getAllByText(/Held by Emanuel Tov/)).toHaveLength(1);
  });

  it("renders challenges, and omits the heading when there are none", () => {
    ui();
    expect(screen.getByText(detail.challenges[0].text)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Challenges" })).toBeTruthy();
    cleanup();
    ui({ ...detail, challenges: [] });
    expect(screen.queryByRole("heading", { name: "Challenges" })).toBeNull();
  });
});
