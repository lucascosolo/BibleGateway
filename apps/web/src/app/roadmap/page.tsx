import Link from "next/link";
import { GlossLabel } from "@/components/GlossLabel";
import { PLANNED_WORKSPACES } from "@/components/shell/workspaces";
import { plannedSrText } from "@/components/shell/PlannedMarker";
import type { LexiconId } from "@/lib/lexicon";

export const metadata = { title: "Roadmap · Jot" };

/**
 * `/roadmap` — the honest home for what is scheduled but not built.
 *
 * Toledot, Geniza and Massa'ot used to each occupy a primary nav slot despite being empty
 * pages; they're demoted here into one list so the nav gives its five slots to things that
 * actually work. Nothing here is hidden — each row still links straight to its real
 * `RoadmapPage`, which states the phase and the data it's waiting on.
 *
 * The second list is planned *work*, not workspaces: things that will land inside surfaces that
 * already exist, so they have no route of their own to link to. They are deliberately rendered
 * as prose rather than as links, because a link implies somewhere to go and there is nowhere.
 * Entries may describe a deliberately narrower slice that is already live; those rows say so
 * explicitly rather than making the roadmap claim the shipped slice is absent.
 */

interface PlannedFeature {
  key: string;
  /**
   * A lexicon term where one genuinely names the feature, so "Plain labels" reaches it. A term
   * typed inline is a term that toggle cannot reach (AGENTS.md) — and each of these headings is
   * a standalone noun followed by an em-dash phrase, so it reads correctly under either label.
   */
  lexiconId?: LexiconId;
  /** The rest of the heading after the term — or the whole heading when there is no term. */
  title: string;
  body: string;
}

const PLANNED_FEATURES: PlannedFeature[] = [
  // The first-run guided tour used to be listed here. It is built — it opens on a first visit
  // and reopens from "Guide" beside the reading controls, or from the home page — so it has been
  // removed rather than left standing as a planned item. A roadmap that keeps claiming credit
  // for finished work is the same failure as one that hides unfinished work.
  {
    key: "habit",
    lexiconId: "seder",
    title: "— reading a little, most days",
    body:
      "For readers who want a daily habit with the text and keep losing it. Canonical, chronological and thematic plans; progress that reports what was actually read rather than flattering it; sessions sized so that five minutes is a complete unit instead of an abandoned one; resumption from exactly where you stopped (the home page's \"Continue reading\" card is the first quarter of this); and streaks that mark a missed day without wiping out the weeks behind it. Your place survives a translation switch for free, since verse ids are translation-independent. No devotional commentary — the aim is to shorten the distance to the text, not to add another voice on top of it.",
  },
  {
    key: "structure",
    title: "Literary structure layer",
    body:
      "Chiasm, inclusio and parallelism marked on the passage — sourced from published scholarship and cited per structure, never \"detected\" by the app. A proposed chiasm is an argument a scholar made and other scholars dispute; software that asserts one with no citation is manufacturing a finding. Acrostics are the exception, being mechanically verifiable letter by letter from the Hebrew, which this build now carries — so that part is a matter of writing the check, not of finding the data.",
  },
  {
    key: "reception",
    title: "Reception history",
    body:
      "How the reading of a particular passage shifted over time, anchored to the verses it concerns rather than filed under a book. The worked example: Mary Magdalene was identified with the unnamed sinful woman of Luke 7 in a homily of Gregory I in 591, and the Roman calendar separated them again only in 1969 — so that note belongs on Luke 7:36–50 and John 20:1–18, not on a page about the Gospels. Each entry carries a date and a source, on the same footing as the dating data.",
  },
  {
    key: "timeline-categories",
    lexiconId: "toledot",
    title: "— per-category timeline toggles",
    body:
      "Four independently switchable categories rather than one undifferentiated track: events narrated in the text, the composition of the texts themselves, notable translations and transcriptions, and major theological movements. Dating stays a range with a named tradition and a citation, never a bare year.",
  },
  {
    key: "translations",
    title: "More translations",
    body:
      "KJV, ASV, Darby, Young's Literal and JPS 1917 have shipped, so seven English texts are now readable side by side. Still wanted: Brenton's Septuagint and the Clementine Vulgate. Both are out of copyright and neither is blocked by licensing — they are blocked by numbering. Each counts verses in its own tradition, so Douay-Rheims Psalm 23:1 is what this corpus calls Psalm 24:1, and loading one as though the traditions agreed would quietly move thousands of verses to the wrong address. They wait on a verse mapping that has been checked rather than assumed. NET and LEB carry publisher terms that would have to be cleared. NRSVue requires a paid licence: the schema would take it without migration, but shipping a text we have no rights to was never an option.",
  },
  {
    key: "parallel",
    title: "Broader parallel texts — MT/LXX and Greek",
    body:
      "English translation comparison is now live at /parallel/<ref>, with two editions locked to the same canonical verse and a phone layout that keeps each row together. Greek edition differences from STEPBible TAGNT now appear under the original-language layer with edition support and a source link; they are explicitly not presented as a complete manuscript collation. A verified four-book Brenton Septuagint pilot now supplies an LXX-side translation for Nehemiah, Lamentations, Habakkuk, and Haggai; the remaining LXX books stay withheld until their differing verse systems have reviewed mappings. The Greek Old Testament is often the earliest evidence of how a Hebrew verse was read, and sometimes it reads a Hebrew text we no longer have.",
  },
  {
    key: "citation",
    title: "Citing and exporting what you find",
    body:
      "The reader's citation control carries the translation, licence, exact corpus build, and stable passage URL in Plain, SBL, BibTeX, and CSL-JSON formats. Notes export as Markdown and print keeps annotations attached to the text. Still wanted: stable word-level permalinks, occurrence-list export, and a reference-manager bundle for a set of notes rather than one citation at a time.",
  },
  {
    key: "apparatus",
    title: "A wider textual apparatus",
    body:
      "The build now shows witness-level Greek readings from CrossWire VarApp, including manuscript sigla and the source link, alongside the verses some Bibles leave out and the Masoretic marginal readings in the Hebrew. VarApp is a selected apparatus, not a complete census: the next scholarly layer would add dated witness metadata, editorial sigla conventions, and broader OT/ECM coverage rather than pretending this one module is exhaustive.",
  },
  {
    key: "api",
    title: "A documented, read-only API",
    body:
      "The read-only API is now live at /api, with documented passage, original-language, search, cross-reference, graph, translation, and concordance endpoints. Its machine-readable OpenAPI contract is /api/openapi.json; /llms.txt and /llms-full.txt give retrieval agents the complete endpoint map, provenance rules, and examples; /api/corpus exposes the content-derived build identifier and per-source SHA-256 manifest. Still wanted: richer reference-manager exports.",
  },
];

export default function RoadmapIndexPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <div>
        <p className="mb-1 font-sans text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
          Not built yet
        </p>
        <h1 className="font-serif text-[var(--text-2xl)] text-[var(--color-ink)]">Roadmap</h1>
      </div>

      <p className="font-serif text-[var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
        Everything on this page is planned and none of it is built. Three whole workspaces are
        scheduled — they used to sit in the primary navigation next to the reader and search, and
        this page exists so that stops being true while the plan stays just as reachable. Below
        them is the work planned inside the surfaces that already exist.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[var(--text-sm)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
          Workspaces
        </h2>
        <ul className="flex flex-col gap-3">
          {PLANNED_WORKSPACES.map((ws) => (
            <li key={ws.key}>
              <Link
                href={ws.href}
                className="flex min-h-[var(--touch-target)] items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3 transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-hover)]"
              >
                <span className="flex items-center gap-2">
                  {ws.lexiconId ? (
                    <GlossLabel id={ws.lexiconId} as="strong" className="font-serif text-[var(--text-md)] font-semibold" />
                  ) : (
                    <span className="font-serif text-[var(--text-md)] font-semibold">{ws.plainLabel}</span>
                  )}
                  <span className="sr-only">{plannedSrText(ws.phase)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {/* Same "not an alert" badge as the nav marker, laid out inline here rather
                      than absolutely positioned over an icon — this row has no icon to sit on. */}
                  <span
                    aria-hidden="true"
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]"
                  >
                    Soon
                  </span>
                  <span aria-hidden="true" className="font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">
                    Phase {ws.phase}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[var(--text-sm)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
          Planned work inside what exists
        </h2>
        {/* No phase badges on these. The workspaces above have phase numbers because
            ARCHITECTURE.md §6 assigns them one; inventing a phase for each of these to make the
            two lists look alike would be a number with nothing behind it. */}
        <ul className="flex flex-col gap-4">
          {PLANNED_FEATURES.map((feature) => (
            <li
              key={feature.key}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-4 py-3"
            >
              <h3 className="mb-1 flex flex-wrap items-baseline gap-1.5 font-serif text-[var(--text-md)] font-semibold text-[var(--color-ink)]">
                {feature.lexiconId && <GlossLabel id={feature.lexiconId} as="strong" />}
                <span className={feature.lexiconId ? "font-normal text-[var(--color-ink-muted)]" : undefined}>
                  {feature.title}
                </span>
              </h3>
              <p className="font-sans text-[var(--text-sm)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* `inline-flex` + `min-h` rather than padding: a standalone navigation link is not
          inline in a sentence, so it gets the full 44px target without the padding pushing
          the surrounding block layout around. `self-start` keeps the target from spanning
          the whole column and swallowing taps aimed past it. */}
      <Link
        href="/"
        className="inline-flex min-h-[var(--touch-target)] items-center self-start font-sans text-[var(--text-sm)] text-[var(--color-brand)] underline underline-offset-4"
      >
        ← Back to Jot
      </Link>
    </div>
  );
}
