"use client";

import Link from "next/link";
import { usePreferencesStore } from "@/lib/store/preferences";

/**
 * The last passage the reader was on, or nothing at all.
 *
 * `lastRead` lives in the same persisted preferences store as every other setting — no second
 * storage mechanism — so it survives reloads the same way theme and layer choices do. Renders
 * `null` on first paint (server default, matching the client's pre-rehydration state) and picks
 * up the real value once Zustand's `persist` middleware rehydrates from localStorage; that is
 * the same brief flash every other store-backed control in the shell already accepts.
 */
export function ContinueReading() {
  const lastRead = usePreferencesStore((s) => s.lastRead);
  if (!lastRead) return null;

  return (
    <Link
      href={`/read/${lastRead.slug}?t=${lastRead.translationCode}`}
      className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 transition-colors hover:bg-[var(--color-surface-hover)]"
    >
      <span className="flex flex-col">
        <span className="font-sans text-[var(--text-xs)] font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
          Continue reading
        </span>
        <span className="font-serif text-[var(--text-md)] text-[var(--color-ink)]">{lastRead.label}</span>
      </span>
      <span aria-hidden="true" className="font-sans text-[var(--text-lg)] text-[var(--color-brand)]">
        →
      </span>
    </Link>
  );
}
