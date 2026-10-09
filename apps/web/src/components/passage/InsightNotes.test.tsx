import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { InsightNote } from "@/lib/insights/notes";
import { InsightNotes } from "./InsightNotes";

afterEach(cleanup);

const note = (over: Partial<InsightNote> = {}): InsightNote => ({
  id: "n1",
  verseId: 1_002_021 as never,
  text: "A plain sentence.",
  source: "A reference",
  ...over,
});

describe("<InsightNotes>", () => {
  it("renders the Other readings group when a note has alternatives", () => {
    const { container } = render(<InsightNotes notes={[note({ alternatives: "Another view." })]} />);
    expect(container.textContent).toContain("Other readings:");
    expect(container.textContent).toContain("Another view.");
  });

  it("omits the Other readings group when a note has none", () => {
    const { container } = render(<InsightNotes notes={[note()]} />);
    expect(container.textContent).not.toContain("Other readings:");
    expect(container.textContent).toContain("A reference");
  });
});
