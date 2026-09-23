# QA Journey Mode

**Stage**: `active`
**Status**: Implementation complete; redeploy and two-wallet smoke pending
**Approved**: 2026-09-03

## Summary

Journey Mode lets two testers follow one cross-surface service flow in operational order instead
of finding each case separately by product surface. The first journey follows a protocol service
request through Garden delivery, earnings, distribution, and member receipt. The second covers a
direct contribution to a Garden.

## Locked Decisions

1. The service flow is a QA presentation over existing catalog cases, not a second source of test
   truth.
2. Every journey step references an active catalog ID. Existing verdict and note persistence stays
   keyed by test ID and tester wallet.
3. Walk and Priority remain available, with Walk as the default.
4. The service relay can be split between `Protocol & review` and `Garden & member` participants.
5. Known product gaps remain visible and never preselect a verdict. Testers can record Blocked after
   they attempt the step and encounter the gate.

## Boundaries

This work changes the QA application, catalog validation, documentation, and test coverage. It does
not change contracts, settlement, the indexer, Admin, Client, or the QA persistence API. Product
gaps found during rehearsal become QA findings rather than implementation work in this hub.

## Completion Signal

Catalog and ledger validation pass; Journey ordering, part filters, counts, persistence,
accessibility, and known gates pass automated and visible desktop/mobile checks; the deployed QA
application completes a human two-wallet service-relay smoke.
