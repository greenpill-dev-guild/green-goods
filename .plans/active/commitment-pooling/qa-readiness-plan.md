# Commitment Pooling QA Readiness Plan

**Feature Slug**: `commitment-pooling`
**Status**: ACTIVE
**Created**: 2026-09-20
**Last Updated**: 2026-09-20
**Owning lanes**: `state_api`, `ui` (`ui_client`, `ui_admin`), `qa_pass_1`
**Companions**: `handoffs/claude-qa-pass-1.md` (Wave 2), `acceptance-matrix.md`,
`standing-commitments-spec.md`, `.claude/context/qa.md`

This plan gets Commitment Pooling ready for the release QA walk, runs that walk on recorded calls,
and leaves the QA catalog accurate for every act a person can actually perform. It does not replace
the Wave 2 walkthrough in the QA Pass 1 handoff: it supplies what that walkthrough needs first
(a corrected catalog, three small builds, a staged real-chain setup) and the loop that follows it.

## 1. Decision log

Decided with Afo on 2026-09-20 over four question rounds.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Refresh commitment data when a queued act completes. Lands before the walk. | Completion re-reads only the pending-queue projection today, so a finished act can leave the screen stale and read as a false fail. |
| 2 | Offer It Again opens the composer prefilled. Lands before the walk. | Today it only navigates back. Prefill is also the mechanism the batch tray reuses. |
| 3 | The "How this is completed" explainer and the Offer over time (series) UI do not land before the walk. | Both are feature-sized. They stay recorded as gaps (§ 7). |
| 4 | Batch creation ships as a sequential batch before the walk. A single-transaction (atomic) batch is later work. | Afo's call. Each row is its own queued creation, so the later atomic upgrade replaces the send step, not the composer. |
| 5 | Batch lives in the admin seed wizard first. The PWA composer gets prefill only. | Stewards seed a season in one sitting, and it is where the walk needs speed. |
| 6 | Batch model is the "Add another" tray: fill one commitment through the existing steps, save it to a tray, reopen prefilled, review every row, then Create all (N). | Reuses today's steps and validation. No new table grammar in the admin. |
| 7 | A failed or rejected row does not stop the batch. Each row keeps its own status, retry, and discard. | Rows already have independent creation keys, so a retry cannot create twice. |
| 8 | Prefill entries: on the PWA the creator sees Offer It Again or Ask Again on their own expired, fulfilled, and withdrawn commitments. In the admin the inspector gets Seed another like this. | Covers requests and stewards. Starting from someone else's commitment is held until after the pilot. |
| 9 | The walk runs on staging against the live Arbitrum contracts. | Release-grade evidence. Every record is real and public, so wording stays realistic. |
| 10 | Real-chain order: a rehearsal cycle on the Aiyeloja Family garden, cancelled afterwards; then a real, complete cycle on the same garden; then the protocol pool and the relay journey; then the live Tech and Sun garden. | Each stage proves the path the next one depends on. The partner garden goes last, on a proven path. |
| 11 | The walk happens on a recorded call with two people. Issues are noted on the call and brought back to an AI session afterwards. | The relay journey needs two identities, each held by one person for the whole walk. |
| 12 | One full catalog PR lands before the call, then a new run starts. | Nobody edits the catalog live. Grouped cases produced verdicts nobody could act on in the 2026-09-04 session. |
| 13 | Recording an external payout (`recordConsiderationPaid`) is built in the fix window and walked in the re-QA run. | It has no wrapper and no UI today. It must exist before the first partner payout, not before the first call. |
| 14 | Ending a season (`closeCycle`, `compostCycle`) is built in the fix window before release. This settles the open D2 close-the-season finish-or-cut call as **finish**. | Cancel is the only in-app exit today, and the public page drops cancelled cycles. The first real season must be able to end honourably. |
| 15 | This plan lives in the commitment-pooling hub. | One canonical hub per feature. |
| 16 | One Claude session builds the pre-QA items serially, one PR each. | No parallel agents in a week with little slack. |
| 17 | Build 1 also gives wallet-mode readers, and so the whole admin, a send for queued commitment acts. Approved by Afo on 2026-09-20. | Found while scoping the refresh fix. Without it the admin cannot create or confirm a commitment, so the walk stops at its first seed. |
| 18 | In wallet mode a send that fails, a declined prompt included, drops its job and reports the failure. Waiting acts, creations whose send is on chain, and failures the queue judged final stay queued. | Nothing else would ever retry a wallet-mode job, and the executor rewrites the stored payload (a published CID), so the same act queued again reads as an identity conflict rather than a second try. The queue's own `discardJob` refuses when the send may be on chain, and the composers keep their drafts, so nothing a person made is lost. |

## 2. Verified ground truth (2026-09-20)

Each line was checked against the source or the chain in this session.

- **Catalog**: 266 active cases, 52 retired, 2 journeys. 77 active cases touch commitments, pools,
  cycles, or settlement.
- **ADM-076 is wrong twice.** `ConfirmLib.confirmFulfillmentAsFallback` reverts
  `OrdinaryConfirmationStillReachable` unless ordinary confirmation is structurally unreachable,
  so "whose ordinary confirmer has not acted" is not a valid precondition. The fallback reason is a
  plain string on chain and is never pinned (`useCommitmentMutations.ts`, the `CID_REASON_ACTIONS`
  comment). `markReadyForConfirmation` shares the plain-string rule.
- **Refresh gap.** `JobQueue.tsx` `handleJobCompleted` invalidates only for `work` and `approval`
  jobs. `useCommitmentQueueState` re-reads the queue projection on `job:completed`, not the indexed
  commitment. `useCommitmentJobs` invalidates at enqueue time only. An indexer-lag pattern already
  exists: `useProgressiveInvalidation` with `INDEXER_LAG_SCHEDULE_MS` (`useSettlement.ts`,
  `useCommitmentDialogController.ts`).
- **The admin never sends its queued commitment acts (found while scoping Build 1; static trace,
  not yet reproduced live).** Seeding, Send for Confirmation, and both Confirm Kept entries go
  through `useCommitmentJobs().enqueue`, which only calls `jobQueue.addJob`. `addJob` stores the
  job, emits `job:added`, and requests a background sync; it sends nothing. The only code that
  flushes `COMMITMENT_JOB_KINDS` is `JobQueueProvider`, which the client mounts and the admin
  never has (no import in `packages/admin/src`, and none in its git history). Even where it is
  mounted, the flush runs only for passkey and embedded sign-in (`autoSends`), so a wallet-mode
  reader of the PWA is not sent either, except through Try Again. The admin pool console has no
  retry, flush, or sender code at all, while its copy promises the creation "sends when it can".
  The work and approval paths already show the intended wallet pattern: queue, then
  `processJob(jobId, { transactionSender, explicit: true })` as the person's own tap
  (`submit-approval-command.ts`). The commitment path is missing that step. This stayed latent
  because the admin write side was never proven live and no pool has ever been open on chain.
- **Creation.** Both surfaces share `buildCommitmentCreationPayload` and
  `useCommitmentJobs().enqueue({ act: "create" })`, each creation keyed by its own
  `clientCommitmentId`. The payload hardcodes `commitmentSeriesId: 0n`, `counterCommitmentId: 0n`,
  `requiresAssessment: false`, and `declaredUnitValue: 0n`. `offerAgain` is offered only to the
  provider of an `EXPIRED` commitment (`acts.ts`) and calls `navigate("../..")`.
- **Named confirmers.** Only the admin seed wizard can name confirmers and a threshold (up to 40,
  threshold no greater than the number named). The PWA composer cannot.
- **Live chain, Arbitrum block 507310713.** The pooling module is unpaused and `protocolPoolId` is 1.
  All 18 pools read `NotReady`: no charter, no cycle, no commitment. Pool 1 is the protocol pool
  (Green Goods Community Garden), pool 2 is Aiyeloja Family, pool 3 is Tech and Sun.
- **Availability gate.** The ontology projection reads `available` for chain 42161 on `develop`, so
  staging reads and writes are not gated off.
- **Cycles.** A pool holds one open Season; Campaigns may overlap. Opening a second Season reverts
  `SeasonAlreadyOpen`. `closeCycle` and `cancelCycle` both require zero live commitments. Cancel
  needs a reason, accepts Seeded or Open cycles, and frees the season slot. First-run setup is six
  ordered writes and always seeds and opens a first cycle whose allocation and recognition
  snapshots are immutable. An unknown `seedCycle` outcome fails closed: refetch the pool, never
  resend blind.
- **No UI for**: ending a cycle normally, recording an external payout, ongoing offers (series),
  exchange pairs, contributor add, remove, or leave, requirement assignment, unlinking work,
  post-creation edits to consideration, declared value, or the confirmer rule, payout split
  overrides, settlement batching. Full list in § 7.
- **Worth a tester's attention**: Expire Now is offered to any signed-in reader who sees a due,
  live commitment, not only stewards. Accept on a claim and Resume Pool send with no confirm step.
  Reopen Pool always reopens to Ready, never straight to Open. The role gate on the settlement
  steps is not visible in the controller and should be confirmed empirically.

## 3. Requirements coverage

| Requirement | Where | Status |
|-------------|-------|--------|
| Fix clear issues that would slow the walk | § 4 Builds 1–3 | ⏳ |
| The admin can actually send a seeded or confirmed commitment | § 4 Build 1 part A | Built; live proof pending Stage A |
| Reuse a commitment instead of retyping it | § 4 Build 2 | ⏳ |
| Create several commitments in one sitting | § 4 Build 3 (sequential; atomic later, § 7) | ⏳ |
| Catalog is correct, coherent, and one outcome per case | § 5 | ⏳ |
| Strong cases for every reachable pooling act | § 5.3, § 5.5 | ⏳ |
| A QA plan Afo can run on a call | § 6 | ⏳ |
| Issues come back to an AI session and get fixed | § 6.5, § 6.6 | ⏳ |
| Payouts can be recorded; a season can end | § 6.6 fix-window builds | ⏳ |

## 4. Pre-QA builds

Order matters: Build 2 supplies the mapper Build 3 reuses, and the catalog PR (§ 5) is written last
against the final labels. Every new string lands in `en`, `es`, and `pt`. Hooks stay in
`packages/shared`. Admin UI uses the `Admin*` primitives and Warm Earth tokens.

### Build 1 — Send, then refresh, queued commitment acts

**Branch**: `fix/commitment-queued-acts-send-and-refresh` · **Criticality**: Critical (shared
JobQueue provider and a blockchain mutation hook). Read every touched line; keep the selector's
critical override.

**Scope status**: part A is committed as `7d5963d97` on
`fix/commitment-queued-acts-send-and-refresh` and awaits review and a live reproduction. Part B is
the refresh fix Afo locked in decision 1.

**Part A — wallet-mode send (built 2026-09-20, decisions 17 and 18).**

What changed:

- `useCommitmentJobs`: in wallet mode `enqueue` queues the act and then sends it as the person's
  own tap (`processJob` with `explicit: true`), the shape `submit-approval-command` already uses
  for a queued decision. Passkey and embedded sign-in are untouched: the provider's background
  flush still owns their sends. The sender's own `authMode` decides, so there is one source for
  who is signing.
- A creation is only `submitted` by its first pass; a second pass reads the id back from the chain
  and completes it. The background flush makes that pass for a passkey. A wallet now makes it at
  once, which is safe because the wallet sender has already waited for the receipt.
- Failure rule: decision 18.
- `retryQueuedCommitmentJob` plus `retryQueued` and `discardQueued` on the pool console controller,
  and Try Again and Discard on the pool tab's queued rows. Discard shows only where the queue
  would allow it. A failed retry keeps its row and is reported through the shared error handler.
- Seed wizard copy in `en`, `es`, `pt`: the failure sentence no longer says the commitment "could
  not be queued", and the queue note no longer promises a later send that nothing performs.

Proof, run on the tree that became `7d5963d97`:

- RED first: the hook test showed `processJob` called 0 times for a wallet sender, which is the
  defect at unit level.
- `commitment-jobs-hook.composed.test.tsx` runs the hook over the real `createJobQueue` (real
  dedupe, `processJob`, `discardJob`, `retryJob`) with only the executor faked. Two mutations were
  checked against it and both were caught: removing the discard, and removing the settling pass.
  Four unit cases it made redundant were removed.
- Full suites: shared 5,477 passed (511 files), admin 865 passed (114 files); the three client view
  suites that consume the hook pass (46). `typecheck --scope full` is clean for shared, admin, and
  client. `format`, `lint`, `source-structure`, `vocabulary`, `story-quality`, `ontology`, and
  `admin-build` pass through `bun run check --only`.
- The push gate itself would not start: its estimate (210 s) exceeds its 180 s limit for this
  change set even with `--test-path`, so its checks were run one by one.

Not proven:

- **No live reproduction and no browser proof.** Every pool on chain is `NotReady`, so there is
  nothing to seed against, and the flow needs a wallet signature this session cannot give. Stage A
  (§ 6.2) is the first real proof: seed one commitment and expect a wallet prompt, then the row.
- Known limits, left as they are: a wallet-mode act that is only *waiting* (no steady connection,
  a work link whose work is not indexed yet) stays queued, and outside the pool tab's creation
  rows nothing offers to send it later. An embedded sign-in in the admin would still not be sent,
  because the hook cannot know that no provider is mounted; AppKit's email and social sign-in are
  off, so the admin is wallet-only today.

**Part B — refresh after completion (locked).**

1. RED: in the JobQueue provider test, emit `job:completed` for a `claim` job and assert
   `commitmentPoolingKeys.all(chainId)` and that commitment's key are invalidated at once and again
   on the lag schedule. Add one case per remaining kind only if its payload carries the commitment
   id differently.
2. In `packages/shared/src/providers/JobQueue.tsx` `handleJobCompleted`, add a branch for
   `COMMITMENT_JOB_KINDS`: invalidate the pooling keys, then start the existing
   `useProgressiveInvalidation` schedule with `INDEXER_LAG_SCHEDULE_MS`. No new timer code
   (React rule 1). Reuse `queryInvalidation` if it fits; do not add a parallel helper.
3. Decide from the payload, not from UI memory, which commitment key to target: reuse
   `subjectCommitmentId` from `useCommitmentJobs.ts` by moving it next to the job types if the
   provider cannot import it cleanly.
4. For the wallet-mode path from part A, invalidate after the explicit `processJob` resolves and
   start the same lag schedule, so both sign-in modes refresh the same way.
5. GREEN, then prove in the browser on staging or the mirror: take up a commitment, watch the
   pending chip clear and the band change without a manual reload.

**Out of scope**: list pagination, polling, optimistic state, mounting `JobQueueProvider` in the
admin, background wallet prompts.

### Build 2 — Prefilled Offer It Again, Ask Again, Seed another like this

**Branch**: `feature/commitment-create-another`

1. RED then GREEN for a pure mapper in `packages/shared/src/modules/commitment-pooling/`:
   `composerValuesFromCommitment(commitment, metadata)` returns `Partial<CommitmentComposerValues>`.
   Copies direction, kind, title, note, links, unit label, target units, claim mode, team policy,
   requirement rows, protocol fallback, consideration rail and amount, and (admin only) confirmers
   and threshold. Resets everything else: claims, contributors, evidence, confirmations,
   identities, settlement. `dueInDays` returns to the default and `cycleId` to the pool's current
   open cycle, because both need fresh validation.
2. `acts.ts`: offer the elective act to the creator of an `EXPIRED`, `FULFILLED`, or `CANCELLED`
   commitment, for offers and requests. Table-test the seat and phase matrix. Labels: Offer It
   Again for offers, Ask Again for requests.
3. Client: `GardenCommitment.tsx` `offerAgain` navigates to the composer route with the source
   commitment id. `useCommitmentComposerController` resolves it and passes the mapped values as
   `initial`. A saved draft still wins through the existing Resume Draft dialog.
4. Admin: `CommitmentDialog` gains Seed another like this for pool stewards. It opens
   `Seed/index.tsx` with the mapped values as `initial` through the existing
   `useCommitmentComposerSession`.
5. Stories for both entries. `check:stories` and `check:story-quality` for shared.

**Out of scope**: starting from another person's commitment; series identity.

### Build 3 — Admin "Add another" batch tray

**Branch**: `feature/commitment-seed-batch-tray` (stacked on Build 2)

1. RED then GREEN for a pure tray model in shared (`seed-tray.ts`): add, replace, remove,
   duplicate. Each row holds validated `CommitmentComposerValues` and a stable
   `clientCommitmentId` minted when the row is added, never at send time.
2. `Seed/index.tsx` and `SeedStepReview.tsx`: the review step lists the tray rows (title, units,
   due, claim mode) with Edit and remove, an Add another like this action that saves the current
   row and reopens step 1 prefilled from it, and a primary action reading Seed This Commitment for
   one row or Create all (N) for several, with the wallet-confirmation count stated beside it.
3. Send: loop the rows through `jobs.enqueue({ act: "create", payload })`. Do not stop on a
   failure. Each row then lives in the existing pending and failed-act recovery, so retry and
   discard need no new UI.
4. Guard: refuse to add a row that would exceed the provider's remaining open-commitment cap, and
   say so in plain words.
5. Story for a three-row tray, including one failed row.

**Out of scope**: atomic single-transaction creation, a PWA tray, an editable table, shared-defaults
editing across rows.

### Validation for each build

Render `bun run check --plan -- --intent push` first and follow what it selects. Expect at least:
targeted `bun run test` for the touched shared modules, `typecheck:source` for client and admin
(the package `typecheck` is a no-op), `bun run check --only vocabulary`, the design checks for UI
changes, and the story checks when a story changes. Run Biome on touched files before staging.
The push gate's `browser-proof` check needs the authenticated Brave profile; if it is unreachable,
say so in the PR rather than claiming local authenticated proof. Record RED and GREEN with
`plan-hub.mjs record-tdd` and fill a Validation Receipt in the lane handoff.

## 5. Catalog PR

**Branch**: `test/commitment-pooling-qa-catalog` · Lands after Builds 1–3 so labels are final.
Mechanics follow the QA Runs pattern: a one-shot node script retires rows
(`retiredOn`, `retiredReason`, `replacedBy`), splices new rows after the last id of their prefix,
and appends the ledger in the same order; then Biome on both JSON files, `bun run docs:generate`,
`check-qa-id-ledger.mjs --base <parent>`, and `node packages/qa/build.mjs`. Write every row against
the source and the English labels, not from memory. Rule for a case: **one independently passable
outcome**, with shared setup allowed.

### 5.1 Corrections in place (wording, steps, evidence; meaning unchanged)

- **ADM-079**: state that the override reason is recorded as written, not pinned.
- **ADM-064**: keep as the steward walk; its non-steward twin is new (§ 5.3).
- **ADM-012**: re-read its "pinned" wording against the act it describes and correct it if that
  act takes a plain reason.
- **Service-relay journey**: name the fixture precisely. A garden-work Request becomes ready
  through approved linked Work; a service Request becomes ready through evidence and Send for
  Confirmation. The journey must say which one it walks.

### 5.2 Retire and split (what the case proves changes)

| Retire | Successors |
|--------|------------|
| ADM-076 | Garden fallback confirms with a reason when ordinary confirmation is unreachable · Green Goods team fallback does the same on a commitment that opted in · Fallback is not offered while ordinary confirmation is still reachable |
| PWA-082 | Place a garden-work request with action rows · Place a help-or-service request |
| PWA-083 | Resume Draft restores the composer · Start Fresh discards the draft |
| PWA-093 | Try Again lands a failed queued act · Discard removes one that cannot be on chain |
| PWA-104 | Offer It Again opens the composer prefilled (new behaviour, Build 2) |
| ADM-078 | One case per outcome: Restore Previous · Kept · Cancelled · Expired |
| ADM-083 | Create a payout plan · Finalize a payout plan |
| ADM-085 | Dispatch a prepared disbursement · Retry Command on a dispatched row · Requeue a failed row · A rejected wallet prompt leaves the row unchanged · Read Again refreshes from chain |
| PUB-027 | Each pool state reads honestly · Unit summaries use exact labels · Finished cycles page with show-more · Cancelled cycles never appear · A metadata outage shows the notice |

The fallback precondition must describe how to make ordinary confirmation unreachable: with named
confirmers, fewer eligible confirmers than the threshold because the rest are active contributors;
with none named, the asker of a Request or the counterparty of an Offer is an active contributor.
A Garden counterparty is always reachable, so fallback never applies there.

### 5.3 New cases for reachable, uncovered behaviour

- Seed a commitment with named confirmers and a threshold of two; the first confirmation shows
  progress and does not fulfil; the second fulfils.
- A contributor is refused when they try to confirm their own commitment.
- Partial work approval: some requirement counts met, the commitment stays in progress and shows
  per-requirement progress; the last approval makes it ready.
- A non-steward presses Expire Now on a due commitment.
- A queued act survives an app restart and lands once (the commitment-specific twin of the generic
  offline-work cases).
- After a queued act completes, the screen updates without a reload (Build 1).
- Ask Again on an own ended request; Seed another like this in the admin inspector (Build 2).
- Batch tray: add, edit, and remove rows; Create all lands every row; one rejected wallet prompt
  leaves that row retryable while the others land (Build 3).
- Cancel an open cycle with no live commitments and see it leave the public page (the rehearsal
  exit in § 6).
- Seeding from the admin opens a wallet prompt and the commitment lands without a reload of the
  queue (Build 1 part A).
- Declining the wallet prompt while seeding leaves no queued row behind and the wizard keeps its
  answers; seeding again succeeds (Build 1 part A).
- A queued creation on the pool tab offers Try Again, and Discard only when its send cannot be on
  chain (Build 1 part A).

### 5.4 Known gates

- **ADM-080** (attach an assessment): no composer can create a commitment that requires one, so
  the act is unreachable. Add a `knownGate` saying so. A tester attempts it and records Blocked
  only on meeting the gate.

### 5.5 Coverage check before merge

Build an act ledger in the PR description, not in the catalog: every reachable act from § 2's act
map against its case id or ids. The PR is complete when every reachable act has at least one
case, every case proves one outcome, and nothing in § 7 has a case.

## 6. The QA plan

### 6.1 Pre-flight (the day before the first call)

1. Builds 1–3 and the catalog PR are merged to `develop`, and staging shows them.
2. `https://qa.greengoods.app/catalog.json` shows the new revision.
3. Both testers sign in to the QA app once with the wallets they will hold all week, and confirm
   they are on the allowlist.
4. One tester presses **Start new run**, labelled for this pass, environment **beta/staging**,
   with the build SHAs. `bun run qa status` names the open run.
5. Roles are fixed for the week. **Protocol & review**: protocol steward, independent steward or
   evaluator of the test garden, outside both contributor rosters. **Garden & member**: steward and
   member of the test garden; makes the institutional claim and contributes the Work and evidence.
6. Wallets hold enough ETH on Arbitrum for roughly 60 transactions in total. Passkey acts spend
   sponsored gas.
7. Write the charter text, cycle name, dates, allocation split, and recognition policy for each
   stage before the call. Snapshots are immutable once a cycle opens.
8. Agree scope: anything device-only or outside these stages is recorded **N/A** only when it was
   consciously excluded. A case nobody walked gets **no entry**.

### 6.2 Stages

Every stage ends with the same check: no unexplained pending chips, the public garden page reads
honestly, and both testers have recorded a verdict on each shared case.

**Stage A — Rehearsal on Aiyeloja Family (pool 2). Solo, before the call.**
Set Up Commitments with a short rehearsal cycle. Seed two or three commitments with the batch tray,
take one through offer, take-up, evidence, send for confirmation, and confirm, and withdraw or
expire the rest so the cycle has no live commitments. Cancel the cycle with a reason and confirm
the public page no longer shows it. Purpose: prove the setup flow and the cancel exit, and shake
out environment problems before anyone else's time is spent. If `seedCycle` ends in an unknown
state, stop, refetch the pool, and do not resend.

**Stage B — Real complete cycle on Aiyeloja Family. Call 1.**
Open a real season with the agreed terms. Walk in this order, steward and member alternating:

1. Pool console: statuses, settings edit, pause with a reason and resume, season and campaign.
2. Seeding: single seed, named confirmers with a threshold, batch tray, Seed another like this.
3. PWA compose: offer, garden-work request, service request, draft resume and start fresh, Ask
   Again and Offer It Again.
4. Taking up: open take-up, ask to take up, accept, decline with a reason, join the team.
5. Garden-work path: link work from the wizard and from the dialog, partial approval, approval to
   ready, count linked work from the inspector.
6. Service path: proof composer with media, send for confirmation.
7. Confirming: confirm from the PWA sheet, from the inspector, and from the Hub queue; two-of-two
   threshold; self-confirmation refused; Not yet raises a dispute; resolve with each outcome.
8. Steward recovery: mark ready with an override, garden fallback, fallback not offered while
   reachable, cancel with a reason, Expire Now as steward and as non-steward.
9. Resilience: failed act then Try Again, Discard, restart with a queued act, refresh after
   completion.
10. Settlement on the garden rail: create and finalize a plan, prepare payouts, dispatch, retry,
    cancel a disbursement. Record Blocked at any `knownGate` actually met.
11. Reads: Pool tab, commitment detail, Commitments drawer, work detail, public garden page.

**Stage C — Protocol pool and the relay journey. Call 2.**
Set up pool 1 with its real charter and a rehearsal cycle. Walk the `service-relay` journey with
each person holding one identity throughout: seed the approval-gated protocol Request, the
garden's institutional claim, acceptance, the separate garden commitment, Work and evidence,
approval without joining contributors, confirmation, protocol-to-garden compensation, and the
garden-to-member payout. Then the Green Goods team fallback case and the
`protocol-treasury-top-up` journey. At each named handoff the actor waits until the receiver can
see the state. Drive every commitment terminal and cancel the rehearsal cycle.

**Stage D — Tech and Sun go-live. After re-QA passes.**
This is an operation, not a test. A Tech and Sun steward signs the setup in the staging admin;
the deployer wallet holds no authority on that pool. Terms must be agreed with the Tech and Sun
group first, because they cannot be edited after the cycle opens. Record payout must have shipped
(§ 6.6). Track it in the Community team's issues, not here.

### 6.3 On the call

- Record the screen and audio. Say the Test ID aloud before each case, then the verdict.
- Record verdicts and notes in the QA app as you go: `Pass`, `Fail`, `Blocked`, or `N/A` by
  agreed scope. A pass may carry a note. Prefix any verdict taken outside the run's environment
  with `[prod]` or `[local]`.
- One symptom per note where possible. Say "catalog" when the problem is the case, not the product.
- Do not fix anything live. Do not retry an irreversible write whose outcome is unknown.
- Keep wording on real records realistic. The protocol pool is on the public site.
- Never show a seed phrase, private key, or the allowlist on the recording.

### 6.4 Exit criteria for the first run

Every P0 commitment case has a verdict from at least one tester. Every reachable act in the § 5.5
ledger was attempted. Both journeys were walked end to end or stopped at a named gate. Stage A and
Stage C rehearsal cycles are cancelled with no live commitments left behind.

### 6.5 After each call

1. `bun run qa pull --slug <date> --run open`, then `bun run qa report --slug <date>`, with
   `--previous` naming the earlier run's pull.
2. Bring the recording transcript and the pull into an AI session and run `/qa-triage --call` (or
   the `qa-call-report` routine). It splits notes into observations, assigns each one disposition
   (`defect`, `polish`, `decision`, `investigate`, `catalog`, `environment`), and after
   confirmation writes the `QA session` parent and its fix slices to Linear, each carrying its
   exact Test ID.
3. `catalog` observations are copied, de-attributed, into this hub for the next catalog change.
   They never become slices.
4. Results, notes, names, and wallets stay out of this repository. The full report is attached to
   the Linear parent as a document after the privacy check.

### 6.6 Fix window and re-QA

- Fix slices follow the QA fix posture: history first, map before editing, update or remove over
  add, repair to the case's expected result and no further. One slice, one branch, one PR.
- Two builds run in the same window, each with its own catalog cases:
  - **Record an external payout**: a shared wrapper for `recordConsiderationPaid` and one admin
    dialog on a fulfilled commitment with an external rail (amount and payout reference). The
    timeline label already exists.
  - **End a season**: Close and Archive for cycles in `PoolCyclesCard`, wired to the existing
    `closeCycle` and `compostCycle` controller entries, blocked with plain words while live
    commitments remain.
- Then **Start new run**, compare against the first run, and walk the **Re-QA** filter plus the
  new cases. Release QA is complete when no P0 or P1 commitment case is failing or blocked without
  an accepted reason. The release milestone dates live in Linear.

## 7. Known gaps (no catalog cases until a screen exists)

| Gap | State today | Destination |
|-----|-------------|-------------|
| Atomic single-transaction batch creation | Every sender's `sendBatch` is sequential; the module exposes only singular `createCommitment` | Own plan after QA. Settle atomicity, wallet capability, row limits, and retry. Paginate the commitment list first. |
| Offer over time (series): once or ongoing, places, rest, resume, retire | Contract, job kind, and wrappers exist; nothing enqueues them | `standing-commitments-spec.md` remains the design. Schedule after the pilot's first cycle. |
| "How this is completed" explainer | Copy is spread across review, progress, status, and the action bar | Design pass after the first run, informed by where testers hesitated. |
| Exchange pairs (`acceptExchange`, `counterCommitmentId`) | Wrapper only | Unscheduled. |
| Contributor add, remove, leave; requirement assignment | Wrappers only | Unscheduled. |
| Unlink work | No wrapper | Unscheduled. |
| Edit consideration, declared value, or confirmer rule after creation | Wrappers only | Unscheduled. |
| Commitments that require an assessment | Composer hardcodes `requiresAssessment: false` | Decide with the assessment work. ADM-080 carries a known gate meanwhile. |
| Payout split overrides; settlement batching | Wrappers only | Unscheduled. |
| Commitment list pagination | One unpaginated list query | Before atomic batch ships. |
| PWA composer cannot name confirmers | Admin only | Decide after the pilot. |

## 8. Compliance

- [ ] Hooks and pure models in `packages/shared`; consumers import declared subpaths only
- [ ] Every new string in `en`, `es`, `pt`; vocabulary check clean
- [ ] Admin UI on `Admin*` primitives and Warm Earth tokens; no raw `--m3-*`
- [ ] No utility classes authored inside `packages/shared/src` for layout
- [ ] Implementation Quality Contract applied; nearest existing pattern extended, none duplicated
- [ ] No QA results, names, wallets, or funding figures in tracked files

## 9. Out of scope

Contract changes. Indexer schema changes. The community PWA. Device-only and installed-app cases
beyond what Wave 2 already lists. Any deploy, broadcast, merge, or promotion: those stay with Afo.
