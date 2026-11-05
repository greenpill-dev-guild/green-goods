# Research loop follow-through · 2026-11-05

PRD-1293 remains active. The two narrow v5.1 specification findings are addressed in this working
copy, the 24 and 31 October cron evidence is reviewed, and the agenda skill's scratch-copy
acceptance check passes. Live retry, reclassification, idempotence and permission-fallback
acceptance still need controlled observations.

## Evidence read

All four Drive sources below were read through the Google Docs connector on 2026-11-05. These
are operational receipts, not a new rendered Discord check. No authenticated browser proof was
collected in this segment; rendered-proof label: `none`.

| Source | Supported observation |
|---|---|
| [24 October memo](https://docs.google.com/document/d/1VwC3xJvoea1lLlCkJPMzns3iUJmeT209yINk1zoyjy0/edit), sections 1, 3, 7 and 11 | First cron fire on v5.1; 4 classification fetches, 4 ❔ shares, no queue, no human answer; carry-forward proposals aged once; digest includes the thread pointer; Growth radar absent at that time. |
| [24 October receipt](https://docs.google.com/document/d/1t6CDG4XlidUclBI1ukxnveWpVHwciYn7a5BtxLaEsjM/edit) | Digest HTTP 200, thread HTTP 201, one four-line ledger and one question-only sharer mention; 4 reactions HTTP 204; no failed ledger, reaction retry, recovered/Refiled line or fallback. |
| [31 October memo](https://docs.google.com/document/d/18ZFqzIOVzlvio64-3gTi5EV5HPI4SrmSoqVoVMzCv7w/edit), sections 1, 3, 7 and 11 | Second cron fire on v5.1; 2 classification fetches, one ❔ and one 🌱 share, no queue or human answer; proposals aged once again; digest includes the thread pointer; Growth radar still absent then. |
| [31 October receipt](https://docs.google.com/document/d/1R5k2G-YI7TCgzN3JgvjAFHBR__UyLP4czl9ixwAJ4mk/edit) | Digest HTTP 200, thread HTTP 201, one two-line ledger and one question-only sharer mention; 2 reactions HTTP 204; no failed write, pending reaction, recovered/Refiled line or fallback. |

The 24 October digest/thread id is `1563348324894121996`, with ledger message
`1563348329847328820`; 31 October is `1565886467639742677`, with ledger message
`1565886473268629559`. Both receipts show prior thread cursors unchanged. An unchanged cursor
supports the absence of new human replies; it does not exercise read-back reclassification.
Neither receipt is a same-date rerun after a completed v5.1 run.

The 24 October memo records 28 proposed edits after 9 additions; 31 October records 44 after 16
additions, with the carried lines aged once per new date. This supports AC-7's ageing branch.
Neither had ticked edits, so a positive accepted-count footer remains unexercised. The 31 October
memo says 1,489 characters in its mode line while its receipt says 1,487; both are under the
limit, and this review does not reconstruct the exact transmitted text from a new Discord read.
Memo start-to-written intervals are about 18 and 24 minutes. No new trigger run-log end, turn
count or rate-limit evidence was available in this segment, so these intervals do not establish
fresh full AC-11 proof.

The [pending-edits document](https://linear.app/green-goods/document/research-agenda-pending-edits-9c5315fc36f4)
was also read live: the Research team and marker are intact; zero ticked lines and four deferred
entries remain. The delegated review recorded 8 of 44 proposals accepted unchanged, 19 corrected
from newer evidence, 15 rejected and 2 deferred. The additional water-cycle question and
Capsula/Brazil candidate account for the other two defers. External integrations were promoted;
Grove remains in track 7 with a bounded public WebMCP question, and supporter funding remains in
track 4. Afo selected external integrations as the next focus and owns Growth follow-through.
Agenda v6 is committed in [draft PR #1485](https://github.com/greenpill-dev-guild/green-goods/pull/1485),
head `835594766c493afd357280a299cbd0effa39f279`; the routine reads `develop`, so merge is still the
boundary for consuming it. This segment did not edit the tracked agenda.

[GROW-92](https://linear.app/green-goods/issue/GROW-92/research-growth-radar) was read live after
the coordinating session created it: exact title `Research → growth radar`, In Progress,
assigned to Afo. The migration setup is complete. No routine radar comment was observed.

## Bounded specification changes

1. Phase 4 checks same-date memo candidates by folder and marker, retains existing memos, and
   gives a rerun's pending/final pair a distinct `(rerun HHMMSSZ)` suffix from its UTC start.
   This removes the conflicting request to edit a memo body through the routine's create-copy
   connector path. The broader `research synthesis` title query still finds the rerun.
2. Phase 5b merges recovered lines into an already-present sharer's message. Recovered lines
   for otherwise absent sharers use the closing message. The ten recovered/Refiled-line
   allowance, ten-message ceiling, per-message length and mention rules stay explicit.

The accepted hub spec mirrors those two clarifications. Neither change is claimed as a live
rerun proof. The original [first v5.1 report](2026-10-18-first-v5-1-run.md) remains unchanged.

## AC-8 scratch-copy proof

This was a manual execution of the `research-agenda` skill's apply procedure on a copy of the
committed v6 agenda and a local pending-document fixture. It added no permanent script or test.
Artifacts are transient under `/private/tmp/prd1293-ac8-2026-11-05/`: `agenda.before.md`,
`agenda.md`, `proposals.json`, `pending.before.md`, `pending.md`, `dry-run.diff`, `pending.diff`
and `result.json`.

| Fixture | Exact source anchor | Applied result |
|---|---|---|
| Ticked track 7 edit | Entire unique Watch keywords line at agenda v6 line 313, ending `Grove, knowledge workspace, WebMCP.` | Added `browser capability` to that field only. |
| Ticked track 8 edit | Entire unique Watch keywords line at agenda v6 line 346, ending `readback, correction, consent.` | Added `claim lifecycle` to that field only. |
| Unticked track 6 edit | Entire unique Watch keywords line at agenda v6 line 277, ending `AgroforestDAO, biogas.` | Proposed `revenue sharing` remained unapplied and the document line stayed unchanged. |

Each ticked old anchor matched exactly once. The dry-run preview left the scratch agenda
unchanged. Applying it changed exactly the two fields, edition v6 to v7 and one new changelog
entry. The first local document write was deliberately withheld to rehearse the retry boundary.
On retry both replacement texts were already present: the agenda stayed byte-identical, no
second edition or changelog entry appeared, and exactly the two ticked local document lines
moved to Applied with edition v7. The tracked agenda matched the original scratch baseline.

- Source SHA-256: `140778ea7902472c1a65546a1a8cb56799f21f935666e06a06e9c8ed34174e6e`.
- Result SHA-256 before and after retry: `28ecbac224220303a7cd04bb1d1c759dcf8c90bdecdd226082de6ec13bd22106`.
- Required scratch-copy boundary: pass. Live connector failure and recovery: unexercised.

The current Linear Applied section separately records the reviewed v6 changes. That readback
supports the real review's writeback outcome; it does not turn the local fixture's withheld
patch into a live connector failure.

## Remaining live acceptance and prepared actions

These actions are prepared for the coordinating session and Afo. None was executed here. A
routine fire runs the complete operating spec and may make its normal gated Linear and Drive
writes; it is not an isolated intake-only command.

1. **Pin the intake note.** After approval, post the exact note below in `#research` and pin
   that message. Record its permalink and pin readback. This completes the migration note,
   not any failed-write acceptance check.
2. **AC-4 human-answer reclassification.** Afo can confirm and post the draft below in the
   31 October intake thread, where ledger item 1 is IXO. On the next authorized run, inspect
   the cursor advance, the new 🧭 or 🌱 reaction on the original share with ❔ retained, and
   a Refiled line in the new run's thread. Record the actual classification; do not assume it.
3. **AC-2 and AC-10 failure, then AC-12 recovery.** Select a run with a real unhandled share
   and an expected ledger message, preferably including a ❔ line. Before that run, Afo
   records the bot's current `SEND_MESSAGES_IN_THREADS` permission on `#research` and approves
   temporarily denying only that permission; leave thread creation and digest posting
   available. The run must post its digest, encounter the actual ledger 403, post exactly one
   channel fallback referencing that digest with counts and any ❔ lines, then stop intake
   retries for the run. Capture the response and receipt's failed whole ledger payload,
   source-share map and missing permission. Restore the original permission after the run
   exits. Run the next authorized invocation and verify one successful whole-message retry,
   deduped against the live thread and later receipts; then verify the next footer names the
   missing permission. A failed setup, missing ledger or successful send is not a failure proof.
4. **AC-2 completed-run same-date idempotence.** After a completed successful v5.1 run, with
   no new input or pending work, record the digest/thread/ledger ids and own reactions, then
   authorize one more same-date invocation. Verify no second digest, thread, reaction or
   sharer ledger message. Inspect the distinct rerun memo suffix. This can follow the recovery
   run if it completed that date; a rerun after an incomplete run alone is insufficient.
5. **AC-9 comment branch.** On the next run with a current, source-backed opportunity, read
   the actual comment on GROW-92 and its memo link. The routine must create no Growth issue.
   The seven historical opportunities in the 31 October memo require current evidence before
   reuse. Afo owns any separately accepted Growth follow-through.
6. **AC-7 positive accepted count and trigger retirement.** Inspect a future digest when
   at least one accepted edit is waiting. Check the retired guild trigger in the routines UI;
   the two received cron digests do not prove another account's trigger is disabled.

Proposed pinned note, with no mentions:

> Share a link with one line on which research question it helps answer, or what it made you
> think of. The Saturday synthesis adds a reaction and a numbered line in the intake thread
> under its digest. If your line has ❔, answer in that thread with its number, for example:
> “1: This helps compare how a partner records a correction.”

Proposed human reply in the 31 October intake thread, subject to Afo confirming this is his
intended meaning:

> 1: This raises a track 8 question for me: does IXO document correction, withdrawal and
> readback of ecological claims separately from the token story?

No test share or bot message is pre-authorized by this report. The permission change and any
manual routine fire require the coordinating session to resolve their separate authorization.
No credential access or permission mutation is needed for the repository checks.

## Hub and validation boundary

The hub uses `preserve_existing` and `parent_only`. The generated Linear manifest contains
only `action: preserve` for PRD-1293, and the live canonical issue body was verified without
mutation. No generic generated title or description was applied, no lane issue was created,
and no sync confirmation or closeout was recorded. All n/a lanes remain n/a.

Run the scoped QA selector and its selected checks, plus guidance links, immutable-report and
plan-hub validation after this report is added. Their observed outcomes belong in the final
chat handoff and non-immutable `status.json` history. This report makes no advance passing
claim about those commands. It records only the completed scratch proof above.

Task reference: PRD-1293. Type: guidance and acceptance review. Outcome at report creation:
partial; controlled live proofs remain open. Agent: Codex; model identifier unavailable.
Observed investigation coverage began at 2026-11-05T04:48:48Z; repository implementation and
scratch verification followed. Final phase boundaries are recorded in the chat handoff.
Human corrections observed in this segment: zero; human attention: unknown.
