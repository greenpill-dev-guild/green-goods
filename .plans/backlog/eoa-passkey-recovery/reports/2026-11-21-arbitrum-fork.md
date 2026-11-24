# PRD-1447 · Recovery executor on an Arbitrum One fork

**Observed** 2026-11-21T22:54:34Z
**Fork** Arbitrum One, chain ID 42161, block 526331210, block hash `0x73c4e760e0612af0c47bf5ae588fa14a1ccbb0f66ec49e8ccd5e2f1516059fc6`; repeated at the Arbitrum CI shard's default pin, block 466388412
**Tested commit** `0763777bbbb2f63d2e8a1c2a60e3725ada7e685a`
**Command** `ARBITRUM_FORK_RPC_URL=<Arbitrum RPC> ARBITRUM_FORK_BLOCK_NUMBER=526331210 bun run test --suite solidity --profile match -- test/fork/ArbitrumPasskeyRecovery.t.sol`, from `packages/contracts`
**Result** 8 passed, 0 failed, 0 skipped
**Environment** A Foundry fork with the deployed Kernel 0.3.3 account implementation and factories, WebAuthn validator `0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69`, permission signer `0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF` and EntryPoint 0.7. The executor is deployed on the fork by the test. The passkeys are P-256 keys the test holds, signing the assertion a device would produce; the validator checks it through its fallback verifier. The account pays its own gas from an EntryPoint deposit.

| Question | Observed result |
|---|---|
| Enrollment | The account's passkey installs the executor with a guardian wallet and a two-day delay. The chain shows the guardian, delay and generation. A Kernel that has not installed the executor cannot hold an enrollment. |
| Same-address sign-in | A relayer submits the guardian's signed approval (the guardian holds no ETH). Before the delay the request cannot run and the original passkey still works. After it, the replacement passkey sends an operation through EntryPoint and returns the ERC-1271 success value `0x1626ba7e` for a message, both at the original address. The account's address, proxy code and root validator are unchanged. |
| The lost passkey | EntryPoint refuses its operation with `AA24 signature error`, and its message signature is not accepted. |
| Why a binding is needed | The replacement credential on its own derives a different account address. |
| Cancellation | The original passkey cancels a pending request from the account. After the delay the request cannot run, and the cancelled approval cannot start another, although its deadline is still ahead. |
| Replay | A used approval cannot start or finish a second recovery. An approval signed for another chain is refused. |
| Removal | The account uninstalls the executor with its passkey; the guardian has no authority afterwards. |
| Existing agent access | Two permissions (a policy and an ECDSA signer each, the shape of a reporting grant) work before recovery and still work after it. The recovered owner removes one by its ID with `uninstallValidation`; that agent can no longer act, the other still can, and the owner still sends operations and signs messages. |
| Nonce sweep | Raising the account's validation nonce stops the agent and leaves the owner able to send operations, but the owner's message signature reverts with `InvalidNonce`. Targeted removal stays the rule for 0.3.3. |

The permissions in this run use Kernel's sudo policy, not the production reporting policy stack, and the grants are installed directly by the owner, not through the app. This is contract evidence. It proves no browser ceremony, no directory binding and no sponsorship. [Earlier research run](2026-11-08-arbitrum-fork.md) · [Plan](../plan.todo.md)
