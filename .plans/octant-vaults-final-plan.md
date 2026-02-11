# Octant DeFi Vaults — Final Implementation Plan v2.0

> **Implementation Status:** All phases (0-5) are **COMPLETE**. Code is implemented and tested on the `feature/octant-defi-vaults` branch. Phase 6 (Deployment + E2E) is **BLOCKED** — requires Octant V2 factory deployment and environment configuration. See [Tech Spec § Deployment Prerequisites](../docs/docs/specs/octant/octant-tech-spec.md#70-deployment-prerequisites) for activation steps.

## Context

Green Goods gardens need yield-generating vaults to fund environmental impact. Each garden gets two vaults (WETH + DAI) created automatically at mint time. Anyone can **deposit directly into the ERC-4626 vault** to receive shares and withdraw their principal anytime. Only the yield portion is donated to a configurable per-garden donation address (Phase 1), with conviction-based Hypercert purchasing coming in Phase 2.

**Key architecture: direct vault interaction.** Users call `vault.deposit()` and `vault.redeem()` directly on the ERC-4626 vault — not through OctantModule. OctantModule is a **registry + admin layer** only: vault creation at mint, harvest (triggers YDS `report()`), donation config, emergency pause, and asset registry. This eliminates proxy gas overhead and makes vaults composable with standard ERC-4626 tools.

This plan consolidates and supersedes both `octant-vaults-mvp-plan.md` (Codex) and `.plans/octant-vault-integration.md` (Claude), resolving all conflicts per owner decisions.

### Resolved Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Deposit model | **Open access, direct vault** — anyone calls `vault.deposit()` directly, gets ERC-4626 shares, calls `vault.redeem()` anytime. Yield goes to garden donation address. | Standard ERC-4626; no proxy gas; composable with DeFi tools |
| Yield routing | **Donation address** (Phase 1). Conviction-based Hypercert purchases in Phase 2. | Ship fast; avoid 3+ extra contracts and external dependencies |
| Launch assets | **WETH + DAI** on Arbitrum | WETH (2.85% APR, volatile) + DAI (2.43% APR, stablecoin). Same strategy deployed twice. Good combo: one native, one stable. |
| Contract architecture | **OctantModule as registry + admin layer only**. Deposits/withdrawals go directly to ERC-4626 vault. No GardenVaultManager. | Simpler, cheaper, more composable. Vault is the user-facing contract. |
| Deposit/withdraw path | **Direct vault interaction** — users call `vault.deposit()`/`vault.redeem()` directly. OctantModule never touches deposit/withdraw. | Eliminates proxy overhead; standard ERC-4626 composability |
| Client UX | **Deposit + withdraw + read** via treasury drawer (ModalDrawer, single scrollable view) | Open deposits + open withdrawals; client users participate fully |
| Admin UX | **Both nested + top-level** — `gardens/:id/vault` per-garden detail + `/treasury` sidebar overview | Per-garden management AND cross-garden overview |
| Harvest trigger | **Manual only** (operator triggers from admin). Automation in Phase 2. | Simpler to build and debug |
| Emergency role | **Hats Owner** (existing role). No new guardian role. | Reuses existing access control |
| Vault creation | **At garden mint** (not lazy on first work approval). `onWorkApproved()` fully removed. | Consistent UX; every garden starts with vaults; no legacy path |
| Donation address | **Must be explicitly set** before harvest. No default. Prevents accidental yield routing. | Operators must consciously configure where yield goes |
| Strategy deactivation | **Block deposits only**. Withdrawals and harvests still work for existing positions. | Safest for depositors; they can always exit |
| Testnet | **Ethereum Sepolia (11155111)**. Mainnet = Arbitrum (42161). | Not Arb Sepolia; Sepolia for staging |
| Vault factory | **Deploy Octant V2 factory ourselves** on Arbitrum. We have the contracts. | IOctantFactory interface already matches |
| Testnet strategy | **MockYDSStrategy on Sepolia** + **Foundry fork tests** against real Aave V3 on Arbitrum RPC | Aave V3 not on Sepolia; fork tests verify real behavior |
| Withdraw access | **Anyone can withdraw own shares** via `vault.redeem()`. Permissionless. | Matches "withdraw anytime" promise; standard ERC-4626 |
| Branch | **`feature/octant-defi-vaults`** (existing branch) | Already has setup work |
| UI design | **Design as we build** following existing Radix UI + TailwindCSS patterns. No Figma designs. | Ship fast; iterate on design post-MVP |
| Scope | **New gardens only**, Arbitrum-native, no CCIP | No migration complexity; cross-chain in Phase 2 |
| Vault roleManager | **OctantModule** is vault roleManager (not garden TBA) | OctantModule handles harvest/emergency so needs vault permissions directly |
| Treasury overview | **Only gardens with vaults** in admin Treasury page | Cleaner UI; no empty states; only actionable items |
| Depositor tracking | **Both per-depositor + aggregate** in indexer | Enables "My Deposits" view in client + admin; full transparency |
| Asset registry | **Asset → strategy mapping** (`mapping(address asset => address strategy)`) | Each asset has explicit strategy address; clearer deployment config |
| Vault event scope | **Deposit/Withdraw only** — no Transfer event indexing in MVP | Simpler indexing; share transfers rare; add in Phase 2 if needed |
| Asset enumeration | **address[] supportedAssetList** alongside mapping | OctantModule iterates internally; caller just says "create vaults" |
| Storage migration | **Redeploy fresh** OctantModule (new proxy, clean storage) | No existing vaults to migrate; simplest approach |
| Harvest mechanism | **YDS `report()`** — strategy auto-mints shares to donation address | Built into Octant YDS; no manual yield extraction needed |
| Emergency behavior | **Pause + signal** — emit event, no automatic withdrawal | Manual resolution off-chain; safest for depositors |
| Vault + strategy | **Factory vault + attached strategy** (standard Octant V2 pattern) | Factory deploys Allocator Vault (user-facing ERC-4626); strategy attached for yield accrual + donation |
| GardenToken deploy | **Fresh deploy** (not UUPS upgrade) | Both OctantModule and GardenToken deployed fresh; simplifies storage layout |
| New asset extensibility | **`createVaultForAsset(garden, asset)`** — operator/owner adds vaults for newly supported assets to existing gardens | Enables adding USDC later without upgrading contracts; explicit per-garden |

---

## Phase 0: Spec Restructuring (2 days) — COMPLETE

The existing specs were cross-chain-first with CCIP, StateOracle, and HatsMirror as primary architecture. Rewritten to lead with Arbitrum-native.

### 0A. Feature Spec

**Modify:** `docs/docs/specs/octant/octant-feature-spec.md`

- Promote Section 12 (Arbitrum-Native) to primary architecture (Sections 1-6)
- Move cross-chain content (Sections 1-11) to appendix file
- Update deposit model: open access (anyone deposits), not operator-only
- Simplify yield routing: donation address, not conviction voting
- Add Client PWA deposit scope to integration matrix
- Update sequence diagrams (no CCIP, no StateOracle, no HatsMirror)
- Resolve all Open Questions (Section 14) with dated decisions
- Fix data model: remove CrossChainMessage, simplify VaultPosition

### 0B. Tech Spec

**Modify:** `docs/docs/specs/octant/octant-tech-spec.md`

- Make Section 2.1.1 (Arbitrum-Native) the only Phase 1 architecture
- Replace GardenVaultManager interface with OctantModule as registry + admin layer
- Document direct vault interaction: users call `vault.deposit()`/`vault.redeem()` directly
- Remove CCIP-related contracts from Phase 1 scope
- Add full IOctantVault ERC-4626 interface
- Update Envio schema to match simplified entities (dual event sources: OctantModule + vault)
- Fix Zustand store: use TanStack Query for server state (per project patterns)
- Update deposit flow diagram: direct vault, open access, no TBA custody
- Add donation address configuration to contract interfaces
- Remove `onWorkApproved()` from all diagrams and interfaces

### 0C. Cross-Chain Appendix

**Create:** `docs/docs/specs/octant/octant-cross-chain-appendix.md`

Archive the cross-chain CCIP architecture (Sections 1-11 from feature spec, Phase 2 from tech spec) for future reference.

---

## Phase 1: Contracts (7-9 days) — COMPLETE

### 1A. Restructure OctantModule as Registry + Admin Layer

**Modify:** `packages/contracts/src/modules/Octant.sol`

OctantModule was restructured from lazy vault creation to a **registry + admin layer**. Deposits and withdrawals go **directly to the ERC-4626 vault** — OctantModule never touches them.

**`onWorkApproved()` has been fully removed** — along with the `onlyRouter` modifier and `router` storage. The GreenGoodsResolver wraps the call in try/catch, so this removal is non-breaking.

**Replace `createVaultForGarden()` with `createVaultForAsset(garden, asset)`** — enables existing gardens to get vaults for newly added assets (e.g., adding USDC after launch). Callable by garden operator/owner or protocol owner.

**Existing storage to keep:** `octantFactory`, `defaultProfitUnlockTime`
**Existing storage to remove:** `defaultAsset` (replaced by multi-asset registry), `router` (no longer needed)

**Fresh deployment** (no UUPS upgrade — clean storage, new proxy). Storage layout:

```solidity
// From existing contract (keep)
IOctantFactory public octantFactory;
uint256 public defaultProfitUnlockTime;

// New storage
mapping(address garden => address donationAddress) public gardenDonationAddresses;
mapping(address garden => mapping(address asset => address vault)) public gardenAssetVaults;
mapping(address asset => address strategy) public supportedAssets; // asset → strategy mapping (address(0) = unsupported)
address[] public supportedAssetList; // for iteration in onGardenMinted()
uint256 public supportedAssetCount; // active (non-deactivated) asset count
address public gardenToken;

uint256[42] private __gap; // 50 - 8 used
```

`supportedAssets` maps asset → strategy address. `address(0)` means unsupported. `supportedAssetList` enables iteration in `onGardenMinted()`. `setSupportedAsset()` maintains both the mapping and the array.

**New entry point — replaces lazy creation:**

```solidity
function onGardenMinted(address garden, string calldata gardenName) external onlyGardenToken
    returns (address[] memory vaults)
```
- Iterates `supportedAssetList` (WETH + DAI), creates one vault per asset for the garden
- Called from `GardenToken._initializeGardenModules()` (try/catch, non-blocking)
- Stores vaults in `gardenAssetVaults[garden][asset]`
- **OctantModule is vault roleManager** (not garden TBA) — since harvest/emergency go through OctantModule, it needs vault permissions directly
- Reuses existing `_createVaultForGarden()` internal, updated to pass `address(this)` as roleManager instead of `garden`

**OctantModule operations (admin only — NO deposit/withdraw):**

| Function | Access | Purpose |
|----------|--------|---------|
| `harvest(garden, asset)` | **Operator/Owner** | Calls `strategy.report()` which triggers `_harvestAndReport()`. YDS auto-mints yield shares to donation address. **Reverts if no donation address set.** Works even if asset deactivated. |
| `emergencyPause(garden, asset)` | **Owner only** | Calls `strategy.shutdown()` (emits `StrategyShutdownFailed` on failure). Always emits `EmergencyPaused(garden, asset, caller)`. Does NOT withdraw — manual resolution off-chain. |
| `setDonationAddress(garden, addr)` | **Operator/Owner** | Set per-garden donation address. **Must be set before first harvest.** YDS mints yield shares to this address. No default. |
| `setSupportedAsset(asset, strategy)` | **Protocol Owner** | Add/remove supported assets. `strategy=address(0)` deactivates. Deactivation blocks vault-level deposits only. |
| `setGardenToken(addr)` | **Protocol Owner** | Set GardenToken address for callback auth |
| `createVaultForAsset(garden, asset)` | **Operator/Owner or Protocol Owner** | Create a vault for a specific asset on an existing garden. Enables adding new assets (e.g., USDC) to gardens that were minted before the asset was supported. Reverts if vault already exists. |
| `getVaultForAsset(garden, asset) view` | Anyone | Read vault address |

**How YDS harvest works (no manual yield extraction):**
1. Operator calls `octantModule.harvest(garden, asset)`
2. OctantModule calls `strategy.report()` on the garden's vault strategy
3. Strategy internally calls `_harvestAndReport()` → returns totalAssets
4. If profit detected: strategy **auto-mints shares to the donation address** (set per-garden)
5. User PPS stays flat — depositors only get their principal value back
6. Donation recipient accumulates shares representing the yield; they can redeem for underlying asset

**Important:** The donation address must be set on the **strategy** itself (not just tracked in OctantModule). When creating a vault, OctantModule configures the strategy's donation address. `setDonationAddress()` updates both the OctantModule mapping AND calls the strategy to update.

**Direct vault interaction (NOT through OctantModule):**

| Call | Target | Access | Notes |
|------|--------|--------|-------|
| `vault.deposit(assets, receiver)` | IOctantVault | **Anyone** | Standard ERC-4626. User must `asset.approve(vault, amount)` first. |
| `vault.redeem(shares, receiver, owner)` | IOctantVault | **Anyone** (own shares) | Standard ERC-4626. Shares holder redeems directly. |
| `vault.balanceOf(address)` | IOctantVault | Anyone | Read share balance |
| `vault.convertToAssets(shares)` | IOctantVault | Anyone | Preview redemption value |
| `vault.totalAssets()` | IOctantVault | Anyone | Total vault TVL |

**Access control** — reuse existing `IGardenAccessControl` for privileged ops:
```solidity
// For harvest, setDonationAddress
modifier onlyGardenOperatorOrOwner(address garden) {
    if (!IGardenAccessControl(garden).isOperator(msg.sender))
        revert UnauthorizedCaller(msg.sender);
    _;
}
// For emergencyWithdraw
modifier onlyGardenOwner(address garden) {
    if (!IGardenAccessControl(garden).isOwner(msg.sender))
        revert UnauthorizedCaller(msg.sender);
    _;
}
```

**Events (OctantModule only emits admin events):**
- `VaultCreated(garden, vault, asset)` — existing event, kept
- `FactoryUpdated(oldFactory, newFactory)` — emitted on factory address change
- `GardenTokenUpdated(oldGardenToken, newGardenToken)` — emitted on gardenToken change
- `HarvestTriggered(garden, asset, caller)` — emitted when `report()` is called; actual yield amount comes from strategy events
- `EmergencyPaused(garden, asset, caller)` — always emitted on emergency pause (regardless of shutdown success)
- `StrategyShutdownFailed(garden, asset, strategy)` — emitted in `emergencyPause` catch block when `strategy.shutdown()` fails
- `DonationAddressUpdated(garden, oldAddress, newAddress)`
- `SupportedAssetUpdated(asset, strategy)` — includes strategy address
- `DefaultProfitUnlockTimeUpdated(oldUnlockTime, newUnlockTime)` — emitted on config change

**Note:** Deposit/Withdraw events come from the vault itself (standard ERC-4626 `Deposit`/`Withdraw` events). Yield donation events come from the YDS strategy (`report()` triggers share minting). The indexer listens to vault + strategy contracts for these.

**Errors:** `UnauthorizedCaller`, `ZeroAddress`, `FactoryNotConfigured`, `UnsupportedAsset`, `AssetDeactivated`, `NoDonationAddress`, `NoVaultForAsset`, `VaultAlreadyExists`

**24KB contract size risk:** Reduced since deposit/withdraw logic removed. Monitor with `forge build --sizes`. If needed, extract into `VaultLib.sol` (follows `HatsLib` pattern at `packages/contracts/src/lib/Hats.sol`).

### 1B. Extend IOctantVault Interface

**Modify:** `packages/contracts/src/interfaces/IOctantFactory.sol`

Add missing ERC-4626 view functions to `IOctantVault`:
- `balanceOf(address)`, `totalSupply()`
- `convertToAssets(uint256)`, `convertToShares(uint256)`
- `previewDeposit(uint256)`, `previewWithdraw(uint256)`
- `maxDeposit(address)`, `maxWithdraw(address)`
- `redeem(uint256 shares, address receiver, address owner)`

### 1C. Wire Vault Creation into Garden Mint

**Modify:** `packages/contracts/src/tokens/Garden.sol`

**Fresh deployment** (not UUPS upgrade) — GardenToken is deployed fresh alongside OctantModule. No storage layout migration concerns.

Add new storage:
```solidity
import { OctantModule } from "../modules/Octant.sol";
OctantModule public octantModule;
```

Update `__gap` to 45 (one slot consumed: 46 → 45).

Add setter + event:
```solidity
event OctantModuleUpdated(address indexed oldModule, address indexed newModule);
function setOctantModule(address _module) external onlyOwner { ... }
```

In `_initializeGardenModules()` (after KarmaGAP block, line ~247), add:
```solidity
if (address(octantModule) != address(0)) {
    try octantModule.onGardenMinted(gardenAccount, config.name) {
    } catch {
        // Non-blocking — mirrors KarmaGAP pattern
    }
}
```

### 1D. AaveV3YDSStrategy (Mainnet only)

**Create:** `packages/contracts/src/strategies/AaveV3YDSStrategy.sol`

Extends Octant's YDS BaseStrategy pattern. Deployed twice: once for WETH, once for DAI (same contract, parameterized by asset):
- `_deployFunds(uint256)`: deposits to Aave V3 Pool on Arbitrum. Must be simple and deterministic (no swaps, no oracle reliance)
- `_freeFunds(uint256)`: withdraws from Aave V3
- `_harvestAndReport() returns (uint256 totalAssets)`: harvests pending rewards, returns total managed assets. Base contract compares with prior value — profit auto-mints shares to donation address, keeping user PPS flat
- `report()`: keeper/management callable entry point that triggers `_harvestAndReport()` + yield donation
- Strategy deactivation: when deactivated, `deposit()` reverts but `withdraw()` and `report()` still work

**YDS yield donation mechanics:**
- Profits → new shares minted to donation address (user PPS stays flat)
- Losses → donation shares burned first to keep user PPS flat; only if exhausted does user PPS decline
- Donation address configurable on the strategy (set by OctantModule)

Arbitrum mainnet addresses: Aave Pool `0x794a61358D6845594F94dc1DB02A252b5b4814aD`, WETH `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`, DAI `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1`

**NOT deployed on Sepolia** — Aave V3 is not available there. Verified via Foundry fork tests only.

### 1E. Mocks (Testnet + Unit Tests)

**Modify:** `packages/contracts/src/mocks/Octant.sol` — extend MockOctantVault with new IOctantVault functions (balanceOf, convertToAssets, redeem, etc.)

**Create:** `packages/contracts/src/mocks/MockYDSStrategy.sol`
- Deployed on **Ethereum Sepolia** for integration testing
- Extends YDS BaseStrategy with mock `_harvestAndReport()` that returns inflated totalAssets
- `simulateYield(uint256 amount)`: admin function that injects mock yield (mints extra tokens to simulate Aave earnings)
- `report()`: triggers `_harvestAndReport()` → auto-mints yield shares to donation address (standard YDS behavior)
- Allows testing full deposit → report() → donation share minting → withdraw flow without real DeFi protocols

### 1F. Tests

**Create:** `packages/contracts/test/unit/OctantModule.t.sol`
- Access control: harvest (operator/owner only), emergency pause (owner only), donation config (operator/owner only)
- Vault creation on mint (single + batch) — verifies WETH + DAI vaults created, OctantModule as roleManager
- `onWorkApproved` is fully removed — function doesn't exist
- Unsupported asset, no vault, no donation address reverts
- Asset deactivation: blocks new vault creation, existing vaults still work for harvest
- `setSupportedAsset()` maintains both mapping and array in sync
- `createVaultForAsset()` creates vault for newly supported asset on existing garden; reverts if vault exists
- Donation address updates both OctantModule mapping AND strategy

**Create:** `packages/contracts/test/unit/DirectVaultInteraction.t.sol`
- Direct deposit: user approves asset → calls `vault.deposit()` → receives shares
- Direct redeem: user calls `vault.redeem()` → receives assets
- Multi-depositor: two users deposit directly, each tracks own shares independently
- Share accounting: verify `vault.balanceOf()`, `vault.convertToAssets()` correctness

**Create:** `packages/contracts/test/integration/OctantVaultIntegration.t.sol`
- Full lifecycle: mint → direct deposit WETH → harvest via OctantModule → direct withdraw
- Multi-asset: WETH + DAI vaults operating independently per garden
- YDS yield flow: direct deposit → simulate yield → `report()` → verify donation address receives yield shares (PPS flat for depositors)
- Emergency pause: owner triggers via OctantModule, event emitted, no automatic withdrawal

**Create:** `packages/contracts/test/fork/ArbitrumAaveStrategy.t.sol`
- Fork test against real Aave V3 on Arbitrum

**Modify:** `packages/contracts/test/StorageLayout.t.sol` — add OctantModule + GardenToken layout validation

---

## Phase 2: Indexer (3-4 days, parallelizable after Phase 1 interfaces) — COMPLETE

### 2A. Schema

**Modify:** `packages/indexer/schema.graphql` — add new entities:

- **GardenVault** — `id` (chainId-garden-asset), garden, asset, vaultAddress, totalDeposited, totalWithdrawn, totalHarvestCount, donationAddress, depositorCount, paused, createdAt
- **VaultDeposit** — `id` (chainId-vault-depositor), garden, asset, vaultAddress, depositor, shares, totalDeposited, totalWithdrawn (per-depositor per-asset)
- **VaultEvent** — `id` (chainId-txHash-logIndex), garden, asset, vaultAddress, eventType (DEPOSIT/WITHDRAW/HARVEST/EMERGENCY_PAUSED), actor, amount, shares, txHash, timestamp

### 2B. Config

**Modify:** `packages/indexer/config.yaml`

Two event sources needed (since deposit/withdraw is direct vault, not OctantModule):

1. **OctantModule contract** — events: `VaultCreated`, `HarvestTriggered`, `EmergencyPaused`, `DonationAddressUpdated`, `SupportedAssetUpdated`
2. **Dynamic vault contracts** (via `context.OctantVault.register(vaultAddress)` on `VaultCreated`) — Track ERC-4626 `Deposit(address sender, address owner, uint256 assets, uint256 shares)` and `Withdraw(address sender, address receiver, address owner, uint256 assets, uint256 shares)` events only. **No Transfer event indexing** in MVP — share transfers are rare in this context.

### 2C. Event Handlers

**Modify:** `packages/indexer/src/EventHandlers.ts`

Add handlers following existing HatsModule pattern (line ~490):

**OctantModule handlers:**
- `VaultCreated` → Create `GardenVault` entity, register vault address for dynamic event tracking via `context.OctantVault.register(vaultAddress)`
- `HarvestTriggered` → Create `VaultEvent` with type `HARVEST` (yield amount comes from strategy report events)
- `EmergencyPaused` → Create `VaultEvent` with type `EMERGENCY_PAUSED`, update `GardenVault.paused` flag
- `DonationAddressUpdated` → Update `GardenVault.donationAddress`

**ERC-4626 vault handlers (dynamic contract):**
- `Deposit` → Create/update `VaultDeposit` for depositor, update `GardenVault.totalDeposited` + `depositorCount`, create `VaultEvent` with type `DEPOSIT`
- `Withdraw` → Update `VaultDeposit`, update `GardenVault.totalWithdrawn`, create `VaultEvent` with type `WITHDRAW`

**Patterns to follow** (from existing handlers):
- Chain-prefixed entity IDs: `${chainId}-${garden}-${asset}`
- Address normalization: `normalizeAddress()` for all addresses
- `Mutable<T>` helper for readonly entity updates
- `addUniqueAddress()` for depositor tracking

### 2D. Indexer Tests

**Modify:** `packages/indexer/test/test.ts`

Add vault test suite using existing `MockDb` + `createMockEvent` patterns:

```
describe("OctantModule", () => {
  it("VaultCreated creates GardenVault entity with chain-prefixed id")
  it("VaultCreated registers dynamic vault contract")
  it("DonationAddressUpdated updates GardenVault donation address")
  it("HarvestTriggered creates VaultEvent with HARVEST type")
  it("EmergencyPaused sets GardenVault.paused and creates VaultEvent")
})

describe("OctantVault (dynamic)", () => {
  it("Deposit creates VaultDeposit entity and updates GardenVault totals")
  it("Deposit increments depositorCount only for new depositors")
  it("Deposit from existing depositor updates shares, not depositorCount")
  it("Withdraw updates VaultDeposit shares and GardenVault totals")
  it("Withdraw creates VaultEvent with WITHDRAW type")
  it("Multiple depositors tracked independently per vault")
})
```

Test helpers to add:
- `createMockGardenVault(garden, asset, vault)` — seeds a GardenVault entity
- `createMockVaultDeposit(garden, depositor, shares)` — seeds a VaultDeposit entity
- Use existing `createMockAddress()` and `createMockBlockData()` patterns

---

## Phase 3: Shared Package (4-5 days, parallelizable with Phase 2) — COMPLETE

### 3A. Types

**Create:** `packages/shared/src/types/vaults.ts`
- `GardenVault`, `VaultDeposit`, `VaultEvent`, `DepositParams`, `WithdrawParams`
- Use `Address` from `./domain` (never bare string)

**Modify:** `packages/shared/src/types/contracts.ts` — add `octantModule` to `NetworkContracts`

### 3B. ABIs + Contract Resolution

**Modify:** `packages/shared/src/utils/blockchain/abis.ts`
- Add `OCTANT_MODULE_ABI` — admin functions only: `harvest`, `emergencyWithdraw`, `setDonationAddress`, `getVaultForAsset`, `gardenDonationAddresses`, view functions
- Add `OCTANT_VAULT_ABI` — ERC-4626 interface for direct vault interaction: `deposit`, `redeem`, `balanceOf`, `convertToAssets`, `convertToShares`, `totalAssets`, `asset`, `previewDeposit`, `maxDeposit`, `approve` (inherited ERC-20)

**Modify:** `packages/shared/src/utils/blockchain/contracts.ts` — add octantModule to `getNetworkContracts()`

### 3C. Query Keys

**Modify:** `packages/shared/src/hooks/query-keys.ts`

Add `vaults` key factory: `byGarden(gardenAddress)`, `deposits(gardenAddress)`, `myDeposits(gardenAddress, userAddress)`, `events(gardenAddress)`, `preview(vaultAddress, amount)` + invalidation helpers `onVaultDeposit`, `onVaultWithdraw`, `onVaultHarvest`

### 3D. Hooks

All hooks follow existing patterns — TanStack Query for reads, wagmi `useWriteContract` for writes.

**Create:** `packages/shared/src/hooks/vault/useGardenVaults.ts` — fetch GardenVault entities from indexer for a garden. Returns per-asset vault data (address, TVL, yield, depositor count).

**Create:** `packages/shared/src/hooks/vault/useVaultDeposits.ts` — fetch VaultDeposit entities (my deposits view). Filters by connected wallet address.

**Create:** `packages/shared/src/hooks/vault/useVaultOperations.ts` — mutation hooks split by target contract:

- **Direct vault mutations** (call vault contract directly):
  - `useVaultDeposit()` — Two-step: `asset.approve(vault, amount)` → `vault.deposit(amount, receiver)`. Check existing allowance first, skip approve if sufficient. Uses `createMutationErrorHandler()`, `toastService` for tx feedback.
  - `useVaultWithdraw()` — Single-step: `vault.redeem(shares, receiver, owner)`. User redeems own shares.

- **OctantModule mutations** (admin operations):
  - `useHarvest()` — `octantModule.harvest(garden, asset)`. Triggers `strategy.report()` which auto-mints yield shares to donation address. Operator/Owner only.
  - `useEmergencyPause()` — `octantModule.emergencyPause(garden, asset)`. Emits event only; manual resolution. Owner only.
  - `useSetDonationAddress()` — `octantModule.setDonationAddress(garden, addr)`. Updates both OctantModule + strategy. Operator/Owner only.

**Create:** `packages/shared/src/hooks/vault/useVaultEvents.ts` — fetch VaultEvent history from indexer, sorted by timestamp desc.

**Create:** `packages/shared/src/hooks/vault/useVaultPreview.ts` — onchain reads directly from vault contract: `previewDeposit()`, `convertToAssets()`, `maxDeposit()`, `balanceOf()`. Uses wagmi `useReadContract` / `useReadContracts` for batching.

### 3E. Barrel Exports

**Modify:** `packages/shared/src/hooks/index.ts` — export all vault hooks
**Modify:** `packages/shared/src/index.ts` — export vault types

### 3F. i18n

**Modify:** `packages/shared/src/i18n/en.json`, `es.json`, `pt.json` — add `app.treasury.*` keys:
- `app.treasury.title`, `app.treasury.deposit`, `app.treasury.withdraw`, `app.treasury.harvest`
- `app.treasury.donationAddress`, `app.treasury.totalDeposited`, `app.treasury.totalYield`
- `app.treasury.myShares`, `app.treasury.shareValue`, `app.treasury.noVault`
- `app.treasury.setDonationFirst`, `app.treasury.emergencyPause`, `app.treasury.depositSuccess`
- `app.treasury.withdrawSuccess`, `app.treasury.harvestSuccess`, `app.treasury.approving`

### 3G. Tests

**Create:** `packages/shared/src/__tests__/hooks/vault/useVaultOperations.test.ts`
- Test two-step deposit flow (approve → deposit on vault contract directly)
- Test single-step withdraw (redeem on vault contract directly)
- Test harvest mutation (calls OctantModule which calls strategy.report() — YDS auto-mints yield shares)
- Test emergency pause mutation (calls OctantModule, emits event only)
- Test setDonationAddress mutation (updates both OctantModule + strategy)
- Test error handling via `createMutationErrorHandler()`
- Test query invalidation after successful mutations

---

## Phase 4: Admin UI (4-5 days, after Phase 3) — COMPLETE

### 4A. Routes

**Modify:** `packages/admin/src/router.tsx`
- Add `gardens/:id/vault` route (lazy-loaded, per-garden vault detail — follows `Assessment.tsx`, `Hypercerts.tsx` pattern)
- Add top-level `/treasury` route (lazy-loaded, cross-garden vault overview)

**Modify:** `packages/admin/src/components/Layout/Sidebar.tsx` — add "Treasury" nav entry with vault icon

### 4A2. Treasury Overview Page

**Create:** `packages/admin/src/views/Treasury/index.tsx`

Top-level treasury page showing **only gardens that have vaults** (no empty states):
- List of garden cards, each showing: garden name, per-asset TVL, total yield harvested, donation address status
- Click a garden → navigates to `gardens/:id/vault` for full management
- Summary stats at top: total TVL across all gardens, total yield harvested
- Fetches from indexer GardenVault entities, grouped by garden

### 4B. Vault Section in Garden Detail

**Modify:** `packages/admin/src/views/Gardens/Garden/Detail.tsx`

Add a Treasury summary row using existing `StatCard` component (`packages/admin/src/components/StatCard.tsx`):
- StatCard: vault TVL (total across assets)
- StatCard: total yield harvested
- StatCard: depositor count
- Link/button: "Manage Vault" → navigates to vault page
- Warning banner if donation address not set: "Set a donation address before harvesting yield"

### 4C. Vault Page + Components

**Create:** `packages/admin/src/views/Gardens/Garden/Vault.tsx` — full vault management page

Page layout (follows existing garden detail pages like `Hypercerts.tsx`):
1. Header with garden name + "Treasury" breadcrumb
2. Donation address config section (prominent, top of page)
3. Per-asset vault cards (WETH + DAI)
4. Event history table (bottom)

**Create:** `packages/admin/src/components/Vault/PositionCard.tsx`

Per-asset vault card showing:
- Asset icon + name (WETH / DAI)
- Total deposited (from indexer `GardenVault.totalDeposited`)
- Harvestable yield (onchain read: `vault.totalAssets() - totalDeposited`)
- Total yield harvested (from indexer)
- Depositor count
- Action buttons: Deposit, Withdraw, Harvest (triggers `report()`), Emergency Pause (owner only)

Uses `StatCard` pattern for metrics display.

**Create:** `packages/admin/src/components/Vault/DepositModal.tsx`

Radix Dialog (`@radix-ui/react-dialog`) with:
- Asset selector: WETH | DAI toggle
- Amount input with max button (reads wallet balance for selected asset via `useBalance`)
- Preview section: estimated shares from `vault.previewDeposit(amount)` via `useVaultPreview`
- Two-step flow: "Approve" button → "Deposit" button (skip approve if allowance sufficient)
- Transaction status: uses `toastService.loading()` → `.success()` / `.error()`
- Error handling: `createMutationErrorHandler({ source: "DepositModal", toastContext: "deposit" })`
- Calls `useVaultDeposit()` hook (which calls vault contract directly)

**Create:** `packages/admin/src/components/Vault/WithdrawModal.tsx`

Radix Dialog with:
- Shares input with "Max" button (reads `vault.balanceOf(address)`)
- Preview: estimated assets from `vault.convertToAssets(shares)` via `useVaultPreview`
- Single-step: "Withdraw" button calls `vault.redeem(shares, receiver, owner)`
- Calls `useVaultWithdraw()` hook (vault contract directly)

**Create:** `packages/admin/src/components/Vault/DonationAddressConfig.tsx`

Address input + save button:
- Display current donation address (from indexer `GardenVault.donationAddress`)
- Edit mode: validated address input (Zod `isAddress` check)
- Calls `useSetDonationAddress()` hook (OctantModule)
- Shows warning state when address is `0x0` / not set

**Create:** `packages/admin/src/components/Vault/VaultEventHistory.tsx`

Event table using existing admin table patterns:
- Columns: Type (badge), Asset, Amount, Actor, Tx Hash (linked to explorer), Timestamp
- Fetches from `useVaultEvents()` hook
- Type badges: DEPOSIT (green), WITHDRAW (blue), HARVEST (purple), EMERGENCY_PAUSED (red)
- Paginated, sorted by timestamp desc

---

## Phase 5: Client UI (3-4 days, parallelizable with Phase 4) — COMPLETE

### 5A. Treasury Icon

**Modify:** `packages/client/src/components/Navigation/TopNav.tsx`

Add treasury icon button (bank/vault icon from Remix Icon). Visible when:
- User is viewing a garden that has vaults (check via `useGardenVaults()`)
- Shows badge dot if user has active deposits

### 5B. Treasury Drawer

**Create:** `packages/client/src/components/Dialogs/TreasuryDrawer.tsx`

Uses existing `ModalDrawer` component (`packages/client/src/components/Dialogs/ModalDrawer.tsx`) which provides:
- Slides up from bottom with Radix Dialog
- `header` prop: `{ title: "Treasury", description: gardenName }`
- No tabs — **single scrollable view** with all sections stacked
- `maxHeight="95vh"` for full-screen feel on mobile

**Scrollable sections (top to bottom):**

**Section 1: Vault Summary**
- Per-asset stat cards: WETH vault + DAI vault (total deposited, total yield harvested, donation address)
- Uses compact card layout for mobile

**Section 2: My Deposits**
- Shows user's share balance + current value per asset (from `useVaultPreview` + `useVaultDeposits`)
- If user has deposits: shows per-asset rows with shares, value, and inline "Withdraw" button
- If user has no deposits: show call-to-action "Support this garden by depositing"
- Withdraw inline: shares input, preview via `vault.convertToAssets()`, calls `vault.redeem()` via `useVaultWithdraw()`

**Section 3: Deposit**
- Asset selector toggle: WETH | DAI
- Amount input with wallet balance display for selected asset and "Max" button
- Preview: estimated shares from `vault.previewDeposit()` via `useVaultPreview`
- Two-step flow: Approve → Deposit (direct vault call via `useVaultDeposit()`)
- Transaction feedback via `toastService`
- Error handling via `createMutationErrorHandler()`

**No harvest/emergency/donation config** — those stay admin-only.

**Modify:** `packages/client/src/views/Home/Garden/index.tsx` — wire treasury drawer state:
```typescript
const [isTreasuryOpen, setIsTreasuryOpen] = useState(false);
// Pass to TopNav + TreasuryDrawer
```

---

## Phase 6: Deployment + E2E (3-4 days, after all above) — BLOCKED (awaiting factory deployment)

### 6A. Deploy Octant V2 Factory

Deploy the Octant V2 MultiStrategyVaultFactory ourselves on both networks. We have the contracts and the `IOctantFactory` interface already matches.

### 6B. Deploy Script

**Modify:** `packages/contracts/test/helpers/DeploymentBase.sol` — add OctantModule + updated GardenToken deployment to `_deployL2Protocol()`
**Modify:** `packages/contracts/script/Deploy.s.sol` — add to deployment result + save

**Sepolia deploy sequence** (testnet):
1. Deploy Octant V2 factory
2. Deploy **fresh** GardenToken impl + proxy (clean storage, no migration)
3. Deploy **fresh** OctantModule impl + UUPS proxy, initialize with factory
4. Deploy MockYDSStrategy for WETH + MockYDSStrategy for DAI (same contract, different asset param)
5. Deploy vaults via factory for mock WETH + mock DAI → attach strategies
6. Call `octantModule.setSupportedAsset(mockWETH, wethMockStrategy)` + `(mockDAI, daiMockStrategy)`
7. Call `gardenToken.setOctantModule(octantModule)`
8. Configure HatsModule, KarmaGAPModule, DeploymentRegistry on new GardenToken

**Arbitrum deploy sequence** (mainnet):
1. Deploy Octant V2 factory (or use existing if available)
2. Deploy **fresh** GardenToken impl + proxy (clean storage)
3. Deploy **fresh** OctantModule impl + UUPS proxy, initialize
4. Deploy AaveV3YDSStrategy for WETH + AaveV3YDSStrategy for DAI (same contract, different asset)
5. Deploy vaults via factory for WETH + DAI → attach strategies
6. Call `octantModule.setSupportedAsset(weth, wethStrategy)` + `(dai, daiStrategy)`
7. Call `gardenToken.setOctantModule(octantModule)`
8. Configure HatsModule, KarmaGAPModule, DeploymentRegistry on new GardenToken

### 6C. Deployment JSONs

**Modify:** `packages/contracts/deployments/42161-latest.json` — update `gardenToken`, add `octantModule`, `octantFactory`
**Modify:** `packages/contracts/deployments/11155111-latest.json` — update `gardenToken`, add `octantModule`, `octantFactory`

### 6D. Shared Config

**Modify:** `packages/shared/src/utils/blockchain/contracts.ts` — load octantModule from deployment JSON
**Modify:** `packages/shared/src/config/blockchain.ts` — add Sepolia (11155111) + Arbitrum (42161) vault config

---

## Parallelization

```
Phase 0 (Specs) ──────────────────────────────────> [2 days]
   │
Phase 1 (Contracts) ──────────────────────────────> [7-9 days, starts during/after Phase 0]
   │
   ├── Phase 2 (Indexer) ─────────────────────────> [3-4 days, starts after interfaces defined]
   │
   └── Phase 3 (Shared) ──────────────────────────> [4-5 days, starts after interfaces defined]
          │
          ├── Phase 4 (Admin) ────────────────────> [4-5 days]
          │
          └── Phase 5 (Client) ───────────────────> [3-4 days]
                 │
                 └── Phase 6 (Deploy + E2E) ──────> [3-4 days]
```

**Critical path:** Phase 0 → Phase 1 → Phase 3 → Phase 4/5 → Phase 6 = ~20-25 days
**With parallelization:** ~16-19 days

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| OctantModule exceeds 24KB | Low | Reduced risk — deposit/withdraw removed. Module is admin-only now. Monitor with `forge build --sizes`. |
| Octant V2 factory not on Arbitrum | High | Deploy Octant V2 factory ourselves; we have the contracts and IOctantFactory interface matches. |
| Storage layout collision on upgrade | Low | Both OctantModule and GardenToken freshly deployed. No upgrade migration. `StorageLayout.t.sol` validates new layout only. |
| Dynamic vault indexing | Medium | Envio `context.addContract()` for dynamic registration. Test with mock events. If dynamic registration unavailable, pre-register known vault addresses. |
| HatsModule not deployed (0x0) | Medium | Deposit/withdraw work (direct vault, no Hats check). Harvest/emergency require HatsModule — deploy before mainnet. |
| Aave V3 yield too low | Medium | Extensible strategy system; add Yearn V3 / Pendle in Phase 2. |
| Two-step deposit UX (approve + deposit) | Medium | Check existing allowance first, skip approve if sufficient. Consider Permit2 in Phase 2. |
| Open deposit griefing | Low | Standard ERC-4626 — depositors can always withdraw (no loss). Minimum deposit amount optional. |
| Donation address not set → harvest blocked | Medium | Revert in `harvest()` if `donationAddress == address(0)`. No default — operators must explicitly set before harvesting. UI shows warning. |
| `onWorkApproved` removal breaks resolver | Low | GreenGoodsResolver wraps in try/catch. Fresh OctantModule deploy = new address. Old resolver still points to old (defunct) OctantModule; new resolver deployed with vault-aware flow. |
| Fresh GardenToken deploy loses existing gardens | Medium | Only on testnet. All gardens re-created after deploy. Mainnet launch is first real deployment — no existing data to lose. |
| Strategy attachment complexity | Medium | Factory deploys vault, then strategy must be attached. Verify Octant V2 vault API for `addStrategy()` or equivalent. |

---

## Out of Scope (Phase 2+)

- **USDC vault support** (add third asset via `setSupportedAsset()` — architecture already supports it)
- Conviction-based Hypercert purchasing (YieldAllocator, CVStrategy, marketplace adapter)
- Cross-chain / CCIP integration
- Existing garden migration
- Automated harvest (GitHub Actions / Chainlink Keepers)
- Multi-strategy per asset (rebalancing)
- Protocol fee on yield
- Client-side harvest/emergency/donation controls (admin-only)

---

## Verification

**Completed (implementation phase):**
1. ~~**Contracts unit:** `cd packages/contracts && forge test --match-path test/unit/` — OctantModule access control + DirectVaultInteraction tests pass~~
2. ~~**Contracts integration:** `forge test --match-path test/integration/` — full lifecycle: mint → direct deposit → harvest → direct withdraw~~
3. ~~**Fork tests:** `forge test --match-path test/fork/ArbitrumAaveStrategy.t.sol --fork-url $ARBITRUM_RPC` — verifies real Aave V3 behavior~~
4. ~~**Contract size:** `forge build --sizes` — OctantModule < 24KB~~
5. ~~**Storage layout:** `forge test --match-path test/StorageLayout.t.sol` — no layout collisions~~
6. ~~**onWorkApproved removed:** Verified — `onWorkApproved` function does not exist on OctantModule~~
7. ~~**Build:** `bun build` from root — all packages compile~~
8. ~~**Lint:** `bun format && bun lint` — clean~~
9. ~~**Indexer:** `cd packages/indexer && bun test` — vault event handler tests pass (VaultCreated, Deposit, Withdraw, HarvestTriggered, EmergencyPaused)~~
10. ~~**Shared:** `cd packages/shared && bun test` — hook tests pass (useVaultDeposit calls vault directly, useHarvest calls OctantModule which calls strategy.report())~~

**Pending (requires deployment):**
11. **Sepolia E2E:** Deploy to Ethereum Sepolia (11155111) → mint garden → verify 2 vaults created (WETH + DAI) → direct deposit mock WETH → set donation address → harvest (report()) → verify yield shares → direct withdraw
12. **Client E2E:** Open treasury drawer → deposit via client (direct vault call) → verify shares → withdraw
13. **Admin E2E:** Garden vault page → deposit → set donation address → harvest (triggers report()) → verify donation address received yield shares → event history populated
14. **Arbitrum smoke:** After mainnet deployment, same flow with real WETH + DAI + Aave V3 strategies
