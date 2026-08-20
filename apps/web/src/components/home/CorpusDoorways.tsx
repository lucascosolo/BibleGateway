import Link from "next/link";
import { PassageRenderer } from "@/components/passage/PassageRenderer";
import type { HeatVerse } from "@/lib/db/corpus";
import { singleton } from "@/lib/refs/verse-id";

interface OmissionRow {
  verseId: number;
  osisRef: string;
  reason: string;
  omittedBy: string[];
  printedBy: { code: string; name: string } | undefined;
}

interface CorpusDoorwaysProps {
  translationId: number;
  topVerses: HeatVerse[];
  omissions: OmissionRow[];
  /**
   * Human references by verse id, formatted on the page that queried these rows.
   *
   * This used to be a three-line `osisRef.split(".")` here, justified as "cheap enough not to
   * need a full BookIndex just for display". It was not cheap enough: an OSIS id is an
   * *identifier*, and the book segment of one is not a book abbreviation. `1Pet`, `1Thess`,
   * `2Chr` and fourteen others carry no space, so the home page printed "1Pet 2:9" next to
   * "Isa 9:7" and "Titus 2:14", which is what a reviewer noticed.
   *
   * The formatting cannot happen in this file — components are barred from importing the corpus
   * accessors (AGENTS.md invariant #2), and the abbreviation lives in the corpus. So the page
   * formats through `formatRange`, the one function that turns an address into a reference, and
   * hands the result down. That also keeps these labels from drifting from the reference shown
   * anywhere else in the product.
   */
  references: ReadonlyMap<number, string>;
}

/**
 * Real entry points into the corpus, computed from the same tables the reader queries — never
 * an editorial guess at what's interesting. Two doorways: the most cross-referenced verses
 * (`verse_reference_heat`, built from OpenBible's vote-weighted graph) and the twelve verses a
 * critical-text translation omits (`verse_omissions`) — the single most legible piece of
 * textual criticism in the corpus, and the cheapest possible introduction to the idea that the
 * text has a transmission history at all.
 */
export function CorpusDoorways({
  translationId,
  topVerses,
  omissions,
  references,
}: CorpusDoorwaysProps) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Most cross-referenced verses">
        <h3 className="mb-3 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-ink-muted)]">
          Most cross-referenced verses
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {topVerses.map((v) => (
            <Link
              key={v.verseId}
              href={`/read/${v.osisRef}`}
              className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]"
            >
              <span className="font-sans text-[var(--text-xs)] font-medium text-[var(--color-ink-faint)]">
                {references.get(v.verseId) ?? v.osisRef} · cited by {v.inboundCount} other passages
              </span>
              <PassageRenderer
                verses={[v]}
                range={singleton(v.verseId)}
                density="preview"
                translationId={translationId}
                layerOverrides={{ notes: false, crossRefs: false, heat: false }}
              />
            </Link>
          ))}
        </div>
      </section>

      {omissions.length > 0 && (
        <section aria-label="Textual criticism: omitted verses">
          {/* Rewritten for someone who has never heard the words "critical text" or "Byzantine
              tradition". The old copy used both, plus "textual criticism", in three sentences —
              which meant the one place on the home page that explains why verse numbers
              sometimes jump was legible only to people who already knew. Nothing has been
              softened: the same facts are here, in words that do not need a glossary. */}
          <h3 className="mb-1 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-ink-muted)]">
            {omissions.length} verses that some Bibles leave out
          </h3>
          <p className="mb-3 font-serif text-[var(--text-sm)] italic text-[var(--color-ink-faint)]">
            The New Testament was copied by hand for centuries before printing, and the oldest
            copies that survive do not contain these {omissions.length} verses — they first appear
            in copies made later. Most modern Bibles therefore leave them out, which is why the
            verse numbers sometimes jump; the King James and Bibles in its line print them. Open
            one and you can read it either way.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {omissions.map((o) => {
              // `printedBy` is resolved in the query against the omission rows themselves. It
              // used to be "the first translation whose code differs from the omitting one",
              // which with five critical-text editions loaded usually named another edition that
              // omits the same verse — so the link offering to show you the verse landed on the
              // identical gap.
              const href = o.printedBy
                ? `/read/${o.osisRef}?t=${o.printedBy.code}`
                : `/read/${o.osisRef}`;
              return (
                <li key={o.verseId}>
                  <Link
                    href={href}
                    title={
                      o.printedBy
                        ? `${o.reason} Left out of ${o.omittedBy.join(", ")}; printed in ${o.printedBy.name}.`
                        : o.reason
                    }
                    className="inline-flex min-h-[var(--touch-target)] items-center rounded-[var(--radius-full)] border border-[var(--color-rubric)] bg-[var(--color-rubric-soft)] px-3 font-sans text-[var(--text-sm)] text-[var(--color-rubric-strong)] transition-opacity hover:opacity-85"
                  >
                    {references.get(o.verseId) ?? o.osisRef}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
