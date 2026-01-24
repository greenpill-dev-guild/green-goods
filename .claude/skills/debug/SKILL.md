# Debug Skill

Systematic debugging: find root causes before fixes, verify with evidence before completion.

**References**: See `CLAUDE.md` for codebase patterns. Use `oracle` for complex investigation, `cracked-coder` for fixes.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/debug` | Start root cause investigation |
| Tests failing | Systematic debugging |
| Build failures | Trace and fix |
| Verifying completion | Evidence-based checks |

## Progress Tracking (REQUIRED)

Every debug session MUST use **TodoWrite**. See `CLAUDE.md` → Session Continuity.

---

## Core Principle

> ALWAYS find root cause before attempting fixes.
> Evidence before claims, always.

---

## Part 1: Root Cause Investigation

### Phase 1: Gather Evidence

**DO NOT attempt any fixes yet.**

1. **Read error messages thoroughly**
2. **Reproduce consistently** — exact steps
3. **Check recent changes**: `git log --oneline -20`
4. **Trace data flow backward** — where does error manifest?

### Phase 2: Hypothesis Testing

1. **Form specific hypothesis**
   - ✅ "Error occurs because X calls Y with null"
   - ❌ "Something is wrong with the API"

2. **Test minimally** — ONE variable at a time

3. **If 3+ fixes fail: STOP**
   - Question the architecture
   - Reassess understanding
   - Ask for help

---

## Part 2: Escalation to cracked-coder

| Fix Type | Criteria | Action |
|----------|----------|--------|
| **Simple** | <10 lines, single file | Fix directly |
| **Complex** | >10 lines, multi-file, needs tests | Escalate to cracked-coder |
| **Architectural** | Pattern change, refactor | cracked-coder + /plan |

### Handoff Format

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
```

---

## Part 3: Verification Before Completion

### Mandatory Verification

| Claim | Command |
|-------|---------|
| "Tests pass" | `bun test` |
| "Build succeeds" | `bun build` |
| "Linting clean" | `bun lint` |
| "Types correct" | `bun run tsc --noEmit` |

### Suspicious Language

If you say these, STOP and verify first:
- "should work"
- "I think"
- "probably"
- "seems to"

---

## Part 4: Green Goods Debugging

### Offline Sync Issues
- Check `useJobQueue` for stuck jobs
- IndexedDB: Chrome DevTools > Application
- Service Worker registration status

### Contract Issues
```bash
cd packages/contracts && bun build
cat deployments/84532-latest.json | jq '.gardenToken'
```

### Hook Issues
```bash
bash .claude/scripts/validate-hook-location.sh
```

---

## Three-Strike Protocol

After 3 failed fixes:
1. **STOP fixing**
2. **Document what you tried**
3. **Question assumptions**
4. **Consider alternatives**

---

## Output

After debugging provide:
1. Root cause explanation
2. Fix applied
3. Verification results
4. Prevention recommendations
