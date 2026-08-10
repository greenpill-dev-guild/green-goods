# Commitment Credit — August Companion - Codex Contracts Handoff

## Status

- Feature: commitment-credit-follow-on
- Owner: Codex
- Branch: `feature/build-commitment-crediting-contracts`
- Base: `c60b38dea`
- Revalidation HEAD: `238e4e218`
- Current state: stage-2 implementation and contracts proof complete; committed-range review pending
- Linear context: PRD-697 is the parent and PRD-785 is the contracts lane

## Inputs

The 2026-08-01 scope lock is granted. Dispatch verification completed on 2026-08-09:

- Stage 1 merged in PR #694 at `c60b38dea`.
- Afo approved the interest-free records-only posture.
- `../spec.md` and `../coverage-ledger.md` freeze the exact credit ABI and the scoped settlement addition against `238e4e218`.

The contracts increment does not wait on indexer/shared/UI implementation. Those consumers follow the frozen ABI after this stage merges.

## Outputs

- `ICreditRegistry`, `CreditRegistry`, storage baseline, unit/adversarial/fuzz/invariant/fork tests, and upgrade proof.
- Settlement-side `queueLoanPrincipal(uint256 loanId)` plus explicit loan relationship and lifecycle proof without weakening consideration, beneficiary, or funding gates.
- Updated handoff with exact RED/GREEN, size, coverage, storage, and committed-range review evidence.

## Acceptance

- No transferable voucher, score, ranking, or debt behavior is inferred from commitment or settlement records.
- Borrow/repay authorization, caps, failure/recovery, privacy, indexer, shared, and UI contracts are explicit before implementation.
- The companion chain remains additive: no pooling-module/register ABI or lifecycle change.
- `DisbursementKind.LoanPrincipal` is the only settlement seam; `commitmentId == 0` never becomes a generic member-disbursement bypass.

## RED / GREEN

RED recorded before production implementation:

- Command: `cd packages/contracts && bun run test:match -- test/unit/CreditRegistry.t.sol`
- Evidence: compilation failed because `src/interfaces/ICreditRegistry.sol` and `src/registries/Credit.sol` did not exist. The focused test already required the request → approve → Treasury record → two-installment repayment path and exact outstanding conservation.

GREEN on that same target:

- Command: `cd packages/contracts && bun run test:match 'test/unit/CreditRegistry.t.sol'`
- Evidence: 15/15 passed, including the 1,000-run fuzz case. The settlement seam passed 11/11,
  the frozen credit-layout upgrade passed 1/1, and three credit accounting invariants completed
  384,000 calls with zero reverts.

## Fresh validation evidence

- `cd packages/contracts && bun run test`: 1,936 Solidity tests and 100 script tests passed.
- `cd packages/contracts && bun run build:full`: passed.
- `cd packages/contracts && bun run check:sizes`: passed. `SettlementModule` is 22,369 bytes
  (2,207-byte margin); `CreditRegistry` is 17,209 bytes (7,367-byte margin);
  `CeloSettlementExecutor` is 20,040 bytes (4,536-byte margin).
- `cd packages/contracts && bun run check:storage-layout`: passed, including the new frozen
  `CreditRegistry` baseline and unchanged stage-1 settlement linear layout.
- `cd packages/contracts && bun run lint`: passed with zero errors and the repository's existing
  Solidity warnings.
- `cd packages/contracts && bun run test:audit:full`: passed. Core coverage is 86.37% lines
  (5,619/6,506) and 65.30% branches (873/1,337); every critical-contract threshold passed;
  realism reported zero must-fix, should-fix, or nice-to-have findings.
- `cd packages/contracts && bun run test:fork:settlement-lane`: 7/7 passed, including the local
  fork-only Cookie Jar/Treasury record round trip and six pinned Arbitrum/Celo lane checks. No live
  transaction was sent.
- `node scripts/quality/check-source-structure.js --base c60b38dea`, `bun run check:ontology`,
  `bun run format:check`, and `git diff --check c60b38dea`: passed.
- Root `bun format`, `bun lint`, and `bun run test` passed. The read-only
  `bun run verify:contracts:fast` wrapper also passed outside the sandbox after the sandboxed run
  hit Foundry's macOS system-proxy crash.

## Branch-level blocker outside this increment

`VITE_CHAIN_ID=11155111 bun run build` reaches the indexer build and fails because the committed
`packages/indexer/test/v3.ts` event helper omits `SettlementDeploymentPinned`,
`StrandedSubjectFailed`, and `ExecutorDeploymentPinned`. Those events are already declared in
`packages/indexer/config.yaml`, Envio codegen emits them, and this contracts increment has no
indexer diff. The all-forks convenience target also requires separate Sepolia Hats upgrade pins;
the prompt's exact settlement-lane fork target is green. Neither issue changes the stage-2
contract proof, but the root build helper mismatch must be repaired in its owning lane before a
whole-branch ship claim.

## Exact Bun commands

- `cd packages/contracts && bun run test:match 'test/unit/CreditRegistry.t.sol'`
- `cd packages/contracts && bun run build:full`
- `cd packages/contracts && bun run check:sizes`
- `cd packages/contracts && bun run check:storage-layout`
- `cd packages/contracts && bun run lint`
- `cd packages/contracts && bun run test:audit:full`
- `cd packages/contracts && bun run test:fork:settlement-lane`

## Out of scope

- Deploy targets, deployment artifacts, recovery/courier tooling, Safe/Zodiac setup, live configuration, broadcast, indexer/shared/UI/agent implementation, credit scores, rankings, transferable settlement vouchers, arbitrary borrowing, implicit G$ repayment settlement, or pooling lifecycle coupling.

## Unblock evidence

- The granted 2026-08-01 scope lock remains recorded in pooling Decision Log #39/register #73.
- Pooling/settlement foundations and the three post-merge interface decisions are verified in code and focused tests.
- Human legal/operations review is recorded.
- `status.json`'s manual blocker is cleared; RED/GREEN evidence is recorded before the lane is marked passed.

## Final review checkpoint

The implementation will be committed, then reviewed from a clean committed range. The contracts
lane remains `in_progress` until that review confirms no unresolved Critical/High finding in the
credit registry or settlement seam.
