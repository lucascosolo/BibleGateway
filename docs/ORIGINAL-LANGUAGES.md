# Adding the original-language layer

Two independent adversarial reviews named the same thing as the single biggest reason Jot is
not yet a research instrument: **there is no Hebrew or Greek**. Everything else they found was
a defect; this is an absence. A tool that cannot answer "show me every occurrence of this
lemma, with its morphology" is an English reader with apparatus bolted on, which is exactly
what both reviews called it.

This is the plan for closing that, and the sourcing decisions behind it.

## Sources

All openly licensed, all verified reachable from the build host.

| Source | What it gives | License |
|---|---|---|
| [MorphGNT SBLGNT](https://github.com/morphgnt/sblgnt) | Greek NT, per word: surface form, normalized form, lemma, part of speech, full parsing code | CC BY-SA 3.0 |
| [OpenScriptures morphhb (WLC)](https://github.com/openscriptures/morphhb) | Hebrew Bible, per word: pointed surface form, lemma with Strong's number, morphology code, prefix/suffix segmentation | CC BY 4.0 |
| [STEPBible TVTMS](https://github.com/STEPBible/STEPBible-Data) | Versification mapping between the English/KJV, Hebrew, Latin and Greek traditions | CC BY |
| [Dodson Greek Lexicon](https://github.com/biblicalhumanities/Dodson-Greek-Lexicon) | Headword, one-word gloss and full definition for ~5,400 Greek NT words | CC0 1.0 (public domain; the repo's own README states this explicitly) |

`ARCHITECTURE.md` §0.1 says to take versification mapping from STEPBible rather than
hand-rolling it. That instruction is now load-bearing rather than advisory — see below.

### Formats

MorphGNT is one word per line, seven space-separated fields:

```
010101 N- ----NSF- Βίβλος Βίβλος βίβλος βίβλος
│      │  │        │      │      │      └ lemma
│      │  │        │      │      └ normalized (accents regularised)
│      │  │        │      └ word without punctuation
│      │  │        └ text as printed, punctuation included
│      │  └ parsing code (person/tense/voice/mood/case/number/gender/degree)
│      └ part of speech
└ BBCCVV — book 01 = Matthew, so book_id = field + 39
```

WLC is OSIS XML, one `<w>` per word:

```xml
<w lemma="b/7225" n="1.0" morph="HR/Ncfsa" id="01xeN">בְּ/רֵאשִׁ֖ית</w>
```

`/` segments a word into its morphemes: here the prefixed preposition *bĕ-* plus Strong's 7225
(*rēʾšît*), morphology `R` (preposition) + `Ncfsa` (noun, common, feminine, singular, absolute).
A lemma may carry a homonym letter (`1254 a`), which is part of the identifier and must not be
stripped.

## Why this forces the versification map to become real

WLC follows Hebrew numbering. Psalm 3 has **nine** verses there and **eight** in English,
because the superscription is verse 1 in the Hebrew and unnumbered in English. TVTMS states
that divergence explicitly:

```
OneToOne  Psa.3:Title  Psa.3:1  Psa.3:1  Psa.3:1  Absent [=Psa.3:1]
OneToOne  Psa.3:1      Psa.3:2  Psa.3:2  Psa.3:2  Psa.3:1
OneToOne  Psa.3:2-8    Psa.3:3-9 …
```

Until now `versification_map` was correctly empty — both shipped translations use `org`, and
the ingest gate refused to accept a divergent text without mapping rows. The Hebrew is the
first text that trips that gate, which is the point of having built it before it was needed.
**Do not resolve this by renumbering the Hebrew.** The Hebrew numbering is the scholarly
address; the map exists so both can be true at once.

Consequence: the ingest gate must be strengthened from "at least one mapping row" to full
coverage — every verse of a divergent text mapped, source tuples unique, every mapped
`verse_id` real.

### As built, and what the gate actually proves

The map is `VerseMap.xml`, shipped by morphhb itself rather than TVTMS — see the comment on
`parseVerseMap` for why a text's own publisher's table beats a general one for that text. It is
a map **by exception**: 1,978 rows for the ~1,977 WLC verses that diverge, and the other 21,236
agree with the canonical numbering.

The first version of this resolved a WLC reference by consulting the map and, on a miss,
silently returning the verse of the same number. That fallback was the defect an adversarial
review found: **identity is a claim that the two traditions agree about this verse, and it was
being made by the absence of a map row rather than by the presence of anything.** Delete one
`VerseMap.xml` row and the Hebrew of that verse — and of every verse after it in the same shift
block — anchors to the wrong canonical address, while every check in the build still passes.

Two things changed.

1. **Identity is enumerated, not implied.** Before a single Hebrew word is read, the ingest
   scans the WLC's own `osisID` attributes and builds a complete reference-to-canonical
   resolution: a map row where there is one, an explicit identity entry where there is not, and
   an error where there is neither. `resolveHebrewVerse` reads only that table. There is no
   longer a path from "no map row" to a verse id nothing wrote down.

2. **The shape of the result is checked against a reviewed baseline.** Enumerating identity does
   not by itself prove the enumeration is *right* — a deleted map row still yields an identity
   entry. That fact cannot be recovered from internal structure, and this was measured rather
   than assumed: a block shifted by one starting at verse *n* is indistinguishable from the same
   block shifted starting at *n+1*. What *is* recoverable is the shape, and the shape is tightly
   constrained. Exactly **seventy** canonical verses are assembled from more than one Hebrew
   verse (63 Psalm superscriptions plus seven chapter-seam disagreements), and exactly **six**
   canonical Old Testament verses receive no Hebrew at all. Both sets are enumerated by name in
   `ingest.ts` (`HEBREW_ASSEMBLED_VERSES`, `HEBREW_UNSOURCED_VERSES`) and the gate fails on any
   addition or removal. Deleting the map row for Ps 3:2 makes Ps 3:2 resolve to canonical Ps 3:2
   by identity, where the map already sends Ps 3:3 — so both sets move, and the build stops.

   A count would not do: seventy of *any* verses satisfies a count, which is the "one arbitrary
   row" mistake this file's gate has already paid for once.

**The known limitation, stated rather than hidden.** Six map rows carry an `!a`/`!b` part marker:
one Hebrew verse straddling a canonical boundary. The source gives no word-level cut between the
halves, so the loader anchors the whole source verse to the first canonical target and the second
gets nothing. That accounts for five of the six unsourced verses (1 Kgs 18:34, 20:3, 22:21,
Ps 13:6, Isa 63:19); the sixth, Neh 7:68, is simply absent from the Leningrad Codex. Inventing a
boundary would be worse than an empty one, so the reader is told on the page instead of being
left to wonder why the Hebrew stops.

## Schema

```sql
CREATE TABLE original_texts (
  text_id      INTEGER PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,     -- 'WLC', 'SBLGNT'
  name         TEXT NOT NULL,
  language     TEXT NOT NULL,            -- 'hbo', 'grc'
  testament    TEXT NOT NULL,
  license      TEXT NOT NULL,
  attribution  TEXT NOT NULL,            -- travels with the text, like a copyright notice
  source_url   TEXT NOT NULL,
  versification TEXT NOT NULL            -- 'org' for SBLGNT, 'hebrew' for WLC
);

CREATE TABLE original_words (
  word_id     INTEGER PRIMARY KEY,
  text_id     INTEGER NOT NULL REFERENCES original_texts(text_id),
  verse_id    INTEGER NOT NULL REFERENCES verses(verse_id),  -- canonical (org) address
  position    INTEGER NOT NULL,          -- word order within the verse, 1-based
  surface     TEXT NOT NULL,             -- as printed, pointed/accented
  normalized  TEXT NOT NULL,             -- the SOURCE's own normalized form, verbatim
  search_form TEXT NOT NULL,             -- ours: unpointed AND unaccented AND lower-cased
  lemma       TEXT NOT NULL,
  strongs     TEXT,                      -- WLC carries it; MorphGNT does not
  morph       TEXT NOT NULL,             -- source morphology code, unmodified
  gloss       TEXT
);
CREATE INDEX original_words_verse_idx  ON original_words (verse_id, position);
CREATE INDEX original_words_lemma_idx  ON original_words (text_id, lemma);
CREATE INDEX original_words_strong_idx ON original_words (strongs);
```

`normalized` and `search_form` are two columns on purpose, and the distinction is not
pedantry. `normalized` is whatever the source calls normalized — for the WLC that is unpointed
consonants, for MorphGNT it is a form that is **still fully accented**. A search box that
promises "accents are optional" and then compares a stripped query against that column finds
nothing for `λογος` and everything for `λόγος`, which is a silent partial failure at the most
ordinary query there is. `search_form` is our own fold — accents, breathings, pointing and the
morpheme separator all removed, lower-cased — written at ingest time and indexed. Stripping in
SQL instead would fix the answer and break the index: a function around the column turns a range
scan into 443,061 expression evaluations per keystroke. The fold and the query-side fold live in
different packages that cannot import each other, so the ingest gate re-derives three literal
probes against the loaded column; a drift fails the corpus build rather than returning nothing.

`morph` stores the source's own code untouched. Expanding `Ncfsa` into "noun, common,
feminine, singular, absolute" is a *presentation* concern and belongs in a lookup table in the
app, not baked into the corpus — a decoding bug should be fixable without a re-ingest, and a
researcher must be able to see the raw code.

### The `gloss` column, as actually built

The sketch above shows `gloss` living directly on `original_words`. As built it does not: a
gloss is dictionary data, not a fact about one occurrence of a word, and it lives in a separate
lexicon table joined at read time (`getInterlinear` in `apps/web/src/lib/db/originals.ts`) —
`original_lexicon` for Hebrew/Aramaic (see `lexicon.ts`), joined on `strongs`, and a second
table, `greek_lexicon`, for Greek.

Greek needs its own table rather than a row shape shared with the Hebrew one, for a reason
visible only once you look at how the Hebrew table is keyed: `original_lexicon` is reached from
`original_words.strongs`, and MorphGNT gives Greek words no Strong's number at all (the Greek
NT's `lemma` is already a real headword, so there was never a Strong's-shaped key to join on).
The natural key for Greek is the lemma itself, matched against `greek_lexicon.headword` — exact
NFC first, then a diacritic-stripped `search_headword` for the residual, mirroring the two-key
pattern `search_form` already uses for word search. The two lexicons also carry different
columns: `original_lexicon` has `twot`/`bdb`/`homonym` because two disagreeing Hebrew source
files had to be reconciled (see `lexicon.ts`); Dodson is one file with none of that apparatus.
Source is [Dodson Greek Lexicon](https://github.com/biblicalhumanities/Dodson-Greek-Lexicon),
CC0 1.0 (public domain), ~5,410 entries. The ingest gate requires the two-pass match to resolve
at least 98% of Greek word **tokens** (not distinct lemmas — a common word left unglossed
matters more than a rare one) and fails the build with the worst-offending lemmas listed rather
than lowering the bar.

## Surfaces

1. **Interlinear in the reader.** A layer, off by default, rendering each verse's original
   words beneath the translation with lemma and parsed morphology on demand. It goes through
   `PassageRenderer` like everything else (invariant #2), which means the layer toggle finally
   controls something real. Every Hebrew/Aramaic word carries a headword and gloss from
   `original_lexicon`; every Greek word now carries a gloss from `greek_lexicon` too — see "The
   `gloss` column, as actually built" above.
2. **Lemma concordance.** Every occurrence of a lemma across the corpus, with its morphology,
   linked to the verses. This is the task both reviews said fails first.
3. **Search by lemma or Strong's number** in Derash, alongside the existing English search —
   and only then may the copy say anything about roots.

4. **Qere/Kethiv in the reader.** The WLC's 1,278 marginal readings — the word as it stands
   written against the word the tradition directs be said instead — rendered under the verse
   they annotate by `<QereReadings>` inside `PassageRenderer`, gated on the `variants` layer.
   Each shows both forms, the spoken form's morphology, headword and gloss, and which word of
   the Hebrew it attaches to. They were ingested for a release before anything displayed them,
   which is how an adversarial review came to describe the feature as claimed and absent.

## What this still is not

It is not a critical apparatus. The Qere/Kethiv layer is a real piece of textual scholarship and
it is now visible, but it is the *scribes' own* notes travelling inside one Hebrew manuscript —
not variant readings across witnesses. Manuscript sigla, witness lists, editorial apparatus,
dates and MT/LXX comparison are a separate body of data and a separate phase. Adding Hebrew and
Greek makes lexical research possible; it does not make textual criticism possible, and the tool
must keep saying so.

Concretely: MorphGNT's printed text carries the SBLGNT editors' own critical-apparatus sigla
(`⸀`, U+2E00, "positive variation" — a place the manuscripts disagree) inline in front of the
words they mark, because that apparatus is part of what SBLGNT prints. Jot does not strip that
mark — it is real information from the source, not noise — but it also does not yet ship the
apparatus the mark points into, so the interlinear caption says so in one sentence rather than
leaving a scholar looking at a dangling reference that reads like a rendering bug.
