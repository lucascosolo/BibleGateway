import type { Metadata } from "next";
import Link from "next/link";

import { TranslationComparison } from "@/components/translations/TranslationComparison";
import { getAudioEditions, hasAudio } from "@/lib/db/audio";
import { getLexiconEntry } from "@/lib/lexicon";
import { FAMILIES, PROFILES } from "@/lib/translations/profiles";

import "./translations.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Translations compared",
  description:
    "Who made each English Bible on this site, from which Hebrew and Greek texts, how literally, and which ones are revisions of each other.",
};

/** Codes with a recording on this server; an original-language reading counts for its edition. */
function audioCodes(): Set<string> {
  if (!hasAudio()) return new Set();
  return new Set(
    getAudioEditions().map((e) =>
      e.translationCode ?? (/hebrew/i.test(e.language) ? "WLC" : /greek/i.test(e.language) ? "SBLGNT" : e.code),
    ),
  );
}

const APPROACHES = ["approach-formal", "approach-functional", "approach-balanced"] as const;

export default function TranslationsPage() {
  const translations = PROFILES.filter((p) => p.kind === "translation");
  const originals = PROFILES.filter((p) => p.kind === "original");
  return (
    <main className="translations">
      <header className="flex flex-col gap-3">
        <p className="translations__eyebrow">About the editions</p>
        <h1>How the translations differ</h1>
        <p className="translations__lede">
          Two English Bibles can disagree for three different reasons: they translate different Hebrew or
          Greek texts, they translate the same text with a different idea of what a translation should be,
          or one is a revision of the other and inherits its choices. Each profile below says which.
        </p>
      </header>

      <section aria-labelledby="approaches-title">
        <h2 id="approaches-title">Two ways to translate</h2>
        <dl className="translations__approaches">
          {APPROACHES.map((id) => {
            const e = getLexiconEntry(id);
            return (
              <div key={id}>
                <dt>{e.term}</dt>
                <dd>{e.gloss}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <p className="translations__note" role="note">
        <strong>Similar translations are not independent votes.</strong> The ASV revised the King James
        Version and the World English Bible revised the ASV, so when all three agree on a reading you have
        one tradition&rsquo;s judgement, not three. Each profile lists the editions here it is not
        independent of.
      </p>

      <section aria-labelledby="editions-title">
        <h2 id="editions-title">The English editions</h2>
        <div className="translations__cards">
          {translations.map((p) => (
            <Link prefetch={false} key={p.code} href={`/translations/${p.code}`} className="translations-card">
              <span className="translations-card__head">
                <span className="translations-card__code">{p.code}</span>
                <span className="translations-card__name">{p.name}</span>
              </span>
              <span className="translations-card__meta">
                {p.year} · {FAMILIES[p.family].label} · {getLexiconEntry(`approach-${p.approach}`).term}
              </span>
              <span className="translations-card__when">{p.readWhen}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="originals-title">
        <h2 id="originals-title">The original-language texts</h2>
        <div className="translations__cards">
          {originals.map((p) => (
            <Link prefetch={false} key={p.code} href={`/translations/${p.code}`} className="translations-card">
              <span className="translations-card__head">
                <span className="translations-card__code">{p.code}</span>
                <span className="translations-card__name">{p.name}</span>
              </span>
              <span className="translations-card__when">{p.readWhen}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="table-title">
        <h2 id="table-title">Side by side</h2>
        <TranslationComparison profiles={PROFILES} audioCodes={audioCodes()} />
        <p className="translations__copyright">
          Every edition is stored here as plain text, so printed conventions such as italics for words a
          translator supplied, or small capitals in &ldquo;LORD&rdquo;, do not appear on this site.
        </p>
      </section>
    </main>
  );
}
