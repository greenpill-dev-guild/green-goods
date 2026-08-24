# Module Seams and Velocity Evaluation Plan

## Release Gates

1. Correctness: every lane proves its declared behavior boundary directly and preserves named
   runtime, error, offline, export, and deployment contracts.
2. Structure: new and modified source files meet the 350/500-line limits; frozen ceilings never
   grow and are lowered when the owning file shrinks.
3. Regression safety: the repository selector, focused lane proof, conditional gates, and one Repo
   Quick Gate are green at each tested wave commit; the Ship Gate runs once at program exit.
4. Evidence quality: terminal claims include RED/GREEN or mutant proof and a complete Validation
   Receipt from a clean committed path set.
5. Human judgment: Afo has authorized critical Shared implementation on `develop`; only new product
   decisions, conflicting foreign changes, unclear destructive targets, or unresolvable blockers
   return to the user.

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

## Wave Evidence Contract

- Render the repository plan for each wave's actual changed paths before its boundary receipt.
- Record each check's risk, expected signal, freshness rule, and stopping condition from selector
  output; stop dependent work on the first deterministic failure.
- Preserve the named RED failure on the parent commit, or demonstrate the named one-line mutant for
  test-only lanes.
- Run focused tests and coverage for each touched seam, then source-structure and selector-mandated
  consumers. Record one consolidated receipt per wave.
- Use one Repo Quick Gate at each wave boundary. Use the full Ship Gate once at program exit, with
  Storybook, design, dead-code, validation-system, indexer, or contract gates added when their
  surfaces move.
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

## Resolved W0-H Receipt Debt Ledger

The active debt baseline was cleared on 2026-08-23 after each waived lane gained a complete,
clean-tree Validation Receipt. The original expiry was 2026-09-05 for every row; no deadline was
extended. All eight receipts validate implementation commit
`8fd3311980b28d71d48f72fe41c99d15276de912` at `2026-08-23T08:02:46Z`.

| Feature | Lane | Owner | Receipt | Result |
|---|---|---|---|---|
| Celo GardenAccount Safe Ownership | contracts | Codex | `handoffs/codex-contracts.md` | Relay unit, fuzz, and invariant proof passed 16/16; operator suites passed 31/31. |
| Commitment Pooling | contracts | Codex | `handoffs/codex-contracts.md` | Focused Solidity proof passed 192 tests; full package proof passed 2,050 Solidity tests and 289 script tests. |
| Commitment Pooling | state API | Codex | `handoffs/codex-state-api.md` | Seven focused suites passed 108 tests; Shared, Storybook, and Agent checks passed. |
| Validation System Optimization | UI | Codex | `handoffs/guidance.md` | All four guidance and browser-policy checks passed. |
| Validation System Optimization | state API | Codex | `handoffs/selector-local.md` | Selector and local-runner tests passed 78/78. |
| Validation System Optimization | contracts | Codex | `handoffs/ci-workflows.md` | CI Gate and workflow parity tests passed 40/40; the cited live Wave 0 workflows passed. |
| Validation System Optimization | QA pass 1 | Codex | `handoffs/qa-pass-1.md` | The integrated validation-system suite passed 130/130 with cited live CI proof. |
| Validation System Optimization | QA pass 2 | Codex | `handoffs/qa-pass-2.md` | Integrated validation passed 130/130 and focused CI/workflow proof passed 40/40. |

GitHub reports PRs #754 through #760 merged into `develop` at squash commit
`91e1ae904cc28af61cd0b203fce2f798fb31d4c8`. The Celo and Commitment Pooling handoffs retain their
exact commands and clean-path evidence. The W0-H handoff preserves the VSO closeout evidence after
the repository archive command compacts that completed hub.

## Wave 0 Snapshot — 2026-08-23

Wave 0 is complete for execution purposes. The two private Claude artifact URLs could not be opened
from this environment, so this repository snapshot is the durable source evidence; no claim is made
that those presentation artifacts were updated.

- Selector: a changed admin view selected three owning/consumer probes (`admin-test-typecheck`,
  `admin-test`, and `admin-build`), within the six-probe ceiling. The complete plan contains eight
  checks after adding hygiene, source-structure, design, and browser gates.
- Toolchain: `node scripts/dev/ci-local.js --quick --plan-json` returned `ready` with Node 22.22.1,
  Bun 1.3.14, and Foundry 1.7.1.
- Push guards: `.husky/pre-push` invokes both `check:source-structure` and
  `check:design-generated`.
- Load-sensitive tests: the W0-E receipt records 25/25 loaded focused runs and five green full admin
  backgrounds. It retains the accepted proof limit that no equivalent pre-change loaded RED was
  reproduced.
- Coverage: pull-request workflows run plain `bun run test`; `coverage-nightly.yml` owns
  `test:coverage`. Measured statement/branch/function/line coverage is Shared
  61.12/52.17/59.17/62.65, Client 63.36/56.92/62.29/64.95, and Admin
  51.54/47.07/44.87/53.24.
- Turbo: the W0-G1 receipt records an Agent cold pass of 270 tests followed by a full-cache warm
  pass in 146 ms. The successor W0-I regression now proves root test-runner helpers and Shared's
  Client/Admin source consumers participate in test-task hashes.
- Plan Hub: 46 feature hubs validate, 56/56 Plan Hub tests pass, receipt debt is zero, and
  Validation System Optimization is archived as completed.
- Integrated proof: the deterministic Sepolia root build passed. The full test run passed 2,050
  Solidity tests, the release gas boundary, and 278 contract script tests, but the dual-chain
  lifecycle suite is environment-blocked because this sandbox rejects its localhost Anvil
  connection with `EPERM`.
- Measurement host: Apple ARM64, 10 logical processors, 24 GiB memory. Load average at capture was
  6.32/21.19/32.33, so quiet-machine suite timing targets remain deliberately unclaimed.

## Wave 1 Snapshot — 2026-08-23

Wave 1 is complete at implementation SHA `a60e9eca357a83387053001827700aa6904774a7`.
The consolidated receipt is `handoffs/wave-1-receipt.md`.

- Module health: the Job Queue now has a constructable dependency boundary and tested default
  singleton; all three transaction senders share typed conformance laws; work submission,
  simulation, passkey submission, and executor orchestration have direct injectable seams; both
  pooling controllers have direct suites; Admin pooling views use typed controller fixtures.
- Direct coverage: the six-file Wave 1 run passed 105/105 at 99.16% statements, 96.17% branches,
  98.70% functions, and 99.40% lines. Pool Console retained 100% lines/functions; Hub Confirm, work
  submit, and passkey submission were fully line-covered; simulation reached 98.66% lines and
  96.05% branches.
- Regression evidence: Shared focused B2 passed 118/118; Client passed 93 files / 865 tests; Admin
  passed 94 files / 659 tests; Agent passed 25 files / 270 tests with one live test skipped. Shared
  source/test typechecks, Agent typecheck, source structure, design, vocabulary, and ontology passed.
- Exit invariants: `createJobQueue` is exported and wiring-tested; no
  `vi.mock(...passkey-submission)` remains; Hub authority-garden mutants fail; the six Admin pooling
  tests have no real `as never` cast or `Record<string, unknown>` controller bag.
- Boundary blocker: the Repo Quick Gate is `BLOCKED`, not passing, because nine unrelated Indexer
  metadata tests cannot bind `127.0.0.1` in this sandbox (`EPERM`) after 277 Indexer tests passed.
  The unchanged environment failure was not retried and no quiet-machine velocity claim is made.

## Wave 2 Snapshot — 2026-08-23

Wave 2 is complete at implementation SHA `a5338a807836f7fb4f4be7d88c1215acfbbbe0a4`.
The consolidated receipt is `handoffs/wave-2-receipt.md`.

- Module health: the declared pooling subpath is consumed without Shared `src` deep imports; the
  Shared root hook barrel is 604 lines; Garden Commitment and both composer flows have direct
  controller/model seams; `CommunityTab.tsx` is deleted and its largest replacement is 279 lines;
  the Hasura shell is 91 lines over a 260-line pure policy planner.
- Direct proof: controller, view, Community, and Hasura focused suites passed; the Indexer boundary
  suite passed 14/14; Shared story coverage is 249/249 and story quality passed.
- Regression evidence: validation-system passed 132/132, including a committed patch above 1 MiB;
  Shared passed 448/448 in 45.25 seconds, Client 195/195 in 51.30 seconds, Admin 72/72 in 40.79
  seconds, and Agent 270/270. These are changed-path batch observations, not quiet-machine full-suite
  claims.
- Exit invariants: consumers use `@green-goods/shared/commitment-pooling`; only the Coordination
  surface owns yield wiring and only Members dialogs own garden operations; restricted Hasura
  policies are preserved; default Job Queue composition proof no longer cold-loads the full graph.
- Boundary blockers: nine Indexer metadata tests cannot bind `127.0.0.1`; Docker is unavailable;
  local app and Storybook servers cannot bind their ports; authenticated Brave proof is therefore
  blocked. None is reported as passing or retried without a capability change.

## Wave 3 Snapshot — 2026-08-23

Wave 3 is complete at implementation SHA `6a037ab3984606f44a4596c0f4f2fcc5f6285861`.
The consolidated receipt is `handoffs/wave-3-receipt.md`.

- Module health: all 18 remaining Shared rows are regraded A- or A. Telemetry, reads, document and
  proof persistence, vault/yield, translation, auth/session, store transitions, and mutation flows
  now have explicit ports, repositories, commands, or pure transition seams. Domain hooks and Work,
  Auth, and App providers retain compatibility defaults only at their composition edges.
- Direct proof: the selected Shared batch passed 34 files / 226 tests; the shell contracts passed
  43/43; the five garden/assessment/action command suites passed 15/15. Source and test typechecks,
  source structure, design, vocabulary, ontology, test-quality, Plan Hub, and Storybook checks passed.
- Regression evidence: Client passed 93 files / 833 tests, Admin passed 95 files / 665 tests, and
  Agent passed 270 tests with one governed live-test skip. The exact critical checkpoint selected 14
  checks for 130 changed paths and completed successfully.
- Exit invariants: no Wave 3-internal command/type export remains in the dead-code advisory; required
  Storybook coverage is 249/249; `WorkProvider` is 65 lines; provider orchestration and UI shell state
  are directly testable without broad module mocks.
- Velocity: Shared focused proof took 19.73 seconds. Concurrent full Client and Admin consumers took
  255.97 and 332.46 seconds on the loaded capture machine, so quiet-machine targets remain unclaimed.
  No rendered UI behavior changed, and the unavailable local-server/authenticated-Brave path is not
  reported as passing.

## Wave 4 Snapshot — 2026-08-23

Wave 4 is complete at implementation SHA `61508165af52bdd9a227bc8a1ec626c65c219245`.
The consolidated receipt is `handoffs/wave-4-receipt.md`.

- Module health: all 21 committed Client/Admin rows are regraded A- or A. Pool, work submission,
  work detail, wallet send/scanning, login, Canvas, Submit Work, action editing, account profile,
  Cookie Jar outcomes, assessment/Hypercert transitions, route redirects, and Hub policies now have
  direct controller, view-model, transition, or policy seams. The Card Endow state machine remains
  the single named Wave 4 deferral; its staging guard proves that no live importer exists.
- Direct proof: the boundary Quick Gate passed Shared 716 tests with five governed skips and Client
  274 tests. Admin exposed one stale source-shape assertion after Canvas ownership moved into its
  controller; the corrected focused routing suite passed 19/19. Current-source focused closure then
  passed 5 Shared, 128 Client, and 38 Admin tests, with all three source/test typecheck pairs green.
- Structure and stories: the exact Wave 4 range passes source structure across 67 source files and
  preserves 12 frozen ceilings. Submit Work is split into a 300-line flow, 194-line step renderer,
  141-line field renderer, 309-line controller, and 173-line media controller. Required Storybook
  coverage is 254/254 and story-quality checks pass across 226 files.
- Conditional consumers: validation-system 136/136, Agent 270/270 with one governed live skip,
  Docs 28/28 plus its production build, ontology, design generation/tokens/vocabulary, staged
  modules, test quality, guidance, supply-chain, and Plan Hub checks passed. Contract compilation,
  2,050 Solidity tests, and the release gas boundary passed; the unchanged dual-chain script remains
  blocked when this sandbox rejects `127.0.0.1:3012` with `EPERM`.
- Blockers: authenticated Brave is unavailable, so visible UI verification is BLOCKED rather than
  passing. The unchanged Indexer localhost evidence remains 277 passing, one pending, and nine
  `EPERM 127.0.0.1` bind failures; it was not retried without a capability change.

## Wave 5 Snapshot — 2026-08-23

Wave 5 is complete at implementation SHA `aeeb62fbee128d00b213e027a9a5bd218286b08b`.
The consolidated receipt is `handoffs/wave-5-receipt.md`.

- Module health: all eight committed Indexer rows are regraded A- or A. Event/projection fixtures,
  settlement identities, redelivery cases, delivery laws, handler separation, helper concepts, and
  mined-log selection now have direct named contracts. The Hasura permission planner remains the
  pure, retry-safe boundary completed in Wave 2.
- Direct proof: yield-cluster closure passed 66/66; the helper/type split selection passed 90/90;
  the strict selector/runner suite passed 85/85; and the validation-system suite passed 140/140.
  Source structure checked ten changed non-test source files with no ceiling growth, and the Indexer
  build, ontology, test quality, guidance, immutable reports, and Plan Hub checks passed.
- Exit invariants: no per-file event-builder copies remain in the closed inventory; the four guarded
  entry handlers import only the public handler seam; six concept modules are each below 200 lines;
  `types.ts` contains three live types; and strict ABI, deployment, handler, config, and schema
  changes select the real mined-log integration with Docker/fork capability accounting.
- Velocity: seven coherent implementation commits used focused GREEN proof and one boundary gate.
  The full validation system finished in 2.28 seconds; the 16.1-second Quick Gate reached 298
  passing Indexer tests before the environment restriction stopped the suite.
- Blockers: nine metadata-server tests remain BLOCKED by `listen EPERM 127.0.0.1`. Docker and a
  local Arbitrum fork are unavailable, so the manual real-log case remains intentionally pending.
  These checks are not reported as passing and were not retried without a capability change.

## Wave 6 Snapshot — 2026-08-23

Wave 6 architecture is implemented at SHA `2ee5f5f9107435e557da292b350a8e4d82f3c2e7`.
The consolidated receipt is `handoffs/wave-6-receipt.md`. AC-W6 remains open because the approved
Admin import-share floor is not met.

- Test architecture: Shared, Client, and Admin now use explicit Node and DOM Vitest projects with
  matching exclusions and no project-local coverage configuration. All six partitions pass and
  discover the same 384 Shared, 103 Client, and 99 Admin test files across their paired projects.
- Direct-test enforcement: Check 5 is baseline-backed, its checker is 150 lines, four regression
  fixtures pass, a mocked-subject fixture fails as required, and the exact 13-entry baseline has no
  drift. The complete test-quality run discovered 862 tests.
- Partition proof: Shared passed 2,107 Node and 2,126 DOM tests; Client passed 119 Node and 749 DOM
  tests; Admin passed 100 Node and 611 DOM tests. Shared and Admin each retained their governed
  skips.
- Velocity limitation: the loaded-host DOM observations were Shared 70.26 seconds, Client 81.82
  seconds, and Admin 143.08 seconds, so the quiet-machine 60/50/90 targets are not claimed. The
  isolated Admin DOM import phase was 1,000.36 of 1,310.16 aggregate worker-phase seconds, or
  76.35%, above the below-40% floor.
- Bounded attempts: dependency optimization failed module exports/transformation, disabled
  isolation leaked mocks, and an Admin facade failed to close the transitive root-import and mock
  graph. All experiments were removed. A real migration of roughly 370 Admin root Shared imports
  and 52 root-module mocks is required to continue safely.
- Boundary proof: the single Quick Gate passed every check through Agent, then stopped after 298
  passing Indexer tests because nine metadata tests could not bind localhost. This unchanged
  environment blocker was not retried. The two-point coverage ratchet is not due until 2026-09-22.
