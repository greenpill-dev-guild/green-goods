---
name: migration
description: Deterministic migration wrapper for cross-package breaking changes. Use for protocol upgrades and dependency-impacting migrations.
disable-model-invocation: true
---

# Migration Skill

Thin wrapper around the canonical migration protocol.

- Canonical migration protocol: `.claude/agents/migration.md`
- Canonical output contract: `.claude/standards/output-contracts.md`

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
grep -rn "ChangedType\|ChangedFunction" packages/ --include="*.ts" --include="*.tsx" --include="*.sol"
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

## Part 3: Handoff and Output

Write migration notes to `.plans/migrations/[date]-[name].md` with:
- Summary
- Blast Radius
- Execution Order
- Validation Results
- Risks / Rollback
- Completion Checklist

When using the migration agent, pass a concise handoff with:
- bundle ID
- affected packages
- highest-risk package boundary
- rollback trigger condition

## Anti-Patterns

- Maintaining a second migration protocol that diverges from `.claude/agents/migration.md`
- Skipping blast-radius mapping before edits
- Migrating packages out of dependency order
- Claiming completion without cross-package validation evidence
- Using raw Foundry build/test commands in migration steps

## Related Skills

- `contracts` — ABI/storage/deployment implications
- `indexer` — schema and handler migration steps
- `deployment` — rollout and rollback safety
- `testing` — regression and compatibility checks
- `plan` — migration plan lifecycle and execution tracking
