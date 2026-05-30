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

PORT="${ANVIL_PORT:-3009}"
CONFIG_OUT=".generated/runtime/arbitrum-fork.json"
ANVIL_MNEMONIC="test test test test test test test test test test test junk"
ANVIL_DERIVATION_PATH="m/44'/60'/0'/0/"

echo "Starting Anvil Arbitrum fork on 127.0.0.1:${PORT} (chain id 42161; fork RPC redacted)."
echo "Anvil startup output is silenced to avoid printing RPC credentials."
echo "Local Anvil account details are written to ${CONFIG_OUT}; the fork endpoint is redacted there."

cat > "$CONFIG_OUT" <<'JSON'
{
  "available_accounts": [
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
    "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
    "0x976ea74026e726554db657fa54763abd0c3a0aa9",
    "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
    "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8",
    "0xa0ee7a142d267c1f36714e4a8f75612f20a79720"
  ],
  "private_keys": [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103ebf1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"
  ],
  "endpoint": "[redacted]",
  "chain_id": 42161,
  "wallet": {
    "mnemonic": "test test test test test test test test test test test junk",
    "derivation_path": "m/44'/60'/0'/0/"
  }
}
JSON

anvil \
  --silent \
  --fork-url "$RPC_URL" \
  --chain-id 42161 \
  --mnemonic "$ANVIL_MNEMONIC" \
  --derivation-path "$ANVIL_DERIVATION_PATH" \
  --accounts 10 \
  --balance 10000 \
  --port "$PORT" &

ANVIL_PID=$!

cleanup() {
  kill "$ANVIL_PID" 2>/dev/null || true
  wait "$ANVIL_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait "$ANVIL_PID"
STATUS=$?

trap - INT TERM EXIT
exit "$STATUS"
