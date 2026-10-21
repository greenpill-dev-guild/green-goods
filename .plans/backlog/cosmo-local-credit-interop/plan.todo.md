# Cosmo-Local Integration — work and decisions

**Feature Slug**: `cosmo-local-credit-interop`
**Linear Issue**: [RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73) (parent-only mirror)
**Linear Project**: Cosmo-Local Integration
**Linear Source**: source:plans
**Stage**: `backlog`
**Status**: `RESEARCH IN PROGRESS — backlog placement; no implementation authorized`
**Created**: 2026-08-25
**Last Updated**: `2026-10-21`
**Companion documents**: [`brief.md`](./brief.md) · [`spec.md`](./spec.md) ·
[`tensions.md`](./tensions.md) · [`resources.md`](./resources.md) · [`eval.md`](./eval.md)

**Reconciled:** 2026-10-20 UTC. The user authorized the [four-goal alignment](delivery-alignment.md),
voucher-plus-G$ clarification, research and plan/Linear cleanup. Existing implementation lanes remain blocked
until separately dispatched; this planning pass does not accept the pending PWA layout.

## Ownership

[Cosmo-Local Integration](https://linear.app/greenpill-dev-guild/project/cosmo-local-integration-6273120022c7)
owns the two-issuer voucher integration, inherited operational evidence, hackathon package and
Q4 strategy content. Green Goods 2.1.0 owns PWA delivery, admin/PWA cohesion and public-site delivery.
RESR-73 is the architecture record; PRD-857 is the delivery parent. Existing Product slices provide
visibility while this hub retains design, dependencies and evidence. No automatic lane-state sync.

The completed Commitment Pooling project retains foundation history. Its active source hub remains
the authority for its unfinished evidence. [Project reconciliation](project-reconciliation.md)
records the complete move, separate backlogs and corrected dependencies.

## Corrected integration package — 20 October UTC

The [architecture alignment](architecture-alignment.md) starts from the user-provided protocol
resources and clarifies one commitment receiving vouchers and G$. It supersedes the several-G$
installments interpretation. Claude's second-pass [review](handoffs/claude-architecture-review-results.md) found that no CommitmentPooling
upgrade is needed, and Afo accepted that boundary on 20 October as the PRD-1315 candidate; the
[conformance evidence](handoffs/claude-conformance-evidence-2026-10-20.md) settles the Gnosis bytecode and CCIP extra-args questions.
The [corrected phased plan](commitment-upgrade-plan.md) maps contracts, data, Shared, apps,
deployment preparation and audit evidence. Its conditional estimates replace the wrong-scope forecast.

[PRD-1314](https://linear.app/green-goods/issue/PRD-1314) retains the roadmap and PRD-1315 the
implementation decision gate after RESR-73 research and Claude review. Existing child IDs are
re-scoped, not dispatched. PRD-1323/1324 remain in Green Goods 2.1.0 for the linked-reward UI slice,
coordinated with PRD-1297/1299 and PRD-1261/1262. The
[Linear plan](https://linear.app/green-goods/document/hackathon-commitment-upgrade-plan-and-audit-readiness-7259011837e3)
mirrors the 20 October correction and still needs the review outcome applied. The review
instructions in [Claude's second-pass handoff](handoffs/claude-architecture-review.md) are
complete; Afo approved the section 8 corrections on 20 October and the Linear texts were applied
the same day ([record](handoffs/claude-linear-correction-drafts-2026-10-20.md)); the edited hub
reaches develop through PR #1170, which supersedes the planning checkout's uncommitted copy.

## Sequence and completion evidence

- [x] Review the supplied v0.8 whitepaper against checkout `06a31dbf5`; retain the dated foundation
  test receipt and identify missing CLC behavior in [the review](whitepaper-v8-review.md).
- [x] Preserve completed RESR-74 due diligence and GROW-32 context in the new project. Their historical
  status does not certify current chain configuration or a new implementation.
- [x] Reconcile the current brief, architecture, tasks and evaluation; retire the August model.
- [ ] **RESR-73:** resolve the source-kind, purchase-receipt, confirmer and service-discharge decisions
  with PRD-857 and COM-46. Record exact interfaces and failure/retry meaning before the live
  implementation boundary freezes. The separately approved fork rehearsal uses the defaults below
  and resolves none of these live decisions.
- [ ] **RESR-73 decisions after the review:** eligibility rule (any Fulfilled, or ordinary only through
  attestation), issuer budget mechanism (allowance or writer), allocation basis, acknowledgment lane
  in v1, Gnosis member accounts (passkey validator) and Gnosis proxy admin ownership, plus the blockers
  raised in review on 21 October: issuer-cap enforcement, the presentment handshake, terms-consent
  binding, post-claim funding of voucher-accepting Offers and distinct gardener issuer identity
  (including garden/Safe/token/admission authority and cap isolation). PRD-1315 freezes when these
  are recorded. The PRD-1096 rehearsal defaults below apply to the fork only and
  settle none of them. Purchased issuance and its PRD-796 framing were settled on 21 October.
- [x] **Voucher direction, 21 October (Afo):** promises run on vouchers; curated gardener issuance;
  presentment opens a promise, with the PRD-1096 desk as a fork-only stand-in; the instrument is
  called "voucher"; and curated, capped issuance formally replaces the kept-promises-first order.
  Recorded in the [spec](spec.md#voucher-direction-decided-2026-10-21) and in the commitment-pooling
  hub as Decision Log #69 and register #163.
- [x] **Linear for the voucher direction:** the
  [drafts](handoffs/claude-linear-voucher-direction-drafts-2026-10-21.md) were applied on 21 October
  after Afo's approval and read back; states, assignees, cycles and dates unchanged.
- [ ] **COM-46:** add terms for gardener issuers and a legal check of issuer duties for individuals.
- [x] **PRD-857 wording:** "redeemable" became "usable for their own services" in its first
  sentence on 21 October after Afo's approval, and the record was read back unchanged otherwise.
- [ ] **PRD-1299:** settle the proposed voucher wording (verbs, "voucher exchange", es/pt "vale").
- [ ] **PRD-1096, optional:** a curated gardener-voucher case is not in the approved rehearsal;
  adding one before dispatch is Afo's call.
- [ ] **COM-46, by 21 October:** agree both issuers' service units, prices, available capacity,
  caps/limits, purchase and earning terms, partial delivery, repair and separate reporting consent.
- [ ] **PRD-1096, by 21 October:** prove the local fork loop, negative cases and account behavior.
  Mock message transport is labeled; it is not live cross-chain certification.
  Rehearsal defaults adopted 20 October: any `Fulfilled` commitment qualifies (path recorded, not
  gated); delivery from a pre-minted reserve through an allowance; one recipient, the lead
  provider; purchases through the pool's own bounded swap, outside the PRD-796 wrap boundary; no
  acknowledgment lane. Member accounts and proxy admin stay live-only gates. The
  [dispatch draft](handoffs/prd-1096-rehearsal-dispatch-draft.md) was approved with all eight
  assumptions on 20 October, and the contracts lane stays blocked until it is dispatched.
- [ ] **PRD-1097:** build the receipt-backed passport with real and rehearsal data distinguished.
- [ ] **PRD-1197, 22 October:** record human go/no-go, explicitly addressing every original gate.
  Depends on PRD-1096 and COM-46. No default substitution or implied funds authority.
- [ ] **PRD-1100, conditional:** perform only the specifically authorized live release after a go;
  defer/cancel with a reason on no-go, never mark an unperformed live pilot Done.
- [ ] **COM-28:** run the participant pilot after terms and rehearsal. Use the go-authorized live
  version or the labeled local version; capture consented participant language and repair findings.
- [ ] **RESR-93, in 2.1.0:** accept the PWA composition and first slice in its own hub. This can proceed
  independently of live CLC deployment and preserves the existing queue, draft and permission rules.
- [ ] **RESR-94 + MAR-32:** research and draft the diaspora pitch in parallel, using the
  [Claude Fable handover](handoffs/claude-fable-research-pitch.md). Update claims as implementation
  produces receipts; do not wait for a live launch to prepare the no-go story.

- [ ] **PRD-1260 + PRD-1261, in 2.1.0:** deliver the accepted garden-scoped Home/submission slice
  and a bounded paired member/steward design-cohesion slice after RESR-93. No live Gnosis dependency.
- [ ] **GROW-68 → PRD-1194:** approve the public October–December strategy, then deliver the stable
  public-site page and reviewed site updates in 2.1.0. MAR-34 reuses the same approved story.
- [ ] **PRD-1262:** record admitted versus deferred release scope and validate the included member
  and steward journeys. This is the explicit 2.1.0 QA milestone item, not an all-project completion gate.

## Event and remaining operations

GROW-43 owns event confirmation. Existing internal dates are the 16 October briefing, 20 October
conference, 24 October dry run, 27 October submission and 28 October pitch. The conservative
14:00 London submission target still needs official deadline/timezone confirmation. The deck aims
for eight to ten minutes pending the event's confirmed format.

Live Linear on 15 October marks PRD-731 release operations, PRD-732 first cycle and COM-36 season
setup Done; this is issue-state evidence, not a new deployment or CLC certification. PRD-732 and
COM-36 now live in the 2.0.0 release history. COM-11 settlement evidence and COM-3/15/35 onboarding
and workshop work remain separately tracked. COM-35 and COM-11 still need owner-confirmed dates.

PRD-727 documentation remains due 4 November and PRD-728 walkthroughs 18 November. These are follow-on
assets, distinct from the hackathon demo. PRD-651 is parked Backlog without a cycle or due date; the
active October authorization has moved to PRD-1197.

## Fiat stretch

Keep all delivery in [Garden Fiat Contributions](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3).
Research RESR-82 first, then PRD-1031 scope. Qualify one donor market, payment method, chain, asset
and garden recipient; prove payment-to-donation reconciliation and recovery, all-in fees, identity
checks and sponsored-gas budget. Reown Starter plus Pimlico is the selected account direction;
the payment provider remains open. The diaspora story does not establish provider eligibility.

A stretch no-go leaves the core demo intact. Endowment deposits remain PRD-1039 follow-on work and
any real-money pilot remains gated by PRD-1038. No new execution deadline or spending approval was set.

## Decision record

The 9 October user request authorizes the branch and project split, issue-gap cleanup, planning
reconciliation and the Claude Fable prompt. It does not authorize runtime edits or deployment.
The 20 October decision accepts the no-core-upgrade boundary as the PRD-1315 candidate and
authorizes drafting the plan corrections for approval; it does not authorize implementation,
deployment or Linear writes.
September's issuer-service model supersedes August's weighted-contribution dispatch sequence.
The user's four-level capital narrative is the pitch direction; evidence and concrete funding
terms still determine which claims can be made. Lane and execution evidence objects remain unchanged.
