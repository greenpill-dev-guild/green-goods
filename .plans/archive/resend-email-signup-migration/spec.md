# Resend Email Signup Migration Spec

## Summary

Replace the public email subscriber provider from Luma to Resend while preserving the existing
Green Goods public subscription contract. The Agent should expose the same protected
`POST /public/subscribe` route, but internally create/update a Resend contact and route that contact
into the Green Goods subscriber audience using current Resend contact metadata, segment, and topic
capabilities. Public client behavior remains intentionally quiet and honest: no fake success when
the provider is unavailable, no new consent checkbox, and no provider-specific error copy.

## Users

- Primary: public Green Goods visitors who subscribe from the homepage contact section.
- Secondary: Green Goods operators who need a lower-cost subscriber list that can be used for
  seasonal broadcasts and lightweight welcome/follow-up automation.

## Functional Requirements

1. `POST /public/subscribe` creates or updates a Resend contact for the submitted email and returns
   `{ ok: true, status: "subscribed" | "already_subscribed" }` without changing the public success
   shape.
2. The Resend contact stores non-sensitive properties: source, locale when supplied, consented
   timestamp, and a Green Goods signup marker.
3. Subscriber routing uses current Resend contacts, segments, and/or topics APIs; do not build on
   deprecated Resend Audiences APIs.
4. If Resend is not configured or returns an upstream error, the API returns a provider-neutral
   error code and the client renders translated, provider-neutral failure copy.
5. Existing public protections stay in place: CORS origin checks, rate limiting, payload-size
   limits, email validation, consent validation, and generic external-error responses.
6. Luma-specific config names, service names, tests, and public i18n keys are removed or superseded
   where touched by this migration.
7. No package-level `.env` files are added; all provider configuration stays in the root environment
   pattern and typed Agent config.

## Research Evidence

- Existing pattern references:
  - `packages/agent/src/services/luma.ts` is the current provider adapter with a narrow injected
    client interface and focused fetch tests.
  - `packages/agent/src/api/server.ts` owns public route validation before provider calls.
  - `packages/client/src/components/Public/PublicGetInTouch.tsx` owns the public form and already
    sends `email`, `consent: true`, and `source: "homepage_get_in_touch"`.
  - `packages/shared/src/public-contracts/index.ts` owns public API error/status types.
  - `packages/shared/src/i18n/en.json`, `es.json`, and `pt.json` contain the current public
    subscribe success/error messages.
- Source files, tests, or docs reviewed:
  - `packages/agent/src/__tests__/luma.test.ts`
  - `packages/agent/src/__tests__/public-api.test.ts`
  - `packages/client/src/__tests__/components/PublicGetInTouch.test.tsx`
  - `packages/agent/src/config.ts`
  - `packages/agent/src/index.ts`
  - `packages/client/DESIGN.browser.md`
  - Resend docs for contact creation, broadcasts, and automations.
- Evidence confirmed:
  - Current code calls Luma `calendar/import-people` with calendar and tag config.
  - Public API tests already cover consent/email validation, honest provider success, missing
    provider failure, and oversized payload rejection.
  - Client tests already verify consent microcopy, API payload shape, configured route usage, and
    clearing the email field after confirmed success.
  - Shared public contracts currently include `luma_import_failed`.
- Open inferences or assumptions:
  - A Resend API key and contact routing identifiers will be supplied in the root environment, not
    committed to the repo.
  - Green Goods wants single opt-in to remain unchanged unless product explicitly decides to add
    double opt-in or an out-of-band confirmation automation.
  - Historical Luma subscriber export/import is intentionally separate from this implementation
    unless a maintainer supplies an export and asks to add an import lane.

## Human Judgment Points

- Decisions that need maintainer judgment:
  - Whether Resend should route contacts through a segment, topic, both, or a naming convention that
    mirrors Greenpill Network.
  - Whether to send an immediate welcome/confirmation automation in Resend as part of launch or keep
    the first release to capture-only.
  - Whether any historical Luma subscribers should be migrated manually before Luma is turned down.
- Protected or high-risk surfaces:
  - Public Agent route behavior in `packages/agent/src/api/server.ts`.
  - Public API contract changes in `packages/shared/src/public-contracts/index.ts`.
  - Root environment variable naming and deployment configuration.
- Tradeoffs to keep visible during review:
  - Provider-neutral API names cost a little refactor time now but make future email-provider changes
    cheaper.
  - Capture-only migration is safer than adding automation and migration in the same PR.
  - Real provider QA needs a staging/test Resend key; without it, local tests can prove request
    shape but not live contact creation.

## Non-Functional Constraints

- Package boundaries: provider integration belongs in `packages/agent`; shared API shapes and i18n
  belong in `packages/shared`; the public form remains in `packages/client`.
- Performance: keep the route synchronous and bounded, matching current behavior; do not introduce a
  polling or queue dependency for the first migration.
- Security: do not log email addresses, API keys, Resend contact IDs, or provider response bodies in
  public errors. Preserve generic user-facing failures.
- Offline / sync: no offline behavior is required for the public browser subscribe route.
- Localization: every new or renamed user-facing string must be added to `en`, `es`, and `pt`.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Provider-neutral public form comments/copy/tests only; no layout change planned |
| State / API | `state_api` | Primary lane: Agent Resend adapter, config, route dependency, shared contract/i18n |
| Contracts | `contracts` | `n/a`; no Solidity/deployment/indexer work planned |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential; live provider QA requires configured Resend test/staging credentials |

## Risks

- Risk: Resend duplicate-contact semantics differ from Luma's current `409` handling.
  Mitigation: codify expected create/update/already-subscribed behavior in focused adapter tests
  before changing the public route.
- Risk: provider-specific error code rename breaks client error lookup.
  Mitigation: update shared type, i18n keys, client tests, and public API tests in the same lane.
- Risk: production is deployed without Resend credentials and public signup goes dark.
  Mitigation: keep missing-provider failure explicit, document root env variables, and require a
  staging/prod config checklist before Luma shutdown.
- Risk: scope creeps into newsletter strategy or subscriber import.
  Mitigation: keep capture migration separate; track welcome automations and historical import only
  if a maintainer accepts them as follow-up work.
