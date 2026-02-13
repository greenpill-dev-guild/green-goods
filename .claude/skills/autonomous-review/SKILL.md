---
name: autonomous-review
description: Autonomous Review→Fix→Verify→Commit pipeline. Use for full-cycle PR review with automatic fix implementation.
version: "1.0"
last_updated: "2026-02-11"
last_verified: "2026-02-11"
status: established
packages: [shared, client, admin, contracts, indexer]
dependencies: [review, testing, architecture]
---

# Autonomous Review Skill

Full autonomous pipeline: review all changes, prioritize findings, implement fixes, run tests, commit — with no intermediate approval needed.

**References**: See `review` skill for 6-pass protocol. See `CLAUDE.md` for codebase patterns.

---

## Activation

| Trigger | Action |
|---------|--------|
| "autonomous review" | Full autonomous review→fix→verify→commit pipeline |
| "review and fix everything" | Same — autonomous mode |
| "fix all review findings" | Skip review, implement all findings from prior review |

## Progress Tracking (REQUIRED)

Every autonomous review MUST use **TodoWrite**. See `CLAUDE.md` → Session Continuity.

---

## Part 1: The Pipeline

```
REVIEW → TRIAGE → FIX → VERIFY → COMMIT
  │         │       │       │        │
  │         │       │       │        └─ Organized logical commits
  │         │       │       └─ bun run test + bun lint + bun build
  │         │       └─ Implement all must-fix + should-fix items
  │         └─ Categorize: must-fix / should-fix / nice-to-have
  └─ Full 6-pass review (from review skill)
```

### Phase 1: Review (Autonomous)

Run the full 6-pass review protocol from the `review` skill:

1. **Pass 0**: Change explanation + blast radius
2. **Pass 0.5**: Issue coverage mapping
3. **Pass 1**: Technical issues (type errors, race conditions, missing error handling)
4. **Pass 2**: Code consistency (barrel imports, naming, dead code)
5. **Pass 3**: Architecture (hook boundary, hardcoded addresses, provider order)
6. **Pass 4**: Environment compatibility (offline, platform, .env)
7. **Pass 5**: Verification strategy

**Output**: Categorized findings list with severity.

### Phase 2: Triage (Autonomous)

Categorize all findings:

| Category | Criteria | Action |
|----------|----------|--------|
| **must-fix** | Critical/High severity, blocks merge | Implement immediately |
| **should-fix** | Medium severity, code quality | Implement in this cycle |
| **nice-to-have** | Low severity, suggestions | Document only, skip implementation |

**Decision rules:**
- Security issues → always must-fix
- Architectural violations (hook boundary, hardcoded addresses) → must-fix
- Missing error handling → must-fix
- Type safety gaps → should-fix
- Style inconsistencies → should-fix
- Suggestions/nitpicks → nice-to-have

### Phase 3: Fix (Autonomous)

Implement all must-fix and should-fix items:

1. **Order**: Fix must-fix items first, then should-fix
2. **Approach**: Fix each item as a discrete change
3. **Track**: Use TodoWrite — one todo per finding
4. **Skip**: nice-to-have items (document in summary)

**Per-fix workflow:**
```
1. Read the affected file(s)
2. Understand the context (read surrounding code)
3. Implement the minimal fix
4. Verify the fix doesn't break anything locally
```

**Guardrails during fixes:**
- Follow all 13 architectural rules
- Use utility hooks for timers/listeners/async
- Barrel imports only
- No hardcoded addresses
- No empty catch blocks

### Phase 4: Verify (Autonomous)

Run full validation after ALL fixes are applied:

```bash
# CRITICAL: Use `bun run test` not `bun test`
bun format && bun lint && bun run test && bun build
```

**If verification fails:**
1. Identify which fix caused the failure
2. Fix the regression
3. Re-run full validation
4. Repeat until green (max 3 attempts per regression — Three-Strike Protocol)

**Additional checks:**
```bash
# Package-specific type checking
cd packages/shared && bunx tsc --noEmit
cd packages/client && bunx tsc --noEmit
cd packages/admin && bunx tsc --noEmit
```

### Phase 5: Commit (Autonomous)

Organize changes into logical commits:

1. **Group by concern**: Each commit addresses one category of fixes
2. **Verify nothing missed**: Run `git status` after all commits
3. **Conventional commits**: `fix(scope): description` format

**Commit grouping strategy:**
```
Commit 1: fix(shared): resolve type safety issues
Commit 2: fix(client): add missing error handling
Commit 3: refactor(shared): fix barrel import violations
Commit 4: fix(contracts): address security findings
```

---

## Part 2: Headless Mode

Run the autonomous review pipeline non-interactively:

### Full Autonomous Review

```bash
claude -p "Review all changed files on this branch compared to main. Use a 6-pass review: (1) architecture & patterns, (2) security & error handling, (3) type safety, (4) test coverage gaps, (5) documentation accuracy, (6) style & conventions. Then categorize all findings as must-fix, should-fix, or nice-to-have. Create a TodoWrite checklist of all must-fix and should-fix items. Implement every fix, run the full test suite with \`bun run test\` and \`forge test\` as appropriate, fix any regressions, and when all tests pass and types check clean, organize changes into logical commits with descriptive messages. Do not ask me questions — make reasonable decisions and document any assumptions in commit messages." --allowedTools "Read,Bash,Grep,Glob,Edit,Write,TodoWrite"
```

### Review-Only (No Fixes)

```bash
claude -p "Review all changed files on this branch using your 6-pass methodology (security, types, tests, API contracts, performance, docs). Present all findings categorized as must-fix, should-fix, and nice-to-have. Do NOT implement anything — wait for my approval on which items to fix." --allowedTools "Read,Bash,Grep,Glob,TodoWrite" > .plans/review-$(git branch --show-current).md
```

### Fix Previously-Reviewed Findings

```bash
claude -p "Read the review findings in .plans/review-BRANCH.md. Implement all must-fix and should-fix items. Run full validation (bun run test, bun lint, bun build). Commit when green." --allowedTools "Read,Bash,Grep,Glob,Edit,Write,TodoWrite"
```

---

## Part 3: Output Format

### Summary Report

```markdown
## Autonomous Review Report

### Review Phase
- **Files reviewed**: X
- **Findings**: Y total (Z must-fix, W should-fix, V nice-to-have)

### Triage
| # | Severity | Finding | File:Line | Status |
|---|----------|---------|-----------|--------|
| 1 | must-fix | [description] | file.ts:123 | Fixed |
| 2 | should-fix | [description] | file.ts:456 | Fixed |
| 3 | nice-to-have | [description] | file.ts:789 | Skipped |

### Verification
- Tests: PASS (X tests)
- Lint: PASS
- Build: PASS
- Types: PASS

### Commits
1. `fix(scope): description` — N files changed
2. `refactor(scope): description` — M files changed

### Skipped (nice-to-have)
- [Finding] — `file.ts:789` (reason: style preference)
```

---

## Anti-Patterns

- **Fixing nice-to-haves** — Focus on must-fix and should-fix only; nice-to-haves waste cycles
- **Fixing without understanding** — Always read surrounding code before editing
- **Committing with failing tests** — Never commit until full validation passes
- **One giant commit** — Always organize into logical groups by concern
- **Skipping type checks** — `bun run test` passing doesn't mean types are clean
- **Implementing when asked to review only** — If the user says "review only", do NOT implement fixes

## Related Skills

- `review` — 6-pass review protocol (Phase 1 delegates to this)
- `testing` — Test validation and TDD patterns
- `architecture` — Architectural rules enforcement
- `git-workflow` — Commit organization and conventional commits
- `tdd-bugfix` — For bug-specific autonomous fix loops
- `cross-package-verify` — For multi-package validation
