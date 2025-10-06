# Lint Error Migration Guide

## Overview
This guide helps fix the 250+ lint warnings from oxlint, primarily console statements and TypeScript type issues.

## Quick Fixes

### 1. ✅ Duplicate Import (FIXED)
**Error:** `@wagmi/core` import was duplicated in `src/providers/auth.tsx`  
**Status:** ✅ Already fixed by merging imports

### 2. Console Statements (250 warnings)
**Error:** `eslint(no-console): Unexpected console statement`

#### Solution: Use Logger Utility
We've created a centralized logger at `src/utils/app/logger.ts`

#### Manual Migration Example:
```typescript
// ❌ Before
console.log("User logged in");
console.error("Failed to fetch:", error);
console.warn("API deprecated");

// ✅ After
import logger from "@/utils/app/logger";

logger.log("User logged in");
logger.error("Failed to fetch", error);
logger.warn("API deprecated");
```

#### Automated Migration:
```bash
# Preview changes
node packages/client/scripts/fix-console-statements.js src/providers/auth.tsx --dry-run

# Apply changes
node packages/client/scripts/fix-console-statements.js src/providers/auth.tsx

# Batch process (use with care)
find packages/client/src -name "*.ts" -o -name "*.tsx" | while read file; do
  node packages/client/scripts/fix-console-statements.js "$file"
done
```

### 3. TypeScript `any` Types (60+ warnings)
**Error:** `typescript-eslint(no-explicit-any): Unexpected any`

#### Solutions:
1. **Use `unknown` for truly unknown types:**
   ```typescript
   // ❌ Before
   function parseData(data: any) { ... }
   
   // ✅ After
   function parseData(data: unknown) {
     // Force explicit type checking
     if (typeof data === 'object' && data !== null) { ... }
   }
   ```

2. **Define proper types:**
   ```typescript
   // ❌ Before
   const config: any = { ... };
   
   // ✅ After
   interface Config {
     name: string;
     value: number;
   }
   const config: Config = { ... };
   ```

3. **Use generics for flexible types:**
   ```typescript
   // ❌ Before
   function map(items: any[], fn: any) { ... }
   
   // ✅ After
   function map<T, R>(items: T[], fn: (item: T) => R): R[] { ... }
   ```

### 4. Unused Catch Variables (20+ warnings)
**Error:** `eslint(no-unused-vars): Catch parameter is caught but never used`

```typescript
// ❌ Before
try {
  await something();
} catch (error) {
  // Error ignored
  return false;
}

// ✅ After - Prefix with underscore
try {
  await something();
} catch (_error) {
  // Explicitly ignored
  return false;
}

// ✅ Better - Handle the error
try {
  await something();
} catch (error) {
  logger.error("Operation failed", error);
  return false;
}
```

### 5. Useless Try/Catch (5 warnings)
**Error:** `eslint(no-useless-catch): Unnecessary try/catch wrapper`

```typescript
// ❌ Before
try {
  return await fetchData();
} catch (error) {
  throw error; // Just re-throwing
}

// ✅ After - Remove wrapper
return await fetchData();

// ✅ Or add value
try {
  return await fetchData();
} catch (error) {
  logger.error("Fetch failed", error);
  throw new Error("Failed to load data");
}
```

## Priority Order

1. **Critical** (Breaks build): ✅ Duplicate imports - FIXED
2. **High** (Many instances): Console statements - Use script
3. **Medium**: TypeScript `any` types - Gradual migration
4. **Low**: Unused vars, useless catch - Quick fixes

## File-by-File Strategy

### High-Impact Files (many warnings):
1. `packages/contracts/script/utils/envio-integration.js` (50+ console)
2. `packages/contracts/script/deploy.js` (80+ console)
3. `packages/client/src/modules/data/eas.ts` (20+ any types)
4. `packages/client/src/modules/work/deduplication.ts` (10+ any types)

### Recommended Approach:
```bash
# 1. Fix contracts (Node.js files - different logger strategy)
# For script files, you might want to keep console but suppress warnings
# by adding a comment or updating oxlint config

# 2. Fix client console statements
cd packages/client
node scripts/fix-console-statements.js src/providers/auth.tsx
node scripts/fix-console-statements.js src/modules/app/posthog.ts
# ... continue with other files

# 3. Run linter to check progress
pnpm lint

# 4. Tackle any types gradually
# Focus on one module at a time
```

## oxlint Configuration Options

If you want to suppress warnings for specific files/patterns:

```json
// packages/client/oxlint.json
{
  "allow": [
    {
      "files": ["**/scripts/**/*.js"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

## Logger Features

The logger utility includes:
- ✅ Automatic dev/prod awareness
- ✅ Structured logging with context
- ✅ Namespaced loggers for modules
- ✅ Future-ready for error tracking (Sentry, etc.)

```typescript
// Create a namespaced logger
import { createLogger } from "@/utils/app/logger";

const logger = createLogger("Auth");

logger.log("User signed in"); // [Auth] User signed in
logger.error("Login failed", error, { userId: 123 });
```

## Testing

After migrations:
```bash
# Check lint status
pnpm lint

# Run tests
pnpm test

# Type check
pnpm type-check
```

## Questions?

- Logger too noisy in dev? Set `VITE_DEBUG=false` in `.env`
- Need production error tracking? Uncomment Sentry integration in logger.ts
- Script not working? Check file paths are relative to project root
