# Timeline (Toledot)

The content and builder behind `data/timeline.db`: dated events as ranges, the scholarly
positions on each date with cited arguments for and against them, objects from outside the Bible
(inscriptions, chronicles, reliefs) and what they corroborate, and chronological, textual and
historical issues. Contract and design decisions: `docs/plans/2026-10-06-timeline-backend.md`.

## Build

```bash
python3 -I packages/timeline/build.py \
  --content packages/timeline/content --corpus data/bible.db --out data/timeline.db
```

Stdlib only (Python 3.11+). Run it on this PC and ship the file; it never runs on a server. The
app finds it at `data/timeline.db` (override with `TIMELINE_DB_PATH`) and shows nothing timeline-
related without it. **Restart the service after shipping a new file**: the app opens the
database once per process (as with `audio.db`), so a renamed-in file is not picked up until then.
The server log warns if the timeline was validated against a different corpus build than the one
deployed; rebuild it against the deployed `bible.db` when it does.

Tests: `python3 -m unittest discover -s packages/timeline/tests`.

## Writing content

Everything is in `content/`: `sources.toml` (the bibliography), `eras.toml`, and one file per
artifact, event and issue. The builder rejects, and names the file for, any uncited position,
argument, attestation or issue view; a citation to a source missing from `sources.toml`; a verse
reference to a verse that does not exist; a year 0; and any unknown key.

The rules the builder cannot check:

- **Never write a fact from memory.** Every museum number, date, page range and ISBN in
  `content/` was checked against a published or institutional source on 2026-10-06. Where one
  could not be confirmed it was left out — the Taylor Prism's registration number, the
  Sennacherib tribute figures, the exact Julian day of the 597 BCE capture, Kitchen's page range.
  Leave a field out rather than fill it from recall.
- **Attribute positions to people who hold them**, and cite where they say so.
- **Dating and historicity are separate.** A view that an event did not happen as described goes
  in an `issues/` file of kind `historical`, not into a dating position with invented years.
- **Everything is `status = "draft"` until a human has reviewed it.** Only the reviewer changes it
  to `reviewed`.

## Works (outside books)

`content/works/<id>.toml` holds one record per text outside the Hebrew and Protestant canons
(`docs/plans/2026-10-09-outside-books.md`, chunk 5): its canon (`deuterocanon`, `pseudepigrapha`,
`nt-apocrypha`, `apostolic`, or `described` for a work the site does not print), the bible.db books
that print it, `[[composed]]` positions (ranges with a tradition and citations, critical first; the
builder refuses a traditional position ahead of a scholarly one), provenance, dated witnesses,
the traditions that hold it canonical, the translation ledger id from
`docs/sources/outside-books.md`, verse links into the 66 books, links to the canon-axis events
whose primary text names it, and, for described works only, a contents summary and cited excerpts
under 25 words. Every part is cited. Where the filed scholarship is silent, a position cites the
public-domain translator's introduction and says it is that translator's view and its date.

## Review notes for the seed content

The seed (5 events, 5 artifacts, 3 issues, 18 sources) was drafted by Claude from checked
sources and has not been reviewed. Claims whose *attribution* rests on the general position of
the cited work rather than a located passage, and so most need a reviewer's eye:

- `events/exodus.toml`: the Raamses argument (Exodus 1:11) attributed to Kitchen, and the
  c. 966 BCE fourth year of Solomon used in the early-date arithmetic.
- `issues/exodus-480-years.toml`: "not a straight count" as the consequence of Kitchen's date.
- `events/jerusalem-fall.toml`: the one-line summaries of Thiele's and Young's reasoning.
- `events/daniel-composition.toml`: Baldwin's position is "part or all of chapters 7–12 may go
  back to the sixth century", and the range is the whole of that century, not a narrower claim.

## Review notes for the people batch (Revision 2, 2026-10-06)

Ten people, twelve new artifacts and texts, three new issues, all `draft`. The review sheet for
this state is `docs/review/timeline-review-2026-10-06.md`; regenerate it after edits with
`python3 -I packages/timeline/review.py --db data/timeline.db --corpus data/bible.db --out <file>`.

Much of this batch rests on reference works (Wikipedia, Livius, COJS) because museum and
publisher pages refused automated access. Those citations are the first thing to replace with
the primary publication. A second pass on 2026-10-06 (WebFetch; the British Museum, Israel
Museum and Perseus still refused or returned empty pages) confirmed and applied: the Latin
Library's `Tibero`; Josephus 18.35 and 18.95 for Caiaphas (Whiston on Lexundria); the Verse
Account's "entrusted the kingship" wording (Oppenheim in ANET, via Livius); Caiaphas's
appointment by Gratus and removal by Vitellius in 36 CE and Pilate's 26–36 (Encyclopaedia
Judaica 2007 via JVL, Livius); and the title of the HNN article in `cline-2009` (the page shows
no byline, so the author attribution is still the reviewer's to confirm). A third pass the same
night read Rodger Young's three JETS papers as PDFs from rcyoung.org (reigns of Ahab and
Hezekiah, the 2 Adar 597 capture, the 587 argument and Thiele's 586 as Young cites it, Solomon's
fourth year), the June 1994 find of the Tel Dan B fragments (Hagelia 2010; Athas in JHS), the
Livius text of the Nabonidus Cylinder, and that Perseus prints `Tiberio` where the Latin Library
prints `Tibero` (both now cited). Young argues for 587 and for the Ahaz–Hezekiah coregency, so
his tables are a position, not a consensus; Thiele's own pages are still unread. Still
unconfirmed and left out: the Taylor Prism's, Nabonidus Cylinder's, Tel Dan Stele's and Pilate
Stone's museum numbers (CDLI and ORACC were unreachable), where the Hezekiah bulla is held, the
dates of composition of Tacitus and Josephus, every person's birth and death, and any
scholarly explanation of the Belshazzar parentage. Check first:

- `sources.toml`: `cline-2009` author attribution.
- `persons/jesus-of-nazareth.toml` and `artifacts/josephus-testimonium-flavianum.toml`: the
  "majority view" wording and Meier's chapter locator.
- `issues/moses-historicity.toml`: Dever's view is summarised from a review and a reference work,
  not from his text.
- `issues/solomon-united-monarchy.toml`: Yadin's attribution is cited only to a reference work.

## Review notes for the events batches (2026-10-07)

Four research batches added 48 narrative events, 17 artifacts and 8 issues, all `draft`, in
parallel scratch copies validated by the builder and merged the same afternoon. Review sheet:
`docs/review/timeline-review-2026-10-07.md`. What a reviewer should know before trusting any of it:

- **Wikipedia is the reference for most of it**, cited as a reference work to be replaced with the
  primary publication. Pages were read through a fetch tool that summarises, so Wikipedia locators
  are section-level at best and some are absent.
- **Several positions are brackets, not a scholar's dating**, and say so in their summary: Gideon,
  Samson, Ruth and the judges period (book order between dated anchors); Joseph and Jacob's descent
  (a reading of Wood 2005's "mid-19th century"); David anointed and David takes Jerusalem (the
  editor's derivation from Young's conjectural reign dates); Pentecost and the 34–40 CE conversion
  interval (derived from other cited figures); the Cyrus "no single decree" bounds.
- **Thiele is cited directly only for the Preface to the Third Edition (pp. 23–24: 853 for
  Qarqar, 723 for Samaria, 701 for Sennacherib), from page images the user supplied on
  2026-10-07; pp. 180–186 (Carchemish 605, the 597 capture, Ezekiel 593, Jerusalem 586, Josiah 609, the
  B.M. tablet numbers) and the chapter opening on 931/930; the page-by-page ledger is
  `docs/sources/thiele-1983.md`. Still through Young only: Solomon's accession and the temple
  foundation.** Young's JETS page locators in batch B were mapped from PDF page order, not checked
  against printed headers.
- **No named holder** for: the 30 CE crucifixion, Ezekiel's 593 call, Babylon 539, the temple's
  516 and 450–400 datings, Ezra 398, Nehemiah 445/444, Alexander, Antiochus, Pompey.
- **Verses linked on the text alone**, with no source tying them to the event: Daniel 8:5–8 and
  11:3 to Alexander. Pompey has no verse links because no corpus passage narrates it.
- **Irenaeus on Revelation** is cited as quoted in Eusebius (HE 5.8.6, 3.18.3), not read directly.
- Still unconfirmed: Seder Olam's dates from its own text; Kitchen's own pages;
  whether the Bubastite Portal names Jerusalem (the debate is now recorded); the Delphi inscription's find-spot
  and editor; Peter's death year; Josephus on the Baptist and on Festus (not read).

A plain-language pass on 2026-10-07 rewrote every summary, argument and note for a lay reader. A
checker confirmed that no id, label, tradition, year, holder, citation, locator or verse reference
changed. The editors added short glosses at a term's first appearance in a file ("Ussher's 1650s
count, not an archaeological date"; "Seder Olam Rabbah, an early Jewish chronology"; what a
coregency or an acclamation is). Those glosses are the editors' wording and are not separately
cited; a reviewer should read them as explanation, not as sourced claims.
