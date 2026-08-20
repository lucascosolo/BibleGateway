// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { selectionToAnchor } from "./selection";

/**
 * Builds DOM matching the *actual* shape `Verse.tsx` renders for a decorated verse:
 *
 *   <p data-verse-id="...">
 *     <span class="verse__number" aria-hidden="true">16</span>
 *     <span class="sr-only">Verse 16. </span>
 *     <span class="deco-highlight" data-color="amber">For God so loved</span>
 *     <span> the world</span>
 *     " "                                          <- Verse.tsx's trailing `{" "}`
 *   </p>
 *
 * The offset math must be correct against this shape, not against `verse.text` laid out as
 * one flat text node — that's the whole point of the test.
 */
function buildVerse(verseId: number, verseNum: number, segments: string[]): HTMLElement {
  const p = document.createElement("p");
  p.dataset.verseId = String(verseId);

  const num = document.createElement("span");
  num.className = "verse__number";
  num.setAttribute("aria-hidden", "true");
  num.textContent = String(verseNum);
  p.appendChild(num);

  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = `Verse ${verseNum}. `;
  p.appendChild(sr);

  for (const [i, text] of segments.entries()) {
    const span = document.createElement("span");
    if (i === 0) {
      span.className = "deco-highlight";
      span.dataset.color = "amber";
    }
    span.textContent = text;
    p.appendChild(span);
  }

  p.appendChild(document.createTextNode(" ")); // Verse.tsx's trailing `{" "}`
  return p;
}

function textNodeIn(el: Element, matchIndex = 0): Text {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  let i = 0;
  while ((n = walker.nextNode())) {
    if (i === matchIndex) return n as Text;
    i++;
  }
  throw new Error("text node not found");
}

function select(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.addRange(range);
  return selection;
}

describe("selectionToAnchor", () => {
  it("returns null for a collapsed selection", () => {
    const verse = buildVerse(43003016, 16, ["For God so loved", " the world"]);
    document.body.replaceChildren(verse);
    const textNode = textNodeIn(verse, 2); // "For God so loved"
    const selection = select(textNode, 3, textNode, 3);
    expect(selectionToAnchor(selection, 1)).toBeNull();
  });

  it("returns null when there is no selection at all", () => {
    expect(selectionToAnchor(null, 1)).toBeNull();
    const empty = window.getSelection()!;
    empty.removeAllRanges();
    expect(selectionToAnchor(empty, 1)).toBeNull();
  });

  it("computes verse-relative offsets within a single decorated span", () => {
    // "For God so loved" (17 chars) is its own <span> (a highlight already applied);
    // select "God" inside it: offsets 4-7 of the full verse text.
    const verse = buildVerse(43003016, 16, ["For God so loved", " the world"]);
    document.body.replaceChildren(verse);
    const seg1 = textNodeIn(verse, 2); // "For God so loved"
    const selection = select(seg1, 4, seg1, 7);

    const anchor = selectionToAnchor(selection, 1);
    expect(anchor).not.toBeNull();
    expect(anchor!.startVerseId).toBe(43003016);
    expect(anchor!.endVerseId).toBe(43003016);
    expect(anchor!.startOffset).toBe(4);
    expect(anchor!.endOffset).toBe(7);
    expect(anchor!.quotedText).toBe("God");
  });

  it("computes offsets when the selection crosses a segment boundary", () => {
    // verse.text = "For God so loved the world" (26 chars), split into two decoration spans
    // at index 16 ("For God so loved" is 16 chars). Select "loved the", straddling both.
    const verse = buildVerse(43003016, 16, ["For God so loved", " the world"]);
    document.body.replaceChildren(verse);
    const seg1 = textNodeIn(verse, 2); // "For God so loved"
    const seg2 = textNodeIn(verse, 3); // " the world"

    // "loved" begins at index 11 of seg1; " the" ends 4 chars into seg2.
    const selection = select(seg1, 11, seg2, 4);

    const anchor = selectionToAnchor(selection, 1);
    expect(anchor!.startOffset).toBe(11);
    expect(anchor!.endOffset).toBe(16 + 4);
    expect(anchor!.quotedText).toBe("loved the");
  });

  it("ignores the trailing inter-verse space and the sr-only / verse-number text", () => {
    const verse = buildVerse(43003016, 16, ["For God so loved", " the world"]);
    document.body.replaceChildren(verse);
    const trailingSpace = textNodeIn(verse, 4); // the bare " " Verse.tsx appends
    const seg2 = textNodeIn(verse, 3); // " the world"

    // Select from inside the last word through into the trailing space that follows the verse.
    const selection = select(seg2, 5, trailingSpace, 1);
    const anchor = selectionToAnchor(selection, 1);
    // "world" ends at verse-relative offset 26 (full text length); the trailing space must
    // not extend the offset past that.
    expect(anchor!.endOffset).toBe(26);

    // Selecting starting inside the verse-number span resolves to the very start of the verse
    // text (offset 0), not some negative or NaN value.
    const numberText = textNodeIn(verse, 0); // "16"
    const selection2 = select(numberText, 0, seg2, 4);
    const anchor2 = selectionToAnchor(selection2, 1);
    expect(anchor2!.startOffset).toBe(0);
  });

  it("handles a selection spanning two verses", () => {
    const v1 = buildVerse(43003015, 15, ["For God so loved the world"]);
    const v2 = buildVerse(43003016, 16, ["that he gave", " his only Son"]);
    const container = document.createElement("div");
    container.append(v1, v2);
    document.body.replaceChildren(container);

    const v1Text = textNodeIn(v1, 2); // whole verse 15 text
    const v2Seg2 = textNodeIn(v2, 3); // " his only Son"

    const selection = select(v1Text, 8, v2Seg2, 5); // "God so loved the world" ... "that he gave his"

    const anchor = selectionToAnchor(selection, 1);
    expect(anchor!.startVerseId).toBe(43003015);
    expect(anchor!.endVerseId).toBe(43003016);
    expect(anchor!.startOffset).toBe(8);
    expect(anchor!.endOffset).toBe(12 + 5); // "that he gave" (12) + 5 chars into " his only Son"
  });

  it("is direction-independent: a backwards drag yields the same anchor as a forwards one", () => {
    const verse = buildVerse(43003016, 16, ["For God so loved", " the world"]);
    document.body.replaceChildren(verse);
    const seg1 = textNodeIn(verse, 2);
    const seg2 = textNodeIn(verse, 3);

    const forward = select(seg1, 4, seg2, 4);
    const forwardAnchor = selectionToAnchor(forward, 1);

    // Simulate dragging from the end back to the start: base (anchor) at the later point,
    // extent (focus) at the earlier point. `Selection.getRangeAt(0)` still normalizes to
    // document order, so the resulting anchor must match the forward selection exactly.
    const backward = window.getSelection()!;
    backward.removeAllRanges();
    backward.setBaseAndExtent(seg2, 4, seg1, 4);
    const backwardAnchor = selectionToAnchor(backward, 1);

    expect(backwardAnchor).toEqual(forwardAnchor);
  });

  it("returns null when the selection touches no verse element", () => {
    const outside = document.createElement("p");
    outside.textContent = "not a verse";
    document.body.replaceChildren(outside);
    const textNode = outside.firstChild as Text;
    const selection = select(textNode, 0, textNode, 3);
    expect(selectionToAnchor(selection, 1)).toBeNull();
  });

  it("handles a selection that starts in whitespace between words", () => {
    const verse = buildVerse(43003016, 16, ["For God so loved", " the world"]);
    document.body.replaceChildren(verse);
    const seg2 = textNodeIn(verse, 3); // " the world" — starts with a space
    const selection = select(seg2, 0, seg2, 4); // " the" — leading space included
    const anchor = selectionToAnchor(selection, 1);
    expect(anchor!.startOffset).toBe(16); // right at the segment boundary, on the space
    expect(anchor!.quotedText).toBe(" the");
  });
});
