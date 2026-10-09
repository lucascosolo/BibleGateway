import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OUTSIDE_AREAS, canonNotice } from "@/lib/chitzonim/outside";
import { CanonNotice } from "./CanonNotice";
import { OutsideWorld } from "./OutsideWorld";
import { ThresholdAreas } from "./ThresholdAreas";

afterEach(cleanup);

describe("OutsideWorld", () => {
  it("wraps outside books in a data-world element with the outside-world class", () => {
    const { container } = render(<OutsideWorld bookId={67} className="x"><p>hi</p></OutsideWorld>);
    const worlds = container.querySelectorAll('[data-world="outside"]');
    expect(worlds).toHaveLength(1);
    expect(worlds[0].className).toContain("outside-world");
    expect(worlds[0].textContent).toBe("hi");
  });
  it("renders children bare for canonical books", () => {
    const { container } = render(<OutsideWorld bookId={43}><p>hi</p></OutsideWorld>);
    expect(container.querySelector("[data-world]")).toBeNull();
    expect(container.textContent).toBe("hi");
  });
});

describe("CanonNotice", () => {
  it("renders nothing for a null notice", () => {
    const { container } = render(<CanonNotice notice={null} />);
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("note")).toBeNull();
  });
  it("renders a note with the notice and numbering", () => {
    render(<CanonNotice notice="Outside the canon." numbering="logion 3" />);
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("Outside the canon.");
    expect(note.textContent).toContain("logion 3");
  });
});

describe("reader header composite", () => {
  it("outside book gets the world and the notice", () => {
    const { container } = render(
      <OutsideWorld bookId={101}>
        <header><CanonNotice notice={canonNotice("nt-apocrypha", [])} numbering="logion 1 to logion 12" /></header>
      </OutsideWorld>,
    );
    expect(container.querySelector('[data-world="outside"]')).not.toBeNull();
    const text = screen.getByRole("note").textContent ?? "";
    expect(text).toMatch(/^Outside the/);
    expect(text).toContain("logion 1");
  });
  it("canonical book gets neither", () => {
    const { container } = render(
      <OutsideWorld bookId={43}>
        <header><CanonNotice notice={canonNotice("nt", [])} /></header>
      </OutsideWorld>,
    );
    expect(container.querySelector("[data-world]")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("ThresholdAreas", () => {
  const counts = [18, 16, 9, 11, 0];
  const areas = OUTSIDE_AREAS.map((a, i) => ({
    key: a.key, title: a.title, summary: a.summary, count: counts[i], unit: (i === 4 ? "work" : "book") as "book" | "work",
  }));
  it("lists five areas linking to /chitzonim/<key> with counts", () => {
    const { container } = render(<ThresholdAreas areas={areas} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    const links = within(container).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(OUTSIDE_AREAS.map((a) => `/chitzonim/${a.key}`));
    links.forEach((l, i) => expect(l.textContent).toContain(areas[i].title));
    expect(container.textContent).toContain("18 books");
    expect(container.textContent).toContain("in preparation");
  });
  it("pluralises units", () => {
    const { container } = render(
      <ThresholdAreas areas={[
        { key: "deuterocanon", title: "A", summary: "s", count: 1, unit: "book" },
        { key: "described", title: "B", summary: "s", count: 1, unit: "work" },
        { key: "apostolic", title: "C", summary: "s", count: 18, unit: "work" },
      ]} />,
    );
    expect(container.textContent).toContain("1 book");
    expect(container.textContent).not.toContain("1 books");
    expect(container.textContent).toContain("1 work");
    expect(container.textContent).toContain("18 works");
  });
});

describe("CanonFilterControl", () => {
  it("is a checkbox reflecting the filter and toggles to all", async () => {
    const { CanonFilterControl } = await import("@/components/search/CanonFilterControl");
    const onChange = vi.fn();
    const { rerender } = render(<CanonFilterControl value="bible" onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: /Include outside books/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith("all");
    rerender(<CanonFilterControl value="all" onChange={onChange} />);
    expect((screen.getByRole("checkbox", { name: /Include outside books/ }) as HTMLInputElement).checked).toBe(true);
  });
});
