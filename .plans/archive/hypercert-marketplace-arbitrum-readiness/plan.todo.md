# Hypercert Marketplace Arbitrum Readiness Plan

**Feature Slug**: `hypercert-marketplace-arbitrum-readiness`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-05-02`
**Last Updated**: `2026-05-10`
**Linked follow-up**: `signal-pool-yield-wiring`
**Target**: unset pending operator window; once chosen, update this file and `status.json.workflow.target_date`.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Create a new active hub instead of reopening `signal-pool-yield-wiring` | The prior hub's contracts lane is complete; this is a post-migration marketplace readiness and UX follow-up. |
| 2 | Start with `contracts` only | Backend/operator readiness is the gate for shared state and UI truth. |
| 3 | Treat Hypercert package-derived addresses as operator-confirm candidates | Avoid inventing protocol addresses while giving operators a concrete source to verify before broadcast. |
| 4 | Do not auto-expand indexer config blindly | Missing deployed addresses are not enough; Envio needs contract definitions, schema, handlers, and codegen proof. |
| 5 | Carry a full admin UX pass | Marketplace readiness must be visible from backend to frontend, not only in scripts. |
| 6 | Contracts lane must resolve enable-now stalls before completion | A live unconfigured, unpaused adapter cannot remain as an implicit risk if address confirmation or broadcast approval stalls. |
| 7 | Narrow indexer verifier scope in this hub | Full deployed-module indexing is deferred unless promoted into a named follow-up hub before contracts completion. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify existing repo patterns: deployment JSON source of truth, root package script wrappers, shared hooks, admin `Admin*` wrappers, plan-hub TDD proof
- [x] List human judgment points before implementation
- [x] Define out-of-scope items
- [x] Choose lightest honest validation commands per lane

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Arbitrum marketplace addresses are explicit and operator-confirmed before use | `contracts` | Add deployment fields and script-side source validation | Done; post-broadcast direct JSON-RPC evidence recorded |
| Operators can inspect and dry-run readiness without broadcast | `contracts` | Add `contracts:marketplace:status:arbitrum` and dry-run configure script | Done |
| Broadcast path is package-scripted and approval-gated | `contracts` | Add `contracts:marketplace:configure:arbitrum` wrapper, documented as operator-only | Done; Codex did not broadcast |
| Enable-now stall has a safe fallback | `contracts` | Configure now, pause/disable with operator approval, or record an accepted-risk blocker before lane completion | Resolved by operator broadcast; old blocked state was stale |
| Post-deploy verification proves adapter/module/exchange/minter/strategy state | `contracts` | Harden `post-deploy-verify.ts` with deterministic checks including paused, owner, and authorized-module checks | Done via direct JSON-RPC evidence; local cast/status false-zero bug is a follow-up |
| Indexer drift is handled intentionally | `contracts` | Narrow verifier scope to currently defined/indexed contracts; create/link a named follow-up hub if full expansion is needed | Done |
| Shared marketplace state fails closed | `state_api` | Add readiness helper tests and hook guards | Done; create, batch, cancel, approval, and signing paths guard on shared readiness |
| Admin marketplace UX covers all readiness states | `ui` | Add tests/stories and restrained operator UI states | Done; gate now consumes shared `getMarketplaceReadiness`, state matrix covered by tests + stories |
| QA confirms design, i18n, and regression safety | `qa_pass_1`, `qa_pass_2` | Sequential review with handoff evidence | `qa_pass_1` passed (UX/design/i18n/copy/no-claims); `qa_pass_2` stays blocked because branch trigger `claude/qa-pass-1/...` does not exist under the operator branch lock |

## TDD / Proof Order

- [x] `contracts` RED: failing script/verifier tests or fixtures prove zero exchange/minter, module/adapter minter mismatch, paused adapter, unexpected owner, false authorized module, wrong exchange transfer manager/strategy, and unsafe indexer expectations are caught.
- [x] `contracts` GREEN: minimal script/verifier/config behavior passes, then record proof with `node scripts/harness/plan-hub.mjs record-tdd --feature hypercert-marketplace-arbitrum-readiness --lane contracts ...`.
- [x] `state_api` RED: shared tests prove Arbitrum marketplace addresses resolve nonzero only when declared, readiness helpers fail closed, and listing/cancel/approval hooks do not proceed with missing config.
- [x] `state_api` GREEN: minimal shared helpers/hook guards pass, then record proof with `record-tdd`.
- [x] `ui` RED: admin tests/stories prove unavailable, needs-approval, ready, pending, success, and failure states before UI changes.
- [x] `ui` GREEN: minimal admin/client UX updates pass, Storybook/browser evidence is recorded, then record proof with `record-tdd`.
- [x] Use `proof_limit` only for live RPC or broadcast-adjacent checks that cannot honestly have deterministic RED proof; record fallback command and evidence in the lane handoff.

## Lane Checklists

### Contracts (`codex/contracts/hypercert-marketplace-arbitrum-readiness`)

- [x] Add tests/fixtures for verifier and script behavior before production code changes.
- [x] Add Arbitrum deployment artifact fields only after operator-confirm candidates are verified against the pinned Hypercert packages and live bytecode.
- [x] Add proposed root scripts:
  - `contracts:marketplace:status:arbitrum`
  - `contracts:marketplace:configure:dry:arbitrum`
  - `contracts:marketplace:configure:arbitrum`
- [x] Root wrappers must follow the existing Arbitrum operator pattern: `APP_ENV=development`, root varlock, `FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer`, and an inner `packages/contracts` package script. Package scripts own implementation details.
- [x] Script reads deployment JSON, refuses zero addresses, verifies bytecode, exchange `transferManager()`, and strategy id `1`.
- [x] Script/verifier fails if adapter is paused, adapter owner is unexpected, module owner is unexpected when an expected owner is declared, or authorized module state is false.
- [x] Script prepares only needed owner calls:
  - `HypercertMarketplaceAdapter.setExchange(hypercertExchange)`
  - `HypercertMarketplaceAdapter.setHypercertMinter(hypercertMinter)`
  - `HypercertsModule.setHypercertMinter(hypercertMinter)`
  - `HypercertMarketplaceAdapter.setAuthorizedModule(hypercertsModule, true)` only if false
- [x] Do not touch `YieldSplitter.setHypercertMarketplace`; current on-chain state already points at the adapter.
- [x] If canonical address confirmation or broadcast approval stalls, do not mark contracts complete. Choose one fallback and record it in this hub: configure now, pause/disable with operator approval, or add a blocker naming the accepted live risk and decision owner.
- [x] Harden `contracts:verify:post-deploy:arbitrum`.
- [x] Implement the indexer verifier policy for this hub: narrow checks to contracts currently defined/indexed by Envio. If full deployed-module expansion is required, create/link `.plans/backlog/indexer-deployed-modules-expansion/` before contracts completion.
- [x] Write `handoffs/codex-contracts.md`.

### State / API (`codex/state-api/hypercert-marketplace-arbitrum-readiness`)

- [x] Start only after `contracts` is complete.
- [x] Add shared readiness helpers that use deployment artifacts as source of truth.
- [x] Ensure approval and listing hooks fail closed with missing/incomplete marketplace config.
- [x] Preserve query invalidation semantics for marketplace orders, approvals, and trade history.
- [x] Keep hooks in shared; do not duplicate logic in admin/client.
- [x] Write `handoffs/codex-state-api.md`.

### UI (`claude/ui/hypercert-marketplace-arbitrum-readiness`)

- [x] Dependencies from `contracts` and `state_api` are complete; UI is ready to start, but this lane has not started.
- [x] Keep admin marketplace surfaces as a restrained operator command surface.
- [x] Use existing `Admin*` wrappers and shared Storybook-backed foundations.
- [x] Cover unavailable, needs approval, ready, pending, success, and failure states.
- [x] Add every user-facing string to `en`, `es`, and `pt`.
- [x] Include Storybook/browser evidence for visual states.
- [x] Run `bun run lint:vocab`, `bun run check:design-generated`, and `bun run check:design-tokens` when UI/design files move. (`lint:vocab` clean; `check:design-tokens` and `check:design-generated` flag pre-existing client-side drift unrelated to this lane — see handoff "Proof Limits".)
- [x] Write `handoffs/claude-ui.md`.

### QA Pass 1 (`claude/qa-pass-1/hypercert-marketplace-arbitrum-readiness`)

- [x] Review UI behavior, operator clarity, i18n, visual states, and missing requirements.
- [x] Confirm no UI claims marketplace completion unless backed by live readiness evidence.
- [x] Verify acceptance criteria from `eval.md`.
- [x] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/hypercert-marketplace-arbitrum-readiness`)

- [ ] Start only after `qa_pass_1` is passed and branch trigger exists.
- [ ] Re-run targeted contracts/shared/admin validation and `node scripts/harness/plan-hub.mjs validate`.
- [ ] Confirm no broadcast was performed unless explicitly approved and recorded.
- [ ] Confirm post-transaction verification evidence exists before closing the hub.
- [ ] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- Plan edits: `node scripts/harness/plan-hub.mjs validate`
- Contracts lane: targeted script/verifier tests, `bun run contracts:marketplace:status:arbitrum`, `bun run contracts:marketplace:configure:dry:arbitrum`, then `bun run contracts:verify:post-deploy:arbitrum` after approved transaction
- Shared lane: targeted `bun run test -- <shared marketplace/readiness tests>`
- UI lane: targeted admin tests/stories plus design checks when UI/design files move
- QA closeout: targeted regression commands plus `node scripts/harness/plan-hub.mjs validate`
