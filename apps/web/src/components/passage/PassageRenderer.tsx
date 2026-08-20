"use client";

import clsx from "clsx";
import { Fragment, useMemo } from "react";

import type { VerseText } from "@/lib/db/corpus";
import type {
  GreekEditionVariant,
  GreekManuscriptReading,
  OriginalVariant,
  OriginalWord,
} from "@/lib/db/originals";
import {
  CHAPTER_FACTOR,
  bookOf,
  chapterOf,
  type VerseId,
  type VerseRange,
} from "@/lib/refs/verse-id";
import { usePreferencesStore } from "@/lib/store/preferences";
import { Interlinear } from "./Interlinear";
import { OmittedVerse, type OmittedVerseNote } from "./OmittedVerse";
import { QereReadings } from "./QereReadings";
import { GreekEditionVariants } from "./GreekEditionVariants";
import { GreekManuscriptApparatus } from "./GreekManuscriptApparatus";
import { Verse } from "./Verse";

/**
 * THE scripture rendering component.
 *
 * There is exactly one of these. A hover tooltip, a cross-reference side panel, a timeline
 * modal and the full-screen reader are all this component with different props and a
 * different CSS shell around it. There is no "simple" variant for tooltips — the moment a
 * second renderer exists, universal persistence stops being free and starts being something
 * a human has to maintain in two places.
 *
 * Enforced by lint: `no-restricted-imports` in `eslint.config.mjs` stops anything outside
 * `components/passage/` from importing the decoration pipeline or mounting `Verse` directly,
 * and `sync-and-build.sh` runs eslint as a build gate (`next build` does not).
 *
 * `density` is SEMANTIC INTENT — how much apparatus belongs here. Physical fit is handled
 * separately by container queries in globals.css, because this component renders at 320px in
 * a bottom sheet and 900px in a reading column *within the same viewport*. Conflating the two
 * is what forces teams into a second renderer.
 */

export type PassageDensity = "tooltip" | "preview" | "panel" | "reader";

export interface PassageLayers {
  verseNumbers: boolean;
  highlights: boolean;
  notes: boolean;
  crossRefs: boolean;
  heat: boolean;
  variants: boolean;
  sourceCrit: boolean;
  interlinear: boolean;
}

/** Which layers each density is even allowed to show, before user preferences apply. */
const DENSITY_LAYER_CEILING: Record<PassageDensity, (keyof PassageLayers)[]> = {
  // A tooltip is a glance. Apparatus in it is noise, and there is no room to act on it.
  tooltip: ["highlights"],
  preview: ["highlights", "verseNumbers"],
  panel: ["highlights", "verseNumbers", "notes", "crossRefs", "heat"],
  // `interlinear` is reader-only. It is a stacked cell per word, so at panel width it wraps
  // into an unreadable column and at preview or tooltip width it would dwarf the verse it is
  // supposed to be annotating.
  reader: [
    "highlights",
    "verseNumbers",
    "notes",
    "crossRefs",
    "heat",
    "variants",
    "sourceCrit",
    "interlinear",
  ],
};

export type PassageItem =
  | { kind: "verse"; verse: VerseText }
  | { kind: "omission"; note: OmittedVerseNote }
  | { kind: "chapter"; bookId: number; chapter: number; verseId: number };

/** The BBCCC prefix of an item's address — its chapter, as a comparable number. */
function chapterKeyOf(item: PassageItem): number {
  const id =
    item.kind === "verse"
      ? item.verse.verseId
      : item.kind === "omission"
        ? item.note.verseId
        : item.verseId;
  return Math.floor(id / CHAPTER_FACTOR);
}

/**
 * Mark where each chapter begins in a multi-chapter stream.
 *
 * Verse numbers restart at every chapter. Rendered as one continuous column with nothing
 * between them, a reader sees "…30, 31, 1, 2…" and has no way to tell a chapter boundary from
 * a rendering fault — which is what made the old whole-book page unreadable quite apart from
 * its size.
 *
 * A single-chapter stream gets nothing: the page heading already names the chapter, and a
 * duplicate of it above the first verse is noise.
 *
 * Exported for direct testing, like `mergePassageItems`, for the same reason: a heading in the
 * wrong place misattributes scripture.
 */
export function insertChapterHeadings(items: readonly PassageItem[]): PassageItem[] {
  if (items.length === 0) return [];
  const chapters = new Set(items.map(chapterKeyOf));
  if (chapters.size < 2) return [...items];

  const out: PassageItem[] = [];
  let current = -1;
  for (const item of items) {
    const key = chapterKeyOf(item);
    if (key !== current) {
      current = key;
      const id = (key * CHAPTER_FACTOR + 1) as VerseId;
      out.push({ kind: "chapter", bookId: bookOf(id), chapter: chapterOf(id), verseId: id });
    }
    out.push(item);
  }
  return out;
}

/**
 * Merges printed verses and recorded omissions into one verse-id-ordered stream.
 *
 * Exported so it can be tested directly: getting this wrong puts an apparatus note in the
 * wrong place in scripture, which is worse than not showing it at all. Both inputs arrive
 * sorted by verse id (the queries order by it), so this is a linear merge rather than a
 * concatenate-and-sort — and an omission whose id falls past every printed verse still lands,
 * which is the case that a naive loop drops.
 */
export function mergePassageItems(
  verses: readonly VerseText[],
  omissions: readonly OmittedVerseNote[] | undefined,
): PassageItem[] {
  if (!omissions || omissions.length === 0) {
    return verses.map((verse) => ({ kind: "verse", verse }));
  }

  const merged: PassageItem[] = [];
  let o = 0;
  for (const verse of verses) {
    while (o < omissions.length && omissions[o].verseId < verse.verseId) {
      merged.push({ kind: "omission", note: omissions[o++] });
    }
    merged.push({ kind: "verse", verse });
  }
  while (o < omissions.length) merged.push({ kind: "omission", note: omissions[o++] });
  return merged;
}

export interface PassageRendererProps {
  verses: VerseText[];
  range: VerseRange;
  density?: PassageDensity;
  translationId: number;
  /** Override the user's layer preferences — used by previews that must stay clean. */
  layerOverrides?: Partial<PassageLayers>;
  /** Called when a verse reference is activated, for navigation between linked passages. */
  onNavigate?: (range: VerseRange) => void;
  /**
   * Verses this translation declines to print, interleaved into the text by verse id.
   *
   * These belong to the renderer rather than to a sidebar because an omission is a fact
   * *about this position in the text* — rendered anywhere else, it stops explaining the gap
   * it exists to explain.
   */
  omissions?: readonly OmittedVerseNote[];
  /** Passage slug of the current view, so an omission can link to a translation that prints it. */
  passageSlug?: string;
  /**
   * Book names by book id, for chapter headings in a multi-chapter passage.
   *
   * A plain record rather than the `BookIndex`: this is a client component and the canon
   * lookup is a server-only module, so the reader passes down only the handful of names the
   * rendered range can possibly need.
   */
  bookLabels?: Readonly<Record<number, string>>;
  /**
   * Character ranges to mark as decoration kind `"search-hit"`, keyed by verse id.
   *
   * This is how Derash (`/derash`) marks matched terms — through this component's own
   * decoration pipeline rather than a second, regex-based highlighter, so a search hit
   * composes correctly with an overlapping highlight or note exactly like every other
   * decoration kind does. Plain `{start,end}` rather than the FTS5-flavored offset type, so
   * this component has no dependency on how the ranges were produced.
   */
  searchHighlights?: ReadonlyMap<VerseId, readonly { start: number; end: number }[]>;
  /**
   * Original-language words keyed by canonical verse id, for the interlinear layer.
   *
   * Supplied by the server page rather than fetched here, exactly like `verses` — the corpus is
   * a server-only module, and a component that queried it would be the second renderer
   * invariant #2 exists to prevent. Absent simply means the layer renders nothing, so a surface
   * that has no use for an interlinear pays nothing for its existence.
   */
  interlinear?: ReadonlyMap<VerseId, readonly OriginalWord[]>;
  /**
   * The scribes' marginal readings (qere), keyed by canonical verse id, for the reading shown
   * under the `variants` layer.
   *
   * Supplied by the server page rather than fetched here, exactly like `interlinear` — the
   * corpus is a server-only module, and a component that queried it would be the second
   * renderer invariant #2 exists to prevent. Absent simply means the layer renders nothing.
   */
  variants?: ReadonlyMap<VerseId, readonly OriginalVariant[]>;
  /** Edition-level Greek differences, supplied by the server page and rendered in this surface. */
  greekEditionVariants?: readonly GreekEditionVariant[];
  greekManuscriptReadings?: readonly GreekManuscriptReading[];
  className?: string;
}

export function PassageRenderer({
  verses,
  range,
  density = "reader",
  translationId,
  layerOverrides,
  onNavigate,
  omissions,
  passageSlug,
  bookLabels,
  searchHighlights,
  interlinear,
  variants,
  greekEditionVariants,
  greekManuscriptReadings,
  className,
}: PassageRendererProps) {
  // Selected narrowly rather than taking the whole store, so an unrelated preference change
  // (theme, tradition) does not re-render every mounted verse.
  const layerPrefs = usePreferencesStore((s) => s.layers);
  const selahMode = usePreferencesStore((s) => s.selahMode);

  const layers = useMemo<PassageLayers>(() => {
    const ceiling = new Set(DENSITY_LAYER_CEILING[density]);
    const base: PassageLayers = {
      verseNumbers: layerPrefs.verseNumbers,
      highlights: layerPrefs.highlights,
      notes: layerPrefs.notes,
      crossRefs: layerPrefs.crossRefs,
      heat: layerPrefs.heat,
      variants: layerPrefs.variants,
      sourceCrit: layerPrefs.sourceCrit,
      interlinear: layerPrefs.interlinear,
      ...layerOverrides,
    };
    // Selah mode ("pause and reflect") strips everything for uninterrupted reading.
    if (selahMode) {
      return {
        verseNumbers: false,
        highlights: false,
        notes: false,
        crossRefs: false,
        heat: false,
        variants: false,
        sourceCrit: false,
        interlinear: false,
      };
    }
    // A density can only *reduce* what the user asked for, never add to it.
    for (const key of Object.keys(base) as (keyof PassageLayers)[]) {
      if (!ceiling.has(key)) base[key] = false;
    }
    return base;
  }, [density, layerOverrides, layerPrefs, selahMode]);

  const items = useMemo(() => {
    const block = density === "reader" || density === "panel";
    const merged = mergePassageItems(
      verses,
      // Omissions are only shown where there is room to explain them: at tooltip and
      // preview density a bare "not printed here" is a puzzle rather than apparatus, and
      // Selah mode exists to strip every editorial voice from the page.
      !selahMode && block ? omissions : undefined,
    );
    // Headings are structure, not apparatus, so Selah mode keeps them: uninterrupted reading
    // still needs to know which chapter it is in. Inline densities are a single running
    // sentence and have nowhere to put one.
    return block ? insertChapterHeadings(merged) : merged;
  }, [verses, omissions, density, selahMode]);

  // Keyed on the merged stream, not on `verses`: a range whose every verse this translation
  // declines to print still has apparatus to render, and 404ing it was the bug that made
  // switching translation on John 5:4 lose the reader's place. An empty *stream* is the only
  // genuine "nothing here".
  if (items.length === 0) {
    return (
      <p className={clsx("passage passage--empty", className)} data-density={density}>
        No text found for this passage.
      </p>
    );
  }

  return (
    <div
      // `container-type: inline-size` is set on `.passage` so the layout below responds to
      // this element's own width rather than the viewport's.
      className={clsx("passage", `passage--${density}`, className)}
      data-density={density}
      data-selah={selahMode ? "true" : undefined}
    >
      {items.map((item) =>
        item.kind === "chapter" ? (
          <h2
            key={`chapter-${item.verseId}`}
            className="passage__chapter"
            id={`c${item.bookId}-${item.chapter}`}
          >
            {bookLabels?.[item.bookId]
              ? `${bookLabels[item.bookId]} ${item.chapter}`
              : `Chapter ${item.chapter}`}
          </h2>
        ) : item.kind === "verse" ? (
          <Fragment key={item.verse.verseId}>
            <Verse
              verse={item.verse}
              density={density}
              layers={layers}
              translationId={translationId}
              onNavigate={onNavigate}
              searchHighlights={searchHighlights?.get(item.verse.verseId)}
            />
            {layers.interlinear && (
              <Interlinear words={interlinear?.get(item.verse.verseId) ?? []} />
            )}
            {layers.variants && (
              <QereReadings
                variants={variants?.get(item.verse.verseId) ?? []}
                words={interlinear?.get(item.verse.verseId) ?? []}
              />
            )}
          </Fragment>
        ) : (
          <OmittedVerse
            key={`omission-${item.note.verseId}`}
            note={item.note}
            passageSlug={passageSlug ?? ""}
            // What the `variants` (Qere/Kethiv) layer actually governs, now two things rather
            // than one: the DEPTH of the omission apparatus below, and — beneath every printed
            // verse, via `<QereReadings>` above — whether the scribes' own marginal readings
            // are shown at all. Never *whether the gap itself is explained*, which stays
            // unconditional.
            //
            // The omission itself is unconditional. Verse numbers visibly skip, and a silent
            // skip is the puzzle this component exists to prevent — a toggle that could hide
            // it would be a toggle that reintroduces a bug. So `variants` off still renders
            // the one-line "not printed in this translation" notice, and `variants` on adds
            // the reason and the links to the translations that do print it. That is a real
            // difference in rendered output, which is what the toggle was missing: it was
            // exposed in <LayerControls> and read by nothing.
            //
            // Panel density has room for the one-liner only, regardless.
            detailed={density === "reader" && layers.variants}
          />
        ),
      )}

      {/* Rendered once for the whole passage, not per verse, and only when the layer is on.
          Two jobs, both load-bearing.

          The licence: the headwords and glosses in the rows above come from the OpenScriptures
          HebrewLexicon under CC BY 4.0, which requires attribution to travel with the material.
          A credit in a global footer is not that.

          The caveat: those glosses are Strong's one-word index tags. They are useful for seeing
          WHICH Hebrew word is under a given English one, and they are not translations — Strong's
          tags אֱלֹהִים as "gods" and בָּרָא as "shape", neither of which is what the word means in
          Genesis 1:1. Printing them with no warning would make this layer a machine for producing
          confident wrong readings, which is the exact failure mode word-study tools are known
          for. */}
      {layers.interlinear && (
        <p className="passage__interlinear-note">
          Hebrew and Aramaic from the Westminster Leningrad Codex (OSHB); Greek from the SBL Greek
          New Testament. Hebrew/Aramaic headwords and one-word glosses come from the{" "}
          <a
            href="https://github.com/openscriptures/HebrewLexicon"
            rel="noreferrer noopener"
            target="_blank"
          >
            OpenScriptures HebrewLexicon
          </a>{" "}
          (CC BY 4.0), which draws on Strong&rsquo;s; Greek one-word glosses come from the{" "}
          <a
            href="https://github.com/biblicalhumanities/Dodson-Greek-Lexicon"
            rel="noreferrer noopener"
            target="_blank"
          >
            Dodson Greek Lexicon
          </a>{" "}
          (public domain). A gloss here is an index tag, not a translation — it tells you which
          word this is, not what it means in this verse. Click any word for its full entry and
          every other place it occurs.
        </p>
      )}
      {layers.interlinear && greekEditionVariants && <GreekEditionVariants rows={greekEditionVariants} />}
      {layers.interlinear && greekManuscriptReadings && (
        <GreekManuscriptApparatus rows={greekManuscriptReadings} />
      )}
      {/* This remains next to the licence/gloss note because it is a fact about what the SBLGNT
          prints, not about lexicon coverage. The edition-comparison block below resolves the
          mark's research trail without claiming to be a complete manuscript collation. */}
      {layers.interlinear && (
        <p className="passage__interlinear-note">
          A mark like <span lang="grc">⸀</span> before a Greek word is the SBLGNT editors&rsquo;
          own sign that an editorial difference is being noted. Jot shows the available
          published-edition comparison below; it is not a complete manuscript collation.
        </p>
      )}
    </div>
  );
}
