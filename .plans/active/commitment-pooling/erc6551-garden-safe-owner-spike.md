# ERC-6551 Garden account as a Celo Safe owner — bounded spike

Date: 2026-08-12

Status: fork proof complete; production owner-set decision remains open.

Linear: [PRD-819](https://linear.app/greenpill-dev-guild/issue/PRD-819/deploy-celo-garden-safes-and-bounded-settlement-authority)

## Question

Can the Arbitrum Garden token-bound account occupy one owner slot in its Celo Garden Safe without
weakening the exact 2-of-3 recovery posture?

This spike answers mechanics and trust boundaries only. It does not authorize a production Safe,
Zodiac role, peer, value movement, ownership transfer, canary, or settlement ABI/storage change.

## Facts the proof must not collapse

1. ERC-6551 can derive the same account address on multiple EVM chains only when the registry,
   implementation address, salt, source chain ID, token contract, and token ID are identical.
2. The current Green Goods Arbitrum and Celo GardenAccount implementations and guardians have
   different addresses. The exact Arbitrum root Garden account address currently has no code on
   Celo. Address predictability is therefore not deployment proof.
3. The current Tokenbound AccountV3 implementation returns no NFT owner when the bound token is on
   a foreign chain. The Arbitrum Garden owner cannot directly produce a locally valid Celo
   ERC-1271 signature through this implementation.
4. AccountV3 does allow a guardian-trusted cross-chain executor to call `execute` for a foreign
   account. That trust is global at the guardian, not Garden-specific. A production relay would
   have to authenticate the Arbitrum source, bind the exact Garden account and Safe, constrain the
   operation, and reject replay before this path could honestly be called Garden-controlled.
5. Safe v1.4.1 permits a contract owner to satisfy one threshold slot by calling
   `execTransaction` and supplying the prevalidated-owner signature form. The other threshold slot
   still needs an independent owner approval.

## Candidate topology under test

Each Garden Safe has exactly three owners and threshold 2:

- the exact cross-chain Garden ERC-6551 account;
- the protocol recovery Safe; and
- the Dev Guild recovery Safe.

The normal Garden path is the ERC-6551 account plus one recovery owner. The recovery path is both
recovery owners. The settlement executor remains a Zodiac Roles member and never becomes a Safe
owner. It is not silently reused as the cross-chain Garden owner relay.

## Fork acceptance contract

The proof uses the canonical ERC-6551 registry and the released Safe v1.4.1 singleton/factory on
pinned Arbitrum One and Celo forks. It must establish all of the following:

- the exact Arbitrum tuple predicts the live Arbitrum Garden account address on both chains;
- that exact address is presently undeployed on Celo, and the current Celo implementation derives
  a different address for the same source Garden tuple;
- the foreign account reports no local NFT owner and rejects an untrusted executor;
- a guardian-trusted executor can make the foreign account call the real Safe;
- the Safe owner set is exactly the Garden account plus two recovery owners at threshold 2;
- Garden account plus one recovery owner can execute, while either one alone cannot;
- both recovery owners can execute without the Garden account;
- a different Garden account cannot substitute for the Safe's Garden owner; and
- replay of an already executed Safe transaction cannot execute twice.

The test may use the already-deployed Celo GardenAccount implementation to prove execution
mechanics. That result is not same-address deployment evidence and must be reported separately.

## Decision gate after the spike

Adopt the Garden account owner only after a follow-on design closes both missing production
pieces:

1. a reproducible deployment of the reviewed GardenAccount implementation at the exact same
   address on Celo, with matching runtime and immutable dependencies; and
2. an authenticated, replay-safe, Garden-bound cross-chain executor whose authority is narrower
   than the recovery threshold and whose failure cannot strand the two-recovery-owner path.

If either gate remains open, the current settlement specification wins: protocol recovery, Dev
Guild recovery, and one named Garden recovery delegate remain the three Safe owners.

## Result

The pinned Arbitrum One and Celo fork proof passed 8/8 ownership cases, and the complete settlement
fork shard passed 16/16. It used the live canonical ERC-6551 registry, live Safe v1.4.1 singleton
and factory, the deployed Celo AccountV3 implementation and guardian, and fork-local mutations
only.

The mechanics are viable: the foreign Garden account plus one nested recovery Safe executes a real
Safe transaction, both nested recovery Safes retain an independent EIP-1271 recovery path, either
owner alone fails, a different Garden account cannot substitute, an untrusted caller fails, and
the Safe nonce rejects replay.

The production path is not ready. The exact Arbitrum Garden account address still has no code on
Celo, the deployed Celo implementation derives a different account address, the foreign account
has no local NFT owner, and guardian trust alone does not authenticate an Arbitrum Garden action.
Recommendation: keep the current three-recovery-owner configuration for the first Garden Safe
deployment and treat same-address implementation deployment plus a bounded Garden-owner relay as
a follow-on security design, not release ceremony configuration.
