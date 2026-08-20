"use client";

import { useEffect, useRef } from "react";
import { useSetAtom } from "jotai";

import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import { hydrateRange, removeAnnotation, upsertAnnotation } from "@/lib/store/annotations";
import { fetchAnnotationsInRange } from "@/lib/annotations/api";
import { subscribeAnnotationChanges } from "@/lib/annotations/broadcast";

export interface AnnotationSyncProps {
  range: VerseRange;
  existingVerseIds: readonly VerseId[];
}

/**
 * Invisible. Wires the server <-> Jotai atoms for one mounted range — ARCHITECTURE §4.4.
 *
 * Two jobs:
 *  1. Hydrate the visible range's annotations on mount (and whenever the range itself
 *     changes, e.g. chapter navigation).
 *  2. Apply changes broadcast from other tabs (§4.4 step 8), so a highlight made in tab A
 *     appears in tab B without a reload.
 *
 * Mount one per visible range. Nothing else needs to know it exists.
 */
export function AnnotationSync({ range, existingVerseIds }: AnnotationSyncProps) {
  const hydrate = useSetAtom(hydrateRange);
  const upsert = useSetAtom(upsertAnnotation);
  const remove = useSetAtom(removeAnnotation);

  // Read inside a ref so the broadcast subscription (mounted once) always sees the current
  // verse list without needing to resubscribe every time the prop identity changes.
  const verseIdsRef = useRef(existingVerseIds);
  verseIdsRef.current = existingVerseIds;

  useEffect(() => {
    let cancelled = false;
    fetchAnnotationsInRange(range)
      .then((annotations) => {
        if (!cancelled) hydrate(annotations, range, verseIdsRef.current);
      })
      .catch(() => {
        // Hydration failing leaves the range rendering without saved annotations; new
        // highlights still work locally via the optimistic path and persist normally.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the range's identity
  }, [range.start, range.end, hydrate]);

  useEffect(
    () =>
      subscribeAnnotationChanges((message) => {
        if (message.type === "upsert") {
          upsert(message.annotation, verseIdsRef.current);
        } else {
          remove(message.annotationId, verseIdsRef.current);
        }
      }),
    [upsert, remove]
  );

  return null;
}
