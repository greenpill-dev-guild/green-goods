---
name: audit
user-invocable: false
description: Internal repo-health lens for Green Goods — dead code detection, dependency health, invariant drift, and concrete broken or brittle spots. Prefer this after `/review` or `/status` reveals broader drift beyond a single change.
argument-hint: "[package-name] [--full] [--team]"
context: fork
effort: high
version: "2.1.1"
status: active
packages: ["all"]
dependencies: ["review", "contracts"]
last_updated: "2026-05-09"
last_verified: "2026-05-09"
---

# Audit Skill

Systematic repo-health analysis: dead code detection, dependency health, invariant drift, and concrete brittle spots.

Prefer `/review` or `/status` first. This skill is for broader repo-health drift, not for every change or every question.

**References**: See `AGENTS.md` for codebase patterns. Use `oracle` for deep investigation.

**Context mode**: `context: fork` -- read-only subagent. Never edit files during an audit. Report findings and let the user decide.

---

## Scope Lock

This skill is strictly read-only.

Audit/report work stays read-only by default. Do not create or mutate Linear records during
analysis. After the user approves specific findings for tracking, route accepted findings into
Linear Issues, not GitHub's issue tracker.

## What This Skill Owns

- dead code and unused export detection
- dependency health and outdated package surfacing
- concrete invariant drift against repo rules
- brittle runtime or maintenance hotspots with direct evidence

## What This Skill Does Not Own

- abstract architecture judgment (`architecture`)
- principles scoring or textbook design critique (`principles`)
- PR-scoped correctness review (`review`)
- implementation or refactor orchestration

## False-Positive Guardrails

These are mandatory:

- only report issues with concrete runtime, correctness, or clear maintenance cost
- do not recommend new abstractions, patterns, or layers from this skill
- do not treat file size alone as a finding
- if a structural concern is mostly about design judgment, route it to `architecture` or `principles` instead of reporting it here
- cap medium and low-severity findings to the highest-signal set a human can act on

---

## Activation

| Trigger | Action |
|---------|--------|
| `/audit` | Full codebase audit |
| `/audit [package]` | Targeted package audit |
| `/audit --full` | Skip scope detection, analyze all packages |
| `/audit --team` | Parallel agent team |
| `/audit --loop` | Audit -> fix -> re-audit loop until clean |

## Progress Tracking (REQUIRED)

Use **TodoWrite** when available, otherwise Markdown checklist. See `AGENTS.md` Session Continuity.

---

## Part 0: Previous Findings Verification

**REQUIRED before new analysis.** Check whether previous Critical/High findings are still open.

1. Find the most recent audit report: `ls -t .plans/audits/*-audit.md | head -1`
2. Extract all Critical and High findings with file:line references
3. Re-verify each finding against the current code. For UNCHANGED packages (per Part 0.5), carry forward with status `CARRY-FORWARD (unchanged)` and spot-check 1-2 representative findings
4. Count consecutive open cycles per finding
5. Cross-reference the Known Issues Registry (`.plans/audits/known-issues.md`) -- apply ACCEPTED/DEFERRED/MONITORED decisions from prior cycles
6. Apply escalation: findings open 3+ cycles get a severity bump (see Part 2 escalation)
7. Carry forward the Previous Findings Status table with updated statuses

**Finding statuses**: `STILL OPEN` | `FIXED` | `PARTIALLY FIXED` | `ACCEPTED` (stops escalation) | `DEFERRED` (stops escalation, include rationale) | `MONITORED` (resets staleness, re-verify each cycle) | `CARRY-FORWARD (unchanged)` | `Downgraded to [severity]`

---

## Part 0.5: Change Scope Detection

Gates the expensive Parts 1-4 to only run on packages that actually changed.

> **Override**: `/audit --full` skips scope detection.

1. Read the `Baseline` commit from the most recent audit report
2. Compute changed packages:
```bash
git diff --name-only <last-audit-commit>..HEAD | grep '^packages/' | cut -d/ -f2 | sort -u
```
3. Classify: **CHANGED** (source files modified: `.ts`, `.tsx`, `.sol`, `.graphql`) vs **UNCHANGED** (ignore lockfiles, config-only, formatting-only diffs)
4. Output a scope table:

| Package | Status | Changed Files | Action |
|---------|--------|---------------|--------|
| shared | CHANGED | 12 | Full analysis (Parts 1-4) |
| contracts | UNCHANGED | 0 | Carry-forward + spot-check |

5. CHANGED packages get full Parts 1-4. UNCHANGED packages: carry forward findings, spot-check 1-2 high-severity items, run `bunx knip --workspace <pkg>`.
6. First audit (no prior baseline): treat all packages as CHANGED.

---

## Part 1: Automated Analysis

Run checks on CHANGED packages and capture output for later parts.

### Build & Lint

```bash
bun run --filter '@green-goods/admin' build
bun run --filter '@green-goods/client' build
bun run --filter '@green-goods/agent' typecheck
bun lint
bash .claude/scripts/validate-hook-location.sh
node .claude/scripts/check-i18n-completeness.mjs
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" packages/
```

### Dependency Health

```bash
npm audit --omit=dev 2>/dev/null || echo "npm audit unavailable"
bun outdated 2>/dev/null || npx --yes npm-check-updates --format group
```

Report: HIGH/CRITICAL CVEs as findings, deps 2+ major behind as LOW, deprecated/EOL as MEDIUM.

### Test Coverage

```bash
bun run --filter '@green-goods/shared' test -- --coverage --reporter=json
bun run --filter '@green-goods/client' test -- --coverage --reporter=json
bun run --filter '@green-goods/admin' test -- --coverage --reporter=json
bun run --filter '@green-goods/agent' test -- --coverage --reporter=json
```

Extract per package: overall coverage %, files with 0% coverage, files below 50% branch coverage. Cross-reference zero-coverage files against god objects in Part 4 (low coverage + god object = higher risk).

For contracts: `forge coverage` if available, otherwise note "coverage not measured."

---

## Part 2: File-by-File Review

For each file in CHANGED packages, check:

1. **Deprecations** -- outdated patterns, old APIs
2. **Unfinished work** -- TODO comments with staleness
3. **Architectural violations** (per AGENTS.md): hooks in client/admin, package .env files, hardcoded addresses
4. **Type problems** -- `any`, `unknown`, type assertions
5. **Code smells** -- long functions, deep nesting
6. **Bare catch blocks** -- classify each:
   - **Intentional-with-fallback**: Has fallback/logging/user error handling. NOT a finding.
   - **Already-logged**: Calls `logger.warn/error`. LOW at most.
   - **Empty-swallow**: Empty `{}` or comment-only. MEDIUM (mutation path) or LOW (UI path).
   - Only report empty-swallow and unlogged-mutation-path catches.

### Severity Levels

- **CRITICAL**: Security issues, data loss risk
- **HIGH**: Bugs, broken functionality
- **MEDIUM**: Tech debt, maintainability
- **LOW**: Style, minor improvements

### Severity Escalation

Findings open 3+ cycles get a severity bump using **risk score = Impact x Likelihood x Staleness**.

| Factor | Values |
|--------|--------|
| Impact | 4=Critical, 3=High, 2=Medium, 1=Low |
| Likelihood | 3=Certain, 2=Likely, 1=Unlikely |
| Staleness | 1.0 (cycles 1-2), 1.5 (cycles 3-4), 2.0 (cycles 5+) |

Score < 4.0: report as-is. Score 4.0-8.0: escalate one level. Score > 8.0: flag in Executive Summary as chronic. Escalation does NOT apply to ACCEPTED, DEFERRED, or MONITORED findings.

### Security Skill Integration (contracts only)

When auditing `packages/contracts/`, invoke the security skill checklist from `.agents/skills/contracts/security.md`:
1. Part 2 (OWASP) against modified Solidity files
2. Part 3 (Access Control) against files with `onlyHatWearer`, `_authorizeUpgrade`, role-check modifiers
3. Part 4 (UUPS Upgrade Security) if proxy/upgradeable contracts modified
4. Prefix security findings with `SEC-`

---

## Part 3: Dead Code Detection

> **IMPORTANT**: Always use `knip` for dead code detection. Never rely on grep-based scanning for unused exports (~80% false-positive rate in this monorepo).

```bash
bunx knip                          # Full analysis
bunx knip --reporter compact       # Condensed output
bunx knip --include files          # Only unused files
bunx knip --include exports        # Only unused exports
bunx knip --include dependencies   # Only unused deps
```

The `knip.ts` config already excludes `packages/contracts/lib/`, `packages/indexer/generated/`, and build outputs.

**Manual fallback** (non-TS files, Solidity only): grep for exports, search for usage, categorize as Dead / Possibly Dead / Active.

---

## Part 4: Architectural Anti-Patterns

| Anti-Pattern | Detection |
|--------------|-----------|
| God Objects | Files > 500 lines, cross-ref with coverage data from Part 1 |
| Circular Deps | Import cycles |
| Layer Violations | Wrong import direction |

God objects: include coverage %. Zero-coverage god objects escalate one additional risk level.

### Green Goods Violations

```bash
grep -rn "^export.*use[A-Z]" packages/client packages/admin    # Hooks outside shared
find packages -name ".env*" -not -path "*/node_modules/*"       # Package .env files
grep -rn "0x[a-fA-F0-9]\{40\}" packages/ --include="*.ts" | grep -v __tests__  # Hardcoded addresses
```

Cap the anti-patterns table at **top 10 by risk score**. Track the rest in Known Issues Registry.

---

## Part 5: Self-Validation (REQUIRED before report)

Re-verify EVERY finding from Parts 1-4:

1. Re-read the flagged file at the cited line
2. Confirm code matches the finding description
3. Check 10 lines above/below for guards/comments that invalidate the finding
4. Assign confidence: HIGH / MEDIUM / LOW -- drop LOW confidence findings
5. Verify escalation was applied where required (score 4.0-8.0 bumped, score > 8.0 in summary)
6. Verify catch block classification (only dangerous catches reported)
7. Verify security integration for contracts (SEC-prefixed findings included)

In team mode, the lead re-reads every sub-agent finding before synthesis. Unverifiable findings get dropped.

---

## Part 6: Report Generation

Create at `.plans/audits/[date]-audit.md`:

```markdown
# Audit Report - [Date]

## Executive Summary
- **Packages analyzed**: [list] | **Mode**: Single-agent | Team | **Baseline**: [commit range]
- **Critical**: N | **High**: N | **Medium**: N | **Low**: N
- **Security (contracts)**: SEC-Critical: N | SEC-High: N | SEC-Medium: N
- **Dead code**: N unused files, N unused exports, N unused types, N unused deps
- **Tests**: [pass counts] | **Coverage**: shared N% / client N% / admin N%
- **Dependency health**: N vulnerabilities (H/C), N outdated (2+ major)

### Chronic findings (risk score > 8.0)
### Executive Delta (since last audit)
- Packages changed/unchanged, findings opened/closed/net, risk score trend, key changes

---

## Previous Findings Status
| ID | Finding | File | Status | Risk Score | Notes |

## Security Findings (contracts)
### SEC-H1. [Title]
- File, checklist, issue, recommendation

## High / Medium / Low Findings
### H1. [Title] ([STILL OPEN | NEW])
- **File** | **Risk score** | **Issue** | **Recommendation**

## Skill & Configuration Drift
| Reference | Location | Status |

## Architectural Anti-Patterns (top 10 by risk score)
| Anti-Pattern | Location | Lines | Coverage | Risk Score | Cycles Open | Severity |

## Dependency Health
| Category | Count | Details |

## Trend (last N audits)
| Metric | [prev dates] | [current] |

## Recommendations (Priority Order)
1. **[Action]** -- (Severity, finding ID, risk score)
```

---

## Part 7: Skill & Configuration Drift Detection

Run the consolidated drift check:
```bash
bash .claude/scripts/check-drift.sh
```

Checks: hook/utility/type references in skills vs actual shared exports, dev port assignments, core commands in package.json, `.env.schema` key variables.

**Manual check**: Provider order -- compare actual provider nesting in client/admin against documented order (MEDIUM if drifted).

---

## Part 8: Team Mode

When `--team` is passed, spawn parallel agents. Requires the Agent tool (fall back to single-agent if unavailable).

### Scope-Aware Spawning

Only spawn agents for CHANGED package groups. Lead handles carry-forward for UNCHANGED packages. `/audit --full --team` spawns all agents regardless.

### Team Structure

```
Lead (Parts 0, 0.5, 5-7, 9 -- scope, validation, report, drift, triage)
  [if contracts/indexer CHANGED]  chain-auditor      (Parts 1-4)
  [if shared CHANGED]             middleware-auditor  (Parts 1-4)
  [if client/admin/agent CHANGED] app-auditor         (Parts 1-4)
```

Each agent runs Parts 1-4 scoped to their packages using `bunx knip --workspace`. Agents must NOT read files outside their scope; cross-package findings are marked "needs cross-package verification." The lead validates all sub-agent findings before synthesis.

---

## Part 9: Triage & Routing

After the report, group findings by actionability:

| Category | Criteria | Output |
|----------|----------|--------|
| **Fix Now** | Critical/High, risk > 8.0 | Individual Linear issue per accepted finding |
| **Fix Soon** | Medium, risk 4.0-8.0 | Batch into 1 Linear issue per package when accepted |
| **Track** | Low or MONITORED | Update Known Issues Registry only |
| **Accept** | ACCEPTED/DEFERRED | No action |

Prompt user before creating any Linear issues: "Found N findings that are ready to track in
Linear. Create Product/Research issues for these accepted findings? [y/n]"

Update Known Issues Registry: add findings at 5+ cycles or MONITORED, update dates, move resolved to Resolved table.

### Linear Issue Routing

Use the Greenpill Linear template library structure:

- **Accepted Product Work**: implementation, QA, maintenance, product bug fixes, cleanup work
  with an accepted delivery outcome. Team: Product.
- **Accepted Research Task**: research questions, evidence gathering, recommendations, or
  decision support before product scope is accepted. Team: Research.

Issue bodies should include the relevant template sections: Outcome or Research question,
Protocol context, Scope boundary or Evidence to gather, Acceptance criteria or Expected output,
Validation or Routing recommendation, Privacy note when applicable, and Links.

Routing rules:

- `.plans` remains the execution truth. If an accepted audit finding is mirrored from
  `.plans/audits/`, include the `.plans` link and label `source:plans`.
- Do not route new work into completed/staging umbrella projects such as `Green Goods`, `Coop`,
  `Network Website`, or `Cookie Jar`.
- Attach to an active bounded project only when the scope clearly matches. Otherwise leave the
  issue unprojected and correctly labeled.
- Use only these label namespaces: `protocol:*`, `package:*`, `activity:*`, `task:*`,
  `funding:*`, `source:*`, `agent:*`.
- Keep private, security-sensitive, exploit-enabling, replay, session, wallet, email, or
  user-identifying details out of public Linear issue bodies. Store sensitive context only in the
  private audit notes or handoff the user explicitly approves.

---

## Part 10: Loop Mode

When `--loop` is passed: audit -> fix -> re-audit cycle.

1. Run full audit (Parts 0-9)
2. User decides per finding: Fix / Accept / Defer / Skip
3. Apply fixes (max 3 per iteration by risk score)
4. Re-validate: `bun format && bun lint`, `bun run test`, `bun build` on affected packages
5. Report delta (fixed, regressions, remaining)
6. Repeat until: no Critical/High remain, 3 iterations hit, or user stops

**Safety rules**: Always validate after fixes. Max 3 iterations. Show diffs before applying. Create checkpoint branch: `git switch -c audit/loop-$(date +%Y%m%d-%H%M%S)`. Update Known Issues Registry at end of loop, not during.

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Flag `packages/contracts/lib/` as dead code | Foundry git submodules -- excluded by `knip.ts` |
| Flag indexer handlers as unused | Envio runtime imports -- `knip.ts` entry points |
| Report god objects in multiple sections | Use Anti-Patterns table only; reference from findings |
| Count generated files in unused totals | Build artifacts, not source |
| Use grep to detect unused exports | ~80% false-positive rate |
| Use haiku-class models for audit | 95% false-positive rate -- use opus |
| Include LOW-confidence findings | Self-validation gate drops them |
| Edit files during an audit | Read-only mode |
| State cross-package findings as confirmed | Mark "needs cross-package verification" |
| Skip Previous Findings check | Trend tracking is the audit's most valuable long-term output |
| Report 24+ god object rows | Top 10 by risk score; rest in Known Issues Registry |
| Count intentional catch-with-fallback as bare catch | Classify per Part 2; only report dangerous ones |
| Skip security skill for contracts | Part 2 requires explicit security invocation |
| Create Linear issues without prompting | Part 9 requires user confirmation |
| Run full analysis on unchanged packages | Part 0.5 gates analysis to changed packages |
| Fix more than 3 findings per loop iteration | Prevents context exhaustion |
| Fix design-level problems via `/audit --loop` | Design fixes belong to `/principles fix` |

---

## Key Principles

- **Complete all files** within scope -- never skip
- **Scope-aware** -- diff detection limits analysis to changed packages
- **Read-only** -- don't edit during audit
- **Evidence-based** -- every finding needs file:line and risk score
- **Risk-weighted** -- escalation uses impact x likelihood x staleness
- **Prompt before issues** -- ask user before creating Linear issues
- **Registry-backed** -- chronic findings live in Known Issues Registry

## Audit vs Principles Boundary

| `/audit` owns | `/principles` owns |
|--------------|-------------------|
| Dead code, unused files/exports/deps | SRP (mixed concerns beyond LOC) |
| LOC / god-object thresholds | OCP, LSP, ISP, DIP |
| Type errors, lint, TODO markers | DRY (duplicated logic across packages) |
| Layer violations (hooks, imports) | KISS, YAGNI |
| Dependency health (CVEs, EOL) | SOC (concern leakage) |
| Security (contracts OWASP, AC, UUPS) | EDA, ADR, C4 |
| Test coverage gaps | ACID, BASE, CAP |
| Skill & configuration drift | |

If it's about *what's broken, dead, or drifted* -- audit. If it's about *whether the design is sound* -- principles.

## Related Skills

- `principles` -- Design-level analysis (SOLID, DRY, KISS, SOC). Audit finds what's broken; principles evaluates design soundness.
- `architecture` -- Clean Architecture patterns for structural review
- `react` (performance sub-file) -- Bundle analysis and optimization
- `contracts` (security sub-file) -- Security audit patterns, **explicitly invoked** during Part 2
- `testing` -- Coverage analysis and test gap identification
