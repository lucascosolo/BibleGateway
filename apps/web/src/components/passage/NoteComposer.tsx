"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModalSurface } from "@/lib/a11y/modal-surface";

/**
 * The dialog a scholarly note is written in.
 *
 * It replaces `window.prompt`, which was never adequate here: a prompt is a single line with
 * no wrapping, no keyboard shortcut, no way to see the passage being annotated, and — the
 * part that actually mattered — no counterpart for *reading* what was written. It also blocks
 * the whole browser process, so a long note holds the tab hostage.
 *
 * Deliberately one component for composing and for editing. The two differ only in their
 * labels and in whether a delete control is offered, and a second dialog would be a second
 * place for focus handling and the Escape contract to drift.
 */

export interface NoteComposerProps {
  title: string;
  /** The scripture the note is about, shown so the writer can see what they selected. */
  quoted?: string | null;
  initialBody?: string;
  saveLabel: string;
  busy?: boolean;
  error?: string | null;
  onSave: (body: string) => void | Promise<void>;
  onCancel: () => void;
  /** Offered only when there is an existing record to remove. */
  onDelete?: () => void | Promise<void>;
  /** Extra apparatus above the editor — e.g. the cross-translation degradation notice. */
  children?: React.ReactNode;
}

export function NoteComposer({
  title,
  quoted,
  initialBody = "",
  saveLabel,
  busy = false,
  error,
  onSave,
  onCancel,
  onDelete,
  children,
}: NoteComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleId = useId();
  // Portaled to <body> for the same reason `<BottomSheet>` is — see the long note there. This
  // dialog is opened from a verse mark in the reader AND from the annotation panel inside the
  // `position: sticky` cross-reference aside, and sticky establishes a stacking context, so
  // from that second entry point the composer would be sealed under the page it annotates.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Focus trap, background inerting, focus restoration and the Escape contract, all from the
  // shared hook `<BottomSheet>` uses. This dialog previously focused the textarea and handled
  // Escape and nothing else: Tab walked straight out into the reader behind the scrim, a
  // screen reader could read the whole passage underneath as though the dialog were not there,
  // and closing it dropped focus on <body> rather than back on the verse mark that opened it.
  //
  // `captureEscape` because the composer can be open *over* a bottom sheet that also closes on
  // Escape — without it one keypress dismisses both, losing the note being written.
  const { rootRef, dialogRef } = useModalSurface<HTMLDivElement, HTMLDivElement>({
    onDismiss: onCancel,
    captureEscape: true,
    initialFocusRef: textareaRef,
  });

  useEffect(() => {
    // Caret at the end rather than the start: editing an existing note almost always means
    // adding to it. The focus itself is placed by `useModalSurface` via `initialFocusRef`;
    // only the caret position is this component's business.
    const length = textareaRef.current?.value.length ?? 0;
    textareaRef.current?.setSelectionRange(length, length);
  }, []);

  const save = useCallback(() => void onSave(body), [body, onSave]);

  if (!mounted) return null;

  return createPortal(
    <div ref={rootRef} className="note-dialog" role="presentation" onMouseDown={onCancel}>
      <div
        ref={dialogRef}
        className="note-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // The scrim closes on click; the panel must not, or every click inside dismisses it.
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="note-dialog__title" id={titleId}>
          {title}
        </h2>

        {quoted && <blockquote className="note-dialog__quote">{quoted}</blockquote>}

        {children}

        <label className="note-dialog__label" htmlFor={`${titleId}-body`}>
          Note
        </label>
        <textarea
          id={`${titleId}-body`}
          ref={textareaRef}
          className="note-dialog__body"
          value={body}
          rows={6}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Enter inserts a newline — a note is prose. Modifier+Enter saves, the
            // convention every long-form composer already trains.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              save();
            }
          }}
        />

        {error && (
          <p className="note-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="note-dialog__actions">
          {onDelete &&
            (confirmingDelete ? (
              <>
                <span className="note-dialog__confirm">Delete this note?</span>
                <button
                  type="button"
                  className="note-dialog__action note-dialog__action--danger"
                  onClick={() => void onDelete()}
                  disabled={busy}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="note-dialog__action"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                className="note-dialog__action note-dialog__action--danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                Delete
              </button>
            ))}
          <span className="note-dialog__spacer" />
          <button type="button" className="note-dialog__action" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="note-dialog__action note-dialog__action--primary"
            onClick={save}
            disabled={busy}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
