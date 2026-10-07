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
the primary publication. Specifically unconfirmed and left out: the Tel Dan Stele's and the
Pilate Stone's museum numbers, where the Hezekiah bulla is held, the year of the Tel Dan B
fragments (1994 or 1995), the Caiaphas passages' section numbers in Josephus, the dates of
composition of Tacitus and Josephus, every person's life dates, and any explanation of the
Belshazzar discrepancy (the Verse Account's "entrusted the kingship" was seen only in a snippet).
Check first:

- `sources.toml`: `cline-2009` has no confirmed title.
- `artifacts/tacitus-annals-15-44.toml`: the quoted Latin uses the standard `Tiberio`; the
  Latin Library page cited prints `Tibero`.
- `persons/jesus-of-nazareth.toml` and `artifacts/josephus-testimonium-flavianum.toml`: the
  "majority view" wording and Meier's chapter locator.
- `issues/moses-historicity.toml`: Dever's view is summarised from a review and a reference work,
  not from his text.
- `issues/solomon-united-monarchy.toml`: Yadin's attribution is cited only to a reference work.
