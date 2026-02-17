# Arbitrum Production Release Plan — 4 Core Flows

**Created**: 2026-02-16
**Target Chain**: Arbitrum (42161)
**Deadline**: 2026-02-17
**Branch**: `feature/ens-integration`

## Objective

Ensure these 4 core actions are fully tested, functional, and have optimal UX:

1. **Creating a garden and adding members** (Admin)
2. **Making work submissions** (PWA/Client)
3. **Depositing funds into vaults** (Admin)
4. **Making assessments to kickoff a garden** (Admin)

---

## Current Arbitrum Deployment State

| Contract | Status | Address |
|----------|--------|---------|
| `gardenToken` | Deployed | `0x0a7Ca3203f25c1c028D54C19789e83b401383F92` |
| `actionRegistry` | Deployed | `0x042D2b082Cdd4DCBc0aD9dD7c631BC2e45B05cB1` |
| `workResolver` | Deployed | `0x9acf5C0dEc2f8134AC8C68a41bE3eB659e8430b7` |
| `workApprovalResolver` | Deployed | `0x0B1Ef706D967820784928c850EFF69E078bcb419` |
| `assessmentResolver` | Deployed | `0xDD3567060cEA024dF9D9950A7Af3D8e1F9dB1216` |
| `rootGarden` | Deployed | `0xB294c561616BA04BEA5c76fAa3Ba43764e41393f` (tokenId 1) |
| `hatsModule` | **MISSING** | `0x000...` |
| `octantModule` | **MISSING** | `0x000...` |
| `yieldSplitter` | **MISSING** | `0x000...` |
| `octantFactory` | **MISSING** | `0x000...` |
| `gardensModule` | **MISSING** | `0x000...` |
| `cookieJarModule` | **MISSING** | `0x000...` |
| `guardian` | **MISSING** | `0x000...` |
| `assessmentSchemaUID` | **NOT REGISTERED** | `0x000...` |
| `workApprovalSchemaUID` | **NOT REGISTERED** | `0x000...` |
| `workSchemaUID` | Registered | `0x8b8d...5a16` |

### Blockers per Flow

| Flow | Blocker | Severity |
|------|---------|----------|
| **Garden Creation + Members** | `hatsModule` = zero -> `createGardenHatTree()` reverts | **CRITICAL** |
| **Work Submissions** | Works today (workSchemaUID registered) | None |
| **Vault Deposits** | `octantModule` + `yieldSplitter` + `octantFactory` = zero | **CRITICAL** |
| **Assessments** | `assessmentSchemaUID` = zero -> EAS rejects attestation | **CRITICAL** |

**Key insight**: All 3 blockers resolve with a single `core --broadcast --update-schemas` deployment (preceded by `octant-factory`). The `DeploymentBase._deployCoreContracts()` deploys all 14+ modules and wires them together in one atomic script. CREATE2 determinism preserves existing contract addresses.

---

## Phase 1: Sequential Deployment (Steps 1-4)

> Deployment must complete before teams can verify. These steps are sequential.

### Step 1: Contract Verification (30 min)

```bash
# Fast verification - build + lint + unit tests
cd packages/contracts && bun run verify:contracts:fast
```

**Pass criteria**: All unit tests pass, build succeeds, no lint errors.

---

### Step 2: Sepolia Test Deployment (1 hour)

Deploy the full stack to Sepolia first to validate the deployment script works E2E before touching Arbitrum.

```bash
# 2a. Deploy OctantFactory to Sepolia
bun script/deploy.ts octant-factory --network sepolia --broadcast

# 2b. Deploy full core stack + register all schemas
bun script/deploy.ts core --network sepolia --broadcast --update-schemas

# 2c. Verify deployment artifacts
cat packages/contracts/deployments/11155111-latest.json | jq '{
  hatsModule, octantModule, yieldSplitter, octantFactory,
  schemas: { assessmentSchemaUID: .schemas.assessmentSchemaUID,
             workApprovalSchemaUID: .schemas.workApprovalSchemaUID }
}'
```

**Pass criteria**: All addresses non-zero, all 3 schema UIDs non-zero.

**Then smoke test on Sepolia**:
1. Create a garden via admin UI -> verify tx succeeds
2. Submit work via client PWA -> verify EAS attestation created
3. Deposit test tokens into vault -> verify shares minted
4. Create assessment via admin UI -> verify EAS attestation created

---

### Step 3: Arbitrum Production Deployment (1 hour)

Only proceed after Sepolia smoke test passes.

```bash
# 3a. Deploy OctantFactory to Arbitrum
bun script/deploy.ts octant-factory --network arbitrum --broadcast

# 3b. Set OCTANT_FACTORY_ADDRESS in .env to the deployed address

# 3c. Deploy core + schemas to Arbitrum
bun script/deploy.ts core --network arbitrum --broadcast --update-schemas --override-sepolia-gate

# 3d. Verify ALL addresses are now non-zero
cat packages/contracts/deployments/42161-latest.json | jq '{
  hatsModule, octantModule, yieldSplitter, octantFactory, guardian,
  gardensModule, cookieJarModule,
  schemas: {
    assessmentSchemaUID: .schemas.assessmentSchemaUID,
    workApprovalSchemaUID: .schemas.workApprovalSchemaUID,
    workSchemaUID: .schemas.workSchemaUID
  }
}'

# 3e. Verify module wiring on-chain
ARBITRUM_RPC="https://arb1.arbitrum.io/rpc"
cast call 0x0a7Ca3203f25c1c028D54C19789e83b401383F92 "hatsModule()(address)" --rpc-url $ARBITRUM_RPC
cast call 0x0a7Ca3203f25c1c028D54C19789e83b401383F92 "octantModule()(address)" --rpc-url $ARBITRUM_RPC
cast call 0x0a7Ca3203f25c1c028D54C19789e83b401383F92 "actionRegistry()(address)" --rpc-url $ARBITRUM_RPC
```

**Pass criteria**: All wiring calls return non-zero addresses matching deployment JSON.

---

### Step 4: Post-Deployment Configuration (30 min)

```bash
# 4a. Rebuild indexer with new Arbitrum addresses
cd packages/indexer && bun build

# 4b. Verify indexer config was auto-updated
grep -A2 "hatsModule\|octantModule\|yieldSplitter" packages/indexer/config.yaml

# 4c. Rebuild shared + client + admin (to pick up new deployment JSON)
bun build

# 4d. Per-garden vault configuration (for existing rootGarden)
# Set donation address so yield flows to YieldSplitter
cast send <octantModule> "setDonationAddress(address,address)" \
  0xB294c561616BA04BEA5c76fAa3Ba43764e41393f \
  <yieldSplitter_address> \
  --rpc-url $ARBITRUM_RPC \
  --private-key $DEPLOYER_KEY
```

**Why donation address matters**: Without it, `harvest()` succeeds but shares don't flow to YieldSplitter. The admin UI (Vault.tsx:110-113) shows a warning banner for this case.

---

## Phase 2: Team-Based Parallel Readiness Check (Step 5)

> After deployment completes, launch a 3-lane agent team for parallel verification.
> Each lane pair validates all 4 flows within their package scope simultaneously.

### Team Topology

```
                    ┌─────────────────────┐
                    │   LEAD (you)        │
                    │   Adversarial       │
                    │   integrator        │
                    └──────┬──────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │ CHAIN LANE  │ │  MIDDLEWARE  │ │  APP LANE   │
    │             │ │    LANE     │ │             │
    │ driver:     │ │ driver:     │ │ driver:     │
    │  contracts  │ │  shared     │ │  admin +    │
    │  + indexer  │ │  hooks +    │ │  client UI  │
    │             │ │  modules    │ │             │
    │ observer:   │ │ observer:   │ │ observer:   │
    │  validates  │ │  validates  │ │  validates  │
    │  on-chain   │ │  types +    │ │  UX + a11y  │
    │  state      │ │  tests      │ │  + errors   │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### Lane Assignments

#### Chain Lane (contracts + indexer)

**Scope**: `[scope:contracts] [scope:indexer]`

| Task | Flow | Gate | Check | Description |
|------|------|------|-------|-------------|
| C1: Garden mint contracts | Garden Creation | `[gate:required]` | `[check:full]` | Run `GardenMintingIntegration`, `GardenTokenTest`, `HatsModuleTest`. Verify `mintGarden()` -> `createGardenHatTree()` -> `grantRole()` chain. Verify `_initializeGardenModules()` try-catch paths. |
| C2: Work resolver validation | Work Submissions | `[gate:required]` | `[check:full]` | Run `WorkResolverTest`. Verify 6-step onAttest validation (schema, identity, fields, action, timing, domain). Verify all error types revert correctly. |
| C3: Vault + yield contracts | Vault Deposits | `[gate:required]` | `[check:full]` | Run `YieldSplitterTest`, `YieldFlowE2E`. Verify OctantModule.onGardenMinted creates vaults. Verify harvest -> registerShares -> splitYield 3-way routing. Verify fallback paths (stranded yield, escrow). |
| C4: Assessment resolver | Assessments | `[gate:required]` | `[check:full]` | Run `AssessmentResolverTest`. Verify 5-step onAttest validation (schema, identity, fields, domain, GAP). Verify non-revocability (onRevoke returns false). |
| C5: E2E workflow | All Flows | `[gate:required]` | `[check:full]` | Run `bun run test:e2e:workflow`. Verify full protocol stack works together through DeploymentBase. |
| C6: Deployment JSON integrity | All Flows | `[gate:required]` | `[check:quick]` | Verify `42161-latest.json` has all non-zero addresses. Verify schema UIDs match on-chain. Verify module wiring via cast calls. |
| C7: Indexer event coverage | All Flows | `[gate:advisory]` | `[check:quick]` | Verify `config.yaml` has correct addresses for all deployed modules. Verify event handler coverage for GardenMinted, WorkAttested, VaultCreated, AssessmentAttested. |

**Driver commands**:
```bash
cd packages/contracts && bun run test --match-contract GardenMintingIntegration
cd packages/contracts && bun run test --match-contract GardenTokenTest
cd packages/contracts && bun run test --match-contract HatsModuleTest
cd packages/contracts && bun run test --match-contract WorkResolverTest
cd packages/contracts && bun run test --match-contract YieldSplitterTest
cd packages/contracts && bun run test --match-contract YieldFlowE2E
cd packages/contracts && bun run test --match-contract AssessmentResolverTest
cd packages/contracts && bun run test:e2e:workflow
```

**Observer validation**:
- Verify deployment JSON addresses match on-chain state via `cast call`
- Verify schema UIDs are registered with EAS SchemaRegistry
- Cross-check indexer config.yaml against deployment JSON

---

#### Middleware Lane (shared hooks + modules)

**Scope**: `[scope:shared]`

| Task | Flow | Gate | Check | Description |
|------|------|------|-------|-------------|
| M1: Garden creation workflow | Garden Creation | `[gate:required]` | `[check:full]` | Run shared garden tests. Verify `useCreateGardenWorkflow` XState machine transitions (idle->collecting->review->submitting->success). Verify `useCreateGardenStore` validation (details, team, review steps). Verify `useJoinGarden` dual-auth + optimistic updates. |
| M2: Work submission pipeline | Work Submissions | `[gate:required]` | `[check:full]` | Run shared work tests. Verify `useWorkMutation` auth branching (wallet online, wallet offline, passkey). Verify `submitWorkToQueue()` job creation + deduplication. Verify `simulateWorkSubmission()` pre-flight caching. Verify job queue flush + backoff. |
| M3: Vault hooks + data module | Vault Deposits | `[gate:required]` | `[check:full]` | Run shared yield tests. Verify `useVaultDeposit` approve-then-deposit flow. Verify `useVaultPreview` multicall. Verify `getGardenVaults()` GraphQL queries. Verify `formatTokenAmount()` formatting. |
| M4: Assessment workflow + encoders | Assessments | `[gate:required]` | `[check:full]` | Run shared assessment tests. Verify `useCreateAssessmentWorkflow` XState machine. Verify `encodeAssessmentData()` IPFS upload + EAS encoding. Verify `getGardenAssessments()` parser handles all field types. Verify zero-schemaUID returns empty array. |
| M5: Type safety audit | All Flows | `[gate:required]` | `[check:quick]` | Verify all `Address` types used (not `string`) for Ethereum addresses. Verify `WorkDraft`, `GardenAssessment`, `VaultDeposit`, `GardenConfig` type definitions complete. Verify barrel exports from `@green-goods/shared`. |
| M6: Error handling consistency | All Flows | `[gate:required]` | `[check:quick]` | Verify `parseContractError()` maps all contract errors. Verify `USER_FRIENDLY_ERRORS` covers Garden, Work, Vault, Assessment error names. Verify no empty catch blocks in hooks/modules. |
| M7: Query key stability | All Flows | `[gate:advisory]` | `[check:quick]` | Verify `queryKeys` used for all 4 flows. Verify no unstable object references in query keys. Verify invalidation patterns correct after mutations. |

**Driver commands**:
```bash
cd packages/shared && bun run test -- --grep "createGarden"
cd packages/shared && bun run test -- --grep "useJoinGarden"
cd packages/shared && bun run test -- --grep "work-submission"
cd packages/shared && bun run test -- --grep "work-approval"
cd packages/shared && bun run test -- --grep "yield"
cd packages/shared && bun run test -- --grep "assessment"
cd packages/shared && bun run test
```

**Observer validation**:
- Verify no `console.log/warn/error` in production code (Rule 12)
- Verify no deep imports bypassing barrel (Rule 11)
- Verify all setTimeout/setInterval use utility hooks (Rule 1)
- Verify all useEffect with async have isMounted guards (Rule 3)

---

#### App Lane (admin + client UI)

**Scope**: `[scope:admin] [scope:client]`

| Task | Flow | Gate | Check | Description |
|------|------|------|-------|-------------|
| A1: Garden creation wizard | Garden Creation | `[gate:required]` | `[check:full]` | Verify DetailsStep: name, location, slug validation, ENS availability check, community token ENS resolution, banner upload. Verify TeamStep: address input, ENS resolution, add/remove gardeners+operators, cross-check prevention. Verify ReviewStep: all fields displayed. Verify submit triggers `mintGarden()`. |
| A2: Work submission PWA | Work Submissions | `[gate:required]` | `[check:full]` | Verify action list loads from ActionRegistry. Verify dynamic form renders from action config. Verify image selection + preview + validation (10MB max). Verify submission progress stages display. Verify offline indicator + retry button. Verify work approval drawer (operator mode). |
| A3: Vault dashboard | Vault Deposits | `[gate:required]` | `[check:full]` | Verify Vault.tsx summary cards (TVL, harvest count, depositors). Verify DepositModal: amount input, share preview, approve+deposit flow. Verify WithdrawModal: share input, asset preview, redeem flow. Verify donation address warning banner. Verify VaultEventHistory timeline. |
| A4: Assessment wizard | Assessments | `[gate:required]` | `[check:full]` | Verify StrategyKernelStep: title, diagnosis, SMART outcomes builder, Cynefin selector. Verify DomainActionStep: domain picker, action selection. Verify SdgHarvestStep: SDG targets, date range picker. Verify form draft localStorage persistence. Verify submit -> IPFS upload -> EAS attestation. |
| A5: UX polish audit | All Flows | `[gate:required]` | `[check:full]` | Loading spinners/skeletons during tx confirmation. Toast behavior (appear, dismiss, no stacking). Error messages are user-friendly (no hex/raw contract errors). Role-based visibility (operators vs gardeners). |
| A6: Error boundary coverage | All Flows | `[gate:advisory]` | `[check:quick]` | Verify error boundaries wrap all 4 flow entry points. Verify contract error parsing shows friendly messages. Verify network error shows offline indicator. |
| A7: Build verification | All Flows | `[gate:required]` | `[check:quick]` | `cd packages/admin && bun build` succeeds. `cd packages/client && bun build` succeeds. No TypeScript errors. No missing imports from deployment JSON changes. |

**Driver commands**:
```bash
cd packages/admin && bun run test
cd packages/admin && bun build
cd packages/client && bun run test
cd packages/client && bun build
cd packages/admin && bun lint
cd packages/client && bun lint
```

**Observer validation**:
- Verify provider nesting order matches Rule 13
- Verify no hooks defined outside `@green-goods/shared` (Hook Boundary)
- Verify no hardcoded addresses (use deployment artifacts)
- Verify Zustand selectors are granular (Rule 6)

---

### Team Execution Protocol

#### Launch Command

```
/teams preflight
```

Or manually spawn the team:

```
Team: release-readiness
Lead: adversarial integrator (you)

Lane 1 — Chain:
  chain-driver:    Run contract tests C1-C5, verify deployment C6
  chain-observer:  Validate on-chain state, cross-check indexer C7

Lane 2 — Middleware:
  middleware-driver:    Run shared tests M1-M4, audit types M5
  middleware-observer:  Enforce architectural rules M6-M7

Lane 3 — App:
  app-driver:    Build + test admin/client A1-A4, A7
  app-observer:  UX audit A5-A6, rule compliance
```

#### Parallel Execution Flow

```
                    Time →
Chain Lane:     ║ C1 C2 C3 C4 ║ C5 ║ C6 C7 ║ → Report
                ║  (parallel)  ║E2E ║verify ║
                ║              ║    ║       ║
Middleware:     ║ M1 M2 M3 M4 ║ M5 M6 M7  ║ → Report
                ║  (parallel)  ║  (audit)  ║
                ║              ║           ║
App Lane:       ║ A1 A2 A3 A4 ║ A5 A6 ║ A7║ → Report
                ║  (parallel)  ║(audit)║bld║
                ║              ║       ║   ║
Lead:           ║   monitor    ║ cross-lane integration check ║ → VERDICT
```

All 3 lanes run **simultaneously**. Each lane works through its tasks in parallel where possible.

#### Lead Integration Checks (After All Lanes Report)

The lead performs **cross-lane validation** that no single lane can check:

| Integration Check | Lanes | What |
|---|---|---|
| IC1: Contract<->Hook ABI match | Chain + Middleware | Verify shared ABIs match deployed contract interfaces. Verify `GardenAccountABI`, `GardenTokenABI`, `OctantModuleABI` in `contracts.ts` are current. |
| IC2: Hook<->UI data flow | Middleware + App | Verify hooks return data in the shape UI components expect. Verify query keys used in hooks match invalidation patterns in mutations. |
| IC3: Deployment JSON<->Config | Chain + App | Verify `42161-latest.json` addresses are correctly consumed by `getEASConfig()`, `getDeploymentConfig()`. Verify zero-address graceful degradation in all 4 flows. |
| IC4: Indexer<->GraphQL queries | Chain + Middleware | Verify indexer `schema.graphql` entities match GraphQL queries in `modules/data/`. Verify new vault/assessment entities are indexed. |
| IC5: Error path coverage | All 3 | Verify contract errors (Chain) are parsed by `parseContractError()` (Middleware) and displayed with user-friendly messages (App). End-to-end error path for each flow. |

#### Verdict Criteria

| Verdict | Criteria |
|---------|----------|
| **PASS** | All `[gate:required]` tasks pass across all 3 lanes. All 5 integration checks pass. No unresolved blockers. |
| **CONDITIONAL PASS** | All `[gate:required]` pass. Some `[gate:advisory]` have minor issues with documented workarounds. |
| **FAIL** | Any `[gate:required]` task fails. Any integration check reveals data flow breakage. Blocker without workaround. |

---

## Phase 3: Fix & Revalidate (If Needed)

If any lane reports failures:

1. **Triage**: Lead categorizes failures by severity and assigns to appropriate lane
2. **Fix**: Driver implements fix, observer validates
3. **Cross-lane recheck**: If fix touches shared boundaries, affected lanes re-run integration checks
4. **Re-verdict**: Lead issues updated PASS/FAIL

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CREATE2 collision with existing contracts | Low | High | Same salt + same bytecode = same address; changed bytecode = new address |
| OctantFactory deployment fails | Medium | High | Deploy on Sepolia first; verify AaveV3 strategy addresses |
| Assessment IPFS upload fails | Medium | Medium | Verify `VITE_STORACHA_KEY` env var; test upload before demo |
| Indexer misses new events | Low | Medium | Rebuild indexer after deploy; check config.yaml has new addresses |
| Deployer wallet insufficient funds | Medium | High | Check ETH balance on Arbitrum; core deploy is ~14+ contract creates |
| Legacy gardenToken rejects new modules | Low | High | UUPS proxy should accept new module setters; verify function exists |
| Team lane finds cross-package breakage | Medium | High | Lead integration checks IC1-IC5 catch boundary mismatches |

---

## Timeline Summary

| Phase | Duration | What |
|-------|----------|------|
| **Phase 1** | | |
| Step 1: Contract verification | 30 min | `verify:contracts:fast` |
| Step 2: Sepolia test deploy | 1 hour | Full stack + smoke test |
| Step 3: Arbitrum deploy | 1 hour | OctantFactory + Core + schemas |
| Step 4: Post-deploy config | 30 min | Indexer rebuild, garden config |
| **Phase 2** | | |
| Step 5: Team readiness (parallel) | 45 min | 3 lanes x 7 tasks each, simultaneous |
| Step 5b: Lead integration checks | 15 min | 5 cross-lane checks |
| Step 5c: Verdict | 5 min | PASS / CONDITIONAL PASS / FAIL |
| **Phase 3** (if needed) | | |
| Fix & revalidate | 30-60 min | Triage, fix, re-check |
| **Total** | **~4-5 hours** | |

---

## Quick Reference Commands

```bash
# Verify contracts
cd packages/contracts && bun run verify:contracts:fast

# Deploy (Sepolia test)
bun script/deploy.ts octant-factory --network sepolia --broadcast
bun script/deploy.ts core --network sepolia --broadcast --update-schemas

# Deploy (Arbitrum production)
bun script/deploy.ts octant-factory --network arbitrum --broadcast
bun script/deploy.ts core --network arbitrum --broadcast --update-schemas --override-sepolia-gate

# Rebuild everything
bun build

# Start dev servers
bun dev

# Launch team readiness check
/teams preflight
```

---

## Status Tracking

### Phase 1: Deployment
- [ ] Step 1: Contract verification (`verify:contracts:fast`)
- [ ] Step 2: Sepolia test deployment
- [ ] Step 2b: Sepolia smoke test (4 flows)
- [ ] Step 3: Arbitrum production deployment
- [ ] Step 3b: Verify module wiring on-chain
- [ ] Step 4: Post-deployment configuration
- [ ] Step 4b: rootGarden donation address set

### Phase 2: Team Readiness Check
- [ ] Chain Lane: C1 Garden mint contracts
- [ ] Chain Lane: C2 Work resolver validation
- [ ] Chain Lane: C3 Vault + yield contracts
- [ ] Chain Lane: C4 Assessment resolver
- [ ] Chain Lane: C5 E2E workflow
- [ ] Chain Lane: C6 Deployment JSON integrity
- [ ] Chain Lane: C7 Indexer event coverage
- [ ] Middleware Lane: M1 Garden creation workflow
- [ ] Middleware Lane: M2 Work submission pipeline
- [ ] Middleware Lane: M3 Vault hooks + data module
- [ ] Middleware Lane: M4 Assessment workflow + encoders
- [ ] Middleware Lane: M5 Type safety audit
- [ ] Middleware Lane: M6 Error handling consistency
- [ ] Middleware Lane: M7 Query key stability
- [ ] App Lane: A1 Garden creation wizard UI
- [ ] App Lane: A2 Work submission PWA
- [ ] App Lane: A3 Vault dashboard
- [ ] App Lane: A4 Assessment wizard
- [ ] App Lane: A5 UX polish audit
- [ ] App Lane: A6 Error boundary coverage
- [ ] App Lane: A7 Build verification
- [ ] Lead: IC1 Contract<->Hook ABI match
- [ ] Lead: IC2 Hook<->UI data flow
- [ ] Lead: IC3 Deployment JSON<->Config
- [ ] Lead: IC4 Indexer<->GraphQL queries
- [ ] Lead: IC5 Error path coverage
- [ ] **VERDICT**: _pending_

### Phase 3: Fix & Revalidate (if needed)
- [ ] Triage failures
- [ ] Fix applied
- [ ] Re-verdict issued
