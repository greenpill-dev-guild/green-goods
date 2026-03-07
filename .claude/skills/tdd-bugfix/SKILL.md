---
name: tdd-bugfix
user-invocable: false
description: Deterministic test-first bugfix wrapper. Use for reproduce -> fix -> verify loops with explicit evidence.
---

# TDD Bugfix Skill

Thin wrapper for deterministic bugfix execution.

- Canonical debug flow: `.claude/skills/debug/SKILL.md`
- Canonical output contract (severity/action buckets): `.claude/standards/output-contracts.md`

## Activation

Use for:
- `/debug --mode tdd_bugfix`
- "tdd bugfix"
- "fix this bug with tests"
- "reproduce and fix"

If user asks for diagnosis-only, route to `debug` report mode instead.

## Part 1: Deterministic Bugfix Loop

Required sequence:
1. Reproduce with a failing test
2. Explain root cause in one concise statement
3. Apply minimal fix
4. Re-run reproduction test
5. Run broader regression suite
6. Report results with canonical severity mapping

Mode behavior:
- Default mode: `apply_fixes`
- Read-only alternative: use `debug` when user requests investigation only

## Part 2: Verification Contract

Run targeted tests first, then package/workspace verification as needed:

```bash
bun run test
bun lint
bun build
```

For contract bugfixes:

```bash
cd packages/contracts && bun run test
```

## Part 3: Output Format

Use this ordered structure:

### Summary
- Bug reproduced
- Root cause
- Fix scope

### Severity Mapping
- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

### Must-Fix
- The bugfix implemented to resolve the reported failure

### Should-Fix
- Additional nearby hardening applied in same pass

### Nice-to-Have
- Deferred cleanup recommendations

### Verification
- Reproduction test result
- Regression/build/lint status

### Recommendation
- `APPROVE` if regression checks pass
- `REQUEST_CHANGES` if bug remains or regressions appear

## Anti-Patterns

- Implementing without first reproducing in tests
- Mixing unrelated refactors into bugfix commits
- Skipping regression coverage after the initial fix passes
- Emitting non-deterministic output structure

## Related Skills

- `debug` — diagnosis and root-cause isolation
- `testing` — test design and coverage standards
- `autonomous-review` — review-first, multi-finding fix flow
- `review` — canonical severity/action mapping
