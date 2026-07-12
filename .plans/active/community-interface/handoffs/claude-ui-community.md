# Community PWA UI handoff

**Status:** BLOCKED — waits for shared foundation, state/API, and sponsorship evidence.

## Inputs

- `spec.md` §§5–8/13–14, wireframes/journeys, shared shell/state exports, hosting contract.

## Outputs

- Independent `packages/community` PWA at local 3010 / `community.greengoods.app`: Needs/Create/Profile, public deep links, offline queue/recovery, install/update, isolated manifest/service worker/telemetry, en/es/pt UI.

## Acceptance

- All named states and retraction/privacy rules render accessibly; touch/focus/live-region/reduced-motion requirements pass; client and Community service workers cannot control each other's origin. Membership queue is absent while gated.

## RED / GREEN

- RED: route, state, PWA-scope, i18n, and accessibility tests fail before scaffolding/implementation.
- GREEN: package tests/build/PWA checks pass plus authenticated Brave and real-device screenshots for the full Need loop and recovery paths.

## Exact commands

```sh
bun run --filter @green-goods/community test
bun run --filter @green-goods/community build
bun run lint:vocab
bun run agentic:check
```

## Out of scope

Client replacement, admin/funder views, join-request persistence, product claims/settlement, or shared-local hooks.

## Unblock evidence

Dependencies GREEN, host/service-worker/CSP plan approved, Community package added to repo gates, and authenticated-browser/real-device QA route available.
