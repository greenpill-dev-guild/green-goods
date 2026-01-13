# Verification Before Completion Skill

Rigorous verification protocol to prevent false completion claims.

## Activation

Use when:
- About to claim a task is complete
- Before marking todo as done
- Before saying "tests pass" or "build succeeds"
- Any assertion about work status

## Core Principle

> Evidence before claims, always.

Never claim completion without proof.

## Mandatory Verification Steps

Before ANY completion claim:

### Step 1: IDENTIFY

What command proves your claim?

| Claim | Verification Command |
|-------|---------------------|
| "Tests pass" | `bun test` |
| "Build succeeds" | `bun build` |
| "Linting clean" | `bun lint` |
| "Types correct" | `bun run tsc --noEmit` |
| "Hook valid" | `bash .claude/scripts/validate-hook-location.sh` |
| "i18n complete" | `node .claude/scripts/check-i18n-completeness.js` |

### Step 2: EXECUTE

Run the command **freshly**:
```bash
# Don't trust cached results
# Run it now, in full
bun test
```

### Step 3: READ

Read the **complete** output:
- Don't skim
- Check exit codes
- Look for warnings, not just errors

### Step 4: VERIFY

Does output actually support your claim?
- "0 failures" ≠ "tests pass" (could be 0 tests)
- "Build complete" ≠ "no errors" (check for warnings)
- Partial success ≠ success

## Common Failure Patterns

### Pattern 1: Claiming Without Running

❌ "Tests should pass now"
✅ "Tests pass: `bun test` shows 42 passing, 0 failing"

### Pattern 2: Trusting Partial Checks

❌ "Linting is clean" (only ran on one file)
✅ "Linting clean: `bun lint` across all packages, 0 issues"

### Pattern 3: Hedging Language

❌ "This should work"
❌ "I think it's fixed"
❌ "It probably passes"

✅ "Verified working: [evidence]"

### Pattern 4: Trusting Agent Reports

❌ "The agent said tests pass"
✅ Run verification yourself

## Verification Checklist

Before claiming done:

- [ ] Identified verification command
- [ ] Executed command freshly
- [ ] Read complete output
- [ ] Exit code is 0
- [ ] No warnings or errors
- [ ] Output actually supports claim

## Suspicious Language Detector

If you catch yourself saying:

| Phrase | Action |
|--------|--------|
| "should work" | STOP - verify first |
| "I think" | STOP - verify first |
| "probably" | STOP - verify first |
| "seems to" | STOP - verify first |
| "looks like" | STOP - verify first |

## Green Goods Verification

For Green Goods tasks, always run:

```bash
# Full validation suite
bun format && bun lint && bun test && bun build

# Hook location
bash .claude/scripts/validate-hook-location.sh

# i18n completeness
node .claude/scripts/check-i18n-completeness.js

# Contract-specific (if applicable)
cd packages/contracts && bun test
```

## Evidence Format

When claiming completion, provide:

```markdown
## Verification Evidence

### Tests
```
$ bun test
✓ 142 tests passed
0 failures
```

### Linting
```
$ bun lint
No issues found
```

### Build
```
$ bun build
Build completed successfully
```

### Type Check
```
$ bun run tsc --noEmit
No errors
```
```

## Rationalization Traps

Avoid these excuses:

| Trap | Reality |
|------|---------|
| "I'm confident it works" | Confidence ≠ verification |
| "It worked before" | Verify now |
| "Small change, won't break" | Small changes can break things |
| "Takes too long to verify" | Breaking prod takes longer |
| "Just this once" | Never "just this once" |

## Consequences of Skipping

Past violations included:
- Shipping undefined functions
- Incomplete features in production
- Failed deployments
- Broken user experiences
- Lost trust

## Output

When completing a task:
1. State what was done
2. Show verification commands run
3. Show verification output
4. Confirm success with evidence
