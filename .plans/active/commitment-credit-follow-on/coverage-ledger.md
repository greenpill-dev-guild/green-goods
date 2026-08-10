# Commitment Credit contracts coverage ledger

Revalidated: 2026-08-09
Merge base: `c60b38dea`
Pre-credit interface HEAD: `238e4e218`
Post-review implementation HEAD: `89fffc972`
Stage: 2 of 3, contracts only

## Frozen selectors

### `ICreditRegistry`

| Selector | Authority | Required proof |
|---|---|---|
| `initialize(address owner, address hatsModule, address commitmentPoolingModule, address settlementModule)` | proxy initializer | every identity non-zero; initializes paused; emits initialization identity before configuration facts; IDs start at 1 |
| `configurePoolCredit(uint256 poolId, uint256 borrowerCap, bool enabled)` | current pool steward or module owner | known pool; ordinary mutation pause gate; exact old/new configuration event |
| `addExecutor(uint256 poolId, address executor)` / `removeExecutor(uint256 poolId, address executor)` | current pool steward or module owner | known pool; non-zero add; idempotent exact bool event; removed executor immediately loses record authority |
| `requestLoan(RequestLoanParams params)` → `uint256 loanId` | self member, or current steward using distinct non-zero `onBehalfOf` | Open/enabled pool; current borrower membership; non-zero token/principal; future non-zero due date; non-empty terms; zero fee; optional commitment exists in same pool; cap; one linked loan; event carries borrower and human requester |
| `approveLoan(uint256 loanId)` | current pool steward or module owner | Requested; approver is not borrower; original self-member or `onBehalfOf` steward authority is still current; Open/enabled pool; cap recheck and Approved-exposure reservation |
| `recordDisbursed(uint256 loanId, LoanRail rail, bytes32 executionRef)` | current steward or registered pool executor | Approved with a cap reservation; Open/enabled pool; `rail != None`; Jar/Treasury rechecks current committed exposure and uses a unique non-zero steward-attested reference only when no settlement child has ever existed for the loan; any child state fails closed with `SettlementChildExists`; G$ derives a Confirmed exact loan child and exact domain-separated reference after dispatch-time cap proof; converts reservation to outstanding once |
| `recordRepayment(uint256 loanId, uint256 amount, bytes32 executionRef)` | current steward or registered pool executor | Disbursed or Defaulted; Jar/Treasury only; positive non-overpayment; unique non-zero reference; exact outstanding conservation; installment count; exact clearance emits Repaid; recovered default stays visible in prior event history |
| `markDefaulted(uint256 loanId, string reasonCID)` | current pool steward or module owner | Disbursed; strictly past due; reason required; allowed while paused |
| `cancelLoan(uint256 loanId, string reasonCID)` | borrower from Requested; steward from Requested or Approved | reason required; never after disbursement; a linked settlement child must already be Cancelled; releases Approved cap reservation; allowed while paused; clears matching commitment link only |
| dependency setters + `setPaused(bool)` | module owner | dependency changes only while paused; zero rejected; settlement replacement requires zero Approved-loan reservations; unpause requires all dependencies; every change emitted |
| UUPS authorization | module owner | upgrade only while paused; old-layout state survives |
| views | public | `getLoan`, `poolCreditConfig`, `outstandingOf`, `reservedOutstandingOf`, `isCapReserved`, `amountDue`, `loanOfCommitment`, `isExecutor`, `loanOfExecutionRef`, dependency and pause getters |

### `ISettlementModule` scoped addition

| Selector/change | Frozen requirement |
|---|---|
| `queueLoanPrincipal(uint256 loanId)` → `uint256 disbursementId` | Current pool steward; configured and unpaused `creditRegistry`; exact registry↔settlement and pooling identity; Approved loan; Open/enabled pool with distinct rejection errors for pool state and disabled credit; cap; active pool-garden Safe; canonical G$; borrower recipient; principal; idempotent relationship; batch and dispatch repeat the operational and loan-fact proof |
| `loanPrincipalDisbursementOf(address registry, uint256 loanId)` | Explicit registry domain avoids collisions across a paused dependency replacement |
| `loanPrincipalRelationshipOf(uint256 disbursementId)` | Exact registry+loan relationship for authenticated credit recording; survives batch, dispatch, retry, acknowledgment, stranded failure, requeue, cancellation, and upgrade |
| `setCreditRegistry(address registry)` | Owner, source paused, non-zero, exact old/new event |
| `registerSettlementAccount(...)` | Owner-only while the source module is paused; a garden remains write-once and a Safe may belong to exactly one garden; duplicate reverse assignment reverts with the already-assigned garden |
| `settlementGardenOf(address account)` | Reverse source identity lookup for the unique Safe-to-garden assignment |
| `LoanPrincipalQueued(uint256 disbursementId, address creditRegistry, uint256 loanId)` | Dedicated relationship marker; existing `DisbursementQueued` signature stays unchanged |
| storage | Keep existing stage-1 fields and the generic `Disbursement` tuple unchanged; append the Safe-to-garden reverse mapping by consuming one reserved gap slot (29 to 28); use the derived ERC-7201 `green.goods.settlement.loan` namespace for registry configuration, registry+loan reverse lookup, and disbursement relationship; commit and check the exact namespace slot and member order; prove continuity through a real UUPS upgrade |
| executor | Accept exact `DisbursementKind` ordinal 2 through the existing bounded G$ path; beneficiary/funding Safe-recipient gates remain unchanged |

## Frozen types and ordinals

- `LoanState`: `None` 0, `Requested` 1, `Approved` 2, `Disbursed` 3, `Repaid` 4, `Defaulted` 5, `Cancelled` 6.
- `LoanRail`: `None` 0, `Jar` 1, `Treasury` 2, `GDollarSettlement` 3.
- `DisbursementKind` stays `ContributorConsideration` 0, `Funding` 1, `LoanPrincipal` 2, `GardenBeneficiary` 3.
- `FailureCode.SourceStranded` stays appended at 12; executor-sent ordinals remain 0–11.
- `Repaying` remains derived when a non-defaulted Disbursed loan has `0 < repaidAmount < principal + feeAmount`; it is not a hard state.

## Storage ledger

`CreditRegistry` declares 11 custom entries and a 39-slot gap: three dependencies, `nextLoanId`, five domain mappings (`loans`, pool configuration, borrower outstanding, commitment link, executors), the execution-reference replay mapping, and `paused`. The total is exactly 50 custom entries; inherited upgradeable layouts remain independent. ERC-7201 namespace `green.goods.credit.cap-reservation` stores Approved exposure by borrower, a per-loan reservation bit, and an aggregate active-reservation count without consuming or shifting a linear slot. The aggregate locks settlement replacement until every Approved exposure is either recorded or safely cancelled. `ERC7201Namespaces.json` and the Bun-owned storage checker freeze this namespace and `green.goods.settlement.loan` by derived slot plus ordered member declarations, alongside the ordinary compiler layout baselines.

## Event and error coverage

Events cover initialization identity; dependency and pause changes; pool configuration; executor changes; request, approval, disbursement, installment, exact repayment, default, and cancellation; and the settlement loan relationship. `RepaymentRecorded.newOutstanding` is the loan's remaining balance. Custom errors cover zero/unknown identities, CreditRegistry pause at settlement validation, membership/steward/recorder authority, on-behalf confusion, self-approval, distinct non-Open-pool and disabled-credit causes, cap, missing or active reservations, commitment mismatch/duplicate, terms/token/principal/due-date validity, loan state, rail, any cross-rail settlement child, settlement relationship/confirmation/cancellation, G$ repayment disablement, duplicate Safe assignment, zero/replayed reference, zero/overpayment, due date, cancellation state, and reason requirements.

## Adversarial coverage map

| Risk | Proof target |
|---|---|
| Self approval / on-behalf confusion | self path, steward distinct-member path, non-steward and self-valued `onBehalfOf` reverts |
| Intervening cap or administrative stop | request and approval rechecks; approval-time namespaced reservation; settlement queue/dispatch proof; queued-child dispatch rejection while the registry is paused; Jar/Treasury record proof; conversion/release conservation |
| Commitment uniqueness | duplicate request reverts; matching cancellation clears; unrelated link cannot be cleared |
| Repayment conservation | zero, overpay, replay, installments, exact clearance, default then recovery, sum of borrower outstanding |
| Wrong rail / unexecuted movement | Jar/Treasury exact rail record and permanent absence of a settlement child; G$ must be exact Confirmed settlement child; repayment against G$ disabled |
| Source settlement identity | owner-only paused registration; reverse Safe-to-garden uniqueness; duplicate garden and duplicate Safe rejection |
| Executor/dependency/reentrancy | forged and removed executor; paused replacement; settlement replacement blocked while Approved exposure exists; read-only external calls under non-reentrancy; no custody call |
| Generic-kind bypass | only dedicated selector writes ordinal 2; contributor, beneficiary, and funding gates keep exact branches |
| Relationship lifecycle | queue, batch, dispatch, retry, acknowledgment, stranded failure, requeue, cancellation, and upgrade retain the namespaced registry+loan relationship; credit cancellation requires source cancellation first |
| Stranded loan | source failure cannot make the loan Disbursed; requeue reuses the same child and new attempt; stage-3 Celo/Safe reconciliation remains mandatory before requeue |
| Drift / size | ABI ordinal assertions, linear and ERC-7201 namespace storage baselines, old-layout upgrade, event topics, EIP-170 size gate |

## Deliberate limits

- Jar/Treasury references are steward or registered-executor attestations to an existing movement; this contract does not call those rails.
- G$ repayment remains disabled. A human-entered hash is not an authenticated receipt.
- Source-side stranded failure cannot prove whether Celo already paid. Stage-3 tooling must reconcile executor state and Safe movement before any requeue.
- The source settlement account defects this increment began to depend on are fixed before deployment. The remaining stage-1 settlement and indexer defects in `commitment-pooling/reports/pre-merge-review-2026-08-09.md` remain separately owned and are not dependencies of this credit increment.
- No deploy, artifact, recovery, courier, configuration, broadcast, indexer, shared, UI, or agent work belongs to stage 2.
