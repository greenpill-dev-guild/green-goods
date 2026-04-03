# Principles Audit Report — Admin Package — 2026-04-02

## Executive Summary
- **Package analyzed**: `packages/admin/src/` (204 files, ~29k LOC non-test)
- **Mode**: Single-agent, admin-targeted
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP
- **Previous audit**: 2026-04-02 full-codebase (re-verifying admin-relevant findings)

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | YELLOW | CreateAction.tsx (764 LOC) mixes form config, IPFS upload, submission, and 4-step rendering | M |
| O (OCP) | GREEN | Switch statements are on step indices (wizard pattern), not extensible type discriminators | — |
| L (LSP) | GREEN | No mock/implementation parity issues; shared hooks are substitutable | — |
| I (ISP) | GREEN | Admin imports targeted subsets from shared barrel; no fat local interfaces | — |
| D (DIP) | GREEN | All contract interactions via deployment artifacts; hooks from shared abstractions | — |
| DRY | YELLOW | Runner auth flow duplicated between Contracts and DeploymentRunnerPanel (identical pattern, 3 instances) | S |
| KISS | GREEN | Wizard flows are multi-step but each step is focused; no premature optimization | — |
| YAGNI | GREEN | No dead exports, no unused feature flags, no commented-out code blocks | — |
| SOC | YELLOW | Contracts view (613 LOC) embeds full runner auth + upgrade + job monitor in a single component | M |
| EDA | GREEN | Event listeners (online/offline, keydown, custom events) all have cleanup returns | — |
| ADR | RED | Inherited from full-codebase audit — no ADRs exist | M |
| C4 | GREEN | L4: barrel imports enforced, lazy routes, clean component tree | — |
| ACID | N/A | Admin has no IndexedDB or local persistence (uses shared persister) | — |
| BASE | GREEN | Optimistic invalidation after mutations uses queryKeys helpers | — |
| CAP | GREEN | No code assumes wrong CAP property; stale-time tiers from shared | — |

---

## Previous Findings Status

_Tracked from: 2026-04-02 full-codebase audit_

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| SOC4 | Hook definitions in admin views (useStepConfigs in CreateAssessment:33) | STILL OPEN | Annotated with exception comment, single-use view-local hook. Impact: LOW. |
| ADR1 | No architecture decision records exist | STILL OPEN | No ADRs created since first audit. Chronic: 2 cycles. |

---

## Findings by Principle

### SOLID

#### S1. CreateAction view mixes four concerns — MEDIUM
- **Principle**: SRP
- **File**: `packages/admin/src/views/Actions/CreateAction.tsx:1-764`
- **Issue**: This 764-line view contains inline form configuration (domain options, capitals options, step configs), IPFS upload logic (media + instructions), on-chain submission, and four distinct step renderers in a single switch statement. Each concern could change independently.
- **Evidence**: Lines 30-47 define domain options. Lines 273-330 define capital options inside `case 1`. Lines 104-161 contain async IPFS upload + registration logic. Lines 164-725 render four separate wizard steps.
- **Recommendation**: Extract each step into its own component file under `components/Action/CreateActionSteps/`. Move the IPFS upload + registration into a `useCreateActionSubmit()` hook in shared. The parent component should only wire the wizard shell.

#### S2. Endowments overview is a data-heavy monolith — MEDIUM
- **Principle**: SRP
- **File**: `packages/admin/src/views/Endowments/index.tsx:1-756`
- **Issue**: This 756-line view contains five inline sub-components (AssetApyCard, MyTrackedPositionCard, VaultUnharvestedYield), seven `useMemo` aggregation blocks, vault grouping logic, position tracking logic, and a complex render tree. The data aggregation dominates the file and mixes presentation with business logic.
- **Evidence**: Lines 214-296 contain four `useMemo` calls for data grouping, filtering, TVL calculation, and unique asset extraction. Lines 316-356 contain position aggregation logic. Sub-components (lines 46-188) are tightly coupled to parent state.
- **Recommendation**: Extract `useEndowmentAggregation()` hook into shared that returns `grouped`, `tvlByAsset`, `uniqueAssetAddresses`, `totalHarvests`. Extract `MyTrackedPositionCard` and `VaultUnharvestedYield` into separate files since they have their own hook calls.

#### S3. Contracts view combines contract listing, runner auth, and upgrade management — MEDIUM
- **Principle**: SRP
- **File**: `packages/admin/src/views/Contracts/index.tsx:1-613`
- **Issue**: This 613-line view handles three distinct responsibilities across three tabs: deployed contract listing, deploy-new redirect, and upgrade management with runner authentication, job selection, and log viewing. The upgrade tab alone handles auth, job submission, job selection, and log display.
- **Evidence**: Lines 80-100 manage runner auth state. Lines 117-184 contain three async functions for auth + upgrade operations. Lines 543-605 render job status and logs inline.
- **Recommendation**: The deployed contracts tab is clean. Extract the upgrade tab into a dedicated `ContractUpgradePanel` component (similar to how `DeploymentRunnerPanel` was already extracted for the deployment view). The auth flow can be shared between them.

### Code Quality (DRY / KISS / YAGNI / SOC)

#### DRY1. Runner auth connect pattern duplicated — MEDIUM
- **Principle**: DRY
- **File**: `packages/admin/src/views/Contracts/index.tsx:117-136` AND `packages/admin/src/views/Deployment/DeploymentRunnerPanel.tsx:125-146`
- **Issue**: The runner authentication flow (check wallet -> request challenge -> sign message -> verify signature -> toast) is implemented identically in two files. Both use the same error handling pattern with `instanceof Error` check and identical toast messages.
- **Evidence**: Contracts:117-136 and DeploymentRunnerPanel:125-146 are structurally identical: null-check wallet, try-catch with challenge/sign/verify, success toast, error toast with message extraction.
- **Recommendation**: Extract a `useOpsRunnerConnect()` hook in shared that encapsulates the challenge-sign-verify flow, returning `{ connect, isConnecting }`. Both views would call `connect()` instead of duplicating the flow.

#### DRY2. Auth-guard + job-submit-then-toast pattern repeated — LOW
- **Principle**: DRY
- **File**: `packages/admin/src/views/Contracts/index.tsx:138-184` AND `packages/admin/src/views/Deployment/DeploymentRunnerPanel.tsx:177-238`
- **Issue**: The pattern `if (!isAuthenticated) { toast.error(authRequired); return; } try { const job = await submitMutation(); setSelectedJobId(job.id); toast.success(); } catch { toast.error(message); }` appears 4 times across these two files. While the mutation call differs, the guard-submit-track-toast skeleton is identical.
- **Evidence**: Contracts lines 138-159 (runUpgradePlan) and 161-184 (runUpgradeFinalize) mirror DeploymentRunnerPanel lines 177-207 (runPlan) and 209-238 (runFinalize).
- **Recommendation**: Extract a `useOpsJobRunner()` hook that accepts a mutation function and returns a guarded runner. This is a lower priority than DRY1 since the mutations differ.

#### SOC1. DeploymentRunnerPanel has 28 props — MEDIUM
- **Principle**: SOC
- **File**: `packages/admin/src/views/Deployment/DeploymentRunnerPanel.tsx:44-83`
- **Issue**: The component accepts 28 props, spanning runner auth state, script execution, deployment configuration, deploy actions, minting toggle, and two render slots. This indicates the parent is threading too much state through a single component rather than composing focused sub-components.
- **Evidence**: Props interface at lines 44-83 lists 28 fields covering 6 distinct concerns: runner auth (7 props), scripts (3 props), deployment config (5 props), deploy actions (4 props), open minting (4 props), render slots (2 props).
- **Recommendation**: Split into focused sub-components: `RunnerAuthCard`, `ScriptsPanel`, `DeploymentConfigForm`, `DeployActionsCard`, `OpenMintingCard`. The parent Deployment view would compose these directly instead of threading all state through a single mega-component.

### Architecture (EDA / ADR / C4)

#### ADR1. No architecture decision records exist — HIGH (inherited)
- **Principle**: ADR
- **File**: N/A (absence of `.plans/adr/`)
- **Issue**: Inherited from full-codebase audit. No ADRs have been created since. Admin-specific decisions that need documentation: cockpit layout migration (sidebar -> floating toolbar), dual layout system (cockpit + legacy routes), command palette as primary navigation, role-adaptive toolbar permissions.
- **Evidence**: No `.plans/adr/` directory. These decisions are only discoverable through code archaeology.
- **Recommendation**: Same as full-codebase audit. For admin specifically, document: (1) cockpit layout decision, (2) role-adaptive permission model, (3) dual routing (cockpit primary + legacy garden detail routes).

### Data (ACID / BASE / CAP)

No admin-specific findings. Admin delegates all data persistence to shared (query cache persister, form stores). The persister configuration at `packages/admin/src/config/persister.ts` correctly wraps IDB with error handling.

---

## Priority Queue

Top fixes ordered by severity x effort:

1. **Extract runner auth connect into shared hook** — DRY — `Contracts/index.tsx` + `DeploymentRunnerPanel.tsx` — Effort: S
2. **Split CreateAction into step components + submit hook** — SRP — `views/Actions/CreateAction.tsx` — Effort: M
3. **Extract endowment aggregation into shared hook** — SRP — `views/Endowments/index.tsx` — Effort: M
4. **Split Contracts upgrade tab into own component** — SRP/SOC — `views/Contracts/index.tsx` — Effort: S
5. **Decompose DeploymentRunnerPanel into focused cards** — SOC — `views/Deployment/DeploymentRunnerPanel.tsx` — Effort: M
6. **Create admin-specific ADRs** — ADR — N/A — Effort: S

---

## Trend (admin across audits)

| Principle | 2026-04-02 (full) | 2026-04-02 (admin) |
|-----------|-------------------|-------------------|
| S (SRP) | YELLOW | YELLOW |
| O (OCP) | GREEN | GREEN |
| L (LSP) | GREEN | GREEN |
| I (ISP) | YELLOW | GREEN |
| D (DIP) | GREEN | GREEN |
| DRY | GREEN | YELLOW |
| KISS | YELLOW | GREEN |
| YAGNI | GREEN | GREEN |
| SOC | YELLOW | YELLOW |
| EDA | GREEN | GREEN |
| ADR | RED | RED |
| C4 | YELLOW | GREEN |
| ACID | GREEN | N/A |
| BASE | GREEN | GREEN |
| CAP | GREEN | GREEN |

---

## Next Steps

> **This audit is read-only.** To apply fixes, reply with:
> - `fix critical` — address Critical findings only
> - `fix all` — address all findings by priority
> - `fix DRY1, S1` — address specific findings by ID
