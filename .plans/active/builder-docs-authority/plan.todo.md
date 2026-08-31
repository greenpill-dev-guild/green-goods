# Builder Documentation Authority Plan

**Feature Slug**: `builder-docs-authority`
**Stage**: `active`
**Status**: `IN PROGRESS`
**Created**: `2026-08-30`
**Last Updated**: `2026-08-31`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep exact archives in Git history | A second archive corpus would remain searchable and drift-prone. |
| 2 | Distill moves instead of relocating prose | Only knowledge code cannot express earns a durable authored home. |
| 3 | Commit deterministic generated MDX | Reviewers can inspect changes and CI can compare exact bytes. |
| 4 | Preserve existing generated-page slugs | Avoid needless public URL churn. |
| 5 | Use exact redirects only | A broad redirect would imply false equivalence. |
| 6 | Extend the Docs workflow | Avoid a ninth CI lane and keep one deployment owner. |
| 7 | Permit no authority or generated-output baseline | These failures are mechanically actionable and must be zero-debt. |
| 8 | Keep the Plan Hub repository-only | The user explicitly excluded a Linear mirror unless requested later. |
| 9 | Track the five-change delivery sequence as unfinished | The technical migration was implemented in one shared working tree, so five independently green merges cannot be claimed retroactively. The ordered delivery history must be reconstructed with the repository owner before this hub is closed. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the ontology renderer, status generator, docs audit, and CI patterns to reuse
- [x] Map tracked consumers and dirty overlap for all archive, delete, and move pages
- [x] Define archive, redirect, generated-output, and authored-page contracts
- [x] Select staged validation for each dependency-ordered checkpoint

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Reconcile 84 pages | `state_api` | Ledger | Completed |
| Remove 25 archive/delete pages | `state_api` | Change 1 | Completed |
| Distill and remove 15 misplaced pages | `state_api` | Change 2 | Completed |
| Generate 17 references | `state_api` | Change 3 | Completed |
| Shrink 26 authored guides | `state_api` | Change 4 | Completed |
| Enforce hard authority/generation gates | `state_api` | Change 5 | Completed |
| Render and regression proof | `state_api` | Final validation | Completed locally for the migration scope |
| Five sequential independently green changes | `state_api` | Delivery | Superseded — landed on develop 2026-08-31 as five rebased commits (`cfa4f2272`…`3562fd9c8`) in one batch, plus projection refresh `8190dc240` |
| First deployed sitemap proof | `state_api` | Deployment follow-up | Head Vercel deploy reached READY with a 79-route sitemap pre-landing; post-landing production proof pending (tracked in `documentation-agent-guidance-authority`) |

## TDD / Proof Order

- [x] Select current `docs-audit --ci` and stale-output behavior as RED evidence
- [x] Add generator-core unit tests before projection implementation
- [x] Add docs-audit fixtures before enabling hard CI exits
- [x] Record RED/GREEN proof for the `state_api` lane
- [x] Keep documentation-only migrations under direct build/audit proof

## Change 1 — Authority Severance, Archive, and Delete

- [x] Repair seven broken `source_of_truth` paths and unsupported community claims
- [x] Make all v1.0 consumers self-contained or current-authority-backed
- [x] Distill GreenWill and recovery decisions into owning Plan Hubs
- [x] Add `reference/product-history` and exact historical redirects
- [x] Rewire agent guidance, browser proof, ontology workflow, validation, sidebar, and links
- [x] Remove 11 historical specifications and 14 no-value pages
- [x] Prove 59 builder pages remain

## Change 2 — Distill and Move

- [x] Add missing package deployment/runbook guidance at code-adjacent owners
- [x] Consolidate release and operation ownership into contributing/root/scripts runbooks
- [x] Distill agent philosophy, GreenWill, Harvest, token-audit, and agentic-eval material
- [x] Rewire every surviving consumer and exact redirect
- [x] Remove 15 misplaced builder pages
- [x] Prove 44 builder pages remain

## Change 3 — Deterministic Projections

- [x] Add shared source loading, normalization, digest, render, write, and check primitives
- [x] Add static JSON/YAML/TypeScript readers with path and safe-field guards
- [x] Extend the pure ontology renderer for ERD, glossary, matrix, and lifecycle projections
- [x] Implement package/API/route, integration/status, workflow, and QA renderers
- [x] Generate and review all 17 outputs at stable slugs
- [x] Retire the unused wall-clock protocol-status JSON path
- [x] Prove write and check modes are byte-identical

## Change 4 — Shrink Authored Guidance

- [x] Convert journeys to goal, prerequisites, steps, recovery, and next action
- [x] Reduce package docs to boundaries, ownership, entrypoints, and generated references
- [x] Keep architecture rationale while removing generated facts
- [x] Keep conceptual integration guidance while removing volatile status
- [x] Keep testing usage guidance while generated pages own inventories and coverage claims
- [x] Preserve Revenue Explorer except for navigation/authority repairs
- [x] Prove the final 17 generated + 26 authored + 1 retained composition

## Change 5 — Hard CI Gates

- [x] Split docs-audit hard errors from editorial warnings
- [x] Validate generated frontmatter and exact local inputs
- [x] Add `docs:generate`, scoped generation, and `check:docs-generated` interfaces
- [x] Extend Docs workflow inputs and run audit/check before build
- [x] Keep validation selection and CI workflow routing in parity
- [x] Add negative fixtures for broken authority and stale output
- [x] Verify built sitemap contains only the intended 44 builder routes

## Validation

- [x] `node --test scripts/docs/generate.test.mjs`
- [x] `bun run docs:audit:ci`
- [x] `bun run check:docs-generated`
- [x] `bun run test:docs`
- [x] `bun run build:docs`
- [x] `bun run check:ontology`
- [x] `bun run test:validation-system`
- [x] `node --test scripts/quality/drift-check.test.mjs`
- [x] `bun run drift:check -- --scope docs --json`
- [ ] `node scripts/harness/plan-hub.mjs validate` — blocked by unrelated concurrent
  `client-pwa-platform-hardening` receipt/TDD debt; this hub validates in isolation.
- [x] `git diff --check`

## Post-review Validation

- [x] Prove malformed deployment addresses fail projection generation.
- [x] Prove every projection source selects the Docs workflow.
- [x] Prove broken redirect fragments and authored authority paths exit nonzero.
- [x] Rerun generator, docs audit, generated-output, docs build, ontology, validation-system, and
  recurrence checks after the review fixes.

The broader selected checkpoint still reports concurrent repository debt outside this migration:
the shared/client/admin suites cannot resolve `uint8arrays` through WalletConnect, one admin
funding-refresh assertion is red, source structure flags the concurrently edited client Work
Dashboard, and direct-seam fingerprints are stale. These are recorded as external blockers rather
than folded into the documentation change.

## Delivery

- [x] Superseded 2026-08-31: the migration landed on develop as five rebased commits
  (`cfa4f2272`, `104bc3a9c`, `b5652c7d1`, `dae4fe1ad`, `3562fd9c8`) in one batch rather than five
  independently merged changes. The batch left the api-index and persona-surfaces projections
  stale (Docs workflow red at `0086993ca`); repaired by `8190dc240` with the docs audit,
  generated-output, ontology, guidance, and docs test/build gates re-run green.
- [x] Superseded by the same landing; no per-change merges occurred. PR #785 is now zero-diff
  against develop and awaits the owner's close-or-merge decision.

## Deployment Follow-up

- [ ] Confirm the first post-landing production Vercel sitemap contains the same 44 builder routes
  proven by the local production build (deployment owner is Vercel; GitHub Actions validates only).
  Needs Vercel authentication — tracked with the production verification in
  `documentation-agent-guidance-authority`.
