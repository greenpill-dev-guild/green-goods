# Commitment Credit — August Companion - Codex Contracts Handoff

## Status

- Feature: `commitment-credit-follow-on`
- Owner: Codex
- Branch: `feature/build-commitment-crediting-contracts`
- Stage-1 merge base: `c60b38dea7e26378f414b81aa3bee20380cefd8e`
- Revalidated interface head: `238e4e218`
- Post-review implementation head: `89fffc97241d527b3dad337f335a3fc7b69f0a67`
- Follow-up review base checkout: `fafd79d20a53d560aef6ac5fb392650b7b1458d7`, with the
  review-comment fixes described below applied on top in this commit.
- Contracts commits: `1df10469bc0e6f554bf9edd3b467f325615d1a20`, `0b50c9205`, and
  `89fffc97241d527b3dad337f335a3fc7b69f0a67`.
- Verdict: **APPROVE for the stage-2 contracts increment after post-review fixes**. Human review
  and merge remain pending.
- Linear context: PRD-697 is the parent and PRD-785 is the contracts lane.
- Linear mirror: PRD-785 was re-read, moved to In Review, and updated with the final contracts proof.

## Delivered boundary

This stage implements the records-only `ICreditRegistry`/`CreditRegistry`, its frozen 50-slot
linear storage baseline, the dedicated `queueLoanPrincipal(uint256 loanId)` settlement seam, and
the contract tests and review evidence. It does not add deployment targets, artifacts, recovery or
courier tooling, Safe/Zodiac setup, live configuration, indexer/shared/UI/agent consumers, or a
broadcast path.

The pooling module and `CommitmentRegistry` remain read-only dependencies. Their ABI and lifecycle
have no diff in the committed range. G$ repayment remains disabled because no authenticated upward
receipt policy is frozen; Jar and Treasury are the executable record-only repayment rails.

## RED / GREEN

Initial RED was recorded before production implementation:

- `cd packages/contracts && bun run test:match 'test/unit/CreditRegistry.t.sol'`
- Compilation failed because `ICreditRegistry.sol` and `Credit.sol` did not exist. The test already
  required request, approval, Treasury recording, two installments, and outstanding conservation.

Adversarial review then produced focused REDs for five High-severity defects before they were fixed:

1. An Approved G$ loan could be cancelled in the registry after its settlement child had dispatched
   or confirmed.
2. `RepaymentRecorded.newOutstanding` reported the borrower's aggregate balance instead of the
   remaining balance of the loan named by the event.
3. Approval did not revalidate the original self/on-behalf request authority.
4. Concurrent Approved G$ loans could pass the cap independently before either acknowledgment
   became recordable.
5. Replacing the registry's settlement dependency could orphan Approved exposure.

The next independent review produced two further focused RED groups before production changes:

1. `CreditSettlement.t.sol` failed 3/3 new cases because Jar/Treasury recording did not revert when
   the same loan already had a queued/batched, dispatched/confirmed, or failed/retried settlement
   child.
2. `SettlementSecurity.t.sol` failed 3/3 new cases because a steward could register a source
   account while unpaused and the same Safe could be assigned to a second garden.

The resolved policy is fail-closed and pre-deploy bounded: any existing settlement child permanently
blocks a non-G$ record for that loan, and source account registration is owner-only while paused
with an on-chain reverse Safe-to-garden uniqueness check. No correction/rotation surface was added
because no instance is deployed; stage 3 must register the initial mapping under the paused owner.

GREEN on the hardened range:

- `CreditRegistry.t.sol`: 21/21 passed, including the 1,000-run fuzz case.
- `CreditSettlement.t.sol`: 20/20 passed, including every reviewed cross-rail child state, a
  stranded loan-principal child, route retirement, retry/cancellation behavior, relationship
  preservation, dependency mismatch, registry pause enforcement, and distinct pool/credit
  rejection causes.
- `SettlementSecurity.t.sol`: 21/21 passed, including owner-only paused registration and duplicate
  Safe rejection.
- `CreditRegistryUpgrade.t.sol`: 1/1 passed.
- `Settlement.t.sol`: 19/19 passed, including the source-side consecutive peer-rotation guard.
- `CeloSettlementSecurity.t.sol`: 24/24 passed, including the symmetric executor-side guard.
- Credit accounting invariants: 384,000 calls, zero reverts.
- Full contracts target: 1,957 Solidity tests and 100 script tests passed.

## Prior full validation evidence (2026-08-10)

- `cd packages/contracts && bun run test`: 1,957 Solidity tests and 100 script tests passed.
- `cd packages/contracts && bun run build:full`: passed.
- `cd packages/contracts && bun run check:sizes`: passed.
  - `SettlementModule`: 22,457 bytes, 2,119-byte EIP-170 margin.
  - `CreditRegistry`: 18,730 bytes, 5,846-byte margin.
  - `CeloSettlementExecutor`: 20,225 bytes, 4,351-byte margin.
  - `SettlementConfigurationLib`: 4,402 bytes.
  - `SettlementLoanLib`: 6,285 bytes.
- `cd packages/contracts && bun run check:storage-layout`: passed. The 11 named credit entries plus
  the 39-slot gap remain the exact linear 50-slot allocation. The gate also recomputes and verifies
  the `green.goods.credit.cap-reservation` and `green.goods.settlement.loan` ERC-7201 slots and
  their ordered namespace members against the committed namespace baseline. Settlement appends
  the source reverse-identity mapping into one reserved slot and reduces its gap from 29 to 28
  without shifting an existing field.
- `cd packages/contracts && bun run lint`: passed with zero errors and 257 warnings.
- `cd packages/contracts && bun run test:audit:full`: passed.
  - Core coverage: 86.49% lines (5,693/6,582) and 65.61% branches (887/1,352).
  - Every critical-contract threshold passed.
  - Realism audit: zero must-fix, should-fix, or nice-to-have findings.
- `cd packages/contracts && bun run test:fork:settlement-lane`: 7/7 passed. This includes the local
  fork-only Cookie Jar/Treasury record round trip and six pinned read-only Arbitrum/Celo checks. No
  transaction was submitted.
- `bun run verify:contracts:fast`: passed all build, formatting, lint, 1,957 Solidity, and 100
  script-test phases in 145 seconds; E2E and deploy dry runs were deliberately excluded.
- `node scripts/quality/check-source-structure.js --base c60b38dea`: passed for 18 changed non-test
  sources with no oversized source.
- `bun run check:ontology`, `bun run format:check`, and `git diff --check c60b38dea`: passed.
- Root `bun lint`: passed.

## Latest review-follow-up validation (2026-08-10 23:29 UTC)

The next review sweep found two valid P2 gaps. `recordRepayment` retained a terminal loan's
commitment link after exact clearance, and the ERC-7201 namespace manifest froze the settlement
relationship mapping declaration without freezing its nested value schema. The implementation now
uses one terminal-link release helper from both Repaid and Cancelled transitions; partial and
Defaulted loans retain their live link. The namespace manifest and Bun checker also snapshot the
ordered `ISettlementModule.LoanPrincipalRelationship` members. No other ERC-7201 namespace in the
package stores a user-defined value type.

Fresh proof with those fixes present:

- `CreditRegistry.t.sol`: 31/31 passed after the new test first failed with
  `CommitmentLoanExists(1, 1)`.
- `bun run test`: 1,975 Solidity tests and 100 script tests passed.
- `bun run build:full`, `bun run check:storage-layout`, package typecheck, root format check, and
  contracts lint check passed. Lint reported zero errors and the repository's 254 existing
  warnings.
- `bun run check:sizes`: `CreditRegistry` is 22,093 bytes with 2,483 bytes of EIP-170 margin;
  `SettlementModule` remains 22,944 bytes with 1,632 bytes of margin.
- The realism audit reported zero must-fix, should-fix, or nice-to-have findings.

## Final adversarial review

Re-reviewed the complete implementation range through `89fffc972`, its unchanged contracts tree at
checkout `fafd79d20a53d560aef6ac5fb392650b7b1458d7`, and the follow-up review fixes in this commit
after the final tests. There are no unresolved Critical or High findings in the credit registry or
loan-principal settlement seam.
The prior five High findings, cross-rail double-pay path, and source Safe identity weakness were
fixed and retested. The follow-up sweep also blocks loan-principal execution while the credit
registry is paused, reports pool-state and disabled-credit rejections accurately, and protects both
ERC-7201 namespace layouts. The exact `DisbursementKind` ordinals remain 0–3, settlement loan
storage uses the frozen ERC-7201 slot, retry/acknowledgment keys remain subject-specific, and a
source-side stranded failure never makes the credit loan read as Disbursed.

Known lower-severity or deliberately deferred constraints:

- G$ repayment is disabled until an authenticated receipt policy is separately approved. Stage 3
  must leave the SettlementModule's CreditRegistry dependency unset until then, preventing G$
  principal from queuing or disbursing while Jar/Treasury records-only loans remain available.
- Stage-3 tooling must reconcile the Celo executor result and Safe movement before retrying a
  source-stranded principal command.
- The remaining already-recorded settlement and indexer defects from the stage-1 pre-merge review
  remain in their owning lanes. This increment now resolves the source Safe identity defect it
  directly depends on; it does not depend on the remaining defects.

## Whole-branch follow-up outside this increment

The former indexer helper blocker is resolved in `1fbb6c1cd`. The lifecycle fixture now exposes
`StrandedSubjectFailed`, `SettlementDeploymentPinned`, and `ExecutorDeploymentPinned`; the indexer
boundary, lint, all 203 tests, code generation, TypeScript build, and refreshed remote Indexer job
are green.

The root `bun run test` target was rerun outside the restricted sandbox so Foundry could read macOS
proxy state; it passed across the monorepo, including the 1,957-contract-test and 203-indexer-test
suites. The prior proxy initialization abort is no longer an active Ship Gate gap.

## Stop point

No deployment, broadcast, live configuration, authority transfer, indexer activation, or value
movement occurred. The next action is human review and merge of this contracts increment. After it
merges, stage 3 owns every deployment and release operation, and the downstream state/API lane may
build against the frozen ABI.
