# Contracts Handbook

Operational guide for the Solidity workspace (`packages/contracts`). Every flow routes through the scripted wrappers around Foundry; do not bypass them unless explicitly debugging.

## Prerequisites

- Node 20+, bun 1.x
- Foundry (forge, cast, anvil)
- Root `.env` populated with:
  - `FOUNDRY_KEYSTORE_ACCOUNT`
  - RPC URLs for the target networks (Base Sepolia is the default chain)
  - Optional: `ETHERSCAN_API_KEY` (V2) for verification
- Deployment key imported into Foundry keystore:

  ```bash
  cast wallet import green-goods-deployer --interactive
  ```

## Deployments

All deployments run through `deploy.ts`, wrapped by bun scripts so environment loading and schema setup stay consistent.

```bash
# Local anvil deployment with fixtures
bun --filter contracts deploy:local

# Base Sepolia (default testnet) – broadcasts transactions
bun --filter contracts deploy:testnet

# Mainnets (requires funded deployer)
bun --filter contracts deploy:celo
bun --filter contracts deploy:arbitrum
```

Optional parameters:

- `bun --filter contracts deploy:dry:testnet` — simulates without broadcasting
- `bun script/deploy.ts core --network baseSepolia --broadcast --update-schemas` — refreshes schema metadata without redeploying contracts
- `bun script/deploy.ts core --network baseSepolia --broadcast --force` — full reset (use only for initial network bring-up)

Deployment artifacts live in `packages/contracts/deployments/<chainId>-latest.json`. Treat these files as source of truth for frontends and indexer.

## Upgrades

Contracts use the UUPS proxy pattern. Trigger upgrades via the wrappers so implementation addresses and verifications stay in sync.

```bash
# Upgrade the entire suite on Base Sepolia
bun --filter contracts upgrade:testnet

# Mainnet upgrades
bun --filter contracts upgrade:celo
bun --filter contracts upgrade:arbitrum
```

To target an individual contract, call `bun script/upgrade.ts <target> --network <network> --broadcast` (e.g. `action-registry`, `work-resolver`). Only use raw `forge script` for exploratory debugging.

GardenAccount resolvers are immutable; resolver upgrades require a new implementation. Follow the upgrade script prompts and announce opt-in steps to garden owners.

## Schema Management

Production schemas are locked in `config/schemas.json`. Never edit this file directly.

Common scenarios:

- **Metadata refresh** (name/description fix):

  ```bash
  bun script/deploy.ts core --network baseSepolia --broadcast --update-schemas
  ```

- **New schema version for testing**: create `config/schemas.test.json` and wire it into your local deployment branch; do not commit changes to `schemas.json`.

Document new schema UIDs and their usage in the Platform Overview or package README so frontends can consume them safely.

## Validation Checklist

- `bun --filter contracts build` — ensures via-IR compilation succeeds without warnings
- `bun --filter contracts test` — runs the Foundry suite (unit, integration, gas report)
- `node tests/run-tests.js blockchain` — optional UI smoke for chain wiring after deployments
- Review gas output in `forge test --gas-report`; flag regressions above the target envelopes in PRs

Before a production deployment, capture:

- Test results (`bun --filter contracts test`)
- Gas report snapshot
- Deployment summary (`bun script/deploy.ts status --network <network>`)

Store deployment notes alongside the commit or link them in the PR description for traceability.
