"use client";

import Link from "next/link";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";

import { useAnnotationMutations } from "@/lib/annotations/useAnnotations";
import type { VerseId } from "@/lib/refs/verse-id";
import { annotationIndex, openAnnotationAtom } from "@/lib/store/annotations";
import { NoteComposer } from "./NoteComposer";

/**
 * Read, edit and delete one annotation.
 *
 * Notes used to be write-only: the body went into the database and nothing ever rendered it,
 * and the PATCH and DELETE routes had no caller anywhere in the app. A researcher could
 * annotate a verse and then never see, correct or remove what they wrote — which makes the
 * feature worse than absent, because it silently accumulates work the tool will not give back.
 *
 * Mounted once per surface and driven by `openAnnotationAtom`, so the record it edits is the
 * one in `annotationIndex` — the same object every `<Verse>` subscribes to. An edit therefore
 * propagates through the ordinary atom path (§4.4) rather than through anything this
 * component maintains.
 */

export interface AnnotationPanelProps {
  existingVerseIds: readonly VerseId[];
  /** The translation the surrounding passage is being read in. */
  translationId: number;
  /** Loaded translations, so a mark made elsewhere can name and link to where it was made. */
  translations: readonly { translationId: number; code: string; name: string }[];
  /** Address of the surrounding passage, for the "read it where it was made" link. */
  passageSlug: string;
}

export function AnnotationPanel({
  existingVerseIds,
  translationId,
  translations,
  passageSlug,
}: AnnotationPanelProps) {
  const [openId, setOpenId] = useAtom(openAnnotationAtom);
  const index = useAtomValue(annotationIndex);
  const { updateAnnotationById, removeAnnotationById, error, clearError } =
    useAnnotationMutations();
  const [busy, setBusy] = useState(false);

  function close() {
    setOpenId(null);
    clearError();
  }

  const annotation = openId ? index.get(openId) : undefined;

  // The id can outlive the record: another tab may delete it while this panel is open, and
  // hydration replaces the whole range on navigation.
  if (!openId || !annotation) return null;

  const scoped = existingVerseIds.filter(
    (id) => id >= annotation.startVerseId && id <= annotation.endVerseId
  );

  // Precise offsets taken in another translation cannot be trusted here — ARCHITECTURE §3.3.
  const approximate =
    annotation.startOffset !== null &&
    annotation.endOffset !== null &&
    annotation.translationId !== translationId;
  const origin = translations.find((t) => t.translationId === annotation.translationId);

  async function handleSave(body: string) {
    if (!annotation) return;
    setBusy(true);
    const saved = await updateAnnotationById(annotation, { body: body || null }, scoped);
    setBusy(false);
    if (saved) close();
  }

  // Closes only on success — matching `handleSave` above, which already got this right.
  // Closing unconditionally discarded the one place the delete error was rendered, so a failed
  // delete looked exactly like a successful one.
  async function handleDelete() {
    if (!annotation) return;
    setBusy(true);
    const deleted = await removeAnnotationById(annotation.annotationId, scoped);
    setBusy(false);
    if (deleted) close();
  }

  return (
    <NoteComposer
      // Remount when the open annotation changes — the composer holds the draft body in local
      // state, and without this, opening a second note would show the first one's text.
      key={openId}
      title={annotation.kind === "highlight" ? "Highlight" : "Note"}
      quoted={annotation.quotedText}
      initialBody={annotation.body ?? ""}
      saveLabel="Save"
      busy={busy}
      error={error}
      onSave={handleSave}
      onCancel={close}
      onDelete={handleDelete}
    >
      {approximate && (
        // Stated in full rather than as a badge or an icon. The reader has no way to deduce
        // any of this from the page: they marked a phrase, they are now looking at a
        // different translation of that verse, and the words they marked may not exist in it.
        // A tooltip saying "approximate" explains nothing to someone who was not told.
        <div className="note-dialog__notice" data-kind="approximate">
          <p>
            <strong>This mark is approximate.</strong> You made it while reading
            {origin ? ` the ${origin.name} (${origin.code})` : " a different translation"}, and
            its exact words could not be located in the translation on screen. Rather than
            guess at a position and mark the wrong words, it covers the whole verse.
          </p>
          {origin && (
            <p>
              <Link
                href={`/read/${passageSlug}?t=${origin.code}#v${annotation.startVerseId}`}
                onClick={close}
              >
                Read this passage in {origin.code}
              </Link>{" "}
              to see it exactly where you made it.
            </p>
          )}
        </div>
      )}
    </NoteComposer>
  );
}
