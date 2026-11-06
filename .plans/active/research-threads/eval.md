# Research threads and weekly plan Evaluation Plan

**Status**: `IN EVIDENCE · spec accepted 2026-11-06; evidence is recorded from the first two Saturday v6 runs and the first two Monday runs`

## Release Gates

1. Correctness: every write class (threads document, Customers, Needs, status pointers, drafts,
   pointer line, public post) is checked and recorded separately; a failed write is named in the
   digest footer or the pointer line and never disguised as a quiet week.
2. Usability: the Monday brief reads on a phone in under a minute and every item names its thread
   and a concrete step; a thread's state can be repeated in a call without opening Linear issues.
3. Regression safety: the Saturday public post keeps its v5.1 shape, ceiling, quiet-week line and
   anonymised rule; both routines fail closed on the agenda, Linear and the threads document;
   caps stay ceilings; no routine sends, posts or shares a draft.
4. Evidence quality: research evidence and open assumptions are recorded in `spec.md` before
   implementation; D1 to D5 are visible defaults.
5. Human judgment: the Monday trigger, the Customer creation rule, the privacy tiers and the README
   rows are called out in each PR body and reviewed by Afo.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | R1, R2, R3 | The first v6 run creates `Research threads` on the Research team with the marker line, the six sections in order, at most twelve open threads, each with every labelled field and a `Notes.` block. | human | pending |
| AC-2 | R4 | A `Notes.` block written by hand survives the next Saturday rewrite untouched (the routine reads only its first word); a human edit outside a `Notes.` block does not; a `close` control closes the thread. | human | pending |
| AC-3 | R5 | A thread with no movement for four runs moves to `## Dormant` as one line and reopens on movement; a thread whose Customer reads `Lost` closes. | human | pending |
| AC-4 | R7 | A Customer is created only for an organisation that appears with a next step and has no match by name or external id, as `Prospect`, with the partner and speaker external ids; no existing Customer's status, tier or owner changes; at most three per run. | human | pending |
| AC-5 | R8, R9 | Each open ask has one Customer Need with `source` set to the call note and `issue` set when one exists; a rerun creates no duplicate, nor does a signal another routine already captured from the same call note; a done ask gets the `Done {date} ·` prefix; the thread's `Asks.` bullet links the Need. | human | pending |
| AC-6 | R12 | The Monday brief replaces `## This week` in place, respects every cap, names a thread per item, stays under 2,000 characters, and mentions Matt only on his lines (the mention renders and notifies him). | human | pending |
| AC-7 | R13 | The pointer line carries identifiers, counts and the document URL only, with no mention and no name; a run that patched nothing posts nothing. | human | pending |
| AC-8 | R15 | At most two `DRAFT ·` documents a week in the Research memo folder with the marker first line, linked from the brief, shared with nobody; an unedited draft is listed as stale once, then dropped from the brief. | human | pending |
| AC-9 | R16, R17 | The Saturday post keeps its shape and ceiling; its footer links the threads document; each status update is a state line, the bars-met line and a thread link; no reaction, thread or receipt is written. | human | pending |
| AC-10 | R18 | The first v6 run files or drops the sixteen ❔ shares with one `## Links filed` line each and never asks about them again. | human | pending |
| AC-11 | R23 | Afo opened the threads document in each of the first two weeks (Linear's document activity), and at least one Monday item was acted on by Friday. | human | pending |
| AC-12 | R20 | The delegated review's dry run on a scratch agenda copy accepts only evidence appends and anchor updates by rule, puts every stage, horizon, order, question or implementable-when change to the user, writes the `## Delegated review` section and bumps the edition once. | human | pending |
| AC-13 | R14, R19, R22, R24 | Each run records its mode line and budget; a Monday after a degraded Saturday marks its pointer `degraded`; the Monday trigger runs on `claude-opus-5-5`; a failed write appears in `Run notes` or the memo and is retried once. | human | pending |

## Test Strategy

- Unit and integration: none; no package code changes.
- E2E / Playwright: none.
- Manual checks: AC-1 to AC-13 above, each labelled with where it was observed; AC-2 and AC-3
  need a second and a fifth Saturday run; AC-12 is a local dry run.
- TDD proof: `not_applicable` for every lane, recorded in `status.json`.

## QA Sequence

Both QA lanes are `n/a`. The first live run of each routine is the acceptance pass; its evidence
is recorded here and in the plan's step 7. A privacy read of every Linear write from the first
Saturday run (no email, no attendee list, no personal matter) is part of AC-1 and AC-5.
