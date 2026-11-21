# Commitment Pooling — Settlement Evidence Definition Handoff

## Status

- Execution sub-lane: `settlement_evidence`
- Machine lane: none; human-owned definition and evidence surface
- Accountable owner: Afolabi Aiyeloja
- Current state: structural design approved; blocked on operational assignments through the September 30 operational checkpoint
- Linear target: reread and update the existing thin issue COM-11 under PRD-650 (formerly Product PRD-735; moved to the Community team 2026-07-24); do not create a duplicate or add an `agent:*` label

## Inputs

- Current settlement and Community evidence models, including Dispatched/executed-acknowledgment-pending/Confirmed distinctions.
- The approved operating structure in `../pilot-evidence-spec.md`: same-garden cycle comparison, claim-specific source hierarchy, two-key decision gate, independent qualitative method, layered safeguarding/repair, three privacy tiers, reproducible first-cycle process, and separated approval rights.
- Named access and evidence owners plus an exact approved source/export for each claim.
- Green Goods' Linear privacy boundary: aggregates, error text/hashes, and counts may be recorded; replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers may not.
- A dated garden worksheet naming the cohort, commitment class, baseline/history source, primary measure, meaningful-change threshold, warning bounds, denominator, and comparison window.
- Named qualitative, safeguarding, privacy, repair, reproducibility, and publication owners plus their approved storage, retention, response, escalation, and conflict-backup records.
- The approved first-cycle boundary: a reproducible operational evidence process with no productized pipeline or expanded Celo/Envio tracking.

## Outputs

- The approved, dated `../pilot-evidence-spec.md` plus completed operational-assignment and garden-threshold worksheets.
- A source-to-field table naming provenance, refresh cadence, owner, and proof limit.
- A privacy and suppression table identifying allowed aggregates, prohibited identifiers, and minimum publication thresholds.
- A September 30 evidence packet with every claim linked to current primary evidence.

## Proof limit

- This lane does not prove that value arrived merely because a command was dispatched or Celo execution was indexed.
- Only an authenticated success acknowledgment for the subject's current execution key and
  attempt can support a Confirmed settlement claim.
- Product telemetry and available refusal/dispute controls cannot prove that coercion, retaliation, or hidden burden was absent; those findings require the approved confidential qualitative and safeguarding process.
- Aggregate improvement cannot support a strengthened-capacity claim while an unresolved exposure, concentration, repair, circulation-integrity, or privacy stop condition applies.
- Missing source access, an unavailable partner confirmation, or a cohort below the approved threshold remains a blocker and is reported as unavailable evidence, never inferred success.
- No fourth-garden candidate identity may appear in this handoff, its Linear mirror, or its evidence packet.

## Acceptance

- The structural decisions in `../pilot-evidence-spec.md` §1.1 remain fixed, and every operational assignment in §10.3 is dated before outcome interpretation.
- Every distributable claim names a current primary source, observation date, evidence owner, and proof limit.
- Any statement that pooling strengthened settlement capacity satisfies the claim gate in `../pilot-evidence-spec.md` §2; wider causal impact remains out of scope.
- The September 30 packet distinguishes Dispatched, executed/acknowledgment-pending, and Confirmed settlement and distinguishes unavailable, suppressed, mixed, and zero results.
- The packet reports coercion, exposure, concentration, repair, and privacy review outcomes without exposing participant-level source material.
- Repository, thin Linear mirror, and canonical Google Doc agree after live rereads; an unavailable surface keeps the lane blocked.

## Exact Bun commands

No implementation command is authorized while this lane is blocked. After the operational
assignments and data-access records are locked, the human owner must replace this sentence with
the smallest exact read-only evidence-reproduction command before dispatch.

## Unblock evidence

- Each claim has a named access owner, evidence owner, exact source/export, cadence, observation date, and proof limit.
- Each garden has a recorded cohort, comparable commitment class, baseline/history source, primary measure, secondary measures, denominator/window, and dated meaningful-change and warning thresholds.
- The qualitative interviewer(s), language, schedule, consent instrument, response log, storage, and retention are named.
- The safeguarding reviewer and independent backup, confidential bypass channel, response clock, repair/escalation path, and sign-off authority are named.
- The privacy owner, research publication threshold, exact retention/deletion rules, and incident response are recorded.
- The packet owner, reproducibility reviewer, calculation artifact, private safeguarding store, and publication owners are named.
- Thresholds and stop conditions are dated before outcome interpretation; any retrospective choice is labeled exploratory.
- The thin Community issue (COM-11) exists under PRD-650, has a September 30 due date, and has no `agent:*` label.
- The repository and live Linear issue are reread after the update and agree.

## Out of scope

- Product implementation, wallet/session identifiers or confidential safeguarding material in Linear, autonomous partner outreach, a release broadcast, settlement confirmation by a human, causal livelihood/community-wide impact claims, participant scoring/ranking, or any claim that unavailable evidence passed.

## Machine reconciliation, 21 November 2026

What the indexed record can and cannot say for the operating pilot. Read on 21 November 2026 with
the passport reader (`getPublicGardenPassport` in Shared, PRD-1097) against the hosted indexer.
Garden-level counts only: no account, recipient or contributor appears. The registered rehearsal
cycle (pool 1, cycle 1) is excluded, with the payments that followed it. This section does not
unblock the lane; the human assignments above are still required.

| Pool | Promises taken up | Kept | Kept with a declared G$ payment and no payment plan | Payment plans | Member payments confirmed, awaited, failed | G$ confirmed to the garden |
|---|---|---|---|---|---|---|
| 1 (protocol) | 0 | 0 | 0 | 0 | 0, 0, 0 | none |
| 2 | 10 | 2 | 0 | 0 | 0, 0, 0 | 1 payment, 1 G$ |
| 3 | 24 | 1 | 1 | 0 | 0, 0, 0 | 2 payments, 7,200,000 G$ |

Recognition policy as each open season froze it: 20% equal participation and 80% verified
contribution in all three pools (`equalParticipationBps` 2000, `verifiedContributionBps` 8000 on
the indexed cycle). The policy is read from the cycle, not assumed.

What the record establishes:

- Commitment state changed: the promise counts above are indexed contract events.
- Settlement confirmed, for the garden-level funding only: each of the three G$ payments reached
  `CONFIRMED`, which the indexer sets only on the authenticated Celo acknowledgment.

What is missing, stated instead of inferred:

- No payment plan exists in any pool. There is no hash-bound recognition or payment snapshot to
  preserve, and no contributor attribution to trace to approved evidence.
- No member payment was queued, sent, confirmed or failed. The zeros mean nothing was attempted,
  not that every payment succeeded.
- Pool 3 has one kept promise that declares a G$ payment and has no payment plan. It is declared,
  not paid. Twenty-one more promises there wait for confirmation with the same declared payment.
- No plan was revised, so no before-and-after repair record exists on the chain. A repair made
  off-chain would need its own reasoned record from the lane owner.
- Group attribution, eligibility and the qualitative, safeguarding and privacy reviews are not in
  the indexer at all. They stay with the named owners this lane still needs.

Proof limit: this is the machine half of the reconciliation. It cannot show that value reached a
member, and it must not be cited as the September evidence packet.

Reproduce: `getPublicGardenPassport(42161, <garden>)` returns `settlement.keptAwaitingPaymentPlan`,
`settlement.support` and `settlement.memberPayments`; the reader's tests are in
`packages/shared/src/__tests__/commitment-public-passport.test.ts`.
