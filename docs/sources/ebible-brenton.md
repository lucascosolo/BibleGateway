# Brenton, The Septuagint with Apocrypha: English, eBible eng-Brenton (`ebible-brenton`)

Mapped to the filed folder **`~/.cache/jot/sources/outside/brenton-deutero/`**, which holds the
same eBible download (`eng-Brenton_usfx.zip`, fetched 2026-10-09 from
https://ebible.org/Scriptures/eng-Brenton_usfx.zip, sha256
`15b551aa90483e74fb16aecc9d78a124ae6709dfbcd325d665ca0264fe316896`; cited page
https://ebible.org/find/details.php?id=eng-Brenton). Rights: public domain (1851; eBible statement,
saved there). That folder's `text.txt` has the deuterocanonical books by chapter:verse but
excludes the prefaces, and the citations here are to the Apocrypha preface. So on 2026-10-09
`~/.cache/jot/sources/ebible-brenton/front-and-back-matter.txt` (sha256 `deec466b036cbe2b…`,
174 lines) was extracted from that same zip, with `meta.json`; 65,528 bytes.

Marker scheme: `<USFX book>.para<N>`: `OTH` is "The Books of the Apocrypha" (the "Apoc. Pref."
cited), `XXB` the 1844 preface, `BAK` the appendix. No printed pages in this edition.
How to open a citation: `grep -n '^OTH\.' front-and-back-matter.txt | grep -i maccabees`
(OTH.para32-37); Wisdom is OTH.para15 region, Baruch and the Additions to Daniel by the same grep.
