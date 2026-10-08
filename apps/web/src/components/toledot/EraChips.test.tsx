import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Era } from "@/lib/db/timeline";
import { EraChips } from "./EraChips";

afterEach(cleanup);

const eras: Era[] = [
  { id: "monarchy", name: "Divided monarchy", start: -930, end: -586, summary: "", citations: [] },
  { id: "exile", name: "Exile", start: -586, end: -539, summary: "", citations: [] },
];

describe("EraChips", () => {
  it("renders All eras plus a link per era with ?era= hrefs, inside a navigation landmark", () => {
    render(<EraChips eras={eras} selected={null} />);
    const nav = screen.getByRole("navigation", { name: "Era" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute("href")).toBe("/toledot");
    expect(links[1].getAttribute("href")).toBe("/toledot?era=monarchy");
    expect(links[2].getAttribute("href")).toBe("/toledot?era=exile");
  });

  it("marks only the selected era as current", () => {
    render(<EraChips eras={eras} selected="exile" />);
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Exile");
  });

  it("marks All eras current when nothing is selected", () => {
    render(<EraChips eras={eras} selected={null} />);
    expect(screen.getByRole("link", { name: /All eras/ }).getAttribute("aria-current")).toBe("true");
  });

  it("prints each era's span beside its name", () => {
    render(<EraChips eras={eras} selected={null} />);
    expect(screen.getByRole("link", { name: /Divided monarchy/ }).textContent).toContain("930–586 BCE");
  });
});
