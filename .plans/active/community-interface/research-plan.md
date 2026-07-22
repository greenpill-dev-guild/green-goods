# Community Needs & Commitment Pooling: Research and Onboarding Plan

**Feature Slug**: `community-interface`  
**Stage**: `active`  
**Updated**: 2026-07-19  
**Canonical synthesis**: the project document “Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building” and its attached revised Markdown source. Research instruments interpret that synthesis; they do not silently replace it.

## Research outcomes

Before product onboarding begins, the team needs evidence for six decisions:

1. **Seeding go/no-go per garden** — an operator-corrected, explicitly confirmed mandate artifact each garden recognizes as its own plan; decides which gardens enter operator-curated seeding 2026-08-31 (published 2026-07-31 as the readiness matrix with explicit gaps).
2. **Validate the locked vocabulary in context** — a Need is a problem the community wants to address, paired with a mandatory desired outcome; **commitment direction** (help asked for versus help given) belongs in Section 3. The 2026-07-21 product decision removed `NeedKind` from the schema and creation flow before EAS registration. Sessions now test comprehension, translation, and horizon language without reopening the layer boundary unless evidence shows a serious problem.
3. **Which commitment units seed Cycle 1** — which action-registry units fit, what garden-named work is missing from the registry, and the capacity and support bounds around them; decides the content and scale of the operator-curated seed rows.
4. **Whether mutual credit earns a design lane** — existing member-to-member exchange patterns plus lightly captured credit terms (unit/token, borrower cap, repayment window, forgiveness policy); decides whether borrow-and-repay stays evidence-gated or advances, and what lands in `termsCID` if it does.
5. **What anchors measurement** — what each garden already tracks, wants to track, and must report to funders (UNICEF cadence; existing MRV methodology); decides the assessment templates, metric sets, and baseline authorship that make baseline→delta credible enough to aggregate into impact certificates (absorbs canceled RESR-53).
6. **G$ rollout order** — per-garden settlement relevance now and a real local circulation path; decides the August settlement order after the Tech and Sun Hub first-execution hypothesis, and the circulation support each garden needs.

Coordination-channel and join-flow observations feed RESR-64 (join-request persistence decision, below) — not an outcome of the survey itself.

## Cohort and readiness

The cohort is not presumed. Three confirmed candidate gardens: Tech and Sun Hub (Awka, Nigeria — English), Greenpill Cape Town (Muizenberg / Deep South Circles — English; UNICEF-funded trash-bin/waste-cleanup program; showcase folded in from canceled RESR-53), and AgroforestDAO / Redemption Hill (Bias Fortes, Brazil — Portuguese). Between them they cover all four action domains. A **fourth slot stays open** for a mature MRV-adoption anchor: candidates are under consideration, none is selected, and no artifact names one (commitment-pooling Decision Log #29, 2026-07-18). Naming a candidate does not presume readiness. COM-7 (renumbered from RESR-62 when it moved to the Community team, 2026-07-19) owns confirmation with each candidate garden. A garden enters fielding only when all are named:

- operator contact and backup contact;
- preferred language and accessible format (the onboarding call itself runs in English);
- community consent path for notes and any call recording;
- likely gathering date or remote session;
- one plausible need and one commitment candidate;
- whether G$ rewards are relevant for this garden now;
- interviewer, note-taker, and follow-up owner.

## Instrument: two passes, survey-first

Pass 1 is a self-serve survey; Pass 2 is an action-oriented onboarding call.

**Direction of truth**: both instruments are **canonical in Linear**. The files in this folder are pointers, not copies — correct an instrument in its Linear document, and never paste a body back into this repo.

Two reasons, in order. **This repository is public**, and these instruments carry cohort detail, partner context, and the support contact gardens are told to use for retraction; none of that belongs in a world-readable artifact. And the previous arrangement kept a full second copy here under a "keep the mirror in lockstep" rule that read bidirectionally, had no automation behind it, and had already drifted — both mirrors still carried a superseded issue ID days after the rename. One home removes the failure mode rather than policing it. The Commitment Pooling source map in `commitment-pooling/external-brief.md` now formalizes the same rule: a claim has exactly one home, and the other surfaces link to it rather than restating it.

What stays in this repo is the **routing contract** — where a call's outputs get recorded, since those destinations are files here: the readiness row uses § Synthesis format below, corrections go to `corrections-log.md`, gap-log items go to architecture review. The pointer files carry that and nothing else.

### Pass 1 — self-serve survey ([Garden Survey (Pass 1)](https://linear.app/greenpill-dev-guild/document/garden-survey-pass-1-needs-commitments-and-methodologies-c9271149e328))

A paste-ready Google Forms build sheet, canonical in Linear (slug `c9271149e328`): five sections plus one generalized funder/programme branch — your garden, what your community is trying to solve, commitments & capacity & exchange, what you already measure, wrapping up — **49 items on the main path** (+6 in the branch), 20–26 minutes, English master with Portuguese required for Bias Fortes; the onboarding call runs in English. Every question is a block carrying its Forms type, question text, description, and fenced option list so it copies straight into the Form.

**Section 2 is about needs only.** A need is framed as something the community is trying to solve, never as a direction of help: the section takes the whole list in their own words (2.1), outcome and horizon for the two or three that matter most (2.2), how the needs relate to each other (2.3), and then diagnosis across the set — kinds of better, causes, who feels them, how the situation feels, and where the garden is heading in two or three years. Nothing narrows to a single need. **Request and Offer live in Section 3 as commitment direction (3.7)**, because that is the layer where the distinction sets who confirms a commitment was kept; this corrects a conflation in which `NeedKind` and `CommitmentDirection` carried the same vocabulary at two layers.

Section 3's work grids are generated from the **live action registry** (`packages/contracts/config/actions.json`, 23 actions across SOLAR/AGRO/EDU/WASTE), so registry fit is measured against what the product actually records. Three questions use multiple-choice grids as ranking questions, since Forms has no native ranking type. Section media use existing assets only, all under `.plans/active/commitment-pooling/artifacts/visuals/` plus the docs illustrations, product screenshots, and the Loom walkthrough, with a Grassroots Economics explainer placeholder.

### Pass 2 — onboarding call ([Garden Onboarding Call (Pass 2)](https://linear.app/greenpill-dev-guild/document/garden-onboarding-call-pass-2-mandate-confirmation-and-first-season-d3690de04864))

A facilitator guide, canonical in Linear (slug `d3690de04864`): **Appendix B is a runnable synthesis prompt** producing seven artifacts — the needs board, the garden's theory of change in its own words, **one** draft mandate row (not three; the form cannot honestly source more), the onboarding roster as counts and roles, the readiness row, the gap log, and the call's open questions. Pre-call prep reviews that output rather than starting from a blank page, and the needs board, theory-of-change paragraph, and draft row go to the steward ahead of the call labelled DRAFT.

The guide is ordered by when each part is used: an at-a-glance summary, pre-call prep, the guardrails (the former "Locked implementation prompts", read before every call), the eight-block agenda in Goal/Cover/Prompts/Output form including a dedicated platform-onboarding block, then the reference cards a facilitator reaches for mid-call — mandate confirmation checklist, G$ reward-layer talking points, first-Season timeline — and post-call steps. Survey question numbers are glossed inline so the guide can be run without the survey open. The eight blocks sum to exactly 60 minutes, so the guide tells facilitators to book 75. Calls run in English; gardens book their own slot through a calendar link in the survey, and the last call is held 07-28 so the 48-hour confirmation loop closes before the 07-31 publication.

The operator receives the mandate artifact and must explicitly correct or confirm it. The team records unresolved interpretation as unresolved; it does not infer certainty.

## Privacy and consent

- Explain what is public/on-chain, what stays in research notes, and what is deleted.
- Obtain separate consent for recording audio, retaining transcripts, and using quotations externally.
- Never put grievances naming individuals, wallet addresses, join-request identities, or contact details into Linear, PostHog, or public artifacts.
- Store only enumerated/boolean research metadata in analytics.
- Offer a no-recording path and allow participants to retract research notes before synthesis.

## Join-request operating gate — RESR-64, due 2026-08-12

The architecture is selected: a **minimal encrypted, garden-scoped service queue**. A passkey account signs its request; the agent stores only the garden, encrypted account/name/note/reason fields, keyed lookup digests, lifecycle timestamps, and state; an authorized operator reads the queue in the existing Garden Manage Members dialog and uses the existing gardener-add transaction. The canonical product/technical shape — including proposed retention, signature, and abuse defaults — is `join-queue-spec.md`. The Product owner still accepts the operating model before PRD-691 is dispatchable; this is not permission to start storing personal data before the remaining evidence is accepted.

| Selected direction | Why it fits the pilot | Operating evidence still required |
|---|---|---|
| Minimal encrypted service queue, garden-scoped | Shared operator handoff, asynchronous review, member-visible outcome, and no new on-chain permission surface | Controller/processor, encryption/key owner, retention/deletion, EIP-6492/RPC operator, account recovery, access, abuse controls, cost, incident owner, and support path |

Not selected for v1: gathering-session-only handoff (cannot reliably support remote/asynchronous joins) and member-retained invitation payloads (recovery and multi-operator review add more complexity than the service queue).

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
| Product current cycle, through 2026-07-16 | Begin operator outreach, consent script, and facilitation kit; do not claim cohort completion | Outreach underway; COM-3 kickoff package due 2026-07-30 |
| Product Commitment Pooling cycle, 2026-07-16 to 2026-07-30; Research alignment cycle through 2026-07-30 | Run the two-pass instrument, return mandate drafts for confirmation, test problem/desired-outcome language, commitment direction, and domain language, and evaluate join-request options | Copy, translations, and seed rows can be corrected before the July checkpoint; the Need/commitment layer boundary is already locked |
| July dry-run milestone, 2026-07-31 | Publish confirmed mandate artifacts and a readiness matrix with gaps; no garden marked ready without operator confirmation | Go/no-go input for August seeding, not a promise that every garden onboards |
| August release: Cycle 1 opens **early August**; milestone closes 2026-08-31 | Pair implementation reviews with participating stewards; rehearse one end-to-end commitment and, where relevant, one G$ settlement on Celo | Release evidence and steward runbook |
| RESR-64 decision, 2026-08-12 | Publish and link the engagement-model decision with controller/auth/retention/deletion/recovery/abuse/cost/owner evidence | Only then may the membership-queue handoff become dispatchable |
| September needs app: arrives **early September**; milestone closes 2026-09-30 | Usability and gathering rehearsal for board, creation, triage, decision-gated membership, and promise-work-proof thread | Community interface acceptance |
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
| Need examples | Problems the community wants to address, paired with desired outcomes, in the community’s language |
| Commitment rows | confirmed vs draft clearly separated |
| Domains | optional array; empty is valid |
| Evidence/confirmation | named and feasible |
| G$ settlement | relevant now / later / not discussed; Celo only for Green Goods settlement |
| Local circulation | known sink/use case, unknown, or not applicable |
| Open decisions | owner and next review point |

No cross-garden leaderboard, readiness score, or false completeness percentage.
