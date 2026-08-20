"use client";

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";

import type { VerseId } from "@/lib/refs/verse-id";
import { selectionToAnchor, type SelectionAnchor } from "@/lib/annotations/selection";
import { useAnnotationMutations } from "@/lib/annotations/useAnnotations";
import { NoteComposer } from "./NoteComposer";

/**
 * The floating toolbar that appears on a text selection inside a passage.
 *
 * Four highlight colors, "Note", "Copy", and a dismiss control. Reachable by keyboard
 * (Escape dismisses, every control is a real `<button>` in tab order) and thumb-reachable on
 * mobile — below the `COMPACT_WIDTH` breakpoint it docks to the bottom of the viewport rather
 * than tracking the selection rectangle, per ARCHITECTURE §4.7's mobile-first rule that
 * selection UI must work on touch.
 */

const COLORS = [
  { token: "amber", label: "Amber" },
  { token: "rose", label: "Rose" },
  { token: "moss", label: "Moss" },
  { token: "sky", label: "Sky" },
] as const;

// Matches the `base` breakpoint in ARCHITECTURE §4.7.
const COMPACT_WIDTH = 640;

export interface SelectionToolbarProps {
  translationId: number;
  existingVerseIds: readonly VerseId[];
  /** Restrict selection handling to selections inside this element. Omit to scope to the whole document. */
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function SelectionToolbar({
  translationId,
  existingVerseIds,
  containerRef,
}: SelectionToolbarProps) {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [compact, setCompact] = useState(false);
  // The anchor the note composer is open over. Held separately from `anchor` because opening
  // the composer moves focus into a textarea, which collapses the DOM selection and would
  // otherwise clear the very anchor the note is about to be attached to.
  const [composing, setComposing] = useState<SelectionAnchor | null>(null);
  const [saving, setSaving] = useState(false);
  const { createHighlight, createNote, error, clearError } = useAnnotationMutations();

  useEffect(() => {
    const update = () => setCompact(window.innerWidth < COMPACT_WIDTH);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    function onSelectionChange() {
      const selection = document.getSelection();
      if (
        containerRef?.current &&
        selection?.anchorNode &&
        !containerRef.current.contains(selection.anchorNode)
      ) {
        return;
      }
      const parsed = selectionToAnchor(selection, translationId);
      if (!parsed || !parsed.quotedText.trim()) {
        setAnchor(null);
        setRect(null);
        return;
      }
      setAnchor(parsed);
      setRect(selection!.getRangeAt(0).getBoundingClientRect());
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [containerRef, translationId]);

  const dismiss = useCallback(() => {
    setAnchor(null);
    setRect(null);
    document.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!anchor) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anchor, dismiss]);

  function scopeTo(target: SelectionAnchor) {
    return existingVerseIds.filter(
      (id) => id >= target.startVerseId && id <= target.endVerseId
    );
  }

  async function handleSaveNote(body: string) {
    if (!composing) return;
    setSaving(true);
    await createNote({ anchor: composing, body, existingVerseIds: scopeTo(composing) });
    setSaving(false);
    setComposing(null);
    dismiss();
  }

  // Rendered outside the `anchor` guard below: opening the composer moves focus out of the
  // passage, which clears the DOM selection and therefore the toolbar's own anchor. The
  // composer holds its own copy and must survive that.
  const composer = composing ? (
    <NoteComposer
      title="New note"
      quoted={composing.quotedText}
      saveLabel="Save note"
      busy={saving}
      error={error}
      onSave={handleSaveNote}
      onCancel={() => {
        setComposing(null);
        clearError();
        dismiss();
      }}
    />
  ) : null;

  if (!anchor || !rect) return composer;

  const scoped = scopeTo(anchor);

  async function handleColor(color: string) {
    if (!anchor) return;
    await createHighlight({ anchor, color, existingVerseIds: scoped });
    dismiss();
  }

  async function handleCopy() {
    if (!anchor) return;
    try {
      await navigator.clipboard.writeText(anchor.quotedText);
    } catch {
      // Clipboard permission can be denied; the selection stays visible so the user can
      // still copy it manually.
    }
  }

  // `-52px` and hope was the previous rule, and it was wrong by about the height of a line.
  // The toolbar is two rows of padding around a 2.75rem touch target — roughly 60px — so
  // placing its TOP 52px above the selection put its BOTTOM 8px *inside* the selection and its
  // body over the line above, which is the line a reader most often wants to see while deciding
  // what to do with the one they just selected.
  //
  // `translateY(-100%)` measures the toolbar for us: the browser knows its height, we do not,
  // and any constant we wrote here would go stale the next time a button is added to the row.
  // The anchor point is 10px above the selection and the element hangs upward from it.
  const FLIP_THRESHOLD = 88; // enough room above for the toolbar plus its gap
  const above = rect.top >= FLIP_THRESHOLD;
  const style: React.CSSProperties | undefined = compact
    ? undefined
    : {
        // Below the selection when there is no room above — at the top of the viewport the old
        // `Math.max(8, …)` clamp silently pinned it over the first line of the chapter.
        top: above ? rect.top - 10 : rect.bottom + 10,
        // A custom property, not `transform` directly. `.selection-toolbar` has an entry
        // animation, and an animation's transform beats an inline one for as long as it runs —
        // so setting `transform` here would have made the toolbar hang the wrong way for the
        // first 120ms and then snap. The stylesheet composes this into its own transform.
        ["--toolbar-flip" as string]: above ? "-100%" : "0px",
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 320)),
      };

  return (
    <>
      {composer}
    <div
      role="toolbar"
      aria-label="Selection actions"
      aria-describedby="selection-toolbar-gloss"
      className={clsx("selection-toolbar", compact && "selection-toolbar--pinned")}
      style={style}
    >
      <span id="selection-toolbar-gloss" className="sr-only">
        Highlight, annotate, or copy the selected text.
      </span>
      <div className="selection-toolbar__colors">
        {COLORS.map(({ token, label }) => (
          <button
            key={token}
            type="button"
            className="selection-toolbar__color"
            data-color={token}
            aria-label={`Highlight ${label}`}
            onClick={() => void handleColor(token)}
          />
        ))}
      </div>
      <button
        type="button"
        className="selection-toolbar__action"
        onClick={() => setComposing(anchor)}
      >
        Note
      </button>
      <button type="button" className="selection-toolbar__action" onClick={() => void handleCopy()}>
        Copy
      </button>
      <button
        type="button"
        className="selection-toolbar__dismiss"
        aria-label="Dismiss selection toolbar"
        onClick={dismiss}
      >
        ×
      </button>
      {error && (
        <p role="alert" className="selection-toolbar__error">
          {error}
          <button type="button" onClick={clearError}>
            Dismiss
          </button>
        </p>
      )}
    </div>
    </>
  );
}
