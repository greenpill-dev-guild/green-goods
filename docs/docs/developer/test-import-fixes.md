# Admin Test Import Fixes

**Quick reference for fixing admin test imports**

## Component Locations (Verified)

```
✅ src/routes/RequireAuth.tsx
✅ src/views/Gardens/index.tsx  
✅ src/components/Layout/DashboardLayoutSkeleton.tsx
```

## Required Fixes

### 1. RequireAuth.test.tsx
```typescript
// Current (broken)
import { RequireAuth } from '@/routes/RequireAuth';

// Fix: Component exists at this path ✅
// No change needed - path is correct
```

### 2. Gardens.test.tsx
```typescript
// Current (broken)
import { Gardens } from '@/views/Gardens';

// Fix: Import from index
import { Gardens } from '@/views/Gardens/index';
// Or better:
import Gardens from '@/views/Gardens';
```

### 3. RequireDeployer.test.tsx (via RequireRole.tsx)
```typescript
// Current (broken in RequireRole.tsx)
import { DashboardLayoutSkeleton } from '@/components/Layout/DashboardLayoutSkeleton';

// Fix: Component exists at this path ✅
// No change needed - path is correct
```

## Root Cause

The imports are actually **correct**! The issue is likely:

1. **TypeScript path resolution** in test environment
2. **Module not exporting** correctly
3. **Circular dependency** issues

## Verification Steps

```bash
# Check if components export correctly
cd packages/admin

# Check RequireAuth
grep -n "export" src/routes/RequireAuth.tsx

# Check Gardens  
grep -n "export" src/views/Gardens/index.tsx

# Check DashboardLayoutSkeleton
grep -n "export" src/components/Layout/DashboardLayoutSkeleton.tsx
```

## Likely Fix

The tests may need to be updated to match the actual export patterns. Check if components use default vs named exports.
