import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/Wordmark";
import { SUPPORT_URL } from "@/lib/support";

/**
 * Where PayPal sends a donor who backed out before paying. Nothing was charged, and the page
 * says so first, because that is the one thing the person wants to know. No guilt, no second
 * ask in the body: the way to try again is one quiet link among the ways back. Not indexed.
 */
export const metadata: Metadata = {
  title: "Nothing was charged — Jot",
  robots: { index: false, follow: true },
};


const NEXT: { href: string; label: string; hint: string; external?: boolean }[] = [
  { href: "/read/Gen.1", label: "Back to reading", hint: "Pick up where you left off, or start at Genesis 1" },
  { href: "/toledot", label: "Toledot", hint: "The timeline of the evidence" },
  ...(SUPPORT_URL ? [{ href: SUPPORT_URL, label: "Try again", hint: "Opens PayPal in a new tab", external: true }] : []),
];

export default function SupportCancelledPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Wordmark size="md" />
        <h1 className="font-serif text-[length:var(--text-xl)] text-[var(--color-ink)]">Nothing was charged</h1>
      </header>

      <div className="flex flex-col gap-3 font-serif text-[length:var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
        <p>The payment was cancelled before it completed, and no money moved.</p>
        <p>
          Jot stays free either way. Every translation, cross-reference, word study and timeline
          page is open to everyone, with or without support.
        </p>
      </div>

      <nav aria-label="Where next" className="flex flex-col gap-2">
        {NEXT.map((w) =>
          w.external ? (
            <a
              key={w.href}
              href={w.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[var(--touch-target)] items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-hover)]"
            >
              <span className="font-serif text-[length:var(--text-md)] font-semibold text-[var(--color-ink)]">{w.label}</span>
              <span className="text-end font-sans text-[length:var(--text-xs)] text-[var(--color-ink-muted)]">{w.hint}</span>
            </a>
          ) : (
            <Link
              key={w.href}
              href={w.href}
              className="flex min-h-[var(--touch-target)] items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-hover)]"
            >
              <span className="font-serif text-[length:var(--text-md)] font-semibold text-[var(--color-ink)]">{w.label}</span>
              <span className="text-end font-sans text-[length:var(--text-xs)] text-[var(--color-ink-muted)]">{w.hint}</span>
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
