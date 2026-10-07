import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ToledotNote } from "@/lib/db/timeline";
import { ToledotNotes } from "./ToledotNotes";

afterEach(cleanup);

const issueNote = (over: Partial<ToledotNote> = {}, status: "draft" | "reviewed" = "reviewed"): ToledotNote => ({
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
      subject: { kind: "person", id: "per-h", name: "Hezekiah", evidence: "corroborates", hasTension: false, status: "reviewed" },
    });
    render(<ToledotNotes notes={[issueNote(), second]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Named by a source outside the Bible: Hezekiah — open on the timeline" })
      .getAttribute("href")).toBe("/toledot/people/per-h");
  });

  it("shows a 'draft' caption only for draft subjects", () => {
    const { rerender } = render(<ToledotNotes notes={[issueNote({}, "reviewed")]} />);
    expect(screen.queryByText("draft")).toBeNull();
    rerender(<ToledotNotes notes={[issueNote({}, "draft")]} />);
    expect(screen.getByText("draft")).toBeTruthy();
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
