# Research intake, drift and growth loops Plan

**Feature Slug**: `research-intake-loops`
**Stage**: `active`
**Status**: `ACTIVE — steps 1 to 3 merged in #1118; step 5 recorded on 2026-10-18 from the first v5 run; step 4's radar issue and pinned note still open; steps 6 and 7 follow`
**Created**: `2026-10-18`
**Last Updated**: `2026-10-18`

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

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror (bug-intake threaded ack; GROW-51 radar; stipend-ledger Linear document)
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands (see Validation below)

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| R1 to R8 intake loop | none (routine spec) | Step 2 | ✅ in the PR |
| R9 agenda v5 shape, R13 candidate sections | none (agenda) | Step 1 | ✅ in the PR |
| R10, R11 pending-edits document and footer | none (routine spec) | Step 2 | ✅ in the PR |
| R12 `research-agenda` skill | none (skill) | Step 3 | ✅ in the PR |
| R14 to R16 growth and product pull | none (routine spec, README) | Step 2 | ✅ in the PR |
| R17 to R21 caps, guardrails, failures, phase order, run budget | none (routine spec) | Step 2 | ✅ in the PR |
| Bot permissions, radar issue, duplicate trigger, pinned note | human | Step 4 | ⚠️ permissions proven by the 2026-10-18 run; radar issue and pinned note not found that day; the duplicate-trigger check is reported done by Afo but not verifiable from this account until a cron Saturday shows one digest |

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

## Out of scope

- Product code of any kind; a midweek intake run; routine-opened PRs; the Research issue template
  change naming the Growth ask; the guild-side spec changes (step 7 names them as follow-ups).
