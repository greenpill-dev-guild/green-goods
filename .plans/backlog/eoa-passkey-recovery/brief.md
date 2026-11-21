# Recover a Kernel passkey account with a wallet

A member with a deployed Kernel 0.3.3 account on Arbitrum One can enroll an Ethereum wallet they control. If they lose their passkey, the enrolled wallet can authorize a replacement passkey for the same Green Goods address. The member can then sign in on a clean browser and remove reporting grants they no longer trust.

The fork proved this sequence with two working reporting grants. Rotating the passkey left both grants active. Targeted removal stopped both delegates and preserved the recovered owner's transaction and message signing. The current revoke-all nonce sweep stopped the delegates but broke the recovered owner's ERC-1271 message signing. [Fork results](reports/2026-11-08-arbitrum-fork.md)

Start with accounts that match the Arbitrum deployment profile and enroll before loss. The first release covers wallet enrollment, replacement, verified sign-in, and targeted reporting-grant removal. Email recovery, ENS name reassignment, other chains, Kernel 0.3.1 recovery, and general-purpose module management are separate work.

The enrolled wallet can ultimately take control of the account by choosing the new passkey. The member must understand that authority at enrollment and be able to remove it using their current passkey. The rollout review must settle whether recovery can execute immediately or requires an onchain delay.

[Research issue RESR-21](https://linear.app/green-goods/issue/RESR-21/kernel-guardian-recovery-and-ens-username-recovery-boundary) · [Specification](spec.md) · [Implementation plan](plan.todo.md) · [Acceptance checks](eval.md)
