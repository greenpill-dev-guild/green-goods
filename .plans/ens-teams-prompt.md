# ENS Integration — Agent Teams Implementation Prompt

> **Source of truth**: `.plans/ens-integration.md` (v4b — Chainlink CCIP + Hats Protocol Verification)
> **Branch**: `feature/ens-integration` (create from `feature/action-domains`)
> **Estimated scope**: ~25 files changed, ~1000 LOC new, ~300 LOC deleted

---

## Goal

Implement `*.greengoods.eth` ENS subdomain registration via Chainlink CCIP cross-chain messaging. A single Arbitrum transaction triggers automatic L1 ENS registration (~15-20 min delivery). All protocol members (any role in any garden) can claim personal names; gardens get names at mint time.

---

## Lane Model

```
Lead (adversarial integrator)
├─ chain-driver         (contracts + indexer)
├─ chain-observer       (contracts + indexer review)
├─ middleware-driver    (shared package)
├─ middleware-observer  (shared package review)
├─ app-driver           (client + admin)
└─ app-observer         (client + admin review)
```

Lane order follows dependency flow:
1. **Chain lane** — contracts + indexer (must compile first for ABIs)
2. **Middleware lane** — shared hooks/utils/types (needs ABIs from chain)
3. **App lane** — client + admin views (needs hooks from middleware)

---

## Preflight

```bash
bash .claude/scripts/check-agent-teams-readiness.sh
```

If preflight fails, fall back to subagents with the same lane ownership.

---

## Tasks

### Chain Lane (contracts + indexer) — `chain-driver` / `chain-observer`

> **Plan gate**: chain-driver MUST use `plan_mode_required` — contracts are expensive to fix.

#### Task 1: Add Chainlink CCIP dependency and remappings
`[scope:contracts] [gate:required] [check:quick]`

- Add `@chainlink/contracts-ccip` to `packages/contracts/package.json`
- Add remapping to `remappings.txt`: `@chainlink/contracts-ccip/=node_modules/@chainlink/contracts-ccip/`
- Verify build: `cd packages/contracts && bun build`
- Reference: Plan §10 (Chainlink CCIP Dependencies)

#### Task 2: Write `IGreenGoodsENS.sol` interface
`[scope:contracts] [gate:required] [check:quick]`

- Create `src/interfaces/IGreenGoodsENS.sol`
- Interface includes: `registerGarden()`, `claimName()`, `claimNameSponsored()`, `releaseName()`, `available()`, `getRegistrationFee()`
- Reference: Plan §4.6

#### Task 3: Write `src/registries/ENS.sol` — L2 CCIP Sender
`[scope:contracts] [gate:required] [check:full]`

This is the core L2 contract. Read Plan §4.1 carefully — full Solidity code is provided.

Key implementation details:
- Constructor: `_ccipRouter`, `_ethereumChainSelector`, `_l1Receiver`, `_hats`, `_protocolHatId`, `_owner`
- `claimName(slug)` — `payable`, user funds CCIP fee via `msg.value`
- `claimNameSponsored(slug)` — NOT payable, CCIP fee from contract balance
- `registerGarden(slug, gardenAccount)` — `payable`, restricted to `authorizedCallers`
- `releaseName()` — 30-day cooldown, gardener names only
- Hats Protocol gating: `HATS.isWearerOfHat(msg.sender, protocolHatId)`
- L2 cache: `slugOwner`, `ownerToSlug`, `slugReleasedAt` mappings
- CCIP message: `abi.encode(uint8 action, string slug, address owner, NameType nameType)`
- Fee payment: native ETH (`feeToken: address(0)`)
- `gasLimit: 300_000` in CCIP `extraArgs`
- Admin: `setL1Receiver()`, `setAuthorizedCaller()`, `setProtocolHatId()`, `withdrawETH()`, `receive()`

Validation rules for `_validateSlug()`:
- Length: 3–50 chars
- Charset: `a-z`, `0-9`, `-`
- No leading/trailing hyphens
- No consecutive hyphens

#### Task 4: Write `src/registries/ENSReceiver.sol` — L1 CCIP Receiver
`[scope:contracts] [gate:required] [check:full]`

L1 contract on Ethereum mainnet. Read Plan §4.2.

Key implementation details:
- Extends `CCIPReceiver` (from `@chainlink/contracts-ccip`)
- Constructor: `_ccipRouter`, `_arbitrumChainSelector`, `_l2Sender`, `_ensRegistry`, `_ensResolver`, `_baseNode`, `_owner`
- `_ccipReceive()`: verify source chain + sender, decode message, dispatch register/release
- `_register()`: idempotent — skip silently if name already taken on L1 (handles race conditions)
- `_setENSRecords()`: `setSubnodeOwner(BASE_NODE, label, this)` → `setResolver(node, resolver)` → `setAddr(node, owner)`
- `_release()`: verify ownership, clear records
- Admin: `setL2Sender()`, `adminReleaseName()`, `adminRegister()`
- Needs `src/interfaces/IENS.sol` with `IENS` and `IENSResolver` interfaces

ENS addresses (mainnet):
- Registry: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- Public Resolver: `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63`

#### Task 5: Modify existing contracts for ENS integration
`[scope:contracts] [gate:required] [check:full]`

Multiple files — read Plan §4.3, §4.4, §4.5, §4.7.

**`src/tokens/Garden.sol`** (§4.3):
- Add `IGreenGoodsENS public ensModule` storage variable
- Add `slug` field to `GardenConfig` struct
- Add `setENSModule(address)` — `onlyOwner`
- Add ENS call in `_initializeGardenModules()` with graceful degradation (try/catch)
- Make `mintGarden()` and `batchMintGardens()` `payable`
- Reduce `__gap` from `[41]` to `[40]`
- Add `ENSModuleUpdated` event

**`src/interfaces/IGardenAccount.sol`** (§4.4):
- Add `slug` to `InitParams` struct

**`src/accounts/Garden.sol`** (§4.5):
- Add `string public slug` storage
- Set `slug` in `initialize()`
- Reduce `__gap` from `[34]` to `[33]`

**`src/modules/Hats.sol`** (§4.7 — CRITICAL):
- In `_grantRole()`, after minting the per-garden role hat, add protocol hat auto-mint:
  ```solidity
  if (protocolGardenersHatId != 0) {
      if (!hats.isWearerOfHat(account, protocolGardenersHatId)) {
          try hats.mintHat(protocolGardenersHatId, account) {} catch {}
      }
  }
  ```
- This is ~5 LOC. `protocolGardenersHatId` already exists at slot 160.

#### Task 6: Write unit tests for ENS contracts
`[scope:contracts] [gate:required] [check:full]`

~30 tests across 3 test files. Reference Plan §11, Phase 1, item 10.

**`test/unit/GreenGoodsENS.t.sol`** (L2 Sender):
- Slug validation: min/max length, invalid chars, leading/trailing hyphens, consecutive hyphens
- `claimName()`: success with valid hat, revert `NotProtocolMember` without hat
- `claimNameSponsored()`: success, revert `InsufficientFee` when contract empty
- `registerGarden()`: success via authorized caller, revert `NotAuthorizedCaller`
- `releaseName()`: success, cooldown enforcement
- L2 cache: `NameTaken` on duplicate, `AlreadyHasName` for double-claim
- Fee estimation: `getRegistrationFee()` returns non-zero
- CCIP message encoding: verify `abi.encode` format

**`test/unit/GreenGoodsENSReceiver.t.sol`** (L1 Receiver):
- `_ccipReceive()`: valid registration, valid release
- Source chain verification: revert `UnauthorizedSourceChain`
- Sender verification: revert `UnauthorizedSender`
- Idempotent: skip silently on duplicate registration
- Admin: `adminReleaseName()`, `adminRegister()`
- ENS record verification (mock ENS)

**`test/integration/CCIPENSFlow.t.sol`** (Mock CCIP end-to-end):
- Use mock CCIP routers on Anvil (no real CCIP)
- Full flow: mint garden → owner has protocol hat → can claim name
- Full flow: join garden → gardener hat + protocol hat → can claim name
- Garden ENS registration via `_initializeGardenModules()`

**Protocol hat auto-mint tests** (in existing `test/unit/HatsLib.t.sol` or new):
- `grantRole()` → protocol hat minted for new member
- `grantRole()` for member who already wears protocol hat → no duplicate mint
- Multiple gardens: join garden A → hat; join garden B → still has hat (idempotent)

Use mock factories and patterns from existing tests (see `test/helpers/`).

#### Task 7: Write deployment script and delete old files
`[scope:contracts] [gate:required] [check:quick]`

- Create `script/deploy-ens.ts` for L1 + L2 deployment (reference Plan §7)
- Update `deployments/{chainId}-latest.json` format to include `greenGoodsENS` and `greenGoodsENSReceiver`
- Delete `src/registries/Gardener.sol` and `src/interfaces/IGardenerRegistry.sol` (replaced)
- Update any test files that import deleted files

#### Task 8: Indexer schema and event handlers
`[scope:indexer] [gate:advisory] [check:quick]`

Reference Plan §9.

- Add `slug: String` and `ensStatus: String` fields to `Garden` entity in `schema.graphql`
- Add new `ENSRegistration` entity with fields: `id`, `slug`, `owner`, `nameType`, `ccipMessageId`, `status`, `registeredAt`
- Add `NameRegistrationSent` event handler in `src/EventHandlers.ts`
- Update `config.yaml` with GreenGoodsENS contract address (use placeholder until deployed)
- Update indexer tests

---

### Middleware Lane (shared package) — `middleware-driver` / `middleware-observer`

> **Blocked by**: Chain lane Tasks 1-5 (needs compiled ABIs for hook types)

#### Task 9: Add ENS types and query keys
`[scope:middleware] [gate:advisory] [check:quick]`

- Add `ENSRegistrationData` type to `src/types/domain.ts`
- Extend `queryKeys.ens` namespace in `src/hooks/query-keys.ts` with:
  - `registrationStatus(slug)`
  - `availability(slug)`
  - `protocolMembership(address)`
- Reference: Plan §8.7

#### Task 10: Add slug validation utility
`[scope:middleware] [gate:advisory] [check:quick]`

- Add `validateSlug()` to `src/utils/blockchain/ens.ts`
- Mirror contract validation: 3-50 chars, `a-z0-9-`, no leading/trailing/consecutive hyphens
- Export from barrel (`src/utils/index.ts` → `src/index.ts`)
- Reference: Plan §8.6

#### Task 11: Implement `useENSClaim` mutation hook
`[scope:middleware] [gate:required] [check:full]`

- Create `src/hooks/ens/useENSClaim.ts`
- Detect auth mode: passkey → `claimNameSponsored()`, wallet → `claimName{value: fee}()`
- On success: seed `queryKeys.ens.registrationStatus` with pending data
- On error: `parseContractError()` → `ENS_ERROR_MESSAGES` mapping → `toast.error()`
- Use `logger.error()`, not `console.error()`
- Export from hooks barrel
- Reference: Plan §8.1

#### Task 12: Implement `useENSRegistrationStatus` hook
`[scope:middleware] [gate:required] [check:full]`

- Create `src/hooks/ens/useENSRegistrationStatus.ts`
- Query L1 receiver for authoritative status, fall back to L2 cache for pending detection
- Adaptive polling via `refetchInterval`: 60s for first 10 min, then 30s, stop after 25 min
- Return data must be fully serializable (IndexedDB persistence via `PersistQueryClientProvider`)
- Reference: Plan §8.3

#### Task 13: Implement `useProtocolMemberStatus` hook
`[scope:middleware] [gate:advisory] [check:quick]`

- Create `src/hooks/ens/useProtocolMemberStatus.ts`
- Read `protocolHatId` from ENS contract, then check `hats.isWearerOfHat()`
- `staleTime: STALE_TIME_RARE` (5 min) — membership changes infrequently
- Reference: Plan §8.4

#### Task 14: Implement `useSlugForm` and `useSlugAvailability`
`[scope:middleware] [gate:required] [check:full]`

- Create `src/hooks/ens/useSlugForm.ts` with Zod schema (mirror contract rules exactly)
- Create `src/hooks/ens/useSlugAvailability.ts` with 300ms debounced RPC check
- Three-tier validation: sync Zod → debounced RPC → on-submit recheck
- Auto-suggest helper: `userName → slug` (lowercase, strip invalid chars, collapse hyphens)
- Reference: Plan §8.5

#### Task 15: Remove ENS state from auth machine
`[scope:middleware] [gate:advisory] [check:quick]`

- Remove `claiming_ens` state from `src/workflows/authMachine.ts`
- Remove `CLAIM_ENS` event from auth machine
- Remove `claimENSService` from `src/workflows/authServices.ts`
- Remove `claimENS` from `AuthContextType` if present
- Reference: Plan §8.1 ("Auth machine cleanup")

#### Task 16: Export ENS hooks from barrel
`[scope:middleware] [gate:advisory] [check:quick]`

- Create `src/hooks/ens/index.ts` barrel
- Add to `src/hooks/index.ts`
- Add to `src/index.ts`
- Verify: `import { useENSClaim, useSlugForm, useSlugAvailability } from '@green-goods/shared'`

---

### App Lane (client + admin) — `app-driver` / `app-observer`

> **Blocked by**: Middleware lane Tasks 11-14 (needs hooks to build views)

#### Task 17: Add slug field to garden creation form (admin)
`[scope:admin] [gate:advisory] [check:full]`

- Add slug input to `packages/admin/src/views/Actions/CreateAction.tsx` or garden creation view
- Auto-suggest slug from garden name (lowercase, strip invalid chars)
- Use `useSlugForm()` for validation, `useSlugAvailability()` for availability check
- Show inline availability status: checking (spinner) / available (green check) / taken (red x)
- Make mint transaction `payable` — get CCIP fee via `getRegistrationFee()`, show to user
- Mobile input: `inputMode="text"`, `autoCapitalize="none"`
- Reference: Plan §6.1, §8.2

#### Task 18: Add personal ENS claim to profile settings (client)
`[scope:client] [gate:advisory] [check:full]`

- Add ENS claim section to profile/settings view
- Gate visibility: only show if `useProtocolMemberStatus()` returns `true` AND user has no existing name
- Use `useSlugForm()` + `useSlugAvailability()` for the slug input
- Submit calls `useENSClaim().mutateAsync({ slug })`
- Offline gate: disable submit when offline (use existing `useOffline()` hook), show "Go online to claim"
- Reference: Plan §6.2 (Client PWA — Sponsored flow)

#### Task 19: Add personal ENS claim to admin dashboard
`[scope:admin] [gate:advisory] [check:quick]`

- Same claim form as client (use shared hooks)
- Wallet users pay their own CCIP fee — show fee estimate before confirming
- Reference: Plan §6.2 (Admin Dashboard — Self-Funded flow)

#### Task 20: Add ENS registration progress timeline component
`[scope:client] [gate:advisory] [check:full]`

- Build progress timeline for CCIP delivery tracking (~15-20 min wait)
- Uses `useENSRegistrationStatus()` for adaptive polling
- Three states: pending (pulsing), active (green check), timed out (warning at 25 min)
- Show CCIP message ID (copyable via existing `AddressCopy` pattern)
- Show "Track on Explorer" link (opens in system browser, not PWA)
- Mobile-friendly: primary timeline, secondary explorer link
- Reference: Plan §6.3

#### Task 21: Add ENS claim discovery surfaces
`[scope:client] [gate:advisory] [check:quick]`

- Profile header: "Claim your .greengoods.eth name" badge (visible if eligible + no name)
- One-time toast after joining first garden: "You can now claim your greengoods.eth name!"
- Use profile Account section for full claim form placement
- Reference: Plan §8.1 (Discovery section)

#### Task 22: Add service worker notification for ENS completion
`[scope:client] [gate:advisory] [check:quick]`

- When `useENSRegistrationStatus` detects status change `pending → active`, trigger SW notification
- Notification text: "Your name {slug}.greengoods.eth is now active!"
- Only fire once per registration (guard with query cache)
- Reference: Plan §6.3 (Push notification)

---

## Integration Validation

After all lanes complete, lead runs integration checks:

1. **Build all packages**: `bun build` (root — respects dependency order)
2. **Lint**: `bun format && bun lint`
3. **Tests**: `bun run test` (all packages)
4. **Contract-specific**: `cd packages/contracts && bun run test`
5. **Type check**: Verify no `any` casts on ENS types, `Address` type used for all addresses
6. **Query key check**: Verify `queryKeys.ens.*` used consistently (no inline strings)
7. **Barrel export check**: All ENS hooks importable from `@green-goods/shared`
8. **Architectural rules**: Check Rules 1, 4, 5, 7, 8, 11, 12 from `.claude/rules/architectural-rules.md`

---

## Key Architecture Decisions (Non-Negotiable)

These decisions are **final** — do not re-litigate during implementation:

1. **Chainlink CCIP** for cross-chain messaging (not LayerZero, not direct L1)
2. **Hats Protocol** for membership verification (not custom mapping, not Kernel detection)
3. **`claimName()` / `claimNameSponsored()`** — role-agnostic, any protocol member
4. **Decoupled from XState** — standalone `useMutation`, NOT auth machine state
5. **Three-tier slug validation** — sync Zod → debounced RPC → on-submit
6. **Online-only** — NOT queued via job queue
7. **Graceful degradation** — ENS failure MUST NOT revert garden mint

---

## Reference Files

Read these files before starting implementation:

| File | Purpose |
|------|---------|
| `.plans/ens-integration.md` | **Complete plan** — full Solidity code, TypeScript code, deployment steps |
| `packages/contracts/src/tokens/Garden.sol` | GardenToken — where ENS module gets added |
| `packages/contracts/src/accounts/Garden.sol` | GardenAccount — where `slug` storage goes |
| `packages/contracts/src/modules/Hats.sol` | HatsModule — where protocol hat auto-mint goes |
| `packages/contracts/src/interfaces/IGardenAccount.sol` | InitParams struct to modify |
| `packages/contracts/test/helpers/DeploymentBase.sol` | Test deployment base — needs CCIP mock setup |
| `packages/shared/src/hooks/query-keys.ts` | Query key patterns to extend |
| `packages/shared/src/utils/blockchain/ens.ts` | Existing ENS utils to extend |
| `CLAUDE.md` | Project architecture, patterns, anti-patterns |
| `.claude/rules/architectural-rules.md` | 13 rules to enforce |
