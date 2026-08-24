# Codebase Architecture Skills and Seam Governance Plan

**Feature Slug**: `codebase-architecture-skills`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-08-24`
**Last Updated**: `2026-08-24`
**Historical predecessor**: [`../../archive/module-seams-and-velocity/`](../../archive/module-seams-and-velocity/)
**Coordination boundary**: `../client-structure-and-agent-guides/` owns AGENTS/CLAUDE consolidation.

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
| Ship, push, and exact-SHA coverage evidence | `qa_pass_1` | 8 | pending |
| Independent seam/readiness review | `qa_pass_2` | 9 | pending |
| Two-point coverage ratchet review | `state_api` | 10 | due 2026-09-22 |

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
8. [ ] Run scoped checks and the exact-path Ship Gate, commit directly on `develop`, refresh and safely
   push, dispatch coverage for the integration SHA, and record the receipt.
9. Run a fresh read-only module-seams/readiness review over the committed range and close findings.
10. On 2026-09-22, raise supported coverage floors by two points with matching parity updates; if
    evidence is insufficient, record the blocker and keep the hub active.

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
- [ ] Manual coverage dispatch succeeds for the pushed integration SHA
