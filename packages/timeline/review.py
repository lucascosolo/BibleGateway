#!/usr/bin/env python3
"""Write a Markdown review sheet for the timeline's draft content.

    python3 packages/timeline/review.py --db data/timeline.db --out review.md [--all] [--corpus data/bible.db]

One checklist entry per draft artifact, event, person and issue: every claim it makes, each with
its citations (title, author, year, locator, URL), and the TOML file to edit. A reviewer checks a
batch against the cited sources and flips `status = "draft"` to `status = "reviewed"` in those
files, then rebuilds. `--all` includes entries already reviewed. With `--corpus`, verse links are
shown as references (`1Kgs 6:1`) instead of raw verse ids.

Stdlib only; reads the built database and writes only --out. Contract: Revision 2 of
docs/plans/2026-10-06-timeline-backend.md.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path


class Sheet:
    def __init__(self, db: sqlite3.Connection, books: dict[int, str], include_reviewed: bool) -> None:
        self.db = db
        self.books = books
        self.include_reviewed = include_reviewed
        self.lines: list[str] = []

    # --- helpers ---------------------------------------------------------------------------

    def rows(self, sql: str, *params) -> list[sqlite3.Row]:
        return self.db.execute(sql, params).fetchall()

    def emit(self, line: str = "") -> None:
        self.lines.append(line)

    def wanted(self, status: str) -> bool:
        return self.include_reviewed or status == "draft"

    @staticmethod
    def years(earliest: int | None, latest: int | None) -> str:
        if earliest is None or latest is None:
            return "date not established"

        def one(year: int) -> str:
            return f"{abs(year)} {'BCE' if year < 0 else 'CE'}"

        return one(earliest) if earliest == latest else f"{one(earliest)} – {one(latest)}"

    def verse(self, verse_id: int) -> str:
        book, rest = divmod(verse_id, 1_000_000)
        chapter, verse = divmod(rest, 1_000)
        return f"{self.books.get(book, f'book {book}')} {chapter}:{verse}"

    def verse_lines(self, kind: str, subject: str, indent: str) -> None:
        for link in self.rows(
            "SELECT start_verse_id, end_verse_id, link_type, note FROM verse_links WHERE subject_kind = ? AND subject_id = ? ORDER BY start_verse_id",
            kind, subject,
        ):
            span = self.verse(link["start_verse_id"])
            if link["end_verse_id"] != link["start_verse_id"]:
                span += f" – {self.verse(link['end_verse_id'])}"
            note = f" ({link['note']})" if link["note"] else ""
            self.emit(f"{indent}- Verse ({link['link_type']}): {span}{note}")

    def citation_lines(self, kind: str, subject: str, indent: str) -> None:
        for c in self.rows(
            """SELECT s.title, s.author, s.year, s.container, s.url, c.locator
               FROM citations c JOIN sources s ON s.source_id = c.source_id
               WHERE c.subject_kind = ? AND c.subject_id = ? ORDER BY c.ordinal""",
            kind, subject,
        ):
            parts = [f"*{c['title']}*"]
            if c["author"]:
                parts.append(c["author"])
            if c["container"]:
                parts.append(c["container"])
            if c["year"]:
                parts.append(str(c["year"]))
            if c["locator"]:
                parts.append(c["locator"])
            url = f" <{c['url']}>" if c["url"] else ""
            self.emit(f"{indent}- Source: {', '.join(parts)}{url}")

    def header(self, title: str, path: str, status: str) -> None:
        self.emit(f"- [ ] **{title}** — `{path}` ({status})")

    def text(self, label: str, value: str, indent: str = "  ") -> None:
        self.emit(f"{indent}- {label}: {value}")

    # --- sections --------------------------------------------------------------------------

    def artifacts(self) -> None:
        rows = [r for r in self.rows("SELECT * FROM artifacts ORDER BY made_earliest, artifact_id") if self.wanted(r["status"])]
        if not rows:
            return
        self.emit("## Artifacts and texts outside the Bible")
        self.emit()
        for a in rows:
            self.header(a["name"], f"artifacts/{a['artifact_id']}.toml", a["status"])
            self.text("Kind", f"{a['kind']}, {a['language']}")
            self.text("Made", self.years(a["made_earliest"], a["made_latest"]))
            if a["institution"]:
                self.text("Held by", a["institution"] + (f", {a['accession']}" if a["accession"] else ""))
            if a["discovered_year"] or a["discovered_place"]:
                found = ", ".join(str(x) for x in (a["discovered_year"], a["discovered_place"]) if x)
                self.text("Discovered", found)
            self.text("Summary", a["summary"])
            self.citation_lines("artifact", a["artifact_id"], "  ")
            self.verse_lines("artifact", a["artifact_id"], "  ")
            self.emit()

    def events(self) -> None:
        rows = [r for r in self.rows("SELECT * FROM events ORDER BY axis, earliest_year, event_id") if self.wanted(r["status"])]
        if not rows:
            return
        self.emit("## Events")
        self.emit()
        for e in rows:
            self.header(e["title"], f"events/{e['event_id']}.toml", e["status"])
            self.text("Axis / confidence", f"{e['axis']} / {e['confidence']}; range {self.years(e['earliest_year'], e['latest_year'])}")
            self.text("Summary", e["summary"])
            self.verse_lines("event", e["event_id"], "  ")
            for p in self.rows("SELECT * FROM positions WHERE event_id = ? ORDER BY ordinal", e["event_id"]):
                held = f", held by {p['held_by']}" if p["held_by"] else ""
                self.emit(f"  - Position **{p['label']}** ({self.years(p['earliest_year'], p['latest_year'])}{held}): {p['summary']}")
                self.citation_lines("position", p["position_id"], "    ")
                for a in self.rows("SELECT * FROM arguments WHERE position_id = ? ORDER BY ordinal", p["position_id"]):
                    self.emit(f"    - Argument ({a['stance']}): {a['text']}")
                    self.citation_lines("argument", a["argument_id"], "      ")
                    self.verse_lines("argument", a["argument_id"], "      ")
            for t in self.rows(
                """SELECT t.attestation_id, t.relation, t.note, a.name FROM attestations t
                   JOIN artifacts a ON a.artifact_id = t.artifact_id WHERE t.event_id = ? ORDER BY a.artifact_id""",
                e["event_id"],
            ):
                self.emit(f"  - Attestation — {t['name']} *{t['relation']}*: {t['note']}")
                self.citation_lines("attestation", t["attestation_id"], "    ")
            self.emit()

    def persons(self) -> None:
        rows = [r for r in self.rows("SELECT * FROM persons ORDER BY lived_earliest, name") if self.wanted(r["status"])]
        if not rows:
            return
        self.emit("## People")
        self.emit()
        for p in rows:
            self.header(p["name"], f"persons/{p['person_id']}.toml", p["status"])
            aliases = json.loads(p["also_known_as"]) if p["also_known_as"] else []
            if aliases:
                self.text("Also known as", ", ".join(aliases))
            self.text("Role", p["role"])
            if p["lived_earliest"] is not None:
                self.text("Lived", self.years(p["lived_earliest"], p["lived_latest"]))
            tension = "; a source is in tension with a biblical detail" if p["has_tension"] else ""
            self.text("Evidence grade (derived)", f"{p['evidence']}{tension}")
            self.text("Summary", p["summary"])
            self.citation_lines("person", p["person_id"], "  ")
            self.verse_lines("person", p["person_id"], "  ")
            for t in self.rows(
                """SELECT t.attestation_id, t.relation, t.note, a.name FROM person_attestations t
                   JOIN artifacts a ON a.artifact_id = t.artifact_id WHERE t.person_id = ? ORDER BY a.artifact_id""",
                p["person_id"],
            ):
                self.emit(f"  - Attestation — {t['name']} *{t['relation']}*: {t['note']}")
                self.citation_lines("person_attestation", t["attestation_id"], "    ")
            self.emit()

    def issues(self) -> None:
        rows = [r for r in self.rows("SELECT * FROM issues ORDER BY kind, issue_id") if self.wanted(r["status"])]
        if not rows:
            return
        self.emit("## Issues")
        self.emit()
        for i in rows:
            self.header(i["title"], f"issues/{i['issue_id']}.toml", i["status"])
            self.text("Kind", i["kind"])
            self.text("Summary", i["summary"])
            self.citation_lines("issue", i["issue_id"], "  ")
            self.verse_lines("issue", i["issue_id"], "  ")
            for v in self.rows("SELECT * FROM issue_views WHERE issue_id = ? ORDER BY ordinal", i["issue_id"]):
                self.emit(f"  - View **{v['label']}**: {v['text']}")
                self.citation_lines("issue_view", v["view_id"], "    ")
            self.emit()

    def render(self) -> str:
        build = self.db.execute("SELECT value FROM meta WHERE key = 'build_id'").fetchone()
        scope = "all entries" if self.include_reviewed else "draft entries only"
        self.emit("# Timeline review sheet")
        self.emit()
        self.emit(f"Build `{build[0] if build else 'unknown'}`, {scope}. Check each claim against its cited source; when an")
        self.emit('entry holds up, set `status = "reviewed"` in its file (path in backticks) and rebuild.')
        self.emit("A claim you cannot confirm should be cut or corrected, not left in.")
        self.emit()
        self.artifacts()
        self.events()
        self.persons()
        self.issues()
        return "\n".join(self.lines).rstrip() + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--all", action="store_true", help="include entries already reviewed")
    parser.add_argument("--corpus", type=Path, help="bible.db, to show verse links as references")
    args = parser.parse_args(argv)
    if not args.db.is_file():
        print(f"{args.db}: timeline database not found", file=sys.stderr)
        return 2
    books: dict[int, str] = {}
    if args.corpus:
        corpus = sqlite3.connect(f"file:{args.corpus}?mode=ro", uri=True)
        books = dict(corpus.execute("SELECT book_id, osis_id FROM books"))
        corpus.close()
    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    try:
        text = Sheet(db, books, args.all).render()
    finally:
        db.close()
    args.out.write_text(text, encoding="utf-8")
    print(f"review sheet -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
