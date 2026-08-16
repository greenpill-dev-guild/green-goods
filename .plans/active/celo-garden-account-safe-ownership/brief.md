# Celo GardenAccount Safe Ownership

**Slug**: `celo-garden-account-safe-ownership`  
**Stage**: `active`  
**Priority**: `p1`  
**Created**: `2026-08-14`  
**Linear Issue**: [PRD-821](https://linear.app/greenpill-dev-guild/issue/PRD-821/give-each-celo-garden-safe-its-exact-arbitrum-gardenaccount-owner)  
**Linear Project**: `Commitment Pooling`  
**Linear Source**: `source:plans`

## Problem

The Arbitrum GardenAccounts can be derived at the same addresses on Celo, but those addresses have
no code on Celo today. The reviewed Arbitrum GardenAccount implementation and its immutable
dependencies are also absent at their Arbitrum addresses on Celo, and the foreign token tuple has
no local NFT owner. The current PR #705 bootstrap tooling therefore falls back to temporary
deployment-EOA ownership rather than actual Garden control.

## Desired Outcome

Each participating Garden has the exact same ERC-6551 GardenAccount address on Arbitrum and Celo.
That account is usable on Celo through a dedicated, authenticated, Garden-bound relay and is one
owner of a directly deployed final Safe with exactly these three owners and threshold two:

1. the exact GardenAccount;
2. the protocol recovery Safe; and
3. the Dev Guild recovery Safe.

No deployment EOA is ever a Garden Safe owner. The two recovery Safes retain an independent
recovery path, and the relay alone cannot execute a Safe transaction or move value.

## Scope Notes

- **In scope**: exact CREATE2 and bytecode reconstruction, same-address dependency and account
  deployment tooling, atomic account creation and initialization, a dedicated cross-chain
  Garden-action relay, direct final Safe prediction/deployment/verification tooling, unit/fork/
  invariant tests, and release evidence generation.
- **Out of scope**: Safe/Zodiac role installation, Settlement executor reuse, settlement peer or
  allowance changes, G$ movement, canaries, application UI, and every production broadcast or
  authority mutation. Those remain separately reviewed and human-authorized.
- **Superseded path**: the 1-of-2 deployment-EOA bootstrap and later owner swap from PR #705 are
  not part of this plan. If the exact identity or relay gates fail, implementation stops and the
  custody decision returns to human review instead of silently restoring the EOA path.

## Success Signal

On pinned Arbitrum and Celo forks, all 18 reviewed Garden tuples produce the exact live Arbitrum
account address on Celo without bytecode injection, every account has the reviewed runtime and
initialization state, and a final 2-of-3 Safe proves both GardenAccount-plus-recovery execution and
two-recovery-Safe execution while every one-owner, replay, wrong-Garden, wrong-call, and expired
relay attempt fails.
