# GitHub Copilot Rollout via Existing Agent Guidance Spec

## Summary

This active plan introduces GitHub Copilot into the Green Goods development flow through GitHub-native review, CI/CD, and security features, not through editor assistance. The rollout teaches Copilot the same repository rules already enforced through `AGENTS.md`, package guides, and Codex config, adds GitHub-native guardrails and security features, and gives every core package explicit coverage expectations. `packages/admin`, `packages/client`, and `packages/agent` remain first-class rollout lanes because they are the highest-frequency application surfaces, but `shared`, `contracts`, and `indexer` are also covered with appropriate review and protection depth.

## Users

- Primary: maintainers working in `packages/admin`, `packages/client`, `packages/agent`, and `packages/shared`
- Secondary: reviewers, security owners, and operators relying on GitHub PR review, code scanning, and alert remediation

## Functional Requirements

1. Surface the existing Green Goods operating rules to Copilot through repo and path-specific instructions, without creating new Copilot agents or skills.
2. Configure automatic Copilot code review as a repository policy on open pull requests targeting `main` or `develop`, with reruns on new pushes where that signal is valuable.
3. Cover all core packages in the rollout: `admin`, `client`, `agent`, `shared`, `contracts`, and `indexer`, with package-specific expectations and protected-path depth matched to risk.
4. Add repository guardrails so Copilot can assist on normal code paths while protected paths still require human oversight.
5. Integrate Copilot code review and GitHub-native security capabilities into CI/CD-oriented workflows, including PR review, failing-check remediation, code scanning, Dependabot alert remediation, and metrics.
6. Add premium-request budget controls and usage monitoring so review-on-push remains financially bounded.
7. Establish metrics and review checkpoints so the rollout can be adjusted or constrained based on actual package-level outcomes.

## Non-Functional Constraints

- Package boundaries: `AGENTS.md` and package guides remain the source of truth; Copilot instructions mirror them but do not replace them.
- Security: no autonomous edits to deploy scripts, contract upgrade flows, `.env`, or agent operating docs; protect those paths with `CODEOWNERS` and branch rules.
- Offline / sync: `packages/client` must preserve offline-first queue behavior and shared auth boundaries.
- Localization: if rollout work creates new user-facing strings, they must be added to `en`, `es`, and `pt`.
- Operational safety: existing local agent workflows may remain in the repo, but they are not dependencies for this rollout.

## Package Focus Matrix

| Package | Copilot Value | Guardrails to Preserve | Pilot Focus |
|---|---|---|---|
| `packages/admin` | Automatic PR review on route, layout, permission, and shared primitive usage changes | Follow `admin.mdx`, use `CanvasLayout`, keep permission checks and shared primitives | Run Copilot review on PR creation and on push for admin-heavy PRs |
| `packages/client` | Automatic PR review on offline/auth/media flows, tests, and build-sensitive changes | Keep hooks/providers in shared, preserve offline queue, shared auth APIs, blob URL cleanup | Run Copilot review on PR creation and on push for client-heavy PRs |
| `packages/agent` | Automatic PR review on handlers, adapters, secrets, rate limits, and type safety | Keep handlers pure where possible, no plaintext keys, rate-limit external actions, generic user-facing failures | Run Copilot review plus Security & quality checks on agent-heavy PRs |
| `packages/shared` | Automatic PR review on shared hook boundaries, i18n, query keys, UI primitives, and barrels | Hooks stay in shared, query keys centralized, user strings translated | Treat shared as always-covered because drift here cascades everywhere |
| `packages/contracts` | PR review and security signal on standard contract changes, with strict protected-path review on upgrades/deploys | Human review remains mandatory for upgrades, deploy scripts, and contract safety changes | Keep covered, but with conservative merge policy and stronger human gating |
| `packages/indexer` | PR review and code-scanning signal on handler/schema/config changes | No EAS indexing, every entity needs `chainId`, codegen before trust | Keep covered, but protect schema/config and require codegen-aware review |

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Repo instructions plus admin/client package review policy | `ui` | CI/CD coverage for user-facing packages |
| Shared/agent/security automation and workflow wiring | `state_api` | Shared guidance, agent package, GitHub review/security settings |
| Contracts/indexer guardrails and protected-path policy | `contracts` | Human-governed high-risk package boundaries with platform coverage |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential rollout review and package pilot validation |

## Risks

- Guidance duplication drift: mitigate by copying only stable, high-signal rules from existing repo docs and reviewing drift manually.
- Overreach into sensitive paths: mitigate with `CODEOWNERS`, protected branches, signed agent commits, and explicit out-of-scope rules.
- Under-serving app packages: mitigate with package-specific pilot steps and acceptance checks for `admin`, `client`, and `agent`.
- Review fatigue: use automatic Copilot review where it adds coverage, but avoid turning every AI surface into a blocking requirement.
- Commit-review expectation mismatch: GitHub's current fit is automatic PR review that reruns on each push to the pull request, not a standalone review surface for loose commits outside PRs.
- Premium-request spend drift: mitigate with branch scoping (`main` and `develop` only), no draft reviews, and budget alerts or hard stops.
