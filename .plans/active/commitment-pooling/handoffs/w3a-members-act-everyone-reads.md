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
   `useJoinGarden().joinGarden(garden)` when the garden is open to join, otherwise Request to
   Join (the garden screen's own words), which navigates to the garden screen (`../..`) where
   the request flow already lives. On the protocol pool no one garden is named, so the card says
   "Join a garden to take this up" and opens Home. Nothing renders while membership is unknown.
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

## Implementation notes (2026-09-26)

- On the protocol pool the route garden is the host, which the contract refuses as a claim
  context, so membership there never counts. The controller reads `canClaimHere` from
  `claimGardens` (member or stewarded, minus the host) on a protocol pool and from
  `isMemberHere` on a garden pool, and hands the act table `isMember` from that. The roles hook
  gained `claimGardensKnown` so an empty list while the garden list loads reads as unknown, not
  none.
- `isMemberHere` became `boolean | null`; `canJoinTeam` takes `=== true`. The only other reader
  of the flag was the controller.
- The act table gate is `isMember !== true`, so undefined (not read yet) offers nothing, like
  false; provider and confirmer still get Withdraw whatever the roster says.
- `useCommitmentQueueState` now exposes `pendingActs` (job id, kind, waiting reason,
  discardability) beside `pendingCommitmentIds`; the pool console test's queue helper gained the
  field. The screen keeps the old "waiting to send" sentence only when the queue cannot name the
  job (an unreadable queue).
- `QueuedActRow` is presentational; `QueuedActNotice` wires `useJobQueue().retryAndSend` and
  `jobQueue.discardJob`. `JoinToActCard` is presentational; `JoinToAct` wires `useJoinGarden` and
  the two navigations. Stories render the presentational halves.
- Catalog: PWA-084's expected result already said members only, so no case retires. PWA-123
  (visitor sees the card), PWA-124 (take up minutes after joining) and PWA-125 (a parked act
  with Send Now and Discard) were added, source `prd-990`, and the id ledger extended.
- Copy: fourteen keys in en, es and pt (`app.commitment.join.*`, `app.commitment.queue.act.*`,
  `app.commitment.queue.sendNow`); vocabulary check clean.

## Review round 1 (PR #921, 2026-09-26)

- Membership stays unknown until both the gardener read and the garden list have answered, and a
  failed list read is unknown, not "a member of none": knownness comes from the query's success,
  and the roles hook exposes `gardensUnavailable` and `retryGardens` (CodeRabbit, Codex).
- An unread pool record leaves eligibility unknown, so a host member is never offered a personal
  claim a protocol pool would refuse (Codex).
- When a read the answer depends on fails, the screen shows `MembershipCheckFailed` with Try Again
  instead of an empty bar or a join card.
- The queued-act row is locked while the screen's own send runs (`inFlight`), because `discardJob`
  checks broadcast state but not an active execution claim; a refused or failed Discard is said
  in the row and logged (Codex, CodeRabbit). A claim-aware `discardJob` would be the boundary fix
  and stays a candidate for the queue's own work.
- CI: the agent join-request suite had fixtures expiring at noon UTC on 2026-09-26 and read the
  real clock, so it failed on develop too; its clock is pinned to 2026-08-28. The QA test-cases
  docs page is regenerated from the catalog.

## Review round 2 (PR #921, 2026-09-26)

- `discardJob` now refuses a job whose send holds its execution claim. Every `processJob` takes
  that claim through `acquireWorkJobs`, commitment acts included, so a discard during a tap, a
  passkey background flush, or another tab's send is refused and the row says so. The store port
  gained an optional `hasActiveExecutionClaim`, implemented by the IndexedDB store. RED: without
  the guard the new seam test fails `expected true to be false`. This touches the shared JobQueue
  module, so the push plan is critical.
- Membership is read the way the claim contract tests it: `readGardenMembership` asks all six
  role views (GuardLib.isGardenMember accepts every hat, funder and community included) and
  returns null when a read fails, and `useGardenMembership` keeps that null as unknown instead of
  `useHasRole`'s "no". The roster fallback and the protocol pool's claim gardens count all six
  role lists. The roles hook exposes `membershipUnavailable` and `retryMembership`, which read the
  garden list and the chain again.

## Review round 3 (PR #921, 2026-09-26)

- A send keeps its execution claim alive for its whole length: `processJob` holds the claim with
  `holdWorkClaims`, which renews the 60-second lease every 20 seconds until the send settles, so a
  wallet or passkey prompt left open past a minute no longer lets it lapse (Codex P1).
- `discardJob` takes the job's claim instead of reading it, so the check and the delete are one
  held act: a running send refuses the discard, and no send can start while the discard runs. The
  port is `executionClaims.acquire`, wired to `acquireWorkJobs`; the read-only `execution-claims`
  module is gone. Proof: `job-queue.claim-hold.test.ts` (the hold stops before the claim is
  released) and the seam test (a refused claim refuses the discard; a granted one is released once).
- Ask Again honours the members-only rule: `canAskAgain` also needs `canClaimHere === true`
  (Codex P2).
- A completed chain read is the authority for the route garden. A chain "no" beats an indexed
  roster that still lists a revoked role, and only the pending-join overlay overrides it (Codex P2).
  The roster is read directly rather than through `isGardenMember`, whose cleanup erases the
  overlay once the roster lists the viewer. The protocol pool's claim gardens still come from the
  roster, because a six-role chain read for every garden is out of proportion.
- Residual: the lease renews on a timer, so a tab the browser freezes, or throttles to one timer a
  minute, can still let it lapse; the in-tab claim still blocks a discard from the same tab. The
  work upload's hold has the same limit. W3-G closes it for commitment acts: the send's intent is
  on the stored job before the prompt, so a lapsed claim lets another tab neither drop nor resend
  the act.
- The `shared-job-queue-construction` seam is re-certified after its three proof files passed.

## Review round 4 (PR #921, 2026-09-26)

- CodeRabbit and Codex found that a commitment act keeps no record of its send, so Discard can drop
  an act whose transaction may still land: a receipt wait that fails after the broadcast leaves the
  act looking unsent (N41). Afo decided that W3-A merges without it and that it becomes its own
  queue lane, W3-G (§ 1 row 48). Both threads point to the lane's Linear child.
- Codex found that the protocol pool leaves the host garden out of the personal claim contexts,
  which the contract accepts (N42), and that contexts other than the route garden are not checked
  against chain roles (N43). Both predate W3-A on develop and wait for Afo's call.

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

RED and GREEN as run on 2026-09-26:

- RED: with the membership guard removed from `acts.ts`,
  `bun run --filter @green-goods/shared test -- src/__tests__/commitment-acts.test.ts` fails
  "offers taking up only to a member of the garden, once membership is known" with
  `expected 'takeUp' to be null` (1 failed, 10 passed). The pre-change screen behaviour is also
  pinned by the client suite's earlier expectation that a bystander got `takeUp` without any
  membership input, which the change had to update.
- GREEN: the same command passes 11 of 11; the five shared files pass 37 of 37 and the two client
  files 52 of 52 (`/tmp` logs of the run, recorded in the Validation Receipt).

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

- Tested implementation commit SHA: `dfc08fa85` (PR #921's head; the squash merge `4615608d9` on `develop` has the identical tree)
- Run at (UTC): `2026-09-27T00:49:11Z`
- Exact command(s): the pre-push hook's `node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts`; before it, `bun run test -- src/__tests__/modules/job-queue.seam.test.ts src/__tests__/modules/job-queue.db.test.ts src/__tests__/modules/job-queue.imports.test.ts src/__tests__/modules/job-queue.claim-hold.test.ts` in `packages/shared`, and `bun run typecheck` and `bun run test` in `packages/client`
- Result: push gate, critical plan over 50 changed paths, "Automated checks passed" on all 30 checks (format, lint, validation-system-test, test-quality, the typecheck, test and build checks for shared, client, admin and agent, docs-authority, docs-test, docs-build, staged-modules, source-structure, design-guardrails, ontology, agent-guidance, qa-id-ledger, supply-chain, story-quality, agent-tools-test); `browser-proof` pending (advisory). The seam's three proof files and the claim-hold test: 38 passed. Client typecheck exit 0; client suite 1,412 passed in 143 files. GitHub CI on `dfc08fa85`: CI Gate passed, no job failed.
- Validated paths: every path PR #921 changed, `git diff --name-only e5bf40de0 dfc08fa85` (50 paths)
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- $(git diff --name-only e5bf40de0 dfc08fa85)` → empty at `dfc08fa85`, after the last commit and before the push; the unscoped status was empty too
- Evidence-only diff command and result (if applicable): `git diff --exit-code dfc08fa85 4615608d9 -- $(git diff --name-only e5bf40de0 dfc08fa85)` → exit 0, so the merged commit carries the tested tree on every validated path (run 2026-09-27 UTC)
- Rendered proof: Storybook on this checkout, desktop app Browser pane, 375 emulation, light: `client-commitments-jointoact--open-to-join`, `--steward-lets-you-in`, `--protocol-pool`; `client-commitments-queuedactrow--waiting-for-membership`, `--proof-already-broadcast`. Labelled Storybook; no mock-auth localhost run and no authenticated wallet proof, which stays pending for the recorded call.

An earlier receipt at `d5bc36434` (22:57 UTC, sensitive plan) covered the first push; review rounds 1 to 3 changed the tree after it.

## Merge

Merged 2026-09-27T01:15:51Z as `4615608d9` by squash, after CI Gate passed on `dfc08fa85` and CodeRabbit's change requests were dismissed on Afo's decision (§ 1 row 48). This handoff named `--merge`; the squash keeps the tree identical, and the branch commits cited above stay reachable at `refs/pull/921/head`. The sub-lane is `passed`. It becomes `completed`, and PRD-990 Done, after the authenticated wallet walk (PWA-123 to PWA-125) on the recorded call.
