"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useModalSurface } from "@/lib/a11y/modal-surface";

/**
 * Keyboard navigation for the reader.
 *
 * Reading a book is a sequential act, and a tool that makes you move a pointer to a link at the
 * bottom of the page to turn every page is a tool that discourages reading forward. Someone
 * working through a book of the Bible turns the page dozens of times in a sitting.
 *
 * The bindings are deliberately the ones already in a reader's hands from elsewhere:
 * `[` / `]` for previous and next (as in every browser's history and most readers), the arrow
 * keys as an alias, and `?` for the list — the near-universal convention, and the reason this
 * component ships a dialog rather than a page of documentation nobody would find.
 *
 * Three rules this must never break:
 *
 *   1. **Never swallow a keystroke meant for a text field.** A reader writing a note who types
 *      `]` must get a `]`, not the next chapter. Editable targets are checked first, and
 *      `contentEditable` is checked as well as `<input>`/`<textarea>` — the note composer is a
 *      textarea today and the check should not have to be revisited if it stops being one.
 *   2. **Never override a modifier combination.** `Cmd/Ctrl+]` is a browser or OS binding, and
 *      claiming it is how a web app breaks something the user relies on outside the page.
 *   3. **Never bind a key that does nothing.** At the last chapter of a book there is no next
 *      chapter, and the binding is simply absent rather than navigating somewhere invented.
 */

interface ReaderShortcutsProps {
  /** `/read/…` for the previous chapter, or null at the start of a book. */
  prevHref: string | null;
  /** `/read/…` for the next chapter, or null at the end of a book. */
  nextHref: string | null;
}

const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "]  or  →", what: "Next chapter" },
  { keys: "[  or  ←", what: "Previous chapter" },
  { keys: "?", what: "Show this list" },
  { keys: "Esc", what: "Close whatever is open" },
];

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function ReaderShortcuts({ prevHref, nextHref }: ReaderShortcutsProps) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target)) return;
      // A dialog is open somewhere on the page. Its own handlers own the keyboard while it is;
      // turning the page underneath an open note composer is a genuinely alarming thing to do.
      if (document.querySelector('[role="dialog"]')) return;

      switch (event.key) {
        case "]":
        case "ArrowRight":
          if (!nextHref) return;
          event.preventDefault();
          router.push(nextHref);
          return;
        case "[":
        case "ArrowLeft":
          if (!prevHref) return;
          event.preventDefault();
          router.push(prevHref);
          return;
        case "?":
          event.preventDefault();
          setHelpOpen(true);
          return;
        default:
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, prevHref, nextHref]);

  return helpOpen ? <ShortcutHelp onClose={() => setHelpOpen(false)} /> : null;
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => onClose(), [onClose]);
  const { rootRef, dialogRef } = useModalSurface<HTMLDivElement, HTMLDivElement>({
    open: true,
    onDismiss: close,
  });

  if (!mounted) return null;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[55] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-[color-mix(in_oklch,var(--color-ink)_35%,transparent)]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative m-3 w-[min(24rem,calc(100vw-1.5rem))] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <h2
          id="shortcuts-title"
          className="font-serif text-[var(--text-md)] font-semibold text-[var(--color-ink)]"
        >
          Keyboard shortcuts
        </h2>
        <dl className="mt-3 flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[var(--text-xs)] text-[var(--color-ink)]">{s.keys}</dt>
              <dd className="font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
                {s.what}
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={close}
          className="mt-4 min-h-[var(--touch-target)] w-full rounded-[var(--radius-full)] border border-[var(--color-border)] font-sans text-[var(--text-sm)] text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
