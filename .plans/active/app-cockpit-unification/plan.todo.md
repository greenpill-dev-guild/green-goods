# One Look for the App and the Cockpit Plan

**Feature Slug:** `app-cockpit-unification`
**Stage:** active
**Status:** ACTIVE: step 1's face and both halves of the type roles merged on 21 to 23 October, and the faces are served and precached; steps 1 to 3 merged on 23 October (#1197; #1191 and #1193; #1195 and #1196), with the installed-app Brave proof still pending; step 4's count badge was approved on its pair on 23 October and is in progress; each later slice starts on its approved pair
**Created / Last Updated:** 2026-10-10 / 2026-10-23
**Linear Issue:** PRD-1266
**Linear Source:** source:plans

The stated direction is in [brief.md](brief.md); the evidence, requirements and open decisions are
in [spec.md](spec.md). [status.json](status.json) owns lane state. Linear mirrors this plan for
visibility: the parent issue PRD-1266 sits in the active release project, with one sub-issue per
delivery step, listed under the sequence below. This plan stays the execution truth. Steps 1 to
3 were approved on 21 October ([spec.md](spec.md#token-slices-approved-21-october)).

## Design gate

- [x] Record the maintainer's stated direction separately from recommendations.
- [x] Read the three design guides, the locked decisions and the owning components.
- [x] Capture both surfaces from Storybook and label the evidence class.
- [x] Build a switchable mock of every fork on the app, the cockpit phone and the cockpit desktop.
- [x] Bound this hub against the garden-scoped Home, the public website and the cockpit's layouts.
- [x] Record the maintainer's pick for each fork and the workspace tone as accepted in principle.
- [x] Decide how the cockpit's Material 3 rule reads: retired.
- [x] F9 judgment point: the pick keeps Pending and Approved inline in the cockpit.
- [x] Confirm the F9 pick against the earlier stated preference for the app's filter button.
- [x] Say what the cockpit keeps as its own now that Material 3 no longer decides it: what the picks
      keep (pills, the tone pill, inline filters, tones, density; the 12px card went with the
      revised F7 on 17 October).
- [x] Decide what happens to the cockpit's Material-named token layer: the names stay, and one
      changes only if a step has to touch it.
- [x] Set the user round: after slices land, as follow-up input. It gates nothing.
- [ ] Rewrite the cockpit's guide and prompt contract around the app's language (step 13). Drafted
      for review on 2026-10-20; each part lands with the slice that makes it true.
- [x] Record the four changes without a fork as accepted in principle: the focus ring, the empty,
      loading and error anatomy, the type role names, and the glass spec.
- [x] Set what a pair must show: the lab's ten screens at 390, 768 and 1280px, in light and dark,
      in three languages where text must fit.
- [x] Record the timing aim: as much of the sequence as fits before the Cosmo-Local demonstration.
      This is an aim, not an authorization.
- [x] File the Linear parent and one sub-issue per delivery step in the active release project.
- [x] Set the card model, the future of the cockpit's controls, the folder rule and where the
      consolidation is tracked (17 October).
- [ ] Lock each pick: render that pair from the real components and get it approved before rollout.
      Steps 1 to 3 rendered on 2026-10-20 ([eval.md](eval.md#design-gate-for-the-token-slices))
      and approved on 2026-10-21; step 4 rendered and approved on 2026-10-23
      ([eval.md](eval.md#design-gate-for-the-count-badge)).
- [x] Measure the typeface change in English, Spanish and Portuguese at 320 to 390px (2026-10-20).
- [x] Re-run the contrast audits on the accepted ground and dark ladder (2026-10-20).
- [x] Approve the first slice and promote the hub only when execution is authorized (the token
      slices, 2026-10-21).

The picks were made in the lab in [artifacts](artifacts/README.md) and handed over with its Copy
picks control. They are direction, accepted in principle. The lab remains a mock, and nothing chosen
there is a specification until its pair is approved.

## Conditional delivery sequence

These steps describe future work. They are not authorization to start it. Each depends on its fork
being accepted. Select exact files and focused checks from the then-current owning code before each
bounded change, and split a step that would mix independent behaviours.

| Step | Lane | Work and likely owners | Completion evidence |
|---|---|---|---|
| 1. Typeface and type roles (F1) | `ui` | One family on both surfaces: the app's font links, its `index.css`, the static loading screen. One set of role names (title, body, label, meta) at each surface's sizes. The face merged as #1172 and the cockpit's roles as #1175, with their guide wording in #1176 (21 and 22 October); the shared components' roles as #1188, with theirs in #1187 (23 October). #1190 served and precached the faces (the offline face from #1172's review); #1197, the vietnamese subset it left out, finished the step's code on 23 October. | Width pairs in three languages at phone widths; the typography and loading-screen guards pass with updated expectations; no Material role name left in the cockpit's views; for the offline face, RED/GREEN proof and labeled authenticated Brave proof that an installed app's first launch with no network draws Plus Jakarta Sans. |
| 2. Ground and dark ladder (F2, F13) | `ui` | App-scope surface tokens and one dark ladder in Shared `theme.css`; the cockpit's dark card step. With them (21 October): the dark text lifts, the error action fill on the cockpit's error screen, the app's tab row and garden title block on their ground, and the status bar and manifest per presentation. Merged as #1191 with its guides #1193 (23 October). | Contrast audit on the new ground; rendered pairs in light and dark; the public website unchanged. |
| 3. Control boundary and focus role (F3, part) | `ui` | A 3:1 outline token for secondary buttons, chips and fields; one focus-ring role, with the app's ring in its own green, drawn as a solid 2px ring in place of the halo; the app's button labels at weight 500 (21 October). Merged as #1195 with its guides #1196 (23 October). | Measured ratios in both themes; focus ring visible on every control family. |
| 4. Count badge (F10) | `ui` | One badge recipe in Shared; the app's bar, launchers, filter count and tabs, a garden's notification bell, and the cockpit's tab rail consume it. Approved on 23 October with the bar's 9+, the tone's accent on every cockpit tab, and the unused `TabBadge` removed ([spec.md](spec.md#count-badge-approved-23-october)). | Every consumer renders the same badge; counts above 9 and 99 still fit. |
| 5. Tabs (F8) | `ui` | The cockpit's tab rail takes the equal-width tinted layout and the shared badge. From 640px the row is at most 180px per tab and aligns left, and a cell whose content needs more takes it (Spanish "Configuración de medios", 191px). On phones it fills the width, and a row that cannot hold its cells scrolls: option 1, a measured deviation from the pick that DL-100 records, taken on 23 October for the maintainer's review after merge. | Rendered pairs of every tab row at phone, tablet and desktop widths in three languages. |
| 6. Chips (F4) | `ui` | Capsule chips with one selected treatment in the cockpit's filter row. The filter control keeps its form on each surface (the F9 pick). Built on 23 October: `AdminFilterChip` as a capsule that selects in the workspace tone's action pair, and `AdminInputChip` as a capsule beside it (DL-101). | One chip shape on both; DL-082 scopes unchanged; keyboard and screen-reader paths unchanged. |
| 7. Cards, rows and list gap (F7, F11) | `ui` | The app's card as the one card surface (24px, a visible edge, a faint shadow) in place of the five card primitives; the shared item row in the app's work-row style (16px corner, the 2px status edge) as locked on 18 October: card titles 15px in the app and 13px in the cockpit, card details and labels 11px (moved here from step 1 on 21 October), one 88px height, an 88px photo or a lead icon tile, a one-line title, the status pill under the title, one detail line by the spec's detail-line rules, and the row's one action in its right slot; first used by the work item on phones on both surfaces, the cockpit's phone queue included (a steward who sorts by photo checks it on the pair); a 12px list gap token. | Rendered pairs of every list at every width; a visible card edge in both themes; every row in a list one height; no detail line wraps at 320, 360 or 390px in English, Spanish or Portuguese. |
| 8. Wide desktop work card (F12) | `ui` | The cockpit's desktop work card lies wide with its mosaic on the left, as the first use of the shared media card; the grid's column rule follows. | Mosaic variants for no photo, one, two and three or more photos; phone widths unaffected. |
| 9. Phone sheets (F5) | `ui` | The cockpit's phone sheet takes the shared surface, grip and header. Its centred desktop dialog does not change. | Sheet open, close, focus return and Back unchanged. |
| 10. Fields (F3 fields) | `ui` | Outlined fields by default on both surfaces, with one label and message anatomy; the message slot reserves two lines on both surfaces (DL-018 in the app; DL-105 in the cockpit, where 6 of the 32 messages under side-by-side fields wrap at 640px), and a longer message grows it. Its code, which retires the filled field (DL-105), is #1229. | Field message lines do not move layout on either surface, each reserving two lines, checked with the longest Spanish and Portuguese messages in two-column forms at 640px. |
| 11. Empty, loading and error states | `ui` | The shared state block: one anatomy in two sizes, set by each surface's density, grown from the shared `EmptyState`. The app's own `EmptyState` and the local state cards move onto it. An empty list or a failed page takes the full size with an icon tile. | Every state keeps its copy and its actions on both surfaces; rendered pairs of each state. |
| 12. Garden context chip in the app | `ui` | Render the shared `GardenChip` on the app's density. Waits on the Home decision in the PWA simplification hub. | Selection behaviour owned by that hub; this step proves only the shared look. |
| 13. Guides and gates | `ui` | Decision-log rows, including the retired Material 3 rule; the token version and generated design files; Storybook parity numbers; both surface guides and both prompt contracts, with the cockpit's rewritten around the app's language; the glass spec retired from the design guide; the vocabulary list. The cockpit's Material-named tokens keep their names. | The design checks and the documentation generator pass. |
| 14. Fact rows | `ui` | One shared fact row, a label beside its value in divided rows, with an optional action, in place of about eleven local label-and-value rows on both surfaces, the cockpit's two `ReviewRow`s among them. | Every review, detail and settings screen that lists facts renders the shared row; rendered pairs of each. |
| 15. Commitment cards | `ui` | The app's five commitment rows and cards and the cockpit's pool rows move onto the item row, led by the offer or request icon, with "Confirming…" and "Not sent" shown in the status pill, with the act phase line and queue states as the object's own parts. Commitments get one home. | Rendered pairs of every commitment list in both surfaces, in every act phase and queue state. |
| 16. Pickers and record cards | `ui` | One action picker for both surfaces, built from media cards with a banner; assessment and hypercert record cards on the item row; the app's garden card as a media card. | Picking an action works the same by pointer and keyboard on both surfaces; rendered pairs of each list. |
| 17. People rows | `ui` | Member, funder and claimant rows on the item row with an avatar, one role chip and one count, each name through the shared address display. | Rendered pairs of every people list; names resolve as they do today. |
| 18. Jar and vault cards | `ui` | The app's and the cockpit's jar, deposit and position cards on the item row with one detail and no action on the row; they have no picture of their own, so no media card. The public site's cards stay editorial. | Rendered pairs of every jar and vault list in the app and the cockpit; amounts and assets read as they do today. |
| 19. Unused card code | `ui` | Remove Shared's unused card exports (`CardBase`, its own `Card`, `StatCard`, `ProposalCardConviction`, `SortSelect`, `ListToolbar`) and `Surface`'s glass tiers once nothing renders them; rename the app's wrapper cards that share a Shared card's name. | No export without a consumer or a recorded reason; no two card components share a name. |
| 20. Cockpit controls onto the shared family | `ui` | Phased, one family at a time: buttons and icon buttons; fields, checkboxes and chips; dialogs and sheets; cards and tabs. Each phase retires its `Admin*` files, rewrites the matching part of Rules 15 and 18, and turns the design token check's wrapper-adoption sweep around. Split into one issue per phase when scheduled. | Each phase: the cockpit renders only the shared family for its controls; density, hit areas and pill corners unchanged; the design checks pass. |
| 21. Bottom bar active state (F6) | `ui` | The app's bottom bar shows its active tab with a green pill behind the icon, the cockpit's recipe; each bar keeps its chrome, and the app's bar stays solid. | Rendered pairs of both bars in light and dark; labels, count badges and focus unchanged. |
| 22. Acceptance | `qa_pass_1`, then `qa_pass_2` | User-facing review, then an independent regression review. | Criteria in [eval.md](eval.md), with fresh receipts for the changed surfaces. |

Steps 1 to 3 are token edits and can land alone. Steps 4 to 11 are the shared chrome recipes and
depend on steps 1 to 3 only for their final look, not for their structure. Step 12 depends on
another hub. Step 13 travels with whichever step changes a pinned number. Steps 14 to 19 build each
remaining object's cards from the four shapes, so they follow steps 7, 8 and 11, which create the
card surface, the item row, the media card and the state block. Each sets its object's detail line
by the spec's detail-line rules. Step 20 comes after the card work.
Step 21 is a chrome recipe like steps 4 to 11 and can land with them. No contract,
indexer or data lane is needed; a discovered need returns to scope review.

The maintainer's aim is to land as much of this sequence as fits before the Cosmo-Local
demonstration. The order above is the order to attempt it in: the token steps first, then the chrome
recipes. No step is authorized yet, and each waits on its approved pair. The release project admits
each finished step to its release at the QA gate, or defers it.

**Linear sub-issues.** Each step from 1 to 21 has its own sub-issue under PRD-1266. Steps 1 to 13
are PRD-1267 to PRD-1279 in order. Steps 14 to 20 are PRD-1280, PRD-1281, PRD-1283, PRD-1284,
PRD-1285, PRD-1286 and PRD-1287; PRD-1282 belongs to other work. Step 21 is PRD-1288. Step 12 is blocked by RESR-93,
the PWA simplification scope decision. Acceptance runs under the parent. PRD-1261, the bounded pass
that aligns the member promise and work journey with its steward review, applies the accepted
direction to those journeys and is tracked separately.

## Requirements coverage

| Requirement | Planned steps |
|---|---|
| R1 no layout or flow change | Every step; checked in step 22 |
| R2 one product | 1 to 11, 21 |
| R3 a dialect per surface | 1 to 11, by leaving the dials alone |
| R4 shared elements through tokens | 3 to 12 |
| R5 the accepted forks F7 to F13 | 2, 4 to 8 |
| R6 contrast and focus | 2, 3 |
| R7 three-language widths | 1, 5 |
| R8 tracked in Linear | Done: PRD-1266 and its sub-issues |
| R9 cards from four shared shapes, one home per object | 7, 8, 11, 14 to 19 |
| R10 the cockpit renders the shared controls | 20 |

## Execution rules

- Re-read the nearest package guides, both surface design guides and the decision log before work.
- Change a number in one place. A token edit carries its guide, its generated files and its guards
  in the same change.
- Show a rendered pair of the real components against `develop` before rolling a rule across pages,
  and cover every sibling page at every width in the first pass.
- Never restyle a shared piece from the cockpit; move the token (DL-031).
- Build an object's card from the four shared shapes. A new card needs a product reason, as the
  architecture guide already requires.
- Move an object's files with the step that consolidates it, and give each object one home.
- Keep the public website on its own dialect. Scope every app token change to the app presentation.
- For a token or style change, the proof is a rendered pair plus the guards. State that proof limit
  explicitly in the lane handoff; it does not waive behaviour proof where a component's structure
  changes (tabs, the work card, the cockpit's phone sheet, empty states).
- Create lane handoffs when the hub moves to active. Keep branches null until work is authorized.

## Planning validation

The hub-only check is `node scripts/harness/plan-hub.mjs validate`. The results of that check, the
Markdown link check and the render check of the lab are recorded in
[eval.md](eval.md#hub-creation-check). Application tests are not applicable to creating this hub.

## Implementation Notes

**Step 1 (21 and 22 October).** Step 1 has taken three pull requests so far, not the planned two.
The face (#1172) and the cockpit's type roles (#1175) merged, and so did their guide wording
(#1176), which review split out because `packages/admin/AGENTS.md` keeps the standards and the
code they govern apart; it merged first. The shared components' roles and the offline face, which
#1172's review raised, are still to come. The four role names, title,
body, label and meta, became eight `type-*` roles plus `type-field` for field text. The prefix is
there because the Material `text-label-sm` already meant 14px in the app and 11px in the cockpit.
The card title and card detail sizes locked on 18 October move to the card step (step 7), as the
maintainer chose on 21 October, and so do the three texts the face newly ends in an ellipsis at
320px, which step 7's detail-line rules cover. [handoffs/claude-ui.md](handoffs/claude-ui.md) lists what landed
and what remains.

**Step 1 (23 October).** The shared components' roles merged as #1188, after their guide wording in
#1187. #1190, a startup and session pull request, then served Inter, Plus Jakarta Sans and Fraunces
from the app and precached the installed face, which was the offline face #1172's review asked
for, so the open #1189 conflicts with `develop` and would add a second copy of the faces. What
#1190 left out is the vietnamese subset (ẹ, ọ, ị, ụ in Yoruba and Igbo names); it lands with the
maintainer's call on #1189 (closed as superseded on 23 October) as #1197, and the offline face's
RED and GREEN record is in `status.json`.

**Step 2 (23 October).** The four drafts replayed onto `develop` and were finished on
`feature/app-cockpit-ground-ladder`: the status bar and the install manifest per presentation, read
from the DesignMD token export (`neutral-dark` is now the floor both surfaces paint), the app
stories on the app's canvas, and a re-certified seam fingerprint (#1191). The guide wording and
DL-097 are the standards-only #1193. [eval.md](eval.md#step-2-proof-ground-and-dark-ladder) records
the proof.

**Step 3 (23 October).** The draft replayed onto step 2 and gained one solid 2px focus ring, switched
on for the installed app and the cockpit only, so the website keeps its halo (#1195, stacked on
#1191). DL-098 is #1196, stacked on #1193. The
[UI handoff](handoffs/claude-ui.md#step-3-control-outline-and-focus-role-prd-1269) records the
measured ratios and the ring on each control family.

**Merges (23 October).** The five pull requests merged in the maintainer's order, each as a merge
commit on a green CI Gate: #1193, #1191, #1196, #1195, then #1197. The
[UI handoff](handoffs/claude-ui.md#lane) records each merge's commit and time. Still pending:
the labeled authenticated Brave proof for steps 1 and 2.

**Step 4 (23 October).** The design gate rendered every count before and after
([eval.md](eval.md#design-gate-for-the-count-badge)), and the maintainer approved the pairs with
all six recommendations the same day ([spec.md](spec.md#count-badge-approved-23-october)). The
code is on `feature/app-cockpit-count-badge`: Shared's `CountBadge` on the existing Badge export
and its `.gg-count-badge` rule, the eight components that drew a count moved onto it, root
`DESIGN.md`'s `count` type and Counts line, and the unused `TabBadge` removed. Its guide wording
and DL-099 are the standards-only `feature/app-cockpit-count-badge-guides`, which also adds the
count badge to the cockpit's tone budget in Rule 18. Raising Community's action fill to
orange-800 is not in the step; it gets its own pair.

**Step 5 (23 October).** The maintainer ruled that each slice merges once its CI is green and its
review threads are resolved, with the pairs reviewed afterwards. The code is on
`feature/app-cockpit-tabs`: `AdminTabRail` takes the app's equal-width tabs at the cockpit's 36px
height, with the tinted active cell, the underline and step 4's badge; from 640px each cell stops
at 180px unless its content needs more (Spanish "Configuración de medios", 191px), and the row
keeps to the left. At 320px the Hub, Actions and the protocol garden's
Community row cannot hold equal cells, so they scroll there as before. The orchestrator took that
rule (option 1 of three) for the maintainer's review after merge, and DL-100 records it as a
measured deviation from the pick. DL-100 and its guide lines are the standards-only
`feature/app-cockpit-tabs-guides` ([handoff](handoffs/claude-ui.md#step-5-tabs-prd-1271)).

**Step 6 (23 October).** `feature/app-cockpit-chips` makes the cockpit's chips capsules:
`AdminFilterChip` selects in the workspace tone's action pair, the app's selected look in the
cockpit's accent, with the filled controls' state layer beneath its label and its focus ring
drawn as the shared chip draws it, 2px off with the ground between; `AdminInputChip` takes the
capsule in its own commit. The pick was locked on 18 October, so the rendered pairs are
acceptance evidence ([eval.md](eval.md#step-6-proof-capsule-chips)). The guide wording and
DL-101, which makes a selected chip the tone's sixth use, are the standards-only
`feature/app-cockpit-chips-guides`. #1206, merged the same night, defined the beneath layer's
class and gave Storybook and the portals Community's amber ramp; its contrast guard now covers
the selected chip too.

**Step 7 (23 October).** `feature/app-cockpit-cards-rows` puts every card on the installed app's
card and every work item on Shared's new item row: `.gg-card` in Shared `theme.css` under the five
card primitives (their exports stay for step 19), `ItemRow` with its skeleton and stories, the card
title role (15px at 500 in the app, 13px at 600 in the cockpit) and `--gg-list-gap` (12px). The
work row, the app's pending and draft rows and the cockpit's phone queue render it. Every measured
row is 88px, and no detail line wraps or is cut at 320, 360 or 390px in English, Spanish or
Portuguese ([eval.md](eval.md#step-7-build-cards-rows-and-list-gap)); the pairs went to the
maintainer as a private artifact. DL-102 and the guide wording are the standards-only
`feature/app-cockpit-cards-rows-guides`. The
[UI handoff](handoffs/claude-ui.md#step-7-cards-rows-and-list-gap-prd-1273) lists six calls the
pairs raise.
**Step 9 (23 October).** Below 640px the cockpit's dialogs and its side sheet take the installed
app's bottom sheet: the shared sheet material and grip and the shared `SheetHeader` at their own
22px title, built from Shared's pieces (`SheetGrip`, one `[data-sheet-surface]` rule, a target line
in the header) and four cockpit tokens. Radix still opens, closes and dismisses them, and the
centered dialog from 640px does not change. The grip marks the sheet and does not drag it; whether
it should drag in the cockpit is still open. The code is on `feature/app-cockpit-phone-sheets`,
and DL-104 with its guide wording is the standards-only `feature/app-cockpit-phone-sheets-guides`;
[eval.md](eval.md#step-9-proof-phone-sheets) records the pairs and the behavior proof.

**Step 21 (23 October).** The installed app's bottom bar takes the cockpit's pill in its green on
`feature/app-cockpit-bar-pill`: a 56 × 32 pill of the new app-scoped `--primary-container` behind
the line icon in `--primary-container-foreground`, the active label in ink at weight 600, and every
tab holding the pill's width. The bar keeps its 69px, its chrome, its count badge and its focus
behavior, and the cockpit's bar is unchanged
([eval.md](eval.md#step-21-proof-the-bottom-bars-pill)). DL-107 and the guide wording are the
standards-only `feature/app-cockpit-bar-pill-guides`.

**Step 10 (23 October).** The cockpit's fields take the app's anatomy: the label above an outlined
box at the cockpit's 8px corner, and one shared message line under every field on both surfaces.
The measurement the plan called for settled the cockpit's reserve at two lines, as in the app: a
field in a two-column row at 640px is 290px wide, and 6 of the 32 messages under fields that share a
row wrap in English, Spanish and Portuguese ([eval.md](eval.md#step-10-proof-outlined-fields)). The
code is `feature/app-cockpit-outlined-fields`; DL-105 and its guide lines are the standards-only
`feature/app-cockpit-outlined-fields-guides`.

**Step 16 (24 October).** `feature/app-cockpit-pickers-records` gives both surfaces one action
picker, Shared's `ActionPicker`: media cards with the action's banner in one listbox with one
tab stop, a row that scrolls sideways in the app's Submit Work and a grid in the cockpit's. The
app's garden card is the shared media card with its banner (Home's list, a work's page, and Submit
Work's garden picker on the same listbox), and assessments and hypercerts are item rows on both
surfaces. The twenty states step 11 left in the hypercert and action screens take the state block.
DL-111 and its guide wording are the standards-only `feature/app-cockpit-pickers-records-guides`
([handoff](handoffs/claude-ui.md#step-16-pickers-and-record-cards-prd-1283)).
