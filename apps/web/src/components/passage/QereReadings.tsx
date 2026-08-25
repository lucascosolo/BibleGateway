"use client";

import Link from "next/link";
import clsx from "clsx";

import type { OriginalVariant, OriginalWord } from "@/lib/db/originals";
import { parseMorphology } from "@/lib/morphology";
import { GlossLabel } from "@/components/GlossLabel";

/**
 * The scribes' own marginal readings, rendered under the verse they annotate.
 *
 * Lives in `components/passage/` because it is part of THE renderer (AGENTS.md invariant #2),
 * exactly like `Interlinear.tsx` and `OmittedVerse.tsx`: mounted by `<PassageRenderer>` beneath
 * the verse it belongs to, under the same `variants` layer that already governs the omission
 * apparatus, not a second surface with its own rules.
 *
 * The WLC (the Hebrew source this corpus ingests) keeps two things for each of these: the word
 * as it stands written in the running text, and the word the tradition says to say instead,
 * recorded beside it. `position` is the 1-based index of the running-text word a reading
 * attaches to, and that word — bare consonants, no vowels, because the vowels belong to the
 * reading — IS the written form. More than one reading can attach to one written word (Genesis
 * 30:11: one written word, two words to say instead), so grouping by position is not optional:
 * one written form, one or more spoken ones.
 *
 * The written-word text comes from two places, in order: the corpus's own `catchWord` when it
 * has one, and otherwise the interlinear word at the same position — passed in as `words` so
 * this component never queries the corpus itself (invariant #2 again: a component that did
 * would be the second renderer it exists to prevent).
 *
 * Presentation, not data: the plain-English headline and the written-vs-said layout below are
 * what changed here. The morphology, lemma and concordance link a researcher wants are still
 * exactly one click away, behind `<details>` per reading — collapsed by default, so a reader who
 * has never heard of Qere/Kethiv sees two Hebrew words and a plain sentence, not a grid.
 */

export interface QereReadingsProps {
  variants: readonly OriginalVariant[];
  words: readonly OriginalWord[];
  className?: string;
}

const RTL_LANGUAGES = new Set(["hbo", "arc"]);

/** "1" -> "1st", "14" -> "14th". English ordinal suffix, not a translation concern — every
 *  reading here is Hebrew, but the sentence naming its position is plain English. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

interface Group {
  position: number;
  readings: OriginalVariant[];
}

/** Groups preserve first-seen order, which is already `position` order — the query that
 *  produced `variants` sorts by it. */
function groupByPosition(variants: readonly OriginalVariant[]): Group[] {
  const order: number[] = [];
  const byPosition = new Map<number, OriginalVariant[]>();
  for (const v of variants) {
    let bucket = byPosition.get(v.position);
    if (!bucket) {
      bucket = [];
      byPosition.set(v.position, bucket);
      order.push(v.position);
    }
    bucket.push(v);
  }
  return order.map((position) => ({ position, readings: byPosition.get(position)! }));
}

/** The written form for a group: the corpus's own record of it where there is one, else the
 *  running-text word at the same position, else null — the source simply gives no written form
 *  beside this reading, and that is disclosed rather than papered over with the qere alone. */
function ketivFor(group: Group, words: readonly OriginalWord[]): string | null {
  const recorded = group.readings.find((v) => v.catchWord)?.catchWord;
  if (recorded) return recorded;
  return words.find((w) => w.position === group.position)?.surface ?? null;
}

export function QereReadings({ variants, words, className }: QereReadingsProps) {
  if (variants.length === 0) return null;

  const groups = groupByPosition(variants);
  const language = variants[0].language;
  const rtl = RTL_LANGUAGES.has(language);

  return (
    <div className={clsx("qere-readings", className)} data-language={language}>
      <p className="qere-readings__intro">
        Here the Hebrew is written one way but was traditionally read aloud another way.{" "}
        <GlossLabel id="qereKethiv" className="qere-readings__term" /> is the scribes&rsquo; own
        name for this — the oldest reader&rsquo;s notes in the Bible.
      </p>

      <ul className="qere-readings__list">
        {groups.map((group) => {
          const ketiv = ketivFor(group, words);
          return (
            <li key={group.position} className="qere-readings__item">
              <p className="qere-readings__position">
                {group.position > 0
                  ? `At the ${ordinal(group.position)} word of the Hebrew`
                  : "Before the first word of the Hebrew"}
              </p>

              <div className="qere-readings__flow">
                <div className="qere-readings__side qere-readings__side--ketiv">
                  <span className="qere-readings__tag">Written</span>
                  {ketiv ? (
                    <span className="qere-readings__word" lang={language} dir={rtl ? "rtl" : "ltr"}>
                      {ketiv}
                    </span>
                  ) : (
                    <span className="qere-readings__word--missing">
                      no written form is recorded beside it
                    </span>
                  )}
                </div>

                <span className="qere-readings__arrow" aria-hidden="true">
                  →
                </span>

                <div className="qere-readings__side qere-readings__side--qere">
                  <span className="qere-readings__tag">Say instead</span>
                  <ul className="qere-readings__words">
                    {group.readings.map((v) => {
                      const parsed = parseMorphology(v.morph, v.language);
                      const concordanceKey = v.strongs ?? v.lemma;
                      return (
                        <li key={v.variantId} className="qere-readings__reading">
                          <span
                            className="qere-readings__word"
                            lang={v.language}
                            dir={RTL_LANGUAGES.has(v.language) ? "rtl" : "ltr"}
                          >
                            {v.surface}
                          </span>
                          {v.gloss && (
                            <span className="qere-readings__plain">&ldquo;{v.gloss}&rdquo;</span>
                          )}

                          <details className="qere-readings__details">
                            <summary>Word details</summary>
                            <dl className="qere-readings__detail-list">
                              <div>
                                <dt>Lemma</dt>
                                <dd lang={v.language}>{v.headword ?? v.lemma}</dd>
                              </div>
                              {v.xlit && (
                                <div>
                                  <dt>Transliteration</dt>
                                  <dd>{v.xlit}</dd>
                                </div>
                              )}
                              <div>
                                <dt>Morphology</dt>
                                <dd>{parsed.label}</dd>
                              </div>
                            </dl>
                            <Link
                              href={`/lashon/${encodeURIComponent(concordanceKey)}`}
                              className="qere-readings__link"
                            >
                              Every other place this word occurs →
                            </Link>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
