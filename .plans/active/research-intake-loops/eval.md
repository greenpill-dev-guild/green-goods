# Research intake, drift and growth loops Evaluation Plan

**Status**: `DEFINED 2026-10-18 — evidence arrives with the first v5 run after the PR merges`

## Release Gates

1. Correctness: every v5 write class is checked and recorded separately; a failed intake step is
   named in the digest footer and never disguised as a quiet week.
2. Usability: a sharer can tell from one reaction and one thread reply where their share landed
   and what to do next; the pending document is readable and tickable on a phone.
3. Regression safety: the v4 digest shape, the quiet-week line, the fail-closed preflights, the
   caps on status updates, comments and issues, and the privacy rules are unchanged.
4. Evidence quality: research evidence and open assumptions are recorded in `spec.md` before
   implementation.
5. Human judgment: the Growth write exception, the skill registration in `.claude/settings.json`,
   and the agenda restructure are each called out in the PR body and reviewed by Afo.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | R1, R3, R4 | Every human share in the window carries one of the four reactions and, within the cap, a thread reply mentioning the sharer once. | human | `#research` observation after the first run; memo section 3 rows |
| AC-2 | R1 | A rerun in the same week adds no second reaction or reply; a share with one signal missing gets only that signal retried. | human | memo writes section across two runs |
| AC-3 | R2 | At most twelve classification fetches; over-budget shares carry no reaction and no reply, are listed as queued, and are classified oldest first on the next run. | human | memo section 3 across two runs |
| AC-4 | R6 | A one-line human reply in a ❔ thread reclassifies the share on the next run with a follow-up reply and the new reaction. | human | two consecutive memos; the thread |
| AC-5 | R7 | The digest's Shares block carries the counts and at most two named shares; a week with shares and no track movement is not posted as quiet. | human | the posted text in memo section 11 |
| AC-6 | R9 | Agenda v5 contains no state, owner, date or cycle words in any Anchors or Note line; implementable-when bars are numbered; the edition and change log are bumped. | human | `git diff` of the agenda PR; `grep` for the removed words |
| AC-7 | R10, R11 | The pending document exists on the Research team with the marker line and sections; unticked lines carry forward with `runs` incremented; the footer links it and counts accepted edits. | human | the document after two runs; two digests |
| AC-8 | R12 | The skill's `apply` changes only the ticked lines plus the edition and change log, and moves the lines to Applied. | human | dry run diff on a scratch agenda copy |
| AC-9 | R15, R16 | The radar comment appears only when an opportunity exists, never creates an issue, and each status update ends with the bars-met line. | human | Linear radar issue; one status update |
| AC-10 | R4, R19 | With `SEND_MESSAGES_IN_THREADS` or `CREATE_PUBLIC_THREADS` missing, the run falls back to channel replies, names the missing permission in the footer, and still posts the digest. | human | one controlled run with `SEND_MESSAGES_IN_THREADS` removed from the bot, after the first run; until then recorded as not exercised |
| AC-12 | R19 | A failed write appears in the memo's failed-writes list and is retried once on the next run. | human | observed when a write fails; not exercised deliberately |
| AC-11 | R21 | The first v5 run records its start and end in the memo's mode line, finishes within 40 minutes, and its run log shows no rate-limit rejection before Phase 5. | human | trigger run log; memo mode line |

## Test Strategy

- Unit and integration: none; no package code changes.
- E2E / Playwright: none.
- Manual checks: AC-1 to AC-11 above, each labelled with where it was observed; AC-10 needs its own controlled run.
- TDD proof: `not_applicable` for every lane, recorded in `status.json` when the hub promotes.

## QA Sequence

Both QA lanes are `n/a`. The first live run is the acceptance pass; its evidence is recorded here
and in the plan's step 5. A second run confirms AC-2, AC-4 and AC-7.
