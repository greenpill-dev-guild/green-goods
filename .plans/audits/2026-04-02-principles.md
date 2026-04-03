# Principles Audit Report - 2026-04-02

## Executive Summary
- **Packages analyzed**: shared, contracts, client, admin, indexer, agent
- **Mode**: Single-agent (team mode unavailable — Agent tool not loadable)
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | YELLOW | JobQueue module at 916 LOC mixes queue logic, job execution, analytics, and cleanup | L |
| O (OCP) | GREEN | TransactionSender factory uses clean strategy pattern | — |
| L (LSP) | GREEN | TransactionSender implementations are substitutable | — |
| I (ISP) | YELLOW | Barrel export `index.ts` (912 LOC) exposes 160+ hooks to every consumer | M |
| D (DIP) | GREEN | Hooks depend on abstractions; deployment artifacts used over hardcoded addresses | — |
| DRY | GREEN | Minimal cross-package duplication; shared package is the canonical source | — |
| KISS | YELLOW | useMintHypercert (641 LOC) wires XState + IPFS + allowlist + contract calls in one hook | M |
| YAGNI | GREEN | Stub indexer handlers are intentionally minimal placeholders | — |
| SOC | YELLOW | Client Work view (873 LOC) mixes approval logic, metadata fetching, and UI rendering | M |
| EDA | GREEN | JobQueueEventBus is typed, listener cleanup is handled, SW lifecycle is solid | — |
| ADR | RED | Zero ADRs exist for major architectural decisions | M |
| C4 | YELLOW | L1/L2 clear from docs + CLAUDE.md; L3 component-level docs missing in shared | S |
| ACID | GREEN | IndexedDB writes use atomic transactions with proper abort-on-failure | — |
| BASE | GREEN | Optimistic updates with rollback implemented in garden operations | — |
| CAP | GREEN | Stale-time tiers correctly model the AP nature of the indexer layer | — |

---

## Previous Findings Status

_Tracked from: first audit_

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| — | No previous findings | N/A | First audit |

---

## Findings by Principle

### SOLID

#### S1. JobQueue module exceeds SRP boundaries — HIGH
- **Principle**: SRP
- **File**: `packages/shared/src/modules/job-queue/index.ts:1-916`
- **Issue**: The 916-line `JobQueue` class handles queue management, individual job execution (both work and approval types), exponential backoff, analytics/tracking, storage quota monitoring, orphaned job cleanup, and IPFS readiness checks. Each of these responsibilities has its own reason to change.
- **Evidence**: `executeWorkJob` (lines 84-155) and `executeApprovalJob` (lines 157-188) contain domain-specific execution logic. `processJob` (lines 416-626) mixes execution routing, retry policy, error tracking, and analytics. `cleanupOrphanedSyncedJobs` (lines 820-850) is a maintenance concern.
- **Recommendation**: Extract job executors into a `job-executors/` directory with a registry pattern. Extract analytics/tracking into a `job-analytics.ts` wrapper. Extract cleanup into `job-maintenance.ts`. The core `JobQueue` should only manage queue lifecycle (add, flush, get stats).

#### S2. Auth provider is monolithic — MEDIUM
- **Principle**: SRP
- **File**: `packages/shared/src/providers/Auth.tsx:1-620`
- **Issue**: The Auth provider manages XState machine lifecycle, session restoration, wallet tracking, external wallet state, embedded wallet state, passkey state, and multiple auth actions. At 620 LOC, it is the largest React provider but operates within a single concern (auth). The XState machine offloads most logic, but the provider still carries significant connector glue.
- **Evidence**: The context type (lines 62-107) exposes 25+ fields spanning passkey, wallet, embedded, and external wallet concerns.
- **Recommendation**: Consider splitting the context into `AuthStateContext` (read-only state) and `AuthActionsContext` (mutations), similar to the Work provider's split into WorkSelectionContext and WorkFormContext.

#### S3. IPFS module mixes upload, gateway resolution, and client initialization — MEDIUM
- **Principle**: SRP
- **File**: `packages/shared/src/modules/data/ipfs.ts:1-871`
- **Issue**: This 871-line module handles Storacha client initialization, Pinata fallback uploads, gateway URL resolution, avatar URL resolution, file uploads with retry, JSON uploads, and provider verification. These are at least four distinct concerns.
- **Evidence**: Module-level mutable state (`storachaClient`, `pinataJwt`, `gatewayUrl`) mixed with upload functions, resolution functions, and initialization functions.
- **Recommendation**: Extract into `ipfs/client.ts` (initialization), `ipfs/upload.ts` (upload operations), `ipfs/resolve.ts` (gateway resolution), and `ipfs/pinata.ts` (Pinata-specific logic).

#### I1. Fat barrel export surface — MEDIUM
- **Principle**: ISP
- **File**: `packages/shared/src/index.ts:1-912`
- **Issue**: The barrel export exposes 160+ hooks, 60+ component exports, and 100+ type exports. Every consumer (client, admin, agent) must parse this entire surface even when importing a single symbol. This creates coupling where changes to any export can trigger recompilation of all consumers.
- **Evidence**: Lines 150-425 export ~130 hooks. Lines 1-119 export ~60 components. Lines 430-600 export modules and types.
- **Recommendation**: Add sub-path exports to `package.json` (e.g., `@green-goods/shared/hooks`, `@green-goods/shared/components`, `@green-goods/shared/config`). This preserves the barrel for backward compatibility while enabling tree-shakeable imports for consumers that opt in.

### Code Quality (DRY / KISS / YAGNI / SOC)

#### KISS1. useMintHypercert hook orchestrates too many concerns — MEDIUM
- **Principle**: KISS
- **File**: `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:1-641`
- **Issue**: This single hook wires together XState machine orchestration, IPFS metadata upload, allowlist validation and Merkle tree generation, transaction construction, receipt polling, and signal pool registration. While each step is individually necessary, the hook's internal complexity is high.
- **Evidence**: Imports from 15+ modules (lines 1-63). Status mapping, machine wiring, and callback construction all in one file.
- **Recommendation**: The XState machine itself is already well-factored in `workflows/mintHypercert.ts`. The hook should delegate more to the machine's services and reduce inline callback definitions. Extract the `fromPromise` service factories into named modules.

#### SOC1. Client Work view mixes data fetching, approval logic, and rendering — MEDIUM
- **Principle**: SOC
- **File**: `packages/client/src/views/Home/Garden/Work.tsx:1-873`
- **Issue**: This 873-line view component contains metadata fetching logic, approval/rejection state management, optimistic status tracking, work queue retry logic, and rendering. The component should primarily compose shared hooks and render UI.
- **Evidence**: Lines 52-100 contain 15+ `useState`/`useMemo` calls for data, approval state, and UI state. Inline approval submission logic is embedded in the component.
- **Recommendation**: Extract approval logic into a `useWorkApprovalActions()` hook in shared. Extract metadata fetching into a `useWorkMetadata()` hook. The view should compose these hooks and render.

#### SOC2. Client WorkDashboard contains inline data aggregation — MEDIUM
- **Principle**: SOC
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx:1-861`
- **Issue**: The 861-line WorkDashboard component fetches work data, aggregates approval data across multiple recipients, and manages tab/filter state alongside rendering.
- **Evidence**: `fetchApprovalsByRecipients` callback (lines 62-83) performs data deduplication and aggregation inside the view component. This is business logic that belongs in shared.
- **Recommendation**: Extract the approval aggregation into a shared hook (e.g., `useAggregatedApprovals`). The dashboard should consume pre-aggregated data.

#### SOC3. Hook boundary violations in client Hero component — LOW
- **Principle**: SOC (Hook Boundary)
- **File**: `packages/client/src/components/Layout/Hero.tsx:24,51`
- **Issue**: Two hooks (`useTunnelUrl`, `useIsDarkMode`) are defined in the client package rather than in `@green-goods/shared`. Per CLAUDE.md, ALL hooks MUST live in shared.
- **Evidence**: `function useTunnelUrl()` at line 24 and `function useIsDarkMode()` at line 51 — both are private, non-exported hooks used only by the Hero component.
- **Recommendation**: These are single-component, dev-only utility hooks. Move them to shared as `useDevTunnelUrl()` and `useIsDarkMode()`, or inline the logic into the component via `useEffect` + `useState` without the custom hook wrapper. INFO-level in terms of real impact, but technically violates the stated rule.

#### SOC4. Hook definitions in admin views — LOW
- **Principle**: SOC (Hook Boundary)
- **File**: `packages/admin/src/views/Gardens/Garden/CreateAssessment.tsx:32`, `packages/admin/src/views/Dashboard/index.tsx:22`
- **Issue**: `useStepConfigs()` and `useDashboardHeader()` are defined in admin views rather than shared. Both are view-local utility hooks.
- **Evidence**: Both are non-exported hooks used by a single component for UI configuration.
- **Recommendation**: Same as SOC3 — either move to shared or inline the logic. The impact is minimal since these are not cross-package hooks.

### Architecture (EDA / ADR / C4)

#### ADR1. No architecture decision records exist — HIGH
- **Principle**: ADR
- **File**: N/A (absence of `.plans/adr/` or `docs/adr/`)
- **Issue**: The codebase makes several significant architectural decisions that are undocumented in formal ADRs:
  1. **Offline-first PWA**: JobQueue + IndexedDB + service worker background sync
  2. **Single-chain design**: `VITE_CHAIN_ID` at build time, no runtime chain switching
  3. **Hook boundary rule**: All React hooks in `@green-goods/shared`
  4. **Envio indexer boundary**: What to index vs. defer to RPC reads
  5. **XState for auth/minting workflows**: State machines for complex multi-step flows
  6. **Single root .env strategy**: No package-specific environment files
  7. **TransactionSender strategy pattern**: Factory-dispatched auth-mode-specific senders
  8. **Barrel export architecture**: Single `index.ts` re-exporting entire shared surface
- **Evidence**: No `adr/` directory found anywhere. Decisions are partially documented in `CLAUDE.md` and inline code comments but not in a structured, searchable format.
- **Recommendation**: Create `.plans/adr/` with ADRs for each decision above. Use a lightweight format: Title, Date, Status, Context, Decision, Consequences. This is a documentation task, not a code change.

#### C4-1. L3 component documentation missing in shared — MEDIUM
- **Principle**: C4
- **File**: `packages/shared/src/modules/`, `packages/shared/src/hooks/`
- **Issue**: The shared package is the largest package (140k LOC) and the core dependency, but there is no module-level documentation that maps the major components and their interactions. A new developer cannot quickly understand how modules/data/, modules/job-queue/, modules/app/, hooks/vault/, hooks/work/, and workflows/ relate to each other.
- **Evidence**: No `README.md` in `packages/shared/src/`. No C4 L3 diagram. Individual modules have JSDoc but no inter-module dependency map.
- **Recommendation**: Add a `packages/shared/src/MODULES.md` or a C4 L3 diagram that maps the major module groups, their dependencies, and data flow direction.

### Data (ACID / BASE / CAP)

#### CAP1. Indexer lag handling relies on fixed-delay follow-up invalidation — LOW
- **Principle**: CAP
- **File**: `packages/shared/src/hooks/query-keys.ts:49`
- **Issue**: `INDEXER_LAG_FOLLOWUP_MS = 2000` is used as a fixed follow-up delay for query invalidation after mutations. This assumes 2 seconds is sufficient for the Envio indexer to process the event. Under load or network conditions, this may be too short, leading to stale reads after mutation.
- **Evidence**: The constant is used in multiple mutation hooks via `useDelayedInvalidation`. The actual indexer lag depends on block confirmation time + Envio processing time, which varies.
- **Recommendation**: Consider progressive invalidation (invalidate at 2s, 5s, 15s) or subscribe to indexer events for confirmed processing. The current approach works for typical conditions but is fragile under degraded indexer performance. This is LOW because the existing stale-time tiers provide a safety net.

---

## Priority Queue

Top 10 highest-impact fixes across all principles, ordered by severity and effort:

1. **Create ADRs for major architectural decisions** — ADR — N/A — Effort: M
2. **Extract JobQueue responsibilities into focused modules** — SRP — `packages/shared/src/modules/job-queue/index.ts` — Effort: L
3. **Split IPFS module into initialization, upload, and resolution** — SRP — `packages/shared/src/modules/data/ipfs.ts` — Effort: M
4. **Add sub-path exports to shared package.json** — ISP — `packages/shared/src/index.ts` — Effort: M
5. **Extract approval/metadata hooks from client Work view** — SOC — `packages/client/src/views/Home/Garden/Work.tsx` — Effort: M
6. **Extract approval aggregation from WorkDashboard** — SOC — `packages/client/src/views/Home/WorkDashboard/index.tsx` — Effort: S
7. **Simplify useMintHypercert by extracting service factories** — KISS — `packages/shared/src/hooks/hypercerts/useMintHypercert.ts` — Effort: M
8. **Split Auth provider context into state/actions** — SRP — `packages/shared/src/providers/Auth.tsx` — Effort: M
9. **Add L3 module map for shared package** — C4 — `packages/shared/src/` — Effort: S
10. **Move client/admin local hooks to shared** — SOC — `packages/client/src/components/Layout/Hero.tsx` — Effort: S

---

## Trend (last N audits)

| Principle | 2026-04-02 |
|-----------|-----------|
| S (SRP) | YELLOW |
| O (OCP) | GREEN |
| L (LSP) | GREEN |
| I (ISP) | YELLOW |
| D (DIP) | GREEN |
| DRY | GREEN |
| KISS | YELLOW |
| YAGNI | GREEN |
| SOC | YELLOW |
| EDA | GREEN |
| ADR | RED |
| C4 | YELLOW |
| ACID | GREEN |
| BASE | GREEN |
| CAP | GREEN |

---

## Next Steps

> **This audit is read-only.** To apply fixes, reply with:
> - `fix critical` — address Critical findings only
> - `fix all` — address all findings by priority
> - `fix S1, ADR1` — address specific findings by ID
