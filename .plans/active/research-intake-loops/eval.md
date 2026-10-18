# Research intake, drift and growth loops Evaluation Plan

**Status**: `IN EVIDENCE 2026-10-18 — first v5 run recorded in [reports/2026-10-18-first-v5-run.md](reports/2026-10-18-first-v5-run.md); AC-2, AC-4 and the carry-forward half of AC-7 wait for the 2026-10-24 run; AC-8 and AC-10 pending`

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
| AC-1 | R1, R3, R4 | Every human share in the window carries one of the four reactions and, within the cap, a thread reply mentioning the sharer once. | human | 2026-10-18 run: 13 of 23 shares reacted (4 🧭, 1 🌱, 7 ❔, 1 📥), ten threads with one reply each opening with a single sharer mention; observed in authenticated Brave and memo section 7. Pass for the first run; the ten queued shares are AC-3's. |
| AC-2 | R1 | A rerun in the same week adds no second reaction or reply; a share with one signal missing gets only that signal retried. | human | Two halves: the partial-share retry waits for the 2026-10-24 run (three partial shares); the same-week idempotence needs a controlled same-day rerun, scheduled after the quieter intake shape lands. |
| AC-3 | R2 | At most twelve classification fetches; over-budget shares carry no reaction and no reply, are listed as queued, and are classified oldest first on the next run. | human | 2026-10-18 run: ten link fetches, two Drive title reads, two oEmbed title lookups and one retried fetch; the spec does not say which count against the twelve (report finding 6), so the cap half is pending. Ten queued shares with no reaction or reply (checked in Brave), listed in memo section 3 and in the footer: the queue half passes. Oldest-first classification is the second run's half. |
| AC-4 | R6 | A one-line human reply in a ❔ thread reclassifies the share on the next run with a follow-up reply and the new reaction. | human | Open: no human line in a ❔ thread yet. |
| AC-5 | R7 | The digest's Shares block carries the counts and at most two named shares; a week with shares and no track movement is not posted as quiet. | human | 2026-10-18 digest (message 1561302578677948567): counts sentence plus two named shares with their tracks; posted as an active week. Pass. The digest ran to 2,000 characters (finding 1 in the report). |
| AC-6 | R9 | Agenda v5 contains no state, owner, date or cycle words in any Anchors or Note line; implementable-when bars are numbered; the edition and change log are bumped. | human | `grep` on develop 43ec4ecaf: no state, owner, date or cycle word on any Anchors or Note line; 22 numbered bars across the seven Implementable-when sections; edition v5 with its change-log entry. Pass. |
| AC-7 | R10, R11 | The pending document exists on the Research team with the marker line and sections; unticked lines carry forward with `runs` incremented; the footer links it and counts accepted edits. | human | 2026-10-18: document created on the Research team with the marker line, every section and the three seeded candidates at `runs: 1`; the footer links it. Pass for creation; `runs` carry-forward and the accepted count wait for the second run. |
| AC-8 | R12 | The skill's `apply` changes only the ticked lines plus the edition and change log, and moves the lines to Applied. | human | Open: the dry run on a scratch agenda copy has not been run. |
| AC-9 | R15, R16 | The radar comment appears only when an opportunity exists, never creates an issue, and each status update carries the bars-met line as its last content line before the signature. | human | 2026-10-18: the radar issue is absent, so no comment and no created issue, with the absence named in memo section 7 and the footer; the status update's bars-met line is the last content line before the signature, as the spec's template orders. Pass for the absence branch; the comment branch is unexercised. |
| AC-10 | R4, R19 | With `SEND_MESSAGES_IN_THREADS` or `CREATE_PUBLIC_THREADS` missing, the run falls back to channel replies, names the missing permission in the footer, and still posts the digest. | human | Not exercised; needs the controlled run with `SEND_MESSAGES_IN_THREADS` removed. |
| AC-12 | R19 | A failed write appears in the memo's failed-writes list and is retried once on the next run. | human | Not exercised: memo section 7 records no failed write and none inherited. |
| AC-11 | R21 | The first v5 run records its start and end in the memo's mode line, finishes within 40 minutes, and its run log shows no rate-limit rejection before Phase 5. | human | 2026-10-18: trigger fired 08:42:03Z (trigger record), start 08:42:55Z (memo mode line), result 08:59:31Z with a reported duration of 1,042 s over 111 turns (run log), inside the budget; eight `rate_limit_event` entries in the log index without visible content, no retry or rejection in the transcript. Budget half passes; the mode line's end time is an estimate written before the post, so the memo half is pending the spec order fix (report finding 2). |

## Test Strategy

- Unit and integration: none; no package code changes.
- E2E / Playwright: none.
- Manual checks: AC-1 to AC-12 above, each labelled with where it was observed; AC-10 needs its own controlled run and AC-12 is recorded when a write fails.
- TDD proof: `not_applicable` for every lane, recorded in `status.json` when the hub promotes.

## QA Sequence

Both QA lanes are `n/a`. The first live run is the acceptance pass; its evidence is recorded here
and in the plan's step 5. A second run confirms AC-2, AC-4 and AC-7. The first run's record is
[reports/2026-10-18-first-v5-run.md](reports/2026-10-18-first-v5-run.md).
