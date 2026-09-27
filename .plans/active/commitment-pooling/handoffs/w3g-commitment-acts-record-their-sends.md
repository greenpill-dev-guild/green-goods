# Pooling Rehearsal Follow-ups — W3-G Commitment acts record their sends

## Lane

- Execution sub-lane: `w3g_commitment_send_record` (machine lane `state_api`)
- Branch: `fix/commitment-send-record`, from a fresh `origin/develop` after W3-A merges; it runs
  before W3-B because it touches no visual rule (§ 1 row 49)
- Depends on: `w3a_members_act`
- Merge: `--merge` on green CI and resolved bot threads
- Class: critical (the shared JobQueue module and its commitment executor)
- Linear child: `status.json` → `execution_sub_lanes.w3g_commitment_send_record.linear.issue`
- Decision: § 1 rows 48 and 49

## Scope

N41. Every commitment act that sends a call (`claim`, `evidence`, `workLink`, `confirmation`)
records its send the way work and decisions do, settles a recorded send instead of sending it
again, and takes Discard from that record. The two creations keep their `submittedTxHash` path.

## What the code does today (read 2026-09-26 at `4615608d9`)

- `modules/job-queue/queue-policy.ts`: `SEND_RECORDS` lists `work` and `approval` only.
  `hasRecordedSend`, `writeSendCheckpoint` and `sendCheckpointOf` follow that table, and
  `isDiscardableJob` (`job-recovery.ts`) refuses only a synced job and a job with a recorded send,
  a retained broadcast or a `submittedTxHash`.
- `modules/work/send-with-checkpoint.ts` is the one place the protocol lives: an intent
  (`broadcastPending`, `broadcastPendingAt`) just before the call can reach the network, then the
  broadcast reference and the transaction. Its result is `sent`, `reverted`, `not-sent` (intent
  cleared) or `may-have-sent` (record kept).
- `modules/job-queue/approval-executor.ts` is a complete adopter: `settleRecordedSend` reconciles a
  recorded hash (`reconcileWorkTransaction`) or a UserOperation (`sender.reconcileBroadcast`) and
  hands a stranded intent to `settleStrandedDecisionIntent`.
- `modules/work/stranded-intent.ts` settles an intent no receipt can: it looks the send up from two
  minutes on, at most every five, and reopens it (`StrandedSendReopened`, waiting reason
  `send-intent-expired`) once the absence is confirmed thirty minutes after the send.
  `resolveStrandedSend` is module-private.
- `modules/job-queue/job-executors.ts`: `executeCommitmentQueueJob` builds the call and awaits
  `sender.sendContractCall` with no callbacks, so no reference is recorded or retained.
- `modules/commitment-pooling/job-executor.ts`: `executeCommitmentJob` reads the chain before
  sending for `commitmentSeries`, `commitment`, `workLink` and `evidence`. A `claim` and a
  `confirmation` have no such read.
- `modules/job-queue/process-job.ts` already treats a recorded send as sent. It skips the
  explicit-send hold, does not end the job on attempts, and turns a later failure into the
  `awaiting-confirmation` wait.
- `hooks/commitment-pooling/useCommitmentJobs.ts` documents the gap ("A commitment job records no
  broadcast checkpoint"). `useCommitmentQueueState.ts` passes each pending act to
  `isDiscardableJob`, which finds no record, so the queued-act row from W3-A offers Discard after a
  send that may have broadcast.

## Steps

1. **The record.** Add the four act kinds to `SEND_RECORDS` with the field `sendCheckpoint`. Check
   first that admission's re-enqueue identity ignores that field: the work-link comment in
   `executeCommitmentQueueJob` warns that a mutable payload field can make a legitimate re-enqueue
   look like a conflict. If it does not, keep the record out of the identity rather than moving it.
2. **The send.** Send through `sendWithCheckpoint` in `executeCommitmentQueueJob`, with a `record`
   that writes the original job (not the execution copy) and persists it. A revert clears the
   record and fails the attempt. `not-sent` keeps today's behavior, so a declined wallet tap is
   still discarded by `sendFromTap`. `may-have-sent` returns the `awaiting-confirmation` wait, so
   `processJob` persists it; a throw would reach its generic catch, which only emits an event.
   Simulate each act first: the wallet and embedded senders record the intent before
   `writeContract`, which estimates inside, so a refusal would otherwise read as a send that may
   have gone out.
3. **The settle.** Before sending, settle a recorded send: a hash by its receipt, a UserOperation
   through `reconcileBroadcast`, and a stranded intent through a commitment lookup in
   `stranded-intent.ts` (export or generalize `resolveStrandedSend`). The lookup reads the pool's
   event log. A pending-claim read cannot decide a take-up, because `ClaimsLib.declineClaim` deletes
   the record: a take-up landed when its request or its acceptance is in the log from after the job
   was created, even if a steward has declined it since. A work link is decided by the module's
   operation record, since its event carries no link identity.
4. **The copy.** The queued-act row names `awaiting-confirmation` and `send-intent-expired` in en,
   es and pt. Send Now on a row that waits for confirmation checks the chain; it does not send.
5. **The notes.** Update the `useCommitmentJobs` comment and the residual note in the W3-A handoff.

A partial version is worse than none. A send on record with no settle path would be sent again on
every run, and `process-job.ts` would never end it on attempts.

## Tests (RED first)

- An executor or seam test: a claim whose receipt wait fails keeps a recorded hash, is not
  discardable, and its next run settles it without a second send.
- Every act kind (`claim`, `evidence`, `workLink`, `confirmation`) settles each recorded form, a
  receipt, a UserOperation and a stranded intent, without a second send.
- The lookup, per kind: a take-up declined before the lookup ran still counts as landed, and a
  request from an earlier ask does not; a proof by its CID; a confirmation by its confirmer; a work
  link by the module's record.
- A stranded intent reopens after the grace window when the lookup confirms the absence, and
  completes when the lookup finds the act.
- A declined prompt leaves no record, so the act stays discardable.
- `useCommitmentQueueState`: a recorded send marks the pending act not discardable.

## Implementation notes (2026-09-26)

- `queue-policy.ts`: `SEND_RECORDS` gains `claim`, `evidence`, `workLink` and `confirmation`
  (field `sendCheckpoint`), so `hasRecordedSend`, `writeSendCheckpoint` and `isDiscardableJob`
  follow. `recordsSends(kind)` answers which kinds do. `payloadWithoutSendRecord` lets `addJob`
  compare two records of the same act without the record, so a second tap joins the job instead of
  throwing `offline_job_identity_conflict`.
- `send-with-checkpoint.ts`: `settleRecordedSend` is the one settle step for a send on record (a
  receipt, a UserOperation, or the caller's stranded settle). The decision executor uses it in
  place of its private copy. `settleUnanswered` lets a caller settle a transaction no receipt
  answers; without it the send is waited on, as work and decisions still are.
- `commitment-send-record.ts` (new): `sendRecordedAct` sends an act through `sendWithCheckpoint`
  with the record written on the stored job; `settleActSend` settles a recorded act; both return
  `awaiting-confirmation` and `send-intent-expired` as waits, the way the work and decision
  registry entries do, while a declined prompt still throws so `sendFromTap` discards it. Each
  send holds a Web Lock named for its job (`green-goods:queue-send:<job id>`) from just before its
  intent until its answer. A lock held elsewhere leaves the act to that tab, and the settle reads
  the same lock before it reopens anything. A browser without Web Locks never reopens a lost act:
  it completes when the chain shows it landed.
- `commitment-landed-lookup.ts` (new): the stranded lookup. A take-up landed when the indexer's
  record of its claimant's request matches it whole (claimant, requester, kind and garden context)
  and follows the send's intent, or when the log holds the claimant's acceptance after the intent,
  whatever came next. The device clock is set against the chain's latest block before comparing,
  with two minutes of tolerance, so a request from an earlier ask does not count. A proof is
  matched by its CID, a confirmation by its confirmer, a submission by the ready-for-confirmation
  event, and a work link by the module's operation record. A work link's transaction comes only
  from the row the indexer ties to its operation key, at that block time and log index, never from
  another link by the same person. The log is read a page at a time, up to ten pages of 200 rows, and a busier window answers
  unknown. An absence answers absent only once the indexer's processed block, timed on chain, is
  past the send's grace window.
- `stranded-intent.ts`: `resolveStrandedCommitmentIntent` and `settleStrandedCommitmentIntent` run
  the same grace window as work and decisions. A reopened act clears its record and waits for the
  person's Send Now (`requiresExplicitSend`). A recorded transaction no receipt answers, such as a
  Safe's own id, is looked up too: its landing completes the act, and its absence never reopens it.
  Nothing reopens while a tab still holds the act's send.
- `commitment-chain-reads.ts`: `simulateSend`. The wallet and embedded senders record the intent
  before `writeContract`, which estimates inside, so each act is simulated first and a refusal
  fails before any intent.
- `useCommitmentQueueState`: a pending act's reason is `awaiting-confirmation` whenever a send is
  on record, and a stale stored `awaiting-confirmation` never outlives its record.
- Client: `QueuedActRow` says `confirming` and `notSent`, and a send on record offers Check Again
  and no Discard. Three keys in en, es and pt. Stories: `ProofAlreadyBroadcast` now carries the
  confirming state; `NeverReachedTheNetwork` is new.
- Two executor tests changed for the protocol: the send is called with the protocol's options,
  and the deferred-UID test now checks that no persisted payload carries `resolvedWorkUID`.
- QA catalog: PWA-126, the recovery walk for the recorded authenticated call (source `prd-996`);
  the id ledger is extended and the test-cases docs page regenerated.
- Codex's review of the plan PR #922 found the fast decline, the missing per-kind coverage, the
  thrown wait, and the authenticated walk; each is fixed here or in the steps above.

## Review round 1 on #923 (2026-09-27)

Codex reviewed `6bf248187` and `f745503fa` and left six findings. All six are fixed in
`6781a51b2`.

1. P1, indexer lag. An empty log read as absent even when the indexer trailed the chain by more
   than the grace window. An absence now needs the indexer's processed block, timed on chain, past
   the window.
2. P1, Safe ids. A transaction no receipt answers waited forever, even after the Safe executed it.
   The landed lookup now settles it by the act's landing, and never reopens it.
3. P1, frozen tab. A tab frozen with its wallet prompt open lost its execution claim, so another
   tab could reopen the act after the window and send it again. The per-job send lock stays with a
   frozen tab and is released by a closed one, and the reopen waits while it is held.
4. P2, paging. More than 200 rows in the window hid the send's row for good. The lookup now pages.
5. P2, clock drift. A device clock more than two minutes ahead put the take-up's own request below
   the floor. The floor is now on the chain's clock.
6. P1, claim identity. A request by the same person for another garden completed the wrong job. The
   match now reads the indexer's claim-request record in full.

Residuals, recorded rather than fixed:

- A tab closed with its wallet prompt still open in the extension can send after the window, once
  its lock is gone. The contract refuses a second proof with the same CID, a second confirmation
  and a second submission, a repeated work link is a no-op, and an open take-up cannot be accepted
  twice. The one harmful double is an approval-gated take-up that a steward declined in between:
  its late request asks again.
- Work and decisions keep the older rules. A transaction no receipt answers still waits, and their
  lookups read EAS's indexer with no freshness check and no send lock. Left for a follow-up.

## Review round 2 on #923 (2026-09-27)

Both bots reviewed `e43476bef`. CodeRabbit requested one change. The lookup matched a work link's row by
its caller alone, so a second work the same person linked to the commitment in the window could
lend the job its transaction. `15476ac0a` reads the indexer's work attribution by operation key
(`getWorkLinkByOperation`) and takes only the row at that link's block time and log index. The
module's operation record still decides whether the link landed. Until the indexer ties the key to
a row, the lookup answers unknown. CodeRabbit's suggested patch, never matching a row, would have
left every recovered link waiting for good, so it was not applied as written. A work relinked under
another key within the window also waits, since the attribution keeps only the latest link.

Codex found two more, both fixed:

1. P1, no Web Locks. A browser without Web Locks read as one where no tab held the send, so the
   frozen-tab double could still happen there. `826b65352` makes it fail closed, like a failed lock
   read: the act waits and completes when the chain shows it landed. The executor's settle now
   takes an injectable lookup (`lookUpLanded`), so a test drives the real settle through all three
   lock states.
2. P2, this handoff. "Unblock evidence" listed the closing conditions without saying which were
   still open, so it read as a completion record. It now marks each one.

## RED and GREEN evidence

RED at `4615608d9` plus the new tests, `bun run test -- src/__tests__/modules/job-executors.test.ts src/__tests__/modules/job-queue.seam.test.ts src/__tests__/commitment-queue-state.test.tsx` in `packages/shared`: six failed, each as the gap predicts (`offline_job_identity_conflict` on a re-tap; `receipt timeout` and `connection lost` rejected instead of waiting; a stranded act completed by sending again; a refused act resolved `complete`; `discardable: true` on a recorded send). The declined-prompt guard passed, as it should.

The fast decline, found later, was RED on its own: against `6bf248187`'s lookup, "reads a request a
steward declined before the lookup ran" failed (1 of 13) and passed after the fix.

GREEN: the same files plus `commitment-landed-lookup.test.ts` and `stranded-intent.test.ts` pass,
and the per-kind settle table passes for all four act kinds.

Review round 1 was RED against `f745503fa` with the new tests: twelve failed in
`commitment-landed-lookup.test.ts`, `stranded-intent.test.ts` and `job-executors.test.ts`, each as
its finding predicts. Requests for another garden and through another garden's membership read
found. A ten-minute clock lead and a busy second page read absent or unknown instead of found, and
a trailing indexer read absent. A Safe id waited instead of completing, for all four act kinds and
in the resolver. The send ran without its lock, and a held lock did not stop the reopen. All pass
at `6781a51b2`.

Review round 2 was RED against `e43476bef`: the work-link case returned the other link's
transaction, and it passes at `15476ac0a`. The no-locks case was RED against `c8fc57412` (a lost
act with no Web Locks was offered again, `send-intent-expired`) and passes at `826b65352`.

## Rendered proof

Storybook: the queued-act row's two new waiting states, labelled. This lane changes the shared
JobQueue, which is in the authenticated-session class (AGENTS.md § Browser Evidence), so the
authenticated walk is required and stays pending until the recorded call: PWA-126 walks a take-up
whose confirmation is lost, with Rabby.

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/modules src/__tests__/hooks/commitment-pooling
bun run --cwd packages/shared typecheck -- --scope full
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --test-path shared:src/__tests__/modules/job-queue.seam.test.ts
```

The critical plan keeps its full override, and the `shared-job-queue-construction` seam is
re-certified if its fingerprint moves. Adjust the test paths to the files that exist.

## Out of scope

The creations' `submittedTxHash` path; the claim-context findings N42 and N43; discarding a Safe
transaction that is never executed, which waits as work and decisions do.

## Unblock evidence

The lane closes when all of these hold. As of 2026-09-27:

- RED and GREEN recorded: done, under RED and GREEN evidence.
- PR #923 merged: not yet.
- PWA-126 walked on the recorded call: pending.
- Then the sub-lane moves to `completed` and the Linear child to Done; until then it stays open.

W3-H starts once #923 merges (§ 1 row 49); it does not wait for the walk.

The proof is recorded here, under RED and GREEN evidence. The `state_api` machine lane's TDD record
holds W1-1's proof and belongs to Codex's lane, so `record-tdd` is not run over it.

## Validation Receipt

- Tested implementation commit SHA: `826b65352` (on `fix/commitment-send-record`, PR #923)
- Run at (UTC): `2026-09-27T04:07:44Z` to `2026-09-27T04:11:39Z`
- Exact command(s): in `packages/shared`, `bun run typecheck -- --scope full` and `bun run test`; in `packages/client`, `bun run typecheck` and `bun run test`; at the root, `bash scripts/quality/check-test-quality.sh`, `bun --bun run oxlint packages/client/src packages/shared/src --deny-warnings` and `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`. The catalog checks, `bun run --cwd packages/qa build`, `node scripts/quality/check-qa-id-ledger.mjs --base origin/develop` and `bun --bun x vitest run --dir scripts/agents`, last ran at `6781a51b2`; no catalog, ledger or agent-tool file has changed since.
- Result: shared typecheck exit 0; shared 5,915 passed in 543 files; client typecheck exit 0; client 1,413 passed in 143 files; test quality passed; oxlint exit 0; source structure passed against `origin/develop`. At `6781a51b2`: QA build 354 active cases; ledger 420 ids, none removed; agent tools 260 passed. The previous head `c8fc57412` passed the critical pre-push plan, all 30 checks over 32 paths.
- Validated paths: every non-plan path the branch changes, `git diff --name-only origin/develop 826b65352 -- . ':!.plans'` (27 paths)
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <the validated paths>` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 826b65352 -- <the validated paths>` → exit 0 before this handoff commit, which changes only `.plans`
- Rendered proof: Storybook on this checkout, desktop app Browser pane, 375 emulation, captured at `6bf248187`: `client-commitments-queuedactrow--proof-already-broadcast` in light and dark ("Your proof has left this phone and is waiting for the network to confirm it", Check Again, no Discard) and `--never-reached-the-network` in light ("Your take-up never reached the network", Discard and Send Now). `git diff --exit-code 6bf248187 826b65352` over the row, its stories and the shared i18n files exits 0. Labelled Storybook; the authenticated walk, PWA-126 with Rabby, stays pending for the recorded call.
