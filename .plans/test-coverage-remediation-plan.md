# Test Coverage & Quality Remediation Plan

**Status**: ACTIVE (Phases 1-2 DONE, Phases 3-4 remaining)
**Tracks**: https://github.com/greenpill-dev-guild/green-goods/issues/312
**Created**: 2026-02-13
**Last Updated**: 2026-02-17
**Completed**: Gardens Protocol Test Coverage (200 tests), CLAUDE.md `bun test` → `bun run test` fix, Phase 1 (test foundation), Phase 2 (command policy + agent/skill updates)

### Phase 1+2 Completion Summary (2026-02-17)

Executed by 6-teammate pair-lane team (chain/middleware/app drivers + observers):

| Item | Result | Details |
|------|--------|---------|
| 1.1 TopNav tests | Previously done | IntlProvider wrapper |
| 1.2 RequireOperatorOrDeployer | Previously done | Denial assertion |
| 1.3 Indexer @ts-nocheck | DONE | Replaced with single scoped @ts-expect-error |
| 1.4 Login.test.tsx placeholder | DONE | Real credential detection assertions |
| 1.5 No-op assertions | DONE | 10 expect(true) replaced with behavioral assertions |
| 1.6 Cards.test.skip.tsx | DONE | 27 tests re-enabled (dual mock path fix) |
| 1.7 Gardens.test.skip.tsx | DONE | 7 tests re-enabled |
| 1.8 unauthorized-actions.test.skip.tsx | DONE | 6 tests re-enabled |
| 1.9 Home.test.tsx.skip | DONE | 5 tests re-enabled |
| 1.10 Skip governance | DONE | 2 remaining skips have #312 + owner + 2026-03-17 expiry |
| 1.11 Admin thresholds | Previously done | 70% global |
| 1.12 Indexer coverage | DONE | c8 + mocha, 58% baseline |
| 1.13 Client test-utils | DONE | Created with provider wrappers |
| 2.1 bun test refs | DONE | All actionable refs fixed in .claude/ files |
| 2.2 Testing skill | DONE | Hook cleanup, mutation errors, offline, critical paths |
| 2.3 cracked-coder checklist | DONE | Test Adequacy Checklist after TEST phase |
| 2.4 code-reviewer pass | DONE | Pass 5.5: Test Coverage Check |
| 2.5 contracts skill | Previously done | Part 5 patterns |
| 2.6 tdd-bugfix | DONE | Regression test placement guidance |
| 2.7 cross-package-verify | DONE | Test quality checks at Domain 2 + Domain 3 |

Net result: **45 previously-skipped tests re-enabled**, zero expect(true) assertions, zero @ts-nocheck in tests, all agent/skill files updated with test quality guidance.

> Merged from: 6-teammate adversarial audit (Opus team) + Codex audit ([#312](https://github.com/greenpill-dev-guild/green-goods/issues/312))

## Implementation Notes

### Gardens Protocol Test Coverage (DONE)
200 tests pass across 4 suites: `GardensModule.t.sol` (82), `GardenAccount.t.sol` (75), `GardenToken.t.sol` (35), `FullModuleWiring.t.sol` (8). Known pre-existing failures documented in `HatsModule.t.sol` and `RoleHierarchy.t.sol`.

### Fork Test Suite (PENDING)
Comprehensive E2E fork tests planned: `ForkTestBase.sol` (shared infra), `FullProtocolE2E.t.sol`, `EASAttestationLifecycle.t.sol`, `GardensV2Community.t.sol`. Extends `DeploymentBase` to reuse production deployment logic against real on-chain contracts. See Phase 3 below.

### Dead-Code Cleanup Impact (2026-02-16)
Several files referenced by or adjacent to this plan were deleted as part of dead-code cleanup on the `feature/ens-integration` branch:
- `packages/client/src/routes/RequireInstalled.tsx` and its test `__tests__/routes/RequireInstalled.test.tsx` — deleted (no plan item affected; the route was unused dead code)
- `packages/client/src/components/Boundaries/` (SuspenseBoundary, SuspenseRoute, index) — deleted (unused dead code)
- `packages/client/src/styles/colors.css` — deleted (unused dead code)
- `packages/indexer/config.yaml.backup` — deleted (stale backup file)
These deletions reduce the surface area for Phase 1 and Phase 4 client test items. No plan items are blocked by these removals.

## Context

Two independent audits on the same day (Feb 13, 2026) converged on the same conclusion: test quality is **significantly below CLAUDE.md targets** and the agent/docs tooling actively contributes to the problem by recommending wrong commands and lacking test adequacy definitions.

| Package | Current Coverage | CLAUDE.md Target | Verdict |
|---------|-----------------|------------------|---------|
| Contracts | ~80% (14K test lines) | 80% testnet / 100% mainnet | PASS (but `forge coverage` blocked by Yul) |
| Indexer | **0%** (test crashes) | Not specified | **FAIL** |
| Shared | **~28-43%** | 80% critical / 70% overall | **FAIL** |
| Client | **~16%** | 80% critical / 70% overall | **FAIL** |
| Admin | **~29%** | 70% critical / 70% overall | **FAIL** |

Root causes:
1. Broken tests erode CI confidence (9 failing, 3 skipped files, 1 crashing suite)
2. Agent files guide AI to write insufficient tests (`bun test` footgun, no adequacy checklist)
3. No CI-enforced coverage gates — thresholds exist in some configs but aren't gated
4. Critical E2E flows are permanently skipped with no ownership or expiry
5. Weak test signal patterns (`expect(true).toBe(true)`, `|| true`, `@ts-nocheck`)

---

## Phase 1: Fix Broken Test Foundation

*Goal: All suites green, all skips re-enabled or tracked with issue links.*

### 1.1 Fix client TopNav tests (8 failing)

**File:** `packages/client/src/__tests__/components/TopNav.test.tsx`
**Root cause:** Component uses `useIntl()` but tests render without `IntlProvider`. A `createWrapper()` exists but isn't used.
**Fix:** Wrap all render calls with the existing Wrapper that includes IntlProvider.

### 1.2 Fix admin RequireOperatorOrDeployer test (1 failing)

**File:** `packages/admin/src/__tests__/routes/RequireOperatorOrDeployer.test.tsx`
**Root cause:** Stale assertion expects `role: "user"` sees "Protected Content", but the guard correctly blocks users now.
**Fix:** Assert "Unauthorized" for user role. Update test name to reflect correct denial behavior.

### 1.3 Fix indexer test crash [from Codex #312]

**File:** `packages/indexer/test/test.ts`
**Root cause:** Crash at `FractionPurchased.handler` registration in `src/EventHandlers.ts`. Also uses `@ts-nocheck`.
**Fix:** Fix handler registration, remove `@ts-nocheck`, ensure `bun run test` passes.

### 1.4 Fix Login.test.tsx placeholder assertion

**File:** `packages/client/src/__tests__/views/Login.test.tsx` (~line 215)
**Root cause:** `expect(true).toBe(true)` placeholder because dynamic re-mocking is awkward.
**Fix:** Use `vi.doMock()` with dynamic import, or split into separate test file.

### 1.5 Eliminate no-op assertions [from Codex #312]

**Scope:** All test files
**Root cause:** `expect(true)` and `|| true` patterns provide false confidence.
**Fix:** Search all test files for `expect(true)`, `expect(false)`, `|| true` and replace with real assertions. Add oxlint or biome rule to prevent future occurrences.

### 1.6 Unblock Cards.test.skip.tsx (28 skipped tests)

**File:** `packages/client/src/__tests__/components/Cards.test.skip.tsx`
**Root cause:** `vi.mock("../../components/Display")` doesn't resolve `@/` alias (documented in lines 7-11).
**Fix:** Update mock paths to use `@/` alias or configure vitest alias resolution for mocks. Rename `.test.skip.tsx` → `.test.tsx`.

### 1.7 Re-enable Gardens.test.skip.tsx (7 skipped tests)

**File:** `packages/admin/src/__tests__/views/Gardens.test.skip.tsx`
**Fix:** Rename to `.test.tsx`, run, fix any breakages.

### 1.8 Re-enable unauthorized-actions.test.skip.tsx (7 security tests)

**File:** `packages/admin/src/__tests__/workflows/unauthorized-actions.test.skip.tsx`
**Fix:** Rename to `.test.tsx`, run, fix any breakages.

### 1.9 Re-enable Home.test.tsx.skip [from Codex #312]

**File:** `packages/client/src/__tests__/views/Home.test.tsx.skip`
**Fix:** Rename, run, fix. If not fixable immediately, create a tracked issue with owner + expiry.

### 1.10 Establish skip governance policy [from Codex #312]

**Policy:** Any remaining `.skip` or `test.skip()` must include:
- Issue link (e.g., `// SKIP: #312 — path alias resolution`)
- Owner (who will fix it)
- Expiry date (when it should be revisited)
- No permanent top-level `test.skip(() => true, ...)` allowed

### 1.11 Add admin coverage thresholds

**File:** `packages/admin/vitest.config.ts`
**Fix:** Add `thresholds` block matching client's (75/80/80/80).

### 1.12 Add indexer coverage command [from Codex #312]

**File:** `packages/indexer/package.json`
**Fix:** Add coverage script + threshold policy (c8+mocha or equivalent).

### 1.13 Create client shared test-utils wrapper

**Fix:** Create `packages/client/src/__tests__/test-utils.tsx` mirroring admin's pattern with IntlProvider + QueryClient wrapper.

**Phase 1 verification:**
```bash
cd packages/client && bun run test    # All pass, zero skipped
cd packages/admin && bun run test     # All pass, zero skipped
cd packages/indexer && bun run test   # Passes, no crash
cd packages/shared && bun run test    # All pass
```

---

## Phase 2: Unify Test Command Policy Across Agent/Docs

*Goal: No agent, skill, context, or hook file recommends `bun test` where `bun run test` is required.*

### 2.1 Audit and fix `bun test` vs `bun run test` everywhere [from Codex #312]

**Scope:** All files in `.claude/` + `CLAUDE.md`

The `bun test` command:
- In `packages/contracts`: runs vendored JS tests under `lib/**` instead of Foundry
- In `packages/shared/client/admin`: invokes bun's built-in runner (ignores vitest config, no jsdom)
- Correct form: `bun run test` (runs the `"test"` script in package.json)

**(PARTIALLY DONE — CLAUDE.md has correct "CRITICAL: `bun test` vs `bun run test`" callout since 2026-02-15. Some `.claude/` skills already warn about the distinction: `testing/SKILL.md` line 79, `debug/SKILL.md` line 102, `cross-package-verify/SKILL.md` lines 68+286, `tdd-bugfix/SKILL.md` lines 83+309, `autonomous-review/SKILL.md` line 107, `cracked-coder.md` line 150. However, ~30+ occurrences of bare `bun test` as a recommended command still exist across `.claude/` files — see list below.)**

**Files still needing update:**
- `.claude/skills/testing/SKILL.md` — Commands section (lines 322-327, 341, 368) uses `bun test`
- `.claude/skills/migration/SKILL.md` — lines 70, 85, 317, 352 use `bun test`
- `.claude/skills/ci-cd/SKILL.md` — lines 222, 225, 235, 279 use `bun test`
- `.claude/skills/git-workflow/SKILL.md` — lines 147, 160, 210 use `bun test`
- `.claude/skills/dependency-management/SKILL.md` — line 105 uses `bun test`
- `.claude/skills/review/SKILL.md` — line 218 uses `bun test`
- `.claude/skills/plan/SKILL.md` — lines 109, 274 use `bun test`
- `.claude/skills/biome/SKILL.md` — line 184 uses `bun test`
- `.claude/skills/audit/SKILL.md` — line 218 uses `bun test`
- `.claude/commands/review.md` — line 33 uses `bun test`
- `.claude/commands/plan.md` — line 56 uses `bun test`
- `.claude/commands/audit.md` — line 37 uses `bun test`
- `.claude/commands/debug.md` — line 48 uses `bun test`
- `.claude/agents/migration.md` — lines 138, 227 use `bun test`
- `.claude/agents/code-reviewer.md` — line 182 uses `bun test`
- `.claude/context/shared.md` — line 9 uses `bun test`
- `.claude/context/indexer.md` — line 16 uses `bun test`
- `.claude/skills/_archived/vitest/SKILL.md` — lines 262-277, 293 use `bun test` (archived, low priority)
- `.claude/skills/_archived/test-driven-development/SKILL.md` — lines 92, 142, 215 use `bun test` (archived, low priority)

**Fix:** Global find-and-replace `bun test` → `bun run test` in all `.claude/` files, with exceptions only where `bun test` is explicitly the correct command (currently: only `packages/agent` file-based DB tests per `.claude/context/agent.md` line 273).

### 2.2 Update testing skill — add patterns, define critical paths

**File:** `.claude/skills/testing/SKILL.md` (389 lines)

**After line 317 (end of Green Goods Patterns), add:**

- **"Testing Hook Cleanup (Rules 1-3)"** — Timer cleanup test with `vi.useFakeTimers()` + unmount, event listener test with `removeEventListener` spy, async mount guard test
- **"Testing Mutation Error Paths"** — `mockRejectedValue` + error state assertion + error tracker verification
- **"Testing Offline Scenarios"** — `navigator.onLine = false` + queue assertion pattern
- **"Critical Paths for Shared Package"** — Enumerate the 80%+ target hooks: auth (useAuth, useUser, usePrimaryAddress), work mutations (useWorkMutation, useBatchWorkApproval), offline/drafts (useDrafts, useDraftAutoSave, useDraftResume), blockchain infra (useContractTxSender, useChainConfig), architectural hooks (useAsyncEffect, useEventListener, useTimeout)

### 2.3 Update cracked-coder — add test adequacy checklist

**File:** `.claude/agents/cracked-coder.md` (291 lines)

**After line 137 (end of TEST phase), insert:**

A. **Test Adequacy Checklist** — agents must satisfy before TEST → IMPLEMENT:
  - Happy path tested
  - Error paths tested (invalid inputs, network failures, empty data)
  - Edge cases covered (undefined/null, empty arrays, zero values)
  - For hooks: cleanup behavior tested (unmount doesn't leak)
  - For mutations: success + error callbacks tested
  - Mock factories used from `__tests__/test-utils/mock-factories.ts`

B. **Hook testing example** — `renderHook` + `waitFor` with wrapper, disabled state, error state, unmount

C. **RED verification** — "Run specific test file first (`bun run test -- hookName.test.ts`) to verify RED before full suite at VERIFY"

### 2.4 Update code-reviewer — add test coverage review pass

**File:** `.claude/agents/code-reviewer.md` (344 lines)

**After line 145 (end of Pass 5), add "Test Coverage Check":**
- Every new hook/function has corresponding test file
- Tests cover happy + error + edge cases
- Mock factories used (not inline mocks)
- No `bun test` (wrong runner) in scripts
- No new `.skip` or `.only` committed
- No `expect(true)` or `|| true` assertions
- Coverage hasn't regressed

**Lines 283-297 (Architectural Rules table), add:**
`| 14 | **Test Coverage** | New hooks/functions without tests | Add tests following TDD, use mock factories |`

### 2.5 Update contracts skill — add test examples

**File:** `.claude/skills/contracts/SKILL.md` (422 lines)

**After line 243 (end of Part 5 Testing), insert:**
- Unit test pattern (`vm.prank` + `assertEq`)
- Revert test pattern (`vm.expectRevert` with selector encoding)
- Upgrade safety test (store state → upgrade → verify preserved, MANDATORY for UUPS)
- Test organization guide (`test/{unit,integration,fork,fuzz,invariant,helpers}/`)
- Forge test flags reference (`-vvv`, `--match-contract`, `--match-test`, `--gas-report`)
- Note: `forge coverage` currently blocked by Yul/stack-too-deep constraints — use targeted suite health + gas checks as interim policy [from Codex #312]

### 2.6 Update tdd-bugfix — add regression test placement

**File:** `.claude/skills/tdd-bugfix/SKILL.md` (321 lines)

**After line 94 (end of Step 1), insert:**
- If test file exists for affected module, add regression test there
- If not, create following `__tests__/hooks/useAffected.test.ts` pattern
- Name: `"handles [edge case] (regression #issue)"`
- Check existing tests first — the bug may reveal a coverage gap

### 2.7 Update cross-package-verify — add test quality checks

**File:** `.claude/skills/cross-package-verify/SKILL.md` (299 lines)

**After line 82 (Domain 2 "What to check"), add:**
- New hooks in `src/hooks/` have corresponding tests in `__tests__/hooks/`
- Test coverage hasn't regressed for critical paths
- Mock factories cover any new domain types

**After line 164 (Domain 6 "What to check"), add:**
- Root `bun run test` passes
- No `.skip` or `.only` committed
- `bun test` (wrong runner) not used in scripts

**Phase 2 verification:** `grep -r "bun test" .claude/ CLAUDE.md --include="*.md" --include="*.json"` — should only match contexts explaining the distinction, never as a recommended command.

---

## Phase 3: CI Coverage Enforcement [from Codex #312]

*Goal: Coverage thresholds are CI-gated so they can never regress silently.*

### 3.1 Add coverage gates to CI workflows

**Scope:** GitHub Actions workflow files
- Shared/client/admin: run vitest with `--coverage` and fail if below thresholds
- Contracts: document Yul blocker, use `forge test` pass/fail + gas regression as proxy
- Indexer: add coverage step after fixing test crash (Phase 1.3)

### 3.2 Add guardrails against weak tests [from Codex #312]

- Add lint/review check for `expect(true)` / `|| true` / `expect(false)` patterns
- Add CI check that no new `.skip` files are committed without issue link comment
- Fail CI if `@ts-nocheck` appears in first-party test files

### 3.3 E2E critical path automation [from Codex #312]

**Skipped E2E files to restore:**
- `tests/specs/client.work-submission.spec.ts`
- `tests/specs/client.work-approval.spec.ts`
- `tests/specs/client.offline-sync.spec.ts`

**Fix:** Define at least one CI-automated path for submission, approval, and offline sync (mocked infra acceptable). Keep smoke tests, but require at least one deeper critical-path spec in CI.

---

## Phase 4: Add Critical Missing Tests (Incremental)

*Goal: Close the biggest coverage gaps. Each item is independent.*

### Shared Package — Hook Coverage Map (51 untested of 89)

**P0 — Zero-coverage domains + core value prop:**

| Item | Files | Test Focus |
|------|-------|------------|
| 4.1 query-keys.ts | `hooks/query-keys.ts` (499 lines) | Key factory shapes, invalidation scope, serialization stability |
| 4.2 blockchain hooks | `hooks/blockchain/` (10 hooks, 0 tested) | useContractTxSender lifecycle, useChainConfig, useDeploymentRegistry |
| 4.3 work hooks | `hooks/work/` (13 hooks, 2-3 tested) | useDraftAutoSave, useDraftResume, useDrafts, useBatchWorkApproval, useBatchWorkSync, useWorkForm, useSubmissionProgress |

**P1 — Architectural + error handling:**

| Item | Files | Test Focus |
|------|-------|------------|
| 4.4 utility hooks | `hooks/utils/` (useTimeout, useEventListener, useAsyncEffect, useCopyToClipboard) | Cleanup on unmount, re-subscription, null target edge cases |
| 4.5 error utils | `utils/errors/` (categorize-error, mutation-error-handler, extract-message, blockchain-errors) | Categorization, user-friendly mapping, blockchain error parsing |
| 4.6 workflow hooks | `hooks/garden/useCreateGardenWorkflow`, `hooks/assessment/useCreateAssessmentWorkflow`, `hooks/hypercerts/useCreateHypercertWorkflow` | XState transitions, step validation, error recovery |

**P2 — Remaining domains:**

| Item | Files | Test Focus |
|------|-------|------------|
| 4.7 assessment hooks | `hooks/assessment/` (2 hooks, 0 tested) | Assessment workflow, garden assessments |
| 4.8 translation hooks | `hooks/translation/` (3 hooks, 0 tested) | i18n wrapper behavior |
| 4.9 garden hooks | `hooks/garden/` (5 untested) | Permissions, filtering, invites, tabs |
| 4.10 hypercerts hooks | `hooks/hypercerts/` (4 untested) | Attestations, drafts, hypercert data |

### Indexer — From Zero to Covered

| Item | Files | Test Focus |
|------|-------|------------|
| 4.11 EventHandlers | `src/EventHandlers.ts` (1,649 lines, 31 handlers) | Event parsing, entity CRUD, edge cases (duplicates, missing fields) |

### Contracts — Gap Filling

| Item | Files | Test Focus |
|------|-------|------------|
| 4.12 UnlockModule | UUPS upgradeable, 0 tests | Upgrade safety, storage layout, access control, lock/unlock |
| 4.13 EASLib | No dedicated unit test | Schema encoding, attestation parsing |
| 4.14 Fork test stubs | Arbitrum/Celo/Sepolia stubs (38 lines each) | Replace with real assertions or remove |

### Client + Admin — Critical Path Tests

| Item | Files | Test Focus |
|------|-------|------------|
| 4.15 Client work flow | Views: Garden/{Details,Intro,Review}, WorkDashboard | Primary user journey |
| 4.16 Client offline UI | OfflineIndicator, DraftDialog, DraftCard | Offline-first differentiator |
| 4.17 Admin operator views | Dashboard, Garden Detail, Vault, CreateGarden, Actions CRUD | Core operator paths |
| 4.18 Admin vault components | 5 vault components (deposit, withdraw, positions, events, donation) | Financial operations |

### Reference: Domains With Excellent Coverage (Replicate These Patterns)

- **conviction/** — 100% (14/14 hooks, 43 tests) — exemplary tuple destructuring, address normalization, passkey routing, cache invalidation
- **vault/** — 100% (5/5 hooks) — well-structured mutation + error testing
- **yield/** — 100% (2/2 hooks) — follows conviction's quality pattern

---

## Execution Order

| Step | Phase | Action | Verification | CI Gate |
|------|-------|--------|--------------|---------|
| 1 | 1.1-1.3 | Fix 10 failing tests (client, admin, indexer) | All suites green | Yes |
| 2 | 1.4-1.5 | Remove no-op assertions | No `expect(true)` or `\|\| true` | Yes |
| 3 | 1.6-1.10 | Unblock skips + governance policy | Zero unexplained skips | Yes |
| 4 | 1.11-1.13 | Coverage thresholds + test-utils | Configs verified | Yes |
| 5 | 2.1 | Fix `bun test` → `bun run test` everywhere (PARTIALLY DONE — CLAUDE.md done, ~30 `.claude/` files remain) | grep returns zero matches | — |
| 6 | 2.2-2.7 | Update 6 agent/skill files | Read + verify content | — |
| 7 | 3.1-3.3 | CI coverage gates + E2E automation | CI enforces thresholds | Yes |
| 8 | 4.1-4.3 | P0 shared tests (query-keys, blockchain, work) | `bun run test --coverage` | Yes |
| 9 | 4.4-4.6 | P1 shared tests (utils, errors, workflows) | `bun run test --coverage` | Yes |
| 10 | 4.11-4.14 | Indexer + contracts gap tests | Full `bun run test` at root | Yes |
| 11 | 4.7-4.10 | P2 shared tests (remaining domains) | Coverage >50% overall | Yes |
| 12 | 4.15-4.18 | Client + admin critical path tests | Coverage >30%/40% | Yes |

---

## Definition of Done

- [ ] All package test suites green in CI (zero failures)
- [ ] No agent/document command drift (`bun test` → `bun run test` everywhere) — CLAUDE.md done, `.claude/` files ~30 occurrences remain
- [ ] Coverage thresholds exist for all TS packages and are CI-enforced
- [ ] No no-op assertions (`expect(true)`, `|| true`) in first-party tests
- [ ] No unexplained permanent skips (all `.skip` have issue link + owner + expiry)
- [ ] No `@ts-nocheck` in first-party test files
- [ ] Critical E2E flows have CI-automated coverage
- [ ] All 6 agent files updated with test quality guidance
- [ ] Shared: >50% overall, 80%+ critical paths
- [ ] Client: >30% overall (up from ~16%)
- [ ] Admin: >40% overall (up from ~29%)
- [ ] `forge coverage` blocker documented with interim policy
