# One Look for the App and the Cockpit Plan

**Feature Slug:** `app-cockpit-unification`
**Stage:** backlog
**Status:** DESIGN REVIEW — no implementation authorized
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
- [ ] Resolve the thirteen forks in the specification; record each acceptance explicitly.
- [ ] Decide the F9 judgment point: whether Pending and Approved stay inline in the cockpit.
- [ ] For each accepted fork, render a before and after pair of the real components before rollout.
- [ ] Measure the typeface change in English, Spanish and Portuguese at 320 to 390px.
- [ ] Re-run the contrast audits on the accepted ground and dark ladder.
- [ ] Approve the first slice and promote the hub only when execution is authorized.

The lab in [artifacts](artifacts/README.md) is an exploratory input. A preset chosen there is not an
acceptance decision.

## Conditional delivery sequence

These steps describe future work. They are not authorization to start it. Each depends on its fork
being accepted. Select exact files and focused checks from the then-current owning code before each
bounded change, and split a step that would mix independent behaviours.

| Step | Lane | Work and likely owners | Completion evidence |
|---|---|---|---|
| 1. Typeface (F1) | `ui` | One family on both surfaces: the app's font links, its `index.css`, the static loading screen. | Width pairs in three languages at phone widths; the typography and loading-screen guards pass with updated expectations. |
| 2. Ground and dark ladder (F2, F13) | `ui` | App-scope surface tokens and one dark ladder in Shared `theme.css`; the cockpit's dark card step. | Contrast audit on the new ground; rendered pairs in light and dark; the public website unchanged. |
| 3. Control boundary and focus role (F3, part) | `ui` | A 3:1 outline token for secondary buttons, chips and fields; one focus-ring role. | Measured ratios in both themes; focus ring visible on every control family. |
| 4. Count badge (F10) | `ui` | One badge recipe in Shared; the app's bar, launchers, filter count and tabs and the cockpit's tab rail consume it. | Every consumer renders the same badge; counts above 9 and 99 still fit. |
| 5. Tabs (F8) | `ui` | The cockpit's tab rail takes the equal-width tinted layout and the shared badge. | Rendered pairs of every tab row at phone, tablet and desktop widths in three languages. |
| 6. Chips and filter control (F4, F9) | `ui` | Capsule chips in the cockpit; the filter button and its sheet or popover. | DL-082 scopes still reachable; keyboard and screen-reader paths; the F9 judgment point recorded. |
| 7. Cards, rows and lists (F7, F11, F12) | `ui` | One card surface; the work-item row; the list gap token; the wide desktop work card. | Rendered pairs of every list at every width; mosaic variants for one, two and three or more photos. |
| 8. Sheets, fields and the bar (F5, F3 fields, F6) | `ui` | The cockpit's phone sheet surface and header; outlined fields by default; the active pill in the app's bar. | Sheet open, close and focus return unchanged; field message lines do not move layout. |
| 9. Garden context chip in the app | `ui` | Render the shared `GardenChip` on the app's density. Waits on the Home decision in the PWA simplification hub. | Selection behaviour owned by that hub; this step proves only the shared look. |
| 10. Guides and gates | `ui` | Decision-log rows, the token version and generated design files, Storybook parity numbers, both surface guides, both prompt contracts, the vocabulary list. | The design checks and the documentation generator pass. |
| 11. Acceptance | `qa_pass_1`, then `qa_pass_2` | User-facing review, then an independent regression review. | Criteria in [eval.md](eval.md), with fresh receipts for the changed surfaces. |

Steps 1 to 3 are token edits and can land alone. Steps 4 to 8 are the shared chrome recipes and
depend on steps 1 to 3 only for their final look, not for their structure. Step 9 depends on another
hub. Step 10 travels with whichever step changes a pinned number. No contract, indexer or data lane
is needed; a discovered need returns to scope review.

## Requirements coverage

| Requirement | Planned steps |
|---|---|
| R1 no layout or flow change | Every step; checked in step 11 |
| R2 one product | 1 to 8 |
| R3 a dialect per surface | 1 to 8, by leaving the dials alone |
| R4 shared elements through tokens | 3 to 9 |
| R5 the accepted forks F7 to F13 | 2, 4 to 7 |
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
  changes (tabs, the filter control, the work card).
- Create lane handoffs when the hub moves to active. Keep branches null until work is authorized.

## Planning validation

The hub-only check is `node scripts/harness/plan-hub.mjs validate`. The results of that check, the
Markdown link check and the render check of the lab are recorded in
[eval.md](eval.md#hub-creation-check). Application tests are not applicable to creating this hub.
