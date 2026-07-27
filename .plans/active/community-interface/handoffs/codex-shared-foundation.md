# Shared application-foundation handoff

**Status:** MANUALLY BLOCKED — explicit Afo dispatch, an approved extraction inventory, a named auth/offline reviewer, and accepted RED characterization targets are required before touching critical shared auth/offline surfaces.

## Inputs

- Current client runtime/auth/passkey/job-queue/install/update/error/shell behavior and `spec.md` §14 boundary.

## Outputs

- Generic shared providers/primitives consumed by client and later Community; behavior-preserving client migration tests; package-owned app identity contract.

## Acceptance

- Auth states/callbacks, offline queue observation, update/install prompts, errors, and navigation slots retain client behavior; no shared route list, manifest, service-worker scope, telemetry identity, or app copy.

## RED / GREEN

- RED: characterization tests capture current client auth/offline/install/update/error flows before moving code.
- GREEN: shared targeted tests, client tests/typecheck/build, and existing PWA precache checks pass after migration.

## Exact commands

```sh
bun run --filter @green-goods/shared test -- src/__tests__/providers/JobQueueProvider.test.tsx src/__tests__/providers/Auth.wallet-login.test.tsx src/__tests__/workflows/authMachine.test.ts
bun run --filter @green-goods/shared typecheck
bun run --filter @green-goods/client test
bun run --filter @green-goods/client build
```

## Out of scope

Community scaffolding/routes/copy, auth redesign, job schema changes, and admin/public UI.

## Unblock evidence

Approved extraction inventory, named critical-surface reviewer, accepted RED characterization targets, and explicit dispatch for PRD-682's prerequisite slice. Run and record the RED characterization output after dispatch but before implementation; it is not a pre-dispatch gate.
