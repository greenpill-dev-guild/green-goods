# Codex State/API Handoff - Public Browser Editorial UI

## Goal

Prepare the data and route contracts needed by the public browser editorial UI without building
the UI itself.

## Scope

- Confirm public hook naming and exports use canonical vocabulary.
- Define the client-local homepage curation contract:
  - ordered featured Garden ids/addresses as canonical keys; slugs are display/routing aliases only
  - curated hero image path
  - fallback image set
  - contact closing configuration for the public Agent subscription route and Google appointment booking
    URL only; Luma calendar/tag/provider details stay Agent-only
- Add `/fund?garden=<garden-id-or-slug>` support at the state/route level:
  - resolve exact Garden id/address first
  - accept a slug only when exactly one Garden derives that slug
  - reuse or extract the existing `publicGardenHelpers.deriveSlug` normalization contract
  - return enough state for UI to spotlight/preselect the Garden
  - stale, missing, zero-match, or multiple-slug references fall back to the normal Fund page with a
    localized non-blocking message
  - test case-insensitivity, punctuation normalization, empty-name address fallback, stale references, and
    slug collisions
- Add minimal public aggregate helpers for confirmed Vault availability / depositor counts if
  existing hooks do not already cover them.
- Define `PublicFundingAvailability` for public UI consumption:
  - keyed by Garden id/address, destination type/address, funding intent, payment method, chain,
    token, and provider
  - `state`: `live`, `comingSoon`, `hidden`, or `disabled`
  - stable `reasonCode` plus optional params, min/max amount where known, destination address, and
    required proof status
  - UI owns localized user-facing availability text in `en`, `es`, and `pt`
  - shared public read helpers derive Wallet / Donate / Endow availability from current public Vault and
    Cookie Jar reads where possible
  - Agent is not the general availability read aggregator in this pass
  - card methods are hidden unless the provider proof registry marks that exact Garden/destination/
    intent/token/chain/provider as live or intentionally coming soon
  - unproven card methods are `hidden` by default
  - `comingSoon` is curated only when intentionally configured
- Add an Agent API endpoint for update subscription:
  - validate email and explicit consent
  - treat the signup as single opt-in
  - import the subscriber into Luma Calendar People
  - apply the preconfigured Green Goods tag
  - keep Luma API key, calendar id, and tag configuration server-side
  - expose honest `subscribed`, confirmed `already_subscribed`, and failure states to the client
- Lock concrete Agent route paths:
  - `POST /public/subscribe`
  - `POST /public/funding-intents`
  - `GET /public/funding-intents/:id` with required `X-GG-Receipt-Token`
  - `POST /webhooks/thirdweb`
  - keep existing bearer-protected internal/admin routes under `/api/*`
- Treat `/public/*` as unauthenticated public browser routes with origin checks, route-specific rate
  limits, payload caps, and safe client-facing errors.
- Define these public route contracts as TypeScript-style shapes before UI starts:
- Put framework-free public route/type contracts in `packages/shared/src/public-contracts` and export
  them as `@green-goods/shared/public-contracts` for both Agent and Client use; do not duplicate local
  contract shapes in each package.
- Keep that shared public-contracts subpath type/data only: no React, Vite `import.meta`, browser
  globals, styles, providers, hooks, or side effects.
- Add the subpath to `packages/shared/package.json` exports, add client TypeScript/Vite resolution where
  needed, and confirm Agent imports through package exports without pulling the shared root.
- Keep seeded handoff fixtures under this plan hub's `artifacts/fixtures` area for funding
  availability, funding intents, contact subscription, `/fund?garden`, and `/impact`. Package tests may
  copy or import those fixtures where package boundaries require it.

```ts
type PublicLocale = "en" | "es" | "pt";
type Address = `0x${string}`;
type PublicApiErrorCode =
  | "invalid_request"
  | "invalid_email"
  | "consent_required"
  | "already_expired"
  | "not_found"
  | "receipt_token_required"
  | "receipt_token_invalid"
  | "rate_limited"
  | "origin_not_allowed"
  | "provider_unavailable"
  | "luma_import_failed"
  | "funding_unavailable"
  | "idempotency_conflict"
  | "amount_below_min"
  | "amount_above_max"
  | "unsupported_payment_method"
  | "internal_error";

type PublicApiError = {
  ok: false;
  errorCode: PublicApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
};

type PublicSubscribeRequest = {
  email: string;
  consent: true;
  locale?: PublicLocale;
  source?: "homepage_get_in_touch" | "fund_receipt" | "footer" | "unknown";
};

type PublicSubscribeResponse =
  | { ok: true; status: "subscribed" | "already_subscribed" }
  | PublicApiError;

type FundingIntentStatus =
  | "started"
  | "pending_provider"
  | "pending_onchain"
  | "funded"
  | "failed"
  | "expired"
  | "funded_late"
  | "refunded";

type CreateFundingIntentRequest = {
  gardenId: string;
  destinationType: "cookieJar" | "vault";
  destinationAddress: Address;
  fundingIntent: "donate" | "endow";
  paymentMethod: "card";
  amountUsd: string;
  chainId: number;
  token: Address;
  availabilityKey: string;
  clientRequestId: string;
  payerEmail?: string;
  locale?: PublicLocale;
};

type ClientCheckoutTransaction = {
  to: Address;
  data?: `0x${string}`;
  value?: string;
};

type ClientCheckoutPayload = {
  provider: "thirdweb";
  clientId: string;
  chainId: number;
  destinationAddress: Address;
  receiverAddress?: Address;
  token: Address;
  amountUsd: string;
  minAssetAmount?: string;
  transaction: ClientCheckoutTransaction;
  metadata: {
    gardenId: string;
    destinationType: "cookieJar" | "vault";
    fundingIntent: "donate" | "endow";
  };
};

type ClientCheckoutSession = {
  provider: "thirdweb";
  mode: "hosted" | "widget";
  expiresAt: string;
  checkoutUrl?: string;
  clientToken?: string;
  checkoutPayload?: ClientCheckoutPayload;
};

type CreateFundingIntentResponse =
  | {
      ok: true;
      id: string;
      status: FundingIntentStatus;
      provider: "thirdweb";
      checkoutSession?: ClientCheckoutSession;
      quoteExpiresAt: string;
      receiptToken: string;
      receiptUrl: `/fund?intent=${string}#receiptToken=${string}`;
      publicReceipt: PublicFundingReceipt;
    }
  | PublicApiError;

type ReadFundingIntentReceiptRequest = {
  id: string;
  headers: { "X-GG-Receipt-Token": string };
};

type ReadFundingIntentReceiptResponse =
  | { ok: true; publicReceipt: PublicFundingReceipt }
  | PublicApiError;

type PublicFundingReceipt = {
  id: string;
  status: FundingIntentStatus;
  garden: { id: string; name: string; location?: string };
  destination: { type: "cookieJar" | "vault"; address: Address };
  fundingIntent: "donate" | "endow";
  amount: {
    amountUsd: string;
    token: Address;
    chainId: number;
    quotedAssetAmount?: string;
    minAssetAmount?: string;
    fundedAssetAmount?: string;
  };
  fundingTxHash?: string;
  receiverAddress?: Address;
  quoteExpiresAt?: string;
  updatedAt: string;
  appManagementCta?: "install_app" | "open_app";
  failureCode?: "expired" | "provider_failed" | "onchain_failed" | "reconciliation_failed";
};

type FundingTransactionRole = "allowance_reset" | "approval" | "funding" | "share_verification";
type FundingTransactionStatus = "expected" | "submitted" | "confirmed" | "failed" | "skipped";
type FundingTransactionAttempt = {
  role: FundingTransactionRole;
  status: FundingTransactionStatus;
  txHash?: string;
  chainId: number;
  token?: Address;
  destinationAddress?: Address;
  receiverAddress?: Address;
  amount?: string;
  providerEventId?: string;
  submittedAt?: string;
  confirmedAt?: string;
  failureCode?: string;
};

type ThirdwebNormalizedFundingEvent = {
  provider: "thirdweb";
  providerEventId: string;
  providerSessionId?: string;
  providerPaymentId?: string;
  fundingIntentId?: string;
  eventType: "session_created" | "payment_submitted" | "transaction_submitted" | "failed" | "refunded";
  txRole?: FundingTransactionRole;
  txHash?: string;
  chainId?: number;
  destinationAddress?: Address;
  receiverAddress?: Address;
  token?: Address;
  destinationAmount?: string;
  occurredAt: string;
};
```

- `PublicApiError.message` must be safe and must not include provider payloads, stack traces, secrets, or
  receipt tokens.
- `already_subscribed` is allowed only when Luma/import state confirms an existing subscriber/member.
  Uncertain duplicates and Luma outages return safe failures.
- `POST /public/funding-intents` returns `receiptUrl` as
  `/fund?intent=<id>#receiptToken=<token>`. The client extracts the URL fragment and calls
  `GET /public/funding-intents/:id` with `X-GG-Receipt-Token`.
- The API rejects receipt tokens sent by query param or JSON body. Raw receipt tokens are never logged,
  stored, sent to analytics, or included in server-rendered URLs.
- Receipt-bearing responses from `POST /public/funding-intents` and `GET /public/funding-intents/:id`
  must set `Cache-Control: no-store` and `Pragma: no-cache`; route tests must assert both headers.
- Client receipt-token analytics protection uses a dual guard: root or an equivalent pre-pageview
  bootstrap reads the fragment, stores the raw token only in memory or short-lived session state, and
  immediately removes the fragment with `history.replaceState` before initial pageview tracking or
  receipt view mount; `usePageView` itself also redacts sensitive hash keys including `receiptToken`.
  Tests must cover root pre-scrub, initial pageview redaction, generic hash redaction, and URL hash
  cleanup.
- Public funding receipt responses redact `payerEmail`, provider ids, internal event history, raw failure
  details, webhook payloads, and server-only reconciliation metadata.
- Public funding-intent creation responses expose only short-lived client-safe `checkoutSession` /
  checkout payload data needed to render or continue checkout. `ClientCheckoutPayload` is an allowlisted,
  JSON-safe shape with no `Record<string, unknown>` escape hatch. Durable provider session, payment, and
  event ids remain server-only ledger fields and are redacted from all public responses. Route tests must
  reject provider session/payment/event ids, raw provider payloads, webhook payloads, receipt tokens, and
  unknown nested checkout payload fields in public funding-intent responses.
- Receipt tokens are opaque bearer secrets. Store only a hash or equivalent verifier, do not log raw
  tokens, and do not send receipt tokens to analytics.
- Funding intent creation never subscribes a visitor to updates. `payerEmail` is only for
  receipt/recovery communication; receipt UI may call `POST /public/subscribe` separately with
  `consent: true`, `source: "fund_receipt"`, and locale.
- `POST /webhooks/thirdweb` remains provider-shaped at the HTTP boundary; verify raw body/signature
  first, then normalize to `ThirdwebNormalizedFundingEvent`.
- Migrate the current `packages/agent` HTTP server from Fastify to Hono before adding the new public
  subscription, funding-intent, and provider webhook routes.
- Keep existing bot handlers, services, SQLite storage, and the `packages/agent` package boundary intact
  during the Hono migration.
- Preserve current Agent HTTP behavior during the Hono migration:
  - `/health`
  - `/ready`
  - `/webhook/telegram`
  - platform webhook allowlist behavior
  - `/api/feedback`
  - `/api/notify`
  - polling and webhook startup modes
  - graceful shutdown
  - existing `/api/*` bearer auth semantics
- Remove Fastify only after Hono fully replaces the HTTP server and no Fastify imports remain in
  source, tests, or package dependencies.
- Add the planned root `.env.schema` contract for:
  - public: existing `VITE_API_BASE_URL`, plus new `VITE_GOOGLE_APPOINTMENT_URL` and
    `VITE_THIRDWEB_CLIENT_ID`
  - server-only varlock pattern: `LUMA_API_KEY_OP_REF` / `LUMA_API_KEY`, `LUMA_CALENDAR_ID`,
    `LUMA_GREEN_GOODS_TAG_ID`, `THIRDWEB_SECRET_KEY_OP_REF` / `THIRDWEB_SECRET_KEY`,
    `THIRDWEB_WEBHOOK_SECRET_OP_REF` / `THIRDWEB_WEBHOOK_SECRET`,
    `AGENT_PUBLIC_ALLOWED_ORIGINS`, `AGENT_TRUSTED_PROXY_HOPS`, and optional
    `AGENT_TRUSTED_PROXY_CIDRS`
- Do not add `VITE_AGENT_PUBLIC_API_URL` unless a later deployment decision requires a separate Agent
  public API base.
- Refresh generated env typings after `.env.schema` changes.
- Public browser routes must enforce CORS/origin allowlist, payload caps, route-specific rate limits,
  safe client-facing errors, consent audit fields, and PII handling for subscriber email and
  `payerEmail`.
- Keep Agent API route classes separate:
  - public, rate-limited browser routes for subscription and funding-intent create/read
  - provider webhook routes verified by provider signatures and raw-body checks
  - existing bearer-protected `/api/*` internal/admin routes
- Use Hono middleware or local helpers for CORS/origin allowlists, payload size caps, safe errors, and
  route-specific rate limits.
- Route-specific rate-limit identity keys are part of the contract:
  - subscribe: normalized email plus IP/origin bucket, `5/hour`
  - funding-intent create: IP/origin plus Garden/destination/intent bucket, `10/10min`
  - receipt read: intent id plus IP/origin bucket, `60/10min`
  - thirdweb webhook pre-verification: IP/origin plus provider-route bucket, `300/min`
  - thirdweb webhook post-verification: verified provider account/signature bucket, `300/min`
  - provider event id or idempotency key is replay/idempotency material, not the sole rate-limit bucket
- Implement these through a shared `publicRateLimitKey` helper that hashes email/intent key material
  before storage, normalizes origin, and derives IP from the socket/connection by default.
- Trust `X-Forwarded-For` / `Forwarded` only when server-only trusted-proxy config is set; spoofed or
  untrusted proxy headers are ignored and tested.
- Safe errors must not reveal whether an email, receipt token, provider id, or intent exists.
- Webhook handlers must read and verify the raw request body before parsing JSON.
- Add a dedicated public assessment/evidence hook for `/impact` using existing EAS reads and exposing
  only visitor-safe fields.
- Public assessment/evidence hook must define newest-first sorting, default page size `12`, a v1 fetch
  cap of `50` Gardens and `100` assessment/evidence records, local page/offset slicing over the capped
  fetched set, explicit loading/empty/partial-data states, `sourceLimitReached`, and explicit EAS failure
  states.
- `/impact` v1 candidate Gardens are sorted by latest public activity desc, then stable id/address asc.
  Fetch at most `50` Gardens from that deterministic order and at most `100` assessment/evidence records
  across the capped Garden set.
- `sourceLimitReached` is true when either cap is hit before the available candidate set is exhausted.
  Newest-first sorting is only within the fetched record set; document Agent/indexer aggregation as the
  scale path once assessment volume makes full-fetch reads too expensive.
- Preferred implementation adds a shared EAS read option for finite per-Garden limit/order where
  practical. If the current shared read path cannot limit per Garden without disproportionate churn,
  document per-Garden overfetch as an accepted v1 limitation, apply the local `100` record cap, and
  preserve `sourceLimitReached`.
- Keep Reown AppKit as the wallet funding baseline; do not replace the current wagmi/viem funding
  hooks.
- Define a provider-neutral durable `FundingIntent` ledger for direct card funding:
  - `id`
  - `gardenId`
  - `destinationType`
  - `destinationAddress`
  - `fundingIntent`
  - `paymentMethod` (`card` only for v1)
  - `availabilityKey`
  - `clientRequestId`
  - `idempotencyFingerprint`
  - `amountUsd`
  - `assetAmount`
  - `quotedAssetAmount`
  - `minAssetAmount`
  - `assetDecimals`
  - `slippageBps`
  - `providerFeeAmount`
  - `providerFeeUsd`
  - `originTokenMetadata` where provider supplies it
  - `destinationTokenMetadata` where provider supplies it
  - `chainId`
  - `token`
  - `receiverAddress`
  - `provider`
  - `providerSessionId`
  - `providerPaymentId`
  - `providerEventId`
  - `status`
  - `transactionAttempts[]`
  - `fundingTxHash`
  - `payerEmail`
  - `receiptTokenHash` or equivalent receipt-token verifier
  - `failureReason`
  - `confirmationDepth`
  - `confirmationStartedAt`
  - `confirmationDeadlineAt`
  - `quoteExpiresAt`
  - `statusHistory` or equivalent status transition timestamps
  - `createdAt`
  - `updatedAt`
- Treat `payerEmail` as funding receipt/recovery data only unless the visitor separately consents to
  updates.
- `FundingIntent` creation is card-only in this pass. Wallet funding remains Reown AppKit + wagmi/viem
  client-side and does not create Agent funding intents or Agent receipt reads until a later explicit
  plan update.
- `clientRequestId` is a required client-generated opaque idempotency key. Agent stores a normalized
  request fingerprint for the id. Exact retries return the existing intent/checkout state; mismatched
  retries return safe `idempotency_conflict` without creating a second checkout.
- The normalized idempotency fingerprint is computed from this exact field set: normalized `gardenId`,
  `destinationType`, lowercased `destinationAddress`, `fundingIntent`, `paymentMethod`, canonical decimal
  `amountUsd`, decimal-string `chainId`, lowercased `token`, canonical `availabilityKey`, `provider`,
  and normalized `payerEmail` hash when `payerEmail` is present. Normalization trims string fields,
  lowercases addresses and email, uses contract enum literals, rejects invalid decimal amount formats
  before fingerprinting, and stores the email hash rather than raw `payerEmail` in idempotency keys.
- `availabilityKey` is a drift-detection key, not trusted authority. It is built by a shared canonical v1
  helper in `@green-goods/shared/public-contracts` with this encoding:
  `v1:<gardenKey>:<destinationType>:<destinationAddress>:<fundingIntent>:<paymentMethod>:<chainId>:<token>:<provider>`.
  Addresses are lowercased, enum values use contract literals, chain ids are decimal strings, and Garden
  ids/addresses are trimmed/lowercased before encoding. Agent recomputes it from current public reads and
  the provider proof registry before creating a card intent; mismatches or non-live card rails return safe
  `funding_unavailable`.
- Persist `FundingIntent` in the current `packages/agent` storage pattern unless the implementation
  spike proves SQLite is insufficient.
- Add SQLite schema migration/versioning using `PRAGMA user_version` or a small `schema_meta` table.
- Add `funding_intents` plus `funding_intent_events` or equivalent event/history storage.
- Add transaction-attempt storage for multi-transaction card flows. Store role, status, tx hash, provider
  event id, destination/receiver context, submitted/confirmed timestamps, and failure code. Approval/reset
  hashes are audit evidence only; the confirmed funding/deposit attempt becomes the canonical
  `fundingTxHash`.
- Add unique provider session/payment/event guards and lookup by intent id, provider session id,
  provider payment id, submitted transaction hash, and canonical `fundingTxHash`.
- Add unique indexes for provider session id, provider payment id, provider event id, and transaction
  hash where those values are present.
- Include `FundingIntent.id` in thirdweb purchase/custom data for webhook/status reconciliation.
- Enforce status precedence in code and keep idempotent reconciliation as a storage invariant.
- After provider transaction submission, set the intent to `pending_onchain`, use viem with an RPC URL
  resolved from existing server/shared configuration to poll the transaction receipt, and decode expected
  Cookie Jar or Vault logs/events from the receipt.
- Resolve the Agent confirmation RPC URL with a server-only `resolveAgentRpcUrl(chainId, env)` helper:
  read existing chain-specific env first (`ETHEREUM_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_RPC_URL`,
  `CELO_RPC_URL`, `OPTIMISM_RPC_URL`, and test-only `VITE_RPC_URL_11155111` where applicable), then
  fall back to `getNetworkConfig(chainId, ALCHEMY_API_KEY || ALCHEMY_KEY || "demo").rpcUrl`. Store the
  resolved URL on Agent config and inject it into `initBlockchain` and the funding confirmation client;
  do not add a new public API base URL for this.
- Success requires matching chain, canonical funding/deposit tx hash, Garden, destination, receiver,
  token, and destination amount greater than or equal to `minAssetAmount`. Use one confirmed block for
  v1 unless existing chain config already defines a higher confirmation depth.
- If confirmation is not reached before `confirmationDeadlineAt` or intent expiry, mark the intent
  `expired` or `failed` with a public-safe failure code. Indexer evidence may be recorded as secondary
  proof, but v1 funding success does not depend on indexer freshness.
- Use funding status values:
  - `started`
  - `pending_provider`
  - `pending_onchain`
  - `funded`
  - `failed`
  - `expired`
  - `funded_late`
  - `refunded`
- Enforce this transition table:
  - `started` -> `pending_provider` after provider session/quote creation
  - `pending_provider` -> `pending_onchain` after provider reports payment/transaction submission
  - `pending_onchain` -> `funded` only after matching onchain confirmation
  - `started`, `pending_provider`, or `pending_onchain` -> `failed` / `expired` when the provider or
    local reconciliation proves a terminal failure
  - `expired` -> `funded_late` only when later onchain confirmation proves a matching funding transaction
    for the same intent/provider session
  - `funded` -> `refunded` only when a provider/onchain refund is proven
  - older pending events cannot overwrite `funded`, `funded_late`, `failed`, `expired`, or `refunded`
- Abandoned `started` and `pending_provider` card intents expire at provider checkout expiry, or
  `createdAt + 30 minutes` when provider expiry is missing. Receipt reads and provider-status checks
  reconcile stale pending intents before returning public state, and Agent adds a scheduled sweep to
  expire stale pending intents for visitors who never return.
- `expired` is terminal for pending/provider events, but a later confirmed funding/deposit transaction
  matching intent id, provider session, Garden, destination, receiver, token, chain, and `minAssetAmount`
  may move `expired -> funded_late`. `funded_late` is terminal, public-success equivalent to `funded`,
  and records `lateConfirmedAt` plus canonical `fundingTxHash`.
- Spike thirdweb Pay / `TransactionWidget` as the preferred direct-card provider and prove whether
  it can execute the actual funding path in this order:
  1. Cookie Jar / `Donate`
  2. Vault / `Endow`
- Cookie Jar / `Donate` proof must cover ERC-20 allowance, approval, and Cookie Jar deposit.
- Vault / `Endow` proof must cover allowance reset when needed, approval, preview/slippage, Vault
  deposit, and Vault-share ownership by the intended receiver.
- Cookie Jar / `Donate` reconciliation requires confirmed onchain funding into the expected Cookie Jar
  destination, matching Garden, chain, token, receiver/donor context where available, and destination
  amount greater than or equal to `minAssetAmount`.
- Vault / `Endow` reconciliation requires confirmed Vault deposit plus Vault-share ownership by the
  intended receiver wallet, matching Garden, vault, chain, token, receiver, and destination amount
  greater than or equal to `minAssetAmount`.
- Provider success alone never marks an intent funded.
- For card `Endow`, use thirdweb embedded wallet only inside the card Endow path. The spike must prove
  receiver wallet creation/recovery and Vault-share ownership before card `Endow` is shown as live.
- Card `Endow` completion data must support a UI receipt with canonical funding transaction hash
  (`fundingTxHash`), receiver wallet, recovery explanation, and Install/Open App management CTA.
- Keep Crossmint, Stripe treasury-assisted settlement, Privy/Dynamic migration, Coinbase/Reown
  onramp, and Transak as fallback options only unless the thirdweb spike fails.
- Add webhook/status verification expectations for any provider path.
- Require provider webhook idempotency, replay protection, out-of-order event handling, terminal-state
  precedence, expected receiver/destination/token/minimum-destination-amount checks, and raw-body signature verification
  where required.
- Mark funding success only after onchain confirmation matching Garden, destination, receiver, token, and
  chain with destination amount greater than or equal to `minAssetAmount`.
- Define `PublicFundingAvailability.reasonCode` as:
  - `no_destination`
  - `proof_pending`
  - `provider_unavailable`
  - `chain_unsupported`
  - `token_unsupported`
  - `config_missing`
  - `disabled`
- Define `reasonCode` semantics:
  - `no_destination`: `hidden` or `disabled`, requires `destinationType`
  - `proof_pending`: `hidden` or curated `comingSoon`, requires `provider` and `requiredProof`
  - `provider_unavailable`: `hidden` or `disabled`, requires `provider`
  - `chain_unsupported`: `hidden` or `disabled`, requires `chainId`
  - `token_unsupported`: `hidden` or `disabled`, requires `token` and `chainId`
  - `config_missing`: `hidden` or `disabled`, requires `missingConfig`
  - `disabled`: `disabled`, optional `disabledReason`
- Keep selected amount validation separate from base availability: availability can expose min/max
  metadata, while server quote/create validation returns `PublicApiError.errorCode` values
  `amount_below_min` / `amount_above_max` with safe `fieldErrors.amountUsd` and optional min/max
  `params` only when an amount input is present.
- Add a code-owned provider proof registry for card rails:
  - keyed by Garden id/address, destination type/address, funding intent, payment method, chain, token,
    and provider
  - registry state is `hidden`, `comingSoon`, or `live`
  - absence means `hidden`
  - `live` requires a proof reference or test/spike evidence note for that exact tuple
  - `comingSoon` is allowed only when intentionally curated
- Mark `status.json.contract_stability_checklist` items complete only after route paths, public route
  types, seeded fixtures, `/fund?garden`, availability reason semantics, contact behavior, public receipt
  shape, provider proof registry, and `/impact` hook shape are implementation-stable enough for UI.
- Checklist item statuses are limited to `planned`, `in_progress`, `complete`, or `blocked`. All
  required items must be `complete` before `contract_stability_checklist.status` becomes `complete`.
- After checklist completion, unblock UI by running:
  `node scripts/harness/plan-hub.mjs set-lane --feature public-read-side-journal --lane ui --status ready --actor codex --note "contract stability checklist complete"`
  and recording the history note. UI remains `manual_blocked: true` until that operation happens.

## Constraints

- Do not add public-side conviction voting.
- Do not add public withdrawals.
- Do not invent unsupported metrics.
- Do not fake subscription success without a successful Luma import or honest fallback.
- Do not show direct card funding as live until provider execution and onchain confirmation are
  proven.
- Do not show unproven card methods by default.
- Do not show card `Endow` as live until the embedded-wallet receiver/recovery and Vault-share
  ownership path is proven.
- Do not imply Donate is tax-deductible, charitable giving, nonprofit-backed, or a legal receipt
  unless separately configured and reviewed.
- Do not implement public browser withdrawal/manage controls for card `Endow`; route management to
  Install/Open App through receipt/recovery handoff.
- Do not introduce a second wallet connect experience for normal wallet funding.
- Prefer shared hooks for cross-app logic; keep client-only curation content in `packages/client`.
- Put FundingIntent and thirdweb/Luma webhook/API work in `packages/agent`; do not add a new
  package or top-level route family.
- Do not make Agent the general read aggregator for `PublicFundingAvailability` in this pass.

## Validation

- Focused hook/state tests for any changed data contract.
- Hono route tests for public/browser routes, provider webhooks, and bearer-protected internal/admin
  routes; do not use Fastify inject for new Agent route tests.
- Hono migration compatibility tests for `/health`, `/ready`, `/webhook/telegram`, platform webhook
  allowlist, `/api/feedback`, `/api/notify`, polling/webhook startup, graceful shutdown, and `/api/*`
  bearer auth.
- Public route tests for `POST /public/subscribe`, `POST /public/funding-intents`,
  `GET /public/funding-intents/:id`, and `POST /webhooks/thirdweb`.
- Public route tests for full TypeScript-style request/response contracts, safe error envelopes,
  receipt-token validation, receipt redaction, and card-only `FundingIntent` creation.
- Receipt route tests reject query/body tokens, accept `X-GG-Receipt-Token`, and prove receipt URLs use
  `/fund?intent=<id>#receiptToken=<token>`.
- Receipt route tests assert `Cache-Control: no-store` and `Pragma: no-cache` on funding-intent create and
  receipt read responses.
- Client/shared analytics tests prove root pre-pageview receipt-token scrub and generic `usePageView`
  hash redaction.
- Public contracts import tests prove `@green-goods/shared/public-contracts` is exported/resolved without
  pulling shared root or browser-only modules into Agent.
- Funding creation tests prove no update-subscription field is accepted and no implicit subscription
  occurs; receipt UI update signup uses a separate `POST /public/subscribe` call.
- Funding creation tests prove `destinationAddress`, canonical `availabilityKey`, and `clientRequestId`
  are required, recomputed by Agent, and rejected on drift, non-live card rails, or idempotency conflict.
  Tests also cover the exact normalized idempotency fingerprint fields and email-hash behavior.
- Luma subscription tests for consent required, invalid email, subscribed, confirmed already-subscribed,
  and provider failure without fake success.
- Funding intent unit tests or spike notes covering started, pending provider, pending onchain, funded,
  failed, expired, funded_late, and refunded states.
- Funding intent SQLite migration/versioning tests, including `funding_intents` and
  `funding_intent_events` or equivalent history storage.
- Funding intent transition-table tests and minimum destination amount reconciliation tests.
- Funding intent expiry tests cover `started` and `pending_provider` provider-expiry, 30-minute fallback
  expiry, read-time reconciliation, scheduled sweep behavior, and late onchain success moving
  `expired -> funded_late` only after a matching funding transaction.
- Funding transaction sequence tests prove allowance reset, approval, funding, and share-verification
  attempts are stored separately, and only the confirmed funding/deposit hash becomes `fundingTxHash`.
- Funding confirmation tests cover provider-submitted transaction, viem receipt/log confirmation,
  event/log mismatch, timeout, failure, and expiry.
- Funding availability tests for live/hidden/disabled/curated coming-soon states and `reasonCode`/params.
- Public route rate-limit tests cover the `5/hour`, `10/10min`, `60/10min`, webhook pre-verification
  `300/min`, and webhook post-verification `300/min` thresholds.
- Provider proof registry tests prove absent entries are hidden and only exact live entries expose card
  rails.
- Destination-specific Cookie Jar Donate and Vault Endow reconciliation tests.
- Agent API tests for Luma subscription validation, CORS/origin allowlists, payload caps, route limits,
  consent audit, safe errors, PII handling, provider webhook verification, replay/failure handling,
  idempotency, out-of-order updates, terminal-state precedence, and onchain-confirmed success.
- FundingIntent tests for uniqueness, lookup keys, purchase/custom data reconciliation, and status
  transition precedence.
- FundingIntent tests prove receipt-token verifier storage, raw token redaction/logging protections where
  testable, quote expiry, and public-safe receipt output.
- Public assessment/evidence hook tests for visitor-safe fields, deterministic Garden source ordering,
  local page/offset slicing limits, loading/empty/partial-data states, `sourceLimitReached`, and EAS
  failure behavior.
- `/fund?garden` tests reuse/extract `publicGardenHelpers.deriveSlug` and cover case-insensitivity,
  punctuation normalization, empty-name address fallback, stale references, and slug collisions.
- `bun run test:client` if client route/state behavior changes.
- `bun run --cwd packages/agent test && bun run --cwd packages/agent typecheck` if Agent API changes.
- Root checks if shared hook exports change.
