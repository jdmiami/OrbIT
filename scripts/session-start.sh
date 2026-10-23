#!/usr/bin/env bash
# Cloud sessions start from a fresh clone: install dependencies so typecheck, tests and the
# browser build work straight away. Local sessions are left alone.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ ! -d node_modules ]; then
  npm install --no-audit --no-fund >/dev/null 2>&1 || echo "npm install failed; run it by hand" >&2
fi
