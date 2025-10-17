# Developer Guide

Day-to-day notes for contributors working in the Green Goods monorepo.

## Environment Setup

```bash
cp .env.example .env        # Root-only env file; no package-level variants
vi .env                     # Fill in required keys before running anything
```

Key expectations:

- **Authentication**: `VITE_PIMLICO_API_KEY` powers passkey smart accounts. The Privy keys remain for legacy data migration only—leave them blank unless you are running a migration job.
- **Chain selection**: `VITE_CHAIN_ID=84532` (Base Sepolia) is the default. Use `getDefaultChain()` throughout the app code instead of interrogating wallet state.
- **Shared services**: RPC URLs, Pinata JWTs, and Envio tokens all live in this root file; the packages read it automatically.

When credentials change, update `.env.example` in the same PR and note the change in your package README.

## Running Services

```bash
bun dev               # Starts client, admin, indexer via pm2
bun dev:stop          # Tears down the pm2 processes

# Individual surfaces (still respect the root env file)
bun --filter client dev
bun --filter admin dev
bun --filter indexer dev
bun --filter contracts dev   # anvil instance for contract work
```

Check status and logs with pm2:

```bash
bun exec pm2 list
bun exec pm2 logs client
```

## Testing

### Workspace Checks

```bash
bun format && bun lint && bun test   # formatting + lint + package unit tests
bun --filter contracts test          # foundry suite with gas report
```

### Playwright E2E Suite

The CLI runner in `tests/run-tests.js` wraps Playwright projects and enforces the right options.

```bash
node tests/run-tests.js smoke        # Fast connectivity + login checks (30s)
node tests/run-tests.js integration  # Core flows, offline queue, blockchain paths
node tests/run-tests.js all          # Entire matrix
node tests/run-tests.js check        # Verify services are up before running tests
```

If Playwright is missing, the runner will install it automatically. Pass additional Playwright flags by setting `PLAYWRIGHT_CLI_ARGS="--repeat-each=2"` before the command.

## Troubleshooting

- **Services won’t start**: `bun dev:stop && bun dev` clears stale pm2 state. Confirm you are on Node 20 and bun 1.x.
- **Port conflicts**: `lsof -t -i:3001 -i:8080 | xargs kill -9` frees the default ports.
- **Missing deps**: Delete `node_modules`, run `bun install`, and rerun `bun format && bun lint && bun test`.
- **Contract scripts ask for package .env**: Always run from repo root or pass `dotenv -e ../../.env` when invoking Foundry directly. The Contracts Handbook lists the supported wrappers.
- **Legacy Privy errors**: Remove Privy environment variables if you aren’t running migration code. All new auth flows are powered by Pimlico and WalletConnect.

Reach out in Discord (`#green-goods-dev`) or file a GitHub issue if you hit blockers that aren’t covered here.
