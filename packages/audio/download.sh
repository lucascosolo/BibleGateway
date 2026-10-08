#!/usr/bin/env bash
# Fetch the raw recordings named in sources.json into $CACHE/raw/<raw_dir>/. Idempotent and
# resumable: every transfer uses `curl -C -`, so rerunning after an interruption continues.
# Never deletes anything. Usage: ./download.sh web|bsb|kjv|heb|all
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${JOT_AUDIO_CACHE:-$HOME/.cache/jot-audio}"
RAW="${CACHE:?}/raw"
UA="Mozilla/5.0 (X11; Linux x86_64) jot-audio-pipeline"
mkdir -p "$RAW"

fetch() { # url, destination
  curl -sSL -C - -A "$UA" --retry 3 --retry-delay 5 -o "$2" "$1"
}

web() {
  # 1,189 chapter files, one URL each, listed on the index page (the zip bundles are gone).
  mkdir -p "$RAW/web"
  local index="$CACHE/webindex.htm"
  [ -s "$index" ] || curl -sSL -A "$UA" -o "$index" "https://www.audiotreasure.com/webindex.htm"
  grep -o 'content/WEBD_AT/[^"'"'"' >]*\.mp3' "$index" | sort -u > "$CACHE/web.list"
  local n=0
  while read -r rel; do
    local name; name="$(basename "$rel")"
    fetch "https://www.audiotreasure.com/$rel" "$RAW/web/$name"
    n=$((n + 1)); [ $((n % 50)) -eq 0 ] && echo "web $n"
  done < "$CACHE/web.list"
  echo "web done: $(find "$RAW/web" -name '*.mp3' | wc -l) files"
}

bsb() {
  # Two zip bundles from openbible.com, dedicated to the public domain with the BSB text.
  mkdir -p "$RAW/bsb" "$CACHE/zips"
  for z in BSB_00_Souer_NT.zip BSB_00_Souer_OT.zip; do
    fetch "https://openbible.com/audio/souer/$z" "$CACHE/zips/$z"
    unzip -n -q -j "$CACHE/zips/$z" '*.mp3' -d "$RAW/bsb"
  done
  echo "bsb done: $(find "$RAW/bsb" -name '*.mp3' | wc -l) files"
}

kjv() {
  # LibriVox's 127 multi-chapter files. The 64 kb/s variants are fetched and stored under the
  # base names that kjv-files.json uses; the aligner resamples to 16 kHz and the served clips
  # are re-encoded, so the higher bitrate would only cost bandwidth.
  mkdir -p "$RAW/kjv"
  python3 -I - "$HERE/kjv-files.json" > "$CACHE/kjv.list" <<'EOF'
import json, sys
for name, _title, _dur in json.load(open(sys.argv[1])):
    print(name)
EOF
  while read -r name; do
    fetch "https://archive.org/download/bible_kjv_complete_2001_librivox/${name%.mp3}_64kb.mp3" "$RAW/kjv/$name"
  done < "$CACHE/kjv.list"
  echo "kjv done: $(find "$RAW/kjv" -name '*.mp3' | wc -l) files"
}

heb() {
  # Rabbi Dan Be'eri's book-level recordings (CC BY-SA 3.0), 30 files.
  mkdir -p "$RAW/heb"
  curl -sS -A "$UA" "https://archive.org/metadata/TanakhAudioRecordingByRabbiDanBeeri-BookByBook/files" \
    | python3 -I -c "import json,sys; print('\n'.join(f['name'] for f in json.load(sys.stdin)['result'] if f['name'].endswith('.mp3')))" > "$CACHE/heb.list"
  while read -r name; do
    fetch "https://archive.org/download/TanakhAudioRecordingByRabbiDanBeeri-BookByBook/$name" "$RAW/heb/$name"
  done < "$CACHE/heb.list"
  echo "heb done: $(find "$RAW/heb" -name '*.mp3' | wc -l) files"
}

case "${1:-}" in
  web|bsb|kjv|heb) "$1" ;;
  all) heb; web; kjv; bsb ;;
  *) echo "usage: download.sh web|bsb|kjv|heb|all" >&2; exit 2 ;;
esac
