---
name: audit
description: Codebase Audit - dead code detection, unused exports, architectural anti-patterns, and dependency health. Use when the user asks for a codebase health check, wants to find dead code, or says 'audit the codebase'.
argument-hint: "[package-name]"
context: fork
version: "1.0.0"
status: active
packages: ["all"]
dependencies: ["review", "security"]
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

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

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` → Session Continuity.

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

### Automated Tooling (REQUIRED — always run before manual review)

> **IMPORTANT**: Always use `knip` for dead code detection.
> It understands TypeScript's module resolution and monorepo workspace relationships.
> **NEVER rely on grep-based scanning** for unused export detection — it has ~80% false-positive
> rate in this monorepo due to barrel exports, re-exports, and aliased imports.

```bash
# knip — PREFERRED: monorepo-aware unused files, exports, deps, types
# Installed at root as devDependency. Understands workspace cross-package imports.
bunx knip                          # Full analysis (files, exports, deps, types)
bunx knip --reporter compact       # Condensed output
bunx knip --include files          # Only unused files
bunx knip --include exports        # Only unused exports
bunx knip --include dependencies   # Only unused deps

# IMPORTANT: knip will flag files in packages/contracts/lib/ (Foundry deps).
# Filter these out — they are git submodules managed by Foundry, not dead code:
bunx knip --reporter compact 2>&1 | grep -v 'packages/contracts/lib/'

# madge — Detect circular dependencies
# Install: bun add -D madge
bunx madge --circular packages/shared/src/index.ts
bunx madge --circular packages/client/src/main.tsx
bunx madge --image graph.svg packages/shared/src/  # Visual dep graph

# bundlesize — Enforce bundle budgets (CI integration)
# Configure in package.json or bundlesize.config.json
# Green Goods budgets: main <150KB, per-route <50KB, total <400KB gzipped
```

| Tool | Purpose | Status |
|------|---------|--------|
| **knip** | Unused files, exports, deps, types (monorepo-aware) | **Installed** — primary tool for dead code audits |
| **madge** | Circular dependency detection | `bun add -D madge` |
| **bundlesize** | Bundle budget enforcement | `bun add -D bundlesize` |

### Manual Detection (fallback only — prefer knip)

Only use grep-based detection when automated tools cannot run (e.g., non-TypeScript files, Solidity contracts):

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

## Part 6: Skill & Configuration Drift Detection

Skills, hooks, and architectural rules reference specific hooks, utilities, types, and patterns. When the codebase evolves, these references can become stale. Include this check in every full audit.

### Automated Drift Checks

```bash
# Check that hooks referenced in skills actually exist
for hook in useTimeout useDelayedInvalidation useEventListener useWindowEvent \
  useDocumentEvent useAsyncEffect useAsyncSetup useOffline \
  useServiceWorkerUpdate useDraftAutoSave useDraftResume useJobQueue; do
  count=$(grep -rn "export.*$hook" packages/shared/src/ | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "DRIFT: $hook referenced in skills but not exported from shared"
  fi
done

# Check that utility functions referenced in skills exist
for util in parseContractError createMutationErrorHandler mediaResourceManager \
  getStorageQuota jobQueue jobQueueEventBus logger toastService; do
  count=$(grep -rn "export.*$util" packages/shared/src/ | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "DRIFT: $util referenced in skills but not exported from shared"
  fi
done

# Check that types referenced in skills exist
for type in Address Garden Work Action WorkApproval GardenAssessment \
  Job JobKind WorkDraft OfflineStatus; do
  count=$(grep -rn "export.*type.*$type\b\|export.*interface.*$type\b" packages/shared/src/ | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "DRIFT: Type $type referenced in skills but not found in shared"
  fi
done
```

### Manual Drift Checks

| Check | How | Severity |
|-------|-----|----------|
| **Hook names changed** | Compare skill references against `packages/shared/src/hooks/` exports | HIGH |
| **Import paths changed** | Verify barrel exports in `packages/shared/src/index.ts` | HIGH |
| **Provider order changed** | Compare Rule #13 against actual provider nesting in client/admin | MEDIUM |
| **Environment variables renamed** | Compare `.env.example` against skill references | MEDIUM |
| **Commands changed** | Verify `bun dev`, `bun test`, etc. still work as documented | LOW |
| **Port numbers changed** | Verify dev ports (3001, 3002, 6006, 8080) | LOW |

### Drift Report Section

Add to audit report:

```markdown
## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `useDelayedInvalidation` | data-layer SKILL.md, architectural-rules.md | ✅ Exists |
| `parseContractError` | error-handling SKILL.md | ⚠️ Renamed to `decodeContractError` |
| `Address` type | web3 SKILL.md, contracts SKILL.md | ✅ Exists |
| Provider order (Rule #13) | architectural-rules.md | ⚠️ `JobQueueProvider` moved above `AppProvider` |

### Recommendations
- Update error-handling SKILL.md: `parseContractError` → `decodeContractError`
- Update architectural-rules.md: Fix provider nesting order
```

## Key Principles

- **Complete all files** — never skip
- **Read-only mode** — don't edit during audit
- **Evidence-based** — every finding needs file:line
- **Prompt before issues** — ask user before creating GitHub issues
- **Check for drift** — verify skill references match actual codebase

## Related Skills

- `architecture` — Clean Architecture patterns for structural review
- `performance` — Bundle analysis and optimization findings
- `security` — Security-specific audit patterns for contracts
- `testing` — Coverage analysis and test gap identification
