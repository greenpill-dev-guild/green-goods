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
- Pre-Agent-Max Checklist before broad or parallel dispatch.
- Data Contract Map when schemas, public contracts, persistent stores, generated artifacts, shared domain types, or API request/response shapes change.
- Route/Access Matrix when routes, auth gates, role gates, shells, navigation, or public API route paths change.

## Validation Commands

| Command | When To Run |
|---|---|
| `node scripts/harness/plan-hub.mjs validate` | Always after editing this hub. |
| `bun run check:skills` | After generated Codex skill mirror changes. |
| `bun run docs:audit:ci` | After docs source-of-truth, frontmatter, or README trust-surface edits. |
| `bun run lint:rules` | After client/admin React pattern cleanup. |
| `bun run test:shared` | After shared public-contract validation changes. |
| `bun run test:agent` | After agent handler or public API behavior changes. |
| `bun run build:agent` | After agent handler or shared public-contract import changes. |
| `bun run drift:check -- --scope all --json` | Before broad dispatch and at closeout for readiness hardening work. |
| Selected-feature validation | Only when a later lane touches other non-plan files; choose the lightest honest validation for that feature. |

## Proof Limits

- This scaffold does not prove runtime behavior.
- Week-one completion proves plan integrity, artifact readiness, and the first measured scaffold-hardening lane only.
- Runtime, browser, security, or deployment proof is required only when later lanes touch those surfaces.
- The upload-signing pilot proves the public API validation pattern for one boundary only; it does not migrate funding intents or other public endpoints.
- Route/access matrix proof is `N/A` unless a pass changes route paths, auth/role gates, shells, or navigation.
