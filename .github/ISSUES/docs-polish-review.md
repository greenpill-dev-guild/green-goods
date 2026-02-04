# Review and Polish Green Goods Documentation

**Labels:** `documentation`

## Documentation Type

Update existing docs / Fix incorrect information

## Description

Comprehensive review and polish of all documentation in the `docs/` folder.

### Primary Goals

1. **Fix hallucinations and inaccuracies** - Audit all docs for information that may have been generated incorrectly or is now outdated:
   - Verify all file paths and code references actually exist
   - Confirm API endpoints and function signatures match current implementation
   - Validate CLI commands and configuration examples work as documented
   - Cross-check architecture diagrams against actual codebase structure

2. **Improve user experience** - Ensure smooth onboarding for all user types:
   - **Gardeners**: Clear quickstart guide, intuitive work logging instructions
   - **Operators**: Complete garden management and review workflows
   - **Evaluators**: Accurate data access and assessment documentation
   - **Developers**: Up-to-date setup, architecture, and contribution guides

3. **Consistency pass** - Align terminology, formatting, and structure:
   - Standardize terminology across all docs (e.g., "work" vs "action" vs "contribution")
   - Fix broken internal links between documentation pages
   - Ensure code examples follow current patterns from CLAUDE.md
   - Update screenshots/diagrams if UI has changed

### Acceptance Criteria

- [ ] All file paths and code references verified against codebase
- [ ] All CLI commands tested and working
- [ ] Internal links between docs pages functional
- [ ] Terminology consistent throughout
- [ ] Quickstart guides tested end-to-end
- [ ] No placeholder text or TODO comments remaining
- [ ] Developer setup instructions work on clean environment

### Scope

```
docs/
├── docs/concepts/          # Core concepts (attestations, gardens, roles)
├── docs/developer/         # Developer guides (30+ files)
├── docs/evaluators/        # Evaluator workflows
├── docs/features/          # Feature documentation
├── docs/gardeners/         # Gardener guides
├── docs/operators/         # Operator guides
├── docs/reference/         # FAQ, changelog, credits
├── docs/specs/             # Technical specifications
└── docs/welcome/           # Quickstart guides
```

## Location

`docs/` - All documentation files in the Docusaurus site
