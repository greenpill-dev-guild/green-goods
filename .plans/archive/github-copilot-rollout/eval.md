# GitHub Copilot Rollout via Existing Agent Guidance Evaluation Plan

## Release Gates

1. Correctness: Copilot guidance mirrors existing Green Goods rules closely enough that package maintainers do not need to restate core constraints in every pull request.
2. Usability: automatic GitHub review and security workflows show practical value across all packages, with especially clear signal in `packages/admin`, `packages/client`, and `packages/agent`.
3. Regression safety: the rollout does not weaken protected-path governance or security posture.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Repo and path-level Copilot instructions exist and point back to existing Green Goods guidance instead of inventing a new customization model | `state_api` | Instruction files reference repo/package rules accurately |
| AC-2 | Automatic Copilot review is configured only on open pull requests targeting `main` or `develop`, and reruns when new commits are pushed to the pull request | `state_api` | Ruleset configuration and observed rerun behavior |
| AC-3 | The admin pilot explicitly covers cockpit shell, shared primitives, permissions, and required build validation for route/view work | `ui` | Admin instruction file and package review policy |
| AC-4 | The client pilot explicitly covers offline queue behavior, shared auth, shared hooks/providers, media resource cleanup, and build validation | `ui` | Client instruction file and package review policy |
| AC-5 | The agent pilot explicitly covers pure handlers, dependency injection, secret safety, rate limiting, generic user-facing failures, and tests/typecheck | `state_api` | Agent instruction file and package review policy |
| AC-6 | `shared`, `contracts`, and `indexer` each have explicit review coverage and protected-path depth matched to risk | `contracts` | Package policy matrix and protected-path config |
| AC-7 | Premium-request budget and alerts are configured before automatic review goes live | `state_api` | Billing policy, budget, and alert configuration |
| AC-8 | Security & quality rollout produces a prioritized remediation flow without enabling uncontrolled version-update churn | `state_api` | Security dashboard, risk assessment output, alert policy |
| AC-9 | Protected paths for contracts, indexer schema/config, deploy/upgrade, workflows, and agent-operating docs require explicit human review | `contracts` | `CODEOWNERS` and branch/ruleset configuration |
| AC-10 | Two-week package review shows whether Copilot is catching meaningful review, type, drift, and security issues earlier across the repo | `qa_pass_1` | Pilot summary note with package feedback, metrics, and spend profile |

## Test Strategy

- Unit: not applicable for the plan itself; implementation should keep tests focused on any changed workflow or instruction validation utilities
- Integration: pilot automatic Copilot review on one bounded PR each in `packages/admin`, `packages/client`, and `packages/agent`, plus at least one shared or contracts/indexer PR
- E2E / Playwright: only where package pilots already rely on existing route or user-flow checks
- Manual checks: review GitHub settings, automatic-review reruns on push, Security & quality dashboard, budget status, and package maintainer feedback

## QA Sequence

### Claude QA Pass 1

- Confirm the plan gives `admin`, `client`, and `agent` equal specificity rather than treating them as downstream consequences of shared work
- Confirm the rollout is centered on GitHub PR review, on-push reruns, and Security & quality rather than editor usage
- Flag any instruction-writing work that looks like duplicated operating-doc maintenance

### Codex QA Pass 2

- Re-check guardrail ordering: protect first, enable second
- Confirm rollout steps are package-aware and execution-ready
- Validate that contracts and indexer remain intentionally conservative parts of the rollout
