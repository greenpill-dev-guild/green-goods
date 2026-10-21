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

### PRD-796 (Done): one comment, description unchanged

> Superseded in part on 21 October by Afo's voucher direction (commitment-pooling Decision Log #69,
> register #163). For the Cosmo-Local integration, issuers a steward admits may issue against
> future capacity under caps that grow with kept promises, so points 3 and 6 of the frozen
> contract (fulfilled-first backing, one bounded pool before capacity backing) no longer set the
> order. Point 4's consent, exposure, default and repair questions are answered by the curated,
> capped rule; expiry, legal, audit, custody and authority still need their own decisions before
> live use. Points 1, 2, 5 and 7 stand. Source: the Cosmo-Local hub spec, "Voucher direction".

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
