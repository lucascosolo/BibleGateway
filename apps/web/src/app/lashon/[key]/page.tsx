import Link from "next/link";
import { notFound } from "next/navigation";

import { PassageRenderer } from "@/components/passage/PassageRenderer";
import {
  getBookIndex,
  getFirstVerseTexts,
  getTranslationByCode,
  getTranslations,
  type VerseText,
} from "@/lib/db/corpus";
import {
  getConcordanceOccurrences,
  getConcordanceSummary,
  getLexiconSources,
  resolveConcordanceKey,
  type ConcordanceEntry,
  type InflectedForm,
  type LexiconEntry,
  type GreekLexiconEntry,
  type StrongsFamilyMember,
} from "@/lib/db/originals";
import { parseMorphology } from "@/lib/morphology";
import { formatRange, singleton, toUrlSlug, type BookIndex } from "@/lib/refs";

/**
 * One word, everywhere it occurs (`/lashon/[key]`).
 *
 * The key is a Strong's number (`H2617`, `G26`) or a lemma as the source spells it. Both resolve
 * here rather than to two different pages, because they are two ways of naming the same thing and
 * a reader arriving from a printed concordance has the number while a reader arriving from the
 * interlinear has the lemma.
 *
 * The centre of the page is what the TEXT does with the word — how often, in which books, in
 * which grammatical forms, and every occurrence in context. The dictionary entry is shown too,
 * but deliberately above the evidence rather than instead of it, and always attributed: a gloss
 * is one lexicographer's summary, and a reader who can see the distribution can weigh it. The
 * order of the page is the argument.
 *
 * `resolveConcordanceKey` handles the case a printed concordance creates: `H2617` is not a word
 * in this corpus, because the morphology splits it into H2617a ("goodness") and H2617b ("shame").
 * That resolves to a disambiguation rather than a 404 and — importantly — never to a merge.
 */

const PAGE_SIZE = 40;

/** How many inflected forms are shown before the rest go behind a disclosure. */
const FORMS_SHOWN = 12;

const RTL_LANGUAGES = new Set(["hbo", "arc"]);

const LANGUAGE_LABEL: Record<string, string> = {
  hbo: "Biblical Hebrew",
  arc: "Biblical Aramaic",
  grc: "Koine Greek",
};

interface ConcordancePageProps {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ t?: string; p?: string }>;
}

export async function generateMetadata({ params }: ConcordancePageProps) {
  const { key } = await params;
  const decoded = decodeURIComponent(key);
  const summary = getConcordanceSummary(decoded);
  if (!summary) return { title: "Lashon · Jot" };
  const word = summary.lexicon?.headword ?? summary.greekLexicon?.headword ?? summary.lemma;
  return { title: `${word}${summary.strongs ? ` (${summary.strongs})` : ""} · Lashon · Jot` };
}

export default async function ConcordancePage({ params, searchParams }: ConcordancePageProps) {
  const { key } = await params;
  const { t, p } = await searchParams;
  const decoded = decodeURIComponent(key);

  // A typed Strong's number that the corpus never uses as typed is not a dead end — it is an
  // ambiguous question. Resolved before anything is queried, so the disambiguation costs nothing
  // on the ordinary path.
  const resolution = resolveConcordanceKey(decoded);
  if (resolution.kind === "family") {
    return <Disambiguation base={resolution.base} entry={resolution.entry} members={resolution.members} />;
  }

  const summary = getConcordanceSummary(decoded);
  if (!summary) notFound();

  const books = getBookIndex();
  const translations = getTranslations();
  const translation = getTranslationByCode(t ?? "WEB") ?? translations[0];

  const pageCount = Math.max(1, Math.ceil(summary.total / PAGE_SIZE));
  // Clamped rather than trusted: `?p=99999` on a word with two occurrences is a URL anyone can
  // type, and an out-of-range page renders as a silently empty result that reads like a bug.
  const page = Math.min(Math.max(1, Number.parseInt(p ?? "1", 10) || 1), pageCount);
  const occurrences = getConcordanceOccurrences(decoded, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  // One query for every verse on this page rather than one per occurrence.
  const verseTexts = getFirstVerseTexts(
    occurrences.map((o) => o.verseId),
    translation.translationId
  );

  const rtl = RTL_LANGUAGES.has(summary.language);
  const maxBookCount = Math.max(...summary.books.map((b) => b.count), 1);
  const href = (patch: { t?: string; p?: number }) => {
    const next = new URLSearchParams();
    next.set("t", patch.t ?? translation.code);
    const target = patch.p ?? page;
    if (target > 1) next.set("p", String(target));
    return `/lashon/${encodeURIComponent(decoded)}?${next}`;
  };

  return (
    <div className="lashon-page lashon-page--entry">
      <p className="lashon__crumb">
        <Link href="/lashon">← Lashon</Link>
      </p>

      <header className="concordance__header">
        {/* The headword, not `lemma`. For Hebrew, `lemma` is the raw OSIS attribute — `b/2617 a`
            — and putting it in an <h1> is how this page read before the lexicon existed. */}
        {/* `dir` goes on an inline span, never on the <h1>. A block element with `dir="rtl"`
            also takes `text-align: right`, which threw the headword to the far side of a
            1280px page while its transliteration and everything under it stayed left — the
            word and its own caption were separated by the width of the screen. The span gets
            the bidi handling the Hebrew needs; the heading keeps the page's alignment. */}
        <h1 className="concordance__lemma">
          <span lang={summary.language} dir={rtl ? "rtl" : "ltr"}>
            {summary.lexicon?.headword ?? summary.lemma}
          </span>
        </h1>
        {summary.lexicon?.xlit && (
        <p className="concordance__xlit">{summary.lexicon.xlit}</p>
        )}
        <p className="concordance__meta">
          {LANGUAGE_LABEL[summary.lexicon?.language ?? summary.language] ?? summary.language}
          {summary.strongs && (
            <>
              {" · "}
              <span className="concordance__strongs">Strong&rsquo;s {summary.strongs}</span>
            </>
          )}
          {" · "}
          <strong>{summary.total.toLocaleString()}</strong> occurrence
          {summary.total === 1 ? "" : "s"} in {summary.books.length} book
          {summary.books.length === 1 ? "" : "s"}
        </p>
      </header>

      {summary.lexicon && <LexiconPanel entry={summary.lexicon} />}
      {summary.greekLexicon && <GreekLexiconPanel entry={summary.greekLexicon} />}

      {/* Where the word actually lives. A count alone says a word is common; the distribution
          says it is common *in Psalms* and absent from the Torah, which is the fact that changes
          how a verse is read. */}
      <section className="concordance__section" aria-label="Distribution by book">
        <h2 className="lashon__subhead">Where it occurs</h2>
        <ol className="concordance__books">
          {summary.books.map((entry) => {
            const book = books.get(entry.bookId);
            return (
              <li key={entry.bookId} className="concordance__book">
                <span className="concordance__book-name">{book?.name ?? `Book ${entry.bookId}`}</span>
                <span
                  className="concordance__book-bar"
                  // A bar, not a chart library: one declarative width per row, no JS, and it
                  // degrades to the number beside it if styles never arrive.
                  style={{ inlineSize: `${Math.max(2, (entry.count / maxBookCount) * 100)}%` }}
                  aria-hidden="true"
                />
                <span className="concordance__book-count">{entry.count.toLocaleString()}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The grammatical forms, decoded. This is the part a lexicon cannot give you: whether a
          verb is overwhelmingly used in one stem, whether a noun is nearly always construct. */}
      <section className="concordance__section" aria-label="Forms">
        <h2 className="lashon__subhead">How it is inflected</h2>
        <FormList forms={summary.forms.slice(0, FORMS_SHOWN)} language={summary.language} />
        {summary.forms.length > FORMS_SHOWN && (
          // `<details>` rather than a "show more" button: this page is a server component and
          // there is no reason to ship a client bundle to expand a list the browser can expand
          // by itself. It is also open-by-default for anyone who prints the page or reads it
          // with search-in-page in some browsers, which a JS toggle is not.
          <details className="concordance__more">
            <summary>
              {summary.forms.length - FORMS_SHOWN} more form
              {summary.forms.length - FORMS_SHOWN === 1 ? "" : "s"}
            </summary>
            <FormList forms={summary.forms.slice(FORMS_SHOWN)} language={summary.language} />
          </details>
        )}
        {summary.formsTruncated && (
          // Never let a cap pass for a total. `formsTruncated` is reported by the query rather
          // than inferred from `forms.length === CAP`: the old test compared the list length
          // against a cap applied to SPELLINGS, before duplicate accentuations were folded
          // away, so it fired on words that were nowhere near the cap and stayed silent on
          // words that were.
          <p className="concordance__note">
            The most frequent forms are shown. This word has more.
          </p>
        )}
      </section>

      <section className="concordance__section" aria-label="Occurrences">
        <div className="concordance__occ-head">
          <h2 className="lashon__subhead">Every occurrence</h2>
          <nav className="concordance__translations" aria-label="Translation">
            {translations.map((option) => (
              <Link
                key={option.code}
                href={href({ t: option.code })}
                className="concordance__translation"
                aria-current={option.code === translation.code ? "true" : undefined}
                title={option.name}
                replace
                scroll={false}
              >
                {option.code}
              </Link>
            ))}
          </nav>
        </div>
        <p className="concordance__export">
          <a href={`/api/concordance?key=${encodeURIComponent(decoded)}&format=tsv`}>
            Export occurrences as TSV
          </a>
          {summary.total > 5_000 && " (first 5,000; the export says so in its headers)"}
        </p>

        <ol className="concordance__occurrences">
          {occurrences.map((occ) => (
            <Occurrence
              key={`${occ.verseId}-${occ.position}`}
              occurrence={occ}
              reference={formatRange(singleton(occ.verseId), books)}
              slug={toUrlSlug(singleton(occ.verseId), books)}
              sourceLabel={humanizeOsis(occ.sourceRef, books)}
              translationCode={translation.code}
              translationId={translation.translationId}
              verse={verseTexts.get(occ.verseId)}
            />
          ))}
        </ol>

        {pageCount > 1 && (
          <nav className="concordance__pager" aria-label="Occurrence pages">
            {page > 1 ? (
              <Link href={href({ p: page - 1 })} rel="prev">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="concordance__page-of">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={href({ p: page + 1 })} rel="next">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

/**
 * The dictionary entry.
 *
 * Attributed rather than presented as fact, and that is the whole design. Strong's is a
 * nineteenth-century index built to serve a concordance, not a modern lexicon; its glosses are
 * often a list of the King James Version's renderings rather than a definition. Shown with its
 * name attached, it is a useful historical reference a reader can weigh against the occurrences
 * below. Shown as "the meaning of the word", it would be the single most misleading thing on
 * this page — it is exactly the source behind a great deal of confident internet exegesis.
 */
function LexiconPanel({ entry }: { entry: LexiconEntry }) {
  const source = getLexiconSources()[0];
  // `oshb` provenance means the OSHB lexical index drew this homonym distinction and Strong's
  // did not, so the prose fields are empty by design rather than by accident. Saying so is the
  // difference between a sparse entry and an apparently broken one.
  const splitOnly = entry.provenance === "oshb";

  return (
    <section className="concordance__section concordance__lexicon" aria-label="Dictionary entry">
      <h2 className="lashon__subhead">In the dictionary</h2>
      {entry.gloss && <p className="concordance__gloss">{entry.gloss}</p>}
      {entry.meaning && <p className="concordance__def">{entry.meaning}</p>}
      {entry.usage && (
        <p className="concordance__usage">
          <strong>Rendered in the King James Version as:</strong> {entry.usage}
        </p>
      )}
      {entry.etymology && (
        <p className="concordance__usage">
          <strong>Origin:</strong> {entry.etymology}
        </p>
      )}
      {splitOnly && (
        <p className="concordance__note">
          This is one of two or more words that share Strong&rsquo;s number {entry.strongsNum}.
          The split comes from the Hebrew Bible&rsquo;s own lexical index, which distinguishes
          them; Strong&rsquo;s does not, so it has no separate definition for this one.{" "}
          <Link href={`/lashon/H${entry.strongsNum}`}>See both words under H{entry.strongsNum}</Link>.
        </p>
      )}
      {/* CC BY 4.0 requires attribution to travel with the material, so it is rendered here,
          beside the entry, rather than tucked into a global footer nobody reads. */}
      {source && (
        <p className="concordance__attribution">
          {entry.gloss || entry.meaning ? "Entry from " : "Headword from "}
          <a href={source.sourceUrl} rel="noreferrer noopener" target="_blank">
            {source.name}
          </a>{" "}
          ({source.license}) — credit the Open Scriptures Hebrew Bible Project. The underlying
          text of Strong&rsquo;s and Brown-Driver-Briggs is itself public domain.
        </p>
      )}
    </section>
  );
}

function GreekLexiconPanel({ entry }: { entry: GreekLexiconEntry }) {
  return (
    <section className="concordance__section concordance__lexicon" aria-label="Greek dictionary entry">
      <h2 className="lashon__subhead">In the Greek dictionary</h2>
      {entry.gloss && <p className="concordance__gloss">{entry.gloss}</p>}
      {entry.definition && <p className="concordance__def">{entry.definition}</p>}
      <p className="concordance__attribution">
        Entry from <a href="https://github.com/biblicalhumanities/Dodson-Greek-Lexicon" rel="noreferrer noopener" target="_blank">Dodson Greek Lexicon</a> (CC0 1.0 Universal). This is a lexical aid, not a BDAG, LSJ, or verse-specific semantic judgment.
      </p>
      <p className="concordance__attribution">
        For broader classical and Koine lexicography, consult{" "}
        <a href={`https://www.perseus.tufts.edu/hopper/morph?l=${encodeURIComponent(entry.headword)}&la=greek`} rel="noreferrer noopener" target="_blank">Perseus&rsquo; LSJ tools</a>{" "}
        or <a href={`https://logeion.uchicago.edu/${encodeURIComponent(entry.headword)}`} rel="noreferrer noopener" target="_blank">Logeion</a>. Those external resources are linked rather than copied into Jot.
      </p>
    </section>
  );
}

/**
 * A Strong's number that names more than one word.
 *
 * The alternative designs were both worse. A 404 punishes the reader for using the number their
 * printed concordance gave them. Silently redirecting to the commonest homonym answers a
 * different question from the one asked and never says so — and with H2617 that means quietly
 * choosing "goodness" over "shame".
 */
function Disambiguation({
  base,
  entry,
  members,
}: {
  base: string;
  entry: LexiconEntry | null;
  members: readonly StrongsFamilyMember[];
}) {
  return (
    <div className="lashon-page lashon-page--entry">
      <p className="lashon__crumb">
        <Link href="/lashon">← Lashon</Link>
      </p>
      <header className="concordance__header">
        <h1 className="concordance__ambiguous">Strong&rsquo;s {base}</h1>
        <p className="concordance__meta">
          names {members.length} different words in the Hebrew Bible.
        </p>
      </header>

      <p className="concordance__ambiguous-note">
        Strong&rsquo;s numbering was made by grouping words that look alike. Modern lexicons
        separate some of those groups, because the words behind them are unrelated — they share
        their consonants and nothing else.
        {entry?.gloss && (
          <>
            {" "}
            Strong&rsquo;s itself glosses {base} as &ldquo;{entry.gloss}&rdquo;, covering all of
            them at once.
          </>
        )}{" "}
        Pick the one you want:
      </p>

      <ul className="lashon__list">
        {members.map((m) => (
          <li key={m.key} className="lashon__item">
            <Link className="lashon__item-link lashon__item-link--example" href={`/lashon/${m.key}`}>
              <span
                className="lashon__item-surface"
                lang={m.language}
                dir="rtl"
                data-language={m.language}
              >
                {m.headword}
              </span>
              <span className="lashon__item-lemma">{m.xlit}</span>
              <span className="lashon__item-strongs">{m.key}</span>
              <span className="lashon__item-count">
                {m.count.toLocaleString()} occurrence{m.count === 1 ? "" : "s"}
              </span>
              <span className="lashon__item-note">{m.gloss}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FormList({
  forms,
  language,
}: {
  forms: readonly InflectedForm[];
  language: string;
}) {
  const rtl = RTL_LANGUAGES.has(language);
  return (
    <ul className="concordance__forms">
      {forms.map((form) => {
        const parsed = parseMorphology(form.morph, language);
        return (
          <li key={`${form.surface}-${form.morph}`} className="concordance__form">
            <span
              className="concordance__form-surface"
              lang={language}
              dir={rtl ? "rtl" : "ltr"}
              data-language={language}
            >
              {form.surface}
            </span>
            <span className="concordance__form-parse">{parsed.label}</span>
            <span className="concordance__form-count">{form.count.toLocaleString()}×</span>
            {form.variants.length > 1 && (
              // The cantillation is folded for COUNTING, never thrown away. This word really
              // does appear under several accents and that is a fact about the text, not noise
              // — it just is not six different forms, which is what the page used to claim.
              // Shown inside the group it belongs to, so the reader can check the fold rather
              // than take it on trust.
              <span className="concordance__form-variants">
                <span className="concordance__form-variants-label">
                  {form.variants.length} accentuations:
                </span>{" "}
                {form.variants.map((v, i) => (
                  <span key={v.surface}>
                    {i > 0 && " · "}
                    <span lang={language} dir={rtl ? "rtl" : "ltr"} data-language={language}>
                      {v.surface}
                    </span>{" "}
                    <span className="concordance__form-variant-count">
                      {v.count.toLocaleString()}×
                    </span>
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Which edition a differing `sourceRef` belongs to, keyed by the word's language code. */
const SOURCE_EDITION: Record<string, string> = {
  hbo: "Hebrew",
  arc: "Aramaic",
  grc: "Greek",
};

/**
 * `Ps.3.1` → `Psalms 3:1`.
 *
 * The original-language editions carry their own verse numbering, and where it differs from the
 * English the difference is exactly what a reader checking BHS needs to see. What they do not
 * need to see is the corpus's internal address notation: OSIS ids are an identifier format, and
 * printing one beside a human reference asks the reader to learn a second way of writing down a
 * verse in order to read the first.
 *
 * Book lookup goes through the index rather than a dot-split alone, so an unrecognised book id
 * degrades to the raw segment instead of throwing on a page of 245 rows.
 */
function humanizeOsis(osis: string, books: BookIndex): string {
  const [book, chapter, verse] = osis.split(".");
  if (!chapter) return osis;
  const name = books.find(book)?.name ?? book;
  return verse ? `${name} ${chapter}:${verse}` : `${name} ${chapter}`;
}

interface OccurrenceProps {
  occurrence: ConcordanceEntry;
  reference: string;
  slug: string;
  /** `occurrence.sourceRef` as a human reference — see `humanizeOsis`. */
  sourceLabel: string;
  translationCode: string;
  translationId: number;
  verse: VerseText | undefined;
}

/**
 * One occurrence: the reference, the form as it stands in that verse, and the verse itself.
 *
 * The English text goes through `<PassageRenderer>` like everywhere else — a concordance line is
 * still scripture, so a highlight made here has to be the same highlight the reader shows
 * (AGENTS.md invariant #2). `density="preview"` because a concordance line is a glance: verse
 * numbers and highlights, no apparatus.
 */
function Occurrence({
  occurrence,
  reference,
  slug,
  sourceLabel,
  translationCode,
  translationId,
  verse,
}: OccurrenceProps) {
  const parsed = parseMorphology(occurrence.morph, occurrence.language);
  const rtl = RTL_LANGUAGES.has(occurrence.language);

  return (
    <li className="concordance__occurrence">
      <div className="concordance__occ-ref">
        <Link href={`/read/${slug}?t=${translationCode}`}>{reference}</Link>
        {/* The source's own address, when it differs — the Hebrew numbers psalm superscriptions
            that English leaves unnumbered, and a reader checking BHS needs the Hebrew reference,
            not the English one.

            Compared against `slug`, not `reference`. Both `slug` and `sourceRef` are OSIS
            addresses in the same notation (`Gen.19.19`), so an equality test between them means
            what it says. The previous test compared `sourceRef` with dots swapped for spaces
            ("Gen 19 19") against the human reference ("Genesis 19:19") — two strings that can
            never be equal, so the condition was true for every occurrence and the internal OSIS
            id was printed under all ~245 rows on this page. A guard that cannot fire is not a
            guard; it just looks like one in review. */}
        {occurrence.sourceRef !== slug && (
          <span className="concordance__occ-source" title="Reference in the original-language edition">
            {/* Named by the edition's language, not hardcoded "Hebrew": this page also serves
                Greek (`/lashon/G…`) and Aramaic lemmas, and the whole point of the line is to
                tell the reader which edition's numbering they are looking at. */}
            {SOURCE_EDITION[occurrence.language] ?? "Original"}: {sourceLabel}
          </span>
        )}
      </div>

      <p className="concordance__occ-form">
        <span
          className="concordance__form-surface"
          lang={occurrence.language}
          dir={rtl ? "rtl" : "ltr"}
          data-language={occurrence.language}
        >
          {occurrence.surface}
        </span>
        <span className="concordance__form-parse">{parsed.label}</span>
      </p>

      {verse ? (
        <PassageRenderer
          verses={[verse]}
          range={singleton(occurrence.verseId)}
          density="preview"
          translationId={translationId}
          className="concordance__occ-text"
        />
      ) : (
        <p className="concordance__occ-missing">
          Not printed in this translation.
        </p>
      )}
    </li>
  );
}
