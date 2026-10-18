# One Look for the App and the Cockpit Plan

**Feature Slug:** `app-cockpit-unification`
**Stage:** backlog
**Status:** DESIGN REVIEW — picks accepted in principle; no implementation authorized
**Created / Last Updated:** 2026-10-10 / 2026-10-17
**Linear Issue:** PRD-1266
**Linear Source:** source:plans

The stated direction is in [brief.md](brief.md); the evidence, requirements and open decisions are
in [spec.md](spec.md). [status.json](status.json) owns lane state. Linear mirrors this plan for
visibility: the parent issue PRD-1266 sits in the active release project, with one sub-issue per
delivery step, listed under the sequence below. This plan stays the execution truth. No
implementation task has been dispatched.

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
- [ ] Rewrite the cockpit's guide and prompt contract around the app's language (step 13).
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
- [ ] Measure the typeface change in English, Spanish and Portuguese at 320 to 390px.
- [ ] Re-run the contrast audits on the accepted ground and dark ladder.
- [ ] Approve the first slice and promote the hub only when execution is authorized.

The picks were made in the lab in [artifacts](artifacts/README.md) and handed over with its Copy
picks control. They are direction, accepted in principle. The lab remains a mock, and nothing chosen
there is a specification until its pair is approved.

## Conditional delivery sequence

These steps describe future work. They are not authorization to start it. Each depends on its fork
being accepted. Select exact files and focused checks from the then-current owning code before each
bounded change, and split a step that would mix independent behaviours.

| Step | Lane | Work and likely owners | Completion evidence |
|---|---|---|---|
| 1. Typeface and type roles (F1) | `ui` | One family on both surfaces: the app's font links, its `index.css`, the static loading screen. One set of role names (title, body, label, meta) at each surface's sizes. | Width pairs in three languages at phone widths; the typography and loading-screen guards pass with updated expectations; no Material role name left in the cockpit's views. |
| 2. Ground and dark ladder (F2, F13) | `ui` | App-scope surface tokens and one dark ladder in Shared `theme.css`; the cockpit's dark card step. | Contrast audit on the new ground; rendered pairs in light and dark; the public website unchanged. |
| 3. Control boundary and focus role (F3, part) | `ui` | A 3:1 outline token for secondary buttons, chips and fields; one focus-ring role, with the app's ring in its own green. | Measured ratios in both themes; focus ring visible on every control family. |
| 4. Count badge (F10) | `ui` | One badge recipe in Shared; the app's bar, launchers, filter count and tabs and the cockpit's tab rail consume it. | Every consumer renders the same badge; counts above 9 and 99 still fit. |
| 5. Tabs (F8) | `ui` | The cockpit's tab rail takes the equal-width tinted layout and the shared badge. | Rendered pairs of every tab row at phone, tablet and desktop widths in three languages. |
| 6. Chips (F4) | `ui` | Capsule chips with one selected treatment in the cockpit's filter row. The filter control keeps its form on each surface (the F9 pick). | One chip shape on both; DL-082 scopes unchanged; keyboard and screen-reader paths unchanged. |
| 7. Cards, rows and list gap (F7, F11) | `ui` | The app's card as the one card surface (24px, a visible edge, a faint shadow) in place of the five card primitives; the shared item row in the app's work-row style (16px, the 2px status edge), first used by the work item on phones on both surfaces, with its detail line kept to one line by the spec's detail-line rules; a 12px list gap token. | Rendered pairs of every list at every width; a visible card edge in both themes; no detail line wraps at 320, 360 or 390px in English, Spanish or Portuguese. |
| 8. Wide desktop work card (F12) | `ui` | The cockpit's desktop work card lies wide with its mosaic on the left, as the first use of the shared media card; the grid's column rule follows. | Mosaic variants for no photo, one, two and three or more photos; phone widths unaffected. |
| 9. Phone sheets (F5) | `ui` | The cockpit's phone sheet takes the shared surface, grip and header. Its centred desktop dialog does not change. | Sheet open, close, focus return and Back unchanged. |
| 10. Fields (F3 fields) | `ui` | Outlined fields by default on both surfaces, with one label and message anatomy. | Field message lines do not move layout, checked with the longest Spanish and Portuguese messages. |
| 11. Empty, loading and error states | `ui` | The shared state block: one anatomy in two sizes, set by each surface's density, grown from the shared `EmptyState`. The app's own `EmptyState` and the local state cards move onto it. | Every state keeps its copy and its actions on both surfaces; rendered pairs of each state. |
| 12. Garden context chip in the app | `ui` | Render the shared `GardenChip` on the app's density. Waits on the Home decision in the PWA simplification hub. | Selection behaviour owned by that hub; this step proves only the shared look. |
| 13. Guides and gates | `ui` | Decision-log rows, including the retired Material 3 rule; the token version and generated design files; Storybook parity numbers; both surface guides and both prompt contracts, with the cockpit's rewritten around the app's language; the glass spec retired from the design guide; the vocabulary list. The cockpit's Material-named tokens keep their names. | The design checks and the documentation generator pass. |
| 14. Fact rows | `ui` | One shared fact row, a label and its value with an optional action, in place of about eleven local label-and-value rows on both surfaces, the cockpit's two `ReviewRow`s among them. | Every review, detail and settings screen that lists facts renders the shared row; rendered pairs of each. |
| 15. Commitment cards | `ui` | The app's five commitment rows and cards and the cockpit's pool rows move onto the item row, with the act phase line and queue states as the object's own parts. Commitments get one home. | Rendered pairs of every commitment list in both surfaces, in every act phase and queue state. |
| 16. Pickers and record cards | `ui` | One action picker for both surfaces; assessment and hypercert record cards on the item row; the app's garden card as a media card. | Picking an action works the same by pointer and keyboard on both surfaces; rendered pairs of each list. |
| 17. People rows | `ui` | Member, funder and claimant rows on the item row with an avatar, each name through the shared address display. | Rendered pairs of every people list; names resolve as they do today. |
| 18. Jar and vault cards | `ui` | The app's and the cockpit's jar, deposit and position cards on the item row or media card. The public site's cards stay editorial. | Rendered pairs of every jar and vault list in the app and the cockpit; amounts and assets read as they do today. |
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
