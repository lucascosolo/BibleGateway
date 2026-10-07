import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EvidenceGrade } from "@/lib/db/timeline";
import { EvidenceBadge } from "./EvidenceBadge";

afterEach(cleanup);

const MEANING: Record<EvidenceGrade, string> = {
  corroborates: "Named by a source outside the Bible",
  "partially-corroborates": "Partly confirmed; the reading is disputed",
  consistent: "Fits an outside source without naming them",
  silent: "Outside sources exist but say nothing",
  none: "No outside evidence",
};

describe("EvidenceBadge", () => {
  for (const [grade, meaning] of Object.entries(MEANING) as [EvidenceGrade, string][]) {
    it(`${grade}: shows the word and carries the meaning in the accessible name`, () => {
      render(<EvidenceBadge grade={grade} hasTension={false} />);
      expect(screen.getByText(grade)).toBeTruthy();
      expect(screen.getByLabelText(new RegExp(meaning, "i"))).toBeTruthy();
      expect(screen.queryByLabelText(/contradicts/i)).toBeNull();
    });
  }

  it("hasTension adds a contradiction sentence to the accessible name", () => {
    render(<EvidenceBadge grade="corroborates" hasTension />);
    expect(screen.getByLabelText(/contradicts/i)).toBeTruthy();
  });
});
