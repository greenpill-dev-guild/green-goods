# Codex Task Prompts — Admin UI Revamp

Each task block follows the Codex best-practice format: Goal → Context → Constraints → Done when.
Codex reads `AGENTS.md` automatically — prompts only include task-specific guidance.
All tasks target the `feature/admin-ui-revamp` branch.

Plan docs for reference (Codex can read these directly):
- `.plans/active/admin-ui-revamp/spec.md` — functional spec with 60 decisions
- `.plans/active/admin-ui-revamp/plan.todo.md` — phased task list
- `.plans/active/admin-ui-revamp/eval.md` — acceptance criteria

---

## Phase 1a

### Task 1: Extend useAdminStore with stale-garden guard (D46)

**Goal:** Add a `useStaleGardenGuard()` hook export to the existing `useAdminStore` that auto-selects the first available garden (or null) when the currently selected garden is no longer in the gardens list.

**Context:** Read `packages/shared/src/stores/useAdminStore.ts` — the store already has `selectedGarden: Garden | null`, `selectedChainId`, `pendingTransactions`, `lastAttestationId`. Five admin views consume `selectedChainId` — they must not break. See plan D46 for full rationale.

**Constraints:**
- Do NOT modify existing state fields or actions — extend only
- Guard is a no-op while gardens are loading (don't clear selection during fetch)
- Export `useStaleGardenGuard` from `packages/shared/src/index.ts`

**Done when:**
- `useStaleGardenGuard` exported from shared
- Tests cover: garden removed → auto-select, garden present → no-op, loading → no-op, empty list → null
- `bun run test --filter shared` passes
- Existing `selectedChainId` consumers unaffected (no import/type changes)

---

### Task 2: Add networkMode to createBaseListHook factory (D38)

**Goal:** Extend the `createBaseListHook` factory to accept a `networkMode` option and pass it to `useQuery`. Then configure `useGardens` with `networkMode: "offlineFirst"` so toolbar permissions survive indexer downtime.

**Context:** Read `packages/shared/src/hooks/blockchain/useBaseLists.ts` (the factory — currently only supports `staleTime` and `gcTime`). Reference pattern: `packages/shared/src/hooks/gardener/useRole.ts` line 85 uses `networkMode: "offlineFirst"`.

**Constraints:**
- Only `useGardens` gets the new option — default behavior for other hooks unchanged
- Do not change function signatures or return types of the factory

**Done when:**
- `useGardens` uses `networkMode: "offlineFirst"`
- `useActions`, `useGardeners`, and other factory hooks still work without `networkMode`
- `bun run test --filter shared` passes

---

### Task 3: Create useEffectiveToolbarPermissions hook

**Goal:** Create a hook at `packages/shared/src/hooks/roles/useEffectiveToolbarPermissions.ts` that computes which cockpit toolbar slots are visible based on the user's garden-level roles. Returns `{ showWork, showGarden, showCommunity, showActions, isLoading }` booleans.

**Context:** Read `.plans/active/admin-ui-revamp/spec.md` section §24b — it has the complete slot visibility table, scope behavior (All Gardens = union, specific garden = filtered), and the hooks to compose (`useRole`, `useGardens`, `useAdminStore`, `useAccount`, `isAddressInList`).

**Constraints:**
- Fail-open: while loading or on error, all slots true (never hide navigation)
- Do NOT use `useRolePermissions` — that's for action-level gating, not toolbar slots
- Export from `packages/shared/src/index.ts`

**Done when:**
- Tests cover all role combos (evaluator-only, operator, multi-garden union, single-garden scope, deployer, loading, error, no gardens)
- `bun run test --filter shared` passes

---

### Task 4: Create route-labels.ts

**Goal:** Create a route label constants file for the revamped admin cockpit routes. These replace the labels in the current `Breadcrumbs.tsx`.

**Context:** Read `packages/admin/src/components/Layout/Breadcrumbs.tsx` for format reference — current labels (`dashboard`, `gardens`, `endowments`) don't carry over except `actions`.

**Constraints:**
- Create at `packages/admin/src/config/route-labels.ts`
- Simple constants only: `ROUTE_LABELS` (`work`, `garden`, `community`, `actions`) and `SUB_ROUTE_LABELS` (`create`, `edit`)
- Do NOT delete `Breadcrumbs.tsx` — that happens after TopContextBar is verified

**Done when:**
- File exists with correct exports
- `VITE_CHAIN_ID=11155111 bun run --filter '@green-goods/admin' build` passes

---

## Phase 1b

### Task 1: Decompose Deployment view (D52)

**Goal:** Break the 958-line `Deployment/index.tsx` god object into 3 sub-components: `DeploymentRunnerPanel`, `DeploymentJobMonitor`, `DeploymentAllowlistManager`.

**Context:** Read `packages/admin/src/views/Deployment/index.tsx`. The file has clear section boundaries: main deployment (lines ~55-650), open minting (lines ~651-713), allowlist management (lines ~714-958).

**Constraints:**
- Pure refactor — preserve ALL existing functionality and visual layout
- Each sub-component receives dependencies via props (keep hooks in index.tsx for now)
- Target: index.tsx under 150 lines after decomposition

**Done when:**
- 3 new files in `packages/admin/src/views/Deployment/`
- `index.tsx` composes them and is under 150 lines
- `bun run --filter '@green-goods/admin' build && bun run --filter '@green-goods/admin' test` passes
- No behavioral changes

---

### Task 2: Dead code cleanup (D53)

**Goal:** Delete confirmed dead production files identified in the March 15 audit.

**Context:** Read `.plans/audits/2026-03-15-admin-audit.md` section M2 for the full list of 15 dead production files. Also check for view files orphaned by route consolidation (views/Assessments/, views/Endowments/).

**Constraints:**
- Verify ZERO imports before deleting each file (grep for the filename across the repo)
- Do NOT delete story files or test files — separate cleanup
- Do NOT delete files that still have importers

**Done when:**
- All confirmed dead files removed
- `VITE_CHAIN_ID=11155111 bun run --filter '@green-goods/admin' build` passes
- `bun run --filter '@green-goods/admin' test` passes

---

### Task 3: Unit tests for Phase 1 hooks and redirects

**Goal:** Write test suites for the toolbar permissions hook, the 24-row legacy redirect map, and the SheetErrorBoundary.

**Context:** Read `.plans/active/admin-ui-revamp/spec.md` section §32 for the redirect table. Read the `useEffectiveToolbarPermissions` hook and `SheetErrorBoundary` component (both created in Phase 1a).

**Constraints:**
- Skip permissions tests if they already exist from Phase 1a Task 3
- Redirect tests should cover all 24 rows including special cases: `/gardens/:id?tab=work` param parsing, `/contracts` toast, `/gardens/create` overlay trigger
- SheetErrorBoundary tests: error renders in sheet, retry re-renders, error doesn't propagate to parent

**Done when:**
- All test files created
- `bun run test --filter shared && bun run test --filter admin` passes
- Coverage: every redirect row, every role combo, error boundary isolation

---

## Phase 2

### Task 1: GardenStateStore

**Goal:** Create a Zustand store that maintains per-garden UI state (active tab, filter, selected item, scroll position, side sheet state), persisted to sessionStorage.

**Context:** Read `.plans/active/admin-ui-revamp/spec.md` §6 for requirements. Reference `packages/shared/src/stores/useAdminStore.ts` for the existing store pattern.

**Constraints:**
- Key strategy: garden address as key, `"__all__"` for All Gardens mode
- Persist to sessionStorage (key: `"green-goods:garden-state"`)
- Export from `packages/shared/src/index.ts`

**Done when:**
- Store at `packages/shared/src/stores/useGardenStateStore.ts`
- Tests: set/get per garden, defaults for unknown garden, `"__all__"` key works, clear resets
- `bun run test --filter shared` passes

---

### Task 2: useCrossGardenQueue hook (D44)

**Goal:** Create a hook that merges work items from all managed gardens into a single sorted list. Client-side only — no new indexer queries.

**Context:** Read `.plans/active/admin-ui-revamp/spec.md` §4 for sort order. The hook reads `useGardens()` which returns `Garden[]` with `.works: Work[]` arrays.

**Constraints:**
- Sort: status-tier (`pending_review` > `pending_assessment` > `pending_mint` > other) then `createdAt` ascending (FIFO)
- Deduplicate by work ID
- Returns `{ items: Work[], isLoading: boolean, gardenCount: number }`

**Done when:**
- Hook at `packages/shared/src/hooks/work/useCrossGardenQueue.ts`, exported from shared
- Tests: multi-garden merge, dedup, sort order, loading state, empty gardens
- `bun run test --filter shared` passes

---

### Task 3: URL sync for garden state

**Goal:** Create a hook at `packages/shared/src/hooks/navigation/useGardenUrlSync.ts` that bidirectionally syncs cockpit URL params (`?garden=X&tab=Y&item=Z`) with the garden state store and admin store.

**Context:** Read the GardenStateStore (created in Phase 2 Task 1), `useAdminStore`, and spec D48 (side sheet history behavior: Back button closes sheet by popping `?item=` param).

**Constraints:**
- Tab/filter changes use `replace` (no history pollution); side sheet open/close uses `push` (Back closes sheet — D48)
- Must work with hash router (`VITE_USE_HASH_ROUTER=true`)
- Use react-router's `useSearchParams`

**Done when:**
- URL ↔ store sync works in both directions
- `bun run test --filter shared` passes

---

### Task 4: All Gardens /community guard

**Goal:** Create a route guard component that redirects All Gardens mode to a specific garden on `/community` with a toast notification.

**Context:** Spec §26 — community actions are per-garden, cross-garden view would be confusing.

**Constraints:**
- If `selectedGarden === null`, select first garden from `useGardens()` and show toast: "Community requires a specific garden."

**Done when:**
- Guard component at `packages/admin/src/components/guards/RequireSpecificGarden.tsx`
- `bun run --filter '@green-goods/admin' build` passes

---

### Task 5: Component promotions (TxInlineFeedback + getDepositLimitLabel)

**Goal:** Move `TxInlineFeedback` and `getDepositLimitLabel` from admin to shared so Phase 3 client components can use them.

**Context:** Read `packages/admin/src/components/feedback/TxInlineFeedback.tsx` and `packages/admin/src/components/Vault/depositLimit.ts`.

**Constraints:**
- Remove any admin-specific imports in promoted code
- Update admin imports to use `@green-goods/shared`
- No circular dependencies
- Do NOT change component behavior or styling

**Done when:**
- Both exported from `packages/shared/src/index.ts`
- Admin imports updated
- `bun run test --filter shared && bun run test --filter admin` passes
- `VITE_CHAIN_ID=11155111 bun run build` passes (cross-package)

---

### Task 6: Bundle size verification

**Goal:** Verify that shared component promotions (TxInlineFeedback, getDepositLimitLabel, VaultPositionCard) don't increase the client bundle due to tree-shaking failures.

**Context:** Client doesn't import these yet (Phase 3 does), so they should be tree-shaken out.

**Constraints:**
- Build client on the feature branch AND on main
- Compare total JS bundle sizes
- Flag if client grew by >5KB from promotions

**Done when:**
- Bundle comparison documented in output
- No unexpected client bundle growth

---

## Phase 3

### Task 1: Phase 3 i18n strings

**Goal:** Add English i18n keys for all Phase 3 user-facing strings. Add identical English fallbacks to es/pt files.

**Context:** Scan Phase 3 client components for `formatMessage({ id: "..." })` calls. Follow existing key naming convention in `packages/shared/src/i18n/en.json`.

**Constraints:**
- Do NOT modify component files — only i18n JSON files
- Do NOT translate — English fallbacks only (D56)
- Maintain alphabetical key ordering

**Done when:**
- Every `formatMessage` id in Phase 3 components has a corresponding key in en.json
- es.json and pt.json have identical English fallback values
- `bun run test --filter shared` passes

---

## QA

### Task 1: QA Pass 2

**Goal:** Independent verification of the complete admin UI revamp. Run full validation suite and check every eval criterion from a fresh perspective.

**Context:** Read `.plans/active/admin-ui-revamp/eval.md` for all acceptance criteria and quality gates.

**Constraints:**
- Do NOT modify any files — read-only review
- Flag criteria with no automated test coverage

**Done when:**
- `bun run test` passes
- `VITE_CHAIN_ID=11155111 bun run build` passes
- `VITE_USE_HASH_ROUTER=true VITE_CHAIN_ID=11155111 bun run --filter '@green-goods/admin' build` passes
- `bun format:check && bun lint` passes
- QA report lists: passing criteria (with evidence), failing criteria (with file:line), criteria needing manual test, any new lint/type warnings
