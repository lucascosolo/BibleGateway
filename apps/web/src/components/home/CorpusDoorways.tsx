import Link from "next/link";
import { PassageRenderer } from "@/components/passage/PassageRenderer";
import type { HeatVerse } from "@/lib/db/corpus";
import { singleton } from "@/lib/refs/verse-id";

interface OmissionRow {
  verseId: number;
  osisRef: string;
  kind: "critical-text" | "versification" | "coverage" | "unexplained";
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
  const critical = omissions.filter((o) => o.kind === "critical-text");
  const versification = omissions.filter((o) => o.kind === "versification");
  const unexplained = omissions.filter((o) => o.kind === "unexplained");
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Most cross-referenced verses">
        <h3 className="mb-3 font-sans text-[length:var(--text-sm)] font-semibold text-[var(--color-ink-muted)]">
          Most cross-referenced verses
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {topVerses.map((v) => (
            <Link prefetch={false}
              key={v.verseId}
              href={`/read/${v.osisRef}`}
              className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-3 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]"
            >
              <span className="font-sans text-[length:var(--text-xs)] font-medium text-[var(--color-ink-faint)]">
                {references.get(v.verseId) ?? v.osisRef} · linked from {v.inboundCount} other passages
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

      {critical.length > 0 && (
        <section aria-label="Textual criticism: omitted verses">
          {/* Rewritten for someone who has never heard the words "critical text" or "Byzantine
              tradition". Only rows the ingest classified as critical-text are counted here: a
              Septuagint numbering gap in Nehemiah is not a New Testament manuscript question. */}
          <h3 className={HEADING}>
            {critical.length} New Testament {plural(critical.length)} that some Bibles leave out
          </h3>
          <p className={NOTE}>
            The New Testament was copied by hand for centuries before printing, and the oldest
            copies that survive do not contain{" "}
            {critical.length === 1 ? "this verse" : `these ${critical.length} verses`} — they first
            appear in copies made later. Most modern Bibles therefore leave them out, which is why
            the verse numbers sometimes jump; the King James and Bibles in its line print them.
            Open one and you can read it either way.{" "}
            <Link href="/translations" className="underline underline-offset-2">
              How the translations on this site differ
            </Link>
          </p>
          <OmissionList rows={critical} references={references} accent />
        </section>
      )}

      {versification.length > 0 && (
        <section aria-label="Septuagint numbering differences">
          <h3 className={HEADING}>
            {versification.length} {plural(versification.length)} with a different numbering in
            Brenton&apos;s Septuagint
          </h3>
          <p className={NOTE}>
            The Septuagint divides some chapters differently from the Hebrew numbering this site
            uses for addresses, so these numbers have no counterpart in Brenton&apos;s edition.
            Nothing is missing from his translation, only from this numbering.
          </p>
          <OmissionList rows={versification} references={references} />
        </section>
      )}

      {unexplained.length > 0 && (
        <section aria-label="Unexplained gaps">
          <h3 className={HEADING}>Gaps the source data does not explain</h3>
          <p className={NOTE}>
            These verses are not printed in the editions named on each link, and the source data
            gives no reason. They are listed so the gap is visible, not hidden.
          </p>
          <OmissionList rows={unexplained} references={references} />
        </section>
      )}
    </div>
  );
}

const HEADING =
  "mb-1 font-sans text-[length:var(--text-sm)] font-semibold text-[var(--color-ink-muted)]";
const NOTE = "mb-3 font-serif text-[length:var(--text-sm)] italic text-[var(--color-ink-faint)]";

const plural = (n: number) => (n === 1 ? "verse" : "verses");

function OmissionList({
  rows,
  references,
  accent = false,
}: {
  rows: OmissionRow[];
  references: ReadonlyMap<number, string>;
  accent?: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rows.map((o) => {
        // `printedBy` is resolved in the query against the omission rows themselves, so the
        // link never lands on another edition that omits the same verse.
        const href = o.printedBy ? `/read/${o.osisRef}?t=${o.printedBy.code}` : `/read/${o.osisRef}`;
        return (
          <li key={o.verseId}>
            <Link prefetch={false}
              href={href}
              title={
                o.printedBy
                  ? `${o.reason} Left out of ${o.omittedBy.join(", ")}; printed in ${o.printedBy.name}.`
                  : o.reason
              }
              className={
                "inline-flex min-h-[var(--touch-target)] items-center rounded-[var(--radius-full)] border px-3 font-sans text-[length:var(--text-sm)] transition-opacity hover:opacity-85 " +
                (accent
                  ? "border-[var(--color-rubric)] bg-[var(--color-rubric-soft)] text-[var(--color-rubric-strong)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-raised)] text-[var(--color-ink-muted)]")
              }
            >
              {references.get(o.verseId) ?? o.osisRef}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
