# Architectural Analysis Skill

Systematic 8-phase methodology for conducting deep architectural audits of codebases.

## Activation

Use when:
- Evaluating codebase health
- Planning major refactors
- Onboarding to new codebase
- Identifying technical debt
- User requests architectural review

## Process

### Phase 1: Discovery & Planning

1. Map codebase structure:
   ```bash
   tree -d -L 3 packages/
   ```

2. Identify entry points:
   - `packages/client/src/main.tsx`
   - `packages/admin/src/main.tsx`
   - `packages/contracts/src/*.sol`

3. Create file-by-file analysis checklist

### Phase 2: Dead Code Detection

For each file:

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

### Phase 3: Duplication Detection

1. **Exact duplicates** (Critical):
   ```bash
   # Find duplicate function bodies
   grep -rn "function [name]" packages/
   ```

2. **Near duplicates** (High):
   - Same logic, different variable names
   - Copy-paste with minor modifications

3. **Conceptual duplicates** (Medium):
   - Similar patterns that could be abstracted
   - Repeated error handling

### Phase 4: Architectural Anti-Patterns

Check for:

| Anti-Pattern | Detection | Example |
|--------------|-----------|---------|
| God Objects | Files > 500 lines | Large utility files |
| Circular Dependencies | Import cycles | A imports B imports A |
| Tight Coupling | Direct instantiation | `new ServiceClass()` |
| Layer Violations | Wrong import direction | Client importing from admin |
| Singleton Abuse | Global mutable state | Non-store global variables |

### Phase 5: Green Goods Specific Checks

1. **Hook Boundary Violations**
   ```bash
   # Hooks outside shared package
   grep -rn "^export.*use[A-Z]" packages/client packages/admin
   ```

2. **Package .env Files**
   ```bash
   find packages -name ".env*" -not -path "*/node_modules/*"
   ```

3. **Hardcoded Addresses**
   ```bash
   grep -rn "0x[a-fA-F0-9]\{40\}" packages/ --include="*.ts" --include="*.tsx"
   ```

4. **Runtime Chain Switching**
   ```bash
   grep -rn "chainId" packages/ --include="*.ts" | grep -v "DEFAULT_CHAIN_ID"
   ```

### Phase 6: Type Issues Analysis

Check for:

| Issue | Pattern | Severity |
|-------|---------|----------|
| `any` type | `any` | High |
| `unknown` type | `unknown` | Medium |
| Type assertions | `as Type` | Medium |
| @ts-ignore | `//@ts-ignore` | High |
| Missing return types | `function foo()` | Low |

```bash
# Find any/unknown
grep -rn ": any\|: unknown" packages/ --include="*.ts" --include="*.tsx"

# Find assertions
grep -rn " as [A-Z]" packages/ --include="*.ts" --include="*.tsx"

# Find ts-ignore
grep -rn "@ts-ignore\|@ts-nocheck" packages/ --include="*.ts" --include="*.tsx"
```

### Phase 7: Code Smells Detection

| Smell | Threshold | Detection |
|-------|-----------|-----------|
| Long methods | > 50 lines | Line count |
| Many parameters | > 4 params | Function signature |
| Complex conditionals | > 3 conditions | Nested if/switch |
| Magic numbers | Literals | Non-const numbers |
| Commented code | Code blocks | `//` followed by code |

### Phase 8: Report Generation

Create at `.plans/architectural-analysis-[date].md`:

```markdown
# Architectural Analysis Report

## Executive Summary
- Files analyzed: N
- Dead code: X files, Y functions
- Duplications: Z instances
- Anti-patterns: W violations
- Type issues: V problems

## Dead Code
| File | Export | Last Used | Recommendation |
|------|--------|-----------|----------------|

## Duplications
| Pattern | Locations | Lines | Impact |
|---------|-----------|-------|--------|

## Anti-Patterns
| Issue | Location | Severity | Fix |
|-------|----------|----------|-----|

## Type Issues
| File | Line | Issue | Severity |
|------|------|-------|----------|

## Green Goods Violations
| Rule | Violation | Location |
|------|-----------|----------|

## Recommendations
1. [Priority 1 action]
2. [Priority 2 action]
...

## Statistics
- Total lines: N
- Test coverage: X%
- Type safety: Y%
- Estimated cleanup: Z hours
```

## Key Principles

- **Thorough**: Never skip files
- **Confident**: Assign confidence levels
- **Quantitative**: Count lines, estimate impact
- **Non-invasive**: Analysis only, no edits
- **Evidence-based**: Every finding has file:line

## Output

Present to user:
1. Executive summary
2. Top 5 critical findings
3. Cleanup priority list
4. Link to full report
