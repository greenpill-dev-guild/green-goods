# Capital Off-Ramp Corridors Research Spec

**Stage**: `ideas`  
**Status**: Research-only  
**Evidence baseline**: [Independent review, 2026-08-04](reports/codex-review-2026-08-04.md)

## Summary

Determine whether an individual gardener in Nigeria, South Africa, Brazil, or the United States can
turn a roughly $5–$100 Arbitrum USDC payout into local spendable money through a route reachable
from inside the Green Goods PWA, without Green Goods taking custody or silently creating a
money-transmission role.

This spec defines the evidence required to choose a corridor and integration model. It does not
select a provider or authorize implementation.

## Users

- **Primary**: an individual gardener receiving a small payout.
- **Secondary**: a garden operator supporting payment recovery and settlement evidence.
- **Internal**: product and legal reviewers deciding whether a route is safe enough to scope.

No individual, cohort member, or private partner information belongs in this public plan.

## Research requirements

### R-1 — Exact corridor route

For each candidate, record:

- operating and contracting legal entity;
- regulator, approval or licence identifier, current status, and permitted activity;
- country, fiat payout rail, and same-name bank-account requirements;
- exact token contract, network, and inbound-deposit direction;
- user-KYC, business-KYB, or consumer-account model;
- quote expiry, deposit-address expiry, processing states, and expected settlement time;
- failed-payout, cancellation, refund, and support behavior.

Brand-level country coverage does not satisfy this requirement.

### R-2 — Small-payout economics

The test sizes are **input amounts: 5, 15, 20, 50, and 100 USDC on Arbitrum** — the payout a
gardener actually holds, not a desired local-fiat output. Quote every candidate on that same basis
so minimums, fees, and providers stay comparable. An explicit below-minimum rejection is a valid
recorded result, not a missing row.

For each size, obtain a successful all-in quote and record:

- provider fee;
- FX spread against an independent timestamped reference rate;
- gas or network fee;
- bank or receiving fee;
- amount delivered;
- minimum and maximum;
- quote expiry;
- estimated arrival;
- amount and destination returned on failure.

Headline fee percentages do not satisfy this requirement.

### R-3 — Non-custodial and legal role map

For every integration model, identify:

- legal payer and beneficial owner of the crypto;
- provider customer and API credential holder;
- instruction initiator and any party able to redirect or cancel;
- recipient relationship and identity-verification responsibility;
- fee payer, refund recipient, and loss bearer;
- controller of settlement and identity evidence.

A garden business account is a hypothesis, not a mitigation, until the provider accepts the entity
and corridor-specific counsel approves the actual funds flow.

### R-4 — Offline-first recovery

The proposed route must distinguish:

1. local draft;
2. connection required;
3. KYC state;
4. quote state and expiry;
5. explicit user approval;
6. onchain submission;
7. provider deposit detection;
8. provider processing or manual review;
9. fiat settlement;
10. expiry, failure, refund, or support required.

A value transfer must never silently retry after connectivity returns. Provider order and chain
state must reconcile before another send is enabled.

### R-5 — Settlement evidence and privacy

The terminal success condition is confirmed fiat settlement, not an onchain transaction alone.
Settlement evidence must be sufficient to reconcile the payout without putting wallet addresses,
bank details, identity records, session identifiers, or private provider data in public artifacts.

## Corrected country boundaries

| Corridor | Current evidence posture | Scope-lock blocker |
|---|---|---|
| Nigeria | Several technical/widget candidates; no provider selected | Exact regulator status, $5–$100 quotes, and eligible account model |
| South Africa | Strongest verified Arbitrum consumer route; embedded route unselected | Inside-PWA integration, exact licensed entity, and exchange-control facts |
| Brazil | PIX preferred; no full provider route proven | Successful PIX quote and counsel mapping to current BCB rules |
| United States | Optional control corridor | Product value, app eligibility, minimums, and correct payer/payee tax classification |

## Candidate evidence boundary

The current due-diligence queue is Breet, Yellow Card, VALR, Kotani, Fonbnk, Onramper, Transak, and
Coinbase CDP. Inclusion means only that public evidence justifies further verification.

The source record for each candidate is the
[independent review](reports/codex-review-2026-08-04.md). Provider marketing is not regulatory,
pricing, or commercial confirmation.

## Human judgment points

1. Is a consumer-account handoff sufficiently “inside the PWA”?
2. Does the first pilot optimize for the hardest corridor or the cleanest control corridor?
3. Is a garden entity allowed to be the legal payer and provider customer for the target recipient
   relationship?
4. May Green Goods hold credentials or submit instructions for a garden account?
5. What maximum all-in cost is acceptable at each payout size?
6. What evidence may be stored privately, and what may appear in a public settlement record?
7. Does any route justify moving from `ideas` to a bounded research or implementation backlog?

## Non-functional constraints

- **Safety**: no route may risk duplicate sends or obscure refund ownership.
- **Custody**: Green Goods does not hold participant funds or keys.
- **Offline**: drafts may be local; quotes, KYC, and transfers require reconciled live state.
- **Accessibility**: provider-hosted KYC and recovery must work for the target language, device, and
  connectivity constraints.
- **Privacy**: follow the repo and Linear privacy boundaries.
- **Freshness**: regulator records and successful quotes must be refreshed within seven days of a
  decision.
- **Public repo**: public provider and regulator evidence only; no private partner or individual
  details.

## Package and lane mapping

No package lane is active while this remains research-only.

| Area | Lane | Status |
|---|---|---|
| Client/PWA | `ui` | `n/a` until one route is scope-locked |
| Shared state/API | `state_api` | `n/a` until provider and offline state contracts are accepted |
| Contracts | `contracts` | `n/a`; no contract change is currently justified |
| QA | `qa_pass_1`, `qa_pass_2` | `n/a` until implementation exists |

## Risks

| Risk | Mitigation |
|---|---|
| Provider marketing is mistaken for route proof | Require successful quotes and exact legal entity |
| Provisional admission is called a licence | Match current regulator record and permitted activity |
| Small payouts are consumed by floors or spread | Measure all-in recipient amount at five target sizes |
| Garden account merely relocates regulatory risk | Complete provider underwriting and a legal role map |
| Offline retry duplicates a transfer | Explicit approval, idempotency, and provider/chain reconciliation |
| Onchain success is mistaken for payout success | Require fiat settlement or a visible recovery state |
| Public evidence leaks recipient data | Keep identity and payment details out of public records |

## Out of scope

- Garden treasury conversion
- Funder on-ramp
- Provider outreach without separate authority
- Live-money test transfers
- Account opening or KYB submission
- Provider SDK installation
- Package, contract, bridge, indexer, or deployment changes

