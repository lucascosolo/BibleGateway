#!/usr/bin/env bash
# The audio pipeline, in order. See README.md. Runs on the heavy-build PC, never a VPS.
#
#   ./run.sh fragments                 # bible.db -> work/<edition>.fragments.json
#   ./run.sh align <EDITION> [ONLY]    # e.g. ./run.sh align WEB-williams 1:1,19:3
#   ./run.sh build [EDITION]           # -> ../../data/audio.db + data/audio/
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${JOT_AUDIO_CACHE:-$HOME/.cache/jot-audio}"
PY="$CACHE/venv/bin/python"
WORK="$CACHE/work"
DATA="$HERE/../../data"

[ -x "$PY" ] || { echo "no venv at $CACHE/venv — see README.md" >&2; exit 2; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not on PATH" >&2; exit 2; }

case "${1:-}" in
  fragments)
    [ -f "$CACHE/bible.db" ] || { echo "copy the built corpus to $CACHE/bible.db first" >&2; exit 2; }
    "$PY" "$HERE/fragments.py" --db "$CACHE/bible.db" --raw "$CACHE/raw" --out "$WORK" ${2:+--edition "$2"}
    ;;
  align)
    [ -n "${2:-}" ] || { echo "usage: run.sh align <EDITION> [book:chapter,...]" >&2; exit 2; }
    "$PY" "$HERE/align.py" --work "$WORK" --edition "$2" ${3:+--only "$3"}
    ;;
  build)
    mkdir -p "$DATA"
    "$PY" "$HERE/build.py" --work "$WORK" --out "$DATA" ${2:+--edition "$2"} --jobs "$(nproc)"
    ;;
  *)
    sed -n '2,7p' "$0" >&2; exit 2 ;;
esac
