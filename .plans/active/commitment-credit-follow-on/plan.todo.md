# Commitment Credit — August Companion Plan

**Feature Slug**: `commitment-credit-follow-on`
**Stage**: `active`
**Status**: `STATE/API REVIEW FOLLOW-UP IN PROGRESS — UI AND RELEASE OPERATIONS REMAIN`
**Last Updated**: `2026-08-18`

## Promotion record and remaining dispatch gates

1. [x] Explicit scope unlock — granted 2026-08-01 by Afo (Grassroots Economics review session; pooling plan register #73). Hub promoted backlog → active; builds in the same August wave as Commitment Pooling as an additive companion chain with zero pooling-module/register changes.
2. [x] Product-evidence decision — gardens already running mutual credit by hand (spec.md §11) plus the build-once-then-pilot posture justify the dedicated register now.
3. [x] Settlement seam — locked to option (a), `DisbursementKind.LoanPrincipal` (spec.md §5; settlement-spec 2026-08-01 amendment).
4. [x] **Dispatch gate**: Commitment Pooling and settlement foundations merged to `develop` in PR #694 at `c60b38dea`; branch interface hardening verified at `238e4e218`.
5. [x] **Dispatch gate**: [spec.md](spec.md) revalidated against the implemented interfaces on 2026-08-09. The exact settlement selector, relationship, storage, event, and error consequences are frozen in [coverage-ledger.md](coverage-ledger.md).
6. [x] **Dispatch gate**: Afo approved the interest-free, records-only legal/operations posture on 2026-08-09.
7. [x] PRD-697 updated in Linear 2026-08-01: Todo, Medium, dispatch gates in the body; the fresh-executable-issue clause superseded. Validation commands still join the contracts handoff at dispatch.
8. [x] Stage-2 contracts merged in PR #695 at `bff3b274d`; the merge is an ancestor of the
   Phase A base `7a9c7ee`.

## Stage-2 implementation order

1. [x] Record focused RED proof for the exact credit interface and settlement seam.
2. [x] Implement `ICreditRegistry`, `CreditRegistry`, and the library-weighted `queueLoanPrincipal(uint256)` seam.
3. [x] Prove storage/upgrade safety, adversarial behavior, fuzz/invariants, size, full contracts tests, and the read-only fork lane.
4. [x] Conduct a final adversarial review of the committed stage-2 range and stop for human review/merge.
5. [x] Resolve the independent review's cross-rail double-payment finding and source Safe identity dependency; rerun the focused, full, audit, size, storage, and read-only fork gates.
6. [x] Resolve the follow-up review comments, sweep the same defect classes, and rerun fresh proof:
	   `CreditSettlement.t.sol` 25/25, `SettlementSecurity.t.sol` 22/22,
	   `CreditRegistry.t.sol` 31/31, source route tests 21/21, executor security tests 24/24,
	   1,975 Solidity tests, 104 script tests, 7/7 fork tests, build, lint, size, linear storage,
	   both ERC-7201 namespace layouts, and the nested loan-relationship value schema.

The prompt-mandated contracts gates are green. The former indexer helper blocker is resolved in
`1fbb6c1cd`: the three settlement event helpers and lifecycle fixture now pass the indexer boundary,
lint, all 203 indexer tests, code generation, and TypeScript build locally, and the refreshed remote
Indexer Lint And Build job is green. The root `bun run test` target was then rerun outside the
restricted sandbox so Foundry could read macOS proxy state; it passed across the monorepo. The prior
proxy initialization abort and indexer helper drift are no longer active Ship Gate gaps.

## State/API implementation

1. [x] Freeze the Credit lifecycle, viewer, rail, pause/pool, installment/time, delivery-order,
   recovery, settlement-relationship, and unsupported-G$ behavior matrix before production code.
2. [x] Record focused RED for the missing Envio `CreditRegistry` surface and shared Credit API.
3. [x] Implement the canonical chain-scoped `Loan`, `LoanEvent`, and `CreditPoolStats` projections,
   dynamic registry relationship, settlement join, replay/order convergence, and O(1) integer
   aggregate accounting.
4. [x] Implement and publicly export shared Credit types, centralized query keys, chain-scoped
   queries, viewer-aware and aggregate-only selectors, invalidation, and online-only mutations.
5. [x] Prove the source snapshot at `c070d20822a862ee09df486e5769c7966e86418f`: focused Credit
   suites, full indexer, package builds/typechecks/story guards, the complete checkpoint, ontology,
   vocabulary, and Plan Hub validation are GREEN.
6. [x] Close the review-requested disclosure boundary so personal hook returns expose only the
   viewer-gated `loan`/`loans` fields and never TanStack's raw `data` payload.
7. [x] Add discriminating Credit coverage: every frozen event handler, hard-state and installment/time
   boundaries, paused/non-open read availability, viewer-role transitions, zero-address mutation
   rejection, relationship queries, cache invalidation, and blocked validation semantics.
8. [x] Record whether a real-contract/Envio E2E is applicable and run it when the local fork, Docker,
   deployed Credit address, and required authority facts are available; never replace missing release
   authority with fabricated production state.
9. [x] Document that static CreditRegistry pinning must start at or before its deployment block because
   dynamic SettlementModule registration cannot recover initialization-era events.
10. [x] Refresh package, cross-package, ontology, vocabulary, Plan Hub, and TDD receipts at the tested
    remediation commit before returning PRD-786 to In Review.
11. [ ] PRD-787 owns all client/admin UI. No UI source was changed in this lane.
12. [ ] Deployment, address pinning, broadcast, post-deploy replay, QA, and release operations remain
   outside PRD-786.
13. [x] Add direct shared read-boundary characterization for all four Credit GraphQL queries,
    including chain/pool/borrower predicates and scalar-to-domain mapping.
14. [x] Add an explicit PRD-722-owned CreditRegistry static-pin allowance that expires 2026-08-31
    and fails on expiry or configured/deployed address drift.
15. [ ] Refresh the complete checkpoint receipt. Focused Credit proof is GREEN, but the current
    local-fork E2E is sandbox-blocked, the checkpoint stopped on one unrelated admin test that
    passed in isolation, and the branch-wide test-quality guard reports 28 pre-existing expired
    Playwright skip dates.

## Stage-3 boundary

The contracts increment has merged. The separately authorized Phase A release-engineering lane now
owns every deploy target, `DeploymentResult`/artifact and recovery path, Safe/Zodiac plan, courier,
configuration plan, and post-deploy command. It may prepare but may not execute the broadcast
ceremony. None of those were prerequisites or outputs of stage 2.
