#!/usr/bin/env bash
# Push the ingest package to the VPS and rebuild data/bible.db there.
#
# The corpus is a build artifact, not source, and building it is heavy: ~600k original-language
# words parsed out of 20MB of OSIS XML, plus 344k cross-references expanded over the real verse
# set. That runs on the VPS like everything else — see the `vps-test-cycle` skill.
#
# The app is NOT restarted here. `next start` holds the database open, and a running server
# reading a corpus that is being rewritten underneath it is exactly the kind of half-state that
# produces an unreproducible bug. Run scripts/sync-and-build.sh afterwards to pick up the new
# corpus.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS="$HOME/.agents/skills/deploy/scripts/vps.sh"
REMOTE=/srv/scratch/jot

cd "$REPO"

# A backtick inside the schema's SQL comments terminates the JavaScript template literal that
# holds it, and the parse error lands twenty lines further on with a message ("',' expected")
# that says nothing about backticks. This has now cost three build cycles. SQL comments quote
# identifiers with "double quotes"; the check is one line and it runs before the 15-minute
# upload-and-ingest, not after it.
if BAD=$(grep -n '^\s*--.*`' packages/ingest/src/ingest.ts); then
  echo "Backtick inside a SQL comment — it will end the template literal, not quote a name."
  echo "Use \"double quotes\" for identifiers in SQL comments."
  echo "$BAD"
  exit 1
fi

tar czf /tmp/jot-ingest.tgz --exclude=node_modules --exclude=.git \
  packages/ingest/src packages/ingest/package.json packages/ingest/tsconfig.json
"$VPS" push /tmp/jot-ingest.tgz "$REMOTE/" >/dev/null
rm -f /tmp/jot-ingest.tgz

"$VPS" run "
set -e
cd $REMOTE && tar xzf jot-ingest.tgz && rm jot-ingest.tgz
cd $REMOTE/packages/ingest
npm install --no-audit --no-fund 2>&1 | tail -2
INSTALL=\${PIPESTATUS[0]}
if [ "\$INSTALL" -ne 0 ]; then echo 'INGEST INSTALL GATE FAILED' >&2; exit 1; fi
npx tsc -p tsconfig.json --noEmit
echo 'ingest typecheck ok'
npm run ingest 2>&1 | tail -60
INGEST=\${PIPESTATUS[0]}
if [ "\$INGEST" -ne 0 ]; then echo 'INGEST GATE FAILED' >&2; exit 1; fi
echo 'ingest gate ok'
"
