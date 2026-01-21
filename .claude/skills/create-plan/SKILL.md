# Create Implementation Plan Skill

Create detailed implementation plans in `.plans/` directory for features, refactors, fixes, and enhancements.

## Activation

Use when:
- Starting a new feature
- Planning a refactor
- Before significant code changes
- User requests `/plan`

## Process

### Phase 1: Understanding & Validation

1. **Extract ALL requirements** from issue/task
2. **Map each requirement** to planned steps
3. **Audit codebase** before planning:
   - Search for existing patterns
   - Find related code
   - Identify dependencies
4. **Review CLAUDE.md** for compliance rules

### Phase 2: Green Goods Compliance Checklist

Before writing plan, verify against these rules:

- [ ] All new hooks will be in `packages/shared/src/hooks/`
- [ ] No package-specific .env files
- [ ] Contract addresses from deployment artifacts
- [ ] i18n keys for all UI strings
- [ ] Conventional commit format planned
- [ ] Single chain assumption (no runtime switching)

### Phase 3: Plan Structure

Use kebab-case: `[descriptive-name].todo.md`

**Required Sections**:

```markdown
# [Feature/Fix Name]

## Overview
Brief description and motivation.

## Requirements Coverage

| Requirement | Planned Step | Notes |
|-------------|--------------|-------|
| User can X  | Step 3       |       |

## CLAUDE.md Compliance
- [ ] Hooks in shared package
- [ ] i18n for UI strings
- [ ] Deployment artifacts for addresses
- [ ] Conventional commits

## Existing Code Analysis
- Related files: [list]
- Existing patterns to follow: [describe]
- Types to reuse: [list]

## Impact Analysis

### Files to Modify
- `packages/shared/src/hooks/useFoo.ts` - Add new hook
- `packages/client/src/views/Bar.tsx` - Use new hook

### Files to Create
- `packages/shared/src/hooks/useBaz.ts`

### Files to Delete
- None

## Implementation Steps

### Step 1: [Action]
**Files**: `path/to/file.ts`
**Details**: Specific changes to make

### Step 2: [Action]
...

## Removal Specification
Code to delete after implementation:
- `packages/old/deprecated.ts` - entire file
- `packages/shared/src/legacy.ts:45-67` - old function

## Anti-Patterns to Avoid
- Don't create hooks in client/admin
- Don't hardcode contract addresses
- Don't skip i18n for UI text

## Validation Criteria
- [ ] All requirements from issue implemented
- [ ] TypeScript passes (`bun run tsc --noEmit`)
- [ ] Linting passes (`bun lint`)
- [ ] Tests pass (`bun test`)
- [ ] Build succeeds (`bun build`)
- [ ] Hook location validated
- [ ] i18n completeness checked
```

### Phase 4: Create Plan File

Write plan to `.plans/[name].todo.md`

### Phase 5: Validation

1. **100% requirement coverage** - Every issue requirement has a step
2. **CLAUDE.md compliance** - All rules addressed
3. **Existing type reuse** - Use existing types where possible
4. **Specificity** - Each step is actionable

### Phase 6: Report to User

Summarize:
- Plan location
- Key files affected
- Requirement coverage
- Ready for implementation

## Key Principles

- **100% issue coverage** - Every requirement mapped
- **No migrations** - Replace completely, don't migrate
- **No temporary names** - Use final names from start
- **Thorough removal specs** - Track what gets deleted
- **CLAUDE.md compliance** - Follow all guidelines
- **Existing type reuse** - Don't duplicate types
- **Specificity over speed** - Detailed steps prevent problems

## Prohibited Patterns

- `any` or `unknown` types
- Migration mechanisms
- Fallback/compatibility code
- Temporary file names
- Half-implementations leaving legacy code
- Hooks outside shared package
- Package-specific .env files
- Hardcoded contract addresses
