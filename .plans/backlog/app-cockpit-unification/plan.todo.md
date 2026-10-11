# One Look for the App and the Cockpit Plan

**Feature Slug:** `app-cockpit-unification`
**Stage:** backlog
**Status:** DESIGN REVIEW — picks accepted in principle; no implementation authorized
**Created / Last Updated:** 2026-10-10

The stated direction is in [brief.md](brief.md); the evidence, requirements and open decisions are
in [spec.md](spec.md). [status.json](status.json) owns lane state. This plan creates no Linear
record. The maintainer asked for the work to be tracked under the Cosmo-Local project; create that
record through the plan skill's start gate once the forks are decided. No implementation task has
been dispatched.

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
      keep (pills, 12px cards, the tone pill, inline filters, tones, density).
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
| 7. Cards, rows and list gap (F7, F11) | `ui` | One card surface; the work-item row on phones; an 8px list gap token. | Rendered pairs of every list at every width; a visible card edge in both themes. |
| 8. Wide desktop work card (F12) | `ui` | The cockpit's desktop work card lies wide with its mosaic on the left; the grid's column rule follows. | Mosaic variants for no photo, one, two and three or more photos; phone widths unaffected. |
| 9. Phone sheets (F5) | `ui` | The cockpit's phone sheet takes the shared surface, grip and header. Its centred desktop dialog does not change. | Sheet open, close, focus return and Back unchanged. |
| 10. Fields (F3 fields) | `ui` | Outlined fields by default on both surfaces, with one label and message anatomy. Neither bottom bar changes (the F6 pick). | Field message lines do not move layout, checked with the longest Spanish and Portuguese messages. |
| 11. Empty, loading and error states | `ui` | One anatomy in two sizes, set by each surface's density. | Every state keeps its copy and its actions on both surfaces; rendered pairs of each state. |
| 12. Garden context chip in the app | `ui` | Render the shared `GardenChip` on the app's density. Waits on the Home decision in the PWA simplification hub. | Selection behaviour owned by that hub; this step proves only the shared look. |
| 13. Guides and gates | `ui` | Decision-log rows, including the retired Material 3 rule; the token version and generated design files; Storybook parity numbers; both surface guides and both prompt contracts, with the cockpit's rewritten around the app's language; the glass spec retired from the design guide; the vocabulary list. The cockpit's Material-named tokens keep their names. | The design checks and the documentation generator pass. |
| 14. Acceptance | `qa_pass_1`, then `qa_pass_2` | User-facing review, then an independent regression review. | Criteria in [eval.md](eval.md), with fresh receipts for the changed surfaces. |

Steps 1 to 3 are token edits and can land alone. Steps 4 to 11 are the shared chrome recipes and
depend on steps 1 to 3 only for their final look, not for their structure. Step 12 depends on
another hub. Step 13 travels with whichever step changes a pinned number. No contract, indexer or
data lane is needed; a discovered need returns to scope review.

The maintainer's aim is to land as much of this sequence as fits before the Cosmo-Local
demonstration. The order above is the order to attempt it in: the token steps first, then the chrome
recipes. No step is authorized yet, and each waits on its approved pair.

## Requirements coverage

| Requirement | Planned steps |
|---|---|
| R1 no layout or flow change | Every step; checked in step 14 |
| R2 one product | 1 to 11 |
| R3 a dialect per surface | 1 to 11, by leaving the dials alone |
| R4 shared elements through tokens | 3 to 12 |
| R5 the accepted forks F7 to F13 | 2, 4 to 8 |
| R6 contrast and focus | 2, 3 |
| R7 three-language widths | 1, 5 |
| R8 tracked under the Cosmo-Local project | Start gate, before step 1 |

## Execution rules

- Re-read the nearest package guides, both surface design guides and the decision log before work.
- Change a number in one place. A token edit carries its guide, its generated files and its guards
  in the same change.
- Show a rendered pair of the real components against `develop` before rolling a rule across pages,
  and cover every sibling page at every width in the first pass.
- Never restyle a shared piece from the cockpit; move the token (DL-031).
- Keep the public website on its own dialect. Scope every app token change to the app presentation.
- For a token or style change, the proof is a rendered pair plus the guards. State that proof limit
  explicitly in the lane handoff; it does not waive behaviour proof where a component's structure
  changes (tabs, the work card, the cockpit's phone sheet, empty states).
- Create lane handoffs when the hub moves to active. Keep branches null until work is authorized.

## Planning validation

The hub-only check is `node scripts/harness/plan-hub.mjs validate`. The results of that check, the
Markdown link check and the render check of the lab are recorded in
[eval.md](eval.md#hub-creation-check). Application tests are not applicable to creating this hub.
