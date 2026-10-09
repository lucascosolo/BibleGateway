"""Align chapters an edition's own recording skips, from another reader's file (sources.json `fill`).

Each fill entry names one chapter and one file. A file that is the chapter alone is aligned from
its start; a bundle whose LAST chapter is the one wanted (`"position": "last"`) is first probed by
aligning `* chapter *` over the tail, the window sized exactly as align.py sizes one, and the
chapter is then aligned from the offset the probe found. Output goes to `<work>/<edition>-fill/`;
a chapter scoring at or above the edition's GOOD_SCORE is copied into `<work>/<edition>/` for
build.py, and anything lower is reported and left out.

Usage: python fill.py --work work/ --fill-dir ~/.cache/jot-audio/kjv-fill --edition KJV-librivox [--device cpu]
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import torch

from align import (GOOD_SCORE, INITIAL_RATE, LOW_SCORE, SAMPLE_RATE, WINDOW_FACTOR, WINDOW_PAD_SECONDS,
                   Aligner, align_chapter, chapter_words, load_audio, run_unit)

HERE = Path(__file__).resolve().parent
PROBE_LEAD_SECONDS = 2.0


def tail_offset(aligner: Aligner, path: str, ch: dict, language: str, log) -> float:
    """Where the bundle's last chapter begins (s), found by aligning it over the file's tail."""
    audio = load_audio(path)
    t_end = len(audio) / SAMPLE_RATE
    words, owners = chapter_words(ch, language, aligner)
    est = sum(len(w) + 1 for w in words) / INITIAL_RATE[language]
    t0 = max(0.0, t_end - (est * WINDOW_FACTOR + WINDOW_PAD_SECONDS))
    verses, _, _, _ = align_chapter(aligner, audio, t0, t_end, words, owners, INITIAL_RATE[language], log)
    start = t0 + min(v["start"] for v in verses.values())
    log(f"  probe {Path(path).name}: tail from {t0:.1f}s of {t_end:.1f}s; "
        f"{ch['book_id']:02d}-{ch['chapter']:03d} begins at {start:.2f}s")
    return start


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
    ap.add_argument("--fill-dir", required=True)
    ap.add_argument("--edition", required=True)
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = ap.parse_args()

    work = Path(args.work)
    edition = next(e for e in json.loads((HERE / "sources.json").read_text())["editions"] if e["code"] == args.edition)
    language = edition["language"]
    chapters = {(c["book_id"], c["chapter"]): c
                for u in json.loads((work / f"{args.edition}.fragments.json").read_text())["units"] for c in u["chapters"]}
    fill_work = work / f"{args.edition}-fill"
    fill_work.mkdir(parents=True, exist_ok=True)

    def log(msg: str) -> None:
        print(msg, file=sys.stderr, flush=True)
        with (fill_work / "align.log").open("a") as fh:
            fh.write(msg + "\n")

    aligner = Aligner(args.device, log)
    for entry in edition["fill"]:
        key = (entry["book_id"], entry["chapter"])
        name = f"{key[0]:02d}-{key[1]:03d}.json"
        if entry.get("excluded"):
            log(f"  {name}: excluded ({entry['excluded']}); skipped")
            continue
        if (work / args.edition / name).exists():
            log(f"  {name}: already in {args.edition}; skipped")
            continue
        path = str(Path(args.fill_dir) / entry["file"])
        t0 = 0.0
        if entry.get("position") == "last":
            t0 = max(0.0, tail_offset(aligner, path, chapters[key], language, log) - PROBE_LEAD_SECONDS)
        state = fill_work / (Path(path).stem + ".state.json")
        state.write_text(json.dumps({"t0": t0, "rate": INITIAL_RATE[language], "done": []}))
        run_unit(aligner, edition, {"file": path, "chapters": [chapters[key]]}, fill_work, None, args.device, log)
        result = json.loads((fill_work / name).read_text())
        score = result["mean_score"]
        if score >= GOOD_SCORE[language]:
            shutil.copy2(fill_work / name, work / args.edition / name)
            log(f"  {name}: score {score:.4f} >= {GOOD_SCORE[language]}; added to {args.edition}")
        else:
            verdict = "below LOW_SCORE" if score < LOW_SCORE[language] else "below GOOD_SCORE"
            log(f"  {name}: score {score:.4f} {verdict}; NOT added")


if __name__ == "__main__":
    main()
