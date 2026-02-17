---
name: migration
description: Cross-package migration coordination - breaking changes, UUPS upgrades, indexer re-indexing, IndexedDB schema changes. Use for protocol upgrades, dependency migrations, and data model changes.
version: "1.0"
last_updated: "2026-02-08"
last_verified: "2026-02-09"
status: proven
packages: [shared, client, admin, contracts, indexer]
dependencies: [contracts, testing]
---

# Migration Skill

Cross-package migration guide: coordinating breaking changes across contracts, indexer, shared, and frontend packages.

---

## Activation

When invoked:
- Identify which packages are affected by the migration.
- Follow the dependency order: contracts → indexer → shared → client/admin.
- Create a migration plan before making changes.
- Never migrate multiple packages simultaneously without a plan.

## Part 1: Migration Planning

### Impact Assessment

Before any migration, map the blast radius:

```
Change Origin → Direct Dependencies → Transitive Dependencies

Example: Contract event signature changed
├── contracts/  → Update event definition
├── indexer/    → Update event handler + schema
├── shared/     → Update types + hooks that read indexed data
├── client/     → Views that display the data (via shared hooks)
└── admin/      → Views that display the data (via shared hooks)
```

### Migration Plan Template

Create a plan file in `.plans/`:

```markdown
# Migration: [Name] (e.g., "Hats Protocol v2")

## Scope
- [ ] Contracts: [what changes]
- [ ] Indexer: [what changes]
- [ ] Shared: [what changes]
- [ ] Client: [what changes]
- [ ] Admin: [what changes]

## Breaking Changes
1. [Change] → [Impact] → [Migration path]

## Execution Order
1. contracts: [specific changes]
2. indexer: [specific changes]
3. shared: [specific changes]
4. client + admin: [specific changes]

## Rollback Plan
- If step N fails: [what to do]

## Validation
- [ ] `bun run test` passes in all packages
- [ ] `bun build` succeeds
- [ ] Integration test on testnet
```

## Part 2: Contract Migrations

### UUPS Proxy Upgrades

```bash
# 1. Verify storage layout compatibility
forge inspect src/Contract.sol:Contract storage-layout --pretty > layout-new.txt
diff layout-previous.txt layout-new.txt

# 2. Run upgrade safety tests
cd packages/contracts && bun run test

# 3. Deploy new implementation (dry run)
bun script/deploy.ts core --network sepolia

# 4. Deploy for real
bun script/deploy.ts core --network sepolia --broadcast
```

### Storage Layout Rules

```solidity
// ✅ SAFE: Add new variables at the end, reduce gap
contract V2 is V1 {
    // Existing V1 variables...
    address public newField;       // Added at end
    uint256[44] private __gap;     // Reduced from 45
}

// ❌ UNSAFE: Any of these
// - Reordering existing variables
// - Changing variable types (uint256 → uint128)
// - Removing variables
// - Inserting between existing variables
// - Changing inheritance order
```

### Event Signature Changes

When contract events change, the indexer MUST be updated:

```
1. Update event in Solidity
2. Rebuild contract ABIs: `cd packages/contracts && bun build`
3. Update indexer event handlers
4. Update indexer schema.graphql if entity shape changed
5. Re-index from scratch (reset database)
```

### New Contract Addition

When adding a new contract to the protocol:

```
1. Write contract + tests in packages/contracts/
2. Add to deploy.ts deployment script
3. Deploy to testnet
4. Export ABI from shared barrel
5. Add to indexer config.yaml (contract address + events)
6. Write indexer event handlers
7. Add types to shared
8. Create hooks in shared
```

## Part 3: Indexer Migrations

### Schema Changes (schema.graphql)

```graphql
# Adding a field — backward compatible
type Garden {
  id: ID!
  name: String!
  newField: String  # Nullable = safe to add
}

# Adding an entity — backward compatible
type NewEntity {
  id: ID!
  garden: Garden!
}

# Changing a field type — BREAKING (requires re-index)
# String → Int, non-null → nullable change, etc.
```

### Re-Indexing Procedure

```bash
# Local (Docker)
cd packages/indexer
bun run dev:docker:down
docker volume rm indexer_postgres    # Clear all indexed data
bun build                            # Rebuild with new schema
bun run dev:docker                   # Re-index from genesis

# Production (Railway)
# 1. Update code and push
# 2. Clear database (Railway dashboard or CLI)
# 3. Redeploy to re-index
railway up
```

### Event Handler Updates

When contract events change signature:

```typescript
// Before: WorkSubmitted(uint256, address, string)
// After:  WorkSubmitted(uint256, address, string, uint256)

// Update handler to match new signature
GardenAccount.WorkSubmitted.handler(async ({ event, context }) => {
  const { actionUID, gardener, ipfsHash, timestamp } = event.params;
  //                                       ^^^^^^^^^ new field

  context.Work.set({
    id: `${event.chainId}-${event.transaction.hash}`,
    actionUID: actionUID.toString(),
    gardener,
    ipfsHash,
    timestamp: Number(timestamp),  // new field
    chainId: event.chainId,
  });
});
```

## Part 4: Shared Package Migrations

### Type Changes

When domain types change:

```typescript
// 1. Update type definition in shared/src/types/
export interface Garden {
  // existing fields...
  newField: string;  // Added field
}

// 2. Update all hooks that create/consume this type
// 3. Update mock factories in test utils
// 4. Run: cd packages/shared && bun run tsc --noEmit
```

### Hook Migrations

When hook signatures change:

```typescript
// Before
export function useGarden(address: Address): Garden | undefined;

// After (breaking — new required parameter)
export function useGarden(address: Address, chainId: number): Garden | undefined;

// Find all consumers:
// grep -r "useGarden(" packages/client/ packages/admin/
// Update each call site
```

### Barrel Export Changes

When adding/removing exports from `@green-goods/shared`:

```typescript
// packages/shared/src/index.ts
export { useNewHook } from "./hooks/domain/useNewHook";
export type { NewType } from "./types/new-type";

// Then verify no deep imports exist:
// grep -r "from.*@green-goods/shared/" packages/client/ packages/admin/
```

## Part 5: IndexedDB Schema Migrations

### Versioned Database Upgrades

```typescript
// When IndexedDB schema changes, bump the version
const DB_VERSION = 2; // Was 1

const request = indexedDB.open("green-goods", DB_VERSION);

request.onupgradeneeded = (event) => {
  const db = request.result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 1) {
    // Original schema
    db.createObjectStore("jobs", { keyPath: "id" });
    db.createObjectStore("drafts", { keyPath: "key" });
  }

  if (oldVersion < 2) {
    // Migration: add images store
    db.createObjectStore("images", { keyPath: "id" });

    // Migration: add index to jobs
    const jobStore = request.transaction!.objectStore("jobs");
    jobStore.createIndex("by-user", "userAddress");
  }
};
```

### Data Migration During Upgrade

```typescript
if (oldVersion < 3) {
  // Migrate existing data shape
  const jobStore = request.transaction!.objectStore("jobs");
  const cursor = jobStore.openCursor();

  cursor.onsuccess = () => {
    if (cursor.result) {
      const job = cursor.result.value;
      // Transform data to new shape
      job.version = 2;
      job.createdAt = job.timestamp || Date.now();
      delete job.timestamp;
      cursor.result.update(job);
      cursor.result.continue();
    }
  };
}
```

## Part 6: Dependency Upgrades

### Major Version Bumps

```bash
# 1. Check what's outdated
bun outdated

# 2. Read migration guide for the dependency
# 3. Update in root package.json (monorepo)
# 4. Run install
bun install

# 5. Fix breaking changes package by package
# 6. Validate
bun format && bun lint && bun run test && bun build
```

### Common Migration Patterns

| Dependency | Migration Notes |
|------------|----------------|
| React | Check deprecated APIs, new features |
| Wagmi/Viem | ABI format changes, hook signature changes |
| TanStack Query | v4→v5 requires object syntax, no query callbacks |
| Tailwind CSS | v3→v4 uses CSS-based config, new import syntax |
| Radix UI | Component API changes, new primitives |

## Anti-Patterns

- **Never migrate without a plan** — map blast radius first
- **Never change storage variable order** — UUPS slot collision
- **Never skip re-indexing after schema changes** — corrupted data
- **Never change event signatures without indexer update** — missed events
- **Never bump IndexedDB version without migration logic** — data loss
- **Never migrate multiple packages simultaneously** — follow dependency order
- **Never deploy to mainnet without testnet validation** — irreversible

## Quick Reference Checklist

### Before Starting a Migration

- [ ] Impact assessment complete (which packages affected)
- [ ] Plan file created in `.plans/`
- [ ] Rollback plan documented
- [ ] Breaking changes identified with migration paths
- [ ] All tests pass before starting

### After Migration

- [ ] `bun run test` passes in ALL packages
- [ ] `bun build` succeeds
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] Integration tested on testnet
- [ ] Deployment artifacts updated
- [ ] Documentation updated if APIs changed

## Related Skills

- `contracts` — UUPS upgrade safety and storage layout
- `indexer` — Schema and event handler updates
- `deployment` — Deployment order and rollback procedures
- `testing` — Regression tests for migration validation
