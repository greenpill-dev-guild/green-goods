---
name: principles
description: Software engineering principles audit — SOLID, DRY, KISS, YAGNI, SOC, EDA, ADR, C4, ACID, BASE, CAP. Use when the user wants to check adherence to industry best practices or says 'principles audit'.
argument-hint: "[package-name | --team]"
context: fork
version: "1.1.0"
status: active
packages: ["all"]
dependencies: ["audit", "architecture"]
last_updated: "2026-04-02"
last_verified: "2026-04-02"
---

# Principles Audit Skill

Systematic audit of codebase adherence to established software engineering principles.

**References**: See `CLAUDE.md` for codebase patterns. See `/audit` for dead code and dependency health.

**Context mode**: `context: fork` — runs in an isolated subagent. Read-only snapshot; never edit files during audit. Report findings and let the user decide when to act.

---

## Scope Lock (ENFORCED)

**Audits are strictly read-only.** Do NOT use Edit, Write, or any file-modifying tool. Do NOT let sub-agents edit files. Describe fixes in the report with file:line references. Implementation is gated behind explicit user approval.

---

## Activation

### Audit (read-only)

| Trigger | Action |
|---------|--------|
| `/principles` | Full codebase principles audit |
| `/principles [package]` | Targeted package audit |
| `/principles --team` | Parallel team audit (worktree-isolated agents) |
| `/principles solid` | SOLID-only audit |
| `/principles data` | ACID + BASE + CAP audit |
| `/principles arch` | EDA + ADR + C4 audit |

### Execute (after audit)

| Trigger | Action |
|---------|--------|
| `fix latest` | Load the most recent report, implement all findings by priority |
| `fix latest critical` | Implement CRITICAL findings only |
| `fix latest S1, EDA1` | Implement specific findings |
| `fix [date]` | Load report from a specific date |
| `fix critical` | Alias for `fix latest critical` |
| `fix all` | Alias for `fix latest` |
| `fix S1, EDA1` | Alias for `fix latest S1, EDA1` |

---

## Scope Confirmation (REQUIRED)

Before starting, echo scope to the user:

```
Principles audit scope: [package or "full codebase"]
Mode: [single-agent | team]
Principle groups: [all | subset if specified]
Previous audit: [date or "none found"]
Proceed? [y/n]
```

---

## Audit Packages (Priority Order)

1. `packages/shared/src/` — shared hooks and domain modules (highest surface area)
2. `packages/contracts/src/` — Solidity smart contracts
3. `packages/client/src/` — offline-first PWA
4. `packages/admin/src/` — admin dashboard
5. `packages/indexer/src/` — Envio blockchain indexer
6. `packages/agent/src/` — Telegram bot agent

---

## Part 0: Previous Findings Verification

Check `.plans/audits/*-principles.md` for prior reports. Re-verify all Critical and High findings. Escalation: 3+ cycles = escalate one level, 5+ = flag as chronic in Executive Summary.

---

## Green Goods Application Rules

You know what SOLID, DRY, KISS, YAGNI, SOC, EDA, ADR, C4, ACID, BASE, and CAP mean. Below is how each applies specifically to this codebase.

### SOLID

| Principle | Green Goods Focus |
|-----------|------------------|
| **SRP** | Flag files >300 LOC, functions >50 LOC. Shared modules must not mix domain logic with I/O. Client/admin components must not mix fetching + logic + presentation. Contracts must not mix access control + domain + storage. |
| **OCP** | Look for switch/if-else on type discriminators in garden/action/work handling. Flag enum dispatch requiring source modification for new cases. |
| **LSP** | Check mock vs. live behavioral parity. Verify chain-specific logic substitutability. Check UUPS upgrade storage layout compatibility. |
| **ISP** | Check `@green-goods/shared` barrel exports — do downstream packages import large surfaces for a few symbols? Flag fat type definitions. |
| **DIP** | Check if client/admin directly instantiate shared internals. Verify hooks depend on abstractions. Contract interactions must go through deployment artifacts, not hardcoded addresses. |

### Code Quality

| Principle | Green Goods Focus |
|-----------|------------------|
| **DRY** | Duplicated logic across shared <-> client, shared <-> admin. Check error handling, contract call construction, query key management, form validation. Cross-package duplication that avoids coupling = INFO, not violation. |
| **KISS** | Flag premature optimization (memoization without profiling), complex type gymnastics, cyclomatic complexity >10. |
| **YAGNI** | Exported symbols with zero consumers, feature flags never toggled, commented-out code, interfaces with exactly one non-test implementation. |
| **SOC** | **Vertical**: circular deps between shared modules? **Horizontal**: views containing business logic that belongs in shared? **Cross-cutting**: consistent logging/error/auth patterns? **Hook Boundary**: ALL hooks MUST live in `@green-goods/shared`. |

### Architecture

| Principle | Green Goods Focus |
|-----------|------------------|
| **EDA** | Map contracts -> indexer -> client/admin query flow. Check offline-first sync for race conditions. Verify indexer handlers are isolated and idempotent. Check for event handler leaks (addEventListener without cleanup). |
| **ADR** | Check for undocumented decisions: offline-first PWA, single-chain (VITE_CHAIN_ID), hook boundary rule, indexer boundary, deployment artifact pattern, single root .env, Garden/Action/Work domain model. |
| **C4** | L1: clear system boundary (blockchain, EAS, Hats, Hypercerts, Gardens V2)? L2: six packages well-defined? L3: components identifiable? L4: barrel exports enforced, no deep imports? |

### Data

| Principle | Green Goods Focus |
|-----------|------------------|
| **ACID** | IndexedDB writes wrapped in transactions? Contract multi-call atomic? Service worker vs main thread isolation? Crash recovery for persisted data? |
| **BASE** | Offline-first sync: stale data on reconnect? Optimistic updates with rollback? Code assuming strong consistency over eventual consistency? |
| **CAP** | Expected positions: IndexedDB = CP, Onchain = CP, Envio indexer = AP, SW cache = AP. Flag mismatches where code assumes wrong CAP property. |

---

## Self-Validation (REQUIRED before report)

Re-verify EVERY finding before generating the report:

1. **Re-read** the flagged file at the cited line number
2. **Confirm** code matches your description
3. **Check context** — 10 lines above/below for guards/comments that invalidate
4. **Assign confidence**: `HIGH` (verified) / `MEDIUM` (likely but unclear)
5. **Drop findings below HIGH confidence**

---

## Report Generation

Create at `.plans/audits/[date]-principles.md`:

1. **Executive Summary**: packages, mode, scorecard (all 15 principles — GREEN/YELLOW/RED with top issue and effort)
2. **Previous Findings Status**: tracked from prior audit, each with FIXED/STILL OPEN
3. **Findings by Principle**: grouped under SOLID, Code Quality, Architecture, Data. Each: ID, severity, file:line, issue, evidence, recommendation
4. **Priority Queue**: top 10 fixes ordered by severity x effort
5. **Trend**: principle scores across last N audits
6. **Next Steps**: `fix critical`, `fix all`, `fix S1, D3`

### Chat Output (REQUIRED)

After writing the report, output to chat:
- Full scorecard (all 15 principles, even GREEN)
- Every non-INFO finding: `[ID]. [Title] — [SEVERITY]`, principle, `file:line`, effort, 2-3 sentences, fix recommendation
- Positive findings (what the codebase does well)
- Action items (bundle overlapping fixes, ordered by impact)
- Fix commands: `fix critical` | `fix all` | `fix S1, EDA1`

---

## Team Mode

When `--team` is passed, spawn 4 parallel worktree-isolated read-only agents:

| Agent | Covers | Key checks |
|-------|--------|------------|
| **solid-auditor** | SOLID | SRP file/function size, OCP switch chains, LSP mock parity, ISP barrel exports, DIP concrete deps |
| **quality-auditor** | DRY/KISS/YAGNI/SOC | Cross-package duplication, dead code, over-engineering, hook boundary |
| **arch-auditor** | EDA/ADR/C4 | Data flow mapping, undocumented decisions, event handler leaks |
| **data-auditor** | ACID/BASE/CAP | IndexedDB transactions, sync consistency, CAP position mapping |

Lead handles Parts 0, self-validation, and report synthesis.

---

## Execute Findings

When user replies with `fix [IDs]`, `fix critical`, or `fix all`:

### Flow

1. **Load report**: Glob `.plans/audits/*-principles.md`, use newest (or specific date)
2. **Batch**: Max 3 per run (explicit ID lists exempt). Tell user how many remain.
3. **Plan**: Re-verify (skip if <24h old), list files, estimate blast radius, wait for approval
4. **Route**: Use agent routing table below
5. **Regression**: Scope check, build gate, `bun run test`, code review on diff, `/simplify`
6. **Update report**: Mark findings as FIXED with date

### Agent Routing

| Finding Type | Agent | Skills | Isolation |
|-------------|-------|--------|-----------|
| SRP/OCP/DRY extraction | `cracked-coder` | `architecture`, `testing` | `worktree` |
| SOC extraction | `cracked-coder` | `react`, `testing` | `worktree` |
| EDA/ACID/BASE/CAP fix | `cracked-coder` | `data-layer`, `testing` | `worktree` |
| ADR/C4 documentation | `oracle` | `architecture` | none |
| ISP refactor (exports) | `migration` | `architecture`, `testing` | `worktree` |

### Parallel Rules

- **Independent findings** (different files): parallel agents with `isolation: worktree`
- **Overlapping findings** (same files): bundle into single agent
- **Sequential dependencies**: run in order

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Flag all duplication as DRY violations | Cross-package duplication avoids coupling — classify as INFO |
| Report YAGNI on mock/test boundaries | These serve a real test purpose |
| Judge CAP without checking transport | Code may look CP but run over an AP channel |
| Include findings below HIGH confidence | Self-validation gate exists for a reason |
| Edit files during an audit | Read-only mode |
| Skip re-reading files before reporting | Stale reads = false findings |
| Execute fixes without user plan approval | Wait for explicit go-ahead |
| Fix >3 findings per run (unless user listed IDs) | Context exhaustion causes loops |
| Re-verify findings from a report <24h old | Already validated |
| Skip regression review after agents finish | CLAUDE.md mandates post-agent review |
| Let an agent touch files outside its scope | Explicit file allowlist per agent |
| Run overlapping findings as separate agents | Same file = merge conflicts |
| Skip `/simplify` on agent output | Agents over-engineer fixes |

---

## Key Principles

- **Complete all packages** — never skip
- **Read-only mode** — don't edit during audit
- **Evidence-based** — every finding needs file:line and code evidence
- **Contextual scoring** — GREEN/YELLOW/RED per principle, not just pass/fail
- **Actionable** — every finding has a concrete recommendation

## Related Skills

- `audit` — Dead code detection and dependency health
- `architecture` — Module boundary design and entropy reduction
- `review` — PR-scoped review for specific changes
- `contracts` — Solidity-specific security audit
