# Commitment Credit contracts coverage ledger

Revalidated: 2026-08-09
Merge base: `c60b38dea`
Interface HEAD: `238e4e218`
Stage: 2 of 3, contracts only

## Frozen selectors

### `ICreditRegistry`

| Selector | Authority | Required proof |
|---|---|---|
| `initialize(address owner, address hatsModule, address commitmentPoolingModule, address settlementModule)` | proxy initializer | every identity non-zero; initializes paused; emits initialization identity before configuration facts; IDs start at 1 |
| `configurePoolCredit(uint256 poolId, uint256 borrowerCap, bool enabled)` | current pool steward or module owner | known pool; ordinary mutation pause gate; exact old/new configuration event |
| `addExecutor(uint256 poolId, address executor)` / `removeExecutor(uint256 poolId, address executor)` | current pool steward or module owner | known pool; non-zero add; idempotent exact bool event; removed executor immediately loses record authority |
| `requestLoan(RequestLoanParams params)` → `uint256 loanId` | self member, or current steward using distinct non-zero `onBehalfOf` | Open/enabled pool; current borrower membership; non-zero token/principal; future non-zero due date; non-empty terms; zero fee; optional commitment exists in same pool; cap; one linked loan; event carries borrower and human requester |
| `approveLoan(uint256 loanId)` | current pool steward or module owner | Requested; approver is not borrower; Open/enabled pool; cap recheck |
| `recordDisbursed(uint256 loanId, LoanRail rail, bytes32 executionRef)` | current steward or registered pool executor | Approved; Open/enabled pool; cap recheck; `rail != None`; Jar/Treasury uses unique non-zero steward-attested reference and no settlement child; G$ derives a Confirmed exact loan child and exact domain-separated reference; increments outstanding once |
| `recordRepayment(uint256 loanId, uint256 amount, bytes32 executionRef)` | current steward or registered pool executor | Disbursed or Defaulted; Jar/Treasury only; positive non-overpayment; unique non-zero reference; exact outstanding conservation; installment count; exact clearance emits Repaid; recovered default stays visible in prior event history |
| `markDefaulted(uint256 loanId, string reasonCID)` | current pool steward or module owner | Disbursed; strictly past due; reason required; allowed while paused |
| `cancelLoan(uint256 loanId, string reasonCID)` | borrower from Requested; steward from Requested or Approved | reason required; never after disbursement; allowed while paused; clears matching commitment link only |
| dependency setters + `setPaused(bool)` | module owner | dependency changes only while paused; zero rejected; unpause requires all dependencies; every change emitted |
| UUPS authorization | module owner | upgrade only while paused; old-layout state survives |
| views | public | `getLoan`, `poolCreditConfig`, `outstandingOf`, `amountDue`, `loanOfCommitment`, `isExecutor`, `loanOfExecutionRef`, dependency and pause getters |

### `ISettlementModule` scoped addition

| Selector/change | Frozen requirement |
|---|---|
| `queueLoanPrincipal(uint256 loanId)` → `uint256 disbursementId` | Current pool steward; configured `creditRegistry`; exact registry↔settlement and pooling identity; Approved loan; Open/enabled pool; cap; active pool-garden Safe; canonical G$; borrower recipient; principal; idempotent relationship |
| `loanPrincipalDisbursementOf(address registry, uint256 loanId)` | Explicit registry domain avoids collisions across a paused dependency replacement |
| `loanPrincipalRelationshipOf(uint256 disbursementId)` | Exact registry+loan relationship for authenticated credit recording; survives batch, dispatch, retry, acknowledgment, stranded failure, requeue, cancellation, and upgrade |
| `setCreditRegistry(address registry)` | Owner, source paused, non-zero, exact old/new event |
| `LoanPrincipalQueued(uint256 disbursementId, address creditRegistry, uint256 loanId)` | Dedicated relationship marker; existing `DisbursementQueued` signature stays unchanged |
| storage | Keep the stage-1 linear layout and generic `Disbursement` tuple unchanged; use the derived ERC-7201 `green.goods.settlement.loan` namespace for registry configuration, registry+loan reverse lookup, and disbursement relationship; prove namespace continuity through a real UUPS upgrade |
| executor | Accept exact `DisbursementKind` ordinal 2 through the existing bounded G$ path; beneficiary/funding Safe-recipient gates remain unchanged |

## Frozen types and ordinals

- `LoanState`: `None` 0, `Requested` 1, `Approved` 2, `Disbursed` 3, `Repaid` 4, `Defaulted` 5, `Cancelled` 6.
- `LoanRail`: `None` 0, `Jar` 1, `Treasury` 2, `GDollarSettlement` 3.
- `DisbursementKind` stays `ContributorConsideration` 0, `Funding` 1, `LoanPrincipal` 2, `GardenBeneficiary` 3.
- `FailureCode.SourceStranded` stays appended at 12; executor-sent ordinals remain 0–11.
- `Repaying` remains derived when a non-defaulted Disbursed loan has `0 < repaidAmount < principal + feeAmount`; it is not a hard state.

## Storage ledger

`CreditRegistry` declares 11 custom entries and a 39-slot gap: three dependencies, `nextLoanId`, five domain mappings (`loans`, pool configuration, borrower outstanding, commitment link, executors), the execution-reference replay mapping, and `paused`. The total is exactly 50 custom entries; inherited upgradeable layouts remain independent.

## Event and error coverage

Events cover initialization identity; dependency and pause changes; pool configuration; executor changes; request, approval, disbursement, installment, exact repayment, default, and cancellation; and the settlement loan relationship. Custom errors cover zero/unknown identities, pause/readiness, membership/steward/recorder authority, on-behalf confusion, self-approval, pool/open/enabled state, cap, commitment mismatch/duplicate, terms/token/principal/due-date validity, loan state, rail, settlement relationship/confirmation, G$ repayment disablement, zero/replayed reference, zero/overpayment, due date, cancellation state, and reason requirements.

## Adversarial coverage map

| Risk | Proof target |
|---|---|
| Self approval / on-behalf confusion | self path, steward distinct-member path, non-steward and self-valued `onBehalfOf` reverts |
| Intervening cap use | request, approval, settlement queue/dispatch, and record-disbursed rechecks |
| Commitment uniqueness | duplicate request reverts; matching cancellation clears; unrelated link cannot be cleared |
| Repayment conservation | zero, overpay, replay, installments, exact clearance, default then recovery, sum of borrower outstanding |
| Wrong rail / unexecuted movement | Jar/Treasury exact rail record; G$ must be exact Confirmed settlement child; repayment against G$ disabled |
| Executor/dependency/reentrancy | forged and removed executor; paused replacement; read-only external calls under non-reentrancy; no custody call |
| Generic-kind bypass | only dedicated selector writes ordinal 2; contributor, beneficiary, and funding gates keep exact branches |
| Relationship lifecycle | queue, batch, dispatch, retry, acknowledgment, stranded failure, requeue, cancellation, and upgrade retain the namespaced registry+loan relationship |
| Stranded loan | source failure cannot make the loan Disbursed; requeue reuses the same child and new attempt; stage-3 Celo/Safe reconciliation remains mandatory before requeue |
| Drift / size | ABI ordinal assertions, storage baselines, old-layout upgrade, event topics, EIP-170 size gate |

## Deliberate limits

- Jar/Treasury references are steward or registered-executor attestations to an existing movement; this contract does not call those rails.
- G$ repayment remains disabled. A human-entered hash is not an authenticated receipt.
- Source-side stranded failure cannot prove whether Celo already paid. Stage-3 tooling must reconcile executor state and Safe movement before any requeue.
- The stage-1 settlement and indexer defects in `commitment-pooling/reports/pre-merge-review-2026-08-09.md` remain separately owned and are not dependencies of this credit increment.
- No deploy, artifact, recovery, courier, configuration, broadcast, indexer, shared, UI, or agent work belongs to stage 2.
