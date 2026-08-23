# Wave 1 C: Transaction Sender Conformance

## Goal

Give Wallet, Passkey, and Smart Account senders one reusable conformance contract and replace the
listed hand-built transaction doubles with typed shared fakes, without normalizing away intentional
sender differences. Do not start until `w0_receipt_debt_burndown` is terminal and passed.

## Read first

- `AGENTS.md` and `packages/shared/AGENTS.md`
- `.claude/context/values.md` and `.claude/context/testing.md`
- `.plans/active/module-seams-and-velocity/{spec.md,status.json}`
- The three transaction sender implementations and existing sender tests
- `packages/shared/src/modules/transactions/wallet-sender.ts:31-38`
- The eight tests named under this lane in the program specification

## Start gate

Run `node scripts/harness/plan-hub.mjs linear-sync --feature module-seams-and-velocity --json`.
Respect `parent_only`, create no lane issue, and stop if W0-H is not passed.

## Allowed paths

- `packages/shared/src/modules/transactions/passkey-sender.ts`
- `packages/shared/src/modules/transactions/__tests__/sender-conformance.test.ts`
- The three existing sender test files under `packages/shared/src/modules/transactions/__tests__/`
- `packages/shared/src/__tests__/test-utils/{index.ts,transaction-fakes.ts,conformance.ts}`
- `packages/shared/src/__tests__/hooks/useWorkMutation.test.ts`
- `packages/shared/src/__tests__/hooks/useWorkApproval.test.ts`
- `packages/shared/src/__tests__/modules/job-queue.core.test.ts`
- `packages/shared/src/__tests__/commitment-pool-mutations.test.tsx`
- `packages/shared/src/__tests__/commitment-pooling-hooks.test.tsx`
- `packages/shared/src/__tests__/commitment-pooling-settlement-hooks.test.tsx`
- `packages/shared/src/__tests__/commitment-pool-setup-sequence.test.tsx`
- `packages/shared/src/__tests__/credit-register.test.ts`
- This handoff's TDD and Validation Receipt sections

## Required outcome

- Add optional `PasskeySenderDeps { assertWriteSafety? }` in the same trailing-dependency style as
  Wallet sender, preserving default behavior.
- Add `MOCK_CONTRACT_ABI`, `createMockContractCall`, a recording `createMockTransactionSender`
  supporting overrides/result/failure, `createFakeSmartAccountClient`, and `createFakeWagmiDeps` to
  the public shared testing surface. Keep one transfer test ABI repository-wide.
- Add `describeConformance(title, cases, laws)` and one table covering flags, batch availability,
  empty/multi-call batches, chain source, guard order, value, receipt behavior, revert behavior,
  non-canonical hashes, and sponsorship. Mark genuine non-applicable laws explicitly.
- Make all three senders pass the same table without adding behavior to Wallet's intentionally
  absent batch surface or hiding sender-specific policies.
- Replace exactly the eight hand-built `sendContractCall: vi.fn()` doubles with the typed factory
  while preserving every test title and count.
- Record, but do not fix, the factory's passkey-to-Wallet fallback, swallowed sender-hook throws,
  and non-atomic batch behavior.

## Do not

- Change sender fallback policy, batching atomicity, receipt semantics, public runtime APIs, or
  production consumers beyond optional Passkey dependency injection.
- Add dependencies, touch client/admin source, job-queue production code, workflows, or guidance.
- Use untyped bags, `as never`, broad module mocks, or deep test-utils imports.
- Stage, publish, merge, or modify another lane's paths.

## Gates

- RED first: conformance rows must demonstrate the missing shared contract on the parent commit.
- `bun run validation:plan -- --intent qa --changed
  packages/shared/src/modules/transactions/passkey-sender.ts --changed
  packages/shared/src/modules/transactions/__tests__/sender-conformance.test.ts`
- Focused conformance plus all three sender suites through `bun run --filter @green-goods/shared
  test -- <files>`.
- Run the eight migrated shared tests and verify their `it` counts are unchanged.
- `bun run --filter @green-goods/shared typecheck:full`.
- `grep -rn "sendContractCall: vi.fn" packages/shared/src/__tests__` returns zero.
- Search confirms one transfer test ABI and that the new factories resolve from
  `@green-goods/shared/testing` for consumer packages.
- Execute the rendered QA plan and record RED/GREEN plus a clean committed Validation Receipt.

## Report back

Return the tested SHA, conformance matrix results by sender, unchanged test counts, factory export
proof, grep results, typecheck/selector evidence, exact clean path status, and the three findings
explicitly left unchanged. Stop if a sender difference cannot be represented as an explicit law or
if preserving behavior conflicts with the table.

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
