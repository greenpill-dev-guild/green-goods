# Research intake, drift and growth loops Plan

**Feature Slug**: `research-intake-loops`
**Stage**: `active`
**Status**: `CLOSED — superseded by the research-threads hub in PR #1504; the v5 intake loop retires with research-synthesis v6, the pending-edits document, the research-agenda skill and the Growth radar comment carry on`
**Created**: `2026-10-18`
**Last Updated**: `2026-11-06`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | The routine may react and post one thread reply per share in `#research`. | Feedback to sharers is the missing loop (Afo, 2026-10-18). |
| 2 | Agenda v5 keeps identifiers only; the routine reads live Linear state. | Removes the drift that restates Linear (Afo, 2026-10-18). |
| 3 | Thread per share, with the sharer mentioned once in the thread reply. | Discord does not promise a notification when a thread opens from a message; the mention is the notification. Confirmed as A1 (Afo, 2026-10-18). |
| 4 | Ticked agenda edits are applied by a local skill; the routine stays out of git. | Routines open no PRs by standing convention; the ticked document makes the ritual short. Confirmed as A2. |
| 5 | Opportunities land as one weekly comment on a Growth radar issue; promotion stays human. | Mirrors GROW-51; acceptance of Growth work is human. Confirmed as A3. |
| 6 | Intake runs inside the Saturday run only. | Share volume does not yet justify a second cron. Confirmed as A4. |
| 7 | Three candidate tracks enter the pending document for the 29 Oct boundary. | External impact integrations; supporter and diaspora funding; Capsula and Brazil. Confirmed as A5. |
| 8 | Budgets: 12 classification fetches, 40 reactions, 10 thread replies, 20 thread reads per run; comments stay at 3. | Bounds a 23-link week inside the one-hour run. Confirmed as A6. |
| 9 | v5.1: one intake thread per run replaces the thread per share; a sharer is mentioned only for a ❔ question, once per run; answers go in that thread; thread reads drop to four. | The first v5 run's ten threads and ten mentions were too loud (Afo, 2026-10-18). |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror (bug-intake threaded ack; GROW-51 radar; stipend-ledger Linear document)
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands (see Validation below)

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| R1 to R8 intake loop | none (routine spec) | Step 2 | Shipped in #1118; live failure and reclassification proofs remain open |
| R9 agenda v5 shape, R13 candidate sections | none (agenda) | Step 1 | Shipped; delegated cycle review produced v6 in draft #1485 |
| R10, R11 pending-edits document and footer | none (routine spec) | Step 2 | Shipped; carry-forward ageing supported by both later memos; positive accepted-count footer still unexercised |
| R12 `research-agenda` skill | none (skill) | Step 3 | Shipped; scratch application and retry proof recorded 2026-11-05 |
| R14 to R16 growth and product pull | none (routine spec, README) | Step 2 | Shipped; GROW-92 setup complete, routine comment branch still open |
| R17 to R21 caps, guardrails, failures, phase order, run budget | none (routine spec) | Step 2 | Shipped; success-path receipts do not prove retry or fallback |
| v5.1 intake thread (R1, R4 to R6, R8, R17, R18, R20 amended) | none (routine spec, hub, eval) | Step 8 | Shipped in #1121 and #1122; two narrow clarifications in this working copy |
| Bot permissions, radar issue, duplicate trigger, pinned note | human | Step 4 | Successful thread permissions observed; GROW-92 created and assigned to Afo; pin and retired-trigger UI confirmation remain open |

## Sequencing

1. **Agenda v5** (`docs/routines/research-agenda.md`): strip state from anchors, number the
   implementable-when bars, add the candidate sections, bump the edition with a change-log line.
   Human-reviewed PR to `develop`; the routine reads `develop` on its next run.
2. **Routine spec v5 and README** (`docs/routines/research-synthesis.md`,
   `docs/routines/README.md`): the requirements above, a v4 → v5 migration section, the portfolio
   row, the channel and notification rows, the two Linear exceptions, and the run-budget trims
   of R21. Same review passes as v4.
3. **`research-agenda` skill** (`.claude/skills/research-agenda/SKILL.md` plus the session-start
   skill line in `.claude/settings.json`): `apply`, `review`, `candidates`; proof on a scratch copy
   of the agenda and a throwaway pending document.
4. **One-offs Afo owns**: grant the bot `VIEW_CHANNEL`, `READ_MESSAGE_HISTORY`, `ADD_REACTIONS`,
   `CREATE_PUBLIC_THREADS` and `SEND_MESSAGES_IN_THREADS` on `#research`; create the
   `Research → growth radar` issue on Growth; confirm in the routines UI that the guild-level
   Dev Guild Research Synthesis routine is disabled (its trigger is not visible from this account)
   and avoid manual Friday fires; pin the "share with one line of why" note.
5. **First live run**: the Saturday after steps 1 to 4 land. Read the memo, the run log, the channel, the pending-edits document and the radar comment;
   record AC-1 to AC-9 and AC-11 in [eval.md](eval.md), AC-12 when a write failed, and schedule the
   controlled run for AC-10. Done 2026-10-18 on a manual fire after #1118 merged:
   [reports/2026-10-18-first-v5-run.md](reports/2026-10-18-first-v5-run.md); AC-2, AC-4 and the
   carry-forward half of AC-7 wait for the 2026-10-24 run; the AC-8 dry run and the AC-10 controlled
   run are still to schedule.
6. **Cycle ritual on 29 Oct**: check that the three seeded candidate tracks are in the pending-edits document, run the skill's
   `review`, confirm or reject
   each candidate, set the cycle theme.
7. **Follow-ups outside this repo**: the guild grant scout reads the agenda's settled facts and
   the latest research memo; `docs/teams/research.md` in `greenpill-dev-guild/.github` still says
   the Saturday synthesis is retired and carries merge-conflict markers.

8. **v5.1 quiet intake** (`docs/routines/research-synthesis.md` Phases 1b, 4, 5, 5a, 5b, 6, the
   guardrails and a migration note; hub R1, R2, R4 to R6, R8, R17, R18, R20, R21; AC-1, AC-2, AC-4,
   AC-10): decided after the first live run, in its own PR to `develop` before the 2026-10-24 fire.
   Merged in #1121 and #1122 on 2026-10-18; the first v5.1 run (a manual fire the same evening) is
   recorded in [reports/2026-10-18-first-v5-1-run.md](reports/2026-10-18-first-v5-1-run.md).

9. **Follow-through reviewed 2026-11-05.** The
   [current evidence report](reports/2026-11-05-follow-through.md) reviews the 24 and 31 October
   cron memos and intake receipts, records the two bounded specification fixes and the AC-8
   scratch proof, and supplies the controlled-run procedure and communication drafts.
   The 29 October ritual was completed late through Afo's delegated 4 November review:
   8 proposals accepted unchanged, 19 corrected from newer evidence, 15 rejected and 2 deferred;
   external integrations promoted, Grove retained in track 7, supporter funding retained in
   track 4, and water-cycle measurement and Capsula/Brazil deferred. Four entries remain deferred
   in total. The pending document has no ticked edits awaiting application; agenda v6 awaits
   merge in draft #1485. GROW-92 now supplies the exact-title Growth surface and Afo owns
   follow-through. The pin, actual routine radar comment and controlled live checks remain open.

Steps 1 to 3 can land in one PR or three; the routine only needs `develop` to carry all three
before step 5.

## Validation

- `node scripts/harness/plan-hub.mjs validate` after every hub edit.
- `node scripts/quality/check-guidance-links.mjs` and `bun run check --plan -- --intent push`
  for the docs and skill changes; the push gate selects the markdown and guidance checks.
- The skill: a dry run against a scratch copy of the agenda with two ticked edits; the diff must
  touch only those lines plus the edition and change log.
- Live proof: the first v5 memo's share rows and writes section, the thread replies visible in
  `#research`, the pending document's checkboxes, and the radar comment, each labelled as the
  observation it is (Discord web in the user's own session; Linear web).

## Open questions

1. Who shares in `#research` today, and who reads the Saturday digest? Sizes the thread caps.
2. Should the green-goods-os hub be committed to `develop` so the routine can read it?

## Execution truth and next proof

- Keep PRD-1293's canonical acceptance body intact: the hub uses
  `linear.stateSyncMode: preserve_existing` and `linear.laneSyncMode: parent_only`.
  The current manifest emits a read-only `preserve` action for PRD-1293; no lane issue is needed.
- Record actual results for AC-2, AC-4, AC-9's comment branch, AC-10 and AC-12 after the
  authorized live actions. A successful cron receipt cannot substitute for a controlled failure.
- Check the positive accepted-count footer on a future run with accepted edits still waiting.
  The current zero-ticked document does not exercise that branch.
- Keep the hub active until those observations and the remaining migration one-offs are
  resolved. No closeout or archive is supported by the present evidence.

## Out of scope

- Product code of any kind; a midweek intake run; routine-opened PRs; the Research issue template
  change naming the Growth ask; the guild-side spec changes (step 7 names them as follow-ups).

## Closeout (2026-11-06)

Closed as `superseded`. The research-threads hub (`.plans/active/research-threads/`) supersedes
this design in PR #1504, open at the time of this record; the archive commit follows the merge.
Every lane here was `n/a` (routine specs, guidance and a skill), so no lane was ever certified.
What v5 and v5.1 built and what became of it: the share-intake loop (reactions, intake threads,
receipts, the question back to a sharer) is retired by research-synthesis v6; the pending-edits
document, the `research-agenda` skill and the Growth radar comment stay in service; agenda v6
landed through the delegated 4 November review, which v6 makes the standing ritual.

Still open:
- AC-2, AC-4, AC-5's thread line and AC-10 (intake failure, reclassification and fallback checks) → dropped because v6 removes reactions, intake threads and receipts.
- AC-7's positive accepted-count footer → research-threads eval AC-9 (the post's shape and footer, checked on the first v6 run).
- AC-9's radar comment branch and AC-12's failed-write retry → research-threads eval AC-13 (writes checked and retried on the first live runs; the radar issue now exists).
- The pinned "share with one line of why" note → dropped because the sharer loop is gone; the pin for v6 is the *Research threads* document (research-threads plan step 6).
- Confirming the guild-level v3 routine disabled → carried in `docs/routines/research-synthesis.md` § Migration from v3.
- Open question 1, who reads `#research` → research-threads spec default D3.
- Open question 2, committing the green-goods-os hub → dropped from this hub; it is its owners' call and no longer affects the routine, which reads hubs by name from the checkout.
- Guild-side follow-ups (the grant scout reading the agenda's settled facts; `docs/teams/research.md` merge markers in `greenpill-dev-guild/.github`) → dropped from this hub; they belong to that repository.
