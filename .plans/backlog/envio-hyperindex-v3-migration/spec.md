# Envio HyperIndex v3 Migration Spec

## Current State

- `packages/indexer/package.json` pins `envio@2.32.3`.
- Current baseline validation passed on 2026-05-24:
  - `bun run --cwd packages/indexer check:indexing-boundary`
  - `bun run --cwd packages/indexer build`
  - `bun run --cwd packages/indexer test` with 186 passing tests
- The current code relies on the v2 generated ReScript package shape:
  - imports from `../../generated`
  - event registration via `Contract.Event.handler(...)`
  - dynamic contract registration via `.contractRegister(...)`
  - tests using `MockDb`, `createMockEvent`, and `processEvent`

## Migration Strategy

Use two implementation phases inside the machine-readable `state_api` lane.

1. Prep on Envio `2.32.6`
   - Bump Envio from `2.32.3` to `2.32.6`.
   - Enable/verify v2 preload behavior before v3.
   - Audit handler side effects, especially Hypercert metadata fetching.
   - Preserve current generated-package workflow during this lane.

2. Migrate to Envio v3
   - Confirm the current Envio v3 patch release and Node requirement immediately before editing.
   - Update `package.json` for v3: `envio`, `"type": "module"`, `engines.node >=22`, generated package removal, and test-runner/tooling changes.
   - Update `tsconfig.json` for ESM/bundler resolution and add the v3 type bridge files such as `envio-env.d.ts` when required.
   - Move config to the v3 shape.
   - Update root/indexer env contracts for v3 variables such as `ENVIO_API_TOKEN`, `ENVIO_TUI`, and `ENVIO_PG_SCHEMA` when applicable.
   - Replace v2 generated imports and event registration with v3 APIs.
   - Rewrite test helpers to the v3 test surface.
   - Remove obsolete generated ReScript setup from package scripts, Docker, CI, local doctor checks, and docs only after v3 codegen/runtime proof passes.
   - Keep the public GraphQL schema and entity semantics equivalent unless v3 requires mechanical type/nullability adjustments.

## Required Behavior

- All persisted entities must keep `chainId`.
- Existing composite ID conventions must remain unchanged.
- Dynamic contract discovery must still cover:
  - GardenToken `GardenMinted` -> GardenAccount events
  - OctantModule `VaultCreated` -> OctantVault events
- EAS attestations must remain outside the Envio indexer.
- Hypercert metadata fetch behavior must be preload-safe or explicitly moved behind the v3-supported effect pattern.
- Docs and guidance must not reference removed generated ReScript steps after v3 migration.

## Production Quality Gates

- Package proof is necessary but not sufficient. The v3 lane must also prove local runtime startup through the repo's supported Docker path or document a concrete proof limit.
- Runtime proof must include codegen, Docker/Compose startup, GraphQL endpoint reachability, and one representative query over Green Goods entities.
- CI and local doctor checks must stop requiring `packages/indexer/generated` once v3 removes the local generated package.
- Docs validation must include skill sync, Codex guidance parity, Docusaurus build, and docs audit.
- Closeout must include a production-readiness note that answers: reindex required or not, DB/schema compatibility, rollback path to v2, required hosted Envio secret/config changes, and manual approval owner.

## Linear Mirror

Linear visibility is tracked by [PRD-557](https://linear.app/greenpill-dev-guild/issue/PRD-557/migrate-green-goods-indexer-to-envio-hyperindex-v3).

Labels:

- `protocol:green-goods`
- `package:indexer`
- `activity:maintenance`
- `source:plans`
- `agent:codex`

`.plans/.../status.json` remains the execution truth.
