# Debug Skill

Systematic debugging methodology: find root causes before fixes, verify with evidence before claiming completion.

## Activation

Use when:
- Encountering bugs or errors (`/debug`)
- Tests failing unexpectedly
- Build failures
- Verifying task completion

## Agent Routing

| Scenario | Agent | Why |
|----------|-------|-----|
| Complex debugging (multi-file, unclear cause) | `oracle` | Deep investigation with evidence |
| Implementing the fix after root cause found | `cracked-coder` | Tracked implementation with TDD |
| Simple bugs (obvious cause, <10 lines) | Direct (no agent) | Faster fix |

**Invocation**: Say "use oracle to investigate this" or spawn via Task tool.

---

## Escalation to cracked-coder

After root cause is identified, decide the fix path:

| Fix Type | Criteria | Action |
|----------|----------|--------|
| **Simple** | <10 lines, single file, obvious fix | Fix directly, no agent |
| **Complex** | >10 lines, multi-file, needs tests | Escalate to cracked-coder |
| **Architectural** | Pattern change, refactor needed | Escalate to cracked-coder + /plan |

### When to Escalate

Escalate to cracked-coder when the fix requires:
- Writing new tests (TDD)
- Modifying multiple files
- Changing shared hooks or modules
- Contract modifications
- Architectural decisions

### Escalation Format

When handing off to cracked-coder:

```markdown
## Debug → cracked-coder Handoff

### Root Cause
[What you found]

### Location
[File:line where issue originates]

### Evidence
[Commands/logs that prove the cause]

### Suggested Fix
[Your recommendation]

### Tests Needed
[What tests should cover this fix]
```

---

## Progress Tracking (REQUIRED)

**Every debugging session MUST use TodoWrite for visibility and session continuity.**

### For Bug Investigation
```
1. Todo: "Gather evidence - read error messages" → in_progress
2. Todo: "Reproduce bug consistently" → pending
3. Todo: "Form hypothesis" → pending
4. Todo: "Test hypothesis" → pending
5. Todo: "Apply fix and verify" → pending
```

### During Debugging
```
- Mark each phase completed as you finish
- If blocked: add todo "Blocked: [reason]"
- If hypothesis fails: add todo "Hypothesis X failed - trying Y"
```

### Why This Matters
- **Resume debugging**: Pick up exactly where you left off
- **Team handoff**: Someone else can continue your investigation
- **Prevent loops**: See what you already tried

---

## Core Principle

> ALWAYS find root cause before attempting fixes.
> Evidence before claims, always.

---

## Part 1: Root Cause Investigation

### Phase 1: Gather Evidence

**DO NOT attempt any fixes yet.**

1. **Read error messages thoroughly**
   ```bash
   bun test 2>&1 | tee error.log
   ```

2. **Reproduce consistently**
   - Can you trigger it reliably?
   - Exact steps to reproduce?
   - Happens in all environments?

3. **Check recent changes**
   ```bash
   git log --oneline -20
   git diff HEAD~5
   ```

4. **Trace data flow backward**
   - Where does error manifest?
   - What calls that code?
   - Where does data originate?

### Phase 2: Pattern Analysis

1. **Find working examples**
   ```bash
   grep -rn "similar pattern" packages/
   ```

2. **Compare implementations**
   - What's different between working and broken?

3. **Check dependencies**
   - Version mismatches?
   - Missing peer dependencies?

### Phase 3: Hypothesis Testing

1. **Form specific hypothesis**
   - ✅ "Error occurs because X calls Y with null"
   - ❌ "Something is wrong with the API"

2. **Test minimally**
   - Change ONE variable at a time
   - Document what you tried

3. **Validate**
   ```typescript
   console.log("DEBUG:", { value, type: typeof value });
   ```

### Phase 4: Implementation

1. **Create failing test first**
   ```typescript
   it("should handle null input", () => {
     expect(() => processData(null)).not.toThrow();
   });
   ```

2. **Apply single fix** - Root cause, not symptom

3. **Verify**
   ```bash
   bun test && bun lint && bun build
   ```

4. **If 3+ fixes fail: STOP**
   - Question the architecture
   - Reassess understanding
   - Ask for help

---

## Part 2: Green Goods Debugging

### Offline Sync Issues

```bash
# Check job queue
grep -rn "useJobQueue" packages/shared/src/

# IndexedDB - Chrome DevTools > Application > IndexedDB

# Service Worker - Chrome DevTools > Application > Service Workers
```

**Common Issues**:
| Issue | Symptom | Solution |
|-------|---------|----------|
| Job stuck | Work not appearing | Clear/retry job |
| Stale data | Old data showing | Force refresh |
| SW old | Features missing | Clear SW, reload |
| Auth expired | Sync fails | Re-authenticate |

### Contract Issues

```bash
# Check ABI freshness
cd packages/contracts && bun build

# Verify deployment
cat deployments/84532-latest.json | jq '.gardenToken'

# Test contract call
cast call [address] "functionName()" --rpc-url $RPC_URL
```

### Hook Issues

```bash
bash .claude/scripts/validate-hook-location.sh
grep -rn "useEffect\|useMemo" [hook-file]
```

### i18n Issues

```bash
node .claude/scripts/check-i18n-completeness.js
```

---

## Part 3: Verification Before Completion

### Mandatory Steps

Before ANY completion claim:

1. **IDENTIFY** - What command proves your claim?

| Claim | Command |
|-------|---------|
| "Tests pass" | `bun test` |
| "Build succeeds" | `bun build` |
| "Linting clean" | `bun lint` |
| "Types correct" | `bun run tsc --noEmit` |
| "Hook valid" | `bash .claude/scripts/validate-hook-location.sh` |
| "i18n complete" | `node .claude/scripts/check-i18n-completeness.js` |

2. **EXECUTE** - Run freshly (don't trust cached results)

3. **READ** - Complete output, check exit codes

4. **VERIFY** - Does output support your claim?

### Suspicious Language Detector

If you catch yourself saying:

| Phrase | Action |
|--------|--------|
| "should work" | STOP - verify first |
| "I think" | STOP - verify first |
| "probably" | STOP - verify first |
| "seems to" | STOP - verify first |

### Evidence Format

```markdown
## Verification Evidence

### Tests
$ bun test
✓ 142 tests passed
0 failures

### Build
$ bun build
Build completed successfully

### Type Check
$ bun run tsc --noEmit
No errors
```

---

## Part 4: Bug Issue Creation (Prompt First)

### When to Offer Bug Issue Creation

After identifying root cause, if this is a recurring or significant bug:

1. **Prompt the user** using AskUserQuestion tool:

   ```json
   // Exact tool call format:
   {
     "questions": [{
       "question": "Root cause identified: [brief description]. This appears to be a recurring issue. Create a GitHub issue to track this bug?",
       "header": "Bug Issue",
       "options": [
         {
           "label": "Yes, create issue",
           "description": "Create bug issue with root cause analysis and fix details"
         },
         {
           "label": "No, fix only",
           "description": "Apply the fix without creating an issue"
         }
       ],
       "multiSelect": false
     }]
   }
   ```

2. **Always ask before creating** — never auto-create issues.

### Bug Issue Template from Debug Session

```bash
gh issue create \
  --title "fix: [bug-title]" \
  --label "bug" \
  --assignee "@me" \
  --project "Green Goods" \
  --body "$(cat <<'EOF'
## Bug Description
[Description from debug session]

## Root Cause Analysis
**Cause**: [identified root cause]
**Location**: `[file:line]`

## Steps to Reproduce
1. [Step from debug session]
2. [Step 2]

## Fix Applied
[Description of fix, or "Pending" if not yet fixed]

## Verification
```bash
[Commands that prove the fix]
```

## Prevention
[How to prevent this in future]

---
*Generated from debug session*
EOF
)"
```

### When to Suggest Issue Creation

| Scenario | Suggest Issue? |
|----------|----------------|
| One-off typo | No |
| Recurring pattern | Yes |
| Architectural flaw | Yes |
| Missing validation | Yes |
| Edge case not handled | Consider |
| External dependency issue | Yes (for tracking) |

---

## Debugging Checklist

- [ ] Error message read completely
- [ ] Issue reproduced consistently
- [ ] Recent changes reviewed
- [ ] Root cause identified (not symptom)
- [ ] Hypothesis formed and documented
- [ ] Single fix applied
- [ ] Fix verified with tests
- [ ] No regression introduced
- [ ] Offered to create issue (if significant)

## Anti-Patterns

| Anti-Pattern | Better Approach |
|--------------|-----------------|
| Guess and check | Form hypothesis first |
| Multiple changes at once | One change at a time |
| Ignore error messages | Read them completely |
| Fix symptoms | Find root cause |
| "Works on my machine" | Test in CI |

## Three-Strike Protocol

After 3 failed fixes:

1. **STOP fixing**
2. **Document what you've tried**
3. **Question assumptions**
4. **Consider alternatives**: Different approach? Ask for help? Revert?

## Output

After debugging provide:
1. Root cause explanation
2. Fix applied
3. Verification results
4. Prevention recommendations
