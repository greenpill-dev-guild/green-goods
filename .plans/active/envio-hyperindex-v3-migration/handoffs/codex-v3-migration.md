# Codex Checklist: Envio 3.2.1 Migration

**Parent lane**: `state_api`  
**Linear**: PRD-557  
**Implementation PR**: GitHub #649

## Correction Pass

- [ ] Rebase or update the PR from current `develop` and retarget its base to `develop`.
- [ ] Inspect all changed files and remove unrelated shared changes.
- [ ] Remove nested package-level Envio skill copies.
- [ ] Keep only migration-required indexer, workflow, CI, docs, and canonical-guidance files.
- [ ] Make root commands Bun-first.
- [ ] Keep pnpm only where Envio-generated internals require it.

## Migration Pass

- [ ] Pin Envio 3.2.1 and align Node/ESM requirements.
- [ ] Migrate config and handlers to supported v3 APIs.
- [ ] Preserve dynamic GardenAccount and OctantVault registration.
- [ ] Replace obsolete v2 generated/test/runtime wiring only after v3 replacement proof.
- [ ] Preserve current entities, IDs, relationships, chain IDs, block boundaries, and GraphQL shape.
- [ ] Keep Commitment Pooling-specific entities and handlers out of this PR.

## Proof Pass

- [ ] Obtain explicit install authorization.
- [ ] Generate clean bindings from the checked-in lockfile.
- [ ] Run boundary, build, and test gates.
- [ ] Prove existing-handler behavior, migration replay, and idempotence.
- [ ] Start the local runtime and query representative Green Goods data.
- [ ] Record reindex, DB compatibility, hosted configuration, rollback, and approval ownership.
- [ ] Attach proof to PRD-557 and update `../status.json`.

Hosted deployment and reindex remain out of scope until the later Commitment Pooling release-ops
authorization.
