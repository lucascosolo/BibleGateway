import type { OmittedVerseNote } from "@/components/passage/OmittedVerse";
import { PassageRenderer, type PassageLayers } from "@/components/passage/PassageRenderer";
import type { Footnote } from "@/lib/db/apparatus";
import type { VerseText } from "@/lib/db/corpus";
import { chapterOf, verseOf, type VerseRange } from "@/lib/refs/verse-id";

export interface InvestigationEdition {
  translationId: number;
  code: string;
  name: string;
  copyrightNotice: string;
  verses: VerseText[];
  omissions: OmittedVerseNote[];
  footnotes: Footnote[];
  /** Set when the edition does not include this book at all; shown instead of a renderer. */
  scopeNote?: string;
}

/** Wording only: the comparison is the point, so every apparatus layer but the verse numbers is off. */
const WORDING_ONLY: Partial<PassageLayers> = {
  highlights: false,
  notes: false,
  crossRefs: false,
  heat: false,
  variants: false,
  sourceCrit: false,
  interlinear: false,
  insights: false,
  toledot: false,
};

/**
 * Every edition's wording of the passage, each through the one renderer, with the translator's own
 * notes nested under the text they annotate. Nested, not a sibling column: at a phone width the grid
 * stacks and a note stays beside its verse instead of drifting past every other edition.
 */
export function InvestigationEditions({ editions, range }: { editions: InvestigationEdition[]; range: VerseRange }) {
  return (
    <div className="toledot-edition-grid">
      {editions.map((e) => {
        const headingId = `edition-${e.code}`;
        return (
          <section key={e.translationId} className="toledot-edition" aria-labelledby={headingId}>
            <h3 id={headingId} className="toledot-edition__name">
              {e.name} <span className="toledot-edition__code">({e.code})</span>
            </h3>
            {e.scopeNote ? (
              <p className="toledot-edition__scope">{e.scopeNote}</p>
            ) : (
              <PassageRenderer
                verses={e.verses}
                range={range}
                translationId={e.translationId}
                omissions={e.omissions}
                density="panel"
                layerOverrides={WORDING_ONLY}
              />
            )}
            {e.footnotes.length ? (
              <ol className="toledot-edition__notes" aria-label={`${e.code} translator notes`}>
                {e.footnotes.map((f) => (
                  <li key={`${f.verseId}-${f.noteOrder}`}>
                    {f.caller ? <span className="toledot-edition__caller">{f.caller}</span> : null}
                    <span className="toledot-edition__locus">
                      {chapterOf(f.verseId)}:{verseOf(f.verseId)}
                    </span>{" "}
                    {f.text}
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="toledot-edition__copyright">{e.copyrightNotice}</p>
          </section>
        );
      })}
    </div>
  );
}
