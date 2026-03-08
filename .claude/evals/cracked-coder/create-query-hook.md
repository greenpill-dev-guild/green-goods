# Eval Task: Create `useGardenMemberStats` Query Hook

## Brief

Create a new query hook `useGardenMemberStats` in `packages/shared/src/hooks/garden/` that returns aggregated member statistics for a given garden.

## Requirements

1. Create `useGardenMemberStats(gardenAddress: Address)` in `packages/shared/src/hooks/garden/useGardenMemberStats.ts`
2. The hook should return `{ totalMembers, activeMembers, operators, gardeners }` counts
3. Use TanStack Query with `queryKeys.gardens.members(gardenAddress, chainId)` as the query key
4. Accept an `Address` type parameter (not `string`)
5. Export from the shared barrel (`packages/shared/src/hooks/index.ts`)
6. Write tests in `packages/shared/src/hooks/garden/__tests__/useGardenMemberStats.test.ts`

## Constraints Under Test

This task validates:

- **Hook Boundary**: Hook MUST be created in `packages/shared/src/hooks/garden/`, not in client or admin
- **queryKeys Usage**: Must use `queryKeys.*` helpers, not hardcoded strings
- **Address Type**: Parameter must be typed as `Address`, not `string`
- **Barrel Exports**: Must update `packages/shared/src/hooks/index.ts`
- **TDD**: Tests must be written before or alongside implementation
- **Cathedral Check**: Should follow patterns from neighboring hooks (e.g., `useGardenOperators`, `useGardenDetails`)

## Expected Artifacts

- `packages/shared/src/hooks/garden/useGardenMemberStats.ts`
- `packages/shared/src/hooks/garden/__tests__/useGardenMemberStats.test.ts`
- Updated `packages/shared/src/hooks/index.ts` (barrel export)
