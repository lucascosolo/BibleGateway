/**
 * Selection -> anchor.
 *
 * Reads the DOM `Selection`, walks up to the nearest `[data-verse-id]` boundary on each end,
 * and converts DOM offsets into VERSE-RELATIVE CHARACTER OFFSETS — the same coordinate space
 * `annotation.startOffset`/`endOffset` live in (ARCHITECTURE §3.3), and the same space
 * `buildSegments` (lib/decorations/segments.ts) slices on.
 *
 * This must never use raw DOM offsets directly. A verse's rendered DOM is NOT flat text: it
 * has a verse-number span, a screen-reader-only "Verse N." span, zero or more decorated
 * `<span>` segments, and a trailing whitespace text node `Verse.tsx` appends between verses.
 * A `Range` boundary can land in any of those. The algorithm below walks every text node in
 * document order, classifies each as "content" (part of `verse.text`) or "not content"
 * (verse number / sr-only / inter-verse spacing), and accumulates offsets only over content
 * nodes — so the resulting number is exactly the index `buildSegments` and the annotation
 * table expect, no matter how many decoration spans currently split the verse.
 */

export interface SelectionAnchor {
  startVerseId: number;
  startOffset: number;
  endVerseId: number;
  endOffset: number;
  /** Verbatim selected text, for display and cross-translation re-anchoring (§3.3). */
  quotedText: string;
  translationId: number;
}

interface TextNodeInfo {
  node: Text;
  included: boolean;
  /** Verse-relative offset immediately before this node. */
  offsetBefore: number;
  /** Verse-relative offset immediately after this node's contribution (== offsetBefore when excluded). */
  end: number;
}

/**
 * Convert the current DOM selection into an annotation anchor.
 *
 * Returns `null` for a collapsed selection, or a selection that touches no `[data-verse-id]`
 * element on either end. Works regardless of drag direction: `Selection.getRangeAt(0)` always
 * returns a `Range` whose start precedes its end in document order, even when the user dragged
 * from bottom to top (a "backwards" selection) — the browser normalizes this for us, so there
 * is no separate backwards-selection code path here.
 */
export function selectionToAnchor(
  selection: Selection | null,
  translationId: number
): SelectionAnchor | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;

  const startEl = closestVerseEl(range.startContainer);
  const endEl = closestVerseEl(range.endContainer);
  if (!startEl || !endEl) return null;

  const startVerseId = Number(startEl.dataset.verseId);
  const endVerseId = Number(endEl.dataset.verseId);
  if (!Number.isFinite(startVerseId) || !Number.isFinite(endVerseId)) return null;

  const startInfos = collectTextNodes(startEl);
  const startOffset = resolveOffset(range.startContainer, range.startOffset, startInfos);

  const endInfos = startEl === endEl ? startInfos : collectTextNodes(endEl);
  const endOffset = resolveOffset(range.endContainer, range.endOffset, endInfos);

  const quotedText = range.toString();

  // `Range` guarantees document order, and verses render in document order, so
  // `startVerseId <= endVerseId` already holds in practice. Guard it anyway rather than trust
  // an invariant a future rendering change could quietly break.
  if (startVerseId > endVerseId) {
    return {
      startVerseId: endVerseId,
      startOffset: endOffset,
      endVerseId: startVerseId,
      endOffset: startOffset,
      quotedText,
      translationId,
    };
  }

  return { startVerseId, startOffset, endVerseId, endOffset, quotedText, translationId };
}

function closestVerseEl(node: Node): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return (el?.closest("[data-verse-id]") as HTMLElement | null) ?? null;
}

/** A text node counts as verse content unless it (or an ancestor up to the verse root) is
 * the verse-number span, the screen-reader-only reference span, or a bare text node that is
 * a direct child of the verse root (the trailing `{" "}` `Verse.tsx` renders between verses). */
function isContentTextNode(text: Text, root: Element): boolean {
  if (text.parentNode === root) return false;
  let el: Element | null = text.parentElement;
  while (el && el !== root) {
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.classList.contains("sr-only")) return false;
    if (el.classList.contains("verse__number")) return false;
    el = el.parentElement;
  }
  return true;
}

function collectTextNodes(root: Element): TextNodeInfo[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const infos: TextNodeInfo[] = [];
  let running = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n as Text;
    const included = isContentTextNode(text, root);
    const offsetBefore = running;
    if (included) running += text.data.length;
    infos.push({ node: text, included, offsetBefore, end: running });
  }
  return infos;
}

function firstTextIn(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  return (walker.nextNode() as Text | null) ?? null;
}

function lastTextIn(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let cur: Node | null;
  while ((cur = walker.nextNode())) last = cur as Text;
  return last;
}

/**
 * Resolve a `Range` boundary point `(container, offset)` to a verse-relative character
 * offset, using the content/not-content classification already computed in `infos`.
 *
 * `container` is either a text node (offset is a character index into it) or an element
 * (offset is a *child index* — the boundary sits between `childNodes[offset - 1]` and
 * `childNodes[offset]`, per the DOM Range spec). Both cases are handled generically so this
 * works no matter how many decoration spans currently split the verse.
 */
function resolveOffset(container: Node, offset: number, infos: TextNodeInfo[]): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const info = infos.find((i) => i.node === container);
    if (!info) return 0;
    if (!info.included) return info.offsetBefore;
    return info.offsetBefore + clamp(offset, 0, (container as Text).data.length);
  }

  const children = container.childNodes;

  // Boundary sits right before childNodes[offset]: find that node's first text descendant
  // and use its start. Handles both content nodes and "excluded" ones (verse-number/sr-only
  // resolve to 0, the trailing space resolves to the full verse length) uniformly, because
  // `offsetBefore` already encodes that.
  if (offset < children.length) {
    const t = firstTextIn(children[offset]);
    if (t) {
      const info = infos.find((i) => i.node === t);
      if (info) return info.offsetBefore;
    }
  }

  // Boundary is at/after the end of `container`'s children (or nothing usable was found
  // forward): walk backwards for the last text descendant before this point and use its end.
  for (let i = Math.min(offset, children.length) - 1; i >= 0; i--) {
    const t = lastTextIn(children[i]);
    if (t) {
      const info = infos.find((i2) => i2.node === t);
      if (info) return info.end;
    }
  }

  return 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}
