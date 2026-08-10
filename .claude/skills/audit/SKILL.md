---
name: audit
user-invocable: true
description: Repo-health audit and drift classifier for Green Goods — dead code, dependency health, invariant drift, stale guidance/plans/docs drift, and concrete broken or brittle spots. Use when the user asks for an audit, a drift check, "is the repo healthy", stale guidance, cleanup readiness, or whether to run clean. Read-only; routes accepted findings to a fix pass, /clean, or Linear.
argument-hint: "[package|drift] [--full] [--loop]"
context: fork
effort: high
---

# Audit Skill

Systematic repo-health analysis: dead code detection, dependency health, invariant drift, and concrete brittle spots.

Prefer `/review` first. This skill is for broader repo-health drift, not for every change or every question.

**References**: See `CLAUDE.md` for codebase patterns and `.claude/context/*.md` for per-package invariants.

**Context mode**: `context: fork` -- read-only subagent, report generation included. Never edit files during an audit; return findings in the response and let the user decide. Do not create or mutate Linear records during analysis — after the user approves specific findings for tracking, route them into Linear Issues, not GitHub's issue tracker.

## What This Skill Owns

- dead code and unused export detection
- dependency health and outdated package surfacing
- concrete invariant drift against repo rules
- brittle runtime or maintenance hotspots with direct evidence

## What This Skill Does Not Own

- abstract architecture or design-soundness judgment (`/review`'s boundary + coherence lenses)
- PR-scoped correctness review (`review`)
- implementation or refactor orchestration

## False-Positive Guardrails

These are mandatory:

- only report issues with concrete runtime, correctness, or clear maintenance cost
- do not recommend new abstractions, patterns, or layers from this skill
- do not treat file size alone as a finding
- if a structural concern is mostly about design judgment, route it to `/review` (boundary/coherence lenses) instead of reporting it here
- cap medium and low-severity findings to the highest-signal set a human can act on

---

## Activation

| Trigger | Action |
|---------|--------|
| `/audit` | Full codebase audit |
| `/audit [package]` | Targeted package audit |
| `/audit drift [scope]` | Quick drift classification only (see Drift Mode) |
| "repo drift", "stale guidance", "should we clean?" | Treat as `/audit drift` |
| `/audit --full` | Skip scope detection, analyze all packages |
| `/audit --loop` | Complete the read-only audit, then route approved findings through the scope-lock rhythm (see Part 9) |

## Drift Mode

`/audit drift [scope]` is the fast, read-only classifier (formerly the standalone `drift` skill). It does not run the numbered full-audit parts.

1. Run `bun run drift:check -- --scope <scope>` (scopes: `all`, `guidance`, `plans`, `design`, `docs`, `ontology`, `cleanup`, `quality`; add `--json` for machine output). The `ontology` scope reports a distinct infra-fault status when the checker itself cannot run — treat that as a tooling failure to fix, not ontology drift.
2. Report numbered findings with category, severity, evidence, and recommended route. Treat `WARN` output as a finding; include working-tree context if the checker reports a dirty tree.
3. Stop for human scope lock before fixing anything.

Routing: guidance/plans/docs drift → a scoped fix pass after the user approves findings by number (plan mode for anything large); design-system drift → `/review --scope design-system`; cleanup-shaped findings → recommend `clean --scope <scope> --dry-run` first, never full `/clean` without approval; anything that looks like a production bug, broken flow, or data/API/indexer failure → `debug`, not cleanup.

## Part 0: Previous Findings Verification

**REQUIRED before new analysis.** Check current accepted tracking before claiming a
finding is new or chronic.

1. If the user requests a follow-up or trend comparison, query current Linear issues in
   the approved scope. Otherwise record "no prior live comparison requested" and continue.
2. Re-verify relevant Critical/High tracked findings against current code.
3. For unchanged packages (per Part 0.5), carry forward only findings that still have a
   current Linear owner; spot-check 1-2 representative findings.
4. Use the Linear decision and issue age as context. Do not synthesize review cycles from
   deleted report files or revive resolved findings from Git history.
5. Include a Previous Findings Status table only when current tracked findings exist.

**Finding statuses**: `STILL OPEN` | `FIXED` | `PARTIALLY FIXED` |
`ACCEPTED` | `DEFERRED` | `MONITORED` | `CARRY-FORWARD (unchanged)` |
`Downgraded to [severity]`

---

## Part 0.5: Change Scope Detection

Gates the expensive Parts 1-4 to only run on packages that actually changed.

> **Override**: `/audit --full` skips scope detection.

1. Resolve a comparison base from the user's requested ref or the current PR base. If
   neither exists, treat all packages in scope as changed rather than inventing a baseline.
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
# i18n gate: 4-part locale coverage (parity, counts, source-usage, identical-string quality)
bun run --filter '@green-goods/shared' test src/__tests__/i18n/locale-coverage.test.ts
grep -rn "TODO\|FIXME\|HACK" --include="*.ts" packages/
```

### Dependency Health

```bash
bun audit --audit-level=high
bun outdated
```

Report: HIGH/CRITICAL CVEs as findings, deps 2+ major behind as LOW, deprecated/EOL as MEDIUM. If registry/network access is unavailable, record the dependency check as blocked; never install fallback tooling during an audit.

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
3. **Architectural violations** (per CLAUDE.md): hooks in client/admin, package .env files, hardcoded addresses, undeclared `shared/src/**` internal imports
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

### Prioritization

Rank findings by severity, weighed by how likely the failure actually is — a certain
Medium outranks a speculative High. Flag every Critical finding (and any High finding
with a certain trigger path) in the Executive Summary. Issue age from current Linear
tracking may be noted separately, but does not mechanically change severity. ACCEPTED,
DEFERRED, and MONITORED findings retain their current Linear decision unless the user
explicitly reopens it.

### Security Skill Integration (contracts only)

When auditing `packages/contracts/`, apply the contract-security guidance in `.claude/context/contracts.md` (its Upgrade Safety Checklist and Access Control sections):
1. Solidity security patterns against modified `.sol` files
2. Access control against files with `onlyHatWearer`, `_authorizeUpgrade`, role-check modifiers
3. UUPS upgrade safety (storage gaps, `_authorizeUpgrade`) if proxy/upgradeable contracts modified
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

God objects: include coverage %. Zero-coverage god objects report one severity higher.

### Green Goods Violations

```bash
grep -rn "^export.*use[A-Z]" packages/client packages/admin    # Hooks outside shared
find packages -name ".env*" -not -path "*/node_modules/*"       # Package .env files
grep -rn "0x[a-fA-F0-9]\{40\}" packages/ --include="*.ts" | grep -v __tests__  # Hardcoded addresses
grep -rn "@green-goods/shared/src" packages/client packages/admin packages/agent packages/indexer --include="*.ts*"  # Undeclared shared internals
```

Cap the anti-patterns table at **top 10 by severity**. Do not create a local
overflow registry; offer the remaining accepted findings for Linear tracking.

---

## Part 5: Self-Validation (REQUIRED before report)

Re-verify EVERY finding from Parts 1-4:

1. Re-read the flagged file at the cited line
2. Confirm code matches the finding description
3. Check 10 lines above/below for guards/comments that invalidate the finding
4. Assign confidence: HIGH / MEDIUM / LOW -- drop LOW confidence findings
5. Verify every Critical finding (and certain-path High) appears in the Executive Summary
6. Verify catch block classification (only dangerous catches reported)
7. Verify security integration for contracts (SEC-prefixed findings included)

Unverifiable findings get dropped.

---

## Part 6: Report Generation

Return the report in the response. If the user explicitly requests a durable artifact,
use an existing feature hub report when the audit is feature-specific; otherwise route
accepted work to Linear rather than creating a generic audit folder. Report shape:

```markdown
# Audit Report - [Date]

## Executive Summary        — packages/mode/baseline, counts by severity + SEC-*,
                              dead-code totals, tests/coverage, dependency health,
                              Critical findings, executive delta
                              (only when a live comparison was requested)
## Previous Findings Status — | ID | Finding | File | Status | Severity | Notes |
                              (only when current tracked findings exist)
## Security Findings        — SEC-prefixed, contracts only: file, checklist, issue,
                              recommendation
## High / Medium / Low      — per finding: **File** | **Issue** |
                              **Recommendation**, tagged [STILL OPEN | NEW]
## Skill & Config Drift     — | Reference | Location | Status |
## Anti-Patterns (top 10)   — | Anti-Pattern | Location | Lines | Coverage | Severity |
## Dependency Health        — | Category | Count | Details |
## Tracked-finding delta    — (only when current Linear history exists)
## Recommendations          — priority-ordered, each citing severity + finding ID
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

## Part 8: Triage & Routing

After the report, group findings by actionability:

| Category | Criteria | Output |
|----------|----------|--------|
| **Fix Now** | Critical/High | Individual Linear issue per accepted finding |
| **Fix Soon** | Medium | Batch into 1 Linear issue per package when accepted |
| **Track** | Low or MONITORED | Keep in response; offer Linear tracking after approval |
| **Accept** | ACCEPTED/DEFERRED | No action |

Prompt user before creating any Linear issues: "Found N findings that are ready to track in
Linear. Create Product/Research issues for these accepted findings? [y/n]"

Only after explicit approval should accepted findings be persisted to current Linear
issues. Do not create or update a parallel repository registry.

### Linear Issue Routing

Team routing (Product vs Research vs Customer Need), `.plans`/`source:plans` linkage, project
routing, label namespaces, prompt-before-create, and the privacy boundary follow the shared
core: [`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md).

Audit-specific deltas:

- Issue bodies include the relevant Greenpill template sections: Outcome or Research question,
  Protocol context, Scope boundary or Evidence to gather, Acceptance criteria or Expected output,
  Validation or Routing recommendation, Privacy note when applicable, and Links.
- Findings originate in the current audit response; accepted tracking lives in Linear.

---

## Part 9: Implementation Handoff

When `--loop` is requested, complete the read-only audit first and present numbered findings. Route the approved set through the scope-lock rhythm (numbered findings → explicit user lock → fix only locked items → re-validate per `.claude/context/validation-pipeline.md`). Do not apply fixes, create branches, write reports, or update registries from the audit phase itself. Fix at most 3 findings per approved iteration, highest severity first, on the current branch.

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Flag `packages/contracts/lib/` as dead code | Foundry git submodules -- excluded by `knip.ts` |
| Flag indexer handlers as unused | Envio runtime imports -- `knip.ts` entry points |
| Report god objects in multiple sections | Use Anti-Patterns table only; reference from findings |
| Count generated files in unused totals | Build artifacts, not source |
| Use grep to detect unused exports | High false-positive rate; use knip (Part 3) |
| Use haiku-class models for audit | 95% false-positive rate -- use opus |
| Skip current tracked-findings check when trend was requested | A stale local report is not a substitute for live tracking |
| Report 24+ god object rows | Keep the response to the top 10; offer accepted overflow findings for Linear |
| Count intentional catch-with-fallback as bare catch | Classify per Part 2; only report dangerous ones |
| Fix more than 3 findings per loop iteration | Prevents context exhaustion |
| Fix design-level problems via `/audit --loop` | Design judgment belongs in `/review`'s coherence lens |

---

## Boundary

If it's about *what's broken, dead, or drifted* — audit. If it's about *whether one change is sound* — `/review` (its coherence and boundary lenses replaced the retired `principles`/`architecture` skills).

## Related Skills

- `review` — diff-scoped correctness, coherence, and boundary judgment
- `clean` — broad cleanup after audit findings prove cleanup-shaped
- `debug` — when a finding is really a runtime/product failure
- `plan` — stale or inconsistent `.plans` truth
