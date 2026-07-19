# Dependency Modernization 2026 Evaluation Plan

> **Archived record:** implementation is closed. Operational handoffs, reports, artifacts, and lane files were removed; any such references below describe historical execution, not live work.

## Release Gates

1. Correctness: every admitted target resolves exactly as planned and affected packages pass.
2. Security: zero critical and zero direct high advisories; remaining transitive highs are owned.
3. Usability: developer commands, browser apps, docs, Storybook, agent, and indexer remain usable.
4. Regression safety: public APIs, persisted state, wallets, contracts, and GraphQL shapes are stable.
5. Evidence quality: research evidence and open assumptions are recorded before implementation.
6. Human judgment: protected surfaces and maintainer-call decisions are called out before completion.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Supply chain | Frozen install, audit diff, lockfile/source review | `state_api` | wave reports |
| AC-2 | Offline and state | Restore, drafts, queue, mutation, form, store, and machine tests | `state_api` | tests/builds |
| AC-3 | UI/PWA | Design/story gates and authenticated client/admin/PWA proof | `ui` | commands/screenshots |
| AC-4 | Wallet/passkey | EOA, WalletConnect, passkey, chain switch, simulation and local write proof | `state_api` | tests/browser/runtime |
| AC-5 | Contracts/indexer | EAS contract proof plus indexer generation, GraphQL and Docker equivalence | `contracts`, `state_api` | commands/query comparison |
| AC-6 | QA review | Full functional journey and regression review | `qa_pass_1` | handoff |
| AC-7 | Final certification | Ship gate plus agent/docs/runtime/browser proof | `qa_pass_2` | final report |

## Test Strategy

- Unit: existing and new regression tests for source-adapting major migrations.
- Integration: package tests/builds, offline persistence, wallet/passkey, EAS, and indexer GraphQL.
- E2E / Playwright: clean-room route/PWA checks; never substitute these for authenticated local QA.
- Manual checks: authenticated Brave for visible, wallet, passkey, installed-PWA, and admin behavior.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/dependency-modernization-2026`
- Re-run targeted validation and close the loop on remaining defects
