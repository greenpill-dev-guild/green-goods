# Envio HyperIndex v3 Migration Todo

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Start in backlog | The current indexer is healthy; this should not interrupt active work until scheduled. |
| 2 | Use a two-phase migration | Envio recommends v2 preload prep before v3, and this lowers handler/runtime risk. |
| 3 | Mirror to Linear | The migration affects a production infrastructure surface and should be roadmap-visible. |
| 4 | Keep `.plans` authoritative | Linear is for visibility; plan hub status and lane proof drive execution. |
| 5 | Keep prep and v3 as subphases of `state_api` | The plan-hub CLI only supports canonical machine lanes, so subphase handoffs provide detail without breaking automation. |
| 6 | Require runtime smoke before rollout decisions | Build/tests alone do not prove Envio v3 Docker, Hasura, Postgres, or GraphQL behavior. |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Prepare implementation-ready plan hub | Phase 0 | Planned |
| Keep migration safe and staged | Phase 1 + Phase 2 | Planned |
| Preserve current indexer behavior | All implementation lanes | Planned |
| Prove local runtime and GraphQL behavior | Phase 2 + Phase 4 | Planned |
| Capture env, ESM, Docker, CI, and doctor migration | Phase 2 | Planned |
| Update docs and agent guidance | Phase 3 | Planned |
| Record reindex, rollback, and hosted rollout decisions | Phase 4 | Planned |
| Record proof before closeout | Phase 4 | Planned |

## Phase 0: Hub Setup

- [x] Create backlog hub at `.plans/backlog/envio-hyperindex-v3-migration/`.
- [x] Create Linear issue PRD-557 with `source:plans`.
- [x] Record current validation baseline from the exploration pass.
- [x] Add production-quality review findings back into the plan.
- [x] Add `handoffs/implementation-prompt.md` with a prompt under 4,000 characters.
- [ ] Before implementation starts, re-run `git status --short` and confirm unrelated agent work is still untouched.

## Phase 1: Envio 2.32.6 + Preload Prep

- [ ] Update `packages/indexer/package.json` and lockfiles from `envio@2.32.3` to `envio@2.32.6`.
- [ ] Enable or explicitly verify preload behavior in the v2 config.
- [ ] Audit handlers for preload-unsafe side effects:
  - Hypercert metadata fetches
  - dynamic contract registration
  - any event-time mutable list writes
- [ ] Preserve current generated-package/ReScript setup in this phase.
- [ ] Run and record:
  - `bun run --cwd packages/indexer check:indexing-boundary`
  - `bun run --cwd packages/indexer build`
  - `bun run --cwd packages/indexer test`
- [ ] If Docker is available, smoke the v2 runtime path with the repo-supported indexer dev command and record any proof limit.

## Phase 2: Envio v3 Migration

- [ ] Upgrade `envio` to the selected v3 version after confirming the latest published patch.
- [ ] Update `packages/indexer/package.json` for v3:
  - `"type": "module"`
  - `engines.node` set to `>=22.0.0`
  - remove local generated-package wiring that v3 no longer uses
  - align test tooling with the selected Mocha+tsx or Vitest path
- [ ] Update `packages/indexer/tsconfig.json` for ESM/bundler-compatible v3 execution.
- [ ] Add or update v3 type bridge files such as `envio-env.d.ts` if Envio codegen requires them.
- [ ] Migrate `packages/indexer/config.yaml` to v3 config shape:
  - `networks` -> `chains`
  - `confirmed_block_threshold` -> `max_reorg_depth` if present
  - `rpc_config` -> `rpc` if present
  - remove v2-only `preload_handlers`, `preRegisterDynamicContracts`, `output`, and loader settings if present
- [ ] Update env surfaces for v3 runtime needs:
  - `.env.schema`
  - `.env.template` if shared/team defaults need a new key
  - `packages/indexer/docker-compose.indexer.yaml`
  - docs for `ENVIO_API_TOKEN`, `ENVIO_TUI`, and `ENVIO_PG_SCHEMA` when applicable
- [ ] Replace v2 generated imports and event registration with v3 APIs:
  - `indexer.onEvent(...)`
  - v3 `where` filters using `{ params: [...] }`
  - `context.chain.<Contract>.add(...)`
  - v3 chain/block/transaction field names
  - v3 `getWhere({ field: { _op: value } })` syntax
- [ ] Preserve dynamic contract registration semantics for GardenAccount and OctantVault.
- [ ] Rewrite indexer tests from old generated `MockDb` helpers to the v3 test surface.
- [ ] Remove or simplify obsolete generated ReScript setup:
  - `setup-generated`
  - generated package checks in doctor scripts
  - Docker build steps that install/build generated ReScript
  - CI steps that run generated setup
  - client/admin CI setup steps that only exist for generated indexer code
  - docs and skills that prescribe generated ReScript setup
- [ ] Run and record the package validation loop.
- [ ] Run and record local runtime smoke:
  - v3 codegen succeeds
  - Docker/Compose stack starts cleanly or a proof limit is recorded
  - GraphQL endpoint responds
  - one representative Green Goods entity query returns a valid response shape
- [ ] Record whether the v3 migration changes public GraphQL schema/nullability and open a separate consumer follow-up if needed.

## Phase 3: Docs and Guidance

- [ ] Update `packages/indexer/README.md`.
- [ ] Update `packages/indexer/AGENTS.md`.
- [ ] Update builder docs for indexer package/deployment/CI.
- [ ] Update environment-management docs if v3 adds or renames indexer env keys.
- [ ] Update canonical `.claude` indexer context/skill guidance.
- [ ] Run `bun run skills:sync` and verify `.agents/skills/indexer/*` mirrors the canonical guidance.
- [ ] Run `bun run check:skills`.
- [ ] Run `node scripts/quality/check-codex-docs.js`.
- [ ] Run `bun run build:docs`.
- [ ] Run `bun run docs:audit:ci`.

## Phase 4: QA and Closeout

- [ ] Re-run the full indexer CI-equivalent gate.
- [ ] Re-run local runtime smoke or document why it cannot run in the current environment.
- [ ] Confirm docs/guidance no longer mention obsolete generated ReScript setup where v3 removed it.
- [ ] Confirm GraphQL behavior is equivalent or document any required consumer follow-up.
- [ ] Add a production-readiness note covering:
  - reindex required or not
  - DB/schema compatibility
  - rollback path to v2
  - hosted Envio secret/config changes
  - manual approval owner before production rollout
- [ ] Record lane proof in `status.json` and handoffs.
- [ ] If fully implemented, move this hub to `.plans/archive/`.

## Validation Commands

```bash
bun run --cwd packages/indexer check:indexing-boundary
bun run --cwd packages/indexer build
bun run --cwd packages/indexer test
bun run check:skills
node scripts/quality/check-codex-docs.js
bun run build:docs
bun run docs:audit:ci
```

Runtime smoke is required after v3 migration using the repo-supported Docker path unless the environment cannot run Docker. If it cannot run, record the exact proof limit and do not claim production readiness.
