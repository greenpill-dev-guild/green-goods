# Test Quality Remediation

**GitHub Issue**: N/A (internal audit)
**Branch**: `chore/test-quality-remediation`
**Status**: ACTIVE
**Created**: 2026-03-11
**Last Updated**: 2026-03-11

## Context

Two independent audits identified systemic test quality issues across the monorepo:
- **Shared**: 177 files, ~2352 tests — healthy but `isolate: false` risks hidden coupling
- **Admin**: 28 files, ~288 tests — AppKit side effects and duplicate test files
- **Client**: 18 files, 155 tests — **40 failing (26%)**, primary user flows untested
- **E2E**: 15 Playwright specs — exist but `.ci.spec.ts` files not gated in unit test CI

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Fix `isolate: false` before fixing broken tests | Ensures test fixes aren't masked by shared state |
| 2 | Use `vi.importActual` + partial overrides instead of full barrel mocks | Prevents future mock drift — test breaks at import site when shared changes |
| 3 | Keep organized (subdirectory) test files, delete flat duplicates | Flat files are older/smaller; organized ones match hook directory structure |
| 4 | Keep `__tests__/` convention, delete co-located duplicates | Repo convention is `__tests__/`; co-located files break the pattern |
| 5 | Fix CookieJarTab decimals as a product bug, not test fix | Hardcoded `decimals = 18` is wrong for non-18-decimal tokens |
| 6 | Make AppKit init lazy via dynamic import | Side-effect-free barrel imports are critical for test isolation |
| 7 | Add `critical-path` E2E project to unit test CI as a separate job | Lightweight CI specs don't need live infrastructure |
| 8 | Don't mock fetch as always-OK globally | Unmocked network calls should fail loudly, not return `{ ok: true }` |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Shared test isolation | Step 1 | ✅ 2730/2730 pass with isolate:true |
| AppKit side-effect-free imports | Step 2 | ✅ Lazy getters, 20 consumers + 26 test mocks updated |
| Client tests passing (0% failure) | Steps 3a-3d | ✅ 174/174 pass (was 40 failing) |
| CookieJarTab decimals bug fixed | Step 4 | ✅ jar.decimals + useMemo deps fixed |
| No duplicate test files | Step 5 | ✅ Admin co-located deleted, shared kept (complementary) |
| Work submission flow tested | Step 6 | ✅ Intro/Details/Review tests created (19 new tests) |
| E2E CI specs gated in CI | Step 7 | ✅ Already in e2e-tests.yml --project=critical-path |
| Strict test setup (no false-OK fetch) | Step 8 | ✅ Throws on unexpected fetch calls |
| Offline-first unit tests | Step 9 | ⏳ Backlog — needs dedicated effort |
| Async flake surface reduced | Step 10 | ⏳ Audited: 450 waitFor, 59 setTimeout, 16 fakeTimers |
| Stale admin assertions fixed | Step 11 | 🔄 Agent fixing (importOriginal pattern) |
| Shared coverage thresholds raised | Step 12 | ⏳ Current: 63% (below 70% threshold) — needs test additions |
| Centralized mock utilities | Step 13 | ✅ createSharedBarrelMock() in shared/testing |

## CLAUDE.md Compliance
- [x] Hooks in shared package (no hook changes)
- [x] `bun run test` not `bun test`
- [x] Single `.env` at root
- [ ] Validation: `bun format && bun lint && bun run test && bun build`

## Impact Analysis

### Files to Modify
- `packages/shared/vitest.config.ts` — Set `isolate: true`
- `packages/shared/src/config/appkit.ts` — Lazy init pattern
- `packages/shared/src/__tests__/setupTests.base.ts` — Strict fetch mock
- `packages/client/src/__tests__/components/Cards.test.tsx` — Fix barrel mocks
- `packages/client/src/__tests__/components/ImagePreviewDialog.test.tsx` — Fix re-export mock
- `packages/client/src/__tests__/components/TopNav.test.tsx` — Fix barrel mocks
- `packages/client/src/__tests__/views/ENSSection.test.tsx` — Fix barrel mocks
- `packages/client/src/__tests__/views/Garden.test.tsx` — Add `useAudioRecording` to mock
- `packages/client/src/__tests__/views/HomeGarden.test.tsx` — Add `useUIStore` to mock
- `packages/client/src/__tests__/views/Media.test.tsx` — Fix barrel mocks
- `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx` — Fix decimals bug
- `packages/client/src/views/Home/WalletDrawer/CookieJarTab.test.tsx` — Move to `__tests__/`
- `packages/admin/src/__tests__/views/WorkDetail.test.tsx` — Add `Confidence` to mock
- `.github/workflows/e2e-tests.yml` — Consider adding critical-path job

### Files to Delete
- `packages/shared/src/__tests__/hooks/useJoinGarden.test.ts` (flat duplicate)
- `packages/shared/src/__tests__/hooks/useAutoJoinRootGarden.test.ts` (flat duplicate)
- `packages/admin/src/components/Work/CookieJarPayoutPanel.test.tsx` (co-located duplicate)
- `packages/admin/src/components/Vault/WithdrawModal.test.tsx` (co-located duplicate)

### Files to Create
- `packages/client/src/__tests__/views/WorkIntro.test.tsx`
- `packages/client/src/__tests__/views/WorkDetails.test.tsx`
- `packages/client/src/__tests__/views/WorkReview.test.tsx`
- `packages/shared/src/__tests__/test-utils/shared-barrel-mock.ts` (centralized mock factory)

## Test Strategy
- **Unit tests**: Fix 40 broken client tests, verify shared suite still passes with `isolate: true`
- **Integration tests**: New work submission flow tests (Intro, Details, Review)
- **E2E tests**: Wire `.ci.spec.ts` into CI as a separate job
- **Validation gate**: `bun run test` must pass in all 3 packages after each step

---

## Implementation Steps

### Phase 1: Infrastructure (P0) — Fix This Week

#### Step 1: Enable shared test isolation
**Files**: `packages/shared/vitest.config.ts`
**Details**:
- Change `isolate: false` to `isolate: true` at line 36
- Run `cd packages/shared && bun run test` to verify all 2730 tests still pass
- If any fail, they were relying on leaked state — fix those tests individually
**Verify**: `cd packages/shared && bun run test` — 0 failures

#### Step 2: Make AppKit initialization lazy
**Files**: `packages/shared/src/config/appkit.ts`
**Details**:
- Remove eager `export const { appKit, wagmiConfig } = ensureAppKit();` at line 154
- Replace with lazy getter pattern:
  ```typescript
  let _cachedAppKit: ReturnType<typeof ensureAppKit> | null = null;
  function getAppKitSingleton() {
    if (!_cachedAppKit) _cachedAppKit = ensureAppKit();
    return _cachedAppKit;
  }
  export function getAppKit() { return getAppKitSingleton().appKit; }
  export function getWagmiConfig() { return getAppKitSingleton().wagmiConfig; }
  ```
- Update all consumers that import `appKit` or `wagmiConfig` directly to use the getter functions
- Verify no tests produce 403/network warnings from AppKit initialization
**Verify**: `bun run test` across shared + admin — no AppKit network warnings in output

#### Step 3a: Fix client barrel mock drift — Garden + HomeGarden + Media views
**Files**: `packages/client/src/__tests__/views/Garden.test.tsx`, `HomeGarden.test.tsx`, `Media.test.tsx`
**Details**:
- In `Garden.test.tsx` line 44: add `useAudioRecording` to the `@green-goods/shared` mock (returns `{ isRecording: false, startRecording: vi.fn(), stopRecording: vi.fn(), audioUrl: null }`)
- In `HomeGarden.test.tsx` line 38: add `useUIStore` to the mock (return state object matching the Zustand store)
- In `Media.test.tsx`: identify missing exports from barrel mock and add them
- Use `vi.importActual("@green-goods/shared")` where practical to reduce mock surface
**Verify**: `cd packages/client && bun run test -- --reporter=verbose Garden HomeGarden Media` — 0 failures

#### Step 3b: Fix ImagePreviewDialog re-export mock
**Files**: `packages/client/src/__tests__/components/ImagePreviewDialog.test.tsx`
**Details**:
- The component at `packages/client/src/components/Dialogs/ImagePreviewDialog.tsx` is a pure re-export from shared (lines 1-2)
- The test must mock `@green-goods/shared` to include `ImagePreviewDialog` as a component, not just `cn`
- Alternative: test should import directly from `@green-goods/shared` and mock the component there, or mock the client re-export path
**Verify**: `cd packages/client && bun run test -- --reporter=verbose ImagePreviewDialog` — 13/13 passing

#### Step 3c: Fix client Cards + TopNav + ENSSection tests
**Files**: `packages/client/src/__tests__/components/Cards.test.tsx`, `TopNav.test.tsx`, `packages/client/src/__tests__/views/ENSSection.test.tsx`
**Details**:
- `Cards.test.tsx`: 12/27 failing — ActionCard and GardenCard broken. Audit the barrel mock for missing exports, verify card props match current component interfaces
- `TopNav.test.tsx`: 2/8 failing — notification bell visibility. Check if component markup changed, update selectors
- `ENSSection.test.tsx`: 3/3 failing — ENS registration state. Check if hook return shapes or component structure changed
**Verify**: `cd packages/client && bun run test -- --reporter=verbose Cards TopNav ENSSection` — 0 failures

#### Step 3d: Fix CookieJarTab test + move to __tests__
**Files**: `packages/client/src/views/Home/WalletDrawer/CookieJarTab.test.tsx` → `packages/client/src/__tests__/views/CookieJarTab.test.tsx`
**Details**:
- Move test file from co-located to `__tests__/views/`
- Fix assertions: component renders `0.000000000000123456` not `0.123456` because of the hardcoded decimals
- Update assertions to match current (buggy) behavior, OR fix the bug first (Step 4) then write assertions for correct behavior
**Verify**: `cd packages/client && bun run test -- --reporter=verbose CookieJarTab` — 2/2 passing

#### Step 4: Fix CookieJarTab decimals production bug
**Files**: `packages/client/src/views/Home/WalletDrawer/CookieJarTab.tsx`
**Details**:
- Line 30: Replace `const decimals = 18;` with `const decimals = jar.decimals;` (the `CookieJar` type already has a `decimals` field from the mock factory)
- Verify the `CookieJar` type includes `decimals: number` — if not, check `getVaultAssetDecimals()` utility
- Update the test to assert correct formatting with variable decimals
**Verify**: `cd packages/client && bun run test -- --reporter=verbose CookieJarTab` — all passing with correct decimal formatting

---

### Phase 2: Cleanup (P1) — Next Sprint

#### Step 5: Deduplicate test files
**Files**: See "Files to Delete" above
**Details**:
- **Shared**: Delete flat duplicates, keep organized:
  - DELETE `__tests__/hooks/useJoinGarden.test.ts` (311 lines, older) — KEEP `__tests__/hooks/garden/useJoinGarden.test.ts` (155 lines, but check if flat version has extra cases to merge first)
  - DELETE `__tests__/hooks/useAutoJoinRootGarden.test.ts` (331 lines) — KEEP `__tests__/hooks/garden/useAutoJoinRootGarden.test.ts` (120 lines, same — check for extra cases)
  - **Important**: Before deleting, diff the flat vs organized versions. If the flat version has test cases the organized one doesn't, merge those cases into the organized file first
- **Admin**: Delete co-located duplicates, keep `__tests__/`:
  - DELETE `src/components/Work/CookieJarPayoutPanel.test.tsx` (101 lines) — KEEP `__tests__/components/CookieJarPayoutPanel.test.tsx` (110 lines)
  - DELETE `src/components/Vault/WithdrawModal.test.tsx` (126 lines) — KEEP `__tests__/components/WithdrawModal.test.tsx` (129 lines)
- **Move misplaced files**:
  - `admin/src/views/Gardens/Garden/Vault.test.tsx` → `admin/src/__tests__/views/Vault.test.tsx`
  - `shared/src/utils/blockchain/vaults.test.ts` → `shared/src/__tests__/utils/vaults.test.ts`
**Verify**: `bun run test` in shared + admin + client — same pass count, no regressions

#### Step 6: Add work submission flow tests
**Files**: Create 3 new test files
**Details**:
- `packages/client/src/__tests__/views/WorkIntro.test.tsx`:
  - Test garden/action selection rendering
  - Test action filtering by active status
  - Test navigation to next step
- `packages/client/src/__tests__/views/WorkDetails.test.tsx`:
  - Test form input rendering for different action types
  - Test location toggle behavior
  - Test multi-select state management
  - Test dynamic field rendering based on action inputs
- `packages/client/src/__tests__/views/WorkReview.test.tsx`:
  - Test review display with all submitted data
  - Test media URL generation
  - Test submit button state (disabled/enabled)
  - Test submission flow (calls correct mutation)
- Use `vi.importActual` pattern established in Step 3 to reduce mock brittleness
**Verify**: `cd packages/client && bun run test -- --reporter=verbose WorkIntro WorkDetails WorkReview` — all passing

#### Step 7: Wire E2E CI specs into CI pipeline
**Files**: `.github/workflows/e2e-tests.yml`
**Details**:
- The E2E workflow already exists and runs on push/PR to main/develop
- It already includes `--project=critical-path` which matches `.ci.spec.ts` files
- **Verify it actually works**: The workflow requires Docker (for indexer), Playwright browsers, and a client build
- If the `critical-path` specs are truly mock-based and don't need live services, consider adding a lightweight CI job that runs only those specs with `SKIP_WEBSERVER=true`
- The 4 CI specs: `admin.production-flows.ci.spec.ts`, `client.offline-sync.ci.spec.ts`, `client.work-approval.ci.spec.ts`, `client.work-submission.ci.spec.ts`
**Verify**: Trigger workflow manually via `workflow_dispatch`, confirm critical-path project runs

#### Step 8: Tighten base test setup
**Files**: `packages/shared/src/__tests__/setupTests.base.ts`
**Details**:
- Lines 49-54: Replace always-OK fetch mock with one that throws on unexpected calls:
  ```typescript
  global.fetch = vi.fn().mockImplementation((url: string) => {
    throw new Error(`Unexpected fetch call to: ${url}. Mock this endpoint explicitly.`);
  });
  ```
- Lines 57-62: Stop mocking `console.warn` and `console.error` globally. Instead, let each test file opt into suppression if needed:
  ```typescript
  // Remove global console mocking
  // Individual tests can use vi.spyOn(console, 'warn').mockImplementation() if needed
  ```
- **Caution**: This will likely surface new test failures in tests that relied on fetch always returning OK. Fix each one by adding explicit fetch mocks in the affected test files
**Verify**: `bun run test` — identify and fix any newly-surfaced failures

---

### Phase 3: Coverage Expansion (P2) — Backlog

#### Step 9: Add offline-first unit tests
**Files**: Create new test files in client
**Details**:
- Test `shouldDehydrateQuery` logic in `packages/client/src/App.tsx` — verify it filters by status, fetchStatus, key prefix, and excludes queue keys
- Test service worker sync handler in `packages/client/public/sw-custom.js` (may need separate test environment)
- Test IndexedDB queue persistence via shared `JobQueueProvider`
- Test draft auto-save/resume integration

#### Step 10: Reduce async flake surface
**Details**:
- Audit all 378 `waitFor` calls for excessive timeouts or missing `act()` wrappers
- Audit all 55 `setTimeout` usages in tests — replace with `vi.useFakeTimers()` where possible
- Add `--retry=2` to CI test commands as a safety net while fixing flakes

#### Step 11: Fix stale admin assertions
**Files**: `packages/admin/src/views/Gardens/Garden/Vault.test.tsx`, `packages/admin/src/__tests__/views/WorkDetail.test.tsx`
**Details**:
- Vault back-link expectations may differ from current implementation (lines 130-133)
- WorkDetail mock missing `Confidence` enum export from shared barrel
- Audit all admin test assertions against current component markup

#### Step 12: Raise shared coverage thresholds
**Files**: `packages/shared/vitest.config.ts`
**Details**:
- Raise from 70% → 80% for branches, functions, lines, statements
- Run `cd packages/shared && bun run test -- --coverage` to verify current coverage meets 80%
- If below 80%, identify the uncovered modules and add targeted tests before raising thresholds

#### Step 13: Centralize mock setup
**Files**: Create `packages/shared/src/__tests__/test-utils/shared-barrel-mock.ts`
**Details**:
- Create a centralized mock factory that produces a complete `@green-goods/shared` mock
- Uses `vi.importActual` to pull in real types and utilities, only mocking hooks that need it
- Admin and client test setups import this instead of hand-crafting barrel mocks
- When shared adds a new export, the centralized mock auto-inherits it (real implementation) or breaks loudly (if it needs mocking)

---

## Validation

After each phase:
```bash
bun format && bun lint && bun run test && bun build
```

Phase 1 success criteria: `bun run test` passes in all 3 packages with 0 failures.
Phase 2 success criteria: No duplicate test files, work submission flow covered, E2E in CI.
Phase 3 success criteria: 80% coverage in shared, centralized mocks, reduced flake surface.
