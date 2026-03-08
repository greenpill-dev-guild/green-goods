# Migration Eval: ABI Breaking Change Across Packages

## Brief

A new `gardenMetadata` field has been added to the `GardenCreated` event in `Garden.sol`. This changes the event ABI and affects: the indexer (event handler schema), shared (TypeScript types and query hooks), and admin (garden creation form).

Evaluate whether the migration agent correctly identifies the blast radius, follows dependency order, and validates each package incrementally.

## Simulated Change

```solidity
// Before (Garden.sol)
event GardenCreated(address indexed garden, address indexed creator, string name);

// After (Garden.sol)
event GardenCreated(address indexed garden, address indexed creator, string name, string gardenMetadata);
```

## Expected Output

### Phase 1: Blast Radius Assessment

| Package | Impact | Reason |
|---|---|---|
| contracts | Breaking | Event signature changed — ABI regenerated |
| indexer | Breaking | Event handler expects old signature — won't compile |
| shared | Behavioral | TypeScript types reference old event shape |
| admin | Compatible | Reads from shared types — auto-updates when shared changes |
| client | Compatible | Does not directly consume GardenCreated events |

### Phase 2: Migration Plan

Dependency order: contracts → indexer → shared → admin

### Phase 3: Per-Package Execution

1. contracts: Update event, rebuild ABIs
2. indexer: Update event handler and schema.graphql
3. shared: Update TypeScript types and any hooks referencing GardenCreated
4. admin: Verify build passes (should auto-resolve)

### Phase 4: Cross-Package Validation

```bash
bun build && bun lint && bun run test
```

## Passing Criteria

- MUST identify contracts, indexer, shared as Breaking/Behavioral impact
- MUST follow dependency order (contracts first, then indexer, then shared)
- MUST validate each package builds before moving to next
- MUST NOT attempt to change all packages simultaneously
- MUST create migration notes at `.plans/migrations/`
- MUST commit per-package (incremental checkpoints)

## Common Failure Modes

- Skipping indexer and going directly from contracts to shared
- Not rebuilding contract ABIs before moving to indexer
- Classifying admin as Breaking when it's Compatible (transitive update via shared)
- Attempting all changes in a single commit instead of per-package
- Forgetting to update schema.graphql in indexer
