# Commitment Credit session-prompt correction

Date: 2026-08-10

This is the correction artifact for
`codex-credit-contract-session-prompt-2026-08-08.md`. The dated August 8 prompt is restored to the
contents that existed at the stage-1 merge base and remains an immutable record of what was handed
off at that time. Do not revise or execute that historical prompt as current branch guidance.

## What changed after the original prompt

- Stage 1 merged in PR #694 at `c60b38dea`, and the Commitment Credit implementation moved to
  `feature/build-commitment-crediting-contracts`.
- The legal/operations gate accepted the interest-free, records-only posture.
- The implemented settlement surface added deployment-identity events, live-route acknowledgment
  checks plus stranded-subject recovery, and steward authority for priced Offer claims.
- `DisbursementKind` remained ordered as contributor consideration, funding, loan principal, and
  garden beneficiary. The credit increment then implemented the dedicated loan-principal seam
  without changing the pooling ABI or introducing custody.
- Review fixes closed cross-rail recording, source Safe uniqueness, credit-registry pause,
  rejection-cause, and ERC-7201 layout-protection findings. The follow-up route review additionally
  requires an existing previous-peer grace to drain or expire before another rotation can replace
  the active peer.

## Current execution truth and closure evidence

The maintained sources are the Commitment Credit [spec](../../commitment-credit-follow-on/spec.md),
[coverage ledger](../../commitment-credit-follow-on/coverage-ledger.md),
[contracts handoff](../../commitment-credit-follow-on/handoffs/codex-contracts.md), and
[status](../../commitment-credit-follow-on/status.json). They carry the current selectors, gates,
test evidence, review pins, known deferred constraints, and stage-3 boundary.

The former indexer test-helper blocker was resolved in `1fbb6c1cd`; local indexer boundary, lint,
203 tests, code generation, and TypeScript build passed, as did the refreshed remote Indexer job.
No deployment, broadcast, live configuration, authority transfer, value movement, or Linear write
is authorized or recorded by this correction.
