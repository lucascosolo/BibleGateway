import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/Wordmark";
import { SUPPORT_URL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Support Jot",
  description: "Jot is free, with no ads, subscriptions or unlocks. A donation pays for the server and the scholarship behind it.",
};

const NEXT: { href: string; label: string; hint: string }[] = [
  { href: "/read/Gen.1", label: "Back to reading", hint: "Pick up where you left off, or start at Genesis 1" },
  { href: "/toledot", label: "Toledot", hint: "The timeline of the evidence your support keeps growing" },
  { href: "/roadmap", label: "What is next", hint: "The work planned for the coming releases" },
  { href: "/privacy", label: "Privacy", hint: "What Jot stores about you, and what it does not" },
];

export default function SupportPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Wordmark size="md" />
        <h1 className="font-serif text-[length:var(--text-xl)] text-[var(--color-ink)]">Support the work</h1>
      </header>

      <div className="flex flex-col gap-3 font-serif text-[length:var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
        {SUPPORT_URL ? (
          <>
            <p>Jot is free. It has no ads, no subscriptions and no unlocks, and the scholarship is the whole product.</p>
            <p>
              A donation pays for the server that serves the text and the audio, and for the sources
              behind the scholarship: the critical commentaries, the manuscript studies and the recordings.
            </p>
            <p>
              The PayPal form has a note field. Notes with suggestions are read, and they shape what
              gets built next.
            </p>
          </>
        ) : (
          <p>Support is not open in this build of Jot.</p>
        )}
      </div>

      {SUPPORT_URL && (
        <div>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[var(--touch-target)] items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-brand-strong)] px-6 font-sans text-[length:var(--text-md)] font-semibold text-on-accent transition-colors hover:opacity-90"
          >
            Donate with PayPal
          </a>
        </div>
      )}

      <nav aria-label="Ways back" className="flex flex-col gap-2">
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
