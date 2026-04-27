# Signal Pool Yield Wiring - contracts Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `contracts`
**Owner**: `codex`
**Status**: `ready`
**Branch**: `codex/contracts/signal-pool-yield-wiring`

## Current Context

- This is the first implementation lane.
- Target completion for the hub is 2026-05-15.
- Do not mark contracts complete until migration/deploy safety and focused tests are included.

## Required Scope

- `packages/contracts/src/modules/Gardens.sol`
  - Add `yieldResolver`.
  - Add typed `gardenHypercertSignalPools[garden]`.
  - Auto-record and auto-wire the local `hypercertPool` variable after HypercertSignal pool creation.
  - Add migration/emergency setter for typed HypercertSignal pool state.
  - Update `isWiringComplete()` to verify `yieldResolver` is set and `yieldResolver.gardensModule() == address(this)`.
  - Clear typed pool state and best-effort resolver wiring during `resetGardenInitialization()`.
- `packages/contracts/src/resolvers/Yield.sol`
  - Add `gardensModule`.
  - Allow trusted GardensModule auto-wire.
  - Allow operator/owner repair, but validate CVStrategy compatibility and typed HypercertSignal pool match when available.
  - Add garden TBA fallback for Cookie Jar and Juicebox no-config/failure routes.
  - Widen `setGardenTreasury` with operator access and zero-address guard.
- Deploy/migration
  - Update `Upgrade.s.sol` and `upgrade.ts` with a cross-wire step.
  - Extend `migrate-vaults.ts` for typed pool backfill, resolver pool wiring, and treasury defaults.
  - Extend `post-deploy-verify.ts` for bidirectional resolver checks, typed pool/resolver mapping checks, treasury checks, and explicit no-pool operator action output.

## Tests

- `packages/contracts/test/unit/GardensModule.t.sol`
- `packages/contracts/test/unit/YieldSplitter.t.sol`
- `packages/contracts/test/helpers/DeploymentBase.sol`
- Relevant fork/integration tests for live-garden style backfill and end-to-end yield routing.

## Validation

- `cd packages/contracts && bun run test -- --match-contract GardensModule`
- `cd packages/contracts && bun run test -- --match-contract YieldSplitter`
- `cd packages/contracts && bun run test -- --match-path test/UpgradeSafety.t.sol`
- `bun run format:check && bun lint`
