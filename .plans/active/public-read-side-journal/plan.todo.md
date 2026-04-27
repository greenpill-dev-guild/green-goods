# Public Browser Editorial UI Build Plan

**Slug:** `public-read-side-journal`
**Status:** `ACTIVE`
**Created:** `2026-04-25`
**Updated:** `2026-04-26`
**Priority:** `p1`
**Primary surface:** `packages/client` public browser

## Intent

Build the public browser as a polished editorial website for funders, community members,
and visitors. Browser `/` becomes the public editorial gateway. Installed PWA `/` still
routes to `/home`.

The intended public journey is:

`/` -> `/gardens` -> `/gardens/:id` -> `/impact` -> `/fund` -> `/actions`

The surface should feel like a coffee-table garden journal crossed with a living public
record: image-led, warm, restrained, credible, and easy to scan.

## Locked Route And Shell Behavior

- Browser `/` renders a new editorial homepage under `PublicShell`.
- Installed PWA `/` continues redirecting to `/home`.
- `/landing` becomes legacy compatibility and redirects to `/`.
- `PublicShell` keeps `SiteHeader`.
- Browser mode never shows installed-PWA bottom `AppBar`.
- Desktop nav order: `Gardens`, `Impact`, `Fund`, `Actions`.
- Header primary CTA: `Install App`, not `Connect Wallet`.
- Wallet connect appears only inside funding flows at the final wallet-required step.
- Reown AppKit remains the core wallet connection layer for wallet-based funding.
- thirdweb Pay is the preferred direct-card funding candidate, but funding UX starts with visitor
  intent: `Donate` or `Endow`.

## Plan-Hub Work To Do First

- [x] Replace the stale four-route-only plan with the current `/` editorial gateway plan.
- [x] Add `status.json`, `brief.md`, `spec.md`, `eval.md`, and lane handoffs.
- [x] Run `node scripts/harness/plan-hub.mjs validate`.
- [x] Run `node scripts/harness/plan-hub.mjs list --agent claude --lane ui --json`.

## Shared Public UI And Data Changes

Build public-browser components in `packages/client`, not `packages/shared`, to avoid the
Tailwind v4 shared-scan gotcha for utility classes in consuming apps.

Planned client-local components:

- `PublicEditorialHome`
- `PublicHero`
- `PublicInstallCta`
- `PublicGetInTouch`
- `PublicFeaturedGardens`
- `PublicProofBand`
- `PublicRecordLoop`
- `PublicCardShell`
- `PublicGardenCard`
- `PublicActionCard`
- `PublicFundingMethodSelector`
- `PublicSourceDialog`

Add a small typed client content module for homepage curation:

- ordered featured Garden ids or addresses as canonical keys; slugs are display/routing aliases only
- curated local hero image path
- fallback image set
- contact closing configuration:
  - public Agent API subscription route
  - Google appointment booking URL
  - no Luma credentials, calendar ids, or tag ids in client config

Data behavior:

- If curated Gardens are missing from live data, fall back to recent active Gardens from `usePublicGardens`.
- Add `/fund?garden=<garden-id-or-slug>` support so homepage and detail support CTAs can preselect or spotlight a Garden.
  - Resolve exact Garden id/address first.
  - Accept a slug only when exactly one Garden derives that slug.
  - Reuse or extract the existing `publicGardenHelpers.deriveSlug` normalization contract.
  - If the query is stale, missing, has zero matches, or has multiple slug matches, render the normal
    Fund page with a localized non-blocking message instead of a hard route error.
  - Test case-insensitivity, punctuation normalization, empty-name address fallback, stale references, and
    slug collisions.
- Confirm the public Agent API subscription path before implementation; do not fake a successful subscription if Luma import fails.
- Use the configured Google appointment booking URL for calls with the team.
- Planned Agent HTTP route paths:
  - `POST /public/subscribe` for single opt-in update signup
  - `POST /public/funding-intents` to create a funding intent
  - `GET /public/funding-intents/:id` to read public-safe intent status and receipt state with a
    receipt token
  - `POST /webhooks/thirdweb` for thirdweb provider callbacks
  - keep existing bearer-protected internal/admin routes under `/api/*`
- `/public/*` routes are unauthenticated public browser routes, but must be origin-checked,
  rate-limited, payload-capped, and safe-error only.
- Planned public route TypeScript-style contracts:

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
```

`PublicApiError.message` is safe, localized by the client where possible, and never includes provider
raw payloads, stack traces, secrets, or receipt tokens.

```ts
type PublicSubscribeRequest = {
  email: string;
  consent: true;
  locale?: PublicLocale;
  source?: "homepage_get_in_touch" | "fund_receipt" | "footer" | "unknown";
};

type PublicSubscribeResponse =
  | { ok: true; status: "subscribed" | "already_subscribed" }
  | PublicApiError;
```

`already_subscribed` is returned only when the Agent can honestly confirm the email is already present
or Luma returns an equivalent duplicate/member state. Luma outages or uncertain duplicates return a safe
failure, not fake success.

```ts
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
```

Public receipt responses must redact `payerEmail`, provider ids, internal event history, raw failure
details, webhook payloads, and server-only reconciliation metadata. Receipt tokens are opaque,
unguessable bearer secrets; store only a hash or equivalent verifier server-side, do not log the raw
token, and do not send it to analytics. The only public URL form is
`/fund?intent=<id>#receiptToken=<token>`. The client extracts the fragment and calls
`GET /public/funding-intents/:id` with `X-GG-Receipt-Token`; the API rejects receipt tokens sent in
query params or JSON bodies.

Receipt-bearing responses from `POST /public/funding-intents` and `GET /public/funding-intents/:id`
must set `Cache-Control: no-store` and `Pragma: no-cache`; route tests must assert both headers so
private receipt state is not cached by browsers, proxies, or CDNs.

Receipt-token fragment handling must happen before any receipt view can emit analytics:

- read `#receiptToken=<token>` on `/fund?intent=...`
- keep the raw token only in memory or short-lived session state needed for the receipt request
- client root or an equivalent pre-pageview bootstrap immediately calls `history.replaceState` before
  initial pageview tracking or receipt view mount
- `usePageView` itself redacts sensitive hash keys including `receiptToken`, so route-level cleanup is
  not the only protection
- test root pre-scrub, the initial pageview path, generic hash redaction, hash cleanup, and analytics
  redaction

Public funding-intent creation responses expose only short-lived client-safe `checkoutSession` /
checkout payload data needed to render or continue checkout. `ClientCheckoutPayload` is an allowlisted,
JSON-safe shape with no `Record<string, unknown>` escape hatch. Durable provider session, payment, and
event ids remain server-only ledger fields and are redacted from all public responses. Tests must reject
provider session/payment/event ids, raw provider payloads, webhook payloads, receipt tokens, and unknown
nested checkout payload fields in public funding-intent responses.

`clientRequestId` is a required client-generated opaque idempotency key. Agent stores a normalized
request fingerprint for the id. Exact retries return the existing intent/checkout state; mismatched
retries return a safe `idempotency_conflict` response without creating a second checkout.

The normalized idempotency fingerprint is computed from this exact field set:

- normalized `gardenId`
- `destinationType`
- lowercased `destinationAddress`
- `fundingIntent`
- `paymentMethod`
- canonical decimal `amountUsd`
- decimal-string `chainId`
- lowercased `token`
- canonical `availabilityKey`
- `provider`
- normalized `payerEmail` hash when `payerEmail` is present

Normalization trims string fields, lowercases addresses and email, uses contract enum literals, rejects
invalid decimal amount formats before fingerprinting, and stores the email hash rather than raw
`payerEmail` in idempotency keys.

`availabilityKey` is a drift-detection key, not trusted authority. It is built by a shared canonical v1
helper in `@green-goods/shared/public-contracts` with this encoding:
`v1:<gardenKey>:<destinationType>:<destinationAddress>:<fundingIntent>:<paymentMethod>:<chainId>:<token>:<provider>`.
Addresses are lowercased, enum values use contract literals, chain ids are decimal strings, and Garden
ids/addresses are trimmed/lowercased before encoding. Agent recomputes the key from current public reads
and the provider proof registry before creating a card intent; mismatches or non-live card rails return
a safe `funding_unavailable` response.

Funding creation never subscribes a visitor to updates. `payerEmail` is receipt/recovery data only.
Receipt UI may offer updates by calling `POST /public/subscribe` separately with `consent: true`,
`source: "fund_receipt"`, and locale.

```ts
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

`POST /webhooks/thirdweb` remains provider-shaped at the HTTP boundary. The Agent verifies the raw
body/signature first, then normalizes into `ThirdwebNormalizedFundingEvent` before reconciliation.
- Add shared ownership for the public contract surface:
  - framework-free public route/type contracts live in `packages/shared/src/public-contracts`
  - export them as `@green-goods/shared/public-contracts`
  - add the subpath to `packages/shared/package.json` exports
  - add client TypeScript and Vite resolution for `@green-goods/shared/public-contracts` where needed
  - Agent and Client import those shared contracts from that subpath instead of duplicating local shapes
  - the subpath is type/data only: no React, Vite `import.meta`, browser globals, styles, providers,
    hooks, or side effects
  - confirm Agent imports the subpath through package exports without pulling the shared root
  - seeded handoff fixtures live under this hub's `artifacts/fixtures` area
  - implementation package tests may copy or import those fixtures where package boundaries require it
- Add a provider-neutral direct funding intent ledger before hard-wiring any card provider:
  - `id`
  - `gardenId`
  - `destinationType` (`vault` or `cookieJar`)
  - `destinationAddress`
  - `fundingIntent` (`donate` or `endow`)
  - `paymentMethod` (`card` only for v1 `FundingIntent` creation)
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
- `payerEmail` is for funding receipt/recovery only unless the visitor separately consents to updates.
- `FundingIntent` is card-only in this pass. Wallet funding remains Reown AppKit + wagmi/viem and does
  not create Agent funding intents or Agent receipt reads until a later explicit plan update.
- Funding intent creation never subscribes the visitor. Newsletter/update signup is always a separate
  explicit `POST /public/subscribe` call.
- Planned `FundingIntent` status values:
  - `started`
  - `pending_provider`
  - `pending_onchain`
  - `funded`
  - `failed`
  - `expired`
  - `funded_late`
  - `refunded`
- Planned status transition table:
  - `started` -> `pending_provider` after provider session/quote creation
  - `pending_provider` -> `pending_onchain` after provider reports payment/transaction submission
  - `pending_onchain` -> `funded` only after matching onchain confirmation
  - `started`, `pending_provider`, or `pending_onchain` -> `failed` / `expired` when the provider or
    local reconciliation proves a terminal failure
  - `expired` -> `funded_late` only when later onchain confirmation proves a matching funding transaction
    for the same intent/provider session
  - `funded` -> `refunded` only when a provider/onchain refund is proven
  - older pending events cannot overwrite `funded`, `funded_late`, `failed`, `expired`, or `refunded`
- Abandoned card intent expiry:
  - `started` and `pending_provider` intents expire at provider checkout expiry
  - if provider expiry is missing, use `createdAt + 30 minutes`
  - receipt reads and provider-status checks reconcile stale pending intents before returning public state
  - add a scheduled Agent sweep to expire stale pending intents for visitors who never return
- Late onchain success handling:
  - `expired` is terminal for pending/provider events
  - a later confirmed funding/deposit transaction that matches intent id, provider session, Garden,
    destination, receiver, token, chain, and `minAssetAmount` can move `expired` to `funded_late`
  - `funded_late` is terminal, public-success equivalent to `funded`, and records `lateConfirmedAt` plus
    canonical `fundingTxHash`
- Assign `FundingIntent`, thirdweb webhook/status, and Luma subscription endpoints to the
  `packages/agent` Hono API under the existing `state_api` lane.
- `state_api` migrates the current Agent HTTP server from Fastify to Hono before adding the new public
  subscription, funding-intent, and provider webhook routes.
- Keep existing bot handlers, services, SQLite storage, and the `packages/agent` package boundary intact
  during the Hono migration.
- Hono migration compatibility checklist:
  - preserve `/health`
  - preserve `/ready`
  - preserve Telegram webhook behavior at `/webhook/telegram`
  - preserve platform webhook allowlist behavior
  - preserve `/api/feedback`
  - preserve `/api/notify`
  - preserve polling and webhook startup modes
  - preserve graceful shutdown behavior
  - preserve existing bearer auth semantics for `/api/*`
- Migrate route tests from Fastify inject to Hono request testing.
- Fastify can be removed from `packages/agent` once Hono fully replaces the HTTP server and no imports
  remain in source, tests, or package dependencies.
- Persist `FundingIntent` in the current `packages/agent` storage pattern unless the implementation
  spike proves SQLite is insufficient.
- Add a SQLite schema migration/version approach using either `PRAGMA user_version` or a small
  `schema_meta` table before adding funding tables.
- Add explicit `funding_intents` and `funding_intent_events` or equivalent status-history storage.
- Add explicit transaction-attempt storage for multi-transaction card flows. Store role, status, tx hash,
  provider event id, destination/receiver context, submitted/confirmed timestamps, and failure code.
  Approval/reset transaction hashes are audit evidence only; the confirmed funding/deposit attempt becomes
  the canonical `fundingTxHash`.
- Require unique constraints or equivalent guards for provider session ids, payment ids, and webhook
  event ids.
- Require unique indexes for provider session id, provider payment id, provider event id, and tx hash
  where those values are present.
- Support intent lookup by `id`, provider session id, provider payment id, submitted transaction hash,
  and canonical `fundingTxHash`.
- Include `FundingIntent.id` in thirdweb purchase/custom data so webhooks and status responses can
  reconcile back to the durable ledger.
- Use split Agent API route classes:
  - public, rate-limited browser routes for email subscription and funding-intent create/read
  - provider webhook routes verified by provider signatures and raw-body checks
  - existing bearer-protected `/api/*` internal/admin routes
- Use Hono middleware or local helpers for public-route CORS/origin allowlists, payload size caps, safe
  client-facing errors, and route-specific rate limits.
- Provider webhook handlers must read and verify the raw request body before parsing JSON.
- Agent onchain confirmation:
  - after provider transaction submission, set the intent to `pending_onchain`
  - use viem with an RPC URL resolved from existing server/shared configuration to poll the transaction
    receipt
  - add a server-only `resolveAgentRpcUrl(chainId, env)` helper
  - read existing chain-specific env first: `ETHEREUM_RPC_URL`, `SEPOLIA_RPC_URL`,
    `ARBITRUM_RPC_URL`, `CELO_RPC_URL`, `OPTIMISM_RPC_URL`, and test-only `VITE_RPC_URL_11155111`
    where applicable
  - fall back to `getNetworkConfig(chainId, ALCHEMY_API_KEY || ALCHEMY_KEY || "demo").rpcUrl`
  - store the resolved URL on Agent config and inject it into `initBlockchain` and the Agent
    confirmation client; do not add a new public API base URL for this
  - decode the expected Cookie Jar or Vault logs/events from the receipt
  - success requires matching chain, canonical funding/deposit transaction hash, Garden, destination,
    receiver, token, and destination amount greater than or equal to `minAssetAmount`
  - use one confirmed block for v1 unless existing chain config already defines a higher confirmation
    depth
  - if confirmation is not reached before `confirmationDeadlineAt` / intent expiry, mark `expired` or
    `failed` with a public-safe failure code
  - indexer evidence may be recorded as secondary proof, but v1 funding success does not depend on
    indexer freshness
- Public Agent API protections:
  - CORS / origin allowlist for browser routes
  - payload size caps
  - route-specific rate limits
    - subscribe: normalized email plus IP/origin bucket, `5/hour`
    - funding intent create: IP/origin plus Garden/destination/intent bucket, `10/10min`
    - receipt read: intent id plus IP/origin bucket, `60/10min`
    - thirdweb webhook pre-verification: IP/origin plus provider-route bucket, `300/min`
    - thirdweb webhook post-verification: verified provider account/signature bucket, `300/min`
    - provider event id or idempotency key is replay/idempotency material, not the sole rate-limit bucket
  - public rate-limit keys are produced by a shared `publicRateLimitKey` helper
  - email and intent components are hashed before storage in the in-memory limiter
  - IP is derived from the socket/connection by default
  - `X-Forwarded-For` / `Forwarded` headers are trusted only when server-only trusted-proxy config is
    set; spoofed or untrusted proxy headers are ignored
  - safe client-facing error responses
  - safe errors must not reveal whether an email, receipt token, provider id, or intent exists
  - consent audit fields for subscriptions and card funding email capture
  - PII handling for subscriber email and `payerEmail`, including consent timestamp and
    unsubscribe/privacy handoff
- Planned root `.env.schema` configuration:
  - reuse existing public `VITE_API_BASE_URL` for browser-to-Agent public routes
  - public: `VITE_GOOGLE_APPOINTMENT_URL`
  - public: `VITE_THIRDWEB_CLIENT_ID`
  - server-only: `LUMA_API_KEY_OP_REF` / `LUMA_API_KEY`
  - server-only: `LUMA_CALENDAR_ID`
  - server-only: `LUMA_GREEN_GOODS_TAG_ID`
  - server-only: `THIRDWEB_SECRET_KEY_OP_REF` / `THIRDWEB_SECRET_KEY`
  - server-only: `THIRDWEB_WEBHOOK_SECRET_OP_REF` / `THIRDWEB_WEBHOOK_SECRET`
  - server-only: `AGENT_PUBLIC_ALLOWED_ORIGINS`
  - server-only: `AGENT_TRUSTED_PROXY_HOPS`
  - server-only optional: `AGENT_TRUSTED_PROXY_CIDRS`
  - do not add `VITE_AGENT_PUBLIC_API_URL` unless a later deployment decision requires a separate Agent
    public API base
  - `.env.schema` is canonical; generated env typings must be refreshed during implementation
- Use Luma Calendar People import for update subscriptions:
  - single opt-in email field
  - collect explicit consent with the email input
  - validate email format
  - keep Luma credentials server-side
  - tag imported contacts with a preconfigured Green Goods tag
  - keep Google appointment scheduling as a configured external URL
- Use existing public hooks where possible:
  - `usePublicGardens`
  - `usePublicGardenDetail`
  - `usePublicStats`
  - `usePublicFieldNotes`
- Add a dedicated public assessment/evidence hook for `/impact` using existing EAS reads and exposing
  only visitor-safe fields.
- Public assessment/evidence hook contract:
  - sort newest first by assessment / attestation time
  - default page size is `12`
  - v1 fetch cap is `50` Gardens and `100` assessment/evidence records before slicing
  - candidate Gardens are sorted by latest public activity desc, then stable id/address asc
  - fetch at most `50` Gardens from that deterministic order
  - fetch at most `100` assessment/evidence records across the capped Garden set
  - use current shared EAS reads with finite client-side slicing for v1
  - expose local page / offset state over the capped fetched set, not backend cursor pagination
  - return `partialData` when only part of the capped data could load
  - return `sourceLimitReached` when either cap is hit before the available candidate set is exhausted
  - newest-first sorting is only within the fetched record set; do not imply exhaustive global ordering
    until Agent/indexer aggregation exists
  - preferred implementation adds a shared EAS read option for finite per-Garden limit/order where
    practical
  - if the current shared read path cannot limit per Garden without disproportionate churn, document
    per-Garden overfetch as an accepted v1 limitation, apply the local `100` record cap, and preserve
    `sourceLimitReached`
  - return loading, empty, partial-data, and EAS failure states explicitly
  - document Agent/indexer aggregation as the scale path once assessment volume makes full-fetch reads
    too expensive
- Add only minimal public aggregate helpers needed for confirmed Vault availability and depositor counts.
- Do not invent metrics.

Planned `PublicFundingAvailability` contract:

- keyed by Garden id/address, destination type/address, funding intent, payment method, chain, token,
  and provider
- exposes `state`: `live`, `comingSoon`, `hidden`, or `disabled`
- includes stable `reasonCode` plus optional params, minimum/maximum amount where known, destination address, and required proof
  status
- UI owns localized user-facing availability text in `en`, `es`, and `pt`; the state contract does not return user-facing
  prose
- planned `reasonCode` enum:
  - `no_destination`
  - `proof_pending`
  - `provider_unavailable`
  - `chain_unsupported`
  - `token_unsupported`
  - `config_missing`
  - `disabled`
- `reasonCode` semantics:

| `reasonCode` | Allowed states | Required params | UI localization expectation |
| --- | --- | --- | --- |
| `no_destination` | `hidden`, `disabled` | `destinationType` | Explain that this Garden does not have that support path configured. |
| `proof_pending` | `hidden`, `comingSoon` | `provider`, `requiredProof` | Hidden by default; show coming-soon only when intentionally curated. |
| `provider_unavailable` | `hidden`, `disabled` | `provider` | Explain the payment rail is unavailable without exposing provider internals. |
| `chain_unsupported` | `hidden`, `disabled` | `chainId` | Explain the selected chain is not supported for this method. |
| `token_unsupported` | `hidden`, `disabled` | `token`, `chainId` | Explain the token is not supported for this method. |
| `config_missing` | `hidden`, `disabled` | `missingConfig` | Hide unless needed for internal/admin QA fixtures. |
| `disabled` | `disabled` | optional `disabledReason` | Use neutral support-unavailable copy. |

- base availability may include `minAmount` / `maxAmount` metadata for UI controls
- selected amount validation is separate from base availability:
  - local UI validation uses availability min/max metadata
  - server quote/create validation returns `PublicApiError.errorCode` values `amount_below_min` /
    `amount_above_max` with safe `fieldErrors.amountUsd` and optional min/max `params`
  - amount validation requires an amount input and must not be evaluated by the base availability helper
- shared public read helpers derive Wallet / Donate / Endow availability from current public Vault and
  Cookie Jar reads where possible
- planned provider proof registry for card rails:
  - code-owned registry consumed by `PublicFundingAvailability`
  - keyed by Garden id/address, destination type/address, funding intent, payment method, chain, token,
    and provider
  - registry state is `hidden`, `comingSoon`, or `live`
  - absence means `hidden`
  - `live` requires a proof reference or test/spike evidence note for that exact tuple
  - `comingSoon` is allowed only when intentionally curated
- provider/card proof state is code-owned and conservative; card methods are hidden unless the provider
  proof registry marks that exact Garden, destination, intent, token, chain, and provider as live or
  intentionally coming soon
- default behavior: unproven card methods are `hidden`
- `comingSoon` is used only when intentionally curated by the state/API contract, not as the default

## Direct Funding Rails Decision

Goal: a non-crypto visitor can pick a Garden, such as Tech & Sun, choose how they want to support
it, enter an amount, and pay by card, Apple Pay, Google Pay, or wallet where that method is proven
available.

Keep the funding stack split by visitor intent first:

- `Donate`
  - Direct donation / direct funding through the Garden's Cookie Jar.
  - Public explanation: funds are given to support Garden needs and verified regenerative Work.
  - Explanatory copy should prefer "support" language and must not imply tax deductibility,
    charitable status, nonprofit status, or legal receipt unless that is separately configured and
    reviewed.
  - This is the first thirdweb card spike target.
- `Endow`
  - Vault support designed to preserve the visitor's deposit while interest/yield supports the
    Garden.
  - Public explanation must avoid leading with DeFi jargon; explain that the deposit is designed to
    stay theirs while generated yield helps the Garden.
  - Include short risk copy for smart contract, token, yield, provider, and wallet recovery risks.
  - Wallet `Endow` uses Reown/wagmi and mints Vault shares to the connected wallet.
  - Card `Endow` uses thirdweb embedded wallet only inside the card Endow path, creating or
    recovering the receiver wallet that owns the Vault shares.
  - Card `Endow` copy must explain that the visitor is creating or using a recoverable wallet-backed
    position, not making a one-time donation.
  - Card `Endow` success shows receipt, canonical funding transaction hash (`fundingTxHash`), receiver
    wallet, recovery explanation, and an `Install App` / `Open App` management CTA.
  - This is the second thirdweb card spike target after `Donate` is proven.

After choosing `Donate` or `Endow`, visitors choose payment method:

- `Wallet`
  - Use existing Reown AppKit + wagmi + viem.
  - Reuse the current Cookie Jar or Vault deposit hooks.
  - Does not create an Agent `FundingIntent` in this pass.
  - Wallet connect happens only after the visitor chooses wallet funding and reaches the
    wallet-required step.
- `Card`
  - Prefer thirdweb Pay / `TransactionWidget`.
  - Card support is shown as live only for the specific intent/destination that has passed the
    provider spike.
  - Unproven card methods are hidden by default.
  - The spike must prove thirdweb can execute the actual Cookie Jar or Vault funding path, not only
    top up a wallet.
  - `Donate` proof must cover Cookie Jar ERC-20 allowance, approval, and deposit.
  - `Endow` proof must cover Vault allowance reset if needed, approval, preview/slippage checks,
    deposit, and Vault-share ownership by the intended receiver.
  - For `Endow`, card flow must also prove embedded-wallet receiver creation/recovery and Vault-share
    ownership before showing the method as live.

Do not replace Reown AppKit with thirdweb for this pass. Green Goods already has Reown AppKit,
wagmi, and viem as the wallet baseline, and replacing that stack would turn a funding feature into
a wallet/auth migration. The public UI should avoid showing two wallet systems in the same moment:
card flow goes to thirdweb only after the user chooses `Card`; wallet flow goes to Reown/wagmi only
after the user chooses `Wallet`.

Provider ranking for this plan:

| Rank | Option | Why |
| --- | --- | --- |
| 1 | thirdweb Pay / `TransactionWidget` | Best fit for direct card or crypto payment into an onchain transaction. |
| 2 | Crossmint Embedded / Headless Checkout | Potentially best consumer checkout UX, but needs proof against this exact Garden funding contract shape. |
| 3 | Stripe card payment + backend/treasury executor | Smooth Web2 UX, but less decentralized because Green Goods or an operator executes settlement. |
| 4 | Privy or Dynamic embedded wallet + card funding + sponsored tx | Strong UX, but implies broader wallet/auth stack migration and higher lock-in. |
| 5 | Coinbase Onramp / Reown AppKit On-Ramp | Easiest with existing wallet stack, but it is "buy crypto first," not direct Garden funding. |
| 6 | Transak On-Ramp / API | Broad payment coverage, but still primarily an onramp rather than direct funding. |

Backend/state responsibilities for direct card funding:

- Create or track a `FundingIntent` before launching provider checkout.
- Store enough Garden/destination context to reconcile provider callbacks and onchain receipts.
- Verify provider webhook signatures and expected receiver, destination chain, token, and minimum
  destination amount.
- Verify raw provider webhook bodies where signatures require the exact request body.
- Handle provider callbacks idempotently, including duplicate, replayed, and out-of-order events.
- Treat terminal states as sticky; `funded`, `failed`, `expired`, and `refunded` cannot be overwritten
  by earlier pending events.
- Enforce code-owned status precedence and keep enough transition history or timestamps to audit state
  changes.
- Show honest states: started, pending provider, pending onchain, funded, failed, refunded/expired
  where provider supports it.
- Never claim the Garden was funded until the relevant onchain transaction is confirmed, matches Garden,
  destination, receiver, token, and chain, and the destination amount is at least `minAssetAmount`.
- Use Agent-side viem receipt/log polling as the v1 confirmation source; indexer reads are secondary
  evidence only.
- Cookie Jar / `Donate` success requires confirmed onchain funding into the expected Cookie Jar
  destination, matching Garden, chain, token, receiver/donor context where available, and destination
  amount greater than or equal to `minAssetAmount`.
- Vault / `Endow` success requires confirmed Vault deposit plus Vault-share ownership by the intended
  receiver wallet, matching Garden, vault, chain, token, receiver, and destination amount greater than
  or equal to `minAssetAmount`.
- Provider success alone never marks an intent funded.
- Prove thirdweb direct card funding in this order:
  1. Cookie Jar / `Donate`
  2. Vault / `Endow`

## UI Unblock Criteria

The UI lane may start once state/API contracts are stable, even if not every card payment method is
live. Stable contracts are tracked by `status.json.contract_stability_checklist`, not by full
`state_api` lane completion. UI remains manually blocked until every required checklist item is marked
complete, then the UI lane may be moved to `ready` while card rails that are not live stay hidden.
Stable contracts means:

- checklist item statuses are only `planned`, `in_progress`, `complete`, or `blocked`
- all required checklist items are `complete`
- `contract_stability_checklist.status` is `complete`
- UI is unblocked by running:
  `node scripts/harness/plan-hub.mjs set-lane --feature public-read-side-journal --lane ui --status ready --actor codex --note "contract stability checklist complete"`
- concrete `/public/*` and `/webhooks/thirdweb` route paths are settled
- public types and seeded fixtures exist for funding availability, funding intents, contact
  subscription, `/fund?garden`, and `/impact`
- `PublicFundingAvailability.reasonCode` enum and state/params semantics are settled
- `/fund?garden` stale / ambiguous fallback behavior is settled
- contact endpoint success/failure behavior is settled
- public receipt shape and receipt-token behavior are settled
- provider proof registry exact-tuple keys, hidden-by-default behavior, and proof-reference semantics are settled
- `/impact` hook shape, slicing limits, and failure states are settled
- unavailable card rails render hidden unless intentionally marked `comingSoon`

## Visual Direction

- Public browser uses Fraunces only for route heroes, large editorial numbers, and Garden story headings.
- Body, nav, cards, buttons, dialogs, and installed PWA stay Inter.
- Use semantic Warm Earth tokens only.
- No raw color, radius, or motion values.
- Accent map:
  - Gardens: green
  - Impact: sky
  - Fund: action green
  - Actions: amber / earth
- Keep accent volume low. Canvas remains warm neutral; ink and stone carry most of the page.
- Use real Garden imagery when available.
- Otherwise use a small committed local fallback set.
- Avoid decorative gradients, generic SaaS card grids, oversized stat mosaics, and hero cards.

## Browser `/` Homepage

Purpose: answer "What is Green Goods?" in one glance and route visitors into the public
journey.

### First Viewport

- Sticky `SiteHeader`.
- Full-bleed curated local Garden hero image.
- Text over image, anchored left or bottom-left with strong contrast.
- H1: `Green Goods`.
- Supporting line: `From good intentions to green outcomes`.
- One concrete sentence about communities documenting, verifying, and funding regenerative Work.
- Primary CTA: `Explore Gardens`.
- Secondary CTA: `Install App`.
- Do not show stats, route grid, wallet connect, or waitlist form in the hero.
- Let the featured Gardens section visibly peek below the fold.

### Featured Gardens

- Lead-plus-two editorial layout.
- Manual curation from the client content module.
- Live fallback to recent active Gardens.
- Each featured item links to `/gardens/:id`.

### Proof Band

- Show only confirmed counts:
  - Gardens
  - contributors / gardeners
  - Work
  - Assessments
- Link contextually to `/impact`.
- Hide unavailable carbon, water, species, and area metrics.

### Public Record Loop

Use visitor-facing wording:

`Assess the place` -> `Do the work` -> `Verify impact` -> `Fund what grows`

- One-line steps, not a docs-heavy explainer.
- Link steps contextually to `/impact`, `/actions`, Garden details, and `/fund`.
- Do not imply formal EAS Assessment attestations happen before Work; this is visitor narrative language.

### Install Module

- Reuse the same install component as the header CTA.
- Desktop shows QR-to-phone guidance.
- Mobile shows browser/OS-specific install guidance via `useInstallGuidance`.
- Already-installed users see `Open App`.

### Closing

- Replace the generic soft continuation with a `Get In Touch` closing module.
- Closing content:
  - concise invitation to talk with the Green Goods team
  - email subscription field that calls `POST /public/subscribe`
  - `Schedule a Call` link to the configured Google appointment booking page
  - optional subdued continuation links: `Explore Gardens` and `Install App`
- Subscription behavior must be honest:
  - use the public Agent API route backed by Luma Calendar People import
  - collect explicit single opt-in consent
  - show success only after confirmed import, or an honest failure/fallback state
- No final sitemap-style "choose your path" grid.

## `/gardens`

Purpose: public discovery and browsing.

- Editorial hero with text-over-image treatment.
- Top content: short page thesis plus 2-3 featured Gardens.
- Browse section:
  - search
  - filter
  - sort
  - structured responsive Garden grid
- Cards show:
  - image or fallback
  - name
  - location
  - description
  - contributor count
  - Work count
  - last activity
  - confirmed funding availability from `PublicFundingAvailability`
- Card interaction:
  - rich tactile hover / press
  - source morph into `/gardens/:id` where supported
- Empty state:
  - warm, plain-language message
  - no fake Gardens or placeholder metrics

## `/gardens/:id`

Purpose: a full public story page for one Garden.

- Content order: Place -> Work -> Evidence -> Fund.
- Hero:
  - large Garden image or fallback
  - Garden name
  - location
  - short description
  - latest activity
- Main column:
  - Garden narrative
  - recent public Work cards
  - evidence and Assessment summary
- Desktop side rail:
  - contributors
  - Work count
  - Assessment count
  - funding availability from `PublicFundingAvailability`
  - `Fund this Garden`
  - `Install App` / `Open App`
- Funding CTA links to `/fund?garden=<id-or-slug>`.
- Do not expose admin-only controls, role tools, or public-side conviction allocation.

## `/impact`

Purpose: credible public evidence ledger.

- Open with credible aggregate counts from current public data.
- Show Assessment / evidence cards, not a placeholder Hypercert gallery.
- Use the dedicated public assessment/evidence hook from `state_api`.
- Cards show:
  - Garden
  - Assessment title
  - domain
  - time window
  - description summary
  - Attestation / evidence availability
- Card opens source-anchored dialog:
  - readable Assessment summary
  - EAS reference where available
  - no raw audit overload unless explicitly useful
- Hide unavailable carbon, water, species, and area metrics.
- Do not claim automated Karma GAP reporting or Hypercert marketplace completion unless backed by live data.

## `/fund`

Purpose: trust first, then Garden-specific support.

- Layout: trust explanation -> real aggregates -> funding destinations.
- Explain Vault vs Cookie Jar briefly:
  - `Donate`: direct donation / direct funding through Cookie Jar.
  - `Endow`: Vault support designed to preserve the visitor's deposit while interest/yield supports
    the Garden.
  - include short risk copy for smart contract, token, yield, provider, and wallet recovery risks
- Show real Vault aggregates where indexer data supports them:
  - Vault count
  - depositor count
  - deposited totals where safely formatted
- Garden cards show:
  - Garden identity
  - funding availability from `PublicFundingAvailability`
  - `Donate`
  - `Endow`
  - only live methods from `PublicFundingAvailability`
- Dialog behavior:
  - clicking funding action opens the relevant dialog first
  - the first step chooses funding intent: `Donate` or `Endow`
  - the second step chooses payment method: `Card` or `Wallet`
  - card flow opens the thirdweb-powered checkout/spike path only for proven intent/destination pairs
  - unproven card methods are hidden by default
  - wallet flow opens the existing Reown/wagmi Cookie Jar or Vault deposit path
  - wallet connect happens only when the visitor chooses wallet funding and submits or reaches the wallet-required step
  - card `Endow` success shows receipt, canonical funding transaction hash (`fundingTxHash`), receiver
    wallet, recovery explanation, and `Install App` / `Open App` management CTA
  - public page remains support-only: `Donate` and `Endow` are allowed, but withdrawals/admin controls
    are not
- Card funding copy must stay conservative until the thirdweb spike proves the exact Garden funding
  transaction path.
- No withdraw controls, admin Vault management, unsupported auto-buy claims, or public treasury
  custody claims.

## `/actions`

Purpose: readable public Action library.

- Group and filter by domain.
- Cards show:
  - image or fallback
  - title
  - domain
  - description
  - capitals / participation summary where available
- Card opens source-anchored dialog:
  - media
  - description / details
  - expected inputs
  - capitals
  - how to participate via app install / open-app
- No public create or edit controls.

## Motion And Interaction

- Route transitions: soft fades.
- Section reveals: light stagger.
- Card opens / dialogs: source morphs wherever the source element is clear and the implementation can
  assign unique transition names per item.
- Fall back to a simple fade when source uniqueness or browser support is unclear.
- Dialogs:
  - desktop: centered/floating source-anchored modal
  - mobile: bottom sheet
  - thick readable material, not fragile glass
  - labelled title, focus handling, escape / overlay close, and keyboard-safe interaction
- Use reduced-motion fallbacks.
- Motion should clarify hierarchy and affordance, not decorate.

## Plan And Docs Work

- [x] Complete this `.plans/active/public-read-side-journal` hub as durable repo truth.
- [ ] Update `packages/client/DESIGN.browser.md` during the implementation pass with:
  - this doc update is the first UI implementation step because the current design overlay still
    references browser `/` -> `/gardens`, old nav order, and wallet CTA behavior
  - browser `/` as editorial gateway
  - `/landing` redirect
  - install CTA behavior
  - nav order
  - homepage section order
  - `Get In Touch` closing behavior
  - `Donate` / `Endow` funding behavior
  - page-by-page layout contracts
  - typography / color / motion rules
- [ ] Do not update root `DESIGN.md` for this pass.

## Test Plan

Plan truth:

- `node scripts/harness/plan-hub.mjs validate`
- `node scripts/harness/plan-hub.mjs list --agent codex --lane state_api --json`
- `node scripts/harness/plan-hub.mjs list --agent claude --lane ui --json`
  - `public-read-side-journal` should not appear in the ready UI list until
    `status.json.contract_stability_checklist` is complete and the UI lane is explicitly unblocked.

Design:

- `bun run check:design-md`
- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`

Focused client tests:

- browser `/` renders editorial homepage
- installed PWA `/` routes to `/home`
- `/landing` redirects to `/`
- header install CTA behavior
- homepage curation fallback
- homepage `Get In Touch` contact behavior
- `/fund?garden=...`
  - resolves exact Garden id/address first
  - accepts slug matches only when exactly one Garden derives the slug
  - stale, missing, zero-match, or ambiguous references fall back to the normal Fund page with a
    localized non-blocking message
- `/fund` `Donate` / `Endow` intent selection
- payment method selection after intent: `Card` / `Wallet`
- public Agent route paths:
  - `POST /public/subscribe`
  - `POST /public/funding-intents`
  - `GET /public/funding-intents/:id` with required `X-GG-Receipt-Token`
  - `POST /webhooks/thirdweb`
- TypeScript-style public route request/response contracts and safe error envelope
- public funding receipt redaction and receipt-token validation
- public funding intent creation returns only client-safe checkout data and never exposes durable
  provider ids
- receipt-bearing create/read responses include `Cache-Control: no-store` and `Pragma: no-cache`
- public Agent API route class coverage for public routes, provider webhooks, and bearer-protected
  internal/admin routes
- Hono route tests use Hono request testing instead of Fastify inject
- Hono migration preserves `/health`, `/ready`, `/webhook/telegram`, platform webhook allowlist,
  `/api/feedback`, `/api/notify`, polling/webhook startup, graceful shutdown, and `/api/*` bearer auth
- funding intent lifecycle: started, pending provider, pending onchain, funded, failed, expired,
  funded_late, refunded
- `FundingIntent` creation is card-only for v1; wallet funding remains Reown/wagmi client-side without
  Agent receipt tracking
- funding intent SQLite migration/versioning and `funding_intents` /
  `funding_intent_events` storage
- funding intent status transition table and terminal-state precedence
- funding intent idempotency: `clientRequestId` exact retry returns the existing checkout and mismatched
  retry returns `idempotency_conflict`
- multi-transaction funding sequence: allowance reset / approval / funding / share verification attempts
  are stored separately, and only the confirmed funding/deposit hash becomes `fundingTxHash`
- funding intent uniqueness and lookup by intent id, provider session id, provider payment id,
  submitted transaction hash, and canonical `fundingTxHash`
- funding webhook verification, raw-body handling, idempotency, replay, out-of-order updates, and
  terminal-state precedence
- `FundingIntent.id` included in thirdweb purchase/custom data for reconciliation
- card reconciliation uses quoted/minimum destination amount fields and `minAssetAmount` matching
- destination-specific Cookie Jar Donate and Vault Endow reconciliation tests
- public funding availability contract uses `reasonCode`/params/state semantics and hidden-by-default card
  methods
- public funding availability `reasonCode` enum has localized `en`, `es`, and `pt` copy coverage
- card `Endow` embedded-wallet receiver/recovery model
- thirdweb direct-card funding spike evidence for Cookie Jar / `Donate` allowance, approval, and
  deposit
- thirdweb direct-card funding spike evidence for Vault / `Endow` allowance reset if needed, approval,
  preview/slippage, deposit, and Vault-share ownership
- Luma single opt-in subscription endpoint behavior, confirmed already-subscribed behavior, consent audit,
  and safe failure states
- public Agent API CORS/origin, payload caps, route-specific rate-limit keys, safe errors, and PII
  handling
- planned root `.env.schema` public/server-only config boundaries, with `VITE_API_BASE_URL` as the public
  Agent route base
- public assessment/evidence hook local page/offset slicing, sorting within fetched slice, loading, empty,
  `partialData`, `sourceLimitReached`, EAS failure behavior, and accepted v1 per-Garden overfetch
  behavior for `/impact`
- Donate/support copy does not imply tax deductibility, charitable status, nonprofit status, or legal
  receipt
- public dialogs
- no browser bottom `AppBar`

Storybook and screenshots:

- `/`
- `/gardens`
- `/gardens/:id`
- `/impact`
- `/fund`
- `/actions`
- install sheet / module
- homepage get-in-touch closing
- seeded Storybook/component states plus routed browser screenshots
- `/fund` `Donate` / `Endow` intent selector
- card / wallet method selector after intent
- hidden-by-default unproven card methods
- stale, missing, zero-match, or ambiguous `/fund?garden=...` query message
- card `Endow` receipt / recovery / app-management handoff
- risk-safe `Endow` copy using "designed to preserve"
- source dialogs
- viewports: 375, 768, 1024, 1440

Final gates:

- `bun run test:client`
- `bun run --cwd packages/agent test && bun run --cwd packages/agent typecheck` if Agent API changes
- `bun run format:check && bun lint`
- `VITE_CHAIN_ID=11155111 bun run build:client`

## Assumptions

- No public-side conviction voting in this pass.
- No public withdrawals.
- No new route families beyond browser `/`.
- Homepage curation is code-owned client content, not a CMS or env-variable system.
- Homepage curation uses Garden ids/addresses as canonical keys; slugs are not canonical because they
  are currently derived from mutable names.
- Cookie Jar aggregate display stays conservative unless current public reads prove it without heavy per-card contract fanout.
- Reown AppKit stays as the wallet baseline; thirdweb is scoped to direct card funding unless a
  later architecture decision explicitly changes the wallet stack.
- Hono migration belongs inside this plan's `state_api` lane, not a new lane.
- Public browser calls use existing `VITE_API_BASE_URL`; do not add `VITE_AGENT_PUBLIC_API_URL` unless
  a later deployment decision requires a separate Agent base URL.
- Browser-facing Agent routes use `/public/*`; thirdweb provider callbacks use `/webhooks/thirdweb`.
- `/public/*` routes are unauthenticated but rate-limited, origin-checked, payload-capped, and
  safe-error only.
- `/api/*` remains bearer-protected internal/admin API.
- `PublicFundingAvailability` does not make Agent the general read aggregator in this pass.
- Direct card funding is not considered shipped until provider checkout, webhook/status
  reconciliation, and onchain funding confirmation are proven for the target Garden funding path.
- Card `Endow` uses a thirdweb embedded wallet receiver/recovery model before it can be public-live.
- Card `Endow` management is deferred to the installed/open app; the public browser only shows receipt
  and recovery handoff in this pass.
- Unproven card methods are hidden by default; `comingSoon` is curated only when explicitly configured.
- Current Agent SQLite storage is acceptable for the planned ledger unless implementation discovers a
  hard blocker.
- `Donate` is the chosen public term for Cookie Jar direct funding.
- `Endow` is the chosen public term for Vault support.
- Luma Plus/API is the intended subscription backend through `packages/agent`, using single opt-in with
  explicit consent.
- Google appointment scheduling remains a configured external URL.
- All new user-facing strings are added to `en`, `es`, and `pt`.

References:

- thirdweb TransactionWidget / onchain transaction payment:
  <https://portal.thirdweb.com/bridge/transactions>
- thirdweb webhook verification:
  <https://portal.thirdweb.com/payments/webhooks>
- Reown AppKit React / Wagmi:
  <https://docs.reown.com/appkit/react/core/installation>
- Luma Import People:
  <https://docs.luma.com/reference/post_v1-calendar-import-people>
- Luma API:
  <https://help.luma.com/p/luma-api>
