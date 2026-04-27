# Public Browser Editorial UI Spec

## Summary

Implement a public browser editorial surface in `packages/client` while preserving the installed
PWA route split. The work should begin with plan/design alignment, then move through state/API,
UI, and QA lanes.

## Functional Requirements

1. Browser `/` renders the editorial homepage under `PublicShell`.
2. Installed PWA `/` continues to route to `/home`.
3. `/landing` redirects to `/`.
4. `SiteHeader` nav order is `Gardens`, `Impact`, `Fund`, `Actions`.
5. Header primary CTA is `Install App`.
6. Header/app install behavior reuses `useInstallGuidance`.
7. Wallet connect is removed from the public header and deferred to funding submit flow.
8. Homepage hero uses the locked Garden poster structure.
9. Homepage curated Gardens use client-local typed content with recent-active fallback.
10. Homepage closes with a `Get In Touch` module that supports `POST /public/subscribe` email signup and scheduling a call through a configured Google appointment URL.
11. `/fund?garden=<garden-id-or-slug>` resolves exact Garden id/address first, accepts a slug only when exactly one Garden derives that slug, and sends stale, missing, or ambiguous references to the normal Fund page with a localized non-blocking message. Slug derivation reuses or extracts the existing `publicGardenHelpers.deriveSlug` normalization contract and tests case-insensitivity, punctuation normalization, empty-name address fallback, stale references, and collisions.
12. `/impact` shows only confirmed evidence and hides unavailable metrics.
13. `/fund` supports a clear `Donate` vs `Endow` intent choice where funding is available.
14. `Donate` maps to Cookie Jar direct funding; `Endow` maps to Vault support designed to preserve the visitor's deposit while yield supports the Garden.
15. After funding intent, visitors choose `Card` or `Wallet` where the method is proven available.
16. Reown AppKit remains the wallet funding path; thirdweb Pay is the preferred direct-card funding spike.
17. thirdweb proves Cookie Jar / `Donate` first, then Vault / `Endow`.
18. Funding success copy requires onchain confirmation.
19. Homepage email subscription uses Luma Calendar People import through the Agent API.
20. `/fund` remains support-only: no public withdrawals or admin controls.
21. `/actions` is read-only and does not add public create/edit flows.
22. `/impact` uses a dedicated public assessment/evidence hook for readable evidence cards.

## Non-Functional Requirements

- Public-browser components live in `packages/client` unless there is proven shared reuse.
- New user-facing strings land in `en`, `es`, and `pt`.
- Use canonical domain vocabulary.
- Use semantic Warm Earth tokens.
- Use Fraunces only for public-browser editorial headings/stat moments.
- Respect reduced motion.
- Keep accent color volume low.
- Do not hardcode unsupported impact, funding, or Hypercert claims.
- Avoid dual wallet prompts: `Card` uses the direct-card provider path, `Wallet` uses Reown/wagmi.

## Data Requirements

- `usePublicGardens` supplies Garden list/summary data.
- `usePublicGardenDetail` supplies Garden detail, public Work, contributor, and Assessment count.
- `usePublicStats` supplies aggregate public counts.
- `usePublicFieldNotes` supplies public Work feed data where needed.
- Vault availability/depositor data may use existing indexer-backed Vault reads.
- Cookie Jar aggregate display stays conservative unless current public reads prove it cheaply.
- Homepage contact configuration supplies the public Agent subscription route and Google appointment booking URL; Luma calendar/tag/provider details stay server-side.
- Email subscription uses a public, rate-limited `packages/agent` API route to import single opt-in,
  consenting subscribers into Luma Calendar People with a preconfigured Green Goods tag.
- The Luma API key, calendar id, and tag configuration stay server-side.
- If Luma import is unavailable, the UI must show an honest failure or fallback contact handoff and
  avoid fake success states.
- Planned root environment contract:
  - public browser config: existing `VITE_API_BASE_URL`, `VITE_GOOGLE_APPOINTMENT_URL`,
    `VITE_THIRDWEB_CLIENT_ID`
  - server-only Agent config uses the repo varlock pattern:
    `LUMA_API_KEY_OP_REF` / `LUMA_API_KEY`, `LUMA_CALENDAR_ID`, `LUMA_GREEN_GOODS_TAG_ID`,
    `THIRDWEB_SECRET_KEY_OP_REF` / `THIRDWEB_SECRET_KEY`,
    `THIRDWEB_WEBHOOK_SECRET_OP_REF` / `THIRDWEB_WEBHOOK_SECRET`,
    `AGENT_PUBLIC_ALLOWED_ORIGINS`, `AGENT_TRUSTED_PROXY_HOPS`, and optional
    `AGENT_TRUSTED_PROXY_CIDRS`
- Do not add `VITE_AGENT_PUBLIC_API_URL` unless a later deployment decision requires a separate Agent
  public API base; `.env.schema` remains canonical and generated env typings are refreshed during
  implementation.
- Planned Agent route paths are `POST /public/subscribe`, `POST /public/funding-intents`,
  `GET /public/funding-intents/:id`, and `POST /webhooks/thirdweb`; existing internal/admin routes
  remain bearer-protected under `/api/*`.
- `/public/*` routes are unauthenticated but origin-checked, rate-limited, payload-capped, and
  safe-error only.
- Public route contracts are written as TypeScript-style request/response shapes for subscription,
  funding-intent creation, receipt reads, safe errors, and normalized thirdweb events.
- Framework-free public route/type contracts live in a server-safe shared subpath,
  `packages/shared/src/public-contracts`, exported as `@green-goods/shared/public-contracts` for Agent
  and Client use. The subpath must be type/data only: no React, Vite `import.meta`, browser globals,
  styles, providers, hooks, or side effects. Implementation must add the subpath to
  `packages/shared/package.json` exports, add client TypeScript/Vite resolution where needed, and confirm
  Agent imports the subpath through package exports without touching the shared root. Public browser
  components remain in `packages/client`.
- Seeded handoff fixtures live under this plan hub's `artifacts/fixtures` area, with implementation
  tests copying or importing them where package boundaries require it.
- `POST /public/funding-intents` returns a receipt URL in the form
  `/fund?intent=<id>#receiptToken=<token>`.
- `GET /public/funding-intents/:id` receives the token only through the `X-GG-Receipt-Token` header;
  the API rejects receipt tokens sent by query param or JSON body.
- Receipt-bearing responses from `POST /public/funding-intents` and
  `GET /public/funding-intents/:id` must set `Cache-Control: no-store` and `Pragma: no-cache`, and tests
  must prove those headers are present so private receipt state is not cached by browsers,
  intermediaries, or CDNs.
- Receipt tokens are opaque bearer secrets, stored server-side as a hash or equivalent verifier, and
  must not be logged, stored raw, sent to analytics, or included in server-rendered URLs.
- Receipt-token analytics protection uses a dual guard. Client root or an equivalent pre-pageview
  bootstrap must extract `#receiptToken=<token>`, persist it only in memory or short-lived session state
  needed for the receipt read, and immediately call `history.replaceState` before initial pageview
  tracking or receipt view mount. `usePageView` itself must also redact sensitive hash keys including
  `receiptToken`, so `page_view.hash` never contains the token even if a future route misses the
  pre-scrub. Tests cover root pre-scrub, initial pageview capture, generic hash redaction, and hash
  cleanup.
- Public funding receipt responses redact `payerEmail`, provider ids, event history, raw failure details,
  webhook payloads, and server-only reconciliation metadata.
- Public funding-intent creation responses expose only a short-lived client-safe `checkoutSession` /
  `checkoutPayload` needed to render or continue checkout. The checkout payload is an allowlisted,
  JSON-safe shared type with no `Record<string, unknown>` escape hatch. Durable provider
  session/payment/event ids, raw provider payloads, webhook payloads, receipt tokens, and unknown nested
  checkout fields are never returned in public route responses; tests must reject them.
- Funding intent creation never subscribes visitors to updates. `payerEmail` is receipt/recovery data
  only; receipt UI may offer updates through a separate `POST /public/subscribe` call with
  `consent: true`, `source: "fund_receipt"`, and locale.
- `state_api` migrates the current Agent HTTP server from Fastify to Hono before adding public
  subscription, funding-intent, and provider webhook routes.
- The Hono migration keeps existing bot handlers, services, SQLite storage, and the `packages/agent`
  package boundary intact; Fastify can be removed once no imports remain.
- Hono migration must preserve `/health`, `/ready`, `/webhook/telegram`, platform webhook allowlist
  behavior, `/api/feedback`, `/api/notify`, polling and webhook startup modes, graceful shutdown, and
  existing `/api/*` bearer auth semantics.
- Hono route tests replace Fastify inject tests; Fastify is removed only after source, tests, and
  package dependencies no longer import it.
- Public Agent API routes enforce CORS/origin allowlists, payload caps, route-specific rate limits,
  safe client errors, consent audit fields, and PII handling for subscriber email and `payerEmail`.
- Public route rate-limit identity is route-specific: subscribe keys by normalized email plus IP/origin
  bucket; funding-intent creation keys by IP/origin plus Garden/destination/intent bucket; receipt
  reads key by intent id plus IP/origin bucket. Thirdweb webhooks use two-stage throttling: a
  pre-verification IP/origin plus provider-route bucket for invalid-signature floods, then a
  post-verification provider account/signature bucket. Provider event ids and idempotency keys are used
  for replay/idempotency storage, not as the only rate-limit discriminator. Safe errors must not reveal
  whether an email, receipt token, provider id, or intent exists.
- Public route rate-limit thresholds use the moderate v1 profile: `POST /public/subscribe` allows
  `5/hour` per normalized email plus IP/origin bucket; `POST /public/funding-intents` allows
  `10/10min` per IP/origin plus Garden/destination/intent bucket; `GET /public/funding-intents/:id`
  allows `60/10min` per intent id plus IP/origin bucket; `POST /webhooks/thirdweb` allows `300/min`
  per pre-verification route/IP bucket and `300/min` per verified provider bucket.
- Hono public routes use a shared `publicRateLimitKey` helper. The helper hashes email/intent
  components before storing keys, normalizes origin, and derives IP from the socket/connection by
  default. `X-Forwarded-For` / `Forwarded` headers are trusted only when server-only trusted-proxy
  config is set; spoofed or untrusted proxy headers are ignored and covered by tests.
- Agent API route classes are explicit:
  - public, rate-limited browser routes for subscription and funding-intent create/read
  - provider webhook routes verified by provider signatures and raw-body checks
  - existing bearer-protected `/api/*` internal/admin routes
- Hono middleware or local helpers provide CORS/origin allowlists, payload size caps, safe errors, and
  route-specific rate limits. Webhook handlers read and verify the raw request body before JSON parsing.
- Funding availability is exposed through a planned `PublicFundingAvailability` contract keyed by
  Garden id/address, destination type/address, funding intent, payment method, chain, token, and
  provider.
- `PublicFundingAvailability.state` is `live`, `comingSoon`, `hidden`, or `disabled`, with stable
  `reasonCode` plus optional params, min/max amount where known, destination address, and required proof
  status. UI owns localized user-facing availability text in `en`, `es`, and `pt`.
- `PublicFundingAvailability.reasonCode` values are `no_destination`, `proof_pending`,
  `provider_unavailable`, `chain_unsupported`, `token_unsupported`, `config_missing`, and `disabled`.
- `PublicFundingAvailability.reasonCode` semantics define allowed states, required params, and localized
  UI copy expectations for each code; proof/provider codes are hidden by default, and `comingSoon`
  remains intentionally curated only.
- Amount bounds stay on `PublicFundingAvailability` as `minAmount` / `maxAmount` metadata for UI
  controls. Selected-amount failures are not base availability reason codes; they are returned by a
  funding quote/create validation path using `PublicApiError.errorCode` values `amount_below_min` /
  `amount_above_max` with safe `fieldErrors.amountUsd` and optional min/max `params`.
- Shared public read helpers derive Wallet / Donate / Endow availability from current public Vault and
  Cookie Jar reads where possible; Agent is not the general availability read aggregator in this pass.
- Card methods are hidden unless the provider proof registry marks that exact Garden/destination/intent/
  token/chain/provider as live or intentionally coming soon.
- The provider proof registry is code-owned, consumed by `PublicFundingAvailability`, keyed by Garden
  id/address, destination type/address, intent, payment method, chain, token, and provider, and has
  `hidden`, `comingSoon`, or `live` states. Absence means `hidden`; `live` requires proof reference or
  test/spike evidence for that exact tuple.
- Unproven card methods are `hidden` by default; `comingSoon` is intentionally curated only.
- Direct card funding uses a provider-neutral, durable `FundingIntent` ledger before binding to any
  one vendor.
- `FundingIntent` creation is card-only for v1. Wallet funding remains Reown AppKit + wagmi/viem
  client-side and does not create Agent funding intents or Agent receipt reads in this pass.
- `CreateFundingIntentRequest` includes `destinationAddress`, `availabilityKey`, and `clientRequestId`.
  `clientRequestId` is a client-generated opaque idempotency key for retries and double-submit
  protection. The Agent scopes it to the normalized request fingerprint; exact replays return the
  existing intent/checkout state, while mismatched replays return a safe `idempotency_conflict` error.
- The normalized idempotency fingerprint is computed from the exact field set: normalized `gardenId`,
  `destinationType`, lowercased `destinationAddress`, `fundingIntent`, `paymentMethod`, canonical decimal
  `amountUsd`, decimal-string `chainId`, lowercased `token`, canonical `availabilityKey`, `provider`,
  and normalized `payerEmail` hash when `payerEmail` is present. Normalization trims strings, lowercases
  addresses and email, uses contract enum literals, rejects invalid decimal amount formats before
  fingerprinting, and stores the email hash rather than raw `payerEmail` in idempotency keys.
- `availabilityKey` uses a shared canonical v1 builder from `@green-goods/shared/public-contracts`:
  `v1:<gardenKey>:<destinationType>:<destinationAddress>:<fundingIntent>:<paymentMethod>:<chainId>:<token>:<provider>`.
  Addresses are lowercased, enum values use contract literals, chain ids are decimal strings, and
  Garden ids/addresses are trimmed/lowercased before encoding. The Agent recomputes this key from live
  reads and the provider proof registry; it rejects mismatches or non-live card rails with a safe
  `funding_unavailable` response.
- `FundingIntent` tracks intent id, Garden, destination type/address, funding intent, payment method,
  USD amount, asset amount/decimals, quoted asset amount, minimum asset amount, slippage bps, provider
  fee amount/USD, origin/destination token metadata where supplied, chain, token, receiver wallet,
  provider/session/payment/event ids, status, transaction sequence, canonical funding transaction hash,
  payer email, receipt-token hash or equivalent verifier, failure reason, confirmation depth,
  confirmation start/deadline timestamps, quote/session expiry, status transition history or equivalent
  timestamps, and created/updated timestamps.
- The transaction sequence model stores `transactionAttempts[]` with role, status, tx hash where known,
  chain id, token, destination/receiver context, submitted/confirmed timestamps, provider event id, and
  failure code. Roles include allowance reset, approval, funding/deposit, and share verification. Only
  the confirmed funding/deposit attempt becomes the canonical `fundingTxHash`; approval/reset hashes do
  not mark the Garden funded.
- `payerEmail` is for funding receipt/recovery only unless the visitor separately consents to updates.
- `FundingIntent` persists in Agent API storage with unique provider session/payment/event guards,
  lookup by intent id, provider session id, provider payment id, submitted transaction hash, and
  canonical `fundingTxHash`, with code-owned status precedence.
- FundingIntent storage uses current Agent SQLite patterns with a migration/version approach using
  `PRAGMA user_version` or a small `schema_meta` table.
- FundingIntent storage includes `funding_intents` and `funding_intent_events` or equivalent
  transition-history storage, with unique indexes for provider session id, provider payment id,
  provider event id, and tx hash where present.
- Funding statuses are `started`, `pending_provider`, `pending_onchain`, `funded`, `failed`,
  `expired`, `funded_late`, and `refunded`.
- Funding status transitions are explicit: `started -> pending_provider -> pending_onchain -> funded`,
  pending states may become `failed` or `expired`, `funded` may become `refunded` only when proven, and
  older pending events cannot overwrite `funded`, `funded_late`, `failed`, `expired`, or `refunded`.
- Abandoned `started` and `pending_provider` card intents expire at provider checkout expiry, or
  `createdAt + 30 minutes` when provider expiry is missing. Receipt reads and provider-status checks
  reconcile stale pending intents before returning public state, and Agent adds a scheduled sweep to
  expire stale pending intents for visitors who never return.
- `expired` is terminal for pending/provider events but has one explicit reconciliation exception: a
  later confirmed onchain funding transaction that matches the intent, provider session, Garden,
  destination, receiver, token, chain, and `minAssetAmount` may move `expired -> funded_late`.
  `funded_late` is terminal, uses the same public success treatment as `funded`, and records the late
  confirmation timestamp and canonical `fundingTxHash`.
- Provider callbacks/webhooks must be idempotent, replay-safe, tolerant of out-of-order events, and
  unable to overwrite terminal states with older pending events.
- The thirdweb spike must prove direct execution or settlement of the actual Garden funding path;
  a wallet top-up alone is not enough to claim direct card funding.
- The thirdweb spike must prove the full ERC-20 approval plus funding transaction sequence:
  Cookie Jar allowance/approval/deposit for `Donate`, and Vault allowance reset if needed,
  approval, preview/slippage, deposit, and share ownership for `Endow`.
- `FundingIntent.id` is included in thirdweb purchase/custom data for webhook/status reconciliation.
- Card `Endow` uses thirdweb embedded wallet only inside the card Endow path, and must prove
  receiver wallet creation/recovery plus Vault-share ownership before the method is shown as live.
- Card `Endow` success shows receipt, canonical funding transaction hash (`fundingTxHash`), receiver
  wallet, recovery explanation, and `Install App` / `Open App` management CTA. No public withdrawal/
  manage controls ship in this pass.
- Public `Endow` copy uses "designed to preserve your deposit while yield supports the Garden" and
  includes short smart contract, token, yield, provider, and wallet recovery risk copy.
- Provider callbacks/webhooks must be verified and the onchain transaction confirmed before marking
  an intent funded; confirmation must match Garden, destination, receiver, token, and chain, with
  destination amount greater than or equal to `minAssetAmount`.
- Agent uses viem with an RPC URL resolved from existing server/shared configuration to poll the
  submitted transaction receipt and decode expected Cookie Jar or Vault logs/events as the v1 onchain
  confirmation source.
  `state_api` adds a server-only `resolveAgentRpcUrl(chainId, env)` helper that reads existing
  chain-specific env first (`ETHEREUM_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_RPC_URL`,
  `CELO_RPC_URL`, `OPTIMISM_RPC_URL`, and test-only `VITE_RPC_URL_11155111` where applicable), then
  falls back to `getNetworkConfig(chainId, ALCHEMY_API_KEY || ALCHEMY_KEY || "demo").rpcUrl`. The
  resolved RPC URL is stored on Agent config and injected into `initBlockchain` and the funding
  confirmation client; do not add a new public API base URL for this.
  One confirmed block is enough for v1 unless existing chain config defines a higher confirmation
  depth. Indexer evidence may be recorded as secondary proof, but v1 funding success does not depend
  on indexer freshness.
- Cookie Jar Donate success requires confirmed onchain funding into the expected Cookie Jar
  destination, matching Garden, chain, token, receiver/donor context where available, and destination
  amount greater than or equal to `minAssetAmount`.
- Vault Endow success requires confirmed Vault deposit plus Vault-share ownership by the intended
  receiver wallet, matching Garden, vault, chain, token, receiver, and destination amount greater than
  or equal to `minAssetAmount`.
- Provider success alone never marks an intent funded.
- Donate explanatory copy must use direct support framing and must not imply tax deductibility,
  charitable status, nonprofit status, or legal receipt unless separately configured and reviewed.
- `/impact` assessment/evidence data exposes only visitor-safe fields: Garden, title, domain, time
  window, summary, attestation/evidence availability, EAS reference where available, and source-dialog
  detail.
- `/impact` assessment/evidence data supports newest-first sorting, finite page size, local page/offset
  slicing over the capped fetched set, explicit empty states, and explicit EAS failure states.
- `/impact` v1 uses current shared EAS reads with a default page size of `12`, a fetch cap of `50`
  Gardens and `100` assessment/evidence records, and finite client-side slicing; newest-first sorting
  is global only within the fetched slice.
- `/impact` v1 candidate Gardens are sorted by latest public activity desc, then stable id/address asc;
  fetch at most `50` Gardens from that deterministic order and at most `100` assessment/evidence
  records across that capped set. `sourceLimitReached` is true when either cap is hit before the
  available candidate set is exhausted.
- Preferred `/impact` v1 implementation adds a shared EAS read option for finite per-Garden limit/order
  where practical. If the current shared read path cannot limit per Garden without disproportionate
  churn, document per-Garden overfetch as an accepted v1 limitation, apply the local `100` record cap,
  preserve `sourceLimitReached`, and keep Agent/indexer aggregation as the scale path.
- `/impact` v1 exposes loading, empty, `partialData`, `sourceLimitReached`, and EAS-failure states;
  Agent/indexer aggregation is documented as the scale path once assessment volume makes full-fetch reads
  too expensive.
- UI may start when `status.json.contract_stability_checklist` is complete: route paths, public types,
  seeded fixtures, `/fund?garden` behavior, availability reason semantics, contact endpoint behavior,
  public receipt shape, provider proof registry, and `/impact` hook shape are stable. UI does not wait
  for all card methods to be live; unavailable card rails remain hidden unless intentionally
  `comingSoon`.
- `contract_stability_checklist.items[].status` may be `planned`, `in_progress`, `complete`, or
  `blocked`; all required items must be `complete` before the checklist status becomes `complete`.
- UI remains `manual_blocked: true` until the explicit plan-hub lane operation moves `ui` to `ready`
  and records a history note.
- Source morph motion requires unique transition names per item; if uniqueness or browser support is
  unclear, UI falls back to simple fades.
- Public dialogs have labelled titles, focus handling, escape/overlay close behavior, mobile bottom
  sheet behavior, and reduced-motion fallbacks.

## Package / Lane Mapping

| Lane | Owner | Scope |
| --- | --- | --- |
| `state_api` | Codex | Hono Agent API migration with compatibility checks, concrete `/public/*` and `/webhooks/thirdweb` route contracts, public hook naming cleanup, `/fund?garden=...` resolution contract, aggregate helper shape, curation/contact data contract, `PublicFundingAvailability`, public assessment/evidence finite local slicing, split Agent API ownership/protections, root env contract, card-only strict `FundingIntent` SQLite storage/reconciliation, receipt-token protected public reads, thirdweb direct-card/embedded-wallet spike contract, Luma subscription contract. |
| `ui` | Claude | Public homepage, cards, dialogs, route layouts, install UI, `Get In Touch` closing, `Donate`/`Endow` funding choice, hidden-by-default card methods, Card Endow receipt/app handoff, stale `/fund?garden` messaging, risk-safe Endow copy, unique/fallback motion behavior, `DESIGN.browser.md` update. Manually blocked until `status.json.contract_stability_checklist` is complete. |
| `contracts` | Codex | `n/a`; no contract changes expected. |
| `qa_pass_1` | Claude | Browser screenshot/story validation and design acceptance. |
| `qa_pass_2` | Codex | Repo gates, route tests, plan/design consistency review. |

## Risks

- Risk: homepage narrative says Assessment happens before Work in the formal data model.
  - Mitigation: use "Assess the place" as visitor-facing narrative language and keep formal
    Assessment evidence in `/impact`.
- Risk: manual featured Gardens go stale.
  - Mitigation: typed curation module plus recent-active fallback.
- Risk: public header install CTA loses wallet access for funders.
  - Mitigation: wallet connect remains inside funding dialogs at the final wallet-required step.
- Risk: Storybook looks correct but runtime Tailwind misses classes from shared components.
  - Mitigation: keep new public-browser layout components in `packages/client`.
- Risk: email subscription UI implies a working list signup without a configured provider.
  - Mitigation: state/API lane owns Agent API + Luma import; UI shows honest failure/fallback states if import is unavailable.
- Risk: thirdweb card checkout only tops up a wallet instead of funding a Garden.
  - Mitigation: spike must prove Cookie Jar / `Donate` first, then Vault / `Endow`, before public copy says direct card funding is live.
- Risk: card `Endow` implies visitor-owned principal without recoverable ownership.
  - Mitigation: card `Endow` uses thirdweb embedded wallet receiver/recovery and stays hidden by
    default until Vault-share ownership is proven; public completion shows receipt/recovery and routes
    management to Install/Open App.
- Risk: Endow copy overpromises deposit safety.
  - Mitigation: use "designed to preserve your deposit" with short risk copy for smart contract,
    token, yield, provider, and wallet recovery risks.
- Risk: UI hardcodes funding availability.
  - Mitigation: state/API owns `PublicFundingAvailability` with shared public read helpers and
    `reasonCode` values; unproven card methods are hidden by default.
- Risk: public Agent API leaks or mishandles PII.
  - Mitigation: state/API owns Hono route boundaries, env boundaries, origin controls, payload caps,
    consent audit fields, safe errors, raw-body webhook verification, and PII unsubscribe/privacy
    handling.
- Risk: card funding reconciliation rejects valid provider settlement because of fees or slippage.
  - Mitigation: store quoted/minimum destination amounts and require onchain confirmation at or above
    `minAssetAmount`, not exact quoted amount.
- Risk: adding thirdweb creates a second wallet system beside Reown.
  - Mitigation: keep Reown as the wallet baseline and scope thirdweb to direct-card funding only.
- Risk: provider lock-in makes future payment changes expensive.
  - Mitigation: use a provider-neutral `FundingIntent` and adapter boundary; keep provider-specific ids out of public domain models.
- Risk: UI starts before contracts are settled.
  - Mitigation: UI lane is blocked until state/API contracts are stable; unproven card methods are
    hidden by default.
