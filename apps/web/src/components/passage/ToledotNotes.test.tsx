import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ToledotNote } from "@/lib/db/timeline";
import { ToledotNotes } from "./ToledotNotes";

afterEach(cleanup);

const issueNote = (over: Partial<ToledotNote> = {}, status: "draft" | "claims-checked" = "claims-checked"): ToledotNote => ({
  id: "issue:iss-1@1001001", anchor: 1_001_001 as never, start: 1_001_001 as never, end: 1_001_003 as never,
  linkType: "background",
  subject: { kind: "issue", id: "iss-1", title: "Is there a historical Moses?", issueKind: "historical", status },
  note: null,
  ...over,
});

describe("<ToledotNotes>", () => {
  it("renders nothing for no notes", () => {
    const { container } = render(<ToledotNotes notes={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the lead in <strong>, the body, and a link to the subject page", () => {
    const { container } = render(<ToledotNotes notes={[issueNote()]} />);
    const item = container.querySelector("li.toledot-note") as HTMLElement;
    expect(item).not.toBeNull();
    expect(item.querySelector("strong")!.textContent).toBe("Historical question");
    expect(item.textContent).toContain("Is there a historical Moses?");
    const link = within(item).getByRole("link", {
      name: "Historical question: Is there a historical Moses? — open on the timeline",
    });
    expect(link.getAttribute("href")).toBe("/toledot/issues/iss-1");
  });

  it("renders one item per note", () => {
    const second = issueNote({
      id: "person:per-h@1001001",
      subject: { kind: "person", id: "per-h", name: "Hezekiah", evidence: "corroborates", hasTension: false, status: "claims-checked" },
    });
    render(<ToledotNotes notes={[issueNote(), second]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Named by a source outside the Bible: Hezekiah appears here; named by a source outside the Bible. — open on the timeline" })
      .getAttribute("href")).toBe("/toledot/people/per-h");
  });

  it("prints the verse-link note as its own sentence, outside the link's accessible name", () => {
    const { container } = render(<ToledotNotes notes={[issueNote({ note: "Asked of Exodus 3" })]} />);
    expect(container.querySelector(".toledot-note__text")!.textContent).toContain("Moses? Asked of Exodus 3.");
    expect(screen.getByRole("link", { name: "Historical question: Is there a historical Moses? — open on the timeline" })).toBeTruthy();
  });

  it("shows an 'unchecked' caption only for subjects whose claims are unchecked", () => {
    const { rerender } = render(<ToledotNotes notes={[issueNote({}, "claims-checked")]} />);
    expect(screen.queryByText("unchecked")).toBeNull();
    rerender(<ToledotNotes notes={[issueNote({}, "draft")]} />);
    expect(screen.getByText("unchecked")).toBeTruthy();
  });

  it("shows the span text only when one is provided for that note id", () => {
    const n = issueNote();
    const { rerender } = render(<ToledotNotes notes={[n]} />);
    expect(screen.queryByText(/verses 1–3/)).toBeNull();
    rerender(<ToledotNotes notes={[n]} spans={new Map([[n.id, "verses 1–3"]])} />);
    expect(screen.getByText(/verses 1–3/)).toBeTruthy();
    rerender(<ToledotNotes notes={[n]} spans={new Map([["other:id@1", "verses 9–9"]])} />);
    expect(screen.queryByText(/verses 9–9/)).toBeNull();
  });
});

describe("<ToledotNotes> work notes", () => {
  const workNote = (status: string): import("@/lib/db/timeline").WorkNote => ({
    id: "work:1-enoch@65001014", anchor: 65_001_014 as never, start: 65_001_014 as never, end: 65_001_015 as never,
    linkType: "alludes", note: null,
    subject: { kind: "work", id: "1-enoch", title: "1 Enoch", status: status as never, role: "link" },
  });
  it("links to the work with its own aria-label, and marks it unchecked when draft", () => {
    render(<ToledotNotes notes={[workNote("sources-located")]} />);
    const link = screen.getByRole("link", {
      name: "Parallel in an outside work: 1 Enoch shares wording or a saying with this passage. — open the work record",
    });
    expect(link.getAttribute("href")).toBe("/chitzonim/works/1-enoch");
    expect(screen.getByText("unchecked")).toBeTruthy();
  });
  it("no unchecked marker for a checked work; other kinds keep 'open on the timeline'", () => {
    render(<ToledotNotes notes={[workNote("claims-checked"), issueNote()]} />);
    expect(screen.queryByText("unchecked")).toBeNull();
    expect(screen.getByRole("link", { name: "Historical question: Is there a historical Moses? — open on the timeline" })).toBeTruthy();
  });
});
