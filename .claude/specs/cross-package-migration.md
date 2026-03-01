# Task: Cross-Package Migration

## Trigger

A change originates in one package and ripples across the dependency chain: contract ABI changes, shared hook API changes, dependency version bumps with breaking changes, or UUPS proxy upgrades. Use the migration agent for execution.

## Acceptance Criteria

A blast radius assessment is completed before any code changes. Packages are migrated in dependency order (contracts → indexer → shared → client/admin → agent). Each package builds and tests pass before moving to the next. A migration report exists at `.plans/migrations/{date}-{name}.md`. Full workspace passes: `bun run test && bun lint && bun build`.

## Decomposition

### Step 1: Blast Radius Assessment
**Packages**: all potentially affected
**Input**: The originating change (new ABI, updated API, version bump)
**Output**: Impact matrix classifying each package as Breaking (won't compile), Behavioral (compiles but different runtime), or Compatible (no changes needed). List specific files affected per package
**Verification**: Matrix reviewed and confirmed — no hidden dependencies missed
**Complexity**: M

### Step 2: Migration Plan
**Packages**: all affected
**Input**: Blast radius from Step 1
**Output**: Ordered plan following dependency chain: contracts → indexer → shared → client/admin → agent. Each step specifies: files to change, expected compilation outcome, test expectations, rollback approach
**Verification**: Plan covers all Breaking/Behavioral packages. Save to `.plans/migrations/`
**Complexity**: M

### Step 3: Migrate Origin Package
**Packages**: usually `contracts`
**Input**: The originating change
**Output**: Change applied, package-level build and tests pass. If contracts: verify storage layout compatibility for UUPS (gap size, no slot reordering). Commit with descriptive message
**Verification**: `cd packages/{origin} && bun build && bun run test`
**Complexity**: M-L (depends on change)

### Step 4: Migrate Downstream Packages (repeat per package)
**Packages**: next in dependency order
**Input**: Upstream package changes from Step 3
**Output**: Downstream package updated to consume new API/ABI. Build and test pass. Commit per package for incremental rollback
**Verification**: `cd packages/{downstream} && bun build && bun run test`
**On Failure**: If downstream package fails, revisit the migration approach for this package (max 3 attempts before escalating)
**Complexity**: S-M per package

### Step 5: Cross-Package Validation
**Packages**: all
**Input**: All migrated packages
**Output**: Full workspace passes
**Verification**: `bun run test && bun lint && bun build`
**Complexity**: S

### Step 6: Migration Documentation
**Packages**: none (docs only)
**Input**: Changes from all steps
**Output**: Migration report at `.plans/migrations/{date}-{name}.md` documenting: what changed, why, affected packages, rollback instructions, verification results
**Verification**: Report exists and is complete
**Complexity**: S

## Edge Cases

- **Contract storage layout**: UUPS upgrades require storage gap verification. New variables go at the end only. Gap size = 50 - (number of state variables). See upgrade safety checklist in `.claude/context/contracts.md`.
- **ABI encoding changes**: If contract function signatures change, shared modules that encode/decode ABI data need updates. Check `utils/eas/encoders.ts` and `utils/eas/transaction-builder.ts`.
- **Query key invalidation**: If a data shape changes, existing cached data may have the old shape. Increment the query key version or clear cache on upgrade.
- **Indexer re-sync**: Schema changes in the indexer may require `bun reset` to rebuild from scratch. Plan for re-indexing time.
- **Partial deployment risk**: Deploying upgraded contracts before frontend changes are deployed creates a window where the frontend uses stale ABIs. Coordinate deployment timing.

## Anti-Patterns

- Migrating all packages simultaneously (lose incremental validation)
- Skipping blast radius assessment (discover downstream breaks late)
- Committing all packages in one commit (no incremental rollback)
- Modifying contract storage layout without UUPS analysis
- Deploying partially migrated code to production
- Skipping dependency order (e.g., updating shared before contracts ABI is finalized)
