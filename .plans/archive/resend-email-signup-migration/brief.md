# Resend Email Signup Migration

**Slug**: `resend-email-signup-migration`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-06-15T19:04:43.563Z`
**Linear Issue**: PRD-598
**Linear Project**: Green Goods Public Website & Docs Polish
**Linear Source**: source:plans

## Problem

Green Goods currently captures public email subscribers by importing people into Luma through the
public Agent route. That worked as a quick calendar-adjacent list, but it is now an expensive
dependency for a simple subscriber-capture use case. The product already uses Resend in the wider
Greenpill ecosystem, and Resend is a better fit for a developer-owned signup flow where Green Goods
controls the form, consent copy, source metadata, and welcome/update messaging.

The current code also leaks the provider name into public contracts and copy through
`luma_import_failed`, which makes future provider swaps harder and makes the public API less
accurate once Luma is removed.

## Desired Outcome

- Green Goods public subscribers are created or updated as Resend contacts from the existing
  `POST /public/subscribe` route.
- The public signup form keeps the same simple user experience: email, consent microcopy, honest
  success only after the provider confirms capture, and a provider-neutral failure state.
- Resend captures non-sensitive subscriber metadata: source, locale when present, consented
  timestamp, and a Green Goods signup marker.
- Luma API keys, calendar IDs, tag IDs, and Luma-specific service/test names are removed or
  superseded.
- Existing public API protections remain intact: origin allowlist, rate limiting, body-size guard,
  email validation, consent requirement, and generic external-provider errors.
- Contracts, indexer schema, wallet flows, payment flows, and admin UI do not change.

## Scope Notes

- In scope: `packages/agent` subscription provider adapter and config, the public subscribe route
  dependency injection, focused agent tests, shared public error contracts, shared i18n strings,
  client comments/tests that mention Luma, and docs/config references for root env variables.
- Out of scope: adding a marketing CRM UI, importing historical Luma subscribers, creating a new
  database table, changing the public form layout, changing opt-in policy, adding contracts/indexer
  work, or wiring production Resend credentials in code.

## Success Signal

A public homepage signup produces a real Resend Green Goods contact with consent/source metadata,
while the route still rejects invalid/unauthorized/unconfigured requests and the client shows only
provider-neutral success or failure copy.
