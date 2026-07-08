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

- [x] Compare scorecards across scaffold hardening, CSS maintainability, and the agent-max readiness pilot.
- [x] Keep only readiness steps that caught real drift or reduced review cost.
- [x] Record what should not become process, including any checklist fields that stayed ceremonial.
- [x] Decide whether the pre-agent checklist, data-contract map, or route/access matrix deserve promotion beyond this hub.

## Retrospective Outcome (2026-05-31)

**Scorecard comparison (4 lanes).** Scaffold-hardening = Green (measurable, no second truth surface; caught a premature-ready lane). CSS scope-lock + micro-batch = Green (scope-lock-before-runtime caught stale plan-evidence drift; added regression coverage; recorded proof limits). Agent-max readiness = Yellow (the starting `drift:check` caught skill-mirror / docs / README / alert-style drift before dispatch — high value — but the source-structure guard exposed unresolved oversized-file debt it could not clear). A fifth data point from the June maturation session: a stronger-model adversarial review caught inflated review metrics and an env-parity approach that would have been theater, and dogfooding the staging→prod flow surfaced the squash-divergence problem.

**Kept (caught real drift / reduced review cost):**
- `bun run drift:check` before broad/parallel agent dispatch.
- Scope-lock before runtime edits, with an explicit human gate; preserve unrelated dirty work.
- Adversarial review before committing to an approach (not after).
- Copy-runnable validation commands + explicit proof limits (proof, not assertion).
- Data-contract map when a change touches schemas / contracts / stores / shared types / API shapes.

**Not made standing process (ceremony / conditional):**
- The source-structure guard as a hard pre-dispatch gate — it blocks on already-oversized touched files without reducing review cost; it is a *decomposition signal* (now tracked as PRD-574 / PRD-566 / PRD-565), not a routine gate.
- The route/access matrix as a mandatory field — it was `N/A` in the pilot; fill it only when routes / auth / role gates / shells change.
- The full pre-agent checklist for every task — it is for broad/parallel dispatch only; single-file sequential work just proceeds (CLAUDE.md Subagent Discipline).

**Promoted beyond the hub:** the kept habits above now live in `ONBOARDING.md` (§ "Working with agents here"); the data-contract map and route/access matrix remain conditional artifacts referenced from there. Hub archived to `.plans/archive/`.
