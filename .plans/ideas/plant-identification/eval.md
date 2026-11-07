# Plant Identification — Design Evaluation

**Status**: Criteria for the future mock; not executed  
**Last Updated**: 2026-09-29

## Mock completion criteria

Use a deterministic interactive artifact with labeled synthetic fixtures. State must carry through the flow; disconnected screenshots are insufficient. No live Kindwise, wallet, upload or credit consumption.

| Scenario | Observable pass condition |
|---|---|
| Planting success | Identify guava; a light overlay appears; Species planted fills. Existing quantities/participants remain usable. |
| Ambiguous identity | Select an alternative; Details/Review agree. Original prediction remains in provenance disclosure. |
| Preserve measurements | Enter quantity/notes, change suggested name, and retain human input. |
| Manual value conflict | A conflicting manual name receives a visible choice, never silent replacement. |
| Duplicate evidence | A second guava photo supports an existing entry without doubling quantity. Distinct entries remain possible. |
| Remove/replace photo | Resolve stale results/rows visibly and preserve human-entered work. |
| Site assessment | Existing plants auto-fill; Planned plants changes only on explicit Add to planting plan. |
| Harvest | Name fills, weight stays manual. Total 12 kg with 8 kg allocated shows 4 kg unallocated. |
| Optional health | Separate request shows a possible issue; gardener can include/remove/correct it. No treatment is inferred. |
| Offline queue | Explicit tap queues an intent; pending state/cancel work. Reconnect simulates analysis without duplicates or losing edits. Manual entry remains usable. |
| Late result | Simulate submission before analysis finishes; show the labeled later result and deliberate separate update. Submitted metadata never silently changes. |
| Failure/credit limit | Preserve draft/manual input; retrieving/displaying results does not request new analysis. |
| Action scope | Five confirmed actions offer identification. Learning Reflection and an unrelated action do not. Health appears only in Survival Check and Maintenance. |
| Review/saved work | Final entries, measurements and photo links agree; identity/health suggestion differs from work approval. |
| Report | Observed/planted/harvested remain separate; unknown/unallocated amounts are visible; contributing work opens. |
| Privacy | Explain third-party processing and public publication. Metadata preview contains no provider secrets or precise location. |

## Design comparison

Compare (A) compact name/source overlay with Details disclosure and (B) slightly expanded light overlay with visible Added to Details state. Domain behavior stays identical; compare readability, photo visibility and field effort.

Inspect 390 px mobile and desktop. Test keyboard access, reachable preview/remove controls, touch targets, contrast over busy photos, focus return, non-color statuses, reduced motion and accessible asynchronous announcements.

## Research limits

Synthetic scores/diagnoses prove UI behavior only. They establish neither Kindwise accuracy nor local health suitability. A real pilot still needs representative plants/photos and approved account/credit/retention configuration.

## Evidence to return

Return the artifact, layout recommendation, tested interactions, remaining questions and screenshots labeled with engine/session, viewport/date. A standalone artifact uses an accurate isolated-artifact label; it is not authenticated gardener or installed-PWA proof. If rendered inspection is unavailable, record `none`.

The mock does not establish production readiness. Select fresh code checks after implementation approval.
