---
name: audit
description: Codebase Audit - dead code detection, unused exports, architectural anti-patterns, and dependency health. Use when the user asks for a codebase health check, wants to find dead code, or says 'audit the codebase'.
argument-hint: "[package-name]"
context: fork
version: "1.3.0"
status: active
packages: ["all"]
dependencies: ["review", "security"]
last_updated: "2026-03-10"
last_verified: "2026-03-10"
---

# Audit Skill

Systematic codebase analysis: quality audit, dead code detection, architectural review.

**References**: See `CLAUDE.md` for codebase patterns. Use `oracle` for deep investigation.

**Context mode**: `context: fork` means this skill runs in an isolated subagent context. The agent gets a read-only snapshot of the codebase — it should never edit files during an audit. If findings require fixes, report them in the output and let the user decide when to act.

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

## Part 0: Previous Findings Verification

**REQUIRED before any new analysis.** Check whether previously reported Critical and High issues are still open.

### Steps

1. **Find the most recent audit report**:
```bash
ls -t .plans/audits/*-audit.md | head -1
```

2. **Read** the report and extract all Critical and High findings with their file:line references.

3. **Re-verify** each finding — read the cited file and confirm whether the issue is still present, fixed, or changed.

4. **Count consecutive open cycles** for each finding. Track how many consecutive audits each finding has been STILL OPEN (check the Trend table and Previous Findings tables from prior reports).

5. **Apply escalation** per the Severity Escalation table below. This is NOT optional — if a finding has been open 3+ cycles and is not ACCEPTED/DEFERRED, it MUST be escalated. If open 5+ cycles, it MUST appear in the Executive Summary as chronic.

6. **Carry forward** the Previous Findings Status table with updated statuses: `STILL OPEN`, `FIXED`, `PARTIALLY FIXED`, `Downgraded to [severity]`, `ACCEPTED`, or `DEFERRED`.
   - `ACCEPTED`: User explicitly decided the finding is acceptable as-is (stops escalation)
   - `DEFERRED`: Fix requires major effort; user chose to defer (stops escalation, include rationale)

---

## Part 1: Automated Analysis

Run these checks and capture output for use in later parts:

```bash
# Type checking — run per package using available scripts
# client and admin include tsc --noEmit in their build scripts
# agent and ops have explicit typecheck scripts
bun run --filter '@green-goods/admin' build        # tsc --noEmit && vite build
bun run --filter '@green-goods/client' build       # tsc --noEmit && vite build
bun run --filter '@green-goods/agent' typecheck     # tsc --noEmit
bun run --filter '@green-goods/ops' typecheck       # tsc --noEmit
# shared has no build/typecheck — source files used directly
# contracts — Solidity, no tsc
# indexer — Envio codegen, no tsc

# Linting
bun lint

# Hook location validation
bash .claude/scripts/validate-hook-location.sh

# i18n completeness
node .claude/scripts/check-i18n-completeness.mjs

# TODO/FIXME markers
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" packages/
```

A passing check means zero output or exit code 0. Flag any failures as findings in Part 2.

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

### Severity Escalation (REQUIRED)

Findings that remain open across multiple audit cycles auto-escalate:

| Consecutive Audits Open | Action |
|--------------------------|--------|
| 1-2 | Report at assigned severity |
| 3+ | **Escalate one level** (LOW→MEDIUM, MEDIUM→HIGH). Note `(escalated from X, open N cycles)` |
| 5+ | **Flag in Executive Summary** as chronic. Recommend dedicated refactoring task or acceptance decision |

Escalation does NOT apply to:
- Findings explicitly **accepted** by the user (mark as `ACCEPTED` in Previous Findings Status)
- Structural findings where the fix requires a major refactoring effort (mark as `DEFERRED` with rationale)
- Findings that are blocked by an upstream dependency or third-party limitation

To stop escalation, the user must explicitly mark a finding as `ACCEPTED` or `DEFERRED` in the Previous Findings table. Absent that, escalation applies automatically.

---

## Part 3: Dead Code Detection

### Automated Tooling (REQUIRED — always run before manual review)

> **IMPORTANT**: Always use `knip` for dead code detection.
> It understands TypeScript's module resolution and monorepo workspace relationships.
> **NEVER rely on grep-based scanning** for unused export detection — it has ~80% false-positive
> rate in this monorepo due to barrel exports, re-exports, and aliased imports.

```bash
# knip — monorepo-aware unused files, exports, deps, types
# Configured via knip.ts at repo root. Handles workspace entry points,
# Foundry lib exclusions, Envio handler entries, and build output ignores.
bunx knip                          # Full analysis (files, exports, deps, types)
bunx knip --reporter compact       # Condensed output
bunx knip --include files          # Only unused files
bunx knip --include exports        # Only unused exports
bunx knip --include dependencies   # Only unused deps
```

> **Note**: The `knip.ts` config at repo root already excludes `packages/contracts/lib/` (Foundry submodules),
> `packages/indexer/generated/` (Envio codegen), and build outputs. No manual `grep -v` filtering needed.

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

## Part 5: Self-Validation (REQUIRED before Part 6)

Before generating the final report, re-verify EVERY finding from Parts 1-4:

1. **Re-read** the flagged file at the cited line number
2. **Confirm** the code matches what you described in the finding
3. **Check context** — read 10 lines above/below for guards, comments, or patterns that invalidate the finding
4. **Assign confidence**: `HIGH` (verified in code) / `MEDIUM` (likely but context unclear) / `LOW` (might be false positive)
5. **Drop LOW confidence findings** — do not include them in the report. If you're not sure, it's not a finding.
6. **Verify escalation compliance** — for each STILL OPEN finding, count consecutive open cycles and confirm:
   - 3+ cycles → severity bumped one level (unless ACCEPTED/DEFERRED)
   - 5+ cycles → appears in Executive Summary as **chronic**
   - If escalation was NOT applied, fix it before generating the report

### Team Mode Addition

When using `--team`, the lead agent MUST re-read every finding from sub-agents before synthesis. Sub-agents may have read stale working tree state modified by other agents. Any finding the lead cannot verify gets dropped.

---

## Part 6: Report Generation

Create at `.plans/audits/[date]-audit.md`:

```markdown
# Audit Report - [Date]

## Executive Summary
- **Packages analyzed**: [list]
- **Critical**: N | **High**: N | **Medium**: N | **Low**: N
- **Dead code**: N unused files, N unused exports, N unused exported types, N unused deps
- **Lint warnings**: N (breakdown)
- **Architectural violations**: N hooks outside shared, N skill drift, N package .env files
- **Mode**: Single-agent | Team
- **Baseline**: [commit range or "no changes since vN"]

---

## Previous Findings Status

_Tracked from: [previous audit date]_

### Critical Findings
| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|

### High Findings
| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|

### Medium Findings resolved since last audit
| ID | Finding | Status | Notes |
|----|---------|--------|-------|

---

## High Findings

### H1. [Title] ([STILL OPEN | NEW])
- **File**: `package/path/to/file.ts:line`
- **Issue**: [Description]
- **Recommendation**: [Action]

---

## Medium Findings

### M1. [Title]
- **File**: `package/path/to/file.ts:line`
- **Issue**: [Description]

---

## Low Findings

### L1. [Title]
- [Brief description with file:line]

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `hookName` | skill SKILL.md | OK / DRIFT: [detail] |

---

## Architectural Anti-Patterns

Report god objects, layer violations, and structural issues here ONLY.
Do NOT duplicate god objects in the High/Medium findings sections — reference this table instead
(e.g., "See Architectural Anti-Patterns table for god object details").

| Anti-Pattern | Location | Lines | Cycles Open | Severity |
|--------------|----------|-------|-------------|----------|
| _Example: God object_ | `client/views/Home/WorkDashboard/index.tsx` | 861 | 5 | MEDIUM (escalated to HIGH at 3+) |

---

## Trend (last N audits)

| Metric | [date1] | [date2] | [current] |
|--------|---------|---------|-----------|
| Critical | N | N | **N** |
| High | N | N | **N** |
| Medium | N | N | **N** |
| Low | N | N | **N** |
| Unused files | N | N | **N** |
| Unused exports | N | N | **N** |
| Unused types | N | N | **N** |
| Unused deps | N | N | **N** |
| `as any` | N | N | **N** |
| Bare catch | N | N | **N** |
| Findings fixed | -- | N | **N** |
| Findings opened | -- | N | **N** |
| Resolution velocity | -- | N/N | **N/N** |

> **Resolution velocity** = findings fixed / findings opened in the period.
> Values >1.0 indicate debt is shrinking; <1.0 means debt is growing.

**Observations**: [Key trends, what improved, what regressed]

---

## Recommendations (Priority Order)

1. **[Action]** -- [context] (Severity, finding ID)
2. **[Action]** -- [context] (Severity, finding ID)
```

---

## Part 7: Skill & Configuration Drift Detection

Skills, hooks, and architectural rules reference specific hooks, utilities, types, and patterns. When the codebase evolves, these references can become stale. Include this check in every full audit.

### Automated Drift Checks

Run the consolidated drift check script which covers hooks, utilities, types,
ports, and core commands:

```bash
bash .claude/scripts/check-drift.sh
```

The script checks:
- Hook/utility/type references in skills against actual exports from shared
- Dev port assignments in `ecosystem.config.cjs` against vite configs
- Core commands (`bun dev`, `bun build`, `bun lint`, `bun run test`) exist in root `package.json`
- `.env.schema` contains key variables (`VITE_CHAIN_ID`, `VITE_STORACHA_KEY`)

### Manual Drift Checks (not yet automated)

| Check | How | Severity |
|-------|-----|----------|
| **Provider order changed** | Compare Rule #13 against actual provider nesting in client/admin | MEDIUM |

### Drift Report Section

Add to audit report under `## Skill & Configuration Drift`:

```markdown
| Reference | Location | Status |
|-----------|----------|--------|
| `useDelayedInvalidation` | data-layer SKILL.md | OK |
| `parseContractError` | error-handling SKILL.md | DRIFT: renamed to `decodeContractError` |
| `Address` type | web3 SKILL.md, contracts SKILL.md | OK |

### Recommendations
- Update [skill]: `oldName` -> `newName`
```

---

## Part 8: Team Mode

When `--team` is passed, spawn a parallel agent team instead of running sequentially.

**Requires**: The Agent tool must be available in the current session to spawn teammates.
If the Agent tool is unavailable (check tool list), fall back to single-agent mode and note
`Mode: Single-agent (Agent tool unavailable)` in the Executive Summary.

**Prerequisites checklist** (verify before spawning):
1. Agent tool is available (not deferred/missing)
2. Codebase is in a clean git state (no uncommitted changes that could cause stale reads)
3. No long-running build processes that could interfere with parallel file reads

### Team Structure

```
Lead (Part 0 + Parts 5-7 — validation, report, drift)
  chain-auditor      (contracts + indexer — Parts 1-4)
  middleware-auditor  (shared — Parts 1-4)
  app-auditor         (client + admin + agent — Parts 1-4)
```

### Lead Responsibilities

1. Run **Part 0** (Previous Findings Verification) before spawning teammates
2. Spawn 3 teammates with package-scoped instructions
3. Wait for all teammates to complete
4. Run **Part 5** (Self-Validation) on all teammate findings
5. **Synthesize** findings into single report (Part 6)
6. Run **Part 7** (Drift Detection) — cross-cutting, lead-only
7. Write final report to `.plans/audits/[date]-audit.md`

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

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Flag `packages/contracts/lib/` as dead code | Foundry git submodules — excluded by `knip.ts` config |
| Flag indexer handler files as unused | Envio runtime imports — `knip.ts` marks handlers as entry points |
| Report god objects in multiple report sections | Use Architectural Anti-Patterns table only; reference it from findings |
| Count generated files (ABIs, typechain) in unused totals | Build artifacts, not source code |
| Use grep to detect unused exports | ~80% false-positive rate due to barrel re-exports |
| Use haiku-class models for audit judgment | 95% false-positive rate on code review findings — use opus |
| Include LOW-confidence findings | Self-validation gate exists for a reason — drop them |
| Edit files during an audit | Read-only mode; report findings, let user decide on fixes |
| State cross-package findings as confirmed | If you can't see the consumer, mark "needs cross-package verification" |
| Skip the Previous Findings check | Trend tracking is the audit's most valuable output over time |

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
