# ENS L2 Sender Admin Recovery Spec

## Summary

Add a deliberate recovery surface to the Arbitrum `GreenGoodsENS` sender so it no longer acts as an irreversible gatekeeper for username state. The work should preserve first-time sponsored claims, add safe owner/admin recovery for user-name records, and keep L1 receiver state synchronized through the existing CCIP receiver path or a documented operator sequence.

## Users

- Primary: passkey users who need to change a username or recover after losing access to an old passkey account.
- Secondary: Green Goods operators who need repeatable ENS support tools and auditable recovery actions.

## Functional Requirements

1. The L2 sender must expose an owner-only/admin recovery path for gardener names that clears `ownerToSlug`, `slugOwner`, and `slugNameType`.
2. Recovery must not allow garden names to be accidentally released unless an explicit, separately reviewed garden recovery path is added.
3. Recovery must either send the L1 release message through CCIP or document a safe paired L1 admin action that keeps receiver state consistent.
4. Recovery actions must emit clear events with slug, previous owner, operator, and reason/reference data where possible.
5. A migration path must preserve current L2 sender state or intentionally rebuild it from historical events/L1 receiver records before rewiring production.
6. The client/admin support flow must distinguish same-passkey username change from lost-passkey username recovery.

## Research Evidence

- Existing pattern references:
  - `packages/contracts/src/registries/ENS.sol` currently supports user-funded `releaseName()` and source-level sponsored `releaseNameSponsored()`.
  - `packages/contracts/src/registries/ENSReceiver.sol` already has owner-only `adminReleaseName()` and `adminRegister()` on L1.
  - `packages/contracts/src/tokens/Garden.sol` has owner-only `setENSModule()` for rewiring the sender module.
- Source files, tests, or docs reviewed:
  - `packages/contracts/src/registries/ENS.sol`
  - `packages/contracts/src/registries/ENSReceiver.sol`
  - `packages/contracts/src/tokens/Garden.sol`
  - `packages/shared/src/hooks/ens/useENSReleaseName.ts`
- Evidence confirmed:
  - L1 receiver recovery exists.
  - Current L2 sender state blocks claims through `AlreadyHasName`.
  - Current L2 sender mappings are not enumerable onchain.
  - The deployed Arbitrum sender is a direct contract, not an upgradeable proxy.
- Open inferences or assumptions:
  - Production migration will need an event/indexer/L1-receiver manifest because L2 mappings cannot be enumerated directly.
  - Some lost-passkey exact-name recoveries may require policy review before operators reassign names.

## Human Judgment Points

- Decide whether operators can release user names unilaterally, or whether recovery requires an offchain user-support approval reference.
- Decide whether a recovery action should enforce cooldowns or bypass cooldowns for verified support cases.
- Decide whether exact-name recovery after passkey loss should be automatic, manual, or require additional identity proof.
- Decide whether sender v2 should be a direct contract with admin recovery or a proxy with explicit upgrade governance.

## Non-Functional Constraints

- Package boundaries: Solidity and deployment work stays in `packages/contracts`; shared/client/admin hooks consume typed contract surfaces from `@green-goods/shared`.
- Security: owner-only recovery functions must be narrowly scoped, evented, and tested against garden-name release and arbitrary takeover.
- Operations: scripts must be non-destructive by default and require broadcast flags for live writes.
- Localization: any user-facing request/recovery strings must be added to `en`, `es`, and `pt`.
- State consistency: L2 sender, L1 receiver, resolver records, and app reads must have a documented final authority and reconciliation path.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Contract recovery | `contracts` | Add sender v2 recovery functions, events, migration tests, and deploy/rewire runbook |
| Support state/API | `state_api` | Add request/recovery state helpers if the app/admin needs support flow tracking |
| UI | `ui` | Request/change copy and admin support surface if promoted with product flow |
| QA | `qa_pass_1`, `qa_pass_2` | Verify no broken passkey release path and no split-brain recovery state |

## Risks

- Risk: admin recovery can become an account-takeover vector.
  - Mitigation: owner-only, event every action, avoid direct reassignment without clear policy, and keep garden names protected.
- Risk: L1 and L2 can diverge during manual recovery.
  - Mitigation: define one recovery sequence and add verification scripts that check both chains.
- Risk: migration loses current names.
  - Mitigation: build a manifest from sender events and L1 receiver reads, then dry-run before broadcast.
