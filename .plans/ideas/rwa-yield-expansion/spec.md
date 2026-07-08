---
title: RWA Yield Expansion — Design
epic: Epic — RWA Yield Expansion
outcome: Octant Vault APY ≥ 5% sustained 30 days
quarter: Q2 2026
due: 2026-06-30
status: Draft
owner: afo
last_updated: 2026-04-17
---

# RWA Yield Expansion — Design

## Goal

Lift the Octant Vault yield from ~1% (pure Aave V3 USDC) to **≥5% sustained 30 days** by introducing a diversified yield engine across RWA and high-quality DeFi strategies, exposed to operators as curated presets.

## Decisions (locked during brainstorm)

| # | Decision | Value |
|---|---|---|
| 1 | Scope | Diversified yield engine (RWA + DeFi) |
| 2 | Allocation authority | Protocol presets with operator opt-in |
| 3 | Liquidity model | Always-async with instant buffer |
| 4 | Q2 preset scope | Conservative + Balanced only (Aggressive → Q3) |
| 5 | Rebalance mechanism | On-flow primary + Gelato keeper safety net |
| 6 | Existing vault migration | Auto-migrate to Conservative on upgrade (single atomic tx) |
| 7 | Preset mutability | Immutable; new ID per version |
| 8 | Preset switch timelock | 48 hours (operator-initiated) |
| 9 | Governance | Hats V2 roles (`PRESET_ADMIN`, `OPERATOR`, `PAUSER`) |
| 10 | Emergency withdraw | After 14 days of vault pause |
| 11 | Audit gate | External audit before mainnet, 2026-05-30 contract freeze |
| 12 | Mutation test target | 95%+ on `RebalancePolicy` (stretch 99%) |

## Architecture

```
┌─ packages/contracts ────────────────────────────────────────────────┐
│                                                                     │
│     ┌──────────────────┐                                            │
│     │ PresetRegistry   │  NEW · UUPS · owner = PRESET_ADMIN Hat     │
│     │  Conservative v1 │  Stores: strategy set, target bps,         │
│     │  Balanced v1     │  buffer %, queue params per preset         │
│     └────────┬─────────┘                                            │
│              │ presetOf(vault)                                      │
│              ▼                                                      │
│     ┌──────────────────────────────────────┐                        │
│     │  MultistrategyVault  (per garden)    │  EXISTING (Octant)     │
│     │  ERC-4626 · debt-manager semantics   │  UNTOUCHED             │
│     └─┬──────────────┬───────────────┬─────┘                        │
│       │ strategies[] │               │ redemption hook              │
│       ▼              ▼               ▼                              │
│  ┌─────────┐   ┌──────────┐   ┌──────────────────┐                  │
│  │ AaveV3  │   │ MorphoMV │   │ RedemptionQueue  │  NEW             │
│  │ (exists)│   │ (new Q2) │   │ per-vault, FIFO, │                  │
│  └─────────┘   └──────────┘   │ NAV @ request    │                  │
│  ┌─────────┐                  │ settle on claim  │                  │
│  │ OndoUSDY│                  └──────────────────┘                  │
│  │ (new Q2)│                                                        │
│  └─────────┘                                                        │
│                                                                     │
│  RebalancePolicy (library) · pure fn (preset, totalAssets, debt[])  │
│                                                                     │
│  YieldResolver · EXISTING · UNTOUCHED in Q2                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## New Contracts

### `PresetRegistry` (UUPS upgradeable)

```solidity
struct Preset {
    string name;
    uint256 version;
    address[] strategies;
    uint16[] targetBps;       // sum + bufferBps == 10_000
    uint16 bufferBps;
    uint32 queueDelay;        // seconds
    bool active;
}

mapping(uint256 => Preset) public presets;
mapping(address => uint256) public vaultPreset;
```

Presets immutable once published; version bumps require new ID. Vault preset assignments go through 48h timelock (operator) or 72h timelock (governance for publish).

### `RebalancePolicy` (stateless library)

```solidity
function computeTargetDebt(
    Preset memory preset,
    uint256 totalAssets,
    uint256[] memory currentDebt
) external pure returns (uint256[] memory targetDebt, uint256 bufferTarget);
```

Pure math. Called by vault on deposit/withdraw and by keeper on schedule.

### `RedemptionQueue` (per vault)

```solidity
struct Request {
    address user;
    uint256 shares;
    uint256 navAtRequest;    // locked at request time
    uint40 requestedAt;
    bool claimed;
}

function request(uint256 shares) external returns (uint256 requestId);
function settle(uint256 requestId) external;        // permissionless after queueDelay
function claim(uint256 requestId) external;         // only original requester
function emergencyClaim(uint256 requestId) external; // vault paused >14d
```

FIFO. NAV locked at request; user receives `shares × navAtRequest` on claim. Strategy yield during queue wait accrues to remaining holders.

### Strategy adapters

- `MorphoMetaVaultERC4626` (Q2) — wraps Morpho MetaVault, instant liquidity
- `OndoUSDYStrategy` (Q2) — handles T+1 redemption via queue; implements `IOctantStrategy`
- `AaveV3ERC4626` (existing) — unchanged

## Q2 Preset Values

**Conservative v1** (presetId = 1, default for migrated vaults)

| Strategy | targetBps | Notes |
|---|---|---|
| `AaveV3ERC4626` | 6500 | 65%, instant |
| `OndoUSDYStrategy` | 2000 | 20%, T+1 |
| *buffer* | 1500 | 15% idle USDC |

**Balanced v1** (presetId = 2, operator opt-in)

| Strategy | targetBps | Notes |
|---|---|---|
| `MorphoMetaVaultERC4626` | 4500 | 45%, instant |
| `OndoUSDYStrategy` | 2500 | 25%, T+1 |
| `AaveV3ERC4626` | 1500 | 15%, instant |
| *buffer* | 1500 | 15% idle USDC |

## Key Data Flows

**Deposit**: `deposit()` → route `amount` to widest-negative-drift strategy + top up buffer → mint shares.

**Withdraw (buffer path)**: if `buffer ≥ shares × NAV` → instant transfer + burn.

**Withdraw (queue path)**: escrow shares in queue at request NAV → strategy-side redemption triggered → after `queueDelay`, anyone calls `settle()` → user calls `claim()`.

**Rebalance (on-flow)**: every deposit/withdraw calls `_maybeRebalance()`; if drift per strategy < 100bps, noop.

**Rebalance (keeper)**: Gelato task every 4h; rebalances when drift > 300bps AND no activity ≥ 7 days.

**Yield accrual**: strategies appreciate; `harvest()` rolls into `totalAssets()`; existing `YieldResolver.splitYield()` handles 3-way split unchanged.

## Invariants

```
INV-1: sum(strategy.totalAssets()) + vault.idleUSDC() == vault.totalAssets()
INV-2: sum(preset.targetBps) + preset.bufferBps == 10_000
INV-3: queue.escrowedShares >= sum(pending requests' shares)
INV-4: sharePrice decreases only via reported strategy loss (harvest)
INV-5: user.claimAmount == request.shares * request.navAtRequest ± 1 wei
INV-6: idleUSDC >= 0 after any operation
```

Enforced via Forge `invariant_*` tests with 10k runs pre-merge.

## Migration Plan (one atomic transaction)

1. Deploy `PresetRegistry` + strategy adapters + per-vault `RedemptionQueue`s
2. Publish Conservative v1 + Balanced v1
3. External audit sign-off (by 2026-05-30)
4. Announce 7 days ahead (Discord + email)
5. **Single tx batching all Season One vaults:**
   - `vault.pause()` → `vault.addStrategy(Ondo)` → `registry.setVaultPreset(vault, 1)` → `vault.rebalance()` → `vault.unpause()`
6. Emit `VaultMigrated(vault, presetId=1)` per vault
7. Post-migration: keeper completes any residual rebalance within 24h (Ondo T+1 cycle)

**No rollback valve** — migration is forward-only; operator can switch preset post-migration via 48h timelock.

**No data migration** — user balances untouched; only allocation policy changes.

## Safety Mechanisms

| Mechanism | Role | Trigger | Effect |
|---|---|---|---|
| Strategy impairment | Auto + `PAUSER` | `freeFunds` reverts or APY=0 for 48h | Route around; existing debt redeemable |
| Vault pause | `PAUSER` | Multisig | Blocks new deposits + requests |
| Emergency withdraw | User | Vault paused ≥ 14 days | Pro-rata claim of buffer + liquid strategies |
| Preset deactivation | `PRESET_ADMIN` | Governance | Blocks new assignments; existing vaults continue |

## Governance (Hats V2 roles)

| Action | Role | Timelock |
|---|---|---|
| Publish new preset | `PRESET_ADMIN` | 72h |
| Deactivate preset | `PRESET_ADMIN` | None (safety) |
| Assign preset at vault creation | `OPERATOR` (garden-scoped) | None |
| Switch existing vault preset | `OPERATOR` | 48h |
| Emergency pause | `PAUSER` | None |
| Unpause | `PAUSER` | 72h timelock |

## Testing Strategy

| Layer | Runner | Command |
|---|---|---|
| Unit + integration | Forge via `bun run test` | `cd packages/contracts && bun run test` |
| Fork (Arbitrum) | Forge fork mode | `cd packages/contracts && bun run test:fork` |
| Invariant (10k runs) | Forge invariant mode | Part of default suite |
| Migration dry-run | Fork against production state | `MigrationFork.fork.t.sol` |
| Mutation | `RebalancePolicy` ≥ 95% (stretch 99%) | Manual per-release |

**Pre-audit self-review:** reentrancy guards, `try/catch` on strategy calls, bounded loops (≤8 strategies per preset), no `delegatecall` to strategies, rounding toward vault, events for all state transitions, UUPS `__gap` on upgradeable contracts.

## Indexer (Envio) Changes

**New events handled:**
- `PresetRegistry`: `PresetPublished`, `PresetDeactivated`, `VaultPresetSet`
- `MultistrategyVault` (augment): `StrategyAdded`, `StrategyImpaired`, `VaultMigrated`
- `RedemptionQueue`: `RedemptionRequested`, `RedemptionSettlable`, `RedemptionClaimed`

**New entities (`schema.graphql`):**
- `VaultPreset` (current preset + history edge)
- `RedemptionRequest` (state: Pending | Settlable | Claimed)
- `StrategyDebtSnapshot` (per-block, per-vault debt deltas)

Stays within CLAUDE.md indexer boundary (vault + yield history).

## Admin UI Changes (`packages/admin`)

| Component | Change |
|---|---|
| `views/Garden/Vault.tsx` | Add Preset Card (name, allocation, drift) + Pending Redemptions section |
| `components/Vault/DepositModal.tsx` | Show preset tag + instant/queue expectation |
| `components/Vault/WithdrawModal.tsx` | Branch UX: instant vs queued redemption |
| `components/Vault/PresetSelectorDialog.tsx` (NEW) | Preset comparison for creation + switching |
| `components/Vault/PresetDriftBadge.tsx` (NEW) | In-target / drift indicator |

All copy i18n'd per `.claude/skills/ui/i18n.md`.

## Shared (`packages/shared`) — new hooks

```
hooks/useVaultPreset(vaultAddress)
hooks/usePendingRedemptions(vault, user)
hooks/useRequestRedemption(vault)
hooks/useClaimRedemption(vault)
modules/presets.ts    // display metadata
```

Use existing `queryKeys.*` + `createMutationErrorHandler` patterns.

## Out of Q2 Scope

- Aggressive preset (Pendle PT + Centrifuge/Maple) → Q3
- Custom per-garden allocations → Q3+
- Auto-switching based on market signals → **never** (explicit operator decision)
- Cross-chain vault → stays Arbitrum-only per `VITE_CHAIN_ID`
- `YieldResolver` changes → unchanged in Q2
- Rollback-to-legacy safety valve → stripped (audit + multisig = trust mechanism)
- Client-side direct deposits to vault → client stays read-only
- Gelato funding UX → ops handles via quarterly top-up

## Timeline

| Date | Gate |
|---|---|
| 2026-04-17 | Design locked (this doc) |
| 2026-05-30 | Contract freeze → external audit starts |
| 2026-06-20 | Audit remediation complete |
| 2026-06-27 | Migration dry-run on fork |
| 2026-06-30 | Mainnet deploy + migration tx |
| 2026-06-30 → 2026-07-30 | Outcome measurement window (30-day APY ≥ 5%) |

## Risks

1. **Audit slip** — 2026-05-30 freeze is tight. Mitigation: start internal review 2026-05-15.
2. **Ondo USDY issuer downtime during migration** — mitigation: keeper settles residual rebalance over 24h, not atomic.
3. **Morpho MetaVault on Arbitrum liquidity insufficient for Balanced allocation** — mitigation: Balanced is opt-in; Conservative (no Morpho) is the fallback.
4. **Unexpected ERC-4626 rounding edge in Ondo adapter** — mitigation: fork tests against live issuer.
