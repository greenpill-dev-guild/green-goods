# ENS L2 Sender Admin Recovery - Contracts Handoff

## Lane

- Owner: Claude
- Branch: `feature/ens-registrar-operator-recovery`
- Status: plan steps 2 and 3 (contract and carry-over) on a pull request for review; step 4 (deploy and rewire) not started

## Scope

- `packages/contracts/src/registries/ENSRegistrar.sol`: `GreenGoodsENSRegistrar`, the upgradeable (UUPS) replacement for the Arbitrum sender. It sends the CCIP payloads the L1 receiver already reads.
- `packages/contracts/src/interfaces/IGreenGoodsENSRegistrar.sol` (its types, errors and events) and `packages/contracts/src/lib/ENSSlug.sol` (the rule a name must meet).
- `packages/contracts/test/unit/GreenGoodsENSRegistrar.t.sol`, `packages/contracts/test/fork/CrossChainENSRegistrar.t.sol`, and the storage layout baseline `packages/contracts/storage-layouts/GreenGoodsENSRegistrar.json`.
- Not in this lane yet: a deploy and cutover command, the manifest tool for operators, and any app or admin screen.

## What the contract does

| Function | Who | Effect |
|---|---|---|
| `importNames`, `finishImport` | Owner | Carry the previous sender's names over without messaging L1, then end the import for good. Registrations and recovery are refused until it ends. |
| `registerGarden` | Garden token | Register a garden's name at mint. The minter pays; garden names are never released. |
| `adminReleaseName` | Owner | Release a member's name on both chains. Needs the holder the operator verified and a support reference. Refuses a garden name. |
| `adminAssignName` | Owner | Give a free name to a named account without the cooldown: the second step of returning a member's exact name. |
| `adminResendRegistration` | Owner | Send a name's registration to L1 again when L1 did not apply the first. |
| `adminRedirectRefund` | Owner | Deliver a refund its creditor cannot collect. The garden token cannot receive ETH. |

Member claims are deliberately absent. They arrive with the directory-vouched claim stacked on this branch (the name-reservation hub).

## Differences from the previous sender that callers will notice

- `claimName`, `claimNameSponsored`, `releaseName` and `releaseNameSponsored` are gone. A stale client calling them reverts.
- `CCIP_ROUTER()` and `ETHEREUM_CHAIN_SELECTOR()` are now `ccipRouter()` and `ethereumChainSelector()`; `slugReleasedAt` takes the name's hash, not the name.
- Four admin events gained indexed fields. Nothing indexes ENS events today.
- Unchanged: `registerGarden`, `available`, `ownerToSlug`, `slugOwner`, `slugNameType`, `getRegistrationFee`, `getReleaseFee`, `claimRefund`, and the two message events.

## TDD Proof

- RED: not recorded
- GREEN: see the receipt below
- Proof limit: the registrar was written before its tests. Fallback proof is the unit suite and the live-state fork run at the tested commit. An independent review then added behaviour (no live use during the import, the resend path, the refund redirect, a bounded cooldown, refusing a missing receiver, refusing to renounce ownership), each with its own test.

## Validation

- Unit: carry-over, authority, garden protection, stale-owner and missing-reference refusals, fees and refunds, slug boundaries, cooldown, initialization, upgrade.
- Fork: [live-state cutover rehearsal](../reports/2026-11-21-live-state-fork.md).

## Validation Receipt

- Tested implementation commit SHA: `0da818436c215c4382c740e265daab5a9ddbd5b3`
- Run at (UTC): 2026-11-21T23:38:16Z
- Exact command(s), from `packages/contracts`:
  - `bun run test --suite solidity --profile match -- test/unit/GreenGoodsENSRegistrar.t.sol`
  - `ARBITRUM_FORK_RPC_URL=https://arbitrum.gateway.tenderly.co ENS_REGISTRAR_ARBITRUM_FORK_BLOCK_NUMBER=526331210 ETHEREUM_FORK_RPC_URL=https://mainnet.gateway.tenderly.co ENS_REGISTRAR_ETHEREUM_FORK_BLOCK_NUMBER=26465945 bun run test --suite solidity --profile match -- test/fork/CrossChainENSRegistrar.t.sol`
  - the same fork command with no RPC set
  - `bash script/check-storage-layout.sh --contract GreenGoodsENSRegistrar`
- Result: unit 24 passed, 0 failed. Fork 1 passed, 0 failed, 0 skipped. With no RPC: 0 passed, 1 skipped. Storage layout matches its baseline.
- Validated paths: `packages/contracts/src/registries/ENSRegistrar.sol`, `packages/contracts/src/interfaces/IGreenGoodsENSRegistrar.sol`, `packages/contracts/src/lib/ENSSlug.sol`, `packages/contracts/test/unit/GreenGoodsENSRegistrar.t.sol`, `packages/contracts/test/fork/CrossChainENSRegistrar.t.sol`, `packages/contracts/storage-layouts/GreenGoodsENSRegistrar.json`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` printed nothing
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## The Karma candidate pin

Adding these three source files moved the pinned `KarmaGAPModule` production bytecode hash, because via-IR code generation depends on every source in the build. Following Afo's 21 November decision, commit `84fbbd0c5` re-binds `packages/contracts/config/karma-gap-module-pin.json` to the hash a from-scratch production build gives with the registrar present. Karma's sources and settings are unchanged, and the pin authorizes no Karma upgrade. The hash is valid only for this exact set of sources: after a rebase that changes them, rebuild and re-bind. With the pin re-bound, the four release test files pass (61 tests).

## Risks / Blockers

- The cutover order in `plan.todo.md` is a written sequence, not a command. Step 4 needs a deploy and cutover operation in the contracts CLI, simulated first, before anything is broadcast.
- The previous sender cannot be paused. The sequence freezes it by owner calls first; a claim that slips in before the freeze would be missed by the manifest, which is why the manifest is reconciled against L1 as well.
- L1 skips a registration it cannot apply and reports nothing back. The operator checks L1 before assigning a name, and `adminResendRegistration` repairs a miss.
- The fork rehearsal is a manual run (see `MANUAL_FORK_FILES` in `packages/contracts/script/utils/fork-shards.mjs`): it needs archive RPCs on both chains that answer one wide log query.
