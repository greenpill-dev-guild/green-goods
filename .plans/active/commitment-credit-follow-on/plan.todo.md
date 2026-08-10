# Commitment Credit — August Companion Plan

**Feature Slug**: `commitment-credit-follow-on`
**Stage**: `active`
**Status**: `CONTRACTS MERGE-READY — human review and merge pending`
**Last Updated**: `2026-08-09`

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

The prompt-mandated contracts gates are green. The deterministic root build separately exposes an
indexer test-helper type error in `packages/indexer/test/settlement-lifecycle.test.ts`: the generated
test API does not expose three settlement event helpers used by the test. This contracts-only stage
does not edit that indexer surface. A final concurrent root-test rerun was also interrupted by a
Foundry macOS system-proxy crash; the independent contracts target is fresh and green. These block
a whole-branch Ship Gate claim, not the stage-2 contracts verdict.

## Stage-3 boundary

After this contracts increment merges, a separate authorized stage owns every deploy target, `DeploymentResult`/artifact and recovery path, Safe/Zodiac setup, courier, live configuration, post-deploy command, and broadcast ceremony. None of those are prerequisites or outputs of stage 2.
