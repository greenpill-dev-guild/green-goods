# Org-Level Issue Templates Reference

> **Purpose**: These are GENERIC templates for `greenpill-dev-guild/.github` that work for any TypeScript + Solidity project in the organization.

## Templates Included

| Template | File | Labels | Description |
|----------|------|--------|-------------|
| Bug Report | `bug.yml` | `bug`, `triage` | Report bugs with priority, reproduction steps |
| Feature Request | `feature.yml` | `enhancement` | New features with problem/solution format |
| **Polish** (NEW) | `polish.yml` | `enhancement`, `polish` | UI/UX improvements, accessibility |
| **Documentation** (NEW) | `docs.yml` | `documentation` | Docs, guides, API references |

## Key Enhancements from Previous Templates

### 1. Priority Field (All Templates)
Every template now includes a required priority dropdown:
- Critical - Blocking/urgent
- High - Important, do soon
- Medium - Normal priority
- Low - Nice to have

### 2. Effort Estimate Section
AI-suggested and human-confirmed effort estimation field.

### 3. AI Investigation Notes
Structured section for AI assistants to add:
- Files analyzed
- Root cause analysis
- Suggested implementation

### 4. Best Practices Links
Footer with relevant best practice resources per template type.

### 5. Generic Package Options
Package dropdown uses generic terms that work for any project:
- frontend
- backend
- shared/common
- contracts/blockchain
- api/indexer
- docs
- other

## How to Use

### To Update PR #15
1. Copy these YAML files to `greenpill-dev-guild/.github/.github/ISSUE_TEMPLATE/`
2. Update `config.yml` contact links if needed
3. Test in a fork before merging

### For Project-Specific Extensions
Projects like Green Goods should:
1. NOT modify org templates
2. Use their Claude Code skills to ADD project-specific sections
3. See `.claude/skills/gh-ticket/` for Green Goods extensions

## Maintenance

These templates are shared org-wide. Any guild member can propose updates via PR to `greenpill-dev-guild/.github`.

### When to Update Org Templates
- Adding fields that benefit ALL projects
- Fixing bugs in template syntax
- Updating best practice links

### When NOT to Update Org Templates
- Project-specific fields (use skill extensions)
- Experimental features (test in project first)
