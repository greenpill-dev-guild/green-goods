# Discovery Notes - Public Browser Editorial UI

**Slug:** `public-read-side-journal`
**Lane:** Discovery / Plan alignment
**Updated:** 2026-04-26
**Source of truth:** `.plans/active/public-read-side-journal/plan.todo.md`

This file replaces the earlier discovery notes that constrained the refresh to the four
existing public routes only. The aligned product direction now includes browser `/` as the
public editorial gateway while keeping the installed PWA root behavior intact.

## Confirmed Repo Facts

- Browser/public routes live under `PublicShell` and use `SiteHeader`.
- Installed/authenticated PWA routes live under `AppShell` and use the bottom `AppBar`.
- `PlatformRouter` currently sends installed PWA `/` to `/home`; this behavior stays.
- Public route families currently include:
  - `/landing`
  - `/gardens`
  - `/gardens/:id`
  - `/impact`
  - `/fund`
  - `/actions`
- The updated plan changes browser `/` from redirect-only behavior into the editorial gateway.
- `/landing` becomes a legacy redirect to `/`.
- `SiteHeader` currently uses `Gardens`, `Actions`, `Impact`, `Fund`, and `Connect Wallet`; the new plan changes order and CTA.
- Existing public views are functional but visually flat and rely on basic inline card markup.
- Public hooks already exist for Garden summaries, Garden detail, Work reads, stats, and Season/volume-style public reads, but some file comments still carry stale vocabulary.
- `useInstallGuidance` already supports:
  - desktop QR / open-on-phone guidance
  - mobile OS/browser-specific install instructions
  - native install prompt when available
  - wrong-browser and in-app-browser handling
  - already-installed `Open App`

## Locked Product Decisions

- Browser `/` is a real editorial gateway under `PublicShell`.
- Installed PWA `/` still goes to `/home`.
- `/landing` redirects to `/`.
- Public nav order is `Gardens`, `Impact`, `Fund`, `Actions`.
- Header CTA is `Install App`, not wallet connect.
- Wallet connect is deferred to funding submit flow.
- `/` hero is a garden-poster first viewport:
  - full-bleed curated local Garden image
  - H1 `Green Goods`
  - supporting line `From good intentions to green outcomes`
  - primary `Explore Gardens`
  - secondary `Install App`
- Homepage featured Gardens use manual curation from a typed client content module.
- Curation uses Garden ids/addresses as canonical keys; slugs are display/routing aliases because
  current slugs are derived from mutable Garden names.
- If curated Gardens are missing, fall back to recent active Gardens.
- Featured layout is lead-plus-two.
- Public proof shows only confirmed counts: Gardens, contributors/gardeners, Work, Assessments.
- Public loop language is visitor-facing:
  - `Assess the place`
  - `Do the work`
  - `Verify impact`
  - `Fund what grows`
- That loop is narrative language and must not imply formal EAS Assessment happens before Work.
- Links should be contextual inside sections, not a final sitemap-style route grid.
- The closing section is `Get In Touch`, with an email field that calls `POST /public/subscribe` and a
  Google appointment link.
- Email subscription uses a public, rate-limited Agent API endpoint to import single opt-in,
  consenting emails into Luma Calendar People with a preconfigured Green Goods tag; Luma credentials
  stay server-side.
- Agent API route classes stay separate:
  - public rate-limited browser routes for subscription and funding-intent create/read
  - provider webhook routes verified by provider signatures and raw-body checks
  - bearer-protected `/api/*` internal/admin routes
- Concrete Agent route paths:
  - `POST /public/subscribe`
  - `POST /public/funding-intents`
  - `GET /public/funding-intents/:id` with required `X-GG-Receipt-Token`
  - `POST /webhooks/thirdweb`
  - existing bearer-protected internal/admin routes remain under `/api/*`
- `/public/*` routes are unauthenticated browser routes, but must be origin-checked, rate-limited,
  payload-capped, and safe-error only.
- Public route rate limits need route-specific identity keys: subscribe uses normalized email plus
  IP/origin bucket; funding-intent creation uses IP/origin plus Garden/destination/intent bucket;
  receipt reads use intent id plus IP/origin bucket; thirdweb webhooks use a pre-verification IP/origin
  plus provider-route bucket and a post-verification provider account/signature bucket. Provider event
  ids and idempotency keys are replay/idempotency data, not the only rate-limit discriminator. Safe
  errors must not reveal whether an email, receipt token, provider id, or intent exists.
- Moderate v1 public route rate-limit thresholds are locked as: `POST /public/subscribe` 5/hour per
  normalized email plus IP/origin bucket; `POST /public/funding-intents` 10/10 minutes per IP/origin
  plus Garden/destination/intent bucket; `GET /public/funding-intents/:id` 60/10 minutes per intent id
  plus IP/origin bucket; `POST /webhooks/thirdweb` 300/minute per pre-verification route/IP bucket and
  300/minute per verified provider bucket.
- Public rate-limit keys should be produced by a shared helper that hashes email/intent key material,
  normalizes origin, derives IP from the socket/connection by default, and trusts proxy headers only
  when server-only trusted-proxy config is set.
- `state_api` migrates the current `packages/agent` HTTP server from Fastify to Hono before adding
  public subscription, funding-intent, or thirdweb webhook routes.
- The Hono migration keeps existing bot handlers, services, SQLite storage, and package boundaries
  intact; Fastify can be removed after Hono fully replaces the HTTP server and no imports remain.
- Hono migration must preserve `/health`, `/ready`, `/webhook/telegram`, platform webhook allowlist,
  `/api/feedback`, `/api/notify`, polling/webhook startup modes, graceful shutdown, and `/api/*`
  bearer auth semantics.
- Reown AppKit remains the wallet connection baseline for wallet funding.
- thirdweb Pay is the preferred direct-card funding spike for non-crypto visitors.
- Direct card funding must mean funding the selected Garden path, not merely topping up a wallet.
- Direct card funding uses a strict provider-neutral card-only `FundingIntent` ledger with idempotent
  webhook reconciliation and onchain confirmation before success.
- Wallet funding stays Reown AppKit plus wagmi/viem and does not create Agent `FundingIntent` records in
  this pass.
- Public funding receipt/status reads require an opaque receipt token and return only redacted public-safe
  receipt fields.
- `POST /public/funding-intents` returns receipt URLs as `/fund?intent=<id>#receiptToken=<token>`;
  the browser extracts the fragment and calls `GET /public/funding-intents/:id` with
  `X-GG-Receipt-Token`.
- The API rejects receipt tokens sent by query param or JSON body, and raw receipt tokens are never
  logged, stored, sent to analytics, or included in server-rendered URLs.
- Receipt-bearing funding responses from create/read routes must set `Cache-Control: no-store` and
  `Pragma: no-cache`.
- Receipt-token analytics protection uses a dual guard: a client root or equivalent pre-pageview
  bootstrap extracts `#receiptToken`, stores the raw token only in memory or short-lived session
  state, and calls `history.replaceState` before initial pageview tracking or receipt view mount; and
  `usePageView` itself redacts sensitive hash keys including `receiptToken` so route-level cleanup is
  not the only protection.
- Public funding-intent creation responses expose only short-lived client-safe checkout data through an
  allowlisted JSON-safe checkout payload shape; durable provider session/payment/event ids, raw provider
  payloads, webhook payloads, receipt tokens, and unknown nested checkout payload fields stay server-only
  and are redacted or rejected from public responses.
- Funding intent creation never subscribes visitors to updates. `payerEmail` is receipt/recovery data
  only; receipt UI may offer updates through a separate `POST /public/subscribe` call.
- Public route contracts use TypeScript-style request/response shapes for subscribe, funding intent
  creation, receipt reads, safe errors, and normalized thirdweb events.
- Framework-free public route/type contracts live in `packages/shared/src/public-contracts`, exported as
  `@green-goods/shared/public-contracts`; implementation must add the subpath to
  `packages/shared/package.json` exports, add client TypeScript/Vite resolution where needed, and
  confirm Agent imports resolve through package exports without pulling the shared root. The subpath
  must be type/data only with no React, Vite `import.meta`, browser globals, styles, providers, hooks,
  or side effects. Seeded handoff fixtures live under this plan hub's `artifacts/fixtures` area.
- `FundingIntent` persists in the current Agent API storage pattern unless implementation proves
  SQLite is insufficient, and it needs unique provider session/payment/event guards plus lookup by
  intent id, provider session id, provider payment id, submitted transaction hash, and canonical
  `fundingTxHash`.
- FundingIntent storage uses current Agent SQLite patterns plus a migration/version approach using
  `PRAGMA user_version` or a small `schema_meta` table.
- FundingIntent storage includes `funding_intents` and `funding_intent_events` or equivalent
  transition-history storage with unique indexes for provider session id, provider payment id,
  provider event id, and tx hash where present.
- `FundingIntent.id` must be included in thirdweb purchase/custom data for webhook/status
  reconciliation.
- Funding intent creation binds to the exact live card rail by accepting `destinationAddress` and
  `availabilityKey`, and it requires `clientRequestId` for idempotent create retries. `availabilityKey`
  is built by shared canonical v1 encoding:
  `v1:<gardenKey>:<destinationType>:<destinationAddress>:<fundingIntent>:<paymentMethod>:<chainId>:<token>:<provider>`.
  Addresses are lowercased, enum values use contract literals, chain ids are decimal strings, and Garden
  ids/addresses are trimmed/lowercased. Agent recomputes it from live reads and the provider proof
  registry and rejects mismatches or non-live card rails with a safe `funding_unavailable` response.
- Funding intent create uses `clientRequestId` as an idempotency key. Exact retries return the existing
  checkout, while mismatched retries return `idempotency_conflict` without creating a duplicate intent.
  The idempotency fingerprint is computed from normalized Garden id, destination type/address, intent,
  method, amount, chain, token, availability key, provider, and normalized `payerEmail` hash when present.
- FundingIntent reconciliation stores quoted/minimum destination amount fields and treats success as
  confirmed onchain funding where the destination amount is greater than or equal to `minAssetAmount`.
- FundingIntent stores a multi-transaction sequence for card flows. Transaction attempts track role,
  status, tx hash, provider event id, destination/receiver context, timestamps, and failure code; only
  the confirmed funding/deposit attempt becomes canonical `fundingTxHash`.
- Abandoned card intents in `started` or `pending_provider` expire at provider checkout expiry, or
  `createdAt + 30 minutes` when provider expiry is absent. Receipt reads and provider-status checks
  reconcile stale pending intents before returning public state, and an Agent scheduled sweep expires
  stale pending intents for visitors who never return.
- Late matching onchain success after expiry moves `expired -> funded_late` only when the funding/deposit
  transaction matches intent id, provider session, Garden, destination, receiver, token, chain, and
  `minAssetAmount`; `funded_late` is terminal and public-success equivalent to `funded`.
- Agent-side viem receipt/log polling is the v1 onchain confirmation source after provider transaction
  submission; indexer evidence may be recorded as secondary proof but is not required for v1 success.
- Agent viem confirmation RPC should be resolved by a server-only helper that reads chain-specific
  envs first (`ETHEREUM_RPC_URL`, `SEPOLIA_RPC_URL`, `ARBITRUM_RPC_URL`, `CELO_RPC_URL`,
  `OPTIMISM_RPC_URL`, plus test-only `VITE_RPC_URL_11155111` where applicable), then falls back to
  `getNetworkConfig(chainId, ALCHEMY_API_KEY || ALCHEMY_KEY || "demo").rpcUrl`, stores the result on
  Agent config, and injects it into `initBlockchain` and confirmation clients.
- Public funding availability is explicit through `PublicFundingAvailability`; it returns stable
  `reasonCode` values plus params, while UI owns localized copy in `en`, `es`, and `pt`.
- `PublicFundingAvailability.reasonCode` enum is `no_destination`, `proof_pending`,
  `provider_unavailable`, `chain_unsupported`, `token_unsupported`, `config_missing`, and `disabled`.
- `PublicFundingAvailability` is derived from shared public Vault and Cookie Jar reads where possible;
  Agent does not become the general public read aggregator in this pass.
- Unproven card methods are hidden by default and coming-soon states are curated only.
- `PublicFundingAvailability.reasonCode` semantics define allowed states and required params for each
  code so UI can localize copy without inventing behavior.
- Amount-specific failures such as `amount_below_min` and `amount_above_max` are explicit
  `PublicApiErrorCode` values for local UI or server quote/create validation after an amount is selected,
  not base availability `reasonCode` values.
- A code-owned provider proof registry controls card rail exposure by exact Garden/destination/intent/
  payment method/chain/token/provider tuple. Absence means `hidden`; `live` requires proof reference or
  test/spike evidence.
- Funding UX is intent-first:
  - `Donate` means direct donation / direct funding through Cookie Jar.
  - `Endow` means Vault support designed to preserve the visitor's deposit while interest/yield helps
    the Garden.
  - `Card` and `Wallet` are payment methods chosen after intent.
- Donate explanatory copy should prefer support language and must not imply tax deductibility,
  charitable status, nonprofit status, or legal receipt unless separately configured and reviewed.
- Public Endow copy must include short risk language for smart contract, token, yield, provider, and
  wallet recovery risks.
- Card `Endow` uses thirdweb embedded wallet only inside the card Endow path; it must create or
  recover the receiver wallet that owns Vault shares before the card method is live.
- Card `Endow` completion shows receipt, canonical funding transaction hash (`fundingTxHash`), receiver
  wallet, recovery explanation, and Install/Open App management CTA; no public browser manage/withdraw
  controls are added.
- thirdweb proof order is Cookie Jar / `Donate` first, then Vault / `Endow`.
- thirdweb proof must cover the full ERC-20 approval plus funding transaction sequence:
  - Cookie Jar allowance / approval / deposit for `Donate`
  - Vault allowance reset if needed / approval / preview-slippage / deposit / share ownership for
    `Endow`
- Direct card success requires onchain confirmation.
- Cookie Jar / `Donate` reconciliation requires confirmed onchain funding into the expected Cookie Jar
  destination, matching Garden, chain, token, receiver/donor context where available, and destination
  amount greater than or equal to `minAssetAmount`.
- Vault / `Endow` reconciliation requires confirmed Vault deposit plus Vault-share ownership by the
  intended receiver wallet, matching Garden, vault, chain, token, receiver, and destination amount
  greater than or equal to `minAssetAmount`.
- Provider success alone never marks an intent funded.
- Planned root `.env.schema` config reuses existing `VITE_API_BASE_URL` for browser-to-Agent public
  calls; do not add `VITE_AGENT_PUBLIC_API_URL` unless a later deployment decision requires a separate
  Agent base URL.
- Planned public browser config adds only `VITE_GOOGLE_APPOINTMENT_URL` and `VITE_THIRDWEB_CLIENT_ID`;
  Luma API key/calendar/tag and thirdweb server/webhook secrets stay server-only.
- Generated env typings must be refreshed during implementation after `.env.schema` changes.
- Public Agent API routes need CORS/origin allowlist, payload caps, route-specific rate limits, safe
  client errors, consent audit fields, and PII handling for subscriber email and `payerEmail`.
- `payerEmail` for funding receipt/recovery is separate from newsletter/update consent.
- `/fund?garden=...` resolves exact Garden id/address first and accepts a slug only when exactly one
  Garden derives that slug; stale, missing, zero-match, or multiple-slug references fall back to the
  normal Fund page with a localized non-blocking message.
- `/fund?garden` slug matching must reuse or extract the existing `publicGardenHelpers.deriveSlug`
  normalization contract, with tests for case-insensitivity, punctuation normalization, empty-name
  address fallback, stale references, and slug collisions.
- UI may start once `status.json.contract_stability_checklist` is complete: route paths, public types,
  seeded fixtures, `/fund?garden` behavior, availability reason semantics, contact endpoint behavior,
  public receipt shape, provider proof registry, and `/impact` hook shape are stable. UI does not wait
  for every card payment method to be live.
- Checklist item statuses are `planned`, `in_progress`, `complete`, or `blocked`; UI remains manually
  blocked until the explicit plan-hub lane unblock command moves `ui` to `ready`.
- Provider fallback ranking for direct card funding:
  - thirdweb Pay / `TransactionWidget`
  - Crossmint Embedded / Headless Checkout
  - Stripe card payment plus backend/treasury executor
  - Privy or Dynamic embedded wallet plus card funding and sponsored tx
  - Coinbase Onramp / Reown AppKit On-Ramp
  - Transak On-Ramp / API

## Page-Specific Decisions

### `/`

The homepage is not another directory. It is the public gateway that answers what Green Goods is,
then routes visitors into Gardens, Impact, Funding, Actions, and app install.

### `/gardens`

Discovery and browsing. Editorial hero plus featured Gardens, then search/filter/sort and a
structured Garden grid.

### `/gardens/:id`

Full public Garden story page ordered Place -> Work -> Evidence -> Fund.

### `/impact`

Credible public evidence ledger. Use real counts and Assessment/evidence cards from a dedicated
public assessment/evidence hook. Hide unavailable oracle metrics and unsupported Hypercert
placeholders.

For v1, use current shared EAS reads with default page size `12`, candidate Gardens sorted by latest
public activity desc then stable id/address asc, a fetch cap of `50` Gardens and `100`
assessment/evidence records, finite local page/offset client-side slicing, newest-first sorting within
the fetched slice, explicit loading/empty/partial-data/source-limit/EAS failure states, and visitor-safe
source dialog fields.
`sourceLimitReached` is true when either cap is hit before the available candidate set is exhausted.
Preferred implementation adds a shared EAS read option for finite per-Garden limit/order where
practical. If the current shared read path cannot limit per Garden without disproportionate churn,
document per-Garden overfetch as an accepted v1 limitation, apply the local `100` record cap, and
preserve `sourceLimitReached`.
Agent/indexer aggregation is the later scale path once assessment volume makes full-fetch reads too
expensive.

### `/fund`

Trust first, then intent. Public remains support-only: `Donate` and `Endow` are allowed, but public
withdrawals and admin controls are not. Dialog opens before wallet connect; wallet prompt happens
only at the wallet-required step.

Funding method split:

- `Donate` routes to Cookie Jar direct funding.
- `Endow` routes to Vault support.
- `Card` uses the thirdweb direct-card spike path when proven for that intent/destination.
- Card `Endow` uses thirdweb embedded wallet receiver/recovery for Vault-share ownership.
- Card `Endow` management is deferred to Install/Open App after a public receipt/recovery handoff.
- Unproven card methods are hidden by default.
- `Wallet` uses the existing Reown AppKit + wagmi + viem deposit flow.
- Avoid presenting thirdweb as a replacement wallet stack in the main app.

### `/actions`

Readable Action library grouped/filterable by domain. Action cards open source-anchored readable
dialogs. No create/edit controls.

## Motion Notes

- Source morphs require unique transition names per item.
- Use simple fade fallback when uniqueness or browser support is unclear.
- Reduced-motion fallback remains required.

## Constraints To Preserve

- Do not add public-side conviction voting.
- Do not add public withdrawals.
- Do not create new route families beyond browser `/`.
- Do not update root `DESIGN.md`.
- New public-browser components live in `packages/client`, not `packages/shared`, unless there is
  a proven shared need.
- New user-facing strings require `en`, `es`, and `pt`.
- Use canonical vocabulary: Garden, Action, Work, Vault, Cookie Jar, Hypercert, Assessment,
  Attestation, Hat, Season.

## Files Previously Inspected

- `.plans/active/public-read-side-journal/plan.todo.md`
- `packages/client/DESIGN.browser.md`
- `packages/client/src/router.config.tsx`
- `packages/client/src/routes/PlatformRouter.tsx`
- `packages/client/src/routes/PublicShell.tsx`
- `packages/client/src/components/Navigation/SiteHeader.tsx`
- `packages/client/src/views/Landing/index.tsx`
- `packages/client/src/components/Layout/Hero.tsx`
- `packages/client/src/views/Public/Gardens.tsx`
- `packages/client/src/views/Public/GardenDetail.tsx`
- `packages/client/src/views/Public/Impact.tsx`
- `packages/client/src/views/Public/Fund.tsx`
- `packages/client/src/views/Public/Actions.tsx`
- `packages/shared/src/hooks/public/usePublicGardens.ts`
- `packages/shared/src/hooks/public/usePublicGardenDetail.ts`
- `packages/shared/src/hooks/public/usePublicStats.ts`
- `packages/shared/src/hooks/public/usePublicFieldNotes.ts`
- `packages/shared/src/hooks/app/useInstallGuidance.ts`
- `docs/docs/builders/journeys/persona-surfaces.mdx`
- `docs/docs/builders/journeys/evaluation.mdx`
- `docs/docs/builders/journeys/funding.mdx`
- `docs/docs/builders/journeys/work-submission.mdx`
