import Link from "next/link";

import { SUPPORT_URL } from "@/lib/support";

/** A quiet pointer to /support. The link is the whole card; the donation button lives on the page it opens. */
export function SupportCard() {
  if (!SUPPORT_URL) return null;
  return (
    <Link
      href="/support"
      className="flex min-h-[var(--touch-target)] flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-hover)]"
    >
      <span className="font-serif text-[length:var(--text-md)] font-semibold text-[var(--color-ink)]">Support Jot</span>
      <span className="font-sans text-[length:var(--text-sm)] text-[var(--color-ink-muted)]">
        Free, no ads, no subscriptions. A donation keeps the server running and the sources coming.
      </span>
    </Link>
  );
}
