# GitHub Copilot Rollout via Existing Agent Guidance

**Slug**: `github-copilot-rollout`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-04-11`

## Problem

Green Goods already has strong AI operating guidance in `AGENTS.md`, package guides, and Codex config, but GitHub Copilot does not yet have that context inside the repository. There is no repo-level Copilot instruction surface, no path-specific instruction set, no `CODEOWNERS` protection for AI config and workflow files, and no GitHub-native security automation plan. As a result, the part of Copilot that matters most right now, GitHub platform review and CI/CD automation, is under-informed and under-used across all packages.

## Desired Outcome

- Copilot uses the existing Green Goods guidance model instead of introducing a parallel agent or skill system.
- GitHub-native Copilot review runs automatically on pull requests, reruns on new pushes where useful, and covers all major packages.
- `packages/admin`, `packages/client`, and `packages/agent` each have explicit package guardrails and review expectations, while `shared`, `contracts`, and `indexer` are also covered appropriately.
- Security, type drift, and workflow failures are surfaced earlier through GitHub platform features instead of being discovered late in manual review.
- High-risk areas remain human-governed: deployment, contract upgrades, `.env`, and agent operating docs.

## Scope Notes

- In scope: repo and path-level Copilot instructions, automatic GitHub review policy, on-push PR review reruns, Security & quality rollout, package-specific coverage across admin/client/agent/shared/contracts/indexer, repo guardrails, metrics
- Out of scope: editor autocomplete strategy, VS Code/CLI adoption work, new Copilot custom agents, new Copilot skills, autonomous changes to deploy or upgrade surfaces

## Success Signal

A pull request touching any core Green Goods package gets useful Copilot review and CI-linked security feedback automatically, with reruns on incoming commits, without maintainers having to restate repo rules in the PR thread.
