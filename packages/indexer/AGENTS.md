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
- `bun run setup-generated`

## Non-Negotiables

- Do not index EAS attestations here. Those stay in shared's EAS data layer.
- Every persisted entity needs a `chainId`.
- Use composite IDs that include `chainId` to avoid cross-chain collisions.
- When relationships change, update both sides.
- After schema or config changes, regenerate and rebuild generated code before trusting tests.

## Codex Notes

- On macOS, local development usually relies on Docker-based scripts, but validation still needs
  boundary checks, tests, and a TypeScript build.
- Indexer changes often fail later than app changes if codegen is skipped. Run codegen first when
  touching `schema.graphql`, `config.yaml`, or generated types.

## Validation

- Schema/config changes: `bun run codegen && bun run setup-generated`
- Package loop: `bun run check:indexing-boundary && bun run test && bun run build`
