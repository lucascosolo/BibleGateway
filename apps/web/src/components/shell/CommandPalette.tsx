"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModalSurface } from "@/lib/a11y/modal-surface";

function isGreekOrHebrew(value: string) {
  return /[\u0370-\u03ff\u0590-\u05ff]/u.test(value);
}

/** Global, keyboard-first doorway to the same reference/search classifier as the home page. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const { rootRef, dialogRef } = useModalSurface<HTMLDivElement, HTMLDivElement>({
    open,
    onDismiss: close,
    initialFocusRef: inputRef,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!mounted || !open) return null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputRef.current?.value.trim() ?? "";
    if (!value) return;
    const destination = /^H\d+[ab]?$/iu.test(value) || isGreekOrHebrew(value)
      ? `/lashon/${encodeURIComponent(value)}`
      : `/go?q=${encodeURIComponent(value)}`;
    window.location.assign(destination);
  }

  return createPortal(
    <div ref={rootRef} className="command-palette" data-chrome>
      <button type="button" className="command-palette__scrim" aria-label="Close search" onClick={close} />
      <div ref={dialogRef} className="command-palette__dialog" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
        <div className="command-palette__heading">
          <h2 id="command-palette-title">Go to a passage or word</h2>
          <kbd>Esc</kbd>
        </div>
        <form onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="command-palette-input">Reference, Strong&apos;s number, or search words</label>
          <input
            ref={inputRef}
            id="command-palette-input"
            name="q"
            autoComplete="off"
            spellCheck={false}
            placeholder="John 3:16, Ps 23, H2617, or logos"
          />
          <p>References open in the reader; words search the text; Hebrew and Greek open Word study.</p>
        </form>
      </div>
    </div>,
    document.body,
  );
}
