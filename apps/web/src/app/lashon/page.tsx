import Link from "next/link";

import { getLexiconEntry } from "@/lib/lexicon";
import { getOriginalTexts, suggestLemmas } from "@/lib/db/originals";

/**
 * Lashon — the original-language word index (`/lashon`).
 *
 * Derash searches the English translation and says so in its own gloss. This is the other half:
 * a word here is a Hebrew, Aramaic or Greek lemma, and looking one up returns every place the
 * text uses it — which is a different question from "every verse containing this English word",
 * and the one a researcher actually asks.
 *
 * A plain `<form method="get">` rather than a client-side search box. The whole page is derived
 * from `?q=`, there is nothing to keep in sync, and a server form works before hydration and
 * without JavaScript at all. Derash is a client component because its filters, paging and
 * translation switcher are five parameters that change independently; this is one.
 */

export const metadata = {
  title: "Lashon · Jot",
};

/**
 * Worked examples, shown when nothing has been searched yet.
 *
 * An empty search box teaches nobody what can be typed into it. Each of these is a word whose
 * distribution is genuinely worth seeing, and between them they demonstrate both address forms:
 * a Strong's number for the Hebrew, and the word itself for the Greek.
 */
const EXAMPLES = [
  {
    key: "H2617a",
    language: "hbo",
    label: "חֶסֶד",
    roman: "ḥesed",
    note: "Steadfast love — the word behind \"lovingkindness\", \"mercy\", \"loyalty\" and \"kindness\" in different English Bibles. Seeing all 245 occurrences at once shows how little any single English word covers it.",
  },
  {
    key: "H7307",
    language: "hbo",
    label: "רוּחַ",
    roman: "rûaḥ",
    note: "Breath, wind, spirit — one Hebrew word where English needs three, and translators have to choose one every time.",
  },
  {
    key: "ἀγάπη",
    language: "grc",
    label: "ἀγάπη",
    roman: "agapē",
    note: "The New Testament's principal word for love.",
  },
  {
    key: "λόγος",
    language: "grc",
    label: "λόγος",
    roman: "logos",
    note: "Word, account, reason, message — and the first sentence of John's Gospel.",
  },
];

interface LashonPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function LashonPage({ searchParams }: LashonPageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const lashon = getLexiconEntry("lashon");
  const texts = getOriginalTexts();
  const { items: suggestions, total, limit } = query
    ? suggestLemmas(query, 40)
    : { items: [], total: 0, limit: 40 };

  return (
    <div className="lashon-page">
      <header className="lashon__header">
        <h1 className="lashon__title">{lashon.term}</h1>
        <p className="lashon__gloss">{lashon.gloss}</p>
      </header>

      <form className="lashon__form" method="get" action="/lashon" role="search">
        <label className="lashon__label" htmlFor="lashon-q">
          Hebrew or Greek word, or a Strong&rsquo;s number
        </label>
        <div className="lashon__form-row">
          <input
            id="lashon-q"
            className="lashon__input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="H2617, חסד, λογος"
            autoComplete="off"
            // Not `autoFocus`: on a phone that opens the keyboard over the examples below,
            // which are the only thing on the page explaining what to type.
          />
          <button className="lashon__submit" type="submit">
            Look up
          </button>
        </div>
        <p className="lashon__hint">
          Accents and vowel points are optional — <code>λογος</code> finds{" "}
          <span lang="grc">λόγος</span>, and <code>חסד</code> finds <span lang="hbo">חֶסֶד</span>.
          Words are matched from the beginning, not anywhere inside.
        </p>
        {/* Said plainly rather than left to be discovered. The Hebrew edition here carries
            Strong's numbers and the Greek one does not, which is a property of the two source
            texts, not a choice — and a reader typing "G26" and getting nothing would reasonably
            conclude the search is broken. */}
        <p className="lashon__hint">
          Strong&rsquo;s numbers work for the Hebrew Bible only (<code>H2617</code>,{" "}
          <code>430</code>). The Greek New Testament edition used here carries no Strong&rsquo;s
          numbers, so Greek is looked up by the word itself.
        </p>
      </form>

      {query !== "" && (
        <section className="lashon__results" aria-label="Matching words">
          {suggestions.length === 0 ? (
            <p className="lashon__empty">
              No word in the Hebrew Bible or Greek New Testament matches{" "}
              <strong>{query}</strong>. Words are matched from the beginning, so a fragment from
              the middle of a word will not find it.
            </p>
          ) : (
            <>
              {/* The real total, always — never a bare "First 40". A count that could equally
                  mean "there are exactly 40" or "there are thousands and you are seeing a
                  fortieth of them" is the ambiguity the disclosure exists to remove, and a
                  researcher typing a broad Hebrew prefix is precisely the reader for whom the
                  difference matters. Neutral voice: a cap is information, not a malfunction. */}
              <p className="lashon__count">
                {total > limit
                  ? `${total.toLocaleString()} words match. Showing the ${limit} that occur most often — narrow the search to see the rest.`
                  : `${total.toLocaleString()} word${total === 1 ? "" : "s"} match${total === 1 ? "es" : ""}, most frequent first.`}
              </p>
              <ul className="lashon__list">
                {suggestions.map((s) => (
                  <li key={`${s.lemma}-${s.strongs ?? ""}-${s.language}`} className="lashon__item">
                    <Link
                      className="lashon__item-link"
                      href={`/lashon/${encodeURIComponent(s.strongs ?? s.lemma)}`}
                    >
                      <span
                        className="lashon__item-surface"
                        lang={s.language}
                        dir={s.language === "grc" ? "ltr" : "rtl"}
                        data-language={s.language}
                      >
                        {s.surface}
                      </span>
                      {/* The dictionary headword for Hebrew, where `lemma` is the raw OSIS
                          attribute; `lemma` itself for Greek, where it already is the headword. */}
                      <span className="lashon__item-lemma" lang={s.language}>
                        {s.headword ?? s.lemma}
                      </span>
                      {s.strongs && <span className="lashon__item-strongs">{s.strongs}</span>}
                      <span className="lashon__item-count">
                        {s.count.toLocaleString()} occurrence{s.count === 1 ? "" : "s"}
                      </span>
                      {s.gloss && <span className="lashon__item-note">{s.gloss}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {query === "" && (
        <section className="lashon__examples" aria-label="Examples">
          <h2 className="lashon__subhead">Somewhere to start</h2>
          <ul className="lashon__list">
            {EXAMPLES.map((example) => (
              <li key={example.key} className="lashon__item">
                <Link
                  className="lashon__item-link lashon__item-link--example"
                  href={`/lashon/${encodeURIComponent(example.key)}`}
                >
                  <span
                    className="lashon__item-surface"
                    lang={example.language}
                    dir={example.language === "grc" ? "ltr" : "rtl"}
                    data-language={example.language}
                  >
                    {example.label}
                  </span>
                  <span className="lashon__item-lemma">{example.roman}</span>
                  <span className="lashon__item-note">{example.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The texts being searched, named. A concordance is only as good as the edition under it,
          and a researcher has to be able to see which one that is before citing anything. */}
      <footer className="lashon__sources">
        <h2 className="lashon__subhead">What is being searched</h2>
        <ul className="lashon__source-list">
          {texts.map((text) => (
            <li key={text.textId}>
              <strong>{text.name}</strong> ({text.code}) — {text.attribution}
              {/* The stored attribution usually ends with the licence already, and printing
                  `{license}` after it rendered "Licensed CC BY 4.0.. CC BY 4.0." Only append
                  what is not already there. */}
              {text.attribution.includes(text.license) ? "" : ` ${text.license}.`}
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
