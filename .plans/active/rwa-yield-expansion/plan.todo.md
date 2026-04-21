# RWA Yield Expansion Plan

**Feature Slug**: `rwa-yield-expansion`
**Epic**: [#463](https://github.com/greenpill-dev-guild/green-goods/issues/463)
**Outcome Milestone**: [Outcome: Octant Vault APY >= 5% sustained](https://github.com/greenpill-dev-guild/green-goods/milestone/13) (#13)
**Spec**: [spec.md](./spec.md)
**Status**: `ACTIVE`
**Created**: `2026-04-17`
**Last Updated**: `2026-04-17` (initial plan)
**Hard Deadline**: Contract freeze **2026-05-30**; mainnet deploy **2026-06-30**
**Branch Strategy**: `feature/rwa-yield-expansion` with phase commits for independent rollback

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Approach 1 — policy layer on top of existing `MultistrategyVault` | Smallest surface; Octant audit heritage preserved; `YieldResolver` untouched. |
| 2 | Presets immutable; new ID per version | Historical auditability of debt allocation; vaults opt into new versions explicitly. |
| 3 | Always-async withdrawals with instant buffer | Matches production RWA convention (Superstate, Hashnote, Aera); fits debt-manager pattern. |
| 4 | NAV locked at redemption request, not settlement | User-fair; prevents "withdraw during dip, claim after recovery" games. |
| 5 | On-flow rebalance + Gelato keeper (drift >300bps AND >7d dormant) | Self-correcting for active vaults, backstop for dormant Season One gardens. |
| 6 | Auto-migrate all existing vaults to Conservative v1 in a single atomic tx | Clean end state; operator can switch preset post-migration via 48h timelock. |
| 7 | No rollback valve (stripped during brainstorm) | Audit + multisig = trust mechanism. Simpler state space. |
| 8 | Q2 ships 2 presets: Conservative + Balanced. Aggressive → Q3 | Pendle PT + Centrifuge/Maple add compliance overhead not shippable in Q2. |
| 9 | `RebalancePolicy` is a pure library, not a contract | Gas-efficient; easily fuzz-tested; referenced by vault + keeper. |
| 10 | `RedemptionQueue` is per-vault (not shared) | Isolation: a misbehaving strategy in vault A cannot freeze vault B redemptions. |
| 11 | Hats V2 roles: `PRESET_ADMIN` (publish/deactivate, 72h timelock), `OPERATOR` (assign/switch, 48h timelock), `PAUSER` (instant pause, timelocked unpause) | Reuses existing Hats infra; no new governance system. |
| 12 | External audit bundled with session-key validator from Epic 2 | One audit engagement covers two Q2 epics — cost efficiency. |
| 13 | Mutation test target: 95%+ (stretch 99%) on `RebalancePolicy` | Highest-ROI surface — pure logic, user-fund critical. |

## Requirements Coverage

| Spec Requirement | Planned Phase · Task | Status |
|---|---|---|
| `PresetRegistry` (UUPS) | 1.2 | ⬜ |
| `RebalancePolicy` (library) | 1.1 | ⬜ |
| `RedemptionQueue` (per-vault) | 1.3 | ⬜ |
| `OndoUSDYStrategy` (IOctantStrategy, T+1) | 2.1 | ⬜ |
| `MorphoMetaVaultERC4626` (IOctantStrategy, instant) | 2.2 | ⬜ |
| Hats V2 roles (PRESET_ADMIN / OPERATOR / PAUSER) | 1.2 | ⬜ |
| Invariant tests (6 `INV-*` per spec) | 1.4 | ⬜ |
| Fork tests against real Aave/Morpho/Ondo on Arbitrum | 2.3 | ⬜ |
| Migration script (`bun script/migrate-vaults.ts`) | 3.1 | ⬜ |
| Gelato keeper Web3 Function (rebalance backstop) | 3.2 | ⬜ |
| External audit sign-off | 4.1 | ⬜ |
| Indexer entities (`VaultPreset`, `RedemptionRequest`, `StrategyDebtSnapshot`) | 5.1 | ⬜ |
| Shared hooks (`useVaultPreset`, `usePendingRedemptions`, etc.) | 5.2 | ⬜ |
| Admin UI (Preset Card, Drift Badge, Pending Redemptions, Withdraw branching) | 6.1–6.3 | ⬜ |
| Mainnet deploy + migration tx | 7.1 | ⬜ |
| 30-day APY ≥ 5% measurement window | 7.2 | ⬜ |

## CLAUDE.md Compliance

- ✅ Never uses raw `forge` — all contract commands via `bun build` / `bun run test` / `bun run test:fork` / `bun script/deploy.ts`
- ✅ All React hooks in `@green-goods/shared` (never in client/admin)
- ✅ Barrel imports only (`import { x } from "@green-goods/shared"`)
- ✅ Contract deployments read from `deployments/{chainId}-latest.json`
- ✅ Error handling via `parseContractError()` + `USER_FRIENDLY_ERRORS`; mutations via `createMutationErrorHandler()`
- ✅ Logger from shared (no `console.log`)
- ✅ Query keys via `queryKeys.*` helpers
- ✅ Indexer stays within boundary (vault + yield history — no EAS re-indexing)
- ✅ Intent Priorities: Security is #2 — audit gate is non-negotiable

## Phase 0 — Scaffolding (2026-04-17 → 2026-04-20)

### 0.1 Branch + directory

- [ ] Create branch `feature/rwa-yield-expansion` from `develop`
- [ ] Create `packages/contracts/src/registries/PresetRegistry.sol` (empty + license header)
- [ ] Create `packages/contracts/src/lib/RebalancePolicy.sol` (empty)
- [ ] Create `packages/contracts/src/modules/RedemptionQueue.sol` (empty)
- [ ] Commit scaffolding: `feat(contracts): scaffold RWA yield expansion module dirs`

### 0.2 Dependency check

- [ ] Verify OpenZeppelin UUPS proxy is already a dep (it is — used in `YieldResolver.sol`)
- [ ] Verify Hats Protocol interface is imported (`IHatsModule.sol` exists)
- [ ] Add Ondo USDY interface if needed (check `vendor/` first; may not exist)

## Phase 1 — Core Contracts (2026-04-20 → 2026-05-10)

### 1.1 `RebalancePolicy` library (pure, test-first)

**Files:**
- Create: `packages/contracts/src/lib/RebalancePolicy.sol`
- Create: `packages/contracts/test/RebalancePolicy.t.sol`

- [ ] TDD: write failing test for `computeTargetDebt` with 2-strategy preset, no drift
- [ ] Implement minimum function body
- [ ] Add test: 3-strategy preset with drift on strategy 1 → expect rebalance
- [ ] Add test: buffer target respected across all scenarios
- [ ] Add test: rounding edge case (bps × totalAssets with odd totalAssets)
- [ ] Add fuzz test (10k runs): invariant `sum(targetDebt) + bufferTarget == totalAssets`
- [ ] Run: `cd packages/contracts && bun run test -- --match-contract RebalancePolicyTest -vvv`
- [ ] Commit: `feat(contracts): add RebalancePolicy library with invariant tests`

### 1.2 `PresetRegistry` (UUPS upgradeable)

**Files:**
- Create: `packages/contracts/src/registries/PresetRegistry.sol`
- Create: `packages/contracts/test/PresetRegistry.t.sol`

- [ ] Define `Preset` struct per spec
- [ ] Implement `publishPreset()` — role-gated (`PRESET_ADMIN` Hat), 72h timelock
- [ ] Implement `deactivatePreset()` — role-gated, instant (safety)
- [ ] Implement `setVaultPreset()` — role-gated (`OPERATOR` Hat), 48h timelock for existing vaults, instant for factory calls
- [ ] Implement `getPreset(id)` + `vaultPreset(vault)` view functions
- [ ] UUPS `_authorizeUpgrade` gated by `PRESET_ADMIN`
- [ ] Storage `__gap[50]`
- [ ] Tests: publish, deactivate, reject invalid bps sums, reject unauthorized
- [ ] Run: `cd packages/contracts && bun run test -- --match-contract PresetRegistryTest -vvv`
- [ ] Commit: `feat(contracts): add PresetRegistry with Hats-gated governance`

### 1.3 `RedemptionQueue` (per vault)

**Files:**
- Create: `packages/contracts/src/modules/RedemptionQueue.sol`
- Create: `packages/contracts/test/RedemptionQueue.t.sol`

- [ ] Define `Request` struct (user, shares, navAtRequest, requestedAt, claimed)
- [ ] `request(shares)` — escrow shares, snapshot NAV, emit `RedemptionRequested`
- [ ] `settle(requestId)` — permissionless after `queueDelay`, triggers strategy `freeFunds()`
- [ ] `claim(requestId)` — original requester only, burns escrowed shares, transfers USDC at snapshot NAV
- [ ] `emergencyClaim(requestId)` — vault-paused-≥14d gate, pro-rata only
- [ ] Tests: FIFO ordering, partial fill, NAV snapshot math (±1 wei), reentrancy, pause behavior
- [ ] Run: `bun run test -- --match-contract RedemptionQueueTest`
- [ ] Commit: `feat(contracts): add RedemptionQueue with NAV-at-request semantics`

### 1.4 Invariant tests (cross-contract)

**Files:**
- Create: `packages/contracts/test/invariants/VaultPresetInvariants.t.sol`

- [ ] `invariant_totalAssetsMatchesDebtPlusBuffer` (spec INV-1)
- [ ] `invariant_presetBpsSumToTenThousand` (INV-2)
- [ ] `invariant_queueEscrowCoversOutstanding` (INV-3)
- [ ] `invariant_navMonotonicOrReported` (INV-4)
- [ ] `invariant_userCannotClaimMoreThanRequestNav` (INV-5)
- [ ] `invariant_bufferNeverNegative` (INV-6)
- [ ] 10k runs, 100 depth
- [ ] Commit: `test(contracts): add 6 vault+preset invariants`

## Phase 2 — Strategy Adapters (2026-05-10 → 2026-05-25)

### 2.1 `OndoUSDYStrategy`

**Files:**
- Create: `packages/contracts/src/strategies/OndoUSDYStrategy.sol`
- Create: `packages/contracts/src/interfaces/IOndoUSDY.sol`
- Create: `packages/contracts/test/OndoUSDYStrategy.t.sol`

- [ ] Interface stub for Ondo USDY mint/redeem (reference: Ondo docs + Arbitrum deployment)
- [ ] Implement `IOctantStrategy` — `deployFunds`, `freeFunds`, `totalAssets`, `report`
- [ ] `freeFunds` integrates with `RedemptionQueue` — request burn on Ondo, wait T+1, settle queue
- [ ] Impairment detection: if Ondo issuer paused or APY → 0 for 48h, flag `impaired`
- [ ] Unit tests with mock Ondo issuer
- [ ] Commit: `feat(contracts): add OndoUSDYStrategy for T+1 RWA exposure`

### 2.2 `MorphoMetaVaultERC4626`

**Files:**
- Create: `packages/contracts/src/strategies/MorphoMetaVaultERC4626.sol`
- Create: `packages/contracts/src/interfaces/IMorphoMetaVault.sol`
- Create: `packages/contracts/test/MorphoMetaVaultERC4626.t.sol`

- [ ] Interface for Morpho MetaVault (ERC-4626 compliant)
- [ ] Implement `IOctantStrategy` wrapping Morpho shares
- [ ] Tests: deposit, redeem, APY tracking, reentrancy
- [ ] Commit: `feat(contracts): add MorphoMetaVaultERC4626 strategy`

### 2.3 Fork tests (real Arbitrum state)

**Files:**
- Create: `packages/contracts/test/fork/VaultE2E.fork.t.sol`
- Create: `packages/contracts/test/fork/RedemptionFork.fork.t.sol`
- Create: `packages/contracts/test/fork/KeeperRebalance.fork.t.sol`
- Create: `packages/contracts/test/fork/MigrationFork.fork.t.sol`

- [ ] `VaultE2E.fork`: deposit → rebalance → time-warp → harvest → splitYield → redeem against real Aave V3 Arbitrum
- [ ] `RedemptionFork`: request → Ondo T+1 simulation → claim
- [ ] `KeeperRebalance`: induce drift → keeper triggers rebalance
- [ ] `MigrationFork`: pin to current Arbitrum production block; run migration script; assert 13 vaults at Conservative
- [ ] Run: `cd packages/contracts && bun run test:fork`
- [ ] Commit: `test(contracts): add 4 fork tests for RWA yield expansion`

## Phase 3 — Migration + Keeper (2026-05-20 → 2026-05-29)

### 3.1 Migration script

**Files:**
- Create: `packages/contracts/script/migrate-vaults.ts`

- [ ] Enumerate all existing `MultistrategyVault` deployments from registry
- [ ] For each: pause → addStrategy(Ondo) → setVaultPreset(1) → rebalance → unpause → emit `VaultMigrated`
- [ ] Atomic tx using multicall
- [ ] Dry-run mode default; `--broadcast` for production
- [ ] Test via `MigrationFork.fork.t.sol`
- [ ] Commit: `feat(contracts): add migration script for Conservative auto-migration`

### 3.2 Gelato keeper Web3 Function

**Files:**
- Create: `packages/contracts/keeper/rebalance-watcher.ts` (or new `packages/keeper/` if org pattern)

- [ ] Enumerate vaults from `PresetRegistry`
- [ ] For each: compute drift via `RebalancePolicy`; check last-activity timestamp
- [ ] If drift > 300bps AND dormant >7d → call `vault.rebalance()`
- [ ] Deploy to Gelato; record task ID in deployment artifact
- [ ] Commit: `feat(keeper): add Gelato rebalance watcher Web3 Function`

## Phase 4 — Audit Freeze (2026-05-30 → 2026-06-25)

### 4.1 Contract freeze

- [ ] Tag `v0.5.0-rc1` on `feature/rwa-yield-expansion` at 2026-05-30
- [ ] Internal security review checklist (reentrancy, try/catch, bounded loops, UUPS gap, rounding) — reference spec "Pre-audit self-review"
- [ ] Engage external audit firm (Octant's audit partner — continuity)
- [ ] Create audit remediation branch `audit/rwa-yield-expansion` when findings arrive
- [ ] Merge remediation to `feature/rwa-yield-expansion`; tag `v0.5.0-rc2`
- [ ] Commit: `security(contracts): audit remediation pass N`

## Phase 5 — Indexer + Shared Hooks (starts 2026-05-30, parallel with audit)

### 5.1 Indexer changes

**Files:**
- Modify: `packages/indexer/config.yaml` (add `PresetRegistry` + `RedemptionQueue` contracts)
- Modify: `packages/indexer/schema.graphql` (add `VaultPreset`, `RedemptionRequest`, `StrategyDebtSnapshot`)
- Create: `packages/indexer/src/handlers/presetRegistry.ts`
- Create: `packages/indexer/src/handlers/redemptionQueue.ts`
- Modify: `packages/indexer/src/handlers/multistrategyVault.ts` (augment for new events)

- [ ] Generate types via Envio codegen
- [ ] Implement handlers for all 8 new events (per spec)
- [ ] Local Docker compose test: events appear in GraphQL
- [ ] Commit: `feat(indexer): index PresetRegistry + RedemptionQueue events`

### 5.2 Shared hooks

**Files:**
- Create: `packages/shared/src/hooks/useVaultPreset.ts`
- Create: `packages/shared/src/hooks/usePendingRedemptions.ts`
- Create: `packages/shared/src/hooks/useRequestRedemption.ts`
- Create: `packages/shared/src/hooks/useClaimRedemption.ts`
- Create: `packages/shared/src/modules/presets.ts`
- Modify: `packages/shared/src/index.ts` (barrel)

- [ ] `useVaultPreset(address)` — TanStack Query, reads preset + drift
- [ ] `usePendingRedemptions(vault, user)` — queries indexer for `RedemptionRequest` entities
- [ ] `useRequestRedemption(vault)` — mutation wrapping `RedemptionQueue.request`
- [ ] `useClaimRedemption(vault)` — mutation wrapping `RedemptionQueue.claim`
- [ ] `modules/presets.ts` — display metadata (name, description, icon, risk band, color)
- [ ] Export all from `index.ts`
- [ ] Unit tests via `bun run test` in shared
- [ ] Commit: `feat(shared): add vault preset + redemption hooks`

## Phase 6 — Admin UI (2026-06-10 → 2026-06-25)

### 6.1 New components

**Files:**
- Create: `packages/admin/src/components/Vault/PresetSelectorDialog.tsx`
- Create: `packages/admin/src/components/Vault/PresetDriftBadge.tsx`

- [ ] `PresetSelectorDialog` — Radix dialog, comparison table (Conservative vs Balanced), risk band, target APY
- [ ] `PresetDriftBadge` — pill showing "In target" / "Minor drift X%" / "Needs rebalance"
- [ ] Both i18n'd per `.claude/skills/ui/i18n.md`
- [ ] Storybook stories for each
- [ ] Commit: `feat(admin): add preset selector + drift badge`

### 6.2 Modified vault views

**Files:**
- Modify: `packages/admin/src/views/Garden/Vault.tsx`
- Modify: `packages/admin/src/components/Vault/DepositModal.tsx`
- Modify: `packages/admin/src/components/Vault/WithdrawModal.tsx`

- [ ] `Vault.tsx` — add Preset Card + Pending Redemptions section
- [ ] `DepositModal.tsx` — preset tag + instant/queue expectation copy
- [ ] `WithdrawModal.tsx` — branch UX: if buffer sufficient → instant; else → request redemption with queue delay message
- [ ] Commit: `feat(admin): integrate presets into vault views`

### 6.3 Vault creation flow

- [ ] Add preset dropdown to garden vault creation form
- [ ] Default = Conservative; operator can pick Balanced
- [ ] Commit: `feat(admin): add preset picker to vault creation`

## Phase 7 — Deploy + Measure (2026-06-25 → 2026-06-30)

### 7.1 Mainnet deploy

- [ ] Final fork dry-run of migration on production block
- [ ] Deploy `PresetRegistry` (UUPS) + both strategies + per-vault `RedemptionQueue`s via `bun script/deploy.ts rwa --network arbitrum --broadcast`
- [ ] Publish Conservative v1 + Balanced v1 presets
- [ ] Execute `bun script/migrate-vaults.ts --network arbitrum --broadcast`
- [ ] Verify all vaults at Conservative; pending rebalance count 0 within 24h
- [ ] Update `deployments/42161-latest.json`

### 7.2 Outcome measurement

- [ ] Dashboard panel in admin: 30-day rolling APY per vault
- [ ] Start 30-day measurement window 2026-06-30 → 2026-07-30
- [ ] Weekly check-in: APY trending to ≥5%
- [ ] Close Outcome milestone when criterion hit

## Dependencies / Blockers

- Morpho MetaVault USDC pool on Arbitrum — confirm liquidity ≥ $1M before Balanced ships
- Ondo USDY Arbitrum issuer — confirm KYC for attester-free mint/redeem
- Audit firm engagement — engage by 2026-05-15 (2-week lead)
- Gelato funding — top up shared task pool with ~$100 USDC for Q2 gas

## Risks (carry from spec)

1. Audit slip past 2026-05-30 → start internal review 2026-05-15
2. Ondo downtime during migration → keeper completes within 24h
3. Morpho Arbitrum liquidity insufficient for Balanced → Conservative is fallback
4. ERC-4626 rounding edge in Ondo adapter → fork tests against live issuer
