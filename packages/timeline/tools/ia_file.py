#!/usr/bin/env python3
"""File a public-domain Internet Archive scan as a page-marked source.

    python3 -I ia_file.py <archive.org identifier> <slug> [--force]

Writes ~/.cache/jot/sources/<slug>/:
  archive-metadata.json   the item's metadata as archive.org serves it
  text.txt                the OCR text, one block per scan leaf, each opened by
                          "=== leaf N | printed P ===" (P is "?" where the scan has no printed number)
  pages.json              {"scheme": ..., "pages": [{"leaf", "printed", "text_start", "text_end"}]}

Refuses an item archive.org marks access-restricted (a lending copy), and an item with no
hOCR search text. Never deletes anything; refuses to overwrite an existing text.txt unless
--force, and then moves the old folder into ~/.archive first.
"""
from __future__ import annotations

import datetime as dt
import gzip
import json
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path.home() / ".cache" / "jot" / "sources"
ARCHIVE = Path.home() / ".archive"
UA = {"User-Agent": "jot-source-filer/1 (bible.lucascosolo.com)"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    if len(args) != 2:
        print(__doc__)
        return 2
    ident, slug = args
    if not slug or "/" in slug or slug.startswith("."):
        print(f"bad slug {slug!r}")
        return 2
    out = ROOT / slug
    if (out / "text.txt").exists():
        if not force:
            print(f"SKIP {slug}: text.txt exists (use --force)")
            return 0
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        dest = ARCHIVE / stamp / "jot-sources" / f"{slug}-{dt.datetime.now(dt.timezone.utc):%H%M%S}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(out), str(dest))
        print(f"archived old {slug} to {dest}")

    meta = json.loads(fetch(f"https://archive.org/metadata/{ident}"))
    if not meta or "metadata" not in meta:
        print(f"FAIL {ident}: no such item")
        return 1
    md = meta["metadata"]
    restricted = str(md.get("access-restricted-item", "false")).lower() == "true"
    if restricted:
        print(f"FAIL {ident}: access-restricted (lending copy); not filed")
        return 1
    names = [f["name"] for f in meta.get("files", [])]

    def pick(suffix: str) -> str | None:
        hits = sorted(n for n in names if n.endswith(suffix))
        return hits[0] if hits else None

    st_name = pick("_hocr_searchtext.txt.gz")
    pi_name = pick("_hocr_pageindex.json.gz")
    pn_name = pick("_page_numbers.json")
    if not st_name or not pi_name:
        print(f"FAIL {ident}: no hOCR search text/page index (files: {len(names)})")
        return 1

    base = f"https://archive.org/download/{ident}/"
    text = gzip.decompress(fetch(base + st_name)).decode("utf-8", "replace")
    index = json.loads(gzip.decompress(fetch(base + pi_name)))
    printed: dict[int, str] = {}
    if pn_name:
        pn = json.loads(fetch(base + pn_name))
        for p in pn.get("pages", []):
            if p.get("pageNumber"):
                printed[int(p["leafNum"])] = str(p["pageNumber"])

    # Each pageindex entry is [text_start, text_end, hocr_start, hocr_end] into the search text,
    # one per hOCR page, 0-based. `_page_numbers.json` keys by leafNum, which on some scans
    # starts at 1 (or skips a colour card), so the two do not line up by construction. Measured
    # on cuneiformparalle00rogeuoft: hOCR page 130 carries the running head "101", which
    # page_numbers gives to leafNum 131. Find the offset empirically: the one under which the
    # assigned number most often appears in the page's first or last 160 characters.
    spans = [(int(e[0]), int(e[1])) for e in index]

    def header_hit(i: int, num: str) -> bool:
        s, e = spans[i]
        chunk = text[s:e]
        edge = (chunk[:160] + " " + chunk[-160:]).replace("\n", " ")
        return f" {num} " in f" {edge} "

    best_off, best_hits, tested = 0, -1, 0
    for off in range(-3, 4):
        hits = n = 0
        for i in range(len(spans)):
            num = printed.get(i + off)
            if num and num.isdigit():
                n += 1
                hits += header_hit(i, num)
        if hits > best_hits:
            best_off, best_hits, tested = off, hits, n
    rate = (best_hits / tested) if tested else 0.0
    verified = tested > 0 and rate >= 0.25

    out.mkdir(parents=True, exist_ok=True)
    (out / "archive-metadata.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    blocks, pages = [], []
    for leaf, (s, e) in enumerate(spans):
        p = printed.get(leaf + best_off) if verified else None
        blocks.append(f"=== leaf {leaf} | printed {p or '?'} ===\n{text[s:e].strip()}\n")
        pages.append({"leaf": leaf, "printed": p, "text_start": s, "text_end": e})
    (out / "text.txt").write_text("\n".join(blocks))
    (out / "pages.json").write_text(json.dumps({
        "scheme": "leaf = 0-based hOCR page; printed = the page number archive.org read from the "
                  "scan (page_numbers leafNum = leaf + leaf_offset), or null; text offsets index "
                  "the hOCR search text",
        "leaf_offset": best_off,
        "printed_numbers_verified": verified,
        "header_match": {"pages_with_number": tested, "running_head_matches": best_hits,
                         "rate": round(rate, 3)},
        "identifier": ident,
        "url": f"https://archive.org/details/{ident}",
        "filed_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pages": pages,
    }, indent=1))
    numbered = sum(1 for p in pages if p["printed"])
    print(f"OK {slug}: {ident} | {md.get('title')!r} | {md.get('date')} | leaves {len(pages)} "
          f"| printed numbers on {numbered} | offset {best_off} | running-head match "
          f"{best_hits}/{tested} ({rate:.0%}){'' if verified else ' | PRINTED NUMBERS UNVERIFIED'} "
          f"| chars {len(text)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
