# Pooling Rehearsal Follow-ups — W3-A Members act, everyone reads

## Lane

- Execution sub-lane: `w3a_members_act` (machine lanes `ui` and `state_api`)
- Branch: `fix/commitment-take-up-membership`, cut from `origin/develop` at `e5bf40de0`; this hub
  update is its first commit
- Depends on: nothing. W3-B to W3-F wait for it.
- Merge: the implementing session merges with `--merge` once CI Gate is green and the Codex and
  CodeRabbit threads are resolved
- Class: critical. It changes commitment mutation hooks and the act table the inbox count reads,
  so the push plan takes the selector's full override.
- Linear child: `status.json` → `execution_sub_lanes.w3a_members_act.linear.issue`
- Decisions: § 1 rows 41, 42 and 43 (`qa-readiness-plan.md`)

## Scope

N37, N38 and the queue half of N35. The sign-out seen after a wallet take-up belongs to W3-E and
only after the solo reproduction confirms it.

## What the code does today (read 2026-09-26 at `a3bae421b`)

- `selectCommitmentActKind` (`packages/shared/src/modules/commitment-pooling/acts.ts:106-131`)
  decides the screen's one act from the seat, a pending job and creatorship. A signed-in reader who
  is neither provider, confirmer nor contributor seats as `bystander`
  (`modules/commitment-pooling/selectors.ts:135`) and on an OFFERED or REQUESTED record is offered
  `takeUp` or `askToTakeUp`.
- `useCommitmentViewerRoles`
  (`packages/shared/src/hooks/commitment-pooling/useCommitmentViewerRoles.ts:95,104`) derives
  `isMemberHere` and `claimGardens.member` from the indexer roster through
  `isGardenMember(viewer, gardeners, stewards)` with no garden id, so the fifteen-minute pending-join
  overlay in `hooks/garden/useJoinGarden.ts` never counts. The same hook already reads steward and
  owner from chain through `useHasRole`.
- The controller (`packages/shared/src/hooks/client-ui/commitment/useGardenCommitmentController.ts:129-136`)
  hands the act selector no membership; `canJoinTeam` on the next line does receive it.
- In wallet mode `sendFromTap` (`hooks/commitment-pooling/useCommitmentJobs.ts`) parks a job the
  executor judges waiting (`modules/commitment-pooling/job-executor.ts:121-131`: a garden role probe
  that returns false or null) and reports `queued`; a send that fails for any reason other than a
  declined prompt also keeps its job. `JobQueueProvider` is mounted for every sign-in mode by
  `packages/client/src/routes/AppShell.tsx:96`, auto-flushes only for passkey and embedded
  (`providers/JobQueue.tsx:352`), and exposes `retryAndSend`.
- `packages/client/src/views/Home/Garden/Commitment/GardenCommitment.tsx:173-180` swaps the act bar
  for `app.commitment.queue.waiting` while `hasPendingJob`. Send and Discard exist only in
  `Pool/PendingCreationRow.tsx` (creations) and `Commitment/FailedActAlert.tsx` (jobs that gave up).
  `useCommitmentQueueState` exposes `pendingCommitmentIds` and `failedJobs`, not the waiting job.

## Steps

1. **Membership in the act table (N37, row 41).** `CommitmentActInput` gains
   `isMember?: boolean`, where `undefined` means not read yet. In the pre-acceptance branch a
   `bystander` gets `takeUp` or `askToTakeUp` only when `isMember === true`; `false` and
   `undefined` return `null`. Provider and confirmer keep `withdraw`. `commitmentNeedsSeat` and the
   inbox's "needs you" count read the same table, so a visitor's row never counts.
2. **One membership answer (N38, row 42).** `useCommitmentViewerRoles` adds
   `useHasRole(route, who, "gardener", chainId)`, passes `garden.id` (and `entry.id` inside
   `claimGardens`) to `isGardenMember` so the join overlay counts, and returns
   `isMemberHere: boolean | null` (`null` while the chain read is loading and the roster is not
   there) plus `membershipKnown`. Steward and owner still count as members.
3. **Controller.** Pass `isMember` to the act selector and expose
   `membership: { isMember, garden: { address, name, openJoining } }` for the screen. The claim
   payload, `claimNeedsContext` and the protocol claim-context sheet stay as they are.
4. **The join line (row 41).** New `Commitment/JoinToAct.tsx`, rendered under `CommitmentIdentity`
   when the record is OFFERED or REQUESTED and `membership.isMember === false`. One sentence,
   `app.commitment.join.line` ("Join {garden} to take this up"), and one act: Join Garden through
   `useJoinGarden().joinGarden(garden)` when the garden is open to join, otherwise Ask to Join,
   which navigates to the garden screen (`../..`) where the request flow already lives. Nothing
   renders while membership is unknown.
5. **The queued act row (N35, row 43).** `useCommitmentQueueState` adds
   `pendingActs: ReadonlyMap<string, PendingCommitmentAct>` keyed by decimal commitment id with
   `jobId`, `kind`, `waitingReason` (`job.meta?.waitingReason`) and `discardable`. New
   `Commitment/QueuedActRow.tsx` beside `FailedActAlert`: it names the act
   (`app.commitment.queue.act.waiting`: "{act} is waiting to send from this phone";
   `app.commitment.queue.act.waitingMembership` when the reason is `membership-unavailable`) and
   offers Send Now through `useJobQueue().retryAndSend(jobId)` and Discard through
   `jobQueue.discardJob(jobId)` when discardable. `GardenCommitment` renders it in place of the
   waiting paragraph, in both sign-in modes; the flush and the tap share `processJob`.
6. **Copy.** New keys in `en`, `es` and `pt`; vocabulary check clean. Acts in Title Case.
7. **QA catalog.** Retire the cases whose expected result changes and add successors: a visitor
   sees the commitment, no act and the join line; a member who joined within the last minutes can
   take up; a parked act shows Send Now and Discard. Ids continue the catalog's sequence, and a
   journey case means all three locale files.

## Tests (RED first)

- `packages/shared/src/__tests__/commitment-acts.test.ts`: an `it.each` table over
  `bystander × isMember {true, false, undefined} × {OFFERED, REQUESTED}`; provider and confirmer
  rows unchanged.
- `packages/shared/src/__tests__/hooks/client-ui/useGardenCommitmentController.test.tsx`: a visitor
  gets `actKind: null` and `membership.isMember === false`; a member present only in the
  pending-join overlay gets `takeUp`; a member by chain role only, with a stale roster, gets
  `takeUp`.
- A `useCommitmentViewerRoles` test for the overlay and the chain read (new file under
  `__tests__/hooks/commitment-pooling/` if none exists).
- A `useCommitmentQueueState` test: a waiting claim job appears in `pendingActs` with its reason
  and discardability.
- `packages/client/src/__tests__/views/GardenCommitment.test.tsx`: the join line renders for a
  visitor and not for a member; the queued act row renders Send Now and Discard and calls
  `retryAndSend` and `discardJob`.

Use `createTestQueryClient` and `createTestWrapper`; a new test may not build a bare
`new QueryClient()` (test-quality Check 6). Mocks that stub `useCommitmentPooling` must list every
hook the controller reads.

## Rendered proof

Mock-auth localhost (`?mockAuth=user&mockPooling=1&presentation=pwa`) at 375: the visitor cast,
the member cast and the queued row (seed a waiting job through a story or the demo queue).
Storybook stories for `JoinToAct` and `QueuedActRow`. Label every capture with engine and session.
The authenticated wallet walk stays pending for the recorded call and is recorded as pending in the
PR body.

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/commitment-acts.test.ts src/__tests__/hooks/client-ui/useGardenCommitmentController.test.tsx
bun run --filter @green-goods/client test -- src/__tests__/views/GardenCommitment.test.tsx
bun run --cwd packages/shared typecheck -- --scope full
bun run --cwd packages/client typecheck -- --scope full
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --test-path shared:src/__tests__/commitment-acts.test.ts --test-path client:src/__tests__/views/GardenCommitment.test.tsx
```

The critical plan keeps its full override. `browser-proof` is advisory and stays pending.

## Out of scope

The wallet sign-out (W3-E, after the reproduction), the commitment screen's chrome (W3-B), every
admin surface, the executor's membership probe (it remains the chain's gate), and any contract or
indexer change.

## Unblock evidence

RED and GREEN recorded here and through
`node scripts/harness/plan-hub.mjs record-tdd --feature commitment-pooling --lane ui ...`; the PR
open against `develop` with the catalog ids it retires and adds; CI Gate green; bot threads
resolved. Then the sub-lane moves to `completed` and the Linear child to Done.

## Validation Receipt

Pending. The implementing session fills it in the cockpit's shape: tested commit SHA, UTC time,
exact commands, results, validated paths, and the worktree identity check.
