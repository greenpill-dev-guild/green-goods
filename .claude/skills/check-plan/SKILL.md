# Check Plan Implementation Skill

Comprehensive audit of implementation progress against plans, verifying completed work, identifying remaining tasks, and validating quality.

## Activation

Use when:
- After implementing part of a plan
- Before marking a task complete
- User requests `/check-plan`
- Validating PR readiness

## Process

### Phase 1: Setup & Discovery

1. Identify the plan from `.plans/` directory
2. Gather git context:
   ```bash
   git status
   git diff --stat
   git log --oneline -10
   ```
3. Create comprehensive list of affected files

### Phase 2: Systematic File-by-File Audit

For each file mentioned in plan:

1. **Read current state** - Use Read tool
2. **Map to plan items** - Which steps does this file address?
3. **Verify implementation status**:
   - `DONE` - Fully implemented as specified
   - `PARTIAL` - Some requirements met
   - `NOT DONE` - Not yet implemented
   - `NEEDS REVIEW` - Implemented but quality concerns
4. **Assess quality**:
   - Type correctness (strict TypeScript)
   - Naming conventions (Green Goods style)
   - Architecture compliance (hooks in shared, etc.)
   - Test coverage

### Phase 3: Removal Spec Verification

Check that code marked for deletion was actually removed:

```bash
# Search for old patterns that should be gone
grep -rn "oldPattern" packages/
```

### Phase 4: Original Issue Coverage (MANDATORY)

**Critical**: Verify 100% of original issue/task requirements are implemented.

Create requirements table:

| Requirement | Plan Step | Implementation | Status |
|-------------|-----------|----------------|--------|
| User can X  | Step 3    | src/foo.ts:42  | DONE   |
| API returns Y | Step 5  | Missing        | NOT DONE |

### Phase 5: Green Goods Compliance

1. **Hook boundary** - No new hooks in client/admin
2. **i18n** - All UI strings in translation files
3. **Environment** - No package-specific .env files
4. **Contract addresses** - Using deployment artifacts
5. **Conventional commits** - Proper commit format

Run validators:
```bash
bash .claude/scripts/validate-hook-location.sh
node .claude/scripts/check-i18n-completeness.js
```

### Phase 6: Build Progress Report

Generate at `.plans/[plan-name].progress.md`:

```markdown
# Progress Report: [Plan Name]

## Summary
- Plan steps: N
- Completed: X (Y%)
- Remaining: Z

## Step-by-Step Status

### Step 1: [Description]
- Status: DONE
- Files: src/foo.ts, src/bar.ts
- Notes: Implemented as specified

### Step 2: [Description]
- Status: PARTIAL
- Files: src/baz.ts
- Missing: Error handling for edge case

## Quality Assessment
- TypeScript: PASS
- Linting: PASS
- Tests: 3 failing

## Remaining Work
1. Complete Step 2 error handling
2. Fix failing tests
3. Add i18n keys for new UI strings

## Coverage Table
[Requirements coverage table from Phase 4]
```

### Phase 7: Validation Checks

Run automated validation:

```bash
# Type check
bun run --filter [package] tsc --noEmit

# Lint
bun lint

# Tests
bun test

# Build
bun build
```

### Phase 8: Report to User

Provide concise summary:
- Completion percentage
- Blocking issues
- Next steps
- Link to progress report

## Key Principles

- **100% coverage required** - Plan isn't done until all requirements met
- **Evidence-based** - Every status needs file:line proof
- **Quality gates** - TypeScript, linting, tests must pass
- **Issue coverage first** - Original requirements > plan steps

## Critical Rule

> Plan isn't done until 100% complete and validated. This means:
> 1. All original issue requirements implemented
> 2. All plan steps completed
> 3. All validation checks passing
> 4. All removed code actually deleted
