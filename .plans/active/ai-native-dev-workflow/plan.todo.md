# AI-Native Developer Workflow Plan

## Week 1 - Scaffold The Operating Hub

- [x] Validate this hub with `node scripts/harness/plan-hub.mjs validate`.
- [x] Confirm the five deliverables exist: ledger, scorecard, adversarial review, closeout gate, rule feedback loop.
- [x] Keep this work inside `.plans`; do not touch runtime code.

## Week 2 - Agent Run Ledger

- [x] Select one active feature for first adoption: `ai-native-dev-workflow` scaffold hardening is the first measured lane; `css-maintainability-polish` remains the default baseline candidate for product/runtime adoption.
- [x] Record at least one agent run using `artifacts/agent-run-ledger.md`.
- [x] Capture verification cost and any context gaps.

## Week 3 - Workflow Scorecard

- [x] Backfill the scaffold-hardening lane as the initial baseline using `artifacts/workflow-scorecard.md`.
- [x] Record review findings, tests, regressions caught, and human rework.

## Week 4 - Adversarial Review

- [x] Run one read-only adversarial review using `reports/adversarial-review.md`.
- [x] Classify findings as blocker, follow-up, or no-action.

## Week 5 - Closeout Gate

- [x] Add closeout gate wording to the smallest existing repo guidance surface or lane handoff.
- [x] Keep changes scoped; do not duplicate the full spec.

## Week 6 - Retrospective

- [ ] Compare scorecards across scaffold hardening, CSS maintainability, and the agent-max readiness pilot.
- [ ] Keep only readiness steps that caught real drift or reduced review cost.
- [ ] Record what should not become process, including any checklist fields that stayed ceremonial.
- [ ] Decide whether the pre-agent checklist, data-contract map, or route/access matrix deserve promotion beyond this hub.
