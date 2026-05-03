# Public Browser Editorial UI Evaluation Plan

## Release Gates

1. Browser `/` and installed PWA `/` preserve their intended split.
2. `/landing` redirects to `/`.
3. Public header uses `Install App`, not wallet connect.
4. Homepage renders the locked garden-poster layout and contextual public journey.
5. Homepage closes with `Get In Touch`, email subscription, and Google appointment scheduling.
6. `/gardens`, `/gardens/:id`, `/impact`, `/fund`, and `/actions` match their page contracts.
7. `/fund` presents `Donate` and `Endow` first, then `Card` or `Wallet` as payment methods.
8. Direct-card funding is only claimed when the thirdweb spike proves the actual Garden funding path onchain.
9. Public funding remains support-only and wallet connect is deferred to the wallet-required step.
10. Unproven card methods are hidden by default.
11. Endow copy uses risk-safe "designed to preserve" language.
12. `state_api` migrates the Agent HTTP API to Hono before adding public subscription, funding-intent,
    or thirdweb webhook routes.
13. Public browser calls use existing `VITE_API_BASE_URL`; no `VITE_AGENT_PUBLIC_API_URL` is added
    unless a later deployment decision requires it.
14. Direct-card reconciliation uses quoted/minimum destination amount matching and confirmed onchain
    funding, not exact quote matching or provider success alone.
15. Browser-facing Agent routes use `/public/*`, and thirdweb provider callbacks use
    `/webhooks/thirdweb`.
16. Hono migration preserves existing Agent routes, webhook behavior, startup modes, shutdown, and
    `/api/*` bearer auth semantics.
17. Donate/support copy does not imply tax deductibility, charitable status, nonprofit status, or legal
    receipt.
18. Unavailable metrics are hidden, not faked.
19. New public strings have `en`, `es`, and `pt` coverage.
20. Browser screenshots cover 375, 768, 1024, and 1440.
21. Receipt URLs use `/fund?intent=<id>#receiptToken=<token>` and the API receives receipt tokens only
    through `X-GG-Receipt-Token`.
22. Card funding success is confirmed by Agent-side viem receipt/log polling; indexer evidence is
    secondary for v1.
23. Card FundingIntent create is idempotent by `clientRequestId`, and multi-transaction card flows store
    transaction attempts separately from the canonical `fundingTxHash`.
24. Receipt-bearing funding responses use `Cache-Control: no-store` and `Pragma: no-cache`.

## Acceptance Checks

| ID | Check | Owner | Evidence |
| --- | --- | --- | --- |
| AC-1 | Plan hub validates, `state_api` is ready, and `ui` is manually blocked until the contract-stability checklist is complete and explicitly unblocked | `qa_pass_2` | `plan-hub validate`, `plan-hub list --agent codex --lane state_api --json`, UI lane status review, and checklist review |
| AC-2 | Browser `/` renders editorial homepage under `PublicShell` | `qa_pass_1` | Storybook/browser screenshot |
| AC-3 | Installed PWA `/` routes to `/home` | `qa_pass_2` | Client route test |
| AC-4 | `/landing` redirects to `/` | `qa_pass_2` | Client route test |
| AC-5 | Header CTA uses install guidance and no wallet CTA | `qa_pass_1` | Story/test screenshot |
| AC-6 | Homepage curation falls back to recent active Gardens | `qa_pass_2` | Unit/component test |
| AC-7 | `/fund?garden=...` resolves exact id/address first, accepts only unique slug matches through `publicGardenHelpers.deriveSlug`, and stale, missing, zero-match, or ambiguous references fall back to normal Fund with a localized non-blocking message | `qa_pass_2` | Client route test plus screenshot |
| AC-8 | Public dialogs are source-anchored, labelled, focus-safe, and readable on desktop/mobile | `qa_pass_1` | Screenshots and interaction notes |
| AC-9 | No browser bottom `AppBar` appears on public routes | `qa_pass_2` | Route/shell test |
| AC-10 | Design and vocab gates pass | `qa_pass_2` | `check:design-*`, `lint:vocab` |
| AC-11 | Homepage `Get In Touch` closing supports Luma-backed subscription and Google appointment scheduling without fake success states | `qa_pass_1` / `qa_pass_2` | Screenshot plus Agent API/component test |
| AC-12 | Reown remains the wallet funding path and thirdweb is scoped to direct-card funding | `qa_pass_2` | Code/config review |
| AC-13 | Direct-card funding has card-only `FundingIntent` tracking, `destinationAddress` plus `availabilityKey` drift checks, destination-specific reconciliation, and quoted/minimum destination amount matching before success copy | `qa_pass_2` | Agent API unit/integration test or spike evidence |
| AC-14 | `/fund` `Donate`/`Endow` choice is clear on desktop/mobile and does not show duplicate wallet prompts | `qa_pass_1` | Screenshots |
| AC-15 | thirdweb spike proves Cookie Jar / `Donate` before Vault / `Endow` | `qa_pass_2` | Spike notes or tests |
| AC-16 | Agent API migrates to Hono and separates public rate-limited routes, provider webhook routes, and bearer-protected internal/admin routes | `qa_pass_2` | Hono route tests/code review |
| AC-17 | Card `Endow` uses thirdweb embedded-wallet receiver/recovery and does not imply one-time donation semantics | `qa_pass_1` / `qa_pass_2` | Screenshot plus spike/test evidence |
| AC-18 | `/impact` uses a public assessment/evidence data contract with visitor-safe fields, deterministic latest-activity Garden selection, finite shared-EAS local slicing limits, explicit per-Garden overfetch behavior, partial-data/source-limit states, and EAS-failure states for v1 | `qa_pass_2` | Hook/component test |
| AC-19 | `PublicFundingAvailability` controls funding method visibility through shared public reads, explicit `reasonCode` enum values, provider proof registry state, state/params semantics, and hidden-by-default card methods | `qa_pass_2` | State/API tests plus `/fund` screenshot |
| AC-20 | thirdweb proofs cover ERC-20 approval plus funding transaction sequence, not only top-up or generic widget success | `qa_pass_2` | Spike notes or tests |
| AC-21 | Card `Endow` completion shows receipt, receiver wallet, recovery explanation, and Install/Open App management CTA | `qa_pass_1` / `qa_pass_2` | Screenshot plus state evidence |
| AC-22 | Hono Agent API/env plan uses existing `VITE_API_BASE_URL`, defines public/server-only config, origin controls, payload caps, route-specific rate-limit identity keys and thresholds, trusted-proxy/header rules, consent audit, safe errors, and PII handling | `qa_pass_2` | Agent API tests/code review |
| AC-23 | `/impact` hook covers deterministic Garden source ordering, newest-first sorting within the fetched slice, finite local page/offset slicing, empty states, `partialData`, `sourceLimitReached`, and EAS failure states | `qa_pass_2` | Hook tests |
| AC-24 | Source morphs use unique transition names per item or fall back to simple fades | `qa_pass_1` | Screenshot/browser review |
| AC-25 | Hono route tests replace Fastify inject for new Agent route coverage | `qa_pass_2` | Agent API test review |
| AC-26 | Public Agent route paths are `POST /public/subscribe`, `POST /public/funding-intents`, `GET /public/funding-intents/:id`, and `POST /webhooks/thirdweb` | `qa_pass_2` | Agent API tests/code review |
| AC-27 | FundingIntent storage has SQLite migration/versioning, `funding_intents`, and event/history storage with unique lookup constraints | `qa_pass_2` | Agent storage tests/code review |
| AC-28 | Donate/support copy avoids tax-deductible, charitable-status, nonprofit-status, and legal-receipt claims | `qa_pass_1` / `qa_pass_2` | Screenshot/copy review |
| AC-29 | UI lane starts only after `status.json.contract_stability_checklist` required items are complete and the explicit plan-hub unblock operation moves `ui` to `ready`, not after all card methods are live | `qa_pass_2` | Plan/status review |
| AC-30 | Public funding receipt URLs use `/fund?intent=<id>#receiptToken=<token>`, API reads require `X-GG-Receipt-Token`, query/body tokens are rejected, root pre-pageview scrub and `usePageView` hash redaction prevent analytics leaks, and responses are redacted public-safe fields | `qa_pass_2` | Agent/client route tests |
| AC-31 | Public route contracts have TypeScript-style request/response shapes and stable safe-error envelopes from server-safe `@green-goods/shared/public-contracts`, with package exports/resolution and seeded fixtures under the plan hub artifacts area | `qa_pass_2` | Plan/type/test review |
| AC-32 | Wallet funding remains Reown/wagmi client-side and does not create Agent `FundingIntent` records in this pass | `qa_pass_2` | Code/config review |
| AC-33 | Luma subscription returns honest `subscribed`, confirmed `already_subscribed`, and failure states without fake success | `qa_pass_2` | Agent route tests |
| AC-34 | Funding intent creation never subscribes visitors to updates; receipt update signup calls `POST /public/subscribe` separately with consent | `qa_pass_2` | Agent route/component tests |
| AC-35 | Card funding success is confirmed by Agent viem receipt/log polling, handles mismatch/timeout/expiry, and does not depend on indexer freshness | `qa_pass_2` | Agent funding tests |
| AC-36 | Agent viem confirmation RPC is resolved by a server-only helper from existing chain-specific envs before shared fallback, then injected into `initBlockchain` and the confirmation client without adding a new public API base URL | `qa_pass_2` | Agent config/test review |
| AC-37 | Public funding intent creation exposes only an allowlisted JSON-safe checkout payload, with durable provider ids, raw provider payloads, webhook payloads, receipt tokens, and unknown nested checkout fields rejected/redacted | `qa_pass_2` | Agent route contract test |
| AC-38 | `PublicFundingAvailability.reasonCode` excludes amount min/max failures; amount-specific failures use `PublicApiError.errorCode` values `amount_below_min` / `amount_above_max` with safe `fieldErrors.amountUsd` after an amount is selected | `qa_pass_2` | Contract and UI validation tests |
| AC-39 | Abandoned `started` and `pending_provider` card intents expire at provider expiry or 30-minute fallback through read-time reconciliation plus scheduled sweep | `qa_pass_2` | Agent funding tests |
| AC-40 | FundingIntent creation uses `clientRequestId` idempotency with the exact normalized fingerprint fields, exact retries return the existing checkout, and mismatched retries return safe `idempotency_conflict` without creating duplicate intents | `qa_pass_2` | Agent route/storage tests |
| AC-41 | Multi-transaction card flows store allowance reset, approval, funding, and share-verification attempts separately, and only a confirmed funding/deposit attempt becomes `fundingTxHash` | `qa_pass_2` | Agent funding tests |
| AC-42 | Receipt-bearing create/read responses include `Cache-Control: no-store` and `Pragma: no-cache` | `qa_pass_2` | Agent route tests |
| AC-43 | Webhook rate limits include pre-verification IP/origin/provider-route throttling and post-verification provider throttling; event ids are replay/idempotency data, not the sole rate-limit bucket | `qa_pass_2` | Agent route tests |
| AC-44 | Canonical `availabilityKey` is produced by the shared v1 builder with normalized addresses/enums/chain/token/provider and recomputed server-side | `qa_pass_2` | Shared contract and Agent create tests |
| AC-45 | Late matching onchain funding after expiry moves only to `funded_late` when intent/provider session/Garden/destination/receiver/token/chain/min amount all match | `qa_pass_2` | Agent reconciliation tests |

## Validation Commands

Plan truth:

```bash
node scripts/harness/plan-hub.mjs validate
node scripts/harness/plan-hub.mjs list --agent codex --lane state_api --json
node scripts/harness/plan-hub.mjs list --agent claude --lane ui --json
```

Design:

```bash
bun run check:design-md
bun run check:design-generated
bun run check:design-tokens
bun run lint:vocab
```

Client:

```bash
bun run test:client
bun run format:check && bun lint
VITE_CHAIN_ID=11155111 bun run build:client
```

Screenshot/story proof:

- `/`
- `/gardens`
- `/gardens/:id`
- `/impact`
- `/fund`
- `/actions`
- install sheet/module
- homepage get-in-touch closing
- `/fund` Donate/Endow selector
- `/fund` Card/Wallet payment selector
- Donate/support copy guard
- hidden-by-default unproven card methods
- intentionally curated coming-soon card states, if configured
- stale, missing, zero-match, or ambiguous `/fund?garden=...` non-blocking message
- card Endow receipt/recovery/app-management handoff
- risk-safe Endow copy
- source dialogs
- viewports: 375, 768, 1024, 1440

State/API proof:

- Hono route tests for public browser routes, provider webhooks, and bearer-protected internal/admin
  routes; do not use Fastify inject for new Agent route tests
- Hono compatibility tests for `/health`, `/ready`, `/webhook/telegram`, platform webhook allowlist,
  `/api/feedback`, `/api/notify`, polling/webhook startup behavior, graceful shutdown, and `/api/*`
  bearer auth
- Public route tests for `POST /public/subscribe`, `POST /public/funding-intents`,
  `GET /public/funding-intents/:id`, and `POST /webhooks/thirdweb`
- Public route contract tests for TypeScript-style request/response shapes and safe error envelopes
- Public route contract tests import the shared contract surface from `@green-goods/shared/public-contracts`
  and exercise seeded fixtures from this plan hub's `artifacts/fixtures` area or package-local copies.
- Public route contract tests prove `packages/shared/package.json` exports and client TypeScript/Vite
  resolution support `@green-goods/shared/public-contracts`.
- Public-contract subpath tests or lint checks prove no React, Vite `import.meta`, browser globals,
  styles, providers, hooks, or side effects are imported by Agent.
- Receipt-token validation and public receipt redaction tests for `GET /public/funding-intents/:id`;
  query/body tokens are rejected and only `X-GG-Receipt-Token` is accepted.
- Receipt-bearing create/read route tests assert `Cache-Control: no-store` and `Pragma: no-cache`.
- Client receipt tests prove `#receiptToken` is extracted by root/equivalent pre-pageview scrub, removed
  with `history.replaceState` before initial analytics, and never emitted through `page_view.hash`.
- Shared analytics tests prove `usePageView` redacts sensitive hash keys including `receiptToken`.
- Funding creation tests prove no update-subscription field is accepted and no implicit subscription
  occurs; receipt update signup calls `POST /public/subscribe` separately.
- Public funding availability tests for `live`, `hidden`, `disabled`, curated `comingSoon`, and
  explicit `reasonCode` enum / params / state-semantics localization handoff, including provider proof
  registry absent-as-hidden behavior and exact live tuple matching.
- FundingIntent SQLite migration/versioning tests for `funding_intents`, intent event/history storage,
  and unique provider session/payment/event/tx hash lookups
- Agent API tests for public route validation, CORS/origin allowlist, payload caps, rate limits,
  trusted-proxy/header behavior, safe errors, consent audit, and PII handling
- Public route rate-limit tests cover the locked thresholds: subscribe `5/hour`, funding create
  `10/10min`, receipt read `60/10min`, webhook pre-verification `300/min`, and webhook
  post-verification `300/min`.
- Availability tests prove amount min/max metadata is exposed for UI controls, while
  `amount_below_min` / `amount_above_max` are part of `PublicApiErrorCode` and are returned only by
  selected-amount quote/create validation with safe `fieldErrors.amountUsd`.
- Luma import success/failure tests for single opt-in signup, confirmed already-subscribed behavior, and
  no fake success on uncertain provider state
- funding intent lifecycle tests for started, pending provider, pending onchain, funded, failed,
  expired, funded_late, and refunded
- FundingIntent create tests reject non-card payment methods for v1
- FundingIntent create tests require `destinationAddress`, canonical `availabilityKey`, and
  `clientRequestId`, recompute the exact tuple server-side, return the existing checkout on exact retry,
  and reject availability/proof drift, non-live card rails, or idempotency conflicts.
- FundingIntent create tests cover the exact normalized idempotency fingerprint fields, including
  lowercased addresses, canonical decimal amount, decimal-string chain id, canonical `availabilityKey`,
  provider, and normalized `payerEmail` hash when present.
- FundingIntent create response tests reject durable provider ids, raw provider payloads, webhook payloads,
  receipt tokens, and unknown nested checkout fields inside the allowlisted checkout payload.
- FundingIntent receipt tests prove receipt-token verifier storage, quote expiry, public-safe receipt
  output, and redaction of payer email/provider/internal event fields
- FundingIntent expiry tests cover `started` and `pending_provider` provider-expiry, 30-minute fallback
  expiry, read-time reconciliation, scheduled sweep, and late onchain success moving
  `expired -> funded_late` only with a matching funding transaction.
- FundingIntent transaction sequence tests cover allowance reset, approval, funding/deposit, and
  share-verification attempts; only the confirmed funding/deposit attempt becomes `fundingTxHash`.
- FundingIntent uniqueness and lookup tests for intent id, provider session id, provider payment id,
  webhook event id, submitted transaction hash, and canonical `fundingTxHash`
- thirdweb purchase/custom data reconciliation tests using `FundingIntent.id`
- thirdweb webhook signature, raw-body, idempotency, replay, out-of-order, terminal-state, and
  `minAssetAmount` destination matching tests
- Agent viem confirmation tests for provider-submitted transaction, expected Cookie Jar/Vault log
  decoding, event/log mismatch, confirmation timeout, failure, and expiry
- destination-specific Cookie Jar Donate and Vault Endow reconciliation tests
- thirdweb spike evidence for Cookie Jar allowance/approval/deposit
- thirdweb spike evidence for Vault allowance reset if needed, approval, preview/slippage, deposit,
  and Vault-share ownership
- public assessment/evidence hook tests for visitor-safe fields, deterministic latest-activity Garden
  source ordering, sorting within fetched slice, local page/offset slicing, empty states, finite
  shared-EAS limits, `partialData`, `sourceLimitReached`, and EAS failure states
- `/fund?garden` tests use or extract `publicGardenHelpers.deriveSlug` and cover case-insensitivity,
  punctuation normalization, empty-name address fallback, stale references, and slug collisions.
