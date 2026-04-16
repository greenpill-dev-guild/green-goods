---
name: migration
description: Deterministic migration wrapper for cross-package breaking changes. Use for protocol upgrades and dependency-impacting migrations.
parent: ops
---

# Migration Sub-Skill

Thin wrapper around the canonical migration protocol.

- Canonical migration protocol: this file + `/plan` feature hub lifecycle

## Activation

Use when:
- Breaking changes touch multiple packages
- Contract ABI or event changes ripple into indexer/shared/apps
- IndexedDB or data-model migrations are required
- Protocol/dependency upgrades need ordered rollout and rollback planning

## Part 1: Deterministic Routing and Blast Radius

1. Identify affected packages and classify impact
2. Produce a blast-radius map before editing:

```bash
rg -n "ChangedType|ChangedFunction" packages/ -g "*.ts" -g "*.tsx" -g "*.sol"
```

3. Classify per-package impact: `breaking | behavioral | compatible`
4. Do not execute migrations until dependency order and rollback path are documented

## Part 2: Execution Order and Validation

Mandatory package order:
1. `contracts`
2. `indexer`
3. `shared`
4. `client` and `admin`
5. `agent` (if touched)

Per package gate:

```bash
bun --filter <package> build
bun --filter <package> test
```

Cross-package gate:

```bash
bun build
bun lint
bun run test
```

Contract-touching migrations must also run:

```bash
bun run verify:contracts:fast
```

Rule: never use raw Foundry build/test commands in migration workflows; use bun wrappers.

## Backward Compatibility

When a migration needs a compatibility window, apply these rules explicitly:

1. **API signature stability**: adding optional parameters is acceptable; removing parameters, reordering them, or changing existing parameter types is breaking.
2. **Persisted data versioning**: IndexedDB schemas, localStorage keys, and cache shapes need an explicit version bump when their structure changes.
3. **Deprecation protocol**: deprecated exports should carry `@deprecated` guidance plus the replacement and remain re-exported for at least one release cycle.
4. **Type export stability**: renaming or removing a type exported from `@green-goods/shared` is breaking unless an alias preserves the old contract during transition.

## Part 3: Handoff and Output

Use `/plan` to create or update the owning feature hub before execution if one does not already exist.

This file is the canonical migration output contract. Use this section order:

1. `Summary`
2. `Blast Radius`
3. `Execution Order`
4. `Validation Results`
5. `Risks / Rollback`
6. `Completion Checklist`

Write migration notes to the owning feature hub at `.plans/{backlog|active}/<feature-slug>/reports/migration.md` with:
- Summary
- Blast Radius
- Execution Order
- Validation Results
- Risks / Rollback
- Completion Checklist

When handing migration work between people or tools, pass a concise brief with:
- bundle ID
- affected packages
- highest-risk package boundary
- rollback trigger condition

## Anti-Patterns

- Maintaining a second migration protocol outside this file and `/plan`
- Skipping blast-radius mapping before edits
- Migrating packages out of dependency order
- Claiming completion without cross-package validation evidence
- Using raw Foundry build/test commands in migration steps
- Removing compatibility shims before the downstream surface has been migrated
- Returning migration handoff output that omits the required section order above
