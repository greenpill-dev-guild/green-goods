# Community Needs & Commitment Pooling: Research and Onboarding Plan

**Feature Slug**: `community-interface`  
**Stage**: `active`  
**Updated**: 2026-07-11  
**Canonical synthesis**: the project document “Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building” and its attached revised Markdown source. Research instruments interpret that synthesis; they do not silently replace it.

## Research outcomes

Before product onboarding begins, the team needs evidence for six decisions:

1. **Seeding go/no-go per garden** — an operator-corrected, explicitly confirmed mandate artifact each garden recognizes as its own plan; decides which gardens enter operator-curated seeding 2026-08-31 (published 2026-07-31 as the readiness matrix with explicit gaps).
2. **Ship-or-revise the needs vocabulary** — whether `NeedKind` (Request/Offer/Initiative), the mandatory need→desired-outcome pairing, the horizon chips, and the stage-of-clarity language carry each garden's reality without distortion; decides schema and creation-flow copy changes before the September community app (the survey's "Other"/misfit answers are the architecture-gap instrument).
3. **Which commitment units seed Cycle 1** — which action-registry units fit, what garden-named work is missing from the registry, and the capacity and support bounds around them; decides the content and scale of the operator-curated seed rows.
4. **Whether mutual credit earns a design lane** — existing member-to-member exchange patterns plus lightly captured credit terms (unit/token, borrower cap, repayment window, forgiveness policy); decides whether borrow-and-repay stays evidence-gated or advances, and what lands in `termsCID` if it does.
5. **What anchors measurement** — what each garden already tracks, wants to track, and must report to funders (UNICEF cadence; existing MRV methodology); decides the assessment templates, metric sets, and baseline authorship that make baseline→delta credible enough to aggregate into impact certificates (absorbs canceled RESR-53).
6. **G$ rollout order** — per-garden settlement relevance now and a real local circulation path; decides the August settlement order after the Tech and Sun Hub first-execution hypothesis, and the circulation support each garden needs.

Coordination-channel and join-flow observations feed RESR-64 (join-request persistence decision, below) — not an outcome of the survey itself.

## Cohort and readiness

The cohort is not presumed. Named focus candidates are Tech and Sun Hub (Awka, Nigeria — English), Greenpill Cape Town (Muizenberg / Deep South Circles — English; UNICEF-funded trash-bin/waste-cleanup program; showcase folded in from canceled RESR-53), and AgroforestDAO / Redemption Hill (Bias Fortes, Brazil — Portuguese), plus a fourth garden — in outreach, named only once participation is confirmed — for the mature MRV-adoption slot selected against the RESR-58 criteria. Naming a candidate does not presume readiness. RESR-62 owns confirmation with each candidate garden. A garden enters fielding only when all are named:

- operator contact and backup contact;
- preferred language and accessible interview format;
- community consent path for notes/audio/photos;
- likely gathering date or remote session;
- one plausible need/offer/initiative and one commitment candidate;
- whether G$ settlement is relevant for this garden now;
- interviewer, note-taker, and follow-up owner.

## Instrument: two passes, survey-first

Pass 1 is a self-serve survey; Pass 2 is an action-oriented onboarding call. The instrument files in this folder are the execution source; the Linear documents mirror them 1:1.

### Pass 1 — self-serve survey (`survey-instrument.md`)

A Google Forms build sheet (Linear mirror slug `c9271149e328`): six sections — welcome & garden, needs, promises & capacity & exchange, measurement with UNICEF and methodology branches, working together & consent, close — 45 questions on the main path, ~69% closed with "Other" escapes, 18–24 minutes, English master with PT/ES translation as a per-garden fielding gate. All seven legacy warm-context questions survive (open, or closed with an Other escape). The former garden-specific Pass-1 supplements (Greenpill Cape Town's UNICEF reporting; the MRV-adoption slot's methodology and baseline authorship) are now the 4A/4B conditional branches. Voice stays optional, never required.

### Pass 2 — onboarding call (`onboarding-call.md`)

A facilitator guide (Linear mirror slug `d3690de04864`): pre-call synthesis of survey responses into draft mandate rows sent ahead labeled DRAFT; a timed 45–60 minute action agenda; the mandate confirmation checklist (exact unit and quantity; who provides and who benefits; open or steward-reviewed participation; honest evidence and any baseline/delta requirement; named confirmation group and threshold; due date or cycle boundary; declared reward, source, token, and amount — July is Cookie Jar/treasury only; linked Need and zero or more domains; operator read-back: “Is this what you meant?”); G$ incentive talking points; the first-Season timeline; and post-call steps. The former "Locked implementation prompts" live there as Appendix A.

The operator receives the mandate artifact and must explicitly correct or confirm it. The team records unresolved interpretation as unresolved; it does not infer certainty.

## Privacy and consent

- Explain what is public/on-chain, what stays in research notes, and what is deleted.
- Obtain separate consent for recording audio, retaining transcripts, and using quotations externally.
- Never put grievances naming individuals, wallet addresses, join-request identities, or contact details into Linear, PostHog, or public artifacts.
- Store only enumerated/boolean research metadata in analytics.
- Offer a no-recording path and allow participants to retract research notes before synthesis.

## Join-request persistence decision — RESR-64, due 2026-08-12

RESR-64's assignee is the accountable decision owner; the Product owner accepts the final operating model. No implementation choice is locked. Evaluate these options with operators before PRD-691 is dispatchable for the membership queue slice. The durable output is the **Community Needs & Signals engagement-model document linked from RESR-64**, then mirrored into the membership-queue handoff and this hub.

| Option | Strength | Cost/risk | Evidence needed |
|---|---|---|---|
| Minimal encrypted service queue, garden-scoped | Shared operator handoff; asynchronous; supports status | New personal-data store, retention/deletion and auth burden | Who operates it, retention period, breach boundary, offline submission behavior |
| Gathering-session handoff, device-to-operator | Little durable personal data; strong in-person context | Weak for remote/asynchronous joins; session loss risk | Can every pilot join happen with an operator present? How are retries recovered? |
| Signed request/invitation payload retained by member until redeemed | User custody; portable; less central PII | More complex recovery, expiry, and multi-operator review | Can nontechnical members recover the payload? How does batch review work? |

Rejected for v1: public on-chain join requests, Linear-as-queue, and implicit localStorage transport. They expose personal intent, cross trust boundaries, or cannot support shared operator handoff and recovery. `waiting_for_hat` may persist the pending Need/Signal/Testimony payload, but never substitutes for the join-request transport.

Decision exit criteria:

- operator can review and hand off requests;
- member can understand waiting, approval, and deletion;
- offline and retry behavior is testable;
- controller and processor, authentication/authorization, encrypted fields, access, retention, deletion, and breach/incident owner are written;
- cancellation, device loss, duplicate request, rejection, expiry, retry, and multi-operator recovery are rehearsed;
- abuse controls, expected operating cost, service owner, and operator support path are accepted;
- threat/abuse review and operator sign-off are complete before implementation.

The decision record must say why the selected option won, why the other two were rejected for the pilot, the date it must be revisited, and the exact evidence that changes `status.json.execution_sub_lanes.membership_queue.manual_blocked` to false.

## Schedule grounded in Linear

| Linear window | Research/engagement outcome | Product consequence |
|---|---|---|
| Product current cycle, through 2026-07-16 | Begin operator outreach, consent script, and facilitation kit; do not claim cohort completion | Outreach underway; PRD-701 kickoff package due 2026-07-30 |
| Product Commitment Pooling cycle, 2026-07-16 to 2026-07-30; Research alignment cycle through 2026-07-30 | Run the two-pass instrument, return mandate drafts for confirmation, test `NeedKind`/domain language, and evaluate join-request options | Architecture and seed rows can be corrected before the July checkpoint |
| July dry-run milestone, 2026-07-31 | Publish confirmed mandate artifacts and a readiness matrix with gaps; no garden marked ready without operator confirmation | Go/no-go input for August seeding, not a promise that every garden onboards |
| August release milestone, 2026-08-31 | Pair implementation reviews with participating operators; rehearse one end-to-end commitment and, where relevant, one G$ settlement on Celo | Release evidence and operator runbook |
| RESR-64 decision, 2026-08-12 | Publish and link the engagement-model decision with controller/auth/retention/deletion/recovery/abuse/cost/owner evidence | Only then may the membership-queue handoff become dispatchable |
| September needs-app milestone, 2026-09-30 | Usability and gathering rehearsal for board, creation, triage, decision-gated membership, and promise-work-proof thread | Community interface acceptance |
| Post-pilot hardening, 2026-12-31 | Review participation, attribution verification, membership burden, and operator capacity | Promote or decline PRD-695/696 based on evidence |

## Operator engagement kit

The survey build sheet and call guide in this folder own the facilitator script, consent language, and mandate worksheet items below.

- one-page “what commitment pooling changes / does not change” brief;
- 10-minute recorded walkthrough with captions and transcript;
- facilitator script and consent language;
- mandate worksheet with examples, not protocol fields;
- office-hours/onboarding call option;
- named support contact and response expectation;
- follow-up summary returned to the operator for correction;
- change log showing what research changed in the product plan.

## Synthesis format

For each garden, publish an internal readiness row:

| Field | Rule |
|---|---|
| Participation | confirmed / invited / unavailable; never infer readiness |
| Need examples | Request, Offer, or Initiative in the community’s language |
| Commitment rows | confirmed vs draft clearly separated |
| Domains | optional array; empty is valid |
| Evidence/confirmation | named and feasible |
| G$ settlement | relevant now / later / not discussed; Celo only for Green Goods settlement |
| Local circulation | known sink/use case, unknown, or not applicable |
| Open decisions | owner and next review point |

No cross-garden leaderboard, readiness score, or false completeness percentage.
