import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ReviewStatus } from "@/lib/db/timeline";
import { getLexiconEntry } from "@/lib/lexicon";
import { ReviewMarker } from "./ReviewMarker";

afterEach(cleanup);

const TEXT: Record<ReviewStatus, string> = {
  draft: "Draft.",
  "sources-located": "Sources located; claims not yet checked against them.",
  "claims-checked": "Claims checked against the cited pages.",
  "expert-reviewed": "Reviewed by a subject expert.",
};

describe("ReviewMarker", () => {
  for (const [status, text] of Object.entries(TEXT) as [ReviewStatus, string][]) {
    describe(status, () => {
      it("renders its exact sentence as a note", () => {
        render(<ReviewMarker status={status} />);
        expect(screen.getByRole("note").textContent?.trim()).toBe(text);
      });

      it("carries the lexicon gloss in the accessible name", () => {
        render(<ReviewMarker status={status} />);
        const gloss = getLexiconEntry(`review-${status}`).gloss;
        expect(gloss.length).toBeGreaterThan(0);
        expect(screen.getByRole("note").getAttribute("aria-label")).toContain(gloss);
      });

      it("has the toledot-review class", () => {
        render(<ReviewMarker status={status} />);
        expect(screen.getByRole("note").className).toContain("toledot-review");
      });
    });
  }
});
