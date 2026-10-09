# Use the sources plan

Written 2026-10-08. Precedes `2026-10-08-follow-the-evidence.md`; its three chunks are content and
need no code, so they go first. Each chunk ends with the timeline build and its tests green.

**Goal:** the sources filed in `docs/sources/` on 2026-10-08 are cited on the pages they were
filed for, the canon has dated events on the timeline, and the people the events name have pages.

**Verification for every chunk:**
```
python3 -I packages/timeline/build.py --content packages/timeline/content --corpus ~/.cache/jot/data/bible.db --out ~/.cache/jot/data/timeline.db.new
python3 -m pytest packages/timeline/tests -q --junitxml=$TMPDIR/timeline-junit.xml
```

## Chunk A: textual and authorship issues gain the filed scholarship
Files: `packages/timeline/content/issues/{mark-ending,john-7-53-8-11,johannine-comma,western-text-of-acts,pentateuch-authorship}.toml`; `packages/timeline/content/sources.toml` only if a cited id is missing; the `## Used by` lines of the matching `docs/sources/*.md`.
Sources: Metzger's Textual Commentary, Ehrman 2006 Studies, Hixson and Gurry 2019 for the four textual issues; Baden 2012, van der Toorn 2007, Satlow 2014 for Pentateuch authorship. Texts at `~/.cache/jot/sources/<id>/embedded.txt`, page offsets in each ledger.
Done when: each of the five issues has at least one new view or citation per applicable source, every locator is a printed page checked against the text, and the build and tests pass.

## Chunk B: canon-axis events dated from the primary-text artifacts
Files: new `packages/timeline/content/events/canon-*.toml`; artifacts may gain `events` links; `sources.toml` if needed.
Sources: the eleven artifacts; Lim 2013, McDonald 2017 vol. 1, Metzger 1987 Canon, Gallagher and Meade 2017 for the scholarly dating.
Done when: an event exists for each of the eleven texts with a dated range, a critical position with a citation, and a traditional position where one is held, and the build and tests pass.

## Chunk C: people pages for the major figures the events and issues name but do not have
Files: new `packages/timeline/content/persons/*.toml` (26 exist; format per the existing files and `packages/timeline/README.md`); existing events and issues may gain person links.
Done when: every major figure named in an event or issue summary with no person page has one, with verse links and citations, and the build and tests pass.
