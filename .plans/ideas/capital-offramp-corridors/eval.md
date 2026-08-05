# Capital Off-Ramp Corridors Evaluation Plan

## Evaluation posture

This is a research-readiness evaluation. There is no implementation or release gate while the hub
remains in `ideas`.

## Research acceptance gates

| ID | Gate | Pass condition | Evidence |
|---|---|---|---|
| RG-1 | Exact entity | Contracting entity, regulator, status, permission, and route are current | Regulator record and provider terms |
| RG-2 | Exact asset path | Inbound Arbitrum USDC contract and direction are confirmed | Provider asset/network response |
| RG-3 | Small-payout economics | Successful all-in quotes exist at $5/$15/$20/$50/$100 | Dated quote matrix |
| RG-4 | Account eligibility | User-KYC or eligible garden entity is confirmed | Provider eligibility evidence |
| RG-5 | Legal roles | Payer, owner, control, recipient, refund, and loss roles are accepted | Corridor legal role map |
| RG-6 | Offline recovery | Expiry, interruption, duplicate, failure, and refund states recover safely | State walkthrough |
| RG-7 | Accessibility | KYC and recovery are usable in the target language and on the target devices and connectivity, and survive screen-reader use, document capture, and an interrupted session | Assisted-use review recording each condition |
| RG-8 | Privacy | Public settlement evidence excludes personal/payment identifiers | Data-boundary review |
| RG-9 | Freshness | Regulator and quote evidence is no more than seven days old | Timestamped evidence |

All applicable gates must pass for one candidate before that corridor can enter implementation
planning.

## Country acceptance

### Nigeria

- Exact operating entity appears in the current regulator record for the required activity.
- No anonymous/social-channel counterparty or name-mismatched bank payout.
- A successful same-name NGN bank quote exists at the target amounts.
- Minimum, review delay, dispute, and refund behavior are visible before approval.

### South Africa

- The underlying CASP and fiat-payment entity are identified.
- The exact funding flow is assessed under the final applicable exchange-control rules.
- A successful ZAR quote and inside-PWA path are demonstrated.

### Brazil

- The quote proves BRL payout by PIX for the exact token/network/user combination.
- The regulated entities and activities are mapped to current BCB rules.
- PIX key ownership, failed payout, refund, language, and accessibility are tested.

### United States

- The pilot has a stated product-learning purpose.
- Provider/app eligibility and all-in cost are confirmed.
- Payer/payee classification and the applicable reporting workflow are reviewed separately from
  broker Form 1099-DA reporting.

## Offline and failure scenarios

| Scenario | Expected result |
|---|---|
| Connectivity lost before approval | Draft persists; no transfer is attempted |
| Connectivity lost after signing | Chain and provider reconcile before any retry is offered |
| Quote expires | Approval is disabled and a new quote is required |
| Deposit instruction expires | User cannot send to the stale instruction |
| Duplicate order/webhook | Idempotent processing; one visible order |
| Provider remains pending | User sees pending/manual-review state and support path |
| Bank payout fails | Refund owner, amount, destination, and status are visible |
| App restarts or device changes | Order can be recovered without exposing private payment data |
| Onchain transfer succeeds but fiat does not | State remains unsettled; success is not claimed |

## Evidence quality

- Primary regulator and provider documentation takes priority.
- Provider marketing may identify a candidate but cannot prove a fee, licence, or route.
- Absence claims remain `UNVERIFIABLE` unless a definitive current source settles them.
- Every factual correction records a source URL and access date.
- Live quotes record timestamp, asset/network, input, fees/spread, recipient amount, and expiry.
- No private partner, provider-contact, gardener, wallet, bank, session, or identity data enters the
  public repo or Linear.

## Promotion decision

After the research batches, the human decision is one of:

1. **Promote one corridor** with a bounded implementation plan.
2. **Continue research** because a specific gate remains unresolved.
3. **Stop** because no route safely supports the target amounts.

Passing research gates does not itself authorize a provider account, dependency install, live
transfer, custody change, contract change, or production release.

