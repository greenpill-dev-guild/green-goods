# Implementation Prompt

```text
Correct and complete Green Goods PR #649 using
`.plans/active/envio-hyperindex-v3-migration/` as execution truth and PRD-557 as the Linear mirror.

Stay on the current branch unless Afo explicitly authorizes branch work. Start read-only: inspect
the current PR head, current develop, the full changed-file list, package/indexer instructions,
and the state_api handoff. Preserve unrelated working-tree changes.

Scope:
- Retarget PR #649 to develop.
- Remove package-local Envio skill copies and unrelated shared changes.
- Retain only migration-required indexer, root workflow, CI, docs, and canonical-guidance work.
- Keep root workflows Bun-first. Envio-generated internals may use pnpm where required.
- Complete the direct envio@2.32.12 -> envio@3.2.1 migration.
- Preserve existing Green Goods entities, IDs, relationships, chain IDs, dynamic registrations,
  configured block boundaries, replay behavior, and GraphQL shape.
- Do not add Commitment Pooling entities/handlers or touch contracts/client/admin.
- Do not install dependencies until Afo explicitly approves the install in that session.

Required proof after install authorization:
`bun run indexer:check-boundary`
`bun run --cwd packages/indexer codegen`
`bun run build:indexer`
`bun run test:indexer`
focused dynamic-registration and existing-handler tests
migration/replay and block-preservation proof
local runtime plus representative GraphQL query
`node scripts/quality/check-codex-docs.js`
`bun run build:docs`
`bun run docs:audit:ci`

Record RED/GREEN evidence in the handoff and status.json. Add a production-readiness note for
reindex, DB compatibility, hosted configuration, rollback, and approval. Landing the PR completes
the repository foundation only; hosted deployment/reindex remains a later authorized release step.
```
