import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VerseRange } from "@/lib/refs/verse-id";
import { InvestigationEditions, type InvestigationEdition } from "./InvestigationEditions";

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

const range = { start: 62_005_001, end: 62_005_021 } as unknown as VerseRange;

function edition(over: Partial<InvestigationEdition> & { translationId: number }): InvestigationEdition {
  return {
    code: `T${over.translationId}`,
    name: `Edition ${over.translationId}`,
    copyrightNotice: `Notice ${over.translationId}`,
    verses: [{ verseId: 62_005_007, text: `verse text ${over.translationId}` }] as never,
    omissions: [],
    footnotes: [],
    ...over,
  };
}

const web = edition({
  translationId: 1,
  code: "WEB",
  name: "World English Bible",
  copyrightNotice: "WEB is public domain.",
});
const kjv = edition({
  translationId: 2,
  code: "KJV",
  name: "King James Version",
  copyrightNotice: "KJV is public domain in the US.",
  footnotes: [
    {
      verseId: 62_005_007,
      noteOrder: 1,
      caller: "a",
      kind: "footnote",
      text: "Some manuscripts lack this verse.",
    },
  ] as never,
});

describe("InvestigationEditions", () => {
  it("renders each edition once through the single renderer with the shared range and layers off", () => {
    render(<InvestigationEditions editions={[web, kjv]} range={range} />);
    expect(renderer).toHaveBeenCalledTimes(2);
    const [a, b] = renderer.mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(a.translationId).toBe(1);
    expect(b.translationId).toBe(2);
    expect(a.verses).toBe(web.verses);
    expect(b.verses).toBe(kjv.verses);
    expect(a.omissions).toBe(web.omissions);
    expect(b.omissions).toBe(kjv.omissions);
    expect(a.range).toEqual(range);
    expect(b.range).toEqual(range);
    for (const call of [a, b]) {
      const layers = call.layerOverrides as Record<string, unknown>;
      for (const k of ["notes", "crossRefs", "heat", "interlinear", "insights", "toledot", "variants"]) {
        expect(layers[k]).toBe(false);
      }
    }
  });

  it("scopes footnotes to their own edition and shows chapter:verse", () => {
    render(<InvestigationEditions editions={[web, kjv]} range={range} />);
    const kjvRegion = screen.getByRole("region", { name: /King James/ });
    const webRegion = screen.getByRole("region", { name: /World English/ });
    const item = within(kjvRegion).getAllByRole("listitem")[0]!;
    expect(item.textContent).toContain("Some manuscripts lack this verse.");
    expect(item.textContent).toContain("a");
    expect(item.textContent).toContain("5:7");
    expect(webRegion.textContent).not.toContain("Some manuscripts lack this verse.");
  });

  it("shows each edition's copyright notice in its own region", () => {
    render(<InvestigationEditions editions={[web, kjv]} range={range} />);
    expect(screen.getByRole("region", { name: /World English/ }).textContent).toContain(
      "WEB is public domain.",
    );
    expect(screen.getByRole("region", { name: /King James/ }).textContent).toContain(
      "KJV is public domain in the US.",
    );
  });

  it("shows the scope note instead of a renderer when the edition lacks the book", () => {
    const jps = edition({
      translationId: 3,
      name: "Jewish Publication Society",
      verses: [],
      scopeNote: "Old Testament only.",
    });
    render(<InvestigationEditions editions={[web, jps]} range={range} />);
    expect(renderer).toHaveBeenCalledTimes(1);
    const region = screen.getByRole("region", { name: /Jewish Publication/ });
    expect(region.textContent).toContain("Old Testament only.");
    expect(within(region).queryByTestId("passage")).toBeNull();
  });

  it("renders no list items for an edition without footnotes", () => {
    render(<InvestigationEditions editions={[web, kjv]} range={range} />);
    const region = screen.getByRole("region", { name: /World English/ });
    expect(within(region).queryAllByRole("listitem")).toHaveLength(0);
  });
});
