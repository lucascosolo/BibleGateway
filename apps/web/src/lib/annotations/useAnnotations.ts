"use client";

import { useCallback, useState } from "react";
import { useSetAtom } from "jotai";

import type { VerseId } from "@/lib/refs/verse-id";
import {
  removeAnnotation,
  reconcileAnnotationId,
  upsertAnnotation,
  type Annotation,
} from "@/lib/store/annotations";
import type { SelectionAnchor } from "./selection";
import { deleteAnnotationRequest, patchAnnotation, postAnnotation } from "./api";
import { postAnnotationChange } from "./broadcast";

/**
 * The optimistic mutation flow, ARCHITECTURE §4.4 steps 2-8.
 *
 * A small hand-rolled hook rather than TanStack Query. Annotation writes are a single
 * fire-then-reconcile operation with no request de-duplication, background refetch, or
 * cache-key machinery to earn — that's what TanStack Query is for on the *corpus* side
 * (§1.3), which fetches immutable, range-keyed text. Annotations are mutable per-user state
 * that Jotai already owns; adding a query client here would also mean wiring a
 * `<QueryClientProvider>` into the app shell, a file outside this feature's ownership. This
 * hook is just the write path into state that already exists.
 */

let seq = 0;
function optimisticId(): string {
  seq += 1;
  return `optimistic-${Date.now()}-${seq}`;
}

interface AnchorInput {
  anchor: SelectionAnchor;
  existingVerseIds: readonly VerseId[];
}

export interface CreateHighlightInput extends AnchorInput {
  color: string;
}

export interface CreateNoteInput extends AnchorInput {
  body: string;
}

function buildOptimistic(
  anchor: SelectionAnchor,
  id: string,
  overrides: Pick<Annotation, "kind" | "color" | "body">
): Annotation {
  return {
    annotationId: id,
    startVerseId: anchor.startVerseId as VerseId,
    endVerseId: anchor.endVerseId as VerseId,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    translationId: anchor.translationId,
    quotedText: anchor.quotedText,
    tags: [],
    updatedAt: new Date().toISOString(),
    pending: true,
    ...overrides,
  };
}

export function useAnnotationMutations() {
  const upsert = useSetAtom(upsertAnnotation);
  const remove = useSetAtom(removeAnnotation);
  const reconcile = useSetAtom(reconcileAnnotationId);
  const [error, setError] = useState<string | null>(null);

  /** Shared body for create-highlight / create-note: write optimistic -> POST -> reconcile/rollback. */
  const create = useCallback(
    async (
      anchor: SelectionAnchor,
      existingVerseIds: readonly VerseId[],
      overrides: Pick<Annotation, "kind" | "color" | "body">
    ): Promise<Annotation | null> => {
      const id = optimisticId();
      const optimistic = buildOptimistic(anchor, id, overrides);

      // Step 3: write into the atoms immediately. Every mounted <Verse> for these ids
      // re-renders in this tick, across every surface — the four-density regression test
      // exercises exactly this line.
      upsert(optimistic, existingVerseIds);
      setError(null);

      try {
        // Step 5: persist.
        const saved = await postAnnotation({
          kind: overrides.kind,
          startVerseId: anchor.startVerseId,
          endVerseId: anchor.endVerseId,
          startOffset: anchor.startOffset,
          endOffset: anchor.endOffset,
          translationId: anchor.translationId,
          quotedText: anchor.quotedText,
          color: overrides.color,
          body: overrides.body,
        });
        // Step 6: swap the optimistic id for the server id.
        reconcile(id, saved, existingVerseIds);
        // Step 8: tell other tabs.
        postAnnotationChange({
          type: "upsert",
          annotation: saved,
          verseIds: existingVerseIds.filter(
            (v) => v >= saved.startVerseId && v <= saved.endVerseId
          ) as VerseId[],
        });
        return saved;
      } catch (err) {
        // Step 7: roll back and surface the failure.
        remove(id, existingVerseIds);
        setError(err instanceof Error ? err.message : "failed to save annotation");
        return null;
      }
    },
    [upsert, remove, reconcile]
  );

  const createHighlight = useCallback(
    ({ anchor, color, existingVerseIds }: CreateHighlightInput) =>
      create(anchor, existingVerseIds, { kind: "highlight", color, body: null }),
    [create]
  );

  const createNote = useCallback(
    ({ anchor, body, existingVerseIds }: CreateNoteInput) =>
      create(anchor, existingVerseIds, { kind: "note", color: null, body }),
    [create]
  );

  /**
   * Edit an existing annotation's payload — the read/edit half of the note lifecycle.
   *
   * The same optimistic shape as `create`, and deliberately so: the atom write happens first
   * so every mounted surface showing these verses updates in the same tick, and a failed
   * PATCH restores the record it started from rather than leaving the screen showing text
   * the server never accepted.
   */
  const updateAnnotationById = useCallback(
    async (
      annotation: Annotation,
      patch: Partial<Pick<Annotation, "body" | "color" | "tags">>,
      existingVerseIds: readonly VerseId[]
    ): Promise<Annotation | null> => {
      upsert({ ...annotation, ...patch, pending: true }, existingVerseIds);
      setError(null);

      try {
        const saved = await patchAnnotation(annotation.annotationId, patch);
        upsert(saved, existingVerseIds);
        postAnnotationChange({
          type: "upsert",
          annotation: saved,
          verseIds: existingVerseIds.filter(
            (v) => v >= saved.startVerseId && v <= saved.endVerseId
          ) as VerseId[],
        });
        return saved;
      } catch (err) {
        upsert(annotation, existingVerseIds);
        setError(err instanceof Error ? err.message : "failed to update annotation");
        return null;
      }
    },
    [upsert]
  );

  /**
   * Delete an annotation. Resolves true when the server confirmed it.
   *
   * Optimistic like the other two, and — now — rolled back like the other two. It used not to
   * be: a failed DELETE left the record gone from the screen and present on the server, which
   * is not "lower-stakes than a failed create", it is the one failure mode the user cannot
   * detect. The note vanished, the panel closed on the error without showing it, and the next
   * hydration brought the note back with no explanation. Deferring to that hydration meant
   * deferring to the moment the app contradicts itself.
   *
   * `remove` hands back the record it took, so the restore is exact — the same anchor, offsets
   * and body, in every verse atom it spanned.
   */
  const removeAnnotationById = useCallback(
    async (annotationId: string, existingVerseIds: readonly VerseId[]): Promise<boolean> => {
      const removed = remove(annotationId, existingVerseIds);
      setError(null);
      try {
        await deleteAnnotationRequest(annotationId);
        postAnnotationChange({
          type: "remove",
          annotationId,
          verseIds: existingVerseIds as VerseId[],
        });
        return true;
      } catch (err) {
        if (removed) upsert(removed, existingVerseIds);
        setError(err instanceof Error ? err.message : "failed to delete annotation");
        return false;
      }
    },
    [remove, upsert]
  );

  return {
    createHighlight,
    createNote,
    updateAnnotationById,
    removeAnnotationById,
    error,
    clearError: () => setError(null),
  };
}
