# Claude design results: plant identification flow

**Date**: 2026-09-29  
**Artifact**: [artifacts/plant-identification-flow.html](../artifacts/plant-identification-flow.html) (one self-contained file; open it in any browser, no build, no network)  
**Screenshots**: [artifacts/screenshots/](../artifacts/screenshots/) (24 PNGs, 2.1 MB, captured at the device frame's real pixel size)  
**Check results**: [artifacts/eval-walk-results.json](../artifacts/eval-walk-results.json) (85 scripted checks) and [artifacts/axe-results.json](../artifacts/axe-results.json) (12 screens)  
**Published copy**: https://claude.ai/artifact/Wv1aaaL1X271h1YRkVAqiZ (private Claude artifact; the published file is the hub file without the document skeleton, which the artifact viewer adds itself)

## Rendered proof label

Isolated artifact. Engine: headless Chromium 148 driven by Playwright 1.60 from the repository's `node_modules` for the scripted walk, the axe pass and every screenshot; the Claude desktop built-in browser pane (Chromium) for interactive spot checks. Viewports: the 390 × 844 mobile frame and the 1100 × 780 desktop frame, both inside a 1400 × 1040 page. This is not authenticated gardener or installed-PWA proof, and no Storybook or CI Playwright story exists for it. The `browser-proof` check stays pending for the authenticated class; nothing here needs it because no production code changed.

The mock spent no credits and made no network request. Every score, taxon id, content hash and health condition is a synthetic UI example.

## Recommendation

Ship the **A+ overlay**: the compact card (plant name, scientific name, source line, Details and Change) plus one status row that appears only when it says something the name does not: a health suggestion on Survival Check and Maintenance, or "supports your existing entry" when a second photo joins a row. Compare `01-media-layout-a-guava.png`, `02c-media-layout-a-plus-tomato-health.png` and `02b-media-layout-b-tomato-health.png`.

Why not A alone: on the two health actions, Check health and Include end up a sheet away, and a paid, deliberate request should be visible where the photo is. Why not B: the expanded card covers 40 to 70 percent of a 4:3 photo on a phone once the health row is present, and its "Added to Species planted" line repeats what the plant name already says. A+ keeps B's only two informative rows and A's photo visibility. All three layouts share one behaviour; only the card changes.

Two secondary calls the artifact takes and the review should confirm:

- Removing an identification and removing a photo stay separate operations. An entry with the gardener's own amount or notes always survives either one; an empty generated entry goes with its photo, with a visible notice.
- A health suggestion becomes a note on the plant entry only when the gardener includes it, and the note text is editable. Nothing in the flow ticks Pest control or records a treatment.

## What the artifact does

Reviewer bar (outside the gardener experience): layout A / A+ / B, mobile 390 / desktop preview, action selector (the five launch actions plus Learning Reflection and Solar Site Setup as scope controls), online/offline, Reconnect, credits (with Set 0), Hold analyses / Complete held, metadata preview, recipes, Reset. State persists in `localStorage` (key `gg-plant-id-mock-v1`); Reset clears it. The page opens with one planting photo already taken and nothing identified, so the first view shows the Identify control.

Screens: Media (photo cards with independent preview, replace, remove and Identify controls; identifying, queued, suggested, ambiguous, no-plant, failed, credit-limit and photo-changed states; first-use explanation), plant disclosure sheet, Change sheet, Details (real fields from `agro.ts` plus editable plant rows per action), Review (publication reminder, pending-analysis notice, edit without losing state), saved work (gardener view, later results, attached updates, steward preview as a centered dialog on desktop and a bottom sheet on mobile), and the garden report concept (relationship filters, source filter, unallocated and unknown amounts, drill-through to the source work).

## Tested behaviour (eval.md walk)

All 85 scripted checks passed with zero page or console errors; axe (WCAG 2.1 A/AA plus best practice) reported no violations on 12 screens. Check names in the JSON start with the scenario code below.

| eval.md scenario | Result | Evidence |
|---|---|---|
| Planting success | Pass. Identify guava; overlay; Species planted fills; total, participants and per-species counts stay editable. | S1, `01`, `02`, `07` |
| Ambiguous identity | Pass. Three chips wait for a choice; Details and Review agree; the top guess stays as the original in the disclosure. | S3, `03`, `12` |
| Preserve measurements | Pass. Change to Strawberry guava keeps 8 seedlings and the note; editing the name field by hand keeps the amount and records the corrected taxon; typing the suggestion back restores it. | S1, S4b |
| Manual value conflict | Pass. Failed request, typed "Cashew", Try again suggests Mango: the overlay asks Keep or Use, nothing is overwritten. | S5, `04` |
| Duplicate evidence | Pass. A second guava photo supports the existing entry with the amount unchanged; Add as a separate entry still works. | S2 |
| Remove/replace photo | Pass. Removing asks first and lists what stays; an empty generated entry leaves with its photo, visibly; replacing bytes invalidates the analysis and flags the row with Keep / Remove / Identify again. | S6, `19` |
| Site assessment | Pass. Identification enters Existing plants; only Add to planting plan creates a Planned entry, measured against Planned Seedlings. | S7, `10` |
| Harvest | Pass. 12 kg with 8 kg tomato shows 4 kg unallocated; 13 kg is rejected and blocks Review; no Check health control. | S8, `09` |
| Optional health | Pass. Separate request and credit; possible issue shown as a suggestion; include, edit, remove; no activity or treatment inferred. | S9, `02b`, `02c`, `11` |
| Offline queue | Pass. Queued intent with Cancel; edits kept; Reconnect sends each queued request once; a second Reconnect sends nothing. | S10, `05` |
| Late result | Pass. Submit while queued; the snapshot has no plant rows; the result arrives as a labelled later result; Attach as a separate update creates a separate record and the snapshot stays byte-identical. | S11, `14` |
| Failure/credit limit | Pass. Failure and credit limit preserve the draft and spend nothing; opening the disclosure twice spends nothing. | S5, S12, `06`, `06b` |
| Action scope | Pass. Learning Reflection and Solar show no Identify; Planting and Harvest show no Check health; Survival and Maintenance do. | S8, S9, S13 |
| Review/saved work | Pass. Gardener view and steward preview list the same entries, amounts and photo links; approval needs a confidence level and leaves identity labelled as a suggestion. | S15, `13`, `15`, `16` |
| Report | Pass. Observed, planned, planted, checked, worked on and harvested stay separate; unallocated and unknown amounts are visible; the drill-through shows "Of 20 seedlings planted: Guava 8 + Mango 5 = 13 allocated · 7 unallocated". | S17, `17` |
| Privacy | Pass. First-use sheet, Review reminder, and a metadata preview that lists what is deliberately absent (key, token, retrieval id, private URLs, precise location, raw response). | S1, S11, `20` |

Accessibility and interaction checks beyond eval.md: every button has an accessible name and a 44 px target (visible box plus hit area); tab order on a photo card runs preview, replace, remove, then the overlay actions; sheets are `role="dialog"` with `aria-modal`, take focus on open, close on Escape, return focus to their trigger, and make the app inert behind them; asynchronous outcomes announce through one polite live region (errors through the alert region), mirrored in the reviewer bar's "Last announcement"; `prefers-reduced-motion` collapses every animation; `prefers-contrast: more` makes the light card solid.

Not measured: contrast of the thick material over the busiest stand-in photo was reviewed by eye only. The card is 88 percent linen with an 8 px blur; ink and stone text read clearly on every stand-in, but a photo with white highlights under the card would need a real check.

## Component mapping

Client, from `@green-goods/shared` and the client views the artifact mirrors:

| Mock piece | Existing primitive or view | Note |
|---|---|---|
| Photo card, preview, remove | `WorkMediaPhotoCard` (`data-pressable="media"` preview button, `IconButton` remove) | Add Identify as a sibling `Button` (`emphasis="secondary" size="compact"`, `RiLeafLine`) inside the card, never inside the preview button. "Replace photo" is a mock-only control; see Q4. |
| Light card | New: `PlantIdentificationCard` | Thick material tokens (`--color-material-thick`, `--blur-material-thick`), 12 px concentric corner, `role="group"` with a name per photo, tones from `pwaStatusStyles`. Solid under `prefers-contrast: more`. |
| Overlay statuses | `pwaStatusStyles` warning / information / error / success | Icon plus text every time; colour is never the only signal. |
| First-use, disclosure, Change, picker, remove-photo, attach-update | `DialogShell` (`sheetSize` compact / tall / full per DL-014) with `actions` through `SheetActions` (DL-016), `SheetHeading` in bodies; `ConfirmDialog` for remove photo | Below 640 px they render as `PwaSheet`; from 640 px as centered dialogs, which the desktop preview shows. |
| Suggestion chips, category tags, report filters | `Chip` (`aria-pressed`, or `role="radio"` inside a group) | |
| Suggestion radio rows | None exact | Closest are `ConfidenceSelector`'s radio chips or `ListPrimitives` rows with `role="radio"`; flagged as a primitive gap. |
| Fields | `FormInput`, `FormSelect`, `FormText`, `Switch` via `FormFieldWrapper` | The two-line hint slot and 16 px corner are kept. |
| Plant rows | `WorkRepeaterInput` pattern in `Details.tsx` | Extend a row with the origin line, evidence thumbnails, the health note block and the stale-photo notice; keep Add and Remove as secondary buttons. |
| Allocation line | `Alert`-style status with `role="status"` | Neutral, ok and error tones. |
| Review plants, saved work | `WorkView` details plus a new Plants section; `StatusBadge` for status | Publication reminder as `Alert variant="info"`. |
| Later result, attached update | New cards on the saved-work view | Depend on the update design (Q5). |
| Steward review | `AdminDialog size="lg" tone="garden"` hosting `MediaEvidence`, `SubmissionDetails`, `ReviewForm` | `renderMetadataDetails` in `helpers.tsx` needs a structured branch for `details.plants`; the mock's `adminPlant` block is the proposal. Status pills follow the `WorkDetailStatusBadge` pattern. |
| Garden report | None; future design | `Chip` filters, `NativeSelect`, a plain table. Numbers only from entered amounts. |
| Icons | Remixicon: `RiLeafLine`, `RiCloseLine`, `RiZoomInLine`, `RiCameraLine`, `RiCheckLine`, `RiErrorWarningLine`, `RiInformationLine`, `RiWifiOffLine`, `RiRefreshLine`, `RiHeartPulseLine`, `RiHistoryLine`, `RiScales3Line` | The artifact draws stroke approximations inline. |

Copy follows the gardener voice in the client contract (second person, concrete, no blame) and utility copy in the steward dialog. Strings are English only; production needs en, es and pt.

## Metadata proposal shown in the reviewer panel

`details.plants[]` (relationship, names, taxon reference when known, name origin, optional quantity with unit, notes, supporting identifications and photos, health observation with origin) and `plantIdentifications[]` (photo index and synthetic content hash, provider and product, synthetic model version, timestamps, suggestions with probabilities, selection with the original taxon or the manual name, health predictions with `includedByGardener`). Updates attached after submission are a separate list, never merged into the snapshot. The panel states what is deliberately absent. These shapes are for review, not a schema contract; the spec's integration notes about `work_metadata_v2`, the form schema and the encoder still apply.

## Questions for selection

1. Layout: A+ as recommended, or A or B as built?
2. Health: keep the note on the plant entry (as mocked), or hold health observations in their own list? Should a health-only check be allowed on a photo that has no plant entry yet? The mock requires an entry first.
3. Credits: the mock charges one credit for any completed response, including "no plant found" and ambiguous results, and none for a failed request. Confirm against the account's billing before copy promises anything.
4. Photo replacement: the app has remove and add, not replace. Is byte replacement a real flow (edit, crop, retake), or should the invalidation design apply only to crops?
5. Later results: the mock attaches an update as a separate record the steward sees under the submission. Who may attach (gardener only?), what the record is on chain or off chain, and whether reports count it.
6. Ambiguity rule: the fixture flags ambiguity by hand; production needs a calibrated threshold (for example top score under 0.5, or the gap to the second under 0.15) tuned on local photos.
7. Manual names: free text, as mocked, or matched against a species list when possible?
8. Report semantics: per-work allocation lines plus garden totals, with legacy works as "unknown", as mocked, or a different grouping?

## Limits and deliberate omissions

- Isolated mock: no authentication, PWA shell, service worker, upload, signing or attestation; Submit only stores a snapshot on the page. The Intro step, audio notes, video, HEIC pending tiles and the drafts sheet are not simulated.
- Light theme only; no dark mode. English only; no haptics.
- The camera and gallery are replaced by a picker of labelled stand-in illustrations; the reviewer bar, the picker's outcome hints and the report banner are reviewer tooling, not product UI.
- Prior works in the report are synthetic; session-saved works join them.
- Scores, taxon ids, content hashes and reference text are synthetic, and the reference and care text is illustrative rather than provider content.
- The eval walk and axe scripts ran from the session scratchpad; only their results are kept in the hub. Re-running them needs the artifact served over HTTP (for example the `proto` launch entry) and Playwright from the repository's `node_modules`.
