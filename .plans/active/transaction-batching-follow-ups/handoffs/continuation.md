# Transaction batching follow-ups

PRD-1399 and PRD-1054 remain open. The user accepted code fixes and automated proofs, live signing preparation, and explicit remaining decisions. This working tree contains the implementation; no commit, push, deployment, enablement change, broadcast or Linear closure was performed.

## Delivered behavior

- Five routes share the capability-query owner, scoped by account, chain and connector. Unlisted routes do not probe a wallet.
- Budgeted plain-wallet action edits journal each field, persist proven progress before the next prompt, preserve the remaining draft, and hold unknown outcomes across reload. Atomic availability remains separate from sequential recovery.
- The Hub retains loaded reviews when a refresh fails. A proven decision remains visible while the list observer catches up. Unknown decisions do not borrow approval or rejection from a draft. Tablet clearance reserves the space below the raised review bar so the final row can scroll above it.
- Octant can prepare the exact reviewed WETH shortfall, optional allowance reset/approval and deposit as one atomic request. Send-time capability loss stops instead of splitting the request. The mainnet rail stays unlisted with provisional budgets awaiting fork/live evidence.
- ADM-199 now explicitly tests reward retention for a taken, unkept promise. Its generated documentation was refreshed; the live case was not executed.

The group-refusal parsing issue was already fixed by `72f1cf75c`; a regression now checks the real reader-to-formatter path. A measured 800×700 Storybook Chromium run reproduced the Hub overlap after an earlier run had not established the effective iframe viewport. With the narrow CSS fix, the settled final row ends at 274 px and the bar starts at 286 px: 12 px clearance, with the row clickable. Six Hub stories passed in that final run. The archived AC-01–27 matrix is reconciled in [eval](../eval.md), without treating earlier receipts as fresh evidence.

## Proof and limitations

Lane evidence, including RED runs and intermediate failures, lives in [capability recovery](capability-recovery.md), [Hub reviews](hub-review-fixes.md), and [Octant checkout](octant-checkout.md). The repository selector retained Shared's critical owner and consumer checks. The explicit task-path checkpoint ran 2026-11-07T21:05:37Z–21:21:39Z; its log is `/tmp/transaction-batching-checkpoint-final.log` and [exact argv is retained here](checkpoint-command.json). It exited 1: 22 fresh passes, two documentation failures, no unrun checks, and advisory authenticated browser proof pending. No failed result is reused or called green.

| Final working-tree proof | Observed result |
|---|---|
| Shared source/test types and full suite | Passed; 720 files, 9,505 tests passed, 14 existing skips |
| Client source/test types and full suite | Passed; 180 files, 2,346 tests passed |
| Admin source/test types and full suite | Passed; 165 files, 1,650 tests passed |
| Agent source types and full suites | Passed; 51 unit files / 604 tests and 23 SQLite files / 256 tests; one existing skip |
| Agent test types | Passed separately: `bun run --cwd packages/agent typecheck --scope tests`; `/tmp/transaction-batching-agent-test-types-final.log` |
| Static checks | Formatting, lint, staged module boundaries, source structure, design guardrails, QA ID ledger, story quality and em-dash checks passed |
| Builds | Docs and Storybook passed |
| Agent tooling | 11 files, 260 tests passed at baseline timeouts, including the QA catalog tooling |
| Docs tests after approved dependency restore | `bun run --cwd docs test`: 142 passed, zero failed across 10 files, 26.08 s; `/tmp/transaction-batching-docs-tests-restored.log` |
| Task-owned QA projection | `node scripts/docs/generate.mjs --scope qa --check` passed |
| Rendered proof | Storybook/headless Chromium: 15 coordinated checks passed; final settled tablet run passed six Hub checks with measured 12 px clearance |

All 14,361 application tests passed. These results concern the uncommitted working tree; they are not current-head GitHub CI, authenticated signing proof or release readiness.

Additional Add and Send proof:

- `bun run --cwd packages/shared test src/__tests__/commitment-proof-and-send.test.ts src/__tests__/commitment-jobs-hook.test.tsx src/modules/transactions/__tests__/prepared-batch.test.ts`: 3 files, 58 passed; started 2026-11-07 20:08:33 UTC, 309.19 s.
- `bun run --cwd packages/shared test src/__tests__/modules/job-executors.test.ts -t 'Add and Send in one request'`: 1 passed, 102 intentionally filtered; started 2026-11-07 20:28:01 UTC, 80.32 s. Real queue/executor behavior with an in-memory journal and fake sender proves decline retention and explicit proof-first retry. It is not live atomic signing evidence.

Initial combined typechecks found a widened test literal, missing typed story properties and an undeclared public hook import; those were corrected. The first source-structure check found checkout over its frozen size ceiling; coherent deduplication brought it under the existing ceiling. Final integration also pauses unknown/failed wallet capability reads and suppresses premature signature counts; its Shared hook suite passed 24/24 and Client suites passed 54/54. No baseline, threshold, dependency or lockfile was relaxed.

The full checkpoint then found two documentation failures outside this task's source changes:

- `docs-authority`: all 81 generator/audit tests passed, but the API index source digest is stale. Rendering to `/tmp/transaction-batching-api-index-expected.mdx` showed only the `source_digest` differs. Its modified inputs are the concurrent `packages/agent/src/api/routes/public-garden-impact.ts` and `packages/agent/src/api/server.ts`; none of this task's paths feeds that projection. That generated file was left untouched. The task-owned projection passes `node scripts/docs/generate.mjs --scope qa --check`.
- `docs-test` initially had 100 passed, 1 failed with 1 import error because `@tinacms/graphql` could not be resolved. Version 4.1.0 was already declared in `docs/package.json` and `bun.lock`, but its workspace link and Bun store package were absent. This blocker was resolved after the user explicitly approved restoration, as recorded below.

### Approved dependency restoration

On 2026-11-07 the user approved restoring locked dependencies. `bun install --frozen-lockfile` completed successfully, restoring 651 packages in 3.97 s and running the existing postinstall/prepare hooks. `@tinacms/graphql` resolves to 4.1.0. SHA-256 comparisons of all 12 tracked dependency inputs confirmed that package manifests, `bun.lock` and `bunfig.toml` are unchanged; the release-age gate remains in place. Log: `/tmp/transaction-batching-dependency-restore.log`.

`bun run --cwd docs test` then passed all 142 tests across 10 files. The original authority command was rerun unchanged:

```sh
node --test scripts/docs/generate.test.mjs scripts/docs/mermaid-parse.test.mjs docs/scripts/docs-audit.test.mjs docs/scripts/developer-guides.test.mjs && node docs/scripts/docs-audit.mjs --ci && node scripts/docs/generate.mjs --check
```

Its 81 tests and authority audit pass, with the same two advisory editorial warnings; the final generated-output check still exits 1 only for the unrelated API-index digest. Log: `/tmp/transaction-batching-docs-authority-restored.log`. No application source, dependency version, lockfile, or unrelated generated file was changed during this follow-up. The earlier application-suite receipts retain their original timestamps; they were not rerun or relabeled as post-install proof.

The full checkpoint is therefore still not claimed green: the dependency blocker is resolved, while the unrelated API-index digest and authenticated live proof remain open.

Shared's Storybook preview has three additional spy registrations for the real checkout stories. This is the only tracked harness configuration change. New stories keep mocks local and reset them. Browser-extension inventory was unavailable; local rendered proof uses Storybook headless Chromium with mocked data, not an authenticated signing session.

[Live proof](live-proof.md) contains the paired Add and Send decline/reload/retry walkthrough, other rail prerequisites, provider-limit evidence and copy decisions. It also names two pre-existing sequential Octant limits found in review. Neither issue can be closed from these local checks.

## Workspace boundary

Current branch: `fix/work-approval-feedback`; initial HEAD `7e2792d00ab32011bd9475708ca57b7483ec2bd5`. All new receipts are working-tree evidence. Lanes remain in progress until publication is authorized and clean commit-attributed proof exists. The parent-only Linear manifest preserves the existing In Progress state.

Other sessions are editing public garden-impact readers/API files and backlog plans. Those changes were not edited, staged, reverted or formatted here. Final checks use an explicit task-owned path list for scoped formatting and linting; whole consumer suites may still observe concurrent workspace changes.

## Task record

Task: PRD-1399 / PRD-1054 | Type: fix | Outcome: local implementation, proof preparation and approved dependency restoration complete; unrelated API-index drift and live acceptance remain pending
Agent/model: Codex / unknown | Coverage: scope-locked implementation and the approved dependency-restoration follow-up

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → 2026-11-07T20:13:19Z | Live issues, archived hub, owning code and repository guidance inspected; user accepted code fixes and proof preparation |
| implement | 2026-11-07T20:13:19Z → 2026-11-07T21:05:37Z | Coordinated Shared/Admin/Client lanes; sources stable for combined verification |
| verify | 2026-11-07T20:08:33Z → 2026-11-07T21:21:39Z | Automated and rendered evidence above; 22 checkpoint passes, two separate docs failures, advisory live proof pending |
| review | unknown → 2026-11-07T21:21:39Z | Critical changed lines and consumers reviewed; decision provenance, capability pause and settled geometry corrections verified |
| wait | unknown → 2026-11-07T22:54:26Z | User explicitly approved restoration of locked dependencies |
| implement | 2026-11-07T22:54:26Z → 2026-11-07T22:55:04Z | Frozen-lockfile restoration succeeded; all 12 dependency inputs unchanged |
| verify | 2026-11-07T22:55:04Z → 2026-11-07T22:57:05Z | Docs tests: 142 passed; authority tests: 81 passed, generated API-index digest remains stale |

Human corrections: 0 observed in this segment; attention: unknown. Phase intervals overlap and must not be summed as active effort.
