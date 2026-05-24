# Codex Handoff: Envio v3 Migration

**Parent lane**: `state_api`  
**Subphase**: `v3_migration`  
**Branch**: `codex/indexer-v3/envio-hyperindex-v3-migration`  
**Subphase depends on**: completed `prep_v2_preload`

## Objective

Migrate `packages/indexer` from the v2 generated ReScript/API shape to Envio HyperIndex v3 while preserving Green Goods indexer behavior.

## Required Work

- Upgrade to the selected Envio v3 patch version after checking the current npm release.
- Update `package.json` for v3: `"type": "module"`, Node `>=22`, generated package removal, and selected test runner/tooling.
- Update `tsconfig.json` and v3 type bridge files for ESM/codegen.
- Migrate `config.yaml` to v3 config shape, including renamed or removed options.
- Update env surfaces for `ENVIO_API_TOKEN`, `ENVIO_TUI`, and `ENVIO_PG_SCHEMA` when applicable.
- Replace v2 generated imports and event registration APIs with `indexer.onEvent`, v3 `where`, `context.chain.<Contract>.add`, v3 field names, and v3 `getWhere` syntax.
- Preserve dynamic contract discovery for GardenAccount and OctantVault.
- Rewrite tests to the v3 test helpers.
- Remove obsolete generated ReScript setup from package scripts, Docker, CI, doctor checks, docs, and skills only after v3 proves it is no longer needed.

## Validation

```bash
bun run --cwd packages/indexer check:indexing-boundary
bun run --cwd packages/indexer build
bun run --cwd packages/indexer test
```

Also include:

- v3 codegen proof.
- Docker/runtime smoke proof or exact proof limit.
- Representative GraphQL query proof.
- Source grep proving obsolete generated setup is not still referenced by active v3 docs/runtime paths.
- Production-readiness deferral note covering reindex, DB compatibility, rollback, hosted secrets/config, and approval owner.
