---
name: autonomous-review
user-invocable: false
description: Autonomous review-to-fix wrapper. Use when the user explicitly asks for review + implementation in one pass.
---

# Autonomous Review Skill

Thin wrapper around the canonical review protocol.

- Canonical review protocol: `.claude/skills/review/SKILL.md`
- Canonical output contract: `.claude/standards/output-contracts.md`

## Activation

Use only for explicit fix-intent prompts such as:
- `/review --mode apply_fixes`
- "autonomous review"
- "review and fix everything"
- "fix all review findings"

If fix intent is not explicit, route to `review` (report-only).

## Part 1: Deterministic Mode and Routing

- Default for this skill: `apply_fixes`
- Safety gate: this skill itself is the explicit opt-in gate for fix mode
- Severity mapping is inherited from `.claude/standards/output-contracts.md`

Execution contract:
1. Run canonical review protocol (report phase first)
2. Fix all `must-fix` and `should-fix` findings
3. Leave `nice-to-have` as recommendations unless user asks otherwise
4. Run verification commands before final recommendation

## Part 2: Verification Contract

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

## Part 3: Output Format

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

## Anti-Patterns

- Running this skill without explicit fix intent
- Skipping the report phase and jumping straight to edits
- Treating `nice-to-have` as mandatory by default
- Returning output that diverges from canonical section order

## Related Skills

- `review` — canonical 6-pass review protocol
- `cross-package-verify` — verify-first cross-package gate
- `tdd-bugfix` — bug-specific test-first fix loop
- `testing` — package-level verification depth
