---
name: agent-teams
description: Pair-lane agent teams with adversarial lead integration review for Green Goods.
version: "1.2"
last_updated: "2026-02-11"
last_verified: "2026-02-11"
status: established
packages: [shared, client, admin, contracts, indexer, agent]
dependencies: [review, cross-package-verify, architecture]
---

# Agent Teams Skill

Canonical model: package-aligned driver/observer pairs plus an adversarial lead reviewer.

**References**: `.claude/commands/teams.md`, `CLAUDE.md`, `.claude/hooks.json`.

---

## Activation

| Trigger | Action |
|---------|--------|
| `"/teams ship"` | Paired build/maintain flow |
| `"/teams review"` | Paired review-only flow |
| `"/teams entropy"` | Paired audit/entropy-reduction flow |
| `"agent team"` | Use lane model with adversarial lead |

Always start with:

```bash
bash .claude/scripts/check-agent-teams-readiness.sh
```

If preflight fails, fall back to subagents with the same lane ownership.

---

## Part 1: Green Goods Lane Topology

Default team layout:

```
Lead (adversarial final integrator)
├─ chain-driver         (contracts + indexer)
├─ chain-observer       (contracts + indexer review)
├─ middleware-driver    (shared package)
├─ middleware-observer  (shared package review)
├─ app-driver           (client/admin/agent when relevant)
└─ app-observer         (app review)
```

Lane order should follow dependency flow:
1. `contracts` + `indexer`
2. `shared` (middleware lane)
3. `client` + `admin` (+ `agent` when touched)

---

## Part 2: Driver/Observer Contract

For each lane:
1. Driver proposes implementation/findings.
2. Observer reviews in parallel and challenges assumptions.
3. Lane is incomplete until observer signs off or escalates blocker.
4. Lead arbitrates conflicts using architecture and risk standards.

**Plan approval for high-risk lanes:**
- When a task has `[gate:required]`, spawn the `chain-driver` with `plan_mode_required`.
- The chain-driver works in read-only plan mode until the lead approves the approach.
- After approval the driver exits plan mode and implements normally.
- This is mandatory for the chain lane (contracts are expensive to fix) and optional for other lanes.

---

## Part 3: Adversarial Lead Contract

Lead behavior is intentionally strict:
- challenge claims and request evidence
- reject non-compliant outputs
- require integration-level validation before final approval
- issue explicit PASS/FAIL verdict with reasons

Lead should not implement directly while teammates are active.

---

## Part 4: Required Task Token Contract

All tasks must include:

```text
[scope:<middleware|shared|client|admin|contracts|indexer|integration|docs>] [gate:<required|advisory>] [check:<quick|full>]
```

Scope notes:
- `middleware` is preferred for the shared lane.
- `shared` remains supported for compatibility.

Defaults when omitted:
- `gate=advisory`
- `check=quick`
- no scope => no blocking checks

Recommended defaults:
- use `[gate:required] [check:full]` for release-blocking work
- use advisory/quick for exploration

---

## Part 5: Shortcut Semantics

- `/teams ship`: full paired execution with strict integration gate.
- `/teams review`: findings only, no implementation.
- `/teams entropy`: architecture audit and simplification plan with prioritized rollout.

---

## Part 6: Quality Gates

Hook-backed enforcement:
- `TaskCompleted` -> `.claude/scripts/task-completion-gate.sh`
  - scope-mapped checks
  - blocks only when `gate=required`
- `TeammateIdle` -> `.claude/scripts/teammate-idle-gate.sh`
  - blocks idle completion on error-like reasons

---

## Part 7: Cleanup and Fallback

Cleanup:
1. Shut down teammates.
2. Confirm no active teammates.
3. Lead runs cleanup.

Fallback:
- If teams unavailable, run subagents with the same lanes and strict lead review.

---

## Anti-Patterns

- Using generic teams without lane ownership.
- Marking a lane complete without observer sign-off.
- Letting lead implement while lanes are active.
- Treating all tasks as required/full.
- Skipping final adversarial verdict.

## Related Skills

- `review` — severity and synthesis discipline
- `cross-package-verify` — package validation commands
- `architecture` — boundary and entropy standards
