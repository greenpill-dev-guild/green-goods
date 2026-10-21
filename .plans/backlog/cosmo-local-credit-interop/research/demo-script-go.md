# Demo script: go-authorized live version

**Use only after PRD-1197 records a go** with every gate met or individually substituted, and
PRD-1100 authorizes the exact live release. Until then, record nothing from mainnet for this
version. First draft 2026-10-09; architecture and status updated 2026-10-20. Target length four to
five minutes inside the eight-to-ten-minute pitch. Two people on screen: a member and a supporter
from the Omo Yoruba of Southern California community. A steward appears once. No real names, faces
or quotes without separate consent (COM-28, MAR-35); the hub photos approved by Afo on 9 October
may be used.

**Status on 20 October.** PRD-1197 (due 22 October) records no decision yet. No voucher contract
code exists, none of our pools exists on Gnosis and none of the live gates is met (claim ledger C18
and C27), so every voucher step in this script is planned, not live. The second-pass architecture
review judged that no live Gnosis pilot can meet the 27 October submission under those gates.
Prepare the [no-go version](demo-script-no-go.md) for the pitch.

## What this version claims

- Live today: a promise kept and confirmed on Arbitrum; G$ support acknowledged on Celo.
- Planned, live only after a recorded go: the same promise carrying voucher terms agreed before
  acceptance; the hub's vouchers delivered on Gnosis within the budget the hub set; one bounded
  swap; one service presented, delivered and confirmed; the passport reading real receipts.
- Labeled: anything the live run could not produce in time (see fallback column).
- Never: cash-out, multi-pool routing, audited impact, a named supporter who has not agreed.

## Before recording

| Precondition | Evidence to hold | Owner |
|---|---|---|
| Go recorded | PRD-1197 decision naming build, pools, budgets, signers, upgrade authority and rollback, with every gate met or individually substituted: external audit, 3-of-5 Safe ownership, 48-hour timelock, two weeks of testnet operation, tested rollback | Afo |
| Voucher contracts | the new Arbitrum voucher module and Gnosis adapter written, tested and audited; neither existed on 20 October | PRD-1317, PRD-1318, PRD-1327 |
| Open decisions | the seven PRD-1315 decisions recorded, including the eligibility rule, the budget mechanism and member accounts on Gnosis | Afo, COM-46 |
| Member accounts on Gnosis | the passkey validator deployed on Gnosis, or a Safe-signed fallback chosen, before any member-signed shot (the validator was missing when read on 10 October) | PRD-1096 |
| Terms published | COM-46 terms version consumed by the deployment | steward, Afo |
| Consent | participation, public passport and recording consent recorded separately for each person on screen; hub photos already approved (Afo, 9 October) | COM-28 |
| Deployment readback | both pools, the adapter's allowance or writer role, budgets and emergency controls read back from Gnosis; the implementations rechecked against Cosmo-Local's published build at the deployment block | PRD-1100 |
| Fee reserve | message lane fee reserve funded; a failed send has a visible retry owner | PRD-1100 |
| Rehearsal receipts | PRD-1096 fork run with negative cases, kept as the fallback footage | PRD-1096 |

## Shot list

| # | Scene | On screen | Who acts | What it proves | Required evidence | Fallback if live fails |
|---|---|---|---|---|---|---|
| 1 | The hub | The hub home in the PWA: next session, power and internet status, a person to ask | member | the product starts with a useful service, not a chain | screen recording, consented photo of the hub if available | the approved hub photo with a staging screenshot, labeled |
| 2 | Take up a promise | The member accepts the Request to host the weekly climate discussion; the Request shows both rewards, G$ support and the hub's vouchers, fixed before acceptance | member | a promise with a named provider and confirmer, and both rewards agreed up front | Arbitrum transaction link in the appendix; the voucher terms recorded before acceptance | rehearsal recording, labeled |
| 3 | Confirm | A participant confirms the session happened; the record shows who confirmed and by which path | member (as participant) | confirmation by the person served, not the provider | confirmation record; path shown as direct or fallback | same |
| 4 | Support arrives | G$ support for the kept promise shows as acknowledged; the vouchers the promise carried arrive on their own path | member | money follows a kept promise through the live settlement path, and each reward completes on its own | Celo acknowledgment receipt; voucher delivery receipt on Gnosis | show the settlement state as pending with the retry owner; show a pending voucher delivery as pending, never as delivered |
| 5 | A supporter funds seats | The supporter buys a season pack of the hub's vouchers through the hub pool's bounded swap | supporter | a purchase settles in one bounded swap, with no separate entitlement to replay | swap receipt with the quote, minimum output and deadline | rehearsal footage with a "local rehearsal" banner |
| 6 | Use a service | A learner presents a voucher for a session; the hub delivers; the learner confirms; the obligation is discharged once | member | presentment, delivery, confirmation and discharge are separate | presentment id; discharge record; no second discharge possible | rehearsal footage, labeled |
| 7 | One bounded swap | The member swaps a small amount between the two vouchers with minimum output and deadline | member | exchange runs under the member's own account | swap receipt; the quote shown before execution | skip the swap and say so |
| 8 | The passport | The supporter opens the passport: seats bought, used, remaining; promises kept; outstanding obligations; freshness and source on each figure | supporter | a reader outside Green Goods can follow funding to delivery | passport page with live labels | passport built on Arbitrum records only, Gnosis panel labeled "not live" |
| 9 | What failed | One deliberate failure: a session the hub could not deliver, shown with its remedy and the outstanding balance | steward | failure is visible and repairable | the remedy record | narrate from the rehearsal negative case |

**Status of each shot on 20 October.** Shots 2 to 4 can use real Arbitrum and Celo records today,
except the voucher terms in shot 2 and the voucher delivery in shot 4. Those parts and shots 5 to 9
are planned until a go: they need the voucher contracts, and shots 6 and 7 also need member
accounts on Gnosis. Shot 5 shows purchases as the 20 October rehearsal default has them (claim
ledger C67); the live purchase route is still a PRD-1315 decision. Shot 1 shows the app as it ships
on recording day.

## Narration cues

- Open on the member, not on the architecture. Chain names appear only in the appendix.
- Say "confirmed by the person served" every time a confirmation appears.
- Say "within what the hub can deliver" every time vouchers are issued.
- Say "live" only over shots with live receipts; say "rehearsal" over everything else.

## Honest fallback

If any live step is missing on recording day, cut to the no-go script for that step and keep the
label on screen for its whole duration. A partly live demo with clean labels beats a complete demo
with a fork receipt presented as mainnet.

## Not allowed

Fabricated participant quotes, screenshots, transactions or footage. Cash-out. Multi-pool routing.
A pool deposit described as an investment. A certificate described as equity, land or carbon.
