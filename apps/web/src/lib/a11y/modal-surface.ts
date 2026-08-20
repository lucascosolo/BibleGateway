"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The three things a modal surface owes a keyboard or screen-reader user, in one place.
 *
 * There were two dialogs in this app — `<BottomSheet>` and `<NoteComposer>` — and they had
 * drifted: the sheet trapped focus and restored it, the note composer did neither, and neither
 * inerted the page underneath. `aria-modal="true"` on its own does *not* do any of this; it is
 * a hint to assistive technology, not a behaviour, and it does nothing at all for a sighted
 * keyboard user who tabs straight out of the dialog into the reader behind it.
 *
 * So all three live here and both dialogs call the same hook. A second copy is how they drift
 * again.
 *
 *   1. FOCUS TRAP.       Tab / Shift+Tab cycle inside the dialog.
 *   2. BACKGROUND INERT. Everything outside the overlay gets `inert`, which removes it from
 *                        the accessibility tree AND from hit-testing, so a screen-reader user
 *                        swiping past the end of the dialog does not walk into the page below.
 *   3. FOCUS RESTORE.    On close, focus returns to whatever opened the dialog. Without this
 *                        focus resets to <body> and the next Tab starts from the top of the
 *                        document — the user loses their place entirely.
 *
 * Two refs, not one, and the split is load-bearing. `rootRef` is the full-screen overlay
 * INCLUDING the scrim; it is what the inerting walks up from, so the scrim stays clickable.
 * `dialogRef` is the panel alone; it is what the focus trap cycles within, so Tab never lands
 * on the scrim's close button and the cycle stays inside the visible dialog.
 */

/** Elements a focus trap is willing to land on, in DOM order. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Marks everything outside `root` as `inert`, walking up to <body> and inerting each ancestor's
 * other children. Returns the undo.
 *
 * Walking up is what makes this work for a dialog rendered IN PLACE rather than portaled to
 * <body>. Inerting the body's children directly would inert an ancestor of the dialog, and
 * `inert` is inherited — the dialog would inert itself.
 *
 * The attribute is set rather than the `HTMLElement.inert` property so this does not depend on
 * which TypeScript lib version has the property declared.
 */
function inertOutside(root: HTMLElement): () => void {
  const marked: HTMLElement[] = [];
  let node: HTMLElement | null = root;

  while (node && node !== document.body && node.parentElement) {
    const parent: HTMLElement = node.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node) continue;
      if (!(sibling instanceof HTMLElement)) continue;
      // Already inert for some other reason (a second dialog above this one). Leave it, and
      // crucially do not record it — un-inerting it on close would silently revive the other
      // dialog's background.
      if (sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      marked.push(sibling);
    }
    node = parent;
  }

  return () => {
    for (const el of marked) el.removeAttribute("inert");
  };
}

export interface ModalSurfaceOptions {
  /** Whether the surface is currently mounted and modal. Defaults to true. */
  open?: boolean;
  /** Escape, scrim click, close button — whatever dismisses this surface. */
  onDismiss: () => void;
  /**
   * Listen for Escape during the capture phase and stop it propagating.
   *
   * Needed when this dialog can be open *over* another one that also closes on Escape: without
   * it a single Escape closes both. The note composer opens over the selection toolbar and
   * potentially over a bottom sheet, so it captures; the sheet is outermost and does not.
   */
  captureEscape?: boolean;
  /**
   * Where focus should land on open. Defaults to the first focusable element in the dialog.
   * The note composer points this at its textarea, because landing on "Cancel" and making the
   * writer Tab to the thing they opened the dialog to use is a poor trade for one line of code.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export interface ModalSurfaceRefs<
  R extends HTMLElement = HTMLElement,
  D extends HTMLElement = HTMLElement,
> {
  /** The full-screen overlay, scrim included. Attach to the outermost node. */
  rootRef: RefObject<R | null>;
  /** The dialog panel itself. Attach to the element carrying role="dialog". */
  dialogRef: RefObject<D | null>;
}

export function useModalSurface<
  R extends HTMLElement = HTMLElement,
  D extends HTMLElement = HTMLElement,
>({
  open = true,
  onDismiss,
  captureEscape = false,
  initialFocusRef,
}: ModalSurfaceOptions): ModalSurfaceRefs<R, D> {
  const rootRef = useRef<R | null>(null);
  const dialogRef = useRef<D | null>(null);

  // Escape and the Tab cycle. Split from the focus/inert effect below because this one has to
  // re-subscribe whenever `onDismiss` changes identity, and re-running the focus effect on
  // every parent re-render would yank the caret back to the top of the textarea mid-sentence.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (captureEscape) event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        // A hidden or collapsed control is in the DOM but cannot take focus; sending focus to
        // one silently drops it on <body> and the trap leaks. Tested by rendered box rather
        // than by `offsetParent`, which is null for any `position: fixed` element and would
        // therefore discard a perfectly focusable control.
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Focus outside the dialog entirely (a stray programmatic focus, or the very first Tab
      // after a failed initial focus) — pull it back in rather than letting it wander.
      if (!(active instanceof HTMLElement) || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, captureEscape);
    return () => document.removeEventListener("keydown", onKeyDown, captureEscape);
  }, [open, onDismiss, captureEscape]);

  // Inerting and focus. Deliberately depends only on `open`: it must run exactly once per
  // opening. `initialFocusRef` is read but not depended on — it is a ref, so its identity is
  // stable and its contents are read at the moment focus is placed.
  useEffect(() => {
    if (!open) return;

    // Captured BEFORE anything inside the dialog is focused, or the "element that opened this"
    // is the dialog itself.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const root = rootRef.current;
    const releaseInert = root ? inertOutside(root) : () => {};

    const target =
      initialFocusRef?.current ??
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      null;
    target?.focus();

    return () => {
      releaseInert();
      // The opener may have been unmounted while the dialog was open (deleting a note removes
      // the mark that opened its editor), in which case it is no longer focusable and this is
      // a no-op rather than an error.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { rootRef, dialogRef };
}
