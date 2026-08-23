# Module Seams and Velocity Evaluation Plan

## Release Gates

1. Correctness: every lane proves its declared behavior boundary directly and preserves named
   runtime, error, offline, export, and deployment contracts.
2. Structure: new and modified source files meet the 350/500-line limits; frozen ceilings never
   grow and are lowered when the owning file shrinks.
3. Regression safety: the repository selector, lane proof, conditional gates, Ship Gate, review,
   and CI Gate are green at the tested commit.
4. Evidence quality: terminal claims include RED/GREEN or mutant proof and a complete Validation
   Receipt from a clean committed path set.
5. Human judgment: Claude reviews every Codex pull request and Afo approves every critical-surface
   merge.

## Acceptance Checks

| ID | Boundary | Check | Evidence |
|---|---|---|---|
| AC-0 | Plan start | Hub validation, Plan Hub fixtures, and parent-only Linear manifest | command output and recorded parent ID |
| AC-W0 | Harness | Scoped selector, compatible toolchain, pre-push guards, stable load tests, nightly coverage, Turbo cache, zero receipt waivers | Wave 0 receipt and scorecard snapshot |
| AC-W1 | Mutations and controllers | Job Queue construction, sender laws, work commands, direct controller suites, no named legacy mocks | lane receipts and Wave 1 health snapshot |
| AC-W2 | Composition | Pooling subpath used, root barrel lower, `CommunityTab.tsx` gone, Hasura planner owns decisions | lane receipts and Wave 2 health snapshot |
| AC-W3 | Shared inventory | Every closed shared row regraded A-/A with declared seam and direct proof | Module Health row evidence |
| AC-W4 | Client/admin inventory | Every closed client/admin row regraded A-/A; visible changes have authenticated Brave proof | Module Health row and browser evidence |
| AC-W5 | Indexer inventory | Indexer rows regraded A-/A and ABI/event/config/schema changes select mined-log integration | indexer receipts and selector proof |
| AC-W6 | Test architecture | DOM-free tests use Node projects, admin import share below 40%, and direct-test guard blocks new mock-only subjects | parity, timing, and fixture evidence |
| AC-EXIT | Program | Health inventory complete except named deferrals and Velocity targets met | fresh final snapshots and receipts |

## Per-Lane Evidence Contract

- Render the repository plan before implementation and before handoff.
- Record each check's risk, expected signal, freshness rule, and stopping condition from selector
  output; stop dependent work on the first deterministic failure.
- Preserve the named RED failure on the parent commit, or demonstrate the named one-line mutant for
  test-only lanes.
- Run focused tests and coverage for the touched seam, then source-structure and selector-mandated
  consumers.
- Use the full Ship Gate only at the pull-request boundary, with Storybook, design, dead-code,
  validation-system, indexer, or contract gates added when their surfaces move.
- For visible UI, attach authenticated Brave rendered proof. If Brave cannot be controlled, record
  browser QA as blocked.
- Do not reuse a passing receipt after its code, dependencies, configuration, validation entrypoint,
  policy, toolchain, environment, or validated paths change.

## Wave Exit Checks

- Wave 0: one admin view selects no more than six owning/consumer probes; Quick Gate reports the
  expected Node, Bun, and Foundry toolchain; pre-push runs both new guards; five load-sensitive tests
  survive three full loaded runs; PR jobs run plain tests; nightly coverage exists; Turbo cache
  mtimes move; zero receipt waivers remain.
- Wave 1: both pooling controllers and work simulation/passkey seams leave the under-5% inventory;
  `createJobQueue` is exported and wiring-tested; work submit meets 95/90 coverage; legacy passkey
  and client whole-barrel mocks are absent.
- Wave 2: the declared pooling subpath is consumed, the root barrel ceiling is lower,
  `CommunityWorkspaceContent` is directly covered, and the Hasura shell applies only pure plans.
- Waves 3 to 5: every closed ledger row is A-/A with direct evidence, named legacy mocks are gone,
  and indexer mined-log compatibility is selected automatically.
- Wave 6: shared/admin/client DOM-free tests run under Node; import share and suite/CI timing targets
  are met; static red runs fall to 10% or lower.

## Deferred Exit Rows

- Card Endow activation remains staged until explicitly scheduled.
- Contract changes that require redeployment remain outside this program.
- Agent `HandlerServices`, Telegram adapter separation, and blockchain-client injection remain
  backlog work.
