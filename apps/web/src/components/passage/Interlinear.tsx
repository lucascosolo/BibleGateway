"use client";

import Link from "next/link";
import clsx from "clsx";

import type { OriginalWord } from "@/lib/db/originals";
import type { WordClip } from "@/lib/db/audio";
import { parseMorphology } from "@/lib/morphology";
import { useAudioStore } from "@/lib/store/audio";
import { SpeakerIcon } from "@/components/audio/icons";

/**
 * The original-language words under one verse.
 *
 * Lives inside `components/passage/` because it is part of THE renderer (AGENTS.md invariant
 * #2), not a separate surface: it is mounted by `<PassageRenderer>` beneath the verse it
 * belongs to, under the same layer system, so an interlinear in the reader and an interlinear
 * anywhere else are the same component under the same toggle.
 *
 * **Direction is per-word, not per-page.** Hebrew and Aramaic read right-to-left and Greek reads
 * left-to-right, and a verse's words must appear in the order the source has them. Setting `dir`
 * on the row from the words' own language is the difference between an interlinear a Hebraist
 * can read and one that silently presents every verse backwards — which is a mistake that looks
 * fine to anyone who cannot read the script, i.e. to everyone who would be testing it.
 */

export interface InterlinearProps {
  words: readonly OriginalWord[];
  /**
   * The source's reference for this verse where it differs from the canonical one.
   *
   * Shown rather than hidden: seventy canonical verses are assembled from two Hebrew verses
   * (the Hebrew numbers a psalm superscription English leaves unnumbered), and the Hebrew
   * numbering is the address a commentary or critical edition cites. A reader comparing against
   * BHS needs to see that this canonical verse is Hebrew 51:2-3.
   */
  showSourceRefs?: boolean;
  /**
   * Where a human reader says each word, keyed by `word_id` — from the audio artifact, via the
   * server page. A word with a clip gets a speaker button; a word without one gets nothing,
   * which today is every Greek word (no openly licensed Greek reading exists) and the third of
   * the Hebrew Bible the Be'eri recording does not cover. Absent means no buttons at all.
   */
  wordClips?: ReadonlyMap<number, WordClip>;
  className?: string;
}

const RTL_LANGUAGES = new Set(["hbo", "arc"]);

export function Interlinear({ words, showSourceRefs = true, wordClips, className }: InterlinearProps) {
  if (words.length === 0) return null;

  const rtl = RTL_LANGUAGES.has(words[0].language);

  // Which source verses this canonical verse was assembled from. One is the ordinary case and
  // needs no annotation; more than one is worth showing.
  const sourceRefs = [...new Set(words.map((w) => w.sourceRef))];
  const merged = sourceRefs.length > 1;

  return (
    <div className={clsx("interlinear", className)} data-language={words[0].language}>
      {showSourceRefs && merged && (
        <p className="interlinear__note">
          Assembled from {sourceRefs.join(" + ")} in the source, which divides these verses
          differently from the English numbering.
        </p>
      )}
      <ol className="interlinear__row" dir={rtl ? "rtl" : "ltr"}>
        {words.map((word) => {
          const parsed = parseMorphology(word.morph, word.language);
          // Strong's number where the source carries one (Hebrew), lemma otherwise (Greek).
          const concordanceKey = word.strongs ?? word.lemma;
          const clip = wordClips?.get(word.wordId);
          return (
            <li key={word.wordId} className="interlinear__word">
              {clip && <SpeakWordButton clip={clip} surface={word.surface.replace(/\//g, "")} />}
              <Link prefetch={false}
                href={`/lashon/${encodeURIComponent(concordanceKey)}`}
                className="interlinear__link"
                // The full parsing, for pointer and keyboard users alike. The visible line
                // below carries only the head, or the row becomes unreadable.
                title={[
                  word.headword ?? word.lemma,
                  word.xlit || null,
                  word.gloss || null,
                  word.definition || null,
                  parsed.label,
                  // The raw OSIS lemma, kept reachable rather than shown: `c/d/776` is the
                  // morpheme analysis of the word (conjunction + article + root), which is real
                  // information a Hebraist wants and nobody else can read.
                  word.headword && word.lemma !== word.headword ? `lemma ${word.lemma}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <span
                  className="interlinear__surface"
                  lang={word.language}
                  // The script's own direction, independent of the row: a Greek quotation inside
                  // a Hebrew verse must still read left-to-right.
                  dir={RTL_LANGUAGES.has(word.language) ? "rtl" : "ltr"}
                >
                  {word.surface}
                </span>
                {/* The dictionary form. For Hebrew this is the joined lexicon headword, because
                    `lemma` there is the raw OSIS attribute (`b/2617 a`) and means nothing to a
                    reader; for Greek `lemma` IS the headword and there is no lexicon entry. */}
                <span className="interlinear__lemma" lang={word.language}>
                  {word.headword ?? word.lemma}
                </span>
                {/* One English word, not a definition. The interlinear's job is to let you see
                    which Hebrew word the translator was rendering, and a gloss long enough to
                    argue with would make the row unreadable and would also be doing the reading
                    for you. The full entry is one click away on the word's own page. */}
                {word.gloss && <span className="interlinear__gloss">{word.gloss}</span>}
                <span className="interlinear__morph">{parsed.segments.at(-1)?.parts[0] ?? ""}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Plays the slice of the chapter recording in which the reader says this word — in its verse,
 * in context, not a dictionary form. A sibling of the word's link rather than a child: a
 * button inside an anchor is invalid markup and a keyboard user could reach neither cleanly.
 */
function SpeakWordButton({ clip, surface }: { clip: WordClip; surface: string }) {
  const send = useAudioStore((s) => s.send);
  return (
    <button
      type="button"
      className="interlinear__speak"
      onClick={() => send({ kind: "clip", url: clip.url, startMs: clip.startMs, endMs: clip.endMs })}
      aria-label={`Hear ${surface}`}
      title="Hear this word"
    >
      <SpeakerIcon className="interlinear__speak-icon" />
    </button>
  );
}
