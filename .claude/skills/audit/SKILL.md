---
name: audit
description: "Codebase Audit - quality analysis, dead code detection, issue tracking across runs. Use for health checks, anti-pattern detection, and progress tracking on known issues."
argument-hint: "[package-name] [--team]"
context: fork
---

# Audit Skill

Systematic codebase analysis: quality audit, dead code detection, architectural review, and issue tracking across runs.

**References**: See `CLAUDE.md` for codebase patterns. Use `oracle` for deep investigation.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/audit` | Full codebase audit (single agent) |
| `/audit [package]` | Targeted package audit (scoped checks) |
| `/audit --team` | Full audit with parallel agent team |
| `/audit [package] --team` | Package audit with team |
| Before refactoring | Identify tech debt |
| Periodic assessment | Codebase health check |

### Package Scoping

When a `[package]` argument is provided (e.g., `shared`, `client`, `admin`, `contracts`, `indexer`, `agent`), scope ALL checks to that package:

- **tsc**: `bun run --filter @green-goods/[package] tsc --noEmit`
- **knip**: `bunx knip --workspace @green-goods/[package]`
- **File review**: Only `packages/[package]/src/`
- **Anti-patterns**: Only violations in that package
- **Cross-cutting checks** (drift, hook boundary): Still run but filter results to package

When NO package is specified, run everything.

## Progress Tracking (REQUIRED)

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` → Session Continuity.

---

## Part 0: Previous Findings Verification

**REQUIRED before any new analysis.** Check whether previously reported Critical and High issues are still open.

### Steps

1. **Find the most recent audit report**:
```bash
ls -t .plans/audits/*-audit.md | head -1
```

2. **Extract Critical and High findings** — read the report sections for `## Critical Findings` and `## High Findings`. Collect each finding's:
   - ID (e.g., C1, H3)
   - Description
   - File path and line number(s)
   - Original recommendation

3. **Verify each finding** — read the referenced file:line and determine status:

| Status | Meaning | How to determine |
|--------|---------|-----------------|
| `FIXED` | Issue no longer exists | Code at file:line has changed and the problem pattern is gone |
| `STILL OPEN` | Issue persists unchanged | Same problematic code at same or nearby location |
| `CHANGED` | Code modified but issue may persist | File changed but the root problem pattern is still present |
| `MOVED` | Issue relocated | Original location clean, but pattern found elsewhere |
| `N/A` | File deleted or feature removed | File no longer exists |

4. **Include in report** as the first section after Executive Summary (see Part 5 template).

### Trend Data

If 2+ previous audit reports exist, include trend comparisons:
```bash
# Compare key metrics across last 3 reports
ls -t .plans/audits/*-audit.md | head -3
```

Track: total findings by severity, unused files count, unused exports count, unused dependencies count.

---

## Part 1: Automated Analysis

Run these checks, scoped to `[package]` if provided:

```bash
# Type checking (scoped or full)
bun run --filter @green-goods/[package] tsc --noEmit  # scoped
bun run tsc --noEmit                                   # full

# Linting
bun lint

# Hook location
bash .claude/scripts/validate-hook-location.sh

# i18n completeness
node .claude/scripts/check-i18n-completeness.js

# TODO/FIXME markers (scoped or full)
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" packages/[package]/  # scoped
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" packages/            # full
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
# Full analysis
bunx knip --reporter compact 2>&1 | grep -v 'packages/contracts/lib/'

# Package-scoped analysis
bunx knip --workspace @green-goods/[package] --reporter compact

# Specific categories
bunx knip --include files          # Only unused files
bunx knip --include exports        # Only unused exports
bunx knip --include dependencies   # Only unused deps

# madge — Detect circular dependencies
bunx madge --circular packages/[package]/src/index.ts
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

## Previous Findings Status
_Tracked from: [previous report date]_

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| C1 | WithdrawModal shares vs assets | admin/.../WithdrawModal.tsx | STILL OPEN / FIXED | [details] |
| H2 | Dead file WorkApprovalDrawer | client/.../WorkApprovalDrawer.tsx | FIXED | Removed in abc123 |

### Trend (last 3 audits)
| Metric | [date-3] | [date-2] | [date-1 (current)] |
|--------|----------|----------|---------------------|
| Critical | N | N | N |
| High | N | N | N |
| Unused files | N | N | N |
| Unused exports | N | N | N |

## Critical Findings
[List with file:line references]

## High Findings
[List with file:line references]

## Medium Findings
[Grouped by category]

## Low Findings
[Grouped by category]

## Dead Code
| File | Export | Recommendation |

## Anti-Patterns
| Issue | Location | Severity |

## Green Goods Violations
| Rule | Violation | Location |

## Skill & Configuration Drift
[See Part 6]

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
```

**middleware-auditor:**
```
Audit packages/shared. Run Parts 1-4 of the audit skill scoped to shared.
Use `bunx knip --workspace @green-goods/shared`. Check for god objects (>500 lines),
`as any` assertions, and error handling patterns. Report all findings with
severity and file:line references. Do NOT edit any files.
```

**app-auditor:**
```
Audit packages/client, packages/admin, and packages/agent. Run Parts 1-4
scoped to these packages. Check for hooks outside shared, dead components,
unused dependencies. Use knip per workspace. Report all findings with
severity and file:line references. Do NOT edit any files.
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
- **Track across runs** — always verify previous Critical/High findings before new analysis

## Related Skills

- `architecture` — Clean Architecture patterns for structural review
- `performance` — Bundle analysis and optimization findings
- `security` — Security-specific audit patterns for contracts
- `testing` — Coverage analysis and test gap identification
- `agent-teams` — Team coordination for parallel audits
