import { SUPPORT_URL } from "@/lib/support";

/** Secondary links stay after the page content, clear of the reading controls. */
export function SiteFooter() {
  return (
    <footer data-chrome className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 px-6 py-6 text-sm text-[var(--color-ink-muted)]">
      {SUPPORT_URL && (
        <a className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-[var(--color-ink)]" href="/support">
          Support Jot
        </a>
      )}
      <a className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-[var(--color-ink)]" href="https://lucascosolo.com" target="_blank" rel="noopener noreferrer">
        More projects
      </a>
      <a className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-[var(--color-ink)]" href="/api">
        Bible research API
      </a>
      <a className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-[var(--color-ink)]" href="/privacy">
        Privacy
      </a>
    </footer>
  );
}
