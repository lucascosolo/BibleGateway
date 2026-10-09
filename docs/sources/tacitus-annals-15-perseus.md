# Tacitus, Annales 15, ed. Fisher, Perseus (`tacitus-annals-15-perseus`)

C. D. Fisher's Oxford Classical Text, *Annales ab excessu divi Augusti* (Clarendon, 1906), as
digitised by the Perseus Digital Library. Cited page
http://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.02.0077%3Abook%3D15%3Achapter%3D44
(saved as `hopper-15.44.html`, sha256 `3e82d2543a887a01…`) plus the full TEI from
PerseusDL/canonical-latinLit (`phi1351.phi005.perseus-lat1.xml`, sha256
`a08b3dc527d04d6f86e43af32d5f8d8c9fa3ab19763bf96426c55528b53e6860`), both fetched 2026-10-09.
Rights: Fisher 1906 is public domain; the Perseus digital text is CC BY-SA 3.0 US (licence link on
the hopper page). Folder `~/.cache/jot/sources/tacitus-annals-15-perseus/`, 949,928 bytes.

Marker scheme: book.chapter from TEI `<milestone unit="chapter">`; `text.txt` holds book 15 only
as `15.<chapter><TAB>text` (74 chapters, editorial notes dropped). No pages (the OCT `pb` tags
carry no numbers). Reads *Christianos* at 15.44.

How to open a citation: `grep -P '^15\.44\t' text.txt`.
