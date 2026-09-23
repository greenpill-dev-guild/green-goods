# Commitment Pooling QA Readiness Plan

**Feature Slug**: `commitment-pooling`
**Status**: ACTIVE
**Created**: 2026-09-20
**Last Updated**: 2026-09-22
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
| 19 | Composing again is offered to whoever **made** the commitment, on every settled state (expired, fulfilled, reconciled, cancelled), as Offer It Again or Ask Again. Decided by Claude while building, from decision 8; Afo may overrule. | The act was keyed on the provider seat, which on a lapsed request is whoever took it up, not the asker whose words it is. A seat cannot say who made a commitment: the asker and every named confirmer read as confirmer. A disputed record is held, not settled, so it waits. |
| 20 | A composer is never handed an answer it cannot show. The member's composer gets the member's own answers only; a named confirmer group, a declared payment, a gated offer, and the season-commitment kind are copied only into the steward's seeding wizard. Decided by Claude while building; Afo may overrule. | The member's composer has no fields for any of those, so copying a steward's would have a member promise money, or hand confirmation to other people, without seeing either. A season commitment becomes the nearest thing a member can make, a service kept by proof. |
| 21 | The source has to belong to the pool being composed into, and the PWA opens the composer in the commitment's own pool. The rule is enforced where the answers are read, not only where the button is drawn. Decided by Claude while building; Afo may overrule. | Requirement rows name that pool's actions and the terms were agreed there. A protocol commitment is read from the reader's own garden, which is not the pool it belongs to. A link can be edited, so a refusal opens an ordinary empty composer rather than an error. |
| 22 | A tray row gets its `clientCommitmentId` when it joins the tray and keeps it through every edit and every send. A row that was sent leaves the tray; a row that failed stays in the wizard marked Not sent, and is sent again under the same id. This now covers a single commitment too, which used to mint a new id on every press. Decided by Claude while building; Afo may overrule. | The queue dedupes a creation by that id and the chain by the key derived from it, so a row can only ever become one commitment. With an id minted at send time, a send whose job the queue kept (its transaction may be on chain) followed by a second press made a second job, and could make a second commitment. Decision 18 already drops an ordinary failed send, so the wizard is where a failed row waits, not the pool tab. |
| 23 | The open-commitment guard counts offers only, and unknown never refuses. Room is the pool's commitment limit, less the steward's open commitments as the indexer mirrors the registry's own count, less offers still queued on this device. At the limit, Add Another Like This is held for an offer; over it, seeding is held, and both say why. Decided by Claude while building; Afo may overrule. | `CommitmentRegistry.commitUnits` charges the cap to whoever provides. An offer's creator provides, so it is charged at creation; a request is charged to whoever takes it up, later, so a tray of requests uses none of the steward's room. The registry enforces the cap whatever the wizard says, so a read that has not arrived must not block anyone. |
| 24 | Hub → Confirm follows the garden in the header, like the Hub's other stages. When the selected garden confirms a commitment that lives in another garden's pool, the row names that pool. Decided with Afo on 2026-09-22, after the design audit in § 4b. | Root `DESIGN.md` § Interface Principles, principle 4: a page never acts outside the garden it shows. The queue spanned every garden the steward stewards, and each row confirmed in one click. |
| 25 | Confirm Kept opens a review dialog, the same one in the Hub and the commitment inspector. It names the commitment, who kept it, the garden's pool, and that it is final. | The act that closes a commitment for good went straight to the wallet, while Expire had a full confirmation. Spec C.48 already said the Hub's acts open a dialog. |
| 26 | Admin card and section titles become 16px semibold across the whole admin, after Afo approves a rendered before/after pair. | They render at 12px, the size of their own descriptions. Storybook showed them at 16px because it never loaded the admin's type classes, so reviews there saw a hierarchy the product lacks. |
| 27 | G$ settlement is enabled for every garden, so a pool's funding rail reads ready. | Every rail read "Funding unavailable" and "Settlement unavailable": ledger freshness used the indexer's caught-up timestamp, which is written once. Freshness now comes from each chain's processed block, timed on that chain. |
| 28 | The seed wizard ends on a done screen that lists each commitment as created (with its transaction), sends later, or not sent. | Create All sent one wallet prompt per commitment with an unlabelled bar between them, then closed. |
| 29 | Ending a season is built in this queue as two acts: End (`closeCycle`) frees the slot, and Archive (`compostCycle`) is final and says no certificate can be made for that season afterwards. | Builds decision 14. The certificate step is not built yet, and a pool closes only once its seasons are archived. |
| 30 | Protocol transfer Dispatch, Retry and Requeue open the same Review before sending dialog as a commitment's disbursements. | The same act was reviewed on a commitment and sent in one click on the protocol card. |
| 31 | Accepting a claim stays one click. The row names the claimant and shows a status line while the wallet runs. | The decision row keeps its paired acts; the gap was a claimant shown only as a truncated address. |
| 32 | Seed rows show the wallet and confirming phases, through an optional, report-only callback on the job queue. | The same phases as the setup checklist; the queue stores nothing new. |
| 33 | Every PR in the § 4b queue stacks on PR #873, the money fixes included, and the chain rebases onto `develop` once #873 merges. | One chain to review. |
| 34 | Protocol confirmations live only in Community → Coordination. Hub → Confirm never lists protocol fallback rows. | One home per organism, as `packages/admin/DESIGN.md` § Workspace Scope records. |
| 35 | § 4b lands in two waves. Wave 1 (the P0 and P1 fixes, the ledger fix and ending a season) lands before the QA call, and the call waits for all of it. Wave 2 lands before the Oct 2 cut. | Afo chose that nothing slips to after the call. |

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
| A landed act updates the screen without a reload | § 4 Build 1 part B | Built; live proof pending Stage A |
| Reuse a commitment instead of retyping it | § 4 Build 2 | Built; rendered proof pending |
| Create several commitments in one sitting | § 4 Build 3 (sequential; atomic later, § 7) | ✅ built, unreviewed |
| Catalog is correct, coherent, and one outcome per case | § 5 | ✅ built, unreviewed |
| Strong cases for every reachable pooling act | § 5.3, § 5.5, § 5.6 | ✅ built, unreviewed |
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

**Scope status**: both parts are committed on `fix/commitment-queued-acts-send-and-refresh`, cut
from `develop` at `574918cb5`: part A `7d5963d97`, part B `bde103aba`. Open as PR #857, the first
of four stacked PRs (#857 to #860). Both await review and a live reproduction in Stage A (§ 6.2).

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

**Part B — refresh after completion (built 2026-09-20, decision 1).**

What changed:

- `useCommitmentCompletionRefresh` listens to the queue's event bus for a completed commitment job,
  invalidates that chain's commitment reads, and invalidates them again on the shared
  `INDEXER_LAG_SCHEDULE_MS` (2 s, 5 s, 15 s) through the existing `useProgressiveInvalidation`. No
  new timer code.
- It is mounted once per app, somewhere that stays mounted: inside `JobQueueProvider` for the
  client, and in `routes/CanvasShell.tsx` for the admin. The admin has no queue provider, and its
  send dialogs close as soon as the act lands, so a hook mounted inside one is gone before the
  indexer catches up. The change to the Critical provider is one import and one hook call.

Two departures from the steps first planned, both simpler:

- No per-commitment key and no moved `subjectCommitmentId`. `commitmentPoolingKeys.all(chainId)` is
  a prefix of every commitment key, and the whole subtree has to refresh anyway: an act moves the
  pool's counts, the claim lists, and the inbox as well as its own record, and a creation has no
  id to name yet.
- One owner for the rule instead of a provider branch plus a hook-level schedule. Two listeners on
  the client would each have invalidated the same reads.

Proof:

- RED first (the hook did not exist), then GREEN in `commitment-completion-refresh.test.tsx`:
  invalidation at completion and at each step of the lag schedule, and no reaction to work or
  approval jobs, whose handlers already refresh them.
- `JobQueueProvider.test.tsx` proves the provider carries the refresh. One mutation was checked:
  unmounting the hook fails that test. `CanvasLayout.test.tsx` proves the admin shell mounts it;
  that one asserts the mount only, because the event bus is not a declared shared export.
- Declaring the hook's export changed `packages/shared/package.json`, which every public seam
  fingerprint hashes, so all four `shared-*` seams went stale. None of their declared inputs were
  touched by this branch, their twelve proof files pass (241 tests), and the four fingerprints were
  refreshed in the same commit, the same 8-line shape as `1fa2202e8`. They go stale again if
  `develop` adds an export before this merges.

### Validation receipt, Build 1

- **Tested implementation commit SHA**: `bde103abad0c6675c5917fe16430ce85cf34ab4f`. The gate ran on
  the working tree immediately before the commit; the pre-commit formatter changed nothing, and
  `git status --porcelain=v1 --untracked-files=all` is empty at that SHA.
- **Run finished (UTC)**: `2026-09-21T04:44:34Z`
- **Command**: `bun run check -- --intent push --reuse-passing-receipts` (selector: push, critical,
  27 changed paths)
- **Result**: every runnable check passed: format, lint, validation-system-test, test-quality,
  shared typecheck, test-typecheck, test (5,480 passed, 512 files) and build, client
  test-typecheck, test (1,347 passed, 142 files) and build, admin test-typecheck, test (866 passed,
  114 files) and build, agent typecheck, test-typecheck, test (323 passed) and build,
  source-structure, design-guardrails, ontology, agent-guidance, supply-chain, story-quality.
- **Blocked**: `browser-proof` (mandatory, `authenticatedBrave`). The gate therefore exits 2,
  "Validation blocked". This is not a pass. The flow could not be exercised in a browser anyway:
  every pool on chain is `NotReady` and the send needs a wallet signature.
- **First run of the same gate failed** on `test-quality` Check 6: the new test built a local
  `new QueryClient()`. It now uses `createTestQueryClient` and `createTestWrapper`.

### Build 2 — Prefilled Offer It Again, Ask Again, Seed another like this

**Branch**: `feature/commitment-create-another`, stacked on the Build 1 branch at Afo's direction.
**Status**: committed as `5c884ba9a`, open as PR #858. Decisions 8, 19, 20, 21.

What changed:

- `modules/commitment-pooling/compose-again.ts`: `composerValuesFromCommitment` maps a commitment,
  its words, and its requirement rows to composer answers. It carries direction, kind, title, note,
  links, unit label, target units, claim mode, team policy, the fallback choice, and requirement
  rows in the order they were asked. It never carries claims, people, proof, confirmations, payout,
  or identities, and it leaves out the due date and the cycle so both are chosen fresh. Decision 20
  decides what each composer receives.
- `acts.ts`: decision 19. `askAgain` joins `offerAgain`, both elective, so neither badges anyone.
  `isCommitmentCreator` sits beside `selectCommitmentSeat`, because a seat cannot answer it.
- `useComposeAgainValues` reads the source and applies decision 21 and the creator rule.
- PWA: `GardenCommitment` opens `/home/<pool garden>/commitments/new?direction=…&from=<id>`;
  `ComposeCommitment` reads `from`; the composer controller applies the answers as late defaults.
  A draft the person resumes still wins, and nothing they have typed is overwritten.
  `applyLateComposerDefaults` is now the one place that rule lives; the seeding wizard's session
  hook calls the same function.
- Admin: the inspector offers Seed Another Like This to the pool's stewards, only where a seeding
  wizard exists (the Hub's Confirm stage renders the same panel without one). Route presentation
  carries the source as `/garden/pool/seed?from=<id>`; dialog presentation hands it over in local
  state and closes the inspector first. The wizard keeps this pool's current season.
- One label per locale for Ask Again and Seed Another Like This.

Behaviour that changed for an existing reader: whoever took up a request that then lapsed used to
see Offer It Again, which only navigated back. They now see nothing, and the asker sees Ask Again.

Proof:

- RED first for the mapper and for the act rule. The mapper test also parses each result through
  `commitmentComposerSchema`, so a prefilled composer opens valid.
- The composer controller tests cover the prefill, the draft that wins, the draft that gives way
  to Start Fresh, answers arriving after the person typed, and a link naming the other door. One
  mutation was checked: letting the prefill overwrite a resumed draft fails its test.
- View tests: the PWA detail opens the composer in the commitment's own pool; the real-controller
  compose test opens on the reader's earlier answers; the admin inspector shows the entry to
  stewards only; the dialog presentation hands the source to the wizard one dialog at a time; the
  wizard opens on the earlier answers in this pool's season.
- Declaring `useComposeAgainValues` changed the shared manifest, so the four `shared-*` seams were
  re-certified in the same commit. None of their declared inputs were touched; their twelve proof
  files pass (241 tests).

### Validation receipt, Build 2

- **Tested implementation commit SHA**: `5c884ba9abb4f855810a7a78d860317d3f4adab3`. The gate ran on the working tree
  immediately before the commit; the pre-commit formatter changed nothing, and
  `git status --porcelain=v1 --untracked-files=all` is empty at that SHA.
- **Run finished (UTC)**: `2026-09-21T08:46:29Z`
- **Command**: `bun run check -- --intent push --reuse-passing-receipts`
- **Result**: every runnable check passed, 27 in all: format, lint, validation-system-test,
  test-quality, shared typecheck, test-typecheck, test (5,498 passed) and build, client
  test-typecheck, test (1,349 passed) and build, admin test-typecheck, test (869 passed) and build,
  agent typecheck, test-typecheck, test (323 passed) and build, staged-modules, source-structure,
  design-guardrails, ontology, agent-guidance, supply-chain, story-quality.
- **Blocked**: `browser-proof` (`authenticatedBrave`), so the gate exits 2. Not a pass.
- **No rendered proof, and why.** The authenticated Brave extension answered a tab-context probe,
  so Brave is reachable. The only dev server running serves the main checkout, not this worktree,
  and this worktree has no `.env`, so it cannot serve its own client. The demo world is built
  around the mock viewer, who made commitments 1011 and 1012 (fulfilled offers), 1013 (an expired
  offer) and 1014 (a cancelled request). Once this branch is what `:3001` serves, open
  `/home/<demo garden>/commitments/1011?mockAuth=user&mockPooling=1&presentation=pwa` for Offer It
  Again on a fulfilled offer, and `…/commitments/1014…` for Ask Again, then press each and read the
  composer. Demo mode renders fixtures and refuses every write, so nothing is signed.

**Out of scope**: starting from another person's commitment; series identity.

### Build 3 — Admin "Add another" batch tray

**Branch**: `feature/commitment-seed-batch-tray`, stacked on the Build 2 branch at Afo's direction.
**Status**: committed as `968f964e7`, open as PR #859. Decisions 4 to 7, 22, 23.

What changed:

- `modules/commitment-pooling/seed-tray.ts`: the pure tray. One row is always in hand, the one the
  wizard's form holds, and it joins the tray once its answers pass the composer's rules. The moves
  are keep, add another, take an earlier row back up, and remove; the last row is never removed.
  `sendSeedTray` sends the rows in order and applies decision 7, recording why a row failed before
  it moves on; `settleSeedTray` applies decision 22; `selectSeedTrayRoom` and
  `selectSeedTrayCapacity` apply decision 23. The planned `duplicate` move turned out not to be
  one: the form already carries the answers over, so adding another is keep plus a fresh id.
- `hooks/admin-ui/pool/useSeedTray.ts`: binds the tray to the wizard's one form. When the form is
  handed another row the answers go in as the steward's own, not as new defaults
  (`form.reset(values, { keepDefaultValues: true })`). `useSeedTrayRoom` reads the steward's open
  count from the pool detail the indexer already serves.
- Admin: the review step lists the rows added so far (who offers or asks, units, due, claim mode)
  with Edit and Remove, then This One with Remove This One. The footer gains Add Another Like This,
  which keeps the reviewed commitment and reopens the first step on the same answers, and the seed
  action reads Seed This Commitment for one or Create All (N) for several. The note states how many
  times the wallet will ask. After a send that leaves rows behind, the review says how many were
  sent and how many are still here. One commitment on its own keeps the plain failure sentence it
  had.
- New strings in `en`, `es`, `pt`, with ICU plurals for the counts.

Found while building, and the reason `keepDefaultValues` matters: a plain `form.reset` makes the
copied answers the new defaults, so none of them read as typed. The session hook applies late
defaults (the season, the protocol pool) to every field that does not read as typed, and the
refresh from Build 1 part B makes those arrive again after each creation lands. A copied Request
would have been flipped back to the wizard's default Offer. The hook test fails with
`expected 'OFFER' to be 'REQUEST'` when the option is removed.

Proof:

- RED first for the tray model (7 cases) and for the hook (4 cases): neither module existed.
- Decision 7 was nearly broken. The first version stopped the batch at a declined wallet prompt, on
  the reasoning that declining means stop. Decision 7 says a rejected row does not stop the batch,
  so the test was restated first (RED: the result still carried `stopped`), then the model. One
  consequence to know before the call: a steward who wants to abandon a batch part-way declines
  one prompt for each row that is left.
- Two mutations were checked and both were caught: a plain `form.reset` (above), and an id minted
  at send time, which fails the view test that sends a failed row again
  (`expected 'mock-uuid-…' to be 'mock-uuid-…'`).
- View tests, over the real tray with only the queue faked: add another then Create All (2) sends
  both under ids of their own; a row the chain refuses stays, the review says what is left, and the
  second press sends it under its first id; more offers than room holds seeding and says why.
- Rendered in Storybook served from this worktree (port 3004 was free, so it is this code): the
  tray list with one row not sent, the review with a send report and with more offers than room,
  the footer with Create All (3), and a walk of the real dialog: fill, Add Another Like This, first
  step reopened on `Market rides`, second step on `rides`, `16` and `14`, review showing the first
  row and Create All (2), Edit taking the first row back, Remove This One handing back the other.
  Nothing was sent. At 375px the row was cramped, so the actions now drop below the words; the
  page does not scroll sideways and the desktop row is unchanged.
- Declaring `useSeedTray` changed the shared manifest, so the four `shared-*` seams were
  re-certified in the same commit. None of their declared inputs were touched; their twelve proof
  files pass (241 tests).

Not proven:

- **No live send.** A send needs a wallet signature and every pool on chain is `NotReady`. Stage A
  (§ 6.2) is the first real proof: a tray of two lands both, one wallet prompt each.
- Known limits, left as they are. Each failed row also raises the shared error toast, so a batch
  with several failures, or several declined prompts, shows several. A row whose job the queue
  kept (its transaction may be on chain) reads as Not sent in the wizard, and pressing again is
  refused as an identity conflict rather than sent twice; its row on the pool tab, with Try Again,
  is what settles it. Rooms are read from the indexer, so two batches sent back to back can outrun
  it, and the registry then refuses the extra offer.

Seen in passing, not part of this build: the shared `StatusBadge` drops its `variant` before its
generic branch reads it, so every generic badge renders neutral grey, this tray's Not sent and the
pool tab's Failed to send included. Status still reads by icon and words. Flagged as its own task
because 23 call sites change colour when it is fixed.

### Validation receipt, Build 3

- **Tested implementation commit SHA**: `968f964e77ff913381dcd1dffb1e8b127d1aebed`. The gate ran on the working tree
  immediately before the commit; the pre-commit formatter changed nothing, and
  `git status --porcelain=v1 --untracked-files=all` is empty at that SHA.
- **Run finished (UTC)**: `2026-09-21T09:45:50Z`
- **Command**: `bun run check -- --intent push`
- **Result**: every runnable check passed, 27 in all: format, lint, validation-system-test,
  test-quality, shared typecheck, test-typecheck, test (5,509 passed) and build, client
  test-typecheck, test (1,349 passed) and build, admin test-typecheck, test (872 passed) and build,
  agent typecheck, test-typecheck, test (323 passed) and build, staged-modules, source-structure,
  design-guardrails, ontology, agent-guidance, supply-chain, story-quality.
- **Blocked**: `browser-proof` (`authenticatedBrave`), so the gate exits 2. Not a pass. The
  Storybook walk above is rendered proof of the wizard, not authenticated proof of a send.

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

## 4b. Design audit follow-ups (2026-09-22)

A read-only audit on 2026-09-22 checked the admin's commitment-pooling screens against root
`DESIGN.md` § Interface Principles, on PR #873's branch. The full report stays outside the repo.
This section holds the finding index, the queue that fixes them, and each PR's receipt. Decisions
24 to 35 settle the questions the audit raised.

### Finding index

- **P0**
  - A1: Hub → Confirm acted on every stewarded garden, not only the one in the header.
  - A2: Edit Pool sent two unannounced prompts and could say "not recorded" after the first had landed.
  - A3: The seed wizard took the Celo G$ reward in base units and echoed it raw.
- **P1**
  - A4: Confirm Kept went to the wallet in one click, with no review.
  - A5: Protocol confirmation rows named the acting garden, not the commitment's own.
  - A6: Protocol transfer rows showed a truncated Safe and enum names, and dispatched in one click.
  - A7: The seed tray's Create All ran several prompts behind an unlabelled bar, with no done state.
  - A8: The seed wizard never named the pool it writes to.
  - A9: Claimants read as truncated addresses beside a one-click Accept.
  - A10: Commitment inspector dialogs named no garden or pool.
  - A18: Every pool's funding rail read unavailable, because of the ledger freshness bug.
- **P2**
  - A11: One-signature acts waited in silence while the wallet was open.
  - A12: Card titles render at 12px in the admin and at 16px in Storybook.
  - A13: The "Writing to" line followed the consequence text in confirm and reason dialogs.
  - A14: The protocol pool's console had no marker, and its target copy contradicted the model.
  - A15: A stopped setup run did not say how many prompts a retry needs.
  - A16: The split step did not say the split is permanent, and its presets were unlabelled numbers.
  - A17: The first-run entry and button undersold a run of up to six prompts.
  - A19: Destructive acts sat red in place: Close pool, Expire now, Cancel commitment, disbursement Cancel.
  - A20: The gardener-delivery switch hid that it reaches every garden.
  - A21: Decline dialogs named neither the person nor the commitment.
  - A22: The "What needs you" counts were button tiles, and Needs recovery opened an unfiltered list.
  - A23: The settings dialog's stories crashed, and several states had no story.
- **P3**
  - A24: Queued rows offered Try Again before anything had been tried.
  - A25: Copy that did not earn its place, including developer vocabulary.
  - A26: Titles and action labels outside Title Case.
  - A27: Raw `--m3-*` colour tokens in pooling views.
  - A28: Left-aligned action clusters, three button weights in one footer, and generic labels.
  - A29: The second-season alert pointed to a close act that did not exist.
  - A30: Hub row details: an error chip for "under review", and two labels for one act.
  - A31: Set Up was disabled offline with no reason given.

### Queue

| PR | Covers | Status |
|---|---|---|
| W1-1 Ledger freshness, and the rail names its reason | A18 | Built |
| W1-2 Amounts in token units | A3 | Built |
| W1-3 The target line in dialogs; Storybook matches the product | A13, A10, A8, A21, A14 (copy), A12 (Storybook) | Built |
| W1-4 Hub scope and the Confirm Kept review | A1, A4, A5, A30, A25 (Hub), A19 (inspector) | Built |
| W1-5 Settings through the setup sequence | A2, A15, A23 (settings) | Built |
| W1-6 End a season | Decision 29, A29 | Built |
| W1-7 Claims and protocol transfers | A9, A6, A11 (Accept), A20 (label), A23 (panel) | Built |
| W1-8 Seed tray progress and the done screen | A7, A24 | Built |
| W1-9 Catalog PR | The cases Wave 1 changes | Built |
| W2-1 to W2-5 | The remaining P2 and P3 findings, the title rollout, and a catalog pass | Wave 2 |

### W1-1: ledger freshness

- **Fix:** freshness now comes from each chain's `latest_processed_block`, read from the indexer, and that block's time, read from the chain (`data-pool-funding-freshness.ts`). The ledger is fresh when the oldest processed block is under 120 seconds old.
- **Why the old check failed:** `timestamp_caught_up_to_head_or_endblock` is written once, when a chain first reaches head, so every rail read stale two minutes after the indexer started. A stopped indexer still reads stale, because its processed blocks age.
- **Rail:** it names the first unavailable reason, in the words the details dialog already uses.
- **Scope:** settlement acts never read the funding snapshot (`selectSettlementWorkflow`), so the bug was display-only.

### Validation receipt, W1-1

- **Tested implementation commit SHA:** `fd5060697f97a3d442ae0b587c9c8dfeaefd64bd`.
  - The gate ran on the working tree immediately before the two implementation commits.
  - Biome had already formatted every file, so the pre-commit formatter changed nothing.
  - `git status --porcelain=v1 --untracked-files=all -- packages/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T01:42:29Z`.
- **Command:** `bun run check -- --intent push`.
- **Result:** every automated check passed:
  - format and lint;
  - shared-test (74 passed, affected scope) and admin-test (69 passed);
  - admin-build;
  - source-structure, agent-guidance and story-quality.
- **Also run:**
  - the shared funding suites, 48 passed;
  - `GardenPoolFunding.test.tsx`, 19 passed;
  - shared and admin typecheck in the source and tests scopes, both clean.
- **RED:** with the old freshness rule restored, 3 of the data suite's cases failed. They are recorded through `record-tdd`.
- **Rendered proof (Storybook):** `admin-pool-poolfundingsection--funding-unavailable` and `--settlement-blocked` show the reason line.
- **Pending:** authenticated Brave proof. The staging rails can read ready only once this is deployed.

### W1-2: amounts in token units

- **Before:** the seed wizard took a declared reward in base units and echoed the raw number in the review. Typing 50 on the Celo rail recorded 5 × 10⁻¹⁷ G$.
- **After:** the amount is typed in the token's own units and stored as its base units, which is what the contract records.
  - G$ units come from `CELO_G_DOLLAR_TOKEN`.
  - An external token's units are read from the chain (`useErc20Metadata`). While they are unknown, the field waits and says why, and nothing with a reward can be seeded.
  - The review shows the formatted amount.
  - Changing the rail clears the amount. Changing the token keeps the typed amount's meaning.
- **Unchanged:** the schema, the payload and compose-again.
- **Seams:** the new shared export changes `packages/shared/package.json`, so the four certified seams are re-fingerprinted.

### Validation receipt, W1-2

- **Tested implementation commit SHA:** `b88b489d97b08ce75a672a25af77a73344ad7dfd`.
  - The gate ran on the working tree immediately before the two implementation commits, and the pre-commit formatter changed nothing.
  - `git status --porcelain=v1 --untracked-files=all -- packages/ scripts/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T02:14:22Z`.
- **Command:** `bun run check -- --intent push`.
- **Result:** the `package.json` change escalated the gate to the full suite, and all 24 checks passed:
  - format, lint, validation-system-test and test-quality;
  - shared, client, admin and agent typecheck, test-typecheck, test and build;
  - source-structure, design-guardrails, ontology, agent-guidance, supply-chain and story-quality.
- **Also run:**
  - the seed wizard, seed model and how-much suites, 40 passed;
  - `locale-coverage.test.ts`, 15 passed;
  - `check-direct-tested-seams.mjs`, no drift.
- **RED:** with the conversion storing typed text as base units, the payload case failed. It is recorded through `record-tdd` on the `ui` lane.
- **Rendered proof (Storybook):**
  - `admin-pool-seedamountfield--*`: 10 G$ reads as 10, 2.5 USDC stores 2500000, too many decimals is refused, and an unreadable token holds the field;
  - `admin-pool-seedstepreview--garden-work-with-reward`: "External payout record · 250 USDC".
- **Pending:** authenticated Brave proof of an on-chain seed.
- **CI follow-up:** Build Docs failed on #875. The new export left `api-index.mdx` and `commands.mdx` with stale digests, and the local push gate does not run `docs-generated`. `c8b10e885` regenerates them on W1-2's branch; the branches above it carry the fix when the stack merges in order.

### W1-3: the target line in dialogs, and Storybook matching the product

- **The slot:** `AdminDialog`, `AdminConfirmDialog` and `AdminReasonDialog` take an optional `target`, rendered under the title and before the description.
- **What now names its target:**
  - every pool dialog (close, archive, reopen, pause, cancel, decline, settings);
  - every commitment inspector dialog;
  - every seed wizard step;
  - the past-due row's Expire.
- **Decline:** names the commitment and who asked.
- **`GardenPoolTarget`:** builds the line from a garden's address alone. It reads the name from the gardens list and recognises the protocol pool by the protocol's root garden.
- **Protocol copy:** it now says the pool is the Green Goods Community Garden's own.
- **Storybook:** the admin's named type classes moved to `packages/admin/src/styles/admin-type.css`, imported by both the admin entry and Storybook, so the two render the same way (titles 12px/500).
- **D3 check:** the before/after pairs (12px/500 against 16px/600, the same colour and Plus Jakarta Sans) went to Afo. W2-3 waits for his yes.

### Validation receipt, W1-3

- **Tested implementation commit SHA:** `c434da8e45c14c39ce54e1afadebf6e14a96b4ea`.
  - The gate ran on the working tree immediately before the three implementation commits, and the pre-commit formatter changed nothing.
  - `git status --porcelain=v1 --untracked-files=all -- packages/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T03:47:21Z`.
- **Command:** `bun run check -- --intent push`.
- **Result:** all 25 checks passed:
  - format, lint, validation-system-test and test-quality;
  - shared, client, admin and agent typecheck, test-typecheck, test and build;
  - source-structure, design-guardrails, ontology, agent-guidance, supply-chain and story-quality;
  - storybook-build.
- **Also run:**
  - the nine affected admin suites together, 105 passed;
  - `locale-coverage.test.ts`, 15 passed;
  - shared and admin typecheck in the source and tests scopes.
- **Story sweep:** 238 pooling stories, no new crash. The three settings dialog stories still crash on the missing data router; W1-5 fixes them.
- **RED:** with the target rendered after the description (the old placement), the header-order case failed. It is recorded through `record-tdd` on the `ui` lane.
- **Rendered proof (Storybook):**
  - `admin-pool-pooldialogs--close-pool-confirm`: title, then "Writing to Rocinha's pool", then the consequence;
  - `admin-pool-commitmentreasondialogs--decline-request`: the commitment in its garden's pool, and who asked;
  - `admin-pool-seedcommitmentdialog--protocol-context`: the protocol warning above step one;
  - `admin-pool-gardenpooltab--open`: titles at 12px/500, as on staging.

### W1-4: Hub scope and the Confirm Kept review

- **Scope** (A1, decision 24): Hub → Confirm lists only what the garden in the header confirms. That is its own group, the garden fallbacks its steward may step into, and the disputes in its own pool, and the tab count follows. `selectToConfirmForGarden` does the narrowing. The confirmation hook's inputs are unchanged, so the PWA reads as before.
- **Protocol rows** (decision 34): never listed in the Hub. They stay in Community → Coordination.
- **Whose pool** (A5): a row whose commitment lives in another garden's pool says "in {garden}’s pool". While the gardens list is unread it shows the address instead. In Coordination, rows used to name the Green Goods team; they now name the garden whose pool the team confirms in.
- **The review** (A4, decision 25): `ConfirmKeptDialog`, shared by the Hub and the inspector, names:
  - the commitment and its garden's pool;
  - who kept it;
  - whether this confirmation closes it.

  Both cases say a confirmation cannot be taken back, because `ConfirmLib.confirmFulfillment` records it for good.
- **Hub copy** (A30, A25):
  - one label, "Confirm Kept…", on every row;
  - the chips read "Ready to confirm", "Needs a steward step-in" and "Needs the Green Goods team";
  - "Under review" sits on a warning chip, not an error chip.
- **Inspector** (A19): Expire leaves the routine cluster for its own row after it, as an outlined button. The red stays inside its confirmation.
- **For W1-9:** the catalog cases that quote the old flow or labels are ADM-013, ADM-075, ADM-076, ADM-110, ADM-111, ADM-112 and ADM-136.

### Validation receipt, W1-4

- **Tested implementation commit SHA:** `918a6b8b23d688eaf3677acb3752ee185d849974`.
  - The gate is the pre-push run on that commit.
  - `git status --porcelain=v1 --untracked-files=all -- packages/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T04:27:29Z`.
- **Command:** `bun run check -- --intent push` (the pre-push hook).
- **Result:** all 25 checks passed:
  - format, lint, validation-system-test and test-quality;
  - shared, client, admin and agent typecheck, test-typecheck, test and build;
  - source-structure, design-guardrails, ontology, agent-guidance, supply-chain and story-quality;
  - storybook-build.
- **Cache:** the shared tests ran in full. The client, admin and agent tests were cache hits on inputs identical to a full run of the same gate that ended at `2026-09-23T04:21:01Z`.
- **Also run at that SHA:**
  - the shared scope and naming suites, 20 passed;
  - seven admin suites (HubConfirm, CommitmentDialog, CommunityPools, GardenPool, PoolDialogs, SeedCommitment, AdminDialog), 97 passed.
- **Before commit:**
  - the i18n suites, 41 passed;
  - shared and admin typecheck in the source and tests scopes.
- **RED:** two mutations, each caught and recorded through `record-tdd` on the `ui` lane.
  - Letting protocol rows into the garden's stage failed the scope table.
  - Sending Confirm Kept straight from the row failed two Hub cases.
- **Rendered proof (Storybook, headless Chromium):**
  - `admin-hub-hubconfirmqueue--in-another-gardens-pool` and `--protocol-confirmations`: the pool named on each row;
  - `admin-hub-hubconfirmqueue--confirm-kept-review`: the review opens from the row;
  - `admin-pool-confirmkeptdialog--*`: closes it, counts toward it, protocol pool, sending;
  - `admin-pool-commitmentactions--ready-to-confirm`: Expire in its own row.
- **Pending:** authenticated Brave proof of a wallet confirmation, walked in the rehearsal.

### W1-5: settings through the setup sequence

- **The save** (A2): `settingsSteps` plans only what changed, the agreement first, and the dialog runs it through `useCommitmentPoolSetupSequence`.
  - Before saving, the dialog says how many times the wallet will ask: once when the wallet takes both writes together, otherwise once per write.
  - Each write shows as it lands (`PoolSettingsProgress`).
  - A stop names what was saved, for example "The new agreement is saved. The commitment limit is not."
  - Try Again sends only what is left, and the dialog ends on "Settings saved.".
  - A pin failure keeps the words on screen with nothing sent.
- **Removed:** the console's `saveSettings` act. Its tests move to the planner and the dialog.
- **Retry counts** (A15): a stopped run numbers its prompts over the writes still to send. The note says "Your wallet will ask N more times." Setup and settings share the running line and the prompt count through `setupWrites.ts`.
- **Toast:** the sequence takes a `toastContext`, so a failed settings save reads "Pool settings failed".
- **Stories** (A23): `withDataRouter` mounts the settings stories in the data router `useBlocker` needs, so all three render again. Five pooling stories use it in place of inline routers. The `PoolSettingsProgress` stories cover signing, confirming, a partial stop, nothing saved, no wallet, and saved.
- **For W1-9:**
  - ADM-063 expects one transaction per save; it becomes "the dialog says how many prompts a save takes, and a partial stop names what was saved";
  - ADM-056 and ADM-057 take the retry count.

### Validation receipt, W1-5

- **Tested implementation commit SHA:** `15d40ed794c9e2c2a9d855cab638a4438517cf30`.
  - The gate is the pre-push hook on that commit.
  - `git status --porcelain=v1 --untracked-files=all -- packages/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T05:20:38Z`.
- **Command:** `bun run check -- --intent push` (the pre-push hook, `critical · 118 changed path(s)`).
- **Result:** all 25 checks passed:
  - format, lint, validation-system-test and test-quality;
  - shared, client, admin and agent typecheck, test-typecheck, test and build;
  - source-structure, design-guardrails, ontology, agent-guidance, supply-chain and story-quality;
  - storybook-build.
- **Cache:** the package tests were cache hits on a full, uncached run of the same gate on the same SHA. That run ended at about `2026-09-23T05:18Z`, after which its push died with exit 141.
- **Also run at that SHA:**
  - the shared sequence and console suites, 39 passed;
  - the admin settings, setup-writes, setup-flow and pool-tab suites, 52 passed.
- **Before commit:**
  - the full admin suite, 116 files and 913 passed;
  - shared and admin typecheck in the source and tests scopes;
  - design-tokens, source-structure, story-quality and react-patterns.
- **RED:** three mutations, each caught and recorded through `record-tdd` on the `ui` lane.
  - Counting landed writes after a stop failed 4 cases.
  - Planning the limit before the agreement failed 3.
  - A Try Again that re-runs instead of retrying failed 1.
- **Story sweep:** 50 affected stories, headless. None crash. `pooldialogs--all-closed` renders nothing, as intended.
- **Rendered proof (Storybook, headless Chromium):**
  - `admin-pool-poolsettingsdialog--both-changed`: the prompt count before saving;
  - `admin-pool-poolsettingsprogress--*`: signing, confirming, a partial stop, nothing saved, no wallet, saved;
  - `admin-pool-setupfailure--several-still-to-send`: "Your wallet will ask 4 more times."
- **Pending:** authenticated Brave proof of a two-write save with the second prompt refused, walked in the rehearsal.

### W1-6: end a season

- **The rule** (decision 29): `selectCycleEndAct` mirrors the guards in CyclesLib. It offers:
  - End (`closeCycle`) on an Open cycle with nothing live;
  - the live count while commitments still hold it open;
  - Archive (`compostCycle`) on a Reconciled cycle.
- **The card:** the running season and each open campaign offer End. Until they can, they say how many commitments are still live. A Reconciled cycle in Finished offers Archive.
- **The dialogs:** both name the cycle in its pool first. Archive warns that no impact certificate can be made afterwards, because the certificate composer takes only a Reconciled cycle.
- **Closing a pool:** `closePool` needs every cycle terminal, and a Reconciled cycle is not. Archive is how a pool with ended seasons reaches Closed.
- **A29:** the second-season alert now points at End.
- **For W1-9:** ADM-057 and ADM-138 (the second-season path), and new cases for End and Archive.

### Validation receipt, W1-6

- **Tested implementation commit SHA:** `b681c850b6bd6ee29f497483670a0dd52b0537f4`.
  - The gate is the pre-push hook on that commit.
  - `git status --porcelain=v1 --untracked-files=all -- packages/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T05:45:42Z`.
- **Command:** `bun run check -- --intent push` (the pre-push hook).
- **Result:** all 25 checks passed:
  - format, lint, validation-system-test and test-quality;
  - shared, client, admin and agent typecheck, test-typecheck, test and build;
  - source-structure, design-guardrails, ontology, agent-guidance, supply-chain and story-quality;
  - storybook-build.
- **Cache:** the package tests were cache hits on a full, uncached run of the same gate on the same SHA. That run ended at `2026-09-23T05:42:49Z`, after which its push died with exit 141.
- **Also run at that SHA:**
  - `commitment-pool-console.test.ts`, 14 passed;
  - the admin cycles, dialogs, pool-tab and setup-flow suites, 46 passed.
- **Before commit:**
  - the full admin suite, 117 files and 917 passed;
  - the i18n suites, 41 passed;
  - shared and admin typecheck in the source and tests scopes;
  - design-tokens, source-structure, story-quality and react-patterns.
- **RED:** two mutations, each caught and recorded through `record-tdd` on the `ui` lane.
  - Offering End while commitments are live failed the table and the flow.
  - Archive sending `closeCycle` failed the flow.
- **Rendered proof (Storybook, headless Chromium):**
  - `admin-pool-poolcyclescard--open-season-with-campaigns`, `--ready-to-end` and `--reconciled-season`;
  - `admin-pool-poolcycledialogs--end-season`, `--end-campaign` and `--archive-season`.
- **Pending:** authenticated Brave proof of ending and archiving a season, walked in the rehearsal.

### W1-7: claims and protocol transfers

- **Accept** (A9, the A11 minimum, decision 31): it stays one click.
  - The claimant is named: a garden by its name, a person by their resolved name. So are the requester and the inspector's roster.
  - While the act runs, the row shows one line: confirm in your wallet, confirming on Arbitrum One, accepted, or failed.
  - The row's acts stay closed until the index moves the request on.
- **Phase tracking:** `actPhaseReducer` is keyed per row and ignores late events from a replaced act. `useTxActPhase` feeds it, and `useCommitmentMutation` takes the send callbacks per call.
  - Both stay internal. The controllers expose `claimPhase`, so no new package export was needed.
  - The pool mutation gets the same callbacks in W2-2, when Resume uses them.
- **Transfers** (A6, decision 30):
  - Rows name the receiving garden, from the indexed `Disbursement.garden`, which `queueFunding` sets to the receiver.
  - The enum copy is gone.
  - Dispatch, Retry and Requeue open `TransferReviewDialog`, extracted from the commitment disbursements with its wording.
- **A20:** the delivery confirmation reads "Enable Gardener Delivery" or "Disable Gardener Delivery". Naming its reach and its read-back state is W2-2.
- **A23:** the protocol-funding panel story runs as the deployer and renders.
- **For W1-9:**
  - claims: ADM-040 and ADM-065;
  - transfers: ADM-045, ADM-088 and ADM-089;
  - the delivery label: ADM-087.

### Validation receipt, W1-7

- **Tested implementation commit SHA:** `e39075e18824fdd4130e1ef137e9572ddef8ecef`.
  - The gate is the pre-push hook on that commit, run uncached.
  - `git status --porcelain=v1 --untracked-files=all -- packages/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T06:19:53Z`.
- **Command:** `bun run check -- --intent push` (the pre-push hook, `critical · 154 changed path(s)`).
- **Result:** all 25 checks passed:
  - format, lint, validation-system-test and test-quality;
  - shared, client, admin and agent typecheck, test-typecheck, test and build;
  - source-structure, design-guardrails, ontology, agent-guidance, supply-chain and story-quality;
  - storybook-build.
- **Also run at that SHA:**
  - the shared act-phase, console, hooks and funding-data suites, 82 passed;
  - the admin claims, transfers, delivery, settlement and pool-tab suites, 45 passed.
- **Before commit:**
  - the full admin suite, 117 files and 920 passed;
  - 20 affected shared files, 208 passed;
  - shared and admin typecheck in the source and tests scopes;
  - design-tokens, source-structure, story-quality, react-patterns and the direct-tested seams check.
- **RED:** three mutations, each caught and recorded through `record-tdd` on the `ui` lane.
  - Letting a replaced act's events move the line failed the table.
  - Reopening a row while Accept runs failed 2 claim cases.
  - Dispatching straight from the row failed the transfer flow.
- **Story sweep:** 69 affected stories, headless. None crash.
- **Rendered proof (Storybook, headless Chromium):**
  - `admin-pool-poolclaimscard--accepting`;
  - `admin-pool-commitmentclaims--accepted-awaiting-index`;
  - `admin-pool-claimantname--garden`;
  - `admin-community-protocolfundingrows--queued`;
  - `admin-community-protocolfundingoperationscard--review-before-dispatch`;
  - `admin-community-protocolfundingoperationspanel--registered-recipients`.
- **Pending:** authenticated Brave proof of accepting a claim and dispatching a protocol transfer, walked in the rehearsal.

### W1-8: seed tray progress and the done screen

- **The pass** (A7, decisions 28 and 32): while a pass runs, the wizard lists every row with where it stands. One line above the list names the prompt the wallet is on: "Confirm in your wallet (2 of 3)", then "Confirming on Arbitrum One (2 of 3)".
- **The done screen** (decision 28): the wizard stays open on how each row ended.
  - A created row links to its transaction.
  - A row that sends later waits on the pool tab with Send Now. Its marker is a clock, not the cross a failure shows.
  - A row not sent has nothing created for it.

  Done closes the wizard. When rows were not sent, Back to Review returns to them and Try Again sends them again under the ids they already had. Once every row is sent the steps stop opening, since seeding the same answers again would make a second commitment.
- **The prompt count** sits beside the button that asks. It replaces the progress bar and the review step's two notes.
- **Send reporting** (decision 32):
  - `ProcessJobContext.onPhase` is optional and report-only. The queue calls it after the executor's own checkpoints and never stores or awaits it. A throw inside it is logged and ignored.
  - `useCommitmentJobs` takes a `report` for each act. A report that throws cannot fail an act that landed.
  - `seed-tray` follows the pass row by row.
- **Certified seam:** the job-queue handle's `processJob` context gains the optional `onPhase`. The certified evidence is unchanged, and the new cases sit in `job-queue.send-phases.test.ts`. Folding them into that evidence would re-certify the seam, which is a `module-seams-review` act, so it is left for that review.
- **One list:** `TxProgressList` is the setup's progress list, moved to `components/`, and `SetupProgressList` adapts it.
- **A24:** a queued row says Send Now until a send has failed, and Try Again only after that.
- **For W1-9:** ADM-125, ADM-126, ADM-127 (Send Now), ADM-129, ADM-131, ADM-132 and ADM-140, and a new case for the pass and the done screen.

### Validation receipt, W1-8

- **Tested implementation commit SHA:** `73ca254411f0f216f693f2ee3de5e15f2a0efa9a`.
  - The gate is the pre-push hook on that commit.
  - `git status --porcelain=v1 --untracked-files=all -- packages/` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T07:05:34Z`.
- **Command:** `bun run check -- --intent push` (the pre-push hook, `critical · 170 changed path(s)`).
- **Result:** all 25 checks passed:
  - format, lint, validation-system-test and test-quality;
  - shared and agent typecheck;
  - shared, client, admin and agent test-typecheck, test and build;
  - source-structure, design-guardrails, ontology, agent-guidance, supply-chain and story-quality;
  - storybook-build.
- **Cache:** the shared tests (523 files, 5,606 passed) and the admin tests (117 files, 921 passed) ran in full. The client and agent tests were cache hits on the same gate's uncached run at `78d821bb0`, the commit before the marker fix. That run passed all 25 at `2026-09-23T06:58:51Z`.
- **Also run at that SHA:**
  - the shared send-phase, seed-tray and commitment-jobs suites, 5 files and 42 passed;
  - the admin seed, pool-tab, setup-flow and settings suites, 4 files and 64 passed.
- **Earlier in the work:**
  - 147 shared files, 1,538 passed;
  - shared, admin and client typecheck in the source scope, and shared and admin in the tests scope;
  - design-tokens, source-structure, story-quality, react-patterns and the direct-tested seams check (4 certified seams, no drift).
- **RED:** 14 mutations, each caught. Three are recorded through `record-tdd` on the `ui` lane:
  - reporting before the executor's checkpoint failed 2 send-phase cases;
  - reopening a row that ended failed 3 seed-tray cases;
  - closing the wizard after a pass failed the seed flow.
- **Story sweep:** 260 pool and progress stories, headless. None crash.
- **Rendered proof (Storybook, headless Chromium):**
  - `admin-pool-seedstepdone--sending-at-the-wallet` and `--sending-confirming`;
  - `admin-pool-seedstepdone--mixed` and `--nothing-created`;
  - `admin-pool-seedflowfooter--ready-to-create-several` and `--done-with-unsent`;
  - `admin-pool-poolcommitmentscard--queued-needs-attention`;
  - `admin-primitives-txstepmarker--all-states`.
- **Pending:** authenticated Brave proof of seeding a tray of several in a real wallet, walked in the rehearsal.

### W1-9: the catalog after Wave 1

- **Retired**, because their result changed:
  - ADM-013, for ADM-145 (the Confirm Kept review) and ADM-146 (a commitment that has left the queue). The relay journey walks ADM-145 in its place, in all three QA locales.
  - ADM-063, for ADM-147 (the prompt count, then Settings saved), ADM-148 (a stop partway) and ADM-149 (Discard Changes?).
- **Added**, one outcome each:
  - ADM-144, Hub scope;
  - ADM-150, the seeding pass and its done screen;
  - ADM-151 to ADM-153, End, End withheld while live, and Archive;
  - ADM-154 and ADM-155, the funding rail ready and naming its reason;
  - ADM-156, the transfer review;
  - ADM-157 and ADM-158, reward amounts in their own units;
  - ADM-159, Accept's progress on its row.
- **Corrected in place**, with meaning unchanged:
  - ADM-045 and ADM-140, including their es and pt copy;
  - ADM-075, ADM-077, ADM-087, ADM-088, ADM-089 and ADM-111;
  - the seeding rows ADM-125 to ADM-129 and ADM-131 to ADM-134.
- **Where this differs from the plan's list:**
  - ADM-013 is retired rather than rewritten, because its result changed.
  - ADM-040, 042, 043, 044, 061, 137, 138 and 139 needed no change.
  - ADM-155 and ADM-159 were added so every Wave 1 behaviour has a case.
- **Counts:** 321 active cases and 386 ids.
- **Docs:** the Test Cases page projection, plus the package index digests. The digests repeat `c8b10e885`'s regeneration, because touching `docs/` makes the gate select the docs checks.

### Validation receipt, W1-9

- **Tested commit SHA:** `76b1c78fd8916d78bfe112a4ff769e000acd20ac`.
  - The gate is the pre-push hook on that commit.
  - `git status --porcelain=v1 --untracked-files=all` is empty at that SHA.
- **Run finished (UTC):** `2026-09-23T07:26:40Z`.
- **Command:** `bun run check -- --intent push` (the pre-push hook, `critical · 178 changed path(s)`).
- **Result:** all 30 runnable checks passed:
  - format, lint, validation-system-test and test-quality;
  - the package typecheck, test and build checks;
  - docs-authority, docs-test and docs-build;
  - source-structure, design-guardrails, ontology, agent-guidance, qa-id-ledger, supply-chain and story-quality;
  - storybook-build and agent-tools-test.
- **Cache:** the package tests were cache hits. No package source changed since W1-8's uncached run at `73ca25441`.
- **Also run before commit:**
  - `node packages/qa/build.mjs`: 321 active cases in en, es and pt;
  - `check-qa-id-ledger.mjs --base fix/seed-tray-progress`: 386 ids, none removed, reintroduced or reactivated;
  - `bun run check --only` for qa-id-ledger, agent-tools-test (the catalog contract tests among its 260), docs-generated, docs-authority and ontology.
- **TDD:** not applicable. The PR changes catalog data and generated docs, not behaviour.
- **PR:** #888, stacked on #887.

## 5. Catalog PR

**Branch**: `test/commitment-pooling-qa-catalog` · Lands after Builds 1–3 so labels are final.
Mechanics follow the QA Runs pattern: a one-shot node script retires rows
(`retiredOn`, `retiredReason`, `replacedBy`), splices new rows after the last id of their prefix,
and appends the ledger in the same order; then Biome on both JSON files,
`node scripts/docs/generate.mjs`, `check-qa-id-ledger.mjs --base <parent>`, and
`node packages/qa/build.mjs`. Write every row against
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
- Batch tray: Add Another Like This reopens the first step on the same answers, Edit and Remove
  change the tray, and Create All (N) lands every row with one wallet confirmation each (Build 3).
- A row the chain refuses stays in the wizard marked Not sent while the others land, and sending
  it again lands it once (Build 3).
- Declining one wallet prompt skips that row only: the others still land, and the declined one
  stays in the wizard marked Not sent (Build 3).
- More offers than the steward has room for under the pool's commitment limit holds seeding and
  says why; a request takes none of that room (Build 3).
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

### 5.6 What was built (2026-09-21)

**Branch**: `test/commitment-pooling-qa-catalog`, stacked on the Build 3 branch at Afo's direction.
**Status**: committed as `451cb4b08`, open as PR #860. A review round followed; see below.

The catalog went from 266 active cases to 307: 11 retired, 52 added, 3 corrected in place. Every
label a row quotes was read from `packages/shared/src/i18n/en.json`, and every behaviour from the
source, on the day the row was written.

Where the work differed from § 5.1 to § 5.4, and why:

- **`knownGate` is a journey-step field, not a case field** (`packages/qa/build.mjs` projects it
  only from `journeys[].steps`). ADM-080 is in no journey, and a case-level field would be a schema
  change to the catalog, the build, the contract test, and the app. The gate is written as a third
  precondition on ADM-080 instead, in the contract's own words: look for the act, record Blocked
  only on meeting the gate.
- **ADM-012 needed no change.** Its "pinned" is the pinned dialog action region in Hub · Work, not
  a pinned document.
- **ADM-026 was stale, and it sits in the relay journey.** It expected a queued row to appear
  before the indexer caught up. Since Build 1 a wallet send goes at once and leaves no queued row,
  so a tester would have failed a correct product. It is retired: the wizard's validation and
  review are ADM-140, and the send and the landing are ADM-125.
- **The relay's fixture was inconsistent.** ADM-039 seeded "a concrete service", but every later
  step walks the Work rails (link Work, approve it, confirm after approval), and only the
  garden-work type has action rows Work can link to. It is retired for ADM-139, which seeds a
  Garden work (impact) Request with one action row. The journey summary says which rails it
  walks, and the ADM-140 step's handoff says the same of the local commitment. The journey, both
  successors, and the two rows that name them as a prerequisite (PWA-047, PWA-049) are updated in
  the QA app's `en`, `es`, and `pt` locale files, which carry journey cases only.
- **PUB-027's "finished cycles page with show-more" was already PUB-045**, so PUB-027 is replaced
  by four new cases and PUB-045 rather than a duplicate.
- **ADM-059 already cancels a cycle and checks the public page.** The two new cycle cases are the
  rehearsal-exit properties it did not cover: Cancel season… is offered only while the season has
  no live commitments (ADM-137), and cancelling the open season frees the pool to start another
  (ADM-138). ADM-059's precondition now says what makes a cycle cancellable.
- **PWA-093's setup no longer holds.** "Reject the wallet signature on every retry" cannot make an
  act give up: since Build 1 a wallet reader's declined prompt drops the act. Its successors are
  written for a passkey reader, with an honest precondition (the state may not be producible on
  demand), and the wallet behaviour is its own case (PWA-114).
- **Dropped: "a non-steward presses Expire Now".** Expiring is permissionless on chain, but the
  admin opens a garden's console only to its stewards and owners (`useRole` reads `operators` and
  `owners`), and the app has no expire act. There is no screen for the twin, so it is a § 7 gap,
  not a case.
- **"A contributor is refused when they try to confirm" became ADM-136**: a steward who is on the
  commitment's team is offered no confirm act, ordinary or fallback. That is where the rule is
  visible; nobody is shown a refusal.
- **Two extra successors for ADM-078**: Kept is withheld from a steward on the roster (ADM-117),
  and for a record that had expired before the dispute (ADM-141). `resolveFulfilled` checks the
  two independently, so each is a case.
- **Requeue and the two gave-up cases say what to do when the state cannot be produced**: leave
  the case without an entry. Recording N/A would count it as walked (the 2026-09-05 rule).

Found while writing PWA-104's successors, and fixed as its own commit (`98d3b27f5`): the lapsed
band for the provider seat ends "You can offer it again." Since decision 19, whoever took up
somebody else's request is seated as provider but is offered no such act, so the band promised a
button that was not there. The band now reads the act the reader is actually offered. It belongs
with Build 2 when the PRs are cut.

Generated docs, in two commits of their own: `api-index` and `commands` hash
`packages/shared/package.json` and had gone stale with the three exports Builds 1 to 3 added; the
push gate did not select the docs check until this branch touched `docs/`. `mcp-guide`,
`task-routing`, and `gh-actions` were stale on `develop` itself (none of their sources are touched
by these branches); only their digest lines changed, and they are refreshed here because
`docs-authority` fails otherwise.

#### Review round on PR #860 (2026-09-21)

The Codex reviewer left four comments. All four held up against the source and the catalog's own
contract, so all four were taken:

- **Retire, do not edit, a case whose result changed.** ADM-026 and ADM-039 had been corrected in
  place. A verdict recorded before the change would then have read as a verdict on a different
  check. Both rows are back to their original wording and retired, with successors ADM-140 and
  ADM-139 (and ADM-125 for the send), so an earlier verdict shows as inherited.
- **ADM-124 could not be walked.** Read Again is rendered only inside the alert for a failed chain
  read (`CommitmentSettlement.tsx`, `settlement.chainRead === "failed"`). The row had been copied
  from ADM-085's wording without being checked against the source, which is the rule this plan
  set for every row. It now starts from the failed read.
- **Active rows named retired ones as prerequisites.** ADM-084 and ADM-109 pointed at ADM-083, and
  ADM-059 at PUB-027. The apply script had checked references in the new rows only. The fix
  script now fails if any active row, or any journey step, names a retired case.
- **ADM-117 grouped two independent guards.** Split into ADM-117 and ADM-141.

The same flaw was then looked for in the rows this change added, and found once: ADM-130 asked
for Edit, Remove, and Remove This One in one verdict. It is now ADM-130, ADM-142, and ADM-143.
ADM-128 also claimed when Discard is *not* offered, which its steps never reach; that sentence is
gone.

#### Review rounds across the stack (2026-09-21)

Twenty-two review comments across the four PRs. Five were answered in the first
round on the catalog; the remaining seventeen were audited against the source
before anything was changed, and eleven were taken.

Fixed, each with a test:

- **A commitment act whose send may already be on chain is kept** (`efb8fdfec`).
  `SEND_RECORDS` covers only `work` and `approval`, so `hasRecordedSend` is
  always false for a commitment job and `discardJob` had nothing to refuse on:
  decision 18's safety claim was not true for these kinds. Only a declined
  prompt is dropped now. Mutation-checked.
- **A refused discard is reported** rather than leaving the row in place.
- **A requirement naming a closed action window is dropped**, using the same
  filter `ComposeActionRail` already applies.
- **The new maker is never copied into their own confirmer group**, with the
  threshold clamped to what is left. `normalizeConfirmers` drops the provider
  and reverts `InvalidConfirmerRule` when too few remain.
- **A tray row is not parked before the season and protocol-pool reads land**,
  so it cannot carry a cold-load `cycleId` of `0`. The composer's session covers
  the row in the form; a parked row is a snapshot nothing revisits.
- Seed Another Like This is disabled offline; offering again waits for the
  owning pool instead of falling back to the route's garden; the Not sent mark
  survives on the last remaining row.
- Three catalog rows corrected against the contracts (`28c3918cd`): ADM-119 does
  not expect disbursements at finalization, ADM-120 keeps the plan Pending after
  a dispatch, and PWA-113 no longer asserts a state its steps never reach.

Tracked, not fixed: **PRD-957**, commitment acts sent from a Safe report success
before the proposal executes. The pending confirmation is dropped by the
executor, and every fix needs an already-sent guard for the four non-creation
job kinds, which only the creation kinds have. Latent before this stack made the
wallet path reachable.

Left with the reasoning in each reply: the terminal-job resubmission path, the
multi-chain refresh schedule, a copied Celo rail, the act offered on a non-open
pool, and a non-settled source reached by editing the `from` parameter.

### Validation receipt, review round

- **Tested implementation commit SHA**: `28c3918cd`, the top of the stack.
  `git status --porcelain=v1 --untracked-files=all` is empty at that SHA.
- **Command**: the three package suites directly, plus `typecheck --scope full`
  for each, `node packages/qa/build.mjs`, `check-qa-id-ledger.mjs`,
  `scripts/docs/generate.mjs --check`, and `bun run check --only agent-tools-test`.
- **Result**: shared 5,536 passed, client 1,358 passed, admin 874 passed; three
  typechecks clean; 307 active cases and 370 ids; docs projections current; the
  catalog contract test passes among agent-tools-test's 257.
- **Why not the full gate**: it refused to start — "Validation needs focused
  proof; no checks were started" — because its own estimate exceeds the 180s
  budget for a `sensitive` plan. The package suites above are the same proof the
  gate would have run, minus its orchestration.

#### Act ledger

Every reachable act against its cases. Nothing in § 7 has a case.

| Act | Cases |
|-----|-------|
| Set up commitments; settings; pause and resume; close; archive and reopen; console reads | ADM-056 · ADM-063 · ADM-060 · ADM-061 · ADM-062 · ADM-014 |
| Start and open a season or campaign | ADM-057 · ADM-058 · ADM-038 |
| Cancel a cycle | ADM-059 · ADM-137 · ADM-138 · PUB-058 |
| Seed from the admin | ADM-140 · ADM-139 · ADM-125 · ADM-126 · ADM-135 |
| Queued creations on the pool tab | ADM-127 · ADM-128 |
| Seed several in one sitting | ADM-129 · ADM-130 · ADM-142 · ADM-143 · ADM-131 · ADM-132 · ADM-133 · ADM-134 |
| Compose in the app; drafts; compose again | PWA-081 · PWA-108 · PWA-109 · PWA-110 · PWA-111 · PWA-115 · PWA-116 · PWA-117 |
| Take up; ask to take up; claim for a garden; join a team | PWA-084 · PWA-049 · PWA-085 · PWA-047 · PWA-092 |
| Accept or decline a claim | PWA-086 · ADM-040 · PWA-103 · ADM-065 |
| Withdraw; steward cancel; expire | PWA-087 · ADM-081 · ADM-064 |
| Proof and linked work | PWA-034 · PWA-079 · PWA-091 · PWA-048 · PWA-050 · PWA-119 |
| Approve and count linked work; attach an assessment (known gate) | ADM-041 · ADM-012 · ADM-082 · ADM-080 |
| Send for confirmation; mark ready | PWA-088 · ADM-075 · ADM-079 |
| Confirm, including a threshold of two | PWA-089 · ADM-013 · ADM-042 · PWA-118 |
| Fallback confirmation; who may never confirm | ADM-110 · ADM-111 · ADM-112 · ADM-136 |
| Dispute and resolve | PWA-090 · ADM-077 · ADM-113 · ADM-114 · ADM-115 · ADM-116 · ADM-117 · ADM-141 |
| Queue behaviour in the app | PWA-112 · PWA-113 · PWA-114 · PWA-120 · PWA-121 |
| Payout plan; prepare; dispatch, retry, requeue; rejected prompt; read again; cancel | ADM-118 · ADM-119 · ADM-084 · ADM-109 · ADM-120 · ADM-121 · ADM-122 · ADM-123 · ADM-124 · ADM-086 |
| Relay settlement; gardener delivery; treasury top-up | ADM-043 · ADM-044 · ADM-087 · ADM-045 |
| Reading in the app | PWA-100 · PWA-101 · PWA-102 · PWA-105 |
| Reading on the public page | PUB-056 · PUB-057 · PUB-045 · PUB-058 · PUB-059 · PUB-028 |

### Validation receipt, catalog

- **Tested implementation commit SHA**: `1c98db0aecbb265e92cdf1ea81760f3b421fe1cd`, the branch head
  after the review round. `git status --porcelain=v1 --untracked-files=all` is empty at that SHA.
- **Run finished (UTC)**: `2026-09-21T22:21:21Z`
- **Command**: `bun run check -- --intent push`
- **Result**: every runnable check passed, 8 in all: `format`, `lint`, `client-test` (24 passed),
  `docs-authority`, `staged-modules`, `source-structure`, `qa-id-ledger`, and `agent-tools-test`
  (the catalog contract test among its 257). `node packages/qa/build.mjs` projects **307 active
  cases** with all three locales, and `check-qa-id-ledger.mjs` against the Build 3 branch reports
  **370 ids**, none removed, reintroduced, or reactivated.
- **Why only 8 checks**: the selector compares against the live PR base, so a stacked branch is
  judged on its own diff (16 paths, rated `sensitive`). The gate exits 0 with browser proof pending
  for readiness rather than blocking.
- **Earlier, stack-wide run**: at `451cb4b08` against `develop` the plan rated `critical` and all 33
  runnable checks passed, including the full shared (5,509), client (1,350), admin (872) and agent
  (323) suites, `docs-test` and `docs-build`. That run predates the five ids the review round added
  (ADM-139 to ADM-143); the run above is the one that covers them.

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
Set Up Commitments with a short rehearsal cycle (ADM-056). Seed two or three commitments with the
batch tray (ADM-129), take one through offer, take-up, evidence, send for confirmation, and
confirm, and withdraw or expire the rest so the cycle has no live commitments. Cancel the cycle
with a reason and confirm the public page no longer shows it (ADM-137, ADM-059, ADM-138, PUB-058).
Purpose: prove the setup flow and the cancel exit, and shake out environment problems before
anyone else's time is spent. If `seedCycle` ends in an unknown state, stop, refetch the pool, and
do not resend.

**Stage B — Real complete cycle on Aiyeloja Family. Call 1.**
Open a real season with the agreed terms. Walk in this order, steward and member alternating:

1. Pool console: statuses, settings edit, pause with a reason and resume, season and campaign
   (ADM-014, ADM-063, ADM-060, ADM-057, ADM-058).
2. Seeding: single seed with named confirmers, the wallet send and a declined prompt, the batch
   tray, the commitment limit, Seed Another Like This, a queued creation (ADM-140, ADM-125,
   ADM-126, ADM-129 to ADM-134, ADM-142, ADM-143, ADM-135, ADM-127, ADM-128).
3. PWA compose: offer, garden-work request, service request, draft resume and start fresh, Offer
   It Again and Ask Again (PWA-081, PWA-108, PWA-109, PWA-110, PWA-111, PWA-115, PWA-116,
   PWA-117).
4. Taking up: open take-up, ask to take up, accept, decline with a reason, join the team
   (PWA-084, PWA-085, PWA-086, PWA-103, ADM-065, PWA-092).
5. Garden-work path: link work from the wizard and from the dialog, approval row by row to ready,
   count linked work from the inspector (PWA-079, PWA-091, PWA-119, ADM-082).
6. Service path: proof composer with media, send for confirmation (PWA-034, PWA-088, ADM-075).
7. Confirming: confirm from the PWA sheet and from the Hub queue; a threshold of two; nobody on
   the team may confirm; Not yet raises a dispute; resolve with each outcome (PWA-089, ADM-013,
   PWA-118, ADM-136, PWA-090, ADM-077, ADM-113 to ADM-117, ADM-141).
8. Steward recovery: mark ready with an override, garden fallback, fallback not offered while
   reachable, cancel with a reason, Expire Now (ADM-079, ADM-110, ADM-112, ADM-081, ADM-064).
9. Resilience: an act that gave up then Try Again or Discard, a declined wallet prompt, a restart
   with a queued act, the screen updating by itself (PWA-112, PWA-113, PWA-114, PWA-120,
   PWA-121). PWA-112 and PWA-113 need an act that gave up; leave them without an entry if none
   can be produced.
10. Settlement on the garden rail: create and finalize a plan, prepare payouts, dispatch, retry,
    requeue, a rejected prompt, Read Again, cancel a disbursement (ADM-118, ADM-119, ADM-084,
    ADM-109, ADM-120 to ADM-124, ADM-086). ADM-124 needs a failed chain read, for example with
    the RPC endpoint blocked in dev tools. Record Blocked at any `knownGate` actually met.
11. Reads: Pool tab, commitment detail, Commitments drawer, work detail, public garden page
    (PWA-100, PWA-101, PWA-102, PWA-105, PUB-056, PUB-057, PUB-045, PUB-058, PUB-059).

**Stage C — Protocol pool and the relay journey. Call 2.**
Set up pool 1 with its real charter and a rehearsal cycle. Walk the `service-relay` journey with
each person holding one identity throughout: seed the approval-gated protocol Request, the
garden's institutional claim, acceptance, the separate garden commitment, Work and evidence,
approval without joining contributors, confirmation, protocol-to-garden compensation, and the
garden-to-member payout. Both commitments are seeded as Garden work with one action row, which is
what lets Work link to them (ADM-139). Then the Green Goods team fallback case (ADM-111) and the
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
| Expiring a due commitment as someone who is not a steward | Permissionless on chain, but the admin opens a garden's console only to its stewards and owners, and the app has no expire act | Unscheduled. The steward walk is ADM-064. |

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
