# Celo GardenAccount Safe Ownership Plan

**Linear Issue**: [PRD-821](https://linear.app/greenpill-dev-guild/issue/PRD-821/give-each-celo-garden-safe-its-exact-arbitrum-gardenaccount-owner)  
**Linear Project**: Commitment Pooling  
**Linear Source**: source:plans  
**Feature Slug**: `celo-garden-account-safe-ownership`  
**Status**: ACTIVE  
**Created**: 2026-08-14  
**Last Updated**: 2026-08-15

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Reproduce the exact Arbitrum GardenAccount address and reviewed runtime on Celo. | The ERC-6551 derivation is already proven; finishing the implementation and dependency closure preserves one Garden identity across chains. |
| 2 | Deploy each Garden Safe directly in the final 2-of-3 topology. | No Garden Safe is known deployed, so a temporary deployment-EOA owner adds custody risk and creates a second ceremony without buying compatibility. |
| 3 | Final owners are GardenAccount, Green Goods protocol recovery Safe `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`, and Greenpill Dev Guild recovery Safe `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`. | Afo designated both exact Celo addresses on 2026-08-15; Garden control has one slot and the two reviewed recovery organizations retain an independent recovery path. |
| 4 | Use a dedicated Garden-bound relay, never the Settlement executor. | Cross-chain account control and settlement value execution are different trust domains and must not share authority. |
| 5 | The relay requires one recovery owner signature for every Safe execution. | Relay compromise cannot satisfy the Safe threshold or move value alone. |
| 6 | Use propose/finalize with cancellation only before finalization. | This gives honest, replay-safe cancellation semantics without claiming a race-unsafe post-dispatch revocation. |
| 7 | Keep `TBALib` local-chain behavior unchanged. | Native account creation is correct today; the Celo helper alone must use the immutable Arbitrum tuple. |
| 8 | Stop if exact bytecode/dependency or owner identity proof fails. | A separate Celo representative account or restored EOA bootstrap would be a different custody decision, not an implementation detail. |
| 9 | Implementation and release remain separate. | Passing tests and deterministic plans authorize no guardian mutation, Safe deployment, value authority, or broadcast. |
| 10 | Deploy the exact implementation and initialize all 18 accounts in one coordinator transaction. | The ERC-6551 registry is permissionless; exposing the implementation before initialization creates an avoidable initialization race. |
| 11 | Recreate the exact Guardian with its historical EOA owner, then treat relay trust and ownership transfer as separate release boundaries. | The Guardian constructor input is part of the immutable GardenAccount address proof and cannot be substituted without changing the implementation address. |
| 12 | House of Alignment receiving-address evidence is not a GardenAccount ownership broadcast gate. | Afo confirmed on 2026-08-15 that those funds are sent to the designated Green Goods Safe on Celo; this lane only proves GardenAccount identity, relay authority, and final Garden Safe custody. |

## Research / Plan Gate

- [x] Same-address ERC-6551 predictions verified for all 18 Gardens on Arbitrum and Celo.
- [x] Current Celo absence verified for the exact implementation and all 18 account addresses.
- [x] Local `block.chainid` and foreign-token owner behavior identified.
- [x] Safe v1.4.1 singleton/factory/MultiSend code identities and nested EIP-1271 mechanics verified.
- [x] Garden-bound relay threat model and cancellation boundary defined in `spec.md`.
- [x] Temporary deployment-EOA path explicitly superseded for this implementation.
- [x] Recover the exact implementation creation transaction, init-code hash, constructor tuple, deterministic dependency chain, and all 18 initialization hashes.
- [x] Close the designated recovery Safe gate. Pinned-fork nested EIP-1271 proof and
  singleton/runtime code hashes are closed by `evidence/celo-release-readiness-2026-08-17.json`.
  The Dev Guild recovery Safe passes every reviewed condition live. The Green Goods protocol
  recovery Safe `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` is live as 1-of-4 over a strict subset
  of the 6 owners frozen in `config/commitment-pooling-release.json`, which never matched on-chain
  state. Afo accepted that configuration for this release on 2026-08-17 and intends to raise the
  threshold separately, so it is no longer a blocker. The accepted configuration is recorded as
  `GREEN_GOODS_ACCEPTED_RECOVERY_CONFIGURATION` in `script/deploy/garden-safe-owners.ts` and final
  Garden Safe planning returns zero blockers across all 18 boundaries. Accepted risk: one of those
  four signers reaches the Garden Safe threshold of two combined with any other owner.
- [x] Reverify official CCIP router identities, selectors, code, and both Arbitrum/Celo lane directions at the research snapshot.
- [x] Rebuild the historical source/compiler/submodule snapshot and match the recovered creation-code hashes.

## Requirements Coverage

| Requirement | Lane | Planned step | Status |
|---|---|---|---|
| Exact implementation and dependency address/code ledger | `contracts` | Step 1 | Exact on-chain recovery and historical-source rebuild complete |
| RED proof for address, initialization, relay, Safe, and replay boundaries | `contracts` | Step 2 | Complete — Bun-wrapped relay unit suite passes 11/11 and the pinned fork proof passes |
| Atomic same-address account deployment and initialization | `contracts` | Step 3 | Complete — live Celo plan returns zero blockers and the pinned fork proof passes |
| Garden-bound authenticated relay with honest cancellation | `contracts` | Step 4 | Source/destination contracts compile, the 11-test unit suite passes, and the pinned fork proof passes. Live relay deployment belongs to the later PRD-819 lane |
| Direct final 2-of-3 Safe prediction/deployment/verifier tooling | `contracts` | Step 5 | Complete — PRD-733 live state is verified for both recovery Safes and planning returns zero blockers under the accepted 1-of-4 Green Goods configuration |
| Arbitrum/Celo fork and invariant proof | `contracts` | Step 6 | Passing — exact 18-account, Safe-code, Guardian, and nested EIP-1271 pinned fork test executes green on 2026-08-17 |
| Deterministic router/relay and Guardian transaction plan | `contracts` | Step 7 | Four zero-value, receipt-ordered transactions implemented in plan/verify-only tooling; live release-time artifact pending RPC |
| Exact candidate security review and evidence closure | `qa_pass_1`, `qa_pass_2` | Step 8 | Human-owned PR/review phase after readiness proof |
| UI and shared application changes | `ui`, `state_api` | Not applicable | N/A |

## Impact Analysis

### Expected Files to Modify

- `packages/contracts/src/accounts/Garden.sol`: only if exact artifact reconstruction proves a
  source/configuration mismatch that must be reconciled without changing the reviewed runtime.
- `packages/contracts/src/lib/TBA.sol`: expected to remain unchanged; tests document why the
  special Celo helper bypasses local-chain derivation.
- `packages/contracts/script/deploy/garden-safe-owners.ts`: replace the EOA bootstrap/swap model
  with direct final Safe planning and strict verification.
- `packages/contracts/script/deploy/garden-safe-owners.test.ts`: replace old-topology fixtures and
  add fail-closed final-state coverage.
- `.plans/active/commitment-pooling/settlement-spec.md`: keep the parent settlement spec aligned
  to the accepted ownership topology.

### Expected Files to Create

- Exact implementation/dependency reconstruction and deployment helpers under
  `packages/contracts/script/deploy/`, using the established Bun wrapper path.
- Dedicated Garden action router and Celo GardenAccount relay contracts outside the Settlement
  executor authority boundary.
- Unit, Arbitrum fork, Celo fork, and cross-chain invariant tests under
  `packages/contracts/test/`.
- Versioned, receipt-ready identity and final Safe artifacts under
  `packages/contracts/deployments/` only after their schema is reviewed.

Exact filenames are frozen in Step 1 after the existing deployment and cross-chain package
patterns are re-audited. Do not create a parallel abstraction if an established scoped location
already exists.

## Implementation Steps

### Step 1: Freeze the exact derivation and deployment ledger

**Files**: this hub, existing deployment artifacts, and a dated contracts handoff update.  
**Details**: recover the Arbitrum GardenAccount implementation creation transaction, init-code
hash, compiler settings, constructor tuple, factory, salt, linked bytecode, and immutable
dependency code/address closure. Freeze all 18 token IDs, account addresses, initialization
calldata hashes, and both recovery Safe identities. Re-read primary ERC-6551, Safe, and CCIP
deployments at the selected snapshot. Stop if any address cannot be reproduced without bytecode
injection. The 2026-08-15 on-chain derivation, historical-source rebuild, and 18-account ledgers
are frozen under `evidence/`. Afo designated the two PRD-733 recovery identities on 2026-08-15;
their live Celo Safe state is closed. Pinned-fork nested EIP-1271 behavior and exact runtime
code-hash proof remain open. House of Alignment receiving-address evidence is explicitly outside
this ownership gate because that upstream funding lands in the designated Green Goods Safe on
Celo.

### Step 2: Add RED-first proofs

**Files**: focused unit/fork test files only.  
**Details**: record failing tests for exact CREATE2 implementation deployment, 18 account
predictions, atomic initialization rollback, wrong local-chain tuple, source authentication,
wrong Garden/Safe/call/operation, action nonce, deadline, cancellation/finalization, Safe owner
thresholds, nested EIP-1271, and replay. Record the exact Bun commands in
`handoffs/codex-contracts.md` and with `plan-hub.mjs record-tdd`.

### Step 3: Implement exact Celo GardenAccount deployment

**Files**: one scoped deployment helper, one Bun operator wrapper, and focused tests.  
**Details**: reproduce required immutable dependencies, then deploy the reviewed implementation
and initialize all 18 accounts in one coordinator transaction from frozen calldata. Call the
registry with `(42161, Arbitrum GardenToken, tokenId)`. Add read-only planning and verification
modes; keep live execution unavailable without a separate release lock.

### Step 4: Implement the Garden-bound relay

**Files**: source router, destination relay, and focused unit tests.  
**Details**: implement exact-domain source authentication, per-Garden action nonces, action IDs,
deadlines, propose/finalize/cancel state, replay protection, and fixed GardenAccount-to-Safe call
shape. Deploy the source router inert, bind the destination relay exactly once after both contract
identities exist, and leave no reconfiguration path or ongoing bootstrap authority. Reject
arbitrary targets and every Settlement/Zodiac/value-authority shortcut. The relay must require the
committed independent recovery-owner signature bundle and never satisfy Safe threshold two alone.

### Step 5: Replace temporary Safe bootstrap tooling

**Files**: `garden-safe-owners.ts`, its tests, and the reviewed artifact schema.  
**Details**: remove 1-of-2 planning and owner-swap execution from the accepted path. Predict each
Safe from the final canonical owner order and threshold two, require nonce zero, and verify zero
native/G$, no modules, no guard, no Zodiac/Settlement/executor/peer/value authority. State that
arbitrary token inventory remains unproven. Stop on any existing code at a legacy prediction.

### Step 6: Prove the complete transition-free topology

**Files**: pinned Arbitrum/Celo fork and invariant tests.  
**Details**: without `vm.etch` or equivalent bytecode injection in acceptance tests, deploy the
exact dependencies, implementation, and all account proxies on the Celo fork; prove address and
runtime equality; deploy final Safes; prove GardenAccount plus either recovery Safe, both recovery
Safes, and all negative/replay/cancellation cases. Use Bun wrappers only.

### Step 7: Build release evidence without broadcasting

**Files**: read-only verifier, dry-run artifacts, and human release handoff.  
**Details**: produce exact address/code derivation, initializer hashes, relay config hashes,
owner/threshold/state reads, dependency identities, and rollback/stop conditions. No deployment,
guardian mutation, Safe transaction, authority grant, or value action occurs in this plan lane.
The accepted relay plan has exactly four zero-value boundaries: deploy the source router, deploy
the Celo relay after the source receipt, bind the destination once after the relay receipt, and
trust that exact relay in the Guardian after the binding receipt. The checked-in operator exposes
only `plan` and `verify`; signing and broadcast stay outside this implementation task.

### Step 8: Independent critical-surface review

**Files**: QA handoffs and any scoped corrections explicitly accepted from review.  
**Details**: review the same clean committed candidate twice, resolve every Critical/High finding,
rerun fresh proof, and stop for human release authorization. Release must be a separate task with
its own pinned candidate and transaction-by-transaction authority.

## Test Strategy

- **Unit**: deterministic hashes, constructor/immutable ledger, initialization atomicity, relay
  state machine, source/domain binding, cancellation, expiry, replay, and Safe calldata/signature
  construction.
- **Fork**: pinned Arbitrum Garden inventory and implementation facts; pinned Celo official
  ERC-6551/Safe/CCIP code; exact dependency and account deployment; final Safe setup; nested
  EIP-1271 execution and recovery.
- **Invariant**: one action executes at most once; one Garden cannot authorize another; relay
  output equals the committed Safe transaction; cancellation and expiry never execute; relay
  never becomes an owner/module/guard/Zodiac/Settlement role or sole value authority.
- **Operator tooling**: plan and verify modes are pure/read-only, artifact writes are atomic,
  resumability never replays a mined boundary, and malformed/mismatched inputs stop before
  transaction composition.

## Validation

- [x] Targeted Bun-wrapped relay unit command and gas result recorded during Step 2.
- [x] Focused deployment operator tests pass 21/21 across GardenAccount, final Safe, and relay planning.
- [x] Pinned fork command passes: `bun run test:fork:garden-account-release` →
  `testFork_exactDependenciesAllAccountsAndNestedSafeThresholds()` PASS (1 passed, 0 failed),
  `deployAndInitialize` measured at 15,133,908 gas against Celo's 30,000,000 block limit. The
  earlier environment block was empty `ARBITRUM_RPC_URL`/`CELO_RPC_URL` in the root `.env` sending
  the scripts to public non-archive endpoints, not a code defect.
- [x] `bun run --cwd packages/contracts test:script` — 21 files, 225 tests, 0 failed. The command
  previously ran only 19 files: its unquoted `script/**/*.test.ts` glob was expanded by `sh` as a
  single level, silently excluding `release-operator.test.ts` and `release-verify.test.ts`. Fixed
  to `vitest run --dir script`.
- [x] `bun run --cwd packages/contracts build:full` — exit 0.
- [x] `bun run --cwd packages/contracts check:sizes` — all deployable contracts under EIP-170.
- [ ] `bash scripts/quality/check-test-quality.sh`
- [x] `node scripts/harness/plan-hub.mjs validate` — 42 feature hubs validated on 2026-08-16.
- [ ] Full Ship Gate only for explicit PR/merge readiness.
- [ ] Fresh validation receipts in every terminal lane handoff.

## Boundaries

This active plan authorizes planning and later scoped implementation only. It does not authorize
dependency installation, production deployment, broadcast, guardian trust mutation, Safe
creation, Safe transaction execution, role/allowance/peer configuration, ownership transfer,
value movement, canary, unpause, commit, push, or merge by itself.
