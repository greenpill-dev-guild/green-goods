# Admin Design Revamp — qa_pass_1 Handoff

**Feature**: `admin-design-revamp`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `provisional_pass` — committed cleanup A1–A6 verified; two pre-merge follow-ups required.
**Branch**: working session on `main` (release/1.1.0 merged into `main` via merge commit `8ae54755`; all five cleanup commits — `8405bce1`, `6b9faa65`, `47c4de59`, `49d61acf`, `ec6c89c0` — present on both `main` and `release/1.1.0`)
**Depends on**: `cleanup` (mostly_landed)
**QA target**: code at HEAD on the release branch, not the current working tree (see "Working-tree drift" below)

## Verdict

**Provisional pass.** The cleanup A1–A6 commits land correct logic — unit tests, plan-hub, and live desktop rendering all match the spec. B1–B3 deferral is honest. **Two pre-merge actions are needed before this can flip to a hard pass:**

1. A concurrent agent's working-tree refactor of `packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx` lifts `domainModalOpen` state into the workspace controller but accidentally drops the `useState` import while `GardenMembersList` further down the file still uses it. Garden Members tab crashes at runtime with `ReferenceError: useState is not defined`. The committed cleanup at HEAD is fine; only the working tree is broken. The concurrent agent must either commit the lift correctly (re-adding `useState` to the imports) or revert it. **This is a release-blocker if the concurrent WIP merges as-is.**
2. The three follow-up backlog plans recommended in the cleanup handoff (`conviction-pool-config-onchain`, `conviction-supporter-count-indexer`, `conviction-threshold-formula-port`) are not yet filed in `.plans/backlog/` — only mentioned in `handoffs/claude-cleanup.md`. The qa_pass_1 mandate says "confirm the deferred B1-B3 items are filed as backlog plans before merge." File the three stubs before merge.

## Validation evidence

- `node scripts/harness/plan-hub.mjs validate` → `Validated 20 feature hubs.` ✅
- `cd packages/shared && bun run test -- src/__tests__/hooks/admin-ui/fab-config.test.ts src/__tests__/hooks/admin-ui/header-stats.test.ts src/__tests__/utils/conviction/ src/__tests__/hooks/conviction/useConvictionWeightAllocator.test.tsx` → 5 files / 88 tests / 0 failures ✅
- `cd packages/admin && bun run test -- src/__tests__/components/Garden/memberRoles.test.ts` → 9 tests / 0 failures ✅
- `bun run --filter @green-goods/admin lint` → 14 warnings + 1 error, all in unrelated story files (`AdminTabRail.stories`, `AccountProfilePanel.stories`, `UserAvatar.stories`, `UserMenu.stories`, `AdminDialog.stories`, `CanvasIndexerErrorState.stories`, `storybookCanvasHarness.tsx`); none from cleanup-touched surfaces.

## Item-by-item verification

### A1–A3 — Conviction math + allocator round-trip

**Status**: ✅ pass via tests. Pinned by the cleanup commit's RED→GREEN proof; targeted re-run for QA shows 50 conviction-utils tests + 11 useConvictionWeightAllocator tests passing.

### A4 — FAB action registration per view

**Status**: ✅ pass on desktop; mobile inferred from code reading + the desktop runtime path; cosmetic test-coverage finding noted below.

**Live desktop evidence (1302px innerWidth on `https://localhost:3002`, authenticated session, garden selected):**

| View | URL | Visible inline actions on `PageHeader` |
|---|---|---|
| Hub | `/hub/work` | Create Assessment, Create Hypercert, Submit Work *(stage="work" → Submit Work primary)* |
| Garden | `/garden/overview` | View public, Edit domains, Invite gardener, Edit garden *(maxInline=4, Edit garden primary)* |
| Community | `/community/treasury` | More actions (overflow), Manage roles, Manage payouts, New proposal *(maxInline=3 default; view-public folded into overflow)* |
| Actions | `/actions` | Unauthorized — view permission gated, action set unobservable in this session |

These match `buildHubViewActions` / `buildGardenViewActions` / `buildCommunityViewActions` / inline `viewActions` (Actions controller) — the runtime path that drives both desktop `AdminViewActions` and mobile FAB through `useViewActions` → `useCanvasResponsiveFab` → `useFabConfig` (FabContext).

**Mobile live-verify:** could not produce a clean live capture in MCP-driven Chrome.
- Hard reload at <1024px innerWidth consistently resolves auth/role state with `canManage=false` (no Notifications / Open settings / Profile in AppBar; all role-gated `view-action` items filter to `visible: false`); with zero visible actions, `useViewActions` returns `null` from `useCanvasResponsiveFab`, so `FabContext` registers no fab and no `data-slot="mobile-fab-layer"` element appears. This is the correct, intended branch — no cleanup defect — but it means the FAB layer's mobile rendering was not live-confirmed.
- Resize from desktop to <1024px without reload keeps the React `useMediaQuery` hook stale (matchMedia listener in MCP Chrome doesn't reliably trigger a `change` event when the chrome window resizes), so the desktop `AdminViewActions` element stays in DOM and the FAB layer doesn't activate.

**Mitigation**: code reading + unit tests provide sufficient evidence. `useCanvasResponsiveFab` is identical across all four view controllers and has explicit tablet/mobile branches at `packages/shared/src/components/Canvas/useCanvasResponsiveFab.ts:31` (registers `useFabConfig(fab)` whenever not blocked) and `packages/shared/src/components/Canvas/NavigationBar.tsx:323-358` (renders `mobile-fab-layer` when `!isLargeDesktop && fab && !hideMobileChrome`). The `fab-config.test.ts` (18 tests) pins ids/labels/navigation targets for the deprecated builders, and `buildXViewActions` callers are exercised in the desktop browser session.

**Cosmetic test-coverage finding (P3)**: the cleanup A4 unit tests at `packages/shared/src/__tests__/hooks/admin-ui/fab-config.test.ts` pin `buildGardenFabConfig` and `buildCommunityFabConfig`, but `grep` for runtime consumers shows these deprecated builders have **no view callers**. The runtime FAB on every view uses `buildXViewActions` + `useViewActions` instead. The test suite therefore pins the action ids of dead code (Garden: edit-garden / invite-gardener / **send-distribution**; Community: new-proposal / add-member / manage-vault) while the live UI ships a different set (Garden: view-public / edit-domains / invite-gardener / edit-garden — note: no Send Distribution, which matches audit decision `docs/admin-revamp/audit.md` §VI line 596: *"Handoff-named flows that don't exist yet (Quick Log, Draft Proposal, Send Distribution, Start Discussion) are NOT stubbed"*). Two reasonable resolutions:

- (a) Delete `buildGardenFabConfig` + `buildCommunityFabConfig` and their tests; extend `fab-config.test.ts` to pin the runtime `buildXViewActions` action sets.
- (b) Mark the deprecated builders + tests as a known scaffold for a future migration; add a short note in `garden.utils.ts:168` explaining when the migration completes.

This is non-blocking for release. Flagged so the next pass picks one.

### A5 — Garden Members tab role chips beyond operator

**Status**: ✅ pass on the cleanup logic. Live render only verifiable after the concurrent WIP `useState` import is restored.

**Verification approach (HEAD-equivalent)**: temporarily added `useState` back to `packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx:13` (one-line additive Edit) to break out of the runtime defect, navigated to `/garden/members`, captured the rendered chips, then **reverted the edit** (`git diff` confirms the working tree is byte-identical to its pre-QA state — drift remains the concurrent agent's WIP only). Did not commit anything.

**Live evidence on `/garden/members` after restoring the import:**

```
data-component="GardenMembersList" present
data-slot="member-row" rows:
  • member 1 (data-role="owner") — chips: Owner, Operator, Gardener
  • member 2 (data-role="operator") — chips: Operator, Evaluator, Gardener
```

This matches `buildMemberRoleSets` + `memberRolesForAddress` + `MEMBER_ROLE_DISPLAY_ORDER = [owner, operator, evaluator, gardener, funder]` ordering, with multi-role rows rendering one chip per role.

Filter chips render (All / Operators / Reviewers / Gardeners / Pending — five-element `[role="group"]`). Members tab header reads `Gardeners` with the count "2 gardeners". A11y label `cockpit.garden.members.rolesLabel` resolves on the chip group container.

### A6 — Stats slot for Garden + Community headers

**Status**: ✅ pass.

**Live evidence (desktop):**
- `/garden/overview`: `[data-component="PageHeader"] [data-density="inline"]` reads `2 gardeners · 0 pending work · 0.2702 treasury` — matches `buildGardenHeaderStats` (3 items, no garden name re-declaration per audit §5.6 + Frontend Rule 17).
- `/community/treasury`: same selector reads `2 people · 2 pools · 0.2702 treasury` — matches `buildCommunityHeaderStats`.

Mid-dot separators present (`MetaStrip density="inline"`). Slot stays empty when no garden is selected (helper returns `[]`).

### B1–B3 — deferred (honest)

**Status**: ✅ deferral is honest at the code level; ❌ backlog plans not yet filed.

In-code TODOs in `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts:164-189` (`FALLBACK_POOL_CONFIG`, `countSupporters`) and `packages/shared/src/utils/conviction/derivation.ts:38-65` (`BLOCKS_PER_DAY`, `DEFAULT_THRESHOLD_PERCENT`, `deriveThreshold`) reference concrete blockers and the recommended follow-up plan slugs. The blocker chain is:

| Item | Blocker | Where the blocker is documented |
|---|---|---|
| B1 `memberCount` | `IVotingPowerRegistry` exposes only `isMember(member)`; no enumeration; Envio schema has no `Voter` entity | `useConvictionProposalsForPool.ts:158-167` + cleanup handoff "B1–B3 investigation" |
| B2 supporter count | `getConvictionWeights()` returns aggregate; `getVoterAllocations(voter)` requires voter list; Envio schema does not index `Allocation` | `useConvictionProposalsForPool.ts:178-189` + cleanup handoff |
| B3 threshold | `HYPERCERT_SIGNAL_POOL_ABI` exposes neither `threshold()` nor `minThresholdPoints()` | `derivation.ts:42-49` + cleanup handoff |

**Filing gap**: `find .plans/backlog -type d -name 'conviction*'` returns empty. The three follow-up plans (`conviction-pool-config-onchain`, `conviction-supporter-count-indexer`, `conviction-threshold-formula-port`) only appear inside `handoffs/claude-cleanup.md`. Per `qa_pass_1` `handoff_note`: *"confirm the deferred B1-B3 items are filed as backlog plans before merge"*. **Action item**: file three short plan stubs in `.plans/backlog/` before the release branch merges, so the deferral is durable.

### C1 — pre-existing client-homepage failures

**Status**: ✅ deferral is honest. Anchor commit `0b4a67e8`, 21 cases across 8 files. Out of scope for the admin-design-revamp branch boundary; should be filed as `/audit-then-ship --lens=review --no-ship` against `0b4a67e8` per `eval.md`.

## Working-tree drift summary

This QA pass ran on a working tree with concurrent-agent edits unrelated to admin-design-revamp. The committed cleanup state at HEAD is correct; the working-tree state is broken because of concurrent WIP. To run a clean repro:

- HEAD state at `packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx`: imports `{ useMemo, useState }`, declares `const [domainModalOpen, setDomainModalOpen] = useState(false)`, passes `canManage` + `onEditDomains` to `<GardenDomainSummaryRow>`, and threads `isOpen={domainModalOpen}` / `onClose={() => setDomainModalOpen(false)}` to `<GardenDomainModal>`.
- Working-tree (concurrent WIP, **not committed**): drops the `useState` import + the local state, simplifies `<GardenDomainSummaryRow domainMask={...} />` to one prop, and threads `isOpen={workspace.domainEditorOpen}` / `onClose={workspace.closeDomainEditor}` from the controller (which already exposes those at `useGardenWorkspaceController.ts:48,112,274,286`).

The lift is internally coherent for `GardenWorkspaceContent`'s own state, but `GardenMembersList` (further down the same file at line 295: `useState<GardenMembersFilter>("all")`) still needs the import. The fix is one line — `import { useMemo, useState } from "react";`. **I am NOT committing this from the QA pass**: it's the concurrent agent's refactor and they should land it as a coherent commit. I temporarily added the import line to live-verify A5, captured the evidence in this handoff, then reverted (`git diff` shows the working tree is byte-identical to its pre-QA state).

A handful of other files (admin tests, stories, CSS) are also dirty — none affect the cleanup A1–A6 surfaces.

## Pre-merge checklist for cleanup → release/1.1.0 merge

1. [ ] Concurrent agent commits or reverts the `GardenWorkspaceContent.tsx` lift; confirm `bun run --filter @green-goods/admin build` and `/garden/members` render cleanly afterward.
2. [ ] File `.plans/backlog/conviction-pool-config-onchain/` (B1 follow-up) — short plan stub referencing the live ABI gaps.
3. [ ] File `.plans/backlog/conviction-supporter-count-indexer/` (B2 follow-up).
4. [ ] File `.plans/backlog/conviction-threshold-formula-port/` (B3 follow-up).
5. [ ] (Optional, P3) Resolve A4 test-coverage finding: either delete deprecated `buildXFabConfig` builders + tests, or extend tests to pin the runtime `buildXViewActions` action sets.

## Files inspected during QA

- Spec / decisions: `docs/admin-revamp/audit.md` (§VI line 596 "FAB targets per view"; §5.6 "Garden identity strip"; §IA-Garden tabs)
- Plan: `.plans/active/admin-design-revamp/{brief.md, eval.md, plan.todo.md, status.json, handoffs/claude-cleanup.md}`
- A4 source: `packages/shared/src/hooks/admin-ui/{garden,community,hub}/{*.utils.ts, useXController.ts}`, `packages/shared/src/hooks/admin-ui/actions/useActionsController.ts`, `packages/shared/src/components/Canvas/{useViewActions.ts, useCanvasResponsiveFab.ts, FabContext.tsx, NavigationBar.tsx}`, `packages/admin/src/components/AdminViewActions.tsx`, `packages/admin/src/views/{Hub,Garden,Community,Actions}/index.tsx`
- A5 source: `packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx`
- A6 source: `packages/shared/src/hooks/admin-ui/{garden,community}/*.utils.ts`, `packages/admin/src/views/{Garden,Community}/index.tsx`
- A4/A5/A6 tests: `packages/shared/src/__tests__/hooks/admin-ui/{fab-config,header-stats}.test.ts`, `packages/admin/src/__tests__/components/Garden/memberRoles.test.ts`
- B1–B3 source: `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts`, `packages/shared/src/utils/conviction/derivation.ts`
- i18n: `packages/shared/src/i18n/{en,es,pt}.json` (`cockpit.{garden,community}.{fab,action,stats}.*`, `cockpit.garden.members.rolesLabel`)
