# AI-Native Developer Workflow Evaluation

## Release Gates

1. Plan integrity: this hub validates with the repo's native plan validator.
2. Truth boundary: `.plans` remains the execution truth; no cross-repo mega-plan is introduced.
3. Evidence quality: ledger, scorecard, adversarial review, and closeout notes distinguish proof from inference.
4. Cognitive-load check: any added process must reduce repeat confusion or review cost.

## Required Evidence

- Agent Run Ledger entry for one active feature.
- Workflow Scorecard baseline for one recent feature.
- Adversarial Review notes with blocker/follow-up/no-action classification.
- Closeout Gate confirmation that spec, implementation, eval, and QA notes agree.
- Rule Feedback Loop note for any repeated agent failure pattern.

## Validation Commands

| Command | When To Run |
|---|---|
| `node scripts/harness/plan-hub.mjs validate` | Always after editing this hub. |
| Selected-feature validation | Only when a later lane touches non-plan files; choose the lightest honest validation for that feature. |

## Proof Limits

- This scaffold does not prove runtime behavior.
- Week-one completion proves plan integrity, artifact readiness, and the first measured scaffold-hardening lane only.
- Runtime, browser, security, or deployment proof is required only when later lanes touch those surfaces.
