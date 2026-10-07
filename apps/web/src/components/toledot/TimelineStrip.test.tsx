import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Era, EventSummary } from "@/lib/db/timeline";
import { TimelineStrip } from "./TimelineStrip";

afterEach(cleanup);

type Ev = EventSummary & { display: string };
const ev = (id: string, title: string, axis: Ev["axis"], confidence: Ev["confidence"], display: string): Ev => ({
  id, title, axis, category: "x", confidence, status: "draft", earliest: -900, latest: -800, bookIds: [], segment: null, display,
});

const eras: Era[] = [{ id: "monarchy", name: "Divided monarchy", start: -930, end: -586, summary: "", citations: [] }];
const events = [
  ev("fall-of-samaria", "Fall of Samaria", "narrative", "contested", "722–720 BCE"),
  ev("isaiah-scroll", "Isaiah composed", "composition", "firm", "740–700 BCE"),
  ev("hebrew-canon", "Canon closes", "canon", "speculative", "90–200 CE"),
];

describe("TimelineStrip", () => {
  it("renders one link per event, named by title and display range", () => {
    render(<TimelineStrip eras={eras} events={events} from={-1000} to={300} />);
    const link = screen.getByRole("link", { name: /Fall of Samaria/ });
    expect(link.getAttribute("href")).toBe("/toledot/events/fall-of-samaria");
    expect(link.getAttribute("aria-label") ?? link.textContent).toContain("722–720 BCE");
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("shows confidence as text inside the link", () => {
    render(<TimelineStrip eras={eras} events={events} from={-1000} to={300} />);
    const link = screen.getByRole("link", { name: /Fall of Samaria/ });
    expect(within(link).getByText(/contested/i)).toBeTruthy();
  });

  it("labels a lane for each axis", () => {
    render(<TimelineStrip eras={eras} events={events} from={-1000} to={300} />);
    for (const axis of ["narrative", "composition", "canon"]) {
      expect(screen.getAllByLabelText(new RegExp(`^${axis}`, "i")).length).toBeGreaterThan(0);
    }
  });
});
