# Commitment Credit — August Companion Plan

**Feature Slug**: `commitment-credit-follow-on`
**Stage**: `active`
**Status**: `CONTRACTS MERGE-READY — human review and merge pending`
**Last Updated**: `2026-08-10`

## Promotion record and remaining dispatch gates

1. [x] Explicit scope unlock — granted 2026-08-01 by Afo (Grassroots Economics review session; pooling plan register #73). Hub promoted backlog → active; builds in the same August wave as Commitment Pooling as an additive companion chain with zero pooling-module/register changes.
2. [x] Product-evidence decision — gardens already running mutual credit by hand (spec.md §11) plus the build-once-then-pilot posture justify the dedicated register now.
3. [x] Settlement seam — locked to option (a), `DisbursementKind.LoanPrincipal` (spec.md §5; settlement-spec 2026-08-01 amendment).
4. [x] **Dispatch gate**: Commitment Pooling and settlement foundations merged to `develop` in PR #694 at `c60b38dea`; branch interface hardening verified at `238e4e218`.
5. [x] **Dispatch gate**: [spec.md](spec.md) revalidated against the implemented interfaces on 2026-08-09. The exact settlement selector, relationship, storage, event, and error consequences are frozen in [coverage-ledger.md](coverage-ledger.md).
6. [x] **Dispatch gate**: Afo approved the interest-free, records-only legal/operations posture on 2026-08-09.
7. [x] PRD-697 updated in Linear 2026-08-01: Todo, Medium, dispatch gates in the body; the fresh-executable-issue clause superseded. Validation commands still join the contracts handoff at dispatch.

## Stage-2 implementation order

1. [x] Record focused RED proof for the exact credit interface and settlement seam.
2. [x] Implement `ICreditRegistry`, `CreditRegistry`, and the library-weighted `queueLoanPrincipal(uint256)` seam.
3. [x] Prove storage/upgrade safety, adversarial behavior, fuzz/invariants, size, full contracts tests, and the read-only fork lane.
4. [x] Conduct a final adversarial review of the committed stage-2 range and stop for human review/merge.
5. [x] Resolve the independent review's cross-rail double-payment finding and source Safe identity dependency; rerun the focused, full, audit, size, storage, and read-only fork gates.
6. [x] Resolve the follow-up review comments, sweep the same defect classes, and rerun fresh proof:
	   `CreditSettlement.t.sol` 25/25, `SettlementSecurity.t.sol` 22/22,
	   `CreditRegistry.t.sol` 31/31, source route tests 21/21, executor security tests 24/24,
	   1,975 Solidity tests, 100 script tests, 7/7 fork tests, build, lint, size, linear storage,
	   both ERC-7201 namespace layouts, and the nested loan-relationship value schema.

The prompt-mandated contracts gates are green. The former indexer helper blocker is resolved in
`1fbb6c1cd`: the three settlement event helpers and lifecycle fixture now pass the indexer boundary,
lint, all 203 indexer tests, code generation, and TypeScript build locally, and the refreshed remote
Indexer Lint And Build job is green. The root `bun run test` target was then rerun outside the
restricted sandbox so Foundry could read macOS proxy state; it passed across the monorepo. The prior
proxy initialization abort and indexer helper drift are no longer active Ship Gate gaps.

## Stage-3 boundary

After this contracts increment merges, a separate authorized stage owns every deploy target, `DeploymentResult`/artifact and recovery path, Safe/Zodiac setup, courier, live configuration, post-deploy command, and broadcast ceremony. None of those are prerequisites or outputs of stage 2.
