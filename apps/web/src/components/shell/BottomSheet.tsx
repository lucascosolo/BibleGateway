"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { useModalSurface } from "@/lib/a11y/modal-surface";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * <768px panel presentation: a bottom sheet over the reader, per §4.7.
 *
 * Focus trap, background inerting and focus restoration all come from `useModalSurface` — the
 * same hook `<NoteComposer>` uses, so the two dialogs cannot drift apart again. This component
 * used to carry its own copy of the trap and the restore, and no inerting at all.
 *
 * PORTALED TO <body>, and that is not a stylistic preference — it is the only thing that makes
 * `z-50` mean anything. Every trigger for this sheet lives inside shell chrome, and the nav rail
 * is `position: sticky`. Sticky ALWAYS establishes a stacking context, regardless of z-index, so
 * a sheet rendered in place was sealed inside the rail's context: its z-50 ranked it against the
 * rail's own children and nothing else, while the rail itself sat at z-index auto among its
 * siblings. The reader and the cross-reference aside come later in DOM order, so they painted
 * straight over the top of an opaque panel. On screen it read as a transparent sheet — the
 * background was painting perfectly, the page was simply painting on top of it.
 *
 * The lesson generalises: a modal rendered inside ANY positioned, sticky, transformed, filtered
 * or contained ancestor cannot escape it with z-index. If you add another dialog, portal it.
 *
 * `inertOutside` handles the portaled case without changes — it walks up from the overlay
 * inerting each ancestor's *other* children, so with the overlay as a direct child of <body> it
 * inerts body's other children and never an ancestor of the dialog itself.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId();
  // `document` does not exist during the server render, and a portal target has to be a real
  // node. Rendering nothing until mounted keeps the server and first client render identical,
  // which is what React checks for hydration — and costs nothing, since a sheet is never open
  // on first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // `rootRef` is the overlay including the scrim, so the scrim stays clickable while everything
  // *outside* the overlay goes inert. `dialogRef` is the panel, so Tab cycles the panel's own
  // controls and never lands on the scrim button.
  const { rootRef, dialogRef } = useModalSurface<HTMLDivElement, HTMLDivElement>({
    open,
    onDismiss: onClose,
  });

  if (!open || !mounted) return null;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--color-overlay)]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Which of the two modal presentations this is. The only reason it exists is that
        // `LayerControls.test.tsx` has to assert that exactly one of them mounts at a given
        // width — "one body, two presentations" is not observable from the rendered body alone,
        // since the body is identical by design.
        data-surface="sheet"
        className="relative max-h-[80dvh] w-full overflow-y-auto rounded-t-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-bg-raised)] p-5 pb-[calc(var(--space-8)+env(safe-area-inset-bottom))]"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[var(--color-border-strong)]" />
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-serif text-[var(--text-lg)] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
