# Audit Skill

Systematic codebase analysis combining quality audit and architectural review to identify technical debt, dead code, and violations.

## Activation

Use when:
- Starting a new feature (`/audit`)
- Before major refactoring
- Periodic quality assessment
- Evaluating codebase health

## Agent Routing

| Scenario | Agent | Why |
|----------|-------|-----|
| Deep architectural investigation | `oracle` | Multi-source research |
| Fixing audit findings | `cracked-coder` | Tracked implementation |
| Review of audit fixes | `code-reviewer` | 6-pass verification |
| Quick targeted audit | Direct (no agent) | Faster results |

**Invocation**: Say "use oracle to investigate [pattern]" or spawn via Task tool.

---

## Progress Tracking (REQUIRED)

**Every audit MUST use TodoWrite for visibility and session continuity.**

### For Full Audit
```
1. Todo: "Run automated checks (tsc, lint)" → in_progress
2. Todo: "Check Green Goods compliance" → pending
3. Todo: "Review files in [package]" → pending (one per package)
4. Todo: "Detect dead code" → pending
5. Todo: "Check architectural patterns" → pending
6. Todo: "Generate audit report" → pending
```

### During Audit
```
- Mark each section completed as you finish
- Add findings as sub-todos: "Finding: [severity] [description]"
- Track packages reviewed vs pending
```

### Why This Matters
- **Resumable audits**: Large codebases take time
- **Team handoff**: Another person can continue
- **Completeness**: Ensures nothing is skipped

---

## Part 1: Automated Analysis

### Run Automated Checks

```bash
# Type checking
bun run --filter [package] tsc --noEmit

# Linting
bun lint

# Contract analysis (if applicable)
cd packages/contracts && forge build && solhint 'src/**/*.sol'

# Find TODO/FIXME markers
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" packages/
```

### Green Goods Specific

```bash
# Hook location
bash .claude/scripts/validate-hook-location.sh

# i18n completeness
node .claude/scripts/check-i18n-completeness.js

# Contract artifacts match
diff packages/contracts/out/ packages/contracts/deployments/
```

---

## Part 2: File-by-File Review

### For Each File Check

1. **Deprecations** - Outdated patterns, old APIs
2. **Unfinished work** - TODO comments, incomplete implementations
3. **Architectural violations**:
   - Hooks in client/admin (must be in shared)
   - Package-level .env files (forbidden)
   - Hardcoded contract addresses
   - Runtime chain switching
4. **Type problems** - `any`, `unknown`, type assertions
5. **Code smells** - Long functions, deep nesting, magic numbers

### Severity Levels

- **CRITICAL**: Security issues, data loss risk
- **HIGH**: Bugs, broken functionality
- **MEDIUM**: Tech debt, maintainability
- **LOW**: Style, minor improvements

---

## Part 3: Dead Code Detection

### Process

1. **Identify exports**
   ```bash
   grep -n "export " [file]
   ```

2. **Search for usage**
   ```bash
   grep -rn "[export-name]" packages/ --include="*.ts" --include="*.tsx"
   ```

3. **Categorize**:
   - **Dead**: No usage found
   - **Possibly Dead**: Only test usage
   - **Internal**: Used within same file
   - **Active**: Used across codebase

4. **Verify false positives**:
   - Framework hooks (React components)
   - Public APIs
   - Contract entry points

---

## Part 4: Architectural Anti-Patterns

| Anti-Pattern | Detection | Example |
|--------------|-----------|---------|
| God Objects | Files > 500 lines | Large utility files |
| Circular Deps | Import cycles | A imports B imports A |
| Tight Coupling | Direct instantiation | `new ServiceClass()` |
| Layer Violations | Wrong import direction | Client importing admin |

### Green Goods Violations

```bash
# Hooks outside shared
grep -rn "^export.*use[A-Z]" packages/client packages/admin

# Package .env files
find packages -name ".env*" -not -path "*/node_modules/*"

# Hardcoded addresses
grep -rn "0x[a-fA-F0-9]\{40\}" packages/ --include="*.ts" --include="*.tsx"

# Runtime chain switching
grep -rn "chainId" packages/ --include="*.ts" | grep -v "DEFAULT_CHAIN_ID"
```

---

## Part 5: Type Issues

| Issue | Pattern | Severity |
|-------|---------|----------|
| `any` type | `: any` | High |
| `unknown` type | `: unknown` | Medium |
| Type assertions | `as Type` | Medium |
| @ts-ignore | `//@ts-ignore` | High |

```bash
# Find any/unknown
grep -rn ": any\|: unknown" packages/ --include="*.ts" --include="*.tsx"

# Find assertions
grep -rn " as [A-Z]" packages/ --include="*.ts" --include="*.tsx"

# Find ts-ignore
grep -rn "@ts-ignore\|@ts-nocheck" packages/ --include="*.ts" --include="*.tsx"
```

---

## Part 6: Report Generation

Create at `.plans/audits/[date]-audit.md`:

```markdown
# Audit Report - [Date]

## Executive Summary
- Files analyzed: N
- Critical issues: N
- High issues: N
- Medium issues: N
- Low issues: N

## Critical Findings
[List with file:line references]

## Dead Code
| File | Export | Last Used | Recommendation |
|------|--------|-----------|----------------|

## Duplications
| Pattern | Locations | Impact |
|---------|-----------|--------|

## Anti-Patterns
| Issue | Location | Severity | Fix |
|-------|----------|----------|-----|

## Type Issues
| File | Line | Issue | Severity |
|------|------|-------|----------|

## Green Goods Violations
| Rule | Violation | Location |
|------|-----------|----------|

## Automated Tool Results
### TypeScript
[tsc output]

### Linting
[oxlint output]

## Recommendations
1. [Priority 1 action]
2. [Priority 2 action]

## Statistics
- Total lines: N
- Type safety: Y%
- Estimated cleanup: Z hours
```

---

## Part 7: Issue Creation from Findings (Prompt First)

### When to Offer Issue Creation

After generating audit report, for CRITICAL or HIGH findings:

1. **Prompt the user** using AskUserQuestion tool:

   ```json
   // Exact tool call format:
   {
     "questions": [{
       "question": "Audit found N CRITICAL and M HIGH issues. Create GitHub issues for these findings?",
       "header": "Issues",
       "options": [
         {
           "label": "All CRITICAL/HIGH",
           "description": "Create issues for all significant findings with full context"
         },
         {
           "label": "CRITICAL only",
           "description": "Only create issues for blocking/security issues"
         },
         {
           "label": "Skip",
           "description": "Don't create issues, just report findings"
         }
       ],
       "multiSelect": false
     }]
   }
   ```

2. **Always ask before creating** — never auto-create issues.

### Issue Template for Audit Findings

```bash
gh issue create \
  --title "audit: [finding-title]" \
  --label "tech-debt" \
  --assignee "@me" \
  --project "Green Goods" \
  --body "$(cat <<'EOF'
## Audit Finding

**Severity**: [CRITICAL/HIGH/MEDIUM]
**Location**: `[file:line]`
**Audit Date**: [date]

## Description
[Finding description]

## Impact
[What could go wrong if not fixed]

## Recommended Fix
[How to resolve this issue]

## Related Files
- `[file1.ts]`
- `[file2.ts]`

---
*Auto-generated from audit report: `.plans/audits/[date]-audit.md`*
EOF
)"
```

### Batch Creation

For multiple findings:
```bash
# Create issues in batch, capture issue numbers
for finding in findings; do
  ISSUE_URL=$(gh issue create ... --json url --jq '.url')
  echo "Created: $ISSUE_URL"
done

# Add summary comment to audit report
gh issue comment [AUDIT_TRACKING_ISSUE] --body "Created issues: #1, #2, #3"
```

### Post-Creation

After creating issues:
1. Update audit report with issue links
2. Add issues to project board
3. Set priority field based on severity

---

## Key Principles

- **Complete all files** - Never skip files in scope
- **Read-only mode** - Do not edit during audit
- **Evidence-based** - Every finding needs file:line reference
- **Severity consistency** - Apply same standards across codebase
- **Green Goods conventions** - Check against CLAUDE.md rules
- **Prompt before issues** - Always ask user before creating GitHub issues

## Output

Present to user:
1. Executive summary
2. Top 5 critical/high findings
3. Green Goods violations
4. Link to full report
5. Offer to create GitHub issues (prompt first)
6. Recommended next steps
