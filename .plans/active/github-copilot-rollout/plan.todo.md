# GitHub Copilot Rollout via Existing Agent Guidance Plan

**Feature Slug**: `github-copilot-rollout`
**Status**: `ACTIVE`
**Created**: `2026-04-11`
**Last Updated**: `2026-04-11`
**Branch**: `feature/github-copilot-rollout`

## Implementation Progress

- Repo-backed rollout artifacts added under `.github/`:
  - `.github/copilot-instructions.md`
  - `.github/instructions/root.instructions.md`
  - `.github/instructions/shared.instructions.md`
  - `.github/instructions/admin.instructions.md`
  - `.github/instructions/client.instructions.md`
  - `.github/instructions/agent.instructions.md`
  - `.github/instructions/contracts.instructions.md`
  - `.github/instructions/indexer.instructions.md`
  - `.github/CODEOWNERS`
  - `.github/codeql/codeql-config.yml`
  - `.github/workflows/codeql.yml`
  - `.github/copilot-rollout-settings-checklist.md`
- `.github/dependabot.yml` now keeps npm update PRs disabled while allowing conservative GitHub Actions update PRs.
- Manual GitHub UI work is still required for automatic Copilot review rulesets, security toggles, premium-request budgets, and alerting.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Reuse existing Green Goods agent guidance rather than creating new Copilot agents or skills | The repo already has a strong operating model in `AGENTS.md`, package guides, Codex config, and Claude workflows. Duplicating that logic in a second customization system would create drift fast. |
| 2 | Make this rollout GitHub-platform and CI/CD first | The stated gap is Copilot inside GitHub workflows, PR review, and security, not editor autocomplete or local IDE assistance. |
| 3 | Use automatic Copilot PR review with on-push reruns as the closest fit for "commit review" | GitHub can automatically rerun Copilot code review when new commits are pushed to a pull request, which matches the need better than manual reviewer assignment. |
| 4 | Cover all packages, but keep `admin`, `client`, and `agent` explicit because they are the highest-velocity application surfaces | These packages need the most practical rollout detail, but `shared`, `contracts`, and `indexer` also need coverage and guardrails. |
| 5 | Protect high-risk paths before enabling broader Copilot workflows | Deploy scripts, contract upgrades, `.env`, workflow files, and agent operating docs should not become casual AI edit surfaces. |
| 6 | Treat Claude as non-goal for this rollout | Existing Claude workflows can remain, but alignment and execution should not depend on them. |
| 7 | Automatic Copilot review runs only on open pull requests targeting `main` or `develop` | This keeps the rollout focused on the real integration branches and avoids wasting spend on drafts or side-branch churn. |
| 8 | Automatic review should apply across all packages, including protected areas, but protected areas still require human review | The goal is broad issue detection, drift detection, and security coverage, not selective AI silence. |
| 9 | Cost control is mandatory from day one | Review-on-push can consume premium requests quickly, so budgets and branch scoping need to be part of the initial rollout instead of a follow-up. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Existing guidance is surfaced to Copilot without new agents or skills | `state_api` | Steps 1-3 | ✅ |
| Automatic Copilot review runs on open pull requests targeting `main` or `develop`, and reruns on new pushes where configured | `state_api` | Step 4 | 🟡 Repo files landed; GitHub ruleset/settings still manual |
| All packages are covered with package-appropriate review depth and guardrails | `contracts` | Steps 5-8 | ✅ |
| `packages/admin` has explicit rollout goals and guardrails | `ui` | Step 5 | ✅ |
| `packages/client` has explicit rollout goals and guardrails | `ui` | Step 6 | ✅ |
| `packages/agent` has explicit rollout goals and guardrails | `state_api` | Step 7 | ✅ |
| GitHub-native security is enabled with remediation flow | `state_api` | Step 8 | 🟡 CodeQL/workflow files landed; GitHub Security toggles still manual |
| Protected paths remain human-governed | `contracts` | Step 9 | ✅ |
| Rollout is measured and re-tuned after pilots | `qa_pass_1` | Step 10 | ⏳ |

## Lane Checklists

### UI (`claude/ui/github-copilot-rollout`)

- [x] Draft repo and path-specific instructions that explicitly cover `packages/admin` and `packages/client`
- [x] Encode admin UI contract rules from `admin.mdx` and `packages/admin/AGENTS.md`
- [x] Encode client rules around offline queue, shared hooks, auth, media resources, and build-sensitive changes
- [x] Define package review policies and CI/CD acceptance checks for admin and client
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/github-copilot-rollout`)

- [x] Draft shared and agent package instruction surfaces
- [x] Keep hooks and shared logic centered in `@green-goods/shared`
- [x] Encode `packages/agent` security and correctness rules: pure handlers, secret safety, rate limits, generic errors
- [x] Add GitHub rollout steps for automatic review, on-push reruns, code scanning, secret scanning, and metrics
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/github-copilot-rollout`)

- [x] Define protected-path policy for `packages/contracts`, indexer config/schema, deploy scripts, and upgrade flows
- [x] Mark which contracts/indexer areas are review-only versus execution-safe for Copilot
- [x] Keep contract and indexer rollout intentionally conservative
- [ ] Write `handoffs/codex-contracts.md`

### QA Pass 1 (`claude/qa-pass-1/github-copilot-rollout`)

- [ ] Review whether admin/client/agent are represented concretely in instructions and pilot scope
- [ ] Verify package acceptance checks are practical for maintainers
- [ ] Confirm no rollout step quietly introduces a parallel agent system
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/github-copilot-rollout`)

- [ ] Re-check repo guardrails, security scope, and rollout sequencing
- [ ] Confirm validation commands and package-specific gates are realistic
- [ ] Close the loop on drift and package coverage gaps
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Implementation Steps

### Step 1: Lock rollout principles and out-of-scope paths
**Files / Surfaces**: GitHub org/repo settings, `AGENTS.md`, package guides, this feature hub
**Change**: Establish the operating rule that Copilot will consume existing guidance only. Explicitly exclude new Copilot agents/skills, editor/autocomplete adoption work, and autonomous changes to deployment, upgrade, `.env`, workflow, and agent-operating docs.

### Step 2: Add repo-level Copilot instruction surfaces from existing guidance
**Target Files**: `.github/copilot-instructions.md`, `.github/instructions/root.instructions.md`
**Change**: Mirror only stable repo-wide rules: `bun` commands, validation expectations, shared-hook boundary, root `.env`, `logger`, `Address`, i18n, and validation ladder references.

### Step 3: Add path-specific instruction coverage for shared, admin, client, agent, contracts, and indexer
**Target Files**: `.github/instructions/shared.instructions.md`, `admin.instructions.md`, `client.instructions.md`, `agent.instructions.md`, `contracts.instructions.md`, `indexer.instructions.md`
**Change**: Convert package-level guardrails into Copilot-readable path instructions, keeping package boundaries explicit and avoiding duplicate prose where a short rule will do.

### Step 4: Configure automatic Copilot review policy for pull requests
**Target Files / Surfaces**: GitHub repository rulesets and Copilot code review settings
**Change**: Enable automatic Copilot code review on open pull requests that target `main` or `develop`. Do not run it on draft pull requests. Turn on reruns when new commits are pushed to a qualifying pull request, which is the current GitHub-native equivalent of commit-level review.

### Step 5: Run the `packages/admin` CI/CD pilot
**Target Files / Surfaces**: `packages/admin/**`, `docs/docs/builders/packages/admin.mdx`, Copilot review settings
**Change**: Make admin a first-class automatic-review package. Ensure the instructions explicitly teach `CanvasLayout`, preferred shared primitives, permission checks, and required build validation for route/view changes. Review should rerun on new pushes to admin-heavy pull requests.

### Step 6: Run the `packages/client` CI/CD pilot
**Target Files / Surfaces**: `packages/client/**`, Copilot review settings
**Change**: Make client a first-class automatic-review package. Ensure instructions explicitly teach offline-first queue preservation, shared auth APIs, shared hooks/providers, media resource cleanup, and build-sensitive validation. Review should rerun on new pushes to client-heavy pull requests.

### Step 7: Run the `packages/agent` CI/CD pilot
**Target Files / Surfaces**: `packages/agent/**`, security/review settings
**Change**: Make agent a first-class automatic-review and security package. Ensure instructions explicitly teach handler purity, dependency injection, secret storage rules, rate limiting, generic user-facing failures, and test/typecheck discipline. Review should rerun on new pushes to agent-heavy pull requests.

### Step 8: Enable GitHub-native security features and remediation flow across all packages
**Target Files / Surfaces**: GitHub Security & quality settings, CodeQL configuration, secret scanning, Dependabot alerts
**Change**: Enable dependency graph, Dependabot alerts, secret scanning, push protection where feasible, and CodeQL for JS/TS plus Actions. Use Code Security risk assessment and Ask Copilot in assessments to prioritize work. Use `@copilot` on pull requests to fix failing tests or address review comments, and assign suitable Dependabot alerts to coding agents for remediation. Keep version-update churn conservative until the remediation loop is stable.

### Step 9: Add repo guardrails and protected-path policy
**Target Files**: `.github/CODEOWNERS`, repo rulesets, branch protection settings
**Change**: Protect AI config, workflows, deploy/upgrade paths, contracts, and indexer schema/config with code-owner review. Automatic Copilot review still applies across these areas, but merge policy stays human-governed. Enable Copilot cloud-agent signed commits, runner controls, and firewall settings before expanding autonomous features.

### Step 10: Add cost controls and usage monitoring
**Target Files / Surfaces**: GitHub Copilot billing settings, budgets, premium-request analytics
**Change**: Set a Copilot premium request budget before enabling repository-wide automatic review. Scope automatic review to open pull requests targeting `main` or `develop` as the first cost-control layer. Enable budget alerts and define whether usage should stop when budget is reached.

### Step 11: Review metrics and decide whether to expand, hold, or constrain
**Target Files / Surfaces**: GitHub Copilot usage metrics, PR review data, security dashboard, this feature hub
**Change**: After two weeks of pilot use, review package-level signal across all packages: PR review coverage, rerun usefulness on new pushes, reopened bugs, alert remediation speed, type or security issues caught earlier, and maintainers' trust in admin/client/agent/shared/contracts/indexer output. Include premium-request consumption and budget pressure in the review. Use that review to decide whether to broaden or narrow the rollout.

## Validation

- [x] Instruction files map cleanly back to `AGENTS.md`, package guides, and `admin.mdx`
- [x] Protected paths are identified before broader Copilot enablement
- [ ] Automatic Copilot review is limited to open PRs targeting `main` or `develop` in GitHub rulesets
- [ ] Automatic Copilot review is configured to rerun on new pushes to qualifying pull requests in GitHub settings
- [x] Admin pilot has build-sensitive validation and UI-contract checks in the instruction surface
- [x] Client pilot has offline/auth/media checks in the instruction surface
- [x] Agent pilot has test, typecheck, and security-sensitive checks in the instruction surface
- [x] Shared, contracts, and indexer each have explicit coverage or protected-path policy
- [ ] Premium request budget and alerts are configured before rollout goes live
- [ ] `node scripts/check-codex-consistency.js`
- [ ] `node scripts/ci-local.js --quick` once rollout files move from plan to implementation
