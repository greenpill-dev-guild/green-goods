# Audit Skill

Systematic codebase analysis: quality audit, dead code detection, architectural review.

**References**: See `CLAUDE.md` for codebase patterns. Use `oracle` for deep investigation.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/audit` | Full codebase audit |
| `/audit [package]` | Targeted package audit |
| Before refactoring | Identify tech debt |
| Periodic assessment | Codebase health check |

## Progress Tracking (REQUIRED)

Every audit MUST use **TodoWrite**. See `CLAUDE.md` → Session Continuity.

---

## Part 1: Automated Analysis

```bash
# Type checking
bun run --filter [package] tsc --noEmit

# Linting
bun lint

# Hook location
bash .claude/scripts/validate-hook-location.sh

# i18n completeness
node .claude/scripts/check-i18n-completeness.js

# TODO/FIXME markers
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" packages/
```

---

## Part 2: File-by-File Review

For each file check:
1. **Deprecations** — outdated patterns, old APIs
2. **Unfinished work** — TODO comments
3. **Architectural violations** (see CLAUDE.md):
   - Hooks in client/admin (must be in shared)
   - Package-level .env files
   - Hardcoded contract addresses
4. **Type problems** — `any`, `unknown`, type assertions
5. **Code smells** — long functions, deep nesting

### Severity Levels

- **CRITICAL**: Security issues, data loss risk
- **HIGH**: Bugs, broken functionality
- **MEDIUM**: Tech debt, maintainability
- **LOW**: Style, minor improvements

---

## Part 3: Dead Code Detection

1. **Identify exports**: `grep -n "export " [file]`
2. **Search for usage**: `grep -rn "[export-name]" packages/`
3. **Categorize**:
   - **Dead**: No usage
   - **Possibly Dead**: Only test usage
   - **Active**: Used across codebase

---

## Part 4: Architectural Anti-Patterns

| Anti-Pattern | Detection |
|--------------|-----------|
| God Objects | Files > 500 lines |
| Circular Deps | Import cycles |
| Layer Violations | Wrong import direction |

### Green Goods Violations

```bash
# Hooks outside shared
grep -rn "^export.*use[A-Z]" packages/client packages/admin

# Package .env files
find packages -name ".env*" -not -path "*/node_modules/*"

# Hardcoded addresses (exclude tests)
grep -rn "0x[a-fA-F0-9]\{40\}" packages/ --include="*.ts" | grep -v __tests__
```

---

## Part 5: Report Generation

Create at `.plans/audits/[date]-audit.md`:

```markdown
# Audit Report - [Date]

## Executive Summary
- Files analyzed: N
- Critical: N | High: N | Medium: N | Low: N

## Critical Findings
[List with file:line references]

## Dead Code
| File | Export | Recommendation |

## Anti-Patterns
| Issue | Location | Severity |

## Green Goods Violations
| Rule | Violation | Location |

## Recommendations
1. [Priority 1]
2. [Priority 2]
```

---

## Key Principles

- **Complete all files** — never skip
- **Read-only mode** — don't edit during audit
- **Evidence-based** — every finding needs file:line
- **Prompt before issues** — ask user before creating GitHub issues
