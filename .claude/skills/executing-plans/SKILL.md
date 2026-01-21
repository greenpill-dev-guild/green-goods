# Executing Plans Skill

Structured methodology for implementing plans through batched execution with review checkpoints.

## Activation

Use when:
- Plan exists in `.plans/` directory
- User requests `/execute` or "execute the plan"
- Ready to implement after planning phase

## Process Overview

```
┌─────────────────────────────────────────┐
│  1. LOAD & REVIEW                       │
│     Read plan, identify concerns        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. EXECUTE BATCH                       │
│     3 tasks per batch (default)         │
│     Mark progress, run verifications    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. REPORT & PAUSE                      │
│     Show results, await feedback        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. CONTINUE or FINISH                  │
│     Apply feedback, next batch          │
└─────────────────────────────────────────┘
```

## Phase 1: Load & Review

1. **Read the plan**
   ```bash
   cat .plans/[plan-name].todo.md
   ```

2. **Identify concerns BEFORE starting**
   - Unclear steps?
   - Missing information?
   - Dependencies not addressed?
   - Potential blockers?

3. **Raise concerns immediately**
   - Don't start if plan is unclear
   - Ask for clarification
   - Suggest plan amendments

## Phase 2: Execute in Batches

**Default batch size**: 3 tasks

For each task in batch:

1. **Mark task in progress**
   ```markdown
   - [x] Step 1: Complete
   - [~] Step 2: In Progress
   - [ ] Step 3: Pending
   ```

2. **Implement the task**
   - Follow plan specifications exactly
   - No "improvements" beyond plan
   - Document any deviations

3. **Run specified verifications**
   ```bash
   # Whatever the plan specifies
   bun test
   bun lint
   bun build
   ```

4. **Mark task complete**
   - Only after verification passes
   - Note any issues encountered

## Phase 3: Report & Pause

After each batch:

```markdown
## Batch [N] Complete

### Tasks Completed
1. ✅ Step 1: [Description]
   - Files: `path/to/file.ts`
   - Verification: Tests pass

2. ✅ Step 2: [Description]
   - Files: `path/to/file.ts`
   - Verification: Build succeeds

3. ✅ Step 3: [Description]
   - Files: `path/to/file.ts`
   - Verification: Types clean

### Verification Output
```
$ bun test
✓ 42 tests passed
```

### Issues Encountered
- [Any blockers or concerns]

### Next Batch Preview
4. Step 4: [Description]
5. Step 5: [Description]
6. Step 6: [Description]

**Awaiting feedback before continuing...**
```

## Phase 4: Continue or Finish

**If continuing**:
1. Apply any feedback
2. Execute next batch
3. Repeat report/pause

**If finished**:
1. Run final verification
   ```bash
   bun format && bun lint && bun test && bun build
   ```
2. Update plan status
3. Transition to PR creation or finishing branch

## Critical Safety Rules

### Stop When Blocked

> Stop when blocked, don't guess.

If you encounter:
- Unclear instructions → Ask for clarification
- Missing dependencies → Report and wait
- Unexpected errors → Debug before continuing
- Verification failures → Fix before next batch

### No Forcing Through

Never:
- Skip failing tests to continue
- Ignore linting errors
- Proceed with unclear steps
- Assume what the plan meant

### Communication First

Always:
- Raise concerns before starting
- Report issues immediately
- Ask rather than assume
- Pause between batches

## Green Goods Execution

For Green Goods plans:

**Pre-batch checks**:
```bash
bash .claude/scripts/validate-hook-location.sh
node .claude/scripts/check-i18n-completeness.js
```

**Post-batch verifications**:
```bash
bun lint
bun test
bun build
```

**Contract changes**:
```bash
cd packages/contracts && bun test
```

## Batch Size Guidelines

| Plan Complexity | Batch Size |
|-----------------|------------|
| Simple changes | 5 tasks |
| Standard work | 3 tasks (default) |
| Complex/risky | 1-2 tasks |
| Contract changes | 1 task |

## Progress Tracking

Update plan file as you work:

```markdown
# [Plan Name]

## Progress
- Batch 1: ✅ Complete
- Batch 2: 🔄 In Progress
- Batch 3: ⏳ Pending

## Steps
- [x] Step 1: Done
- [x] Step 2: Done
- [x] Step 3: Done
- [~] Step 4: In Progress
- [ ] Step 5: Pending
...
```

## Output

At plan completion:
1. Summary of all completed steps
2. Final verification results
3. Any deviations from plan
4. Ready for review/PR
