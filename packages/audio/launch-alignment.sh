#!/usr/bin/env bash
# Start the full alignment as a transient user service, outside any sandbox, so it can see the
# GPU and outlive the terminal. Run it yourself from a normal shell (or with `!` in Claude Code):
#
#   packages/audio/launch-alignment.sh
#
# It runs resume.sh (Hebrew → WEB → BSB → KJV, one aligner at a time, resumable per chapter) under
# limits like the September 2026 run: 24 hours, 10 GB RAM, four CPU threads, nice 10. Watch it with
#   systemctl --user status jot-audio-alignment
#   tail -f ~/.cache/jot-audio/work/resume-<date>.log
# and stop it with `systemctl --user stop jot-audio-alignment`. Rerunning this script after a stop
# or a failure continues from each chapter's saved state. Nothing here deploys or publishes.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${JOT_AUDIO_CACHE:-$HOME/.cache/jot-audio}"
UNIT="jot-audio-alignment"
LOG="${CACHE:?}/work/resume-$(date -u +%Y%m%d-%H%M%S).log"

[ -x "$CACHE/venv/bin/python" ] || { echo "no venv at $CACHE/venv (see README.md)" >&2; exit 2; }
for d in heb web kjv bsb; do
  n="$(find "$CACHE/raw/$d" -name '*.mp3' 2>/dev/null | wc -l)"
  echo "raw/$d: $n files"
done
[ -s "$CACHE/work/WLC-beeri.fragments.json" ] || { echo "run ./run.sh fragments first" >&2; exit 2; }
mkdir -p "$CACHE/work"

if systemctl --user is-active --quiet "$UNIT"; then
  echo "$UNIT is already running; stop it first if you mean to restart" >&2
  exit 1
fi

systemd-run --user --unit="$UNIT" --collect \
  --property=RuntimeMaxSec=86400 \
  --property=MemoryMax=10G \
  --property=CPUQuota=400% \
  --property=Nice=10 \
  --setenv=JOT_AUDIO_CACHE="$CACHE" \
  --setenv=HOME="$HOME" \
  --working-directory="$HERE" \
  /bin/bash -c "exec '$HERE/resume.sh' >> '$LOG' 2>&1"

echo "started $UNIT; log: $LOG"
