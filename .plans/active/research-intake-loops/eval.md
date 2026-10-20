# Research intake, drift and growth loops Evaluation Plan

**Status**: `IN EVIDENCE 2026-10-18 — first v5 run recorded in [reports/2026-10-18-first-v5-run.md](reports/2026-10-18-first-v5-run.md) and the first v5.1 run in [reports/2026-10-18-first-v5-1-run.md](reports/2026-10-18-first-v5-1-run.md); open: AC-2 (a controlled failed ledger message; a same-date rerun after a completed v5.1 run), AC-4, AC-5's thread line, AC-7's carry-forward increment, the AC-8 dry run, the AC-10 controlled run; AC-12 unexercised`

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
| AC-1 | R1, R3, R4 | Every classified share carries one of the four reactions and one numbered line in the run's intake thread; a sharer is mentioned at most once per run and only when they have a ❔ line (v5.1; the 2026-10-18 evidence is the v5 shape). | human | 2026-10-18 run: 13 of 23 shares reacted (4 🧭, 1 🌱, 7 ❔, 1 📥), ten threads with one reply each opening with a single sharer mention; observed in authenticated Brave and memo section 7. Pass for the first run; the ten queued shares are AC-3's. 2026-10-18 evening v5.1 run: reactions on the ten remaining shares, one intake thread under the digest with one 13-line ledger message and a single mention on the ❔ question line (authenticated Brave, receipt). Pass. |
| AC-2 | R1 | A rerun on the same date adds no second reaction, opens no second intake thread and posts no second ledger; a failed ledger message is retried as a whole next run (v5.1). | human | v5.1: the failed-ledger retry needs a controlled failure after the first v5.1 run (a run with `SEND_MESSAGES_IN_THREADS` removed once the thread exists, or an injected non-2xx), and the same-date half needs a controlled same-day rerun. The evening v5.1 run of 2026-10-18 was a same-date rerun on top of the v5 run: no second digest, no second reaction, one thread (partial evidence for the same-date half). The failed-ledger half still needs its controlled failure. |
| AC-3 | R2 | At most twelve classification fetches; over-budget shares carry no reaction and no reply, are listed as queued, and are classified oldest first on the next run. | human | 2026-10-18 run: ten link fetches, two Drive title reads, two oEmbed title lookups and one retried fetch; the spec does not say which count against the twelve (report finding 6), so the cap half was pending until the accounting landed in v5.1. 2026-10-18 evening run: ten of twelve fetches under the defined accounting, and all ten queued shares classified in channel order (memo section 3, receipt, Brave). Pass. |
| AC-4 | R6 | A one-line human answer in the intake thread, naming the share by number, reclassifies it on the next run with the new reaction and a Refiled line in that run's thread (v5.1). | human | Open: no human line in a ❔ thread yet. |
| AC-5 | R7 | The digest's Shares block carries the counts and at most two named shares and ends with the line pointing at the intake thread under the digest (v5.1); a week with shares and no track movement is not posted as quiet. | human | 2026-10-18 digest (message 1561302578677948567): counts sentence plus two named shares with their tracks; posted as an active week. Pass. The digest ran to 2,000 characters (finding 1 in the report). |
| AC-6 | R9 | Agenda v5 contains no state, owner, date or cycle words in any Anchors or Note line; implementable-when bars are numbered; the edition and change log are bumped. | human | `grep` on develop 43ec4ecaf: no state, owner, date or cycle word on any Anchors or Note line; 22 numbered bars across the seven Implementable-when sections; edition v5 with its change-log entry. Pass. |
| AC-7 | R10, R11 | The pending document exists on the Research team with the marker line and sections; unticked lines carry forward with `runs` incremented; the footer links it and counts accepted edits. | human | 2026-10-18: document created on the Research team with the marker line, every section and the three seeded candidates at `runs: 1`; the footer links it. Pass for creation. 2026-10-18 evening run: refreshed by patch with new evidence and no ageing (same-date rule); the `runs` increment and the accepted count wait for 2026-10-24. |
| AC-8 | R12 | The skill's `apply` changes only the ticked lines plus the edition and change log, and moves the lines to Applied. | human | Open: the dry run on a scratch agenda copy has not been run. |
| AC-9 | R15, R16 | The radar comment appears only when an opportunity exists, never creates an issue, and each status update carries the bars-met line as its last content line before the signature. | human | 2026-10-18: the radar issue is absent, so no comment and no created issue, with the absence named in memo section 7 and the footer; the status update's bars-met line is the last content line before the signature, as the spec's template orders. Pass for the absence branch; the comment branch is unexercised. |
| AC-10 | R4, R19 | With `SEND_MESSAGES_IN_THREADS` or `CREATE_PUBLIC_THREADS` missing, the run posts the digest, then one channel message referencing it with the counts and the ❔ lines, and names the missing permission in the memo and the next footer (v5.1). | human | Not exercised; needs the controlled run with `SEND_MESSAGES_IN_THREADS` removed. |
| AC-12 | R19 | A failed write appears in the memo's failed-writes list and is retried once on the next run. | human | Not exercised: neither run's memo or receipt records a failed write. |
| AC-11 | R21 | The run records its start and the time the final memo was written in the memo's mode line, the trigger's run log supplies the end and shows no rate-limit rejection before Phase 5, and the run finishes within 40 minutes (v5.1 wording; v5 asked the memo for the end). | human | 2026-10-18: trigger fired 08:42:03Z (trigger record), start 08:42:55Z (memo mode line), result 08:59:31Z with a reported duration of 1,042 s over 111 turns (run log), inside the budget; eight `rate_limit_event` entries in the log index without visible content, no retry or rejection in the transcript. Budget half passes; the mode line's end time was an estimate then. 2026-10-18 evening v5.1 run: 51 turns, 575 s, six `rate_limit_event` entries without visible effect, mode line with start and time of writing. Pass, both halves. |

## Test Strategy

- Unit and integration: none; no package code changes.
- E2E / Playwright: none.
- Manual checks: AC-1 to AC-12 above, each labelled with where it was observed; AC-10 needs its own controlled run and AC-12 is recorded when a write fails.
- TDD proof: `not_applicable` for every lane, recorded in `status.json` when the hub promotes.

## QA Sequence

Both QA lanes are `n/a`. The first live run is the acceptance pass; its evidence is recorded here
and in the plan's step 5. A second run confirms AC-2, AC-4 and AC-7. The first run's record is
[reports/2026-10-18-first-v5-run.md](reports/2026-10-18-first-v5-run.md).
