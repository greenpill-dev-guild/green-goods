# Voucher booking experience: UI handoff (PR C, App; PR D, Hub)

## Lane

- Owner: Claude
- Branches: `claude/voucher-flow-prototype-7302a8` (PR B, the tracker's waiting state), `claude/voucher-booking-page-579104` (PR C), `claude/voucher-hub-queue-921ed9` (PR D)
- Status: in progress

## Scope

- Implement the UI behavior accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep hooks, query keys, and shared state in `@green-goods/shared`.

## TDD Proof

- PR B, `FormProgress` waiting state. RED: the new `WaitingOnSomeoneElse` story run against develop's `Progress.tsx` failed (`Expected element to have text content`, 1 failed, 5 passed) with `bunx vitest run --config vitest.storybook.config.ts --project=storybook ../client/src/components/Communication/Progress/Progress.stories.tsx` from `packages/shared`. GREEN: the same command with this branch's `Progress.tsx` passed 6 of 6.
- PR C, the App booking page (#1737). Each behavior change had a failing test first, run with `bun run test -- <files>` from `packages/client`:
  - Page, tracker, pill, facts, plain words, sheets' tracker, rows' Needs you: the updated booking tests failed on the old code, 126 failed and 232 passed across `ServiceBooking.test.ts`, `ServiceBookingMember.test.tsx`, `ServiceSplitSheet.test.tsx`, `ServiceBookingRecovery.test.ts`, `ServicePromise.test.tsx`, `GardenCommitment.test.tsx`, `VouchersTab.test.tsx` and `CommitmentsSheet.test.tsx`.
  - Follow-ups, each red first: Progress and proof on an open offer (1 failed), the issuer sheet's three markers (1), the wallet rows needing wagmi's provider (6), the Book marker and DL-196 wording (the marker cases and three wording cases), the deposit wait promising a notice (1).
  - Review round 1, run against HEAD's source for the nine changed modules before restoring the fix: a dispute after delivery, Start as Needs you, the stuck confirmation, a cancellation before any deposit, and holding Team and History during an unresolved read (6 failed, 5 passed).
  - Review round 2, against HEAD's source: a dispute raised on a proposed return (hub day and access) and the stuck confirmation's voucher count (3 failed); Team on an ordinary promise while the service read is pending (1 failed, 1 passed).
  - GREEN: the focused booking files pass (373 in round 1, 364 in round 2), and the full client suite passes (see the receipt below).
- PR D records its own proof here when it opens.
- Proof limit: none recorded

## Validation

- Pending lane implementation.

## PR C Validation Receipt

- Tested implementation commit SHA: `0d50721c648a62fd79b070f33d0b28c523ec12e5`
- Run at (UTC): `2026-11-20T01:41:04Z`
- Exact command(s): `bun run test` and `bun run typecheck --scope tests` (packages/client); `bun run check --only dead-code`; `bash scripts/design/check-tokens.sh`; `bunx vitest run --config vitest.storybook.config.ts --project=storybook` on `Progress.stories.tsx` and the eight touched client story files (packages/shared)
- Result: client suite 183 files, 2595 tests passed; test type check clean; dead code passed; tokens passed; story plays 81 of 81 passed
- Validated paths: `packages/client/src/views/Home/Garden/Commitment`, `packages/client/src/views/Home/WalletSheet`, `packages/client/src/views/Home/CommitmentsSheet`, `packages/client/src/views/Profile/ServiceIssuerApproveSheet.tsx`, `packages/shared/src/i18n`, `packages/shared/src/hooks/commitment-pooling/index.ts`, `packages/shared/.storybook`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/client/src packages/shared/src packages/shared/.storybook` → empty
- Known limit: the Live tab counts a booking's own Needs you while the sheet is open (red first: the tab read nothing, then 1); Home's badge still counts the inbox alone until PR H adds the Shared read (`useCommitmentsAttention`).

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Record blockers here before changing `status.json`.
