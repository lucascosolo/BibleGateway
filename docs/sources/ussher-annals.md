# Ussher, The Annals of the World (London: E. Tyler for J. Crook and G. Bedell, 1658)

Source id `ussher-annals`. Filed 2026-10-09 at `~/.cache/jot/sources/ussher-annals/`.

## The cited archive.org item was NOT filed

`sources.toml` cites https://archive.org/details/AnnalsOfTheWorld ("English text, paragraph-numbered").
Fetched `https://archive.org/metadata/AnnalsOfTheWorld` on 2026-10-09 (copy:
`cited-item-AnnalsOfTheWorld-metadata.json`, sha256 `199b5a45a3f677a6d5ea0659a9c71023512251a7b26c09879113d168ee5db956`):

- title: `Annals of the World`; creator `Ussher, James, 1581-1656`; date `1650`; language English
- licenseurl: **None**; rights: **None**; possible-copyright-status: **None**
- collection: `['opensource', 'community']` (an uploader's item, not an IA or library scan)
- files: `Annals.pdf`, `Annals_djvu.txt` (4,257,675 bytes; sha256 `222f128758691ddcf0f51ebe1aa11272dc22195a91880d204a0a50c7dd8c5b97`), no `_page_numbers.json`, no hOCR.

What it is: a modernised-English retyping of the Annals, not a scan of the 1658 printing. Its text opens
"This work is in the Public Domain. Copy Freely / More Freeware From Bennie Blount Ministries
International", rewrites Ussher's prose ("Censorinus, in his little book, the 'Explication of Times
Intervals'..."), carries "Explanatory Notes by Editor" (one quotes a 1989 Foundation for American
Christian Education reprint of Webster's 1828 dictionary), uses headings of the form `2289b AM, 2999 JP, 1715 BC`,
and numbers every paragraph (`131. When Pharaoh could not get his dreams interpreted...`). It has no page
structure. The paragraph numbering and modern editorial apparatus match the modern revised edition lineage
(Larry and Marion Pierce, Master Books, 2003, in copyright; IA holds it as `annalsofworld0000jame`), but the
item does not say so. The "public domain" claim is the uploader's own; the 1650s author is public domain, a
modern editor's revision is not necessarily. Not filed, not copied. The item's `_djvu.txt` was used only to
read which AM year each cited paragraph falls under (table below).

## What was filed instead

**EEBO-TCP A64619** (Wing U149; ESTC R22172): *The annals of the world deduced from the origin of time, and
continued to the beginning of the Emperour Vespasians reign...* by James Ussher, London: Printed by E. Tyler,
for J. Crook ... and for G. Bedell, 1658. Extent in the file: `[10], 907, [54] p.`; "Reproduction of original
in Huntington Library"; images from Early English Books 1641-1700, reel 969:1. Keyed and encoded by the Text
Creation Partnership (Phase 1, 2005-12).

- URL: https://raw.githubusercontent.com/textcreationpartnership/A64619/master/A64619.xml
- Fetched: 2026-10-09 (`date -u` 21:52Z)
- Rights, quoted from the file's `<availability>`: "This Phase I text is available for reuse, according to
  the terms of Creative Commons 0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). The text
  can be copied, modified, distributed and performed, even for commercial purposes, all without asking
  permission." The TCP index row for A64619 reads "Free". Age basis: Ussher died 1656, printing 1658, so the
  underlying work is public domain by age independent of the CC0 dedication of the transcription.

Independent folio cross-check item (not text-filed, metadata and page-number JSON only): archive.org
`bim_early-english-books-1641-1700_the-annals-of-the-world-_ussher-james-abp_1658`, Internet Archive microfilm
scan of the same printing, 973 leaves, collection `pub_early-english-books-1641-1700`; fields licenseurl,
rights and possible-copyright-status are all absent. Its OCR (`_djvu.xml`, tesseract `-l enm`, long-s heavy)
was used only to verify the folios and was not filed.

## Files and hashes (sha256)

| File | Bytes | sha256 |
|---|---|---|
| `A64619.xml` (original download) | 6,231,393 | `7e8f6b02008d2099ba5e4d910d29ac27e7e7aa3520e1346b5723875a6d927daf` |
| `text.txt` | 4,831,002 | `c9cb641461c2dc399f5cbf901a4d466027aa82cac68b93dcbd1d95c5d18766a0` |
| `pages.json` | 108,620 | `31d5639ab382a2cc0133723d03e0ca9bf6ca0c6468d10db4fbf8d4777ad8eb38` |
| `metadata.json` | 1,609 | `247c011a5bafb845c306a8e2882b7d856bb4fa8fba6a808fa0428f92d3ee8e96` |
| `bl-scan_page_numbers.json` (IA `_page_numbers.json`) | 166,553 | `89ea97309ec9466f690d565c87dbaf74e0c71e5d54c1bf9bb926e3a6297bd91b` |
| `bl-scan_item-metadata.json` | 279,230 | `90c82d8d1392a404d57cfb4ce84bc50a5e93d0e082ac01ce3fc72a1ae3a77a47` |
| `cited-item-AnnalsOfTheWorld-metadata.json` | 6,271 | `199b5a45a3f677a6d5ea0659a9c71023512251a7b26c09879113d168ee5db956` |

Total 11,624,678 bytes. Built by `~/.cache/scratch/jot-fetch/scripts-ussher/build.py` and `align.py`.

## Page-marker scheme

`text.txt` has one `=== page N ===` line per `<pb>` in the TCP body (1,007 of them), N = 1-based ordinal in
document order, a page and not a scan leaf: TCP images are two-page spreads (489 images, two `<pb>` each).
Text of the page follows the marker. Marginal references stay inline in square brackets, line-end hyphens are
joined, illegible characters are `•`, foreign-script gaps `[foreign]`. A word that breaks across a page turn
is split by the marker.

`pages.json` maps each N to `{leaf: N, tcp_image, printed, ia_leaf, ia_overlap}`. `printed` is the folio TCP
transcribed (`<pb n=...>`), null on 70 unnumbered pages (blanks, title pages, index leaves). `ia_leaf` is the
0-based leaf of the IA microfilm scan, filled for the 557 numbered pages whose word overlap with that leaf's
OCR is at least 0.4 (null elsewhere because the OCR is poor, not because the page is missing).

## Printed-page offsets (measured, not constant)

TCP ordinal to printed folio: printed = N - 11 for N 12-79 (preliminaries then p. 1 at N = 12); printed = N - 40
for N 80-352; N - 42 and N - 44 across N 378-445; N - 46 for N 455-953 (the extra unnumbered pages sit in
between). Use `pages.json`, not an offset, for a lookup.

Printed folio to IA scan leaf (0-based): leaf = printed + 9 for p. 5-772; leaf = printed + 11 from p. 771 on
(the 1658 printing repeats folio 771 around leaf 781/782; the IA page-number OCR agrees on 768 pages for +9 and 135 for +11).

Three folios checked against the scan, text compared word for word:

| Printed | TCP marker | First line after marker (TCP) | IA leaf, OCR'd folio | IA OCR |
|---|---|---|---|---|
| 100 | page 140 | "offered, to Phocaea, they there put to the sword all the garison..." | 109, "100" | "...when he had spent much time in this work..." (overlap 0.63) |
| 400 | page 444 | "When they returned to Rome, Year of the World 3820 and the Ambassadors..." | 409, "400" | "3821. 400 The sixth Age of the World. When they returned to Rome, and the Ambassadors..." (0.81) |
| 800 | page 846 | "Consuls, [Sueton, in Octavio, cap. 64.] Whence we read in Velleius Paterculus..." | 811, "800" | "The seventh Age of the World. Consuls, [Sueton, in Octavio, cap. 64.] Whence we read in Velleius Pat..." (0.77) |

The p. 100 overlap is lower because the leaf OCR is garbled at the top; the page-number OCR and offset agree.

## Do the citations resolve?

Every `ussher-annals` locator in `packages/timeline/content` is "paragraph N" (15 citations: persons
abraham, jacob, joseph, joshua; events abraham-migration, abraham-covenant, gideon, joseph-in-egypt,
jacob-descent-egypt, conquest-of-canaan, samson, sinai-covenant, deborah-barak). **They do not resolve in the
1658 printing.** The 1658 text has no paragraph numbers; its pages carry running folios and its chronology is
carried by marginal "Year of the World N" labels (and Julian Period / Year before Christ). The paragraph numbers
belong to the modernised edition (the cited archive.org item), so the citations must be converted to a 1658
page, or to an Anno Mundi year, before they can be checked against the filed text.

Lead for that conversion, from the cited item's AM headings (paragraph, heading in the modernised text):
70 = 2083a AM; 71 = 2083 AM; 77 = 2092 AM; 81 = 2107c AM; 131-132 = 2289b AM; 133 = 2296c AM; 135-138 = 2298b AM;
192 = 2513b AM; 312 = 2553c AM; 351 = 2719d AM; 356 = 2759d AM; 379 = 2840a AM; 380 = 2849b AM.
Not done: locating those years in the 1658 pages. A plain search for "Year of the World N" in `text.txt`
only found preface hits for those years, so the narrative uses other margin forms; the next agent should search
by event content, not label. Paragraph 192 ("The third month") carries no event wording, and the sources.toml
title and the citations should say "modernised edition" or be re-cited to 1658 pages.

## Used by

(to be filled by the next agent)
