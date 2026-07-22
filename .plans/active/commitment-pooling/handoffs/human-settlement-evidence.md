# Commitment Pooling — Settlement Evidence Definition Handoff

## Status

- Execution sub-lane: `settlement_evidence`
- Machine lane: none; human-owned definition and evidence surface
- Accountable owner: Afolabi Aiyeloja
- Current state: blocked through the September 30 operational checkpoint
- Linear target: reread and update the existing thin Product issue PRD-735 under PRD-650; do not create a duplicate or add an `agent:*` label

## Inputs

- Current settlement and Community evidence models, including Reported/checking/Oracle-verified distinctions.
- Named primary source systems and a documented access owner for each.
- Green Goods' Linear privacy boundary: aggregates, error text/hashes, and counts may be recorded; replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers may not.
- A human decision on minimum cohort/reporting thresholds and suppression behavior.
- A named implementation package or an explicit decision that this remains an operational report with no product implementation.

## Outputs

- A dated measurement definition covering settlement delivery, verification, failure/retry, and Community evidence delivery.
- A source-to-field table naming provenance, refresh cadence, owner, and proof limit.
- A privacy and suppression table identifying allowed aggregates, prohibited identifiers, and minimum publication thresholds.
- A September 30 evidence packet with every claim linked to current primary evidence.

## Proof limit

- This lane does not prove that value moved merely because a settlement was reported.
- Only the current Chainlink Functions callback can support an Oracle-verified settlement claim.
- Missing source access, an unavailable partner confirmation, or a cohort below the approved threshold remains a blocker and is reported as unavailable evidence, never inferred success.
- No fourth-garden candidate identity may appear in this handoff, its Linear mirror, or its evidence packet.

## Acceptance

- The source-to-field, privacy/suppression, and threshold tables are approved by the accountable human owner.
- Every distributable claim names a current primary source, observation date, evidence owner, and proof limit.
- The September 30 packet distinguishes Reported from Oracle-verified settlement and distinguishes unavailable evidence from a zero result.
- Repository, thin Linear mirror, and canonical Google Doc agree after live rereads; an unavailable surface keeps the lane blocked.

## Exact Bun commands

No implementation command is authorized while this lane is blocked. After the package and data contract are locked, the human owner must replace this sentence with the smallest exact read-only validation command before dispatch.

## Unblock evidence

- Human approval names every source system and access owner.
- Human approval records the privacy boundary and publication thresholds.
- The implementation package or no-code operational owner is explicit.
- The thin Product issue exists under PRD-650, has a September 30 due date, and has no `agent:*` label.
- The repository and live Linear issue are reread after the update and agree.

## Out of scope

- Product implementation, wallet/session identifiers in Linear, autonomous partner outreach, a release broadcast, receipt verification by a human, or any claim that unavailable evidence passed.
