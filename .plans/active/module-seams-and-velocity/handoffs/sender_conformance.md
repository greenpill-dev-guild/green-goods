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

- RED: `bun run --filter @green-goods/shared test --
  src/modules/transactions/__tests__/sender-conformance.test.ts` on the parent implementation failed
  with 1 failed, 27 passed, and 5 explicitly skipped tests. The new Passkey guard-order law expected
  `["safety", "send"]` but observed `["send"]`, proving the sender ignored the injectable safety
  dependency required for shared conformance.
- GREEN: the same focused command passed after the optional trailing `PasskeySenderDeps` seam was
  implemented. The final combined sender-plus-migration proof passed 12/12 files with 198 tests
  passed and 5 genuine sender-policy rows skipped. The eight migrated files retained their original
  counts: useWorkMutation 16, useWorkApproval 17, job-queue core 4, commitment-pool mutations 4,
  commitment-pooling hooks 21, settlement hooks 10, setup sequence 15, and credit register 12.
- Proof limit: the locked lane certifies one shared ABI across the Wallet, Passkey, and Embedded
  sender suites. The literal repository-wide transfer-test ABI count remains 2 because the
  pre-existing `src/__tests__/hooks/blockchain/useContractTxSender.test.ts` definition is outside
  this lane. The legacy-mock search likewise retains the ninth, out-of-lane
  `src/__tests__/providers/JobQueueProvider.test.tsx` hit owned by the immediately stacked
  `jobqueue_create_deps` lane. Neither program-wide exit is claimed complete here.

## Validation Receipt

- Tested implementation commit SHA: `8fe5f6cba756470123b3bceb54cef556e245bcbf`
- Run at (UTC): 2026-08-23T09:20:48Z
- Toolchain: Node 22.22.1, Bun 1.3.14, Foundry 1.7.1. Validation used disposable
  `node_modules` symlinks into the primary checkout; all were removed before clean-tree evidence.
- Exact command(s) and result:
  - `bun run validation:plan -- --intent qa --changed
    packages/shared/src/modules/transactions/passkey-sender.ts --changed
    packages/shared/src/modules/transactions/__tests__/sender-conformance.test.ts --json` — ready;
    selected path-scoped format/lint, shared source/test typechecks, the focused conformance test,
    Client/Admin/Agent tests, Agent typecheck, and ontology. Its recorded risk, expected signal,
    exact-input freshness, and stop-dependent-checks rules governed the run.
  - `bunx @biomejs/biome format --no-errors-on-unmatched
    packages/shared/src/modules/transactions/__tests__/sender-conformance.test.ts
    packages/shared/src/modules/transactions/passkey-sender.ts` — checked 2 files with no change;
    `bun --bun run oxlint packages/shared/src/modules/transactions/passkey-sender.ts
    --deny-warnings` — passed.
  - `bun run --filter @green-goods/shared typecheck:full` — passed both source and strict test/story
    typechecks.
  - `bun run --filter @green-goods/shared test --
    src/modules/transactions/__tests__/sender-conformance.test.ts
    src/modules/transactions/__tests__/wallet-sender.test.ts
    src/modules/transactions/__tests__/passkey-sender.test.ts
    src/modules/transactions/__tests__/embedded-sender.test.ts
    src/__tests__/hooks/useWorkMutation.test.ts src/__tests__/hooks/useWorkApproval.test.ts
    src/__tests__/modules/job-queue.core.test.ts
    src/__tests__/commitment-pool-mutations.test.tsx
    src/__tests__/commitment-pooling-hooks.test.tsx
    src/__tests__/commitment-pooling-settlement-hooks.test.tsx
    src/__tests__/commitment-pool-setup-sequence.test.tsx
    src/__tests__/credit-register.test.ts` — 12/12 files passed, 198 tests passed, 5 explicit
    non-applicable laws skipped.
  - `bun run --filter @green-goods/shared test --
    src/modules/transactions/__tests__/sender-conformance.test.ts
    src/modules/transactions/__tests__/wallet-sender.test.ts
    src/modules/transactions/__tests__/passkey-sender.test.ts
    src/modules/transactions/__tests__/embedded-sender.test.ts --coverage.enabled
    --coverage.provider=v8 --coverage.include=src/modules/transactions/wallet-sender.ts
    --coverage.include=src/modules/transactions/passkey-sender.ts
    --coverage.include=src/modules/transactions/embedded-sender.ts` — 4/4 files passed, 61 tests
    passed, 5 skipped; direct production coverage was 92.53% statements, 93.33% branches, and
    93.93% lines.
  - `bun run --filter @green-goods/client test` — 93 files and 865 tests passed.
  - `bun run --filter @green-goods/admin test` — 94 files and 659 tests passed.
  - `bun run --filter @green-goods/agent typecheck` and
    `bun run --filter @green-goods/agent test` — typecheck passed; 24 files/265 tests passed with
    1 file/1 test skipped, then the second Agent lane passed 1 file/5 tests.
  - `bun run check:ontology` — 50 tests and every ontology guard passed.
  - `SOURCE_STRUCTURE_BASE_REF=c9f6502e99df66a24adab063440c6c3191802c4f
    node scripts/quality/check-source-structure.js` — checked the 1 changed non-test source file;
    passed with no oversized baseline regression.
  - `node scripts/harness/plan-hub.mjs validate --feature module-seams-and-velocity` — validated
    all 46 feature hubs; `node --test scripts/harness/plan-hub.test.mjs` — 56/56 fixtures passed.
  - Static export proof: `packages/shared/package.json` maps `./testing` to the public test-utils
    barrel; that barrel exports `transaction-fakes` and `describeConformance`; Client and Admin
    Vitest aliases resolve `@green-goods/shared/testing` to that barrel, and both full consumer
    suites passed.
  - Inventory searches: `grep -RIn "sendContractCall: vi.fn" packages/shared/src/__tests__`
    returned only the deferred JobQueueProvider hit. `grep -RIn 'name: "transfer"'
    packages/shared/src --include='*.test.ts' --include='*.test.tsx'
    --include='transaction-fakes.ts'` returned exactly the shared factory and the deferred
    `useContractTxSender.test.ts` hit, so the literal count is 2.
- Conformance matrix result: Wallet passed wallet auth, unsponsored results, call/default chain
  sourcing, chain then safety then send then canonical-only receipt order, omitted/explicit value,
  reverted receipts, non-canonical hashes, and transport failure; batch laws were explicit n/a.
  Passkey passed passkey auth, sponsored results, client-chain sourcing, safety-before-send,
  zero/default and explicit value, no receipt wait, failures, and sequential empty/multi-call batch
  laws; receipt/revert/hash laws that do not exist at its bundler boundary were explicit n/a.
  Embedded passed embedded auth, unsponsored results, call/default chain sourcing, chain then safety
  then send then always-receipt order, values, revert/failure behavior, and sequential batch laws;
  its impossible no-receipt non-canonical-hash row was explicit n/a.
- Validated paths: the 16 implementation paths in commit
  `8fe5f6cba756470123b3bceb54cef556e245bcbf` only.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  packages/shared/src/__tests__/commitment-pool-mutations.test.tsx
  packages/shared/src/__tests__/commitment-pool-setup-sequence.test.tsx
  packages/shared/src/__tests__/commitment-pooling-hooks.test.tsx
  packages/shared/src/__tests__/commitment-pooling-settlement-hooks.test.tsx
  packages/shared/src/__tests__/credit-register.test.ts
  packages/shared/src/__tests__/hooks/useWorkApproval.test.ts
  packages/shared/src/__tests__/hooks/useWorkMutation.test.ts
  packages/shared/src/__tests__/modules/job-queue.core.test.ts
  packages/shared/src/__tests__/test-utils/conformance.ts
  packages/shared/src/__tests__/test-utils/index.ts
  packages/shared/src/__tests__/test-utils/transaction-fakes.ts
  packages/shared/src/modules/transactions/__tests__/embedded-sender.test.ts
  packages/shared/src/modules/transactions/__tests__/passkey-sender.test.ts
  packages/shared/src/modules/transactions/__tests__/sender-conformance.test.ts
  packages/shared/src/modules/transactions/__tests__/wallet-sender.test.ts
  packages/shared/src/modules/transactions/passkey-sender.ts` — no output.
- Evidence-only diff command and result: `git diff --exit-code
  8fe5f6cba756470123b3bceb54cef556e245bcbf -- $(git show --name-only --format=
  8fe5f6cba756470123b3bceb54cef556e245bcbf)` — exit 0, no output; receipt/status edits did not
  alter the tested implementation.
- Evidence-only worktree-status command and result: the worktree identity command above returned no
  implementation-path changes while this receipt and `status.json` were the only evidence edits.
- Deferred findings intentionally unchanged: `factory.ts:57-66` still falls back from Passkey to
  Wallet; `useTransactionSender.ts:55-69` still catches every factory throw and returns `null`;
  Passkey and Embedded `sendBatch` remain sequential and non-atomic.
