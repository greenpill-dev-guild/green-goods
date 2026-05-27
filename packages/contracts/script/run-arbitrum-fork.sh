#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f "../../.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "../../.env"
  set +a
fi

RPC_URL="${ARBITRUM_RPC_URL:-}"
if [ -z "$RPC_URL" ]; then
  ALCHEMY_KEY_VALUE="${ALCHEMY_API_KEY:-${ALCHEMY_KEY:-${VITE_ALCHEMY_API_KEY:-}}}"
  if [ -n "$ALCHEMY_KEY_VALUE" ]; then
    RPC_URL="https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY_VALUE}"
  else
    RPC_URL="https://arb1.arbitrum.io/rpc"
  fi
fi

mkdir -p .generated/runtime

exec anvil \
  --fork-url "$RPC_URL" \
  --chain-id 42161 \
  --accounts 10 \
  --balance 10000 \
  --port "${ANVIL_PORT:-3009}" \
  --config-out .generated/runtime/arbitrum-fork.json
