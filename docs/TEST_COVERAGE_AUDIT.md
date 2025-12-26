# Test Coverage Audit Report

**Date:** December 25, 2025  
**Packages:** `packages/client`, `packages/shared`

---

## Executive Summary

Both the client and shared packages have test suites, but a **critical dependency issue** with `multiformats` is blocking several test files from loading. This is a pre-existing configuration issue unrelated to recent code changes.

### Test Execution Status

| Package | Test Files | Passing | Failing to Load | Tests Run |
|---------|------------|---------|-----------------|-----------|
| Client | 7 | 2 | 5 | 15/15 ✅ |
| Shared | 44 | 28 | 9 + 6 skipped | 259/260 ✅ |

---

## Client Package Tests

### Passing Test Files (2)

| File | Tests | Duration |
|------|-------|----------|
| `RequireInstalled.test.tsx` | 7 | 44ms |
| `Garden.integration.test.tsx` | 8 | 8ms |

### Failing to Load (5) - Blocked by Dependency Issue

| File | Error |
|------|-------|
| `Cards.test.tsx` | `multiformats` package path issue |
| `ErrorBoundary.test.tsx` | `multiformats` package path issue |
| `ImagePreviewDialog.test.tsx` | `multiformats` package path issue |
| `gardener-profile.test.tsx` | `multiformats` package path issue |
| `RequireAuth.test.tsx` | `multiformats` package path issue |

### Root Cause

```
Error: Package subpath './basics' is not defined by "exports" 
in /workspace/node_modules/multiformats/package.json
```

This error occurs when test files import from `@green-goods/shared/hooks`, which has a dependency chain that eventually imports from `@storacha/client` or `@ethereum-attestation-service/eas-sdk`, which use an incompatible `multiformats` subpath.

### Test File Inventory

```
src/__tests__/
├── components/
│   ├── Cards.test.tsx          (470 lines) ❌ Blocked
│   ├── ErrorBoundary.test.tsx  (62 lines)  ❌ Blocked
│   └── ImagePreviewDialog.test.tsx (145 lines) ❌ Blocked
├── integration/
│   └── gardener-profile.test.tsx (260 lines) ❌ Blocked
├── routes/
│   ├── RequireAuth.test.tsx    (74 lines)  ❌ Blocked
│   └── RequireInstalled.test.tsx (115 lines) ✅ Passing
├── views/
│   └── Garden.integration.test.tsx (280 lines) ✅ Passing
├── setupTests.ts
├── offline-test-helpers.ts
└── utils/
    └── test-helpers.tsx        (542 lines)
```

---

## Shared Package Tests

### Passing Test Files (28)

| Category | Test File | Tests |
|----------|-----------|-------|
| Hooks | `useGardenOperations.test.ts` | 5 |
| Hooks | `useToastAction.test.ts` | 5 |
| Hooks | `useUser.test.tsx` | 5 |
| Hooks | `useDebugMode.test.ts` | 6 |
| Modules | `eas.module.test.ts` | 7 |
| Modules | `greengoods.module.test.ts` | 6 |
| Modules | `media-resource-manager.test.ts` | 3 |
| Modules | `posthog.test.ts` | 2 |
| Modules | `posthog.throttle.test.ts` | 1 |
| Modules | `service-worker.test.ts` | 1 |
| Modules | `graphql.test.ts` | 1 |
| Modules | `job-queue.event-bus.test.ts` | 1 |
| Modules | `urql.test.ts` | 1 |
| Modules | `react-query.test.ts` | 1 |
| Providers | `garden-filtering.test.ts` | 8 |
| Utils | `contract-errors.test.ts` | 18 |
| Workflows | `authServices.test.ts` | 17 (1 failing) |
| **Total** | | **259** |

### Failing to Load (9) - Blocked by Dependency Issue

| File | Error |
|------|-------|
| `useOffline.test.ts` | `multiformats` package path |
| `job-queue.core.test.ts` | `multiformats` package path |
| `job-queue.db.test.ts` | `multiformats` package path |
| `work-submission.test.ts` | `multiformats` package path |
| `wallet-submission.test.ts` | `multiformats` no main export |
| `ens.test.ts` | `multiformats` package path |
| `text.test.ts` | `multiformats` package path |
| `simulation.test.ts` | `multiformats` package path |
| `WorkProvider.test.tsx` | Import resolution failure |

### Skipped Test Files (6)

| File | Tests | Reason |
|------|-------|--------|
| `AuthProvider.test.tsx` | 1 | Skipped |
| `deduplication.test.ts` | 4 | Skipped |
| `deduplication.similarity.test.ts` | 1 | Skipped |
| `retry-policy.module.test.ts` | 2 | Skipped |
| `passkey.test.ts` | 1 | Skipped |

### Test Failure (1)

```typescript
// src/__tests__/workflows/authServices.test.ts
FAIL: restoreSessionService returns null and clears username when server fetch fails
AssertionError: expected "spy" to be called at least once
```

This appears to be a legitimate test failure in the auth service restoration logic.

---

## Coverage Thresholds (Client)

From `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

**Note:** Coverage cannot be accurately measured while test files are failing to load.

---

## Recommendations

### Priority 1: Fix Dependency Issue (Critical)

The `multiformats` package has an export map incompatibility. Options:

1. **Update `multiformats` version** - Check if newer version fixes the exports
2. **Add resolution override** - In `package.json`:
   ```json
   "resolutions": {
     "multiformats": "^13.4.2"
   }
   ```
3. **Mock the problematic imports** - Create mock for `@storacha/client`

### Priority 2: Fix Failing Test

The `authServices.test.ts` test failure should be investigated:
- `restoreSessionService` should call `clearStoredUsername` on server fetch failure
- Check if the service implementation changed

### Priority 3: Review Skipped Tests

6 test files are marked as skipped. Review if these should be:
- Unskipped and fixed
- Removed if no longer relevant
- Documented as intentionally skipped

---

## Test Coverage by Feature Area

### Well-Tested Areas ✅

| Area | Coverage | Notes |
|------|----------|-------|
| Contract Error Handling | 18 tests | Full error mapping coverage |
| Garden Operations | 5 tests | Core operations tested |
| Toast Actions | 5 tests | UI feedback tested |
| User Hook | 5 tests | Auth state tested |
| Debug Mode | 6 tests | Feature flag tested |
| EAS Module | 7 tests | Attestation logic tested |
| Green Goods Module | 6 tests | Core data module tested |
| Garden Filtering | 8 tests | Provider logic tested |

### Under-Tested Areas ⚠️

| Area | Tests | Gap |
|------|-------|-----|
| Job Queue | ~2 blocked | Core offline functionality |
| Work Submission | 2 blocked | Critical user flow |
| Offline Sync | 1 blocked | PWA functionality |
| ENS Resolution | 1 blocked | Blockchain integration |
| Wallet Submission | 1 blocked | Transaction flow |

### Untested Areas ❌

| Area | Files | Notes |
|------|-------|-------|
| Client Components | Most | ~90 component files without tests |
| Views | Most | Only 1 view integration test |
| Routes | Partial | Only 2 route tests |

---

## Test File Metrics

### Client Package

| Metric | Count |
|--------|-------|
| Total Test Files | 7 |
| Test Lines | ~1,948 |
| Production Files | 90 |
| Production Lines | ~11,700 |
| Test/Production Ratio | ~17% |

### Shared Package

| Metric | Count |
|--------|-------|
| Total Test Files | 44 |
| Tests | 270 |
| Passing | 259 |
| Failing | 1 |
| Skipped | 10 |
| Blocked | 9 files |

---

## Action Items

### Immediate (Blocking Tests)

1. [ ] Resolve `multiformats` package compatibility issue
2. [ ] Fix `authServices.test.ts` assertion failure
3. [ ] Update vitest config with proper dependency handling

### Short-Term (Coverage Gaps)

1. [ ] Add tests for critical Work submission flow
2. [ ] Add tests for Job Queue operations
3. [ ] Add tests for Offline sync logic

### Long-Term (Test Hygiene)

1. [ ] Review and enable/remove skipped tests
2. [ ] Add component tests for key UI components
3. [ ] Add E2E tests for critical user journeys
4. [ ] Set up CI coverage reporting

---

## Appendix: Working Test Commands

```bash
# Run passing client tests only
cd packages/client && bun run test

# Run passing shared tests only  
cd packages/shared && bun run test

# Run with coverage (will fail on blocked tests)
bun run test -- --coverage

# Run specific test file
bun run test -- src/__tests__/routes/RequireInstalled.test.tsx
```
