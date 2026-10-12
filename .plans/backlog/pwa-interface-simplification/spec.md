# PWA Interface Simplification — Specification

**Status:** design proposal; confirmed direction is separated from proposed behavior below.
**Evidence date:** 2026-10-06. Code references describe the inspected working tree, not a deployment
certification. Recheck them when implementation starts, particularly where concurrent work lands.

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
step, not the accepted final composition. A new credits tab and a separate role-specific navigation
system are outside this proposal.

## Sheets and deeper destinations

- Keep Wallet, Promises, and Your Work one tap away in the header. Wallet remains account-wide;
  proposed garden filters for the other sheets must be explicit and reversible.
- Home activity and participation previews open an appropriate scoped list or existing detail.
  Do not create a second version of the Work or Promises workflow solely for Home.
- Proposed **About garden** access retains garden information, Gardeners, Insights, share, and
  relevant existing controls. Decide where notifications and governance belong before removing
  their current entry points.
- Proposed **Manage** access groups permitted reviews, join requests, and garden operations.
  Reuse existing Endowment and Cookie Jar sheets; do not rewrite their transactions. Preserve an
  understandable Endowment route for qualifying non-steward depositors.
- Keep full work and promise details on their existing detail surfaces where appropriate. Avoid
  chains of nested sheets; close/back must restore the launching context and scroll position.
- Keep existing device-local badge semantics from DL-061. A preview or management count must not
  silently redefine the header badge or imply that submitted work still needs uploading.

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
for review”, “Take part”, and “Change garden”. Final labels must be reconciled with existing i18n
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
new CLC capability, credit UI, Community app, or contract deployment.

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

## Decisions to resolve

1. **Composition:** compact journal or featured activity; how much activity fits before unfinished
   work becomes hard to find? Recommendation: compact journal with a bounded preview.
2. **Personal scope:** should Promises and Your Work open filtered to this garden or across all of
   the member's gardens? Recommendation: retain account-wide personal sheets initially, clearly
   label garden context, and use scoped entry points from Home sections. Test for confusion.
3. **Garden operations:** accept the conditional management entry, and choose discoverable homes
   for Endowment, governance, notifications, sharing, Gardeners, and Insights. Preserve actual
   capability access, including non-steward depositors.
4. **First delivery boundary:** homepage/context first, then submission-entry continuity, or one
   combined release? Recommendation: design the whole journey together and deliver bounded slices
   after the first slice works coherently on its own.

A future implementation scope lock must also settle selection persistence, direct-link behavior,
and any conflict between role descriptions and current capability predicates. Do not resolve a
policy conflict by broadening access in a UI change.
