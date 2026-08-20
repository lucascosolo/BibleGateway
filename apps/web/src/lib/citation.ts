/**
 * Turns what is on screen into something a researcher can put in a footnote.
 *
 * This is pure formatting and deliberately has no database, no React and no `window` in it: a
 * citation is a claim about *which* text was read, and the claim has to be assemblable and
 * testable without a running app.
 *
 * The reason this file exists at all is that a URL is not a citation. A reader who quotes a
 * verse from a website needs to be able to say which translation it was, who holds the rights
 * to it, and — the part almost every Bible site omits — *which build of the underlying data*
 * produced the words they copied. This corpus is rebuilt from its sources, and a rebuild can
 * legitimately change a verse: the WEB distribution shipped welded words for years and the
 * repair changed real text. A footnote pointing at a bare URL cannot distinguish the two
 * readings. `corpusBuild` is what makes the citation falsifiable.
 *
 * Three formats, because scholars in this field are asked for different things by different
 * editors, and none of the four is a superset of the others:
 *
 *   - `plain`   — what you paste into an email or a seminar handout.
 *   - `sbl`     — the *SBL Handbook of Style* is the standard in biblical studies. Note that
 *                 SBL abbreviates the translation, not the site, in an in-text citation; the
 *                 full entry is what belongs in a bibliography, and that is what is produced
 *                 here.
 *   - `bibtex`  — for anyone running LaTeX, and the format reference managers import most
 *                 reliably. `@misc` rather than `@book`: this is an electronic resource, and
 *                 typing it as a book invites BibTeX to invent a publisher and a place.
 *   - `csl-json` — for Zotero, Juris-M, and other modern reference managers that use the
 *                 Citation Style Language interchange format.
 *
 * What this does NOT do is claim an authority it does not have. It does not invent an editor,
 * a place of publication, or a print edition, and it does not silently drop the copyright
 * notice — several of the licences in this corpus require that notice to travel with the text.
 */

export interface CitationSubject {
  /** Human reference for what is on screen, e.g. "Genesis 1:1–5". */
  reference: string;
  /** Translation short code, e.g. "WEB". */
  translationCode: string;
  /** Translation full name, e.g. "World English Bible". */
  translationName: string;
  /**
   * The translation's own copyright/licence line, verbatim. Never paraphrased — the KJV's is
   * the clearest case: "public domain" is true outside the United Kingdom and not inside it,
   * and the distinction is exactly what a licensor checks for.
   */
  copyrightNotice: string;
  /** Absolute, stable URL for this passage in this translation. */
  url: string;
  /** Identity of the corpus build that produced the text (see `getCorpusBuildId`). */
  corpusBuild: string;
  /** When the reader looked at it. Passed in rather than read from the clock, so this is testable. */
  accessed: Date;
}

export type CitationFormat = "plain" | "sbl" | "bibtex" | "csl-json";

export const CITATION_FORMATS: { id: CitationFormat; label: string; hint: string }[] = [
  { id: "plain", label: "Plain", hint: "For an email or a handout" },
  { id: "sbl", label: "SBL", hint: "SBL Handbook of Style — the standard in biblical studies" },
  { id: "bibtex", label: "BibTeX", hint: "For LaTeX and reference managers" },
  { id: "csl-json", label: "CSL-JSON", hint: "For Zotero and modern reference managers" },
];

/** ISO `YYYY-MM-DD`, in UTC. A local date would make the same citation differ by timezone. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "12 August 2026" — SBL spells the month out and puts the day first. */
function longDate(d: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * A BibTeX key that is stable for the same passage and translation and cannot collide across
 * two different ones. Non-ASCII and punctuation are stripped rather than transliterated:
 * BibTeX keys are matched literally by every tool that reads them, and a key containing a
 * colon or a Hebrew letter breaks silently in some of them.
 */
export function bibtexKey(subject: CitationSubject): string {
  const slug = subject.reference
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 40);
  return `jot${slug}${subject.translationCode.replace(/[^A-Za-z0-9]/g, "")}`;
}

function escapeBibtex(value: string): string {
  // Only the characters that actually break a BibTeX field. Over-escaping (every `-`, say)
  // produces entries that look wrong when typeset, which is worse than leaving them alone.
  return value.replace(/([{}\\])/g, "\\$1").replace(/([&%$#_])/g, "\\$1");
}

export function formatCitation(subject: CitationSubject, format: CitationFormat): string {
  const { reference, translationCode, translationName, copyrightNotice, url, corpusBuild } =
    subject;

  switch (format) {
    case "plain":
      return [
        `${reference}, ${translationName} (${translationCode}).`,
        `Jot, corpus build ${corpusBuild}. ${url}`,
        `Accessed ${isoDate(subject.accessed)}. ${copyrightNotice}`,
      ].join("\n");

    case "sbl":
      // SBLHS treats a website as an electronic source: title, site, access date, URL. The
      // corpus build rides in the parenthetical with the translation, because it qualifies the
      // TEXT rather than the site — the same URL on a different build is a different reading.
      return (
        `${reference} (${translationName} [${translationCode}]; Jot, corpus build ` +
        `${corpusBuild}). Accessed ${longDate(subject.accessed)}. ${url}.`
      );

    case "bibtex":
      return [
        `@misc{${bibtexKey(subject)},`,
        `  title        = {${escapeBibtex(reference)}},`,
        `  howpublished = {{${escapeBibtex(translationName)} (${escapeBibtex(translationCode)}), Jot}},`,
        `  note         = {Corpus build ${escapeBibtex(corpusBuild)}. ${escapeBibtex(copyrightNotice)}},`,
        `  url          = {${url}},`,
        `  urldate      = {${isoDate(subject.accessed)}},`,
        `  year         = {${subject.accessed.getUTCFullYear()}}`,
        `}`,
      ].join("\n");

    case "csl-json":
      return JSON.stringify(
        {
          id: bibtexKey(subject),
          type: "webpage",
          title: reference,
          "container-title": "Jot",
          publisher: "Jot",
          URL: url,
          accessed: {
            "date-parts": [[
              subject.accessed.getUTCFullYear(),
              subject.accessed.getUTCMonth() + 1,
              subject.accessed.getUTCDate(),
            ]],
          },
          language: "en",
          note: `${translationName} (${translationCode}); corpus build ${corpusBuild}`,
          rights: copyrightNotice,
        },
        null,
        2,
      );
  }
}
