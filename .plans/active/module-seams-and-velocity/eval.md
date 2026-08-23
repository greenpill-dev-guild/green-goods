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
