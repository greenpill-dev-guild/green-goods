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

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` → Session Continuity.

---

## Part 0: Previous Findings Verification

**REQUIRED before any new analysis.** Check whether previously reported Critical and High issues are still open.

### Steps

1. **Find the most recent audit report**:
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

## Part 1.5: Self-Validation (REQUIRED before Part 5)

Before generating the final report, re-verify EVERY finding from Parts 1-4:

1. **Re-read** the flagged file at the cited line number
2. **Confirm** the code matches what you described in the finding
3. **Check context** — read 10 lines above/below for guards, comments, or patterns that invalidate the finding
4. **Assign confidence**: `HIGH` (verified in code) / `MEDIUM` (likely but context unclear) / `LOW` (might be false positive)
5. **Drop LOW confidence findings** — do not include them in the report. If you're not sure, it's not a finding.

### Team Mode Addition

When using `--team`, the lead agent MUST re-read every finding from sub-agents before synthesis. Sub-agents may have read stale working tree state modified by other agents. Any finding the lead cannot verify gets dropped.

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
| `useDelayedInvalidation` | data-layer SKILL.md | OK |
| `parseContractError` | error-handling SKILL.md | DRIFT: renamed |
| `Address` type | web3 SKILL.md, contracts SKILL.md | OK |

### Recommendations
- Update [skill]: `oldName` -> `newName`
```

---

## Part 7: Team Mode

When `--team` is passed, spawn a parallel agent team instead of running sequentially.

**Requires**: Agent Teams feature (see `agent-teams` skill). If unavailable, fall back to single-agent mode.

### Team Structure

```
Lead (Part 0 + Part 5 + Part 6 — tracking, synthesis, drift)
  chain-auditor      (contracts + indexer — Parts 1-4)
  middleware-auditor  (shared — Parts 1-4)
  app-auditor         (client + admin + agent — Parts 1-4)
```

### Lead Responsibilities

1. Run **Part 0** (Previous Findings Verification) before spawning teammates
2. Spawn 3 teammates with package-scoped instructions
3. Wait for all teammates to complete
4. **Synthesize** findings into single report (Part 5)
5. Run **Part 6** (Drift Detection) — cross-cutting, lead-only
6. Write final report to `.plans/audits/[date]-audit.md`

### Spawn Prompts

**chain-auditor:**
```
Audit packages/contracts and packages/indexer. Run Parts 1-4 of the audit skill
scoped to these packages. Use `bunx knip --workspace @green-goods/contracts`
and `bunx knip --workspace @green-goods/indexer`. Report all findings with
severity (Critical/High/Medium/Low) and file:line references. Do NOT edit any files.
IMPORTANT: Only read files in packages/contracts and packages/indexer. Do NOT read
files in other packages — another agent handles those. Cross-package findings
(e.g., unused exports consumed by shared) should be noted as "needs cross-package
verification" rather than stated as confirmed.
```

**middleware-auditor:**
```
Audit packages/shared. Run Parts 1-4 of the audit skill scoped to shared.
Use `bunx knip --workspace @green-goods/shared`. Check for god objects (>500 lines),
`as any` assertions, and error handling patterns. Report all findings with
severity and file:line references. Do NOT edit any files.
IMPORTANT: Only read files in packages/shared. Do NOT read files in other packages —
another agent handles those. If a finding depends on how client/admin consumes a
shared export, note it as "needs cross-package verification" rather than confirmed.
```

**app-auditor:**
```
Audit packages/client, packages/admin, and packages/agent. Run Parts 1-4
scoped to these packages. Check for hooks outside shared, dead components,
unused dependencies. Use knip per workspace. Report all findings with
severity and file:line references. Do NOT edit any files.
IMPORTANT: Only read files in packages/client, packages/admin, and packages/agent.
Do NOT read files in packages/shared or packages/contracts — another agent handles
those. If a finding depends on shared internals, note it as "needs cross-package
verification" rather than confirmed.
```

### When to Use Team Mode

| Scenario | Mode |
|----------|------|
| Quick health check on one package | `/audit shared` (single agent) |
| Full codebase audit | `/audit --team` (parallel) |
| Pre-release audit | `/audit --team` (parallel, thorough) |
| Checking a specific concern | `/audit [package]` (single agent) |

---

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
