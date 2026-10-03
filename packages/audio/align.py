"""Forced alignment: where in the recording is each verse (and, for Hebrew, each word).

Tool: torchaudio's `MMS_FA` bundle — Meta's wav2vec2 CTC forced aligner trained on 1,100+
languages, with a `<star>` wildcard token that absorbs speech the transcript does not contain
(chapter announcements, psalm superscriptions, a narrator's introduction). We already have the
text, so a transcriber (Whisper) would be the wrong tool; a text-to-audio aligner is exactly the
right one.

Long files (a LibriVox chunk of 14 chapters, a whole Hebrew book) are aligned one chapter at a
time in a sliding window: the transcript is `* <chapter words> *`, the window starts where the
previous chapter ended and is sized from a running estimate of the reader's speed, and the
trailing star soaks up whatever follows. If the last verse lands hard against the end of the
window the window was too short: widen and retry.

Outputs one JSON per chapter under `<work>/<edition>/<bb>-<ccc>.json`, with verse and word times
in seconds relative to the *source file*, plus a per-unit state file so a run can resume.

Usage: python align.py --work work/ --edition WEB-williams [--only 1:1,19:3] [--device cuda]
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

import numpy as np
import torch
import torchaudio

SAMPLE_RATE = 16_000
CHUNK_SECONDS = 20.0  # model context per forward pass; emissions are concatenated
INITIAL_RATE = {"eng": 13.0, "hbo": 11.0}  # normalized chars per second, refined as we go
WINDOW_PAD_SECONDS = 60.0
WINDOW_FACTOR = 1.8
MAX_RETRIES = 5

HEBREW_CANTILLATION = re.compile(r"[֑-ֽֿ֯׀׃-ׇ]")

_uroman = None


def romanize(text: str) -> str:
    global _uroman
    if _uroman is None:
        import uroman  # type: ignore

        _uroman = uroman.Uroman()
    return _uroman.romanize_string(text, lcode="heb")


def normalize_english(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().replace("’", "'")
    return re.sub(r"[^a-z' ]+", " ", text)


# What a reader SAYS for the Tetragrammaton. Nobody reads יהוה as written: the convention, and
# this reader's practice, is "Adonai", or "Elohim" where the pointing marks it so (H3069, the
# form that follows an actual "Adonai"). Six thousand eight hundred tokens; left as `yehvah`
# they would each be a small misalignment in the middle of a verse.
QERE_PERPETUUM = {"H3068": "adonay", "H3069": "elohim"}


def normalize_hebrew_word(surface: str, strongs: str | None = None) -> str:
    if strongs:
        key = strongs.rstrip("abcdefg")
        spoken = QERE_PERPETUUM.get(key)
        if spoken:
            # Keep any prefix (וַ/יהוה = "va-adonai"): romanize the part before the divine name.
            prefix = surface.split("/")[:-1]
            return normalize_hebrew_word("".join(prefix)) + spoken if prefix else spoken
    # `/` is the ingest's morpheme separator (b/7225 -> בְּ/רֵאשִׁ֖ית), never a sound.
    word = surface.replace("/", "")
    word = HEBREW_CANTILLATION.sub("", word)
    roman = romanize(word)
    return re.sub(r"[^a-z' ]+", " ", roman.lower()).strip().replace(" ", "")


def load_audio(path: str) -> np.ndarray:
    """Decode any container to mono float32 at 16 kHz with the system ffmpeg."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", path,
        "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-",
    ]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


class Aligner:
    def __init__(self, device: str):
        bundle = torchaudio.pipelines.MMS_FA
        self.device = device
        self.model = bundle.get_model(with_star=True).to(device).eval()
        self.tokenizer = bundle.get_tokenizer()
        self.aligner = bundle.get_aligner()
        self.dictionary = bundle.get_dict()

    def clean(self, token: str) -> str:
        return "".join(ch for ch in token if ch in self.dictionary and ch != "*")

    @torch.inference_mode()
    def emissions(self, audio: np.ndarray) -> tuple[torch.Tensor, np.ndarray]:
        """Log-prob emissions for a window, plus the absolute time (s) of each frame's start."""
        chunk = int(CHUNK_SECONDS * SAMPLE_RATE)
        outs, times = [], []
        for start in range(0, len(audio), chunk):
            piece = audio[start : start + chunk]
            if len(piece) < SAMPLE_RATE // 2:  # under half a second: pad, the model needs context
                piece = np.pad(piece, (0, SAMPLE_RATE // 2 - len(piece)))
            wav = torch.from_numpy(np.ascontiguousarray(piece)).unsqueeze(0).to(self.device)
            emission, _ = self.model(wav)
            n = emission.shape[1]
            outs.append(emission[0])
            times.append(start / SAMPLE_RATE + np.arange(n) * (len(piece) / SAMPLE_RATE / n))
        return torch.cat(outs, dim=0), np.concatenate(times)

    def align(self, audio: np.ndarray, words: list[str]) -> list[tuple[float, float, float]]:
        """(start_s, end_s, score) per word, relative to `audio`. Words must be dictionary-clean."""
        emission, frame_times = self.emissions(audio)
        tokens = self.tokenizer(words)
        spans = self.aligner(emission, tokens)
        step = frame_times[1] - frame_times[0] if len(frame_times) > 1 else 0.02
        out = []
        for word_spans in spans:
            if not word_spans:
                out.append((float("nan"), float("nan"), 0.0))
                continue
            s = frame_times[min(word_spans[0].start, len(frame_times) - 1)]
            e = frame_times[min(word_spans[-1].end, len(frame_times) - 1)] + step
            score = float(np.mean([sp.score for sp in word_spans]))
            out.append((float(s), float(e), score))
        return out


def chapter_words(chapter: dict, language: str, aligner: Aligner) -> tuple[list[str], list[tuple[int, int | None]]]:
    """Flat word list for the aligner, plus (verse_index, word_id|None) per word."""
    words, owners = [], []
    for vi, verse in enumerate(chapter["verses"]):
        if language == "eng":
            for w in normalize_english(verse["text"]).split():
                w = aligner.clean(w)
                if w:
                    words.append(w)
                    owners.append((vi, None))
        else:
            for word in verse["words"]:
                w = aligner.clean(normalize_hebrew_word(word["text"], word.get("strongs")))
                if w:
                    words.append(w)
                    owners.append((vi, word["word_id"]))
    return words, owners


def align_chapter(aligner, audio, t0, t_end, words, owners, rate, log) -> tuple[dict, float]:
    """Align one chapter starting at t0 (s). Returns (result, end_time_s)."""
    n_chars = sum(len(w) + 1 for w in words)
    est = n_chars / rate
    win = est * WINDOW_FACTOR + WINDOW_PAD_SECONDS
    remaining = t_end - t0
    for attempt in range(MAX_RETRIES):
        win = min(win, remaining)
        seg = audio[int(t0 * SAMPLE_RATE) : int((t0 + win) * SAMPLE_RATE)]
        spans = aligner.align(seg, ["*"] + words + ["*"])
        body = spans[1:-1]
        last_end = max(e for _, e, _ in body if e == e)
        # Hard against the end of the window means the chapter probably runs past it.
        if win < remaining - 1.0 and last_end > win - 3.0:
            log(f"    window {win:.0f}s too short (last word at {last_end:.0f}s); widening")
            win *= 1.6
            continue
        break

    verses: dict[int, dict] = {}
    for (vi, word_id), (s, e, score) in zip(owners, body):
        if s != s:
            continue
        v = verses.setdefault(vi, {"start": s, "end": e, "scores": [], "words": []})
        v["start"] = min(v["start"], s)
        v["end"] = max(v["end"], e)
        v["scores"].append(score)
        if word_id is not None:
            v["words"].append({"word_id": word_id, "start": round(t0 + s, 3), "end": round(t0 + e, 3)})

    return verses, t0 + last_end, win, est


def run_unit(aligner, edition, unit, work_dir: Path, only: set[tuple[int, int]] | None, device, log):
    language = edition["language"]
    state_path = work_dir / (Path(unit["file"]).stem + ".state.json")
    state = json.loads(state_path.read_text()) if state_path.exists() else {"t0": 0.0, "rate": INITIAL_RATE[language], "done": []}
    pending = [c for c in unit["chapters"] if [c["book_id"], c["chapter"]] not in state["done"]]
    if only:
        pending = [c for c in pending if (c["book_id"], c["chapter"]) in only]
    if not pending:
        return
    t_load = time.time()
    audio = load_audio(unit["file"])
    t_end = len(audio) / SAMPLE_RATE
    log(f"  {Path(unit['file']).name}: {t_end/60:.1f} min, decoded in {time.time()-t_load:.1f}s")

    for ch in pending:
        t_ch = time.time()
        words, owners = chapter_words(ch, language, aligner)
        if not words:
            continue
        verses, end_t, win, est = align_chapter(aligner, audio, state["t0"], t_end, words, owners, state["rate"], log)
        out = {
            "edition": edition["code"],
            "book_id": ch["book_id"],
            "chapter": ch["chapter"],
            "file": unit["file"],
            "verses": [],
        }
        scores = []
        for vi, verse in enumerate(ch["verses"]):
            v = verses.get(vi)
            if not v:
                continue
            score = float(np.mean(v["scores"]))
            scores.append(score)
            out["verses"].append({
                "verse_id": verse["verse_id"],
                "start": round(state["t0"] + v["start"], 3),
                "end": round(state["t0"] + v["end"], 3),
                "score": round(score, 4),
                "words": v["words"],
            })
        first = out["verses"][0]["start"] if out["verses"] else state["t0"]
        last = out["verses"][-1]["end"] if out["verses"] else state["t0"]
        duration = max(last - first, 1e-3)
        n_chars = sum(len(w) + 1 for w in words)
        measured_rate = n_chars / duration
        out["chapter_start"] = round(first, 3)
        out["chapter_end"] = round(last, 3)
        out["mean_score"] = round(float(np.mean(scores)), 4) if scores else 0.0
        out["min_score"] = round(float(np.min(scores)), 4) if scores else 0.0
        out["rate"] = round(measured_rate, 2)
        (work_dir / f"{ch['book_id']:02d}-{ch['chapter']:03d}.json").write_text(json.dumps(out, ensure_ascii=False))

        # Only trust the measured rate to steer the next window if this chapter looked sane.
        if out["mean_score"] > 0.5 and 3.0 < measured_rate < 40.0:
            state["rate"] = 0.6 * state["rate"] + 0.4 * measured_rate
        state["t0"] = end_t
        state["done"].append([ch["book_id"], ch["chapter"]])
        state_path.write_text(json.dumps(state))
        log(
            f"    {ch['book_id']:02d}-{ch['chapter']:03d}: {len(out['verses'])}/{len(ch['verses'])} verses, "
            f"{first/60:.1f}-{last/60:.1f} min, score {out['mean_score']:.2f} (min {out['min_score']:.2f}), "
            f"rate {measured_rate:.1f} c/s, window {win:.0f}s, {time.time()-t_ch:.1f}s"
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
    ap.add_argument("--edition", required=True)
    ap.add_argument("--only", help="comma-separated book:chapter list, e.g. 1:1,19:3")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = ap.parse_args()

    work = Path(args.work)
    payload = json.loads((work / f"{args.edition}.fragments.json").read_text())
    edition = payload["edition"]
    out_dir = work / edition["code"]
    out_dir.mkdir(parents=True, exist_ok=True)
    only = None
    if args.only:
        only = {(int(a), int(b)) for a, b in (x.split(":") for x in args.only.split(","))}

    log_path = out_dir / "align.log"

    def log(msg: str) -> None:
        print(msg, file=sys.stderr, flush=True)
        with log_path.open("a") as fh:
            fh.write(msg + "\n")

    log(f"== {edition['code']} on {args.device}, {len(payload['units'])} files")
    aligner = Aligner(args.device)
    for unit in payload["units"]:
        if only and not any((c["book_id"], c["chapter"]) in only for c in unit["chapters"]):
            continue
        run_unit(aligner, edition, unit, out_dir, only, args.device, log)


if __name__ == "__main__":
    main()
