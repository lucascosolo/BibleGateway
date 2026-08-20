import type { GreekEditionVariant } from "@/lib/db/originals";

/** A compact, cited edition-comparison note for the Greek text. */
export function GreekEditionVariants({ rows }: { rows: readonly GreekEditionVariant[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="greek-edition-variants">
      <summary><span>Greek edition differences</span> <small>({rows.length} in this passage)</small></summary>
      <div className="greek-edition-variants__body">
        <p className="greek-edition-variants__intro">
          These notes compare published Greek editions; they are not a complete manuscript
          collation. The base reading is shown first, followed by the editions that print it.
        </p>
        <ol className="greek-edition-variants__list">
        {rows.map((row) => (
          <li key={row.variantId}>
            <span className="greek-edition-variants__ref">{row.sourceRef} · word {row.sourcePosition}</span>{" "}
            <span lang="grc">{row.baseSurface}</span> <span>({row.baseEditions})</span>
            {row.alternateSurface && (
              <>; alternate <span lang="grc">{row.alternateSurface}</span> ({row.alternateEditions ?? "edition not specified"})</>
            )}
            {row.note && <span className="greek-edition-variants__note"> — {row.note}</span>}
          </li>
        ))}
        </ol>
        <p className="greek-edition-variants__source">
          Source: <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer noopener">STEP Bible TAGNT</a>, CC BY 4.0.
        </p>
      </div>
    </details>
  );
}
