# Implementation Prompt

Use this prompt when dispatching the migration. Keep `.plans/.../status.json` as execution truth and do not touch unrelated agent work.

```text
Implement `.plans/backlog/envio-hyperindex-v3-migration/` for Green Goods.

Scope only the Envio migration plan: `packages/indexer`, indexer CI/runtime scripts, doctor/local dev checks, docs, `.claude` indexer guidance, and generated `.agents` skill mirror. Do not touch contracts, client/admin/shared behavior, or unrelated dirty files unless v3 GraphQL output forces a documented follow-up.

Start with `git status --short` and preserve other agents' work. Use `state_api` as the implementation lane. Treat `codex-prep-v2-preload.md` and `codex-v3-migration.md` as subphase checklists.

Phase A: upgrade Envio from 2.32.3 to 2.32.6, enable or verify preload behavior, audit preload-sensitive handlers especially Hypercert metadata and dynamic registration, preserve generated ReScript setup, and record validation.

Phase B: confirm the latest Envio v3 patch, then migrate package/runtime/config/tests: package.json `type: module`, Node >=22, ESM tsconfig, v3 type bridge files, config `chains` shape, v3 env keys, `indexer.onEvent`, v3 `where`, `context.chain.<Contract>.add`, v3 `getWhere`, and `createTestIndexer` tests. Remove generated ReScript setup from scripts, Docker, CI, doctor checks, docs, and skills only after v3 codegen/runtime/tests prove it is obsolete.

Required proof: `bun run --cwd packages/indexer check:indexing-boundary`, `bun run --cwd packages/indexer build`, `bun run --cwd packages/indexer test`, v3 codegen, Docker/runtime smoke or exact proof limit, representative GraphQL query, source grep for removed generated setup, `bun run check:skills`, `node scripts/quality/check-codex-docs.js`, `bun run build:docs`, and `bun run docs:audit:ci`.

Closeout must update lane handoffs and `status.json`, sync Linear PRD-557 if needed, and add a production-readiness note covering reindex, DB compatibility, rollback to v2, hosted Envio secrets/config, and approval owner. Do not claim production readiness or archive while hosted rollout is pending.
```
