import type { OmittedVerseNote } from "@/components/passage/OmittedVerse";
import type { VerseText } from "@/lib/db/corpus";
import type { GreekManuscriptReading, OriginalWord } from "@/lib/db/originals";
import type { InvestigationDetail } from "@/lib/db/timeline";
import { getLexiconEntry } from "@/lib/lexicon";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";
import { PassageRenderer } from "@/components/passage/PassageRenderer";

import { Citations } from "./Citations";
import { EntitySection, EntityShell } from "./EntityShell";
import { InvestigationEditions, type InvestigationEdition } from "./InvestigationEditions";

export interface InvestigationPassage {
  label: string;
  verses: VerseText[];
  range: VerseRange;
  translationId: number;
  omissions?: readonly OmittedVerseNote[];
}

interface InvestigationProps {
  investigation: InvestigationDetail;
  passage: InvestigationPassage;
  editions?: InvestigationEdition[];
  originals?: ReadonlyMap<VerseId, readonly OriginalWord[]>;
  manuscriptReadings?: readonly GreekManuscriptReading[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One passage's witnesses, the editions following each, the explanations and what argues against them. */
export function Investigation({ investigation: inv, passage, editions, originals, manuscriptReadings = [] }: InvestigationProps) {
  const followed = inv.witnesses
    .map((w) => ({ witness: w, codes: inv.editions.filter((e) => e.follows === w.siglum).map((e) => e.code) }))
    .filter((group) => group.codes.length > 0);
  const lexeme = getLexiconEntry("investigation");
  const hasOriginals = Boolean(originals?.size);
  const loci = groupLoci(manuscriptReadings);
  const sigla = new Map(inv.witnesses.map((w) => [w.siglum, w.name]));

  return (
    <EntityShell
      title={inv.title}
      status={inv.status}
      meta={
        <>
          <abbr title={lexeme.gloss}>{lexeme.term}</abbr> · {passage.label} · {plural(inv.witnessCount, "witness", "witnesses")} ·{" "}
          {plural(inv.differenceCount, "explanation", "explanations")}
        </>
      }
    >
      <p className="toledot-prose">{inv.summary}</p>

      {editions?.length ? (
        <>
          {/* Stacked on a phone, seven editions are a long scroll; the evidence after them stays one tap away. */}
          <nav aria-label="On this page" className="toledot-jump">
            <a href="#inv-witnesses">Witnesses</a>
            {loci.length ? <a href="#inv-readings">Manuscript readings</a> : null}
            <a href="#inv-explanations">Explanations</a>
          </nav>
          <EntitySection title="Each edition's wording">
            <InvestigationEditions editions={editions} range={passage.range} />
          </EntitySection>
        </>
      ) : null}

      <EntitySection title={hasOriginals ? "The original words" : passage.label}>
        <PassageRenderer
          verses={passage.verses}
          range={passage.range}
          translationId={passage.translationId}
          omissions={passage.omissions}
          density={hasOriginals ? "reader" : "panel"}
          interlinear={originals}
          layerOverrides={hasOriginals ? ORIGINALS_ONLY : { toledot: false }}
        />
      </EntitySection>

      {loci.length ? (
        <div id="inv-readings" className="toledot-anchor">
        <EntitySection title="Manuscript readings">
          <p className="toledot-gloss">
            A selected apparatus of Greek readings and the witnesses that support them; the first reading is the
            SBLGNT base text. Sigla this investigation discusses are named in place. Not a complete census of
            every manuscript.
          </p>
          <ol className="toledot-readings">
            {loci.map((locus) => (
              <li key={locus.sourceRef}>
                <h3 className="toledot-readings__locus">{locus.sourceRef}</h3>
                <ul>
                  {locus.readings.map((r) => (
                    <li key={r.readingOrder} className="toledot-readings__reading">
                      <span lang="grc" className="toledot-readings__text">{r.readingText}</span>{" "}
                      <span className="toledot-readings__witnesses">{expandSigla(r.witnesses, sigla)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="toledot-gloss">
            Source:{" "}
            <a href="https://crosswire.org/sword/modules/ModInfo.jsp?modName=VarApp" target="_blank" rel="noreferrer noopener">
              CrossWire VarApp
            </a>
            , CC0.
          </p>
        </EntitySection>
        </div>
      ) : null}

      <div id="inv-witnesses" className="toledot-anchor">
      <EntitySection title="What the witnesses read">
        <div className="toledot-witnesses">
          <table>
            <thead>
              <tr>
                <th scope="col">Siglum</th>
                <th scope="col">Witness</th>
                <th scope="col">Reading</th>
                <th scope="col">Translation</th>
              </tr>
            </thead>
            <tbody>
              {inv.witnesses.map((w) => (
                <tr key={w.id}>
                  <th scope="row">{w.siglum}</th>
                  <td>
                    {w.name}
                    {w.note ? <p className="toledot-witnesses__note">{w.note}</p> : null}
                    <Citations citations={w.citations} />
                  </td>
                  <td lang={w.language} className="toledot-witnesses__reading">{w.reading}</td>
                  <td>{w.translation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EntitySection>
      </div>

      {followed.length ? (
        <EntitySection title="Which editions follow which witness">
          <ul className="toledot-editions">
            {followed.map(({ witness, codes }) => (
              <li key={witness.id}>
                <span className="toledot-editions__witness">{witness.siglum}</span> ({witness.name}): {codes.join(", ")}
              </li>
            ))}
          </ul>
        </EntitySection>
      ) : null}

      <div id="inv-explanations" className="toledot-anchor">
      <EntitySection title="Explanations">
        <ol className="toledot-positions">
          {inv.differences.map((d) => {
            const kind = getLexiconEntry(`difference-${d.kind}`);
            return (
              <li key={d.id} className="toledot-position">
                <h3 className="toledot-position__label">{kind.term}</h3>
                <p className="toledot-gloss">{kind.gloss}</p>
                <p className="toledot-prose">{d.text}</p>
                {d.heldBy ? <p className="toledot-position__held">Held by {d.heldBy}</p> : null}
                <Citations citations={d.citations} />
              </li>
            );
          })}
        </ol>
      </EntitySection>
      </div>

      {inv.challenges.length ? (
        <EntitySection title="Challenges">
          <ol className="toledot-positions">
            {inv.challenges.map((c) => (
              <li key={c.id} className="toledot-position">
                <p className="toledot-prose">{c.text}</p>
                <Citations citations={c.citations} />
              </li>
            ))}
          </ol>
        </EntitySection>
      ) : null}
    </EntityShell>
  );
}

/** The original-language words under the first edition, and nothing else layered on. */
const ORIGINALS_ONLY = {
  interlinear: true,
  highlights: false,
  notes: false,
  crossRefs: false,
  heat: false,
  variants: false,
  sourceCrit: false,
  insights: false,
  toledot: false,
};

/** VarApp repeats a locus under every verse it spans; one entry per locus and reading. */
function groupLoci(rows: readonly GreekManuscriptReading[]) {
  const loci = new Map<string, Map<number, GreekManuscriptReading>>();
  for (const row of rows) {
    const readings = loci.get(row.sourceRef) ?? new Map<number, GreekManuscriptReading>();
    if (!readings.has(row.readingOrder)) readings.set(row.readingOrder, row);
    loci.set(row.sourceRef, readings);
  }
  return [...loci].map(([sourceRef, readings]) => ({ sourceRef, readings: [...readings.values()] }));
}

/**
 * Names a siglum only where this investigation's own witness list does. The general VarApp siglum
 * table is deferred; guessing the rest would put an unchecked identification beside the evidence.
 */
function expandSigla(witnesses: string, sigla: ReadonlyMap<string, string>) {
  return witnesses.split(/(\s+)/).map((token, i) => {
    const core = token.replace(/^\(+|\)+$/g, "");
    const name = sigla.get(core);
    if (!name) return token;
    const at = token.indexOf(core);
    return (
      <span key={i}>
        {token.slice(0, at)}
        <abbr title={name}>{core}</abbr> <span className="toledot-readings__name">({name})</span>
        {token.slice(at + core.length)}
      </span>
    );
  });
}
