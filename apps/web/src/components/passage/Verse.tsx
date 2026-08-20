"use client";

import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useMemo } from "react";

import type { VerseText } from "@/lib/db/corpus";
import {
  buildSegments,
  decorationsKey,
  isApproximate,
  segmentClasses,
  type Decoration,
} from "@/lib/decorations/segments";
import type { VerseRange } from "@/lib/refs/verse-id";
import { annotationsForVerse, openAnnotationAtom, type Annotation } from "@/lib/store/annotations";
import type { PassageDensity, PassageLayers } from "./PassageRenderer";

/**
 * A single verse.
 *
 * This component is the subscription boundary. It reads `annotationsForVerse(verseId)` and
 * nothing else, so a highlight written anywhere in the app re-renders exactly the verses it
 * touches — across every mounted surface — and leaves the other 175 verses of Psalm 119
 * alone.
 */

interface VerseProps {
  verse: VerseText;
  density: PassageDensity;
  layers: PassageLayers;
  translationId: number;
  onNavigate?: (range: VerseRange) => void;
  /** This verse's slice of `PassageRenderer`'s `searchHighlights` map, if any. */
  searchHighlights?: readonly { start: number; end: number }[];
}

/** Turn stored annotations into renderable decorations for this verse's text. */
function toDecorations(
  annotations: readonly Annotation[],
  verse: VerseText,
  layers: PassageLayers,
  translationId: number
): Decoration[] {
  const out: Decoration[] = [];

  for (const annotation of annotations) {
    const isHighlight = annotation.kind === "highlight";
    if (isHighlight && !layers.highlights) continue;
    if (!isHighlight && !layers.notes) continue;

    // A whole-verse anchor, or an anchor whose offsets came from another translation and
    // could not be re-anchored, covers the entire verse rather than a wrong slice.
    const hasOffsets = annotation.startOffset !== null && annotation.endOffset !== null;
    const foreignTranslation = annotation.translationId !== translationId;
    const wholeVerse = !hasOffsets || foreignTranslation;

    // Multi-verse annotations only carry offsets at their two ends; interior verses are
    // covered completely.
    const isFirst = annotation.startVerseId === verse.verseId;
    const isLast = annotation.endVerseId === verse.verseId;

    const start = wholeVerse || !isFirst ? 0 : annotation.startOffset!;
    const end = wholeVerse || !isLast ? verse.text.length : annotation.endOffset!;

    out.push({
      id: annotation.annotationId,
      kind: isHighlight ? "highlight" : "note",
      start,
      end,
      data: {
        color: annotation.color,
        pending: annotation.pending,
        // Only a mark that HAD precise offsets and lost them is approximate. A deliberate
        // whole-verse anchor is exact — it means exactly the verse — and labelling it
        // "approximate" would cry wolf on the affordance that has to stay trustworthy.
        approximate: hasOffsets && foreignTranslation,
        translationId: annotation.translationId,
      },
    });
  }

  return out;
}

/**
 * The clickable marks that follow a verse's text: one per note, one per imprecise mark.
 *
 * Without these an annotation is write-only — a note's body has nowhere to be read and a
 * widened cross-translation highlight looks exactly like an exact one. Both are anchors into
 * the same detail panel, so a reader opens them the same way whichever they noticed first.
 */
interface VerseMark {
  id: string;
  isNote: boolean;
  approximate: boolean;
  pending: boolean;
}

function toMarks(decorations: readonly Decoration[]): VerseMark[] {
  const marks: VerseMark[] = [];
  for (const d of decorations) {
    const approximate = isApproximate(d);
    if (d.kind !== "note" && !approximate) continue;
    marks.push({
      id: d.id,
      isNote: d.kind === "note",
      approximate,
      pending: d.data?.pending === true,
    });
  }
  return marks;
}

/**
 * The whole explanation, in the accessible name.
 *
 * Not "approximate" and a tooltip. A reader who was not already told cannot deduce any of
 * this from the page — they marked a phrase, they are now looking at a different translation
 * of the verse, and the words they marked may not exist in it. AGENTS.md's rule that a gloss
 * lives in the accessible name and not only in a visual tooltip applies here for the same
 * reason it applies to the biblical vocabulary: the shorthand is only meaningful to someone
 * who already knows what it stands for.
 */
function markLabel(mark: VerseMark, verseNumber: number): string {
  const what = mark.isNote ? "Note" : "Highlight";
  if (mark.approximate) {
    return (
      `${what} on verse ${verseNumber}, placed approximately. It was made while reading a ` +
      `different translation, so its exact words could not be located here and it covers the ` +
      `whole verse instead. Open for detail.`
    );
  }
  return `Note on verse ${verseNumber}. Open to read, edit or delete it.`;
}

function VerseImpl({ verse, density, layers, translationId, searchHighlights }: VerseProps) {
  const annotations = useAtomValue(annotationsForVerse(verse.verseId));
  const openAnnotation = useSetAtom(openAnnotationAtom);

  const decorations = useMemo(() => {
    const out = toDecorations(annotations, verse, layers, translationId);
    // Search hits are not gated by a layer preference — they are the reason this verse is on
    // the page at all, on Derash's result list, so hiding them behind a toggle would be a
    // dead end for the one thing that surface shows.
    if (searchHighlights) {
      for (const [i, m] of searchHighlights.entries()) {
        out.push({ id: `search-${verse.verseId}-${i}`, kind: "search-hit", start: m.start, end: m.end });
      }
    }
    return out;
  }, [annotations, verse, layers, translationId, searchHighlights]);

  // Memoized on the decoration signature rather than the array identity, so an unrelated
  // re-render does not re-split the text.
  const key = decorationsKey(decorations);
  const segments = useMemo(
    () => buildSegments(verse.text, decorations),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` encodes `decorations`
    [verse.text, key]
  );

  const inline = density === "tooltip" || density === "preview";
  const Wrapper = inline ? "span" : "p";

  // Only where there is room to act on them. A tooltip is a glance — an interactive control
  // inside one is unreachable, because the pointer leaving the trigger dismisses it.
  const marks = useMemo(
    () => (inline ? [] : toMarks(decorations)),
    [inline, decorations],
  );

  return (
    <Wrapper
      className={clsx("verse", layers.heat && verse.heatBucket > 0 && "verse--heat")}
      data-verse-id={verse.verseId}
      data-heat={layers.heat && verse.heatBucket > 0 ? verse.heatBucket : undefined}
      id={inline ? undefined : `v${verse.verseId}`}
    >
      {layers.verseNumbers && (
        <span className="verse__number" aria-hidden="true">
          {verse.verse}
        </span>
      )}
      {/* Screen readers get the reference spoken once, rather than a bare number that
          interrupts the sentence. */}
      <span className="sr-only">{`Verse ${verse.verse}. `}</span>
      {segments.map((segment) => {
        const classes = segmentClasses(segment);
        if (classes.length === 0) {
          return <span key={segment.start}>{segment.text}</span>;
        }
        const highlight = segment.decorations.find((d) => d.kind === "highlight");
        return (
          <span
            key={segment.start}
            className={clsx(classes)}
            data-color={(highlight?.data?.color as string) ?? undefined}
            data-pending={highlight?.data?.pending ? "true" : undefined}
            data-approximate={segment.decorations.some(isApproximate) ? "true" : undefined}
          >
            {segment.text}
          </span>
        );
      })}
      {marks.length > 0 && (
        <span className="verse__marks">
          {marks.map((mark) => (
            <button
              key={mark.id}
              type="button"
              className="verse__mark"
              data-approximate={mark.approximate ? "true" : undefined}
              // An optimistic write has no server id yet, so editing or deleting it would
              // address a row that does not exist. It becomes live the moment the POST
              // resolves and `reconcileAnnotationId` swaps the id in.
              disabled={mark.pending}
              aria-label={markLabel(mark, verse.verse)}
              title={markLabel(mark, verse.verse)}
              onClick={() => openAnnotation(mark.id)}
            >
              <span aria-hidden="true">{mark.approximate ? "≈" : "*"}</span>
            </button>
          ))}
        </span>
      )}{" "}
    </Wrapper>
  );
}

export const Verse = memo(VerseImpl);
