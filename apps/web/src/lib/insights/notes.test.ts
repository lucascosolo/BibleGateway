import { describe, expect, it } from "vitest";
import { INSIGHT_NOTES } from "./notes";
describe("insight notes", () => {
  it("every note names its source", () => {
    for (const n of INSIGHT_NOTES) expect(n.source, n.id).toMatch(/\S/);
  });
  it("the Genesis 2:21 note presents rib and side as competing readings", () => {
    const n = INSIGHT_NOTES.find((x) => x.id === "gen2-21-tsela")!;
    expect(n.text).toMatch(/rib/);
    expect(n.text).not.toMatch(/split the human in half|not a translation/);
    expect(n.alternatives).toMatch(/Eichler/);
  });
  it("no note claims a word 'literally' means one thing", () => {
    for (const n of INSIGHT_NOTES) expect(n.text, n.id).not.toMatch(/literally means/);
  });
});
