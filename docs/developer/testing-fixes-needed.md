# Pre-Existing Test Issues & Fixes

**Status:** Issues identified during test infrastructure refactoring (not caused by refactoring)  
**Date:** January 1, 2026

## Overview

During the test infrastructure consolidation, we identified several pre-existing test issues unrelated to our refactoring work. This document provides guidance on fixing these issues.

---

## Issue 1: Vitest API Usage (14 files affected)

### Problem
Tests use vitest APIs that may not be properly imported or used:
- `vi.hoisted()` - For hoisting mocks
- `vi.stubEnv()` - For environment variable mocking
- `vi.importActual()` - For partial mocking

### Affected Files
```
packages/admin/src/__tests__/workflows/unauthorized-actions.test.tsx
packages/admin/src/__tests__/views/Gardens.test.tsx
packages/admin/src/__tests__/components/RequireRole.test.tsx
packages/admin/src/__tests__/components/RequireAuth.test.tsx
packages/shared/src/__tests__/providers/JobQueueProvider.test.tsx
packages/shared/src/__tests__/hooks/useOffline.test.ts
packages/shared/src/__tests__/utils/smart-polling.test.ts
packages/shared/src/__tests__/modules/wallet-submission-ux.test.ts
packages/shared/src/__tests__/views/Login.test.tsx
packages/client/src/__tests__/routes/RequireInstalled.test.tsx
packages/client/src/__tests__/routes/RequireAuth.test.tsx
packages/client/src/__tests__/views/Garden.integration.test.tsx
```

### Solution

**Current vitest version:** 3.2.4 ✅ (supports all these APIs)

The issue is likely **import order** or **usage pattern**. Ensure:

1. **Import vi from vitest:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

2. **Use vi.hoisted correctly (must be at top level):**
```typescript
// ✅ Correct - at module level
const mocks = vi.hoisted(() => ({
  mockFn: vi.fn()
}));

vi.mock('./module', () => mocks);

// ❌ Wrong - inside describe/it
describe('test', () => {
  const mocks = vi.hoisted(() => ({ ... })); // Won't work
});
```

3. **Use vi.stubEnv correctly:**
```typescript
// In test
vi.stubEnv('VITE_DESKTOP_DEV', 'false');

// Cleanup
afterEach(() => {
  vi.unstubAllEnvs();
});
```

4. **Use vi.importActual correctly:**
```typescript
vi.mock('@green-goods/shared/hooks', async () => {
  const actual = await vi.importActual<typeof import('@green-goods/shared/hooks')>(
    '@green-goods/shared/hooks'
  );
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});
```

### Quick Fix Pattern

Replace hoisted mocks with standard mocks if hoisting isn't critical:

```typescript
// Before (using vi.hoisted)
const { mockJobQueue } = vi.hoisted(() => ({
  mockJobQueue: { getStats: vi.fn() }
}));

vi.mock('../modules/job-queue', () => ({ jobQueue: mockJobQueue }));

// After (simpler approach)
vi.mock('../modules/job-queue', () => ({
  jobQueue: {
    getStats: vi.fn().mockResolvedValue({ total: 0 }),
    flush: vi.fn().mockResolvedValue({ processed: 0 }),
  }
}));
```

---

## Issue 2: Missing Component Imports (3 files)

### Problem
Admin tests reference components that may have been moved or renamed.

### Affected Files
```
packages/admin/src/__tests__/components/RequireAuth.test.tsx
  → Cannot find module '@/routes/RequireAuth'
  
packages/admin/src/__tests__/views/Gardens.test.tsx
  → Cannot find module '@/views/Gardens'
  
packages/admin/src/__tests__/routes/RequireDeployer.test.tsx
  → Cannot find module '@/components/Layout/DashboardLayoutSkeleton'
```

### Solution

1. **Verify component locations:**
```bash
cd packages/admin
find src -name "RequireAuth*" -o -name "Gardens*" -o -name "DashboardLayoutSkeleton*"
```

2. **Update import paths:**
```typescript
// Check actual file structure and update imports
import { RequireAuth } from '@/routes/RequireAuth'; // or correct path
import { Gardens } from '@/views/Gardens'; // or correct path
import { DashboardLayoutSkeleton } from '@/components/Layout/DashboardLayoutSkeleton'; // or correct path
```

3. **Check tsconfig paths:**
```json
// packages/admin/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Issue 3: WorkProvider Test Setup (6 tests)

### Problem
`ReferenceError: document is not defined` in WorkProvider tests despite jsdom environment.

### Affected File
```
packages/shared/src/__tests__/providers/WorkProvider.test.tsx
```

### Root Cause
Tests may be running before jsdom is fully initialized, or missing proper test wrappers.

### Solution

1. **Ensure test environment is set:**
```typescript
// At top of test file
/**
 * @vitest-environment jsdom
 */
```

2. **Use proper test wrappers:**
```typescript
import { renderHook } from '@testing-library/react';
import { createTestWrapper } from '@green-goods/shared/test-utils';

// In test
const { result } = renderHook(() => useWork(), {
  wrapper: createTestWrapper(),
});
```

3. **Check for early execution:**
```typescript
// Ensure mocks don't execute before jsdom loads
vi.mock('./module', () => ({
  // Don't access document/window here
  Component: vi.fn(),
}));
```

---

## Issue 4: IndexedDB Timing (3 tests)

### Problem
`ReferenceError: indexedDB is not defined` in job-queue tests.

### Affected File
```
packages/shared/src/__tests__/modules/job-queue.core.test.ts
```

### Root Cause
`fake-indexeddb/auto` imported in setup but job-queue module may initialize before it loads.

### Solution

1. **Ensure fake-indexeddb loads first:**
```typescript
// In test file, before any imports that use IndexedDB
import 'fake-indexeddb/auto';
import { jobQueue } from '@/modules/job-queue';
```

2. **Or mock the job-queue module:**
```typescript
vi.mock('@/modules/job-queue/db', () => ({
  init: vi.fn(),
  addJob: vi.fn(),
  getJobs: vi.fn().mockResolvedValue([]),
}));
```

3. **Or use dynamic imports:**
```typescript
describe('job-queue', () => {
  let jobQueue: typeof import('@/modules/job-queue');
  
  beforeAll(async () => {
    jobQueue = await import('@/modules/job-queue');
  });
  
  it('test', async () => {
    await jobQueue.addJob({ ... });
  });
});
```

---

## Priority Fix Order

### High Priority (Blocks many tests)
1. ✅ **Fix vi.hoisted usage** - Affects 14 files
2. ✅ **Fix component imports** - Affects 3 admin tests

### Medium Priority  
3. ✅ **Fix WorkProvider setup** - Affects 6 tests
4. ✅ **Fix IndexedDB timing** - Affects 3 tests

### Low Priority
5. Review and update all test patterns for consistency

---

## Verification Commands

After fixes, run:

```bash
# Test specific files
bun test packages/shared/src/__tests__/providers/JobQueueProvider.test.tsx
bun test packages/admin/src/__tests__/components/RequireAuth.test.tsx
bun test packages/shared/src/__tests__/providers/WorkProvider.test.tsx

# Test all
cd packages/shared && bun test
cd packages/client && bun test
cd packages/admin && bun test
```

---

## Notes

- **None of these issues were caused by the test infrastructure refactoring**
- All issues existed before consolidation work
- The refactoring actually makes these issues easier to fix (single setup to modify)
- 59+ tests confirmed passing with new infrastructure

---

## Related Documents

- `TEST_REFACTOR_SUMMARY.md` - Complete refactoring documentation
- `TEST_VERIFICATION_RESULTS.md` - Test verification results
- `packages/*/README.md` - Package-specific test documentation
