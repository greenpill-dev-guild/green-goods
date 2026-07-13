# Apply Fixes Mode

> Sub-file of the [review skill](./SKILL.md). Invoked via `/review --mode apply_fixes`.

## Deterministic Mode and Routing

- Default for this mode: `apply_fixes`
- Safety gate: explicit opt-in required (e.g., `/review --mode apply_fixes`, "autonomous review", "review and fix everything", "fix all review findings")
- Severity mapping is inherited from the parent review skill: `Critical|High -> must-fix`, `Medium -> should-fix`, `Low -> nice-to-have`

If fix intent is not explicit, route to the default `review` readiness mode.

## Fix Workflow

Execution contract:
1. Run canonical review protocol (report phase first)
2. Fix all `must-fix` and `should-fix` findings
3. Leave `nice-to-have` as recommendations unless user asks otherwise
4. Preserve unresolved human-judge call-outs; do not decide them implicitly
5. Re-run the complete `readiness` review against the updated bounded feature path
6. Issue a final recommendation only from that fresh readiness review

## Verification Contract

Run the non-mutating Review Readiness Gate and every applicable conditional check from
[`validation-pipeline.md`](../../context/validation-pipeline.md). Do not maintain a second command
list here. Visible UI still requires authenticated Brave proof after fixes.

`APPROVE` is allowed only when all authoritative requirements are `SATISFIED`, scope coverage is
complete, all required proof is `PASS`, and both `must-fix` and `should-fix` are empty. A blocked
requirement, proof surface, or human judgment produces `COMMENT_ONLY`; a failed check or remaining
production-quality gap produces `REQUEST_CHANGES`.

## Output Format

Use this exact ordered structure (from canonical output contract):

### Summary
- Scope reviewed
- Fix mode confirmation
- Files/packages touched

### Requirements Coverage
- Requirement-to-evidence status after fixes

### Regression Coverage
- Preserved behavior, affected consumers, and regression proof

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
- Commands and observable proof
- `PASS`, `FAIL`, `BLOCKED`, or `N/A` outcomes

### Recommendation
- `APPROVE`, `REQUEST_CHANGES`, or `COMMENT_ONLY` under the parent readiness rules

## Safety Rules

- Running this mode without explicit fix intent is an anti-pattern
- Skipping the report phase and jumping straight to edits is an anti-pattern
- Skipping the fresh readiness re-review after fixes is an anti-pattern
- Treating `nice-to-have` as mandatory by default is an anti-pattern
- Returning `APPROVE` with unresolved human judgment or blocked proof is an anti-pattern
- Returning output that diverges from canonical section order is an anti-pattern
