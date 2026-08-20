"use client";

import { atom } from "jotai";
import { atomFamily } from "jotai/utils";

import type { VerseId, VerseRange } from "@/lib/refs/verse-id";

/**
 * Annotation state, keyed by verse.
 *
 * This is the load-bearing architectural decision in Jot. The requirement is that
 * highlighting a verse in a hover tooltip instantly re-renders that verse in the side panel,
 * the timeline modal and the full reader — all of which may be mounted at once.
 *
 * A single global store makes that expensive: every write notifies every subscriber, so with
 * Psalm 119 open (176 verses) plus a panel plus a tooltip you either re-render the world or
 * you hand-write selectors until it is unmaintainable.
 *
 * An atom per verse maps exactly onto the domain instead. Every <Verse> anywhere in the tree
 * subscribes to `annotationsForVerse(43003016)`. Writing a highlight on John 3:16 re-renders
 * precisely the components displaying John 3:16 — however many surfaces they span — and
 * nothing else.
 *
 * The "universal persistence" requirement therefore is not a feature anyone maintains. It is
 * a property of the state topology: atoms are keyed by verse_id, and so is every view.
 */

export type AnnotationKind = "highlight" | "note" | "bookmark";

export interface Annotation {
  annotationId: string;
  kind: AnnotationKind;

  /** Anchor. `startOffset`/`endOffset` null means the whole verse. */
  startVerseId: VerseId;
  endVerseId: VerseId;
  startOffset: number | null;
  endOffset: number | null;
  /** Offsets are only valid within this translation; see re-anchoring in ARCHITECTURE §3.3. */
  translationId: number;
  /** Verbatim selected text — used to re-anchor when the reader switches translation. */
  quotedText: string | null;

  color: string | null;
  body: string | null;
  tags: string[];

  updatedAt: string;
  /** True while an optimistic write is still in flight. */
  pending?: boolean;
}

/**
 * One atom per verse. `atomFamily` memoizes by verse id, so two components asking for the
 * same verse get the same atom and therefore the same subscription.
 */
export const annotationsForVerse = atomFamily((_verseId: VerseId) => atom<Annotation[]>([]));

/**
 * Index of every annotation currently loaded, by id.
 *
 * A multi-verse annotation appears in several verse atoms; this is the single record, so an
 * edit or delete can find every verse it touches without scanning.
 */
export const annotationIndex = atom<Map<string, Annotation>>(new Map());

/**
 * The annotation whose detail panel is open, or null.
 *
 * Global rather than local to a verse because only one panel may be open at a time and the
 * verse that opened it is not necessarily the verse that owns it — a multi-verse note is
 * reachable from any verse it covers. Keeping the open id here also means the panel mounts
 * once per surface instead of once per verse, so a 176-verse chapter does not carry 176
 * dormant dialogs.
 */
export const openAnnotationAtom = atom<string | null>(null);

/** Verse ids an annotation spans. Sparse ids mean this is a bound, not a contiguous walk. */
function spannedVerses(annotation: Annotation, existing: readonly VerseId[]): VerseId[] {
  if (annotation.startVerseId === annotation.endVerseId) return [annotation.startVerseId];
  return existing.filter(
    (id) => id >= annotation.startVerseId && id <= annotation.endVerseId
  );
}

/**
 * Write an annotation into every verse atom it covers.
 *
 * `existingVerseIds` must be the real verses in range — the id space is sparse, so walking
 * start..end numerically would invent verses that do not exist.
 */
export const upsertAnnotation = atom(
  null,
  (get, set, annotation: Annotation, existingVerseIds: readonly VerseId[]) => {
    const index = new Map(get(annotationIndex));
    const previous = index.get(annotation.annotationId);
    index.set(annotation.annotationId, annotation);
    set(annotationIndex, index);

    // If the anchor moved, clear it out of verses it no longer covers.
    if (previous) {
      for (const verseId of spannedVerses(previous, existingVerseIds)) {
        set(annotationsForVerse(verseId), (current) =>
          current.filter((a) => a.annotationId !== annotation.annotationId)
        );
      }
    }

    for (const verseId of spannedVerses(annotation, existingVerseIds)) {
      set(annotationsForVerse(verseId), (current) => [
        ...current.filter((a) => a.annotationId !== annotation.annotationId),
        annotation,
      ]);
    }
  }
);

/**
 * Remove an annotation from the index and every verse atom it covered.
 *
 * Returns the record it removed, or null if there was none. That return value is the rollback:
 * an optimistic delete whose DELETE then fails has to put back exactly what it took, and the
 * caller has only an id. Reading the index separately before removing would work too, but it
 * would be a second read of state this writer already holds — and a caller that forgot it would
 * fail silently, which is the bug this exists to prevent.
 */
export const removeAnnotation = atom(
  null,
  (get, set, annotationId: string, existingVerseIds: readonly VerseId[]): Annotation | null => {
    const index = new Map(get(annotationIndex));
    const annotation = index.get(annotationId);
    if (!annotation) return null;
    index.delete(annotationId);
    set(annotationIndex, index);

    for (const verseId of spannedVerses(annotation, existingVerseIds)) {
      set(annotationsForVerse(verseId), (current) =>
        current.filter((a) => a.annotationId !== annotationId)
      );
    }
    return annotation;
  }
);

/**
 * Swap an optimistic write for its server-confirmed record — ARCHITECTURE §4.4 step 6.
 *
 * `optimisticId` is the temporary id `useAnnotationMutations` wrote in `onMutate`;
 * `serverAnnotation` is the real row `POST /api/annotations` returned. Both the index and
 * every verse atom the annotation spans are updated in one pass so no view ever renders the
 * optimistic id after this resolves.
 */
export const reconcileAnnotationId = atom(
  null,
  (
    get,
    set,
    optimisticId: string,
    serverAnnotation: Annotation,
    existingVerseIds: readonly VerseId[]
  ) => {
    const index = new Map(get(annotationIndex));
    const optimistic = index.get(optimisticId);
    index.delete(optimisticId);
    index.set(serverAnnotation.annotationId, serverAnnotation);
    set(annotationIndex, index);

    // The optimistic write and the server row should span the same verses, but fall back to
    // the server row's span if the optimistic entry is already gone for some reason.
    const verseIds = spannedVerses(optimistic ?? serverAnnotation, existingVerseIds);
    for (const verseId of verseIds) {
      set(annotationsForVerse(verseId), (current) => [
        ...current.filter(
          (a) => a.annotationId !== optimisticId && a.annotationId !== serverAnnotation.annotationId
        ),
        serverAnnotation,
      ]);
    }
  }
);

/** Replace the annotations for a loaded range — used when a fetch resolves. */
export const hydrateRange = atom(
  null,
  (
    get,
    set,
    annotations: readonly Annotation[],
    range: VerseRange,
    existingVerseIds: readonly VerseId[]
  ) => {
    const inRange = existingVerseIds.filter((id) => id >= range.start && id <= range.end);

    // Clear the range first so deletions made elsewhere are reflected.
    for (const verseId of inRange) {
      set(annotationsForVerse(verseId), (current) => (current.length === 0 ? current : []));
    }

    const index = new Map(get(annotationIndex));
    for (const annotation of annotations) {
      index.set(annotation.annotationId, annotation);
      for (const verseId of spannedVerses(annotation, existingVerseIds)) {
        set(annotationsForVerse(verseId), (current) => [...current, annotation]);
      }
    }
    set(annotationIndex, index);
  }
);
