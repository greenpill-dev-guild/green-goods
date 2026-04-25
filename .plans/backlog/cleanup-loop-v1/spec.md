# Cleanup Loop V1 Spec

## Summary

Cleanup Loop V1 is the first bounded autonomy hub for Green Goods. It exists to prove one
 honest keep / revert loop on a safe cleanup surface before the repo widens into bug triage,
 design verification, or task-agent trace capture. This hub remains in backlog until the shared
 tests + Storybook stream is complete.

## Users

- Primary: Afo, triggering a later Claude orchestration run by hand
- Secondary: Claude as orchestrator / QA and Codex CLI as the `state_api` implementation worker

## Functional Requirements

1. Create `.plans/backlog/cleanup-loop-v1/` as the canonical backlog hub for the first
   cleanup-first loop.
2. Keep the hub in `backlog` until the shared tests + Storybook hardening stream is no longer the
   active blocker.
3. Reuse the existing five plan-hub lanes; do not add new lane names or scheduler surfaces.
4. Define one loop family only:
   - `cleanup`
   - metric: bounded dead-surface count decreases while `node scripts/ci-local.js --quick` stays green
   - time budget: 30-45 minutes per run
   - outcomes: `keep`, `revert`, `bail`, `blocked`
   - run log: `scripts/log-automation-run.mjs`
5. Make `state_api` the implementation owner. `qa_pass_1` stays blocked until `state_api` passes.
   `qa_pass_2` stays blocked until `qa_pass_1` passes.
6. Scope v1 edits to safe cleanup surfaces only:
   - dead admin/shared/client barrels
   - deprecated shims and compatibility re-exports
   - unused helpers or exported types with no product behavior impact
   - small non-route, non-view surfaces with high-confidence reachability proof
7. Encode the identical keep / revert / bail / blocked contract in both the hub and the Claude
   orchestrator prompt.

## Non-Functional Constraints

- No product-facing API, schema, or runtime contract changes
- No new scheduler or recurring automation in v1; the prompt is human-triggered only
- No work on Storybook or shared/client/admin test-flow surfaces in this hub
- If a candidate requires parity review, behavioral comparison, or route judgment, the run must
  `bail`

## Lane Mapping

| Lane | Status | Purpose |
|---|---|---|
| `ui` | `n/a` | No UI implementation lane in v1 |
| `state_api` | `todo` | Owns the single declared cleanup surface per run |
| `contracts` | `n/a` | No contracts work in v1 |
| `qa_pass_1` | `blocked` | Claude verifies scope, run log, and keep / revert discipline after `state_api` passes |
| `qa_pass_2` | `blocked` | Codex final regression / handoff confirmation after `qa_pass_1` passes |

## Default Cleanup Candidate Ladder

The first live run should take the first still-valid candidate in this order. If a candidate is
already gone, no longer high-confidence, or would require parity judgment, skip it and record
`bail` or `blocked` rather than widening the scope.

| Order | Candidate | Editable Surface | Why it qualifies | Minimum validation |
|---|---|---|---|---|
| 1 | `admin-routes-shim` | `packages/shared/src/utils/admin-routes.ts` | Deprecated shim surface with current evidence of zero direct consumers | `cd packages/shared && bun run test`, then `node scripts/ci-local.js --quick` |
| 2 | `is-zero-address-alias` | `packages/shared/src/utils/blockchain/vaults.ts`, `packages/shared/src/utils/index.ts`, `packages/shared/src/index.ts` | Zero-consumer compatibility alias plus barrel cleanup | `cd packages/shared && bun run test`, then `node scripts/ci-local.js --quick` |
| 3 | `work-status-alias` | `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx`, `packages/shared/src/components/Cards/WorkCard/index.ts`, `packages/shared/src/components/Cards/index.ts`, `packages/shared/src/index.ts` | Internal alias cleanup after retyping one field, with no route or behavior surface | `cd packages/shared && bun run test`, then `node scripts/ci-local.js --quick` |

## Out-of-Scope Surfaces

- `packages/admin/src/views/**`
- route files and navigation structure
- `packages/shared/src/hooks/**`
- `packages/shared/src/providers/**`
- Storybook and shared/client/admin test-flow work
- `packages/agent/**`
- `packages/contracts/**`
- `packages/indexer/**`
- dependency churn unless directly required by the bounded cleanup surface

## Risks

- Risk: the cleanup run expands into refactor work instead of a single keep / revert loop
  - Mitigation: one declared surface per run, strict candidate ladder, explicit stop conditions
- Risk: the hub gets promoted before the shared tests / Storybook stream finishes
  - Mitigation: the prompt must refuse to start while the hub is still backlog or the stream is
    still the blocker
- Risk: operators treat v1 like a scheduled automation
  - Mitigation: both hub and prompt state that v1 is human-triggered only until the first
    successful `keep` run proves the contract
