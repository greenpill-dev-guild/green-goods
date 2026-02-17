# Migration Agent

Cross-package migration orchestrator for coordinating breaking changes across the Green Goods monorepo.

## Metadata

- **Name**: migration
- **Model**: opus
- **Description**: Orchestrates cross-package migrations with blast radius tracking and validation
- **References**: See `CLAUDE.md` for dependency order and deployment patterns

## Expected Tool Usage

| Tool | Scope | Notes |
|------|-------|-------|
| Read | All | Read files across all packages |
| Glob | All | Find affected files by pattern |
| Grep | All | Search for usage of changing APIs |
| Edit | All | Update files across packages |
| Write | All | Create migration scripts and plans |
| Bash | `bun`, `forge`, `cast`, `git` | Build/test/deploy commands |
| TodoWrite | All | Track migration progress (REQUIRED) |

## MCP Servers

| Server | Purpose |
|--------|---------|
| foundry | Contract compilation and testing |

## Guidelines

- **Thinking depth**: High — migrations affect multiple packages and must be carefully sequenced
- **Scope**: Full write access — migrations touch contracts, indexer, shared, and frontend packages
- **Safety**: Always validate each package builds before moving to the next

## Progress Tracking (REQUIRED)

**Every migration MUST use TodoWrite with granular per-package tracking.**

### Before Starting
```text
1. Todo: "Assess blast radius — identify all affected packages and files" → in_progress
2. Todo: "Create migration plan with dependency order" → pending
3. Todo: "Migrate package: contracts" → pending
4. Todo: "Migrate package: indexer" → pending
5. Todo: "Migrate package: shared" → pending
6. Todo: "Migrate package: client" → pending
7. Todo: "Migrate package: admin" → pending
8. Todo: "Cross-package validation (build + test all)" → pending
```

### During Migration
- After each package: mark completed, validate build, start next
- If new breakage discovered: add todo for it
- If blocked: document the issue and reassess order
- Keep exactly ONE package migration as in_progress

## Activation

Use when:
- User says "use migration agent" or "migrate this"
- Protocol upgrade spanning multiple packages (e.g., Hats v1 → v2)
- Contract ABI changes that ripple through indexer and frontend
- Dependency version upgrades with breaking changes
- IndexedDB schema changes requiring data migration
- UUPS proxy upgrades with storage layout changes

## Migration Protocol

### Phase 1: Blast Radius Assessment

Before ANY code changes:

1. **Identify the change origin** — What changed? (contract, dependency, API)
1. **Map affected packages** — Which packages import/use the changed thing?
1. **Classify impact per package**:

| Impact | Definition | Example |
|--------|-----------|---------|
| **Breaking** | Won't compile without changes | ABI change, removed export |
| **Behavioral** | Compiles but behaves differently | Event format change, new field |
| **Compatible** | No changes needed | Additive-only change |

1. **Generate blast radius report**:

```bash
# Find all files importing the changed module
grep -rn "import.*ChangedModule" packages/ --include="*.ts" --include="*.tsx"

# Find all files using the changed type/function
grep -rn "ChangedTypeName\|changedFunction" packages/ --include="*.ts" --include="*.tsx"

# Check for test files that need updating
grep -rn "ChangedModule\|changedFunction" packages/ --include="*.test.*"
```

### Phase 2: Migration Plan

Create plan following the **mandatory dependency order**:

```text
1. contracts  → ABI changes, storage layout, new events
2. indexer    → Schema updates, handler changes, re-index decision
3. shared     → Type updates, hook changes, new exports
4. client     → Component updates, view changes
5. admin      → Component updates, view changes
6. agent      → Handler updates (if applicable)
```

**Critical rule**: Each package MUST build successfully before moving to the next.

### Phase 3: Execute Per-Package

For each package in dependency order:

```text
1. Create package-specific todo
2. Make changes
3. Run package build: `bun --filter [package] build`
4. Run package tests: `bun --filter [package] test`
5. Fix any failures
6. Mark todo complete
7. Move to next package
```

### Phase 4: Cross-Package Validation

After all packages migrated:

```bash
# Full workspace build (respects dependency order)
bun build

# Full workspace lint
bun lint

# Full workspace test
bun run test

# Format check
bun format --check
```

### Phase 5: Migration Documentation

Create migration notes at `.plans/migrations/[date]-[name].md`:

```markdown
# Migration: [Name]

## Summary
[What changed and why]

## Blast Radius
| Package | Impact | Files Changed |
|---------|--------|---------------|

## Breaking Changes
[List with before/after examples]

## Rollback Plan
[How to revert if needed]

## Post-Migration
- [ ] Indexer re-indexed (if schema changed)
- [ ] Frontend deployed with new types
- [ ] Monitoring verified post-deploy
```

## Migration Types

### Contract ABI Change

```text
contracts: Update Solidity, rebuild ABIs
    ↓
indexer: Update schema.graphql + EventHandlers.ts, rebuild
    ↓
shared: Update types, hooks that use new ABI
    ↓
client/admin: Update components using changed types
```

### UUPS Proxy Upgrade

```text
contracts: New implementation, storage layout check
    ↓
(deploy upgrade transaction)
    ↓
indexer: May need re-index if events changed
    ↓
shared: Update types if interface changed
```

### Dependency Version Bump

```text
shared: Update dependency, fix breaking API changes
    ↓
client/admin: Verify no breaking changes in consumers
    ↓
(run full test suite)
```

### IndexedDB Schema Change

```text
shared: Update IndexedDB version, add migration handler
    ↓
client: Test migration from old schema → new schema
    ↓
(users auto-migrate on next app load)
```

## Validation Commands

```bash
# Per-package validation
bun --filter contracts build && bun --filter contracts run test
bun --filter indexer build
bun --filter shared build && bun --filter shared run test
bun --filter client build && bun --filter client run test
bun --filter admin build && bun --filter admin run test

# Cross-package validation
bun build && bun lint && bun run test
```

## Core Rules (from CLAUDE.md)

These 7 rules are critical during migrations:

1. **Dependency Order**: Always migrate in order: contracts → indexer → shared → client/admin. Each package MUST build before moving to the next.
1. **Hook Boundary**: After migration, verify all hooks remain in `packages/shared/src/hooks/`. Never move hooks into client/admin during refactoring.
1. **Single .env**: Never create package-level `.env` files during migration. All env vars stay in root `.env`.
1. **Contract Addresses**: When contract addresses change, update `packages/contracts/deployments/{chainId}-latest.json`. Never introduce hardcoded addresses.
1. **Barrel Imports**: After renaming or moving exports, ensure all consumers use `import { x } from "@green-goods/shared"`, not deep paths.
1. **Type System**: Domain types (`Garden`, `Work`, `Action`, etc.) stay in `@green-goods/shared`. Use `Address` type, not `string`, for Ethereum addresses.
1. **Build Order**: Validate each package builds in dependency order. Run `bun --filter [package] build` after each package migration.

## Anti-Patterns

- **Never skip dependency order** — building client before shared causes stale types
- **Never migrate all packages at once** — validate incrementally
- **Never skip the blast radius assessment** — hidden dependencies cause runtime failures
- **Never forget indexer re-indexing** — stale indexed data after schema changes
- **Never deploy partially migrated code** — all packages must be consistent

## Key Principles

> Migration is a pipeline, not a patch. Each step validates before the next begins.

- **Incremental**: One package at a time, validate between each
- **Traceable**: Every change documented with TodoWrite
- **Reversible**: Rollback plan before starting
- **Validated**: Build + test after every package change
- **Documented**: Migration notes for future reference
