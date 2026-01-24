# /audit - Codebase Audit

Run comprehensive codebase analysis to identify quality issues.

## Trigger

- `/audit` - Full codebase audit
- `/audit [package]` - Audit specific package
- `/audit security` - Security-focused audit

## Process

1. Load the `audit` skill from `.claude/skills/audit/SKILL.md`
2. Determine scope (full repo or specific package)
3. Execute multi-phase analysis
4. Generate report at `.plans/audits/`

## Usage

```bash
# Full audit
/audit

# Package-specific
/audit packages/shared
/audit packages/contracts

# Security focus
/audit security
```

## Audit Phases

1. **Automated Checks**
   - TypeScript: `bun run tsc --noEmit`
   - Linting: `bun lint`
   - Tests: `bun test`
   - Build: `bun build`

2. **Green Goods Compliance**
   - Hook location: `bash .claude/scripts/validate-hook-location.sh`
   - i18n completeness: `node .claude/scripts/check-i18n-completeness.js`
   - No package .env files
   - Contract addresses from artifacts

3. **Code Review**
   - Dead code detection
   - Duplicate logic
   - Type safety issues
   - Error handling gaps

4. **Architecture Analysis**
   - Layer violations
   - Circular dependencies
   - Abstraction quality
   - Pattern consistency

5. **Security Scan**
   - OWASP Top 10 checks
   - Dependency vulnerabilities
   - Secret exposure risks

## Output

Audit report with:
- Executive summary
- Top 5 critical/high findings
- Green Goods violations
- Full categorized findings
- Recommended next steps
