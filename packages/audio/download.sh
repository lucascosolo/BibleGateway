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

is_audio() { # a file that begins like an MP3 (ID3 tag or an MPEG frame sync) or a zip
  local head; head="$(head -c 3 "$1" 2>/dev/null | od -An -tx1 | tr -d ' \n')"
  case "$head" in 494433|fffb*|fff3*|fff2*|ffe3*|504b03) return 0 ;; *) return 1 ;; esac
}

fetch() { # url, destination. Resumable; a leftover that is not audio (an error page) is redone.
  local url="$1" dest="$2"
  if [ -e "$dest" ] && ! is_audio "$dest"; then : > "$dest"; fi
  if ! curl -fsSL -C - -A "$UA" --retry 5 --retry-delay 10 --retry-all-errors -o "$dest" "$url"; then
    echo "failed: $url" >&2
    [ -e "$dest" ] && ! is_audio "$dest" && : > "$dest"
    return 1
  fi
  is_audio "$dest" || { echo "not audio after download: $dest" >&2; : > "$dest"; return 1; }
}

web() {
  # 1,189 chapter files, one URL each. The server's directory listing is the authority: the
  # index page misspells some names (Song of "Soloman", "1Thess"), which 404, and the zip bundles
  # are gone. Lamentations 5 and the one-chapter books use short names the fragments regex accepts.
  mkdir -p "$RAW/web"
  curl -sSL -A "$UA" "https://www.audiotreasure.com/content/WEBD_AT/" \
    | grep -o 'href="[^"]*\.mp3"' | cut -d'"' -f2 | sort -u > "$CACHE/web.list"
  [ -s "$CACHE/web.list" ] || { echo "web: empty directory listing" >&2; return 1; }
  local n=0 failed=0
  while read -r name; do
    fetch "https://www.audiotreasure.com/content/WEBD_AT/$name" "$RAW/web/$name" || failed=$((failed + 1))
    n=$((n + 1)); [ $((n % 50)) -eq 0 ] && echo "web $n"
  done < "$CACHE/web.list"
  [ "$failed" -eq 0 ] || echo "web: $failed files failed; rerun to retry" >&2
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
  local failed=0
  while read -r name; do
    fetch "https://archive.org/download/bible_kjv_complete_2001_librivox/${name%.mp3}_64kb.mp3" "$RAW/kjv/$name" || failed=$((failed + 1))
  done < "$CACHE/kjv.list"
  [ "$failed" -eq 0 ] || echo "kjv: $failed files failed; rerun to retry" >&2
  echo "kjv done: $(find "$RAW/kjv" -name '*.mp3' | wc -l) files"
}

heb() {
  # Rabbi Dan Be'eri's book-level recordings (CC BY-SA 3.0), 30 files.
  mkdir -p "$RAW/heb"
  curl -sS -A "$UA" "https://archive.org/metadata/TanakhAudioRecordingByRabbiDanBeeri-BookByBook/files" \
    | python3 -I -c "import json,sys; print('\n'.join(f['name'] for f in json.load(sys.stdin)['result'] if f['name'].endswith('.mp3')))" > "$CACHE/heb.list"
  local failed=0
  while read -r name; do
    fetch "https://archive.org/download/TanakhAudioRecordingByRabbiDanBeeri-BookByBook/$name" "$RAW/heb/$name" || failed=$((failed + 1))
  done < "$CACHE/heb.list"
  [ "$failed" -eq 0 ] || echo "heb: $failed files failed; rerun to retry" >&2
  echo "heb done: $(find "$RAW/heb" -name '*.mp3' | wc -l) files"
}

case "${1:-}" in
  web|bsb|kjv|heb) "$1" ;;
  all) heb; web; kjv; bsb ;;
  *) echo "usage: download.sh web|bsb|kjv|heb|all" >&2; exit 2 ;;
esac
