# Green Goods Name Reservation at Sign-Up - Contracts Handoff

## Lane

- Owner: Claude
- Branch: `feature/ens-member-names`, stacked on `feature/ens-registrar-operator-recovery` (the stack is approved, plan decision 18)
- Status: the on-chain half of the 21 November direction is on a pull request for review; the directory, sign-up and app halves are follow-up pull requests

## Scope

- `packages/contracts/src/registries/ENSMemberNames.sol`: `GreenGoodsENSMemberNames`, which extends the registrar from PRD-344 and is what its proxy is upgraded to. It adds `claimName`, the directory grant, the garden-member hat gate, one sponsored registration per account, and the daily limits and fee cap on registrations paid from the contract's balance. Its storage follows the registrar's own and its gap, with a baseline in `storage-layouts/GreenGoodsENSMemberNames.json`; the registrar itself is unchanged.
- `packages/contracts/src/interfaces/IGreenGoodsENSMemberNames.sol`: its types, errors and events.
- `packages/contracts/test/unit/GreenGoodsENSMemberNames.t.sol`, the member step in `packages/contracts/test/fork/CrossChainENSRegistrar.t.sol`, `packages/contracts/storage-layouts/GreenGoodsENSMemberNames.json` and its entry in `script/check-storage-layout.sh`.
- A sponsored garden mint the balance cannot pay for (daily limit, fee cap or empty reserve) has its name held on L2 and `GardenRegistrationDeferred` emitted; the owner sends it with `adminResendRegistration`.

## The contract's side of the rule "one member, one name, the directory's username"

| Rule | How the contract holds it |
|---|---|
| Only the directory's username | A grant names one account, one name and a deadline at most an hour away, and is signed by the directory's key for this chain and this contract. Any other name, account, signer, chain or contract, a lapsed grant, or a grant that runs longer than an hour is refused. |
| The member's own account submits | The grant is checked against the caller. Nobody can register a name for someone else. |
| Garden members only | The caller must wear the garden-member hat at the moment of the claim. |
| One name per account, one account per name | The registrar's existing rule; a second claim or a taken name is refused. |
| No different name later | No self-service release. A name changes only through the owner's release and assign. |
| Bounded sponsorship | One registration per account is paid from the balance. Members and garden mints each have an owner-set daily limit, and a fee cap bounds what one sponsored registration can cost. A member or minter may pay the fee instead. |
| Off until configured | No claim works until the owner sets the directory's signer and the hat, and nothing is sponsored until the owner sets the limits. Setting the signer to zero stops claims. |

## What the directory has to do (not built here)

- Hold one signing key for name grants, and sign `NameGrant(address account,string name,uint256 deadline)` under the domain `Green Goods Names`, version `1`, with the chain ID and the registrar's address. The contract's `nameGrantDigest` returns the exact digest.
- Sign only for the account its own record derives for that username, only when the username is a valid name, and with a short deadline. A grant is useless to anyone but that account, so the endpoint needs rate limiting, not authentication.

## One refinement of the 21 November decision, accepted

The decision was one daily limit shared by members and garden mints. An independent review showed that a shared count lets one group use up the other's (a run of new member accounts would leave garden mints without names that day, silently, since the garden token carries on when the registration fails), and that a count alone does not bound cost because the cross-chain fee follows L1 gas. The contract therefore keeps two daily limits and a per-registration fee cap. Setting both limits to the same number gives the decided behaviour apart from the sharing. Afo accepted this refinement on 21 November 2026 ("Two limits + fee cap").

## Review

An independent review of this layer (a fresh agent given the code, not my conclusions) found no critical or high issue. Fixed from it: separate limits and the fee cap above, a one-hour maximum grant lifetime with the cooldown never shorter than that, a test that upgrades a proxy from the earlier layout, and tests it found missing or over-claiming (a grant for another registrar, an unset hat, part payment, a paid first claim). Left open and recorded in `plan.todo.md`: a member account is not a person, so the directory and the hat are the only limits on many accounts; a permitted minter can take a member's username as a garden name and nobody can release it; a carried-over name can differ from its holder's username.

## TDD Proof

- RED: not recorded
- GREEN: see the receipt below
- Proof limit: the claim was written before its tests. Fallback proof is the unit suite and the live-state fork run at the tested commit.

## Validation Receipt

- Tested implementation commit SHA: `b9501ba36ef55bea943638a99fb9eb3f486c5587`
- Run at (UTC): 2026-11-23T06:21:13Z
- Exact command(s), from `packages/contracts`:
  - `bun run test --suite solidity --profile match -- test/unit/GreenGoodsENSMemberNames.t.sol`
  - `ARBITRUM_FORK_RPC_URL=https://arbitrum.gateway.tenderly.co ENS_REGISTRAR_ARBITRUM_FORK_BLOCK_NUMBER=526331210 ETHEREUM_FORK_RPC_URL=https://mainnet.gateway.tenderly.co ENS_REGISTRAR_ETHEREUM_FORK_BLOCK_NUMBER=26465945 bun run test --suite solidity --profile match -- test/fork/CrossChainENSRegistrar.t.sol`
  - `bash script/check-storage-layout.sh --contract GreenGoodsENSMemberNames`
- Result: unit 16 passed, 0 failed. Fork 1 passed, 0 failed, 0 skipped. Storage layout matches its baseline: the registrar's rows and gap are unchanged and this contract's storage starts at slot 151.
- Validated paths: `packages/contracts/src/registries/ENSMemberNames.sol`, `packages/contracts/src/interfaces/IGreenGoodsENSMemberNames.sol`, `packages/contracts/test/unit/GreenGoodsENSMemberNames.t.sol`, `packages/contracts/test/fork/CrossChainENSRegistrar.t.sol`, `packages/contracts/storage-layouts/GreenGoodsENSMemberNames.json`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` printed nothing
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- The directory's signing key is new key material on the agent. Its custody and rotation need a decision before any deployment; the owner can replace it on chain at any time.
- A member whose username is not a valid name, or is already taken, cannot register until the one-time rename (decision 15) exists.
- The two daily limits, the fee cap and the reserve's size are operating numbers for whoever funds the reserve; the contract's defaults are zero.
