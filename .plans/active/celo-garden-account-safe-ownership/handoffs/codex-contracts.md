# Celo GardenAccount Safe Ownership - Contracts Handoff

## Lane

- Owner: Codex
- Branch: the human will publish this work from the current candidate when it is ready to broadcast
- Status: implementation in progress; pinned-fork EIP-1271/code proof and deterministic
  router/relay/Guardian transaction plans remain open
- Linear: [PRD-821](https://linear.app/greenpill-dev-guild/issue/PRD-821/give-each-celo-garden-safe-its-exact-arbitrum-gardenaccount-owner); parent-only mirror

## Scope

1. Recover and freeze the exact Arbitrum GardenAccount implementation creation transaction,
   init-code hash, compiler settings, constructor immutables, factory, salt, and dependency closure.
2. Add RED proof for same-address deployment, atomic initialization, relay authentication/state,
   Safe threshold/recovery, replay, and negative authority boundaries.
3. Implement the exact Celo dependency/account deployment helper, dedicated Garden-bound relay,
   and direct final 2-of-3 Safe plan/verifier.
4. Prove the complete path on pinned Arbitrum and Celo forks with Bun wrappers only.

Do not implement or reuse Settlement executor authority, Zodiac roles, peer wiring, allowances,
G$ movement, canaries, application UI, package-level env files, or raw Forge commands.

## Start Gate

- Run `node scripts/harness/plan-hub.mjs linear-sync --feature celo-garden-account-safe-ownership --json`.
- Confirm the exact active plan and Linear parent agree.
- Read root and contracts `AGENTS.md`, `.claude/context/contracts.md`, this hub, the parent spike,
  Safe owner tooling/tests, GardenAccount/GardenToken/TBA/AccountV3/guardian sources, and the live
  implementation candidate diff completely.
- Pin the exact implementation and both chain snapshots before proof.
- Deterministic implementation may proceed against the two frozen recovery identities. Stop
  broadcast readiness if pinned-fork EIP-1271/code proof or an exact fail-closed deployment plan
  remains unresolved. House of Alignment evidence is outside this ownership gate because its funds
  land in the designated Green Goods Safe on Celo.

## Step 1 Evidence (2026-08-15)

- Recovered the exact Arbitrum CREATE2 transactions for the AccountGuardian, ResolverStub, both
  resolver proxies, and GardenAccount implementation. Every salt and init-code hash recomputes the
  live target.
- Verified the deterministic factory, EntryPoint, Multicall3, and ERC-6551 registry have exact
  matching code on Celo. The exact stub, Guardian, resolver proxies, implementation, and all 18
  accounts are absent at pinned Celo block `74877942`.
- Froze all 18 foreign tuples, account runtime hashes, and initializer hashes at Arbitrum block
  `494723355`.
- Verified official Arbitrum/Celo CCIP routers, selectors, code, and both lane directions.
- Independently rebuilt GardenAccount from repository commit `175469f2fc699712a9fa8016d6aa25390282989d`
  with the pinned compiler profile and tokenbound commit. Creation code, constructor arguments,
  init code, factory input, and CREATE2 prediction match the recovered deployment exactly.
- Evidence: `../evidence/address-code-derivation-2026-08-15.md` and its five JSON ledgers.
- Afo designated Green Goods protocol recovery Safe
  `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` and Greenpill Dev Guild recovery Safe
  `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C` on 2026-08-15. This closes deterministic identity
  selection and permits RED-first implementation; live verification remains mandatory before
  spec closure, fork acceptance, or broadcast readiness.

## TDD Proof

- RED (2026-08-15): `bun ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
  from `packages/contracts` failed on the new final-topology test surface: missing
  `buildFinalSafeInitializer`, `assertFinalSafeState`, `buildFinalDeploymentArtifact`, and
  `FinalSafePlan`, plus the stricter recovery-Safe verifier signatures. This is the expected
  pre-implementation failure for removal of the temporary owner-swap path.
- Test-runner limitation: the repository's preferred `node-cli.js` wrapper cannot read the local
  mise Node shim in this sandbox, and Vitest workers cannot run under Bun directly. The TypeScript
  RED is valid; executable Vitest GREEN remains mandatory under compatible Node.
- GREEN (script/operator surface): direct TypeScript compilation passes. Focused Vitest runs pass
  23/26 tests: all 3 Celo GardenAccount operator tests, all 15 final Garden Safe tests, and 5/8
  release-operator behavior tests. The remaining three release-operator fixtures fail only because
  this sandbox cannot spawn Git for their temporary repositories (`spawnSync git EPERM`).
- Solidity runner blocker: `bun script/utils/build-target.ts test/unit/GardenAccountRelay.t.sol`
  reaches the reviewed Bun wrapper, then fails because its subprocess cannot resolve `forge` in
  this sandbox (`Executable not found in $PATH: "forge"`). No raw Forge command was used.
- Static Solidity proof: all new relay/coordinator sources and the relay test parse successfully;
  source Solhint has zero errors (struct-packing and intentional low-level-call warnings only).
- Offline deployment plan: `bun script/deploy/celo-garden-accounts.ts plan` rebuilds all 18 exact
  initializer hashes, writes the runtime plan, and stops on two precise missing inputs: the raw
  five-transaction CREATE2 init-code bundle and the production coordinator artifact.
- Proof limit: Step 1 is evidence/spec work and does not itself require RED/GREEN; all
  behavior-changing Steps 3-6 do.

## Implemented Surface

- `src/accounts/CeloGardenAccountDeploymentCoordinator.sol`: one-shot exact-hash dependency
  deployment plus all 18 foreign-tuple account initializations in one transaction.
- `src/accounts/GardenActionRouter.sol`, `src/accounts/CeloGardenAccountRelay.sol`, and
  `src/libraries/GardenSafeActionCodec.sol`: dedicated authenticated relay, cancellation/finality,
  replay protection, exact Safe transaction binding, nested recovery Safe signature assembly, and
  a deployable cross-chain bootstrap sequence. The source router is inert until the reviewed
  binder sets the Celo relay exactly once; no reconfiguration path survives that call.
- `script/deploy/celo-garden-accounts.ts`: offline/live plan, exact initializer reconstruction,
  two explicit receipt-separated release boundaries, exact zero-value/nonce/calldata receipt
  binding, coordinator-runtime revalidation before Step 2, and post-deploy verification.
- `script/deploy/garden-safe-owners.ts`: direct final 2-of-3 Safe planning/deployment/verification;
  no temporary EOA or owner-swap path.
- Both broadcast wrappers now require the interactive release-operator session lock.

## Validation

- `bun ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: pass.
- Focused deployment/operator Vitest: 21/21 pass across GardenAccount deployment, final Safe, and
  relay planning.
- Bun-wrapped relay unit suite: 11/11 pass; measured gas is below the fixed 500,000 limits.
- Relay constructor/deployment audit: the former circular source-router/destination-relay address
  dependency is removed; focused tests cover unbound refusal, unauthorized binding, permanent
  one-time binding, replay rejection, cancellation, and Garden/Safe/call binding.
- The exact pinned Arbitrum/Celo fork test is authored. The Bun-wrapped focused compile was stopped
  after five minutes without output, and fork execution cannot reach the required RPC domains from
  this workspace.
- Plan-hub validation: 42 feature hubs pass.
- Full build, size, fork, invariant, test-quality, and Ship Gate remain mandatory.

## Validation Receipt

- Tested implementation commit SHA: `8fd3311980b28d71d48f72fe41c99d15276de912`
- Run at (UTC): `2026-08-23T08:02:46Z`
- Exact command(s): `bun run --filter @green-goods/contracts test:match --
  test/unit/GardenAccountRelay.t.sol -vv`; `bun run --filter @green-goods/contracts test:script --
  script/deploy/celo-garden-accounts.test.ts script/deploy/garden-safe-owners.test.ts
  script/release-operator.test.ts`.
- Result: relay unit/fuzz/invariant proof passed 16/16, including 256 invariant runs with 128,000
  calls each; max-calldata proposal/finalization gas was 124,680/55,580 below 500,000. The three
  focused operator suites passed 31/31.
- Validated paths: Garden account coordinator, relay/codec/router contracts and unit/invariant
  tests; Celo account and final-Safe operator scripts/tests; release operator and package wrappers.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  packages/contracts` → empty.
- Evidence-only diff command and result (if applicable): `git diff --exit-code
  8fd3311980b28d71d48f72fe41c99d15276de912..HEAD -- packages/contracts` → empty, exit code 0.
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- packages/contracts` → empty.

## Risks / Blockers

- PRD-733 contains the human-designated protocol and Dev Guild recovery Safe addresses. Live Safe
  Wallet evidence confirms both are Safe v1.4.1+L2 with unique owners, no modules, no guard, and the
  v1.4.1 fallback handler. Pinned-fork singleton/runtime and nested EIP-1271 execution remain open.
  House of Alignment receiving-address evidence is explicitly outside this ownership gate.
- The historical compiler/source/submodule rebuild is closed by
  `../evidence/historical-garden-account-rebuild-2026-08-15.json`.
- The five raw historical CREATE2 init-code values and all 18 GardenAccount initializers are frozen
  in reviewed evidence; the coordinator and operator reject any mismatch.
- The pinned fork receipt and the live release-time router/relay/Guardian transaction plan remain
  blocked on an RPC-capable environment and production artifacts.
- The human will publish the candidate branch and PR; this session performs no branch, commit, or
  push action.
- The exact Guardian is necessarily initialized to the historical deployment EOA. Guardian trust
  and any ownership transfer require explicit transaction-by-transaction release review.
- The deterministic source-router/relay deployment, one-time binding, and Guardian trust sequence
  is implemented as four receipt-ordered, zero-value plan/verify transactions with no broadcast
  mode. Its exact release artifact still must be generated and verified against fresh live state.
- Any live deployment, guardian trust mutation, Safe creation, or value-related configuration is
  outside this lane and requires a separate human release authorization.
