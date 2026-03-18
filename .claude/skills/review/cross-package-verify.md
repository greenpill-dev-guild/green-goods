# Cross-Package Verify Mode

> Sub-file of the [review skill](./SKILL.md). Invoked via `/review --mode verify_only --scope cross-package`.

## Deterministic Modes

- Default mode: `verify_only`
- Fix mode: `apply_fixes` only with explicit user intent (e.g., "apply fixes" or "autonomous review")

## Verification Sequence

1. Execute package checks in dependency order (contracts -> shared -> indexer -> apps -> agent)
2. Report by severity/action bucket
3. Stop unless explicit fix-mode trigger is present

## Baseline Checks

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

## Output Format

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

## Safety Rules

- Entering fix mode without explicit user trigger is an anti-pattern
- Skipping dependency-order verification is an anti-pattern
- Reporting without severity-to-action mapping is an anti-pattern
- Omitting package-by-package verification evidence is an anti-pattern
