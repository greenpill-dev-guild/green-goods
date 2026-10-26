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

## Review round two (Codex, 2026-10-25)

Three findings on the second head, all accepted: critical qa accepted a plan with no named owner
test and ran the whole Shared suite, so critical qa now requires focus like critical push; the ship
skill's frontmatter description and README, and the plan and clean skills, still reserved the full
gate for critical surfaces, so all four now name the mandatory override and the skills catalog is
regenerated; and a change that was critical for both Shared and contracts fell back to the strict
shape, so the two shapes now compose: the Shared part keeps its focused owner suite and consumer
typechecks while the matched contracts gate runs whole beside it, and a manual `--risk critical`
with no matched rule treats every owner as a critical owner with its typecheck and no build. The
contracts gate's check set is unchanged; its format and lint are now scoped to the changed paths
like every push.

## Review round three (Codex, 2026-10-25)

Two findings on the third head, both accepted: an explicit `--check` exempted every owner from
focus through the early return in `focusedProofMissing`, so a critical owner could run its
mandatory suite whole or, when manually critical, skip it; an explicit check now stands in only for
ordinary owners. And `scripts/contracts/` paths are contract-owned by the policy's surface rules but
not by `owningSurface`, so a critical script change with a contracts test path focused the
whole-suite gate; the contracts flag now reads ownership from the surface rules.

## Review round four (Codex, 2026-10-25)

Three findings on the fourth head, all accepted and fixed at one root: critical owners and the
contracts flag were still derived from `owningSurface`, and the all-owner fallback fired whenever
no owner mapped rather than only on an explicit `--risk critical`. The selector now derives one
list of critical paths (override and content matches, or every changed path when only an explicit
`--risk critical` applies) with ownership read from the policy's surface rules. So a critical
`scripts/contracts/` change no longer makes a client entry point beside it critical and drops its
build; an explicit critical qa run selects every consumer's test typecheck; and an explicit
`--risk critical` on a contracts-owned path brings the complete contracts gate, whose check list is
now read from the policy's contract overrides.

## What to measure next

After a week of merges, re-run the receipt analysis and compare the critical push span against the
731 s median above; the target is under 180 s on a quiet machine. Count `--no-verify` mentions in
pull request bodies against the 15 of 150 seen before the change.
