"""One-off migration (2026-10-08) from the two-value status to the review grade.

A draft entity citing at least one source that is not Wikipedia becomes `sources-located`; the
rest stay `draft`. Two entities whose quotations were checked against the page text on
2026-10-08 become `claims-checked`. Only the top-level `status` line of each file is rewritten.

    python3 -I packages/timeline/migrate_status.py packages/timeline/content
"""

import re
import sys
import tomllib
from pathlib import Path

KINDS = ("events", "issues", "persons", "artifacts")
CLAIMS_CHECKED = {"issues/patriarchs-historicity.toml", "events/second-temple-built.toml"}
STATUS_LINE = re.compile(r'^status = "draft"$', re.MULTILINE)


def cited_sources(node):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "citations" and isinstance(value, list):
                yield from (c["source"] for c in value if isinstance(c, dict) and "source" in c)
            yield from cited_sources(value)
    elif isinstance(node, list):
        for item in node:
            yield from cited_sources(item)


def grade(relative: str, entity: dict) -> str:
    if relative in CLAIMS_CHECKED:
        return "claims-checked"
    if any(not source.startswith("wikipedia") for source in cited_sources(entity)):
        return "sources-located"
    return "draft"


def main(content: Path) -> None:
    counts: dict[str, int] = {}
    for kind in KINDS:
        for path in sorted((content / kind).glob("*.toml")):
            text = path.read_text(encoding="utf-8")
            entity = tomllib.loads(text)
            if entity.get("status") != "draft":
                continue
            new = grade(f"{kind}/{path.name}", entity)
            counts[new] = counts.get(new, 0) + 1
            if new != "draft":
                updated, n = STATUS_LINE.subn(f'status = "{new}"', text, count=1)
                if n != 1:
                    sys.exit(f"{path}: no top-level 'status = \"draft\"' line to rewrite")
                path.write_text(updated, encoding="utf-8")
    print(counts)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
