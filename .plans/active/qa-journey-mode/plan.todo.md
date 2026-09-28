# QA Journey Mode Plan

**Feature Slug**: `qa-journey-mode`
**Stage**: `active`
**Status**: `CLOSED — shipped in PR #796 (merged 2026-09-04); the two-wallet smoke was never recorded`
**Created**: 2026-09-03
**Last Updated**: 2026-09-27

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

## Closeout (2026-09-27)

Closed as `closed`. Journey Mode shipped in PR #796 (merged 2026-09-04, `3f735bc7f`). The QA app
deploys from `develop` whenever `packages/qa` changes, and it has changed thirteen times since, so
the deployed app has carried Journey Mode for over three weeks; the redeploy step above happened
without being recorded here.

This closes as `closed` rather than `completed` because neither QA lane ran. The `qa_pass_1` status
note made this hub's smoke depend on the `qa-runs` hub recording its 2026-09-08 smoke, and that
record was never written, so this lane stayed `ready` with nothing left to trigger it. `ui` keeps
its receipt.

Still open:
- The two-wallet service-relay walk → the QA catalog: walk it as a journey in the next open run
  instead of as a lane of this hub.
- The production-readiness gate after the review fixes (`qa_pass_2`) → dropped: a gate pinned to
  the 2026-09-03 review fixes no longer describes the deployed code, which thirteen later changes
  have moved on; each QA-app change is judged by its own push gate and CI.
