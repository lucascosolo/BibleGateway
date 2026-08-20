#!/usr/bin/env bash
# Push local source to the VPS scratch dir, rebuild, and restart the preview server.
#
# All heavy work (install, build, test, serve) runs on the VPS — never on the laptop.
# See the `vps-test-cycle` skill. Tear down with scripts/teardown.sh when finished.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS="$HOME/.agents/skills/deploy/scripts/vps.sh"
REMOTE=/srv/scratch/jot
PORT=${PORT:-3987}

cd "$REPO"
tar czf /tmp/jot-sync.tgz --exclude=node_modules --exclude=.next --exclude=.git \
  apps/web/src apps/web/package.json apps/web/next.config.ts apps/web/tsconfig.json \
  apps/web/vitest.config.ts apps/web/postcss.config.mjs apps/web/eslint.config.mjs \
  scripts/a11y.mjs
"$VPS" push /tmp/jot-sync.tgz "$REMOTE/" >/dev/null
rm -f /tmp/jot-sync.tgz

"$VPS" run "
set -e
cd $REMOTE && tar xzf jot-sync.tgz && rm jot-sync.tgz

cd $REMOTE/apps/web
# Install gate. \`npm install | tail -2\` was NOT a gate: a pipeline's status is the last
# command's, and \`tail\` exits 0 whether or not npm did — so a failed install carried on and
# built against whatever stale or partial node_modules happened to be on disk. Same class of
# hole as the build gate below, found by an adversarial review after the build one was fixed.
npm install --no-audit --no-fund > /tmp/jot-install.log 2>&1 || INSTALL=\$?
INSTALL=\${INSTALL:-0}
tail -2 /tmp/jot-install.log
if [ \"\$INSTALL\" -ne 0 ]; then
  tail -30 /tmp/jot-install.log >&2
  echo \"INSTALL GATE FAILED\" >&2
  exit 1
fi
# The rendered accessibility gate uses the same Playwright browser as the screenshot harness.
# Install it on the VPS (never the laptop); Playwright reuses its cache on subsequent deploys.
PLAYWRIGHT=0
npx playwright install chromium > /tmp/jot-playwright-install.log 2>&1 || PLAYWRIGHT=\$?
if [ "\$PLAYWRIGHT" -ne 0 ]; then
  tail -30 /tmp/jot-playwright-install.log >&2
  echo "PLAYWRIGHT BROWSER GATE FAILED" >&2
  exit 1
fi
# The build gate. This USED to be \`npm run build | grep ...\`, which is not a gate at all:
# a pipeline's exit status is the LAST command's, so \`set -e\` saw grep succeed and carried on
# past a failed compile. It printed the word \"Failed\" and then reported every later gate as
# ok — the type error itself was filtered out by the very grep that hid the failure. Capture
# the output, check the real status, and only then filter for readability.
#
# \`|| BUILD=\$?\` rather than a bare call followed by \`\$?\`: under \`set -e\` a failing command
# terminates the shell before the next line runs, so the status would never be read.
BUILD=0
npm run build > /tmp/jot-build.log 2>&1 || BUILD=\$?
grep -E 'Compiled|Failed|Error:|error TS|Route \(app\)' /tmp/jot-build.log | head -20
if [ \"\$BUILD\" -ne 0 ]; then
  echo \"--- build output (tail) ---\" >&2
  tail -40 /tmp/jot-build.log >&2
  echo \"BUILD GATE FAILED\" >&2
  exit 1
fi
echo \"build gate ok\"

# Architecture gate. eslint.config.mjs carries invariant #2 (exactly one scripture renderer)
# as a no-restricted-imports rule; \`next build\` does not run eslint, so run it explicitly or
# the rule is decorative.
npm run lint 2>&1 | tail -15
LINT=\${PIPESTATUS[0]}
if [ \"\$LINT\" -ne 0 ]; then
  echo \"LINT GATE FAILED\" >&2
  exit 1
fi
echo \"lint gate ok\"

# Test gate. \`next build\` does not run vitest either, so the unit tests — including the
# design-token gate that catches a silently-invalid oklch() — only guard anything if they are
# run here. They were not, and the whole shadow system shipped broken as a result.
npm test 2>&1 | tail -20
TESTS=\${PIPESTATUS[0]}
if [ \"\$TESTS\" -ne 0 ]; then
  echo \"TEST GATE FAILED\" >&2
  exit 1
fi
echo \"test gate ok\"

# Typography gate. Next does not fail a build when a webfont cannot be resolved — it emits
# the CSS variable with no @font-face behind it and every surface quietly falls back to a
# system font. The reader shipped in Arial that way once. Assert the faces are really there.
#
# Counts only the rules that actually SERVE a file. A bare '@font-face' count was too weak in
# two directions: next/font also emits metric-adjusted fallback faces, which have no \`src\`
# and would pad the total; and a hard-coded '>=4' silently stopped meaning anything the moment
# a fifth face was added. The expected number is read from layout.tsx, so adding or removing a
# face updates the gate by construction rather than by remembering to.
WANT=\$(grep -c 'path: \"./fonts/' src/app/layout.tsx)
FACES=\$(grep -oh 'src:url(/_next/static/media/' .next/static/css/*.css 2>/dev/null | wc -l)
if [ \"\$FACES\" -lt \"\$WANT\" ]; then
  echo \"FONT GATE FAILED: layout.tsx declares \$WANT face(s); the build serves \$FACES\" >&2
  exit 1
fi
echo \"font gate ok: \$FACES of \$WANT declared faces served\"

# Keep the previous server available while install, build, and all validation gates run.
# Restart only after the new build is known to be ready, so a long build cannot expose a 502.
PID=\$(ss -tlnp 2>/dev/null | grep ':$PORT' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
[ -n \"\$PID\" ] && kill -9 \"\$PID\" && sleep 2 || true

nohup npx next start -p $PORT -H 127.0.0.1 > $REMOTE/server.log 2>&1 &
sleep 7
ss -tlnp 2>/dev/null | grep ':$PORT' | grep -oP 'pid=\K[0-9]+' | head -1 > $REMOTE/server.pid
echo \"server pid: \$(cat $REMOTE/server.pid)\"

# Smoke gate. This used to PRINT the status codes and accept every one of them, so a build
# that compiled cleanly and then threw a server-side exception on every route was reported as
# a successful cycle — which is exactly how a 500 reached the live site once. Non-200 now
# fails, and the route list covers one page per workspace rather than three landmarks.
SMOKE=0
for p in / /api /api/openapi.json /api/corpus /llms.txt /llms-full.txt /robots.txt /sitemap.xml /read/Gen.1 /read/John.3 /api/originals?ref=John+3:16 /api/original-search?language=grc\&q=agape /api/concordance?key=H2617a\&limit=2 /parallel/John.3 /notes /lashon /lashon/H2617a /lashon/H7307 /derash /deep-dive/John.3.16 /toledot /geniza /massaot /style /roadmap; do
  CODE=\$(curl -s -o /dev/null -w '%{http_code}' \"http://127.0.0.1:$PORT\$p\")
  printf '%-20s %s\n' \"\$p\" \"\$CODE\"
  [ \"\$CODE\" = \"200\" ] || SMOKE=1
done
if [ \"\$SMOKE\" -ne 0 ]; then
  echo \"--- server log (tail) ---\" >&2
  tail -30 $REMOTE/server.log >&2
  echo \"SMOKE GATE FAILED: at least one route did not return 200\" >&2
  exit 1
fi
echo \"smoke gate ok\"

# Rendered accessibility gate. axe checks WCAG A/AA semantics and contrast; the harness also
# checks keyboard focus containment inside dialogs. This runs on the VPS with the real browser.
node $REMOTE/scripts/a11y.mjs \"http://127.0.0.1:$PORT\"
"
