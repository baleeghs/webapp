#!/usr/bin/env bash
# Repository checks that no linter covers. Run from anywhere; exits non-zero on any finding.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

status=0
fail() {
  echo "✗ $1" >&2
  status=1
}

# Tracked and new (not ignored) files, so this also works before the first commit.
files() { git ls-files --cached --others --exclude-standard "$@"; }

# Unresolved merge conflicts.
if files | xargs grep -lE '^(<<<<<<<|>>>>>>>) ' 2>/dev/null; then
  fail 'merge conflict markers'
fi

# Focused tests silently skip everything else in CI.
if files 'web/src/**' 'web/e2e/**' | xargs grep -nE '\b(it|test|describe)\.only\(' 2>/dev/null; then
  fail 'focused tests (.only) in web tests'
fi

# A committed .env usually means committed secrets.
if files | grep -E '(^|/)\.env$'; then
  fail '.env is tracked; keep secrets out of git (use .env.example)'
fi

# Large files belong in releases or object storage, not git history.
while IFS= read -r f; do
  if [ -f "$f" ] && [ "$(wc -c <"$f")" -gt 1048576 ]; then fail "file over 1 MiB: $f"; fi
done < <(files)

# Migrations come in reversible pairs.
for up in server/migrations/*.up.sql; do
  [ -e "$up" ] || continue
  [ -f "${up%.up.sql}.down.sql" ] || fail "migration without a .down.sql: $up"
done

[ "$status" -eq 0 ] && echo '✓ hygiene checks passed'
exit "$status"
