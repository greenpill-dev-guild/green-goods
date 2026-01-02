# Type System Migration Guide

**Date:** January 2026  
**Status:** Complete  
**Breaking Change:** ✅ Yes (but backward compatible during transition)

## Overview

We've centralized all TypeScript types in `@green-goods/shared` with explicit imports instead of global ambient declarations. This provides better IDE support, clearer dependencies, and prevents type pollution across packages.

## What Changed

### Before (Global Ambient Types)

```typescript
// ❌ Old way - types were globally available
const garden: Garden = { ... };
const work: Work = { ... };
const job: Job<WorkJobPayload> = { ... };
```

### After (Explicit Imports)

```typescript
// ✅ New way - explicit imports
import type { Garden, Work, Job, WorkJobPayload } from '@green-goods/shared';

const garden: Garden = { ... };
const work: Work = { ... };
const job: Job<WorkJobPayload> = { ... };
```

## Type Categories

### Domain Types (`domain.ts`)

Core business entities:

```typescript
import type {
  Garden,
  Work,
  Action,
  WorkApproval,
  GardenAssessment,
  Capital,
  Address,
} from '@green-goods/shared';

// Also export Capital enum
import { Capital } from '@green-goods/shared';
```

### Job Queue Types (`job-queue.ts`)

Offline queue system:

```typescript
import type {
  Job,
  JobProcessor,
  WorkJobPayload,
  ApprovalJobPayload,
  QueueStats,
} from '@green-goods/shared';
```

### Offline Types (`offline.ts`)

Offline functionality:

```typescript
import type {
  OfflineStatus,
  OfflineWorkItem,
  SyncMetrics,
  OfflineSettings,
} from '@green-goods/shared';
```

### API Response Types

#### Indexer (`indexer-responses.ts`)

```typescript
import type {
  IndexerGarden,
  IndexerAction,
  IndexerGardener,
} from '@green-goods/shared';
```

#### EAS (`eas-responses.ts`)

```typescript
import type {
  EASWork,
  EASWorkApproval,
  EASGardenAssessment,
} from '@green-goods/shared';
```

## Migration Steps

### 1. Client Package

**Files to update:** Any component/view using domain types

```diff
+ import type { Work, Garden, Job, WorkJobPayload } from '@green-goods/shared';

- const work: Work = ...  // Implicitly available
+ const work: Work = ...  // Explicitly imported
```

### 2. Admin Package

**Files to update:** Any component using domain types

```diff
+ import type { Garden, Action, Capital } from '@green-goods/shared';
+ import { Capital } from '@green-goods/shared'; // For enum values

  const capitals: Capital[] = [Capital.SOCIAL, Capital.LIVING];
```

### 3. Agent Package

**Files to update:** `types.ts` and any handler files

```diff
+ import type { Address, Work } from '@green-goods/shared';

- // Don't duplicate domain types
- export interface WorkData { ... }

+ // Instead, import and extend if needed
+ import type { Work } from '@green-goods/shared';
+ export interface AgentWork extends Work {
+   agentSpecificField: string;
+ }
```

## Best Practices

### ✅ DO

- **Import domain types from shared:**
  ```typescript
  import type { Garden, Work } from '@green-goods/shared';
  ```

- **Define component-specific props locally:**
  ```typescript
  // In component file
  interface WorkCardProps {
    work: Work; // Imported from shared
    onClick: () => void;
    className?: string;
  }
  ```

- **Check existing types before creating new ones:**
  ```typescript
  // Check @green-goods/shared first
  import type { Work } from '@green-goods/shared';
  
  // Extend if needed
  interface EnhancedWork extends Work {
    additionalField: string;
  }
  ```

- **Use zod schemas that reference domain types:**
  ```typescript
  import type { WorkDraft } from '@green-goods/shared';
  import { z } from 'zod';
  
  // Form schema can have different validation rules
  const workFormSchema = z.object({
    feedback: z.string().min(1),
    plantSelection: z.array(z.string()),
  });
  
  // But type can reference domain type
  type WorkForm = z.infer<typeof workFormSchema> & {
    // Additional fields from WorkDraft
  };
  ```

### ❌ DON'T

- **Don't rely on global types:**
  ```typescript
  // ❌ Bad - assuming global type
  const garden: Garden = ...;
  ```

- **Don't duplicate domain types in packages:**
  ```typescript
  // ❌ Bad - duplicating in agent
  export interface Garden {
    id: string;
    name: string;
    // ...
  }
  ```

- **Don't define domain types in components:**
  ```typescript
  // ❌ Bad - should be in shared
  export interface Work {
    id: string;
    title: string;
  }
  ```

## Backward Compatibility

Global type declarations are still available but deprecated:

```typescript
// Still works (deprecated)
const work: Work = ...;  // Uses global declaration

// Preferred (new way)
import type { Work } from '@green-goods/shared';
const work: Work = ...;
```

**Timeline:**
- ✅ **Phase 1 (Complete):** New explicit type exports available
- 🔄 **Phase 2 (In Progress):** Migrate callsites to explicit imports
- ⏳ **Phase 3 (Future):** Remove global declarations

## IDE Support

### Auto-import Setup

VS Code should automatically suggest imports:

```typescript
const work: Work = ...
           ^ Suggest import from '@green-goods/shared'
```

If not working, add to `.vscode/settings.json`:

```json
{
  "typescript.preferences.autoImportFileExcludePatterns": [
    "**/node_modules/@green-goods/shared/src/types/*.d.ts"
  ]
}
```

## Type Export Locations

| Type Category | Export From | File |
|---|---|---|
| Domain entities | `@green-goods/shared` | `types/domain.ts` |
| Job queue | `@green-goods/shared` | `types/job-queue.ts` |
| Offline features | `@green-goods/shared` | `types/offline.ts` |
| Indexer responses | `@green-goods/shared` | `types/indexer-responses.ts` |
| EAS responses | `@green-goods/shared` | `types/eas-responses.ts` |
| Contract types | `@green-goods/shared` | `types/contracts.ts` |
| Auth types | `@green-goods/shared` | `types/auth.ts` |

## Agent Guidelines

When working on Green Goods:

1. **Check existing types first:**
   ```bash
   # Search in shared types
   grep -r "interface Garden" packages/shared/src/types/
   ```

2. **Import, don't duplicate:**
   ```typescript
   // ✅ Good
   import type { Work } from '@green-goods/shared';
   
   // ❌ Bad
   export interface Work { ... }
   ```

3. **Extend when needed:**
   ```typescript
   import type { Work } from '@green-goods/shared';
   
   // Add agent-specific fields
   export interface AgentWork extends Work {
    platformId: string;
   }
   ```

4. **Zod schemas build on types:**
   ```typescript
   import type { WorkDraft } from '@green-goods/shared';
   import { z } from 'zod';
   
   // Schema can have stricter validation
   export const workDraftSchema = z.object({
     feedback: z.string().min(10), // Stricter than type
     // ...
   });
   
   // But should align with the domain type
   type WorkDraftForm = z.infer<typeof workDraftSchema>;
   ```

## Common Patterns

### Component Props with Domain Types

```typescript
import type { Work, Garden } from '@green-goods/shared';

// Component-specific props
interface WorkCardProps {
  work: Work;           // Domain type from shared
  onClick: () => void;  // Component-specific
  className?: string;   // Component-specific
}
```

### Form Types with Validation

```typescript
import type { WorkDraft } from '@green-goods/shared';
import { z } from 'zod';

// Zod schema for validation
const workFormSchema = z.object({
  feedback: z.string().min(1),
  plantSelection: z.array(z.string()),
  plantCount: z.number().optional(),
});

// Infer form type
type WorkFormData = z.infer<typeof workFormSchema>;

// Domain type for submission
function submitWork(form: WorkFormData): Promise<Work> {
  // Convert form data to domain type
}
```

### API Response Parsing

```typescript
import type { IndexerGarden, Garden } from '@green-goods/shared';

// Parse indexer response to domain type
function parseGarden(indexer: IndexerGarden): Garden {
  return {
    id: indexer.id,
    chainId: indexer.chainId,
    name: indexer.name ?? 'Unnamed',
    // ...
  };
}
```

## Questions?

- Check `/packages/shared/src/types/index.ts` for all available types
- Read `/packages/shared/AGENTS.md` for package architecture
- See `.cursor/rules/*.mdc` for detailed patterns
