# PWA Interface Simplification Plan

**2026-10-25 wave A:** steps 1 and 2 merged (#1274, #1275), with PRD-1311's fix. The maintainer
asked for every step that can run in parallel to run in parallel, so seven sessions build steps 3,
4, 5 and 6, 11, 14 and 16, 7 and 9, and 8 and 19 at once, each on its own files; step 3 owns the
stories for the five Home states and step 6 the Profile list and locale coverage. The remaining
design rules are DL-127 to DL-131. Next: step 10 after the About review, then 15, 18, 13, 17 and 12.

**2026-10-24 start gate:** the maintainer gave the execution go for both slices and answered the
start gate, recorded in [spec.md](spec.md#start-gate-on-24-october-2026): the app's chip is 32px
with a 48px hit area, amending the 44px app density that #1251 merged; the chip shows the garden's
banner on both surfaces, so the cockpit's chip changes with it (decision 33); and in the second
slice step 18 comes before step 13, then step 17 (decision 34). The hub moved to `active`. #1162
merged the same day with a members-only check for the two family test gardens that reads
gardeners and stewards; step 1 moves that check onto the membership owner. Steps 13, 14 and 15,
16 and 17, 18 and 19 have their own Linear sub-issues under PRD-1260, listed in
[status.json](status.json).

**2026-10-20 design round:** the Start step was reopened against the design books and settled
as decisions 16 to 20 in [spec.md](spec.md#review-round-on-20-october-2026); step 13 carries the
one-question step, and steps 16 and 17 the Open default and the take-up from the step. Later
that day the step itself was settled (decision 16), the one submission flow for evidence and
work added as step 18 (decision 21), and the steward's Garden duties section as step 19
(decisions 22 to 24); the Work-for treatment, Home's row style, the promise card and the free-work
wording await a pick.

**2026-10-19 review round:** the maintainer reviewed the lab and the lock; nine corrections and,
later that day, the five explorations and the badge rule are settled, all recorded in
[spec.md](spec.md#review-round-on-19-october-2026). Steps 3, 4 and 7 to 11 carry the corrections;
steps 13 to 15 are the new work (the Start step layout, notification events, the bell and its
sheet).

**2026-10-18 scope lock:** the maintainer locked the eight decisions recorded in
[spec.md](spec.md#decisions-locked-on-18-october-2026) after the findings and the lab in
[artifacts](artifacts/README.md). The design gate below is closed except for the execution
authorization; the delivery sequence is now two slices. No branch or implementation task has been
dispatched.

**2026-10-15 tracking amendment:** RESR-93 and conditional Product delivery PRD-1260 belong to
Green Goods 2.1.0. PRD-1261 owns paired PWA/admin cohesion and PRD-1262 release acceptance. The
four-goal alignment that connects this work to Cosmo-Local and the pitch is recorded with the
Cosmo-Local hub; no live Gnosis deployment is a prerequisite.

**2026-10-09 tracking amendment:** the user requested hackathon planning and Linear visibility.
The joint hackathon discussion in the Cosmo-Local hub records the relation to CLC and the pitch.
Linear visibility is authorized; this supersedes earlier statements that this hub creates no Linear
record.

**Feature Slug:** `pwa-interface-simplification`
**Stage:** active
**Status:** IN DELIVERY (execution authorized 24 October 2026; the first slice is in progress)
**Created / Last Updated:** 2026-10-06 / 2026-10-25
**Linear Issue:** RESR-93
**Linear Project:** Green Goods v2.1.0 QA & Release
**Linear Source:** source:plans

The confirmed direction and the locked scope are in [brief.md](brief.md); the evidence, the state
architecture and the decisions are in [spec.md](spec.md). [status.json](status.json) owns lane
state. Existing Linear records provide planning and delivery visibility.

## Design gate

- [x] Record the user's confirmed preferences separately from recommendations.
- [x] Identify the existing Home, sheet, garden-switching, and submission owners.
- [x] Bound this hub against Community, Commitment Pooling, Credit, CLC, and admin work.
- [x] Define evaluation and recovery cases without claiming measured improvement.
- [x] Refresh the rendered baseline for the release being redesigned; label engine/session
      (mock-auth localhost on Arbitrum, 18 October; see [spec.md](spec.md#what-the-code-does-today-rechecked-18-october-2026)).
- [x] Compare compact journal and featured activity using the same realistic content (the lab).
- [x] Resolve the four product decisions in the specification; record acceptance explicitly.
- [x] Specify selection persistence, deep links, sheet scope, role capabilities, and draft recovery.
- [x] Answer the five 19 October explorations and the badge question; fold accepted ones into steps.
- [x] Pick the Start step's shape (decision 16, 20 October).
- [x] Pick from the lab (20 October, decision 27): no Work-for pin, Home's rows as cards, the compact promise card, Log Work on Its Own, Needs Your Attention, the wallet launcher in the header, the banner in Insights, and the Highlights carousel back.
- [x] Pick the seasons and campaigns placement (21 October, decision 32: the rail; the chips and none stay in the lab).
- [ ] Review the About placement after the first slice renders in the app.
- [x] Approve the first implementation slice and promote the hub only when execution is authorized
      (24 October: both slices authorized, the hub promoted, the slice 1 lanes opened).

On 21 October the maintainer took the rail (decision 32) and locked the plan and scope. The
implementation start gate ran on 24 October: the authorization, the parent record's sync, the
promotion to `active`, and the first slice's lanes with required TDD proof.

The lab in [artifacts](artifacts/README.md) is the portable, sanitized record of the accepted
design. It holds no private transcript material or host-specific previews.

## Conditional delivery sequence

The maintainer authorized these steps on 24 October 2026. Select exact files and focused tests
from the then-current owning code before each bounded change. Split a step further if it would
exceed one coherent session or mix independent behaviors. Steps 1 to 6 are the first slice; steps
7 to 19 the second; step 20 accepts both. In the second slice, step 18 comes before step 13, then
step 17 (decision 34); step 16 can land at any time.

| Step | Lane | Work and likely owners | Completion evidence |
|---|---|---|---|
| 1. Membership owner | `state_api` | One Shared module answers which roles an account holds in a garden (gardener, steward, owner, evaluator, pending open join), and a hook returns the candidate gardens with loaded, error and stale flags. Home's filter, Profile's list, Submit Work, the offline scheduler and the arrival state move onto it. | Focused proof for each role, a pending join, a stale list and a failed read; the five earlier derivations gone or delegating. |
| 2. Active-garden store and resolver | `state_api` | A persisted Shared store keyed by chain and account, and a resolver with the states loading, error, none, choose and ready: one candidate selects itself; a stored id wins while eligible; several with nothing eligible is choose. | Resolver tests for zero, one, several, stored-eligible, stored-stale, cached-while-loading, error-without-cache and an account switch; no draft, queued job or promise link touched. |
| 3. Home shell | `ui` | The shared `GardenChip` at the app's 32px with a 48px hit area and the garden's banner as its avatar on both surfaces (the look in PRD-1278, decision 33), opening the switcher through an additive callback while the cockpit keeps its popover, the half-tier switcher sheet with the member's gardens (banner, place, role) and Explore gardens, Explore with one tag on each card's photo and the family test gardens shown only to their members, the one-time chooser, the no-garden Home, the header sticky with a hairline once scrolled, and an Explore route under Home declared before the garden id route. | Rendered none, one, several-first-run and several-remembered states at 360 and 390px in three languages; the bottom bar stays on Explore; a visit never writes the store. |
| 4. Submit Work preselection | `state_api`, `ui` | The active garden as the last fallback after a promise link, a resumed draft and navigation state; the picker hidden when the garden is valid for the chosen action; no garden pin, and one line under the steps that names the submission garden whenever it differs from the active one, whether a resumed draft, a promise link or navigation state selected it (decision 28). | Controller test for the precedence order; a draft from another garden resumes its own and shows its line, as does a promise link to another garden; rendered Start step with and without a valid garden. |
| 5. Offline photo garden | `state_api` | The scheduler keeps the active garden's photos first and the viewed garden's second. | Policy test for active and viewed gardens; which lists are kept does not change. |
| 6. Profile list and guides | `ui` | Profile's gardens list on the shared membership, marking the active garden; decision-log rows, strings in three languages, Storybook states, the PWA design guide's content hierarchy. | Locale coverage; stories for the five Home states; the design checks pass. |
| 7. Recent activity | `ui` | The garden's newest work as item rows, with See all opening the Work sheet over Home, and the Highlights carousel above it (decision 27): equal 280×112 cards, the open cycles first, then a featured update and the open ask or a steward duty. | Truthful status pills; empty, loading, error and offline states; the carousel absent when it has no card; no card changes height. |
| 8. Continue | `ui` | Pending rows from the Your Work derivation filtered to the garden (the member's own drafts and uploads), capped, with Open Your Work. | Order per DL-061; counts match the sheet; the Home badge counts the active garden's drafts and queued uploads on this phone. |
| 9. Take part | `ui` | Open and asked-for promises in the garden, with See all opening the Promises sheet; the open season and campaigns lead the carousel, or stand as one line each under Take Part without it, each opening the cycle details sheet (decision 32). | Rows reuse the commitment row anatomy; no second promise workflow; the cycle cards read the pool's cycles as the Pool tab does and write nothing. |
| 10. About row and section sheets | `ui` | Insights, Gardeners with the join-request count for stewards, Share, Endowment for stewards and depositors (Governance stays out while its flag is off). Insights, Gardeners and Work open as tall sheets over Home with the section's content under the shared sheet header and the garden named beneath the title; a garden the member visits keeps its page with tabs. | Access matrix for gardener, steward, evaluator, owner and depositor; no new privilege from presentation; the sheets reuse the tabs' components and close back to Home's scroll position. |
| 11. Scoped sheets | `ui`, `state_api` | Your Work and Promises filtered to the active garden with no widening row, except that an item whose garden the chip cannot reach (a garden the member left, a record with no garden) stays visible in every garden; the Your Work badge and the bottom bar's Home badge count the active garden's drafts and queued uploads on this phone; the Promises sheet carries the Pool tab's cycle rail at its top, filtering by tap, with the details sheet behind the ⓘ and Show Its Promises filtering the list (decision 32). | The sheet names its garden; drafts and queued work from other gardens stay reachable by switching the chip or, when no reachable garden holds them, stay listed, nothing in the queue is lost, and the queue's toast still reports a failed upload for any garden; the rail and the details sheet are the shipped components moved, not rebuilt. |
| 12. Arrival toast | `ui` | Retire the toast's garden and draft branches now that Home shows them; keep the queue branch. | No lost orientation for failed uploads. |
| 13. Start step layout | `ui` | Submit Work's first step as decided: no Start button, choosing a promise or an action advances while the domain chips only filter; promises the member could work on as compact cards with Log Work on Its Own last (decision 27); an evidence-only promise straight into the evidence flow; a promise with actions on its own screen with Add evidence first and its actions as rows up to three or two-up tiles past that; otherwise two-up action tiles under the info panel and capsule domain chips with All, drawn from the garden's domains (one domain, no chips); the step skips when the answer is known (a promise link, or one action with nothing owed and no Open ask listed); promises as compact cards with two needs and a +N mark; the info panel one line per context at one height; the progressor spread across its width (decisions 29 to 31). | Rendered Start for nothing owed, one domain and three, a promise with one action, one with three actions and evidence, an open evidence-only ask, a promise link, a resumed draft, a one-action garden with nothing owed (the step skips) and the same garden with an Open ask listed (the step stays); every tile one height with two-line titles; every compact card 132px; no Start button anywhere; the precedence from step 4 unchanged. |
| 14. Notification events | `state_api` | One Shared read model of what is new for an account in a garden: own work approved or rejected with feedback, a promise taken up; for an account that can act on it under the act's existing permission check, a new submission and a take-up request (decision 11 as amended on 21 October; decision 22 gave evaluators no Home duties). Join-request events stay out until a signature-free read exists: every read of the agent's queue needs a signed proof that claims a nonce. Seen state kept on the device. | Focused proof per event kind and role, the two join-request kinds recorded as open; counts match the sources they derive from; nothing new is written on-chain or to the agent. |
| 15. Bell and Notifications sheet | `ui` | The bell at the far right of Home's header cluster with the unread count, and a tall sheet of the garden's events, one row each and never a standing count, that open the work, the promise, Your Work or the Gardeners sheet. | The other header icons keep their positions; the badge is the one 16px badge; rows keep one height; an empty state when nothing is new. |
| 16. Open asks by default | `ui` | Compose defaults a new ask's claim mode to Open and keeps Approval gated as the opt-in, with copy that says who can take it up. | Compose's review shows the mode; a gated ask still records a pending claim; no contract change. |
| 17. Take up from the step | `state_api`, `ui` | The Start step lists the garden's Open asks beside the member's promises; picking one queues the claim before the work and its link as one dependent chain in the job queue, and the step says how many prompts are coming. Approval-gated asks are not listed until accepted. | Queue test for claim, then work, then link, with the failure at each step recoverable and nothing reassigned; critical-surface review of the queue change; rendered Start with an Open ask listed and a gated ask absent. |
| 18. One submission flow | `state_api`, `ui` | Consolidate Submit Work (the work submission flow controller with Intro, Media, Details and Review) and the proof composer (its controller with ProofShell, ProofMedia, ProofDetails and ProofReview) into one flow with two kinds, work and evidence: one shell, one stage sequence, shared media handling and pinned promise, kind-specific pieces at each stage, one job-queue path per kind. Critical surface: work submission and the queue. | Both kinds reach the queue through the shared stages with their existing payloads unchanged; focused proof per kind per stage; drafts and queued uploads of either kind survive the change; before and after pairs of every stage. |
| 19. Steward duties | `ui` | A section above Recent Activity for stewards, drawn from the existing counts (pending work in the garden, take-up requests on gated asks, one row per promise, and promises ready to confirm), each row shown to an account that can perform its act under the act's existing permission check and opening its exact queue (the Work sheet on Pending, the promise's claim panel, Promises on To confirm); join requests stay out until a signature-free count exists; absent when nothing waits and for every other role; titled Needs Your Attention (decision 27). | Rendered for a steward with and without waiting items and for a gardener (no section); counts match the queues they open; no new privilege from presentation. |
| 20. Acceptance | `qa_pass_1`, then `qa_pass_2` | User-flow review, then independent regression review, including the gardener walk in PRD-1157 on the new Home. | Criteria in [eval.md](eval.md), accurate session labels, authenticated proof (the user's real Brave profile) for the queued take-up chain and offline uploads recorded before this step passes (a pending result may stand in a handoff but does not satisfy acceptance), and fresh receipts for the changed surfaces. |

Step 3 consumes steps 1 and 2. Step 4 can be designed alongside step 3 but is verified on its own
before the Start step consumes it. Steps 7 to 13 build on the first slice's owners and reuse the
existing read models; step 14 is one new derivation, kept as its own bounded Shared step, and
step 15 consumes it; step 17 adds a dependent-act chain to the job queue and step 18 reshapes the submission flow;
both are reviewed as critical surfaces. No contract lane is
needed. No admin, indexer, or protocol migration is expected; a discovered need returns to scope
review.

## Requirements coverage

| Requirements | Planned steps |
|---|---|
| R1 garden-scoped entry and switching | 1, 2, 3 |
| R2 ordered, selective previews | 7, 8, 9, 19 |
| R3 familiar navigation and sheets | 3, 10, 11, 15 |
| R4 deeper garden actions | 10, 13, 16 |
| R5 submission and draft continuity | 2, 4, 13, 17, 18 |
| R6 role/capability preservation | 1, 8, 10, 14, 17, 19, 20 |
| R7 existing records, recovery, and domain boundaries | 2, 4, 5, 11, 12, 17, 18, 20 |
| R8 discovery and personal context | 3, 6, 11, 15 |

## Execution rules

- Re-read nearest package guides, PWA design decisions, and relevant concurrent changes before work.
- Use Shared for React hooks and authoritative state; consume its declared exports.
- Reuse AppSheet/PwaSheet, existing queue/state derivations, and action schemas. Avoid a new generic
  dashboard framework, duplicate queue, role switch, or speculative per-garden configuration.
- Keep strings in existing i18n, retain accessibility and offline behavior, and preserve current
  badge meanings. Existing deep links and unlinked work need no forced migration.
- Select meaningful failing proof for changed behavior before implementation. Record RED/GREEN in
  lane handoffs and with the plan helper before terminal lane claims. A visual-only proof limit
  must be explicit; do not use it to waive state or recovery proof.
- Create lane handoffs when moving to active. Keep branches null until separately authorized work
  begins; a lane owner is a planning default, not an instruction to start another agent.
- Use the validation selector for the eventual changed surfaces. Auth/queue-sensitive paths retain
  their critical checks. Browser evidence must use the repository's engine/session labels.

## Planning validation

The hub-only check is `node scripts/harness/plan-hub.mjs validate`. Check local Markdown links and
JSON consistency as well. Application tests and rendered implementation proof are not applicable
to this planning record; no implementation lane is passed by these document checks.

Validation results are recorded in [eval.md](eval.md#hub-creation-check) and
[eval.md](eval.md#scope-lock-check-2026-10-18).
