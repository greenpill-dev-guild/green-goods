# Commitment Pooling: External Documentation and Community Rollout Plan

**Feature Slug**: commitment-pooling
**Stage**: active
**Updated**: 2026-07-11
**Canonical synthesis**: “Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building.” This plan defines derivative materials and rollout; it does not replace or compress the synthesis into a new source of truth.
**Settlement authority**: `settlement-spec.md` owns settlement and verification claims (oracle predicate, funding routes, Safe topology, AA gate). The canonical synthesis is the long-form rationale and is silent on the verification axis by design; derivatives cite the spec for settlement facts, not the synthesis.

## Evidence vocabulary

Every derivative uses these labels consistently:

| Label | Meaning |
|---|---|
| **Built** | Available in the current Green Goods product and proven through current documentation or runtime evidence. |
| **Planned** | Specified in the Commitment Pooling or Community Needs & Signals hubs but not yet implemented. |
| **Reported** | An authorized executor recorded a Celo transaction hash on Arbitrum. This is not receipt proof. |
| **Oracle-verified** | The mandatory Chainlink Functions callback verified the finalized Celo receipt, successful Safe/module execution, and the exact canonical-G$ `Transfer` logs from the registered Safe to the expected recipients and amounts. The outer transaction sender may be a scoped Zodiac executor. |
| **Evidence-gated** | Intentionally blocked until the named research, operations, oracle, Safe, or account-abstraction evidence exists. |

Do not substitute “verified” for “oracle-verified” when discussing G$ settlement. FundingAttribution and impact evidence use their own named receipt/methodology checks and must not be blurred into the settlement oracle claim.

## One grounded story

Green Goods already provides garden identity, permissions, passkey-backed access, offline field workflows, work evidence, assessments, and reporting foundations. **Planned** Commitment Pooling lets a garden turn local Requests, Offers, and Initiatives into clear promises that can be taken up, evidenced, confirmed, and learned from. **Planned** Community Needs & Signals adds an independent PWA at community.greengoods.app for Needs/Create/Profile; operator pools, triage, and evaluator lineage/export live in admin under /community; public funder discovery stays in existing Green Goods browser surfaces.

Commitment and proof control remain on Arbitrum. Commitments are module-native records rather than EAS state machines. Optional domains use arrays; DomainImpact commitments pair each positional domain with a registered, domain-matching action UID, and UID 0 remains valid.

When a Fulfilled commitment has a G$ reward, the planned SettlementModule records control state on Arbitrum while canonical G$ remains on Celo. The House of Alignment stream lands directly in the Green Goods protocol Safe on Celo. Green Goods models only the ProtocolToGarden downstream funding route. A reported transaction becomes oracle-verified only through the mandatory Chainlink Functions callback; there is no manual verification path. If the Celo account-abstraction/paymaster gate fails, protocol and garden funding may continue, but automated member delivery remains blocked and no garden-held member-claim path is introduced.

Grassroots Economics provides important design learnings. Green Goods uses the paper and public documentation as a clean-room reference and builds its own architecture.

## Pilot focus cohort

Operational rollout anchors on a named 3+1 cohort (2026-07-10): **Tech and Sun Hub** (Awka, Nigeria — solar hub development + educational programs), **Greenpill Cape Town** (Muizenberg / Deep South Circles — UNICEF-funded waste-management program, partner off-platform), and **AgroforestDAO / Redemption Hill** (Bias Fortes, Brazil — agroforestry + farm-school education) — together covering all four action domains — plus **a fourth garden in outreach** (the mature MRV-adoption slot; selection criteria live in the RESR-58 scenario document), named only once participation is confirmed. Naming a candidate never presumes readiness: RESR-62 records confirmed/incomplete/unavailable per garden, and mandate artifacts gate August seeding. Gardens named in the canonical synthesis beyond this set remain narrative context and later waves. July dry-run rewards are Cookie Jar/treasury only. In August every confirmed focus garden is G$-settlement-capable (one Celo Safe per garden, deployed on demand); Tech and Sun Hub is the first-execution hypothesis, and Pass-2 evidence (steward, local relevance, in-pool spend sink) orders the rollout.

## Audience map

| Audience | Primary question | Required proof | Call to action |
|---|---|---|---|
| Garden operator | “What changes in my weekly work?” | Mandate example, admin /community triage/seeding flow, roles, time/capacity expectation, support path | Confirm a research/onboarding session and correct the mandate |
| Gardener/community member | “Can I take part without learning crypto?” | Independent Community PWA, voice/offline flow, passkey, authorship, confirmation, clear waiting and recovery states | Name a Request, Offer, or Initiative or take up a promise |
| Garden evaluator | “Can I trace claims and preserve methodology integrity?” | Need → commitment → work → baseline/delta → testimony lineage, optional domain/action pairs, CSV/JSON export | Review evidence and domain/methodology mapping |
| Funder | “What did support enable, and what is verified?” | Aggregate progress, assessment provenance, receipt-checked FundingAttribution, reported versus oracle-verified settlement disclosure | Support the garden through direct donation/endowment or collaborate on a cohort |
| Collaborator/protocol steward | “Where can we add value without fragmenting the system?” | Architecture and permission boundaries, open questions, research needs, implementation gates | Join a bounded research, evaluation, settlement, or documentation lane |

## Documentation set

Each artifact names its owning record. Brief production is English-first and shareable as doc/PDF through the July 31 dry run (docs-site publication later), with partner factual review before external distribution.

1. **Canonical synthesis** (standalone Linear document) — long-form rationale, learnings, and full flywheel.
2. **External brief** (RESR-57; draft at `external-brief.md` in this hub, with four companion graphics per `visual-assets.md` shipping in the doc/PDF export) — two pages: why now, how the loop works, what is built versus planned, trust and settlement boundaries, invitation.
3. **Use-case pack** (RESR-58) — anchored in Tech and Sun Hub, Greenpill Cape Town, AgroforestDAO / Redemption Hill, plus an anonymous fourth-garden MRV-adoption slot pending first contact: Request, Offer, and Initiative examples across optional domains; positional action pairs where DomainImpact requires them; analog and digital participation; non-G$ and G$ reward paths per the garden reward-path matrix.
4. **Operator onboarding guide** (PRD-701) — research session, mandate artifact, roles, seeding, gathering, support, and issue escalation.
5. **Evaluator architecture note** (PRD-649 / docs lane) — ERD, sequences, event/indexer contract, evidence lineage, and CSV/JSON export boundaries.
6. **Funder/collaborator note** (RESR-57 audience notes) — capital flow, reported versus oracle-verified facts, funding attribution, no ranking/no escrow, ways to participate.
7. **FAQ and glossary** (RESR-57) — plain-language vocabulary plus exact technical appendix.
8. **Member one-pager** (RESR-57, after the English content freeze) — gathering-ready one-pager/QR for gardeners and community members.

Every derivative includes a “last aligned with canonical synthesis” date, labels planned behavior, and names unresolved decisions rather than smoothing them away.

Visual assets for the brief, this plan, and the synthesis are indexed in `visual-assets.md` (SVG + 2x PNG pairs; Linear uploads are manual). This plan’s own graphics: `rollout-timeline-band` (go-to-community sequence), `rollout-ownership-map` (documentation set), `rollout-settlement-states` (evidence vocabulary), plus the reused loop and roles graphics.

## Go-to-community sequence

| Linear checkpoint | Planned engagement | Exit evidence |
|---|---|---|
| Through 2026-07-16 | Operator outreach begins; facilitation-kit review | Outreach started; unanswered questions logged |
| 2026-07-16 to 2026-07-30 | Co-design sessions and mandate confirmation (PRD-701 kickoff package due 2026-07-30 with RESR-62) | Contacts, session slots, consent path; corrected mandates, language findings, join-request decision evidence |
| 2026-07-31 dry-run checkpoint | Share “what we heard / what changes” back to gardens | Readiness matrix with explicit gaps; no inflated launch claim |
| 2026-08-31 release checkpoint | Operator walkthrough and one bounded end-to-end proof where every external gate passes | Tested runbook, architecture evidence, and oracle-verified Celo settlement proof where relevant |
| 2026-09-30 Community checkpoint | Independent-PWA and gathering usability sessions | Observed task completion, recovery-path evidence, and qualitative understanding |
| 2026-12-31 hardening review | Publish pilot learnings and decisions | Evidence-backed promote/defer decisions for hardening |

## Marketing and distribution plan

This is a trust-building rollout, not a feature-launch countdown.

- **Owned**: Green Goods docs, garden pages, short captioned walkthrough, operator office hours, release notes.
- **Partner**: participating gardens, Greenpill chapters, House of Alignment, GoodDollar, and methodology collaborators after factual review.
- **Community**: gathering-ready one-pager/QR, recorded demos with transcripts, local-language summaries where operators request them.
- **Earned**: a post-pilot case study only after the garden approves its story and evidence.

Content rhythm:

1. Explain the need and the operating loop.
2. Show one real, bounded scenario.
3. Publish what research changed.
4. Show implementation evidence and limitations.
5. Invite a specific form of participation.

## Measures and pilot targets

The percentages below are **targets, not historical results**. Measurement runs from the first instrumented pilot task through **2026-09-30**. Every report includes numerator, denominator, sample size, observation window, excluded states, and qualitative context; no wallet, join-request, or participant identifiers enter public reporting.

| Target by 2026-09-30 | Measurement |
|---|---|
| At least 90% passkey onboarding completion | Participating gardeners who complete passkey setup divided by those who start their first authenticated action. |
| At least 99% eligible offline-job sync success | Eligible queued jobs that reach confirmed submission divided by all eligible jobs that begin a normal send attempt; exclude user-cancelled jobs and time spent in `waiting_for_hat`. A separate retry-recovery cut may use only jobs that entered retry as both numerator population and denominator. |
| At least 95% operator validation completion without data repair | Triage, seeding, and confirmation tasks completed without a corrective data edit divided by eligible observed tasks. |
| Median field submission time at or below 2 minutes | Median from first input to locally saved/submitted state, compared with a separately measured pre-pilot baseline; do not assume a five-minute baseline. |

Also report:

- operator sessions confirmed/completed and mandate corrections returned;
- comprehension for Request/Offer/Initiative, two-axis Need state, confirmation, and settlement status;
- share of seeded commitments linked to operator-confirmed Needs;
- operator time to triage and seed;
- research questions closed or consciously deferred;
- external-brief comprehension and collaborator follow-through;
- receipt-checked FundingAttributions and oracle-verified Celo settlements, never vanity reach alone.

## Claims guardrails

- Say “informed by Grassroots Economics” and “clean-room implementation,” not “Sarafu integration” or “copy.”
- Say “G$ remains and settles on Celo”; never imply G$ bridges to Arbitrum.
- State that GoodDollar also operates beyond this settlement context only when the statement is sourced and relevant; Green Goods’ selected settlement venue remains Celo.
- Say House of Alignment funds stream directly to the Green Goods protocol Safe on Celo. Green Goods models only ProtocolToGarden onward; do not describe an unconfirmed automatic allocation. When provenance is stated, state it precisely: GIP-26 failed its DAO vote (June 2026), so the Good Labs Foundation funds the pilot directly — roughly $800/month in G$ per member via a Flow Splitter on Flow State, first evaluation 2026-09-30.
- Describe borrow-and-repay only as design-only (`credit-spec.md`): records-only, interest-free, never a per-person credit score, and not part of the August release. Do not present it as available or scheduled.
- Source external evidence claims only from the canonical synthesis Sources section (re-verified 2026-07-05). Never reintroduce “Ruddick 2021” as the RCT attribution, “300,000 transactions”, the WFP 95%/90% food figures, or the unsourceable ~284 pools / ~5,591 swaps / ~$320,692 Celo figures.
- Distinguish Queued/Executing, Reported/checking, receipt-invalid Failed, infrastructure retry, and Oracle-verified. Only the configured Chainlink Functions callback may produce Oracle-verified settlement.
- Do not describe August settlement as limited to a single garden or as gated "sink-first": every focus garden is settlement-capable (one Celo Safe per garden, deployed on demand), Tech and Sun Hub is the planned first execution, and Pass-2 evidence orders the rollout. An in-pool spend sink is an ordering criterion and a circulation aim, not a launch gate. Say "settlement-capable," never "will settle," while the 2026-07-29 settlement gates remain open.
- If the Celo AA/paymaster gate fails, say “member delivery is blocked”; do not imply garden custody, a member claim, or successful delivery.
- Funding in Need context supports the garden; it is not per-Need escrow and does not direct yield.
- Need kinds are Request, Offer, and Initiative. Moderation is none, acknowledged, merged, hidden, or declined; progress is open, committed, in-progress, or addressed. Do not collapse the two axes into a single ranked score.
- Domains are optional arrays. DomainImpact action UIDs are positional arrays, and UID 0 is valid.
- Do not rank communities, gardens, Needs, or people.
- The fourth pilot garden remains described as "in outreach" and is named publicly only once participation is confirmed (owner review 2026-07-11 supersedes decision #27; selection criteria live in the RESR-58 scenario document).
