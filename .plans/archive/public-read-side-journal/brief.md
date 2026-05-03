# Public Browser Editorial UI Brief

## Problem

The current public browser surface is functional but reads like a placeholder app surface. It does
not yet carry the editorial weight needed for funders, community members, partners, and visitors.
It also lacks the aligned browser `/` gateway that should introduce Green Goods before routing
people into Gardens, Impact, Funding, Actions, or app install.

## Desired Outcome

- Browser `/` becomes the main editorial public gateway.
- Installed PWA `/` still routes to `/home`.
- `/landing` redirects to `/`.
- Public routes feel like a coffee-table garden journal crossed with a living public record.
- Visitors can understand the system in one scan:
  - explore Gardens
  - read credible impact evidence
  - choose whether to `Donate` directly or `Endow` through Vault support designed to preserve the
    visitor's deposit while yield helps the Garden
  - pay with wallet or, after provider proof, card
  - understand Actions
  - get in touch by subscribing or scheduling a call with the team
  - install/open the app for field participation

## Audience

- Funders deciding whether and where to support Garden work.
- Community members trying to understand what is happening in Gardens.
- Visitors and partners arriving from public links.
- Gardeners who need a browser-to-app handoff.

## Scope

In scope:

- Browser `/` editorial gateway.
- `/landing` redirect behavior.
- `SiteHeader` nav order and install CTA plan.
- Public page plans for `/gardens`, `/gardens/:id`, `/impact`, `/fund`, and `/actions`.
- Client-local curation plan for homepage featured Gardens.
- Homepage `Get In Touch` closing plan with `POST /public/subscribe` email subscription and Google
  appointment scheduling.
- Direct funding rails plan:
  - `Donate` maps to Cookie Jar direct funding.
  - `Endow` maps to Vault support designed to preserve the visitor's deposit while yield helps the
    Garden.
  - Reown AppKit remains the wallet path.
  - thirdweb Pay is spiked for card funding after the intent/destination is chosen.
  - card `Endow` uses a thirdweb embedded-wallet receiver/recovery model.
  - unproven card methods are hidden by default.
- Public funding availability contract and Card Endow receipt/app-management handoff.
- Strict provider-neutral `FundingIntent` ledger and Hono-first split Agent API route plan.
- Concrete public Agent route paths using `/public/*` plus thirdweb callbacks at
  `/webhooks/thirdweb`.
- Hono migration compatibility plan for existing health, webhook, internal API, startup, shutdown, and
  auth behavior.
- FundingIntent storage/reconciliation plan with provider uniqueness, purchase/custom data, and full
  approval/deposit proof using quoted/minimum destination amount matching.
- Multi-transaction FundingIntent sequence model for card flows, with allowance reset, approval,
  funding/deposit, and share-verification attempts stored separately from canonical `fundingTxHash`.
- Card-only `FundingIntent` scope for this pass; wallet funding stays Reown AppKit plus wagmi/viem
  without Agent receipt tracking.
- Receipt-token protected public funding status/receipt reads with redacted public-safe receipt fields.
- Receipt URLs use `/fund?intent=<id>#receiptToken=<token>` and API receipt reads accept the token only
  through `X-GG-Receipt-Token`; query/body tokens are rejected and raw tokens are not logged or sent to
  analytics.
  Client receipt handling uses a dual guard: root/equivalent pre-pageview scrub removes the fragment with
  `history.replaceState` before initial analytics, and `usePageView` redacts sensitive hash keys.
  Receipt-bearing create/read responses use `Cache-Control: no-store` and `Pragma: no-cache`.
- TypeScript-style public route contracts for subscription, funding-intent creation, receipt reads, safe
  errors, and normalized thirdweb events, owned as framework-free shared contracts in the server-safe
  `@green-goods/shared/public-contracts` subpath.
  The implementation plan includes package export plus client TypeScript/Vite resolution for that subpath.
- Seeded handoff fixtures under this plan hub's `artifacts/fixtures` area for availability, funding,
  contact, `/fund?garden`, and `/impact` contract work.
- FundingIntent SQLite migration/versioning and event/history storage plan.
- Funding intent creation never subscribes a visitor to updates; update signup remains a separate
  explicit `POST /public/subscribe` call.
- Funding intent creation includes `destinationAddress`, canonical v1 `availabilityKey`, and
  `clientRequestId`; Agent recomputes the exact availability/proof tuple, uses a pinned normalized
  idempotency fingerprint, handles idempotent retries, and rejects drift, non-live card rails, or
  idempotency conflicts.
- Abandoned `started` and `pending_provider` card intents expire at provider expiry or a 30-minute
  fallback through read-time reconciliation plus scheduled sweep.
- Late matching onchain success after expiry can move `expired -> funded_late` only when the funding tx
  matches the original intent/provider session and all Garden/destination/receiver/token/chain/min-amount
  checks.
- Destination-specific Cookie Jar Donate and Vault Endow reconciliation rules.
- Agent-side viem receipt/log polling as the v1 card-funding onchain confirmation source, with indexer
  evidence treated as secondary.
- Agent viem confirmation RPC resolved by a server-only helper that reads existing chain-specific envs
  before shared network fallback, then injects the resolved URL into `initBlockchain` and the
  confirmation client.
- Public funding intent creation responses expose only allowlisted JSON-safe client checkout data; durable
  provider ids, raw provider/webhook payloads, receipt tokens, and unknown nested checkout fields stay
  server-only and are redacted or rejected from public responses.
- Explicit `PublicFundingAvailability.reasonCode` enum with state/params semantics and localized UI copy;
  amount-specific min/max failures are quote/create validation, not base availability.
- Code-owned provider proof registry for exact card rail tuples; absent proof entries are hidden.
- Luma-backed single opt-in update subscription plan through `packages/agent`.
- Agent API/env config boundaries, existing `VITE_API_BASE_URL` public routing, route protections,
  consent audit, and PII handling.
- Dedicated public assessment/evidence hook plan for `/impact`.
- `/impact` v1 shared-EAS finite slicing, pagination, sorting, explicit overfetch behavior, empty, and
  EAS failure behavior.
- Deterministic `/impact` v1 source selection: latest-activity Garden ordering, max 50 Gardens, max 100
  assessment/evidence records, and `sourceLimitReached` semantics.
- UI unblock criteria based on `status.json.contract_stability_checklist` rather than fully live card
  rails or full `state_api` completion.
- Explicit UI unblocking operation after required checklist items become complete; UI remains manually
  blocked until that plan-hub lane command runs.
- Donate/support copy guard that prevents tax-deductible, charitable-status, nonprofit-status, or
  legal-receipt claims.
- `/fund?garden=...` exact id/address-first resolution, unique-slug fallback only, and stale/missing/
  ambiguous non-blocking message behavior, using or extracting `publicGardenHelpers.deriveSlug`.
- Route-specific public rate-limit keys for subscription, funding-intent creation, receipt reads, and
  two-stage thirdweb webhook throttling, with trusted-proxy/header rules and locked v1 thresholds.
- Validation and screenshot expectations.

Out of scope:

- Public-side conviction voting.
- Public withdrawals.
- Replacing the core Reown AppKit / wagmi / viem wallet stack.
- New public route families beyond browser `/`.
- Root `DESIGN.md` changes.
- Admin, contracts, and indexer runtime changes.
