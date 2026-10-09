import { describe, expect, it } from "vitest";
import { parseFootnotes } from "./footnotes";
describe("parseFootnotes", () => {
  it("extracts the note text and caller from a USFX f span", () => {
    const xml = `In the beginning<f caller="+"><fr>1:1 </fr><ft>Or <fq>When God began to create</fq></ft></f> God created`;
    expect(parseFootnotes(xml)).toEqual([{ caller: "+", kind: "footnote", text: "1:1 Or When God began to create" }]);
  });
  it("keeps cross-reference notes apart from footnotes", () => {
    const xml = `text<x caller="-"><xo>1:1 </xo><xt>John 1:1</xt></x>`;
    expect(parseFootnotes(xml)[0].kind).toBe("crossref");
  });
});
