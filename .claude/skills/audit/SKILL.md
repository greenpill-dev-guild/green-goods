---
name: audit
description: Codebase Audit - dead code detection, unused exports, architectural anti-patterns, dependency health, and security integration. Use when the user asks for a codebase health check, wants to find dead code, or says 'audit the codebase'.
argument-hint: "[package-name] [--full] [--team]"
context: fork
version: "2.0.0"
status: active
packages: ["all"]
dependencies: ["review", "contracts"]
last_updated: "2026-03-18"
last_verified: "2026-03-18"
---

# Audit Skill

Systematic codebase analysis: quality audit, dead code detection, architectural review, dependency health, and security integration.

**References**: See `CLAUDE.md` for codebase patterns. Use `oracle` for deep investigation.

**Context mode**: `context: fork` means this skill runs in an isolated subagent context. The agent gets a read-only snapshot of the codebase — it should never edit files during an audit. If findings require fixes, report them in the output and let the user decide when to act.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/audit` | Full codebase audit |
| `/audit [package]` | Targeted package audit |
| `/audit --full` | Full audit, skip scope detection (analyze all packages) |
| `/audit --team` | Full audit with parallel agent team |
| `/audit --loop` | Audit → validate → fix → re-audit loop until clean |
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

3. **Re-verify** each finding — read the cited file and confirm whether the issue is still present, fixed, or changed. For packages marked UNCHANGED by Part 0.5 scope detection, carry forward all previous findings at their existing severity with status `CARRY-FORWARD (unchanged)` and spot-check 1-2 representative findings per package.

4. **Count consecutive open cycles** for each finding. Track how many consecutive audits each finding has been STILL OPEN (check the Trend table and Previous Findings tables from prior reports).

5. **Cross-reference the Known Issues Registry** (`.plans/audits/known-issues.md`) for chronic items that have prior decisions recorded. Apply those decisions (ACCEPTED/DEFERRED/MONITORED) to the current cycle.

6. **Apply escalation** per the Risk-Weighted Escalation model in Part 2. This is NOT optional — compute risk scores for all open findings and escalate where thresholds are met.

7. **Carry forward** the Previous Findings Status table with updated statuses:
   - `STILL OPEN`: Issue confirmed present in code
   - `FIXED`: Issue resolved, verified by re-reading the file
   - `PARTIALLY FIXED`: Some aspects resolved, others remain
   - `Downgraded to [severity]`: Re-assessed at lower severity with justification
   - `ACCEPTED`: User explicitly decided the finding is acceptable as-is (stops escalation)
   - `DEFERRED`: Fix requires major effort; user chose to defer (stops escalation, include rationale)
   - `MONITORED`: Finding acknowledged, actively observed. Resets escalation staleness to 1.0. Requires re-verification each audit cycle — if conditions worsen, revert to STILL OPEN
   - `CARRY-FORWARD (unchanged)`: Package had no source changes; finding assumed still present

---

## Part 0.5: Change Scope Detection

When a previous audit commit is available, determine the change scope before running full analysis. This gates the expensive Parts 1-4 to only run on packages that actually changed.

> **Override**: `/audit --full` skips scope detection and runs full analysis on all packages regardless of diff.

### Steps

1. **Identify last audit commit**: Read the `Baseline` field from the most recent audit report.

2. **Compute changed files**:
```bash
git diff --name-only <last-audit-commit>..HEAD | grep '^packages/' | cut -d/ -f2 | sort -u
```

3. **Classify packages**:
   - **CHANGED**: At least one source file (`.ts`, `.tsx`, `.sol`, `.graphql`) modified in the package. Ignore lockfiles, config-only changes, and formatting-only diffs.
   - **UNCHANGED**: No source changes since last audit.

4. **Output a scope table** in the report:

| Package | Status | Changed Files | Action |
|---------|--------|---------------|--------|
| shared | CHANGED | 12 | Full analysis (Parts 1-4) |
| contracts | UNCHANGED | 0 | Carry-forward + spot-check |
| ... | ... | ... | ... |

5. **Apply scope to later parts**:
   - **CHANGED packages**: Full Parts 1-4 analysis
   - **UNCHANGED packages**: Carry forward all previous findings. Spot-check 1-2 high-severity items to confirm no regression. Run `bunx knip --workspace <pkg>` to verify dead code numbers haven't shifted.

6. **First audit after v2.0.0**: If no prior baseline commit exists, treat all packages as CHANGED.

---

## Part 1: Automated Analysis

Run these checks and capture output for use in later parts. Scope checks to CHANGED packages when Part 0.5 is active.

### Build & Lint

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

### Dependency Health Checks

```bash
# Security vulnerabilities
# bun has no native audit command — use npm audit against the lockfile
npm audit --omit=dev 2>/dev/null || echo "npm audit unavailable"

# Outdated dependencies (major versions behind)
bun outdated 2>/dev/null || npx --yes npm-check-updates --format group
```

Report:
- Any HIGH/CRITICAL vulnerability advisories as findings (severity matches advisory severity)
- Dependencies **2+ major versions behind** as LOW findings
- Dependencies with **known EOL/deprecation** as MEDIUM findings

### Test Coverage Analysis

Run coverage for CHANGED TS packages. Packages use `@vitest/coverage-v8`.

```bash
# Per-package coverage (JSON reporter for machine parsing)
bun run --filter '@green-goods/shared' test -- --coverage --reporter=json
bun run --filter '@green-goods/client' test -- --coverage --reporter=json
bun run --filter '@green-goods/admin' test -- --coverage --reporter=json
bun run --filter '@green-goods/agent' test -- --coverage --reporter=json
```

For each package, extract:
- **Overall line/branch/function coverage %**
- **Files with 0% coverage** (completely untested production code)
- **Files below 50% branch coverage** (weak test paths)

Cross-reference zero-coverage files against god objects in Part 4. A god object with low coverage is **higher risk** than one with strong test backing — factor this into anti-pattern severity.

For contracts: `forge coverage` output if available, or note "coverage not measured" (Solidity coverage tooling is optional).

---

## Part 2: File-by-File Review

For each file in CHANGED packages, check:

1. **Deprecations** — outdated patterns, old APIs
2. **Unfinished work** — TODO comments with staleness assessment
3. **Architectural violations** (see CLAUDE.md):
   - Hooks in client/admin (must be in shared)
   - Package-level .env files
   - Hardcoded contract addresses
4. **Type problems** — `any`, `unknown`, type assertions
5. **Code smells** — long functions, deep nesting
6. **Bare catch blocks** — classify each catch:
   - **Intentional-with-fallback**: Catch has fallback logic, logging, or user-facing error handling. **NOT a finding.**
   - **Already-logged**: Catch calls `logger.warn/error` or `console.error`. **LOW finding at most.**
   - **Empty-swallow**: Catch block is empty `{}` or only has a comment. Report as **MEDIUM** (mutation/network path) or **LOW** (UI/cosmetic path).
   - Only report **empty-swallow** and **unlogged-mutation-path** catches as findings. Do not inflate the bare catch count with intentional fallbacks.

### Severity Levels

- **CRITICAL**: Security issues, data loss risk
- **HIGH**: Bugs, broken functionality
- **MEDIUM**: Tech debt, maintainability
- **LOW**: Style, minor improvements

### Severity Escalation: Risk-Weighted Model (REQUIRED)

Findings that remain open are scored using **impact × likelihood × staleness**:

| Factor | Values |
|--------|--------|
| **Impact** | 4 = Critical, 3 = High, 2 = Medium, 1 = Low |
| **Likelihood** | 3 = Certain (always hit), 2 = Likely (common paths), 1 = Unlikely (edge case) |
| **Staleness** | 1.0 (cycles 1-2), 1.5 (cycles 3-4), 2.0 (cycles 5+) |

**Risk score** = Impact × Likelihood × Staleness

| Risk Score | Action |
|-----------|--------|
| < 4.0 | Report at assigned severity |
| 4.0 – 8.0 | **Escalate one level** (LOW→MEDIUM, MEDIUM→HIGH). Note `(escalated, risk=N.N, open N cycles)` |
| > 8.0 | **Flag in Executive Summary** as chronic. Recommend dedicated task or acceptance decision |

Escalation does NOT apply to findings marked:
- **ACCEPTED**: User explicitly decided the finding is acceptable (stops escalation permanently)
- **DEFERRED**: Fix requires major effort; user chose to defer (stops escalation, include rationale)
- **MONITORED**: Finding acknowledged, actively observed (resets staleness to 1.0, re-verify each cycle; if conditions worsen, revert to STILL OPEN and re-score)
- Findings blocked by upstream dependency or third-party limitation

> **MONITORED workflow**: When a finding is marked MONITORED, record the **conditions under which it would revert to STILL OPEN** (e.g., "revert if line count exceeds 1000" or "revert if Hypercerts redeploys"). Each audit cycle, check these conditions. If met, revert to STILL OPEN and apply the current staleness factor.

### Security Skill Integration (contracts package only)

When auditing `packages/contracts/`, explicitly invoke the security skill checklist:

1. Run **Part 2** of the security skill (OWASP Vulnerability Checklist) against all modified Solidity files
2. Run **Part 3** (Access Control Audit) against any file containing `onlyHatWearer`, `_authorizeUpgrade`, or role-check modifiers
3. Run **Part 4** (UUPS Upgrade Security) if any proxy or upgradeable contract was modified
4. Record security findings in the audit report using the security skill's severity classification, prefixed with `SEC-` (e.g., `SEC-H1`)

> Reference: `.claude/skills/contracts/security.md` Parts 2-4 for the full checklists.

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
| God Objects | Files > 500 lines, **cross-ref with coverage data from Part 1** |
| Circular Deps | Import cycles |
| Layer Violations | Wrong import direction |

### God Object Coverage Cross-Reference

When reporting god objects, include the file's test coverage % (from Part 1 coverage analysis):

- Format: `Lines: 861 | Coverage: 42% branch`
- **Zero-coverage god objects** are escalated one additional risk level
- A god object with >80% branch coverage is lower priority than one with <20%

### Green Goods Violations

```bash
# Hooks outside shared
grep -rn "^export.*use[A-Z]" packages/client packages/admin

# Package .env files
find packages -name ".env*" -not -path "*/node_modules/*"

# Hardcoded addresses (exclude tests)
grep -rn "0x[a-fA-F0-9]\{40\}" packages/ --include="*.ts" | grep -v __tests__
```

### Reporting Limit

Cap the Architectural Anti-Patterns table in the report (Part 6) at the **top 10 entries by risk score** (using the risk-weighted model from Part 2). Remaining entries reference the Known Issues Registry (`.plans/audits/known-issues.md`) for full chronic anti-pattern tracking.

> Rationale: Past audits had 24+ god object rows, overwhelming the report. The top 10 captures the most actionable items; chronic low-risk entries belong in the Known Issues Registry.

---

## Part 5: Self-Validation (REQUIRED before Part 6)

Before generating the final report, re-verify EVERY finding from Parts 1-4:

1. **Re-read** the flagged file at the cited line number
2. **Confirm** the code matches what you described in the finding
3. **Check context** — read 10 lines above/below for guards, comments, or patterns that invalidate the finding
4. **Assign confidence**: `HIGH` (verified in code) / `MEDIUM` (likely but context unclear) / `LOW` (might be false positive)
5. **Drop LOW confidence findings** — do not include them in the report. If you're not sure, it's not a finding.
6. **Verify escalation compliance** — for each STILL OPEN finding:
   - Compute risk score = Impact × Likelihood × Staleness
   - Confirm: score 4.0–8.0 → severity bumped one level (unless ACCEPTED/DEFERRED/MONITORED)
   - Confirm: score > 8.0 → appears in Executive Summary as chronic
   - For MONITORED findings: verify monitoring conditions, confirm whether to keep MONITORED or revert to STILL OPEN
   - If escalation was NOT applied where required, fix it before generating the report
7. **Verify catch block classification** — confirm bare catch findings only include empty-swallow and unlogged-mutation-path catches (not intentional-with-fallback)
8. **Verify security integration** — if contracts were in scope, confirm security skill checklist was executed and SEC-prefixed findings are included

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
- **Security findings** (contracts): SEC-Critical: N | SEC-High: N | SEC-Medium: N
- **Dead code**: N unused files, N unused exports, N unused exported types, N unused deps
- **Lint warnings**: N (breakdown)
- **Architectural violations**: N hooks outside shared, N skill drift, N package .env files
- **Dependency health**: N vulnerabilities (H/C), N outdated (2+ major behind)
- **Tests**: [pass counts per package] | **Coverage**: shared N% / client N% / admin N%
- **Mode**: Single-agent | Team
- **Baseline**: [commit range or "no changes since vN"]

### Chronic findings (risk score > 8.0)
- [List any chronic findings here]

### Executive Delta (since last audit)
- **Packages changed**: [list from Part 0.5 scope detection]
- **Packages unchanged** (carry-forward): [list]
- **Findings opened**: N | **Findings closed**: N | **Net**: +/-N
- **Risk score trend**: [previous total] → [current total] ([direction])
- **Key changes**: [1-3 bullet summary of what materially changed]
- **Known Issues Registry updates**: [N items added/updated/resolved]

---

## Previous Findings Status

_Tracked from: [previous audit date]_

### Critical Findings
| ID | Finding | File | Status | Risk Score | Notes |
|----|---------|------|--------|------------|-------|

### High Findings
| ID | Finding | File | Status | Cycles Open | Risk Score | Notes |
|----|---------|------|--------|-------------|------------|-------|

### Medium Findings resolved since last audit
| ID | Finding | Status | Notes |
|----|---------|--------|-------|

---

## Security Findings (contracts)

### SEC-H1. [Title]
- **File**: `contracts/path/to/file.sol:line`
- **Checklist**: [Which security skill check triggered this]
- **Issue**: [Description]
- **Recommendation**: [Action]

---

## High Findings

### H1. [Title] ([STILL OPEN | NEW])
- **File**: `package/path/to/file.ts:line`
- **Risk score**: N.N (impact=N × likelihood=N × staleness=N)
- **Issue**: [Description]
- **Recommendation**: [Action]

---

## Medium Findings

### M1. [Title]
- **File**: `package/path/to/file.ts:line`
- **Risk score**: N.N
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

## Architectural Anti-Patterns (top 10 by risk score)

| Anti-Pattern | Location | Lines | Coverage | Risk Score | Cycles Open | Severity |
|--------------|----------|-------|----------|------------|-------------|----------|
| _Example: God object_ | `client/views/Home/WorkDashboard/index.tsx` | 861 | 42% branch | 8.0 | 9 | HIGH (escalated) |

> Showing top 10 by risk score. Full chronic anti-pattern tracking: [Known Issues Registry](../known-issues.md).

---

## Dependency Health

| Category | Count | Details |
|----------|-------|---------|
| Critical/High CVEs | N | [list or "none"] |
| Outdated (2+ major) | N | [list or "none"] |
| Deprecated/EOL | N | [list or "none"] |

---

## Trend (last N audits)

| Metric | [date1] | [date2] | [current] |
|--------|---------|---------|-----------|
| Critical | N | N | **N** |
| High | N | N | **N** |
| Medium | N | N | **N** |
| Low | N | N | **N** |
| SEC findings | -- | -- | **N** |
| Unused files | N | N | **N** |
| Unused exports | N | N | **N** |
| Unused types | N | N | **N** |
| Unused deps | N | N | **N** |
| `as any` | N | N | **N** |
| Bare catch (dangerous) | N | N | **N** |
| Vulnerabilities (H/C) | -- | -- | **N** |
| Coverage % (shared) | --% | --% | **N%** |
| Coverage % (client) | --% | --% | **N%** |
| Coverage % (admin) | --% | --% | **N%** |
| Findings fixed | -- | N | **N** |
| Findings opened | -- | N | **N** |
| Resolution velocity | -- | N/N | **N/N** |
| Risk score (total) | -- | N.N | **N.N** |

> **Resolution velocity** = findings fixed / findings opened in the period.
> Values >1.0 indicate debt is shrinking; <1.0 means debt is growing.

**Observations**: [Key trends, what improved, what regressed]

---

## Recommendations (Priority Order)

1. **[Action]** -- [context] (Severity, finding ID, risk score)
2. **[Action]** -- [context] (Severity, finding ID, risk score)
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

### Scope-Aware Spawning

When Part 0.5 scope detection has classified packages:

1. **Only spawn agents for CHANGED package groups**. If a group has no changed packages, skip that agent entirely.
2. **Carry-forward handling**: The lead handles carry-forward for all UNCHANGED packages directly (no agent needed).
3. **Minimum**: Always spawn at least 1 agent if any package changed. If zero packages changed, skip team mode entirely and produce a carry-forward-only report.
4. **Full override**: `/audit --full --team` spawns all 3 agents regardless of scope.

### Team Structure (dynamic)

```
Lead (Part 0 + Part 0.5 + Parts 5-7 + Part 9 — scope, validation, report, drift, triage)
  [if contracts/indexer CHANGED]  chain-auditor      (contracts + indexer — Parts 1-4)
  [if shared CHANGED]             middleware-auditor  (shared — Parts 1-4)
  [if client/admin/agent CHANGED] app-auditor         (client + admin + agent — Parts 1-4)
```

### Lead Responsibilities

1. Run **Part 0** (Previous Findings Verification) before spawning teammates
2. Run **Part 0.5** (Change Scope Detection) to determine which agents to spawn
3. Spawn agents for CHANGED package groups only (see Spawn Prompts below)
4. Handle carry-forward for UNCHANGED packages directly
5. Wait for all teammates to complete
6. Run **Part 5** (Self-Validation) on all teammate findings
7. **Synthesize** findings into single report (Part 6)
8. Run **Part 7** (Drift Detection) — cross-cutting, lead-only
9. Run **Part 9** (Triage & Routing) — issue creation and registry updates
10. Write final report to `.plans/audits/[date]-audit.md`

### Spawn Prompts

**chain-auditor:**
```
Audit packages/contracts and packages/indexer. Run Parts 1-4 of the audit skill
scoped to these packages. Use `bunx knip --workspace @green-goods/contracts`
and `bunx knip --workspace @green-goods/indexer`. For contracts, run the Security
Skill Integration checklist (OWASP, Access Control, UUPS checks from
.claude/skills/contracts/security.md Parts 2-4). Prefix security findings with SEC-.
Include test coverage data where available (forge coverage for Solidity).
Report all findings with severity (Critical/High/Medium/Low), risk score
(impact × likelihood × staleness), and file:line references. Classify bare catch
blocks per the 3-tier system (intentional-with-fallback / already-logged /
empty-swallow) — only report dangerous ones. Do NOT edit any files.
IMPORTANT: Only read files in packages/contracts and packages/indexer. Do NOT read
files in other packages — another agent handles those. Cross-package findings
(e.g., unused exports consumed by shared) should be noted as "needs cross-package
verification" rather than stated as confirmed.
Only analyze files that changed since commit <last-audit-commit>. For unchanged
files in your scope, carry forward previous findings and spot-check 1-2.
```

**middleware-auditor:**
```
Audit packages/shared. Run Parts 1-4 of the audit skill scoped to shared.
Use `bunx knip --workspace @green-goods/shared`. Check for god objects (>500 lines)
and include their test coverage %. Classify `as any` assertions by necessity
(SDK type gap vs. fixable). Classify bare catch blocks per the 3-tier system
(intentional-with-fallback / already-logged / empty-swallow) — only report
dangerous ones. Report all findings with severity, risk score
(impact × likelihood × staleness), and file:line references. Do NOT edit any files.
IMPORTANT: Only read files in packages/shared. Do NOT read files in other packages —
another agent handles those. If a finding depends on how client/admin consumes a
shared export, note it as "needs cross-package verification" rather than confirmed.
Only analyze files that changed since commit <last-audit-commit>. For unchanged
files in your scope, carry forward previous findings and spot-check 1-2.
```

**app-auditor:**
```
Audit packages/client, packages/admin, and packages/agent. Run Parts 1-4
scoped to these packages. Check for hooks outside shared, dead components,
unused dependencies. Use knip per workspace. Include test coverage % for
god objects. Classify bare catch blocks per the 3-tier system
(intentional-with-fallback / already-logged / empty-swallow) — only report
dangerous ones. Report all findings with severity, risk score
(impact × likelihood × staleness), and file:line references. Do NOT edit any files.
IMPORTANT: Only read files in packages/client, packages/admin, and packages/agent.
Do NOT read files in packages/shared or packages/contracts — another agent handles
those. If a finding depends on shared internals, note it as "needs cross-package
verification" rather than confirmed.
Only analyze files that changed since commit <last-audit-commit>. For unchanged
files in your scope, carry forward previous findings and spot-check 1-2.
```

### When to Use Team Mode

| Scenario | Mode |
|----------|------|
| Quick health check on one package | `/audit shared` (single agent) |
| Full codebase audit | `/audit --team` (parallel) |
| Pre-release audit | `/audit --full --team` (parallel, all packages) |
| Checking a specific concern | `/audit [package]` (single agent) |
| No source changes since last audit | `/audit` (carry-forward-only, no agents) |

---

## Part 9: Triage & Routing

After generating the report, produce a triage summary and optionally create GitHub issues.

### Steps

1. **Group findings by actionability**:

| Category | Criteria | Output |
|----------|----------|--------|
| **Fix Now** | Critical or High, risk score > 8.0 | Individual GitHub issue per finding |
| **Fix Soon** | Medium with risk score 4.0–8.0, or escalated | Batch into 1 issue per package |
| **Track** | Low, or MONITORED | Update Known Issues Registry only |
| **Accept** | Previously ACCEPTED/DEFERRED | No action needed |

2. **For each "Fix Now" finding**, output a ready-to-paste issue block:

```markdown
### [Issue Title]

**Finding**: [ID] from audit [date]
**Severity**: [level] | **Risk Score**: [N.N]
**File**: `[path:line]`
**Cycles Open**: N

**Description**: [from report]

**Suggested Fix**: [from recommendation]

**Labels**: `audit`, `[severity]`, `[package-name]`
```

3. **For "Fix Soon" batches**, output one issue per package grouping related findings.

4. **Prompt the user**: "Found N issues to create (X fix-now, Y fix-soon). Create them? [y/n]"
   - Do NOT create GitHub issues automatically. Always prompt first.
   - If the user confirms, use `gh issue create` for each.

5. **Update Known Issues Registry** (`.plans/audits/known-issues.md`):
   - Add any new findings that reached 5+ cycles or were marked MONITORED
   - Update `Last verified` dates for existing entries
   - Move resolved findings to the Resolved table
   - Update risk scores based on current cycle's assessment

---

## Part 10: Loop Mode

When `--loop` is passed, the audit runs as a continuous improvement cycle: audit → validate → fix → re-audit.

### Loop Workflow

1. **Initial audit**: Run full audit (Parts 0-9) as normal
2. **Present findings**: Show the report with severity-grouped findings
3. **User decides**: For each finding category:
   - **Fix**: Apply the recommended fix
   - **Accept**: Mark as ACCEPTED in Known Issues Registry (stops escalation)
   - **Defer**: Mark as DEFERRED with rationale
   - **Skip**: Leave for next cycle
4. **Apply fixes**: For all "Fix" items, apply changes (exits read-only mode for this phase)
5. **Re-validate**: Run scoped re-audit on changed files only:
   - `bun format && bun lint` on changed files
   - `bun run test` for affected packages
   - `bun build` for affected packages
   - Re-check the specific findings that were fixed (confirm resolution)
   - Check for regressions (new findings introduced by fixes)
6. **Report delta**: Show what was fixed, what regressed, what remains
7. **Repeat**: If new findings or regressions exist, loop back to step 3
8. **Exit**: Loop ends when:
   - No Critical/High findings remain, OR
   - 3 iterations completed (safety limit), OR
   - User interrupts with "stop" or "done"

### Loop Mode Output

Each iteration produces a delta report:

```markdown
## Loop Iteration N

### Fixed This Iteration
- [Finding ID]: [description] — VERIFIED FIXED

### Regressions Introduced
- [New finding]: [description] — introduced by fix for [original finding]

### Remaining
- [Finding ID]: [status — still open / accepted / deferred]

### Validation
- `bun lint`: PASS/FAIL
- `bun run test`: PASS/FAIL (N tests)
- `bun build`: PASS/FAIL

### Next Action
[CONTINUE / DONE / USER_INPUT_NEEDED]
```

### Safety Rules for Loop Mode

- **Never fix without validation**: Every fix must be followed by lint + test + build
- **Never loop more than 3 times**: Prevents infinite fix-regress cycles
- **Always show diffs**: Before applying any fix, show the proposed change
- **Preserve git state**: Create a checkpoint branch before the first fix: `git switch -c audit/loop-$(date +%Y%m%d-%H%M%S)`
- **Known Issues Registry**: Update the registry at the end of each loop (not during)

### When to Use Loop Mode

| Scenario | Mode |
|----------|------|
| Quick health check | `/audit` (single pass, read-only) |
| Fix audit debt | `/audit --loop` (iterative fix cycle) |
| Pre-release cleanup | `/audit --full --loop` (all packages, iterative) |
| Team audit with fixes | `/audit --team --loop` (parallel audit, then iterative fixes) |

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
| Report 24+ rows of god objects | Use top-10-by-risk-score cap; track the rest in Known Issues Registry |
| Count intentional catch-with-fallback as bare catch | Classify catches per Part 2 item 6; only report dangerous ones |
| Skip security skill for contracts | Part 2 requires explicit security skill invocation for Solidity files |
| Create GitHub issues without prompting | Part 9 requires user confirmation before any `gh issue create` |
| Run full analysis on unchanged packages | Part 0.5 scope detection gates full analysis to changed packages only |

---

## Key Principles

- **Complete all files** — never skip (within scope)
- **Scope-aware** — diff detection limits full analysis to changed packages; unchanged get carry-forward
- **Read-only mode** — don't edit during audit
- **Evidence-based** — every finding needs file:line and a risk score
- **Risk-weighted** — escalation uses impact × likelihood × staleness, not just cycle count
- **Prompt before issues** — ask user before creating GitHub issues
- **Check for drift** — verify skill references match actual codebase
- **Registry-backed** — chronic findings live in Known Issues Registry, not repeated in every report

## Related Skills

- `architecture` — Clean Architecture patterns for structural review
- `react` (performance sub-file) — Bundle analysis and optimization findings
- `contracts` (security sub-file) — Security-specific audit patterns for contracts. **Explicitly invoked** during Part 2 for contracts package (see Security Skill Integration)
- `testing` — Coverage analysis and test gap identification
