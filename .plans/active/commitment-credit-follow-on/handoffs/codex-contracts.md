# Commitment Credit — August Companion - Codex Contracts Handoff

## Status

- Feature: `commitment-credit-follow-on`
- Owner: Codex
- Branch: `feature/build-commitment-crediting-contracts`
- Stage-1 merge base: `c60b38dea7e26378f414b81aa3bee20380cefd8e`
- Revalidated interface head: `238e4e218`
- Post-review implementation head: `89fffc97241d527b3dad337f335a3fc7b69f0a67`
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
- `CreditSettlement.t.sol`: 19/19 passed, including every reviewed cross-rail child state, a
  stranded loan-principal child, route retirement, retry/cancellation behavior, relationship
  preservation, and dependency mismatch.
- `SettlementSecurity.t.sol`: 21/21 passed, including owner-only paused registration and duplicate
  Safe rejection.
- `CreditRegistryUpgrade.t.sol`: 1/1 passed.
- Credit accounting invariants: 384,000 calls, zero reverts.
- Full contracts target: 1,953 Solidity tests and 100 script tests passed.

## Fresh validation evidence

- `cd packages/contracts && bun run test`: 1,953 Solidity tests and 100 script tests passed.
- `cd packages/contracts && bun run build:full`: passed.
- `cd packages/contracts && bun run check:sizes`: passed.
  - `SettlementModule`: 22,457 bytes, 2,119-byte EIP-170 margin.
  - `CreditRegistry`: 18,730 bytes, 5,846-byte margin.
  - `CeloSettlementExecutor`: 20,040 bytes, 4,536-byte margin.
  - `SettlementLoanLib`: 6,163 bytes.
- `cd packages/contracts && bun run check:storage-layout`: passed. The 11 named credit entries plus
  the 39-slot gap remain the exact linear 50-slot allocation; cap reservations use a separate
  ERC-7201 namespace and survive upgrade proof. Settlement appends the source reverse-identity
  mapping into one reserved slot and reduces its gap from 29 to 28 without shifting an existing
  field.
- `cd packages/contracts && bun run lint`: passed with zero errors and 257 warnings.
- `cd packages/contracts && bun run test:audit:full`: passed.
  - Core coverage: 86.48% lines (5,682/6,570) and 65.46% branches (883/1,349).
  - Every critical-contract threshold passed.
  - Realism audit: zero must-fix, should-fix, or nice-to-have findings.
- `cd packages/contracts && bun run test:fork:settlement-lane`: 7/7 passed. This includes the local
  fork-only Cookie Jar/Treasury record round trip and six pinned read-only Arbitrum/Celo checks. No
  transaction was submitted.
- `bun run verify:contracts:fast`: passed all build, formatting, lint, 1,953 Solidity, and 100
  script-test phases in 182 seconds; E2E and deploy dry runs were deliberately excluded.
- `node scripts/quality/check-source-structure.js --base c60b38dea`: passed for 17 changed non-test
  sources with no oversized source.
- `bun run check:ontology`, `bun run format:check`, and `git diff --check c60b38dea`: passed.
- Root `bun lint`: passed.

## Final adversarial review

Reviewed the committed range `238e4e218..89fffc972` after the final tests. It includes the two
independent-review fixes. There are no unresolved Critical or High findings in the credit registry
or loan-principal settlement seam.
The prior five High findings, cross-rail double-pay path, and source Safe identity weakness were
fixed and retested. The exact `DisbursementKind` ordinals remain 0–3, settlement loan storage uses
the frozen ERC-7201 slot, retry/acknowledgment keys remain subject-specific, and a source-side
stranded failure never makes the credit loan read as Disbursed.

Known lower-severity or deliberately deferred constraints:

- G$ repayment is disabled until an authenticated receipt policy is separately approved.
- Stage-3 tooling must reconcile the Celo executor result and Safe movement before retrying a
  source-stranded principal command.
- The remaining already-recorded settlement and indexer defects from the stage-1 pre-merge review
  remain in their owning lanes. This increment now resolves the source Safe identity defect it
  directly depends on; it does not depend on the remaining defects.

## Whole-branch blockers outside this increment

The deterministic root build reaches the indexer package and fails because
`packages/indexer/test/settlement-lifecycle.test.ts` references generated test API helpers that do
not yet expose `StrandedSubjectFailed`, `SettlementDeploymentPinned`, and
`ExecutorDeploymentPinned` at lines 167, 739, and 759. The contracts increment has no indexer diff.

A final concurrent root `bun run test` rerun was also inconclusive because Foundry aborted in its
macOS system-proxy initialization (`SCDynamicStore`) while packages ran in parallel. The exact
package-level `cd packages/contracts && bun run test` target is independently fresh and green.
These prevent a whole-branch Ship Gate claim, not the stage-2 contracts verdict.

## Stop point

No deployment, broadcast, live configuration, authority transfer, indexer activation, or value
movement occurred. The next action is human review and merge of this contracts increment. After it
merges, stage 3 owns every deployment and release operation, and the downstream state/API lane may
build against the frozen ABI.
