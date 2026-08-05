# Capital Off-Ramp Corridors Research Plan

**Feature Slug**: `capital-offramp-corridors`  
**Stage**: `ideas`  
**Status**: `RESEARCH ONLY`  
**Created**: 2026-08-03  
**Last Updated**: 2026-08-04

## Decision log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep participant payout separate from treasury conversion and funder inflow | The actors, amounts, accounts, and legal duties differ |
| 2 | Keep the plan on Arbitrum unless route evidence proves otherwise | Several candidates publish inbound Arbitrum USDC support |
| 3 | Select no provider from desk research alone | 17 of 20 reviewed claims required correction |
| 4 | Require exact Nigerian regulator evidence | Brand and provisional-admission claims were overstated |
| 5 | Treat garden-account mitigation as unproved | Actual control, ownership, instruction, and refund facts govern |
| 6 | Make offline recovery a scope-lock gate | Cash-out spans expiring and asynchronous provider/chain/bank state |
| 7 | Keep Linear parent-only during research | `.plans` owns the evidence and no implementation lane is active |

## Completed

- [x] Separate the three money flows.
- [x] Produce the initial four-country desk-research brief.
- [x] Run an independent adversarial review over 20 high-impact factual claims.
- [x] Challenge reasoning claims R1–R6.
- [x] Identify missed provider and integration paths.
- [x] Resolve public minimum evidence for several providers.
- [x] Add the offline-first state and recovery boundary.
- [x] Replace superseded provider rankings with a corrected candidate matrix.
- [x] Record the review outcome in RESR-71 and the Linear project overview.

## Research batch 1 — Public and live route evidence

Requires an explicit new research dispatch. Provider contact and real transfers are not authorized.

- [ ] Refresh regulator records for each candidate's exact operating entity.
- [ ] Use public eligibility/quote surfaces to test $5, $15, $20, $50, and $100 without submitting
  a transfer.
- [ ] Record asset contract, network direction, fiat rail, minimum, maximum, fees, spread, expiry,
  and recipient amount.
- [ ] Reject any candidate whose required entity, route, or price cannot be proven.

**Output**: a dated quote and regulated-entity matrix linked from `spec.md`.

## Research batch 2 — Account-holder and legal facts

Requires separate authority for provider outreach and legal review.

- [ ] Ask only candidates that pass batch 1 whether a local garden entity is eligible.
- [ ] Confirm permitted recipient relationships and third-party payout behavior.
- [ ] Confirm whether Green Goods may render the UI, hold API credentials, or submit instructions.
- [ ] Map payer, beneficial owner, instruction initiator, recipient, fee payer, refund owner, and
  loss bearer.
- [ ] Obtain corridor-specific legal review of the actual successful flow.

**Output**: an accepted role-and-funds diagram or a documented no-go.

## Research batch 3 — Offline and accessibility proof

No live value transfer is authorized.

- [ ] Prototype the state machine without a provider SDK.
- [ ] Exercise connectivity loss before and after approval.
- [ ] Exercise quote expiry, duplicate order/webhook, provider pending/manual review, failed fiat
  payout, refund, app restart, and another-device recovery.
- [ ] Review provider KYC for language, screen-reader, document-capture, and interrupted-session
  recovery.
- [ ] Define the private/public settlement-evidence boundary.

**Output**: a recovery-state walkthrough and acceptance evidence in `eval.md`.

## Scope-lock checkpoint

- [ ] Compare only candidates that pass all required gates.
- [ ] Choose one corridor and one integration model, or record that no candidate is safe/economic.
- [ ] Name all human-owned legal, provider, and release dependencies.
- [ ] Decide whether to promote the hub from `ideas`.
- [ ] Create implementation lanes only after explicit human approval.

## Inactive implementation lanes

- `ui`: `n/a`
- `state_api`: `n/a`
- `contracts`: `n/a`
- `qa_pass_1`: `n/a`
- `qa_pass_2`: `n/a`

## Documentation validation

- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] Re-read RESR-71 and the Linear project after every sync.
- [ ] Confirm no provider-selection language appears without the required evidence.
- [ ] Confirm all source dates and regulator records are current at decision time.

