import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CatalogueIndex, type CatalogueItem } from "./CatalogueIndex";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

const eras = [
  { id: "early", name: "Early era", start: -1000, end: -900 },
  { id: "late", name: "Late era", start: -800, end: -700 },
];

const item = (id: string, title: string, year: number, axis: string, book: number | null): CatalogueItem => ({
  id, href: `/toledot/events/${id}`, title, when: null, year, book, gist: `${title} gist.`, searchText: title,
  facets: { axis }, marks: [],
});

const items = [
  item("a", "Alpha rises", -750, "narrative", 2),
  item("b", "Beta written", -950, "composition", 1),
  item("c", "Gamma falls", -720, "narrative", null),
];

const chips = [{ key: "axis", label: "Kind of date", values: [{ value: "narrative", label: "what happened" }, { value: "composition", label: "when written" }] }];

const setup = () =>
  render(<CatalogueIndex kind="events" eras={eras} books={[[1, "Genesis"], [2, "Exodus"]]} items={items} chips={chips} countNoun="events" />);

describe("CatalogueIndex", () => {
  it("groups by era with counts", () => {
    const { container } = setup();
    expect(container.querySelectorAll("details")).toHaveLength(2);
    expect(screen.getByText("2 events")).toBeTruthy();
    expect(screen.getByText("1 events")).toBeTruthy();
    expect(screen.getByText("3 events", { selector: ".toledot-filter__count" })).toBeTruthy();
  });

  it("a query hides a section and updates the count", () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText("Filter events"), { target: { value: "beta" } });
    expect(container.querySelectorAll("details")).toHaveLength(1);
    expect(screen.getByText("1 of 3 events")).toBeTruthy();
    expect(window.location.hash).toBe("#q=beta");
  });

  it("shows an empty message when nothing matches", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Filter events"), { target: { value: "zzz" } });
    expect(screen.getByText(/No events match/)).toBeTruthy();
  });

  it("By date renders one flat list in year order", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "By date" }));
    expect(container.querySelectorAll("details")).toHaveLength(0);
    const titles = [...container.querySelectorAll(".toledot-row__title")].map((a) => a.textContent);
    expect(titles).toEqual(["Beta written", "Alpha rises", "Gamma falls"]);
  });

  it("By book sections in canonical order with a trailing 'No verse yet'", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "By book" }));
    const names = [...container.querySelectorAll(".toledot-era__name")].map((n) => n.textContent);
    expect(names).toEqual(["Genesis", "Exodus", "No verse yet"]);
  });

  it("a facet narrows the list", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "when written" }));
    expect(screen.getByText("1 of 3 events")).toBeTruthy();
    expect(screen.queryByText("Alpha rises")).toBeNull();
  });
});
