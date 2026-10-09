// Omissions are grouped by kind, so a Septuagint renumbering is never presented as a
// New Testament verse that some Bibles leave out.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CorpusDoorways } from "./CorpusDoorways";

type Kind = "critical-text" | "versification" | "coverage" | "unexplained";
interface Row {
  verseId: number;
  osisRef: string;
  kind: Kind;
  reason: string;
  omittedBy: string[];
  printedBy: { code: string; name: string } | undefined;
}

const KJV = { code: "KJV", name: "King James Version" };
const refs = new Map<number, string>([
  [16004006, "Nehemiah 4:6"],
  [40017021, "Matthew 17:21"],
]);

function mount(omissions: Row[]) {
  render(
    <CorpusDoorways translationId={1} topVerses={[]} omissions={omissions} references={refs} />,
  );
}

afterEach(cleanup);

describe("CorpusDoorways omissions", () => {
  it("keeps New Testament and Septuagint rows in their own sections", () => {
    mount([
      {
        verseId: 16004006, osisRef: "Neh.4.6", kind: "versification",
        reason: "Different Septuagint numbering", omittedBy: ["LXX"], printedBy: KJV,
      },
      {
        verseId: 40017021, osisRef: "Matt.17.21", kind: "critical-text",
        reason: "Absent from the oldest manuscripts", omittedBy: ["BSB"], printedBy: KJV,
      },
    ]);

    expect(
      screen.getByRole("heading", { level: 3, name: "1 New Testament verse that some Bibles leave out" }),
    ).toBeTruthy();
    const nt = screen.getByRole("region", { name: "Textual criticism: omitted verses" });
    expect(within(nt).getByRole("link", { name: "Matthew 17:21" })).toBeTruthy();
    expect(within(nt).queryByText("Nehemiah 4:6")).toBeNull();

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "1 verse with a different numbering in Brenton's Septuagint",
      }),
    ).toBeTruthy();
    const lxx = screen.getByRole("region", { name: "Septuagint numbering differences" });
    expect(within(lxx).getByRole("link", { name: "Nehemiah 4:6" })).toBeTruthy();

    expect(screen.queryByRole("region", { name: "Unexplained gaps" })).toBeNull();
  });

  it("renders only the unexplained section when that is the only kind", () => {
    mount([
      {
        verseId: 40017021, osisRef: "Matt.17.21", kind: "unexplained",
        reason: "No reason recorded", omittedBy: ["BSB"], printedBy: KJV,
      },
    ]);

    expect(
      screen.getByRole("heading", { level: 3, name: "Gaps the source data does not explain" }),
    ).toBeTruthy();
    expect(screen.queryByText(/New Testament/)).toBeNull();
  });
});
