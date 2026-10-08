# packages/audio — the audiobook and spoken-word pipeline

Offline, like `packages/ingest`. Produces `data/audio.db` and `data/audio/<edition>/*.m4a`,
which the app feature-detects: no `audio.db`, no player. Never runs in prod.

Runs on the heavy-build PC (needs a GPU or a lot of patience: ~260 hours of speech go through a
wav2vec2 forced aligner). Design record and licence audit: `docs/plans/2026-09-04-audio.md`.

```
sources.json      every recording, its licence, file layout and coverage — the only place a source is named
kjv-files.json    LibriVox's 127 multi-chapter files and the chapter ranges in their titles
fragments.py      bible.db -> the text each file should contain (canonical verse ids, Hebrew word ids)
align.py          MMS_FA forced alignment, windowed over long files, resumable
build.py          cut/encode chapters, write audio.db
run.sh            the whole thing, in order
resume.sh         sequential resumable alignment, one GPU worker at a time
```

```
CACHE=~/.cache/jot-audio            # raw downloads, venv, working files
./download.sh all                   # the four editions into $CACHE/raw/ (resumable; ~8 GB)
./run.sh fragments                  # seconds
./launch-alignment.sh               # all four editions, as a user service with the GPU (hours)
./run.sh align WEB-williams         # or one edition in the foreground; resumable, re-run to continue
./run.sh build                      # minutes; writes ../../data/audio.db and data/audio/
```

`download.sh` fetches WEB chapter by chapter from the AudioTreasure index (its zip bundles are
gone), BSB as two zips from openbible.com, the KJV as LibriVox's 64 kb/s variants stored under the
base names `kjv-files.json` uses, and the Hebrew book files from archive.org. The alignment needs
the GPU, which a sandboxed shell cannot see, so `launch-alignment.sh` is run from a normal shell.

Environment (one-off): `uv venv --python 3.12 $CACHE/venv`, then torch 2.4.1 + torchaudio
2.4.1 from the `cu118` index (the GTX 980 Ti is sm_52; CUDA 12.8+ builds dropped Maxwell),
plus `uroman` and `numpy`. `ffmpeg` on PATH.

Output tables (`audio.db`): `audio_editions`, `audio_chapters(file, duration_ms)`,
`audio_verses(verse_id, start_ms, end_ms, score)`, `audio_words(word_id, verse_id, start_ms,
end_ms)`. Times are relative to the chapter file. `audio_words` exists only for the Hebrew
edition — the per-word speaker button plays a slice of the chapter recording, so the reader
hears a human saying that word in that verse.

For a release, build into a fresh staging directory with `build.py --out <staging>` and
validate the complete result before replacing a deployed artifact. The database is replaced
atomically, but encoding rewrites chapter files in place: an interrupted rebuild of an existing
output directory does not roll back those files. `--skip-encode` is only for resuming the same
unchanged input snapshot, not for changed source audio or chapter boundaries.
