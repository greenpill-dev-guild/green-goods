#!/bin/bash
# Resolve the installed Codex CLI without assuming one macOS app bundle name.
set -uo pipefail

if [ -n "${CODEX:-}" ]; then
  if [ -x "$CODEX" ]; then
    printf '%s\n' "$CODEX"
    exit 0
  fi

  echo "CODEX is not executable: $CODEX" >&2
  exit 1
fi

for candidate in \
  "/Applications/ChatGPT.app/Contents/Resources/codex" \
  "/Applications/Codex.app/Contents/Resources/codex"
do
  if [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    exit 0
  fi
done

path_candidate="$(command -v codex 2>/dev/null || true)"
if [ -n "$path_candidate" ] && [ -x "$path_candidate" ]; then
  printf '%s\n' "$path_candidate"
  exit 0
fi

echo "Codex CLI not found. Install ChatGPT.app/Codex.app, add codex to PATH, or set CODEX." >&2
exit 1
