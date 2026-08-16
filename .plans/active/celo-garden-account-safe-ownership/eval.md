# Celo GardenAccount Safe Ownership Evaluation Plan

## Release Gates

1. **Identity correctness**: exact implementation CREATE2 inputs, immutable dependency closure,
   runtime hashes, source token tuple, and all 18 account addresses reproduce without bytecode
   injection.
2. **Initialization safety**: exact implementation deployment, registry creation, and every
   reviewed `initialize` calldata are one coordinator transaction; a failed initialization rolls
   back the implementation boundary; repeated, pre-initialized, or mismatched accounts fail closed.
3. **Relay security**: source chain/sender, Garden identity, destination Safe, exact Safe call and
   operation, nonce/action ID, deadline, replay state, and pre-finalization cancellation are bound.
4. **Threshold independence**: GardenAccount plus one recovery Safe executes; both recovery Safes
   execute; GardenAccount alone, relay alone, or either recovery Safe alone does not.
5. **Final Safe state**: exactly three unique reviewed owners, threshold two, nonce zero, zero
   native/G$, no modules, no guard, and no Zodiac/Settlement/executor/peer/value authority.
6. **Evidence honesty**: arbitrary ERC-20/ERC-721/ERC-1155 absence is never claimed without
   separate inventory evidence.
7. **Review quality**: the exact clean candidate has no unresolved Critical or High finding and
   every terminal handoff carries a fresh validation receipt.
8. **Human release gate**: implementation proof does not authorize deployment, guardian trust,
   Safe creation, or any value-authority action.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Implementation identity | Original Arbitrum init code, constructor tuple, factory, salt, and runtime reproduce the implementation address and code on Celo. | `contracts` | Derivation ledger + pinned fork receipt |
| AC-2 | ERC-6551 identity | All 18 source tuples predict and deploy the exact Arbitrum GardenAccount address on Celo. | `contracts` | Address table + fork tests |
| AC-3 | Atomic initialization | Implementation deployment plus all 18 account initializations succeed or revert together; pre-created-uninitialized adoption, front-run, partial-batch, and mismatch cases are proven. | `contracts` | Unit/fork tests |
| AC-4 | Relay authentication | Wrong chain, router, sender, Garden, token, account, Safe, call, operation, nonce, signature hash, deadline, and replay all fail. | `contracts` | Unit/invariant tests |
| AC-5 | Cancellation | Proposed actions cancel before finalization; cancelled/expired actions cannot finalize or execute; finalized actions cannot claim revocability. | `contracts` | State-machine tests |
| AC-6 | Final Safe topology | Direct setup yields exact owners, threshold two, nonce zero, and inert authority state. | `contracts` | Safe fork reads + verifier artifact |
| AC-7 | Normal and recovery execution | GardenAccount + either recovery executes; both recoveries execute; every single-owner path fails. | `contracts` | Nested EIP-1271 fork tests |
| AC-8 | Replay and failure atomicity | Duplicate relay messages and Safe nonce replays fail; failed inner calls leave no partial execution. | `contracts` | Fork/invariant tests |
| AC-9 | Independent security review | Exact committed range and live dependency identities are reviewed with no unresolved Critical/High. | `qa_pass_1` | Review handoff |
| AC-10 | Closure review | Fresh proofs, code/address ledger, state verifier, blockers, and release boundaries agree. | `qa_pass_2` | Final handoff |

## Required Negative Proof

- Celo account derivation using local chain ID `42220` does not equal the Arbitrum GardenAccount.
- Current Celo implementation `0x710cBFB9a29920B4577692eD495972fcd27286b4` derives a separate
  representative account and is not accepted as same identity.
- No acceptance test uses `vm.etch`, storage injection, or a substituted implementation to claim
  production deployability.
- An untrusted guardian executor cannot call the account.
- The dedicated relay cannot call a different account, Safe, target, operation, or calldata.
- The relay cannot reuse `CeloSettlementExecutor`, become a Safe owner/module, or exercise a
  Zodiac/Settlement permission.
- The direct final Safe recipe contains no deployment EOA and no threshold-one state.

## Validation Receipt Requirements

Each implementation or QA lane marked passed/completed records:

- exact tested commit SHA and UTC time;
- exact Bun command and summarized result;
- pinned Arbitrum and Celo block numbers/hashes;
- exact official contract identities and code hashes;
- validated paths and an empty path-scoped worktree status; and
- evidence-only parent diff proof when reusing an earlier tested commit.

No validation receipt is a production broadcast authorization.
