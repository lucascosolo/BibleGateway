import type { OmittedVerseNote } from "@/components/passage/OmittedVerse";
import type { VerseText } from "@/lib/db/corpus";
import type { InvestigationDetail } from "@/lib/db/timeline";
import { getLexiconEntry } from "@/lib/lexicon";
import type { VerseRange } from "@/lib/refs/verse-id";
import { PassageRenderer } from "@/components/passage/PassageRenderer";

import { Citations } from "./Citations";
import { EntitySection, EntityShell } from "./EntityShell";

export interface InvestigationPassage {
  label: string;
  verses: VerseText[];
  range: VerseRange;
  translationId: number;
  omissions?: readonly OmittedVerseNote[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One passage's witnesses, the editions following each, the explanations and what argues against them. */
export function Investigation({ investigation: inv, passage }: { investigation: InvestigationDetail; passage: InvestigationPassage }) {
  const followed = inv.witnesses
    .map((w) => ({ witness: w, codes: inv.editions.filter((e) => e.follows === w.siglum).map((e) => e.code) }))
    .filter((group) => group.codes.length > 0);
  const lexeme = getLexiconEntry("investigation");

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

      <EntitySection title={passage.label}>
        <PassageRenderer
          verses={passage.verses}
          range={passage.range}
          translationId={passage.translationId}
          omissions={passage.omissions}
          density="panel"
          layerOverrides={{ toledot: false }}
        />
      </EntitySection>

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
