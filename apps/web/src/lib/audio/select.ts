/**
 * Which recording plays for a chapter. Pure, so the server page can decide what the Listen
 * button offers and the client player can make the identical decision at play time.
 */

import type { AudioEdition, ChapterAudio, PassageAudio } from "@/lib/db/audio";

/** Which recording the player prefers when several cover a chapter. */
export type EditionChoice = "translation" | "original";

/**
 * `translation`: the edition that reads the translation on screen. `original`: the
 * original-language edition (Hebrew today), whatever translation is shown — the whole point
 * of a translation-independent verse id is that the Hebrew can be played under the JPS or
 * under the KJV alike. Null when the chosen kind has no recording of this chapter; the
 * player says so rather than quietly playing something else.
 */
export function pickEdition(
  chapter: PassageAudio["chapters"][number] | undefined,
  editions: readonly AudioEdition[],
  translationCode: string,
  choice: EditionChoice,
): ChapterAudio | null {
  if (!chapter) return null;
  const wanted = editions.filter((e) =>
    choice === "original" ? e.translationCode === null : e.translationCode === translationCode,
  );
  for (const e of wanted) {
    const audio = chapter.byEdition[e.code];
    if (audio) return audio;
  }
  return null;
}

/** The choices that have at least one recording somewhere in this passage. */
export function availableChoices(
  audio: PassageAudio | null | undefined,
  translationCode: string,
): EditionChoice[] {
  const out: EditionChoice[] = [];
  if (!audio) return out;
  for (const choice of ["translation", "original"] as const) {
    if (audio.chapters.some((c) => pickEdition(c, audio.editions, translationCode, choice))) {
      out.push(choice);
    }
  }
  return out;
}

export function editionByCode(editions: readonly AudioEdition[], code: string): AudioEdition | undefined {
  return editions.find((e) => e.code === code);
}
