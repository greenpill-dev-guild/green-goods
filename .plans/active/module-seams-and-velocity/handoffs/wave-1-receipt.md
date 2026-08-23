# Wave 1 Consolidated Receipt

Wave 1 closes the approved mutation seams and pooling-controller batch on `develop`. Earlier lane
receipts remain the detailed evidence for sender conformance, constructable Job Queue wiring, pool
controller contracts, and the Pool Console suite. This receipt records the integrated Wave 1 exit
proof once for the tested wave SHA.

## TDD Proof

- RED: the Job Queue, sender, work-command, simulation, passkey, and executor acceptance tests each
  failed on their parent implementations before their declared seams existed. The Pool Console
  timer and no-pool guard mutants failed their direct suite.
- RED: changing either Hub confirmation or dispute authority from `row.garden` to `row.poolGarden`
  failed the named direct case 1/5 while the other four cases passed.
- GREEN: the integrated direct coverage run passed 105/105; the restored Hub suite passed 5/5.
- Proof limit: the Repo Quick Gate is `BLOCKED`, not passing, after 277 Indexer tests passed and nine
  metadata tests could not bind `127.0.0.1` (`EPERM`). The unchanged environment failure was not
  retried. Exact-input Wave 1 Shared, Client, Admin, and Agent proof passed before the boundary run.

## Validation Receipt

- Tested implementation commit SHA: `a60e9eca357a83387053001827700aa6904774a7`
- Run at (UTC): `2026-08-23T16:58:46Z`
- Exact command(s):
  - `bun run validation:plan -- --intent checkpoint --checkpoint-scope lane --risk critical --changed '<B2 paths>' --test-path shared:<each focused test> --json`
  - `bun run format:check`; `bun lint`
  - `(cd packages/shared && bun run typecheck && bun run typecheck:tests)`
  - `(cd packages/shared && bun run test src/__tests__/hooks/work/useBatchWorkApproval.test.ts src/__tests__/modules/job-executors.test.ts src/__tests__/modules/job-queue.core.test.ts src/__tests__/modules/passkey-submission.test.ts src/__tests__/modules/submit-work-command.test.ts src/__tests__/modules/wallet-submission.test.ts src/__tests__/modules/work-simulate.test.ts)`
  - `(cd packages/shared && bun run test src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx src/__tests__/hooks/admin-ui/useHubConfirmQueueController.test.tsx src/__tests__/modules/submit-work-command.test.ts src/__tests__/modules/work-simulate.test.ts src/__tests__/modules/passkey-submission.test.ts src/__tests__/modules/job-executors.test.ts --coverage --coverage.include=src/hooks/admin-ui/pool/usePoolConsoleController.ts --coverage.include=src/hooks/admin-ui/pool/useHubConfirmQueueController.ts --coverage.include=src/modules/work/submit-work-command.ts --coverage.include=src/modules/work/simulate.ts --coverage.include=src/modules/work/passkey-submission.ts --coverage.include=src/modules/job-queue/job-executors.ts)`
  - `(cd packages/client && node ../../node_modules/.bin/turbo run test --filter=@green-goods/client --output-logs=new-only)`
  - `(cd packages/admin && node ../../node_modules/.bin/turbo run test --filter=@green-goods/admin --output-logs=new-only)`
  - `(cd packages/agent && bun run typecheck && node ../../node_modules/.bin/turbo run test --filter=@green-goods/agent --output-logs=new-only)`
  - `bun run check:source-structure`; `bun run check:design-md && bun run check:design-generated && bun run check:design-tokens && bun run lint:vocab`; `bun run check:ontology`
  - `node scripts/dev/ci-local.js --quick`
- Result: format, lint, Shared source/test typechecks, Agent typecheck, source structure, design,
  vocabulary, and ontology passed. B2 focused proof passed 118/118. The integrated Wave 1 direct run
  passed 105/105 at 99.16% statements, 96.17% branches, 98.70% functions, and 99.40% lines. Pool
  Console retained 100% lines and functions; Hub Confirm, work submit, and passkey submission were
  fully line-covered; simulation reached 98.66% lines and 96.05% branches. Client passed 93 files
  and 865 tests; Admin passed 94 files and 659 tests; Agent passed 25 files and 270 tests with one
  live test skipped. The Quick Gate stopped only on the named Indexer localhost blocker.
- Validated paths: Wave 1 changes under `packages/shared/src/modules/{transactions,job-queue,work}`,
  `packages/shared/src/hooks/{admin-ui/pool,work}`, Shared providers and typed test utilities, the six
  Admin pooling view tests, their direct Shared tests, and the selector/configuration inputs reported
  by the rendered plans.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all` returned
  no output at the tested SHA.
- Evidence-only diff command and result (if applicable): not applicable at the tested implementation
  SHA; this receipt and its Plan Hub snapshot are evidence-only follow-up changes.
- Evidence-only worktree-status command and result (if applicable): the implementation worktree was
  clean before this evidence update.

## Exit Evidence

- `createJobQueue` is exported from the Job Queue public module and its default singleton wiring is
  covered by the seam suite.
- Pool Console and Hub Confirm Queue both have direct controller suites; Hub authority uses
  `row.garden` for both confirmation and dispute actions.
- `submit-work-command.ts` exceeds the 95% line / 90% branch floor.
- `simulate.ts` and `passkey-submission.ts` are directly covered and no
  `vi.mock(...passkey-submission)` remains.
- The six Admin pooling view tests use shared typed fixtures without an `as never` cast or an
  untyped `Record<string, unknown>` controller bag; their test names and counts remain intact.

## Blocker Accounting

The Indexer localhost bind failure is an environment capability blocker in a suite selected from
the broader Wave 0-to-Wave 1 aggregate, not a failure in the Wave 1 implementation surfaces. It
remains open for a host that permits loopback listeners and is not treated as a passing receipt.
