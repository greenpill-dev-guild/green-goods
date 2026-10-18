# Research intake, drift and growth loops

**Slug**: `research-intake-loops`
**Stage**: `active`
**Status**: `ACTIVE — brief and spec accepted 2026-10-18; steps 1 to 3 in a PR to develop, step 4 is Afo's`
**Priority**: `p2`
**Created**: `2026-10-18`
**Owner**: Afo (Research panel: afo, coi, matt)

## Problem

The weekly `research-synthesis` routine ([spec](../../../docs/routines/research-synthesis.md), v4)
does the synthesis well and then loses most of its value at four seams. Measured on 2026-10-17
from the routine's own Drive memos, the live Linear board and this repository.

| Seam | Measured | Consequence |
|---|---|---|
| `#research` shares | About a hundred messages since June, bot digests included. Roughly three bare links a week in September. Silent 22 Sep to 11 Oct, then 23 bare links from one member in four days. | The routine classifies by title, fetches almost nothing under its own gate and never replies. About twenty October links sit in an "unassigned" list inside a Drive memo. Sharers get no feedback, so the channel goes quiet. |
| Agenda drift | 16 to 19 ready-to-paste agenda edits per weekly memo (8, 9, 16, 19 and 18 across September and early October); near-zero uptake until the 16 Oct sweep. | The compass lags the board by weeks. Roughly half of the edits only restate Linear state (owners, dates, project names) that the agenda duplicates. |
| Off-agenda research | Nineteen Research issues filed 7 to 16 Oct from sessions; about a dozen match no track: external integrations (RESR-96, 98, 99, 100, 101, 102), supporter and diaspora funding (RESR-82, 94), Capsula and Brazil (RESR-83 to 86), PWA and Play Store (RESR-93, 95). The green-goods-os research hub is untracked. | New tracks appear only when a human rewrites the agenda. The routine can only map onto the seven existing tracks. |
| Research to growth | The grant scout and growth-pulse specs reference research zero times. Partner evaluations end with "no contact occurred". RESR-98 recommends a GainForest monitoring pilot that no Growth surface receives. | Findings never become partner, pitch or grant opportunities. The Funding & Partnerships initiative is at risk for lack of a committed partner. |

Three smaller facts from the trigger's run log, read 2026-10-18. The 9 Oct double run was a
manual fire of this same trigger at 22:35 UTC, not a second trigger, and the dedupe held; the
retired guild-level trigger is not visible from this account. The 17 Oct run posted its digest and
made all six Linear writes, then ended on the five-hour usage limit at its final step after 154
turns and 29 minutes, with 14 rate-limit events during the run, so v5 has to fit a turn budget,
not only write caps. The Drive connector cannot edit the memo in place, so every run juggles
pending and final copies.

## Desired Outcome

- A share in `#research` gets a reaction and one thread reply within a week saying where it
  landed and which open question it could answer. A one-line human reply in that thread
  reclassifies it on the next run. Shares become research prompts instead of a parking lot.
- The agenda stops restating Linear state: anchors are identifiers only and the routine renders
  live state. The remaining drift arrives as a ticked checklist in one Linear document and is
  applied in a fifteen-minute cycle ritual rather than a 74 KB read.
- Research outside the seven tracks surfaces as candidate tracks and candidate questions that the
  panel confirms or rejects at a cycle boundary.
- Each track states an opportunity when this week's evidence supports one (partner, pitch, grant
  fit, product) and it lands on a Growth radar issue. Implementable-when progress is visible, so
  graduation to Product is a decision rather than a surprise.
- What must not change: house style v2 (one message, lede first, a quiet week is one line); caps
  are ceilings; fail-closed preflights; no Discord post outside `#research`; no routine-created
  accepted work; the privacy rules on call notes; the agenda stays human-owned in substance.

## Scope Notes

- In scope: `docs/routines/research-synthesis.md` v5 (Phase 1b intake with a
  fetch-for-classification budget, a reactions-and-threads step, thread read-back, the
  pending-edits document write, the Growth radar comment, opportunity and bars-met lines, updated
  caps and guardrails); `docs/routines/research-agenda.md` v5 (identifier-only anchors, candidate
  track and candidate question sections, edition discipline); `docs/routines/README.md` rows and
  the single Growth-write exception; one local skill that applies ticked edits and bumps the
  edition; the trigger re-emit with the Discord permissions the bot needs.
- Out of scope here: the guild grant scout reading research as proposal evidence (a follow-up in
  `greenpill-dev-guild/.github`); the Research issue template naming the Growth ask on partner
  evaluations; any product code; a midweek intake run until share volume justifies one; committing
  the green-goods-os hub.
- One-offs Afo owns: grant the bot Add Reactions, Create Public Threads, Send Messages in Threads
  and Read Message History on `#research`; create the Growth radar issue; confirm in the routines
  UI that the guild-level Dev Guild Research Synthesis routine is disabled and avoid manual Friday
  fires; pin the "share with one line of why" note.

## Decisions so far

| # | Decision | Rationale | Date |
|---|---|---|---|
| 1 | The routine may write back to `#research`: one reaction and one thread reply per share. | Feedback to sharers is the missing loop. Threads keep the channel readable and give the "why" a home the next run can read. | 2026-10-18 |
| 2 | Agenda v5 keeps identifiers only; the routine reads live Linear state. | Removes the half of weekly drift that merely restates Linear. | 2026-10-18 |

## Working assumptions

Reverse any of these in review; each is a one-line change to the spec.

- A1. Thread per share rather than inline replies, and the sharer is mentioned once in their
  thread reply.
- A2. Ticked edits are applied by a local skill Afo runs; the routine stays out of git. The
  digest footer counts accepted edits waiting to be applied.
- A3. Opportunities go to one standing Growth radar issue as a weekly comment, modelled on the
  grant deadline radar (GROW-51). Promotion to a Growth issue stays human.
- A4. Intake runs inside the Saturday run; no midweek run yet.
- A5. Three candidate tracks enter the pending document for the 29 Oct cycle boundary: external
  impact integrations; supporter and diaspora funding; Capsula and Brazil.
- A6. Budgets per run: twelve classification fetches and ten thread replies, oldest first;
  reactions capped at forty per run (set in review round 4; the brief first said unbounded) inside a
  fourteen-day lookback for unhandled shares; comments stay at three.

## Open questions

1. Who shares in `#research` today, and who reads the Saturday digest? This sizes the thread caps
   and decides whether a forum channel would serve better than message threads.
2. Should the green-goods-os hub be committed to `develop` so the routine can read it, or stay
   local by intent?
3. Mention the sharer in their thread reply, or rely on the reaction alone? A1 assumes a mention.
4. Confirm A2 through A6, or name the one to change.

## Success Signal

Four consecutive runs after v5 lands in which every human share carries a reaction and a thread
reply, the pending-edits document is shorter than the week before, and at least one opportunity
reaches the Growth radar with a named ask.
