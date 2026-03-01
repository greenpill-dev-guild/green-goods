---
name: cross-package-verify
description: Cross-package verification - runs type checks, lint, and tests across all packages to verify cross-boundary consistency. Use when changes span multiple packages and you need to verify nothing is broken, or after migrations and dependency upgrades.
version: "1.0.0"
status: active
packages: ["all"]
dependencies: ["review"]
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Cross-Package Verify Skill

Thin wrapper around canonical review/output standards for multi-package verification.

- Canonical review protocol: `.claude/skills/review/SKILL.md`
- Canonical output contract: `.claude/standards/output-contracts.md`

## Activation

Use for:
- `/review --mode verify_only --scope cross-package`
- "verify all packages"
- "cross-package verify"
- "parallel verification"

Explicit fix mode requires user phrase: "apply fixes" or "autonomous review".

## Part 1: Deterministic Modes

- Default mode: `verify_only`
- Fix mode: `apply_fixes` only with explicit user intent

Verification sequence:
1. Execute package checks in dependency order (contracts -> shared -> indexer -> apps -> agent)
3. Report by severity/action bucket
4. Stop unless explicit fix-mode trigger is present

## Part 2: Verification Baseline

Minimum checks by package scope:

```bash
bun lint
bun run test
bun build
```

Contract-touching scope additionally:

```bash
bun run verify:contracts:fast
```

Guidance checks:

```bash
node .claude/scripts/check-guidance-consistency.js
```

## Part 3: Output Format

Use this exact ordered structure:

### Summary
- Packages verified
- Mode used (`verify_only` or `apply_fixes`)

### Severity Mapping
- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

### Must-Fix
- Blocking regressions and broken contracts

### Should-Fix
- Important quality gaps

### Nice-to-Have
- Non-blocking improvements

### Verification
- Commands and outcomes per package

### Recommendation
- `APPROVE` or `REQUEST_CHANGES`

## Anti-Patterns

- Entering fix mode without explicit user trigger
- Skipping dependency-order verification
- Reporting without severity-to-action mapping
- Omitting package-by-package verification evidence

## Related Skills

- `review` — canonical review severity contract
- `autonomous-review` — explicit review-and-fix flow
- `testing` — validation strategy per package
- `migration` — ordered execution for breaking changes
