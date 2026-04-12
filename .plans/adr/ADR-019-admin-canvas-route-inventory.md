# ADR-019: Admin Canvas Route Inventory

## Status

Accepted — April 11, 2026

## Context

The admin surface has moved from mixed shell language and compatibility routing toward a single Canvas contract. This ADR records the canonical route map after the Canvas refresh, documents which deep links remain valid, and separates likely future client-port candidates from flows that should stay admin-only.

This ADR is inventory only. It does not create a shared live route manifest for admin and client.

## Decision

### Canonical admin route map

- `/hub/work`
- `/hub/work/:workId`
- `/hub/work/submit`
- `/hub/assess`
- `/hub/assess/create`
- `/hub/certify`
- `/hub/certify/:assessmentId`
- `/hub/certify/create`
- `/hub/history`
- `/garden/overview`
- `/garden/impact`
- `/garden/impact/hypercerts/:hypercertId`
- `/garden/settings`
- `/garden/create`
- `/community/treasury`
- `/community/treasury/vault`
- `/community/governance`
- `/community/governance/strategies`
- `/community/governance/signal-pool/:poolType`
- `/community/payouts`
- `/community/members`
- `/actions`
- `/actions/create`
- `/actions/:id`
- `/actions/:id/edit`
- `/profile`

### Deep links that remain valid

- Hub detail and submit deep links remain first-class and render through the Hub controller.
- Garden hypercert detail remains a first-class deep link under `/garden/impact/hypercerts/:hypercertId`.
- Community treasury/governance tool sheets keep canonical nested URLs.
- `/profile` remains a canonical address even though desktop normalizes it into a right sheet.
- Query-string context remains valid only for active Canvas behavior, primarily `gardenAddress`, `sort`, `range`, `section`, `item`, and account tab state.

### Removed compatibility

- No top-level `/work/*` compatibility routes.
- No `/garden/assessments/create`, `/garden/hypercerts/create`, or `/garden/hypercerts/:hypercertId` compatibility aliases outside the canonical impact route.
- No `/community/vault`, `/community/strategies`, or `/community/signal-pool/:poolType` compatibility aliases outside canonical nested routes.
- No legacy admin `?garden=` selection parameter.

### Profile behavior

- Desktop: profile opens as a bounded right sheet from the shared shell controls.
- Mobile: profile remains a route-backed workspace at `/profile`.
- The profile trigger follows the same icon-button grammar as the rest of the shell controls.

### Future client-port candidates

- `/hub/work/:workId`
- `/hub/work/submit`
- `/garden/overview`
- `/garden/impact`
- `/community/treasury`
- `/community/members`
- Read-only slices of `/actions/:id` where the client needs lifecycle visibility

### Admin-only flows

- `/hub/assess/create`
- `/hub/certify/create`
- `/garden/create`
- `/community/governance/*`
- `/community/payouts`
- `/actions/create`
- `/actions/:id/edit`

## Consequences

- Admin routing is simpler, easier to test, and no longer carries obsolete deep-link baggage.
- Client-port planning now has a stable written inventory without prematurely coupling the admin and client routers.
- Any future client-port effort should start by copying canonical route intent from this ADR rather than resurrecting removed aliases.
