# Admin Design Revamp — cleanup Handoff

**Feature**: `admin-design-revamp`
**Lane**: `cleanup`
**Owner**: `claude`
**Status**: `in_progress` (A1–A4 landed 2026-05-04; A5–A6 + B1–B3 + C1 still open)
**Branch**: `release/1.1.0` (cleanup committed directly to the release branch per cleanup-lane scope)
**Depends on**: `tier_5_wiring` (landed) + B1–B3 unblocked by `signal-pool-yield-wiring` completion 2026-05-03

## Purpose

Resolve the work explicitly deferred during Tiers 1–5. Each item below has paste-able context (file path, commit anchor, audit reference) so the implementer can pick any subset without re-reading the entire delivery.

## Completion Record — 2026-05-04 (release/1.1.0)

**Done**:
- ✅ A1 — `percent-points.ts` Vitest coverage. New file `packages/shared/src/__tests__/utils/conviction/percent-points.test.ts` (30 cases): pointsToPercent / percentToPoints round-trip, NaN + clamp + budget=0 edge cases, allocationsToPercentMap key correctness, percentMapToSignedDeltas signed-delta correctness across old-only / new-only / both id sets and the combined add+remove+change diff.
- ✅ A2 — `derivation.ts` Vitest coverage. New file `packages/shared/src/__tests__/utils/conviction/derivation.test.ts` (20 cases): deriveProposalStatus per branch (funded / inactive+0 / inactive+>0 / active+passing / active+accruing), deriveConvictionPercent clamping with pointsPerVoter=0 / memberCount≤0 / weight=0, deriveDailyAccrual zero-cases, deriveThreshold pinning the placeholder constant.
- ✅ A3 — `useConvictionWeightAllocator` round-trip. New file `packages/shared/src/__tests__/hooks/conviction/useConvictionWeightAllocator.test.tsx` (11 cases): initial mirror, debounce window before/after 400ms, signed-delta correctness end-to-end, custom debounceMs, budget=0 / poolAddress=undefined no-ops, flush() cancels + fires sync, post-mutation server refresh clears isDirty.
- ✅ A4 — FAB action registration per view. Garden FAB (`buildGardenFabConfig`) extended to edit-garden / invite-gardener / send-distribution; Community FAB (`buildCommunityFabConfig`) extended to new-proposal / add-member / manage-vault with new-proposal as the v2 mobile primary. Hub FAB already stage-aware (`buildHubFabConfig`) and Actions FAB already wires Create Action, so no change needed there. New i18n keys added across en/es/pt; pre-existing `cockpit.community.fab.{addMember,manageVault}` ids that were used in code but missing from the locales were also filled in. New unit tests at `packages/shared/src/__tests__/hooks/admin-ui/fab-config.test.ts` (16 cases) pin action ids, labelIds, navigation targets, and gate behavior.

**TDD evidence**:
- A1–A3: RED → `cd packages/shared && bun run test -- src/__tests__/utils/conviction/` → `No test files found`. GREEN → 3 files / 61 tests / 0 failures.
- A4: GREEN → `cd packages/shared && bun run test -- src/__tests__/hooks/admin-ui/fab-config.test.ts` → 16 tests / 0 failures (proof_limit: pure utility builder, no UI render path).

**Validation**:
- `bun run format:check` → clean (after `bun format` auto-fix on touched files).
- `bun lint` → 0 errors, 165 pre-existing solhint warnings (none from these changes).
- `bun run lint:vocab` → 0 banned-vocabulary hits across i18n.
- `node scripts/harness/plan-hub.mjs validate` → `Validated 21 feature hubs.`

**Still open** (this handoff):
- A5 — Garden Members tab role chips beyond operator. ~1 hr.
- A6 — Stats slot for Garden + Community headers. ~30 min ea.
- B1–B3 — `signal-pool-yield-wiring` is `done` (2026-05-03), so the dependency gate is technically lifted. Still requires deciding which of `useGardenYieldWiringState` / a new pool-config hook to consume; out of scope for this release-cleanup pass since none of the missing data is on a release-blocking surface (the FALLBACK_POOL_CONFIG TODO renders sensible numbers).
- C1 — 21 client-homepage test failures. Out of scope for the admin-design-revamp branch boundary; should be filed as a separate `/audit-then-ship --lens=review --no-ship` pass on commit `0b4a67e8`.

## Required Scope

Grouped by independence — items in (A) need no coordination; items in (B) wait on a sibling feature; (C) is a separate audit-then-ship pass.

### A. Independent (do anytime)

#### A1 — Vitest coverage for `percent-points.ts`

**File**: `packages/shared/src/utils/conviction/percent-points.ts`
**Why it matters**: this is the math behind every WeightAllocator save. Silently-wrong values here = silently-wrong on-chain votes.

Test surfaces:
- `pointsToPercent(amount, budget)` → 0 when budget=0; preserves precision at 2 dp; clamps overflow.
- `percentToPoints(percent, budget)` → round-trip identity with `pointsToPercent`; clamps `[0, 100]`; handles `NaN`.
- `allocationsToPercentMap(allocations, budget)` → string-keyed by `hypercertId.toString()`; matches `ConvictionProposal.id`.
- `percentMapToSignedDeltas(old, new, budget)` → signed (positive add, negative remove); skips no-op rows; empty when budget≤0; correct when ids appear in old-only / new-only / both.

Estimated effort: ~30 min.

#### A2 — Vitest coverage for `derivation.ts`

**File**: `packages/shared/src/utils/conviction/derivation.ts`

Test surfaces:
- `deriveProposalStatus(entry, conviction, threshold, funded?)` per branch (funded / inactive+0 / inactive+>0 / active+passing / active+accruing).
- `deriveConvictionPercent` clamps + handles `pointsPerVoter=0` and `memberCount=0`.
- `deriveDailyAccrual` returns 0 when memberAllocation=0 / decayRate=0 / pool max=0.
- `deriveThreshold` returns the documented constant (locks the placeholder behind a test so a future formula swap can't accidentally regress).

Estimated effort: ~30 min.

#### A3 — Integration test for `useConvictionWeightAllocator` round-trip

**File**: `packages/shared/src/__tests__/hooks/conviction/useConvictionWeightAllocator.test.tsx` (NEW)

Round-trip surface:
- Initial render mirrors `useMemberVotingPower` result into `allocations`.
- `setAllocations(next)` updates local state immediately, no save fires before debounce window.
- After 400ms, `useAllocateHypercertSupport.mutate` is called with signed deltas computed from `percentMapToSignedDeltas`.
- `flush()` cancels pending debounce + fires save synchronously.
- Server-state update (mock invalidation) syncs back to `localAllocations` and clears `isDirty`.

Use `@testing-library/react` `renderHook` + `vi.useFakeTimers` for the debounce.

Estimated effort: ~1 hr.

#### A4 — FAB action registration per view

**Per audit §5.4.4 + handoff DESIGN_NOTES.md**: Tier 2e built the responsive FAB wrapper but no view registers actions. Wire each:

| View | Actions | Anchor |
|---|---|---|
| Hub | Submit work / Review next / Quick log | `views/Hub/index.tsx` |
| Garden | Invite gardener / Edit garden / Send distribution | `views/Garden/index.tsx` |
| Community | New proposal | `views/Community/index.tsx` |
| Actions | Create template | `views/Actions/index.tsx` |

Registration mechanism: call `useFabConfig({...})` from each view (or its controller). Existing pattern: `buildGardenFabConfig` in `garden.utils.ts` (currently passes a single "Edit Garden" entry). Extend to the per-view dial composition above.

Estimated effort: ~2 hrs.

#### A5 — Garden Members tab role chips beyond operator

**File**: `views/Garden/components/GardenWorkspaceContent.tsx` (`GardenMembersList`)

Currently distinguishes operator vs gardener via address membership. Extend to show all roles per member: operator / gardener / evaluator / funder (where data is available). Reuse `getRoleLabel` from `components/Garden/gardenUtils.ts`.

Estimated effort: ~1 hr.

#### A6 — Stats slot for Garden + Community headers

**Files**: `views/Garden/index.tsx`, `views/Community/index.tsx`

Tier 4 dropped `MetaStrip` to honor Frontend Rule 17. The space is empty. Audit §5.6 recommended populating with stats (member count, last activity, vault count). Pass a `MetaStrip density="inline"` with stat items rather than the bare garden-name re-declaration.

Estimated effort: ~30 min per view.

### B. Blocked on `signal-pool-yield-wiring` UI lane landing

#### B1 — Pool config consumption

**File**: `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts:149` (`FALLBACK_POOL_CONFIG`)

When the sibling lane exposes `useGardenSignalPoolWiring` (or a sibling pool-config hook), consume it inside `useConvictionProposalsForPool` and remove `FALLBACK_POOL_CONFIG`. Also update `derivation.ts` formulas (BLOCKS_PER_DAY, DEFAULT_THRESHOLD_PERCENT) with verified values from the contract reads.

Watchpoint: their plan.todo.md → "Frontend Changes" → Change 5a/5/6 — track when these land on `develop`.

#### B2 — Per-member supporter count

**File**: `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts:167` (`countSupporters`)

If signal-pool-yield-wiring exposes a per-member breakdown hook, use it. Otherwise file a separate plan to add `useHypercertSupporters(poolAddress, hypercertId)` that returns the distinct-voter count.

#### B3 — Threshold formula

**File**: `packages/shared/src/utils/conviction/derivation.ts:61` (`deriveThreshold`)

If signal-pool-yield-wiring's UI work surfaces the contract-level threshold formula (likely needed for their decay-config UX), port it into `deriveThreshold`. Function signature is intentionally stable for a swap.

### C. Separate audit-then-ship pass

#### C1 — 21 failing client-homepage tests

**Anchor commit**: `0b4a67e8 feat(client,shared): public homepage editorial polish`

Files failing (`packages/client/src/__tests__/`):
- `components/PublicFeaturedGardens.test.tsx` (6 cases)
- `components/PublicFundingBridge.test.tsx` (3 cases)
- `components/PublicGetInTouch.test.tsx` (4 cases)
- `components/PublicRecordLoop.test.tsx` (4 cases)
- `components/SiteHeader.test.tsx` (1 case)
- `views/Cookies.test.tsx` (1 case)
- `views/PublicGardenDetail.test.tsx` (1 case)
- `views/fund.test.tsx` (1 case)

These pre-date this hub. Recommend filing as `/audit-then-ship --lens=review --no-ship` against the `0b4a67e8` diff, then a separate cleanup commit. Out of scope for the admin-design-revamp branch boundary.

## Validation

```bash
# Per-item: vitest for the targeted file
cd packages/shared && bun run test -- src/__tests__/utils/conviction/percent-points.test.ts

# Full ship gate before merging cleanup
bun format && bun lint && bun run test && bun build
bun run check:design-tokens && bun run lint:vocab
```

## UX Guardrails

- Do not modify `GovernancePanel`'s rendering shape unless an audit row authorizes it (the layout is a Tier 5 deliverable).
- Do not introduce raw `setTimeout` in any new hook — use `useTimeout` per CLAUDE.md react-patterns rule 1.
- Do not repaint surfaces with workspace tokens — `[data-workspace]` is removed; use `[data-tone]`.
- Stats slot additions to MetaStrip must NOT include the garden name (Frontend Rule 17).
