# Hypercert Marketplace Arbitrum Readiness Evaluation Plan

## Release Gates

1. Correctness: adapter, module, exchange, minter, transfer manager, strategy, paused state, owner state, and authorized module state are verified against deployment artifacts after operator-approved configuration.
2. Operator safety: dry-run proves exact owner calls and refuses zero, missing-code, transfer-manager, or strategy mismatches before broadcast.
3. Usability: admin marketplace surfaces clearly distinguish unavailable, approval-required, ready, pending, success, and failure states.
4. Regression safety: shared marketplace hooks fail closed when config is missing and keep existing order/approval/trade query behavior.
5. Evidence quality: each implementation lane records RED/GREEN proof or an explicit proof limit in its handoff and `status.json`.
6. Design quality: admin UI remains a restrained Warm Earth operator surface using existing wrappers, localized copy, and design validation.
7. Indexer integrity: this hub narrows verifier scope to contracts currently defined/indexed by Envio; full deployed-module indexing requires a named follow-up hub with codegen/build proof before contracts completion.
8. Stalled rollout safety: if enable-now stalls, contracts cannot complete until the hub records configure-now, operator-approved pause/disable, or an accepted-risk blocker.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | On-chain marketplace readiness | Status script reads adapter/module/owner/authorized module/exchange/minter without broadcast | `contracts` | `handoffs/codex-contracts.md` |
| AC-2 | Operator configuration | Dry-run script prints exact required owner calls, follows the root varlock/`green-goods-deployer` Arbitrum wrapper pattern, and blocks unsafe address/config mismatches | `contracts` | `handoffs/codex-contracts.md` |
| AC-3 | Post-deploy verifier | `contracts:verify:post-deploy:arbitrum` verifies adapter/module/exchange/minter/transfer manager/strategy, paused state, owner state, and authorized module state after approved transaction | `contracts` | `handoffs/codex-contracts.md` |
| AC-4 | Indexer drift policy | Verifier scope is narrowed to contracts currently defined/indexed by Envio; if full expansion is needed, `.plans/backlog/indexer-deployed-modules-expansion/` is created or linked before contracts completion | `contracts` | `handoffs/codex-contracts.md` |
| AC-4a | Enable-now fallback | If address confirmation or broadcast approval stalls, contracts lane records configure-now, operator-approved pause/disable, or an accepted-risk blocker before status can complete | `contracts` | `handoffs/codex-contracts.md` |
| AC-5 | Shared contract mapping | Arbitrum marketplace fields resolve from deployment artifact and missing fields fail closed | `state_api` | `handoffs/codex-state-api.md` |
| AC-6 | Listing/approval hooks | Hooks refuse to sign/list/approve when readiness is incomplete and invalidate marketplace queries after success | `state_api` | `handoffs/codex-state-api.md` |
| AC-7 | Admin unavailable state | Hypercert marketplace UI shows setup-unavailable state without offering unsafe listing actions | `ui` | `handoffs/claude-ui.md` |
| AC-8 | Admin approval/listing states | Approval gate and listing flow cover needs-approval, ready, pending, success, and failure states | `ui` | `handoffs/claude-ui.md` |
| AC-9 | Design and i18n | New user-facing strings exist in `en`, `es`, `pt`; vocab and design-token checks pass when UI files move | `ui` | `handoffs/claude-ui.md` |
| AC-10 | UX QA | QA pass confirms operator clarity, restrained admin design, and no unsupported marketplace claims | `qa_pass_1` | `handoffs/claude-qa-pass-1.md` |
| AC-11 | Regression QA | QA pass confirms targeted validation, plan-hub state, no unauthorized broadcast, and post-transaction evidence | `qa_pass_2` | `handoffs/codex-qa-pass-2.md` |

## Test Strategy

- Contracts/unit or script tests: verifier fixtures for zero exchange/minter, module/adapter minter mismatch, paused adapter, unexpected owner, false authorized module, wrong transfer manager, wrong strategy, and indexer config expectations.
- Contracts/live proof: status and dry-run scripts may use live Arbitrum reads; record as `proof_limit` if deterministic RED cannot be produced.
- Shared tests: marketplace contract mapping, readiness helper, approval guard, listing guard, and query invalidation.
- Admin tests: component/model tests for unavailable, approval-required, ready, pending, success, and failure states.
- Storybook/browser: visual proof for admin marketplace states before UI lane completion.
- Manual checks: operator confirmation of canonical Hypercert Arbitrum addresses before any broadcast.

## QA Sequence

### Claude QA Pass 1

- Review admin UX and Storybook/browser evidence.
- Confirm no marketplace state is hidden behind vague copy.
- Confirm design principles, i18n, and banned vocabulary checks.
- Record blockers in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed and branch `claude/qa-pass-1/hypercert-marketplace-arbitrum-readiness` exists.
- Re-run targeted contracts/shared/admin validation and plan-hub validation.
- Confirm no transaction broadcast occurred without recorded approval.
- Confirm post-transaction verification exists before recommending archive/close.
