# Family Garden voucher pilot preparation

Status: draft preparation; service terms, capacity and issuer controls remain open.
Prepared 4 November 2026 Pacific. This handoff adds no runtime configuration or release approval.

Prepare one bounded collective-issuer pilot for Aiyeloja Family Garden using the existing
Arbitrum–Gnosis voucher infrastructure. Keep the existing work/review reward route separate.
Do not reuse another issuer's service terms, approved capacity, funding authorization or signatures.
Private account observations and signing evidence stay outside this public handoff.

## Inputs needed before a signing packet

| Input | Required decision or evidence |
| --- | --- |
| Redeemable service | Define the deliverable, unit, voucher price, location or delivery method, booking window and exclusions. Awaiting the garden's choice. |
| Deliverable capacity | Confirm actual available service units after existing obligations; record an accountable approval. Issuance, reserve, allowance and any pool inventory are separate quantities. |
| Terms and remedies | Approve the exact service/remedy revision, cancellation and partial/non-delivery outcome. A returned voucher does not restore consumed capacity or promise cash. |
| Collective control | Identify the Gnosis reserve/controller, token owner, upgrade administrator and any bootstrap/recovery powers. Preserve existing Safes and their policies. |
| Source authority | Identify the separate Arbitrum reward issuer authority and verify who can approve its terms. Garden stewardship alone does not grant this authority. |
| New expenditure | Approve the exact deployment/funding budget, source, recipient and chain for this pilot. Prior Tech and Sun funding approval does not cover it. |

Use the user's earlier preference for one approval until stewards explicitly change it as a
requirement to resolve before choosing a new controller. It does not authorize changing an
existing Safe. The current receiver template locks a target of two: one eligible steward signs
alone, and two or more require two. That template cannot satisfy a manually chosen threshold
without a separately reviewed policy change. Do not deploy it under the assumption that it can.

## Reuse and missing coverage

Source inspection is pinned to develop commit
`8b09ebdd5d770399c3d376b845e9a4b2e3c959ee`. The shared local checkout is older;
implementation must start from a current isolated checkout with permission.

- Reuse the deployed reward source module, Gnosis adapter, service source/escrow and shared
  exchange pool, subject to fresh dependency/authority reads. The adapter uses issuer/token
  authorizations and finite reserve allowances. No new CommitmentPooling upgrade is selected.
- The closest collective deployment implementation is
  [`clc-release.ts`](https://github.com/greenpill-dev-guild/green-goods/blob/8b09ebdd5d770399c3d376b845e9a4b2e3c959ee/packages/contracts/script/utils/clc-release.ts).
  Its issuer keys are `greenGoods | techAndSun`. Extend its owning release preparation to adopt
  existing infrastructure and add the approved collective asset; never rerun the two-issuer
  deployment to recreate the pool. The individual-member extension is a different custody model.
- The closest controller implementation is
  [`StewardSafeReceiver.sol`](https://github.com/greenpill-dev-guild/green-goods/blob/8b09ebdd5d770399c3d376b845e9a4b2e3c959ee/packages/contracts/src/accounts/StewardSafeReceiver.sol).
  It mirrors one garden's Hats roster with a locked `(0,1,2)` gate when paired with a
  [per-garden publisher](../../../../packages/contracts/src/accounts/StewardRolePublisher.sol)
  and registered Hats observer. Roster synchronization, spending threshold and separate
  issuer authority must all be reviewed before reuse.
- Shared owns reviewed issuer metadata and service eligibility. The current
  [`service-access-live-config.ts`](https://github.com/greenpill-dev-guild/green-goods/blob/8b09ebdd5d770399c3d376b845e9a4b2e3c959ee/packages/shared/src/modules/commitment-pooling/service-access-live-config.ts)
  lists only Green Goods and Tech and Sun assets/buyer gardens;
  [`service-issuer-live-config.ts`](https://github.com/greenpill-dev-guild/green-goods/blob/8b09ebdd5d770399c3d376b845e9a4b2e3c959ee/packages/shared/src/modules/commitment-pooling/service-issuer-live-config.ts)
  lists only the Green Goods issuer asset. A new Family asset needs reviewed deployment pins,
  terms/capacity metadata and garden admission in the existing configuration paths.
- Collective issuer operations use the Safe workflow. Do not relabel the collective as an
  individual to pass `prepareIssuerCall`, or infer reserve signing power from a connected steward.

## Bounded implementation sequence

1. **Complete the intake.** Record the inputs above privately and publish only approved service
   terms. Prepare a dependency/authority inventory with exact calls, costs and approval roles.
   Output remains non-executable while any required input is unresolved.
2. **Prepare the collective release extension.** Limit the first slice to the owning planner,
   its validator and focused behavioral tests. Adopt existing deployment receipts; reject
   unresolved controls, cross-issuer addresses, unconfirmed capacity and replacement pool plans.
   Add a distinct controller-policy slice only if the selected controller requires one.
   If selecting the roster controller, pin the paired Arbitrum publisher and Gnosis receiver for
   this garden. Include Hats-owner `setStewardObserver` registration, approved transport funding,
   and initial dispatches for the eligible stewards. If a configured bootstrap signer is
   ineligible on Arbitrum and has no prior dispatch, `syncSteward` will leave its status queued.
   Include `quoteSteward(bootstrapSigner)` and caller-funded `dispatchSteward(bootstrapSigner)`
   with the current quoted fee in the signing packet. Verify the observer and both peers, then
   match each dispatch to the receiver's applied revision and signer eligibility. Before relying
   on roster control, confirm any configured bootstrap signer has an applied nonzero revision
   and its eligibility matches the source, including an ineligible readback for the case above.
   Rehearse a grant, revocation and deferred dispatch recovery. Reconcile already dispatched
   messages before retrying and verify the selected threshold separately.
3. **Prepare source authority and catalog integration.** In the proposed Arbitrum signing packet,
   record the source module's pause state and who can act. For an active module, schedule an approved
   pause window and order the calls as `pause`, owner `setIssuerAuthority`, then owner `unpause`.
   Read back the pause, the Family issuer/token authority mapping and restored service. If a later
   call fails, reconcile receipts and current state before retrying. Keep the module paused while
   the mapping is unverified and use the separately approved owner recovery sequence. Preserve an
   existing pause unless resuming service is separately approved. Add the actual asset/garden pins
   and approved terms through existing Shared configuration. Have the Gnosis Family issuer Safe
   call the adapter's `configureAsset(token, issuerAuthority, true)`. Before any earned-voucher
   dispatch, read back `assetAuthorizations[issuer][token]` and verify it is enabled for the
   authority approved on Arbitrum. Prove issuer ownership, finite allowance and Safe routing.

   Budget native CCIP fees for each expected command and acknowledgment, then obtain exact
   quotes once the corresponding payloads exist. Before every setup send, refresh
   `quoteSetupCommand(setupId, kind)` and pass that exact value from the caller to
   `dispatchSetupCommand`: kind 0 for Authorization and kind 1 for Activate or Abort. Record
   each message ID and verify the exact authorization or decision on Gnosis. If CCIP reports a
   terminal delivery failure and the destination has not applied the command, verify the source
   state still calls for the same command. Refresh the quote, redispatch that setup ID and kind,
   and record the replacement message ID. Wait for a message still in flight and check the
   destination state before any retry.

   Read the native balances of the Arbitrum entitlement module and Gnosis adapter. Check that
   the entitlement module's `feeReserveMinimum` is positive and that the dispatch can pay its
   quote while retaining that floor. Prepare separately approved top-ups for
   any shortfall where a send draws on an endpoint balance, including the Gnosis adapter's
   earned-voucher acknowledgment. Verify top-up receipts and balances and refresh the quotes.
   A positive-fee escrow acknowledgment is caller-funded. Budget for the caller to supply the
   exact current quote to `retrySetupAcknowledgment` or `retryFinalAcknowledgment` if the
   automatic send fails. An escrow top-up does not fund those retries. Record the latest result
   sequence and outbound message ID, then verify the matching result was applied on Arbitrum.
4. **Prepare the on-chain service offer.** Before presenting an executable packet, document and
   rehearse a Family-specific publication path. Have the authorized pool actors create the
   commitment in the selected Family provider pool and prepare `setServiceOfferTerms` for that
   commitment ID and the approved Family issuer, token, quantities, and service and remedy terms.
   The [Green Goods offer runbook](green-goods-offer-publishing-runbook.md) illustrates the
   two-step flow. Its batch script, commitments and GGV preflight apply only to those offers.
   Verify the Family commitment is Offered, Individual and approval-gated, and read back the nonzero
   terms revision and hash, approved Family issuer/token, and service terms before attempting a
   booking. Verify the named buyer is distinct from the commitment creator and is a member of
   the selected on-chain registered buyer garden. Record the voucher holder separately when
   that is a different account. Shared catalog configuration and on-chain offer publication are
   separate steps.
5. **Rehearse, then present a human signing packet.** Obtain the selected local/fork checks,
   show each unsigned operation and expected readback, and obtain explicit activation approval.
   Each slice needs its own current-source proof; this handoff supplies none of that runtime proof.

Before active implementation, run the owning hub's `linear-sync` start gate and preserve its
existing mirror mode and issue states. This preparation does not reopen closed work or advance
implementation lanes. A general self-service issuer wizard is outside this pilot's scope.

## Live acceptance after onboarding

Prefer direct earning and redemption for the first bounded test. Pool trading is a separate
optional phase with its own admission, quote, fee, cap and inventory approval. The distribution
contract does not require pool admission; prove that an unlisted asset remains usable through
the selected application path before relying on this narrower pilot.

Use a current, explicitly selected work request or cycle. Have the authorized pool steward call
`registerTerms` on the entitlement module. Read back the revision, terms hash, approved issuer
authority and matching core binding. Obtain issuer approval for that exact revision, then have
the creator consent to freeze it. Verify an eligible counterparty and any separate claim requester
are distinct from the creator. Have the actual counterparty consent to the same frozen revision.
Read back both accounts' consent revisions before the claim operation that accepts the commitment.
For an approval-gated claim, verify the pending claimant and later steward acceptance. For an open
claim, verify both consents before the claim accepts it. Complete work and review, then verify
the accepted voucher binding and Fulfilled commitment. Preserve these separate observations:

1. Have an authorized pool steward call `prepareDistribution` with the approved recognition
   entries and validated recognition hash. Verify the prepared entitlement ID, payload hash,
   accepted terms revision, recipient allocations and total. If the Family reserve is short,
   include the approved Gnosis issuance or replenishment operation in the signing packet and
   verify its receipt. Before dispatch, confirm the issuer's token balance and finite adapter
   allowance both cover the full transfer total. This also covers an issuer self-allocation
   after earlier transfers have reduced the balance. Use the net reserve debit for the
   post-execution reconciliation. Dispatch and record the source transaction and message ID.
   If CCIP reports a terminal delivery failure and the Gnosis adapter has no record of the
   command, refresh the source quote and
   reserve checks. Have an authorized pool steward call `dispatch` for the same prepared
   entitlement and record the replacement message ID. Reconcile the original message first and
   leave any message still in flight to complete.
2. Verify destination execution succeeded with exact recipient credit and reserve/allowance debit.
   If execution failed, reconcile the recorded entitlement, payload and result first. Repair the
   verified cause, such as a short reserve, consumed allowance or pause, then call the adapter's
   `retry(entitlementId)` and verify the next result sequence and exact credit. Duplicate CCIP
   delivery does not retry a recorded entitlement's transfer.
3. Reconcile the matching result on the source. After an execution retry or an unsent
   acknowledgment, use the adapter's `quoteAcknowledgment` and caller-funded
   `retryAcknowledgment` with the exact current fee for that result. Record the acknowledgment
   sequence and message ID and verify Arbitrum applied the successful result. Track a message
   already in flight before considering any retry.
4. Verify the published offer, terms revision and buyer eligibility, then have the named buyer
   request the claim. Select an approved source-chain acceptance window that allows for setup,
   deposit and acknowledgment. Have the named buyer call `prepareVoucherSetup` with the
   commitment ID, expected terms revision and hash, pending claim hash, request nonce, and
   approved `acceptanceDeadline`. Read back the resulting setup ID, bound buyer, exact claim,
   authorization hash and deadline before dispatching that authorization. On Gnosis, verify the
   matching setup ID and authorization hash are recorded in the Authorized phase before presenting
   the issuer Safe's `approveSetupAuthorization` call. Read back issuer approval before deposit.
   Verify the named holder's balance of the exact voucher token and trace the units to the earned
   credit or a separately approved transfer. If a transfer is needed, verify its
   receipt and the holder's balance before booking funds are committed. Have that holder approve
   only the required voucher units for the escrow, verify the finite allowance, then call
   `presentSetup`. If `getSetupResult` records a failed Deposit, inspect the stored failure,
   repair the verified cause and call `retrySetupAction(setupId)`. Confirm `actionSucceeded`
   and the Deposited phase, then verify the exact escrow credit and allowance consumed against
   the token's state. Reconcile the successful result's acknowledgment
   and matching deposit receipt on Arbitrum. Before the authorized provider-pool steward calls
   `acceptServiceClaim`, verify the deadline against the current Arbitrum block timestamp and the
   absence of an Abort decision. Read back acceptance for the same buyer, claim and setup, then
   run `finalizeActivation`, dispatch Activate and verify it was applied on Gnosis.
   If approved terms allow cancellation before acceptance, the buyer can call `abortSetup`
   on Arbitrum for the exact setup ID and authorization hash. A separate holder can request
   cancellation on Gnosis using `requestSetupAbort` with the exact current
   `quoteSetupAbortRequest` fee. Track that request's message ID and confirm the authenticated
   request selected Abort on Arbitrum. If the original request reaches a terminal delivery
   failure, verify that both setups remain undecided and Arbitrum has no acceptance receipt.
   Have the same holder refresh the quote, resend the same request and record the replacement
   message ID. Wait for an in-flight request. An existing acceptance receipt takes precedence.
   If the deadline passes without acceptance, verify there is no receipt for the exact claim
   before calling source `abortSetup`. For either cancellation or expiry, verify the source
   selected Abort, dispatch that decision, and verify any deposited vouchers return to the
   holder. If the refund fails, use `retrySetupAction` and reconcile the resulting acknowledgment.
   Abort leaves `setupOfClaim` bound to the original claim hash. An identical authorization can
   return the aborted setup ID, and a changed authorization for that claim reverts. If the buyer
   wants to rebook after the refund is reconciled, withdraw the old claim with
   `withdrawServiceClaim` if it is still pending. Request a new claim with the next nonce and
   verify the new claim hash before preparing its setup.
5. Record delivery and the holder's separate approval of the delivered service units and proposed
   release/refund split. For any nonzero refund, have the issuer Safe use `authorizeReturn` and read
   back a cumulative return ceiling that covers the proposed refund before the holder freezes
   the split. Verify `finalizeAllocation` froze that split under the agreed terms and record its
   decision ID. Include `executeFinalLeg(setupId, decisionId, leg)` for each nonzero leg:
   `ReleaseToIssuer` and `RefundToHolder` as applicable. Read back each leg's status. For a failed
   leg, reconcile its recorded failure, repair the verified cause and retry that same leg for
   the same decision. Verify every required leg succeeded and `isFinanciallyClosed` is true.
   Verify the final acknowledgment reaches the source, using the quoted caller-funded retry
   if needed.
6. Complete the service commitment on Arbitrum. While it is Accepted, have an eligible actor
   call `attachEvidence` with the delivery evidence CID and credited active contributors. Attach
   any required assessment before freezing the roster. For an eligible service without work
   requirements, have the creator, counterparty, lead provider or pool steward call
   `submitForConfirmation` and verify ReadyForConfirmation. If the approved pilot uses a
   steward override, record the reason in `markReadyForConfirmation` and verify the same
   state. Have eligible non-contributors call `confirmFulfillment` until the configured
   threshold is reached. Read back Fulfilled and the recorded confirmation path separately
   from holder approval and financial closure.

Use the [voucher reconciliation handoff](codex-voucher-reconciliation.md) for protocol details
and recovery cases when preparing the exact signing packet.

Label authenticated Brave proof separately from local/fork proof. Check pending state, reopening
the page, refresh, destination failure and safe recovery. Never resend an in-flight message.
Record source/destination block timestamps, actual execution receipts, observation times and
acknowledgment time privately. Report measured chain-to-chain and observed durations separately;
no fixed arrival-time promise follows from a source receipt.

## Preparation evidence and limits

This is a source-backed preparation artifact. No application or contract code changed, no calls
were signed or broadcast, and no issuer was activated. Current authority observations, account
identities and the intake packet remain private. Browser proof for this artifact: none; earlier
authenticated Brave observations do not certify the proposed voucher flow.

Preparation checks at 2026-11-05T04:49:36Z: `node scripts/harness/plan-hub.mjs validate`
validated 32 hubs; path-scoped `git diff --check` passed. A local read-only check resolved all
four pinned source links through Git objects, verified the handoff index, scanned this handoff
for account/signing identifiers and confirmed the private packet has no transactions or execution
approval. These are working-tree documentation checks, not a commit-attributed runtime receipt.
Runtime tests were not run because no runtime behavior changed.

Task record: Family Garden voucher pilot | Type: investigation/preparation | Outcome: partial
Agent/model: Codex / model unknown | Coverage: continuation beginning 2026-11-05T04:45:02Z

| Phase | Start → end (UTC) | Result |
| --- | --- | --- |
| Investigate | 2026-11-05T04:45:02Z → 2026-11-05T04:47:16Z | Reconciled current source, control policy and catalog/deployment gaps. Earlier live inspection timing is outside this segment. |
| Implement | 2026-11-05T04:47:16Z → 2026-11-05T04:49:12Z | Preparation documentation and private draft only; runtime implementation omitted. |
| Verify | 2026-11-05T04:49:12Z → 2026-11-05T04:49:36Z | Preparation checks above passed; no live activation proof. |
| Wait | 2026-11-05T04:49:36Z → ongoing | Service definition and actual capacity await a human decision; controls and budget remain unresolved. |

Human corrections: 0 in this segment; attention: unknown.
