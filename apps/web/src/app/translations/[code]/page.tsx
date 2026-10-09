import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PassageRenderer, type PassageLayers } from "@/components/passage/PassageRenderer";
import { ReviewMarker } from "@/components/toledot/ReviewMarker";
import { ProfileClaim } from "@/components/translations/ProfileClaim";
import { getPassage, getTranslationByCode } from "@/lib/db/corpus";
import { getLexiconEntry } from "@/lib/lexicon";
import { singleton, toVerseId } from "@/lib/refs/verse-id";
import { FAMILIES, SAMPLE_VERSE_LABEL, getProfile } from "@/lib/translations/profiles";

import "../translations.css";

export const dynamic = "force-dynamic";

const LAYERS_OFF: Partial<PassageLayers> = {
  verseNumbers: false,
  highlights: false,
  notes: false,
  crossRefs: false,
  heat: false,
  variants: false,
  sourceCrit: false,
  interlinear: false,
  insights: false,
  toledot: false,
};

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const profile = getProfile((await params).code);
  if (!profile) return { title: "Translation not found" };
  return {
    title: `${profile.name} (${profile.code}): sources and approach`,
    description: profile.readWhen,
  };
}

export default async function TranslationProfilePage({ params }: Params) {
  const { code } = await params;
  const profile = getProfile(code);
  if (!profile) notFound();
  const translation = profile.kind === "translation" ? getTranslationByCode(profile.code) : undefined;
  const range = singleton(toVerseId(5, 6, 4));
  const sample = translation ? getPassage(range, translation.translationId) : [];
  const approach = getLexiconEntry(`approach-${profile.approach}`);

  return (
    <main className="translations">
      <header className="flex flex-col gap-3">
        <Link href="/translations" className="translations__eyebrow">All translations</Link>
        <h1>
          {profile.name} <span className="text-[var(--color-ink-faint)]">({profile.code})</span>
        </h1>
        <p className="translations__lede">{profile.year} · {FAMILIES[profile.family].label}</p>
        <ReviewMarker status={profile.status} />
      </header>

      <div className="translations__facts">
        <section aria-labelledby="lineage">
          <h2 id="lineage">Where it comes from</h2>
          <ProfileClaim claim={profile.lineage} />
        </section>

        <section aria-labelledby="sources">
          <h2 id="sources">What it translates</h2>
          <p className="translations-card__meta">
            Old Testament: {profile.otSource ?? "not included"} · New Testament: {profile.ntSource ?? "not included"}
          </p>
          <ProfileClaim claim={profile.sourcePolicy} />
        </section>

        <section aria-labelledby="approach">
          <h2 id="approach">How it translates: {approach.term}</h2>
          <p className="translations-card__meta">{approach.gloss}</p>
          <ProfileClaim claim={profile.philosophy} />
        </section>

        {profile.conventions.length > 0 && (
          <section aria-labelledby="conventions">
            <h2 id="conventions">What you will notice</h2>
            {profile.conventions.map((c) => (
              <ProfileClaim key={c.text} claim={c} />
            ))}
          </section>
        )}

        <section aria-labelledby="family">
          <h2 id="family">Related editions</h2>
          <p className="translations-card__when">{FAMILIES[profile.family].description}</p>
          {profile.notIndependentOf.length > 0 ? (
            <p className="translations__note" role="note">
              Not independent of{" "}
              {profile.notIndependentOf.map((c, i) => (
                <span key={c}>
                  {i > 0 && " and "}
                  <Link href={`/translations/${c}`}>{getProfile(c)?.name ?? c}</Link>
                </span>
              ))}
              : where they agree, count it as one tradition&rsquo;s reading, not separate confirmation.
            </p>
          ) : (
            <p className="translations-card__when">No other edition on this site is a revision of this one or its source.</p>
          )}
        </section>

        {translation && sample.length > 0 && (
          <section aria-labelledby="sample">
            <h2 id="sample">{SAMPLE_VERSE_LABEL} in this edition</h2>
            <div className="translations__sample">
              <PassageRenderer
                verses={sample}
                range={range}
                density="panel"
                translationId={translation.translationId}
                layerOverrides={LAYERS_OFF}
              />
              <p className="translations__copyright">{translation.copyrightNotice}</p>
            </div>
            <p className="translations-card__when">
              <Link href={`/parallel/Deut.6.4?a=${profile.code}&b=${profile.code === "KJV" ? "WEB" : "KJV"}`}>
                Compare it with another edition
              </Link>
            </p>
          </section>
        )}

        <section aria-labelledby="when">
          <h2 id="when">Read it when</h2>
          <p className="translations-card__when">{profile.readWhen}</p>
        </section>
      </div>
    </main>
  );
}
