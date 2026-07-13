# Cross-Package Verify Mode

> Sub-file of the [review skill](./SKILL.md). Invoked via `/review --mode verify_only --scope cross-package`.

## Deterministic Modes

- Default mode: `verify_only`
- Fix mode: `apply_fixes` only with explicit user intent (e.g., "apply fixes" or "autonomous review")

## Verification Sequence

1. Load the authoritative requirement baseline from the enclosing readiness review or supplied scope
2. Map changed public surfaces to direct callers and downstream package consumers
3. Execute the Review Readiness Gate in dependency order (contracts -> shared -> indexer -> apps -> agent)
4. Report requirements, regression/consumer coverage, and severity/action buckets
5. Stop unless explicit fix-mode trigger is present

## Baseline Checks

Use the non-mutating Review Readiness Gate and applicable conditional checks from
[`validation-pipeline.md`](../../context/validation-pipeline.md). Do not duplicate its commands
here. Report evidence package by package and call out consumers that could not be verified.

As a standalone `verify_only` pass, green evidence ends `COMMENT_ONLY`: it verifies the requested
cross-package surface but does not certify that the complete readiness review occurred. Failed
evidence or a confirmed cross-package gap ends `REQUEST_CHANGES`. Only an enclosing `readiness`
review may return overall `APPROVE`.

## Output Format

Use this exact ordered structure:

### Summary
- Packages verified
- Mode used (`verify_only` or `apply_fixes`)

### Requirements Coverage
- Baseline source and requirement statuses

### Regression Coverage
- Changed contracts, callers, consumers, and preserved behavior

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
- Commands and `PASS`, `FAIL`, `BLOCKED`, or `N/A` outcomes per package

### Recommendation
- Standalone `verify_only`: `COMMENT_ONLY` when green, `REQUEST_CHANGES` when failed
- Enclosing `readiness`: parent contract decides `APPROVE`, `REQUEST_CHANGES`, or `COMMENT_ONLY`

## Safety Rules

- Entering fix mode without explicit user trigger is an anti-pattern
- Skipping dependency-order verification is an anti-pattern
- Omitting affected callers or downstream consumers is an anti-pattern
- Reporting without severity-to-action mapping is an anti-pattern
- Omitting package-by-package verification evidence is an anti-pattern
- Returning standalone `APPROVE` from `verify_only` is an anti-pattern
