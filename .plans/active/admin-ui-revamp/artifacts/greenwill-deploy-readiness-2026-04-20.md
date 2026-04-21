# GreenWill Phase 0 Deployment Readiness - 2026-04-20

Scope: deploy-lane readiness for Phase 0 badge locks + shared schema, plus the current downstream implications for the live GreenWill surfaces.

## Status

`badge-locks` and `badge-schemas` are now real deploy targets inside `bun script/deploy.ts`; they are no longer planning-only placeholders.

Current state after validation:

- `badge-locks` has a broadcast path, artifact writer, and deployment-JSON merge path.
- `badge-locks --network arbitrum --dry-run` now resolves the official Arbitrum Unlock factory from `networks.json` and completes successfully.
- `badge-schemas` has a broadcast path, artifact writer, and deployment-JSON merge path.
- `badge-schemas --dry-run` resolves the real Arbitrum SchemaRegistry and prints the exact calldata that would be broadcast.
- GreenWill-specific contract confidence is green on the focused test ladder:
  - `test/unit/GreenWill.t.sol`
  - `test/integration/GreenWillWorkflow.t.sol`
  - `test/fork/ArbitrumGreenWillSupport.t.sol`
- The **full** `bun run test:fork` suite is not green yet; current failures are in non-GreenWill fork coverage and include both live-state drift and RPC `429` rate limiting.

## CLI Surface — Shipped

Observed `bun script/deploy.ts --help` output:

```text
Commands:
  core                     Deploy core contracts
  goods                    Deploy GOODS Juicebox project (requires env vars)
  juicebox                 Alias for 'goods' deployment
  octant-factory           Deploy Octant vault factory (auto-updates deployment JSON)
  garden <config.json>     Deploy garden from config file
  actions <config.json>    Deploy actions from config file
  hats-tree                Create and configure the Hats protocol tree
  badge-locks              Deploy or dry-run GreenWill reputation badge Unlock locks
  badge-schemas            Deploy or dry-run GreenWill reputation badge EAS schema registration
  status [network]         Check deployment status
  fork <network>           Start Anvil fork for network
```

Observed command behavior in-tree:

| Command | Exit | Observed tail |
|---|---|---|
| `bun script/deploy.ts --help` | `0` | help table lists both commands as deploy-or-dry-run targets |
| `bun script/deploy.ts badge-locks --network arbitrum --dry-run` | `0` | `Badge lock dry-run plan complete.` |
| `bun script/deploy.ts badge-schemas --network arbitrum --dry-run` | `0` | `Badge schema dry-run plan complete.` |

Broadcast was intentionally **not executed** in this pass because it would create real onchain writes.

## Deployment File Persistence Shape — Locked

The persistence shape is now explicit and implemented.

### Shared schema

Persist in top-level `schemas.*`, matching the existing repo convention:

```text
schemas: {
  ...existing work / workApproval / assessment fields...,
  greenGoodsBadgeSchema:       "string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier",
  greenGoodsBadgeSchemaUID:    "<UID returned by SchemaRegistry.register>",
  greenGoodsBadgeName:         "GreenGoodsBadge",
  greenGoodsBadgeDescription:  "Shared EAS schema for GreenWill reputation badges"
}
```

One shared UID covers all 6 badges; per-badge distinction lives in the attestation `badgeType` field.

### Unlock locks

Persist under a grouped `unlock` object:

```text
unlock: {
  factory: "<Unlock factory address>",
  publicLockVersion: 14,
  managerDefaults: ["<address>", "..."],
  locks: {
    verifiedGardener: {
      badgeId: "verified-gardener",
      address: "<lock address>",
      name: "Green Goods Verified Gardener",
      expirationDuration: "0",
      transferrable: false
    },
    ... five more ...
  }
}
```

This is the shape now merged by `packages/contracts/script/deploy/badge-locks.ts` after a successful broadcast.

## Default Lock Managers

Manager defaults are now sourced from `packages/contracts/deployments/networks.json`:

```json
"badgeLockManagers": [
  "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19",
  "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  "0xa9d20b435A85fAAa002f32d66F7D21564130E9cf",
  "0x5c79d252f458b3720f7f230f8490fd1ee81d32fb",
  "0x6166E1964447E0959bC7c8d543DB3ab82dB65044"
]
```

The deploy script adds each configured manager to every newly created lock.

## Badge Policy

All Phase 0 Unlock locks are soulbound (`transferrable=false`).

| Badge ID | Expiration Policy |
|---|---|
| `verified-gardener` | `0` - lifetime |
| `active-contributor` | `31536000` - 1 year |
| `stewardship` | `0` - lifetime |
| `garden-operator` | `0` - manager-revoked operationally |
| `community-builder` | `0` - lifetime |
| `impact-verified` | `0` - lifetime |

## Contract Confidence

### Unit + integration

- `cd packages/contracts && bun run test:match 'test/unit/GreenWill.t.sol'` → pass
- `cd packages/contracts && bun run test:match 'test/integration/GreenWillWorkflow.t.sol'` → pass

### Fork

- `cd packages/contracts && set -a && . ../../.env 2>/dev/null || true && set +a && FOUNDRY_PROFILE=fork bun run test:match 'test/fork/ArbitrumGreenWillSupport.t.sol'` → pass
- `cd packages/contracts && bun run test:fork` → fails today outside GreenWill coverage

The fork suite now asserts the live-value path honestly:

- the supporter mints real Octant vault shares on live Arbitrum state
- the deposited value is fully accounted for either:
  - in the Aave-backed strategy, or
  - as idle vault WETH when the live Aave strategy reports zero additional capacity on that block
- `GreenWill.claimBadge(FIRST_SUPPORT, ...)` succeeds against that live position

This is stronger than the earlier router-only claim and more stable than assuming Aave always accepts new marginal deposits on every fork block.

The current full-fork failures are broader than GreenWill and cluster in:

- `test/fork/ArbitrumAaveStrategy.t.sol` — live Arbitrum WETH reserve currently reports `maxDeposit == 0` on the forked block for the tested path.
- `test/fork/SepoliaENS.t.sol` and `test/fork/e2e/SepoliaExtendedE2E.t.sol` — Sepolia CCIP fee and destination-chain assumptions no longer hold on the live router / mocked local router path.
- `test/fork/ArbitrumGoodsToken.t.sol`, `test/fork/ArbitrumActionRegistry.t.sol`, and other Arbitrum suites — a mix of stale expectations and RPC `429` rate limiting from the provider.

## Remaining Blockers Before Real Broadcast

1. **Confirm the default manager list.**
   The deployer is ready to add every `deploymentDefaults.badgeLockManagers` address to each lock. Expand that list before broadcast if we want named human operators beyond the safe.

2. **Confirm and fund the real broadcaster / attester wallet.**
   `badge-locks` and `badge-schemas` use the Foundry keystore account (`FOUNDRY_KEYSTORE_ACCOUNT`, default `green-goods-deployer`). That wallet must be the one we intend to use on Arbitrum and it must be funded.

3. **GreenWill deployment is still separate from Phase 0 lock/schema deploy.**
   The current deployment JSON does not yet record `greenWill`, so registry-backed claim hooks still resolve zero on live networks until GreenWill itself is deployed and written into the deployment surface.

4. **The broader fork suite still needs stabilization before calling the contracts package fully production-green.**
   The Phase 0 deploy lane is unblocked at the factory/schema level, but the repo still has non-GreenWill fork failures and RPC-capacity noise that should be triaged before a full-contracts release claim.

## Live-data Consequences

- [GreenWillPanel.tsx](/Users/afo/Code/greenpill/green-goods/packages/admin/src/views/Actions/GreenWillPanel.tsx) and [Badges.tsx](/Users/afo/Code/greenpill/green-goods/packages/client/src/views/Profile/Badges.tsx) still need explicit copy/metadata for the 6 new Phase 0 badge IDs.
- [contracts.ts](/Users/afo/Code/greenpill/green-goods/packages/shared/src/utils/blockchain/contracts.ts) currently exposes `greenWill`, which is the live address surface for registry-based claim flows, but standalone lock/schema deployment does not by itself light up those UI paths.
- Phase 0 lock/schema deployment therefore improves issuance infrastructure, but it does **not** by itself make the existing GreenWill claim UI live until the registry address and issuance path are wired.
