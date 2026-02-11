> **SUPERSEDED** — This plan has been superseded by [`octant-vaults-final-plan.md`](./octant-vaults-final-plan.md) (v2.0). Key differences:
>
> | This Plan | Final Plan |
> |-----------|-----------|
> | GardenVaultManager as permissioned router | OctantModule as registry + admin layer only |
> | Operator-only deposits via GardenVaultManager | Open access — anyone calls `vault.deposit()` directly |
> | USDC + WETH launch assets | WETH + DAI launch assets |
> | GardenAccount TBA as vault roleManager | OctantModule as vault roleManager |
> | Deposit model: pull tokens → forward to vault | Direct ERC-4626 vault interaction (no intermediary) |
> | Conviction-based yield routing (Phase 1) | Donation address yield routing (Phase 1) |
>
> Refer to the Final Plan for all current architecture decisions.

# Octant V2 Vault Integration — Implementation Plan (ARCHIVED)

## Context

Green Goods gardens need yield-generating vaults to fund environmental impact. Each garden's ERC-6551 TBA (GardenAccount) will own a vault deployed via the Octant V2 MultiStrategyVaultFactory on Arbitrum. Yield from Aave V3/Yearn V3 strategies is routed to a configurable donation address (Phase 1), with conviction-based Hypercert purchasing coming in a future phase.

The existing specs (GG-FEAT-006, GG-TECH-006) are cross-chain-first. They need restructuring to reflect the confirmed Arbitrum-native approach. The codebase already has `OctantModule.sol` (vault creation) and `IOctantFactory.sol` (factory interface) as foundations.

**Confirmed Decisions:**
- Deploy Octant V2 factory on Arbitrum (not just wrap Aave directly)
- Phase 1 yield routing = donation address configured on Octant vault's native fee recipient (no IYieldRouter abstraction — YAGNI)
- Restructure specs: Arbitrum-native primary, cross-chain in appendix
- UI: Admin Dashboard (full CRUD) + Client PWA (read-only positions/yield)
- Use existing Hats v2 roles (Operator/Owner) for vault operations — no new Hats role needed
- Hats v2 `_requireOwnerOrOperator()` fix is an independent track — vault work does NOT depend on it
- Future conviction voting upgrade replaces `donationAddress` with a ConvictionYieldRouter — but don't build that abstraction now
- Deposit flow: GardenVaultManager as permissioned router — pulls tokens from operator, deposits to vault, shares to operator (no TBA custody)
- Strategy management: Global protocol admin curates a whitelist of vetted strategies; gardens choose from it
- Vault creation: During garden creation — every garden gets a vault immediately via OctantModule
- Launch assets: USDC + WETH on Arbitrum (two initial strategies)
- Harvest trigger: Manual by operator via admin dashboard (automated keeper can be added later)
- Emergency withdraw: Per-strategy (not all-at-once), Owner only
- Protocol fee: None for Phase 1 (100% of yield to donation address; fee can be added via upgrade)
- No TBA permission grant needed (direct deposit model bypasses TBA entirely for asset flow)
- **Deposit model (YDS):** Operator deposits directly to the garden's vault via GardenVaultManager. Shares minted to operator. Operator can withdraw principal anytime. Only yield is donated.
- GardenAccount TBA holds NO assets — purely for metadata and role management
- GardenVaultManager is a permissioned router: validates Hats role → pulls tokens from operator → deposits to vault → shares to operator
- No TBA execute permission, no `setPermissions()`, no `executeBatch()` needed
- Legacy gardens: Only new gardens get vaults (no migration script for existing gardens)
- Testnet: Sepolia (current testnet); Aave V3 fork tests run against Arbitrum RPC separately
- Branch: New `feature/octant-vaults` off `feature/hats-protocol-v2`
- Strategy deactivation: Block new deposits only; withdrawals and harvests still allowed for existing positions
- Donation address: Per-garden, configured on the Octant vault itself (native fee recipient). GardenVaultManager reads it for UI display.
- Execution order: Phase 0 (specs) first, then Phase 1 (contracts)

**Hats v2 Integration (current state on `feature/hats-protocol-v2`):**
- 6 roles: Gardener, Evaluator, Operator, Owner, Funder, Community
- GardenAccount delegates all role checks to HatsModule via `IGardenAccessControl`
- Inclusive hierarchy: Owner → Operator → Evaluator → Gardener (each higher role implies lower)
- `isOperator(account)` returns true for both Operators and Owners (see [Garden.sol:221-223](packages/contracts/src/accounts/Garden.sol#L221-L223))
- GardenVaultManager calls `IGardenAccessControl(garden).isOperator(msg.sender)` for deposit/withdraw/harvest
- GardenVaultManager calls `IGardenAccessControl(garden).isOwner(msg.sender)` for emergency/config
- No changes needed to HatsModule or GardenAccount for vault integration

**Future Conviction Voting Path (not in scope):**
- Phase 2 will replace `donationAddress` with a yield router contract
- Gardens V2 CVStrategy (Diamond Proxy, EIP-2535) provides conviction state via view calls
- HypercertYieldAllocator reads conviction → calculates proportional allocation → purchases Hypercert fractions
- When ready: add `setYieldRouter(address garden, address router)` to GardenVaultManager, deprecate `donationAddress`

---

## Phase 0: Spec Restructuring

Rewrite both specs to lead with Arbitrum-native architecture.

**Feature Spec (`docs/docs/specs/octant/octant-feature-spec.md`):**
- Promote Section 12 (Arbitrum-Native) to primary architecture (Sections 1-6)
- Move cross-chain content (Sections 1-11) to a new appendix file
- Simplify yield routing: donation address, not conviction voting
- Add Client PWA read-only scope to the integration matrix
- Update sequence diagrams (no CCIP, no StateOracle, no HatsMirror)
- Fix data model: remove CrossChainMessage, simplify VaultPosition

**Tech Spec (`docs/docs/specs/octant/octant-tech-spec.md`):**
- Reconcile OctantModule (vault creation) + GardenVaultManager (operations) — they coexist
- Remove CCIP-related contracts from Phase 1 scope
- Expand IOctantVault with full ERC-4626 view functions
- Add direct deposit flow (operator → GardenVaultManager → vault, no TBA custody)
- Update Envio schema to match simplified entities
- Fix Zustand store: use TanStack Query for server state (per project patterns)

**New file:** `docs/docs/specs/octant/octant-cross-chain-appendix.md` — archived cross-chain architecture for Phase 2

### Files
| Action | File |
|--------|------|
| Modify | `docs/docs/specs/octant/octant-feature-spec.md` |
| Modify | `docs/docs/specs/octant/octant-tech-spec.md` |
| Create | `docs/docs/specs/octant/octant-cross-chain-appendix.md` |

---

## Phase 1: Contract Foundation — GardenVaultManager

### Architecture Decision: OctantModule + GardenVaultManager

**OctantModule** (existing) — handles vault *creation* (already works, maps garden→vault).
**GardenVaultManager** (new) — handles vault *operations* (deposit, withdraw, harvest, emergency).

They coexist: GardenVaultManager reads `octantModule.getVault(garden)` to find the vault.

### Architecture Decision: Direct Deposit (No TBA Custody)

The GardenAccount TBA holds NO assets — it's purely for metadata and Hats role management. Deposits flow directly from operators to the vault via GardenVaultManager as a permissioned router.

**Deposit flow:**
1. Operator approves GardenVaultManager to spend their USDC/WETH
2. Operator calls `GardenVaultManager.deposit(garden, strategy, amount)`
3. GardenVaultManager: validates Hats role → `transferFrom(operator, self, amount)` → `approve(vault, amount)` → `vault.deposit(amount, operator)`
4. Vault receives tokens, mints shares to operator's address

**Withdraw flow:**
1. Operator calls `vault.redeem(shares, operator, operator)` directly — they own the shares
2. OR: Operator calls `GardenVaultManager.withdraw(garden, strategy, shares)` for role-gated withdrawal

**Yield flow (YDS pattern):**
1. Anyone calls `GardenVaultManager.harvest(garden, strategy)` → calls `strategy.report()`
2. On report: profit is minted as NEW shares to the garden's `donationAddress`
3. Depositors' PPS stays flat — they can always withdraw their full principal
4. Only yield is donated — depositors never lose principal

### Architecture Decision: Strategy Registration

**Confirmed: Global protocol admin curates whitelisted strategies**
- `registerStrategy()` / `deactivateStrategy()` restricted to protocol owner (not garden owner)
- Gardens choose from the global whitelist when depositing
- Reduces risk surface vs per-garden strategy management

### Architecture Decision: Vault Creation Timing

**Confirmed: Vault created during garden creation**
- GardenToken.mint() → GardenAccount.initialize() → OctantModule.createVaultForGarden()
- Every garden gets a vault immediately (no lazy creation)
- Requires extending garden creation flow to include OctantModule call

### 1A: Extend IOctantVault Interface

Add missing ERC-4626 view functions to the existing interface.

**Modify:** `packages/contracts/src/interfaces/IOctantFactory.sol`

Add to `IOctantVault`: `convertToAssets`, `convertToShares`, `previewDeposit`, `previewWithdraw`, `maxDeposit`, `maxWithdraw`, `balanceOf`, `totalSupply`, `redeem`

### 1B: Create IGardenVaultManager Interface

**Create:** `packages/contracts/src/interfaces/IGardenVaultManager.sol`

Key functions:
- `registerStrategy(address strategy, string name)` — **Protocol admin only** (contract owner)
- `deactivateStrategy(address strategy)` — **Protocol admin only** (contract owner)
- `deposit(address garden, address strategy, uint256 amount) → uint256 shares` — Garden Operator/Owner; pulls tokens from msg.sender, deposits to vault, shares minted to msg.sender
- `withdraw(address garden, address strategy, uint256 shares) → uint256 assets` — Garden Operator/Owner; optional convenience (operators can also call vault.redeem() directly)
- `harvest(address garden, address strategy) → uint256 yieldAmount` — Garden Operator/Owner; triggers strategy.report(), yield shares go to donationAddress
- `emergencyWithdraw(address garden, address strategy) → uint256 assets` — **Garden Owner only**
- `setDonationAddress(address garden, address donationAddress)` — Garden Operator/Owner
- `getStrategies() → address[]` — view (returns global whitelist)

Events: `StrategyRegistered`, `StrategyDeactivated`, `Deposited`, `Withdrawn`, `YieldHarvested`, `EmergencyWithdrawn`, `DonationAddressUpdated`

**Launch strategies:** AaveV3YDSStrategy for USDC, AaveV3YDSStrategy for WETH (same contract, different asset config)

### 1C: Implement GardenVaultManager

**Create:** `packages/contracts/src/modules/GardenVaultManager.sol`

- UUPS upgradeable (matches OctantModule, HatsModule pattern)
- **Permissioned router model:** validates Hats roles, pulls tokens from depositor, forwards to vault
- References OctantModule for vault lookups (`octantModule.getVault(garden)`)
- References `IGardenAccessControl` on GardenAccount for Hats v2 role checks
- Strategy registry: `mapping(address ⇒ StrategyInfo)` with name, asset, active flag
- Donation address is set on the Octant vault itself (native fee recipient), NOT stored in GardenVaultManager. GardenVaultManager provides a convenience `setDonationAddress()` that calls through to the vault.
- Storage gap: `uint256[40] private __gap`

**Key functions:**
```solidity
function deposit(address garden, address strategy, uint256 amount) external
    onlyGardenOperatorOrOwner(garden)
{
    // 1. Pull tokens from msg.sender
    IERC20(asset).transferFrom(msg.sender, address(this), amount);
    // 2. Approve vault
    IERC20(asset).approve(vault, amount);
    // 3. Deposit to vault, shares go to msg.sender (the operator)
    uint256 shares = IOctantVault(vault).deposit(amount, msg.sender);
    emit Deposited(garden, strategy, msg.sender, amount, shares);
}

function harvest(address garden, address strategy) external
    onlyGardenOperatorOrOwner(garden)
{
    // Triggers strategy.report() — YDS pattern mints yield shares to donationAddress
    // ...
}
```

Access control — reuses existing `IGardenAccessControl` (already Hats v2-backed):
```solidity
modifier onlyGardenOperatorOrOwner(address garden) {
    if (!IGardenAccessControl(garden).isOperator(msg.sender))
        revert UnauthorizedCaller(msg.sender);
    _;
}

modifier onlyGardenOwner(address garden) {
    if (!IGardenAccessControl(garden).isOwner(msg.sender))
        revert UnauthorizedCaller(msg.sender);
    _;
}
```

**Why this works without Hats changes:** GardenAccount.isOperator() already calls `_isOperatorOrOwner()` which checks both `hatsModule.isOperatorOf()` and `hatsModule.isOwnerOf()`. GardenVaultManager just calls the existing interface.

**Note on withdrawals:** Operators own their vault shares directly. They can call `vault.redeem()` directly to withdraw principal. GardenVaultManager.withdraw() is optional convenience for role-gated withdrawal with events.

### 1D: Extend OctantModule + Garden Creation Flow

**Modify:** `packages/contracts/src/modules/Octant.sol`
- Add `gardenVaultManager` storage + setter
- Extend `onlyRouter` to also accept GardenVaultManager as caller

**Modify:** `packages/contracts/src/tokens/Garden.sol` (GardenToken.mint flow)
- In `_initializeGardenModules()`, after existing Hats + KarmaGAP + initialize calls:
  1. Call `octantModule.createVaultForGarden(gardenAccount)` — creates Octant vault for this garden
- Requires adding `octantModule` address as storage on GardenToken + `setOctantModule()` setter
- No TBA permission changes needed — GardenVaultManager doesn't need execute permission on the TBA

### 1E: Tests

**Create:** `packages/contracts/test/unit/GardenVaultManager.t.sol`
- Strategy registration/deactivation (protocol admin only, garden owner reverts)
- Deposit authorization (Operator passes, Gardener reverts)
- Withdraw authorization (Operator passes, Gardener reverts)
- Harvest sends 100% of yield to donation address (no fee)
- Per-strategy emergency withdraw (Garden Owner only, Operator reverts)
- Zero amount reverts, unregistered strategy reverts, deactivated strategy reverts
- Unregistered garden reverts (no vault)

**Create:** `packages/contracts/test/integration/GardenVaultIntegration.t.sol`
- Full flow: create garden (vault auto-created) → operator deposits USDC → harvest → operator withdraws principal
- Multi-strategy: operator deposits USDC + deposits WETH → harvest each → verify independent share ownership
- YDS yield flow: deposit → simulate yield → harvest → verify yield shares go to donationAddress, operator PPS unchanged
- Multi-operator: two operators deposit → each can withdraw only their own shares

### Files
| Action | File |
|--------|------|
| Modify | `packages/contracts/src/interfaces/IOctantFactory.sol` |
| Create | `packages/contracts/src/interfaces/IGardenVaultManager.sol` |
| Create | `packages/contracts/src/modules/GardenVaultManager.sol` |
| Modify | `packages/contracts/src/modules/Octant.sol` |
| Modify | `packages/contracts/src/tokens/Garden.sol` |
| Create | `packages/contracts/test/unit/GardenVaultManager.t.sol` |
| Create | `packages/contracts/test/integration/GardenVaultIntegration.t.sol` |

---

## Phase 2: Strategy Development — AaveV3YDSStrategy

### Architecture: Octant YDS Pattern on Arbitrum

Each strategy is an ERC-4626 vault inheriting Octant's `TokenizedStrategy` base. On `report()`, profit is minted as shares to the donation address (PPS stays flat for depositors).

### 2A: AaveV3YDSStrategy

**Create:** `packages/contracts/src/strategies/AaveV3YDSStrategy.sol`

- Extends Octant's TokenizedStrategy/BaseStrategy pattern
- `_deployFunds(uint256)`: deposits to Aave V3 Pool (0x794a...aD) on Arbitrum
- `_freeFunds(uint256)`: withdraws from Aave V3 Pool
- `_harvestAndReport()`: calculates profit from aToken balance delta
- Configurable: asset address + Aave pool address (same contract deployed twice)
- **USDC instance**: Uses waUSDC wrapper (0xDAF2...) for ERC-4626 compatibility
- **WETH instance**: Uses waWETH wrapper for ERC-4626 compatibility
- Two deployments of the same contract, parameterized by asset

### 2B: Mock Strategy for Testing

**Create:** `packages/contracts/src/mocks/MockYDSStrategy.sol`

Simulates yield injection for unit tests without Aave fork.

### 2C: Tests

**Create:** `packages/contracts/test/unit/AaveV3YDSStrategy.t.sol` — unit tests with mock Aave
**Create:** `packages/contracts/test/fork/ArbitrumAaveStrategy.t.sol` — fork test against real Aave V3 on Arbitrum

### Files
| Action | File |
|--------|------|
| Create | `packages/contracts/src/strategies/AaveV3YDSStrategy.sol` |
| Create | `packages/contracts/src/mocks/MockYDSStrategy.sol` |
| Create | `packages/contracts/test/unit/AaveV3YDSStrategy.t.sol` |
| Create | `packages/contracts/test/fork/ArbitrumAaveStrategy.t.sol` |

---

## Phase 3: Indexer Integration

### 3A: Schema — New Entities

**Modify:** Envio schema (via `config.yaml` and handler files)

New entities:
- **VaultPosition** — garden, strategy, **operator**, shares, totalDeposited, totalWithdrawn, timestamps (per-operator per-strategy)
- **GardenVaultSummary** — garden, totalDeposited, totalYieldDonated, donationAddress (aggregated per garden)
- **YDSStrategy** — address, name, asset, active, totalDeposited
- **VaultEvent** — garden, strategy, operator, eventType (DEPOSIT/WITHDRAW/HARVEST/EMERGENCY), amount, shares, txHash, timestamp

### 3B: Config — Add GardenVaultManager Contract

**Modify:** `packages/indexer/config.yaml.backup`

Add GardenVaultManager events: StrategyRegistered, StrategyDeactivated, Deposited, Withdrawn, YieldHarvested, EmergencyWithdrawn, DonationAddressUpdated

### 3C: Event Handlers

**Modify:** `packages/indexer/src/EventHandlers.ts`

Follow existing patterns (RoleGranted/RoleRevoked handlers as reference). Create/update VaultPosition, YDSStrategy, VaultEvent entities per event.

### Files
| Action | File |
|--------|------|
| Modify | `packages/indexer/config.yaml.backup` |
| Modify | `packages/indexer/src/EventHandlers.ts` |
| Modify | `packages/indexer/test/test.ts` |

---

## Phase 4: Shared Package — Types, Hooks, ABIs

### 4A: Types

**Modify:** `packages/shared/src/types/domain.ts` — add VaultPosition, YDSStrategy, VaultEvent, DepositParams, WithdrawParams
**Modify:** `packages/shared/src/types/contracts.ts` — add gardenVaultManager, octantModule to NetworkContracts

### 4B: ABIs + Contract Resolution

**Modify:** `packages/shared/src/utils/blockchain/abis.ts` — add GARDEN_VAULT_MANAGER_ABI
**Modify:** `packages/shared/src/utils/blockchain/contracts.ts` — add gardenVaultManager to getNetworkContracts()

### 4C: Query Keys

**Modify:** `packages/shared/src/hooks/query-keys.ts` — add vault.positions, vault.strategies, vault.events, vault.totalDeposited keys + invalidation helpers

### 4D: Hooks

All hooks use TanStack Query for server state (GraphQL fetching), following the existing `useGardens`/`useWorks` pattern.

**Create:** `packages/shared/src/hooks/vault/useVaultPositions.ts` — fetch VaultPosition entities for a garden
**Create:** `packages/shared/src/hooks/vault/useVaultStrategies.ts` — fetch active YDSStrategy entities
**Create:** `packages/shared/src/hooks/vault/useVaultOperations.ts` — deposit, withdraw, harvest, emergencyWithdraw, setDonationAddress (follows `createGardenOperation` pattern for tx simulation, toast UX, optimistic updates)
**Create:** `packages/shared/src/hooks/vault/useVaultEvents.ts` — fetch VaultEvent history

### 4E: Barrel Exports

**Modify:** `packages/shared/src/hooks/index.ts` — export vault hooks
**Modify:** `packages/shared/src/index.ts` — export vault types

### 4F: Tests

**Create:** `packages/shared/src/__tests__/hooks/useVaultOperations.test.ts`

### Files
| Action | File |
|--------|------|
| Modify | `packages/shared/src/types/domain.ts` |
| Modify | `packages/shared/src/types/contracts.ts` |
| Modify | `packages/shared/src/utils/blockchain/abis.ts` |
| Modify | `packages/shared/src/utils/blockchain/contracts.ts` |
| Modify | `packages/shared/src/hooks/query-keys.ts` |
| Create | `packages/shared/src/hooks/vault/useVaultPositions.ts` |
| Create | `packages/shared/src/hooks/vault/useVaultStrategies.ts` |
| Create | `packages/shared/src/hooks/vault/useVaultOperations.ts` |
| Create | `packages/shared/src/hooks/vault/useVaultEvents.ts` |
| Modify | `packages/shared/src/hooks/index.ts` |
| Modify | `packages/shared/src/index.ts` |
| Create | `packages/shared/src/__tests__/hooks/useVaultOperations.test.ts` |

---

## Phase 5: Admin Dashboard — Vault Management UI

### 5A: Vault Section in Garden Detail

**Modify:** `packages/admin/src/views/Gardens/Garden/Detail.tsx`

Add a Vault section showing: total deposited across strategies, total yield donated, donation address, link to vault dashboard. Gate with `useGardenPermissions()` (canManage for deposit/harvest actions, read-only otherwise). No "treasury balance" — garden account holds no assets.

### 5B: VaultDashboard Component

**Create:** `packages/admin/src/components/Vault/VaultDashboard.tsx`

Top-level vault management: position cards per strategy, total balance summary, Deposit/Withdraw action buttons.

### 5C: PositionCard

**Create:** `packages/admin/src/components/Vault/PositionCard.tsx`

Card per strategy: name + asset, shares + equivalent value, total deposited/withdrawn/harvested, action buttons (Withdraw, Harvest).

### 5D: DepositModal

**Create:** `packages/admin/src/components/Vault/DepositModal.tsx`

Radix UI Dialog with: strategy selector, amount input (max = operator's wallet balance), preview (shares via previewDeposit), 2-step flow (approve GardenVaultManager + deposit), transaction status tracking. Deposits come directly from operator's wallet — no garden treasury step.

### 5E: WithdrawModal

**Create:** `packages/admin/src/components/Vault/WithdrawModal.tsx`

Similar to deposit but for withdrawals. Strategy selector (only those with positions), amount/shares input, preview.

### 5F: DonationAddressConfig

**Create:** `packages/admin/src/components/Vault/DonationAddressConfig.tsx`

Address display + edit (Operator/Owner only). Calls `setDonationAddress()`.

### 5G: VaultEventHistory

**Create:** `packages/admin/src/components/Vault/VaultEventHistory.tsx`

Table of recent vault events: type, amount, timestamp, tx link.

### Files
| Action | File |
|--------|------|
| Modify | `packages/admin/src/views/Gardens/Garden/Detail.tsx` |
| Create | `packages/admin/src/components/Vault/VaultDashboard.tsx` |
| Create | `packages/admin/src/components/Vault/PositionCard.tsx` |
| Create | `packages/admin/src/components/Vault/DepositModal.tsx` |
| Create | `packages/admin/src/components/Vault/WithdrawModal.tsx` |
| Create | `packages/admin/src/components/Vault/DonationAddressConfig.tsx` |
| Create | `packages/admin/src/components/Vault/VaultEventHistory.tsx` |

---

## Phase 6: Client PWA — Read-Only Vault Info

### 6A: Vault Balance Display

Add read-only vault info card to the garden view in the client PWA: total deposited across strategies, total yield donated, active strategy count. Uses `useVaultPositions()` from shared. No treasury balance — garden account holds no assets.

### 6B: Position Summary

List of strategy positions: name, balance, yield donated, last harvest. No deposit/withdraw buttons.

### Files
| Action | File |
|--------|------|
| Modify | Client garden detail view (identify exact file) |

---

## Phase 7: Deployment + E2E

### 7A: Deploy Script

**Modify:** `packages/contracts/script/Deploy.s.sol` — add GardenVaultManager deployment
**Modify:** `packages/contracts/test/helpers/DeploymentBase.sol` — add to deployFullStack()
**Modify:** Deployment JSON files — add gardenVaultManager address

### 7B: E2E Tests

**Modify:** `packages/contracts/test/E2EWorkflow.t.sol` — add vault integration to workflow
**Create:** `packages/contracts/test/fork/ArbitrumVault.t.sol` — full Arbitrum fork test (deploy factory + strategy against real Aave V3)

### Files
| Action | File |
|--------|------|
| Modify | `packages/contracts/script/Deploy.s.sol` |
| Modify | `packages/contracts/test/helpers/DeploymentBase.sol` |
| Modify | `packages/contracts/test/E2EWorkflow.t.sol` |
| Create | `packages/contracts/test/fork/ArbitrumVault.t.sol` |

---

## Parallelization

```
Phase 0 (Specs) ─────────────────────────────────────> [2 days]
   │
Phase 1 (Contracts) ─────────────────────────────────> [5-7 days]
   │              │
   │     Phase 2 (Strategy) ─────────────────────────> [4-5 days, starts after 1B interfaces done]
   │              │
Phase 3 (Indexer) ───────────────────────────────────> [3-4 days, starts after 1B interfaces done]
   │              │
Phase 4 (Shared) ────────────────────────────────────> [4-5 days, starts after 1B interfaces done]
   │              │
   ├──────────────┤
   │              │
Phase 5 (Admin) ─────── Phase 6 (Client) ───────────> [4-5 days, independent of each other]
   │              │
   ├──────────────┤
   │
Phase 7 (Deploy + E2E) ─────────────────────────────> [3-4 days]
```

**3 parallel tracks after Phase 1 interfaces are defined:**
- Track A: Contracts (Phase 1 impl + Phase 2)
- Track B: Frontend (Phase 4 types/hooks + Phase 5 + Phase 6)
- Track C: Indexer (Phase 3)

**Total: ~14-18 days parallelized, ~26-35 days sequential**

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Octant V2 factory not yet on Arbitrum | Blocks integration | Deploy factory ourselves; contact Octant team early |
| Operator share accounting | Multiple operators deposit to same vault; need to track who deposited what | GardenVaultManager emits per-operator Deposited events; indexer tracks positions per operator per garden |
| Contract size limits (24KB) | GardenVaultManager too large | Extract position tracking into VaultLib (matches existing HatsLib pattern) |
| Aave V3 yield too low | Feature feels underwhelming | Extensible strategy registry; add Yearn V3, Pendle strategies later |
| Storage layout conflicts | OctantModule upgrade breaks data | Run StorageLayout.t.sol; add storage after __gap |
| Hats v2 not yet deployed (all zeros in deployment JSONs) | Role checks revert for vault ops | Vault work proceeds in parallel; test with mock access control; HatsModule deployment is independent track |
| Vault fee recipient → ConvictionYieldRouter migration | Future upgrade complexity | When conviction voting ships, deploy a yield router contract and update each garden's vault fee recipient to point to it |

---

## Verification

1. **Contracts**: `cd packages/contracts && bun test` — all unit + integration tests pass
2. **Fork tests**: `forge test --match-path test/fork/ArbitrumAaveStrategy.t.sol --fork-url $ARBITRUM_RPC`
3. **Build**: `bun build` from root — all packages compile
4. **Lint**: `bun format && bun lint` — clean
5. **Indexer**: `cd packages/indexer && bun test` — event handler tests pass
6. **Shared**: `cd packages/shared && bun test` — hook tests pass
7. **E2E**: Deploy to Arbitrum Sepolia, execute deposit→harvest→withdraw cycle via Admin Dashboard
