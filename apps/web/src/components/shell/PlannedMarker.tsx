/**
 * The "not built yet" affordance for a roadmap entry (ARCHITECTURE.md §6). Previously a small
 * red asterisk in the rubric/alert palette — which reads as an error or a notification badge,
 * exactly the wrong signal for "scheduled, not broken." Never colour alone, either way: the
 * badge carries its own visible text ("Soon") rather than relying on hue or a bare glyph, plus
 * a fuller string baked into the accessible name via a `sr-only` node — so a screen reader
 * announces "Toledot, Generations…, coming in Phase 2, not yet built" regardless of how the
 * badge is styled. The link itself still resolves to a real page that explains the gap; this is
 * the small mark that keeps the roadmap honest at a glance.
 */
export function PlannedMarker() {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-2 -top-1.5 flex h-3.5 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-1 font-sans text-[8px] font-semibold uppercase leading-none tracking-wide text-[var(--color-ink-muted)]"
    >
      Soon
    </span>
  );
}

export function plannedSrText(phase?: number): string {
  return phase ? ` — coming in Phase ${phase}, not yet built` : " — not yet built";
}
