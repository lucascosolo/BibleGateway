"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useModalSurface } from "@/lib/a11y/modal-surface";
import {
  CITATION_FORMATS,
  formatCitation,
  type CitationFormat,
  type CitationSubject,
} from "@/lib/citation";

/**
 * "Cite this passage."
 *
 * Sits with the copyright notice rather than in the page chrome, because it is about *this*
 * text in *this* translation and a control that travels with the licence line is a control the
 * reader finds at the moment they need it — which is after they have decided to quote something.
 *
 * The date is the one thing this cannot receive from the server. A citation records when the
 * reader looked at the page, and a server render would stamp when the page was *built* — which
 * for a cached route can be days earlier, and would be wrong in a way nobody would ever notice.
 * So it is taken on the client, on open, and the rest of the subject comes down as props.
 */

interface CiteButtonProps {
  /** Everything about the citation that the server knows: reference, translation, licence, build. */
  subject: Omit<CitationSubject, "accessed" | "url">;
  /** Path and query for this passage, e.g. `/read/Gen.1?t=WEB`. Made absolute on the client. */
  path: string;
}

export function CiteButton({ subject, path }: CiteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="cite__trigger" onClick={() => setOpen(true)}>
        Cite this passage
      </button>
      {open && <CiteDialog subject={subject} path={path} onClose={() => setOpen(false)} />}
    </>
  );
}

function CiteDialog({
  subject,
  path,
  onClose,
}: CiteButtonProps & { onClose: () => void }) {
  const [format, setFormat] = useState<CitationFormat>("plain");
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Same reason as the other portaled surfaces: `document` does not exist during the server
  // render, and a portal needs a real node.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { rootRef, dialogRef } = useModalSurface<HTMLDivElement, HTMLDivElement>({
    open: true,
    onDismiss: onClose,
  });

  // Resolved once, on open. `window.location.origin` rather than a hard-coded host: this app
  // is served from two hostnames (one redirects to the other) and from a preview server, and a
  // citation must record the address the reader was actually at.
  const url = mounted ? `${window.location.origin}${path}` : path;
  const accessed = useRef(new Date()).current;

  const text = formatCitation({ ...subject, url, accessed }, format);

  // Reset rather than accumulate: switching format after copying used to leave "Copied" showing
  // beside text that had not been copied.
  useEffect(() => setCopied(false), [format]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused — an insecure origin, a permissions policy, a browser
      // that only allows it from a trusted event in a way this promise chain has already left.
      // Select the text instead so the reader can copy it by hand, and say nothing false.
      textRef.current?.select();
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[color-mix(in_oklch,var(--color-ink)_35%,transparent)]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cite-title"
        data-surface="dialog"
        className="relative m-3 flex w-[min(38rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <h2
            id="cite-title"
            className="font-serif text-[var(--text-md)] font-semibold text-[var(--color-ink)]"
          >
            Cite {subject.reference}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-me-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            ×
          </button>
        </div>

        {/* Says why the build id is in there. Without this it looks like noise and gets deleted
            by the first person who pastes it into a footnote. */}
        <p className="font-sans text-[var(--text-xs)] leading-snug text-[var(--color-ink-muted)]">
          The reference includes the id of the exact version of the text this site is serving.
          The wording of a translation here can be corrected — one of them arrived with words
          run together and had to be repaired — so that id is what lets anyone check later that
          they are looking at the same words you were.
        </p>

        <div role="radiogroup" aria-label="Citation format" className="flex flex-wrap gap-2">
          {CITATION_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={format === f.id}
              title={f.hint}
              onClick={() => setFormat(f.id)}
              className={`min-h-[var(--touch-target)] rounded-[var(--radius-full)] border px-3 font-sans text-[var(--text-sm)] ${
                format === f.id
                  ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-ink)]"
                  : "border-[var(--color-border)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* A textarea, not a <pre>: it is selectable and copyable by keyboard on every platform,
            including the ones where the clipboard API is refused. `readOnly`, not `disabled` —
            a disabled control cannot be focused or selected, which defeats the fallback. */}
        <textarea
          ref={textRef}
          readOnly
          value={text}
          rows={format === "bibtex" || format === "csl-json" ? 12 : 4}
          aria-label="Citation text"
          className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-[var(--text-xs)] leading-relaxed text-[var(--color-ink)]"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={copy}
            className="min-h-[var(--touch-target)] rounded-[var(--radius-full)] bg-[var(--color-brand)] px-4 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-bg)]"
          >
            Copy
          </button>
          {/* Polite, not assertive: this is a confirmation, and it must not interrupt whatever a
              screen-reader user was in the middle of hearing. */}
          <span aria-live="polite" className="font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
            {copied ? "Copied" : ""}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
