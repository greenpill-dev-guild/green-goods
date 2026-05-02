# Admin Dashboard Stabilization Plan

**Feature Slug**: `admin-dashboard-stabilization`
**Stage**: `backlog`
**Status**: `QA PASS 1 + QA PASS 2 PASSED FOR ADMIN SCOPE; PUBLIC-BROWSER STORY ASSERTION DEFERRED OUT-OF-SCOPE`
**Created**: `2026-05-01`
**Last Updated**: `2026-05-02`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Create a focused `.plans` backlog hub before runtime fixes | The current problem spans admin and shared state boundaries; durable repo truth should precede implementation. |
| 2 | Preserve `CanvasLayout`, `/hub`, and ADR-019 canonical routes | The accepted admin contract is structurally sound; instability is in auth/loading/state boundaries. |
| 3 | Keep `/actions` deployer-only | Route gating already encodes this policy and the stabilization pass should align controller/story behavior to it. |
| 4 | Direct canvas routes render terminal states in place | Bookmarks should show the same disconnected, embedded-wallet, indexer-error, and no-access states as `/`. |
| 5 | Runtime code changes require a later scope lock | This hub's first pass is an audit/remediation plan, not an implementation branch. |
| 6 | Codex implemented after explicit user scope lock on 2026-05-02 | State/API and UI lanes are complete, but QA remains blocked by the missing Claude QA pass and one unrelated public Storybook assertion. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Record decision-ready admin architecture audit | `state_api` | Step 1 | ✅ |
| Isolate Storybook/admin state per story | `state_api` | Step 2 | ✅ |
| Share admin auth/access terminal-state logic | `state_api` | Step 3 | ✅ |
| Render shared terminal states for `/` and direct canvas routes | `ui` | Step 4 | ✅ |
| Align eligible-garden fallback across detail data and toolbar permissions | `state_api` | Step 5 | ✅ |
| Keep `/actions` deployer-only across route, controller, and stories | `ui`, `state_api` | Step 6 | ✅ |
| Verify with targeted admin/shared/story gates | `qa_pass_1`, `qa_pass_2` | Steps 7-8 | ✅ both passed; out-of-scope public-browser story + local Varlock build proof-limit recorded in `handoffs/codex-qa-pass-2.md` |

## Implementation Steps

### Step 1: Finalize the audit hub

**Files**: `.plans/backlog/admin-dashboard-stabilization/**`

**Change**: Keep the hub complete and internally consistent: `brief.md`,
`spec.md`, `plan.todo.md`, `eval.md`, `status.json`, and `handoffs/`.

**Validation**: `node scripts/harness/plan-hub.mjs validate`

### Step 2: Add Storybook admin state isolation

**Lane**: `state_api`

**Behavior boundary**: Admin workspace stories must not depend on previous story
state.

**Change**: Add a shared Storybook admin reset harness that clears admin
Zustand state, sheet orchestrator state, garden workspace state, relevant
session/local storage keys, dev mock auth role, and per-story seeded query
state. Prefer a shared decorator/helper over per-story cleanup.

**Validation**:

- focused story test that fails without reset and passes with reset
- `bun run --filter @green-goods/shared check:stories`
- `bun run --filter @green-goods/shared test:stories:ci`

### Step 3: Add shared admin access-state logic

**Lane**: `state_api`

**Behavior boundary**: A direct admin canvas route can classify loading,
disconnected, embedded-wallet, indexer-error, no-access, and ready states
without duplicating `IndexRoute` logic.

**Change**: Add one shared hook that combines auth readiness, authenticated
address, auth mode, eligible gardens, indexer error, and creation permission
into a typed admin access state. Keep it in `@green-goods/shared`; do not add
admin-local hooks.

**Validation**:

- focused shared tests for each terminal state
- stale-base-list case where role-confirmed operator gardens keep the state
  ready instead of no-access

### Step 4: Reuse terminal-state rendering across `/` and canvas routes

**Lane**: `ui`

**Behavior boundary**: `/`, `/hub/work`, and other direct canvas bookmarks show
the same access terminal states.

**Change**: Move admin terminal-state rendering into an admin-owned component
that can be used by `IndexRoute` and the canvas branch. Preserve `CanvasLayout`
as the canonical ready shell.

**Validation**:

- focused admin route/auth tests for direct `/hub/work` disconnected, embedded,
  no-access, indexer-error, and ready states
- `bun --bun tsc --noEmit -p packages/admin/tsconfig.json`
- `bun run --filter @green-goods/admin test:hub`

### Step 5: Align eligible-garden fallback consumers

**Lane**: `state_api`

**Behavior boundary**: A role-confirmed operator garden recovered from
`useEligibleAdminGardens` remains selectable, visible in toolbar permissions,
and usable for garden detail state.

**Change**: Make `useGardenDetailData` and `useEffectiveToolbarPermissions`
consume fallback-aware eligible garden data where they currently rely only on
the base garden list. Preserve explicit loading/error state so recovered stubs
are not confused with fully indexed records.

**Validation**:

- shared tests covering stale base-list operator garden recovery
- admin tests or stories showing recovered garden selection and nav visibility

### Step 6: Align `/actions` to deployer-only

**Lane**: `ui`, `state_api`

**Behavior boundary**: Operators cannot access `/actions`; deployers can open
registry, detail, create, and edit stories.

**Change**: Keep the existing route gate, change controller manage logic to
deployer-only, and run Actions Storybook stories with deployer identity plus
matching role/deployment seeds.

**Validation**:

- route/role test proving operator access is blocked
- Storybook CI story proving deployer can load Actions detail/create/edit

### Step 7: QA pass 1

**Lane**: `qa_pass_1`

Review the implementation against `eval.md`, route behavior, story reliability,
and cockpit UI contract. Record findings in `handoffs/claude-qa-pass-1.md`.

### Step 8: QA pass 2

**Lane**: `qa_pass_2`

Re-run targeted validation, confirm no runtime shell or route contract drift,
and record final proof in `handoffs/codex-qa-pass-2.md`.

## TDD / Proof Order

- [x] Identify the behavior boundary for each implementation lane before editing code
- [x] Write or select the minimal failing test/proof first
- [x] Run the RED command and record evidence in the lane handoff
- [x] Implement the smallest change that can satisfy the proof
- [x] Run the GREEN command and record evidence in the lane handoff
- [x] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [x] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### UI (`claude/ui/admin-dashboard-stabilization`)

- [x] Implement admin terminal-state renderer shared by `/` and direct canvas routes
- [x] Preserve `CanvasLayout`, `AppBar + MainSheet + NavigationBar`, and `/hub` reference composition
- [x] Align Actions stories to deployer identity
- [x] Add i18n for any new user-facing strings in `en`, `es`, and `pt`
- [x] Record RED/GREEN proof or proof-limit note before marking complete
- [x] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/admin-dashboard-stabilization`)

- [x] Add Storybook admin reset harness
- [x] Add shared admin access-state hook
- [x] Align `useGardenDetailData` and `useEffectiveToolbarPermissions` with eligible-garden fallback
- [x] Align Actions controller policy to deployer-only
- [x] Keep hooks in shared and avoid package-local admin hooks
- [x] Record RED/GREEN proof or proof-limit note before marking complete
- [x] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/admin-dashboard-stabilization`)

- [x] No contract work; lane is `n/a`

### QA Pass 1 (`claude/qa-pass-1/admin-dashboard-stabilization`)

- [x] Review direct-route terminal states
- [x] Verify Storybook isolation and Actions role behavior
- [x] Verify acceptance criteria from `eval.md`
- [x] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/admin-dashboard-stabilization`)

- [x] Confirm QA pass 1 handoff exists and blockers are resolved
- [x] Re-run targeted validation commands
- [x] Confirm `status.json`, handoffs, and implementation evidence agree
- [x] Write `handoffs/codex-qa-pass-2.md`

## Validation

Audit creation:

- [x] `node scripts/harness/plan-hub.mjs validate`

Later remediation:

- [x] `bun --bun tsc --noEmit -p packages/admin/tsconfig.json`
- [x] `bun run --filter @green-goods/admin test:hub`
- [x] focused admin route/auth tests for direct `/hub/work` disconnected, embedded, no-access, indexer-error, and ready states
- [x] focused shared tests for stale-base-list eligible garden fallback
- [x] `bun run --filter @green-goods/shared check:stories`
- [x] `bun run --filter @green-goods/shared check:story-quality`
- [ ] `bun run --filter @green-goods/shared test:stories:ci` — blocked by public-browser story assertion outside admin scope
- [x] `bun run --filter @green-goods/admin build`
