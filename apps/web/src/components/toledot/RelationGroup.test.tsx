import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EventAttestation, Relation } from "@/lib/db/timeline";
import { RelationGroup } from "./RelationGroup";

afterEach(cleanup);

const att = (relation: Relation, artifactId: string, artifactName: string): EventAttestation => ({
  id: `e@${artifactId}`, artifactId, artifactName, artifactKind: "inscription", relation, note: "", citations: [],
});

describe("RelationGroup", () => {
  it("orders groups by the fixed relation order and omits empty ones", () => {
    render(
      <RelationGroup
        attestations={[
          att("in-tension", "a5", "Five"),
          att("silent", "a4", "Four"),
          att("corroborates", "a1", "One"),
          att("consistent", "a3", "Three"),
        ]}
      />,
    );
    const headings = screen.getAllByRole("heading").map((h) => h.textContent ?? "");
    const order = ["corroborates", "consistent", "silent", "tension"];
    const positions = order.map((word) => headings.findIndex((t) => t.toLowerCase().includes(word)));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(headings).toHaveLength(4);
    expect(headings.some((t) => /partially/i.test(t))).toBe(false);
  });

  it("links each item to its artifact page by name", () => {
    render(<RelationGroup attestations={[att("corroborates", "taylor-prism", "Taylor Prism")]} />);
    const link = screen.getByRole("link", { name: /Taylor Prism/ });
    expect(link.getAttribute("href")).toBe("/toledot/artifacts/taylor-prism");
  });

  it("places an item under its own relation heading", () => {
    render(<RelationGroup attestations={[att("silent", "x", "Xname"), att("corroborates", "y", "Yname")]} />);
    const silentHeading = screen.getByRole("heading", { name: /silent/i });
    const section = silentHeading.closest("section, div, li")!;
    expect(within(section as HTMLElement).queryByText(/Xname/)).toBeTruthy();
    expect(within(section as HTMLElement).queryByText(/Yname/)).toBeNull();
  });
});
