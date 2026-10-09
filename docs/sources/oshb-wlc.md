# Westminster Leningrad Codex, OSHB morphhb (`oshb-wlc`)

The Open Scriptures Hebrew Bible's WLC with lemma and morphology tagging, the same repository Jot's
ingest pulls (`packages/ingest/src/ingest.ts`). Source https://github.com/openscriptures/morphhb,
fetched 2026-10-09 as the master tarball (`morphhb-master.tar.gz`, sha256
`aedcf810b6ac3f8e497aa8270f4c8add09b4442c63ceb15b48c3da65f3d1e631`, 20,823,112 bytes) at commit
`3d15126fb1ef74867fc1434be1942e837932691f` (2024-08-27; API response saved as
`github-commit-master.json`). Rights: the WLC text is public domain; OSHB lemma and morphology data
are CC BY 4.0, credit "the Open Scriptures Hebrew Bible Project" (README.md and LICENSE.md in the
tarball). Folder `~/.cache/jot/sources/oshb-wlc/`, 28,245,303 bytes with `text.txt` and `meta.json`.

Marker scheme: OSIS verse ids (`Gen.2.21`), Hebrew versification, no pages. `text.txt` is one verse
per line: `osisID<TAB>surface text<TAB>lemmas` (sha256 `f196480180d62e3e…`, 23,213 verses).

How to open a citation: `grep -P '^Gen\.2\.21\t' text.txt`; "every occurrence of H6763":
`grep -P '\t.*\b[a-z/]*6763\b' text.txt` (32 verses on the 2026-10-09 extraction).
