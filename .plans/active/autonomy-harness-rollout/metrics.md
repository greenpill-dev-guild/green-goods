# Autonomy Harness Rollout Metrics

This file names the measurable target for each loop family discussed in the rollout research.

## Active Loop Families

| Loop | Owning lane | Editable surface | Metric | Time budget | Keep gate | Revert / bail trigger |
|---|---|---|---|---|---|---|
| `cleanup` | `state_api` | bounded infra, stale runtime paths, dead helpers | verified dead-surface count decreases while `node scripts/ci-local.js --quick` stays green | 30-60 min | targeted tests or repo-quick pass, no parity uncertainty | validation fails, route parity is unknown, or dead-surface claim is stale |
| `bug` | `state_api` | a single failing path plus focused regression tests | failing regression goes green | 30-60 min | touched package tests and typecheck pass | regression still fails or unrelated behavior regresses |
| `t1-shared` | `state_api` | `packages/shared` contract and behavior tests | failing focused test count and repeated warning count trend down | 30-45 min | targeted shared tests pass | warning noise grows or contract behavior drifts |
| `t2-admin` | `state_api` | admin hub and operator behavior tests | failing admin-focused tests trend down | 30-45 min | `bun run test:hub` or narrower target passes | route/view work needs the legacy surface or build unlock |
| `t3-client` | `state_api` | client behavior and journey tests | failing client-focused tests trend down and runner exits cleanly | 30-45 min | targeted client tests pass | full runner stalls or user-flow assertions regress |
| `t4-hygiene` | `state_api` | test governance, warning hygiene, skip governance | governed-skip count and repeated warning count trend down while `bash scripts/check-test-quality.sh` stays green | 30-45 min | quality script passes and warning output is measurably cleaner | warnings remain noisy enough to obscure eval output |

## Deferred Design Lanes

| Loop | Owning lane | Editable surface | Metric | Time budget | Keep gate | Revert / bail trigger |
|---|---|---|---|---|---|---|
| `d1-paradigm` | `ui` | pilot screen brief/spec surface | paradigm mismatch count on the chosen pilot falls | 45 min | pilot still matches admin/client dialect rules | more than one pilot surface is touched |
| `d2-layout` | `ui` | layout structure and spacing on one pilot surface | overflow / clipping / concentricity defects trend down | 45 min | viewport checks stay stable | layout work spills into unrelated styling or motion |
| `d3-interaction` | `ui` | focus, affordance, and sheet/dialog interactions | keyboard/focus regressions trend down | 45 min | interaction checks pass on the pilot | interaction fixes require a paradigm rewrite |
| `d4-visual` | `ui` | token, color, and material usage on one pilot surface | token drift and visual defects trend down | 45 min | `bun run check:design-tokens` stays green | layout is still unstable |
| `d5-motion` | `ui` | animation and transition behavior on one pilot surface | motion defects trend down without new jank | 45 min | motion remains token-backed and bounded | motion changes introduce layout drift or accessibility regressions |
| `d6-verification` | `ui` | visual/a11y regression checks for the pilot | visual-diff and a11y failures trend down | 45 min | verification surface is wired and green | Chromatic or equivalent verification is still absent |

## Blocked Task-Agent Lane

| Loop | Owning lane | Editable surface | Metric | Time budget | Keep gate | Revert / bail trigger |
|---|---|---|---|---|---|---|
| `trace-capture` | future `agent` plan | `packages/agent` handler + trace sink surface | captured turn completeness rises toward `{ user_intent, tool_calls, final_output, satisfaction_signal }` | 1-2 hrs | traces are emitted without leaking secrets | traces are incomplete, noisy, or policy-unsafe |
