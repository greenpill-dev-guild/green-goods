# Migration Eval: Major Dependency Version Upgrade

## Brief

Upgrade `@tanstack/react-query` from v5.x to v6.x across the monorepo. The v6 release includes breaking changes: `useQuery` now requires a `queryOptions()` wrapper, and `useMutation` callbacks changed from `onSuccess(data)` to `onSuccess({ data, variables })`.

Evaluate whether the migration agent correctly assesses blast radius across shared/client/admin and executes the upgrade incrementally.

## Simulated Breaking Changes

```typescript
// v5 (current)
useQuery({ queryKey: [...], queryFn: () => fetch(...) })

// v6 (new)
useQuery(queryOptions({ queryKey: [...], queryFn: () => fetch(...) }))

// v5 mutation callback
onSuccess: (data) => { ... }

// v6 mutation callback
onSuccess: ({ data, variables }) => { ... }
```

## Expected Output

### Blast Radius

| Package | Impact | Files Affected |
|---|---|---|
| shared | Breaking | All query hooks (~20 files), all mutation hooks (~15 files) |
| client | Breaking | Any direct useQuery/useMutation usage |
| admin | Breaking | Any direct useQuery/useMutation usage |
| contracts | Compatible | No React Query usage |
| indexer | Compatible | No React Query usage |

### Migration Order

1. shared (contains all hooks — this is the epicenter)
2. client (depends on shared hooks + may have direct usage)
3. admin (depends on shared hooks + may have direct usage)

### Key Decision

The agent should recognize that `shared` must be fully migrated first since client/admin import hooks from shared. Attempting to migrate client/admin before shared will cause cascading type errors.

## Passing Criteria

- MUST identify shared as the primary epicenter (not client or admin)
- MUST assess ~35 hook files in shared as Breaking impact
- MUST migrate shared completely before touching client/admin
- MUST NOT upgrade the package.json dependency before code changes are ready
- MUST run `bun run test` in shared before moving to client/admin
- MUST create migration notes documenting the v5→v6 changes

## Common Failure Modes

- Starting with client/admin instead of shared (wrong dependency order)
- Upgrading package.json first, then trying to fix all compile errors at once
- Not distinguishing between "direct usage" in client/admin vs "transitive via shared"
- Skipping mutation callback changes (only fixing useQuery, missing useMutation)
- Not running per-package tests between migrations
