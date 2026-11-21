# PRD-344 · Registrar cutover rehearsal against live state

**Observed** 2026-11-21T23:38:16Z
**Forks** Arbitrum One block 526331210 (`0x73c4e760e0612af0c47bf5ae588fa14a1ccbb0f66ec49e8ccd5e2f1516059fc6`) and Ethereum block 26465945 (`0xba34fdb9ed167af4772c55eba8685eabc724029265b6d3034688b4d0ded7eccf`)
**Tested commit** `0da818436c215c4382c740e265daab5a9ddbd5b3`
**Command** `ARBITRUM_FORK_RPC_URL=<Arbitrum archive RPC> ENS_REGISTRAR_ARBITRUM_FORK_BLOCK_NUMBER=526331210 ETHEREUM_FORK_RPC_URL=<Ethereum archive RPC> ENS_REGISTRAR_ETHEREUM_FORK_BLOCK_NUMBER=26465945 bun run test --suite solidity --profile match -- test/fork/CrossChainENSRegistrar.t.sol`, from `packages/contracts`
**Result** 1 passed, 0 failed, 0 skipped
**Environment** Foundry forks of both chains. Live contracts: the Arbitrum sender, the garden token, the CCIP router, the Ethereum receiver and the ENS public resolver. The registrar is deployed on the Arbitrum fork by the test. Owner actions are pranked as the live owners; nothing is signed or broadcast. The CCIP hop is simulated: the Arbitrum side sends through the real router, and a payload of the same encoding is handed to the receiver as its router.

| Step | Observed result |
|---|---|
| Inventory | The live sender has emitted 28 registrations (18 garden names, 10 member names) and no releases. Its mappings cannot be listed on chain, so its events are the inventory. |
| Reconcile with the sender | Every event's name, holder and type equals the sender's current state. |
| Carry over | All 28 names are imported and the import is ended. The registrar's owner, name and type for each equal the sender's. |
| Reconcile with L1 | Every carried-over name is registered on the live receiver for the same account and as the same type. No split exists today. |
| Garden token | Its owner points it at the registrar. A garden registration paid at the real router's quoted fee goes out through the real router. |
| Release | The owner releases one member name with a support reference. The name and the account's link are cleared on Arbitrum. The same call on a garden name is refused. |
| Receiver follows | The receiver's owner points it at the registrar. A message from the retired sender is refused with `UnauthorizedSender`. The release is applied: the receiver shows the name free and the ENS resolver no longer resolves it. |
| Assign | With L1 free, the owner assigns the name to a new account without the cooldown, while it stays unavailable to everyone else. The receiver registers it and the ENS resolver resolves the name to the new account. |

Limits: the rehearsal does not run a real CCIP delivery, does not mint a garden through the garden token, and does not exercise the timelock or Safe that owns the live contracts. The garden registration it sends is not delivered to L1. Member names and addresses are read from chain at run time and are not recorded here.
