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

from gpu_share import GpuWatch, yield_while_busy

import numpy as np
import torch
import torchaudio

SAMPLE_RATE = 16_000
CHUNK_SECONDS = 20.0  # model context per forward pass; emissions are concatenated
INITIAL_RATE = {"eng": 13.0, "hbo": 11.0}  # normalized chars per second, refined as we go
WINDOW_PAD_SECONDS = 60.0
WINDOW_FACTOR = 1.8
MAX_RETRIES = 5
# A chapter whose remaining audio is under this fraction of its expected speaking time is not in
# this file: LibriVox's titles are off by one here and there ("Exodus Ch. 11 - 22" ends at 21), so
# the chapter is carried over to the next file rather than forced into fifteen seconds of tail.
MIN_REMAINING_FRACTION = 0.5
# A carried-over chapter that scores below this at the start of the next file is not there either:
# the recording skipped it. It is recorded as missing and the file starts over with its own
# chapters, because forcing its text onto the next chapter's audio shifts every chapter after it,
# and that shift cascades from file to file (KJV Exodus 22, 2026-10-08).
CARRIED_MIN_SCORE = 0.5

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
    def __init__(self, device: str, log=lambda msg: None):
        bundle = torchaudio.pipelines.MMS_FA
        self.device = device
        self.log = log
        self.model = bundle.get_model(with_star=True).to(device).eval()
        self.tokenizer = bundle.get_tokenizer()
        self.aligner = bundle.get_aligner()
        self.dictionary = bundle.get_dict()
        # Sharing the card: a watchdog polls for other GPU users every few seconds; the hot path
        # only reads its flag, between chunks, so the model leaves the card within seconds.
        self.watch = GpuWatch().start() if device != "cpu" else None

    def offload(self) -> None:
        """Leave the GPU entirely: model to the CPU and the cache released, for another job."""
        if self.device != "cpu":
            self.model.to("cpu")
            torch.cuda.empty_cache()

    def restore(self) -> None:
        if self.device != "cpu":
            self.model.to(self.device)

    def share_gpu(self, log=None) -> None:
        """Between chunks and before each window: step aside while anyone else wants the card."""
        if self.watch is None or not self.watch.busy:
            return
        yield_while_busy(self.offload, self.restore, log or self.log, busy=self.watch.probe_now, reason=self.watch.reason)

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
            self.share_gpu()
            wav = torch.from_numpy(np.ascontiguousarray(piece)).unsqueeze(0).to(self.device)
            emission, _ = self.model(wav)
            n = emission.shape[1]
            outs.append(emission[0].cpu())  # off the card at once, so an offload strands nothing
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
        aligner.share_gpu(log)
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


# A chapter that scores below this (per language) is treated as suspect: the recording may skip
# it, in which case its text has been forced onto the next chapter's audio and every chapter after
# it drifts (KJV 2 Chronicles 4, 2026-10-08). The aligner then probes the next chapter at the
# same point; if that scores well the suspect chapter is recorded as missing. On a relaunch, a
# file's saved progress is rolled back to the last chapter above this floor so a drift is redone.
LOW_SCORE = {"eng": 0.5, "hbo": 0.3}
GOOD_SCORE = {"eng": 0.7, "hbo": 0.4}


def run_unit(aligner, edition, unit, work_dir: Path, only: set[tuple[int, int]] | None, device, log,
             carried: list[dict] | None = None) -> list[dict]:
    """Align the unit's chapters (after any `carried` in from the previous file); returns the
    chapters whose audio ran out before they began, for the next file to take."""
    language = edition["language"]
    low, good = LOW_SCORE[language], GOOD_SCORE[language]
    state_path = work_dir / (Path(unit["file"]).stem + ".state.json")
    state = json.loads(state_path.read_text()) if state_path.exists() else {"t0": 0.0, "rate": INITIAL_RATE[language], "done": []}
    missing = {tuple(m) for m in state.get("missing", [])}

    # Roll back saved progress to the last chapter that scored above the floor.
    # A drift shows as two low chapters in a row (or a low final chapter); a single low chapter
    # between good ones is just a hard chapter and is kept.
    def saved_score(b: int, c: int) -> float | None:
        try:
            return float(json.loads((work_dir / f"{b:02d}-{c:03d}.json").read_text()).get("mean_score", 0.0))
        except (OSError, ValueError):
            return None

    keep = []
    last_good_end = 0.0
    done = state["done"]
    for n, (b, c) in enumerate(done):
        if (b, c) in missing:
            keep.append([b, c])
            continue
        score = saved_score(b, c)
        if score is None:
            break
        if score < low:
            following = [saved_score(nb, nc) for nb, nc in done[n + 1 : n + 2] if (nb, nc) not in missing]
            if not following or following[0] is None or following[0] < low:
                break
        keep.append([b, c])
        try:
            last_good_end = float(json.loads((work_dir / f"{b:02d}-{c:03d}.json").read_text()).get("chapter_end", last_good_end))
        except (OSError, ValueError):
            pass
    if len(keep) < len(state["done"]):
        dropped = state["done"][len(keep):]
        log(f"  {Path(unit['file']).name}: {len(dropped)} saved chapters from {dropped[0][0]:02d}-{dropped[0][1]:03d} "
            f"scored below {low}; redoing them from {last_good_end:.0f}s")
        state["done"] = keep
        state["t0"] = last_good_end
        state_path.write_text(json.dumps(state))

    pending = [c for c in (carried or []) + unit["chapters"] if [c["book_id"], c["chapter"]] not in state["done"]]
    if only:
        pending = [c for c in pending if (c["book_id"], c["chapter"]) in only]
    if not pending:
        return []
    t_load = time.time()
    audio = load_audio(unit["file"])
    t_end = len(audio) / SAMPLE_RATE
    log(f"  {Path(unit['file']).name}: {t_end/60:.1f} min, decoded in {time.time()-t_load:.1f}s")

    def attempt(ch: dict, t0: float) -> dict | None:
        """Align one chapter from t0 without touching state. None when the audio runs out first."""
        words, owners = chapter_words(ch, language, aligner)
        if not words:
            return {"empty": True}
        est = sum(len(w) + 1 for w in words) / state["rate"]
        if t_end - t0 < est * MIN_REMAINING_FRACTION:
            log(f"    {ch['book_id']:02d}-{ch['chapter']:03d}: only {t_end - t0:.0f}s of audio left for "
                f"about {est:.0f}s of text; carrying it to the next file")
            return None
        try:
            verses, end_t, win, est = align_chapter(aligner, audio, t0, t_end, words, owners, state["rate"], log)
        except RuntimeError as exc:
            if "too long for CTC" not in str(exc):
                raise
            log(f"    {ch['book_id']:02d}-{ch['chapter']:03d}: audio shorter than its text ({exc}); carrying it to the next file")
            return None
        out = {"edition": edition["code"], "book_id": ch["book_id"], "chapter": ch["chapter"], "file": unit["file"], "verses": []}
        scores = []
        for vi, verse in enumerate(ch["verses"]):
            v = verses.get(vi)
            if not v:
                continue
            score = float(np.mean(v["scores"]))
            scores.append(score)
            out["verses"].append({
                "verse_id": verse["verse_id"],
                "start": round(t0 + v["start"], 3),
                "end": round(t0 + v["end"], 3),
                "score": round(score, 4),
                "words": v["words"],
            })
        first = out["verses"][0]["start"] if out["verses"] else t0
        last = out["verses"][-1]["end"] if out["verses"] else t0
        duration = max(last - first, 1e-3)
        measured_rate = sum(len(w) + 1 for w in words) / duration
        out["chapter_start"] = round(first, 3)
        out["chapter_end"] = round(last, 3)
        out["mean_score"] = round(float(np.mean(scores)), 4) if scores else 0.0
        out["min_score"] = round(float(np.min(scores)), 4) if scores else 0.0
        out["rate"] = round(measured_rate, 2)
        return {"out": out, "end_t": end_t, "win": win, "rate": measured_rate, "n_verses": len(ch["verses"])}

    def record_missing(ch: dict, why: str) -> None:
        log(f"    {ch['book_id']:02d}-{ch['chapter']:03d}: {why}")
        state.setdefault("missing", []).append([ch["book_id"], ch["chapter"]])
        state["done"].append([ch["book_id"], ch["chapter"]])
        state_path.write_text(json.dumps(state))

    def commit(ch: dict, res: dict, t_ch: float) -> None:
        out = res["out"]
        (work_dir / f"{ch['book_id']:02d}-{ch['chapter']:03d}.json").write_text(json.dumps(out, ensure_ascii=False))
        # Only trust the measured rate to steer the next window if this chapter looked sane.
        if out["mean_score"] > 0.5 and 3.0 < res["rate"] < 40.0:
            state["rate"] = 0.6 * state["rate"] + 0.4 * res["rate"]
        state["t0"] = res["end_t"]
        state["done"].append([ch["book_id"], ch["chapter"]])
        state_path.write_text(json.dumps(state))
        log(
            f"    {ch['book_id']:02d}-{ch['chapter']:03d}: {len(out['verses'])}/{res['n_verses']} verses, "
            f"{out['chapter_start']/60:.1f}-{out['chapter_end']/60:.1f} min, score {out['mean_score']:.2f} (min {out['min_score']:.2f}), "
            f"rate {res['rate']:.1f} c/s, window {res['win']:.0f}s, {time.time()-t_ch:.1f}s"
        )

    leftover: list[dict] = []
    carried_keys = {(c["book_id"], c["chapter"]) for c in (carried or [])}
    i = 0
    while i < len(pending):
        ch = pending[i]
        i += 1
        if leftover:
            leftover.append(ch)
            continue
        t_ch = time.time()
        res = attempt(ch, state["t0"])
        if res is None:
            leftover.append(ch)
            continue
        if res.get("empty"):
            continue
        score = res["out"]["mean_score"]
        if (ch["book_id"], ch["chapter"]) in carried_keys and score < CARRIED_MIN_SCORE:
            record_missing(ch, f"carried in but scores {score:.2f} here; the recording skips it. "
                               f"Not aligned; this file starts over at {state['t0']:.0f}s")
            continue
        if score < low and i < len(pending):
            # Suspect: does the next chapter fit this audio better? Then this one was skipped.
            nxt = pending[i]
            t_probe = time.time()
            probe = attempt(nxt, state["t0"])
            if probe and not probe.get("empty") and probe["out"]["mean_score"] >= good:
                record_missing(ch, f"scores {score:.2f} here while {nxt['book_id']:02d}-{nxt['chapter']:03d} scores "
                                   f"{probe['out']['mean_score']:.2f} at the same point; the recording skips it")
                commit(nxt, probe, t_probe)
                i += 1
                continue
        commit(ch, res, t_ch)
    return leftover


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
    aligner = Aligner(args.device, log)
    carried: list[dict] = []
    for unit in payload["units"]:
        if only and not carried and not any((c["book_id"], c["chapter"]) in only for c in unit["chapters"]):
            continue
        carried = run_unit(aligner, edition, unit, out_dir, only, args.device, log, carried)
    for ch in carried:
        log(f"    {ch['book_id']:02d}-{ch['chapter']:03d}: no file left to carry it to; not aligned")


if __name__ == "__main__":
    main()
