# Recover a Kernel passkey account with a wallet - Contracts Handoff

## Lane

- Owner: Claude
- Branch: `feature/passkey-wallet-recovery`
- Status: plan steps 1 and 2 on a pull request for review; step 3 (pinned deployment and verifier) not started

## Scope

- `packages/contracts/src/modules/PasskeyRecoveryExecutor.sol`: a Kernel 0.3.3 executor module. An enrolled wallet replaces the account's passkey after a delay; the account cancels, replaces or removes the guardian.
- `packages/contracts/src/interfaces/IPasskeyRecoveryExecutor.sol` (its types, errors and events) and `packages/contracts/src/interfaces/IKernelPasskey.sol` (the Kernel and validator calls it makes).
- `packages/contracts/test/unit/PasskeyRecoveryExecutor.t.sol` and `packages/contracts/test/fork/ArbitrumPasskeyRecovery.t.sol`.
- Out of this lane so far: deployment, the directory binding, the sign-in change, grant discovery and the client screens (plan steps 3 to 10).

## Decisions this lane made, for review

| Decision | Why | Alternative |
|---|---|---|
| The guardian stays enrolled after a recovery, at a new generation. | A member who loses the replacement passkey before enrolling again would otherwise have no way back. The guardian could already take the account, so keeping it adds no authority. | Consume the enrollment, as the spec's wording can be read; the member must enroll again. |
| A request lapses 7 days after its delay ends. | A request nobody acted on must not replace a working passkey months later. | No expiry. |
| The delay is set per enrollment, 0 to 30 days; the contract sets no minimum. | Decided 21 Nov 2026: the app defaults to 48 hours and the number stays an app setting. | A contract-wide minimum. |
| Either the account or the guardian can cancel, and cancelling voids every approval signed so far. | The member can stop a request with their passkey; the guardian can withdraw an approval it regrets. | Account only. |
| Guardians may be contracts (ERC-1271), not only plain wallets. | A member's Safe can be a guardian at no extra cost. | Plain wallets only. |

## Known limits

- "The account" is whoever can make it call the executor: its passkey, and any permission the member gave an unrestricted call right. A reporting grant is limited to one attestation call and cannot reach it. Any future grant with a wider call right must exclude the executor, as it must exclude the account itself.
- The evidence event proves the validator now holds the new key. It does not prove who holds the device; the directory still needs a fresh assertion from the replacement passkey (plan step 4).
- The fork passkeys are P-256 keys the test holds. No browser ceremony, sponsorship or directory lookup is proven here.

## TDD Proof

- RED: not recorded
- GREEN: see the receipt below
- Proof limit: the executor was written before its tests. Fallback proof is the unit suite and the Arbitrum fork suite at the tested commit. An independent review then added behaviour (request expiry, recovery of an account whose key was removed, enrollment needing the Kernel install, the stored-key check), each with its own test.

## Validation

- Unit: authority, replay across accounts, generations and deadlines, expiry, cancellation, failure keeping the old key, contract guardians.
- Fork (Arbitrum One, deployed Kernel 0.3.3, WebAuthn validator, permission signer, EntryPoint 0.7): see [the fork report](../reports/2026-11-21-arbitrum-fork.md).

## Validation Receipt

- Tested implementation commit SHA: `0763777bbbb2f63d2e8a1c2a60e3725ada7e685a`
- Run at (UTC): 2026-11-21T22:54:34Z
- Exact command(s), from `packages/contracts`:
  - `bun run test --suite solidity --profile match -- test/unit/PasskeyRecoveryExecutor.t.sol`
  - `ARBITRUM_FORK_RPC_URL=https://arbitrum.gateway.tenderly.co ARBITRUM_FORK_BLOCK_NUMBER=526331210 bun run test --suite solidity --profile match -- test/fork/ArbitrumPasskeyRecovery.t.sol`
  - the same fork command at block 466388412, and with no RPC set
- Result: unit 23 passed, 0 failed. Fork at block 526331210: 8 passed, 0 failed, 0 skipped. Fork at the Arbitrum CI shard's default pin, block 466388412: 8 passed. With no RPC: 0 passed, 8 skipped.
- Validated paths: `packages/contracts/src/modules/PasskeyRecoveryExecutor.sol`, `packages/contracts/src/interfaces/IPasskeyRecoveryExecutor.sol`, `packages/contracts/src/interfaces/IKernelPasskey.sol`, `packages/contracts/test/unit/PasskeyRecoveryExecutor.t.sol`, `packages/contracts/test/fork/ArbitrumPasskeyRecovery.t.sol`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` printed nothing
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Deployment (plan step 3) waits on the eligible cohort and the Arbitrum confirmation rule in `spec.md` § Before rollout.
- Plan steps 4 to 6 follow decision 7 in `plan.todo.md`: the chain is the authority and the directory keeps a re-checked pointer. They are a follow-up pull request and touch Shared auth, which is critical tier.
