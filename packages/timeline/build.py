#!/usr/bin/env python3
"""Compile the Toledot timeline content (TOML) into data/timeline.db.

    python3 packages/timeline/build.py --content packages/timeline/content \
        --corpus data/bible.db --out data/timeline.db

Stdlib only (tomllib, sqlite3), so it runs anywhere Python 3.11+ does with nothing to install.
The contract is docs/plans/2026-10-06-timeline-backend.md; the schema is schema.sql beside this
file.

Two properties matter more than anything else here:

* **Every claim is cited and every verse is real.** The gates below refuse an uncited position,
  argument, attestation or issue, a citation to a source that is not in the bibliography, and a
  verse link to an id that does not exist in bible.db. The verse-id space is SPARSE: Gen.1.32
  encodes fine and is not a verse, so existence is checked against the real `verses` table,
  never inferred from the encoding.
* **A failed build changes nothing on disk.** Every gate runs before any file is created; the
  database is assembled in memory and only then copied to a temporary file beside --out and
  renamed over it. All failures are reported in one run, so a reviewer fixes a batch, not one
  error per invocation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import tempfile
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"
SCHEMA_VERSION = "1"

ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
REF_RE = re.compile(r"^([1-4]?[A-Za-z]+)\.(\d+)\.(\d+)$")

SOURCE_KINDS = {"book", "chapter", "article", "edition", "museum", "web"}
AXES = {"narrative", "composition", "canon"}
CATEGORIES = {"biblical-narrative", "political", "composition", "canon"}
CONFIDENCE = {"firm", "contested", "speculative"}
STATUSES = {"draft", "reviewed"}
STANCES = {"for", "against"}
RELATIONS = {"corroborates", "partially-corroborates", "consistent", "silent", "in-tension"}
ARTIFACT_KINDS = {"inscription", "chronicle", "relief", "papyrus", "ostracon", "manuscript", "seal", "coin", "site"}
ISSUE_KINDS = {"chronology", "textual", "historical", "internal"}
LINK_TYPES = {"describes", "alludes", "background", "dates"}


# --- Diagnostics -----------------------------------------------------------------------------


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def error(self, where: str, message: str) -> None:
        self.errors.append(f"{where}: {message}")

    def warn(self, where: str, message: str) -> None:
        self.warnings.append(f"{where}: {message}")


# --- Field checking --------------------------------------------------------------------------

# A field spec is (type, required). `int` excludes bool, which Python counts as an int.
Spec = dict[str, tuple[type | tuple[type, ...], bool]]


def check_table(report: Report, where: str, value: Any, spec: Spec) -> dict[str, Any] | None:
    """Validate one TOML table against a spec. Unknown keys are errors: a misspelt optional key
    (`earliest_yr`) would otherwise vanish silently and the row would ship without it."""
    if not isinstance(value, dict):
        report.error(where, f"expected a table, got {type(value).__name__}")
        return None
    ok = True
    for key in value:
        if key not in spec:
            report.error(where, f"unknown key '{key}'")
            ok = False
    for key, (kind, required) in spec.items():
        if key not in value:
            if required:
                report.error(where, f"missing required key '{key}'")
                ok = False
            continue
        item = value[key]
        if kind is int or kind == (int,):
            good = isinstance(item, int) and not isinstance(item, bool)
        else:
            good = isinstance(item, kind)
        if not good:
            report.error(where, f"'{key}' has the wrong type ({type(item).__name__})")
            ok = False
        elif isinstance(item, str) and not item.strip() and required:
            report.error(where, f"'{key}' is empty")
            ok = False
    return value if ok else None


def check_enum(report: Report, where: str, key: str, value: str, allowed: set[str]) -> bool:
    if value not in allowed:
        report.error(where, f"'{key}' must be one of {sorted(allowed)}, got '{value}'")
        return False
    return True


def check_id(report: Report, where: str, value: str) -> bool:
    if not ID_RE.match(value):
        report.error(where, f"id '{value}' must match {ID_RE.pattern}")
        return False
    return True


def check_years(report: Report, where: str, earliest: int, latest: int, label: str = "range") -> bool:
    ok = True
    for year in (earliest, latest):
        if year == 0:
            report.error(where, f"{label}: there is no year 0 (use -1 for 1 BCE, 1 for 1 CE)")
            ok = False
    if earliest > latest:
        report.error(where, f"{label}: earliest {earliest} is after latest {latest}")
        ok = False
    return ok


# --- Corpus ----------------------------------------------------------------------------------


@dataclass
class Corpus:
    book_ids: dict[str, int]
    verse_ids: set[int]
    build_id: str


def load_corpus(path: Path) -> Corpus:
    db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        book_ids = {osis: book_id for book_id, osis in db.execute("SELECT book_id, osis_id FROM books")}
        verse_ids = {row[0] for row in db.execute("SELECT verse_id FROM verses")}
        row = db.execute("SELECT value FROM corpus_meta WHERE key = 'build_id'").fetchone()
    finally:
        db.close()
    return Corpus(book_ids, verse_ids, row[0] if row else "unknown")


def verse_id(book_id: int, chapter: int, verse: int) -> int:
    return book_id * 1_000_000 + chapter * 1_000 + verse


def resolve_ref(report: Report, where: str, ref: str, corpus: Corpus) -> tuple[int, int] | None:
    """`Book.C.V` or `Book.C.V-Book.C.V` to (start, end) verse ids, each of which must exist."""
    ends = ref.split("-")
    if len(ends) not in (1, 2):
        report.error(where, f"verse ref '{ref}' is not 'Book.C.V' or 'Book.C.V-Book.C.V'")
        return None
    ids: list[int] = []
    for end in ends:
        match = REF_RE.match(end.strip())
        if not match:
            report.error(where, f"verse ref '{ref}': '{end}' is not 'Book.C.V'")
            return None
        book, chapter, verse = match.group(1), int(match.group(2)), int(match.group(3))
        if book not in corpus.book_ids:
            report.error(where, f"verse ref '{ref}': unknown OSIS book '{book}'")
            return None
        vid = verse_id(corpus.book_ids[book], chapter, verse)
        if vid not in corpus.verse_ids:
            report.error(where, f"verse ref '{ref}': {end} does not exist in the corpus")
            return None
        ids.append(vid)
    start, end_id = ids[0], ids[-1]
    if start > end_id:
        report.error(where, f"verse ref '{ref}': start is after end")
        return None
    return start, end_id


# --- Content model ---------------------------------------------------------------------------

CITATION_SPEC: Spec = {"source": (str, True), "locator": (str, False)}
VERSE_SPEC: Spec = {"ref": (str, True), "link": (str, True), "note": (str, False)}


@dataclass
class Content:
    sources: dict[str, dict[str, Any]] = field(default_factory=dict)
    eras: list[dict[str, Any]] = field(default_factory=list)
    artifacts: dict[str, dict[str, Any]] = field(default_factory=dict)
    events: dict[str, dict[str, Any]] = field(default_factory=dict)
    issues: dict[str, dict[str, Any]] = field(default_factory=dict)
    cited: set[str] = field(default_factory=set)


def tidy(value: Any) -> Any:
    """Strip surrounding whitespace from every string, recursively.

    Long prose is written as indented multi-line TOML strings, which keep the indentation of
    their first line. Normalising here keeps it out of the database and out of the fingerprint,
    so re-indenting a file is not a content change."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return [tidy(item) for item in value]
    if isinstance(value, dict):
        return {key: tidy(item) for key, item in value.items()}
    return value


def read_toml(report: Report, path: Path) -> dict[str, Any] | None:
    try:
        with path.open("rb") as handle:
            return tidy(tomllib.load(handle))
    except tomllib.TOMLDecodeError as error:
        report.error(str(path), f"invalid TOML: {error}")
    except OSError as error:
        report.error(str(path), f"cannot read: {error}")
    return None


def citations(report: Report, where: str, value: Any, content: Content, required: bool = True) -> list[dict[str, Any]]:
    if value is None:
        if required:
            report.error(where, "needs at least one citation")
        return []
    if not isinstance(value, list) or (required and not value):
        report.error(where, "needs at least one citation")
        return []
    out: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        cited = check_table(report, f"{where} citation {index + 1}", item, CITATION_SPEC)
        if cited is None:
            continue
        # Resolved against the bibliography after every file is read; recorded here.
        out.append({"source": cited["source"], "locator": cited.get("locator")})
    return out


def verses(report: Report, where: str, value: Any, corpus: Corpus) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list):
        report.error(where, "'verses' must be an array of tables")
        return []
    out: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        here = f"{where} verse {index + 1}"
        link = check_table(report, here, item, VERSE_SPEC)
        if link is None or not check_enum(report, here, "link", link["link"], LINK_TYPES):
            continue
        resolved = resolve_ref(report, here, link["ref"], corpus)
        if resolved:
            out.append({"start": resolved[0], "end": resolved[1], "link": link["link"], "note": link.get("note")})
    return out


def load_sources(report: Report, path: Path, content: Content) -> None:
    data = read_toml(report, path)
    if data is None:
        return
    for key in data:
        if key != "source":
            report.error(str(path), f"unknown key '{key}'")
    spec: Spec = {
        "id": (str, True), "kind": (str, True), "title": (str, True), "author": (str, False),
        "container": (str, False), "publisher": (str, False), "year": (int, False),
        "url": (str, False), "isbn": (str, False),
    }
    for index, raw in enumerate(data.get("source", [])):
        where = f"{path} source {index + 1}"
        source = check_table(report, where, raw, spec)
        if source is None or not check_id(report, where, source["id"]):
            continue
        check_enum(report, where, "kind", source["kind"], SOURCE_KINDS)
        if source["id"] in content.sources:
            report.error(where, f"duplicate source id '{source['id']}'")
            continue
        content.sources[source["id"]] = source


def load_eras(report: Report, path: Path, content: Content) -> None:
    data = read_toml(report, path)
    if data is None:
        return
    for key in data:
        if key != "era":
            report.error(str(path), f"unknown key '{key}'")
    spec: Spec = {
        "id": (str, True), "name": (str, True), "start": (int, True), "end": (int, True),
        "summary": (str, True), "citations": (list, True),
    }
    seen: set[str] = set()
    for index, raw in enumerate(data.get("era", [])):
        where = f"{path} era {index + 1}"
        era = check_table(report, where, raw, spec)
        if era is None or not check_id(report, where, era["id"]):
            continue
        if era["id"] in seen:
            report.error(where, f"duplicate era id '{era['id']}'")
            continue
        seen.add(era["id"])
        check_years(report, where, era["start"], era["end"])
        content.eras.append({**era, "citations": citations(report, where, era["citations"], content)})


def entity_files(report: Report, directory: Path) -> list[tuple[Path, dict[str, Any]]]:
    if not directory.is_dir():
        return []
    out: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(directory.glob("*.toml")):
        data = read_toml(report, path)
        if data is None:
            continue
        if data.get("id") != path.stem:
            report.error(str(path), f"id '{data.get('id')}' must equal the file name '{path.stem}'")
            continue
        out.append((path, data))
    return out


def load_artifacts(report: Report, directory: Path, content: Content, corpus: Corpus) -> None:
    spec: Spec = {
        "id": (str, True), "name": (str, True), "kind": (str, True), "made": (dict, False),
        "language": (str, True), "summary": (str, True), "citations": (list, True),
        "discovered": (dict, False), "held_by": (dict, False), "verses": (list, False),
    }
    for path, raw in entity_files(report, directory / "artifacts"):
        where = str(path)
        artifact = check_table(report, where, raw, spec)
        if artifact is None or not check_id(report, where, artifact["id"]):
            continue
        check_enum(report, where, "kind", artifact["kind"], ARTIFACT_KINDS)
        made = None
        if "made" in artifact:
            made = check_table(report, f"{where} made", artifact["made"], {"earliest": (int, True), "latest": (int, True)})
            if made:
                check_years(report, where, made["earliest"], made["latest"], "made")
        discovered = None
        if "discovered" in artifact:
            discovered = check_table(report, f"{where} discovered", artifact["discovered"], {"year": (int, False), "place": (str, False)})
        held = None
        if "held_by" in artifact:
            held = check_table(report, f"{where} held_by", artifact["held_by"], {"institution": (str, True), "accession": (str, False)})
        content.artifacts[artifact["id"]] = {
            **artifact,
            "made": made,
            "discovered": discovered or {},
            "held_by": held or {},
            "citations": citations(report, where, artifact["citations"], content),
            "verses": verses(report, where, artifact.get("verses"), corpus),
        }


def load_events(report: Report, directory: Path, content: Content, corpus: Corpus) -> None:
    spec: Spec = {
        "id": (str, True), "title": (str, True), "axis": (str, True), "category": (str, True),
        "confidence": (str, True), "status": (str, True), "summary": (str, True),
        "books": (list, False), "segment": (str, False), "verses": (list, False),
        "positions": (list, True), "attestations": (list, False),
    }
    position_spec: Spec = {
        "id": (str, True), "label": (str, True), "tradition": (str, True), "earliest": (int, True),
        "latest": (int, True), "summary": (str, True), "held_by": (str, False),
        "citations": (list, True), "arguments": (list, False),
    }
    argument_spec: Spec = {"stance": (str, True), "text": (str, True), "citations": (list, True), "verses": (list, False)}
    attestation_spec: Spec = {"artifact": (str, True), "relation": (str, True), "note": (str, True), "citations": (list, True)}

    for path, raw in entity_files(report, directory / "events"):
        where = str(path)
        event = check_table(report, where, raw, spec)
        if event is None or not check_id(report, where, event["id"]):
            continue
        check_enum(report, where, "axis", event["axis"], AXES)
        check_enum(report, where, "category", event["category"], CATEGORIES)
        check_enum(report, where, "confidence", event["confidence"], CONFIDENCE)
        check_enum(report, where, "status", event["status"], STATUSES)

        # A composition event dates one or more books: a source document such as the Priestly
        # source spans several, so this is a list, never a single book.
        book_ids: list[int] = []
        if event["axis"] == "composition":
            books = event.get("books")
            if not books:
                report.error(where, "a composition event needs 'books' (OSIS ids of the books it dates)")
            else:
                for osis in books:
                    if not isinstance(osis, str) or osis not in corpus.book_ids:
                        report.error(where, f"unknown OSIS book '{osis}' in 'books'")
                    elif corpus.book_ids[osis] not in book_ids:
                        book_ids.append(corpus.book_ids[osis])
        elif "books" in event or "segment" in event:
            report.error(where, "'books' and 'segment' belong to composition events only")

        positions: list[dict[str, Any]] = []
        if not event["positions"]:
            report.error(where, "needs at least one [[positions]] entry")
        seen_positions: set[str] = set()
        for p_index, raw_position in enumerate(event["positions"]):
            here = f"{where} position {p_index + 1}"
            position = check_table(report, here, raw_position, position_spec)
            if position is None or not check_id(report, here, position["id"]):
                continue
            if position["id"] in seen_positions:
                report.error(here, f"duplicate position id '{position['id']}'")
                continue
            seen_positions.add(position["id"])
            check_years(report, here, position["earliest"], position["latest"])
            arguments: list[dict[str, Any]] = []
            for a_index, raw_argument in enumerate(position.get("arguments", [])):
                there = f"{here} argument {a_index + 1}"
                argument = check_table(report, there, raw_argument, argument_spec)
                if argument is None:
                    continue
                check_enum(report, there, "stance", argument["stance"], STANCES)
                arguments.append({
                    "stance": argument["stance"],
                    "text": argument["text"],
                    "citations": citations(report, there, argument["citations"], content),
                    "verses": verses(report, there, argument.get("verses"), corpus),
                })
            positions.append({
                **position,
                "arguments": arguments,
                "citations": citations(report, here, position["citations"], content),
            })

        attestations: list[dict[str, Any]] = []
        seen_artifacts: set[str] = set()
        for t_index, raw_attestation in enumerate(event.get("attestations", [])):
            here = f"{where} attestation {t_index + 1}"
            attestation = check_table(report, here, raw_attestation, attestation_spec)
            if attestation is None:
                continue
            check_enum(report, here, "relation", attestation["relation"], RELATIONS)
            if attestation["artifact"] in seen_artifacts:
                report.error(here, f"artifact '{attestation['artifact']}' is attested twice for this event")
                continue
            seen_artifacts.add(attestation["artifact"])
            attestations.append({**attestation, "citations": citations(report, here, attestation["citations"], content)})

        content.events[event["id"]] = {
            **event,
            "book_ids": book_ids,
            "positions": positions,
            "attestations": attestations,
            "verses": verses(report, where, event.get("verses"), corpus),
        }


def load_issues(report: Report, directory: Path, content: Content, corpus: Corpus) -> None:
    spec: Spec = {
        "id": (str, True), "kind": (str, True), "title": (str, True), "summary": (str, True),
        "status": (str, True), "events": (list, False), "verses": (list, False),
        "citations": (list, True), "views": (list, True),
    }
    view_spec: Spec = {"label": (str, True), "text": (str, True), "citations": (list, True)}
    for path, raw in entity_files(report, directory / "issues"):
        where = str(path)
        issue = check_table(report, where, raw, spec)
        if issue is None or not check_id(report, where, issue["id"]):
            continue
        check_enum(report, where, "kind", issue["kind"], ISSUE_KINDS)
        check_enum(report, where, "status", issue["status"], STATUSES)
        if not issue["views"]:
            report.error(where, "needs at least one [[views]] entry")
        views = []
        for v_index, raw_view in enumerate(issue["views"]):
            here = f"{where} view {v_index + 1}"
            view = check_table(report, here, raw_view, view_spec)
            if view:
                views.append({**view, "citations": citations(report, here, view["citations"], content)})
        content.issues[issue["id"]] = {
            **issue,
            "events": list(issue.get("events", [])),
            "views": views,
            "citations": citations(report, where, issue["citations"], content),
            "verses": verses(report, where, issue.get("verses"), corpus),
        }


def all_citations(content: Content):
    """Every (where, citation) pair, for the bibliography gate."""
    for era in content.eras:
        for c in era["citations"]:
            yield f"era '{era['id']}'", c
    for artifact in content.artifacts.values():
        for c in artifact["citations"]:
            yield f"artifacts/{artifact['id']}.toml", c
    for event in content.events.values():
        where = f"events/{event['id']}.toml"
        for position in event["positions"]:
            for c in position["citations"]:
                yield where, c
            for argument in position["arguments"]:
                for c in argument["citations"]:
                    yield where, c
        for attestation in event["attestations"]:
            for c in attestation["citations"]:
                yield where, c
    for issue in content.issues.values():
        where = f"issues/{issue['id']}.toml"
        for c in issue["citations"]:
            yield where, c
        for view in issue["views"]:
            for c in view["citations"]:
                yield where, c


def cross_check(report: Report, content: Content) -> None:
    for where, citation in all_citations(content):
        if citation["source"] not in content.sources:
            report.error(where, f"cites unknown source '{citation['source']}' (add it to sources.toml)")
        else:
            content.cited.add(citation["source"])
    for source_id in sorted(set(content.sources) - content.cited):
        report.warn("sources.toml", f"source '{source_id}' is never cited")
    for event in content.events.values():
        for attestation in event["attestations"]:
            if attestation["artifact"] not in content.artifacts:
                report.error(f"events/{event['id']}.toml", f"attestation names unknown artifact '{attestation['artifact']}'")
    for issue in content.issues.values():
        for event_id in issue["events"]:
            if event_id not in content.events:
                report.error(f"issues/{issue['id']}.toml", f"names unknown event '{event_id}'")


# --- Fingerprint -----------------------------------------------------------------------------


def fingerprint(content: Content) -> str:
    """Content hash: every entity in id order, each length-prefixed canonical JSON.

    Hashes the content itself, never counts or sums — an equal-length correction must move the
    id (AGENTS.md: "A fingerprint made of counts and sums is not a fingerprint"). File names and
    the order files were written in do not enter it."""
    digest = hashlib.sha256()

    def feed(kind: str, payload: Any) -> None:
        encoded = json.dumps([kind, payload], sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
        digest.update(len(encoded).to_bytes(8, "big"))
        digest.update(encoded)

    for source_id in sorted(content.sources):
        feed("source", content.sources[source_id])
    for era in sorted(content.eras, key=lambda e: e["id"]):
        feed("era", era)
    for artifact_id in sorted(content.artifacts):
        feed("artifact", content.artifacts[artifact_id])
    for event_id in sorted(content.events):
        feed("event", content.events[event_id])
    for issue_id in sorted(content.issues):
        feed("issue", content.issues[issue_id])
    return digest.hexdigest()[:16]


# --- Write -----------------------------------------------------------------------------------


def assemble(content: Content, corpus: Corpus) -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

    def cite(kind: str, subject: str, items: list[dict[str, Any]]) -> None:
        db.executemany(
            "INSERT INTO citations (subject_kind, subject_id, source_id, locator, ordinal) VALUES (?, ?, ?, ?, ?)",
            [(kind, subject, c["source"], c["locator"], i) for i, c in enumerate(items)],
        )

    def link(kind: str, subject: str, items: list[dict[str, Any]]) -> None:
        db.executemany(
            "INSERT INTO verse_links (subject_kind, subject_id, start_verse_id, end_verse_id, link_type, note) VALUES (?, ?, ?, ?, ?, ?)",
            [(kind, subject, v["start"], v["end"], v["link"], v["note"]) for v in items],
        )

    for s in content.sources.values():
        db.execute(
            "INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (s["id"], s["kind"], s.get("author"), s["title"], s.get("container"), s.get("publisher"), s.get("year"), s.get("url"), s.get("isbn")),
        )
    for era in content.eras:
        db.execute("INSERT INTO eras VALUES (?, ?, ?, ?, ?)", (era["id"], era["name"], era["start"], era["end"], era["summary"]))
        cite("era", era["id"], era["citations"])
    for a in content.artifacts.values():
        db.execute(
            "INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (a["id"], a["name"], a["kind"], (a["made"] or {}).get("earliest"), (a["made"] or {}).get("latest"), a["language"], a["summary"],
             a["discovered"].get("year"), a["discovered"].get("place"), a["held_by"].get("institution"), a["held_by"].get("accession")),
        )
        cite("artifact", a["id"], a["citations"])
        link("artifact", a["id"], a["verses"])
    for e in content.events.values():
        # The range is DERIVED from the positions — there is no second copy to drift.
        earliest = min(p["earliest"] for p in e["positions"])
        latest = max(p["latest"] for p in e["positions"])
        db.execute(
            """INSERT INTO events (event_id, title, axis, category, confidence, status, summary,
                                   segment_label, earliest_year, latest_year)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (e["id"], e["title"], e["axis"], e["category"], e["confidence"], e["status"], e["summary"],
             e.get("segment"), earliest, latest),
        )
        db.executemany("INSERT INTO event_books VALUES (?, ?)", [(e["id"], book_id) for book_id in e["book_ids"]])
        link("event", e["id"], e["verses"])
        for ordinal, p in enumerate(e["positions"]):
            position_id = f"{e['id']}/{p['id']}"
            db.execute(
                "INSERT INTO positions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (position_id, e["id"], ordinal, p["label"], p["tradition"], p["earliest"], p["latest"], p["summary"], p.get("held_by")),
            )
            cite("position", position_id, p["citations"])
            for a_ordinal, argument in enumerate(p["arguments"]):
                # Stable, content-derived ids (never rowids): the same content rebuilds to the
                # same ids, so a link to one argument survives a rebuild.
                argument_id = f"{position_id}/argument-{a_ordinal + 1}"
                db.execute(
                    "INSERT INTO arguments (argument_id, position_id, ordinal, stance, text) VALUES (?, ?, ?, ?, ?)",
                    (argument_id, position_id, a_ordinal, argument["stance"], argument["text"]),
                )
                cite("argument", argument_id, argument["citations"])
                link("argument", argument_id, argument["verses"])
        for t in e["attestations"]:
            attestation_id = f"{e['id']}@{t['artifact']}"
            db.execute(
                "INSERT INTO attestations (attestation_id, artifact_id, event_id, relation, note) VALUES (?, ?, ?, ?, ?)",
                (attestation_id, t["artifact"], e["id"], t["relation"], t["note"]),
            )
            cite("attestation", attestation_id, t["citations"])
    for i in content.issues.values():
        db.execute("INSERT INTO issues VALUES (?, ?, ?, ?, ?)", (i["id"], i["kind"], i["title"], i["summary"], i["status"]))
        cite("issue", i["id"], i["citations"])
        link("issue", i["id"], i["verses"])
        for ordinal, view in enumerate(i["views"]):
            view_id = f"{i['id']}/view-{ordinal + 1}"
            db.execute(
                "INSERT INTO issue_views (view_id, issue_id, ordinal, label, text) VALUES (?, ?, ?, ?, ?)",
                (view_id, i["id"], ordinal, view["label"], view["text"]),
            )
            cite("issue_view", view_id, view["citations"])
        db.executemany("INSERT INTO issue_events VALUES (?, ?)", [(i["id"], event_id) for event_id in i["events"]])

    db.executemany(
        "INSERT INTO meta VALUES (?, ?)",
        [("build_id", fingerprint(content)), ("schema_version", SCHEMA_VERSION), ("corpus_build_id", corpus.build_id)],
    )
    db.commit()
    violations = db.execute("PRAGMA foreign_key_check").fetchall()
    if violations:
        raise RuntimeError(f"foreign key violations after assembly: {violations}")
    return db


def write_atomically(db: sqlite3.Connection, out: Path) -> None:
    """Copy the finished in-memory database beside `out` and rename it into place.

    The temporary file is only created here, after every gate has passed, so a rejected build
    never touches the output directory. The rename is atomic on one filesystem, so the app never
    opens a half-written timeline."""
    out.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=out.parent, prefix=f".{out.name}.", suffix=".tmp")
    os.close(handle)
    target = sqlite3.connect(temporary)
    try:
        db.backup(target)
    finally:
        target.close()
    os.replace(temporary, out)


def build(content_dir: Path, corpus_path: Path, out: Path) -> Report:
    report = Report()
    corpus = load_corpus(corpus_path)
    content = Content()
    if not (content_dir / "sources.toml").is_file():
        report.error(str(content_dir / "sources.toml"), "missing (the bibliography every citation points into)")
    else:
        load_sources(report, content_dir / "sources.toml", content)
    if (content_dir / "eras.toml").is_file():
        load_eras(report, content_dir / "eras.toml", content)
    load_artifacts(report, content_dir, content, corpus)
    load_events(report, content_dir, content, corpus)
    load_issues(report, content_dir, content, corpus)
    cross_check(report, content)
    if report.errors:
        return report
    db = assemble(content, corpus)
    try:
        write_atomically(db, out)
    finally:
        db.close()
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--content", type=Path, required=True)
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    if not args.corpus.is_file():
        print(f"{args.corpus}: corpus database not found", file=sys.stderr)
        return 2
    report = build(args.content, args.corpus, args.out)
    for warning in report.warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if report.errors:
        for error in report.errors:
            print(f"error: {error}", file=sys.stderr)
        print(f"timeline build FAILED with {len(report.errors)} error(s); {args.out} was not changed", file=sys.stderr)
        return 1
    print(f"timeline build ok -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
