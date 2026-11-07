# Research threads and weekly plan

**Slug**: `research-threads`
**Stage**: `active`
**Status**: `ACTIVE · brief and spec accepted by Afo on 2026-11-06; step 2 (Saturday spec v6, the routing clause and the research-intake-loops closeout) in PR #1504`
**Priority**: `p2`
**Created**: `2026-11-06`
**Owner**: Afo · readers of the private surface: afo, matt (decision 10)
**Supersedes**: the `research-intake-loops` hub (the v5 intake, drift and growth loops), closed as `superseded` with this hub's step 2 and listed in `.plans/ARCHIVE.md` once archived
**Reads**: [`docs/routines/research-synthesis.md`](../../../docs/routines/research-synthesis.md) (v5.1 → v6 in step 2) and [`docs/routines/research-agenda.md`](../../../docs/routines/research-agenda.md) (v6)

## Problem

The weekly `research-synthesis` routine does its synthesis well and then loses it at the
surface. Afo's words on 2026-11-06: it is "not helping research progress, finding insights and
weave threads together"; research is captured in Linear, in Drive call notes and in dedicated
documents, and nobody turns it into next human steps: a brief to write, a person or group to
reach out to, the issues and artifacts to focus on this week. Measured the same day from the
routine's Drive memos, the live Linear board, the Drive call notes and this repository.

| Seam | Measured | Consequence |
|---|---|---|
| Delivery of the synthesis | The 24 and 31 October memos name real cross-track connections (one issuer completion rule answers an open question on three tracks; one pilot touches four). Both Saturday digests hit the 1,500-character ceiling and cut the "Across tracks" block first. The rest of the state sits in a Drive memo and four Linear project pages. | The highest-value content never reaches a reader. |
| Agenda lag | Forty-four proposed edits accumulated in the pending-edits document with zero human ticks in six weeks. External integrations were the busiest research area in October and stayed a "candidate" the routine could not treat as a track. On 4 November the review was delegated to a session; agenda v6 merged on 5 November (#1485). | The compass lagged reality by seven weeks, and the ritual designed for human judgment was too heavy to perform by hand. |
| Partnership and contact signal | The spec drops partnerships and partner contracts on sight and defers them to the guild weekly synthesis, which has produced no memo since September. Coffee meets are cited as "coffee meet · date" with no organisation, by a privacy rule written for the public channel. Three partner calls in the first week of November each carried three to five next steps for Afo; nothing consolidates them. | "Write to this organisation about that" can never be produced, by design. |
| Research to growth | Seven opportunities with named asks waited in memos because the radar issue did not exist until 5 November (GROW-92). | The growth loop designed in v5 produced nothing for three runs. |
| Intake | One sharer in `#research` (Afo). Sixteen of his own links carry a "needs a why" reaction asking him which question they answer; four were coverage of the hackathon Green Goods had just entered. Of the spec's 409 lines, 21 describe synthesis; the rest is reactions, receipts, dedupe, caps and a memo written twice. | The run budget goes to bookkeeping that serves nobody. |
| Timing and artifacts | The one run closes the week on Friday evening Pacific. Nothing says on Monday what to focus on, draft or send. The routine may comment but never draft, so the Guardian evidence record and the Q4 strategy were written by hand in sessions. | No week plan; the briefs that move research are all manual. |
| Linear home (context only; decision 6 leaves it) | About half of the 57 Research issues touched in two months sit in the release catch-all project or in no project; the current Research cycle has no theme. | Status updates land on product pages; triage has no research-owned view. |

Two facts shape the design. Linear already holds 30 partner and garden Customers with the
`green-goods:speaker:*` aliases the call notes use, so relationship threads have a native,
private home. And the daily journal's cloud outside view already reads up to five meeting notes a
day for "what you were asked to do", so a weekly research surface must add the cross-week "why
and what next", not repeat daily asks.

## Desired Outcome

- Research reads as **threads**: a partner relationship or an open question, each with its latest
  evidence, the people involved and the next human step, in one standing Linear document on the
  Research team. Tracks stay the frame in the agenda; threads are how the week is read.
- **Monday** opens with a brief at the top of that document: the issues to focus on this week, the
  briefs to draft, the people and organisations to write to, with drafts ready to edit.
- Every partner sync and coffee meet is read for research and partnership signal; each ask lands
  as a Customer Need on that organisation's Linear Customer and is carried until done.
- **Saturday** keeps the synthesis, updates the threads, posts the public excerpt in `#research`
  and the growth radar comment on GROW-92.
- Agenda edits arrive through a monthly delegated review whose diff Afo approves.
- What must not change: house style v2 for the public post (one message, lede first, one line on
  a quiet week); fail-closed preflights on the agenda and on Linear; the anonymised privacy rule
  for `#research`; caps as ceilings; no routine-created accepted work; no sending, only drafts; the
  agenda human-owned in substance through the delegated review.

## Scope Notes

- In scope: `docs/routines/research-synthesis.md` v6 (the Saturday run: synthesis onto threads,
  threads document update, public excerpt, status pointers, growth radar, pending-edits refresh,
  Customer Needs); a new `docs/routines/research-week.md` (the Monday run on Opus: the brief,
  drafts, the Discord pointer line); `docs/routines/README.md` rows and the connector, channel and
  notification tables; the `research-agenda` skill's `review` mode rewritten for the delegated
  ritual; the threads document contract; a one-time closure of the sixteen open link questions;
  the closeout of `research-intake-loops` with a pointer here.
- Out of scope: Linear project restructuring (decision 6); reviving the guild weekly synthesis;
  grant scouting, which stays with `guild-grant-scout`; any product code; changes to the daily
  journal routines; creating the Monday trigger from a spec (a one-off, below).
- One-offs Afo owns: approve this brief; create the Monday trigger on `claude-opus-5-5` in the
  routines UI or from a session; say whether the agenda's panel line changes (open question 1).

## Decisions so far

All eleven were taken on 2026-11-06 in three rounds. Afo departed from the recommended option on
decisions 6 and 10.

| # | Decision | Rationale |
|---|---|---|
| 1 | The weekly read is organised by thread (a relationship or an open question) in one standing Linear document on the Research team; the agenda keeps the tracks. | "Weave threads together" is the ask; cross-track connections are what the track-shaped digest cut every week. Customers already map call-note speakers to organisations. |
| 2 | Two runs: a Monday plan on Opus 5.5 and the Saturday close on the existing Fable trigger. | A plan for the coming week is the missing product; two Fable runs would draw on the weekly allowance that killed grant-scout runs in August. |
| 3 | The research routine owns partnership and contact signal from calls; the out-of-scope table shrinks to grants and treasury; the growth radar keeps grant fit. | The deferred owner has not run since September, and partner calls are where "reach out to X" lives. |
| 4 | The routine may draft documents (decision notes, outreach messages) under a small cap, never send. Afo edits and sends. | Briefs are what move research, and they were all manual. |
| 5 | Drop reactions, intake threads and receipts. Links posted in `#research` are filed onto threads, one line each. | One sharer; the loop asked Afo about his own links. |
| 6 | Research issues stay where routing puts them; no new Linear project structure. | The threads document is the reading surface; restructuring is not what was asked. (Afo's choice over a standing Research project.) |
| 7 | Consolidated asks become Customer Needs on the partner's Linear Customer, linked to the research issue they serve. | Per-organisation timeline in Linear; the pattern bug-intake already uses. |
| 8 | Agenda edits come from a monthly delegated review by a session; Afo approves the diff before it merges. | Zero human ticks in six weeks; the delegated review produced v6 in a day. |
| 9 | The Monday brief is the top of the threads document; one line in `#research` carries the focus-issue identifiers and the link. Names stay in Linear. | A document nobody opens is the current failure; no new channel or env var. |
| 10 | The private surface is written for Afo and Matt only; Matt is mentioned on his lines. | Afo's choice over the full panel. |
| 11 | The private surface may name organisations and the people met, in the routine's own words, never quoted; no health, compensation or interpersonal matters, attendee lists or email addresses. The public post keeps the anonymised rule. | Linear is read by the panel and guild seats; "write to this person" needs names, personal matters do not belong in a shared workspace. |

## Working assumptions

Reverse any of these in review; each is a one-line change to the spec.

- A1. Status updates on product project pages shrink to a state line plus a link to the thread,
  one per moved track as today, so the full state lives in one place.
- A2. The routine may create a Linear Customer for a new organisation that appears in a call note
  with a next step, as Prospect and tier Ecosystem, with the external ids `green-goods:partner:<slug>`
  and `green-goods:speaker:<slug>` for the organisation and each speaker the call vouches for, so the
  speaker-resolution path finds it on later runs; it never changes an existing Customer's status,
  tier or owner.
- A3. The threads document is routine-owned section by section; each thread carries a human
  Notes block the routine treats as opaque: it reads only the block's first line for a control,
  never rewrites it, and carries it as it stands. The privacy rule binds what the routine writes;
  the document tells humans the same exclusions apply to what they write there.
- A4. Thread lifecycle: open; dormant after four quiet weeks (listed in one line, not a section);
  closed when its question is answered, its ask is done or its Customer is marked Lost. A thread
  opens for a Customer with an open ask or for an agenda Open item with activity.
- A5. Drafts are Google Docs in the Research memo folder, titled `DRAFT · …`, at most two a week,
  each linked from the brief with the evidence it rests on.
- A6. The pending-edits document stays as the proposal ledger the delegated review reads; the
  Saturday run keeps refreshing it.
- A7. The first Saturday run under v6 closes the sixteen open link questions once, by filing or
  dropping each with one line.
- A8. Saturday writes Customer Needs and threads; Monday reads them, writes the brief and the
  drafts, and posts the pointer. Monday's budget is about a third of Saturday's.
- A9. The Saturday public excerpt keeps today's shape and ceiling; everything cut for length is
  in the threads document, not lost.
- A10. The Saturday trigger keeps reading the spec from `develop` on each run; the Monday trigger
  carries the same pointer prompt pattern.

## Open questions

1. The agenda's panel line still names afo, coi and matt. Does it change to match the readers
   in decision 10, or does Coi stay on the panel without reading the brief?
2. Mirror this hub to Linear? PRD-1293 is the v5 parent and GROW-92 points at it. Parent-only
   mirror on that issue, a new issue, or none.
3. Who reads `#research` today? Unanswered since the v5 brief; it decides whether the Saturday
   excerpt stays a post or becomes a pointer like Monday's.
4. Should the threads document restate the agenda's Settled facts per track, or only link to
   the agenda? Proposed: link.
5. Should Monday also write Customer Needs when weekend calls happened, or wait for Saturday?
   Proposed: wait; A8 keeps one writer per surface.

## Success Signal

Each week, at least one next human step named in Monday's brief is taken by Friday, and no ask
from a partner call waits more than a week before it appears on that organisation's Customer.
