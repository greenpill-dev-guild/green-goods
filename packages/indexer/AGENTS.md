# Indexer Package — Codex Guide

Use this guide when editing `packages/indexer/**`.

## Role

The indexer package runs the Envio indexing pipeline for Green Goods protocol events. It is
responsible for protocol entities, not for EAS attestations.

## Commands

- `bun run check:indexing-boundary`
- `bun run test`
- `bun run build`
- `bun run codegen`
- `bun run dev`

## Non-Negotiables

- Do not index EAS attestations here. Those stay in shared's EAS data layer.
- Every persisted entity needs a `chainId`.
- Use composite IDs that include `chainId` to avoid cross-chain collisions.
- When relationships change, update both sides.
- Keep TypeScript `strict` and `noImplicitAny` enabled for handwritten `src/` and `test/` code; do not weaken compiler flags to accommodate generated types.
- After schema or config changes, regenerate `.envio/` types before trusting tests.
- Envio v3 registrations use `indexer.onEvent` and `indexer.contractRegister`; do not restore
  generated-v2 imports, `MockDb`, ReScript setup, or package-local pnpm workflows.
- `envio dev` preserves the local database. Use `bun run dev:restart` only when a destructive
  local replay is explicitly intended and authorized.

## Codex Notes

- On macOS, local development usually relies on Docker-based scripts, but validation still needs
  boundary checks, tests, and a TypeScript build.
- Indexer changes often fail later than app changes if codegen is skipped. Run codegen first when
  touching `schema.graphql`, `config.yaml`, or `.envio/` types.

## Validation

- Schema/config changes: `bun run codegen && bun run build`
- Package loop: `bun run check:indexing-boundary && bun run test && bun run build`
