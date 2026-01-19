# Systematic Debugging Skill

Structured methodology for investigating and resolving technical issues by finding root causes before attempting fixes.

## Activation

Use when:
- Encountering bugs or errors
- Tests failing unexpectedly
- Performance problems
- Build failures
- User reports issues

## Core Principle

> ALWAYS find root cause before attempting fixes.
> Symptom fixes are failure.

## The Four Phases

### Phase 1: Root Cause Investigation

**DO NOT attempt any fixes yet.**

1. **Read error messages thoroughly**
   ```bash
   # Capture full error output
   bun test 2>&1 | tee error.log
   ```

2. **Reproduce consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - Does it happen in all environments?

3. **Check recent changes**
   ```bash
   git log --oneline -20
   git diff HEAD~5
   ```

4. **Gather diagnostic evidence**
   - Console logs
   - Network requests
   - State snapshots
   - Stack traces

5. **Trace data flow backward**
   - Where does the error manifest?
   - What calls that code?
   - Where does the data originate?

### Phase 2: Pattern Analysis

1. **Find working examples**
   ```bash
   # Search for similar patterns that work
   grep -rn "similar pattern" packages/
   ```

2. **Compare implementations**
   - What's different between working and broken?
   - Same inputs, different outputs?

3. **Check dependencies**
   - Version mismatches?
   - Missing peer dependencies?
   - Configuration differences?

### Phase 3: Hypothesis and Testing

1. **Form specific hypothesis**
   - "The error occurs because X calls Y with null"
   - NOT "something is wrong with the API"

2. **Test minimally**
   - Change ONE variable at a time
   - Verify each assumption
   - Document what you tried

3. **Validate hypothesis**
   ```typescript
   // Add diagnostic logging
   console.log("DEBUG:", { value, type: typeof value });
   ```

### Phase 4: Implementation

1. **Create failing test first**
   ```typescript
   it("should handle null input", () => {
     expect(() => processData(null)).not.toThrow();
   });
   ```

2. **Apply single fix**
   - Address root cause, not symptom
   - Minimal change required

3. **Verify fix**
   ```bash
   bun test
   bun lint
   bun build
   ```

4. **If 3+ fixes fail: STOP**
   - Question the architecture
   - Reassess understanding
   - Consider asking for help

## Green Goods Specific Debugging

### Offline Sync Issues

```bash
# Check job queue state
grep -rn "useJobQueue" packages/shared/src/

# Check IndexedDB
# Open Chrome DevTools > Application > IndexedDB

# Check Service Worker
# Chrome DevTools > Application > Service Workers
```

### Contract Interaction Issues

```bash
# Check ABI freshness
cd packages/contracts && bun build

# Verify deployment artifacts
cat deployments/84532-latest.json | jq '.gardenToken'

# Test contract call
cast call [address] "functionName()" --rpc-url $RPC_URL
```

### Hook Issues

```bash
# Verify hook location
bash .claude/scripts/validate-hook-location.sh

# Check hook dependencies
grep -rn "useEffect\|useMemo\|useCallback" [hook-file]
```

### i18n Issues

```bash
node .claude/scripts/check-i18n-completeness.js
```

## Debugging Checklist

- [ ] Error message read completely
- [ ] Issue reproduced consistently
- [ ] Recent changes reviewed
- [ ] Root cause identified (not symptom)
- [ ] Hypothesis formed and documented
- [ ] Single fix applied
- [ ] Fix verified with tests
- [ ] No regression introduced

## Anti-Patterns to Avoid

| Anti-Pattern | Better Approach |
|--------------|-----------------|
| Guess and check | Form hypothesis first |
| Multiple changes at once | One change at a time |
| Ignore error messages | Read them completely |
| Fix symptoms | Find root cause |
| Skip reproduction | Reproduce first |
| "Works on my machine" | Test in CI environment |

## Three-Strike Protocol

If you've tried 3 fixes without success:

1. **STOP fixing**
2. **Document what you've tried**
3. **Question assumptions**:
   - Is my understanding correct?
   - Is the architecture sound?
   - Am I solving the right problem?
4. **Consider alternatives**:
   - Different approach?
   - Ask for help?
   - Revert and rethink?

## Output

After debugging:
1. Root cause explanation
2. Fix applied
3. Verification results
4. Prevention recommendations
