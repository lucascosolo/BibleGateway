import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/Wordmark";

/**
 * Where PayPal sends a donor after a completed payment. The page knows nothing about the
 * transaction (PayPal's return carries no verified amount), so it thanks and points back to the
 * reading; it never claims a sum or a receipt. Not indexed: it only means something after a
 * payment, and a search engine landing here would be an odd first visit.
 */
export const metadata: Metadata = {
  title: "Thank you — Jot",
  robots: { index: false, follow: true },
};

const NEXT: { href: string; label: string; hint: string }[] = [
  { href: "/read/Gen.1", label: "Back to reading", hint: "Pick up where you left off, or start at Genesis 1" },
  { href: "/toledot", label: "Toledot", hint: "The timeline of the evidence your support keeps growing" },
  { href: "/roadmap", label: "What is next", hint: "The work planned for the coming releases" },
];

export default function SupportThanksPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Wordmark size="md" />
        <h1 className="font-serif text-[length:var(--text-xl)] text-[var(--color-ink)]">Thank you</h1>
      </header>

      <div className="flex flex-col gap-3 font-serif text-[length:var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
        <p>
          Your support went through. PayPal will send you the receipt; nothing about the payment is
          stored here.
        </p>
        <p>
          Jot has no subscriptions, no unlocks and no advertising. What you gave pays for the server
          that serves the text and the audio, and for the sources behind the scholarship: the
          critical commentaries, the manuscript studies and the recordings that every page cites.
        </p>
      </div>

      <nav aria-label="Where next" className="flex flex-col gap-2">
        {NEXT.map((w) => (
          <Link
            key={w.href}
            href={w.href}
            className="flex min-h-[var(--touch-target)] items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-hover)]"
          >
            <span className="font-serif text-[length:var(--text-md)] font-semibold text-[var(--color-ink)]">{w.label}</span>
            <span className="text-end font-sans text-[length:var(--text-xs)] text-[var(--color-ink-muted)]">{w.hint}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
