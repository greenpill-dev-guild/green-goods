# Research and pitch package (first draft)

**Drafted:** 2026-10-09 and 2026-10-10 by Claude Fable 5.1, from the
[research and pitch handover](../handoffs/claude-fable-research-pitch.md).
**Posture:** reviewable first draft, in a draft pull request since 10 October. Nothing here is
approved copy or an implementation dispatch. Every amount, buyer and partnership stays labeled
until Afo confirms it.

These files read against the reconciled 9 October hub documents: the [brief](../brief.md),
[architecture](../spec.md), [plan](../plan.todo.md), [acceptance evidence](../eval.md) and the
[white paper v0.8 review](../whitepaper-v8-review.md). That reconciliation was committed beside
this package on 10 October, unchanged from the planning checkout. The pitch assets live in the hub
at [`../artifacts/`](../artifacts/README.md).

## Outline

The package answers one question: what can a first supporter fund at Tech and Sun today, what do
they get back, and what must still be true before the stronger claims can be made. It works
backward from that funding decision and forward from evidence we actually hold.

| # | Deliverable | File | State |
|---|---|---|---|
| 1 | Research brief: first audience, need, comparable approaches, funding routes, Nigeria data, four-level capital-flow map, unknowns | [research-brief.md](research-brief.md) | first draft |
| 1 | Claim ledger: every consequential claim with status, source, date and allowed phrasing | [claim-ledger.md](claim-ledger.md) | first draft |
| 2 | Eight-to-ten-minute pitch: slide sequence, editable deck, speaker notes, technical appendix, rendered slides | [`../artifacts/`](../artifacts/README.md) | first draft |
| 3 | One-page supporter offer and FAQ | [supporter-offer.md](supporter-offer.md) | first draft |
| 4 | Demo scripts: go-authorized live version and no-go local rehearsal | [demo-script-go.md](demo-script-go.md), [demo-script-no-go.md](demo-script-no-go.md) | first draft |
| 5 | Fiat stretch decision note | [fiat-stretch-decision.md](fiat-stretch-decision.md) | first draft |
| 6 | Architecture and integration research (10 October): platform status, live Gnosis state, message lane, member accounts, design recommendations, fork rehearsal plan | [architecture-integration-research.md](architecture-integration-research.md) | first draft |

## Reading order

1. The [research brief](research-brief.md) for the recommended first audience and offer.
2. The [claim ledger](claim-ledger.md) before editing any slide or external copy.
3. The pitch assets [README](../artifacts/README.md) for how to edit and re-render the slides.
4. The [architecture and integration research](architecture-integration-research.md) before
   dispatching PRD-1096 or answering a technical question from a judge.

## Decisions on 9 October

Afo decided: the diaspora route, with Omo Yoruba of Southern California cited; the hub images from
Tech and Sun's X account and the uploaded photos may be used; the legal name may be used (the
registered string still has to be inserted). He then accepted the recommendations on the ask amounts ($30 seat, $800 season pack, $1,200
Green Goods coordination package, all scenarios until COM-46), the payment route before a live go
(a gift through Omo Yoruba as fiscal sponsor) and the Linear states (RESR-94 and MAR-32 moved to
In Progress). The brief's section 12 records all five.

## Boundaries kept

- No participant names, quotes, photos or transactions were invented. Where consented material is
  missing the draft says so and leaves a labeled placeholder.
- No runtime code changed. The only code activity was a read-only rerun of the focused foundation
  contract tests to refresh the review's receipt (see the brief's implementation section).
- No outreach, provider signup or spending. Nothing was published before 10 October, when the
  package was pushed to a draft pull request at Afo's request. Progress comments were posted to
  the research and pitch records as the handover authorized, and RESR-94 moved to In Progress on
  his acceptance.
- The two hub photographs the deck uses are not committed, and the rendered slides under
  `deck/output/` are ignored by the repository's `.gitignore`. The pitch assets README says how to
  supply both.
- The repository is public. Partner contacts, wallet addresses and private evidence stay out of
  these files.

## Task record

Task record: RESR-94 and MAR-32 research and pitch package | Type: investigation and drafting | Outcome: complete for the reviewable first package; approval, consent, publication and implementation remain open
Agent/model: Claude Code, Claude Fable 5.1 (claude-fable-5-1) | Coverage: this handover segment only (the 9 October Codex review and reconciliation are earlier segments)

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | unknown → 2026-10-09T20:32Z | Plan hub, 21 Linear records and comments, code at `06a31dbf5`, CLC white paper v0.8 and docs, World Bank API and RPW pages, CBN via dated press, NISER and NiDCOM summary, hackathon site, supplied brief, Lead Sync notes and case-study draft. First observed clock was the test run; investigation began earlier. |
| Verify runtime | 2026-10-09T20:32:20Z → 2026-10-09T20:35:31Z | Focused foundation suites: 275 passed, 0 failed, 10 suites (receipt in the research brief, section 9). The wrapper cloned the pinned Foundry submodules into the worktree; `git status` stayed clean. |
| Implement drafts | 2026-10-09T20:32Z → 2026-10-09T20:54Z | Seven research files and the deck package written; 17 slides rendered and inspected; three slides fixed and re-rendered. |
| Publish tracker notes | 2026-10-09T20:54:43Z → 2026-10-09T20:54:45Z | Progress comments on RESR-94, MAR-32 and GROW-43; no states, dates or new issues. No Git publication. |
| Verify package | 2026-10-09T20:54Z → 2026-10-09T20:56:03Z | Relative links (one resolves only after the main checkout's handoff lands), no em dashes, no trailing whitespace, plan-hub validator passed (26 hubs), ledger arithmetic rechecked. Rendered proof: `deck/output/slide-NN.png`, CI Playwright class (headless Chromium, no authenticated session). |

Human corrections: 0 observed in this segment; attention: unknown.

### Continuation segment (Afo's decisions, 9 to 10 October)

Task record: RESR-94 and MAR-32 research and pitch package, decisions applied | Type: drafting | Outcome: complete for the five decisions; a named supporter, the gift method and the registered name string remain open
Agent/model: Claude Code, Claude Fable 5.1 (claude-fable-5-1) | Coverage: this continuation only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | unknown → 2026-10-10T05:20Z | Omo Yoruba facts (website, Linear RESR-40 and GROW-61, Ma Earth application, Afo's design material), the donate page (no payment form), Tech and Sun's site and X account, the donate guide and Cookie Jar records, the June deck photos. No document carried the registered NGO name. |
| Implement | 2026-10-10T05:20Z → 2026-10-10T05:24:06Z | Brief, ledger (C47 to C50), offer, both demo scripts, README, deck (slides 1, 2, 8, 10, 13 and notes) updated; photos added under `deck/assets/photos`; deck re-rendered and the five changed slides inspected. |
| Publish tracker notes | 2026-10-10T05:23:50Z | Follow-up comment on RESR-94; no states changed. |
| Verify | 2026-10-10T05:24:06Z | No em dashes, no trailing whitespace, hub validator passed, package arithmetic 2 x 120 + 12 x 40 + 12 x 40 = 1,200; the one unresolved link is the main checkout's uncommitted handoff file. |

Human corrections: 0 observed in this segment (five decisions answered, no rework requested); attention: unknown.

### Acceptance segment (10 October, UTC)

Task record: RESR-94 and MAR-32 research and pitch package, recommendations accepted | Type: drafting | Outcome: complete; a named first supporter, the gift method, the registered NGO name string and COM-46 terms remain open
Agent/model: Claude Code, Claude Fable 5.1 (claude-fable-5-1) | Coverage: this acceptance only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Implement | unknown → 2026-10-10T06:33:24Z | Accepted labels applied to the brief (sections 2, 11, 12), ledger (C45, C48), offer and README; RESR-94 moved to In Progress at 2026-10-10T06:32:55Z; MAR-32 was already In Progress (started 2026-10-10T03:14:56Z by someone else). |
| Publish tracker notes | 2026-10-10T06:33:24Z | Acceptance comments on RESR-94 and MAR-32. |
| Verify | 2026-10-10T06:33:24Z | No em dashes, no trailing whitespace in the research files. Deck unchanged in this segment. |

Human corrections: 0 observed in this segment; attention: unknown.

## Task record: architecture and integration research (10 October)

Task record: Cosmo-Local architecture and integration research | Type: investigation | Outcome: complete for the bounded question; implementation, deployment and outreach not started
Agent/model: Claude Code, Claude Fable 5.1 (claude-fable-5-1) | Coverage: this segment only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | unknown → about 2026-10-10T09:30Z | Hub, eight Linear records with comments, the 22 September model artifact, code paths, public CLC documentation and vendor documentation. No clock was observed during this phase. |
| Verify on chain | about 2026-10-10T09:30Z → about 2026-10-10T10:35Z | Read-only: factory scan to Gnosis block 48,683,249, pool and voucher sampling, router and fee reads on Arbitrum and Gnosis, bytecode reads on three chains, Kernel derivation and simulated deployment. Nothing broadcast. Times approximate. |
| Record | about 2026-10-10T10:35Z → 2026-10-10T10:50Z | New research file; ledger rows C51 to C62; brief section 9 pointer; one honest-status line on slide 11 re-rendered; memory notes; comments saved on RESR-73 and PRD-1096 at 10:47Z. |

## Task record: publication to a draft pull request (10 October)

Task record: Cosmo-Local research and pitch package, pushed for review | Type: packaging | Outcome: draft pull request opened; no merge requested
Agent/model: Claude Code, Claude Opus 5.5 (claude-opus-5-5) | Coverage: this segment only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Review for a public repository | unknown → 2026-10-10T16:38Z | Every file to publish re-read. Cosmo-Local's status is now stated from public evidence only (terms page, public repositories, chain state); the hub photographs stay out of the commit; `deck/output/` is ignored by the repository. No other content changed. |
| Verify and publish | 2026-10-10T16:38Z → see the pull request | Branch `research/cosmo-local-pitch-and-architecture` cut from `origin/develop`. Validation receipts (plan-hub validator, guidance links, immutable reports, push gate) are in the pull request description, because a receipt cannot name the commit that contains it. |

Human corrections: 0 observed in this segment; attention: unknown.

## Task record: planning edits and hub-local pitch assets (10 October)

Task record: planning reconciliation committed on the pull request branch, pitch assets moved into the hub | Type: packaging | Outcome: both pushed to the draft pull request; no merge requested
Agent/model: Claude Code, Claude Opus 5.5 (claude-opus-5-5) | Coverage: this segment only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | unknown → 2026-10-10T16:51Z | The planning checkout was read without changing it: 14 modified and 4 new planning files across four hubs, last written 9 October 19:30Z. None of the 14 had changed on `develop` since that checkout's base. `.claude/settings.json` and the Green Goods OS idea hub were left out as unrelated. |
| Implement | 2026-10-10T16:51Z → 2026-10-10T16:53Z | The 18 planning files were copied byte for byte and committed on their own. Lane objects and workflow state are identical to `develop` in all four hubs. The deck package then moved from a top-level `artifacts/` folder to this hub's `artifacts/`, with every reference updated and the handover's save location corrected. |
| Verify and publish | 2026-10-10T16:53Z → see the pull request | Validation receipts are in the pull request description. |

Human corrections: 1 in this segment (no top-level `artifacts/` folder; pitch assets belong in the plan hub); attention: unknown.
