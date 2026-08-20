# Jot — adversarial design & usability review

**Reviewed:** https://bible.lucascosolo.com — live site, 2026-08-13.
**Method:** browsed the live site directly (WebKit at 1180×694) and drove Chrome over CDP at
390×844, 1180×800, 1280×900 and 1600×1000, in both `prefers-color-scheme: light` and `dark`.
Every finding below cites the URL and the viewport it was seen at. No source code was read.

---

## The three questions, answered first

### 1. Is it easy to use? — **Not yet.**

The reader itself is easy. Everything around it is not, and the front door is actively broken.

The single worst thing on the site is the home page. At 390px, `https://bible.lucascosolo.com/`
is **136,993 px tall, carries 8,069 links, and ships an 8.97 MB HTML document** (172 KB over the
wire, 5.7 s to interactive). At 1180px it is 66,877 px tall. The cause is a section headed
**"7992 verses that some Bibles leave out"**, which then lists every verse in the New Testament
— `Matt.1.1` through `Rev.22.21` — as individual pink pills. The body copy underneath reads
*"the oldest copies that survive do not contain these 7992 verses."* That sentence is false, and
it is the flagship claim of the entire product stated backwards. There are twelve such verses.
The reader knows this: `/read/Matt.1?t=BSB` renders zero omission notices, and `/read/Acts.8?t=BSB`
correctly flags only v37. So the data is right and the home page query is wrong — but a first-time
visitor meets the wrong version first, at 130,000 px of scroll, on the page whose job is to
establish that this tool is careful about the text.

Second: **after skipping the tour, the home page never says what Jot is.** At 390px light and at
1180px dark the hero is: the wordmark `jot`, the Matthew 5:18 epigraph, a search box, and a
"New here? Take the guided tour" button. There is no sentence — not one — telling a graduate
student that this is a reader with cross-reference apparatus, textual-variant notes and
word-level Hebrew and Greek. All of that lives inside the tour, which is exactly where the person
who skipped it will not look. The `<title>` says "Jot — scholarly Bible study"; the page does not.

Third: **controls disappear between breakpoints with no overflow.** At 1180×800 on
`/read/Ps.23` the shell exposes `Read · Derash · Lashon · Roadmap · Pardes` and the theme trio —
and nothing else. `Selah` and `Guide` are gone. Guide is then unreachable from anywhere except a
link on the home page, which is the one place a returning user does not go. At 1280 they reappear
in a left rail. Two entirely different navigation shells 100 px apart.

The tour itself is genuinely good writing — every step says what a thing is *and why it exists*,
Skip is on every step, "Back" works, and it reopens. But it is a centred modal that spotlights
nothing. Step 2 ("Read") says *"the buttons at the top switch translation"* while sitting on the
home page, where there are no such buttons and the modal is covering the search box. A tour that
describes controls it will not point at is a leaflet, not a tour.

For the curious non-specialist specifically: the reader is fine and Psalm 23 at 390px is lovely.
But three of the five items in the mobile tab bar are transliterated Hebrew (`Derash`, `Lashon`,
`Pardes`) with no visible gloss, and the interlinear tells a non-Greek-reader nothing at all
(see §3).

### 2. Does it avoid clutter while keeping every research tool reachable? — **Not yet.**

It errs **both ways at once**, which is the worst of it: the apparatus is buried and the chrome is
noisy.

Buried:
- **Cross-references are hidden behind a FAB below 1280px.** At 1180×800 on `/read/Ps.23`,
  tapping "Cross-references" opens a bottom sheet that fills the full width and roughly 85 % of
  the height — every verse of Psalm 23 is hidden behind it. You cannot read the passage and its
  cross-references at the same time, which is the entire point of a cross-reference panel. Only
  at ≥1280px does it become the proper right-hand sidebar it is described as.
- **Full morphology is in a `title` attribute.** On `/read/Gen.1` with "Original language" on, the
  visible rows under `בְּ/רֵאשִׁ֖ית` are lemma, gloss, and the bare word "noun". The
  transliteration (`rēʾšît`) and the real parsing (`preposition + noun · common · feminine ·
  singular · absolute`) exist only in the native browser tooltip. On a phone they are
  unreachable; on desktop they need a one-second hover and render as unstyled OS chrome. The most
  valuable datum in the largest new feature has the worst affordance in the browser.
- **The Pardes panel is 995 px of content in a 670 px box** at 1180×694 on `/read/Gen.1`, with no
  scroll affordance. "Original language" and "Plain labels" — the two switches most likely to
  change what a first-time user thinks of the product — are below the fold inside it.
- **No theme control on mobile at all.** The complete `a`/`button` inventory of
  `/read/John.3` at 390×844 contains no Light/System/Dark control and no Guide. Theme lives only
  in the ≥1180px top bar.

Noisy:
- **The left rail at ≥1280px is ugly and unbalanced.** On `/read/Acts.8?t=BSB` at 1280×900 the
  `Derash` gloss renders as visible italic body copy inside a ~90 px column and hyphenates
  mid-word: `not origi-` / `nal-lan-` / `guage or se-` / `mantic search.` Twelve lines of tiny
  italic under one nav icon, eight under the next, two under `Read` and `Roadmap`. It is the
  loudest thing on the page and it is a footnote.
- **The FAB sits on top of scripture.** At 390×844 on `/read/John.3` the "Cross-references" pill
  covers two lines of verse 8; on `/read/Ps.23` it covers the copyright line. It is opaque,
  permanent, and undismissable.
- **Every occurrence on `/lashon/H2617a` prints the reference twice** — `Genesis 19:19` and
  directly beneath it `Gen.19.19`. The internal OSIS id is user-facing on ~245 rows.

### 3. Is it nice to look at? — **Yes, mostly** — with two disfiguring exceptions.

Credit where it is due, briefly: the reading column is genuinely handsome. A warm-cream/near-black
palette, a serif at 19.2 px with generous leading, superscript verse numbers set quiet, a measure
around 66 characters. `/read/Ps.23` at 390×844 light is as good as any Bible app I have seen.
Contrast is excellent almost everywhere — I measured every distinct text/background pair on
`/read/Ps.23` and `/read/Gen.1` in both themes; the lowest passing value was 5.12:1.

The exceptions:

- **`.xref-tier--strong` fails contrast in dark theme: 1.69:1 at 12.48 px.** Near-white
  (`oklch(0.98 0.006 80)`) on bright mint (`oklch(0.8 0.09 182)`). This is the "Strong · 443 votes"
  badge, i.e. the evidence-weight label on every cross-reference row — the one piece of scholarly
  metadata in that panel. In light theme the same badge measures 8.95:1, so this is a
  dark-mode-only token slip. Seen on `/read/Ps.23` and `/read/Gen.1` at 1280×900 dark.
- **The focus ring is alarm-red.** The panel close button on `/read/Gen.1` at 1180×694 autofocuses
  on open and draws `outline: solid oklch(0.7 0.17 30)` — the same rubric red the product uses to
  mean "textual problem". Opening the layers panel therefore greets you with what looks like an
  error box around the exit. At 390px it lands on the tour's `<h2>`, so the first thing a new
  visitor sees is a red rectangle around the words "A Bible for reading closely."

Smaller: the dotted underlines under `Derash`/`Lashon` in the ≥1180px top bar read as spell-check
squiggles at that size. The `jot` tittle floats far enough above the `j` to read as a stray dot
rather than a tittle. `1Pet 2:9` and `Rev 5:9` on the home page lack the space that `Isa 9:7` and
`Titus 2:14` have.

---

## The Hebrew vocabulary: earned, or decorative?

**Mixed, and one of them is wrong.** The default should stay Hebrew; the *parentheticals* should
go.

Earned: `Lashon` and `Derash` name genuinely distinct activities that English does not name well
("word study" vs "search"), and both carry a real gloss in their accessible name. `Selah` for
reading-mode is a small delight and the gloss ("Pause") does all the work needed. `Toledot`,
`Geniza` and `Massa'ot` are the correct technical words for what those workspaces will be.

Decorative: the layer descriptions in the Pardes panel append bare Hebrew terms that explain
nothing and are never defined — *"Notes you've attached to a verse **(Masora)**"*, *"The panel of
linked passages beside the text **(Testimonia)**"*. Neither term means what it is being used for.
Masora is the Masoretic scribal apparatus, not your personal marginalia; testimonia are collected
proof-texts, not a cross-reference index. These are ornaments hung on a UI string.

Wrong: the Variant readings layer is glossed *"Why a missing verse is missing, and who prints it
**(Qere/Kethiv)**"*. Qere/Kethiv is a specifically Masoretic read-it-this-way notation in the
Hebrew Bible. Applying it to the omission of Greek New Testament verses is a category error, and
it is exactly the kind of thing the audience this product is aimed at will catch. A graduate
student who reads that line will re-evaluate everything else the site tells them. **Delete it.**

Also: the brief claims the glosses are a *"visible subtitle on touch."* They are not. At 390×844
on `/read/John.3` the tab-bar items read `Derash` and `Lashon` with the gloss present only in the
accessible name. On touch there is no hover, so the gloss is unreachable by the exact users the
fallback was designed for.

And `Plain labels` has a bug: turning it on renames the panel to "Reading layers" and the toggle
to "Reading mode", but leaves the subtitle *"The four layers of reading: plain, hinted, inquired,
hidden."* — the gloss of a word that is no longer on screen. (`/read/Gen.1`, 1180×694, dark.)

---

## Controls whose purpose is unclear until you click

- **`Pardes`** at ≤1180px. A stacked-layers icon and a Hebrew word, in the top bar, with no
  visible gloss. It is the master control for the entire apparatus and nothing about it says so.
- **The four coloured circles** in the selection toolbar (`/read/Ps.23`, 1280×900). Unlabelled.
  Reasonably guessable, but they are the only unlabelled controls in the app.
- **`Selah` "Off"** in the 1280px rail — a leaf icon, a Hebrew word, and a state pill, with the
  gloss only on hover.
- **The `⸀` marks in the Greek.** On `/read/John.3` with Original language on, the SBLGNT
  apparatus siglum (U+2E00) is printed raw before `⸀ἀπεκρίθη` and `⸀ὁ`. It is a pointer into a
  critical apparatus that Jot does not ship, so it points at nothing. A scholar sees a dangling
  reference; everyone else sees a rendering bug. Either explain it in the interlinear caption or
  strip it at ingest.

---

## What is visually or functionally broken

Ranked by severity.

1. **Home page ships the whole New Testament as a link list under a false headline.**
   `/` at 390×844 → 136,993 px, 8,069 links, 8.97 MB DOM, 5.7 s. Heading: "7992 verses that some
   Bibles leave out". Should be 12.
2. **Translation switcher overflows the viewport at 390px.** `/read/Ps.23` at 390×844: the
   `.translation-switcher__panel` is 350 px wide anchored at x=202, so its right edge is at 552 px
   in a 390 px viewport. "Berean Standard Bible" renders as "Berean Standard Bibl", "American
   Standard Version" as "American Standard Ve", "Young's Literal Translation" as "Young's Literal
   Translat". The page does not scroll horizontally, so the names are simply unreadable. This is
   on every reader route at phone width, on the most-used control in the product.
3. **The cross-reference panel asserts a false zero while loading.** First open on `/read/John.3`
   at 1180×694 rendered "**0 total for John 3**" and "*No outbound cross-references.*" for long
   enough to screenshot; a moment later the same panel read "1406 total for John 3". A loading
   state that is indistinguishable from an empty state is bad; one that states a specific wrong
   number is worse. The empty states everywhere else on this site are excellent, which makes this
   the odd one out.
4. **`.xref-tier--strong` at 1.69:1 in dark theme** (see above). WCAG AA needs 4.5:1.
5. **`/read/John.3?t=JPS` repeats an identical 36-word paragraph 36 times.** One per verse:
   *"JPS TaNaKH (1917) does not include this book… Printed in WEB, BSB, KJV, ASV, DBY, YLT."* The
   intro above it says *"The verses either side are shown instead"* — there are no verses either
   side; the whole book is absent. This should be one banner and a translation-switcher hint.
   (1280×900 and 390×844.)
6. **"How it is inflected" on `/lashon/H2617a` groups on the accented string, not the form.**
   `חֶ֫סֶד noun · common · masculine · singular · absolute` appears as 12×, then again as 11×, 8×,
   7×, 6×, 5× — six identical parsings differing only in cantillation. The page then says "38 more
   forms" and "The 50 most frequent forms." A reader is being told this word has ~88 inflected
   forms when it has perhaps eight. For a morphology feature this is the credibility-critical bug.
7. **No print stylesheet.** `Page.printToPDF` on `/read/Ps.23` produced a page containing the
   nav rail, the Selah/Pardes/Guide buttons, the theme switcher, and then all forty
   cross-reference cards reflowed underneath. Zero `@media print` rules in the stylesheets.
8. **The 404 is Next.js's default.** `/read/Zzz.1` returns a bare "404 / This page could not be
   found." — no wordmark, no rail, no "did you mean", no way back. It is the only screen in the
   product that looks unowned, and it is jarring precisely because every deliberate empty state
   here (`/toledot`, `/derash` with no query, JPS on a NT book) is so carefully written.
9. **The deep-dive graph is a hairball.** `/deep-dive/John.3.16` at 1280×900: ~40 of the 60 nodes
   are unlabelled identical dots, labels overlap their own nodes and each other ("1 John 4:9–10"
   sits on top of its node), the edge-weight encoding is imperceptible in pale grey, and there is
   no zoom, filter, expand-node or search. Everything it conveys is conveyed better by the ranked
   list directly below it.
10. **Greek gets no gloss at all.** On `/read/John.3` a Hebrew word cell has four data (surface,
    lemma, gloss, POS); a Greek word cell has three — there is no English gloss, because no Greek
    lexicon is ingested. This is undisclosed. "Original language" for the New Testament currently
    tells a non-Greek-reader that ἀπεκρίθη is a verb, and nothing else.
11. **Interlinear column widths are set by the longest morphology label.** On `/read/John.3` v3,
    the cell for `τις` is ~150 px wide because "interrogative/indefinite pronoun" sits under it,
    producing arbitrary rivers between Greek words and making the least important row the one that
    controls the layout of the most important.
12. **The selection toolbar occludes the line above the selection** (`/read/Ps.23`, 1280×900:
    selecting v4 hides v3 entirely).
13. **Reliability.** The site returned HTTP 502 twice during this review, once for ~3 minutes and
    once for ~45 s, under a handful of page loads. Possibly a deploy; flagging it because it
    happened twice in fifteen minutes.

**Does it tell you when it has nothing to show?** Mostly, superbly. `/toledot`, `/geniza` and
`/massaot` each state the phase, that no data exists, what will back it, and offer the nearest
honest substitute. `/derash` with no query explains the search semantics. `/lashon/H2617`
disambiguates rather than 404ing, and explains *why* Strong's numbers split. The omitted-verse
apparatus on `/read/Acts.8?t=BSB` is the best thing in the build: verse 37 renders in place with a
rubric-red number, a red rule, the reason, and one-click links to KJV and YLT that land on the
same verse. That is real scholarship rendered as interface, and it is not merely clever — it is
what I would want. The exceptions are the ones listed above: the loading-as-empty cross-reference
panel and the raw 404.

---

## What to build, ranked

### Fix first (these are not features)

- **F1. The home page omissions section.** Filter to the real omission set, render human
  references not `Matt.1.1`, cap the list, and correct the sentence. This one change takes the
  home page from 137,000 px to about 4,000.
- **F2. One sentence under the wordmark** saying what Jot is. Not a tagline — a claim: *"Read the
  text with the apparatus beside it: 344,794 cross-references, the verses manuscripts disagree
  about, and the Hebrew and Greek word by word."*
- **F3. Anchor the translation panel to the viewport's right edge below 480px.**
- **F4. Promote the interlinear `title` attribute to visible UI** — transliteration as a permanent
  fourth row, full parsing in a tap-target popover.

### Large capabilities

1. **Parallel translation view.** `/read/Ps.23?with=BSB,KJV` — n columns, verse-aligned on the
   integer id, sticky reference gutter, and a diff mode that tints words present in one column and
   absent in another. **This does not exist at all today**, despite the brief describing it as a
   built-but-desktop-only feature. Seven translations you can only see one at a time is not a
   comparison tool; it is a bookmark. Needs: nothing new — the verse-id space already guarantees
   alignment. This is the single highest-value thing on this list and it is mostly layout work.
2. **A cited critical apparatus.** The `⸀` marks are already in the text, which means the hook is
   already there. Attach the SBLGNT apparatus (CC BY-SA) so clicking `⸀` shows the variant, the
   editions that adopt it (NA28/WH/Treg/RP), and the reading each prints. Needs: the SBLGNT
   apparatus file. Turns the marks from a rendering bug into the feature that distinguishes Jot
   from every free reader on the web.
3. **A notes and highlights index, with export.** There is currently no route that lists what you
   have annotated (`/notes`, `/annotations`, `/library` all 404). Annotations you cannot list,
   search, sort by book, or export are annotations you cannot use in research. Needs: a query over
   the existing per-verse store, plus Markdown / CSV / Zotero-RDF export.
4. **Compact concordance view for `/lashon/<id>`.** 245 occurrences currently means seven pages of
   full verse texts. Offer a KWIC mode: reference · keyword in context (±6 words) · form, all
   245 on one screen, sortable by book/canonical order, filterable by clicking a bar in "Where it
   occurs" (those bars should be links), and exportable. Needs: nothing new.
5. **Collocation and syntactic-neighbourhood data.** For a lemma, show its most frequent nominal
   objects / verbal subjects / construct partners, ranked by log-likelihood. `ḥesed` co-occurring
   with `ʾemet` 30-odd times is a research finding, not trivia. Needs: only the token table you
   already have.
6. **MT/LXX parallel.** Rahlfs LXX is public domain and CCAT/CATSS morphology is available. The
   versification map is the hard part and it already exists. Even Genesis + Psalms + Isaiah would
   be more than most free tools offer.
7. **Real search operators.** `/derash` today is stemmed AND-of-terms with no phrase, proximity,
   boolean, wildcard, or field syntax, and no sort control (results come back relevance-ordered
   with no way to get canonical order). `"exact phrase"`, `NEAR/5`, `-exclude`, `book:Isa`.
   Needs: an FTS5 query parser.
8. **Search over the original languages by lemma across a corpus slice**, i.e. `/derash` and
   `/lashon` joined: "every occurrence of `ḥesed` within five words of `ʾemet` in the Psalter."
9. **Retire or rebuild the deep-dive graph.** As a hairball it earns nothing. Either give it
   expand-on-click, degree filtering, label collision avoidance and node search — or replace it
   with a chord/adjacency view of *books*, which would actually show structure.

### Small conveniences, roughly in order of how often a researcher would touch them

- **Copy citation.** Today "Copy" on `/read/Ps.23` puts
  `Even though I walk through the valley of the shadow of death…` on the clipboard — bare text, no
  reference, no translation, and it drops the trailing period. It should offer
  `"…" (Ps 23:4 WEB)`, plus a "copy as SBL / Chicago / BibTeX" option and a copy-permalink.
- **Keyboard shortcuts.** There are none. `←`/`→` for previous/next chapter, `/` to focus search,
  `t` translation, `l` layers, `g g` go-to-reference, `?` for the cheatsheet. Verified: ArrowRight,
  `/` and `n` on `/read/John.3` all do nothing.
- **A print stylesheet.** Passage + verse numbers + copyright line; drop the chrome, the FAB and
  the sidebar. Optionally "print with cross-references" as a checkbox.
- **Persistent chapter navigation.** Prev/next exists only at the very bottom of the passage. With
  the interlinear on, John 3 is 3,000+ px before you reach it. Put it in the sticky header too.
- **A go-to-reference command palette** (`⌘K`) that accepts `jn3.16`, `Ps 23`, `H2617`, `logos`.
- **Verse-range permalinks with a visible copy button** — `/read/Ps.23.1-3` already resolves;
  surface it.
- **Reference tooltips on hover** anywhere a reference appears in prose, using the tooltip density
  the engine already has.
- **Show the Hebrew verse number** when it differs from the English, in the reader, not only in
  `/lashon`. The mapping exists; the reader never mentions it.
- **A "why is this word linked here?" affordance** on interlinear words that carry a prefix — the
  gloss "beginning" under `בְּ/רֵאשִׁית` silently drops the preposition.
- **Deep-link a `/lashon` distribution bar to the filtered occurrence list.**
- **A user-facing changelog / "what changed in the corpus"**, given the build-artifact model.
- **Stop printing the OSIS id next to every human reference** on `/lashon/<id>` — or make it a
  one-click copy affordance instead of static text.

---

## Verdict

Jot is not yet a peer of Logos, Accordance, STEP Bible, Bible Hub or Sefaria, and the gap is not
subtle. Against STEP and Bible Hub it loses on the basics a researcher reaches for in the first
ninety seconds: there is no parallel translation view at any viewport, no lexicon entry for a
single Greek word, no phrase or proximity search, no way to list or export your own notes, no
keyboard navigation, and nothing you can print. Against Sefaria it loses on the thing Sefaria does
best — a text and its apparatus visible *together*, which Jot achieves only above 1280 px and
abandons below it. And its front door currently publishes 8,000 verse links under a sentence that
is factually the opposite of the truth, which is a very expensive thing for a product whose whole
pitch is that it does not hide what it does not know. What Jot already has that those tools mostly
lack is a point of view: the omitted-verse apparatus on `/read/Acts.8?t=BSB` is better than
anything Bible Hub does with the same information, the disclosure boxes on `/deep-dive/John.3.16`
and `/lashon/H2617` are more honest than anything Logos will tell you about its own caps, and the
reading column is more beautiful than all of them. That is a real foundation and it is why this is
"not yet" rather than "no". What would change my mind: the home page telling the truth and being
under 5,000 px; a parallel view of two or more of the seven translations, verse-aligned, at
390 px as well as 1280; the transliteration and full parsing visible in the interlinear without a
hover; an English gloss on the Greek; the `⸀` marks resolving to a cited apparatus; a notes index
with export; and `⌘K`, `←`/`→`, a copy-citation button and a print stylesheet. None of that is
speculative research work — most of it is layout, one ingest, and a query parser — and with it
this stops being a beautiful reader with apparatus bolted on and becomes an instrument.
