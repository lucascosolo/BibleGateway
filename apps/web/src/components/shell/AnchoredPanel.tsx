"use client";

import { useCallback, useEffect, useId, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { useModalSurface } from "@/lib/a11y/modal-surface";

/**
 * ≥768px panel presentation: a compact panel pinned beside the control that opened it.
 *
 * The sibling of `<BottomSheet>`, not a replacement for it. A bottom sheet is the right answer
 * on a phone — full width is all the width there is, and the thumb is at the bottom. On a
 * 1366px desktop the same component is the wrong answer for a reason that is not cosmetic: a
 * settings row stretched across the viewport puts its switch ~1300px from its label, so reading
 * the label and hitting the right switch stop being one glance. Anchoring the panel to its
 * trigger keeps label and control inside one fixation.
 *
 * Both presentations wrap the SAME body. Do not fork the content — the layer list has three
 * triggers already, and a second copy of it is how the phone and desktop panels start
 * disagreeing about which layers exist.
 *
 * PORTALED TO <body>, for exactly the reason `<BottomSheet>` is (see the long note there): every
 * trigger for this panel lives in `position: sticky` shell chrome, sticky always establishes a
 * stacking context, and z-index cannot escape one. `BottomSheet.test.tsx` pins both.
 *
 * Modal, deliberately. `useModalSurface` gives it the same focus trap, background inerting,
 * focus restoration and Escape handling the sheet has — a popover that lets Tab wander into the
 * inert page behind it is the `aria-modal="true"` mistake in a smaller box.
 */

/** Distance from the anchor's edge, and the minimum clearance kept from the viewport edge. */
const GAP = 8;
const MARGIN = 12;

interface Placement {
  top: number;
  left: number;
}

/**
 * Places the panel below its anchor, flipping above when there is not enough room, and
 * start-aligned unless that overflows the inline end, in which case it end-aligns. Everything is
 * finally clamped into the viewport, because a control in a nav rail can sit within a panel
 * height of the bottom edge and "flip above" is not always enough on a short window.
 */
function place(anchor: DOMRect, panel: { width: number; height: number }): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchor.left;
  if (left + panel.width > vw - MARGIN) left = anchor.right - panel.width;
  left = Math.max(MARGIN, Math.min(left, vw - MARGIN - panel.width));

  let top = anchor.bottom + GAP;
  if (top + panel.height > vh - MARGIN) {
    const above = anchor.top - GAP - panel.height;
    top = above >= MARGIN ? above : Math.max(MARGIN, vh - MARGIN - panel.height);
  }

  return { top, left };
}

interface AnchoredPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The control that opened the panel; the panel is placed against its box. */
  anchorRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

export function AnchoredPanel({ open, onClose, title, anchorRef, children }: AnchoredPanelProps) {
  const titleId = useId();
  // Same reason as `<BottomSheet>`: `document` does not exist during the server render and a
  // portal needs a real node, so nothing renders until after mount. Costs nothing — a panel is
  // never open on first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { rootRef, dialogRef } = useModalSurface<HTMLDivElement, HTMLDivElement>({
    open,
    onDismiss: onClose,
  });

  // `null` until measured. The panel renders at opacity 0 for that first frame rather than
  // flashing at the top-left corner — and opacity, not `visibility`, because a
  // `visibility: hidden` element cannot take focus and `useModalSurface` focuses into the panel
  // on the very next effect.
  const [pos, setPos] = useState<Placement | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = dialogRef.current;
    if (!anchor || !panel) return;
    setPos(place(anchor.getBoundingClientRect(), panel.getBoundingClientRect()));
  }, [anchorRef, dialogRef]);

  useEffect(() => {
    if (!open || !mounted) {
      setPos(null);
      return;
    }
    reposition();

    window.addEventListener("resize", reposition);
    // Capture phase: the page can scroll under the panel (the scrim does not block the wheel),
    // and the scroll that moves the anchor may be on an inner container, which does not bubble.
    window.addEventListener("scroll", reposition, { capture: true, passive: true });

    // The body changes height while open — the Selah notice appears and disappears — and a
    // panel that flipped above its anchor is positioned from its own height, so a stale height
    // leaves it overlapping the trigger. Guarded because jsdom has no ResizeObserver.
    const panel = dialogRef.current;
    const observer =
      panel && typeof ResizeObserver !== "undefined" ? new ResizeObserver(reposition) : null;
    if (panel) observer?.observe(panel);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, { capture: true });
      observer?.disconnect();
    };
  }, [open, mounted, reposition, dialogRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-50">
      {/* Transparent, unlike the sheet's scrim: at this size the panel is a small object beside
          its trigger, and dimming the whole reader to show it reads as a much heavier
          interruption than it is. It is still a real click target, so clicking away closes. */}
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // See the note on the same attribute in BottomSheet.tsx.
        data-surface="anchored"
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          opacity: pos ? 1 : 0,
          boxShadow: "var(--shadow-lg)",
        }}
        // 32rem was a cap on top of the viewport clamp, and with the interlinear row added the
        // layers panel outgrew it: on a 900px-tall screen the panel stopped at 512px and cut a
        // row in half, with a third of the viewport still empty below it. The viewport clamp is
        // the only limit that is actually about available space, so it is the only one left.
        // `scroll-shadows` (globals.css): the viewport clamp above means this panel legitimately
        // scrolls on a short screen, and a reviewer at 1180×694 found it clipped mid-row with
        // nothing indicating there was more. The shadow appears only at an edge with content
        // beyond it, so a panel that fits is unchanged.
        className="scroll-shadows fixed max-h-[calc(100dvh-1.5rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="font-serif text-[var(--text-md)] font-semibold text-[var(--color-ink)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-me-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
