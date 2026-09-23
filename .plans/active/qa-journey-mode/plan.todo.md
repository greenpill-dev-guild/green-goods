# QA Journey Mode Plan

**Feature Slug**: `qa-journey-mode`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: 2026-09-03
**Last Updated**: 2026-09-03

## Requirements Coverage

| Requirement | Lane | Status |
|---|---|---|
| Author journeys from active catalog IDs | `ui` | ✅ Implemented |
| Render journey, phase, part, role, handoff, and known-gate views | `ui` | ✅ Implemented |
| Preserve Walk default, Priority view, and test-ID persistence | `ui` | ✅ Implemented |
| Reject malformed and structurally empty journeys | `ui` | ✅ Implemented |
| Document the workflow and publish the desktop reference image | `ui` | ✅ Implemented |
| Verify desktop and mobile behavior in authenticated Brave | `ui` | ✅ Observed locally |
| Redeploy and complete a human two-wallet smoke | `qa_pass_1` | ⏳ Pending |
| Re-run production-readiness validation after review fixes | `qa_pass_2` | ⏳ Pending |

## Proof Order

- [x] Validate journey IDs against the active catalog and append-only ledger.
- [x] Exercise ordering, part filters, counts, persistence, accessibility, and known gates in the
  real-page harness.
- [x] Build the QA application and documentation.
- [x] Rehearse the journey at desktop and 375 × 812 mobile dimensions in authenticated Brave.
- [ ] Redeploy the QA application.
- [ ] Complete the service relay with two authenticated tester wallets.
- [ ] Record the deployment and smoke evidence in `handoffs/claude-qa-pass-1.md`.
- [ ] Run the selected production-readiness gate and record its final result.

## Out of Scope

- Contract, settlement, indexer, Admin, and Client behavior changes.
- Changes to QA wallet identity or Blob persistence.
- Product fixes found during the human rehearsal.
