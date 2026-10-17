# Plant Identification for Work Submissions

**Slug**: `plant-identification`  
**Stage**: `ideas` — design exploration; production implementation is not authorized  
**Created**: 2026-09-29  
**Last Updated**: 2026-09-29

## Problem

Gardeners document plants in work photos but must enter plant information manually. Existing agro Details mostly capture categories and submission-wide measurements. Identification should reduce typing and create attributable plant evidence for work review, garden learning, and reports.

## Desired outcome

A gardener taps **Identify plant** in a photo box. A light card overlays the image with a suggested name and access to details or corrections. Relevant information fills editable fields in the action's **Details** step. A separate, optional **Check health** action provides an assessment. The submission preserves the gardener's entries and the evidence behind suggestions.

## Confirmed direction

| Decision | Basis |
|---|---|
| Use Kindwise plant.id and plant.health | User selected the provider and has credits. |
| Manual button in the image box, then a light result overlay | Explicit user direction. No automatic request on photo upload. |
| Fill relevant default Details to reduce manual entry | Explicit user direction; entries remain editable. |
| Launch on Site Assessment & Species Plan, Planting Event, Survival Check, Maintenance Activity, and Harvest & Yield Record | User answer on 2026-09-29. Learning Reflection is deferred. |
| Include species identification and optional health assessment | User answer on 2026-09-29. Separate request controls. |
| Include optional per-species planting quantities and per-crop harvest weights now | User answer on 2026-09-29. Photos cannot infer these measurements. |
| Let gardeners queue identification offline with a clear pending state | User answer on 2026-09-29. Work capture remains usable offline. |
| Late results appear separately; gardeners may attach a deliberate update | User answer on 2026-09-29. Preserve the original submitted snapshot. |
| Check health initially appears only in Survival Check and Maintenance | User answer on 2026-09-29. Other health contexts are deferred. |

## Scope

Current authorized work is this idea hub and a prompt for Claude to explore designs and build an interactive mock. Cover Media → Details → Review → saved work, plus a small reporting example. See the [Claude design prompt](handoffs/claude-design-exploration.md).

The candidate product includes action-specific plant rows, public-safe evidence snapshots, protected backend requests, credit controls, and gardener/steward display. [spec.md](spec.md) records the candidate design and repository evidence.

Production integration, paid API experiments, deployment, external tracker writes, and a full plant inventory are outside current authorization. No smart contract or indexer change is presently expected; confirm that inference during implementation planning.

## Open questions

All six product questions asked in this conversation are answered. Before production, settle credit eligibility and numerical quotas, low-confidence selection thresholds, vendor retention/consent wording, and taxon/category mapping rules. These are deliberately deferred until mock/pilot review in [spec.md](spec.md#decisions-before-production). The implementation of separately attached late updates also needs a concrete schema and authorization design.

## Success signal

In the mock, a gardener identifies guava, sees its name appear in Planting Details, corrects a suggestion without losing measurements, and reaches a saved work view showing the final entry and its source. Offline identification can be queued. A steward distinguishes a health suggestion from an observed fact. Reports do not invent counts or yield from photos.

## Next step

Review the interactive mock before approving the product spec or promoting this hub. [plan.todo.md](plan.todo.md) tracks discovery work only.
