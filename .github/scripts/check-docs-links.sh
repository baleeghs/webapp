#!/usr/bin/env bash
# Fails when a Markdown file links to a repository path that does not exist. External (http)
# links and in-page anchors are not checked.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

status=0
while IFS= read -r md; do
  dir=$(dirname "$md")
  # Inline links: [text](target). Strip any #anchor and ignore URLs and mailto.
  while IFS= read -r target; do
    path=${target%%#*}
    [ -z "$path" ] && continue
    case "$path" in http://* | https://* | mailto:*) continue ;; esac
    if [ ! -e "$dir/$path" ]; then
      echo "✗ $md: broken link → $target" >&2
      status=1
    fi
  done < <(grep -oE '\]\([^) ]+\)' "$md" | sed -E 's/^\]\((.*)\)$/\1/')
done < <(git ls-files --cached --others --exclude-standard '*.md' | grep -v node_modules)

[ "$status" -eq 0 ] && echo '✓ documentation links resolve'
exit "$status"
