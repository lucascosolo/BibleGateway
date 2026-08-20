import type { Translation } from "@/lib/db/corpus";

interface CorpusFactsProps {
  translations: Translation[];
  verseCount: number;
  crossReferenceCount: number;
}

/**
 * What is actually loaded, stated plainly — a scholarly tool earns trust by never implying
 * data it doesn't have. Every number here is a live query result (see the callers in
 * `page.tsx`), not a marketing figure.
 */
export function CorpusFacts({ translations, verseCount, crossReferenceCount }: CorpusFactsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">Verses</dt>
          <dd className="font-serif text-[var(--text-lg)] text-[var(--color-ink)]">
            {verseCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">Cross-references</dt>
          <dd className="font-serif text-[var(--text-lg)] text-[var(--color-ink)]">
            {crossReferenceCount.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">Translations</dt>
          <dd className="font-serif text-[var(--text-lg)] text-[var(--color-ink)]">{translations.length}</dd>
        </div>
      </dl>
      <p className="font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">
        Loaded today:{" "}
        {translations.map((t, i) => (
          <span key={t.code}>
            {i > 0 && ", "}
            <strong className="font-medium text-[var(--color-ink-muted)]">{t.name}</strong> ({t.code})
          </span>
        ))}
        . Every other translation named elsewhere in this app is on the roadmap, not yet ingested.
      </p>
    </div>
  );
}
