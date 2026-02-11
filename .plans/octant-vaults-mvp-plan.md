> **SUPERSEDED** — This plan has been superseded by [`octant-vaults-final-plan.md`](./octant-vaults-final-plan.md) (v2.0). Key differences:
>
> | This Plan (MVP/Codex) | Final Plan |
> |----------------------|-----------|
> | USDC-only asset | WETH + DAI assets |
> | Conviction-based Hypercert purchasing | Donation address yield routing (conviction in Phase 2) |
> | YieldAllocator + GardensProposal contracts | Removed entirely (YAGNI for Phase 1) |
> | ICVStrategyReader + IHypercertMarketplaceAdapter | Removed entirely (Phase 2) |
> | OctantModule handles deposits (sponsorDeposit) | Direct ERC-4626 vault interaction (anyone calls `vault.deposit()`) |
> | Guardian role for emergency | Owner role for emergency (existing Hats role) |
> | Daily yield automation via GitHub Actions | Manual operator harvest only (automation in Phase 2) |
> | Client: deposit-only drawer | Client: deposit + withdraw drawer |
>
> Refer to the Final Plan for all current architecture decisions.

# Arbitrum-Native Octant Vaults MVP Plan (ARCHIVED)

## Summary
- Build an Arbitrum-native Octant vault flow where each **new** Garden gets one vault at mint time.
- Support **user-sponsored USDC deposits** from both app and admin.
- Route yield **100%** to Hypercert share purchases using **onchain conviction reads**.
- Run allocation daily via automation and allow manual trigger from admin.
- Keep existing gardens unchanged (no migration/backfill in MVP).
- Remove cross-chain/CCIP from Octant MVP specs and align dependent Gardens specs.

## Locked Product Decisions (Implemented as-is)
- Vault creation timing: at Garden mint.
- Vault architecture: direct Octant factory vaults (no GardenVaultManager abstraction).
- Asset scope: USDC only, no swaps.
- Yield split: 100% to Hypercert allocator.
- Conviction source: direct onchain CVStrategy reads.
- No-conviction/no-liquidity behavior: escrow in allocator.
- Roles: operator/owner manage; guardian emergency only.
- Client UX: treasury icon opens modal drawer; client supports deposit only.
- Admin UX: dedicated Treasury page.
- Networks: Sepolia first, then Arbitrum mainnet.
- Migration: none; existing gardens remain unchanged.

## Public API / Interface Changes
- Contract updates in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/tokens/Garden.sol`:
  - Add `setOctantModule(address)` and `OctantModuleUpdated` event.
  - Trigger vault creation call during `mintGarden` and `batchMintGardens` (non-blocking `try/catch`).
- Contract updates in `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/modules/Octant.sol`:
  - Add `onGardenMinted(address garden, string gardenName)`.
  - Add `sponsorDeposit(address garden, uint256 assets)`.
  - Add `withdrawPrincipal(address garden, uint256 assets, address recipient)`.
  - Add `harvestYield(address garden)`.
  - Add `emergencyWithdrawAll(address garden, address recipient)`.
  - Add `getVaultPosition(address garden)`.
  - Add config setters for allocator, guardian, gardenToken.
- New contracts:
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/modules/YieldAllocator.sol`
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/registries/GardensProposal.sol`
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/interfaces/ICVStrategyReader.sol`
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/interfaces/IHypercertMarketplaceAdapter.sol`
- Shared TypeScript API updates:
  - Add vault types in `/Users/afo/Code/greenpill/green-goods/packages/shared/src/types/vaults.ts`.
  - Extend network contract typing in `/Users/afo/Code/greenpill/green-goods/packages/shared/src/types/contracts.ts`.
  - Add hooks export surface in `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/index.ts` and `/Users/afo/Code/greenpill/green-goods/packages/shared/src/index.ts`.

## Implementation Plan

## 1) Spec Rewrite and Alignment
- Rewrite `/Users/afo/Code/greenpill/green-goods/docs/docs/specs/octant/octant-feature-spec.md` to make Arbitrum-native the only MVP architecture.
- Rewrite `/Users/afo/Code/greenpill/green-goods/docs/docs/specs/octant/octant-tech-spec.md` to match actual implementation files and remove CCIP/cross-chain from MVP.
- Update `/Users/afo/Code/greenpill/green-goods/docs/docs/specs/gardens/gardens-feature-spec.md` and `/Users/afo/Code/greenpill/green-goods/docs/docs/specs/gardens/gardens-tech-spec.md` references from `GardenVaultManager` assumptions to `OctantModule + YieldAllocator`.
- Add explicit “Resolved Decisions” section and mark previously open questions as resolved with concrete dates.
- Add required reference links table in specs:
  - Octant docs
  - Aave Arbitrum USDC reserve docs
  - Hypercert marketplace repo + deployed exchange
  - Gardens V2 CVStrategy docs/repo
  - Green Goods contract files above.

## 2) Contracts: Vault Lifecycle, Deposits, Yield, Escrow
- In `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/tokens/Garden.sol` wire vault creation at mint (single + batch).
- In `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/modules/Octant.sol`:
  - Keep one-vault-per-garden mapping.
  - Enforce USDC-only asset usage.
  - Track principal per garden to separate principal vs harvestable yield.
  - Allow public sponsor deposits; mint shares to module-held accounting for operational simplicity.
  - Restrict withdraw/harvest to garden owner/operator checks via `IGardenAccessControl`.
  - Restrict emergency exits to guardian.
  - Disable legacy “create on work approval” path by default to preserve “new gardens only.”
- Implement `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/registries/GardensProposal.sol`:
  - Garden-scoped mapping: proposalId -> hypercertId + active status.
  - Operator/owner proposal registration and lifecycle toggles.
- Implement `/Users/afo/Code/greenpill/green-goods/packages/contracts/src/modules/YieldAllocator.sol`:
  - Pull harvested yield from Octant module.
  - Read conviction directly from configured CVStrategy contracts onchain.
  - Compute proportional allocations.
  - Attempt Hypercert purchases through adapter.
  - Escrow failed/illiquid allocations and support retry.
- Keep 100% yield routing to allocator (no treasury/protocol split in MVP).

## 3) Deployment and Configuration
- Update deployment flow in:
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/test/helpers/DeploymentBase.sol`
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/Deploy.s.sol`
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/DeployHelper.sol`
- Ensure deployment writes new addresses into:
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/deployments/11155111-latest.json`
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/deployments/42161-latest.json`
- Update shared config ingestion in:
  - `/Users/afo/Code/greenpill/green-goods/packages/shared/src/config/blockchain.ts`
  - `/Users/afo/Code/greenpill/green-goods/packages/shared/src/utils/blockchain/contracts.ts`
- Update root env sample in `/Users/afo/Code/greenpill/green-goods/.env.example` for any new required automation/runtime vars.

## 4) Shared Hooks, Query Keys, i18n
- Add vault query keys to `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/query-keys.ts`.
- Add hooks under `/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/vaults/`:
  - `useGardenVault`
  - `useVaultDeposit`
  - `useVaultAdminActions`
  - `useYieldAllocation`
- Add minimal ABIs/selectors in `/Users/afo/Code/greenpill/green-goods/packages/shared/src/utils/blockchain/abis.ts`.
- Add i18n keys to all three files:
  - `/Users/afo/Code/greenpill/green-goods/packages/shared/src/i18n/en.json`
  - `/Users/afo/Code/greenpill/green-goods/packages/shared/src/i18n/es.json`
  - `/Users/afo/Code/greenpill/green-goods/packages/shared/src/i18n/pt.json`

## 5) Admin: Dedicated Treasury Page
- Add route in `/Users/afo/Code/greenpill/green-goods/packages/admin/src/router.tsx` for `/treasury`.
- Add sidebar nav entry in `/Users/afo/Code/greenpill/green-goods/packages/admin/src/components/Layout/Sidebar.tsx`.
- Implement page/components:
  - `/Users/afo/Code/greenpill/green-goods/packages/admin/src/views/Treasury/index.tsx`
  - `/Users/afo/Code/greenpill/green-goods/packages/admin/src/components/Treasury/*`
- Page behavior:
  - Garden selector.
  - Vault position (principal, TVL, harvestable yield, escrow).
  - Actions: deposit, withdraw, trigger allocation, retry escrow.
  - Emergency action visible only for guardian-capable identity.

## 6) Client: Treasury Icon + Deposit Drawer
- Add treasury icon action to Garden top navigation in `/Users/afo/Code/greenpill/green-goods/packages/client/src/components/Navigation/TopNav.tsx`.
- Implement treasury drawer UI using existing modal drawer patterns:
  - `/Users/afo/Code/greenpill/green-goods/packages/client/src/components/Dialogs/TreasuryDrawer.tsx`
  - wire into `/Users/afo/Code/greenpill/green-goods/packages/client/src/views/Home/Garden/index.tsx`
- Drawer scope:
  - View vault summary.
  - Deposit USDC only.
  - No withdraw/allocate/emergency actions in client.

## 7) Daily Automation + Manual Trigger
- Add automation script:
  - `/Users/afo/Code/greenpill/green-goods/packages/contracts/script/automation/allocate-yield.ts`
- Add scheduled workflow:
  - `/Users/afo/Code/greenpill/green-goods/.github/workflows/octant-yield-allocation.yml`
- Workflow behavior:
  - Daily run on Sepolia during staging.
  - Daily run on Arbitrum mainnet after cutover.
  - Manual dispatch support.
- Manual trigger in admin calls onchain allocator directly (same code path as automation tx).

## 8) Explicit Out-of-Scope for MVP
- No cross-chain/CCIP.
- No migration/backfill of existing gardens.
- No multi-asset strategy set.
- No client-side withdraw/allocate controls.
- No per-package env overrides.

## Test Cases and Scenarios

## Contract (Foundry)
- Vault auto-created on garden mint.
- Batch mint creates one vault per new garden.
- Sponsor deposit from non-operator succeeds and increases principal.
- Withdraw blocked for non operator/owner.
- Guardian-only emergency withdraw enforced.
- Harvest only extracts yield above principal.
- Allocation uses onchain conviction ratios from CVStrategy.
- Zero conviction sends all yield to escrow.
- No marketplace liquidity sends allocation to escrow.
- Retry escrow purchases when liquidity appears.
- Existing gardens remain without forced vault creation.

## Shared/Admin/Client (Vitest + component tests)
- Hook tests for deposit allowance, tx submission, and query invalidation.
- Admin Treasury page role-gating and action visibility.
- Client drawer opens via icon and supports deposit-only flow.
- i18n key existence checks for `en/es/pt` for every new `app.treasury.*` key.

## End-to-End
- Sepolia flow: create garden -> vault exists -> client deposit -> admin manual allocation -> escrow fallback path.
- Sepolia automation run executes allocation path successfully.
- Arbitrum smoke after deployment with same path.

## Acceptance Criteria
- New garden mint transaction results in created vault in same flow (non-blocking on failure).
- User can deposit USDC from client drawer and admin page into garden vault.
- Daily automation executes allocation and emits allocation/escrow events.
- Manual allocation trigger works from admin.
- No existing gardens are migrated or modified automatically.
- Specs are internally consistent and cross-references resolve.

## Assumptions and Defaults
- “Guardian” for MVP is protocol-controlled guardian configuration in Octant module (not a new Hats role).
- Conviction is read onchain from configured CVStrategy contracts per garden.
- Proposal-to-hypercert linkage is provided onchain via `GardensProposalRegistry`.
- If Gardens V2 conviction contracts are unavailable on Sepolia, deploy a spec-compatible mock reader for staging only; mainnet remains on real contracts.
- USDC addresses are chain-specific and sourced from deployment/config; no token swapping is introduced.
