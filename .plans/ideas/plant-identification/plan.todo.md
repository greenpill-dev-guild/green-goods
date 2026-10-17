# Plant Identification — Discovery Plan

**Feature Slug**: `plant-identification`  
**Stage**: `ideas`  
**Status**: IDEA — design exploration authorized; production implementation pending  
**Created**: 2026-09-29  
**Last Updated**: 2026-09-29

## Decision log

[brief.md](brief.md) owns confirmed choices and open questions; [spec.md](spec.md) contains proposals and source evidence.

| # | Decision | Rationale |
|---|---|---|
| 1 | Kindwise provider | User has credits and selected it. |
| 2 | Manual photo-box trigger, light result overlay and editable auto-fill | User-selected flow to reduce typing while retaining judgment. |
| 3 | Five field actions; optional health on Survival Check and Maintenance | Confirmed launch scope. |
| 4 | Optional per-species quantities/per-crop weights, offline identification queue and separately attached late updates | Confirmed user answers; preserve measurement provenance, pending state and original snapshots. |
| 5 | Keep the hub at ideas; explore a synthetic artifact before implementation | User requested mock exploration; production design still needs review. |

## Current deliverables

- [x] Record action fields, candidate metadata, privacy and reporting rules.
- [x] Create brief, draft spec, discovery checklist, evaluation and machine state.
- [x] Ask initial product questions and record all four answers.
- [x] Ask dependent questions about late results and health applicability; record both answers.
- [x] Prepare the [Claude design prompt](handoffs/claude-design-exploration.md).
- [x] Resolve all six asked product questions in the brief and Claude prompt.
- [x] Claude produced the interactive artifact with layouts A, A+ and B on 2026-09-29 ([results](handoffs/claude-design-results.md)).
- [x] Ran the [mock evaluation](eval.md) headless on 2026-09-29 with labeled isolated-artifact evidence in `artifacts/`.
- [ ] User reviews/selects layout and health inclusion semantics.
- [ ] Resolve production decisions and obtain explicit spec acceptance.

The artifact exists at `artifacts/plant-identification-flow.html`; the results handoff carries the recommendation (A+) and the eight selection questions.

## Requirements coverage

| Need | Current evidence / next proof |
|---|---|
| Photo identification on specific actions | Confirmed scope; mock action switch and manual trigger. |
| Light overlay with details | Mock compact/expanded variants and disclosure. |
| Relevant default Details auto-fill | Spec action matrix; editable Planting, Maintenance and Harvest examples. |
| Optional plant health | Confirmed capability; requested suggestion with inclusion/correction. |
| Submission metadata | Selected entries versus evidence; mock Review and reviewer-only metadata inspector. |
| Privacy | First-request explanation and publication reminder; synthetic fixtures only. |
| Saved work and reports | Structured plant/evidence views; report allocations and source drill-through. |
| Offline/recovery | Confirmed queued intent; pending/cancel/resume, preserved edits and confirmed separate late-update semantics. |

## Promotion gate and later delivery outline

After design/product approval, replace discovery tasks with small implementation steps in actual dependency order. Candidate boundaries: action/data contracts; protected paid-request adapter; durable pending intent and attachment lifecycle; capture/Details/Review UI; saved-work/later-result rendering; explicitly scoped report consumers; focused regression and rendered proof.

These are planning inputs, not executable lanes. Read the plan skill before promotion and apply its implementation Linear-sync gate when applicable. No external tracker is created for this local exploration.

## Test strategy

Current documentation needs hub/schema, local-link and targeted formatting proof. A fixture artifact needs interaction checks and labeled rendered evidence, not production API or attestation tests.

Later implementation proof should cover paid-request authorization/deduplication, safe serialization, edited-value preservation, photo replacement/removal, stale response rejection, draft reload, queued offline recovery, late-result boundaries, legacy metadata and reporting allocation. Select required package checks after actual paths/criticality are known; Work/JobQueue/signing changes retain critical proof.

## Validation

Use `node scripts/harness/plan-hub.mjs validate` for hub state and focused formatting/link checks. Report actual commands/results at handoff. No production UI, API, deployment or runtime test proof is claimed.

Working-tree documentation proof on 2026-09-29:

- `node scripts/harness/plan-hub.mjs validate` — passed; 25 hubs validated.
- `bun run check -- --intent diagnose` — passed the selected `agent-guidance` check: Codex consistency, 15 behavior scenarios/15 task routes, and 77 guidance files.
- `bunx --no-install @biomejs/biome format .plans/ideas/plant-identification/status.json` — passed after targeted formatting.
- Local Markdown link resolution — all linked repository files exist.

This evidence is for uncommitted documentation, not a commit-attributed implementation receipt.

Mock proof on 2026-09-29 (isolated artifact, not authenticated or installed-PWA proof):

- Scripted eval walk in headless Chromium 148 (Playwright from `node_modules`) — 85/85 checks passed, 0 page or console errors; results in `artifacts/eval-walk-results.json`.
- axe-core 4.12 over 12 screens — no violations; results in `artifacts/axe-results.json`.
- 24 labeled screenshots at the 390 px and desktop frame sizes in `artifacts/screenshots/`.
- `node scripts/harness/plan-hub.mjs validate` — passed after the metadata links were added.
