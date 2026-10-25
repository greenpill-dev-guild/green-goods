# Critical push override: owner proof plus consumer typechecks (2026-10-25)

Afo asked why the local gates take so long. The answer, measured from the receipt stores on his
machine, was the critical tier. This report records the evidence, the five decisions he locked
(D15), and the before/after shape of the gate. The change itself is in the selector, the policy,
their tests and the guides; it was implemented uncommitted in a worktree, so publication state
lives with the pull request that carries it.

## Evidence

Method: every passing receipt records `passedAt`, and the gate runs checks one at a time, so
consecutive timestamps inside one run (same store, head, working copy, intent) are real per-check
wall times. 6,085 receipts from 43 stores, 2026-08-16 to 2026-10-25, on a 10-core, 24 GB machine.
Spans exclude startup and the first check, so they are lower bounds.

| Push tier | Runs | Span p50 | p75 | p90 | Share of all local gate time |
|---|---|---|---|---|---|
| critical | 110 (25%) | 731 s | 1130 s | 1586 s | 81% (28.4 h) |
| sensitive | 290 | 18 s | 79 s | 182 s | 18% |
| routine | 45 | 19 s | 63 s | 132 s | 2% |

A critical run averaged 31 checks: about 500 s in test suites, 180 s in production builds, 170 s in
static checks and 60 s in typechecks. In a critical plan every mandatory suite ran whole, whatever
`--test-path` named, and the whole suites queued on the machine test lease. September pushes ran
1 to 15 s at the median with no critical runs; the last two weeks ran 295 pushes at a median of
40 to 259 s, with constant-cost checks 3 to 7 times slower under parallel-session load.

The same Shared paths already fan out in CI: the selector expects the Shared, Client, Admin and
Agent workflows for every path in the Shared critical override, and those workflows run the whole
consumer suites, the test and story typechecks and the production builds on the merge ref.

## Decisions (D15, locked by Afo on 2026-10-25)

1. Push and qa shrink; checkpoint, ship, readiness, merge and release keep the full fan-out.
2. Consumer proof is the source typecheck and the test typecheck of every consumer surface.
3. The contracts override is unchanged: its verify step has no pull-request CI equivalent.
4. The browser presets are unchanged; CI runs all three on every client pull request, so making
   them advisory locally is a candidate for a later decision.
5. Critical stays uncapped; the policy version moves to 3 so old receipts drop.

## Before and after (selector renders, cold estimates)

| Change | Before | After | Dropped |
|---|---|---|---|
| `providers/Auth.tsx` | 21 checks, 400 s | 16 checks, 217 s | shared-build, client-test, client-build, admin-test, admin-build, agent-test, agent-build |
| `hooks/work/useDraftAutoSave.ts` | 18 checks, 268 s | 12 checks, 85 s (14 with a client test path) | the same seven |
| `hooks/garden/useGardenJoinRequests.ts` with a client view | 23 checks, 343 s | 17 checks, 178 s | the same, except client-build, which the owner compile rule keeps for the view |
| `contracts/src/modules/HatsModule.sol` | 7 checks, 469 s | 7 checks, 469 s | nothing |

Added everywhere: `client-typecheck` and `admin-typecheck` as consumer proof. The owner's suite now
runs focused on the named tests and the plan returns `needs-focus` without one, as a sensitive push
does. A critical qa run follows the same consumer rule: consumer typechecks, and a consumer suite
only for a named test; qa's fan-out for sensitive Shared changes is unchanged. The cross-package
checkpoint keeps the complete override: its consumer suites stay mandatory and its mandatory suites
run whole.

## Review round one (Codex, 2026-10-25)

Five findings on the first head, all accepted: a critical barrel change (`modules/auth/index.ts`)
counted compile proof and ran the whole Shared suite plus the owner build, so a critical owner now
names a test and gets no build; the ship skill's iron law and activation table still demanded the
complete Ship Gate for critical surfaces; critical qa still selected the consumer suites, so it now
selects their typechecks and a suite only for a named test; `contractsCritical` fired on any
`packages/contracts/` path beside a critical Shared change, so it now requires a matched contract
override rule; and format, lint and the CI-owned design and supply-chain conditionals were not
scoped the fast-push way for critical pushes.

## What to measure next

After a week of merges, re-run the receipt analysis and compare the critical push span against the
731 s median above; the target is under 180 s on a quiet machine. Count `--no-verify` mentions in
pull request bodies against the 15 of 150 seen before the change.
