import Link from "next/link";

import { Wordmark } from "@/components/Wordmark";

/**
 * The 404.
 *
 * It existed as Next's default — a bare "404 / This page could not be found." on a white field,
 * with no wordmark, no navigation and no way back. A reviewer called it the only screen in the
 * product that looked unowned, and was right that it was jarring precisely *because* every
 * other empty state here is written with care: `/toledot` explains what it will hold and what
 * will back it, `/derash` with no query explains its own search semantics, `/lashon/H2617`
 * disambiguates rather than failing.
 *
 * The most likely way to arrive here is a reference that did not parse — a typo, a book
 * abbreviation this app does not know, a chapter that does not exist in that book. So the page
 * does the one useful thing an error page can do: say what kinds of address work, and put the
 * reader one click from somewhere real.
 */

// No `metadata` export: Next ignores one here, and a title that never appears is worse than no
// title at all — it reads as done.

const WAYS_BACK: { href: string; label: string; hint: string }[] = [
  { href: "/", label: "Start again", hint: "The search box takes a reference or a phrase" },
  { href: "/read/Gen.1", label: "Read", hint: "Genesis 1, or any reference you like" },
  { href: "/derash", label: "Search", hint: "Find a phrase across the translations" },
  { href: "/lashon", label: "Word study", hint: "Look up a Hebrew or Greek word" },
];

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Wordmark size="md" />
        <h1 className="font-serif text-[var(--text-xl)] text-[var(--color-ink)]">
          There is nothing at this address
        </h1>
      </header>

      <div className="flex flex-col gap-3 font-serif text-[var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
        <p>
          Most often this is a reference that could not be read. A reference here looks like{" "}
          <code className="font-mono text-[var(--text-sm)] text-[var(--color-ink)]">Gen 1</code>,{" "}
          <code className="font-mono text-[var(--text-sm)] text-[var(--color-ink)]">John 3:16</code>{" "}
          or{" "}
          <code className="font-mono text-[var(--text-sm)] text-[var(--color-ink)]">Ps 23:1-6</code>{" "}
          — a book, then a chapter, then an optional verse or range.
        </p>
        <p>
          It may also be a verse that genuinely does not exist. Chapters do not all have the same
          number of verses, and a few verses are printed by some Bibles and not others — if that
          is what you were after, the reader will show you the gap and explain it rather than
          send you here.
        </p>
      </div>

      <nav aria-label="Ways back" className="flex flex-col gap-2">
        {WAYS_BACK.map((w) => (
          <Link
            key={w.href}
            href={w.href}
            className="flex min-h-[var(--touch-target)] items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-hover)]"
          >
            <span className="font-serif text-[var(--text-md)] font-semibold text-[var(--color-ink)]">
              {w.label}
            </span>
            <span className="text-end font-sans text-[var(--text-xs)] text-[var(--color-ink-muted)]">
              {w.hint}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
