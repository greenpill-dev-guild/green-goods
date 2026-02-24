# Output Contracts (Deterministic)

Canonical source for output shape, severity mapping, and mode flags used by `.claude/agents` and `.claude/skills`.

## Mode Flags

| Mode | Meaning | Allowed Side Effects |
|------|---------|----------------------|
| `report_only` | Analyze and report findings only | No code changes |
| `verify_only` | Run checks and report pass/fail | No code changes |
| `apply_fixes` | Implement approved or explicitly requested fixes | Code changes allowed |

## Severity Mapping

Use this mapping across all review surfaces:

| Source Severity | Action Bucket |
|----------------|---------------|
| `Critical` or `High` | `must-fix` |
| `Medium` | `should-fix` |
| `Low` | `nice-to-have` |

Additional rule:
- `P0-P4` is reserved for triage/incident classification only. Do not mix `P0-P4` into code-review severity lists.

## Ordered Output Templates

### Review Surfaces (`review`, `code-reviewer`, `autonomous-review`, `cross-package-verify`)

Required section order:
1. `Summary`
2. `Severity Mapping`
3. `Must-Fix`
4. `Should-Fix`
5. `Nice-to-Have`
6. `Verification`
7. `Recommendation`

### Triage (`triage`)

Required section order:
1. `Classification` (`P0-P4`)
2. `Affected Packages`
3. `Recommended Route`
4. `Context for Next Agent`

### Migration (`migration`)

Required section order:
1. `Summary`
2. `Blast Radius`
3. `Execution Order`
4. `Validation Results`
5. `Risks / Rollback`
6. `Completion Checklist`

## Routing Defaults

- `review` defaults to `report_only`. `apply_fixes` requires explicit user phrasing such as `"apply fixes"`.
- Cross-package verification routes through `/review --mode verify_only --scope cross-package` (legacy alias: `cross-package-verify`).
- `debug` defaults to `report_only`; test-first bugfixing routes through `/debug --mode tdd_bugfix`.
