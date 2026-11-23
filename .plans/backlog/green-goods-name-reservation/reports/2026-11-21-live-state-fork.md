# PRD-1402 · A member registers the directory's username, on live state

**Observed** 2026-11-21T22:27:51Z
**Forks** Arbitrum One block 526331210 and Ethereum block 26465945
**Tested commit** `5e431111dc9cabdd82f6e23783073dde68051d9e`
**Command** `ARBITRUM_FORK_RPC_URL=<Arbitrum archive RPC> ENS_REGISTRAR_ARBITRUM_FORK_BLOCK_NUMBER=526331210 ETHEREUM_FORK_RPC_URL=<Ethereum archive RPC> ENS_REGISTRAR_ETHEREUM_FORK_BLOCK_NUMBER=26465945 bun run test --suite solidity --profile match -- test/fork/CrossChainENSRegistrar.t.sol`, from `packages/contracts`
**Result** 1 passed, 0 failed, 0 skipped
**Environment** The registrar cutover rehearsal in [the sender-recovery hub](../../ens-l2-sender-admin-recovery/reports/2026-11-21-live-state-fork.md), continued. Live contracts: Hats Protocol with the live garden-member hat, the CCIP router, the Ethereum receiver and the ENS public resolver. The directory's signing key is a key the test holds; no agent endpoint is involved.

| Step | Observed result |
|---|---|
| Membership | After the cutover, the owner points the registrar at the live Hats contract and the live garden-member hat. A live member account whose name an operator released earlier in the run still wears that hat. |
| A different name | The member presents the directory's grant for their username with another name. Refused: `InvalidNameGrant`. |
| A non-member | An account that joined no garden presents a valid grant for itself. Refused: `NotProtocolMember`. |
| Registration | The member registers the username the grant names. The real router is paid exactly its quoted fee from the registrar's reserve; the member's account sends no ETH; its one sponsored registration is marked used. |
| L1 follows | The live receiver registers the name for the member and the ENS resolver resolves it to the member's account. |

Limits: the CCIP delivery is simulated as in the cutover rehearsal. No directory endpoint, no passkey ceremony, no paymaster and no app screen is exercised. The grant's deadline and lifetime, chain and contract binding, the one-per-account rule, the daily limits and the fee cap are covered by the unit suite, not this run.
