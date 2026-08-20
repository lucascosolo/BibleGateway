#!/usr/bin/env bash
# Tear down everything this project started on the VPS, and the local SSH tunnel.
#
# Run this at the end of any session that used scripts/sync-and-build.sh. Leaving a preview
# server or tunnel running is a task failure — see the `vps-test-cycle` skill.
#
#   ./scripts/teardown.sh            # stop server + tunnel, keep the scratch dir
#   ./scripts/teardown.sh --purge    # also delete /srv/scratch/jot (node_modules included)
set -uo pipefail

VPS="$HOME/.agents/skills/deploy/scripts/vps.sh"
REMOTE=/srv/scratch/jot
PORT=${PORT:-3987}
PURGE=${1:-}

echo "=== before ==="
"$VPS" run "free -m | awk '/Mem:/ {print \"  vps mem: used=\"\$3\"MB avail=\"\$7\"MB\"}'"

# Kill the preview server BY PORT. Never `pkill -f 'next start'` — that pattern also matches
# the ssh command string carrying it, so pkill kills its own session mid-command.
"$VPS" run "
PID=\$(ss -tlnp 2>/dev/null | grep ':$PORT' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
if [ -n \"\$PID\" ]; then kill -9 \"\$PID\"; sleep 2; echo '  stopped preview server (pid '\$PID')';
else echo '  no preview server running'; fi
ss -tln | grep -q ':$PORT' && echo '  WARNING: port $PORT still bound' || echo '  port $PORT free'
rm -f $REMOTE/server.pid $REMOTE/server.log $REMOTE/apitest.sh
"

if [ "$PURGE" = "--purge" ]; then
  # Move rather than rm -rf, per the delete-safely rule; a stale trash dir is cheap and a
  # wrong path is not recoverable.
  "$VPS" run "
    if [ -d $REMOTE ]; then
      mkdir -p /srv/trash && mv $REMOTE /srv/trash/jot-\$(date +%s) && echo '  scratch dir moved to /srv/trash'
    fi
  "
fi

# Local SSH tunnel.
if pgrep -f "$PORT:127.0.0.1:$PORT" >/dev/null 2>&1; then
  pkill -f "$PORT:127.0.0.1:$PORT" && echo "  closed local tunnel on :$PORT"
else
  echo "  no local tunnel running"
fi

echo "=== after ==="
"$VPS" run "free -m | awk '/Mem:/ {print \"  vps mem: used=\"\$3\"MB avail=\"\$7\"MB\"}'"

echo
echo "Anything still listening that belongs to this project should be reported, not ignored."
"$VPS" run "ss -tlnp 2>/dev/null | grep -E ':(3987|3000)' || echo '  nothing of ours listening'"
