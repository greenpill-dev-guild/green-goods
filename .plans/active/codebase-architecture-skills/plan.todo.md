# Codebase Architecture Skills and Seam Governance Plan

**Feature Slug**: `codebase-architecture-skills`
**Stage**: `active`
**Status**: `ACTIVE — five task observations recorded; Desktop hook observation and QA comparison pending`
**Created**: `2026-08-24`
**Last Updated**: `2026-10-25`
**Historical predecessor**: `module-seams-and-velocity`, closed `completed` on 2026-08-24 — see the [archive ledger](../../ARCHIVE.md); the hub itself lives only in Git history.
**Coordination boundary**: `../client-structure-and-agent-guides/` owns AGENTS/CLAUDE consolidation.

## Status reconciliation (2026-10-25)

PR [#1273](https://github.com/greenpill-dev-guild/green-goods/pull/1273) merged into `develop` as
`f912e3fac41b2d1c52c49bf04a0b01dd27f04b2b`. The five ordinary-task categories now have observations:
the existing documentation and bug-fix entries, recovered October 8 domain and UI evidence, and
the bounded join-request module extraction in merged PR #1289. These are observations with stated
limits, not five independent measurements of skill effectiveness. No product work was created.

PRD-835 remains In Progress for actual Claude Desktop Code hook-loading evidence and the
independent QA before/after comparison. The latter was retried on October 25 but the model service
was blocked by the network policy (`Method not allowed in limited mode`); credits could not be
assessed. The historical semantic-routing run still has no usable passing receipt. The September
coverage checkpoint remains closed. Detailed sources, corrections, and next actions are in the
[pilot reconciliation](handoffs/pilot-reconciliation.md).

## Status reconciliation (2026-10-06)

The coverage-ratchet checkpoint closed by decision D3 on September 28. PRD-835 remains In Progress for the separate workflow reliability follow-up. Codex hook loading and one ordinary bug-fix observation are recorded; Claude Desktop Code and four pilot categories remain pending. Historical QA passes certify their original scope, not the reopened follow-up.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Upgrade existing skills; add no new top-level architecture skill. | Avoid trigger and maintenance overlap. |
| 2 | Put shared concepts in one `.claude/context` reference. | Skills stay short and use progressive disclosure. |
| 3 | Track only certified critical seams and human-selected hotspots. | A whole-repo inventory would become stale noise. |
| 4 | Keep Linear parent-only. | Candidate and lane detail belongs in `.plans`. |
| 5 | Extend the existing direct-seam checker. | One enforcement path is easier to understand and maintain. |
| 6 | Eliminate the existing baseline rather than date-shifting debt. | Unexplained exceptions weaken the direct-proof contract. |
| 7 | Use content fingerprints, not HEAD SHAs, for registry freshness. | Evidence can be authored before the final commit and remains reproducible. |
| 8 | Keep coverage scheduled/manual and separate from direct proof. | Fast loops and architecture certification answer different questions. |
| 9 | Apply Matt Pocock's concepts, not his output mechanics. | Green Goods retains its own workflow, safety, and tracking contracts. |
| 10 | Keep the hub active through the 2026-09-22 coverage checkpoint. | A future ratchet is tracked, not silently marked complete. |
| 11 | Close the 2026-09-22 two-point ratchet without raising any global floor (Afo, 2026-09-28, D3 in `test-budget-and-ci-speed`). | The eleven measured critical-path floors replace it; global floors and parity arrays stay unchanged. |

## Requirements Coverage

| Requirement | Lane | Step | Status |
|---|---|---|---|
| Successor Plan Hub and parent-only tracking | `state_api` | 1 | complete |
| Canonical architecture model | `state_api` | 2 | complete |
| Existing skill responsibility updates | `state_api` | 3 | complete |
| Registry, export resolution, proof, and fingerprints | `state_api` | 4 | complete |
| Zero direct-test baseline | `state_api` | 5 | complete |
| Evidence-review selector and behavior/trigger fixtures | `state_api` | 6 | complete |
| Builder documentation alignment | `state_api` | 7 | complete |
| Ship, push, and exact-SHA coverage evidence | `qa_pass_1` | 8 | complete |
| Independent seam/readiness review | `qa_pass_2` | 9 | complete |
| Two-point coverage ratchet review | `state_api` | 10 | closed 2026-09-28 by decision 11 (no raise) |

## Implementation Steps

1. [x] Complete this hub, create its parent-only Linear mirror, and close PRD-831 with archive and
   successor links.
2. [x] Add the canonical architecture context and the candidate-card/design-it-twice contract.
3. [x] Update `plan`, `review`, `audit`, and `module-seams-review`; leave `clean` unchanged.
4. [x] Add the bounded registry and extend direct-seam enforcement with real export resolution,
   registry validation, direct-proof checks, and deterministic fingerprints.
5. [x] Resolve all 13 baseline rows; correct real tests or narrow invalid subject inference with proof.
6. [x] Add evidence-safe validation routing plus deterministic and semantic skill-routing scenarios.
7. [x] Align architecture, Vitest, and agentic-evaluation builder docs.
8. [x] Run scoped checks and the exact-path Ship Gate, commit directly on `develop`, refresh and safely
   push, dispatch coverage for the integration SHA, and record the receipt.
9. [x] Run a fresh read-only module-seams/readiness review over the committed range and close findings.
10. [x] Closed on 2026-09-28 by decision 11 instead of the scheduled two-point raise: the eleven
    measured critical-path floors replace the ratchet, and global floors and parity arrays stay
    unchanged ([test-budget hub](../test-budget-and-ci-speed/plan.todo.md), D3).

## Deferred Candidate Cards

### Agent HandlerServices

- Friction: runtime orchestration and handler dependencies remain grouped behind a broad service bag.
- Current interface: Agent handler services object.
- Deletion test: callers still need transport/client knowledge to use it safely.
- Dependency category: in-process plus owned remote adapters.
- Status: `DEFERRED`; no interface design or registry entry is authorized.

### Telegram adapter separation

- Friction: Telegram transport behavior is not isolated from handler policy.
- Current interface: handler-level Telegram dependencies.
- Deletion test: transport replacement would affect policy callers.
- Dependency category: owned remote port/adapter.
- Status: `DEFERRED`; no interface design or registry entry is authorized.

### Blockchain-client injection

- Friction: blockchain client construction remains coupled to Agent runtime behavior.
- Current interface: runtime client access through existing services.
- Deletion test: direct consumers retain client construction knowledge.
- Dependency category: owned remote port/adapter.
- Status: `DEFERRED`; no interface design or registry entry is authorized.

## TDD / Proof Order

- RED: new checker and selector fixtures demonstrate missing export resolution, stale fingerprints,
  self-mocking, missing proof, and absent evidence-review checks.
- GREEN: registry/checker, selector, and skill-behavior suites pass without broadening package tests.
- Documentation and Plan Hub text are `not_applicable` for TDD and use link/Plan Hub validation.
- UI and contracts lanes are `n/a`; no runtime UI or Solidity behavior changes.

## Validation

- [x] `bun run check:skill-behavior`
- [x] `bun run test:review-guardrails`
- [x] `node --test scripts/quality/check-direct-tested-seams.test.mjs scripts/quality/select-validation.test.mjs`
- [x] `bash scripts/quality/check-test-quality.sh`
- [x] `bun run check:guidance-links && bun run check:codex-guidance`
- [x] `node scripts/harness/plan-hub.mjs validate`
- [x] `bun run eval:skills` invoked once after descriptions stabilized; the host truncated the receipt,
  so deterministic routing fixtures remain the recorded proof and no semantic-pass claim is made.
- [x] Render and execute the exact-path Ship validation plan.
- [x] `bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build`
- [x] `bun run build:docs`
- [x] Manual coverage dispatch succeeded for `446c75c2d7b8b2b4f8c31605828c8578f150d7a7`:
  <https://github.com/greenpill-dev-guild/green-goods/actions/runs/32775723169>

## Current Certification

- Committed range reviewed: `0e6d133b9..446c75c2d`.
- Findings: zero unresolved Must-Fix and zero unresolved Should-Fix findings.
- Certified registry: four entries, all fresh; direct-test baseline: zero rows.
- Coverage, measured as statements / branches / functions / lines:
  - Shared: `62.76 / 54.01 / 61.29 / 64.29` against floors `61 / 52 / 59 / 62`.
  - Admin: `52.75 / 48.37 / 47.38 / 54.39` against floors `51 / 47 / 44 / 53`.
  - Client: `64.87 / 57.69 / 63.62 / 66.56` against floors `63 / 56 / 62 / 64`.
- The implementation is certified for its current scope. The `2026-09-22` coverage-ratchet checkpoint closed by D3 on September 28.
  The Plan Hub and PRD-835 now stay active for the agent workflow reliability follow-up.
## Agent workflow reliability follow-up — 2026-09-26

Authorized by the user's implementation request; original architecture decisions and certification
below remain historical. Execution and proof: [follow-up handoff](handoffs/agent-workflow-reliability.md).

- [x] Correct advisory completion and idle events, with negative fixtures.
- [x] Share command matching; retain the agreed per-harness enforcement behavior.
- [x] Reconcile audit guidance and add the short worktree isolation clarification.
- [x] Add warning-only personal skill availability to the existing doctor.
- [x] Wire focused regression selection, verify receipt freshness, and run required checks;
  the pre-existing Git-environment test failure is recorded in the handoff.
- [x] Observe Codex session-context and pre/post-edit hook loading in a normal Codex app session; see the October 4 observation in `eval.md` for the event boundary.
- [ ] Observe hook loading in a normal Claude Desktop Code session (pending).
- [x] Record all five ordinary-task scenarios: documentation, bug fix, domain change, UI correction, and bounded runtime refactor. Recovery sources and proof limits are in `eval.md` and the pilot reconciliation handoff.

## Skill workflow follow-up — 2026-10-24

- [x] Replace passing-suite severity downgrades with consumer/runtime proof.
- [x] Delegate cleanup validation to the canonical selector.
- [x] Replace auxiliary QA extraction worktrees with copied scratch inputs and focused failure proof.
- [x] Consolidate the four duplicate personal discovery entries locally, preserving backups and metadata.
- [x] Move QA call, intake, and filing branches behind conditional references.
- [x] Recover normally authorized domain and UI observations from Steward Access Requests and the bounded runtime-refactor observation from merged PR #1289; preserve the original receipts and limits.
- [ ] Complete the independent before/after QA proposal comparison when the model service is reachable. October 25 retry failed before a proposal with `Method not allowed in limited mode`; frozen inputs and scoring criteria are prepared.

Proof and publication state: [workflow handoff](handoffs/skill-workflow-simplification.md).
