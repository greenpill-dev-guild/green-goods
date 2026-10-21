# Demo script: no-go local rehearsal version

**Default version.** Use when PRD-1197 records no-go or deferred, or whenever a live step lacks a
receipt. PRD-1197 had recorded no decision when read on 20 October, so this is the version to
prepare. First draft 2026-10-09; architecture and status updated 2026-10-20. Same cast and length
as the go version. Real Arbitrum and Celo records sit beside labeled local rehearsal of the voucher
steps, which run on local copies of Arbitrum and Gnosis. A fork receipt is never presented as a
live receipt.

## What this version claims

- Live today: the promise record, confirmation by the person served, evidence, and G$ support on
  Celo.
- Rehearsal: a promise that carries voucher terms agreed before acceptance; voucher delivery to the
  person who did the work once the promise is fulfilled; a supporter's purchase and a member's
  exchange, each through a bounded pool swap; presentment and discharge. These run on pinned local
  copies of Arbitrum and Gnosis: the new voucher module and adapter against Cosmo-Local's published
  contracts, whose deployed Gnosis code matched that build byte for byte on 20 October. The
  cross-chain message is simulated and labeled, and member actions on Gnosis use a labeled stand-in
  for the passkey validator that Gnosis lacks.
- Planned: the passport's Gnosis panel; the live pools; the fiat route; a real cross-chain voucher
  message (the lane quotes our message format both ways, but none has been sent).

## Before recording

| Precondition | Evidence to hold | Owner |
|---|---|---|
| Rehearsal passed | PRD-1096 run under the five rehearsal defaults Afo adopted on 20 October (claim ledger C67): earned issuance with replay and reused-entitlement rejection, purchases through the hub pool's bounded swap, budget and limit failures, exhausted inventory, delisting, delivery failure. It needs the voucher module and adapter, which did not exist on 20 October; if the run has not passed by recording day, show shots 4 to 7 as a labeled plan, not as rehearsal | PRD-1096 |
| Terms draft | COM-46 draft terms shown as draft | COM-46 |
| Consent | recording consent for each person on screen; otherwise use a team member playing the role and say so; hub photos already approved (Afo, 9 October) | COM-28 |
| Real records | at least one real kept promise on Arbitrum from the Tech and Sun pool and one acknowledged G$ support payment | PRD-731 receipts, COM-36 |
| Labels | a persistent on-screen label for every rehearsal shot: "Local rehearsal, not live" | pitch owner |

## Shot list

| # | Scene | On screen | Who acts | What it proves | Required evidence | Honest fallback |
|---|---|---|---|---|---|---|
| 1 | The hub | PWA hub home: next session, power and internet, a person to ask | member | the product starts with a service | staging screen recording | the approved hub photo with a static screenshot |
| 2 | A real kept promise | A real commitment from the Tech and Sun pool: provider, confirmer, evidence, confirmation path | member | confirmation by the person served, live | Arbitrum record link | if no consented real record exists, use a team member's own commitment and say so |
| 3 | Real support | The acknowledged G$ support for that promise | member | money followed a kept promise, live | Celo acknowledgment | show the queued state with its retry owner |
| 4 | Rehearsal: vouchers arrive | On the local copies: a promise whose voucher terms were fixed before acceptance is fulfilled, and its vouchers reach the address of the member who did the work; a supporter buys vouchers through the hub pool's bounded swap; a replayed message delivers nothing twice | member, supporter | once-only issuance within the hub's budget | fork receipts with block numbers and the "local rehearsal" label | narrate from the test log |
| 5 | Rehearsal: use a service | Presentment, delivery, confirmation, discharge; a second discharge attempt fails | member | exactly-once discharge | fork receipts | narrate |
| 6 | Rehearsal: one bounded swap | Quote, minimum output, deadline; then a stale quote rejected | member | bounded exchange and a safe failure | fork receipts | narrate |
| 7 | Rehearsal: a failure | A session the hub cannot deliver: remedy and outstanding balance | steward | repair is visible | fork receipts | narrate |
| 8 | The passport, split | Left: real Arbitrum and Celo figures with sources and freshness. Right: the Gnosis panel marked "rehearsal data" or "not yet live" | supporter | a reader can tell live from rehearsal at a glance | passport page | a mock page with the same labels |
| 9 | The decision | The 22 October decision record, in one sentence, and what a go would add | Afo | the no-go is a decision, not a failure | PRD-1197 record | n/a |

## Narration cues

- Name the boundary once, early: "What you see on the left happened. What you see on the right is a
  rehearsal of the next step."
- Never let a rehearsal shot run without its label.
- Keep the chain names in the appendix; say "the record", "the hub's voucher", "the supporter's view".

## Required evidence pack for the submission

- Links to the real records shown (Arbitrum, Celo) and the dated test receipt.
- The rehearsal log with block numbers, pinned implementation addresses and the list of simulated
  components, including the cross-chain message and the passkey validator stand-in.
- The 20 October conformance evidence: Cosmo-Local's deployed Gnosis contracts match the published
  build the rehearsal uses, and both routers quote our message format.
- The claim ledger, so a judge can see which claims are implemented, planned or scenario.

## Not allowed

Fabricated participant quotes, screenshots, transactions or footage. A fork receipt presented as
live. Cash-out. Multi-pool routing. A fiat donation shown as delivered.
