# Fiat stretch decision note

**Question:** should the hackathon show a card-funded donor journey, and if so, what is the
smallest qualified version? **Owner records:** RESR-82 (provider qualification, Research),
PRD-1031 (pilot contract, Product), PRD-1038 (live pilot authority), PRD-1039 (endowment
follow-on). **The Garden Fiat Contributions project keeps ownership of every fiat decision; this
note only recommends.** First draft, 2026-10-09.

## Recommendation: clear defer for the pitch, with one conditional sandbox clip

Defer the fiat route from the demo. Show it as one labeled "next" slide. Allow one short
sandbox-labeled clip only if RESR-82 qualifies a provider and sandbox by 21 October and PRD-1031
fixes the contract by 24 October. No live payment, provider registration, recurring plan or spend
is authorized by this note or by the hackathon.

Why: RESR-82 is Todo with no provider verified; PRD-1031 is Backlog; the demo already carries
the credit rehearsal risk; and the diaspora story does not depend on card payment. The corridors
that matter are already cheap and familiar to the audience, so a fiat route adds convenience, not
the pitch's core claim.

## What a qualified donor journey must state

| Item | Required content | Status today |
|---|---|---|
| Provider and corridor | One donor market (UK or US), one payment method (card or bank), one provider with confirmed production access and pricing for this use case | open; candidates only, none provider-confirmed |
| Account, asset, recipient | Email-created account (Reown Starter plus Pimlico selected), exact chain and asset (Arbitrum, asset to confirm), exact garden recipient contract; whether the Cookie Jar is the donation destination | open (PRD-1031) |
| Fees | Provider fee, per-payment cost, any recurring platform charge, FX margin, who pays gas, all shown before payment | open |
| Verification | Donor KYC steps and thresholds; organization eligibility; what a first-time donor must provide | open |
| Refunds | Provider refund rules; what happens to a failed or duplicate payment; who owns support | open |
| Recovery | Email sign-in recovery on a fresh device; payment-to-donation reconciliation; stuck states with a named owner | open (PRD-1032, PRD-1034, PRD-1037) |
| Sponsorship budget | Numeric gas budget, cap enforcement, Pimlico production pay-as-you-go distinguished from a free tier | open (PRD-1033) |
| Evidence | A redacted end-to-end proof from sign-in to confirmed garden receipt and a recovery check | none |

## Decision rule by date

| Date | Rule |
|---|---|
| 16 October | If RESR-82 has no provider-confirmed row, fiat stays a slide. |
| 21 October | If a sandbox is qualified and PRD-1031's contract is recorded, prepare one labeled sandbox clip; otherwise no clip. |
| 24 October dry run | A sandbox clip appears only if it ran cleanly in the dry run with its label. |
| 27 October | Submission text says "a card route is being qualified" and nothing more. |

## Smallest qualified journey, if it qualifies

One donor in one market pays one small amount by card into a sandbox; an email-created account
receives the exact asset on Arbitrum; the garden's receipt is confirmed; the donor sees the
receipt; the recovery check passes on a second device. Every screen shows the fee. The clip is
labeled "sandbox" for its whole duration. Nothing moves real money.

## What this note does not do

It does not pick a provider, approve a budget, register an account, or schedule a live pilot. A
real-money pilot remains gated by PRD-1038. Endowment deposits by the same route remain PRD-1039
follow-on work.
