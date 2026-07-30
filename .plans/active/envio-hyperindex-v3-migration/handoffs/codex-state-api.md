# Codex Handoff: Envio 3.2.1 Foundation

**Lane**: `state_api`  
**Linear**: PRD-557  
**Implementation PR**: GitHub #649  
**Status**: corrective implementation and repository proof complete; publication remains blocked
on baseline formatting and PR branch ownership
**Depends on**: none

## Objective

Correct and complete PR #649 so Envio 3.2.1 lands on `develop` as a behavior-preserving
foundation before Commitment Pooling adds indexer events, entities, or handlers.

## Scope Lock

- Begin from the current PR #649 head and re-read its complete diff.
- Retarget the PR to `develop`.
- Remove package-local Envio skill copies and unrelated shared changes.
- Keep migration-required indexer, root workflow, CI, documentation, and canonical-guidance work.
- Keep root workflows Bun-first; generated Envio internals may use pnpm where required.
- Do not implement PRD-721, PRD-722, or any Commitment Pooling behavior in this PR.
- Do not install dependencies until Afo explicitly authorizes the install in the implementation
  session.

## Required Proof

- Envio 3.2.1 codegen from the checked-in lockfile.
- Boundary check, build, and tests.
- Focused GardenAccount and OctantVault dynamic-registration proof.
- Existing-handler regression proof for GreenWill, Hypercert, Campaign/Cookie Jar, and Garden data.
- Clean-replay determinism, same-store repeated-range rejection without mutation, and configured
  block-boundary preservation. Handler-level idempotence is not claimed.
- Local runtime and representative GraphQL query proof.
- Review showing no nested skill copies, unrelated shared changes, or root pnpm-first drift.
- Production-readiness note for reindex, DB compatibility, hosted config, rollback, and approval.

## Commands

```bash
bun run indexer:check-boundary
bun run --cwd packages/indexer codegen
bun run build:indexer
bun run test:indexer
node scripts/quality/check-codex-docs.js
bun run build:docs
bun run docs:audit:ci
```

Record RED/GREEN evidence here and through `plan-hub record-tdd`. Do not mark the lane complete
until the corrected PR is merged into `develop`.

## 2026-07-27 implementation evidence

### RED

- `bun run indexer:check-boundary` returned success while reporting `10 contracts validated, 0
  networks validated`; the v2-only parser did not inspect the migrated `chains` key, so the gate
  was a false positive.
- `bun run build:indexer` entered the obsolete `generated/` ReScript workspace, invoked pnpm, and
  retried registry access instead of compiling the Envio v3 TypeScript surface. The run was
  stopped after that failure mode was established.

### GREEN

- `bun install --frozen-lockfile`: succeeded after explicit authorization; 3,522 installs were
  checked, one artifact was resolved/downloaded, and `bun.lock` did not change.
- `bun run indexer:check-boundary`: passed with 10 contracts and 2 chains, including exact
  Arbitrum `433713812` and Sepolia `10243363` start blocks and no configured end blocks.
- `bun run --cwd packages/indexer codegen`: passed with `envio@3.2.1`.
- `bun run build:indexer`: passed with strict TypeScript and explicit `noImplicitAny`.
- `bun run test:indexer`: 189 passing in approximately two minutes against the real Envio v3 test
  indexer.
- Focused dynamic discovery: 2 passing for GardenAccount and OctantVault registrations.
- Representative retained surfaces: 4 passing across ActionRegistry, GardenToken, and the complete
  Octant vault lifecycle; the full suite also covers GreenWill, Hypercert, Campaign/Cookie Jar,
  Garden, Hats, and YieldSplitter behavior.
- Replay: a clean one-block simulation from the configured Arbitrum boundary produced identical
  entity snapshots on two independent v3 test indexers.
- `node scripts/quality/check-codex-docs.js`: passed.
- `bun run build:docs`: passed.
- `bun run docs:audit:ci`: passed with one pre-existing warning for the missing
  `.claude/context/intent.md` source path.
- Repo Quick Gate: all executable lint/type/test phases passed (shared 3,358 tests, client 640,
  admin 102, agent 232). The aggregate command remains non-zero only because the current
  `develop` versions of Commitment Pooling and Community `status.json` are not Biome-formatted;
  this PR intentionally leaves both files identical to `develop`.

### Runtime and GraphQL proof limit

- With `DOCKER_HOST=unix:///Users/afo/.orbstack/run/docker.sock`, Envio v3 pulled/started its
  PostgreSQL and Hasura containers, initialized storage, tracked the schema, and then resumed the
  same database on a second run without reset.
- `http://127.0.0.1:8080/healthz` returned `OK`.
- A representative `Garden(limit: 1) { id chainId name openJoining createdAt }` query returned
  valid GraphQL data with an empty local result set.
- `_meta` returned both preserved boundaries: Arbitrum `433713812` and Sepolia `10243363`.
- The indexing process itself remained not ready (`progressBlock: -1`, `isReady: false`) because
  `ENVIO_API_TOKEN` is not available in the root `.env`. Both attempted starts stopped with
  Envio's explicit token requirement. The two containers created for proof were stopped without
  deleting their database volume; the pre-existing package Docker stack was left untouched.

No database reset, hosted deployment, or reindex was attempted. A token-backed catch-up and a
non-empty representative read remain required before push and PR retargeting.

## Production readiness

- **Reindex strategy:** keep the current v2 hosted deployment and endpoint serving while a v3
  deployment performs a full replay from the preserved per-chain start blocks. Compare entity
  counts, representative IDs/relationships, dynamic GardenAccount/OctantVault registrations, and
  production GraphQL responses before approving cutover.
- **Database/schema compatibility:** Envio v3 owns different generated/runtime internals. Prefer a
  new or isolated hosted database for the full replay. If an in-place database is proposed, take a
  verified backup and obtain an explicit compatibility decision before v3 migrations touch it.
  `schema.graphql` is unchanged in this PR, so the Green Goods entity and GraphQL contract has no
  intentional application-level delta.
- **Hosted configuration and secrets:** reconcile the Envio Cloud Git branch/version, both chain
  start blocks and contract addresses, `ENVIO_API_TOKEN`, database/Hasura configuration, endpoint
  access, monitoring, and alerts without adding package-local env files.
- **Rollback:** retain the v2 deployment, database, configuration, and endpoint routing until v3
  replay and read-back are accepted. Roll back traffic to that known-good revision if v3 lags,
  changes query behavior, or fails dynamic discovery.
- **Approval ownership:** Afo or the named release owner separately approves hosted
  configuration/secrets, database choice, full reindex, endpoint cutover, and rollback execution.
  This implementation session authorizes none of those release operations.

## 2026-07-27 QA pass 1 (Claude) — review and runtime verification

Verdict: **REQUEST_CHANGES**. No commit, push, PR retarget, or Linear write was performed.

### Token-backed runtime proof (AC-7) — now PASSING

`ENVIO_API_TOKEN` was added to the root `.env` mid-session, which cleared the prior blocker.

- Started with `bun --env-file=<abs>/.env run --cwd packages/indexer dev` under Node 22.22.1 and
  `DOCKER_HOST=unix:///Users/afo/.orbstack/run/docker.sock`. Envio logged
  `Found existing indexer storage. Resuming indexing state...` — the prior database was reused, not reset.
- `http://127.0.0.1:8080/healthz` → `200 OK`.
- `_meta` preserved both boundaries exactly: Arbitrum `startBlock 433713812`, Sepolia `10243363`,
  `end_block: null` on both.
- Real catch-up observed: Arbitrum advanced `446090518 → 488384624` and reached
  `progressBlock == sourceBlock`, `isReady: true`. Sepolia reached 99.98% (`11364018/11364218`).
- Dynamic registration fired against live mainnet data: **21** `Registered new GardenAccount` and
  **39** `Registered new OctantVault` log lines.
- `GreenGoodsRuntimeProof` returned a **non-empty** result:
  `id 0x511eefA22494b81542B505Acc1b0056aC92c9e37`, `chainId 11155111`, `name "Live Garden Coop 684100e3"`,
  `openJoining false`, `createdAt 1774821672`.
- Populated entity counts: Garden 15, Action 44, Gardener 59, GardenVault 27, GardenVaultIndex 15,
  VaultAddressIndex 27, VaultEvent 31, VaultDeposit 26, CampaignCookieJar 25, GardenDomains 15.
  YieldAllocation/Hypercert/GreenWill* were 0 (no such events in the indexed range yet).
- Stopped with **SIGINT only**. `envio stop`/`--restart` were never used. Volume
  `envio-postgres-data` and both containers were verified intact afterwards.

### Blocking findings

1. **Ship Gate `bun run test` fails, reproducibly.** Isolated `test:indexer` is 189 passing (1m),
   but under the repo-parallel Ship Gate: run 1 = 188 passing / **1 failing** (3m, exit 1), run 2 =
   187 passing / **2 failing** (6m, exit 2). Both runs failed on `Timeout of 10000ms exceeded`
   (`Octant retained surface`, and in run 2 also `ActionRegistry.ActionTitleUpdated`).
   `packages/indexer` is the **only** failing package in both runs — contracts (1533), shared
   (3358), client (640), admin (539), and agent (232) all pass, so this is not general repo
   flakiness but a property of the migrated indexer suite.
   Cause: `test/v3.ts` `processEvent` runs **one full Envio v3 indexer cycle per event**
   (`startBlock == endBlock`, single-element `simulate`). The failing Octant test issues 6
   sequential cycles. `replay.test.ts` batches 10 events into a single `process()` call and
   completes in ~1.1s — that batching is the in-repo fix pattern.
2. **`bun format:check` fails.** `packages/indexer/test/v3.ts` was unformatted (fixed in this pass
   with a targeted `biome format --write` on that file only). The remaining two failures,
   `.plans/active/commitment-pooling/status.json` and `.plans/active/community-interface/status.json`,
   are **pre-existing drift already on `origin/develop`** and were deliberately left untouched, so
   the global `bun format` step of the Ship Gate must not be run for this PR.
3. **`packages/indexer` `clean` is now destructive.** `envio stop` self-documents as
   "delete the database and stop all processes". `clean` was `tsc --clean` on develop and `stop` was
   `docker compose down`; both are now `envio stop`, so two previously-safe commands destroy indexed
   data. No repo automation calls them, so the risk is manual invocation.
4. **Bare `envio` scripts break on Node < 20.10.** `envio@3.2.1` ships `#!/usr/bin/env node` and
   `engines.node >=22`. `bun run` does not inject a Node shim (verified), so `dev`, `dev:restart`,
   `dev:manual`, `start`, `stop`, `clean`, `reset`, `db:up`, `db:down` all crash with
   `SyntaxError: Unexpected token 'with'` on this machine's default Node 18.18.2. Only `codegen`
   pins `bun --bun`. The Docker path is unaffected — `oven/bun:1.3.14-slim` ships a Bun-backed
   `node` shim, verified to handle import attributes.
5. **Claude-side canonical guidance still describes v2 (AC-8 gap).** `.claude/context/indexer.md`
   retains `setup-generated`, ReScript troubleshooting, `MockDb.createMockDb()`, and
   `mockDb.entities.*`; it also advises `bun stop` for port conflicts, which now deletes the
   database. `.claude/rules/indexer.md` still says "use `bun dev:docker` (not `bun dev`)",
   contradicting the migrated README/AGENTS. Codex-side guidance was updated; Claude-side was not.
6. **`doctor:fix` is a silent no-op.** It maps to `doctor.js --profile full`, which has no `--fix`
   flag, while `indexer-deploy.mdx` still documents "Auto-fix common issues".

### Non-blocking observations

- `replay.test.ts` compares two **independent fresh** indexers, so it proves determinism, not
  idempotence. Re-processing into the same store would double GreenWill `grantCount`/`holderCount`.
- `test/v3.ts` forces one block per event, so intra-block `logIndex` ordering is never exercised.
- Envio 3.2.1 materially widens the transitive dependency tree (adds `express`, `react`, `ink`,
  `@clickhouse/client`, `postgres`, `tsx`). Worth release-owner awareness.

### Publication blocker — RESOLVED

~~PR #649's head is a fork branch with `push: false`, so its diff cannot be updated from this
repo.~~ **Superseded.** The fork repo itself grants `push: false`, but PR #649 carries
`maintainer_can_modify: true`, so a base-repo maintainer can push to the PR head branch directly.
Afo retargeted the base to `develop`, and the corrected branch has been published to
`moose-code:chore/upgrade-envio-3.2.1` by fast-forward — no force push, and no superseding `origin`
branch was created. Current live PR state is recorded in the closeout section below.

### Gates run in this pass

Passing: `indexer:check-boundary` (10 contracts / 2 chains / preserved boundaries), `codegen`,
`build:indexer`, `test:indexer` (189), focused greps (`dynamic discovery` 2, `retained surface` 4,
`Envio v3 replay` 1), `check-codex-docs`, `check:source-structure`, `build:docs`, `docs:audit:ci`
(1 pre-existing warning outside this diff), `plan-hub validate` (39 hubs), `plan-hub linear-sync`
(no warnings), `bun lint` (exit 0), `git diff --check`.

Failing: `bun run test` (see finding 1), `bun format:check` (see finding 2).
Not run: `bun format` (would rewrite the two develop-baseline files), `bun build`, Ship Gate.

## 2026-07-27 Codex corrective pass

The user authorized fixes for the confirmed QA pass 1 findings. No commit, push, PR retarget,
deployment, hosted reindex, or Linear write was performed.

### Confirmed fixes

1. **Repository test stability**
   - Added `processEvents` to batch related simulated events into one Envio v3 processing cycle.
   - The ActionRegistry retained-surface test now uses one cycle instead of two.
   - The Octant retained-surface test now uses one cycle instead of six.
   - Test block allocation is tracked per chain instead of sharing one sequence between Arbitrum
     and Sepolia.
   - Mocha uses a bounded 30-second timeout for the remaining multi-cycle v3 tests.
   - `bun run test` passed under full repository parallel load. The indexer contributed 190
     passing tests; contracts, shared, client, admin, agent, and docs also passed.
2. **Database-safe commands**
   - `clean` now runs TypeScript build cleanup only.
   - ~~`stop` and `db:down` run `envio local docker down`, which removes the local containers
     without the database-deleting `envio stop` behavior or a volume-removal flag.~~
     **Corrected 2026-07-27 (QA pass 2):** this was false. `envio local docker down` also removes
     the `envio-postgres-data` volume — verified by observing the volume present before the command
     and absent after it. `stop` and `db:down` now run
     `docker ps -q --filter label=dev.envio.config-hash | xargs -r docker stop`, which stops the
     Envio-managed containers without removing them, preserves the volume and indexed state, is a
     clean no-op when nothing is running, and cannot touch the separate
     `docker-compose.indexer.yaml` stack.
   - `reset` remains the explicit destructive `envio stop` path.
3. **Bun-first, Node-compatible Envio CLI**
   - Package commands remain Bun-first while `scripts/dev/node-cli.js` selects a supported
     system Node 22 runtime for Envio. Forcing the Envio runtime through Bun was rejected by a
     corrective RED smoke test because it triggered handler-module initialization cycles.
   - `dev`, `dev:restart`, `dev:manual`, and `start` load `../../.env`, preserving the root-only
     environment contract and avoiding package-local `.env` files.
4. **Canonical v3 guidance**
   - `.claude/context/indexer.md` was replaced with Envio v3 handler, dynamic-registration,
     database-safety, testing, runtime, and GraphQL guidance.
   - `.claude/rules/indexer.md`, the package README, and deployment docs now agree on the standard
     `bun run dev` path and safe/destructive command boundaries.
5. **Removed false auto-fix surface**
   - Removed package `doctor:fix`, root `indexer:fix`, and the documentation claiming automatic
     remediation. The shared doctor remains intentionally non-mutating.
6. **Replay proof**
   - Clean replays still produce identical entity snapshots.
   - A same-store repeated block range is rejected by Envio v3 before handlers run, and the test
     proves the existing entity snapshot is unchanged after that rejected replay.

### Corrective proof

- `bun run --cwd packages/indexer clean`: passed.
- `bun run --cwd packages/indexer dev --help`, `start --help`, and `stop --help`: passed through
  the supported Node 22 Envio 3.2.1 launcher.
- Corrective runtime RED: forcing `envio dev` through `bun --bun` resumed storage but failed to
  auto-load handlers with `ReferenceError: Cannot access 'indexer' before initialization`.
- Corrective runtime GREEN: the Bun-first package command now delegates Envio to the repository's
  supported Node 22 launcher. It resumed the same local database, returned `/healthz` 200, reached
  `isReady: true` on Arbitrum and Sepolia, preserved starts `433713812` and `10243363` with null
  end blocks, and returned a non-empty Arbitrum Garden (`Ilhas de Abundância`). It was stopped
  with Ctrl-C; `envio-postgres-data` and both Envio-managed containers remained intact.
- `bun run indexer:check-boundary`: passed for 10 contracts and 2 chains with exact boundaries.
- Codegen, strict indexer build, and indexer lint: passed.
- `bun run test:indexer`: 190 passing. The sandboxed attempt produced six `listen EPERM`
  failures from local HTTP fixtures; the permitted loopback rerun passed all 190.
- Focused replay and retained-surface proof: 6 passing.
- `bun run test`: passed under full repository parallel load after a permitted rerun for Foundry
  macOS system access and indexer loopback fixtures.
- `VITE_CHAIN_ID=11155111 bun run build`: passed for contracts, shared, indexer, client, and admin.
- `bun lint`: passed with 164 pre-existing Solidity warnings and no errors.
- `node scripts/quality/check-codex-docs.js`: passed.
- `bun run build:docs`: passed.
- `bun run docs:audit:ci`: passed with the existing missing
  `.claude/context/intent.md` source warning.
- `bun run check:source-structure`: passed.
- `node scripts/dev/ci-local.js --quick`: lint, all typechecks, shared tests (3,358 passing,
  1 skipped), client tests (640 passing), focused admin hub tests (102 passing), and agent tests
  (232 passing, 1 skipped) passed. The aggregate command exits 1 only because its format phase
  encounters the two out-of-scope `develop` plan status files below.
- `bun format:check`: still fails only on the two out-of-scope `develop` plan status files. The
  migration `status.json` emitted by `plan-hub record-tdd` was formatted directly and now passes.
- `bun run agentic:check`: reaches the browser-policy guard, which fails because the current
  `CLAUDE.md` baseline lacks four required authenticated-Brave phrases. PRD-557 does not modify
  that file, so this remains an unrelated baseline issue.

### Review disposition

QA findings 1 and 3 through 6 are resolved. Finding 2 remains a repository-baseline formatting
blocker and must be corrected separately on `develop`; PRD-557 must not absorb those unrelated
plan-file formatting changes. The fork-owned PR #649 branch remains a separate publication
decision. A fresh independent review is still required before any push or PR retarget.

### Final changed-file scope audit

- The complete working result against `develop` contains 56 tracked migration files plus the two
  new v3 test files. Every delta is confined to the locked indexer, Bun workflow/CI, documentation,
  canonical guidance, dependency lock, migration plan, and repository harness surfaces.
- `packages/contracts`, `packages/client`, `packages/admin`, `packages/shared`,
  `.plans/active/commitment-pooling`, and `.plans/active/community-interface` have no diff from
  `develop`.
- `packages/indexer/schema.graphql` is unchanged, no Commitment Pooling term is present in indexer
  source/config/tests/schema, and no entity or GraphQL shape was added.
- `packages/indexer/.claude` contains no files. The package-local Envio skill copies present in the
  old PR branch are removed from the final result.
- Root/package workflows contain no pnpm execution. Remaining pnpm mentions are supply-chain
  filename guards or explicit guidance not to restore package-local pnpm workflows.
- `git diff --check develop --` passes. The two files reported by the global format gate are
  identical to `develop` in the final migration diff.
- ~~A final read-only GitHub refresh confirms PR #649 is still open at head `0fb3f72d` on
  `moose-code:chore/upgrade-envio-3.2.1` and still targets `main`; the corrected local branch has
  not been published to it.~~ **Stale — superseded by the closeout section below.**
- The PRD-557 parent-only Linear manifest regenerates without warnings. The live Linear connector
  was unavailable for the final refresh, so the next reviewer must re-read live PRD-557 before
  publication and compare it with this plan state.

## 2026-07-28 closeout pass (Claude) — implementation + publication

Worked from an isolated worktree at the live PR head, because the shared checkout had four
uncommitted files from another session (`.plans/active/commitment-pooling/{plan.todo.md,status.json}`,
`scripts/harness/plan-hub.{mjs,test.mjs}`) and a fast-forward would have collided with two of them.
The shared checkout was left untouched.

### Defects fixed

1. **Docker image had no real Node 22.** Reproduced first: running the exact image-mounted command
   under `oven/bun:1.3.14-slim` failed with `node-cli.js is still running under Bun`, because
   `bun run` substitutes Bun for `node` and `scripts/dev/node-cli.js` refuses to run under Bun.
   The image is now `node:22-slim` with the pinned Bun binary copied from `oven/bun:1.3.14-slim`,
   so both runtimes are present. Envio entry points were **not** reverted to `bun --bun envio`.
2. **`.dockerignore` excluded `patches/`** — found while building. The repository-root image build
   failed at `bun install --frozen-lockfile` with
   `Couldn't find patch file: 'patches/react-docgen-typescript@2.4.0.patch'`, because
   `package.json#patchedDependencies` resolves from the build context. `patches/` is now
   re-included. This was a pre-existing defect that blocked the image build before codegen ran.
3. **Deployment utilities still read `config.networks`.** `envio-integration.ts`,
   `post-deploy-verify.ts`, and `marketplace-readiness.ts` now read `chains`. The config writer
   additionally: preserves an already-configured `start_block` instead of recomputing it,
   preserves address-less dynamic entries verbatim (the old code wrote the literal string
   `"undefined"` through `String(contract.address)`), and **never writes an OctantVault address**.
   The transformation was extracted into a pure exported `applyDeploymentToEnvioChains` helper.
4. **Protocol status mis-reported dynamic registration.** `generate-protocol-status.mjs` required a
   static address, so the intentionally address-less `OctantVault` reported `indexer_ready: false`.
   Presence of the entry is now readiness for dynamically registered contracts; an *absent* entry
   is still not ready.
5. **Docs corrections** — entity list rebuilt from `schema.graphql`; the `Garden.id` compatibility
   exception documented in `.claude/rules/indexer.md` and `packages/indexer/AGENTS.md`; replay
   language changed to clean-replay determinism + same-store repeated-range rejection, with
   handler-level idempotence explicitly not claimed.

### Docker proof

- Repository-root image build from the checked-in frozen lockfile: **succeeded**. The image
  codegen stage ran `node ../../scripts/dev/node-cli.js envio codegen` and completed in 10.5s.
- Inside the built image: `node v22.23.1`, `bun 1.3.14`, `node_modules/.bin/envio` present.
- Non-destructive container smoke: in-container `bun run codegen` succeeded and the `start` entry
  resolved through the Node 22 launcher. No database was reset and no hosted indexing ran.

### Protocol-status proof

Regenerating with the fixed script flips exactly two entries — `octant-vault` on 42161 and
11155111, `false -> true` — verified by diffing the HEAD-script output against the fixed-script
output. Celo (42220) correctly stays `false` because it has no chain entry in `config.yaml`.
The committed `protocol-status.generated.json` was additionally **stale** relative to the v3
config, so regenerating it also corrects eight unrelated module states that predate this PR's
generator migration.

### Runtime proof (existing database reused)

The Envio-managed containers were already up and Hasura was already serving, so the runtime was
inspected rather than restarted. `/healthz` returned 200. `_meta` reported Arbitrum
`start 433713812` and Sepolia `start 10243363`, `endBlock: null` on both, and `isReady: true` on
both. A representative `Garden` query returned live data (`Ilhas de Abundância`,
`Greenpill Nigeria`); Garden 21 / GardenVault 39 / VaultAddressIndex 39 evidence dynamic
registration. `envio-postgres-data` remained present. No `reset`, `dev:restart`, `envio stop`, or
`envio local docker down` was run.
