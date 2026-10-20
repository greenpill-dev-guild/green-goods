# PWA Interface Simplification — Specification

**Status:** scope locked on 18 October 2026. The decisions at the end are the maintainer's; the
proposals above them record how they were reached.
**Evidence date:** 2026-10-06, rechecked on 2026-10-18 against develop `eeda2d4e5`; gardens read from the production indexer on 2026-10-19. Code
references describe the inspected working tree, not a deployment certification. Recheck them when
implementation starts, particularly where concurrent work lands.

The target is the signed-in PWA experience. Preserve public website and anonymous discovery
behavior when reusing components or routes shared with the browser surface.

## Current experience and sources

Read these owners before changing their behavior. This is a bounded evidence map, not a second
inventory of routes, states, or permissions.

| Question | Current source and implication |
|---|---|
| Why does Home feel global? | [Home](../../../packages/client/src/views/Home/index.tsx) presents the directory and personal sheet launchers. The proposal changes the returning-member default. |
| Why do controls compete? | [Garden detail](../../../packages/client/src/views/Home/Garden/index.tsx) combines garden content with banner actions; [garden tabs](../../../packages/client/src/views/Home/Garden/gardenTabs.tsx) separate Work, Promises, Insights, and Gardeners. Home previews need an explicit destination for each displaced function. |
| What should feel familiar? | [PWA design](../../../packages/client/DESIGN.pwa.md) and [AppBar](../../../packages/client/src/components/Layout/AppBar.tsx) own the current shell, terminology, and sheet conventions. Preserve Home / Garden / Profile and existing sheet behavior. |
| What does unfinished mean? | [Your Work](../../../packages/client/src/views/Home/WorkDashboard/WorkDashboardShell.tsx) and PWA design decision DL-061 distinguish drafts, upload/retry states, review responsibilities, and sent work in review. Reuse those meanings; Home is a preview, not another queue. |
| Where is garden selection repeated? | [Submission Start](../../../packages/client/src/views/Garden/Intro.tsx) selects domain/action and garden. Changing domain currently clears selections. Preselection needs deliberate validity handling rather than hiding the picker alone. |
| What identifies promise-linked work? | [Promise selection](../../../packages/client/src/views/Garden/WorkCommitmentSelection.tsx) carries an eligible promise and exact requirement. [Submission controller](../../../packages/shared/src/hooks/client-ui/work/useWorkSubmissionFlowController.ts) owns flow state; [Details](../../../packages/client/src/views/Garden/Details.tsx) uses action-specific fields. |
| What existing switcher can inform the design? | [GardenChip](../../../packages/shared/src/components/Canvas/GardenChip.tsx) provides the admin pattern. Adapt its selection language to the PWA; do not import admin-only actions or navigation. |
| Who can see management or funding controls? | [Garden detail](../../../packages/client/src/views/Home/Garden/index.tsx) owns current review, join-request, governance, and Endowment predicates. Endowment visibility includes qualifying depositors who are not stewards. Preserve and verify those distinctions. |

Earlier design exploration inspected Home, garden detail, and Promises in **authenticated Brave**.
That was rendered evidence for those visited surfaces only. Your Work was not verified opening in
that session; its behavior above is code-derived. Local static design previews were prototypes,
not application or installed-PWA proof. This hub introduces no new rendered implementation proof.

## What the code does today (rechecked 18 October 2026)

Evidence: a mock-auth localhost walk on Arbitrum with the production indexer (the main checkout at
`06a31dbf5`, whose journey files match develop `eeda2d4e5`) and the unification hub's Storybook
captures. The `steward` mock belongs to no garden on Arbitrum; the `deployer` mock is a steward of
TAS HUB and the Community Garden and a gardener in Aiyeloja Family Garden.

1. Nothing in the PWA remembers a garden; the selection exists only while `/home/:id` is open. The
   cockpit holds the pattern: the last garden per chain-and-account key in local storage, the URL
   wins and is written back, a status that keeps loading and error apart from no gardens, and a
   stale-list guard. The store shape and the resolution rule carry over; the hooks do not, since
   they read admin role queries.
2. "My gardens" has no owner. Five derivations differ:

   | Where | Counts as mine |
   |---|---|
   | Home filter, Profile list | gardeners, stewards |
   | Arrival toast, Submit Work | gardeners, stewards, pending open joins |
   | Offline cache | gardeners, stewards, owners |
   | Reviewer gardens | stewards, evaluators by on-chain check |
   | Cockpit eligibility | stewards, owners, evaluators |

   An evaluator-only account has review work in Your Work but an empty My gardens. A depositor
   sees Endowment on a garden page but is a member nowhere.
3. The one-garden shortcut already exists in the arrival toast: its action opens the only garden
   and, with several, narrows the directory to mine.
4. Submit Work's garden precedence is a promise link, then a resumed draft, then a garden passed
   in navigation state, then the picker.
5. Home's header holds Filters, Wallet, Promises and Your Work. The garden banner holds Back,
   Notifications for stewards, Governance, Endowment, Share and the join action, and with the
   title and the tab rail takes about 330px of an 844px screen before content.
6. Your Work merges my work and my reviews across gardens, and Promises lists the viewer's inbox
   across pools; neither names the garden on a row.
7. Offline keeps work lists for every joined garden and photos only for the garden in view plus
   my own work.
8. A member with no garden lands on the full directory; the empty "mine" copy says "You don't
   steward any gardens yet"; Submit Work offers the Community Garden onramp; a pending join
   request shows on the garden page and nowhere else.
9. The install handoff redirects Home to a remembered record link; visiting by link is its own act.
10. The directory is the chain's newest fifty gardens; a member's gardens should be read by
    account before that cap bites.

## Requirements

| ID | Requirement | Basis |
|---|---|---|
| R1 | No joined gardens: retain directory/join flow. One: open that garden. Several: top switcher retaining selected context. | Explicit product direction. |
| R2 | Home order: recent activity → unfinished work → participation; previews stay selective. | Explicit product direction. |
| R3 | Preserve one-tap personal sheets, bottom navigation, and existing design language. | Explicit product direction and PWA design contract. |
| R4 | Resolve header/banner action placement and keep deeper areas reachable. | Explicit design concern; final placement open. |
| R5 | Carry the selected garden into new submissions; carry draft or promise context into their own flows. | Explicit product direction plus current flow ownership. |
| R6 | Support gardener, steward, evaluator, and community-member capabilities without granting new permissions. | Existing capability predicates and domain sources. |
| R7 | Preserve unlinked work, drafts, evidence, queue recovery, confirmation, and financial distinctions. | Existing submission behavior and integration boundaries. |
| R8 | Keep discovery, existing links, and account-wide possessions reachable from the scoped experience. | Proposed continuity requirement; precise sheet filters need acceptance. |

## Proposed homepage

The following outline is a discussion baseline, not a pixel specification. Follow the existing
Warm Earth tokens, type hierarchy, sheet anatomy, and motion/accessibility rules.

```text
[Selected garden ▾]                 [Wallet] [Promises] [Your Work]
Small garden identity / About garden

Recent activity                                  See all
  Two or three compact updates, with honest work status

Your unfinished work                             Open Your Work
  Resume draft / Fix upload / View submitted work

[Your responsibilities • pending count]          Manage
  Conditional: show only actions this account may perform

Take part                                        See all
  Selected open promises or actions with a concrete next step

                    Home       Garden       Profile
```

The row count is a prototype target, not measured optimal density. Do not let an activity feed push
unfinished work arbitrarily far down. Keep the user's chosen order; compare the first screen and
scroll distance with realistic data, long translations, and empty states.

**Variant A: compact journal (recommended).** Short activity rows leave room for unfinished work.
Best starting point for frequent visits. Risk: weak images may make the garden feel less alive.

**Variant B: featured activity.** One larger recent update gives the community more visual presence.
Risk: delays unfinished work on small screens. Test with the same content and tasks as A.

Simply promoting the current garden detail unchanged remains a possible intermediate delivery
step, not the accepted final composition. A new voucher tab and a separate role-specific navigation
system are outside this proposal. The planned CLC instrument is called a service voucher;
Cosmo-Local Credit remains the product-family name.

## Sheets and deeper destinations

- Keep Wallet, Promises, and Your Work one tap away in the header. Wallet remains account-wide;
  proposed garden filters for the other sheets must be explicit and reversible.
- Home activity and participation previews open an appropriate scoped list or existing detail.
  Do not create a second version of the Work or Promises workflow solely for Home.
- Proposed **About garden** access retains garden information, Gardeners, Insights, share, and
  relevant existing controls. Notifications take a bell in Home's header (decided 19 October); Governance stays in the About
  row for stewards.
- Proposed **Manage** access groups permitted reviews, join requests, and garden operations.
  Reuse existing Endowment and Cookie Jar sheets; do not rewrite their transactions. Preserve an
  understandable Endowment route for qualifying non-steward depositors.
- Keep full work and promise details on their existing detail surfaces where appropriate. Avoid
  chains of nested sheets; close/back must restore the launching context and scroll position.
- The Your Work badge and the bottom bar's Home badge count the active garden's drafts and queued
  uploads on this phone (decided 19 October, narrowing DL-061's phone-wide count). A preview or
  management count must not imply that submitted work still needs uploading, and the queue's own
  toast stays the phone-wide signal for a failed upload.

A management entry after unfinished work is a recommendation. Its cost is an additional step to
some occasional controls. Test that cost with stewards and depositors rather than hiding it.

## Before and proposed after

```text
Returning member today:
Home directory → garden card → garden sections → work / promise detail
Garden tab → action + garden selection → Media → Details → Review

Proposed returning member:
Home in selected garden → update / unfinished item / opportunity → existing detail or sheet
Garden tab → action in selected garden → Media → Details → Review

Proposed promise context:
Promise → valid garden + action + exact requirement → Media → Details → Review
          (retain any unresolved choice or eligibility check)

Existing draft:
Your Work or unfinished preview → saved garden + saved step + saved data → continue

Proposed steward/evaluator:
Same scoped Home → permitted responsibility → existing review/management surface
```

**Start:** selected garden stays visible; show valid domain/action choices and a clear primary
continue action. Do not assume all actions are available in every garden.
**Media:** capture the existing evidence, with linked promise context when present.
**Details:** retain action-defined fields, units, and validation; a mockup's short form does not
replace the real action schema.
**Review:** show garden, action, evidence, and any exact promise requirement before the existing
submission action. Submission, review, confirmation, and reward statuses remain distinct.

Example copy for exploration: “Recent activity”, “Continue your work”, “Resume draft”, “Waiting
for review”, “Take part”. Final labels must be reconciled with existing i18n
and the PWA design decisions before implementation.

## Context and recovery rules to specify before code

| Situation | Required outcome / proposed handling |
|---|---|
| No memberships, or a pending join request | Show discovery and existing request status; a request is not membership or permission to submit. |
| One or multiple memberships | Visible active garden. Persist a selection scoped to account and chain; exact storage/fallback policy is an open implementation decision. |
| Account changes or membership disappears | Revalidate accessible gardens; never display another account's private context or silently select an inaccessible garden. Distinguish loading/failure from no memberships. |
| Direct link names a different garden | Honor and label the linked garden. Decide whether it changes the remembered Home selection; never rewrite a draft as a side effect. |
| Draft belongs to another garden | Resume its original garden and saved step. Changing Home selection cannot reassign work, attachments, or queued jobs. |
| Promise or requirement is invalid, stale, or unavailable | Explain the state and offer the existing recovery/selection path. Do not guess a link or report a network failure as ineligibility. |
| Work was recorded without a promise | Keep it accessible and valid. Any later link uses the existing eligibility and exact-requirement checks; no forced migration. |
| Data is empty, loading, stale, or failed | Preserve section structure and honest status. Distinguish “nothing yet” from “could not load”; retain cached/offline work and recovery. |
| User has several roles | Compose capabilities. “Steward” is not a replacement for the actual authorization rules; evaluator and depositor access must be tested explicitly. |

## Domain and integration boundaries

Use [product context](../../../.claude/context/product.md), the
[ontology workflow](../../../.claude/context/ontology.md), and the owning implementation.
“Promises” is existing PWA copy for commitments, not a new data model.

A work submission records activity and evidence. Review/confirmation establishes the applicable
claim about that work. Recognition, G$ payment, an internal credit record, access eligibility, and
a redeemable voucher are different outcomes. Confirmed work does not itself create an issuer's
future obligation. Home can summarize these states later only when their owners provide reliable
status; it must not suggest every approved work item automatically earns spendable value.

| Related hub | Ownership retained there |
|---|---|
| [Commitment Pooling](../../active/commitment-pooling/status.json) | Promise lifecycle, evidence/confirmation, settlement, and staged exchange decisions. |
| [CLC interoperability](../cosmo-local-credit-interop/status.json) | Protocol research, deployment verification, clean-room boundary, voucher authorization, and hackathon integration scope. Older assumptions are not recertified by this UI hub. |
| [Commitment Credit](../commitment-credit-follow-on/status.json) | Records-only borrow/repay behavior; it is not Wallet value or an access entitlement. |
| [Community Needs & Signals](../community-interface/status.json) | Needs, community signals, separate Community PWA, and join-service operating gates. This hub does not silently consolidate that app. |
| [Steward Cockpit UX](../../active/steward-cockpit-ux/status.json) | Admin experience and its delivery state. Only its existing garden-switching pattern informs this PWA design. |

These are coordination references, not blanket blockers. Home simplification does not require a
new CLC capability, voucher UI, Community app, or contract deployment.

## Design guidance

Apply [PWA design](../../../packages/client/DESIGN.pwa.md) and the
[design skill](../../../.claude/skills/design/SKILL.md). Existing sheet headers, dismissal behavior,
focus handling, and named flow steps should remain familiar. The proposed Home hierarchy and
banner-action relocation intentionally revisit current placement guidance; update canonical
design guidance only with an accepted design and separately authorized implementation scope.

Reference guidance from user-supplied books: Steve Krug's *Don't Make Me Think, Revisited*
(chapters 3–4: scanning, grouping, and understandable choices), and Adam Wathan and Steve Schoger's
*Refactoring UI* (task-first layout, hierarchy, and quieter secondary controls). These support
selective previews and familiar sheets; they do not determine the product's permissions or policy.
No book files, private call excerpts, personal data, or authenticated screenshots belong in this hub.

## Decisions locked on 18 October 2026

The maintainer answered the open questions on 18 October after the findings above and the lab in
[artifacts](artifacts/README.md). Where a lock differs from the recommendation, the lock stands.

1. **Selection.** Implicit, with a one-time chooser. One garden opens itself. Several open the
   last garden used on this device. Several with nothing remembered open the switcher once on Home;
   dismissing it leaves a quiet prompt card, and only a pick writes the memory.
2. **Candidate set.** A garden is "mine" when the account is a gardener, steward, owner or
   evaluator in it. A pending request shows as awaiting review in the switcher and in Explore
   gardens. A depositor keeps Endowment on the garden page and has no place in the switcher.
3. **Composition.** The compact journal: recent activity, Continue, Take part, then one About row.
   Featured activity and the promoted garden page stay as lab variants to compare against.
4. **Sheet scope.** Promises and Your Work open scoped to the active garden and show nothing from
   other gardens. Revised on 19 October: the maintainer removed the "Also in other gardens" row so
   a sheet never mixes gardens, and ruled that the Your Work badge and the bottom bar's Home badge
   count the active garden's drafts and queued uploads on this phone, narrowing DL-061's phone-wide
   count. An upload queued for another garden shows nothing until the chip switches to it; the
   queue's own toast stays the phone-wide signal for a failed upload.
5. **About and management.** One About row at the end of Home for now: Insights, Gardeners,
   Share, Endowment for stewards and depositors, Governance when configured. Steward and evaluator
   duties surface in Continue. The garden page keeps its banner actions for visitors. Review the
   placement after the first slice renders.
6. **Links.** Visiting a garden by link, from Explore or from a row never changes the active
   garden. Only the chip switches, among the member's gardens or through Explore gardens, where
   any garden can be viewed and requested.
7. **Delivery.** Two slices: the context contract, the chip and switcher, discovery and Submit
   Work preselection first; the journal sections and the scoped sheets second. Steps are in
   [plan.todo.md](plan.todo.md#conditional-delivery-sequence).
8. **Persistence.** The active garden is a device preference per chain and account in a Shared
   store, never account state.

Role descriptions and current capability predicates differ in one place: the ontology says
evaluators do not approve work, while the garden page lets an on-chain evaluator review. The lock
does not resolve that policy; the Home duties row for an evaluator points at Insights, and any
change to review authority returns to its owner.

## Review round on 19 October 2026

The maintainer reviewed the lab against the lock and against the unification picks that reached
develop on 18 October, and the lab was rebuilt on the gardens the production indexer lists on
Arbitrum One, with their own banners ([artifacts](artifacts/README.md)). What the review settled:

1. **Pictures.** A garden card, the chip, a switcher row and the pinned Work-for card show the
   garden's banner; a garden without one draws the app's fallback tile.
2. **Explore.** No line above the list. The gardens the app lists, the member's own first, every
   card at one height with one tag on the photo: Member, Awaiting review or Open.
3. **Test gardens.** The two family gardens the app keeps off the public lists (Aiyeloja Family
   Garden and Mama Gardens) show in Explore and the switcher only to their members.
4. **Switcher.** The half sheet, not the tall one.
5. **Sheets.** Decision 4 revised: Promises and Your Work show the active garden only, with no
   widening row. Open consequence: the badge counts everything on this phone, so a queued upload
   for another garden counts on the badge but is not in the list until the chip switches.
6. **Submit Work.** The garden is pinned and named, with no control to change it. A member who
   wants to submit elsewhere switches the chip on Home first. A promise link and a resumed draft
   keep their own garden, and the pin shows it.
7. **Offline.** The shell's strip lies over the header's top padding and moves nothing, as it does
   in the app today. The chip is 32px tall so the row keeps the compact icon buttons' height.
8. **Dark mode.** The primary button keeps dark text on the mint fill; the first lab let a
   lower-specificity rule override it, which is fixed.
9. **Garden sections.** The garden page with its tabs is not where Insights, Gardeners or See all
   should open from Home. The lab draws each as a tall sheet over Home (Work, Insights, Gardeners)
   with the section's content under the one shared sheet header; a garden the member visits keeps
   its page. The maintainer asked for this to be discussed and explored before it is locked.

Later on 19 October the maintainer answered the five explorations and the badge question, each
drawn in the lab as a tweak with the decision as its default:

10. **Garden sections open as sheets over Home.** See all, Insights and Gardeners open a tall
    sheet with the section's content under the one shared sheet header, the garden named beneath
    the title, the way the Promises launcher already works. A garden the member visits keeps its
    page with tabs.
11. **A notifications bell in the header.** It sits at the far right of the cluster (placed there
    on 20 October; the slot the filter leaves is filled by the cluster shifting left). Its badge counts what is new for the account
    in this garden; its sheet lists those events as item rows (own work approved or rejected with
    feedback, a promise taken up, a join request answered; for stewards and evaluators, work to
    review and join requests), each opening the work, the promise, Your Work or Gardeners.
12. **The Home header is sticky,** with a hairline once content scrolls under it. The chip keeps
    declaring the garden at any scroll position.
13. **Submit Work's first step** (revised on 20 October, see decision 16): one question, with the
    actions a promise of the member's still needs first. The promise intent flows into the later
    steps as today (D16).
14. **No Highlights strip.** Home stays rows in the confirmed order; the carousel stays in the lab
    for comparison only.
15. **Badges count the active garden.** See decision 4 as revised.

Decisions 10 to 15 took the recommendation except 15, where the recommendation was a phone-wide
badge with the sheet's subtitle naming what waits in other gardens; the maintainer chose the
garden-only count so the badge and the sheet always agree.

## Review round on 20 October 2026

The maintainer reviewed the Start step variants with the two design books in hand and asked for
the gardening flow to be designed around its real states rather than Home's pattern of lists and
teases. What the review settled:

16. **One question.** The first step asks what the member did and infers the rest. The actions a
    promise of the member's still needs rise to the top of the one list wearing that promise
    ("for Workshop photos · 3 of 12 · due Jan 31"); picking one attaches the promise, says so, and
    one tap unlinks it. An action two promises need says so and asks which after the pick. With
    nothing owed the step is the plain list and never says the word promise. The exact shape (one
    folded list, two labelled groups, or a yes-or-no question before the list), the heading, the
    chooser and the Work-for treatment stay in the lab as tweaks until the maintainer picks.
17. **Known answers skip the step.** From a promise's page Media opens with the promise pinned; a
    garden with one action and nothing owed also opens Media with the action named in the line.
18. **Taking up moves into the step.** Submit Work lists the garden's open asks of the Open claim
    mode beside the member's own promises; picking one takes it up as part of logging the work:
    one tap, two writes (the claim, then the work and its link), sequenced by the job queue, and
    the step says how many prompts are coming before the first. Approval-gated asks appear only
    once the asker has accepted the member's claim; until then the promise page offers "Ask to
    take up". The fulfilment confirmation stays as it is.
19. **New asks default to Open.** Compose defaults the claim mode to Open and keeps Approval gated
    as the opt-in for asks whose asker must choose who takes them. No contract change.
20. **The bell sits at the far right** of the header cluster (decision 11 amended).

What this corrects: the 19 October "promises first" step offered open asks as things the step
could keep, but work links only to a promise the member has taken up (the link-choice hook reads
the account's accepted promises in the garden where the member is an active contributor).
Decision 18 makes the one-tap take-up real for Open asks instead of implying it.

## Persistence and state architecture

- **What it is.** A device preference that must work offline and never leak between accounts.
  Nothing on-chain or in the agent needs it, so nothing stores it there.
- **Where it lives.** A small Shared store persisted to local storage under its own key, shaped like
  the cockpit's: one garden id per `chainId:address` scope. It stays separate from the UI store,
  which resets on account change and persists only filters. The cockpit keeps its own key because
  its candidate set differs.
- **One membership owner.** A pure Shared module answers which roles an account holds in a garden
  from the garden record (gardener, steward, owner, evaluator) plus a pending open join. A hook over
  it returns the candidate gardens with loaded, error and stale flags. Home, the switcher, Submit
  Work, Profile's list and the offline scheduler read it, retiring the five derivations above. It is
  also where an account-filtered indexer read lands when the fifty-garden cap bites.
- **The resolver.** One hook combines the candidate set and the stored id into a status: `loading`
  while the set is unknown, keeping a cached garden so an offline open goes straight in; `error`
  when the read failed with nothing cached, kept apart from no gardens; `none` for zero candidates;
  one candidate selects itself and is written; a stored id that is still eligible wins; several
  with no eligible stored id gives `choose`.
- **A membership that ends.** The stored id fails eligibility on the next load and the resolver
  falls through. Nothing is deleted behind the member's back, and no garden the account cannot see
  is ever selected.
- **URL.** Home stays at `/home` and the garden is not in the URL. Record links keep `/home/:id`
  and only visit. Switching from the chip writes the store and stays on Home.
- **Who reads it.** Home and the chip; Submit Work as the last fallback after a promise link, a
  resumed draft and navigation state, never overriding them; the offline scheduler's photo garden,
  active first and the viewed garden second; the two scoped sheets; Profile's list, to mark it.
- **Who never reads it.** The job queue, draft records, promise links and submission payloads,
  which carry their own garden address, and every permission check, which keeps reading the garden
  on the record or route. A write always takes its garden from the thing being acted on.
- **Proof.** Pure resolver tests for zero, one, several, stored-eligible, stored-stale,
  cached-while-loading, error-without-cache and an account switch; a controller test for the
  precedence order; an offline policy test; Home rendering for the five states; locale coverage;
  a mock-auth walk, with queue and offline behaviour recorded as authenticated proof pending.

## Open after the first slice

- Whether the About row stays at the end of Home, moves into the switcher, or returns to header
  icons; the lab draws all three.
- Whether a garden with strong photos earns the featured card over the rows.
- Whether the arrival toast keeps any branch once Home shows drafts and uploads.
- Whether the cockpit and the app should share one memory of the last garden; they keep separate
  keys for now.
