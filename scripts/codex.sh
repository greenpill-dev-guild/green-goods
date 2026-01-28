#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

CODEX_BIN="${CODEX_BIN:-codex}"

if [[ "$CODEX_BIN" == */* ]]; then
  if [[ ! -x "$CODEX_BIN" ]]; then
    echo "codex not found at: $CODEX_BIN" >&2
    exit 127
  fi
else
  CODEX_PATH="$(command -v "$CODEX_BIN" || true)"
  if [[ -z "$CODEX_PATH" ]]; then
    echo "codex binary not found in PATH. Set CODEX_BIN to the full path." >&2
    exit 127
  fi
  CODEX_BIN="$CODEX_PATH"
fi

exec "$CODEX_BIN" "$@"
