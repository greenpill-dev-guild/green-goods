# Agent Package — Agent Guide

Use this guide when editing `packages/agent/**`.

## Role

The agent package is the bot and webhook service. It handles inbound platform messages,
routes them through handlers, and coordinates service dependencies.

## Commands

- `bun run test`
- `bun run typecheck`
- `bun run test:coverage`
- `bun run lint`

## Non-Negotiables

- Keep handlers pure where possible and inject dependencies that need mocking.
- Keep services behind stable helper APIs or singleton accessors.
- Never store plaintext private keys; use the crypto helpers for storage and retrieval.
- Rate-limit externally triggered actions.
- Do not leak internal error details to users; keep user-facing failures generic.
- If a change touches shared types or shared APIs, validate those boundaries as well.

## Package Notes

- Response-shape changes ripple quickly through platform adapters and tests; run both tests and
  typecheck when editing handlers, adapters, or service contracts.
- Coverage is currently permissive, so correctness depends more on targeted tests than on the
  threshold number alone.

## Key Material Flow

Bot-managed wallet keys are generated in handlers with `generateSecurePrivateKey()` and passed to
`db.createUser()`. The database service must be the only persistence boundary for those keys:
`createUser()` calls `prepareKeyForStorage()` before insert, `getUser()` decrypts through
`getPrivateKey()`, and legacy plaintext rows are re-encrypted on read through `migrateUserKey()`.
Logs and audit events may include platform ids, addresses, handler names, work ids, and transaction
hashes, but never raw `privateKey` values or decrypted key material.

## Validation

- QA Speed Mode: targeted `bun run test -- src/...`; add `bun run typecheck` when handler, adapter, response, or service contracts move.
- Package loop: `bun run test && bun run typecheck`.
- Conditional proof: run `bun run test:coverage` for security-sensitive or handler-heavy changes.
- Broader impact: run the root Repo Quick Gate when shared types or public APIs affect other packages.
