#!/usr/bin/env bash
# Run one GPU aligner at a time; chapter state files make interruption resumable. An edition
# whose fragments are not generated yet (its downloads still running) is skipped with a note,
# so the run can start as soon as the first edition is ready and be rerun for the rest.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${JOT_AUDIO_CACHE:-$HOME/.cache/jot-audio}"
export OMP_NUM_THREADS=4 MKL_NUM_THREADS=4
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
skipped=()
for edition in WLC-beeri WEB-williams BSB-souer KJV-librivox; do
  if [ ! -s "$CACHE/work/$edition.fragments.json" ]; then
    printf '%s SKIP %s (no fragments yet: finish its download, then ./run.sh fragments %s and rerun)\n' "$(date -u +%FT%TZ)" "$edition" "$edition"
    skipped+=("$edition")
    continue
  fi
  printf '%s START %s\n' "$(date -u +%FT%TZ)" "$edition"
  "$HERE/run.sh" align "$edition"
  printf '%s DONE %s\n' "$(date -u +%FT%TZ)" "$edition"
done
if [ "${#skipped[@]}" -gt 0 ]; then
  printf '%s ALIGNMENT_PARTIAL — skipped: %s; rerun after their fragments exist\n' "$(date -u +%FT%TZ)" "${skipped[*]}"
else
  printf '%s ALIGNMENT_COMPLETE — run build.py to package and validate before deployment\n' "$(date -u +%FT%TZ)"
fi
