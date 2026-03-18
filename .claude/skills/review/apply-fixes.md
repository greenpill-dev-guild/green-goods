# Apply Fixes Mode

> Sub-file of the [review skill](./SKILL.md). Invoked via `/review --mode apply_fixes`.

## Deterministic Mode and Routing

- Default for this mode: `apply_fixes`
- Safety gate: explicit opt-in required (e.g., `/review --mode apply_fixes`, "autonomous review", "review and fix everything", "fix all review findings")
- Severity mapping is inherited from `.claude/standards/output-contracts.md`

If fix intent is not explicit, route to `review` (report-only).

## Fix Workflow

Execution contract:
1. Run canonical review protocol (report phase first)
2. Fix all `must-fix` and `should-fix` findings
3. Leave `nice-to-have` as recommendations unless user asks otherwise
4. Run verification commands before final recommendation

## Verification Contract

Run the smallest complete validation set for touched packages, then workspace checks as needed:

```bash
bun lint
bun run test
bun build
```

For contract-touching changes, also run:

```bash
bun run verify:contracts:fast
```

## Output Format

Use this exact ordered structure (from canonical output contract):

### Summary
- Scope reviewed
- Fix mode confirmation
- Files/packages touched

### Severity Mapping
- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

### Must-Fix
- Findings addressed with file:line evidence

### Should-Fix
- Findings addressed with file:line evidence

### Nice-to-Have
- Deferred recommendations

### Verification
- Commands executed
- Pass/fail outcomes

### Recommendation
- `APPROVE` or `REQUEST_CHANGES`

## Safety Rules

- Running this mode without explicit fix intent is an anti-pattern
- Skipping the report phase and jumping straight to edits is an anti-pattern
- Treating `nice-to-have` as mandatory by default is an anti-pattern
- Returning output that diverges from canonical section order is an anti-pattern
