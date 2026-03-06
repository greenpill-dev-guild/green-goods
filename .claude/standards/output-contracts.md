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

## Acceptance Criteria (Definition of Done)

Per-agent-type checklists that codify when output is complete. These are pre-completion gates — do not mark a task done until all items pass.

### Triage

- [ ] Severity assigned (P0-P4) with evidence
- [ ] Type classified (bug, feature, enhancement, security, migration, performance, docs)
- [ ] Complexity rated (low, medium, high)
- [ ] Affected packages identified with impact summary
- [ ] Routing recommendation includes specific entry point skill
- [ ] 1-3 sentence handoff context provided for the next agent
- [ ] Completed within 5 turns

### Code Reviewer

- [ ] All 6 review passes executed (no skipped passes)
- [ ] Every finding has severity + file:line evidence
- [ ] Severity mapping applied (Critical|High → must-fix, Medium → should-fix, Low → nice-to-have)
- [ ] Verification commands run (`bun format && bun lint && bun run test && bun build`)
- [ ] Final verdict is APPROVE or REQUEST_CHANGES (never ambiguous)
- [ ] No files edited or written (strictly read-only)
- [ ] Output follows ordered template (Summary → Severity Mapping → Must-Fix → Should-Fix → Nice-to-Have → Verification → Recommendation)

### Oracle

- [ ] Minimum 3 research paths attempted
- [ ] Every finding has confidence rating (High/Medium/Low)
- [ ] Sources cited (file:line for code, URLs for external)
- [ ] Evidence vs. inference clearly distinguished
- [ ] Executive summary provided (1-2 sentences)
- [ ] Synthesis section connects findings across sources
- [ ] No files edited or written (strictly read-only)

### Cracked Coder

- [ ] Failing tests written before implementation (TDD)
- [ ] All tests pass (`bun run test`)
- [ ] Lint passes (`bun lint`)
- [ ] Build succeeds (`bun build`)
- [ ] Hooks live in `@green-goods/shared` (hook boundary respected)
- [ ] Barrel exports updated if new public API was added
- [ ] No `console.log` — uses `logger` from shared
- [ ] Error handling uses `parseContractError()` + `createMutationErrorHandler()` where applicable
- [ ] Cathedral Check performed (most similar existing file used as reference)

### Migration

- [ ] Blast radius assessment completed before any code changes
- [ ] Dependency order followed: contracts → indexer → shared → client/admin → agent
- [ ] Each package builds and tests pass before moving to the next
- [ ] Migration notes created at `.plans/migrations/`
- [ ] Incremental commits per successfully migrated package
- [ ] Cross-package validation passed (`bun build && bun lint && bun run test`)
- [ ] Rollback path documented

### Storybook Author

- [ ] Component source file read before writing any story
- [ ] CSF3 format with `tags: ["autodocs"]`
- [ ] Title matches hierarchy convention
- [ ] Minimum exports: Default, DarkMode, Gallery
- [ ] All public props have argTypes with controls + descriptions
- [ ] Dark mode uses `data-theme="dark"` attribute (not class-based)
- [ ] No hardcoded colors (semantic tokens from `theme.css`)
- [ ] Remixicon imports (not lucide)

## Cross-Agent Routing Matrix

When an agent discovers work exceeding its scope, use this matrix to determine the correct action. Do not attempt out-of-scope work — route deterministically.

### Scope Escalation Rules

| Discovering Agent | Discovery | Action |
|---|---|---|
| **triage** | P0/P1 severity | Route to `/debug --mode incident_hotfix`, note urgency |
| **triage** | 3+ affected packages | Add note: "Consider migration agent for cross-package coordination" |
| **code-reviewer** | Findings affect 3+ packages | Output recommends spawning migration agent, not cracked-coder |
| **code-reviewer** | Security finding (crypto, auth, funds) | Escalate to user with severity justification before handoff |
| **oracle** | Research contradicts `product.md` or `intent.md` | Report conflict in Synthesis section; do not resolve unilaterally |
| **oracle** | Fix requires runtime testing (not just code reading) | Escalate: "Requires runtime verification — hand off to cracked-coder with test plan" |
| **cracked-coder** | Task touches 4+ packages | STOP. Save progress. Recommend migration agent for orchestration |
| **cracked-coder** | Discovers security vulnerability during implementation | STOP implementation. File finding as P0 triage input. Do not silently fix |
| **migration** | Breaking impact in 4+ packages | Abort. Document findings in `.plans/migrations/`. Recommend phased approach |
| **storybook-author** | Component API is unclear/inconsistent | Escalate to user. Do not invent props or behavior |

### Handoff Context Size Limits

All agent handoff briefs MUST be concise to prevent context bloat in agent chains:

| Handoff Type | Max Lines | Required Fields |
|---|---|---|
| Triage → any agent | 5 lines | Severity, type, affected packages, 1-sentence context |
| Oracle → cracked-coder | 20 lines | Decision, affected files (dependency order), constraints, approach, risk |
| Code-reviewer → cracked-coder | 15 lines | Must-fix items (dependency order), should-fix items, verification commands |
| Cracked-coder → code-reviewer | 10 lines | Files changed, test results, areas needing review focus |
| Any agent → migration | 10 lines | Change origin, affected packages, impact classification |

If a handoff brief exceeds the line limit, the sending agent MUST compress it. Prioritize: (1) what to do, (2) what constraints exist, (3) what files to touch. Drop explanatory context.

### Multi-Agent Priority Conflicts

When agents produce conflicting recommendations:

1. **Safety conflicts**: If any agent flags a safety/security concern, that takes priority regardless of other agents' recommendations. Consult `values.md` tier 1 (User Safety).
2. **Scope conflicts**: If code-reviewer says "fix X" but migration agent says "don't touch X until after Y," the migration agent's dependency ordering wins.
3. **Quality vs speed**: If cracked-coder wants to ship and code-reviewer has must-fix findings, the code-reviewer's findings block the ship. Quality > speed per `values.md` tier 3.
4. **Unresolvable conflicts**: When two agents disagree and neither has clear priority, escalate to user with both positions stated. Do not average or compromise autonomously.

## Routing Defaults

- `review` defaults to `report_only`. `apply_fixes` requires explicit user phrasing such as `"apply fixes"`.
- Cross-package verification routes through `/review --mode verify_only --scope cross-package` (legacy alias: `cross-package-verify`).
- `debug` defaults to `report_only`; test-first bugfixing routes through `/debug --mode tdd_bugfix`.
