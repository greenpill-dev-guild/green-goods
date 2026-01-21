# Codebase Audit Skill

Systematic codebase analysis to identify quality issues, technical debt, and architectural problems.

## Activation

Use when:
- Starting a new feature to understand codebase health
- Before major refactoring
- Periodic quality assessment
- User requests `/audit`

## Process

### Phase 1: Discovery & Planning

1. Establish audit scope (package or full monorepo)
2. Map file structure using Glob
3. Create tracking in memory for findings
4. Initialize markdown report at `.plans/audits/[date]-audit.md`

### Phase 2: Automated Analysis

Run these checks (Green Goods adapted):

```bash
# Type checking
cd /Users/afo/Code/greenpill/green-goods && bun run --filter [package] tsc --noEmit

# Linting with oxlint
bun lint

# Contract-specific (if auditing contracts)
cd packages/contracts && forge build && solhint 'src/**/*.sol'

# Find TODO/FIXME markers
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" --include="*.sol" packages/
```

### Phase 3: Systematic File Review

For each file, check:

1. **Deprecations** - Outdated patterns, old APIs
2. **Unfinished work** - TODO comments, incomplete implementations
3. **Architectural violations**:
   - Hooks in client/admin (must be in shared)
   - Package-level .env files (forbidden)
   - Hardcoded contract addresses (use deployment artifacts)
   - Runtime chain switching (single chain only)
4. **Type problems** - `any`, `unknown`, type assertions
5. **Code smells** - Long functions, deep nesting, magic numbers

Assign severity:
- **CRITICAL**: Security issues, data loss risk
- **HIGH**: Bugs, broken functionality
- **MEDIUM**: Tech debt, maintainability
- **LOW**: Style, minor improvements

### Phase 4: Cross-File Analysis

1. **Dependency cycles** - Check for circular imports
2. **Dead code** - Unused exports, unreachable code
3. **Duplicate logic** - Similar implementations across packages
4. **Hook boundary violations** - Ensure all hooks in shared package

### Phase 5: Green Goods Specific Checks

1. **Contract artifacts**:
   ```bash
   # Verify deployments match compiled ABIs
   diff packages/contracts/out/ packages/contracts/deployments/
   ```

2. **i18n completeness**:
   ```bash
   node .claude/scripts/check-i18n-completeness.js
   ```

3. **Hook location validation**:
   ```bash
   bash .claude/scripts/validate-hook-location.sh
   ```

4. **Schema immutability** - Ensure schemas.json unchanged

### Phase 6: Report Generation

Create structured report at `.plans/audits/[date]-audit.md`:

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

## High Priority
[List with file:line references]

## Medium Priority
[List with file:line references]

## Low Priority
[List with file:line references]

## Automated Tool Results
### TypeScript
[tsc output]

### Linting
[oxlint output]

### Contract Analysis
[forge/solhint output]

## Recommendations
[Prioritized action items]
```

## Key Principles

- **Complete all files** - Never skip files in scope
- **Read-only mode** - Do not edit during audit
- **Evidence-based** - Every finding needs file:line reference
- **Severity consistency** - Apply same standards across codebase
- **Green Goods conventions** - Check against CLAUDE.md rules

## Output

Present findings to user with:
1. Summary statistics
2. Top 5 critical/high findings
3. Link to full report
4. Recommended next steps
