# /audit - Codebase Audit

Run comprehensive codebase analysis to identify quality issues.

## Trigger

User says `/audit` or `/audit [package]`

## Process

1. Load the `audit` skill from `.claude/skills/audit/SKILL.md`
2. Determine scope (full repo or specific package)
3. Execute 5-phase analysis
4. Generate report at `.plans/audits/`

## Quick Reference

```bash
# Full audit
/audit

# Package-specific
/audit packages/shared
/audit packages/contracts
```

## Output

Audit report with:
- Executive summary
- Critical/High/Medium/Low findings
- Automated tool results
- Recommended actions
