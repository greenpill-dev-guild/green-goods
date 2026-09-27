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
  answers; without it the send is waited on, as work and decisions still are. A transaction the
  wallet saw replaced by a different call is kept and marked `transactionReplaced`, for every
  kind; only commitment acts read the mark. `send-outcome.ts` treats a contract refusal from an
  estimate (viem's `EstimateGasExecutionError`, JSON-RPC 3) as not sent, for every kind.
- `commitment-send-record.ts` (new): `sendRecordedAct` sends an act through `sendWithCheckpoint`
  with the record written on the stored job; `settleActSend` settles a recorded act; both return
  `awaiting-confirmation` and `send-intent-expired` as waits, the way the work and decision
  registry entries do, while a declined prompt still throws so `sendFromTap` discards it. Each
  send holds a Web Lock named for its job (`green-goods:queue-send:<job id>`) from just before its
  intent until its answer. A lock held elsewhere leaves the act to that tab, and the settle reads
  the same lock before it reopens anything. A browser without Web Locks never reopens a lost act:
  it completes when the chain shows it landed. Nor does an account with a transaction the network
  holds but has not mined (`hasPendingTransaction`), which may be the send itself, nor a passkey
  send whose UserOperation its bundler still holds (`userOperationMayLand`).
- `commitment-landed-lookup.ts` (new): the stranded lookup. Each act keeps the chain's head block
  and its time with its intent (`intentBlock`, `intentChainTime`, read just before the send). A
  take-up landed when a request or acceptance row's receipt holds its own event, matched whole
  (claimant, requester, kind and garden context), in a block after that head, whatever came next;
  an earlier ask sits in that block or before, however recently it was declined. A take-up kept
  without its head block is never settled by the log. A proof is
  matched by its CID, a confirmation by its confirmer, a submission by the ready-for-confirmation
  event. A work link landed when the module's record of its operation key holds this link's own
  payload (a deferred link resolves its work first), and its transaction comes from the caller's
  WorkLinked row in the activity log whose receipt carries the operation key.
  The log is read a page at a time, up to ten pages of 200 rows, and a busier window answers
  unknown, as does a row whose receipt cannot be read. An absence answers absent only once the indexer's processed block, timed on chain, is
  past the send's grace window.
- `stranded-intent.ts`: `resolveStrandedCommitmentIntent` and `settleStrandedCommitmentIntent` run
  the same grace window as work and decisions. A reopened act clears its record and waits for the
  person's Send Now (`requiresExplicitSend`). A recorded transaction no receipt answers, such as a
  Safe's own id, is looked up too: its landing completes the act, and its absence never reopens it.
  A transaction the wallet saw replaced is the exception: its absence reopens it. Nothing reopens
  while a tab still holds the act's send.
- `commitment-chain-reads.ts`: `simulateSend`. The wallet and embedded senders record the intent
  before `writeContract`, which estimates inside, so each act is simulated first and a refusal
  fails before any intent. `transactionMadeWorkLink` decodes one transaction's receipt and says
  whether it holds the module's WorkLinked event for this caller's operation key.
- `useCommitmentQueueState`: a pending act's reason is `awaiting-confirmation` whenever a send is
  on record, and a stale stored `awaiting-confirmation` never outlives its record.
- `process-job.ts`: a tap that finds a lost send never landed sends it again only for work and
  decisions (`sendsOnReopen`), whose button says Send. A commitment act's Check Again reopens it,
  and the next Send Now sends.
- Client: `QueuedActRow` says `confirming` and `notSent`, and a send on record offers Check Again
  and no Discard. `notSent` asks the person to reject any request their wallet still shows before
  sending again. Three keys in en, es and pt. Stories: `ProofAlreadyBroadcast` now carries the
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
  its late request asks again. Since round 7 the reopened act's message asks the person to reject
  any request their wallet still shows before sending again.
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

## Review round 3 on #923 (2026-09-27)

Codex reviewed `c8fc57412` and found three more, all fixed in `cbcd9d71a`.

1. P2, work-link cursor. A block time and log index repeat across fast L2 blocks, so the row match
   could still name another link's transaction. The indexer now gives the link's block number
   (`getWorkLinkByOperation`), and the chain's WorkLinked log in that block, matched by the
   operation key and linker the event carries, names the transaction. The work-link case no longer
   reads the activity log.
2. P2, stored payload. A nonzero record for the operation key was taken as this link landing, even
   when the key held another link. The lookup now compares it with this link's payload hash, as the
   executor's recovery does, and answers absent on a mismatch, so the next send fails with
   `work-link-payload-mismatch` instead of completing the wrong job.
3. P2, replaced transactions. A transaction the wallet saw replaced waited forever like a Safe's
   id. An earlier decision (`d46d962d3`) keeps a replacement uncertain until its effect is
   inspected, so the record stays; it is now marked `transactionReplaced`, and once the landed
   lookup finds nothing in its place the act is offered again. Codex suggested clearing it the way a
   cancellation is cleared, which would skip that inspection.

## Review round 4 on #923 (2026-09-27)

Codex reviewed `88879c2aa` and found one more (P1). When the network takes a wallet transaction
but its answer is lost, the send's lock is released at once. If that transaction stays pending past
the grace window, as it can on a chain with a lingering mempool or behind an earlier stuck
transaction from the same account, the act would be offered again while the original could still
land. On Arbitrum the sequencer includes or rejects at once, so this needs a slower chain.
`a8ed6dba8` adds a second check before any reopen: the account's pending nonce must equal its
mined one (`hasPendingTransaction`). While it is ahead, or when the chain cannot say, the act keeps
waiting. A prompt still open in a closed tab has no transaction yet, so the first residual above
stands.

CI on `88879c2aa` failed Build Docs, and with it CI Gate, on a file this branch does not touch:
develop's own Docs run fails since `f9bbeb9dd`, whose new `scripts/harness/agent-hooks.test.mjs`
names the retired `deploy:mainnet` command, and PR CI builds the branch merged with develop. The
fix belongs to that lane; #923's CI Gate cannot pass until develop's does.

## Review round 5 on #923 (2026-09-27)

Codex reviewed `994f9839b` and found one more (P2). The indexer's work attribution keeps only each
work's latest link, so a work unlinked and relinked under another key before its lost first send
settled could no longer be found by the original key, and the act would wait forever: the gap
round 2 recorded. `695c1b638` drops the attribution read and the block-scoped log read of round 3.
The lookup walks the caller's WorkLinked rows in the append-only activity log and confirms each by
its transaction receipt (`transactionMadeWorkLink`), whose event carries the operation key. A
relinked work is still found, and another link at the same time or position still never stands in.

## Review round 6 on #923 (2026-09-27)

Codex reviewed `994f9839b` again and found one more (P1). The take-up floor still allowed two
minutes of clock tolerance and ignored a record's state, so a request a steward declined less than
two minutes before a retry's intent counted as the retry landing, and the retry job would be
completed without its request ever going out. `2aeda3deb` reads the chain's latest block time just
before each act sends (`readChainTime`) and keeps it with the intent (`intentChainTime`). Whatever
the send did lands at or after that time and an earlier ask before it, so the lookup takes the
floor from it with no tolerance, and times the indexer's coverage from it too.

## Review round 7 on #923 (2026-09-27)

Codex reviewed `608050d51` (P1): a passkey send's pending state lives at its bundler, not in the
account's nonce, so a UserOperation still queued there could be offered again after the window.
`d0929ae34` asks the Pimlico bundler for the operation's status before any reopen
(`userOperationMayLand`). Only `not_found` or `rejected` lets the act reopen; every other status,
and a failed read, keeps it waiting.

CodeRabbit reviewed `8c8f3ff3b` (Major) on the closed-tab residual: a tab closed with its wallet
prompt open releases its lock and has no transaction pending, so the act can reopen while that
prompt could still be approved. No other tab can see that prompt, and the reopen already waits for
the person's Send. The same commit makes that Send informed: the `notSent` message now asks the
person to reject any request their wallet still shows first, in en, es and pt. It also removes a
stale test comment CodeRabbit noted.

## Review round 8 on #923 (2026-09-27)

Codex reviewed `8c8f3ff3b` and found three more, all fixed in `eededc6a8`.

1. P1, same-block claim attempts. A block time cannot order an earlier ask against a retry when
   both fall in one block. Each act now keeps the head block with its intent (`intentBlock`,
   from `readChainHead`), and a take-up counts only when its row's receipt holds its own request
   or acceptance, matched whole, in a later block (`transactionMadeClaim`). The indexer's
   claim-request record and the clock-tolerance fallback are gone.
2. P2, refused estimates. A contract refusal from the wallet's own estimate, after the intent,
   read as a send that may have gone out. viem's estimate error and JSON-RPC 3 now count as not
   sent, since nothing is signed after either. This is in the shared protocol, so it applies to
   work and decisions too.
3. P2, unreadable receipts. One receipt that could not be read ended the history scan. Each row
   is now checked on its own, and an unreadable one makes the answer unknown, never absent.

## Review round 9 on #923 (2026-09-27)

Codex reviewed `664d37c9c`. Its claim-join finding was already fixed by `eededc6a8`, which
replaced that join with each row's own receipt. The other two are fixed in `b05a6c529`.

1. P2, Check Again sent. A Check Again that found the act's send never landed reopened it and sent
   it again on the same tap, so a button shown as a check could open a wallet prompt, past the
   message that asks the person to clear their wallet first. Only work and decisions now send on
   the reopening tap; a commitment act reopens and waits for Send Now.
2. P2, a replaced mark storage refused. The mark is now remembered in memory before it is written,
   the commitment settle reads it from there, and writes it again while the act waits. A reload
   before storage recovers still loses it, and the act then waits as for any transaction.

The `shared-job-queue-construction` seam's fingerprint moved with its test and is re-certified
(`scripts/data/module-seam-registry.json`, reviewed 2026-09-27).

## Review round 10 on #923 (2026-09-27)

Codex reviewed `8d44b0d39` (P2): a transaction its own account signed can be dropped, or cancelled
in the wallet, while no tab watches, and then no receipt ever answers it. Its hash might have been a
Safe's id, so the act was never reopened and waited for good, neither discardable nor sendable.

`b7e4bece8` keeps the account's next nonce with each intent (`intentNonce`, from `readNextNonce`).
Once the act reads absent past the grace window, a transaction on record reopens only when it can
never be included (`transactionSuperseded`). Three things must hold: the account has no code, so the
hash is one it signed; the node no longer holds the transaction; and the account's mined nonce has
passed the recorded one. Every read fails closed. A Safe's id, a counterfactual account and an
EIP-7702 account never show this, so they still complete only when the act lands.

An evicted transaction whose nonce is still unspent keeps waiting, because its signature stays valid
and a wallet may broadcast it again. Cancelling it in the wallet spends the nonce and reopens the
act. One narrow residual remains: the transaction can carry a later nonce than the one recorded,
when the account sent another while the prompt was open or its wallet knew of ones the node never
saw. If the node has also dropped it, the act can reopen while it could still land.

## Review round 11 on #923 (2026-09-27)

Codex reviewed `fd638a37b` and found two gaps, both fixed in `9ffe1954c`.

1. P2, a device clock far ahead. The landed lookup opened its window a day before the send on the
   device's clock. A device running more than a day ahead opened it after the act's own row, so a
   landed act could read absent once the indexer passed the grace window. The window now opens at
   the intent's recorded chain time (`intentChainTime`), since nothing the send did can land before
   it. A record kept without it still uses the device window.
2. P2, a declined act asked again. A decline cleared the record but left the act without
   `requiresExplicitSend`, so the queue's next background flush could open the prompt again and
   spend its retries. A decline now marks and stores the act, as work and decisions already do.

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

Review round 11 was RED against `fd638a37b`: with the device two days ahead, a landed confirmation
read absent, and a declined take-up stored no explicit-send mark. Both pass at `9ffe1954c`.

Review round 10 was RED against `dfb022bc7`: four tests failed. A transaction another took the
nonce of stayed waiting in the resolver, the send kept no nonce, the settle never asked whether the
nonce was spent, and the nonce reads did not exist. All pass at `b7e4bece8`.

Review round 9 was RED against `8d44b0d39`: a Check Again on a commitment act ran the executor
twice, sending again, and the in-memory replaced mark did not exist. All three tests pass at
`b05a6c529`.

Review round 8 was RED against `664d37c9c`: six tests failed. An earlier ask in the retry's own
head block read found, a newer unreadable receipt ended the work-link scan, a refused estimate
after the intent kept it, the send kept no head block, and the head and claim-receipt reads did not
exist. All pass at `eededc6a8`, where the table's take-up cases now run through receipts.

Review round 7 was RED against `8c8f3ff3b`: a lost passkey act whose UserOperation the bundler
still held was offered again, and the status read did not exist. Both pass at `d0929ae34`.

Review round 6 was RED against `608050d51`: a request declined half a minute before the retry's
recorded intent read found, the send kept no chain time, and the chain-time read did not exist. All
three pass at `2aeda3deb`.

Review round 5 was RED against `994f9839b`: with the work's attribution moved on to another key,
a landed link read unknown instead of found. It passes at `695c1b638`, with the chain-read test now
decoding real WorkLinked logs from a receipt.

Review round 3 was RED against `88879c2aa`: three tests failed. A work link whose key held another
payload read unknown instead of absent, the replaced send carried no mark, and a replaced
transaction stayed waiting instead of reopening. All pass at `cbcd9d71a`, with a new chain-read test
for the WorkLinked log.

Review round 4 was RED against `8293fbe82`: a lost act whose account had a transaction pending was
offered again, and the pending-nonce read did not exist. Both pass at `a8ed6dba8`.

## Rendered proof

Storybook: the queued-act row's two new waiting states, labelled, and the reworded `notSent`
state re-captured at `d0929ae34`. This lane changes the shared
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
transaction that is never executed, which waits as work and decisions do; and a work or decision
transaction that is dropped or cancelled while no tab watches, which waits for good, as on develop.

Work and decisions take up these rules in #936 (PRD-1002): a Safe's id settles by the work's or
decision's landing on EAS, a transaction that can never be included reopens, an absence counts only
once EAS has processed past the grace window, and every send holds its lock behind the same guards.

## Unblock evidence

The lane closes when all of these hold. As of 2026-09-27:

- RED and GREEN recorded: done, under RED and GREEN evidence.
- PR #923 merged: done, as `7fdc87f78`. Two review comments posted minutes before the merge are
  fixed in the follow-up below, which merged in #931 as `2aca5c59a`.
- PWA-126 walked on the recorded call: pending.
- Then the sub-lane moves to `completed` and the Linear child to Done. Until then the sub-lane is
  `in_progress`, since the harness counts `passed` as done, and PRD-996 stays In Progress.

W3-H starts once #923 merges (§ 1 row 49); it does not wait for the walk.

The proof is recorded here, under RED and GREEN evidence. The `state_api` machine lane's TDD record
holds W1-1's proof and belongs to Codex's lane, so `record-tdd` is not run over it.

## Follow-up after the merge (2026-09-27)

Two Codex comments on #923 arrived minutes before it merged, and both held. The follow-up branch
`fix/commitment-send-nonce-cursor` fixes them:

- **The nonce the transaction used.** The account's pending nonce read before the wallet prompt is
  only a floor: the wallet may know sends this network does not, or another send may go out while
  the prompt is open. A transaction with a later nonce could then read as superseded and be offered
  again. The send record now keeps `transactionNonce`, the nonce read off the transaction itself
  with the hash it was read for. It is read when a send stops waiting for its receipt, and on each
  settle pass while the network holds the transaction. "Superseded" reads only that nonce. A
  transaction the network never showed keeps waiting, since nothing can prove another took its
  nonce. `readNextNonce` and `intentNonce` are gone; a record an earlier build kept drops its
  `intentNonce` on its next write.
- **Paging by cursor.** The landed lookup read the commitment's log by offset. A row the indexer
  rolls back between pages shifts the rest up, so the send's own row could fall between two pages
  and read as absent. The lookup now pages from after the oldest row it read, on the log's own
  order (`timestamp` then `id`). `getCommitmentActivity` takes that cursor as `before`. The query
  was checked read-only against the hosted indexer: the page after a cursor equals the rows after
  it, ties on timestamp included.

## Validation Receipt

- Tested implementation commit SHA: `9ffe1954c` (on `fix/commitment-send-record`, PR #923)
- Run at (UTC): `2026-09-27T06:37:04Z` to `2026-09-27T06:53:44Z`
- Exact command(s): in `packages/shared`, `bun run typecheck -- --scope full` and `bun run test`; in `packages/client` and `packages/admin`, `bun run typecheck`; in `packages/client`, `bun run test`; at the root, `bash scripts/quality/check-test-quality.sh`, `bun --bun run oxlint packages/client/src packages/shared/src --deny-warnings` and `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`. The catalog checks, `bun run --cwd packages/qa build`, `node scripts/quality/check-qa-id-ledger.mjs --base origin/develop` and `bun --bun x vitest run --dir scripts/agents`, last ran at `6781a51b2`; no catalog, ledger or agent-tool file has changed since.
- Result: shared, client and admin typechecks exit 0; shared 5,928 passed in 543 files; client 1,413 passed in 143 files; test quality passed, with four certified seams and no drift; oxlint exit 0; source structure passed against `origin/develop`. At `6781a51b2`: QA build 354 active cases; ledger 420 ids, none removed; agent tools 260 passed. The previous head `fd638a37b` passed the critical pre-push plan, all 30 checks.
- Validated paths: every non-plan path the branch changes, `git diff --name-only $(git merge-base origin/develop 9ffe1954c) 9ffe1954c -- . ':!.plans'` (32 paths)
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <the validated paths>` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 9ffe1954c -- <the validated paths>` → exit 0 before this handoff commit, which changes only `.plans`
- Rendered proof: Storybook on this checkout, desktop app Browser pane, 375 emulation. Captured at `6bf248187`: `client-commitments-queuedactrow--proof-already-broadcast` in light and dark ("Your proof has left this phone and is waiting for the network to confirm it", Check Again, no Discard); `git diff --exit-code 6bf248187 9ffe1954c` over the row and its stories exits 0, and its `confirming` copy is unchanged in en, es and pt. Re-captured at `d0929ae34`: `--never-reached-the-network` in light ("Your take-up never reached the network. If your wallet still shows its request, reject it there first. Then send it again or discard it.", Discard and Send Now). `git diff --exit-code d0929ae34 9ffe1954c` over the row, its stories and the en, es and pt catalogs exits 0. Labelled Storybook; the authenticated walk, PWA-126 with Rabby, stays pending for the recorded call.
