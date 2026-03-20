#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(cd "$CONTRACTS_DIR/../.." && pwd)"
MODE="${1:-full}"

if [ "$#" -gt 0 ]; then
  shift
fi

cd "$CONTRACTS_DIR"

set -a
. "$ROOT_DIR/.env" 2>/dev/null || true
set +a

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

pin_block() {
  local rpc_var="$1"
  local block_var="$2"

  if [ -z "${!rpc_var:-}" ] || [ -n "${!block_var:-}" ]; then
    return
  fi

  local block_number
  block_number="$(cast block-number --rpc-url "${!rpc_var}")"
  export "${block_var}=${block_number}"
  echo "Pinned ${block_var}=${block_number}" >&2
}

case "$MODE" in
  workflow|sepolia)
    require_env "SEPOLIA_RPC_URL"
    ;;
  arbitrum)
    require_env "ARBITRUM_RPC_URL"
    ;;
  karma)
    require_env "ARBITRUM_RPC_URL"
    require_env "SEPOLIA_RPC_URL"
    ;;
  celo)
    require_env "CELO_RPC_URL"
    ;;
  full)
    require_env "SEPOLIA_RPC_URL"
    require_env "ARBITRUM_RPC_URL"
    ;;
  *)
    echo "Unknown E2E mode: $MODE" >&2
    exit 1
    ;;
esac

pin_block "SEPOLIA_RPC_URL" "SEPOLIA_FORK_BLOCK_NUMBER"
pin_block "ARBITRUM_RPC_URL" "ARBITRUM_FORK_BLOCK_NUMBER"
pin_block "CELO_RPC_URL" "CELO_FORK_BLOCK_NUMBER"

bun run build

case "$MODE" in
  workflow)
    FOUNDRY_PROFILE=e2e forge test --match-contract 'E2EWorkflowForkTest' -vv "$@"
    ;;
  karma)
    FOUNDRY_PROFILE=fork forge test --match-contract 'ArbitrumKarmaGAPForkTest' -vv "$@"
    FOUNDRY_PROFILE=fork forge test --match-contract 'SepoliaKarmaGAPForkTest' -vv "$@"
    ;;
  sepolia)
    FOUNDRY_PROFILE=e2e forge test --match-path 'test/fork/e2e/FullProtocolE2E.t.sol' -vvv "$@"
    FOUNDRY_PROFILE=e2e forge test --match-path 'test/fork/e2e/SepoliaExtendedE2E.t.sol' -vvv "$@"
    ;;
  arbitrum)
    FOUNDRY_PROFILE=e2e forge test --match-path 'test/fork/e2e/Arbitrum*.t.sol' -vvv "$@"
    ;;
  celo)
    FOUNDRY_PROFILE=fork forge test --match-test 'testFork.*Celo|test_celo.*' -vvv "$@"
    ;;
  full)
    FOUNDRY_PROFILE=e2e forge test --match-contract 'E2EWorkflowForkTest' -vv "$@"
    FOUNDRY_PROFILE=fork forge test --match-contract 'ArbitrumKarmaGAPForkTest' -vv "$@"
    FOUNDRY_PROFILE=fork forge test --match-contract 'SepoliaKarmaGAPForkTest' -vv "$@"
    FOUNDRY_PROFILE=e2e forge test --match-path 'test/fork/e2e/FullProtocolE2E.t.sol' -vvv "$@"
    FOUNDRY_PROFILE=e2e forge test --match-path 'test/fork/e2e/SepoliaExtendedE2E.t.sol' -vvv "$@"
    FOUNDRY_PROFILE=e2e forge test --match-path 'test/fork/e2e/Arbitrum*.t.sol' -vvv "$@"
    ;;
esac
