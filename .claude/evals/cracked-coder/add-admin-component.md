# Eval Task: Add Garden Activity Feed Component to Admin Dashboard

## Brief

Create a new `GardenActivityFeed` component for the admin dashboard that displays recent work submissions, approvals, and assessments for a given garden. The component must respect role-based permissions (only operators and owners can see the full feed; gardeners see only their own submissions).

## Requirements

### Hook (in `packages/shared/src/hooks/garden/`)

1. Create `useGardenActivityFeed(gardenAddress: Address)` in `packages/shared/src/hooks/garden/useGardenActivityFeed.ts`
2. The hook should return `{ activities, isLoading, error, refetch }` where activities is a sorted array of `ActivityItem`
3. Use TanStack Query with `queryKeys.gardens.activity(gardenAddress, chainId)` as the query key
4. Accept an `Address` type parameter (not `string`)
5. Filter activities based on the user's role using `useRolePermissions` from `packages/shared/src/hooks/roles/useRolePermissions.ts`
6. Export from the shared barrel (`packages/shared/src/hooks/index.ts`)

### Component (in `packages/admin/src/components/Garden/`)

7. Create `GardenActivityFeed.tsx` in `packages/admin/src/components/Garden/`
8. Import the hook from `@green-goods/shared` barrel (not deep paths)
9. Use `useIntl` for all user-facing strings (i18n)
10. Use existing UI primitives: `Card` compound component, `StatusBadge`, `Spinner`
11. Show loading state with `Spinner`, error state with user-friendly message
12. Each activity item should show: type icon (Remixicon, not lucide), actor address, timestamp, and status badge
13. Empty state should use the existing `EmptyState` component pattern

### Type Definition

```typescript
interface ActivityItem {
  id: string;
  type: "work_submission" | "work_approval" | "assessment";
  actor: Address;
  gardenAddress: Address;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
  title: string;
  /** Only visible to operators/owners */
  internalNotes?: string;
}
```

## Constraints Under Test

This task validates:

- **Hook Boundary**: Hook MUST be created in `packages/shared/src/hooks/garden/`, not in admin
- **Cathedral Check**: Hook must follow patterns from neighboring hooks (e.g., `useWorks`, `useWorkApprovals`, `useGardenOperations`)
- **queryKeys Usage**: Must use `queryKeys.*` helpers, not hardcoded strings
- **Address Type**: Parameter must be typed as `Address`, not `string`
- **Barrel Exports**: Must update `packages/shared/src/hooks/index.ts`
- **Barrel Imports**: Admin component must import from `@green-goods/shared`, never deep paths (Rule #11)
- **Role-Based Filtering**: Must use `useRolePermissions` to conditionally show `internalNotes`
- **i18n**: All strings must use `useIntl` + `intl.formatMessage()`, no hardcoded English
- **Icons**: Must use Remixicon (`@remixicon/react`), NOT lucide
- **UI Primitives**: Must use existing `Card`, `StatusBadge`, `Spinner` components
- **No console.log**: Use `logger` from shared (Rule #12)
- **TDD**: Tests must be written before implementation

## Expected Artifacts

- `packages/shared/src/hooks/garden/useGardenActivityFeed.ts`
- `packages/shared/src/hooks/garden/__tests__/useGardenActivityFeed.test.ts`
- Updated `packages/shared/src/hooks/index.ts` (barrel export)
- `packages/admin/src/components/Garden/GardenActivityFeed.tsx`

## Common Failure Modes

- Agent creates the hook inside `packages/admin/src/hooks/` instead of shared (Hook Boundary violation)
- Agent uses deep import paths in the admin component (e.g., `@green-goods/shared/hooks/garden/useGardenActivityFeed`)
- Agent hardcodes query key strings instead of using `queryKeys.*` helpers
- Agent uses `string` type for addresses instead of `Address` from shared
- Agent uses lucide icons instead of Remixicon
- Agent hardcodes English strings instead of using `intl.formatMessage()`
- Agent forgets to filter `internalNotes` based on role permissions
- Agent skips the Cathedral Check and doesn't follow patterns from neighboring hooks
- Agent writes tests after implementation instead of before (TDD violation)
