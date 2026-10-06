#!/usr/bin/env python3
"""Check crawler-visible output against a running preview, without a browser or JS.

Usage: python3 scripts/check-discovery.py http://127.0.0.1:3988
Canonical/sitemap URLs remain production URLs; requests are remapped to the preview.
"""

import argparse
from collections import Counter
from html.parser import HTMLParser
import re
from pathlib import Path
import sqlite3
import sys
from urllib.error import HTTPError
from urllib.parse import parse_qs, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.skip = 0
        self.text = []
        self.links = []
        self.canonicals = []
        self.meta = {}
        self.title = []
        self.in_title = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style"):
            self.skip += 1
        if tag == "title":
            self.in_title = True
        if tag == "meta":
            self.meta[attrs.get("name", attrs.get("property", ""))] = attrs.get("content", "")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href", ""))
        if tag == "a":
            self.links.append(attrs.get("href", ""))

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)
            if self.in_title:
                self.title.append(data)


def address(url):
    parts = urlsplit(url)
    return parts.path, parse_qs(parts.query).get("t", [None])[0]


def verify_corpus(db_path, addresses, check):
    """Independent oracle: join IDs in Python from separate source-table scans."""
    with sqlite3.connect(Path(db_path).resolve().as_uri() + "?mode=ro", uri=True) as db:
        books = dict(db.execute("SELECT book_id, osis_id FROM books"))
        verses = {
            verse_id: (books[book_id], chapter, verse)
            for verse_id, book_id, chapter, verse in db.execute(
                "SELECT verse_id, book_id, chapter, verse FROM verses"
            )
        }
        editions = dict(db.execute("SELECT translation_id, code FROM translations"))
        actual_editions = {code for path, code in addresses if path.startswith("/read/")}
        check(actual_editions <= set(editions.values()), "sitemap has no unknown/unlabelled reader editions")
        for translation_id, code in editions.items():
            available = set()
            for table in ("verse_texts", "verse_omissions"):
                available.update(row[0] for row in db.execute(
                    f"SELECT verse_id FROM {table} WHERE translation_id = ?", (translation_id,)
                ))
            expected = set()
            for verse_id in available:
                if verse_id not in verses:
                    continue
                book, chapter, verse = verses[verse_id]
                expected.update((f"/read/{book}", f"/read/{book}.{chapter}", f"/read/{book}.{chapter}.{verse}"))
            actual = {unquote(path) for path, translation in addresses if path.startswith("/read/") and translation == code}
            missing, extra = expected - actual, actual - expected
            check(not missing, f"{code} exhaustive coverage: {len(expected)} expected URLs; {len(missing)} missing {sorted(missing)[:3]}")
            check(not extra, f"{code} exact scope: {len(extra)} invented/out-of-scope URLs {sorted(extra)[:3]}")

        expected_keys = set()
        for strongs, lemma in db.execute("SELECT strongs, lemma FROM original_words"):
            key = strongs if strongs is not None else lemma
            if key:
                expected_keys.add(key)
        actual_keys = {unquote(path[len('/lashon/'):]) for path, _ in addresses if path.startswith("/lashon/")}
        missing, extra = expected_keys - actual_keys, actual_keys - expected_keys
        check(not missing, f"concordance exhaustive coverage: {len(expected_keys)} keys; {len(missing)} missing {sorted(missing)[:3]}")
        check(not extra, f"concordance exact scope: {len(extra)} unsupported keys {sorted(extra)[:3]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url")
    parser.add_argument("--db", help="Optional bible.db for exhaustive, independent sitemap coverage checks")
    args = parser.parse_args()
    base = urlsplit(args.base_url)
    failures = []

    def check(condition, message):
        print(f"{'PASS' if condition else 'FAIL'} {message}")
        if not condition:
            failures.append(message)

    def fetch(url):
        parts = urlsplit(url)
        target = urlunsplit((base.scheme, base.netloc, parts.path, parts.query, ""))
        request = Request(target, headers={"User-Agent": "JotDiscoveryCheck/1.0"})
        try:
            response = urlopen(request, timeout=60)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read().decode("utf-8")

    status, _, robots = fetch("/robots.txt")
    check(status == 200, "robots.txt available")
    robot = RobotFileParser()
    robot.parse(robots.splitlines())
    for agent in ("Googlebot", "bingbot", "GPTBot", "OAI-SearchBot", "ClaudeBot", "CCBot"):
        check(robot.can_fetch(agent, "/read/Hab.2.1?t=WEB"), f"{agent} can crawl scripture")

    pending = robot.site_maps() or []
    check(bool(pending), "robots.txt advertises sitemap")
    visited = set()
    addresses = set()
    counts = Counter()
    while pending:
        sitemap = pending.pop()
        path = urlsplit(sitemap).path
        if path in visited:
            continue
        visited.add(path)
        if len(visited) > 100:
            raise RuntimeError("Sitemap traversal exceeded 100 documents")
        status, _, xml = fetch(sitemap)
        check(status == 200, f"sitemap {path} available")
        if status != 200:
            continue
        root = ET.fromstring(xml)
        locations = [node.text for node in root.findall(".//{*}loc") if node.text]
        if root.tag.rsplit("}", 1)[-1] == "sitemapindex":
            pending.extend(locations)
            continue
        check(len(locations) <= 50_000, f"sitemap {path} fits protocol URL limit")
        for url in locations:
            key = address(url)
            addresses.add(key)
            if key[0].startswith("/read/"):
                counts[key[1]] += 1
    for translation in ("WEB", "BSB", "KJV", "ASV", "DBY", "YLT"):
        check(counts[translation] >= 31_000, f"{translation} sitemap covers full verse corpus ({counts[translation]} reader URLs)")
    check(counts["JPS"] >= 23_000, "JPS sitemap covers Old Testament")
    if args.db:
        verify_corpus(args.db, addresses, check)
    for slug, translation in (("John.4.11", "WEB"), ("John.4.11", "KJV"), ("Hab.2.1", "WEB"), ("John.5.4", "BSB")):
        route = f"/read/{slug}"
        check((route, translation) in addresses, f"{slug} {translation} discoverable in sitemap")
        status, headers, html = fetch(f"{route}?t={translation}")
        page = Page(html)
        text = " ".join(page.text)
        check(status == 200, f"{slug} {translation} serves 200")
        check(len(page.canonicals) == 1 and address(page.canonicals[0]) == (route, translation), f"{slug} {translation} canonical preserves translation")
        check(len(page.canonicals) == 1 and urlsplit(page.canonicals[0]).scheme == "https" and urlsplit(page.canonicals[0]).netloc == "bible.lucascosolo.com", f"{slug} {translation} canonical uses public origin")
        check(translation in " ".join(page.title), f"{slug} {translation} title names translation")
        chapter, verse = slug.split(".")[-2:]
        check(f"{chapter}:{verse}" in " ".join(page.title), f"{slug} {translation} title names specific verse")
        check(bool(page.meta.get("description")), f"{slug} {translation} has description")
        check("noindex" not in (page.meta.get("robots", "") + headers.get("X-Robots-Tag", "")), f"{slug} {translation} indexable")
        if slug == "John.4.11":
            check("the well is deep" in text.lower(), f"{slug} {translation} scripture in raw HTML")
            check(bool(re.search(r"cross.references", text, re.I)), f"{slug} {translation} reference context in raw HTML")
            references = [address(link) for link in page.links if re.match(r"/read/[^/?]+\.\d+\.\d+", urlsplit(link).path)]
            check(any(ref != route and trans == translation for ref, trans in references), f"{slug} {translation} links to other specific verses in raw HTML")
        if slug == "John.5.4":
            check(bool(re.search(r"omit|manuscript|not included", text, re.I)), "omitted verse explains manuscript absence in raw HTML")
    check(not any(path == "/read/Gen.1.32" for path, _ in addresses), "sitemap excludes phantom Genesis 1:32")
    check(("/read/John.4.11", "JPS") not in addresses, "sitemap excludes absent JPS New Testament")
    status, _, html = fetch("/parallel/John.4.11?a=KJV&b=WEB")
    parallel = Page(html)
    check(status == 200 and any(address(link) == ("/read/John.4.11", "KJV") for link in parallel.links),
          "comparison links back to reader in its primary translation")
    for route in ("/read/Gen.1.32", "/read/not-a-reference", "/read/John.4.11?t=NIV"):
        status, _, _ = fetch(route)
        check(status == 404, f"{route} returns real HTTP 404")
    for route in ("/notes", "/style", "/toledot", "/geniza", "/massaot", "/read/John.4.11?t=JPS"):
        status, headers, html = fetch(route)
        page = Page(html)
        check(status == 404 or "noindex" in (page.meta.get("robots", "") + headers.get("X-Robots-Tag", "")), f"{route} excluded from indexing")
        check(address(route) not in addresses, f"{route} excluded from sitemap")
    print(f"\n{len(failures)} failure(s); inspected {len(visited)} sitemap document(s).")
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())
