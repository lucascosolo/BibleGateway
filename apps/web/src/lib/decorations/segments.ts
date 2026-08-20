/**
 * The decoration pipeline.
 *
 * A verse can carry several overlapping marks at once: a yellow highlight, a note anchor, a
 * textual-variant span, and a source-criticism assignment — all covering *different, partly
 * overlapping* character ranges. Rendering that as nested elements does not work: HTML
 * requires a tree, and partially-overlapping ranges are not a tree.
 *
 * The fix is the approach CodeMirror uses. Rather than nesting, flatten:
 *
 *   1. Collect every decoration touching the verse.
 *   2. Gather all their start/end offsets into a sorted set of boundaries.
 *   3. Walk consecutive boundary pairs, emitting one segment per interval, each carrying the
 *      SET of decorations active across it.
 *
 * The result is a flat list of spans with composed classes — no nesting, correct for any
 * overlap, and O(n log n) in the number of decorations.
 *
 *   text:        "For God so loved the world"
 *   highlight:    ......[==========]........
 *   variant:      ............[========]....
 *   segments:    |......|.....|....|...|....|
 *                 none  hl   hl+var var  none
 */

export type DecorationKind =
  | "highlight"
  | "note"
  | "crossref"
  | "variant"
  | "source"
  | "search-hit";

export interface Decoration {
  /** Stable identity — an annotation UUID, a variant id, etc. */
  id: string;
  kind: DecorationKind;
  /** Character offset into the verse text, inclusive. */
  start: number;
  /** Character offset into the verse text, exclusive. */
  end: number;
  /** Kind-specific payload: highlight color token, note id, source code, etc. */
  data?: Record<string, unknown>;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  /** Every decoration covering this segment, in the order they were supplied. */
  decorations: Decoration[];
}

/**
 * Split a verse's text into flat, non-overlapping segments.
 *
 * Decorations are clamped to the text bounds rather than rejected — an annotation made
 * against a different translation can legitimately extend past the end of this one, and
 * dropping it silently would lose the user's highlight. Zero-width and reversed ranges are
 * discarded, since they cannot be rendered meaningfully.
 */
export function buildSegments(text: string, decorations: readonly Decoration[]): Segment[] {
  if (text.length === 0) return [];

  const usable = decorations
    .map((d) => ({
      ...d,
      start: Math.max(0, Math.min(d.start, text.length)),
      end: Math.max(0, Math.min(d.end, text.length)),
    }))
    .filter((d) => d.end > d.start);

  if (usable.length === 0) {
    return [{ start: 0, end: text.length, text, decorations: [] }];
  }

  // Every point where the active decoration set can change.
  const boundaries = new Set<number>([0, text.length]);
  for (const d of usable) {
    boundaries.add(d.start);
    boundaries.add(d.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    segments.push({
      start,
      end,
      text: text.slice(start, end),
      // A decoration covers this segment if it spans the whole interval. Because the
      // boundaries include every decoration edge, a decoration either covers a segment
      // entirely or not at all — no partial cases exist here.
      decorations: usable.filter((d) => d.start <= start && d.end >= end),
    });
  }

  return segments;
}

/**
 * Deterministic serialization of a decoration's payload.
 *
 * Sorted by key so two payloads with the same contents in a different insertion order
 * produce the same string — object key order is stable in practice but not something a memo
 * key should depend on.
 */
function dataKey(data: Decoration["data"]): string {
  if (!data) return "";
  return Object.keys(data)
    .sort()
    .map((k) => `${k}=${String(data[k])}`)
    .join(",");
}

/**
 * A stable key for memoizing a verse's rendered output.
 *
 * Rendering is pure in (text, decorations), so this lets a verse skip re-rendering when an
 * unrelated verse changes — which matters when a chapter of 176 verses is mounted and one
 * highlight lands.
 *
 * `data` is part of the key, not just the anchor. It looks like inert payload but it reaches
 * the DOM: the colour token, the pending flag and the approximate flag all become attributes
 * and classes on the emitted spans. Keying on `(kind, id, offsets)` alone meant the two
 * mutations that change *only* the payload — recolouring a highlight, and an optimistic write
 * being confirmed by the server — produced an identical key, so the memo held and the screen
 * never changed. The anchor is what the segments are cut on; the payload is what they render
 * as, and both belong here.
 */
export function decorationsKey(decorations: readonly Decoration[]): string {
  if (decorations.length === 0) return "";
  return decorations
    .map((d) => `${d.kind}:${d.id}:${d.start}-${d.end}:${dataKey(d.data)}`)
    .sort()
    .join("|");
}

/**
 * True when a decoration could not be anchored precisely in the translation being rendered.
 *
 * Set by `Verse.toDecorations` when an annotation's character offsets came from a different
 * translation and had to be widened to the whole verse (ARCHITECTURE §3.3, degradation step
 * 3). It is deliberately a property of the decoration rather than of the segment, so every
 * consumer — classes, markers, the accessible description — reads the same one flag.
 */
export function isApproximate(decoration: Decoration): boolean {
  return decoration.data?.approximate === true;
}

/** Precedence when several decorations want to set the same visual property. */
const KIND_PRIORITY: Record<DecorationKind, number> = {
  "search-hit": 60,
  highlight: 50,
  note: 40,
  variant: 30,
  crossref: 20,
  source: 10,
};

/** The winning decoration for background treatment on a segment, or null. */
export function dominantDecoration(segment: Segment): Decoration | null {
  if (segment.decorations.length === 0) return null;
  return segment.decorations.reduce((best, d) =>
    KIND_PRIORITY[d.kind] > KIND_PRIORITY[best.kind] ? d : best
  );
}

/** Class names for a segment: one per active decoration kind, plus the dominant one. */
export function segmentClasses(segment: Segment): string[] {
  if (segment.decorations.length === 0) return [];
  const kinds = new Set(segment.decorations.map((d) => d.kind));
  const classes = [...kinds].map((k) => `deco-${k}`);
  const dominant = dominantDecoration(segment);
  if (dominant) classes.push(`deco-dominant-${dominant.kind}`);
  // An imprecise mark must not be drawn the same as an exact one. Rendering a widened
  // cross-translation highlight as a solid block claims a precision the data does not have,
  // which is the one thing ARCHITECTURE §3.3 says never to do: degrading is honest, degrading
  // silently is not.
  if (segment.decorations.some(isApproximate)) classes.push("deco-approximate");
  return classes;
}
