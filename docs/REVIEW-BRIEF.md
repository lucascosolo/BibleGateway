# Jot — reviewer brief

You are reviewing **Jot**, a scholarly Bible study application. This document exists so that
your review is informed rather than impressionistic: it states what the tool is for, what is
built, what is deliberately not built, and where the evidence is. Read it before the
screenshots.

Judge it as a **research instrument for academic use** — a graduate student in biblical
studies, a seminary lecturer, a textual critic. Not as a devotional app.

---

## 1. What it is

A reading surface for the biblical text fused with the apparatus a scholar actually uses:
cross-reference structure, textual variation between manuscript traditions, and (in later
phases) composition dating, manuscript witnesses, and geography.

The name is from Matthew 5:18 — "not one jot or one tittle shall pass from the law." A *jot*
is the smallest letter (Hebrew *yod*); the wordmark is lowercase `jot` with the dot on the
"j" set in a rubric red, because that dot literally *is* a tittle.

The interface uses biblical and philological vocabulary for its sections — Toledot, Geniza,
Massa'ot, Derash, Selah — each of which carries a plain-English gloss. The gloss is in the
accessible name always, and visible on hover; in the *navigation* it is not visible on touch,
because five stacked two-line glosses do not fit a tab bar and the one attempt at it hyphenated
a gloss into twelve lines under a single icon. (An earlier version of this brief claimed a
"visible subtitle on touch" everywhere. A reviewer checked, and it was not true. The touch
answer is the global **Plain labels** preference, which replaces every term with ordinary
English outright and sits one tap away in the reading-settings panel at every screen size.)
This is a deliberate choice about register and it is a fair thing to challenge.

## 2. Corpus and data provenance

Everything is public domain or openly licensed. Nothing is scraped from a copyrighted
translation.

| Source | Use | License |
|---|---|---|
| World English Bible (WEB) | primary translation, 31,095 verses | Public domain |
| Berean Standard Bible (BSB) | second translation, 31,083 verses | Freely licensed |
| King James Version (KJV) | 31,102 verses | Public domain outside the UK — see below |
| American Standard Version (ASV, 1901) | 31,086 verses | Public domain |
| Darby Translation (DBY) | 31,099 verses | Public domain |
| Young's Literal Translation (YLT) | 31,102 verses | Public domain |
| JPS TaNaKH (1917) | Old Testament only, 23,145 verses | Public domain |
| Brenton Septuagint (LXX) pilot | Nehemiah, Lamentations, Habakkuk, and Haggai; 633 mapped verses | Public domain |
| OpenBible.info cross-references | 344,597 vote-weighted links | CC-BY |
| OpenScriptures Hebrew Bible (WLC, morphhb) | Hebrew/Aramaic text, word-level, with lemma + morphology | CC BY 4.0 |
| SBL Greek New Testament (MorphGNT) | Greek text, word-level, with lemma + morphology | SBLGNT text © SBL/Logos; morphology CC BY-SA 3.0 |
| OpenScriptures HebrewLexicon | 9,831 dictionary entries (Strong's + the OSHB lexical index) | CC BY 4.0 |
| STEPBible TVTMS | versification mapping between schemes | CC BY 4.0 |

443,061 original-language word tokens in total. The canonical address space is 31,102 verses;
no single translation prints all of it, which is the point — see §4.

The translations were chosen to be textually *informative* rather than merely redundant. WEB
follows the Byzantine/Majority tradition and BSB the critical text (NA28), so their divergence
is content rather than noise. KJV, ASV, DBY and YLT then span three centuries of English
translation practice against a shifting textual base, and JPS 1917 is the one Jewish translation
of the Hebrew Bible in the set — it prints no New Testament, and the reader is told so rather
than shown a 404.

**On the KJV specifically.** Its licence line is stored verbatim rather than flattened to
"public domain", because it is not quite that everywhere: letters patent with no expiry mean
printing it in the United Kingdom, or importing printed copies into it, still requires
permission from the Crown's patentees. Outside the UK it is firmly public domain. Serving it as
this site does is unaffected, but the distinction is real and the notice travels with the text.

**Not included, and why.** Douay-Rheims, Brenton's LXX and the Clementine Vulgate are all
freely licensed and all were rejected for the same reason: they number verses in the Vulgate or
Septuagint tradition, not this corpus's. Douay-Rheims Ps 23:1 is canonical Ps 24:1. Ingesting
any of them as if they agreed would silently mis-anchor thousands of verses — the exact failure
the versification map exists to prevent — so they wait on a mapping that has been verified
rather than assumed. NRSVue and every other modern academic translation are absent because they
are not freely licensable, and no amount of wanting them changes that.

**Verse addressing.** Every verse has a translation-independent integer id, `BBCCCVVV`
(`book × 10⁶ + chapter × 10³ + verse`). It is the only address in the system. This is why
switching translation never loses your place, and why an annotation made in one translation
still renders in another. The id space is deliberately sparse — an encodable id is not
necessarily a real verse — and the code treats it that way.

**Data integrity.** The upstream WEB distribution turned out to be corrupt: its producer
stripped USFM footnotes without preserving the surrounding whitespace, welding words together
inside scripture ("The wind blows" → "The windblows", John 3:8) across 30 verses, and leaving
raw footnote markers inline in two more. The ingest now repairs this and then re-scans what it
actually wrote, failing the build on any defect it cannot account for. If you want to attack
the data quality, that gate and its reviewed word baseline are the place to push.

## 3. What is built

**The reader** (`/read/<ref>`) — server-rendered passage text, prev/next chapter, per-passage
copyright notice, translation switcher that preserves position, and text selection that
creates persistent highlights and notes.

**One rendering engine.** There is exactly one scripture rendering component. A hover tooltip,
a cross-reference preview, a search result and the full reader are all that same component
with a different *density* (`tooltip` / `preview` / `panel` / `reader`). Density is semantic
intent — how much apparatus belongs here; physical fit is handled separately by CSS container
queries, so the same component renders correctly at 320px in a sheet and 900px in a reading
column within one viewport. The reason this matters: annotations are stored per verse id and
subscribed per verse, so a highlight made anywhere re-renders everywhere it appears, on every
open surface, without any code maintaining that. It is a property of the state topology, not
a feature someone has to keep working.

**Cross-reference apparatus** — 344,597 links, vote-weighted into strength tiers, shown as a
panel beside the reader (grouped by book, with previews rendered through the same engine) and
as a force-directed graph in the deep-dive view.

**Textual apparatus** — the twelve New Testament verses absent from the earliest Greek
manuscripts (see §4; this is the most distinctive thing in the build), and the Hebrew Bible's
own Qere/Kethiv notes. Greek edition differences from STEPBible TAGNT are now also available
under the original-language layer, with edition support and attribution; this is explicitly not
a complete manuscript collation. The selected VarApp layer now supplies manuscript sigla and
witness lists for 5,867 Greek NT loci, with a CC0 source link; dated witness metadata, editorial
sigla conventions and broader OT/ECM coverage remain unbuilt.

**Search** (`/derash`) — full-text search over the *English translation*. Stemmed, so "love"
also finds "loved". It is not a lemma search and does not pretend to be; its own gloss says so,
and the original-language index is a separate workspace.

**Original languages** (`/lashon`, and the "Original language" reading layer) — **new since the
last review, and the largest single addition.**

- The reader can show the Hebrew/Aramaic or Greek beneath each verse, word by word, in reading
  order and in the script's own direction, with the dictionary headword, transliteration, a
  one-word gloss and the decoded morphology.
- `/lashon` is a word index: type a Hebrew or Greek word, or a Strong's number, and get that
  word's distribution by book, its inflected forms with decoded morphology, and every occurrence
  in context.
- Morphology is decoded from the source codes, not stored as prose — `HVqp3ms` becomes
  "verb · qal · perfect · 3rd person · masculine · singular", and a participle's tail is read as
  gender/number/state rather than person/gender/number, which is the mistake that produces
  silent nonsense.
- **Homonyms are not merged.** `H2617` is not a word in this corpus: the morphology splits it
  into H2617a *ḥesed* "goodness" (245×) and H2617b *ḥesed* "shame" (2×). Typing the bare number
  gets a disambiguation, never a silent merge and never a 404.
- **Qere and Kethiv are shown, both of them.** The scribes who copied the Hebrew sometimes found
  a word they believed should be *said* differently from the way it stands *written*. Rather than
  alter the text they left the written form alone and noted the spoken one beside it. All 1,278
  of those notes are now rendered under the verse they annotate, gated on the "Variant readings"
  layer: both forms, which word of the Hebrew the note attaches to, and the spoken form's own
  morphology, headword and gloss. They were in the database for a release before anything
  displayed them, and an adversarial review was right to call that a claimed feature that did not
  exist.
- **Versification is mapped, not assumed — and the map's completeness is now proved rather than
  asserted.** Seventy canonical verses are assembled from two Hebrew verses (the Hebrew numbers
  psalm superscriptions that English leaves unnumbered); the Hebrew reference is shown, not
  hidden. SBLGNT's two divergences (3 John 1:15, Rev 12:18) are declared exceptions with the
  reason recorded. The loader used to fall back to identity whenever the map was silent, so
  deleting one map row moved the Hebrew onto the wrong canonical verse with every check still
  passing; identity is now enumerated explicitly, and the *shape* of the result — which seventy
  verses are assembled, which six receive no Hebrew — is checked against a reviewed baseline.
  Deleting the map row for Ps 3:2 now fails the build by name. See `docs/ORIGINAL-LANGUAGES.md`
  for what that does and does not prove.
- **Six Old Testament verses have no Hebrew, and the reader is told which and why.** Five are
  source verses that straddle a canonical boundary with no word-level cut available (1 Kgs 18:34,
  20:3, 22:21, Ps 13:6, Isa 63:19); Neh 7:68 is simply absent from the Leningrad Codex.
- **Unaccented and unpointed searching works.** `λογος` finds `λόγος` and `חסד` finds `חֶסֶד`,
  against an indexed folded column written at ingest time rather than an expression evaluated
  over 443,061 rows per keystroke. The word index also states its result cap with the real total
  rather than showing a silent first page.
- **Greek lexical entries expose the full Dodson definition**, not only the one-word gloss, on
  `/lashon/<lemma>` and in the interlinear hover title. The page labels it as a CC0 lexical aid
  and explicitly does not imply BDAG, LSJ, or verse-specific semantic analysis.

**A first-run guided tour** — opens once, Skip on every step, reopens from "Guide" in the rail
or from the home page. Each step says what a feature is *and why it exists*.

**Reading modes** — a layer system (verse numbers, highlights, notes, cross-references,
reference heat, variants) with per-layer toggles, plus *Selah* mode, which strips every layer
for uninterrupted reading.

**Parallel comparison** (`/parallel/<ref>`) — two licensed translations share one canonical
verse row. At desktop width the editions sit side by side; below that they stack within each
verse so the comparison remains readable on a phone. The reader links to it with **Compare**.

The translation list now includes a deliberately small Brenton LXX pilot. It is available beside
the canonical translations for Nehemiah, Lamentations, Habakkuk, and Haggai only. Its four-book
scope and 21 source omissions are disclosed by the corpus; Psalms and the other LXX books are not
identity-mapped or silently presented as equivalent until their verse systems have reviewed maps.

**Study output** — `/notes` gathers the visitor's highlights, notes, and bookmarks and exports
them as Markdown. Reader pages expose **Notes** and **Compare** beside the translation control.
The global `⌘K`/`Ctrl-K` palette accepts references, English search terms, Strong's keys, and
Hebrew or Greek words, routing each to the existing canonical destination.

## 4. The thing to look at hardest

Twelve New Testament verses (Matt 17:21, 18:11, 23:14; Mark 7:16, 9:44, 9:46, 11:26, 15:28;
Luke 23:17; John 5:4; Acts 28:29; Rom 16:24) are absent from the earliest manuscripts. BSB
omits all twelve; WEB prints all twelve. The source data expresses an omission as an empty
string.

Stored as text, that renders as a blank line — a gap the reader cannot distinguish from a
bug. Most software resolves the ambiguity by hiding it. Jot does the opposite: the ingest
refuses to store an empty verse, records the omission in its own table, and the reader renders
it *in place* as apparatus — the verse number, why it is not printed, and a one-click link to
the translation that does print it, landing on the same verse.

Read `/read/Mark.9?t=BSB` and `/read/John.5?t=BSB` in the screenshots. Ask whether this is
genuinely useful to a scholar or merely clever.

## 5. What is deliberately NOT built

State this plainly so you do not review absence as failure — but do judge whether the tool is
honest about it. Three sections are named in the navigation and are not implemented:

- **Toledot** — the interactive composition-date timeline (two independent axes: when events
  occurred vs when texts were written).
- **Geniza** — manuscript witnesses and transmission (Dead Sea Scrolls vs Masoretic vs
  Septuagint), variant comparison *across witnesses*. The Hebrew's own Qere/Kethiv notes are
  built (§3) and are a different thing: one manuscript's internal apparatus, not a comparison
  between manuscripts.
- **Massa'ot** — the geographic atlas.

Also not built: source-critical layers, language-composition charts, literary-structure marking
(chiasm/inclusio, which will be cited from published scholarship rather than "detected"),
reception history, and reading plans. These are Phases 2–4 in `ARCHITECTURE.md` §6 and are
listed on `/roadmap`.

Original-language morphology **was** on this list at the last review and is now built — see §3.

Each unbuilt section has a route that says what it will be, what data will back it, and which
phase it lands in. **Whether that is adequate honesty or a shell pretending to be a product is
a fair thing for you to rule on.**

## 6. Deliberate limits

- **Some features are desktop-only, and say so.** The governing rule: if a feature's value
  comes from comparing many columns at once or from a large 2-D canvas, it is desktop-only;
  if the information is fundamentally linear, it works on mobile. The reference graph remains
  desktop-only; parallel comparison is linearized and remains available on a phone. Cuts are
  disclosed, never silently hidden.
- **The corpus is an immutable build artifact** (SQLite, read-only at runtime). User data
  lives in a separate writable store so the corpus can be rebuilt and redeployed without
  touching anything a user created.
- **NRSVue is not included, and will not be.** It is copyrighted and requires a paid licence.
  The schema is translation-agnostic and would take it without migration, but only freely
  licensable texts are being pursued.
- **Glosses are labelled as what they are.** The one-word English tag under a Hebrew word comes
  from Strong's, which is a 19th-century concordance index, not a modern lexicon. The
  interlinear says so in as many words, because an unlabelled Strong's gloss is the raw material
  of a great deal of confident bad exegesis.

## 7. Where the evidence is

- `ARCHITECTURE.md` — the full design record, including the three foundational decisions in
  §0 and the phased plan in §6.
- `AGENTS.md` — the invariants, and a list of traps already hit and paid for.
- `docs/screenshots/` — every route at 320 / 390 / 768 / 1280 / 1920 px, in both light and
  dark themes.

## 7b. What a previous review found, and what changed

An earlier adversarial review of this build returned NOT YET. Do not treat any of it as
settled — re-check it. What was done in response:

- **The reference-heat table was materially wrong** and is fixed. Range expansion measured
  distance by subtracting verse ids, but the id space is sparse, so every cross-chapter target
  range was truncated at the chapter boundary: 3,239 verses undercounted, 4,931 inbound
  contributions lost. It now walks the ordered real-verse set, and the ingest gate recomputes
  the whole table by a second, independently written method and fails on any disagreement.
  Verified: zero discrepancies across 30,989 verses.
- Corrections to overclaimed copy, undisclosed filtering, unreachable controls, whole-book
  rendering, omitted-verse routing, annotation editing and touch-target sizes were also made
  in response to that review. **Verify them rather than believing this list.**

Of the gaps that review named, three are now closed: **original-language texts**,
**lemma/morphology search**, and the **versification map** are built (§3). Verify them rather
than believing this paragraph — in particular, check that the Hebrew reads right-to-left in the
correct word order, that the morphology decoding is right, and that the disambiguation of shared
Strong's numbers is scholarship rather than a workaround.

### A second review, and what it caught

A second adversarial pass over the code returned NOT YET as well, and it was right to. Its
findings are in `docs/reviews/codex-code-review.md`, unedited. The four that mattered most, and
what was done — again, **verify these rather than believing this list**:

- **Qere/Kethiv was ingested and never displayed.** 1,278 marginal readings sat in the database
  with no caller, while the reading-layer switch and this very document claimed the feature. They
  now render under the verse, showing the written form and the spoken one together. Check Gen
  8:17, Gen 30:11 (one written form, *two* spoken readings), Gen 49:10 and Jer 51:34.
- **Every Aramaic verb in Daniel and Ezra carried a Hebrew stem name.** The two languages share
  most of their stem letters and almost none of their meanings — `q` is *qal* in Hebrew and
  *peal* in Aramaic — and one table was being used for both. Aramaic has its own table now, and
  the per-word language letter picks it. Check Daniel 2 with the original-language layer on.
- **Greek search claimed to ignore accents and did not.** `λογος` matched nothing while `λόγος`
  worked, because the stripped query was compared against an accented column. There is now a
  stripped, indexed column in the corpus, and the ingest fails if the query plan stops using it.
- **Three build gates were decorative.** A failed dependency install, a failed compile and a
  route returning 500 all reported success, each for the same reason: a pipeline's exit status
  is its last command's, and `grep` and `tail` succeed on anything. All three now fail.

The review also found the versification gate could not detect a **missing map row** — the loader
fell back to identity in silence, which is the exact mis-anchoring the map exists to prevent.
Identity is now enumerated before any Hebrew is read, against two reviewed baselines, and the
gate was proved to fail by deleting the reviewer's own example row from `VerseMap.xml`.

### Still unbuilt, and still real gaps

A broader cited critical apparatus with dated witnesses and full editorial metadata; parallel MT/LXX comparison; per-source
checksums; and export beyond Markdown annotations and one citation (the reader now offers Plain, SBL, BibTeX, and CSL-JSON,
and `/api/openapi.json` documents the public API). Six Old Testament
verses carry no Hebrew at all, because the source splits one canonical verse across two canonical
ones without saying where the cut falls — those are now enumerated and gated rather than silently
missing, but they are still missing.

## 8. What we want from you

Be adversarial. Specifically:

1. **Would an academic researcher actually use this**, or is it a pretty reader with apparatus
   bolted on? What is the first thing a real scholar would try that fails?
2. **Is it clean and easy to use** — or is the biblical vocabulary a barrier dressed as
   character?
3. **What is missing** that any serious Bible research tool has and this does not?
4. **Where is it dishonest** — a number that is not what it claims, a cap not disclosed, a
   feature implied but absent, a "coming soon" that should just be removed?
5. **What is actually broken** in the screenshots — layout, contrast, hierarchy, overflow,
   touch targets, anything at any breakpoint.
6. **Design, judged directly.** Is it genuinely pleasant to look at? Is it free of clutter while
   still keeping every research tool within reach? Where does the hierarchy fail, where is
   something buried, where is something loud that should be quiet? Visit the site yourself as
   well as reading the screenshots.
7. **Tell us what to build next.** This is not a courtesy question — it is one of the two things
   we most want from you. What would a serious researcher reach for if it were there? Name
   features, not directions: the specific capability, the data it would need, and what it would
   let someone do that they cannot do now. Include the small conveniences as well as the large
   capabilities — the "little features an academic researcher would wish for" are exactly what
   this build is trying to get right.

Do not be polite about it. Concrete, specific, and ranked by severity is far more useful than
balanced. If your verdict is that it does not yet stand up beside modern research tools, say so
plainly and say what would change your mind.
