# Linear drafts for the voucher direction

**Drafted:** 2026-10-21 UTC, after Afo's five voucher-direction decisions, recorded in the
[spec](../spec.md#voucher-direction-decided-2026-10-21) and, through a patch for the planning
checkout, in commitment-pooling Decision Log #69 and register #163.
**Status:** approved by Afo and applied to Linear on 2026-10-21 between 04:49 and 04:51 UTC as
anchored patch edits: twelve description edits and four comments, sixteen records in all, including
the optional PRD-1096 comment. The texts below are the applied texts. Every record kept its state,
assignee, cycle, due date, estimate and milestone, confirmed by read-back at about 04:52 UTC.
**Read against:** the live text of PRD-1315, PRD-1317, PRD-1318, PRD-857, PRD-796, PRD-651,
COM-46, PRD-1297, PRD-1299, PRD-1322, PRD-1323 and PRD-1324, read on 2026-10-21 between 04:05 and
04:20 UTC. PRD-1320 and PRD-1321 were not re-read; their drafts add a bullet without replacing text.
**Writing rules applied:** plain prose, problem first, no bold spans inside Linear bodies (the
connector mangles them), no em dashes, US spelling. Repository links point at hub paths.

## 1. What changed and why

On 21 October Afo decided, after a research brief that compared the current plan with
voucher-native commitment pooling:

1. Promises run on vouchers. An Offer can accept vouchers and a Request can pay in them.
   Presenting vouchers opens a promise that ends in discharge. Pooling stays in Cosmo-Local pools,
   and kept promises can still earn vouchers.
2. Stewards may admit gardeners as voucher issuers, alongside hubs and Green Goods.
3. Presentment is a promise in the live design. The presenter becomes its counterparty and
   confirms by default. The PRD-1096 service desk is a fork-only stand-in.
4. The instrument is called "voucher" in user-facing copy, named with its issuer and unit.
5. Curated, capped issuance formally replaces the kept-promises-first order: steward admission
   with published terms, caps that grow with kept promises, pool acceptance limits, and a remedy
   and pause path. Earned vouchers remain a second source. Release gates are unchanged.

These drafts also carry the correction found on 20 October: PRD-1317 names the payer garden's
steward as the terms author, and it should be a steward of the pool's garden.

Two records keep their wording: PRD-1096, whose rehearsal scope Afo approved unchanged, and
PRD-1197, whose go/no-go is unaffected. An optional PRD-1096 comment is drafted at the end.

## 2. Per-record drafts

### PRD-1315 (Backlog): add a paragraph and edit the first Done-when bullet

Add after the first description paragraph:

> On 21 October Afo set the voucher direction. Promises run on vouchers: an Offer can accept
> vouchers, a Request can pay in them, and presenting vouchers opens a promise that ends in
> discharge, while pooling stays in Cosmo-Local pools. Stewards may admit gardeners as voucher
> issuers. Curated, capped issuance formally replaces the fulfilled-first order in PRD-796: an
> admitted issuer publishes terms, its outstanding vouchers stay under a cap that grows with kept
> promises, each pool keeps its own acceptance limit, and a failed delivery ends in a remedy. The
> PRD-651 release gates are unchanged.

Replace the first Done-when bullet with:

> * The remaining decisions are recorded: eligibility rule (any Fulfilled, or ordinary confirmation
>   only through attestation), issuer budget mechanism (allowance from the issuer's reserve is
>   proposed; writer role with cap is the alternative), allocation basis (recognition split or
>   single recipient), acknowledgment lane in v1, Gnosis member accounts, and Gnosis proxy admin
>   ownership. Purchased issuance and its PRD-796 framing were settled on 21 October. Voucher
>   presentment opens a Green Goods promise in the live design; PRD-1317 and PRD-1318 carry its
>   contract work.

Follow-up found in PR #1170 review on 21 October: the applied Done-when text above omits three
additional blockers already recorded in the [hub plan](../plan.todo.md#sequence-and-completion-evidence)
and [implementation boundary](../commitment-upgrade-plan.md). The original applied text is retained
as the historical record. After Afo's approval, the following additional Done-when bullet was
applied to PRD-1315 at 17:43:58 UTC and read back at 17:43:59 UTC. State, assignee, cycle, due date,
estimate and milestone were unchanged; the correction is also recorded in `status.json` history:

> * Before the implementation boundary freezes, record issuer-cap enforcement (a mint controller
>   or monitored issuer policy), the authenticated presentment handshake binding escrow to the
>   promise and counterparty, and exact approved-revision and counterparty-consent binding.

### PRD-1317 (Backlog): replace the first bullet and add one

Replace the first Done-when bullet with:

> * A steward of the pool's garden registers voucher terms (issuer, asset, units, allocation policy,
>   terms CID, season) only while the commitment is Offered or Requested. Terms can say what a kept
>   promise earns, which vouchers an Offer accepts, and what a Request pays in vouchers. The
>   issuer's steward approves earned issuance; a Request's voucher payment comes from the
>   requesting garden's own vouchers under its steward's approval. The entitlement id is derived
>   from chain, module, commitment and terms revision and is never supplied, and garden authority
>   alone cannot spend another garden's or issuer's vouchers.

Add after the second bullet:

> * Presentment opens a promise: a holder places vouchers in a Gnosis escrow tied to the promise
>   they take up on the issuer's Offer, and becomes that promise's counterparty and confirmer.
>   Keeping the promise sends a discharge command and a remedy sends a return command, each
>   consumed once. The promise lifecycle carries delivery evidence; no separate redemption
>   registry is created.

### PRD-1318 (Backlog): add two bullets

> * Admitted issuers include gardeners a steward has curated. Each issuer's outstanding vouchers
>   stay under a cap that grows with kept promises. Until the WebAuthn validator exists on Gnosis,
>   the garden's Safe issues within a gardener's cap and the gardener stays the named issuer.
> * Hold presented vouchers in an escrow keyed to the promise. Release them to the issuer on an
>   authenticated discharge command and back to the holder on a return command, exactly once.
>   Tests cover a second discharge, a return after discharge and an escrow for an unknown promise.

### PRD-857 (Todo): two sentence edits in the description

Replace "Tech and Sun and Green Goods issue vouchers redeemable for their own services." with:

> Tech and Sun and Green Goods issue vouchers redeemable for their own services, and stewards may
> admit gardeners as issuers under the same curated, capped rule.

Replace "The person served confirms delivery separately from issuance and exchange." with:

> Presenting vouchers opens a Green Goods promise, so the person served confirms delivery
> separately from issuance and exchange. On 21 October Afo set this direction: promises run on
> vouchers, and curated, capped issuance replaces the fulfilled-first order.

Follow-up found in review on 21 October: the first replacement kept the earlier word "redeemable",
which decision 4 retires for vouchers. After Afo's approval it was changed in Linear to "vouchers
usable for their own services" at 07:18 UTC and read back with every field unchanged.

### PRD-796 (Done): one comment, description unchanged

> Superseded in part on 21 October by Afo's voucher direction (commitment-pooling Decision Log #69,
> register #163). For the Cosmo-Local integration, issuers a steward admits may issue against
> future capacity under caps that grow with kept promises, so points 3 and 6 of the frozen
> contract (fulfilled-first backing, one bounded pool before capacity backing) no longer set the
> order. Point 4's consent, exposure, default and repair questions are answered by the curated,
> capped rule; expiry, legal, audit, custody and authority still need their own decisions before
> live use. Points 1, 2, 5 and 7 stand. Source: the Cosmo-Local hub spec, "Voucher direction".

Follow-up found in PR #1170 review on 21 October: the applied comment above also superseded
point 6, but the one-pool proof gate remains active. The original applied comment is retained as
history. Afo approved this corrective comment separately; it was added to Linear at
18:12:59 UTC and read back at 18:13:18 UTC on 21 October. Comment ID:
`13c5454a-85e9-42ac-a613-d5afaf38a3b9`. PRD-796 remains Done; its description and state history are
unchanged:

> Correction to the 21 October voucher-direction comment: Decision Log #69 supersedes the
> fulfilled-first issuance order only. PRD-796 point 6 remains active: one bounded pool must prove
> issuance, seed, exchange in/out, service use, liquidity, and repair before capacity-backed
> issuance or federation. Curated issuance does not itself close consent, exposure, default,
> expiry, repair, liquidity, legal, audit, custody, or authority decisions. The release gates remain
> unchanged. Source: PR #1170 and commitment-pooling Decision Log #69/register #163.

### PRD-651 (Backlog): one comment

> On 21 October Afo made the explicit scope decision this issue requires for capacity-backed
> issuance, for the Cosmo-Local integration: curated, capped issuance, meaning steward admission
> with published terms, caps that grow with kept promises, pool acceptance limits and a remedy and
> pause path. Inter-pool federation is not decided. The external audit, 3-of-5 Safe, 48-hour
> timelock, two-week testnet and tested rollback gates are unchanged.

### RESR-73 (In Progress): one comment

> Research brief, 21 October: Cosmo-Local's whitepaper v0.8 defines Offerings, presentment,
> fulfillment and discharge but no request or need, and says its contracts record no real-world
> fulfillment. Green Goods' promises fill both gaps. Afo chose to integrate rather than go
> voucher-native: promises run on vouchers, stewards may admit gardeners as issuers, presentment
> opens a promise, the instrument is called "voucher", and curated, capped issuance replaces the
> fulfilled-first order. Recorded in the hub spec under "Voucher direction".

### COM-46 (Todo): add one bullet

> * Gardener issuers, decided 21 October, without blocking the two pilot issuers' terms: record
>   what a steward checks before admitting a gardener, the published terms each gardener voucher
>   needs, how the first cap is set and grows with kept promises, and a legal review of issuer
>   duties for individuals in each pilot jurisdiction.

### PRD-1299 (In Progress): add one bullet

> * Apply the 21 October voucher direction: an Offer shows the vouchers it accepts, a Request shows
>   what it pays in vouchers and G$, presenting vouchers opens a promise, and a steward can admit a
>   gardener as an issuer. Copy calls the instrument "voucher", named with issuer and unit. Settle
>   the proposed verbs (earn, buy, swap, use), "voucher exchange" for a Cosmo-Local pool, Spanish
>   and Portuguese "vale", and "kept" for promises against "used" for vouchers. Keep "credit",
>   "token" and "points" off the instrument, and keep "Redeem" for vaults.

### PRD-1297 (Todo): one sentence edit and one bullet

Replace "A service voucher represents an issuer's service obligation; the interface must
distinguish it from a member's promise, a payment and the separate Commitment Credit lending
feature." with:

> A voucher represents its issuer's service obligation; the interface must distinguish it from the
> promise it pays for or earns, from G$, and from the separate Commitment Credit lending feature.

Add a Done-when bullet:

> * Offers that accept vouchers, Requests that pay in them, presentment that opens a promise, and
>   steward admission of gardener issuers follow PRD-1299's approved states.

### PRD-1324 and PRD-1323 (Backlog): add one bullet each

PRD-1324:

> * Also show voucher payment terms on a promise: which vouchers an Offer accepts and what a
>   Request pays, with issuer and unit.

PRD-1323:

> * Also show voucher payment terms and, for a gardener issuer, admission status and current cap.

### PRD-1322 (Backlog): add one bullet

> * Until the passkey validator exists on chain 100, gardener issuance runs through the garden's
>   Safe within the gardener's cap; the gardener stays the named issuer.

### PRD-1320 and PRD-1321 (Backlog): add one bullet each

PRD-1320:

> * Index voucher payment terms, presentment escrows, discharges and returns keyed to the promise,
>   and gardener issuer admissions and caps.

PRD-1321:

> * Expose readers for voucher payment terms, presentment escrow state and issuer caps.

### PRD-1096 (Todo): optional comment

> The 21 October voucher direction leaves this rehearsal's approved scope unchanged. Its service
> desk is a fork-only stand-in, because the live design opens a Green Goods promise at
> presentment. A curated gardener-voucher case is not in scope unless Afo adds it before dispatch.

## 3. How to apply, once approved

1. Apply in the order above, as anchored patch edits. Keep every state, assignee, cycle, due date,
   milestone and estimate unchanged; PRD-796 stays Done.
2. For replacements, match the quoted current text exactly. If it changed since 21 October,
   stop and redraft rather than overwrite.
3. Read each record back and confirm the mentions survived.
4. Record the read-back in this hub's `status.json` history.

## PR #1170: further boundary corrections applied after approval

The later review found child acceptance gaps and two additional open decisions. Afo approved each
record separately. The additions below were applied and read back; existing
content is preserved apart from Linear whitespace/native-issue-link normalization. State, assignee,
cycle, due date, estimate, milestone and state history are unchanged.

### PRD-1315: applied additional Done-when criteria

> * Before freezing the boundary, record voucher-accepting Offer funding (post-claim payer identity, payer authorization, reservation/escrow/debit, and failure/refund behavior) and gardener issuer identity (identifier, garden/Safe/token relationship, admission authority, and per-gardener cap isolation). Keep earned issuance separate from claimant-funded payment.

### PRD-1317: applied additional Done-when criteria

> * Bind counterparty consent to the exact approved voucher revision, amount/allocation policy and eligibility; a pending claim cannot silently adopt later terms. For voucher-accepting Offers, bind the selected claimant as payer and enforce the PRD-1315 funding authorization, reservation and failure/refund decision; issuer-reserve delivery cannot substitute for that payment. Bind each gardener's approved issuer identity to its garden, Safe, token and admission authority, with authorization and caps isolated per gardener.
>
> * Before assigning the presenter as promise counterparty, authenticate a replay-safe receipt binding presenter, promise, token, amount and escrow receipt, and prove that escrow exists on Gnosis. Reject missing or mismatched consent, replay, unknown escrow and mismatched receipt bindings.

### PRD-1318: applied additional Done-when criteria

> * Bind a distinct approved issuer identifier per gardener to its garden, controlling Safe, token and admission authority; two gardeners sharing a garden/Safe cannot share authorization or a cap by implication. Apply the PRD-1315 cap-enforcement decision to each identity.
>
> * Produce the authenticated, replay-safe escrow receipt for PRD-1317, binding presenter, promise, token and amount to the escrow before counterparty assignment. Reject replay, unknown escrow and mismatched bindings. For claimant-funded Offer payments, enforce the approved payer authorization, reservation/debit and failure/refund rules separately from issuer-reserve reward delivery.

Read-back receipts (21 October 2026 UTC):

* PRD-1315: applied 2026-10-21T19:22:06.270Z, read back 2026-10-21T19:22:29Z.
* PRD-1317: applied 2026-10-21T19:22:33.929Z, read back 2026-10-21T19:22:53Z.
* PRD-1318: applied 2026-10-21T19:22:56.570Z, read back 2026-10-21T19:22:57Z.

## PR #1170: partial-delivery criteria applied after approval

The later review found that the live commands did not carry partial-delivery quantities. Afo
approved each addition below, and both were applied and read back. Both issues remain Backlog;
state history, assignee, cycle, dates, estimate and milestone are unchanged. Existing description
content is preserved apart from Linear whitespace/native-issue-link normalization.

### PRD-1317

> * When COM-46 permits partial delivery, bind the presentment's confirmed delivered and refundable units into the authenticated discharge/return commands. The split must conserve the escrowed amount, and each leg must settle once across retries and reordered messages.

### PRD-1318

> * When COM-46 permits partial delivery, accept authenticated delivered and refundable quantities for one escrow and enforce delivered + refundable = presented units. Transfer delivered units to the issuer and refundable units to the holder exactly once across retries, replay and reordered commands; neither leg may consume or strand the other's balance.

Read-back receipts (21 October 2026 UTC):

* PRD-1317: applied 2026-10-21T19:57:59.818Z, read back 2026-10-21T19:58:00Z.
* PRD-1318: applied 2026-10-21T19:58:05.008Z, read back 2026-10-21T19:58:07Z.
