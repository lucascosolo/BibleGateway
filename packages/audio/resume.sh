#!/usr/bin/env bash
# Run one GPU aligner at a time; chapter state files make interruption resumable.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${JOT_AUDIO_CACHE:-$HOME/.cache/jot-audio}"
export OMP_NUM_THREADS=4 MKL_NUM_THREADS=4
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
for edition in WLC-beeri WEB-williams BSB-souer KJV-librivox; do
  printf '%s START %s\n' "$(date -u +%FT%TZ)" "$edition"
  "$HERE/run.sh" align "$edition"
  printf '%s DONE %s\n' "$(date -u +%FT%TZ)" "$edition"
done
printf '%s ALIGNMENT_COMPLETE — run build.py to package and validate before deployment\n' "$(date -u +%FT%TZ)"
