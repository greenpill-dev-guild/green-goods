# Voucher booking: protocol changes to remove the waits (scoping, RESR-119)

Date: 2026-11-19. Read-only study of the repository at develop `ca583613d`; no chain reads.
Context: the app-side booking build in `.plans/active/voucher-booking-experience/` (PRD-1574)
brings a hub day down to three member moments with no contract change. This note scopes the
three protocol changes chosen for the next release, for the maintainer to rule on.

## Summary

A standing issuer approval per offer is the cheapest of the three changes: it touches only the
Gnosis escrow, needs no new message or wire format, and removes the per-booking Safe signing round
the member waits on. Deposit with the request is safe only after that change, and only if the
source chain keeps deciding refunds, because a refund on a Gnosis timer could return vouchers for a
booking the source has already accepted. Close by default reverses the most recorded controls,
probably needs a new wire version and a core change, and still cannot close the core promise
without the member, so it comes last.

**Baseline, read from code (hub day, full visit).** Three cross-chain messages are required:

1. The authorization (`dispatchSetupCommand` kind 0, Arbitrum to Gnosis).
2. The deposit acknowledgment (Gnosis to Arbitrum). A caller has to pay for it through
   `retrySetupAcknowledgment`, because the automatic send refuses any nonzero fee
   (`packages/contracts/src/modules/VoucherRedemptionReceiver.sol` line 222).
3. The start (kind 1).

None of the three changes removes a required message. What they save is acts and waiting time.

## 1. Standing approval per offer

**What the contracts enforce today.** `approveSetupAuthorization`
(`packages/contracts/src/modules/GnosisVoucherEscrow.sol` 129-139) is issuer-only, applies to one
booking, and re-checks that the issuer owns the token. `presentSetup` goes through `_holderSetup`
(336-340), which reverts until `issuerApproved` is set. The same flag is checked again in three
places:

- at activation (`VoucherRedemptionReceiver.sol` 172-177);
- by the source before core acceptance (`VoucherRedemptionModule.sol` 185);
- by the source's result check, which rejects any deposit reported without it
  (`packages/contracts/src/lib/VoucherService/VoucherServiceResultLib.sol` 28-34).

**Why.** The issuer address is copied from offer terms that the steward writes
(`VoucherServiceConsentLib.sol` 42; `setTerms` is steward-only in
`packages/contracts/src/lib/CommitmentPooling/ServiceOffersLib.sol` 30). That makes the Gnosis
approval the issuer's only onchain consent to each booking. Claim C100 rules out "standing
approval", and `pilot-issuer-terms.md` 265 has the issuer confirm each booking.

**Smallest change (inference, Gnosis only).**

- Append to the escrow's ERC-7201 `State`
  (`packages/contracts/src/libraries/VoucherServiceEscrowStorage.sol`) a map from an
  offer-template hash to {capacity, used, per-buyer limit, expiry, revoked}, plus per-buyer
  counters.
- The template hashes the fields that define the service and leaves out the booking: source
  module, core, provider garden, issuer, token, voucher units, service units, unit label, terms and
  remedy refs, remedy policy. Each hub day is its own commitment with its own terms revision, so
  the template, not the commitment, is the "offer".
- Add issuer-only `setStandingApproval` and `revokeStandingApproval`, with events.
- In `presentSetup`, match a live approval that has room left. Set `issuerApproved` and take
  capacity in the same transaction as the deposit. Give capacity back only in the abort-refund
  branch (`executeSetupAction` 191-198).
- Key the per-person limit on `buyer` (a Hats-checked garden member), not on `holder`, which the
  buyer can choose freely.

`issuerApproved` still comes before any deposit, so the source module, its libraries, the codec and
the core need no change.

**Safety.** Custody, refunds and double-spend protection are unchanged. Capacity gets stronger:
today it is "a client/operator policy" (`spec.md` 610), and this would give it an onchain ceiling.

**What it saves.** One issuer Safe round per booking (two of five signatures for Green Goods) and
the member's wait for it. No messages.

**App and Hub.** The App drops the wait between Book and Deposit. The Hub's per-booking Approve act
and its Safe file (`approveBooking` in `packages/shared/src/hooks/admin-ui/pool/useVoucherConsole.ts`)
become a per-offer approval with a used and remaining readout. The indexer needs the new events.

**Main risk.** Whoever publishes matching terms (the pool steward) can use up the issuer's capacity
without the issuer seeing each booking. Calendar fit then rests only on the steward's per-booking
`acceptServiceClaim`.

**Size.** The escrow had 437 bytes of EIP-170 headroom when last recorded
(`.plans/backlog/cosmo-local-credit-interop/handoffs/codex-voucher-reconciliation.md` 52-53). The
new logic would have to go in a linked library, which means a new Gnosis deployment.

## 2. Deposit with the request

**What the contracts enforce today.** The holder sends the deposit after issuer approval, with an
exact allowance (unlimited allowances are rejected,
`packages/contracts/src/libraries/VoucherRedemptionTransfers.sol` 30). Refunds before acceptance
only follow a source decision:

- `abortSetup` (`VoucherRedemptionModule.sol` 197-206) lets the buyer abort at any time. Anyone can
  abort after the deadline, or once the claim is no longer pending, so a steward's decline
  qualifies.
- A kind-1 dispatch carries the abort to Gnosis.
- Gnosis refunds automatically when that message arrives (`VoucherRedemptionReceiver.sol` 179-198).

**Why.** The code says "Gnosis never infers local expiry" (`VoucherRedemptionModule.sol` 197) and
"never refunds from a Gnosis timeout" (`GnosisVoucherEscrow.sol` 212). Core acceptance can land
right up to the deadline, and activation "wins even after deadline" (193).

**Smallest change (inference; needs change 1).**

- The member grants the exact allowance on Gnosis when they book.
- When the kind-0 authorization arrives, `_recordAuthorization` (`VoucherRedemptionReceiver.sol`
  135-152) tries the deposit through the existing retryable `_attemptSetup`.
- Optionally, merge prepare and dispatch into one payable source call, and abort and dispatch into
  another.
- "Automatic refund" then means someone with funds sends the abort: a keeper in `packages/agent`
  (nothing there sends these today), or the steward's Decline.
- Without change 1, a deposit cannot come before approval unless the source result check
  (`VoucherServiceResultLib.sol` 31) also changes.

**Safety.** Vouchers lock at booking, for up to the seven-day window
(`packages/client/src/views/Home/Garden/Commitment/serviceBooking.ts` 92) plus message time. The
source still decides refunds, so double-spend protection is unchanged. One gap: allowances for the
same token are shared across a holder's bookings, so one booking's intake can use another's
allowance. The other booking stays retryable and nothing is spent twice. Capacity is taken at
intake and given back on abort. The holder's explicit deposit act becomes an allowance.

**Rejected variants.**

- *Refund on a Gnosis timer.* This reverses `spec.md` 659 ("A timeout alone proves neither delivery
  nor non-delivery") and C100's "no timer completion". It also risks an accepted promise with
  nothing in escrow if the start message is delayed.
- *Deposit on Gnosis first.* This needs a core entry point that files a claim for someone else,
  because `requestClaim` treats `msg.sender` as the buyer and checks their membership
  (`ServiceOffersLib.sol` 73-74).

**What it saves.** The member's separate Deposit moment (allowance, `presentSetup`, often the paid
acknowledgment) and their cancel sends. No messages.

**App and Hub.** In the App, Book and Deposit become one moment, with one wallet prompt per chain.
The repo's `ICLCGiftableToken` declares no permit, and whether the deployed token supports one is
unverified. In the Hub, Decline sends the abort.

**Main risk.** Keeper funding and uptime, and longer locks for bookings that end up declined.

## 3. Close by default

**What the contracts enforce today.**

- Only the holder can fix the final split (`finalizeAllocation` via `_holderSetup`,
  `GnosisVoucherEscrow.sol` 257-283).
- Any refund needs the issuer's `authorizeReturn` ceiling (236-254, enforced at
  `packages/contracts/src/lib/VoucherService/VoucherFinalAllocationLib.sol` 38).
- Both chains accept only the `MUTUAL_CONSENT` remedy policy (`VoucherRedemptionReceiver.sol` 301;
  set in `VoucherServiceConsentLib.sol` 50).
- The Hub's Report Visit is a stub that throws (`useVoucherConsole.ts` 112-114).

**Why.** `spec.md` 656, 659 and 667 ("a timeout is not holder approval"), `pilot-issuer-terms.md`
271-272 ("issuer assertion alone cannot provide that approval"), and C100's "no timer completion".

**Smallest change (inference).**

- Add a second remedy policy value, bound into the authorization the member signs at prepare.
- Give that policy a fixed objection window.
- New Gnosis acts: issuer `reportFullDelivery`, holder `objectToReport` (which falls back to today's
  mutual path), and a permissionless `closeByDefault` that, once the window has passed, fixes
  release = all and refund = 0, then runs the release leg (`executeFinalLeg` is already
  permissionless, 285-314).
- Add a distinct event for this close, because `FinalAllocationFrozen` records the caller as
  `holder`.
- On the source, `VoucherServiceConsentLib` (a linked library deployed on Arbitrum) must set the
  new policy.
- Letting each offer choose the policy means a new field in the core's `ServiceOfferTermsInput`,
  which changes the terms hash and requires a core library redeploy and upgrade.
- Codec version bump on both endpoints (likely).

**The core promise stays open.** For an individual offer the member is the only ordinary
confirmer, and the fallback is blocked while the member can still confirm
(`packages/contracts/src/lib/CommitmentPooling/CreditLib.sol` 144-154 and 206-230). "Confirm It Was
Kept" therefore stays a member act unless the core changes, which would brush against `spec.md` 559.

**Safety.** Custody and double-spend protection are unchanged until the close. After that, a member
who stays silent gets nothing back. Capacity is unchanged.

**What it saves and adds.** The member's split approval and the transfer sends become optional. The
issuer gains one report per booking, a Safe round unless that power is delegated. No messages.

**Main risk.** A member who is away, has no Gnosis gas, or misses the notice loses vouchers for a
visit that didn't happen.

## Comparison

| Change | Acts removed per hub day | Messages removed | Contract surface | Recorded control reversed | Main risk |
|---|---|---|---|---|---|
| 1. Standing approval | Issuer Safe round, and the member's wait | 0 | Gnosis escrow, storage and a linked library | C100 "no standing approval"; pilot terms 265 | Steward-published terms use up issuer capacity unseen |
| 2. Deposit with request | Member's Deposit moment and cancel sends | 0 | Gnosis intake, optional source merges, keeper | Holder-sent deposit (code only) | Keeper funding; longer locks |
| 3. Close by default | Member split and transfer sends (core confirm stays) | 0 | Gnosis acts and events, source library, likely codec and core | C100 "no timer completion"; spec 656/659/667; pilot terms 271-272 | Silent member loses vouchers |

## Recommended build order (for the maintainer to rule on)

1. **Standing approval first.** It is Gnosis-only, changes no wire format, and removes the longest
   wait, a multi-signature round on every booking.
2. **Deposit with the request second, with the source still deciding refunds.** It depends on
   change 1 and needs no core or wire change, as long as the Gnosis timer refund is not built.
3. **Close by default last, or not for the pilot.** It reverses the most recorded controls, needs a
   core and probably a codec change, and leaves the core promise open anyway.

## Upgrade and deployment

- **Endpoints.** Both voucher endpoints are UUPS proxies
  (`packages/contracts/src/modules/VoucherEndpoint.sol` 14). An upgrade needs the owner, a scheduled
  implementation with an exact code hash, and the endpoint paused; the delay is zero (16, 125-133).
- **Pilot release.** `packages/contracts/deployments/42161-pilot-downstream.json` and
  `packages/contracts/deployments/100-pilot-downstream.json` (release
  `green-goods-tech-and-sun-voucher-pilot`, script
  `packages/contracts/script/deploy/pilot-downstream.ts`) list each proxy and its linked libraries.
  Both records show the endpoints still paused and owner activation pending.
- **Deployed code.** Git shows no change to these voucher sources since the recorded source commit,
  so the deployed code should match today's source. Not confirmed against the chain.
- **Timing.** Upgrading before activation avoids migrating live bookings.
- **Core.** The core is a separate UUPS proxy (`packages/contracts/deployments/42161-latest.json`)
  whose upgrades are owner-only (`packages/contracts/src/modules/CommitmentPooling.sol` 28).
