import Link from "next/link";
import { GlossLabel } from "@/components/GlossLabel";
import type { LexiconId } from "@/lib/lexicon";

interface RoadmapPageProps {
  lexiconId: LexiconId;
  /** Phase from ARCHITECTURE.md §6 this workspace ships in. */
  phase: number;
  phaseTitle: string;
  /** What real datasets will eventually back this workspace — never invented, always ARCHITECTURE.md §2. */
  dataSources: string[];
  /** The nearest thing that works today, if anything genuinely does. */
  today?: { href: string; label: string; description: string };
}

/**
 * The page a Toledot/Geniza/Massa'ot nav link resolves to today.
 *
 * The brief for this: never a dead link, and never silent about the gap. A researcher who
 * clicks "Toledot" gets told plainly this is Phase 2, what data will eventually drive it, and
 * — where one genuinely exists — the nearest thing in the app that does today's version of
 * that job.
 */
export function RoadmapPage({ lexiconId, phase, phaseTitle, dataSources, today }: RoadmapPageProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <div>
        <p className="mb-1 font-sans text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-rubric-strong)]">
          Not built yet — Phase {phase}
        </p>
        <h1 className="font-serif text-[var(--text-2xl)] text-[var(--color-ink)]">
          <GlossLabel id={lexiconId} as="strong" />
        </h1>
      </div>

      <p className="font-serif text-[var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
        This workspace is scheduled for <strong>Phase {phase} — {phaseTitle}</strong> of the build
        (see <code className="font-mono text-[var(--text-sm)]">ARCHITECTURE.md</code> §6). The
        feature itself does not exist yet — no data behind it, nothing to browse — this page is
        what stands in its place so a link to it goes somewhere honest instead of nowhere.
      </p>

      <div>
        <h2 className="mb-2 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-ink-muted)]">
          What will back it
        </h2>
        <ul className="flex flex-col gap-1.5 font-sans text-[var(--text-sm)] text-[var(--color-ink)]">
          {dataSources.map((source) => (
            <li key={source} className="flex gap-2">
              <span aria-hidden="true" className="text-[var(--color-brand)]">
                —
              </span>
              {source}
            </li>
          ))}
        </ul>
      </div>

      {today ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-4">
          <h2 className="mb-1 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-ink-muted)]">
            Closest thing that works today
          </h2>
          <p className="mb-3 font-sans text-[var(--text-sm)] text-[var(--color-ink-faint)]">
            {today.description}
          </p>
          <Link
            href={today.href}
            className="inline-flex h-11 items-center rounded-[var(--radius-full)] bg-[var(--color-brand-strong)] px-5 font-sans text-[var(--text-sm)] font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            {today.label} →
          </Link>
        </div>
      ) : (
        <p className="font-sans text-[var(--text-sm)] italic text-[var(--color-ink-faint)]">
          Nothing in the app today does even a reduced version of this job — the reader and search
          are the whole product until this phase lands.
        </p>
      )}

      {/* See the note on the same link in app/roadmap/page.tsx — a standalone back link is a
          navigation control, not inline prose, so it carries a real 44px target. */}
      <Link
        href="/"
        className="inline-flex min-h-[var(--touch-target)] items-center self-start font-sans text-[var(--text-sm)] text-[var(--color-brand)] underline underline-offset-4"
      >
        ← Back to Jot
      </Link>
    </div>
  );
}
