# Claude UI Handoff - Public Browser Editorial UI

## Goal

Implement the editorial public browser UI only after the state/API contracts are stable.

## Scope

- Browser `/` editorial homepage.
- `/landing` redirect to `/`.
- `SiteHeader` nav order and `Install App` CTA.
- Client-local public components:
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
- Page refreshes:
  - `/gardens`
  - `/gardens/:id`
  - `/impact`
  - `/fund`
  - `/actions`
- Update `packages/client/DESIGN.browser.md`.

## Locked Homepage Shape

- Full-bleed curated Garden hero image.
- H1 `Green Goods`.
- Line `From good intentions to green outcomes`.
- Primary `Explore Gardens`.
- Secondary `Install App`.
- Featured Gardens lead-plus-two.
- Proof band with confirmed counts only.
- Loop: `Assess the place` -> `Do the work` -> `Verify impact` -> `Fund what grows`.
- `Get In Touch` closing with an email field that calls `POST /public/subscribe` and a `Schedule a Call`
  Google appointment link.
- Contextual section links, no final route grid.

## Locked Funding UX

- `/fund` and Garden detail funding CTAs should support two clear intent choices where funding is
  available:
  - `Donate`
  - `Endow`
- `Donate` is direct donation / direct funding through Cookie Jar.
- Donate explanatory copy should prefer support language and must not imply tax deductibility,
  charitable status, nonprofit status, or legal receipt unless separately configured and reviewed.
- `Endow` is Vault support designed to preserve the visitor's deposit while interest/yield helps the
  Garden.
- `Endow` copy must include short risk language for smart contract, token, yield, provider, and
  wallet recovery risks.
- After intent selection, show payment methods:
  - `Card`
  - `Wallet`
- `Wallet` uses the existing Reown AppKit / wagmi path.
- Wallet funding does not create an Agent `FundingIntent` in this pass.
- `Card` uses the thirdweb direct-card path only after the state/API spike proves the exact
  intent/destination pair.
- Unproven card methods are hidden by default. Render `comingSoon` only when the state/API contract
  explicitly marks that state.
- Card `Endow` copy must explain that the visitor creates or recovers a thirdweb embedded wallet
  position that owns Vault shares; it is not a one-time donation.
- Card `Endow` success UI shows receipt, canonical funding transaction hash (`fundingTxHash`), receiver
  wallet, recovery explanation, and `Install App` / `Open App` management CTA.
- Do not add public withdrawal or browser management controls for Card `Endow`.
- Do not show two wallet-connect prompts in the same flow.
- Drive funding method display from `PublicFundingAvailability`.
- Treat `PublicFundingAvailability.reasonCode` and params as data only; UI owns localized copy in
  `en`, `es`, and `pt`.
- Cover these `reasonCode` values in localized copy: `no_destination`, `proof_pending`,
  `provider_unavailable`, `chain_unsupported`, `token_unsupported`, `config_missing`, and `disabled`.
- Validate selected amounts separately from base availability using min/max metadata; amount-specific
  messages come from local validation or server quote/create field errors, not from base availability
  reason codes.
- Derive visible Wallet/Donate/Endow availability from the state/API contract and shared public reads;
  do not call thirdweb-visible card methods live unless that exact Garden/destination/intent/token/
  chain/provider is marked live.
- Treat `/fund` as support-only: `Donate` and `Endow` are visible where available, but withdrawals and
  admin controls are not.
- `/fund?garden=...` resolves exact Garden id/address first and accepts a slug only when exactly one
  Garden derives that slug; stale, missing, zero-match, or multiple-slug query values should render the
  normal Fund page with a localized non-blocking message. Reuse or extract
  `publicGardenHelpers.deriveSlug` for slug normalization.
- Card funding success copy should depend on the state/API-funded result; UI must not infer success
  from a provider widget success alone.
- When starting card funding, pass the selected `destinationAddress`, canonical `availabilityKey`, and a
  generated `clientRequestId`; Agent recomputes the key, deduplicates exact retries, and may reject drift
  with `funding_unavailable` or mismatched retries with `idempotency_conflict`.
- Treat `amount_below_min` and `amount_above_max` as selected-amount `PublicApiErrorCode` values, not
  base availability `reasonCode` values; render them from safe `fieldErrors.amountUsd` and localized copy.
- Update `packages/client/DESIGN.browser.md` before building UI because the current design overlay
  still references browser `/` -> `/gardens`, old nav order, and wallet CTA behavior.

## Data And Config Notes

- Public browser calls use existing `VITE_API_BASE_URL`.
- Public route/type contracts are imported from the server-safe `@green-goods/shared/public-contracts`
  subpath; seeded handoff fixtures come from this plan hub's `artifacts/fixtures` area or
  implementation package copies of those fixtures. UI work starts only after state/API adds the shared
  package export and client TypeScript/Vite resolution for that subpath.
- Public browser route paths are `POST /public/subscribe`, `POST /public/funding-intents`, and
  `GET /public/funding-intents/:id`; funding receipt reads send the token only through
  `X-GG-Receipt-Token`. thirdweb provider callbacks stay server-side at
  `POST /webhooks/thirdweb`.
- `POST /public/funding-intents` returns `id`, `receiptToken`, `receiptUrl`, and a public-safe receipt
  shape for card flows only. `receiptUrl` uses `/fund?intent=<id>#receiptToken=<token>`; the client
  extracts the fragment, calls the receipt endpoint with `X-GG-Receipt-Token`, and never sends the
  token in query params or JSON body.
- Receipt-token analytics protection is dual guard: root or equivalent pre-pageview bootstrap extracts the
  token, stores it only in memory or short-lived session state for the receipt request, and removes the
  fragment with `history.replaceState` before initial pageview tracking or receipt mount; `usePageView`
  itself also redacts sensitive hash keys including `receiptToken`. Ensure `page_view.hash` never includes
  `receiptToken`; add coverage for root pre-scrub, initial pageview redaction, generic hash redaction, and
  hash cleanup.
- Public receipt UI may show Garden/destination summary, amount summary, status, canonical funding
  transaction hash (`fundingTxHash`), receiver wallet for Card Endow recovery, and Install/Open App
  management CTA.
- Treat receipt `fundingTxHash` as the canonical public transaction hash. Approval/reset transaction hashes
  are internal audit evidence and should not be presented as the Garden-funded transaction.
- Public receipt UI must not show payer email, provider ids, internal event history, raw failure details,
  webhook payloads, server-only reconciliation metadata, or raw receipt tokens. Avoid logging receipt
  fragments or sending them to analytics.
- Client curation/contact config contains only the Agent subscribe route and Google appointment URL.
- Luma API key, calendar id, and tag config stay server-side in Agent.
- `payerEmail` for funding receipt/recovery is separate from newsletter/update consent.
- Funding intent creation never subscribes a visitor to updates. Receipt UI can offer updates only by
  calling `POST /public/subscribe` separately with `consent: true`, `source: "fund_receipt"`, and locale.
- `/impact` v1 uses the public assessment/evidence data contract backed by current shared EAS reads,
  default page size `12`, deterministic candidate Garden ordering by latest public activity desc then
  stable id/address asc, v1 fetch cap of `50` Gardens and `100` assessment/evidence records, newest-first
  sorting within the fetched slice, local page/offset slicing, and explicit loading/empty/partial-data/
  source-limit/EAS failure states.

## UI Unblock Criteria

- UI starts after `status.json.contract_stability_checklist` is complete: route paths, public types,
  seeded fixtures, `/fund?garden` behavior, availability reason semantics, contact endpoint behavior,
  public receipt shape, provider proof registry, and `/impact` hook shape.
- Checklist item statuses are `planned`, `in_progress`, `complete`, or `blocked`, and all required items
  must be `complete` before the checklist is complete.
- UI remains `manual_blocked: true` until state/API runs the explicit plan-hub lane command to move
  `ui` to `ready` and records the history note.
- UI does not wait for every card payment method to be live.
- Unavailable card rails stay hidden unless intentionally marked `comingSoon`.

## Dialog And Motion Requirements

- Source dialogs need labelled titles, focus handoff/trap, escape close, overlay close, mobile bottom
  sheet behavior, and reduced-motion fallback.
- Source morphs require unique transition names per item.
- Fall back to simple fades when transition-name uniqueness or browser support is unclear.

## Validation

- Seeded Storybook/component states plus routed browser screenshots for all public pages and dialogs
  at 375, 768, 1024, 1440.
- Screenshot stale, missing, or ambiguous `/fund?garden=...` handling.
- Screenshot the `/fund` `Donate`/`Endow` choice, payment method selector, and any disabled or
  intentionally curated coming-soon card state.
- Screenshot hidden-by-default unproven card methods where test fixtures expose availability.
- Screenshot card `Endow` receipt/recovery/app-management handoff wherever the embedded wallet
  receiver/recovery state is visible.
- Screenshot risk-safe Endow copy using "designed to preserve" language.
- Verify Donate/support copy avoids tax-deductible, charitable-status, nonprofit-status, and
  legal-receipt claims.
- Verify card funding create calls include `destinationAddress` and `availabilityKey`, and safe
  `funding_unavailable` drift errors render as neutral unavailable copy.
- Verify card funding create calls include `clientRequestId`, exact retry behavior does not produce
  duplicate visible checkouts, and `idempotency_conflict` renders as a safe retry/help state.
- Verify card checkout data is read only from the allowlisted shared checkout payload shape; do not depend
  on arbitrary `widgetConfig` keys or durable provider ids.
- Verify `/fund?garden` slug handling covers case-insensitivity, punctuation normalization, empty-name
  address fallback, stale references, and collisions.
- Verify `PublicFundingAvailability.reasonCode` values are mapped through localized UI strings.
- Verify dialogs meet labelled-title, focus, escape/overlay close, mobile sheet, and reduced-motion
  requirements.
- Verify source morphs use unique transition names per item or fall back to simple fades.
- `bun run check:design-md`
- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`
