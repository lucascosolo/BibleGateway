# Charles (ed.), The Apocrypha and Pseudepigrapha of the Old Testament, vol. 2 (Clarendon, 1913)

The Apocrypha and Pseudepigrapha of the Old Testament in English, vol. 2: Pseudepigrapha, R. H. Charles (ed.); Psalms of Solomon trans. G. Buchanan Gray; Oxford: Clarendon Press, 1913. Fetched 2026-10-09 from
https://archive.org/details/Charles_The-Apocrypha-of-the-Old-Testament-vol-2_1913 (item `Charles_The-Apocrypha-of-the-Old-Testament-vol-2_1913`): the per-leaf OCR `charles2_djvu.xml.gz`, the item's metadata JSON, and `charles2_page_numbers.json`, as downloaded. The djvu.xml exceeds 50 MB and is stored gzipped (`charles2_djvu.xml.gz`, `gzip -9 -n`); the uncompressed bytes, sha256 `50de7a94...`, byte-identical to the copy under `outside/gray-psalms-solomon/`, are archived at `~/.archive/2026-10-09/charles2_djvu.xml.rawcopy-after-gzip`.
Filed at `~/.cache/jot/sources/charles-1913-apot-2/`. Main file `text.txt` (UTF-8 NFC, 4,489,109 bytes), sha256
`8c0e1a4b7730e1a7ad18026842c02ef881ba4f734fd248f569eeeb909fc25edd`; other files: `archive-metadata.json` `a3f4453babb6`, `charles2_djvu.xml.gz` `3c9d64f511e0`, `charles2_page_numbers.json` `7f5978a708ac`. Folder total 15,840,957 bytes. `~/.cache/jot/sources/outside/gray-psalms-solomon/` holds the verse-numbered text of the same edition.

Rights: Published 1913 (Clarendon Press, Oxford), so public domain in the US as of 2026-01-01 (published before 1931). Editor R. H. Charles d. 1931 (evidence saved at outside/charles-1enoch/licence-wikipedia-charles.html: 1855-1931); G. B. Gray d. 1922 (outside/gray-psalms-solomon/licence-wikidata-Q18912044.json).

Marker scheme: `text.txt` is the OCR text, leaf by leaf. Each leaf opens with `# p. <printed page> (leaf <n>)`
(lowercase roman numerals for front matter), `# p. <page> (leaf <n>, inferred)` where the page is computed from the
offset but its folio was not legible in the OCR, or `# leaf <n>` for leaves outside the work's own pagination.
Page offset: Roman front matter: printed page = leaf (leaves 3-14, iii-xiv). Arabic: printed page = leaf - 14 (leaves 15-884, pp. 1-870). page_numbers.json says leaf - 13 and is WRONG by one (it puts 4 Ezra 14 on p. 625); the OCR folios (660 leaves, 16-850) and the Psalms of Solomon title leaf (639 = p. 625) say leaf - 14. archive.org's own `page_numbers.json` confidence: 85. OCR text has recognition errors; verse-level reading belongs to the `outside/` files, not this one.

Cited pages (Psalms of Solomon, intro., p. 625; pp. 628-630): p. 625 is the first page of the Psalms of Solomon introduction (title, "Short account of the book"); pp. 628-630 are the same introduction (original language, date, the identification with Pompey). The `page_numbers.json` that archive.org supplies is off by one for this item (leaf - 13; it would put 4 Ezra 14 on p. 625); the OCR folios and the Psalms of Solomon title leaf prove leaf - 14, which is what the markers use. The `inferred` flag on p. 625 means the folio itself was not read on that leaf (it opens a chapter and carries a signature mark); p. 624 and p. 626 both read correctly.

How to open a citation: from `~/.cache/jot/sources/charles-1913-apot-2/`, `grep -n '^# p. 625 ' text.txt`; the leaf's text follows the marker up to the next `# ` line.

## Used by

- Psalms of Solomon margin notes (the verse text is filed at `~/.cache/jot/sources/outside/gray-psalms-solomon/`, built from the same item).
