# Codex QA Pass 2 Handoff - Public Browser Editorial UI

## Goal

Run final repo checks and consistency review after visual QA completes.

## Scope

- Route tests:
  - browser `/` renders editorial homepage
  - installed PWA `/` routes to `/home`
  - `/landing` redirects to `/`
  - `/fund?garden=...` resolves exact id/address first, accepts only unique slug matches, and shows a
    localized non-blocking message for stale, missing, zero-match, or ambiguous references
  - `/fund` `Donate`/`Endow` funding choice
  - `/fund` card/wallet payment choice after intent
  - no browser bottom `AppBar`
- Agent/state tests:
  - Agent HTTP server migration to Hono before public subscription, funding-intent, and thirdweb
    webhook routes
  - Hono request tests for public browser routes, provider webhooks, and bearer-protected internal/
    admin routes; no Fastify inject for new route coverage
  - Hono migration preserves `/health`, `/ready`, `/webhook/telegram`, platform webhook allowlist,
    `/api/feedback`, `/api/notify`, polling/webhook startup modes, graceful shutdown, and `/api/*`
    bearer auth semantics
  - concrete route tests cover `POST /public/subscribe`, `POST /public/funding-intents`,
    `GET /public/funding-intents/:id`, and `POST /webhooks/thirdweb`
  - public route contracts have TypeScript-style request/response shapes and stable safe-error envelopes
  - public route/type contracts live in server-safe `@green-goods/shared/public-contracts`, with seeded
    handoff fixtures under this plan hub's `artifacts/fixtures` area or package-local copies derived
    from them
  - `packages/shared/package.json` exports and client TypeScript/Vite resolution make
    `@green-goods/shared/public-contracts` importable where needed
  - shared public-contracts subpath has no React, Vite `import.meta`, browser globals, styles,
    providers, hooks, or side effects imported by Agent
  - `POST /public/funding-intents` returns receipt URLs as `/fund?intent=<id>#receiptToken=<token>`
  - `GET /public/funding-intents/:id` requires `X-GG-Receipt-Token` and rejects receipt tokens in query
    params or JSON bodies
  - public funding receipt responses redact payer email, provider ids, internal event history, raw failure
    details, webhook payloads, and server-only reconciliation metadata
  - receipt-bearing create/read responses include `Cache-Control: no-store` and `Pragma: no-cache`
  - receipt-token fragments are extracted and removed with `history.replaceState` by a root/equivalent
    pre-pageview scrub before initial analytics or receipt mount
  - `usePageView` redacts sensitive hash keys including `receiptToken`, and no token is emitted through
    `page_view.hash`
  - public funding-intent creation responses expose only allowlisted JSON-safe checkout payload data and
    never expose durable provider ids, raw provider/webhook payloads, receipt tokens, or unknown nested
    checkout payload fields
  - funding intent creation never subscribes visitors to updates; receipt update signup calls
    `POST /public/subscribe` separately with explicit consent
  - public route validation and route-specific rate-limit identity keys
  - public rate-limit helper hashes email/intent key material and ignores spoofed proxy headers unless
    trusted-proxy config is set
  - public rate-limit thresholds are `5/hour` subscribe, `10/10min` funding create, `60/10min` receipt
    read, webhook pre-verification `300/min`, and webhook post-verification `300/min`
  - public CORS/origin allowlist, payload caps, safe errors, consent audit, and PII handling
  - Luma single opt-in import success/failure
  - root `.env.schema` and generated env typings use existing `VITE_API_BASE_URL` for public Agent
    calls; no `VITE_AGENT_PUBLIC_API_URL` unless deployment is explicitly re-scoped
  - Agent viem confirmation RPC resolves from existing chain-specific envs before shared fallback, then
    gets injected into `initBlockchain` and the confirmation client
  - `PublicFundingAvailability` live/hidden/disabled/curated-coming-soon states plus explicit
    `reasonCode` enum/params/state semantics
  - `PublicFundingAvailability.reasonCode` excludes amount min/max failures; `amount_below_min` and
    `amount_above_max` are explicit `PublicApiErrorCode` values used only in selected-amount quote/create
    validation
  - localized copy coverage for each availability `reasonCode`
  - funding intent lifecycle states, including `funded_late`, and explicit status transition table
  - FundingIntent creation is card-only for v1; wallet funding remains Reown/wagmi client-side without
    Agent receipt tracking
  - FundingIntent SQLite migration/versioning, `funding_intents`, and `funding_intent_events` or
    equivalent history storage
  - funding intent uniqueness and lookup by intent id, provider session id, provider payment id,
    provider webhook event id, submitted transaction hash, and canonical `fundingTxHash`
  - receipt-token verifier storage, quote expiry, and public-safe receipt output
  - receipt-token transport uses URL fragment to client header only, with no raw token logging or
    analytics capture where testable
  - thirdweb purchase/custom data includes `FundingIntent.id` for reconciliation
  - thirdweb webhook signature/raw-body verification, idempotency, replay, out-of-order updates, and
    terminal-state precedence
  - card reconciliation stores quoted/minimum destination amount fields and requires destination
    amount greater than or equal to `minAssetAmount`
  - funding-intent create requires `destinationAddress`, canonical `availabilityKey`, and
    `clientRequestId`; Agent recomputes the exact availability/proof tuple, returns the existing checkout
    on exact retry, and rejects drift, non-live card rails, or idempotency conflicts
  - idempotency tests cover the pinned normalized fingerprint fields, including lowercased addresses,
    canonical amount, decimal-string chain id, provider, and normalized payer-email hash when present
  - abandoned `started` and `pending_provider` card intents expire at provider expiry or the 30-minute
    fallback, through read-time reconciliation plus scheduled sweep
  - late matching onchain success after expiry moves only to `funded_late` when intent/provider session
    and Garden/destination/receiver/token/chain/min amount match
  - multi-transaction card flows store allowance reset, approval, funding/deposit, and share-verification
    attempts separately; only the confirmed funding/deposit hash becomes `fundingTxHash`
  - Agent-side viem receipt/log polling confirms provider-submitted transactions and covers mismatch,
    timeout, failure, and expiry cases
  - destination-specific Cookie Jar Donate and Vault Endow reconciliation; provider success alone never
    marks an intent funded
  - thirdweb spike evidence covers Cookie Jar allowance/approval/deposit and Vault allowance reset if
    needed, approval, preview/slippage, deposit, and share ownership
  - public assessment/evidence hook visitor-safe fields, sorting within the fetched slice, local
    page/offset slicing, loading/empty/partial-data/source-limit states, and EAS failure behavior
  - `/impact` v1 uses shared EAS reads with finite client-side slicing; Agent/indexer aggregation is
    only the documented later scale path
  - `/impact` v1 uses default page size `12`, candidate Gardens sorted by latest public activity desc
    then stable id/address asc, max `50` Gardens, max `100` assessment/evidence records before slicing,
    and `sourceLimitReached` when either cap is hit before the available candidate set is exhausted
  - `/impact` v1 explicitly covers per-Garden overfetch behavior: prefer finite shared EAS reads when
    practical, otherwise document overfetch as an accepted v1 limitation before the local record cap
  - `/fund?garden` uses or extracts `publicGardenHelpers.deriveSlug` and tests case-insensitivity,
    punctuation normalization, empty-name address fallback, stale references, and slug collisions
- Plan/design consistency:
  - `.plans/active/public-read-side-journal/plan.todo.md`
  - `packages/client/DESIGN.browser.md`
  - implemented route behavior
- Funding rails consistency:
  - Reown AppKit remains the wallet funding path
  - thirdweb is scoped to direct-card funding
  - direct-card success states require canonical funding/deposit onchain confirmation and minimum destination
    amount matching
  - Cookie Jar / `Donate` thirdweb proof precedes Vault / `Endow`
  - card `Endow` uses thirdweb embedded-wallet receiver/recovery before it is shown as live
  - card `Endow` completion routes management to Install/Open App through receipt/recovery handoff
  - unproven card methods are hidden by default
  - card rail visibility comes from the code-owned provider proof registry; absent proof entries are
    hidden, `comingSoon` is intentionally curated, and `live` requires exact tuple proof evidence
  - `PublicFundingAvailability` is computed from shared public reads where possible, not from an
    Agent general-read aggregation layer
  - Donate/support copy avoids tax-deductible, charitable-status, nonprofit-status, and legal-receipt
    claims
  - Endow copy uses "designed to preserve" language plus short risk copy
  - provider-specific ids stay behind the `FundingIntent`/adapter boundary
  - Agent env/config variables have planned public/server-only boundaries, with public browser calls
    using existing `VITE_API_BASE_URL`
  - FundingIntent and thirdweb/Luma API work lives in `packages/agent`
  - UI unblock criteria are satisfied before moving UI from blocked to ready:
    `status.json.contract_stability_checklist` complete with stable route paths, public types, seeded
    fixtures, `/fund?garden`, availability reason semantics, contact endpoint, public receipt shape,
    provider proof registry, and impact hook shape
  - UI unblock is performed only with the explicit plan-hub lane command after every required checklist
    item is `complete`; `manual_blocked` remains true until that operation is recorded
- Final gates:
  - `bun run test:client`
  - `bun run --cwd packages/agent test && bun run --cwd packages/agent typecheck` if Agent API changes
  - `bun run format:check && bun lint`
  - `VITE_CHAIN_ID=11155111 bun run build:client`

## Notes

If unrelated dirty worktree changes prevent broad gates from being trustworthy, report the proof
limit and run the narrowest honest client/design checks for the touched surface.
