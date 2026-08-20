import Link from "next/link";
import { notFound } from "next/navigation";

import { DeepDiveView } from "@/components/crossrefs/DeepDiveView";
import { getBookIndex, getTranslationByCode, getTranslations } from "@/lib/db/corpus";
import { InvalidReferenceError, formatRange, parseReference, toUrlSlug } from "@/lib/refs";

/**
 * /deep-dive/[ref] — the reference-network deep dive (ARCHITECTURE.md §4.2, §4.7.1).
 *
 * A thin server shell: it resolves the reference and translation, then hands off to
 * `<DeepDiveView>`, which owns the graph/list split because that split depends on the client's
 * actual width (`useCapability`), not anything knowable at request time.
 */

interface DeepDivePageProps {
  params: Promise<{ ref: string }>;
  /**
   * `t` selects the translation; the other four are the graph cap overrides the cap notice in
   * `<DeepDiveView>` tells the reader to raise. They are read here, in the server component
   * that already has the query string, and passed down — the notice documented controls that
   * nothing read, so the API only ever saw its defaults.
   *
   * Not validated here on purpose: `/api/graph` parses and clamps each one against its
   * absolute ceilings, and duplicating that would create two clamps to keep in agreement.
   */
  searchParams: Promise<{
    t?: string;
    depth?: string;
    maxNodes?: string;
    maxDegree?: string;
    minVotes?: string;
  }>;
}

export async function generateMetadata({ params }: DeepDivePageProps) {
  const { ref } = await params;
  const books = getBookIndex();
  try {
    const range = parseReference(decodeURIComponent(ref), books);
    return { title: `Deep dive · ${formatRange(range, books)} · Jot` };
  } catch {
    return { title: "Deep dive · Jot" };
  }
}

export default async function DeepDivePage({ params, searchParams }: DeepDivePageProps) {
  const { ref } = await params;
  const { t, depth, maxNodes, maxDegree, minVotes } = await searchParams;

  const books = getBookIndex();
  const translations = getTranslations();
  const translation = getTranslationByCode(t ?? "WEB") ?? translations[0];

  let range;
  try {
    range = parseReference(decodeURIComponent(ref), books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) notFound();
    throw error;
  }

  const slug = toUrlSlug(range, books);

  return (
    <article className="deep-dive-page">
      <header className="deep-dive-page__header">
        <Link href={`/read/${slug}?t=${translation.code}`} className="deep-dive-page__back">
          ← Back to {formatRange(range, books)}
        </Link>
        <h1 className="deep-dive-page__title">Deep dive: {formatRange(range, books)}</h1>
        <p className="deep-dive-page__subtitle">
          A ranked, capped traversal of cross-references from this passage — not the full
          network. Exact limits and what they exclude are disclosed below.
        </p>
      </header>

      <DeepDiveView
        reference={slug}
        translationCode={translation.code}
        graphParams={{ depth, maxNodes, maxDegree, minVotes }}
      />
    </article>
  );
}
