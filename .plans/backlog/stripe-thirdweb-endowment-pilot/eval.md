# Pilot acceptance and evidence

## What counts as proof

| Layer | May establish | Cannot establish |
| --- | --- | --- |
| Official docs + public browser | Published requirements and visible pre-authentication screens | Account entitlement, actual L0 qualification, issuer acceptance or successful Arbitrum delivery |
| Sandbox, fork and mock browser | State transitions, bounded authorization, replay/expiry checks and rendered flow | Real identity verification, production credit settlement, issuer fees or live garden funding |
| Human-operated live session | Actual verification/authentication prompts, posted payment, onchain delivery, endowment/recovery | Untested country/method availability or statistical reliability from a small cohort |

Label UI evidence with the actual engine/session. Wallet/signing/recovery needs authenticated-session proof under repository guidance; Brave is specifically required only for the surface classes named in AGENTS.md. Label mock-auth localhost, Storybook or CI Playwright as such. Public-doc browser observations are separate. Keep participant details, card/Link screenshots, customer/session identifiers and wallet-to-person mappings out of this public repository; record only redacted aggregate findings here.

## Before live payments

- [ ] Selected provider accepts the exact country/payment/native-Arbitrum-USDC route and donor-owned endowment use case. Confirm entity/payment partners, minimums, verification profile and support/refund responsibilities. For Stripe, verify preview entitlement and exact API parameters.
- [ ] Existing vault on Arbitrum preserves donor redemption, accepts the final asset and names the garden yield beneficiary. No placeholder treasury or Ethereum manifest presented as the target.
- [ ] Donor email signing produces a bounded, durable execution instruction before payment; browser closure cannot require another confirmation. Backend cannot redirect funds or acquire admin access.
- [ ] Page review binds local payment total, FX/fees, input cap, conversion minimum, donor share receiver and expected wait. US risk-driven L1/L2 ends the L0 attempt before charging; EU required verification is expected and must complete before payment. Later countries use their agreed profile.
- [ ] Negative tests below pass; receipt/pending messaging and support ownership are reviewed. Signed instruction expiry, cancellation and delayed delivery policy are explicit.

## Sandbox and authorization failures

Test: US L0 pending/rejected or step-up; EU verification pending/rejected/resumed and missing required fields; regional ID/BVN mismatch and advanced-verification escalation; unsupported country/state/card; quote expiry before charging; decline and 3DS/bank-app abandonment; duplicate final click; lost checkout response; duplicate/out-of-order/spoofed webhook; wrong wallet/chain/token/amount; old balance mistaken for new delivery; stale authorization/paymaster data; insufficient conversion output; reverted deposit; relayer restart; browser closure; double submission; email recovery of the same wallet/position. For bank routes add wrong reference, wrong payer, under/overpayment, late/duplicate payment and weekend settlement past the authorization window. Assert no unintended purchase retry, no double deposit, no misleading success and no access beyond reviewed consent. Reconcile provider and chain state before retrying.

## US live test matrix

| Attempt | Participant | Primary observation |
| --- | --- | --- |
| 1 | New email wallet, new Link/crypto customer, US Visa | L0-only inputs and end-to-end $50 contribution |
| 2 | New wallet/Link, Mastercard, different issuer | Independent credit-card and issuer evidence; mobile checkout |
| 3 | New wallet/Link, second eligible state | Close page after checkout starts; backend completes the same authorized deposit |
| 4 | Returning participant from 1 | Reuse account/wallet/payment where permitted; no unnecessary repeated KYC |
| 5 | Returning participant from 2, second device | Email recovery of original shares; same single final-action flow |

Each repeat is proposed at $50, subject to live limits. Participants authorize their own transactions; no agent submits personal data or payments. Fresh L0 proof means no prior higher crypto verification silently reused; inspect permitted tier status, not merely the absence of an SSN field today. If a participant needs step-up, retain that outcome and stop their attempt; do not recruit replacements to hide failures. A separate authorized small redemption verifies donor control and returns assets to the donor, never the organisation.

## EU and later cohorts

EU: two first-time participants from two specifically approved EU countries, two issuers and one returning checkout; proposed €50 each. Include required verification, interrupted-verification resume, mobile/desktop, page-close completion and cross-device recovery. Measure first-time onboarding separately from the returning experience. Higher-value wallet-ownership challenges require separate proof before increasing scope; a small €50 test does not approve that flow.

Brazil, South Africa and Nigeria: first pass the regional prerequisite gate, then two first-time attempts and one repeat for the selected provider/method, approximately $50 equivalent subject to limits. Set local-currency budget and disclosure before enrollment. Include page-close and delayed-settlement cases, plus recovery. Never count Pix/bank as credit-card evidence or replace failed participants to improve the result. No provider substitution after an uncertain payment. Live transactions and any redemption need separate human authorization.

## Measurements and go/no-go

Record all attempts, step-ups, abandonments and declines; KYC fields/prompts; country/method/issuer; first-time versus returning duration; payment-to-delivery and delivery-to-deposit latency; provider/FX/execution costs and issuer charges; share delta, recovery/redemption and support interventions. Keep sensitive evidence private. Track net endowment capital by region to test the US/EU acquisition assumption.

### Common hard gates

**Go for a limited expansion of a tested route only when all apply:** approved provider/use case and deployed vault; two first-time successes and a returning success; donor-owned wallet/shares and email recovery; verified redemption under actual vault rules; every successful purchase completes the correct deposit without operator rescue; page closure does not require a second confirmation; no duplicate movement, custody intermediary or broad delegated signing rights. Any unresolved paid-but-not-deposited funds block that route. A common ownership/authorization defect blocks all routes.

**No-go:** required passkey or wallet/network management; post-payment “finish endowment,” wallet signature or manual payment report; hidden custody; unapproved asset/chain; inability to preserve ownership on failure; or a route whose ordinary settlement outlives enforceable consent. Required bank/issuer authentication and disclosed KYC do not themselves violate the single endowment-consent rule, but their cost in steps/time remains part of the UX decision. A safe pending balance is recovery evidence, not a successful endowment.

### Regional go or no-go

| Region / current status | Go evidence beyond common gates | No-go or stop condition |
| --- | --- | --- |
| US — pending, first priority | At least two genuinely new L0 customers across Visa/Mastercard and two issuers; two eligible states represented; both planned repeat cases covered; actual credit posting verified | Stop each step-up before charging. Fewer than two first-time L0 successes, issuer cash-advance treatment or a second deposit action blocks this cohort's expansion |
| EU — pending, initial priority | Both new participants in the two approved countries complete required verification and credit payment; returning verification reused where permitted; no operator rescue | Missing country/asset approval, inability to finish/resume verification, or presenting this as L0. Failure in one country does not approve or disqualify untested countries |
| Brazil — conditional | Select Ramp Pix or Fonbnk Pix after actual verification and Portuguese payment-flow proof; automatic reconciliation; separate posted credit evidence before offering/claiming credit | Unresolved CPF/selfie-versus-ID requirements, manual “I paid”/agent reconciliation, unclear fees or no local payment completion |
| South Africa — conditional | Fonbnk's enabled bank redirect and local verification work; authorization survives the disclosed settlement window and a weekend case | Manual rescue, unmatched/late payments that strand funds, or expiry requiring another deposit consent. Do not promise instant settlement |
| Nigeria — currently no-go for target UX | Written entity/payment-partner/use-case confirmation; working BVN and step-up handling; demonstrated automated matching replaces the documented manual flow | Manual payer/agent confirmation remains, verification conflict unresolved, or settlement/support duties unclear. A quote alone cannot promote this route |

### Proposed pilot UX and cost thresholds

Freeze these targets before enrollment; changing them afterward must be disclosed, not used to erase failed attempts. They are product evaluation targets, not provider guarantees:

- US L0: median first-time start-to-endowment at most five minutes. EU: median first-time at most ten minutes, reported separately from returning checkout. Any compliance review delay stays in the results.
- Brazil's selected Pix route: median payment authorization-to-crypto delivery at most five minutes. South Africa: delivery within the provider-agreed bank SLA, no longer than its documented two-business-day window, with a precise weekend expectation before payment. Nigeria: agree a concrete SLA before any live enrollment; none is established here.
- Every route: funded-wallet-to-confirmed-endowment target at most two minutes, no second consent and no operator rescue. After ten minutes at this stage, reconcile/support without another charge. A slow bank payment uses its disclosed bank SLA rather than this two-minute blockchain target.
- Total provider, execution and FX cost at the proposed contribution amount at most 10%, measured against a recorded contemporaneous FX benchmark and final posting. Report gross cost and any Green Goods subsidy separately. Unexplained charges, a missing comparison rate or cash-advance treatment fails the cost gate. The budget's fee allowance is not permission to exceed this UX threshold.

Record `GO — limited to <country/provider/method>`, `NO-GO — <failed gate>`, or `PENDING — <missing evidence>` for every cohort. No cohort is GO today. Small samples demonstrate feasibility, not a conversion-rate claim; retain every failed or stepped-up attempt and report counts, not only successful payment totals.

Success receipt includes contribution/card total and fees, vault deposit confirmation, donor share ownership and recovery link. The garden gets yield under vault rules, not immediate spendable principal. Verify the beneficiary and funding mechanism and report any pending real yield payout. Stripe/Link's purchase receipt is not a Green Goods endowment receipt or automatic proof of tax deductibility. Completed crypto purchase and failed deposit must have a support/recovery path; do not promise reversible card payment after delivery.

## Planning validation

Linear reconciliation, 2026-10-15: connector read-back verified the existing project, four milestone descriptions, twelve issue updates and new readable project specification, with unchanged states/assignments/cycles/dates and an acyclic revised dependency graph. `node scripts/harness/plan-hub.mjs record-linear --feature stripe-thirdweb-endowment-pilot --parent PRD-1031 --project deb12dbc-44d7-4551-9d27-ec0d760409e6 --lane-sync-mode parent_only --actor codex` recorded the existing mirror. The preserve-only `linear-sync --feature stripe-thirdweb-endowment-pilot --json` manifest was checked against live PRD-1031. `node scripts/harness/plan-hub.mjs confirm-linear-sync --feature stripe-thirdweb-endowment-pilot --actor codex` recorded 2026-10-15T22:30:56.782Z. At the observed 22:31:02 UTC boundary, `node scripts/harness/plan-hub.mjs validate` passed across 28 hubs; local checks passed for eight files and 30 relative links/anchors, JSON/whitespace and confirmed-mirror/backlog/pending-lane assertions. No runtime test, live payment or deployment is claimed. Only evidence prose was finalized afterward.

Regional update, 2026-10-15: `node scripts/harness/plan-hub.mjs validate` reported **Validated 28 feature hubs** at the observed 21:54:57 UTC boundary. A local Python check verified seven plan files, JSON syntax, relative Markdown destinations/anchors and trailing whitespace at 21:55:25 UTC. These are working-tree planning checks; no commit-attributed implementation receipt is claimed. The source refresh verified Stripe EU requirements; public quote observations in regions.md belong to the preceding read-only research. No sandbox or live payment was run. Implementation and QA lane states remain pending.

Final rerun at the observed 21:56:21 UTC boundary: the same plan validator passed across 28 hubs; all seven files and 28 relative links/anchors passed, including JSON/whitespace and assertions that the hub remains backlog with no passed/completed lane. Only this evidence receipt and its handoff timing were updated afterward.

On 2026-10-14, `node scripts/harness/plan-hub.mjs validate` reported **Validated 28 feature hubs**. The final local check inspected all **6** plan files, resolved **17** relative Markdown links and found no trailing whitespace. These checks cover the uncommitted plan artifacts, not a tested implementation commit. No implementation tests, sandbox payment, production quote or live pilot were run while creating this plan. Implementation, QA and financial proofs remain pending.
