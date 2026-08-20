"use client";

import { useEffect, useRef } from "react";

import { AnnotationPanel } from "@/components/passage/AnnotationPanel";
import { AnnotationSync } from "@/components/passage/AnnotationSync";
import { SelectionToolbar } from "@/components/passage/SelectionToolbar";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import { usePreferencesStore } from "@/lib/store/preferences";

export interface ReaderInteractionsProps {
  range: VerseRange;
  existingVerseIds: VerseId[];
  translationId: number;
  /** For "Continue reading" on the home page — the address of the page the user is on. */
  slug: string;
  label: string;
  translationCode: string;
  /** Loaded translations, so a mark made in another one can name and link back to it. */
  translations: { translationId: number; code: string; name: string }[];
}

/**
 * The client half of the reader page.
 *
 * `page.tsx` stays a server component so the passage text streams without shipping the
 * corpus query layer to the client; this mounts alongside it to wire up selection ->
 * highlight -> persistence (§4.4) and cross-tab sync (`AnnotationSync`), which are
 * inherently client-side concerns (DOM selection, fetch, BroadcastChannel).
 */
export function ReaderInteractions({
  range,
  existingVerseIds,
  translationId,
  slug,
  label,
  translationCode,
  translations,
}: ReaderInteractionsProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const setLastRead = usePreferencesStore((s) => s.setLastRead);

  useEffect(() => {
    containerRef.current = document.querySelector<HTMLElement>(".reader");
  }, []);

  // Recorded on the client because the preferences store is a client-only, localStorage-backed
  // Zustand instance (§ "universal persistence" applies to annotations, not this) — the page
  // itself stays a server component and never touches it.
  useEffect(() => {
    setLastRead({ slug, label, translationCode });
    // Keyed on the address, not on `setLastRead` (a stable Zustand action reference anyway) —
    // this should fire once per passage visited, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, label, translationCode]);

  return (
    <>
      <AnnotationSync range={range} existingVerseIds={existingVerseIds} />
      <SelectionToolbar
        translationId={translationId}
        existingVerseIds={existingVerseIds}
        containerRef={containerRef}
      />
      {/* One panel for the whole passage, opened by any verse's mark — see
          `openAnnotationAtom`. Mounting it per verse would put 176 dormant dialogs in
          Psalm 119. */}
      <AnnotationPanel
        existingVerseIds={existingVerseIds}
        translationId={translationId}
        translations={translations}
        passageSlug={slug}
      />
    </>
  );
}
