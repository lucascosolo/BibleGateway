// Cross-reference wording must not imply evidential strength: votes are OpenBible readers'
// relevance ratings of a compiled link, not scholarly confidence.

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TIER_META } from "@/lib/crossrefs/tiers";
import { CorpusDoorways } from "@/components/home/CorpusDoorways";
import { CrossRefPanel } from "./CrossRefPanel";

vi.mock("@/components/passage/PassageRenderer", () => ({ PassageRenderer: () => null }));

const emptySide = { groups: [], returned: 0, total: 0 };
const emptyResponse = {
  reference: "John 3",
  range: { start: 43003001, end: 43003036 },
  translation: { code: "WEB" },
  total: 0,
  outbound: emptySide,
  inbound: emptySide,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CrossRefPanel wording", () => {
  it("labels the filter as community relevance and the empty state never says confidence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => emptyResponse })));
    const { container } = render(
      <CrossRefPanel reference="John 3" translationCode="WEB" translationId={1} />,
    );
    expect(container.querySelector('[aria-label="Minimum community relevance"]')).not.toBeNull();

    const strong = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Strong")!;
    await act(async () => {
      fireEvent.click(strong);
    });
    await act(async () => {});
    const empty = container.querySelector(".xref-panel__empty");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("relevance");
    expect(empty!.textContent).not.toContain("confidence");
  });

  it("says where the votes come from in every tier description", () => {
    for (const meta of Object.values(TIER_META)) {
      expect(meta.description).toContain("votes from OpenBible readers");
    }
  });
});

describe("CorpusDoorways wording", () => {
  it("says linked from, never cited by", () => {
    const verse = { verseId: 43003016, osisRef: "John.3.16", inboundCount: 7 };
    const { container } = render(
      <CorpusDoorways
        translationId={1}
        topVerses={[verse as never]}
        omissions={[]}
        references={new Map([[43003016, "John 3:16"]])}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("linked from 7 other passages");
    expect(text).not.toContain("cited by");
  });
});
