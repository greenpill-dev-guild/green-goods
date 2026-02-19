**Deployment Overview (Sepolia + Arbitrum)**

**Verification Snapshot (2026-02-18)**

Validated from repo root with full dry-run simulation (no broadcast):

- `bun --filter @green-goods/contracts deploy:dry:mainnet` ✅
- `bun --filter @green-goods/contracts deploy:dry:sepolia` ✅
- `bun --filter @green-goods/contracts deploy:dry:arbitrum` ✅

Post-deploy validators currently fail against existing `*-latest.json` artifacts:

- `bun --filter @green-goods/contracts verify:post-deploy:sepolia` ❌ `contract ... does not have any code`
- `bun --filter @green-goods/contracts verify:post-deploy:arbitrum` ❌ `contract ... does not have any code`

Interpretation:

- Deployment wrappers and dry-run simulation path are working.
- Existing `deployments/11155111-latest.json` and `deployments/42161-latest.json` point to non-live/stale addresses for verification checks.
- Run broadcast in the sequence below so fresh deployment files are written, then re-run post-deploy verification.

`deploy:sepolia` / `deploy:arbitrum` (via `packages/contracts/package.json`) run the same core flow:

- Deploy core stack with CREATE2 (registry, modules, token, resolvers, ENS module, etc.).
- Configure Gardens/Octant/CookieJar wiring.
- Set community council safe (`GARDENS_COUNCIL_SAFE` or default multisig from `deployments/networks.json`).
- Run pre-seed hard gates (Hats admin, Gardens wiring, Octant/CookieJar readiness).
- Seed data from `config/gardens.json` and `config/actions.json`.
- Create root community + signal pools (action pool index `0`, hypercert pool index `1`).
- Enforce post-seed readiness (root domain mask `0x0F`, GOODS treasury seeded, vaults/jars present, ENS checks).
- Save deployment JSON, then auto-update Envio/docs (unless skipped by flag).

Network-specific ENS behavior:

- Sepolia: full ENS verification in-flow.
- Arbitrum: send-only guarantee; requires `ENS_L1_RECEIVER` set and send success, no L1 settlement wait.
- Ethereum mainnet: deploys the L1 ENS receiver infra (`GreenGoodsENSReceiver`) used by Arbitrum send-only registration.

---

**Critical ENS L1 Prerequisite (Must Happen Before Arbitrum)**

Before running `deploy:arbitrum`, deploy ENS infra on Ethereum mainnet once:

```bash
# from repo root
bun --filter @green-goods/contracts deploy:dry:mainnet
bun --filter @green-goods/contracts deploy:mainnet
```

After mainnet broadcast:

- `ENS_L1_RECEIVER` is auto-populated in root `.env` from `deployments/1-latest.json` (`ensReceiver`).
- Keep this value set for Arbitrum deployment.
- If auto-populate fails (permissions/path), set it manually from `ensReceiver` in `packages/contracts/deployments/1-latest.json`.

Notes:

- Mainnet ENS deployment requires deployer control over the base ENS node (default `greengoods.eth`, override with `ENS_BASE_NODE` if needed).

---

**Required Env Vars**

- `MAINNET_RPC_URL` (or `ALCHEMY_API_KEY` / `ALCHEMY_KEY`)
- `SEPOLIA_RPC_URL` (or `ALCHEMY_API_KEY` / `ALCHEMY_KEY`)
- `ARBITRUM_RPC_URL` (or `ALCHEMY_API_KEY` / `ALCHEMY_KEY`)
- `FOUNDRY_KEYSTORE_ACCOUNT` (default is `green-goods-deployer`)
- `ETHERSCAN_API_KEY` (for verification)
- `ENS_L1_RECEIVER` (required for Arbitrum broadcast)
- Keystore password (interactive prompt unless you run forge directly with `--password-file`)

Notes:
- Deploy scripts auto-derive mainnet/sepolia/arbitrum RPC URLs from `ALCHEMY_API_KEY` (or `ALCHEMY_KEY`) when chain-specific RPC env vars are unset.
- Celo is intentionally not auto-derived; keep `CELO_RPC_URL` as a dedicated endpoint.

If you want explicit sender matching:
- `SENDER_ADDRESS` (optional, passed to forge if set)

---

**Important Optional Env Vars**

- `GARDENS_COUNCIL_SAFE` (override council safe; otherwise defaults to multisig in `networks.json`)
- `COMMUNITY_GARDEN_SLUG` (default `community`)
- `GARDENS_REGISTRY_FACTORY`, `GARDENS_ALLO_ADDRESS`
- `REQUIRE_OCTANT_READY` (default `true`)
- `REQUIRE_COOKIEJAR_READY` (default `true`)
- `REQUIRE_ROOT_GARDEN_POOL` (Arbitrum defaults non-blocking unless set true)
- `AUTO_DEPLOY_OCTANT_FACTORY` (default `true`)
- `OCTANT_*` asset/strategy overrides
- `COOKIE_JAR_FACTORY_ADDRESS` (optional override)
- `AUTO_DEPLOY_MOCK_GARDENS_FACTORY` (Sepolia fallback behavior)
- `ALLOW_ACTION_IPFS_FALLBACK` (default strict `false`)

---

**CLI Flags You Can Pass**

- `--broadcast`
- `--dry-run` (full RPC simulation, no broadcast)
- `--pure-simulation` (compile-only preflight)
- `--force`
- `--update-schemas`
- `--salt <value>` (sets `DEPLOYMENT_SALT`)
- `--skip-envio`
- `--skip-verification`
- `--override-sepolia-gate` (bypasses Sepolia-first gate for Arbitrum/Celo)

---

**Recommended Run Order**

From repo root:

```bash
# 0) Mainnet ENS infra (required once before Arbitrum)
bun --filter @green-goods/contracts deploy:dry:mainnet
bun --filter @green-goods/contracts deploy:mainnet
# ENS_L1_RECEIVER is auto-populated in .env on successful mainnet broadcast

# 1) Sepolia preflight
bun --filter @green-goods/contracts deploy:dry:sepolia

# 2) Sepolia broadcast
bun --filter @green-goods/contracts deploy:sepolia

# 3) Sepolia post-deploy validation
bun --filter @green-goods/contracts verify:post-deploy:sepolia

# 4) Arbitrum preflight (ENS_L1_RECEIVER must already be set from mainnet step)
bun --filter @green-goods/contracts deploy:dry:arbitrum

# 5) Arbitrum broadcast
bun --filter @green-goods/contracts deploy:arbitrum

# 6) Arbitrum post-deploy validation
bun --filter @green-goods/contracts verify:post-deploy:arbitrum
```

Expected success markers:

- Dry runs print: `✅ Core dry-run simulation completed successfully`
- Mainnet broadcast prints ENS deployment output and writes `ensReceiver` to `packages/contracts/deployments/1-latest.json`
- `ENS_L1_RECEIVER` is updated in root `.env` automatically after successful mainnet broadcast
- Post-deploy verification should not return `contract ... does not have any code`

If post-deploy verification fails with `does not have any code`:

1. Confirm you are verifying the same network you just broadcasted.
2. Confirm `packages/contracts/deployments/<chainId>-latest.json` was freshly written by that broadcast.
3. Re-run the corresponding `verify:post-deploy:<network>` command.

Equivalent inside `packages/contracts`:

```bash
bun run deploy:dry:mainnet
bun run deploy:mainnet
# ENS_L1_RECEIVER auto-populated in ../../.env
bun run deploy:dry:sepolia
bun run deploy:sepolia
bun run verify:post-deploy:sepolia
bun run deploy:dry:arbitrum
bun run deploy:arbitrum
bun run verify:post-deploy:arbitrum
```

Compile-only preflight (no RPC calls) is still available:

```bash
bun run deploy:preflight:mainnet
bun run deploy:preflight:sepolia
bun run deploy:preflight:arbitrum
```

If you want, I can give you the same runbook as a copy-paste checklist with your exact env values filled in.
