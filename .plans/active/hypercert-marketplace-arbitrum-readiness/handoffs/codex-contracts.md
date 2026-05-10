# Contracts Lane Handoff

**Actual branch**: `main` per operator instruction to stay on main.
**Planned branch**: `codex/contracts/hypercert-marketplace-arbitrum-readiness`
**Status**: completed after post-broadcast reconciliation.
**Date**: 2026-05-10

## Scope Completed

- Added repo/package wrappers for no-broadcast Hypercert marketplace status and dry-run configuration on Arbitrum.
- Added an approval-gated `contracts:marketplace:configure:arbitrum` wrapper. It requires `MARKETPLACE_CONFIGURE_APPROVED=true` before any broadcast path can run.
- Hardened `contracts:verify:post-deploy:arbitrum` to run marketplace readiness checks against deployment JSON, bytecode, owner expectations, pause state, adapter/module wiring, exchange transfer manager, strategy id `1`, and authorized module state.
- Added deployment JSON marketplace fields for Arbitrum from repo-pinned Hypercert packages.
- Narrowed indexer readiness to contracts that Envio currently defines/indexes and logs skipped deployed-but-undefined contracts.
- Did not touch `YieldSplitter.setHypercertMarketplace`.
- Codex did not broadcast transactions.
- Reconciled the stale blocked lane state after the operator broadcast using direct viem JSON-RPC evidence supplied on 2026-05-10.

## TDD Proof

### RED

Command:

```bash
cd packages/contracts
bun run test:script -- script/utils/marketplace-readiness.test.ts
```

Result before implementation: failed because `script/utils/marketplace-readiness.test.ts` imported missing module `./marketplace-readiness`.

Coverage added in the RED tests:

- zero or missing Hypercert exchange/minter/transfer manager/strategy config
- adapter/module minter mismatch
- paused adapter
- unexpected adapter/module owner when expected owner is declared
- unauthorized module state
- wrong exchange transfer manager
- unsupported strategy id
- dry-run owner call planning that never prepares `YieldSplitter.setHypercertMarketplace`
- indexer policy for deployed-but-not-indexed contracts

### GREEN

Command:

```bash
cd packages/contracts
bun run test:script -- script/utils/marketplace-readiness.test.ts
```

Result after implementation: passed. The current package wrapper also passes:

```bash
cd packages/contracts
bun run test:script
```

Latest result: 2 files passed, 16 tests passed.

## Address Proof

Address candidates were not invented. They were read from repo-pinned Hypercert packages:

```bash
bun --cwd packages/shared -e "import('@hypercerts-org/marketplace-sdk').then((m)=>console.log(JSON.stringify(m.addressesByNetwork[42161], null, 2)))"
bun --cwd packages/shared -e "import('@hypercerts-org/contracts').then((m)=>console.log(JSON.stringify(m.deployments[42161] ?? m.DEPLOYMENTS?.[42161] ?? Object.keys(m).slice(0,20), null, 2)))"
```

Arbitrum values recorded in `packages/contracts/deployments/42161-latest.json`:

- `hypercertExchange`: `0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83`
- `hypercertMinter`: `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07`
- `transferManager`: `0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB`
- `strategyHypercertFractionOffer`: `0xecab24cade0261fc6513ca13bb3d10f760af3da8`

Live status now proves bytecode exists and exchange `strategyInfo(1)` is active with implementation `0xECaB24CADe0261fc6513ca13bb3d10f760AF3da8`.

## Post-Broadcast Live Arbitrum Evidence

The old blocked state was stale after the operator broadcast. This reconciliation uses the direct viem JSON-RPC evidence supplied in-session on 2026-05-10 rather than trusting the local `cast`-backed status wrapper.

Verified live Arbitrum state:

- `marketplaceAdapter.exchange`: `0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83`
- `marketplaceAdapter.hypercertMinter`: `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07`
- `marketplaceAdapter.authorizedModules(hypercertsModule)`: `true`
- `hypercertsModule.hypercertMinter`: `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07`
- `hypercertsModule.marketplaceAdapter`: `0xE396137ef12c30075fd0B8509C6e389750f36159`
- adapter and module owners match `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`
- exchange transfer manager and strategy `1` match the Arbitrum deployment artifact fields.

Blockscout evidence includes adapter config transaction `0xc7db7c247d4b770d2ebbd32f3fa1dc47dcb82acbebaaff2c148dfb29fb7071e5` at `2026-05-10T20:50:31Z`, from `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6` to `0xE396137ef12c30075fd0B8509C6e389750f36159`, selector `0x1a242988` / `setHypercertMinter(address)`.

## Stale Blocker Reconciliation

Before the operator broadcast, the dry-run prepared these three required owner calls:

```bash
bun run contracts:marketplace:configure:dry:arbitrum
```

1. `HypercertMarketplaceAdapter.setExchange(0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83)`
2. `HypercertMarketplaceAdapter.setHypercertMinter(0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07)`
3. `HypercertsModule.setHypercertMinter(0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07)`

`setAuthorizedModule(hypercertsModule, true)` was not prepared because live state already returns `true`.

Those pending-config mismatches are now resolved by the post-broadcast direct JSON-RPC evidence above, so the contracts lane is no longer a blocker for `state_api`.

## Follow-Up Note: Local Status Script

Do not trust `bun run contracts:marketplace:status:arbitrum` in this local sandbox unless `cast` is proven healthy first. `cast` was observed panicking on macOS proxy lookup, and the status script converted failed reads into zero values, producing false blocked output. This is a named follow-up and did not block `state_api` because direct JSON-RPC proof was sufficient.

## Indexer Policy

The verifier now checks only contracts currently defined in `packages/indexer/config.yaml`. During Arbitrum post-deploy verification it logged skipped deployed contracts without Envio definitions:

- `GardensModule`
- `CookieJarModule`
- `HypercertMarketplaceAdapter`
- `UnifiedPowerRegistry`
- `GreenGoodsENS`

If full deployed-module indexing becomes required, create/link a separate follow-up hub instead of expanding this lane silently.
